import { Canvas, useFrame, extend, useThree } from '@react-three/fiber'
import { Sky, Cloud, Float, Html, Trail, MeshDistortMaterial, Effects, Billboard } from '@react-three/drei'
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

const SUN_POS = [80, 25, -60]
const SUN_DIR = new THREE.Vector3(80, 25, -60).normalize()
const SUN_COLOR = new THREE.Color('#fff5d0')

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

/* ─── Great Lakes shapes ────────────────────────────────────────── */
const LAKES = [
  {
    name:'Lake Superior', color:'#1a6090', emissive:'#1e7fb0',
    labelPos:[-2.5, 0.5, -7.2],
    pts:[[-6.8,-8.8],[-4.4,-9.2],[-1.6,-9.2],[0.4,-8.6],[1.6,-7.8],[1.4,-6.6],[0,-5.2],[-1,-4.6],[-3,-4.6],[-5.2,-5.2],[-6.8,-6.2]],
  },
  {
    name:'L. Michigan', color:'#1559a0', emissive:'#1e7fc4',
    labelPos:[-3.2, 0.5, -0.8],
    pts:[[-3.6,-5],[-4.4,-3.4],[-4.2,-1],[-3.8,1.2],[-3.2,3],[-2.4,2.8],[-1.8,1.8],[-1.8,-0.8],[-2,-2.8],[-2.8,-5]],
  },
  {
    name:'Lake Huron', color:'#186e98', emissive:'#1a90c0',
    labelPos:[1.2, 0.5, -3.2],
    pts:[[-0.6,-6.6],[1,-6.8],[2.4,-6.2],[3.6,-5.2],[3.6,-3.6],[3.4,-1.8],[2.6,-0.4],[1.2,0.4],[0,0.4],[-0.8,-0.4],[-1.6,-2.4],[-0.8,-5.6]],
  },
  {
    name:'Lake Erie', color:'#147a62', emissive:'#1aaa88',
    labelPos:[1.4, 0.5, 2],
    pts:[[-2.2,0.6],[0.2,0.2],[1.8,0.6],[3.4,0.8],[4.4,1.6],[4.4,2.8],[3.6,3.4],[1.6,3.4],[-0.2,3.2],[-1.4,2.6],[-2.2,1.8]],
  },
  {
    name:'L. Ontario', color:'#1a5c80', emissive:'#1e80aa',
    labelPos:[5.2, 0.5, 1.8],
    pts:[[3.6,0.2],[5.2,0],[6.8,0.6],[7.4,1.4],[7.2,2.8],[6.2,3.2],[4.6,3.2],[3.6,2.4],[3.2,1.4]],
  },
]

