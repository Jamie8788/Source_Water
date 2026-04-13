import { Canvas, useFrame, useThree, useLoader } from '@react-three/fiber'
import { Sky, Cloud, Html, Trail, Billboard, Environment } from '@react-three/drei'
import * as THREE from 'three'
import { Component, useRef, useState, useEffect, useMemo, useCallback, Suspense } from 'react'

class CanvasErrorBoundary extends Component {
  constructor(p) { super(p); this.state = { err: null } }
  static getDerivedStateFromError(err) { return { err } }
  componentDidCatch(err, info) { console.error('[QuickActions Canvas crashed]', err, info) }
  render() {
    if (this.state.err) {
      return (
        <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:12, padding:24, background:'#0a0a14', color:'#e2e8f0', fontFamily:'system-ui', textAlign:'center' }}>
          <div style={{ fontSize:18, fontWeight:700 }}>3D map failed to load</div>
          <div style={{ fontSize:12, opacity:0.7, maxWidth:480 }}>{String(this.state.err?.message || this.state.err)}</div>
          <button onClick={()=>this.setState({ err:null })} style={{ marginTop:8, padding:'8px 16px', background:'#1e40af', color:'#fff', border:0, borderRadius:8, cursor:'pointer', fontWeight:600 }}>Retry</button>
        </div>
      )
    }
    return this.props.children
  }
}
import { useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Sparkles as SparklesIcon, Map, BellRing, FileBarChart2,
  Users, BookOpen, GraduationCap, LineChart, Microscope,
  FlaskConical, CloudSun, Joystick,
} from 'lucide-react'

const SUN_POS  = [-45, 12, -55]
const SUN_DIR  = new THREE.Vector3(-45, 12, -55).normalize()
const SUN_COL  = new THREE.Color('#ff9a30')

/* ─── Portals ───────────────────────────────────────────────────── */
const PORTALS = [
  { label:'Dashboard',     sub:'Overview',         path:'/dashboard', color:'#1a78c2', glow:'#4db6f5', svgX:52, svgY:44 },
  { label:'Ask Water AI',  sub:'Talk to Water',    path:'/ask-water', color:'#7c3aed', glow:'#a78bfa', svgX:78, svgY:24 },
  { label:'Live Map',      sub:'Explore',          path:'/map',       color:'#0e7490', glow:'#22d3ee', svgX:20, svgY:28 },
  { label:'Alerts',        sub:'Stay notified',    path:'/alerts',    color:'#b45309', glow:'#fcd34d', svgX:52, svgY:13 },
  { label:'Reports',       sub:'Stats & trends',   path:'/reports',   color:'#1d4ed8', glow:'#60a5fa', svgX:82, svgY:50 },
  { label:'Community',     sub:'Connect',          path:'/social',    color:'#be185d', glow:'#f472b6', svgX:10, svgY:56 },
  { label:'Resources',     sub:'Learn & explore',  path:'/resources', color:'#166534', glow:'#4ade80', svgX:32, svgY:70 },
  { label:'Quiz & Learn',  sub:'Test yourself',    path:'/quiz',      color:'#9a3412', glow:'#fb923c', svgX:68, svgY:72 },
  { label:'Data Analysis', sub:'Deep dive',        path:'/analysis',  color:'#1e3a8a', glow:'#818cf8', svgX:84, svgY:35 },
  { label:'Research Hub',  sub:'Projects & tools', path:'/research',  color:'#581c87', glow:'#c084fc', svgX:16, svgY:72 },
  { label:'Projects',      sub:'Build & track',    path:'/projects',  color:'#134e4a', glow:'#5eead4', svgX:60, svgY:84 },
  { label:'Weather',       sub:'Conditions',       path:'/weather',   color:'#0c4a6e', glow:'#7dd3fc', svgX:36, svgY:17 },
  { label:'Games',         sub:'Water activities', path:'/games',     color:'#4a044e', glow:'#e879f9', svgX:20, svgY:84 },
].map(p => ({ ...p, pos: [(p.svgX-50)*0.22, 2.4, (p.svgY-50)*0.22] }))

/* ─── Great Lakes ───────────────────────────────────────────────── */
const LAKES = [
  { name:'Lake Superior', color:'#1a6090', emissive:'#1e8ac0', labelPos:[-2.5,0.5,-7.2],
    pts:[[-6.8,-8.8],[-4.4,-9.2],[-1.6,-9.2],[0.4,-8.6],[1.6,-7.8],[1.4,-6.6],[0,-5.2],[-1,-4.6],[-3,-4.6],[-5.2,-5.2],[-6.8,-6.2]] },
  { name:'L. Michigan',   color:'#1559a0', emissive:'#1e7fc4', labelPos:[-3.2,0.5,-0.8],
    pts:[[-3.6,-5],[-4.4,-3.4],[-4.2,-1],[-3.8,1.2],[-3.2,3],[-2.4,2.8],[-1.8,1.8],[-1.8,-0.8],[-2,-2.8],[-2.8,-5]] },
  { name:'Lake Huron',    color:'#186e98', emissive:'#1a90c0', labelPos:[1.2,0.5,-3.2],
    pts:[[-0.6,-6.6],[1,-6.8],[2.4,-6.2],[3.6,-5.2],[3.6,-3.6],[3.4,-1.8],[2.6,-0.4],[1.2,0.4],[0,0.4],[-0.8,-0.4],[-1.6,-2.4],[-0.8,-5.6]] },
  { name:'Lake Erie',     color:'#147a62', emissive:'#1aaa88', labelPos:[1.4,0.5,2],
    pts:[[-2.2,0.6],[0.2,0.2],[1.8,0.6],[3.4,0.8],[4.4,1.6],[4.4,2.8],[3.6,3.4],[1.6,3.4],[-0.2,3.2],[-1.4,2.6],[-2.2,1.8]] },
  { name:'L. Ontario',    color:'#1a5c80', emissive:'#1e80aa', labelPos:[5.2,0.5,1.8],
    pts:[[3.6,0.2],[5.2,0],[6.8,0.6],[7.4,1.4],[7.2,2.8],[6.2,3.2],[4.6,3.2],[3.6,2.4],[3.2,1.4]] },
]

