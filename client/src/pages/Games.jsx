import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Stars } from '@react-three/drei'
import { useSound } from '../context/SoundContext'
import api from '../utils/api'
import { ArrowLeft, Trophy } from 'lucide-react'
import * as THREE from 'three'
import NibiMascotImage from '../components/NibiMascotImage'

const FACTS = [
  '🧪 pH 6.5–8.5 is safe for aquatic life — outside this, fish struggle.',
  '🔬 Each pH unit = 10× more acidic. pH 5 is 100× more acidic than pH 7.',
  '🌊 Lake Superior holds 10% of all surface freshwater on Earth.',
  '🐟 Fish die below 3 mg/L dissolved oxygen — healthy water needs 8+ mg/L.',
  '🌾 Phosphorus runoff is #1 cause of algae blooms in Ontario lakes.',
  '🗺️ Northern Ontario has 250,000+ lakes — most lake-dense region on Earth.',
  '🧂 Road salt raises chloride — harmful to mayfly larvae and fish eggs.',
  '🌿 Mayfly larvae only survive in very clean water — key bioindicator.',
  '🏕️ Indigenous communities have monitored water quality for thousands of years.',
  '☀️ Warmer water holds less oxygen — climate change directly threatens fish.',
  '⚗️ Acid mine drainage drops pH to 2–3, lethal to almost all aquatic life.',
  '🔬 NORDIK Institute at Algoma University monitors Great Lakes health.',
  '🐠 Batchawana Bay is a critical Great Lakes spawning ground near the Soo.',
  '💊 Pharmaceutical runoff affects fish hormones and reproduction.',
  '🌱 Wetlands naturally filter up to 90% of water pollutants.',
  '🦅 Blue-green algae toxins can kill dogs in minutes — always check HAB alerts.',
  '💧 Clean water goal: ≤1 NTU turbidity, ≤10 mg/L nitrates, 0 E. coli.',
  '❄️ Spring snowmelt spikes turbidity in Northern Ontario rivers every year.',
  '🏭 Mining drainage must meet strict pH and heavy-metal discharge limits.',
  '💎 Volunteer with Water Rangers Canada — 30,000+ tests logged so far!',
]

const TRIVIA = [
  // Level 1
  { q:'What pH range is safe for drinking water?', opts:['4.0–5.0','6.5–8.5','9.0–11.0','2.0–4.0'], ans:1, fact:'Health Canada recommends pH 6.5–8.5 for safe drinking water.', lvl:1 },
  { q:'What does high turbidity indicate?', opts:['Clear water','Suspended particles','High oxygen','Low pH'], ans:1, fact:'Turbidity measures cloudiness from suspended particles like sediment or algae.', lvl:1 },
  { q:'Which Great Lake is largest by surface area?', opts:['Lake Erie','Lake Michigan','Lake Superior','Lake Huron'], ans:2, fact:'Lake Superior is the world\'s largest freshwater lake — 82,103 km².', lvl:1 },
  { q:'What causes eutrophication in lakes?', opts:['Excess nutrients (N & P)','Too much oxygen','Cold temperatures','Very clear water'], ans:0, fact:'Nitrogen and phosphorus from runoff fuel algae growth, depleting oxygen.', lvl:1 },
  { q:'Which organism signals very clean water?', opts:['Leeches','Mayfly larvae','Carp','Blue-green algae'], ans:1, fact:'Mayfly larvae can\'t survive pollution — finding them means clean water.', lvl:1 },
  // Level 2
  { q:'Acid rain is mainly caused by:', opts:['CO₂ & methane','SO₂ & NOₓ','O₂ & N₂','H₂O & salt'], ans:1, fact:'Sulfur dioxide and nitrogen oxides from vehicles and industry create acid rain.', lvl:2 },
  { q:'Health Canada nitrate limit for drinking water:', opts:['1 mg/L','10 mg/L','50 mg/L','100 mg/L'], ans:1, fact:'Nitrates above 10 mg/L are dangerous — especially for infants (blue baby syndrome).', lvl:2 },
  { q:'At what DO level do most fish begin to die?', opts:['8 mg/L','5 mg/L','3 mg/L','1 mg/L'], ans:2, fact:'Below 3 mg/L dissolved oxygen, most fish species cannot survive.', lvl:2 },
  { q:'Road salt raises which harmful ion in lakes?', opts:['Phosphorus','Nitrate','Chloride','Sulphate'], ans:2, fact:'Chloride from road salt is difficult to remove and harms aquatic insects.', lvl:2 },
  { q:'Max turbidity for drinking water (Health Canada):', opts:['5 NTU','1 NTU','10 NTU','0.1 NTU'], ans:1, fact:'Health Canada guideline: ≤1 NTU turbidity for treated drinking water.', lvl:2 },
  // Level 3
  { q:'A Secchi disk measures:', opts:['pH','Water transparency','Temperature','Flow rate'], ans:1, fact:'A Secchi disk is lowered until invisible — deeper visibility = cleaner water.', lvl:3 },
  { q:'HABs are harmful because they produce:', opts:['Oxygen','Cyanotoxins','Clean water','Fertilizer'], ans:1, fact:'Harmful Algal Bloom cyanotoxins can kill pets in minutes.', lvl:3 },
  { q:'Fecal contamination is confirmed by testing:', opts:['pH','E. coli CFU/100mL','Turbidity','Conductivity'], ans:1, fact:'E. coli must be 0 CFU/100mL for safe drinking water (Health Canada).', lvl:3 },
  { q:'CCME phosphorus guideline for lakes:', opts:['0.30 mg/L','0.030 mg/L','3.0 mg/L','30 mg/L'], ans:1, fact:'Total phosphorus ≤0.030 mg/L prevents eutrophication in lakes.', lvl:3 },
  { q:'Wetlands naturally filter what % of pollutants?', opts:['20%','50%','70%','90%'], ans:3, fact:'Wetlands act as natural filters — removing up to 90% of water pollutants.', lvl:3 },
  // Level 4
  { q:'How many lakes does Northern Ontario have?', opts:['10,000','50,000','250,000','1,000,000'], ans:2, fact:'Northern Ontario has 250,000+ lakes — highest lake density on Earth!', lvl:4 },
  { q:'The St. Mary\'s River connects:', opts:['Erie→Ontario','Huron→Erie','Superior→Huron','Michigan→Erie'], ans:2, fact:'The St. Mary\'s River flows from Lake Superior to Lake Huron through Sault Ste. Marie.', lvl:4 },
  { q:'NORDIK Institute is affiliated with:', opts:['Laurentian','McMaster','Algoma University','Waterloo'], ans:2, fact:'NORDIK Institute conducts environmental research at Algoma University, Sault Ste. Marie.', lvl:4 },
  { q:'Acid mine drainage can drop pH to:', opts:['6–7','4–5','2–3','10–11'], ans:2, fact:'Acid mine drainage from Northern ON mines can reach pH 2–3 — lethal to all life.', lvl:4 },
  { q:'Lake Superior holds what % of Earth\'s surface freshwater?', opts:['1%','5%','10%','25%'], ans:2, fact:'Lake Superior alone holds ~10% of all surface freshwater on Earth.', lvl:4 },
]

