import { useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import {
  LayoutDashboard, Sparkles, Map, BellRing, FileBarChart2,
  Users, BookOpen, GraduationCap, LineChart, Microscope,
  FlaskConical, CloudSun, Joystick,
} from 'lucide-react'

/* ── Portal data: matches sidebar tabs exactly ─────────────────────────────── */
const PORTALS = [
  { label: 'Dashboard',     icon: LayoutDashboard, path: '/dashboard',  color: '#006fbf', glow: '#006fbf', x: 50,  y: 44 },
  { label: 'Ask Water AI',  icon: Sparkles,        path: '/ask-water',  color: '#8b5cf6', glow: '#a78bfa', x: 76,  y: 22 },
  { label: 'Live Map',      icon: Map,             path: '/map',        color: '#14b8a6', glow: '#2dd4bf', x: 22,  y: 30 },
  { label: 'Alerts',        icon: BellRing,        path: '/alerts',     color: '#f59e0b', glow: '#fbbf24', x: 52,  y: 16 },
  { label: 'Reports',       icon: FileBarChart2,   path: '/reports',    color: '#0ea5e9', glow: '#38bdf8', x: 80,  y: 52 },
  { label: 'Community',     icon: Users,           path: '/social',     color: '#ec4899', glow: '#f472b6', x: 14,  y: 56 },
  { label: 'Resources',     icon: BookOpen,        path: '/resources',  color: '#10b981', glow: '#34d399', x: 34,  y: 72 },
  { label: 'Quiz & Learn',  icon: GraduationCap,   path: '/quiz',       color: '#f97316', glow: '#fb923c', x: 70,  y: 72 },
  { label: 'Data Analysis', icon: LineChart,       path: '/analysis',   color: '#006fbf', glow: '#38bdf8', x: 83,  y: 35 },
  { label: 'Research Hub',  icon: Microscope,      path: '/research',   color: '#a855f7', glow: '#c084fc', x: 18,  y: 70 },
  { label: 'Projects',      icon: FlaskConical,    path: '/projects',   color: '#14b8a6', glow: '#2dd4bf', x: 62,  y: 85 },
  { label: 'Weather',       icon: CloudSun,        path: '/weather',    color: '#0ea5e9', glow: '#7dd3fc', x: 37,  y: 20 },
  { label: 'Games',         icon: Joystick,        path: '/games',      color: '#a855f7', glow: '#c084fc', x: 20,  y: 85 },
]

/* ── Rope lines between portals (pairs of indices) ─────────────────────────── */
const ROPES = [
  [0,1],[0,2],[0,3],[0,4],[0,5],[0,6],[0,7],
  [0,8],[0,9],[0,10],[0,11],[0,12],
  [2,11],[3,11],[4,8],[1,8],[5,9],[6,9],[6,12],[7,10],
]

const CSS = `
@keyframes sailRight {
  0%   { transform: translateX(-160px) }
  100% { transform: translateX(calc(100vw + 160px)) }
}
@keyframes sailLeft {
  0%   { transform: translateX(calc(100vw + 160px)) scaleX(-1) }
  100% { transform: translateX(-160px) scaleX(-1) }
}
@keyframes dolphinArc {
  0%   { transform: translateX(0)    translateY(0)    rotate(0deg);   opacity:0 }
  5%   { opacity:1 }
  20%  { transform: translateX(15%)  translateY(-55px) rotate(-25deg) }
  35%  { transform: translateX(30%)  translateY(5px)   rotate(10deg) }
  50%  { transform: translateX(45%)  translateY(-50px) rotate(-20deg) }
  65%  { transform: translateX(60%)  translateY(5px)   rotate(8deg) }
  80%  { transform: translateX(75%)  translateY(-45px) rotate(-18deg) }
  93%  { opacity:1 }
  100% { transform: translateX(90%)  translateY(0)    rotate(0deg);   opacity:0 }
}
@keyframes dolphinArc2 {
  0%   { transform: translateX(0) translateY(0) rotate(0deg); opacity:0 }
  8%   { opacity:1 }
  25%  { transform: translateX(18%) translateY(-40px) rotate(-22deg) }
  45%  { transform: translateX(36%) translateY(0)     rotate(5deg) }
  65%  { transform: translateX(54%) translateY(-38px) rotate(-20deg) }
  90%  { opacity:1 }
  100% { transform: translateX(72%) translateY(0) rotate(0deg); opacity:0 }
}
@keyframes waveScroll {
  0%   { transform: translateX(0) }
  100% { transform: translateX(-50%) }
}
@keyframes waveScroll2 {
  0%   { transform: translateX(-50%) }
  100% { transform: translateX(0) }
}
@keyframes portalPulse {
  0%,100% { box-shadow: 0 0 18px var(--glow), 0 0 36px var(--glow-dim), inset 0 0 12px rgba(255,255,255,0.06) }
  50%      { box-shadow: 0 0 30px var(--glow), 0 0 60px var(--glow-dim), inset 0 0 20px rgba(255,255,255,0.1)  }
}
@keyframes portalFloat {
  0%,100% { transform: translateY(0) }
  50%     { transform: translateY(-6px) }
}
@keyframes compassSpin {
  0%   { transform: rotate(0deg) }
  100% { transform: rotate(360deg) }
}
@keyframes titleShimmer {
  0%,100% { opacity:1 }
  50%     { opacity:0.7 }
}
@keyframes seaGleam {
  0%,100% { opacity:0.18 }
  50%     { opacity:0.35 }
}
@keyframes fogDrift {
  0%   { transform: translateX(-20%) translateY(0); opacity:0.07 }
  50%  { opacity:0.13 }
  100% { transform: translateX(20%) translateY(-10px); opacity:0.07 }
}
@keyframes bubbleRise {
  0%   { transform: translateY(0) scale(1);   opacity:0.6 }
  100% { transform: translateY(-40px) scale(0.3); opacity:0 }
}
`

/* ── Ship SVG ──────────────────────────────────────────────────────────────── */
function Ship({ style }) {
  return (
    <svg width="140" height="90" viewBox="0 0 140 90" fill="none" style={style}>
      {/* Hull */}
      <path d="M10 62 Q70 75 130 62 L118 72 Q70 82 22 72 Z" fill="#8B4513" stroke="#5c2a00" strokeWidth="1.5"/>
      {/* Deck */}
      <rect x="28" y="55" width="84" height="8" rx="3" fill="#A0522D" stroke="#5c2a00" strokeWidth="1"/>
      {/* Mast 1 */}
      <line x1="70" y1="10" x2="70" y2="60" stroke="#4a3728" strokeWidth="3"/>
      {/* Mast 2 */}
      <line x1="44" y1="20" x2="44" y2="58" stroke="#4a3728" strokeWidth="2.5"/>
      {/* Main sail */}
      <path d="M72 12 Q92 30 84 56 L72 56 Z" fill="rgba(255,248,220,0.92)" stroke="#c8b89a" strokeWidth="1"/>
      {/* Second sail */}
      <path d="M46 22 Q62 35 56 56 L46 56 Z" fill="rgba(255,248,220,0.88)" stroke="#c8b89a" strokeWidth="1"/>
      {/* Front sail */}
      <path d="M30 36 L44 24 L44 54 Z" fill="rgba(255,248,220,0.8)" stroke="#c8b89a" strokeWidth="1"/>
      {/* Flag */}
      <path d="M70 10 L84 14 L70 18 Z" fill="#006fbf"/>
      {/* Crow's nest */}
      <rect x="65" y="20" width="10" height="6" rx="2" fill="#8B4513"/>
      {/* Waves under hull */}
      <path d="M8 70 Q20 66 32 70 Q44 74 56 70 Q68 66 80 70 Q92 74 104 70 Q116 66 132 70" stroke="rgba(100,200,255,0.5)" strokeWidth="2" fill="none"/>
    </svg>
  )
}

/* ── Dolphin SVG ───────────────────────────────────────────────────────────── */
function Dolphin({ style, flip }) {
  return (
    <svg width="64" height="36" viewBox="0 0 64 36" fill="none"
      style={{ ...style, transform: `${style?.transform || ''} ${flip ? 'scaleX(-1)' : ''}` }}>
      <path d="M4 24 Q16 8 32 12 Q44 15 52 10 Q60 6 62 14 Q58 20 48 18 Q36 16 24 26 Q14 34 4 24 Z"
        fill="#14b8a6" stroke="#0d9488" strokeWidth="1"/>
      <path d="M2 22 Q0 18 4 16 Q6 20 4 24 Z" fill="#14b8a6"/>
      <circle cx="50" cy="12" r="2" fill="#0d9488"/>
      <circle cx="51" cy="11.5" r="0.8" fill="white"/>
      <path d="M54 8 Q62 2 64 6 Q60 10 56 9 Z" fill="#14b8a6"/>
    </svg>
  )
}

/* ── Compass Rose ──────────────────────────────────────────────────────────── */
function CompassRose() {
  return (
    <svg width="80" height="80" viewBox="0 0 80 80">
      {[0,45,90,135].map(deg => (
        <g key={deg} transform={`rotate(${deg} 40 40)`}>
          <polygon points="40,5 36,40 40,35 44,40" fill={deg===0?'#dc2626':'rgba(210,180,140,0.9)'}/>
          <polygon points="40,75 36,40 40,45 44,40" fill="rgba(139,115,85,0.8)"/>
        </g>
      ))}
      <circle cx="40" cy="40" r="8" fill="none" stroke="rgba(210,180,140,0.9)" strokeWidth="1.5"/>
      <circle cx="40" cy="40" r="3" fill="rgba(210,180,140,0.9)"/>
      {['N','E','S','W'].map((d,i) => {
        const angle = i * 90 - 90
        const rad = angle * Math.PI / 180
        const x = 40 + Math.cos(rad) * 34
        const y = 40 + Math.sin(rad) * 34
        return <text key={d} x={x} y={y} textAnchor="middle" dominantBaseline="middle"
          fontSize="9" fontWeight="700" fill={d==='N'?'#dc2626':'rgba(210,180,140,0.9)'}
          fontFamily="serif">{d}</text>
      })}
    </svg>
  )
}

export default function QuickActions() {
  const navigate = useNavigate()
  const [hovered, setHovered] = useState(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 100)
    return () => clearTimeout(t)
  }, [])

  return (
    <div style={{
      position: 'relative',
      width: '100%',
      minHeight: 'calc(100vh - 120px)',
      overflow: 'hidden',
      borderRadius: 16,
      fontFamily: 'Georgia, "Times New Roman", serif',
      background: 'linear-gradient(160deg, #1a3a5c 0%, #0d2b45 35%, #0a2238 60%, #071828 100%)',
    }}>
      <style>{CSS}</style>

      {/* ── Parchment overlay ─────────────────────────────────────────────── */}
      <div style={{
        position: 'absolute', inset: 0, zIndex: 0, pointerEvents: 'none',
        background: `
          radial-gradient(ellipse 80% 60% at 50% 40%, rgba(20,60,100,0.0) 0%, rgba(10,30,60,0.4) 100%),
          repeating-linear-gradient(0deg, transparent, transparent 40px, rgba(255,255,255,0.012) 40px, rgba(255,255,255,0.012) 41px),
          repeating-linear-gradient(90deg, transparent, transparent 40px, rgba(255,255,255,0.012) 40px, rgba(255,255,255,0.012) 41px)
        `,
      }}/>

      {/* ── Animated sea surface ──────────────────────────────────────────── */}
      <div style={{ position: 'absolute', inset: 0, zIndex: 1, overflow: 'hidden', pointerEvents: 'none' }}>
        {/* Deep glow */}
        <div style={{
          position: 'absolute', bottom: '15%', left: '10%', width: '80%', height: '50%',
          background: 'radial-gradient(ellipse 80% 60% at 50% 80%, rgba(0,111,191,0.18) 0%, transparent 70%)',
          animation: 'seaGleam 4s ease-in-out infinite',
        }}/>
        {/* Wave layer 1 */}
        <svg style={{ position: 'absolute', bottom: '20%', width: '200%', opacity: 0.18, animation: 'waveScroll 12s linear infinite' }}
          viewBox="0 0 1440 60" preserveAspectRatio="none" height="60">
          <path d="M0,30 C120,10 240,50 360,30 C480,10 600,50 720,30 C840,10 960,50 1080,30 C1200,10 1320,50 1440,30 L1440,60 L0,60 Z" fill="rgba(100,200,255,0.5)"/>
        </svg>
        {/* Wave layer 2 */}
        <svg style={{ position: 'absolute', bottom: '16%', width: '200%', opacity: 0.12, animation: 'waveScroll2 18s linear infinite' }}
          viewBox="0 0 1440 50" preserveAspectRatio="none" height="50">
          <path d="M0,25 C180,5 360,45 540,25 C720,5 900,45 1080,25 C1260,5 1440,45 1440,25 L1440,50 L0,50 Z" fill="rgba(20,184,166,0.5)"/>
        </svg>
        {/* Fog drift */}
        <div style={{
          position: 'absolute', top: '5%', left: '-20%', width: '140%', height: '25%',
          background: 'radial-gradient(ellipse 60% 100% at 50% 0%, rgba(180,210,255,0.08) 0%, transparent 100%)',
          animation: 'fogDrift 20s ease-in-out infinite',
        }}/>

        {/* Rising bubbles */}
        {[15,30,45,60,75,88].map((left, i) => (
          <div key={i} style={{
            position: 'absolute', bottom: `${20 + (i % 3) * 5}%`, left: `${left}%`,
            width: 4 + (i%3)*2, height: 4 + (i%3)*2,
            borderRadius: '50%', background: 'rgba(100,200,255,0.5)',
            animation: `bubbleRise ${3 + i * 0.7}s ease-in infinite`,
            animationDelay: `${i * 0.9}s`,
          }}/>
        ))}
      </div>

      {/* ── Sailing ship ──────────────────────────────────────────────────── */}
      <div style={{
        position: 'absolute', bottom: '16%', left: 0, zIndex: 5, pointerEvents: 'none',
        animation: 'sailRight 28s linear infinite',
        animationDelay: '2s',
      }}>
        <Ship />
      </div>
      {/* Second ship going left */}
      <div style={{
        position: 'absolute', bottom: '12%', left: 0, zIndex: 5, pointerEvents: 'none',
        animation: 'sailLeft 38s linear infinite',
        animationDelay: '14s',
      }}>
        <Ship style={{ opacity: 0.7, transform: 'scale(0.75)' }}/>
      </div>

      {/* ── Dolphins ──────────────────────────────────────────────────────── */}
      <div style={{
        position: 'absolute', bottom: '22%', left: '5%', zIndex: 6, pointerEvents: 'none',
        animation: 'dolphinArc 14s ease-in-out infinite',
        animationDelay: '4s',
      }}>
        <Dolphin />
      </div>
      <div style={{
        position: 'absolute', bottom: '19%', left: '35%', zIndex: 6, pointerEvents: 'none',
        animation: 'dolphinArc2 18s ease-in-out infinite',
        animationDelay: '9s',
      }}>
        <Dolphin flip />
      </div>
      <div style={{
        position: 'absolute', bottom: '24%', left: '55%', zIndex: 6, pointerEvents: 'none',
        animation: 'dolphinArc 22s ease-in-out infinite',
        animationDelay: '1s',
      }}>
        <Dolphin />
      </div>

      {/* ── Rope lines SVG layer ──────────────────────────────────────────── */}
      <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', zIndex: 7, pointerEvents: 'none' }}>
        <defs>
          <filter id="ropeBlur">
            <feGaussianBlur stdDeviation="0.8"/>
          </filter>
        </defs>
        {ROPES.map(([a, b], i) => {
          const pa = PORTALS[a], pb = PORTALS[b]
          return (
            <line key={i}
              x1={`${pa.x}%`} y1={`${pa.y}%`}
              x2={`${pb.x}%`} y2={`${pb.y}%`}
              stroke={`rgba(210,180,120,${hovered === a || hovered === b ? 0.55 : 0.18})`}
              strokeWidth={hovered === a || hovered === b ? 1.5 : 1}
              strokeDasharray="6 4"
              filter="url(#ropeBlur)"
              style={{ transition: 'all 0.3s' }}
            />
          )
        })}
      </svg>

      {/* ── Title ─────────────────────────────────────────────────────────── */}
      <div style={{
        position: 'absolute', top: 18, left: '50%', transform: 'translateX(-50%)',
        zIndex: 20, textAlign: 'center', pointerEvents: 'none',
        animation: 'titleShimmer 4s ease-in-out infinite',
      }}>
        <div style={{
          fontSize: 11, fontWeight: 700, letterSpacing: '0.4em',
          color: 'rgba(210,180,120,0.8)', textTransform: 'uppercase', marginBottom: 2,
          fontFamily: 'system-ui, sans-serif',
        }}>
          ⚓ SOURCE WATER
        </div>
        <div style={{
          fontSize: 20, fontWeight: 700, color: 'rgba(230,210,160,0.95)',
          letterSpacing: '0.15em', textShadow: '0 0 20px rgba(0,111,191,0.6)',
          fontFamily: 'Georgia, serif',
        }}>
          NAVIGATION CHART
        </div>
        <div style={{ fontSize: 10, color: 'rgba(180,160,100,0.6)', letterSpacing: '0.2em', marginTop: 3, fontFamily: 'system-ui,sans-serif' }}>
          CLICK A PORTAL TO NAVIGATE
        </div>
      </div>

      {/* ── Compass rose ──────────────────────────────────────────────────── */}
      <div style={{ position: 'absolute', bottom: 24, right: 28, zIndex: 20, opacity: 0.7, pointerEvents: 'none' }}>
        <CompassRose />
      </div>

      {/* ── Portals ───────────────────────────────────────────────────────── */}
      {PORTALS.map((portal, i) => {
        const Icon = portal.icon
        const isHovered = hovered === i
        const isCenter = i === 0
        const size = isCenter ? 90 : 68
        const delay = `${i * 0.08}s`
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
              transform: `translate(-50%, -50%)`,
              zIndex: 15,
              cursor: 'pointer',
              opacity: mounted ? 1 : 0,
              transition: `opacity 0.5s ease ${delay}, transform 0.3s cubic-bezier(0.34,1.56,0.64,1)`,
              animation: `portalFloat ${4 + i * 0.3}s ease-in-out infinite`,
              animationDelay: `${i * 0.2}s`,
            }}
          >
            {/* Portal ring */}
            <div style={{
              width: size, height: size,
              borderRadius: '50%',
              background: `radial-gradient(circle at 35% 35%, rgba(255,255,255,0.12) 0%, rgba(0,0,0,0.4) 100%)`,
              border: `${isCenter ? 3 : 2}px solid ${portal.color}`,
              '--glow': `${portal.glow}88`,
              '--glow-dim': `${portal.glow}44`,
              animation: `portalPulse ${2.5 + i * 0.15}s ease-in-out infinite`,
              animationDelay: `${i * 0.18}s`,
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              gap: 4, position: 'relative',
              transform: isHovered ? 'scale(1.15)' : 'scale(1)',
              transition: 'transform 0.2s, border-color 0.2s',
              backdropFilter: 'blur(8px)',
              background: isHovered
                ? `radial-gradient(circle at 35% 35%, ${portal.color}33 0%, ${portal.color}11 100%)`
                : `radial-gradient(circle at 35% 35%, rgba(255,255,255,0.08) 0%, rgba(0,0,0,0.5) 100%)`,
            }}>
              <Icon size={isCenter ? 28 : 20} style={{ color: portal.color, filter: `drop-shadow(0 0 6px ${portal.glow})` }} />
              <span style={{
                fontSize: isCenter ? 10 : 8.5,
                fontWeight: 700,
                color: isHovered ? 'white' : 'rgba(220,210,180,0.9)',
                textAlign: 'center',
                lineHeight: 1.2,
                maxWidth: size - 12,
                fontFamily: 'system-ui, sans-serif',
                letterSpacing: '0.02em',
                textShadow: isHovered ? `0 0 10px ${portal.glow}` : 'none',
              }}>
                {portal.label}
              </span>

              {/* Shine shimmer on hover */}
              {isHovered && (
                <div style={{
                  position: 'absolute', inset: 0, borderRadius: '50%',
                  background: `linear-gradient(135deg, rgba(255,255,255,0.18) 0%, transparent 60%)`,
                  pointerEvents: 'none',
                }}/>
              )}

              {/* Outer glow ring on hover */}
              {isHovered && (
                <div style={{
                  position: 'absolute', inset: -6, borderRadius: '50%',
                  border: `1.5px solid ${portal.color}66`,
                  pointerEvents: 'none',
                  animation: 'portalPulse 1s ease-in-out infinite',
                  '--glow': `${portal.glow}66`,
                  '--glow-dim': `${portal.glow}22`,
                }}/>
              )}
            </div>

            {/* Label below on hover */}
            {isHovered && (
              <div style={{
                position: 'absolute', top: '110%', left: '50%', transform: 'translateX(-50%)',
                background: 'rgba(10,20,40,0.92)',
                border: `1px solid ${portal.color}66`,
                borderRadius: 8, padding: '4px 10px',
                fontSize: 10, color: 'rgba(230,210,160,0.9)',
                whiteSpace: 'nowrap', fontFamily: 'system-ui,sans-serif',
                fontWeight: 600, letterSpacing: '0.05em',
                boxShadow: `0 4px 16px rgba(0,0,0,0.5), 0 0 8px ${portal.glow}44`,
                pointerEvents: 'none',
                zIndex: 30,
              }}>
                ➜ {portal.label}
              </div>
            )}
          </div>
        )
      })}

      {/* ── Decorative sea creatures (static) ─────────────────────────────── */}
      <div style={{ position: 'absolute', bottom: 30, left: 20, zIndex: 4, fontSize: 22, opacity: 0.35, pointerEvents: 'none',
        animation: 'portalFloat 5s ease-in-out infinite', animationDelay: '0.5s' }}>🦑</div>
      <div style={{ position: 'absolute', top: '35%', right: 16, zIndex: 4, fontSize: 18, opacity: 0.3, pointerEvents: 'none',
        animation: 'portalFloat 6s ease-in-out infinite', animationDelay: '1.5s' }}>🐋</div>
      <div style={{ position: 'absolute', bottom: 60, left: '45%', zIndex: 4, fontSize: 16, opacity: 0.28, pointerEvents: 'none',
        animation: 'portalFloat 4.5s ease-in-out infinite', animationDelay: '2s' }}>🦀</div>
      <div style={{ position: 'absolute', top: '70%', right: '20%', zIndex: 4, fontSize: 14, opacity: 0.25, pointerEvents: 'none',
        animation: 'portalFloat 5.5s ease-in-out infinite', animationDelay: '0.8s' }}>⚓</div>
      <div style={{ position: 'absolute', top: '10%', left: '8%', zIndex: 4, fontSize: 14, opacity: 0.25, pointerEvents: 'none',
        animation: 'portalFloat 7s ease-in-out infinite', animationDelay: '3s' }}>🗺️</div>
    </div>
  )
}
