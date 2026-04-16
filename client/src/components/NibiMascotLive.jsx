/**
 * NibiMascotLive — Full animated mascot for /ask-water
 *
 * Layer 1: Canvas video player with real-time chroma key (removes white bg from MP4)
 * Layer 2: Transparent PNG fallback while video loads
 * Layer 3: Glow aura, particles, breathing animation
 *
 * ~340KB total images (WebP) + one MP4 video at a time (6-13MB, streamed)
 */
import { useEffect, useRef, useState, useCallback } from 'react'

// ── Mood → video mapping ─────────────────────────────────────────────────────
const MOOD_VIDEOS = {
  idle:     '/mascot-animations/Water_Mascot_Shy-to-Love.mp4',
  wave:     '/mascot-animations/Water_Mascot_Waving.mp4',
  thinking: '/mascot-animations/Water_Mascot_Curiosity.mp4',
  happy:    '/mascot-animations/Water_Mascot_Talking_Assistant.mp4',
  blush:    '/mascot-animations/Water_Mascot_Shy-to-Love.mp4',
}

// ── Mood → static image fallback ─────────────────────────────────────────────
const MOOD_IMAGES = {
  idle:     '/mascot-images/nibi_idle.webp',
  wave:     '/mascot-images/nibi_wave.webp',
  thinking: '/mascot-images/nibi_thinking.webp',
  happy:    '/mascot-images/nibi_happy.webp',
  blush:    '/mascot-images/nibi_blush.webp',
}

// ── Mood → glow color ────────────────────────────────────────────────────────
const MOOD_GLOW = {
  idle:     { color: '#6366f1', shadow: 'rgba(99,102,241,.35)' },
  wave:     { color: '#38bdf8', shadow: 'rgba(56,189,248,.35)' },
  thinking: { color: '#a78bfa', shadow: 'rgba(167,139,250,.4)' },
  happy:    { color: '#34d399', shadow: 'rgba(52,211,153,.35)' },
  blush:    { color: '#f472b6', shadow: 'rgba(244,114,182,.35)' },
}

// ── Floating water particles ─────────────────────────────────────────────────
function WaterParticles({ mood }) {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const W = canvas.width, H = canvas.height
    const glow = MOOD_GLOW[mood] || MOOD_GLOW.idle

    const particles = Array.from({ length: 18 }, () => ({
      x: Math.random() * W,
      y: Math.random() * H,
      r: Math.random() * 3 + 1,
      vy: -(Math.random() * 0.5 + 0.15),
      vx: (Math.random() - 0.5) * 0.3,
      op: Math.random() * 0.5 + 0.15,
      phase: Math.random() * Math.PI * 2,
    }))

    let raf
    const draw = () => {
      ctx.clearRect(0, 0, W, H)
      for (const p of particles) {
        p.phase += 0.025
        p.x += p.vx + Math.sin(p.phase) * 0.2
        p.y += p.vy
        if (p.y < -10) { p.y = H + 10; p.x = Math.random() * W }
        if (p.x < -5) p.x = W + 5
        if (p.x > W + 5) p.x = -5

        ctx.beginPath()
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
        ctx.fillStyle = glow.color
        ctx.globalAlpha = p.op * (0.5 + 0.5 * Math.sin(p.phase))
        ctx.fill()

        // Tiny glow
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.r * 2.5, 0, Math.PI * 2)
        ctx.fillStyle = glow.color
        ctx.globalAlpha = p.op * 0.12
        ctx.fill()
      }
      ctx.globalAlpha = 1
      raf = requestAnimationFrame(draw)
    }
    draw()
    return () => cancelAnimationFrame(raf)
  }, [mood])

  return (
    <canvas
      ref={canvasRef}
      width={340}
      height={460}
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 3,
      }}
    />
  )
}

// ── Chroma-key canvas video renderer ─────────────────────────────────────────
function useChromaVideo(canvasRef, videoSrc, isActive) {
  const videoRef = useRef(null)
  const rafRef = useRef(null)
  const [videoReady, setVideoReady] = useState(false)

  const renderFrame = useCallback(() => {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas || video.paused || video.ended) return

    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    const w = canvas.width
    const h = canvas.height

    // Draw video frame to canvas
    ctx.drawImage(video, 0, 0, w, h)

    // Get pixel data and remove white background
    const imageData = ctx.getImageData(0, 0, w, h)
    const d = imageData.data

    for (let i = 0; i < d.length; i += 4) {
      const r = d[i], g = d[i + 1], b = d[i + 2]
      // White / near-white → transparent
      if (r > 240 && g > 240 && b > 240) {
        d[i + 3] = 0
      } else if (r > 220 && g > 220 && b > 220) {
        const brightness = (r + g + b) / 3
        d[i + 3] = Math.round(((255 - brightness) / 35) * 255)
      } else if (r > 200 && g > 200 && b > 200) {
        const brightness = (r + g + b) / 3
        d[i + 3] = Math.min(255, Math.round(((255 - brightness) / 55) * 255 + 160))
      }
    }

    ctx.putImageData(imageData, 0, 0)
    rafRef.current = requestAnimationFrame(renderFrame)
  }, [canvasRef])

  useEffect(() => {
    if (!isActive || !videoSrc) return

    const video = document.createElement('video')
    video.src = videoSrc
    video.loop = true
    video.muted = true
    video.playsInline = true
    video.crossOrigin = 'anonymous'
    video.preload = 'auto'
    videoRef.current = video

    video.addEventListener('canplay', () => {
      setVideoReady(true)
      video.play().catch(() => {})
    })

    video.addEventListener('play', () => {
      renderFrame()
    })

    video.load()

    return () => {
      cancelAnimationFrame(rafRef.current)
      video.pause()
      video.src = ''
      video.load()
      videoRef.current = null
      setVideoReady(false)
    }
  }, [videoSrc, isActive, renderFrame])

  return videoReady
}

