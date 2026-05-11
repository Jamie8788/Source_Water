import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import FloatingNibiVideo from './FloatingNibiVideo'

/**
 * SimpleFloatingMascot — Nibi on every page, lifelike but lag-free.
 *
 * Why this design (lessons learned from the video version):
 *   - No <video> tag → no playback stalls, no blank frames between transitions,
 *     no GPU video decoder waking up, no battery drain after the dashboard sits open.
 *   - All motion is CSS keyframes on static PNG/WebP frames (already in /public/mascot-images).
 *     The browser GPU-composites these at full framerate without any JS work per tick.
 *   - Mood swaps happen on a setInterval at 10–18s — once every ~12s React rerenders
 *     a single <picture> element, that's it. No requestAnimationFrame loops.
 *   - When the tab is hidden (visibilitychange), we pause the interval so a backgrounded
 *     dashboard doesn't queue up mood swaps that all fire at once on resume.
 *
 * Realism comes from: page-aware base mood + occasional spontaneous reactions
 * (wave, blush, happy, thinking) + click-to-greet + the per-mood CSS animation
 * already inside NibiMascotImage (float, breathe, sway).
 */

// Map route → "default mood" for that page so Nibi feels contextual.
// Falls back to the resting set when the path doesn't match.
function moodForPath(pathname) {
  const p = (pathname || '').toLowerCase()
  if (p.startsWith('/ai-lab'))      return 'labcoat'
  if (p.startsWith('/alerts'))      return 'thinking'
  if (p.startsWith('/explorer'))    return 'pointing'
  if (p.startsWith('/resources'))   return 'guide'
  if (p.startsWith('/games'))       return 'happy'
  if (p.startsWith('/quiz'))        return 'happy'
  if (p.startsWith('/monitoring'))  return 'pointing'
  if (p.startsWith('/map'))         return 'pointing'
  if (p.startsWith('/sites'))       return 'pointing'
  if (p.startsWith('/social'))      return 'wave'
  if (p.startsWith('/community'))   return 'wave'
  if (p.startsWith('/profile'))     return 'idle'
  if (p.startsWith('/admin'))       return 'tablet'
  if (p.startsWith('/quick'))       return 'pointing'
  if (p.startsWith('/dashboard'))   return 'idle'
  if (p.startsWith('/reports'))     return 'thinking'
  if (p.startsWith('/research'))    return 'thinking'
  if (p.startsWith('/projects'))    return 'happy'
  if (p.startsWith('/analysis'))    return 'thinking'
  return 'idle'
}

// One short, friendly line per route — what Nibi says when you land
// on each page. Shown as a speech bubble next to her for ~6s after
// each route change. Kept deliberately punchy so non-technical
// community members get an instant "what is this page for?"
function explainerForPath(pathname) {
  const p = (pathname || '').toLowerCase()
  if (p.startsWith('/quick'))      return "Tap any seal to jump to a part of the platform."
  if (p.startsWith('/dashboard'))  return "Today's water snapshot — totals, recent samples, AI insights."
  if (p.startsWith('/ask-water'))  return "Ask me anything about water science or this platform."
  if (p.startsWith('/monitoring')) return "9,000+ real monitoring sites. Filter, compare, drop a story."
  if (p.startsWith('/map'))        return "Explore live water data on the map."
  if (p.startsWith('/alerts'))     return "Threshold warnings on parameters you care about."
  if (p.startsWith('/social'))     return "Community feed — posts, reactions, DMs, leaderboard."
  if (p.startsWith('/resources'))  return "Curated WR + DataStream resources, plus a CSV analyser you can ask questions about."
  if (p.startsWith('/quiz-admin')) return "Build, grade, and analyse quizzes for your community."
  if (p.startsWith('/quiz'))       return "Test what you know and earn points."
  if (p.startsWith('/games'))      return "Learn water science by playing."
  if (p.startsWith('/reports'))    return "Generate shareable reports from real readings."
  if (p.startsWith('/research'))   return "Open research projects and datasets you can join."
  if (p.startsWith('/projects'))   return "Track community water-monitoring projects."
  if (p.startsWith('/analysis'))   return "Deep-dive analysis on a single site or dataset."
  if (p.startsWith('/profile'))    return "Your XP, badges, and recent activity."
  if (p.startsWith('/admin'))      return "Site admin — users, CMS, settings, sponsors."
  return "Hi! I'm Nibi. Click me anytime for a quick wave."
}

// Spontaneous moods Nibi cycles through to feel alive. Always returns to the
// page-default after a short visit.
const SPONTANEOUS = ['wave', 'happy', 'blush', 'thinking', 'openarms', 'pointing']

const HIDE_KEY = 'sw_nibi_hidden_v2'

