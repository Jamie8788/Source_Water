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

const MAP_ACTIONS = [
  {
    label: 'Dashboard',
    description: 'Command Ledger',
    path: '/dashboard',
    icon: LayoutDashboard,
    x: 31,
    y: 34,
    markerStyle: 'seal',
  },
  {
    label: 'Live Map',
    description: 'Harbor Chart',
    path: '/map',
    icon: Map,
    x: 26,
    y: 56,
    markerStyle: 'crest',
  },
  {
    label: 'Ask Water',
    description: 'AI Navigator',
    path: '/ask-water',
    icon: Sparkles,
    x: 61,
    y: 31,
    markerStyle: 'seal',
  },
  {
    label: 'Community',
    description: 'Guild Posts',
    path: '/social',
    icon: Users,
    x: 42,
    y: 62,
    markerStyle: 'crest',
  },
  {
    label: 'Reports',
    description: 'Data Summary',
    path: '/reports',
    icon: BarChart3,
    x: 67,
    y: 53,
    markerStyle: 'seal',
  },
  {
    label: 'Research',
    description: 'Projects Hub',
    path: '/research',
    icon: Microscope,
    x: 76,
    y: 38,
    markerStyle: 'crest',
  },
  {
    label: 'Resources',
    description: 'Learning Archive',
    path: '/resources',
    icon: BookOpen,
    x: 56,
    y: 67,
    markerStyle: 'seal',
  },
]

function MarkerPlaque({ label, description, active }) {
  return (
    <div
      className={`pointer-events-none absolute left-1/2 top-full mt-2 -translate-x-1/2 whitespace-nowrap transition-all duration-500 ${
        active ? 'opacity-100 translate-y-0 scale-100' : 'opacity-82 translate-y-0.5 scale-[0.985]'
      }`}
    >
      <div className="relative overflow-hidden rounded-sm border border-amber-900/50 bg-gradient-to-b from-amber-100 via-amber-200 to-amber-300 px-3.5 py-1.5 text-center shadow-[0_6px_18px_rgba(60,35,16,0.38)]">
        <span className="pointer-events-none absolute inset-0 opacity-30" style={{ backgroundImage: 'linear-gradient(to bottom, rgba(255,255,255,0.45), rgba(255,255,255,0.04) 42%, rgba(85,52,19,0.22))' }} />
        <span className="pointer-events-none absolute inset-[2px] rounded-[2px] border border-amber-900/25" />
        <div className="relative text-[11px] font-semibold uppercase tracking-[0.14em] text-amber-950">
          {label}
        </div>
        <div className="relative text-[9px] tracking-[0.08em] text-amber-900">{description}</div>
      </div>
    </div>
  )
}

function MapMarker({ action, index, ready, setHoveredAction }) {
  const navigate = useNavigate()
  const [hovered, setHovered] = useState(false)
  const [focused, setFocused] = useState(false)
  const Icon = action.icon
  const active = hovered || focused
  const sealClasses =
    action.markerStyle === 'seal'
      ? 'from-rose-800 via-red-700 to-amber-700 border-amber-200/70'
      : 'from-slate-800 via-cyan-900 to-teal-800 border-amber-200/60'

  const handleEnter = () => {
    setHovered(true)
    setHoveredAction(action.label)
  }

  const handleLeave = () => {
    setHovered(false)
    setHoveredAction(prev => (prev === action.label ? null : prev))
  }

  return (
    <div
      className={`absolute z-20 map-marker-shell ${ready ? 'is-ready' : ''} ${active ? 'is-active' : ''}`}
      style={{
        left: `${action.x}%`,
        top: `${action.y}%`,
        transform: 'translate(-50%, -50%)',
        animationDelay: `${260 + index * 95}ms`,
      }}
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
    >
      <button
        aria-label={action.label}
        onClick={() => navigate(action.path)}
        onFocus={() => {
          setFocused(true)
          setHoveredAction(action.label)
        }}
        onBlur={() => {
          setFocused(false)
          setHoveredAction(prev => (prev === action.label ? null : prev))
        }}
        className={`relative h-12 w-12 cursor-pointer rounded-full border bg-gradient-to-br ${sealClasses} text-amber-50 transition-all duration-500 ${
          active
            ? 'scale-[1.14] shadow-[0_0_26px_rgba(170,124,59,0.46),0_10px_26px_rgba(35,18,9,0.52)]'
            : 'scale-100 shadow-[0_5px_14px_rgba(44,20,10,0.46)]'
        }`}
        style={{ transitionTimingFunction: 'cubic-bezier(0.22, 1, 0.36, 1)' }}
      >
        <span className="pointer-events-none absolute -inset-3 rounded-full marker-halo" />
        <span className="pointer-events-none absolute -inset-1 rounded-full marker-breath" />
        <span className="absolute inset-[3px] rounded-full border border-amber-100/35" />
        <span className="absolute left-1/2 top-full h-2 w-2 -translate-x-1/2 rotate-45 border-r border-b border-amber-200/70 bg-amber-800/90" />
        <span className="absolute inset-0 flex items-center justify-center">
          <Icon size={17} strokeWidth={1.9} />
        </span>
      </button>
      <MarkerPlaque label={action.label} description={action.description} active={active} />
    </div>
  )
}

