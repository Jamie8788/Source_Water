import { Canvas, useFrame, extend, useThree } from '@react-three/fiber'
import { Stars, Float, Sparkles, Html, Trail, MeshDistortMaterial, Effects, Billboard } from '@react-three/drei'
import * as THREE from 'three'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import { useRef, useState, useEffect, useMemo, Suspense } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Sparkles as SparklesIcon, Map, BellRing, FileBarChart2,
  Users, BookOpen, GraduationCap, LineChart, Microscope,
  FlaskConical, CloudSun, Joystick,
} from 'lucide-react'

extend({ UnrealBloomPass })

/* ─── Portal definitions ────────────────────────────────────────── */
const PORTALS = [
  { label:'Dashboard',     sub:'Overview',         Icon:LayoutDashboard, path:'/dashboard', color:'#1a78c2', glow:'#4db6f5', svgX:52, svgY:44 },
  { label:'Ask Water AI',  sub:'Talk to Water',    Icon:SparklesIcon,    path:'/ask-water', color:'#7c3aed', glow:'#a78bfa', svgX:78, svgY:24 },
  { label:'Live Map',      sub:'Explore',          Icon:Map,             path:'/map',       color:'#0e7490', glow:'#22d3ee', svgX:20, svgY:28 },
  { label:'Alerts',        sub:'Stay notified',    Icon:BellRing,        path:'/alerts',    color:'#b45309', glow:'#fcd34d', svgX:52, svgY:13 },
  { label:'Reports',       sub:'Stats & trends',   Icon:FileBarChart2,   path:'/reports',   color:'#1d4ed8', glow:'#60a5fa', svgX:82, svgY:50 },
  { label:'Community',     sub:'Connect',          Icon:Users,           path:'/social',    color:'#be185d', glow:'#f472b6', svgX:10, svgY:56 },
  { label:'Resources',     sub:'Learn & explore',  Icon:BookOpen,        path:'/resources', color:'#166534', glow:'#4ade80', svgX:32, svgY:70 },
  { label:'Quiz & Learn',  sub:'Test yourself',    Icon:GraduationCap,   path:'/quiz',      color:'#9a3412', glow:'#fb923c', svgX:68, svgY:72 },
  { label:'Data Analysis', sub:'Deep dive',        Icon:LineChart,       path:'/analysis',  color:'#1e3a8a', glow:'#818cf8', svgX:84, svgY:35 },
  { label:'Research Hub',  sub:'Projects & tools', Icon:Microscope,      path:'/research',  color:'#581c87', glow:'#c084fc', svgX:16, svgY:72 },
  { label:'Projects',      sub:'Build & track',    Icon:FlaskConical,    path:'/projects',  color:'#134e4a', glow:'#5eead4', svgX:60, svgY:84 },
  { label:'Weather',       sub:'Conditions',       Icon:CloudSun,        path:'/weather',   color:'#0c4a6e', glow:'#7dd3fc', svgX:36, svgY:17 },
  { label:'Games',         sub:'Water activities', Icon:Joystick,        path:'/games',     color:'#4a044e', glow:'#e879f9', svgX:20, svgY:84 },
].map(p => ({
  ...p,
  pos: [(p.svgX - 50) * 0.22, 2.4, (p.svgY - 50) * 0.22],
}))

