import { useCMS } from '../../context/CMSContext'
import { Edit3, Eye, Save, CheckCircle } from 'lucide-react'
import FloatingEditor from './FloatingEditor'

export default function CMSToolbar() {
  const { cmsMode, toggleCmsMode, saving, isAdmin } = useCMS()
  if (!isAdmin) return null

  return (
    <>
      {/* Top bar */}
      <div
        data-cms-ui="true"
        style={{
          position: 'fixed',
          top: 0,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '6px 16px',
          borderRadius: '0 0 12px 12px',
          background: cmsMode ? 'linear-gradient(135deg,#4f46e5,#7c3aed)' : 'rgba(15,12,41,0.9)',
          boxShadow: cmsMode ? '0 4px 24px rgba(99,102,241,0.5)' : '0 2px 12px rgba(0,0,0,0.3)',
          border: '1px solid rgba(99,102,241,0.3)',
          backdropFilter: 'blur(12px)',
          transition: 'all 0.3s ease',
          color: 'white',
          fontSize: 13,
          fontWeight: 600,
          userSelect: 'none',
        }}
      >
        {cmsMode ? (
          <>
            <Edit3 size={14} style={{ color: '#c4b5fd' }}/>
            <span style={{ color: '#e0d9ff' }}>CMS Edit Mode</span>
            <span style={{ fontSize: 11, color: '#a78bfa', background: 'rgba(255,255,255,0.1)', padding: '1px 8px', borderRadius: 20 }}>
              Click any text to edit
            </span>
            {saving && (
              <span style={{ fontSize: 11, color: '#86efac', display: 'flex', alignItems: 'center', gap: 4 }}>
                <Save size={11}/> Saving...
              </span>
            )}
            {!saving && (
              <span style={{ fontSize: 11, color: '#86efac', display: 'flex', alignItems: 'center', gap: 4 }}>
                <CheckCircle size={11}/> Auto-saved
              </span>
            )}
            <button
              onClick={toggleCmsMode}
              style={{
                marginLeft: 8,
                background: 'rgba(255,255,255,0.15)',
                border: '1px solid rgba(255,255,255,0.3)',
                color: 'white',
                borderRadius: 8,
                padding: '3px 12px',
                cursor: 'pointer',
                fontSize: 12,
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <Eye size={12}/> Exit Edit Mode
            </button>
          </>
        ) : (
          <button
            onClick={toggleCmsMode}
            style={{
              background: 'none',
              border: 'none',
              color: '#a78bfa',
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: 0,
            }}
          >
            <Edit3 size={12}/> Enter CMS Edit Mode
          </button>
        )}
      </div>

      {/* Floating element editor — renders when an element is selected */}
      {cmsMode && <FloatingEditor />}
    </>
  )
}
