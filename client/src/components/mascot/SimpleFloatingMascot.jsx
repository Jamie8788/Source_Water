import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import NibiMascotImage from '../NibiMascotImage'

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
  if (p.startsWith('/ai-lab'))    return 'labcoat'
  if (p.startsWith('/alerts'))    return 'thinking'
  if (p.startsWith('/explorer'))  return 'pointing'
  if (p.startsWith('/resources')) return 'guide'
  if (p.startsWith('/games'))     return 'happy'
  if (p.startsWith('/quiz'))      return 'happy'
  if (p.startsWith('/map'))       return 'pointing'
  if (p.startsWith('/sites'))     return 'pointing'
  if (p.startsWith('/community')) return 'wave'
  if (p.startsWith('/profile'))   return 'idle'
  if (p.startsWith('/admin'))     return 'tablet'
  if (p.startsWith('/dashboard')) return 'idle'
  return 'idle'
}

// Spontaneous moods Nibi cycles through to feel alive. Always returns to the
// page-default after a short visit.
const SPONTANEOUS = ['wave', 'happy', 'blush', 'thinking', 'openarms', 'pointing']

const HIDE_KEY = 'sw_nibi_hidden_v2'

export default function SimpleFloatingMascot() {
  const location = useLocation()
  const baseMood = useMemo(() => moodForPath(location.pathname), [location.pathname])
  const [mood, setMood] = useState(baseMood)
  const [hidden, setHidden] = useState(() => {
    try { return localStorage.getItem(HIDE_KEY) === '1' } catch { return false }
  })
  const reactionTimer = useRef(null)
  const spontaneousTimer = useRef(null)

  // Whenever route changes, reset to the new page's default mood.
  useEffect(() => { setMood(baseMood); clearTimeout(reactionTimer.current) }, [baseMood])

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

  // Click Nibi → quick wave reaction (ignored while a reaction is already playing).
  const onClick = () => {
    setMood('wave')
    clearTimeout(reactionTimer.current)
    reactionTimer.current = setTimeout(() => setMood(baseMood), 2500)
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
      onClick={onClick}
      style={{
        position: 'fixed', bottom: 18, right: 80, zIndex: 40,
        cursor: 'pointer', pointerEvents: 'auto',
        animation: 'swFloat 5s ease-in-out infinite',
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
      <div style={{ filter: 'drop-shadow(0 8px 20px rgba(99,102,241,0.35))' }}>
        <NibiMascotImage mood={mood} size={96} />
      </div>
      <style>{`
        @keyframes swFloat {
          0%,100% { transform: translateY(0) }
          50%     { transform: translateY(-6px) }
        }
      `}</style>
    </div>
  )
}