/* ─── Realistic water shader ────────────────────────────────────── */
const WATER_VERT = `
  uniform float uTime;
  varying vec2 vUv;
  varying float vWave;
  varying vec3 vNormal;
  varying vec3 vViewDir;
  varying vec3 vWorldPos;

  void main(){
    vUv = uv;
    vec3 pos = position;

    float w = sin(pos.x*0.42+uTime*0.72)*0.28
            + sin(pos.z*0.53+uTime*1.05)*0.22
            + sin((pos.x+pos.z)*0.28+uTime*0.58)*0.14
            + cos(pos.x*0.14+pos.z*0.19+uTime*0.32)*0.09
            + sin(pos.x*1.1+pos.z*0.9+uTime*2.1)*0.028;
    vWave = w;

    float e = 0.08;
    float wx1 = sin((pos.x+e)*0.42+uTime*0.72)*0.28+sin(pos.z*0.53+uTime*1.05)*0.22+sin(((pos.x+e)+pos.z)*0.28+uTime*0.58)*0.14;
    float wz1 = sin(pos.x*0.42+uTime*0.72)*0.28+sin((pos.z+e)*0.53+uTime*1.05)*0.22+sin((pos.x+(pos.z+e))*0.28+uTime*0.58)*0.14;
    vec3 tX = normalize(vec3(e, wx1-w, 0.0));
    vec3 tZ = normalize(vec3(0.0, wz1-w, e));
    vNormal = normalize(cross(tZ, tX));

    pos.y += w;
    vec4 wPos = modelMatrix * vec4(pos, 1.0);
    vWorldPos = wPos.xyz;
    vViewDir = normalize(cameraPosition - wPos.xyz);
    gl_Position = projectionMatrix * viewMatrix * wPos;
  }
`
const WATER_FRAG = `
  uniform float uTime;
  uniform vec3 uSunDir;
  uniform vec3 uSunColor;
  varying vec2 vUv;
  varying float vWave;
  varying vec3 vNormal;
  varying vec3 vViewDir;
  varying vec3 vWorldPos;

  void main(){
    vec3 N = normalize(vNormal);
    vec3 V = normalize(vViewDir);
    vec3 L = uSunDir;

    // Fresnel — more mirror-like at glancing angles
    float fresnelBase = 1.0 - max(dot(N, V), 0.0);
    float fresnel = 0.04 + 0.96 * pow(fresnelBase, 5.0);

    // Diffuse
    float diff = max(dot(N, L), 0.15);

    // Specular (sharp sun + soft halo)
    vec3 H = normalize(L + V);
    float NdotH = max(dot(N, H), 0.0);
    float spec  = pow(NdotH, 512.0) * 2.0;
    float spec2 = pow(NdotH, 48.0) * 0.35;

    // Caustic shimmer
    float caustic = sin(vWorldPos.x*2.1+uTime*1.4)*sin(vWorldPos.z*2.6+uTime*1.1)*0.5+0.5;
    caustic = caustic * caustic * 0.18;

    // Water depth colors (Great Lakes palette)
    vec3 deep    = vec3(0.02, 0.08, 0.28);
    vec3 mid     = vec3(0.04, 0.16, 0.44);
    vec3 shallow = vec3(0.06, 0.28, 0.52);
    vec3 crest   = vec3(0.14, 0.42, 0.60);

    float t = clamp(vWave * 1.4 + diff * 0.25 + caustic, 0.0, 1.0);
    vec3 waterCol = mix(deep, mid, t);
    waterCol = mix(waterCol, shallow, max(0.0, t - 0.5) * 2.0);
    waterCol = mix(waterCol, crest, smoothstep(0.28, 0.6, vWave));

    // Foam caps
    float foam = smoothstep(0.32, 0.58, vWave);
    waterCol = mix(waterCol, vec3(0.88, 0.95, 1.0), foam * 0.72);

    // Sun specular contribution
    waterCol += uSunColor * (spec + spec2);

    // Sky Fresnel reflection
    vec3 skyCol = vec3(0.42, 0.64, 0.90);
    waterCol = mix(waterCol, skyCol * 1.1, fresnel * 0.45);

    // Diffuse lighting
    waterCol *= (0.6 + diff * 0.4);

    // Horizon fade
    vec2 edge = abs(vUv - 0.5) * 2.0;
    float fade = 1.0 - smoothstep(0.68, 1.0, max(edge.x, edge.y));

    gl_FragColor = vec4(waterCol, fade * 0.97);
  }
`

function Ocean() {
  const matRef = useRef()
  const uniforms = useMemo(()=>({
    uTime:     { value: 0 },
    uSunDir:   { value: SUN_DIR },
    uSunColor: { value: SUN_COLOR },
  }),[])
  useFrame(({ clock }) => { if(matRef.current) matRef.current.uniforms.uTime.value = clock.getElapsedTime() })
  return (
    <mesh rotation={[-Math.PI/2,0,0]} position={[0,-0.05,0]}>
      <planeGeometry args={[80,80,128,128]}/>
      <shaderMaterial ref={matRef} uniforms={uniforms} vertexShader={WATER_VERT} fragmentShader={WATER_FRAG} transparent side={THREE.DoubleSide}/>
    </mesh>
  )
}

/* ─── Green terrain beneath ─────────────────────────────────────── */
function Terrain() {
  return (
    <mesh rotation={[-Math.PI/2,0,0]} position={[0,-0.32,0]} receiveShadow>
      <planeGeometry args={[80,80]}/>
      <meshStandardMaterial color="#3a5e1e" roughness={0.95} metalness={0}/>
    </mesh>
  )
}

