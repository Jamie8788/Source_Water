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

// Anchor positions on the SVG (1200×900). The wax-seal markers are
// rendered with foreignObject so they sit ON the SVG and inherit the
// same transform / pan-zoom as everything else on the chart.
const MAP_ACTIONS = [
  { label: 'Dashboard', description: 'Master Ledger',     path: '/dashboard',  icon: LayoutDashboard, x: 360, y: 360 },
  { label: 'Live Map',   description: 'Global Marine Chart', path: '/monitoring', icon: Map,            x: 295, y: 545 },
  { label: 'Ask Water',  description: 'AI Navigator Hub',  path: '/ask-water',  icon: Sparkles,        x: 760, y: 295 },
  { label: 'Community',  description: 'Guild Forum Posts', path: '/social',     icon: Users,           x: 555, y: 600 },
  { label: 'Reports',    description: 'Statistical Summary', path: '/reports',  icon: BarChart3,       x: 870, y: 525 },
  { label: 'Research',   description: 'Projects & Data Hub', path: '/research', icon: Microscope,      x: 985, y: 410 },
  { label: 'Resources',  description: 'Educational Archive', path: '/resources', icon: BookOpen,       x: 695, y: 660 },
]

// ── Wax-seal marker plus floating brass plaque label ─────────────────────────
function WaxSeal({ action, index, ready, hovered, setHovered }) {
  const navigate = useNavigate()
  const Icon = action.icon
  const isHover = hovered === action.label

  return (
    <g
      className={`wax-marker ${ready ? 'is-ready' : ''} ${isHover ? 'is-active' : ''}`}
      style={{ animationDelay: `${260 + index * 95}ms` }}
      transform={`translate(${action.x}, ${action.y})`}
      onMouseEnter={() => setHovered(action.label)}
      onMouseLeave={() => setHovered((p) => (p === action.label ? null : p))}
      onClick={() => navigate(action.path)}
      onFocus={() => setHovered(action.label)}
      onBlur={() => setHovered((p) => (p === action.label ? null : p))}
      role="button"
      tabIndex={0}
      aria-label={action.label}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate(action.path) } }}
    >
      {/* Wax drip shadow on parchment */}
      <ellipse cx="2" cy="6" rx="34" ry="8" fill="rgba(40,18,8,0.42)" filter="blur(2px)" />

      {/* Wax base — irregular blob, two-tone red */}
      <path
        d="M-30 -2
           C-32 -22  -16 -34   2 -33
           C 22 -32   33 -18   31  -1
           C 33  16   18  29   -1 30
           C-22  31  -34  16  -30 -2 Z"
        fill="url(#waxBase)"
        stroke="#3a0c08"
        strokeWidth="1.4"
        className="wax-blob"
      />
      {/* Inner ring stamped into the wax */}
      <circle r="20" fill="none" stroke="rgba(244,205,142,0.55)" strokeWidth="0.9" />
      <circle r="22.5" fill="none" stroke="rgba(58,12,8,0.65)" strokeWidth="0.6" />

      {/* Top-light highlight */}
      <path
        d="M-22 -16 C-12 -26  10 -28  20 -18"
        fill="none" stroke="rgba(255,210,170,0.55)" strokeWidth="2" strokeLinecap="round"
      />

      {/* Icon — rendered via foreignObject so we can use lucide-react */}
      <foreignObject x="-12" y="-12" width="24" height="24" className="wax-icon">
        <div xmlns="http://www.w3.org/1999/xhtml" style={{ width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fbeacb' }}>
          <Icon size={18} strokeWidth={2.1} />
        </div>
      </foreignObject>

      {/* Brass plaque under the seal */}
      <g transform="translate(0, 60)" className="wax-plaque">
        <rect x="-72" y="-22" width="144" height="44" rx="3" fill="url(#plaqueGradient)" stroke="#5a3f22" strokeWidth="1.4" />
        <rect x="-69" y="-19" width="138" height="38" rx="2" fill="none" stroke="rgba(90,63,34,0.45)" strokeWidth="0.7" />
        <text x="0" y="-3" textAnchor="middle" fontFamily="Georgia, 'Times New Roman', serif" fontSize="12" fontWeight="700" letterSpacing="2" fill="#3f2a17">
          {action.label.toUpperCase()}
        </text>
        <text x="0" y="13" textAnchor="middle" fontFamily="Georgia, 'Times New Roman', serif" fontSize="9.5" fontStyle="italic" fill="#6b4f31">
          {action.description}
        </text>
      </g>
    </g>
  )
}

