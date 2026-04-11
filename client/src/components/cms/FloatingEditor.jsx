/**
 * FloatingEditor — Draggable CMS element editor panel.
 * Appears when an admin clicks any tagged element in CMS mode.
 * Edits: text content, font size, font weight, color, bg color, text alignment.
 * Saves to Supabase cms_overrides via saveOverride().
 */
import { useState, useRef, useEffect, useCallback } from 'react'
import { useCMS } from '../../context/CMSContext'
import { X, GripHorizontal, Save, RotateCcw, Type, AlignLeft, AlignCenter, AlignRight, AlignJustify, Bold, Trash2 } from 'lucide-react'

const WEIGHTS = [
  { label: 'Thin', value: '100' },
  { label: 'Light', value: '300' },
  { label: 'Normal', value: '400' },
  { label: 'Medium', value: '500' },
  { label: 'Semi Bold', value: '600' },
  { label: 'Bold', value: '700' },
  { label: 'Extra Bold', value: '800' },
  { label: 'Black', value: '900' },
]

export default function FloatingEditor() {
  const { selectedEl, setSelectedEl, saveOverride, deleteOverride, overrides } = useCMS()

  // Editor form state
  const [text, setText] = useState('')
  const [fontSize, setFontSize] = useState(16)
  const [fontWeight, setFontWeight] = useState('400')
  const [color, setColor] = useState('#ffffff')
  const [bgColor, setBgColor] = useState('')
  const [textAlign, setTextAlign] = useState('left')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  // Drag state
  const panelRef = useRef(null)
  const dragState = useRef({ dragging: false, startX: 0, startY: 0, origLeft: 0, origTop: 0 })
  const [pos, setPos] = useState({ left: null, top: null })

  // Populate form when a new element is selected
  useEffect(() => {
    if (!selectedEl) return
    const existing = overrides[selectedEl.key]
    setText(existing?.text ?? selectedEl.currentText ?? '')
    setFontSize(existing?.styles?.fontSize ? parseInt(existing.styles.fontSize) : (selectedEl.currentStyles?.fontSize ?? 16))
    setFontWeight(existing?.styles?.fontWeight ?? selectedEl.currentStyles?.fontWeight ?? '400')
    setColor(existing?.styles?.color ?? selectedEl.currentStyles?.color ?? '#ffffff')
    setBgColor(existing?.styles?.backgroundColor ?? selectedEl.currentStyles?.bgColor ?? '')
    setTextAlign(existing?.styles?.textAlign ?? selectedEl.currentStyles?.textAlign ?? 'left')
    setSaved(false)

    // Position panel near element (viewport coords → avoid going off-screen)
    if (selectedEl.rect) {
      const panelW = 320
      const panelH = 460
      let left = selectedEl.rect.right + 12
      let top = selectedEl.rect.top
      if (left + panelW > window.innerWidth - 12) left = Math.max(12, selectedEl.rect.left - panelW - 12)
      if (top + panelH > window.innerHeight - 12) top = Math.max(12, window.innerHeight - panelH - 12)
      setPos({ left, top })
    }
  }, [selectedEl?.key])

  // ── Drag handlers ─────────────────────────────────────────────────────────
  const onMouseDown = useCallback((e) => {
    if (e.button !== 0) return
    const panel = panelRef.current
    if (!panel) return
    const rect = panel.getBoundingClientRect()
    dragState.current = { dragging: true, startX: e.clientX, startY: e.clientY, origLeft: rect.left, origTop: rect.top }
    e.preventDefault()
  }, [])

  useEffect(() => {
    const onMove = (e) => {
      if (!dragState.current.dragging) return
      const dx = e.clientX - dragState.current.startX
      const dy = e.clientY - dragState.current.startY
      setPos({ left: dragState.current.origLeft + dx, top: dragState.current.origTop + dy })
    }
    const onUp = () => { dragState.current.dragging = false }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
  }, [])

  // ── Save ──────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!selectedEl) return
    setSaving(true)
    const styles = {}
    if (fontSize) styles.fontSize = `${fontSize}px`
    if (fontWeight) styles.fontWeight = fontWeight
    if (color) styles.color = color
    if (bgColor) styles.backgroundColor = bgColor
    if (textAlign) styles.textAlign = textAlign
    await saveOverride(selectedEl.key, text, styles)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  // ── Reset override ────────────────────────────────────────────────────────
  const handleReset = async () => {
    if (!selectedEl) return
    await deleteOverride(selectedEl.key)
    // Restore original from DOM
    if (selectedEl.element) {
      selectedEl.element.innerText = selectedEl.currentText
    }
    setSelectedEl(null)
  }

  // ── Close ─────────────────────────────────────────────────────────────────
  const handleClose = () => {
    if (selectedEl?.element) {
      selectedEl.element.style.outline = ''
      selectedEl.element.style.outlineOffset = ''
    }
    setSelectedEl(null)
  }

  if (!selectedEl) return null

  const s = {
    panel: {
      position: 'fixed',
      left: pos.left ?? 'calc(100vw - 340px)',
      top: pos.top ?? 80,
      width: 320,
      zIndex: 99999,
      background: 'linear-gradient(160deg,#1e1b4b 0%,#1a1a2e 100%)',
      border: '1px solid rgba(99,102,241,0.4)',
      borderRadius: 14,
      boxShadow: '0 20px 60px rgba(0,0,0,0.7), 0 0 0 1px rgba(99,102,241,0.2)',
      overflow: 'hidden',
      fontFamily: 'system-ui, sans-serif',
      userSelect: 'none',
    },
    header: {
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '10px 14px',
      background: 'linear-gradient(135deg,#4f46e5,#7c3aed)',
      cursor: 'grab',
      gap: 8,
    },
    body: { padding: '14px 14px 10px', display: 'flex', flexDirection: 'column', gap: 12 },
    label: { fontSize: 11, fontWeight: 700, color: 'rgba(199,210,254,0.8)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4, display: 'block' },
    input: { width: '100%', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(99,102,241,0.3)', borderRadius: 8, color: '#e0e7ff', fontSize: 13, padding: '7px 10px', outline: 'none', boxSizing: 'border-box' },
    iconBtn: (active) => ({
      flex: 1, padding: '6px 0', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: active ? 'rgba(99,102,241,0.5)' : 'rgba(255,255,255,0.06)',
      border: `1px solid ${active ? 'rgba(99,102,241,0.8)' : 'rgba(255,255,255,0.1)'}`,
      borderRadius: 7, cursor: 'pointer', color: active ? '#c4b5fd' : 'rgba(255,255,255,0.6)',
      transition: 'all 0.15s',
    }),
  }

  return (
    <div ref={panelRef} style={s.panel} data-cms-ui="true">
      {/* Header / drag handle */}
      <div style={s.header} onMouseDown={onMouseDown}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <GripHorizontal size={14} color="rgba(255,255,255,0.6)" />
          <Type size={13} color="#c4b5fd" />
          <span style={{ fontSize: 12, fontWeight: 700, color: 'white' }}>Edit Element</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 10, color: 'rgba(196,181,253,0.7)', background: 'rgba(0,0,0,0.2)', padding: '2px 7px', borderRadius: 10 }}>
            {selectedEl.key}
          </span>
          <button onClick={handleClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, color: 'rgba(255,255,255,0.7)', display: 'flex' }}>
            <X size={15} />
          </button>
        </div>
      </div>

      <div style={s.body}>
        {/* Text content */}
        <div>
          <span style={s.label}>Text Content</span>
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            rows={3}
            style={{ ...s.input, resize: 'vertical', lineHeight: '1.5' }}
          />
        </div>

        {/* Font size */}
        <div>
          <span style={s.label}>Font Size — {fontSize}px</span>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              type="range" min={8} max={96} value={fontSize}
              onChange={e => setFontSize(parseInt(e.target.value))}
              style={{ flex: 1, accentColor: '#6366f1' }}
            />
            <input
              type="number" min={8} max={200} value={fontSize}
              onChange={e => setFontSize(parseInt(e.target.value) || 16)}
              style={{ ...s.input, width: 60, textAlign: 'center', padding: '5px 6px' }}
            />
          </div>
        </div>

        {/* Font weight */}
        <div>
          <span style={s.label}>Font Weight</span>
          <select
            value={fontWeight}
            onChange={e => setFontWeight(e.target.value)}
            style={{ ...s.input, cursor: 'pointer' }}
          >
            {WEIGHTS.map(w => <option key={w.value} value={w.value} style={{ background: '#1e1b4b' }}>{w.label} ({w.value})</option>)}
          </select>
        </div>

        {/* Colors */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div>
            <span style={s.label}>Text Color</span>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <input type="color" value={color} onChange={e => setColor(e.target.value)}
                style={{ width: 36, height: 32, borderRadius: 6, border: '1px solid rgba(99,102,241,0.3)', cursor: 'pointer', background: 'none', padding: 2 }} />
              <input value={color} onChange={e => setColor(e.target.value)}
                style={{ ...s.input, flex: 1, padding: '5px 8px', fontSize: 12 }} />
            </div>
          </div>
          <div>
            <span style={s.label}>Background</span>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <input type="color" value={bgColor || '#000000'} onChange={e => setBgColor(e.target.value)}
                style={{ width: 36, height: 32, borderRadius: 6, border: '1px solid rgba(99,102,241,0.3)', cursor: 'pointer', background: 'none', padding: 2 }} />
              <input value={bgColor} onChange={e => setBgColor(e.target.value)}
                placeholder="none"
                style={{ ...s.input, flex: 1, padding: '5px 8px', fontSize: 12 }} />
            </div>
          </div>
        </div>

        {/* Text alignment */}
        <div>
          <span style={s.label}>Text Alignment</span>
          <div style={{ display: 'flex', gap: 6 }}>
            {[
              { val: 'left', icon: <AlignLeft size={14}/> },
              { val: 'center', icon: <AlignCenter size={14}/> },
              { val: 'right', icon: <AlignRight size={14}/> },
              { val: 'justify', icon: <AlignJustify size={14}/> },
            ].map(({ val, icon }) => (
              <button key={val} onClick={() => setTextAlign(val)} style={s.iconBtn(textAlign === val)}>{icon}</button>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 8, paddingTop: 4, borderTop: '1px solid rgba(255,255,255,0.07)', marginTop: 2 }}>
          <button
            onClick={handleReset}
            title="Remove all overrides for this element"
            style={{
              padding: '8px 12px', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 600,
              background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)',
              color: '#fca5a5', display: 'flex', alignItems: 'center', gap: 5,
            }}
          >
            <Trash2 size={12}/> Reset
          </button>
          <button
            onClick={handleClose}
            style={{
              flex: 1, padding: '8px 0', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 600,
              background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
              color: 'rgba(255,255,255,0.6)',
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              flex: 2, padding: '8px 0', borderRadius: 8, cursor: saving ? 'default' : 'pointer',
              fontSize: 12, fontWeight: 700,
              background: saved ? 'linear-gradient(135deg,#059669,#10b981)' : 'linear-gradient(135deg,#4f46e5,#7c3aed)',
              border: 'none', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              opacity: saving ? 0.7 : 1, transition: 'background 0.3s',
            }}
          >
            <Save size={12}/>
            {saving ? 'Saving...' : saved ? 'Saved!' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  )
}
