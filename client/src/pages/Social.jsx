import PageAmbience from '../components/layout/PageAmbience'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
import { useSound } from '../context/SoundContext'
import api from '../utils/api'
import {
  Send, Plus, X, Image, Video, Mic, MicOff, Search, UserPlus,
  ArrowLeft, Heart, MessageCircle, Share2, MoreHorizontal,
  Smile, Award, TrendingUp, Users, Bookmark, Bell, Play,
  ChevronRight, Hash, Trash2, Pin
} from 'lucide-react'

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:3001/api').replace('/api', '')
const mediaUrl = (src) => !src ? '' : src.startsWith('http') ? src : `${API_BASE}${src}`

const REACTIONS = [
  { type: 'drop',       emoji: '💧', label: 'Drop',      color: '#0ea5e9' },
  { type: 'wave',       emoji: '🌊', label: 'Wave',      color: '#14b8a6' },
  { type: 'bubble',     emoji: '🫧', label: 'Bubble',    color: '#8b5cf6' },
  { type: 'curious',    emoji: '🔬', label: 'Curious',   color: '#f59e0b' },
  { type: 'great_work', emoji: '⭐', label: 'Star',      color: '#f97316' },
]

const timeAgo = (date) => {
  const diff = Date.now() - new Date(date)
  if (diff < 60000) return 'just now'
  if (diff < 3600000) return Math.floor(diff / 60000) + 'm'
  if (diff < 86400000) return Math.floor(diff / 3600000) + 'h'
  return Math.floor(diff / 86400000) + 'd'
}

/* ── Avatar ── */
function Avatar({ user, size = 40, className = '' }) {
  const name = user?.display_name || user?.username || '?'
  const bg = user?.avatar_bg_color || 'linear-gradient(135deg,#6366f1,#14b8a6)'
  if (user?.avatar_url) {
    return (
      <img src={mediaUrl(user.avatar_url)} alt={name}
        className={`rounded-full object-cover flex-shrink-0 ${className}`}
        style={{ width: size, height: size }}/>
    )
  }
  return (
    <div className={`rounded-full flex items-center justify-center flex-shrink-0 font-bold text-white ${className}`}
      style={{ width: size, height: size, background: bg, fontSize: size * 0.38 }}>
      {name[0]?.toUpperCase()}
    </div>
  )
}

