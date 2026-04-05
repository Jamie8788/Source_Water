/**
 * PageAmbience — drop this into any page to add:
 *   - floating particles
 *   - animated data grid lines
 *   - underwater shimmer
 *   - optional scan line
 *   - page-specific colour palette
 *
 * Usage:
 *   <PageAmbience variant="dashboard" />   (or "social", "map", "quiz", "analysis", "admin", "default")
 */
import { useEffect, useRef } from 'react'

const PALETTES = {
  dashboard: { orb1: 'rgba(99,102,241,0.14)', orb2: 'rgba(20,184,166,0.10)', orb3: 'rgba(139,92,246,0.08)', particle: 'rgba(99,102,241,0.5)' },
  social:    { orb1: 'rgba(236,72,153,0.12)', orb2: 'rgba(99,102,241,0.09)', orb3: 'rgba(20,184,166,0.07)', particle: 'rgba(236,72,153,0.5)' },
  map:       { orb1: 'rgba(20,184,166,0.14)', orb2: 'rgba(14,165,233,0.10)', orb3: 'rgba(99,102,241,0.08)', particle: 'rgba(20,184,166,0.5)' },
  quiz:      { orb1: 'rgba(245,158,11,0.12)', orb2: 'rgba(249,115,22,0.10)', orb3: 'rgba(239,68,68,0.07)',  particle: 'rgba(245,158,11,0.6)' },
  analysis:  { orb1: 'rgba(14,165,233,0.13)', orb2: 'rgba(99,102,241,0.10)', orb3: 'rgba(20,184,166,0.08)', particle: 'rgba(14,165,233,0.5)' },
  admin:     { orb1: 'rgba(99,102,241,0.12)', orb2: 'rgba(139,92,246,0.09)', orb3: 'rgba(236,72,153,0.07)', particle: 'rgba(99,102,241,0.5)' },
  resources: { orb1: 'rgba(16,185,129,0.12)', orb2: 'rgba(6,182,212,0.09)',  orb3: 'rgba(99,102,241,0.07)', particle: 'rgba(16,185,129,0.5)' },
  projects:  { orb1: 'rgba(249,115,22,0.12)', orb2: 'rgba(239,68,68,0.09)',  orb3: 'rgba(99,102,241,0.07)', particle: 'rgba(249,115,22,0.5)' },
  weather:   { orb1: 'rgba(14,165,233,0.14)', orb2: 'rgba(6,182,212,0.11)',  orb3: 'rgba(99,102,241,0.08)', particle: 'rgba(14,165,233,0.6)' },
  games:     { orb1: 'rgba(168,85,247,0.14)', orb2: 'rgba(99,102,241,0.10)', orb3: 'rgba(236,72,153,0.09)', particle: 'rgba(168,85,247,0.6)' },
  default:   { orb1: 'rgba(99,102,241,0.12)', orb2: 'rgba(20,184,166,0.09)', orb3: 'rgba(139,92,246,0.07)', particle: 'rgba(99,102,241,0.5)' },
}

/* Mini canvas particle system — ~12 slow-rising dots */
function ParticleCanvas({ color }) {
  const ref = useRef(null)
  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    let raf
    canvas.width = canvas.offsetWidth
    canvas.height = canvas.offsetHeight

    const N = 14
    const particles = Array.from({ length: N }, (_, i) => ({
      x: Math.random() * canvas.width,
      y: canvas.height + Math.random() * 100,
      r: 1.5 + Math.random() * 2.5,
      vy: -(0.15 + Math.random() * 0.35),
      vx: (Math.random() - 0.5) * 0.2,
      alpha: 0.3 + Math.random() * 0.4,
      delay: i * 90,
      age: 0,
    }))

    let t = 0
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      t++
      particles.forEach(p => {
        if (t < p.delay) return
        p.y += p.vy
        p.x += p.vx + Math.sin(t * 0.01 + p.r) * 0.15
        p.age++
        const fade = p.age < 40 ? p.age / 40 : p.y < 80 ? p.y / 80 : 1
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
        ctx.fillStyle = color.replace('0.5)', `${p.alpha * fade})`)
        ctx.fill()
        if (p.y < -10) {
          p.y = canvas.height + 20
          p.x = Math.random() * canvas.width
          p.age = 0
        }
      })
      raf = requestAnimationFrame(draw)
    }
    draw()
    return () => cancelAnimationFrame(raf)
  }, [color])

  return <canvas ref={ref} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}/>
}

export default function PageAmbience({ variant = 'default', scanLine = false }) {
  const p = PALETTES[variant] || PALETTES.default

  return (
    <>
      {/* Orb layer */}
      <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0, overflow: 'hidden' }}>
        {/* Orb 1 */}
        <div style={{
          position: 'absolute', width: 600, height: 600, borderRadius: '50%',
          background: `radial-gradient(circle, ${p.orb1} 0%, transparent 70%)`,
          top: '-10%', left: '5%', filter: 'blur(60px)',
          animation: 'orbDrift1 28s ease-in-out infinite',
        }}/>
        {/* Orb 2 */}
        <div style={{
          position: 'absolute', width: 450, height: 450, borderRadius: '50%',
          background: `radial-gradient(circle, ${p.orb2} 0%, transparent 70%)`,
          top: '40%', right: '-5%', filter: 'blur(60px)',
          animation: 'orbDrift2 35s ease-in-out infinite',
        }}/>
        {/* Orb 3 */}
        <div style={{
          position: 'absolute', width: 700, height: 700, borderRadius: '50%',
          background: `radial-gradient(circle, ${p.orb3} 0%, transparent 70%)`,
          bottom: '-15%', left: '30%', filter: 'blur(80px)',
          animation: 'orbDrift3 42s ease-in-out infinite',
        }}/>

        {/* Subtle grid */}
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: `
            linear-gradient(rgba(99,102,241,0.018) 1px, transparent 1px),
            linear-gradient(90deg, rgba(99,102,241,0.018) 1px, transparent 1px)
          `,
          backgroundSize: '64px 64px',
          maskImage: 'radial-gradient(ellipse 80% 80% at 50% 50%, black 20%, transparent 100%)',
        }}/>

        {/* Particle canvas */}
        <ParticleCanvas color={p.particle}/>

        {/* Scan line */}
        {scanLine && (
          <div style={{
            position: 'absolute', left: 0, right: 0, height: 2,
            background: `linear-gradient(90deg, transparent, ${p.particle.replace('0.5)', '0.7)')}, transparent)`,
            animation: 'scanDown 6s ease-in-out infinite',
          }}/>
        )}

        {/* Bottom underwater shimmer */}
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0, height: 200,
          background: `radial-gradient(ellipse 100% 100% at 50% 100%, ${p.orb2.replace('0.10)', '0.06)')} 0%, transparent 70%)`,
        }}/>
      </div>

      {/* Fish layer from Layout is global, but we can add page-specific micro-bubbles */}
    </>
  )
}