/* ─── Gerstner wave ocean shader (military-grade simulation) ────── */
const WATER_VERT = `
  uniform float uTime;
  varying vec2  vUv;
  varying float vWave;
  varying vec3  vNormal;
  varying vec3  vViewDir;
  varying vec3  vWorldPos;

  #define PI 3.14159265358979

  // Gerstner wave: circular orbit motion — used in Sea of Thieves, AC Black Flag
  vec3 gerstner(vec4 w, vec3 p, inout vec3 tan, inout vec3 bin) {
    float k  = 2.0 * PI / w.w;
    float c  = sqrt(9.81 / k);
    vec2  d  = normalize(w.xy);
    float f  = k * (dot(d, p.xz) - c * uTime);
    float a  = w.z / k;
    float sf = sin(f); float cf = cos(f);
    tan += vec3(-d.x*d.x*w.z*sf,  d.x*w.z*cf, -d.x*d.y*w.z*sf);
    bin += vec3(-d.x*d.y*w.z*sf,  d.y*w.z*cf, -d.y*d.y*w.z*sf);
    return vec3(d.x*(a*cf), a*sf, d.y*(a*cf));
  }

  void main(){
    vUv = uv;
    vec3 p   = position;
    vec3 tan = vec3(1,0,0);
    vec3 bin = vec3(0,0,1);

    // 5 wave trains — gentle swells around the map island
    vec3 disp = vec3(0);
    disp += gerstner(vec4( 1.0,  0.0,  0.14, 16.0), p, tan, bin);
    disp += gerstner(vec4( 0.0,  1.0,  0.10, 10.0), p, tan, bin);
    disp += gerstner(vec4( 0.7,  0.7,  0.07,  6.0), p, tan, bin);
    disp += gerstner(vec4(-0.5,  1.0,  0.05,  3.5), p, tan, bin);
    disp += gerstner(vec4( 0.3, -0.8,  0.03,  2.2), p, tan, bin);

    p += disp;
    vWave  = disp.y;
    vNormal = normalize(cross(bin, tan));
    vec4 wPos = modelMatrix * vec4(p, 1.0);
    vWorldPos = wPos.xyz;
    vViewDir  = normalize(cameraPosition - wPos.xyz);
    gl_Position = projectionMatrix * viewMatrix * wPos;
  }
`
const WATER_FRAG = `
  uniform float uTime;
  uniform vec3  uSunDir;
  uniform vec3  uSunCol;
  varying vec2  vUv;
  varying float vWave;
  varying vec3  vNormal;
  varying vec3  vViewDir;
  varying vec3  vWorldPos;

  void main(){
    vec3 N = normalize(vNormal);
    vec3 V = normalize(vViewDir);
    vec3 L = normalize(uSunDir);

    // ── Fresnel (Schlick) ─────────────────────────────────────────
    float NdotV = max(dot(N, V), 0.0);
    float fr = 0.02 + 0.98 * pow(1.0 - NdotV, 5.0);

    // ── PBR lighting ─────────────────────────────────────────────
    float diff = max(dot(N, L), 0.0);
    vec3  H    = normalize(L + V);
    float NdotH = max(dot(N, H), 0.0);
    // Blinn-Phong with two lobes: tight highlight + broad sheen
    float sp1  = pow(NdotH, 1200.0) * 3.5;   // pinpoint sun glint
    float sp2  = pow(NdotH, 80.0)  * 0.55;   // broad sheen
    float sp3  = pow(NdotH, 12.0)  * 0.12;   // very wide diffuse sheen

    // ── Subsurface scatter approximation (depth glow) ─────────────
    float sss  = pow(max(dot(-V, L), 0.0), 4.0) * 0.35;

    // ── Caustic shimmer in shallows ───────────────────────────────
    float cau  = sin(vWorldPos.x*3.0+uTime*2.2)*sin(vWorldPos.z*3.5+uTime*1.8)*0.5+0.5;
    cau        = cau * cau * 0.10;

    // ── Deep ocean PBR palette (AC Black Flag style) ──────────────
    vec3 abyss = vec3(0.00,  0.01,  0.06);
    vec3 deep  = vec3(0.003, 0.045, 0.18);
    vec3 mid   = vec3(0.008, 0.15,  0.32);
    vec3 crest = vec3(0.03,  0.30,  0.46);

    float d    = clamp(vWave * 0.75 + diff * 0.40 + cau, 0.0, 1.0);
    vec3 col   = mix(abyss, deep,  clamp(d * 2.5,       0.0, 1.0));
    col        = mix(col,   mid,   clamp((d-0.28)*2.8,  0.0, 1.0));
    col        = mix(col,   crest, clamp((d-0.58)*3.0,  0.0, 1.0));

    // ── Subsurface teal glow ──────────────────────────────────────
    col       += vec3(0.0, 0.12, 0.18) * sss;

    // ── Whitecaps — Gerstner peaks ────────────────────────────────
    float foam = smoothstep(0.25, 0.55, vWave);
    col        = mix(col, vec3(0.92, 0.98, 1.00), foam * 0.88);
    // Spray gloss
    col        = mix(col, vec3(0.78, 0.90, 0.96), smoothstep(0.48, 0.68, vWave) * 0.40);

    // ── Sun glint (all three lobes) ───────────────────────────────
    col       += uSunCol * (sp1 + sp2 + sp3);

    // ── Sky / environment reflection via Fresnel ──────────────────
    vec3 skyCol = vec3(0.04, 0.09, 0.28);   // dark stormy sky
    col         = mix(col, skyCol, fr * 0.65);

    // ── Final brightness ──────────────────────────────────────────
    col        *= (0.40 + diff * 0.60);

    // ── Edge fade ─────────────────────────────────────────────────
    vec2 ed    = abs(vUv - 0.5) * 2.0;
    float fade = 1.0 - smoothstep(0.70, 1.0, max(ed.x, ed.y));
    gl_FragColor = vec4(col, fade * 0.98);
  }
`

function Ocean() {
  const mat = useRef()
  const uni = useMemo(()=>({ uTime:{value:0}, uSunDir:{value:SUN_DIR}, uSunCol:{value:SUN_COL} }),[])
  useFrame(({clock})=>{ if(mat.current) mat.current.uniforms.uTime.value=clock.getElapsedTime() })
  return (
    <mesh rotation={[-Math.PI/2,0,0]} position={[0,-1.6,0]}>
      <planeGeometry args={[80,80,80,80]}/>
      <shaderMaterial ref={mat} uniforms={uni} vertexShader={WATER_VERT} fragmentShader={WATER_FRAG} transparent side={THREE.DoubleSide}/>
    </mesh>
  )
}

/* ─── Safe map surface loader with error catch ─ */
function MapSurfaceWrapper() {
  try {
    return <MapSurface/>
  } catch (err) {
    console.error('[MapSurface error]', err)
    // Return fallback mesh instead of crashing
    return (
      <group>
        <mesh rotation={[-Math.PI/2,0,0]} position={[0,0.08,0]}>
          <planeGeometry args={[29,29,2,2]}/>
          <meshStandardMaterial color="#1e3a5a" roughness={0.78} metalness={0}/>
        </mesh>
      </group>
    )
  }
}

/* ─── Geographic map surface — loads worldmap.jpg via R3F useLoader ─ */
function MapSurface() {
  const { gl } = useThree()
  const tex = useLoader(THREE.TextureLoader, '/textures/worldmap.jpg')
  const detailTex = useMemo(() => {
    const c = document.createElement('canvas')
    c.width = 512
    c.height = 512
    const ctx = c.getContext('2d')
    if (ctx) {
      const img = ctx.createImageData(c.width, c.height)
      for (let i = 0; i < img.data.length; i += 4) {
        const n = 120 + Math.floor(Math.random() * 70)
        img.data[i] = n
        img.data[i + 1] = n
        img.data[i + 2] = n
        img.data[i + 3] = 255
      }
      ctx.putImageData(img, 0, 0)
    }
    const t = new THREE.CanvasTexture(c)
    t.wrapS = t.wrapT = THREE.RepeatWrapping
    t.repeat.set(10, 10)
    t.needsUpdate = true
    return t
  }, [])
  useMemo(() => {
    tex.colorSpace = THREE.SRGBColorSpace
    tex.anisotropy = gl.capabilities.getMaxAnisotropy()
    tex.generateMipmaps = true
    tex.needsUpdate = true
  }, [tex, gl])
  return (
    <group>
      <mesh rotation={[-Math.PI/2,0,0]} position={[0,0.08,0]}>
        <planeGeometry args={[29,29,180,180]}/>
        <meshStandardMaterial map={tex} displacementMap={tex} displacementScale={0.11} displacementBias={-0.055} roughness={0.58} metalness={0.06} color="#ffffff" polygonOffset polygonOffsetFactor={-1} polygonOffsetUnits={-1}/>
      </mesh>
      {/* grain and micro-contrast for satellite-style detail */}
      <mesh rotation={[-Math.PI/2,0,0]} position={[0,0.105,0]}>
        <planeGeometry args={[29,29,1,1]}/>
        <meshBasicMaterial map={detailTex} color="#d7dde5" transparent opacity={0.065} blending={THREE.MultiplyBlending} depthWrite={false}/>
      </mesh>
      {/* subtle glossy varnish for a richer map-board look */}
      <mesh rotation={[-Math.PI/2,0,0]} position={[0,0.11,0]}>
        <planeGeometry args={[29,29,1,1]}/>
        <meshPhysicalMaterial color="#8ec5ff" transparent opacity={0.06} roughness={0.12} metalness={0.25} clearcoat={1} clearcoatRoughness={0.14} depthWrite={false}/>
      </mesh>
    </group>
  )
}

function MapPlatform() {
  return (
    <group>
      {/* Deep ocean base */}
      <mesh rotation={[-Math.PI/2,0,0]} position={[0,-0.55,0]} receiveShadow>
        <planeGeometry args={[160,160]}/>
        <meshStandardMaterial color="#05121e" roughness={1} metalness={0}/>
      </mesh>

      {/* Map board sides */}
      <mesh position={[0,-0.22,0]} receiveShadow castShadow>
        <boxGeometry args={[29.2,0.52,29.2]}/>
        <meshStandardMaterial color="#3a2508" roughness={0.96} metalness={0}/>
      </mesh>
      {/* Thin top lip */}
      <mesh position={[0,0,0]} receiveShadow castShadow>
        <boxGeometry args={[29.4,0.06,29.4]}/>
        <meshStandardMaterial color="#2a1804" roughness={0.97} metalness={0}/>
      </mesh>

      {/* Map surface — Suspense only around this one mesh */}
      <Suspense fallback={
        <mesh rotation={[-Math.PI/2,0,0]} position={[0,0.08,0]}>
          <planeGeometry args={[29,29,2,2]}/>
          <meshStandardMaterial color="#1e3a5a" roughness={0.78} metalness={0}/>
        </mesh>
      }>
        <MapSurfaceWrapper/>
      </Suspense>
    </group>
  )
}