/* ─── Sun light shafts ──────────────────────────────────────────── */
function SunShafts() {
  const groupRef = useRef()
  useFrame(({ clock }) => {
    if(!groupRef.current) return
    const t = clock.getElapsedTime()
    groupRef.current.children.forEach((m, i) => {
      if(m.material) m.material.opacity = 0.035 + Math.sin(t * 0.45 + i * 1.3) * 0.012
    })
  })
  return (
    <group ref={groupRef} position={[38, 32, -32]} rotation={[0.32, 0.52, -0.12]}>
      {[0,1,2,3,4,5].map((i) => (
        <mesh key={i} rotation={[0, (i / 6) * Math.PI * 0.35, 0]}>
          <coneGeometry args={[6 + i * 2.5, 55, 5, 1, true]}/>
          <meshBasicMaterial color="#ffe8a0" transparent opacity={0.04}
            depthWrite={false} side={THREE.BackSide} blending={THREE.AdditiveBlending}/>
        </mesh>
      ))}
    </group>
  )
}

/* ─── Volumetric clouds ─────────────────────────────────────────── */
function CloudLayer() {
  return (
    <group>
      <Cloud position={[-18, 13, -10]} opacity={0.62} speed={0.08} width={11} depth={2} segments={22} color="#f0f4ff"/>
      <Cloud position={[14,  15, -14]} opacity={0.68} speed={0.06} width={14} depth={2.5} segments={28} color="white"/>
      <Cloud position={[-6,  12,  11]} opacity={0.52} speed={0.10} width={9}  depth={1.8} segments={18} color="#e8f0ff"/>
      <Cloud position={[22,  14,   7]} opacity={0.58} speed={0.07} width={12} depth={2}   segments={24} color="white"/>
      <Cloud position={[2,   16, -22]} opacity={0.48} speed={0.05} width={15} depth={2.2} segments={30} color="#f8f8ff"/>
      <Cloud position={[-22, 11,   4]} opacity={0.55} speed={0.09} width={10} depth={1.6} segments={20} color="#eef2ff"/>
    </group>
  )
}

/* ─── Great Lake mesh ───────────────────────────────────────────── */
function GreatLake({ lake }) {
  const shape = useMemo(()=>{
    const s = new THREE.Shape()
    s.moveTo(lake.pts[0][0], lake.pts[0][1])
    lake.pts.slice(1).forEach(([x,y]) => s.lineTo(x,y))
    s.closePath(); return s
  },[lake.pts])
  const geo = useMemo(()=>new THREE.ExtrudeGeometry(shape,{
    depth:0.35, bevelEnabled:true, bevelThickness:0.06, bevelSize:0.05, bevelSegments:4,
  }),[shape])
  const [hov,setHov] = useState(false)
  const meshRef = useRef()
  useFrame(()=>{
    if(meshRef.current)
      meshRef.current.material.emissiveIntensity = THREE.MathUtils.lerp(
        meshRef.current.material.emissiveIntensity, hov ? 0.65 : 0.22, 0.08)
  })
  return (
    <group>
      <mesh ref={meshRef} geometry={geo} rotation={[-Math.PI/2,0,0]}
        onPointerOver={()=>setHov(true)} onPointerOut={()=>setHov(false)}>
        <meshStandardMaterial color={lake.color} emissive={lake.emissive}
          emissiveIntensity={0.22} metalness={0.15} roughness={0.1} transparent opacity={0.95}/>
      </mesh>
      {/* Water surface shimmer */}
      <mesh geometry={geo} rotation={[-Math.PI/2,0,0]} position={[0,0.02,0]}>
        <meshStandardMaterial color={lake.emissive} emissive={lake.emissive}
          emissiveIntensity={0.45} transparent opacity={0.14} depthWrite={false}/>
      </mesh>
      <pointLight position={[lake.labelPos[0],1.8,lake.labelPos[2]]} color={lake.emissive} intensity={0.5} distance={6}/>
      <Billboard position={lake.labelPos}>
        <Html center distanceFactor={14}>
          <div style={{
            color:'#e0f2fe', fontFamily:'system-ui', fontSize:10, fontWeight:800, fontStyle:'italic',
            textShadow:'0 1px 8px rgba(0,0,0,0.8), 0 0 16px #0ea5e9',
            whiteSpace:'nowrap', pointerEvents:'none', letterSpacing:'0.05em',
          }}>{lake.name}</div>
        </Html>
      </Billboard>
    </group>
  )
}

