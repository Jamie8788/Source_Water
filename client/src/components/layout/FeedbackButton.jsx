import { MessageCircleHeart } from 'lucide-react'

const FEEDBACK_FORM_URL = 'https://docs.google.com/forms/d/e/1FAIpQLSeKVAu6JLt9rYy4Pq8TTMjYxqXIbuXNinJ6feDj7Hab8-LeGA/viewform'

export default function FeedbackButton() {
  const open = () => window.open(FEEDBACK_FORM_URL, '_blank', 'noopener,noreferrer')

  return (
    <button
      onClick={open}
      title="Share feedback (opens Google Form)"
      aria-label="Share feedback"
      style={{
        position: 'fixed',
        bottom: 20,
        right: 20,
        height: 44,
        padding: '0 16px 0 12px',
        borderRadius: 22,
        border: 'none',
        background: 'linear-gradient(135deg,#6366f1,#14b8a6)',
        boxShadow: '0 6px 22px rgba(99,102,241,0.45)',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        cursor: 'pointer',
        zIndex: 49,
        color: '#fff',
        fontWeight: 700,
        fontSize: 13,
        letterSpacing: '0.02em',
        transition: 'transform 0.18s, box-shadow 0.18s',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.transform = 'scale(1.05)'
        e.currentTarget.style.boxShadow = '0 8px 28px rgba(99,102,241,0.6)'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.transform = 'scale(1)'
        e.currentTarget.style.boxShadow = '0 6px 22px rgba(99,102,241,0.45)'
      }}
    >
      <MessageCircleHeart size={18}/>
      Feedback
    </button>
  )
}
