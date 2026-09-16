import { useState, useEffect, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate, useLocation } from 'react-router-dom'
import { Compass, ArrowRight, ArrowLeft, X, Check } from 'lucide-react'

// ── Interactive product tour ──────────────────────────────────────────────
// A coach-mark tour that spotlights the exact element to use, sits its card
// right next to it (with a pointer), and — on interactive steps — advances when
// you actually do the action. Self-contained: no external library, no backend;
// only a "seen" flag in localStorage (per device, migration-safe). Additive —
// renders nothing but its launcher until started; degrades to a centred card
// if a target isn't on screen.
const STEPS = [
  {
    title: 'Welcome to SOURCE Water 👋',
    body: "A 60-second tour of what you can actually DO here. I'll open each tab and point at the exact thing to click or type. On the blue-ringed steps, just do it — the tour moves on by itself. Skip any time.",
  },
  { route: '/dashboard', target: 'dash-livesite', interactive: true, title: 'Dashboard',
    body: 'Your home base — a live monitoring site, this month’s activity, and quick stats.',
    tip: 'Click here to choose a “live site” to watch.' },
  { route: '/monitoring', target: 'map-search', interactive: true, title: 'Site Map',
    body: 'The live map of 9,400+ monitoring stations.',
    tip: 'Type a place or water body here to find a station — then click its dot on the map.' },
  { route: '/ask-water', target: 'ask-input', interactive: true, title: 'Ask Water (AI)',
    body: 'A friendly AI you can type or speak to about the data or water in general.',
    tip: 'Click here and ask “What causes algae blooms?”, then press send.' },
  { route: '/ai-lab', target: 'ailab-search', interactive: true, title: 'Wet Lab — the smart part',
    body: 'Anomalies, a trust score, trends, correlations and “what to investigate” for any site.',
    tip: 'Search a site here, then open its Insights tab.' },
  { route: '/explorer', target: 'explorer-search', interactive: true, title: 'Dive into Data',
    body: 'The raw record behind the charts — every observation and parameter.',
    tip: 'Search any of 9,400+ sites here to browse its history.' },
  { route: '/quiz', target: 'quiz-search', interactive: true, title: 'Quiz Yourself',
    body: 'Short quizzes that teach water science and earn you points.',
    tip: 'Find a quiz here (or scroll the list) and start it.' },
  { route: '/resources', target: 'learning-paths', interactive: true, title: 'Resources + Learning Paths',
    body: 'Curated, verified guides — plus guided journeys that end with you using the platform.',
    tip: 'Open a Learning Path and follow its “DO IT” steps.' },
  { route: '/alerts', target: 'alerts-add', interactive: true, title: 'Alerts',
    body: 'Get warned automatically when a site crosses a threshold you care about.',
    tip: 'Click here to create a watch — a site, a parameter, and a limit.' },
  {
    title: "You're all set 🌊",
    body: 'That’s the tour. Explore freely — and relaunch it any time from the “Take a tour” button in the bottom-left corner.',
  },
]

