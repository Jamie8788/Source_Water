import { useNavigate } from 'react-router-dom'
import { useState } from 'react'
import {
  LayoutDashboard, Sparkles, Map, Bell, BarChart3,
  Users, BookOpen, Zap, TrendingUp, Microscope,
  Droplets, Cloud, Gamepad2, Compass, MapIcon,
} from 'lucide-react'

const ACTIONS = [
  { label: 'Dashboard', description: 'Overview & insights', path: '/dashboard', icon: LayoutDashboard, color: 'from-blue-500 to-blue-600', position: 'top-1/4 left-1/3', delay: 0 },
  { label: 'Ask Water AI', description: 'Talk to Water AI', path: '/ask-water', icon: Sparkles, color: 'from-purple-500 to-purple-600', position: 'top-1/3 right-1/4', delay: 100 },
  { label: 'Live Map', description: 'Explore Great Lakes', path: '/map', icon: Map, color: 'from-cyan-500 to-cyan-600', position: 'bottom-1/4 left-1/4', delay: 200 },
  { label: 'Alerts', description: 'Stay notified', path: '/alerts', icon: Bell, color: 'from-amber-500 to-amber-600', position: 'top-1/3 left-1/6', delay: 300 },
  { label: 'Reports', description: 'Stats & trends', path: '/reports', icon: BarChart3, color: 'from-indigo-500 to-indigo-600', position: 'bottom-1/3 right-1/5', delay: 400 },
  { label: 'Community', description: 'Connect & share', path: '/social', icon: Users, color: 'from-pink-500 to-pink-600', position: 'bottom-1/4 left-1/6', delay: 500 },
  { label: 'Resources', description: 'Learn & explore', path: '/resources', icon: BookOpen, color: 'from-green-500 to-green-600', position: 'top-1/2 left-1/12', delay: 600 },
  { label: 'Quiz & Learn', description: 'Test yourself', path: '/quiz', icon: Zap, color: 'from-orange-500 to-orange-600', position: 'bottom-1/3 left-1/2', delay: 700 },
  { label: 'Data Analysis', description: 'Deep dive analytics', path: '/analysis', icon: TrendingUp, color: 'from-indigo-500 to-indigo-600', position: 'top-2/5 right-1/6', delay: 800 },
  { label: 'Research Hub', description: 'Projects & tools', path: '/research', icon: Microscope, color: 'from-violet-500 to-violet-600', position: 'bottom-2/5 right-1/4', delay: 900 },
  { label: 'Projects', description: 'Build & track', path: '/projects', icon: MapIcon, color: 'from-teal-500 to-teal-600', position: 'bottom-1/4 right-1/3', delay: 1000 },
  { label: 'Weather', description: 'Conditions & forecasts', path: '/weather', icon: Cloud, color: 'from-blue-400 to-blue-500', position: 'top-1/4 right-1/3', delay: 1100 },
  { label: 'Games', description: 'Water activities', path: '/games', icon: Gamepad2, color: 'from-rose-500 to-rose-600', position: 'bottom-1/3 right-1/12', delay: 1200 },
]

