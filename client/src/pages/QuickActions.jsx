import { Canvas, useFrame, extend, useThree } from '@react-three/fiber'
import { Sky, Cloud, Html, Trail, Effects, Billboard, Environment } from '@react-three/drei'
import * as THREE from 'three'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import { useRef, useState, useEffect, useMemo, useCallback, Suspense } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Sparkles as SparklesIcon, Map, BellRing, FileBarChart2,
  Users, BookOpen, GraduationCap, LineChart, Microscope,
  FlaskConical, CloudSun, Joystick,
} from 'lucide-react'

extend({ UnrealBloomPass })

const SUN_POS  = [60, 22, -70]
const SUN_DIR  = new THREE.Vector3(60, 22, -70).normalize()
const SUN_COL  = new THREE.Color('#ffe8b0')

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

/* ─── Caribbean water shader ────────────────────────────────────── */
const WATER_VERT = `
  uniform float uTime;
  varying vec2  vUv;
  varying float vWave;
  varying vec3  vNormal;
  varying vec3  vViewDir;
  varying vec3  vWorldPos;
  void main(){
    vUv = uv;
    vec3 p = position;
    float w = sin(p.x*0.38+uTime*0.68)*0.30
            + sin(p.z*0.50+uTime*1.02)*0.24
            + sin((p.x+p.z)*0.26+uTime*0.55)*0.14
            + cos(p.x*0.13+p.z*0.18+uTime*0.30)*0.09
            + sin(p.x*1.05+p.z*0.88+uTime*2.0)*0.025;
    vWave = w;
    float e=0.08;
    float wx=sin((p.x+e)*0.38+uTime*0.68)*0.30+sin(p.z*0.50+uTime*1.02)*0.24+sin(((p.x+e)+p.z)*0.26+uTime*0.55)*0.14;
    float wz=sin(p.x*0.38+uTime*0.68)*0.30+sin((p.z+e)*0.50+uTime*1.02)*0.24+sin((p.x+(p.z+e))*0.26+uTime*0.55)*0.14;
    vNormal = normalize(cross(normalize(vec3(0.,wz-w,e)),normalize(vec3(e,wx-w,0.))));
    p.y += w;
    vec4 wPos = modelMatrix*vec4(p,1.);
    vWorldPos = wPos.xyz;
    vViewDir = normalize(cameraPosition-wPos.xyz);
    gl_Position = projectionMatrix*viewMatrix*wPos;
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
    vec3 N=normalize(vNormal);
    vec3 V=normalize(vViewDir);
    vec3 L=uSunDir;
    // Fresnel
    float fr=0.04+0.96*pow(1.-max(dot(N,V),0.),5.);
    // Diffuse + specular
    float diff=max(dot(N,L),0.12);
    vec3  H=normalize(L+V);
    float sp=pow(max(dot(N,H),0.),640.)*2.2;
    float sp2=pow(max(dot(N,H),0.),55.)*0.4;
    // Caustic shimmer
    float cau=sin(vWorldPos.x*2.4+uTime*1.6)*sin(vWorldPos.z*2.8+uTime*1.2)*0.5+0.5;
    cau=cau*cau*0.14;
    // Caribbean palette: sandy→aquamarine→teal→deep blue
    vec3 sand  =vec3(0.72,0.65,0.40); // visible sandy bottom
    vec3 aqua  =vec3(0.04,0.82,0.76); // turquoise shallows
    vec3 teal  =vec3(0.02,0.52,0.68); // mid water
    vec3 deep  =vec3(0.01,0.08,0.32); // deep open water
    float depth=clamp(vWave*1.6+diff*0.3+cau,0.,1.);
    vec3 col=mix(deep,teal,depth);
    col=mix(col,aqua,max(0.,depth-0.45)*2.5);
    col=mix(col,sand,max(0.,depth-0.78)*3.5);
    // Foam
    col=mix(col,vec3(0.92,0.97,1.),smoothstep(0.30,0.56,vWave)*0.75);
    // Sun glint
    col+=uSunCol*(sp+sp2);
    // Sky Fresnel
    col=mix(col,vec3(0.50,0.78,0.96)*1.05,fr*0.42);
    col*=(0.6+diff*0.4);
    // Horizon fade
    vec2 ed=abs(vUv-0.5)*2.;
    float fade=1.-smoothstep(0.68,1.,max(ed.x,ed.y));
    gl_FragColor=vec4(col,fade*0.97);
  }
`