/* ─── Portal navigation node ────────────────────────────────────── */
function PortalNode({ portal, idx, onNav }) {
  const [hov,setHov] = useState(false)
  const r1=useRef(), r2=useRef(), r3=useRef(), gRef=useRef()
  const isCenter = idx === 0
  const size = isCenter ? 0.72 : 0.52

  useFrame((_,dt)=>{
    if(r1.current) r1.current.rotation.z += dt*(isCenter?0.6:0.5)
    if(r2.current) r2.current.rotation.z -= dt*(isCenter?0.9:0.8)
    if(r3.current) r3.current.rotation.y += dt*0.4
    if(gRef.current){
      const t = hov ? 1.18 : 1
      gRef.current.scale.lerp(new THREE.Vector3(t,t,t), 0.1)
    }
  })

  return (
    <Float speed={1.4+idx*0.08} rotationIntensity={0.08} floatIntensity={isCenter?0.5:0.35}>
      <group ref={gRef} position={portal.pos}
        onPointerOver={()=>{setHov(true);document.body.style.cursor='pointer'}}
        onPointerOut={()=>{setHov(false);document.body.style.cursor=''}}
        onClick={()=>onNav(portal.path)}>

        {/* Ambient glow halo */}
        <mesh>
          <sphereGeometry args={[size*2.2,16,16]}/>
          <meshStandardMaterial color={portal.glow} emissive={portal.glow}
            emissiveIntensity={0.12} transparent opacity={hov?0.12:0.05} depthWrite={false}/>
        </mesh>

        {/* Main body */}
        <mesh>
          <icosahedronGeometry args={[size,4]}/>
          <MeshDistortMaterial color={portal.color} emissive={portal.color}
            emissiveIntensity={hov?1.1:0.55} distort={hov?0.5:0.25} speed={2.5}
            metalness={0.5} roughness={0.08} transparent opacity={0.93}/>
        </mesh>

        {/* Inner core */}
        <mesh>
          <sphereGeometry args={[size*0.52,16,16]}/>
          <meshStandardMaterial color={portal.glow} emissive={portal.glow}
            emissiveIntensity={hov?3.5:1.8} transparent opacity={0.65}/>
        </mesh>

        {/* Ring 1 */}
        <mesh ref={r1} rotation={[Math.PI/3,0,0]}>
          <torusGeometry args={[size*1.55,0.025,8,80]}/>
          <meshStandardMaterial color={portal.glow} emissive={portal.glow} emissiveIntensity={2.2}/>
        </mesh>
        {/* Ring 2 */}
        <mesh ref={r2} rotation={[Math.PI/5,Math.PI/4,0]}>
          <torusGeometry args={[size*1.85,0.018,8,80]}/>
          <meshStandardMaterial color={portal.color} emissive={portal.color} emissiveIntensity={1.6} transparent opacity={0.82}/>
        </mesh>
        {/* Ring 3 equator */}
        <mesh ref={r3}>
          <torusGeometry args={[size*1.3,0.012,8,64]}/>
          <meshStandardMaterial color={portal.glow} emissive={portal.glow} emissiveIntensity={1.2} transparent opacity={0.65}/>
        </mesh>

        <pointLight color={portal.glow} intensity={hov?4:1.4} distance={5} decay={2}/>

        {/* Label */}
        <Billboard position={[0,-(size+0.55),0]}>
          <Html center distanceFactor={13}>
            <div onClick={()=>onNav(portal.path)} style={{
              background:'rgba(5,15,30,0.84)',
              border:`1px solid ${portal.glow}60`,
              borderRadius:8, padding:'4px 11px',
              color:'#f1f5f9', fontSize:11, fontWeight:800,
              whiteSpace:'nowrap', textAlign:'center',
              backdropFilter:'blur(8px)',
              boxShadow:`0 0 16px ${portal.glow}55, inset 0 0 0 1px rgba(255,255,255,0.05)`,
              cursor:'pointer', letterSpacing:'0.03em', transition:'all 0.15s',
            }}>
              {portal.label}
              <div style={{fontSize:9,color:portal.glow,fontWeight:600,marginTop:1,opacity:0.92}}>{portal.sub}</div>
            </div>
          </Html>
        </Billboard>
      </group>
    </Float>
  )
}

