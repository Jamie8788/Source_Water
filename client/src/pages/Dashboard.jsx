import { useState, useEffect, useRef, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useCMS } from '../context/CMSContext'
import CMSField from '../components/cms/CMSField'
import api from '../utils/api'
import { getAllLocations, getLocationObservations } from '../api/waterRangers'
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

/* ── Your Activity This Month — real data from /users/me/activity-summary.
   Points, rank, streak, breakdown by source (games / quizzes / resources /
   community), and this-month counts. No fabricated values — every number
   is computed deterministically from leaderboard_points + posts +
   quiz_attempts on the server. Lets a user see their own contribution at
   a glance and where their points come from. */
function YourActivity() {
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  useEffect(() => {
    api.get('/users/me/activity-summary').then(r => setData(r.data)).catch(() => {})
  }, [])
  const sources = [
    { key: 'games',     label: 'Games',     color: '#10b981' },
    { key: 'quizzes',   label: 'Quizzes',   color: '#a78bfa' },
    { key: 'resources', label: 'Resources', color: '#06b6d4' },
    { key: 'social',    label: 'Community', color: '#ec4899' },
  ]
  if (!data) {
    return (
      <div className="card p-5 animate-pulse">
        <div className="h-4 w-40 bg-gray-200 rounded mb-4"/>
        <div className="grid grid-cols-3 gap-2 mb-4">
          {[0,1,2].map(i => <div key={i} className="h-16 bg-gray-100 rounded-lg"/>)}
        </div>
        <div className="h-3 bg-gray-100 rounded-full"/>
      </div>
    )
  }
  const totalForBar = Math.max(1, sources.reduce((s, x) => s + (data.points_by_source[x.key] || 0), 0))
  const monthName = new Date().toLocaleString('default', { month: 'long' })
  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold flex items-center gap-2" style={{ color: 'var(--text)' }}>
          <Activity className="w-4 h-4 text-indigo-500"/> Your Activity · {monthName}
        </h3>
        <button onClick={() => navigate('/profile')} className="text-xs font-semibold text-indigo-500 flex items-center gap-1">
          Profile <ChevronRight className="w-3 h-3"/>
        </button>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-4">
        <div className="rounded-lg p-3" style={{ background: 'rgba(99,102,241,0.08)' }}>
          <div className="text-2xl font-black text-indigo-500"><AnimatedNumber value={data.points_this_month}/></div>
          <div className="text-[10px] font-bold mt-0.5 uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Points</div>
        </div>
        <div className="rounded-lg p-3" style={{ background: 'rgba(245,158,11,0.08)' }}>
          <div className="text-2xl font-black text-amber-500">{data.rank_this_month ? `#${data.rank_this_month}` : '—'}</div>
          <div className="text-[10px] font-bold mt-0.5 uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
            Rank{data.total_ranked_users ? <span className="font-medium"> / {data.total_ranked_users}</span> : ''}
          </div>
        </div>
        <div className="rounded-lg p-3" style={{ background: 'rgba(236,72,153,0.08)' }}>
          <div className="text-2xl font-black text-pink-500">{data.streak_days}d</div>
          <div className="text-[10px] font-bold mt-0.5 uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Streak</div>
        </div>
      </div>

      <div className="mb-3">
        <div className="text-[10px] font-bold mb-1.5 uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
          Points by source
        </div>
        <div className="flex h-3 rounded-full overflow-hidden border" style={{ borderColor: 'var(--border)' }}>
          {sources.map(s => {
            const pct = ((data.points_by_source[s.key] || 0) / totalForBar) * 100
            return pct > 0 ? <div key={s.key} style={{ width: `${pct}%`, background: s.color, transition: 'width 0.6s' }} title={`${s.label}: ${data.points_by_source[s.key]}`}/> : null
          })}
        </div>
        <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 text-[11px]">
          {sources.map(s => {
            const val = data.points_by_source[s.key] || 0
            return (
              <span key={s.key} className="flex items-center gap-1.5" style={{ color: val > 0 ? 'var(--text)' : 'var(--text-muted)' }}>
                <span className="w-2 h-2 rounded-full" style={{ background: s.color, opacity: val > 0 ? 1 : 0.4 }}/>
                <span className="font-semibold">{s.label}</span>
                <span>{val}</span>
              </span>
            )
          })}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-1 pt-3 border-t" style={{ borderColor: 'var(--border)' }}>
        {[
          { v: data.this_month.posts,            l: 'Posts',     to: '/social' },
          { v: data.this_month.quizzes_passed,   l: 'Quiz wins', to: '/quiz' },
          { v: data.this_month.resources_viewed, l: 'Resources', to: '/resources' },
        ].map(x => (
          <button key={x.l} onClick={() => navigate(x.to)}
            className="text-left rounded p-1.5 transition hover:bg-gray-50">
            <div className="text-base font-black" style={{ color: 'var(--text)' }}>{x.v}</div>
            <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{x.l}</div>
          </button>
        ))}
      </div>
    </div>
  )
}

