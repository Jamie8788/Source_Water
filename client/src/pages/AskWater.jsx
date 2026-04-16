/**
 * AskWater — Nibi AI Voice Chat
 * TTS  : backend /api/ai/tts → ElevenLabs Charlie (kid) OR StreamElements Ivy
 *        → browser TTS fallback (pitched up for kid sound)
 * STT  : Web Speech API — getUserMedia NOT called (no conflict), SpeechRec gets
 *        exclusive mic access so detection actually works
 * AI   : /api/ai/public-chat (Groq / Pollinations, free)
 * Idle : Nibi talks to you after ~10 s of silence with natural phrases
 */
import { useState, useRef, useEffect, useCallback, Suspense } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Mic, MicOff, Send, Trash2, Volume2, VolumeX, Sparkles, Droplets } from 'lucide-react'
import NibiMascot3D from '../components/NibiMascot3D'
import api from '../utils/api'

// ── Content ───────────────────────────────────────────────────────────────────
const SUGGESTIONS = [
  '💧 Safe pH for drinking water?',
  '🌊 Tell me about Lake Superior',
  '🦠 How do algae blooms form?',
  '🧪 How to test water quality?',
  '🌡️ Temperature and dissolved oxygen?',
  '🏭 Mining and water pollution',
  '🌿 Protecting local watersheds',
  '🐟 How do fish react to water quality?',
]

const GREETING = "Hey! I am Nibi! I know everything about water! Ask me anything, or tap the mic and just talk to me!"

// Clean spoken phrases — no punctuation that TTS spells out
const IDLE_NUDGES = [
  "Oh hey! Did you know water covers 71 percent of Earth?",
  "Hey there! Tap the mic and ask me something! I love water questions!",
  "Wow it is so quiet! Did you know sound travels 4 times faster through water than air?",
  "Hey! Did you know Lake Superior holds 10 percent of all Earth's fresh surface water?",
  "Ooh I have a fact for you! The human body is about 60 percent water. We are basically cousins!",
  "Hey hey! Did you know water is the only thing on Earth that naturally exists as solid, liquid, and gas?",
  "Hmm, I am thinking about algae blooms. Want to know what causes them?",
  "Oh! Did you know some water molecules in your glass might be millions of years old? Wild!",
]

const MOOD_MAP = { idle: 'idle', listening: 'wave', thinking: 'thinking', speaking: 'happy', error: 'blush' }

// ── Particle background ────────────────────────────────────────────────────────
function ParticleBG() {
  const ref = useRef(null)
  useEffect(() => {
    const canvas = ref.current; if (!canvas) return
    const resize = () => { canvas.width = canvas.offsetWidth; canvas.height = canvas.offsetHeight }
    resize(); window.addEventListener('resize', resize)
    const ctx = canvas.getContext('2d')
    const COLS = ['#6366f1','#8b5cf6','#06b6d4','#14b8a6','#3b82f6','#a78bfa']
    const pts = Array.from({length:80},()=>({ x:Math.random()*canvas.width,y:Math.random()*canvas.height,r:Math.random()*2.2+.4,vy:Math.random()*.35+.08,vx:(Math.random()-.5)*.18,op:Math.random()*.45+.08,col:COLS[~~(Math.random()*COLS.length)],t:Math.random()*Math.PI*2 }))
    let raf
    const draw = () => {
      ctx.clearRect(0,0,canvas.width,canvas.height)
      for(const p of pts){ p.t+=.02; ctx.beginPath(); ctx.arc(p.x,p.y,p.r,0,Math.PI*2); ctx.fillStyle=p.col; ctx.globalAlpha=p.op*(.7+.3*Math.sin(p.t)); ctx.fill(); p.y-=p.vy; p.x+=p.vx; if(p.y<-8){p.y=canvas.height+8;p.x=Math.random()*canvas.width} if(p.x<0)p.x=canvas.width; if(p.x>canvas.width)p.x=0 }
      ctx.globalAlpha=1; raf=requestAnimationFrame(draw)
    }
    draw()
    return ()=>{ cancelAnimationFrame(raf); window.removeEventListener('resize',resize) }
  },[])
  return <canvas ref={ref} style={{position:'absolute',inset:0,width:'100%',height:'100%',pointerEvents:'none',zIndex:0}}/>
}

