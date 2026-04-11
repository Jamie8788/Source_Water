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
  ChevronRight, ChevronLeft, Type,
} from 'lucide-react'
import FloatingEditor from './FloatingEditor'
import NotificationEditor from './NotificationEditor'

const LS_POS  = 'sw_cms_toolbar_pos'
const LS_EXPAND = 'sw_cms_toolbar_expand'

export default function CMSToolbar() {
  const { cmsMode, toggleCmsMode, saving, isAdmin, selectedEl, notification } = useCMS()
  const [expanded, setExpanded]     = useState(() => localStorage.getItem(LS_EXPAND) === '1')
  const [notifOpen, setNotifOpen]   = useState(false)
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

  if (!isAdmin) return null

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
          <button
            onClick={toggleExpand}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.4)', display: 'flex', padding: 0 }}
            title={expanded ? 'Collapse' : 'Expand'}
          >
            {expanded ? <ChevronLeft size={13}/> : <ChevronRight size={13}/>}
          </button>
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
        <div style={{ padding: expanded ? '4px 8px 8px' : '4px 6px 8px' }}>
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
      </div>

      {/* Floating element editor */}
      {cmsMode && <FloatingEditor />}

      {/* Notification editor panel */}
      {notifOpen && <NotificationEditor onClose={() => setNotifOpen(false)} />}
    </>
  )
}
