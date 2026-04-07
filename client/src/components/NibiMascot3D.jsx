/**
 * NibiMascot3D — loads the real 3D Nibi GLB model from SandroC Design
 *
 * HOW TO USE once you have the file from SandroC:
 *   1. Put nibi.glb in /public/nibi.glb
 *   2. <NibiMascot3D mood="wave" size={300} />
 *
 * The designer should export from Blender/Cinema4D as:
 *   - Format: GLB (binary GLTF)
 *   - Include: mesh + armature (skeleton) + animations
 *   - Animation clips named: "idle", "wave", "laugh", "blush", "umbrella"
 *
 * Until the GLB arrives, shows the SVG Nibi as placeholder.
 */
import { Suspense, useRef, useEffect } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { useGLTF, useAnimations, OrbitControls, Environment, ContactShadows, Float } from '@react-three/drei'
import NibiMascot from './NibiMascot'

// ── Check if GLB exists ──────────────────────────────────────────────────────
const GLB_URL = '/nibi.glb'

// ── 3D model component ───────────────────────────────────────────────────────
function NibiModel({ mood = 'idle', scale = 1 }) {
  const group = useRef()
  const { scene, animations } = useGLTF(GLB_URL)
  const { actions, names } = useAnimations(animations, group)

  // Map mood → animation clip name (designer names these in Blender)
  const clipMap = {
    idle:      'idle',
    happy:     'happy',
    laugh:     'laugh',
    wave:      'wave',
    blush:     'blush',
    umbrella:  'umbrella',
    surprised: 'surprised',
    thinking:  'thinking',
  }

  useEffect(() => {
    const clip = clipMap[mood] || 'idle'
    // Stop all, play the right one
    Object.values(actions).forEach(a => a?.fadeOut(0.3))
    const action = actions[clip] || actions[names[0]]
    if (action) {
      action.reset().fadeIn(0.3).play()
    }
  }, [mood, actions, names])

  // Subtle idle rotation if no animation
  useFrame((state) => {
    if (group.current && (!names.length)) {
      group.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.4) * 0.15
    }
  })

  return (
    <group ref={group} scale={scale} dispose={null}>
      <primitive object={scene}/>
    </group>
  )
}

// Preload for performance
useGLTF.preload(GLB_URL)

// ── Canvas wrapper ────────────────────────────────────────────────────────────
function Nibi3DCanvas({ mood, size, orbitControls }) {
  return (
    <Canvas
      style={{ width: size, height: size * 1.3 }}
      camera={{ position: [0, 0.5, 3], fov: 40 }}
      gl={{ antialias: true, alpha: true }}
    >
      {/* Lighting to match the reference render */}
      <ambientLight intensity={0.6}/>
      <directionalLight position={[2, 4, 3]} intensity={1.2} castShadow/>
      <directionalLight position={[-2, 1, -1]} intensity={0.3} color="#b8d4f0"/>
      <pointLight position={[0, -1, 2]} intensity={0.4} color="#ff9ab4"/>

      {/* Soft studio environment */}
      <Environment preset="studio"/>

      {/* Floating animation */}
      <Float speed={2} rotationIntensity={0.1} floatIntensity={0.5}>
        <Suspense fallback={null}>
          <NibiModel mood={mood} scale={1}/>
        </Suspense>
      </Float>

      {/* Ground shadow */}
      <ContactShadows
        position={[0, -1.4, 0]}
        opacity={0.35}
        scale={3}
        blur={2}
        far={4}
      />

      {/* Optional orbit controls (multiple angles) */}
      {orbitControls && (
        <OrbitControls
          enableZoom={false}
          enablePan={false}
          minPolarAngle={Math.PI / 4}
          maxPolarAngle={Math.PI / 1.8}
        />
      )}
    </Canvas>
  )
}

// ── Public component ──────────────────────────────────────────────────────────
export default function NibiMascot3D({
  mood = 'idle',
  size = 200,
  orbitControls = false, // set true for drag-to-rotate (multiple angles)
  style = {},
  onClick,
}) {
  // Check if GLB exists by attempting to load it
  // Falls back to SVG NibiMascot if /nibi.glb not found
  const hasGLB = window.__nibi_glb_ready ?? false

  if (!hasGLB) {
    // Placeholder — SVG Nibi until real 3D file arrives
    return (
      <div style={{ position: 'relative', display: 'inline-block', ...style }} onClick={onClick}>
        <NibiMascot mood={mood} size={size} showShadow autoMood={false}/>
        <div style={{
          position: 'absolute', bottom: 0, left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(99,102,241,0.9)', color: 'white', fontSize: 9, fontWeight: 700,
          padding: '2px 8px', borderRadius: 20, whiteSpace: 'nowrap', pointerEvents: 'none',
        }}>
          3D model pending
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'inline-block', cursor: orbitControls ? 'grab' : onClick ? 'pointer' : 'default', ...style }} onClick={onClick}>
      <Nibi3DCanvas mood={mood} size={size} orbitControls={orbitControls}/>
    </div>
  )
}
