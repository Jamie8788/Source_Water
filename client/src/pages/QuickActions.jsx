import { useNavigate } from 'react-router-dom'
import { useState, useEffect, useRef } from 'react'
import {
  LayoutDashboard, Sparkles, Map, BellRing, FileBarChart2,
  Users, BookOpen, GraduationCap, LineChart, Microscope,
  FlaskConical, CloudSun, Joystick,
} from 'lucide-react'

/* ── Portal nodes – positions are % on the map canvas ───────────────────── */
const PORTALS = [
  { label: 'Dashboard',     sub: 'Overview',      icon: LayoutDashboard, path: '/dashboard',  color: '#1a78c2', glow: '#4db6f5', x: 52, y: 44 },
  { label: 'Ask Water AI',  sub: 'Talk to Water',  icon: Sparkles,        path: '/ask-water',  color: '#7c3aed', glow: '#a78bfa', x: 78, y: 24 },
  { label: 'Live Map',      sub: 'Explore',        icon: Map,             path: '/map',        color: '#0e7490', glow: '#22d3ee', x: 20, y: 28 },
  { label: 'Alerts',        sub: 'Stay notified',  icon: BellRing,        path: '/alerts',     color: '#b45309', glow: '#fcd34d', x: 52, y: 13 },
  { label: 'Reports',       sub: 'Stats & trends', icon: FileBarChart2,   path: '/reports',    color: '#1d4ed8', glow: '#60a5fa', x: 82, y: 50 },
  { label: 'Community',     sub: 'Connect',        icon: Users,           path: '/social',     color: '#be185d', glow: '#f472b6', x: 10, y: 56 },
  { label: 'Resources',     sub: 'Learn & quiz',   icon: BookOpen,        path: '/resources',  color: '#166534', glow: '#4ade80', x: 32, y: 70 },
  { label: 'Quiz & Learn',  sub: 'Test yourself',  icon: GraduationCap,   path: '/quiz',       color: '#9a3412', glow: '#fb923c', x: 68, y: 72 },
  { label: 'Data Analysis', sub: 'Deep dive',      icon: LineChart,       path: '/analysis',   color: '#1e3a8a', glow: '#818cf8', x: 84, y: 35 },
  { label: 'Research Hub',  sub: 'Projects & tools', icon: Microscope,   path: '/research',   color: '#581c87', glow: '#c084fc', x: 16, y: 72 },
  { label: 'Projects',      sub: 'Build & track',  icon: FlaskConical,   path: '/projects',   color: '#134e4a', glow: '#5eead4', x: 60, y: 84 },
  { label: 'Weather',       sub: 'Conditions',     icon: CloudSun,        path: '/weather',    color: '#0c4a6e', glow: '#7dd3fc', x: 36, y: 17 },
  { label: 'Games',         sub: 'Water activities', icon: Joystick,      path: '/games',      color: '#4a044e', glow: '#e879f9', x: 20, y: 84 },
]

const LINES = [
  [0,1],[0,2],[0,3],[0,4],[0,5],[0,6],[0,7],[0,8],[0,9],[0,10],[0,11],[0,12],
  [2,11],[3,11],[4,8],[1,8],[5,9],[6,12],[7,10],[1,7],[3,3],[2,5],
]