// ── Animated waveform (fake — no getUserMedia, so mic works properly) ─────────
function Waveform({ status }) {
  const [bars, setBars] = useState(new Array(28).fill(3))
  useEffect(() => {
    if (status !== 'listening' && status !== 'speaking') { setBars(new Array(28).fill(3)); return }
    let t = 0
    const iv = setInterval(() => {
      t += 0.25
      setBars(Array.from({length:28}, (_,i) => {
        if (status === 'listening') return Math.random() * 48 + 4
        return Math.abs(Math.sin(t + i * 0.35)) * 40 + 6
      }))
    }, 65)
    return () => clearInterval(iv)
  }, [status])

  const c1 = status==='listening'?'#60a5fa':status==='speaking'?'#34d399':'#a78bfa'
  const c2 = status==='listening'?'#818cf8':status==='speaking'?'#6ee7b7':'#c4b5fd'
  return (
    <div style={{display:'flex',alignItems:'center',gap:2.5,height:52,padding:'0 8px'}}>
      {bars.map((h,i)=>(
        <motion.div key={i} animate={{height:Math.max(3,h)}} transition={{duration:.08}}
          style={{width:3.5,borderRadius:2,background:`linear-gradient(to top,${c1},${c2})`,opacity:status==='idle'?.15:.82,minHeight:3,boxShadow:status!=='idle'?`0 0 5px ${c1}55`:'none'}}/>
      ))}
    </div>
  )
}