/* ── Recently Active Sites — pulled from the existing Water Rangers
   locations array (no extra API call). Sorts by last_observation_at desc
   and shows the five most recent, clickable straight into the map. */
function TrendingSites({ locations }) {
  const navigate = useNavigate()
  const top = (locations || [])
    .filter(l => l.last_observation_at)
    .sort((a, b) => new Date(b.last_observation_at) - new Date(a.last_observation_at))
    .slice(0, 5)
  if (top.length === 0) return null
  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold flex items-center gap-2" style={{ color: 'var(--text)' }}>
          <TrendingUp className="w-4 h-4 text-emerald-500"/> Recently Active Sites
        </h3>
        <button onClick={() => navigate('/monitoring')} className="text-xs font-semibold text-indigo-500 flex items-center gap-1">
          All sites <ChevronRight className="w-3 h-3"/>
        </button>
      </div>
      <div className="space-y-1">
        {top.map(s => {
          const when = new Date(s.last_observation_at)
          const ago = Math.round((Date.now() - when.getTime()) / 86400000)
          return (
            <button key={s.id}
              onClick={() => navigate(`/monitoring?q=${encodeURIComponent(s.name)}`)}
              className="w-full flex items-center gap-3 py-2 px-2 -mx-2 rounded transition text-left hover:bg-gray-50">
              <Droplets className="w-4 h-4 text-blue-400 flex-shrink-0"/>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-bold truncate" style={{ color: 'var(--text)' }}>{s.name}</div>
                <div className="text-[10px] truncate" style={{ color: 'var(--text-muted)' }}>
                  {[s.body_of_water, s.country].filter(Boolean).join(' · ')}
                </div>
              </div>
              <div className="text-[10px] font-semibold text-emerald-600 flex-shrink-0">
                {ago === 0 ? 'today' : ago === 1 ? '1d ago' : `${ago}d ago`}
              </div>
            </button>
          )
        })}
      </div>
    </div>
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
          {value == null ? (
            <span className="inline-block w-20 h-7 rounded animate-pulse" style={{ background: 'rgba(15,31,56,0.08)' }}/>
          ) : (
            <>
              <AnimatedNumber value={typeof value === 'number' ? value : 0}/>
              {typeof value === 'string' ? value : ''}
            </>
          )}
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

/* ── Live Water Quality — REAL Water Rangers data. Defaults to the most
   recently-sampled site (exact timestamp; ties broken by most parameters,
   then name), and the user can pick any site — the choice is remembered. ── */
const LIVE_PARAMS = [
  { key: 'ph',                aliases: ['ph'],                             label: 'pH',           unit: '',       min: 0, max: 14,   good_min: 6.5, good_max: 8.5 },
  { key: 'dissolved_oxygen',  aliases: ['dissolved_oxygen', 'oxygen', 'do'], label: 'Dissolved O₂', unit: ' mg/L',  min: 0, max: 14,   good_min: 6,   good_max: 14  },
  { key: 'water_temperature', aliases: ['water_temperature', 'temperature'], label: 'Temperature',  unit: '°C',     min: 0, max: 30,   good_min: 5,   good_max: 22  },
  { key: 'conductivity',      aliases: ['conductivity'],                   label: 'Conductivity', unit: ' µS/cm', min: 0, max: 1500, good_min: 50,  good_max: 800 },
  { key: 'turbidity',         aliases: ['turbidity'],                      label: 'Turbidity',    unit: ' NTU',   min: 0, max: 100,  good_min: 0,   good_max: 5   },
]

function LiveWaterQuality({ wrAll, navigate }) {
  const ranked = useMemo(() => (wrAll || [])
    .filter(l => l.last_observation_at)
    .slice()
    .sort((a, b) => {
      const tb = new Date(b.last_observation_at).getTime(), ta = new Date(a.last_observation_at).getTime()
      if (tb !== ta) return tb - ta                                   // newest first (exact timestamp)
      const pa = (a.tested_parameters || []).length, pb = (b.tested_parameters || []).length
      if (pb !== pa) return pb - pa                                   // tie: most parameters
      return String(a.name || '').localeCompare(String(b.name || '')) // tie: name
    }), [wrAll])

  const stored = (() => { try { return localStorage.getItem('dash_live_site') } catch { return null } })()
  const [siteId, setSiteId] = useState(stored || null)
  const [picking, setPicking] = useState(false)
  const [query, setQuery] = useState('')
  const [obs, setObs] = useState(null)
  const [loading, setLoading] = useState(false)

  const site = useMemo(() => {
    if (siteId) { const s = (wrAll || []).find(l => String(l.id) === String(siteId)); if (s) return s }
    return ranked[0] || null
  }, [siteId, ranked, wrAll])

  useEffect(() => {
    if (!site) return
    let alive = true
    setLoading(true); setObs(null)
    getLocationObservations(site.id, { page: 1, per_page: 50 })
      .then(d => { if (alive) setObs(Array.isArray(d) ? d : (d?.observations || d?.data || [])) })
      .catch(() => { if (alive) setObs([]) })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [site?.id])

  const sorted = useMemo(() => (obs || []).slice().sort((a, b) => new Date(b.observed_at || 0) - new Date(a.observed_at || 0)), [obs])

  const gauges = useMemo(() => {
    if (!sorted.length) return []
    const out = []
    for (const p of LIVE_PARAMS) {
      for (const o of sorted) {
        const r = (o.readings || []).find(rr => {
          const name = String(rr.parameter || '').toLowerCase()
          if (p.key === 'water_temperature' && name.includes('air')) return false
          return p.aliases.some(a => name === a || name.includes(a))
        })
        const v = r ? parseFloat(r.value) : NaN
        if (Number.isFinite(v)) { out.push({ ...p, value: v }); break }
      }
    }
    return out
  }, [sorted])

  const latestAt = sorted[0]?.observed_at
  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim()
    return (q ? ranked.filter(s => String(s.name || '').toLowerCase().includes(q)) : ranked).slice(0, 8)
  }, [query, ranked])

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold text-gray-800 flex items-center gap-2">
          <Droplets className="w-4 h-4 text-indigo-500"/> Live Water Quality
          {site?.name && (
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-green-50 text-green-600 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse inline-block"/> {site.name}
            </span>
          )}
        </h3>
        <button onClick={() => setPicking(p => !p)} className="text-xs font-semibold text-indigo-500 hover:text-indigo-700 flex items-center gap-1">
          Change site <ChevronRight className="w-3 h-3"/>
        </button>
      </div>

      {picking && (
        <div className="mb-3">
          <input autoFocus value={query} onChange={e => setQuery(e.target.value)} placeholder="Search a site…"
            className="w-full px-3 py-2 rounded-lg text-sm" style={{ border: '1px solid var(--border)', background: 'var(--card-bg)', color: 'var(--text)', outline: 'none' }}/>
          <div className="mt-1 max-h-48 overflow-y-auto rounded-lg" style={{ border: '1px solid var(--border)' }}>
            {filtered.map(s => (
              <button key={s.id}
                onClick={() => { setSiteId(String(s.id)); try { localStorage.setItem('dash_live_site', String(s.id)) } catch { /* ignore */ } setPicking(false); setQuery('') }}
                className="w-full text-left px-3 py-2 text-sm hover:bg-black/5" style={{ color: 'var(--text)' }}>
                {s.name} <span style={{ color: 'var(--text-muted)' }}>· {s.last_observation_at ? new Date(s.last_observation_at).toLocaleDateString() : ''}</span>
              </button>
            ))}
            {!filtered.length && <div className="px-3 py-2 text-sm" style={{ color: 'var(--text-muted)' }}>No match</div>}
          </div>
          {siteId && (
            <button onClick={() => { setSiteId(null); try { localStorage.removeItem('dash_live_site') } catch { /* ignore */ } setPicking(false) }}
              className="mt-1 text-xs text-indigo-500 hover:text-indigo-700">↺ Back to most recent</button>
          )}
        </div>
      )}

      {loading ? (
        <div className="text-sm text-center py-6" style={{ color: 'var(--text-muted)' }}>Loading {site?.name || 'site'}…</div>
      ) : gauges.length ? (
        <>
          <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
            {gauges.map(p => <WaterGauge key={p.label} {...p}/>)}
          </div>
          {latestAt && (
            <div className="text-xs mt-3" style={{ color: 'var(--text-muted)' }}>Latest reading · {new Date(latestAt).toLocaleString()}</div>
          )}
        </>
      ) : (
        <div className="text-sm text-center py-6" style={{ color: 'var(--text-muted)' }}>
          No chartable readings for {site?.name || 'this site'} yet — use “Change site” to pick another.
        </div>
      )}
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
  const [wrLoaded, setWrLoaded] = useState(false)
  const [wrAll, setWrAll] = useState([]) // full list for TrendingSites + LiveWaterQuality

  useEffect(() => {
    const h = new Date().getHours()
    setTimeGreet(h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening')
    // public-stats is readable by any logged-in user (admin/stats was admin-only,
    // which made every counter silently fall back to 0 for regular users).
    api.get('/admin/public-stats').then(r => setStats(r.data)).catch(() => {})
    api.get('/admin/alerts').then(r => setAlerts((r.data.alerts || []).slice(0, 3))).catch(() => {})
    api.get('/posts?limit=4').then(r => setPosts(r.data.posts || [])).catch(() => {})
    api.get('/leaderboard?limit=5').then(r => setLeaderboard(r.data.leaderboard || [])).catch(() => {})
    // Cached server-side for 30min, so this is cheap on repeat loads.
    getAllLocations()
      .then(locs => {
        setWr({
          sites: locs.length,
          sampled: locs.filter(l => l.last_observation_at).length,
        })
        setWrAll(locs)
        setWrLoaded(true)
      })
      .catch(() => setWrLoaded(true))
    loadPage('dashboard')
  }, [])

  const points = user?.total_points || user?.xp || 0
  const level = Math.floor(points / 100) + 1
  const nextLevel = level * 100
  const levelPct = Math.min(100, (points % 100))

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
        <KPICard icon={Droplets} label="Monitoring Sites" value={wrLoaded ? wr.sites : null}
          sub="Water Rangers global network"
          color="#6366f1" onClick={() => navigate('/monitoring')}/>
        <KPICard icon={Activity} label="Sampled Stations" value={wrLoaded ? wr.sampled : null}
          sub="Sites with recorded observations"
          color="#14b8a6" onClick={() => navigate('/monitoring')}/>
        <KPICard icon={Bell} label="Active Alerts" value={alerts.filter(a => a.is_active).length}
          color="#f59e0b" onClick={() => navigate('/alerts')}/>
        <KPICard icon={Users} label="Community Members" value={stats.total_users == null ? null : stats.total_users}
          color="#ec4899" onClick={() => navigate('/social')}/>
      </div>

      {/* ── Main grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* Main column — 2/3 width. The Quick Actions tile grid that used
            to live here was removed: it duplicated the dedicated /quick-
            actions river-journey page. In its place: Your Activity (real
            points-by-source for this month, streak, rank from the live
            leaderboard_points table) + Recently Active Sites (top 5 by
            real last_observation_at from Water Rangers). */}
        <div className="lg:col-span-2 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <YourActivity />
            <TrendingSites locations={wrAll} />
          </div>

          {/* Water Quality Live — real Water Rangers data, most-recent site by
              default, changeable via the picker. */}
          <LiveWaterQuality wrAll={wrAll} navigate={navigate}/>

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
