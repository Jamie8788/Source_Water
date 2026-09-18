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
  { route: '/dashboard', target: 'dash-activity', title: 'Dashboard — your activity',
    body: 'Everything here is real, not decoration. This card is your own month: points earned, your rank, your streak, and where the points came from — games, quizzes, resources and community. Points come from the leaderboard table, so they update as you use the platform.',
    tip: 'Click “Profile ›” any time to see your full history.' },
  { route: '/dashboard', target: 'dash-sites', interactive: true, manualNext: true, title: 'Dashboard — what’s happening now',
    body: 'The five monitoring sites with the most recent readings across the whole Water Rangers network, newest first. It’s the fastest way to see where people are actively sampling today.',
    tip: 'Hover the list — click a site to jump to it on the map, or press Next to stay here.' },
  { route: '/dashboard', target: 'dash-livesite', interactive: true,
    waitFor: '[data-tour="dash-picker"]', waitPause: 400,
    title: 'Dashboard — your live site',
    body: 'Pin one site as your “live site” and its latest pH, dissolved oxygen, temperature and conductivity stay here, with a coloured bar showing where each sits against guideline ranges.',
    tip: 'Click “Change site” to open the picker — I’ll wait.' },
  { route: '/dashboard', target: 'dash-picker', interactive: true, title: 'Dashboard — pick your site',
    body: 'Search any site and choose it. Your dashboard immediately switches to that site and remembers it on this device.',
    tip: 'Type a name, click a result, then press Next.' },
  { route: '/dashboard', target: 'dash-livecard', title: 'Dashboard — it’s live',
    body: 'These four readings — pH, dissolved oxygen, temperature and conductivity — now belong to the site you just picked, with the green/amber bar showing how each sits against its guideline range and the exact time of the latest reading underneath.',
    tip: 'That’s your live site set. On to the map.' },
  { route: '/monitoring', target: 'map-filters', interactive: true,
    waitFor: '[data-tour="map-search"]', waitPause: 500,
    title: 'Site Map — filters and search',
    body: 'The live map of every Water Rangers monitoring site. Dots are coloured by water-body type — river, lake, pond, wetland — and cluster into numbered circles as you zoom out. The search and all the filters live behind this button.',
    tip: 'Click “Filters” to open the search and filter panel — I’ll wait.' },
  { route: '/monitoring', target: 'map-search', interactive: true,
    waitFor: '[data-tour="map-result"]', waitPause: 1200,
    title: 'Site Map — search & filter',
    body: 'Beside this search you can narrow the map by country, water-body type, parameter measured, and active vs dormant sites. The map tools also let you switch base maps, measure distances, drop private field waypoints and turn on the community Stories layer.',
    tip: 'Type a place (try “creek” or a country) — the map narrows as you type. I’ll wait.' },
  { route: '/monitoring', target: 'map-result', title: 'Site Map — your matches',
    body: 'There’s your filter result — how many sites match, with a chip for each active filter. The map now shows only those dots, coloured by water-body type and grouped into numbered circles until you zoom in.',
    tip: 'Read the count, then press Next — I’ll show you how to zoom in.' },
  { route: '/monitoring', target: '.leaflet-control-zoom', interactive: true, manualNext: true,
    title: 'Site Map — zoom in to your dots',
    body: 'Here are the zoom controls. Numbered circles are clusters — zoom in and they break apart into individual sites. You can also scroll on the map or double-click an area.',
    tip: 'Press “+” a few times (or click a numbered circle) until single dots appear, then click one to open its record. Press Next when done.' },
  { route: '/ask-water', target: 'ask-input', interactive: true,
    waitFor: '[data-tour="ask-answer"]', waitPause: 1600,
    title: 'Ask Water (AI)',
    body: 'A friendly AI you can type or speak to about the data or water in general. It has a daily free limit, and the Charts, Trends and Anomaly tools stay unlimited.',
    tip: 'Ask “What causes algae blooms?” and press send — I’ll wait here while Water answers.' },
  { route: '/ask-water', target: 'ask-chat', title: 'Ask Water — your answer',
    body: 'That’s Water’s reply. Answers can cite our own monitoring data, and if Voice is on it reads them aloud. Keep asking follow-ups — the conversation has memory, so “what about in winter?” still makes sense.',
    tip: 'Read the answer, then carry on when you’re ready.' },
  { route: '/ask-water', target: 'ask-voice', title: 'Ask Water — talk to it',
    body: 'Tap the microphone to speak your question instead of typing (Chrome or Edge). “Voice On” makes Water read answers back and tell fun facts — switch it off for silent reading. “Clear” starts a fresh conversation.',
    tip: 'Toggle Voice On/Off to set how chatty Water is.' },
  { route: '/ai-lab', target: 'ailab-search', interactive: true,
    waitFor: '[data-tour="ailab-tabs"]', waitPause: 900,
    title: 'Wet Lab — the smart part',
    body: 'This is the analysis Water Rangers and DataStream don’t give you. First, pick a site to analyse.',
    tip: 'Type a site name (try “creek”), then click one from the list — I’ll wait for it to load.' },
  { route: '/ai-lab', target: 'ailab-tab-anomalies', interactive: true, manualNext: true,
    title: 'Wet Lab · Anomaly Detection',
    body: 'It scans every reading and flags the ones that stand out from this site’s own normal range — the spikes and dips worth a second look. The number in the tab is how many it found.',
    tip: 'Click “Anomaly Detection” now — look at the flagged readings, then press Next.' },
  { route: '/ai-lab', target: 'ailab-tab-insights', interactive: true, manualNext: true,
    title: 'Wet Lab · Insights (the big one)',
    body: 'The plain-English Site Story: a trust score out of 100, what changed since the last visit, whether the water is getting better or worse, the strongest links between measurements, and a “what to investigate” list — all computed from the real readings, no AI guessing.',
    tip: 'Click “Insights” and read the Site Story, then press Next.' },
  { route: '/ai-lab', target: 'ailab-tab-trends', interactive: true, manualNext: true,
    title: 'Wet Lab · Trends',
    body: 'Every parameter plotted over time so you can see direction at a glance — rising, falling or steady. The count is how many parameters have enough data to trend.',
    tip: 'Click “Trends” and scroll the parameters, then press Next.' },
  { route: '/ai-lab', target: 'ailab-tab-charts', interactive: true, manualNext: true,
    title: 'Wet Lab · Charts',
    body: 'Full interactive charts for each measurement, with guideline bands drawn on so you can see exactly when a reading crossed a line. Hover any point for its exact value and date.',
    tip: 'Click “Charts” and hover a line to read a value, then press Next.' },
  { route: '/ai-lab', target: 'ailab-tab-ai', interactive: true, manualNext: true,
    title: 'Wet Lab · Research AI',
    body: 'Ask questions in plain language about THIS site specifically — “has phosphate risen since 2022?” — and it answers from that site’s own record, not the internet.',
    tip: 'Click “Research AI” and try a question, then press Next.' },
  { route: '/explorer', target: 'explorer-search', interactive: true, title: 'Dive into Data',
    body: 'The raw record behind every chart. Pick a site and you get its observations one by one — who sampled, when, and every parameter they recorded — plus sub-views for Parameters, a Map, a Timeline and an AI you can ask about that dataset. This is where you go to check a number for yourself.',
    tip: 'Search a site here to open its full observation history.' },
  { route: '/quiz', target: 'quiz-search', interactive: true, title: 'Quiz Yourself',
    body: 'Short quizzes that teach water science and earn points toward your rank. Your progress panel at the top tracks attempts, best scores and passes.',
    tip: 'Search for a quiz, or just scroll the list below.' },
  { route: '/quiz', target: 'quiz-filters', interactive: true, manualNext: true,
    title: 'Quiz — narrowing it down',
    body: 'Filter by category to focus a topic, and by difficulty — Beginner, Intermediate, Advanced — to match your level.',
    tip: 'Click a category and a difficulty — watch the list below change. Then press Next.' },
  { route: '/quiz', target: 'quiz-list', interactive: true, manualNext: true,
    title: 'Quiz — take one for real',
    body: 'Each card shows its category, difficulty and length. Opening one starts it: questions appear one at a time, some quizzes are timed, some shuffle the questions, and your score is saved to your profile — passing adds points to your rank and can earn a certificate.',
    tip: 'Click a quiz and actually answer a question or two, then come back and press Next.' },
  { route: '/resources', target: 'learning-paths', interactive: true, manualNext: true,
    title: 'Guided Learning Paths',
    body: 'Four journeys — Beginner, Intermediate, Community action and Educators. Each mixes a curated guide (READ) with a real action inside the platform (DO IT), tracks your progress, and remembers it on this device.',
    tip: 'Click a path to expand its steps, then tick them off as you go.' },
  { route: '/resources', target: 'res-search', interactive: true, title: 'Finding a resource',
    body: 'The library itself — every entry is a real, verified source. Cards show a badge for where it came from: our partners (Water Rangers, DataStream) or a purple “Verified source” for government, academic and international bodies.',
    tip: 'Type a keyword here — the grid filters instantly.' },
  { route: '/resources', target: 'res-filters', interactive: true, manualNext: true, title: 'Filter by topic and format',
    body: 'This row filters by CATEGORY — Datasets, Community Science, Water Quality, Data Literacy, Field Work, Safety, Indigenous Water Rights, Ecology. The row underneath filters by TYPE — Guide, Dataset, Document, Link, Video, Report. They combine, so you can ask for “Datasets that are Reports”, and the count tells you how many matched.',
    tip: 'Click a category, then a type — watch the result count change. Then press Next.' },
  { route: '/alerts', target: 'alerts-add', interactive: true,
    waitFor: '[data-tour="alerts-form"]', waitPause: 500,
    title: 'Alerts — create a watch',
    body: 'A watch is your own rule on a real site. When the latest reading breaks it, an alert fires.',
    tip: 'Click “Add watch” to open the form — I’ll wait.' },
  { route: '/alerts', target: 'alerts-form', interactive: true, manualNext: true,
    title: 'Alerts — fill the rule',
    body: 'Four choices make a rule: the SITE (search the all the Water Rangers sites, or switch to your own adopted list), the PARAMETER to watch, the COMPARATOR (above / below) and your LIMIT — e.g. “pH below 6.5”. Severity sets how loudly it shouts.',
    tip: 'Fill it in and save a real watch, then press Next.' },
  { route: '/alerts', target: 'alerts-watches', interactive: true, manualNext: true, title: 'Alerts — your watches',
    body: 'Every watch you own lives here with its severity, when it was last checked and its current value. You can pause one, delete it, expand it to see the reading behind the alert, or hit “Check now” to re-run them all immediately instead of waiting for the automatic check.',
    tip: 'Click “Check now” to re-run your watches against the latest readings, then press Next.' },
  { route: '/social', target: 'social-composer', interactive: true, title: 'Community — share something',
    body: 'Post an observation, a photo, a question or a poll to the community. Posts can carry hashtags and a location tag so people can find what’s happening on their water.',
    tip: 'Click into the box and write something to try it.' },
  { route: '/social', target: 'social-tabs', interactive: true, manualNext: true, title: 'Community — feed, DMs and leaderboard',
    body: 'These tabs filter the feed by post type. Elsewhere on this page you’ll find direct messages (the envelope in the top bar), reactions and comments on every post, and the Top Contributors leaderboard — the same points that show on your dashboard.',
    tip: 'Click through the tabs and watch the feed filter, then press Next.' },
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

  // FOLLOW THE USER. If they navigate away mid-step — which is exactly what a
  // tip like "click any site to jump to it on the map" asks them to do — don't
  // sit there showing the old page's card, and don't drag them back. Jump to
  // the first step that belongs to the page they actually landed on.
  // (Our own navigate() above lands on s.route, so it never triggers this.)
  useEffect(() => {
    if (!active || !s || !s.route) return
    if (location.pathname === s.route) return
    const idx = STEPS.findIndex(st => st.route === location.pathname)
    if (idx >= 0 && idx !== step) setStep(idx)
  }, [location.pathname]) // eslint-disable-line react-hooks/exhaustive-deps

  // Find the target, then KEEP the rect synced to it every frame while the step
  // is active — so smooth-scroll, lazy content and layout shifts can't leave the
  // ring/card stranded at a stale position (the earlier bug).
  useEffect(() => {
    if (!active || !s) return
    // Clear any previous highlight IMMEDIATELY. Without this the last step's
    // ring lingered over blank space while the new target was being looked for
    // (or forever, if it was never found) — the "empty box in the middle of
    // nowhere" and the card anchoring itself to it.
    setRect(null)
    if (s.route && location.pathname !== s.route) return
    if (!s.target) return

    // A target that exists but is collapsed/hidden (e.g. inside a closed panel)
    // must NOT be highlighted — we'd ring an invisible box.
    const isUsable = (el) => {
      if (!el || !el.isConnected) return false
      const r = el.getBoundingClientRect()
      if (r.width < 4 || r.height < 4) return false
      const cs = getComputedStyle(el)
      if (cs.visibility === 'hidden' || cs.display === 'none') return false
      if (el.offsetParent === null && cs.position !== 'fixed') return false
      return true
    }

    let el = null, tries = 0, raf = 0, cleanupAction = null, cancelled = false

    // waitFor: don't advance on a timer — wait for the REAL result to show up
    // (the AI's answer, the site detail that opens). We note how many matches
    // exist when the step starts and advance once a new one appears, so the
    // user sees what they just produced instead of being yanked onward.
    let waitTimer = null
    if (s.waitFor) {
      const baseline = document.querySelectorAll(s.waitFor).length
      waitTimer = setInterval(() => {
        if (cancelled) return
        if (document.querySelectorAll(s.waitFor).length > baseline) {
          clearInterval(waitTimer)
          setTimeout(() => { if (!cancelled) next() }, s.waitPause ?? 1200)
        }
      }, 400)
    }

    const attach = (node) => {
      if (!s.interactive || !node) return
      if (s.waitFor) return // the result watcher drives this step
      const tag = node.tagName
      const isField = tag === 'INPUT' || tag === 'TEXTAREA' || node.getAttribute?.('contenteditable') === 'true' || tag?.includes('-')
      if (isField) {
        // Wait for the user to ACTUALLY search: they type, we let them see the
        // results, then the tour moves on. Enter jumps ahead immediately.
        let t
        const onInput = () => {
          const v = (node.value ?? node.textContent ?? '').toString()
          clearTimeout(t)
          if (v.trim().length >= 2) t = setTimeout(() => { if (!cancelled) next() }, 1500)
        }
        const onKey = (e) => {
          if (e.key === 'Enter') { clearTimeout(t); setTimeout(() => { if (!cancelled) next() }, 400) }
        }
        node.addEventListener('input', onInput)
        node.addEventListener('keydown', onKey)
        cleanupAction = () => { clearTimeout(t); node.removeEventListener('input', onInput); node.removeEventListener('keydown', onKey) }
        return
      }
      // manualNext: the click OPENS something you're meant to look at (a tab,
      // a quiz), so don't yank the user onward — let them read, then press Next.
      if (s.manualNext) return
      // Buttons/panels: doing the real click advances the tour.
      const handler = () => setTimeout(() => { if (!cancelled) next() }, 260)
      node.addEventListener('click', handler, { once: true })
      cleanupAction = () => node.removeEventListener('click', handler)
    }

    // continuous sync loop
    const loop = () => {
      if (cancelled) return
      if (el) {
        if (!isUsable(el)) { setRect(null) }          // it got hidden/removed
        else {
          const r = el.getBoundingClientRect()
          setRect(prev => (prev && prev.top === r.top && prev.left === r.left && prev.width === r.width && prev.height === r.height) ? prev : r)
        }
      }
      raf = requestAnimationFrame(loop)
    }

    const find = () => {
      if (cancelled) return
      const found = document.querySelector(selectorFor(s.target))
      if (found && isUsable(found)) {
        el = found
        try { el.scrollIntoView({ block: 'center', inline: 'nearest' }) } catch {}
        attach(el)
        raf = requestAnimationFrame(loop)
      } else if (tries++ < 150) {
        // keep looking — the user may still be opening the panel it lives in
        raf = requestAnimationFrame(find)
      } else {
        setRect(null) // graceful centred card, text still shown
      }
    }
    find()

    return () => { cancelled = true; cancelAnimationFrame(raf); clearInterval(waitTimer); cleanupAction?.() }
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

  // ── Zoom compensation ──────────────────────────────────────────────────
  // Accessibility settings put CSS `zoom` on <html>. getBoundingClientRect()
  // returns SCREEN coordinates, but this overlay lives inside that zoomed root,
  // so any px we set gets multiplied by the zoom — which is what pushed the
  // spotlight off its element (the further down/right, the bigger the drift).
  // We do all the maths in screen space, then divide by z when rendering.
  const z = (() => {
    const v = parseFloat(getComputedStyle(document.documentElement).zoom)
    return (v && isFinite(v) && v > 0) ? v : 1
  })()
  const u = (n) => n / z                       // screen px → our (zoomed) px

  const cardW = Math.min(CARD_W, vw / z - 24)  // card width in zoomed units
  const scW = cardW * z, scH = CARD_H * z      // its size on screen
  const clampX = (x) => Math.max(12, Math.min(x, vw - scW - 12))
  const clampY = (y) => Math.max(12, Math.min(y, vh - scH - 12))

  // 4-way placement: pick the side of the target with the most room, then align
  // the card to the target's centre and clamp to the viewport. `arrow` points
  // the caret back at the target.
  // All placement maths below is in SCREEN space (same space as `rect`), then
  // converted with u() at render time.
  const cx = hasRect ? rect.left + rect.width / 2 : 0
  const cy = hasRect ? rect.top + rect.height / 2 : 0
  const gap = GAP * z
  const place = {
    right:  () => { const lx = rect.right + gap;        if (lx + scW + 12 > vw) return null; return { style: { top: u(clampY(cy - scH / 2)), left: u(lx), width: cardW }, arrow: { side: 'left',   offset: u(Math.max(16, Math.min(cy - clampY(cy - scH / 2), scH - 16))) } } },
    left:   () => { const lx = rect.left - gap - scW;   if (lx < 12) return null;              return { style: { top: u(clampY(cy - scH / 2)), left: u(lx), width: cardW }, arrow: { side: 'right',  offset: u(Math.max(16, Math.min(cy - clampY(cy - scH / 2), scH - 16))) } } },
    below:  () => { const top = rect.bottom + gap;      if (top + scH + 12 > vh) return null;  return { style: { top: u(top), left: u(clampX(cx - scW / 2)), width: cardW }, arrow: { side: 'top',    offset: u(Math.max(16, Math.min(cx - clampX(cx - scW / 2), scW - 16))) } } },
    above:  () => { const top = rect.top - gap - scH;    if (top < 12) return null;             return { style: { top: u(top), left: u(clampX(cx - scW / 2)), width: cardW }, arrow: { side: 'bottom', offset: u(Math.max(16, Math.min(cx - clampX(cx - scW / 2), scW - 16))) } } },
  }
  // On interactive steps the space right below an input is where the typed
  // results appear — so put the card to the SIDE first and never bury them.
  // Info steps read best directly below/above the thing they describe.
  const order = s?.interactive ? ['right', 'left', 'above', 'below'] : ['below', 'above', 'right', 'left']
  let cardStyle, arrow = null
  if (hasRect) {
    for (const k of order) { const r = place[k](); if (r) { cardStyle = r.style; arrow = r.arrow; break } }
  }
  if (!cardStyle) cardStyle = { top: u((vh - scH) / 2), left: u((vw - scW) / 2), width: cardW }

  const arrowStyle = arrow && (() => {
    const base = { position: 'absolute', width: 12, height: 12, background: 'var(--card-bg,#fff)', transform: 'rotate(45deg)' }
    if (arrow.side === 'top') return { ...base, top: -6, left: arrow.offset - 6, borderLeft: '1px solid var(--border,#e2e8f0)', borderTop: '1px solid var(--border,#e2e8f0)' }
    if (arrow.side === 'bottom') return { ...base, bottom: -6, left: arrow.offset - 6, borderRight: '1px solid var(--border,#e2e8f0)', borderBottom: '1px solid var(--border,#e2e8f0)' }
    if (arrow.side === 'left') return { ...base, left: -6, top: arrow.offset - 6, borderLeft: '1px solid var(--border,#e2e8f0)', borderBottom: '1px solid var(--border,#e2e8f0)' }
    return { ...base, right: -6, top: arrow.offset - 6, borderRight: '1px solid var(--border,#e2e8f0)', borderTop: '1px solid var(--border,#e2e8f0)' }
  })()

  const overlay = (
    // pointerEvents:'none' is essential — this container spans the whole
    // viewport, so with the default 'auto' it swallowed every click and you
    // couldn't type in the very field the tour was pointing at. Only the card
    // (and the dimmer on non-interactive steps) opts back in.
    <div style={{ position: 'fixed', top: 0, left: 0, width: u(vw), height: u(vh), zIndex: 2147483000, pointerEvents: 'none' }}>
      {/* Dimmer. NEVER captures clicks — a tour that traps you is worse than no
          tour. Every step leaves the whole page usable; only the card is
          clickable on top of it. */}
      <div style={{ position: 'absolute', inset: 0, background: hasRect ? 'transparent' : 'rgba(15,23,42,0.45)', pointerEvents: 'none' }} />

      {hasRect && (
        <div style={{
          position: 'absolute', top: u(rect.top - PAD * z), left: u(rect.left - PAD * z),
          width: u(rect.width + PAD * 2 * z), height: u(rect.height + PAD * 2 * z),
          borderRadius: 12, pointerEvents: 'none',
          // Light dim throughout: you need to READ what you just did (the AI's
          // answer, the filtered list) while the step is still open.
          boxShadow: `0 0 0 9999px rgba(15,23,42,${s?.interactive ? 0.28 : 0.45}), 0 0 0 3px #38bdf8, 0 0 22px 4px rgba(56,189,248,0.7)`,
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
              {/* Always "Next". It used to read "Skip step" on interactive
                  steps, which contradicted every tip (they all say "press
                  Next") and made users think they were skipping content. */}
              {isLast ? <>Finish <Check style={{ width: 14, height: 14 }} /></> : <>Next <ArrowRight style={{ width: 14, height: 14 }} /></>}
            </button>
          </div>
        </div>
      </div>
    </div>
  )

  return createPortal(<>{launcher}{overlay}</>, document.body)
}
