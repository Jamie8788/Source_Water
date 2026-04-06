import PageAmbience from '../components/layout/PageAmbience'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useSound } from '../context/SoundContext'
import api from '../utils/api'
import { Clock, Zap, BookOpen, Trophy, CheckCircle, XCircle, RotateCcw, Star } from 'lucide-react'

const DIFFICULTY_META = {
  Beginner:     { color: '#10b981', bg: '#f0fdf4', border: '#bbf7d0', emoji: '🌱' },
  Intermediate: { color: '#f59e0b', bg: '#fffbeb', border: '#fde68a', emoji: '🔬' },
  Advanced:     { color: '#ef4444', bg: '#fef2f2', border: '#fecaca', emoji: '🏆' },
}

const CATEGORY_COLORS = {
  'Water Quality': 'linear-gradient(135deg,#0ea5e9,#6366f1)',
  'Field Work':    'linear-gradient(135deg,#10b981,#0ea5e9)',
  'Data Literacy': 'linear-gradient(135deg,#8b5cf6,#ec4899)',
  'Ecology':       'linear-gradient(135deg,#14b8a6,#10b981)',
  'Regional':      'linear-gradient(135deg,#f59e0b,#ef4444)',
}

/* ── Confetti burst on quiz complete ── */
function Confetti() {
  const canvasRef = useRef(null)
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    canvas.width = window.innerWidth
    canvas.height = window.innerHeight
    const pieces = Array.from({ length: 120 }, (_, i) => ({
      x: Math.random() * canvas.width,
      y: -20,
      r: Math.random() * 8 + 3,
      color: ['#6366f1','#14b8a6','#f59e0b','#ec4899','#10b981','#0ea5e9'][i % 6],
      vx: (Math.random() - 0.5) * 6,
      vy: Math.random() * 4 + 2,
      rot: Math.random() * 360,
      vrot: (Math.random() - 0.5) * 8,
    }))
    let frame = 0
    const animate = () => {
      if (frame++ > 200) return
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      pieces.forEach(p => {
        p.x += p.vx; p.y += p.vy; p.vy += 0.08; p.rot += p.vrot
        if (p.y > canvas.height) { p.y = -20; p.x = Math.random() * canvas.width }
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot * Math.PI / 180)
        ctx.fillStyle = p.color; ctx.globalAlpha = Math.max(0, 1 - frame / 200)
        ctx.fillRect(-p.r, -p.r / 2, p.r * 2, p.r)
        ctx.restore()
      })
      requestAnimationFrame(animate)
    }
    animate()
  }, [])
  return <canvas ref={canvasRef} style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 9999 }}/>
}

