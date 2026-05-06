/**
 * QuickActions — Vintage navigator's chart with seven wax-seal landing buttons.
 *
 * Buttons are plain absolutely-positioned <button> elements (NOT SVG) so click
 * handling is rock-solid. The previous implementation used <g> with both an
 * SVG transform attribute AND a CSS transform on the same element; CSS won,
 * SVG transform was erased, and every seal collapsed to (0,0) of the chart
 * with clicks landing far from where the seal appeared. That bug is gone.
 *
 * Background: client/public/textures/quick-actions-map.jpg (a vintage parchment
 * world chart). If that file isn't present, falls back to /textures/worldmap.jpg
 * with a sepia treatment so the page never breaks.
 */
import { useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import {
  LayoutDashboard,
  Sparkles,
  Map,
  Users,
  BarChart3,
  Microscope,
  BookOpen,
} from 'lucide-react'
import NibiMascotImage from '../components/NibiMascotImage'

// Seal positions are percentages of the chart's width/height so they
// scale with the responsive container. Tuned to land on continents of
// the vintage world map (North America, Europe, Asia, etc).
//
// `tone` selects one of two wax colours — burgundy (action / data) or
// navy (intel / chart) — for visual rhythm across the seven seals.
const ACTIONS = [
  { label: 'Dashboard', description: 'Master Ledger',       path: '/dashboard',  icon: LayoutDashboard, x: 22, y: 36, tone: 'burgundy' },
  { label: 'Live Map',  description: 'Global Marine Chart', path: '/monitoring', icon: Map,            x: 16, y: 64, tone: 'burgundy' },
  { label: 'Ask Water', description: 'AI Navigator Hub',    path: '/ask-water',  icon: Sparkles,       x: 54, y: 30, tone: 'navy'     },
  { label: 'Community', description: 'Guild Forum Posts',   path: '/social',     icon: Users,          x: 38, y: 64, tone: 'burgundy' },
  { label: 'Reports',   description: 'Statistical Summary', path: '/reports',    icon: BarChart3,      x: 78, y: 65, tone: 'navy'     },
  { label: 'Research',  description: 'Projects & Data Hub', path: '/research',   icon: Microscope,     x: 72, y: 38, tone: 'burgundy' },
  { label: 'Resources', description: 'Educational Archive', path: '/resources',  icon: BookOpen,       x: 60, y: 75, tone: 'burgundy' },
]

const TONE = {
  burgundy: { base: '#a81f1b', mid: '#7b1311', edge: '#3a0b0a', glow: 'rgba(247,150,90,0.55)' },
  navy:     { base: '#27567f', mid: '#1c4063', edge: '#0c2236', glow: 'rgba(140,190,240,0.55)' },
}

// ─── Wax-seal landing button — pure HTML, click works everywhere ───────────
function SealButton({ action, index, ready }) {
  const navigate = useNavigate()
  const Icon = action.icon
  const t = TONE[action.tone] || TONE.burgundy

  return (
    <button
      type="button"
      onClick={() => navigate(action.path)}
      aria-label={`${action.label} — ${action.description}`}
      className={`atlas-seal ${ready ? 'is-ready' : ''}`}
      style={{
        left: `${action.x}%`,
        top: `${action.y}%`,
        animationDelay: `${260 + index * 95}ms`,
        '--seal-base': t.base,
        '--seal-mid':  t.mid,
        '--seal-edge': t.edge,
        '--seal-glow': t.glow,
      }}
    >
      {/* Wax disc */}
      <span aria-hidden="true" className="atlas-seal-disc">
        <span className="atlas-seal-highlight" />
        <span className="atlas-seal-icon">
          <Icon size={20} strokeWidth={2.2} />
        </span>
      </span>

      {/* Brass plaque */}
      <span aria-hidden="true" className="atlas-seal-plaque">
        <span className="atlas-seal-label">{action.label.toUpperCase()}</span>
        <span className="atlas-seal-sub">{action.description}</span>
      </span>
    </button>
  )
}

export default function QuickActions() {
  const [ready, setReady]     = useState(false)
  const [imgFailed, setImgFailed] = useState(false)

  useEffect(() => {
    const id = requestAnimationFrame(() => setReady(true))
    return () => cancelAnimationFrame(id)
  }, [])

  const primaryMap  = '/textures/quick-actions-map.png'
  const fallbackMap = '/textures/worldmap.jpg'

  return (
    <div className={`atlas-root ${ready ? 'is-ready' : ''}`}>
      <div className="atlas-frame">

        {/* Cartouche-style title scroll */}
        <div className="atlas-title-wrap">
          <div className="atlas-title-mascot" aria-hidden="true">
            <NibiMascotImage mood="walking" size={84} />
          </div>
          <div className="atlas-title">
            <svg viewBox="0 0 380 70" preserveAspectRatio="none" aria-hidden="true" className="atlas-title-bg">
              <defs>
                <linearGradient id="qaScrollFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%"   stopColor="#f3e0b6"/>
                  <stop offset="50%"  stopColor="#e8cf95"/>
                  <stop offset="100%" stopColor="#c9ac74"/>
                </linearGradient>
              </defs>
              <path d="M10 12 C40 4 340 4 370 12 L368 58 C338 66 42 66 12 58 Z"
                fill="url(#qaScrollFill)" stroke="#5a3f22" strokeWidth="1.2"/>
              <path d="M2 12 C 6 18 6 52 2 58 L 16 56 L 16 14 Z" fill="#9a7f55" stroke="#5a3f22" strokeWidth="0.8"/>
              <path d="M378 12 C374 18 374 52 378 58 L 364 56 L 364 14 Z" fill="#9a7f55" stroke="#5a3f22" strokeWidth="0.8"/>
            </svg>
            <h1 className="atlas-title-text">Source Water — Atlas</h1>
            <p className="atlas-title-sub">Navigator's Chart</p>
          </div>
        </div>

        {/* Map stage */}
        <div className="atlas-stage">
          {/* Background image — primary loads, fallback kicks in on error */}
          <img
            src={imgFailed ? fallbackMap : primaryMap}
            alt=""
            aria-hidden="true"
            onError={() => setImgFailed(true)}
            className={`atlas-stage-img ${imgFailed ? 'is-fallback' : ''}`}
          />

          {/* Atmospheric overlays — vignette, dust, light, shimmer */}
          <div className="atlas-vignette" aria-hidden="true" />
          <div className="atlas-dust" aria-hidden="true" />
          <div className="atlas-light" aria-hidden="true" />
          <div className="atlas-water-shimmer" aria-hidden="true" />

          {/* Decorative compass rose — only shown when the parchment isn't
              loaded (the parchment already has a compass drawn into it,
              so we'd double up otherwise). */}
          {imgFailed && (
          <svg viewBox="0 0 160 160" className="atlas-compass" aria-hidden="true">
            <defs>
              <linearGradient id="qaCompassMetal" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#d9b87a"/>
                <stop offset="100%" stopColor="#7a5a31"/>
              </linearGradient>
            </defs>
            <g transform="translate(80,80)">
              <circle r="62" fill="rgba(255,240,200,0.18)" stroke="#3a2515" strokeWidth="1.5"/>
              <circle r="54" fill="none" stroke="#3a2515" strokeWidth="0.8" strokeDasharray="2 4"/>
              <circle r="38" fill="none" stroke="#3a2515" strokeWidth="0.6"/>
              <g className="atlas-compass-star">
                <polygon points="0,-60 7,-10 0,-3 -7,-10" fill="url(#qaCompassMetal)" stroke="#3a2515" strokeWidth="0.6"/>
                <polygon points="0,60  7, 10 0, 3 -7, 10" fill="#7a5a31" stroke="#3a2515" strokeWidth="0.6"/>
                <polygon points="-60,0 -10,-7 -3,0 -10,7" fill="#9c7843" stroke="#3a2515" strokeWidth="0.6"/>
                <polygon points="60, 0  10,-7  3,0  10,7" fill="#b39056" stroke="#3a2515" strokeWidth="0.6"/>
              </g>
              <text x="0"  y="-66" textAnchor="middle" fill="#2a1709" fontSize="12" fontFamily="Georgia, serif" fontWeight="700">N</text>
              <text x="68" y="4"   textAnchor="middle" fill="#2a1709" fontSize="11" fontFamily="Georgia, serif">E</text>
              <text x="0"  y="76"  textAnchor="middle" fill="#2a1709" fontSize="11" fontFamily="Georgia, serif">S</text>
              <text x="-68" y="4"  textAnchor="middle" fill="#2a1709" fontSize="11" fontFamily="Georgia, serif">W</text>
              <g className="atlas-compass-rim">
                {[...Array(36)].map((_, i) => (
                  <line key={i} x1="0" y1="-62" x2="0" y2={i % 9 === 0 ? -70 : -65}
                    stroke="#3a2515" strokeWidth="0.5" transform={`rotate(${i * 10})`}/>
                ))}
              </g>
            </g>
          </svg>
          )}

          {/* Wax-seal landing buttons — clickable HTML elements */}
          {ACTIONS.map((action, i) => (
            <SealButton key={action.label} action={action} index={i} ready={ready} />
          ))}

          {/* Corner brackets for the framed look */}
          <span className="atlas-corner atlas-corner-tl" aria-hidden="true" />
          <span className="atlas-corner atlas-corner-tr" aria-hidden="true" />
          <span className="atlas-corner atlas-corner-bl" aria-hidden="true" />
          <span className="atlas-corner atlas-corner-br" aria-hidden="true" />
        </div>
      </div>

      <style>{`
        .atlas-root {
          min-height: 100vh;
          padding: 18px 14px 26px;
          background: radial-gradient(ellipse at 50% 28%, #2a1808 0%, #16100a 70%);
          opacity: 0;
          transform: translateY(8px);
          transition: opacity 700ms cubic-bezier(0.22, 1, 0.36, 1), transform 900ms cubic-bezier(0.22, 1, 0.36, 1);
        }
        .atlas-root.is-ready { opacity: 1; transform: translateY(0); }
        @media (min-width: 768px) {
          .atlas-root { padding: 26px 32px 40px; }
        }

        .atlas-frame {
          margin: 0 auto;
          width: 100%;
          max-width: 1280px;
          animation: atlasFrameEnter 950ms cubic-bezier(0.22, 1, 0.36, 1) both;
        }

        /* ── Title scroll ── */
        .atlas-title-wrap {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 16px;
          margin-bottom: 18px;
          opacity: 0;
          transform: translateY(-8px);
          animation: titleReveal 760ms cubic-bezier(0.22, 1, 0.36, 1) 110ms forwards;
        }
        .atlas-title-mascot {
          filter: drop-shadow(0 4px 10px rgba(0,0,0,0.45));
        }
        @media (max-width: 640px) {
          .atlas-title-mascot { display: none; }
        }
        .atlas-title {
          position: relative;
          display: inline-block;
          padding: 14px 36px 16px;
        }
        .atlas-title-bg {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
        }
        .atlas-title-text {
          position: relative;
          margin: 0;
          font-family: Georgia, 'Times New Roman', serif;
          font-size: clamp(18px, 2.6vw, 26px);
          font-weight: 700;
          letter-spacing: 0.20em;
          color: #3f2a17;
          text-align: center;
          text-transform: uppercase;
        }
        .atlas-title-sub {
          position: relative;
          margin: 4px 0 0;
          font-family: Georgia, 'Times New Roman', serif;
          font-style: italic;
          font-size: clamp(10px, 1.2vw, 13px);
          letter-spacing: 0.18em;
          color: #6b4f31;
          text-align: center;
        }

        /* ── Map stage ── */
        .atlas-stage {
          position: relative;
          width: 100%;
          aspect-ratio: 16 / 10;
          border-radius: 8px;
          overflow: hidden;
          border: 12px solid #231408;
          box-shadow:
            0 24px 50px rgba(0,0,0,0.55),
            inset 0 0 90px rgba(58,32,12,0.55);
          background: #d4b885;
          opacity: 0;
          transform: scale(0.985);
          animation: mapReveal 980ms cubic-bezier(0.22, 1, 0.36, 1) 190ms forwards;
        }
        .atlas-stage-img {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          object-fit: cover;
          user-select: none;
          pointer-events: none;
        }
        /* Fallback satellite map → push it through a sepia filter so it
           still reads as a vintage chart. The user can drop the real
           parchment at quick-actions-map.jpg whenever they're ready. */
        .atlas-stage-img.is-fallback {
          filter: sepia(0.85) saturate(0.7) hue-rotate(-12deg) brightness(0.92) contrast(1.05);
        }

        .atlas-vignette,
        .atlas-dust,
        .atlas-light,
        .atlas-water-shimmer {
          position: absolute;
          inset: 0;
          pointer-events: none;
        }
        .atlas-vignette {
          background: radial-gradient(circle at 50% 42%, rgba(0,0,0,0) 38%, rgba(40,20,8,0.45) 100%);
          mix-blend-mode: multiply;
        }
        .atlas-light {
          background: radial-gradient(circle at 14% 16%, rgba(255,243,210,0.20) 0%, rgba(255,243,210,0.04) 32%, transparent 70%);
          animation: lightDrift 24s ease-in-out infinite alternate;
        }
        .atlas-dust {
          background-image:
            radial-gradient(circle at 14% 20%, rgba(255,240,208,0.16) 0 1px, transparent 1px),
            radial-gradient(circle at 78% 34%, rgba(97,63,28,0.10) 0 1px, transparent 1px),
            radial-gradient(circle at 62% 74%, rgba(255,233,196,0.12) 0 1px, transparent 1px);
          background-size: 170px 170px, 220px 220px, 280px 280px;
          opacity: 0.4;
        }
        .atlas-water-shimmer {
          background: linear-gradient(115deg, rgba(180,210,225,0) 0%, rgba(180,210,225,0.06) 45%, rgba(180,210,225,0) 70%);
          mix-blend-mode: screen;
          opacity: 0.45;
          animation: shimmerSlide 14s linear infinite;
        }

        /* ── Compass rose ── */
        .atlas-compass {
          position: absolute;
          top: 2.5%;
          left: 2.5%;
          width: clamp(70px, 9vw, 130px);
          height: clamp(70px, 9vw, 130px);
          filter: drop-shadow(0 3px 6px rgba(74,48,21,0.45));
          opacity: 0.92;
          pointer-events: none;
        }
        .atlas-compass-rim  { transform-origin: 0 0; animation: compassDrift 60s linear infinite; }
        .atlas-compass-star { transform-origin: 0 0; animation: compassBreath 8s ease-in-out infinite; }

        /* ── Corner brackets ── */
        .atlas-corner {
          position: absolute;
          width: 38px;
          height: 38px;
          border: 3px solid #3a2515;
          opacity: 0.7;
          pointer-events: none;
        }
        .atlas-corner-tl { top: 12px; left: 12px;  border-right: 0; border-bottom: 0; }
        .atlas-corner-tr { top: 12px; right: 12px; border-left:  0; border-bottom: 0; }
        .atlas-corner-bl { bottom: 12px; left: 12px;  border-right: 0; border-top: 0; }
        .atlas-corner-br { bottom: 12px; right: 12px; border-left:  0; border-top: 0; }

        /* ── Wax-seal button ── */
        .atlas-seal {
          position: absolute;
          transform: translate(-50%, -50%);
          background: transparent;
          border: 0;
          padding: 0;
          margin: 0;
          cursor: pointer;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
          opacity: 0;
          transition: filter 280ms ease;
          filter: drop-shadow(0 10px 16px rgba(25,14,7,0.45));
        }
        .atlas-seal.is-ready {
          animation: sealIntro 540ms cubic-bezier(0.2, 0.8, 0.2, 1) both;
        }
        .atlas-seal:focus-visible {
          outline: 3px solid #f7d28e;
          outline-offset: 6px;
          border-radius: 50%;
        }

        .atlas-seal-disc {
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          width: 58px;
          height: 58px;
          border-radius: 50%;
          background: radial-gradient(circle at 35% 30%, var(--seal-base) 0%, var(--seal-mid) 55%, var(--seal-edge) 100%);
          box-shadow:
            inset 0 0 0 1.2px var(--seal-edge),
            inset 0 -4px 8px rgba(0,0,0,0.35),
            inset 0 4px 6px rgba(255,210,170,0.2),
            0 6px 16px rgba(20,10,5,0.55);
          transition: transform 280ms ease, box-shadow 280ms ease, filter 280ms ease;
        }
        .atlas-seal-disc::before {
          content: '';
          position: absolute;
          inset: 5px;
          border-radius: 50%;
          border: 1px solid rgba(244,205,142,0.55);
          pointer-events: none;
        }
        .atlas-seal-disc::after {
          content: '';
          position: absolute;
          inset: 2px;
          border-radius: 50%;
          border: 1px solid rgba(58,12,8,0.55);
          pointer-events: none;
        }
        .atlas-seal-highlight {
          position: absolute;
          top: 6px;
          left: 12px;
          right: 12px;
          height: 14px;
          border-radius: 50%;
          background: radial-gradient(ellipse at 50% 0%, rgba(255,220,190,0.55), rgba(255,220,190,0) 70%);
          pointer-events: none;
        }
        .atlas-seal-icon {
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #fbeacb;
          z-index: 1;
          transition: transform 280ms ease;
        }

        .atlas-seal-plaque {
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 6px 14px 5px;
          border-radius: 4px;
          background: linear-gradient(180deg, #f6edd3 0%, #e8d6af 55%, #cbb189 100%);
          border: 1.2px solid #6a4b2a;
          box-shadow: 0 3px 8px rgba(0,0,0,0.35);
          font-family: Georgia, 'Times New Roman', serif;
          line-height: 1.1;
          white-space: nowrap;
          min-width: 130px;
          transform: translateY(-2px);
          transition: transform 280ms ease, box-shadow 280ms ease;
        }
        .atlas-seal-label {
          font-size: 11.5px;
          font-weight: 700;
          letter-spacing: 0.15em;
          color: #2f2114;
        }
        .atlas-seal-sub {
          font-size: 10px;
          font-style: italic;
          color: #6b4f31;
          margin-top: 1px;
        }

        /* Hover / focus polish */
        .atlas-seal:hover .atlas-seal-disc,
        .atlas-seal:focus-visible .atlas-seal-disc {
          transform: scale(1.07);
          box-shadow:
            inset 0 0 0 1.2px var(--seal-edge),
            inset 0 -4px 8px rgba(0,0,0,0.35),
            inset 0 4px 6px rgba(255,210,170,0.25),
            0 0 18px var(--seal-glow),
            0 10px 22px rgba(20,10,5,0.6);
        }
        .atlas-seal:hover .atlas-seal-icon,
        .atlas-seal:focus-visible .atlas-seal-icon {
          transform: scale(1.1);
        }
        .atlas-seal:hover .atlas-seal-plaque,
        .atlas-seal:focus-visible .atlas-seal-plaque {
          transform: translateY(0) scale(1.04);
          box-shadow: 0 6px 14px rgba(0,0,0,0.45);
        }
        .atlas-seal:active .atlas-seal-disc { transform: scale(1.02); }

        @keyframes atlasFrameEnter {
          0%   { opacity: 0; transform: translateY(10px) scale(0.995); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes titleReveal {
          0%   { opacity: 0; transform: translateY(-8px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        @keyframes mapReveal {
          0%   { opacity: 0; transform: scale(0.985); }
          100% { opacity: 1; transform: scale(1); }
        }
        @keyframes sealIntro {
          0%   { opacity: 0; transform: translate(-50%, -42%) scale(0.85); }
          60%  { opacity: 1; transform: translate(-50%, -52%) scale(1.06); }
          100% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
        }
        @keyframes compassDrift {
          0%   { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes compassBreath {
          0%, 100% { transform: scale(1); }
          50%      { transform: scale(1.03); }
        }
        @keyframes shimmerSlide {
          0%   { background-position: -100% 0; }
          100% { background-position: 200% 0; }
        }
        @keyframes lightDrift {
          0%   { background-position: 0% 0%; }
          100% { background-position: 14% 8%; }
        }

        @media (prefers-reduced-motion: reduce) {
          .atlas-root,
          .atlas-frame,
          .atlas-title-wrap,
          .atlas-stage,
          .atlas-compass-rim,
          .atlas-compass-star,
          .atlas-water-shimmer,
          .atlas-light,
          .atlas-seal {
            animation: none !important;
            transition: none !important;
          }
          .atlas-seal { opacity: 1; }
        }
      `}</style>
    </div>
  )
}
