/**
 * NibiMascot3D — Full 3D Nibi built entirely in code, zero external files.
 * Fluffy blue water-drop character with big lashed eyes, pink boots, cheeks.
 * 8 moods with smooth animations. Drag to rotate.
 */
import { Canvas, useFrame } from '@react-three/fiber'
import { Float, ContactShadows, Environment, OrbitControls, useGLTF } from '@react-three/drei'
import { useRef, useState, useEffect, useMemo, Suspense } from 'react'
import * as THREE from 'three'

// ── Plush / velvet shader ────────────────────────────────────────────────────
const plushVert = /* glsl */`
  varying vec3 vNormal;
  varying vec3 vViewDir;
  void main() {
    vNormal = normalize(normalMatrix * normal);
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vViewDir = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }
`
const plushFrag = /* glsl */`
  uniform vec3  uColor;
  uniform vec3  uRimColor;
  uniform float uRimPower;
  varying vec3  vNormal;
  varying vec3  vViewDir;
  void main() {
    vec3  n       = normalize(vNormal);
    vec3  v       = normalize(vViewDir);
    vec3  key     = normalize(vec3(-1.2, 2.5, 1.8));
    vec3  fill    = normalize(vec3( 1.5, 0.3,-0.5));

    float d       = max(dot(n, key),  0.0) * 0.70;
    float f       = max(dot(n, fill), 0.0) * 0.25;
    float ambient = 0.28;

    // velvet rim — edges glow (signature plush look)
    float rim     = pow(1.0 - max(dot(v, n), 0.0), uRimPower);

    // top softness
    float top     = pow(max(dot(n, vec3(0,1,0.3)), 0.0), 2.0) * 0.18;

    float light   = d + f + ambient + top;
    vec3  col     = uColor * light + uRimColor * rim * 0.35;
    gl_FragColor  = vec4(col, 1.0);
  }
`

function usePlushMat(color = '#8BBDE0', rimColor = '#C8E8FA', rimPower = 3.2) {
  return useMemo(() => new THREE.ShaderMaterial({
    uniforms: {
      uColor:    { value: new THREE.Color(color) },
      uRimColor: { value: new THREE.Color(rimColor) },
      uRimPower: { value: rimPower },
    },
    vertexShader:   plushVert,
    fragmentShader: plushFrag,
    side: THREE.FrontSide,
  }), [color, rimColor, rimPower])
}

// ── Eyelashes (5 thin boxes fanning above each eye) ─────────────────────────
function Lashes({ flip = false }) {
  const lashColor = '#1A2535'
  const positions = [-0.14, -0.07, 0, 0.07, 0.14]
  const rotations = [-0.45, -0.22, 0, 0.22, 0.45]
  return (
    <group scale={[flip ? -1 : 1, 1, 1]}>
      {positions.map((x, i) => (
        <mesh key={i} position={[x, 0.28, 0.01]} rotation={[0, 0, rotations[i]]}>
          <boxGeometry args={[0.025, 0.14, 0.01]}/>
          <meshStandardMaterial color={lashColor} roughness={0.6}/>
        </mesh>
      ))}
    </group>
  )
}

// ── One eye ──────────────────────────────────────────────────────────────────
function Eye({ blink, flip }) {
  const scaleY = blink ? 0.08 : 1
  return (
    <group>
      {/* white */}
      <mesh scale={[1, scaleY, 1]}>
        <sphereGeometry args={[0.28, 32, 32]}/>
        <meshStandardMaterial color="white" roughness={0.08} metalness={0.1}/>
      </mesh>
      {!blink && <>
        {/* iris */}
        <mesh position={[0, 0.02, 0.22]}>
          <sphereGeometry args={[0.17, 32, 32]}/>
          <meshStandardMaterial color="#253040" roughness={0.05} metalness={0.25}/>
        </mesh>
        {/* pupil */}
        <mesh position={[0, 0.02, 0.33]}>
          <sphereGeometry args={[0.09, 16, 16]}/>
          <meshStandardMaterial color="#07090F" roughness={0.1}/>
        </mesh>
        {/* large highlight */}
        <mesh position={[0.07, 0.09, 0.38]}>
          <sphereGeometry args={[0.055, 8, 8]}/>
          <meshStandardMaterial color="white" emissive="white" emissiveIntensity={0.8}/>
        </mesh>
        {/* small highlight */}
        <mesh position={[-0.06,-0.04, 0.35]}>
          <sphereGeometry args={[0.027, 8, 8]}/>
          <meshStandardMaterial color="white" emissive="white" emissiveIntensity={0.5} transparent opacity={0.7}/>
        </mesh>
        {/* lashes */}
        <group position={[0, 0.22, 0.2]}>
          <Lashes flip={flip}/>
        </group>
        {/* lower lash shadow */}
        <mesh position={[0,-0.22,0.15]} rotation={[0,0,0]} scale={[1,0.03,1]}>
          <sphereGeometry args={[0.28,16,8]}/>
          <meshStandardMaterial color="#253040" transparent opacity={0.25} roughness={1}/>
        </mesh>
      </>}
    </group>
  )
}