export default function SimpleFloatingMascot() {
  const location = useLocation()
  const baseMood = useMemo(() => moodForPath(location.pathname), [location.pathname])
  const explainer = useMemo(() => explainerForPath(location.pathname), [location.pathname])
  const [mood, setMood] = useState(baseMood)
  const [hidden, setHidden] = useState(() => {
    try { return localStorage.getItem(HIDE_KEY) === '1' } catch { return false }
  })
  // Speech-bubble visibility: shows for ~7s after each route change,
  // then politely fades out. User can re-trigger by clicking Nibi.
  const [bubbleOpen, setBubbleOpen] = useState(true)
  const reactionTimer = useRef(null)
  const spontaneousTimer = useRef(null)
  const bubbleTimer = useRef(null)

  // Whenever route changes, reset to the new page's default mood AND
  // re-open the explainer bubble for the new page.
  useEffect(() => {
    setMood(baseMood)
    clearTimeout(reactionTimer.current)
    setBubbleOpen(true)
    clearTimeout(bubbleTimer.current)
    bubbleTimer.current = setTimeout(() => setBubbleOpen(false), 7000)
    return () => clearTimeout(bubbleTimer.current)
  }, [baseMood, location.pathname])

  // Spontaneous-mood loop: every 10–18s pick a brief reaction, hold it ~3.5s,
  // then return to baseMood. Pauses when tab is hidden so it doesn't backlog.
  useEffect(() => {
    if (hidden) return
    let cancelled = false
    function scheduleNext() {
      const wait = 10000 + Math.random() * 8000   // 10–18s
      spontaneousTimer.current = setTimeout(() => {
        if (cancelled) return
        if (document.visibilityState !== 'visible') { scheduleNext(); return }
        const pick = SPONTANEOUS[Math.floor(Math.random() * SPONTANEOUS.length)]
        setMood(pick)
        reactionTimer.current = setTimeout(() => {
          if (!cancelled) setMood(baseMood)
        }, 3500)
        scheduleNext()
      }, wait)
    }
    scheduleNext()
    return () => {
      cancelled = true
      clearTimeout(spontaneousTimer.current)
      clearTimeout(reactionTimer.current)
    }
  }, [baseMood, hidden])

  // Click Nibi → quick wave reaction + re-show explainer for whatever
  // page the user is on. Ignored while a reaction is already playing.
  const onClick = () => {
    setMood('wave')
    clearTimeout(reactionTimer.current)
    reactionTimer.current = setTimeout(() => setMood(baseMood), 2500)
    setBubbleOpen(true)
    clearTimeout(bubbleTimer.current)
    bubbleTimer.current = setTimeout(() => setBubbleOpen(false), 7000)
  }

  const onHide = (e) => {
    e.stopPropagation()
    setHidden(true)
    try { localStorage.setItem(HIDE_KEY, '1') } catch {}
  }
  const onShow = () => {
    setHidden(false)
    try { localStorage.removeItem(HIDE_KEY) } catch {}
  }

  if (hidden) {
    // Tiny "bring Nibi back" pill so the hide isn't permanent.
    return (
      <button onClick={onShow}
        title="Show Nibi"
        style={{
          position: 'fixed', bottom: 18, right: 18, zIndex: 40,
          width: 36, height: 36, borderRadius: '50%',
          border: '1px solid rgba(167,139,250,0.45)',
          background: 'rgba(15,23,42,0.85)', color: '#a78bfa',
          fontSize: 18, lineHeight: '34px', cursor: 'pointer', padding: 0,
          backdropFilter: 'blur(6px)', boxShadow: '0 4px 14px rgba(0,0,0,0.35)',
        }}>
        💧
      </button>
    )
  }

  return (
    <div
      style={{
        position: 'fixed', bottom: 18, right: 18, zIndex: 40,
        pointerEvents: 'none',                       // bubble passes clicks through
        display: 'flex', alignItems: 'flex-end', gap: 10,
      }}
    >
      {/* ─── Page explainer speech bubble ─── */}
      {bubbleOpen && explainer && (
        <div
          role="status"
          style={{
            pointerEvents: 'auto',
            maxWidth: 260, padding: '10px 14px',
            background: 'linear-gradient(135deg, rgba(99,102,241,0.95), rgba(124,58,237,0.95))',
            color: '#fff', borderRadius: '14px 14px 4px 14px',
            fontSize: 12.5, lineHeight: 1.45, fontWeight: 500,
            boxShadow: '0 10px 28px rgba(99,102,241,0.45)',
            marginBottom: 24,
            animation: 'swBubbleIn 0.32s cubic-bezier(0.2,1,0.3,1)',
            position: 'relative',
          }}
        >
          {explainer}
          <button
            onClick={() => setBubbleOpen(false)}
            aria-label="Dismiss"
            style={{
              position: 'absolute', top: -6, right: -6,
              width: 20, height: 20, borderRadius: '50%',
              border: '1px solid rgba(255,255,255,0.4)',
              background: 'rgba(0,0,0,0.45)', color: '#fff',
              fontSize: 11, lineHeight: '16px', cursor: 'pointer',
              padding: 0,
            }}
          >×</button>
        </div>
      )}

      {/* ─── Nibi herself ─── */}
      <div
        onClick={onClick}
        style={{
          pointerEvents: 'auto',
          cursor: 'pointer',
          animation: 'swFloat 5s ease-in-out infinite',
          position: 'relative',
        }}
        title="Hi! I'm Nibi 💧 — click for a wave"
      >
        <button
          onClick={onHide}
          title="Hide Nibi"
          aria-label="Hide Nibi"
          style={{
            position: 'absolute', top: -4, right: -4,
            width: 20, height: 20, borderRadius: '50%',
            border: '1px solid rgba(255,255,255,0.3)',
            background: 'rgba(0,0,0,0.55)', color: '#fff',
            fontSize: 11, lineHeight: '16px', cursor: 'pointer',
            padding: 0, zIndex: 2,
          }}
        >
          ×
        </button>
        {/* Animated MP4 Nibi (FloatingNibiVideo) — one always-looping
            video + chroma-key + PNG fallback. Mood only changes the
            glow + a quick bounce; the video source never swaps, so
            there's no flicker like the previous attempts. */}
        <div style={{ filter: 'drop-shadow(0 8px 20px rgba(99,102,241,0.35))' }}>
          <FloatingNibiVideo mood={mood} size={96} />
        </div>
      </div>

      <style>{`
        @keyframes swFloat {
          0%,100% { transform: translateY(0) }
          50%     { transform: translateY(-6px) }
        }
        @keyframes swMoodFade {
          0%   { opacity: 0; transform: translateY(4px) scale(0.96); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes swBubbleIn {
          0%   { opacity: 0; transform: translateY(6px) scale(0.96); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </div>
  )
}
