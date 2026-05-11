import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useCMS } from '../context/CMSContext'
import CMSField from '../components/cms/CMSField'
import api from '../utils/api'
import { getAllLocations } from '../api/waterRangers'
import {
  Map, Sparkles, BellRing, Users, FlaskConical, BookOpen,
  Joystick, Bell, TrendingUp, Activity, AlertTriangle, Droplets,
  ChevronRight, Award, Zap, ArrowUpRight, GraduationCap,
  LineChart, CloudSun, BarChart2, Shield
} from 'lucide-react'
import PageAmbience from '../components/layout/PageAmbience'

/* ── Animated number counter ── */
function AnimatedNumber({ value, prefix = '', suffix = '' }) {
  const [display, setDisplay] = useState(0)
  const prev = useRef(0)
  useEffect(() => {
    const from = prev.current
    const to = value || 0
    prev.current = to
    if (from === to) return
    let start = null
    const step = (ts) => {
      if (!start) start = ts
      const p = Math.min((ts - start) / 600, 1)
      const ease = 1 - Math.pow(1 - p, 3)
      setDisplay(Math.floor(from + (to - from) * ease))
      if (p < 1) requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
  }, [value])
  return <>{prefix}{display.toLocaleString()}{suffix}</>
}

/* ── Spark line mini chart ── */
function Sparkline({ data, color }) {
  if (!data?.length) return null
  const min = Math.min(...data), max = Math.max(...data)
  const range = max - min || 1
  const w = 80, h = 28
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / range) * h}`)
  return (
    <svg width={w} height={h} style={{ overflow: 'visible' }}>
      <polyline points={pts.join(' ')} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <polyline points={`0,${h} ${pts.join(' ')} ${w},${h}`} fill={color} fillOpacity="0.1" stroke="none"/>
    </svg>
  )
}

/* ── KPI Card ── */
function KPICard({ icon: Icon, label, value, sub, trend, color, spark, onClick }) {
  return (
    <div onClick={onClick} className={`card p-5 flex flex-col gap-3 transition-all duration-200 ${onClick ? 'cursor-pointer hover:shadow-lg hover:-translate-y-0.5' : ''}`}
      style={onClick ? { '--hover-border': color } : {}}>
      <div className="flex items-start justify-between">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: color + '18' }}>
          <Icon className="w-5 h-5" style={{ color }}/>
        </div>
        {trend !== undefined && (
          <span className={`text-xs font-bold px-2 py-1 rounded-full flex items-center gap-1 ${trend >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-500'}`}>
            <TrendingUp className={`w-3 h-3 ${trend < 0 ? 'rotate-180' : ''}`}/>
            {trend >= 0 ? '+' : ''}{trend}%
          </span>
        )}
      </div>
      <div>
        <div className="text-2xl font-black" style={{ color: 'var(--text)' }}>
          <AnimatedNumber value={typeof value === 'number' ? value : 0}/>
          {typeof value === 'string' ? value : ''}
        </div>
        <div className="text-sm font-medium mt-0.5" style={{ color: 'var(--text-muted)' }}>{label}</div>
        {sub && <div className="text-xs mt-0.5" style={{ color: 'var(--text-light)' }}>{sub}</div>}
      </div>
      {spark && <Sparkline data={spark} color={color}/>}
    </div>
  )
}

/* ── Quick Action Card ──
   Tiles mirror the sidebar 1:1 (same paths, same labels) so navigating
   from Dashboard never lands on a replaced/legacy page. Tiles whose route
   currently renders <ComingSoon> get a "Soon" badge so users know what
   they're clicking before they get there. */