function Ocean() {
  const mat = useRef()
  const uni = useMemo(()=>({ uTime:{value:0}, uSunDir:{value:SUN_DIR}, uSunCol:{value:SUN_COL} }),[])
  useFrame(({clock})=>{ if(mat.current) mat.current.uniforms.uTime.value=clock.getElapsedTime() })
  return (
    <mesh rotation={[-Math.PI/2,0,0]} position={[0,-0.05,0]}>
      <planeGeometry args={[80,80,128,128]}/>
      <shaderMaterial ref={mat} uniforms={uni} vertexShader={WATER_VERT} fragmentShader={WATER_FRAG} transparent side={THREE.DoubleSide}/>
    </mesh>
  )
}

/* ─── Terrain with sandy shores ─────────────────────────────────── */
function Terrain() {
  return (
    <group>
      {/* Base green land */}
      <mesh rotation={[-Math.PI/2,0,0]} position={[0,-0.32,0]} receiveShadow>
        <planeGeometry args={[80,80]}/>
        <meshStandardMaterial color="#3a5a18" roughness={0.92} metalness={0}/>
      </mesh>
      {/* Sandy shore band near water edge */}
      <mesh rotation={[-Math.PI/2,0,0]} position={[0,-0.18,0]}>
        <planeGeometry args={[30,30]}/>
        <meshStandardMaterial color="#c8a660" roughness={0.88} metalness={0} transparent opacity={0.85}/>
      </mesh>
      {/* Inner sandy centre */}
      <mesh rotation={[-Math.PI/2,0,0]} position={[0,-0.10,0]}>
        <planeGeometry args={[18,18]}/>
        <meshStandardMaterial color="#b89a50" roughness={0.85} metalness={0} transparent opacity={0.6}/>
      </mesh>
    </group>
  )
}

/* ─── Sun shafts ────────────────────────────────────────────────── */
function SunShafts() {
  const g = useRef()
  useFrame(({clock})=>{
    if(!g.current) return
    const t=clock.getElapsedTime()
    g.current.children.forEach((m,i)=>{ if(m.material) m.material.opacity=0.055+Math.sin(t*0.35+i*1.2)*0.022 })
  })
  return (
    <group ref={g} position={[28,34,-38]} rotation={[0.26,0.42,-0.08]}>
      {[0,1,2,3,4,5,6].map(i=>(
        <mesh key={i} rotation={[0,(i/7)*Math.PI*0.45,0]}>
          <coneGeometry args={[9+i*3.5,65,5,1,true]}/>
          <meshBasicMaterial color="#ffd060" transparent opacity={0.055} depthWrite={false} side={THREE.BackSide} blending={THREE.AdditiveBlending}/>
        </mesh>
      ))}
    </group>
  )
}