/* ─── Great Lakes 3D shapes (shapeX = worldX, shapeY = worldZ) ─── */
const LAKES = [
  {
    name:'Lake Superior', color:'#0369a1', emissive:'#075985',
    labelPos:[-2.5, 0.5, -7.2],
    pts:[[-6.8,-8.8],[-4.4,-9.2],[-1.6,-9.2],[0.4,-8.6],[1.6,-7.8],[1.4,-6.6],[0,-5.2],[-1,-4.6],[-3,-4.6],[-5.2,-5.2],[-6.8,-6.2]],
  },
  {
    name:'L. Michigan', color:'#0c4a6e', emissive:'#0369a1',
    labelPos:[-3.2, 0.5, -0.8],
    pts:[[-3.6,-5],[-4.4,-3.4],[-4.2,-1],[-3.8,1.2],[-3.2,3],[-2.4,2.8],[-1.8,1.8],[-1.8,-0.8],[-2,-2.8],[-2.8,-5]],
  },
  {
    name:'Lake Huron', color:'#0e7490', emissive:'#155e75',
    labelPos:[1.2, 0.5, -3.2],
    pts:[[-0.6,-6.6],[1,-6.8],[2.4,-6.2],[3.6,-5.2],[3.6,-3.6],[3.4,-1.8],[2.6,-0.4],[1.2,0.4],[0,0.4],[-0.8,-0.4],[-1.6,-2.4],[-0.8,-5.6]],
  },
  {
    name:'Lake Erie', color:'#14532d', emissive:'#166534',
    labelPos:[1.4, 0.5, 2],
    pts:[[-2.2,0.6],[0.2,0.2],[1.8,0.6],[3.4,0.8],[4.4,1.6],[4.4,2.8],[3.6,3.4],[1.6,3.4],[-0.2,3.2],[-1.4,2.6],[-2.2,1.8]],
  },
  {
    name:'L. Ontario', color:'#164e63', emissive:'#155e75',
    labelPos:[5.2, 0.5, 1.8],
    pts:[[3.6,0.2],[5.2,0],[6.8,0.6],[7.4,1.4],[7.2,2.8],[6.2,3.2],[4.6,3.2],[3.6,2.4],[3.2,1.4]],
  },
]

/* ─── Animated ocean floor ──────────────────────────────────────── */
const VERT = `
  uniform float uTime;
  varying vec2 vUv;
  varying float vWave;
  varying vec3 vPos;
  void main(){
    vUv=uv; vPos=position;
    float w =sin(position.x*0.35+uTime*0.7)*0.22
             +sin(position.z*0.45+uTime*0.9)*0.18
             +sin((position.x+position.z)*0.22+uTime*0.5)*0.14
             +cos(position.x*0.12+position.z*0.18+uTime*0.3)*0.1;
    vWave=w;
    gl_Position=projectionMatrix*modelViewMatrix*vec4(position.x,position.y+w,position.z,1.0);
  }
`
const FRAG = `
  uniform float uTime;
  varying vec2 vUv;
  varying float vWave;
  varying vec3 vPos;
  void main(){
    float caustic=sin(vPos.x*1.8+uTime)*sin(vPos.z*2.1+uTime*0.8)*0.5+0.5;
    caustic=caustic*caustic;
    vec3 deep=vec3(0.02,0.06,0.18);
    vec3 mid =vec3(0.04,0.14,0.35);
    vec3 foam=vec3(0.2,0.5,0.9);
    vec3 col=mix(deep,mid,caustic*0.4+vWave*1.2);
    col=mix(col,foam,max(0.0,vWave-0.1)*1.5);
    vec2 e=abs(vUv-0.5)*2.0;
    float fade=1.0-smoothstep(0.65,1.0,max(e.x,e.y));
    gl_FragColor=vec4(col,fade*0.88);
  }
`

function Ocean() {
  const matRef = useRef()
  const uniforms = useMemo(()=>({ uTime:{value:0} }),[])
  useFrame(({clock})=>{ if(matRef.current) matRef.current.uniforms.uTime.value=clock.getElapsedTime() })
  return (
    <mesh rotation={[-Math.PI/2,0,0]} position={[0,-0.12,0]}>
      <planeGeometry args={[80,80,128,128]}/>
      <shaderMaterial ref={matRef} uniforms={uniforms} vertexShader={VERT} fragmentShader={FRAG} transparent side={THREE.DoubleSide}/>
    </mesh>
  )
}