const ACTIONS = [
  { id: 'monitoring', icon: Map,            label: 'Site Map',         desc: 'Live Water Rangers network',       path: '/monitoring', gradient: 'linear-gradient(135deg,#0ea5e9,#14b8a6)', shadow: 'rgba(20,184,166,0.3)' },
  { id: 'ai',         icon: Sparkles,       label: 'Ask Water (AI)',   desc: 'Chat · scan · analyze',            path: '/ask-water',  gradient: 'linear-gradient(135deg,#8b5cf6,#ec4899)', shadow: 'rgba(139,92,246,0.3)' },
  { id: 'social',     icon: Users,          label: 'Community',        desc: 'Posts · DMs · leaderboard',        path: '/social',     gradient: 'linear-gradient(135deg,#10b981,#14b8a6)', shadow: 'rgba(16,185,129,0.3)' },
  { id: 'quiz',       icon: GraduationCap,  label: 'Quiz Yourself',    desc: 'Earn points · test knowledge',     path: '/quiz',       gradient: 'linear-gradient(135deg,#f472b6,#a78bfa)', shadow: 'rgba(244,114,182,0.3)' },
  { id: 'games',      icon: Joystick,       label: 'Games',            desc: 'Fun for all',                      path: '/games',      gradient: 'linear-gradient(135deg,#84cc16,#10b981)', shadow: 'rgba(132,204,22,0.3)' },
  { id: 'weather',    icon: CloudSun,       label: 'World Environment',desc: 'Live conditions',                  path: '/weather',    gradient: 'linear-gradient(135deg,#0ea5e9,#6366f1)', shadow: 'rgba(99,102,241,0.3)' },
  { id: 'alerts',     icon: BellRing,       label: 'Alerts',           desc: 'Threshold warnings',               path: '/alerts',     gradient: 'linear-gradient(135deg,#f59e0b,#ef4444)', shadow: 'rgba(245,158,11,0.3)', soon: true },
  { id: 'resources',  icon: BookOpen,       label: 'Resources',        desc: 'Guides · articles · links',        path: '/resources',  gradient: 'linear-gradient(135deg,#06b6d4,#3b82f6)', shadow: 'rgba(6,182,212,0.3)',   soon: true },
  { id: 'explorer',   icon: LineChart,      label: 'Dive into Data',   desc: 'Observation details',              path: '/explorer',   gradient: 'linear-gradient(135deg,#14b8a6,#0ea5e9)', shadow: 'rgba(20,184,166,0.3)', soon: true },
  { id: 'ai-lab',     icon: FlaskConical,   label: 'Wet Lab',          desc: 'Reports · advanced AI',            path: '/ai-lab',     gradient: 'linear-gradient(135deg,#a855f7,#8b5cf6)', shadow: 'rgba(168,85,247,0.3)', soon: true },
]

function ActionCard({ action }) {
  const navigate = useNavigate()
  return (
    <button onClick={() => navigate(action.path)}
      className="relative rounded-2xl p-5 text-left transition-all duration-200 group hover:scale-[1.02] hover:shadow-2xl"
      style={{ background: action.gradient, boxShadow: `0 4px 20px ${action.shadow}` }}>
      {action.soon && (
        <span className="absolute top-2 right-2 text-[9px] font-black tracking-wider px-1.5 py-0.5 rounded-md uppercase"
          style={{ background: 'rgba(255,255,255,0.95)', color: '#1e293b', letterSpacing: '0.08em' }}>
          Soon
        </span>
      )}
      <div className="flex items-start justify-between mb-3">
        <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
          <action.icon className="w-5 h-5 text-white"/>
        </div>
        {!action.soon && (
          <ArrowUpRight className="w-4 h-4 text-white/60 group-hover:text-white group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all"/>
        )}
      </div>
      <div className="font-bold text-white text-sm">
        <CMSField page="dashboard" block={`action-${action.id}`} field="label" default={action.label}
          style={{ color: 'white', fontWeight: 700 }}/>
      </div>
      <div className="text-xs text-white/70 mt-0.5">
        <CMSField page="dashboard" block={`action-${action.id}`} field="desc" default={action.desc}
          style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12 }}/>
      </div>
    </button>
  )
}