export default function QuickActions() {
  const [ready, setReady] = useState(false)
  const [hoveredAction, setHoveredAction] = useState(null)

  useEffect(() => {
    const id = requestAnimationFrame(() => setReady(true))
    return () => cancelAnimationFrame(id)
  }, [])

  const ROUTES = [
    {
      id: 'north-route',
      d: 'M301 347 C379 313 483 342 563 389',
      linked: ['Dashboard', 'Live Map', 'Ask Water', 'Community'],
    },
    {
      id: 'east-route',
      d: 'M598 407 C666 376 754 390 822 449',
      linked: ['Ask Water', 'Reports', 'Research'],
    },
    {
      id: 'south-route',
      d: 'M489 577 C575 607 677 592 786 548',
      linked: ['Community', 'Resources', 'Reports'],
    },
  ]

  return (
    <div className={`min-h-screen bg-[#d7c39a] px-4 py-6 md:px-8 md:py-8 atlas-root ${ready ? 'is-ready' : ''}`}>
      <div className="mx-auto w-full max-w-6xl rounded-lg border-4 border-[#5a3f22] bg-[#e4d0a9] p-3 shadow-[0_16px_34px_rgba(64,40,18,0.35)] md:p-5 atlas-frame">
        <div className="relative overflow-hidden rounded-md border border-[#6a4d2a] bg-[#ead8b2] p-3 md:p-6 atlas-inner">
          <div className="pointer-events-none absolute inset-0 atlas-vignette" />
          <div className="pointer-events-none absolute inset-0 atlas-dust" />
          <div className="pointer-events-none absolute inset-0 atlas-light" />

          <div
            className="absolute inset-0 opacity-35"
            style={{
              backgroundImage:
                "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180' viewBox='0 0 180 180'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.92' numOctaves='2'/%3E%3C/filter%3E%3Crect width='180' height='180' filter='url(%23n)' opacity='0.2'/%3E%3C/svg%3E\")",
            }}
          />

          <div className="relative mb-4 text-center md:mb-6 atlas-title-wrap">
            <div className="mx-auto inline-block rounded-sm border border-[#6a4d2a] bg-gradient-to-b from-[#efe1c2] to-[#d4bc8e] px-5 py-3 shadow-[0_4px_12px_rgba(66,44,22,0.25)] atlas-title">
              <span className="pointer-events-none absolute inset-0 atlas-title-sheen" />
              <h1 className="text-xl font-semibold uppercase tracking-[0.16em] text-[#3f2a17] md:text-2xl">
                Great Lakes Explorer Chart
              </h1>
              <p className="mt-1 text-[11px] tracking-[0.14em] text-[#6b4f31] md:text-xs">
                Source Water Navigation Atlas
              </p>
            </div>
          </div>

          <div className="relative mx-auto aspect-[12/9] w-full max-w-5xl rounded-sm border-2 border-[#5a3f22] bg-[#e7d5ad] shadow-[inset_0_0_0_1px_rgba(88,55,24,0.35)] atlas-map-stage">
            <div className="pointer-events-none absolute inset-[3%] rounded-sm atlas-water-shimmer" />
            <svg
              viewBox="0 0 1200 900"
              className="h-full w-full atlas-map-svg"
              xmlns="http://www.w3.org/2000/svg"
              aria-label="Antique Great Lakes map"
            >
              <defs>
                <linearGradient id="landTone" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#efddb6" />
                  <stop offset="100%" stopColor="#d7be8d" />
                </linearGradient>
                <linearGradient id="waterTone" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#315e74" />
                  <stop offset="100%" stopColor="#234b5f" />
                </linearGradient>
                <linearGradient id="routeGlow" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#91724a" stopOpacity="0.2" />
                  <stop offset="50%" stopColor="#9e7b50" stopOpacity="0.65" />
                  <stop offset="100%" stopColor="#91724a" stopOpacity="0.2" />
                </linearGradient>
              </defs>

              <rect x="20" y="20" width="1160" height="860" rx="10" fill="url(#landTone)" />

              <path
                d="M154 146 L397 116 L591 140 L720 127 L816 160 L845 228 L783 270 L705 287 L652 329 L602 348 L514 348 L445 320 L359 286 L282 258 L198 213 Z"
                fill="#dcc291"
                stroke="#5b3f24"
                strokeOpacity="0.32"
                strokeWidth="3"
              />
              <path
                d="M448 360 L624 346 L717 370 L779 423 L760 510 L678 577 L566 626 L434 644 L334 620 L248 554 L220 470 L256 404 L343 361 Z"
                fill="#d4b885"
                stroke="#5b3f24"
                strokeOpacity="0.36"
                strokeWidth="3"
              />

              <path
                d="M256 235 C322 170 415 167 530 187 C559 197 551 222 511 234 C441 258 356 256 280 242 Z"
                fill="url(#waterTone)"
                stroke="#1d2f3d"
                strokeWidth="4"
              />
              <path
                d="M445 254 C470 216 522 225 545 255 C559 286 552 354 532 418 C514 473 476 514 443 496 C420 471 423 381 432 310 Z"
                fill="url(#waterTone)"
                stroke="#1d2f3d"
                strokeWidth="4"
              />
              <path
                d="M548 276 C603 228 672 241 725 286 C733 340 689 390 638 430 C592 448 554 430 540 390 C535 348 533 308 548 276 Z"
                fill="url(#waterTone)"
                stroke="#1d2f3d"
                strokeWidth="4"
              />
              <path
                d="M520 498 C590 478 658 489 724 520 C741 554 719 572 677 583 C616 598 551 602 492 580 C475 552 485 518 520 498 Z"
                fill="url(#waterTone)"
                stroke="#1d2f3d"
                strokeWidth="4"
              />
              <path
                d="M740 456 C796 444 853 466 890 509 C892 548 865 584 819 594 C769 596 726 575 704 539 C705 509 719 477 740 456 Z"
                fill="url(#waterTone)"
                stroke="#1d2f3d"
                strokeWidth="4"
              />

              {ROUTES.map(route => {
                const routeActive = hoveredAction && route.linked.includes(hoveredAction)
                return (
                  <g key={route.id} className={`route-group ${ready ? 'is-ready' : ''} ${routeActive ? 'is-active' : ''}`}>
                    <path d={route.d} stroke="url(#routeGlow)" strokeWidth="3" fill="none" strokeDasharray="8 9" className="route-base" />
                    <path d={route.d} stroke="#c7a26b" strokeWidth="2.3" fill="none" strokeDasharray="8 10" className="route-shimmer" />
                  </g>
                )
              })}

              <g fill="#3e2a18" fontSize="21" fontFamily="Georgia, 'Times New Roman', serif" fontStyle="italic" opacity="0.9">
                <text x="355" y="210">Lake Superior</text>
                <text x="465" y="365">Lake Michigan</text>
                <text x="603" y="334">Lake Huron</text>
                <text x="565" y="560">Lake Erie</text>
                <text x="770" y="532">Lake Ontario</text>
              </g>

              <g transform="translate(150,715)" className="compass-rose">
                <circle cx="0" cy="0" r="70" fill="none" stroke="#5f4426" strokeWidth="2.5" />
                <circle cx="0" cy="0" r="49" fill="none" stroke="#5f4426" strokeWidth="1.5" />
                <line x1="0" y1="-69" x2="0" y2="69" stroke="#5f4426" strokeWidth="2.2" />
                <line x1="-69" y1="0" x2="69" y2="0" stroke="#5f4426" strokeWidth="2.2" />
                <polygon points="0,-86 7,-56 -7,-56" fill="#6e4d2a" />
                <polygon points="0,86 7,56 -7,56" fill="#6e4d2a" />
                <polygon points="-86,0 -56,-7 -56,7" fill="#6e4d2a" />
                <polygon points="86,0 56,-7 56,7" fill="#6e4d2a" />
                <text x="0" y="-98" textAnchor="middle" fill="#4a311a" fontSize="20" fontFamily="Georgia, 'Times New Roman', serif">N</text>
              </g>

              <g transform="translate(902,722)">
                <path d="M0 20 C38 -10 72 -8 106 20 C88 42 66 52 43 54 C25 56 10 48 0 20 Z" fill="#5c3f23" opacity="0.55" />
                <path d="M47 1 L58 31 L33 31 Z" fill="#5c3f23" opacity="0.75" />
                <path d="M26 32 L80 32" stroke="#e5d3ae" strokeWidth="2" opacity="0.7" />
              </g>

              <g stroke="#6d4f2e" strokeWidth="5" fill="none" opacity="0.55">
                <path d="M36 52 L90 52 L90 36" />
                <path d="M1164 52 L1110 52 L1110 36" />
                <path d="M36 848 L90 848 L90 864" />
                <path d="M1164 848 L1110 848 L1110 864" />
              </g>
            </svg>

            {MAP_ACTIONS.map((action, index) => (
              <MapMarker
                key={action.label}
                action={action}
                index={index}
                ready={ready}
                setHoveredAction={setHoveredAction}
              />
            ))}
          </div>
        </div>
      </div>

      <style>{`
        .atlas-root {
          opacity: 0;
          transform: translateY(8px);
          transition: opacity 700ms cubic-bezier(0.22, 1, 0.36, 1), transform 900ms cubic-bezier(0.22, 1, 0.36, 1);
        }

        .atlas-root.is-ready {
          opacity: 1;
          transform: translateY(0);
        }

        .atlas-frame {
          position: relative;
          overflow: hidden;
          animation: atlasFrameEnter 950ms cubic-bezier(0.22, 1, 0.36, 1) both;
        }

        .atlas-inner {
          box-shadow: inset 0 2px 0 rgba(255, 247, 228, 0.28), inset 0 -20px 50px rgba(48, 31, 15, 0.11);
        }

        .atlas-vignette {
          background: radial-gradient(circle at 50% 42%, rgba(255, 255, 255, 0) 41%, rgba(62, 36, 15, 0.17) 100%);
          mix-blend-mode: multiply;
        }

        .atlas-light {
          background: radial-gradient(circle at 12% 14%, rgba(255, 243, 210, 0.32) 0%, rgba(255, 243, 210, 0.06) 34%, transparent 72%);
          animation: atlasLightDrift 13s ease-in-out infinite;
        }

        .atlas-dust {
          background-image:
            radial-gradient(circle at 14% 20%, rgba(255, 240, 208, 0.18) 0 1px, transparent 1px),
            radial-gradient(circle at 78% 34%, rgba(97, 63, 28, 0.12) 0 1px, transparent 1px),
            radial-gradient(circle at 62% 74%, rgba(255, 233, 196, 0.14) 0 1px, transparent 1px);
          background-size: 170px 170px, 220px 220px, 280px 280px;
          animation: atlasDustShift 28s linear infinite;
          opacity: 0.35;
        }

        .atlas-title-wrap {
          opacity: 0;
          transform: translateY(-8px);
          animation: titleReveal 760ms cubic-bezier(0.22, 1, 0.36, 1) 110ms forwards;
        }

        .atlas-title {
          position: relative;
          overflow: hidden;
        }

        .atlas-title-sheen {
          transform: translateX(-120%);
          background: linear-gradient(95deg, transparent 0%, rgba(255, 250, 232, 0.35) 45%, transparent 100%);
          animation: cartoucheSheen 8.5s ease-in-out infinite;
        }

        .atlas-map-stage {
          opacity: 0;
          transform: scale(0.99);
          animation: mapReveal 980ms cubic-bezier(0.22, 1, 0.36, 1) 190ms forwards;
        }

        .atlas-map-svg {
          filter: drop-shadow(0 2px 2px rgba(53, 31, 12, 0.16));
        }

        .atlas-water-shimmer {
          background:
            linear-gradient(115deg, rgba(197, 229, 242, 0) 0%, rgba(197, 229, 242, 0.075) 45%, rgba(197, 229, 242, 0) 70%),
            radial-gradient(circle at 62% 43%, rgba(190, 221, 233, 0.08), transparent 58%);
          mix-blend-mode: screen;
          animation: waterShimmer 9s ease-in-out infinite;
        }

        .route-group .route-base {
          opacity: 0.62;
        }

        .route-group .route-shimmer {
          opacity: 0;
          stroke-dashoffset: 44;
          filter: blur(0.2px);
        }

        .route-group.is-ready .route-base {
          animation: routeDraw 950ms cubic-bezier(0.2, 0.85, 0.2, 1) forwards;
        }

        .route-group.is-ready .route-shimmer {
          opacity: 0.32;
          animation: routeTravel 5.4s linear infinite;
        }

        .route-group.is-active .route-base {
          opacity: 0.95;
          stroke-width: 3.6;
          transition: all 380ms cubic-bezier(0.22, 1, 0.36, 1);
        }

        .route-group.is-active .route-shimmer {
          opacity: 0.68;
          stroke: #d8b178;
        }

        .compass-rose {
          transform-origin: 150px 715px;
          animation: compassDrift 8.5s ease-in-out infinite;
          filter: drop-shadow(0 3px 6px rgba(74, 48, 21, 0.22));
        }

        .map-marker-shell {
          opacity: 0;
          transform: translate(-50%, -50%) translateY(7px) scale(0.97);
          transition: transform 420ms cubic-bezier(0.22, 1, 0.36, 1), opacity 520ms cubic-bezier(0.22, 1, 0.36, 1);
        }

        .map-marker-shell.is-ready {
          opacity: 1;
          transform: translate(-50%, -50%) translateY(0) scale(1);
          animation: markerIntro 640ms cubic-bezier(0.2, 0.8, 0.2, 1) both, markerFloat 4.8s ease-in-out infinite;
        }

        .map-marker-shell.is-active {
          transform: translate(-50%, -50%) translateY(-4px);
        }

        .marker-halo {
          border: 1px solid rgba(247, 216, 160, 0.18);
          box-shadow: 0 0 0 rgba(237, 186, 114, 0);
          animation: haloPulse 3.4s ease-in-out infinite;
          transition: all 380ms cubic-bezier(0.22, 1, 0.36, 1);
        }

        .map-marker-shell.is-active .marker-halo {
          border-color: rgba(247, 220, 171, 0.56);
          box-shadow: 0 0 0 9px rgba(223, 174, 104, 0.13);
        }

        .marker-breath {
          box-shadow: inset 0 0 11px rgba(248, 214, 158, 0.18);
          opacity: 0.75;
          transition: opacity 350ms ease;
        }

        .map-marker-shell.is-active .marker-breath {
          opacity: 1;
        }

        @keyframes atlasFrameEnter {
          0% { opacity: 0; transform: translateY(10px) scale(0.995); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }

        @keyframes titleReveal {
          0% { opacity: 0; transform: translateY(-8px); }
          100% { opacity: 1; transform: translateY(0); }
        }

        @keyframes mapReveal {
          0% { opacity: 0; transform: scale(0.99); }
          100% { opacity: 1; transform: scale(1); }
        }

        @keyframes routeDraw {
          0% { stroke-dasharray: 1 120; opacity: 0; }
          100% { stroke-dasharray: 8 9; opacity: 0.62; }
        }

        @keyframes routeTravel {
          0% { stroke-dashoffset: 52; }
          100% { stroke-dashoffset: -52; }
        }

        @keyframes markerIntro {
          0% { opacity: 0; transform: translate(-50%, -50%) translateY(8px) scale(0.95); }
          100% { opacity: 1; transform: translate(-50%, -50%) translateY(0) scale(1); }
        }

        @keyframes markerFloat {
          0%, 100% { transform: translate(-50%, -50%) translateY(0); }
          50% { transform: translate(-50%, -50%) translateY(-2.5px); }
        }

        @keyframes haloPulse {
          0%, 100% { opacity: 0.65; transform: scale(1); }
          50% { opacity: 0.95; transform: scale(1.045); }
        }

        @keyframes compassDrift {
          0%, 100% { transform: rotate(0deg) translateY(0); }
          50% { transform: rotate(1.2deg) translateY(-1px); }
        }

        @keyframes waterShimmer {
          0%, 100% { transform: translateX(-1.5%); opacity: 0.58; }
          50% { transform: translateX(1.3%); opacity: 0.85; }
        }

        @keyframes atlasLightDrift {
          0%, 100% { transform: translate3d(0, 0, 0); opacity: 0.72; }
          50% { transform: translate3d(8px, -4px, 0); opacity: 0.92; }
        }

        @keyframes atlasDustShift {
          0% { background-position: 0 0, 0 0, 0 0; }
          100% { background-position: 140px 60px, -120px 100px, 90px -110px; }
        }

        @keyframes cartoucheSheen {
          0%, 16% { transform: translateX(-130%); opacity: 0; }
          25% { transform: translateX(40%); opacity: 1; }
          36%, 100% { transform: translateX(140%); opacity: 0; }
        }

        @media (prefers-reduced-motion: reduce) {
          .atlas-root,
          .atlas-frame,
          .atlas-title-wrap,
          .atlas-map-stage,
          .route-group .route-base,
          .route-group .route-shimmer,
          .compass-rose,
          .map-marker-shell,
          .map-marker-shell.is-ready,
          .marker-halo,
          .atlas-water-shimmer,
          .atlas-light,
          .atlas-dust,
          .atlas-title-sheen {
            animation: none !important;
            transition: none !important;
            transform: none !important;
          }
        }
      `}</style>
    </div>
  )
}
