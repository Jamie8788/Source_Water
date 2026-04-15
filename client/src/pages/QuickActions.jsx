import { useNavigate } from 'react-router-dom'
import { useState } from 'react'
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
      className={`pointer-events-none absolute left-1/2 top-full mt-2 -translate-x-1/2 whitespace-nowrap transition-all duration-300 ${
        active ? 'opacity-100 translate-y-0' : 'opacity-85'
      }`}
    >
      <div className="rounded-sm border border-amber-900/45 bg-gradient-to-b from-amber-100 to-amber-200 px-3 py-1 text-center shadow-[0_3px_12px_rgba(60,35,16,0.35)]">
        <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-amber-950">
          {label}
        </div>
        <div className="text-[9px] tracking-[0.08em] text-amber-900">{description}</div>
      </div>
    </div>
  )
}

function MapMarker({ action }) {
  const navigate = useNavigate()
  const [hovered, setHovered] = useState(false)
  const Icon = action.icon
  const sealClasses =
    action.markerStyle === 'seal'
      ? 'from-rose-800 via-red-700 to-amber-700 border-amber-200/70'
      : 'from-slate-800 via-cyan-900 to-teal-800 border-amber-200/60'

  return (
    <div
      className="absolute z-20"
      style={{
        left: `${action.x}%`,
        top: `${action.y}%`,
        transform: 'translate(-50%, -50%)',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <button
        aria-label={action.label}
        onClick={() => navigate(action.path)}
        className={`relative h-12 w-12 rounded-full border bg-gradient-to-br ${sealClasses} text-amber-50 transition-all duration-300 ${
          hovered
            ? 'scale-110 shadow-[0_0_18px_rgba(154,109,48,0.45)]'
            : 'scale-100 shadow-[0_4px_12px_rgba(44,20,10,0.45)]'
        }`}
      >
        <span className="absolute inset-[3px] rounded-full border border-amber-100/35" />
        <span className="absolute left-1/2 top-full h-2 w-2 -translate-x-1/2 rotate-45 border-r border-b border-amber-200/70 bg-amber-800/90" />
        <span className="absolute inset-0 flex items-center justify-center">
          <Icon size={17} strokeWidth={1.9} />
        </span>
      </button>
      <MarkerPlaque label={action.label} description={action.description} active={hovered} />
    </div>
  )
}

export default function QuickActions() {
  return (
    <div className="min-h-screen bg-[#d7c39a] px-4 py-6 md:px-8 md:py-8">
      <div className="mx-auto w-full max-w-6xl rounded-lg border-4 border-[#5a3f22] bg-[#e4d0a9] p-3 shadow-[0_16px_34px_rgba(64,40,18,0.35)] md:p-5">
        <div className="relative overflow-hidden rounded-md border border-[#6a4d2a] bg-[#ead8b2] p-3 md:p-6">
          <div
            className="absolute inset-0 opacity-35"
            style={{
              backgroundImage:
                "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180' viewBox='0 0 180 180'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.92' numOctaves='2'/%3E%3C/filter%3E%3Crect width='180' height='180' filter='url(%23n)' opacity='0.2'/%3E%3C/svg%3E\")",
            }}
          />

          <div className="relative mb-4 text-center md:mb-6">
            <div className="mx-auto inline-block rounded-sm border border-[#6a4d2a] bg-gradient-to-b from-[#efe1c2] to-[#d4bc8e] px-5 py-3 shadow-[0_4px_12px_rgba(66,44,22,0.25)]">
              <h1 className="text-xl font-semibold uppercase tracking-[0.16em] text-[#3f2a17] md:text-2xl">
                Great Lakes Explorer Chart
              </h1>
              <p className="mt-1 text-[11px] tracking-[0.14em] text-[#6b4f31] md:text-xs">
                Source Water Navigation Atlas
              </p>
            </div>
          </div>

          <div className="relative mx-auto aspect-[12/9] w-full max-w-5xl rounded-sm border-2 border-[#5a3f22] bg-[#e7d5ad] shadow-[inset_0_0_0_1px_rgba(88,55,24,0.35)]">
            <svg
              viewBox="0 0 1200 900"
              className="h-full w-full"
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

              <path d="M301 347 C379 313 483 342 563 389" stroke="url(#routeGlow)" strokeWidth="3" fill="none" strokeDasharray="8 9" />
              <path d="M598 407 C666 376 754 390 822 449" stroke="url(#routeGlow)" strokeWidth="3" fill="none" strokeDasharray="8 9" />
              <path d="M489 577 C575 607 677 592 786 548" stroke="url(#routeGlow)" strokeWidth="3" fill="none" strokeDasharray="8 9" />

              <g fill="#3e2a18" fontSize="21" fontFamily="Georgia, 'Times New Roman', serif" fontStyle="italic" opacity="0.9">
                <text x="355" y="210">Lake Superior</text>
                <text x="465" y="365">Lake Michigan</text>
                <text x="603" y="334">Lake Huron</text>
                <text x="565" y="560">Lake Erie</text>
                <text x="770" y="532">Lake Ontario</text>
              </g>

              <g transform="translate(150,715)">
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

            {MAP_ACTIONS.map((action) => (
              <MapMarker key={action.label} action={action} />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