/* ── Great Lakes SVG paths (simplified, viewBox 0 0 100 100) ─────────────── */
const LAKES_SVG = `
  <path d="M16,11 Q20,7 28,6 Q38,5 48,8 Q56,11 58,17 Q56,23 50,26 Q42,28 32,25 Q22,21 18,16 Z" fill="rgba(62,138,187,0.72)" stroke="rgba(30,90,140,0.5)" stroke-width="0.3"/>
  <text x="34" y="17" font-size="2.2" fill="rgba(20,60,100,0.7)" text-anchor="middle" font-style="italic" font-family="Georgia,serif">Lake Superior</text>
  <path d="M32,28 Q30,33 29,42 Q28,52 30,60 Q33,65 37,63 Q41,59 41,50 Q43,40 41,32 Q39,26 35,26 Z" fill="rgba(62,138,187,0.68)" stroke="rgba(30,90,140,0.5)" stroke-width="0.3"/>
  <text x="35" y="47" font-size="2" fill="rgba(20,60,100,0.7)" text-anchor="middle" font-style="italic" font-family="Georgia,serif">L. Michigan</text>
  <path d="M46,19 Q54,17 62,19 Q68,23 68,30 Q68,38 64,44 Q60,50 54,52 Q48,52 44,46 Q40,40 41,30 Q42,23 46,19 Z" fill="rgba(62,138,187,0.7)" stroke="rgba(30,90,140,0.5)" stroke-width="0.3"/>
  <text x="55" y="36" font-size="2.2" fill="rgba(20,60,100,0.7)" text-anchor="middle" font-style="italic" font-family="Georgia,serif">Lake Huron</text>
  <path d="M44,56 Q52,53 62,55 Q70,57 72,62 Q70,66 60,67 Q50,67 44,64 Q40,61 42,57 Z" fill="rgba(62,138,187,0.66)" stroke="rgba(30,90,140,0.5)" stroke-width="0.3"/>
  <text x="57" y="62" font-size="2" fill="rgba(20,60,100,0.7)" text-anchor="middle" font-style="italic" font-family="Georgia,serif">Lake Erie</text>
  <path d="M70,54 Q76,52 82,54 Q86,57 85,62 Q82,65 76,64 Q70,63 68,59 Q68,55 70,54 Z" fill="rgba(62,138,187,0.65)" stroke="rgba(30,90,140,0.5)" stroke-width="0.3"/>
  <text x="77" y="59.5" font-size="1.8" fill="rgba(20,60,100,0.7)" text-anchor="middle" font-style="italic" font-family="Georgia,serif">L. Ontario</text>
`

const CSS = `
@keyframes mapPortalPulse {
  0%,100% { box-shadow: 0 0 0 2px var(--ring), 0 0 16px var(--glow), 0 2px 8px rgba(0,0,0,0.3) }
  50%     { box-shadow: 0 0 0 4px var(--ring), 0 0 28px var(--glow), 0 2px 8px rgba(0,0,0,0.3) }
}
@keyframes portalFloatIn {
  0%   { opacity:0; transform:translate(-50%,-50%) scale(0.3) }
  70%  { transform:translate(-50%,-50%) scale(1.08) }
  100% { opacity:1; transform:translate(-50%,-50%) scale(1) }
}
@keyframes waveRoll {
  from { transform:translateX(0) }
  to   { transform:translateX(-50%) }
}
@keyframes waveRoll2 {
  from { transform:translateX(-50%) }
  to   { transform:translateX(0) }
}
@keyframes compassNeedle {
  0%,100% { filter:drop-shadow(0 0 4px rgba(220,50,50,0.9)) }
  50%     { filter:drop-shadow(0 0 8px rgba(220,50,50,1)) }
}
@keyframes titleShimmer {
  0%,100% { opacity:1 }
  50%     { opacity:0.88 }
}
@keyframes wakefade {
  0%   { opacity:0.55; r:3 }
  100% { opacity:0;    r:1 }
}
@keyframes windLine {
  0%   { transform:translateX(0)  opacity:0 }
  20%  { opacity:0.4 }
  80%  { opacity:0.4 }
  100% { transform:translateX(60px); opacity:0 }
}
@keyframes fogDrift {
  0%,100% { transform:translateX(0) translateY(0); opacity:0.06 }
  50%     { transform:translateX(2%) translateY(-5px); opacity:0.1 }
}
@keyframes seaSpark {
  0%,100% { opacity:0 }
  50%     { opacity:0.6 }
}
@keyframes labelAppear {
  0%   { opacity:0; transform:translateX(-4px) }
  100% { opacity:1; transform:translateX(0) }
}
`