/* ─── Lens flare billboard ──────────────────────────────────────── */
function LensFlare() {
  const ref = useRef()
  useFrame(({clock})=>{
    if(ref.current) ref.current.material.opacity = 0.55+Math.sin(clock.getElapsedTime()*0.7)*0.15
  })
  return (
    <Billboard position={[28,22,-38]}>
      <mesh ref={ref}>
        <planeGeometry args={[5,5]}/>
        <meshBasicMaterial color="#fff5a0" transparent opacity={0.55} depthWrite={false} blending={THREE.AdditiveBlending}/>
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

/* ─── Holographic beacon — clean floating orb, no ground rings ───── */
function MapBeacon({ portal, idx, onNav }) {
  const [hov, setHov] = useState(false)
  const beam = useRef(), orb = useRef(), glow = useRef(), ring = useRef()
  const isHub = idx === 0
  const orbR  = isHub ? 0.34 : 0.24
  const baseY = portal.pos[1]  // use portal's Y directly

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime()
    // Orb float
    if(orb.current) orb.current.position.y = baseY + Math.sin(t*1.2+idx*0.55)*0.22
    // Beam breathe
    if(beam.current) beam.current.material.opacity = (hov?0.55:0.30)+Math.sin(t*1.8+idx)*0.10
    // Outer glow pulse
    if(glow.current) glow.current.material.opacity = (hov?0.18:0.06)+Math.sin(t*1.0+idx*0.4)*0.04
    // Equator ring spin
    if(ring.current) ring.current.rotation.y += 0.012
  })

  return (
    <group position={[portal.pos[0], 0, portal.pos[2]]}
      onPointerOver={()=>{setHov(true);document.body.style.cursor='pointer'}}
      onPointerOut={()=>{setHov(false);document.body.style.cursor=''}}
      onClick={()=>onNav(portal.path, portal.pos, portal.label)}>

      {/* Vertical light beam — goes high into sky */}
      <mesh ref={beam} position={[0, 6, 0]}>
        <cylinderGeometry args={[isHub?0.04:0.028, isHub?0.08:0.055, 20, 6, 1, true]}/>
        <meshBasicMaterial color={portal.glow} transparent opacity={0.32}
          depthWrite={false} side={THREE.DoubleSide} blending={THREE.AdditiveBlending}/>
      </mesh>

      {/* Floating orb */}
      <group ref={orb} position={[0, baseY, 0]}>
        {/* Wide ambient glow */}
        <mesh ref={glow}>
          <sphereGeometry args={[orbR*2.8,16,16]}/>
          <meshBasicMaterial color={portal.glow} transparent opacity={0.07} depthWrite={false} blending={THREE.AdditiveBlending}/>
        </mesh>
        {/* Core sphere */}
        <mesh>
          <sphereGeometry args={[orbR,24,24]}/>
          <meshStandardMaterial color={portal.color} emissive={portal.glow}
            emissiveIntensity={hov?2.8:1.4} metalness={0.35} roughness={0.06}
            envMapIntensity={1.2}/>
        </mesh>
        {/* Single thin equator ring */}
        <mesh ref={ring} rotation={[Math.PI*0.32, 0, 0]}>
          <torusGeometry args={[orbR*1.6, 0.014, 6, 60]}/>
          <meshBasicMaterial color={portal.glow} transparent opacity={hov?0.95:0.6} blending={THREE.AdditiveBlending}/>
        </mesh>
        <pointLight color={portal.glow} intensity={hov?5:2} distance={6} decay={2}/>

        {/* Clean label */}
        <Billboard position={[0, orbR+0.5, 0]}>
          <Html center distanceFactor={11}>
            <div onClick={()=>onNav(portal.path, portal.pos, portal.label)} style={{
              background:'rgba(2,8,20,0.88)',
              border:`1px solid ${portal.glow}70`,
              borderRadius:6, padding:'4px 12px',
              color:'#f0f6ff', fontSize:11, fontWeight:800,
              whiteSpace:'nowrap', textAlign:'center',
              backdropFilter:'blur(10px)',
              boxShadow:`0 0 18px ${portal.glow}60, 0 2px 8px rgba(0,0,0,0.5)`,
              cursor:'pointer', letterSpacing:'0.04em',
              transition:'all 0.15s',
              textShadow:`0 0 8px ${portal.glow}`,
            }}>
              {portal.label}
              <div style={{fontSize:9,color:portal.glow,fontWeight:600,marginTop:1}}>{portal.sub}</div>
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

/* ─── Ship ──────────────────────────────────────────────────────── */
function Ship({ shipRef }) {
  const gRef = useRef()
  const trailTarget = useRef()
  useFrame(()=>{
    if(!gRef.current||!shipRef.current) return
    const s=shipRef.current
    gRef.current.position.set(s.x,0.22,s.z)
    gRef.current.rotation.y=-(s.angle-90)*Math.PI/180
  })
  return (
    <group ref={gRef}>
      <Trail width={1.0} length={12} color={new THREE.Color('#60d4f0')} attenuation={t=>t*t} target={trailTarget}>
        <object3D ref={trailTarget}/>
      </Trail>
      <mesh castShadow>
        <boxGeometry args={[1.1,0.22,0.38]}/>
        <meshStandardMaterial color="#7c3a1a" metalness={0.45} roughness={0.55}/>
      </mesh>
      <mesh position={[0,0.14,0]} castShadow>
        <boxGeometry args={[0.9,0.12,0.28]}/>
        <meshStandardMaterial color="#9b4a22" metalness={0.3} roughness={0.5}/>
      </mesh>
      <mesh position={[0.08,0.65,0]} castShadow>
        <cylinderGeometry args={[0.018,0.024,0.9,8]}/>
        <meshStandardMaterial color="#3d2510" roughness={0.8}/>
      </mesh>
      <mesh position={[0.22,0.78,0.1]} rotation={[0,0.1,0]} castShadow>
        <planeGeometry args={[0.36,0.5]}/>
        <meshStandardMaterial color="#fefce8" side={THREE.DoubleSide} transparent opacity={0.97}/>
      </mesh>
      <mesh position={[-0.12,0.48,0]}>
        <cylinderGeometry args={[0.013,0.018,0.65,8]}/>
        <meshStandardMaterial color="#3d2510" roughness={0.8}/>
      </mesh>
      <mesh position={[-0.04,0.56,0.08]}>
        <planeGeometry args={[0.28,0.38]}/>
        <meshStandardMaterial color="#fefce8" side={THREE.DoubleSide} transparent opacity={0.9}/>
      </mesh>
      <pointLight color="#60d4f0" intensity={1.4} distance={3.5} position={[-0.55,0,0]}/>
      <mesh position={[-0.55,0,0]}>
        <sphereGeometry args={[0.065,8,8]}/>
        <meshStandardMaterial emissive="#60d4f0" emissiveIntensity={3} color="#60d4f0"/>
      </mesh>
    </group>
  )
}

/* ─── Cinematic GTA5-style camera ───────────────────────────────── */
function CameraRig({ shipRef }) {
  const { camera } = useThree()
  const smooth = useRef(new THREE.Vector3(0, 7, 16))
  const look   = useRef(new THREE.Vector3(0, 1, 0))
  const orbitT = useRef(0)

  useFrame(({clock}, dt) => {
    const t   = clock.getElapsedTime()
    const s   = shipRef.current ?? { x:0, z:0, speed:0 }
    const spd = Math.abs(s.speed ?? 0)

    // Slow dramatic orbit when idle
    if(spd < 0.05) orbitT.current += dt * 0.09
    else           orbitT.current *= 0.97

    const ox = Math.sin(orbitT.current) * 5
    const oz = Math.cos(orbitT.current) * 3

    // Low cinematic height — see sky + horizon like GTA5
    const breathe = Math.sin(t*0.35)*0.4 + Math.cos(t*0.22)*0.18
    const camH = 6.5 + breathe
    const camD = 15  // far enough back to see horizon

    smooth.current.lerp(new THREE.Vector3(s.x+ox, camH, s.z+camD+oz), 0.030)
    // Look slightly above horizon — gives wide dramatic view
    look.current.lerp(new THREE.Vector3(s.x, 1.8, s.z-6), 0.055)
    camera.position.copy(smooth.current)
    camera.lookAt(look.current)
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
function Scene({ shipRef, navigate }) {
  return (
    <>
      {/* Dramatic cinematic sky — deep golden sunset */}
      <Sky sunPosition={SUN_POS} turbidity={10} rayleigh={3.0}
           mieCoefficient={0.012} mieDirectionalG={0.92}
           inclination={0.49} azimuth={0.22}/>

      {/* PBR environment reflections */}
      <Environment preset="sunset" background={false}/>

      {/* Sun */}
      <directionalLight position={SUN_POS} intensity={5.0} color="#ffb840" castShadow
        shadow-mapSize={[2048,2048]} shadow-camera-far={80}
        shadow-camera-left={-30} shadow-camera-right={30}
        shadow-camera-top={30} shadow-camera-bottom={-30}/>
      <ambientLight intensity={0.30} color="#ffc870"/>
      <hemisphereLight skyColor="#ff8c30" groundColor="#1a3a08" intensity={0.65}/>
      <LensFlare/>

      {/* Warm cinematic haze */}
      <fog attach="fog" args={['#e8a050',55,130]}/>

      <Terrain/>
      <Ocean/>
      <CloudLayer/>
      <SunShafts/>

      {LAKES.map(l=><GreatLake key={l.name} lake={l}/>)}
      <ConnectionLines/>
      {PORTALS.map((p,i)=><MapBeacon key={p.path} portal={p} idx={i} onNav={navigate}/>)}

      {/* Wildlife */}
      <Dolphin offset={0}    radius={9}  speed={0.30} side={ 1}/>
      <Dolphin offset={2.1}  radius={11} speed={0.26} side={-1}/>
      <Dolphin offset={4.4}  radius={7}  speed={0.34} side={ 1}/>
      <Seagull offset={0}/>
      <Seagull offset={1.8}/>
      <Seagull offset={3.4}/>
      <Seagull offset={5.1}/>

      <Ship shipRef={shipRef}/>
      <CameraRig shipRef={shipRef}/>

      <Effects disableGamma>
        <unrealBloomPass threshold={0.28} strength={0.55} radius={0.70}/>
      </Effects>
    </>
  )
}

/* ─── Ship controls ─────────────────────────────────────────────── */
function useShipControls() {
  const shipRef       = useRef({ x:0.4, z:-1.2, angle:-20, speed:0 })
  const keys          = useRef({})
  const stateRef      = useRef({ x:0.4, z:-1.2, angle:-20, speed:0 })
  const autoTargetRef = useRef(null)
  const [render, setRender]       = useState({ x:0.4, z:-1.2, angle:-20, speed:0 })
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
    const loop=()=>{
      const k=keys.current, s=stateRef.current
      const auto = autoTargetRef.current

      if (auto) {
        // ── Auto-sail toward beacon ──────────────────────────────
        const dx = auto.x - s.x
        const dz = auto.z - s.z
        const dist = Math.sqrt(dx*dx + dz*dz)
        if (dist < 1.8) {
          // Arrived — trigger navigation
          autoTargetRef.current = null
          setSailTarget(null)
          auto.onArrive()
        } else {
          // Target heading: angle convention = atan2(dz,dx)*180/PI + 90
          const targetAngleDeg = Math.atan2(dz, dx) * 180 / Math.PI + 90
          // Shortest angular difference
          let diff = ((targetAngleDeg - s.angle) % 360 + 540) % 360 - 180
          // Steer toward target (max 4° per frame)
          s.angle += Math.sign(diff) * Math.min(Math.abs(diff), 4.0)
          // Accelerate to full speed
          s.speed = Math.min(s.speed + 0.022, 0.50)
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

      const rad=(s.angle-90)*Math.PI/180
      s.x=Math.max(-18,Math.min(18,s.x+Math.cos(rad)*s.speed))
      s.z=Math.max(-18,Math.min(18,s.z+Math.sin(rad)*s.speed))
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
  const [flash, setFlash] = useState(0)
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

  // Click a beacon → ship auto-sails there, then page opens
  const handleNav = useCallback((path, beaconPos, label) => {
    setAutoTarget({
      x: beaconPos[0],
      z: beaconPos[2],
      label,
      onArrive: () => doFlashNav(path),
    })
  }, [setAutoTarget, doFlashNav])

  return (
    <div style={{ position:'relative', width:'100%', height:'calc(100vh - 88px)', overflow:'hidden', borderRadius:16, background:'#c87020' }}>

      {/* Cinematic click flash */}
      {flash > 0 && (
        <div style={{ position:'absolute', inset:0, zIndex:50, pointerEvents:'none',
          background:`rgba(255,240,180,${flash})`, borderRadius:16 }}/>
      )}

      <Canvas dpr={[1,1.8]}
        camera={{ position:[0,4,18], fov:68, near:0.1, far:300 }}
        gl={{ antialias:true, alpha:false, toneMapping:THREE.ACESFilmicToneMapping, toneMappingExposure:1.4 }}
        shadows style={{ position:'absolute', inset:0 }}>
        <Suspense fallback={null}>
          <Scene shipRef={shipRef} navigate={handleNav}/>
        </Suspense>
      </Canvas>

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
      <div style={{ position:'absolute', bottom:16, left:16, zIndex:10, background:'rgba(4,14,32,0.82)', border:'1px solid rgba(60,130,200,0.35)', borderRadius:12, padding:'12px 16px', backdropFilter:'blur(12px)', boxShadow:'0 4px 24px rgba(0,0,0,0.35)', fontFamily:'system-ui' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
          <div style={{ fontSize:9, fontWeight:800, color:'#60d4f0', letterSpacing:'0.15em' }}>
            {sailTarget ? '⚓ AUTO-SAIL' : 'HELM CONTROL'}
          </div>
          {sailTarget && (
            <div onClick={()=>setAutoTarget(null)} style={{
              fontSize:9, fontWeight:800, color:'#f87171', cursor:'pointer',
              background:'rgba(239,68,68,0.15)', border:'1px solid rgba(239,68,68,0.4)',
              borderRadius:4, padding:'1px 6px', letterSpacing:'0.1em',
            }}>✕ CANCEL</div>
          )}
        </div>
        {[['W / ↑','Forward'],['S / ↓','Reverse'],['A / ←','Port'],['D / →','Starboard']].map(([k,v])=>(
          <div key={k} style={{ display:'flex', justifyContent:'space-between', gap:20, marginBottom:4 }}>
            <span style={{ fontSize:10, fontWeight:800, color:'#90e0f8', background:'rgba(30,100,180,0.2)', padding:'1px 6px', borderRadius:4, border:'1px solid rgba(60,130,200,0.3)' }}>{k}</span>
            <span style={{ fontSize:10, color:'rgba(255,255,255,0.42)', fontWeight:600 }}>{v}</span>
          </div>
        ))}
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
