/**
 * QuizAdmin — Brightspace-grade quiz creator with real @brightspace-ui/core components
 * Route: /quiz-admin (QuizCreatorGuard: admin, teacher, professor, researcher)
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
import '@brightspace-ui/core/components/tabs/tabs.js'
import '@brightspace-ui/core/components/tabs/tab-panel.js'
import '@brightspace-ui/core/components/inputs/input-text.js'
import '@brightspace-ui/core/components/inputs/input-textarea.js'
import '@brightspace-ui/core/components/inputs/input-number.js'
import '@brightspace-ui/core/components/inputs/input-checkbox.js'
import '@brightspace-ui/core/components/alert/alert.js'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import api from '../utils/api'
import {
  Plus, Trash2, Edit2, Save, ArrowUp, ArrowDown,
  BarChart2, ChevronLeft, Eye, Upload, AlertCircle,
  CheckCircle, RefreshCw, Sparkles, Zap, Clock
} from 'lucide-react'

// ─────────────────────────────────────────────────────────────────────────────
const Q_TYPES = [
  { v:'mcq',             l:'Multiple Choice',  i:'◉', c:'#006fbf' },
  { v:'true_false',      l:'True / False',     i:'⊤', c:'#1a7a3c' },
  { v:'multiple_select', l:'Multi-Select',     i:'☑', c:'#7b4fc4' },
  { v:'short_answer',    l:'Short Answer',     i:'T', c:'#c45f00' },
  { v:'numeric',         l:'Numeric',          i:'#', c:'#067d62' },
  { v:'fill_blank',      l:'Fill in Blank',    i:'_', c:'#494c4e' },
]
const CATEGORIES = ['Water Quality','Field Work','Data Literacy','Ecology','Regional','Safety','Sampling','General']
const DIFFICULTIES = ['Beginner','Intermediate','Advanced']

// D2L status-indicator states
const statusState = s => s === 'published' ? 'success' : s === 'archived' ? 'none' : 'default'

// ── Helpers ──────────────────────────────────────────────────────────────────
function parseOpts(v) {
  if (!v) return []
  if (typeof v === 'string') { try { return JSON.parse(v) } catch { return [] } }
  return Array.isArray(v) ? v : []
}

function parseToken() {
  return localStorage.getItem('sb_access_token') || localStorage.getItem('sw_token') || ''
}

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:3001/api')

// ── D2L Input wrappers — sync value property and forward change events ────────
// D2L inputs are web components; value must be set as a DOM property, not attribute.

function D2LText({ label, value, onChange, placeholder, required, style }) {
  const ref = useRef()
  useEffect(() => { if (ref.current) ref.current.value = value ?? '' }, [value])
  useEffect(() => {
    const el = ref.current; if (!el) return
    const h = e => onChange(e.target.value)
    el.addEventListener('change', h)
    return () => el.removeEventListener('change', h)
  }, [onChange])
  return (
    <d2l-input-text
      ref={ref} label={label}
      placeholder={placeholder || ''}
      required={required || undefined}
      style={{ width: '100%', ...style }}
    />
  )
}

function D2LTextarea({ label, value, onChange, rows = 3, placeholder }) {
  const ref = useRef()
  useEffect(() => { if (ref.current) ref.current.value = value ?? '' }, [value])
  useEffect(() => {
    const el = ref.current; if (!el) return
    const h = e => onChange(e.target.value)
    el.addEventListener('change', h)
    return () => el.removeEventListener('change', h)
  }, [onChange])
  return (
    <d2l-input-textarea
      ref={ref} label={label}
      rows={rows}
      placeholder={placeholder || ''}
      style={{ width: '100%' }}
    />
  )
}

function D2LNumber({ label, value, onChange, min, max, step }) {
  const ref = useRef()
  useEffect(() => { if (ref.current) ref.current.value = value ?? 0 }, [value])
  useEffect(() => {
    const el = ref.current; if (!el) return
    const h = e => onChange(+e.target.value)
    el.addEventListener('change', h)
    return () => el.removeEventListener('change', h)
  }, [onChange])
  return (
    <d2l-input-number
      ref={ref} label={label}
      min={min} max={max} step={step}
      style={{ width: '100%' }}
    />
  )
}

function D2LCheckbox({ label, checked, onChange }) {
  const ref = useRef()
  useEffect(() => { if (ref.current) ref.current.checked = !!checked }, [checked])
  useEffect(() => {
    const el = ref.current; if (!el) return
    const h = e => onChange(e.target.checked)
    el.addEventListener('change', h)
    return () => el.removeEventListener('change', h)
  }, [onChange])
  return <d2l-input-checkbox ref={ref}>{label}</d2l-input-checkbox>
}

// D2L uses CSS class `.d2l-input-select` on a native <select> (no custom element)
const selectStyle = {
  WebkitAppearance: 'none',
  MozAppearance: 'none',
  appearance: 'none',
  background: '#fff',
  border: 'none',
  borderRadius: '0.3rem',
  boxShadow: 'inset 0 2px 0 1px rgba(177,185,190,0.2)',
  color: '#202122',
  fontSize: '0.8rem',
  padding: '0.4rem 2.2rem 0.4rem 0.75rem',
  outline: '1px solid #cdd5dc',
  outlineOffset: -1,
  width: '100%',
  backgroundImage: `url("data:image/svg+xml,%3Csvg width='11' height='7' viewBox='0 0 11 7' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 2l4.5 4M10 2L5.5 6' stroke='%23565A5C' stroke-width='2' fill='none' stroke-linecap='round'/%3E%3C/svg%3E")`,
  backgroundRepeat: 'no-repeat',
  backgroundPosition: 'right 0.75rem center',
}

// ── Quiz list panel ──────────────────────────────────────────────────────────
function QuizList({ onEdit, onAnalytics, onNew }) {
  const [quizzes, setQuizzes] = useState([])
  const [loading, setLoading] = useState(true)

  const reload = useCallback(() => {
    setLoading(true)
    api.get('/quizzes').then(r => setQuizzes(r.data.quizzes || [])).finally(() => setLoading(false))
  }, [])
  useEffect(() => { reload() }, [reload])

  const del = async (q) => {
    if (!confirm(`Delete "${q.title}" and all its data? This cannot be undone.`)) return
    try {
      await api.delete(`/quizzes/${q.id}`)
      reload()
    } catch (e) {
      alert('Delete failed: ' + (e.response?.data?.error || e.message))
    }
  }

  const toggle = async (q) => {
    const s = q.status === 'published' ? 'draft' : 'published'
    await api.put(`/quizzes/${q.id}`, { ...q, status: s }).catch(() => {})
    reload()
  }

  const CAT_COL = { 'Water Quality':'#006fbf','Field Work':'#067d62','Data Literacy':'#7b4fc4','Ecology':'#0a7c5b','Regional':'#c45f00','Safety':'#cc3333','Sampling':'#0094d9','General':'#494c4e' }
  const catC = c => CAT_COL[(c||'').replace(/_/g,' ')] || '#494c4e'

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
      <d2l-loading-spinner size="80" />
    </div>
  )

  return (
    <>
      <style>{`
        @keyframes qCardIn { from { opacity:0; transform:translateY(18px) } to { opacity:1; transform:translateY(0) } }
        .qz-admin-card { transition: box-shadow 0.18s ease, transform 0.18s ease; }
        .qz-admin-card:hover { transform: translateY(-3px) !important; box-shadow: 0 10px 32px rgba(0,111,191,0.16) !important; }
      `}</style>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: 8 }}>
        <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>
          {quizzes.length} quiz{quizzes.length !== 1 ? 'zes' : ''} · {quizzes.filter(q => q.status === 'published').length} published
        </span>
        <d2l-button primary onClick={onNew}>+ New Quiz</d2l-button>
      </div>

      {quizzes.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '4rem 1rem', color: 'var(--text-muted)' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🎓</div>
          <div style={{ fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>No quizzes yet</div>
          <div style={{ fontSize: 13 }}>Click "New Quiz" to create your first quiz.</div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))', gap: 14 }}>
          {quizzes.map((q, idx) => {
            const cc = catC(q.category)
            const stBg = q.status === 'published' ? '#edfcf1' : q.status === 'archived' ? '#f1f5f9' : '#fef9e7'
            const stC  = q.status === 'published' ? '#1a7a3c' : q.status === 'archived' ? '#64748b' : '#976500'
            return (
              <div key={q.id} className="qz-admin-card card" style={{
                padding: 0, overflow: 'hidden',
                animation: 'qCardIn 0.35s ease both',
                animationDelay: `${idx * 55}ms`,
              }}>
                {/* Category color bar */}
                <div style={{ height: 5, background: `linear-gradient(90deg,${cc},${cc}77)` }}/>
                <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {/* Title + status */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)', lineHeight: 1.3, marginBottom: 3 }}>{q.title}</div>
                      {q.description && (
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{q.description}</div>
                      )}
                    </div>
                    <span style={{ flexShrink: 0, fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 99, background: stBg, color: stC, whiteSpace: 'nowrap' }}>{q.status}</span>
                  </div>
                  {/* Chips */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                    {q.category && <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 99, background: `${cc}18`, color: cc }}>{q.category.replace(/_/g,' ')}</span>}
                    {q.difficulty && <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 99, background: 'var(--page-bg)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>{q.difficulty}</span>}
                    {q.negative_marking > 0 && <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 99, background: 'rgba(204,51,51,0.08)', color: '#cc3333', border: '1px solid rgba(204,51,51,0.15)' }}>−{q.negative_marking} neg</span>}
                  </div>
                  {/* Stats */}
                  <div style={{ display: 'flex', gap: 14, fontSize: 12, color: 'var(--text-muted)', flexWrap: 'wrap' }}>
                    <span>📋 {q.question_count || 0} questions</span>
                    <span>👥 {q.attempt_count || 0} attempts</span>
                    <span>🎯 Pass {q.pass_score || 70}%</span>
                    {q.avg_score != null && (
                      <span style={{ color: q.avg_score >= (q.pass_score||70) ? '#1a7a3c' : '#c45f00', fontWeight: 700 }}>
                        Avg {Math.round(q.avg_score)}%
                      </span>
                    )}
                  </div>
                  {/* Action row */}
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', paddingTop: 8, borderTop: '1px solid var(--border)', alignItems: 'center' }}>
                    {q.attempt_count > 0 && (
                      <button onClick={() => onAnalytics(q)} style={{ fontSize: 12, padding: '5px 10px', borderRadius: 6, background: 'rgba(0,111,191,0.07)', color: '#006fbf', border: '1px solid rgba(0,111,191,0.2)', cursor: 'pointer', fontWeight: 600 }}>
                        📊 Analytics
                      </button>
                    )}
                    <button onClick={() => toggle(q)} style={{ fontSize: 12, padding: '5px 10px', borderRadius: 6, cursor: 'pointer', fontWeight: 600,
                      background: q.status === 'published' ? 'rgba(204,51,51,0.06)' : 'rgba(26,122,60,0.06)',
                      color: q.status === 'published' ? '#cc3333' : '#1a7a3c',
                      border: `1px solid ${q.status === 'published' ? 'rgba(204,51,51,0.2)' : 'rgba(26,122,60,0.2)'}`,
                    }}>
                      {q.status === 'published' ? '⊘ Unpublish' : '▶ Publish'}
                    </button>
                    <button onClick={() => onEdit(q)} style={{ fontSize: 12, padding: '5px 10px', borderRadius: 6, background: 'var(--page-bg)', color: 'var(--text)', border: '1px solid var(--border)', cursor: 'pointer', fontWeight: 600 }}>
                      ✏ Edit
                    </button>
                    <button onClick={() => del(q)} style={{ fontSize: 12, padding: '5px 10px', borderRadius: 6, background: 'rgba(204,51,51,0.06)', color: '#cc3333', border: '1px solid rgba(204,51,51,0.18)', cursor: 'pointer', fontWeight: 600, marginLeft: 'auto' }}>
                      🗑 Delete
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </>
  )
}

