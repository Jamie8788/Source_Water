/**
 * StoryLayer — community-context pins shared across all signed-in users.
 *
 * Pure additive: stories live in our own DB (server/routes/mapStories.js),
 * never touch the Water Rangers API. Text-only, vibe-tagged, < 280 chars.
 *
 * Click handling on the map (drop a story) is wired by the parent via the
 * `onMapClick` callback passed to <MapClickCatcher/>; this file only
 * renders the markers + popups.
 */
import { useMap, Marker, Popup, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import { useEffect, useMemo, useState } from 'react'

export const VIBES = {
  clean:      { label: 'Clean',      emoji: '💧', color: '#10b981' },
  concerning: { label: 'Concerning', emoji: '⚠️', color: '#ef4444' },
  beautiful:  { label: 'Beautiful',  emoji: '✨', color: '#a78bfa' },
  curious:    { label: 'Curious',    emoji: '🔎', color: '#f59e0b' },
}

function storyIcon(vibe) {
  const v = VIBES[vibe] || VIBES.curious
  // Inline SVG pin: matches the vibe's color so the layer reads at a glance
  // without needing image assets.
  const svg = `
    <svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 40' width='30' height='38'>
      <defs>
        <filter id='ds' x='-30%' y='-10%' width='160%' height='140%'>
          <feDropShadow dx='0' dy='1.5' stdDeviation='1.5' flood-opacity='0.45'/>
        </filter>
      </defs>
      <g filter='url(#ds)'>
        <path d='M16 0 C7.2 0 0 7 0 15.6 C0 26 16 40 16 40 C16 40 32 26 32 15.6 C32 7 24.8 0 16 0 Z'
          fill='${v.color}' stroke='#0f172a' stroke-width='1.4'/>
        <circle cx='16' cy='15' r='6' fill='#0f172a' opacity='0.25'/>
        <text x='16' y='20' text-anchor='middle' font-size='14' font-family='Apple Color Emoji,Segoe UI Emoji'>${v.emoji}</text>
      </g>
    </svg>`
  return L.divIcon({
    html: svg,
    className: 'story-pin-icon',
    iconSize: [30, 38],
    iconAnchor: [15, 38],
    popupAnchor: [0, -34],
  })
}

export function MapClickCatcher({ enabled, onMapClick }) {
  useMapEvents({
    click(e) {
      if (!enabled) return
      onMapClick?.(e.latlng)
    },
  })
  return null
}

export default function StoryLayer({ stories, currentUserId, isAdmin, onEdit, onDelete }) {
  const cached = useMemo(() => stories || [], [stories])
  return (
    <>
      {cached.map(s => {
        const v = VIBES[s.vibe] || VIBES.curious
        const mine = s.user_id === currentUserId
        const canEdit = mine || isAdmin
        const author = s.display_name || s.username || 'Member'
        const when = s.created_at ? new Date(s.created_at).toLocaleString() : ''
        return (
          <Marker key={s.id} position={[parseFloat(s.latitude), parseFloat(s.longitude)]} icon={storyIcon(s.vibe)}>
            <Popup maxWidth={260}>
              <div style={{ fontSize: 12, lineHeight: 1.5, minWidth: 200 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: 4,
                    padding: '2px 8px', borderRadius: 999,
                    background: `${v.color}1a`, color: v.color,
                    fontWeight: 700, fontSize: 11,
                  }}>
                    <span aria-hidden="true">{v.emoji}</span> {v.label}
                  </span>
                </div>
                <div style={{ color: '#1f2937', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                  {s.text}
                </div>
                <div style={{ marginTop: 6, fontSize: 10, color: '#6b7280' }}>
                  {author} · {when}
                </div>
                {canEdit && (
                  <div style={{ marginTop: 8, display: 'flex', gap: 6 }}>
                    {mine && (
                      <button onClick={() => onEdit?.(s)} style={{
                        padding: '3px 8px', borderRadius: 6, border: '1px solid #cbd5e1',
                        background: '#fff', color: '#334155', fontSize: 11, cursor: 'pointer',
                      }}>Edit</button>
                    )}
                    <button onClick={() => onDelete?.(s)} style={{
                      padding: '3px 8px', borderRadius: 6, border: '1px solid #fecaca',
                      background: '#fef2f2', color: '#b91c1c', fontSize: 11, cursor: 'pointer',
                    }}>Delete</button>
                  </div>
                )}
              </div>
            </Popup>
          </Marker>
        )
      })}
    </>
  )
}

export function StoryModal({ open, mode = 'create', initial = null, latlng = null, busy, error, onClose, onSave }) {
  const [vibe, setVibe] = useState('curious')
  const [text, setText] = useState('')

  // Sync local state when the modal opens/edit target changes
  useEffect(() => {
    if (open) {
      setVibe(initial?.vibe || 'curious')
      setText(initial?.text || '')
    }
  }, [open, initial?.id, initial?.vibe, initial?.text])

  if (!open) return null

  const submit = (e) => {
    e.preventDefault()
    const t = text.trim().slice(0, 280)
    if (!t) return
    onSave?.({ vibe, text: t })
  }

  return (
    <div
      onClick={() => !busy && onClose?.()}
      style={{
        position: 'fixed', inset: 0, zIndex: 1500, background: 'rgba(0,0,0,0.6)',
        backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      <form
        onClick={e => e.stopPropagation()}
        onSubmit={submit}
        style={{
          width: '92%', maxWidth: 460, background: 'var(--card-bg, #1e1e2e)',
          border: '1px solid var(--border, #334155)', borderRadius: 14, padding: 18,
          color: 'var(--text, #e2e8f0)',
        }}
      >
        <h3 style={{ margin: 0, marginBottom: 4, fontSize: 16, fontWeight: 800 }}>
          {mode === 'edit' ? 'Edit your story' : 'Add a community story'}
        </h3>
        <p style={{ margin: 0, marginBottom: 14, fontSize: 12, color: 'var(--text-muted, #94a3b8)' }}>
          Visible to all SOURCE Water members. Text only — no photos.
          {latlng && ` · ${Number(latlng.lat).toFixed(4)}, ${Number(latlng.lng).toFixed(4)}`}
        </p>

        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted, #94a3b8)', marginBottom: 6 }}>
          Vibe
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
          {Object.entries(VIBES).map(([k, v]) => {
            const checked = vibe === k
            return (
              <button
                key={k}
                type="button"
                onClick={() => setVibe(k)}
                aria-pressed={checked}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                  padding: '5px 11px', borderRadius: 999, cursor: 'pointer',
                  border: `1.5px solid ${checked ? v.color : v.color + '66'}`,
                  background: checked ? `${v.color}33` : `${v.color}10`,
                  color: v.color, fontSize: 12, fontWeight: 700,
                  outline: 'none',
                }}
              >
                {v.emoji} {v.label}
              </button>
            )
          })}
        </div>

        <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted, #94a3b8)', display: 'block', marginBottom: 4 }}>
          What did you see / want to share? <span style={{ fontWeight: 500, color: 'var(--text-muted, #94a3b8)' }}>({text.length}/280)</span>
        </label>
        <textarea
          value={text}
          onChange={e => setText(e.target.value.slice(0, 280))}
          maxLength={280}
          rows={3}
          required
          placeholder="A quick note for the community…"
          style={{
            width: '100%', boxSizing: 'border-box',
            padding: 10, borderRadius: 8, fontSize: 13,
            background: 'rgba(0,0,0,0.18)', border: '1px solid var(--border, #334155)',
            color: 'var(--text, #e2e8f0)', resize: 'vertical', fontFamily: 'inherit',
          }}
        />

        {error && (
          <div style={{ marginTop: 10, padding: 8, borderRadius: 8, fontSize: 12, color: '#fca5a5', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)' }}>
            {error}
          </div>
        )}

        <div style={{ marginTop: 14, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button type="button" onClick={onClose} disabled={busy} style={{
            padding: '8px 14px', borderRadius: 8, fontSize: 12, fontWeight: 700,
            background: 'rgba(255,255,255,0.05)', color: 'var(--text-muted, #94a3b8)',
            border: '1px solid var(--border, #334155)', cursor: busy ? 'wait' : 'pointer',
          }}>Cancel</button>
          <button type="submit" disabled={busy || !text.trim()} style={{
            padding: '8px 14px', borderRadius: 8, fontSize: 12, fontWeight: 800,
            background: 'linear-gradient(135deg,#4f46e5,#7c3aed)', color: 'white', border: 'none',
            cursor: busy ? 'wait' : (text.trim() ? 'pointer' : 'not-allowed'), opacity: busy || !text.trim() ? 0.6 : 1,
          }}>{mode === 'edit' ? 'Save changes' : 'Post story'}</button>
        </div>
      </form>
    </div>
  )
}
