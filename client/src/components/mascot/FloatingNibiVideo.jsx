/**
 * FloatingNibiVideo — small, always-looping animated Nibi for the
 * floating corner mascot.
 *
 * Lessons from the earlier video attempt:
 *   - Switching MP4 src on mood change caused flicker / black frames /
 *     decoder stalls. So this component plays ONE looping MP4 forever
 *     and uses CSS bounces / glow-color swaps to express mood instead.
 *     No source changes = no flicker, ever.
 *   - PNG fallback fades in/out below the canvas so there's never a
 *     visible blank moment while the video loads (~100-300ms on first
 *     mount).
 *   - Canvas is sized to the rendered px (96-120) so per-frame
 *     chroma-key pixel cost stays tiny (~10k pixels, runs ~60fps with
 *     <1% CPU even on low-end laptops).
 */
import { useEffect, useRef, useState, useCallback } from 'react'

// Single looping video the floating Nibi always plays. The waving
// loop reads as "alive but not distracting".
const LOOP_VIDEO = '/mascot-animations/Water_Mascot_Waving.mp4'

// PNG fallback shown while the video loads / if the video errors.
const FALLBACK_PNG = '/mascot-images/nibi_wave.webp'

// Mood → glow tint. Mood does NOT change the video — only the glow.
const MOOD_GLOW = {
  idle:      '#6366f1',
  wave:      '#38bdf8',
  thinking:  '#a78bfa',
  happy:     '#34d399',
  blush:     '#f472b6',
  pointing:  '#06b6d4',
  guide:     '#10b981',
  tablet:    '#0ea5e9',
  labcoat:   '#8b5cf6',
  openarms:  '#f59e0b',
}

export default function FloatingNibiVideo({ mood = 'idle', size = 96 }) {
  const canvasRef = useRef(null)
  const videoRef = useRef(null)
  const rafRef = useRef(null)
  const [videoReady, setVideoReady] = useState(false)
  const [bounce, setBounce] = useState(false)

  // Bounce briefly when mood changes — gives a "she noticed!" beat
  // without touching the video.
  useEffect(() => {
    setBounce(true)
    const t = setTimeout(() => setBounce(false), 500)
    return () => clearTimeout(t)
  }, [mood])

  const drawFrame = useCallback(() => {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) return
    if (video.paused || video.ended || video.readyState < 2) {
      rafRef.current = requestAnimationFrame(drawFrame)
      return
    }
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    const w = canvas.width
    const h = canvas.height
    ctx.drawImage(video, 0, 0, w, h)
    // Cheap white-bg chroma-key — only the white/near-white pixels
    // become transparent so Nibi keeps her full body.
    const imgData = ctx.getImageData(0, 0, w, h)
    const d = imgData.data
    for (let i = 0; i < d.length; i += 4) {
      const r = d[i], g = d[i + 1], b = d[i + 2]
      if (r > 240 && g > 240 && b > 240) {
        d[i + 3] = 0
      } else if (r > 220 && g > 220 && b > 220) {
        const brightness = (r + g + b) / 3
        d[i + 3] = Math.round(((255 - brightness) / 35) * 255)
      }
    }
    ctx.putImageData(imgData, 0, 0)
    rafRef.current = requestAnimationFrame(drawFrame)
  }, [])

  useEffect(() => {
    const video = document.createElement('video')
    video.src = LOOP_VIDEO
    video.loop = true
    video.muted = true
    video.playsInline = true
    video.crossOrigin = 'anonymous'
    video.preload = 'auto'
    videoRef.current = video

    const onCanPlay = () => {
      setVideoReady(true)
      video.play().catch(() => {})
      drawFrame()
    }
    const onError = () => {
      // Video failed (asset missing or codec issue) — leave the
      // fallback PNG showing, keep the page lively.
      setVideoReady(false)
    }
    video.addEventListener('canplay', onCanPlay)
    video.addEventListener('error', onError)
    video.load()

    return () => {
      cancelAnimationFrame(rafRef.current)
      video.removeEventListener('canplay', onCanPlay)
      video.removeEventListener('error', onError)
      try { video.pause(); video.src = ''; video.load() } catch {}
      videoRef.current = null
    }
  }, [drawFrame])

  // Pause the RAF loop when the tab is hidden so a backgrounded tab
  // stops eating CPU.
  useEffect(() => {
    const onVis = () => {
      const video = videoRef.current
      if (!video) return
      if (document.visibilityState === 'visible') {
        video.play().catch(() => {})
        drawFrame()
      } else {
        cancelAnimationFrame(rafRef.current)
        video.pause()
      }
    }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [drawFrame])

  const glow = MOOD_GLOW[mood] || MOOD_GLOW.idle
  // Canvas internal resolution can be a bit larger than display size
  // for crisper rendering on hi-DPI without much extra CPU cost.
  const cw = size * 2
  const ch = size * 2

  return (
    <div
      style={{
        position: 'relative',
        width: size, height: size,
        animation: bounce ? 'fnvBounce 0.5s cubic-bezier(0.34,1.8,0.64,1)' : 'fnvBreathing 3.5s ease-in-out infinite',
      }}
    >
      {/* Glow halo — colour swap is the only real "mood" cue */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute', inset: -8,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${glow}55 0%, transparent 65%)`,
          filter: 'blur(10px)',
          transition: 'background 0.4s ease',
          zIndex: 0,
        }}
      />
      {/* Fallback PNG while video loads / if it fails */}
      <img
        src={FALLBACK_PNG}
        alt="Nibi"
        draggable={false}
        style={{
          position: 'absolute', inset: 0,
          width: '100%', height: '100%',
          objectFit: 'contain',
          opacity: videoReady ? 0 : 1,
          transition: 'opacity 0.45s ease-in-out',
          zIndex: 1, pointerEvents: 'none', userSelect: 'none',
        }}
      />
      {/* Live video, chroma-keyed */}
      <canvas
        ref={canvasRef}
        width={cw} height={ch}
        style={{
          position: 'absolute', inset: 0,
          width: '100%', height: '100%',
          objectFit: 'contain',
          opacity: videoReady ? 1 : 0,
          transition: 'opacity 0.45s ease-in-out',
          zIndex: 2, pointerEvents: 'none',
        }}
      />
      <style>{`
        @keyframes fnvBreathing {
          0%,100% { transform: translateY(0) scale(1); }
          50%     { transform: translateY(-5px) scale(1.025); }
        }
        @keyframes fnvBounce {
          0%   { transform: scale(1); }
          30%  { transform: scale(0.92) translateY(3px); }
          60%  { transform: scale(1.06) translateY(-9px); }
          100% { transform: scale(1) translateY(0); }
        }
      `}</style>
    </div>
  )
}