function ActionHotspot({ action }) {
  const navigate = useNavigate()
  const [hoveredId, setHoveredId] = useState(null)
  const isHovered = hoveredId === action.label

  return (
    <div
      key={action.label}
      className={`absolute ${action.position} transform -translate-x-1/2 -translate-y-1/2 z-20 transition-all duration-300`}
      style={{ transitionDelay: `${action.delay}ms` }}
      onMouseEnter={() => setHoveredId(action.label)}
      onMouseLeave={() => setHoveredId(null)}
    >
      {/* Outer glow aura */}
      <div
        className={`absolute inset-0 rounded-full blur-xl opacity-0 transition-all duration-500 bg-gradient-to-br ${action.color}`}
        style={{
          width: isHovered ? '120px' : '80px',
          height: isHovered ? '120px' : '80px',
          transform: 'translate(-50%, -50%)',
          left: '50%',
          top: '50%',
          opacity: isHovered ? 0.6 : 0.2,
        }}
      />

      {/* Main badge */}
      <button
        onClick={() => navigate(action.path)}
        className={`relative w-20 h-20 rounded-xl shadow-2xl transition-all duration-300 cursor-pointer group
          border border-white/20 backdrop-blur-sm
          ${isHovered ? 'scale-110 shadow-2xl' : 'scale-100'}
          hover:border-white/40 active:scale-95
          bg-gradient-to-br ${action.color}
          before:absolute before:inset-0 before:rounded-xl before:bg-white/10 before:opacity-0 before:transition-opacity before:duration-300
          hover:before:opacity-100
        `}
      >
        {/* Icon */}
        <div className="absolute inset-0 flex items-center justify-center">
          <action.icon className="w-9 h-9 text-white drop-shadow-lg" strokeWidth={1.5} />
        </div>

        {/* Shimmer effect on hover */}
        {isHovered && (
          <div className="absolute inset-0 rounded-xl overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-pulse" />
          </div>
        )}
      </button>

      {/* Label tooltip */}
      <div
        className={`absolute left-1/2 top-full mt-3 -translate-x-1/2 whitespace-nowrap pointer-events-none transition-all duration-300 ${
          isHovered ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2'
        }`}
      >
        <div className="bg-slate-900/95 backdrop-blur-sm text-white px-3 py-2 rounded-lg border border-white/20 shadow-xl">
          <div className="text-sm font-semibold">{action.label}</div>
          <div className="text-xs text-white/60">{action.description}</div>
        </div>
        {/* Tooltip arrow */}
        <div className="absolute left-1/2 -top-1 -translate-x-1/2 w-2 h-2 bg-slate-900/95 border-t border-l border-white/20 rotate-45" />
      </div>
    </div>
  )
}