// ── Quiz builder ─────────────────────────────────────────────────────────────
function QuizBuilder({ quiz: initQuiz, onBack }) {
  const isNew = !initQuiz?.id
  const [quiz, setQuiz]          = useState(initQuiz)
  const [form, setForm]          = useState({
    title:              initQuiz?.title || '',
    description:        initQuiz?.description || '',
    category:           initQuiz?.category || 'Water Quality',
    difficulty:         initQuiz?.difficulty || 'Beginner',
    time_per_question:  initQuiz?.time_per_question || 60,
    time_limit:         initQuiz?.time_limit || 0,
    pass_score:         initQuiz?.pass_score || 70,
    negative_marking:   initQuiz?.negative_marking || 0,
    shuffle_questions:  !!initQuiz?.shuffle_questions,
    shuffle_answers:    !!initQuiz?.shuffle_answers,
    show_answers_after: initQuiz?.show_answers_after !== 0,
    status:             initQuiz?.status || 'published',
    embed_url:          initQuiz?.embed_url || '',
  })
  const [questions, setQs]       = useState([])
  const [editQ, setEditQ]        = useState(null)
  const [qForm, setQF]           = useState(null)
  const [imgPreview, setImgPrev] = useState(null)
  const [saving, setSaving]      = useState(false)
  const [savingQ, setSavingQ]    = useState(false)
  const [importJson, setImpJson] = useState('')
  const [showImport, setShowImp] = useState(false)
  const [showAI, setShowAI]      = useState(false)
  const [aiText, setAiText]      = useState('')
  const [aiCount, setAiCount]    = useState(5)
  const [aiGenerating, setAiGen] = useState(false)
  const [aiPreview, setAiPreview]= useState([])
  const [aiError, setAiErr]      = useState('')
  const imgRef = useRef(null)

  const inp = useCallback((k, v) => setForm(f => ({ ...f, [k]: v })), [])

  useEffect(() => {
    if (!quiz?.id) return
    api.get(`/quizzes/${quiz.id}`)
      .then(r => setQs(r.data.questions?.map(q => ({
        ...q,
        options: parseOpts(q.options),
        correct_answers: parseOpts(q.correct_answers)
      })) || []))
      .catch(() => {})
  }, [quiz?.id])

  const saveQuiz = async () => {
    if (!form.title.trim()) return
    setSaving(true)
    try {
      const r = quiz?.id
        ? await api.put(`/quizzes/${quiz.id}`, form)
        : await api.post('/quizzes', form)
      setQuiz(r.data)
    } catch (e) { alert(e.response?.data?.error || 'Failed to save') }
    setSaving(false)
  }

  const blankQ = () => ({
    question_type: 'mcq', question_text: '',
    options: ['','','',''], correct_answers: [0],
    explanation: '', points: 1, negative_points: 0, image: null,
  })

  const openNewQ  = () => {
    if (!quiz?.id) { alert('Save quiz settings first, then add questions.'); return }
    if (editQ && qForm?.question_text?.trim()) {
      if (!confirm('You have an unsaved question open. Discard it and start a new one?')) return
    }
    setQF(blankQ()); setEditQ('new'); setImgPrev(null)
    // Scroll to editor
    setTimeout(() => document.getElementById('q-editor')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
  }
  const openEditQ = (q) => { setQF({ ...q, image: null }); setImgPrev(q.question_image || null); setEditQ(q) }

  const saveQ = async () => {
    if (!qForm?.question_text?.trim()) return
    setSavingQ(true)
    const fd = new FormData()
    fd.append('question_type', qForm.question_type)
    fd.append('question_text', qForm.question_text)
    fd.append('options', JSON.stringify((qForm.options || []).filter(o => o.trim())))
    fd.append('correct_answers', JSON.stringify(qForm.correct_answers || []))
    fd.append('explanation', qForm.explanation || '')
    fd.append('points', String(qForm.points || 1))
    fd.append('negative_points', String(qForm.negative_points || 0))
    fd.append('sort_order', String(editQ === 'new' ? questions.length : (editQ?.sort_order ?? questions.length)))
    if (qForm.image) fd.append('question_image', qForm.image)

    const token = parseToken()
    const isEdit = editQ !== 'new'
    const url = isEdit ? `${API_BASE}/quizzes/questions/${editQ.id}` : `${API_BASE}/quizzes/${quiz.id}/questions`
    try {
      const res  = await fetch(url, { method: isEdit ? 'PUT' : 'POST', headers: { Authorization: `Bearer ${token}` }, body: fd })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed')
      const saved = { ...data, options: parseOpts(data.options), correct_answers: parseOpts(data.correct_answers) }
      setQs(prev => isEdit ? prev.map(q => q.id === saved.id ? saved : q) : [...prev, saved])
      setEditQ(null); setQF(null); setImgPrev(null)
    } catch (e) { alert(e.message) }
    setSavingQ(false)
  }

  const delQ  = async (q) => { if (!confirm('Delete this question?')) return; await api.delete(`/quizzes/questions/${q.id}`).catch(() => {}); setQs(prev => prev.filter(x => x.id !== q.id)) }
  const moveQ = (i, dir) => { const arr=[...questions]; const to=i+dir; if(to<0||to>=arr.length) return; [arr[i],arr[to]]=[arr[to],arr[i]]; setQs(arr) }

  const doImport = async () => {
    try {
      const parsed = JSON.parse(importJson)
      const qs = Array.isArray(parsed) ? parsed : parsed.questions
      if (!Array.isArray(qs)) throw new Error('Expected array of questions')
      const r = await api.post(`/quizzes/${quiz?.id}/import`, { questions: qs })
      alert(`Imported ${r.data.imported} questions!`)
      setShowImp(false); setImpJson('')
      const r2 = await api.get(`/quizzes/${quiz.id}`)
      setQs(r2.data.questions?.map(q => ({ ...q, options: parseOpts(q.options), correct_answers: parseOpts(q.correct_answers) })) || [])
    } catch (e) { alert('Import failed: ' + e.message) }
  }

  const doAiGenerate = async () => {
    if (!aiText.trim()) return
    setAiGen(true); setAiErr(''); setAiPreview([])
    try {
      const r = await api.post('/quizzes/ai-generate', { text: aiText, count: aiCount, difficulty: form.difficulty, category: form.category })
      setAiPreview(r.data.questions || [])
    } catch (e) { setAiErr(e.response?.data?.error || 'AI generation failed. Check GEMINI_API_KEY.') }
    setAiGen(false)
  }

  const doImportAiQuestions = async (selected) => {
    if (!quiz?.id) { alert('Save quiz settings first.'); return }
    try {
      const r = await api.post(`/quizzes/${quiz.id}/import`, { questions: selected })
      alert(`Added ${r.data.imported} AI-generated questions!`)
      setShowAI(false); setAiText(''); setAiPreview([])
      const r2 = await api.get(`/quizzes/${quiz.id}`)
      setQs(r2.data.questions?.map(q => ({ ...q, options: parseOpts(q.options), correct_answers: parseOpts(q.correct_answers) })) || [])
    } catch (e) { alert('Failed: ' + (e.response?.data?.error || e.message)) }
  }

  const totalPoints = questions.reduce((s, q) => s + (+q.points || 1), 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <d2l-button-subtle text="Back to quizzes" onClick={onBack} />
        <div style={{ flex: 1 }} />
        <d2l-button
          primary
          disabled={saving || !form.title.trim() || undefined}
          onClick={saveQuiz}
        >
          {saving ? 'Saving…' : quiz?.id ? 'Save Settings' : 'Create Quiz'}
        </d2l-button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(300px,340px) 1fr', gap: 20, alignItems: 'start' }}>
        {/* ── Settings panel ── */}
        <div className="card" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 13, paddingBottom: 10, borderBottom: '1px solid var(--border)', color: 'var(--text)' }}>
            Quiz Settings
          </div>

          <D2LText label="Title *" value={form.title} onChange={v => inp('title', v)} placeholder="Quiz title…" required />
          <D2LTextarea label="Description" value={form.description} onChange={v => inp('description', v)} rows={2} placeholder="Brief description…" />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Category</label>
              <select value={form.category} onChange={e => inp('category', e.target.value)} style={selectStyle}>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Difficulty</label>
              <select value={form.difficulty} onChange={e => inp('difficulty', e.target.value)} style={selectStyle}>
                {DIFFICULTIES.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <D2LNumber label="Sec / Question" value={form.time_per_question} onChange={v => inp('time_per_question', v)} min={0} />
            <D2LNumber label="Total Limit (min, 0=off)" value={form.time_limit} onChange={v => inp('time_limit', v)} min={0} />
            <D2LNumber label="Pass Score %" value={form.pass_score} onChange={v => inp('pass_score', v)} min={0} max={100} />
            <D2LNumber label="Negative Marking" value={form.negative_marking} onChange={v => inp('negative_marking', v)} min={0} step={0.25} />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <D2LCheckbox label="Shuffle questions" checked={form.shuffle_questions} onChange={v => inp('shuffle_questions', v)} />
            <D2LCheckbox label="Shuffle answer options" checked={form.shuffle_answers} onChange={v => inp('shuffle_answers', v)} />
            <D2LCheckbox label="Show correct answers after submission" checked={form.show_answers_after} onChange={v => inp('show_answers_after', v)} />
          </div>

          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Status</label>
            <select value={form.status} onChange={e => inp('status', e.target.value)} style={selectStyle}>
              <option value="draft">Draft</option>
              <option value="published">Published</option>
              <option value="archived">Archived</option>
            </select>
          </div>

          {/* External embed (Google Forms, Typeform, etc.) */}
          <div style={{ paddingTop: 12, borderTop: '1px solid var(--border)' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
              <span>🔗</span> External Embed <span style={{ fontWeight: 400, fontSize: 10 }}>(optional)</span>
            </div>
            <D2LText
              label="Google Form / Typeform URL"
              value={form.embed_url}
              onChange={v => inp('embed_url', v)}
              placeholder="https://docs.google.com/forms/d/…"
            />
            {form.embed_url && (
              <div style={{ marginTop: 6, padding: '6px 10px', borderRadius: 6, background: 'rgba(0,111,191,0.06)', border: '1px solid rgba(0,111,191,0.2)', fontSize: 11, color: '#006fbf' }}>
                ✓ Students will complete this form inside the quiz player instead of built-in questions.
              </div>
            )}
          </div>

          {quiz?.id && (
            <div style={{ paddingTop: 8, borderTop: '1px solid var(--border)', fontSize: 12, color: 'var(--text-muted)' }}>
              <div>{questions.length} questions · {totalPoints} total pts</div>
              {form.negative_marking > 0 && <div style={{ color: '#cc3333', marginTop: 4 }}>−{form.negative_marking} pts per wrong answer</div>}
            </div>
          )}
        </div>

        {/* ── Questions panel ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {!quiz?.id ? (
            <div className="card" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>💾</div>
              <div style={{ fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>Save quiz settings first</div>
              <div style={{ fontSize: 13 }}>Fill in the title and click "Create Quiz" — then you can add questions.</div>
            </div>
          ) : (
            <>
              {/* Question toolbar */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)' }}>
                  Questions ({questions.length})
                </span>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <d2l-button-subtle text="AI Generate" onClick={() => setShowAI(v => !v)} />
                  <d2l-button-subtle text="Import JSON" onClick={() => setShowImp(v => !v)} />
                  <d2l-button primary onClick={openNewQ}>+ Add Question</d2l-button>
                </div>
              </div>

              {/* AI Generate panel */}
              {showAI && (
                <div className="card" style={{ padding: 20, border: '1px solid rgba(0,111,191,0.3)', background: 'rgba(0,111,191,0.03)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                    <Sparkles size={16} style={{ color: '#006fbf' }} />
                    <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)' }}>AI Question Generator</span>
                    <span style={{ fontSize: 11, padding: '2px 10px', borderRadius: 20, marginLeft: 'auto', background: 'rgba(0,111,191,0.1)', color: '#006fbf' }}>Gemini 1.5 Flash · Free</span>
                  </div>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
                    Paste lecture notes, articles, or textbook excerpts — AI generates quiz questions from the content.
                  </p>
                  <D2LTextarea
                    label="Source Text"
                    value={aiText}
                    onChange={setAiText}
                    rows={5}
                    placeholder="Paste text here… e.g. 'Water hardness refers to dissolved minerals…'"
                  />
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, marginTop: 12 }}>
                    <div style={{ width: 100 }}>
                      <D2LNumber label="Questions" value={aiCount} onChange={setAiCount} min={1} max={20} />
                    </div>
                    <d2l-button primary disabled={!aiText.trim() || aiGenerating || undefined} onClick={doAiGenerate}>
                      {aiGenerating ? 'Generating…' : 'Generate'}
                    </d2l-button>
                    <d2l-button-subtle text="Close" onClick={() => { setShowAI(false); setAiText(''); setAiPreview([]) }} />
                  </div>

                  {aiError && (
                    <d2l-alert type="error" style={{ marginTop: 12 }}>{aiError}</d2l-alert>
                  )}

                  {aiPreview.length > 0 && (
                    <div style={{ marginTop: 16 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>
                          {aiPreview.length} questions generated — review before adding:
                        </span>
                        <d2l-button primary onClick={() => doImportAiQuestions(aiPreview)}>Add All to Quiz</d2l-button>
                      </div>
                      <div style={{ maxHeight: 320, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {aiPreview.map((q, i) => (
                          <div key={i} className="card" style={{ padding: 12 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
                              <strong style={{ fontSize: 13, color: 'var(--text)' }}>{i + 1}. {q.question_text}</strong>
                              <span style={{ fontSize: 11, flexShrink: 0, padding: '2px 8px', borderRadius: 12, background: 'rgba(0,111,191,0.1)', color: '#006fbf' }}>{q.question_type}</span>
                            </div>
                            {q.options?.length > 0 && (
                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, marginBottom: 6 }}>
                                {q.options.map((o, oi) => {
                                  const correct = (q.correct_answers || []).includes(oi)
                                  return (
                                    <span key={oi} style={{ fontSize: 12, padding: '3px 8px', borderRadius: 6, background: correct ? 'rgba(26,122,60,0.1)' : 'var(--page-bg)', color: correct ? '#1a7a3c' : 'var(--text-muted)' }}>
                                      {String.fromCharCode(65 + oi)}) {o}
                                    </span>
                                  )
                                })}
                              </div>
                            )}
                            {q.explanation && <div style={{ fontSize: 11, color: '#64748b' }}>💡 {q.explanation}</div>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* JSON import panel */}
              {showImport && (
                <div className="card" style={{ padding: 16 }}>
                  <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text)', marginBottom: 8 }}>Import Questions (JSON)</div>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10 }}>
                    Paste an array of questions. Each needs: question_text, question_type, options (array), correct_answers (array of 0-based indexes).
                  </p>
                  <D2LTextarea
                    label="JSON"
                    value={importJson}
                    onChange={setImpJson}
                    rows={6}
                    placeholder={'[\n  {\n    "question_type": "mcq",\n    "question_text": "What is pH?",\n    "options": ["Acidity measure","A fish type","Water color","None"],\n    "correct_answers": [0],\n    "points": 1\n  }\n]'}
                  />
                  <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                    <d2l-button primary disabled={!importJson.trim() || undefined} onClick={doImport}>Import</d2l-button>
                    <d2l-button-subtle text="Cancel" onClick={() => { setShowImp(false); setImpJson('') }} />
                  </div>
                </div>
              )}

              {questions.length === 0 && !editQ && (
                <div className="card" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                  <div style={{ fontSize: 40, marginBottom: 12 }}>📝</div>
                  <div style={{ fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>No questions yet</div>
                  <div style={{ fontSize: 13 }}>Click "+ Add Question" to start building, or use AI Generate.</div>
                </div>
              )}

              {/* Question list */}
              {questions.length > 0 && (
                <d2l-list separators="all">
                  {questions.map((q, i) => {
                    const qt = Q_TYPES.find(t => t.v === q.question_type) || Q_TYPES[0]
                    return (
                      <d2l-list-item key={q.id} label={q.question_text}>
                        <div slot="illustration" style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: '4px 0' }}>
                          <button onClick={() => moveQ(i, -1)} disabled={i === 0}
                            style={{ background: 'none', border: 'none', cursor: i === 0 ? 'not-allowed' : 'pointer', opacity: i === 0 ? 0.3 : 1, padding: 2 }}>
                            <ArrowUp size={12} style={{ color: 'var(--text-muted)' }} />
                          </button>
                          <span style={{ textAlign: 'center', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', lineHeight: 1 }}>{i + 1}</span>
                          <button onClick={() => moveQ(i, 1)} disabled={i === questions.length - 1}
                            style={{ background: 'none', border: 'none', cursor: i === questions.length - 1 ? 'not-allowed' : 'pointer', opacity: i === questions.length - 1 ? 0.3 : 1, padding: 2 }}>
                            <ArrowDown size={12} style={{ color: 'var(--text-muted)' }} />
                          </button>
                        </div>
                        <d2l-list-item-content>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                            <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 12, background: `${qt.c}18`, color: qt.c }}>{qt.i} {qt.l}</span>
                            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{q.points} pt{q.points !== 1 ? 's' : ''}</span>
                            {q.question_image && <span style={{ fontSize: 11, color: '#1a7a3c' }}>🖼 image</span>}
                          </div>
                          <div slot="supporting-info" style={{ fontSize: 13, color: 'var(--text)', marginTop: 2, maxWidth: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {q.question_text}
                          </div>
                          {(q.question_type === 'mcq' || q.question_type === 'multiple_select') && q.options?.length > 0 && (
                            <div slot="supporting-info" style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
                              {q.options.map((opt, oi) => {
                                const correct = q.correct_answers?.includes(oi)
                                return (
                                  <span key={oi} style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: correct ? 'rgba(26,122,60,0.12)' : 'var(--border)', color: correct ? '#1a7a3c' : 'var(--text-muted)', fontWeight: correct ? 700 : 400 }}>
                                    {correct ? '✓ ' : ''}{opt}
                                  </span>
                                )
                              })}
                            </div>
                          )}
                        </d2l-list-item-content>
                        <div slot="actions" style={{ display: 'flex', gap: 4 }}>
                          <d2l-button-subtle text="Edit" onClick={() => openEditQ(q)} />
                          <d2l-button-icon text="Delete" icon="tier1:delete" onClick={() => delQ(q)} />
                        </div>
                      </d2l-list-item>
                    )
                  })}
                </d2l-list>
              )}

              {/* Question editor */}
              {(editQ === 'new' || (editQ && editQ !== 'new')) && qForm && (
                <QuestionEditor
                  qForm={qForm} setQF={setQF}
                  imgPreview={imgPreview} setImgPrev={setImgPrev}
                  imgRef={imgRef}
                  isNew={editQ === 'new'}
                  onCancel={() => { setEditQ(null); setQF(null); setImgPrev(null) }}
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

// ── Question editor form ─────────────────────────────────────────────────────
function QuestionEditor({ qForm, setQF, imgPreview, setImgPrev, imgRef, isNew, onCancel, onSave, saving, negativeMarking }) {
  const qt = qForm.question_type

  const setOpt = (i, v) => { const o = [...qForm.options]; o[i] = v; setQF(f => ({ ...f, options: o })) }
  const addOpt = () => setQF(f => ({ ...f, options: [...f.options, ''] }))
  const delOpt = (i) => {
    const o  = qForm.options.filter((_, j) => j !== i)
    const ca = qForm.correct_answers.filter(x => x !== i).map(x => x > i ? x - 1 : x)
    setQF(f => ({ ...f, options: o, correct_answers: ca }))
  }

  return (
    <div id="q-editor" className="card" style={{ padding: 20, border: '2px solid rgba(0,111,191,0.25)', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ fontWeight: 800, fontSize: 14, color: '#006fbf' }}>{isNew ? '+ New Question' : 'Edit Question'}</div>

      {/* Type selector */}
      <div>
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8 }}>QUESTION TYPE</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {Q_TYPES.map(t => (
            <button key={t.v}
              onClick={() => setQF(f => ({
                ...f,
                question_type: t.v,
                correct_answers: t.v === 'true_false' ? [0] : t.v === 'multiple_select' ? [] : f.question_type !== t.v ? [0] : f.correct_answers,
                options: t.v === 'true_false' ? ['True','False'] : (f.options?.length ? f.options : ['','','','']),
              }))}
              style={{
                fontSize: 12, fontWeight: 600, padding: '5px 12px', borderRadius: 20, cursor: 'pointer',
                border: `2px solid ${qt === t.v ? t.c : 'var(--border)'}`,
                background: qt === t.v ? `${t.c}18` : 'transparent',
                color: qt === t.v ? t.c : 'var(--text-muted)',
              }}>
              {t.i} {t.l}
            </button>
          ))}
        </div>
      </div>

      <D2LTextarea
        label="Question Text *"
        value={qForm.question_text}
        onChange={v => setQF(f => ({ ...f, question_text: v }))}
        rows={3}
        placeholder="Write your question here…"
      />

      {/* Image upload */}
      <div>
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8 }}>Question Image (optional)</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          {/* Use label+htmlFor — works 100% reliably; d2l web components swallow programmatic clicks */}
          <label htmlFor="q-img-file" style={{
            display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer',
            fontSize: 13, fontWeight: 600, color: '#006fbf',
            padding: '6px 14px', borderRadius: 6,
            border: '1px solid #006fbf', background: 'rgba(0,111,191,0.06)',
          }}>
            📎 {imgPreview ? 'Change Image' : 'Upload Image'}
          </label>
          <input id="q-img-file" ref={imgRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => {
            const f = e.target.files?.[0]; if (!f) return
            setQF(prev => ({ ...prev, image: f })); setImgPrev(URL.createObjectURL(f))
          }} />
          {imgPreview && (
            <>
              <img src={imgPreview} alt="preview" style={{ height: 56, width: 80, objectFit: 'cover', borderRadius: 6, border: '1px solid var(--border)' }} />
              <button onClick={() => { setImgPrev(null); setQF(f => ({ ...f, image: null })); if (imgRef.current) imgRef.current.value = '' }}
                style={{ fontSize: 12, padding: '4px 10px', borderRadius: 6, background: 'rgba(204,51,51,0.1)', color: '#cc3333', border: '1px solid rgba(204,51,51,0.2)', cursor: 'pointer' }}>✕ Remove</button>
            </>
          )}
        </div>
      </div>

      {/* MCQ / multi-select options */}
      {(qt === 'mcq' || qt === 'multiple_select') && (
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8 }}>
            {qt === 'mcq' ? 'ANSWER OPTIONS (select one correct)' : 'ANSWER OPTIONS (select all correct)'}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {qForm.options.map((opt, i) => {
              const isCor = qForm.correct_answers?.includes(i)
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
                  {qt === 'mcq' ? (
                    <input type="radio" name="correct_radio" checked={isCor}
                      onChange={() => setQF(f => ({ ...f, correct_answers: [i] }))}
                      style={{ flexShrink: 0, width: 16, height: 16, cursor: 'pointer', accentColor: '#006fbf' }} />
                  ) : (
                    <input type="checkbox" checked={isCor}
                      onChange={() => setQF(f => ({ ...f, correct_answers: isCor ? f.correct_answers.filter(x => x !== i) : [...f.correct_answers, i] }))}
                      style={{ flexShrink: 0, width: 16, height: 16, cursor: 'pointer', accentColor: '#006fbf' }} />
                  )}
                  <input value={opt} onChange={e => setOpt(i, e.target.value)}
                    placeholder={`Option ${String.fromCharCode(65 + i)}`}
                    style={{
                      flex: 1, minWidth: 0, padding: '8px 12px', borderRadius: 6, fontSize: 13,
                      border: `1.5px solid ${isCor ? '#1a7a3c' : '#cdd5dc'}`,
                      background: isCor ? 'rgba(26,122,60,0.05)' : '#ffffff',
                      color: '#202122', outline: 'none', fontFamily: 'inherit',
                      boxSizing: 'border-box',
                    }} />
                  {qForm.options.length > 2 && (
                    <button onClick={() => delOpt(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#888', flexShrink: 0, fontSize: 16, lineHeight: 1 }}>✕</button>
                  )}
                </div>
              )
            })}
            <button onClick={addOpt} style={{ fontSize: 12, fontWeight: 600, padding: '5px 12px', borderRadius: 8, background: 'rgba(0,111,191,0.08)', color: '#006fbf', border: '1px dashed rgba(0,111,191,0.3)', cursor: 'pointer', alignSelf: 'flex-start' }}>
              + Add Option
            </button>
          </div>
        </div>
      )}

      {/* True/False */}
      {qt === 'true_false' && (
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8 }}>CORRECT ANSWER</div>
          <div style={{ display: 'flex', gap: 12 }}>
            {['True','False'].map((tf, ti) => {
              const sel = qForm.correct_answers?.[0] === ti
              return (
                <button key={tf} onClick={() => setQF(f => ({ ...f, correct_answers: [ti], options: ['True','False'] }))}
                  style={{ flex: 1, padding: '10px 0', borderRadius: 10, fontWeight: 700, fontSize: 14, cursor: 'pointer', border: `2px solid ${sel ? '#1a7a3c' : 'var(--border)'}`, background: sel ? 'rgba(26,122,60,0.1)' : 'var(--card-bg)', color: sel ? '#1a7a3c' : 'var(--text)' }}>
                  {ti === 0 ? '✓ True' : '✗ False'}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Short answer / fill blank */}
      {(qt === 'short_answer' || qt === 'fill_blank') && (
        <div>
          <D2LText
            label="Accepted Answers (comma-separated, case-insensitive)"
            value={qForm.correct_answers?.join(', ') || ''}
            onChange={v => setQF(f => ({ ...f, correct_answers: v.split(',').map(s => s.trim()).filter(Boolean) }))}
            placeholder="answer1, answer2, alternate spelling…"
          />
          <div style={{ fontSize: 11, marginTop: 4, color: 'var(--text-muted)' }}>Case-insensitive partial match. Add all accepted variations.</div>
        </div>
      )}

      {/* Numeric */}
      {qt === 'numeric' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <D2LNumber label="Correct Value" value={qForm.correct_answers?.[0] || ''} onChange={v => setQF(f => ({ ...f, correct_answers: [v, f.correct_answers?.[1] || 0] }))} />
          <D2LNumber label="Tolerance ±" value={qForm.correct_answers?.[1] || 0} onChange={v => setQF(f => ({ ...f, correct_answers: [f.correct_answers?.[0] || 0, v] }))} min={0} step={0.01} />
        </div>
      )}

      {/* Points */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <D2LNumber label="Points (correct)" value={qForm.points} onChange={v => setQF(f => ({ ...f, points: v }))} min={0} step={0.5} />
        <D2LNumber label={`Deduct if Wrong (global: ${negativeMarking})`} value={qForm.negative_points} onChange={v => setQF(f => ({ ...f, negative_points: v }))} min={0} step={0.25} />
      </div>

      <D2LTextarea
        label="Explanation (shown after attempt)"
        value={qForm.explanation}
        onChange={v => setQF(f => ({ ...f, explanation: v }))}
        rows={2}
        placeholder="Explain why the answer is correct…"
      />

      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <d2l-button-subtle text="Cancel" onClick={onCancel} />
        <d2l-button primary disabled={saving || !qForm.question_text?.trim() || undefined} onClick={onSave}>
          {saving ? 'Saving…' : isNew ? 'Add Question' : 'Save Changes'}
        </d2l-button>
      </div>
    </div>
  )
}

// ── Needs-Grading panel (inside Analytics tabs) ──────────────────────────────
function NeedsGradingPanel({ quizId, passScore }) {
  const [attempts, setAttempts] = useState(null)
  const [grades, setGrades]     = useState({})   // { attemptId: { questionId: bool } }
  const [saving, setSaving]     = useState({})
  const [expand, setExpand]     = useState({})

  useEffect(() => {
    api.get(`/quizzes/${quizId}/needs-grading`)
      .then(r => setAttempts(r.data.attempts || []))
      .catch(() => setAttempts([]))
  }, [quizId])

  const setGrade = (attemptId, questionId, isCorrect) => {
    setGrades(g => ({ ...g, [attemptId]: { ...(g[attemptId] || {}), [questionId]: isCorrect } }))
  }

  const submit = async (attemptId) => {
    const g = grades[attemptId] || {}
    const payload = Object.entries(g).map(([question_id, is_correct]) => ({ question_id: +question_id, is_correct }))
    if (!payload.length) return
    setSaving(s => ({ ...s, [attemptId]: true }))
    try {
      const r = await api.patch(`/quizzes/attempts/${attemptId}/grade`, { grades: payload })
      if (!r.data.still_pending) {
        setAttempts(prev => prev.filter(a => a.id !== attemptId))
        alert(`Graded! New score: ${r.data.score}% — ${r.data.passed ? 'PASSED ✓' : 'FAILED'}`)
      }
    } catch (e) { alert(e.response?.data?.error || 'Failed to save grades') }
    setSaving(s => ({ ...s, [attemptId]: false }))
  }

  if (!attempts) return (
    <div style={{ padding: '2rem', display: 'flex', justifyContent: 'center' }}>
      <d2l-loading-spinner size="60"/>
    </div>
  )
  if (attempts.length === 0) return (
    <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
      <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
      <div style={{ fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>All caught up!</div>
      <div style={{ fontSize: 13 }}>No submissions awaiting manual grading.</div>
    </div>
  )

  return (
    <div style={{ padding: '1.5rem 0', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ padding: '10px 16px', borderRadius: 8, background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', fontSize: 13, color: '#92400e' }}>
        ⏳ <strong>{attempts.length}</strong> submission{attempts.length !== 1 ? 's' : ''} awaiting evaluation. Short-answer questions must be graded manually.
      </div>

      {attempts.map(a => {
        const parsed = a.answers_parsed || {}
        const pendingQs = (parsed.results || []).filter(r => r.needs_grading)
        const myGrades  = grades[a.id] || {}
        const allGraded = pendingQs.every(r => myGrades[r.question_id] !== undefined)

        return (
          <div key={a.id} className="card" style={{ overflow: 'hidden' }}>
            {/* Header row */}
            <button onClick={() => setExpand(e => ({ ...e, [a.id]: !e[a.id] }))}
              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '14px 20px', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
              <div style={{ width: 36, height: 36, borderRadius: '50%', background: a.avatar_bg_color || '#3B82F6',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>
                {a.avatar_emoji || a.display_name?.[0]?.toUpperCase() || '?'}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, color: 'var(--text)', fontSize: 14 }}>{a.display_name || a.username}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  @{a.username} · Submitted {a.completed_at ? new Date(a.completed_at).toLocaleString() : '—'} · Auto-score: <strong>{a.score ?? 0}%</strong>
                </div>
              </div>
              <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, background: 'rgba(245,158,11,0.12)', color: '#d97706', fontWeight: 700, flexShrink: 0 }}>
                {pendingQs.length} to grade
              </span>
              {expand[a.id] ? <ChevronLeft size={16} style={{ transform: 'rotate(-90deg)', color: 'var(--text-muted)' }}/> : <ArrowDown size={16} style={{ color: 'var(--text-muted)' }}/>}
            </button>

            {/* Questions to grade */}
            {expand[a.id] && (
              <div style={{ borderTop: '1px solid var(--border)', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                {pendingQs.map(r => {
                  const grade = myGrades[r.question_id]
                  return (
                    <div key={r.question_id} style={{ padding: 16, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--page-bg)' }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 10 }}>{r.question_text}</div>
                      <div style={{ padding: '10px 14px', borderRadius: 6, background: 'var(--card-bg)', border: '1px solid var(--border)', fontSize: 13, marginBottom: 12 }}>
                        <span style={{ fontWeight: 600, color: 'var(--text-muted)', marginRight: 8 }}>Student's answer:</span>
                        <span style={{ color: 'var(--text)' }}>{r.user_answer || <em style={{ color: 'var(--text-muted)' }}>no answer</em>}</span>
                      </div>
                      {r.correct_answers?.length > 0 && (
                        <div style={{ padding: '8px 14px', borderRadius: 6, background: 'rgba(26,122,60,0.06)', border: '1px solid rgba(26,122,60,0.2)', fontSize: 12, color: '#1a7a3c', marginBottom: 12 }}>
                          <strong>Suggested answers:</strong> {r.correct_answers.join(' / ')}
                        </div>
                      )}
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button onClick={() => setGrade(a.id, r.question_id, true)}
                          style={{ flex: 1, padding: '8px', borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: 'pointer', border: '2px solid',
                            borderColor: grade === true ? '#1a7a3c' : 'var(--border)',
                            background: grade === true ? 'rgba(26,122,60,0.1)' : 'transparent',
                            color: grade === true ? '#1a7a3c' : 'var(--text-muted)',
                          }}>
                          ✓ Correct (+{r.max_points || 1} pt{(r.max_points||1) !== 1 ? 's' : ''})
                        </button>
                        <button onClick={() => setGrade(a.id, r.question_id, false)}
                          style={{ flex: 1, padding: '8px', borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: 'pointer', border: '2px solid',
                            borderColor: grade === false ? '#cc3333' : 'var(--border)',
                            background: grade === false ? 'rgba(204,51,51,0.08)' : 'transparent',
                            color: grade === false ? '#cc3333' : 'var(--text-muted)',
                          }}>
                          ✗ Incorrect (0 pts)
                        </button>
                      </div>
                    </div>
                  )
                })}

                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4 }}>
                  <d2l-button
                    primary
                    disabled={!allGraded || saving[a.id] || undefined}
                    onClick={() => submit(a.id)}
                  >
                    {saving[a.id] ? 'Saving…' : `Submit Grades for ${a.display_name || a.username}`}
                  </d2l-button>
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Research analytics dashboard ─────────────────────────────────────────────
// ── Attempts panel — Brightspace-style table with per-attempt review drawer ──
// Lists every attempt against a quiz with: search by user, sortable score /
// date, score-override badge, "Reset" so the student can retake, and (admin
// only) "Delete". Clicking a row opens a drawer with every Q&A side-by-side
// with the student's response, an override-score input, a feedback textarea,
// and a clear-override button. Nothing here mutates the legacy `score`
// column; overrides go into `override_score` so the underlying auto-graded
// number is preserved for audit / re-derivation.
function AttemptsPanel({ attempts, quiz, isAdmin, onChanged }) {
  const [search, setSearch]       = useState('')
  const [sortBy, setSortBy]       = useState('date_desc') // date_desc | date_asc | score_desc | score_asc | user
  const [statusFilter, setStatus] = useState('all')        // all | passed | failed | pending | reset | overridden
  const [openId, setOpenId]       = useState(null)

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase()
    let out = attempts.filter(a => {
      if (s) {
        const hay = `${a.username || ''} ${a.display_name || ''} ${a.email || ''}`.toLowerCase()
        if (!hay.includes(s)) return false
      }
      if (statusFilter === 'passed')     return !!a.passed
      if (statusFilter === 'failed')     return !a.passed && a.grading_status !== 'pending' && a.grading_status !== 'reset'
      if (statusFilter === 'pending')    return a.grading_status === 'pending'
      if (statusFilter === 'reset')      return a.grading_status === 'reset'
      if (statusFilter === 'overridden') return a.override_score != null
      return true
    })
    out = [...out].sort((x, y) => {
      const sx = x.override_score ?? x.score ?? -1
      const sy = y.override_score ?? y.score ?? -1
      const dx = x.completed_at ? new Date(x.completed_at).getTime() : 0
      const dy = y.completed_at ? new Date(y.completed_at).getTime() : 0
      switch (sortBy) {
        case 'date_asc':   return dx - dy
        case 'score_desc': return sy - sx
        case 'score_asc':  return sx - sy
        case 'user':       return (x.display_name || x.username || '').localeCompare(y.display_name || y.username || '')
        case 'date_desc':
        default:           return dy - dx
      }
    })
    return out
  }, [attempts, search, sortBy, statusFilter])

  const exportCSV = () => {
    const rows = [
      ['User', 'Username', 'Email', 'Auto Score (%)', 'Override Score (%)', 'Final Score (%)', 'Passed', 'Status', 'Time (s)', 'Started', 'Completed', 'Graded By (id)', 'Graded At', 'Override Reason', 'Feedback'],
      ...filtered.map(a => [
        a.display_name || '',
        a.username || '',
        a.email || '',
        a.score ?? '',
        a.override_score ?? '',
        a.override_score ?? a.score ?? '',
        a.passed ? 'Yes' : 'No',
        a.grading_status || 'auto',
        a.time_taken ?? '',
        a.started_at || '',
        a.completed_at || '',
        a.graded_by ?? '',
        a.graded_at || '',
        a.override_reason || '',
        a.feedback || '',
      ])
    ]
    const csv = rows.map(r => r.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `${(quiz.title || 'quiz').replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-attempts-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
  }

  const finalScore = (a) => a.override_score != null ? a.override_score : a.score

  return (
    <div style={{ padding: '1.5rem 0', display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Toolbar */}
      <div className="card" style={{ padding: 12, display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search user…"
          style={{ flex: '1 1 200px', minWidth: 160, padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--card-bg)', color: 'var(--text)', fontSize: 13 }}/>
        <select value={statusFilter} onChange={e => setStatus(e.target.value)}
          style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--card-bg)', color: 'var(--text)', fontSize: 13 }}>
          <option value="all">All ({attempts.length})</option>
          <option value="passed">Passed</option>
          <option value="failed">Failed</option>
          <option value="pending">Needs grading</option>
          <option value="overridden">Overridden</option>
          <option value="reset">Reset (retake granted)</option>
        </select>
        <select value={sortBy} onChange={e => setSortBy(e.target.value)}
          style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--card-bg)', color: 'var(--text)', fontSize: 13 }}>
          <option value="date_desc">Newest first</option>
          <option value="date_asc">Oldest first</option>
          <option value="score_desc">Highest score</option>
          <option value="score_asc">Lowest score</option>
          <option value="user">User name</option>
        </select>
        <button onClick={exportCSV}
          style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'rgba(0,111,191,0.08)', color: '#006fbf', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>
          ⬇ Export CSV ({filtered.length})
        </button>
      </div>

      {/* Table */}
      <div className="card" style={{ overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--page-bg)', borderBottom: '1px solid var(--border)' }}>
                {['User','Final score','Auto score','Status','Grading','Time','Date',''].map(h => (
                  <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={8} style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)' }}>No attempts match your filter.</td></tr>
              )}
              {filtered.map(a => {
                const fs = finalScore(a)
                const overridden = a.override_score != null
                const reset = a.grading_status === 'reset'
                return (
                  <tr key={a.id}
                    onClick={() => setOpenId(a.id)}
                    style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer', opacity: reset ? 0.55 : 1 }}>
                    <td style={{ padding: '10px 16px' }}>
                      <div style={{ fontWeight: 600, color: 'var(--text)' }}>{a.display_name || a.username}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>@{a.username}{a.email ? ` · ${a.email}` : ''}</div>
                    </td>
                    <td style={{ padding: '10px 16px' }}>
                      <span style={{ fontWeight: 900, fontSize: 14, color: fs >= 70 ? '#1a7a3c' : fs >= 50 ? '#c45f00' : '#cc3333' }}>{fs ?? '—'}%</span>
                      {overridden && <span style={{ marginLeft: 6, fontSize: 9, padding: '1px 6px', borderRadius: 8, background: 'rgba(99,102,241,0.12)', color: '#6366f1', fontWeight: 800 }}>OVERRIDE</span>}
                    </td>
                    <td style={{ padding: '10px 16px', fontSize: 12, color: 'var(--text-muted)' }}>
                      {a.score != null ? `${a.score}%` : '—'}
                    </td>
                    <td style={{ padding: '10px 16px' }}>
                      {reset
                        ? <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, fontWeight: 700, background: 'rgba(100,116,139,0.12)', color: '#64748b' }}>↻ Reset</span>
                        : <d2l-status-indicator
                            state={a.grading_status === 'pending' ? 'default' : a.passed ? 'success' : 'error'}
                            text={a.grading_status === 'pending' ? 'Pending' : a.passed ? 'Passed' : 'Failed'}/>}
                    </td>
                    <td style={{ padding: '10px 16px' }}>
                      <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, fontWeight: 600,
                        background: a.grading_status === 'pending' ? 'rgba(245,158,11,0.12)' : a.grading_status === 'graded' ? 'rgba(26,122,60,0.1)' : 'var(--border)',
                        color: a.grading_status === 'pending' ? '#d97706' : a.grading_status === 'graded' ? '#1a7a3c' : 'var(--text-muted)',
                      }}>
                        {a.grading_status === 'pending' ? '⏳ Needs grading' : a.grading_status === 'graded' ? '✓ Graded' : a.grading_status === 'reset' ? '↻ Reset' : '✓ Auto-graded'}
                      </span>
                    </td>
                    <td style={{ padding: '10px 16px', fontSize: 12, color: 'var(--text-muted)' }}>
                      {a.time_taken ? `${Math.floor(a.time_taken / 60)}m ${a.time_taken % 60}s` : '—'}
                    </td>
                    <td style={{ padding: '10px 16px', fontSize: 12, color: 'var(--text-muted)' }}>
                      {a.completed_at ? new Date(a.completed_at).toLocaleString() : '—'}
                    </td>
                    <td style={{ padding: '10px 16px' }}>
                      <button onClick={(e) => { e.stopPropagation(); setOpenId(a.id) }}
                        style={{ padding: '5px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', color: '#006fbf', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                        Manage →
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {openId != null && (
        <AttemptDrawer
          attemptId={openId}
          onClose={() => setOpenId(null)}
          onChanged={() => { onChanged?.(); setOpenId(null) }}
          isAdmin={isAdmin}
        />
      )}
    </div>
  )
}

// ── Per-attempt drawer — full Q&A review + grade override / feedback / reset ──
function AttemptDrawer({ attemptId, onClose, onChanged, isAdmin }) {
  const [data, setData]         = useState(null)
  const [loading, setLoading]   = useState(true)
  const [busy, setBusy]         = useState(false)
  const [overrideVal, setOverrideVal] = useState('')
  const [reason, setReason]     = useState('')
  const [feedback, setFeedback] = useState('')
  const [error, setError]       = useState(null)

  useEffect(() => {
    setLoading(true); setError(null)
    api.get(`/quizzes/attempts/${attemptId}`)
      .then(r => {
        setData(r.data)
        const a = r.data?.attempt
        setOverrideVal(a?.override_score != null ? String(a.override_score) : '')
        setReason(a?.override_reason || '')
        setFeedback(a?.feedback || '')
      })
      .catch(e => setError(e?.response?.data?.error || e.message))
      .finally(() => setLoading(false))
  }, [attemptId])

  const saveOverride = async () => {
    const num = overrideVal === '' ? null : Number(overrideVal)
    if (num !== null && (!Number.isFinite(num) || num < 0 || num > 100)) {
      alert('Score must be between 0 and 100, or empty to clear the override.')
      return
    }
    setBusy(true)
    try {
      await api.patch(`/quizzes/attempts/${attemptId}/override`, {
        score: num, reason: reason || null, feedback: feedback || null,
      })
      onChanged?.()
    } catch (e) {
      alert(e?.response?.data?.error || 'Failed to save override')
    } finally { setBusy(false) }
  }

  const clearOverride = async () => {
    if (!confirm('Clear the score override and revert to the auto-calculated score?')) return
    setBusy(true)
    try {
      await api.patch(`/quizzes/attempts/${attemptId}/override`, { score: null })
      onChanged?.()
    } catch (e) {
      alert(e?.response?.data?.error || 'Failed to clear override')
    } finally { setBusy(false) }
  }

  const resetAttempt = async () => {
    if (!confirm('Reset this attempt? The user will be able to take the quiz again. The original attempt is kept on file for audit.')) return
    setBusy(true)
    try {
      await api.post(`/quizzes/attempts/${attemptId}/reset`)
      onChanged?.()
    } catch (e) {
      alert(e?.response?.data?.error || 'Failed to reset')
    } finally { setBusy(false) }
  }

  const deleteAttempt = async () => {
    if (!confirm('PERMANENTLY DELETE this attempt? This cannot be undone. Use "Reset" instead if you just want to allow a retake.')) return
    setBusy(true)
    try {
      await api.delete(`/quizzes/attempts/${attemptId}`)
      onChanged?.()
    } catch (e) {
      alert(e?.response?.data?.error || 'Failed to delete')
    } finally { setBusy(false) }
  }

  const a = data?.attempt
  const questions = data?.questions || []
  const responses = a?.answers_parsed?.results || []
  const responseByQ = new Map(responses.map(r => [r.question_id, r]))
  const fs = a?.override_score != null ? a.override_score : a?.score

  return (
    <div onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.55)', display: 'flex', justifyContent: 'flex-end' }}>
      <div onClick={e => e.stopPropagation()}
        style={{ width: 'min(720px, 100%)', height: '100%', overflow: 'auto', background: 'var(--card-bg)', borderLeft: '1px solid var(--border)', boxShadow: '-8px 0 24px rgba(0,0,0,0.18)' }}>
        <div style={{ position: 'sticky', top: 0, zIndex: 2, background: 'var(--card-bg)', borderBottom: '1px solid var(--border)', padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 14, color: 'var(--text)' }}>Attempt review</div>
            {a && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{a.display_name || a.username} · {a.email || '—'} · {a.completed_at ? new Date(a.completed_at).toLocaleString() : 'in progress'}</div>}
          </div>
          <button onClick={onClose}
            style={{ background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-muted)', padding: '5px 12px', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>
            Close
          </button>
        </div>

        {loading && <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>Loading attempt…</div>}
        {error && <div style={{ padding: 18, color: '#cc3333', fontSize: 13 }}>{error}</div>}

        {!loading && !error && a && (
          <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 18 }}>
            {/* Score panel */}
            <div className="card" style={{ padding: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Final score</div>
                  <div style={{ fontSize: 32, fontWeight: 900, color: fs >= 70 ? '#1a7a3c' : fs >= 50 ? '#c45f00' : '#cc3333' }}>{fs ?? '—'}%</div>
                  {a.override_score != null && (
                    <div style={{ fontSize: 10, color: '#6366f1', fontWeight: 700, marginTop: 2 }}>OVERRIDE — auto was {a.score ?? '—'}%</div>
                  )}
                </div>
                <div style={{ flex: 1 }}/>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  Status: <strong style={{ color: a.passed ? '#1a7a3c' : '#cc3333' }}>{a.passed ? 'Passed' : 'Failed'}</strong><br/>
                  Time taken: {a.time_taken ? `${Math.floor(a.time_taken / 60)}m ${a.time_taken % 60}s` : '—'}<br/>
                  {data.graded_by_user && <>Graded by: <strong>{data.graded_by_user.display_name || data.graded_by_user.username}</strong> on {a.graded_at ? new Date(a.graded_at).toLocaleString() : '—'}</>}
                </div>
              </div>
            </div>

            {/* Override controls */}
            <div className="card" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ fontWeight: 800, fontSize: 13, color: 'var(--text)' }}>Override grade</div>
              <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                <div>
                  <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 2 }}>New score (0–100, blank to clear)</label>
                  <input type="number" min="0" max="100" value={overrideVal}
                    onChange={e => setOverrideVal(e.target.value)}
                    style={{ width: 110, padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--card-bg)', color: 'var(--text)', fontSize: 14, fontWeight: 800 }}/>
                </div>
                <div style={{ flex: 1, minWidth: 180 }}>
                  <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 2 }}>Reason (optional, for audit)</label>
                  <input value={reason} onChange={e => setReason(e.target.value)}
                    placeholder="e.g. partial credit on Q3"
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--card-bg)', color: 'var(--text)', fontSize: 13 }}/>
                </div>
              </div>
              <div>
                <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 2 }}>Feedback to student (optional)</label>
                <textarea value={feedback} onChange={e => setFeedback(e.target.value)}
                  placeholder="Visible to the student on their results page."
                  rows={3}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--card-bg)', color: 'var(--text)', fontSize: 13, fontFamily: 'inherit' }}/>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button onClick={saveOverride} disabled={busy}
                  style={{ padding: '8px 14px', borderRadius: 8, border: 'none', background: '#1a7a3c', color: '#fff', fontWeight: 800, fontSize: 12, cursor: busy ? 'wait' : 'pointer', opacity: busy ? 0.5 : 1 }}>
                  Save override
                </button>
                {a.override_score != null && (
                  <button onClick={clearOverride} disabled={busy}
                    style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text)', fontWeight: 700, fontSize: 12, cursor: busy ? 'wait' : 'pointer' }}>
                    Clear override (revert to auto)
                  </button>
                )}
                <div style={{ flex: 1 }}/>
                <button onClick={resetAttempt} disabled={busy}
                  style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid #c45f00', background: 'rgba(196,95,0,0.08)', color: '#c45f00', fontWeight: 700, fontSize: 12, cursor: busy ? 'wait' : 'pointer' }}>
                  ↻ Reset (allow retake)
                </button>
                {isAdmin && (
                  <button onClick={deleteAttempt} disabled={busy}
                    style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid #cc3333', background: 'rgba(204,51,51,0.06)', color: '#cc3333', fontWeight: 700, fontSize: 12, cursor: busy ? 'wait' : 'pointer' }}>
                    Delete permanently
                  </button>
                )}
              </div>
            </div>

            {/* Per-question review */}
            <div>
              <div style={{ fontWeight: 800, fontSize: 13, color: 'var(--text)', marginBottom: 8 }}>Questions &amp; answers</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {questions.map((q, i) => {
                  const r = responseByQ.get(q.id) || {}
                  const ok = r.is_correct
                  return (
                    <div key={q.id} className="card" style={{ padding: 14, borderLeft: `4px solid ${ok ? '#1a7a3c' : ok === false ? '#cc3333' : '#94a3b8'}` }}>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                        <span style={{ flexShrink: 0, width: 22, height: 22, borderRadius: '50%', background: 'var(--page-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, color: 'var(--text-muted)' }}>{i + 1}</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text)' }}>{q.question_text}</div>
                          <div style={{ marginTop: 6, fontSize: 12, color: 'var(--text)' }}>
                            <strong style={{ color: 'var(--text-muted)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Their answer:</strong>{' '}
                            {r.user_answer != null && r.user_answer !== '' ? String(r.user_answer) : <em style={{ color: 'var(--text-muted)' }}>(no answer)</em>}
                          </div>
                          <div style={{ marginTop: 4, fontSize: 11, color: 'var(--text-muted)' }}>
                            {r.points_earned ?? 0} / {r.max_points ?? 1} pts · {ok ? '✓ correct' : ok === false ? '✗ incorrect' : 'not graded'}
                            {r.needs_grading && <span style={{ color: '#d97706', fontWeight: 700, marginLeft: 6 }}>· needs grading</span>}
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function Analytics({ quiz, onBack }) {
  const { user } = useAuth()
  const [data, setData] = useState(null)
  const [loading, setL] = useState(true)

  const refresh = () => {
    api.get(`/quizzes/${quiz.id}/analytics`).then(r => setData(r.data)).catch(() => {})
  }

  useEffect(() => {
    setL(true)
    api.get(`/quizzes/${quiz.id}/analytics`)
      .then(r => setData(r.data))
      .finally(() => setL(false))
  }, [quiz.id])

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem', gap: 12, alignItems: 'center' }}>
      <d2l-loading-spinner size="80" />
    </div>
  )
  if (!data?.stats) return (
    <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-muted)' }}>
      <AlertCircle size={36} style={{ marginBottom: 12, opacity: 0.5 }} />
      <div>No attempt data yet for this quiz.</div>
    </div>
  )

  const { stats, item_analysis, attempts } = data
  const maxBucket   = Math.max(...stats.score_distribution, 1)
  const bucketLabels = ['0-9','10-19','20-29','30-39','40-49','50-59','60-69','70-79','80-89','90-100']
  const discColor   = d => d >= 0.4 ? '#1a7a3c' : d >= 0.3 ? '#006fbf' : d >= 0.2 ? '#c45f00' : '#cc3333'
  const pColor      = p => p > 0.8 ? '#1a7a3c' : p > 0.5 ? '#006fbf' : p > 0.3 ? '#c45f00' : '#cc3333'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <d2l-button-subtle text="Back to quizzes" onClick={onBack} />
        <div style={{ flex: 1 }} />
      </div>

      <h2 style={{ fontWeight: 800, fontSize: 20, color: 'var(--text)', margin: 0 }}>{quiz.title} — Analytics</h2>

      {/* D2L tabs for analytics views */}
      <d2l-tabs>
        {/* ── Overview tab ── */}
        <d2l-tab-panel text="Overview" selected>
          <div style={{ padding: '1.5rem 0', display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* KPI cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(140px,1fr))', gap: 12 }}>
              {[
                { l: 'Total Attempts', v: stats.total_attempts, c: '#006fbf' },
                { l: 'Unique Users',   v: stats.unique_users,   c: '#7b4fc4' },
                { l: 'Pass Rate',      v: `${stats.pass_rate}%`, c: stats.pass_rate >= 70 ? '#1a7a3c' : '#c45f00' },
                { l: 'Avg Score',      v: `${stats.avg_score}%`, c: stats.avg_score >= 70 ? '#1a7a3c' : '#c45f00' },
              ].map(s => (
                <div key={s.l} className="card" style={{ padding: 16, textAlign: 'center' }}>
                  <div style={{ fontSize: 28, fontWeight: 900, color: s.c, lineHeight: 1 }}>{s.v}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{s.l}</div>
                </div>
              ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              {/* Score distribution histogram */}
              <div className="card" style={{ padding: 20 }}>
                <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 16, color: 'var(--text)' }}>Score Distribution</div>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 100 }}>
                  {stats.score_distribution.map((n, i) => (
                    <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: '#006fbf', minHeight: 14 }}>{n > 0 ? n : ''}</div>
                      <div style={{ width: '100%', borderRadius: '3px 3px 0 0', background: i >= 6 ? '#1a7a3c' : i >= 4 ? '#c45f00' : '#cc3333', opacity: 0.8, height: Math.round((n / maxBucket) * 72), minHeight: n > 0 ? 3 : 0 }} />
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0 6px', marginTop: 24 }}>
                  {bucketLabels.map((l, i) => (
                    <span key={l} style={{ fontSize: 9, color: 'var(--text-muted)', flex: 1, textAlign: 'center', minWidth: 28 }}>{l}</span>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 12, marginTop: 8, fontSize: 11 }}>
                  <span style={{ color: '#cc3333' }}>■ Fail</span>
                  <span style={{ color: '#c45f00' }}>■ Borderline</span>
                  <span style={{ color: '#1a7a3c' }}>■ Pass</span>
                </div>
              </div>

              {/* Score statistics */}
              <div className="card" style={{ padding: 20 }}>
                <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 12, color: 'var(--text)' }}>Score Statistics</div>
                {[
                  { l: 'Highest Score', v: `${stats.max_score}%`,    c: '#1a7a3c' },
                  { l: 'Lowest Score',  v: `${stats.min_score}%`,    c: '#cc3333' },
                  { l: 'Median Score',  v: `${stats.median_score}%`, c: '#006fbf' },
                  { l: 'Std Deviation', v: `±${stats.std_dev}%`,     c: '#c45f00' },
                  { l: 'Avg Time',      v: stats.avg_time_sec > 60 ? `${Math.floor(stats.avg_time_sec/60)}m ${stats.avg_time_sec%60}s` : `${stats.avg_time_sec}s`, c: '#7b4fc4' },
                  { l: 'Pass Count',    v: `${stats.pass_count} / ${stats.total_attempts}`, c: '#1a7a3c' },
                ].map(s => (
                  <div key={s.l} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                    <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{s.l}</span>
                    <span style={{ fontWeight: 900, fontSize: 13, color: s.c }}>{s.v}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </d2l-tab-panel>

        {/* ── Item Analysis tab ── */}
        <d2l-tab-panel text="Item Analysis">
          <div style={{ padding: '1.5rem 0', display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="card" style={{ padding: 16 }}>
              <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8, color: 'var(--text)' }}>Item Analysis Glossary</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, fontSize: 12, color: 'var(--text-muted)' }}>
                <div><strong style={{ color: 'var(--text)' }}>p-value (Difficulty Index):</strong> Proportion who answered correctly. 0.0 = impossible, 1.0 = trivial. Ideal: 0.3–0.7.</div>
                <div><strong style={{ color: 'var(--text)' }}>Discrimination Index:</strong> Top 27% vs bottom 27% performance. ≥0.4 = Excellent, 0.3 = Good, 0.2 = Fair.</div>
              </div>
            </div>

            {item_analysis.map((item, i) => (
              <div key={item.question_id} className="card" style={{ padding: 20 }}>
                <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
                  <span style={{ flexShrink: 0, width: 28, height: 28, borderRadius: '50%', background: '#006fbf', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 900 }}>{i + 1}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontWeight: 600, fontSize: 14, color: 'var(--text)', margin: '0 0 6px' }}>{item.question_text}</p>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                      <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: 'var(--page-bg)', color: 'var(--text-muted)' }}>{Q_TYPES.find(t => t.v === item.question_type)?.l || item.question_type}</span>
                      {item.correct_answer_texts?.length > 0 && (
                        <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: 'rgba(26,122,60,0.10)', color: '#1a7a3c', fontWeight: 700 }}>
                          ✓ {item.correct_answer_texts.join(' / ')}
                        </span>
                      )}
                      {item.total_skipped > 0 && (
                        <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: 'rgba(196,95,0,0.10)', color: '#c45f00', fontWeight: 700 }}>
                          {item.total_skipped} skipped
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {item.explanation && (
                  <div style={{ marginBottom: 14, padding: '10px 12px', borderRadius: 8, background: 'rgba(0,111,191,0.06)', border: '1px solid rgba(0,111,191,0.18)' }}>
                    <div style={{ fontSize: 10, fontWeight: 800, color: '#006fbf', letterSpacing: 0.5, marginBottom: 4 }}>EXPLANATION</div>
                    <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.5 }}>{item.explanation}</div>
                  </div>
                )}

                {item.top_wrong_answer && item.top_wrong_answer.count > 0 && (
                  <div style={{ marginBottom: 14, padding: '10px 12px', borderRadius: 8, background: 'rgba(204,51,51,0.06)', border: '1px solid rgba(204,51,51,0.18)', display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                    <AlertCircle size={14} style={{ color: '#cc3333', flexShrink: 0, marginTop: 2 }} />
                    <div style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.5 }}>
                      <strong>Most common wrong answer:</strong> {item.top_wrong_answer.text != null ? `"${item.top_wrong_answer.text}"` : `option ${item.top_wrong_answer.key}`}
                      {' '}— picked by <strong>{item.top_wrong_answer.count}</strong> of {item.total_attempts} ({Math.round(item.top_wrong_answer.count / item.total_attempts * 100)}%).
                    </div>
                  </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 16 }}>
                  {[
                    { l: 'p-value', v: `${(item.p_value * 100).toFixed(0)}%`, sub: item.difficulty_label, c: pColor(item.p_value) },
                    { l: 'Discrimination', v: item.discrimination_index.toFixed(2), sub: item.discrimination_label, c: discColor(item.discrimination_index) },
                    { l: 'Got Correct', v: item.total_correct, sub: `of ${item.total_attempts}`, c: '#1a7a3c' },
                    { l: 'Attempts', v: item.total_attempts, sub: '', c: '#006fbf' },
                  ].map(s => (
                    <div key={s.l} style={{ background: 'var(--page-bg)', borderRadius: 10, padding: '12px 8px', textAlign: 'center' }}>
                      <div style={{ fontSize: 22, fontWeight: 900, color: s.c }}>{s.v}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{s.l}</div>
                      {s.sub && <div style={{ fontSize: 11, fontWeight: 600, color: s.c }}>{s.sub}</div>}
                    </div>
                  ))}
                </div>

                {item.options?.length > 0 && (
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8 }}>ANSWER DISTRIBUTION</div>
                    {item.options.map((opt, oi) => {
                      const count  = item.answer_frequency?.[String(oi)] || 0
                      const pct    = item.total_attempts > 0 ? Math.round(count / item.total_attempts * 100) : 0
                      const isCor  = item.correct_answers?.includes(oi)
                      return (
                        <div key={oi} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                          <span style={{ fontSize: 12, fontWeight: 700, width: 18, color: isCor ? '#1a7a3c' : 'var(--text-muted)' }}>{String.fromCharCode(65 + oi)}</span>
                          <div style={{ flex: 1, height: 20, borderRadius: 10, overflow: 'hidden', background: 'var(--border)' }}>
                            <div style={{ width: `${Math.max(pct, 2)}%`, height: '100%', borderRadius: 10, background: isCor ? '#1a7a3c' : '#006fbf', opacity: 0.75, display: 'flex', alignItems: 'center', paddingLeft: 8 }}>
                              {pct > 12 && <span style={{ fontSize: 11, color: '#fff', fontWeight: 700 }}>{pct}%</span>}
                            </div>
                          </div>
                          <span style={{ fontSize: 12, width: 56, textAlign: 'right', color: isCor ? '#1a7a3c' : 'var(--text-muted)' }}>{count} ({pct}%)</span>
                          {isCor && <CheckCircle size={14} style={{ color: '#1a7a3c', flexShrink: 0 }} />}
                        </div>
                      )
                    })}
                  </div>
                )}

                {(item.discrimination_index < 0.2 || item.p_value < 0.2 || item.p_value > 0.95) && (
                  <div style={{ marginTop: 12, display: 'flex', gap: 8, padding: 12, borderRadius: 8, background: 'rgba(196,95,0,0.07)', color: '#7a3700', fontSize: 12 }}>
                    <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
                    <div>
                      <strong>Review this question: </strong>
                      {item.p_value < 0.2 && 'Very few students answered correctly — may be ambiguous or too hard. '}
                      {item.p_value > 0.95 && 'Almost everyone got this right — consider if it tests meaningful knowledge. '}
                      {item.discrimination_index < 0.2 && "Low discrimination — doesn't differentiate knowledge levels well."}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </d2l-tab-panel>

        {/* ── Attempts tab ── */}
        <d2l-tab-panel text="Attempts">
          <AttemptsPanel
            attempts={attempts}
            quiz={quiz}
            isAdmin={user?.is_admin}
            onChanged={refresh}
          />
        </d2l-tab-panel>

        {/* ── Needs Grading tab ── */}
        <d2l-tab-panel text="Needs Grading">
          <NeedsGradingPanel quizId={quiz.id} passScore={quiz.pass_score || 70}/>
        </d2l-tab-panel>
      </d2l-tabs>
    </div>
  )
}

// ── Page root ────────────────────────────────────────────────────────────────
export default function QuizAdmin() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [view, setView]                   = useState('list')
  const [editQuiz, setEditQuiz]           = useState(null)
  const [analyticsQuiz, setAnalyticsQuiz] = useState(null)

  const roleLabel = user?.is_admin ? 'Admin' : user?.role || 'Creator'

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 0 3rem', display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Page header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', paddingTop: 8, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <h1 style={{ fontWeight: 900, fontSize: 24, color: 'var(--text)', margin: 0 }}>Quiz Manager</h1>
            <d2l-status-indicator state="default" text={roleLabel} />
          </div>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>
            Create quizzes, add questions, generate with AI, view research-grade analytics
          </p>
        </div>
        {user?.is_admin && (
          <button onClick={() => navigate('/admin')} style={{
            display:'flex', alignItems:'center', gap:6, padding:'8px 14px', borderRadius:6,
            background:'rgba(0,111,191,0.1)', border:'1px solid rgba(0,111,191,0.25)',
            color:'#006fbf', fontSize:13, fontWeight:700, cursor:'pointer',
          }}>
            🛡 Users &amp; RBAC
          </button>
        )}
        <d2l-button onClick={() => navigate('/quiz')}>Student View</d2l-button>
      </div>

      {view === 'list' && (
        <QuizList
          onNew={() => { setEditQuiz({}); setView('build') }}
          onEdit={(q) => { setEditQuiz(q); setView('build') }}
          onAnalytics={(q) => { setAnalyticsQuiz(q); setView('analytics') }}
        />
      )}

      {view === 'build' && (
        <QuizBuilder quiz={editQuiz} onBack={() => { setEditQuiz(null); setView('list') }} />
      )}

      {view === 'analytics' && analyticsQuiz && (
        <Analytics quiz={analyticsQuiz} onBack={() => { setAnalyticsQuiz(null); setView('list') }} />
      )}
    </div>
  )
}