/* ─── Sun shafts ────────────────────────────────────────────────── */
function SunShafts() {
  const g = useRef()
  useFrame(({clock})=>{
    if(!g.current) return
    const t=clock.getElapsedTime()
    g.current.children.forEach((m,i)=>{ if(m.material) m.material.opacity=0.03+Math.sin(t*0.35+i*1.2)*0.012 })
  })
  return (
    <group ref={g} position={[-40,18,-48]} rotation={[0.18,-0.55,-0.04]}>
      {[0,1,2,3,4].map(i=>(
        <mesh key={i} rotation={[0,(i/5)*Math.PI*0.35,0]}>
          <coneGeometry args={[8+i*3,55,4,1,true]}/>
          <meshBasicMaterial color="#ff9f45" transparent opacity={0.03} depthWrite={false} side={THREE.BackSide} blending={THREE.AdditiveBlending}/>
        </mesh>
      ))}
    </group>
  )
}

/* ─── Lens flare billboard ──────────────────────────────────────── */
function LensFlare() {
  const ref = useRef()
  useFrame(({clock})=>{
    if(ref.current) ref.current.material.opacity = 0.68+Math.sin(clock.getElapsedTime()*0.7)*0.18
  })
  return (
    <Billboard position={[-38,10,-48]}>
      <mesh ref={ref}>
        <planeGeometry args={[4,4]}/>
        <meshBasicMaterial color="#ffb36b" transparent opacity={0.3} depthWrite={false} blending={THREE.AdditiveBlending}/>
      </mesh>
    </Billboard>
  )
}

/* ─── Clouds ────────────────────────────────────────────────────── */
function CloudLayer() {
  return (
    <group>
      <Cloud position={[-18,13,-10]} opacity={0.60} speed={0.08} width={11} depth={2}   segments={22} color="#f0f4ff"/>
      <Cloud position={[ 14,15,-14]} opacity={0.66} speed={0.06} width={14} depth={2.5} segments={28} color="white"/>
      <Cloud position={[ -6,12, 11]} opacity={0.50} speed={0.10} width={9}  depth={1.8} segments={18} color="#e8f0ff"/>
      <Cloud position={[ 22,14,  7]} opacity={0.56} speed={0.07} width={12} depth={2}   segments={24} color="white"/>
      <Cloud position={[  2,16,-22]} opacity={0.46} speed={0.05} width={15} depth={2.2} segments={30} color="#f8f8ff"/>
      <Cloud position={[-22,11,  4]} opacity={0.52} speed={0.09} width={10} depth={1.6} segments={20} color="#eef2ff"/>
    </group>
  )
}

/* ─── Atmospheric haze and tiny glints ─────────────────────────── */
function AtmosphereField() {
  const hazeRef = useRef()
  const glitterRef = useRef()

  const hazePos = useMemo(() => {
    const arr = new Float32Array(600 * 3)
    for (let i = 0; i < 600; i++) {
      arr[i * 3] = (Math.random() - 0.5) * 62
      arr[i * 3 + 1] = 1.1 + Math.random() * 6.5
      arr[i * 3 + 2] = (Math.random() - 0.5) * 62
    }
    return arr
  }, [])

  const glitterPos = useMemo(() => {
    const arr = new Float32Array(120 * 3)
    for (let i = 0; i < 120; i++) {
      arr[i * 3] = (Math.random() - 0.5) * 34
      arr[i * 3 + 1] = 0.28 + Math.random() * 0.35
      arr[i * 3 + 2] = (Math.random() - 0.5) * 34
    }
    return arr
  }, [])

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime()
    if (hazeRef.current) hazeRef.current.material.opacity = 0.12 + Math.sin(t * 0.27) * 0.02
    if (glitterRef.current) glitterRef.current.material.opacity = 0.28 + Math.sin(t * 1.3) * 0.12
  })

  return (
    <group>
      <points ref={hazeRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" count={600} array={hazePos} itemSize={3}/>
        </bufferGeometry>
        <pointsMaterial size={0.23} color="#d2e7ff" transparent opacity={0.12} depthWrite={false} blending={THREE.AdditiveBlending}/>
      </points>

      <points ref={glitterRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" count={120} array={glitterPos} itemSize={3}/>
        </bufferGeometry>
        <pointsMaterial size={0.09} color="#b7f3ff" transparent opacity={0.3} depthWrite={false} blending={THREE.AdditiveBlending}/>
      </points>
    </group>
  )
}

/* ─── Great Lake mesh ───────────────────────────────────────────── */
function GreatLake({ lake }) {
  const shape = useMemo(()=>{
    const s=new THREE.Shape()
    s.moveTo(lake.pts[0][0],lake.pts[0][1])
    lake.pts.slice(1).forEach(([x,y])=>s.lineTo(x,y))
    s.closePath(); return s
  },[lake.pts])
  const geo = useMemo(()=>new THREE.ExtrudeGeometry(shape,{ depth:0.35, bevelEnabled:true, bevelThickness:0.06, bevelSize:0.05, bevelSegments:4 }),[shape])
  const [hov,setHov]=useState(false)
  const mRef=useRef()
  useFrame(()=>{ if(mRef.current) mRef.current.material.emissiveIntensity=THREE.MathUtils.lerp(mRef.current.material.emissiveIntensity,hov?0.65:0.22,0.08) })
  return (
    <group>
      <mesh ref={mRef} geometry={geo} rotation={[-Math.PI/2,0,0]}
        onPointerOver={()=>setHov(true)} onPointerOut={()=>setHov(false)}>
        <meshStandardMaterial color={lake.color} emissive={lake.emissive} emissiveIntensity={0.22} metalness={0.12} roughness={0.08} transparent opacity={0.95}/>
      </mesh>
      <mesh geometry={geo} rotation={[-Math.PI/2,0,0]} position={[0,0.02,0]}>
        <meshStandardMaterial color={lake.emissive} emissive={lake.emissive} emissiveIntensity={0.5} transparent opacity={0.13} depthWrite={false}/>
      </mesh>
      <pointLight position={[lake.labelPos[0],1.8,lake.labelPos[2]]} color={lake.emissive} intensity={0.5} distance={6}/>
      <Billboard position={lake.labelPos}>
        <Html center distanceFactor={14}>
          <div style={{ color:'#e0f7ff', fontFamily:'system-ui', fontSize:10, fontWeight:800, fontStyle:'italic',
            textShadow:'0 1px 8px rgba(0,0,0,0.7), 0 0 14px #22d3ee', whiteSpace:'nowrap', pointerEvents:'none', letterSpacing:'0.05em' }}>
            {lake.name}
          </div>
        </Html>
      </Billboard>
    </group>
  )
}

/* ─── Ancient map location pin ───────────────────────────────────── */
function MapBeacon({ portal, idx, onNav, active, docking, dockPulse }) {
  const [hov, setHov] = useState(false)
  const pinHead = useRef(), beam = useRef(), ring = useRef()
  const dockRingA = useRef(), dockRingB = useRef()
  const dockTRef = useRef(-10)
  const isHub   = idx === 0
  const pinH    = isHub ? 2.8 : 2.0
  const headR   = isHub ? 0.28 : 0.20

  useEffect(() => {
    if (docking) dockTRef.current = performance.now()
  }, [dockPulse, docking])

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime()
    const selected = hov || active || docking
    const dockAge = dockTRef.current > 0 ? (performance.now() - dockTRef.current) / 1000 : 999
    const dockWave = dockAge < 1.15 ? (1 - dockAge / 1.15) : 0

    // Pin head gentle float
    if(pinHead.current) pinHead.current.position.y = pinH + headR + Math.sin(t*1.4+idx*0.7)*0.12
    // Pulse beam
    if(beam.current) {
      beam.current.material.opacity = (selected ? 0.58 : 0.22) + Math.sin(t*2+idx)*0.08 + dockWave * 0.2
      beam.current.scale.y = 1 + dockWave * 0.6
    }
    // Ripple ring on map surface
    if(ring.current){
      ring.current.scale.x = ring.current.scale.z = 1 + Math.sin(t*1.2+idx*0.5)*0.08 + (selected ? 0.12 : 0)
      ring.current.material.opacity = (selected ? 0.78 : 0.35) + Math.sin(t*1.2+idx*0.5)*0.1
    }
    if (dockRingA.current) {
      const s = 1 + (1 - dockWave) * 2.8
      dockRingA.current.scale.setScalar(s)
      dockRingA.current.material.opacity = dockWave * 0.65
    }
    if (dockRingB.current) {
      const s = 1 + (1 - dockWave) * 4.4
      dockRingB.current.scale.setScalar(s)
      dockRingB.current.material.opacity = Math.max(0, dockWave - 0.2) * 0.42
    }
  })

  return (
    <group position={[portal.pos[0], 0.09, portal.pos[2]]}
      onPointerOver={()=>{setHov(true);document.body.style.cursor='pointer'}}
      onPointerOut={()=>{setHov(false);document.body.style.cursor=''}}
      onClick={()=>onNav(portal.path, portal.pos, portal.label)}>

      {/* Ripple circle on map surface */}
      <mesh ref={ring} rotation={[-Math.PI/2,0,0]} position={[0,0.01,0]}>
        <ringGeometry args={[headR*1.1, headR*1.6, 32]}/>
        <meshBasicMaterial color={portal.glow} transparent opacity={0.35} depthWrite={false} blending={THREE.AdditiveBlending}/>
      </mesh>
      <mesh ref={dockRingA} rotation={[-Math.PI/2,0,0]} position={[0,0.012,0]}>
        <ringGeometry args={[headR*1.4, headR*2.2, 40]}/>
        <meshBasicMaterial color="#ffffff" transparent opacity={0} depthWrite={false} blending={THREE.AdditiveBlending}/>
      </mesh>
      <mesh ref={dockRingB} rotation={[-Math.PI/2,0,0]} position={[0,0.013,0]}>
        <ringGeometry args={[headR*1.8, headR*2.9, 40]}/>
        <meshBasicMaterial color={portal.glow} transparent opacity={0} depthWrite={false} blending={THREE.AdditiveBlending}/>
      </mesh>
      {/* Base dot on map */}
      <mesh rotation={[-Math.PI/2,0,0]} position={[0,0.02,0]}>
        <circleGeometry args={[headR*0.55,16]}/>
        <meshBasicMaterial color={portal.glow} transparent opacity={0.9}/>
      </mesh>

      {/* Pin stick */}
      <mesh position={[0, pinH*0.5, 0]}>
        <cylinderGeometry args={[0.025, 0.04, pinH, 6]}/>
        <meshStandardMaterial color={portal.color} metalness={0.5} roughness={0.4}/>
      </mesh>

      {/* Pin head — glowing sphere */}
      <group ref={pinHead} position={[0, pinH+headR, 0]}>
        <mesh>
          <sphereGeometry args={[headR*1.3,16,16]}/>
          <meshBasicMaterial color={portal.glow} transparent opacity={0.18} depthWrite={false} blending={THREE.AdditiveBlending}/>
        </mesh>
        <mesh>
          <sphereGeometry args={[headR,16,16]}/>
          <meshStandardMaterial color={portal.color} emissive={portal.glow} emissiveIntensity={selected?3.4:1.6} metalness={0.4} roughness={0.1}/>
        </mesh>
        <pointLight color={portal.glow} intensity={selected?4.6:1.5} distance={5} decay={2}/>

        {/* Light beam upward */}
        <mesh ref={beam} position={[0,5,0]}>
          <cylinderGeometry args={[0.018,0.04,10,5,1,true]}/>
          <meshBasicMaterial color={portal.glow} transparent opacity={0.22} depthWrite={false} side={THREE.DoubleSide} blending={THREE.AdditiveBlending}/>
        </mesh>

        {/* Label */}
        <Billboard position={[0, headR+0.45, 0]}>
          <Html center distanceFactor={13}>
            <div onClick={()=>onNav(portal.path, portal.pos, portal.label)} style={{
              background:'rgba(20,10,5,0.90)',
              border:`1px solid ${portal.glow}80`,
              borderRadius:4, padding:'3px 10px',
              color:'#f5ead5', fontSize:10, fontWeight:800,
              whiteSpace:'nowrap', textAlign:'center',
              backdropFilter:'blur(8px)',
              boxShadow:`0 0 14px ${portal.glow}50`,
              cursor:'pointer', letterSpacing:'0.06em',
              fontFamily:'Georgia, serif',
              textShadow:`0 0 6px ${portal.glow}`,
            }}>
              {portal.label}
              <div style={{fontSize:8,color:portal.glow,fontWeight:600,marginTop:1,letterSpacing:'0.08em'}}>{portal.sub}</div>
            </div>
          </Html>
        </Billboard>
      </group>
    </group>
  )
}

