/**
 * QuizMe — powered by @brightspace-ui/core web components
 * Real D2L list, buttons, status-indicators, loading-spinner
 */

// ── D2L web-component registrations ──────────────────────────────────────────
import '@brightspace-ui/core/components/list/list.js'
import '@brightspace-ui/core/components/list/list-item.js'
import '@brightspace-ui/core/components/list/list-item-content.js'
import '@brightspace-ui/core/components/button/button.js'
import '@brightspace-ui/core/components/button/button-subtle.js'
import '@brightspace-ui/core/components/button/button-icon.js'
import '@brightspace-ui/core/components/status-indicator/status-indicator.js'
import '@brightspace-ui/core/components/loading-spinner/loading-spinner.js'
import '@brightspace-ui/core/components/inputs/input-search.js'
import '@brightspace-ui/core/components/tabs/tabs.js'
import '@brightspace-ui/core/components/tabs/tab-panel.js'
import '@brightspace-ui/core/components/card/card.js'
import '@brightspace-ui/core/components/expand-collapse/expand-collapse-content.js'
import '@brightspace-ui/core/components/alert/alert.js'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useSound } from '../context/SoundContext'
import api from '../utils/api'
import {
  Clock, Trophy, CheckCircle, XCircle, RotateCcw,
  Flag, ChevronDown, ChevronUp, AlertCircle, Play,
  ChevronLeft, ChevronRight, BookMarked, X
} from 'lucide-react'

// ── Constants ─────────────────────────────────────────────────────────────────
const normDiff = s => s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : 'Beginner'
const fmtTime  = s => `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`
const CREATOR_ROLES = ['Teacher','Professor','Researcher','SOURCE Water team member']

const DIFF_STYLE = {
  Beginner:     { bg:'#edfcf1', color:'#1a7a3c', label:'Beginner' },
  Intermediate: { bg:'#fef9e7', color:'#976500', label:'Intermediate' },
  Advanced:     { bg:'#fef0f0', color:'#cc3333', label:'Advanced' },
}
const CAT_COLORS = {
  'Water Quality':'#006fbf','Field Work':'#067d62','Data Literacy':'#7b4fc4',
  'Ecology':'#0a7c5b','Regional':'#c45f00','Safety':'#c00','Sampling':'#006fbf','General':'#494c4e',
}
const catColor = cat => CAT_COLORS[cat] || CAT_COLORS[Object.keys(CAT_COLORS).find(k => k.toLowerCase()===(cat||'').toLowerCase())] || '#494c4e'

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
      col: ['#006fbf','#14b8a6','#f59e0b','#ec4899','#10b981','#0ea5e9','#f97316'][i % 7],
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

// ── D2L Badge chip ─────────────────────────────────────────────────────────────
function Chip({ label, bg='#e3e9f1', color='#494c4e' }) {
  return (
    <span style={{
      display:'inline-block', padding:'2px 8px', borderRadius:99,
      fontSize:11, fontWeight:600, background:bg, color,
    }}>{label}</span>
  )
}

