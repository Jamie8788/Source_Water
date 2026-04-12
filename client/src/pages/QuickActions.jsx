import { useNavigate } from 'react-router-dom'
import { useState, useEffect, useRef } from 'react'
import {
  LayoutDashboard, Sparkles, Map, BellRing, FileBarChart2,
  Users, BookOpen, GraduationCap, LineChart, Microscope,
  FlaskConical, CloudSun, Joystick,
} from 'lucide-react'

const PORTALS = [
  { label: 'Dashboard',     icon: LayoutDashboard, path: '/dashboard',  color: '#0ea5e9', glow: '#38bdf8', x: 50,  y: 45 },
  { label: 'Ask Water AI',  icon: Sparkles,        path: '/ask-water',  color: '#a855f7', glow: '#c084fc', x: 74,  y: 22 },
  { label: 'Live Map',      icon: Map,             path: '/map',        color: '#14b8a6', glow: '#2dd4bf', x: 22,  y: 30 },
  { label: 'Alerts',        icon: BellRing,        path: '/alerts',     color: '#f59e0b', glow: '#fcd34d', x: 50,  y: 14 },
  { label: 'Reports',       icon: FileBarChart2,   path: '/reports',    color: '#3b82f6', glow: '#60a5fa', x: 80,  y: 50 },
  { label: 'Community',     icon: Users,           path: '/social',     color: '#ec4899', glow: '#f472b6', x: 14,  y: 54 },
  { label: 'Resources',     icon: BookOpen,        path: '/resources',  color: '#10b981', glow: '#34d399', x: 33,  y: 70 },
  { label: 'Quiz & Learn',  icon: GraduationCap,   path: '/quiz',       color: '#f97316', glow: '#fb923c', x: 68,  y: 70 },
  { label: 'Data Analysis', icon: LineChart,       path: '/analysis',   color: '#6366f1', glow: '#818cf8', x: 82,  y: 33 },
  { label: 'Research Hub',  icon: Microscope,      path: '/research',   color: '#8b5cf6', glow: '#a78bfa', x: 17,  y: 70 },
  { label: 'Projects',      icon: FlaskConical,    path: '/projects',   color: '#14b8a6', glow: '#5eead4', x: 60,  y: 84 },
  { label: 'Weather',       icon: CloudSun,        path: '/weather',    color: '#0ea5e9', glow: '#7dd3fc', x: 36,  y: 18 },
  { label: 'Games',         icon: Joystick,        path: '/games',      color: '#d946ef', glow: '#e879f9', x: 20,  y: 84 },
]

const BEAMS = [
  [0,1],[0,2],[0,3],[0,4],[0,5],[0,6],[0,7],
  [0,8],[0,9],[0,10],[0,11],[0,12],
  [2,11],[3,11],[4,8],[1,8],[5,9],[6,12],[7,10],[1,7],
]