/* ─── Dolphin ───────────────────────────────────────────────────── */
function Dolphin({ offset=0, radius=9, speed=0.28, side=1 }) {
  const gRef = useRef()
  useFrame(({clock})=>{
    const t = clock.getElapsedTime()*speed + offset
    const x = Math.sin(t)*radius*side
    const z = Math.cos(t)*radius - 2
    // Jump arc: periodic leap above surface
    const jp = (clock.getElapsedTime()*0.55+offset*1.8) % (Math.PI*2)
    const raw = Math.sin(jp)
    const jumpY = raw>0 ? raw*raw*3.2 : 0
    const y = jumpY - 0.08
    // Face direction of travel
    const dx = Math.cos(t)*speed*side
    const dz = -Math.sin(t)*speed
    const heading = Math.atan2(dx, dz)
    // Pitch: nose up on ascent, nose down on descent
    const pitch = raw>0 ? -Math.cos(jp)*0.55 : 0
    if(gRef.current){
      gRef.current.position.set(x,y,z)
      gRef.current.rotation.y = heading
      gRef.current.rotation.z = pitch
    }
  })
  return (
    <group ref={gRef}>
      {/* Body */}
      <mesh scale={[1.3,0.38,0.38]}>
        <sphereGeometry args={[0.45,12,8]}/>
        <meshStandardMaterial color="#4a8098" metalness={0.15} roughness={0.35}/>
      </mesh>
      {/* Snout */}
      <mesh position={[0.65,0.04,0]} rotation={[0,0,-Math.PI/2]}>
        <coneGeometry args={[0.09,0.38,8]}/>
        <meshStandardMaterial color="#4a8098"/>
      </mesh>
      {/* Dorsal fin */}
      <mesh position={[0.05,0.28,0]} rotation={[0,0,0.18]}>
        <coneGeometry args={[0.06,0.32,6]}/>
        <meshStandardMaterial color="#3a6a80"/>
      </mesh>
      {/* Tail flukes */}
      <mesh position={[-0.6,0,0]} rotation={[Math.PI/2,0,Math.PI/2]}>
        <boxGeometry args={[0.38,0.06,0.18]}/>
        <meshStandardMaterial color="#4a8098"/>
      </mesh>
      {/* Belly lighter */}
      <mesh scale={[1.1,0.28,0.3]} position={[0,-0.06,0]}>
        <sphereGeometry args={[0.42,12,8]}/>
        <meshStandardMaterial color="#c8dde8" metalness={0.1} roughness={0.4}/>
      </mesh>
    </group>
  )
}

/* ─── Seagull ───────────────────────────────────────────────────── */
function Seagull({ offset=0 }) {
  const ref = useRef()
  useFrame(({clock})=>{
    const t = clock.getElapsedTime()
    const a = t*0.38+offset
    const x = Math.sin(a*1.1)*16
    const z = Math.cos(a*0.9)*12
    const y = 7+Math.sin(t*1.8+offset)*1.2
    const flapA = Math.sin(t*4.5+offset)*0.45
    if(ref.current){
      ref.current.position.set(x,y,z)
      ref.current.rotation.y = Math.atan2(Math.cos(a*1.1)*1.1, Math.sin(a*0.9)*0.9)
      // Flap left/right wings
      if(ref.current.children[1]) ref.current.children[1].rotation.z = flapA+0.2
      if(ref.current.children[2]) ref.current.children[2].rotation.z = -flapA-0.2
    }
  })
  return (
    <group ref={ref}>
      {/* Body */}
      <mesh scale={[0.7,0.22,0.22]}>
        <sphereGeometry args={[0.18,8,6]}/>
        <meshStandardMaterial color="#f8f8f8" roughness={0.7}/>
      </mesh>
      {/* Left wing */}
      <mesh position={[0,0,-0.28]} rotation={[0,0,0.2]}>
        <boxGeometry args={[0.65,0.02,0.22]}/>
        <meshStandardMaterial color="#f0f0f0" roughness={0.7}/>
      </mesh>
      {/* Right wing */}
      <mesh position={[0,0, 0.28]} rotation={[0,0,-0.2]}>
        <boxGeometry args={[0.65,0.02,0.22]}/>
        <meshStandardMaterial color="#f0f0f0" roughness={0.7}/>
      </mesh>
    </group>
  )
}

