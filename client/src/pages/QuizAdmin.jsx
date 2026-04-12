/**
 * QuizAdmin — full-screen quiz creator + research-level analytics
 * Route: /quiz-admin (AdminGuard protected)
 */
import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../utils/api'
import {
  Plus, Trash2, Edit2, Save, X, ArrowUp, ArrowDown,
  BarChart2, ChevronLeft, Eye, Upload, AlertCircle,
  CheckCircle, XCircle, RefreshCw, Download
} from 'lucide-react'

// ─────────────────────────────────────────────────────────────────────────────
const Q_TYPES = [
  { v:'mcq',             l:'Multiple Choice',   i:'◉', c:'#6366f1' },
  { v:'true_false',      l:'True / False',      i:'⊤', c:'#10b981' },
  { v:'multiple_select', l:'Multi-Select',       i:'☑', c:'#8b5cf6' },
  { v:'short_answer',    l:'Short Answer',       i:'T', c:'#f59e0b' },
  { v:'numeric',         l:'Numeric',            i:'#', c:'#0ea5e9' },
  { v:'fill_blank',      l:'Fill in Blank',      i:'_', c:'#14b8a6' },
]
const CATEGORIES = ['Water Quality','Field Work','Data Literacy','Ecology','Regional','Safety','Sampling','General']
const DIFFICULTIES = ['Beginner','Intermediate','Advanced']
const STATUS_COLORS = {
  published: { bg:'rgba(16,185,129,0.1)', c:'#10b981' },
  draft:     { bg:'rgba(100,116,139,0.1)', c:'#94a3b8' },
  archived:  { bg:'rgba(99,102,241,0.1)', c:'#818cf8' },
}
const iS = (extra={}) => ({ width:'100%', background:'var(--page-bg)', border:'1.5px solid var(--border)', borderRadius:9, padding:'8px 12px', fontSize:13, color:'var(--text)', outline:'none', ...extra })
const lS = { fontSize:12, fontWeight:600, color:'var(--text-muted)', display:'block', marginBottom:5 }

// ── Helpers ───────────────────────────────────────────────────────────────────
function parseOpts(v) {
  if (!v) return []
  if (typeof v === 'string') { try { return JSON.parse(v) } catch { return [] } }
  return Array.isArray(v) ? v : []
}

function parseToken() {
  return localStorage.getItem('sb_access_token') || localStorage.getItem('sw_token') || ''
}

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:3001/api')

