import { useState, useEffect, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate, useLocation } from 'react-router-dom'
import { Compass, ArrowRight, ArrowLeft, X, Check } from 'lucide-react'

// ── Interactive product tour ──────────────────────────────────────────────
// A self-contained coach-mark tour: it spotlights a real element, tells you
// what to do, and walks you tab-by-tab. No external library, no backend — the
// only thing it remembers is "have you seen it" in localStorage (per device,
// migration-safe). Fully additive: it renders nothing until you start it.
//
// Each step: { route?, target?, title, body, tip? }
//   route  — navigate here first (skipped if you're already there)
//   target — a data-tour value (e.g. 'nav:/monitoring') or a CSS selector;
//            omit for a centred card (welcome / finish)
//   tip    — the highlighted "what to actually do" line
const STEPS = [
  {
    title: 'Welcome to SOURCE Water 👋',
    body: "Here's a 60-second tour of what you can actually DO here — not just where things are. I'll open each tab and show you the first move to make. You can skip any time.",
  },
  {
    route: '/dashboard', target: 'nav:/dashboard',
    title: 'Dashboard',
    body: 'Your at-a-glance home: a live monitoring site, this month\'s activity, and quick stats.',
    tip: 'Pick a “live site” here to watch its latest readings.',
  },
  {
    route: '/monitoring', target: 'nav:/monitoring',
    title: 'Site Map',
    body: 'The live map of 9,400+ Water Rangers stations across Canada and beyond.',
    tip: 'On this page: click any dot to open a station’s readings — or drop your own field pin.',
  },
  {
    route: '/ask-water', target: 'nav:/ask-water',
    title: 'Ask Water (AI)',
    body: 'A friendly AI you can type or speak to about the data or water in general.',
    tip: 'Try typing: “What causes algae blooms?” and press send.',
  },
  {
    route: '/ai-lab', target: 'nav:/ai-lab',
    title: 'Wet Lab — the smart part',
    body: 'Pick a site and get anomalies, a trust score, trends, correlations, and “what to investigate”.',
    tip: 'On this page: search a site, then open the Insights tab to read its plain-English story.',
  },
  {
    route: '/explorer', target: 'nav:/explorer',
    title: 'Dive into Data',
    body: 'Browse every observation and parameter in detail — the raw record behind the charts.',
    tip: 'Search a site and scroll its readings to see the full history.',
  },
  {
    route: '/quiz', target: 'nav:/quiz',
    title: 'Quiz Yourself',
    body: 'Short quizzes that teach water science and earn you points.',
    tip: 'Start any quiz to earn your first points.',
  },
  {
    route: '/resources', target: 'nav:/resources',
    title: 'Resources + Learning Paths',
    body: 'Curated, verified guides — plus guided journeys that end with you using the platform.',
    tip: 'Open a Learning Path and follow the “DO IT” steps.',
  },
  {
    route: '/alerts', target: 'nav:/alerts',
    title: 'Alerts',
    body: 'Get warned automatically when a site crosses a threshold you care about.',
    tip: 'Create a watch: pick a site, a parameter, and a limit.',
  },
  {
    title: "You're all set 🌊",
    body: 'That\'s the tour. Explore freely — and you can relaunch this anytime from the “Take a tour” button in the bottom-left corner.',
  },
]

const SEEN_KEY = 'sw_tour_seen_v1'
function markSeen() { try { localStorage.setItem(SEEN_KEY, '1') } catch {} }
function hasSeen() { try { return localStorage.getItem(SEEN_KEY) === '1' } catch { return false } }