const CSS = `
@keyframes ringA {
  from { transform: rotateX(72deg) rotateZ(0deg) }
  to   { transform: rotateX(72deg) rotateZ(360deg) }
}
@keyframes ringB {
  from { transform: rotateX(55deg) rotateY(40deg) rotateZ(0deg) }
  to   { transform: rotateX(55deg) rotateY(40deg) rotateZ(-360deg) }
}
@keyframes ringC {
  from { transform: rotateX(20deg) rotateY(-30deg) rotateZ(0deg) }
  to   { transform: rotateX(20deg) rotateY(-30deg) rotateZ(360deg) }
}
@keyframes corePulse {
  0%,100% { opacity:0.7; transform:scale(0.85) }
  50%     { opacity:1;   transform:scale(1.1) }
}
@keyframes orbDot {
  from { transform: rotate(0deg) translateX(var(--r)) }
  to   { transform: rotate(360deg) translateX(var(--r)) }
}
@keyframes portalEntry {
  0%   { opacity:0; transform:translate(-50%,-50%) translateY(30px) scale(0.4) }
  60%  { transform:translate(-50%,-50%) translateY(-6px) scale(1.05) }
  100% { opacity:1; transform:translate(-50%,-50%) translateY(0) scale(1) }
}
@keyframes beamFlow {
  0%   { stroke-dashoffset: 500 }
  100% { stroke-dashoffset: 0 }
}
@keyframes dotTravel {
  0%   { offset-distance:0%;   opacity:0 }
  5%   { opacity:1 }
  95%  { opacity:1 }
  100% { offset-distance:100%; opacity:0 }
}
@keyframes scanSweep {
  0%   { transform:translateX(-110%) }
  100% { transform:translateX(110%) }
}
@keyframes auroraShift {
  0%,100% { opacity:0.12; transform:scaleX(1) translateY(0) }
  33%     { opacity:0.22; transform:scaleX(1.15) translateY(-8px) }
  66%     { opacity:0.15; transform:scaleX(0.9) translateY(4px) }
}
@keyframes nebulaDrift {
  0%,100% { transform:translate(0,0) scale(1) }
  33%     { transform:translate(3%,2%) scale(1.04) }
  66%     { transform:translate(-2%,-1%) scale(0.97) }
}
@keyframes compassGlow {
  0%,100% { filter:drop-shadow(0 0 4px rgba(210,180,120,0.5)) }
  50%     { filter:drop-shadow(0 0 10px rgba(210,180,120,0.9)) }
}
@keyframes compassSpin {
  from { transform:rotate(0deg) }
  to   { transform:rotate(360deg) }
}
@keyframes titleFlicker {
  0%,96%,100% { opacity:1 }
  97%         { opacity:0.85 }
  98%         { opacity:1 }
  99%         { opacity:0.9 }
}
@keyframes shipSail {
  0%   { transform:translateX(-200px) }
  100% { transform:translateX(calc(100vw + 200px)) }
}
@keyframes shipBack {
  0%   { transform:translateX(calc(100vw + 200px)) scaleX(-1) }
  100% { transform:translateX(-200px) scaleX(-1) }
}
@keyframes waveRoll {
  0%   { transform:translateX(0) }
  100% { transform:translateX(-50%) }
}
@keyframes waveRoll2 {
  0%   { transform:translateX(-50%) }
  100% { transform:translateX(0) }
}
@keyframes floatBob {
  0%,100% { transform:translateY(0px) }
  50%     { transform:translateY(-8px) }
}
`

function ShipSVG({ scale = 1, opacity = 1 }) {
  return (
    <svg width={160 * scale} height={100 * scale} viewBox="0 0 160 100" fill="none" style={{ opacity }}>
      <path d="M12 65 Q80 82 148 65 L134 78 Q80 92 26 78 Z" fill="#7c3a1a" stroke="#4a1f00" strokeWidth="1.5"/>
      <rect x="30" y="56" width="100" height="10" rx="3" fill="#9b4a22" stroke="#4a1f00" strokeWidth="1"/>
      <line x1="80" y1="8" x2="80" y2="62" stroke="#3d2510" strokeWidth="3.5"/>
      <line x1="50" y1="18" x2="50" y2="60" stroke="#3d2510" strokeWidth="2.5"/>
      <line x1="110" y1="22" x2="110" y2="60" stroke="#3d2510" strokeWidth="2"/>
      <path d="M82 10 Q106 32 96 60 L82 60 Z" fill="rgba(255,250,230,0.93)" stroke="#c8b89a" strokeWidth="1"/>
      <path d="M52 20 Q70 38 64 60 L52 60 Z" fill="rgba(255,250,230,0.88)" stroke="#c8b89a" strokeWidth="1"/>
      <path d="M112 24 Q124 38 120 58 L112 58 Z" fill="rgba(255,250,230,0.8)" stroke="#c8b89a" strokeWidth="1"/>
      <path d="M34 38 L50 20 L50 58 Z" fill="rgba(255,250,230,0.78)" stroke="#c8b89a" strokeWidth="1"/>
      <path d="M80 8 L96 13 L80 18 Z" fill="#0ea5e9"/>
      <rect x="74" y="19" width="12" height="7" rx="2" fill="#7c3a1a"/>
      <path d="M10 74 Q26 70 42 74 Q58 78 74 74 Q90 70 106 74 Q122 78 138 74 Q152 70 158 74"
        stroke="rgba(100,200,255,0.4)" strokeWidth="2" fill="none"/>
    </svg>
  )
}