// ── Boot (leg + boot + sole + white rim) ─────────────────────────────────────
function Boot({ side = 1 }) {
  const bootMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#E8799A', roughness: 0.35, metalness: 0.06,
  }), [])
  const darkMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#C4507A', roughness: 0.45, metalness: 0.05,
  }), [])
  return (
    <group position={[side * 0.42, -1.12, 0]}>
      {/* leg stub */}
      <mesh material={bootMat}>
        <capsuleGeometry args={[0.19, 0.28, 8, 16]}/>
      </mesh>
      {/* boot upper */}
      <mesh position={[0, -0.32, 0.04]} material={bootMat} castShadow>
        <capsuleGeometry args={[0.21, 0.32, 8, 16]}/>
      </mesh>
      {/* white cuff */}
      <mesh position={[0, -0.1, 0.04]}>
        <torusGeometry args={[0.22, 0.045, 8, 28]}/>
        <meshStandardMaterial color="white" roughness={0.55} transparent opacity={0.85}/>
      </mesh>
      {/* sole */}
      <mesh position={[side * 0.03, -0.6, 0.1]} scale={[1.35, 0.22, 1.55]} castShadow material={darkMat}>
        <sphereGeometry args={[0.22, 16, 8]}/>
      </mesh>
    </group>
  )
}

// ── Arm ──────────────────────────────────────────────────────────────────────
function Arm({ bodyMat, side = 1, rotation = [0, 0, 0] }) {
  return (
    <group position={[side * 1.05, 0.05, 0.1]} rotation={rotation}>
      <mesh castShadow material={bodyMat}>
        <capsuleGeometry args={[0.19, 0.44, 8, 16]}/>
      </mesh>
      {/* hand nub */}
      <mesh position={[0, side * -0.38, 0]} material={bodyMat}>
        <sphereGeometry args={[0.19, 16, 16]}/>
      </mesh>
    </group>
  )
}

