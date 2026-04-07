/**
 * NibiMascot — SOURCE Water's animated mascot
 * "Nibi" means water in Anishinaabe language
 *
 * Props:
 *   mood: 'idle' | 'happy' | 'laugh' | 'wave' | 'blush' | 'umbrella' | 'surprised' | 'thinking'
 *   size: number (default 200)
 *   autoMood: boolean — randomly cycles moods for NPC feel (default false)
 *   angle: 'front' | 'side' | 'tilt' — perspective variant
 *   showShadow: boolean
 *   style: object
 */
import { motion, AnimatePresence } from 'framer-motion'
import { useState, useEffect, useCallback } from 'react'

const MOODS = ['idle', 'happy', 'wave', 'blush', 'laugh', 'surprised', 'thinking']

export default function NibiMascot({
  mood: propMood = 'idle',
  size = 200,
  autoMood = false,
  angle = 'front',
  showShadow = true,
  style = {},
  onClick,
}) {
  const [mood, setMood] = useState(propMood)
  const [blink, setBlink] = useState(false)
  const [laugh, setLaugh] = useState(false)

  // Sync with prop changes
  useEffect(() => { if (!autoMood) setMood(propMood) }, [propMood, autoMood])

  // Auto-blink every 3-5s
  useEffect(() => {
    const next = () => {
      setBlink(true)
      setTimeout(() => setBlink(false), 160)
    }
    const id = setInterval(next, 3000 + Math.random() * 2000)
    return () => clearInterval(id)
  }, [])

  // Auto-laugh pulse for laugh mood
  useEffect(() => {
    if (mood !== 'laugh') return
    const id = setInterval(() => {
      setLaugh(v => !v)
    }, 350)
    return () => clearInterval(id)
  }, [mood])

  // NPC auto-mood cycling
  useEffect(() => {
    if (!autoMood) return
    const cycle = () => {
      const next = MOODS[Math.floor(Math.random() * MOODS.length)]
      setMood(next)
      setTimeout(() => setMood('idle'), 2500 + Math.random() * 1500)
    }
    const id = setInterval(cycle, 5000 + Math.random() * 4000)
    return () => clearInterval(id)
  }, [autoMood])

  const eyeRy = blink || mood === 'laugh' ? 1.5 : 17
  const mouthOpen = mood === 'laugh'

  // Cheek intensity
  const cheekAlpha = { idle:0.45, happy:0.7, laugh:0.85, wave:0.55, blush:1, umbrella:0.5, surprised:0.4, thinking:0.35 }[mood] ?? 0.5

  // Mouth path
  const mouthD = {
    idle:      'M 82 148 Q 100 161 118 148',
    happy:     'M 77 145 Q 100 167 123 145',
    laugh:     'M 76 142 Q 100 172 124 142',
    wave:      'M 82 148 Q 100 162 118 148',
    blush:     'M 86 150 Q 100 159 114 150',
    umbrella:  'M 82 148 Q 100 162 118 148',
    surprised: 'M 90 148 Q 100 166 110 148',
    thinking:  'M 86 150 Q 96 156 112 154',
  }[mood] ?? 'M 82 148 Q 100 161 118 148'

  // Body float animation
  const floatAnim = {
    idle:      { y: [0, -8, 0],        transition: { duration: 3,   repeat: Infinity, ease: 'easeInOut' } },
    happy:     { y: [0, -12, 0],       transition: { duration: 0.7, repeat: Infinity, ease: 'easeInOut' } },
    laugh:     { rotate: [-4, 4, -4],  transition: { duration: 0.28, repeat: Infinity } },
    wave:      { y: [0, -7, 0],        transition: { duration: 2.2, repeat: Infinity, ease: 'easeInOut' } },
    blush:     { y: [0, -5, 0],        transition: { duration: 3.5, repeat: Infinity, ease: 'easeInOut' } },
    umbrella:  { y: [0, -9, 0],        transition: { duration: 3,   repeat: Infinity, ease: 'easeInOut' } },
    surprised: { scale: [1, 1.06, 1],  transition: { duration: 0.25, repeat: 4 } },
    thinking:  { y: [0, -4, 0], rotate: [-1, 1, -1], transition: { duration: 4, repeat: Infinity } },
  }[mood]

  // Right arm rotation (wave = windmill wave)
  const rightArmAnim = {
    idle:      { rotate: 0 },
    happy:     { rotate: [0, 18, 0],        transition: { duration: 0.6, repeat: Infinity } },
    laugh:     { rotate: [10, 30, 10],      transition: { duration: 0.3, repeat: Infinity } },
    wave:      { rotate: [0,-55,0,-55,0],   transition: { duration: 1.1, repeat: Infinity, times:[0,.25,.5,.75,1] } },
    blush:     { rotate: 15 },
    umbrella:  { rotate: -70, y: -18 },
    surprised: { rotate: [0, 35, 0],        transition: { duration: 0.3, repeat: 3 } },
    thinking:  { rotate: -10 },
  }[mood]

  // Left arm
  const leftArmAnim = {
    idle:     { rotate: 0 },
    thinking: { rotate: [0, 20, 0], transition: { duration: 1.5, repeat: Infinity } },
    laugh:    { rotate: [0, -20, 0], transition: { duration: 0.3, repeat: Infinity } },
  }[mood] ?? { rotate: 0 }

  // 3D angle via CSS perspective transform
  const angleTransform = {
    front: 'perspective(600px) rotateY(0deg)',
    side:  'perspective(600px) rotateY(28deg)',
    tilt:  'perspective(600px) rotateY(-18deg) rotateX(8deg)',
  }[angle] ?? 'none'

  const w = size
  const h = size * 1.4

  return (
    <motion.div
      onClick={onClick}
      style={{
        display: 'inline-block',
        width: w, height: h,
        cursor: onClick ? 'pointer' : 'default',
        transform: angleTransform,
        transformStyle: 'preserve-3d',
        ...style,
      }}
      animate={floatAnim}
      whileHover={onClick ? { scale: 1.06 } : {}}
    >
      <svg
        viewBox="0 0 200 280"
        width={w}
        height={h}
        style={{ overflow: 'visible' }}
      >
        <defs>
          <radialGradient id="nb-body" cx="38%" cy="28%" r="65%">
            <stop offset="0%"   stopColor="#B8DDF0"/>
            <stop offset="55%"  stopColor="#7DBDE0"/>
            <stop offset="100%" stopColor="#5498C8"/>
          </radialGradient>

          <radialGradient id="nb-shine" cx="30%" cy="20%" r="55%">
            <stop offset="0%"   stopColor="white" stopOpacity="0.55"/>
            <stop offset="100%" stopColor="white" stopOpacity="0"/>
          </radialGradient>

          <radialGradient id="nb-cheek" cx="50%" cy="50%" r="50%">
            <stop offset="0%"   stopColor="#FF9AB4" stopOpacity="1"/>
            <stop offset="100%" stopColor="#FF9AB4" stopOpacity="0"/>
          </radialGradient>

          <linearGradient id="nb-boot" x1="0%" y1="0%" x2="60%" y2="100%">
            <stop offset="0%"   stopColor="#FF96B2"/>
            <stop offset="100%" stopColor="#D4547A"/>
          </linearGradient>

          <linearGradient id="nb-sole" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%"   stopColor="#FF96B2"/>
            <stop offset="100%" stopColor="#C44070"/>
          </linearGradient>

          <radialGradient id="nb-shadow" cx="50%" cy="50%" r="50%">
            <stop offset="0%"   stopColor="#000" stopOpacity="0.18"/>
            <stop offset="100%" stopColor="#000" stopOpacity="0"/>
          </radialGradient>

          {/* Fluffy texture filter */}
          <filter id="nb-fuzz" x="-5%" y="-5%" width="110%" height="110%">
            <feTurbulence type="fractalNoise" baseFrequency="1.2" numOctaves="4" seed="3" result="noise"/>
            <feDisplacementMap in="SourceGraphic" in2="noise" scale="2.5" xChannelSelector="R" yChannelSelector="G"/>
          </filter>

          <filter id="nb-glow">
            <feGaussianBlur stdDeviation="3" result="blur"/>
            <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
        </defs>

        {/* ── Ground shadow ── */}
        {showShadow && (
          <ellipse cx="100" cy="272" rx="52" ry="7" fill="url(#nb-shadow)"/>
        )}

        {/* ── Boots ── */}
        {/* Left boot leg */}
        <rect x="70" y="208" width="22" height="30" rx="11" fill="url(#nb-boot)"/>
        {/* Left boot sole */}
        <rect x="63" y="225" width="36" height="16" rx="9" fill="url(#nb-sole)"/>
        {/* Left boot highlight */}
        <rect x="66" y="227" width="18" height="5" rx="3" fill="rgba(255,255,255,0.35)"/>
        {/* Left boot buckle */}
        <rect x="71" y="212" width="18" height="5" rx="2.5" fill="rgba(255,255,255,0.25)"/>

        {/* Right boot leg */}
        <rect x="108" y="208" width="22" height="30" rx="11" fill="url(#nb-boot)"/>
        {/* Right boot sole */}
        <rect x="101" y="225" width="36" height="16" rx="9" fill="url(#nb-sole)"/>
        {/* Right boot highlight */}
        <rect x="104" y="227" width="18" height="5" rx="3" fill="rgba(255,255,255,0.35)"/>
        {/* Right boot buckle */}
        <rect x="111" y="212" width="18" height="5" rx="2.5" fill="rgba(255,255,255,0.25)"/>

        {/* ── Body — fuzzy outline ── */}
        <path
          d="M100 10 C100 10 172 54 172 118 C172 168 140 212 100 212 C60 212 28 168 28 118 C28 54 100 10 100 10Z"
          fill="#90C8E8"
          filter="url(#nb-fuzz)"
          opacity="0.5"
        />

        {/* ── Body — main fill ── */}
        <path
          d="M100 14 C100 14 168 56 168 118 C168 165 138 209 100 209 C62 209 32 165 32 118 C32 56 100 14 100 14Z"
          fill="url(#nb-body)"
        />

        {/* ── Body — shine overlay ── */}
        <path
          d="M100 14 C100 14 168 56 168 118 C168 165 138 209 100 209 C62 209 32 165 32 118 C32 56 100 14 100 14Z"
          fill="url(#nb-shine)"
        />

        {/* ── Left arm ── */}
        <motion.g style={{ transformOrigin: '52px 138px' }} animate={leftArmAnim}>
          <rect x="18" y="125" width="44" height="23" rx="11.5" fill="#90C8E8" transform="rotate(-22,52,138)"/>
          <rect x="20" y="126" width="40" height="10" rx="6"    fill="rgba(255,255,255,0.22)" transform="rotate(-22,52,138)"/>
          {/* Left hand nub */}
          <circle cx="16" cy="122" r="9" fill="#90C8E8" transform="rotate(-22,52,138)"/>
        </motion.g>

        {/* ── Right arm (waving / umbrella) ── */}
        <motion.g style={{ transformOrigin: '148px 138px' }} animate={rightArmAnim}>
          <rect x="138" y="125" width="44" height="23" rx="11.5" fill="#90C8E8" transform="rotate(22,148,138)"/>
          <rect x="140" y="126" width="40" height="10" rx="6"    fill="rgba(255,255,255,0.22)" transform="rotate(22,148,138)"/>
          {/* Right hand nub */}
          <circle cx="184" cy="122" r="9" fill="#90C8E8" transform="rotate(22,148,138)"/>

          {/* ── Umbrella (attached to right hand) ── */}
          {mood === 'umbrella' && (
            <g transform="translate(162, 58) rotate(8)">
              {/* Handle */}
              <path d="M 20 72 Q 20 90 10 94" stroke="#E8A0B4" strokeWidth="3.5" fill="none" strokeLinecap="round"/>
              {/* Canopy */}
              <path d="M -26 32 Q 20 -8 66 32 Q 42 18 20 26 Q -2 18 -26 32Z" fill="#FFB3C6"/>
              {/* Canopy outline */}
              <path d="M -26 32 Q 20 -8 66 32" stroke="#FF8FAB" strokeWidth="1.8" fill="none"/>
              {/* Ribs */}
              <line x1="-12" y1="30" x2="20" y2="6"  stroke="#FF8FAB" strokeWidth="1.2"/>
              <line x1="20"  y1="0"  x2="20" y2="26" stroke="#FF8FAB" strokeWidth="1.2"/>
              <line x1="52"  y1="30" x2="20" y2="6"  stroke="#FF8FAB" strokeWidth="1.2"/>
              {/* Canopy tip */}
              <circle cx="20" cy="0" r="3" fill="#FF96B2"/>
            </g>
          )}
        </motion.g>

        {/* ── Left eye ── */}
        <g>
          <ellipse cx="79" cy="118" rx="17" ry={eyeRy} fill="white"/>
          {eyeRy > 4 && <>
            <ellipse cx="81" cy="120" rx="10" ry="11" fill="#2A3545"/>
            <ellipse cx="83" cy="116" rx="4"  ry="4"  fill="white"/>
            <ellipse cx="78" cy="121" rx="2"  ry="2"  fill="rgba(255,255,255,0.3)"/>
          </>}
          {/* Eyelid rim */}
          <ellipse cx="79" cy="118" rx="17" ry={eyeRy} fill="none" stroke="#5A9AC5" strokeWidth="1.2"/>
          {/* Lashes */}
          {eyeRy > 4 && <>
            <line x1="66" y1="105" x2="63" y2="99"  stroke="#2A3545" strokeWidth="1.8" strokeLinecap="round"/>
            <line x1="72" y1="102" x2="70" y2="95"  stroke="#2A3545" strokeWidth="1.8" strokeLinecap="round"/>
            <line x1="79" y1="100" x2="78" y2="92"  stroke="#2A3545" strokeWidth="2"   strokeLinecap="round"/>
            <line x1="86" y1="102" x2="87" y2="94"  stroke="#2A3545" strokeWidth="1.8" strokeLinecap="round"/>
            <line x1="92" y1="106" x2="95" y2="100" stroke="#2A3545" strokeWidth="1.5" strokeLinecap="round"/>
          </>}
        </g>

        {/* ── Right eye ── */}
        <g>
          <ellipse cx="121" cy="118" rx="17" ry={eyeRy} fill="white"/>
          {eyeRy > 4 && <>
            <ellipse cx="123" cy="120" rx="10" ry="11" fill="#2A3545"/>
            <ellipse cx="125" cy="116" rx="4"  ry="4"  fill="white"/>
            <ellipse cx="120" cy="121" rx="2"  ry="2"  fill="rgba(255,255,255,0.3)"/>
          </>}
          <ellipse cx="121" cy="118" rx="17" ry={eyeRy} fill="none" stroke="#5A9AC5" strokeWidth="1.2"/>
          {eyeRy > 4 && <>
            <line x1="108" y1="105" x2="105" y2="99"  stroke="#2A3545" strokeWidth="1.8" strokeLinecap="round"/>
            <line x1="114" y1="102" x2="112" y2="95"  stroke="#2A3545" strokeWidth="1.8" strokeLinecap="round"/>
            <line x1="121" y1="100" x2="120" y2="92"  stroke="#2A3545" strokeWidth="2"   strokeLinecap="round"/>
            <line x1="128" y1="102" x2="129" y2="94"  stroke="#2A3545" strokeWidth="1.8" strokeLinecap="round"/>
            <line x1="134" y1="106" x2="137" y2="100" stroke="#2A3545" strokeWidth="1.5" strokeLinecap="round"/>
          </>}
        </g>

        {/* ── Thinking bubble ── */}
        {mood === 'thinking' && (
          <>
            <circle cx="140" cy="88" r="3.5" fill="rgba(255,255,255,0.8)"/>
            <circle cx="150" cy="78" r="5"   fill="rgba(255,255,255,0.8)"/>
            <circle cx="163" cy="66" r="7.5" fill="rgba(255,255,255,0.8)"/>
            <text x="156" y="70" fontSize="9" textAnchor="middle" fill="#555">...</text>
          </>
        )}

        {/* ── Cheeks ── */}
        <motion.ellipse cx="62"  cy="140" rx="16" ry="11" fill="url(#nb-cheek)"
          animate={{ opacity: cheekAlpha }} transition={{ duration: 0.4 }}/>
        <motion.ellipse cx="138" cy="140" rx="16" ry="11" fill="url(#nb-cheek)"
          animate={{ opacity: cheekAlpha }} transition={{ duration: 0.4 }}/>

        {/* ── Mouth ── */}
        <motion.path
          d={mouthD}
          stroke="#2A3545" strokeWidth="2.8" strokeLinecap="round" fill="none"
          animate={{ d: mouthD }}
          transition={{ duration: 0.25, ease: 'easeInOut' }}
        />

        {/* ── Open laugh mouth ── */}
        <AnimatePresence>
          {mouthOpen && (
            <motion.ellipse
              key="laugh-mouth"
              cx="100" cy={laugh ? 158 : 155} rx="14" ry={laugh ? 10 : 8}
              fill="#E06080"
              initial={{ opacity: 0, scaleY: 0 }}
              animate={{ opacity: 1, scaleY: 1 }}
              exit={{ opacity: 0, scaleY: 0 }}
            />
          )}
        </AnimatePresence>

        {/* ── Star sparkles for happy ── */}
        {mood === 'happy' && (
          <>
            <motion.text x="152" y="80" fontSize="14" fill="#FFD700"
              animate={{ opacity: [0,1,0], y: [80,65,50], rotate: [0,20,40] }}
              transition={{ duration: 1.5, repeat: Infinity, repeatDelay: 0.3 }}>✦</motion.text>
            <motion.text x="40" y="90" fontSize="10" fill="#FFD700"
              animate={{ opacity: [0,1,0], y: [90,75,60] }}
              transition={{ duration: 1.8, repeat: Infinity, delay: 0.5 }}>✦</motion.text>
          </>
        )}

        {/* ── Blush sweat drop ── */}
        {mood === 'blush' && (
          <motion.path
            d="M 152 88 Q 155 98 152 102 Q 149 98 152 88Z"
            fill="#7DBDE0" opacity="0.7"
            animate={{ y: [0, 6, 12], opacity: [0.7, 0.5, 0] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          />
        )}

        {/* ── Surprised stars ── */}
        {mood === 'surprised' && (
          <>
            <motion.text x="28" y="110" fontSize="16" fill="#FFD700"
              animate={{ opacity: [0,1,0], scale: [0.5,1.2,0.5] }}
              transition={{ duration: 0.6, repeat: 4 }}>!</motion.text>
            <motion.text x="158" y="110" fontSize="16" fill="#FFD700"
              animate={{ opacity: [0,1,0], scale: [0.5,1.2,0.5] }}
              transition={{ duration: 0.6, repeat: 4, delay: 0.15 }}>!</motion.text>
          </>
        )}
      </svg>
    </motion.div>
  )
}