export default function QuickActions() {
  const [ready, setReady]     = useState(false)
  const [hovered, setHovered] = useState(null)

  useEffect(() => {
    const id = requestAnimationFrame(() => setReady(true))
    return () => cancelAnimationFrame(id)
  }, [])

  return (
    <div className={`min-h-screen px-2 py-4 md:px-6 md:py-6 atlas-root ${ready ? 'is-ready' : ''}`}
      style={{ background: '#1a0f08' }}>
      <div className="mx-auto w-full max-w-[1280px] atlas-frame">

        {/* Cartouche-style title scroll above the chart */}
        <div className="relative mx-auto mb-4 flex items-center justify-center gap-4 atlas-title-wrap">
          <div className="hidden md:block" style={{ filter: 'drop-shadow(0 4px 10px rgba(0,0,0,0.45))' }}>
            <NibiMascotImage mood="walking" size={92} />
          </div>
          <div className="relative inline-block px-7 py-3 atlas-title">
            <svg viewBox="0 0 380 70" className="absolute inset-0 h-full w-full" preserveAspectRatio="none" aria-hidden="true">
              <defs>
                <linearGradient id="scrollFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#f3e0b6"/>
                  <stop offset="50%" stopColor="#e8cf95"/>
                  <stop offset="100%" stopColor="#c9ac74"/>
                </linearGradient>
              </defs>
              <path d="M10 12 C40 4 340 4 370 12 L368 58 C338 66 42 66 12 58 Z"
                fill="url(#scrollFill)" stroke="#5a3f22" strokeWidth="1.2"/>
              <path d="M2 12 C 6 18 6 52 2 58 L 16 56 L 16 14 Z" fill="#9a7f55" stroke="#5a3f22" strokeWidth="0.8"/>
              <path d="M378 12 C374 18 374 52 378 58 L 364 56 L 364 14 Z" fill="#9a7f55" stroke="#5a3f22" strokeWidth="0.8"/>
            </svg>
            <h1 className="relative text-xl font-bold uppercase tracking-[0.20em] text-[#3f2a17] md:text-2xl text-center" style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}>
              Source Water — Atlas
            </h1>
            <p className="relative mt-0.5 text-[10px] tracking-[0.18em] text-[#6b4f31] text-center md:text-xs" style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontStyle: 'italic' }}>
              Great Lakes Navigator's Chart
            </p>
          </div>
        </div>

        {/* Map stage */}
        <div className="relative mx-auto aspect-[16/10] w-full atlas-map-stage rounded-md overflow-hidden"
          style={{
            border: '14px solid transparent',
            borderImage: 'url("data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 100 100\' preserveAspectRatio=\'none\'><rect x=\'0\' y=\'0\' width=\'100\' height=\'100\' fill=\'%23231408\'/></svg>") 14',
            boxShadow: '0 24px 50px rgba(0,0,0,0.55), inset 0 0 90px rgba(58,32,12,0.55)',
            background: '#d4b885',
          }}>
          <div className="pointer-events-none absolute inset-0 atlas-vignette" />
          <div className="pointer-events-none absolute inset-0 atlas-dust" />
          <div className="pointer-events-none absolute inset-0 atlas-light" />
          <div className="pointer-events-none absolute inset-0 atlas-water-shimmer" />

          <svg
            viewBox="0 0 1200 900"
            className="h-full w-full atlas-map-svg"
            xmlns="http://www.w3.org/2000/svg"
            aria-label="Vintage Great Lakes navigation chart"
          >
            <defs>
              {/* Aged parchment fill */}
              <radialGradient id="parchment" cx="50%" cy="40%" r="80%">
                <stop offset="0%"   stopColor="#f3dfb7"/>
                <stop offset="55%"  stopColor="#dec18a"/>
                <stop offset="100%" stopColor="#a98559"/>
              </radialGradient>

              {/* Deep navy water with subtle gradient */}
              <linearGradient id="navyWater" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%"   stopColor="#1f3a52"/>
                <stop offset="50%"  stopColor="#16273a"/>
                <stop offset="100%" stopColor="#0c1c2c"/>
              </linearGradient>

              {/* Land tone */}
              <linearGradient id="landTone" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"   stopColor="#e2c794"/>
                <stop offset="100%" stopColor="#c2a370"/>
              </linearGradient>

              {/* Wax seal red */}
              <radialGradient id="waxBase" cx="35%" cy="30%" r="80%">
                <stop offset="0%"   stopColor="#a8201d"/>
                <stop offset="55%"  stopColor="#7a0e0c"/>
                <stop offset="100%" stopColor="#3a0808"/>
              </radialGradient>

              {/* Brass plaque gradient */}
              <linearGradient id="plaqueGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"   stopColor="#f0d99c"/>
                <stop offset="50%"  stopColor="#e3c177"/>
                <stop offset="100%" stopColor="#a17d44"/>
              </linearGradient>

              {/* Compass rose gradient */}
              <linearGradient id="compassMetal" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"   stopColor="#d9b87a"/>
                <stop offset="100%" stopColor="#7a5a31"/>
              </linearGradient>

              {/* Aged paper grain filter */}
              <filter id="paper" x="0" y="0" width="100%" height="100%">
                <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed="3"/>
                <feColorMatrix values="0 0 0 0 0.32  0 0 0 0 0.18  0 0 0 0 0.06  0 0 0 0.18 0"/>
                <feComposite in2="SourceGraphic" operator="in"/>
              </filter>

              {/* Soft route glow */}
              <linearGradient id="routeGlow" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%"   stopColor="#91724a" stopOpacity="0.2"/>
                <stop offset="50%"  stopColor="#7a0e0c" stopOpacity="0.65"/>
                <stop offset="100%" stopColor="#91724a" stopOpacity="0.2"/>
              </linearGradient>
            </defs>

            {/* Background parchment */}
            <rect x="0" y="0" width="1200" height="900" fill="url(#parchment)"/>
            <rect x="0" y="0" width="1200" height="900" fill="url(#parchment)" filter="url(#paper)" opacity="0.55"/>

            {/* Latitude / longitude grid lines (faint) */}
            <g stroke="#7a5a31" strokeWidth="0.5" opacity="0.22">
              {[150, 300, 450, 600, 750].map(y => <line key={`h${y}`} x1="40" y1={y} x2="1160" y2={y}/>)}
              {[200, 400, 600, 800, 1000].map(x => <line key={`v${x}`} x1={x} y1="60" x2={x} y2="840"/>)}
            </g>
            {/* Latitude labels */}
            <g fill="#5a3f22" fontFamily="Georgia, 'Times New Roman', serif" fontStyle="italic" fontSize="10" opacity="0.6">
              <text x="50" y="146">LATITUDE 48°N</text>
              <text x="50" y="296">LATITUDE 46°N</text>
              <text x="50" y="446">LATITUDE 44°N</text>
            </g>

            {/* Land masses around the lakes (loose painted-style outlines) */}
            <path
              d="M40 60 L200 100 L260 180 L300 240 L340 220 L420 200 L500 250
                 L600 240 L640 200 L740 220 L820 200 L900 240 L1000 220
                 L1080 280 L1160 260 L1160 60 Z"
              fill="url(#landTone)" stroke="#6a4a25" strokeWidth="2.5" strokeOpacity="0.55"/>
            <path
              d="M40 840 L40 660 L120 600 L240 660 L380 700 L500 720
                 L640 740 L780 720 L900 700 L1040 720 L1160 660 L1160 840 Z"
              fill="url(#landTone)" stroke="#6a4a25" strokeWidth="2.5" strokeOpacity="0.55"/>
            <path
              d="M40 60 L40 840 L160 760 L200 600 L160 480 L120 360 L160 240 L40 60 Z"
              fill="url(#landTone)" stroke="#6a4a25" strokeWidth="2.5" strokeOpacity="0.55"/>
            <path
              d="M1160 60 L1160 840 L1080 720 L1040 580 L1080 460 L1120 320 L1080 200 L1160 60 Z"
              fill="url(#landTone)" stroke="#6a4a25" strokeWidth="2.5" strokeOpacity="0.55"/>

            {/* ── Great Lakes — more accurate silhouettes ── */}
            {/* Lake Superior */}
            <path
              d="M220 230 C320 180 470 175 600 200 C710 215 760 245 740 285
                 C710 320 620 335 510 330 C400 330 310 310 240 290 C200 275 195 250 220 230 Z"
              fill="url(#navyWater)" stroke="#0a1422" strokeWidth="3" className="lake-superior"/>

            {/* Lake Michigan (vertical) */}
            <path
              d="M430 305 C420 290 460 280 490 290 C520 300 530 350 525 420
                 C520 490 510 555 480 580 C455 600 420 590 410 555
                 C400 510 405 440 415 380 C420 345 425 320 430 305 Z"
              fill="url(#navyWater)" stroke="#0a1422" strokeWidth="3" className="lake-michigan"/>

            {/* Lake Huron */}
            <path
              d="M580 280 C660 270 740 290 790 320 C820 360 800 410 760 440
                 C720 460 660 460 620 430 C580 400 565 360 565 320 C570 300 575 290 580 280 Z"
              fill="url(#navyWater)" stroke="#0a1422" strokeWidth="3" className="lake-huron"/>

            {/* Lake Erie */}
            <path
              d="M540 540 C640 520 760 530 850 555 C880 575 870 600 830 615
                 C760 635 660 635 580 620 C530 610 510 590 510 575 C515 555 525 545 540 540 Z"
              fill="url(#navyWater)" stroke="#0a1422" strokeWidth="3" className="lake-erie"/>

            {/* Lake Ontario */}
            <path
              d="M860 480 C920 470 980 480 1010 510 C1030 540 1010 575 970 590
                 C920 600 870 590 840 570 C820 550 825 510 845 490 C850 485 855 482 860 480 Z"
              fill="url(#navyWater)" stroke="#0a1422" strokeWidth="3" className="lake-ontario"/>

            {/* Subtle wave hatching on lakes */}
            <g stroke="#a8c6d8" strokeWidth="0.6" opacity="0.18" fill="none" className="wave-hatch">
              <path d="M260 250 C300 245 340 248 380 250"/>
              <path d="M290 280 C330 275 370 278 410 280"/>
              <path d="M450 350 C460 360 462 380 458 400"/>
              <path d="M460 420 C465 440 460 460 450 478"/>
              <path d="M620 320 C660 318 700 320 740 325"/>
              <path d="M580 580 C640 575 700 580 760 585"/>
              <path d="M620 605 C680 602 720 605 770 608"/>
              <path d="M880 530 C920 528 960 532 990 540"/>
            </g>

            {/* Antique sea-route paths between markers */}
            <g className={`route-group ${ready ? 'is-ready' : ''}`}>
              <path d="M360 380 C 460 470 540 540 555 600" stroke="url(#routeGlow)" strokeWidth="2.4" fill="none" strokeDasharray="6 8" className="route-base"/>
              <path d="M360 380 C 540 360 660 320 760 295" stroke="url(#routeGlow)" strokeWidth="2.4" fill="none" strokeDasharray="6 8" className="route-base"/>
              <path d="M760 295 C 850 340 920 380 985 410" stroke="url(#routeGlow)" strokeWidth="2.4" fill="none" strokeDasharray="6 8" className="route-base"/>
              <path d="M555 600 C 620 640 660 660 695 660" stroke="url(#routeGlow)" strokeWidth="2.4" fill="none" strokeDasharray="6 8" className="route-base"/>
              <path d="M695 660 C 780 620 830 580 870 525" stroke="url(#routeGlow)" strokeWidth="2.4" fill="none" strokeDasharray="6 8" className="route-base"/>
              <path d="M295 545 C 400 580 480 595 555 600" stroke="url(#routeGlow)" strokeWidth="2.4" fill="none" strokeDasharray="6 8" className="route-base"/>
            </g>

            {/* Lake labels — italic serif */}
            <g fill="#1a2a3d" fontFamily="Georgia, 'Times New Roman', serif" fontStyle="italic" opacity="0.92" pointerEvents="none">
              <text x="380" y="265" fontSize="22" fill="#e8d4a6">Lake Superior</text>
              <text x="430" y="445" fontSize="18" fill="#e8d4a6">Lake Michigan</text>
              <text x="640" y="365" fontSize="18" fill="#e8d4a6">Lake Huron</text>
              <text x="600" y="585" fontSize="16" fill="#e8d4a6">Lake Erie</text>
              <text x="870" y="540" fontSize="16" fill="#e8d4a6">Lake Ontario</text>
            </g>

            {/* Tiny illustrated ship that drifts gently across the chart */}
            <g className="ship-drift" transform="translate(680, 470)">
              <path d="M-14 4 L14 4 L11 10 L-11 10 Z" fill="#3a2515" stroke="#1a0d05" strokeWidth="0.6"/>
              <line x1="0" y1="4" x2="0" y2="-14" stroke="#1a0d05" strokeWidth="0.8"/>
              <path d="M0 -14 L8 -4 L0 -4 Z" fill="#f2dca6" stroke="#5a3f22" strokeWidth="0.5"/>
              <path d="M0 -10 L-7 -3 L0 -3 Z" fill="#e9d09a" stroke="#5a3f22" strokeWidth="0.5"/>
            </g>

            {/* ── Compass rose (bottom-left) ── */}
            <g transform="translate(155, 760)" className="compass-rose">
              <circle r="68" fill="rgba(255,240,200,0.35)" stroke="#5a3f22" strokeWidth="1.5"/>
              <circle r="60" fill="none" stroke="#5a3f22" strokeWidth="0.8" strokeDasharray="2 4"/>
              <circle r="44" fill="none" stroke="#5a3f22" strokeWidth="0.6"/>
              {/* 8-point cardinal/intercardinal star */}
              <g className="compass-star">
                <polygon points="0,-66 8,-12 0,-4 -8,-12" fill="url(#compassMetal)" stroke="#3a2515" strokeWidth="0.6"/>
                <polygon points="0,66  8, 12 0, 4 -8, 12" fill="#7a5a31" stroke="#3a2515" strokeWidth="0.6"/>
                <polygon points="-66,0 -12,-8 -4,0 -12,8" fill="#9c7843" stroke="#3a2515" strokeWidth="0.6"/>
                <polygon points="66, 0  12,-8  4,0  12,8" fill="#b39056" stroke="#3a2515" strokeWidth="0.6"/>
                <polygon points="-46,-46 -10,-6 -6,-10" fill="#7a5a31" opacity="0.85"/>
                <polygon points=" 46,-46  10,-6  6,-10" fill="#7a5a31" opacity="0.85"/>
                <polygon points="-46, 46 -10, 6 -6, 10" fill="#7a5a31" opacity="0.85"/>
                <polygon points=" 46, 46  10, 6  6, 10" fill="#7a5a31" opacity="0.85"/>
              </g>
              <text x="0"  y="-72" textAnchor="middle" fill="#3a2515" fontSize="14" fontFamily="Georgia, 'Times New Roman', serif" fontWeight="700">N</text>
              <text x="76" y="5"   textAnchor="middle" fill="#3a2515" fontSize="13" fontFamily="Georgia, 'Times New Roman', serif">E</text>
              <text x="0"  y="84"  textAnchor="middle" fill="#3a2515" fontSize="13" fontFamily="Georgia, 'Times New Roman', serif">S</text>
              <text x="-76" y="5"  textAnchor="middle" fill="#3a2515" fontSize="13" fontFamily="Georgia, 'Times New Roman', serif">W</text>
              {/* Slowly-rotating outer rim */}
              <g className="compass-rim">
                {[...Array(36)].map((_, i) => (
                  <line key={i} x1="0" y1="-68" x2="0" y2={i % 9 === 0 ? -76 : -72}
                    stroke="#5a3f22" strokeWidth="0.6" transform={`rotate(${i * 10})`}/>
                ))}
              </g>
            </g>

            {/* ── Brass sextant top-right ── */}
            <g transform="translate(1010, 130) rotate(-15)" className="sextant" opacity="0.92">
              <path d="M-58 36 A 70 70 0 0 1 58 36 L 50 50 L -50 50 Z" fill="#7a5a31" stroke="#2a1a0a" strokeWidth="1.2"/>
              <path d="M-46 38 A 56 56 0 0 1 46 38 L 38 46 L -38 46 Z" fill="#b88e4f" stroke="#2a1a0a" strokeWidth="0.8"/>
              <line x1="-50" y1="50" x2="50" y2="50" stroke="#2a1a0a" strokeWidth="1.4"/>
              <line x1="-46" y1="46" x2="46" y2="46" stroke="#5a3f22" strokeWidth="0.5" strokeDasharray="2 2"/>
              <circle cx="0" cy="50" r="5" fill="#3a2515" stroke="#2a1a0a"/>
              <line x1="0" y1="50" x2="34" y2="-2" stroke="#3a2515" strokeWidth="2" className="sextant-arm"/>
              <circle cx="34" cy="-2" r="3" fill="#d6b87a" stroke="#3a2515"/>
              <rect x="-5" y="-3" width="10" height="14" fill="#3a2515" stroke="#2a1a0a"/>
            </g>

            {/* ── Brass microscope bottom-right ── */}
            <g transform="translate(1030, 700)" className="microscope" opacity="0.9">
              <rect x="-30" y="56" width="60" height="10" fill="#7a5a31" stroke="#2a1a0a" strokeWidth="0.8"/>
              <path d="M-10 56 L-14 30 L 14 30 L 10 56 Z" fill="#a07640" stroke="#2a1a0a" strokeWidth="0.8"/>
              <rect x="-6" y="0" width="12" height="34" fill="#7a5a31" stroke="#2a1a0a" strokeWidth="0.8"/>
              <rect x="-22" y="-12" width="44" height="14" rx="2" fill="#a07640" stroke="#2a1a0a" strokeWidth="0.8"/>
              <rect x="-3" y="-26" width="6" height="14" fill="#5a3f22" stroke="#2a1a0a" strokeWidth="0.6"/>
              <circle cx="0" cy="-30" r="6" fill="#d6b87a" stroke="#2a1a0a" strokeWidth="0.6"/>
              <rect x="-18" y="38" width="36" height="6" fill="#5a3f22" stroke="#2a1a0a" strokeWidth="0.5"/>
            </g>

            {/* Rendered wax-seal markers ON the SVG so they pan / scale together */}
            {MAP_ACTIONS.map((action, i) => (
              <WaxSeal
                key={action.label}
                action={action}
                index={i}
                ready={ready}
                hovered={hovered}
                setHovered={setHovered}
              />
            ))}

            {/* Corner brackets for the framed look */}
            <g stroke="#3a2515" strokeWidth="3" fill="none" opacity="0.7">
              <path d="M28 28 L80 28 M28 28 L28 80"/>
              <path d="M1172 28 L1120 28 M1172 28 L1172 80"/>
              <path d="M28 872 L80 872 M28 872 L28 820"/>
              <path d="M1172 872 L1120 872 M1172 872 L1172 820"/>
            </g>
          </svg>
        </div>
      </div>

      <style>{`
        .atlas-root {
          opacity: 0;
          transform: translateY(8px);
          transition: opacity 700ms cubic-bezier(0.22, 1, 0.36, 1), transform 900ms cubic-bezier(0.22, 1, 0.36, 1);
        }
        .atlas-root.is-ready { opacity: 1; transform: translateY(0); }

        .atlas-frame { animation: atlasFrameEnter 950ms cubic-bezier(0.22, 1, 0.36, 1) both; }

        .atlas-vignette {
          background: radial-gradient(circle at 50% 42%, rgba(255,255,255,0) 38%, rgba(40,20,8,0.35) 100%);
          mix-blend-mode: multiply;
        }
        .atlas-light {
          background: radial-gradient(circle at 14% 16%, rgba(255,243,210,0.28) 0%, rgba(255,243,210,0.05) 32%, transparent 70%);
          animation: lightDrift 24s ease-in-out infinite alternate;
        }
        .atlas-dust {
          background-image:
            radial-gradient(circle at 14% 20%, rgba(255,240,208,0.18) 0 1px, transparent 1px),
            radial-gradient(circle at 78% 34%, rgba(97,63,28,0.12) 0 1px, transparent 1px),
            radial-gradient(circle at 62% 74%, rgba(255,233,196,0.14) 0 1px, transparent 1px);
          background-size: 170px 170px, 220px 220px, 280px 280px;
          opacity: 0.4;
        }
        .atlas-water-shimmer {
          background:
            linear-gradient(115deg, rgba(180,210,225,0) 0%, rgba(180,210,225,0.06) 45%, rgba(180,210,225,0) 70%);
          mix-blend-mode: screen;
          opacity: 0.55;
          animation: shimmerSlide 14s linear infinite;
        }

        .atlas-title-wrap {
          opacity: 0;
          transform: translateY(-8px);
          animation: titleReveal 760ms cubic-bezier(0.22, 1, 0.36, 1) 110ms forwards;
        }
        .atlas-map-stage {
          opacity: 0;
          transform: scale(0.985);
          animation: mapReveal 980ms cubic-bezier(0.22, 1, 0.36, 1) 190ms forwards;
        }

        .route-group .route-base { opacity: 0.65; stroke-dashoffset: 0; }
        .route-group.is-ready .route-base { animation: routeFlow 22s linear infinite; }

        /* Compass: outer rim drifts very slowly, star pulses subtly on hover-anywhere */
        .compass-rose { transform-origin: 155px 760px; filter: drop-shadow(0 3px 6px rgba(74,48,21,0.32)); }
        .compass-rim { transform-origin: 0 0; animation: compassDrift 60s linear infinite; }
        .compass-star { transform-origin: 0 0; animation: compassBreath 8s ease-in-out infinite; }

        .sextant      { animation: sextantSway 9s ease-in-out infinite alternate; transform-origin: 1010px 166px; }
        .sextant-arm  { animation: sextantArm 6s ease-in-out infinite alternate; transform-origin: 0 50px; }
        .microscope   { animation: microscopeBreath 7s ease-in-out infinite alternate; transform-origin: 1030px 720px; }

        /* Ship drifts in a small loop along the central waterway */
        .ship-drift   { animation: shipDrift 28s ease-in-out infinite; transform-origin: 680px 470px; }

        /* Wave hatching ripples gently */
        .wave-hatch   { animation: waveSway 11s ease-in-out infinite alternate; }

        /* Wax seal hover */
        .wax-marker {
          opacity: 0;
          transform-origin: center;
          transform: scale(0.92) translateY(8px);
          transition: transform 420ms cubic-bezier(0.22, 1, 0.36, 1), opacity 520ms cubic-bezier(0.22, 1, 0.36, 1);
          cursor: pointer;
        }
        .wax-marker.is-ready {
          opacity: 1;
          transform: scale(1) translateY(0);
          animation: markerIntro 480ms cubic-bezier(0.2, 0.8, 0.2, 1) both;
        }
        .wax-marker .wax-blob { transition: filter 280ms ease, transform 280ms ease; }
        .wax-marker.is-active .wax-blob {
          filter: drop-shadow(0 0 10px rgba(247,210,150,0.55)) drop-shadow(0 0 20px rgba(170,30,30,0.45));
          transform: scale(1.05);
        }
        .wax-marker .wax-icon { transition: transform 280ms ease; }
        .wax-marker.is-active .wax-icon { transform: scale(1.1); }
        .wax-marker .wax-plaque { transition: transform 280ms ease, filter 280ms ease; }
        .wax-marker.is-active .wax-plaque {
          transform: translate(0px, 64px) scale(1.04);
          filter: drop-shadow(0 6px 14px rgba(0,0,0,0.45));
        }

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
        @keyframes markerIntro {
          0%   { opacity: 0; transform: scale(0.85) translateY(10px); }
          60%  { opacity: 1; transform: scale(1.05) translateY(-2px); }
          100% { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes routeFlow {
          0%   { stroke-dashoffset: 0; }
          100% { stroke-dashoffset: -280; }
        }
        @keyframes compassDrift {
          0%   { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes compassBreath {
          0%, 100% { transform: scale(1); }
          50%      { transform: scale(1.03); }
        }
        @keyframes sextantSway {
          0%   { transform: translate(1010px, 130px) rotate(-15deg); }
          100% { transform: translate(1010px, 130px) rotate(-12deg); }
        }
        @keyframes sextantArm {
          0%   { transform: rotate(-2deg); }
          100% { transform: rotate(2deg); }
        }
        @keyframes microscopeBreath {
          0%   { transform: translate(1030px, 700px) translateY(0); }
          100% { transform: translate(1030px, 700px) translateY(-2px); }
        }
        @keyframes shipDrift {
          0%   { transform: translate(680px, 470px) rotate(-2deg); }
          25%  { transform: translate(720px, 460px) rotate(0deg); }
          50%  { transform: translate(750px, 470px) rotate(2deg); }
          75%  { transform: translate(710px, 480px) rotate(0deg); }
          100% { transform: translate(680px, 470px) rotate(-2deg); }
        }
        @keyframes waveSway {
          0%   { transform: translate(0, 0); opacity: 0.18; }
          100% { transform: translate(2px, -1px); opacity: 0.26; }
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
          .atlas-map-stage,
          .route-group .route-base,
          .compass-rim,
          .compass-star,
          .sextant,
          .sextant-arm,
          .microscope,
          .ship-drift,
          .wave-hatch,
          .atlas-water-shimmer,
          .atlas-light,
          .atlas-dust,
          .wax-marker {
            animation: none !important;
            transition: none !important;
            transform: none !important;
          }
        }
      `}</style>
    </div>
  )
}