/* ─── Great Lake extruded mesh ──────────────────────────────────── */
function GreatLake({ lake }) {
  const shape = useMemo(()=>{
    const s = new THREE.Shape()
    s.moveTo(lake.pts[0][0], lake.pts[0][1])
    lake.pts.slice(1).forEach(([x,y])=>s.lineTo(x,y))
    s.closePath(); return s
  },[lake.pts])
  const geo = useMemo(()=>new THREE.ExtrudeGeometry(shape,{ depth:0.35, bevelEnabled:true, bevelThickness:0.04, bevelSize:0.04, bevelSegments:3 }),[shape])
  const [hov,setHov] = useState(false)
  const meshRef = useRef()
  useFrame(()=>{ if(meshRef.current) meshRef.current.material.emissiveIntensity = THREE.MathUtils.lerp(meshRef.current.material.emissiveIntensity, hov?0.7:0.28, 0.08) })
  return (
    <group>
      <mesh ref={meshRef} geometry={geo} rotation={[-Math.PI/2,0,0]} position={[0,0,0]}
        onPointerOver={()=>setHov(true)} onPointerOut={()=>setHov(false)}>
        <meshStandardMaterial color={lake.color} emissive={lake.emissive} emissiveIntensity={0.28} metalness={0.3} roughness={0.15} transparent opacity={0.9}/>
      </mesh>
      {/* Top glow surface */}
      <mesh geometry={geo} rotation={[-Math.PI/2,0,0]} position={[0,0.01,0]}>
        <meshStandardMaterial color={lake.emissive} emissive={lake.emissive} emissiveIntensity={0.5} transparent opacity={0.12} depthWrite={false}/>
      </mesh>
      {/* Point light over lake */}
      <pointLight position={[lake.labelPos[0], 1.5, lake.labelPos[2]]} color={lake.emissive} intensity={0.6} distance={6}/>
      {/* Label */}
      <Billboard position={lake.labelPos}>
        <Html center distanceFactor={14}>
          <div style={{color:'#7dd3fc',fontFamily:'system-ui',fontSize:10,fontWeight:800,fontStyle:'italic',
            textShadow:'0 0 12px #06b6d4, 0 0 4px #0ea5e9',whiteSpace:'nowrap',pointerEvents:'none',letterSpacing:'0.05em'}}>
            {lake.name}
          </div>
        </Html>
      </Billboard>
    </group>
  )
}

/* ─── Portal node ───────────────────────────────────────────────── */
function PortalNode({ portal, idx, onNav }) {
  const [hov, setHov] = useState(false)
  const r1 = useRef(), r2 = useRef(), r3 = useRef(), gRef = useRef()
  const isCenter = idx === 0
  const size = isCenter ? 0.72 : 0.52

  useFrame((_,dt)=>{
    if(r1.current) r1.current.rotation.z += dt*(isCenter?0.6:0.5)
    if(r2.current) r2.current.rotation.z -= dt*(isCenter?0.9:0.8)
    if(r3.current) r3.current.rotation.y += dt*0.4
    if(gRef.current) {
      const target = hov ? 1.18 : 1
      gRef.current.scale.lerp(new THREE.Vector3(target,target,target), 0.1)
    }
  })

  return (
    <Float speed={1.4+idx*0.08} rotationIntensity={0.08} floatIntensity={isCenter?0.5:0.35}>
      <group ref={gRef} position={portal.pos}
        onPointerOver={()=>{setHov(true);document.body.style.cursor='pointer'}}
        onPointerOut={()=>{setHov(false);document.body.style.cursor=''}}
        onClick={()=>onNav(portal.path)}>

        {/* Outer ambient glow */}
        <mesh>
          <sphereGeometry args={[size*2.2,16,16]}/>
          <meshStandardMaterial color={portal.glow} emissive={portal.glow} emissiveIntensity={0.15}
            transparent opacity={hov?0.1:0.05} depthWrite={false}/>
        </mesh>

        {/* Main distorted sphere */}
        <mesh>
          <icosahedronGeometry args={[size,4]}/>
          <MeshDistortMaterial color={portal.color} emissive={portal.color}
            emissiveIntensity={hov?0.9:0.45} distort={hov?0.5:0.25} speed={2.5}
            metalness={0.6} roughness={0.05} transparent opacity={0.92}/>
        </mesh>

        {/* Inner core */}
        <mesh>
          <sphereGeometry args={[size*0.55,16,16]}/>
          <meshStandardMaterial color={portal.glow} emissive={portal.glow}
            emissiveIntensity={hov?3:1.5} transparent opacity={0.6}/>
        </mesh>

        {/* Ring 1 — tilted */}
        <mesh ref={r1} rotation={[Math.PI/3,0,0]}>
          <torusGeometry args={[size*1.55,0.025,8,80]}/>
          <meshStandardMaterial color={portal.glow} emissive={portal.glow} emissiveIntensity={2}/>
        </mesh>

        {/* Ring 2 — counter tilt */}
        <mesh ref={r2} rotation={[Math.PI/5,Math.PI/4,0]}>
          <torusGeometry args={[size*1.85,0.018,8,80]}/>
          <meshStandardMaterial color={portal.color} emissive={portal.color}
            emissiveIntensity={1.5} transparent opacity={0.8}/>
        </mesh>

        {/* Ring 3 — horizontal equator */}
        <mesh ref={r3}>
          <torusGeometry args={[size*1.3,0.012,8,64]}/>
          <meshStandardMaterial color={portal.glow} emissive={portal.glow}
            emissiveIntensity={1} transparent opacity={0.6}/>
        </mesh>

        {/* Glow light */}
        <pointLight color={portal.glow} intensity={hov?3.5:1.2} distance={5} decay={2}/>

        {/* Label */}
        <Billboard position={[0,-(size+0.55),0]}>
          <Html center distanceFactor={13}>
            <div onClick={()=>onNav(portal.path)} style={{
              background:`rgba(0,0,0,0.82)`,
              border:`1px solid ${portal.glow}55`,
              borderRadius:8,
              padding:'4px 11px',
              color:'#f1f5f9',
              fontSize:11,fontWeight:800,
              whiteSpace:'nowrap',textAlign:'center',
              backdropFilter:'blur(6px)',
              boxShadow:`0 0 14px ${portal.glow}50, inset 0 0 0 1px rgba(255,255,255,0.04)`,
              cursor:'pointer',letterSpacing:'0.03em',
              transition:'all 0.15s',
            }}>
              {portal.label}
              <div style={{fontSize:9,color:portal.glow,fontWeight:600,marginTop:1,opacity:0.9}}>{portal.sub}</div>
            </div>
          </Html>
        </Billboard>
      </group>
    </Float>
  )
}

