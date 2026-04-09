/**
 * Projects.jsx — NASA-level Research Projects Hub
 * Full research workspace: project management, datasets, sites, observations,
 * milestones, team, AI analysis, stats, export, live data collection
 */
import PageAmbience from '../components/layout/PageAmbience'
import { useState, useEffect, useRef, useMemo } from 'react'
import { useAuth } from '../context/AuthContext'
import api from '../utils/api'
import { askAI } from '../utils/openrouter'
import { useDropzone } from 'react-dropzone'
import {
  FlaskConical, Plus, X, Upload, Trash2, Download, Send, Bot,
  Users, MapPin, Calendar, BarChart2, Database, Target, Zap,
  CheckSquare, Clock, TrendingUp, Award, FileText, Eye,
  ChevronRight, ChevronDown, Activity, AlertTriangle, Layers,
  Globe, Microscope, Clipboard, Star, RefreshCw, Loader,
  BookOpen, Shield, Settings, Edit3, Check,
} from 'lucide-react'
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell,
} from 'recharts'

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmt = d => d ? new Date(d).toLocaleDateString('en-CA', { month:'short', day:'numeric', year:'numeric' }) : '—'
const fmtShort = d => d ? new Date(d).toLocaleDateString('en-CA', { month:'short', day:'numeric' }) : '—'
const statusColor = s => ({ active:'#22c55e', paused:'#f59e0b', completed:'#6366f1', archived:'#94a3b8' }[s]||'#94a3b8')
const statusBg   = s => ({ active:'rgba(34,197,94,0.12)', paused:'rgba(245,158,11,0.12)', completed:'rgba(99,102,241,0.12)', archived:'rgba(148,163,184,0.1)' }[s]||'rgba(148,163,184,0.1)')

const TOOLS = [
  { icon: Microscope,    color:'#6366f1', label:'AI Analysis',      sub:'Chat with your datasets using RAG + ML' },
  { icon: BarChart2,     color:'#0ea5e9', label:'Stats Dashboard',  sub:'Auto-generated charts & WHO compliance' },
  { icon: Globe,         color:'#22c55e', label:'Site Linking',     sub:'Connect monitoring sites & observations' },
  { icon: CheckSquare,   color:'#f59e0b', label:'Milestones',       sub:'Track goals, deadlines, deliverables' },
  { icon: Users,         color:'#ec4899', label:'Team Collaboration',sub:'Member roles, assignments, activity' },
  { icon: Download,      color:'#14b8a6', label:'Data Export',      sub:'CSV, JSON, PDF report for any project' },
]

const PARAM_LABELS = { ph:'pH', turbidity:'Turbidity', dissolved_oxygen:'DO', conductivity:'Conductivity', temperature:'Temp', nitrate:'Nitrate', phosphorus:'Phosphorus' }
const WHO_THRESHOLDS = { ph:[6.5,8.5], turbidity:[0,5], dissolved_oxygen:[6,14], conductivity:[50,800], temperature:[0,30], nitrate:[0,10], phosphorus:[0,0.1] }

// ── Sub-components ─────────────────────────────────────────────────────────────

function StatCard({ icon: Icon, label, value, color, sub }) {
  return (
    <div style={{ background:'var(--card-bg)', border:'1px solid var(--border)', borderRadius:12, padding:'14px 18px', display:'flex', gap:12, alignItems:'center' }}>
      <div style={{ width:38, height:38, borderRadius:10, background:`${color}20`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
        <Icon style={{ width:18, height:18, color }}/>
      </div>
      <div>
        <div style={{ fontSize:20, fontWeight:900, color:'var(--text)', lineHeight:1 }}>{value}</div>
        <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:3 }}>{label}</div>
        {sub && <div style={{ fontSize:10, color:'var(--text-light)', marginTop:1 }}>{sub}</div>}
      </div>
    </div>
  )
}

