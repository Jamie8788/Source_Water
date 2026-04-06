import PageAmbience from '../components/layout/PageAmbience'
import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import api from '../utils/api'
import { useAuth } from '../context/AuthContext'
import {
  ShieldCheck, Users, AlertTriangle, Activity, BarChart2,
  FileText, TrendingUp, TrendingDown,
  Eye, Trash2, Plus, Edit2, Search, Download,
  Globe, MessageSquare, Map, BookOpen, GraduationCap,
  RefreshCw, Lock, Unlock, FlaskConical,
  Database, ChevronDown, ChevronUp, Image as ImageIcon,
  Clock, CheckSquare, Type, Hash, ToggleLeft, AlignLeft,
  AlertCircle, ArrowUp, ArrowDown, X, Save, Send,
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
function OverviewPanel() {
  const [stats, setStats] = useState({})
  useEffect(() => {
    api.get('/admin/stats').then(r => setStats(r.data || {})).catch(() => {})
  }, [])

  const cards = [
    { icon: Users,        label: 'Total Users',       value: stats.total_users,          color: '#6366f1', sub: `+${stats.new_users_today || 0} today` },
    { icon: FlaskConical, label: 'Observations',       value: stats.total_observations,   color: '#14b8a6', sub: 'Field data entries' },
    { icon: MessageSquare,label: 'Community Posts',   value: stats.total_posts,           color: '#ec4899', sub: 'Total engagement' },
    { icon: GraduationCap,label: 'Quiz Attempts',     value: stats.total_quiz_attempts,   color: '#f59e0b', sub: 'Learning completions' },
    { icon: Map,          label: 'Total Sites',        value: stats.total_sites,           color: '#10b981', sub: 'Monitored locations' },
    { icon: AlertTriangle,label: 'Active Alerts',     value: stats.active_alerts,         color: '#ef4444', sub: 'Requires attention' },
    { icon: Globe,        label: 'Total Messages',    value: stats.total_messages,         color: '#0ea5e9', sub: 'Direct messages sent' },
    { icon: BookOpen,     label: 'Resources',          value: stats.total_resources,       color: '#a855f7', sub: 'Library items' },
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
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>SOURCE Water Platform</span>
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>NORDIK Institute</span>
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
  const max = Math.max(...data)

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
const ROLE_COLORS = {
  admin: { bg: 'rgba(99,102,241,0.15)', color: '#818cf8' },
  researcher: { bg: 'rgba(20,184,166,0.15)', color: '#2dd4bf' },
  student: { bg: 'rgba(245,158,11,0.15)', color: '#fbbf24' },
  community_member: { bg: 'rgba(16,185,129,0.15)', color: '#34d399' },
}

function UsersPanel() {
  const [users, setUsers] = useState([])
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')

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

  const toggleActive = async (u) => {
    await api.put(`/users/${u.id}`, { is_active: u.is_active ? 0 : 1 }).catch(() => {})
    setUsers(prev => prev.map(x => x.id === u.id ? { ...x, is_active: x.is_active ? 0 : 1 } : x))
  }

  const deleteUser = async (u) => {
    if (!confirm(`Permanently delete @${u.username}? All their posts, observations and data will be removed. This cannot be undone.`)) return
    const r = await api.delete(`/users/${u.id}`).catch(e => { alert(e.response?.data?.error || 'Failed'); return null })
    if (r) setUsers(prev => prev.filter(x => x.id !== u.id))
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
              {filtered.map(u => {
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
                        <button title={u.is_active ? 'Suspend user' : 'Reactivate user'} onClick={() => toggleActive(u)}
                          style={{ padding: 6, borderRadius: 7, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
                          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.1)'; e.currentTarget.style.color = '#ef4444' }}
                          onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'var(--text-muted)' }}>
                          {u.is_active ? <Lock style={{ width: 14, height: 14 }}/> : <Unlock style={{ width: 14, height: 14 }}/>}
                        </button>
                        <button title="Delete user" onClick={() => deleteUser(u)}
                          style={{ padding: 6, borderRadius: 7, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
                          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.1)'; e.currentTarget.style.color = '#ef4444' }}
                          onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'var(--text-muted)' }}>
                          <Trash2 style={{ width: 14, height: 14 }}/>
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
const SEV = {
  high:   { color: '#ef4444', bg: 'rgba(239,68,68,0.08)', border: 'rgba(239,68,68,0.2)' },
  medium: { color: '#f59e0b', bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.2)' },
  low:    { color: '#10b981', bg: 'rgba(16,185,129,0.08)', border: 'rgba(16,185,129,0.2)' },
}

function AlertsAdminPanel() {
  const [alerts, setAlerts] = useState([])
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
  const [logs, setLogs] = useState([])

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
const PAGE_ROUTES = {
  home: '/',
  dashboard: '/dashboard',
  resources: '/resources',
  quizzes: '/quizzes',
  social: '/social',
  analysis: '/analysis',
  settings: '/settings',
}
const PAGE_LABELS = {
  home: 'Home / Landing',
  dashboard: 'Dashboard',
  resources: 'Resource Library',
  quizzes: 'Quiz Bank',
  social: 'Social Feed',
  analysis: 'Analysis',
  settings: 'Settings',
}

function ContentPanel() {
  const [cmsData, setCmsData] = useState([])
  const [resources, setResources] = useState([])
  const [editRes, setEditRes] = useState(null)
  const [resForm, setResForm] = useState({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    api.get('/cms/all').then(r => setCmsData(r.data.content || [])).catch(() => {})
    api.get('/resources').then(r => setResources(r.data || [])).catch(() => {})
  }, [])

  // Group CMS entries by page_key and find latest updated_at per page
  const pageMap = {}
  cmsData.forEach(row => {
    if (!pageMap[row.page_key] || row.updated_at > pageMap[row.page_key].updated_at) {
      pageMap[row.page_key] = { updated_at: row.updated_at, count: (pageMap[row.page_key]?.count || 0) + 1 }
    } else {
      pageMap[row.page_key].count = (pageMap[row.page_key].count || 0) + 1
    }
  })

  const timeSince = (d) => {
    if (!d) return 'never'
    const diff = Date.now() - new Date(d)
    if (diff < 60000) return 'just now'
    if (diff < 3600000) return Math.floor(diff / 60000) + 'm ago'
    if (diff < 86400000) return Math.floor(diff / 3600000) + 'h ago'
    return Math.floor(diff / 86400000) + 'd ago'
  }

  const openEditRes = (r) => {
    setEditRes(r)
    setResForm({ title: r.title, description: r.description || '', category: r.category || '', visibility: r.visibility || 'public' })
  }

  const saveRes = async () => {
    setSaving(true)
    const r = await api.put(`/resources/${editRes.id}`, resForm).catch(() => null)
    if (r) setResources(prev => prev.map(x => x.id === editRes.id ? { ...x, ...resForm } : x))
    setSaving(false)
    setEditRes(null)
  }

  const deleteRes = async (id) => {
    if (!confirm('Delete this resource?')) return
    await api.delete(`/resources/${id}`).catch(() => {})
    setResources(prev => prev.filter(r => r.id !== id))
  }

  const inpStyle = { width: '100%', background: 'var(--card-bg)', border: '1.5px solid var(--border)', borderRadius: 9, padding: '8px 12px', fontSize: 13, color: 'var(--text)', outline: 'none' }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* CMS Edit Mode banner */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(99,102,241,0.08), rgba(20,184,166,0.06))',
        border: '1px solid rgba(99,102,241,0.15)', borderRadius: 12, padding: 16,
        display: 'flex', alignItems: 'center', gap: 14,
      }}>
        <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(99,102,241,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Edit2 style={{ width: 18, height: 18, color: '#818cf8' }}/>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)' }}>Visual CMS — Inline Edit Mode</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Navigate to a page then click "Enter CMS Edit Mode" in the top toolbar. Click any text to edit it live.</div>
        </div>
      </div>

      {/* CMS pages */}
      <div>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 10 }}>CMS Pages</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 10 }}>
          {Object.entries(PAGE_LABELS).map(([key, label]) => {
            const info = pageMap[key]
            return (
              <div key={key} style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 12, padding: 14, transition: 'all 0.15s' }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = '#6366f1'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(99,102,241,0.1)' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.boxShadow = 'none' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                  <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--text)' }}>{label}</span>
                  <span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 600,
                    background: info ? 'rgba(16,185,129,0.12)' : 'rgba(100,116,139,0.1)',
                    color: info ? '#10b981' : '#94a3b8' }}>
                    {info ? 'has content' : 'default'}
                  </span>
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 10 }}>
                  {info ? `${info.count} field${info.count !== 1 ? 's' : ''} · last edited ${timeSince(info.updated_at)}` : 'No custom content yet'}
                </div>
                <a href={PAGE_ROUTES[key]} target="_blank" rel="noreferrer"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 12px', borderRadius: 8, background: 'rgba(99,102,241,0.1)', color: '#818cf8', textDecoration: 'none', fontSize: 12, fontWeight: 600 }}>
                  <Eye style={{ width: 12, height: 12 }}/> Go to page
                </a>
              </div>
            )
          })}
        </div>
      </div>

      {/* Resources management */}
      <div>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 10 }}>Resource Library ({resources.length})</div>

        {/* Edit modal */}
        {editRes && (
          <div style={{ background: 'var(--card-bg)', border: '1px solid #6366f1', borderRadius: 12, padding: 16, marginBottom: 12 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 12 }}>Edit: {editRes.title}</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Title</label>
                <input style={inpStyle} value={resForm.title} onChange={e => setResForm(f => ({ ...f, title: e.target.value }))}/>
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Category</label>
                <input style={inpStyle} value={resForm.category} onChange={e => setResForm(f => ({ ...f, category: e.target.value }))}/>
              </div>
            </div>
            <div style={{ marginTop: 10 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Description</label>
              <textarea rows={2} style={{ ...inpStyle, resize: 'none' }} value={resForm.description} onChange={e => setResForm(f => ({ ...f, description: e.target.value }))}/>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 10, justifyContent: 'flex-end' }}>
              <select style={{ ...inpStyle, width: 'auto' }} value={resForm.visibility} onChange={e => setResForm(f => ({ ...f, visibility: e.target.value }))}>
                <option value="public">Public</option>
                <option value="private">Private</option>
              </select>
              <button onClick={() => setEditRes(null)} style={{ padding: '7px 14px', borderRadius: 8, background: 'var(--border)', color: 'var(--text-muted)', border: 'none', cursor: 'pointer', fontSize: 12 }}>Cancel</button>
              <button onClick={saveRes} disabled={saving} style={{ padding: '7px 16px', borderRadius: 8, background: 'rgba(99,102,241,0.12)', color: '#818cf8', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>
                {saving ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </div>
        )}

        <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
          {resources.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>No resources yet</div>
          ) : resources.map((r, i) => (
            <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', borderTop: i > 0 ? '1px solid var(--border)' : 'none', transition: 'background 0.12s' }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(99,102,241,0.03)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.title}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{r.resource_type} {r.category ? `· ${r.category}` : ''} · {r.visibility}</div>
              </div>
              <button onClick={() => openEditRes(r)}
                style={{ padding: '5px 10px', borderRadius: 7, background: 'rgba(99,102,241,0.1)', color: '#818cf8', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                Edit
              </button>
              <button onClick={() => deleteRes(r.id)}
                style={{ padding: 5, borderRadius: 7, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
                onMouseEnter={e => { e.currentTarget.style.color = '#ef4444' }}
                onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)' }}>
                <Trash2 style={{ width: 13, height: 13 }}/>
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ── POSTS MANAGEMENT PANEL ── */
const API_BASE = import.meta.env.VITE_API_URL?.replace('/api','') || 'http://localhost:3001'
const mediaUrl = (src) => !src ? '' : src.startsWith('http') ? src : `${API_BASE}${src}`

function PostsPanel() {
  const [posts, setPosts] = useState([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [total, setTotal] = useState(0)
  const [offset, setOffset] = useState(0)
  const LIMIT = 20

  const load = (off = 0) => {
    setLoading(true)
    api.get(`/posts?limit=${LIMIT}&offset=${off}`).then(r => {
      if (off === 0) setPosts(r.data.posts || [])
      else setPosts(prev => [...prev, ...(r.data.posts || [])])
      setTotal(r.data.total || 0)
      setOffset(off)
    }).catch(() => {}).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const deletePost = async (id) => {
    if (!confirm('Delete this post permanently?')) return
    await api.delete(`/posts/${id}`).catch(() => {})
    setPosts(prev => prev.filter(p => p.id !== id))
    setTotal(t => t - 1)
  }

  const pinPost = async (post) => {
    await api.put(`/posts/${post.id}/pin`).catch(() => {})
    setPosts(prev => prev.map(p => p.id === post.id ? { ...p, pinned: p.pinned ? 0 : 1 } : p))
  }

  const timeAgo = (d) => {
    const diff = Date.now() - new Date(d)
    if (diff < 60000) return 'just now'
    if (diff < 3600000) return Math.floor(diff / 60000) + 'm ago'
    if (diff < 86400000) return Math.floor(diff / 3600000) + 'h ago'
    return Math.floor(diff / 86400000) + 'd ago'
  }

  const filtered = search ? posts.filter(p =>
    p.content?.toLowerCase().includes(search.toLowerCase()) ||
    p.user?.display_name?.toLowerCase().includes(search.toLowerCase()) ||
    p.user?.username?.toLowerCase().includes(search.toLowerCase())
  ) : posts

  const totalReactions = (p) => Object.values(p.reactions || {}).reduce((s, v) => s + v, 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <Search style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', width: 14, height: 14, color: 'var(--text-light)' }}/>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search posts or users…"
            style={{ paddingLeft: 32, width: '100%', background: 'var(--card-bg)', border: '1.5px solid var(--border)', borderRadius: 9, padding: '8px 12px 8px 32px', fontSize: 13, color: 'var(--text)', outline: 'none' }}/>
        </div>
        <button onClick={() => load(0)} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '8px 14px', borderRadius: 9, background: 'var(--border)', border: 'none', cursor: 'pointer', fontSize: 12, color: 'var(--text-muted)' }}>
          <RefreshCw style={{ width: 12, height: 12 }}/> Refresh
        </button>
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{total} total posts</span>
      </div>

      {loading && posts.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)', fontSize: 13 }}>Loading posts…</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)', fontSize: 13 }}>No posts found</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtered.map(p => (
            <div key={p.id} style={{ background: 'var(--card-bg)', border: `1px solid ${p.pinned ? 'rgba(99,102,241,0.3)' : 'var(--border)'}`, borderRadius: 12, padding: '14px 18px', position: 'relative' }}>
              {p.pinned ? <div style={{ position: 'absolute', top: 10, right: 12, fontSize: 10, fontWeight: 700, color: '#818cf8', background: 'rgba(99,102,241,0.1)', padding: '2px 8px', borderRadius: 20 }}>📌 PINNED</div> : null}
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 8 }}>
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'linear-gradient(135deg,#6366f1,#14b8a6)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 14, flexShrink: 0 }}>
                  {p.user?.display_name?.[0]?.toUpperCase() || '?'}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--text)' }}>{p.user?.display_name || p.user?.username}</span>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>@{p.user?.username}</span>
                    <span style={{ fontSize: 11, color: 'var(--text-light)' }}>{timeAgo(p.created_at)}</span>
                    {p.post_type !== 'text' && <span style={{ padding: '1px 6px', borderRadius: 20, fontSize: 10, fontWeight: 600, background: 'rgba(99,102,241,0.1)', color: '#818cf8' }}>{p.post_type}</span>}
                  </div>
                  {p.content && <p style={{ fontSize: 13, color: 'var(--text)', margin: '6px 0 0', lineHeight: 1.6, wordBreak: 'break-word' }}>{p.content.length > 300 ? p.content.slice(0,300)+'…' : p.content}</p>}
                  {p.media?.length > 0 && (
                    <div style={{ marginTop: 8, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {p.media.slice(0,3).map((m, i) => (
                        m.includes('.mp4') || m.includes('.webm') || m.includes('video') ? (
                          <video key={i} src={mediaUrl(m)} style={{ height: 60, width: 90, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--border)' }}/>
                        ) : (
                          <img key={i} src={mediaUrl(m)} alt="" style={{ height: 60, width: 90, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--border)' }}/>
                        )
                      ))}
                      {p.media.length > 3 && <div style={{ height: 60, width: 90, borderRadius: 8, background: 'var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: 'var(--text-muted)' }}>+{p.media.length-3}</div>}
                    </div>
                  )}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingTop: 8, borderTop: '1px solid var(--border)' }}>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>💬 {p.comment_count || 0}</span>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>❤️ {totalReactions(p)}</span>
                {p.hashtags?.length > 0 && <span style={{ fontSize: 11, color: '#818cf8' }}>{p.hashtags.slice(0,3).map(h => `#${h}`).join(' ')}</span>}
                <div style={{ flex: 1 }}/>
                <button onClick={() => pinPost(p)} title={p.pinned ? 'Unpin' : 'Pin to top'}
                  style={{ padding: '5px 10px', borderRadius: 7, background: p.pinned ? 'rgba(99,102,241,0.12)' : 'var(--border)', color: p.pinned ? '#818cf8' : 'var(--text-muted)', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                  📌 {p.pinned ? 'Unpin' : 'Pin'}
                </button>
                <button onClick={() => deletePost(p.id)}
                  style={{ padding: '5px 10px', borderRadius: 7, background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Trash2 style={{ width: 12, height: 12 }}/> Delete
                </button>
              </div>
            </div>
          ))}
          {posts.length < total && (
            <button onClick={() => load(offset + LIMIT)}
              style={{ padding: '10px', borderRadius: 10, background: 'var(--card-bg)', border: '1px solid var(--border)', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
              Load more ({total - posts.length} remaining)
            </button>
          )}
        </div>
      )}
    </div>
  )
}

/* ── QUIZ MANAGEMENT PANEL ── */
const DIFF_COLORS_Q = {
  beginner:     { bg: 'rgba(16,185,129,0.12)',  color: '#10b981' },
  intermediate: { bg: 'rgba(245,158,11,0.12)',  color: '#f59e0b' },
  advanced:     { bg: 'rgba(239,68,68,0.12)',   color: '#ef4444' },
}
const STATUS_COLORS = {
  published: { bg: 'rgba(16,185,129,0.12)', color: '#10b981' },
  draft:     { bg: 'rgba(100,116,139,0.12)', color: '#94a3b8' },
  archived:  { bg: 'rgba(99,102,241,0.12)',  color: '#818cf8' },
}

// ── Question type config ──
const Q_TYPES = [
  { value: 'mcq',            label: 'Multiple Choice',   icon: '◉', color: '#6366f1' },
  { value: 'true_false',     label: 'True / False',      icon: '⊤', color: '#10b981' },
  { value: 'multiple_select',label: 'Multi-Select',      icon: '☑', color: '#8b5cf6' },
  { value: 'short_answer',   label: 'Short Answer',      icon: 'T', color: '#f59e0b' },
  { value: 'numeric',        label: 'Numeric',           icon: '#', color: '#0ea5e9' },
  { value: 'fill_blank',     label: 'Fill in the Blank', icon: '_', color: '#14b8a6' },
]

// ── Full-screen Quiz Builder overlay ──
function QuizBuilder({ quiz, onClose, onSave }) {
  const [form, setForm] = useState({
    title: quiz?.title || '',
    description: quiz?.description || '',
    category: quiz?.category || 'water_quality',
    difficulty: quiz?.difficulty || 'beginner',
    time_per_question: quiz?.time_per_question || 60,
    time_limit: quiz?.time_limit || 0,
    pass_score: quiz?.pass_score || 70,
    negative_marking: quiz?.negative_marking || 0,
    shuffle_questions: !!quiz?.shuffle_questions,
    shuffle_answers: !!quiz?.shuffle_answers,
    show_answers_after: quiz?.show_answers_after !== 0,
    status: quiz?.status || 'draft',
  })
  const [questions, setQuestions] = useState([])
  const [editQ, setEditQ] = useState(null) // null = none, 'new' = new question, {..} = edit existing
  const [qForm, setQForm] = useState(null)
  const [saving, setSaving] = useState(false)
  const [savingQ, setSavingQ] = useState(false)
  const [imgPreview, setImgPreview] = useState(null)
  const imgRef = useRef(null)

  const blankQ = () => ({ question_type: 'mcq', question_text: '', options: ['', '', '', ''], correct_answers: [0], explanation: '', points: 1, negative_points: 0, image: null })

  useEffect(() => {
    if (!quiz?.id) return
    api.get(`/quizzes/${quiz.id}`).then(r => setQuestions(r.data.questions || [])).catch(() => {})
  }, [quiz?.id])

  const inp = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const saveQuiz = async () => {
    if (!form.title.trim()) return
    setSaving(true)
    try {
      let r
      if (quiz?.id) {
        r = await api.put(`/quizzes/${quiz.id}`, form)
      } else {
        r = await api.post('/quizzes', form)
      }
      onSave(r.data, questions)
    } catch (e) { alert(e.response?.data?.error || 'Failed to save quiz') }
    setSaving(false)
  }

  const openNewQ = () => { setQForm(blankQ()); setEditQ('new'); setImgPreview(null) }
  const openEditQ = (q) => {
    setQForm({
      question_type: q.question_type,
      question_text: q.question_text,
      options: q.options?.length ? q.options : ['', '', '', ''],
      correct_answers: q.correct_answers || [0],
      explanation: q.explanation || '',
      points: q.points || 1,
      negative_points: q.negative_points || 0,
      image: null,
    })
    setImgPreview(q.question_image ? mediaUrl(q.question_image) : null)
    setEditQ(q)
  }

  const saveQ = async () => {
    if (!qForm?.question_text?.trim()) return
    setSavingQ(true)
    const token = localStorage.getItem('sw_token')
    const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:3001/api'
    const quizId = quiz?.id
    if (!quizId) { setSavingQ(false); alert('Save the quiz first'); return }

    const fd = new FormData()
    fd.append('question_type', qForm.question_type)
    fd.append('question_text', qForm.question_text)
    fd.append('options', JSON.stringify(qForm.options?.filter(o => o.trim()) || []))
    fd.append('correct_answers', JSON.stringify(qForm.correct_answers || []))
    fd.append('explanation', qForm.explanation || '')
    fd.append('points', qForm.points)
    fd.append('negative_points', qForm.negative_points)
    fd.append('sort_order', editQ !== 'new' ? (editQ?.sort_order ?? questions.length) : questions.length)
    if (qForm.image) fd.append('question_image', qForm.image)

    try {
      let url, method
      if (editQ === 'new') { url = `${apiBase}/quizzes/${quizId}/questions`; method = 'POST' }
      else { url = `${apiBase}/quizzes/questions/${editQ.id}`; method = 'PUT' }

      const res = await fetch(url, { method, headers: { Authorization: `Bearer ${token}` }, body: fd })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed')

      // Parse saved question
      const saved = { ...data, options: data.options ? JSON.parse(data.options) : [], correct_answers: data.correct_answers ? JSON.parse(data.correct_answers) : [] }
      if (editQ === 'new') setQuestions(prev => [...prev, saved])
      else setQuestions(prev => prev.map(q => q.id === saved.id ? saved : q))
      setEditQ(null); setQForm(null); setImgPreview(null)
    } catch (e) { alert(e.message) }
    setSavingQ(false)
  }

  const delQ = async (q) => {
    if (!confirm('Delete this question?')) return
    await api.delete(`/quizzes/questions/${q.id}`).catch(() => {})
    setQuestions(prev => prev.filter(x => x.id !== q.id))
  }

  const moveQ = (idx, dir) => {
    const arr = [...questions]
    const to = idx + dir
    if (to < 0 || to >= arr.length) return
    ;[arr[idx], arr[to]] = [arr[to], arr[idx]]
    setQuestions(arr)
  }

  const iS = { width: '100%', background: 'var(--card-bg)', border: '1.5px solid var(--border)', borderRadius: 9, padding: '8px 12px', fontSize: 13, color: 'var(--text)', outline: 'none' }
  const lS = { fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }

  return createPortal(
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 99999, display: 'flex', alignItems: 'stretch', backdropFilter: 'blur(4px)' }}>
      <div style={{ width: '100%', maxWidth: 1200, margin: '20px auto', background: 'var(--page-bg)', borderRadius: 18, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {/* Builder header */}
        <div style={{ background: 'linear-gradient(135deg,#6366f1,#4f46e5)', padding: '16px 24px', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
          <GraduationCap style={{ width: 22, height: 22, color: 'white' }}/>
          <div style={{ flex: 1 }}>
            <div style={{ color: 'white', fontWeight: 800, fontSize: 17 }}>{quiz?.id ? 'Edit Quiz' : 'Create Quiz'}</div>
            <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12 }}>Brightspace-style quiz builder</div>
          </div>
          <button onClick={saveQuiz} disabled={saving || !form.title.trim()}
            style={{ padding: '9px 20px', borderRadius: 10, background: 'rgba(255,255,255,0.2)', border: 'none', color: 'white', fontWeight: 700, fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, opacity: saving || !form.title.trim() ? 0.5 : 1 }}>
            <Save style={{ width: 15, height: 15 }}/>{saving ? 'Saving…' : quiz?.id ? 'Save Quiz' : 'Create & Add Questions'}
          </button>
          <button onClick={onClose} style={{ padding: '8px', borderRadius: 8, background: 'rgba(255,255,255,0.15)', border: 'none', cursor: 'pointer', color: 'white', display: 'flex' }}>
            <X style={{ width: 18, height: 18 }}/>
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', display: 'grid', gridTemplateColumns: quiz?.id ? '320px 1fr' : '1fr', gap: 0 }}>
          {/* Settings panel */}
          <div style={{ borderRight: quiz?.id ? '1px solid var(--border)' : 'none', padding: 20, display: 'flex', flexDirection: 'column', gap: 14, overflowY: 'auto', background: 'var(--card-bg)' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', borderBottom: '1px solid var(--border)', paddingBottom: 8 }}>⚙️ Quiz Settings</div>
            <div>
              <label style={lS}>Title *</label>
              <input value={form.title} onChange={e => inp('title', e.target.value)} placeholder="Quiz title..." style={iS}/>
            </div>
            <div>
              <label style={lS}>Description</label>
              <textarea rows={2} value={form.description} onChange={e => inp('description', e.target.value)} style={{ ...iS, resize: 'none' }}/>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label style={lS}>Category</label>
                <select value={form.category} onChange={e => inp('category', e.target.value)} style={iS}>
                  {['water_quality','ecology','sampling','safety','data_literacy','general'].map(c => <option key={c} value={c}>{c.replace(/_/g,' ')}</option>)}
                </select>
              </div>
              <div>
                <label style={lS}>Difficulty</label>
                <select value={form.difficulty} onChange={e => inp('difficulty', e.target.value)} style={iS}>
                  {['beginner','intermediate','advanced'].map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div>
                <label style={lS}>⏱ Time / Question (sec)</label>
                <input type="number" min={0} value={form.time_per_question} onChange={e => inp('time_per_question', +e.target.value)} style={iS}/>
              </div>
              <div>
                <label style={lS}>⏱ Total Quiz Timer (min, 0=off)</label>
                <input type="number" min={0} value={form.time_limit} onChange={e => inp('time_limit', +e.target.value)} style={iS}/>
              </div>
              <div>
                <label style={lS}>Pass Score %</label>
                <input type="number" min={0} max={100} value={form.pass_score} onChange={e => inp('pass_score', +e.target.value)} style={iS}/>
              </div>
              <div>
                <label style={lS}>➖ Negative Marking (pts deducted)</label>
                <input type="number" min={0} step={0.25} value={form.negative_marking} onChange={e => inp('negative_marking', +e.target.value)} style={iS}/>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[['shuffle_questions','Shuffle question order'],['shuffle_answers','Shuffle answer options'],['show_answers_after','Show correct answers after submission']].map(([k,label]) => (
                <label key={k} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text)', cursor: 'pointer' }}>
                  <input type="checkbox" checked={!!form[k]} onChange={e => inp(k, e.target.checked)} style={{ width: 15, height: 15 }}/>
                  {label}
                </label>
              ))}
            </div>
            <div>
              <label style={lS}>Status</label>
              <select value={form.status} onChange={e => inp('status', e.target.value)} style={iS}>
                <option value="draft">📝 Draft</option>
                <option value="published">✅ Published</option>
                <option value="archived">📦 Archived</option>
              </select>
            </div>
          </div>

          {/* Questions panel — only shown if quiz is saved */}
          {quiz?.id && (
            <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              {/* Questions list */}
              <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>
                    📋 Questions ({questions.length})
                    {form.negative_marking > 0 && <span style={{ marginLeft: 8, fontSize: 11, background: 'rgba(239,68,68,0.1)', color: '#ef4444', padding: '2px 8px', borderRadius: 20, fontWeight: 600 }}>-{form.negative_marking} pts/wrong</span>}
                  </div>
                  <button onClick={openNewQ}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 9, background: 'rgba(99,102,241,0.12)', color: '#818cf8', border: '1px dashed rgba(99,102,241,0.3)', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                    <Plus style={{ width: 14, height: 14 }}/> Add Question
                  </button>
                </div>

                {questions.length === 0 && !editQ && (
                  <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)', fontSize: 13 }}>
                    <div style={{ fontSize: 40, marginBottom: 10 }}>📝</div>
                    No questions yet. Click "Add Question" to build your quiz.
                  </div>
                )}

                {/* Question cards */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
                  {questions.map((q, i) => {
                    const qt = Q_TYPES.find(t => t.value === q.question_type) || Q_TYPES[0]
                    return (
                      <div key={q.id} style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 12, padding: '12px 16px', display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flexShrink: 0 }}>
                          <button onClick={() => moveQ(i, -1)} disabled={i === 0} style={{ padding: '3px 5px', borderRadius: 5, border: 'none', background: 'var(--border)', cursor: i===0?'not-allowed':'pointer', opacity: i===0?0.3:1 }}><ArrowUp style={{ width: 11, height: 11 }}/></button>
                          <span style={{ textAlign: 'center', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)' }}>{i+1}</span>
                          <button onClick={() => moveQ(i, 1)} disabled={i === questions.length-1} style={{ padding: '3px 5px', borderRadius: 5, border: 'none', background: 'var(--border)', cursor: i===questions.length-1?'not-allowed':'pointer', opacity: i===questions.length-1?0.3:1 }}><ArrowDown style={{ width: 11, height: 11 }}/></button>
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                            <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: `${qt.color}18`, color: qt.color }}>{qt.icon} {qt.label}</span>
                            <span style={{ fontSize: 11, color: 'var(--text-light)' }}>{q.points} pt{q.points !== 1 ? 's' : ''}{q.negative_points > 0 ? ` / -${q.negative_points}` : ''}</span>
                            {q.question_image && <span style={{ fontSize: 11, color: '#10b981' }}>🖼 Image</span>}
                          </div>
                          <div style={{ fontSize: 13, color: 'var(--text)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{q.question_text}</div>
                          {(q.question_type === 'mcq' || q.question_type === 'true_false' || q.question_type === 'multiple_select') && q.options?.length > 0 && (
                            <div style={{ marginTop: 4, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                              {q.options.map((opt, oi) => (
                                <span key={oi} style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20,
                                  background: q.correct_answers?.includes(oi) ? 'rgba(16,185,129,0.15)' : 'var(--border)',
                                  color: q.correct_answers?.includes(oi) ? '#10b981' : 'var(--text-muted)',
                                  fontWeight: q.correct_answers?.includes(oi) ? 700 : 400 }}>
                                  {q.correct_answers?.includes(oi) ? '✓ ' : ''}{opt}
                                </span>
                              ))}
                            </div>
                          )}
                          {q.explanation && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, fontStyle: 'italic' }}>💡 {q.explanation}</div>}
                        </div>
                        <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                          <button onClick={() => openEditQ(q)} style={{ padding: '5px 7px', borderRadius: 7, background: 'rgba(99,102,241,0.1)', border: 'none', cursor: 'pointer', color: '#818cf8' }}><Edit2 style={{ width: 12, height: 12 }}/></button>
                          <button onClick={() => delQ(q)} style={{ padding: '5px 7px', borderRadius: 7, background: 'rgba(239,68,68,0.08)', border: 'none', cursor: 'pointer', color: '#ef4444' }}><Trash2 style={{ width: 12, height: 12 }}/></button>
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* Question editor */}
                {(editQ === 'new' || (editQ && editQ !== 'new')) && qForm && (
                  <div style={{ background: 'var(--card-bg)', border: '2px solid rgba(99,102,241,0.3)', borderRadius: 14, padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <div style={{ fontSize: 14, fontWeight: 800, color: '#818cf8' }}>{editQ === 'new' ? '➕ New Question' : '✏️ Edit Question'}</div>

                    {/* Type selector */}
                    <div>
                      <label style={lS}>Question Type</label>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {Q_TYPES.map(t => (
                          <button key={t.value} onClick={() => setQForm(f => ({ ...f, question_type: t.value, correct_answers: t.value === 'true_false' ? [0] : t.value === 'multiple_select' ? [] : [0], options: t.value === 'true_false' ? ['True', 'False'] : (f.options?.length ? f.options : ['','','','']) }))}
                            style={{ padding: '6px 12px', borderRadius: 20, border: `2px solid ${qForm.question_type === t.value ? t.color : 'var(--border)'}`, background: qForm.question_type === t.value ? `${t.color}18` : 'transparent', color: qForm.question_type === t.value ? t.color : 'var(--text-muted)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                            {t.icon} {t.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Question text */}
                    <div>
                      <label style={lS}>Question Text *</label>
                      <textarea rows={3} value={qForm.question_text} onChange={e => setQForm(f => ({ ...f, question_text: e.target.value }))}
                        placeholder="Type your question here..." style={{ ...iS, resize: 'vertical' }}/>
                    </div>

                    {/* Image upload */}
                    <div>
                      <label style={lS}>🖼 Question Image (optional)</label>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <input ref={imgRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => {
                          const f = e.target.files?.[0]
                          if (!f) return
                          setQForm(prev => ({ ...prev, image: f }))
                          setImgPreview(URL.createObjectURL(f))
                        }}/>
                        <button onClick={() => imgRef.current?.click()} style={{ padding: '7px 14px', borderRadius: 9, background: 'var(--border)', color: 'var(--text-muted)', border: 'none', cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                          <ImageIcon style={{ width: 13, height: 13 }}/> {imgPreview ? 'Change Image' : 'Upload Image'}
                        </button>
                        {imgPreview && (
                          <>
                            <img src={imgPreview} alt="preview" style={{ height: 60, width: 90, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--border)' }}/>
                            <button onClick={() => { setImgPreview(null); setQForm(f => ({ ...f, image: null })) }} style={{ padding: '4px', borderRadius: 5, background: 'rgba(239,68,68,0.1)', border: 'none', cursor: 'pointer', color: '#ef4444' }}>✕</button>
                          </>
                        )}
                      </div>
                    </div>

                    {/* MCQ options */}
                    {(qForm.question_type === 'mcq' || qForm.question_type === 'multiple_select') && (
                      <div>
                        <label style={lS}>{qForm.question_type === 'mcq' ? 'Answer Options (select correct one)' : 'Answer Options (select all correct)'}</label>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          {qForm.options.map((opt, oi) => {
                            const isCorrect = qForm.correct_answers?.includes(oi)
                            return (
                              <div key={oi} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                {qForm.question_type === 'mcq' ? (
                                  <input type="radio" name="correct_radio" checked={isCorrect} onChange={() => setQForm(f => ({ ...f, correct_answers: [oi] }))} style={{ flexShrink: 0 }}/>
                                ) : (
                                  <input type="checkbox" checked={isCorrect} onChange={() => setQForm(f => ({ ...f, correct_answers: isCorrect ? f.correct_answers.filter(x => x !== oi) : [...f.correct_answers, oi] }))} style={{ flexShrink: 0 }}/>
                                )}
                                <input value={opt} onChange={e => { const o = [...qForm.options]; o[oi] = e.target.value; setQForm(f => ({ ...f, options: o })) }}
                                  placeholder={`Option ${String.fromCharCode(65+oi)}`}
                                  style={{ flex: 1, minWidth: 0, width: 'auto', background: 'var(--card-bg)', border: `1.5px solid ${isCorrect ? '#10b981' : 'var(--border)'}`, borderRadius: 9, padding: '7px 12px', fontSize: 13, color: 'var(--text)', outline: 'none' }}/>
                                {qForm.options.length > 2 && (
                                  <button onClick={() => { const o = qForm.options.filter((_,j)=>j!==oi); const ca = qForm.correct_answers.filter(x=>x!==oi).map(x=>x>oi?x-1:x); setQForm(f=>({...f,options:o,correct_answers:ca})) }} style={{ padding: '4px', borderRadius: 5, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', flexShrink: 0 }}>✕</button>
                                )}
                              </div>
                            )
                          })}
                          <button onClick={() => setQForm(f => ({ ...f, options: [...f.options, ''] }))} style={{ padding: '6px 14px', borderRadius: 8, background: 'rgba(99,102,241,0.08)', color: '#818cf8', border: '1px dashed rgba(99,102,241,0.3)', cursor: 'pointer', fontSize: 12, fontWeight: 600, alignSelf: 'flex-start' }}>
                            + Add Option
                          </button>
                        </div>
                      </div>
                    )}

                    {/* True/False */}
                    {qForm.question_type === 'true_false' && (
                      <div>
                        <label style={lS}>Correct Answer</label>
                        <div style={{ display: 'flex', gap: 12 }}>
                          {['True', 'False'].map((tf, ti) => (
                            <button key={tf} onClick={() => setQForm(f => ({ ...f, correct_answers: [ti], options: ['True','False'] }))}
                              style={{ flex: 1, padding: '10px', borderRadius: 10, border: `2px solid ${qForm.correct_answers?.[0] === ti ? '#10b981' : 'var(--border)'}`, background: qForm.correct_answers?.[0] === ti ? 'rgba(16,185,129,0.12)' : 'var(--card-bg)', color: qForm.correct_answers?.[0] === ti ? '#10b981' : 'var(--text)', fontWeight: 700, cursor: 'pointer', fontSize: 14 }}>
                              {ti === 0 ? '✓ True' : '✗ False'}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Short answer / fill blank */}
                    {(qForm.question_type === 'short_answer' || qForm.question_type === 'fill_blank') && (
                      <div>
                        <label style={lS}>Accepted Answers (comma separated)</label>
                        <input value={qForm.correct_answers?.join(', ') || ''}
                          onChange={e => setQForm(f => ({ ...f, correct_answers: e.target.value.split(',').map(s => s.trim()).filter(Boolean) }))}
                          placeholder="answer1, answer2, ..." style={iS}/>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>Case-insensitive matching. Add variations.</div>
                      </div>
                    )}

                    {/* Numeric */}
                    {qForm.question_type === 'numeric' && (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                        <div>
                          <label style={lS}>Correct Number</label>
                          <input type="number" value={qForm.correct_answers?.[0] || ''} onChange={e => setQForm(f => ({ ...f, correct_answers: [e.target.value] }))} style={iS}/>
                        </div>
                        <div>
                          <label style={lS}>Tolerance (±)</label>
                          <input type="number" min={0} step={0.01} value={qForm.correct_answers?.[1] || 0} onChange={e => setQForm(f => ({ ...f, correct_answers: [f.correct_answers?.[0] || 0, e.target.value] }))} style={iS}/>
                        </div>
                      </div>
                    )}

                    {/* Points + negative marking */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                      <div>
                        <label style={lS}>Points for Correct</label>
                        <input type="number" min={0} step={0.5} value={qForm.points} onChange={e => setQForm(f => ({ ...f, points: +e.target.value }))} style={iS}/>
                      </div>
                      <div>
                        <label style={lS}>➖ Points Deducted if Wrong (override global)</label>
                        <input type="number" min={0} step={0.25} value={qForm.negative_points} onChange={e => setQForm(f => ({ ...f, negative_points: +e.target.value }))} placeholder={`default: ${form.negative_marking}`} style={iS}/>
                      </div>
                    </div>

                    {/* Explanation */}
                    <div>
                      <label style={lS}>💡 Explanation / Feedback (shown after attempt)</label>
                      <textarea rows={2} value={qForm.explanation} onChange={e => setQForm(f => ({ ...f, explanation: e.target.value }))}
                        placeholder="Explain why the answer is correct..." style={{ ...iS, resize: 'none' }}/>
                    </div>

                    <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                      <button onClick={() => { setEditQ(null); setQForm(null); setImgPreview(null) }} style={{ padding: '8px 16px', borderRadius: 9, background: 'var(--border)', color: 'var(--text-muted)', border: 'none', cursor: 'pointer', fontSize: 13 }}>Cancel</button>
                      <button onClick={saveQ} disabled={savingQ || !qForm.question_text?.trim()}
                        style={{ padding: '8px 20px', borderRadius: 9, background: 'rgba(99,102,241,0.15)', color: '#818cf8', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700, opacity: savingQ || !qForm.question_text?.trim() ? 0.5 : 1 }}>
                        {savingQ ? 'Saving…' : editQ === 'new' ? '+ Add Question' : 'Save Changes'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer summary */}
        {quiz?.id && (
          <div style={{ borderTop: '1px solid var(--border)', padding: '12px 24px', display: 'flex', alignItems: 'center', gap: 16, background: 'var(--card-bg)', flexShrink: 0 }}>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{questions.length} questions</span>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Total: {questions.reduce((s,q) => s+(q.points||1), 0)} pts</span>
            {form.negative_marking > 0 && <span style={{ fontSize: 12, color: '#ef4444' }}>Negative marking: -{form.negative_marking} pts/wrong</span>}
            {form.time_limit > 0 && <span style={{ fontSize: 12, color: '#f59e0b' }}>⏱ {form.time_limit} min total</span>}
            <div style={{ flex: 1 }}/>
            <span style={{ fontSize: 12, fontWeight: 700, padding: '4px 10px', borderRadius: 20, ...STATUS_COLORS[form.status] }}>{form.status}</span>
          </div>
        )}
      </div>
    </div>,
    document.body
  )
}

function QuizPanel() {
  const [quizzes, setQuizzes] = useState([])
  const [builderQuiz, setBuilderQuiz] = useState(null) // null=closed, {}=new, quiz=edit

  useEffect(() => { reload() }, [])
  const reload = () => api.get('/quizzes').then(r => setQuizzes(r.data.quizzes || [])).catch(() => {})

  const del = async (id) => {
    if (!confirm('Delete this quiz and all its questions?')) return
    await api.delete(`/quizzes/${id}`).catch(() => {})
    setQuizzes(prev => prev.filter(q => q.id !== id))
  }

  const toggleStatus = async (quiz) => {
    const s = quiz.status === 'published' ? 'draft' : 'published'
    const r = await api.put(`/quizzes/${quiz.id}`, { ...quiz, status: s }).catch(() => null)
    if (r) setQuizzes(prev => prev.map(q => q.id === quiz.id ? { ...q, status: s } : q))
  }

  const handleSave = (savedQuiz) => {
    setQuizzes(prev => {
      const exists = prev.find(q => q.id === savedQuiz.id)
      return exists ? prev.map(q => q.id === savedQuiz.id ? { ...q, ...savedQuiz } : q) : [{ ...savedQuiz, question_count: 0, attempt_count: 0 }, ...prev]
    })
    // Re-open builder with the saved quiz so user can add questions immediately
    if (!builderQuiz?.id) setBuilderQuiz(savedQuiz)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {builderQuiz !== null && (
        <QuizBuilder quiz={builderQuiz?.id ? builderQuiz : null} onClose={() => { setBuilderQuiz(null); reload() }} onSave={handleSave}/>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{quizzes.length} quizzes · {quizzes.filter(q => q.status === 'published').length} published</div>
        <button onClick={() => setBuilderQuiz({})}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 18px', borderRadius: 9, background: 'linear-gradient(135deg,#6366f1,#4f46e5)', color: 'white', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700, boxShadow: '0 2px 8px rgba(99,102,241,0.35)' }}>
          <Plus style={{ width: 14, height: 14 }}/> New Quiz
        </button>
      </div>

      {quizzes.length === 0 && (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)', fontSize: 13 }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🎓</div>
          <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--text)', marginBottom: 6 }}>No quizzes yet</div>
          <div style={{ marginBottom: 16 }}>Click "New Quiz" to build your first quiz with questions, timers, and grading.</div>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {quizzes.map(quiz => {
          const dc = DIFF_COLORS_Q[quiz.difficulty] || DIFF_COLORS_Q.beginner
          const sc = STATUS_COLORS[quiz.status] || STATUS_COLORS.draft
          return (
            <div key={quiz.id} style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 14, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                  <span style={{ fontWeight: 800, fontSize: 15, color: 'var(--text)' }}>{quiz.title}</span>
                  <span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 700, ...sc }}>{quiz.status}</span>
                  <span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 600, ...dc }}>{quiz.difficulty}</span>
                  {quiz.negative_marking > 0 && <span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: 'rgba(239,68,68,0.1)', color: '#ef4444' }}>-{quiz.negative_marking} neg</span>}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                  <span>📋 {quiz.question_count || 0} questions</span>
                  <span>👥 {quiz.attempt_count || 0} attempts</span>
                  <span>✅ Pass: {quiz.pass_score || 70}%</span>
                  {quiz.time_per_question > 0 && <span>⏱ {quiz.time_per_question}s/q</span>}
                  {quiz.time_limit > 0 && <span>⏱ {quiz.time_limit}min total</span>}
                  {quiz.avg_score != null && <span>📊 Avg: {Math.round(quiz.avg_score)}%</span>}
                  <span style={{ color: 'var(--text-light)' }}>{quiz.category?.replace(/_/g,' ')}</span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, flexShrink: 0, alignItems: 'center' }}>
                <button onClick={() => toggleStatus(quiz)}
                  style={{ padding: '6px 12px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, background: quiz.status === 'published' ? 'rgba(16,185,129,0.12)' : 'rgba(99,102,241,0.12)', color: quiz.status === 'published' ? '#10b981' : '#818cf8' }}>
                  {quiz.status === 'published' ? '✅ Published' : '📤 Publish'}
                </button>
                <button onClick={() => setBuilderQuiz(quiz)}
                  style={{ padding: '7px 14px', borderRadius: 8, background: 'rgba(99,102,241,0.1)', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, color: '#818cf8', display: 'flex', alignItems: 'center', gap: 5 }}>
                  <Edit2 style={{ width: 12, height: 12 }}/> Edit & Questions
                </button>
                <button onClick={() => del(quiz.id)}
                  style={{ padding: '7px', borderRadius: 8, background: 'rgba(239,68,68,0.08)', border: 'none', cursor: 'pointer', color: '#ef4444' }}>
                  <Trash2 style={{ width: 13, height: 13 }}/>
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ── DATABASE PANEL — Sites + Observations ── */
function DatabasePanel() {
  const [subtab, setSubtab] = useState('sites')
  const [sites, setSites] = useState([])
  const [obs, setObs] = useState([])
  const [obsTotal, setObsTotal] = useState(0)
  const [obsOffset, setObsOffset] = useState(0)
  const [siteFilter, setSiteFilter] = useState('')
  const [obsFilter, setObsFilter] = useState('')
  const [loading, setLoading] = useState(false)
  const LIMIT = 25

  useEffect(() => { loadSites() }, [])
  useEffect(() => { if (subtab === 'observations') loadObs(0) }, [subtab])

  const loadSites = async () => {
    setLoading(true)
    const r = await api.get('/sites').catch(() => null)
    setSites(Array.isArray(r?.data) ? r.data : (r?.data?.sites || []))
    setLoading(false)
  }

  const loadObs = async (offset = 0) => {
    setLoading(true)
    const r = await api.get(`/sites/all-observations?limit=${LIMIT}&offset=${offset}`).catch(() => null)
    setObs(r?.data?.observations || [])
    setObsTotal(r?.data?.total || 0)
    setObsOffset(offset)
    setLoading(false)
  }

  const deleteSite = async (id) => {
    if (!confirm('Delete this site AND all its observations? This cannot be undone.')) return
    await api.delete(`/sites/${id}`).catch(() => {})
    setSites(prev => prev.filter(s => s.id !== id))
    if (subtab === 'observations') loadObs(obsOffset)
  }

  const deleteObs = async (id) => {
    if (!confirm('Delete this observation?')) return
    await api.delete(`/sites/observations/${id}`).catch(() => {})
    setObs(prev => prev.filter(o => o.id !== id))
    setObsTotal(t => t - 1)
  }

  const filteredSites = sites.filter(s =>
    !siteFilter || s.name?.toLowerCase().includes(siteFilter.toLowerCase()) || s.body_of_water?.toLowerCase().includes(siteFilter.toLowerCase()) || s.community?.toLowerCase().includes(siteFilter.toLowerCase())
  )

  const filteredObs = obs.filter(o =>
    !obsFilter || o.site_name?.toLowerCase().includes(obsFilter.toLowerCase()) || o.observer_name?.toLowerCase().includes(obsFilter.toLowerCase())
  )

  const thS = { padding: '10px 14px', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textAlign: 'left', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }
  const tdS = { padding: '10px 14px', fontSize: 12, color: 'var(--text)', borderBottom: '1px solid var(--border)', verticalAlign: 'middle' }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Sub-tabs */}
      <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--border)', paddingBottom: 0 }}>
        {[['sites', `🗺 Sites (${sites.length})`], ['observations', `🔬 Observations (${obsTotal})`]].map(([k, label]) => (
          <button key={k} onClick={() => setSubtab(k)}
            style={{ padding: '8px 16px', borderRadius: '8px 8px 0 0', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: k === subtab ? 700 : 500, background: k === subtab ? 'rgba(99,102,241,0.12)' : 'transparent', color: k === subtab ? '#818cf8' : 'var(--text-muted)', borderBottom: k === subtab ? '2px solid #6366f1' : '2px solid transparent' }}>
            {label}
          </button>
        ))}
        <div style={{ flex: 1 }}/>
        <button onClick={() => subtab === 'sites' ? loadSites() : loadObs(obsOffset)}
          style={{ padding: '7px 14px', borderRadius: 8, background: 'var(--border)', border: 'none', cursor: 'pointer', fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 5, marginBottom: 2 }}>
          <RefreshCw style={{ width: 12, height: 12 }}/> Refresh
        </button>
      </div>

      {/* Sites table */}
      {subtab === 'sites' && (
        <>
          <input value={siteFilter} onChange={e => setSiteFilter(e.target.value)} placeholder="Search sites by name, water body, community..."
            style={{ padding: '9px 14px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--card-bg)', color: 'var(--text)', fontSize: 13, outline: 'none' }}/>
          <div style={{ overflowX: 'auto', borderRadius: 12, border: '1px solid var(--border)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', background: 'var(--card-bg)' }}>
              <thead>
                <tr style={{ background: 'rgba(99,102,241,0.05)' }}>
                  <th style={thS}>ID</th>
                  <th style={thS}>Name</th>
                  <th style={thS}>Water Body</th>
                  <th style={thS}>Type</th>
                  <th style={thS}>Community</th>
                  <th style={thS}>Org</th>
                  <th style={thS}>Coords</th>
                  <th style={thS}>Created</th>
                  <th style={thS}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={9} style={{ ...tdS, textAlign: 'center', color: 'var(--text-muted)' }}>Loading…</td></tr>
                ) : filteredSites.length === 0 ? (
                  <tr><td colSpan={9} style={{ ...tdS, textAlign: 'center', color: 'var(--text-muted)' }}>No sites found</td></tr>
                ) : filteredSites.map(s => (
                  <tr key={s.id} style={{ transition: 'background 0.1s' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(99,102,241,0.03)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    <td style={{ ...tdS, color: 'var(--text-muted)', fontFamily: 'monospace' }}>#{s.id}</td>
                    <td style={{ ...tdS, fontWeight: 600 }}>{s.name}</td>
                    <td style={tdS}>{s.body_of_water || '—'}</td>
                    <td style={tdS}><span style={{ fontSize: 11, padding: '2px 7px', borderRadius: 20, background: 'rgba(20,184,166,0.1)', color: '#14b8a6' }}>{s.water_body_type || '—'}</span></td>
                    <td style={tdS}>{s.community || '—'}</td>
                    <td style={tdS}>{s.organization || '—'}</td>
                    <td style={{ ...tdS, fontFamily: 'monospace', fontSize: 11, color: 'var(--text-muted)' }}>{s.latitude?.toFixed(4)}, {s.longitude?.toFixed(4)}</td>
                    <td style={{ ...tdS, fontSize: 11, color: 'var(--text-muted)' }}>{s.created_at?.slice(0,10) || '—'}</td>
                    <td style={tdS}>
                      <button onClick={() => deleteSite(s.id)}
                        style={{ padding: '5px 10px', borderRadius: 7, background: 'rgba(239,68,68,0.1)', border: 'none', cursor: 'pointer', color: '#ef4444', fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Trash2 style={{ width: 11, height: 11 }}/> Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Observations table */}
      {subtab === 'observations' && (
        <>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <input value={obsFilter} onChange={e => setObsFilter(e.target.value)} placeholder="Filter by site name or observer..."
              style={{ flex: 1, padding: '9px 14px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--card-bg)', color: 'var(--text)', fontSize: 13, outline: 'none' }}/>
            <span style={{ fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{obsTotal} total</span>
          </div>
          <div style={{ overflowX: 'auto', borderRadius: 12, border: '1px solid var(--border)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', background: 'var(--card-bg)' }}>
              <thead>
                <tr style={{ background: 'rgba(20,184,166,0.05)' }}>
                  <th style={thS}>ID</th>
                  <th style={thS}>Site</th>
                  <th style={thS}>Observer</th>
                  <th style={thS}>Date</th>
                  <th style={thS}>pH</th>
                  <th style={thS}>Temp (°C)</th>
                  <th style={thS}>DO (mg/L)</th>
                  <th style={thS}>Turbidity</th>
                  <th style={thS}>Conduct.</th>
                  <th style={thS}>Notes</th>
                  <th style={thS}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={11} style={{ ...tdS, textAlign: 'center' }}>Loading…</td></tr>
                ) : filteredObs.length === 0 ? (
                  <tr><td colSpan={11} style={{ ...tdS, textAlign: 'center', color: 'var(--text-muted)' }}>No observations</td></tr>
                ) : filteredObs.map(o => (
                  <tr key={o.id}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(20,184,166,0.03)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    <td style={{ ...tdS, fontFamily: 'monospace', color: 'var(--text-muted)' }}>#{o.id}</td>
                    <td style={{ ...tdS, fontWeight: 600, color: '#14b8a6' }}>{o.site_name || `Site #${o.site_id}`}</td>
                    <td style={tdS}>{o.observer_name || o.username || '—'}</td>
                    <td style={{ ...tdS, fontSize: 11, color: 'var(--text-muted)' }}>{o.observed_at?.slice(0,16) || '—'}</td>
                    <td style={{ ...tdS, fontFamily: 'monospace' }}>{o.ph ?? '—'}</td>
                    <td style={{ ...tdS, fontFamily: 'monospace' }}>{o.water_temp ?? '—'}</td>
                    <td style={{ ...tdS, fontFamily: 'monospace' }}>{o.dissolved_oxygen ?? '—'}</td>
                    <td style={{ ...tdS, fontFamily: 'monospace' }}>{o.turbidity ?? '—'}</td>
                    <td style={{ ...tdS, fontFamily: 'monospace' }}>{o.conductivity ?? '—'}</td>
                    <td style={{ ...tdS, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 11 }}>{o.notes || '—'}</td>
                    <td style={tdS}>
                      <button onClick={() => deleteObs(o.id)}
                        style={{ padding: '5px 10px', borderRadius: 7, background: 'rgba(239,68,68,0.1)', border: 'none', cursor: 'pointer', color: '#ef4444', fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Trash2 style={{ width: 11, height: 11 }}/> Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* Pagination */}
          {obsTotal > LIMIT && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: 8 }}>
              <button disabled={obsOffset === 0} onClick={() => loadObs(obsOffset - LIMIT)}
                style={{ padding: '7px 16px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--card-bg)', color: 'var(--text-muted)', cursor: obsOffset === 0 ? 'not-allowed' : 'pointer', opacity: obsOffset === 0 ? 0.4 : 1, fontSize: 12 }}>← Prev</button>
              <span style={{ padding: '7px 12px', fontSize: 12, color: 'var(--text-muted)' }}>{obsOffset + 1}–{Math.min(obsOffset + LIMIT, obsTotal)} of {obsTotal}</span>
              <button disabled={obsOffset + LIMIT >= obsTotal} onClick={() => loadObs(obsOffset + LIMIT)}
                style={{ padding: '7px 16px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--card-bg)', color: 'var(--text-muted)', cursor: obsOffset + LIMIT >= obsTotal ? 'not-allowed' : 'pointer', opacity: obsOffset + LIMIT >= obsTotal ? 0.4 : 1, fontSize: 12 }}>Next →</button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

/* ── MAIN ── */
const TABS = [
  { key: 'overview',    label: 'Overview',    icon: BarChart2 },
  { key: 'users',       label: 'Users',       icon: Users },
  { key: 'posts',       label: 'Posts',       icon: MessageSquare },
  { key: 'quizzes',     label: 'Quizzes',     icon: GraduationCap },
  { key: 'database',    label: 'Database',    icon: Database },
  { key: 'alerts',      label: 'Alerts',      icon: AlertTriangle },
  { key: 'content',     label: 'CMS Content', icon: FileText },
  { key: 'activity',    label: 'Activity Log', icon: Activity },
]

export default function AdminPage() {
  const { user, isAdmin } = useAuth()
  const [tab, setTab] = useState('overview')

  if (!isAdmin) {
    return (
      <div style={{ position: 'relative', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <PageAmbience variant="admin"/>
        <div style={{ textAlign: 'center', zIndex: 1, position: 'relative' }}>
          <ShieldCheck style={{ width: 48, height: 48, color: '#6366f1', margin: '0 auto 16px' }}/>
          <div style={{ fontSize: 20, fontWeight: 900, color: 'var(--text)', marginBottom: 8 }}>Admin Access Required</div>
          <div style={{ fontSize: 14, color: 'var(--text-muted)' }}>You must be an admin to access this page.</div>
        </div>
      </div>
    )
  }

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
        {tab === 'overview'  && <OverviewPanel/>}
        {tab === 'users'     && <UsersPanel/>}
        {tab === 'posts'     && <PostsPanel/>}
        {tab === 'quizzes'   && <QuizPanel/>}
        {tab === 'database'  && <DatabasePanel/>}
        {tab === 'alerts'    && <AlertsAdminPanel/>}
        {tab === 'content'   && <ContentPanel/>}
        {tab === 'activity'  && <ActivityPanel/>}
      </div>

      <style>{`
        @keyframes ping {
          75%, 100% { transform: scale(2); opacity: 0; }
        }
      `}</style>
    </div>
  )
}