// ── Quiz list panel ───────────────────────────────────────────────────────────
function QuizList({ onEdit, onAnalytics, onNew }) {
  const [quizzes, setQuizzes] = useState([])
  const [loading, setLoading] = useState(true)

  const reload = useCallback(() => {
    setLoading(true)
    api.get('/quizzes').then(r => setQuizzes(r.data.quizzes||[])).finally(() => setLoading(false))
  }, [])
  useEffect(() => { reload() }, [reload])

  const del = async (q) => {
    if (!confirm(`Delete "${q.title}" and all its questions? This cannot be undone.`)) return
    await api.delete(`/quizzes/${q.id}`).catch(() => {})
    reload()
  }

  const toggle = async (q) => {
    const s = q.status === 'published' ? 'draft' : 'published'
    await api.put(`/quizzes/${q.id}`, { ...q, status: s }).catch(() => {})
    reload()
  }

  if (loading) return (
    <div className="space-y-3">
      {[1,2,3].map(i => <div key={i} className="card p-4 h-20 skeleton"/>)}
    </div>
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-sm" style={{color:'var(--text-muted)'}}>
          {quizzes.length} quizzes · {quizzes.filter(q=>q.status==='published').length} published
        </div>
        <button onClick={onNew}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-white"
          style={{background:'linear-gradient(135deg,#6366f1,#4f46e5)'}}>
          <Plus className="w-4 h-4"/> New Quiz
        </button>
      </div>

      {quizzes.length === 0 && (
        <div className="text-center py-16" style={{color:'var(--text-muted)'}}>
          <div className="text-5xl mb-3">🎓</div>
          <div className="font-bold text-base mb-2" style={{color:'var(--text)'}}>No quizzes yet</div>
          <div className="text-sm mb-4">Click "New Quiz" to build your first quiz.</div>
        </div>
      )}

      {quizzes.map(q => {
        const sc = STATUS_COLORS[q.status] || STATUS_COLORS.draft
        return (
          <div key={q.id} className="card p-4 flex items-center gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className="font-black text-sm" style={{color:'var(--text)'}}>{q.title}</span>
                <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{background:sc.bg,color:sc.c}}>{q.status}</span>
                <span className="text-xs" style={{color:'var(--text-muted)'}}>{q.difficulty}</span>
                {q.negative_marking > 0 && <span className="text-xs px-1.5 py-0.5 rounded-full" style={{background:'rgba(239,68,68,0.1)',color:'#ef4444'}}>-{q.negative_marking} neg</span>}
              </div>
              <div className="flex gap-3 text-xs" style={{color:'var(--text-muted)'}}>
                <span>📋 {q.question_count||0}q</span>
                <span>👥 {q.attempt_count||0} attempts</span>
                <span>✅ Pass {q.pass_score||70}%</span>
                {q.avg_score != null && <span>📊 Avg {Math.round(q.avg_score)}%</span>}
                <span>{(q.category||'').replace(/_/g,' ')}</span>
              </div>
            </div>
            <div className="flex gap-2 flex-shrink-0">
              {q.attempt_count > 0 && (
                <button onClick={() => onAnalytics(q)}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold"
                  style={{background:'rgba(20,184,166,0.1)',color:'#14b8a6',border:'none'}}>
                  <BarChart2 className="w-3 h-3"/> Analytics
                </button>
              )}
              <button onClick={() => toggle(q)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold"
                style={{background:q.status==='published'?'rgba(16,185,129,0.1)':'rgba(99,102,241,0.1)',color:q.status==='published'?'#10b981':'#818cf8',border:'none'}}>
                {q.status==='published'?'✅ Live':'📤 Publish'}
              </button>
              <button onClick={() => onEdit(q)}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold"
                style={{background:'rgba(99,102,241,0.1)',color:'#818cf8',border:'none'}}>
                <Edit2 className="w-3 h-3"/> Edit
              </button>
              <button onClick={() => del(q)}
                className="p-1.5 rounded-lg"
                style={{background:'rgba(239,68,68,0.08)',color:'#ef4444',border:'none'}}>
                <Trash2 className="w-4 h-4"/>
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Quiz builder ──────────────────────────────────────────────────────────────
function QuizBuilder({ quiz: initQuiz, onBack }) {
  const isNew = !initQuiz?.id
  const [quiz, setQuiz]         = useState(initQuiz)
  const [form, setForm]         = useState({
    title:             initQuiz?.title || '',
    description:       initQuiz?.description || '',
    category:          initQuiz?.category || 'Water Quality',
    difficulty:        initQuiz?.difficulty || 'Beginner',
    time_per_question: initQuiz?.time_per_question || 60,
    time_limit:        initQuiz?.time_limit || 0,
    pass_score:        initQuiz?.pass_score || 70,
    negative_marking:  initQuiz?.negative_marking || 0,
    shuffle_questions: !!initQuiz?.shuffle_questions,
    shuffle_answers:   !!initQuiz?.shuffle_answers,
    show_answers_after:initQuiz?.show_answers_after !== 0,
    status:            initQuiz?.status || 'draft',
  })
  const [questions, setQs]      = useState([])
  const [editQ, setEditQ]       = useState(null)   // null | 'new' | {question}
  const [qForm, setQF]          = useState(null)
  const [imgPreview, setImgPrev]= useState(null)
  const [saving, setSaving]     = useState(false)
  const [savingQ, setSavingQ]   = useState(false)
  const [importJson, setImpJson]= useState('')
  const [showImport, setShowImp]= useState(false)
  const imgRef = useRef(null)

  const inp = (k, v) => setForm(f => ({...f,[k]:v}))

  useEffect(() => {
    if (!quiz?.id) return
    api.get(`/quizzes/${quiz.id}`)
      .then(r => setQs(r.data.questions?.map(q => ({...q,options:parseOpts(q.options),correct_answers:parseOpts(q.correct_answers)}))||[]))
      .catch(()=>{})
  }, [quiz?.id])

  const saveQuiz = async () => {
    if (!form.title.trim()) return
    setSaving(true)
    try {
      const r = quiz?.id
        ? await api.put(`/quizzes/${quiz.id}`, form)
        : await api.post('/quizzes', form)
      setQuiz(r.data)
      if (isNew) {
        // reload questions for new quiz
      }
    } catch (e) { alert(e.response?.data?.error || 'Failed to save') }
    setSaving(false)
  }

  const blankQ = () => ({
    question_type: 'mcq',
    question_text: '',
    options: ['','','',''],
    correct_answers: [0],
    explanation: '',
    points: 1,
    negative_points: 0,
    image: null,
  })

  const openNewQ = () => {
    if (!quiz?.id) { alert('Save the quiz settings first.'); return }
    setQF(blankQ()); setEditQ('new'); setImgPrev(null)
  }
  const openEditQ = (q) => {
    setQF({ ...q, image: null })
    setImgPrev(q.question_image || null)
    setEditQ(q)
  }

  const saveQ = async () => {
    if (!qForm?.question_text?.trim()) return
    setSavingQ(true)
    const fd = new FormData()
    fd.append('question_type', qForm.question_type)
    fd.append('question_text', qForm.question_text)
    fd.append('options', JSON.stringify((qForm.options||[]).filter(o => o.trim())))
    fd.append('correct_answers', JSON.stringify(qForm.correct_answers||[]))
    fd.append('explanation', qForm.explanation||'')
    fd.append('points', String(qForm.points||1))
    fd.append('negative_points', String(qForm.negative_points||0))
    fd.append('sort_order', String(editQ==='new' ? questions.length : (editQ?.sort_order??questions.length)))
    if (qForm.image) fd.append('question_image', qForm.image)

    const token = parseToken()
    const isEdit = editQ !== 'new'
    const url = isEdit ? `${API_BASE}/quizzes/questions/${editQ.id}` : `${API_BASE}/quizzes/${quiz.id}/questions`
    try {
      const res = await fetch(url, { method: isEdit?'PUT':'POST', headers:{ Authorization:`Bearer ${token}` }, body: fd })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error||'Failed')
      const saved = { ...data, options: parseOpts(data.options), correct_answers: parseOpts(data.correct_answers) }
      setQs(prev => isEdit ? prev.map(q => q.id===saved.id?saved:q) : [...prev,saved])
      setEditQ(null); setQF(null); setImgPrev(null)
    } catch (e) { alert(e.message) }
    setSavingQ(false)
  }

  const delQ = async (q) => {
    if (!confirm('Delete this question?')) return
    await api.delete(`/quizzes/questions/${q.id}`).catch(()=>{})
    setQs(prev => prev.filter(x => x.id !== q.id))
  }

  const moveQ = (i, dir) => {
    const arr = [...questions]
    const to = i + dir
    if (to < 0 || to >= arr.length) return
    ;[arr[i], arr[to]] = [arr[to], arr[i]]
    setQs(arr)
  }

  const doImport = async () => {
    try {
      const parsed = JSON.parse(importJson)
      const questions = Array.isArray(parsed) ? parsed : parsed.questions
      if (!Array.isArray(questions)) throw new Error('Expected array of questions')
      const r = await api.post(`/quizzes/${quiz?.id}/import`, { questions })
      alert(`Imported ${r.data.imported} questions!`)
      setShowImp(false); setImpJson('')
      // reload
      const r2 = await api.get(`/quizzes/${quiz.id}`)
      setQs(r2.data.questions?.map(q => ({...q,options:parseOpts(q.options),correct_answers:parseOpts(q.correct_answers)}))||[])
    } catch (e) { alert('Import failed: ' + e.message) }
  }

  const totalPoints = questions.reduce((s,q)=>s+(+q.points||1),0)

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <button onClick={onBack} className="flex items-center gap-1 text-sm font-semibold"
          style={{color:'var(--text-muted)',background:'none',border:'none',cursor:'pointer'}}>
          <ChevronLeft className="w-4 h-4"/> Back to quizzes
        </button>
        <div className="flex-1"/>
        <button onClick={saveQuiz} disabled={saving||!form.title.trim()}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-white disabled:opacity-40"
          style={{background:'linear-gradient(135deg,#6366f1,#4f46e5)'}}>
          <Save className="w-4 h-4"/>{saving?'Saving…':quiz?.id?'Save Settings':'Create Quiz'}
        </button>
      </div>

      <div className="grid lg:grid-cols-[340px_1fr] gap-5">
        {/* Settings panel */}
        <div className="card p-5 space-y-4 self-start">
          <div className="text-sm font-bold pb-2 border-b" style={{color:'var(--text)',borderColor:'var(--border)'}}>⚙️ Quiz Settings</div>

          <div>
            <label style={lS}>Title *</label>
            <input value={form.title} onChange={e=>inp('title',e.target.value)} placeholder="Quiz title..." style={iS()}/>
          </div>
          <div>
            <label style={lS}>Description</label>
            <textarea rows={2} value={form.description} onChange={e=>inp('description',e.target.value)} style={{...iS(),resize:'none'}}/>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label style={lS}>Category</label>
              <select value={form.category} onChange={e=>inp('category',e.target.value)} style={iS()}>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label style={lS}>Difficulty</label>
              <select value={form.difficulty} onChange={e=>inp('difficulty',e.target.value)} style={iS()}>
                {DIFFICULTIES.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div>
              <label style={lS}>⏱ Sec / Question</label>
              <input type="number" min={0} value={form.time_per_question} onChange={e=>inp('time_per_question',+e.target.value)} style={iS()}/>
            </div>
            <div>
              <label style={lS}>⏱ Total Limit (min, 0=off)</label>
              <input type="number" min={0} value={form.time_limit} onChange={e=>inp('time_limit',+e.target.value)} style={iS()}/>
            </div>
            <div>
              <label style={lS}>Pass Score %</label>
              <input type="number" min={0} max={100} value={form.pass_score} onChange={e=>inp('pass_score',+e.target.value)} style={iS()}/>
            </div>
            <div>
              <label style={lS}>➖ Negative Marking</label>
              <input type="number" min={0} step={0.25} value={form.negative_marking} onChange={e=>inp('negative_marking',+e.target.value)} style={iS()}/>
            </div>
          </div>
          <div className="space-y-2">
            {[['shuffle_questions','🔀 Shuffle questions'],['shuffle_answers','🔀 Shuffle answer options'],['show_answers_after','💡 Show answers after submission']].map(([k,l]) => (
              <label key={k} className="flex items-center gap-2 cursor-pointer text-sm" style={{color:'var(--text)'}}>
                <input type="checkbox" checked={!!form[k]} onChange={e=>inp(k,e.target.checked)} className="w-4 h-4"/> {l}
              </label>
            ))}
          </div>
          <div>
            <label style={lS}>Status</label>
            <select value={form.status} onChange={e=>inp('status',e.target.value)} style={iS()}>
              <option value="draft">📝 Draft</option>
              <option value="published">✅ Published</option>
              <option value="archived">📦 Archived</option>
            </select>
          </div>

          {quiz?.id && (
            <div className="pt-2 border-t space-y-1 text-xs" style={{borderColor:'var(--border)',color:'var(--text-muted)'}}>
              <div>{questions.length} questions · {totalPoints} total pts</div>
              {form.negative_marking > 0 && <div className="text-red-400">-{form.negative_marking} pts per wrong answer</div>}
            </div>
          )}
        </div>

        {/* Questions panel */}
        <div className="space-y-4">
          {!quiz?.id ? (
            <div className="card p-10 text-center" style={{color:'var(--text-muted)'}}>
              <div className="text-4xl mb-3">💾</div>
              <div className="font-semibold mb-1" style={{color:'var(--text)'}}>Save quiz settings first</div>
              <div className="text-sm">Fill in the title on the left and click "Create Quiz" — then you can add questions.</div>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <div className="font-bold text-sm" style={{color:'var(--text)'}}>
                  📋 Questions ({questions.length})
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setShowImp(v=>!v)}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold"
                    style={{background:'rgba(20,184,166,0.1)',color:'#14b8a6',border:'1px dashed rgba(20,184,166,0.3)'}}>
                    <Upload className="w-3 h-3"/> Import JSON
                  </button>
                  <button onClick={openNewQ}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold"
                    style={{background:'rgba(99,102,241,0.1)',color:'#818cf8',border:'1px dashed rgba(99,102,241,0.3)'}}>
                    <Plus className="w-3 h-3"/> Add Question
                  </button>
                </div>
              </div>

              {/* JSON import panel */}
              {showImport && (
                <div className="card p-4 space-y-3">
                  <div className="text-sm font-bold" style={{color:'var(--text)'}}>📥 Import Questions (JSON)</div>
                  <div className="text-xs" style={{color:'var(--text-muted)'}}>
                    Paste an array of questions. Each needs: question_text, question_type, options (array), correct_answers (array of 0-based indexes), explanation (optional), points.
                  </div>
                  <textarea rows={6} value={importJson} onChange={e=>setImpJson(e.target.value)}
                    placeholder={`[\n  {\n    "question_type": "mcq",\n    "question_text": "What is pH?",\n    "options": ["A measure of acidity","A type of fish","A water color","None"],\n    "correct_answers": [0],\n    "explanation": "pH measures hydrogen ion concentration.",\n    "points": 1\n  }\n]`}
                    style={{...iS(),resize:'vertical',fontFamily:'monospace',fontSize:11}}/>
                  <div className="flex gap-2">
                    <button onClick={doImport} disabled={!importJson.trim()}
                      className="px-4 py-2 rounded-lg text-sm font-bold text-white disabled:opacity-40"
                      style={{background:'#14b8a6'}}>Import</button>
                    <button onClick={()=>{setShowImp(false);setImpJson('')}}
                      className="px-4 py-2 rounded-lg text-sm" style={{background:'var(--border)',color:'var(--text-muted)'}}>
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {questions.length === 0 && !editQ && (
                <div className="card p-10 text-center" style={{color:'var(--text-muted)'}}>
                  <div className="text-4xl mb-3">📝</div>
                  <div className="font-semibold mb-1" style={{color:'var(--text)'}}>No questions yet</div>
                  <div className="text-sm">Click "Add Question" to start building.</div>
                </div>
              )}

              {/* Question cards */}
              <div className="space-y-2">
                {questions.map((q, i) => {
                  const qt = Q_TYPES.find(t=>t.v===q.question_type)||Q_TYPES[0]
                  return (
                    <div key={q.id} className="card p-4 flex items-start gap-3">
                      <div className="flex flex-col gap-1 flex-shrink-0">
                        <button onClick={()=>moveQ(i,-1)} disabled={i===0}
                          className="p-1 rounded-md disabled:opacity-30"
                          style={{background:'var(--border)',border:'none',cursor:i===0?'not-allowed':'pointer'}}>
                          <ArrowUp className="w-3 h-3" style={{color:'var(--text-muted)'}}/>
                        </button>
                        <span className="text-center text-xs font-bold" style={{color:'var(--text-muted)'}}>{i+1}</span>
                        <button onClick={()=>moveQ(i,1)} disabled={i===questions.length-1}
                          className="p-1 rounded-md disabled:opacity-30"
                          style={{background:'var(--border)',border:'none',cursor:i===questions.length-1?'not-allowed':'pointer'}}>
                          <ArrowDown className="w-3 h-3" style={{color:'var(--text-muted)'}}/>
                        </button>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{background:`${qt.c}18`,color:qt.c}}>{qt.i} {qt.l}</span>
                          <span className="text-xs" style={{color:'var(--text-muted)'}}>{q.points}pt{q.points!==1?'s':''}</span>
                          {q.question_image && <span className="text-xs text-green-500">🖼</span>}
                        </div>
                        <p className="text-sm font-medium truncate mb-1" style={{color:'var(--text)'}}>{q.question_text}</p>
                        {(q.question_type==='mcq'||q.question_type==='true_false'||q.question_type==='multiple_select') && q.options?.length > 0 && (
                          <div className="flex gap-1 flex-wrap mt-1">
                            {q.options.map((opt,oi) => (
                              <span key={oi} className="text-xs px-2 py-0.5 rounded-full"
                                style={{background:q.correct_answers?.includes(oi)?'rgba(16,185,129,0.15)':'var(--border)',color:q.correct_answers?.includes(oi)?'#10b981':'var(--text-muted)',fontWeight:q.correct_answers?.includes(oi)?700:400}}>
                                {q.correct_answers?.includes(oi)?'✓ ':''}{opt}
                              </span>
                            ))}
                          </div>
                        )}
                        {q.explanation && <p className="text-xs italic mt-1" style={{color:'var(--text-muted)'}}>💡 {q.explanation.slice(0,80)}{q.explanation.length>80?'…':''}</p>}
                      </div>
                      <div className="flex gap-1 flex-shrink-0">
                        <button onClick={()=>openEditQ(q)} className="p-1.5 rounded-lg" style={{background:'rgba(99,102,241,0.1)',color:'#818cf8',border:'none'}}>
                          <Edit2 className="w-3 h-3"/>
                        </button>
                        <button onClick={()=>delQ(q)} className="p-1.5 rounded-lg" style={{background:'rgba(239,68,68,0.08)',color:'#ef4444',border:'none'}}>
                          <Trash2 className="w-3 h-3"/>
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Question editor */}
              {(editQ === 'new' || (editQ && editQ !== 'new')) && qForm && (
                <QuestionEditor
                  qForm={qForm} setQF={setQF}
                  imgPreview={imgPreview} setImgPrev={setImgPrev}
                  imgRef={imgRef}
                  isNew={editQ==='new'}
                  onCancel={()=>{setEditQ(null);setQF(null);setImgPrev(null)}}
                  onSave={saveQ} saving={savingQ}
                  negativeMarking={form.negative_marking}
                />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Question editor form ──────────────────────────────────────────────────────
function QuestionEditor({ qForm, setQF, imgPreview, setImgPrev, imgRef, isNew, onCancel, onSave, saving, negativeMarking }) {
  const qt = qForm.question_type

  const setOpt = (i, v) => { const o=[...qForm.options]; o[i]=v; setQF(f=>({...f,options:o})) }
  const addOpt = () => setQF(f=>({...f,options:[...f.options,'']}))
  const delOpt = (i) => {
    const o = qForm.options.filter((_,j)=>j!==i)
    const ca = qForm.correct_answers.filter(x=>x!==i).map(x=>x>i?x-1:x)
    setQF(f=>({...f,options:o,correct_answers:ca}))
  }

  return (
    <div className="card p-5 space-y-4 border-2" style={{borderColor:'rgba(99,102,241,0.3)'}}>
      <div className="text-sm font-black" style={{color:'#818cf8'}}>{isNew?'➕ New Question':'✏️ Edit Question'}</div>

      {/* Type selector */}
      <div>
        <label style={lS}>Question Type</label>
        <div className="flex flex-wrap gap-2">
          {Q_TYPES.map(t => (
            <button key={t.v} onClick={() => setQF(f => ({
              ...f,
              question_type: t.v,
              correct_answers: t.v==='true_false'?[0]:t.v==='multiple_select'?[]:f.question_type!==t.v?[0]:f.correct_answers,
              options: t.v==='true_false'?['True','False']:(f.options?.length?f.options:['','','','']),
            }))}
              className="text-xs font-semibold px-3 py-1.5 rounded-full transition-all"
              style={{border:`2px solid ${qt===t.v?t.c:'var(--border)'}`,background:qt===t.v?`${t.c}18`:'transparent',color:qt===t.v?t.c:'var(--text-muted)'}}>
              {t.i} {t.l}
            </button>
          ))}
        </div>
      </div>

      {/* Question text */}
      <div>
        <label style={lS}>Question Text *</label>
        <textarea rows={3} value={qForm.question_text}
          onChange={e=>setQF(f=>({...f,question_text:e.target.value}))}
          placeholder="Write your question here..."
          style={{...iS(),resize:'vertical'}}/>
      </div>

      {/* Image */}
      <div>
        <label style={lS}>🖼 Question Image (optional — stored on Cloudinary)</label>
        <div className="flex items-center gap-3">
          <input ref={imgRef} type="file" accept="image/*" style={{display:'none'}} onChange={e=>{
            const f=e.target.files?.[0]; if(!f) return
            setQF(prev=>({...prev,image:f})); setImgPrev(URL.createObjectURL(f))
          }}/>
          <button onClick={()=>imgRef.current?.click()}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold"
            style={{background:'var(--border)',color:'var(--text-muted)',border:'none'}}>
            <Upload className="w-3 h-3"/>{imgPreview?'Change':'Upload'} Image
          </button>
          {imgPreview && (
            <>
              <img src={imgPreview} alt="preview" className="h-14 w-20 object-cover rounded-lg border" style={{borderColor:'var(--border)'}}/>
              <button onClick={()=>{setImgPrev(null);setQF(f=>({...f,image:null}))}}
                className="p-1 rounded-lg text-xs" style={{background:'rgba(239,68,68,0.1)',color:'#ef4444',border:'none'}}>✕</button>
            </>
          )}
        </div>
      </div>

      {/* MCQ / multi-select options */}
      {(qt==='mcq'||qt==='multiple_select') && (
        <div>
          <label style={lS}>{qt==='mcq'?'Answer Options (select one correct)':'Answer Options (select all correct)'}</label>
          <div className="space-y-2">
            {qForm.options.map((opt,i) => {
              const isCor = qForm.correct_answers?.includes(i)
              return (
                <div key={i} className="flex items-center gap-2">
                  {qt==='mcq' ? (
                    <input type="radio" name="correct_radio" checked={isCor}
                      onChange={()=>setQF(f=>({...f,correct_answers:[i]}))} className="flex-shrink-0"/>
                  ) : (
                    <input type="checkbox" checked={isCor}
                      onChange={()=>setQF(f=>({...f,correct_answers:isCor?f.correct_answers.filter(x=>x!==i):[...f.correct_answers,i]}))} className="flex-shrink-0"/>
                  )}
                  <input value={opt} onChange={e=>setOpt(i,e.target.value)}
                    placeholder={`Option ${String.fromCharCode(65+i)}`}
                    style={{...iS({flex:1,width:'auto'}),borderColor:isCor?'#10b981':'var(--border)'}}/>
                  {qForm.options.length > 2 && (
                    <button onClick={()=>delOpt(i)} style={{background:'none',border:'none',cursor:'pointer',color:'var(--text-muted)',flexShrink:0}}>✕</button>
                  )}
                </div>
              )
            })}
            <button onClick={addOpt}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg"
              style={{background:'rgba(99,102,241,0.08)',color:'#818cf8',border:'1px dashed rgba(99,102,241,0.3)'}}>
              + Add Option
            </button>
          </div>
        </div>
      )}

      {/* True/False */}
      {qt==='true_false' && (
        <div>
          <label style={lS}>Correct Answer</label>
          <div className="flex gap-3">
            {['True','False'].map((tf,ti) => (
              <button key={tf} onClick={()=>setQF(f=>({...f,correct_answers:[ti],options:['True','False']}))}
                className="flex-1 py-2.5 rounded-xl font-bold text-sm"
                style={{border:`2px solid ${qForm.correct_answers?.[0]===ti?'#10b981':'var(--border)'}`,background:qForm.correct_answers?.[0]===ti?'rgba(16,185,129,0.12)':'var(--card-bg)',color:qForm.correct_answers?.[0]===ti?'#10b981':'var(--text)'}}>
                {ti===0?'✓ True':'✗ False'}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Short answer / fill blank */}
      {(qt==='short_answer'||qt==='fill_blank') && (
        <div>
          <label style={lS}>Accepted Answers (comma-separated, case-insensitive)</label>
          <input value={qForm.correct_answers?.join(', ')||''}
            onChange={e=>setQF(f=>({...f,correct_answers:e.target.value.split(',').map(s=>s.trim()).filter(Boolean)}))}
            placeholder="answer1, answer2, alternate spelling..." style={iS()}/>
          <div className="text-xs mt-1" style={{color:'var(--text-muted)'}}>Case-insensitive partial match. Add all accepted variations.</div>
        </div>
      )}

      {/* Numeric */}
      {qt==='numeric' && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label style={lS}>Correct Value</label>
            <input type="number" value={qForm.correct_answers?.[0]||''}
              onChange={e=>setQF(f=>({...f,correct_answers:[e.target.value, f.correct_answers?.[1]||0]}))} style={iS()}/>
          </div>
          <div>
            <label style={lS}>Tolerance ±</label>
            <input type="number" min={0} step={0.01} value={qForm.correct_answers?.[1]||0}
              onChange={e=>setQF(f=>({...f,correct_answers:[f.correct_answers?.[0]||0, e.target.value]}))} style={iS()}/>
          </div>
        </div>
      )}

      {/* Points */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label style={lS}>Points (correct)</label>
          <input type="number" min={0} step={0.5} value={qForm.points}
            onChange={e=>setQF(f=>({...f,points:+e.target.value}))} style={iS()}/>
        </div>
        <div>
          <label style={lS}>➖ Deduct if Wrong (override global {negativeMarking})</label>
          <input type="number" min={0} step={0.25} value={qForm.negative_points}
            onChange={e=>setQF(f=>({...f,negative_points:+e.target.value}))}
            placeholder={`default: ${negativeMarking}`} style={iS()}/>
        </div>
      </div>

      {/* Explanation */}
      <div>
        <label style={lS}>💡 Explanation (shown after attempt)</label>
        <textarea rows={2} value={qForm.explanation}
          onChange={e=>setQF(f=>({...f,explanation:e.target.value}))}
          placeholder="Explain why the answer is correct..." style={{...iS(),resize:'none'}}/>
      </div>

      <div className="flex gap-2 justify-end">
        <button onClick={onCancel}
          className="px-4 py-2 rounded-xl text-sm" style={{background:'var(--border)',color:'var(--text-muted)',border:'none'}}>
          Cancel
        </button>
        <button onClick={onSave} disabled={savingQ||!qForm.question_text?.trim()}
          className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-bold disabled:opacity-40"
          style={{background:'rgba(99,102,241,0.15)',color:'#818cf8',border:'none'}}>
          <Save className="w-3 h-3"/>{saving?'Saving…':isNew?'Add Question':'Save Changes'}
        </button>
      </div>
    </div>
  )
}

// ── Research analytics dashboard ──────────────────────────────────────────────
function Analytics({ quiz, onBack }) {
  const [data, setData]   = useState(null)
  const [loading, setL]   = useState(true)
  const [view, setView]   = useState('overview') // overview | items | attempts

  useEffect(() => {
    api.get(`/quizzes/${quiz.id}/analytics`)
      .then(r => setData(r.data))
      .finally(() => setL(false))
  }, [quiz.id])

  if (loading) return (
    <div className="flex items-center justify-center py-24 gap-3">
      <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"/>
      <span style={{color:'var(--text-muted)'}}>Loading analytics...</span>
    </div>
  )
  if (!data?.stats) return (
    <div className="text-center py-24" style={{color:'var(--text-muted)'}}>
      <AlertCircle className="w-10 h-10 mx-auto mb-3"/>
      <div>No attempt data yet for this quiz.</div>
    </div>
  )

  const { stats, item_analysis, attempts } = data

  // Score distribution bars
  const maxBucket = Math.max(...stats.score_distribution, 1)
  const bucketLabels = ['0-9','10-19','20-29','30-39','40-49','50-59','60-69','70-79','80-89','90-100']

  const discColor = (d) => d >= 0.4 ? '#10b981' : d >= 0.3 ? '#6366f1' : d >= 0.2 ? '#f59e0b' : '#ef4444'
  const pColor    = (p) => p > 0.8 ? '#10b981' : p > 0.5 ? '#6366f1' : p > 0.3 ? '#f59e0b' : '#ef4444'

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <button onClick={onBack} className="flex items-center gap-1 text-sm font-semibold"
          style={{color:'var(--text-muted)',background:'none',border:'none',cursor:'pointer'}}>
          <ChevronLeft className="w-4 h-4"/> Back to quizzes
        </button>
        <div className="flex-1"/>
        <div className="flex gap-1 p-1 rounded-xl" style={{background:'var(--card-bg)',border:'1px solid var(--border)'}}>
          {[['overview','Overview'],['items','Item Analysis'],['attempts','Attempts']].map(([v,l]) => (
            <button key={v} onClick={()=>setView(v)}
              className="px-4 py-1.5 rounded-lg text-sm font-semibold transition-all"
              style={{background:view===v?'#6366f1':'transparent',color:view===v?'white':'var(--text-muted)'}}>
              {l}
            </button>
          ))}
        </div>
      </div>

      <div className="font-black text-lg" style={{color:'var(--text)'}}>{quiz.title} — Analytics</div>

      {/* ── Overview ── */}
      {view === 'overview' && (
        <div className="space-y-5">
          {/* Key stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              {l:'Total Attempts',v:stats.total_attempts,c:'#6366f1'},
              {l:'Unique Users',v:stats.unique_users,c:'#8b5cf6'},
              {l:'Pass Rate',v:`${stats.pass_rate}%`,c:stats.pass_rate>=70?'#10b981':'#f59e0b'},
              {l:'Avg Score',v:`${stats.avg_score}%`,c:stats.avg_score>=70?'#10b981':'#f59e0b'},
            ].map(s => (
              <div key={s.l} className="card p-4 text-center">
                <div className="text-3xl font-black mb-1" style={{color:s.c}}>{s.v}</div>
                <div className="text-xs" style={{color:'var(--text-muted)'}}>{s.l}</div>
              </div>
            ))}
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            {/* Score distribution histogram */}
            <div className="card p-5">
              <div className="font-bold text-sm mb-4" style={{color:'var(--text)'}}>Score Distribution</div>
              <div className="flex items-end gap-1 h-28">
                {stats.score_distribution.map((n,i) => (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1">
                    <div className="text-xs font-bold" style={{color:'#6366f1',minHeight:16}}>{n>0?n:''}</div>
                    <div className="w-full rounded-t-sm transition-all"
                      style={{
                        height: `${Math.round((n/maxBucket)*80)}px`,
                        minHeight: n>0?4:0,
                        background: i >= 6 ? '#10b981' : i >= 4 ? '#f59e0b' : '#ef4444',
                        opacity: 0.8,
                      }}/>
                    <div className="text-center" style={{fontSize:9,color:'var(--text-muted)',transform:'rotate(-30deg)',transformOrigin:'top center',marginTop:2}}>{bucketLabels[i]}</div>
                  </div>
                ))}
              </div>
              <div className="flex justify-between mt-6 text-xs" style={{color:'var(--text-muted)'}}>
                <span style={{color:'#ef4444'}}>■ Fail</span>
                <span style={{color:'#f59e0b'}}>■ Borderline</span>
                <span style={{color:'#10b981'}}>■ Pass</span>
              </div>
            </div>

            {/* Extra stats */}
            <div className="card p-5 space-y-3">
              <div className="font-bold text-sm mb-2" style={{color:'var(--text)'}}>Score Statistics</div>
              {[
                {l:'Highest Score',v:`${stats.max_score}%`,c:'#10b981'},
                {l:'Lowest Score',v:`${stats.min_score}%`,c:'#ef4444'},
                {l:'Median Score',v:`${stats.median_score}%`,c:'#6366f1'},
                {l:'Std Deviation',v:`±${stats.std_dev}%`,c:'#f59e0b'},
                {l:'Avg Time Taken',v:stats.avg_time_sec>60?`${Math.floor(stats.avg_time_sec/60)}m ${stats.avg_time_sec%60}s`:`${stats.avg_time_sec}s`,c:'#8b5cf6'},
                {l:'Pass Count',v:`${stats.pass_count} / ${stats.total_attempts}`,c:'#10b981'},
              ].map(s => (
                <div key={s.l} className="flex items-center justify-between py-1.5 border-b last:border-0" style={{borderColor:'var(--border)'}}>
                  <span className="text-sm" style={{color:'var(--text-muted)'}}>{s.l}</span>
                  <span className="font-black text-sm" style={{color:s.c}}>{s.v}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Item Analysis ── */}
      {view === 'items' && (
        <div className="space-y-4">
          <div className="card p-4">
            <div className="font-bold text-sm mb-3" style={{color:'var(--text)'}}>📊 Item Analysis Glossary</div>
            <div className="grid md:grid-cols-2 gap-3 text-xs" style={{color:'var(--text-muted)'}}>
              <div><span className="font-bold" style={{color:'var(--text)'}}>p-value (Difficulty Index):</span> Proportion of students who answered correctly. 0.0 = impossible, 1.0 = trivial. Ideal: 0.3–0.7.</div>
              <div><span className="font-bold" style={{color:'var(--text)'}}>Discrimination Index:</span> Difference between top 27% and bottom 27% performance. ≥0.4 = Excellent, 0.3 = Good, 0.2 = Fair, &lt;0.2 = Poor.</div>
            </div>
          </div>

          {item_analysis.map((item, i) => (
            <div key={item.question_id} className="card p-5">
              <div className="flex items-start gap-3 mb-4">
                <span className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-black text-white" style={{background:'#6366f1'}}>{i+1}</span>
                <div className="flex-1">
                  <p className="font-semibold text-sm mb-1" style={{color:'var(--text)'}}>{item.question_text}</p>
                  <span className="text-xs px-2 py-0.5 rounded-full" style={{background:'var(--page-bg)',color:'var(--text-muted)'}}>{Q_TYPES.find(t=>t.v===item.question_type)?.l||item.question_type}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                <div className="rounded-xl p-3 text-center" style={{background:'var(--page-bg)'}}>
                  <div className="text-xl font-black" style={{color:pColor(item.p_value)}}>{(item.p_value*100).toFixed(0)}%</div>
                  <div className="text-xs mt-0.5" style={{color:'var(--text-muted)'}}>p-value</div>
                  <div className="text-xs font-semibold" style={{color:pColor(item.p_value)}}>{item.difficulty_label}</div>
                </div>
                <div className="rounded-xl p-3 text-center" style={{background:'var(--page-bg)'}}>
                  <div className="text-xl font-black" style={{color:discColor(item.discrimination_index)}}>{item.discrimination_index.toFixed(2)}</div>
                  <div className="text-xs mt-0.5" style={{color:'var(--text-muted)'}}>Discrimination</div>
                  <div className="text-xs font-semibold" style={{color:discColor(item.discrimination_index)}}>{item.discrimination_label}</div>
                </div>
                <div className="rounded-xl p-3 text-center" style={{background:'var(--page-bg)'}}>
                  <div className="text-xl font-black" style={{color:'#10b981'}}>{item.total_correct}</div>
                  <div className="text-xs mt-0.5" style={{color:'var(--text-muted)'}}>Got Correct</div>
                  <div className="text-xs font-semibold" style={{color:'var(--text-muted)'}}>of {item.total_attempts}</div>
                </div>
                <div className="rounded-xl p-3 text-center" style={{background:'var(--page-bg)'}}>
                  <div className="text-xl font-black" style={{color:'#6366f1'}}>{item.total_attempts}</div>
                  <div className="text-xs mt-0.5" style={{color:'var(--text-muted)'}}>Attempts</div>
                </div>
              </div>

              {/* Answer frequency bar chart (for MCQ) */}
              {item.options?.length > 0 && (
                <div>
                  <div className="text-xs font-semibold mb-2" style={{color:'var(--text-muted)'}}>ANSWER DISTRIBUTION</div>
                  <div className="space-y-1.5">
                    {item.options.map((opt, oi) => {
                      const count = item.answer_frequency?.[String(oi)] || 0
                      const pct   = item.total_attempts > 0 ? Math.round(count/item.total_attempts*100) : 0
                      const isCor = item.correct_answers?.includes(oi)
                      return (
                        <div key={oi} className="flex items-center gap-2">
                          <span className="text-xs font-bold w-5 flex-shrink-0" style={{color:isCor?'#10b981':'var(--text-muted)'}}>{String.fromCharCode(65+oi)}</span>
                          <div className="flex-1 h-5 rounded-full overflow-hidden" style={{background:'var(--border)'}}>
                            <div className="h-full rounded-full flex items-center pl-2 text-xs text-white font-bold transition-all"
                              style={{width:`${Math.max(pct,4)}%`,background:isCor?'#10b981':'#6366f1',opacity:0.85}}>
                              {pct>10?`${pct}%`:''}
                            </div>
                          </div>
                          <span className="text-xs w-10 text-right flex-shrink-0" style={{color:isCor?'#10b981':'var(--text-muted)'}}>{count} ({pct}%)</span>
                          {isCor && <CheckCircle className="w-3 h-3 flex-shrink-0 text-green-500"/>}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Flag poor items */}
              {(item.discrimination_index < 0.2 || item.p_value < 0.2 || item.p_value > 0.95) && (
                <div className="mt-3 flex items-start gap-2 p-3 rounded-xl text-xs" style={{background:'rgba(245,158,11,0.08)',color:'#b45309'}}>
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5"/>
                  <div>
                    <span className="font-bold">Review this question: </span>
                    {item.p_value < 0.2 && 'Very few students answered correctly — may be ambiguous or too hard. '}
                    {item.p_value > 0.95 && 'Almost everyone got this right — consider if it tests meaningful knowledge. '}
                    {item.discrimination_index < 0.2 && 'Low discrimination — this question doesn\'t differentiate knowledge levels well.'}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── Attempts table ── */}
      {view === 'attempts' && (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{background:'var(--page-bg)',borderBottom:'1px solid var(--border)'}}>
                  {['User','Score','Passed','Time','Date'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-bold" style={{color:'var(--text-muted)'}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {attempts.map((a, i) => (
                  <tr key={a.id} className="border-b last:border-0" style={{borderColor:'var(--border)'}}>
                    <td className="px-4 py-2.5">
                      <div className="font-semibold text-xs" style={{color:'var(--text)'}}>{a.display_name||a.username}</div>
                      <div className="text-xs" style={{color:'var(--text-muted)'}}>@{a.username}</div>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="font-black text-sm" style={{color:a.score>=70?'#10b981':a.score>=50?'#f59e0b':'#ef4444'}}>{a.score??'—'}%</span>
                    </td>
                    <td className="px-4 py-2.5">
                      {a.passed
                        ? <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{background:'#f0fdf4',color:'#10b981'}}>✓ Passed</span>
                        : <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{background:'#fef2f2',color:'#ef4444'}}>Failed</span>}
                    </td>
                    <td className="px-4 py-2.5 text-xs" style={{color:'var(--text-muted)'}}>
                      {a.time_taken ? `${Math.floor(a.time_taken/60)}m ${a.time_taken%60}s` : '—'}
                    </td>
                    <td className="px-4 py-2.5 text-xs" style={{color:'var(--text-muted)'}}>
                      {a.completed_at ? new Date(a.completed_at).toLocaleDateString() : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Page root ─────────────────────────────────────────────────────────────────
export default function QuizAdmin() {
  const navigate = useNavigate()
  const [view, setView] = useState('list')    // list | build | analytics
  const [editQuiz, setEditQuiz]   = useState(null)
  const [analyticsQuiz, setAnalyticsQuiz] = useState(null)

  return (
    <div className="max-w-5xl mx-auto space-y-4 pb-10">
      {/* Page header */}
      <div className="flex items-center justify-between pt-2">
        <div>
          <h1 className="text-2xl font-black" style={{color:'var(--text)'}}>🎓 Quiz Manager</h1>
          <p className="text-sm" style={{color:'var(--text-muted)'}}>Create, manage, and analyze quizzes</p>
        </div>
        <button onClick={() => navigate('/quiz')}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold"
          style={{background:'var(--card-bg)',color:'var(--text-muted)',border:'1px solid var(--border)'}}>
          <Eye className="w-4 h-4"/> Preview (Student View)
        </button>
      </div>

      {view === 'list' && (
        <QuizList
          onNew={() => { setEditQuiz({}); setView('build') }}
          onEdit={(q) => { setEditQuiz(q); setView('build') }}
          onAnalytics={(q) => { setAnalyticsQuiz(q); setView('analytics') }}
        />
      )}

      {view === 'build' && (
        <QuizBuilder quiz={editQuiz} onBack={() => { setEditQuiz(null); setView('list') }}/>
      )}

      {view === 'analytics' && analyticsQuiz && (
        <Analytics quiz={analyticsQuiz} onBack={() => { setAnalyticsQuiz(null); setView('list') }}/>
      )}
    </div>
  )
}