/* ── Ship SVG ────────────────────────────────────────────────────────────── */
function ShipSVG({ angle = 0, scale = 1 }) {
  return (
    <svg
      width={80 * scale} height={56 * scale}
      viewBox="0 0 80 56"
      fill="none"
      style={{ transform: `rotate(${angle + 90}deg)`, transformOrigin: '50% 65%', transition: 'transform 0.05s linear' }}
    >
      {/* Hull shadow */}
      <ellipse cx="40" cy="46" rx="28" ry="5" fill="rgba(0,0,0,0.18)"/>
      {/* Hull */}
      <path d="M12 36 Q40 46 68 36 L60 44 Q40 50 20 44 Z" fill="#7c3a1a" stroke="#4a1f00" strokeWidth="1"/>
      <rect x="18" y="30" width="44" height="7" rx="2" fill="#9b4a22" stroke="#4a1f00" strokeWidth="0.8"/>
      {/* Masts */}
      <line x1="40" y1="5" x2="40" y2="34" stroke="#3d2510" strokeWidth="2.5"/>
      <line x1="26" y1="12" x2="26" y2="33" stroke="#3d2510" strokeWidth="2"/>
      <line x1="54" y1="14" x2="54" y2="33" stroke="#3d2510" strokeWidth="1.8"/>
      {/* Sails */}
      <path d="M42 6 Q56 18 50 34 L42 34 Z" fill="rgba(252,248,230,0.96)" stroke="#c8b060" strokeWidth="0.8"/>
      <path d="M28 13 Q40 22 36 33 L28 33 Z" fill="rgba(252,248,230,0.92)" stroke="#c8b060" strokeWidth="0.8"/>
      <path d="M56 15 Q64 22 62 33 L56 33 Z" fill="rgba(252,248,230,0.85)" stroke="#c8b060" strokeWidth="0.8"/>
      <path d="M16 22 L26 13 L26 32 Z" fill="rgba(252,248,230,0.82)" stroke="#c8b060" strokeWidth="0.8"/>
      {/* Flag */}
      <path d="M40 5 L50 8 L40 11 Z" fill="#1a78c2"/>
      {/* Crow nest */}
      <rect x="36" y="12" width="8" height="5" rx="1.5" fill="#7c3a1a"/>
      {/* Waterline waves */}
      <path d="M10 42 Q18 39 26 42 Q34 45 42 42 Q50 39 58 42 Q66 45 72 42"
        stroke="rgba(62,138,187,0.6)" strokeWidth="1.2" fill="none"/>
    </svg>
  )
}

/* ── Compass Rose (interactive) ─────────────────────────────────────────── */
function Compass({ heading = 0 }) {
  return (
    <svg width="100" height="100" viewBox="0 0 100 100" style={{ display: 'block' }}>
      {/* Outer decorative ring */}
      <circle cx="50" cy="50" r="47" fill="rgba(232,212,162,0.95)" stroke="#8b6914" strokeWidth="2"/>
      <circle cx="50" cy="50" r="42" fill="none" stroke="#b8962a" strokeWidth="0.8" strokeDasharray="3 3"/>
      {/* Degree ticks */}
      {Array.from({ length: 36 }, (_, i) => {
        const a = (i * 10) * Math.PI / 180
        const r1 = 40, r2 = i % 9 === 0 ? 32 : i % 3 === 0 ? 36 : 38
        return <line key={i}
          x1={50 + Math.cos(a - Math.PI/2) * r1} y1={50 + Math.sin(a - Math.PI/2) * r1}
          x2={50 + Math.cos(a - Math.PI/2) * r2} y2={50 + Math.sin(a - Math.PI/2) * r2}
          stroke="#8b6914" strokeWidth={i % 9 === 0 ? 1.5 : 0.7}/>
      })}
      {/* Rose petals (rotate with heading) */}
      <g transform={`rotate(${heading} 50 50)`} style={{ transition: 'transform 0.1s linear' }}>
        {[0, 45, 90, 135].map(deg => (
          <g key={deg} transform={`rotate(${deg} 50 50)`}>
            <polygon points="50,16 47,50 50,44 53,50" fill={deg === 0 ? '#c8332a' : 'rgba(180,140,60,0.95)'}/>
            <polygon points="50,84 47,50 50,56 53,50" fill="rgba(100,70,30,0.8)"/>
          </g>
        ))}
        {/* Center */}
        <circle cx="50" cy="50" r="7" fill="none" stroke="#8b6914" strokeWidth="1.5"/>
        <circle cx="50" cy="50" r="3.5" fill="#b8962a"/>
        {/* Cardinal labels */}
        {[['N','#c8332a',50,10],['E','#5c3d1e',90,52],['S','#5c3d1e',50,94],['W','#5c3d1e',10,52]].map(([l,c,x,y]) => (
          <text key={l} x={x} y={y} textAnchor="middle" dominantBaseline="middle"
            fontSize="10" fontWeight="800" fontFamily="Georgia,serif" fill={c}>{l}</text>
        ))}
      </g>
    </svg>
  )
}

