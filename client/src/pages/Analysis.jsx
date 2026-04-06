/**
 * Analysis.jsx — Elite Research Intelligence Workspace
 * Upgraded from basic file-tool to full ML/analytics module.
 */
import PageAmbience from '../components/layout/PageAmbience'
import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { askAI, buildFileContext } from '../utils/openrouter'
import { useDropzone } from 'react-dropzone'
import {
  BarChart, Bar, LineChart, Line, ScatterChart, Scatter,
  XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer,
  Cell, ReferenceLine, Area, AreaChart,
} from 'recharts'
import {
  Upload, Trash2, FileText, BarChart2, MessageSquare,
  Brain, CheckCircle, AlertTriangle, Download, Database,
  Zap, Send, RefreshCw, FileSpreadsheet, FileCode, TrendingUp,
  Table, Activity, Shield, Eye, GitCompare, FlaskConical,
  Target, Layers, ChevronRight, ArrowUp, ArrowDown, Minus,
  Star, Info, Cpu, GitBranch, AlertCircle, Plus,
} from 'lucide-react'
import axios from 'axios'

const SVC = import.meta.env.VITE_ANALYSIS_URL || 'http://localhost:8001'

// ── WHO water quality thresholds ─────────────────────────────────────────────
const WHO = {
  ph:                { min: 6.5,  max: 8.5,   unit: '',       label: 'pH' },
  turbidity:         { min: 0,    max: 5,     unit: ' NTU',   label: 'Turbidity' },
  dissolved_oxygen:  { min: 6,    max: 999,   unit: ' mg/L',  label: 'DO' },
  temperature:       { min: 0,    max: 25,    unit: ' °C',    label: 'Temp' },
  nitrates:          { min: 0,    max: 10,    unit: ' mg/L',  label: 'Nitrates' },
  conductivity:      { min: 0,    max: 1500,  unit: ' µS/cm', label: 'Conductivity' },
  phosphorus:        { min: 0,    max: 0.03,  unit: ' mg/L',  label: 'Phosphorus' },
  ecoli:             { min: 0,    max: 0,     unit: ' CFU',   label: 'E. coli' },
  tss:               { min: 0,    max: 30,    unit: ' mg/L',  label: 'TSS' },
  chlorophyll:       { min: 0,    max: 15,    unit: ' µg/L',  label: 'Chlorophyll' },
}

function whoMatch(col) {
  const key = col.toLowerCase().replace(/\s+/g,'_').replace(/[^a-z_]/g,'')
  return Object.entries(WHO).find(([k]) => key.includes(k))
}

function whoStatus(col, mean) {
  const match = whoMatch(col)
  if (!match) return null
  const [, t] = match
  if (mean < t.min) return { label:'Below range', color:'#0ea5e9', bg:'rgba(14,165,233,0.1)', border:'rgba(14,165,233,0.2)', level: 1 }
  if (mean > t.max) return { label:'Exceeds limit', color:'#ef4444', bg:'rgba(239,68,68,0.1)', border:'rgba(239,68,68,0.2)', level: 3 }
  return { label:'Safe ✓', color:'#10b981', bg:'rgba(16,185,129,0.1)', border:'rgba(16,185,129,0.2)', level: 0 }
}

// ── Compute risk score 0–100 from stats ──────────────────────────────────────
function computeRiskScore(stats) {
  if (!stats?.col_stats) return null
  let total = 0, count = 0, violations = []
  Object.entries(stats.col_stats).forEach(([col, s]) => {
    const match = whoMatch(col)
    if (!match) return
    const [, t] = match
    const mean = parseFloat(s.mean)
    count++
    if (mean > t.max) {
      const ratio = mean / t.max
      const pts = Math.min(40, (ratio - 1) * 40)
      total += pts
      violations.push({ col, mean, threshold: t.max, severity: ratio > 2 ? 'critical' : 'elevated' })
    }
    if (s.outliers > 0) total += Math.min(15, s.outliers * 3)
  })
  if (!count) return null
  const score = Math.min(100, Math.round(total / Math.max(count, 1)))
  const level = score >= 60 ? 'critical' : score >= 35 ? 'elevated' : score >= 15 ? 'moderate' : 'low'
  return { score, level, violations }
}

// ── Auto-generate insights from stats ────────────────────────────────────────
function generateInsights(selected) {
  const insights = []
  if (!selected?.stats) return insights
  const s = selected.stats
  const colStats = s.col_stats || {}

  // WHO violations
  Object.entries(colStats).forEach(([col, cs]) => {
    const who = whoStatus(col, parseFloat(cs.mean))
    if (who?.level === 3) {
      insights.push({
        type:'risk', icon: AlertTriangle, color:'#ef4444',
        title: `${col} Exceeds WHO Limit`,
        text: `Mean value of ${cs.mean} exceeds the safety threshold. ${cs.outliers || 0} outlier samples detected. Immediate investigation recommended.`,
        priority: 3,
      })
    }
  })

  // Outlier warnings
  const highOutliers = Object.entries(colStats).filter(([,cs]) => (cs.outliers||0) >= 3)
  if (highOutliers.length) {
    insights.push({
      type:'anomaly', icon: Target, color:'#f59e0b',
      title: `${highOutliers.reduce((a,[,cs])=>a+cs.outliers,0)} Statistical Outliers Detected`,
      text: `Columns with elevated outliers: ${highOutliers.map(([c])=>c).join(', ')}. These may indicate measurement errors or genuine contamination events.`,
      priority: 2,
    })
  }

  // Data completeness
  if (s.row_count && s.col_count) {
    insights.push({
      type:'info', icon: Database, color:'#6366f1',
      title: `Dataset: ${s.row_count.toLocaleString()} Samples × ${s.col_count} Variables`,
      text: `${(s.num_cols||[]).length} numeric columns and ${(s.cat_cols||[]).length} categorical. ${s.row_count < 30 ? 'Small sample — treat interpretations with caution.' : 'Sufficient sample size for statistical analysis.'}`,
      priority: 0,
    })
  }

  // Correlation insight
  if (s.correlation) {
    const pairs = []
    const cols = Object.keys(s.correlation)
    cols.forEach((a, i) => cols.slice(i+1).forEach(b => {
      const v = s.correlation[a]?.[b]
      if (v && Math.abs(v) > 0.7) pairs.push({ a, b, v })
    }))
    if (pairs.length) {
      insights.push({
        type:'pattern', icon: GitBranch, color:'#8b5cf6',
        title: `${pairs.length} Strong Correlation${pairs.length>1?'s':''} Found`,
        text: pairs.slice(0,3).map(p=>`${p.a} ↔ ${p.b}: r=${p.v.toFixed(2)}`).join(' | ') + (pairs.length>3 ? ` +${pairs.length-3} more` : ''),
        priority: 1,
      })
    }
  }

  // pH trend note
  if (colStats.ph || colStats.pH) {
    const phStats = colStats.ph || colStats.pH
    const mean = parseFloat(phStats.mean)
    if (mean < 7.0) {
      insights.push({
        type:'risk', icon: Activity, color:'#f97316',
        title: 'Acidic Conditions Detected',
        text: `Mean pH of ${phStats.mean} indicates acidic conditions. Possible causes: acid precipitation, organic decay, or upstream industrial discharge.`,
        priority: 2,
      })
    }
  }

  if (insights.length === 0) {
    insights.push({
      type:'success', icon: CheckCircle, color:'#10b981',
      title: 'No Critical Issues Detected',
      text: 'All monitored parameters appear within expected ranges. Continue routine monitoring and compare with historical baselines.',
      priority: 0,
    })
  }

  return insights.sort((a,b)=>b.priority-a.priority)
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtBytes(b) {
  if (!b) return '0 B'
  const k = 1024, s = ['B','KB','MB','GB']
  const i = Math.floor(Math.log(b)/Math.log(k))
  return `${parseFloat((b/Math.pow(k,i)).toFixed(1))} ${s[i]}`
}

function FileIcon({ ext, size = 15 }) {
  const s = { width: size, height: size }
  if (['.pdf'].includes(ext)) return <FileText style={{ ...s, color:'#ef4444' }}/>
  if (['.csv','.xlsx','.xls'].includes(ext)) return <FileSpreadsheet style={{ ...s, color:'#10b981' }}/>
  if (['.docx','.doc'].includes(ext)) return <FileText style={{ ...s, color:'#0ea5e9' }}/>
  return <FileCode style={{ ...s, color:'#94a3b8' }}/>
}

function StatusDot({ status }) {
  const map = { ready:'#10b981', processing:'#f59e0b', error:'#ef4444', indexing:'#6366f1' }
  const c = map[status] || '#94a3b8'
  return (
    <span style={{ position:'relative', display:'inline-flex', alignItems:'center' }}>
      <span style={{ width:7, height:7, borderRadius:'50%', background:c, display:'block' }}/>
      {status === 'processing' && <span style={{ position:'absolute', width:7, height:7, borderRadius:'50%', background:c, opacity:0.4, animation:'ping 1.2s ease-in-out infinite' }}/>}
    </span>
  )
}

// ── Scanning animation ────────────────────────────────────────────────────────
function ScanAnimation({ label = 'Processing…' }) {
  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:16, padding:'32px 0' }}>
      <div style={{ position:'relative', width:64, height:64 }}>
        <div style={{ width:64, height:64, borderRadius:'50%', border:'2px solid rgba(99,102,241,0.15)' }}/>
        <div style={{ position:'absolute', inset:0, borderRadius:'50%', border:'2px solid transparent', borderTopColor:'#6366f1', animation:'spin 1s linear infinite' }}/>
        <div style={{ position:'absolute', inset:8, borderRadius:'50%', border:'1.5px solid transparent', borderTopColor:'#14b8a6', animation:'spin 1.4s linear infinite reverse' }}/>
        <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center' }}>
          <Cpu style={{ width:18, height:18, color:'#6366f1' }}/>
        </div>
      </div>
      <div style={{ textAlign:'center' }}>
        <div style={{ fontSize:14, fontWeight:700, color:'var(--text)' }}>{label}</div>
        <div style={{ fontSize:12, color:'var(--text-muted)', marginTop:4 }}>Running ML pipeline…</div>
      </div>
      <div style={{ display:'flex', gap:4 }}>
        {['Parsing','Indexing','Statistics','ML Analysis'].map((step,i) => (
          <span key={step} style={{ fontSize:11, padding:'3px 10px', borderRadius:20, background:'rgba(99,102,241,0.08)', color:'#818cf8', border:'1px solid rgba(99,102,241,0.15)', animation:`fadeInStep 0.4s ease ${i*0.3}s both` }}>
            {step}
          </span>
        ))}
      </div>
    </div>
  )
}