/* ─── 3D Ship ───────────────────────────────────────────────────── */
function Ship({ shipRef }) {
  const gRef = useRef()
  const prevPos = useRef(new THREE.Vector3())
  const trailTarget = useRef()

  useFrame(()=>{
    if(!gRef.current||!shipRef.current) return
    const s = shipRef.current
    gRef.current.position.set(s.x, 0.25, s.z)
    gRef.current.rotation.y = -(s.angle - 90) * Math.PI / 180
    prevPos.current.set(s.x, 0.25, s.z)
  })

  return (
    <group ref={gRef}>
      <Trail width={0.8} length={8} color={new THREE.Color('#38bdf8')} attenuation={t=>t*t} target={trailTarget}>
        <object3D ref={trailTarget}/>
      </Trail>
      {/* Hull */}
      <mesh position={[0,0,0]} castShadow>
        <boxGeometry args={[1.1,0.22,0.38]}/>
        <meshStandardMaterial color="#7c3a1a" metalness={0.4} roughness={0.6}/>
      </mesh>
      {/* Deck */}
      <mesh position={[0,0.14,0]}>
        <boxGeometry args={[0.9,0.12,0.28]}/>
        <meshStandardMaterial color="#9b4a22" metalness={0.3} roughness={0.5}/>
      </mesh>
      {/* Main mast */}
      <mesh position={[0.08,0.65,0]}>
        <cylinderGeometry args={[0.018,0.024,0.9,8]}/>
        <meshStandardMaterial color="#3d2510" roughness={0.8}/>
      </mesh>
      {/* Sail */}
      <mesh position={[0.22,0.78,0.1]} rotation={[0,0.1,0]}>
        <planeGeometry args={[0.36,0.5]}/>
        <meshStandardMaterial color="#fefce8" side={THREE.DoubleSide} transparent opacity={0.96}/>
      </mesh>
      {/* Fore mast */}
      <mesh position={[-0.12,0.48,0]}>
        <cylinderGeometry args={[0.013,0.018,0.65,8]}/>
        <meshStandardMaterial color="#3d2510" roughness={0.8}/>
      </mesh>
      {/* Fore sail */}
      <mesh position={[-0.04,0.56,0.08]}>
        <planeGeometry args={[0.28,0.38]}/>
        <meshStandardMaterial color="#fefce8" side={THREE.DoubleSide} transparent opacity={0.9}/>
      </mesh>
      {/* Engine glow */}
      <pointLight color="#38bdf8" intensity={0.8} distance={3} position={[-0.55,0,0]}/>
      <mesh position={[-0.55,0,0]}>
        <sphereGeometry args={[0.06,8,8]}/>
        <meshStandardMaterial emissive="#38bdf8" emissiveIntensity={3} color="#38bdf8"/>
      </mesh>
    </group>
  )
}