// ── Quiz Browser ──────────────────────────────────────────────────────────────
function QuizBrowser({ onSelect }) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [quizzes, setQuizzes]   = useState([])
  const [progress, setProgress] = useState([])
  const [loading, setLoading]   = useState(true)
  const [search, setSearch]     = useState('')
  const [catFilter, setCat]     = useState('All')
  const [diffFilter, setDiff]   = useState('All')
  const [showStats, setShowStats] = useState(false)
  const searchRef = useRef(null)
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

  // Wire D2L search custom event
  useEffect(() => {
    const el = searchRef.current; if (!el) return
    const onSearch = e => setSearch(e.detail?.value ?? '')
    const onClear  = ()  => setSearch('')
    el.addEventListener('d2l-input-search-searched', onSearch)
    el.addEventListener('d2l-input-search-cleared',  onClear)
    return () => {
      el.removeEventListener('d2l-input-search-searched', onSearch)
      el.removeEventListener('d2l-input-search-cleared',  onClear)
    }
  }, [loading])

  const myStats = {}
  progress.forEach(a => {
    if (!myStats[a.quiz_id]) myStats[a.quiz_id] = { attempts:0, best:0, passed:0 }
    myStats[a.quiz_id].attempts++
    if ((a.score||0) > myStats[a.quiz_id].best) myStats[a.quiz_id].best = a.score
    if (a.passed) myStats[a.quiz_id].passed++
  })

  const cats    = ['All', ...new Set(quizzes.map(q => q.category).filter(Boolean).map(c => c.replace(/_/g,' ')))]
  const visible = quizzes.filter(q => {
    const cat = (q.category||'').replace(/_/g,' ')
    if (catFilter !== 'All' && cat.toLowerCase() !== catFilter.toLowerCase()) return false
    if (diffFilter !== 'All' && normDiff(q.difficulty) !== diffFilter) return false
    if (search && !q.title.toLowerCase().includes(search.toLowerCase()) && !(q.description||'').toLowerCase().includes(search.toLowerCase())) return false
    return true
  })
  const totalAttempts = progress.length
  const avgScore      = totalAttempts ? Math.round(progress.reduce((s,a) => s+(a.score||0),0)/totalAttempts) : 0
  const passed        = progress.filter(a => a.passed).length

  if (loading) return (
    <div style={{display:'flex',alignItems:'center',justifyContent:'center',padding:'80px 0',flexDirection:'column',gap:16}}>
      <d2l-loading-spinner size={80}/>
      <p style={{color:'var(--text-muted)',fontSize:14}}>Loading quizzes...</p>
    </div>
  )

  return (
    <div style={{maxWidth:960, margin:'0 auto', paddingBottom:40}}>

      {/* ── Page header ── */}
      <div style={{
        display:'flex', alignItems:'flex-start', justifyContent:'space-between',
        marginBottom:20, flexWrap:'wrap', gap:12,
        paddingBottom:16, borderBottom:'1px solid var(--border)'
      }}>
        <div>
          <h1 style={{fontSize:22, fontWeight:400, color:'var(--text)', margin:0, lineHeight:1.3}}>
            Quizzes &amp; Assessments
          </h1>
          <p style={{color:'var(--text-muted)', fontSize:13, marginTop:4, marginBottom:0}}>
            {quizzes.length} available
            {totalAttempts > 0 && ` · ${passed} of ${totalAttempts} attempts passed · Avg ${avgScore}%`}
          </p>
        </div>
        <div style={{display:'flex', gap:8, alignItems:'center', flexWrap:'wrap'}}>
          {totalAttempts > 0 && (
            <button onClick={() => setShowStats(v=>!v)}
              style={{fontSize:13,color:'var(--text-muted)',background:'none',border:'none',cursor:'pointer',display:'flex',alignItems:'center',gap:4}}>
              My Progress {showStats ? <ChevronUp className="w-3 h-3"/> : <ChevronDown className="w-3 h-3"/>}
            </button>
          )}
          {isCreator && (
            <d2l-button primary onClick={() => navigate('/quiz-admin')}>
              + Create Quiz
            </d2l-button>
          )}
        </div>
      </div>

      {/* ── My progress panel ── */}
      {showStats && totalAttempts > 0 && (
        <div style={{
          marginBottom:20, padding:'16px 20px', borderRadius:8,
          background:'var(--card-bg)', border:'1px solid var(--border)',
          display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(120px,1fr))', gap:16,
          animation:'statPop 0.35s ease both',
        }}>
          {[
            {l:'Total Attempts', v:totalAttempts, c:'#006fbf'},
            {l:'Avg Score', v:`${avgScore}%`, c:avgScore>=70?'#1a7a3c':'#976500'},
            {l:'Passed', v:passed, c:'#1a7a3c'},
            {l:'Quizzes Taken', v:new Set(progress.map(a=>a.quiz_id)).size, c:'#7b4fc4'},
          ].map((s, si) => (
            <div key={s.l} style={{textAlign:'center', animation:'statPop 0.35s ease both', animationDelay:`${si*60}ms`}}>
              <div style={{fontSize:28,fontWeight:700,color:s.c,lineHeight:1}}>{s.v}</div>
              <div style={{fontSize:12,color:'var(--text-muted)',marginTop:4}}>{s.l}</div>
            </div>
          ))}
        </div>
      )}

      {/* ── Search ── */}
      <d2l-input-search
        ref={searchRef}
        label="Search quizzes"
        placeholder="Search by title or description..."
        style={{display:'block', marginBottom:12}}
      />

      {/* ── Category filter ── */}
      {cats.length > 1 && (
        <div style={{display:'flex',gap:6,marginBottom:10,flexWrap:'wrap'}}>
          {cats.map(c => (
            <button key={c} onClick={() => setCat(c)} style={{
              padding:'3px 12px', borderRadius:99, fontSize:12, fontWeight:600, cursor:'pointer',
              border:`1.5px solid ${catFilter===c?catColor(c):'var(--border)'}`,
              background:catFilter===c?catColor(c):'transparent',
              color:catFilter===c?'white':'var(--text-muted)',
              transition:'all .15s',
            }}>{c}</button>
          ))}
        </div>
      )}

      {/* ── Difficulty filter ── */}
      <div style={{display:'flex',gap:6,marginBottom:20,flexWrap:'wrap'}}>
        {['All','Beginner','Intermediate','Advanced'].map(d => {
          const ds = DIFF_STYLE[d] || {}
          const active = diffFilter === d
          return (
            <button key={d} onClick={() => setDiff(d)} style={{
              padding:'3px 12px', borderRadius:4, fontSize:12, cursor:'pointer',
              border:`1.5px solid ${active?(ds.color||'#006fbf'):'var(--border)'}`,
              background:active?(ds.bg||'#e3f2fd'):'transparent',
              color:active?(ds.color||'#006fbf'):'var(--text-muted)',
              fontWeight:active?700:400,
              transition:'all .15s',
            }}>{d === 'All' ? 'All Levels' : d}</button>
          )
        })}
      </div>

      {/* ── Quiz list ── */}
      <style>{`
        @keyframes qBrowseIn { from { opacity:0; transform:translateY(20px) } to { opacity:1; transform:translateY(0) } }
        @keyframes statPop   { from { opacity:0; transform:scale(0.82) translateY(10px) } to { opacity:1; transform:scale(1) translateY(0) } }
        .qz-browse-card { transition: box-shadow 0.18s ease, transform 0.18s ease; cursor:pointer; }
        .qz-browse-card:hover { transform: translateY(-4px) !important; box-shadow: 0 12px 36px rgba(0,111,191,0.18) !important; }
      `}</style>
      {visible.length === 0 ? (
        <div style={{textAlign:'center', padding:'60px 20px'}}>
          <div style={{fontSize:56, marginBottom:12}}>🎓</div>
          <p style={{color:'var(--text-muted)', fontSize:16, marginBottom:16}}>
            {quizzes.length === 0 ? 'No quizzes published yet.' : 'No quizzes match your search.'}
          </p>
          {isCreator && quizzes.length === 0 && (
            <d2l-button primary onClick={() => navigate('/quiz-admin')}>Create First Quiz</d2l-button>
          )}
        </div>
      ) : (
        <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))', gap:14}}>
          {visible.map((q, idx) => {
            const cat  = (q.category||'general').replace(/_/g,' ')
            const diff = normDiff(q.difficulty)
            const ds   = DIFF_STYLE[diff] || DIFF_STYLE.Beginner
            const cc   = catColor(cat)
            const my   = myStats[q.id]
            const timeLabel = q.time_limit > 0 ? `${q.time_limit} min` : `${q.time_per_question||60}s/q`
            const btnLabel  = q.embed_url ? (my ? 'Redo Form' : '🔗 Open Form') : (my ? '↩ Retake' : '▶ Start Quiz')

            return (
              <div key={q.id} className="qz-browse-card card" onClick={() => onSelect(q)} style={{
                padding:0, overflow:'hidden',
                animation: 'qBrowseIn 0.35s ease both',
                animationDelay: `${idx * 50}ms`,
                border: my?.passed > 0 ? '1px solid rgba(26,122,60,0.25)' : '1px solid var(--border)',
              }}>
                {/* Top color bar */}
                <div style={{height:5, background:`linear-gradient(90deg,${cc},${cc}66)`}}/>
                <div style={{padding:'16px 16px 14px', display:'flex', flexDirection:'column', gap:10}}>
                  {/* Title row */}
                  <div style={{display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:8}}>
                    <div style={{fontWeight:700, fontSize:15, color:'var(--text)', lineHeight:1.3, flex:1}}>{q.title}</div>
                    {my?.passed > 0
                      ? <span style={{flexShrink:0, fontSize:11, fontWeight:700, padding:'3px 8px', borderRadius:99, background:'#edfcf1', color:'#1a7a3c', whiteSpace:'nowrap'}}>✓ Passed</span>
                      : my?.attempts > 0
                        ? <span style={{flexShrink:0, fontSize:11, fontWeight:700, padding:'3px 8px', borderRadius:99, background:'#fef9e7', color:'#976500', whiteSpace:'nowrap'}}>Best {my.best}%</span>
                        : null
                    }
                  </div>
                  {/* Chips */}
                  <div style={{display:'flex', flexWrap:'wrap', gap:5}}>
                    <span style={{fontSize:11, fontWeight:600, padding:'2px 8px', borderRadius:99, background:`${cc}18`, color:cc}}>{cat}</span>
                    <span style={{fontSize:11, padding:'2px 8px', borderRadius:99, background:ds.bg, color:ds.color, fontWeight:600}}>{diff}</span>
                    {q.embed_url && <span style={{fontSize:11, fontWeight:600, padding:'2px 8px', borderRadius:99, background:'rgba(0,111,191,0.08)', color:'#006fbf'}}>🔗 Form</span>}
                    {(q.status === 'draft' || q.status === 'archived') && (
                      <span style={{fontSize:11, fontWeight:700, padding:'2px 8px', borderRadius:99, background:'#fef9e7', color:'#976500'}}>{q.status.toUpperCase()}</span>
                    )}
                  </div>
                  {/* Description */}
                  {q.description && (
                    <p style={{margin:0, fontSize:12, color:'var(--text-muted)', lineHeight:1.5, overflow:'hidden', display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical'}}>
                      {q.description}
                    </p>
                  )}
                  {/* Stats */}
                  <div style={{display:'flex', gap:12, fontSize:12, color:'var(--text-muted)', flexWrap:'wrap'}}>
                    <span>📋 {q.question_count||0} q</span>
                    <span>⏱ {timeLabel}</span>
                    <span>🎯 {q.pass_score||70}%</span>
                    {q.attempt_count > 0 && <span>👥 {q.attempt_count}</span>}
                  </div>
                  {/* CTA */}
                  <button onClick={e => { e.stopPropagation(); onSelect(q) }} style={{
                    width:'100%', padding:'9px 0', borderRadius:6, fontWeight:700, fontSize:13,
                    cursor:'pointer',
                    background: my ? 'var(--page-bg)' : '#006fbf',
                    color: my ? '#006fbf' : 'white',
                    border: my ? '1.5px solid rgba(0,111,191,0.3)' : 'none',
                    marginTop:2,
                  }}>
                    {btnLabel}
                  </button>
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
  const diff  = normDiff(quiz.difficulty)
  const ds    = DIFF_STYLE[diff] || DIFF_STYLE.Beginner
  const cc    = catColor(cat)
  const timeLabel = quiz.time_limit > 0 ? `${quiz.time_limit} min total` : `${quiz.time_per_question||60}s per question`

  return (
    <div style={{maxWidth:600, margin:'0 auto', padding:'32px 0'}}>
      <button onClick={onBack} style={{
        display:'flex', alignItems:'center', gap:6, marginBottom:24,
        fontSize:14, color:'var(--text-muted)', background:'none', border:'none', cursor:'pointer'
      }}>
        <ChevronLeft className="w-4 h-4"/> Back to quizzes
      </button>

      <div style={{
        background:'var(--card-bg)', border:'1px solid var(--border)',
        borderRadius:8, overflow:'hidden', boxShadow:'0 2px 12px rgba(0,0,0,0.06)'
      }}>
        {/* Color bar */}
        <div style={{height:6, background:`linear-gradient(90deg,${cc},${cc}88)`}}/>

        <div style={{padding:32}}>
          {/* Header */}
          <div style={{marginBottom:24}}>
            <div style={{display:'flex', alignItems:'center', gap:8, marginBottom:8, flexWrap:'wrap'}}>
              <Chip label={cat} bg={`${cc}18`} color={cc}/>
              <Chip label={diff} bg={ds.bg} color={ds.color}/>
            </div>
            <h1 style={{fontSize:22, fontWeight:700, color:'var(--text)', margin:'0 0 8px'}}>{quiz.title}</h1>
            {quiz.description && <p style={{fontSize:14, color:'var(--text-muted)', margin:0}}>{quiz.description}</p>}
          </div>

          {/* External form badge */}
          {quiz.embed_url && (
            <div style={{
              display:'flex', alignItems:'center', gap:10, padding:'12px 16px', marginBottom:16,
              borderRadius:8, background:'rgba(0,111,191,0.06)', border:'1px solid rgba(0,111,191,0.2)',
            }}>
              <span style={{fontSize:20}}>🔗</span>
              <div>
                <div style={{fontSize:13, fontWeight:600, color:'#006fbf'}}>External Form</div>
                <div style={{fontSize:12, color:'var(--text-muted)'}}>
                  This quiz uses an embedded form. Complete it and click "Mark Complete" to record your attempt.
                </div>
              </div>
            </div>
          )}

          {/* Stats grid */}
          {!quiz.embed_url && (
            <div style={{
              display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12, marginBottom:24,
              padding:'16px', background:'var(--page-bg)', borderRadius:8, border:'1px solid var(--border)'
            }}>
              {[
                {icon:'📋', l:'Questions', v:quiz.question_count||'?'},
                {icon:'⏱',  l:'Time',      v:timeLabel},
                {icon:'🎯',  l:'Pass Score',v:`${quiz.pass_score||70}%`},
              ].map(s => (
                <div key={s.l} style={{textAlign:'center'}}>
                  <div style={{fontSize:22, marginBottom:4}}>{s.icon}</div>
                  <div style={{fontSize:16, fontWeight:700, color:'var(--text)'}}>{s.v}</div>
                  <div style={{fontSize:12, color:'var(--text-muted)'}}>{s.l}</div>
                </div>
              ))}
            </div>
          )}

          {/* Study mode toggle — only for built-in quizzes */}
          {!quiz.embed_url && (
            <div style={{
              padding:'16px', borderRadius:8, marginBottom:24,
              border:`2px solid ${studyMode?'#006fbf':'var(--border)'}`,
              background:studyMode?'rgba(0,111,191,0.04)':'var(--page-bg)',
              transition:'border-color .2s, background .2s',
            }}>
              <div style={{display:'flex', alignItems:'center', justifyContent:'space-between'}}>
                <div style={{display:'flex',alignItems:'center',gap:12}}>
                  <div style={{fontSize:24}}>📖</div>
                  <div>
                    <div style={{fontWeight:600, fontSize:14, color:'var(--text)'}}>Study Mode</div>
                    <div style={{fontSize:12, color:'var(--text-muted)'}}>
                      See correct answers immediately. No timer. Attempt is still recorded.
                    </div>
                  </div>
                </div>
                <button onClick={() => setStudyMode(v=>!v)} style={{
                  width:44, height:24, borderRadius:12, border:'none', cursor:'pointer',
                  background:studyMode?'#006fbf':'#cdd5dc', position:'relative', flexShrink:0,
                  transition:'background .2s',
                }}>
                  <span style={{
                    position:'absolute', top:2, left:studyMode?22:2, width:20, height:20,
                    borderRadius:10, background:'white', transition:'left .2s',
                    boxShadow:'0 1px 3px rgba(0,0,0,0.2)',
                  }}/>
                </button>
              </div>
              {studyMode && (
                <div style={{marginTop:12, paddingTop:12, borderTop:'1px solid rgba(0,111,191,0.15)', fontSize:12, color:'#006fbf'}}>
                  ✓ Immediate feedback · ✓ Explanations shown · ✓ No time pressure
                </div>
              )}
            </div>
          )}

          {/* Action buttons */}
          <div style={{display:'flex', gap:12}}>
            <d2l-button onClick={onBack}>Back</d2l-button>
            <d2l-button primary onClick={() => onStart(studyMode)} style={{flex:1}}>
              {quiz.embed_url ? '🔗 Open Form' : studyMode ? '📖 Start Study Session' : '▶ Start Quiz'}
            </d2l-button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Question Navigator ─────────────────────────────────────────────────────────
function QNavigator({ questions, current, answers, flagged, onNavigate }) {
  const getStyle = (q, idx) => {
    const isAnswered = answers[q.id] !== undefined && answers[q.id] !== null && answers[q.id] !== ''
    const isFlagged  = flagged.has(q.id)
    const isCurrent  = idx === current
    if (isCurrent)  return { background:'#006fbf', color:'white', boxShadow:'0 0 0 3px rgba(0,111,191,0.3)' }
    if (isFlagged)  return { background:'#d97706', color:'white' }
    if (isAnswered) return { background:'#1a7a3c', color:'white' }
    return { background:'rgba(255,255,255,0.06)', color:'#94a3b8', border:'1px solid rgba(255,255,255,0.1)' }
  }
  const answered = questions.filter(q => answers[q.id] !== undefined && answers[q.id] !== null && answers[q.id] !== '').length

  return (
    <div style={{height:'100%', display:'flex', flexDirection:'column'}}>
      <div style={{padding:'12px', borderBottom:'1px solid rgba(255,255,255,0.08)'}}>
        <div style={{fontSize:11, fontWeight:600, color:'#94a3b8', marginBottom:6}}>QUESTIONS</div>
        <div style={{fontSize:11, color:'#64748b'}}>{answered}/{questions.length} answered</div>
      </div>
      <div style={{flex:1, overflowY:'auto', padding:10}}>
        <div style={{display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:6}}>
          {questions.map((q, idx) => (
            <button key={q.id} onClick={() => onNavigate(idx)}
              data-qidx={idx}
              style={{
                width:'100%', aspectRatio:'1', borderRadius:8, fontSize:11,
                fontWeight:700, border:'none', cursor:'pointer', transition:'all .1s',
                ...getStyle(q, idx),
              }}>
              {idx + 1}
            </button>
          ))}
        </div>
      </div>
      <div style={{padding:10, borderTop:'1px solid rgba(255,255,255,0.08)', fontSize:11, lineHeight:1.8}}>
        {[
          {c:'#006fbf', l:'Current'},
          {c:'#1a7a3c', l:'Answered'},
          {c:'#d97706', l:'Flagged'},
          {c:'rgba(255,255,255,0.06)', l:'Not answered', border:'1px solid rgba(255,255,255,0.1)'},
        ].map(i => (
          <div key={i.l} style={{display:'flex', alignItems:'center', gap:6, color:'#64748b'}}>
            <span style={{width:10,height:10,borderRadius:2,background:i.c,border:i.border,flexShrink:0}}/>
            {i.l}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Submit Modal ──────────────────────────────────────────────────────────────
function SubmitModal({ questions, answers, flagged, onConfirm, onCancel, submitting }) {
  const answered   = questions.filter(q => answers[q.id] !== undefined && answers[q.id] !== null && answers[q.id] !== '').length
  const unanswered = questions.length - answered
  return (
    <div style={{position:'fixed',inset:0,display:'flex',alignItems:'center',justifyContent:'center',zIndex:200,background:'rgba(0,0,0,0.6)'}}>
      <div style={{background:'var(--card-bg)',borderRadius:8,padding:32,maxWidth:400,width:'calc(100% - 32px)',boxShadow:'0 8px 32px rgba(0,0,0,0.2)',border:'1px solid var(--border)'}}>
        <h2 style={{fontSize:20,fontWeight:600,color:'var(--text)',margin:'0 0 8px'}}>Submit Assessment?</h2>
        <p style={{fontSize:14,color:'var(--text-muted)',margin:'0 0 20px'}}>Your responses will be graded and recorded.</p>
        <div style={{display:'flex',flexDirection:'column',gap:8,marginBottom:24}}>
          <div style={{display:'flex',justifyContent:'space-between',padding:'10px 14px',borderRadius:6,background:'var(--page-bg)'}}>
            <span style={{fontSize:14,color:'var(--text)'}}>Answered</span>
            <span style={{fontSize:14,fontWeight:700,color:'#1a7a3c'}}>{answered}/{questions.length}</span>
          </div>
          {unanswered > 0 && (
            <div style={{display:'flex',justifyContent:'space-between',padding:'10px 14px',borderRadius:6,background:'#fef9e7'}}>
              <span style={{fontSize:14,color:'#92400e'}}>⚠ Unanswered</span>
              <span style={{fontSize:14,fontWeight:700,color:'#d97706'}}>{unanswered}</span>
            </div>
          )}
          {flagged.size > 0 && (
            <div style={{display:'flex',justifyContent:'space-between',padding:'10px 14px',borderRadius:6,background:'#fef9e7'}}>
              <span style={{fontSize:14,color:'#92400e'}}>⚑ Flagged for review</span>
              <span style={{fontSize:14,fontWeight:700,color:'#d97706'}}>{flagged.size}</span>
            </div>
          )}
        </div>
        <div style={{display:'flex',gap:10}}>
          <d2l-button onClick={onCancel} disabled={submitting || undefined}>Keep Going</d2l-button>
          <d2l-button primary onClick={onConfirm} disabled={submitting || undefined}>
            {submitting ? 'Submitting...' : 'Submit Assessment'}
          </d2l-button>
        </div>
      </div>
    </div>
  )
}

// ── Normalize embed URL (adds ?embedded=true for Google Forms) ────────────────
function normalizeEmbedUrl(url) {
  if (!url) return ''
  try {
    const u = new URL(url)
    // Google Forms: replace /viewform with /viewform?embedded=true
    if (u.hostname === 'docs.google.com' && u.pathname.includes('/forms/')) {
      if (!u.pathname.endsWith('/viewform')) {
        // strip any trailing path segment that isn't viewform
        u.pathname = u.pathname.replace(/\/(edit|closedform|preview)$/, '') + '/viewform'
      }
      u.searchParams.set('embedded', 'true')
      return u.toString()
    }
    return url
  } catch {
    return url
  }
}

// ── Embedded Form Player (Google Forms, Typeform, etc.) ───────────────────────
function EmbedPlayer({ quiz, onFinish }) {
  const [done, setDone] = useState(false)
  const [submitting, setSub] = useState(false)
  const src = normalizeEmbedUrl(quiz.embed_url)

  const markComplete = async () => {
    setSub(true)
    try {
      // Record a completed attempt with full score (we can't grade Google Forms)
      await api.post(`/quizzes/${quiz.id}/start`, { study_mode: false })
      const r = await api.post(`/quizzes/${quiz.id}/submit`, {
        answers: {}, time_taken: 0,
      })
      setDone(true)
      setTimeout(() => onFinish({ ...r.data, quiz }), 800)
    } catch {
      setDone(true)
      setTimeout(() => onFinish({ score: 100, passed: true, earned: 1, total: 1, xp_earned: 10, results: [], quiz }), 800)
    }
    setSub(false)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100, background: '#0a1628', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px',
        background: '#0f1f3d', borderBottom: '1px solid rgba(255,255,255,0.1)',
        flexShrink: 0,
      }}>
        <button onClick={() => onFinish(null)} style={{
          background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8',
          display: 'flex', alignItems: 'center', gap: 6, fontSize: 13,
        }}>
          <X size={16}/> Exit
        </button>
        <div style={{ flex: 1, textAlign: 'center' }}>
          <span style={{ fontSize: 15, fontWeight: 600, color: '#f1f5f9' }}>{quiz.title}</span>
          <span style={{ marginLeft: 10, fontSize: 11, padding: '2px 8px', borderRadius: 10, background: 'rgba(0,111,191,0.25)', color: '#60a5fa' }}>
            External Form
          </span>
        </div>
        <d2l-button
          primary
          disabled={submitting || done || undefined}
          onClick={markComplete}
          style={{ flexShrink: 0 }}
        >
          {done ? '✓ Recorded' : submitting ? 'Saving…' : 'Mark Complete'}
        </d2l-button>
      </div>

      {/* Iframe */}
      <iframe
        src={src}
        title={quiz.title}
        style={{ flex: 1, border: 'none', width: '100%', background: '#fff' }}
        allow="camera; microphone; autoplay"
      />
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
  const [multiSel, setMultiSel]  = useState({})
  const [textAns, setTextAns]    = useState({})
  const [flagged, setFlagged]    = useState(new Set())
  const [revealed, setRevealed]  = useState(new Set())
  const [totalSecs, setTotal]    = useState(0)
  const [qSecs, setQSecs]        = useState(null)
  const [showSubmit, setShowSub] = useState(false)
  const [submitting, setSub]     = useState(false)
  const [showExit, setShowExit]  = useState(false)
  const [slideDir, setSlideDir]  = useState(1)   // 1=forward, -1=back
  const [slideKey, setSlideKey]  = useState(0)
  const totalRef  = useRef(null)
  const qRef      = useRef(null)
  const startRef  = useRef(Date.now())

  useEffect(() => {
    api.post(`/quizzes/${quiz.id}/start`, { study_mode: studyMode }).then(r => {
      setQs(r.data.questions || [])
      setAid(r.data.attempt_id)
      if (quiz.time_limit > 0) setTotal(quiz.time_limit * 60)
      setLoad(false)
    }).catch(() => setLoad(false))
    return () => { clearInterval(totalRef.current); clearInterval(qRef.current) }
  }, [])

  useEffect(() => {
    if (!quiz.time_limit || quiz.time_limit <= 0 || loading) return
    clearInterval(totalRef.current)
    totalRef.current = setInterval(() => {
      setTotal(t => { if (t <= 1) { clearInterval(totalRef.current); doSubmit(); return 0 } return t - 1 })
    }, 1000)
    return () => clearInterval(totalRef.current)
  }, [loading])

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
          setRevealed(prev => new Set([...prev, q.id]))
          setTimeout(() => setCurrent(c => Math.min(c + 1, questions.length - 1)), 600)
          return 0
        }
        return t - 1
      })
    }, 1000)
    return () => clearInterval(qRef.current)
  }, [current, loading, questions.length])

  useEffect(() => {
    const handler = e => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return
      const q = questions[current]; if (!q) return
      if (e.key === 'ArrowRight') nav(current + 1)
      else if (e.key === 'ArrowLeft') nav(current - 1)
      else if ((e.key === 'f' || e.key === 'F') && !e.ctrlKey) toggleFlag(q.id)
      else if (e.key === 'Enter' && revealed.has(q.id)) nav(current + 1)
      else if (['1','2','3','4','5','6'].includes(e.key)) {
        const i = parseInt(e.key) - 1
        if (q.options?.length > i && !revealed.has(q.id)) handleMCQAnswer(q, i)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [current, questions, revealed])

  const nav        = useCallback((i) => {
    if (i >= 0 && i < questions.length) {
      setSlideDir(i >= current ? 1 : -1)
      setSlideKey(k => k + 1)
      setCurrent(i)
    }
  }, [questions.length, current])
  const toggleFlag = useCallback(qId => { setFlagged(prev => { const s = new Set(prev); s.has(qId)?s.delete(qId):s.add(qId); return s }) }, [])

  const recordAnswer = (qId, answer) => {
    setAnswers(prev => ({ ...prev, [qId]: answer }))
    clearInterval(qRef.current)
    setRevealed(prev => new Set([...prev, qId]))
    play?.('correct')
  }

  const handleMCQAnswer = (q, i) => { if (!revealed.has(q.id)) recordAnswer(q.id, i) }
  const handleMultiToggle = (q, i) => {
    if (revealed.has(q.id)) return
    setMultiSel(prev => { const cur=prev[q.id]||[]; return {...prev,[q.id]:cur.includes(i)?cur.filter(x=>x!==i):[...cur,i]} })
  }
  const handleMultiSubmit = q => {
    const sel = multiSel[q.id] || []; if (!sel.length || revealed.has(q.id)) return
    recordAnswer(q.id, sel)
  }
  const handleText = q => {
    const v = textAns[q.id]?.trim(); if (!v || revealed.has(q.id)) return
    recordAnswer(q.id, v)
  }

  const doSubmit = async () => {
    setSub(true)
    clearInterval(totalRef.current); clearInterval(qRef.current)
    const timeTaken = Math.round((Date.now() - startRef.current) / 1000)
    const finalAnswers = { ...answers }
    Object.entries(multiSel).forEach(([k,v]) => { if (v.length && !finalAnswers[k]) finalAnswers[k] = v })
    Object.entries(textAns).forEach(([k,v]) => { if (v?.trim() && !finalAnswers[k]) finalAnswers[k] = v.trim() })
    try {
      const r = await api.post(`/quizzes/${quiz.id}/submit`, { attempt_id: attemptId, answers: finalAnswers, time_taken: timeTaken })
      onFinish({ ...r.data, quiz })
    } catch {
      onFinish({ score:0, passed:false, earned:0, total:questions.length, xp_earned:0, results:[], quiz })
    }
  }

  if (loading) return (
    <div style={{position:'fixed',inset:0,zIndex:100,display:'flex',alignItems:'center',justifyContent:'center',background:'var(--page-bg)',flexDirection:'column',gap:16}}>
      <d2l-loading-spinner size={80}/>
      <p style={{color:'var(--text-muted)'}}>Loading quiz...</p>
    </div>
  )
  if (questions.length === 0) return (
    <div style={{position:'fixed',inset:0,zIndex:100,display:'flex',alignItems:'center',justifyContent:'center',background:'var(--page-bg)',flexDirection:'column',gap:12}}>
      <AlertCircle style={{width:48,height:48,color:'var(--text-muted)'}}/>
      <p style={{color:'var(--text-muted)'}}>No questions found.</p>
      <d2l-button onClick={() => onFinish(null)}>Go Back</d2l-button>
    </div>
  )

  const q = questions[current]
  const isAnswered = qId => answers[qId] !== undefined && answers[qId] !== null && answers[qId] !== ''
  const qTimePct   = qSecs !== null ? qSecs / (quiz.time_per_question || 60) * 100 : 100
  const qTC        = qTimePct > 50 ? '#1a7a3c' : qTimePct > 20 ? '#d97706' : '#cc3333'

  const optionStyle = (q, i, isRevd) => {
    const isSelected   = answers[q.id] === i || answers[q.id] === String(i)
    const isCorrectAns = studyMode && q.correct_answers && (q.correct_answers.includes(i) || q.correct_answers.includes(String(i)))
    const isWrong      = isRevd && isSelected && !isCorrectAns
    if (isCorrectAns && isRevd) return { border:'1.5px solid #1a7a3c', background:'rgba(26,122,60,0.08)', color:'#1a7a3c' }
    if (isWrong)                return { border:'1.5px solid #cc3333', background:'rgba(204,51,51,0.08)', color:'#cc3333' }
    if (isSelected)             return { border:'1.5px solid #60a5fa', background:'rgba(96,165,250,0.12)', color:'#e2e8f0' }
    return { border:'1.5px solid rgba(255,255,255,0.12)', background:'rgba(255,255,255,0.04)', color:'#cbd5e1' }
  }

  return (
    <div style={{position:'fixed',inset:0,zIndex:100,display:'flex',flexDirection:'column',background:'#0a1628'}}>
      {/* Header */}
      <div style={{
        height:56,flexShrink:0,display:'flex',alignItems:'center',gap:12,padding:'0 16px',
        background:'#0f1f38', borderBottom:'1px solid rgba(255,255,255,0.1)',
      }}>
        <button onClick={() => setShowExit(true)} style={{
          display:'flex',alignItems:'center',gap:4,padding:'6px 12px',borderRadius:6,
          fontSize:13,color:'#94a3b8',background:'rgba(255,255,255,0.06)',border:'none',cursor:'pointer'
        }}>
          <ChevronLeft style={{width:14,height:14}}/> Exit
        </button>
        <div style={{flex:1,overflow:'hidden'}}>
          <div style={{fontSize:14,fontWeight:600,color:'#e2e8f0',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{quiz.title}</div>
          {studyMode && <div style={{fontSize:11,color:'#006fbf'}}>📖 Study Mode</div>}
        </div>
        <div style={{display:'flex',alignItems:'center',gap:16,flexShrink:0}}>
          {quiz.time_limit > 0 && (
            <div style={{display:'flex',alignItems:'center',gap:6}}>
              <style>{`
                @keyframes timerPulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.7;transform:scale(1.08)} }
              `}</style>
              <Clock style={{width:14,height:14,color:totalSecs<120?'#cc3333':'#94a3b8'}}/>
              <span style={{
                fontSize:14,fontWeight:700,fontVariantNumeric:'tabular-nums',
                color:totalSecs<120?'#ef4444':'#e2e8f0',
                animation: totalSecs < 30 ? 'timerPulse 0.8s ease infinite' : 'none',
              }}>{fmtTime(totalSecs)}</span>
            </div>
          )}
          <span style={{fontSize:13,color:'#64748b'}}><span style={{color:'#e2e8f0',fontWeight:700}}>{current+1}</span>/{questions.length}</span>
          <button onClick={() => setShowSub(true)} style={{
            display:'flex',alignItems:'center',gap:6,padding:'6px 14px',borderRadius:6,
            fontSize:13,fontWeight:700,color:'white',background:'#006fbf',border:'none',cursor:'pointer'
          }}>
            Submit
          </button>
        </div>
      </div>

      {/* Body */}
      <div style={{flex:1,display:'flex',overflow:'hidden'}}>
        {/* Navigator sidebar */}
        <div style={{width:192,flexShrink:0,background:'#060e1d',borderRight:'1px solid rgba(255,255,255,0.06)',overflow:'hidden'}}>
          <QNavigator questions={questions} current={current} answers={answers} flagged={flagged} onNavigate={nav}/>
        </div>

        {/* Question area */}
        <div style={{flex:1,overflowY:'auto',background:'#0a1628'}}>
          <style>{`
            @keyframes slideQR { from { opacity:0; transform:translateX(44px) } to { opacity:1; transform:translateX(0) } }
            @keyframes slideQL { from { opacity:0; transform:translateX(-44px) } to { opacity:1; transform:translateX(0) } }
          `}</style>
          <div key={slideKey} style={{
            maxWidth:720,margin:'0 auto',padding:'24px 24px 120px',
            animation: `${slideDir >= 0 ? 'slideQR' : 'slideQL'} 0.22s cubic-bezier(0.22,1,0.36,1) both`,
          }}>
            {/* Question meta */}
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16,flexWrap:'wrap',gap:8}}>
              <div style={{display:'flex',alignItems:'center',gap:8}}>
                <span style={{fontSize:11,fontWeight:700,padding:'3px 10px',borderRadius:99,background:'rgba(0,111,191,0.2)',color:'#93c5fd'}}>
                  {q.question_type==='mcq'?'Multiple Choice':q.question_type==='true_false'?'True / False':q.question_type==='multiple_select'?'Multi-Select':q.question_type==='short_answer'?'Short Answer':q.question_type==='fill_blank'?'Fill in Blank':'Numeric'}
                </span>
                <span style={{fontSize:11,color:'#64748b'}}>· {q.points||1} pt{(q.points||1)!==1?'s':''}</span>
              </div>
              <div style={{display:'flex',alignItems:'center',gap:10}}>
                {!studyMode && qSecs !== null && !revealed.has(q.id) && (
                  <div style={{display:'flex',alignItems:'center',gap:6}}>
                    <div style={{width:56,height:4,borderRadius:99,background:'rgba(255,255,255,0.1)',overflow:'hidden'}}>
                      <div style={{height:'100%',borderRadius:99,background:qTC,width:`${qTimePct}%`,transition:'width 1s linear'}}/>
                    </div>
                    <span style={{fontSize:13,fontWeight:700,fontVariantNumeric:'tabular-nums',color:qTC,minWidth:28}}>{qSecs}s</span>
                  </div>
                )}
                <button onClick={() => toggleFlag(q.id)} style={{
                  display:'flex',alignItems:'center',gap:5,padding:'5px 10px',borderRadius:6,fontSize:12,fontWeight:700,cursor:'pointer',
                  background:flagged.has(q.id)?'rgba(217,119,6,0.15)':'rgba(255,255,255,0.05)',
                  color:flagged.has(q.id)?'#f59e0b':'#64748b',
                  border:`1px solid ${flagged.has(q.id)?'rgba(217,119,6,0.3)':'rgba(255,255,255,0.06)'}`,
                }}>
                  <Flag style={{width:12,height:12}}/>{flagged.has(q.id)?'Flagged':'Flag'}
                </button>
              </div>
            </div>

            {q.question_image && <img src={q.question_image} alt="q" style={{width:'100%',maxHeight:280,objectFit:'contain',borderRadius:8,marginBottom:16,border:'1px solid rgba(255,255,255,0.1)'}}/>}

            <p style={{fontSize:18,fontWeight:500,lineHeight:1.7,color:'#f1f5f9',marginBottom:24}}>{q.question_text}</p>

            {/* MCQ / T-F */}
            {(q.question_type==='mcq'||q.question_type==='true_false') && q.options && (
              <div style={{display:'flex',flexDirection:'column',gap:10}}>
                {q.options.map((opt, i) => {
                  const isSelected   = answers[q.id]===i||answers[q.id]===String(i)
                  const isRevd       = revealed.has(q.id)
                  const isCorrectAns = studyMode && q.correct_answers && (q.correct_answers.includes(i)||q.correct_answers.includes(String(i)))
                  const st           = optionStyle(q, i, isRevd)
                  return (
                    <button key={i} onClick={() => handleMCQAnswer(q, i)} disabled={isRevd} style={{
                      display:'flex',alignItems:'center',gap:12,padding:'12px 16px',borderRadius:8,
                      width:'100%',textAlign:'left',cursor:isRevd?'default':'pointer',transition:'all .15s',...st
                    }}>
                      <span style={{
                        width:26,height:26,borderRadius:99,display:'flex',alignItems:'center',justifyContent:'center',
                        fontSize:11,fontWeight:700,flexShrink:0,
                        background:isSelected?'#3b82f6':isCorrectAns&&isRevd?'#1a7a3c':isRevd&&answers[q.id]===i?'#cc3333':'rgba(255,255,255,0.15)',
                        color:'white',
                      }}>{String.fromCharCode(65+i)}</span>
                      <span style={{flex:1,fontSize:15,fontWeight:500,color:'#e2e8f0'}}>{opt}</span>
                      {isCorrectAns&&isRevd && <CheckCircle style={{width:16,height:16,flexShrink:0,color:'#1a7a3c'}}/>}
                      {!isCorrectAns&&isRevd&&isSelected && <XCircle style={{width:16,height:16,flexShrink:0,color:'#cc3333'}}/>}
                    </button>
                  )
                })}
              </div>
            )}

            {/* Multi-select */}
            {q.question_type==='multiple_select' && q.options && (
              <div style={{display:'flex',flexDirection:'column',gap:10}}>
                <p style={{fontSize:12,color:'#64748b',margin:'0 0 4px'}}>Select all that apply</p>
                {q.options.map((opt, i) => {
                  const sel = (multiSel[q.id]||[]).includes(i)
                  return (
                    <label key={i} style={{
                      display:'flex',alignItems:'center',gap:12,padding:'12px 16px',borderRadius:8,cursor:revealed.has(q.id)?'default':'pointer',
                      border:`1.5px solid ${sel?'#a78bfa':'rgba(255,255,255,0.14)'}`,
                      background:sel?'rgba(139,92,246,0.15)':'rgba(255,255,255,0.04)',
                    }}>
                      <input type="checkbox" checked={sel} disabled={revealed.has(q.id)} onChange={() => handleMultiToggle(q, i)} style={{accentColor:'#8b5cf6',width:16,height:16}}/>
                      <span style={{fontSize:14,color:'#e2e8f0'}}>{opt}</span>
                    </label>
                  )
                })}
                {!revealed.has(q.id) && (
                  <button onClick={() => handleMultiSubmit(q)} disabled={!(multiSel[q.id]||[]).length} style={{
                    padding:'11px 24px',borderRadius:8,fontWeight:700,fontSize:14,color:'white',border:'none',cursor:'pointer',
                    background:'#6366f1',opacity:!(multiSel[q.id]||[]).length?0.4:1,marginTop:4,
                  }}>Confirm Selection</button>
                )}
              </div>
            )}

            {/* Short answer / fill blank */}
            {(q.question_type==='short_answer'||q.question_type==='fill_blank') && (
              <div style={{display:'flex',gap:10}}>
                <input value={textAns[q.id]||''} disabled={revealed.has(q.id)}
                  onChange={e => setTextAns(prev=>({...prev,[q.id]:e.target.value}))}
                  onKeyDown={e => e.key==='Enter' && handleText(q)}
                  placeholder={q.question_type==='fill_blank'?'Fill in the blank...':'Type your answer...'}
                  style={{flex:1,padding:'12px 16px',borderRadius:8,background:'rgba(255,255,255,0.05)',border:'1.5px solid rgba(255,255,255,0.12)',color:'#e2e8f0',fontSize:14,outline:'none'}}/>
                {!revealed.has(q.id) && (
                  <button onClick={() => handleText(q)} disabled={!textAns[q.id]?.trim()} style={{
                    padding:'12px 20px',borderRadius:8,fontWeight:700,fontSize:14,color:'white',border:'none',cursor:'pointer',
                    background:'#006fbf',opacity:!textAns[q.id]?.trim()?0.4:1,
                  }}>Submit</button>
                )}
              </div>
            )}

            {/* Numeric */}
            {q.question_type==='numeric' && (
              <div style={{display:'flex',gap:10}}>
                <input type="number" value={textAns[q.id]||''} disabled={revealed.has(q.id)}
                  onChange={e => setTextAns(prev=>({...prev,[q.id]:e.target.value}))}
                  onKeyDown={e => e.key==='Enter' && handleText(q)}
                  placeholder="Enter numeric value..."
                  style={{flex:1,padding:'12px 16px',borderRadius:8,background:'rgba(255,255,255,0.05)',border:'1.5px solid rgba(255,255,255,0.12)',color:'#e2e8f0',fontSize:14,outline:'none'}}/>
                {!revealed.has(q.id) && (
                  <button onClick={() => handleText(q)} disabled={!textAns[q.id]} style={{
                    padding:'12px 20px',borderRadius:8,fontWeight:700,fontSize:14,color:'white',border:'none',cursor:'pointer',
                    background:'#006fbf',opacity:!textAns[q.id]?0.4:1,
                  }}>Submit</button>
                )}
              </div>
            )}

            {/* Study mode reveal */}
            {studyMode && revealed.has(q.id) && q.explanation && (
              <div style={{marginTop:20,padding:'14px 16px',borderRadius:8,background:'rgba(0,111,191,0.08)',border:'1px solid rgba(0,111,191,0.2)'}}>
                <div style={{fontSize:11,fontWeight:700,marginBottom:6,color:'#60a5fa'}}>EXPLANATION</div>
                <p style={{fontSize:14,color:'#e2e8f0',lineHeight:1.6,margin:0}}>{q.explanation}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div style={{
        flexShrink:0,height:56,display:'flex',alignItems:'center',justifyContent:'space-between',padding:'0 16px',
        background:'#060e1d',borderTop:'1px solid rgba(255,255,255,0.08)',
      }}>
        <button onClick={() => nav(current-1)} disabled={current===0} style={{
          display:'flex',alignItems:'center',gap:4,padding:'6px 14px',borderRadius:6,fontSize:13,fontWeight:600,cursor:current===0?'not-allowed':'pointer',
          color:current===0?'#334155':'#94a3b8',background:'rgba(255,255,255,0.04)',border:'none',opacity:current===0?0.4:1
        }}>
          <ChevronLeft style={{width:14,height:14}}/> Prev
        </button>
        <span style={{fontSize:11,color:'#334155',display:'none'}}>← → navigate · 1-4 answer · F flag</span>
        <div style={{display:'flex',gap:8}}>
          {current < questions.length - 1 ? (
            <button onClick={() => nav(current+1)} style={{
              display:'flex',alignItems:'center',gap:4,padding:'6px 16px',borderRadius:6,fontSize:13,fontWeight:700,color:'white',background:'#006fbf',border:'none',cursor:'pointer'
            }}>Next <ChevronRight style={{width:14,height:14}}/></button>
          ) : (
            <button onClick={() => setShowSub(true)} style={{
              display:'flex',alignItems:'center',gap:6,padding:'6px 16px',borderRadius:6,fontSize:13,fontWeight:700,color:'white',background:'#1a7a3c',border:'none',cursor:'pointer'
            }}>
              <CheckCircle style={{width:14,height:14}}/> Review &amp; Submit
            </button>
          )}
        </div>
      </div>

      {showSubmit && (
        <SubmitModal questions={questions} answers={answers} flagged={flagged} onConfirm={doSubmit} onCancel={() => setShowSub(false)} submitting={submitting}/>
      )}
      {showExit && (
        <div style={{position:'fixed',inset:0,display:'flex',alignItems:'center',justifyContent:'center',zIndex:200,background:'rgba(0,0,0,0.6)'}}>
          <div style={{background:'var(--card-bg)',borderRadius:8,padding:32,maxWidth:380,width:'calc(100% - 32px)',boxShadow:'0 8px 32px rgba(0,0,0,0.2)',border:'1px solid var(--border)'}}>
            <h2 style={{fontSize:18,fontWeight:600,color:'var(--text)',margin:'0 0 8px'}}>Exit assessment?</h2>
            <p style={{fontSize:14,color:'var(--text-muted)',margin:'0 0 24px'}}>Your progress will be lost.</p>
            <div style={{display:'flex',gap:10}}>
              <d2l-button onClick={() => setShowExit(false)}>Stay</d2l-button>
              <d2l-button onClick={() => onFinish(null)} style={{background:'#cc3333'}}>Exit</d2l-button>
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
  // Animate score ring from 0 → actual score
  const [animScore, setAnimScore] = useState(0)
  const [visible, setVisible]     = useState(false)

  useEffect(() => {
    // Slight delay so the card entrance animation plays first
    const t1 = setTimeout(() => setVisible(true), 80)
    const t2 = setTimeout(() => {
      if (!result) return
      const target = result.score || 0
      let current = 0
      const step = Math.ceil(target / 40)
      const iv = setInterval(() => {
        current = Math.min(target, current + step)
        setAnimScore(current)
        if (current >= target) clearInterval(iv)
      }, 28)
      return () => clearInterval(iv)
    }, 300)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [result?.score])

  if (!result) return (
    <div style={{textAlign:'center',padding:'80px 20px'}}>
      <d2l-button primary onClick={onBrowse}>Back to Quizzes</d2l-button>
    </div>
  )

  const { score=0, passed=false, earned=0, total=1, xp_earned=0, results=[], time_taken=0, needs_grading=false } = result
  const circ       = 2 * Math.PI * 54
  const animDash   = (animScore / 100) * circ
  const scoreColor = score >= 80 ? '#1a7a3c' : score >= 60 ? '#d97706' : '#cc3333'
  const pendingCount  = results.filter(r => r.needs_grading).length
  const skippedCount  = results.filter(r => r.skipped && !r.needs_grading).length
  const correctCount  = results.filter(r => r.is_correct).length
  const wrongCount    = results.filter(r => !r.is_correct && !r.needs_grading && !r.skipped).length
  const negativeTotal = results.reduce((s,r) => s + (r.points_earned < 0 ? r.points_earned : 0), 0)

  return (
    <div style={{maxWidth:720, margin:'0 auto', paddingBottom:40,
      opacity: visible ? 1 : 0, transform: visible ? 'translateY(0)' : 'translateY(20px)',
      transition: 'opacity 0.45s cubic-bezier(0.22,1,0.36,1), transform 0.45s cubic-bezier(0.22,1,0.36,1)',
    }}>
      {passed && !needs_grading && <Confetti/>}

      {/* Pending grading banner */}
      {needs_grading && (
        <div style={{
          display:'flex', alignItems:'center', gap:12, padding:'14px 20px', marginBottom:16,
          borderRadius:8, background:'rgba(245,158,11,0.08)', border:'1.5px solid rgba(245,158,11,0.3)',
        }}>
          <Clock style={{width:20,height:20,color:'#d97706',flexShrink:0}}/>
          <div>
            <div style={{fontSize:14,fontWeight:700,color:'#92400e'}}>Awaiting Teacher Evaluation</div>
            <div style={{fontSize:12,color:'#b45309'}}>
              {pendingCount} short-answer question{pendingCount>1?'s':''} need{pendingCount===1?'s':''} manual grading by your instructor. Your final score will update once graded.
            </div>
          </div>
        </div>
      )}

      {/* Score card */}
      <div style={{
        background:'var(--card-bg)', border:'1px solid var(--border)', borderRadius:10,
        overflow:'hidden', marginBottom:20, boxShadow:'0 4px 20px rgba(0,0,0,0.08)',
      }}>
        <div style={{height:5, background: needs_grading ? '#d97706' : passed ? '#1a7a3c' : '#cc3333',
          transition:'background 0.5s ease'}}/>
        <div style={{padding:32,textAlign:'center'}}>

          {/* Score ring — animates from 0 */}
          <div style={{display:'flex',justifyContent:'center',marginBottom:20,position:'relative',width:140,margin:'0 auto 20px'}}>
            <svg width={140} height={140} style={{transform:'rotate(-90deg)',display:'block'}}>
              <circle cx={70} cy={70} r={54} fill="none" stroke="var(--border)" strokeWidth={10}/>
              <circle cx={70} cy={70} r={54} fill="none" stroke={scoreColor} strokeWidth={10}
                strokeDasharray={`${animDash} ${circ - animDash}`} strokeLinecap="round"/>
            </svg>
            <div style={{position:'absolute',inset:0,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center'}}>
              <span style={{fontSize:34,fontWeight:900,color:scoreColor,lineHeight:1,fontVariantNumeric:'tabular-nums'}}>
                {animScore}%
              </span>
              <span style={{
                fontSize:10,fontWeight:800,padding:'2px 8px',borderRadius:99,marginTop:5,letterSpacing:'0.05em',
                background: needs_grading ? 'rgba(245,158,11,0.15)' : passed ? '#edfcf1' : '#fef0f0',
                color:      needs_grading ? '#d97706' : passed ? '#1a7a3c' : '#cc3333',
              }}>
                {needs_grading ? 'PENDING' : passed ? 'PASS' : 'FAIL'}
              </span>
            </div>
          </div>

          <h2 style={{fontSize:22,fontWeight:700,color:'var(--text)',margin:'0 0 6px'}}>
            {needs_grading ? 'Submitted for Grading' : passed ? (score>=90?'Outstanding!':score>=80?'Excellent!':'Well Done!') : 'Keep Practising'}
          </h2>
          <p style={{fontSize:14,color:'var(--text-muted)',margin:'0 0 24px'}}>
            {needs_grading
              ? 'Your auto-graded score is shown. Short answers will be evaluated by your instructor.'
              : passed
                ? `Passed with ${score-(quiz?.pass_score||70)}% above the pass mark`
                : `${(quiz?.pass_score||70)-score}% below the pass mark of ${quiz?.pass_score||70}%`}
          </p>

          {/* Stats row */}
          <style>{`
            @keyframes statPop { from { opacity:0; transform:scale(0.82) translateY(10px) } to { opacity:1; transform:scale(1) translateY(0) } }
          `}</style>
          <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:10,marginBottom:24}}>
            {[
              {l:'Points',   v:`${earned}/${total}`,    c:'#006fbf'},
              {l:'XP Earned',v:`+${xp_earned}`,         c:'#d97706'},
              {l:'Correct',  v:`${correctCount}/${results.length}`, c:'#1a7a3c'},
              {l:'Time',     v:time_taken>0?fmtTime(time_taken):'—', c:'#494c4e'},
            ].map((s, si) => (
              <div key={s.l} style={{
                padding:12,borderRadius:8,textAlign:'center',background:'var(--page-bg)',border:'1px solid var(--border)',
                animation:'statPop 0.4s cubic-bezier(0.22,1,0.36,1) both',
                animationDelay:`${300 + si * 80}ms`,
              }}>
                <div style={{fontSize:20,fontWeight:900,color:s.c}}>{s.v}</div>
                <div style={{fontSize:11,color:'var(--text-muted)',marginTop:2}}>{s.l}</div>
              </div>
            ))}
          </div>

          {/* Breakdown badges */}
          <div style={{display:'flex',justifyContent:'center',gap:8,flexWrap:'wrap',marginBottom:24}}>
            {correctCount > 0  && <span style={{fontSize:12,padding:'4px 12px',borderRadius:20,background:'#edfcf1',color:'#1a7a3c',fontWeight:600}}>✓ {correctCount} correct</span>}
            {wrongCount > 0    && <span style={{fontSize:12,padding:'4px 12px',borderRadius:20,background:'#fef0f0',color:'#cc3333',fontWeight:600}}>✗ {wrongCount} wrong</span>}
            {skippedCount > 0  && <span style={{fontSize:12,padding:'4px 12px',borderRadius:20,background:'var(--page-bg)',color:'var(--text-muted)',fontWeight:600,border:'1px solid var(--border)'}}>— {skippedCount} skipped</span>}
            {pendingCount > 0  && <span style={{fontSize:12,padding:'4px 12px',borderRadius:20,background:'rgba(245,158,11,0.12)',color:'#d97706',fontWeight:600}}>⏳ {pendingCount} pending</span>}
            {negativeTotal < 0 && <span style={{fontSize:12,padding:'4px 12px',borderRadius:20,background:'rgba(204,51,51,0.08)',color:'#cc3333',fontWeight:600}}>−{Math.abs(negativeTotal)} pts deducted</span>}
          </div>

          <div style={{display:'flex',gap:12,justifyContent:'center',flexWrap:'wrap'}}>
            <d2l-button onClick={onBrowse}>All Quizzes</d2l-button>
            <d2l-button primary onClick={onRetake}>Retake Quiz</d2l-button>
          </div>
        </div>
      </div>

      {/* Per-question review */}
      {results.length > 0 && (
        <div style={{background:'var(--card-bg)',border:'1px solid var(--border)',borderRadius:10,overflow:'hidden'}}>
          <div style={{padding:'16px 20px',borderBottom:'1px solid var(--border)',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
            <h3 style={{margin:0,fontSize:15,fontWeight:700,color:'var(--text)'}}>Question Review</h3>
            <span style={{fontSize:12,color:'var(--text-muted)'}}>{results.length} questions</span>
          </div>
          {results.map((r, i) => {
            const isPending = r.needs_grading
            const isSkipped = r.skipped && !isPending
            const bg  = isPending ? 'rgba(245,158,11,0.06)' : isSkipped ? 'transparent' : r.is_correct ? 'rgba(26,122,60,0.03)' : 'rgba(204,51,51,0.03)'
            const dot = isPending ? '#d97706' : isSkipped ? '#94a3b8' : r.is_correct ? '#1a7a3c' : '#cc3333'
            return (
              <div key={i} style={{borderBottom:'1px solid var(--border)',background:expand[i]?'var(--page-bg)':bg,transition:'background 0.15s'}}>
                <button onClick={() => setExpand(prev=>({...prev,[i]:!prev[i]}))} style={{
                  width:'100%',display:'flex',alignItems:'center',gap:12,padding:'13px 20px',
                  background:'transparent',border:'none',cursor:'pointer',textAlign:'left',
                }}>
                  {/* Status icon */}
                  <div style={{width:28,height:28,borderRadius:99,flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center',
                    background:`${dot}18`,border:`1.5px solid ${dot}40`}}>
                    {isPending
                      ? <Clock style={{width:14,height:14,color:dot}}/>
                      : isSkipped
                        ? <span style={{fontSize:14,color:dot}}>—</span>
                        : r.is_correct
                          ? <CheckCircle style={{width:14,height:14,color:dot}}/>
                          : <XCircle style={{width:14,height:14,color:dot}}/>}
                  </div>
                  <div style={{flex:1,minWidth:0}}>
                    <p style={{margin:0,fontSize:14,fontWeight:500,color:'var(--text)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                      <span style={{fontSize:11,fontWeight:700,color:'var(--text-muted)',marginRight:6}}>Q{i+1}.</span>
                      {r.question_text}
                    </p>
                    <p style={{margin:'2px 0 0',fontSize:12,color:dot}}>
                      {isPending ? '⏳ Awaiting teacher grading'
                        : isSkipped ? '— Not answered (0 pts)'
                        : r.is_correct ? `+${r.points_earned} pts`
                        : r.points_earned < 0 ? `${r.points_earned} pts (negative marking)`
                        : '0 pts'}
                    </p>
                  </div>
                  {expand[i]
                    ? <ChevronUp style={{width:15,height:15,flexShrink:0,color:'var(--text-muted)'}}/>
                    : <ChevronDown style={{width:15,height:15,flexShrink:0,color:'var(--text-muted)'}}/>}
                </button>

                {expand[i] && (
                  <div style={{padding:'4px 20px 16px 60px',borderTop:'1px solid var(--border)'}}>
                    {/* Short/fill answer display */}
                    {(r.question_type==='short_answer'||r.question_type==='fill_blank') && (
                      <div style={{marginBottom:10}}>
                        {r.user_answer ? (
                          <div style={{padding:'8px 12px',borderRadius:6,background:'var(--page-bg)',border:'1px solid var(--border)',fontSize:13,color:'var(--text)'}}>
                            <span style={{fontWeight:600,color:'var(--text-muted)',marginRight:8}}>Your answer:</span>{r.user_answer}
                          </div>
                        ) : (
                          <div style={{padding:'8px 12px',borderRadius:6,background:'var(--page-bg)',fontSize:13,color:'var(--text-muted)',fontStyle:'italic'}}>Not answered</div>
                        )}
                        {r.correct_answers?.length > 0 && (
                          <div style={{marginTop:6,padding:'8px 12px',borderRadius:6,background:'#edfcf1',border:'1px solid #bbf7d0',fontSize:13,color:'#1a7a3c'}}>
                            <span style={{fontWeight:600,marginRight:8}}>Accepted answers:</span>{r.correct_answers.join(' / ')}
                          </div>
                        )}
                      </div>
                    )}
                    {/* MCQ / true-false options */}
                    {r.options?.length > 0 && (
                      <div style={{display:'flex',flexDirection:'column',gap:4,marginBottom:10}}>
                        {r.options.map((opt, oi) => {
                          const isCorr = r.correct_answers?.includes(oi)||r.correct_answers?.map?.(Number).includes(oi)
                          const isUser = r.user_answer===oi||+r.user_answer===oi
                          return (
                            <div key={oi} style={{
                              display:'flex',alignItems:'center',gap:8,padding:'8px 12px',borderRadius:6,fontSize:13,
                              background:isCorr?'#edfcf1':isUser&&!isCorr?'#fef0f0':'var(--page-bg)',
                              border:`1px solid ${isCorr?'#bbf7d0':isUser&&!isCorr?'#fecaca':'var(--border)'}`,
                            }}>
                              <span style={{width:20,height:20,borderRadius:99,display:'flex',alignItems:'center',justifyContent:'center',
                                background:isCorr?'#1a7a3c':isUser&&!isCorr?'#cc3333':'#cdd5dc',
                                color:'white',fontSize:10,fontWeight:700,flexShrink:0}}>
                                {String.fromCharCode(65+oi)}
                              </span>
                              <span style={{flex:1,color:'var(--text)'}}>{opt}</span>
                              {isCorr  && <span style={{fontSize:11,fontWeight:700,color:'#1a7a3c'}}>✓ Correct answer</span>}
                              {isUser&&!isCorr && <span style={{fontSize:11,fontWeight:700,color:'#cc3333'}}>✗ Your answer</span>}
                              {isUser&&isCorr  && <span style={{fontSize:11,fontWeight:700,color:'#1a7a3c'}}>✓ Your answer (correct)</span>}
                            </div>
                          )
                        })}
                      </div>
                    )}
                    {r.explanation && (
                      <div style={{fontSize:13,padding:'10px 12px',borderRadius:6,background:'rgba(0,111,191,0.06)',color:'var(--text)',border:'1px solid rgba(0,111,191,0.15)',display:'flex',gap:8}}>
                        <span style={{flexShrink:0}}>💡</span>
                        <span>{r.explanation}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Main export ───────────────────────────────────────────────────────────────
export default function QuizMe() {
  const [phase, setPhase]     = useState('browse')
  const [quiz, setQuiz]       = useState(null)
  const [studyMode, setStudy] = useState(false)
  const [result, setResult]   = useState(null)

  return (
    <div>
      {phase === 'browse'  && <QuizBrowser onSelect={q => { setQuiz(q); setPhase('confirm') }}/>}
      {phase === 'confirm' && <QuizConfirm quiz={quiz} onStart={sm => { setStudy(sm); setPhase('play') }} onBack={() => setPhase('browse')}/>}
      {phase === 'play'    && (quiz?.embed_url
        ? <EmbedPlayer quiz={quiz} onFinish={r => { setResult(r); setPhase(r ? 'result' : 'browse') }}/>
        : <QuizPlayer quiz={quiz} studyMode={studyMode} onFinish={r => { setResult(r); setPhase(r ? 'result' : 'browse') }}/>
      )}
      {phase === 'result'  && <QuizResult result={result} quiz={quiz} onRetake={() => setPhase('confirm')} onBrowse={() => setPhase('browse')}/>}
    </div>
  )
}