/* ═══════════════════════════════════════════════════════════
   GAME 1 — POLLUTION BLASTER (Space Invaders)
═══════════════════════════════════════════════════════════ */
function PollutionBlaster({ onComplete }) {
  const { play } = useSound()
  const [score, setScore] = useState(0)
  const [level, setLevel] = useState(1)
  const [lives, setLives] = useState(6)
  const [status, setStatus] = useState('ready')
  const [fact, setFact] = useState('')
  const [tick, setTick] = useState(0)

  const keysRef = useRef({ left:false, right:false, shoot:false })
  const factIdxRef = useRef(0)
  const completedRef = useRef(false)
  const gameRef = useRef(null)

  const makeEnemies = useCallback((lvl) => {
    const rows = Math.min(2 + lvl, 6)
    const cols = 8
    const list = []
    let id = 1
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        list.push({
          id: `e_${lvl}_${id++}`,
          x: -6.2 + c * 1.75,
          y: 5.8 - r * 1.2,
          hp: r >= 3 ? 2 : 1,
        })
      }
    }
    return list
  }, [])

  const resetGame = useCallback(() => {
    gameRef.current = {
      playerX: 0,
      bullets: [],
      enemyBullets: [],
      enemies: makeEnemies(1),
      dir: 1,
      speed: 0.018,
      level: 1,
      score: 0,
      lives: 6,
      shootCd: 0,
      enemyShootCd: 90,
      waveTimer: 0,
      overSent: false,
    }
    setScore(0)
    setLevel(1)
    setLives(6)
    setFact('')
    setStatus('playing')
    completedRef.current = false
  }, [makeEnemies])

  useEffect(() => {
    const onKey = (e) => {
      const down = e.type === 'keydown'
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') keysRef.current.left = down
      if (e.code === 'ArrowRight' || e.code === 'KeyD') keysRef.current.right = down
      if (e.code === 'Space') keysRef.current.shoot = down
      if (['ArrowLeft','ArrowRight','Space','KeyA','KeyD'].includes(e.code)) e.preventDefault()
      if (down && status !== 'playing' && e.code === 'Space') resetGame()
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('keyup', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('keyup', onKey)
    }
  }, [status, resetGame])

  useEffect(() => {
    if (status !== 'playing') return
    const iv = setInterval(() => {
      const g = gameRef.current
      if (!g) return

      if (keysRef.current.left) g.playerX = Math.max(-7, g.playerX - 0.24)
      if (keysRef.current.right) g.playerX = Math.min(7, g.playerX + 0.24)
      if (g.shootCd > 0) g.shootCd--
      if (g.enemyShootCd > 0) g.enemyShootCd--

      if (keysRef.current.shoot && g.shootCd <= 0) {
        g.bullets.push({ id:`b_${Date.now()}_${Math.random()}`, x:g.playerX, y:-5.55 })
        g.shootCd = 12
        play('drop')
      }

      if (g.waveTimer > 0) {
        g.waveTimer--
        if (g.waveTimer === 0) {
          g.level += 1
          g.enemies = makeEnemies(g.level)
          g.enemyBullets = []
          g.bullets = []
          g.speed = Math.min(0.018 + g.level * 0.006, 0.06)
          setLevel(g.level)
          setFact(FACTS[(factIdxRef.current++) % FACTS.length])
          play('levelUp')
        }
        setTick(t => t + 1)
        return
      }

      g.bullets = g.bullets.map(b => ({ ...b, y:b.y + 0.42 })).filter(b => b.y < 8)
      g.enemyBullets = g.enemyBullets.map(b => ({ ...b, y:b.y - (0.18 + g.level * 0.012) })).filter(b => b.y > -7)

      if (g.enemies.length) {
        let minX = Infinity
        let maxX = -Infinity
        for (const e of g.enemies) {
          e.x += g.dir * g.speed
          minX = Math.min(minX, e.x)
          maxX = Math.max(maxX, e.x)
        }
        if (maxX > 7 || minX < -7) {
          g.dir *= -1
          g.enemies.forEach(e => { e.y -= 0.28 })
        }
      }

      if (g.enemyShootCd <= 0 && g.enemies.length) {
        const shooter = g.enemies[Math.floor(Math.random() * g.enemies.length)]
        g.enemyBullets.push({ id:`eb_${Date.now()}_${Math.random()}`, x:shooter.x, y:shooter.y - 0.45 })
        g.enemyShootCd = Math.max(30, 95 - g.level * 6)
      }

      const bulletsLeft = []
      for (const b of g.bullets) {
        let hit = false
        for (let i = 0; i < g.enemies.length; i++) {
          const e = g.enemies[i]
          if (Math.abs(b.x - e.x) < 0.55 && Math.abs(b.y - e.y) < 0.48) {
            hit = true
            e.hp -= 1
            if (e.hp <= 0) {
              g.enemies.splice(i, 1)
              g.score += 10 + g.level * 3
              setScore(g.score)
              play('correct')
            }
            break
          }
        }
        if (!hit) bulletsLeft.push(b)
      }
      g.bullets = bulletsLeft

      const aliveEnemyBullets = []
      for (const b of g.enemyBullets) {
        if (Math.abs(b.x - g.playerX) < 0.65 && b.y < -5.25 && b.y > -6.2) {
          g.lives -= 1
          setLives(g.lives)
          play('wrong')
        } else {
          aliveEnemyBullets.push(b)
        }
      }
      g.enemyBullets = aliveEnemyBullets

      if (g.enemies.some(e => e.y < -4.8)) g.lives = 0

      if (g.lives <= 0) {
        if (!g.overSent) {
          g.overSent = true
          setStatus('gameover')
          if (!completedRef.current) {
            completedRef.current = true
            onComplete(g.score)
          }
        }
      } else if (g.enemies.length === 0 && g.waveTimer === 0) {
        g.waveTimer = 70
      }

      setTick(t => t + 1)
    }, 16)
    return () => clearInterval(iv)
  }, [status, makeEnemies, onComplete, play])

  useEffect(() => { resetGame() }, [resetGame])

  const game = gameRef.current || { playerX:0, bullets:[], enemyBullets:[], enemies:[] }

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="w-full" style={{ height: 480, borderRadius:12, overflow:'hidden', border:'2px solid rgba(56,189,248,0.25)' }}>
        <Canvas camera={{ position:[0, 0, 14], fov:58 }}>
          <color attach="background" args={['#020617']} />
          <fog attach="fog" args={['#020617', 14, 28]} />
          <ambientLight intensity={0.6} />
          <pointLight position={[0, 9, 8]} intensity={1.7} color="#7dd3fc" />
          <pointLight position={[-8, -3, 6]} intensity={0.9} color="#f97316" />
          <Stars radius={70} depth={30} count={1300} factor={2.6} fade speed={1.6} />

          <mesh position={[game.playerX, -5.8, 0]}>
            <coneGeometry args={[0.55, 1.25, 7]} />
            <meshStandardMaterial color="#38bdf8" emissive="#0ea5e9" emissiveIntensity={0.45} metalness={0.2} roughness={0.35} />
          </mesh>

          {game.enemies.map((e) => (
            <mesh key={e.id} position={[e.x, e.y, 0]} rotation={[tick * 0.01, tick * 0.015, 0]}>
              <octahedronGeometry args={[0.42 + e.hp * 0.08, 0]} />
              <meshStandardMaterial color={e.hp > 1 ? '#fb7185' : '#f43f5e'} emissive="#7f1d1d" emissiveIntensity={0.4} metalness={0.4} roughness={0.28} />
            </mesh>
          ))}

          {game.bullets.map((b) => (
            <mesh key={b.id} position={[b.x, b.y, 0]}>
              <capsuleGeometry args={[0.08, 0.34, 3, 6]} />
              <meshStandardMaterial color="#67e8f9" emissive="#22d3ee" emissiveIntensity={1.1} toneMapped={false} />
            </mesh>
          ))}

          {game.enemyBullets.map((b) => (
            <mesh key={b.id} position={[b.x, b.y, 0]}>
              <sphereGeometry args={[0.11, 10, 10]} />
              <meshStandardMaterial color="#fb923c" emissive="#f97316" emissiveIntensity={1} toneMapped={false} />
            </mesh>
          ))}

          <mesh position={[0, -6.8, -1]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[18, 6]} />
            <meshStandardMaterial color="#0f172a" metalness={0.1} roughness={0.9} />
          </mesh>
        </Canvas>
      </div>

      <div className="w-full flex items-center justify-between text-sm font-bold" style={{color:'var(--text)'}}>
        <span>Score: <span style={{color:'#22d3ee'}}>{score}</span></span>
        <span>Wave: <span style={{color:'#fbbf24'}}>{level}</span></span>
        <span>Lives: {'❤️'.repeat(Math.max(0, lives))}</span>
      </div>

      {fact && status === 'playing' && (
        <div className="w-full text-center text-xs" style={{color:'#38bdf8'}}>
          {fact}
        </div>
      )}

      {status === 'gameover' && (
        <button onClick={resetGame} className="btn-primary px-6 py-2">Play Again</button>
      )}

      <p className="text-sm font-medium text-center" style={{color:'var(--text-muted)'}}>
        A / D or ← / → to move · SPACE to fire · hold fire for arcade mode
      </p>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════
   GAME 2 — WATER RUSH (Geometry Dash endless runner)
═══════════════════════════════════════════════════════════ */
const LVL_COLORS=[['#0369a1','#38bdf8'],['#b45309','#fb923c'],['#6d28d9','#a78bfa'],['#064e3b','#10b981'],['#0c1445','#1e3a8a']]

function WaterRush({ onComplete }) {
  const canvasRef = useRef(null)
  const bestRef = useRef(parseInt(localStorage.getItem('wr_best')||'0'))
  const { play } = useSound()

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const W=600,H=240; canvas.width=W; canvas.height=H
    const FY=192,PS=22,PX=105,GRV=0.52,JVY=-12.0,DJVY=-9.5

    const s={
      p:{y:FY-PS,vy:0,onGr:true,djLeft:1},
      obs:[],gems:[],parts:[],trail:[],
      speed:2.0,frame:0,score:0,level:1,alive:true,started:false,
      nextObs:120,nextGem:50,lvTimer:0,lvFact:'',factIdx:0,
    }

    const jump=()=>{
      if(!s.alive){restart();return}
      if(!s.started) s.started=true
      if(s.p.onGr){s.p.vy=JVY;s.p.onGr=false;s.p.djLeft=1;play('drop')}
      else if(s.p.djLeft>0){s.p.vy=DJVY;s.p.djLeft--;play('drop');for(let i=0;i<6;i++){const a=Math.random()*Math.PI*2;s.parts.push({x:PX,y:s.p.y+PS/2,vx:Math.cos(a)*2.5,vy:Math.sin(a)*2.5,life:18,max:18,col:'#38bdf8',r:3})}}
    }
    const restart=()=>{
      s.p={y:FY-PS,vy:0,onGr:true,djLeft:1}
      s.obs=[];s.gems=[];s.parts=[];s.trail=[]
      s.speed=2.0;s.frame=0;s.score=0;s.level=1;s.alive=true;s.started=false
      s.nextObs=120;s.nextGem=50;s.lvTimer=0;s.lvFact=''
    }
    const onKey=e=>{if(['Space','ArrowUp'].includes(e.code)||e.key===' '){e.preventDefault();jump()}}
    canvas.addEventListener('click',jump)
    canvas.addEventListener('touchstart',e=>{e.preventDefault();jump()},{passive:false})
    window.addEventListener('keydown',onKey)

    let raf
    const loop=()=>{
      s.frame++;ctx.clearRect(0,0,W,H)
      const [c1,c2]=LVL_COLORS[Math.min(s.level-1,LVL_COLORS.length-1)]
      const bg=ctx.createLinearGradient(0,0,0,H);bg.addColorStop(0,c1);bg.addColorStop(1,c2)
      ctx.fillStyle=bg;ctx.fillRect(0,0,W,H)
      if(s.lvTimer>0){ctx.fillStyle=`rgba(255,255,255,${(s.lvTimer/50)*0.25})`;ctx.fillRect(0,0,W,H)}
      // ground
      ctx.fillStyle='rgba(0,0,0,0.22)';ctx.fillRect(0,FY,W,H-FY)
      ctx.strokeStyle='rgba(255,255,255,0.4)';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(0,FY);ctx.lineTo(W,FY);ctx.stroke()

      if(!s.alive){
        // draw static scene then death overlay
        for(const o of s.obs){ctx.fillStyle='#ef4444';ctx.shadowColor='#ef4444';ctx.shadowBlur=8;ctx.beginPath();ctx.moveTo(o.x,FY);ctx.lineTo(o.x+o.w/2,FY-o.h);ctx.lineTo(o.x+o.w,FY);ctx.closePath();ctx.fill();ctx.shadowBlur=0}
        ctx.fillStyle='rgba(0,0,0,0.55)';ctx.fillRect(W/2-105,H/2-44,210,96)
        ctx.textAlign='center';ctx.fillStyle='#ef4444';ctx.font='bold 22px system-ui';ctx.fillText('💀 SPLAT!',W/2,H/2-14)
        ctx.fillStyle='#fbbf24';ctx.font='bold 15px system-ui';ctx.fillText(`Gems: ${s.score}  Best: ${bestRef.current}`,W/2,H/2+14)
        ctx.fillStyle='rgba(255,255,255,0.55)';ctx.font='12px system-ui';ctx.fillText('SPACE / tap to try again',W/2,H/2+38)
        ctx.textAlign='left';raf=requestAnimationFrame(loop);return
      }

      if(s.started){
        // physics
        s.p.vy+=GRV;s.p.y+=s.p.vy
        if(s.p.y>=FY-PS){s.p.y=FY-PS;s.p.vy=0;s.p.onGr=true;s.p.djLeft=1}else s.p.onGr=false

        // spawn obstacles
        s.nextObs--
        if(s.nextObs<=0){
          const h=12+Math.random()*(5+s.level*4);s.obs.push({x:W+10,w:28,h:Math.min(h,58)})
          if(Math.random()<0.12+s.level*0.03) s.obs.push({x:W+90+Math.random()*30,w:22,h:20})
          s.nextObs=Math.max(70,130-s.level*5)+Math.floor(Math.random()*45)
        }
        s.obs=s.obs.map(o=>({...o,x:o.x-s.speed})).filter(o=>o.x+o.w>-10)

        // spawn gems
        s.nextGem--
        if(s.nextGem<=0){
          s.gems.push({x:W+10,y:FY-30-Math.random()*50,col:false,pulse:Math.random()*Math.PI*2})
          s.nextGem=52+Math.floor(Math.random()*28)
        }
        s.gems=s.gems.map(g=>({...g,x:g.x-s.speed})).filter(g=>g.x>-15)

        // collide obstacles
        for(const o of s.obs){
          if(PX+PS>o.x+4&&PX<o.x+o.w-4&&s.p.y+PS>FY-o.h+5){
            s.alive=false;play('wrong')
            for(let i=0;i<14;i++){const a=Math.random()*Math.PI*2;s.parts.push({x:PX+PS/2,y:s.p.y+PS/2,vx:Math.cos(a)*3.5,vy:Math.sin(a)*3.5-1.5,life:30,max:30,col:'#38bdf8',r:4})}
            if(s.score>bestRef.current){bestRef.current=s.score;localStorage.setItem('wr_best',s.score)}
            break
          }
        }

        // collide gems
        for(const g of s.gems){
          if(!g.col&&PX+PS>g.x-8&&PX<g.x+8&&s.p.y<g.y+8&&s.p.y+PS>g.y-8){
            g.col=true;s.score++;play('drop')
            for(let i=0;i<5;i++){const a=Math.random()*Math.PI*2;s.parts.push({x:g.x,y:g.y,vx:Math.cos(a)*2,vy:Math.sin(a)*2,life:16,max:16,col:'#fbbf24',r:3})}
            if(s.score%10===0){s.level++;s.speed=Math.min(2.0+s.level*0.45,8.5);s.lvTimer=70;s.lvFact=FACTS[(s.factIdx++)%FACTS.length];play('levelUp')}
          }
        }

        s.parts=s.parts.filter(p=>p.life-->0);s.parts.forEach(p=>{p.x+=p.vx;p.y+=p.vy;p.vy+=0.12})
        if(s.lvTimer>0) s.lvTimer--
      }

      // draw obstacles
      for(const o of s.obs){
        ctx.fillStyle='#ef4444';ctx.shadowColor='#ef4444';ctx.shadowBlur=10
        ctx.beginPath();ctx.moveTo(o.x,FY);ctx.lineTo(o.x+o.w/2,FY-o.h);ctx.lineTo(o.x+o.w,FY);ctx.closePath();ctx.fill();ctx.shadowBlur=0
      }

      // draw gems
      for(const g of s.gems){
        if(g.col)continue;g.pulse+=0.12
        const r=5+Math.sin(g.pulse)*1.5
        ctx.shadowColor='#fbbf24';ctx.shadowBlur=12;ctx.fillStyle='#fbbf24'
        ctx.beginPath();ctx.moveTo(g.x,g.y-r);ctx.lineTo(g.x+r*0.7,g.y);ctx.lineTo(g.x,g.y+r);ctx.lineTo(g.x-r*0.7,g.y);ctx.closePath();ctx.fill();ctx.shadowBlur=0
      }

      // trail + player
      s.trail.push({x:PX,y:s.p.y+PS/2,f:s.frame});if(s.trail.length>15)s.trail.shift()
      s.trail.forEach((pt,i)=>{const a=i/s.trail.length;ctx.fillStyle=`rgba(56,189,248,${a*0.22})`;ctx.fillRect(pt.x-(PS/2*a),pt.y-(PS/2*a),PS*a,PS*a)})
      const g2=ctx.createLinearGradient(PX,s.p.y,PX+PS,s.p.y+PS);g2.addColorStop(0,'#38bdf8');g2.addColorStop(1,'#0ea5e9')
      ctx.shadowColor='#38bdf8';ctx.shadowBlur=16;ctx.fillStyle=g2;ctx.fillRect(PX,s.p.y,PS,PS)
      ctx.fillStyle='rgba(255,255,255,0.3)';ctx.fillRect(PX+3,s.p.y+3,PS-6,4);ctx.shadowBlur=0

      // particles
      for(const p of s.parts){ctx.globalAlpha=p.life/p.max;ctx.fillStyle=p.col;ctx.beginPath();ctx.arc(p.x,p.y,p.r*(p.life/p.max),0,Math.PI*2);ctx.fill()}
      ctx.globalAlpha=1

      // HUD bar
      ctx.fillStyle='rgba(0,0,0,0.32)';ctx.fillRect(0,0,W,32)
      ctx.fillStyle='white';ctx.font='bold 13px system-ui';ctx.fillText(`💎 ${s.score}`,12,21)
      ctx.fillStyle='#fbbf24';ctx.fillText(`LEVEL ${s.level}`,82,21)
      ctx.textAlign='right';ctx.fillStyle='rgba(255,255,255,0.55)';ctx.fillText(`BEST ${bestRef.current}`,W-12,21);ctx.textAlign='left'

      if(s.lvTimer>0&&s.lvFact){
        const al=Math.min(1,s.lvTimer/25)
        ctx.globalAlpha=al;ctx.textAlign='center'
        ctx.fillStyle='#fbbf24';ctx.font='bold 24px system-ui';ctx.fillText(`⭐ LEVEL ${s.level}`,W/2,H/2-8)
        ctx.fillStyle='white';ctx.font='11px system-ui';ctx.fillText(s.lvFact.slice(0,72),W/2,H/2+14)
        ctx.textAlign='left';ctx.globalAlpha=1
      }

      if(!s.started&&s.alive){
        ctx.fillStyle='rgba(0,0,0,0.45)';ctx.fillRect(W/2-115,H/2-28,230,62)
        ctx.textAlign='center';ctx.fillStyle='white';ctx.font='bold 16px system-ui';ctx.fillText('💧 Water Rush',W/2,H/2-4)
        ctx.fillStyle='rgba(255,255,255,0.65)';ctx.font='12px system-ui';ctx.fillText('SPACE or tap · double-jump allowed',W/2,H/2+20)
        ctx.textAlign='left'
      }

      raf=requestAnimationFrame(loop)
    }
    raf=requestAnimationFrame(loop)
    return()=>{cancelAnimationFrame(raf);window.removeEventListener('keydown',onKey);canvas.removeEventListener('click',jump);canvas.removeEventListener('touchstart',jump)}
  },[])

  return(
    <div className="flex flex-col items-center gap-3">
      <canvas ref={canvasRef} style={{borderRadius:12,border:'2px solid rgba(56,189,248,0.22)',cursor:'pointer',touchAction:'none'}}/>
      <p className="text-sm font-medium" style={{color:'var(--text-muted)'}}>SPACE / tap to jump · tap again mid-air = double jump · dodge red spikes · collect 💎 gems</p>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════
   GAME 3 — pH PANIC (fast reaction sort)
═══════════════════════════════════════════════════════════ */
const PH_Q=[
  {ph:2.1,cat:'acid',lbl:'Acid mine drainage'},{ph:3.7,cat:'acid',lbl:'Acid rain'},
  {ph:4.5,cat:'acid',lbl:'Peat bog water'},{ph:5.8,cat:'acid',lbl:'Soft Ontario wetland'},
  {ph:6.0,cat:'acid',lbl:'Natural rainwater'},{ph:6.3,cat:'acid',lbl:'CO₂-rich stream'},
  {ph:6.5,cat:'safe',lbl:'Soft stream water'},{ph:6.8,cat:'safe',lbl:'Ontario spring water'},
  {ph:7.0,cat:'safe',lbl:'Pure distilled water'},{ph:7.2,cat:'safe',lbl:'Northern ON tap water'},
  {ph:7.5,cat:'safe',lbl:'Drinking water target'},{ph:7.8,cat:'safe',lbl:'Lake Superior surface'},
  {ph:8.1,cat:'safe',lbl:'Great Lakes average'},{ph:8.4,cat:'safe',lbl:'Healthy lake water'},
  {ph:8.7,cat:'base',lbl:'Algae-affected lake'},{ph:9.2,cat:'base',lbl:'Algae bloom peak'},
  {ph:9.8,cat:'base',lbl:'Industrial effluent'},{ph:11.0,cat:'base',lbl:'Bleach dilution'},
  {ph:12.5,cat:'base',lbl:'Industrial waste'},{ph:13.2,cat:'base',lbl:'Chemical plant discharge'},
]
const PH_COL={acid:'#ef4444',safe:'#22c55e',base:'#3b82f6'}
const PH_LBL={acid:'🔴 ACID  (< 6.5)',safe:'🟢 SAFE  (6.5–8.5)',base:'🔵 BASE  (> 8.5)'}
const TIME_LVL=[12000,9000,6500,5000,3500]

function PHPanic({ onComplete }) {
  const { play } = useSound()
  const [qIdx,setQIdx]=useState(()=>Math.floor(Math.random()*PH_Q.length))
  const [score,setScore]=useState(0)
  const [combo,setCombo]=useState(0)
  const [lives,setLives]=useState(5)
  const [level,setLevel]=useState(1)
  const [timeLeft,setTimeLeft]=useState(8000)
  const [fb,setFb]=useState(null)
  const [done,setDone]=useState(false)
  const [nCorrect,setNCorrect]=useState(0)
  const scoreR=useRef(0),comboR=useRef(0),livesR=useRef(5),levelR=useRef(1),startR=useRef(Date.now()),phaseR=useRef('q')

  const next=useCallback(()=>{
    setQIdx(Math.floor(Math.random()*PH_Q.length))
    const lim=TIME_LVL[Math.min(levelR.current-1,TIME_LVL.length-1)]
    setTimeLeft(lim);startR.current=Date.now();phaseR.current='q'
  },[])

  useEffect(()=>{
    if(done||phaseR.current!=='q') return
    const iv=setInterval(()=>{
      if(phaseR.current!=='q'){clearInterval(iv);return}
      const lim=TIME_LVL[Math.min(levelR.current-1,TIME_LVL.length-1)]
      const rem=Math.max(0,lim-(Date.now()-startR.current))
      setTimeLeft(rem)
      if(rem<=0){
        clearInterval(iv);phaseR.current='fb'
        comboR.current=0;setCombo(0);livesR.current--;setLives(livesR.current);play('wrong')
        setFb({ok:false,msg:'⏱️ Too slow!'})
        if(livesR.current<=0){setTimeout(()=>{setDone(true);onComplete(scoreR.current)},900)}
        else setTimeout(()=>{setFb(null);next()},950)
      }
    },50)
    return()=>clearInterval(iv)
  },[qIdx,done,next])

  const answer=(cat)=>{
    if(phaseR.current!=='q'||done) return
    phaseR.current='fb'
    const q=PH_Q[qIdx],ok=cat===q.cat
    if(ok){
      comboR.current++;setCombo(comboR.current)
      const mult=Math.min(comboR.current,5)
      const pts=10*mult;scoreR.current+=pts;setScore(scoreR.current)
      setNCorrect(c=>c+1)
      const newLvl=Math.min(Math.floor(scoreR.current/80)+1,5)
      if(newLvl>levelR.current){levelR.current=newLvl;setLevel(newLvl)}
      play('correct')
      const elapsed=Date.now()-startR.current
      const lim=TIME_LVL[Math.min(levelR.current-1,TIME_LVL.length-1)]
      setFb({ok:true,msg:`+${pts}${mult>1?` (×${mult} combo!)`:''}`+(elapsed<lim*0.38?' ⚡ FAST!':'')})
    } else {
      comboR.current=0;setCombo(0);livesR.current--;setLives(livesR.current);play('wrong')
      setFb({ok:false,msg:`pH ${q.ph} is → ${PH_LBL[q.cat]}`})
    }
    if(livesR.current<=0){setTimeout(()=>{setDone(true);onComplete(scoreR.current)},1100);return}
    setTimeout(()=>{setFb(null);next()},ok?700:1100)
  }

  const q=PH_Q[qIdx]
  const pct=(q.ph/14)*100
  const hue=pct<46?0:pct>61?240:120
  const lim=TIME_LVL[Math.min(level-1,TIME_LVL.length-1)]
  const tFrac=timeLeft/lim

  if(done) return(
    <div style={{textAlign:'center',padding:'40px 20px'}}>
      <div style={{fontSize:64,marginBottom:10}}>⚗️</div>
      <div style={{fontSize:26,fontWeight:900,color:'var(--text)',marginBottom:8}}>pH Panic — Complete!</div>
      <div style={{fontSize:22,color:'#f59e0b',fontWeight:800,marginBottom:6}}>Score: {scoreR.current}</div>
      <div style={{fontSize:14,color:'var(--text-muted)'}}>Correct: {nCorrect} · Level reached: {level}</div>
    </div>
  )

  return(
    <div style={{maxWidth:460,margin:'0 auto',fontFamily:'system-ui'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
        <div style={{display:'flex',gap:10,alignItems:'center'}}>
          <span style={{fontWeight:800,fontSize:19,color:'var(--text)'}}>{score}<span style={{fontSize:11,color:'var(--text-muted)',marginLeft:3}}>pts</span></span>
          {combo>1&&<span style={{fontSize:13,fontWeight:800,color:'#f59e0b',background:'rgba(245,158,11,0.12)',border:'1px solid #f59e0b40',padding:'2px 8px',borderRadius:20}}>🔥 ×{Math.min(combo,5)}</span>}
        </div>
        <div style={{display:'flex',gap:8,alignItems:'center'}}>
          <span style={{fontSize:11,fontWeight:700,color:'var(--text-muted)',letterSpacing:'0.1em'}}>LV.{level}</span>
          <span style={{fontSize:16}}>{'❤️'.repeat(Math.max(0,lives))}</span>
        </div>
      </div>
      <div style={{height:5,borderRadius:3,background:'rgba(255,255,255,0.08)',marginBottom:16,overflow:'hidden'}}>
        <div style={{height:'100%',borderRadius:3,width:`${tFrac*100}%`,background:tFrac>0.4?'#22c55e':tFrac>0.2?'#f59e0b':'#ef4444',transition:'background 0.3s,width 0.05s linear'}}/>
      </div>
      <div style={{borderRadius:16,padding:'20px 24px',textAlign:'center',marginBottom:14,background:'var(--card-bg)',border:'1px solid var(--border)',boxShadow:'0 4px 20px rgba(0,0,0,0.12)'}}>
        <div style={{fontSize:11,color:'var(--text-muted)',letterSpacing:'0.1em',marginBottom:6}}>{q.lbl}</div>
        <div style={{fontSize:68,fontWeight:900,lineHeight:1,color:`hsl(${hue},65%,${hue===120?'36%':'46%'})`,marginBottom:10}}>pH {q.ph}</div>
        <div style={{position:'relative',height:12,borderRadius:6,marginBottom:4,overflow:'hidden',background:'linear-gradient(to right,#ef4444,#f97316,#eab308,#22c55e,#22c55e,#3b82f6,#6366f1)'}}>
          <div style={{position:'absolute',top:1,bottom:1,width:3,borderRadius:2,background:'white',boxShadow:'0 0 4px rgba(0,0,0,0.5)',left:`calc(${pct}% - 1.5px)`,transition:'left 0.2s'}}/>
        </div>
        <div style={{display:'flex',justifyContent:'space-between',fontSize:9,color:'var(--text-muted)'}}>
          <span>0 — Acid</span><span>7 — Neutral</span><span>14 — Base</span>
        </div>
      </div>
      {fb&&<div style={{textAlign:'center',padding:'10px',borderRadius:12,marginBottom:12,fontSize:14,fontWeight:800,background:fb.ok?'rgba(34,197,94,0.12)':'rgba(239,68,68,0.10)',color:fb.ok?'#22c55e':'#ef4444',border:`1px solid ${fb.ok?'#22c55e30':'#ef444430'}`}}>{fb.ok?'✅':'❌'} {fb.msg}</div>}
      {!fb&&<div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8}}>
        {['acid','safe','base'].map(cat=>(
          <button key={cat} onClick={()=>answer(cat)} style={{padding:'14px 4px',borderRadius:14,fontWeight:800,fontSize:11,cursor:'pointer',border:`2px solid ${PH_COL[cat]}`,background:`${PH_COL[cat]}18`,color:PH_COL[cat],transition:'all 0.1s',letterSpacing:'0.03em',textAlign:'center'}}
            onMouseEnter={e=>{e.currentTarget.style.background=`${PH_COL[cat]}30`;e.currentTarget.style.transform='scale(1.05)'}}
            onMouseLeave={e=>{e.currentTarget.style.background=`${PH_COL[cat]}18`;e.currentTarget.style.transform='scale(1)'}}>
            {PH_LBL[cat]}
          </button>
        ))}
      </div>}
      <div style={{textAlign:'center',marginTop:10,fontSize:10,color:'var(--text-muted)'}}>Level {level} · {lim/1000}s per answer · combo multiplies points!</div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════
   GAME 4 — TRIVIA BLITZ (4 levels, streaks, speed)
═══════════════════════════════════════════════════════════ */
const DECAY=[0.35,0.65,0.95,1.35]
const LVL_NAMES=['💧 Water Basics','🧪 Chemistry','🌿 Ecology','🏔️ Northern ON Expert']

function TriviaBlitz({ onComplete }) {
  const { play } = useSound()
  const [level,setLevel]=useState(1)
  const [qIdx,setQIdx]=useState(0)
  const [lives,setLives]=useState(6)
  const [score,setScore]=useState(0)
  const [streak,setStreak]=useState(0)
  const [sel,setSel]=useState(null)
  const [timeLeft,setTimeLeft]=useState(100)
  const [done,setDone]=useState(false)
  const [phase,setPhase]=useState('q') // q | fb | lvup
  const [nRight,setNRight]=useState(0)

  const lR=useRef(6),sR=useRef(0),stR=useRef(0),phR=useRef('q'),lvR=useRef(1)
  const QPL=5

  const levelQs=useMemo(()=>TRIVIA.filter(q=>q.lvl===lvR.current),[level])
  const cur=levelQs[Math.min(qIdx,levelQs.length-1)]

  useEffect(()=>{
    if(done||phR.current!=='q'||!cur) return
    setTimeLeft(100)
    const iv=setInterval(()=>{
      if(phR.current!=='q'){clearInterval(iv);return}
      setTimeLeft(t=>{
        const n=t-DECAY[Math.min(lvR.current-1,3)]
        if(n<=0){
          clearInterval(iv);phR.current='fb'
          stR.current=0;setStreak(0);lR.current--;setLives(lR.current);play('wrong');setSel(-1)
          if(lR.current<=0){setTimeout(()=>{setDone(true);onComplete(sR.current)},900)}
          else setTimeout(()=>{setSel(null);phR.current='q';setPhase('q');setQIdx(i=>i+1)},1100)
          return 0
        }
        return n
      })
    },50)
    return()=>clearInterval(iv)
  },[qIdx,phase,done,level])

  const pick=(i)=>{
    if(phR.current!=='q'||!cur) return
    phR.current='fb';setPhase('fb');setSel(i)
    const ok=i===cur.ans
    if(ok){
      stR.current++;setStreak(stR.current)
      const m=Math.min(stR.current,4),pts=20*m
      sR.current+=pts;setScore(sR.current);setNRight(r=>r+1);play('correct')
    } else {
      stR.current=0;setStreak(0);lR.current--;setLives(lR.current);play('wrong')
    }
    const nxt=qIdx+1
    const lvDone=nxt>=QPL,gameDone=lvDone&&lvR.current>=4
    setTimeout(()=>{
      setSel(null)
      if(lR.current<=0||gameDone){setDone(true);onComplete(sR.current);return}
      if(lvDone){phR.current='lvup';setPhase('lvup')}
      else{phR.current='q';setPhase('q');setQIdx(nxt)}
    },ok?850:1250)
  }

  const nextLvl=()=>{
    const nl=lvR.current+1;lvR.current=nl;setLevel(nl);setQIdx(0);phR.current='q';setPhase('q');setSel(null)
  }

  if(done){
    const g=nRight>=16?'S':nRight>=11?'A':nRight>=7?'B':'C'
    const gc={S:'#f59e0b',A:'#22c55e',B:'#3b82f6',C:'#94a3b8'}
    return(
      <div style={{textAlign:'center',padding:'32px 20px',maxWidth:420,margin:'0 auto'}}>
        <div style={{fontSize:72,marginBottom:8}}>🏆</div>
        <div style={{fontSize:24,fontWeight:900,color:'var(--text)'}}>Trivia Blitz Complete!</div>
        <div style={{fontSize:52,fontWeight:900,color:gc[g],margin:'12px 0'}}>Grade {g}</div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:10,margin:'14px 0'}}>
          {[['Score',sR.current,'#6366f1'],['Correct',`${nRight}/${lvR.current*QPL}`,'#22c55e'],['Top Level',`Lv.${lvR.current}`,'#f59e0b']].map(([l,v,c])=>(
            <div key={l} style={{padding:'10px',borderRadius:12,background:'var(--card-bg)',border:'1px solid var(--border)'}}>
              <div style={{fontSize:19,fontWeight:900,color:c}}>{v}</div>
              <div style={{fontSize:10,color:'var(--text-muted)'}}>{l}</div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if(phase==='lvup') return(
    <div style={{textAlign:'center',padding:'40px 24px',maxWidth:460,margin:'0 auto'}}>
      <div style={{fontSize:60,marginBottom:8}}>⭐</div>
      <div style={{fontSize:22,fontWeight:900,color:'#f59e0b'}}>Level {level} Complete!</div>
      <div style={{fontSize:13,color:'var(--text-muted)',margin:'8px 0 18px'}}>Next: {LVL_NAMES[level]} — harder, faster!</div>
      <div style={{fontSize:16,fontWeight:800,color:'var(--text)',marginBottom:18}}>Score: {sR.current}</div>
      <button onClick={nextLvl} style={{padding:'13px 34px',borderRadius:14,fontWeight:800,fontSize:14,background:'linear-gradient(135deg,#6366f1,#8b5cf6)',color:'white',border:'none',cursor:'pointer',boxShadow:'0 4px 16px rgba(99,102,241,0.4)'}}>
        Continue to Level {level+1} →
      </button>
    </div>
  )

  if(!cur) return null
  const timerCol=timeLeft>50?'#22c55e':timeLeft>25?'#f59e0b':'#ef4444'

  return(
    <div style={{maxWidth:500,margin:'0 auto',fontFamily:'system-ui'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14}}>
        <div>
          <div style={{fontSize:12,fontWeight:800,color:'#6366f1',letterSpacing:'0.1em'}}>{LVL_NAMES[level-1]}</div>
          <div style={{fontSize:11,color:'var(--text-muted)',marginTop:1}}>Q {qIdx+1}/{QPL}</div>
        </div>
        <div style={{display:'flex',gap:10,alignItems:'center'}}>
          {streak>=2&&<div style={{fontSize:13,fontWeight:800,color:'#f59e0b',background:'rgba(245,158,11,0.1)',border:'1px solid #f59e0b35',padding:'3px 9px',borderRadius:20}}>🔥 ×{Math.min(streak,4)}</div>}
          <div style={{fontWeight:800,fontSize:16,color:'var(--text)'}}>{score}</div>
          <div style={{fontSize:16}}>{'❤️'.repeat(Math.max(0,lives))}</div>
        </div>
      </div>
      <div style={{height:5,borderRadius:3,background:'rgba(255,255,255,0.08)',marginBottom:14,overflow:'hidden'}}>
        <div style={{height:'100%',borderRadius:3,width:`${timeLeft}%`,background:timerCol,transition:'background 0.3s,width 0.05s linear'}}/>
      </div>
      <div style={{borderRadius:14,padding:'16px 18px',marginBottom:12,background:'var(--card-bg)',border:'1px solid var(--border)'}}>
        <p style={{fontSize:16,fontWeight:700,color:'var(--text)',lineHeight:1.45,margin:0}}>{cur.q}</p>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:9}}>
        {cur.opts.map((opt,i)=>{
          let bg='var(--card-bg)',border='var(--border)',col='var(--text)'
          if(sel!==null&&sel!==-1){
            if(i===cur.ans){bg='rgba(34,197,94,0.13)';border='#22c55e';col='#22c55e'}
            else if(i===sel){bg='rgba(239,68,68,0.10)';border='#ef4444';col='#ef4444'}
            else col='var(--text-muted)'
          }
          return(
            <button key={i} onClick={()=>pick(i)} disabled={phase!=='q'}
              style={{padding:'13px 12px',borderRadius:11,textAlign:'left',fontSize:13,fontWeight:600,background:bg,border:`1.5px solid ${border}`,color:col,cursor:phase==='q'?'pointer':'default',transition:'all 0.14s',lineHeight:1.35}}
              onMouseEnter={e=>{if(phase==='q'){e.currentTarget.style.background='rgba(99,102,241,0.09)';e.currentTarget.style.borderColor='#6366f1'}}}
              onMouseLeave={e=>{if(phase==='q'){e.currentTarget.style.background=bg;e.currentTarget.style.borderColor=border}}}>
              <span style={{fontSize:10,fontWeight:800,color:'#6366f1',marginRight:5}}>{String.fromCharCode(65+i)}.</span>{opt}
            </button>
          )
        })}
      </div>
      {sel!==null&&sel!==-1&&<div style={{marginTop:11,padding:'9px 13px',borderRadius:10,background:'rgba(99,102,241,0.07)',border:'1px solid rgba(99,102,241,0.18)',fontSize:12,color:'var(--text-muted)'}}>💡 {cur.fact}</div>}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════
   GAME 5 — WATER SNAKE (with levels)
═══════════════════════════════════════════════════════════ */
function WaterSnake({ onComplete }) {
  const canvasRef = useRef(null)
  const stateRef = useRef(null)
  const [score,setScore]=useState(0)
  const [dead,setDead]=useState(false)
  const [level,setLevel]=useState(1)
  const [started,setStarted]=useState(false)
  const [fact,setFact]=useState('')
  const { play } = useSound()

  useEffect(()=>{
    const canvas=canvasRef.current; if(!canvas) return
    const ctx=canvas.getContext('2d')
    const W=canvas.width=400,H=canvas.height=400
    const CELL=20,COLS=W/CELL,ROWS=H/CELL
    const rand=n=>Math.floor(Math.random()*n)
    const spawn=()=>({x:rand(COLS),y:rand(ROWS)})

    const s={
      snake:[{x:10,y:10},{x:9,y:10},{x:8,y:10}],
      dir:{x:1,y:0},nextDir:{x:1,y:0},
      food:[spawn()],poison:[spawn()],
      score:0,alive:true,started:false,frame:0,tickRate:15,level:1,factIdx:0,factTimer:0,fact:'',
    }
    stateRef.current=s

    const onKey=e=>{
      if(!s.started){s.started=true;setStarted(true)}
      if(e.key==='ArrowUp'&&s.dir.y!==1) s.nextDir={x:0,y:-1}
      if(e.key==='ArrowDown'&&s.dir.y!==-1) s.nextDir={x:0,y:1}
      if(e.key==='ArrowLeft'&&s.dir.x!==1) s.nextDir={x:-1,y:0}
      if(e.key==='ArrowRight'&&s.dir.x!==-1) s.nextDir={x:1,y:0}
      e.preventDefault()
    }
    window.addEventListener('keydown',onKey)

    let touchStart=null
    const onTS=e=>{touchStart={x:e.touches[0].clientX,y:e.touches[0].clientY}}
    const onTE=e=>{
      if(!touchStart) return
      const dx=e.changedTouches[0].clientX-touchStart.x,dy=e.changedTouches[0].clientY-touchStart.y
      if(!s.started){s.started=true;setStarted(true)}
      if(Math.abs(dx)>Math.abs(dy)){if(dx>20&&s.dir.x!==-1)s.nextDir={x:1,y:0};if(dx<-20&&s.dir.x!==1)s.nextDir={x:-1,y:0}}
      else{if(dy>20&&s.dir.y!==-1)s.nextDir={x:0,y:1};if(dy<-20&&s.dir.y!==1)s.nextDir={x:0,y:-1}}
    }
    canvas.addEventListener('touchstart',onTS); canvas.addEventListener('touchend',onTE)

    const drawCell=(x,y,col,r=3)=>{ctx.fillStyle=col;ctx.beginPath();ctx.roundRect(x*CELL+1,y*CELL+1,CELL-2,CELL-2,r);ctx.fill()}

    let raf
    const loop=()=>{
      if(!s.alive) return
      s.frame++

      // bg grid
      ctx.fillStyle='#0f172a';ctx.fillRect(0,0,W,H)
      for(let x=0;x<COLS;x++) for(let y=0;y<ROWS;y++){ctx.fillStyle=(x+y)%2===0?'rgba(30,58,138,0.22)':'rgba(23,37,84,0.22)';ctx.fillRect(x*CELL,y*CELL,CELL,CELL)}

      if(!s.started){
        ctx.fillStyle='rgba(0,0,0,0.5)';ctx.fillRect(0,0,W,H)
        ctx.fillStyle='#38bdf8';ctx.font='bold 18px system-ui';ctx.textAlign='center'
        ctx.fillText('🐍 Water Snake',W/2,H/2-28)
        ctx.fillStyle='rgba(255,255,255,0.65)';ctx.font='13px system-ui'
        ctx.fillText('Arrow keys / swipe to start',W/2,H/2+4)
        ctx.fillText('Eat 💧  avoid ☠️',W/2,H/2+26)
        ctx.textAlign='left';raf=requestAnimationFrame(loop);return
      }

      if(s.frame%s.tickRate===0){
        s.dir={...s.nextDir}
        const h=s.snake[0]
        const next={x:(h.x+s.dir.x+COLS)%COLS,y:(h.y+s.dir.y+ROWS)%ROWS}
        if(s.snake.some(seg=>seg.x===next.x&&seg.y===next.y)||s.poison.some(p=>p.x===next.x&&p.y===next.y)){
          s.alive=false;setDead(true);play('wrong');onComplete(s.score*10);return
        }
        s.snake.unshift(next)
        const fi=s.food.findIndex(f=>f.x===next.x&&f.y===next.y)
        if(fi!==-1){
          s.score++;setScore(s.score);play('correct')
          s.food.splice(fi,1);s.food.push(spawn())
          if(s.score%5===0) s.poison.push(spawn())
          if(s.score%4===0&&s.tickRate>5) s.tickRate--
          // level up every 4 foods
          const newLvl=Math.ceil(s.score/4)
          if(newLvl>s.level){
            s.level=newLvl;setLevel(newLvl)
            s.fact=FACTS[(s.factIdx++)%FACTS.length];s.factTimer=180
            setFact(s.fact);play('levelUp')
          }
        } else s.snake.pop()
      }

      if(s.factTimer>0) s.factTimer--

      // draw food
      s.food.forEach(f=>{ctx.font=`${CELL-2}px serif`;ctx.textAlign='center';ctx.fillText('💧',f.x*CELL+CELL/2,f.y*CELL+CELL-2)})
      s.poison.forEach(p=>{ctx.font=`${CELL-4}px serif`;ctx.textAlign='center';ctx.fillText('☠️',p.x*CELL+CELL/2,p.y*CELL+CELL-2)})
      ctx.textAlign='left'

      // draw snake
      s.snake.forEach((seg,i)=>{
        const r=Math.round(56+(14-56)*(i/s.snake.length)),g=Math.round(189+(165-189)*(i/s.snake.length)),b=Math.round(248+(233-248)*(i/s.snake.length))
        drawCell(seg.x,seg.y,`rgb(${r},${g},${b})`,i===0?5:3)
        if(i===0){ctx.fillStyle='#0c4a6e';ctx.beginPath();ctx.arc(seg.x*CELL+CELL*0.65,seg.y*CELL+CELL*0.35,2.5,0,Math.PI*2);ctx.fill();ctx.fillStyle='white';ctx.beginPath();ctx.arc(seg.x*CELL+CELL*0.65,seg.y*CELL+CELL*0.35,1,0,Math.PI*2);ctx.fill()}
      })

      // HUD
      ctx.fillStyle='rgba(0,0,0,0.5)';ctx.fillRect(4,4,140,26)
      ctx.fillStyle='#38bdf8';ctx.font='bold 12px system-ui';ctx.fillText(`💧 ${s.score}  Lv.${s.level}`,12,22)
      // Fact ticker
      if(s.factTimer>0&&s.fact){
        ctx.fillStyle='rgba(0,0,0,0.7)';ctx.fillRect(0,H-34,W,34)
        ctx.fillStyle='#38bdf8';ctx.font='10px system-ui';ctx.textAlign='center'
        ctx.fillText(s.fact.slice(0,60),W/2,H-13);ctx.textAlign='left'
      }

      raf=requestAnimationFrame(loop)
    }
    raf=requestAnimationFrame(loop)
    return()=>{cancelAnimationFrame(raf);window.removeEventListener('keydown',onKey);canvas.removeEventListener('touchstart',onTS);canvas.removeEventListener('touchend',onTE)}
  },[])

  const restart=()=>{
    const s=stateRef.current; if(!s) return
    const rand=n=>Math.floor(Math.random()*n)
    s.snake=[{x:10,y:10},{x:9,y:10},{x:8,y:10}];s.dir={x:1,y:0};s.nextDir={x:1,y:0}
    s.food=[{x:rand(20),y:rand(20)}];s.poison=[{x:rand(20),y:rand(20)}]
    s.score=0;s.alive=true;s.started=true;s.frame=0;s.tickRate=15;s.level=1;s.factTimer=0;s.fact=''
    setScore(0);setDead(false);setLevel(1);setFact('')
    const canvas=canvasRef.current; if(!canvas) return
    const ctx=canvas.getContext('2d')
    const W=400,H=400
    let raf
    const loop=()=>{
      if(!s.alive) return; s.frame++
      ctx.fillStyle='#0f172a';ctx.fillRect(0,0,W,H)
      if(s.frame%s.tickRate===0){
        s.dir={...s.nextDir};const h=s.snake[0]
        const next={x:(h.x+s.dir.x+20)%20,y:(h.y+s.dir.y+20)%20}
        if(s.snake.some(seg=>seg.x===next.x&&seg.y===next.y)||s.poison.some(p=>p.x===next.x&&p.y===next.y)){s.alive=false;setDead(true);return}
        s.snake.unshift(next)
        const fi=s.food.findIndex(f=>f.x===next.x&&f.y===next.y)
        if(fi!==-1){s.score++;setScore(s.score);s.food.splice(fi,1);s.food.push({x:rand(20),y:rand(20)});if(s.score%5===0)s.poison.push({x:rand(20),y:rand(20)});if(s.score%4===0&&s.tickRate>5)s.tickRate--;const nl=Math.ceil(s.score/4);if(nl>s.level){s.level=nl;setLevel(nl)}}
        else s.snake.pop()
      }
      for(let x=0;x<20;x++) for(let y=0;y<20;y++){ctx.fillStyle=(x+y)%2===0?'rgba(30,58,138,0.22)':'rgba(23,37,84,0.22)';ctx.fillRect(x*20,y*20,20,20)}
      s.food.forEach(f=>{ctx.font='18px serif';ctx.textAlign='center';ctx.fillText('💧',f.x*20+10,f.y*20+18)})
      s.poison.forEach(p=>{ctx.font='16px serif';ctx.textAlign='center';ctx.fillText('☠️',p.x*20+10,p.y*20+18)})
      ctx.textAlign='left'
      s.snake.forEach((seg,i)=>{const r=Math.round(56+(14-56)*(i/s.snake.length)),g=Math.round(189+(165-189)*(i/s.snake.length)),b=Math.round(248+(233-248)*(i/s.snake.length));ctx.fillStyle=`rgb(${r},${g},${b})`;ctx.beginPath();ctx.roundRect(seg.x*20+1,seg.y*20+1,18,18,i===0?5:3);ctx.fill()})
      ctx.fillStyle='rgba(0,0,0,0.5)';ctx.fillRect(4,4,140,26);ctx.fillStyle='#38bdf8';ctx.font='bold 12px system-ui';ctx.fillText(`💧 ${s.score}  Lv.${s.level}`,12,22)
      raf=requestAnimationFrame(loop)
    }
    raf=requestAnimationFrame(loop)
  }

  return(
    <div className="flex flex-col items-center gap-3">
      <div className="flex items-center gap-4 text-sm font-bold">
        <span style={{color:'var(--text-muted)'}}>Score: <span style={{color:'#38bdf8'}}>{score}</span></span>
        <span style={{color:'#fbbf24'}}>Level {level}</span>
        {started&&<span style={{color:'var(--text-muted)',fontSize:11}}>Arrow keys / swipe</span>}
      </div>
      <canvas ref={canvasRef} style={{borderRadius:12,border:'2px solid rgba(56,189,248,0.3)',touchAction:'none'}}/>
      {fact&&!dead&&<div style={{maxWidth:360,textAlign:'center',padding:'8px 12px',borderRadius:10,fontSize:12,background:'rgba(56,189,248,0.08)',color:'#38bdf8',border:'1px solid rgba(56,189,248,0.2)'}}>{fact}</div>}
      {dead&&<div className="text-center"><p className="font-bold mb-2" style={{color:'var(--text)'}}>Game Over! Score: {score} — Level {level}</p><button onClick={restart} className="btn-primary px-6 py-2">🔄 Play Again</button></div>}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════
   GAME 6 — FLAPPY FISH (with levels)
═══════════════════════════════════════════════════════════ */
function FlappyFish({ onComplete }) {
  const { play } = useSound()
  const [score, setScore] = useState(0)
  const [level, setLevel] = useState(1)
  const [status, setStatus] = useState('ready')
  const [fact, setFact] = useState('')
  const [tick, setTick] = useState(0)

  const stateRef = useRef(null)
  const doneRef = useRef(false)
  const factIdxRef = useRef(0)

  const resetGame = useCallback(() => {
    stateRef.current = {
      y: 0,
      vy: 0,
      score: 0,
      level: 1,
      speed: 0.14,
      gap: 3.6,
      gates: [],
      spawnCd: 95,
      started: false,
      frame: 0,
    }
    doneRef.current = false
    setScore(0)
    setLevel(1)
    setFact('')
    setStatus('ready')
  }, [])

  useEffect(() => { resetGame() }, [resetGame])

  useEffect(() => {
    const jump = () => {
      const s = stateRef.current
      if (!s) return
      if (status === 'gameover') {
        resetGame()
        return
      }
      if (status === 'ready') setStatus('playing')
      s.started = true
      s.vy = 0.28
      play('drop')
    }
    const onKey = (e) => {
      if (e.code === 'Space' || e.code === 'ArrowUp') {
        e.preventDefault()
        jump()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [status, play, resetGame])

  useEffect(() => {
    if (status !== 'playing') return
    const iv = setInterval(() => {
      const s = stateRef.current
      if (!s) return

      s.frame += 1
      s.vy -= 0.022
      s.y += s.vy
      s.y = THREE.MathUtils.clamp(s.y, -4.6, 4.6)

      s.spawnCd -= 1
      if (s.spawnCd <= 0) {
        s.gates.push({ id:`g_${Date.now()}_${Math.random()}`, x: 12, gapY: (Math.random() * 5.2) - 2.6, scored:false })
        s.spawnCd = Math.max(62, 94 - s.level * 4)
      }

      s.gates = s.gates.filter(g => g.x > -9)
      s.gates.forEach(g => {
        g.x -= s.speed
        if (!g.scored && g.x < -2.3) {
          g.scored = true
          s.score += 1
          setScore(s.score)
          play('correct')

          const nextLevel = Math.floor(s.score / 8) + 1
          if (nextLevel > s.level) {
            s.level = nextLevel
            s.speed = Math.min(0.32, 0.14 + (nextLevel - 1) * 0.018)
            s.gap = Math.max(2.6, 3.6 - (nextLevel - 1) * 0.11)
            setLevel(nextLevel)
            setFact(FACTS[(factIdxRef.current++) % FACTS.length])
            play('levelUp')
          }
        }

        const nearX = Math.abs(g.x + 2.0) < 0.8
        const inGap = s.y > (g.gapY - s.gap / 2) && s.y < (g.gapY + s.gap / 2)
        if (nearX && !inGap) {
          setStatus('gameover')
          if (!doneRef.current) {
            doneRef.current = true
            onComplete(s.score * 6)
          }
        }
      })

      if (Math.abs(s.y) > 4.5) {
        setStatus('gameover')
        if (!doneRef.current) {
          doneRef.current = true
          onComplete(s.score * 6)
        }
      }

      setTick(t => t + 1)
    }, 16)
    return () => clearInterval(iv)
  }, [status, onComplete, play])

  const s = stateRef.current || { y:0, gates:[] }

  return(
    <div className="flex flex-col items-center gap-3">
      <div className="w-full" style={{ height: 500, borderRadius:16, overflow:'hidden', border:'2px solid rgba(99,102,241,0.3)' }} onClick={() => {
        if (status === 'gameover') resetGame()
        else {
          const st = stateRef.current
          if (!st) return
          if (status === 'ready') setStatus('playing')
          st.started = true
          st.vy = 0.28
          play('drop')
        }
      }}>
        <Canvas camera={{ position:[0, 0, 12], fov:58 }}>
          <color attach="background" args={['#031525']} />
          <fog attach="fog" args={['#031525', 12, 25]} />
          <ambientLight intensity={0.55} />
          <directionalLight position={[2, 4, 5]} intensity={1.4} color="#93c5fd" />
          <pointLight position={[-6, -1, 3]} intensity={1} color="#22d3ee" />
          <Stars radius={80} depth={40} count={1000} factor={2.2} fade speed={1.2} />

          <mesh position={[-2, s.y, 0]} rotation={[0.2, 0, Math.max(-0.45, Math.min(0.45, s.vy * 1.7))]}>
            <sphereGeometry args={[0.42, 24, 24]} />
            <meshStandardMaterial color="#38bdf8" emissive="#0ea5e9" emissiveIntensity={0.6} metalness={0.2} roughness={0.3} />
          </mesh>
          <mesh position={[-2.45, s.y, 0]}>
            <coneGeometry args={[0.2, 0.45, 10]} />
            <meshStandardMaterial color="#bae6fd" emissive="#67e8f9" emissiveIntensity={0.7} />
          </mesh>

          {s.gates.map((g) => {
            const topH = 8 - (g.gapY + s.gap / 2)
            const botH = 8 + (g.gapY - s.gap / 2)
            return (
              <group key={g.id} position={[g.x, 0, 0]}>
                <mesh position={[0, g.gapY + s.gap / 2 + topH / 2, 0]}>
                  <boxGeometry args={[1.1, Math.max(0.1, topH), 1.1]} />
                  <meshStandardMaterial color="#10b981" emissive="#065f46" emissiveIntensity={0.4} metalness={0.2} roughness={0.35} />
                </mesh>
                <mesh position={[0, -8 + botH / 2, 0]}>
                  <boxGeometry args={[1.1, Math.max(0.1, botH), 1.1]} />
                  <meshStandardMaterial color="#10b981" emissive="#065f46" emissiveIntensity={0.4} metalness={0.2} roughness={0.35} />
                </mesh>
              </group>
            )
          })}

          <mesh position={[0, -8.1, -2]} rotation={[-Math.PI/2,0,0]}>
            <planeGeometry args={[30, 18]} />
            <meshStandardMaterial color="#082f49" roughness={1} />
          </mesh>
        </Canvas>
      </div>

      <div className="flex gap-4 text-sm font-bold">
        <span style={{color:'var(--text-muted)'}}>Score: <span style={{color:'#6366f1'}}>{score}</span></span>
        <span style={{color:'#fbbf24'}}>Level {level}</span>
        <span style={{color:'var(--text-muted)'}}>Mode: 3D</span>
      </div>

      {fact && status === 'playing' && <div className="text-xs text-center" style={{color:'#38bdf8'}}>{fact}</div>}
      {status === 'ready' && <div className="text-sm" style={{color:'var(--text-muted)'}}>Click canvas or press SPACE to boost upward</div>}
      {status === 'gameover' && <button onClick={resetGame} className="btn-primary px-6 py-2">🔄 Play Again</button>}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════
   HUB
═══════════════════════════════════════════════════════════ */
const GAMES=[
  {id:'blaster',title:'Pollution Blaster',emoji:'🎯',desc:'3D arcade space shooter — destroy pollution drones, survive enemy fire, and clear escalating waves.',points:'Unlimited',badge:'🛰️ 3D',component:PollutionBlaster},
  {id:'rush',   title:'Water Rush',       emoji:'💧',desc:'Geometry Dash runner — jump over pollution spikes, collect gems, survive 8 speed levels!',points:'Unlimited',badge:'⚡ FAST',component:WaterRush},
  {id:'panic',  title:'pH Panic',         emoji:'⚗️', desc:'React fast — sort falling pH values into ACID, SAFE, or BASE before time runs out!',points:'Combo pts',badge:'🧪 LEARN',component:PHPanic},
  {id:'trivia', title:'Trivia Blitz',     emoji:'🎓',desc:'4 levels of water science — streaks multiply your score. Beat Grade S!',points:'Streak pts',badge:'🏆 XP',component:TriviaBlitz},
  {id:'snake',  title:'Water Snake',      emoji:'🐍',desc:'Classic snake — eat 💧 avoid ☠️ — speeds up each level. Water facts on every level-up!',points:'Unlimited',component:WaterSnake},
  {id:'flappy', title:'Flappy Fish',      emoji:'🐟',desc:'3D reef runner — boost through moving gate tunnels as speed ramps and gaps tighten by level.',points:'Score × 6',badge:'🌌 3D',component:FlappyFish},
]

export default function Games() {
  const { play }=useSound()
  const [active,setActive]=useState(null)
  const [bests,setBests]=useState(()=>{try{return JSON.parse(localStorage.getItem('sw_game_bests')||'{}')}catch{return{}}})
  const [history,setHistory]=useState(()=>{try{return JSON.parse(localStorage.getItem('sw_game_history')||'[]')}catch{return[]}})
  const [stats,setStats]=useState(false)

  const finish=async(id,score)=>{
    play('levelUp')
    const nb={...bests,[id]:Math.max(bests[id]||0,score)};setBests(nb)
    localStorage.setItem('sw_game_bests',JSON.stringify(nb))
    const nh=[{gameId:id,score,date:new Date().toISOString()},...history].slice(0,50);setHistory(nh)
    localStorage.setItem('sw_game_history',JSON.stringify(nh))
    await api.post('/leaderboard/game-score',{game_type:id,score}).catch(()=>{})
    setActive(null)
  }

  const totalPts=history.reduce((s,h)=>s+h.score,0)
  const topGame=Object.entries(bests).sort((a,b)=>b[1]-a[1])[0]

  if(active){
    const game=GAMES.find(g=>g.id===active),GC=game.component
    return(
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center gap-3 mb-5">
          <button onClick={()=>setActive(null)} className="p-2 rounded-xl" style={{background:'var(--card-bg)',border:'1px solid var(--border)'}}><ArrowLeft className="w-5 h-5" style={{color:'var(--text-muted)'}}/></button>
          <span className="text-2xl">{game.emoji}</span>
          <h2 className="font-bold text-xl" style={{color:'var(--text)'}}>{game.title}</h2>
          {bests[active]!==undefined&&<span className="ml-auto text-sm font-bold" style={{color:'#10b981'}}>🏅 Best: {bests[active]}</span>}
        </div>
        <GC onComplete={s=>finish(active,s)}/>
      </div>
    )
  }

  return(
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div style={{ width: 84, height: 112, flexShrink: 0 }}>
            <NibiMascotImage mood="spinning" size={84}/>
          </div>
          <div>
            <h1 className="font-bold text-xl" style={{color:'var(--text)'}}>Water Learning Games</h1>
            <p className="text-sm mt-0.5" style={{color:'var(--text-muted)'}}>6 arcade games · real water science · earn XP · beat your records</p>
            <p className="text-xs mt-2 max-w-xl" style={{color:'var(--text-muted)', fontStyle:'italic'}}>
              Games are not yet fully developed — we'd love to hear your feedback and any ideas to make them educational! For now, feel free to enjoy them just for fun.
            </p>
          </div>
        </div>
        <button onClick={()=>setStats(s=>!s)} className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold transition-all"
          style={{background:stats?'#6366f1':'var(--card-bg)',color:stats?'white':'var(--text-muted)',border:'1px solid var(--border)'}}>
          <Trophy className="w-4 h-4"/> My Stats
        </button>
      </div>

      {stats&&(
        <div className="card p-5">
          <h3 className="font-bold mb-4" style={{color:'var(--text)'}}>My Stats</h3>
          <div className="grid grid-cols-3 gap-4 mb-4">
            {[['Games Played',history.length,'🎮'],['Total Points',totalPts,'⭐'],['Best Game',topGame?`${GAMES.find(g=>g.id===topGame[0])?.emoji} ${topGame[1]}`:'—','🏆']].map(([l,v,i])=>(
              <div key={l} className="rounded-xl p-3 text-center" style={{background:'var(--page-bg)',border:'1px solid var(--border)'}}>
                <div style={{fontSize:22,marginBottom:4}}>{i}</div>
                <div className="font-black text-lg" style={{color:'var(--text)'}}>{v}</div>
                <div className="text-xs" style={{color:'var(--text-muted)'}}>{l}</div>
              </div>
            ))}
          </div>
          <div className="space-y-1.5">
            {GAMES.map(g=>(
              <div key={g.id} className="flex items-center justify-between py-2 px-3 rounded-xl" style={{background:'var(--page-bg)'}}>
                <span className="text-sm font-medium" style={{color:'var(--text)'}}>{g.emoji} {g.title}</span>
                <span className="text-sm font-bold" style={{color:bests[g.id]?'#10b981':'var(--text-muted)'}}>{bests[g.id]!==undefined?`Best: ${bests[g.id]}`:'Not played'}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {GAMES.map(game=>(
          <div key={game.id} className="card p-5 cursor-pointer group" onClick={()=>{play('click');setActive(game.id)}}
            style={{transition:'all 0.18s'}}
            onMouseEnter={e=>{e.currentTarget.style.transform='translateY(-3px)';e.currentTarget.style.boxShadow='0 8px 28px rgba(0,0,0,0.18)'}}
            onMouseLeave={e=>{e.currentTarget.style.transform='';e.currentTarget.style.boxShadow=''}}>
            <div className="flex items-start justify-between mb-3">
              <div className="text-4xl group-hover:scale-110 transition-transform duration-200">{game.emoji}</div>
              {game.badge&&<span className="badge" style={{background:'rgba(99,102,241,0.1)',color:'#6366f1',border:'1px solid rgba(99,102,241,0.2)',fontSize:10,fontWeight:700,padding:'2px 7px',borderRadius:20}}>{game.badge}</span>}
            </div>
            <h3 className="font-bold text-base mb-1.5" style={{color:'var(--text)'}}>{game.title}</h3>
            <p className="text-xs mb-4 leading-relaxed" style={{color:'var(--text-muted)'}}>{game.desc}</p>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold px-2 py-1 rounded-lg" style={{background:'rgba(20,184,166,0.1)',color:'#14b8a6'}}>{game.points}</span>
              {bests[game.id]!==undefined?(
                <span className="text-xs font-bold" style={{color:'#10b981'}}>🏅 {bests[game.id]}</span>
              ):(
                <span className="text-xs" style={{color:'var(--text-muted)'}}>Not played</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