// ── Chat bubble ────────────────────────────────────────────────────────────────
function Bubble({ msg }) {
  const isUser = msg.role === 'user'
  return (
    <motion.div initial={{opacity:0,y:14,scale:.96}} animate={{opacity:1,y:0,scale:1}} transition={{duration:.28,ease:[.34,1.2,.64,1]}}
      style={{display:'flex',gap:10,flexDirection:isUser?'row-reverse':'row',alignItems:'flex-end'}}>
      {!isUser&&<div style={{width:32,height:32,borderRadius:'50%',flexShrink:0,background:'linear-gradient(135deg,#6366f1,#14b8a6)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:15,boxShadow:'0 0 12px rgba(99,102,241,.4)'}}>💧</div>}
      <div style={{maxWidth:'82%',padding:'11px 15px',borderRadius:isUser?'18px 18px 4px 18px':'18px 18px 18px 4px',background:isUser?'linear-gradient(135deg,#6366f1,#4338ca)':'rgba(255,255,255,.055)',border:isUser?'none':'1px solid rgba(255,255,255,.09)',backdropFilter:'blur(12px)',color:'rgba(255,255,255,.93)',fontSize:13.5,lineHeight:1.68,boxShadow:isUser?'0 4px 20px rgba(99,102,241,.35)':'0 2px 12px rgba(0,0,0,.25)'}}>
        {msg.content}
        {msg.model&&<div style={{fontSize:10,marginTop:5,opacity:.28}}>via {msg.model.split('/').pop()}</div>}
      </div>
    </motion.div>
  )
}

// ── Main ───────────────────────────────────────────────────────────────────────
export default function AskWater() {
  const [messages, setMessages] = useState([{role:'assistant',content:GREETING}])
  const [input,    setInput]    = useState('')
  const [status,   setStatus]   = useState('idle')
  const [voiceOn,  setVoiceOn]  = useState(true)
  const [interim,  setInterim]  = useState('')
  const [micErr,   setMicErr]   = useState('')

  const recRef       = useRef(null)
  const isListRef    = useRef(false)
  const currentAudio = useRef(null)
  const audioUrl     = useRef(null)
  const abortCtrl    = useRef(null)
  const bottomRef    = useRef(null)
  const voiceRef     = useRef(voiceOn)
  useEffect(()=>{ voiceRef.current=voiceOn },[voiceOn])

  const mood = MOOD_MAP[status] ?? 'idle'

  useEffect(()=>{ bottomRef.current?.scrollIntoView({behavior:'smooth'}) },[messages,status])

  // ── Stop current audio ──────────────────────────────────────────────────────
  const stopAudio = useCallback(()=>{
    abortCtrl.current?.abort()
    abortCtrl.current = null
    if(currentAudio.current){ currentAudio.current.pause(); currentAudio.current.src=''; currentAudio.current=null }
    if(audioUrl.current){ URL.revokeObjectURL(audioUrl.current); audioUrl.current=null }
    window.speechSynthesis?.cancel()
  },[])

  // ── TTS via backend → kid voice ────────────────────────────────────────────
  const speakText = useCallback(async(text)=>{
    if(!voiceRef.current) return
    stopAudio()
    const ctrl = new AbortController()
    abortCtrl.current = ctrl
    setStatus('speaking')

    // Clean text for TTS (remove emojis, markdown)
    const clean = text.replace(/[\u{1F300}-\u{1FAFF}]/gu,'').replace(/[*_`#[\]]/g,'').replace(/https?:\/\/\S+/g,'').trim()

    try {
      const resp = await api.post('/ai/tts', {text:clean}, {responseType:'blob', signal:ctrl.signal})
      if(ctrl.signal.aborted) return
      const url = URL.createObjectURL(resp.data)
      audioUrl.current = url
      const audio = new Audio(url)
      currentAudio.current = audio
      await new Promise((resolve,reject)=>{
        audio.onended = ()=>{ URL.revokeObjectURL(url); audioUrl.current=null; resolve() }
        audio.onerror = reject
        ctrl.signal.addEventListener('abort',()=>{ audio.pause(); audio.src=''; URL.revokeObjectURL(url); reject(new DOMException('abort','AbortError')) })
        audio.play().catch(reject)
      })
    } catch(e) {
      if(e.name==='AbortError'||e.name==='abort') return
      // Browser TTS fallback — pitch up for kid sound
      try {
        await new Promise(resolve=>{
          const u = new SpeechSynthesisUtterance(clean.slice(0,350))
          u.pitch=1.75; u.rate=1.08; u.volume=.95
          const voices=window.speechSynthesis.getVoices()
          const v=voices.find(v=>/samantha|karen|victoria|allison/i.test(v.name))||voices.find(v=>v.lang?.startsWith('en'))
          if(v) u.voice=v
          u.onend=resolve; u.onerror=resolve
          window.speechSynthesis.speak(u)
        })
      } catch{}
    }
    if(!ctrl.signal.aborted) setStatus('idle')
  },[stopAudio])

  // ── Greeting on mount ───────────────────────────────────────────────────────
  useEffect(()=>{
    const t=setTimeout(()=>speakText(GREETING),1200)
    return ()=>clearTimeout(t)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[])

  // ── Idle nudge — Nibi talks after ~10 s of silence ─────────────────────────
  useEffect(()=>{
    if(status!=='idle') return
    const delay = 10000+Math.random()*6000
    const timer = setTimeout(()=>{
      const phrase = IDLE_NUDGES[~~(Math.random()*IDLE_NUDGES.length)]
      setMessages(prev=>{
        if(prev[prev.length-1]?.idle) return prev
        return [...prev,{role:'assistant',content:phrase,idle:true}]
      })
      speakText(phrase)
    }, delay)
    return ()=>clearTimeout(timer)
  },[status,speakText])

  // ── Send to AI ──────────────────────────────────────────────────────────────
  const sendMessage = useCallback(async(text)=>{
    const msg=text?.trim()
    if(!msg||status==='thinking') return
    setInput(''); setInterim('')
    stopAudio()
    const hist=[...messages,{role:'user',content:msg}]
    setMessages(hist)
    setStatus('thinking')
    try {
      const {data}=await api.post('/ai/public-chat',{
        messages:[
          {role:'system',content:'You are Nibi, a cheerful water-drop character who is a water quality expert for SOURCE Water, Northern Ontario. Answer in 2 to 4 friendly sentences. Do not use markdown or asterisks. Occasionally use water emojis. Be warm and encourage curiosity. Speak simply and clearly.'},
          ...hist.slice(-10).map(m=>({role:m.role,content:m.content})),
        ]
      })
      const reply=data.reply?.trim()||"Hmm, I had a brain bubble! Try again?"
      setMessages(p=>[...p,{role:'assistant',content:reply,model:data.model}])
      if (voiceRef.current) {
        speakText(reply)
      } else {
        setStatus('idle')
      }
    } catch {
      const err="Oops! My water pipes got clogged. Please try again!"
      setMessages(p=>[...p,{role:'assistant',content:err}])
      setStatus('error')
      setTimeout(()=>setStatus('idle'),2000)
    }
  },[messages,speakText,status,stopAudio])

  // ── Voice input (no getUserMedia — give mic 100% to SpeechRecognition) ──────
  const startListening = useCallback(()=>{
    if(isListRef.current) return
    stopAudio()
    setMicErr('')

    const SR=window.SpeechRecognition||window.webkitSpeechRecognition
    if(!SR){
      setMicErr('Voice input needs Chrome or Edge browser.')
      setStatus('error')
      setTimeout(()=>{setStatus('idle');setMicErr('')},4000)
      return
    }

    const rec=new SR()
    rec.lang='en-CA'
    rec.continuous=false
    rec.interimResults=true
    rec.maxAlternatives=1

    rec.onstart=()=>{ setStatus('listening') }

    rec.onresult=(e)=>{
      let final='',inter=[]
      for(const r of e.results){
        if(r.isFinal) final+=r[0].transcript
        else inter.push(r[0].transcript)
      }
      setInterim(inter.join(' '))
      if(final){ stopListeningClean(); sendMessage(final) }
    }

    rec.onerror=(e)=>{
      console.warn('SpeechRec error:',e.error)
      if(e.error==='not-allowed'||e.error==='service-not-allowed'){
        setMicErr('Microphone blocked. Allow mic in your browser address bar.')
        setTimeout(()=>{setStatus('idle');setMicErr('')},5000)
      } else if(e.error==='no-speech'){
        setMicErr("I didn't hear anything. Try speaking louder!")
        setTimeout(()=>{setStatus('idle');setMicErr('')},3000)
      }
      stopListeningClean()
    }

    rec.onend=()=>{ if(isListRef.current) stopListeningClean() }

    recRef.current=rec
    isListRef.current=true
    try{ rec.start() }catch(e){ console.warn('rec.start failed:',e); stopListeningClean() }
  },[sendMessage,stopAudio])

  const stopListeningClean=useCallback(()=>{
    isListRef.current=false
    recRef.current?.stop()
    setInterim('')
    setStatus(s=>s==='listening'?'idle':s)
  },[])

  const toggleListen=()=>{ status==='listening'?stopListeningClean():startListening() }
  const toggleVoice=()=>setVoiceOn(v=>{ if(v) stopAudio(); return !v })
  const clearChat=()=>{
    stopAudio(); stopListeningClean()
    setMessages([{role:'assistant',content:GREETING}])
    setStatus('idle')
    if(voiceRef.current) setTimeout(()=>speakText(GREETING),300)
  }

  useEffect(()=>()=>{ stopAudio(); recRef.current?.abort() },[stopAudio])

  const statusLabel={idle:'Tap the mic and talk to me!',listening:interim||'Listening… speak now!',thinking:'Thinking…',speaking:'Speaking…',error:micErr||'Something went wrong.'}[status]??''
  const statusColor={idle:'rgba(255,255,255,.32)',listening:'#60a5fa',thinking:'#a78bfa',speaking:'#34d399',error:'#f87171'}[status]
  const glowColor={idle:'rgba(99,102,241,.09)',listening:'rgba(96,165,250,.18)',thinking:'rgba(167,139,250,.18)',speaking:'rgba(52,211,153,.16)',error:'rgba(248,113,113,.14)'}[status]

  return (
    <div style={{minHeight:'calc(100vh - 130px)',background:'linear-gradient(145deg,#08021e 0%,#04091a 45%,#020c18 100%)',borderRadius:20,position:'relative',overflow:'hidden',display:'flex'}}>
      <ParticleBG/>
      <div style={{position:'absolute',inset:0,zIndex:1,pointerEvents:'none',background:'repeating-linear-gradient(0deg,transparent,transparent 3px,rgba(0,0,0,.04) 3px,rgba(0,0,0,.04) 4px)'}}/>

      {/* ── LEFT: Nibi ── */}
      <div style={{width:'38%',minWidth:260,maxWidth:400,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'28px 20px 24px',position:'relative',zIndex:2,borderRight:'1px solid rgba(99,102,241,.12)'}}>
        <motion.div animate={{opacity:[.7,1,.7],scale:[1,1.06,1]}} transition={{duration:3,repeat:Infinity}}
          style={{position:'absolute',width:380,height:380,borderRadius:'50%',background:`radial-gradient(circle,${glowColor} 0%,transparent 70%)`,pointerEvents:'none',transition:'background .6s'}}/>

        <div style={{position:'relative',zIndex:2}}>
          <Suspense fallback={<div style={{width:320,height:430,display:'flex',alignItems:'center',justifyContent:'center',color:'#6366f1',fontSize:13}}>Loading Nibi…</div>}>
            <NibiMascot3D mood={mood} size={320} orbitControls={false} modelPath="/models/blue droplet character 3d model.glb"/>
          </Suspense>
        </div>

        <AnimatePresence mode="wait">
          <motion.p key={statusLabel} initial={{opacity:0,y:6}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-6}} transition={{duration:.2}}
            style={{color:statusColor,fontSize:12.5,fontWeight:600,textAlign:'center',margin:'-8px 0 10px',minHeight:18,maxWidth:220,letterSpacing:'.02em',lineHeight:1.4}}>
            {statusLabel}
          </motion.p>
        </AnimatePresence>

        <AnimatePresence>
          {micErr&&(
            <motion.div initial={{opacity:0,y:4}} animate={{opacity:1,y:0}} exit={{opacity:0}}
              style={{background:'rgba(239,68,68,.12)',border:'1px solid rgba(239,68,68,.3)',borderRadius:10,padding:'8px 12px',fontSize:11,color:'#fca5a5',textAlign:'center',marginBottom:8,maxWidth:220,lineHeight:1.5}}>
              {micErr}
            </motion.div>
          )}
        </AnimatePresence>

        <Waveform status={status}/>

        {/* Mic button */}
        <div style={{position:'relative',marginTop:8}}>
          {status==='listening'&&[0,1,2].map(i=>(
            <motion.div key={i} initial={{scale:1,opacity:.6}} animate={{scale:2.4,opacity:0}} transition={{duration:1.6,repeat:Infinity,delay:i*.45,ease:'easeOut'}}
              style={{position:'absolute',inset:0,borderRadius:'50%',border:'2px solid rgba(96,165,250,.6)',pointerEvents:'none'}}/>
          ))}
          {status==='speaking'&&[0,1].map(i=>(
            <motion.div key={i} initial={{scale:1,opacity:.5}} animate={{scale:2,opacity:0}} transition={{duration:1.4,repeat:Infinity,delay:i*.5,ease:'easeOut'}}
              style={{position:'absolute',inset:0,borderRadius:'50%',border:'2px solid rgba(52,211,153,.5)',pointerEvents:'none'}}/>
          ))}
          <motion.button onClick={toggleListen}
            disabled={status==='thinking'||status==='speaking'}
            whileHover={!(status==='thinking'||status==='speaking')?{scale:1.09}:{}}
            whileTap={!(status==='thinking'||status==='speaking')?{scale:.91}:{}}
            style={{width:80,height:80,borderRadius:'50%',border:'none',cursor:status==='thinking'||status==='speaking'?'not-allowed':'pointer',
              background:status==='listening'?'linear-gradient(135deg,#ef4444,#dc2626)':status==='thinking'?'linear-gradient(135deg,#7c3aed,#6d28d9)':status==='speaking'?'linear-gradient(135deg,#059669,#047857)':'linear-gradient(135deg,#6366f1,#4338ca)',
              boxShadow:status==='listening'?'0 0 0 6px rgba(239,68,68,.15),0 8px 40px rgba(239,68,68,.5)':status==='speaking'?'0 0 0 6px rgba(52,211,153,.15),0 8px 40px rgba(52,211,153,.4)':'0 0 0 6px rgba(99,102,241,.15),0 8px 40px rgba(99,102,241,.5)',
              display:'flex',alignItems:'center',justifyContent:'center',transition:'background .3s,box-shadow .3s'}}>
            {status==='listening'?<MicOff size={30} color="white"/>:status==='thinking'?<motion.div animate={{rotate:360}} transition={{duration:1.2,repeat:Infinity,ease:'linear'}}><Droplets size={28} color="white"/></motion.div>:status==='speaking'?<Volume2 size={28} color="white"/>:<Mic size={30} color="white"/>}
          </motion.button>
        </div>

        <div style={{display:'flex',gap:8,marginTop:20}}>
          <button onClick={toggleVoice} style={{background:voiceOn?'rgba(99,102,241,.12)':'rgba(255,255,255,.04)',border:`1px solid ${voiceOn?'rgba(99,102,241,.35)':'rgba(255,255,255,.09)'}`,borderRadius:10,padding:'7px 13px',cursor:'pointer',color:voiceOn?'#c4b5fd':'rgba(255,255,255,.3)',fontSize:12,fontWeight:600,display:'flex',alignItems:'center',gap:6,transition:'all .2s'}}>
            {voiceOn?<Volume2 size={13}/>:<VolumeX size={13}/>}{voiceOn?'Voice On':'Voice Off'}
          </button>
          <button onClick={clearChat} style={{background:'rgba(255,255,255,.04)',border:'1px solid rgba(255,255,255,.09)',borderRadius:10,padding:'7px 13px',cursor:'pointer',color:'rgba(255,255,255,.28)',fontSize:12,fontWeight:600,display:'flex',alignItems:'center',gap:6}}>
            <Trash2 size={13}/> Clear
          </button>
        </div>

        <p style={{fontSize:10,color:'rgba(255,255,255,.16)',textAlign:'center',marginTop:12,maxWidth:200,lineHeight:1.5}}>
          Kid voice via StreamElements · Chrome/Edge for mic
        </p>
      </div>

      {/* ── RIGHT: Chat ── */}
      <div style={{flex:1,display:'flex',flexDirection:'column',padding:'24px 20px 20px',position:'relative',zIndex:2,minWidth:0}}>
        <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:14,flexShrink:0}}>
          <Sparkles size={17} color="#a78bfa"/>
          <h1 style={{fontSize:17,fontWeight:900,color:'white',margin:0,letterSpacing:'-.01em'}}>Ask Nibi</h1>
          <span style={{fontSize:11,padding:'3px 9px',background:'rgba(99,102,241,.18)',border:'1px solid rgba(99,102,241,.32)',borderRadius:20,color:'#c4b5fd',fontWeight:700,letterSpacing:'.04em'}}>WATER AI</span>
          <span style={{marginLeft:'auto',fontSize:10,color:'rgba(255,255,255,.2)',display:'flex',alignItems:'center',gap:4}}>
            <span style={{width:6,height:6,borderRadius:'50%',background:'#10b981',display:'inline-block',boxShadow:'0 0 6px #10b981'}}/>Free · No account needed
          </span>
        </div>

        {messages.length<=1&&(
          <motion.div initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} style={{display:'flex',flexWrap:'wrap',gap:7,marginBottom:14,flexShrink:0}}>
            {SUGGESTIONS.map(s=>(
              <motion.button key={s} onClick={()=>sendMessage(s.replace(/^[^\s]+ /,''))}
                whileHover={{scale:1.04,borderColor:'rgba(99,102,241,.5)',background:'rgba(99,102,241,.12)'}}
                whileTap={{scale:.96}}
                style={{fontSize:12,padding:'6px 13px',background:'rgba(255,255,255,.04)',border:'1px solid rgba(255,255,255,.09)',borderRadius:20,cursor:'pointer',color:'rgba(255,255,255,.6)',fontWeight:500,transition:'all .15s'}}>
                {s}
              </motion.button>
            ))}
          </motion.div>
        )}

        <div style={{flex:1,overflowY:'auto',display:'flex',flexDirection:'column',gap:11,paddingRight:4,paddingBottom:6}}>
          <AnimatePresence initial={false}>
            {messages.map((m,i)=><Bubble key={i} msg={m}/>)}
          </AnimatePresence>
          <AnimatePresence>
            {status==='thinking'&&(
              <motion.div initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} exit={{opacity:0}} style={{display:'flex',gap:10,alignItems:'flex-end'}}>
                <div style={{width:32,height:32,borderRadius:'50%',background:'linear-gradient(135deg,#6366f1,#14b8a6)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:15,boxShadow:'0 0 12px rgba(99,102,241,.4)',flexShrink:0}}>💧</div>
                <div style={{padding:'12px 16px',background:'rgba(255,255,255,.055)',border:'1px solid rgba(255,255,255,.09)',borderRadius:'18px 18px 18px 4px',display:'flex',gap:5,alignItems:'center'}}>
                  {[0,1,2].map(i=><motion.div key={i} animate={{y:[0,-7,0]}} transition={{duration:.65,repeat:Infinity,delay:i*.15,ease:'easeInOut'}} style={{width:7,height:7,borderRadius:'50%',background:'#a78bfa',boxShadow:'0 0 6px #a78bfa'}}/>)}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          <div ref={bottomRef}/>
        </div>

        <div style={{display:'flex',gap:8,marginTop:12,flexShrink:0}}>
          <input value={input} onChange={e=>setInput(e.target.value)}
            onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendMessage(input)}}}
            placeholder="Ask about water quality, lakes, ecosystems…"
            style={{flex:1,padding:'11px 16px',background:'rgba(255,255,255,.055)',border:'1px solid rgba(99,102,241,.28)',borderRadius:13,color:'rgba(255,255,255,.9)',fontSize:13.5,outline:'none',boxSizing:'border-box',transition:'border-color .2s'}}
            onFocus={e=>{e.target.style.borderColor='rgba(99,102,241,.6)';e.target.style.boxShadow='0 0 0 3px rgba(99,102,241,.12)'}}
            onBlur={e=>{e.target.style.borderColor='rgba(99,102,241,.28)';e.target.style.boxShadow='none'}}/>
          <motion.button onClick={()=>sendMessage(input)} disabled={!input.trim()||status==='thinking'}
            whileHover={input.trim()?{scale:1.06}:{}} whileTap={input.trim()?{scale:.94}:{}}
            style={{padding:'11px 18px',borderRadius:13,border:'none',background:input.trim()?'linear-gradient(135deg,#6366f1,#4338ca)':'rgba(255,255,255,.06)',cursor:input.trim()?'pointer':'not-allowed',opacity:input.trim()?1:.4,color:'white',display:'flex',alignItems:'center',boxShadow:input.trim()?'0 4px 20px rgba(99,102,241,.35)':'none',transition:'all .2s',flexShrink:0}}>
            <Send size={16}/>
          </motion.button>
        </div>
      </div>

      <style>{`input::placeholder{color:rgba(255,255,255,.22)} ::-webkit-scrollbar{width:4px} ::-webkit-scrollbar-track{background:transparent} ::-webkit-scrollbar-thumb{background:rgba(99,102,241,.3);border-radius:4px}`}</style>
    </div>
  )
}