/* ─── Camera follows ship ───────────────────────────────────────── */
function CameraRig({ shipRef }) {
  const { camera } = useThree()
  const smooth = useRef(new THREE.Vector3(0, 13, 10))
  const lookAt = useRef(new THREE.Vector3())
  useFrame(()=>{
    const sx = shipRef.current?.x ?? 0
    const sz = shipRef.current?.z ?? 0
    const targetCam = new THREE.Vector3(sx, 13, sz + 10)
    smooth.current.lerp(targetCam, 0.035)
    lookAt.current.lerp(new THREE.Vector3(sx, 0, sz), 0.05)
    camera.position.copy(smooth.current)
    camera.lookAt(lookAt.current)
  })
  return null
}

/* ─── Connection lines between portals ─────────────────────────── */
function ConnectionLines({ hovered }) {
  const EDGES = [[0,1],[0,2],[0,3],[0,4],[0,5],[0,6],[0,7],[1,4],[2,9],[3,6],[5,9],[7,10]]
  return (
    <>
      {EDGES.map(([a,b],i)=>{
        const pa = PORTALS[a], pb = PORTALS[b]
        const active = hovered===a||hovered===b
        const pts = [new THREE.Vector3(...pa.pos), new THREE.Vector3(...pb.pos)]
        return (
          <line key={i}>
            <bufferGeometry>
              <bufferAttribute attach="attributes-position" count={2}
                array={new Float32Array([pa.pos[0],pa.pos[1],pa.pos[2],pb.pos[0],pb.pos[1],pb.pos[2]])}
                itemSize={3}/>
            </bufferGeometry>
            <lineBasicMaterial color={active?pa.glow:'#1e3a5f'} transparent opacity={active?0.8:0.25} linewidth={1}/>
          </line>
        )
      })}
    </>
  )
}

/* ─── Ground grid ───────────────────────────────────────────────── */
function GridFloor() {
  return (
    <gridHelper args={[80,80,'#0f2a4a','#0a1628']} position={[0,-0.18,0]} rotation={[0,0,0]}/>
  )
}

/* ─── Terrain land masses ───────────────────────────────────────── */
function LandMass() {
  return (
    <mesh rotation={[-Math.PI/2,0,0]} position={[0,-0.14,0]} receiveShadow>
      <planeGeometry args={[80,80]}/>
      <meshStandardMaterial color="#0a1628" roughness={1} metalness={0}/>
    </mesh>
  )
}

/* ─── Main 3D scene ─────────────────────────────────────────────── */
function Scene({ shipRef, navigate }) {
  const [hovered, setHovered] = useState(null)

  return (
    <>
      {/* Lighting */}
      <ambientLight intensity={0.15} color="#1e3a5f"/>
      <directionalLight position={[10,20,10]} intensity={0.4} color="#7dd3fc"/>
      <pointLight position={[0,8,0]} color="#0ea5e9" intensity={0.6} distance={30}/>
      <hemisphereLight skyColor="#0c1a3a" groundColor="#060e1e" intensity={0.5}/>

      {/* Background */}
      <Stars radius={120} depth={80} count={6000} factor={4} saturation={0.4} fade speed={0.4}/>
      <fog attach="fog" args={['#020b18', 30, 80]}/>

      {/* Atmosphere sparkles */}
      <Sparkles count={180} scale={[30,6,30]} size={0.8} speed={0.15} color="#38bdf8" opacity={0.35} noise={0.4}/>
      <Sparkles count={80} scale={[20,3,20]} size={1.2} speed={0.08} color="#818cf8" opacity={0.25}/>

      {/* Terrain */}
      <LandMass/>
      <GridFloor/>
      <Ocean/>

      {/* Great Lakes */}
      {LAKES.map(lake => <GreatLake key={lake.name} lake={lake}/>)}

      {/* Connection lines */}
      <ConnectionLines hovered={hovered}/>

      {/* Portal nodes */}
      {PORTALS.map((p,i)=>(
        <PortalNode key={p.path} portal={p} idx={i} onNav={navigate}/>
      ))}

      {/* Ship */}
      <Ship shipRef={shipRef}/>

      {/* Camera */}
      <CameraRig shipRef={shipRef}/>

      {/* Bloom */}
      <Effects disableGamma>
        <unrealBloomPass threshold={0.05} strength={0.65} radius={0.45}/>
      </Effects>
    </>
  )
}

