/**
 * NibiMascotImage — Lightweight PNG/WebP mascot for /ask-water
 * Uses optimized static images with CSS animations for subtle motion.
 * ~83KB total for all 5 moods (WebP) with PNG fallback.
 */
import { useState, useEffect, useRef } from 'react'

const MOOD_IMAGES = {
  idle:     { webp: '/mascot-images/nibi_idle.webp',     png: '/mascot-images/nibi_idle.png' },
  wave:     { webp: '/mascot-images/nibi_wave.webp',     png: '/mascot-images/nibi_wave.png' },
  thinking: { webp: '/mascot-images/nibi_thinking.webp', png: '/mascot-images/nibi_thinking.png' },
  happy:    { webp: '/mascot-images/nibi_happy.webp',    png: '/mascot-images/nibi_happy.png' },
  blush:    { webp: '/mascot-images/nibi_blush.webp',    png: '/mascot-images/nibi_blush.png' },
  openarms: { webp: '/mascot-images/nibi_openarms.webp', png: '/mascot-images/nibi_openarms.png' },
  jumping:  { webp: '/mascot-images/nibi_jumping.webp',  png: '/mascot-images/nibi_jumping.png' },
  tablet:   { webp: '/mascot-images/nibi_tablet.webp',   png: '/mascot-images/nibi_tablet.png' },
  walking:  { webp: '/mascot-images/nibi_walking.webp',  png: '/mascot-images/nibi_walking.png' },
  spinning: { webp: '/mascot-images/nibi_spinning.webp', png: '/mascot-images/nibi_spinning.png' },
  talking:  { webp: '/mascot-images/nibi_talking.webp',  png: '/mascot-images/nibi_talking.png' },
  guide:    { webp: '/mascot-images/nibi_guide.webp',    png: '/mascot-images/nibi_guide.png' },
  labcoat:  { webp: '/mascot-images/nibi_labcoat.webp',  png: '/mascot-images/nibi_labcoat.png' },
  pointing: { webp: '/mascot-images/nibi_pointing.webp', png: '/mascot-images/nibi_pointing.png' },
  trophy:   { webp: '/mascot-images/nibi_trophy.webp',   png: '/mascot-images/nibi_trophy.png' },
  rainy:    { webp: '/mascot-images/nibi_rainy.webp',    png: '/mascot-images/nibi_rainy.png' },
}

export default function NibiMascotImage({ mood = 'idle', size = 320 }) {
  const [current, setCurrent] = useState(mood)
  const [fading, setFading] = useState(false)
  const prevMood = useRef(mood)

  // Smooth crossfade on mood change
  useEffect(() => {
    if (mood === prevMood.current) return
    prevMood.current = mood
    setFading(true)
    const t = setTimeout(() => {
      setCurrent(mood)
      setFading(false)
    }, 200)
    return () => clearTimeout(t)
  }, [mood])

  const images = MOOD_IMAGES[current] || MOOD_IMAGES.idle

  return (
    <div
      style={{
        width: size,
        height: size * 1.35,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        borderRadius: 16,
        overflow: 'hidden',
        background: 'rgba(99,102,241,.06)',
      }}
    >
      <picture
        style={{
          width: '85%',
          height: '85%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          animation: mood === 'thinking'
            ? 'nibiThink 1.5s ease-in-out infinite'
            : mood === 'happy' || mood === 'wave' || mood === 'talking' || mood === 'openarms'
              ? 'nibiTalk 0.4s ease-in-out infinite'
              : mood === 'jumping'
                ? 'nibiJump 0.9s ease-in-out infinite'
                : mood === 'walking'
                  ? 'nibiWalk 1.2s ease-in-out infinite'
                  : mood === 'spinning'
                    ? 'nibiSpin 4s linear infinite'
                    : 'nibiFloat 3s ease-in-out infinite',
          opacity: fading ? 0.4 : 1,
          transition: 'opacity 0.2s ease-in-out',
        }}
      >
        <source srcSet={images.webp} type="image/webp" />
        <img
          src={images.png}
          alt={`Nibi the water mascot — ${current}`}
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

      <style>{`
        @keyframes nibiFloat {
          0%, 100% { transform: translateY(0) scale(1); }
          50% { transform: translateY(-6px) scale(1.02); }
        }
        @keyframes nibiThink {
          0%, 100% { transform: translateY(0) rotate(0deg); }
          25% { transform: translateY(-3px) rotate(-2deg); }
          75% { transform: translateY(-3px) rotate(2deg); }
        }
        @keyframes nibiTalk {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.03); }
        }
        @keyframes nibiJump {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-14px); }
        }
        @keyframes nibiWalk {
          0%, 100% { transform: translateX(0) rotate(0deg); }
          25% { transform: translateX(-3px) rotate(-1deg); }
          75% { transform: translateX(3px) rotate(1deg); }
        }
        @keyframes nibiSpin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}
