/**
 * NibiSpline — embeds the Nibi 3D scene from Spline.design
 *
 * HOW TO USE:
 *   1. Designer publishes Nibi from Spline → gets a URL like:
 *      https://prod.spline.design/xxxxxxxx/scene.splinecode
 *   2. Set VITE_NIBI_SPLINE_URL in your .env / Render env var
 *   3. <NibiSpline size={300} />
 *
 * Spline scenes are fully interactive 3D — drag to rotate, animations,
 * hover states — looks exactly like the reference render.
 */
import Spline from '@splinetool/react-spline'
import NibiMascot from './NibiMascot'
import { Suspense } from 'react'

const SPLINE_URL = import.meta.env.VITE_NIBI_SPLINE_URL || null

export default function NibiSpline({ size = 300, style = {} }) {
  if (!SPLINE_URL) {
    return (
      <div style={{ position: 'relative', display: 'inline-block', ...style }}>
        <NibiMascot mood="idle" size={size} autoMood showShadow/>
        <div style={{
          position: 'absolute', bottom: 4, left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(99,102,241,0.9)', color: 'white', fontSize: 9, fontWeight: 700,
          padding: '2px 8px', borderRadius: 20, whiteSpace: 'nowrap',
        }}>
          Set VITE_NIBI_SPLINE_URL to activate 3D
        </div>
      </div>
    )
  }

  return (
    <div style={{ width: size, height: size * 1.2, ...style }}>
      <Suspense fallback={<NibiMascot mood="idle" size={size} showShadow/>}>
        <Spline scene={SPLINE_URL} style={{ width: '100%', height: '100%' }}/>
      </Suspense>
    </div>
  )
}
