import PageAmbience from '../components/layout/PageAmbience'
import { useState, useEffect, useRef } from 'react'
import api from '../utils/api'
import { useAuth } from '../context/AuthContext'
import {
  ShieldCheck, Users, AlertTriangle, Activity, BarChart2,
  FileText, Settings, ChevronRight, TrendingUp, TrendingDown,
  Eye, Trash2, Plus, Edit2, Search, Filter, Download,
  CheckCircle, XCircle, Clock, Zap, Database, Globe,
  MessageSquare, Map, BookOpen, GraduationCap, Gamepad2,
  RefreshCw, Bell, Lock, Unlock, MoreVertical, LogOut,
  UserCheck, UserX, Shield, FlaskConical, ArrowUpRight,
} from 'lucide-react'

/* ── Animated number ── */
function Num({ value, suffix = '' }) {
  const [disp, setDisp] = useState(0)
  const prev = useRef(0)
  useEffect(() => {
    const from = prev.current; const to = value || 0; prev.current = to
    if (from === to) return
    let start = null
    const step = (ts) => {
      if (!start) start = ts
      const p = Math.min((ts - start) / 700, 1)
      const ease = 1 - Math.pow(1 - p, 3)
      setDisp(Math.floor(from + (to - from) * ease))
      if (p < 1) requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
  }, [value])
  return <>{disp.toLocaleString()}{suffix}</>
}

/* ── Pulse dot ── */
function PulseDot({ color = '#10b981' }) {
  return (
    <span style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
      <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, display: 'inline-block' }}/>
      <span style={{
        position: 'absolute', width: 8, height: 8, borderRadius: '50%', background: color,
        animation: 'ping 1.5s cubic-bezier(0,0,0.2,1) infinite', opacity: 0.4,
      }}/>
    </span>
  )
}

/* ── Tab button ── */
function Tab({ active, onClick, icon: Icon, label, badge }) {
  return (
    <button onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '8px 16px', borderRadius: 10, border: 'none', cursor: 'pointer',
        background: active ? 'rgba(99,102,241,0.15)' : 'transparent',
        color: active ? '#818cf8' : 'var(--text-muted)',
        fontWeight: active ? 700 : 500,
        fontSize: 13, transition: 'all 0.15s', position: 'relative',
        borderBottom: active ? '2px solid #6366f1' : '2px solid transparent',
      }}
      onMouseEnter={e => { if (!active) { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.color = 'var(--text)' }}}
      onMouseLeave={e => { if (!active) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)' }}}>
      {Icon && <Icon style={{ width: 15, height: 15 }}/>}
      {label}
      {badge > 0 && (
        <span style={{ background: '#ef4444', color: '#fff', fontSize: 10, fontWeight: 700, borderRadius: 20, padding: '1px 6px', marginLeft: 2 }}>{badge}</span>
      )}
    </button>
  )
}

/* ── Stat card ── */
function StatCard({ icon: Icon, label, value, change, color, sub }) {
  const up = change >= 0
  return (
    <div style={{
      background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 14,
      padding: 20, display: 'flex', flexDirection: 'column', gap: 12,
      position: 'relative', overflow: 'hidden',
    }}>
      <div style={{ position: 'absolute', top: 0, right: 0, width: 80, height: 80,
        background: `radial-gradient(circle, ${color}18 0%, transparent 70%)`, pointerEvents: 'none' }}/>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div style={{ width: 38, height: 38, borderRadius: 10, background: `${color}18`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Icon style={{ width: 18, height: 18, color }}/>
        </div>
        {change !== undefined && (
          <span style={{ fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 3,
            color: up ? '#10b981' : '#ef4444',
            background: up ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
            padding: '3px 8px', borderRadius: 20 }}>
            {up ? <TrendingUp style={{ width: 10, height: 10 }}/> : <TrendingDown style={{ width: 10, height: 10 }}/>}
            {up ? '+' : ''}{change}%
          </span>
        )}
      </div>
      <div>
        <div style={{ fontSize: 26, fontWeight: 900, color: 'var(--text)', lineHeight: 1 }}>
          <Num value={typeof value === 'number' ? value : 0}/>{typeof value === 'string' ? value : ''}
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 3 }}>{label}</div>
        {sub && <div style={{ fontSize: 11, color: 'var(--text-light)', marginTop: 2 }}>{sub}</div>}
      </div>
    </div>
  )
}

