import PageAmbience from '../components/layout/PageAmbience'
import { useState, useRef, useEffect } from 'react'
import { useSound } from '../context/SoundContext'
import api from '../utils/api'
import { ArrowLeft, Trophy } from 'lucide-react'

/* ─── GAME 1: Boat Cleanup (Canvas game) ─── */
const FACTS = [
  'Lake Superior is the largest freshwater lake by surface area in the world!',
  'pH 7 is neutral — most aquatic life thrives between pH 6.5 and 8.5.',
  'Dissolved oxygen below 3 mg/L is deadly for most fish species.',
  'Phosphorus runoff from farms causes algae blooms that suffocate lakes.',
  'Northern Ontario has over 250,000 lakes — the most of any region on Earth!',
  'Turbidity above 5 NTU makes drinking water treatment more difficult.',
  'The Water Rangers program has logged over 30,000 water quality tests across Canada.',
  'Batchawana Bay near Sault Ste. Marie is a critical Great Lakes spawning ground.',
  'Road salt runoff is a growing water quality threat in Northern Ontario winters.',
  'Indigenous communities have monitored water quality for thousands of years.',
]

function BoatGame({ onComplete }) {
  const canvasRef = useRef(null)
  const stateRef = useRef({
    boat: { x: 400, y: 400, angle: 0, speed: 0, trail: [] },
    pollution: [],
    score: 0,
    lives: 3,
    factIdx: 0,
    keys: {},
    t: 0,
    done: false,
    factTimer: 0,
    particles: [],
  })
  const [score, setScore] = useState(0)
  const [lives] = useState(3)
  const [currentFact, setCurrentFact] = useState(FACTS[0])
  const [done] = useState(false)
  const { play } = useSound()

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    canvas.width = canvas.offsetWidth
    canvas.height = canvas.offsetHeight
    const W = canvas.width, H = canvas.height
    const s = stateRef.current
    s.boat.x = W / 2; s.boat.y = H / 2

    // Spawn pollution
    const spawnPollution = () => {
      const types = [
        { emoji: '🛢️', label: 'Oil barrel', points: 20, r: 18 },
        { emoji: '🥤', label: 'Plastic bottle', points: 10, r: 12 },
        { emoji: '⚗️', label: 'Chemical waste', points: 30, r: 20 },
        { emoji: '🧴', label: 'Detergent', points: 15, r: 14 },
        { emoji: '🚮', label: 'Garbage bag', points: 10, r: 16 },
      ]
      const t = types[Math.floor(Math.random() * types.length)]
      s.pollution.push({
        x: Math.random() * (W - 80) + 40,
        y: Math.random() * (H - 80) + 40,
        vx: (Math.random() - 0.5) * 0.5,
        vy: (Math.random() - 0.5) * 0.5,
        ...t,
        collected: false,
        pulse: Math.random() * Math.PI * 2,
      })
    }
    for (let i = 0; i < 8; i++) spawnPollution()

    const onKey = (e, down) => { s.keys[e.key] = down; e.preventDefault() }
    window.addEventListener('keydown', e => onKey(e, true))
    window.addEventListener('keyup', e => onKey(e, false))

    let raf
    const loop = () => {
      if (s.done) { cancelAnimationFrame(raf); return }
      s.t++
      s.factTimer++

      // Show new fact every 10 seconds
      if (s.factTimer % 300 === 0) {
        s.factIdx = (s.factIdx + 1) % FACTS.length
        setCurrentFact(FACTS[s.factIdx])
      }

      // Boat controls
      if (s.keys['ArrowLeft'] || s.keys['a']) s.boat.angle -= 0.055
      if (s.keys['ArrowRight'] || s.keys['d']) s.boat.angle += 0.055
      if (s.keys['ArrowUp'] || s.keys['w']) s.boat.speed = Math.min(s.boat.speed + 0.18, 4.5)
      else s.boat.speed = Math.max(0, s.boat.speed - 0.06)
      s.boat.x += Math.sin(s.boat.angle) * s.boat.speed
      s.boat.y -= Math.cos(s.boat.angle) * s.boat.speed
      s.boat.x = Math.max(20, Math.min(W - 20, s.boat.x))
      s.boat.y = Math.max(20, Math.min(H - 20, s.boat.y))

      // Trail
      s.boat.trail.push({ x: s.boat.x, y: s.boat.y, t: s.t })
      if (s.boat.trail.length > 30) s.boat.trail.shift()

      // Pollution drift
      s.pollution.forEach(p => {
        if (p.collected) return
        p.pulse += 0.05
        p.x += p.vx; p.y += p.vy
        if (p.x < p.r || p.x > W - p.r) p.vx *= -1
        if (p.y < p.r || p.y > H - p.r) p.vy *= -1

        // Collision
        const dx = s.boat.x - p.x, dy = s.boat.y - p.y
        if (Math.sqrt(dx * dx + dy * dy) < p.r + 18 && !p.collected) {
          p.collected = true
          s.score += p.points
          setScore(s.score)
          // Particles
          for (let i = 0; i < 8; i++) {
            s.particles.push({ x: p.x, y: p.y, vx: (Math.random()-0.5)*4, vy: (Math.random()-0.5)*4, life: 30, color: `hsl(${Math.random()*60+160},70%,60%)` })
          }
          spawnPollution()
        }
      })

      // Particles
      s.particles = s.particles.filter(p => p.life-- > 0)
      s.particles.forEach(p => { p.x += p.vx; p.y += p.vy; p.vx *= 0.95; p.vy *= 0.95 })

      // Draw
      ctx.clearRect(0, 0, W, H)

      // Water background
      const grad = ctx.createLinearGradient(0, 0, 0, H)
      grad.addColorStop(0, '#e0f2fe')
      grad.addColorStop(1, '#bae6fd')
      ctx.fillStyle = grad
      ctx.fillRect(0, 0, W, H)

      // Water ripples
      for (let i = 0; i < 6; i++) {
        ctx.beginPath()
        ctx.ellipse(W * 0.2 + i * W * 0.13, H * 0.3 + i * H * 0.1 + Math.sin(s.t * 0.02 + i) * 15, 40 + i * 20, 8, 0, 0, Math.PI * 2)
        ctx.strokeStyle = 'rgba(56,189,248,0.2)'
        ctx.lineWidth = 1.5
        ctx.stroke()
      }

      // Boat trail
      ctx.save()
      s.boat.trail.forEach((pt, i) => {
        const age = (i / s.boat.trail.length)
        ctx.beginPath()
        ctx.arc(pt.x, pt.y, 3 * age, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(56,189,248,${age * 0.4})`
        ctx.fill()
      })
      ctx.restore()

      // Pollution items
      s.pollution.filter(p => !p.collected).forEach(p => {
        const pulse = 1 + Math.sin(p.pulse) * 0.1
        ctx.save()
        ctx.translate(p.x, p.y)
        ctx.scale(pulse, pulse)
        // Glow
        ctx.shadowColor = 'rgba(239,68,68,0.4)'
        ctx.shadowBlur = 15
        ctx.font = `${p.r * 1.5}px serif`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(p.emoji, 0, 0)
        ctx.shadowBlur = 0
        // Label
        ctx.fillStyle = 'rgba(0,0,0,0.5)'
        ctx.font = '9px sans-serif'
        ctx.fillText(p.label, 0, p.r + 10)
        ctx.restore()
      })

      // Particles
      s.particles.forEach(p => {
        ctx.beginPath()
        ctx.arc(p.x, p.y, 4 * (p.life / 30), 0, Math.PI * 2)
        ctx.fillStyle = p.color
        ctx.globalAlpha = p.life / 30
        ctx.fill()
        ctx.globalAlpha = 1
      })

      // Draw boat
      ctx.save()
      ctx.translate(s.boat.x, s.boat.y)
      ctx.rotate(s.boat.angle)
      ctx.shadowColor = 'rgba(14,165,233,0.5)'
      ctx.shadowBlur = 15

      // Hull
      ctx.beginPath()
      ctx.moveTo(0, -22)
      ctx.bezierCurveTo(12, -10, 14, 8, 10, 14)
      ctx.lineTo(-10, 14)
      ctx.bezierCurveTo(-14, 8, -12, -10, 0, -22)
      ctx.fillStyle = '#1e40af'
      ctx.fill()
      ctx.strokeStyle = '#3b82f6'
      ctx.lineWidth = 1.5
      ctx.stroke()

      // Cabin
      ctx.fillStyle = '#60a5fa'
      ctx.fillRect(-7, -12, 14, 12)

      // Mast & flag
      ctx.strokeStyle = '#93c5fd'
      ctx.lineWidth = 1.5
      ctx.beginPath(); ctx.moveTo(0, -22); ctx.lineTo(0, -38); ctx.stroke()
      ctx.fillStyle = '#22c55e'
      ctx.beginPath(); ctx.moveTo(0, -38); ctx.lineTo(10, -33); ctx.lineTo(0, -28); ctx.fill()

      // Wake
      if (s.boat.speed > 0.5) {
        ctx.strokeStyle = 'rgba(255,255,255,0.6)'
        ctx.lineWidth = 2
        ctx.beginPath(); ctx.moveTo(-8, 14); ctx.lineTo(-14, 22 + s.boat.speed * 3); ctx.stroke()
        ctx.beginPath(); ctx.moveTo(8, 14); ctx.lineTo(14, 22 + s.boat.speed * 3); ctx.stroke()
      }
      ctx.restore()

      // Speedometer
      ctx.fillStyle = 'rgba(0,0,0,0.3)'
      ctx.fillRect(10, H - 30, 120, 20)
      ctx.fillStyle = `hsl(${120 - s.boat.speed * 25},80%,55%)`
      ctx.fillRect(10, H - 30, s.boat.speed / 4.5 * 120, 20)
      ctx.fillStyle = 'white'
      ctx.font = '11px sans-serif'
      ctx.fillText(`Speed: ${s.boat.speed.toFixed(1)}`, 15, H - 15)

      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('keydown', e => onKey(e, true))
      window.removeEventListener('keyup', e => onKey(e, false))
    }
  }, [])

  if (done) return (
    <div className="text-center py-12">
      <div className="text-6xl mb-4">🚢</div>
      <h3 className="text-2xl font-bold text-gray-800">Great Cleanup!</h3>
      <p className="text-3xl font-bold text-ocean-500 mt-2">{score} points</p>
      <button onClick={() => onComplete(score)} className="btn-primary mx-auto mt-6">Collect Reward</button>
    </div>
  )

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <div className="flex gap-4 text-sm font-semibold">
          <span className="text-ocean-600">Score: <strong className="text-xl">{score}</strong></span>
          <span>Lives: {'❤️'.repeat(lives)}</span>
        </div>
        <button onClick={() => { stateRef.current.done = true; onComplete(score) }} className="btn-danger text-sm py-1 px-3">End Game</button>
      </div>

      {/* Fact ticker */}
      <div className="bg-gradient-to-r from-ocean-500 to-teal-500 rounded-xl px-4 py-2 flex items-center gap-2">
        <span className="text-white text-xl flex-shrink-0">💡</span>
        <p className="text-white text-sm font-medium">{currentFact}</p>
      </div>

      <canvas ref={canvasRef} className="rounded-2xl border-2 border-ocean-200 shadow-xl w-full cursor-crosshair bg-blue-50"
        style={{ height: 420 }} />
      <p className="text-center text-sm text-gray-500">🕹️ Arrow keys or WASD to steer · Drive into pollution to collect it!</p>
    </div>
  )
}

/* ─── GAME 2: pH Balance ─── */
function PHGame({ onComplete }) {
  const { play } = useSound()
  const QUESTIONS = [
    { ph: 7.5, safe: true, label: 'Drinking water tap', info: 'Ideal drinking water is pH 6.5–8.5' },
    { ph: 2.1, safe: false, label: 'Acid rain water', info: 'Acid rain (pH < 5) damages aquatic ecosystems' },
    { ph: 8.3, safe: true, label: 'Lake Superior surface', info: 'Great Lakes average pH is around 8.0–8.3' },
    { ph: 11.2, safe: false, label: 'Industrial discharge', info: 'High pH (>9) is toxic to most fish species' },
    { ph: 6.8, safe: true, label: 'Ontario stream water', info: 'Natural streams are slightly acidic to neutral' },
    { ph: 3.7, safe: false, label: 'Mine drainage', info: 'Acid mine drainage is a major issue in Northern Ontario' },
    { ph: 7.1, safe: true, label: 'Pristine well water', info: 'Well water near pH 7 is excellent for drinking' },
    { ph: 9.8, safe: false, label: 'Algae bloom water', info: 'Algae raise pH above 9 during blooms' },
  ]
  const [idx, setIdx] = useState(0)
  const [score, setScore] = useState(0)
  const [feedback, setFeedback] = useState('')
  const [lives, setLives] = useState(3)
  const [showInfo, setShowInfo] = useState('')
  const [done, setDone] = useState(false)
  const cur = QUESTIONS[idx]

  const answer = (safe) => {
    const correct = safe === cur.safe
    setShowInfo(cur.info)
    if (correct) { play('correct'); setFeedback('✅ Correct!'); setScore(s => s + 15) }
    else { play('wrong'); setFeedback('❌ Wrong!'); setLives(l => l - 1) }
    setTimeout(() => {
      setFeedback(''); setShowInfo('')
      if (lives - (correct ? 0 : 1) <= 0 || idx + 1 >= QUESTIONS.length) { setDone(true); onComplete(score + (correct ? 15 : 0)) }
      else setIdx(i => i + 1)
    }, 1800)
  }

  if (done) return <div className="text-center py-12"><div className="text-6xl mb-4">⚗️</div><h3 className="text-2xl font-bold">Score: {score}</h3></div>

  const pct = ((cur?.ph || 7) / 14) * 100
  const hue = pct < 36 ? 0 : pct > 64 ? 240 : 120

  return (
    <div className="space-y-5 max-w-lg mx-auto">
      <div className="flex justify-between text-sm font-semibold"><span>Score: <strong className="text-ocean-500">{score}</strong></span><span>{'❤️'.repeat(lives)}</span></div>
      <div className="card p-6 text-center">
        <p className="text-gray-500 text-sm mb-2">{cur.label}</p>
        <div className="text-7xl font-black mb-3" style={{ color: `hsl(${hue},70%,45%)` }}>pH {cur.ph}</div>
        {/* pH scale */}
        <div className="relative h-6 rounded-full overflow-hidden mb-2" style={{ background: 'linear-gradient(to right, #ef4444, #f97316, #eab308, #22c55e, #22c55e, #22c55e, #3b82f6, #6366f1)' }}>
          <div className="absolute top-0 bottom-0 w-1 bg-white shadow-lg transition-all" style={{ left: `calc(${pct}% - 2px)` }} />
        </div>
        <div className="flex justify-between text-xs text-gray-400 mb-4"><span>0 Acid</span><span>7 Neutral</span><span>14 Base</span></div>
        {feedback && <div className="text-xl font-bold mb-2">{feedback}</div>}
        {showInfo && <div className="text-sm text-ocean-700 bg-ocean-50 rounded-lg p-2 mb-2">{showInfo}</div>}
      </div>
      <p className="text-center text-gray-600 font-medium">Is this water <strong>safe</strong> for aquatic life? (6.5–8.5 is safe)</p>
      <div className="flex gap-4">
        <button onClick={() => answer(true)} disabled={!!feedback} className="flex-1 py-4 rounded-2xl text-lg font-bold bg-gradient-to-r from-green-400 to-teal-400 text-white hover:scale-105 transition-all disabled:opacity-50">✅ Safe</button>
        <button onClick={() => answer(false)} disabled={!!feedback} className="flex-1 py-4 rounded-2xl text-lg font-bold bg-gradient-to-r from-red-400 to-orange-400 text-white hover:scale-105 transition-all disabled:opacity-50">⚠️ Unsafe</button>
      </div>
    </div>
  )
}

/* ─── GAME 3: Water Ranger Trivia ─── */
const TRIVIA = [
  { q: 'What does high turbidity in water indicate?', opts: ['Clear water', 'Suspended particles/sediment', 'High oxygen levels', 'Low pH'], ans: 1, fact: 'Turbidity measures how cloudy water is — higher turbidity means more suspended particles.' },
  { q: 'Which organism is a classic water quality bioindicator?', opts: ['Atlantic Salmon', 'Mayfly larvae (Ephemeroptera)', 'Largemouth Bass', 'Northern Pike'], ans: 1, fact: 'Mayfly larvae are highly sensitive to pollution — their presence signals clean water.' },
  { q: 'What causes eutrophication in lakes?', opts: ['Excess nitrates and phosphorus', 'Low water temperature', 'High dissolved oxygen', 'Clear, clean water'], ans: 0, fact: 'Eutrophication occurs when nutrients from runoff fuel massive algae growth, depleting oxygen.' },
  { q: 'NORDIK Institute is affiliated with which university?', opts: ['Laurentian University', 'Algoma University', 'University of Toronto', 'McMaster University'], ans: 1, fact: 'NORDIK Institute is the research arm of Algoma University in Sault Ste. Marie.' },
  { q: 'What is the minimum safe dissolved oxygen for most fish?', opts: ['10 mg/L', '8 mg/L', '5 mg/L', '1 mg/L'], ans: 2, fact: 'Fish struggle below 5 mg/L dissolved oxygen — 8+ mg/L is ideal for healthy aquatic life.' },
  { q: 'Which Northern Ontario lake is famous for its clean, clear water?', opts: ['Lake Nipissing', 'Lake Superior', 'Batchawana Bay', 'All of the above'], ans: 3, fact: 'Northern Ontario has some of the cleanest freshwater in the world — help us protect it!' },
]

function WaterTrivia({ onComplete }) {
  const { play } = useSound()
  const [idx, setIdx] = useState(0)
  const [selected, setSelected] = useState(null)
  const [score, setScore] = useState(0)
  const [done, setDone] = useState(false)
  const [timeLeft, setTimeLeft] = useState(20)
  const timerRef = useRef(null)

  useEffect(() => {
    setTimeLeft(20)
    clearInterval(timerRef.current)
    timerRef.current = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) { clearInterval(timerRef.current); pick(-1); return 0 }
        return t - 1
      })
    }, 1000)
    return () => clearInterval(timerRef.current)
  }, [idx])

  const q = TRIVIA[idx]

  const pick = (i) => {
    if (selected !== null) return
    clearInterval(timerRef.current)
    setSelected(i)
    const correct = i === q.ans
    if (correct) { play('correct'); setScore(s => s + 20) } else play('wrong')
    setTimeout(() => {
      setSelected(null)
      if (idx + 1 >= TRIVIA.length) { setDone(true); onComplete(score + (correct ? 20 : 0)) }
      else setIdx(i => i + 1)
    }, 1800)
  }

  if (done) return <div className="text-center py-12"><div className="text-6xl mb-4">🏅</div><h3 className="text-2xl font-bold">Score: {score}/{TRIVIA.length * 20}</h3></div>

  return (
    <div className="space-y-4 max-w-lg mx-auto">
      <div className="flex justify-between items-center">
        <span className="text-sm font-semibold text-gray-500">Q {idx + 1}/{TRIVIA.length}</span>
        <div className="flex items-center gap-2">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg ${timeLeft < 8 ? 'bg-red-100 text-red-600 animate-pulse' : 'bg-ocean-100 text-ocean-600'}`}>{timeLeft}</div>
          <span className="text-sm font-semibold text-ocean-500">Score: {score}</span>
        </div>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${timeLeft < 8 ? 'bg-red-400' : 'bg-ocean-400'}`} style={{ width: `${(timeLeft / 20) * 100}%` }} />
      </div>
      <div className="card p-5"><p className="text-lg font-semibold text-gray-800">{q.q}</p></div>
      <div className="grid grid-cols-2 gap-3">
        {q.opts.map((opt, i) => {
          let cls = 'p-4 rounded-xl text-sm font-medium transition-all border-2 text-left '
          if (selected === null) cls += 'border-gray-200 hover:border-ocean-400 hover:bg-ocean-50 cursor-pointer'
          else if (i === q.ans) cls += 'border-green-400 bg-green-50 text-green-800'
          else if (i === selected) cls += 'border-red-400 bg-red-50 text-red-800'
          else cls += 'border-gray-100 opacity-50'
          return <button key={i} onClick={() => pick(i)} disabled={selected !== null} className={cls}>{opt}</button>
        })}
      </div>
      {selected !== null && <div className="bg-ocean-50 border border-ocean-200 rounded-xl p-3 text-sm text-ocean-800">💡 {q.fact}</div>}
    </div>
  )
}

/* ─── GAME 5: Water Snake ─── */
const SNAKE_FACTS = [
  '💧 Lake Superior holds 10% of the world\'s surface freshwater!',
  '🔬 Dissolved oxygen below 3 mg/L is deadly for most fish.',
  '🌿 Phosphorus from farms fuels toxic algae blooms.',
  '💙 Northern Ontario has over 250,000 lakes — protect them!',
  '🧪 pH 6.5–8.5 is the safe zone for most aquatic life.',
  '🐟 Mayfly larvae only survive in very clean water.',
  '🌧️ Heavy rain increases turbidity — measure it!',
  '🧂 Road salt raises chloride levels, harming insects.',
  '♻️ The Water Rangers program has 30,000+ water tests.',
  '🌊 Batchawana Bay is a critical Great Lakes spawning ground.',
]

function WaterSnake({ onComplete }) {
  const canvasRef = useRef(null)
  const stateRef = useRef(null)
  const [score, setScore] = useState(0)
  const [dead, setDead] = useState(false)
  const [fact, setFact] = useState('')
  const [started, setStarted] = useState(false)
  const { play } = useSound()

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const W = canvas.width = 400, H = canvas.height = 400
    const CELL = 20, COLS = W / CELL, ROWS = H / CELL

    const rand = (max) => Math.floor(Math.random() * max)
    const spawnFood = () => ({ x: rand(COLS), y: rand(ROWS), type: 'clean' })
    const spawnPoison = () => ({ x: rand(COLS), y: rand(ROWS), type: 'poison' })

    const s = {
      snake: [{ x: 10, y: 10 }, { x: 9, y: 10 }, { x: 8, y: 10 }],
      dir: { x: 1, y: 0 },
      nextDir: { x: 1, y: 0 },
      food: [spawnFood()],
      poison: [spawnPoison(), spawnPoison()],
      score: 0,
      alive: true,
      started: false,
      frame: 0,
      tickRate: 8, // frames per move (lower = faster)
    }
    stateRef.current = s

    const onKey = (e) => {
      if (!s.started) { s.started = true; setStarted(true) }
      if (e.key === 'ArrowUp'    && s.dir.y !== 1)  s.nextDir = { x: 0, y: -1 }
      if (e.key === 'ArrowDown'  && s.dir.y !== -1) s.nextDir = { x: 0, y: 1 }
      if (e.key === 'ArrowLeft'  && s.dir.x !== 1)  s.nextDir = { x: -1, y: 0 }
      if (e.key === 'ArrowRight' && s.dir.x !== -1) s.nextDir = { x: 1, y: 0 }
      e.preventDefault()
    }
    window.addEventListener('keydown', onKey)

    // Touch swipe
    let touchStart = null
    const onTouchStart = (e) => { touchStart = { x: e.touches[0].clientX, y: e.touches[0].clientY } }
    const onTouchEnd = (e) => {
      if (!touchStart) return
      const dx = e.changedTouches[0].clientX - touchStart.x
      const dy = e.changedTouches[0].clientY - touchStart.y
      if (!s.started) { s.started = true; setStarted(true) }
      if (Math.abs(dx) > Math.abs(dy)) {
        if (dx > 20 && s.dir.x !== -1) s.nextDir = { x: 1, y: 0 }
        if (dx < -20 && s.dir.x !== 1) s.nextDir = { x: -1, y: 0 }
      } else {
        if (dy > 20 && s.dir.y !== -1) s.nextDir = { x: 0, y: 1 }
        if (dy < -20 && s.dir.y !== 1) s.nextDir = { x: 0, y: -1 }
      }
    }
    canvas.addEventListener('touchstart', onTouchStart)
    canvas.addEventListener('touchend', onTouchEnd)

    const drawCell = (x, y, color, radius = 3) => {
      const px = x * CELL + 1, py = y * CELL + 1, sz = CELL - 2
      ctx.fillStyle = color
      ctx.beginPath()
      ctx.roundRect(px, py, sz, sz, radius)
      ctx.fill()
    }

    let raf
    const loop = () => {
      if (!s.alive) return
      s.frame++

      // Draw background grid
      ctx.fillStyle = '#0f172a'
      ctx.fillRect(0, 0, W, H)
      for (let x = 0; x < COLS; x++) {
        for (let y = 0; y < ROWS; y++) {
          ctx.fillStyle = (x + y) % 2 === 0 ? 'rgba(30,58,138,0.25)' : 'rgba(23,37,84,0.25)'
          ctx.fillRect(x * CELL, y * CELL, CELL, CELL)
        }
      }

      if (!s.started) {
        // Start screen
        ctx.fillStyle = 'rgba(0,0,0,0.5)'
        ctx.fillRect(0, 0, W, H)
        ctx.fillStyle = '#38bdf8'; ctx.font = 'bold 20px system-ui'
        ctx.textAlign = 'center'
        ctx.fillText('🐍 Water Snake', W / 2, H / 2 - 30)
        ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.font = '14px system-ui'
        ctx.fillText('Arrow keys / swipe to start', W / 2, H / 2 + 10)
        ctx.fillText('Eat 💧 avoid ☠️', W / 2, H / 2 + 35)
        ctx.textAlign = 'left'
        raf = requestAnimationFrame(loop); return
      }

      // Move snake on tick
      if (s.frame % s.tickRate === 0) {
        s.dir = { ...s.nextDir }
        const head = s.snake[0]
        const next = {
          x: (head.x + s.dir.x + COLS) % COLS,
          y: (head.y + s.dir.y + ROWS) % ROWS,
        }
        // Self collision
        if (s.snake.some(seg => seg.x === next.x && seg.y === next.y)) {
          s.alive = false; setDead(true); play('wrong')
          onComplete(s.score * 10)
          return
        }
        // Poison collision
        const hitPoison = s.poison.findIndex(p => p.x === next.x && p.y === next.y)
        if (hitPoison !== -1) {
          s.alive = false; setDead(true); play('wrong')
          onComplete(s.score * 10)
          return
        }
        s.snake.unshift(next)
        // Food collision
        const hitFood = s.food.findIndex(f => f.x === next.x && f.y === next.y)
        if (hitFood !== -1) {
          s.score++
          setScore(s.score)
          play('correct')
          setFact(SNAKE_FACTS[(s.score - 1) % SNAKE_FACTS.length])
          s.food.splice(hitFood, 1)
          s.food.push(spawnFood())
          // Every 3 foods, add a poison
          if (s.score % 3 === 0) s.poison.push(spawnPoison())
          // Speed up slightly every 5 foods
          if (s.score % 5 === 0 && s.tickRate > 4) s.tickRate--
        } else {
          s.snake.pop()
        }
      }

      // Draw food (clean water drops)
      s.food.forEach(f => {
        ctx.font = `${CELL - 2}px serif`
        ctx.textAlign = 'center'
        ctx.fillText('💧', f.x * CELL + CELL / 2, f.y * CELL + CELL - 2)
      })

      // Draw poison
      s.poison.forEach(p => {
        ctx.font = `${CELL - 4}px serif`
        ctx.textAlign = 'center'
        ctx.fillText('☠️', p.x * CELL + CELL / 2, p.y * CELL + CELL - 2)
      })
      ctx.textAlign = 'left'

      // Draw snake
      s.snake.forEach((seg, i) => {
        const ratio = i / s.snake.length
        const r = Math.round(56 + (14 - 56) * ratio)
        const g = Math.round(189 + (165 - 189) * ratio)
        const b = Math.round(248 + (233 - 248) * ratio)
        drawCell(seg.x, seg.y, `rgb(${r},${g},${b})`, i === 0 ? 5 : 3)
        // Eye on head
        if (i === 0) {
          ctx.fillStyle = '#0c4a6e'
          ctx.beginPath()
          ctx.arc(seg.x * CELL + CELL * 0.65, seg.y * CELL + CELL * 0.35, 2.5, 0, Math.PI * 2)
          ctx.fill()
          ctx.fillStyle = 'white'
          ctx.beginPath()
          ctx.arc(seg.x * CELL + CELL * 0.65, seg.y * CELL + CELL * 0.35, 1, 0, Math.PI * 2)
          ctx.fill()
        }
      })

      // HUD
      ctx.fillStyle = 'rgba(0,0,0,0.5)'
      ctx.fillRect(4, 4, 100, 26)
      ctx.fillStyle = '#38bdf8'; ctx.font = 'bold 13px system-ui'
      ctx.fillText(`💧 ${s.score}`, 12, 22)

      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('keydown', onKey)
      canvas.removeEventListener('touchstart', onTouchStart)
      canvas.removeEventListener('touchend', onTouchEnd)
    }
  }, [])

  const restart = () => {
    const s = stateRef.current
    if (!s) return
    const COLS = 20, ROWS = 20
    const rand = (max) => Math.floor(Math.random() * max)
    s.snake = [{ x: 10, y: 10 }, { x: 9, y: 10 }, { x: 8, y: 10 }]
    s.dir = { x: 1, y: 0 }; s.nextDir = { x: 1, y: 0 }
    s.food = [{ x: rand(COLS), y: rand(ROWS), type: 'clean' }]
    s.poison = [{ x: rand(COLS), y: rand(ROWS) }, { x: rand(COLS), y: rand(ROWS) }]
    s.score = 0; s.alive = true; s.started = true; s.frame = 0; s.tickRate = 8
    setScore(0); setDead(false); setFact('')
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex items-center gap-4 text-sm font-bold">
        <span style={{ color: 'var(--text-muted)' }}>Score: <span style={{ color: '#38bdf8' }}>{score}</span></span>
        {started && <span style={{ color: 'var(--text-light)', fontSize: 11 }}>Arrow keys / swipe</span>}
      </div>
      <canvas ref={canvasRef} style={{ borderRadius: 12, border: '2px solid rgba(56,189,248,0.3)', touchAction: 'none' }}/>
      {fact && !dead && (
        <div className="max-w-xs text-center px-3 py-2 rounded-xl text-sm"
          style={{ background: 'rgba(56,189,248,0.1)', color: '#38bdf8', border: '1px solid rgba(56,189,248,0.2)' }}>
          {fact}
        </div>
      )}
      {dead && (
        <div className="text-center">
          <p className="font-bold mb-1" style={{ color: 'var(--text)' }}>Game Over! Score: {score}</p>
          {fact && <p className="text-sm mb-2" style={{ color: '#38bdf8' }}>{fact}</p>}
          <button onClick={restart} className="btn-primary px-6 py-2">🔄 Play Again</button>
        </div>
      )}
    </div>
  )
}

/* ─── GAME 4: Watershed Defender ─── */
function WatershedGame({ onComplete }) {
  const { play } = useSound()
  const [threats, setThreats] = useState([
    { id: 1, name: 'Agricultural Runoff', emoji: '🌾', hp: 4, maxHp: 4, info: 'Nitrates from farms cause algae blooms' },
    { id: 2, name: 'Industrial Discharge', emoji: '🏭', hp: 4, maxHp: 4, info: 'Heavy metals contaminate fish and drinking water' },
    { id: 3, name: 'Plastic Pollution', emoji: '🥤', hp: 3, maxHp: 3, info: 'Microplastics are now found in 100% of Great Lakes water samples' },
    { id: 4, name: 'Road Salt Runoff', emoji: '🧂', hp: 3, maxHp: 3, info: 'Salt raises chloride levels, harming aquatic insects' },
    { id: 5, name: 'Untreated Sewage', emoji: '🚧', hp: 5, maxHp: 5, info: 'Sewage introduces pathogens and excess nutrients' },
    { id: 6, name: 'Oil Spill', emoji: '⛽', hp: 4, maxHp: 4, info: 'Oil coats birds and fish, depleting oxygen levels' },
  ])
  const [score, setScore] = useState(0)
  const [done, setDone] = useState(false)
  const [lastInfo, setLastInfo] = useState('')

  const attack = (id) => {
    play('drop')
    setThreats(prev => {
      const updated = prev.map(t => {
        if (t.id !== id || t.hp <= 0) return t
        const newHp = t.hp - 1
        if (newHp === 0) { setScore(s => s + 20); setLastInfo(`✅ Neutralized! ${t.info}`) }
        return { ...t, hp: newHp }
      })
      if (updated.every(t => t.hp <= 0)) { setDone(true); play('levelUp'); onComplete(score + 20) }
      return updated
    })
  }

  if (done) return <div className="text-center py-12"><div className="text-6xl mb-4">🌊</div><h3 className="text-2xl font-bold">Watershed Protected!</h3><p className="text-ocean-500 font-bold text-xl mt-2">Score: {score}</p></div>

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <h3 className="font-bold text-gray-700">Defeat all threats to protect the watershed!</h3>
        <span className="font-bold text-ocean-500">Score: {score}</span>
      </div>
      {lastInfo && <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-sm text-green-800">💡 {lastInfo}</div>}
      <div className="grid gap-3">
        {threats.map(t => (
          <div key={t.id} className={`card p-4 flex items-center gap-4 transition-all ${t.hp <= 0 ? 'opacity-30' : ''}`}>
            <span className="text-3xl">{t.emoji}</span>
            <div className="flex-1">
              <div className="font-semibold text-gray-800 text-sm">{t.name}</div>
              <div className="flex gap-1 mt-1">
                {Array.from({ length: t.maxHp }).map((_, i) => (
                  <div key={i} className={`h-2.5 flex-1 rounded-full transition-all ${i < t.hp ? 'bg-gradient-to-r from-red-400 to-orange-400' : 'bg-gray-200'}`} />
                ))}
              </div>
            </div>
            <button onClick={() => attack(t.id)} disabled={t.hp <= 0}
              className={`px-4 py-2 rounded-xl font-bold text-sm transition-all ${t.hp <= 0 ? 'bg-green-100 text-green-600' : 'bg-gradient-to-r from-ocean-500 to-teal-500 text-white hover:scale-105 shadow-md'}`}>
              {t.hp <= 0 ? '✅ Clean' : `💧 Clean × ${t.hp}`}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ─── GAME 5: Flappy Fish (Flappy Bird clone) ─── */
function FlappyFish({ onComplete }) {
  const canvasRef = useRef(null)
  const stateRef = useRef(null)
  const [score, setScore] = useState(0)
  const [started, setStarted] = useState(false)
  const [dead, setDead] = useState(false)
  const { play } = useSound()

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const W = canvas.width = 400
    const H = canvas.height = 500
    const PIPE_W = 48, GAP = 240, SPEED = 1.3, GRAVITY = 0.20, JUMP = -5

    const s = {
      fish: { x: 80, y: H / 2, vy: 0, alive: true },
      pipes: [],
      score: 0,
      frame: 0,
      started: false,
      bgX: 0,
    }
    stateRef.current = s

    const spawnPipe = () => {
      const top = 80 + Math.random() * (H - GAP - 160)
      s.pipes.push({ x: W, top, scored: false })
    }

    const jump = () => {
      if (!s.fish.alive) return
      if (!s.started) { s.started = true; setStarted(true) }
      s.fish.vy = JUMP
    }

    const onKey = (e) => { if (e.code === 'Space' || e.key === ' ' || e.key === 'ArrowUp') { e.preventDefault(); jump() } }
    const onTap = () => jump()
    window.addEventListener('keydown', onKey)
    canvas.addEventListener('click', onTap)

    const drawFish = (x, y, vy) => {
      ctx.save()
      ctx.translate(x, y)
      const tilt = Math.max(-25, Math.min(35, vy * 3.5))
      ctx.rotate(tilt * Math.PI / 180)
      // Body
      ctx.fillStyle = '#38bdf8'
      ctx.beginPath()
      ctx.ellipse(0, 0, 18, 12, 0, 0, Math.PI * 2)
      ctx.fill()
      // Tail
      ctx.fillStyle = '#0ea5e9'
      ctx.beginPath(); ctx.moveTo(-14, 0); ctx.lineTo(-24, -10); ctx.lineTo(-24, 10); ctx.closePath(); ctx.fill()
      // Eye
      ctx.fillStyle = 'white'; ctx.beginPath(); ctx.arc(8, -3, 5, 0, Math.PI * 2); ctx.fill()
      ctx.fillStyle = '#0f172a'; ctx.beginPath(); ctx.arc(9, -3, 2.5, 0, Math.PI * 2); ctx.fill()
      // Shine
      ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.beginPath(); ctx.arc(10, -4, 1, 0, Math.PI * 2); ctx.fill()
      // Fin
      ctx.fillStyle = '#7dd3fc'
      ctx.beginPath(); ctx.moveTo(2, -12); ctx.lineTo(10, -18); ctx.lineTo(14, -8); ctx.closePath(); ctx.fill()
      ctx.restore()
    }

    const drawPipe = (x, top) => {
      // Top pipe (algae/seaweed themed)
      const grad1 = ctx.createLinearGradient(x, 0, x + PIPE_W, 0)
      grad1.addColorStop(0, '#059669'); grad1.addColorStop(1, '#10b981')
      ctx.fillStyle = grad1
      ctx.fillRect(x, 0, PIPE_W, top)
      // Cap
      ctx.fillStyle = '#047857'
      ctx.fillRect(x - 4, top - 20, PIPE_W + 8, 20)
      // Seaweed texture
      ctx.strokeStyle = 'rgba(255,255,255,0.15)'
      ctx.lineWidth = 2
      for (let i = 10; i < top - 20; i += 25) {
        ctx.beginPath(); ctx.moveTo(x + 10, i); ctx.lineTo(x + PIPE_W - 10, i + 12); ctx.stroke()
      }

      // Bottom pipe
      const bot = top + GAP
      const grad2 = ctx.createLinearGradient(x, 0, x + PIPE_W, 0)
      grad2.addColorStop(0, '#059669'); grad2.addColorStop(1, '#10b981')
      ctx.fillStyle = grad2
      ctx.fillRect(x, bot, PIPE_W, H - bot)
      ctx.fillStyle = '#047857'
      ctx.fillRect(x - 4, bot, PIPE_W + 8, 20)
      for (let i = bot + 30; i < H; i += 25) {
        ctx.beginPath(); ctx.moveTo(x + 10, i); ctx.lineTo(x + PIPE_W - 10, i + 12); ctx.stroke()
      }
    }

    const drawBg = () => {
      // Water gradient background
      const bg = ctx.createLinearGradient(0, 0, 0, H)
      bg.addColorStop(0, '#0f172a'); bg.addColorStop(0.4, '#0c4a6e'); bg.addColorStop(1, '#164e63')
      ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H)
      // Bubbles
      ctx.fillStyle = 'rgba(148,163,184,0.12)'
      ;[40,120,200,280,360].forEach((bx, i) => {
        const by = (s.frame * 0.5 + i * 80) % H
        ctx.beginPath(); ctx.arc(bx, by, 4 + i % 3, 0, Math.PI * 2); ctx.fill()
      })
      // Light rays
      ctx.strokeStyle = 'rgba(148,163,184,0.05)'; ctx.lineWidth = 12
      ;[80, 180, 300].forEach(rx => {
        ctx.beginPath(); ctx.moveTo(rx, 0); ctx.lineTo(rx + 30, H); ctx.stroke()
      })
    }

    let raf
    const loop = () => {
      s.frame++
      ctx.clearRect(0, 0, W, H)
      drawBg()

      if (!s.started) {
        drawFish(s.fish.x, s.fish.y + Math.sin(s.frame * 0.07) * 8, 0)
        ctx.fillStyle = 'rgba(0,0,0,0.55)'
        ctx.fillRect(W / 2 - 100, H / 2 - 50, 200, 80)
        ctx.fillStyle = 'white'; ctx.font = 'bold 18px Inter'
        ctx.textAlign = 'center'
        ctx.fillText('🐟 Flappy Fish', W / 2, H / 2 - 18)
        ctx.font = '14px Inter'; ctx.fillStyle = 'rgba(255,255,255,0.7)'
        ctx.fillText('Click or Space to start', W / 2, H / 2 + 14)
        ctx.textAlign = 'left'
        raf = requestAnimationFrame(loop); return
      }

      if (!s.fish.alive) {
        drawFish(s.fish.x, s.fish.y, s.fish.vy)
        s.pipes.forEach(p => drawPipe(p.x, p.top))
        ctx.fillStyle = 'rgba(0,0,0,0.65)'
        ctx.fillRect(W / 2 - 90, H / 2 - 55, 180, 110)
        ctx.fillStyle = 'white'; ctx.font = 'bold 20px Inter'
        ctx.textAlign = 'center'
        ctx.fillText('💀 Game Over', W / 2, H / 2 - 18)
        ctx.font = 'bold 28px Inter'; ctx.fillStyle = '#fbbf24'
        ctx.fillText(`Score: ${s.score}`, W / 2, H / 2 + 18)
        ctx.font = '13px Inter'; ctx.fillStyle = 'rgba(255,255,255,0.7)'
        ctx.fillText('Click to play again', W / 2, H / 2 + 44)
        ctx.textAlign = 'left'
        cancelAnimationFrame(raf); return
      }

      // Physics
      s.fish.vy += GRAVITY
      s.fish.y += s.fish.vy
      if (s.fish.y > H - 16 || s.fish.y < 16) { s.fish.alive = false; setDead(true); play('wrong'); onComplete(s.score * 5); return }

      // Pipes
      if (s.frame % 90 === 0) spawnPipe()
      s.pipes = s.pipes.filter(p => p.x > -PIPE_W)
      s.pipes.forEach(p => {
        p.x -= SPEED
        if (!p.scored && p.x + PIPE_W < s.fish.x) { p.scored = true; s.score++; setScore(s.score); play('drop') }
        // Collision
        if (s.fish.x + 14 > p.x && s.fish.x - 14 < p.x + PIPE_W) {
          if (s.fish.y - 12 < p.top || s.fish.y + 12 > p.top + GAP) {
            s.fish.alive = false; setDead(true); play('wrong')
            cancelAnimationFrame(raf); onComplete(s.score * 5); return
          }
        }
        drawPipe(p.x, p.top)
      })

      drawFish(s.fish.x, s.fish.y, s.fish.vy)

      // Score HUD
      ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.fillRect(W / 2 - 40, 10, 80, 36)
      ctx.fillStyle = 'white'; ctx.font = 'bold 22px Inter'
      ctx.textAlign = 'center'; ctx.fillText(s.score, W / 2, 36); ctx.textAlign = 'left'

      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)

    return () => { cancelAnimationFrame(raf); window.removeEventListener('keydown', onKey); canvas.removeEventListener('click', onTap) }
  }, [])

  const restart = () => {
    const s = stateRef.current
    if (!s) return
    s.fish.y = 250; s.fish.vy = 0; s.fish.alive = true
    s.pipes = []; s.score = 0; s.started = false; s.frame = 0
    setScore(0); setDead(false); setStarted(false)
    // Restart loop
    const canvas = canvasRef.current
    if (canvas) canvas.click()
  }

  return (
    <div className="flex flex-col items-center gap-3">
      {!dead && started && (
        <div className="flex items-center gap-4 text-sm font-bold">
          <span style={{ color: 'var(--text-muted)' }}>Score: <span style={{ color: '#6366f1' }}>{score}</span></span>
          <span style={{ color: 'var(--text-light)' }}>Space / Click to flap</span>
        </div>
      )}
      <canvas ref={canvasRef} style={{ borderRadius: 16, cursor: 'pointer', border: '2px solid rgba(99,102,241,0.3)' }}/>
      {dead && (
        <button onClick={restart} className="btn-primary px-6 py-2">🔄 Play Again</button>
      )}
    </div>
  )
}

/* ─── Main Games Hub ─── */
const GAMES = [
  { id: 'snake', title: 'Water Snake', desc: 'Classic snake — eat clean water drops 💧, dodge poison ☠️. Learn water facts as you play!', emoji: '🐍', points: 'Unlimited pts', component: WaterSnake, badge: '⭐ NEW' },
  { id: 'flappy', title: 'Flappy Fish', desc: 'Dodge the seaweed pipes! Tap/space to flap. Easy mode — big gap, gentle gravity.', emoji: '🐟', points: 'Unlimited pts', component: FlappyFish, badge: '🔥 HOT' },
  { id: 'boat', title: 'Boat Cleanup', desc: 'Steer your boat to collect pollution and protect the lake!', emoji: '🚢', points: 'Up to 200 pts', component: BoatGame },
  { id: 'ph', title: 'pH Balance', desc: 'Quick — is this water sample safe or unsafe for aquatic life?', emoji: '⚗️', points: 'Up to 120 pts', component: PHGame },
  { id: 'trivia', title: 'Water Ranger Trivia', desc: 'Test your water science knowledge with a timed challenge!', emoji: '🎓', points: 'Up to 120 pts', component: WaterTrivia },
  { id: 'defender', title: 'Watershed Defender', desc: 'Fight pollution threats before they destroy Northern Ontario\'s watersheds!', emoji: '🛡️', points: 'Up to 120 pts', component: WatershedGame },
]

export default function Games() {
  const { play } = useSound()
  const [activeGame, setActiveGame] = useState(null)
  const [bestScores, setBestScores] = useState(() => {
    try { return JSON.parse(localStorage.getItem('sw_game_bests') || '{}') } catch { return {} }
  })
  const [gameHistory, setGameHistory] = useState(() => {
    try { return JSON.parse(localStorage.getItem('sw_game_history') || '[]') } catch { return [] }
  })
  const [showStats, setShowStats] = useState(false)

  const finish = async (gameId, score) => {
    play('levelUp')
    const newBests = { ...bestScores, [gameId]: Math.max(bestScores[gameId] || 0, score) }
    setBestScores(newBests)
    localStorage.setItem('sw_game_bests', JSON.stringify(newBests))
    const entry = { gameId, score, date: new Date().toISOString() }
    const newHistory = [entry, ...gameHistory].slice(0, 50)
    setGameHistory(newHistory)
    localStorage.setItem('sw_game_history', JSON.stringify(newHistory))
    await api.post('/leaderboard/game-score', { game_type: gameId, score }).catch(() => {})
    setActiveGame(null)
  }

  const totalPlays = gameHistory.length
  const totalPoints = gameHistory.reduce((s, h) => s + h.score, 0)
  const topGame = Object.entries(bestScores).sort((a, b) => b[1] - a[1])[0]

  if (activeGame) {
    const game = GAMES.find(g => g.id === activeGame)
    const GameComp = game.component
    return (
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center gap-3 mb-5">
          <button onClick={() => setActiveGame(null)}
            className="p-2 rounded-xl transition-colors"
            style={{ background: 'var(--card-bg)', border: '1px solid var(--border)' }}>
            <ArrowLeft className="w-5 h-5" style={{ color: 'var(--text-muted)' }} />
          </button>
          <span className="text-2xl">{game.emoji}</span>
          <h2 className="font-bold text-xl" style={{ color: 'var(--text)' }}>{game.title}</h2>
          {bestScores[activeGame] !== undefined && (
            <span className="ml-auto text-sm font-semibold" style={{ color: '#10b981' }}>
              🏅 Best: {bestScores[activeGame]}
            </span>
          )}
        </div>
        <GameComp onComplete={(s) => finish(activeGame, s)} />
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-bold" style={{ fontSize: 20, color: 'var(--text)' }}>Water Learning Games</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>Play, earn points, and protect Northern Ontario's water!</p>
        </div>
        <button onClick={() => setShowStats(s => !s)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold transition-all"
          style={{ background: showStats ? '#6366f1' : 'var(--card-bg)', color: showStats ? 'white' : 'var(--text-muted)', border: '1px solid var(--border)' }}>
          <Trophy className="w-4 h-4" />
          My Stats
        </button>
      </div>

      {/* My Stats Panel */}
      {showStats && (
        <div className="card p-5">
          <h3 className="font-bold mb-4" style={{ color: 'var(--text)' }}>My Game Stats</h3>
          <div className="grid grid-cols-3 gap-4 mb-4">
            {[
              { label: 'Games Played', value: totalPlays, icon: '🎮' },
              { label: 'Total Points', value: totalPoints, icon: '⭐' },
              { label: 'Best Game', value: topGame ? `${GAMES.find(g => g.id === topGame[0])?.emoji} ${topGame[1]}` : '—', icon: '🏆' },
            ].map(s => (
              <div key={s.label} className="rounded-xl p-3 text-center"
                style={{ background: 'var(--page-bg)', border: '1px solid var(--border)' }}>
                <div className="text-2xl mb-1">{s.icon}</div>
                <div className="font-black text-lg" style={{ color: 'var(--text)' }}>{s.value}</div>
                <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{s.label}</div>
              </div>
            ))}
          </div>
          {/* Per-game bests */}
          <div className="space-y-2">
            {GAMES.map(g => (
              <div key={g.id} className="flex items-center justify-between py-2 px-3 rounded-xl"
                style={{ background: 'var(--page-bg)' }}>
                <span className="text-sm font-medium" style={{ color: 'var(--text)' }}>{g.emoji} {g.title}</span>
                <span className="text-sm font-bold" style={{ color: bestScores[g.id] ? '#10b981' : 'var(--text-muted)' }}>
                  {bestScores[g.id] !== undefined ? `Best: ${bestScores[g.id]}` : 'Not played'}
                </span>
              </div>
            ))}
          </div>
          {gameHistory.length > 0 && (
            <div className="mt-4">
              <p className="text-xs font-semibold mb-2" style={{ color: 'var(--text-muted)' }}>RECENT GAMES</p>
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {gameHistory.slice(0, 10).map((h, i) => {
                  const g = GAMES.find(g => g.id === h.gameId)
                  return (
                    <div key={i} className="flex items-center justify-between text-sm px-2 py-1 rounded-lg"
                      style={{ background: 'var(--card-bg)' }}>
                      <span style={{ color: 'var(--text)' }}>{g?.emoji} {g?.title}</span>
                      <div className="flex items-center gap-3">
                        <span className="font-bold" style={{ color: '#6366f1' }}>{h.score} pts</span>
                        <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>
                          {new Date(h.date).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Game Grid */}
      <div className="grid md:grid-cols-2 gap-5">
        {GAMES.map(game => (
          <div key={game.id} className="game-card p-6 cursor-pointer group" onClick={() => { play('click'); setActiveGame(game.id) }}>
            <div className="flex items-start justify-between mb-3">
              <div className="text-5xl group-hover:scale-110 transition-transform">{game.emoji}</div>
              {game.badge && <span className="badge bg-ocean-100 text-ocean-700 animate-pulse">{game.badge}</span>}
            </div>
            <h3 className="font-bold text-lg mb-2" style={{ color: 'var(--text)' }}>{game.title}</h3>
            <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>{game.desc}</p>
            <div className="flex items-center justify-between">
              <span className="badge bg-teal-100 text-teal-700">{game.points}</span>
              {bestScores[game.id] !== undefined ? (
                <span className="text-sm font-bold" style={{ color: '#10b981' }}>🏅 Best: {bestScores[game.id]}</span>
              ) : (
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Not played yet</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
