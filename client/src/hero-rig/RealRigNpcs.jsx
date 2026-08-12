/**
 * RealRigNpcs — thin React wrapper that mounts the isolated three.js overlay
 * (realRigScene) on a transparent canvas layered over the hero, between the
 * 2D scene canvas and the DOM headline/buttons. Pointer-events are disabled so
 * it never intercepts clicks. Rendered ONLY when USE_REAL_RIG_NPCS is true.
 */
import { useEffect, useRef } from 'react'
import { mountRealRig } from './realRigScene'

export default function RealRigNpcs({ className = '' }) {
  const ref = useRef(null)
  useEffect(() => {
    if (!ref.current) return
    let cleanup = () => {}
    try {
      cleanup = mountRealRig(ref.current, {
        assetUrl: `${import.meta.env.BASE_URL || '/'}rig-assets/RobotExpressive.glb`,
        onError: (e) => console.warn('[real-rig] asset load failed:', e),
      })
    } catch (e) {
      console.warn('[real-rig] mount failed:', e)
    }
    return () => cleanup()
  }, [])

  return (
    <canvas
      ref={ref}
      className={className}
      aria-hidden="true"
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 2 }}
    />
  )
}