/* ─── Spray particles — bow wake + hull foam ─────────────────────── */
const SPRAY_COUNT = 80
function ShipSpray({ shipRef }) {
  const pts  = useRef()
  const matRef = useRef()
  const pos  = useMemo(() => new Float32Array(SPRAY_COUNT * 3), [])
  const vel  = useRef(Array.from({ length: SPRAY_COUNT }, (_, i) => ({
    x:0, y:0, z:0, life: Math.random(), maxLife: 0.5 + Math.random() * 0.8
  })))

  useFrame(() => {
    if (!shipRef.current || !pts.current || !matRef.current) return
    const s   = shipRef.current
    const spd = Math.abs(s.speed ?? 0)
    const rad = (s.angle - 90) * Math.PI / 180
    const bx  = s.x - Math.cos(rad) * 0.8
    const bz  = s.z - Math.sin(rad) * 0.8
    const sx  = s.x + Math.cos(rad) * 1.65
    const sz  = s.z + Math.sin(rad) * 1.65

    matRef.current.opacity = THREE.MathUtils.lerp(matRef.current.opacity, 0.15 + spd * 1.1, 0.08)
    matRef.current.size = THREE.MathUtils.lerp(matRef.current.size, 0.03 + spd * 0.08, 0.08)

    vel.current.forEach((v, i) => {
      v.life -= 0.025 * spd * 6
      if (v.life <= 0) {
        const sternSpawn = Math.random() < 0.45
        const baseX = sternSpawn ? sx : bx
        const baseZ = sternSpawn ? sz : bz
        pos[i*3]   = baseX + (Math.random()-0.5)*(sternSpawn?1.2:0.5)
        pos[i*3+1] = 0.7 + Math.random()*0.4
        pos[i*3+2] = baseZ + (Math.random()-0.5)*(sternSpawn?0.9:0.5)
        v.x = (Math.random()-0.5)*(sternSpawn?0.08:0.06) - Math.cos(rad)*0.05*spd
        v.y = 0.04 + Math.random()*0.08
        v.z = (Math.random()-0.5)*(sternSpawn?0.08:0.06) - Math.sin(rad)*0.05*spd
        v.life = v.maxLife
      }
      pos[i*3]   += v.x
      pos[i*3+1] += v.y; v.y -= 0.003  // gravity
      pos[i*3+2] += v.z
    })
    pts.current.geometry.attributes.position.needsUpdate = true
  })

  return (
    <points ref={pts}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={SPRAY_COUNT} array={pos} itemSize={3}/>
      </bufferGeometry>
      <pointsMaterial ref={matRef} color="#d7f3ff" size={0.055} transparent opacity={0.22}
        depthWrite={false} blending={THREE.AdditiveBlending}/>
    </points>
  )
}

/* ─── Ship — hand-built tall ship (no GLB needed) ───────────────── */
function Ship({ shipRef }) {
  const gRef       = useRef()
  const trailTarget = useRef()
  const trailL = useRef()
  const trailR = useRef()
  const sail1Ref   = useRef()
  const sail2Ref   = useRef()
  const sail3Ref   = useRef()
  const flagRef    = useRef()

  useFrame(({ clock }) => {
    if (!gRef.current || !shipRef.current) return
    const s   = shipRef.current
    const t   = clock.getElapsedTime()
    const spd = Math.abs(s.speed ?? 0)
    gRef.current.position.set(s.x, 0.28, s.z)
    gRef.current.rotation.y = -(s.angle - 90) * Math.PI / 180
    // Realistic ocean roll — more pronounced at speed
    gRef.current.rotation.z = Math.sin(t * 0.75) * (0.025 + spd * 0.08)
    gRef.current.rotation.x = Math.sin(t * 0.55 + 1.2) * 0.018
    // Sail billow — wind effect
    const billow = Math.sin(t * 0.45) * 0.06
    if (sail1Ref.current) sail1Ref.current.rotation.y = billow
    if (sail2Ref.current) sail2Ref.current.rotation.y = billow * 0.8 + 0.04
    if (sail3Ref.current) sail3Ref.current.rotation.y = billow * 0.6 + 0.03
    // Flag whip
    if (flagRef.current) { flagRef.current.rotation.z = Math.sin(t * 4.2) * 0.18 + 0.25 }
    if (trailTarget.current) trailTarget.current.position.set(0, -0.08, -1.95)
    if (trailL.current) trailL.current.position.set(0.28, -0.1, -1.7)
    if (trailR.current) trailR.current.position.set(-0.28, -0.1, -1.7)
  })

  return (
    <group ref={gRef}>
      <Trail width={2.4} length={24} color={new THREE.Color('#70d8f8')} attenuation={t => t * t}>
        <object3D ref={trailTarget} />
      </Trail>
      <Trail width={1.1} length={20} color={new THREE.Color('#b9edff')} attenuation={t => t * t}>
        <object3D ref={trailL} />
      </Trail>
      <Trail width={1.1} length={20} color={new THREE.Color('#b9edff')} attenuation={t => t * t}>
        <object3D ref={trailR} />
      </Trail>

      {/* ── Hull ── */}
      {/* Main hull body */}
      <mesh position={[0, 0, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.05, 0.55, 3.4]}/>
        <meshStandardMaterial color="#5c3418" roughness={0.88} metalness={0.04}/>
      </mesh>
      {/* Hull bottom keel taper */}
      <mesh position={[0, -0.28, 0]} castShadow>
        <boxGeometry args={[0.72, 0.22, 3.2]}/>
        <meshStandardMaterial color="#451e0a" roughness={0.9}/>
      </mesh>
      {/* Bow (pointy front) */}
      <mesh position={[0, 0.04, 1.88]} rotation={[Math.PI/2, 0, 0]} castShadow>
        <coneGeometry args={[0.54, 0.65, 6]}/>
        <meshStandardMaterial color="#4a2210" roughness={0.9}/>
      </mesh>
      {/* Stern transom */}
      <mesh position={[0, 0.14, -1.6]} castShadow>
        <boxGeometry args={[1.04, 0.68, 0.42]}/>
        <meshStandardMaterial color="#5c3418" roughness={0.88}/>
      </mesh>
      {/* Stern castle upper deck */}
      <mesh position={[0, 0.52, -1.25]} castShadow>
        <boxGeometry args={[0.92, 0.32, 1.1]}/>
        <meshStandardMaterial color="#6a3e1e" roughness={0.85}/>
      </mesh>
      {/* Forecastle */}
      <mesh position={[0, 0.48, 1.15]} castShadow>
        <boxGeometry args={[0.88, 0.28, 0.82]}/>
        <meshStandardMaterial color="#6a3e1e" roughness={0.85}/>
      </mesh>
      {/* Deck planking */}
      <mesh position={[0, 0.29, -0.1]} castShadow>
        <boxGeometry args={[0.96, 0.07, 2.65]}/>
        <meshStandardMaterial color="#8a5230" roughness={0.92}/>
      </mesh>
      {/* Hull plank lines (decorative strips) */}
      {[-0.15, 0, 0.15].map((y, i) => (
        <mesh key={i} position={[0.535, y, 0]} castShadow>
          <boxGeometry args={[0.04, 0.04, 3.2]}/>
          <meshStandardMaterial color="#3a1a08" roughness={0.95}/>
        </mesh>
      ))}
      {[-0.15, 0, 0.15].map((y, i) => (
        <mesh key={i+3} position={[-0.535, y, 0]} castShadow>
          <boxGeometry args={[0.04, 0.04, 3.2]}/>
          <meshStandardMaterial color="#3a1a08" roughness={0.95}/>
        </mesh>
      ))}

      {/* ── Masts ── */}
      {/* Main mast */}
      <mesh position={[0, 1.62, 0.15]} castShadow>
        <cylinderGeometry args={[0.04, 0.065, 3.25, 8]}/>
        <meshStandardMaterial color="#2e1608" roughness={0.92}/>
      </mesh>
      {/* Main yard arm */}
      <mesh position={[0, 2.6, 0.15]} rotation={[0, 0, Math.PI/2]} castShadow>
        <cylinderGeometry args={[0.025, 0.025, 2.0, 6]}/>
        <meshStandardMaterial color="#2e1608" roughness={0.92}/>
      </mesh>
      {/* Lower yard arm */}
      <mesh position={[0, 1.82, 0.15]} rotation={[0, 0, Math.PI/2]} castShadow>
        <cylinderGeometry args={[0.028, 0.028, 1.78, 6]}/>
        <meshStandardMaterial color="#2e1608" roughness={0.92}/>
      </mesh>
      {/* Fore mast */}
      <mesh position={[0, 1.1, 1.1]} castShadow>
        <cylinderGeometry args={[0.032, 0.055, 2.2, 8]}/>
        <meshStandardMaterial color="#2e1608" roughness={0.92}/>
      </mesh>
      {/* Fore yard arm */}
      <mesh position={[0, 2.05, 1.1]} rotation={[0, 0, Math.PI/2]} castShadow>
        <cylinderGeometry args={[0.022, 0.022, 1.55, 6]}/>
        <meshStandardMaterial color="#2e1608" roughness={0.92}/>
      </mesh>
      {/* Bowsprit — diagonal forward spar */}
      <mesh position={[0, 0.65, 2.35]} rotation={[0.55, 0, 0]} castShadow>
        <cylinderGeometry args={[0.025, 0.04, 1.4, 6]}/>
        <meshStandardMaterial color="#2e1608" roughness={0.92}/>
      </mesh>

      {/* ── Sails ── */}
      {/* Main top sail */}
      <group ref={sail1Ref} position={[0, 2.6, 0.15]}>
        <mesh>
          <planeGeometry args={[1.82, 0.95, 4, 4]}/>
          <meshStandardMaterial color="#f2e8cc" roughness={0.9} side={THREE.DoubleSide} transparent opacity={0.96}/>
        </mesh>
      </group>
      {/* Main lower sail */}
      <group ref={sail2Ref} position={[0, 1.82, 0.15]}>
        <mesh>
          <planeGeometry args={[1.65, 0.88, 4, 4]}/>
          <meshStandardMaterial color="#ede4c0" roughness={0.92} side={THREE.DoubleSide} transparent opacity={0.97}/>
        </mesh>
        {/* Sail seam strips */}
        {[-0.28, 0, 0.28].map((y, i) => (
          <mesh key={i} position={[0, y, 0.01]}>
            <planeGeometry args={[1.62, 0.035]}/>
            <meshBasicMaterial color="rgba(180,150,90,0.5)" transparent opacity={0.4}/>
          </mesh>
        ))}
      </group>
      {/* Fore sail */}
      <group ref={sail3Ref} position={[0, 1.92, 1.1]}>
        <mesh>
          <planeGeometry args={[1.38, 0.82, 4, 4]}/>
          <meshStandardMaterial color="#f0e6c8" roughness={0.92} side={THREE.DoubleSide} transparent opacity={0.95}/>
        </mesh>
      </group>
      {/* Jib stay — diagonal rope from bowsprit to fore-mast */}
      <mesh position={[0, 0.98, 1.68]} rotation={[0.45, 0, 0]}>
        <cylinderGeometry args={[0.008, 0.008, 1.6, 4]}/>
        <meshStandardMaterial color="#1e0e04" roughness={0.95}/>
      </mesh>

      {/* ── Rigging ropes ── */}
      {[[-0.9, 1.8, -0.3], [0.9, 1.8, -0.3], [-0.8, 1.0, 0.9], [0.8, 1.0, 0.9]].map(([x,y,z], i) => (
        <mesh key={i} position={[x*0.5, y*0.5+0.3, z*0.5+0.15]}>
          <cylinderGeometry args={[0.008, 0.008, Math.sqrt(x*x+(y-3.25)*(y-3.25)+z*z)*0.5, 3]}/>
          <meshStandardMaterial color="#1e0e04" roughness={0.95}/>
        </mesh>
      ))}

      {/* ── Flag ── */}
      <group ref={flagRef} position={[0, 3.22, 0.15]}>
        <mesh>
          <planeGeometry args={[0.45, 0.28]}/>
          <meshStandardMaterial color="#cc2020" roughness={0.8} side={THREE.DoubleSide}/>
        </mesh>
      </group>

      {/* ── Crow's nest ── */}
      <mesh position={[0, 2.78, 0.15]} castShadow>
        <cylinderGeometry args={[0.18, 0.16, 0.14, 8, 1, true]}/>
        <meshStandardMaterial color="#2e1608" roughness={0.9} side={THREE.DoubleSide}/>
      </mesh>

      {/* ── Lights ── */}
      {/* Bow lantern */}
      <pointLight color="#ffcc55" intensity={4.5} distance={9} position={[0, 0.7, 2.0]}/>
      <mesh position={[0, 0.65, 2.0]}>
        <sphereGeometry args={[0.06, 8, 8]}/>
        <meshStandardMaterial emissive="#ffcc44" emissiveIntensity={5} color="#ffcc44"/>
      </mesh>
      {/* Stern lantern */}
      <pointLight color="#ff9922" intensity={2.5} distance={6} position={[0, 0.8, -1.7]}/>
      <mesh position={[0, 0.75, -1.7]}>
        <sphereGeometry args={[0.05, 8, 8]}/>
        <meshStandardMaterial emissive="#ff9922" emissiveIntensity={4} color="#ff9922"/>
      </mesh>
      {/* Key fill light */}
      <pointLight color="#ffb050" intensity={5} distance={12} position={[0, 2.5, 0]}/>
      {/* Wake glow */}
      <pointLight color="#60d4f0" intensity={1.4} distance={4} position={[0, -0.1, -2.0]}/>
    </group>
  )
}