function selectorFor(target) {
  if (!target) return null
  return /^[.#\[]/.test(target) ? target : `[data-tour="${target}"]`
}

export default function ProductTour() {
  const navigate = useNavigate()
  const location = useLocation()
  const [active, setActive] = useState(false)
  const [step, setStep] = useState(0)
  const [rect, setRect] = useState(null)   // highlighted element's box, or null → centred
  const rafRef = useRef(null)

  const start = useCallback(() => { setStep(0); setActive(true) }, [])
  const finish = useCallback(() => { setActive(false); setRect(null); markSeen() }, [])

  // Gentle first-run: offer the tour once (the welcome step is skippable).
  useEffect(() => {
    if (!hasSeen()) {
      const t = setTimeout(() => setActive(true), 1200)
      return () => clearTimeout(t)
    }
  }, [])

  const s = STEPS[step]

  // Navigate to the step's route if we're not already there.
  useEffect(() => {
    if (!active || !s) return
    if (s.route && location.pathname !== s.route) navigate(s.route)
  }, [active, step]) // eslint-disable-line react-hooks/exhaustive-deps

  // Locate + track the target element (poll briefly since routes lazy-load).
  useEffect(() => {
    if (!active || !s) return
    if (s.route && location.pathname !== s.route) return // wait until routed
    if (!s.target) { setRect(null); return }

    let tries = 0
    const find = () => {
      const el = document.querySelector(selectorFor(s.target))
      if (el) {
        try { el.scrollIntoView({ block: 'center', behavior: 'smooth' }) } catch {}
        setRect(el.getBoundingClientRect())
      } else if (tries++ < 90) {
        rafRef.current = requestAnimationFrame(find)
      } else {
        setRect(null) // give up gracefully → centred card, still shows the text
      }
    }
    find()

    const onMove = () => {
      const el = document.querySelector(selectorFor(s.target))
      if (el) setRect(el.getBoundingClientRect())
    }
    window.addEventListener('scroll', onMove, true)
    window.addEventListener('resize', onMove)
    return () => {
      cancelAnimationFrame(rafRef.current)
      window.removeEventListener('scroll', onMove, true)
      window.removeEventListener('resize', onMove)
    }
  }, [active, step, location.pathname]) // eslint-disable-line react-hooks/exhaustive-deps

  const next = () => { if (step >= STEPS.length - 1) finish(); else setStep(s => s + 1) }
  const back = () => setStep(s => Math.max(0, s - 1))

  // Keyboard: → / Enter next, ← back, Esc exit.
  useEffect(() => {
    if (!active) return
    const onKey = (e) => {
      if (e.key === 'Escape') finish()
      else if (e.key === 'ArrowRight' || e.key === 'Enter') next()
      else if (e.key === 'ArrowLeft') back()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [active, step]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Floating launcher (always available) ──
  const launcher = (
    <button
      onClick={start}
      title="Take a guided tour"
      style={{
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
  const pad = 8
  const hasRect = rect && rect.width > 0

  // Tooltip placement: below the target if there's room, else above; centred
  // when there's no target.
  const vw = window.innerWidth, vh = window.innerHeight
  const cardW = Math.min(360, vw - 32)
  let cardStyle
  if (hasRect) {
    const below = rect.bottom + 14
    const placeBelow = below + 190 < vh
    const top = placeBelow ? rect.bottom + 14 : Math.max(12, rect.top - 14 - 180)
    let left = rect.left + rect.width / 2 - cardW / 2
    left = Math.max(12, Math.min(left, vw - cardW - 12))
    cardStyle = { top, left, width: cardW }
  } else {
    cardStyle = { top: '50%', left: '50%', width: cardW, transform: 'translate(-50%,-50%)' }
  }

  const overlay = (
    <div style={{ position: 'fixed', inset: 0, zIndex: 2147483000 }}>
      {/* Click-blocker + dimmer. When we have a target, the spotlight ring's
          huge box-shadow provides the dim; otherwise this full dim covers all. */}
      <div style={{ position: 'absolute', inset: 0, background: hasRect ? 'transparent' : 'rgba(15,23,42,0.62)', pointerEvents: 'auto' }} />

      {/* Spotlight ring around the target */}
      {hasRect && (
        <div style={{
          position: 'absolute',
          top: rect.top - pad, left: rect.left - pad,
          width: rect.width + pad * 2, height: rect.height + pad * 2,
          borderRadius: 12, pointerEvents: 'none',
          boxShadow: '0 0 0 9999px rgba(15,23,42,0.62), 0 0 0 3px #38bdf8, 0 0 22px 4px rgba(56,189,248,0.65)',
          transition: 'all 0.25s cubic-bezier(0.4,0,0.2,1)',
        }} />
      )}

      {/* Coach-mark card */}
      <div style={{
        position: 'absolute', ...cardStyle, zIndex: 1,
        background: 'var(--card-bg, #fff)', color: 'var(--text, #0f172a)',
        border: '1px solid var(--border, #e2e8f0)', borderRadius: 14,
        boxShadow: '0 20px 60px rgba(0,0,0,0.35)', padding: 16, pointerEvents: 'auto',
        animation: 'swTourIn 0.25s ease both',
      }}>
        <style>{`@keyframes swTourIn{from{opacity:0;transform:${hasRect ? 'translateY(6px)' : 'translate(-50%,-46%)'}}to{opacity:1;transform:${hasRect ? 'none' : 'translate(-50%,-50%)'}}}`}</style>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <span style={{ fontSize: 10.5, fontWeight: 800, color: '#006fbf', background: 'rgba(0,111,191,0.1)', padding: '2px 9px', borderRadius: 99 }}>
            Step {step + 1} / {STEPS.length}
          </span>
          <button onClick={finish} title="Skip the tour" style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted, #64748b)', display: 'flex' }}>
            <X style={{ width: 16, height: 16 }} />
          </button>
        </div>

        <h3 style={{ margin: '0 0 6px', fontSize: 16, fontWeight: 800 }}>{s.title}</h3>
        <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.5, color: 'var(--text-muted, #475569)' }}>{s.body}</p>
        {s.tip && (
          <div style={{ marginTop: 9, display: 'flex', gap: 7, alignItems: 'flex-start', background: 'rgba(56,189,248,0.1)', border: '1px solid rgba(56,189,248,0.3)', borderRadius: 9, padding: '8px 10px' }}>
            <ArrowRight style={{ width: 14, height: 14, color: '#0284c7', flexShrink: 0, marginTop: 1 }} />
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text, #0f172a)', lineHeight: 1.45 }}>{s.tip}</span>
          </div>
        )}

        {/* progress dots */}
        <div style={{ display: 'flex', gap: 4, margin: '12px 0' }}>
          {STEPS.map((_, i) => (
            <div key={i} style={{ flex: 1, height: 4, borderRadius: 4, background: i <= step ? '#006fbf' : 'var(--border, #e2e8f0)', transition: 'background .2s' }} />
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button onClick={finish} style={{ fontSize: 12, fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted, #64748b)' }}>
            Skip tour
          </button>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            {step > 0 && (
              <button onClick={back} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12.5, fontWeight: 700, cursor: 'pointer', padding: '8px 14px', borderRadius: 9, border: '1px solid var(--border, #e2e8f0)', background: 'transparent', color: 'var(--text, #0f172a)' }}>
                <ArrowLeft style={{ width: 14, height: 14 }} /> Back
              </button>
            )}
            <button onClick={next} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12.5, fontWeight: 800, cursor: 'pointer', padding: '8px 16px', borderRadius: 9, border: 'none', background: '#006fbf', color: '#fff' }}>
              {isLast ? <>Finish <Check style={{ width: 14, height: 14 }} /></> : <>Next <ArrowRight style={{ width: 14, height: 14 }} /></>}
            </button>
          </div>
        </div>
      </div>
    </div>
  )

  return createPortal(<>{launcher}{overlay}</>, document.body)
}