export default function QuickActions() {
  const navigate = useNavigate()
  const [hovered, setHovered] = useState(null)
  const [mounted, setMounted] = useState(false)

  // Ship state (in % coords)
  const shipRef = useRef({ x: 52, y: 58, angle: -20, speed: 0 })
  const [shipRender, setShipRender] = useState({ x: 52, y: 58, angle: -20 })
  const [wake, setWake] = useState([])
  const keysRef = useRef({})
  const rafRef = useRef()

  // Keyboard controls
  useEffect(() => {
    const down = e => {
      keysRef.current[e.key] = true
      // prevent arrow keys scrolling page while on this tab
      if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' '].includes(e.key)) e.preventDefault()
    }
    const up = e => { keysRef.current[e.key] = false }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up) }
  }, [])

  // Game loop
  useEffect(() => {
    let lastWakeTime = 0
    const loop = (now) => {
      const k = keysRef.current
      const s = shipRef.current

      // Turn (left = counter-clockwise)
      if (k['ArrowLeft'] || k['a'] || k['A']) s.angle -= 2.8
      if (k['ArrowRight'] || k['d'] || k['D']) s.angle += 2.8

      // Throttle
      const fwd = k['ArrowUp'] || k['w'] || k['W']
      const rev = k['ArrowDown'] || k['s'] || k['S']
      if (fwd)  s.speed = Math.min(s.speed + 0.025, 0.45)
      else if (rev) s.speed = Math.max(s.speed - 0.02, -0.18)
      else s.speed *= 0.94

      // Move
      const rad = (s.angle - 90) * Math.PI / 180
      const nx = Math.max(3, Math.min(95, s.x + Math.cos(rad) * s.speed))
      const ny = Math.max(3, Math.min(92, s.y + Math.sin(rad) * s.speed))
      const moved = nx !== s.x || ny !== s.y
      s.x = nx; s.y = ny

      // Wake trail
      if (Math.abs(s.speed) > 0.06 && now - lastWakeTime > 80) {
        lastWakeTime = now
        setWake(w => [{ x: s.x, y: s.y, id: now }, ...w.slice(0, 28)])
      }

      // Sync render state
      setShipRender({ x: s.x, y: s.y, angle: s.angle, speed: s.speed })

      rafRef.current = requestAnimationFrame(loop)
    }
    rafRef.current = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(rafRef.current)
  }, [])

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 80)
    return () => clearTimeout(t)
  }, [])

  // Normalize angle 0-360
  const compassHeading = ((shipRender.angle % 360) + 360) % 360
  const isMoving = Math.abs(shipRender.speed) > 0.05

  return (
    <div style={{
      position: 'relative', width: '100%',
      minHeight: 'calc(100vh - 120px)',
      overflow: 'hidden', borderRadius: 16,
      background: 'linear-gradient(160deg, #e8d4a0 0%, #d4b888 30%, #c9a870 60%, #d8c090 100%)',
      fontFamily: 'Georgia,"Times New Roman",serif',
      cursor: 'default',
    }}>
      <style>{CSS}</style>

      {/* ── Parchment grain texture overlay ── */}
      <svg style={{ position:'absolute', inset:0, width:'100%', height:'100%', zIndex:0, pointerEvents:'none', opacity:0.18 }}>
        <filter id="grain">
          <feTurbulence type="fractalNoise" baseFrequency="0.68" numOctaves="4" stitchTiles="stitch"/>
          <feColorMatrix type="saturate" values="0"/>
        </filter>
        <rect width="100%" height="100%" filter="url(#grain)"/>
      </svg>

      {/* ── Map aging vignette ── */}
      <div style={{
        position:'absolute', inset:0, zIndex:1, pointerEvents:'none',
        background:`
          radial-gradient(ellipse 90% 80% at 50% 50%, transparent 40%, rgba(100,60,10,0.28) 100%),
          radial-gradient(ellipse 60% 40% at 20% 80%, rgba(120,70,10,0.18) 0%, transparent 60%),
          radial-gradient(ellipse 50% 50% at 80% 10%, rgba(100,60,10,0.14) 0%, transparent 50%)
        `,
      }}/>

      {/* ── Latitude / longitude grid ── */}
      <svg style={{ position:'absolute', inset:0, width:'100%', height:'100%', zIndex:2, pointerEvents:'none', opacity:0.22 }}>
        {Array.from({length:10},(_,i)=>(
          <g key={i}>
            <line x1={`${(i+1)*9}%`} y1="0" x2={`${(i+1)*9}%`} y2="100%" stroke="#8b6020" strokeWidth="0.5" strokeDasharray="4 6"/>
            <line x1="0" y1={`${(i+1)*9}%`} x2="100%" y2={`${(i+1)*9}%`} stroke="#8b6020" strokeWidth="0.5" strokeDasharray="4 6"/>
          </g>
        ))}
      </svg>

      {/* ── Great Lakes map ── */}
      <svg style={{ position:'absolute', inset:0, width:'100%', height:'100%', zIndex:3, pointerEvents:'none' }}
        viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice">
        {/* Land mass (background fill for continent) */}
        <path d="M0,0 L100,0 L100,100 L0,100 Z" fill="rgba(200,170,110,0.0)"/>
        {/* Shoreline decorations */}
        <path d="M5,5 Q50,2 95,5 Q98,50 95,95 Q50,98 5,95 Q2,50 5,5 Z"
          fill="none" stroke="rgba(140,100,40,0.15)" strokeWidth="0.5"/>
        {/* Lakes */}
        <g dangerouslySetInnerHTML={{__html: LAKES_SVG}}/>
        {/* Wave texture inside lakes */}
        {[
          'M20,15 Q30,13 40,15', 'M22,18 Q32,16 42,18',
          'M32,35 Q35,33 38,35', 'M30,38 Q34,36 37,38',
          'M48,28 Q54,26 60,28', 'M47,32 Q53,30 59,32',
          'M46,59 Q54,57 62,59', 'M72,57 Q77,55 82,57',
        ].map((d,i) => (
          <path key={i} d={d} stroke="rgba(100,170,210,0.4)" strokeWidth="0.5" fill="none"/>
        ))}
        {/* Decorative ship routes (historical) */}
        <path d="M20,28 Q36,20 52,44 Q65,60 82,50"
          stroke="rgba(140,80,20,0.25)" strokeWidth="0.7" fill="none" strokeDasharray="3 4"/>
        <path d="M10,56 Q30,40 52,44 Q70,48 84,35"
          stroke="rgba(140,80,20,0.2)" strokeWidth="0.6" fill="none" strokeDasharray="2 5"/>
        {/* Depth soundings */}
        {[[35,14,'42'],[55,30,'187'],[50,22,'36'],[57,61,'24'],[75,58,'10']].map(([x,y,d],i)=>(
          <text key={i} x={x} y={y} fontSize="1.6" fill="rgba(30,70,120,0.55)" textAnchor="middle" fontFamily="Georgia,serif">{d}</text>
        ))}
        {/* Small geographical labels */}
        {[
          [18,6,'CANADA'],
          [82,80,'UNITED STATES'],
          [8,40,'WISCONSIN'],
          [72,74,'OHIO'],
        ].map(([x,y,t],i)=>(
          <text key={i} x={x} y={y} fontSize="1.8" fill="rgba(80,50,20,0.35)" textAnchor="middle"
            fontFamily="system-ui,sans-serif" fontWeight="700" letterSpacing="0.15em">{t}</text>
        ))}
      </svg>

      {/* ── Water waves ── */}
      <div style={{ position:'absolute', inset:0, zIndex:4, pointerEvents:'none', overflow:'hidden' }}>
        <svg style={{ position:'absolute', bottom:'8%', width:'200%', opacity:0.1,
          animation:'waveRoll 18s linear infinite' }}
          viewBox="0 0 1440 40" height="40" preserveAspectRatio="none">
          <path d="M0,20 C160,5 320,35 480,20 C640,5 800,35 960,20 C1120,5 1280,35 1440,20 L1440,40 L0,40 Z"
            fill="#2a7aa0"/>
        </svg>
        <svg style={{ position:'absolute', bottom:'4%', width:'200%', opacity:0.07,
          animation:'waveRoll2 24s linear infinite' }}
          viewBox="0 0 1440 30" height="30" preserveAspectRatio="none">
          <path d="M0,15 C240,4 480,26 720,15 C960,4 1200,26 1440,15 L1440,30 L0,30 Z"
            fill="#14b8a6"/>
        </svg>
      </div>

      {/* ── Fog wisps ── */}
      {[
        { top:'10%', left:'5%', w:'40%' },
        { top:'55%', right:'5%', w:'35%' },
        { bottom:'15%', left:'25%', w:'30%' },
      ].map((f,i) => (
        <div key={i} style={{
          position:'absolute', ...f, height:'12%', zIndex:5, pointerEvents:'none',
          background:'radial-gradient(ellipse at 50% 50%, rgba(255,250,230,0.55) 0%, transparent 100%)',
          filter:'blur(12px)',
          animation:`fogDrift ${14+i*4}s ease-in-out infinite`,
          animationDelay:`${i*3}s`,
        }}/>
      ))}

      {/* ── Portal connection lines ── */}
      <svg style={{ position:'absolute', inset:0, width:'100%', height:'100%', zIndex:6, pointerEvents:'none' }}>
        <defs>
          <filter id="inkBlur">
            <feGaussianBlur stdDeviation="1.5"/>
          </filter>
          {PORTALS.map((p,i) => (
            <radialGradient key={i} id={`lg${i}`}>
              <stop offset="0%" stopColor={p.color} stopOpacity="0.9"/>
              <stop offset="100%" stopColor={p.color} stopOpacity="0.2"/>
            </radialGradient>
          ))}
        </defs>
        {LINES.map(([a,b], i) => {
          const pa = PORTALS[a], pb = PORTALS[b]
          const ah = hovered === a || hovered === b
          return (
            <line key={i}
              x1={`${pa.x}%`} y1={`${pa.y}%`}
              x2={`${pb.x}%`} y2={`${pb.y}%`}
              stroke={ah ? pa.color : 'rgba(100,65,20,0.35)'}
              strokeWidth={ah ? 1.8 : 0.9}
              strokeDasharray={ah ? 'none' : '5 5'}
              strokeOpacity={ah ? 0.85 : 1}
              filter={ah ? 'url(#inkBlur)' : 'none'}
              style={{ transition:'all 0.3s' }}
            />
          )
        })}
      </svg>

      {/* ── Wake trail ── */}
      <svg style={{ position:'absolute', inset:0, width:'100%', height:'100%', zIndex:7, pointerEvents:'none' }}>
        {wake.map((w, i) => {
          const age = i / wake.length
          return (
            <ellipse key={w.id}
              cx={`${w.x}%`} cy={`${w.y}%`}
              rx={`${0.6 - age * 0.5}%`} ry={`${0.2 - age * 0.15}%`}
              fill="none"
              stroke="rgba(80,150,200,0.5)"
              strokeWidth={Math.max(0.2, 1 - age * 0.8)}
              opacity={Math.max(0, 0.6 - age * 0.6)}
              transform={`rotate(${shipRender.angle} ${w.x * (window.innerWidth/100)} ${w.y * ((window.innerHeight - 120)/100)})`}
            />
          )
        })}
      </svg>

      {/* ── Drivable ship ── */}
      <div style={{
        position: 'absolute',
        left: `${shipRender.x}%`,
        top: `${shipRender.y}%`,
        transform: 'translate(-50%, -60%)',
        zIndex: 12,
        pointerEvents: 'none',
        filter: `drop-shadow(2px 4px 6px rgba(0,0,0,0.4))${isMoving ? ' drop-shadow(0 0 8px rgba(100,180,255,0.3))' : ''}`,
        transition: 'filter 0.3s',
      }}>
        <ShipSVG angle={shipRender.angle} scale={1.1}/>
      </div>

      {/* ── Portal nodes ── */}
      {PORTALS.map((portal, i) => {
        const Icon = portal.icon
        const isH = hovered === i
        const isCenter = i === 0
        const size = isCenter ? 88 : 68

        // Check if ship is near this portal
        const dx = portal.x - shipRender.x
        const dy = portal.y - shipRender.y
        const nearShip = Math.sqrt(dx*dx + dy*dy) < 6

        return (
          <div key={portal.path}
            onClick={() => navigate(portal.path)}
            onMouseEnter={() => setHovered(i)}
            onMouseLeave={() => setHovered(null)}
            style={{
              position:'absolute',
              left:`${portal.x}%`, top:`${portal.y}%`,
              transform:'translate(-50%,-50%)',
              zIndex: 10,
              cursor:'pointer',
              opacity: mounted ? 1 : 0,
              animation: mounted ? `portalFloatIn 0.55s cubic-bezier(0.34,1.56,0.64,1) ${i*0.07}s both` : 'none',
            }}
          >
            {/* Outer glow ring */}
            <div style={{
              position:'absolute',
              inset: -6,
              borderRadius:'50%',
              border: `2px solid ${portal.color}`,
              opacity: isH || nearShip ? 0.9 : 0.45,
              boxShadow: isH || nearShip ? `0 0 16px ${portal.glow}` : 'none',
              transition:'all 0.25s',
              pointerEvents:'none',
            }}/>

            {/* Main portal disc */}
            <div style={{
              width: size, height: size,
              borderRadius:'50%',
              background: isH || nearShip
                ? `radial-gradient(circle at 32% 28%, rgba(255,255,255,0.35) 0%, ${portal.color}cc 40%, ${portal.color}99 100%)`
                : `radial-gradient(circle at 32% 28%, rgba(255,255,255,0.25) 0%, ${portal.color}aa 45%, ${portal.color}77 100%)`,
              border:`${isCenter ? 3 : 2.5}px solid`,
              borderColor: isH || nearShip ? `#ffe680` : `rgba(180,140,40,0.9)`,
              '--ring': `${portal.color}88`,
              '--glow': `${portal.glow}66`,
              animation:`mapPortalPulse ${2.5+i*0.12}s ease-in-out infinite`,
              animationDelay:`${i*0.15}s`,
              display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
              gap: isCenter ? 5 : 3,
              position:'relative', overflow:'hidden',
              boxShadow:`0 3px 12px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.3)`,
              transform: isH ? 'scale(1.14)' : nearShip ? 'scale(1.08)' : 'scale(1)',
              transition:'transform 0.2s, border-color 0.2s',
            }}>
              {/* Shine */}
              <div style={{
                position:'absolute', top:'6%', left:'12%', width:'42%', height:'32%',
                background:'radial-gradient(ellipse, rgba(255,255,255,0.45) 0%, transparent 100%)',
                borderRadius:'50%', pointerEvents:'none',
              }}/>

              <Icon size={isCenter ? 26 : 20}
                style={{
                  color:'white',
                  filter:`drop-shadow(0 1px 3px rgba(0,0,0,0.6))`,
                  position:'relative', zIndex:1,
                  flexShrink:0,
                }}
              />
              <span style={{
                fontSize: isCenter ? 9.5 : 8.5,
                fontWeight:700,
                color:'white',
                textAlign:'center',
                lineHeight:1.2,
                maxWidth: size - 14,
                fontFamily:'system-ui,sans-serif',
                letterSpacing:'0.02em',
                textShadow:'0 1px 4px rgba(0,0,0,0.7)',
                position:'relative', zIndex:1,
              }}>
                {portal.label}
              </span>
            </div>

            {/* Label card (like old map tooltip) */}
            {(isH || nearShip) && (
              <div style={{
                position:'absolute',
                top: i < 7 ? '108%' : 'auto',
                bottom: i >= 7 ? '108%' : 'auto',
                left:'50%',
                transform:'translateX(-50%)',
                background:'rgba(240,225,185,0.97)',
                border:'1.5px solid rgba(140,100,30,0.8)',
                borderRadius:6,
                padding:'5px 10px',
                minWidth:90,
                textAlign:'center',
                boxShadow:'2px 3px 10px rgba(0,0,0,0.35)',
                zIndex:30,
                pointerEvents:'none',
                animation:'labelAppear 0.15s ease both',
              }}>
                <div style={{ fontSize:10, fontWeight:800, color: portal.color, fontFamily:'system-ui,sans-serif', letterSpacing:'0.05em' }}>
                  {portal.label.toUpperCase()}
                </div>
                <div style={{ fontSize:9, color:'#5c3d1e', fontFamily:'Georgia,serif', fontStyle:'italic' }}>
                  {portal.sub}
                </div>
                {nearShip && !isH && (
                  <div style={{ fontSize:8.5, color:'#1a78c2', fontWeight:700, marginTop:2, fontFamily:'system-ui,sans-serif' }}>
                    ↵ Press Enter
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}

      {/* ── Title banner ── */}
      <div style={{
        position:'absolute', top:16, left:'50%', transform:'translateX(-50%)',
        zIndex:25, textAlign:'center', pointerEvents:'none',
        animation:'titleShimmer 5s ease-in-out infinite',
      }}>
        <div style={{
          background:'rgba(232,212,162,0.95)',
          border:'2px solid rgba(140,100,30,0.8)',
          borderRadius:8,
          padding:'8px 22px',
          boxShadow:'2px 3px 14px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.5)',
        }}>
          <div style={{ fontSize:9, letterSpacing:'0.4em', color:'rgba(100,65,20,0.7)', fontFamily:'system-ui,sans-serif', fontWeight:700, textTransform:'uppercase', marginBottom:2 }}>
            ⚓ SOURCE WATER
          </div>
          <div style={{ fontSize:17, fontWeight:900, color:'#3d2510', letterSpacing:'0.12em', fontFamily:'Georgia,serif' }}>
            THE GREAT LAKES WATER NETWORK
          </div>
          <div style={{ fontSize:8.5, color:'rgba(100,65,20,0.6)', letterSpacing:'0.2em', marginTop:2, fontFamily:'system-ui,sans-serif' }}>
            CLICK A PORT TO NAVIGATE
          </div>
        </div>
      </div>

      {/* ── Compass rose (bottom-right) ── */}
      <div style={{
        position:'absolute', bottom:18, right:20, zIndex:25,
        filter:'drop-shadow(2px 3px 6px rgba(0,0,0,0.3))',
      }}>
        <Compass heading={compassHeading}/>
      </div>

      {/* ── Controls hint ── */}
      <div style={{
        position:'absolute', bottom:18, left:18, zIndex:25,
        background:'rgba(232,212,162,0.92)',
        border:'1.5px solid rgba(140,100,30,0.7)',
        borderRadius:8, padding:'8px 12px',
        boxShadow:'2px 3px 10px rgba(0,0,0,0.25)',
        fontFamily:'system-ui,sans-serif',
      }}>
        <div style={{ fontSize:9, fontWeight:800, color:'#3d2510', letterSpacing:'0.1em', marginBottom:5, textTransform:'uppercase' }}>
          ⛵ Drive the Ship
        </div>
        {[
          ['W / ↑', 'Sail forward'],
          ['S / ↓', 'Slow / reverse'],
          ['A / ←', 'Turn port'],
          ['D / →', 'Turn starboard'],
        ].map(([k,v]) => (
          <div key={k} style={{ display:'flex', gap:6, alignItems:'center', marginBottom:3 }}>
            <span style={{
              background:'rgba(140,100,30,0.2)', border:'1px solid rgba(140,100,30,0.5)',
              borderRadius:4, padding:'1px 5px',
              fontSize:8.5, fontWeight:700, color:'#3d2510', minWidth:36, textAlign:'center',
            }}>{k}</span>
            <span style={{ fontSize:8.5, color:'#5c3d1e' }}>{v}</span>
          </div>
        ))}
        {isMoving && (
          <div style={{ marginTop:4, fontSize:8.5, color:'#1a78c2', fontWeight:700 }}>
            ⛵ {Math.round(Math.abs(shipRender.speed) * 100)}% speed
          </div>
        )}
      </div>

      {/* ── Decorative elements ── */}
      {/* Sea monsters / decorations */}
      {[
        { e:'🐉', b:'30%', l:'2%', size:26 },
        { e:'🦕', t:'40%', r:'2%', size:22 },
        { e:'⚓', b:'40%', l:'46%', size:18, op:0.4 },
        { e:'🗺️', t:'6%', l:'4%',  size:16, op:0.5 },
        { e:'🐋', b:'18%', l:'58%', size:20 },
        { e:'🦀', b:'10%', r:'30%', size:16 },
      ].map((s,i) => (
        <div key={i} style={{
          position:'absolute',
          bottom:s.b, top:s.t, left:s.l, right:s.r,
          zIndex:8, fontSize:s.size, opacity:s.op || 0.45,
          pointerEvents:'none',
          filter:'drop-shadow(1px 2px 3px rgba(0,0,0,0.3))',
          animation:`fogDrift ${7+i*1.5}s ease-in-out infinite`,
          animationDelay:`${i*0.8}s`,
        }}>{s.e}</div>
      ))}

      {/* Wind rose flourishes (corner decorations) */}
      <div style={{ position:'absolute', top:14, left:14, zIndex:20, opacity:0.55, pointerEvents:'none', fontSize:22 }}>✦</div>
      <div style={{ position:'absolute', top:14, right:130, zIndex:20, opacity:0.55, pointerEvents:'none', fontSize:22 }}>✦</div>
      <div style={{ position:'absolute', bottom:14, left:200, zIndex:20, opacity:0.55, pointerEvents:'none', fontSize:18 }}>✦</div>
    </div>
  )
}