/* ─── Ship controls hook ────────────────────────────────────────── */
function useShipControls() {
  const shipRef = useRef({ x:0.4, z:-1.2, angle:-20, speed:0 })
  const keys = useRef({})

  useEffect(()=>{
    const dn = e => {
      keys.current[e.key]=true
      if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' '].includes(e.key)) e.preventDefault()
    }
    const up = e => { keys.current[e.key]=false }
    window.addEventListener('keydown',dn)
    window.addEventListener('keyup',up)
    return()=>{ window.removeEventListener('keydown',dn); window.removeEventListener('keyup',up) }
  },[])

  // Game loop via rAF — runs outside R3F
  const stateRef = useRef({ x:0.4, z:-1.2, angle:-20, speed:0 })
  const [render, setRender] = useState({ x:0.4, z:-1.2, angle:-20, speed:0 })

  useEffect(()=>{
    let raf
    const loop = ()=>{
      const k=keys.current, s=stateRef.current
      if(k['ArrowLeft']||k['a']||k['A']) s.angle-=2.8
      if(k['ArrowRight']||k['d']||k['D']) s.angle+=2.8
      const fwd=k['ArrowUp']||k['w']||k['W']
      const rev=k['ArrowDown']||k['s']||k['S']
      if(fwd) s.speed=Math.min(s.speed+0.025,0.55)
      else if(rev) s.speed=Math.max(s.speed-0.02,-0.2)
      else s.speed*=0.94
      const rad=(s.angle-90)*Math.PI/180
      s.x=Math.max(-18,Math.min(18,s.x+Math.cos(rad)*s.speed))
      s.z=Math.max(-18,Math.min(18,s.z+Math.sin(rad)*s.speed))
      shipRef.current={...s}
      setRender({...s})
      raf=requestAnimationFrame(loop)
    }
    raf=requestAnimationFrame(loop)
    return()=>cancelAnimationFrame(raf)
  },[])

  return { shipRef, shipRender: render }
}

