/**
 * AskWater — Nibi AI Voice Chat
 * Voice output : StreamElements TTS → "Ivy" (Amazon Polly child voice, free, no key)
 *                fallback → Web Speech Synthesis tuned for kid sound
 * Voice input  : Web Speech API (SpeechRecognition) with explicit permission request
 * AI           : /api/ai/public-chat (Groq free / Pollinations fallback)
 * Idle nudges  : Nibi speaks up after ~10 s of silence ("Psst… hey!")
 */
import { useState, useRef, useEffect, useCallback, Suspense } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Mic, MicOff, Send, Trash2, Volume2, VolumeX, Sparkles, Droplets, AlertCircle } from 'lucide-react'
import NibiMascot3D from '../components/NibiMascot3D'
import api from '../utils/api'

// ── Content ───────────────────────────────────────────────────────────────────
const SUGGESTIONS = [
  '💧 Safe pH for drinking water?',
  '🌊 Tell me about Lake Superior',
  '🦠 How do algae blooms form?',
  '🧪 How to test water quality?',
  '🌡️ Temperature & dissolved oxygen?',
  '🏭 Mining & water pollution',
  '🌿 Protecting local watersheds',
  '🐟 How fish react to water quality',
]

const GREETING = "Hey! I'm Nibi! 💧 I know everything about water! Ask me anything — or just tap the mic and talk to me!"

// Idle nudges — Nibi speaks up after ~10 s of user silence
const IDLE_NUDGES = [
  "Psst… hey! 👋 Did you know water covers 71% of Earth?",
  "Hey hey! Tap the mic and talk to me! 🎤",
  "Pss pss… I'm right here! Ask me something! 💧",
  "Hey! Did you know Lake Superior holds 10% of Earth's fresh surface water? 🌊",
  "Psst… water is the only thing on Earth that exists naturally as solid, liquid, and gas!",
  "Hey you! Did you know humans are about 60% water? We're basically cousins! 💧",
  "Pss… 👀 I spotted you! What's your water question today?",
  "Hey! Did you know some water molecules in your glass might be millions of years old? Wild! 🌊",
]

const MOOD_MAP = { idle: 'idle', listening: 'wave', thinking: 'thinking', speaking: 'happy', error: 'blush' }

