/**
 * CMSToolbar — C3-style draggable floating sidebar for admin.
 * Features:
 *   - Draggable (position saved to localStorage)
 *   - Collapse/expand with "Show Labels" (saved to localStorage)
 *   - Scroll-following
 *   - CMS Edit Mode toggle
 *   - Site Notification/Alert bar management
 * Completely isolated from social media features.
 */
import { useState, useRef, useEffect, useCallback } from 'react'
import { useCMS } from '../../context/CMSContext'
import {
  Edit3, Eye, CheckCircle, Save, Bell, GripVertical,
  ChevronRight, ChevronLeft, Type, Layers, EyeOff, RotateCcw, X,
  Plus, AlignLeft, Image, MousePointer, Minus, ChevronsUpDown, Settings,
} from 'lucide-react'
import FloatingEditor from './FloatingEditor'
import NotificationEditor from './NotificationEditor'

const LS_POS  = 'sw_cms_toolbar_pos'
const LS_EXPAND = 'sw_cms_toolbar_expand'

export default function CMSToolbar() {
  const { cmsMode, toggleCmsMode, saving, isAdmin, selectedEl, notification, hiddenComponents, showComponent, tagComponents, addPageBlock, toolbarOpen, setCmsToolbarOpen } = useCMS()
  const [expanded, setExpanded]     = useState(() => localStorage.getItem(LS_EXPAND) === '1')
  const [notifOpen, setNotifOpen]   = useState(false)
  const [compOpen, setCompOpen]     = useState(false)
  const [compLabels, setCompLabels] = useState({})
  const [blockOpen, setBlockOpen]   = useState(false)
  const [pos, setPos]               = useState(() => {
    try { return JSON.parse(localStorage.getItem(LS_POS)) || { top: 120, left: 8 } } catch { return { top: 120, left: 8 } }
  })

  const panelRef   = useRef(null)
  const dragState  = useRef({ dragging: false, startX: 0, startY: 0, origLeft: 0, origTop: 0 })
  const hasDragged = useRef(false)

  // ── Drag ────────────────────────────────────────────────────────────────
  const onGripMouseDown = useCallback((e) => {
    if (e.button !== 0) return
    const rect = panelRef.current?.getBoundingClientRect()
    if (!rect) return
    dragState.current = { dragging: true, startX: e.clientX, startY: e.clientY, origLeft: rect.left, origTop: rect.top }
    hasDragged.current = true
    e.preventDefault()
  }, [])

  useEffect(() => {
    const onMove = (e) => {
      if (!dragState.current.dragging) return
      const left = Math.max(0, Math.min(window.innerWidth - 60, dragState.current.origLeft + e.clientX - dragState.current.startX))
      const top  = Math.max(0, dragState.current.origTop + e.clientY - dragState.current.startY)
      setPos({ left, top })
    }
    const onUp = (e) => {
      if (!dragState.current.dragging) return
      dragState.current.dragging = false
      const rect = panelRef.current?.getBoundingClientRect()
      if (rect) {
        const p = { left: rect.left, top: rect.top }
        localStorage.setItem(LS_POS, JSON.stringify(p))
      }
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
  }, [])

  // ── Scroll-follow (when not manually dragged far) ─────────────────────
  useEffect(() => {
    const onScroll = () => {
      if (hasDragged.current) return
      setPos(p => ({ ...p, top: Math.max(80, window.scrollY + 120) }))
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // ── Expand toggle ────────────────────────────────────────────────────
  const toggleExpand = () => {
    setExpanded(e => {
      const next = !e
      localStorage.setItem(LS_EXPAND, next ? '1' : '0')
      return next
    })
  }

  // Collect labels for all known hidden component keys
  useEffect(() => {
    if (!compOpen) return
    // Re-tag so we have fresh data-cms-component attributes
    const tagged = tagComponents()
    const map = {}
    tagged.forEach(({ key, label }) => { map[key] = label })
    // Also populate any hidden ones that may no longer be in DOM
    hiddenComponents.forEach(k => { if (!map[k]) map[k] = k })
    setCompLabels(map)
  }, [compOpen, hiddenComponents, tagComponents])

  if (!isAdmin) return null

  // Master switch is OFF — render nothing but a tiny floating pill admins
  // can click to open the CMS toolbar. This way pages stay clean by default
  // and CMS UI only appears when explicitly summoned.
  if (!toolbarOpen) {
    return (
      <button
        data-cms-ui="true"
        onClick={() => setCmsToolbarOpen(true)}
        title="Open CMS toolbar"
        style={{
          position: 'fixed', left: 12, bottom: 12, zIndex: 9998,
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '7px 12px', borderRadius: 999,
          background: 'rgba(15,10,40,0.92)', color: 'rgba(196,181,253,0.85)',
          border: '1px solid rgba(99,102,241,0.4)',
          boxShadow: '0 4px 18px rgba(0,0,0,0.5)',
          backdropFilter: 'blur(12px)', cursor: 'pointer',
          fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        <Settings size={12}/> CMS
      </button>
    )
  }

  const w = expanded ? 220 : 50

  const iconBtn = (active, onClick, icon, label, badge) => (
    <button
      onClick={onClick}
      title={label}
      style={{
        display: 'flex', alignItems: 'center', gap: expanded ? 10 : 0,
        width: '100%', padding: expanded ? '8px 12px' : '10px 0',
        justifyContent: expanded ? 'flex-start' : 'center',
        background: active ? 'rgba(99,102,241,0.25)' : 'transparent',
        border: `1px solid ${active ? 'rgba(99,102,241,0.6)' : 'transparent'}`,
        borderRadius: 8, cursor: 'pointer', color: active ? '#c4b5fd' : 'rgba(255,255,255,0.65)',
        fontSize: 12, fontWeight: 600, position: 'relative', transition: 'all 0.15s',
        whiteSpace: 'nowrap', overflow: 'hidden',
      }}
    >
      <span style={{ flexShrink: 0, display: 'flex', alignItems: 'center' }}>{icon}</span>
      {expanded && <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</span>}
      {badge && (
        <span style={{ position: expanded ? 'relative' : 'absolute', top: expanded ? 0 : 4, right: expanded ? 0 : 4, width: 7, height: 7, borderRadius: '50%', background: '#10b981', flexShrink: 0 }} />
      )}
    </button>
  )

  return (
    <>
      {/* ── Floating sidebar ── */}
      <div
        ref={panelRef}
        data-cms-ui="true"
        style={{
          position: 'fixed',
          left: pos.left,
          top: pos.top,
          width: w,
          zIndex: 9998,
          background: 'rgba(15,10,40,0.96)',
          border: '1px solid rgba(99,102,241,0.35)',
          borderRadius: 12,
          boxShadow: cmsMode
            ? '0 0 0 2px rgba(99,102,241,0.4), 0 8px 32px rgba(0,0,0,0.6)'
            : '0 4px 24px rgba(0,0,0,0.5)',
          backdropFilter: 'blur(16px)',
          overflow: 'visible',
          transition: 'width 0.2s ease, box-shadow 0.3s ease',
          userSelect: 'none',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        {/* Drag grip */}
        <div
          onMouseDown={onGripMouseDown}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: expanded ? 'space-between' : 'center',
            padding: expanded ? '8px 12px' : '8px 0',
            borderBottom: '1px solid rgba(255,255,255,0.07)',
            cursor: 'grab',
            gap: 6,
          }}
        >
          <GripVertical size={14} color="rgba(99,102,241,0.7)" />
          {expanded && (
            <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.1em', color: 'rgba(196,181,253,0.7)', textTransform: 'uppercase' }}>
              CMS
            </span>
          )}
          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            <button
              onClick={toggleExpand}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.4)', display: 'flex', padding: 0 }}
              title={expanded ? 'Collapse' : 'Expand'}
            >
              {expanded ? <ChevronLeft size={13}/> : <ChevronRight size={13}/>}
            </button>
            <button
              onMouseDown={e => e.stopPropagation()}
              onClick={(e) => { e.stopPropagation(); setCmsToolbarOpen(false) }}
              style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', cursor: 'pointer', color: '#fca5a5', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 2, borderRadius: 4 }}
              title="Hide CMS toolbar"
            >
              <X size={11}/>
            </button>
          </div>
        </div>

        {/* Section: Edit */}
        <div style={{ padding: expanded ? '8px 8px 4px' : '8px 6px 4px' }}>
          {expanded && (
            <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(99,102,241,0.6)', letterSpacing: '0.08em', textTransform: 'uppercase', paddingLeft: 4, marginBottom: 4 }}>
              Edit
            </div>
          )}
          {iconBtn(
            cmsMode, toggleCmsMode,
            cmsMode ? <Eye size={15}/> : <Edit3 size={15}/>,
            cmsMode ? 'Exit Edit Mode' : 'Enter Edit Mode',
          )}
          {cmsMode && iconBtn(
            false, null,
            saving ? <Save size={15}/> : <CheckCircle size={15}/>,
            saving ? 'Saving...' : 'Auto-saved',
          )}
          {cmsMode && selectedEl && iconBtn(
            true, null,
            <Type size={15}/>,
            'Editing element…',
          )}
        </div>

        {/* Divider */}
        <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: '0 8px' }} />

        {/* Section: Tools */}
        <div style={{ padding: expanded ? '4px 8px 4px' : '4px 6px 4px' }}>
          {expanded && (
            <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(99,102,241,0.6)', letterSpacing: '0.08em', textTransform: 'uppercase', paddingLeft: 4, marginBottom: 4 }}>
              Tools
            </div>
          )}
          {iconBtn(
            notifOpen,
            () => setNotifOpen(o => !o),
            <Bell size={15}/>,
            'Notification Bar',
            notification?.enabled,
          )}
        </div>

        {/* Divider */}
        <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: '0 8px' }} />

        {/* Section: Components */}
        <div style={{ padding: expanded ? '4px 8px 4px' : '4px 6px 4px' }}>
          {expanded && (
            <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(99,102,241,0.6)', letterSpacing: '0.08em', textTransform: 'uppercase', paddingLeft: 4, marginBottom: 4 }}>
              Components
            </div>
          )}
          {iconBtn(
            compOpen,
            () => setCompOpen(o => !o),
            <Layers size={15}/>,
            'Hidden Sections',
            hiddenComponents.length > 0,
          )}
        </div>

        {/* Divider */}
        <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: '0 8px' }} />

        {/* Section: Add Block */}
        <div style={{ padding: expanded ? '4px 8px 8px' : '4px 6px 8px' }}>
          {expanded && (
            <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(99,102,241,0.6)', letterSpacing: '0.08em', textTransform: 'uppercase', paddingLeft: 4, marginBottom: 4 }}>
              Insert
            </div>
          )}
          {iconBtn(
            blockOpen,
            () => setBlockOpen(o => !o),
            <Plus size={15}/>,
            'Add Block',
          )}
        </div>
      </div>

      {/* Floating element editor */}
      {cmsMode && <FloatingEditor />}

      {/* Notification editor panel */}
      {notifOpen && <NotificationEditor onClose={() => setNotifOpen(false)} />}

      {/* Block inserter panel */}
      {blockOpen && (
        <div
          data-cms-ui="true"
          style={{
            position: 'fixed',
            top: pos.top,
            left: (pos.left + (expanded ? 230 : 60)),
            width: 280,
            zIndex: 9999,
            background: 'rgba(15,10,40,0.97)',
            border: '1px solid rgba(99,102,241,0.4)',
            borderRadius: 12,
            boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
            backdropFilter: 'blur(16px)',
            fontFamily: 'system-ui, sans-serif',
            overflow: 'hidden',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Plus size={14} color="#c4b5fd"/>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#c4b5fd' }}>Insert Block</span>
            </div>
            <button onClick={() => setBlockOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.4)', display: 'flex', padding: 2 }}>
              <X size={13}/>
            </button>
          </div>
          <div style={{ padding: 10, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {[
              { type: 'heading', label: 'Heading', icon: <Type size={18}/>, color: '#818cf8', defaultContent: { text: 'New Heading', level: '2' } },
              { type: 'text', label: 'Text', icon: <AlignLeft size={18}/>, color: '#34d399', defaultContent: { html: '<p>Add your text here. You can use <strong>bold</strong> and <em>italic</em>.</p>' } },
              { type: 'image', label: 'Image', icon: <Image size={18}/>, color: '#60a5fa', defaultContent: { src: '', alt: 'Image', width: '100%', borderRadius: '8px' } },
              { type: 'button', label: 'Button', icon: <MousePointer size={18}/>, color: '#f472b6', defaultContent: { text: 'Click Here', href: '#', align: 'left' } },
              { type: 'divider', label: 'Divider', icon: <Minus size={18}/>, color: '#94a3b8', defaultContent: { color: 'var(--border)' } },
              { type: 'spacer', label: 'Spacer', icon: <ChevronsUpDown size={18}/>, color: '#a78bfa', defaultContent: { height: '32px' } },
            ].map(({ type, label, icon, color, defaultContent }) => (
              <button
                key={type}
                onClick={async () => { await addPageBlock(type, defaultContent); setBlockOpen(false) }}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  gap: 8, padding: '14px 8px',
                  background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 10, cursor: 'pointer', color,
                  transition: 'all 0.15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(99,102,241,0.15)'; e.currentTarget.style.borderColor = 'rgba(99,102,241,0.4)' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)' }}
              >
                {icon}
                <span style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.65)' }}>{label}</span>
              </button>
            ))}
          </div>
          <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', textAlign: 'center', padding: '0 14px 10px', margin: 0 }}>
            Blocks appear at the bottom of this page for all users.
          </p>
        </div>
      )}

      {/* Hidden components manager */}
      {compOpen && (
        <div
          data-cms-ui="true"
          style={{
            position: 'fixed',
            top: pos.top,
            left: (pos.left + (expanded ? 230 : 60)),
            width: 300,
            zIndex: 9999,
            background: 'rgba(15,10,40,0.97)',
            border: '1px solid rgba(99,102,241,0.4)',
            borderRadius: 12,
            boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
            backdropFilter: 'blur(16px)',
            fontFamily: 'system-ui, sans-serif',
            overflow: 'hidden',
          }}
        >
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <EyeOff size={14} color="#c4b5fd"/>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#c4b5fd' }}>Hidden Sections</span>
            </div>
            <button onClick={() => setCompOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.4)', display: 'flex', padding: 2 }}>
              <X size={13}/>
            </button>
          </div>

          {/* Body */}
          <div style={{ padding: '8px 10px', maxHeight: 360, overflowY: 'auto' }}>
            {hiddenComponents.length === 0 ? (
              <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', textAlign: 'center', padding: '16px 0', margin: 0 }}>
                No hidden sections on this page.
              </p>
            ) : (
              hiddenComponents.map(key => (
                <div key={key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '6px 8px', borderRadius: 8, marginBottom: 4, background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.2)' }}>
                  <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {compLabels[key] || key}
                  </span>
                  <button
                    onClick={async () => { await showComponent(key) }}
                    title="Restore this section"
                    style={{ background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.4)', borderRadius: 6, cursor: 'pointer', padding: '3px 8px', color: '#6ee7b7', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}
                  >
                    <RotateCcw size={10}/> Restore
                  </button>
                </div>
              ))
            )}
          </div>

          {hiddenComponents.length > 0 && (
            <div style={{ padding: '6px 10px 10px' }}>
              <button
                onClick={async () => { for (const k of hiddenComponents) await showComponent(k) }}
                style={{ width: '100%', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: 8, cursor: 'pointer', padding: '7px 12px', color: '#6ee7b7', fontSize: 11, fontWeight: 700 }}
              >
                Restore All Sections
              </button>
            </div>
          )}
        </div>
      )}
    </>
  )
}