// ── Main component ───────────────────────────────────────────────────────────
export default function NibiMascotLive({ mood = 'idle', size = 320 }) {
  const canvasRef = useRef(null)
  const [prevMood, setPrevMood] = useState(mood)
  const [transitioning, setTransitioning] = useState(false)
  const [bounce, setBounce] = useState(false)

  const videoSrc = MOOD_VIDEOS[mood] || MOOD_VIDEOS.idle
  const fallbackImg = MOOD_IMAGES[mood] || MOOD_IMAGES.idle
  const glow = MOOD_GLOW[mood] || MOOD_GLOW.idle
  const videoReady = useChromaVideo(canvasRef, videoSrc, true)

  // Mood change → bounce + transition
  useEffect(() => {
    if (mood === prevMood) return
    setTransitioning(true)
    setBounce(true)
    const t1 = setTimeout(() => {
      setPrevMood(mood)
      setTransitioning(false)
    }, 250)
    const t2 = setTimeout(() => setBounce(false), 500)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [mood, prevMood])

  const W = size
  const H = size * 1.35

  return (
    <div
      style={{
        width: W,
        height: H,
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {/* Glow aura behind mascot */}
      <div
        style={{
          position: 'absolute',
          width: '70%',
          height: '60%',
          top: '18%',
          left: '15%',
          borderRadius: '50%',
          background: `radial-gradient(ellipse, ${glow.shadow} 0%, transparent 70%)`,
          filter: 'blur(20px)',
          transition: 'background 0.6s ease',
          zIndex: 0,
          animation: 'glowPulse 3s ease-in-out infinite',
        }}
      />

      {/* Ground shadow */}
      <div
        style={{
          position: 'absolute',
          bottom: '4%',
          left: '20%',
          width: '60%',
          height: 12,
          borderRadius: '50%',
          background: 'rgba(0,0,0,.25)',
          filter: 'blur(8px)',
          zIndex: 0,
        }}
      />

      {/* Mascot container — breathing + float animation */}
      <div
        style={{
          position: 'relative',
          width: '88%',
          height: '88%',
          zIndex: 2,
          animation: bounce
            ? 'nibiBounce 0.5s cubic-bezier(0.34, 1.8, 0.64, 1)'
            : 'nibiBreathing 3.5s ease-in-out infinite',
          transition: 'transform 0.3s ease',
        }}
      >
        {/* Video canvas (chroma-keyed) — primary when loaded */}
        <canvas
          ref={canvasRef}
          width={400}
          height={540}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            position: 'absolute',
            inset: 0,
            opacity: videoReady ? 1 : 0,
            transition: 'opacity 0.4s ease-in-out',
            zIndex: 2,
          }}
        />

        {/* PNG fallback — shows while video loads */}
        <picture
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'absolute',
            inset: 0,
            opacity: videoReady ? 0 : 1,
            transition: 'opacity 0.4s ease-in-out',
            zIndex: 1,
          }}
        >
          <img
            src={fallbackImg}
            alt="Nibi the water mascot"
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'contain',
              pointerEvents: 'none',
              userSelect: 'none',
            }}
            draggable={false}
          />
        </picture>
      </div>

      {/* Floating water particles */}
      <WaterParticles mood={mood} />

      <style>{`
        @keyframes nibiBreathing {
          0%, 100% { transform: translateY(0) scale(1); }
          50% { transform: translateY(-8px) scale(1.025); }
        }
        @keyframes nibiBounce {
          0% { transform: scale(1); }
          30% { transform: scale(0.92) translateY(4px); }
          60% { transform: scale(1.08) translateY(-12px); }
          80% { transform: scale(0.98) translateY(-2px); }
          100% { transform: scale(1) translateY(0); }
        }
        @keyframes glowPulse {
          0%, 100% { opacity: 0.6; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.08); }
        }
      `}</style>
    </div>
  )
}
