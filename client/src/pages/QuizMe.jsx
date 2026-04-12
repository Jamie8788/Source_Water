/**
 * QuizMe — Brightspace/Canvas-level quiz platform
 * Browse → Confirm (study mode toggle) → Full-screen Play → Results
 */
import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useSound } from '../context/SoundContext'
import api from '../utils/api'
import {
  Clock, Trophy, Star, CheckCircle, XCircle, RotateCcw, Zap, BookOpen,
  Search, Flag, ChevronDown, ChevronUp, AlertCircle, Play, X, Target,
  Award, GraduationCap, ChevronLeft, ChevronRight, Settings2, Eye,
  BookMarked, BarChart2, Edit3, PlusCircle
} from 'lucide-react'

// ── Confetti ──────────────────────────────────────────────────────────────────
function Confetti() {
  const ref = useRef(null)
  useEffect(() => {
    const c = ref.current; if (!c) return
    const ctx = c.getContext('2d')
    c.width = window.innerWidth; c.height = window.innerHeight
    const P = Array.from({ length: 160 }, (_, i) => ({
      x: Math.random() * c.width, y: -20 - Math.random() * 300,
      r: Math.random() * 8 + 3,
      col: ['#6366f1','#14b8a6','#f59e0b','#ec4899','#10b981','#0ea5e9','#f97316'][i % 7],
      vx: (Math.random() - .5) * 6, vy: Math.random() * 4 + 2,
      rot: Math.random() * 360, vr: (Math.random() - .5) * 8,
    }))
    let frame = 0
    const go = () => {
      if (frame++ > 280) return
      ctx.clearRect(0, 0, c.width, c.height)
      P.forEach(p => {
        p.x += p.vx; p.y += p.vy; p.vy += 0.06; p.rot += p.vr
        if (p.y > c.height) { p.y = -20; p.x = Math.random() * c.width }
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot * Math.PI / 180)
        ctx.fillStyle = p.col; ctx.globalAlpha = Math.max(0, 1 - frame / 280)
        ctx.fillRect(-p.r, -p.r / 2, p.r * 2, p.r); ctx.restore()
      })
      requestAnimationFrame(go)
    }
    go()
  }, [])
  return <canvas ref={ref} style={{ position:'fixed', inset:0, pointerEvents:'none', zIndex:9999 }}/>
}

// ── Constants ─────────────────────────────────────────────────────────────────
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
const catGrad = (cat) => CAT_GRAD[cat] || CAT_GRAD[Object.keys(CAT_GRAD).find(k => k.toLowerCase() === (cat||'').toLowerCase())] || 'linear-gradient(135deg,#6366f1,#8b5cf6)'
const normDiff = s => s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : 'Beginner'
const fmtTime = s => `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`
const CREATOR_ROLES = ['Teacher', 'Professor', 'Researcher', 'SOURCE Water team member']

