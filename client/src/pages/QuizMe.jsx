import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useSound } from '../context/SoundContext'
import api from '../utils/api'
import {
  Clock, Trophy, Star, CheckCircle, XCircle, RotateCcw,
  Zap, BookOpen, ChevronRight, Search, Filter, BarChart2,
  Target, Award, ChevronDown, ChevronUp, AlertCircle
} from 'lucide-react'

// ── Confetti ──────────────────────────────────────────────────────────────────
function Confetti() {
  const ref = useRef(null)
  useEffect(() => {
    const c = ref.current; if (!c) return
    const ctx = c.getContext('2d')
    c.width = window.innerWidth; c.height = window.innerHeight
    const P = Array.from({ length: 140 }, (_, i) => ({
      x: Math.random() * c.width, y: -20 - Math.random() * 200,
      r: Math.random() * 7 + 3,
      col: ['#6366f1','#14b8a6','#f59e0b','#ec4899','#10b981','#0ea5e9','#f97316'][i%7],
      vx: (Math.random()-.5)*5, vy: Math.random()*3+2,
      rot: Math.random()*360, vr: (Math.random()-.5)*7,
    }))
    let frame = 0
    const go = () => {
      if (frame++ > 240) return
      ctx.clearRect(0,0,c.width,c.height)
      P.forEach(p => {
        p.x+=p.vx; p.y+=p.vy; p.vy+=0.07; p.rot+=p.vr
        if (p.y > c.height) { p.y=-20; p.x=Math.random()*c.width }
        ctx.save(); ctx.translate(p.x,p.y); ctx.rotate(p.rot*Math.PI/180)
        ctx.fillStyle=p.col; ctx.globalAlpha=Math.max(0,1-frame/240)
        ctx.fillRect(-p.r,-p.r/2,p.r*2,p.r); ctx.restore()
      })
      requestAnimationFrame(go)
    }
    go()
  }, [])
  return <canvas ref={ref} style={{ position:'fixed',inset:0,pointerEvents:'none',zIndex:9999 }}/>
}

// ── Quiz Browser ──────────────────────────────────────────────────────────────
const DIFF = {
  Beginner:     { color:'#10b981', bg:'#f0fdf4', border:'#bbf7d0', icon:'🌱' },
  Intermediate: { color:'#f59e0b', bg:'#fffbeb', border:'#fde68a', icon:'🔬' },
  Advanced:     { color:'#ef4444', bg:'#fef2f2', border:'#fecaca', icon:'🏆' },
}
const CAT_GRAD = {
  'Water Quality':  'linear-gradient(135deg,#0ea5e9,#6366f1)',
  'Field Work':     'linear-gradient(135deg,#10b981,#0ea5e9)',
  'Data Literacy':  'linear-gradient(135deg,#8b5cf6,#ec4899)',
  'Ecology':        'linear-gradient(135deg,#14b8a6,#10b981)',
  'Regional':       'linear-gradient(135deg,#f59e0b,#ef4444)',
  'Safety':         'linear-gradient(135deg,#ef4444,#f97316)',
  'Sampling':       'linear-gradient(135deg,#0ea5e9,#14b8a6)',
  'General':        'linear-gradient(135deg,#6366f1,#8b5cf6)',
}
function catGrad(cat) { return CAT_GRAD[cat] || CAT_GRAD[Object.keys(CAT_GRAD).find(k => k.toLowerCase() === (cat||'').toLowerCase())] || 'linear-gradient(135deg,#6366f1,#8b5cf6)' }
const normalize = s => s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : 'Beginner'