// ── Risk Badge ────────────────────────────────────────────────────────────────
function RiskBadge({ score, level }) {
  const cfg = {
    low:      { color:'#10b981', bg:'rgba(16,185,129,0.1)',  border:'rgba(16,185,129,0.2)',  label:'LOW RISK' },
    moderate: { color:'#f59e0b', bg:'rgba(245,158,11,0.1)',  border:'rgba(245,158,11,0.2)',  label:'MODERATE' },
    elevated: { color:'#f97316', bg:'rgba(249,115,22,0.1)',  border:'rgba(249,115,22,0.2)',  label:'ELEVATED' },
    critical: { color:'#ef4444', bg:'rgba(239,68,68,0.1)',   border:'rgba(239,68,68,0.2)',   label:'CRITICAL' },
  }
  const c = cfg[level] || cfg.low
  const circumference = 2 * Math.PI * 22
  const dash = circumference * (1 - score/100)

  return (
    <div style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 16px', background:c.bg, border:`1px solid ${c.border}`, borderRadius:12 }}>
      <div style={{ position:'relative', width:52, height:52, flexShrink:0 }}>
        <svg width="52" height="52" viewBox="0 0 52 52" style={{ transform:'rotate(-90deg)' }}>
          <circle cx="26" cy="26" r="22" fill="none" stroke={c.border} strokeWidth="3"/>
          <circle cx="26" cy="26" r="22" fill="none" stroke={c.color} strokeWidth="3"
            strokeDasharray={circumference} strokeDashoffset={dash}
            strokeLinecap="round" style={{ transition:'stroke-dashoffset 0.8s ease' }}/>
        </svg>
        <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', fontSize:14, fontWeight:900, color:c.color }}>
          {score}
        </div>
      </div>
      <div>
        <div style={{ fontSize:10, fontWeight:800, letterSpacing:'0.08em', color:c.color }}>{c.label}</div>
        <div style={{ fontSize:13, fontWeight:700, color:'var(--text)', marginTop:1 }}>Risk Score</div>
        <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:1 }}>Based on WHO thresholds + ML outliers</div>
      </div>
    </div>
  )
}

// ── Insight Card ──────────────────────────────────────────────────────────────
function InsightCard({ insight, index }) {
  const Icon = insight.icon
  return (
    <div style={{
      padding:'12px 14px', borderRadius:10, border:`1px solid ${insight.color}25`,
      background:`${insight.color}06`, display:'flex', gap:10, alignItems:'flex-start',
      animation:`slideInUp 0.3s ease ${index*0.07}s both`,
    }}>
      <div style={{ width:30, height:30, borderRadius:8, background:`${insight.color}15`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
        <Icon style={{ width:14, height:14, color:insight.color }}/>
      </div>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:12, fontWeight:700, color:'var(--text)', marginBottom:2 }}>{insight.title}</div>
        <div style={{ fontSize:11, color:'var(--text-muted)', lineHeight:1.5 }}>{insight.text}</div>
      </div>
    </div>
  )
}