export default function QuickActions() {
  return (
    <div className="relative w-full min-h-screen overflow-hidden bg-slate-950">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-slate-900 via-slate-950 to-slate-900 opacity-60" />

      {/* Parchment texture overlay */}
      <div className="absolute inset-0 opacity-40 mix-blend-multiply" style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg width='100' height='100' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='a'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.8' result='noise' /%3E%3C/filter%3E%3Crect width='100' height='100' fill='%23d2b48c' filter='url(%23a)' opacity='.15'/%3E%3C/svg%3E")`,
        backgroundRepeat: 'repeat',
      }} />

      {/* Subtle animated background lights */}
      <div className="absolute top-20 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '8s' }} />
      <div className="absolute bottom-20 right-1/4 w-80 h-80 bg-purple-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '10s', animationDelay: '2s' }} />

      {/* Central map container */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="relative w-full max-w-4xl aspect-square">
          {/* Map background with ancient aesthetic */}
          <svg className="w-full h-full" viewBox="0 0 800 800" xmlns="http://www.w3.org/2000/svg" style={{ filter: 'drop-shadow(0 0 40px rgba(15, 23, 42, 0.8))' }}>
            {/* Parchment base */}
            <defs>
              <filter id="glow">
                <feGaussianBlur stdDeviation="3" result="coloredBlur" />
                <feMerge>
                  <feMergeNode in="coloredBlur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
              <filter id="waterGlow">
                <feGaussianBlur stdDeviation="4" result="coloredBlur" />
                <feMerge>
                  <feMergeNode in="coloredBlur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
              <linearGradient id="parchmentGradient">
                <stop offset="0%" stopColor="#2d2b4d" />
                <stop offset="50%" stopColor="#1e1b4b" />
                <stop offset="100%" stopColor="#1a1838" />
              </linearGradient>
            </defs>

            {/* Parchment background */}
            <rect width="800" height="800" fill="#1e1b4b" rx="20" />
            <rect width="800" height="800" fill="url(#parchmentGradient)" rx="20" opacity="0.7" />

            {/* Water areas - Great Lakes */}
            <g filter="url(#waterGlow)">
              {/* Lake Superior */}
              <ellipse cx="200" cy="180" rx="90" ry="110" fill="#0d47a1" opacity="0.8" />
              <ellipse cx="200" cy="180" rx="85" ry="105" fill="#1565c0" opacity="0.6" />

              {/* Lake Michigan */}
              <ellipse cx="320" cy="280" rx="60" ry="100" fill="#0d47a1" opacity="0.8" />
              <ellipse cx="320" cy="280" rx="55" ry="95" fill="#1565c0" opacity="0.6" />

              {/* Lake Huron */}
              <ellipse cx="420" cy="240" rx="80" ry="95" fill="#0d47a1" opacity="0.8" />
              <ellipse cx="420" cy="240" rx="75" ry="90" fill="#1565c0" opacity="0.6" />

              {/* Lake Erie */}
              <ellipse cx="380" cy="420" rx="100" ry="50" fill="#0d47a1" opacity="0.8" />
              <ellipse cx="380" cy="420" rx="95" ry="45" fill="#1565c0" opacity="0.6" />

              {/* Lake Ontario */}
              <ellipse cx="520" cy="350" rx="65" ry="75" fill="#0d47a1" opacity="0.8" />
              <ellipse cx="520" cy="350" rx="60" ry="70" fill="#1565c0" opacity="0.6" />
            </g>

            {/* Land areas */}
            <g fill="#2d3142" opacity="0.9">
              <path d="M 100 100 L 600 80 L 650 200 L 700 150 L 750 300 L 700 400 L 650 350 L 600 450 L 500 500 L 350 520 L 150 480 L 80 400 Z" />
            </g>

            {/* Decorative compass rose */}
            <g transform="translate(150, 650)" opacity="0.6">
              <circle cx="0" cy="0" r="40" fill="none" stroke="#594b2e" strokeWidth="1" />
              <line x1="0" y1="-40" x2="0" y2="40" stroke="#594b2e" strokeWidth="1.5" />
              <line x1="-40" y1="0" x2="40" y2="0" stroke="#594b2e" strokeWidth="1.5" />
              <polygon points="0,-45 3,-35 -3,-35" fill="#d4a574" />
              <text x="0" y="-50" textAnchor="middle" fill="#d4a574" fontSize="12" fontWeight="bold">N</text>
            </g>

            {/* Decorative frame edges */}
            <g stroke="#594b2e" strokeWidth="2" fill="none" opacity="0.4">
              <line x1="20" y1="20" x2="60" y2="20" />
              <line x1="20" y1="20" x2="20" y2="60" />
              <line x1="780" y1="20" x2="740" y2="20" />
              <line x1="780" y1="20" x2="780" y2="60" />
              <line x1="20" y1="780" x2="60" y2="780" />
              <line x1="20" y1="780" x2="20" y2="740" />
              <line x1="780" y1="780" x2="740" y2="780" />
              <line x1="780" y1="780" x2="780" y2="740" />
            </g>

            {/* Title cartouche */}
            <g transform="translate(400, 740)">
              <rect x="-120" y="-25" width="240" height="50" fill="#1e1b4b" stroke="#594b2e" strokeWidth="2" rx="8" />
              <text x="0" y="8" textAnchor="middle" fill="#d4a574" fontSize="20" fontWeight="bold" fontFamily="serif">
                Explorer's Dashboard
              </text>
            </g>
          </svg>

          {/* Action hotspots positioned over map */}
          {ACTIONS.map((action) => (
            <ActionHotspot key={action.label} action={action} />
          ))}
        </div>
      </div>

      {/* Bottom info bar */}
      <div className="absolute bottom-0 left-0 right-0 px-8 py-6 bg-gradient-to-t from-slate-950 to-transparent border-t border-white/10 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div>
            <h3 className="text-white font-semibold text-lg mb-1">Welcome to SOURCE Water</h3>
            <p className="text-white/60 text-sm">Your guide to Great Lakes water quality. Hover over any site and click to explore.</p>
          </div>
          <div className="text-right text-sm text-white/50">
            Premium Interactive Dashboard
          </div>
        </div>
      </div>

      {/* Responsive adjustments */}
      <style>{`
        @media (max-width: 768px) {
          .max-w-4xl {
            max-w-2xl;
          }
        }

        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-8px); }
        }

        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }

        .animate-shimmer {
          animation: shimmer 2s infinite;
        }
      `}</style>
    </div>
  )
}
