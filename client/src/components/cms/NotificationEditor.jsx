/**
 * NotificationEditor — Admin panel to manage the site-wide notification bar.
 * Draggable floating panel, appears when admin clicks Alerts in CMSToolbar.
 */
import { useState, useRef, useEffect, useCallback } from 'react'
import { useCMS } from '../../context/CMSContext'
import { X, GripHorizontal, Bell, Save, Eye, EyeOff, AlertTriangle, AlertCircle, Info, CheckCircle } from 'lucide-react'

const STYLE_OPTIONS = [
  { val: 'info',     label: 'Info (Dark)',     preview: 'linear-gradient(90deg,#1e1b4b,#312e81)', text: '#e0e7ff' },
  { val: 'warning',  label: 'Warning (Yellow)', preview: '#fef3c7', text: '#92400e' },
  { val: 'alert',    label: 'Alert (Red)',      preview: '#fee2e2', text: '#991b1b' },
  { val: 'success',  label: 'Success (Green)',  preview: '#d1fae5', text: '#065f46' },
  { val: 'announce', label: 'Announce (Teal)',  preview: 'linear-gradient(90deg,#0f172a,#1e293b)', text: '#ccfbf1' },
]

const ICON_OPTIONS = [
  { val: 'warning', el: <AlertTriangle size={14}/> },
  { val: 'alert',   el: <AlertCircle size={14}/> },
  { val: 'info',    el: <Info size={14}/> },
  { val: 'success', el: <CheckCircle size={14}/> },
  { val: 'bell',    el: <Bell size={14}/> },
  { val: 'none',    el: <span style={{ fontSize: 11 }}>None</span> },
]

