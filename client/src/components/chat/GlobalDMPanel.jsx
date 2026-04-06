/**
 * GlobalDMPanel — floating WhatsApp-style DM panel
 * Lives in Layout so it works on EVERY page, no navigation needed.
 * Polls every 3s for new messages — real-time feel without WebSockets.
 */
import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../../context/AuthContext'
import api from '../../utils/api'
import {
  X, Send, Mic, MicOff, Image, UserPlus, ArrowLeft, MessageCircle, Search,
} from 'lucide-react'

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:3001/api').replace('/api', '')
const mediaUrl = (src) => !src ? '' : src.startsWith('http') ? src : `${API_BASE}${src}`

export default function GlobalDMPanel({ onClose, initialUserId = null }) {
  const { user } = useAuth()
  const [view, setView] = useState('list')
  const [convos, setConvos] = useState([])
  const [selected, setSelected] = useState(null)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [recording, setRecording] = useState(false)
  const [memberSearch, setMemberSearch] = useState('')
  const [members, setMembers] = useState([])
  const [sending, setSending] = useState(false)
  const mediaRef = useRef(null)
  const chunksRef = useRef([])
  const bottomRef = useRef(null)
  const inputRef = useRef(null)

  const fetchConvos = () =>
    api.get('/messages/conversations').then(r => {
      const data = Array.isArray(r.data) ? r.data : []
      setConvos(data.map(c => ({
        other_user_id: c.other_id,
        display_name: c.user?.display_name || c.user?.username || 'Unknown',
        username: c.user?.username,
        last_message: c.last_message,
        unread_count: c.unread_count || 0,
        avatar: c.user?.avatar_emoji,
      })))
    }).catch(() => {})

  // Always poll conversations every 5s
  useEffect(() => {
    fetchConvos()
    const iv = setInterval(fetchConvos, 5000)
    return () => clearInterval(iv)
  }, [])

  // If opened with a specific user, jump straight to chat
  useEffect(() => {
    if (!initialUserId) return
    api.get(`/users/${initialUserId}`).then(r => {
      const u = r.data
      setSelected({ other_user_id: u.id, display_name: u.display_name || u.username, username: u.username })
      setView('chat')
      api.get(`/messages/${u.id}`).then(r2 => setMessages(Array.isArray(r2.data) ? r2.data : [])).catch(() => {})
    }).catch(() => {})
  }, [initialUserId])

  // Scroll to bottom when messages change
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  // Poll messages every 3s in chat view for real-time feel
  useEffect(() => {
    if (view !== 'chat' || !selected?.other_user_id) return
    const iv = setInterval(() => {
      api.get(`/messages/${selected.other_user_id}`).then(r => {
        if (Array.isArray(r.data)) setMessages(r.data)
      }).catch(() => {})
    }, 3000)
    return () => clearInterval(iv)
  }, [view, selected?.other_user_id])

  const openConvo = (convo) => {
    setSelected(convo); setView('chat')
    api.get(`/messages/${convo.other_user_id}`).then(r => setMessages(Array.isArray(r.data) ? r.data : [])).catch(() => {})
    setTimeout(() => inputRef.current?.focus(), 100)
  }

  const startWith = (member) => {
    setSelected({ other_user_id: member.id, display_name: member.display_name || member.username, username: member.username })
    setView('chat')
    api.get(`/messages/${member.id}`).then(r => setMessages(Array.isArray(r.data) ? r.data : [])).catch(() => {})
    setTimeout(() => inputRef.current?.focus(), 100)
  }

  const searchMembers = async (q) => {
    setMemberSearch(q)
    if (q.length < 2) { setMembers([]); return }
    try {
      const r = await api.get(`/users/search?q=${encodeURIComponent(q)}`)
      setMembers((r.data.users || []).filter(m => m.id !== user?.id))
    } catch { setMembers([]) }
  }

  const send = async () => {
    const content = input.trim()
    if (!content || !selected || sending) return
    setSending(true)
    setInput('')
    // Optimistic update
    const optimistic = { id: `opt-${Date.now()}`, content, sender_id: user.id, created_at: new Date().toISOString() }
    setMessages(prev => [...prev, optimistic])
    try {
      const r = await api.post(`/messages/${selected.other_user_id}`, { content })
      // Replace optimistic with real message
      setMessages(prev => prev.map(m => m.id === optimistic.id ? r.data : m))
      fetchConvos()
    } catch {
      // Remove optimistic on failure
      setMessages(prev => prev.filter(m => m.id !== optimistic.id))
      setInput(content)
    }
    setSending(false)
  }

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mr = new MediaRecorder(stream)
      chunksRef.current = []
      mr.ondataavailable = e => chunksRef.current.push(e.data)
      mr.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        const fd = new FormData(); fd.append('voice_note', blob, 'voice.webm')
        const token = localStorage.getItem('sw_token')
        const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:3001/api'
        const res = await fetch(`${apiBase}/messages/${selected.other_user_id}`, {
          method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: fd,
        }).catch(() => null)
        const data = res ? await res.json().catch(() => null) : null
        if (data?.id) setMessages(prev => [...prev, data])
        stream.getTracks().forEach(t => t.stop())
        fetchConvos()
      }
      mediaRef.current = mr; mr.start(); setRecording(true)
    } catch { alert('Microphone access denied') }
  }

  const stopRecording = () => { mediaRef.current?.stop(); setRecording(false) }

  const totalUnread = convos.reduce((s, c) => s + (c.unread_count || 0), 0)

  return (
    <div
      style={{
        position: 'fixed', bottom: 0, right: 24, width: 360,
        height: 520, zIndex: 9999,
        background: 'var(--card-bg)',
        border: '1px solid var(--border)',
        borderBottom: 'none',
        borderRadius: '16px 16px 0 0',
        boxShadow: '0 -4px 40px rgba(0,0,0,0.2)',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg,#075e54,#128c7e)', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
        {(view === 'chat' || view === 'new') && (
          <button onClick={() => setView('list')} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.8)', cursor: 'pointer', padding: 2, display: 'flex' }}>
            <ArrowLeft style={{ width: 16, height: 16 }}/>
          </button>
        )}
        <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          {view === 'chat' && selected
            ? <span style={{ color: 'white', fontWeight: 700, fontSize: 14 }}>{(selected.display_name)?.[0]?.toUpperCase()}</span>
            : <MessageCircle style={{ width: 16, height: 16, color: 'white' }}/>
          }
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ color: 'white', fontWeight: 700, fontSize: 14 }}>
            {view === 'list' ? `Messages${totalUnread > 0 ? ` (${totalUnread})` : ''}` : view === 'new' ? 'New Chat' : (selected?.display_name || selected?.username)}
          </div>
          {view === 'chat' && <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11 }}>● online</div>}
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {view === 'list' && (
            <button onClick={() => { setView('new'); setMemberSearch(''); setMembers([]) }}
              style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 8, padding: '5px 7px', cursor: 'pointer', display: 'flex' }}>
              <UserPlus style={{ width: 14, height: 14, color: 'white' }}/>
            </button>
          )}
          <button onClick={onClose}
            style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 8, padding: '5px 7px', cursor: 'pointer', display: 'flex' }}>
            <X style={{ width: 14, height: 14, color: 'white' }}/>
          </button>
        </div>
      </div>

      {/* Conversations list */}
      {view === 'list' && (
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {convos.length === 0 ? (
            <div style={{ padding: '40px 20px', textAlign: 'center' }}>
              <div style={{ fontSize: 40, marginBottom: 10 }}>💬</div>
              <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)', marginBottom: 6 }}>No conversations yet</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>Start chatting with someone</div>
              <button onClick={() => { setView('new'); setMemberSearch(''); setMembers([]) }}
                style={{ padding: '8px 20px', borderRadius: 20, background: '#128c7e', color: 'white', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <UserPlus style={{ width: 13, height: 13 }}/> New Message
              </button>
            </div>
          ) : convos.map(c => (
            <button key={c.other_user_id} onClick={() => openConvo(c)}
              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: 'transparent', border: 'none', borderBottom: '1px solid var(--border)', cursor: 'pointer', textAlign: 'left', transition: 'background 0.1s' }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(99,102,241,0.05)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              <div style={{ width: 42, height: 42, borderRadius: '50%', background: 'linear-gradient(135deg,#6366f1,#14b8a6)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: 16, flexShrink: 0 }}>
                {c.display_name?.[0]?.toUpperCase() || '?'}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text)', marginBottom: 2 }}>{c.display_name}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.last_message || 'Start chatting...'}</div>
              </div>
              {c.unread_count > 0 && (
                <div style={{ width: 20, height: 20, borderRadius: '50%', background: '#25d366', color: 'white', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {c.unread_count}
                </div>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Member search */}
      {view === 'new' && (
        <div style={{ flex: 1, overflowY: 'auto' }}>
          <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)', background: '#f0f2f5' }}>
            <div style={{ position: 'relative' }}>
              <Search style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', width: 14, height: 14, color: '#9ca3af' }}/>
              <input value={memberSearch} onChange={e => searchMembers(e.target.value)}
                placeholder="Search by name or username..." autoFocus
                style={{ width: '100%', paddingLeft: 32, paddingRight: 12, paddingTop: 8, paddingBottom: 8, borderRadius: 20, background: 'white', border: '1px solid #ddd', fontSize: 13, boxSizing: 'border-box', outline: 'none' }}/>
            </div>
          </div>
          {memberSearch.length < 2 && (
            <div style={{ padding: '20px', textAlign: 'center', fontSize: 12, color: 'var(--text-muted)' }}>Type at least 2 characters to search</div>
          )}
          {members.map(m => (
            <button key={m.id} onClick={() => startWith(m)}
              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: 'transparent', border: 'none', borderBottom: '1px solid var(--border)', cursor: 'pointer', textAlign: 'left' }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(99,102,241,0.05)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              <div style={{ width: 38, height: 38, borderRadius: '50%', background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: 15, flexShrink: 0 }}>
                {(m.display_name || m.username)?.[0]?.toUpperCase()}
              </div>
              <div>
                <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text)' }}>{m.display_name || m.username}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>@{m.username}</div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Chat */}
      {view === 'chat' && (
        <>
          <div style={{
            flex: 1, overflowY: 'auto', padding: '12px 10px', display: 'flex', flexDirection: 'column', gap: 4,
            backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'20\' height=\'20\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Ccircle cx=\'2\' cy=\'2\' r=\'1\' fill=\'%23e2e8f0\' fill-opacity=\'0.4\'/%3E%3C/svg%3E")',
            backgroundSize: '20px 20px',
          }}>
            {messages.length === 0 && (
              <div style={{ textAlign: 'center', padding: '30px 20px', fontSize: 12, color: 'var(--text-muted)', background: 'rgba(255,255,255,0.7)', borderRadius: 12, margin: 'auto 20px' }}>
                🔒 Send your first message
              </div>
            )}
            {messages.map((m, i) => {
              const isMe = m.sender_id === user?.id
              return (
                <div key={m.id || i} style={{ display: 'flex', justifyContent: isMe ? 'flex-end' : 'flex-start' }}>
                  {m.voice_note ? (
                    <audio controls src={mediaUrl(m.voice_note)} style={{ maxWidth: '78%', height: 38 }}/>
                  ) : m.media && (m.media.includes('.jpg') || m.media.includes('.png') || m.media.includes('.webp') || m.media.includes('.gif') || m.media.includes('.jpeg')) ? (
                    <img src={mediaUrl(m.media)} alt="" style={{ maxWidth: '78%', maxHeight: 200, borderRadius: 12, objectFit: 'cover' }}/>
                  ) : m.media && (m.media.includes('.mp4') || m.media.includes('.webm') || m.media.includes('video')) ? (
                    <video controls src={mediaUrl(m.media)} style={{ maxWidth: '78%', maxHeight: 200, borderRadius: 12 }}/>
                  ) : (
                    <div style={{
                      maxWidth: '78%', padding: '8px 12px', borderRadius: 16,
                      borderTopRightRadius: isMe ? 4 : 16,
                      borderTopLeftRadius: isMe ? 16 : 4,
                      background: isMe ? '#dcf8c6' : 'white',
                      color: '#111', fontSize: 13, lineHeight: 1.5,
                      boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
                    }}>
                      <div>{m.content}</div>
                      <div style={{ fontSize: 10, color: '#8a8a8a', textAlign: 'right', marginTop: 2 }}>
                        {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        {isMe && ' ✓'}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
            <div ref={bottomRef}/>
          </div>

          {/* Input */}
          <div style={{ background: '#f0f2f5', borderTop: '1px solid var(--border)', padding: 8, display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
            <button onClick={recording ? stopRecording : startRecording}
              style={{ width: 36, height: 36, borderRadius: '50%', background: recording ? '#ef4444' : 'white', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, animation: recording ? 'pulse 1s infinite' : 'none' }}>
              {recording ? <MicOff style={{ width: 14, height: 14, color: 'white' }}/> : <Mic style={{ width: 14, height: 14, color: '#6b7280' }}/>}
            </button>
            <label style={{ width: 36, height: 36, borderRadius: '50%', background: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, cursor: 'pointer' }} title="Send image/video">
              <Image style={{ width: 14, height: 14, color: '#6b7280' }}/>
              <input type="file" accept="image/*,video/*" style={{ display: 'none' }} onChange={async e => {
                const file = e.target.files?.[0]
                if (!file || !selected) return
                const fd = new FormData(); fd.append('media', file)
                try {
                  const token = localStorage.getItem('sw_token')
                  const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:3001/api'
                  const res = await fetch(`${apiBase}/messages/${selected.other_user_id}`, {
                    method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: fd,
                  })
                  const data = await res.json()
                  if (data?.id) { setMessages(prev => [...prev, data]); fetchConvos() }
                } catch { alert('Failed to send file') }
                e.target.value = ''
              }}/>
            </label>
            <input ref={inputRef} value={input} onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
              placeholder="Type a message..."
              style={{ flex: 1, padding: '8px 14px', borderRadius: 20, background: 'white', border: '1px solid #ddd', fontSize: 13, outline: 'none' }}/>
            <button onClick={send} disabled={!input.trim() || sending}
              style={{ width: 36, height: 36, borderRadius: '50%', background: '#128c7e', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, opacity: !input.trim() || sending ? 0.4 : 1 }}>
              <Send style={{ width: 14, height: 14, color: 'white' }}/>
            </button>
          </div>
        </>
      )}
    </div>
  )
}
