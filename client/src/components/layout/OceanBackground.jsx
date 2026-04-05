import React, { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'

export default function OceanBackground() {
  const canvasRef = useRef(null)
  const location = useLocation()

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    let raf

    const resize = () => {
      canvas.width = canvas.offsetWidth
      canvas.height = canvas.offsetHeight
    }
    resize()
    window.addEventListener('resize', resize)

    // Bubbles
    const bubbles = Array.from({ length: 18 }, () => ({
      x: Math.random() * canvas.width,
      y: canvas.height + Math.random() * 300,
      r: 2 + Math.random() * 8,
      speed: 0.3 + Math.random() * 0.7,
      drift: (Math.random() - 0.5) * 0.4,
      opacity: 0.2 + Math.random() * 0.3,
    }))

    // Fish
    const fish = Array.from({ length: 4 }, (_, i) => ({
      x: -100 - i * 300,
      y: 40 + Math.random() * (300),
      speed: 0.4 + Math.random() * 0.6,
      size: 8 + Math.random() * 12,
      color: `hsl(${195 + Math.random() * 40}, 70%, ${55 + Math.random() * 20}%)`,
      wobble: Math.random() * Math.PI * 2,
    }))

    // Seaweed
    const weeds = Array.from({ length: 5 }, (_, i) => ({
      x: 60 + i * (canvas.width / 5),
      phase: Math.random() * Math.PI * 2,
      height: 30 + Math.random() * 25,
      segments: 5,
    }))

    let t = 0
    const draw = () => {
      t += 0.012
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      // Bottom seaweed strip
      const h = canvas.height
      weeds.forEach(w => {
        ctx.save()
        ctx.strokeStyle = 'rgba(20,184,166,0.18)'
        ctx.lineWidth = 3
        ctx.lineCap = 'round'
        ctx.beginPath()
        ctx.moveTo(w.x, h)
        for (let s = 0; s < w.segments; s++) {
          const sy = h - (s / w.segments) * w.height
          const sx = w.x + Math.sin(t + w.phase + s * 0.8) * 6
          ctx.lineTo(sx, sy)
        }
        ctx.stroke()
        ctx.restore()
      })

      // Bubbles
      bubbles.forEach(b => {
        b.y -= b.speed
        b.x += b.drift
        if (b.y < -b.r) { b.y = h + b.r; b.x = Math.random() * canvas.width }
        ctx.beginPath()
        ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2)
        ctx.strokeStyle = `rgba(56,189,248,${b.opacity})`
        ctx.lineWidth = 1
        ctx.stroke()
        // shine
        ctx.beginPath()
        ctx.arc(b.x - b.r * 0.3, b.y - b.r * 0.3, b.r * 0.3, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(255,255,255,${b.opacity * 0.5})`
        ctx.fill()
      })

      // Fish
      fish.forEach(f => {
        f.wobble += 0.05
        f.x += f.speed
        if (f.x > canvas.width + 150) f.x = -150
        const wy = Math.sin(f.wobble) * 2
        ctx.save()
        ctx.translate(f.x, f.y + wy)
        // Body
        ctx.beginPath()
        ctx.ellipse(0, 0, f.size, f.size * 0.45, 0, 0, Math.PI * 2)
        ctx.fillStyle = f.color
        ctx.globalAlpha = 0.55
        ctx.fill()
        // Tail
        ctx.beginPath()
        ctx.moveTo(-f.size, 0)
        const tailWag = Math.sin(f.wobble * 2) * f.size * 0.4
        ctx.lineTo(-f.size * 1.7, -f.size * 0.4 + tailWag)
        ctx.lineTo(-f.size * 1.7, f.size * 0.4 + tailWag)
        ctx.closePath()
        ctx.fill()
        // Eye
        ctx.globalAlpha = 0.8
        ctx.beginPath()
        ctx.arc(f.size * 0.5, -f.size * 0.1, f.size * 0.15, 0, Math.PI * 2)
        ctx.fillStyle = '#0c4a6e'
        ctx.fill()
        ctx.restore()
      })

      ctx.globalAlpha = 1
      raf = requestAnimationFrame(draw)
    }
    draw()

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none"
      style={{ zIndex: 0, opacity: 0.45, width: '100%', height: '100%' }}
    />
  )
}