function MilestoneRow({ m, onToggle }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 12px', borderRadius:8, background: m.done ? 'rgba(34,197,94,0.06)' : 'rgba(99,102,241,0.04)', border:`1px solid ${m.done ? 'rgba(34,197,94,0.2)' : 'rgba(99,102,241,0.1)'}`, marginBottom:6 }}>
      <button onClick={() => onToggle(m.id)} style={{ width:20, height:20, borderRadius:6, border:`2px solid ${m.done ? '#22c55e' : 'var(--border)'}`, background: m.done ? '#22c55e' : 'transparent', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', flexShrink:0, color:'#fff', fontSize:11 }}>
        {m.done && '✓'}
      </button>
      <div style={{ flex:1 }}>
        <div style={{ fontSize:13, fontWeight:600, color: m.done ? 'var(--text-muted)' : 'var(--text)', textDecoration: m.done ? 'line-through' : 'none' }}>{m.title}</div>
        {m.date && <div style={{ fontSize:11, color:'var(--text-light)', marginTop:2 }}>Due {fmtShort(m.date)}</div>}
      </div>
      {m.priority === 'high' && <span style={{ fontSize:9, fontWeight:800, padding:'2px 7px', borderRadius:20, background:'rgba(239,68,68,0.12)', color:'#ef4444' }}>HIGH</span>}
    </div>
  )
}

function ObsChart({ observations }) {
  const data = useMemo(() => {
    if (!observations.length) return []
    const byDate = {}
    observations.forEach(o => {
      const d = o.observed_at?.split('T')[0] || o.created_at?.split('T')[0]
      byDate[d] = (byDate[d] || 0) + 1
    })
    return Object.entries(byDate).sort(([a],[b]) => a.localeCompare(b)).slice(-14).map(([date,count]) => ({ date: fmtShort(date), count }))
  }, [observations])
  if (!data.length) return null
  return (
    <ResponsiveContainer width="100%" height={80}>
      <AreaChart data={data} margin={{ top:4, right:4, left:-30, bottom:0 }}>
        <defs>
          <linearGradient id="obsGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
            <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
          </linearGradient>
        </defs>
        <Area type="monotone" dataKey="count" stroke="#6366f1" strokeWidth={2} fill="url(#obsGrad)" dot={false}/>
        <XAxis dataKey="date" tick={{ fontSize:9, fill:'var(--text-muted)' }} tickLine={false} axisLine={false}/>
        <Tooltip contentStyle={{ background:'var(--card-bg)', border:'1px solid var(--border)', borderRadius:8, fontSize:11 }}/>
      </AreaChart>
    </ResponsiveContainer>
  )
}

function ParamBar({ label, value, range }) {
  if (value == null) return null
  const [lo, hi] = range
  const pct = Math.min(100, Math.max(0, ((value - lo) / (hi - lo)) * 100))
  const ok = value >= lo && value <= hi
  return (
    <div style={{ marginBottom:8 }}>
      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
        <span style={{ fontSize:11, color:'var(--text-muted)' }}>{label}</span>
        <span style={{ fontSize:11, fontWeight:700, color: ok ? '#22c55e' : '#ef4444' }}>{typeof value === 'number' ? value.toFixed(2) : value} {ok ? '✓' : '⚠'}</span>
      </div>
      <div style={{ height:5, background:'var(--border)', borderRadius:99, overflow:'hidden' }}>
        <div style={{ height:'100%', width:`${pct}%`, background: ok ? 'linear-gradient(90deg,#22c55e,#16a34a)' : 'linear-gradient(90deg,#ef4444,#dc2626)', borderRadius:99, transition:'width 0.4s' }}/>
      </div>
    </div>
  )
}

// ── New Project Modal ──────────────────────────────────────────────────────────
function NewProjectModal({ onClose, onCreated }) {
  const [form, setForm] = useState({ title:'', description:'', location:'', start_date:'', end_date:'', objectives:'', methodology:'' })
  const [loading, setLoading] = useState(false)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const submit = async e => {
    e.preventDefault(); setLoading(true)
    try {
      const r = await api.post('/projects', form)
      onCreated(r.data.project || r.data)
      onClose()
    } catch (err) { alert(err.response?.data?.error || 'Failed') }
    finally { setLoading(false) }
  }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.6)', zIndex:100, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
      <div style={{ background:'var(--card-bg)', borderRadius:20, width:'100%', maxWidth:560, maxHeight:'90vh', overflowY:'auto', boxShadow:'0 24px 80px rgba(0,0,0,0.4)' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'20px 24px', borderBottom:'1px solid var(--border)' }}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <div style={{ width:36, height:36, borderRadius:10, background:'linear-gradient(135deg,#6366f1,#4f46e5)', display:'flex', alignItems:'center', justifyContent:'center' }}>
              <FlaskConical style={{ width:18, height:18, color:'#fff' }}/>
            </div>
            <div>
              <div style={{ fontSize:15, fontWeight:800, color:'var(--text)' }}>New Research Project</div>
              <div style={{ fontSize:11, color:'var(--text-muted)' }}>Create a new water quality research initiative</div>
            </div>
          </div>
          <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text-muted)', padding:4 }}><X style={{ width:18, height:18 }}/></button>
        </div>
        <form onSubmit={submit} style={{ padding:24, display:'flex', flexDirection:'column', gap:14 }}>
          <div>
            <label style={{ fontSize:12, fontWeight:700, color:'var(--text-muted)', display:'block', marginBottom:6 }}>PROJECT TITLE *</label>
            <input value={form.title} onChange={e => set('title', e.target.value)} required
              placeholder="e.g. Lake Superior Microplastics Study 2026"
              style={{ width:'100%', padding:'10px 14px', borderRadius:10, border:'1px solid var(--border)', background:'var(--page-bg)', color:'var(--text)', fontSize:13, boxSizing:'border-box' }}/>
          </div>
          <div>
            <label style={{ fontSize:12, fontWeight:700, color:'var(--text-muted)', display:'block', marginBottom:6 }}>DESCRIPTION</label>
            <textarea value={form.description} onChange={e => set('description', e.target.value)} rows={3}
              placeholder="Research objectives, background, expected outcomes..."
              style={{ width:'100%', padding:'10px 14px', borderRadius:10, border:'1px solid var(--border)', background:'var(--page-bg)', color:'var(--text)', fontSize:13, resize:'none', boxSizing:'border-box' }}/>
          </div>
          <div>
            <label style={{ fontSize:12, fontWeight:700, color:'var(--text-muted)', display:'block', marginBottom:6 }}>OBJECTIVES</label>
            <textarea value={form.objectives} onChange={e => set('objectives', e.target.value)} rows={2}
              placeholder="Key scientific objectives of this project..."
              style={{ width:'100%', padding:'10px 14px', borderRadius:10, border:'1px solid var(--border)', background:'var(--page-bg)', color:'var(--text)', fontSize:13, resize:'none', boxSizing:'border-box' }}/>
          </div>
          <div>
            <label style={{ fontSize:12, fontWeight:700, color:'var(--text-muted)', display:'block', marginBottom:6 }}>METHODOLOGY</label>
            <textarea value={form.methodology} onChange={e => set('methodology', e.target.value)} rows={2}
              placeholder="Data collection methods, instruments, protocols..."
              style={{ width:'100%', padding:'10px 14px', borderRadius:10, border:'1px solid var(--border)', background:'var(--page-bg)', color:'var(--text)', fontSize:13, resize:'none', boxSizing:'border-box' }}/>
          </div>
          <div>
            <label style={{ fontSize:12, fontWeight:700, color:'var(--text-muted)', display:'block', marginBottom:6 }}>LOCATION</label>
            <input value={form.location} onChange={e => set('location', e.target.value)}
              placeholder="e.g. Lake Superior, Algoma District"
              style={{ width:'100%', padding:'10px 14px', borderRadius:10, border:'1px solid var(--border)', background:'var(--page-bg)', color:'var(--text)', fontSize:13, boxSizing:'border-box' }}/>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
            <div>
              <label style={{ fontSize:12, fontWeight:700, color:'var(--text-muted)', display:'block', marginBottom:6 }}>START DATE</label>
              <input type="date" value={form.start_date} onChange={e => set('start_date', e.target.value)}
                style={{ width:'100%', padding:'10px 14px', borderRadius:10, border:'1px solid var(--border)', background:'var(--page-bg)', color:'var(--text)', fontSize:13, boxSizing:'border-box' }}/>
            </div>
            <div>
              <label style={{ fontSize:12, fontWeight:700, color:'var(--text-muted)', display:'block', marginBottom:6 }}>END DATE</label>
              <input type="date" value={form.end_date} onChange={e => set('end_date', e.target.value)}
                style={{ width:'100%', padding:'10px 14px', borderRadius:10, border:'1px solid var(--border)', background:'var(--page-bg)', color:'var(--text)', fontSize:13, boxSizing:'border-box' }}/>
            </div>
          </div>
          <div style={{ display:'flex', gap:10, marginTop:8 }}>
            <button type="button" onClick={onClose}
              style={{ flex:1, padding:'10px', borderRadius:10, border:'1px solid var(--border)', background:'var(--page-bg)', color:'var(--text)', cursor:'pointer', fontWeight:600, fontSize:13 }}>
              Cancel
            </button>
            <button type="submit" disabled={loading}
              style={{ flex:2, padding:'10px', borderRadius:10, background:'linear-gradient(135deg,#6366f1,#4f46e5)', color:'white', border:'none', cursor:loading?'not-allowed':'pointer', fontWeight:700, fontSize:13, opacity:loading?0.7:1 }}>
              {loading ? 'Creating...' : '🚀 Create Project'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Project Detail Panel ───────────────────────────────────────────────────────
function ProjectDetail({ project, onClose, onUpdate, sites }) {
  const { user } = useAuth()
  const [tab, setTab] = useState('overview')
  const [datasets, setDatasets] = useState([])
  const [observations, setObservations] = useState([])
  const [milestones, setMilestones] = useState([])
  const [aiChat, setAiChat] = useState([])
  const [aiInput, setAiInput] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [newMilestone, setNewMilestone] = useState({ title:'', date:'', priority:'normal' })
  const [showAddMilestone, setShowAddMilestone] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [editForm, setEditForm] = useState({ title: project.title, description: project.description, status: project.status, objectives: project.objectives || '', methodology: project.methodology || '' })
  const [exporting, setExporting] = useState(false)
  const chatEndRef = useRef(null)

  const canEdit = user?.is_admin || project.created_by === user?.id || user?.is_researcher

  useEffect(() => {
    api.get(`/projects/${project.id}/datasets`).then(r => setDatasets(r.data || [])).catch(() => {})
    // Load observations from linked sites
    if (sites.length) {
      Promise.all(sites.slice(0,5).map(s => api.get(`/sites/${s.id}/observations`).then(r => r.data.observations || []).catch(() => [])))
        .then(arrs => setObservations(arrs.flat().sort((a,b) => new Date(b.created_at)-new Date(a.created_at))))
    }
    // Load milestones from localStorage (no DB table yet)
    const saved = localStorage.getItem(`milestones_${project.id}`)
    if (saved) setMilestones(JSON.parse(saved))
  }, [project.id])

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior:'smooth' }) }, [aiChat])

  const saveMilestones = (ms) => {
    setMilestones(ms)
    localStorage.setItem(`milestones_${project.id}`, JSON.stringify(ms))
  }

  const addMilestone = () => {
    if (!newMilestone.title.trim()) return
    const ms = [...milestones, { id: Date.now(), ...newMilestone, done: false }]
    saveMilestones(ms)
    setNewMilestone({ title:'', date:'', priority:'normal' })
    setShowAddMilestone(false)
  }

  const toggleMilestone = (id) => saveMilestones(milestones.map(m => m.id === id ? { ...m, done: !m.done } : m))

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: { 'text/csv':['.csv'], 'application/vnd.ms-excel':['.xls'], 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':['.xlsx'], 'application/pdf':['.pdf'], 'application/json':['.json'], 'text/plain':['.txt'] },
    onDrop: async (files) => {
      setUploading(true); setUploadProgress(0)
      const fd = new FormData(); fd.append('dataset', files[0])
      try {
        await api.post(`/projects/${project.id}/datasets`, fd, {
          onUploadProgress: e => setUploadProgress(Math.round((e.loaded / e.total) * 100))
        })
        const r = await api.get(`/projects/${project.id}/datasets`)
        setDatasets(r.data || [])
      } catch { alert('Upload failed') }
      finally { setUploading(false); setUploadProgress(0) }
    }
  })

  const sendAiMessage = async () => {
    if (!aiInput.trim() || aiLoading) return
    const userMsg = { role:'user', content: aiInput }
    setAiChat(c => [...c, userMsg]); setAiInput(''); setAiLoading(true)
    try {
      const context = `Research Project: "${project.title}"
Description: ${project.description || 'N/A'}
Objectives: ${project.objectives || 'N/A'}
Methodology: ${project.methodology || 'N/A'}
Location: ${project.location || 'N/A'}
Status: ${project.status}
Datasets uploaded: ${datasets.length}
Linked observations: ${observations.length}
Team members: ${Array.isArray(project.team_members) ? project.team_members.join(', ') : 'N/A'}
Milestones: ${milestones.length} total, ${milestones.filter(m=>m.done).length} completed`
      const history = [...aiChat, userMsg].map(m => ({ role: m.role, content: m.content }))
      const reply = await askAI([
        { role:'system', content:`You are a water quality research assistant specializing in environmental science, aquatic ecosystems, and the Great Lakes region. You help researchers analyze water quality data, design studies, and interpret findings. Always provide scientifically rigorous, actionable answers. Context about the current project:\n\n${context}` },
        ...history,
      ])
      setAiChat(c => [...c, { role:'assistant', content: reply }])
    } catch {
      setAiChat(c => [...c, { role:'assistant', content:'Sorry, AI service unavailable. Please check your API key in Settings.' }])
    } finally { setAiLoading(false) }
  }

  const saveEdit = async () => {
    try {
      await api.put(`/projects/${project.id}`, { ...project, ...editForm, team_members: project.team_members || [] })
      onUpdate({ ...project, ...editForm })
      setEditMode(false)
    } catch { alert('Failed to save changes') }
  }

  const exportProject = async () => {
    setExporting(true)
    try {
      const prompt = `Generate a comprehensive scientific research report for this water quality project:

PROJECT: ${project.title}
DESCRIPTION: ${project.description}
OBJECTIVES: ${project.objectives || 'Not specified'}
METHODOLOGY: ${project.methodology || 'Not specified'}
LOCATION: ${project.location || 'Not specified'}
STATUS: ${project.status}
DURATION: ${project.start_date || 'N/A'} to ${project.end_date || 'ongoing'}
DATASETS: ${datasets.length} files uploaded
OBSERVATIONS: ${observations.length} field measurements
MILESTONES: ${milestones.filter(m=>m.done).length}/${milestones.length} completed

Generate a full scientific report with these sections:
1. Executive Summary
2. Research Background & Objectives
3. Methodology
4. Data Collection Summary
5. Preliminary Findings
6. Water Quality Assessment
7. Risk Factors & Concerns
8. Recommendations
9. Next Steps & Timeline
10. References (recommend relevant scientific literature)

Write in a professional scientific tone suitable for academic or government audiences.`

      const report = await askAI([
        { role:'system', content:'You are a senior environmental scientist at a major research institution specializing in Great Lakes water quality. Write formal scientific reports.' },
        { role:'user', content: prompt },
      ])

      const blob = new Blob([report], { type:'text/plain' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a'); a.href = url
      a.download = `${project.title.replace(/\s+/g,'_')}_Report_${new Date().toISOString().split('T')[0]}.txt`
      a.click(); URL.revokeObjectURL(url)
    } catch { alert('Export failed') }
    finally { setExporting(false) }
  }

  const exportCSV = () => {
    if (!observations.length) return alert('No observations to export')
    const keys = ['id','site_id','observed_at','ph','turbidity','dissolved_oxygen','conductivity','temperature','nitrate','notes']
    const csv = [keys.join(','), ...observations.map(o => keys.map(k => JSON.stringify(o[k]??'')).join(','))].join('\n')
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv],{type:'text/csv'}))
    a.download = `${project.title.replace(/\s+/g,'_')}_observations.csv`; a.click()
  }

  const TABS = [
    { id:'overview',      label:'📋 Overview' },
    { id:'data',          label:'📊 Data', badge: datasets.length || null },
    { id:'observations',  label:'🔬 Observations', badge: observations.length || null },
    { id:'milestones',    label:'🎯 Milestones', badge: milestones.filter(m=>!m.done).length || null },
    { id:'ai',            label:'🤖 AI Assistant' },
    { id:'export',        label:'📥 Export' },
  ]

  const done = milestones.filter(m=>m.done).length
  const pct = milestones.length ? Math.round((done/milestones.length)*100) : 0

  // Compute average params from observations
  const avgParams = useMemo(() => {
    if (!observations.length) return {}
    const sums = {}; const cnts = {}
    const PARAMS = ['ph','turbidity','dissolved_oxygen','conductivity','temperature','nitrate']
    PARAMS.forEach(p => {
      const vals = observations.map(o => parseFloat(o[p])).filter(v => !isNaN(v))
      if (vals.length) { sums[p] = vals.reduce((a,b)=>a+b,0) / vals.length; cnts[p] = vals.length }
    })
    return sums
  }, [observations])

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.65)', zIndex:100, display:'flex', alignItems:'stretch', justifyContent:'flex-end' }}>
      <div style={{ width: Math.min(860, window.innerWidth), background:'var(--page-bg)', display:'flex', flexDirection:'column', height:'100vh', boxShadow:'-20px 0 60px rgba(0,0,0,0.3)' }}>

        {/* Header */}
        <div style={{ padding:'20px 24px', background:'var(--card-bg)', borderBottom:'1px solid var(--border)', flexShrink:0 }}>
          <div style={{ display:'flex', alignItems:'flex-start', gap:12 }}>
            <div style={{ width:44, height:44, borderRadius:12, background:'linear-gradient(135deg,#6366f1,#14b8a6)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
              <FlaskConical style={{ width:22, height:22, color:'#fff' }}/>
            </div>
            <div style={{ flex:1, minWidth:0 }}>
              {editMode ? (
                <input value={editForm.title} onChange={e => setEditForm(f=>({...f,title:e.target.value}))}
                  style={{ fontSize:18, fontWeight:800, color:'var(--text)', background:'transparent', border:'1px solid var(--border)', borderRadius:8, padding:'2px 8px', width:'100%', boxSizing:'border-box' }}/>
              ) : (
                <h2 style={{ fontSize:18, fontWeight:900, color:'var(--text)', margin:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{project.title}</h2>
              )}
              <div style={{ display:'flex', alignItems:'center', gap:8, marginTop:4 }}>
                <span style={{ fontSize:11, fontWeight:700, padding:'2px 8px', borderRadius:20, background:statusBg(project.status), color:statusColor(project.status) }}>{project.status}</span>
                {project.location && <span style={{ fontSize:11, color:'var(--text-muted)' }}>📍 {project.location}</span>}
                {project.start_date && <span style={{ fontSize:11, color:'var(--text-muted)' }}>📅 {fmt(project.start_date)}</span>}
              </div>
            </div>
            {canEdit && (
              editMode ? (
                <div style={{ display:'flex', gap:6 }}>
                  <button onClick={saveEdit} style={{ padding:'6px 12px', borderRadius:8, background:'#22c55e', color:'#fff', border:'none', cursor:'pointer', fontSize:12, fontWeight:700 }}>Save</button>
                  <button onClick={() => setEditMode(false)} style={{ padding:'6px 10px', borderRadius:8, background:'var(--page-bg)', color:'var(--text-muted)', border:'1px solid var(--border)', cursor:'pointer', fontSize:12 }}>Cancel</button>
                </div>
              ) : (
                <button onClick={() => setEditMode(true)} style={{ padding:'6px 10px', borderRadius:8, background:'var(--page-bg)', color:'var(--text-muted)', border:'1px solid var(--border)', cursor:'pointer' }}>
                  <Edit3 style={{ width:14, height:14 }}/>
                </button>
              )
            )}
            <button onClick={onClose} style={{ padding:'6px 10px', borderRadius:8, background:'var(--page-bg)', color:'var(--text-muted)', border:'1px solid var(--border)', cursor:'pointer' }}>
              <X style={{ width:14, height:14 }}/>
            </button>
          </div>

          {/* Progress bar */}
          {milestones.length > 0 && (
            <div style={{ marginTop:12 }}>
              <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                <span style={{ fontSize:11, color:'var(--text-muted)' }}>Project Progress</span>
                <span style={{ fontSize:11, fontWeight:700, color:'var(--text)' }}>{pct}%</span>
              </div>
              <div style={{ height:5, background:'var(--border)', borderRadius:99, overflow:'hidden' }}>
                <div style={{ height:'100%', width:`${pct}%`, background:'linear-gradient(90deg,#6366f1,#14b8a6)', borderRadius:99, transition:'width 0.4s' }}/>
              </div>
            </div>
          )}
        </div>

        {/* Tabs */}
        <div style={{ display:'flex', gap:2, padding:'8px 16px', background:'var(--card-bg)', borderBottom:'1px solid var(--border)', overflowX:'auto', flexShrink:0 }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              style={{ padding:'6px 14px', borderRadius:20, border:'none', cursor:'pointer', fontSize:12, fontWeight:600, whiteSpace:'nowrap', transition:'all 0.15s', background: tab===t.id ? 'linear-gradient(135deg,#6366f1,#4f46e5)' : 'transparent', color: tab===t.id ? '#fff' : 'var(--text-muted)' }}>
              {t.label}{t.badge ? ` (${t.badge})` : ''}
            </button>
          ))}
        </div>

        {/* Body */}
        <div style={{ flex:1, overflowY:'auto', padding:'20px 24px', scrollbarWidth:'thin', scrollbarColor:'rgba(99,102,241,0.3) transparent' }}>

          {/* ── OVERVIEW ── */}
          {tab === 'overview' && (
            <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
              {editMode ? (
                <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                  {[['description','Description',3],['objectives','Objectives',2],['methodology','Methodology',2]].map(([k,label,rows]) => (
                    <div key={k}>
                      <label style={{ fontSize:12, fontWeight:700, color:'var(--text-muted)', display:'block', marginBottom:5 }}>{label.toUpperCase()}</label>
                      <textarea value={editForm[k]||''} onChange={e=>setEditForm(f=>({...f,[k]:e.target.value}))} rows={rows}
                        style={{ width:'100%', padding:'10px 12px', borderRadius:10, border:'1px solid var(--border)', background:'var(--page-bg)', color:'var(--text)', fontSize:13, resize:'vertical', boxSizing:'border-box' }}/>
                    </div>
                  ))}
                  <div>
                    <label style={{ fontSize:12, fontWeight:700, color:'var(--text-muted)', display:'block', marginBottom:5 }}>STATUS</label>
                    <select value={editForm.status} onChange={e=>setEditForm(f=>({...f,status:e.target.value}))}
                      style={{ padding:'8px 12px', borderRadius:8, border:'1px solid var(--border)', background:'var(--page-bg)', color:'var(--text)', fontSize:13 }}>
                      {['active','paused','completed','archived'].map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                </div>
              ) : (
                <>
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10 }}>
                    <StatCard icon={Database} label="Datasets" value={datasets.length} color="#6366f1"/>
                    <StatCard icon={Activity} label="Observations" value={observations.length} color="#0ea5e9"/>
                    <StatCard icon={CheckSquare} label="Milestones" value={`${done}/${milestones.length}`} color="#22c55e"/>
                  </div>
                  {project.description && (
                    <div style={{ background:'var(--card-bg)', border:'1px solid var(--border)', borderRadius:12, padding:16 }}>
                      <div style={{ fontSize:11, fontWeight:700, color:'var(--text-muted)', marginBottom:8, letterSpacing:'0.08em' }}>DESCRIPTION</div>
                      <p style={{ fontSize:13, color:'var(--text)', lineHeight:1.7, margin:0 }}>{project.description}</p>
                    </div>
                  )}
                  {project.objectives && (
                    <div style={{ background:'var(--card-bg)', border:'1px solid var(--border)', borderRadius:12, padding:16 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:8 }}>
                        <Target style={{ width:14, height:14, color:'#f59e0b' }}/>
                        <div style={{ fontSize:11, fontWeight:700, color:'var(--text-muted)', letterSpacing:'0.08em' }}>OBJECTIVES</div>
                      </div>
                      <p style={{ fontSize:13, color:'var(--text)', lineHeight:1.7, margin:0 }}>{project.objectives}</p>
                    </div>
                  )}
                  {project.methodology && (
                    <div style={{ background:'var(--card-bg)', border:'1px solid var(--border)', borderRadius:12, padding:16 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:8 }}>
                        <Clipboard style={{ width:14, height:14, color:'#0ea5e9' }}/>
                        <div style={{ fontSize:11, fontWeight:700, color:'var(--text-muted)', letterSpacing:'0.08em' }}>METHODOLOGY</div>
                      </div>
                      <p style={{ fontSize:13, color:'var(--text)', lineHeight:1.7, margin:0 }}>{project.methodology}</p>
                    </div>
                  )}
                  {observations.length > 0 && (
                    <div style={{ background:'var(--card-bg)', border:'1px solid var(--border)', borderRadius:12, padding:16 }}>
                      <div style={{ fontSize:11, fontWeight:700, color:'var(--text-muted)', marginBottom:10, letterSpacing:'0.08em' }}>RECENT OBSERVATION ACTIVITY (14 DAYS)</div>
                      <ObsChart observations={observations}/>
                    </div>
                  )}
                  {observations.length > 0 && (
                    <div style={{ background:'var(--card-bg)', border:'1px solid var(--border)', borderRadius:12, padding:16 }}>
                      <div style={{ fontSize:11, fontWeight:700, color:'var(--text-muted)', marginBottom:12, letterSpacing:'0.08em' }}>AVG WATER QUALITY PARAMETERS (WHO COMPARISON)</div>
                      {Object.entries(avgParams).map(([k,v]) => WHO_THRESHOLDS[k] && (
                        <ParamBar key={k} label={PARAM_LABELS[k]||k} value={v} range={WHO_THRESHOLDS[k]}/>
                      ))}
                    </div>
                  )}
                  {Array.isArray(project.team_members) && project.team_members.length > 0 && (
                    <div style={{ background:'var(--card-bg)', border:'1px solid var(--border)', borderRadius:12, padding:16 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:10 }}>
                        <Users style={{ width:14, height:14, color:'#ec4899' }}/>
                        <div style={{ fontSize:11, fontWeight:700, color:'var(--text-muted)', letterSpacing:'0.08em' }}>TEAM MEMBERS</div>
                      </div>
                      <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
                        {project.team_members.map((m,i) => (
                          <div key={i} style={{ display:'flex', alignItems:'center', gap:6, padding:'5px 12px', borderRadius:20, background:'rgba(236,72,153,0.08)', border:'1px solid rgba(236,72,153,0.15)' }}>
                            <div style={{ width:22, height:22, borderRadius:'50%', background:'linear-gradient(135deg,#ec4899,#f43f5e)', display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontSize:10, fontWeight:700 }}>{String(m)[0]?.toUpperCase()||'?'}</div>
                            <span style={{ fontSize:12, color:'var(--text)', fontWeight:600 }}>{m}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* ── DATA ── */}
          {tab === 'data' && (
            <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
              <div {...getRootProps()} style={{ border:`2px dashed ${isDragActive?'#6366f1':'var(--border)'}`, borderRadius:14, padding:28, textAlign:'center', cursor:'pointer', background: isDragActive?'rgba(99,102,241,0.06)':'rgba(99,102,241,0.02)', transition:'all 0.15s' }}>
                <input {...getInputProps()}/>
                {uploading ? (
                  <>
                    <Loader style={{ width:28, height:28, color:'#6366f1', margin:'0 auto 10px', animation:'spin 1s linear infinite' }}/>
                    <div style={{ fontSize:13, fontWeight:700, color:'var(--text)', marginBottom:8 }}>Uploading... {uploadProgress}%</div>
                    <div style={{ height:4, background:'var(--border)', borderRadius:99, overflow:'hidden', maxWidth:200, margin:'0 auto' }}>
                      <div style={{ height:'100%', width:`${uploadProgress}%`, background:'linear-gradient(90deg,#6366f1,#14b8a6)', borderRadius:99, transition:'width 0.3s' }}/>
                    </div>
                  </>
                ) : (
                  <>
                    <Upload style={{ width:28, height:28, color: isDragActive?'#6366f1':'var(--text-light)', margin:'0 auto 8px' }}/>
                    <div style={{ fontSize:14, fontWeight:700, color:'var(--text)' }}>Drop dataset here</div>
                    <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:4 }}>CSV · Excel · JSON · PDF · TXT — any format</div>
                  </>
                )}
              </div>
              {datasets.length === 0 ? (
                <div style={{ textAlign:'center', padding:'32px 0', color:'var(--text-muted)', fontSize:13 }}>No datasets uploaded yet</div>
              ) : datasets.map(d => (
                <div key={d.id} style={{ background:'var(--card-bg)', border:'1px solid var(--border)', borderRadius:12, padding:16 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:10 }}>
                    <Database style={{ width:16, height:16, color:'#6366f1' }}/>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:13, fontWeight:700, color:'var(--text)' }}>{d.file_name}</div>
                      <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:2 }}>
                        {d.row_count ? `${d.row_count.toLocaleString()} rows` : ''} · {d.file_size ? `${(d.file_size/1024).toFixed(1)} KB` : ''} · Uploaded {fmtShort(d.uploaded_at)}
                        {d.display_name && ` by ${d.display_name}`}
                      </div>
                    </div>
                  </div>
                  {d.column_names?.length > 0 && (
                    <div style={{ display:'flex', flexWrap:'wrap', gap:5 }}>
                      {d.column_names.slice(0,12).map(c => (
                        <span key={c} style={{ padding:'2px 8px', borderRadius:20, background:'rgba(99,102,241,0.08)', fontSize:10, fontWeight:600, color:'#818cf8' }}>{c}</span>
                      ))}
                      {d.column_names.length > 12 && <span style={{ padding:'2px 8px', borderRadius:20, background:'rgba(148,163,184,0.08)', fontSize:10, color:'var(--text-muted)' }}>+{d.column_names.length-12} more</span>}
                    </div>
                  )}
                  {d.ai_analysis && (
                    <div style={{ marginTop:10, padding:'10px 12px', borderRadius:8, background:'rgba(99,102,241,0.05)', border:'1px solid rgba(99,102,241,0.1)', fontSize:12, color:'var(--text)', lineHeight:1.6 }}>
                      <span style={{ fontWeight:700, color:'#818cf8' }}>🤖 AI: </span>{d.ai_analysis.slice(0,300)}{d.ai_analysis.length>300?'…':''}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* ── OBSERVATIONS ── */}
          {tab === 'observations' && (
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              {observations.length === 0 ? (
                <div style={{ textAlign:'center', padding:'48px 0', color:'var(--text-muted)' }}>
                  <Activity style={{ width:40, height:40, margin:'0 auto 12px', opacity:0.3 }}/>
                  <div style={{ fontSize:14, fontWeight:600 }}>No observations linked</div>
                  <div style={{ fontSize:12, marginTop:4 }}>Link monitoring sites in the Map page to collect data</div>
                </div>
              ) : (
                <>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
                    <div style={{ fontSize:13, fontWeight:700, color:'var(--text)' }}>{observations.length} field observations</div>
                    <button onClick={exportCSV} style={{ display:'flex', alignItems:'center', gap:5, padding:'6px 12px', borderRadius:8, background:'rgba(20,184,166,0.08)', color:'#14b8a6', border:'1px solid rgba(20,184,166,0.2)', cursor:'pointer', fontSize:12, fontWeight:600 }}>
                      <Download style={{ width:12, height:12 }}/> Export CSV
                    </button>
                  </div>
                  {observations.slice(0,50).map(o => (
                    <div key={o.id} style={{ background:'var(--card-bg)', border:'1px solid var(--border)', borderRadius:10, padding:'12px 14px' }}>
                      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:8 }}>
                        <div style={{ fontSize:12, fontWeight:700, color:'var(--text)' }}>Site #{o.site_id}</div>
                        <div style={{ fontSize:11, color:'var(--text-muted)' }}>{fmtShort(o.observed_at || o.created_at)}</div>
                      </div>
                      <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                        {['ph','turbidity','dissolved_oxygen','conductivity','temperature'].map(k => o[k] != null && (
                          <div key={k} style={{ padding:'3px 8px', borderRadius:6, background:'rgba(99,102,241,0.06)', fontSize:11 }}>
                            <span style={{ color:'var(--text-muted)' }}>{PARAM_LABELS[k]||k}: </span>
                            <span style={{ fontWeight:700, color:'var(--text)' }}>{parseFloat(o[k]).toFixed(2)}</span>
                          </div>
                        ))}
                      </div>
                      {o.notes && <div style={{ marginTop:8, fontSize:11, color:'var(--text-muted)', fontStyle:'italic' }}>{o.notes}</div>}
                    </div>
                  ))}
                  {observations.length > 50 && <div style={{ textAlign:'center', fontSize:12, color:'var(--text-muted)', padding:'8px 0' }}>Showing 50 of {observations.length} — export CSV for full dataset</div>}
                </>
              )}
            </div>
          )}

          {/* ── MILESTONES ── */}
          {tab === 'milestones' && (
            <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <div>
                  <div style={{ fontSize:14, fontWeight:800, color:'var(--text)' }}>Project Milestones</div>
                  <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:2 }}>{done} of {milestones.length} completed</div>
                </div>
                <button onClick={() => setShowAddMilestone(s=>!s)}
                  style={{ display:'flex', alignItems:'center', gap:6, padding:'7px 14px', borderRadius:9, background:'linear-gradient(135deg,#6366f1,#4f46e5)', color:'#fff', border:'none', cursor:'pointer', fontSize:12, fontWeight:700 }}>
                  <Plus style={{ width:13, height:13 }}/> Add Milestone
                </button>
              </div>

              {showAddMilestone && (
                <div style={{ background:'var(--card-bg)', border:'1px solid rgba(99,102,241,0.2)', borderRadius:12, padding:14 }}>
                  <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                    <input placeholder="Milestone title..." value={newMilestone.title} onChange={e=>setNewMilestone(m=>({...m,title:e.target.value}))}
                      style={{ flex:2, minWidth:140, padding:'8px 12px', borderRadius:8, border:'1px solid var(--border)', background:'var(--page-bg)', color:'var(--text)', fontSize:13 }}/>
                    <input type="date" value={newMilestone.date} onChange={e=>setNewMilestone(m=>({...m,date:e.target.value}))}
                      style={{ flex:1, minWidth:100, padding:'8px 12px', borderRadius:8, border:'1px solid var(--border)', background:'var(--page-bg)', color:'var(--text)', fontSize:13 }}/>
                    <select value={newMilestone.priority} onChange={e=>setNewMilestone(m=>({...m,priority:e.target.value}))}
                      style={{ padding:'8px 12px', borderRadius:8, border:'1px solid var(--border)', background:'var(--page-bg)', color:'var(--text)', fontSize:13 }}>
                      <option value="normal">Normal</option>
                      <option value="high">High Priority</option>
                    </select>
                    <button onClick={addMilestone} style={{ padding:'8px 14px', borderRadius:8, background:'#22c55e', color:'#fff', border:'none', cursor:'pointer', fontWeight:700, fontSize:13 }}>Add</button>
                  </div>
                </div>
              )}

              {milestones.length === 0 ? (
                <div style={{ textAlign:'center', padding:'40px 0', color:'var(--text-muted)' }}>
                  <Target style={{ width:36, height:36, margin:'0 auto 10px', opacity:0.3 }}/>
                  <div style={{ fontSize:13 }}>No milestones yet. Add one to track your research goals.</div>
                </div>
              ) : (
                <div>
                  {milestones.filter(m=>!m.done).map(m => <MilestoneRow key={m.id} m={m} onToggle={toggleMilestone}/>)}
                  {milestones.filter(m=>m.done).length > 0 && (
                    <>
                      <div style={{ fontSize:11, color:'var(--text-muted)', fontWeight:700, letterSpacing:'0.08em', margin:'12px 0 6px' }}>COMPLETED</div>
                      {milestones.filter(m=>m.done).map(m => <MilestoneRow key={m.id} m={m} onToggle={toggleMilestone}/>)}
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── AI ASSISTANT ── */}
          {tab === 'ai' && (
            <div style={{ display:'flex', flexDirection:'column', gap:12, height:'100%' }}>
              <div style={{ display:'flex', alignItems:'center', gap:8, padding:'10px 14px', borderRadius:10, background:'rgba(99,102,241,0.06)', border:'1px solid rgba(99,102,241,0.15)' }}>
                <Bot style={{ width:16, height:16, color:'#818cf8' }}/>
                <span style={{ fontSize:12, color:'var(--text)' }}>AI Research Assistant — Ask anything about this project, water quality, methodology, or analysis</span>
              </div>

              <div style={{ flex:1, minHeight:300, maxHeight:480, overflowY:'auto', display:'flex', flexDirection:'column', gap:10, scrollbarWidth:'thin', scrollbarColor:'rgba(99,102,241,0.3) transparent' }}>
                {aiChat.length === 0 && (
                  <div style={{ textAlign:'center', padding:'32px 0', color:'var(--text-muted)' }}>
                    <Bot style={{ width:40, height:40, margin:'0 auto 10px', opacity:0.3 }}/>
                    <div style={{ fontSize:13 }}>Start by asking about your project...</div>
                    <div style={{ display:'flex', flexWrap:'wrap', gap:6, justifyContent:'center', marginTop:12 }}>
                      {['Summarize this project','What parameters should I measure?','How do I improve data quality?','Write an abstract for this research'].map(q => (
                        <button key={q} onClick={() => { setAiInput(q) }}
                          style={{ padding:'5px 12px', borderRadius:20, background:'rgba(99,102,241,0.08)', border:'1px solid rgba(99,102,241,0.15)', color:'#818cf8', fontSize:11, cursor:'pointer', fontWeight:600 }}>
                          {q}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {aiChat.map((m, i) => (
                  <div key={i} style={{ display:'flex', gap:8, alignItems:'flex-start', flexDirection: m.role==='user' ? 'row-reverse' : 'row' }}>
                    <div style={{ width:28, height:28, borderRadius:'50%', background: m.role==='user' ? 'linear-gradient(135deg,#6366f1,#4f46e5)' : 'linear-gradient(135deg,#0ea5e9,#14b8a6)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                      {m.role==='user' ? <span style={{ color:'#fff', fontSize:11 }}>U</span> : <Bot style={{ width:14, height:14, color:'#fff' }}/>}
                    </div>
                    <div style={{ maxWidth:'80%', padding:'10px 14px', borderRadius:12, background: m.role==='user' ? 'rgba(99,102,241,0.1)' : 'var(--card-bg)', border:'1px solid var(--border)', fontSize:13, color:'var(--text)', lineHeight:1.6, whiteSpace:'pre-wrap' }}>
                      {m.content}
                    </div>
                  </div>
                ))}
                {aiLoading && (
                  <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                    <div style={{ width:28, height:28, borderRadius:'50%', background:'linear-gradient(135deg,#0ea5e9,#14b8a6)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                      <Bot style={{ width:14, height:14, color:'#fff' }}/>
                    </div>
                    <div style={{ padding:'10px 14px', borderRadius:12, background:'var(--card-bg)', border:'1px solid var(--border)' }}>
                      <Loader style={{ width:14, height:14, color:'#6366f1', animation:'spin 1s linear infinite' }}/>
                    </div>
                  </div>
                )}
                <div ref={chatEndRef}/>
              </div>

              <div style={{ display:'flex', gap:8 }}>
                <input value={aiInput} onChange={e=>setAiInput(e.target.value)} onKeyDown={e=>e.key==='Enter'&&!e.shiftKey&&sendAiMessage()}
                  placeholder="Ask the AI about your project..."
                  style={{ flex:1, padding:'10px 14px', borderRadius:10, border:'1px solid var(--border)', background:'var(--page-bg)', color:'var(--text)', fontSize:13 }}/>
                <button onClick={sendAiMessage} disabled={!aiInput.trim()||aiLoading}
                  style={{ padding:'10px 16px', borderRadius:10, background:'linear-gradient(135deg,#6366f1,#4f46e5)', color:'#fff', border:'none', cursor:aiLoading||!aiInput.trim()?'not-allowed':'pointer', opacity:aiLoading||!aiInput.trim()?0.6:1 }}>
                  <Send style={{ width:14, height:14 }}/>
                </button>
              </div>
            </div>
          )}

          {/* ── EXPORT ── */}
          {tab === 'export' && (
            <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
              <div style={{ fontSize:14, fontWeight:800, color:'var(--text)', marginBottom:4 }}>Export & Reports</div>

              {[
                { icon: FileText, color:'#6366f1', title:'AI Research Report', sub:`Full scientific report with methodology, findings & recommendations — AI-generated`, action: exportProject, loading: exporting, label: exporting ? 'Generating...' : 'Generate Report' },
                { icon: Activity, color:'#0ea5e9', title:'Observation Data (CSV)', sub:`${observations.length} field observations with all parameters`, action: exportCSV, label:'Export CSV' },
                { icon: Database, color:'#22c55e', title:'Project Summary (JSON)', sub:'Complete project metadata, datasets, milestones', action: () => {
                  const data = JSON.stringify({ project, datasets, observations: observations.slice(0,200), milestones }, null, 2)
                  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([data],{type:'application/json'}))
                  a.download = `${project.title.replace(/\s+/g,'_')}_data.json`; a.click()
                }, label:'Export JSON' },
              ].map((item, i) => (
                <div key={i} style={{ background:'var(--card-bg)', border:'1px solid var(--border)', borderRadius:14, padding:'18px 20px', display:'flex', alignItems:'center', gap:14 }}>
                  <div style={{ width:44, height:44, borderRadius:12, background:`${item.color}18`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                    <item.icon style={{ width:20, height:20, color:item.color }}/>
                  </div>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:14, fontWeight:700, color:'var(--text)' }}>{item.title}</div>
                    <div style={{ fontSize:12, color:'var(--text-muted)', marginTop:3 }}>{item.sub}</div>
                  </div>
                  <button onClick={item.action} disabled={item.loading}
                    style={{ padding:'8px 16px', borderRadius:9, background:item.loading?'var(--page-bg)':`${item.color}15`, color:item.color, border:`1px solid ${item.color}30`, cursor:item.loading?'not-allowed':'pointer', fontWeight:700, fontSize:12, display:'flex', alignItems:'center', gap:6, opacity:item.loading?0.7:1 }}>
                    {item.loading ? <Loader style={{ width:12, height:12, animation:'spin 1s linear infinite' }}/> : <Download style={{ width:12, height:12 }}/>}
                    {item.label}
                  </button>
                </div>
              ))}

              <div style={{ background:'rgba(99,102,241,0.04)', border:'1px dashed rgba(99,102,241,0.2)', borderRadius:12, padding:14 }}>
                <div style={{ fontSize:12, fontWeight:700, color:'#818cf8', marginBottom:6 }}>💡 Pro Tip</div>
                <div style={{ fontSize:12, color:'var(--text-muted)', lineHeight:1.7 }}>Upload your datasets in the Data tab and link monitoring sites in the Map page to get the most detailed AI-generated reports. The AI uses your actual field data to provide specific findings and recommendations.</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function Projects() {
  const { user } = useAuth()
  const isResearcher = user?.is_researcher || user?.role === 'researcher'
  const isAdmin = user?.is_admin
  const canCreate = isResearcher || isAdmin
  const [projects, setProjects] = useState([])
  const [sites, setSites] = useState([])
  const [showNew, setShowNew] = useState(false)
  const [selected, setSelected] = useState(null)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      api.get('/projects').then(r => setProjects(r.data.projects || r.data || [])),
      api.get('/sites').then(r => setSites(r.data.sites || r.data || [])),
    ]).catch(() => {}).finally(() => setLoading(false))
  }, [])

  const filtered = projects.filter(p => {
    const matchesSearch = !search || p.title?.toLowerCase().includes(search.toLowerCase()) || p.description?.toLowerCase().includes(search.toLowerCase())
    const matchesStatus = filterStatus === 'all' || p.status === filterStatus
    return matchesSearch && matchesStatus
  })

  const stats = useMemo(() => ({
    total: projects.length,
    active: projects.filter(p=>p.status==='active').length,
    completed: projects.filter(p=>p.status==='completed').length,
    datasets: projects.reduce((s,p)=>s+(p.dataset_count||0),0),
  }), [projects])

  return (
    <div style={{ maxWidth:1200, margin:'0 auto', padding:'0 0 40px' }}>
      <PageAmbience/>

      {/* ── Header ── */}
      <div style={{ marginBottom:24 }}>
        <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:12, flexWrap:'wrap' }}>
          <div>
            <h1 style={{ fontSize:24, fontWeight:900, color:'var(--text)', margin:0, letterSpacing:'-0.02em', display:'flex', alignItems:'center', gap:10 }}>
              <span style={{ fontSize:28 }}>🔬</span> Research Projects
            </h1>
            <p style={{ fontSize:13, color:'var(--text-muted)', margin:'4px 0 0' }}>
              NASA-level water research workspace — data collection, AI analysis, milestones &amp; export
            </p>
          </div>
          {canCreate && (
            <button onClick={() => setShowNew(true)}
              style={{ display:'flex', alignItems:'center', gap:8, padding:'10px 20px', borderRadius:12, background:'linear-gradient(135deg,#6366f1,#4f46e5)', color:'white', border:'none', cursor:'pointer', fontWeight:700, fontSize:14, boxShadow:'0 4px 16px rgba(99,102,241,0.3)' }}>
              <Plus style={{ width:16, height:16 }}/> New Project
            </button>
          )}
        </div>

        {/* Stats */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10, marginTop:18 }}>
          <StatCard icon={FlaskConical} label="Total Projects" value={stats.total} color="#6366f1"/>
          <StatCard icon={Activity}    label="Active"         value={stats.active} color="#22c55e"/>
          <StatCard icon={Award}       label="Completed"      value={stats.completed} color="#f59e0b"/>
          <StatCard icon={Database}    label="Datasets"       value={stats.datasets} color="#0ea5e9"/>
        </div>
      </div>

      {/* ── Research Tools Banner ── */}
      <div style={{ background:'var(--card-bg)', border:'1px solid var(--border)', borderRadius:16, padding:'18px 20px', marginBottom:24, overflow:'hidden', position:'relative' }}>
        <div style={{ position:'absolute', top:-20, right:-20, width:120, height:120, borderRadius:'50%', background:'linear-gradient(135deg,rgba(99,102,241,0.08),rgba(20,184,166,0.08))', pointerEvents:'none' }}/>
        <div style={{ fontSize:12, fontWeight:800, color:'var(--text-muted)', letterSpacing:'0.1em', marginBottom:12 }}>RESEARCH TOOLKIT</div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10 }}>
          {TOOLS.map(t => (
            <div key={t.label} style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 12px', borderRadius:10, background:`${t.color}08`, border:`1px solid ${t.color}20` }}>
              <t.icon style={{ width:16, height:16, color:t.color, flexShrink:0 }}/>
              <div>
                <div style={{ fontSize:12, fontWeight:700, color:'var(--text)' }}>{t.label}</div>
                <div style={{ fontSize:10, color:'var(--text-muted)', marginTop:1 }}>{t.sub}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Filters ── */}
      <div style={{ display:'flex', gap:10, marginBottom:18, flexWrap:'wrap', alignItems:'center' }}>
        <div style={{ flex:1, minWidth:200, position:'relative' }}>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search projects..."
            style={{ width:'100%', padding:'9px 14px 9px 36px', borderRadius:10, border:'1px solid var(--border)', background:'var(--card-bg)', color:'var(--text)', fontSize:13, boxSizing:'border-box' }}/>
          <span style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', fontSize:13, opacity:0.4 }}>🔍</span>
        </div>
        <div style={{ display:'flex', gap:6 }}>
          {['all','active','paused','completed','archived'].map(s => (
            <button key={s} onClick={() => setFilterStatus(s)}
              style={{ padding:'7px 14px', borderRadius:20, cursor:'pointer', fontSize:12, fontWeight:600, background: filterStatus===s ? (s==='all'?'linear-gradient(135deg,#6366f1,#4f46e5)':statusBg(s)) : 'var(--card-bg)', color: filterStatus===s ? (s==='all'?'white':statusColor(s)) : 'var(--text-muted)', border: filterStatus===s ? 'none' : '1px solid var(--border)' }}>
              {s.charAt(0).toUpperCase()+s.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* ── Project Grid ── */}
      {loading ? (
        <div style={{ textAlign:'center', padding:'60px 0', color:'var(--text-muted)' }}>
          <Loader style={{ width:32, height:32, margin:'0 auto 12px', animation:'spin 1s linear infinite', color:'#6366f1' }}/>
          <div>Loading projects...</div>
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign:'center', padding:'60px 0' }}>
          <div style={{ width:72, height:72, borderRadius:20, background:'linear-gradient(135deg,rgba(99,102,241,0.1),rgba(20,184,166,0.1))', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 16px' }}>
            <FlaskConical style={{ width:32, height:32, color:'#6366f1' }}/>
          </div>
          <div style={{ fontSize:16, fontWeight:700, color:'var(--text)', marginBottom:6 }}>
            {projects.length === 0 ? 'No research projects yet' : 'No matching projects'}
          </div>
          <div style={{ fontSize:13, color:'var(--text-muted)', marginBottom:20 }}>
            {projects.length === 0 ? 'Create your first water quality research project to get started.' : 'Try adjusting your search or filters.'}
          </div>
          {canCreate && projects.length === 0 && (
            <button onClick={() => setShowNew(true)}
              style={{ padding:'10px 24px', borderRadius:12, background:'linear-gradient(135deg,#6366f1,#4f46e5)', color:'white', border:'none', cursor:'pointer', fontWeight:700, fontSize:14 }}>
              🚀 Create First Project
            </button>
          )}
        </div>
      ) : (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(320px,1fr))', gap:16 }}>
          {filtered.map(p => (
            <div key={p.id} onClick={() => setSelected(p)}
              style={{ background:'var(--card-bg)', border:'1px solid var(--border)', borderRadius:16, padding:'20px', cursor:'pointer', transition:'all 0.15s', position:'relative', overflow:'hidden' }}
              onMouseEnter={e => { e.currentTarget.style.transform='translateY(-2px)'; e.currentTarget.style.boxShadow='0 8px 32px rgba(99,102,241,0.12)'; e.currentTarget.style.borderColor='rgba(99,102,241,0.3)' }}
              onMouseLeave={e => { e.currentTarget.style.transform=''; e.currentTarget.style.boxShadow=''; e.currentTarget.style.borderColor='var(--border)' }}>

              <div style={{ position:'absolute', top:0, left:0, right:0, height:3, background:`linear-gradient(90deg,${statusColor(p.status)},transparent)`, borderRadius:'16px 16px 0 0' }}/>

              <div style={{ display:'flex', alignItems:'flex-start', gap:12, marginBottom:12 }}>
                <div style={{ width:40, height:40, borderRadius:11, background:'linear-gradient(135deg,#6366f120,#14b8a620)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                  <FlaskConical style={{ width:20, height:20, color:'#6366f1' }}/>
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <h3 style={{ fontSize:14, fontWeight:800, color:'var(--text)', margin:'0 0 4px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{p.title}</h3>
                  <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                    <span style={{ fontSize:10, fontWeight:700, padding:'2px 7px', borderRadius:20, background:statusBg(p.status), color:statusColor(p.status) }}>{p.status}</span>
                    {p.dataset_count > 0 && <span style={{ fontSize:10, color:'var(--text-muted)' }}>📊 {p.dataset_count} dataset{p.dataset_count!==1?'s':''}</span>}
                  </div>
                </div>
                <ChevronRight style={{ width:14, height:14, color:'var(--text-light)', flexShrink:0 }}/>
              </div>

              {p.description && (
                <p style={{ fontSize:12, color:'var(--text-muted)', lineHeight:1.6, margin:'0 0 12px', display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden' }}>
                  {p.description}
                </p>
              )}

              <div style={{ display:'flex', alignItems:'center', gap:12, flexWrap:'wrap' }}>
                {p.location && (
                  <div style={{ display:'flex', alignItems:'center', gap:4, fontSize:11, color:'var(--text-muted)' }}>
                    <MapPin style={{ width:11, height:11 }}/>{p.location}
                  </div>
                )}
                {p.start_date && (
                  <div style={{ display:'flex', alignItems:'center', gap:4, fontSize:11, color:'var(--text-muted)' }}>
                    <Calendar style={{ width:11, height:11 }}/>{fmtShort(p.start_date)}
                  </div>
                )}
                {p.creator_name && (
                  <div style={{ display:'flex', alignItems:'center', gap:4, fontSize:11, color:'var(--text-muted)' }}>
                    <Users style={{ width:11, height:11 }}/>{p.creator_name}
                  </div>
                )}
              </div>

              {p.objectives && (
                <div style={{ marginTop:10, padding:'8px 10px', borderRadius:8, background:'rgba(99,102,241,0.04)', border:'1px solid rgba(99,102,241,0.1)' }}>
                  <div style={{ fontSize:9, fontWeight:800, color:'#818cf8', letterSpacing:'0.08em', marginBottom:3 }}>OBJECTIVE</div>
                  <div style={{ fontSize:11, color:'var(--text-muted)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{p.objectives}</div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── Modals ── */}
      {showNew && <NewProjectModal onClose={() => setShowNew(false)} onCreated={p => { setProjects(prev => [p, ...prev]); setSelected(p) }}/>}
      {selected && (
        <ProjectDetail
          project={selected}
          onClose={() => setSelected(null)}
          onUpdate={updated => { setProjects(prev => prev.map(p => p.id===updated.id ? updated : p)); setSelected(updated) }}
          sites={sites}
        />
      )}
    </div>
  )
}