// ── Markdown renderer ─────────────────────────────────────────────────────────
function MdLine({ line }) {
  const parts = []; let r = line, k = 0
  while (r) {
    const m = r.match(/(\*\*|__)(.*?)\1/)
    if (!m) { parts.push(<span key={k++}>{r}</span>); break }
    if (m.index > 0) parts.push(<span key={k++}>{r.slice(0, m.index)}</span>)
    parts.push(<strong key={k++} style={{ color:'var(--text)', fontWeight:700 }}>{m[2]}</strong>)
    r = r.slice(m.index + m[0].length)
  }
  return <>{parts}</>
}
function MarkdownChat({ content }) {
  if (!content) return null
  const lines = content.split('\n')
  const els = []; let i = 0
  while (i < lines.length) {
    const l = lines[i]
    if (l.startsWith('### ')) { els.push(<div key={i} style={{ fontSize:12, fontWeight:800, color:'#38bdf8', marginTop:10, marginBottom:3, letterSpacing:'0.03em', borderBottom:'1px solid rgba(56,189,248,0.15)', paddingBottom:3 }}>{l.slice(4)}</div>); i++; continue }
    if (l.startsWith('## '))  { els.push(<div key={i} style={{ fontSize:13, fontWeight:800, color:'var(--text)', marginTop:10, marginBottom:4 }}>{l.slice(3)}</div>); i++; continue }
    if (l.startsWith('# '))   { els.push(<div key={i} style={{ fontSize:15, fontWeight:900, color:'var(--text)', marginTop:12, marginBottom:5 }}>{l.slice(2)}</div>); i++; continue }
    if (l.startsWith('---') || l.startsWith('===')) { els.push(<hr key={i} style={{ border:'none', borderTop:'1px solid rgba(255,255,255,0.1)', margin:'8px 0' }}/>); i++; continue }
    if (l.startsWith('- ') || l.startsWith('• ')) { els.push(<div key={i} style={{ display:'flex', gap:7, marginBottom:2 }}><span style={{ color:'#38bdf8', flexShrink:0 }}>•</span><span style={{ fontSize:11, lineHeight:1.6, color:'var(--text-muted)' }}><MdLine line={l.slice(2)}/></span></div>); i++; continue }
    if (/^\d+\.\s/.test(l)) { const m = l.match(/^(\d+)\.\s(.*)/); els.push(<div key={i} style={{ display:'flex', gap:6, marginBottom:2 }}><span style={{ color:'#6366f1', fontWeight:700, fontSize:10, minWidth:16 }}>{m[1]}.</span><span style={{ fontSize:11, lineHeight:1.6, color:'var(--text-muted)' }}><MdLine line={m[2]}/></span></div>); i++; continue }
    if (l.startsWith('```')) { const code=[]; i++; while(i<lines.length&&!lines[i].startsWith('```')){code.push(lines[i]);i++} els.push(<pre key={i} style={{ background:'rgba(0,0,0,0.3)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:7, padding:'8px 12px', fontSize:10, color:'#a5f3fc', overflowX:'auto', margin:'6px 0', lineHeight:1.5 }}>{code.join('\n')}</pre>); i++; continue }
    if (l.trim() === '') { els.push(<div key={i} style={{ height:5 }}/>); i++; continue }
    els.push(<div key={i} style={{ fontSize:11, color:'var(--text-muted)', lineHeight:1.7, marginBottom:1 }}><MdLine line={l}/></div>); i++
  }
  return <div style={{ display:'flex', flexDirection:'column' }}>{els}</div>
}

// ── ChatMessage ───────────────────────────────────────────────────────────────
function ChatMessage({ msg }) {
  const isUser = msg.role === 'user'
  return (
    <div style={{ display:'flex', gap:8, justifyContent: isUser ? 'flex-end' : 'flex-start' }}>
      {!isUser && (
        <div style={{ width:28, height:28, borderRadius:'50%', background:'linear-gradient(135deg,#6366f1,#14b8a6)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, marginTop:2 }}>
          <Brain style={{ width:13, height:13, color:'#fff' }}/>
        </div>
      )}
      <div style={{
        maxWidth:'88%', borderRadius: isUser ? '14px 14px 4px 14px' : '4px 14px 14px 14px',
        padding:'9px 13px',
        background: isUser ? 'linear-gradient(135deg,#6366f1,#4f46e5)' : 'var(--card-bg)',
        border: isUser ? 'none' : '1px solid var(--border)',
      }}>
        {msg.loading
          ? <span style={{ display:'flex', gap:6, alignItems:'center', color:'var(--text-muted)', fontSize:11 }}>
              <RefreshCw style={{ width:11, height:11, animation:'spin 1s linear infinite' }}/> Analyzing…
            </span>
          : isUser
            ? <div style={{ fontSize:12, color:'#fff', lineHeight:1.6 }}>{msg.text}</div>
            : <MarkdownChat content={msg.text} />
        }
      </div>
    </div>
  )
}

// ── Stats Table ───────────────────────────────────────────────────────────────
function StatsTable({ stats, selectedCol, onSelectCol }) {
  const cols = Object.keys(stats)
  if (!cols.length) return null
  return (
    <div style={{ background:'var(--card-bg)', border:'1px solid var(--border)', borderRadius:12, overflow:'hidden' }}>
      <div style={{ padding:'10px 16px', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', gap:8 }}>
        <Table style={{ width:14, height:14, color:'#6366f1' }}/>
        <span style={{ fontSize:13, fontWeight:700, color:'var(--text)' }}>Statistical Summary</span>
        <span style={{ marginLeft:'auto', fontSize:11, color:'var(--text-muted)' }}>{cols.length} numeric columns</span>
      </div>
      <div style={{ overflowX:'auto' }}>
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
          <thead>
            <tr style={{ background:'rgba(0,0,0,0.02)' }}>
              {['Column','Count','Mean','Median','Std Dev','Min','Max','Outliers','WHO Status'].map(h => (
                <th key={h} style={{ padding:'8px 12px', textAlign:'left', fontWeight:700, fontSize:10, textTransform:'uppercase', letterSpacing:'0.05em', color:'var(--text-muted)', whiteSpace:'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {cols.map(col => {
              const s = stats[col]
              const who = whoStatus(col, parseFloat(s.mean))
              const active = selectedCol === col
              return (
                <tr key={col} onClick={() => onSelectCol(col)}
                  style={{ borderTop:'1px solid var(--border)', cursor:'pointer', background: active ? 'rgba(99,102,241,0.05)' : 'transparent', transition:'background 0.12s' }}
                  onMouseEnter={e => !active && (e.currentTarget.style.background='rgba(99,102,241,0.02)')}
                  onMouseLeave={e => !active && (e.currentTarget.style.background='transparent')}>
                  <td style={{ padding:'9px 12px', fontWeight:700, color: active ? '#818cf8' : 'var(--text)' }}>{col}</td>
                  <td style={{ padding:'9px 12px', color:'var(--text-muted)' }}>{s.count?.toLocaleString()}</td>
                  <td style={{ padding:'9px 12px', color:'var(--text-muted)' }}>{s.mean}</td>
                  <td style={{ padding:'9px 12px', color:'var(--text-muted)' }}>{s.median}</td>
                  <td style={{ padding:'9px 12px', color:'var(--text-muted)' }}>{s.std}</td>
                  <td style={{ padding:'9px 12px', color:'var(--text-muted)' }}>{s.min}</td>
                  <td style={{ padding:'9px 12px', color:'var(--text-muted)' }}>{s.max}</td>
                  <td style={{ padding:'9px 12px' }}>
                    <span style={{ padding:'2px 8px', borderRadius:20, fontSize:10, fontWeight:700,
                      background: (s.outliers||0)>0 ? 'rgba(249,115,22,0.12)' : 'rgba(16,185,129,0.1)',
                      color: (s.outliers||0)>0 ? '#f97316' : '#10b981' }}>
                      {s.outliers||0}
                    </span>
                  </td>
                  <td style={{ padding:'9px 12px' }}>
                    {who
                      ? <span style={{ padding:'2px 8px', borderRadius:20, fontSize:10, fontWeight:700, background:who.bg, color:who.color, border:`1px solid ${who.border}` }}>{who.label}</span>
                      : <span style={{ fontSize:11, color:'var(--text-muted)' }}>—</span>}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Anomaly Panel (frontend ML approximation) ─────────────────────────────────
function AnomalyPanel({ selected }) {
  const [mlResults, setMlResults] = useState(null)
  const [loading, setLoading] = useState(false)

  const runML = async () => {
    setLoading(true)
    try {
      const r = await axios.post(`${SVC}/ml/anomaly/${selected.id}`, {}, { timeout: 30000 })
      setMlResults(r.data)
    } catch {
      // Fallback: derive from stats
      const anomalies = []
      const colStats = selected.stats?.col_stats || {}
      Object.entries(colStats).forEach(([col, s]) => {
        if ((s.outliers||0) > 0) {
          const mean = parseFloat(s.mean), std = parseFloat(s.std)
          anomalies.push({
            col, count: s.outliers,
            high_bound: (mean + 2.5*std).toFixed(3),
            low_bound: (mean - 2.5*std).toFixed(3),
            who: whoStatus(col, mean),
          })
        }
      })
      setMlResults({ anomalies, method:'IQR + 2.5σ rule (local)', note:'Full IsolationForest not available — using statistical fallback' })
    }
    setLoading(false)
  }

  if (!selected?.stats) return null

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div style={{ fontSize:13, fontWeight:700, color:'var(--text)', display:'flex', alignItems:'center', gap:6 }}>
          <Target style={{ width:15, height:15, color:'#f97316' }}/> Anomaly Detection
        </div>
        {!mlResults && (
          <button onClick={runML} disabled={loading}
            style={{ display:'flex', alignItems:'center', gap:6, padding:'6px 14px', borderRadius:9, background:'rgba(249,115,22,0.1)', color:'#f97316', border:'none', cursor:'pointer', fontSize:12, fontWeight:600 }}>
            {loading ? <RefreshCw style={{ width:12, height:12, animation:'spin 1s linear infinite' }}/> : <Cpu style={{ width:12, height:12 }}/>}
            {loading ? 'Running ML…' : 'Run Anomaly Detection'}
          </button>
        )}
      </div>

      {loading && <ScanAnimation label="Running anomaly detection…"/>}

      {mlResults && (
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {mlResults.note && (
            <div style={{ padding:'8px 12px', borderRadius:9, background:'rgba(99,102,241,0.06)', border:'1px solid rgba(99,102,241,0.12)', fontSize:11, color:'var(--text-muted)', display:'flex', gap:6, alignItems:'flex-start' }}>
              <Info style={{ width:12, height:12, color:'#818cf8', flexShrink:0, marginTop:1 }}/>{mlResults.note}
            </div>
          )}
          <div style={{ padding:'8px 12px', borderRadius:9, background:'rgba(249,115,22,0.06)', border:'1px solid rgba(249,115,22,0.12)', fontSize:12, color:'var(--text-muted)' }}>
            Method: <strong style={{ color:'var(--text)' }}>{mlResults.method}</strong>
          </div>
          {(mlResults.anomalies||[]).length === 0 ? (
            <div style={{ padding:'16px', textAlign:'center', background:'rgba(16,185,129,0.06)', border:'1px solid rgba(16,185,129,0.15)', borderRadius:10, fontSize:13, color:'#10b981', fontWeight:600 }}>
              <CheckCircle style={{ width:18, height:18, margin:'0 auto 6px', display:'block' }}/>
              No anomalous patterns detected in this dataset.
            </div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {(mlResults.anomalies||[]).map((a, i) => (
                <div key={i} style={{ padding:'12px 14px', borderRadius:10, background:'rgba(249,115,22,0.06)', border:'1px solid rgba(249,115,22,0.15)' }}>
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:6 }}>
                    <span style={{ fontSize:13, fontWeight:700, color:'var(--text)' }}>{a.col}</span>
                    <span style={{ padding:'2px 9px', borderRadius:20, fontSize:11, fontWeight:700, background:'rgba(249,115,22,0.15)', color:'#f97316' }}>
                      {a.count} anomalies
                    </span>
                  </div>
                  <div style={{ display:'flex', gap:8, fontSize:11, color:'var(--text-muted)', flexWrap:'wrap' }}>
                    <span>Expected range: [{a.low_bound}, {a.high_bound}]</span>
                    {a.who && <span style={{ padding:'1px 7px', borderRadius:20, background:a.who.bg, color:a.who.color, fontWeight:600 }}>{a.who.label}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
          <button onClick={() => setMlResults(null)}
            style={{ alignSelf:'flex-start', fontSize:11, color:'var(--text-muted)', background:'none', border:'none', cursor:'pointer', display:'flex', alignItems:'center', gap:4, padding:0 }}>
            <RefreshCw style={{ width:10, height:10 }}/> Re-run
          </button>
        </div>
      )}

      {!mlResults && !loading && (
        <div style={{ padding:'16px', textAlign:'center', background:'rgba(249,115,22,0.04)', border:'1px dashed rgba(249,115,22,0.2)', borderRadius:10, fontSize:12, color:'var(--text-muted)' }}>
          Click "Run Anomaly Detection" to find statistical outliers and anomalous patterns using IsolationForest + 2.5σ rules.
        </div>
      )}
    </div>
  )
}

// ── Trend Panel ───────────────────────────────────────────────────────────────
function TrendPanel({ selected, selectedCol }) {
  const stats = selected?.stats?.col_stats?.[selectedCol]
  const chartData = selectedCol && selected?.stats?.all_charts?.[selectedCol]
    ? selected.stats.all_charts[selectedCol].map(d => ({ i: d.i, v: d.v }))
    : []

  if (!selectedCol || !stats) return (
    <div style={{ padding:'20px', textAlign:'center', fontSize:12, color:'var(--text-muted)' }}>Select a numeric column to view trend analysis.</div>
  )

  // Compute linear regression approximation on frontend
  const n = chartData.length
  const trendDir = n >= 3 ? (() => {
    const first3 = chartData.slice(0,3).reduce((a,d)=>a+d.v,0)/3
    const last3 = chartData.slice(-3).reduce((a,d)=>a+d.v,0)/3
    const change = ((last3 - first3) / first3) * 100
    return { change: change.toFixed(1), dir: change > 2 ? 'up' : change < -2 ? 'down' : 'stable' }
  })() : null

  const trendColor = trendDir?.dir === 'up' ? '#ef4444' : trendDir?.dir === 'down' ? '#0ea5e9' : '#10b981'

  // Histogram
  const vals = chartData.map(d=>d.v)
  const histData = (() => {
    if (!vals.length) return []
    const min=Math.min(...vals), max=Math.max(...vals)
    if (min===max) return [{ range:min.toFixed(2), count:vals.length }]
    const bins = Math.min(12, Math.ceil(Math.sqrt(vals.length)))
    const step = (max-min)/bins
    const buckets = Array.from({length:bins},(_,i)=>({ range:(min+i*step).toFixed(2), count:0, i }))
    vals.forEach(v=>{ const idx=Math.min(Math.floor((v-min)/step),bins-1); buckets[idx].count++ })
    return buckets
  })()

  const who = whoStatus(selectedCol, parseFloat(stats.mean))

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
      {/* Summary row */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(120px,1fr))', gap:8 }}>
        {[
          { label:'Mean', value:stats.mean, icon: Minus },
          { label:'Std Dev', value:stats.std, icon: Activity },
          { label:'Outliers', value:stats.outliers||0, icon: Target },
          ...(trendDir ? [{ label:'Trend', value:`${trendDir.change}%`, icon: trendDir.dir==='up'?ArrowUp:trendDir.dir==='down'?ArrowDown:Minus, trendColor }] : []),
        ].map(s => (
          <div key={s.label} style={{ padding:'10px 12px', borderRadius:10, background:'var(--card-bg)', border:'1px solid var(--border)' }}>
            <div style={{ display:'flex', alignItems:'center', gap:5, marginBottom:4 }}>
              <s.icon style={{ width:12, height:12, color:s.trendColor||'var(--text-muted)' }}/>
              <span style={{ fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.06em', color:'var(--text-muted)' }}>{s.label}</span>
            </div>
            <div style={{ fontSize:16, fontWeight:900, color:s.trendColor||'var(--text)' }}>{s.value}</div>
          </div>
        ))}
        {who && (
          <div style={{ padding:'10px 12px', borderRadius:10, background:who.bg, border:`1px solid ${who.border}` }}>
            <div style={{ fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.06em', color:who.color, marginBottom:4 }}>WHO Status</div>
            <div style={{ fontSize:12, fontWeight:800, color:who.color }}>{who.label}</div>
          </div>
        )}
      </div>

      {/* Distribution chart */}
      {histData.length > 0 && (
        <div style={{ background:'var(--card-bg)', border:'1px solid var(--border)', borderRadius:12, padding:14 }}>
          <div style={{ fontSize:12, fontWeight:700, color:'var(--text)', marginBottom:10 }}>Distribution — {selectedCol}</div>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={histData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.04)"/>
              <XAxis dataKey="range" tick={{ fontSize:9, fill:'var(--text-muted)' }}/>
              <YAxis tick={{ fontSize:9, fill:'var(--text-muted)' }}/>
              <Tooltip contentStyle={{ background:'var(--card-bg)', border:'1px solid var(--border)', borderRadius:8, fontSize:11 }}/>
              <Bar dataKey="count" radius={[3,3,0,0]}>
                {histData.map((_, i) => <Cell key={i} fill={`hsl(${210+i*8},65%,58%)`}/>)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Trend line */}
      {chartData.length > 2 && (
        <div style={{ background:'var(--card-bg)', border:'1px solid var(--border)', borderRadius:12, padding:14 }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
            <div style={{ fontSize:12, fontWeight:700, color:'var(--text)' }}>Time Series — {selectedCol}</div>
            {trendDir && (
              <span style={{ display:'flex', alignItems:'center', gap:4, fontSize:11, fontWeight:700, color:trendColor }}>
                {trendDir.dir==='up' ? <ArrowUp style={{ width:11, height:11 }}/> : trendDir.dir==='down' ? <ArrowDown style={{ width:11, height:11 }}/> : <Minus style={{ width:11, height:11 }}/>}
                {trendDir.change}% overall trend
              </span>
            )}
          </div>
          <ResponsiveContainer width="100%" height={160}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="trendGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity="0.2"/>
                  <stop offset="95%" stopColor="#6366f1" stopOpacity="0"/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.04)"/>
              <XAxis dataKey="i" tick={{ fontSize:9, fill:'var(--text-muted)' }}/>
              <YAxis tick={{ fontSize:9, fill:'var(--text-muted)' }}/>
              <Tooltip contentStyle={{ background:'var(--card-bg)', border:'1px solid var(--border)', borderRadius:8, fontSize:11 }}/>
              <Area type="monotone" dataKey="v" stroke="#6366f1" strokeWidth={2} fill="url(#trendGrad)" dot={false}/>
              {who?.level === 3 && (
                <ReferenceLine y={whoMatch(selectedCol)?.[1]?.max} stroke="#ef4444" strokeDasharray="4 4" label={{ value:'WHO Limit', fontSize:9, fill:'#ef4444' }}/>
              )}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}

// ── Data Quality Panel ────────────────────────────────────────────────────────
function DataQualityPanel({ selected }) {
  if (!selected?.stats) return null
  const s = selected.stats
  const colStats = s.col_stats || {}

  const qualityChecks = [
    { label:'Sample Size', ok: (s.row_count||0) >= 30, desc: `${s.row_count||0} rows — ${(s.row_count||0)>=30?'sufficient for analysis':'small sample, interpret with caution'}` },
    { label:'Numeric Coverage', ok: (s.num_cols||[]).length > 0, desc: `${(s.num_cols||[]).length} of ${s.col_count||0} columns are numeric` },
    { label:'High Outlier Columns', ok: Object.values(colStats).every(c=>(c.outliers||0)<=5), desc: (() => { const bad=Object.entries(colStats).filter(([,c])=>(c.outliers||0)>5); return bad.length ? `${bad.map(([c])=>c).join(', ')} have high outlier counts` : 'All columns within expected outlier range' })() },
    { label:'WHO Coverage', ok: (s.num_cols||[]).some(c=>whoMatch(c)), desc: `${(s.num_cols||[]).filter(c=>whoMatch(c)).length} columns have WHO reference thresholds` },
    { label:'Correlation Available', ok: !!s.correlation, desc: s.correlation ? 'Pearson correlation matrix computed' : 'Not enough numeric columns for correlation' },
  ]

  const score = Math.round((qualityChecks.filter(c=>c.ok).length / qualityChecks.length) * 100)

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
      <div style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 16px', borderRadius:12, background:score>=80?'rgba(16,185,129,0.06)':score>=50?'rgba(245,158,11,0.06)':'rgba(239,68,68,0.06)', border:`1px solid ${score>=80?'rgba(16,185,129,0.15)':score>=50?'rgba(245,158,11,0.15)':'rgba(239,68,68,0.15)'}` }}>
        <div style={{ fontSize:28, fontWeight:900, color:score>=80?'#10b981':score>=50?'#f59e0b':'#ef4444' }}>{score}%</div>
        <div>
          <div style={{ fontSize:13, fontWeight:700, color:'var(--text)' }}>Data Quality Score</div>
          <div style={{ fontSize:11, color:'var(--text-muted)' }}>Based on completeness, coverage, and consistency</div>
        </div>
      </div>

      <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
        {qualityChecks.map((check, i) => (
          <div key={i} style={{ display:'flex', alignItems:'flex-start', gap:10, padding:'10px 14px', borderRadius:10, background:'var(--card-bg)', border:'1px solid var(--border)' }}>
            <div style={{ width:22, height:22, borderRadius:'50%', background:check.ok?'rgba(16,185,129,0.12)':'rgba(239,68,68,0.1)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
              {check.ok
                ? <CheckCircle style={{ width:12, height:12, color:'#10b981' }}/>
                : <AlertCircle style={{ width:12, height:12, color:'#ef4444' }}/>}
            </div>
            <div>
              <div style={{ fontSize:12, fontWeight:700, color:'var(--text)' }}>{check.label}</div>
              <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:1 }}>{check.desc}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Column type summary */}
      <div style={{ background:'var(--card-bg)', border:'1px solid var(--border)', borderRadius:12, padding:14 }}>
        <div style={{ fontSize:12, fontWeight:700, color:'var(--text)', marginBottom:10 }}>Column Inventory</div>
        <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
          {(s.num_cols||[]).map(c => {
            const who = whoMatch(c)
            return (
              <span key={c} style={{ padding:'3px 10px', borderRadius:20, fontSize:11, fontWeight:600, background:who?'rgba(99,102,241,0.1)':'rgba(20,184,166,0.08)', color:who?'#818cf8':'#2dd4bf', border:`1px solid ${who?'rgba(99,102,241,0.2)':'rgba(20,184,166,0.15)'}` }}>
                {c}{who?` (WHO)`:' (numeric)'}
              </span>
            )
          })}
          {(s.cat_cols||[]).map(c => (
            <span key={c} style={{ padding:'3px 10px', borderRadius:20, fontSize:11, fontWeight:600, background:'rgba(100,116,139,0.08)', color:'#64748b', border:'1px solid rgba(100,116,139,0.12)' }}>
              {c} (categorical)
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Compare Panel ─────────────────────────────────────────────────────────────
function ComparePanel({ files, selectedIds, onToggle }) {
  const [comparing, setComparing] = useState(false)
  const [result, setResult] = useState(null)

  const runCompare = async () => {
    if (selectedIds.length < 2) return
    setComparing(true)
    try {
      const r = await axios.post(`${SVC}/compare`, { file_ids: selectedIds }, { timeout: 30000 })
      setResult(r.data)
    } catch {
      // Frontend comparison fallback
      const targets = files.filter(f => selectedIds.includes(f.id))
      const diffs = []
      targets.forEach(f => {
        const s = f.stats?.col_stats || {}
        Object.entries(s).forEach(([col, cs]) => {
          const who = whoStatus(col, parseFloat(cs.mean))
          if (who?.level >= 2) diffs.push({ file: f.name, col, mean: cs.mean, status: who.label })
        })
      })
      setResult({ files: targets.map(f=>f.name), differences: diffs, summary:`Compared ${targets.length} files — ${diffs.length} parameter(s) flagged` })
    }
    setComparing(false)
  }

  const eligible = files.filter(f => f.stats?.col_stats)

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
      <div style={{ fontSize:12, color:'var(--text-muted)' }}>Select 2+ files to compare statistics, anomalies, and risk levels.</div>

      <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
        {eligible.map(f => (
          <div key={f.id} onClick={() => onToggle(f.id)}
            style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 14px', borderRadius:10, cursor:'pointer', border:`1px solid ${selectedIds.includes(f.id)?'rgba(99,102,241,0.4)':'var(--border)'}`, background:selectedIds.includes(f.id)?'rgba(99,102,241,0.06)':'var(--card-bg)', transition:'all 0.15s' }}>
            <div style={{ width:18, height:18, borderRadius:4, border:`2px solid ${selectedIds.includes(f.id)?'#6366f1':'var(--border)'}`, background:selectedIds.includes(f.id)?'#6366f1':'transparent', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
              {selectedIds.includes(f.id) && <CheckCircle style={{ width:12, height:12, color:'#fff' }}/>}
            </div>
            <FileIcon ext={f.ext}/>
            <span style={{ fontSize:12, fontWeight:600, color:'var(--text)', flex:1, minWidth:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{f.name}</span>
            <span style={{ fontSize:11, color:'var(--text-muted)', flexShrink:0 }}>{f.stats?.row_count?.toLocaleString()||'?'} rows</span>
          </div>
        ))}
        {eligible.length < 2 && <div style={{ fontSize:12, color:'var(--text-muted)', fontStyle:'italic' }}>Upload at least 2 CSV/Excel files to use compare mode.</div>}
      </div>

      {selectedIds.length >= 2 && (
        <button onClick={runCompare} disabled={comparing}
          style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:8, padding:'9px 0', borderRadius:10, background:'rgba(99,102,241,0.1)', color:'#818cf8', border:'1px solid rgba(99,102,241,0.2)', cursor:'pointer', fontSize:13, fontWeight:700 }}>
          {comparing ? <><RefreshCw style={{ width:13, height:13, animation:'spin 1s linear infinite' }}/> Comparing…</> : <><GitCompare style={{ width:13, height:13 }}/> Compare {selectedIds.length} Files</>}
        </button>
      )}

      {comparing && <ScanAnimation label="Running comparison analysis…"/>}

      {result && (
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          <div style={{ padding:'10px 14px', borderRadius:10, background:'rgba(99,102,241,0.06)', border:'1px solid rgba(99,102,241,0.15)', fontSize:12, color:'var(--text-muted)' }}>
            {result.summary}
          </div>
          {(result.differences||[]).length > 0 && (
            <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
              {result.differences.map((d, i) => (
                <div key={i} style={{ padding:'10px 12px', borderRadius:9, background:'rgba(249,115,22,0.06)', border:'1px solid rgba(249,115,22,0.15)', fontSize:12 }}>
                  <span style={{ fontWeight:700, color:'var(--text)' }}>{d.file}</span>
                  <span style={{ color:'var(--text-muted)', margin:'0 6px' }}>·</span>
                  <span style={{ color:'#f97316' }}>{d.col}: {d.mean}</span>
                  <span style={{ color:'var(--text-muted)', marginLeft:8 }}>[{d.status}]</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Main Analysis Component ───────────────────────────────────────────────────
export default function Analysis() {
  const [serviceUp, setServiceUp] = useState(null)
  const [files, setFiles] = useState([])
  const [selected, setSelected] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [selectedCol, setSelectedCol] = useState(null)
  const [chatHistory, setChatHistory] = useState({}) // keyed by file.id — persists across tab switches
  const [question, setQuestion] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const [tab, setTab] = useState('overview')
  const [compareIds, setCompareIds] = useState([])
  const chatEndRef = useRef(null)

  useEffect(() => {
    axios.get(`${SVC}/health`, { timeout: 3000 })
      .then(() => setServiceUp(true)).catch(() => setServiceUp(false))
  }, [])

  useEffect(() => {
    if (!serviceUp) return
    axios.get(`${SVC}/files`).then(r => setFiles(r.data.files||[])).catch(()=>{})
  }, [serviceUp])

  const chat = selected ? (chatHistory[selected.id] || []) : []
  const setChat = (msgs) => { if (selected) setChatHistory(h => ({ ...h, [selected.id]: typeof msgs === 'function' ? msgs(h[selected.id]||[]) : msgs })) }

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior:'smooth' }) }, [chat])

  useEffect(() => {
    if (selected?.stats?.num_cols?.length) setSelectedCol(selected.stats.num_cols[0])
    else setSelectedCol(null)
  }, [selected?.id])

  const onDrop = useCallback(async (acceptedFiles) => {
    const file = acceptedFiles[0]; if (!file) return
    setUploading(true); setUploadProgress(0)
    try {
      const fd = new FormData(); fd.append('file', file)
      const r = await axios.post(`${SVC}/upload`, fd, {
        onUploadProgress: e => setUploadProgress(Math.round((e.loaded/e.total)*100)),
      })
      const meta = r.data
      setFiles(prev => [meta, ...prev.filter(f=>f.id!==meta.id)])
      setSelected(meta)
    } catch(e) { alert('Upload failed: '+(e.response?.data?.detail||e.message)) }
    setUploading(false); setUploadProgress(0)
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop, multiple: false, disabled: !serviceUp,
    accept: {
      'text/csv': ['.csv'], 'application/vnd.ms-excel': ['.xls'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'text/plain': ['.txt','.md'],
    },
  })

  const deleteFile = async (id, e) => {
    e.stopPropagation()
    await axios.delete(`${SVC}/files/${id}`).catch(()=>{})
    setFiles(prev => prev.filter(f=>f.id!==id))
    if (selected?.id===id) { setSelected(null); setChat([]) }
    setCompareIds(prev => prev.filter(i=>i!==id))
  }

  const ask = async (q) => {
    if (!q.trim() || !selected) return
    setChat(prev => [...prev, { role:'user', text:q }, { role:'ai', text:'', loading:true }])
    setQuestion(''); setChatLoading(true)

    let answer = null

    // Try backend first (has full ML context including embeddings)
    try {
      const r = await axios.post(`${SVC}/ask`, { file_id: selected.id, query: q, use_pro_model: false }, { timeout: 20000 })
      answer = r.data.response || r.data.answer
    } catch { /* fall through to Pollinations AI */ }

    // Fallback: Pollinations AI with compact stats context
    if (!answer || answer.includes('unavailable') || answer.includes('reach')) {
      try {
        const statsCtx = buildFileContext(null, null, selected.name, selected.stats?.col_stats || null)
          || `File: ${selected.name}. Columns: ${Object.keys(selected.stats?.col_stats || {}).join(', ')}`
        const currentChat = chatHistory[selected.id] || []
        const history = currentChat.slice(0,-2).filter(m=>!m.loading).slice(-6).map(m=>({ role: m.role==='ai'?'assistant':'user', content: m.text }))
        const sysPrompt = `You are an expert water quality data analyst for Northern Ontario. Dataset info:\n${statsCtx}\n\nBe specific, cite numbers, give actionable insights. Keep responses concise.`
        answer = await askAI([...history, { role:'user', content:q }], sysPrompt, 900)
      } catch { answer = null }
    }

    setChat(prev => prev.map((m,i)=> i===prev.length-1 ? { role:'ai', text: answer || 'No response received.', loading:false } : m))
    setChatLoading(false)
  }

  const downloadReport = async () => {
    if (!selected) return
    const insights = generateInsights(selected)
    const risk = selected.stats ? computeRiskScore(selected.stats) : null
    try {
      const r = await axios.post(`${SVC}/report/${selected.id}`, {
        insights: insights.map(i=>i.title+': '+i.text),
        risk_score: risk?.score, risk_level: risk?.level,
      })
      const blob = new Blob([r.data.report], { type:'text/plain' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a'); a.href=url; a.download=`analysis-${selected.name}.txt`; a.click()
      URL.revokeObjectURL(url)
    } catch { alert('Report generation failed — service may not support this endpoint yet.') }
  }

  const downloadDataset = (format) => {
    if (!selected) return
    const url = `${SVC}/export/${selected.id}?format=${format}`
    const a = document.createElement('a'); a.href = url; a.download = ''; a.click()
  }

  const downloadOriginal = () => {
    if (!selected) return
    const a = document.createElement('a'); a.href = `${SVC}/download/${selected.id}`; a.download = ''; a.click()
  }

  // ── Offline / Loading screens ──────────────────────────────────────────────
  if (serviceUp === false) return (
    <div style={{ maxWidth:520, margin:'80px auto', textAlign:'center' }}>
      <div style={{ width:60, height:60, borderRadius:16, background:'rgba(249,115,22,0.1)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 16px' }}>
        <Zap style={{ width:28, height:28, color:'#f97316' }}/>
      </div>
      <h2 style={{ fontSize:20, fontWeight:900, color:'var(--text)', marginBottom:8 }}>Analysis Service Offline</h2>
      <p style={{ fontSize:13, color:'var(--text-muted)', marginBottom:16 }}>Start the Python service to enable file analysis and ML features.</p>
      <pre style={{ textAlign:'left', fontSize:12, padding:16, borderRadius:12, background:'var(--card-bg)', border:'1px solid var(--border)', color:'var(--text)', marginBottom:16, overflowX:'auto' }}>
{`cd analysis-service
uvicorn main:app --host 0.0.0.0 --port 8001 --reload`}
      </pre>
      <button onClick={() => { setServiceUp(null); axios.get(`${SVC}/health`,{timeout:3000}).then(()=>setServiceUp(true)).catch(()=>setServiceUp(false)) }}
        style={{ display:'inline-flex', alignItems:'center', gap:8, padding:'10px 24px', borderRadius:10, background:'#6366f1', color:'#fff', border:'none', cursor:'pointer', fontSize:14, fontWeight:700 }}>
        <RefreshCw style={{ width:14, height:14 }}/> Retry Connection
      </button>
    </div>
  )

  if (serviceUp === null) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:200, gap:10, color:'var(--text-muted)' }}>
      <RefreshCw style={{ width:18, height:18, animation:'spin 1s linear infinite' }}/> Connecting to analysis service…
    </div>
  )

  // ── Derived state ──────────────────────────────────────────────────────────
  const insights = selected ? generateInsights(selected) : []
  const risk = selected?.stats ? computeRiskScore(selected.stats) : null

  const TABS = [
    { key:'overview',  label:'Overview',      icon: BarChart2 },
    { key:'explore',   label:'Explore',       icon: Eye },
    { key:'ml',        label:'ML Lab',        icon: Cpu },
    { key:'quality',   label:'Data Quality',  icon: Shield },
    { key:'compare',   label:'Compare',       icon: GitCompare },
  ]

  // ── MAIN LAYOUT ────────────────────────────────────────────────────────────
  return (
    <div style={{ position:'relative', width:'100%', height:'calc(100vh - 120px)', display:'flex', gap:12, minHeight:0, backgroundColor:'transparent' }}>
      <PageAmbience variant="analysis"/>

      {/* ── LEFT: File Manager ── */}
      <div style={{ width:230, flexShrink:0, display:'flex', flexDirection:'column', gap:10, minHeight:0, position:'relative', zIndex:1 }}>

        {/* Upload zone */}
        <div {...getRootProps()} style={{
          borderRadius:12, border:`2px dashed ${isDragActive?'#6366f1':'var(--border)'}`,
          background: isDragActive?'rgba(99,102,241,0.06)':'transparent',
          padding:14, textAlign:'center', cursor: serviceUp?'pointer':'not-allowed',
          transition:'all 0.15s', flexShrink:0,
        }}
        onMouseEnter={e => { if (!isDragActive) e.currentTarget.style.borderColor='rgba(99,102,241,0.5)' }}
        onMouseLeave={e => { if (!isDragActive) e.currentTarget.style.borderColor='var(--border)' }}>
          <input {...getInputProps()}/>
          {uploading ? (
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              <Upload style={{ width:20, height:20, color:'#6366f1', margin:'0 auto', animation:'bounce 1s ease-in-out infinite' }}/>
              <div style={{ height:4, background:'var(--border)', borderRadius:99, overflow:'hidden' }}>
                <div style={{ height:'100%', background:'linear-gradient(90deg,#6366f1,#14b8a6)', borderRadius:99, transition:'width 0.3s', width:`${uploadProgress}%` }}/>
              </div>
              <span style={{ fontSize:11, color:'var(--text-muted)' }}>{uploadProgress}%</span>
            </div>
          ) : (
            <>
              <Upload style={{ width:18, height:18, color: isDragActive?'#6366f1':'var(--text-light)', margin:'0 auto 6px' }}/>
              <div style={{ fontSize:12, fontWeight:700, color:'var(--text)' }}>{isDragActive?'Drop file':'Upload File'}</div>
              <div style={{ fontSize:10, color:'var(--text-muted)', marginTop:2 }}>CSV · Excel · PDF · DOCX · TXT</div>
            </>
          )}
        </div>

        {/* File list */}
        <div style={{ background:'var(--card-bg)', border:'1px solid var(--border)', borderRadius:12, flex:1, display:'flex', flexDirection:'column', minHeight:0, overflow:'hidden' }}>
          <div style={{ padding:'8px 12px', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', gap:6, flexShrink:0 }}>
            <Database style={{ width:12, height:12, color:'#6366f1' }}/>
            <span style={{ fontSize:10, fontWeight:800, letterSpacing:'0.08em', textTransform:'uppercase', color:'var(--text-muted)' }}>Files ({files.length})</span>
          </div>
          <div style={{ flex:1, overflowY:'auto', scrollbarWidth:'none' }}>
            {files.length === 0 ? (
              <div style={{ padding:16, textAlign:'center', fontSize:11, color:'var(--text-muted)' }}>No files yet.<br/>Upload to begin.</div>
            ) : files.map(f => {
              const fRisk = f.stats ? computeRiskScore(f.stats) : null
              return (
                <div key={f.id} onClick={() => { setSelected(f) }}
                  style={{ padding:'9px 12px', cursor:'pointer', display:'flex', alignItems:'flex-start', gap:8, transition:'background 0.12s, opacity 0.12s', borderTop:'1px solid var(--border)', background: selected?.id===f.id?'rgba(99,102,241,0.06)':'transparent', group: 'file-item' }}
                  onMouseEnter={e => selected?.id!==f.id && (e.currentTarget.style.background='rgba(99,102,241,0.03)')}
                  onMouseLeave={e => selected?.id!==f.id && (e.currentTarget.style.background='transparent')}>
                  <FileIcon ext={f.ext||f.file_type} size={14}/>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:11, fontWeight:600, color:'var(--text)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{f.name||f.filename||'Unknown'}</div>
                    <div style={{ display:'flex', alignItems:'center', gap:5, marginTop:2 }}>
                      <StatusDot status={f.status}/>
                      <span style={{ fontSize:10, color:'var(--text-muted)' }}>{fmtBytes(f.size)}</span>
                      {fRisk && <span style={{ padding:'1px 6px', borderRadius:20, fontSize:9, fontWeight:700, background:`${fRisk.level==='critical'?'rgba(239,68,68,0.12)':fRisk.level==='elevated'?'rgba(249,115,22,0.12)':'rgba(16,185,129,0.1)'}`, color:fRisk.level==='critical'?'#ef4444':fRisk.level==='elevated'?'#f97316':'#10b981' }}>{fRisk.score}</span>}
                    </div>
                  </div>
                  <button onClick={e=>deleteFile(f.id,e)}
                    title="Delete file"
                    style={{ padding:'4px 6px', background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.2)', cursor:'pointer', color:'#ef4444', borderRadius:4, flexShrink:0, transition:'all 0.12s', fontSize:10, fontWeight:600, display:'flex', alignItems:'center', gap:2 }}>
                    <Trash2 style={{ width:12, height:12 }}/>
                  </button>
                </div>
              )
            })}
          </div>
        </div>

        {/* Column selector */}
        {selected?.stats?.num_cols?.length > 0 && (
          <div style={{ background:'var(--card-bg)', border:'1px solid var(--border)', borderRadius:12, padding:10, flexShrink:0 }}>
            <div style={{ fontSize:10, fontWeight:800, letterSpacing:'0.08em', textTransform:'uppercase', color:'var(--text-muted)', marginBottom:6 }}>Parameter</div>
            <div style={{ display:'flex', flexWrap:'wrap', gap:4 }}>
              {selected.stats.num_cols.map(c => {
                const who = whoStatus(c, parseFloat(selected.stats.col_stats?.[c]?.mean||0))
                return (
                  <button key={c} onClick={() => setSelectedCol(c)}
                    style={{ padding:'3px 9px', borderRadius:20, border:'none', cursor:'pointer', fontSize:10, fontWeight:600, transition:'all 0.12s',
                      background: selectedCol===c?`${who?.color||'#6366f1'}20`:'rgba(0,0,0,0.03)',
                      color: selectedCol===c?(who?.color||'#818cf8'):'var(--text-muted)',
                      boxShadow: selectedCol===c?`0 0 0 1px ${who?.color||'#6366f1'}40`:'none',
                    }}>
                    {c}
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* ── CENTER: Analysis Workspace ── */}
      <div style={{ flex:1, minWidth:0, display:'flex', flexDirection:'column', gap:0, position:'relative', zIndex:1 }}>
        {!selected ? (
          /* Empty state */
          <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:'100%', gap:20, textAlign:'center' }}>
            <div style={{ width:72, height:72, borderRadius:20, background:'linear-gradient(135deg,rgba(99,102,241,0.2),rgba(20,184,166,0.2))', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 8px 32px rgba(99,102,241,0.2)' }}>
              <FlaskConical style={{ width:32, height:32, color:'#818cf8' }}/>
            </div>
            <div>
              <h2 style={{ fontSize:20, fontWeight:900, color:'var(--text)', margin:0 }}>Research Intelligence Workspace</h2>
              <p style={{ fontSize:13, color:'var(--text-muted)', marginTop:6, maxWidth:440, lineHeight:1.6 }}>
                Upload any dataset or document. Get automatic ML analysis, statistical profiling, risk assessment, anomaly detection, and AI-powered research insights.
              </p>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10, maxWidth:440 }}>
              {[
                { icon:'📊', label:'Statistical Analysis', sub:'WHO thresholds, correlations, outliers' },
                { icon:'🤖', label:'ML Anomaly Detection', sub:'IsolationForest + σ-rule analysis' },
                { icon:'📄', label:'AI Research Chat', sub:'RAG + ML hybrid intelligence' },
                { icon:'⚡', label:'Auto Insights Engine', sub:'Risk flags, findings, actions' },
                { icon:'🔬', label:'Data Quality Report', sub:'Completeness, reliability scoring' },
                { icon:'⚖️', label:'Multi-File Compare', sub:'Side-by-side dataset analysis' },
              ].map(c => (
                <div key={c.label} style={{ padding:'12px 10px', borderRadius:12, background:'var(--card-bg)', border:'1px solid var(--border)', textAlign:'center' }}>
                  <div style={{ fontSize:22, marginBottom:4 }}>{c.icon}</div>
                  <div style={{ fontSize:11, fontWeight:700, color:'var(--text)' }}>{c.label}</div>
                  <div style={{ fontSize:10, color:'var(--text-muted)', marginTop:2 }}>{c.sub}</div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <>
            {/* File header */}
            <div style={{ background:'var(--card-bg)', border:'1px solid var(--border)', borderRadius:12, padding:'12px 16px', marginBottom:10, display:'flex', alignItems:'center', gap:12, flexShrink:0 }}>
              <FileIcon ext={selected.ext} size={16}/>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontWeight:800, fontSize:14, color:'var(--text)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{selected.name}</div>
                <div style={{ display:'flex', gap:10, marginTop:2, fontSize:11, color:'var(--text-muted)', flexWrap:'wrap' }}>
                  <span style={{ display:'flex', alignItems:'center', gap:4 }}><StatusDot status={selected.status}/>{selected.status}</span>
                  <span>{fmtBytes(selected.size)}</span>
                  {selected.stats?.row_count && <span>{selected.stats.row_count.toLocaleString()} rows</span>}
                  {selected.stats?.col_count && <span>{selected.stats.col_count} cols</span>}
                  {selected.chunks > 0 && <span>{selected.chunks} text chunks</span>}
                </div>
              </div>
              {risk && <RiskBadge score={risk.score} level={risk.level}/>}
              <div style={{ display:'flex', gap:6, flexShrink:0 }}>
                <button onClick={downloadReport}
                  style={{ display:'flex', alignItems:'center', gap:6, padding:'7px 14px', borderRadius:9, background:'rgba(99,102,241,0.08)', color:'#818cf8', border:'1px solid rgba(99,102,241,0.15)', cursor:'pointer', fontSize:12, fontWeight:600 }}>
                  <Download style={{ width:13, height:13 }}/> Report
                </button>
                <button onClick={() => downloadDataset('csv')} title="Export as CSV"
                  style={{ display:'flex', alignItems:'center', gap:6, padding:'7px 14px', borderRadius:9, background:'rgba(16,185,129,0.08)', color:'#10b981', border:'1px solid rgba(16,185,129,0.15)', cursor:'pointer', fontSize:12, fontWeight:600 }}>
                  <Download style={{ width:13, height:13 }}/> CSV
                </button>
                <button onClick={() => downloadDataset('json')} title="Export analysis as JSON"
                  style={{ display:'flex', alignItems:'center', gap:6, padding:'7px 14px', borderRadius:9, background:'rgba(245,158,11,0.08)', color:'#f59e0b', border:'1px solid rgba(245,158,11,0.15)', cursor:'pointer', fontSize:12, fontWeight:600 }}>
                  <Download style={{ width:13, height:13 }}/> JSON
                </button>
                <button onClick={downloadOriginal} title="Download original file"
                  style={{ display:'flex', alignItems:'center', gap:6, padding:'7px 14px', borderRadius:9, background:'rgba(148,163,184,0.08)', color:'#94a3b8', border:'1px solid rgba(148,163,184,0.15)', cursor:'pointer', fontSize:12, fontWeight:600 }}>
                  <Download style={{ width:13, height:13 }}/> Original
                </button>
              </div>
            </div>

            {/* Tabs */}
            <div style={{ display:'flex', gap:2, marginBottom:12, flexShrink:0, borderBottom:'1px solid var(--border)' }}>
              {TABS.map(t => (
                <button key={t.key} onClick={() => setTab(t.key)}
                  style={{ display:'flex', alignItems:'center', gap:5, padding:'7px 14px', borderRadius:'7px 7px 0 0', border:'none', cursor:'pointer', fontSize:12, fontWeight: tab===t.key?700:500, transition:'all 0.15s',
                    background: tab===t.key?'rgba(99,102,241,0.1)':'transparent',
                    color: tab===t.key?'#818cf8':'var(--text-muted)',
                    borderBottom: tab===t.key?'2px solid #6366f1':'2px solid transparent',
                  }}>
                  <t.icon style={{ width:12, height:12 }}/>{t.label}
                </button>
              ))}
            </div>

            {/* Tab content */}
            <div style={{ flex:1, overflowY:'auto', scrollbarWidth:'none' }}>

              {/* ── OVERVIEW ── */}
              {tab==='overview' && (
                <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                  {/* Auto-insights */}
                  <div style={{ background:'var(--card-bg)', border:'1px solid var(--border)', borderRadius:12, padding:14 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:10 }}>
                      <Zap style={{ width:14, height:14, color:'#f59e0b' }}/>
                      <span style={{ fontSize:13, fontWeight:700, color:'var(--text)' }}>Auto-Generated Insights</span>
                      <span style={{ marginLeft:'auto', fontSize:11, color:'var(--text-muted)' }}>{insights.length} findings</span>
                    </div>
                    <div style={{ display:'flex', flexDirection:'column', gap:7 }}>
                      {insights.map((ins, i) => <InsightCard key={i} insight={ins} index={i}/>)}
                    </div>
                  </div>

                  {/* Quick stats grid */}
                  {selected.stats?.col_stats && (
                    <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(130px,1fr))', gap:8 }}>
                      {Object.entries(selected.stats.col_stats).slice(0,8).map(([col, s]) => {
                        const who = whoStatus(col, parseFloat(s.mean))
                        return (
                          <div key={col} onClick={() => { setSelectedCol(col); setTab('explore') }}
                            style={{ padding:'10px 12px', borderRadius:10, background: who?.level===3?who.bg:'var(--card-bg)', border:`1px solid ${who?.level===3?who.border:'var(--border)'}`, cursor:'pointer', transition:'all 0.15s' }}
                            onMouseEnter={e => { e.currentTarget.style.transform='translateY(-1px)'; e.currentTarget.style.boxShadow='0 4px 12px rgba(0,0,0,0.08)' }}
                            onMouseLeave={e => { e.currentTarget.style.transform='none'; e.currentTarget.style.boxShadow='none' }}>
                            <div style={{ fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.06em', color:'var(--text-muted)', marginBottom:4 }}>{col}</div>
                            <div style={{ fontSize:18, fontWeight:900, color: who?.color||'var(--text)' }}>{s.mean}</div>
                            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginTop:4 }}>
                              {who && <span style={{ fontSize:9, fontWeight:700, color:who.color }}>{who.label}</span>}
                              {(s.outliers||0)>0 && <span style={{ fontSize:9, color:'#f97316', fontWeight:700 }}>⚠ {s.outliers}</span>}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {/* Top findings cards */}
                  {risk?.violations?.length > 0 && (
                    <div style={{ background:'rgba(239,68,68,0.05)', border:'1px solid rgba(239,68,68,0.15)', borderRadius:12, padding:14 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:7, marginBottom:8 }}>
                        <AlertTriangle style={{ width:14, height:14, color:'#ef4444' }}/>
                        <span style={{ fontSize:12, fontWeight:700, color:'var(--text)' }}>Threshold Violations</span>
                      </div>
                      {risk.violations.map((v, i) => (
                        <div key={i} style={{ display:'flex', gap:8, alignItems:'center', padding:'6px 0', borderTop: i>0?'1px solid rgba(239,68,68,0.1)':'none' }}>
                          <span style={{ fontSize:12, fontWeight:700, color:'#ef4444', minWidth:100 }}>{v.col}</span>
                          <span style={{ fontSize:12, color:'var(--text-muted)' }}>Measured: {v.mean} · Limit: {v.threshold}</span>
                          <span style={{ marginLeft:'auto', padding:'2px 8px', borderRadius:20, fontSize:10, fontWeight:700, background:v.severity==='critical'?'rgba(239,68,68,0.12)':'rgba(249,115,22,0.12)', color:v.severity==='critical'?'#ef4444':'#f97316' }}>
                            {v.severity}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ── EXPLORE ── */}
              {tab==='explore' && (
                <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                  <TrendPanel selected={selected} selectedCol={selectedCol}/>
                  {selected.stats?.col_stats && <StatsTable stats={selected.stats.col_stats} selectedCol={selectedCol} onSelectCol={setSelectedCol}/>}
                  {selected.stats?.correlation && (
                    <div style={{ background:'var(--card-bg)', border:'1px solid var(--border)', borderRadius:12, padding:14 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:7, marginBottom:10 }}>
                        <Activity style={{ width:14, height:14, color:'#14b8a6' }}/>
                        <span style={{ fontSize:12, fontWeight:700, color:'var(--text)' }}>Pearson Correlation Matrix</span>
                      </div>
                      <div style={{ overflowX:'auto' }}>
                        <table style={{ borderCollapse:'collapse', fontSize:11 }}>
                          <thead><tr><th style={{ padding:'5px 8px' }}/>{Object.keys(selected.stats.correlation).map(c=><th key={c} style={{ padding:'5px 8px', fontWeight:600, color:'var(--text-muted)', textAlign:'left', whiteSpace:'nowrap' }}>{c}</th>)}</tr></thead>
                          <tbody>
                            {Object.entries(selected.stats.correlation).map(([row,vals])=>(
                              <tr key={row}>
                                <td style={{ padding:'5px 8px', fontWeight:700, color:'var(--text)', whiteSpace:'nowrap' }}>{row}</td>
                                {Object.entries(vals).map(([col,v])=>{
                                  const abs=Math.abs(v)
                                  const bg = v===1?'rgba(99,102,241,0.15)':abs>0.7?`rgba(${v>0?'20,184,166':'239,68,68'},${abs*0.25})`:undefined
                                  return <td key={col} style={{ padding:'5px 8px', textAlign:'center', borderRadius:4, background:bg, color:'var(--text)', fontWeight: abs>0.7?700:400 }}>{v?.toFixed(2)}</td>
                                })}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                  {selected.stats?.sample_rows?.length > 0 && (
                    <div style={{ background:'var(--card-bg)', border:'1px solid var(--border)', borderRadius:12, overflow:'hidden' }}>
                      <div style={{ padding:'10px 14px', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', gap:7 }}>
                        <Database style={{ width:13, height:13, color:'#6366f1' }}/>
                        <span style={{ fontSize:12, fontWeight:700, color:'var(--text)' }}>Data Preview (first 10 rows)</span>
                      </div>
                      <div style={{ overflowX:'auto' }}>
                        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:11 }}>
                          <thead><tr style={{ background:'rgba(0,0,0,0.02)' }}>{Object.keys(selected.stats.sample_rows[0]).map(k=><th key={k} style={{ padding:'7px 12px', textAlign:'left', fontWeight:700, fontSize:10, textTransform:'uppercase', letterSpacing:'0.05em', color:'var(--text-muted)', whiteSpace:'nowrap' }}>{k}</th>)}</tr></thead>
                          <tbody>{selected.stats.sample_rows.map((row,i)=><tr key={i} style={{ borderTop:'1px solid var(--border)' }}>{Object.values(row).map((v,j)=><td key={j} style={{ padding:'7px 12px', color:'var(--text)', whiteSpace:'nowrap' }}>{String(v)}</td>)}</tr>)}</tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ── ML LAB ── */}
              {tab==='ml' && <AnomalyPanel selected={selected}/>}

              {/* ── QUALITY ── */}
              {tab==='quality' && <DataQualityPanel selected={selected}/>}

              {/* ── COMPARE ── */}
              {tab==='compare' && <ComparePanel files={files} selectedIds={compareIds} onToggle={id => setCompareIds(prev => prev.includes(id)?prev.filter(i=>i!==id):[...prev,id])}/>}
            </div>
          </>
        )}
      </div>

      {/* ── RIGHT: AI Research Chat ── */}
      <div style={{ width:260, flexShrink:0, display:'flex', flexDirection:'column', minHeight:0, position:'relative', zIndex:1 }}>
        <div style={{ background:'var(--card-bg)', border:'1px solid var(--border)', borderRadius:12, display:'flex', flexDirection:'column', flex:1, minHeight:0, overflow:'hidden' }}>
          {/* Chat header */}
          <div style={{ padding:'10px 14px', borderBottom:'1px solid var(--border)', background:'linear-gradient(135deg,rgba(99,102,241,0.06),rgba(20,184,166,0.04))', flexShrink:0 }}>
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <div style={{ width:28, height:28, borderRadius:'50%', background:'linear-gradient(135deg,#6366f1,#14b8a6)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                <Brain style={{ width:13, height:13, color:'#fff' }}/>
              </div>
              <div>
                <div style={{ fontSize:12, fontWeight:800, color:'var(--text)' }}>AI Research Assistant</div>
                <div style={{ fontSize:10, color:'var(--text-muted)', display:'flex', alignItems:'center', gap:4 }}>
                  <span style={{ width:5, height:5, borderRadius:'50%', background:'#10b981', display:'inline-block' }}/>
                  RAG + ML Hybrid · FAISS
                </div>
              </div>
            </div>
            {selected && risk && (
              <div style={{ marginTop:8, padding:'6px 10px', borderRadius:8, background:`rgba(${risk.level==='critical'?'239,68,68':risk.level==='elevated'?'249,115,22':'16,185,129'},0.08)`, fontSize:10, fontWeight:700, color:risk.level==='critical'?'#ef4444':risk.level==='elevated'?'#f97316':'#10b981', display:'flex', gap:5, alignItems:'center' }}>
                <Shield style={{ width:10, height:10 }}/> Risk: {risk.level.toUpperCase()} (score: {risk.score}/100)
              </div>
            )}
          </div>

          {/* Messages */}
          <div style={{ flex:1, overflowY:'auto', padding:10, display:'flex', flexDirection:'column', gap:8, scrollbarWidth:'none', minHeight:0 }}>
            {!selected ? (
              <div style={{ textAlign:'center', paddingTop:32, fontSize:11, color:'var(--text-muted)' }}>
                <MessageSquare style={{ width:28, height:28, margin:'0 auto 8px', opacity:0.3 }}/>
                Upload a file to start the AI research session
              </div>
            ) : chat.length === 0 ? (
              <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
                <div style={{ fontSize:11, color:'var(--text-muted)', marginBottom:4 }}>Ask about <strong style={{ color:'var(--text)' }}>{selected.name}</strong></div>
                {[
                  'Summarize key findings',
                  'Are there any concerning levels?',
                  'What anomalies were detected?',
                  'Compare to WHO standards',
                  'What actions do you recommend?',
                  'Describe the data quality',
                ].map(q => (
                  <button key={q} onClick={() => ask(q)}
                    style={{ textAlign:'left', fontSize:11, padding:'7px 10px', borderRadius:9, background:'rgba(99,102,241,0.05)', border:'1px solid rgba(99,102,241,0.1)', color:'var(--text)', cursor:'pointer', transition:'all 0.12s' }}
                    onMouseEnter={e => { e.currentTarget.style.background='rgba(99,102,241,0.1)'; e.currentTarget.style.borderColor='rgba(99,102,241,0.25)' }}
                    onMouseLeave={e => { e.currentTarget.style.background='rgba(99,102,241,0.05)'; e.currentTarget.style.borderColor='rgba(99,102,241,0.1)' }}>
                    {q}
                  </button>
                ))}
              </div>
            ) : (
              chat.map((m,i) => <ChatMessage key={i} msg={m}/>)
            )}
            <div ref={chatEndRef}/>
          </div>

          {/* Input */}
          <div style={{ padding:'8px 10px', borderTop:'1px solid var(--border)', flexShrink:0 }}>
            <div style={{ display:'flex', gap:6, alignItems:'flex-end' }}>
              <textarea value={question} onChange={e => setQuestion(e.target.value)} rows={2}
                onKeyDown={e => { if (e.key==='Enter' && !e.shiftKey) { e.preventDefault(); ask(question) } }}
                placeholder={selected?'Ask a research question…':'Select a file first'}
                disabled={!selected||chatLoading}
                style={{ flex:1, resize:'none', fontSize:11, padding:'7px 10px', borderRadius:9, border:'1.5px solid var(--border)', background:'var(--card-bg)', color:'var(--text)', outline:'none', fontFamily:'inherit' }}/>
              <button onClick={() => ask(question)} disabled={!selected||!question.trim()||chatLoading}
                style={{ width:30, height:30, borderRadius:9, background:'#6366f1', border:'none', cursor: (!selected||!question.trim()||chatLoading)?'not-allowed':'pointer', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, opacity: (!selected||!question.trim()||chatLoading)?0.4:1 }}>
                {chatLoading ? <RefreshCw style={{ width:12, height:12, color:'#fff', animation:'spin 1s linear infinite' }}/> : <Send style={{ width:12, height:12, color:'#fff' }}/>}
              </button>
            </div>
            <div style={{ fontSize:9, color:'var(--text-muted)', marginTop:4 }}>Enter to send · Shift+Enter for newline</div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes ping { 75%,100% { transform:scale(2.2); opacity:0; } }
        @keyframes bounce { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-4px)} }
        @keyframes slideInUp { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:none} }
        @keyframes fadeInStep { from{opacity:0;transform:scale(0.9)} to{opacity:1;transform:none} }
      `}</style>
    </div>
  )
}