/* ── Water Quality Gauge ── */
function WaterGauge({ label, value, unit, min, max, good_min, good_max }) {
  const pct = Math.min(100, Math.max(0, ((value - min) / (max - min)) * 100))
  const isGood = value >= good_min && value <= good_max
  return (
    <div className="flex items-center gap-3 py-2">
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>{label}</span>
          <span className="text-xs font-black" style={{ color: isGood ? '#10b981' : '#ef4444' }}>
            {value}{unit}
          </span>
        </div>
        <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
          <div className="h-full rounded-full transition-all duration-1000"
            style={{ width: pct + '%', background: isGood ? '#10b981' : '#ef4444' }}/>
        </div>
      </div>
      <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${isGood ? 'bg-emerald-400' : 'bg-red-400'}`}
        style={isGood ? { boxShadow: '0 0 6px #10b981' } : {}}/>
    </div>
  )
}

export default function Dashboard() {
  const { user, isAdmin } = useAuth()
  const { loadPage } = useCMS()
  const navigate = useNavigate()
  const [stats, setStats] = useState({})
  const [alerts, setAlerts] = useState([])
  const [posts, setPosts] = useState([])
  const [leaderboard, setLeaderboard] = useState([])
  const [timeGreet, setTimeGreet] = useState('')
  // Water Rangers KPIs — same data source as the Monitoring Map, so the
  // Dashboard "Monitoring Sites" tile reconciles with the map's 9,438 count
  // instead of showing the sparse local `sites` table (~33 rows).
  const [wr, setWr] = useState({ sites: 0, sampled: 0 })
  const [latestObs, setLatestObs] = useState(null) // real observation or null

  useEffect(() => {
    const h = new Date().getHours()
    setTimeGreet(h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening')
    // public-stats is readable by any logged-in user (admin/stats was admin-only,
    // which made every counter silently fall back to 0 for regular users).
    api.get('/admin/public-stats').then(r => setStats(r.data)).catch(() => {})
    api.get('/admin/alerts').then(r => setAlerts((r.data.alerts || []).slice(0, 3))).catch(() => {})
    api.get('/posts?limit=4').then(r => setPosts(r.data.posts || [])).catch(() => {})
    api.get('/leaderboard?limit=5').then(r => setLeaderboard(r.data.leaderboard || [])).catch(() => {})
    api.get('/sites/latest-observation').then(r => setLatestObs(r.data?.observation || null)).catch(() => {})
    // Cached server-side for 30min, so this is cheap on repeat loads.
    getAllLocations()
      .then(locs => setWr({
        sites: locs.length,
        sampled: locs.filter(l => l.last_observation_at).length,
      }))
      .catch(() => {})
    loadPage('dashboard')
  }, [])

  const points = user?.total_points || user?.xp || 0
  const level = Math.floor(points / 100) + 1
  const nextLevel = level * 100
  const levelPct = Math.min(100, (points % 100))

  // Real water quality — derived from the most recent observation in the DB.
  // Only parameters that actually have a value on that row are shown.
  const WATER_PARAMS = latestObs ? [
    { key: 'ph',               label: 'pH',           unit: '',         min: 0, max: 14,   good_min: 6.5, good_max: 8.5 },
    { key: 'dissolved_oxygen', label: 'Dissolved O₂', unit: ' mg/L',    min: 0, max: 14,   good_min: 6,   good_max: 14  },
    { key: 'turbidity',        label: 'Turbidity',    unit: ' NTU',     min: 0, max: 100,  good_min: 0,   good_max: 5   },
    { key: 'water_temp',       label: 'Temperature',  unit: '°C',       min: 0, max: 30,   good_min: 5,   good_max: 22  },
    { key: 'conductivity',     label: 'Conductivity', unit: ' µS/cm',   min: 0, max: 1500, good_min: 50,  good_max: 800 },
  ].filter(p => latestObs[p.key] != null)
    .map(p => ({ ...p, value: parseFloat(latestObs[p.key]) }))
    : []

  return (
    <div className="max-w-[1400px] mx-auto space-y-5 relative">
      <PageAmbience variant="dashboard" scanLine />

      {/* ── Hero greeting banner ── */}
      <div className="rounded-2xl p-6 relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg,#4f46e5 0%,#6366f1 40%,#14b8a6 100%)' }}>
        {/* Decorative circles */}
        <div className="absolute -top-8 -right-8 w-40 h-40 rounded-full opacity-10" style={{ background: 'white' }}/>
        <div className="absolute top-4 right-24 w-20 h-20 rounded-full opacity-10" style={{ background: 'white' }}/>
        <div className="absolute -bottom-6 right-12 w-32 h-32 rounded-full opacity-10" style={{ background: 'white' }}/>

        <div className="relative flex items-center justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-white/80 text-sm font-medium">{timeGreet},</span>
              <span className="w-2 h-2 rounded-full bg-green-300 animate-pulse"/>
              <span className="text-white/60 text-xs">Live data</span>
            </div>
            <h1 className="text-2xl font-black text-white">{user?.display_name || user?.username} 👋</h1>
            <p className="text-white/70 text-sm mt-1">
              <CMSField page="dashboard" block="hero" field="subtitle"
                default="Our waters need you. Select a dataset to view today's data snapshot."
                style={{ color: 'rgba(255,255,255,0.7)', fontSize: 14 }}/>
            </p>
          </div>

          {/* XP progress */}
          <div className="bg-white/10 rounded-2xl p-4 min-w-[200px] backdrop-blur-sm">
            <div className="flex items-center gap-2 mb-2">
              <Award className="w-4 h-4 text-yellow-300"/>
              <span className="text-white font-bold text-sm">Level {level} Water Steward</span>
            </div>
            <div className="h-2 rounded-full overflow-hidden mb-1" style={{ background: 'rgba(255,255,255,0.2)' }}>
              <div className="h-full rounded-full bg-yellow-300 transition-all duration-1000" style={{ width: levelPct + '%' }}/>
            </div>
            <div className="flex justify-between text-xs text-white/60">
              <span>{points} pts</span><span>{nextLevel} pts to Level {level + 1}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Active alert banner ── */}
      {alerts.filter(a => a.is_active && a.severity === 'high').length > 0 && (
        <div className="rounded-xl px-5 py-3 flex items-center gap-3 cursor-pointer hover:opacity-90 transition-opacity"
          style={{ background: '#fef2f2', border: '1px solid #fecaca' }}
          onClick={() => navigate('/alerts')}>
          <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0"/>
          <div className="flex-1">
            <span className="font-bold text-red-700 text-sm">Active Alert: </span>
            <span className="text-red-600 text-sm">{alerts.find(a => a.severity === 'high')?.title}</span>
          </div>
          <ChevronRight className="w-4 h-4 text-red-400"/>
        </div>
      )}

      {/* ── KPI Row ──
          Sites + Sampled Stations come from Water Rangers (same source as
          /map, so numbers reconcile). Alerts + Members are platform data
          and stay on the local DB. */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard icon={Droplets} label="Monitoring Sites" value={wr.sites}
          sub="Water Rangers global network"
          color="#6366f1" onClick={() => navigate('/monitoring')}/>
        <KPICard icon={Activity} label="Sampled Stations" value={wr.sampled}
          sub="Sites with recorded observations"
          color="#14b8a6" onClick={() => navigate('/monitoring')}/>
        <KPICard icon={Bell} label="Active Alerts" value={alerts.filter(a => a.is_active).length}
          color="#f59e0b" onClick={() => navigate('/alerts')}/>
        <KPICard icon={Users} label="Community Members" value={stats.total_users || 0}
          color="#ec4899" onClick={() => navigate('/social')}/>
      </div>

      {/* ── Main grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* Quick Actions — 2/3 width */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-bold flex items-center gap-2" style={{ color: 'var(--text)' }}>
              <Zap className="w-4 h-4 text-indigo-500"/>
              <CMSField page="dashboard" block="sections" field="quickActionsTitle" default="Quick Actions"
                style={{ color: 'var(--text)', fontWeight: 700 }}/>
            </h2>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {ACTIONS.map(a => <ActionCard key={a.id} action={a}/>)}
          </div>

          {/* Water Quality Live */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-800 flex items-center gap-2">
                <Droplets className="w-4 h-4 text-indigo-500"/> Live Water Quality
                {latestObs?.site_name && (
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-green-50 text-green-600 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse inline-block"/> {latestObs.site_name}
                  </span>
                )}
              </h3>
              <button onClick={() => navigate('/monitoring')} className="text-xs font-semibold text-indigo-500 hover:text-indigo-700 flex items-center gap-1">
                All sites <ChevronRight className="w-3 h-3"/>
              </button>
            </div>
            {WATER_PARAMS.length > 0 ? (
              <>
                <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
                  {WATER_PARAMS.map(p => <WaterGauge key={p.label} {...p}/>)}
                </div>
                {latestObs?.observed_at && (
                  <div className="text-xs mt-3" style={{ color: 'var(--text-muted)' }}>
                    Latest reading · {new Date(latestObs.observed_at).toLocaleString()}
                  </div>
                )}
              </>
            ) : (
              <div className="text-sm text-center py-6" style={{ color: 'var(--text-muted)' }}>
                No observations recorded yet. Real values will appear here once a site logs a reading.
              </div>
            )}
          </div>

          {/* Recent social posts */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-800 flex items-center gap-2">
                <Users className="w-4 h-4 text-indigo-500"/> Community Feed
              </h3>
              <button onClick={() => navigate('/social')} className="text-xs font-semibold text-indigo-500 hover:text-indigo-700 flex items-center gap-1">
                View all <ChevronRight className="w-3 h-3"/>
              </button>
            </div>
            <div className="space-y-3">
              {posts.slice(0, 3).map(post => (
                <div key={post.id} className="flex gap-3 py-2 border-b last:border-b-0" style={{ borderColor: 'var(--border)' }}>
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 text-white"
                    style={{ background: 'linear-gradient(135deg,#6366f1,#14b8a6)' }}>
                    {post.avatar_emoji || post.display_name?.[0] || '?'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-bold text-gray-700">{post.display_name || post.username}</div>
                    <div className="text-xs mt-0.5 line-clamp-2" style={{ color: 'var(--text-muted)' }}>{post.content}</div>
                  </div>
                </div>
              ))}
              {posts.length === 0 && (
                <p className="text-sm text-center py-4" style={{ color: 'var(--text-muted)' }}>No posts yet. Be the first!</p>
              )}
            </div>
          </div>
        </div>

        {/* Right sidebar — 1/3 */}
        <div className="space-y-4">

          {/* Leaderboard */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-800 flex items-center gap-2">
                <Award className="w-4 h-4 text-yellow-500"/> Top Contributors
              </h3>
              <button onClick={() => navigate('/social')} className="text-xs font-semibold text-indigo-500 flex items-center gap-1">
                Full board <ChevronRight className="w-3 h-3"/>
              </button>
            </div>
            <div className="space-y-2">
              {(leaderboard.slice(0, 5) || []).map((u, i) => (
                <div key={u.id || i} className="flex items-center gap-3 py-1.5">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-black flex-shrink-0 ${
                    i === 0 ? 'bg-yellow-100 text-yellow-600' : i === 1 ? 'bg-gray-100 text-gray-600' : i === 2 ? 'bg-amber-100 text-amber-600' : 'bg-gray-50 text-gray-400'
                  }`}>{i + 1}</div>
                  <div className="w-7 h-7 rounded-full flex items-center justify-center text-sm flex-shrink-0 text-white font-bold"
                    style={{ background: 'linear-gradient(135deg,#6366f1,#14b8a6)' }}>
                    {u.avatar_emoji || (u.display_name || u.username)?.[0] || '?'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold text-gray-700 truncate">{u.display_name || u.username}</div>
                    <div className="text-xs" style={{ color: 'var(--text-light)' }}>{u.role}</div>
                  </div>
                  <div className="text-xs font-black text-indigo-500">{(u.total_points || u.points || 0).toLocaleString()}</div>
                </div>
              ))}
              {leaderboard.length === 0 && (
                <p className="text-xs text-center py-3" style={{ color: 'var(--text-muted)' }}>No data yet</p>
              )}
            </div>
          </div>

          {/* Alerts list */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-800 flex items-center gap-2">
                <Bell className="w-4 h-4 text-amber-500"/> Recent Alerts
              </h3>
              <button onClick={() => navigate('/alerts')} className="text-xs font-semibold text-indigo-500 flex items-center gap-1">
                All <ChevronRight className="w-3 h-3"/>
              </button>
            </div>
            <div className="space-y-2">
              {alerts.slice(0, 3).map(alert => (
                <div key={alert.id} className="flex items-start gap-2.5 py-1.5 border-b last:border-b-0" style={{ borderColor: 'var(--border)' }}>
                  <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${
                    alert.severity === 'high' ? 'bg-red-400' : alert.severity === 'medium' ? 'bg-orange-400' : 'bg-yellow-400'
                  }`}/>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold text-gray-700 truncate">{alert.title}</div>
                    <div className="text-xs mt-0.5 truncate" style={{ color: 'var(--text-light)' }}>{alert.message}</div>
                  </div>
                </div>
              ))}
              {alerts.length === 0 && (
                <div className="flex items-center gap-2 py-3 text-xs text-emerald-600">
                  <span className="w-2 h-2 rounded-full bg-emerald-400"/>All clear — no active alerts
                </div>
              )}
            </div>
          </div>

          {/* Platform stats */}
          <div className="card p-5">
            <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
              <BarChart2 className="w-4 h-4 text-indigo-500"/> Platform Stats
            </h3>
            <div className="grid grid-cols-2 gap-3">
              {[
                { icon: '🔬', label: 'Quizzes', val: stats.total_quiz_attempts || 0 },
                { icon: '📊', label: 'Reports', val: stats.total_observations || 0 },
                { icon: '🗺️', label: 'Sites', val: stats.active_sites || stats.total_sites || 0 },
                { icon: '🚨', label: 'Alerts', val: stats.active_alerts || 0 },
              ].map(s => (
                <div key={s.label} className="rounded-xl p-3 text-center" style={{ background: 'var(--page-bg)' }}>
                  <div className="text-lg">{s.icon}</div>
                  <div className="text-lg font-black text-gray-800 mt-0.5">{s.val}</div>
                  <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{s.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Admin CTA */}
          {isAdmin && (
            <div className="rounded-xl p-4 flex items-center gap-3 cursor-pointer hover:opacity-90 transition-opacity"
              style={{ background: 'linear-gradient(135deg,#4f46e5,#6366f1)', boxShadow: '0 4px 20px rgba(99,102,241,0.3)' }}
              onClick={() => navigate('/admin')}>
              <Shield className="w-8 h-8 text-white/80"/>
              <div className="flex-1">
                <div className="font-bold text-white text-sm">Admin Panel</div>
                <div className="text-xs text-white/60">Manage platform, users & content</div>
              </div>
              <ChevronRight className="w-4 h-4 text-white/60"/>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