/* ── Quiz List ── */
function QuizList({ onStart }) {
  const [quizzes, setQuizzes] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('All')
  const [myProgress, setMyProgress] = useState([])
  const [showMyStats, setShowMyStats] = useState(false)

  useEffect(() => {
    api.get('/quizzes').then(r => {
      setQuizzes(r.data.quizzes || r.data || [])
      setLoading(false)
    }).catch(() => setLoading(false))
    api.get('/quizzes/my-progress').then(r => {
      setMyProgress(Array.isArray(r.data) ? r.data : [])
    }).catch(() => {})
  }, [])

  // Build per-quiz stats from my progress
  const myQuizStats = {}
  myProgress.forEach(a => {
    if (!myQuizStats[a.quiz_id]) myQuizStats[a.quiz_id] = { attempts: 0, best: 0, passed: 0 }
    myQuizStats[a.quiz_id].attempts++
    if ((a.score || 0) > myQuizStats[a.quiz_id].best) myQuizStats[a.quiz_id].best = a.score
    if (a.passed) myQuizStats[a.quiz_id].passed++
  })
  const totalAttempts = myProgress.length
  const totalPassed = myProgress.filter(a => a.passed).length
  const avgScore = totalAttempts ? Math.round(myProgress.reduce((s, a) => s + (a.score || 0), 0) / totalAttempts) : 0

  const categories = ['All', ...new Set(quizzes.map(q => q.category).filter(Boolean))]
  const visible = filter === 'All' ? quizzes : quizzes.filter(q => q.category === filter)

  if (loading) return (
    <div className="space-y-4">
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1,2,3,4,5].map(i => <div key={i} className="card p-5 h-48 skeleton"/>)}
      </div>
    </div>
  )

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="rounded-2xl p-6 text-white relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg,#4f46e5,#7c3aed,#ec4899)' }}>
        <div className="absolute -right-10 -top-10 w-48 h-48 rounded-full bg-white/5"/>
        <div className="absolute right-20 bottom-0 w-32 h-32 rounded-full bg-white/5"/>
        <div className="relative">
          <div className="flex items-center gap-2 mb-2">
            <Zap className="w-5 h-5 text-yellow-300"/>
            <span className="font-bold text-yellow-300 text-sm">WATER KNOWLEDGE CHALLENGE</span>
          </div>
          <h1 className="text-3xl font-black mb-1">Quiz Me 🧠</h1>
          <p className="text-white/70">Master water quality science. Earn XP. Climb the leaderboard.</p>
          <div className="flex gap-4 mt-4 flex-wrap">
            {[
              { label: 'Quizzes', val: quizzes.length },
              { label: 'My Attempts', val: totalAttempts },
              { label: 'My Avg Score', val: totalAttempts ? `${avgScore}%` : '—' },
              { label: 'Passed', val: totalPassed },
            ].map(s => (
              <div key={s.label} className="text-center">
                <div className="text-2xl font-black">{s.val}</div>
                <div className="text-xs text-white/60">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* My Progress Panel */}
      {totalAttempts > 0 && (
        <div className="card overflow-hidden">
          <button className="w-full flex items-center justify-between px-5 py-4"
            onClick={() => setShowMyStats(s => !s)}>
            <div className="flex items-center gap-3">
              <Trophy className="w-5 h-5 text-amber-500" />
              <span className="font-bold" style={{ color: 'var(--text)' }}>My Progress</span>
              <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
                style={{ background: 'rgba(99,102,241,0.1)', color: '#6366f1' }}>
                {totalAttempts} attempts
              </span>
            </div>
            <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>{showMyStats ? '▲ Hide' : '▼ Show'}</span>
          </button>
          {showMyStats && (
            <div className="px-5 pb-4 border-t" style={{ borderColor: 'var(--border)' }}>
              <div className="grid grid-cols-3 gap-3 my-3">
                {[
                  { label: 'Total Attempts', val: totalAttempts, color: '#6366f1' },
                  { label: 'Avg Score', val: `${avgScore}%`, color: avgScore >= 70 ? '#10b981' : '#f59e0b' },
                  { label: 'Quizzes Passed', val: totalPassed, color: '#10b981' },
                ].map(s => (
                  <div key={s.label} className="rounded-xl p-3 text-center"
                    style={{ background: 'var(--page-bg)', border: '1px solid var(--border)' }}>
                    <div className="text-xl font-black" style={{ color: s.color }}>{s.val}</div>
                    <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{s.label}</div>
                  </div>
                ))}
              </div>
              <p className="text-xs font-semibold mb-2" style={{ color: 'var(--text-muted)' }}>RECENT ATTEMPTS</p>
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {myProgress.slice(0, 8).map((a, i) => (
                  <div key={i} className="flex items-center justify-between px-3 py-2 rounded-xl text-sm"
                    style={{ background: 'var(--page-bg)' }}>
                    <span className="font-medium" style={{ color: 'var(--text)' }}>{a.quiz_title}</span>
                    <div className="flex items-center gap-3">
                      <span className="font-black" style={{ color: a.passed ? '#10b981' : '#f59e0b' }}>
                        {a.score ?? '—'}%
                      </span>
                      <span className="text-xs px-1.5 py-0.5 rounded-full"
                        style={{ background: a.passed ? '#f0fdf4' : '#fef3c7', color: a.passed ? '#10b981' : '#d97706' }}>
                        {a.passed ? '✓ Passed' : 'Not passed'}
                      </span>
                      <span style={{ color: 'var(--text-muted)', fontSize: 10 }}>
                        {a.completed_at ? new Date(a.completed_at).toLocaleDateString() : '—'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Category filter */}
      <div className="flex gap-2 flex-wrap">
        {categories.map(c => (
          <button key={c} onClick={() => setFilter(c)}
            className="px-4 py-1.5 rounded-full text-sm font-semibold transition-all"
            style={{
              background: filter === c ? '#6366f1' : 'var(--card-bg)',
              color: filter === c ? 'white' : 'var(--text-muted)',
              border: `1px solid ${filter === c ? '#6366f1' : 'var(--border)'}`,
            }}>
            {c}
          </button>
        ))}
      </div>

      {/* Quiz cards */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {visible.map(q => {
          const diff = DIFFICULTY_META[q.difficulty] || DIFFICULTY_META.Beginner
          const grad = CATEGORY_COLORS[q.category] || 'linear-gradient(135deg,#6366f1,#8b5cf6)'
          return (
            <div key={q.id} className="card overflow-hidden group hover:shadow-xl hover:-translate-y-1 transition-all duration-200 cursor-pointer"
              onClick={() => onStart(q)}>
              {/* Color bar */}
              <div style={{ height: 6, background: grad }}/>
              <div className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl"
                    style={{ background: grad }}>
                    {diff.emoji}
                  </div>
                  <span className="text-xs font-bold px-2.5 py-1 rounded-full"
                    style={{ background: diff.bg, color: diff.color, border: `1px solid ${diff.border}` }}>
                    {q.difficulty}
                  </span>
                </div>
                <h3 className="font-black text-base mb-1" style={{ color: 'var(--text)' }}>{q.title}</h3>
                <p className="text-xs mb-4 line-clamp-2" style={{ color: 'var(--text-muted)' }}>{q.description}</p>
                <div className="flex items-center justify-between text-xs" style={{ color: 'var(--text-muted)' }}>
                  <div className="flex gap-3">
                    <span>❓ {q.question_count || 0} questions</span>
                    <span>⏱ {q.time_per_question || 60}s each</span>
                  </div>
                  {myQuizStats[q.id] ? (
                    <span className="text-xs font-bold" style={{ color: myQuizStats[q.id].passed > 0 ? '#10b981' : '#f59e0b' }}>
                      {myQuizStats[q.id].passed > 0 ? '✓' : ''} Best: {myQuizStats[q.id].best}%
                    </span>
                  ) : q.attempt_count > 0 ? (
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{q.attempt_count} plays</span>
                  ) : null}
                </div>
                <div className="mt-4 w-full py-2.5 rounded-xl text-sm font-bold text-white text-center group-hover:opacity-90 transition-opacity"
                  style={{ background: grad }}>
                  Start Quiz →
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ── Quiz Session ── */
function QuizSession({ quiz, onFinish }) {
  const { play } = useSound()
  const [questions, setQuestions] = useState([])
  const [attemptId, setAttemptId] = useState(null)
  const [current, setCurrent] = useState(0)
  const [answers, setAnswers] = useState({}) // { [questionId]: selectedIndex or array }
  const [timeLeft, setTimeLeft] = useState(60)
  const [selectedIdx, setSelectedIdx] = useState(null)
  const [revealed, setRevealed] = useState(false)
  const [loading, setLoading] = useState(true)
  const [shake, setShake] = useState(false)
  const [bounce, setBounce] = useState(false)
  const timerRef = useRef(null)
  const totalPoints = useRef(0)

  const totalTime = quiz.time_per_question || 60

  useEffect(() => {
    api.post(`/quizzes/${quiz.id}/start`).then(r => {
      setQuestions(r.data.questions || [])
      setAttemptId(r.data.attempt_id)
      setLoading(false)
      startTimer(totalTime)
    }).catch(() => setLoading(false))
    return () => clearInterval(timerRef.current)
  }, [])

  const startTimer = useCallback((limit) => {
    clearInterval(timerRef.current)
    setTimeLeft(limit)
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) { clearInterval(timerRef.current); handleTimeout(); return 0 }
        return prev - 1
      })
    }, 1000)
  }, [])

  const handleTimeout = () => {
    if (!revealed) {
      setRevealed(true)
      play('wrong')
      setShake(true)
      setTimeout(() => setShake(false), 600)
    }
  }

  const q = questions[current]

  const choose = (idx) => {
    if (revealed) return
    setSelectedIdx(idx)
    clearInterval(timerRef.current)
    setRevealed(true)

    const correctIndexes = q.correct_answers || []
    const isCorrect = correctIndexes.includes(idx)

    setAnswers(prev => ({ ...prev, [q.id]: idx }))

    if (isCorrect) {
      play('correct')
      totalPoints.current += q.points || 1
      setBounce(true)
      setTimeout(() => setBounce(false), 600)
    } else {
      play('wrong')
      setShake(true)
      setTimeout(() => setShake(false), 600)
    }
  }

  const next = () => {
    if (current + 1 >= questions.length) {
      // Submit
      const score = Object.keys(answers).filter(qid => {
        const q2 = questions.find(x => String(x.id) === String(qid))
        return q2?.correct_answers?.includes(answers[qid])
      }).length
      api.post(`/quizzes/${quiz.id}/submit`, {
        attempt_id: attemptId,
        answers,
        time_taken: (totalTime * questions.length),
      }).then(r => {
        onFinish({ score, total: questions.length, quiz, points: r.data?.earned || totalPoints.current, xp: r.data?.xp_earned || 0, answers })
      }).catch(() => {
        onFinish({ score, total: questions.length, quiz, points: totalPoints.current, xp: 0, answers })
      })
    } else {
      setCurrent(c => c + 1)
      setSelectedIdx(null)
      setRevealed(false)
      startTimer(totalTime)
    }
  }

  if (loading) return (
    <div className="max-w-2xl mx-auto flex flex-col items-center justify-center py-20 gap-4">
      <div className="w-16 h-16 rounded-full border-4 border-indigo-500 border-t-transparent animate-spin"/>
      <p style={{ color: 'var(--text-muted)' }}>Loading quiz...</p>
    </div>
  )
  if (!q) return (
    <div className="max-w-2xl mx-auto text-center py-20">
      <div className="text-5xl mb-4">😕</div>
      <p style={{ color: 'var(--text-muted)' }}>No questions found for this quiz.</p>
    </div>
  )

  const progress = (current / questions.length) * 100
  const timerPct = (timeLeft / totalTime) * 100
  const timerColor = timerPct > 50 ? '#10b981' : timerPct > 25 ? '#f59e0b' : '#ef4444'
  const correctIndexes = q.correct_answers || []

  const getOptionStyle = (idx) => {
    const base = {
      borderRadius: 12, padding: '12px 16px', textAlign: 'left',
      border: '2px solid', cursor: revealed ? 'default' : 'pointer',
      transition: 'all 0.2s', fontWeight: 500, width: '100%',
      display: 'flex', alignItems: 'center', gap: 12,
    }
    if (!revealed) return {
      ...base, background: 'var(--card-bg)', borderColor: 'var(--border)',
      color: 'var(--text)',
    }
    if (correctIndexes.includes(idx)) return {
      ...base, background: '#f0fdf4', borderColor: '#22c55e', color: '#15803d',
    }
    if (idx === selectedIdx && !correctIndexes.includes(idx)) return {
      ...base, background: '#fef2f2', borderColor: '#ef4444', color: '#dc2626',
    }
    return { ...base, background: 'var(--page-bg)', borderColor: 'var(--border)', color: 'var(--text-muted)', opacity: 0.6 }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-black text-lg" style={{ color: 'var(--text)' }}>{quiz.title}</h2>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            Question {current + 1} of {questions.length}
          </p>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 rounded-xl"
          style={{ background: 'var(--card-bg)', border: '1px solid var(--border)' }}>
          <Star className="w-4 h-4 text-yellow-500"/>
          <span className="font-black text-sm" style={{ color: 'var(--text)' }}>{totalPoints.current} pts</span>
        </div>
      </div>

      {/* Progress bar */}
      <div>
        <div className="h-3 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
          <div className="h-full rounded-full transition-all duration-500"
            style={{ width: progress + '%', background: 'linear-gradient(90deg,#6366f1,#14b8a6)' }}/>
        </div>
        <div className="flex justify-between mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
          <span>{current} done</span>
          <span>{questions.length - current - 1} remaining</span>
        </div>
      </div>

      {/* Timer */}
      <div className="flex items-center gap-3">
        <Clock className="w-4 h-4 flex-shrink-0" style={{ color: timerColor }}/>
        <div className="flex-1 h-2.5 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
          <div className="h-full rounded-full transition-all duration-1000"
            style={{ width: timerPct + '%', background: timerColor }}/>
        </div>
        <span className={`font-black text-lg w-8 text-right tabular-nums ${timeLeft <= 10 ? 'animate-pulse' : ''}`}
          style={{ color: timerColor, minWidth: 32 }}>
          {timeLeft}
        </span>
      </div>

      {/* Question card */}
      <div className={`card p-6 ${shake ? 'animate-[shake_0.4s_ease]' : ''} ${bounce ? 'animate-[bounce_0.4s_ease]' : ''}`}
        style={{ borderColor: revealed ? (correctIndexes.includes(selectedIdx) ? '#22c55e' : selectedIdx === null ? 'var(--border)' : '#ef4444') : 'var(--border)' }}>

        {/* Question type badge */}
        <div className="flex items-center gap-2 mb-4">
          <span className="text-xs font-bold px-2.5 py-1 rounded-full"
            style={{ background: '#ede9fe', color: '#7c3aed' }}>
            {q.question_type === 'mcq' ? '🔘 Multiple Choice' :
             q.question_type === 'true_false' ? '✅ True / False' :
             q.question_type === 'multiple_select' ? '☑️ Select All That Apply' :
             q.question_type === 'short_answer' ? '✏️ Short Answer' : '📝 Question'}
          </span>
          <span className="text-xs font-bold" style={{ color: '#f59e0b' }}>+{q.points || 1} pt{(q.points || 1) > 1 ? 's' : ''}</span>
        </div>

        <p className="text-base font-semibold mb-5 leading-relaxed" style={{ color: 'var(--text)' }}>
          {q.question_text}
        </p>

        {/* MCQ / True-False options */}
        {(q.question_type === 'mcq' || q.question_type === 'true_false') && q.options && (
          <div className="grid gap-2.5">
            {q.options.map((opt, idx) => (
              <button key={idx} onClick={() => choose(idx)} disabled={revealed}
                style={getOptionStyle(idx)}
                className="hover:scale-[1.01] active:scale-[0.99] text-sm">
                <span className="w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs flex-shrink-0"
                  style={{
                    background: revealed && correctIndexes.includes(idx) ? '#22c55e' :
                                revealed && idx === selectedIdx ? '#ef4444' : 'var(--page-bg)',
                    color: revealed && (correctIndexes.includes(idx) || idx === selectedIdx) ? 'white' : 'var(--text-muted)',
                  }}>
                  {String.fromCharCode(65 + idx)}
                </span>
                <span className="flex-1">{opt}</span>
                {revealed && correctIndexes.includes(idx) && <CheckCircle className="w-5 h-5 flex-shrink-0 text-green-500"/>}
                {revealed && idx === selectedIdx && !correctIndexes.includes(idx) && <XCircle className="w-5 h-5 flex-shrink-0 text-red-500"/>}
              </button>
            ))}
          </div>
        )}

        {/* Short answer */}
        {q.question_type === 'short_answer' && (
          <div className="flex gap-3">
            <input
              disabled={revealed}
              placeholder="Type your answer..."
              onChange={e => setSelectedIdx(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !revealed && choose(e.target.value)}
              className="flex-1 text-sm py-2 px-3 rounded-xl"
              style={{ background: 'var(--page-bg)', border: '1.5px solid var(--border)' }}
            />
            {!revealed && (
              <button onClick={() => choose(selectedIdx)}
                className="px-5 py-2 rounded-xl text-sm font-bold text-white"
                style={{ background: '#6366f1' }}>
                Submit
              </button>
            )}
          </div>
        )}

        {/* Explanation */}
        {revealed && q.explanation && (
          <div className="mt-5 p-4 rounded-xl flex gap-3"
            style={{ background: 'linear-gradient(135deg,#eff6ff,#f0fdf4)', border: '1px solid #bfdbfe' }}>
            <div className="text-2xl flex-shrink-0">💡</div>
            <div>
              <div className="font-bold text-sm mb-1" style={{ color: '#1e40af' }}>Explanation</div>
              <p className="text-sm leading-relaxed" style={{ color: '#1e3a8a' }}>{q.explanation}</p>
            </div>
          </div>
        )}

        {/* Result feedback */}
        {revealed && (
          <div className="mt-4 flex items-center justify-between">
            <div className={`flex items-center gap-2 font-bold text-sm ${correctIndexes.includes(selectedIdx) ? 'text-green-600' : selectedIdx === null ? 'text-orange-500' : 'text-red-500'}`}>
              {correctIndexes.includes(selectedIdx) ? (
                <><CheckCircle className="w-5 h-5"/> Correct! +{q.points || 1} points</>
              ) : selectedIdx === null ? (
                <><Clock className="w-5 h-5"/> Time's up!</>
              ) : (
                <><XCircle className="w-5 h-5"/> Not quite</>
              )}
            </div>
            <button onClick={next}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-white text-sm"
              style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)' }}>
              {current + 1 >= questions.length ? '🏁 Finish' : 'Next →'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

/* ── Quiz Result ── */
function QuizResult({ result, onBack }) {
  const { play } = useSound()
  const pct = Math.round((result.score / result.total) * 100)
  const passed = pct >= 60

  useEffect(() => {
    if (passed) play('levelUp')
    else play('wrong')
  }, [])

  const grade = pct >= 90 ? { label: 'Outstanding!', emoji: '🏆', color: '#f59e0b' }
    : pct >= 75 ? { label: 'Excellent!', emoji: '🥇', color: '#6366f1' }
    : pct >= 60 ? { label: 'Good Job!', emoji: '🎉', color: '#10b981' }
    : pct >= 40 ? { label: 'Keep Going!', emoji: '💪', color: '#f97316' }
    : { label: 'Keep Learning!', emoji: '📚', color: '#64748b' }

  return (
    <>
      {passed && <Confetti/>}
      <div className="max-w-lg mx-auto space-y-5 py-4">
        {/* Score card */}
        <div className="card p-8 text-center relative overflow-hidden">
          <div className="absolute inset-0 opacity-5"
            style={{ background: 'radial-gradient(circle at 50% 50%, #6366f1, transparent)' }}/>
          <div className="text-7xl mb-2">{grade.emoji}</div>
          <h2 className="text-3xl font-black mb-1" style={{ color: grade.color }}>{grade.label}</h2>
          <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>{result.quiz.title}</p>

          {/* Score ring */}
          <div className="relative w-32 h-32 mx-auto mb-6">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
              <circle cx="18" cy="18" r="15.9" fill="none" stroke="var(--border)" strokeWidth="3"/>
              <circle cx="18" cy="18" r="15.9" fill="none" strokeWidth="3"
                stroke={grade.color}
                strokeDasharray={`${pct} ${100 - pct}`}
                strokeLinecap="round"
                style={{ transition: 'stroke-dasharray 1s ease' }}/>
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-3xl font-black" style={{ color: grade.color }}>{pct}%</span>
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>score</span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 mb-6">
            {[
              { icon: '✅', label: 'Correct', val: result.score, color: '#10b981' },
              { icon: '❌', label: 'Wrong', val: result.total - result.score, color: '#ef4444' },
              { icon: '⭐', label: 'Points', val: result.points || 0, color: '#f59e0b' },
            ].map(s => (
              <div key={s.label} className="rounded-xl p-3" style={{ background: 'var(--page-bg)' }}>
                <div className="text-xl mb-0.5">{s.icon}</div>
                <div className="text-xl font-black" style={{ color: s.color }}>{s.val}</div>
                <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{s.label}</div>
              </div>
            ))}
          </div>

          {result.xp > 0 && (
            <div className="flex items-center justify-center gap-2 py-2 px-4 rounded-xl mb-4"
              style={{ background: 'linear-gradient(135deg,#fef3c7,#fde68a)' }}>
              <Zap className="w-4 h-4 text-yellow-600"/>
              <span className="font-black text-yellow-700">+{result.xp} XP earned!</span>
            </div>
          )}

          {passed ? (
            <div className="flex items-center justify-center gap-2 text-green-600 font-semibold text-sm mb-2">
              <CheckCircle className="w-5 h-5"/> You passed! Certificate earned.
            </div>
          ) : (
            <div className="flex items-center justify-center gap-2 text-orange-500 font-semibold text-sm mb-2">
              <BookOpen className="w-5 h-5"/> Review the material and try again!
            </div>
          )}
        </div>

        <div className="flex gap-3">
          <button onClick={onBack}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm border transition-all hover:opacity-80"
            style={{ background: 'var(--card-bg)', color: 'var(--text)', borderColor: 'var(--border)' }}>
            <RotateCcw className="w-4 h-4"/> Try Another
          </button>
          <button onClick={onBack}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm text-white transition-all hover:opacity-90"
            style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)' }}>
            <Trophy className="w-4 h-4"/> View Leaderboard
          </button>
        </div>
      </div>
    </>
  )
}

export default function QuizMe() {
  const [phase, setPhase] = useState('list')
  const [quiz, setQuiz] = useState(null)
  const [result, setResult] = useState(null)

  return (
    <div className="max-w-3xl mx-auto">
      {phase === 'list' && (
        <QuizList onStart={q => { setQuiz(q); setPhase('quiz') }}/>
      )}
      {phase === 'quiz' && quiz && (
        <QuizSession quiz={quiz} onFinish={r => { setResult(r); setPhase('result') }}/>
      )}
      {phase === 'result' && result && (
        <QuizResult result={result} onBack={() => { setPhase('list'); setResult(null) }}/>
      )}
    </div>
  )
}
