import { Canvas, useFrame, extend, useThree } from '@react-three/fiber'
import { Sky, Cloud, Float, Html, Trail, Effects, Billboard } from '@react-three/drei'
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

/* ─── Terrain ───────────────────────────────────────────────────── */
function Terrain() {
  return (
    <mesh rotation={[-Math.PI/2,0,0]} position={[0,-0.32,0]} receiveShadow>
      <planeGeometry args={[80,80]}/>
      <meshStandardMaterial color="#3a5e1e" roughness={0.95} metalness={0}/>
    </mesh>
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

/* ─── Holographic map beacon ────────────────────────────────────── */
function MapBeacon({ portal, idx, onNav }) {
  const [hov,setHov] = useState(false)
  const ping1 = useRef(), ping2 = useRef()
  const beam  = useRef()
  const dot   = useRef()
  const isHub = idx === 0

  useFrame(({clock})=>{
    const t = clock.getElapsedTime()
    const speed = isHub ? 0.55 : 0.45
    // Ping 1
    if(ping1.current){
      const ph = (t*speed + idx*0.38) % 1
      ping1.current.scale.setScalar(1+ph*3.2)
      ping1.current.material.opacity = (1-ph)*0.55
    }
    // Ping 2 — offset half cycle
    if(ping2.current){
      const ph = (t*speed + idx*0.38 + 0.5) % 1
      ping2.current.scale.setScalar(1+ph*3.2)
      ping2.current.material.opacity = (1-ph)*0.35
    }
    // Beam breathe
    if(beam.current) beam.current.material.opacity = 0.30+Math.sin(t*1.6+idx)*0.12
    // Dot float
    if(dot.current) dot.current.position.y = (isHub?2.2:1.8)+Math.sin(t*1.3+idx*0.6)*0.18
  })

  const beamH = isHub ? 4.6 : 4.0
  const dotR  = isHub ? 0.30 : 0.22

  return (
    <group position={portal.pos}
      onPointerOver={()=>{setHov(true);document.body.style.cursor='pointer'}}
      onPointerOut={()=>{setHov(false);document.body.style.cursor=''}}
      onClick={()=>onNav(portal.path)}>

      {/* Ground base disc */}
      <mesh rotation={[-Math.PI/2,0,0]} position={[0,-2.3,0]}>
        <circleGeometry args={[isHub?0.5:0.38,48]}/>
        <meshStandardMaterial color={portal.color} emissive={portal.glow} emissiveIntensity={1.8} transparent opacity={0.82}/>
      </mesh>

      {/* Ping ring 1 */}
      <mesh ref={ping1} rotation={[-Math.PI/2,0,0]} position={[0,-2.27,0]}>
        <ringGeometry args={[0.36,0.50,48]}/>
        <meshBasicMaterial color={portal.glow} transparent opacity={0.5} depthWrite={false}/>
      </mesh>

      {/* Ping ring 2 */}
      <mesh ref={ping2} rotation={[-Math.PI/2,0,0]} position={[0,-2.25,0]}>
        <ringGeometry args={[0.36,0.46,48]}/>
        <meshBasicMaterial color={portal.glow} transparent opacity={0.35} depthWrite={false}/>
      </mesh>

      {/* Light pillar */}
      <mesh ref={beam} position={[0,0,0]}>
        <cylinderGeometry args={[isHub?0.045:0.032, isHub?0.09:0.07, beamH, 6, 1, true]}/>
        <meshBasicMaterial color={portal.glow} transparent opacity={0.32}
          depthWrite={false} side={THREE.DoubleSide} blending={THREE.AdditiveBlending}/>
      </mesh>

      {/* Outer glow column */}
      <mesh position={[0,0,0]}>
        <cylinderGeometry args={[isHub?0.18:0.13, isHub?0.28:0.22, beamH, 6, 1, true]}/>
        <meshBasicMaterial color={portal.glow} transparent opacity={hov?0.06:0.03}
          depthWrite={false} side={THREE.DoubleSide} blending={THREE.AdditiveBlending}/>
      </mesh>

      {/* Floating beacon sphere */}
      <group ref={dot} position={[0, isHub?2.2:1.8, 0]}>
        {/* Outer glow */}
        <mesh>
          <sphereGeometry args={[dotR*1.9,16,16]}/>
          <meshStandardMaterial color={portal.glow} emissive={portal.glow} emissiveIntensity={0.2}
            transparent opacity={hov?0.18:0.08} depthWrite={false}/>
        </mesh>
        {/* Main sphere */}
        <mesh>
          <sphereGeometry args={[dotR,20,20]}/>
          <meshStandardMaterial color={portal.color} emissive={portal.glow}
            emissiveIntensity={hov?2.2:1.1} metalness={0.25} roughness={0.08}/>
        </mesh>
        <pointLight color={portal.glow} intensity={hov?3.5:1.4} distance={5} decay={2}/>

        {/* Label */}
        <Billboard position={[0, dotR+0.42, 0]}>
          <Html center distanceFactor={12}>
            <div onClick={()=>onNav(portal.path)} style={{
              background:'rgba(4,12,28,0.86)',
              border:`1px solid ${portal.glow}65`,
              borderRadius:8, padding:'4px 11px',
              color:'#f1f5f9', fontSize:11, fontWeight:800,
              whiteSpace:'nowrap', textAlign:'center',
              backdropFilter:'blur(8px)',
              boxShadow:`0 0 14px ${portal.glow}55`,
              cursor:'pointer', letterSpacing:'0.03em',
            }}>
              {portal.label}
              <div style={{fontSize:9,color:portal.glow,fontWeight:600,marginTop:1,opacity:0.92}}>{portal.sub}</div>
            </div>
          </Html>
        </Billboard>
      </group>
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

/* ─── Cinematic camera ──────────────────────────────────────────── */
function CameraRig({ shipRef }) {
  const { camera } = useThree()
  const smooth  = useRef(new THREE.Vector3(0,13,10))
  const look    = useRef(new THREE.Vector3())
  const orbitT  = useRef(0)
  const lastSpd = useRef(0)

  useFrame(({clock},dt)=>{
    const t  = clock.getElapsedTime()
    const s  = shipRef.current ?? { x:0, z:0, speed:0 }
    const spd = Math.abs(s.speed ?? 0)

    // Slow cinematic orbit when ship is idle
    if(spd < 0.05) orbitT.current += dt * 0.12
    else           orbitT.current *= 0.98

    const orbitR  = orbitT.current
    const orbitX  = Math.sin(orbitR) * 4
    const orbitZ  = Math.cos(orbitR) * 4

    // Camera height breathe — feels like a drone
    const breathe = Math.sin(t*0.4)*0.35 + Math.cos(t*0.27)*0.2

    const targetX = s.x + orbitX
    const targetZ = s.z + 10 + orbitZ
    const targetY = 13 + breathe

    smooth.current.lerp(new THREE.Vector3(targetX, targetY, targetZ), 0.028)
    look.current.lerp(new THREE.Vector3(s.x, 0.5, s.z), 0.05)
    camera.position.copy(smooth.current)
    camera.lookAt(look.current)
    lastSpd.current = spd
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
      {/* Golden-hour sky */}
      <Sky sunPosition={SUN_POS} turbidity={8} rayleigh={2.2} mieCoefficient={0.008} mieDirectionalG={0.88}/>

      {/* Warm dramatic sun */}
      <directionalLight position={SUN_POS} intensity={4.2} color="#ffd070" castShadow
        shadow-mapSize={[2048,2048]} shadow-camera-far={80}
        shadow-camera-left={-30} shadow-camera-right={30}
        shadow-camera-top={30} shadow-camera-bottom={-30}/>
      <ambientLight intensity={0.38} color="#ffe0a0"/>
      <hemisphereLight skyColor="#f0a050" groundColor="#2a4a10" intensity={0.55}/>
      <LensFlare/>

      {/* Atmospheric fog */}
      <fog attach="fog" args={['#aecde0',44,92]}/>

      <Terrain/>
      <Ocean/>
      <CloudLayer/>
      <SunShafts/>

      {LAKES.map(l=><GreatLake key={l.name} lake={l}/>)}
      <ConnectionLines/>
      {PORTALS.map((p,i)=><MapBeacon key={p.path} portal={p} idx={i} onNav={navigate}/>)}

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
  const shipRef  = useRef({ x:0.4, z:-1.2, angle:-20, speed:0 })
  const keys     = useRef({})
  const stateRef = useRef({ x:0.4, z:-1.2, angle:-20, speed:0 })
  const [render, setRender] = useState({ x:0.4, z:-1.2, angle:-20, speed:0 })

  useEffect(()=>{
    const dn=e=>{ keys.current[e.key]=true; if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' '].includes(e.key)) e.preventDefault() }
    const up=e=>{ keys.current[e.key]=false }
    window.addEventListener('keydown',dn); window.addEventListener('keyup',up)
    return()=>{ window.removeEventListener('keydown',dn); window.removeEventListener('keyup',up) }
  },[])

  useEffect(()=>{
    let raf
    const loop=()=>{
      const k=keys.current, s=stateRef.current
      if(k['ArrowLeft']||k['a']||k['A'])  s.angle-=2.8
      if(k['ArrowRight']||k['d']||k['D']) s.angle+=2.8
      const fwd=k['ArrowUp']||k['w']||k['W']
      const rev=k['ArrowDown']||k['s']||k['S']
      if(fwd)       s.speed=Math.min(s.speed+0.025,0.55)
      else if(rev)  s.speed=Math.max(s.speed-0.02,-0.2)
      else          s.speed*=0.94
      const rad=(s.angle-90)*Math.PI/180
      s.x=Math.max(-18,Math.min(18,s.x+Math.cos(rad)*s.speed))
      s.z=Math.max(-18,Math.min(18,s.z+Math.sin(rad)*s.speed))
      shipRef.current={...s}; setRender({...s})
      raf=requestAnimationFrame(loop)
    }
    raf=requestAnimationFrame(loop)
    return()=>cancelAnimationFrame(raf)
  },[])

  return { shipRef, shipRender:render }
}

/* ─── Page ──────────────────────────────────────────────────────── */
export default function QuickActions() {
  const navigate = useNavigate()
  const { shipRef, shipRender } = useShipControls()
  const speed   = Math.abs(shipRender.speed)
  const heading = ((shipRender.angle%360)+360)%360

  return (
    <div style={{ position:'relative', width:'100%', height:'calc(100vh - 88px)', overflow:'hidden', borderRadius:16, background:'#7ecbe8' }}>

      <Canvas dpr={[1,1.8]}
        camera={{ position:[0,13,10], fov:52, near:0.1, far:200 }}
        gl={{ antialias:true, alpha:false, toneMapping:THREE.ACESFilmicToneMapping, toneMappingExposure:1.15 }}
        shadows style={{ position:'absolute', inset:0 }}>
        <Suspense fallback={null}>
          <Scene shipRef={shipRef} navigate={navigate}/>
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
        <div style={{ fontSize:10, color:'rgba(255,255,255,0.65)', marginTop:3, fontFamily:'system-ui', letterSpacing:'0.2em', textShadow:'0 1px 4px rgba(0,0,0,0.4)' }}>
          CLICK A BEACON TO NAVIGATE
        </div>
      </div>

      {/* HUD */}
      <div style={{ position:'absolute', bottom:16, left:16, zIndex:10, background:'rgba(4,14,32,0.82)', border:'1px solid rgba(60,130,200,0.35)', borderRadius:12, padding:'12px 16px', backdropFilter:'blur(12px)', boxShadow:'0 4px 24px rgba(0,0,0,0.35)', fontFamily:'system-ui' }}>
        <div style={{ fontSize:9, fontWeight:800, color:'#60d4f0', letterSpacing:'0.15em', marginBottom:8 }}>HELM CONTROL</div>
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
