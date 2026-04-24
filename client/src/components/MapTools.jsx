/**
 * MapTools — adds two volunteer-focused features to any react-leaflet map:
 *   1. Measure: click points to draw a polyline. Shows live distance.
 *      Double-click closes a polygon and shows enclosed area.
 *   2. Field waypoints: drop a personal pin anywhere with name/note/category.
 *      Stored per-user via /api/waypoints — never visible to other users.
 *
 * Architecture:
 *   <MapToolsLayer/>   — child of MapContainer, listens to clicks, renders shapes
 *   <MapToolsToolbar/> — absolute-positioned overlay, sibling of MapContainer
 *   <WaypointModal/>   — page-level modal, opens after a waypoint click
 *
 * Nothing here mutates Water Rangers data or the existing site markers — it's
 * an additive layer painted *on top* of the live monitoring map.
 */
import { useState, useEffect, useRef, useMemo } from 'react'
import {
  Polyline, Polygon, CircleMarker, Popup, Tooltip as LTooltip, useMap, useMapEvents,
} from 'react-leaflet'
import {
  Ruler, MapPin, Trash2, X, Plus, Eye, EyeOff, Save, Pencil,
} from 'lucide-react'

const R_EARTH_M = 6371000

/* ── distance / area math (Haversine + spherical polygon) ── */
export function distanceMetersBetween(a, b) {
  const toRad = d => (d * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const lat1 = toRad(a.lat), lat2 = toRad(b.lat)
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return 2 * R_EARTH_M * Math.asin(Math.min(1, Math.sqrt(x)))
}

export function totalDistanceM(points) {
  if (!points || points.length < 2) return 0
  let total = 0
  for (let i = 1; i < points.length; i++) total += distanceMetersBetween(points[i - 1], points[i])
  return total
}

// Spherical polygon area approximation — accurate enough for citizen-science use
export function polygonAreaM2(points) {
  if (!points || points.length < 3) return 0
  const toRad = d => (d * Math.PI) / 180
  let area = 0
  const n = points.length
  for (let i = 0; i < n; i++) {
    const p1 = points[i]
    const p2 = points[(i + 1) % n]
    area += toRad(p2.lng - p1.lng) * (2 + Math.sin(toRad(p1.lat)) + Math.sin(toRad(p2.lat)))
  }
  return Math.abs((area * R_EARTH_M * R_EARTH_M) / 2)
}

export function formatDistance(m) {
  if (m == null || !isFinite(m)) return '—'
  if (m < 1000) return `${m.toFixed(0)} m`
  return `${(m / 1000).toFixed(2)} km`
}

export function formatArea(m2) {
  if (m2 == null || !isFinite(m2)) return '—'
  if (m2 < 10000) return `${m2.toFixed(0)} m²`
  if (m2 < 1e6) return `${(m2 / 10000).toFixed(2)} ha`
  return `${(m2 / 1e6).toFixed(3)} km²`
}

/* ── waypoint categories (must match server/routes/waypoints.js) ── */
export const WAYPOINT_CATEGORIES = [
  { value: 'general',          label: 'General note',     emoji: '📍', color: '#f59e0b' },
  { value: 'access_point',     label: 'Access point',     emoji: '🚪', color: '#10b981' },
  { value: 'hazard',           label: 'Hazard / concern', emoji: '⚠️', color: '#ef4444' },
  { value: 'wildlife',         label: 'Wildlife sighting',emoji: '🐟', color: '#8b5cf6' },
  { value: 'monitoring_idea',  label: 'Future monitoring',emoji: '🎯', color: '#0ea5e9' },
  { value: 'photo_spot',       label: 'Photo spot',       emoji: '📸', color: '#ec4899' },
  { value: 'note',             label: 'Quick note',       emoji: '📝', color: '#64748b' },
]
const CAT_BY_VAL = Object.fromEntries(WAYPOINT_CATEGORIES.map(c => [c.value, c]))
export function categoryMeta(value) { return CAT_BY_VAL[value] || CAT_BY_VAL.general }

/* ── In-map layer: handles clicks based on mode, renders shapes + waypoint markers ── */
export function MapToolsLayer({
  mode,                   // 'off' | 'measure' | 'waypoint'
  measurePoints, setMeasurePoints,
  measureClosed, setMeasureClosed,
  onWaypointMapClick,     // (latlng) => void  — opens modal in parent
  waypoints,              // [{id, latitude, longitude, name, note, category, color}]
  waypointsVisible,
  onWaypointEdit,         // (waypoint) => void
  onWaypointDelete,       // (id) => void
}) {
  const map = useMap()

  // Cursor + ESC-to-exit reflect the active mode
  useEffect(() => {
    const el = map.getContainer()
    if (mode === 'measure' || mode === 'waypoint') el.style.cursor = 'crosshair'
    else el.style.cursor = ''
    return () => { el.style.cursor = '' }
  }, [mode, map])

  useMapEvents({
    click(e) {
      if (mode === 'measure') {
        if (measureClosed) {
          // Restart a fresh measurement on first click after a closed polygon
          setMeasureClosed(false)
          setMeasurePoints([{ lat: e.latlng.lat, lng: e.latlng.lng }])
        } else {
          setMeasurePoints(p => [...p, { lat: e.latlng.lat, lng: e.latlng.lng }])
        }
      } else if (mode === 'waypoint') {
        onWaypointMapClick({ lat: e.latlng.lat, lng: e.latlng.lng })
      }
    },
    dblclick(e) {
      if (mode === 'measure' && measurePoints.length >= 3) {
        setMeasureClosed(true)
        e.originalEvent?.preventDefault?.()
      }
    },
  })

  // Disable Leaflet's default double-click zoom while measuring so the
  // double-click reliably closes the polygon instead.
  useEffect(() => {
    if (mode === 'measure') map.doubleClickZoom.disable()
    else map.doubleClickZoom.enable()
    return () => map.doubleClickZoom.enable()
  }, [mode, map])

  return (
    <>
      {/* Measure shapes */}
      {measurePoints.length > 0 && (measureClosed && measurePoints.length >= 3
        ? <Polygon positions={measurePoints.map(p => [p.lat, p.lng])}
            pathOptions={{ color: '#a855f7', weight: 2, fillColor: '#a855f7', fillOpacity: 0.15, dashArray: '4 3' }}/>
        : <Polyline positions={measurePoints.map(p => [p.lat, p.lng])}
            pathOptions={{ color: '#a855f7', weight: 2.5, dashArray: '4 4' }}/>
      )}
      {measurePoints.map((p, i) => (
        <CircleMarker key={`m-${i}`} center={[p.lat, p.lng]} radius={4}
          pathOptions={{ color: '#a855f7', fillColor: '#fff', weight: 2, fillOpacity: 1 }}>
          <LTooltip permanent={false} direction="top" offset={[0, -6]}>
            point {i + 1}
            {i > 0 && ` · ${formatDistance(distanceMetersBetween(measurePoints[i - 1], p))} from prev`}
          </LTooltip>
        </CircleMarker>
      ))}

      {/* User waypoints */}
      {waypointsVisible && (waypoints || []).map(w => {
        const cat = categoryMeta(w.category)
        const color = w.color || cat.color
        return (
          <CircleMarker key={`wp-${w.id}`} center={[w.latitude, w.longitude]} radius={9}
            pathOptions={{ color, fillColor: color, weight: 2.5, fillOpacity: 0.85 }}>
            <Popup maxWidth={280}>
              <div style={{ fontSize: 12, lineHeight: 1.45, minWidth: 200 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <span style={{ fontSize: 16 }}>{cat.emoji}</span>
                  <strong style={{ fontSize: 13 }}>{w.name}</strong>
                </div>
                <div style={{ color: '#666', fontSize: 10, marginBottom: 6 }}>
                  {cat.label} · {Number(w.latitude).toFixed(4)}, {Number(w.longitude).toFixed(4)}
                </div>
                {w.note && <div style={{ marginBottom: 8, whiteSpace: 'pre-wrap' }}>{w.note}</div>}
                <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                  <button onClick={() => onWaypointEdit(w)}
                    style={{ flex: 1, padding: '5px 8px', fontSize: 11, fontWeight: 700, borderRadius: 6, border: 'none', background: '#6366f1', color: '#fff', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                    <Pencil size={11}/> Edit
                  </button>
                  <button onClick={() => onWaypointDelete(w.id)}
                    style={{ padding: '5px 8px', fontSize: 11, fontWeight: 700, borderRadius: 6, border: 'none', background: '#ef4444', color: '#fff', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <Trash2 size={11}/>
                  </button>
                </div>
              </div>
            </Popup>
          </CircleMarker>
        )
      })}
    </>
  )
}

/* ── Floating toolbar (sibling of MapContainer) ── */
export function MapToolsToolbar({
  mode, setMode,
  measurePoints, measureClosed, clearMeasure,
  waypoints, waypointsVisible, setWaypointsVisible,
  isAuthed,
}) {
  const totalM = useMemo(() => totalDistanceM(measurePoints), [measurePoints])
  const areaM2 = useMemo(
    () => (measureClosed && measurePoints.length >= 3 ? polygonAreaM2(measurePoints) : 0),
    [measurePoints, measureClosed]
  )

  // ESC exits whichever mode is active
  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape' && mode !== 'off') setMode('off') }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [mode, setMode])

  const Btn = ({ active, onClick, color, icon: Icon, label, badge }) => (
    <button onClick={onClick}
      title={label}
      style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '7px 11px', borderRadius: 9, fontSize: 11, fontWeight: 700,
        cursor: 'pointer', border: '1px solid',
        borderColor: active ? color : 'rgba(255,255,255,0.18)',
        background: active ? color : 'rgba(15,23,42,0.85)',
        color: active ? '#fff' : '#e2e8f0',
        boxShadow: active ? `0 0 0 3px ${color}33` : '0 2px 6px rgba(0,0,0,0.3)',
        backdropFilter: 'blur(6px)',
        position: 'relative',
      }}>
      <Icon size={13}/>
      <span>{label}</span>
      {badge != null && badge > 0 && (
        <span style={{ marginLeft: 2, padding: '1px 6px', borderRadius: 10, background: active ? 'rgba(255,255,255,0.25)' : color, color: active ? '#fff' : '#fff', fontSize: 9, fontWeight: 800 }}>{badge}</span>
      )}
    </button>
  )

  return (
    <>
      {/* Top-right toolbar */}
      <div style={{
        position: 'absolute', top: 10, right: 10, zIndex: 1000,
        display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end',
      }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <Btn active={mode === 'measure'} color="#a855f7" icon={Ruler}
            label={mode === 'measure' ? 'Measuring…' : 'Measure'}
            onClick={() => setMode(mode === 'measure' ? 'off' : 'measure')}/>
          {isAuthed && (
            <Btn active={mode === 'waypoint'} color="#f59e0b" icon={MapPin}
              label={mode === 'waypoint' ? 'Click map to drop pin' : 'Drop waypoint'}
              onClick={() => setMode(mode === 'waypoint' ? 'off' : 'waypoint')}/>
          )}
          {isAuthed && (
            <Btn active={waypointsVisible} color="#0ea5e9" icon={waypointsVisible ? Eye : EyeOff}
              label={`My waypoints (${waypoints?.length || 0})`}
              badge={waypoints?.length}
              onClick={() => setWaypointsVisible(v => !v)}/>
          )}
        </div>

        {/* Mode hint */}
        {mode === 'measure' && (
          <div style={{
            padding: '6px 10px', borderRadius: 8, background: 'rgba(168,85,247,0.95)',
            color: '#fff', fontSize: 10, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6,
            boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
          }}>
            <Ruler size={11}/>
            <span>Click points · Double-click closes polygon · Esc to exit</span>
          </div>
        )}
        {mode === 'waypoint' && (
          <div style={{
            padding: '6px 10px', borderRadius: 8, background: 'rgba(245,158,11,0.95)',
            color: '#fff', fontSize: 10, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6,
            boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
          }}>
            <MapPin size={11}/>
            <span>Click anywhere on the map to drop a pin · Esc to cancel</span>
          </div>
        )}
        {!isAuthed && (
          <div style={{ padding: '4px 10px', borderRadius: 8, background: 'rgba(0,0,0,0.7)', color: '#cbd5e1', fontSize: 9, fontWeight: 600 }}>
            Sign in to drop personal field waypoints
          </div>
        )}
      </div>

      {/* Measurement readout (bottom-left) */}
      {(mode === 'measure' || measurePoints.length > 0) && (
        <div style={{
          position: 'absolute', bottom: 12, left: 12, zIndex: 1000,
          padding: '8px 12px', borderRadius: 10, background: 'rgba(15,23,42,0.92)',
          color: '#fff', fontSize: 11, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 12,
          boxShadow: '0 4px 12px rgba(0,0,0,0.4)', backdropFilter: 'blur(6px)',
        }}>
          <div>
            <div style={{ fontSize: 8, fontWeight: 800, color: '#a855f7', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Distance</div>
            <div style={{ fontSize: 13, fontWeight: 800 }}>{formatDistance(totalM)}</div>
          </div>
          {measureClosed && measurePoints.length >= 3 && (
            <div>
              <div style={{ fontSize: 8, fontWeight: 800, color: '#a855f7', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Area</div>
              <div style={{ fontSize: 13, fontWeight: 800 }}>{formatArea(areaM2)}</div>
            </div>
          )}
          <div style={{ fontSize: 9, color: '#94a3b8' }}>
            {measurePoints.length} pt{measurePoints.length === 1 ? '' : 's'}
          </div>
          <button onClick={clearMeasure} title="Clear measurement"
            style={{ padding: '4px 8px', borderRadius: 6, border: 'none', background: 'rgba(239,68,68,0.85)', color: '#fff', fontSize: 10, fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <Trash2 size={10}/> Clear
          </button>
        </div>
      )}
    </>
  )
}

/* ── Modal: create or edit a waypoint ── */
export function WaypointModal({ open, mode, latlng, initial, onClose, onSave, busy, error }) {
  const [name, setName] = useState('')
  const [note, setNote] = useState('')
  const [category, setCategory] = useState('general')
  const firstFieldRef = useRef(null)

  useEffect(() => {
    if (!open) return
    if (initial) {
      setName(initial.name || '')
      setNote(initial.note || '')
      setCategory(initial.category || 'general')
    } else {
      setName(''); setNote(''); setCategory('general')
    }
    setTimeout(() => firstFieldRef.current?.focus(), 50)
  }, [open, initial])

  if (!open) return null

  const cat = categoryMeta(category)
  const lat = initial?.latitude ?? latlng?.lat
  const lng = initial?.longitude ?? latlng?.lng

  const handleSave = () => {
    if (!name.trim()) return
    onSave({ name: name.trim(), note: note.trim() || null, category, color: cat.color })
  }

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)',
      zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: 'var(--card-bg, #1e1e2e)', border: '1px solid var(--border)',
        borderRadius: 14, padding: 20, maxWidth: 440, width: '92%',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <h2 style={{ color: 'var(--text)', fontSize: 16, fontWeight: 900, margin: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 20 }}>{cat.emoji}</span>
            {mode === 'edit' ? 'Edit waypoint' : 'New field waypoint'}
          </h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={16}/></button>
        </div>

        {lat != null && lng != null && (
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 10 }}>
            <MapPin size={11} style={{ display: 'inline', marginRight: 4, verticalAlign: '-2px' }}/>
            {Number(lat).toFixed(5)}, {Number(lng).toFixed(5)}
          </div>
        )}

        <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
          Name
        </label>
        <input ref={firstFieldRef} value={name} onChange={e => setName(e.target.value)} maxLength={120}
          placeholder="e.g. Suspicious foam, kayak put-in, future monitoring spot…"
          style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'rgba(0,0,0,0.15)', color: 'var(--text)', fontSize: 13, marginBottom: 10, boxSizing: 'border-box' }}/>

        <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
          Category
        </label>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 4, marginBottom: 12 }}>
          {WAYPOINT_CATEGORIES.map(c => (
            <button key={c.value} type="button" onClick={() => setCategory(c.value)}
              style={{
                padding: '6px 8px', borderRadius: 7, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                border: '1px solid', borderColor: category === c.value ? c.color : 'var(--border)',
                background: category === c.value ? `${c.color}22` : 'transparent',
                color: category === c.value ? c.color : 'var(--text-muted)',
                display: 'flex', alignItems: 'center', gap: 5,
              }}>
              <span>{c.emoji}</span><span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.label}</span>
            </button>
          ))}
        </div>

        <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
          Note (optional)
        </label>
        <textarea value={note} onChange={e => setNote(e.target.value)} maxLength={2000} rows={3}
          placeholder="What did you see? When? Anything other volunteers should know?"
          style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'rgba(0,0,0,0.15)', color: 'var(--text)', fontSize: 12, resize: 'vertical', marginBottom: 12, boxSizing: 'border-box', fontFamily: 'inherit' }}/>

        {error && <div style={{ padding: 8, marginBottom: 10, borderRadius: 8, background: 'rgba(239,68,68,0.1)', color: '#fca5a5', fontSize: 11 }}>{error}</div>}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onClose} disabled={busy}
            style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-muted)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
            Cancel
          </button>
          <button onClick={handleSave} disabled={busy || !name.trim()}
            style={{ padding: '8px 14px', borderRadius: 8, border: 'none', background: cat.color, color: '#fff', fontSize: 12, fontWeight: 700, cursor: name.trim() ? 'pointer' : 'not-allowed', opacity: (busy || !name.trim()) ? 0.5 : 1, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            {busy ? 'Saving…' : <><Save size={12}/> {mode === 'edit' ? 'Update' : 'Drop pin'}</>}
          </button>
        </div>
      </div>
    </div>
  )
}