/* ─── Main page ─────────────────────────────────────────────────── */
export default function QuickActions() {
  const navigate = useNavigate()
  const { shipRef, shipRender } = useShipControls()
  const speed = Math.abs(shipRender.speed)
  const heading = ((shipRender.angle%360)+360)%360

  return (
    <div style={{ position:'relative', width:'100%', height:'calc(100vh - 88px)', overflow:'hidden', borderRadius:16, background:'#020b18' }}>

      {/* 3D Canvas */}
      <Canvas
        dpr={[1,1.8]}
        camera={{ position:[0,13,10], fov:52, near:0.1, far:200 }}
        gl={{ antialias:true, alpha:false, toneMapping:THREE.ACESFilmicToneMapping, toneMappingExposure:1.2 }}
        style={{ position:'absolute', inset:0 }}
      >
        <Suspense fallback={null}>
          <Scene shipRef={shipRef} navigate={navigate}/>
        </Suspense>
      </Canvas>

      {/* Title overlay */}
      <div style={{
        position:'absolute', top:16, left:'50%', transform:'translateX(-50%)',
        textAlign:'center', pointerEvents:'none', zIndex:10,
      }}>
        <div style={{ fontSize:9, letterSpacing:'0.35em', color:'rgba(125,211,252,0.7)', fontWeight:700, fontFamily:'system-ui', marginBottom:4, textTransform:'uppercase' }}>
          SOURCE WATER
        </div>
        <div style={{ fontSize:18, fontWeight:900, color:'#e2e8f0', fontFamily:'system-ui', letterSpacing:'0.08em',
          textShadow:'0 0 24px #0ea5e9, 0 0 8px #38bdf8', textTransform:'uppercase' }}>
          The Great Lakes Water Network
        </div>
        <div style={{ fontSize:10, color:'rgba(125,211,252,0.5)', marginTop:3, fontFamily:'system-ui', letterSpacing:'0.2em' }}>
          CLICK A NODE TO NAVIGATE
        </div>
      </div>

      {/* HUD — ship controls */}
      <div style={{
        position:'absolute', bottom:16, left:16, zIndex:10,
        background:'rgba(2,11,24,0.85)', border:'1px solid rgba(14,116,144,0.35)',
        borderRadius:12, padding:'12px 16px', backdropFilter:'blur(10px)',
        boxShadow:'0 0 20px rgba(14,116,144,0.2)',
        fontFamily:'system-ui',
      }}>
        <div style={{ fontSize:9, fontWeight:800, color:'#38bdf8', letterSpacing:'0.15em', marginBottom:8 }}>HELM CONTROL</div>
        {[
          ['W / ↑', 'Forward'],
          ['S / ↓', 'Reverse'],
          ['A / ←', 'Port'],
          ['D / →', 'Starboard'],
        ].map(([k,v])=>(
          <div key={k} style={{ display:'flex', justifyContent:'space-between', gap:20, marginBottom:4 }}>
            <span style={{ fontSize:10, fontWeight:800, color:'#7dd3fc', background:'rgba(14,116,144,0.2)', padding:'1px 6px', borderRadius:4, border:'1px solid rgba(14,116,144,0.3)' }}>{k}</span>
            <span style={{ fontSize:10, color:'rgba(255,255,255,0.4)', fontWeight:600 }}>{v}</span>
          </div>
        ))}
        <div style={{ marginTop:10, paddingTop:8, borderTop:'1px solid rgba(14,116,144,0.2)', display:'grid', gridTemplateColumns:'1fr 1fr', gap:6 }}>
          <div>
            <div style={{ fontSize:8, color:'rgba(125,211,252,0.45)', letterSpacing:'0.1em', marginBottom:2 }}>SPEED</div>
            <div style={{ height:3, background:'rgba(255,255,255,0.08)', borderRadius:2, overflow:'hidden' }}>
              <div style={{ height:'100%', width:`${(speed/0.55)*100}%`, background:'linear-gradient(90deg,#0ea5e9,#38bdf8)', transition:'width 0.1s', boxShadow:'0 0 6px #38bdf8' }}/>
            </div>
          </div>
          <div>
            <div style={{ fontSize:8, color:'rgba(125,211,252,0.45)', letterSpacing:'0.1em', marginBottom:1 }}>HDG</div>
            <div style={{ fontSize:13, fontWeight:900, color:'#38bdf8', textShadow:'0 0 8px #0ea5e9' }}>{Math.round(heading)}°</div>
          </div>
        </div>
      </div>

      {/* Mini compass */}
      <div style={{ position:'absolute', bottom:16, right:16, zIndex:10 }}>
        <svg width={72} height={72} viewBox="0 0 72 72">
          <circle cx={36} cy={36} r={34} fill="rgba(2,11,24,0.88)" stroke="rgba(14,116,144,0.4)" strokeWidth={1.5}/>
          <circle cx={36} cy={36} r={29} fill="none" stroke="rgba(14,116,144,0.15)" strokeWidth={0.8} strokeDasharray="3 3"/>
          {['N','E','S','W'].map((d,i)=>{
            const a=i*90*Math.PI/180-Math.PI/2
            return <text key={d} x={36+Math.cos(a)*22} y={36+Math.sin(a)*22+4}
              textAnchor="middle" fontSize={d==='N'?10:8} fontWeight={800}
              fill={d==='N'?'#ef4444':'rgba(125,211,252,0.7)'} fontFamily="system-ui">{d}</text>
          })}
          <g transform={`rotate(${heading} 36 36)`}>
            <polygon points="36,10 33.5,36 36,32 38.5,36" fill="#ef4444"/>
            <polygon points="36,62 33.5,36 36,40 38.5,36" fill="rgba(125,211,252,0.6)"/>
          </g>
          <circle cx={36} cy={36} r={4} fill="none" stroke="rgba(14,116,144,0.5)" strokeWidth={1}/>
          <circle cx={36} cy={36} r={2} fill="#38bdf8"/>
        </svg>
      </div>

      {/* Speed lines overlay when moving fast */}
      {speed > 0.35 && (
        <div style={{ position:'absolute', inset:0, pointerEvents:'none', zIndex:5,
          background:'radial-gradient(ellipse at center, transparent 30%, rgba(14,116,144,0.04) 100%)',
          animation:'pulse 0.3s ease infinite' }}/>
      )}
    </div>
  )
}