function QuizBrowser({ onStart }) {
  const { user } = useAuth()
  const [quizzes, setQuizzes]   = useState([])
  const [progress, setProgress] = useState([])
  const [loading, setLoading]   = useState(true)
  const [search, setSearch]     = useState('')
  const [diffFilter, setDiff]   = useState('All')
  const [catFilter, setCat]     = useState('All')
  const [showHistory, setShow]  = useState(false)

  useEffect(() => {
    Promise.all([
      api.get('/quizzes'),
      api.get('/quizzes/my-progress').catch(() => ({ data: [] })),
    ]).then(([r1, r2]) => {
      setQuizzes(r1.data.quizzes || [])
      setProgress(Array.isArray(r2.data) ? r2.data : [])
    }).finally(() => setLoading(false))
  }, [])

  const myStats = {}
  progress.forEach(a => {
    if (!myStats[a.quiz_id]) myStats[a.quiz_id] = { attempts:0, best:0, passed:0 }
    myStats[a.quiz_id].attempts++
    if ((a.score||0) > myStats[a.quiz_id].best) myStats[a.quiz_id].best = a.score
    if (a.passed) myStats[a.quiz_id].passed++
  })

  const cats    = ['All', ...new Set(quizzes.map(q => q.category).filter(Boolean).map(c => c.replace(/_/g,' ')))]
  const diffs   = ['All', 'Beginner', 'Intermediate', 'Advanced']
  const visible = quizzes.filter(q => {
    const cat = (q.category||'').replace(/_/g,' ')
    if (catFilter !== 'All' && cat.toLowerCase() !== catFilter.toLowerCase()) return false
    if (diffFilter !== 'All' && normalize(q.difficulty) !== diffFilter) return false
    if (search && !q.title.toLowerCase().includes(search.toLowerCase()) && !(q.description||'').toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const totalAttempts = progress.length
  const totalPassed   = progress.filter(a => a.passed).length
  const avgScore      = totalAttempts ? Math.round(progress.reduce((s,a) => s+(a.score||0),0)/totalAttempts) : 0

  if (loading) return (
    <div className="space-y-4">
      {[1,2,3].map(i => <div key={i} className="card p-5 h-40 skeleton"/>)}
    </div>
  )

  return (
    <div className="space-y-5 pb-8">
      {/* Hero */}
      <div className="rounded-2xl p-7 text-white relative overflow-hidden"
        style={{ background:'linear-gradient(135deg,#4f46e5,#7c3aed,#ec4899)' }}>
        <div className="absolute -right-12 -top-12 w-52 h-52 rounded-full bg-white/5"/>
        <div className="absolute right-24 -bottom-6 w-36 h-36 rounded-full bg-white/5"/>
        <div className="relative">
          <div className="flex items-center gap-2 mb-2">
            <Zap className="w-4 h-4 text-yellow-300"/>
            <span className="text-yellow-300 font-bold text-xs tracking-widest">WATER KNOWLEDGE CHALLENGE</span>
          </div>
          <h1 className="text-3xl font-black mb-1">Quiz Me 🧠</h1>
          <p className="text-white/70 text-sm mb-5">Master water science. Earn XP. Climb the leaderboard.</p>
          <div className="flex gap-6 flex-wrap">
            {[{l:'Quizzes',v:quizzes.length},{l:'My Attempts',v:totalAttempts},{l:'Avg Score',v:totalAttempts?`${avgScore}%`:'—'},{l:'Passed',v:totalPassed}].map(s => (
              <div key={s.l} className="text-center">
                <div className="text-2xl font-black">{s.v}</div>
                <div className="text-xs text-white/60">{s.l}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* My recent history */}
      {progress.length > 0 && (
        <div className="card overflow-hidden">
          <button className="w-full flex items-center justify-between px-5 py-4"
            onClick={() => setShow(v => !v)}>
            <div className="flex items-center gap-3">
              <Trophy className="w-5 h-5 text-amber-500"/>
              <span className="font-bold" style={{color:'var(--text)'}}>My History</span>
              <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{background:'rgba(99,102,241,0.1)',color:'#6366f1'}}>{totalAttempts} attempts</span>
            </div>
            {showHistory ? <ChevronUp className="w-4 h-4" style={{color:'var(--text-muted)'}}/> : <ChevronDown className="w-4 h-4" style={{color:'var(--text-muted)'}}/>}
          </button>
          {showHistory && (
            <div className="px-5 pb-4 border-t" style={{borderColor:'var(--border)'}}>
              <div className="grid grid-cols-3 gap-3 my-3">
                {[{l:'Attempts',v:totalAttempts,c:'#6366f1'},{l:'Avg Score',v:`${avgScore}%`,c:avgScore>=70?'#10b981':'#f59e0b'},{l:'Passed',v:totalPassed,c:'#10b981'}].map(s => (
                  <div key={s.l} className="rounded-xl p-3 text-center" style={{background:'var(--page-bg)',border:'1px solid var(--border)'}}>
                    <div className="text-xl font-black" style={{color:s.c}}>{s.v}</div>
                    <div className="text-xs mt-0.5" style={{color:'var(--text-muted)'}}>{s.l}</div>
                  </div>
                ))}
              </div>
              <div className="space-y-1.5 max-h-52 overflow-y-auto">
                {progress.slice(0,12).map((a,i) => (
                  <div key={i} className="flex items-center justify-between px-3 py-2 rounded-xl text-sm"
                    style={{background:'var(--page-bg)'}}>
                    <span className="font-medium truncate flex-1" style={{color:'var(--text)'}}>{a.quiz_title}</span>
                    <div className="flex items-center gap-3 ml-3 flex-shrink-0">
                      <span className="font-black" style={{color:a.passed?'#10b981':'#f59e0b'}}>{a.score??'—'}%</span>
                      <span className="text-xs px-2 py-0.5 rounded-full" style={{background:a.passed?'#f0fdf4':'#fef3c7',color:a.passed?'#10b981':'#d97706'}}>{a.passed?'✓ Pass':'Fail'}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Search + filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{color:'var(--text-muted)'}}/>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search quizzes..."
            className="w-full pl-9 pr-4 py-2 rounded-xl text-sm"
            style={{background:'var(--card-bg)',border:'1.5px solid var(--border)',color:'var(--text)',outline:'none'}}/>
        </div>
        <div className="flex gap-2 flex-wrap">
          {diffs.map(d => (
            <button key={d} onClick={() => setDiff(d)}
              className="px-3 py-2 rounded-xl text-xs font-semibold transition-all"
              style={{background:diffFilter===d?'#6366f1':'var(--card-bg)',color:diffFilter===d?'white':'var(--text-muted)',border:`1px solid ${diffFilter===d?'#6366f1':'var(--border)'}`}}>
              {d === 'All' ? 'All Levels' : d}
            </button>
          ))}
        </div>
      </div>
      {cats.length > 1 && (
        <div className="flex gap-2 flex-wrap">
          {cats.map(c => (
            <button key={c} onClick={() => setCat(c)}
              className="px-3 py-1.5 rounded-full text-xs font-semibold transition-all"
              style={{background:catFilter===c?'#14b8a6':'var(--card-bg)',color:catFilter===c?'white':'var(--text-muted)',border:`1px solid ${catFilter===c?'#14b8a6':'var(--border)'}`}}>
              {c}
            </button>
          ))}
        </div>
      )}

      {/* Cards */}
      {visible.length === 0 ? (
        <div className="text-center py-20">
          <div className="text-5xl mb-4">🔍</div>
          <p style={{color:'var(--text-muted)'}}>No quizzes found. {quizzes.length === 0 ? 'Check back soon!' : 'Try different filters.'}</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {visible.map(q => {
            const cat  = (q.category||'general').replace(/_/g,' ')
            const diff = DIFF[normalize(q.difficulty)] || DIFF.Beginner
            const grad = catGrad(cat)
            const my   = myStats[q.id]
            return (
              <div key={q.id} className="card overflow-hidden group hover:shadow-xl hover:-translate-y-1 transition-all duration-200 cursor-pointer"
                onClick={() => onStart(q)}>
                <div style={{height:5,background:grad}}/>
                <div className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div className="w-11 h-11 rounded-xl flex items-center justify-center text-xl" style={{background:grad}}>
                      {diff.icon}
                    </div>
                    <span className="text-xs font-bold px-2.5 py-1 rounded-full"
                      style={{background:diff.bg,color:diff.color,border:`1px solid ${diff.border}`}}>
                      {normalize(q.difficulty)}
                    </span>
                  </div>
                  <h3 className="font-black text-sm mb-1" style={{color:'var(--text)'}}>{q.title}</h3>
                  <p className="text-xs mb-4 line-clamp-2" style={{color:'var(--text-muted)'}}>{q.description||cat}</p>
                  <div className="flex items-center justify-between text-xs mb-4" style={{color:'var(--text-muted)'}}>
                    <div className="flex gap-2">
                      <span>❓ {q.question_count||0}q</span>
                      <span>⏱ {q.time_per_question||60}s</span>
                      {q.attempt_count > 0 && <span>👥 {q.attempt_count}</span>}
                    </div>
                    {my ? (
                      <span className="font-bold" style={{color:my.passed>0?'#10b981':'#f59e0b'}}>
                        {my.passed>0?'✓ ':''}Best: {my.best}%
                      </span>
                    ) : null}
                  </div>
                  <div className="w-full py-2.5 rounded-xl text-xs font-bold text-white text-center"
                    style={{background:grad}}>
                    {my ? 'Retake Quiz' : 'Start Quiz'} →
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Quiz Player ───────────────────────────────────────────────────────────────
function QuizPlayer({ quiz, onFinish }) {
  const { play } = useSound()
  const [questions, setQs]     = useState([])
  const [attemptId, setAid]    = useState(null)
  const [idx, setIdx]          = useState(0)
  const [answers, setAnswers]  = useState({})        // {qId: selectedIdx or value}
  const [timeLeft, setTime]    = useState(null)
  const [selected, setSel]     = useState(null)
  const [revealed, setRev]     = useState(false)
  const [loading, setLoad]     = useState(true)
  const [shake, setShake]      = useState(false)
  const [bounce, setBounce]    = useState(false)
  const [multiSel, setMulti]   = useState([])        // for multiple_select
  const [textAns, setTextAns]  = useState('')        // for short_answer / fill_blank / numeric
  const timerRef               = useRef(null)
  const earnedRef              = useRef(0)
  const startTime              = useRef(Date.now())

  const totalTime = quiz.time_per_question || 60

  useEffect(() => {
    api.post(`/quizzes/${quiz.id}/start`).then(r => {
      setQs(r.data.questions || [])
      setAid(r.data.attempt_id)
      setLoad(false)
    }).catch(() => setLoad(false))
    return () => clearInterval(timerRef.current)
  }, [quiz.id])

  useEffect(() => {
    if (questions.length === 0 || revealed) return
    clearInterval(timerRef.current)
    setTime(totalTime)
    timerRef.current = setInterval(() => {
      setTime(prev => {
        if (prev <= 1) { clearInterval(timerRef.current); handleTimeout(); return 0 }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(timerRef.current)
  }, [idx, questions.length, revealed])

  const handleTimeout = () => {
    if (revealed) return
    setRev(true)
    play?.('wrong')
    setShake(true); setTimeout(() => setShake(false), 500)
  }

  const q = questions[idx]

  const submitAnswer = (userAnswer) => {
    if (revealed) return
    clearInterval(timerRef.current)
    setRev(true)
    setAnswers(prev => ({ ...prev, [q.id]: userAnswer }))
  }

  const handleChoose = (optIdx) => {
    if (revealed) return
    setSel(optIdx)
    submitAnswer(optIdx)
    // We don't know correct_answers here (server stripped them), just animate
    play?.('correct') // We'll show result on server response
    setBounce(true); setTimeout(() => setBounce(false), 500)
  }

  const handleMultiSubmit = () => {
    if (!multiSel.length) return
    submitAnswer(multiSel)
    play?.('correct')
    setBounce(true); setTimeout(() => setBounce(false), 500)
  }

  const handleTextSubmit = () => {
    if (!textAns.trim()) return
    submitAnswer(textAns.trim())
    play?.('correct')
  }

  const next = () => {
    if (idx + 1 >= questions.length) {
      const timeTaken = Math.round((Date.now() - startTime.current) / 1000)
      api.post(`/quizzes/${quiz.id}/submit`, {
        attempt_id: attemptId,
        answers,
        time_taken: timeTaken,
      }).then(r => {
        onFinish({ ...r.data, quiz })
      }).catch(() => {
        onFinish({ score: 0, passed: false, earned: 0, total: questions.length, xp_earned: 0, results: [], quiz })
      })
    } else {
      setIdx(i => i+1)
      setSel(null); setRev(false); setMulti([]); setTextAns('')
    }
  }

  if (loading) return (
    <div className="max-w-2xl mx-auto flex flex-col items-center justify-center py-24 gap-4">
      <div className="w-14 h-14 rounded-full border-4 border-indigo-500 border-t-transparent animate-spin"/>
      <p style={{color:'var(--text-muted)'}}>Loading quiz...</p>
    </div>
  )
  if (!q) return (
    <div className="max-w-2xl mx-auto text-center py-24">
      <AlertCircle className="w-12 h-12 mx-auto mb-4" style={{color:'var(--text-muted)'}}/>
      <p style={{color:'var(--text-muted)'}}>No questions found for this quiz.</p>
    </div>
  )

  const prog = idx / questions.length * 100
  const timerPct = timeLeft !== null ? timeLeft / totalTime * 100 : 100
  const tc = timerPct > 50 ? '#10b981' : timerPct > 25 ? '#f59e0b' : '#ef4444'

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-black text-base" style={{color:'var(--text)'}}>{quiz.title}</h2>
          <p className="text-sm" style={{color:'var(--text-muted)'}}>Question {idx+1} of {questions.length}</p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl"
          style={{background:'var(--card-bg)',border:'1px solid var(--border)'}}>
          <Star className="w-4 h-4 text-yellow-500"/>
          <span className="font-black text-sm" style={{color:'var(--text)'}}>{earnedRef.current} pts</span>
        </div>
      </div>

      {/* Progress */}
      <div className="h-2.5 rounded-full overflow-hidden" style={{background:'var(--border)'}}>
        <div className="h-full rounded-full transition-all duration-500"
          style={{width:`${prog}%`,background:'linear-gradient(90deg,#6366f1,#14b8a6)'}}/>
      </div>

      {/* Timer */}
      <div className="flex items-center gap-3">
        <Clock className="w-4 h-4 flex-shrink-0" style={{color:tc}}/>
        <div className="flex-1 h-2 rounded-full overflow-hidden" style={{background:'var(--border)'}}>
          <div className="h-full rounded-full transition-all duration-1000"
            style={{width:`${timerPct}%`,background:tc}}/>
        </div>
        <span className={`font-black text-base w-8 text-right tabular-nums ${timeLeft !== null && timeLeft <= 10 ? 'animate-pulse' : ''}`}
          style={{color:tc}}>
          {timeLeft ?? totalTime}
        </span>
      </div>

      {/* Question card */}
      <div className={`card p-6 ${shake ? 'animate-pulse' : ''} ${bounce ? 'scale-[1.01]' : ''} transition-transform`}>
        {/* Type badge */}
        <span className="inline-block text-xs font-bold px-2.5 py-1 rounded-full mb-4"
          style={{background:'#ede9fe',color:'#7c3aed'}}>
          {q.question_type==='mcq'?'🔘 Multiple Choice':q.question_type==='true_false'?'✅ True / False':q.question_type==='multiple_select'?'☑️ Select All':q.question_type==='short_answer'?'✏️ Short Answer':q.question_type==='fill_blank'?'📝 Fill in Blank':q.question_type==='numeric'?'🔢 Numeric':'📋 Question'}
        </span>

        {q.question_image && (
          <img src={q.question_image} alt="question" className="w-full max-h-64 object-contain rounded-xl mb-4 border"
            style={{borderColor:'var(--border)'}}/>
        )}

        <p className="text-base font-semibold mb-5 leading-relaxed" style={{color:'var(--text)'}}>
          {q.question_text}
        </p>

        {/* MCQ / True-False */}
        {(q.question_type==='mcq'||q.question_type==='true_false') && q.options && (
          <div className="grid gap-2.5">
            {q.options.map((opt, i) => (
              <button key={i} disabled={revealed} onClick={() => handleChoose(i)}
                className="flex items-center gap-3 p-3 rounded-xl text-sm text-left transition-all hover:scale-[1.01] active:scale-[0.99]"
                style={{
                  border: `2px solid ${revealed ? (i===selected ? '#6366f1' : 'var(--border)') : (i===selected ? '#6366f1' : 'var(--border)')}`,
                  background: revealed && i===selected ? 'rgba(99,102,241,0.08)' : i===selected ? 'rgba(99,102,241,0.06)' : 'var(--card-bg)',
                  color: 'var(--text)',
                  cursor: revealed ? 'default' : 'pointer',
                }}>
                <span className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                  style={{background:i===selected?'#6366f1':'var(--border)',color:i===selected?'white':'var(--text-muted)'}}>
                  {String.fromCharCode(65+i)}
                </span>
                <span className="flex-1">{opt}</span>
              </button>
            ))}
          </div>
        )}

        {/* Multi-select */}
        {q.question_type==='multiple_select' && q.options && (
          <div className="space-y-2.5">
            {q.options.map((opt, i) => {
              const checked = multiSel.includes(i)
              return (
                <label key={i} className="flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all"
                  style={{
                    border:`2px solid ${checked?'#8b5cf6':'var(--border)'}`,
                    background:checked?'rgba(139,92,246,0.06)':'var(--card-bg)',
                  }}>
                  <input type="checkbox" checked={checked} disabled={revealed}
                    onChange={() => !revealed && setMulti(prev => prev.includes(i) ? prev.filter(x=>x!==i) : [...prev,i])}
                    className="w-4 h-4" style={{accentColor:'#8b5cf6'}}/>
                  <span className="text-sm" style={{color:'var(--text)'}}>{opt}</span>
                </label>
              )
            })}
            {!revealed && (
              <button onClick={handleMultiSubmit} disabled={!multiSel.length}
                className="w-full py-2.5 rounded-xl text-sm font-bold text-white mt-2 disabled:opacity-40"
                style={{background:'linear-gradient(135deg,#8b5cf6,#6366f1)'}}>
                Submit Selection
              </button>
            )}
          </div>
        )}

        {/* Short answer / fill blank */}
        {(q.question_type==='short_answer'||q.question_type==='fill_blank') && (
          <div className="flex gap-2">
            <input value={textAns} disabled={revealed}
              onChange={e => setTextAns(e.target.value)}
              onKeyDown={e => e.key==='Enter' && !revealed && handleTextSubmit()}
              placeholder="Type your answer..."
              className="flex-1 px-3 py-2.5 rounded-xl text-sm"
              style={{background:'var(--page-bg)',border:'1.5px solid var(--border)',color:'var(--text)',outline:'none'}}/>
            {!revealed && (
              <button onClick={handleTextSubmit} disabled={!textAns.trim()}
                className="px-5 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-40"
                style={{background:'#6366f1'}}>
                Submit
              </button>
            )}
          </div>
        )}

        {/* Numeric */}
        {q.question_type==='numeric' && (
          <div className="flex gap-2">
            <input type="number" value={textAns} disabled={revealed}
              onChange={e => setTextAns(e.target.value)}
              onKeyDown={e => e.key==='Enter' && !revealed && handleTextSubmit()}
              placeholder="Enter a number..."
              className="flex-1 px-3 py-2.5 rounded-xl text-sm"
              style={{background:'var(--page-bg)',border:'1.5px solid var(--border)',color:'var(--text)',outline:'none'}}/>
            {!revealed && (
              <button onClick={handleTextSubmit} disabled={!textAns}
                className="px-5 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-40"
                style={{background:'#0ea5e9'}}>
                Submit
              </button>
            )}
          </div>
        )}

        {/* Timeout message */}
        {revealed && timeLeft === 0 && selected === null && !textAns && (
          <div className="flex items-center gap-2 mt-4 text-orange-500 font-semibold text-sm">
            <Clock className="w-4 h-4"/> Time's up!
          </div>
        )}

        {/* Explanation (shown after answer) */}
        {revealed && q.explanation && (
          <div className="mt-5 p-4 rounded-xl flex gap-3"
            style={{background:'linear-gradient(135deg,#eff6ff,#f0fdf4)',border:'1px solid #bfdbfe'}}>
            <span className="text-xl flex-shrink-0">💡</span>
            <div>
              <div className="font-bold text-sm mb-1 text-blue-800">Explanation</div>
              <p className="text-sm leading-relaxed text-blue-900">{q.explanation}</p>
            </div>
          </div>
        )}

        {/* Next / Finish button */}
        {revealed && (
          <div className="mt-4 flex justify-end">
            <button onClick={next}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-white text-sm"
              style={{background:'linear-gradient(135deg,#6366f1,#8b5cf6)'}}>
              {idx + 1 >= questions.length ? '🏁 See Results' : 'Next →'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Quiz Results ──────────────────────────────────────────────────────────────
function QuizResults({ result, onBack }) {
  const { play } = useSound()
  const [showReview, setReview] = useState(false)
  const pct    = result.score || 0
  const passed = result.passed

  useEffect(() => { play?.(passed ? 'levelUp' : 'wrong') }, [])

  const grade = pct >= 90 ? {l:'Outstanding!',e:'🏆',c:'#f59e0b'}
    : pct >= 75 ? {l:'Excellent!',e:'🥇',c:'#6366f1'}
    : pct >= 60 ? {l:'Good Job!',e:'🎉',c:'#10b981'}
    : pct >= 40 ? {l:'Keep Going!',e:'💪',c:'#f97316'}
    : {l:'Keep Studying!',e:'📚',c:'#64748b'}

  const results = result.results || []
  const correct = results.filter(r => r.is_correct).length

  return (
    <>
      {passed && <Confetti/>}
      <div className="max-w-xl mx-auto space-y-5 py-4">
        {/* Score card */}
        <div className="card p-8 text-center relative overflow-hidden">
          <div className="absolute inset-0 opacity-5" style={{background:`radial-gradient(circle at 50% 50%,${grade.c},transparent)`}}/>
          <div className="text-6xl mb-2">{grade.e}</div>
          <h2 className="text-2xl font-black mb-1" style={{color:grade.c}}>{grade.l}</h2>
          <p className="text-sm mb-6" style={{color:'var(--text-muted)'}}>{result.quiz?.title}</p>

          {/* Score ring */}
          <div className="relative w-28 h-28 mx-auto mb-6">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
              <circle cx="18" cy="18" r="15.9" fill="none" stroke="var(--border)" strokeWidth="3"/>
              <circle cx="18" cy="18" r="15.9" fill="none" strokeWidth="3"
                stroke={grade.c}
                strokeDasharray={`${pct} ${100-pct}`}
                strokeLinecap="round"/>
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-2xl font-black" style={{color:grade.c}}>{pct}%</span>
              <span className="text-xs" style={{color:'var(--text-muted)'}}>score</span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 mb-5">
            {[{i:'✅',l:'Correct',v:correct,c:'#10b981'},{i:'❌',l:'Wrong',v:results.length-correct,c:'#ef4444'},{i:'⭐',l:'XP Earned',v:`+${result.xp_earned||0}`,c:'#f59e0b'}].map(s => (
              <div key={s.l} className="rounded-xl p-3" style={{background:'var(--page-bg)'}}>
                <div className="text-xl mb-0.5">{s.i}</div>
                <div className="text-lg font-black" style={{color:s.c}}>{s.v}</div>
                <div className="text-xs" style={{color:'var(--text-muted)'}}>{s.l}</div>
              </div>
            ))}
          </div>

          {passed ? (
            <div className="flex items-center justify-center gap-2 text-green-600 font-semibold text-sm">
              <CheckCircle className="w-4 h-4"/> Quiz passed!
            </div>
          ) : (
            <div className="flex items-center justify-center gap-2 text-orange-500 font-semibold text-sm">
              <BookOpen className="w-4 h-4"/> Review and try again. Pass score: {result.quiz?.pass_score||70}%
            </div>
          )}
        </div>

        {/* Per-question review */}
        {results.length > 0 && (
          <div className="card overflow-hidden">
            <button className="w-full flex items-center justify-between px-5 py-4"
              onClick={() => setReview(v => !v)}>
              <span className="font-bold" style={{color:'var(--text)'}}>Question Review</span>
              {showReview ? <ChevronUp className="w-4 h-4"/> : <ChevronDown className="w-4 h-4"/>}
            </button>
            {showReview && (
              <div className="border-t" style={{borderColor:'var(--border)'}}>
                {results.map((r, i) => (
                  <div key={i} className="px-5 py-4 border-b last:border-0" style={{borderColor:'var(--border)'}}>
                    <div className="flex items-start gap-3">
                      <div className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center mt-0.5 ${r.is_correct ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-500'}`}>
                        {r.is_correct ? <CheckCircle className="w-4 h-4"/> : <XCircle className="w-4 h-4"/>}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold mb-2" style={{color:'var(--text)'}}>{r.question_text}</p>
                        {r.options && r.correct_answers && (
                          <div className="flex flex-wrap gap-2 mb-2">
                            {r.options.map((opt, oi) => {
                              const isCorrect = r.correct_answers.includes(oi)
                              const isUser = r.user_answer !== undefined && r.user_answer !== null &&
                                (r.user_answer === oi || +r.user_answer === oi)
                              return (
                                <span key={oi} className="text-xs px-2 py-0.5 rounded-full"
                                  style={{
                                    background: isCorrect ? '#f0fdf4' : isUser && !isCorrect ? '#fef2f2' : 'var(--page-bg)',
                                    color: isCorrect ? '#10b981' : isUser && !isCorrect ? '#ef4444' : 'var(--text-muted)',
                                    fontWeight: isCorrect || isUser ? 700 : 400,
                                    border: `1px solid ${isCorrect ? '#bbf7d0' : isUser && !isCorrect ? '#fecaca' : 'var(--border)'}`,
                                  }}>
                                  {isCorrect ? '✓ ' : isUser && !isCorrect ? '✗ ' : ''}{opt}
                                </span>
                              )
                            })}
                          </div>
                        )}
                        {r.explanation && (
                          <p className="text-xs text-blue-700" style={{background:'#eff6ff',padding:'6px 10px',borderRadius:8}}>
                            💡 {r.explanation}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="flex gap-3">
          <button onClick={onBack}
            className="flex-1 py-3 rounded-xl font-bold text-sm border transition-all hover:opacity-80"
            style={{background:'var(--card-bg)',color:'var(--text)',borderColor:'var(--border)'}}>
            <RotateCcw className="w-4 h-4 inline mr-1"/> Try Another
          </button>
          <button onClick={onBack}
            className="flex-1 py-3 rounded-xl font-bold text-sm text-white"
            style={{background:'linear-gradient(135deg,#6366f1,#8b5cf6)'}}>
            <Trophy className="w-4 h-4 inline mr-1"/> Back to Quizzes
          </button>
        </div>
      </div>
    </>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function QuizMe() {
  const [phase, setPhase]   = useState('browse')  // browse | play | result
  const [quiz, setQuiz]     = useState(null)
  const [result, setResult] = useState(null)

  return (
    <div className="max-w-4xl mx-auto px-0 md:px-4">
      {phase === 'browse' && (
        <QuizBrowser onStart={q => { setQuiz(q); setPhase('play') }}/>
      )}
      {phase === 'play' && quiz && (
        <QuizPlayer quiz={quiz} onFinish={r => { setResult(r); setPhase('result') }}/>
      )}
      {phase === 'result' && result && (
        <QuizResults result={result} onBack={() => { setPhase('browse'); setResult(null) }}/>
      )}
    </div>
  )
}