const SEEN_KEY = 'sw_tour_seen_v1'
const markSeen = () => { try { localStorage.setItem(SEEN_KEY, '1') } catch {} }
const hasSeen = () => { try { return localStorage.getItem(SEEN_KEY) === '1' } catch { return false } }
const selectorFor = (t) => !t ? null : (/^[.#\[]/.test(t) ? t : `[data-tour="${t}"]`)

const CARD_W = 340, CARD_H = 220, GAP = 16

export default function ProductTour() {
  const navigate = useNavigate()
  const location = useLocation()
  const [active, setActive] = useState(false)
  const [step, setStep] = useState(0)
  const [rect, setRect] = useState(null)

  const s = STEPS[step]
  const start = useCallback(() => { setStep(0); setActive(true) }, [])
  const finish = useCallback(() => { setActive(false); setRect(null); markSeen() }, [])
  const next = useCallback(() => setStep(i => (i >= STEPS.length - 1 ? (finish(), i) : i + 1)), [finish])
  const back = useCallback(() => setStep(i => Math.max(0, i - 1)), [])

  useEffect(() => {
    if (!hasSeen()) { const t = setTimeout(() => setActive(true), 1200); return () => clearTimeout(t) }
  }, [])

  // Navigate to the step's route if needed.
  useEffect(() => {
    if (!active || !s) return
    if (s.route && location.pathname !== s.route) navigate(s.route)
  }, [active, step]) // eslint-disable-line react-hooks/exhaustive-deps

  // Find the target, then KEEP the rect synced to it every frame while the step
  // is active — so smooth-scroll, lazy content and layout shifts can't leave the
  // ring/card stranded at a stale position (the earlier bug).
  useEffect(() => {
    if (!active || !s) return
    if (s.route && location.pathname !== s.route) return
    if (!s.target) { setRect(null); return }

    let el = null, tries = 0, raf = 0, cleanupAction = null, cancelled = false

    const attach = (node) => {
      if (!s.interactive || !node) return
      const tag = node.tagName
      const isField = tag === 'INPUT' || tag === 'TEXTAREA' || node.getAttribute?.('contenteditable') === 'true'
      // Inputs: let the user actually type and explore — they advance with Next.
      // Buttons/panels: doing the real click advances the tour.
      if (isField) return
      const handler = () => setTimeout(() => { if (!cancelled) next() }, 260)
      node.addEventListener('click', handler, { once: true })
      cleanupAction = () => node.removeEventListener('click', handler)
    }

    // continuous sync loop
    const loop = () => {
      if (cancelled) return
      if (el) {
        const r = el.getBoundingClientRect()
        if (r.width > 0 || r.height > 0) {
          setRect(prev => (prev && prev.top === r.top && prev.left === r.left && prev.width === r.width && prev.height === r.height) ? prev : r)
        }
      }
      raf = requestAnimationFrame(loop)
    }

    const find = () => {
      if (cancelled) return
      el = document.querySelector(selectorFor(s.target))
      if (el) {
        try { el.scrollIntoView({ block: 'center', inline: 'nearest' }) } catch {}
        attach(el)
        raf = requestAnimationFrame(loop)
      } else if (tries++ < 120) {
        raf = requestAnimationFrame(find)
      } else {
        setRect(null) // graceful centred card
      }
    }
    find()

    return () => { cancelled = true; cancelAnimationFrame(raf); cleanupAction?.() }
  }, [active, step, location.pathname]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!active) return
    const onKey = (e) => {
      if (e.key === 'Escape') finish()
      else if (e.key === 'ArrowRight') next()
      else if (e.key === 'ArrowLeft') back()
      else if (e.key === 'Enter' && !['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) next()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [active, step, next, back, finish])

  const launcher = (
    <button onClick={start} title="Take a guided tour" style={{
      position: 'fixed', left: 16, bottom: 16, zIndex: 2147482000,
      display: 'flex', alignItems: 'center', gap: 7, padding: '9px 14px', borderRadius: 999,
      background: 'linear-gradient(135deg,#006fbf,#0a8ecf)', color: '#fff', border: 'none',
      cursor: 'pointer', fontSize: 12.5, fontWeight: 700, boxShadow: '0 6px 20px rgba(0,111,191,0.35)',
    }}>
      <Compass style={{ width: 15, height: 15 }} /> Take a tour
    </button>
  )
  if (!active) return launcher

  const isLast = step === STEPS.length - 1
  const PAD = 7
  const hasRect = rect && (rect.width > 0 || rect.height > 0)
  const vw = window.innerWidth, vh = window.innerHeight
  const cardW = Math.min(CARD_W, vw - 24)
  const clampX = (x) => Math.max(12, Math.min(x, vw - cardW - 12))
  const clampY = (y) => Math.max(12, Math.min(y, vh - CARD_H - 12))

  // 4-way placement: pick the side of the target with the most room, then align
  // the card to the target's centre and clamp to the viewport. `arrow` points
  // the caret back at the target.
  let cardStyle, arrow = null
  if (hasRect) {
    const cx = rect.left + rect.width / 2, cy = rect.top + rect.height / 2
    const below = vh - rect.bottom, above = rect.top, right = vw - rect.right, left = rect.left
    if (below >= CARD_H + GAP || below >= above && below >= 160) {
      const top = rect.bottom + GAP, lx = clampX(cx - cardW / 2)
      cardStyle = { top, left: lx, width: cardW }
      arrow = { side: 'top', offset: Math.max(14, Math.min(cx - lx, cardW - 14)) }
    } else if (above >= CARD_H + GAP || above >= 160) {
      const top = clampY(rect.top - GAP - CARD_H), lx = clampX(cx - cardW / 2)
      cardStyle = { top, left: lx, width: cardW }
      arrow = { side: 'bottom', offset: Math.max(14, Math.min(cx - lx, cardW - 14)) }
    } else if (right >= cardW + GAP) {
      const lx = rect.right + GAP, top = clampY(cy - CARD_H / 2)
      cardStyle = { top, left: lx, width: cardW }
      arrow = { side: 'left', offset: Math.max(14, Math.min(cy - top, CARD_H - 14)) }
    } else if (left >= cardW + GAP) {
      const lx = rect.left - GAP - cardW, top = clampY(cy - CARD_H / 2)
      cardStyle = { top, left: lx, width: cardW }
      arrow = { side: 'right', offset: Math.max(14, Math.min(cy - top, CARD_H - 14)) }
    } else {
      cardStyle = { top: '50%', left: '50%', width: cardW, transform: 'translate(-50%,-50%)' }
    }
  } else {
    cardStyle = { top: '50%', left: '50%', width: cardW, transform: 'translate(-50%,-50%)' }
  }

  const arrowStyle = arrow && (() => {
    const base = { position: 'absolute', width: 12, height: 12, background: 'var(--card-bg,#fff)', transform: 'rotate(45deg)' }
    if (arrow.side === 'top') return { ...base, top: -6, left: arrow.offset - 6, borderLeft: '1px solid var(--border,#e2e8f0)', borderTop: '1px solid var(--border,#e2e8f0)' }
    if (arrow.side === 'bottom') return { ...base, bottom: -6, left: arrow.offset - 6, borderRight: '1px solid var(--border,#e2e8f0)', borderBottom: '1px solid var(--border,#e2e8f0)' }
    if (arrow.side === 'left') return { ...base, left: -6, top: arrow.offset - 6, borderLeft: '1px solid var(--border,#e2e8f0)', borderBottom: '1px solid var(--border,#e2e8f0)' }
    return { ...base, right: -6, top: arrow.offset - 6, borderRight: '1px solid var(--border,#e2e8f0)', borderTop: '1px solid var(--border,#e2e8f0)' }
  })()

  const overlay = (
    <div style={{ position: 'fixed', inset: 0, zIndex: 2147483000 }}>
      {/* Dimmer / click control. Interactive steps keep the page clickable. */}
      <div style={{ position: 'absolute', inset: 0, background: hasRect ? 'transparent' : 'rgba(15,23,42,0.62)', pointerEvents: s?.interactive ? 'none' : 'auto' }} />

      {hasRect && (
        <div style={{
          position: 'absolute', top: rect.top - PAD, left: rect.left - PAD,
          width: rect.width + PAD * 2, height: rect.height + PAD * 2,
          borderRadius: 12, pointerEvents: 'none',
          boxShadow: '0 0 0 9999px rgba(15,23,42,0.62), 0 0 0 3px #38bdf8, 0 0 22px 4px rgba(56,189,248,0.7)',
        }} />
      )}

      <div style={{
        position: 'absolute', ...cardStyle, zIndex: 1,
        background: 'var(--card-bg, #fff)', color: 'var(--text, #0f172a)',
        border: '1px solid var(--border, #e2e8f0)', borderRadius: 14,
        boxShadow: '0 20px 60px rgba(0,0,0,0.35)', padding: 16, pointerEvents: 'auto',
        animation: 'swTourIn 0.2s ease both',
      }}>
        <style>{`@keyframes swTourIn{from{opacity:0}to{opacity:1}}`}</style>
        {arrowStyle && <div style={arrowStyle} />}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <span style={{ fontSize: 10.5, fontWeight: 800, color: '#006fbf', background: 'rgba(0,111,191,0.1)', padding: '2px 9px', borderRadius: 99 }}>Step {step + 1} / {STEPS.length}</span>
          {s?.interactive && hasRect && <span style={{ fontSize: 10, fontWeight: 800, color: '#0284c7', background: 'rgba(56,189,248,0.14)', padding: '2px 8px', borderRadius: 99 }}>try it →</span>}
          <button onClick={finish} title="Skip the tour" style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted, #64748b)', display: 'flex' }}><X style={{ width: 16, height: 16 }} /></button>
        </div>
        <h3 style={{ margin: '0 0 6px', fontSize: 16, fontWeight: 800 }}>{s.title}</h3>
        <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.5, color: 'var(--text-muted, #475569)' }}>{s.body}</p>
        {s.tip && (
          <div style={{ marginTop: 9, display: 'flex', gap: 7, alignItems: 'flex-start', background: 'rgba(56,189,248,0.1)', border: '1px solid rgba(56,189,248,0.3)', borderRadius: 9, padding: '8px 10px' }}>
            <ArrowRight style={{ width: 14, height: 14, color: '#0284c7', flexShrink: 0, marginTop: 1 }} />
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text, #0f172a)', lineHeight: 1.45 }}>{s.tip}</span>
          </div>
        )}
        <div style={{ display: 'flex', gap: 4, margin: '12px 0' }}>
          {STEPS.map((_, i) => <div key={i} style={{ flex: 1, height: 4, borderRadius: 4, background: i <= step ? '#006fbf' : 'var(--border, #e2e8f0)', transition: 'background .2s' }} />)}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button onClick={finish} style={{ fontSize: 12, fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted, #64748b)' }}>Skip tour</button>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            {step > 0 && (
              <button onClick={back} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12.5, fontWeight: 700, cursor: 'pointer', padding: '8px 14px', borderRadius: 9, border: '1px solid var(--border, #e2e8f0)', background: 'transparent', color: 'var(--text, #0f172a)' }}><ArrowLeft style={{ width: 14, height: 14 }} /> Back</button>
            )}
            <button onClick={next} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12.5, fontWeight: 800, cursor: 'pointer', padding: '8px 16px', borderRadius: 9, border: 'none', background: '#006fbf', color: '#fff' }}>
              {isLast ? <>Finish <Check style={{ width: 14, height: 14 }} /></> : <>{s?.interactive && hasRect ? 'Skip step' : 'Next'} <ArrowRight style={{ width: 14, height: 14 }} /></>}
            </button>
          </div>
        </div>
      </div>
    </div>
  )

  return createPortal(<>{launcher}{overlay}</>, document.body)
}