export default function NotificationEditor({ onClose }) {
  const { notification, saveNotification } = useCMS()
  const [message, setMessage] = useState(notification?.message || '')
  const [style, setStyle]     = useState(notification?.style || 'info')
  const [icon, setIcon]       = useState(notification?.icon || 'info')
  const [enabled, setEnabled] = useState(notification?.enabled ?? false)
  const [saving, setSaving]   = useState(false)
  const [saved, setSaved]     = useState(false)

  const panelRef = useRef(null)
  const dragState = useRef({ dragging: false, startX: 0, startY: 0, origLeft: 0, origTop: 0 })
  const [pos, setPos] = useState({ left: window.innerWidth / 2 - 180, top: 120 })

  const onMouseDown = useCallback((e) => {
    if (e.button !== 0) return
    const rect = panelRef.current?.getBoundingClientRect()
    if (!rect) return
    dragState.current = { dragging: true, startX: e.clientX, startY: e.clientY, origLeft: rect.left, origTop: rect.top }
    e.preventDefault()
  }, [])

  useEffect(() => {
    const onMove = (e) => {
      if (!dragState.current.dragging) return
      setPos({ left: dragState.current.origLeft + e.clientX - dragState.current.startX, top: dragState.current.origTop + e.clientY - dragState.current.startY })
    }
    const onUp = () => { dragState.current.dragging = false }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
  }, [])

  const handleSave = async () => {
    setSaving(true)
    await saveNotification({ enabled, message, style, icon })
    setSaving(false); setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const s = {
    panel: { position: 'fixed', left: pos.left, top: pos.top, width: 360, zIndex: 99999, background: 'linear-gradient(160deg,#1e1b4b,#1a1a2e)', border: '1px solid rgba(99,102,241,0.4)', borderRadius: 14, boxShadow: '0 20px 60px rgba(0,0,0,0.7)', overflow: 'hidden', fontFamily: 'system-ui, sans-serif' },
    header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'linear-gradient(135deg,#4f46e5,#7c3aed)', cursor: 'grab', gap: 8 },
    body: { padding: '14px', display: 'flex', flexDirection: 'column', gap: 12 },
    label: { fontSize: 11, fontWeight: 700, color: 'rgba(199,210,254,0.8)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4, display: 'block' },
    input: { width: '100%', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(99,102,241,0.3)', borderRadius: 8, color: '#e0e7ff', fontSize: 13, padding: '7px 10px', outline: 'none', boxSizing: 'border-box' },
  }

  const selectedStylePreview = STYLE_OPTIONS.find(o => o.val === style)

  return (
    <div ref={panelRef} style={s.panel} data-cms-ui="true">
      <div style={s.header} onMouseDown={onMouseDown}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <GripHorizontal size={14} color="rgba(255,255,255,0.6)" />
          <Bell size={13} color="#c4b5fd" />
          <span style={{ fontSize: 12, fontWeight: 700, color: 'white' }}>Site Notification Bar</span>
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.7)', display: 'flex', padding: 2 }}>
          <X size={15} />
        </button>
      </div>

      <div style={s.body}>
        {/* Enable toggle */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', borderRadius: 8, background: enabled ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.05)', border: `1px solid ${enabled ? 'rgba(99,102,241,0.5)' : 'rgba(255,255,255,0.1)'}`, cursor: 'pointer' }} onClick={() => setEnabled(e => !e)}>
          <span style={{ fontSize: 13, fontWeight: 600, color: enabled ? '#c4b5fd' : 'rgba(255,255,255,0.5)' }}>
            {enabled ? '● Notification Enabled' : '○ Notification Disabled'}
          </span>
          {enabled ? <Eye size={14} color="#c4b5fd"/> : <EyeOff size={14} color="rgba(255,255,255,0.3)"/>}
        </div>

        {/* Message */}
        <div>
          <span style={s.label}>Message (HTML allowed)</span>
          <textarea value={message} onChange={e => setMessage(e.target.value)} rows={3}
            placeholder="e.g. 🚧 Site maintenance scheduled for Friday..."
            style={{ ...s.input, resize: 'vertical', lineHeight: '1.5' }} />
        </div>

        {/* Style picker */}
        <div>
          <span style={s.label}>Bar Style</span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {STYLE_OPTIONS.map(o => (
              <button key={o.val} onClick={() => setStyle(o.val)}
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderRadius: 7, cursor: 'pointer', border: `2px solid ${style === o.val ? 'rgba(99,102,241,0.8)' : 'transparent'}`, background: 'rgba(255,255,255,0.04)' }}>
                <div style={{ width: 40, height: 18, borderRadius: 4, background: o.preview, flexShrink: 0 }} />
                <span style={{ fontSize: 12, color: style === o.val ? '#c4b5fd' : 'rgba(255,255,255,0.6)', fontWeight: 600 }}>{o.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Icon picker */}
        <div>
          <span style={s.label}>Icon</span>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {ICON_OPTIONS.map(o => (
              <button key={o.val} onClick={() => setIcon(o.val)}
                style={{ width: 34, height: 34, borderRadius: 7, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', background: icon === o.val ? 'rgba(99,102,241,0.4)' : 'rgba(255,255,255,0.06)', border: `1px solid ${icon === o.val ? 'rgba(99,102,241,0.8)' : 'rgba(255,255,255,0.1)'}`, color: icon === o.val ? '#c4b5fd' : 'rgba(255,255,255,0.6)' }}>
                {o.el}
              </button>
            ))}
          </div>
        </div>

        {/* Preview */}
        {message && (
          <div>
            <span style={s.label}>Preview</span>
            <div style={{ borderRadius: 8, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)' }}>
              <div style={{ background: selectedStylePreview?.preview, color: selectedStylePreview?.text, padding: '8px 12px', fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                {ICON_OPTIONS.find(o => o.val === icon)?.el}
                <span dangerouslySetInnerHTML={{ __html: message }} />
              </div>
            </div>
          </div>
        )}

        {/* Save */}
        <button onClick={handleSave} disabled={saving}
          style={{ width: '100%', padding: '10px 0', borderRadius: 8, cursor: saving ? 'default' : 'pointer', fontSize: 13, fontWeight: 700, background: saved ? 'linear-gradient(135deg,#059669,#10b981)' : 'linear-gradient(135deg,#4f46e5,#7c3aed)', border: 'none', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, opacity: saving ? 0.7 : 1, transition: 'background 0.3s' }}>
          <Save size={13}/>
          {saving ? 'Saving...' : saved ? 'Saved! All users see this now.' : 'Save & Publish'}
        </button>
      </div>
    </div>
  )
}
