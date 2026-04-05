import PageAmbience from '../components/layout/PageAmbience'
import { useState, useEffect } from 'react'
import api from '../utils/api'
import {
  AlertTriangle, Info, CheckCircle, Bell, BellOff,
  MapPin, Clock, RefreshCw, ChevronDown,
  Eye, Share2, Activity,
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

const PRESET_ALERTS = [
  {
    id: 1, title: 'Boil Water Advisory — Whitefish Lake Station',
    message: 'Turbidity readings exceeded WHO guideline of 5 NTU at three consecutive sampling points (readings: 8.2, 9.1, 7.8 NTU). E. coli presence confirmed in preliminary screening. Boil all water before consumption. Do not use for infant formula preparation.',
    severity: 'high', type: 'boil-water', is_active: true,
    site_name: 'Whitefish Lake Station', site_id: 'WLS-01',
    region: 'Algoma District', population_affected: '~2,400 residents',
    issued_by: 'Dr. Sarah Chen', agency: 'NORDIK Institute',
    created_at: new Date(Date.now() - 2 * 3600000).toISOString(),
    parameters: { turbidity: 8.2, ecoli: 'detected', ph: 6.8 },
    updates: [
      { time: '2 hrs ago', text: 'Initial boil water advisory issued. Field team dispatched.' },
      { time: '1 hr ago', text: 'Secondary testing samples collected. Results pending 4–6 hours.' },
    ]
  },
  {
    id: 2, title: 'pH Anomaly — Garden River Site B',
    message: 'pH dropped to 5.2 — significantly below baseline of 7.1 and below safe drinking water standard. Suspected cause: agricultural runoff following last week\'s precipitation event. Downstream monitoring stations have been alerted.',
    severity: 'high', type: 'warning', is_active: true,
    site_name: 'Garden River Site B', site_id: 'GRB-02',
    region: 'Garden River First Nation',
    issued_by: 'Amara Diallo', agency: 'Community Monitoring Network',
    created_at: new Date(Date.now() - 6 * 3600000).toISOString(),
    parameters: { ph: 5.2, conductivity: 680, turbidity: 3.1 },
    updates: [
      { time: '6 hrs ago', text: 'pH anomaly detected. Upstream agricultural sites identified as probable source.' },
    ]
  },
  {
    id: 3, title: 'Elevated Phosphorus — Echo Bay',
    message: 'Phosphorus concentration measured at 0.052 mg/L, nearly double the 0.03 mg/L threshold. Elevated risk of algal bloom within 3–5 days if warm conditions persist. Visual monitoring recommended for shoreline users.',
    severity: 'medium', type: 'advisory', is_active: true,
    site_name: 'Echo Bay Monitor', site_id: 'EBM-04',
    region: 'North Channel',
    issued_by: 'Marcus Osei', agency: 'Student Research Team',
    created_at: new Date(Date.now() - 12 * 3600000).toISOString(),
    parameters: { phosphorus: 0.052, nitrogen: 0.8, temperature: 22.1 },
    updates: []
  },
  {
    id: 4, title: 'Seasonal Conductivity Rise — Thessalon River',
    message: 'Conductivity elevated to 820 µS/cm following recent precipitation. Pattern consistent with seasonal spring runoff. No immediate health risk identified but continued monitoring is recommended.',
    severity: 'low', type: 'advisory', is_active: true,
    site_name: 'Thessalon River Gauge', site_id: 'TRG-07',
    region: 'North Huron',
    issued_by: 'Linda Swanson', agency: 'Community Volunteers',
    created_at: new Date(Date.now() - 24 * 3600000).toISOString(),
    parameters: { conductivity: 820, ph: 7.2, turbidity: 1.8 },
    updates: []
  },
  {
    id: 5, title: 'Beach Closure — Gros Cap',
    message: 'E. coli colony counts: 240 CFU/100mL, exceeding the 200 CFU/100mL recreational water standard. Beach closed to all swimming. Signs posted. Resampling scheduled in 72 hours.',
    severity: 'high', type: 'beach-closure', is_active: false,
    site_name: 'Gros Cap Beach', site_id: 'GCB-03',
    region: 'Sault Ste. Marie',
    issued_by: 'City of Sault Ste. Marie', agency: 'Public Health',
    created_at: new Date(Date.now() - 72 * 3600000).toISOString(),
    parameters: { ecoli: 240, ph: 7.4, temperature: 18.5 },
    updates: [
      { time: '3 days ago', text: 'Beach closure implemented. Warning signage posted.' },
      { time: '2 days ago', text: 'Resampling in progress. Preliminary results expected tomorrow.' },
    ]
  },
  {
    id: 6, title: 'Dissolved Oxygen Low — Batchawana Bay',
    message: 'Dissolved oxygen dropped to 4.2 mg/L (threshold: 6.0 mg/L) at depth. Possible risk to aquatic life including fish habitat. No human health risk at this time.',
    severity: 'medium', type: 'environmental', is_active: true,
    site_name: 'Batchawana Bay Deep', site_id: 'BBD-09',
    region: 'Algoma Highlands',
    issued_by: 'Dr. Sarah Chen', agency: 'NORDIK Institute',
    created_at: new Date(Date.now() - 36 * 3600000).toISOString(),
    parameters: { dissolved_oxygen: 4.2, temperature: 8.1, depth: 12 },
    updates: []
  },
]

const SEV_CONFIG = {
  high: {
    color: '#ef4444', bg: 'rgba(239,68,68,0.06)', border: 'rgba(239,68,68,0.2)',
    badge: 'rgba(239,68,68,0.12)', badgeText: '#ef4444',
    icon: AlertTriangle, label: 'Critical',
  },
  medium: {
    color: '#f59e0b', bg: 'rgba(245,158,11,0.06)', border: 'rgba(245,158,11,0.2)',
    badge: 'rgba(245,158,11,0.12)', badgeText: '#f59e0b',
    icon: AlertTriangle, label: 'Warning',
  },
  low: {
    color: '#10b981', bg: 'rgba(16,185,129,0.06)', border: 'rgba(16,185,129,0.2)',
    badge: 'rgba(16,185,129,0.12)', badgeText: '#10b981',
    icon: Info, label: 'Advisory',
  },
  info: {
    color: '#0ea5e9', bg: 'rgba(14,165,233,0.06)', border: 'rgba(14,165,233,0.2)',
    badge: 'rgba(14,165,233,0.12)', badgeText: '#0ea5e9',
    icon: Info, label: 'Info',
  },
}

const TYPE_LABELS = {
  'boil-water': 'Boil Water', warning: 'Warning', advisory: 'Advisory',
  'beach-closure': 'Beach Closure', 'do-not-drink': 'Do Not Drink', environmental: 'Environmental',
}

function timeAgo(d) {
  const diff = Date.now() - new Date(d)
  if (diff < 60000) return 'just now'
  if (diff < 3600000) return Math.floor(diff / 60000) + 'min ago'
  if (diff < 86400000) return Math.floor(diff / 3600000) + 'h ago'
  return Math.floor(diff / 86400000) + 'd ago'
}

/* ── Alert Card ── */
function AlertCard({ alert, onExpand, expanded }) {
  const cfg = SEV_CONFIG[alert.severity] || SEV_CONFIG.info
  const Icon = cfg.icon
  const paramKeys = Object.keys(alert.parameters || {})

  return (
    <div style={{
      background: 'var(--card-bg)', borderRadius: 14,
      border: `1px solid ${expanded ? cfg.color + '60' : cfg.border}`,
      overflow: 'hidden', transition: 'all 0.2s',
      boxShadow: expanded ? `0 0 24px ${cfg.color}18` : 'none',
    }}>
      {/* Header bar */}
      <div style={{ height: 3, background: `linear-gradient(90deg, ${cfg.color}, ${cfg.color}60)` }}/>

      <div style={{ padding: '16px 18px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          {/* Icon */}
          <div style={{ width: 38, height: 38, borderRadius: 10, background: cfg.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, position: 'relative' }}>
            <Icon style={{ width: 17, height: 17, color: cfg.color }}/>
            {alert.is_active && (
              <span style={{ position: 'absolute', top: -3, right: -3 }}>
                <PulseRing color={cfg.color} size={7}/>
              </span>
            )}
          </div>

          {/* Title and meta */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
              <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)', lineHeight: 1.3 }}>{alert.title}</div>
              <button onClick={() => onExpand(alert.id)}
                style={{ flexShrink: 0, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4, borderRadius: 6, transition: 'all 0.15s' }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(99,102,241,0.08)'}
                onMouseLeave={e => e.currentTarget.style.background = 'none'}>
                <ChevronDown style={{ width: 15, height: 15, transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}/>
              </button>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 7 }}>
              <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: cfg.badge, color: cfg.badgeText }}>
                {cfg.label}
              </span>
              <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: 'rgba(99,102,241,0.08)', color: '#818cf8' }}>
                {TYPE_LABELS[alert.type] || alert.type}
              </span>
              {alert.is_active
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
              {alert.region && <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Globe2 style={{ width: 11, height: 11 }}/>{alert.region}</span>}
            </div>
          </div>
        </div>

        {/* Params row */}
        {paramKeys.length > 0 && (
          <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
            {paramKeys.map(k => (
              <div key={k} style={{ padding: '5px 12px', borderRadius: 8, background: cfg.bg, border: `1px solid ${cfg.border}`, fontSize: 12 }}>
                <span style={{ color: 'var(--text-muted)', textTransform: 'uppercase', fontSize: 10, fontWeight: 700, letterSpacing: '0.06em' }}>{k.replace(/_/g,' ')}</span>
                <span style={{ marginLeft: 6, fontWeight: 700, color: cfg.color }}>
                  {typeof alert.parameters[k] === 'number' ? alert.parameters[k] : alert.parameters[k]}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Expanded content */}
      {expanded && (
        <div style={{ padding: '0 18px 18px', borderTop: `1px solid ${cfg.border}`, paddingTop: 14 }}>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: 12 }}>{alert.message}</p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 8, marginBottom: 14 }}>
            {alert.population_affected && (
              <div style={{ background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.1)', borderRadius: 9, padding: '8px 12px', fontSize: 12 }}>
                <div style={{ color: 'var(--text-muted)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Population Affected</div>
                <div style={{ fontWeight: 700, color: 'var(--text)', marginTop: 2 }}>{alert.population_affected}</div>
              </div>
            )}
            {alert.issued_by && (
              <div style={{ background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.1)', borderRadius: 9, padding: '8px 12px', fontSize: 12 }}>
                <div style={{ color: 'var(--text-muted)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Issued By</div>
                <div style={{ fontWeight: 700, color: 'var(--text)', marginTop: 2 }}>{alert.issued_by}</div>
              </div>
            )}
            {alert.agency && (
              <div style={{ background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.1)', borderRadius: 9, padding: '8px 12px', fontSize: 12 }}>
                <div style={{ color: 'var(--text-muted)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Agency</div>
                <div style={{ fontWeight: 700, color: 'var(--text)', marginTop: 2 }}>{alert.agency}</div>
              </div>
            )}
            {alert.site_id && (
              <div style={{ background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.1)', borderRadius: 9, padding: '8px 12px', fontSize: 12 }}>
                <div style={{ color: 'var(--text-muted)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Site ID</div>
                <div style={{ fontWeight: 700, color: 'var(--text)', marginTop: 2 }}>{alert.site_id}</div>
              </div>
            )}
          </div>

          {/* Timeline updates */}
          {alert.updates?.length > 0 && (
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Update Timeline</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                {alert.updates.map((u, i) => (
                  <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 4 }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: cfg.color, flexShrink: 0 }}/>
                      {i < alert.updates.length - 1 && <div style={{ width: 1, flex: 1, background: 'var(--border)', minHeight: 12, marginTop: 2 }}/>}
                    </div>
                    <div style={{ paddingBottom: 10 }}>
                      <span style={{ fontSize: 11, color: cfg.color, fontWeight: 700 }}>{u.time}</span>
                      <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 8 }}>{u.text}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '8px 0', borderRadius: 9, background: cfg.bg, border: `1px solid ${cfg.border}`, color: cfg.color, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
              <Eye style={{ width: 13, height: 13 }}/> View on Map
            </button>
            <button style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '8px 0', borderRadius: 9, background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.15)', color: '#818cf8', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
              <Share2 style={{ width: 13, height: 13 }}/> Share Alert
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

/* Fake Globe2 since not in lucide */
function Globe2({ style, className }) {
  return <MapPin style={style} className={className}/>
}

/* ── STATS BAR ── */
function StatsBar({ alerts }) {
  const active = alerts.filter(a => a.is_active)
  const high = active.filter(a => a.severity === 'high').length
  const medium = active.filter(a => a.severity === 'medium').length
  const low = active.filter(a => a.severity === 'low').length

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12, marginBottom: 20 }}>
      {[
        { label: 'Active Alerts', value: active.length, color: '#ef4444', icon: Bell, pulse: active.length > 0 },
        { label: 'Critical', value: high, color: '#ef4444', icon: AlertTriangle },
        { label: 'Warnings', value: medium, color: '#f59e0b', icon: AlertTriangle },
        { label: 'Advisories', value: low, color: '#10b981', icon: Info },
        { label: 'Resolved (7d)', value: 8, color: '#64748b', icon: CheckCircle },
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

export default function Alerts() {
  const [alerts, setAlerts] = useState(PRESET_ALERTS)
  const [filter, setFilter] = useState('all')
  const [typeFilter] = useState('all')
  const [expandedId, setExpandedId] = useState(null)
  const [notifEnabled, setNotifEnabled] = useState(true)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    api.get('/admin/alerts').then(r => {
      const fetched = r.data.alerts || []
      if (fetched.length) setAlerts(fetched)
    }).catch(() => {})
  }, [])

  const toggleExpand = (id) => setExpandedId(prev => prev === id ? null : id)

  const filtered = alerts.filter(a => {
    const sevMatch = filter === 'all' || (filter === 'active' ? a.is_active : filter === 'resolved' ? !a.is_active : a.severity === filter)
    const typeMatch = typeFilter === 'all' || a.type === typeFilter
    return sevMatch && typeMatch
  })

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
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Algoma District · North Shore · Lake Superior Region</div>
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button onClick={() => setNotifEnabled(n => !n)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: 'pointer', border: 'none', background: notifEnabled ? 'rgba(99,102,241,0.1)' : 'var(--border)', color: notifEnabled ? '#818cf8' : 'var(--text-muted)' }}>
              {notifEnabled ? <Bell style={{ width: 14, height: 14 }}/> : <BellOff style={{ width: 14, height: 14 }}/>}
              {notifEnabled ? 'Notifications On' : 'Muted'}
            </button>
            <button onClick={() => { setLoading(true); setTimeout(() => setLoading(false), 1000) }}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: 'pointer', border: 'none', background: 'var(--border)', color: 'var(--text-muted)' }}>
              <RefreshCw style={{ width: 13, height: 13, animation: loading ? 'spin 1s linear infinite' : 'none' }}/>
            </button>
          </div>
        </div>

        {/* Stats bar */}
        <StatsBar alerts={alerts}/>

        {/* Filters */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
            {[
              { v: 'all', label: 'All' },
              { v: 'active', label: 'Active' },
              { v: 'high', label: 'Critical' },
              { v: 'medium', label: 'Warnings' },
              { v: 'low', label: 'Advisories' },
              { v: 'resolved', label: 'Resolved' },
            ].map(f => (
              <button key={f.v} onClick={() => setFilter(f.v)}
                style={{
                  padding: '6px 14px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600,
                  background: filter === f.v ? 'rgba(99,102,241,0.15)' : 'var(--border)',
                  color: filter === f.v ? '#818cf8' : 'var(--text-muted)',
                  transition: 'all 0.15s',
                }}>
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Alert list */}
        {filtered.length === 0 ? (
          <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 14, padding: '48px 24px', textAlign: 'center' }}>
            <CheckCircle style={{ width: 44, height: 44, color: '#10b981', margin: '0 auto 12px' }}/>
            <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--text)', marginBottom: 4 }}>All Clear</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>No alerts matching this filter. Water quality in your monitored region is within safe parameters.</div>
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
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>About These Alerts</span>
          </div>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6, margin: 0 }}>
            Alerts are issued by certified water quality monitors, NORDIK Institute researchers, and approved community partners.
            Real-time data is pulled from {alerts.length} active monitoring sites across the Algoma District.
            For emergencies, contact your local public health unit immediately.
          </p>
        </div>
      </div>

      <style>{`
        @keyframes alertPing {
          75%, 100% { transform: scale(2.5); opacity: 0; }
        }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}