/* ─── 3D Ship with trail ────────────────────────────────────────── */
function Ship({ shipRef }) {
  const gRef = useRef()
  const trailTarget = useRef()

  useFrame(()=>{
    if(!gRef.current||!shipRef.current) return
    const s = shipRef.current
    gRef.current.position.set(s.x, 0.22, s.z)
    gRef.current.rotation.y = -(s.angle - 90) * Math.PI / 180
  })

  return (
    <group ref={gRef}>
      <Trail width={0.9} length={10} color={new THREE.Color('#60c8f0')} attenuation={t=>t*t} target={trailTarget}>
        <object3D ref={trailTarget}/>
      </Trail>
      {/* Hull */}
      <mesh castShadow>
        <boxGeometry args={[1.1,0.22,0.38]}/>
        <meshStandardMaterial color="#7c3a1a" metalness={0.45} roughness={0.55}/>
      </mesh>
      {/* Deck */}
      <mesh position={[0,0.14,0]} castShadow>
        <boxGeometry args={[0.9,0.12,0.28]}/>
        <meshStandardMaterial color="#9b4a22" metalness={0.3} roughness={0.5}/>
      </mesh>
      {/* Main mast */}
      <mesh position={[0.08,0.65,0]} castShadow>
        <cylinderGeometry args={[0.018,0.024,0.9,8]}/>
        <meshStandardMaterial color="#3d2510" roughness={0.8}/>
      </mesh>
      {/* Sail — billowing with wind */}
      <mesh position={[0.22,0.78,0.1]} rotation={[0,0.1,0]} castShadow>
        <planeGeometry args={[0.36,0.5]}/>
        <meshStandardMaterial color="#fefce8" side={THREE.DoubleSide} transparent opacity={0.97}/>
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
      {/* Wake glow */}
      <pointLight color="#60c8f0" intensity={1.2} distance={3} position={[-0.55,0,0]}/>
      <mesh position={[-0.55,0,0]}>
        <sphereGeometry args={[0.065,8,8]}/>
        <meshStandardMaterial emissive="#60c8f0" emissiveIntensity={3} color="#60c8f0"/>
      </mesh>
    </group>
  )
}

/* ─── Camera follows ship ───────────────────────────────────────── */
function CameraRig({ shipRef }) {
  const { camera } = useThree()
  const smooth = useRef(new THREE.Vector3(0,13,10))
  const lookAt = useRef(new THREE.Vector3())
  useFrame(()=>{
    const sx = shipRef.current?.x ?? 0
    const sz = shipRef.current?.z ?? 0
    smooth.current.lerp(new THREE.Vector3(sx, 13, sz + 10), 0.035)
    lookAt.current.lerp(new THREE.Vector3(sx, 0, sz), 0.05)
    camera.position.copy(smooth.current)
    camera.lookAt(lookAt.current)
  })
  return null
}

/* ─── Connection lines ──────────────────────────────────────────── */
function ConnectionLines({ hovered }) {
  const EDGES = [[0,1],[0,2],[0,3],[0,4],[0,5],[0,6],[0,7],[1,4],[2,9],[3,6],[5,9],[7,10]]
  return (
    <>
      {EDGES.map(([a,b],i)=>{
        const pa=PORTALS[a], pb=PORTALS[b]
        const active = hovered===a||hovered===b
        return (
          <line key={i}>
            <bufferGeometry>
              <bufferAttribute attach="attributes-position" count={2}
                array={new Float32Array([pa.pos[0],pa.pos[1],pa.pos[2],pb.pos[0],pb.pos[1],pb.pos[2]])}
                itemSize={3}/>
            </bufferGeometry>
            <lineBasicMaterial color={active?pa.glow:'#2a5a8a'} transparent opacity={active?0.85:0.28} linewidth={1}/>
          </line>
        )
      })}
    </>
  )
}