// ── Main character ───────────────────────────────────────────────────────────
function NibiCharacter({ mood }) {
  const bodyRef      = useRef()
  const rightArmRef  = useRef()
  const leftArmRef   = useRef()
  const [blink, setBlink] = useState(false)

  // Blink timer
  useEffect(() => {
    const tick = () => {
      setBlink(true)
      setTimeout(() => setBlink(false), 160)
    }
    const id = setInterval(tick, 3200 + Math.random() * 2000)
    return () => clearInterval(id)
  }, [])

  const bodyMat = usePlushMat('#8BBDE0', '#C8E8FA', 3.2)

  // Frame-level animation
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    if (!rightArmRef.current) return

    if (mood === 'wave') {
      rightArmRef.current.rotation.z = -0.3 + Math.sin(t * 4.5) * 0.65
    } else if (mood === 'happy') {
      rightArmRef.current.rotation.z = -0.3 + Math.sin(t * 3) * 0.3
      leftArmRef.current.rotation.z  =  0.3 - Math.sin(t * 3) * 0.3
    } else if (mood === 'laugh') {
      if (bodyRef.current) bodyRef.current.rotation.z = Math.sin(t * 9) * 0.09
      rightArmRef.current.rotation.z = -0.3 + Math.sin(t * 9) * 0.4
      leftArmRef.current.rotation.z  =  0.3 - Math.sin(t * 9) * 0.4
    } else if (mood === 'blush') {
      rightArmRef.current.rotation.z = -0.3 + Math.sin(t * 1.5) * 0.1
    } else {
      // reset to natural resting
      rightArmRef.current.rotation.z = THREE.MathUtils.lerp(rightArmRef.current.rotation.z, -0.3, 0.05)
      leftArmRef.current.rotation.z  = THREE.MathUtils.lerp(leftArmRef.current.rotation.z,   0.3, 0.05)
      if (bodyRef.current) bodyRef.current.rotation.z = THREE.MathUtils.lerp(bodyRef.current.rotation.z, 0, 0.05)
    }
  })

  const cheekAlpha = { happy:0.85, laugh:0.9, blush:1, wave:0.6, idle:0.45, umbrella:0.5, thinking:0.35, surprised:0.4 }[mood] ?? 0.5
  const laughOpen  = mood === 'laugh'
  const smileArc   = mood === 'happy' || mood === 'laugh' ? Math.PI * 0.72 : Math.PI * 0.5

  const smileCurve = useMemo(() => {
    const curve = new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(-0.28, 0, 0),
      new THREE.Vector3(0, -0.14 - (mood === 'happy' ? 0.07 : 0), 0),
      new THREE.Vector3( 0.28, 0, 0),
    )
    return new THREE.TubeGeometry(curve, 20, 0.032, 8, false)
  }, [mood])

  return (
    <group ref={bodyRef}>

      {/* ── BODY ─────────────────────────────────────────── */}
      {/* Main body sphere */}
      <mesh castShadow receiveShadow scale={[1, 1.15, 0.92]} material={bodyMat}>
        <sphereGeometry args={[1, 64, 64]}/>
      </mesh>

      {/* Fuzzy back-face rim halo */}
      <mesh scale={[1.035, 1.19, 0.95]}>
        <sphereGeometry args={[1, 32, 32]}/>
        <meshStandardMaterial color="#C2E4F8" transparent opacity={0.13} side={THREE.BackSide} roughness={1}/>
      </mesh>

      {/* Top body sphere — smooths transition to tip */}
      <mesh position={[0, 1.1, 0]} castShadow material={bodyMat}>
        <sphereGeometry args={[0.52, 32, 32]}/>
      </mesh>

      {/* Tip — curled upper point (Nibi's signature) */}
      <mesh position={[0.22, 1.55, 0]} rotation={[0, 0, -0.45]} castShadow material={bodyMat}>
        <coneGeometry args={[0.28, 0.62, 32]}/>
      </mesh>
      <mesh position={[0.42, 1.78, 0]} castShadow material={bodyMat}>
        <sphereGeometry args={[0.2, 24, 24]}/>
      </mesh>

      {/* Body highlight (diffuse soft spot top-left) */}
      <mesh position={[-0.35, 0.5, 0.75]} scale={[0.9, 1.1, 0.5]}>
        <sphereGeometry args={[0.36, 16, 16]}/>
        <meshStandardMaterial color="white" transparent opacity={0.14} roughness={1}/>
      </mesh>

      {/* ── ARMS ─────────────────────────────────────────── */}
      <group ref={leftArmRef}  position={[-1.05, 0.05, 0.1]} rotation={[0, 0,  0.3]}>
        <mesh castShadow material={bodyMat}><capsuleGeometry args={[0.19, 0.44, 8, 16]}/></mesh>
        <mesh position={[0, -0.38, 0]} material={bodyMat}><sphereGeometry args={[0.19,16,16]}/></mesh>
      </group>
      <group ref={rightArmRef} position={[ 1.05, 0.05, 0.1]} rotation={[0, 0, -0.3]}>
        <mesh castShadow material={bodyMat}><capsuleGeometry args={[0.19, 0.44, 8, 16]}/></mesh>
        <mesh position={[0, -0.38, 0]} material={bodyMat}><sphereGeometry args={[0.19,16,16]}/></mesh>

        {/* Umbrella (attached to right hand) */}
        {mood === 'umbrella' && (
          <group position={[0, -0.62, 0]} rotation={[0, 0, 0.15]}>
            {/* Handle */}
            <mesh position={[0, -0.6, 0]}>
              <cylinderGeometry args={[0.025, 0.025, 1.2, 8]}/>
              <meshStandardMaterial color="#E8B0C4" roughness={0.4} metalness={0.2}/>
            </mesh>
            {/* Hook */}
            <mesh position={[0.06, -1.22, 0]} rotation={[0, 0, 0.5]}>
              <torusGeometry args={[0.08, 0.022, 8, 16, Math.PI]}/>
              <meshStandardMaterial color="#E8B0C4" roughness={0.4} metalness={0.2}/>
            </mesh>
            {/* Canopy */}
            <group position={[0, 0.05, 0]}>
              {[0, 60, 120, 180, 240, 300].map((deg, i) => {
                const a = (deg * Math.PI) / 180
                return (
                  <mesh key={i} position={[Math.sin(a)*0.45, 0.05, Math.cos(a)*0.45]} rotation={[Math.sin(a)*-0.52, 0, Math.cos(a)*-0.52]}>
                    <boxGeometry args={[0.06, 0.55, 0.04]}/>
                    <meshStandardMaterial color="#FFB3CC" roughness={0.4} transparent opacity={0.95}/>
                  </mesh>
                )
              })}
              {/* Canopy top cap */}
              <mesh position={[0, 0.28, 0]}>
                <sphereGeometry args={[0.08, 16, 16]}/>
                <meshStandardMaterial color="#FF96B2" roughness={0.4}/>
              </mesh>
            </group>
          </group>
        )}
      </group>

      {/* ── BOOTS ───────────────────────────────────────── */}
      <Boot side={-1}/>
      <Boot side={ 1}/>

      {/* ── LEFT EYE ────────────────────────────────────── */}
      <group position={[-0.38, 0.15, 0.88]}>
        <Eye blink={blink} flip={false}/>
      </group>

      {/* ── RIGHT EYE ───────────────────────────────────── */}
      <group position={[ 0.38, 0.15, 0.88]}>
        <Eye blink={blink} flip={true}/>
      </group>

      {/* ── CHEEKS ──────────────────────────────────────── */}
      <mesh position={[-0.74,-0.14, 0.8]}>
        <sphereGeometry args={[0.19,16,16]}/>
        <meshStandardMaterial color="#FF9AB4" transparent opacity={cheekAlpha * 0.72} roughness={1} depthWrite={false}/>
      </mesh>
      <mesh position={[ 0.74,-0.14, 0.8]}>
        <sphereGeometry args={[0.19,16,16]}/>
        <meshStandardMaterial color="#FF9AB4" transparent opacity={cheekAlpha * 0.72} roughness={1} depthWrite={false}/>
      </mesh>

      {/* ── MOUTH ───────────────────────────────────────── */}
      <mesh position={[0, -0.3, 0.97]} geometry={smileCurve}>
        <meshStandardMaterial color="#1A2535" roughness={0.5}/>
      </mesh>

      {/* Open laugh mouth */}
      {laughOpen && (
        <mesh position={[0, -0.38, 0.94]}>
          <sphereGeometry args={[0.15, 16, 12]}/>
          <meshStandardMaterial color="#D04060" roughness={0.6}/>
        </mesh>
      )}

      {/* ── THINKING BUBBLES ────────────────────────────── */}
      {mood === 'thinking' && [
        { pos: [1.1,  1.0, 0.3], r: 0.06 },
        { pos: [1.25, 1.2, 0.3], r: 0.09 },
        { pos: [1.45, 1.5, 0.3], r: 0.14 },
        { pos: [1.55, 1.82,0.3], r: 0.2  },
      ].map(({ pos, r }, i) => (
        <mesh key={i} position={pos}>
          <sphereGeometry args={[r, 12, 12]}/>
          <meshStandardMaterial color="white" transparent opacity={0.85} roughness={0.2}/>
        </mesh>
      ))}

      {/* ── SURPRISED ! marks ───────────────────────────── */}
      {mood === 'surprised' && [-0.9, 0.9].map((x, i) => (
        <group key={i} position={[x, 1.3, 0.4]}>
          <mesh>
            <boxGeometry args={[0.08, 0.38, 0.06]}/>
            <meshStandardMaterial color="#FFD700" emissive="#FFD700" emissiveIntensity={0.8}/>
          </mesh>
          <mesh position={[0,-0.3,0]}>
            <sphereGeometry args={[0.07, 8, 8]}/>
            <meshStandardMaterial color="#FFD700" emissive="#FFD700" emissiveIntensity={0.8}/>
          </mesh>
        </group>
      ))}

      {/* ── HAPPY sparkles ──────────────────────────────── */}
      {mood === 'happy' && [
        [1.35, 1.4, 0.4], [-1.25, 1.2, 0.4],
      ].map((pos, i) => (
        <HappyStar key={i} position={pos} delay={i * 0.4}/>
      ))}
    </group>
  )
}

