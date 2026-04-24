import PageAmbience from '../components/layout/PageAmbience'
import { useState, useEffect, useMemo } from 'react'
import api from '../utils/api'
import {
  AlertTriangle, Info, CheckCircle, Bell, BellOff,
  MapPin, Clock, RefreshCw, ChevronDown,
  Activity, Plus, Trash2, Power, PowerOff,
} from 'lucide-react'

/* ── Pulse ring animation ── */
function PulseRing({ color, size = 10 }) {
  return (
    <span style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
      <span style={{ width: size, height: size, borderRadius: '50%', background: color, display: 'block', position: 'relative', zIndex: 1 }}/>
      <span style={{ position: 'absolute', width: size, height: size, borderRadius: '50%', background: color, opacity: 0.4, animation: 'alertPing 1.8s cubic-bezier(0,0,0.2,1) infinite' }}/>
    </span>
  )
}

const SEV_CONFIG = {
  high:   { color: '#ef4444', bg: 'rgba(239,68,68,0.06)',  border: 'rgba(239,68,68,0.2)',  badge: 'rgba(239,68,68,0.12)',  badgeText: '#ef4444', icon: AlertTriangle, label: 'Critical' },
  medium: { color: '#f59e0b', bg: 'rgba(245,158,11,0.06)', border: 'rgba(245,158,11,0.2)', badge: 'rgba(245,158,11,0.12)', badgeText: '#f59e0b', icon: AlertTriangle, label: 'Warning' },
  low:    { color: '#10b981', bg: 'rgba(16,185,129,0.06)', border: 'rgba(16,185,129,0.2)', badge: 'rgba(16,185,129,0.12)', badgeText: '#10b981', icon: Info,          label: 'Advisory' },
  info:   { color: '#0ea5e9', bg: 'rgba(14,165,233,0.06)', border: 'rgba(14,165,233,0.2)', badge: 'rgba(14,165,233,0.12)', badgeText: '#0ea5e9', icon: Info,          label: 'Info' },
}

function timeAgo(d) {
  if (!d) return ''
  const diff = Date.now() - new Date(d)
  if (diff < 60000)   return 'just now'
  if (diff < 3600000) return Math.floor(diff / 60000)   + 'min ago'
  if (diff < 86400000)return Math.floor(diff / 3600000) + 'h ago'
  return Math.floor(diff / 86400000) + 'd ago'
}

