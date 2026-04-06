import React, { useEffect, useRef } from 'react'

export default function OceanBackground() {
  const canvasRef = useRef(null)
  const mouseRef = useRef({ x: -999, y: -999 })

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    let raf, t = 0

    const resize = () => {
      canvas.width = canvas.offsetWidth
      canvas.height = canvas.offsetHeight
    }
    resize()
    window.addEventListener('resize', resize)

    const onMove = (e) => {
      const rect = canvas.getBoundingClientRect()
      mouseRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top }
    }
    window.addEventListener('mousemove', onMove)

    // ── Cursor ripples (mouse-reactive)
    const ripples = []
    const addRipple = (x, y) => {
      ripples.push({ x, y, r: 0, maxR: 60 + Math.random() * 40, life: 1, speed: 0.8 + Math.random() * 0.4 })
    }
    const rippleInterval = setInterval(() => {
      const m = mouseRef.current
      if (m.x > 0) addRipple(m.x + (Math.random() - 0.5) * 20, m.y + (Math.random() - 0.5) * 20)
    }, 220)

    // ── Bioluminescent particles
    const particles = Array.from({ length: 55 }, () => ({
      x: Math.random() * 1920,
      y: Math.random() * 1080,
      r: 1.5 + Math.random() * 3,
      vx: (Math.random() - 0.5) * 0.25,
      vy: -0.15 - Math.random() * 0.3,
      hue: 180 + Math.random() * 60,
      phase: Math.random() * Math.PI * 2,
      pulse: 0.5 + Math.random() * 2,
    }))

    // ── Fish (richer variety)
    const fishColors = [
      ['#38bdf8','#0369a1'], ['#2dd4bf','#0f766e'], ['#a78bfa','#6d28d9'],
      ['#fb7185','#be185d'], ['#f59e0b','#b45309'], ['#6ee7b7','#065f46'],
    ]
    const fish = Array.from({ length: 8 }, (_, i) => ({
      x: -200 - i * 250,
      y: 60 + Math.random() * (canvas.height * 0.55),
      speed: 0.5 + Math.random() * 0.8,
      size: 10 + Math.random() * 16,
      colors: fishColors[i % fishColors.length],
      wobble: Math.random() * Math.PI * 2,
      depth: 0.4 + Math.random() * 0.6,
      dir: 1,
    }))

    // ── Jellyfish
    const jellies = Array.from({ length: 5 }, () => ({
      x: Math.random() * 1920,
      y: 100 + Math.random() * 400,
      r: 18 + Math.random() * 20,
      phase: Math.random() * Math.PI * 2,
      speed: 0.08 + Math.random() * 0.12,
      hue: 200 + Math.random() * 80,
      drift: (Math.random() - 0.5) * 0.3,
      tentacles: 5 + Math.floor(Math.random() * 4),
    }))

    // ── Bubbles
    const bubbles = Array.from({ length: 25 }, () => ({
      x: Math.random() * 1920,
      y: 1080 + Math.random() * 400,
      r: 2 + Math.random() * 7,
      speed: 0.3 + Math.random() * 0.6,
      drift: (Math.random() - 0.5) * 0.35,
      phase: Math.random() * Math.PI * 2,
    }))

    // ── Seaweed clusters
    const weeds = Array.from({ length: 9 }, (_, i) => ({
      x: 40 + i * (1920 / 9),
      phase: Math.random() * Math.PI * 2,
      height: 35 + Math.random() * 35,
      width: 4 + Math.random() * 3,
      color: `hsl(${155 + Math.random() * 30}, 60%, ${30 + Math.random() * 20}%)`,
      segments: 6 + Math.floor(Math.random() * 3),
    }))

    // ── Floating data nodes (water quality data vibe)
    const nodes = Array.from({ length: 12 }, () => ({
      x: Math.random() * 1920,
      y: Math.random() * 700,
      r: 3 + Math.random() * 4,
      phase: Math.random() * Math.PI * 2,
      speed: 0.3 + Math.random() * 0.5,
      connected: Math.floor(Math.random() * 12),
    }))

    const draw = () => {
      t += 0.01
      const W = canvas.width, H = canvas.height
      ctx.clearRect(0, 0, W, H)

      // ── Animated wave gradient at bottom
      const waveGrad = ctx.createLinearGradient(0, H * 0.7, 0, H)
      waveGrad.addColorStop(0, 'rgba(14,165,233,0)')
      waveGrad.addColorStop(0.5, 'rgba(14,165,233,0.04)')
      waveGrad.addColorStop(1, 'rgba(20,184,166,0.08)')
      ctx.fillStyle = waveGrad
      ctx.beginPath()
      ctx.moveTo(0, H)
      for (let x = 0; x <= W; x += 8) {
        const y = H * 0.75 + Math.sin(x * 0.006 + t * 1.2) * 12 + Math.sin(x * 0.012 + t * 0.7) * 7
        ctx.lineTo(x, y)
      }
      ctx.lineTo(W, H); ctx.lineTo(0, H)
      ctx.closePath(); ctx.fill()

      // ── Second wave layer
      ctx.fillStyle = 'rgba(99,102,241,0.03)'
      ctx.beginPath()
      ctx.moveTo(0, H)
      for (let x = 0; x <= W; x += 8) {
        const y = H * 0.82 + Math.sin(x * 0.008 + t * 0.9 + 1) * 10 + Math.sin(x * 0.015 + t * 1.4) * 5
        ctx.lineTo(x, y)
      }
      ctx.lineTo(W, H); ctx.lineTo(0, H)
      ctx.closePath(); ctx.fill()

      // ── Seaweed
      weeds.forEach(w => {
        ctx.save()
        ctx.strokeStyle = w.color
        ctx.lineWidth = w.width
        ctx.lineCap = 'round'
        ctx.globalAlpha = 0.25
        ctx.beginPath()
        ctx.moveTo(w.x, H)
        for (let s = 0; s < w.segments; s++) {
          const frac = s / w.segments
          const sy = H - frac * w.height
          const sx = w.x + Math.sin(t * 0.8 + w.phase + s * 0.9) * 7
          ctx.lineTo(sx, sy)
        }
        ctx.stroke()
        ctx.restore()
      })

      // ── Data nodes + connections
      ctx.save()
      ctx.globalAlpha = 0.12
      nodes.forEach((n, i) => {
        n.y -= n.speed * 0.1
        if (n.y < -20) { n.y = H + 20; n.x = Math.random() * W }
        const nx = n.x + Math.sin(t * 0.5 + n.phase) * 15
        const ny = n.y + Math.cos(t * 0.4 + n.phase) * 10
        // connection line to nearby node
        const other = nodes[n.connected]
        if (other) {
          const ox = other.x + Math.sin(t * 0.5 + other.phase) * 15
          const oy = other.y + Math.cos(t * 0.4 + other.phase) * 10
          const dist = Math.hypot(nx - ox, ny - oy)
          if (dist < 280) {
            ctx.strokeStyle = `rgba(99,102,241,${0.25 - dist / 1200})`
            ctx.lineWidth = 0.8
            ctx.beginPath(); ctx.moveTo(nx, ny); ctx.lineTo(ox, oy); ctx.stroke()
          }
        }
        ctx.fillStyle = '#818cf8'
        ctx.beginPath(); ctx.arc(nx, ny, n.r, 0, Math.PI * 2); ctx.fill()
        // pulse ring
        const pr = n.r + 4 + Math.sin(t * 2 + n.phase) * 3
        ctx.strokeStyle = 'rgba(129,140,248,0.4)'
        ctx.lineWidth = 0.8
        ctx.beginPath(); ctx.arc(nx, ny, pr, 0, Math.PI * 2); ctx.stroke()
      })
      ctx.restore()

      // ── Bioluminescent particles
      particles.forEach(p => {
        p.x += p.vx + Math.sin(t * 0.8 + p.phase) * 0.15
        p.y += p.vy
        if (p.y < -10) { p.y = H + 10; p.x = Math.random() * W }
        if (p.x < -10) p.x = W + 10
        if (p.x > W + 10) p.x = -10
        const glow = 0.3 + Math.sin(t * p.pulse + p.phase) * 0.25
        const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 3)
        grad.addColorStop(0, `hsla(${p.hue},85%,75%,${glow})`)
        grad.addColorStop(1, `hsla(${p.hue},85%,65%,0)`)
        ctx.fillStyle = grad
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r * 3, 0, Math.PI * 2); ctx.fill()
      })

      // ── Bubbles
      bubbles.forEach(b => {
        b.y -= b.speed
        b.x += b.drift + Math.sin(t * 1.5 + b.phase) * 0.3
        if (b.y < -b.r) { b.y = H + b.r; b.x = Math.random() * W }
        ctx.save()
        ctx.globalAlpha = 0.28
        const grad = ctx.createRadialGradient(b.x - b.r * 0.3, b.y - b.r * 0.3, b.r * 0.1, b.x, b.y, b.r)
        grad.addColorStop(0, 'rgba(255,255,255,0.9)')
        grad.addColorStop(0.4, 'rgba(56,189,248,0.5)')
        grad.addColorStop(1, 'rgba(56,189,248,0.1)')
        ctx.fillStyle = grad
        ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2); ctx.fill()
        ctx.strokeStyle = 'rgba(56,189,248,0.5)'; ctx.lineWidth = 0.7
        ctx.stroke()
        ctx.restore()
      })

      // ── Jellyfish
      jellies.forEach(j => {
        j.phase += j.speed * 0.04
        j.y -= 0.1 + Math.sin(j.phase) * 0.08
        j.x += j.drift + Math.sin(j.phase * 0.3) * 0.2
        if (j.y < -j.r * 4) { j.y = H * 0.6 + Math.random() * H * 0.3; j.x = Math.random() * W }
        if (j.x < -50) j.x = W + 50; if (j.x > W + 50) j.x = -50

        const pulse = 0.7 + Math.sin(j.phase * 2) * 0.3
        const rx = j.r * pulse, ry = j.r * (1 - pulse * 0.2)

        ctx.save()
        ctx.globalAlpha = 0.22
        // Bell
        const bellGrad = ctx.createRadialGradient(j.x, j.y - ry * 0.3, 0, j.x, j.y, rx * 1.5)
        bellGrad.addColorStop(0, `hsla(${j.hue},80%,80%,0.8)`)
        bellGrad.addColorStop(0.6, `hsla(${j.hue},70%,65%,0.4)`)
        bellGrad.addColorStop(1, `hsla(${j.hue},60%,50%,0)`)
        ctx.fillStyle = bellGrad
        ctx.beginPath()
        ctx.ellipse(j.x, j.y, rx, ry, 0, Math.PI, 0) // upper half dome
        ctx.fill()
        // Tentacles
        for (let k = 0; k < j.tentacles; k++) {
          const tx = j.x + (k - j.tentacles / 2 + 0.5) * (rx * 2 / j.tentacles)
          ctx.strokeStyle = `hsla(${j.hue},70%,75%,0.5)`
          ctx.lineWidth = 0.8
          ctx.beginPath(); ctx.moveTo(tx, j.y)
          for (let s = 0; s < 5; s++) {
            const ty = j.y + s * 8
            const twx = tx + Math.sin(j.phase * 1.5 + k + s * 0.7) * 5
            ctx.lineTo(twx, ty)
          }
          ctx.stroke()
        }
        ctx.restore()
      })

      // ── Fish
      fish.forEach(f => {
        f.wobble += 0.045
        f.x += f.speed * f.dir
        if (f.x > W + 200) { f.x = -200; f.y = 50 + Math.random() * (H * 0.55) }
        const wy = Math.sin(f.wobble) * 2.5
        ctx.save()
        ctx.translate(f.x, f.y + wy)
        if (f.dir < 0) ctx.scale(-1, 1)
        ctx.globalAlpha = 0.5 * f.depth

        // Body shadow
        ctx.shadowColor = f.colors[1]; ctx.shadowBlur = 8
        ctx.fillStyle = f.colors[0]
        ctx.beginPath()
        ctx.ellipse(0, 0, f.size, f.size * 0.42, 0, 0, Math.PI * 2)
        ctx.fill()
        ctx.shadowBlur = 0

        // Fin stripe
        ctx.fillStyle = f.colors[1] + '80'
        ctx.beginPath()
        ctx.ellipse(0, -f.size * 0.15, f.size * 0.6, f.size * 0.12, 0, 0, Math.PI * 2)
        ctx.fill()

        // Tail
        const tw = Math.sin(f.wobble * 2) * f.size * 0.45
        ctx.fillStyle = f.colors[1]
        ctx.beginPath()
        ctx.moveTo(-f.size, 0)
        ctx.lineTo(-f.size * 1.75, -f.size * 0.4 + tw)
        ctx.lineTo(-f.size * 1.75, f.size * 0.4 + tw)
        ctx.closePath(); ctx.fill()

        // Pectoral fin
        ctx.fillStyle = f.colors[0] + 'aa'
        ctx.beginPath()
        ctx.ellipse(-f.size * 0.1, f.size * 0.2, f.size * 0.4, f.size * 0.18, -0.3, 0, Math.PI * 2)
        ctx.fill()

        // Eye
        ctx.globalAlpha = 0.85 * f.depth
        ctx.fillStyle = '#0c4a6e'
        ctx.beginPath(); ctx.arc(f.size * 0.5, -f.size * 0.08, f.size * 0.14, 0, Math.PI * 2); ctx.fill()
        ctx.fillStyle = 'white'
        ctx.beginPath(); ctx.arc(f.size * 0.52, -f.size * 0.1, f.size * 0.05, 0, Math.PI * 2); ctx.fill()
        ctx.restore()
      })

      // ── Cursor ripples
      for (let i = ripples.length - 1; i >= 0; i--) {
        const rp = ripples[i]
        rp.r += rp.speed
        rp.life = 1 - rp.r / rp.maxR
        if (rp.life <= 0) { ripples.splice(i, 1); continue }
        ctx.save()
        ctx.strokeStyle = `rgba(56,189,248,${rp.life * 0.3})`
        ctx.lineWidth = 1
        ctx.beginPath(); ctx.arc(rp.x, rp.y, rp.r, 0, Math.PI * 2); ctx.stroke()
        ctx.restore()
      }

      ctx.globalAlpha = 1
      raf = requestAnimationFrame(draw)
    }
    draw()

    return () => {
      cancelAnimationFrame(raf)
      clearInterval(rippleInterval)
      window.removeEventListener('resize', resize)
      window.removeEventListener('mousemove', onMove)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none"
      style={{ zIndex: 0, opacity: 0.55, width: '100%', height: '100%' }}
    />
  )
}
