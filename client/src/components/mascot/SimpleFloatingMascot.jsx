import { useState } from 'react'
import NibiMascotImage from '../NibiMascotImage'

// Simple, low-impact floating mascot — static Water_Mascot_Talking image with a slight
// float motion (no full animation loop). Replaces the old WaterMascot / WaterMascotGLB
// per feedback item 71: "For now, we should only use the static image Water_Mascot_Talking,
// and have it floating (slight motion, not full animation)."
export default function SimpleFloatingMascot() {
  const [hidden, setHidden] = useState(false)
  if (hidden) return null
  return (
    <div
      style={{
        position: 'fixed',
        bottom: 18,
        right: 80,
        zIndex: 40,
        pointerEvents: 'auto',
        animation: 'swFloat 5s ease-in-out infinite',
      }}
    >
      <button
        onClick={() => setHidden(true)}
        title="Hide mascot"
        aria-label="Hide mascot"
        style={{
          position: 'absolute',
          top: -4,
          right: -4,
          width: 20,
          height: 20,
          borderRadius: '50%',
          border: '1px solid rgba(255,255,255,0.3)',
          background: 'rgba(0,0,0,0.55)',
          color: '#fff',
          fontSize: 11,
          lineHeight: '16px',
          cursor: 'pointer',
          padding: 0,
          zIndex: 2,
        }}
      >
        ×
      </button>
      <div style={{ filter: 'drop-shadow(0 8px 20px rgba(99,102,241,0.35))' }}>
        <NibiMascotImage mood="talking" size={96} />
      </div>
      <style>{`
        @keyframes swFloat {
          0%,100% { transform: translateY(0) }
          50%     { transform: translateY(-6px) }
        }
      `}</style>
    </div>
  )
}