// ── Animated sparkle star ─────────────────────────────────────────────────────
function HappyStar({ position, delay = 0 }) {
  const ref = useRef()
  useFrame(({ clock }) => {
    if (!ref.current) return
    const t = (clock.elapsedTime + delay) % 2
    ref.current.scale.setScalar(t < 1 ? t * 0.15 : (2 - t) * 0.15)
    ref.current.position.y = position[1] + t * 0.3
    ref.current.material.opacity = t < 1 ? t : 2 - t
  })
  return (
    <mesh ref={ref} position={position}>
      <octahedronGeometry args={[0.12, 0]}/>
      <meshStandardMaterial color="#FFD700" emissive="#FFD700" emissiveIntensity={1} transparent opacity={0}/>
    </mesh>
  )
}

// ── Float settings per mood ───────────────────────────────────────────────────
const floatConfig = {
  idle:      { speed: 2,   rotationIntensity: 0.12, floatIntensity: 0.55 },
  happy:     { speed: 3.5, rotationIntensity: 0.22, floatIntensity: 1.1 },
  laugh:     { speed: 4.5, rotationIntensity: 0.35, floatIntensity: 0.9 },
  wave:      { speed: 2,   rotationIntensity: 0.1,  floatIntensity: 0.5 },
  blush:     { speed: 1.5, rotationIntensity: 0.06, floatIntensity: 0.4 },
  umbrella:  { speed: 1.8, rotationIntensity: 0.08, floatIntensity: 0.65 },
  thinking:  { speed: 1.2, rotationIntensity: 0.05, floatIntensity: 0.3 },
  surprised: { speed: 5,   rotationIntensity: 0.4,  floatIntensity: 1.5 },
}