/* ── STATS OVERVIEW ── */
const MOCK_STATS = {
  total_users: 847, total_observations: 3219, total_posts: 1456,
  quiz_attempts: 892, active_sites: 38, active_alerts: 4,
  new_users_week: 23, messages_today: 67, ai_queries: 341,
}

function OverviewPanel() {
  const [stats, setStats] = useState(MOCK_STATS)
  useEffect(() => {
    api.get('/admin/stats').then(r => setStats({ ...MOCK_STATS, ...r.data })).catch(() => {})
  }, [])

  const cards = [
    { icon: Users,       label: 'Total Users',       value: stats.total_users,       change: 12,  color: '#6366f1', sub: `+${stats.new_users_week || 23} this week` },
    { icon: FlaskConical,label: 'Observations',       value: stats.total_observations, change: 8,  color: '#14b8a6', sub: 'Field data entries' },
    { icon: MessageSquare,label: 'Community Posts',  value: stats.total_posts,       change: 21,  color: '#ec4899', sub: 'Total engagement' },
    { icon: GraduationCap,label: 'Quiz Attempts',    value: stats.quiz_attempts,     change: 5,   color: '#f59e0b', sub: 'Learning completions' },
    { icon: Map,          label: 'Active Sites',      value: stats.active_sites,      change: 3,   color: '#10b981', sub: 'Monitored locations' },
    { icon: AlertTriangle,label: 'Active Alerts',    value: stats.active_alerts,     change: -2,  color: '#ef4444', sub: 'Requires attention' },
    { icon: Zap,          label: 'AI Queries Today', value: stats.ai_queries || 341,  change: 34,  color: '#a855f7', sub: 'Ask Water usage' },
    { icon: Globe,        label: 'Messages Today',   value: stats.messages_today || 67, change: 18, color: '#0ea5e9', sub: 'Community activity' },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Live status bar */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(99,102,241,0.08), rgba(20,184,166,0.08))',
        border: '1px solid rgba(99,102,241,0.15)', borderRadius: 12, padding: '12px 20px',
        display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <PulseDot color="#10b981"/>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#10b981' }}>All Systems Operational</span>
        </div>
        <div style={{ height: 16, width: 1, background: 'var(--border)' }}/>
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>API latency: 42ms</span>
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Uptime: 99.97%</span>
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>DB queries/min: 234</span>
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Storage: 12.4 GB / 100 GB</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 14 }}>
        {cards.map(c => <StatCard key={c.label} {...c}/>)}
      </div>

      {/* Activity chart placeholder */}
      <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 14, padding: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>Platform Activity — Last 30 Days</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Users, posts, observations, AI queries</div>
          </div>
          <button style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4, background: 'var(--border)', padding: '5px 12px', borderRadius: 8, border: 'none', cursor: 'pointer' }}>
            <Download style={{ width: 12, height: 12 }}/> Export
          </button>
        </div>
        <ActivityChart/>
      </div>
    </div>
  )
}