// ── StreamElements Ivy TTS (free Amazon Polly child voice, no API key) ────────
async function streamTTS(text, signal) {
  const clean = text.replace(/[*_`#[\]()]/g, '').replace(/https?:\/\/\S+/g, '').trim().slice(0, 280)
  if (!clean) return null
  const url = `https://api.streamelements.com/kappa/v2/speech?voice=Ivy&text=${encodeURIComponent(clean)}`
  const audio = new Audio(url)
  audio.crossOrigin = 'anonymous'
  return new Promise((resolve, reject) => {
    if (signal?.aborted) { reject(new DOMException('Aborted', 'AbortError')); return }
    const onAbort = () => { audio.pause(); audio.src = ''; reject(new DOMException('Aborted', 'AbortError')) }
    signal?.addEventListener('abort', onAbort)
    audio.onended = () => { signal?.removeEventListener('abort', onAbort); resolve(audio) }
    audio.onerror = () => { signal?.removeEventListener('abort', onAbort); reject(new Error('audio error')) }
    audio.play().catch(reject)
  })
}

// Browser TTS fallback — tuned for kid-like sound
function browserTTS(text) {
  return new Promise((resolve) => {
    const clean = text.replace(/[*_`#[\]]/g, '').trim().slice(0, 350)
    const utter = new SpeechSynthesisUtterance(clean)
    utter.pitch = 1.65; utter.rate = 1.08; utter.volume = 0.95
    const voices = window.speechSynthesis.getVoices()
    const pick = voices.find(v => /samantha|karen|victoria|allison|zira/i.test(v.name))
      || voices.find(v => v.lang?.startsWith('en-') && !v.localService)
      || voices.find(v => v.lang?.startsWith('en'))
    if (pick) utter.voice = pick
    utter.onend = resolve; utter.onerror = resolve
    window.speechSynthesis.speak(utter)
  })
}

// ── Particle background ────────────────────────────────────────────────────────
function ParticleBG() {
  const ref = useRef(null)
  useEffect(() => {
    const canvas = ref.current; if (!canvas) return
    const resize = () => { canvas.width = canvas.offsetWidth; canvas.height = canvas.offsetHeight }
    resize(); window.addEventListener('resize', resize)
    const ctx = canvas.getContext('2d')
    const COLS = ['#6366f1','#8b5cf6','#06b6d4','#14b8a6','#3b82f6','#a78bfa']
    const pts = Array.from({length:80},()=>({ x:Math.random()*canvas.width, y:Math.random()*canvas.height, r:Math.random()*2.2+0.4, vy:Math.random()*0.35+0.08, vx:(Math.random()-.5)*.18, op:Math.random()*.45+.08, col:COLS[~~(Math.random()*COLS.length)], t:Math.random()*Math.PI*2 }))
    let raf
    const draw = () => {
      ctx.clearRect(0,0,canvas.width,canvas.height)
      for (const p of pts) {
        p.t+=0.02; ctx.beginPath(); ctx.arc(p.x,p.y,p.r,0,Math.PI*2)
        ctx.fillStyle=p.col; ctx.globalAlpha=p.op*(0.7+0.3*Math.sin(p.t)); ctx.fill()
        p.y-=p.vy; p.x+=p.vx
        if(p.y<-8){p.y=canvas.height+8;p.x=Math.random()*canvas.width}
        if(p.x<0)p.x=canvas.width; if(p.x>canvas.width)p.x=0
      }
      ctx.globalAlpha=1; raf=requestAnimationFrame(draw)
    }
    draw()
    return ()=>{ cancelAnimationFrame(raf); window.removeEventListener('resize',resize) }
  },[])
  return <canvas ref={ref} style={{position:'absolute',inset:0,width:'100%',height:'100%',pointerEvents:'none',zIndex:0}}/>
}

// ── Waveform ───────────────────────────────────────────────────────────────────
function Waveform({ data, status }) {
  const c1 = status==='listening'?'#60a5fa':status==='speaking'?'#34d399':'#a78bfa'
  const c2 = status==='listening'?'#818cf8':status==='speaking'?'#6ee7b7':'#c4b5fd'
  return (
    <div style={{display:'flex',alignItems:'center',gap:2.5,height:52,padding:'0 8px'}}>
      {data.map((h,i)=>(
        <motion.div key={i} animate={{height:Math.max(3,h)}} transition={{duration:0.06}}
          style={{width:3.5,borderRadius:2,background:`linear-gradient(to top,${c1},${c2})`,opacity:status==='idle'?.18:.85,minHeight:3,boxShadow:status!=='idle'?`0 0 6px ${c1}60`:'none'}}/>
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
        {msg.model&&<div style={{fontSize:10,marginTop:5,opacity:.3}}>via {msg.model.split('/').pop()}</div>}
      </div>
    </motion.div>
  )
}

// ── Main ───────────────────────────────────────────────────────────────────────
export default function AskWater() {
  const [messages, setMessages] = useState([{role:'assistant',content:GREETING}])
  const [input,   setInput]     = useState('')
  const [status,  setStatus]    = useState('idle')
  const [voiceOn, setVoiceOn]   = useState(true)
  const [waveData,setWaveData]  = useState(new Array(28).fill(3))
  const [interim, setInterim]   = useState('')
  const [micErr,  setMicErr]    = useState('')

  const recRef      = useRef(null)
  const isListRef   = useRef(false)
  const analyserRef = useRef(null)
  const streamRef   = useRef(null)
  const rafRef      = useRef(null)
  const audioCtrlRef= useRef(null)   // AbortController for current TTS audio
  const currentAudioRef = useRef(null)
  const bottomRef   = useRef(null)
  const voiceOnRef  = useRef(voiceOn)
  useEffect(()=>{ voiceOnRef.current = voiceOn },[voiceOn])

  const mood = MOOD_MAP[status] ?? 'idle'

  useEffect(()=>{ bottomRef.current?.scrollIntoView({behavior:'smooth'}) },[messages,status])

  // ── Stop any playing TTS ───────────────────────────────────────────────────
  const stopSpeaking = useCallback(()=>{
    audioCtrlRef.current?.abort()
    audioCtrlRef.current = null
    if(currentAudioRef.current){ currentAudioRef.current.pause(); currentAudioRef.current.src=''; currentAudioRef.current=null }
    window.speechSynthesis?.cancel()
  },[])

  // ── TTS: try StreamElements Ivy (kid voice) → browser TTS fallback ─────────
  const speakText = useCallback(async (text)=>{
    if(!voiceOnRef.current) return
    stopSpeaking()
    const ctrl = new AbortController()
    audioCtrlRef.current = ctrl
    setStatus('speaking')
    try {
      const audio = await streamTTS(text, ctrl.signal)
      currentAudioRef.current = audio
      // wait for it to finish (already awaited inside streamTTS)
    } catch(e) {
      if(e.name==='AbortError') return
      // Fallback to browser TTS (high pitch for kid sound)
      await browserTTS(text)
    }
    if(!ctrl.signal.aborted) setStatus('idle')
  },[stopSpeaking])

  // ── Greeting on mount ──────────────────────────────────────────────────────
  useEffect(()=>{
    const t = setTimeout(()=>speakText(GREETING), 1000)
    return ()=>clearTimeout(t)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[])

  // ── Idle nudge — Nibi speaks up after ~10 s of silence ─────────────────────
  useEffect(()=>{
    if(status!=='idle') return
    const delay = 9000 + Math.random()*6000
    const timer = setTimeout(()=>{
      const phrase = IDLE_NUDGES[~~(Math.random()*IDLE_NUDGES.length)]
      setMessages(prev=>{
        const last = prev[prev.length-1]
        if(last?.idle) return prev  // don't stack idle messages
        return [...prev,{role:'assistant',content:phrase,idle:true}]
      })
      speakText(phrase)
    }, delay)
    return ()=>clearTimeout(timer)
  },[status,speakText])

  // ── Waveform loop ──────────────────────────────────────────────────────────
  useEffect(()=>{
    if(status!=='listening'||!analyserRef.current){ setWaveData(new Array(28).fill(3)); return }
    const draw=()=>{
      if(!analyserRef.current) return
      const d=new Uint8Array(analyserRef.current.frequencyBinCount)
      analyserRef.current.getByteFrequencyData(d)
      setWaveData(Array.from({length:28},(_,i)=>Math.max(3,(d[~~(i*d.length/28)]/255)*58)))
      rafRef.current=requestAnimationFrame(draw)
    }
    draw()
    return ()=>cancelAnimationFrame(rafRef.current)
  },[status])

  // ── Send message ───────────────────────────────────────────────────────────
  const sendMessage = useCallback(async(text)=>{
    const msg = text?.trim()
    if(!msg||status==='thinking') return
    setInput(''); setInterim('')
    stopSpeaking()
    const hist = [...messages,{role:'user',content:msg}]
    setMessages(hist)
    setStatus('thinking')
    try {
      const {data} = await api.post('/ai/public-chat',{
        messages:[
          {role:'system',content:'You are Nibi, a cheerful water-drop character who is an expert on water quality and Northern Ontario waterways. Answer in 2-4 friendly sentences. No markdown. Occasionally use water emojis. Be warm and encourage curiosity.'},
          ...hist.slice(-10).map(m=>({role:m.role,content:m.content})),
        ]
      })
      const reply = data.reply?.trim()||"Hmm, I had a brain bubble! Try again? 💧"
      setMessages(p=>[...p,{role:'assistant',content:reply,model:data.model}])
      speakText(reply)
    } catch {
      const err="Oops! My water pipes got clogged. Try again! 💧"
      setMessages(p=>[...p,{role:'assistant',content:err}])
      setStatus('error')
      setTimeout(()=>setStatus('idle'),2000)
    }
  },[messages,speakText,status,stopSpeaking])

  // ── Voice input ────────────────────────────────────────────────────────────
  const startListening = useCallback(async()=>{
    if(isListRef.current) return
    stopSpeaking()
    setMicErr('')

    // Explicitly request mic permission — surfaces the browser prompt
    let stream
    try {
      stream = await navigator.mediaDevices.getUserMedia({audio:true})
    } catch(e) {
      const denied = e.name==='NotAllowedError'||e.name==='PermissionDeniedError'
      setMicErr(denied
        ? '🔒 Mic blocked. Click the 🔒 lock icon in your browser address bar and allow microphone.'
        : '🎤 Could not access microphone. Check browser settings.')
      setStatus('error')
      setTimeout(()=>{setStatus('idle');setMicErr('')},5000)
      return
    }

    // Hook up waveform analyser
    streamRef.current = stream
    try {
      const ctx = new (window.AudioContext||window.webkitAudioContext)()
      const src = ctx.createMediaStreamSource(stream)
      const an = ctx.createAnalyser(); an.fftSize=256
      src.connect(an); analyserRef.current=an
    } catch{}

    const SR = window.SpeechRecognition||window.webkitSpeechRecognition
    if(!SR){
      setMicErr('🌐 Voice input needs Chrome or Edge.')
      stream.getTracks().forEach(t=>t.stop())
      setStatus('error')
      setTimeout(()=>{setStatus('idle');setMicErr('')},4000)
      return
    }

    const rec = new SR()
    rec.lang='en-CA'; rec.continuous=false; rec.interimResults=true

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
      if(e.error==='not-allowed'){
        setMicErr('🔒 Mic permission denied.')
        setTimeout(()=>{setStatus('idle');setMicErr('')},4000)
      }
      stopListeningClean()
    }
    rec.onend=()=>{ if(isListRef.current) stopListeningClean() }

    recRef.current=rec
    isListRef.current=true
    setStatus('listening')
    try{ rec.start() }catch{ stopListeningClean() }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[sendMessage,stopSpeaking])

  const stopListeningClean = useCallback(()=>{
    isListRef.current=false
    recRef.current?.stop()
    streamRef.current?.getTracks().forEach(t=>t.stop())
    analyserRef.current=null
    cancelAnimationFrame(rafRef.current)
    setInterim('')
    setWaveData(new Array(28).fill(3))
    setStatus(s=>s==='listening'?'idle':s)
  },[])

  const toggleListen=()=>{ status==='listening'?stopListeningClean():startListening() }

  const toggleVoice=()=>setVoiceOn(v=>{ if(v) stopSpeaking(); return !v })

  const clearChat=()=>{
    stopSpeaking(); stopListeningClean()
    setMessages([{role:'assistant',content:GREETING}])
    setStatus('idle')
    if(voiceOnRef.current) setTimeout(()=>speakText(GREETING),300)
  }

  useEffect(()=>()=>{ stopSpeaking(); recRef.current?.abort(); streamRef.current?.getTracks().forEach(t=>t.stop()); cancelAnimationFrame(rafRef.current) },[stopSpeaking])

  const statusLabel = {idle:'Tap mic to speak or type below',listening:interim||'Listening… speak now!',thinking:'Thinking…',speaking:'Speaking…',error:micErr||'Oops!'}[status]??''
  const statusColor = {idle:'rgba(255,255,255,.32)',listening:'#60a5fa',thinking:'#a78bfa',speaking:'#34d399',error:'#f87171'}[status]
  const glowColor   = {idle:'rgba(99,102,241,.09)',listening:'rgba(96,165,250,.18)',thinking:'rgba(167,139,250,.18)',speaking:'rgba(52,211,153,.16)',error:'rgba(248,113,113,.14)'}[status]

  return (
    <div style={{minHeight:'calc(100vh - 130px)',background:'linear-gradient(145deg,#08021e 0%,#04091a 45%,#020c18 100%)',borderRadius:20,position:'relative',overflow:'hidden',display:'flex',gap:0}}>
      <ParticleBG/>
      {/* scan lines */}
      <div style={{position:'absolute',inset:0,zIndex:1,pointerEvents:'none',background:'repeating-linear-gradient(0deg,transparent,transparent 3px,rgba(0,0,0,.04) 3px,rgba(0,0,0,.04) 4px)'}}/>

      {/* ── LEFT: Nibi + controls ── */}
      <div style={{width:'38%',minWidth:260,maxWidth:400,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'28px 20px 24px',position:'relative',zIndex:2,borderRight:'1px solid rgba(99,102,241,.12)'}}>

        {/* ambient glow */}
        <motion.div animate={{opacity:[.7,1,.7],scale:[1,1.06,1]}} transition={{duration:3,repeat:Infinity}}
          style={{position:'absolute',width:380,height:380,borderRadius:'50%',background:`radial-gradient(circle,${glowColor} 0%,transparent 70%)`,pointerEvents:'none',transition:'background .6s ease'}}/>

        {/* 3D Nibi */}
        <div style={{position:'relative',zIndex:2}}>
          <Suspense fallback={<div style={{width:320,height:430,display:'flex',alignItems:'center',justifyContent:'center',color:'#6366f1',fontSize:13}}>Loading Nibi…</div>}>
            <NibiMascot3D mood={mood} size={320} orbitControls={false}/>
          </Suspense>
        </div>

        {/* status text */}
        <AnimatePresence mode="wait">
          <motion.p key={statusLabel} initial={{opacity:0,y:6}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-6}} transition={{duration:.2}}
            style={{color:statusColor,fontSize:12.5,fontWeight:600,textAlign:'center',margin:'-8px 0 10px',minHeight:18,maxWidth:220,letterSpacing:'.02em',lineHeight:1.4}}>
            {statusLabel}
          </motion.p>
        </AnimatePresence>

        {/* mic error */}
        <AnimatePresence>
          {micErr&&(
            <motion.div initial={{opacity:0,y:4}} animate={{opacity:1,y:0}} exit={{opacity:0}}
              style={{background:'rgba(239,68,68,.12)',border:'1px solid rgba(239,68,68,.3)',borderRadius:10,padding:'8px 12px',fontSize:11,color:'#fca5a5',textAlign:'center',marginBottom:10,maxWidth:220,lineHeight:1.5}}>
              {micErr}
            </motion.div>
          )}
        </AnimatePresence>

        <Waveform data={waveData} status={status}/>

        {/* Mic button */}
        <div style={{position:'relative',marginTop:8}}>
          {status==='listening'&&[0,1,2].map(i=>(
            <motion.div key={i} initial={{scale:1,opacity:.6}} animate={{scale:2.4,opacity:0}} transition={{duration:1.6,repeat:Infinity,delay:i*.45,ease:'easeOut'}}
              style={{position:'absolute',inset:0,borderRadius:'50%',border:'2px solid rgba(239,68,68,.5)',pointerEvents:'none'}}/>
          ))}
          {status==='speaking'&&[0,1].map(i=>(
            <motion.div key={i} initial={{scale:1,opacity:.5}} animate={{scale:2,opacity:0}} transition={{duration:1.4,repeat:Infinity,delay:i*.5,ease:'easeOut'}}
              style={{position:'absolute',inset:0,borderRadius:'50%',border:'2px solid rgba(52,211,153,.5)',pointerEvents:'none'}}/>
          ))}
          <motion.button onClick={toggleListen}
            disabled={status==='thinking'||status==='speaking'}
            whileHover={status!=='thinking'&&status!=='speaking'?{scale:1.09}:{}}
            whileTap={status!=='thinking'&&status!=='speaking'?{scale:.91}:{}}
            style={{width:80,height:80,borderRadius:'50%',border:'none',cursor:status==='thinking'||status==='speaking'?'not-allowed':'pointer',
              background:status==='listening'?'linear-gradient(135deg,#ef4444,#dc2626)':status==='thinking'?'linear-gradient(135deg,#7c3aed,#6d28d9)':status==='speaking'?'linear-gradient(135deg,#059669,#047857)':'linear-gradient(135deg,#6366f1,#4338ca)',
              boxShadow:status==='listening'?'0 0 0 6px rgba(239,68,68,.15),0 8px 40px rgba(239,68,68,.45)':status==='speaking'?'0 0 0 6px rgba(52,211,153,.15),0 8px 40px rgba(52,211,153,.35)':'0 0 0 6px rgba(99,102,241,.15),0 8px 40px rgba(99,102,241,.45)',
              display:'flex',alignItems:'center',justifyContent:'center',transition:'background .3s,box-shadow .3s'}}>
            {status==='listening'?<MicOff size={30} color="white"/>:
             status==='thinking'?<motion.div animate={{rotate:360}} transition={{duration:1.2,repeat:Infinity,ease:'linear'}}><Droplets size={28} color="white"/></motion.div>:
             status==='speaking'?<Volume2 size={28} color="white"/>:
             <Mic size={30} color="white"/>}
          </motion.button>
        </div>

        {/* controls */}
        <div style={{display:'flex',gap:8,marginTop:20}}>
          <button onClick={toggleVoice} style={{background:voiceOn?'rgba(99,102,241,.12)':'rgba(255,255,255,.04)',border:`1px solid ${voiceOn?'rgba(99,102,241,.35)':'rgba(255,255,255,.09)'}`,borderRadius:10,padding:'7px 13px',cursor:'pointer',color:voiceOn?'#c4b5fd':'rgba(255,255,255,.3)',fontSize:12,fontWeight:600,display:'flex',alignItems:'center',gap:6,transition:'all .2s'}}>
            {voiceOn?<Volume2 size={13}/>:<VolumeX size={13}/>}{voiceOn?'Voice On':'Voice Off'}
          </button>
          <button onClick={clearChat} style={{background:'rgba(255,255,255,.04)',border:'1px solid rgba(255,255,255,.09)',borderRadius:10,padding:'7px 13px',cursor:'pointer',color:'rgba(255,255,255,.28)',fontSize:12,fontWeight:600,display:'flex',alignItems:'center',gap:6}}>
            <Trash2 size={13}/> Clear
          </button>
        </div>

        <p style={{fontSize:10,color:'rgba(255,255,255,.18)',textAlign:'center',marginTop:14,maxWidth:200,lineHeight:1.5}}>
          Voice powered by StreamElements · Ivy (child voice) · Chrome/Edge for mic
        </p>
      </div>

      {/* ── RIGHT: Chat ── */}
      <div style={{flex:1,display:'flex',flexDirection:'column',padding:'24px 20px 20px',position:'relative',zIndex:2,minWidth:0}}>

        <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:14,flexShrink:0}}>
          <Sparkles size={17} color="#a78bfa"/>
          <h1 style={{fontSize:17,fontWeight:900,color:'white',margin:0,letterSpacing:'-.01em'}}>Ask Nibi</h1>
          <span style={{fontSize:11,padding:'3px 9px',background:'rgba(99,102,241,.18)',border:'1px solid rgba(99,102,241,.32)',borderRadius:20,color:'#c4b5fd',fontWeight:700,letterSpacing:'.04em'}}>WATER AI</span>
          <span style={{marginLeft:'auto',fontSize:10,color:'rgba(255,255,255,.2)',display:'flex',alignItems:'center',gap:4}}>
            <span style={{width:6,height:6,borderRadius:'50%',background:'#10b981',display:'inline-block',boxShadow:'0 0 6px #10b981'}}/>
            Free · No account needed
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
              <motion.div initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} exit={{opacity:0}}
                style={{display:'flex',gap:10,alignItems:'flex-end'}}>
                <div style={{width:32,height:32,borderRadius:'50%',background:'linear-gradient(135deg,#6366f1,#14b8a6)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:15,boxShadow:'0 0 12px rgba(99,102,241,.4)',flexShrink:0}}>💧</div>
                <div style={{padding:'12px 16px',background:'rgba(255,255,255,.055)',border:'1px solid rgba(255,255,255,.09)',borderRadius:'18px 18px 18px 4px',display:'flex',gap:5,alignItems:'center'}}>
                  {[0,1,2].map(i=>(
                    <motion.div key={i} animate={{y:[0,-7,0]}} transition={{duration:.65,repeat:Infinity,delay:i*.15,ease:'easeInOut'}}
                      style={{width:7,height:7,borderRadius:'50%',background:'#a78bfa',boxShadow:'0 0 6px #a78bfa'}}/>
                  ))}
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
            style={{flex:1,padding:'11px 16px',background:'rgba(255,255,255,.055)',border:'1px solid rgba(99,102,241,.28)',borderRadius:13,color:'rgba(255,255,255,.9)',fontSize:13.5,outline:'none',boxSizing:'border-box',boxShadow:'inset 0 1px 0 rgba(255,255,255,.05)',transition:'border-color .2s'}}
            onFocus={e=>{e.target.style.borderColor='rgba(99,102,241,.55)';e.target.style.boxShadow='0 0 0 3px rgba(99,102,241,.1),inset 0 1px 0 rgba(255,255,255,.05)'}}
            onBlur={e=>{e.target.style.borderColor='rgba(99,102,241,.28)';e.target.style.boxShadow='inset 0 1px 0 rgba(255,255,255,.05)'}}/>
          <motion.button onClick={()=>sendMessage(input)} disabled={!input.trim()||status==='thinking'}
            whileHover={input.trim()?{scale:1.06}:{}} whileTap={input.trim()?{scale:.94}:{}}
            style={{padding:'11px 18px',borderRadius:13,border:'none',background:input.trim()?'linear-gradient(135deg,#6366f1,#4338ca)':'rgba(255,255,255,.06)',cursor:input.trim()?'pointer':'not-allowed',opacity:input.trim()?1:.4,color:'white',display:'flex',alignItems:'center',gap:6,boxShadow:input.trim()?'0 4px 20px rgba(99,102,241,.35)':'none',transition:'all .2s',flexShrink:0}}>
            <Send size={16}/>
          </motion.button>
        </div>
      </div>

      <style>{`
        input::placeholder{color:rgba(255,255,255,.25)}
        ::-webkit-scrollbar{width:4px}
        ::-webkit-scrollbar-track{background:transparent}
        ::-webkit-scrollbar-thumb{background:rgba(99,102,241,.3);border-radius:4px}
        ::-webkit-scrollbar-thumb:hover{background:rgba(99,102,241,.5)}
      `}</style>
    </div>
  )
}