/* ── Media Grid ── */
function MediaGrid({ media, type }) {
  if (!media?.length) return null
  const isVideo = type === 'video' || media[0]?.match(/\.(mp4|webm|mov)$/i)
  if (isVideo) {
    return (
      <div className="relative rounded-2xl overflow-hidden bg-black mb-3" style={{ maxHeight: 400 }}>
        <video controls src={mediaUrl(media[0])} className="w-full max-h-96 object-contain"/>
      </div>
    )
  }
  const cols = media.length === 1 ? 1 : media.length === 2 ? 2 : media.length === 3 ? 3 : 2
  return (
    <div className={`grid gap-1 mb-3 rounded-2xl overflow-hidden`}
      style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
      {media.slice(0, 4).map((src, i) => (
        <div key={i} className="relative" style={{ paddingBottom: media.length === 1 ? '56%' : '100%' }}>
          <img src={mediaUrl(src)} alt="" className="absolute inset-0 w-full h-full object-cover"
            style={{ borderRadius: media.length === 1 ? 0 : 4 }}/>
          {i === 3 && media.length > 4 && (
            <div className="absolute inset-0 bg-black/60 flex items-center justify-center text-white font-black text-2xl">
              +{media.length - 4}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

/* ── Post Card ── */
function PostCard({ post, currentUser, onReact, onDelete, onPin }) {
  const [showComments, setShowComments] = useState(false)
  const [comment, setComment] = useState('')
  const [comments, setComments] = useState([])
  const [showReactPicker, setShowReactPicker] = useState(false)
  const [myReaction, setMyReaction] = useState(null)
  const [reactCounts, setReactCounts] = useState(post.reactions || {})
  const [showMenu, setShowMenu] = useState(false)
  const reactTimerRef = useRef(null)

  const author = post.user || { display_name: post.display_name, username: post.username }
  const totalReacts = Object.values(reactCounts).reduce((a, b) => a + b, 0)

  const loadComments = async () => {
    if (!showComments) {
      const r = await api.get(`/posts/${post.id}/comments`).catch(() => ({ data: [] }))
      setComments(Array.isArray(r.data) ? r.data : r.data.comments || [])
    }
    setShowComments(s => !s)
  }

  const submitComment = async () => {
    if (!comment.trim()) return
    const r = await api.post(`/posts/${post.id}/comments`, { content: comment }).catch(() => null)
    if (r) {
      const newComment = r.data.comment || r.data
      setComments(prev => [...prev, newComment])
      setComment('')
    }
  }

  const handleReact = async (type) => {
    setShowReactPicker(false)
    if (myReaction === type) {
      await api.delete(`/posts/${post.id}/react`, { data: { reaction_type: type } }).catch(() => {})
      setReactCounts(prev => ({ ...prev, [type]: Math.max(0, (prev[type] || 0) - 1) }))
      setMyReaction(null)
    } else {
      if (myReaction) setReactCounts(prev => ({ ...prev, [myReaction]: Math.max(0, (prev[myReaction] || 0) - 1) }))
      const r = await api.post(`/posts/${post.id}/react`, { reaction_type: type }).catch(() => null)
      if (r) setReactCounts(r.data)
      else setReactCounts(prev => ({ ...prev, [type]: (prev[type] || 0) + 1 }))
      setMyReaction(type)
    }
  }

  return (
    <div className="card overflow-visible relative" style={{ marginBottom: 16 }}>
      {post.pinned === 1 && (
        <div className="px-4 pt-3 flex items-center gap-1.5 text-xs font-semibold text-amber-600">
          <Pin className="w-3 h-3"/> Pinned post
        </div>
      )}
      <div className="p-4">
        {/* Author row */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <Avatar user={author} size={44}/>
            <div>
              <div className="font-bold text-sm" style={{ color: 'var(--text)' }}>
                {author.display_name || author.username}
              </div>
              <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                @{author.username} · {timeAgo(post.created_at)}
                {post.location_tag && <span className="ml-1">📍 {post.location_tag}</span>}
              </div>
            </div>
          </div>
          <div className="relative">
            <button onClick={() => setShowMenu(s => !s)}
              className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
              <MoreHorizontal className="w-4 h-4" style={{ color: 'var(--text-muted)' }}/>
            </button>
            {showMenu && (
              <div className="absolute right-0 top-8 rounded-xl shadow-2xl border py-1 z-30 w-40"
                style={{ background: 'var(--card-bg)', borderColor: 'var(--border)' }}>
                {(post.user_id === currentUser?.id || currentUser?.is_admin) && (
                  <button onClick={() => { onDelete(post.id); setShowMenu(false) }}
                    className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-red-50 text-red-500 transition-colors">
                    <Trash2 className="w-3.5 h-3.5"/> Delete
                  </button>
                )}
                {currentUser?.is_admin && (
                  <button onClick={() => { onPin(post.id); setShowMenu(false) }}
                    className="flex items-center gap-2 w-full px-3 py-2 text-sm transition-colors"
                    style={{ color: 'var(--text)' }}>
                    <Pin className="w-3.5 h-3.5"/> {post.pinned ? 'Unpin' : 'Pin post'}
                  </button>
                )}
                <button onClick={() => { navigator.clipboard?.writeText(post.content); setShowMenu(false) }}
                  className="flex items-center gap-2 w-full px-3 py-2 text-sm transition-colors"
                  style={{ color: 'var(--text)' }}>
                  <Bookmark className="w-3.5 h-3.5"/> Copy text
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Content */}
        {post.content && (
          <p className="text-sm leading-relaxed mb-3" style={{ color: 'var(--text)' }}>
            {post.content.split(/(#\w+)/g).map((part, i) =>
              part.startsWith('#') ? (
                <span key={i} style={{ color: '#6366f1', fontWeight: 600 }}>{part}</span>
              ) : part
            )}
          </p>
        )}

        {/* Media */}
        <MediaGrid media={post.media} type={post.post_type}/>

        {/* Audio */}
        {post.post_type === 'audio' && post.media?.[0] && (
          <audio controls src={mediaUrl(post.media[0])} className="w-full rounded-xl mb-3"/>
        )}

        {/* Poll */}
        {post.poll_options && (
          <div className="rounded-2xl p-4 mb-3" style={{ background: 'var(--page-bg)', border: '1px solid var(--border)' }}>
            <p className="font-bold text-sm mb-3" style={{ color: 'var(--text)' }}>📊 {post.poll_question}</p>
            {(Array.isArray(post.poll_options) ? post.poll_options : JSON.parse(post.poll_options || '[]')).map((opt, i) => (
              <button key={i} onClick={() => api.post(`/posts/${post.id}/poll/vote`, { option_index: i })}
                className="w-full text-left px-4 py-2.5 rounded-xl mb-2 text-sm font-medium transition-all hover:scale-[1.01]"
                style={{ background: 'var(--card-bg)', border: '1.5px solid var(--border)', color: 'var(--text)' }}>
                {opt}
              </button>
            ))}
          </div>
        )}

        {/* Reactions summary */}
        {totalReacts > 0 && (
          <div className="flex items-center gap-1 mb-2">
            <div className="flex">
              {REACTIONS.filter(r => reactCounts[r.type] > 0).slice(0, 3).map(r => (
                <span key={r.type} className="text-sm -ml-0.5 first:ml-0">{r.emoji}</span>
              ))}
            </div>
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{totalReacts}</span>
          </div>
        )}

        {/* Action bar */}
        <div className="flex items-center gap-1 pt-3 border-t" style={{ borderColor: 'var(--border)' }}>
          {/* React button with hover picker */}
          <div className="relative"
            onMouseEnter={() => { clearTimeout(reactTimerRef.current); setShowReactPicker(true) }}
            onMouseLeave={() => { reactTimerRef.current = setTimeout(() => setShowReactPicker(false), 400) }}>
            <button className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-all hover:bg-gray-50"
              style={{ color: myReaction ? REACTIONS.find(r => r.type === myReaction)?.color : 'var(--text-muted)' }}>
              {myReaction ? REACTIONS.find(r => r.type === myReaction)?.emoji : '😊'}
              <span className="text-xs">{myReaction ? REACTIONS.find(r => r.type === myReaction)?.label : 'React'}</span>
            </button>
            {showReactPicker && (
              <div className="absolute bottom-full left-0 mb-2 rounded-2xl shadow-2xl border flex gap-1 p-2 z-30"
                style={{ background: 'var(--card-bg)', borderColor: 'var(--border)' }}>
                {REACTIONS.map(r => (
                  <button key={r.type} onClick={() => handleReact(r.type)} title={r.label}
                    className="flex flex-col items-center gap-0.5 p-2 rounded-xl hover:scale-125 transition-all"
                    style={{ background: myReaction === r.type ? r.color + '20' : 'transparent' }}>
                    <span className="text-xl">{r.emoji}</span>
                    <span className="text-xs font-semibold" style={{ color: r.color, fontSize: 9 }}>{r.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <button onClick={loadComments}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-all hover:bg-gray-50"
            style={{ color: 'var(--text-muted)' }}>
            <MessageCircle className="w-4 h-4"/>
            <span className="text-xs">{post.comment_count || 0}</span>
          </button>

          <button className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-all hover:bg-gray-50 ml-auto"
            style={{ color: 'var(--text-muted)' }}>
            <Share2 className="w-4 h-4"/>
          </button>
        </div>
      </div>

      {/* Comments */}
      {showComments && (
        <div className="border-t px-4 py-3 space-y-3" style={{ background: 'var(--page-bg)', borderColor: 'var(--border)' }}>
          {comments.map((c, i) => (
            <div key={c.id || i} className="flex gap-2">
              <Avatar user={{ display_name: c.display_name, username: c.username, avatar_url: c.avatar_url }} size={28}/>
              <div className="rounded-2xl px-3 py-2 flex-1 text-sm" style={{ background: 'var(--card-bg)' }}>
                <span className="font-bold text-xs" style={{ color: 'var(--text)' }}>
                  {c.display_name || c.username}
                </span>
                <span className="ml-2 text-sm" style={{ color: 'var(--text)' }}>{c.content}</span>
              </div>
            </div>
          ))}
          <div className="flex gap-2">
            <Avatar user={currentUser} size={28}/>
            <div className="flex-1 flex gap-2">
              <input value={comment} onChange={e => setComment(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && submitComment()}
                placeholder="Write a comment..."
                className="flex-1 text-sm py-1.5 px-3 rounded-full"
                style={{ background: 'var(--card-bg)', border: '1px solid var(--border)' }}/>
              <button onClick={submitComment}
                className="w-8 h-8 rounded-full flex items-center justify-center text-white flex-shrink-0"
                style={{ background: '#6366f1' }}>
                <Send className="w-3.5 h-3.5"/>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ── Post Composer ── */
function PostComposer({ user, onPost }) {
  const [expanded, setExpanded] = useState(false)
  const [content, setContent] = useState('')
  const [media, setMedia] = useState([])
  const [postType, setPostType] = useState('text')
  const [submitting, setSubmitting] = useState(false)
  const imageRef = useRef(null)
  const videoRef = useRef(null)

  const submit = async () => {
    if (!content.trim() && !media.length) return
    setSubmitting(true)
    try {
      let r
      if (media.length) {
        const fd = new FormData()
        fd.append('content', content)
        fd.append('post_type', postType)
        media.forEach(f => fd.append('media', f))
        r = await api.post('/posts', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      } else {
        r = await api.post('/posts', { content, post_type: postType })
      }
      onPost(r.data.post || r.data)
      setContent(''); setMedia([]); setExpanded(false); setPostType('text')
    } catch {}
    setSubmitting(false)
  }

  return (
    <div className="card p-4 mb-4">
      <div className="flex gap-3">
        <Avatar user={user} size={42}/>
        <div className="flex-1">
          {!expanded ? (
            <button onClick={() => setExpanded(true)} className="w-full text-left px-4 py-2.5 rounded-full text-sm transition-colors"
              style={{ background: 'var(--page-bg)', color: 'var(--text-muted)', border: '1.5px solid var(--border)' }}>
              What's happening with water today?
            </button>
          ) : (
            <>
              <textarea value={content} onChange={e => setContent(e.target.value)} autoFocus
                placeholder="Share something with the water community..."
                rows={3} maxLength={500}
                className="w-full resize-none text-sm p-3 rounded-2xl"
                style={{ background: 'var(--page-bg)', border: '1.5px solid var(--border)', color: 'var(--text)' }}/>

              {/* Media previews */}
              {media.length > 0 && (
                <div className="flex gap-2 flex-wrap mt-2">
                  {media.map((f, i) => (
                    <div key={i} className="relative">
                      {f.type.startsWith('video') ? (
                        <video src={URL.createObjectURL(f)} className="h-20 rounded-xl" controls/>
                      ) : (
                        <img src={URL.createObjectURL(f)} alt="" className="h-20 w-20 object-cover rounded-xl"/>
                      )}
                      <button type="button" onClick={() => setMedia(prev => prev.filter((_, j) => j !== i))}
                        className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center text-xs">×</button>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex items-center justify-between mt-3 pt-3 border-t" style={{ borderColor: 'var(--border)' }}>
                <div className="flex gap-1">
                  <input ref={imageRef} type="file" accept="image/*" multiple className="hidden"
                    onChange={e => { setMedia(prev => [...prev, ...Array.from(e.target.files || [])]); setPostType('image') }}/>
                  <button type="button" onClick={() => imageRef.current?.click()}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors hover:bg-green-50"
                    style={{ color: '#10b981' }}>
                    <Image className="w-4 h-4"/> Photo
                  </button>
                  <input ref={videoRef} type="file" accept="video/*" className="hidden"
                    onChange={e => { if (e.target.files?.[0]) { setMedia([e.target.files[0]]); setPostType('video') } }}/>
                  <button type="button" onClick={() => videoRef.current?.click()}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors hover:bg-red-50"
                    style={{ color: '#ef4444' }}>
                    <Video className="w-4 h-4"/> Video
                  </button>
                  <span className="text-xs self-center ml-1" style={{ color: 'var(--text-light)' }}>
                    {content.length}/500
                  </span>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => { setExpanded(false); setContent(''); setMedia([]) }}
                    className="px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors"
                    style={{ color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
                    Cancel
                  </button>
                  <button onClick={submit} disabled={submitting || (!content.trim() && !media.length)}
                    className="px-4 py-1.5 rounded-xl text-xs font-bold text-white transition-all disabled:opacity-50"
                    style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)' }}>
                    {submitting ? 'Posting...' : '✦ Post (+5 pts)'}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

/* ── WhatsApp DM Panel ── */
function DMPanel({ onClose }) {
  const { user } = useAuth()
  const [view, setView] = useState('list')
  const [convos, setConvos] = useState([])
  const [selected, setSelected] = useState(null)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [recording, setRecording] = useState(false)
  const [memberSearch, setMemberSearch] = useState('')
  const [members, setMembers] = useState([])
  const mediaRef = useRef(null)
  const chunksRef = useRef([])
  const bottomRef = useRef(null)

  useEffect(() => {
    api.get('/messages/conversations').then(r => setConvos(r.data.conversations || [])).catch(() => {})
  }, [])

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  const openConvo = (convo) => {
    setSelected(convo)
    setView('chat')
    api.get(`/messages/conversation/${convo.other_user_id}`).then(r => setMessages(r.data.messages || [])).catch(() => {})
  }

  const startWith = (member) => {
    setSelected({ other_user_id: member.id, display_name: member.display_name, username: member.username, avatar_url: member.avatar_url })
    setView('chat')
    api.get(`/messages/conversation/${member.id}`).then(r => setMessages(r.data.messages || [])).catch(() => {})
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
    if (!input.trim() || !selected) return
    const content = input
    setInput('')
    setMessages(prev => [...prev, { content, sender_id: user.id, created_at: new Date().toISOString() }])
    await api.post('/messages', { recipient_id: selected.other_user_id, content }).catch(() => {})
  }

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mr = new MediaRecorder(stream)
      chunksRef.current = []
      mr.ondataavailable = e => chunksRef.current.push(e.data)
      mr.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        const fd = new FormData()
        fd.append('voice_note', blob, 'voice.webm')
        fd.append('recipient_id', selected.other_user_id)
        const r = await api.post('/messages/voice', fd).catch(() => null)
        if (r) setMessages(prev => [...prev, r.data.message])
        stream.getTracks().forEach(t => t.stop())
      }
      mediaRef.current = mr; mr.start(); setRecording(true)
    } catch { alert('Microphone access denied') }
  }

  const stopRecording = () => { mediaRef.current?.stop(); setRecording(false) }

  return (
    <div className="fixed bottom-0 right-6 w-[360px] rounded-t-2xl shadow-2xl z-50 flex flex-col overflow-hidden"
      style={{ height: 520, background: 'var(--card-bg)', border: '1px solid var(--border)', borderBottom: 'none' }}>

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 flex-shrink-0"
        style={{ background: 'linear-gradient(135deg,#075e54,#128c7e)' }}>
        <div className="flex items-center gap-2">
          {(view === 'chat' || view === 'new') && (
            <button onClick={() => setView('list')} className="text-white/80 hover:text-white mr-1">
              <ArrowLeft className="w-4 h-4"/>
            </button>
          )}
          <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
            {view === 'chat' && selected ? (
              <span className="text-white text-sm font-bold">
                {(selected.display_name || selected.username)?.[0]?.toUpperCase()}
              </span>
            ) : (
              <MessageCircle className="w-4 h-4 text-white"/>
            )}
          </div>
          <div>
            <h2 className="font-bold text-sm text-white">
              {view === 'list' ? 'Messages' : view === 'new' ? 'New Chat' : (selected?.display_name || selected?.username)}
            </h2>
            {view === 'chat' && <p className="text-xs text-white/60">online</p>}
          </div>
        </div>
        <div className="flex items-center gap-1">
          {view === 'list' && (
            <button onClick={() => { setView('new'); setMemberSearch(''); setMembers([]) }}
              className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition-colors">
              <UserPlus className="w-4 h-4 text-white"/>
            </button>
          )}
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/20 transition-colors">
            <X className="w-4 h-4 text-white"/>
          </button>
        </div>
      </div>

      {/* Conversations list */}
      {view === 'list' && (
        <div className="flex-1 overflow-y-auto">
          {convos.length === 0 ? (
            <div className="p-8 text-center">
              <div className="text-5xl mb-3">💬</div>
              <p className="font-bold text-sm" style={{ color: 'var(--text)' }}>No conversations yet</p>
              <p className="text-xs mt-1 mb-4" style={{ color: 'var(--text-muted)' }}>Message someone to get started</p>
              <button onClick={() => { setView('new'); setMemberSearch(''); setMembers([]) }}
                className="btn-primary text-xs py-2 px-4 mx-auto">
                <UserPlus className="w-3.5 h-3.5"/> New Message
              </button>
            </div>
          ) : convos.map(c => (
            <button key={c.other_user_id} onClick={() => openConvo(c)}
              className="w-full flex items-center gap-3 px-4 py-3 transition-colors text-left border-b hover:bg-gray-50"
              style={{ borderColor: 'var(--border)' }}>
              <div className="w-11 h-11 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0"
                style={{ background: 'linear-gradient(135deg,#6366f1,#14b8a6)' }}>
                {(c.display_name || c.username)?.[0]?.toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm" style={{ color: 'var(--text)' }}>
                  {c.display_name || c.username}
                </div>
                <div className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>
                  {c.last_message || 'Start chatting...'}
                </div>
              </div>
              {c.unread_count > 0 && (
                <span className="w-5 h-5 rounded-full text-white text-xs flex items-center justify-center font-bold flex-shrink-0"
                  style={{ background: '#25d366' }}>
                  {c.unread_count}
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Member search */}
      {view === 'new' && (
        <div className="flex-1 overflow-y-auto">
          <div className="p-3 border-b" style={{ borderColor: 'var(--border)', background: '#f0f2f5' }}>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"/>
              <input value={memberSearch} onChange={e => searchMembers(e.target.value)}
                placeholder="Search people..." autoFocus
                className="w-full pl-9 pr-3 py-2 text-sm rounded-full"
                style={{ background: 'white', border: '1px solid #ddd' }}/>
            </div>
          </div>
          <div>
            {memberSearch.length < 2 && (
              <p className="p-4 text-xs text-center" style={{ color: 'var(--text-muted)' }}>
                Type at least 2 characters to search
              </p>
            )}
            {members.map(m => (
              <button key={m.id} onClick={() => startWith(m)}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left border-b"
                style={{ borderColor: 'var(--border)' }}>
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
                  style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)' }}>
                  {(m.display_name || m.username)?.[0]?.toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm" style={{ color: 'var(--text)' }}>{m.display_name || m.username}</div>
                  <div className="text-xs" style={{ color: 'var(--text-muted)' }}>@{m.username}</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Chat view */}
      {view === 'chat' && (
        <>
          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-1.5"
            style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'20\' height=\'20\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Ccircle cx=\'2\' cy=\'2\' r=\'1\' fill=\'%23e2e8f0\' fill-opacity=\'0.5\'/%3E%3C/svg%3E")',
              backgroundSize: '20px 20px' }}>
            {messages.length === 0 && (
              <div className="text-center text-xs py-8 rounded-2xl px-4 mx-auto max-w-xs"
                style={{ background: 'rgba(255,255,255,0.8)', color: 'var(--text-muted)' }}>
                🔒 Messages are end-to-end encrypted
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.sender_id === user.id ? 'justify-end' : 'justify-start'}`}>
                {m.voice_note_url ? (
                  <audio controls src={mediaUrl(`/uploads/${m.voice_note_url}`)}
                    className="max-w-[80%] rounded-2xl" style={{ height: 40 }}/>
                ) : (
                  <div className={`max-w-[78%] px-3.5 py-2 rounded-2xl text-sm shadow-sm ${
                    m.sender_id === user.id ? 'rounded-tr-sm' : 'rounded-tl-sm'
                  }`}
                    style={{
                      background: m.sender_id === user.id ? '#dcf8c6' : 'white',
                      color: '#1a1a1a',
                    }}>
                    <p>{m.content}</p>
                    <p className="text-right mt-0.5" style={{ fontSize: 10, color: '#8a8a8a' }}>
                      {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                )}
              </div>
            ))}
            <div ref={bottomRef}/>
          </div>

          {/* Input bar */}
          <div className="flex items-center gap-2 p-2 flex-shrink-0"
            style={{ background: '#f0f2f5', borderTop: '1px solid var(--border)' }}>
            <button onClick={recording ? stopRecording : startRecording}
              className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 transition-all ${
                recording ? 'bg-red-500 animate-pulse' : 'bg-white'
              }`}>
              {recording ? <MicOff className="w-4 h-4 text-white"/> : <Mic className="w-4 h-4 text-gray-500"/>}
            </button>
            <input value={input} onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && send()}
              placeholder="Type a message"
              className="flex-1 text-sm py-2 px-4 rounded-full"
              style={{ background: 'white', border: '1px solid #ddd' }}/>
            <button onClick={send} disabled={!input.trim()}
              className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 disabled:opacity-40"
              style={{ background: '#128c7e' }}>
              <Send className="w-4 h-4 text-white"/>
            </button>
          </div>
        </>
      )}
    </div>
  )
}

/* ── Leaderboard Sidebar Card ── */
function LeaderboardCard() {
  const [data, setData] = useState([])
  useEffect(() => { api.get('/leaderboard?limit=5').then(r => setData(r.data.leaderboard || [])).catch(() => {}) }, [])
  const medals = ['🥇', '🥈', '🥉']
  return (
    <div className="card p-4">
      <div className="flex items-center gap-2 mb-3">
        <Award className="w-4 h-4 text-yellow-500"/>
        <h3 className="font-bold text-sm" style={{ color: 'var(--text)' }}>Top Contributors</h3>
      </div>
      <div className="space-y-2">
        {data.map((u, i) => (
          <div key={u.id || i} className="flex items-center gap-2.5">
            <span className="text-base w-5 text-center flex-shrink-0">{medals[i] || `${i+1}`}</span>
            <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
              style={{ background: 'linear-gradient(135deg,#6366f1,#14b8a6)' }}>
              {(u.display_name || u.username)?.[0]?.toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold truncate" style={{ color: 'var(--text)' }}>
                {u.display_name || u.username}
              </div>
            </div>
            <div className="text-xs font-black" style={{ color: '#6366f1' }}>{u.total_points || 0}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ── Trending Tags ── */
function TrendingCard() {
  const tags = ['#WaterQuality', '#NorthernOntario', '#LakeHuron', '#FieldWork', '#pHMonitoring', '#AlgaeBloom']
  return (
    <div className="card p-4">
      <div className="flex items-center gap-2 mb-3">
        <TrendingUp className="w-4 h-4 text-indigo-500"/>
        <h3 className="font-bold text-sm" style={{ color: 'var(--text)' }}>Trending</h3>
      </div>
      <div className="space-y-2">
        {tags.map((tag, i) => (
          <div key={tag} className="flex items-center gap-2 cursor-pointer hover:opacity-75 transition-opacity">
            <Hash className="w-3 h-3 flex-shrink-0" style={{ color: '#6366f1' }}/>
            <span className="text-sm font-semibold" style={{ color: '#6366f1' }}>{tag.slice(1)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ── Main Social Page ── */
export default function Social() {
  const { user } = useAuth()
  const { play } = useSound()
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)
  const [showDM, setShowDM] = useState(false)

  useEffect(() => {
    api.get('/posts').then(r => { setPosts(r.data.posts || []); setLoading(false) }).catch(() => setLoading(false))
  }, [])

  const handlePost = (newPost) => {
    if (newPost) setPosts(prev => [newPost, ...prev])
    play('success')
  }

  const handleDelete = async (id) => {
    await api.delete(`/posts/${id}`).catch(() => {})
    setPosts(prev => prev.filter(p => p.id !== id))
  }

  const handlePin = async (id) => {
    await api.put(`/posts/${id}/pin`).catch(() => {})
    setPosts(prev => prev.map(p => p.id === id ? { ...p, pinned: p.pinned ? 0 : 1 } : p))
  }

  return (
    <div>
      {/* Page header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-black" style={{ color: 'var(--text)' }}>Social Space</h1>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Connect with the water community</p>
        </div>
        <button onClick={() => { setShowDM(s => !s); play('click') }}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90"
          style={{ background: 'linear-gradient(135deg,#075e54,#128c7e)' }}>
          <MessageCircle className="w-4 h-4"/> Messages
        </button>
      </div>

      {/* 3-col layout */}
      <div className="flex gap-5">

        {/* Left: user card */}
        <div className="hidden xl:flex flex-col gap-4 w-[240px] flex-shrink-0">
          <div className="card p-5">
            <div className="flex flex-col items-center text-center">
              <Avatar user={user} size={60}/>
              <div className="font-bold mt-3" style={{ color: 'var(--text)' }}>{user?.display_name || user?.username}</div>
              <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>@{user?.username}</div>
              <div className="text-xs mt-1 px-2 py-0.5 rounded-full" style={{ background: 'var(--page-bg)', color: 'var(--text-muted)' }}>
                {user?.role || 'Community Member'}
              </div>
              <div className="flex gap-4 mt-3 pt-3 border-t w-full justify-center" style={{ borderColor: 'var(--border)' }}>
                <div className="text-center">
                  <div className="font-black text-sm" style={{ color: 'var(--text)' }}>{user?.total_points || user?.xp || 0}</div>
                  <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Points</div>
                </div>
                <div className="text-center">
                  <div className="font-black text-sm" style={{ color: 'var(--text)' }}>{user?.level || 1}</div>
                  <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Level</div>
                </div>
              </div>
            </div>
          </div>
          <LeaderboardCard/>
        </div>

        {/* Center: feed */}
        <div className="flex-1 min-w-0">
          <PostComposer user={user} onPost={handlePost}/>

          {loading ? (
            <div className="space-y-4">
              {[1,2,3].map(i => (
                <div key={i} className="card p-4 space-y-3">
                  <div className="flex gap-3">
                    <div className="skeleton w-11 h-11 rounded-full"/>
                    <div className="flex-1 space-y-2">
                      <div className="skeleton h-3 w-32 rounded"/>
                      <div className="skeleton h-2 w-24 rounded"/>
                    </div>
                  </div>
                  <div className="skeleton h-16 rounded-xl"/>
                </div>
              ))}
            </div>
          ) : posts.length === 0 ? (
            <div className="card p-12 text-center">
              <div className="text-6xl mb-4">🌊</div>
              <h3 className="font-bold text-lg mb-1" style={{ color: 'var(--text)' }}>Nothing here yet</h3>
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Be the first to share something with the community!</p>
            </div>
          ) : (
            <div>
              {posts.map(p => (
                <PostCard key={p.id} post={p} currentUser={user}
                  onReact={() => {}} onDelete={handleDelete} onPin={handlePin}/>
              ))}
            </div>
          )}
        </div>

        {/* Right: widgets */}
        <div className="hidden lg:flex flex-col gap-4 w-[260px] flex-shrink-0">
          <TrendingCard/>
          <LeaderboardCard/>
          <div className="card p-4">
            <div className="flex items-center gap-2 mb-3">
              <Bell className="w-4 h-4 text-indigo-500"/>
              <h3 className="font-bold text-sm" style={{ color: 'var(--text)' }}>Quick Stats</h3>
            </div>
            <div className="space-y-2 text-sm" style={{ color: 'var(--text-muted)' }}>
              <div className="flex justify-between">
                <span>Posts today</span>
                <span className="font-bold" style={{ color: 'var(--text)' }}>{posts.filter(p => new Date(p.created_at) > new Date(Date.now() - 86400000)).length}</span>
              </div>
              <div className="flex justify-between">
                <span>Total posts</span>
                <span className="font-bold" style={{ color: 'var(--text)' }}>{posts.length}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* WhatsApp DM */}
      {showDM && <DMPanel onClose={() => setShowDM(false)}/>}
    </div>
  )
}