function MascotGLB({ mood, modelPath }) {
  const groupRef = useRef(null)
  const { scene } = useGLTF(modelPath)

  const clonedScene = useMemo(() => {
    const clone = scene.clone(true)
    clone.traverse((obj) => {
      if (obj.isMesh) {
        obj.castShadow = true
        obj.receiveShadow = true
      }
    })
    return clone
  }, [scene])

  useFrame(({ clock }) => {
    if (!groupRef.current) return
    const t = clock.elapsedTime

    if (mood === 'wave') {
      groupRef.current.rotation.y = Math.sin(t * 1.8) * 0.28
      groupRef.current.rotation.z = Math.sin(t * 3.6) * 0.06
    } else if (mood === 'thinking') {
      groupRef.current.rotation.y = Math.sin(t * 1.0) * 0.12
      groupRef.current.rotation.z = Math.sin(t * 1.2) * 0.03
    } else if (mood === 'speaking' || mood === 'happy' || mood === 'laugh') {
      groupRef.current.rotation.y = Math.sin(t * 2.4) * 0.16
      groupRef.current.rotation.z = Math.sin(t * 2.8) * 0.04
      const s = 1 + Math.sin(t * 3.2) * 0.02
      groupRef.current.scale.set(s, s, s)
    } else {
      groupRef.current.rotation.y = THREE.MathUtils.lerp(groupRef.current.rotation.y, 0, 0.08)
      groupRef.current.rotation.z = THREE.MathUtils.lerp(groupRef.current.rotation.z, 0, 0.08)
      groupRef.current.scale.lerp(new THREE.Vector3(1, 1, 1), 0.08)
    }
  })

  return (
    <group ref={groupRef} position={[0, -1.05, 0]} scale={[1.75, 1.75, 1.75]}>
      <primitive object={clonedScene} />
    </group>
  )
}

// ── Public component ──────────────────────────────────────────────────────────
export default function NibiMascot3D({
  mood = 'idle',
  size = 260,
  modelPath = null,
  orbitControls = true,
  style = {},
  onClick,
}) {
  const fp = floatConfig[mood] ?? floatConfig.idle

  return (
    <div
      style={{ width: size, height: size * 1.35,
        cursor: orbitControls ? 'grab' : onClick ? 'pointer' : 'default', ...style }}
      onClick={onClick}
    >
      <Canvas
        camera={{ position: [0, 0.3, 4.2], fov: 40 }}
        gl={{ antialias: true, alpha: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.1 }}
        shadows
        dpr={[1, 2]}
      >
        {/* ── Lighting (matches reference render) ── */}
        <ambientLight intensity={0.55}/>
        <directionalLight position={[-2.5, 4.5, 3]} intensity={1.6} castShadow
          shadow-mapSize={[1024, 1024]} shadow-camera-near={0.5} shadow-camera-far={20}/>
        <directionalLight position={[ 3,   1, -1]} intensity={0.45} color="#b8d4f0"/>
        <pointLight        position={[ 0,  -1,  3]} intensity={0.35} color="#ffa4c0"/>
        <pointLight        position={[ 0,   3,  2]} intensity={0.25} color="#d0ecff"/>

        <Suspense fallback={null}>
          <Environment preset="studio"/>
          <Float {...fp}>
            {modelPath ? <MascotGLB mood={mood} modelPath={modelPath}/> : <NibiCharacter mood={mood}/>} 
          </Float>
        </Suspense>

        <ContactShadows position={[0,-1.85,0]} opacity={0.42} scale={5} blur={2.8} far={4.5}/>

        {orbitControls && (
          <OrbitControls
            enableZoom={false}
            enablePan={false}
            minPolarAngle={Math.PI / 5}
            maxPolarAngle={Math.PI / 1.7}
            autoRotate={mood === 'idle'}
            autoRotateSpeed={0.8}
          />
        )}
      </Canvas>
    </div>
  )
}