/* ─── Camera: cinematic chase with lag and banking ──────────────── */
function CameraRig({ shipRef }) {
  const { camera } = useThree()
  const camTarget = useRef(new THREE.Vector3(0, 1, 0))
  const desiredPos = useRef(new THREE.Vector3(0, 6, 10))
  const bankRef = useRef(0)

  useFrame(({ clock }) => {
    if (!shipRef.current) return
    const s = shipRef.current
    const speed = Math.abs(s.speed || 0)
    const yaw = (s.angle - 90) * Math.PI / 180
    const forward = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw))
    const side = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw))

    desiredPos.current
      .set(s.x, 1.2, s.z)
      .addScaledVector(forward, -6.6 - speed * 8.5)
      .addScaledVector(side, Math.sin(clock.getElapsedTime() * 0.55) * 0.35)
      .add(new THREE.Vector3(0, 3.1 + speed * 2.4, 0))

    camTarget.current
      .set(s.x, 0.65, s.z)
      .addScaledVector(forward, 2.4 + speed * 3.1)

    camera.position.lerp(desiredPos.current, 0.06)
    camera.lookAt(camTarget.current)

    const turn = THREE.MathUtils.clamp((s.turnRate || 0) / 4.2, -1, 1)
    const targetBank = -turn * 0.14 + Math.sin(clock.getElapsedTime() * 0.8) * 0.01
    bankRef.current = THREE.MathUtils.lerp(bankRef.current, targetBank, 0.08)
    camera.rotation.z = bankRef.current
  })
  return null
}

/* ─── Connection lines ──────────────────────────────────────────── */
function ConnectionLines() {
  const EDGES = [[0,1],[0,2],[0,3],[0,4],[0,5],[0,6],[0,7],[1,4],[2,9],[3,6],[5,9],[7,10]]
  return (
    <>
      {EDGES.map(([a,b],i)=>{
        const pa=PORTALS[a], pb=PORTALS[b]
        return (
          <line key={i}>
            <bufferGeometry>
              <bufferAttribute attach="attributes-position" count={2}
                array={new Float32Array([pa.pos[0],pa.pos[1],pa.pos[2],pb.pos[0],pb.pos[1],pb.pos[2]])} itemSize={3}/>
            </bufferGeometry>
            <lineBasicMaterial color="#2a6a9a" transparent opacity={0.22} linewidth={1}/>
          </line>
        )
      })}
    </>
  )
}

/* ─── Scene ─────────────────────────────────────────────────────── */
function Scene({ shipRef, navigate, activeTargetLabel, dockedLabel, dockPulse }) {
  return (
    <>
      <color attach="background" args={['#0a0a14']}/>

      {/* Dusk sky — warm golden from left */}
      <Sky sunPosition={[-50, 8, -40]} turbidity={14} rayleigh={1.0}
           mieCoefficient={0.005} mieDirectionalG={0.96}
           inclination={0.50} azimuth={0.10}/>

      <Environment preset="sunset" background={false}/>

      {/* Warm overhead light — illuminates parchment map */}
      <directionalLight position={[-30, 30, -20]} intensity={3.1} color="#ffd090" castShadow
        shadow-mapSize={[2048,2048]} shadow-camera-far={60}
        shadow-camera-left={-20} shadow-camera-right={20}
        shadow-camera-top={20} shadow-camera-bottom={-20}/>
      {/* Blue fill from opposite side */}
      <directionalLight position={[30, 20, 20]} intensity={1.05} color="#7db3ff"/>
      <ambientLight intensity={0.68} color="#d4a850"/>
      <hemisphereLight skyColor="#5a3a12" groundColor="#1a0e04" intensity={0.6}/>
      {/* Extra map fill light — ensures parchment texture is clearly visible */}
      <pointLight position={[0, 22, 4]} intensity={4.3} color="#ffe4a0" distance={45}/>
      <LensFlare/>

      <fog attach="fog" args={['#0a0a14', 40, 100]}/>

      <MapPlatform/>
      <Ocean/>
      <AtmosphereField/>
      <CloudLayer/>
      <SunShafts/>

      {LAKES.map(l=><GreatLake key={l.name} lake={l}/>)}
      <ConnectionLines/>
      {PORTALS.map((p,i)=><MapBeacon key={p.path} portal={p} idx={i} onNav={navigate} active={activeTargetLabel===p.label} docking={dockedLabel===p.label} dockPulse={dockPulse}/>) }

      {/* Wildlife */}
      <Dolphin offset={0}    radius={9}  speed={0.30} side={ 1}/>
      <Dolphin offset={2.1}  radius={11} speed={0.26} side={-1}/>
      <Dolphin offset={4.4}  radius={7}  speed={0.34} side={ 1}/>
      <Seagull offset={0}/>
      <Seagull offset={1.8}/>
      <Seagull offset={3.4}/>
      <Seagull offset={5.1}/>

      <Ship shipRef={shipRef}/>
      <ShipSpray shipRef={shipRef}/>
      <CameraRig shipRef={shipRef}/>
    </>
  )
}

