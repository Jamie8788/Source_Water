/**
 * CMSComponentLayer — In CMS edit mode, detects all major sections on the page
 * and renders hover overlays with Delete (hide) button.
 * Hidden components are saved to Supabase and hidden for ALL users.
 */
import { useState, useEffect, useCallback, useRef } from 'react'
import { useCMS } from '../../context/CMSContext'
import { EyeOff, Move, ChevronUp, ChevronDown } from 'lucide-react'

export default function CMSComponentLayer() {
  const { cmsMode, hideComponent, tagComponents, hiddenComponents } = useCMS()
  const [components, setComponents] = useState([])
  const [hovered, setHovered] = useState(null)
  const rafRef = useRef(null)

  // Tag all components and build list
  const refresh = useCallback(() => {
    if (!cmsMode) return
    const tagged = tagComponents()
    setComponents(tagged.map(({ key, label, el }) => {
      const rect = el.getBoundingClientRect()
      return { key, label, rect: { top: rect.top + window.scrollY, left: rect.left + window.scrollX, width: rect.width, height: rect.height } }
    }))
  }, [cmsMode, tagComponents])

  useEffect(() => {
    if (!cmsMode) { setComponents([]); return }
    const timer = setTimeout(refresh, 300)
    window.addEventListener('resize', refresh)
    window.addEventListener('scroll', refresh, { passive: true })
    return () => { clearTimeout(timer); window.removeEventListener('resize', refresh); window.removeEventListener('scroll', refresh) }
  }, [cmsMode, refresh])

  if (!cmsMode || components.length === 0) return null

  return (
    <>
      {components.map(({ key, label, rect }) => {
        const isHidden = hiddenComponents.includes(key)
        const isHov = hovered === key
        if (isHidden) return null

        return (
          <div
            key={key}
            data-cms-ui="true"
            onMouseEnter={() => setHovered(key)}
            onMouseLeave={() => setHovered(null)}
            style={{
              position: 'absolute',
              top: rect.top,
              left: rect.left,
              width: rect.width,
              height: rect.height,
              zIndex: 9990,
              pointerEvents: isHov ? 'auto' : 'none',
              border: isHov ? '2px dashed rgba(99,102,241,0.5)' : '2px dashed transparent',
              borderRadius: 8,
              transition: 'border-color 0.15s',
              boxSizing: 'border-box',
            }}
          >
            {isHov && (
              <div
                data-cms-ui="true"
                style={{
                  position: 'absolute',
                  top: 6,
                  right: 10,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  zIndex: 9991,
                  background: 'rgba(15,10,40,0.95)',
                  border: '1px solid rgba(99,102,241,0.4)',
                  borderRadius: 8,
                  padding: '4px 8px',
                  boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
                  pointerEvents: 'auto',
                }}
              >
                <span style={{ fontSize: 11, fontWeight: 600, color: 'rgba(196,181,253,0.8)', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {label}
                </span>
                <div style={{ width: 1, height: 14, background: 'rgba(255,255,255,0.1)' }} />
                <button
                  onClick={async (e) => { e.stopPropagation(); await hideComponent(key); setHovered(null); setComponents(c => c.filter(x => x.key !== key)) }}
                  title="Hide this section (admin can restore)"
                  style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.4)', borderRadius: 6, cursor: 'pointer', padding: '3px 8px', color: '#fca5a5', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}
                >
                  <EyeOff size={11}/> Hide
                </button>
              </div>
            )}
          </div>
        )
      })}
    </>
  )
}