/* ─── Main 3D scene ─────────────────────────────────────────────── */
function Scene({ shipRef, navigate }) {
  const [hovered, setHovered] = useState(null)
  return (
    <>
      {/* Realistic atmospheric sky with sun */}
      <Sky
        sunPosition={SUN_POS}
        turbidity={7}
        rayleigh={1.4}
        mieCoefficient={0.006}
        mieDirectionalG={0.82}
        inclination={0.48}
        azimuth={0.25}
      />

      {/* Sun lighting */}
      <directionalLight position={SUN_POS} intensity={3.2} color="#fff5d0" castShadow
        shadow-mapSize={[2048,2048]} shadow-camera-far={80} shadow-camera-near={0.5}
        shadow-camera-left={-30} shadow-camera-right={30}
        shadow-camera-top={30} shadow-camera-bottom={-30}/>
      <ambientLight intensity={0.48} color="#c8d8f0"/>
      <hemisphereLight skyColor="#7ecbe8" groundColor="#4a6a1e" intensity={0.7}/>

      {/* Atmospheric haze — realistic horizon fog */}
      <fog attach="fog" args={['#b0cfe0', 42, 92]}/>

      {/* Scene geometry */}
      <Terrain/>
      <Ocean/>

      {/* Volumetric clouds */}
      <CloudLayer/>

      {/* God rays from sun */}
      <SunShafts/>

      {/* Great Lakes */}
      {LAKES.map(lake => <GreatLake key={lake.name} lake={lake}/>)}

      {/* Portal network */}
      <ConnectionLines hovered={hovered}/>
      {PORTALS.map((p,i)=>(
        <PortalNode key={p.path} portal={p} idx={i} onNav={navigate}/>
      ))}

      {/* Ship */}
      <Ship shipRef={shipRef}/>

      {/* Camera */}
      <CameraRig shipRef={shipRef}/>

      {/* Subtle bloom — real scenes don't need heavy bloom */}
      <Effects disableGamma>
        <unrealBloomPass threshold={0.45} strength={0.35} radius={0.55}/>
      </Effects>
    </>
  )
}

/* ─── Ship controls ─────────────────────────────────────────────── */
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
      s.x=Math.max(-18,Math.min(18, s.x+Math.cos(rad)*s.speed))
      s.z=Math.max(-18,Math.min(18, s.z+Math.sin(rad)*s.speed))
      shipRef.current={...s}
      setRender({...s})
      raf=requestAnimationFrame(loop)
    }
    raf=requestAnimationFrame(loop)
    return()=>cancelAnimationFrame(raf)
  },[])

  return { shipRef, shipRender: render }
}