/* ── Real Alert Card (from DB) ── */
function AlertCard({ alert, onExpand, expanded }) {
  const cfg = SEV_CONFIG[alert.severity] || SEV_CONFIG.info
  const Icon = cfg.icon
  const isActive = alert.active === 1 || alert.active === true

  return (
    <div style={{
      background: 'var(--card-bg)', borderRadius: 14,
      border: `1px solid ${expanded ? cfg.color + '60' : cfg.border}`,
      overflow: 'hidden', transition: 'all 0.2s',
      boxShadow: expanded ? `0 0 24px ${cfg.color}18` : 'none',
    }}>
      <div style={{ height: 3, background: `linear-gradient(90deg, ${cfg.color}, ${cfg.color}60)` }}/>

      <div style={{ padding: '16px 18px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <div style={{ width: 38, height: 38, borderRadius: 10, background: cfg.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, position: 'relative' }}>
            <Icon style={{ width: 17, height: 17, color: cfg.color }}/>
            {isActive && (
              <span style={{ position: 'absolute', top: -3, right: -3 }}>
                <PulseRing color={cfg.color} size={7}/>
              </span>
            )}
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
              <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)', lineHeight: 1.3 }}>
                {alert.message || `${alert.parameter || 'Parameter'} alert`}
              </div>
              <button onClick={() => onExpand(alert.id)}
                style={{ flexShrink: 0, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4, borderRadius: 6 }}>
                <ChevronDown style={{ width: 15, height: 15, transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}/>
              </button>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 7 }}>
              <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: cfg.badge, color: cfg.badgeText }}>
                {cfg.label}
              </span>
              {isActive
                ? <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4, background: 'rgba(16,185,129,0.1)', color: '#10b981' }}>
                    <PulseRing color="#10b981" size={6}/> Active
                  </span>
                : <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: 'rgba(100,116,139,0.1)', color: '#64748b' }}>Resolved</span>
              }
              <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, color: 'var(--text-muted)', background: 'var(--border)', display: 'flex', alignItems: 'center', gap: 4 }}>
                <Clock style={{ width: 10, height: 10 }}/> {timeAgo(alert.created_at)}
              </span>
            </div>

            <div style={{ display: 'flex', gap: 12, marginTop: 8, fontSize: 12, color: 'var(--text-muted)' }}>
              {alert.site_name && <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><MapPin style={{ width: 11, height: 11 }}/>{alert.site_name}</span>}
              {alert.parameter && <span>· {alert.parameter}</span>}
            </div>
          </div>
        </div>

        {(alert.current_value != null || alert.threshold_value != null) && (
          <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
            {alert.current_value != null && (
              <div style={{ padding: '5px 12px', borderRadius: 8, background: cfg.bg, border: `1px solid ${cfg.border}`, fontSize: 12 }}>
                <span style={{ color: 'var(--text-muted)', textTransform: 'uppercase', fontSize: 10, fontWeight: 700, letterSpacing: '0.06em' }}>Current</span>
                <span style={{ marginLeft: 6, fontWeight: 700, color: cfg.color }}>{alert.current_value}</span>
              </div>
            )}
            {alert.threshold_value != null && (
              <div style={{ padding: '5px 12px', borderRadius: 8, background: 'var(--border)', fontSize: 12 }}>
                <span style={{ color: 'var(--text-muted)', textTransform: 'uppercase', fontSize: 10, fontWeight: 700, letterSpacing: '0.06em' }}>Threshold</span>
                <span style={{ marginLeft: 6, fontWeight: 700, color: 'var(--text)' }}>{alert.threshold_value}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

/* ── Stats Bar (real numbers) ── */
function StatsBar({ alerts, watchCount }) {
  const active = alerts.filter(a => a.active === 1 || a.active === true)
  const high   = active.filter(a => a.severity === 'high').length
  const medium = active.filter(a => a.severity === 'medium').length
  const low    = active.filter(a => a.severity === 'low').length

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 12, marginBottom: 20 }}>
      {[
        { label: 'Active Alerts', value: active.length, color: '#ef4444', icon: Bell, pulse: active.length > 0 },
        { label: 'Critical',      value: high,           color: '#ef4444', icon: AlertTriangle },
        { label: 'Warnings',      value: medium,         color: '#f59e0b', icon: AlertTriangle },
        { label: 'Advisories',    value: low,            color: '#10b981', icon: Info },
        { label: 'My Watches',    value: watchCount,     color: '#6366f1', icon: Activity },
      ].map(s => (
        <div key={s.label} style={{
          background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 12,
          padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12,
          position: 'relative', overflow: 'hidden',
        }}>
          <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(circle at 100% 0%, ${s.color}08, transparent 60%)`, pointerEvents: 'none' }}/>
          <div style={{ width: 36, height: 36, borderRadius: 9, background: `${s.color}12`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, position: 'relative' }}>
            <s.icon style={{ width: 16, height: 16, color: s.color }}/>
            {s.pulse && s.value > 0 && <span style={{ position: 'absolute', top: -2, right: -2 }}><PulseRing color={s.color} size={7}/></span>}
          </div>
          <div>
            <div style={{ fontSize: 22, fontWeight: 900, color: s.value > 0 ? s.color : 'var(--text-muted)', lineHeight: 1 }}>{s.value}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>{s.label}</div>
          </div>
        </div>
      ))}
    </div>
  )
}

/* ── My Watches Panel ── */
function WatchesPanel({ watches, sites, options, onCreate, onDelete, onToggle, onCheck, checking }) {
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({ site_id: '', parameter: '', comparator: '>', threshold: '', severity: 'medium' })
  const [busy, setBusy] = useState(false)

  const reset = () => { setForm({ site_id: '', parameter: '', comparator: '>', threshold: '', severity: 'medium' }); setAdding(false) }

  const submit = async () => {
    if (!form.site_id || !form.parameter || form.threshold === '') return
    setBusy(true)
    const ok = await onCreate({ ...form, threshold: parseFloat(form.threshold), site_id: parseInt(form.site_id) })
    setBusy(false)
    if (ok) reset()
  }

  return (
    <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 14, padding: '16px 18px', marginBottom: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, gap: 8, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontWeight: 800, fontSize: 14, color: 'var(--text)' }}>My Watches</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
            Custom thresholds you set on real monitoring sites. The checker reads the latest observation and fires an alert when your condition is met.
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onCheck} disabled={checking || watches.length === 0}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 9, fontSize: 12, fontWeight: 600, cursor: watches.length ? 'pointer' : 'not-allowed', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-muted)', opacity: watches.length ? 1 : 0.5 }}>
            <RefreshCw style={{ width: 13, height: 13, animation: checking ? 'spin 1s linear infinite' : 'none' }}/>
            Check now
          </button>
          <button onClick={() => setAdding(a => !a)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 9, fontSize: 12, fontWeight: 700, cursor: 'pointer', border: 'none', background: '#6366f1', color: '#fff' }}>
            <Plus style={{ width: 13, height: 13 }}/>
            {adding ? 'Cancel' : 'Add watch'}
          </button>
        </div>
      </div>

      {adding && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8, padding: 12, marginBottom: 12, background: 'rgba(99,102,241,0.04)', border: '1px solid rgba(99,102,241,0.15)', borderRadius: 10 }}>
          <select value={form.site_id} onChange={e => setForm(f => ({ ...f, site_id: e.target.value }))}
            style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--card-bg)', color: 'var(--text)', fontSize: 13 }}>
            <option value="">Site…</option>
            {sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <select value={form.parameter} onChange={e => setForm(f => ({ ...f, parameter: e.target.value }))}
            style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--card-bg)', color: 'var(--text)', fontSize: 13 }}>
            <option value="">Parameter…</option>
            {options.parameters?.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
          <select value={form.comparator} onChange={e => setForm(f => ({ ...f, comparator: e.target.value }))}
            style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--card-bg)', color: 'var(--text)', fontSize: 13 }}>
            {(options.comparators || ['>','<','>=','<=']).map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <input type="number" step="any" placeholder="Threshold (e.g. 6.5)" value={form.threshold}
            onChange={e => setForm(f => ({ ...f, threshold: e.target.value }))}
            style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--card-bg)', color: 'var(--text)', fontSize: 13 }}/>
          <select value={form.severity} onChange={e => setForm(f => ({ ...f, severity: e.target.value }))}
            style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--card-bg)', color: 'var(--text)', fontSize: 13 }}>
            <option value="low">Advisory</option>
            <option value="medium">Warning</option>
            <option value="high">Critical</option>
          </select>
          <button onClick={submit} disabled={busy || !form.site_id || !form.parameter || form.threshold === ''}
            style={{ padding: '8px 10px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700, background: '#10b981', color: '#fff', opacity: (busy || !form.site_id || !form.parameter || form.threshold === '') ? 0.5 : 1 }}>
            {busy ? 'Saving…' : 'Save'}
          </button>
        </div>
      )}

      {watches.length === 0 ? (
        <div style={{ padding: '16px 12px', textAlign: 'center', fontSize: 12, color: 'var(--text-muted)' }}>
          No watches yet. Add one to be notified when a parameter at a site you care about crosses your threshold.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {watches.map(w => {
            const sevCfg = SEV_CONFIG[w.severity] || SEV_CONFIG.info
            return (
              <div key={w.id} style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
                borderRadius: 10, border: `1px solid ${w.triggered ? sevCfg.border : 'var(--border)'}`,
                background: w.triggered ? sevCfg.bg : 'transparent',
              }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: sevCfg.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, position: 'relative' }}>
                  <Activity style={{ width: 14, height: 14, color: sevCfg.color }}/>
                  {w.triggered && <span style={{ position: 'absolute', top: -2, right: -2 }}><PulseRing color={sevCfg.color} size={6}/></span>}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <span>{w.parameter_label || w.parameter}</span>
                    <span style={{ color: sevCfg.color }}>{w.comparator} {w.threshold}</span>
                    <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>at {w.site_name}</span>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                    {w.has_data
                      ? <>Latest: <strong style={{ color: w.triggered ? sevCfg.color : 'var(--text)' }}>{w.current_value}</strong> · {timeAgo(w.observed_at)}</>
                      : <em>No observations recorded yet</em>}
                    {w.last_checked_at && <> · checked {timeAgo(w.last_checked_at)}</>}
                  </div>
                </div>
                <button onClick={() => onToggle(w)} title={w.active ? 'Pause' : 'Activate'}
                  style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 6, borderRadius: 6, color: w.active ? '#10b981' : 'var(--text-muted)' }}>
                  {w.active ? <Power style={{ width: 14, height: 14 }}/> : <PowerOff style={{ width: 14, height: 14 }}/>}
                </button>
                <button onClick={() => onDelete(w.id)} title="Delete"
                  style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 6, borderRadius: 6, color: '#ef4444' }}>
                  <Trash2 style={{ width: 14, height: 14 }}/>
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default function Alerts() {
  const [alerts, setAlerts]       = useState([])
  const [watches, setWatches]     = useState([])
  const [sites, setSites]         = useState([])
  const [options, setOptions]     = useState({ parameters: [], comparators: ['>','<','>=','<='], severities: ['low','medium','high'] })
  const [filter, setFilter]       = useState('all')
  const [expandedId, setExpandedId] = useState(null)
  const [notifEnabled, setNotifEnabled] = useState(true)
  const [loading, setLoading]     = useState(false)
  const [checking, setChecking]   = useState(false)
  const [toast, setToast]         = useState(null)

  const loadAlerts = async () => {
    try {
      const r = await api.get('/admin/alerts')
      setAlerts(Array.isArray(r.data?.alerts) ? r.data.alerts : [])
    } catch { setAlerts([]) }
  }
  const loadWatches = async () => {
    try {
      const r = await api.get('/alert-watches')
      setWatches(Array.isArray(r.data?.watches) ? r.data.watches : [])
    } catch { setWatches([]) }
  }
  const loadSites = async () => {
    try {
      const r = await api.get('/sites')
      setSites(Array.isArray(r.data) ? r.data : [])
    } catch { setSites([]) }
  }
  const loadOptions = async () => {
    try {
      const r = await api.get('/alert-watches/options')
      if (r.data) setOptions(r.data)
    } catch {}
  }

  useEffect(() => {
    loadAlerts(); loadWatches(); loadSites(); loadOptions()
    // Refresh alerts + watch readings every 30s
    const t = setInterval(() => { loadAlerts(); loadWatches() }, 30000)
    return () => clearInterval(t)
  }, [])

  const refreshAll = async () => {
    setLoading(true)
    await Promise.all([loadAlerts(), loadWatches()])
    setLoading(false)
  }

  const createWatch = async (payload) => {
    try {
      await api.post('/alert-watches', payload)
      await loadWatches()
      return true
    } catch (err) {
      setToast({ type: 'error', text: err.response?.data?.error || 'Failed to create watch' })
      setTimeout(() => setToast(null), 3000)
      return false
    }
  }
  const deleteWatch = async (id) => {
    if (!confirm('Delete this watch?')) return
    await api.delete(`/alert-watches/${id}`).catch(() => {})
    loadWatches()
  }
  const toggleWatch = async (w) => {
    await api.put(`/alert-watches/${w.id}`, { active: !w.active }).catch(() => {})
    loadWatches()
  }
  const checkNow = async () => {
    setChecking(true)
    try {
      const r = await api.post('/alert-watches/check')
      const fired = (r.data?.results || []).filter(x => x.alert_created).length
      setToast({
        type: fired > 0 ? 'fire' : 'ok',
        text: fired > 0 ? `${fired} new alert${fired === 1 ? '' : 's'} created` : 'All watches checked — none triggered'
      })
      setTimeout(() => setToast(null), 3500)
      await Promise.all([loadAlerts(), loadWatches()])
    } catch (err) {
      setToast({ type: 'error', text: err.response?.data?.error || 'Check failed' })
      setTimeout(() => setToast(null), 3000)
    }
    setChecking(false)
  }

  const toggleExpand = (id) => setExpandedId(prev => prev === id ? null : id)

  const filtered = useMemo(() => alerts.filter(a => {
    const isActive = a.active === 1 || a.active === true
    if (filter === 'all')      return true
    if (filter === 'active')   return isActive
    if (filter === 'resolved') return !isActive
    return a.severity === filter
  }), [alerts, filter])

  return (
    <div style={{ position: 'relative', minHeight: '100vh' }}>
      <PageAmbience variant="dashboard"/>

      <div style={{ maxWidth: 860, margin: '0 auto', padding: '0 4px', position: 'relative', zIndex: 1 }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 40, height: 40, borderRadius: 11, background: 'linear-gradient(135deg,#ef4444,#f97316)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 14px rgba(239,68,68,0.3)' }}>
                <Bell style={{ width: 18, height: 18, color: '#fff' }}/>
              </div>
              <div>
                <h1 style={{ fontSize: 20, fontWeight: 900, color: 'var(--text)', margin: 0 }}>Water Quality Alerts</h1>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Real alerts derived from your monitoring sites — no demo data</div>
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button onClick={() => setNotifEnabled(n => !n)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: 'pointer', border: 'none', background: notifEnabled ? 'rgba(99,102,241,0.1)' : 'var(--border)', color: notifEnabled ? '#818cf8' : 'var(--text-muted)' }}>
              {notifEnabled ? <Bell style={{ width: 14, height: 14 }}/> : <BellOff style={{ width: 14, height: 14 }}/>}
              {notifEnabled ? 'Notifications On' : 'Muted'}
            </button>
            <button onClick={refreshAll}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: 'pointer', border: 'none', background: 'var(--border)', color: 'var(--text-muted)' }}>
              <RefreshCw style={{ width: 13, height: 13, animation: loading ? 'spin 1s linear infinite' : 'none' }}/>
            </button>
          </div>
        </div>

        <StatsBar alerts={alerts} watchCount={watches.length}/>

        <WatchesPanel
          watches={watches}
          sites={sites}
          options={options}
          onCreate={createWatch}
          onDelete={deleteWatch}
          onToggle={toggleWatch}
          onCheck={checkNow}
          checking={checking}
        />

        {/* Filters */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
          {[
            { v: 'all',      label: 'All' },
            { v: 'active',   label: 'Active' },
            { v: 'high',     label: 'Critical' },
            { v: 'medium',   label: 'Warnings' },
            { v: 'low',      label: 'Advisories' },
            { v: 'resolved', label: 'Resolved' },
          ].map(f => (
            <button key={f.v} onClick={() => setFilter(f.v)}
              style={{
                padding: '6px 14px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600,
                background: filter === f.v ? 'rgba(99,102,241,0.15)' : 'var(--border)',
                color: filter === f.v ? '#818cf8' : 'var(--text-muted)',
              }}>
              {f.label}
            </button>
          ))}
        </div>

        {/* Alert list */}
        {filtered.length === 0 ? (
          <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 14, padding: '48px 24px', textAlign: 'center' }}>
            <CheckCircle style={{ width: 44, height: 44, color: '#10b981', margin: '0 auto 12px' }}/>
            <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--text)', marginBottom: 4 }}>All Clear</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
              {alerts.length === 0
                ? 'No alerts have been raised yet. Add a watch above to be notified when a parameter crosses your threshold.'
                : 'No alerts match this filter.'}
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {filtered.map(a => (
              <AlertCard key={a.id} alert={a} expanded={expandedId === a.id} onExpand={toggleExpand}/>
            ))}
          </div>
        )}

        {/* Info panel */}
        <div style={{ marginTop: 24, background: 'linear-gradient(135deg, rgba(14,165,233,0.06), rgba(99,102,241,0.04))', border: '1px solid rgba(14,165,233,0.15)', borderRadius: 14, padding: '16px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <Activity style={{ width: 15, height: 15, color: '#0ea5e9' }}/>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>How alerts work</span>
          </div>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6, margin: 0 }}>
            Each watch you add reads the latest observation for that site and parameter. When the value crosses your threshold,
            a real alert row is created and shown above. Sites and observations come from this platform's database, including
            data imported from Water Rangers and Algoma District monitoring partners. Nothing here is mocked.
          </p>
        </div>
      </div>

      {toast && (
        <div style={{
          position: 'fixed', bottom: 24, right: 24, zIndex: 50,
          padding: '12px 18px', borderRadius: 10, fontSize: 13, fontWeight: 600,
          background: toast.type === 'error' ? '#ef4444' : toast.type === 'fire' ? '#f59e0b' : '#10b981',
          color: '#fff', boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
        }}>
          {toast.text}
        </div>
      )}

      <style>{`
        @keyframes alertPing {
          75%, 100% { transform: scale(2.5); opacity: 0; }
        }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}