/* ─── Ship controls ─────────────────────────────────────────────── */
function useShipControls() {
  const shipRef       = useRef({ x:0.4, z:-1.2, angle:-20, speed:0, turnRate:0 })
  const keys          = useRef({})
  const stateRef      = useRef({ x:0.4, z:-1.2, angle:-20, speed:0, turnRate:0 })
  const autoTargetRef = useRef(null)
  const [render, setRender]       = useState({ x:0.4, z:-1.2, angle:-20, speed:0, turnRate:0 })
  const [sailTarget, setSailTarget] = useState(null) // { label } for HUD

  const setAutoTarget = useCallback((target) => {
    autoTargetRef.current = target
    setSailTarget(target ? { label: target.label } : null)
  }, [])

  useEffect(()=>{
    const CANCEL_KEYS = ['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','w','W','a','A','s','S','d','D']
    const dn=e=>{
      keys.current[e.key]=true
      if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' '].includes(e.key)) e.preventDefault()
      // Manual key press cancels auto-sail
      if(CANCEL_KEYS.includes(e.key) && autoTargetRef.current) {
        autoTargetRef.current = null
        setSailTarget(null)
      }
    }
    const up=e=>{ keys.current[e.key]=false }
    window.addEventListener('keydown',dn); window.addEventListener('keyup',up)
    return()=>{ window.removeEventListener('keydown',dn); window.removeEventListener('keyup',up) }
  },[])

  useEffect(()=>{
    let raf
    let prevAngle = stateRef.current.angle
    const loop=()=>{
      const k=keys.current, s=stateRef.current
      const auto = autoTargetRef.current

      if (auto) {
        // ── Auto-sail toward beacon ──────────────────────────────
        const dx = auto.x - s.x
        const dz = auto.z - s.z
        const dist = Math.sqrt(dx*dx + dz*dz)
        if (dist < 0.6) {
          // slow to a stop very close to beacon before transitioning
          if (Math.abs(s.speed) > 0.03) {
            s.speed *= 0.82
          } else {
            autoTargetRef.current = null
            setSailTarget(null)
            auto.onArrive()
          }
        } else {
          // Target heading: angle convention = atan2(dz,dx)*180/PI + 90
          const targetAngleDeg = Math.atan2(dz, dx) * 180 / Math.PI + 90
          // Shortest angular difference (-180..+180)
          const diff = ((targetAngleDeg - s.angle) % 360 + 540) % 360 - 180
          // Steer toward target smoothly (max 2.2° per frame)
          s.angle += Math.sign(diff) * Math.min(Math.abs(diff), 2.2)
          // Only accelerate when roughly facing target (<50°); crawl otherwise
          const absDiff = Math.abs(diff)
          const alignFactor = Math.max(0, 1 - absDiff / 55)
          const slowFactor  = Math.min(dist / 3.2, 1)
          const wantSpeed   = 0.28 * alignFactor * slowFactor
          s.speed += (wantSpeed - s.speed) * 0.08    // smooth lerp to target speed
        }
      } else {
        // ── Manual controls ──────────────────────────────────────
        if(k['ArrowLeft']||k['a']||k['A'])  s.angle-=2.8
        if(k['ArrowRight']||k['d']||k['D']) s.angle+=2.8
        const fwd=k['ArrowUp']||k['w']||k['W']
        const rev=k['ArrowDown']||k['s']||k['S']
        if(fwd)       s.speed=Math.min(s.speed+0.025,0.55)
        else if(rev)  s.speed=Math.max(s.speed-0.02,-0.2)
        else          s.speed*=0.94
      }

      // facing direction = (cos(angle), 0, -sin(angle)) — matches rotation.y=(90-angle)*PI/180
      const rad = s.angle * Math.PI / 180
      s.x = Math.max(-18, Math.min(18, s.x + Math.cos(rad) * s.speed))
      s.z = Math.max(-18, Math.min(18, s.z - Math.sin(rad) * s.speed))
      const dA = ((s.angle - prevAngle + 540) % 360) - 180
      s.turnRate = dA
      prevAngle = s.angle
      shipRef.current={...s}; setRender({...s})
      raf=requestAnimationFrame(loop)
    }
    raf=requestAnimationFrame(loop)
    return()=>cancelAnimationFrame(raf)
  },[])

  return { shipRef, shipRender:render, setAutoTarget, sailTarget }
}