/* ── Mini Activity Chart ── */
function ActivityChart() {
  const data = [12,19,8,24,31,18,27,42,35,28,19,38,44,52,41,36,48,55,62,49,58,71,64,53,67,78,69,55,72,85]
  const data2 = [5,8,4,11,14,9,13,19,16,12,8,17,20,24,18,15,22,26,29,22,27,34,30,24,31,37,33,26,34,41]
  const w = 100, h = 60
  const max = Math.max(...data)
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * w}%,${h - (v / max) * h}px`)
  const pts2 = data2.map((v, i) => `${(i / (data2.length - 1)) * w}%,${h - (v / max) * h}px`)

  return (
    <div style={{ position: 'relative', height: 80 }}>
      <svg width="100%" height="80" style={{ overflow: 'visible' }} preserveAspectRatio="none" viewBox={`0 0 100 60`}>
        <defs>
          <linearGradient id="ag1" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#6366f1" stopOpacity="0.3"/>
            <stop offset="100%" stopColor="#6366f1" stopOpacity="0"/>
          </linearGradient>
          <linearGradient id="ag2" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#14b8a6" stopOpacity="0.3"/>
            <stop offset="100%" stopColor="#14b8a6" stopOpacity="0"/>
          </linearGradient>
        </defs>
        <polyline points={data.map((v, i) => `${(i / (data.length - 1)) * 100},${60 - (v / max) * 55}`).join(' ')}
          fill="none" stroke="#6366f1" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        <polyline points={data2.map((v, i) => `${(i / (data2.length - 1)) * 100},${60 - (v / max) * 55}`).join(' ')}
          fill="none" stroke="#14b8a6" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
      <div style={{ display: 'flex', gap: 16, marginTop: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text-muted)' }}>
          <div style={{ width: 20, height: 2, background: '#6366f1', borderRadius: 1 }}/>Users online
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text-muted)' }}>
          <div style={{ width: 20, height: 2, background: '#14b8a6', borderRadius: 1 }}/>Observations
        </div>
      </div>
    </div>
  )
}

/* ── USERS PANEL ── */
const MOCK_USERS = [
  { id: 1, display_name: 'Dr. Sarah Chen', username: 'sarah_chen', email: 'schen@nordik.ca', role: 'researcher', total_points: 2840, is_active: true, created_at: '2024-01-15', last_active: '2 min ago' },
  { id: 2, display_name: 'Marcus Osei', username: 'marcus_o', email: 'mosei@student.algoma.ca', role: 'student', total_points: 1230, is_active: true, created_at: '2024-03-22', last_active: '1 hr ago' },
  { id: 3, display_name: 'Linda Swanson', username: 'lindas', email: 'lswanson@enviro.org', role: 'community_member', total_points: 560, is_active: true, created_at: '2024-02-08', last_active: '3 hrs ago' },
  { id: 4, display_name: 'James Pelletier', username: 'jpelletier', email: 'jp@nordik.ca', role: 'admin', total_points: 4100, is_active: true, created_at: '2023-11-01', last_active: 'just now' },
  { id: 5, display_name: 'Amara Diallo', username: 'amara_d', email: 'amara@watershed.net', role: 'researcher', total_points: 1890, is_active: true, created_at: '2024-04-10', last_active: '6 hrs ago' },
  { id: 6, display_name: 'Theo Watts', username: 'theo_w', email: 'tw@student.algoma.ca', role: 'student', total_points: 380, is_active: false, created_at: '2024-05-02', last_active: '2 days ago' },
  { id: 7, display_name: 'River Johnson', username: 'riverj', email: 'rj@community.ca', role: 'community_member', total_points: 720, is_active: true, created_at: '2024-03-01', last_active: '1 day ago' },
]

const ROLE_COLORS = {
  admin: { bg: 'rgba(99,102,241,0.15)', color: '#818cf8' },
  researcher: { bg: 'rgba(20,184,166,0.15)', color: '#2dd4bf' },
  student: { bg: 'rgba(245,158,11,0.15)', color: '#fbbf24' },
  community_member: { bg: 'rgba(16,185,129,0.15)', color: '#34d399' },
}

function UsersPanel() {
  const [users, setUsers] = useState(MOCK_USERS)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')
  const [menuId, setMenuId] = useState(null)

  useEffect(() => {
    api.get('/users').then(r => {
      const fetched = r.data.users || r.data || []
      if (fetched.length) setUsers(fetched)
    }).catch(() => {})
  }, [])

  const changeRole = async (userId, role) => {
    await api.put(`/users/${userId}`, { role }).catch(() => {})
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, role } : u))
  }

  const filtered = users.filter(u => {
    const q = search.toLowerCase()
    const match = !search || u.display_name?.toLowerCase().includes(q) || u.username?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q)
    const roleMatch = roleFilter === 'all' || u.role === roleFilter
    return match && roleMatch
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Controls */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <Search style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', width: 14, height: 14, color: 'var(--text-light)' }}/>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search users…"
            style={{ paddingLeft: 32, width: '100%', background: 'var(--card-bg)', border: '1.5px solid var(--border)', borderRadius: 9, padding: '8px 12px 8px 32px', fontSize: 13, color: 'var(--text)', outline: 'none' }}/>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {['all','admin','researcher','student','community_member'].map(r => (
            <button key={r} onClick={() => setRoleFilter(r)}
              style={{
                padding: '6px 12px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600,
                background: roleFilter === r ? 'rgba(99,102,241,0.15)' : 'var(--border)',
                color: roleFilter === r ? '#818cf8' : 'var(--text-muted)',
              }}>
              {r === 'community_member' ? 'Community' : r.charAt(0).toUpperCase() + r.slice(1)}
            </button>
          ))}
        </div>
        <button style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 9, background: 'rgba(99,102,241,0.12)', color: '#818cf8', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
          <Plus style={{ width: 14, height: 14 }}/> Invite User
        </button>
      </div>

      {/* Table */}
      <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden' }}>
        <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{filtered.length} users</span>
          <button style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', cursor: 'pointer' }}>
            <Download style={{ width: 12, height: 12 }}/> Export CSV
          </button>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'rgba(0,0,0,0.02)' }}>
                {['User', 'Email', 'Role', 'Points', 'Last Active', 'Status', ''].map(h => (
                  <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, color: 'var(--text-muted)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((u, i) => {
                const rc = ROLE_COLORS[u.role] || ROLE_COLORS.community_member
                return (
                  <tr key={u.id} style={{ borderTop: '1px solid var(--border)', transition: 'background 0.12s' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(99,102,241,0.03)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'linear-gradient(135deg,#6366f1,#14b8a6)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 13, flexShrink: 0 }}>
                          {u.display_name?.[0]?.toUpperCase() || '?'}
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, color: 'var(--text)' }}>{u.display_name || u.username}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>@{u.username}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '12px 16px', color: 'var(--text-muted)' }}>{u.email}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <select value={u.role} onChange={e => changeRole(u.id, e.target.value)}
                        style={{ background: rc.bg, color: rc.color, border: 'none', borderRadius: 7, padding: '4px 8px', fontWeight: 600, fontSize: 12, cursor: 'pointer', outline: 'none' }}>
                        {['community_member','student','researcher','admin'].map(r => <option key={r} value={r}>{r}</option>)}
                      </select>
                    </td>
                    <td style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--text)' }}>{(u.total_points || 0).toLocaleString()}</td>
                    <td style={{ padding: '12px 16px', color: 'var(--text-muted)', fontSize: 12 }}>{u.last_active || new Date(u.created_at).toLocaleDateString()}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: 5,
                        padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600,
                        background: u.is_active ? 'rgba(16,185,129,0.12)' : 'rgba(100,116,139,0.12)',
                        color: u.is_active ? '#10b981' : '#64748b',
                      }}>
                        {u.is_active ? <><PulseDot color="#10b981"/> Active</> : 'Inactive'}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button title="View profile" style={{ padding: 6, borderRadius: 7, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
                          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(99,102,241,0.1)'; e.currentTarget.style.color = '#818cf8' }}
                          onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'var(--text-muted)' }}>
                          <Eye style={{ width: 14, height: 14 }}/>
                        </button>
                        <button title="Suspend" style={{ padding: 6, borderRadius: 7, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
                          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.1)'; e.currentTarget.style.color = '#ef4444' }}
                          onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'var(--text-muted)' }}>
                          {u.is_active ? <Lock style={{ width: 14, height: 14 }}/> : <Unlock style={{ width: 14, height: 14 }}/>}
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

/* ── ALERTS PANEL ── */
const MOCK_ALERTS = [
  { id: 1, title: 'High Turbidity — Whitefish Lake', message: 'Turbidity readings exceeded WHO guidelines (>5 NTU) at three sampling points. Boil water advisory recommended for downstream communities.', severity: 'high', type: 'boil-water', is_active: true, site_name: 'Whitefish Lake Station', created_at: new Date(Date.now() - 2 * 3600000).toISOString() },
  { id: 2, title: 'pH Anomaly — Garden River', message: 'pH dropped to 5.2 (acidic), significantly below baseline of 7.1. Possible upstream agricultural runoff detected.', severity: 'high', type: 'warning', is_active: true, site_name: 'Garden River Site B', created_at: new Date(Date.now() - 6 * 3600000).toISOString() },
  { id: 3, title: 'Phosphorus Elevated — Echo Bay', message: 'Phosphorus levels at 0.05 mg/L, double the safe threshold. Algal bloom risk increasing. Monitor weekly.', severity: 'medium', type: 'advisory', is_active: true, site_name: 'Echo Bay Monitor', created_at: new Date(Date.now() - 12 * 3600000).toISOString() },
  { id: 4, title: 'Seasonal Runoff — Thessalon River', message: 'Elevated conductivity (820 µS/cm) following recent precipitation. Expected seasonal pattern, monitoring closely.', severity: 'low', type: 'advisory', is_active: true, site_name: 'Thessalon River', created_at: new Date(Date.now() - 24 * 3600000).toISOString() },
  { id: 5, title: 'Beach Closure — Gros Cap', message: 'E. coli counts above 200 CFU/100mL. Beach closed to public swimming. Revisit in 72 hrs.', severity: 'high', type: 'beach-closure', is_active: false, site_name: 'Gros Cap Beach', created_at: new Date(Date.now() - 48 * 3600000).toISOString() },
]

const SEV = {
  high:   { color: '#ef4444', bg: 'rgba(239,68,68,0.08)', border: 'rgba(239,68,68,0.2)' },
  medium: { color: '#f59e0b', bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.2)' },
  low:    { color: '#10b981', bg: 'rgba(16,185,129,0.08)', border: 'rgba(16,185,129,0.2)' },
}

function AlertsAdminPanel() {
  const [alerts, setAlerts] = useState(MOCK_ALERTS)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ title: '', message: '', severity: 'medium', type: 'advisory' })

  useEffect(() => {
    api.get('/admin/alerts').then(r => { if (r.data.alerts?.length) setAlerts(r.data.alerts) }).catch(() => {})
  }, [])

  const create = async e => {
    e.preventDefault()
    const r = await api.post('/admin/alerts', form).catch(() => null)
    const newAlert = r?.data?.alert || { ...form, id: Date.now(), is_active: true, created_at: new Date().toISOString() }
    setAlerts(prev => [newAlert, ...prev])
    setShowForm(false)
    setForm({ title: '', message: '', severity: 'medium', type: 'advisory' })
  }

  const del = async (id) => {
    await api.delete(`/admin/alerts/${id}`).catch(() => {})
    setAlerts(prev => prev.filter(a => a.id !== id))
  }

  const timeAgo = (d) => {
    const diff = Date.now() - new Date(d)
    if (diff < 3600000) return Math.floor(diff / 60000) + 'm ago'
    if (diff < 86400000) return Math.floor(diff / 3600000) + 'h ago'
    return Math.floor(diff / 86400000) + 'd ago'
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{alerts.filter(a => a.is_active).length} active alerts across all monitored sites</div>
        <button onClick={() => setShowForm(s => !s)}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 9, background: 'rgba(239,68,68,0.12)', color: '#ef4444', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
          <Plus style={{ width: 14, height: 14 }}/> Issue Alert
        </button>
      </div>

      {showForm && (
        <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 14, padding: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 14 }}>Issue New Water Quality Alert</div>
          <form onSubmit={create} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Title</label>
                <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} required style={{ width: '100%', background: 'var(--card-bg)', border: '1.5px solid var(--border)', borderRadius: 9, padding: '8px 12px', fontSize: 13, color: 'var(--text)', outline: 'none' }}/>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Type</label>
                <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
                  style={{ width: '100%', background: 'var(--card-bg)', border: '1.5px solid var(--border)', borderRadius: 9, padding: '8px 12px', fontSize: 13, color: 'var(--text)', outline: 'none' }}>
                  {['advisory','warning','boil-water','do-not-drink','beach-closure'].map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Message</label>
              <textarea rows={3} value={form.message} onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
                style={{ width: '100%', background: 'var(--card-bg)', border: '1.5px solid var(--border)', borderRadius: 9, padding: '8px 12px', fontSize: 13, color: 'var(--text)', outline: 'none', resize: 'none' }}/>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              {['low','medium','high'].map(s => (
                <button type="button" key={s} onClick={() => setForm(f => ({ ...f, severity: s }))}
                  style={{ padding: '6px 14px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600,
                    background: form.severity === s ? SEV[s].bg : 'var(--border)',
                    color: form.severity === s ? SEV[s].color : 'var(--text-muted)',
                    border: form.severity === s ? `1px solid ${SEV[s].border}` : '1px solid transparent',
                  }}>
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </button>
              ))}
              <div style={{ flex: 1 }}/>
              <button type="button" onClick={() => setShowForm(false)}
                style={{ padding: '8px 16px', borderRadius: 9, background: 'var(--border)', color: 'var(--text-muted)', border: 'none', cursor: 'pointer', fontSize: 13 }}>
                Cancel
              </button>
              <button type="submit"
                style={{ padding: '8px 20px', borderRadius: 9, background: 'rgba(239,68,68,0.12)', color: '#ef4444', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>
                Issue Alert
              </button>
            </div>
          </form>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {alerts.map(a => {
          const s = SEV[a.severity] || SEV.low
          return (
            <div key={a.id} style={{ background: s.bg, border: `1px solid ${s.border}`, borderRadius: 12, padding: '14px 18px', display: 'flex', gap: 14, alignItems: 'flex-start', position: 'relative' }}>
              <AlertTriangle style={{ width: 18, height: 18, color: s.color, flexShrink: 0, marginTop: 2 }}/>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                  <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)' }}>{a.title}</span>
                  <span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: s.bg, color: s.color, border: `1px solid ${s.border}` }}>{a.severity}</span>
                  <span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: 'var(--border)', color: 'var(--text-muted)' }}>{a.type}</span>
                  {a.is_active && <span style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: 'rgba(16,185,129,0.1)', color: '#10b981' }}><PulseDot color="#10b981"/> Active</span>}
                </div>
                <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 4 }}>{a.message}</p>
                <div style={{ display: 'flex', gap: 12, fontSize: 11, color: 'var(--text-light)' }}>
                  {a.site_name && <span>📍 {a.site_name}</span>}
                  <span>{timeAgo(a.created_at)}</span>
                </div>
              </div>
              <button onClick={() => del(a.id)}
                style={{ padding: 6, borderRadius: 7, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', flexShrink: 0 }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.1)'; e.currentTarget.style.color = '#ef4444' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'var(--text-muted)' }}>
                <Trash2 style={{ width: 14, height: 14 }}/>
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ── ACTIVITY LOG ── */
const MOCK_LOGS = [
  { username: 'sarah_chen', action: 'uploaded dataset: Whitefish_Q2_2025.csv', type: 'upload', created_at: new Date(Date.now() - 180000).toISOString() },
  { username: 'jpelletier', action: 'issued boil-water advisory for Whitefish Lake Station', type: 'admin', created_at: new Date(Date.now() - 600000).toISOString() },
  { username: 'marcus_o', action: 'completed quiz: Watershed Knowledge (Score: 87%)', type: 'quiz', created_at: new Date(Date.now() - 1800000).toISOString() },
  { username: 'amara_d', action: 'added site observation at Garden River Site B', type: 'observation', created_at: new Date(Date.now() - 3600000).toISOString() },
  { username: 'lindas', action: 'posted to community: "Noticed unusual discoloration near Echo Bay"', type: 'post', created_at: new Date(Date.now() - 7200000).toISOString() },
  { username: 'sarah_chen', action: 'ran water quality analysis on 3 files', type: 'analysis', created_at: new Date(Date.now() - 10800000).toISOString() },
  { username: 'riverj', action: 'joined collaboration project: Lake Superior Monitoring Initiative', type: 'project', created_at: new Date(Date.now() - 14400000).toISOString() },
  { username: 'theo_w', action: 'registered new account', type: 'auth', created_at: new Date(Date.now() - 86400000).toISOString() },
  { username: 'amara_d', action: 'exported data report: April 2025 Summary', type: 'export', created_at: new Date(Date.now() - 90000000).toISOString() },
]

const LOG_ICONS = {
  upload: { icon: '↑', color: '#14b8a6' },
  admin: { icon: '⚡', color: '#ef4444' },
  quiz: { icon: '✓', color: '#f59e0b' },
  observation: { icon: '◉', color: '#6366f1' },
  post: { icon: '✉', color: '#ec4899' },
  analysis: { icon: '⊞', color: '#8b5cf6' },
  project: { icon: '⬡', color: '#0ea5e9' },
  auth: { icon: '⊕', color: '#10b981' },
  export: { icon: '↓', color: '#64748b' },
  default: { icon: '·', color: '#94a3b8' },
}

function ActivityPanel() {
  const [logs, setLogs] = useState(MOCK_LOGS)

  useEffect(() => {
    api.get('/admin/activity-log?limit=50').then(r => {
      if (r.data.logs?.length) setLogs(r.data.logs)
    }).catch(() => {})
  }, [])

  const timeAgo = (d) => {
    const diff = Date.now() - new Date(d)
    if (diff < 60000) return 'just now'
    if (diff < 3600000) return Math.floor(diff / 60000) + 'm ago'
    if (diff < 86400000) return Math.floor(diff / 3600000) + 'h ago'
    return Math.floor(diff / 86400000) + 'd ago'
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <PulseDot color="#6366f1"/>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>Live Activity Stream</span>
        </div>
        <button style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', cursor: 'pointer' }}>
          <RefreshCw style={{ width: 12, height: 12 }}/> Refresh
        </button>
      </div>

      <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden' }}>
        {logs.map((log, i) => {
          const meta = LOG_ICONS[log.type] || LOG_ICONS.default
          return (
            <div key={i} style={{
              display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 18px',
              borderTop: i > 0 ? '1px solid var(--border)' : 'none',
              transition: 'background 0.12s',
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(99,102,241,0.03)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              {/* Timeline dot */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 4 }}>
                <div style={{ width: 26, height: 26, borderRadius: '50%', background: `${meta.color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 12, color: meta.color, fontWeight: 700 }}>
                  {meta.icon}
                </div>
                {i < logs.length - 1 && <div style={{ width: 1, flex: 1, background: 'var(--border)', marginTop: 4, minHeight: 8 }}/>}
              </div>
              <div style={{ flex: 1, minWidth: 0, paddingBottom: i < logs.length - 1 ? 8 : 0 }}>
                <div style={{ fontSize: 13, color: 'var(--text)' }}>
                  <span style={{ fontWeight: 700 }}>{log.username}</span>
                  <span style={{ color: 'var(--text-muted)', marginLeft: 6 }}>{log.action}</span>
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-light)', marginTop: 2 }}>{timeAgo(log.created_at)}</div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ── CMS / CONTENT PANEL ── */
function ContentPanel() {
  const sections = [
    { name: 'Landing Page', status: 'published', lastEdit: '2 hours ago', by: 'jpelletier' },
    { name: 'Quick Actions', status: 'published', lastEdit: '1 day ago', by: 'sarah_chen' },
    { name: 'Resource Library', status: 'draft', lastEdit: '3 hours ago', by: 'amara_d' },
    { name: 'Quiz Bank', status: 'published', lastEdit: '5 days ago', by: 'jpelletier' },
    { name: 'Sidebar Navigation', status: 'published', lastEdit: '1 week ago', by: 'jpelletier' },
    { name: 'Dashboard Widgets', status: 'published', lastEdit: '2 days ago', by: 'sarah_chen' },
    { name: 'Community Guidelines', status: 'published', lastEdit: '2 weeks ago', by: 'jpelletier' },
    { name: 'Onboarding Flow', status: 'draft', lastEdit: '4 hours ago', by: 'amara_d' },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{
        background: 'linear-gradient(135deg, rgba(99,102,241,0.08), rgba(20,184,166,0.06))',
        border: '1px solid rgba(99,102,241,0.15)', borderRadius: 12, padding: 16,
        display: 'flex', alignItems: 'center', gap: 14,
      }}>
        <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(99,102,241,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Edit2 style={{ width: 18, height: 18, color: '#818cf8' }}/>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)' }}>Visual CMS — Edit Mode</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Click any section below to open the visual editor. Changes are auto-saved as drafts.</div>
        </div>
        <button style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 9, background: '#6366f1', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
          <Eye style={{ width: 14, height: 14 }}/> Preview Site
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
        {sections.map(s => (
          <div key={s.name} style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 12, padding: 16, cursor: 'pointer', transition: 'all 0.15s' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = '#6366f1'; e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 4px 16px rgba(99,102,241,0.12)' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)' }}>{s.name}</span>
              <span style={{
                padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600,
                background: s.status === 'published' ? 'rgba(16,185,129,0.12)' : 'rgba(245,158,11,0.12)',
                color: s.status === 'published' ? '#10b981' : '#f59e0b',
              }}>{s.status}</span>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Last edited {s.lastEdit} by <strong>{s.by}</strong></div>
            <div style={{ display: 'flex', gap: 6, marginTop: 12 }}>
              <button style={{ flex: 1, padding: '6px 0', borderRadius: 8, background: 'rgba(99,102,241,0.1)', color: '#818cf8', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                Edit
              </button>
              {s.status === 'draft' && (
                <button style={{ flex: 1, padding: '6px 0', borderRadius: 8, background: 'rgba(16,185,129,0.1)', color: '#10b981', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                  Publish
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ── MODERATION PANEL ── */
function ModerationPanel() {
  const flagged = [
    { id: 1, type: 'post', content: 'Suspicious link posted in community feed claiming to be water testing kit giveaway', user: 'unknown_user99', time: '15 min ago', status: 'pending' },
    { id: 2, type: 'post', content: 'Repetitive spam comments on multiple researcher discussion threads', user: 'bot_account_4', time: '2 hrs ago', status: 'pending' },
    { id: 3, type: 'site', content: 'Incorrectly placed site marker — coordinates appear to be in the wrong lake', user: 'new_member_2', time: '5 hrs ago', status: 'reviewed' },
    { id: 4, type: 'message', content: 'Inappropriate language reported in group chat by 3 users', user: 'anon_user', time: '1 day ago', status: 'resolved' },
  ]

  const statusColors = {
    pending: { bg: 'rgba(245,158,11,0.1)', color: '#f59e0b' },
    reviewed: { bg: 'rgba(99,102,241,0.1)', color: '#818cf8' },
    resolved: { bg: 'rgba(16,185,129,0.1)', color: '#10b981' },
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', gap: 12 }}>
        {[
          { label: 'Pending Review', value: 2, color: '#f59e0b' },
          { label: 'Reviewed', value: 1, color: '#6366f1' },
          { label: 'Resolved (7d)', value: 8, color: '#10b981' },
        ].map(s => (
          <div key={s.label} style={{ flex: 1, background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 16px', textAlign: 'center' }}>
            <div style={{ fontSize: 22, fontWeight: 900, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{s.label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {flagged.map(item => {
          const sc = statusColors[item.status]
          return (
            <div key={item.id} style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 18px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <div style={{ width: 34, height: 34, borderRadius: 9, background: 'rgba(239,68,68,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <AlertTriangle style={{ width: 15, height: 15, color: '#ef4444' }}/>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                    <span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: 'rgba(99,102,241,0.1)', color: '#818cf8' }}>{item.type}</span>
                    <span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 600, ...sc }}>{item.status}</span>
                    <span style={{ fontSize: 11, color: 'var(--text-light)' }}>{item.time} · @{item.user}</span>
                  </div>
                  <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>{item.content}</p>
                </div>
                {item.status === 'pending' && (
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    <button style={{ padding: '6px 12px', borderRadius: 8, background: 'rgba(16,185,129,0.12)', color: '#10b981', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                      Approve
                    </button>
                    <button style={{ padding: '6px 12px', borderRadius: 8, background: 'rgba(239,68,68,0.12)', color: '#ef4444', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                      Remove
                    </button>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ── MAIN ── */
const TABS = [
  { key: 'overview',    label: 'Overview',    icon: BarChart2 },
  { key: 'users',       label: 'Users',       icon: Users,         badge: 2 },
  { key: 'alerts',      label: 'Alerts',      icon: AlertTriangle, badge: 4 },
  { key: 'moderation',  label: 'Moderation',  icon: Shield,        badge: 2 },
  { key: 'content',     label: 'CMS Content', icon: FileText },
  { key: 'activity',    label: 'Activity Log', icon: Activity },
]

export default function AdminPage() {
  const { user } = useAuth()
  const [tab, setTab] = useState('overview')

  return (
    <div style={{ position: 'relative', minHeight: '100vh' }}>
      <PageAmbience variant="admin"/>

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 4px', position: 'relative', zIndex: 1 }}>

        {/* Header */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
            <div style={{ width: 42, height: 42, borderRadius: 12, background: 'linear-gradient(135deg,#6366f1,#4f46e5)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 16px rgba(99,102,241,0.35)' }}>
              <ShieldCheck style={{ width: 20, height: 20, color: '#fff' }}/>
            </div>
            <div>
              <h1 style={{ fontSize: 20, fontWeight: 900, color: 'var(--text)', margin: 0 }}>Admin Panel</h1>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>NORDIK Institute — SOURCE Water Platform Management</div>
            </div>
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
              <PulseDot color="#10b981"/>
              <span style={{ fontSize: 12, color: '#10b981', fontWeight: 600 }}>Live</span>
              <div style={{ height: 14, width: 1, background: 'var(--border)', margin: '0 4px' }}/>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Signed in as <strong style={{ color: 'var(--text)' }}>{user?.display_name || user?.username}</strong></span>
            </div>
          </div>
        </div>

        {/* Tab bar */}
        <div style={{ display: 'flex', gap: 2, flexWrap: 'wrap', marginBottom: 20, borderBottom: '1px solid var(--border)', paddingBottom: 0 }}>
          {TABS.map(t => (
            <Tab key={t.key} active={tab === t.key} onClick={() => setTab(t.key)} icon={t.icon} label={t.label} badge={t.badge}/>
          ))}
        </div>

        {/* Tab content */}
        {tab === 'overview'   && <OverviewPanel/>}
        {tab === 'users'      && <UsersPanel/>}
        {tab === 'alerts'     && <AlertsAdminPanel/>}
        {tab === 'moderation' && <ModerationPanel/>}
        {tab === 'content'    && <ContentPanel/>}
        {tab === 'activity'   && <ActivityPanel/>}
      </div>

      <style>{`
        @keyframes ping {
          75%, 100% { transform: scale(2); opacity: 0; }
        }
      `}</style>
    </div>
  )
}