// ── Quiz Browser ──────────────────────────────────────────────────────────────
function QuizBrowser({ onSelect }) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [quizzes, setQuizzes]   = useState([])
  const [progress, setProgress] = useState([])
  const [loading, setLoading]   = useState(true)
  const [search, setSearch]     = useState('')
  const [diffFilter, setDiff]   = useState('All')
  const [catFilter, setCat]     = useState('All')
  const [showHistory, setShow]  = useState(false)
  const isCreator = user?.is_admin || CREATOR_ROLES.includes(user?.role)

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
    if (diffFilter !== 'All' && normDiff(q.difficulty) !== diffFilter) return false
    if (search && !q.title.toLowerCase().includes(search.toLowerCase()) && !(q.description||'').toLowerCase().includes(search.toLowerCase())) return false
    return true
  })
  const totalAttempts = progress.length
  const avgScore      = totalAttempts ? Math.round(progress.reduce((s,a) => s+(a.score||0),0)/totalAttempts) : 0
  const totalPassed   = progress.filter(a => a.passed).length

  if (loading) return (
    <div className="space-y-4">
      {[1,2,3].map(i => <div key={i} className="card p-5 h-40" style={{background:'var(--card-bg)',animation:'pulse 1.5s infinite'}}/>)}
    </div>
  )

  return (
    <div className="space-y-5 pb-8">
      {/* Hero */}
      <div className="rounded-2xl p-7 text-white relative overflow-hidden"
        style={{background:'linear-gradient(135deg,#4f46e5,#7c3aed,#ec4899)'}}>
        <div className="absolute -right-12 -top-12 w-52 h-52 rounded-full bg-white/5"/>
        <div className="absolute right-24 -bottom-6 w-36 h-36 rounded-full bg-white/5"/>
        <div className="relative">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Zap className="w-4 h-4 text-yellow-300"/>
                <span className="text-yellow-300 font-bold text-xs tracking-widest">WATER KNOWLEDGE CHALLENGE</span>
              </div>
              <h1 className="text-3xl font-black mb-1">Quiz & Learn 🧠</h1>
              <p className="text-white/70 text-sm">Master water science. Earn XP. Climb the leaderboard.</p>
            </div>
            {isCreator && (
              <button onClick={() => navigate('/quiz-admin')}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all hover:scale-105"
                style={{background:'rgba(255,255,255,0.15)',border:'1.5px solid rgba(255,255,255,0.3)',backdropFilter:'blur(4px)'}}>
                <Edit3 className="w-4 h-4"/>
                Manage Quizzes
              </button>
            )}
          </div>
          <div className="flex gap-6 flex-wrap mt-5">
            {[{l:'Available',v:quizzes.length},{l:'My Attempts',v:totalAttempts},{l:'Avg Score',v:totalAttempts?`${avgScore}%`:'—'},{l:'Passed',v:totalPassed}].map(s => (
              <div key={s.l} className="text-center">
                <div className="text-2xl font-black">{s.v}</div>
                <div className="text-xs text-white/60">{s.l}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* History */}
      {progress.length > 0 && (
        <div className="card overflow-hidden">
          <button className="w-full flex items-center justify-between px-5 py-4" onClick={() => setShow(v => !v)}>
            <div className="flex items-center gap-3">
              <Trophy className="w-5 h-5 text-amber-500"/>
              <span className="font-bold" style={{color:'var(--text)'}}>My History</span>
              <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{background:'rgba(99,102,241,0.1)',color:'#6366f1'}}>{totalAttempts}</span>
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
                  <div key={i} className="flex items-center justify-between px-3 py-2 rounded-xl text-sm" style={{background:'var(--page-bg)'}}>
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
          <p style={{color:'var(--text-muted)'}}>{quizzes.length === 0 ? 'No quizzes available yet.' : 'No quizzes match your filters.'}</p>
          {isCreator && quizzes.length === 0 && (
            <button onClick={() => navigate('/quiz-admin')} className="mt-4 px-5 py-2.5 rounded-xl font-bold text-white text-sm" style={{background:'linear-gradient(135deg,#6366f1,#4f46e5)'}}>
              Create First Quiz
            </button>
          )}
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {visible.map(q => {
            const cat  = (q.category||'general').replace(/_/g,' ')
            const diff = DIFF[normDiff(q.difficulty)] || DIFF.Beginner
            const grad = catGrad(cat)
            const my   = myStats[q.id]
            return (
              <div key={q.id} className="card overflow-hidden group hover:shadow-xl hover:-translate-y-1 transition-all duration-200 cursor-pointer"
                onClick={() => onSelect(q)}>
                <div style={{height:5,background:grad}}/>
                <div className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div className="w-11 h-11 rounded-xl flex items-center justify-center text-xl" style={{background:grad}}>
                      {diff.icon}
                    </div>
                    <span className="text-xs font-bold px-2.5 py-1 rounded-full"
                      style={{background:diff.bg,color:diff.color,border:`1px solid ${diff.border}`}}>
                      {normDiff(q.difficulty)}
                    </span>
                  </div>
                  <h3 className="font-black text-sm mb-1" style={{color:'var(--text)'}}>{q.title}</h3>
                  <p className="text-xs mb-4 line-clamp-2" style={{color:'var(--text-muted)'}}>{q.description||cat}</p>
                  <div className="flex items-center justify-between text-xs mb-4" style={{color:'var(--text-muted)'}}>
                    <div className="flex gap-3">
                      <span>❓ {q.question_count||0}q</span>
                      <span>⏱ {q.time_per_question||60}s</span>
                      {q.attempt_count > 0 && <span>👥 {q.attempt_count}</span>}
                      {q.pass_score && <span>✓ {q.pass_score}%</span>}
                    </div>
                    {my && <span className="font-bold" style={{color:my.passed>0?'#10b981':'#f59e0b'}}>{my.passed>0?'✓ ':''}Best: {my.best}%</span>}
                  </div>
                  <div className="w-full py-2.5 rounded-xl text-xs font-bold text-white text-center flex items-center justify-center gap-2"
                    style={{background:grad}}>
                    <Play className="w-3 h-3 fill-current"/>
                    {my ? 'Retake Quiz' : 'Start Quiz'}
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

// ── Quiz Confirm (pre-start screen) ──────────────────────────────────────────
function QuizConfirm({ quiz, onStart, onBack }) {
  const [studyMode, setStudyMode] = useState(false)
  const cat   = (quiz.category||'general').replace(/_/g,' ')
  const diff  = DIFF[normDiff(quiz.difficulty)] || DIFF.Beginner
  const grad  = catGrad(cat)
  const qTime = quiz.time_per_question || 60
  const limit = quiz.time_limit > 0 ? `${quiz.time_limit} min total` : `${qTime}s per question`

  return (
    <div className="max-w-xl mx-auto py-8">
      {/* Back */}
      <button onClick={onBack} className="flex items-center gap-2 mb-6 text-sm font-medium hover:opacity-70 transition-opacity"
        style={{color:'var(--text-muted)'}}>
        <ChevronLeft className="w-4 h-4"/> Back to quizzes
      </button>

      {/* Card */}
      <div className="card overflow-hidden">
        <div style={{height:6,background:grad}}/>
        <div className="p-8">
          {/* Header */}
          <div className="flex items-start gap-4 mb-6">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl flex-shrink-0" style={{background:grad}}>
              {diff.icon}
            </div>
            <div className="flex-1">
              <h1 className="text-xl font-black mb-1" style={{color:'var(--text)'}}>{quiz.title}</h1>
              <p className="text-sm mb-3" style={{color:'var(--text-muted)'}}>{quiz.description||cat}</p>
              <div className="flex gap-2 flex-wrap">
                <span className="text-xs font-bold px-2.5 py-1 rounded-full" style={{background:diff.bg,color:diff.color,border:`1px solid ${diff.border}`}}>{normDiff(quiz.difficulty)}</span>
                <span className="text-xs font-bold px-2.5 py-1 rounded-full" style={{background:'rgba(99,102,241,0.1)',color:'#6366f1'}}>{cat}</span>
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-3 mb-6">
            {[
              {icon:'❓',l:'Questions',v:quiz.question_count||'?'},
              {icon:'⏱',l:'Timer',v:limit},
              {icon:'🎯',l:'Pass Score',v:`${quiz.pass_score||70}%`},
            ].map(s => (
              <div key={s.l} className="rounded-xl p-3 text-center" style={{background:'var(--page-bg)',border:'1px solid var(--border)'}}>
                <div className="text-xl mb-1">{s.icon}</div>
                <div className="font-black text-sm" style={{color:'var(--text)'}}>{s.v}</div>
                <div className="text-xs" style={{color:'var(--text-muted)'}}>{s.l}</div>
              </div>
            ))}
          </div>

          {/* Study Mode Toggle */}
          <div className="rounded-2xl p-5 mb-6" style={{background:'var(--page-bg)',border:`2px solid ${studyMode ? '#6366f1' : 'var(--border)'}`}}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{background:studyMode?'rgba(99,102,241,0.1)':'var(--card-bg)'}}>
                  <BookMarked className="w-5 h-5" style={{color:studyMode?'#6366f1':'var(--text-muted)'}}/>
                </div>
                <div>
                  <div className="font-bold text-sm" style={{color:'var(--text)'}}>Study Mode</div>
                  <div className="text-xs" style={{color:'var(--text-muted)'}}>See correct answers immediately after each selection. No timer pressure.</div>
                </div>
              </div>
              <button onClick={() => setStudyMode(v => !v)}
                className="relative w-12 h-6 rounded-full transition-all flex-shrink-0"
                style={{background:studyMode?'#6366f1':'var(--border)'}}>
                <span className="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform"
                  style={{transform:studyMode?'translateX(24px)':'translateX(0)'}}/>
              </button>
            </div>
            {studyMode && (
              <div className="mt-3 pt-3 border-t text-xs" style={{borderColor:'rgba(99,102,241,0.2)',color:'#6366f1'}}>
                ✓ Immediate feedback &nbsp;·&nbsp; ✓ Explanations shown &nbsp;·&nbsp; ✓ No time pressure &nbsp;·&nbsp; ✓ Attempt still recorded
              </div>
            )}
          </div>

          {/* Start button */}
          <button onClick={() => onStart(studyMode)}
            className="w-full py-4 rounded-2xl font-black text-white text-base flex items-center justify-center gap-3 hover:opacity-90 hover:scale-[1.01] transition-all"
            style={{background:grad,boxShadow:`0 8px 24px rgba(99,102,241,0.3)`}}>
            <Play className="w-5 h-5 fill-white"/>
            {studyMode ? 'Start Study Session' : 'Start Quiz'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Question Navigator Sidebar ────────────────────────────────────────────────
function QNavigator({ questions, current, answers, flagged, onNavigate }) {
  const getStyle = (q, idx) => {
    const isAnswered = answers[q.id] !== undefined && answers[q.id] !== null && answers[q.id] !== ''
    const isFlagged  = flagged.has(q.id)
    const isCurrent  = idx === current
    if (isCurrent)  return { background:'#4f46e5', color:'white', boxShadow:'0 0 0 3px rgba(99,102,241,0.4)' }
    if (isFlagged)  return { background:'#d97706', color:'white' }
    if (isAnswered) return { background:'#6366f1', color:'white' }
    return { background:'rgba(255,255,255,0.05)', color:'#94a3b8', border:'1px solid rgba(255,255,255,0.08)' }
  }

  const answered = questions.filter(q => answers[q.id] !== undefined && answers[q.id] !== null && answers[q.id] !== '').length
  const flaggedCount = flagged.size

  return (
    <div className="h-full flex flex-col">
      {/* Stats */}
      <div className="p-3 border-b" style={{borderColor:'rgba(255,255,255,0.08)'}}>
        <div className="text-xs font-bold mb-2" style={{color:'#94a3b8'}}>QUESTIONS</div>
        <div className="flex gap-2 text-xs" style={{color:'#64748b'}}>
          <span style={{color:'#6366f1'}}>■</span> {answered} answered
          {flaggedCount > 0 && <><span style={{color:'#d97706'}}>■</span> {flaggedCount} flagged</>}
        </div>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto p-3">
        <div className="grid gap-1.5" style={{gridTemplateColumns:'repeat(4,1fr)'}}>
          {questions.map((q, idx) => (
            <button key={q.id} onClick={() => onNavigate(idx)}
              className="w-full aspect-square rounded-lg text-xs font-bold flex items-center justify-center transition-all hover:opacity-80"
              style={getStyle(q, idx)}>
              {idx + 1}
            </button>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="p-3 border-t text-xs space-y-1.5" style={{borderColor:'rgba(255,255,255,0.08)',color:'#64748b'}}>
        {[
          { col:'#4f46e5', l:'Current' },
          { col:'#6366f1', l:'Answered' },
          { col:'#d97706', l:'Flagged' },
          { col:'rgba(255,255,255,0.05)', l:'Not answered', border:'1px solid rgba(255,255,255,0.08)' },
        ].map(i => (
          <div key={i.l} className="flex items-center gap-2">
            <span className="w-3 h-3 rounded flex-shrink-0" style={{background:i.col,border:i.border}}/>
            {i.l}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Submit Modal ──────────────────────────────────────────────────────────────
function SubmitModal({ questions, answers, flagged, onConfirm, onCancel, submitting }) {
  const answered  = questions.filter(q => answers[q.id] !== undefined && answers[q.id] !== null && answers[q.id] !== '').length
  const unanswered = questions.length - answered
  const flaggedC   = flagged.size

  return (
    <div className="fixed inset-0 flex items-center justify-center z-[200]" style={{background:'rgba(0,0,0,0.7)'}}>
      <div className="rounded-2xl p-8 max-w-sm w-full mx-4 shadow-2xl" style={{background:'var(--card-bg)',border:'1px solid var(--border)'}}>
        <div className="text-center mb-6">
          <div className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center" style={{background:'rgba(99,102,241,0.1)'}}>
            <CheckCircle className="w-8 h-8" style={{color:'#6366f1'}}/>
          </div>
          <h2 className="text-xl font-black mb-2" style={{color:'var(--text)'}}>Submit Quiz?</h2>
          <p className="text-sm" style={{color:'var(--text-muted)'}}>Your attempt will be recorded and graded.</p>
        </div>
        <div className="space-y-2 mb-6">
          <div className="flex items-center justify-between px-4 py-2.5 rounded-xl" style={{background:'var(--page-bg)'}}>
            <span className="text-sm" style={{color:'var(--text)'}}>Answered</span>
            <span className="font-black text-sm" style={{color:'#10b981'}}>{answered}/{questions.length}</span>
          </div>
          {unanswered > 0 && (
            <div className="flex items-center justify-between px-4 py-2.5 rounded-xl" style={{background:'#fef3c7'}}>
              <span className="text-sm font-medium" style={{color:'#92400e'}}>⚠ Unanswered</span>
              <span className="font-black text-sm" style={{color:'#d97706'}}>{unanswered}</span>
            </div>
          )}
          {flaggedC > 0 && (
            <div className="flex items-center justify-between px-4 py-2.5 rounded-xl" style={{background:'#fffbeb'}}>
              <span className="text-sm font-medium" style={{color:'#92400e'}}>⚑ Flagged for review</span>
              <span className="font-black text-sm" style={{color:'#d97706'}}>{flaggedC}</span>
            </div>
          )}
        </div>
        <div className="flex gap-3">
          <button onClick={onCancel} disabled={submitting}
            className="flex-1 py-3 rounded-xl font-bold text-sm transition-all hover:opacity-80"
            style={{background:'var(--page-bg)',color:'var(--text)',border:'1px solid var(--border)'}}>
            Keep Going
          </button>
          <button onClick={onConfirm} disabled={submitting}
            className="flex-1 py-3 rounded-xl font-black text-white text-sm transition-all hover:opacity-90"
            style={{background:'linear-gradient(135deg,#6366f1,#4f46e5)'}}>
            {submitting ? 'Submitting...' : 'Submit Quiz'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Full-screen Quiz Player ───────────────────────────────────────────────────
function QuizPlayer({ quiz, studyMode, onFinish }) {
  const { play } = useSound()
  const [questions, setQs]       = useState([])
  const [attemptId, setAid]      = useState(null)
  const [loading, setLoad]       = useState(true)
  const [current, setCurrent]    = useState(0)
  const [answers, setAnswers]    = useState({})
  const [multiSel, setMultiSel]  = useState({})       // {qId: [idx...]}
  const [textAns, setTextAns]    = useState({})        // {qId: string}
  const [flagged, setFlagged]    = useState(new Set())
  const [revealed, setRevealed]  = useState(new Set()) // study mode: answered Qs
  const [totalSecs, setTotal]    = useState(0)
  const [qSecs, setQSecs]        = useState(null)
  const [showSubmit, setShowSub] = useState(false)
  const [submitting, setSub]     = useState(false)
  const [showExitModal, setShowExit] = useState(false)
  const totalRef  = useRef(null)
  const qRef      = useRef(null)
  const startRef  = useRef(Date.now())
  const sideRef   = useRef(null)

  // Load
  useEffect(() => {
    api.post(`/quizzes/${quiz.id}/start`, { study_mode: studyMode }).then(r => {
      setQs(r.data.questions || [])
      setAid(r.data.attempt_id)
      if (quiz.time_limit > 0) setTotal(quiz.time_limit * 60)
      setLoad(false)
    }).catch(() => setLoad(false))
    return () => { clearInterval(totalRef.current); clearInterval(qRef.current) }
  }, [])

  // Total timer
  useEffect(() => {
    if (!quiz.time_limit || quiz.time_limit <= 0 || loading) return
    clearInterval(totalRef.current)
    totalRef.current = setInterval(() => {
      setTotal(t => {
        if (t <= 1) { clearInterval(totalRef.current); doSubmit(); return 0 }
        return t - 1
      })
    }, 1000)
    return () => clearInterval(totalRef.current)
  }, [loading])

  // Per-question timer
  useEffect(() => {
    if (loading || studyMode || questions.length === 0) return
    const q = questions[current]
    if (!q || revealed.has(q.id)) return
    clearInterval(qRef.current)
    setQSecs(quiz.time_per_question || 60)
    qRef.current = setInterval(() => {
      setQSecs(t => {
        if (t <= 1) {
          clearInterval(qRef.current)
          // Auto-advance on timeout
          setRevealed(prev => new Set([...prev, q.id]))
          setTimeout(() => setCurrent(c => Math.min(c + 1, questions.length - 1)), 600)
          return 0
        }
        return t - 1
      })
    }, 1000)
    return () => clearInterval(qRef.current)
  }, [current, loading, questions.length])

  // Keyboard shortcuts
  useEffect(() => {
    const handler = e => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return
      const q = questions[current]
      if (!q) return
      if (e.key === 'ArrowRight' || e.key === 'l') nav(current + 1)
      else if (e.key === 'ArrowLeft' || e.key === 'h') nav(current - 1)
      else if ((e.key === 'f' || e.key === 'F') && !e.ctrlKey) toggleFlag(q.id)
      else if (e.key === 'Enter' && (revealed.has(q.id) || studyMode)) nav(current + 1)
      else if (['1','2','3','4','5','6'].includes(e.key)) {
        const i = parseInt(e.key) - 1
        if (q.options?.length > i && !revealed.has(q.id)) handleMCQAnswer(q, i)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [current, questions, revealed])

  const nav = useCallback(i => {
    if (i >= 0 && i < questions.length) {
      setCurrent(i)
      // Scroll sidebar nav button into view
      setTimeout(() => {
        const btn = sideRef.current?.querySelector(`[data-qidx="${i}"]`)
        btn?.scrollIntoView({ block:'nearest', behavior:'smooth' })
      }, 50)
    }
  }, [questions.length])

  const toggleFlag = useCallback(qId => {
    setFlagged(prev => { const s = new Set(prev); s.has(qId) ? s.delete(qId) : s.add(qId); return s })
  }, [])

  const recordAnswer = (qId, answer) => {
    setAnswers(prev => ({ ...prev, [qId]: answer }))
    if (studyMode) {
      clearInterval(qRef.current)
      setRevealed(prev => new Set([...prev, qId]))
    } else {
      clearInterval(qRef.current)
      setRevealed(prev => new Set([...prev, qId]))
    }
  }

  const handleMCQAnswer = (q, i) => {
    if (revealed.has(q.id)) return
    recordAnswer(q.id, i)
    play?.('correct')
  }

  const handleMultiToggle = (q, i) => {
    if (revealed.has(q.id)) return
    setMultiSel(prev => {
      const cur = prev[q.id] || []
      return { ...prev, [q.id]: cur.includes(i) ? cur.filter(x => x !== i) : [...cur, i] }
    })
  }

  const handleMultiSubmit = q => {
    if (revealed.has(q.id)) return
    const sel = multiSel[q.id] || []
    if (!sel.length) return
    recordAnswer(q.id, sel)
  }

  const handleText = (q) => {
    const v = textAns[q.id]?.trim()
    if (!v) return
    recordAnswer(q.id, v)
  }

  const doSubmit = async () => {
    setSub(true)
    clearInterval(totalRef.current); clearInterval(qRef.current)
    const timeTaken = Math.round((Date.now() - startRef.current) / 1000)
    // Build answers including any pending multi/text
    const finalAnswers = { ...answers }
    Object.entries(multiSel).forEach(([qId, sel]) => { if (sel.length && !finalAnswers[qId]) finalAnswers[qId] = sel })
    Object.entries(textAns).forEach(([qId, v]) => { if (v?.trim() && !finalAnswers[qId]) finalAnswers[qId] = v.trim() })
    try {
      const r = await api.post(`/quizzes/${quiz.id}/submit`, { attempt_id: attemptId, answers: finalAnswers, time_taken: timeTaken })
      onFinish({ ...r.data, quiz })
    } catch {
      onFinish({ score:0, passed:false, earned:0, total:questions.length, xp_earned:0, results:[], quiz })
    }
  }

  if (loading) return (
    <div style={{position:'fixed',inset:0,zIndex:100,display:'flex',alignItems:'center',justifyContent:'center',background:'var(--page-bg)'}}>
      <div style={{textAlign:'center'}}>
        <div className="w-16 h-16 rounded-full border-4 border-indigo-500 border-t-transparent animate-spin mx-auto mb-4"/>
        <p style={{color:'var(--text-muted)'}}>Loading quiz...</p>
      </div>
    </div>
  )

  if (questions.length === 0) return (
    <div style={{position:'fixed',inset:0,zIndex:100,display:'flex',alignItems:'center',justifyContent:'center',background:'var(--page-bg)'}}>
      <div style={{textAlign:'center'}}>
        <AlertCircle className="w-12 h-12 mx-auto mb-4" style={{color:'var(--text-muted)'}}/>
        <p style={{color:'var(--text-muted)'}}>No questions found for this quiz.</p>
      </div>
    </div>
  )

  const q = questions[current]
  const isAnswered = qId => answers[qId] !== undefined && answers[qId] !== null && answers[qId] !== ''
  const qTimePct   = qSecs !== null ? qSecs / (quiz.time_per_question || 60) * 100 : 100
  const qTC        = qTimePct > 50 ? '#10b981' : qTimePct > 20 ? '#f59e0b' : '#ef4444'
  const ttPct      = totalSecs > 0 ? totalSecs / (quiz.time_limit * 60) * 100 : 0
  const allDone    = questions.every(q => isAnswered(q.id))

  return (
    <div style={{position:'fixed',inset:0,zIndex:100,display:'flex',flexDirection:'column',background:'var(--page-bg)'}}>
      {/* ── Header ── */}
      <div style={{
        height:56,flexShrink:0,display:'flex',alignItems:'center',gap:12,padding:'0 16px',
        background:'linear-gradient(180deg,#060e1d,#0a1628)',
        borderBottom:'1px solid rgba(255,255,255,0.08)',zIndex:10
      }}>
        <button onClick={() => setShowExit(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all hover:bg-white/10"
          style={{color:'#94a3b8'}}>
          <ChevronLeft className="w-4 h-4"/> Exit
        </button>
        <div className="flex-1 min-w-0">
          <div className="font-bold text-sm truncate" style={{color:'#e2e8f0'}}>{quiz.title}</div>
          {studyMode && <div className="text-xs" style={{color:'#6366f1'}}>📖 Study Mode</div>}
        </div>
        <div className="flex items-center gap-4 flex-shrink-0">
          {quiz.time_limit > 0 && (
            <div className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" style={{color:ttPct < 20 ? '#ef4444' : '#94a3b8'}}/>
              <span className={`font-black text-sm tabular-nums ${ttPct < 20 ? 'text-red-400' : ''}`} style={{color:ttPct<20?'#ef4444':'#e2e8f0'}}>
                {fmtTime(totalSecs)}
              </span>
            </div>
          )}
          <div className="text-sm" style={{color:'#64748b'}}>
            <span style={{color:'#e2e8f0',fontWeight:700}}>{current+1}</span>/{questions.length}
          </div>
          <button onClick={() => setShowSub(true)}
            className="hidden sm:flex items-center gap-2 px-4 py-1.5 rounded-lg font-bold text-xs text-white transition-all hover:opacity-90"
            style={{background:'linear-gradient(135deg,#6366f1,#4f46e5)'}}>
            <CheckCircle className="w-3.5 h-3.5"/> Submit
          </button>
        </div>
      </div>

      {/* ── Body ── */}
      <div style={{flex:1,display:'flex',overflow:'hidden'}}>
        {/* Sidebar */}
        <div ref={sideRef} style={{
          width:200,flexShrink:0,overflow:'hidden',display:'flex',flexDirection:'column',
          background:'#060e1d',borderRight:'1px solid rgba(255,255,255,0.06)',
        }}>
          <QNavigator questions={questions} current={current} answers={answers} flagged={flagged} onNavigate={nav}/>
        </div>

        {/* Main question area */}
        <div style={{flex:1,overflowY:'auto',padding:'0'}}>
          <div style={{maxWidth:720,margin:'0 auto',padding:'24px 24px 120px'}}>
            {/* Q header */}
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16,flexWrap:'wrap',gap:8}}>
              <div style={{display:'flex',alignItems:'center',gap:8}}>
                <span style={{
                  fontSize:11,fontWeight:700,padding:'3px 10px',borderRadius:99,
                  background:'rgba(99,102,241,0.12)',color:'#818cf8'
                }}>
                  {q.question_type==='mcq'?'Multiple Choice':q.question_type==='true_false'?'True / False':q.question_type==='multiple_select'?'Multi-Select':q.question_type==='short_answer'?'Short Answer':q.question_type==='fill_blank'?'Fill in Blank':'Numeric'}
                </span>
                <span style={{fontSize:11,color:'#64748b'}}>· {q.points||1} pt{(q.points||1)!==1?'s':''}</span>
              </div>
              <div style={{display:'flex',alignItems:'center',gap:8}}>
                {!studyMode && qSecs !== null && !revealed.has(q.id) && (
                  <div style={{display:'flex',alignItems:'center',gap:6}}>
                    <div style={{width:60,height:4,borderRadius:99,background:'rgba(255,255,255,0.1)',overflow:'hidden'}}>
                      <div style={{height:'100%',borderRadius:99,background:qTC,width:`${qTimePct}%`,transition:'width 1s linear'}}/>
                    </div>
                    <span className={`font-black tabular-nums text-sm ${qSecs<=10?'animate-pulse':''}`} style={{color:qTC,minWidth:28}}>{qSecs}s</span>
                  </div>
                )}
                <button onClick={() => toggleFlag(q.id)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all hover:scale-105"
                  style={{
                    background:flagged.has(q.id)?'rgba(217,119,6,0.15)':'rgba(255,255,255,0.05)',
                    color:flagged.has(q.id)?'#f59e0b':'#64748b',
                    border:`1px solid ${flagged.has(q.id)?'rgba(217,119,6,0.3)':'rgba(255,255,255,0.06)'}`,
                  }}>
                  <Flag className="w-3.5 h-3.5"/> {flagged.has(q.id)?'Flagged':'Flag'}
                </button>
              </div>
            </div>

            {/* Question image */}
            {q.question_image && (
              <img src={q.question_image} alt="question visual" className="w-full max-h-72 object-contain rounded-xl mb-5 border" style={{borderColor:'var(--border)'}}/>
            )}

            {/* Question text */}
            <p style={{fontSize:16,fontWeight:600,lineHeight:1.7,color:'var(--text)',marginBottom:24}}>{q.question_text}</p>

            {/* MCQ / True-False */}
            {(q.question_type==='mcq'||q.question_type==='true_false') && q.options && (
              <div style={{display:'flex',flexDirection:'column',gap:10}}>
                {q.options.map((opt, i) => {
                  const isSelected    = answers[q.id]===i || answers[q.id]===String(i)
                  const isRevd        = revealed.has(q.id)
                  const isCorrectAns  = studyMode && q.correct_answers && (q.correct_answers.includes(i)||q.correct_answers.includes(String(i)))
                  const isWrong       = isRevd && isSelected && !isCorrectAns && studyMode

                  let bg = 'rgba(255,255,255,0.03)'
                  let border = '1.5px solid rgba(255,255,255,0.08)'
                  let color = '#e2e8f0'
                  if (isCorrectAns && isRevd) { bg='rgba(16,185,129,0.12)'; border='1.5px solid #10b981'; color='#10b981' }
                  else if (isWrong) { bg='rgba(239,68,68,0.1)'; border='1.5px solid #ef4444'; color='#ef4444' }
                  else if (isSelected) { bg='rgba(99,102,241,0.15)'; border='1.5px solid #6366f1'; color='#a5b4fc' }

                  return (
                    <button key={i} onClick={() => handleMCQAnswer(q, i)} disabled={isRevd}
                      style={{
                        display:'flex',alignItems:'center',gap:12,padding:'12px 16px',
                        borderRadius:12,border,background:bg,
                        cursor:isRevd?'default':'pointer',transition:'all 0.15s',textAlign:'left',width:'100%'
                      }}
                      onMouseEnter={e => { if (!isRevd && !isSelected) e.currentTarget.style.background='rgba(255,255,255,0.06)' }}
                      onMouseLeave={e => { if (!isRevd && !isSelected) e.currentTarget.style.background='rgba(255,255,255,0.03)' }}>
                      <span style={{
                        width:28,height:28,borderRadius:99,display:'flex',alignItems:'center',justifyContent:'center',
                        fontSize:11,fontWeight:700,flexShrink:0,
                        background:isCorrectAns&&isRevd?'#10b981':isWrong?'#ef4444':isSelected?'#6366f1':'rgba(255,255,255,0.08)',
                        color:isSelected||isCorrectAns&&isRevd||isWrong?'white':'#64748b'
                      }}>
                        {String.fromCharCode(65+i)}
                      </span>
                      <span style={{flex:1,fontSize:14,fontWeight:500,color}}>{opt}</span>
                      {isCorrectAns && isRevd && <CheckCircle className="w-4 h-4 flex-shrink-0" style={{color:'#10b981'}}/>}
                      {isWrong && <XCircle className="w-4 h-4 flex-shrink-0" style={{color:'#ef4444'}}/>}
                    </button>
                  )
                })}
              </div>
            )}

            {/* Multi-select */}
            {q.question_type==='multiple_select' && q.options && (
              <div style={{display:'flex',flexDirection:'column',gap:10}}>
                <p style={{fontSize:12,color:'#64748b',marginBottom:4}}>Select all that apply</p>
                {q.options.map((opt, i) => {
                  const sel = (multiSel[q.id]||[]).includes(i)
                  const isRevd = revealed.has(q.id)
                  return (
                    <label key={i} style={{
                      display:'flex',alignItems:'center',gap:12,padding:'12px 16px',borderRadius:12,
                      border:`1.5px solid ${sel?'#8b5cf6':'rgba(255,255,255,0.08)'}`,
                      background:sel?'rgba(139,92,246,0.1)':'rgba(255,255,255,0.03)',cursor:isRevd?'default':'pointer'
                    }}>
                      <input type="checkbox" checked={sel} disabled={isRevd}
                        onChange={() => handleMultiToggle(q, i)} style={{accentColor:'#8b5cf6',width:16,height:16}}/>
                      <span style={{fontSize:14,color:'#e2e8f0'}}>{opt}</span>
                    </label>
                  )
                })}
                {!revealed.has(q.id) && (
                  <button onClick={() => handleMultiSubmit(q)} disabled={!(multiSel[q.id]||[]).length}
                    style={{padding:'11px 24px',borderRadius:12,fontWeight:700,fontSize:14,color:'white',
                      background:'linear-gradient(135deg,#8b5cf6,#6366f1)',marginTop:4,
                      opacity:!(multiSel[q.id]||[]).length?0.4:1,cursor:!(multiSel[q.id]||[]).length?'not-allowed':'pointer'}}>
                    Confirm Selection
                  </button>
                )}
              </div>
            )}

            {/* Short answer / fill blank */}
            {(q.question_type==='short_answer'||q.question_type==='fill_blank') && (
              <div style={{display:'flex',gap:10}}>
                <input value={textAns[q.id]||''} disabled={revealed.has(q.id)}
                  onChange={e => setTextAns(prev => ({...prev,[q.id]:e.target.value}))}
                  onKeyDown={e => e.key==='Enter' && handleText(q)}
                  placeholder={q.question_type==='fill_blank'?'Fill in the blank...':'Type your answer...'}
                  style={{flex:1,padding:'12px 16px',borderRadius:12,background:'rgba(255,255,255,0.05)',
                    border:'1.5px solid rgba(255,255,255,0.1)',color:'#e2e8f0',fontSize:14,outline:'none'}}/>
                {!revealed.has(q.id) && (
                  <button onClick={() => handleText(q)} disabled={!textAns[q.id]?.trim()}
                    style={{padding:'12px 20px',borderRadius:12,fontWeight:700,fontSize:14,color:'white',
                      background:'#6366f1',opacity:!textAns[q.id]?.trim()?0.4:1,cursor:!textAns[q.id]?.trim()?'not-allowed':'pointer'}}>
                    Submit
                  </button>
                )}
              </div>
            )}

            {/* Numeric */}
            {q.question_type==='numeric' && (
              <div style={{display:'flex',gap:10}}>
                <input type="number" value={textAns[q.id]||''} disabled={revealed.has(q.id)}
                  onChange={e => setTextAns(prev => ({...prev,[q.id]:e.target.value}))}
                  onKeyDown={e => e.key==='Enter' && handleText(q)}
                  placeholder="Enter numeric value..."
                  style={{flex:1,padding:'12px 16px',borderRadius:12,background:'rgba(255,255,255,0.05)',
                    border:'1.5px solid rgba(255,255,255,0.1)',color:'#e2e8f0',fontSize:14,outline:'none'}}/>
                {!revealed.has(q.id) && (
                  <button onClick={() => handleText(q)} disabled={!textAns[q.id]}
                    style={{padding:'12px 20px',borderRadius:12,fontWeight:700,fontSize:14,color:'white',
                      background:'#6366f1',opacity:!textAns[q.id]?0.4:1,cursor:!textAns[q.id]?'not-allowed':'pointer'}}>
                    Submit
                  </button>
                )}
              </div>
            )}

            {/* Study mode feedback */}
            {studyMode && revealed.has(q.id) && (
              <div style={{
                marginTop:20,padding:'16px',borderRadius:12,
                background:(q.question_type==='mcq'||q.question_type==='true_false')&&q.correct_answers
                  ? (q.correct_answers.includes(answers[q.id])||q.correct_answers.includes(+answers[q.id])
                    ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.08)')
                  : 'rgba(99,102,241,0.08)',
                border:`1px solid ${(q.correct_answers?.includes(answers[q.id])||q.correct_answers?.includes(+answers[q.id]))?'rgba(16,185,129,0.3)':'rgba(99,102,241,0.2)'}`,
              }}>
                {q.explanation && (
                  <div>
                    <div style={{fontSize:12,fontWeight:700,marginBottom:6,color:'#94a3b8'}}>EXPLANATION</div>
                    <p style={{fontSize:14,color:'#e2e8f0',lineHeight:1.6}}>{q.explanation}</p>
                  </div>
                )}
                {!q.explanation && <p style={{fontSize:13,color:'#94a3b8'}}>Answer recorded. Continue to next question.</p>}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Footer ── */}
      <div style={{
        flexShrink:0,height:56,display:'flex',alignItems:'center',justifyContent:'space-between',
        padding:'0 16px',gap:12,
        background:'#060e1d',borderTop:'1px solid rgba(255,255,255,0.08)',
      }}>
        <button onClick={() => nav(current-1)} disabled={current===0}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-bold transition-all hover:bg-white/5"
          style={{color:current===0?'#334155':'#94a3b8',cursor:current===0?'not-allowed':'pointer'}}>
          <ChevronLeft className="w-4 h-4"/> Prev
        </button>

        {/* Keyboard hint */}
        <span className="text-xs hidden md:block" style={{color:'#334155'}}>
          ← → navigate · 1-4 answer · F flag · Enter next
        </span>

        <div style={{display:'flex',gap:8,alignItems:'center'}}>
          {current < questions.length - 1 ? (
            <button onClick={() => nav(current+1)}
              className="flex items-center gap-1.5 px-5 py-2 rounded-lg text-sm font-bold text-white transition-all hover:opacity-90"
              style={{background:'rgba(99,102,241,0.8)'}}>
              Next <ChevronRight className="w-4 h-4"/>
            </button>
          ) : (
            <button onClick={() => setShowSub(true)}
              className="flex items-center gap-1.5 px-5 py-2 rounded-lg text-sm font-bold text-white transition-all hover:opacity-90"
              style={{background:'linear-gradient(135deg,#10b981,#059669)'}}>
              <CheckCircle className="w-4 h-4"/> Review & Submit
            </button>
          )}
          <button onClick={() => setShowSub(true)}
            className="sm:hidden flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-bold text-white"
            style={{background:'linear-gradient(135deg,#6366f1,#4f46e5)'}}>
            Submit
          </button>
        </div>
      </div>

      {/* Submit modal */}
      {showSubmit && (
        <SubmitModal questions={questions} answers={{...answers,...Object.fromEntries(Object.entries(multiSel).map(([k,v])=>[k,v]))}} flagged={flagged} onConfirm={doSubmit} onCancel={() => setShowSub(false)} submitting={submitting}/>
      )}

      {/* Exit modal */}
      {showExitModal && (
        <div className="fixed inset-0 flex items-center justify-center z-[200]" style={{background:'rgba(0,0,0,0.7)'}}>
          <div className="rounded-2xl p-8 max-w-sm w-full mx-4 shadow-2xl" style={{background:'var(--card-bg)',border:'1px solid var(--border)'}}>
            <h2 className="text-lg font-black mb-2" style={{color:'var(--text)'}}>Exit quiz?</h2>
            <p className="text-sm mb-6" style={{color:'var(--text-muted)'}}>Your progress will be lost if you exit without submitting.</p>
            <div className="flex gap-3">
              <button onClick={() => setShowExit(false)} className="flex-1 py-3 rounded-xl font-bold text-sm" style={{background:'var(--page-bg)',color:'var(--text)',border:'1px solid var(--border)'}}>Stay</button>
              <button onClick={() => onFinish(null)} className="flex-1 py-3 rounded-xl font-black text-white text-sm" style={{background:'#ef4444'}}>Exit</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Quiz Result ───────────────────────────────────────────────────────────────
function QuizResult({ result, quiz, onRetake, onBrowse }) {
  const [expand, setExpand] = useState({})
  if (!result) return (
    <div className="text-center py-20">
      <button onClick={onBrowse} className="mt-4 px-6 py-3 rounded-xl font-bold text-white" style={{background:'#6366f1'}}>Back to Quizzes</button>
    </div>
  )

  const { score=0, passed=false, earned=0, total=1, xp_earned=0, results=[] } = result
  const r = Math.min(160, (score / 100) * 160)
  const circ = 2 * Math.PI * 54
  const dash = (r / 160) * circ
  const scoreColor = score >= 80 ? '#10b981' : score >= 60 ? '#f59e0b' : '#ef4444'
  const timeTaken  = result.time_taken || 0

  return (
    <div className="max-w-2xl mx-auto py-8 space-y-6">
      {passed && <Confetti/>}

      {/* Score card */}
      <div className="card p-8 text-center relative overflow-hidden">
        {passed && <div className="absolute inset-0 opacity-5" style={{background:'radial-gradient(circle,#10b981,transparent)'}}/>}
        <div className="relative">
          {/* Score ring */}
          <div className="flex justify-center mb-6">
            <svg width={140} height={140} className="rotate-[-90deg]">
              <circle cx={70} cy={70} r={54} fill="none" stroke="var(--border)" strokeWidth={10}/>
              <circle cx={70} cy={70} r={54} fill="none" stroke={scoreColor} strokeWidth={10}
                strokeDasharray={`${dash} ${circ - dash}`} strokeLinecap="round"
                style={{transition:'stroke-dasharray 1.2s cubic-bezier(0.4,0,0.2,1)'}}/>
            </svg>
            <div className="absolute flex flex-col items-center justify-center" style={{width:140,height:140,top:0,left:'calc(50% - 70px)'}}>
              <div className="text-4xl font-black" style={{color:scoreColor}}>{score}%</div>
              <div className={`text-xs font-bold mt-1 px-2.5 py-0.5 rounded-full ${passed?'text-emerald-700 bg-emerald-100':'text-amber-700 bg-amber-100'}`}>
                {passed ? '✓ PASS' : 'FAIL'}
              </div>
            </div>
          </div>

          <h2 className="text-2xl font-black mb-2" style={{color:'var(--text)'}}>
            {passed ? (score >= 90 ? '🏆 Outstanding!' : '🎉 Well Done!') : '📚 Keep Practising'}
          </h2>
          <p className="text-sm mb-6" style={{color:'var(--text-muted)'}}>
            You scored {score}% — {passed ? `passed with ${score - (quiz.pass_score||70)}% above the pass mark` : `${(quiz.pass_score||70) - score}% below the pass mark of ${quiz.pass_score||70}%`}
          </p>

          {/* Stats */}
          <div className="grid grid-cols-4 gap-3 mb-6">
            {[
              {l:'Points',v:`${earned}/${total}`,c:'#6366f1'},
              {l:'XP Earned',v:`+${xp_earned}`,c:'#f59e0b'},
              {l:'Correct',v:`${results.filter(r=>r.is_correct).length}/${results.length}`,c:'#10b981'},
              {l:'Time',v:timeTaken>0?fmtTime(timeTaken):'—',c:'#0ea5e9'},
            ].map(s => (
              <div key={s.l} className="rounded-xl p-3 text-center" style={{background:'var(--page-bg)',border:'1px solid var(--border)'}}>
                <div className="font-black text-sm" style={{color:s.c}}>{s.v}</div>
                <div className="text-xs mt-0.5" style={{color:'var(--text-muted)'}}>{s.l}</div>
              </div>
            ))}
          </div>

          {/* Actions */}
          <div className="flex gap-3 justify-center flex-wrap">
            <button onClick={onBrowse} className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all hover:opacity-80"
              style={{background:'var(--page-bg)',color:'var(--text)',border:'1px solid var(--border)'}}>
              <BookOpen className="w-4 h-4"/> All Quizzes
            </button>
            <button onClick={onRetake} className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm text-white transition-all hover:opacity-90"
              style={{background:'linear-gradient(135deg,#6366f1,#4f46e5)'}}>
              <RotateCcw className="w-4 h-4"/> Retake Quiz
            </button>
          </div>
        </div>
      </div>

      {/* Per-question review */}
      {results.length > 0 && (
        <div className="card overflow-hidden">
          <div className="px-6 py-4 border-b" style={{borderColor:'var(--border)'}}>
            <h3 className="font-bold" style={{color:'var(--text)'}}>Question Review</h3>
          </div>
          <div className="divide-y" style={{borderColor:'var(--border)'}}>
            {results.map((r, i) => (
              <div key={i} className="overflow-hidden">
                <button className="w-full flex items-center gap-4 px-5 py-3 text-left hover:opacity-80 transition-opacity"
                  onClick={() => setExpand(prev => ({...prev,[i]:!prev[i]}))}>
                  <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
                    style={{background:r.is_correct?'#f0fdf4':'#fef2f2'}}>
                    {r.is_correct
                      ? <CheckCircle className="w-4 h-4" style={{color:'#10b981'}}/>
                      : <XCircle className="w-4 h-4" style={{color:'#ef4444'}}/>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate" style={{color:'var(--text)'}}>{r.question_text}</p>
                    <p className="text-xs" style={{color:r.is_correct?'#10b981':'#ef4444'}}>{r.is_correct?`+${r.points_earned} pts`:`${r.points_earned} pts`}</p>
                  </div>
                  {expand[i] ? <ChevronUp className="w-4 h-4 flex-shrink-0" style={{color:'var(--text-muted)'}}/> : <ChevronDown className="w-4 h-4 flex-shrink-0" style={{color:'var(--text-muted)'}}/>}
                </button>
                {expand[i] && (
                  <div className="px-5 pb-4 pt-1" style={{borderTop:'1px solid var(--border)'}}>
                    {r.options && r.options.length > 0 && (
                      <div className="grid gap-1.5 mb-3">
                        {r.options.map((opt, oi) => {
                          const isCorrect = r.correct_answers?.includes(oi)||r.correct_answers?.includes(String(oi))
                          const isUser    = r.user_answer===oi||r.user_answer===String(oi)||r.user_answer===oi
                          return (
                            <div key={oi} className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs"
                              style={{
                                background:isCorrect?'#f0fdf4':isUser&&!isCorrect?'#fef2f2':'var(--page-bg)',
                                border:`1px solid ${isCorrect?'#bbf7d0':isUser&&!isCorrect?'#fecaca':'var(--border)'}`,
                              }}>
                              <span style={{width:18,height:18,borderRadius:99,display:'inline-flex',alignItems:'center',justifyContent:'center',
                                background:isCorrect?'#10b981':isUser&&!isCorrect?'#ef4444':'var(--border)',
                                color:'white',fontSize:9,fontWeight:700,flexShrink:0}}>{String.fromCharCode(65+oi)}</span>
                              <span style={{flex:1,color:'var(--text)'}}>{opt}</span>
                              {isCorrect && <span style={{color:'#10b981',fontWeight:700}}>✓ Correct</span>}
                              {isUser && !isCorrect && <span style={{color:'#ef4444',fontWeight:700}}>Your answer</span>}
                            </div>
                          )
                        })}
                      </div>
                    )}
                    {r.explanation && (
                      <div className="text-xs p-3 rounded-lg" style={{background:'rgba(99,102,241,0.06)',color:'var(--text-muted)',border:'1px solid rgba(99,102,241,0.12)'}}>
                        💡 {r.explanation}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main export ───────────────────────────────────────────────────────────────
export default function QuizMe() {
  const [phase, setPhase]       = useState('browse')
  const [quiz, setQuiz]         = useState(null)
  const [studyMode, setStudy]   = useState(false)
  const [result, setResult]     = useState(null)

  const handleSelect = q  => { setQuiz(q); setPhase('confirm') }
  const handleStart  = sm => { setStudy(sm); setPhase('play') }
  const handleFinish = r  => { setResult(r); setPhase(r ? 'result' : 'browse') }

  return (
    <div>
      {phase === 'browse'  && <QuizBrowser onSelect={handleSelect}/>}
      {phase === 'confirm' && <QuizConfirm quiz={quiz} onStart={handleStart} onBack={() => setPhase('browse')}/>}
      {phase === 'play'    && <QuizPlayer quiz={quiz} studyMode={studyMode} onFinish={handleFinish}/>}
      {phase === 'result'  && <QuizResult result={result} quiz={quiz} onRetake={() => setPhase('confirm')} onBrowse={() => setPhase('browse')}/>}
    </div>
  )
}