/* ─── Page ──────────────────────────────────────────────────────── */
export default function QuickActions() {
  const navigate = useNavigate()
  const { shipRef, shipRender, setAutoTarget, sailTarget } = useShipControls()
  const speed   = Math.abs(shipRender.speed)
  const heading = ((shipRender.angle%360)+360)%360
  const [flash, setFlash]       = useState(0)
  const [dockFx, setDockFx]     = useState({ label:null, pulse:0 })
  const [directMode, setDirectMode] = useState(false)
  const [menuOpen, setMenuOpen]     = useState(false)
  const flashRef = useRef(null)

  const doFlashNav = useCallback((path) => {
    setFlash(1)
    if(flashRef.current) clearInterval(flashRef.current)
    flashRef.current = setInterval(() => {
      setFlash(f => {
        if(f <= 0.02){ clearInterval(flashRef.current); return 0 }
        return f - 0.05
      })
    }, 16)
    setTimeout(() => navigate(path), 650)
  }, [navigate])

  // Click a beacon → direct (instant) or auto-sail depending on mode
  const handleNav = useCallback((path, beaconPos, label) => {
    if (directMode) { doFlashNav(path); return }
    setDockFx({ label:null, pulse:0 })
    setAutoTarget({
      x: beaconPos[0],
      z: beaconPos[2],
      label,
      onArrive: () => {
        setDockFx({ label, pulse: Date.now() })
        setTimeout(() => doFlashNav(path), 420)
      },
    })
  }, [setAutoTarget, doFlashNav, directMode])

  return (
    <div style={{ position:'relative', width:'100%', height:'calc(100vh - 88px)', overflow:'hidden', borderRadius:16, background:'#c87020' }}>

      {/* Cinematic click flash */}
      {flash > 0 && (
        <div style={{ position:'absolute', inset:0, zIndex:50, pointerEvents:'none',
          background:`rgba(255,240,180,${flash})`, borderRadius:16 }}/>
      )}

      <CanvasErrorBoundary>
        <Canvas dpr={[1,1.25]}
          camera={{ position:[0,5,9], fov:62, near:0.1, far:300 }}
          gl={{ antialias:false, alpha:false, powerPreference:'high-performance', toneMapping:THREE.ACESFilmicToneMapping, toneMappingExposure:1.04 }}
          style={{ position:'absolute', inset:0 }}>
          <Suspense fallback={null}>
            <Scene shipRef={shipRef} navigate={handleNav} activeTargetLabel={sailTarget?.label || null} dockedLabel={dockFx.label} dockPulse={dockFx.pulse}/>
          </Suspense>
        </Canvas>
      </CanvasErrorBoundary>

      {/* Title */}
      <div style={{ position:'absolute', top:16, left:'50%', transform:'translateX(-50%)', textAlign:'center', pointerEvents:'none', zIndex:10 }}>
        <div style={{ fontSize:9, letterSpacing:'0.35em', color:'rgba(255,255,255,0.85)', fontWeight:700, fontFamily:'system-ui', marginBottom:4, textTransform:'uppercase', textShadow:'0 1px 6px rgba(0,0,0,0.45)' }}>
          SOURCE WATER
        </div>
        <div style={{ fontSize:18, fontWeight:900, color:'#fff', fontFamily:'system-ui', letterSpacing:'0.08em', textShadow:'0 2px 20px rgba(0,80,160,0.55), 0 0 6px rgba(255,255,255,0.35)', textTransform:'uppercase' }}>
          The Great Lakes Water Network
        </div>
        <div style={{ fontSize:10, color: sailTarget ? '#fcd34d' : 'rgba(255,255,255,0.65)', marginTop:3, fontFamily:'system-ui', letterSpacing:'0.2em', textShadow:'0 1px 4px rgba(0,0,0,0.4)', transition:'color 0.3s' }}>
          {sailTarget ? `⚓ SAILING TO ${sailTarget.label.toUpperCase()}...` : 'CLICK A BEACON TO NAVIGATE'}
        </div>
      </div>

      {/* HUD */}
      <div style={{ position:'absolute', bottom:16, left:16, zIndex:10, background:'rgba(4,14,32,0.88)', border:'1px solid rgba(60,130,200,0.35)', borderRadius:12, padding:'12px 16px', backdropFilter:'blur(12px)', boxShadow:'0 4px 24px rgba(0,0,0,0.45)', fontFamily:'system-ui', minWidth:165 }}>

        {/* Mode toggle */}
        <div style={{ display:'flex', gap:4, marginBottom:10 }}>
          {[['⛵ SAIL','sail'],['⚡ DIRECT','direct']].map(([label, mode])=>{
            const active = mode==='direct' ? directMode : !directMode
            return (
              <div key={mode} onClick={()=>setDirectMode(mode==='direct')} style={{
                flex:1, textAlign:'center', fontSize:9, fontWeight:800, letterSpacing:'0.08em',
                padding:'4px 0', borderRadius:6, cursor:'pointer', transition:'all 0.2s',
                background: active ? (mode==='direct'?'rgba(250,204,21,0.22)':'rgba(30,130,200,0.25)') : 'rgba(255,255,255,0.05)',
                border: active ? `1px solid ${mode==='direct'?'#fbbf24':'#60d4f0'}` : '1px solid rgba(255,255,255,0.1)',
                color: active ? (mode==='direct'?'#fcd34d':'#60d4f0') : 'rgba(255,255,255,0.35)',
              }}>{label}</div>
            )
          })}
        </div>

        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
          <div style={{ fontSize:9, fontWeight:800, color:'#60d4f0', letterSpacing:'0.15em' }}>
            {sailTarget ? '⚓ AUTO-SAIL' : directMode ? 'DIRECT MODE' : 'HELM CONTROL'}
          </div>
          {sailTarget && (
            <div onClick={()=>setAutoTarget(null)} style={{
              fontSize:9, fontWeight:800, color:'#f87171', cursor:'pointer',
              background:'rgba(239,68,68,0.15)', border:'1px solid rgba(239,68,68,0.4)',
              borderRadius:4, padding:'1px 6px', letterSpacing:'0.1em',
            }}>✕ CANCEL</div>
          )}
        </div>

        {!directMode && [['W / ↑','Forward'],['S / ↓','Reverse'],['A / ←','Port'],['D / →','Starboard']].map(([k,v])=>(
          <div key={k} style={{ display:'flex', justifyContent:'space-between', gap:20, marginBottom:4 }}>
            <span style={{ fontSize:10, fontWeight:800, color:'#90e0f8', background:'rgba(30,100,180,0.2)', padding:'1px 6px', borderRadius:4, border:'1px solid rgba(60,130,200,0.3)' }}>{k}</span>
            <span style={{ fontSize:10, color:'rgba(255,255,255,0.42)', fontWeight:600 }}>{v}</span>
          </div>
        ))}

        {directMode && (
          <div style={{ fontSize:9, color:'rgba(255,255,255,0.5)', lineHeight:1.5 }}>
            Click any beacon<br/>on the map to<br/>open that page.
          </div>
        )}

        {!directMode && (
          <div style={{ marginTop:10, paddingTop:8, borderTop:'1px solid rgba(60,130,200,0.2)', display:'grid', gridTemplateColumns:'1fr 1fr', gap:6 }}>
            <div>
              <div style={{ fontSize:8, color:'rgba(144,224,248,0.5)', letterSpacing:'0.1em', marginBottom:2 }}>SPEED</div>
              <div style={{ height:3, background:'rgba(255,255,255,0.08)', borderRadius:2, overflow:'hidden' }}>
                <div style={{ height:'100%', width:`${(speed/0.55)*100}%`, background:'linear-gradient(90deg,#1e7fc4,#60d4f0)', transition:'width 0.1s', boxShadow:'0 0 6px #60d4f0' }}/>
              </div>
            </div>
            <div>
              <div style={{ fontSize:8, color:'rgba(144,224,248,0.5)', letterSpacing:'0.1em', marginBottom:1 }}>HDG</div>
              <div style={{ fontSize:13, fontWeight:900, color:'#60d4f0', textShadow:'0 0 8px #1e7fc4' }}>{Math.round(heading)}°</div>
            </div>
          </div>
        )}
      </div>

      {/* Quick-nav tab menu button */}
      <div style={{ position:'absolute', bottom:16, right:100, zIndex:10 }}>
        <div onClick={()=>setMenuOpen(o=>!o)} style={{
          background:'rgba(4,14,32,0.88)', border:`1px solid ${menuOpen?'#60d4f0':'rgba(60,130,200,0.35)'}`,
          borderRadius:10, padding:'8px 14px', cursor:'pointer', backdropFilter:'blur(12px)',
          fontSize:10, fontWeight:800, color: menuOpen?'#60d4f0':'rgba(255,255,255,0.7)',
          letterSpacing:'0.12em', display:'flex', alignItems:'center', gap:6,
          boxShadow:'0 4px 24px rgba(0,0,0,0.45)',
        }}>
          ☰ ALL PAGES
        </div>

        {menuOpen && (
          <div style={{
            position:'absolute', bottom:42, right:0,
            background:'rgba(4,14,32,0.96)', border:'1px solid rgba(60,130,200,0.4)',
            borderRadius:12, padding:8, backdropFilter:'blur(16px)',
            boxShadow:'0 8px 40px rgba(0,0,0,0.6)', minWidth:200,
            display:'grid', gridTemplateColumns:'1fr 1fr', gap:4,
          }}>
            {PORTALS.map(p=>(
              <div key={p.path} onClick={()=>{ setMenuOpen(false); doFlashNav(p.path) }} style={{
                padding:'7px 10px', borderRadius:8, cursor:'pointer',
                background:'rgba(255,255,255,0.04)', border:`1px solid ${p.glow}30`,
                transition:'all 0.15s',
              }}
              onMouseEnter={e=>e.currentTarget.style.background=`${p.glow}20`}
              onMouseLeave={e=>e.currentTarget.style.background='rgba(255,255,255,0.04)'}>
                <div style={{ fontSize:10, fontWeight:800, color:'#fff', letterSpacing:'0.04em' }}>{p.label}</div>
                <div style={{ fontSize:8, color:p.glow, marginTop:2 }}>{p.sub}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Compass */}
      <div style={{ position:'absolute', bottom:16, right:16, zIndex:10 }}>
        <svg width={72} height={72} viewBox="0 0 72 72">
          <circle cx={36} cy={36} r={34} fill="rgba(4,14,32,0.82)" stroke="rgba(60,130,200,0.4)" strokeWidth={1.5}/>
          <circle cx={36} cy={36} r={29} fill="none" stroke="rgba(60,130,200,0.18)" strokeWidth={0.8} strokeDasharray="3 3"/>
          {['N','E','S','W'].map((d,i)=>{
            const a=i*90*Math.PI/180-Math.PI/2
            return <text key={d} x={36+Math.cos(a)*22} y={36+Math.sin(a)*22+4} textAnchor="middle" fontSize={d==='N'?10:8} fontWeight={800} fill={d==='N'?'#ef4444':'rgba(144,224,248,0.75)'} fontFamily="system-ui">{d}</text>
          })}
          <g transform={`rotate(${heading} 36 36)`}>
            <polygon points="36,10 33.5,36 36,32 38.5,36" fill="#ef4444"/>
            <polygon points="36,62 33.5,36 36,40 38.5,36" fill="rgba(144,224,248,0.65)"/>
          </g>
          <circle cx={36} cy={36} r={4} fill="none" stroke="rgba(60,130,200,0.5)" strokeWidth={1}/>
          <circle cx={36} cy={36} r={2} fill="#60d4f0"/>
        </svg>
      </div>
    </div>
  )
}
