import PageAmbience from '../components/layout/PageAmbience'
import { useState, useRef, useEffect } from 'react'
import api from '../utils/api'
import { Send, Mic, MicOff, Trash2, Droplets } from 'lucide-react'

const SUGGESTIONS = [
  'What is a safe pH level for drinking water?',
  'How does turbidity affect aquatic life?',
  'What causes algae blooms in Northern Ontario lakes?',
  'How do I read a water quality report?',
  'What are WHO guidelines for nitrates?',
  'How does temperature affect dissolved oxygen?',
  'What water issues affect Sault Ste. Marie?',
  'How can communities protect local watersheds?',
]

function Bubble({ msg }) {
  const isUser = msg.role === 'user'
  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : ''}`}>
      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold ${isUser ? 'text-white' : 'text-indigo-600'}`}
        style={{ background: isUser ? 'linear-gradient(135deg,#6366f1,#4f46e5)' : '#eef2ff' }}>
        {isUser ? '👤' : <Droplets className="w-4 h-4"/>}
      </div>
      <div className={`max-w-[78%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
        isUser
          ? 'text-white rounded-tr-sm'
          : 'rounded-tl-sm border'
      }`}
        style={isUser
          ? { background: 'linear-gradient(135deg,#6366f1,#4f46e5)' }
          : { background: 'var(--card-bg)', borderColor: 'var(--border)', color: 'var(--text)' }
        }>
        <div style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</div>
        {msg.model && <div className="text-xs mt-1 opacity-40">via {msg.model.split('/').pop()}</div>}
      </div>
    </div>
  )
}

export default function AskWater() {
  const [messages, setMessages] = useState([
    { role: 'assistant', content: "Hi! I'm Water, your AI assistant for all things water quality.\n\nI know about Northern Ontario's watersheds, Lake Superior & Huron, water quality parameters, WHO/EPA guidelines, and the Water Rangers program. What would you like to explore?" }
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [listening, setListening] = useState(false)
  const bottomRef = useRef(null)
  const recognitionRef = useRef(null)

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  const send = async (text) => {
    const msg = (text || input).trim()
    if (!msg || loading) return
    setInput('')
    const history = [...messages, { role: 'user', content: msg }]
    setMessages(history)
    setLoading(true)
    try {
      const apiMessages = history.map(m => ({ role: m.role, content: m.content }))
      const r = await api.post('/ai/chat', { messages: apiMessages })
      setMessages(prev => [...prev, { role: 'assistant', content: r.data.reply, model: r.data.model }])
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: "Sorry, I couldn't connect. Please try again." }])
    }
    setLoading(false)
  }

  const toggleVoice = () => {
    if (listening) { recognitionRef.current?.stop(); setListening(false); return }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) return alert('Voice not supported in this browser.')
    const rec = new SR()
    rec.lang = 'en-CA'
    rec.onresult = e => { setInput(e.results[0][0].transcript); setListening(false) }
    rec.onerror = () => setListening(false)
    rec.onend = () => setListening(false)
    recognitionRef.current = rec
    rec.start()
    setListening(true)
  }

  return (
    <div className="max-w-3xl mx-auto flex flex-col" style={{ height: 'calc(100vh - 130px)' }}>

      {/* Header */}
      <div className="flex items-center gap-3 mb-4 flex-shrink-0">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: 'linear-gradient(135deg,#6366f1,#14b8a6)' }}>
          <Droplets className="w-5 h-5 text-white"/>
        </div>
        <div className="flex-1">
          <h1 className="font-bold text-gray-900 text-base">Ask Water AI</h1>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Powered by Llama 3.2 · Water quality expert</p>
        </div>
        <button onClick={() => setMessages([{ role: 'assistant', content: "Hi! I'm Water. Ask me anything about water quality." }])}
          className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
          style={{ color: 'var(--text-muted)' }} title="Clear chat">
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {/* Suggestions */}
      {messages.length <= 1 && (
        <div className="flex flex-wrap gap-2 mb-4 flex-shrink-0">
          {SUGGESTIONS.map(s => (
            <button key={s} onClick={() => send(s)}
              className="text-xs px-3 py-1.5 rounded-full border transition-all hover:border-indigo-400 hover:bg-indigo-50 hover:text-indigo-700"
              style={{ borderColor: 'var(--border)', color: 'var(--text-muted)', background: 'var(--card-bg)' }}>
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Chat area */}
      <div className="flex-1 overflow-y-auto space-y-4 pb-4 pr-1">
        {messages.map((m, i) => <Bubble key={i} msg={m} />)}
        {loading && (
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: '#eef2ff' }}>
              <Droplets className="w-4 h-4 text-indigo-600"/>
            </div>
            <div className="card px-4 py-3 rounded-2xl rounded-tl-sm">
              <div className="flex gap-1 items-center h-4">
                {[0,1,2].map(i => (
                  <div key={i} className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: i*0.15+'s' }} />
                ))}
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input bar */}
      <div className="flex gap-2 pt-3 border-t flex-shrink-0" style={{ borderColor: 'var(--border)' }}>
        <button onClick={toggleVoice}
          className={`p-2.5 rounded-lg transition-all flex-shrink-0 ${listening ? 'bg-red-500 text-white animate-pulse' : 'hover:bg-gray-100'}`}
          style={listening ? {} : { color: 'var(--text-muted)' }}>
          {listening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
        </button>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
          placeholder="Ask about water quality, parameters, ecosystems..."
          className="flex-1"
        />
        <button onClick={() => send()} disabled={loading || !input.trim()} className="btn-primary px-4 py-2 flex-shrink-0 disabled:opacity-40">
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