/* ─── Page ──────────────────────────────────────────────────────── */
export default function QuickActions() {
  const navigate = useNavigate()
  const { shipRef, shipRender } = useShipControls()
  const speed = Math.abs(shipRender.speed)
  const heading = ((shipRender.angle%360)+360)%360

  return (
    <div style={{ position:'relative', width:'100%', height:'calc(100vh - 88px)', overflow:'hidden', borderRadius:16, background:'#7ecbe8' }}>

      <Canvas
        dpr={[1,1.8]}
        camera={{ position:[0,13,10], fov:52, near:0.1, far:200 }}
        gl={{ antialias:true, alpha:false, toneMapping:THREE.ACESFilmicToneMapping, toneMappingExposure:1.15 }}
        shadows
        style={{ position:'absolute', inset:0 }}
      >
        <Suspense fallback={null}>
          <Scene shipRef={shipRef} navigate={navigate}/>
        </Suspense>
      </Canvas>

      {/* Title */}
      <div style={{
        position:'absolute', top:16, left:'50%', transform:'translateX(-50%)',
        textAlign:'center', pointerEvents:'none', zIndex:10,
      }}>
        <div style={{ fontSize:9, letterSpacing:'0.35em', color:'rgba(255,255,255,0.82)', fontWeight:700,
          fontFamily:'system-ui', marginBottom:4, textTransform:'uppercase',
          textShadow:'0 1px 6px rgba(0,0,0,0.5)' }}>
          SOURCE WATER
        </div>
        <div style={{ fontSize:18, fontWeight:900, color:'#fff', fontFamily:'system-ui', letterSpacing:'0.08em',
          textShadow:'0 2px 20px rgba(0,80,160,0.6), 0 0 6px rgba(255,255,255,0.4)', textTransform:'uppercase' }}>
          The Great Lakes Water Network
        </div>
        <div style={{ fontSize:10, color:'rgba(255,255,255,0.65)', marginTop:3, fontFamily:'system-ui',
          letterSpacing:'0.2em', textShadow:'0 1px 4px rgba(0,0,0,0.4)' }}>
          CLICK A NODE TO NAVIGATE
        </div>
      </div>

      {/* HUD */}
      <div style={{
        position:'absolute', bottom:16, left:16, zIndex:10,
        background:'rgba(4,14,32,0.82)', border:'1px solid rgba(60,130,200,0.35)',
        borderRadius:12, padding:'12px 16px', backdropFilter:'blur(12px)',
        boxShadow:'0 4px 24px rgba(0,0,0,0.35), 0 0 16px rgba(30,100,180,0.15)',
        fontFamily:'system-ui',
      }}>
        <div style={{ fontSize:9, fontWeight:800, color:'#60c8f0', letterSpacing:'0.15em', marginBottom:8 }}>HELM CONTROL</div>
        {[['W / ↑','Forward'],['S / ↓','Reverse'],['A / ←','Port'],['D / →','Starboard']].map(([k,v])=>(
          <div key={k} style={{ display:'flex', justifyContent:'space-between', gap:20, marginBottom:4 }}>
            <span style={{ fontSize:10, fontWeight:800, color:'#90d8f8',
              background:'rgba(30,100,180,0.2)', padding:'1px 6px', borderRadius:4,
              border:'1px solid rgba(60,130,200,0.3)' }}>{k}</span>
            <span style={{ fontSize:10, color:'rgba(255,255,255,0.45)', fontWeight:600 }}>{v}</span>
          </div>
        ))}
        <div style={{ marginTop:10, paddingTop:8, borderTop:'1px solid rgba(60,130,200,0.2)',
          display:'grid', gridTemplateColumns:'1fr 1fr', gap:6 }}>
          <div>
            <div style={{ fontSize:8, color:'rgba(144,216,248,0.5)', letterSpacing:'0.1em', marginBottom:2 }}>SPEED</div>
            <div style={{ height:3, background:'rgba(255,255,255,0.08)', borderRadius:2, overflow:'hidden' }}>
              <div style={{ height:'100%', width:`${(speed/0.55)*100}%`,
                background:'linear-gradient(90deg,#1e7fc4,#60c8f0)',
                transition:'width 0.1s', boxShadow:'0 0 6px #60c8f0' }}/>
            </div>
          </div>
          <div>
            <div style={{ fontSize:8, color:'rgba(144,216,248,0.5)', letterSpacing:'0.1em', marginBottom:1 }}>HDG</div>
            <div style={{ fontSize:13, fontWeight:900, color:'#60c8f0', textShadow:'0 0 8px #1e7fc4' }}>{Math.round(heading)}°</div>
          </div>
        </div>
      </div>

      {/* Compass */}
      <div style={{ position:'absolute', bottom:16, right:16, zIndex:10 }}>
        <svg width={72} height={72} viewBox="0 0 72 72">
          <circle cx={36} cy={36} r={34} fill="rgba(4,14,32,0.82)" stroke="rgba(60,130,200,0.4)" strokeWidth={1.5}/>
          <circle cx={36} cy={36} r={29} fill="none" stroke="rgba(60,130,200,0.18)" strokeWidth={0.8} strokeDasharray="3 3"/>
          {['N','E','S','W'].map((d,i)=>{
            const a=i*90*Math.PI/180-Math.PI/2
            return <text key={d} x={36+Math.cos(a)*22} y={36+Math.sin(a)*22+4}
              textAnchor="middle" fontSize={d==='N'?10:8} fontWeight={800}
              fill={d==='N'?'#ef4444':'rgba(144,216,248,0.75)'} fontFamily="system-ui">{d}</text>
          })}
          <g transform={`rotate(${heading} 36 36)`}>
            <polygon points="36,10 33.5,36 36,32 38.5,36" fill="#ef4444"/>
            <polygon points="36,62 33.5,36 36,40 38.5,36" fill="rgba(144,216,248,0.65)"/>
          </g>
          <circle cx={36} cy={36} r={4} fill="none" stroke="rgba(60,130,200,0.5)" strokeWidth={1}/>
          <circle cx={36} cy={36} r={2} fill="#60c8f0"/>
        </svg>
      </div>
    </div>
  )
}