function DolphinSVG({ flip, style }) {
  return (
    <svg width="70" height="40" viewBox="0 0 70 40" fill="none"
      style={{ ...style, transform: `${style?.transform || ''} ${flip ? 'scaleX(-1)' : ''}` }}>
      <path d="M5 26 Q18 8 36 13 Q50 17 58 10 Q66 4 68 15 Q63 22 52 20 Q38 17 26 30 Q15 38 5 26 Z"
        fill="#14b8a6" stroke="#0d9488" strokeWidth="1"/>
      <path d="M3 24 Q0 19 5 17 Q7 22 5 26 Z" fill="#14b8a6"/>
      <circle cx="56" cy="13" r="2.5" fill="#0d9488"/>
      <circle cx="57" cy="12.2" r="1" fill="white"/>
      <path d="M60 8 Q68 2 70 7 Q65 12 61 10 Z" fill="#14b8a6" stroke="#0d9488" strokeWidth="0.5"/>
      <path d="M18 32 Q22 38 28 35" stroke="#0d9488" strokeWidth="1" fill="none" strokeLinecap="round"/>
    </svg>
  )
}

export default function QuickActions() {
  const navigate = useNavigate()
  const [hovered, setHovered] = useState(null)
  const [mounted, setMounted] = useState(false)
  const [mouse, setMouse] = useState({ x: 0.5, y: 0.5 })
  const containerRef = useRef()
  const canvasRef = useRef()
  const rafRef = useRef()

  // Canvas starfield
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')

    const resize = () => {
      canvas.width = canvas.offsetWidth
      canvas.height = canvas.offsetHeight
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(canvas)

    const STAR_COUNT = 280
    const stars = Array.from({ length: STAR_COUNT }, () => ({
      x: Math.random(),
      y: Math.random(),
      r: Math.random() * 1.4 + 0.2,
      phase: Math.random() * Math.PI * 2,
      speed: Math.random() * 0.6 + 0.2,
      color: Math.random() > 0.85 ? `hsl(${210 + Math.random()*60},80%,80%)` : 'white',
    }))

    // Shooting stars
    const shoots = Array.from({ length: 3 }, () => ({
      x: Math.random(), y: Math.random() * 0.5,
      vx: 0.003 + Math.random() * 0.004,
      vy: 0.001 + Math.random() * 0.002,
      len: 0.06 + Math.random() * 0.08,
      life: Math.random(),
      delay: Math.random() * 8,
    }))

    let t = 0
    const animate = () => {
      if (!canvas.width) { rafRef.current = requestAnimationFrame(animate); return }
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      t += 0.012

      // Stars
      stars.forEach(s => {
        const o = 0.3 + 0.7 * (0.5 + 0.5 * Math.sin(t * s.speed + s.phase))
        ctx.beginPath()
        ctx.arc(s.x * canvas.width, s.y * canvas.height, s.r, 0, Math.PI * 2)
        ctx.fillStyle = s.color.replace('white', `rgba(255,255,255,${o})`)
        if (s.color !== 'white') {
          ctx.globalAlpha = o
          ctx.fillStyle = s.color
        } else {
          ctx.globalAlpha = o
          ctx.fillStyle = 'white'
        }
        ctx.fill()
        ctx.globalAlpha = 1
      })

      // Shooting stars
      shoots.forEach(s => {
        const age = (t * 0.15 + s.delay) % 10
        if (age > 0.3 && age < 1.8) {
          const progress = (age - 0.3) / 1.5
          const ox = (s.x + s.vx * progress * 60) * canvas.width
          const oy = (s.y + s.vy * progress * 60) * canvas.height
          const alpha = progress < 0.2 ? progress / 0.2 : progress > 0.8 ? (1 - progress) / 0.2 : 1
          const grad = ctx.createLinearGradient(ox, oy, ox - s.len * canvas.width, oy - s.len * canvas.height * 0.3)
          grad.addColorStop(0, `rgba(255,255,255,${alpha * 0.9})`)
          grad.addColorStop(1, 'rgba(255,255,255,0)')
          ctx.beginPath()
          ctx.moveTo(ox, oy)
          ctx.lineTo(ox - s.len * canvas.width, oy - s.len * canvas.height * 0.3)
          ctx.strokeStyle = grad
          ctx.lineWidth = 1.5
          ctx.stroke()
        }
      })

      rafRef.current = requestAnimationFrame(animate)
    }
    animate()

    return () => {
      cancelAnimationFrame(rafRef.current)
      ro.disconnect()
    }
  }, [])

  // Mouse parallax
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const onMove = (e) => {
      const r = el.getBoundingClientRect()
      setMouse({ x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height })
    }
    const onLeave = () => setMouse({ x: 0.5, y: 0.5 })
    el.addEventListener('mousemove', onMove)
    el.addEventListener('mouseleave', onLeave)
    return () => { el.removeEventListener('mousemove', onMove); el.removeEventListener('mouseleave', onLeave) }
  }, [])

  // Mount stagger
  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 80)
    return () => clearTimeout(t)
  }, [])

  const tx = (mouse.x - 0.5) * 18
  const ty = (mouse.y - 0.5) * -14

  return (
    <div ref={containerRef} style={{
      position: 'relative', width: '100%',
      minHeight: 'calc(100vh - 120px)',
      overflow: 'hidden', borderRadius: 16,
      background: 'radial-gradient(ellipse 120% 100% at 50% 50%, #07122e 0%, #040b1e 50%, #020710 100%)',
      perspective: '1100px',
    }}>
      <style>{CSS}</style>

      {/* Starfield canvas */}
      <canvas ref={canvasRef} style={{
        position: 'absolute', inset: 0, width: '100%', height: '100%', zIndex: 0, pointerEvents: 'none',
      }}/>

      {/* Nebula clouds */}
      <div style={{ position: 'absolute', inset: 0, zIndex: 1, pointerEvents: 'none', overflow: 'hidden' }}>
        {[
          { color: '#1e3a8a', x: '20%', y: '20%', w: '55%', h: '50%', delay: '0s' },
          { color: '#4c1d95', x: '55%', y: '30%', w: '50%', h: '45%', delay: '3s' },
          { color: '#0f4c5c', x: '10%', y: '50%', w: '45%', h: '50%', delay: '6s' },
          { color: '#7c2d12', x: '60%', y: '60%', w: '40%', h: '40%', delay: '2s' },
        ].map((n, i) => (
          <div key={i} style={{
            position: 'absolute', left: n.x, top: n.y, width: n.w, height: n.h,
            background: `radial-gradient(ellipse at 50% 50%, ${n.color}28 0%, transparent 70%)`,
            animation: `nebulaDrift ${18 + i * 4}s ease-in-out infinite`,
            animationDelay: n.delay,
          }}/>
        ))}
      </div>

      {/* Aurora streaks */}
      <div style={{ position: 'absolute', inset: 0, zIndex: 2, pointerEvents: 'none', overflow: 'hidden' }}>
        {[
          { color: 'rgba(0,200,255,', top: '5%', w: '70%', left: '15%', delay: '0s' },
          { color: 'rgba(120,50,255,', top: '12%', w: '50%', left: '30%', delay: '4s' },
          { color: 'rgba(0,255,180,', top: '3%', w: '40%', left: '50%', delay: '8s' },
        ].map((a, i) => (
          <div key={i} style={{
            position: 'absolute', top: a.top, left: a.left, width: a.w, height: '18%',
            background: `linear-gradient(180deg, ${a.color}0) 0%, ${a.color}0.18) 30%, ${a.color}0.08) 70%, ${a.color}0) 100%)`,
            filter: 'blur(18px)',
            animation: `auroraShift ${12 + i * 3}s ease-in-out infinite`,
            animationDelay: a.delay,
          }}/>
        ))}
      </div>

      {/* 3D SCENE — everything inside tilts with mouse */}
      <div style={{
        position: 'absolute', inset: 0,
        transformStyle: 'preserve-3d',
        transform: `rotateX(${ty}deg) rotateY(${tx}deg)`,
        transition: 'transform 0.08s linear',
        zIndex: 3,
      }}>

        {/* Deep ocean floor glow */}
        <div style={{
          position: 'absolute', bottom: '5%', left: '5%', width: '90%', height: '40%',
          background: 'radial-gradient(ellipse 80% 60% at 50% 100%, rgba(0,80,140,0.22) 0%, transparent 100%)',
          transform: 'translateZ(-80px) scale(1.1)',
          pointerEvents: 'none',
        }}/>

        {/* Wave layers */}
        <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none', transform: 'translateZ(-20px)' }}>
          <svg style={{ position: 'absolute', bottom: '10%', width: '200%', opacity: 0.14,
            animation: 'waveRoll 14s linear infinite' }}
            viewBox="0 0 1440 60" height="60" preserveAspectRatio="none">
            <path d="M0,30 C120,8 240,52 360,30 C480,8 600,52 720,30 C840,8 960,52 1080,30 C1200,8 1320,52 1440,30 L1440,60 L0,60 Z"
              fill="rgba(56,189,248,0.6)"/>
          </svg>
          <svg style={{ position: 'absolute', bottom: '6%', width: '200%', opacity: 0.1,
            animation: 'waveRoll2 20s linear infinite' }}
            viewBox="0 0 1440 50" height="50" preserveAspectRatio="none">
            <path d="M0,25 C180,5 360,45 540,25 C720,5 900,45 1080,25 C1260,5 1440,45 1440,25 L1440,50 L0,50 Z"
              fill="rgba(20,184,166,0.6)"/>
          </svg>
        </div>

        {/* Animated SVG connections */}
        <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%',
          zIndex: 4, pointerEvents: 'none', transform: 'translateZ(10px)' }}>
          <defs>
            <filter id="beamGlow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="2.5" result="blur"/>
              <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
            </filter>
            <filter id="beamGlow2" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="5" result="blur"/>
              <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
            </filter>
            {BEAMS.map(([a, b], i) => {
              const pa = PORTALS[a], pb = PORTALS[b]
              return (
                <linearGradient key={i} id={`beam${i}`} gradientUnits="userSpaceOnUse"
                  x1={`${pa.x}%`} y1={`${pa.y}%`} x2={`${pb.x}%`} y2={`${pb.y}%`}>
                  <stop offset="0%" stopColor={pa.color} stopOpacity="0.8"/>
                  <stop offset="50%" stopColor="white" stopOpacity="0.4"/>
                  <stop offset="100%" stopColor={pb.color} stopOpacity="0.8"/>
                </linearGradient>
              )
            })}
          </defs>

          {BEAMS.map(([a, b], i) => {
            const pa = PORTALS[a], pb = PORTALS[b]
            const isActive = hovered === a || hovered === b
            // Calculate path length approx for dasharray
            const dx = (pb.x - pa.x)
            const dy = (pb.y - pa.y)
            const len = Math.sqrt(dx*dx + dy*dy) * 12

            return (
              <g key={i}>
                {/* Outer glow line */}
                <line x1={`${pa.x}%`} y1={`${pa.y}%`} x2={`${pb.x}%`} y2={`${pb.y}%`}
                  stroke={`url(#beam${i})`}
                  strokeWidth={isActive ? 3 : 1.5}
                  strokeOpacity={isActive ? 0.6 : 0.2}
                  filter="url(#beamGlow2)"
                  style={{ transition: 'all 0.3s' }}
                />
                {/* Sharp line */}
                <line x1={`${pa.x}%`} y1={`${pa.y}%`} x2={`${pb.x}%`} y2={`${pb.y}%`}
                  stroke={`url(#beam${i})`}
                  strokeWidth={isActive ? 1.5 : 0.8}
                  strokeOpacity={isActive ? 0.9 : 0.35}
                  strokeDasharray={`5 ${len}`}
                  style={{
                    strokeDashoffset: 0,
                    animation: `beamFlow ${3 + i * 0.4}s linear infinite`,
                    transition: 'all 0.3s',
                  }}
                />
                {/* Traveling light particle */}
                {isActive && (
                  <circle r="3" fill="white" opacity="0.9" filter="url(#beamGlow)">
                    <animateMotion dur={`${1.5 + i * 0.2}s`} repeatCount="indefinite">
                      <mpath href={`#path${i}`}/>
                    </animateMotion>
                  </circle>
                )}
                <path id={`path${i}`} d={`M ${pa.x}% ${pa.y}% L ${pb.x}% ${pb.y}%`} fill="none" stroke="none"/>
              </g>
            )
          })}
        </svg>

        {/* Ship */}
        <div style={{
          position: 'absolute', bottom: '8%', left: 0, zIndex: 5, pointerEvents: 'none',
          transform: 'translateZ(30px)',
          animation: 'shipSail 32s linear infinite', animationDelay: '1s',
        }}>
          <ShipSVG />
        </div>
        <div style={{
          position: 'absolute', bottom: '5%', left: 0, zIndex: 5, pointerEvents: 'none',
          transform: 'translateZ(20px)',
          animation: 'shipBack 45s linear infinite', animationDelay: '18s',
        }}>
          <ShipSVG scale={0.7} opacity={0.6}/>
        </div>

        {/* Dolphins */}
        {[
          { bottom: '14%', left: '4%', delay: '3s', dur: '16s', flip: false, anim: 'beamFlow' },
          { bottom: '11%', left: '38%', delay: '8s', dur: '20s', flip: true, anim: 'beamFlow' },
          { bottom: '16%', left: '62%', delay: '0s', dur: '24s', flip: false, anim: 'beamFlow' },
        ].map((d, i) => (
          <div key={i} style={{
            position: 'absolute', bottom: d.bottom, left: d.left,
            zIndex: 6, pointerEvents: 'none', transform: 'translateZ(40px)',
            animation: `floatBob ${3 + i}s ease-in-out infinite`,
            animationDelay: d.delay,
          }}>
            <DolphinSVG flip={d.flip}/>
          </div>
        ))}

        {/* Sea emojis */}
        {[
          { e: '🦑', b: '6%', l: '5%',  z: 50, size: 24 },
          { e: '🐋', t: '36%', r: '3%', z: 30, size: 20 },
          { e: '🦀', b: '12%', l: '48%',z: 45, size: 18 },
          { e: '⚓', b: '28%', r: '22%',z: 25, size: 16 },
          { e: '🗺️', t: '8%',  l: '6%', z: 20, size: 15 },
          { e: '🐠', b: '20%', l: '28%',z: 35, size: 14 },
        ].map((s, i) => (
          <div key={i} style={{
            position: 'absolute',
            bottom: s.b, top: s.t, left: s.l, right: s.r,
            zIndex: 4, fontSize: s.size, opacity: 0.3, pointerEvents: 'none',
            transform: `translateZ(${s.z}px)`,
            animation: `floatBob ${5 + i * 0.7}s ease-in-out infinite`,
            animationDelay: `${i * 0.6}s`,
          }}>{s.e}</div>
        ))}

        {/* ── PORTALS ── */}
        {PORTALS.map((portal, i) => {
          const Icon = portal.icon
          const isHovered = hovered === i
          const isCenter = i === 0
          const size = isCenter ? 100 : 78

          return (
            <div
              key={portal.path}
              onClick={() => navigate(portal.path)}
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
              style={{
                position: 'absolute',
                left: `${portal.x}%`,
                top: `${portal.y}%`,
                zIndex: 15,
                cursor: 'pointer',
                transformStyle: 'preserve-3d',
                transform: `translate(-50%,-50%) translateZ(${isHovered ? 90 : 30}px)`,
                transition: 'transform 0.25s cubic-bezier(0.34,1.56,0.64,1)',
                opacity: mounted ? 1 : 0,
                animation: mounted ? `portalEntry 0.6s cubic-bezier(0.34,1.56,0.64,1) ${i * 0.07}s both` : 'none',
              }}
            >
              {/* Outer spinning rings — 3D */}
              <div style={{
                position: 'absolute',
                inset: -14,
                transformStyle: 'preserve-3d',
                pointerEvents: 'none',
              }}>
                {/* Ring A */}
                <div style={{
                  position: 'absolute', inset: 0, borderRadius: '50%',
                  border: `${isCenter ? 2.5 : 2}px solid ${portal.color}`,
                  opacity: isHovered ? 0.85 : 0.5,
                  boxShadow: `0 0 ${isHovered ? 12 : 6}px ${portal.glow}88`,
                  animation: `ringA ${isCenter ? 4 : 5 + i * 0.3}s linear infinite`,
                  transition: 'opacity 0.2s, box-shadow 0.2s',
                }}/>
                {/* Ring B */}
                <div style={{
                  position: 'absolute', inset: 8, borderRadius: '50%',
                  border: `${isCenter ? 2 : 1.5}px solid ${portal.glow}`,
                  opacity: isHovered ? 0.7 : 0.35,
                  boxShadow: `0 0 ${isHovered ? 8 : 4}px ${portal.glow}66`,
                  animation: `ringB ${isCenter ? 3 : 4 + i * 0.25}s linear infinite`,
                  animationDirection: 'reverse',
                  transition: 'opacity 0.2s',
                }}/>
                {/* Ring C — innermost */}
                <div style={{
                  position: 'absolute', inset: 16, borderRadius: '50%',
                  border: `1px solid ${portal.color}88`,
                  opacity: isHovered ? 0.9 : 0.4,
                  animation: `ringC ${isCenter ? 6 : 7 + i * 0.2}s linear infinite`,
                  transition: 'opacity 0.2s',
                }}/>
              </div>

              {/* Orbit particles */}
              {[0, 1, 2].map(j => (
                <div key={j} style={{
                  position: 'absolute',
                  top: '50%', left: '50%',
                  width: 5, height: 5, borderRadius: '50%',
                  background: portal.glow,
                  opacity: isHovered ? 0.9 : 0.5,
                  boxShadow: `0 0 6px ${portal.glow}`,
                  '--r': `${(size / 2) + 18 + j * 8}px`,
                  animation: `orbDot ${2.5 + j * 0.8 + i * 0.15}s linear infinite`,
                  animationDelay: `${j * 0.8}s`,
                  transform: `translateX(calc(-50%)) translateY(-50%)`,
                  transformOrigin: 'center',
                  pointerEvents: 'none',
                }}/>
              ))}

              {/* Main orb */}
              <div style={{
                width: size, height: size, borderRadius: '50%',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                gap: 5, position: 'relative', overflow: 'hidden',
                background: isHovered
                  ? `radial-gradient(circle at 30% 25%, ${portal.color}66 0%, ${portal.color}33 40%, rgba(5,10,25,0.85) 100%)`
                  : `radial-gradient(circle at 30% 25%, ${portal.color}33 0%, ${portal.color}11 40%, rgba(5,10,25,0.9) 100%)`,
                border: `${isCenter ? 2.5 : 2}px solid ${portal.color}${isHovered ? 'ff' : '88'}`,
                boxShadow: isHovered
                  ? `0 0 40px ${portal.glow}cc, 0 0 80px ${portal.glow}55, 0 0 120px ${portal.glow}22, inset 0 0 30px ${portal.color}22`
                  : `0 0 20px ${portal.glow}55, 0 0 40px ${portal.glow}22, inset 0 0 15px rgba(255,255,255,0.04)`,
                backdropFilter: 'blur(10px)',
                transition: 'all 0.25s ease',
                transform: isHovered ? 'scale(1.18)' : 'scale(1)',
              }}>
                {/* Inner shine highlight */}
                <div style={{
                  position: 'absolute', top: '8%', left: '15%',
                  width: '45%', height: '35%',
                  background: 'radial-gradient(ellipse at 50% 50%, rgba(255,255,255,0.18) 0%, transparent 100%)',
                  borderRadius: '50%',
                  pointerEvents: 'none',
                }}/>

                {/* Pulsing core glow */}
                <div style={{
                  position: 'absolute', inset: '20%', borderRadius: '50%',
                  background: `radial-gradient(circle, ${portal.color}44 0%, transparent 70%)`,
                  animation: `corePulse ${2 + i * 0.1}s ease-in-out infinite`,
                  animationDelay: `${i * 0.15}s`,
                  pointerEvents: 'none',
                }}/>

                <Icon
                  size={isCenter ? 30 : 22}
                  style={{
                    color: isHovered ? 'white' : portal.color,
                    filter: `drop-shadow(0 0 ${isHovered ? 10 : 5}px ${portal.glow})`,
                    transition: 'all 0.2s',
                    position: 'relative', zIndex: 1,
                  }}
                />
                <span style={{
                  fontSize: isCenter ? 10.5 : 9,
                  fontWeight: 700,
                  color: isHovered ? 'white' : 'rgba(210,200,180,0.92)',
                  textAlign: 'center',
                  lineHeight: 1.2,
                  maxWidth: size - 16,
                  fontFamily: 'system-ui, sans-serif',
                  letterSpacing: '0.03em',
                  textShadow: isHovered ? `0 0 12px ${portal.glow}, 0 1px 3px rgba(0,0,0,0.8)` : '0 1px 3px rgba(0,0,0,0.8)',
                  position: 'relative', zIndex: 1,
                  transition: 'all 0.2s',
                }}>
                  {portal.label}
                </span>
              </div>

              {/* Hover tooltip */}
              {isHovered && (
                <div style={{
                  position: 'absolute', top: '115%', left: '50%',
                  transform: 'translateX(-50%) translateZ(20px)',
                  background: 'rgba(5,12,30,0.96)',
                  border: `1px solid ${portal.color}88`,
                  borderRadius: 8, padding: '5px 12px',
                  fontSize: 10.5, fontWeight: 700, letterSpacing: '0.06em',
                  color: portal.glow, whiteSpace: 'nowrap',
                  fontFamily: 'system-ui,sans-serif',
                  boxShadow: `0 6px 24px rgba(0,0,0,0.7), 0 0 12px ${portal.color}44`,
                  zIndex: 40, pointerEvents: 'none',
                  textTransform: 'uppercase',
                }}>
                  ⟶ ENTER {portal.label.toUpperCase()}
                </div>
              )}
            </div>
          )
        })}

      </div>{/* end 3D scene */}

      {/* ── TITLE (outside 3D scene for stability) ── */}
      <div style={{
        position: 'absolute', top: 20, left: '50%', transform: 'translateX(-50%)',
        zIndex: 30, textAlign: 'center', pointerEvents: 'none',
        animation: 'titleFlicker 8s ease-in-out infinite',
      }}>
        <div style={{
          fontSize: 11, fontWeight: 800, letterSpacing: '0.45em',
          color: 'rgba(100,180,255,0.7)', textTransform: 'uppercase',
          fontFamily: 'system-ui,sans-serif', marginBottom: 4,
          textShadow: '0 0 20px rgba(0,150,255,0.5)',
        }}>
          ⚓ SOURCE WATER
        </div>
        <div style={{
          fontSize: 22, fontWeight: 900, letterSpacing: '0.18em',
          background: 'linear-gradient(90deg, #60a5fa, #a78bfa, #34d399, #60a5fa)',
          backgroundSize: '200% 100%',
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
          textShadow: 'none',
          fontFamily: 'Georgia, serif',
          animation: 'beamFlow 4s linear infinite',
        }}>
          NAVIGATION CHART
        </div>
        <div style={{
          fontSize: 9.5, color: 'rgba(100,160,255,0.5)', letterSpacing: '0.25em',
          marginTop: 4, fontFamily: 'system-ui,sans-serif', textTransform: 'uppercase',
        }}>
          Select a portal to navigate
        </div>
      </div>

      {/* ── COMPASS ROSE ── */}
      <div style={{
        position: 'absolute', bottom: 20, right: 24, zIndex: 30, pointerEvents: 'none',
        animation: 'compassGlow 3s ease-in-out infinite',
      }}>
        <svg width="86" height="86" viewBox="0 0 80 80">
          {/* Outer ring */}
          <circle cx="40" cy="40" r="38" fill="none" stroke="rgba(210,180,120,0.3)" strokeWidth="1"/>
          <circle cx="40" cy="40" r="32" fill="none" stroke="rgba(210,180,120,0.15)" strokeWidth="0.5"/>
          {/* Tick marks */}
          {Array.from({ length: 16 }, (_, i) => {
            const a = (i * 360 / 16) * Math.PI / 180
            const r1 = 32, r2 = i % 4 === 0 ? 26 : 30
            return <line key={i}
              x1={40 + Math.cos(a) * r1} y1={40 + Math.sin(a) * r1}
              x2={40 + Math.cos(a) * r2} y2={40 + Math.sin(a) * r2}
              stroke="rgba(210,180,120,0.5)" strokeWidth={i % 4 === 0 ? 1.5 : 0.8}/>
          })}
          {/* Cardinal points */}
          {[0, 90, 180, 270].map((deg, i) => {
            const a = (deg - 90) * Math.PI / 180
            const r = 22
            return (
              <g key={deg} transform={`rotate(${deg} 40 40)`}>
                <polygon points="40,7 37,40 40,34 43,40" fill={deg === 0 ? '#ef4444' : 'rgba(210,180,120,0.9)'}/>
                <polygon points="40,73 37,40 40,46 43,40" fill="rgba(120,100,60,0.7)"/>
              </g>
            )
          })}
          <circle cx="40" cy="40" r="5" fill="none" stroke="rgba(210,180,120,0.8)" strokeWidth="1.5"/>
          <circle cx="40" cy="40" r="2.5" fill="rgba(210,180,120,0.9)"/>
          {['N','E','S','W'].map((d, i) => {
            const a = (i * 90 - 90) * Math.PI / 180
            return <text key={d} x={40 + Math.cos(a) * 26.5} y={40 + Math.sin(a) * 26.5}
              textAnchor="middle" dominantBaseline="middle"
              fontSize="8.5" fontWeight="800" fontFamily="Georgia,serif"
              fill={d === 'N' ? '#ef4444' : 'rgba(210,180,120,0.9)'}>{d}</text>
          })}
        </svg>
      </div>

      {/* Scan sweep effect */}
      <div style={{
        position: 'absolute', inset: 0, zIndex: 28, pointerEvents: 'none', overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', top: 0, bottom: 0, width: '12%',
          background: 'linear-gradient(90deg, transparent 0%, rgba(0,150,255,0.04) 50%, transparent 100%)',
          animation: 'scanSweep 12s ease-in-out infinite',
          animationDelay: '4s',
        }}/>
      </div>
    </div>
  )
}
