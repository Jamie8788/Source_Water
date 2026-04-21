import { useState } from 'react'
import { MessageCircleHeart, X, Send } from 'lucide-react'

export default function FeedbackButton() {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')

  const submit = () => {
    if (!text.trim()) return
    const subject = encodeURIComponent('SOURCE Water — Feedback')
    const body = encodeURIComponent(text.trim() + '\n\nSent from: ' + window.location.href)
    window.location.href = `mailto:water@nordikinstitute.com?subject=${subject}&body=${body}`
    setText('')
    setOpen(false)
  }

  return (
    <>
      <button
        onClick={() => setOpen(o => !o)}
        title="Send feedback"
        aria-label="Send feedback"
        style={{
          position: 'fixed',
          bottom: 20,
          right: 20,
          width: 48,
          height: 48,
          borderRadius: '50%',
          border: 'none',
          background: 'linear-gradient(135deg,#6366f1,#14b8a6)',
          boxShadow: '0 6px 22px rgba(99,102,241,0.45)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          zIndex: 49,
          transition: 'transform 0.18s',
        }}
        onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.08)'}
        onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
      >
        {open ? <X size={18} color="#fff"/> : <MessageCircleHeart size={20} color="#fff"/>}
      </button>

      {open && (
        <div style={{
          position: 'fixed',
          bottom: 80,
          right: 20,
          width: 320,
          maxWidth: 'calc(100vw - 40px)',
          borderRadius: 14,
          padding: 14,
          background: 'var(--card-bg, #0d1f3c)',
          border: '1px solid rgba(99,102,241,0.3)',
          boxShadow: '0 12px 40px rgba(0,0,0,0.4)',
          zIndex: 49,
          color: 'var(--text, #fff)',
        }}>
          <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 8 }}>Share feedback</div>
          <div style={{ fontSize: 11, opacity: 0.7, marginBottom: 10 }}>
            Found a bug or have an idea? We'd love to hear it.
          </div>
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            rows={4}
            placeholder="What's on your mind?"
            style={{
              width: '100%',
              borderRadius: 8,
              border: '1px solid rgba(255,255,255,0.12)',
              background: 'rgba(255,255,255,0.05)',
              color: 'inherit',
              padding: '8px 10px',
              fontSize: 13,
              resize: 'vertical',
              fontFamily: 'inherit',
            }}
          />
          <button
            onClick={submit}
            disabled={!text.trim()}
            style={{
              marginTop: 8,
              width: '100%',
              padding: '8px 12px',
              borderRadius: 8,
              border: 'none',
              background: 'linear-gradient(135deg,#6366f1,#14b8a6)',
              color: '#fff',
              fontWeight: 700,
              fontSize: 12,
              cursor: text.trim() ? 'pointer' : 'not-allowed',
              opacity: text.trim() ? 1 : 0.5,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
            }}
          >
            <Send size={13}/> Send
          </button>
        </div>
      )}
    </>
  )
}
