import { useState, useCallback, useRef, useEffect } from 'react'
import { useDropzone } from 'react-dropzone'
import {
  BarChart, Bar, LineChart, Line,
  XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer,
} from 'recharts'
import {
  Upload, Trash2, Send, Loader, AlertTriangle,
  Database, AlertCircle,
  BarChart2, Activity, X, Bot, User,
  Sparkles,
} from 'lucide-react'
import axios from 'axios'
import Papa from 'papaparse'
import * as XLSX from 'xlsx'
import { askAI } from '../utils/openrouter'

const BACKEND = 'http://localhost:8001'

// ── WHO thresholds ─────────────────────────────────────────────────────────────
const WHO = {
  ph:               { min: 6.5,  max: 8.5,  unit: '',       label: 'pH' },
  turbidity:        { min: 0,    max: 5,    unit: ' NTU',   label: 'Turbidity' },
  dissolved_oxygen: { min: 6,    max: 999,  unit: ' mg/L',  label: 'DO' },
  temperature:      { min: 0,    max: 25,   unit: ' °C',    label: 'Temp' },
  nitrates:         { min: 0,    max: 10,   unit: ' mg/L',  label: 'Nitrates' },
  conductivity:     { min: 0,    max: 1500, unit: ' µS/cm', label: 'Conductivity' },
  phosphorus:       { min: 0,    max: 0.03, unit: ' mg/L',  label: 'Phosphorus' },
  ecoli:            { min: 0,    max: 0,    unit: ' CFU',   label: 'E. coli' },
  tss:              { min: 0,    max: 30,   unit: ' mg/L',  label: 'TSS' },
}

function whoMatch(col) {
  const key = col.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z_]/g, '')
  return Object.entries(WHO).find(([k]) => key.includes(k))
}
function whoStatus(col, mean) {
  const match = whoMatch(col)
  if (!match) return null
  const [, t] = match
  if (mean < t.min) return { label: 'Below', color: '#0ea5e9', bg: '#0ea5e91a' }
  if (mean > t.max) return { label: 'EXCEEDS', color: '#ef4444', bg: '#ef44441a' }
  return { label: 'Safe ✓', color: '#10b981', bg: '#10b9811a' }
}

// ── File text extraction (client-side, no backend needed) ──────────────────────
async function extractText(file) {
  const ext = file.name.split('.').pop().toLowerCase()

  if (ext === 'txt' || ext === 'json') {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = e => resolve(e.target.result)
      reader.onerror = reject
      reader.readAsText(file)
    })
  }

  if (ext === 'csv') {
    return new Promise((resolve, reject) => {
      Papa.parse(file, {
        complete: result => {
          const rows = result.data.slice(0, 500) // cap at 500 rows for context
          resolve(rows.map(r => r.join(', ')).join('\n'))
        },
        error: reject,
      })
    })
  }

  if (ext === 'xlsx' || ext === 'xls') {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = e => {
        try {
          const wb = XLSX.read(e.target.result, { type: 'array' })
          const lines = []
          wb.SheetNames.forEach(name => {
            lines.push(`=== Sheet: ${name} ===`)
            const ws = wb.Sheets[name]
            const csv = XLSX.utils.sheet_to_csv(ws)
            lines.push(csv.split('\n').slice(0, 300).join('\n'))
          })
          resolve(lines.join('\n'))
        } catch (err) { reject(err) }
      }
      reader.onerror = reject
      reader.readAsArrayBuffer(file)
    })
  }

  if (ext === 'pdf') {
    const { getDocument, GlobalWorkerOptions } = await import('pdfjs-dist')
    GlobalWorkerOptions.workerSrc = new URL(
      'pdfjs-dist/build/pdf.worker.mjs',
      import.meta.url
    ).toString()
    const arrayBuffer = await file.arrayBuffer()
    const pdf = await getDocument({ data: arrayBuffer }).promise
    const numPages = Math.min(pdf.numPages, 200) // cap at 200 pages
    const texts = []
    for (let i = 1; i <= numPages; i++) {
      const page = await pdf.getPage(i)
      const content = await page.getTextContent()
      texts.push(content.items.map(s => s.str).join(' '))
    }
    const full = texts.join('\n')
    if (pdf.numPages > 200) return full + `\n\n[Note: Document has ${pdf.numPages} pages. Showing first 200.]`
    return full
  }

  if (ext === 'docx') {
    return `[DOCX file: ${file.name}. For best results, convert to PDF or TXT before uploading.]`
  }

  return `[File: ${file.name} — content preview not available for this format]`
}

// ── Quick prompt suggestions ───────────────────────────────────────────────────
const QUICK_PROMPTS = [
  { label: 'Summarize', prompt: 'Give me a concise summary of this document. What are the key points?' },
  { label: 'Full Report', prompt: 'Generate a detailed, structured report based on this content. Include key findings, data highlights, risks, and recommendations.' },
  { label: 'Key Findings', prompt: 'What are the most important findings or insights in this document?' },
  { label: 'Water Quality', prompt: 'Analyze any water quality parameters in this data. Are there any violations or concerns based on WHO/EPA standards?' },
  { label: 'Risks', prompt: 'What risks or issues are identified in this document? List them in order of severity.' },
  { label: 'Visualize', prompt: 'Describe the data in this document. What charts or visualizations would best represent it? List the key data points I should plot.' },
]

// ── AI Chat component ──────────────────────────────────────────────────────────
function AIChatDialog({ preloadedFile, preloadedText }) {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [chatFile, setChatFile] = useState(preloadedFile || null)
  const [chatText, setChatText] = useState(preloadedText || '')
  const bottomRef = useRef(null)

  useEffect(() => {
    // New file selected from left panel — reset chat
    if (preloadedFile?.name !== chatFile?.name || preloadedText !== chatText) {
      setChatFile(preloadedFile || null)
      setChatText(preloadedText || '')
      setMessages(preloadedFile ? [{
        role: 'assistant',
        content: `I've read **${preloadedFile.name}** (${(preloadedFile.size / 1024).toFixed(0)} KB).\n\nAsk me anything — I can summarize it, find key data, generate a full report, or answer any specific question.`,
      }] : [])
    }
  }, [preloadedFile, preloadedText])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  const sendMessage = async (text) => {
    const userMsg = text || input.trim()
    if (!userMsg) return
    setInput('')

    const newMessages = [...messages, { role: 'user', content: userMsg }]
    setMessages(newMessages)
    setLoading(true)

    // Build context — inject file text as system prompt context
    const systemPrompt = chatText
      ? `You are an expert AI research assistant. The user has uploaded a document/dataset. Here is its content:\n\n---\n${chatText.slice(0, 80000)}\n---\n\nAnswer questions based on this content. Be thorough, specific, and cite data/numbers from the document when relevant. If asked for a report or visualization, produce structured, detailed output using markdown formatting.`
      : `You are an expert AI research assistant. Help the user analyze their data and answer questions. Use markdown formatting for structured responses.`

    const aiHistory = newMessages.map(m => ({ role: m.role, content: m.content }))
    const response = await askAI(aiHistory, systemPrompt, 4096)

    setMessages(prev => [...prev, { role: 'assistant', content: response }])
    setLoading(false)
  }

  const clearChat = () => {
    setChatFile(null)
    setChatText('')
    setMessages([])
    setInput('')
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      minHeight: 500,
      background: '#0f172a',
      borderRadius: 16,
      border: '1px solid rgba(99,102,241,0.3)',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '14px 16px',
        background: 'linear-gradient(135deg, rgba(99,102,241,0.2), rgba(14,165,233,0.15))',
        borderBottom: '1px solid rgba(255,255,255,0.07)',
        flexShrink: 0,
      }}>
        <Bot size={20} color="#818cf8" />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#e2e8f0' }}>AI Document Chat</div>
          <div style={{ fontSize: 11, color: '#64748b' }}>
            {chatFile ? `📎 ${chatFile.name}` : 'Upload a file on the left, then select it'}
          </div>
        </div>
        {chatFile && (
          <button onClick={clearChat} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: 4 }}>
            <X size={16} />
          </button>
        )}
        <div style={{ fontSize: 10, padding: '3px 8px', background: 'rgba(99,102,241,0.2)', borderRadius: 20, color: '#818cf8', fontWeight: 600 }}>
          FREE AI
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {messages.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px 20px' }}>
            <Sparkles size={40} color="#334155" style={{ margin: '0 auto 12px' }} />
            <p style={{ color: '#475569', fontSize: 14, fontWeight: 600 }}>Chat with any document</p>
            <p style={{ color: '#334155', fontSize: 12, marginTop: 6 }}>
              Upload a file on the left, then select it.<br />Ask anything — summaries, reports, data analysis, charts.
            </p>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} style={{
            display: 'flex',
            gap: 10,
            flexDirection: msg.role === 'user' ? 'row-reverse' : 'row',
            alignItems: 'flex-start',
          }}>
            {/* Avatar */}
            <div style={{
              width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
              background: msg.role === 'user' ? 'rgba(99,102,241,0.3)' : 'rgba(14,165,233,0.2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {msg.role === 'user'
                ? <User size={14} color="#818cf8" />
                : <Bot size={14} color="#38bdf8" />}
            </div>
            {/* Bubble */}
            <div style={{
              maxWidth: '80%',
              padding: '10px 14px',
              borderRadius: msg.role === 'user' ? '16px 4px 16px 16px' : '4px 16px 16px 16px',
              background: msg.role === 'user'
                ? 'rgba(99,102,241,0.25)'
                : 'rgba(255,255,255,0.05)',
              border: msg.role === 'user'
                ? '1px solid rgba(99,102,241,0.3)'
                : '1px solid rgba(255,255,255,0.08)',
              color: '#e2e8f0',
              fontSize: 13,
              lineHeight: 1.6,
              whiteSpace: 'pre-wrap',
            }}>
              {msg.content}
            </div>
          </div>
        ))}

        {loading && (
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'rgba(14,165,233,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Bot size={14} color="#38bdf8" />
            </div>
            <div style={{ padding: '12px 16px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '4px 16px 16px 16px' }}>
              <div style={{ display: 'flex', gap: 4 }}>
                {[0, 1, 2].map(i => (
                  <div key={i} style={{
                    width: 7, height: 7, borderRadius: '50%', background: '#38bdf8',
                    animation: `bounce 1.2s ease-in-out ${i * 0.2}s infinite`,
                  }} />
                ))}
              </div>
              <style>{`@keyframes bounce { 0%,80%,100%{transform:translateY(0)} 40%{transform:translateY(-6px)} }`}</style>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Quick prompts — show only when file is loaded and no messages yet or just first */}
      {chatText && messages.length <= 1 && (
        <div style={{
          padding: '8px 16px',
          borderTop: '1px solid rgba(255,255,255,0.05)',
          display: 'flex',
          gap: 6,
          flexWrap: 'wrap',
          flexShrink: 0,
        }}>
          {QUICK_PROMPTS.map(({ label, prompt }) => (
            <button
              key={label}
              onClick={() => sendMessage(prompt)}
              disabled={loading}
              style={{
                padding: '5px 12px',
                background: 'rgba(99,102,241,0.12)',
                border: '1px solid rgba(99,102,241,0.25)',
                borderRadius: 20,
                color: '#a5b4fc',
                fontSize: 12,
                cursor: 'pointer',
                fontFamily: 'inherit',
                transition: 'all 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(99,102,241,0.25)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(99,102,241,0.12)' }}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {/* Input area */}
      <div style={{
        padding: '12px 16px',
        borderTop: '1px solid rgba(255,255,255,0.07)',
        display: 'flex',
        gap: 8,
        alignItems: 'flex-end',
        flexShrink: 0,
        background: 'rgba(0,0,0,0.2)',
      }}>
        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() }
          }}
          placeholder={chatFile ? `Ask anything about ${chatFile.name}…` : 'Select a file on the left, or just ask anything…'}
          rows={1}
          style={{
            flex: 1,
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 10,
            color: '#e2e8f0',
            fontSize: 13,
            padding: '9px 12px',
            outline: 'none',
            fontFamily: 'inherit',
            resize: 'none',
            lineHeight: 1.5,
            maxHeight: 120,
            overflowY: 'auto',
          }}
        />

        <button
          onClick={() => sendMessage()}
          disabled={loading || !input.trim()}
          style={{
            width: 36, height: 36, borderRadius: 10, flexShrink: 0,
            background: loading || (!input.trim() && !chatText) ? 'rgba(99,102,241,0.2)' : '#6366f1',
            border: 'none',
            color: '#fff',
            cursor: loading || !input.trim() ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'background 0.15s',
          }}
        >
          {loading ? <Loader size={15} style={{ animation: 'spin 1s linear infinite' }} /> : <Send size={15} />}
        </button>
      </div>
    </div>
  )
}

// ── Main Reports page ──────────────────────────────────────────────────────────
export default function Reports() {
  const [files, setFiles] = useState([])
  const [uploaded, setUploaded] = useState([])
  const [selectedFile, setSelectedFile] = useState(null)
  const [loading, setLoading] = useState(false)
  const [selectedText, setSelectedText] = useState('')
  const [extractingSelected, setExtractingSelected] = useState(false)

  const onDrop = useCallback(acceptedFiles => {
    setFiles(prev => [...prev, ...acceptedFiles])
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'text/csv': ['.csv'],
      'application/vnd.ms-excel': ['.xls'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'text/plain': ['.txt'],
      'application/json': ['.json'],
    },
  })

  const handleUpload = async () => {
    if (files.length === 0) return
    setLoading(true)
    try {
      for (const file of files) {
        const formData = new FormData()
        formData.append('file', file)
        const res = await axios.post(`${BACKEND}/upload`, formData)
        const result = res.data
        setUploaded(prev => [...prev, {
          id: result.id,
          name: result.filename,
          _file: file,
          riskScore: result.risk?.score || 0,
          riskLevel: result.risk?.level || 'unknown',
          violations: result.risk?.violations?.length || 0,
          anomalies: result.anomalies?.anomaly_rate || 0,
          stats: result.stats || {},
          risk: result.risk || {},
        }])
      }
      setFiles([])
    } catch (err) {
      console.error('Upload error:', err)
      // Still add file to list for AI chat even if backend fails
      for (const file of files) {
        setUploaded(prev => [...prev, {
          id: Date.now() + Math.random(),
          name: file.name,
          _file: file,
          riskScore: 0,
          riskLevel: 'unknown',
          violations: 0,
          anomalies: 0,
          stats: {},
          risk: {},
        }])
      }
      setFiles([])
    }
    setLoading(false)
  }

  const handleDelete = (id) => {
    setUploaded(prev => prev.filter(f => f.id !== id))
    if (selectedFile?.id === id) {
      setSelectedFile(null)
      setSelectedText('')
    }
  }

  // When user selects a file in the list, extract its text for the chat
  const handleSelectFile = async (file) => {
    setSelectedFile(file)
    if (file._file) {
      setExtractingSelected(true)
      try {
        const text = await extractText(file._file)
        setSelectedText(text)
      } catch {
        setSelectedText('')
      }
      setExtractingSelected(false)
    } else {
      setSelectedText('')
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-sky-50 to-cyan-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8 flex items-center gap-3">
          <div className="p-3 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-xl text-white">
            <Database size={26} />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Water Quality Reports</h1>
            <p className="text-slate-500 text-sm mt-0.5">Upload • Analyze • Chat with AI — Free, no limits</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* ── LEFT: Upload + file list ── */}
          <div className="space-y-5">
            {/* Drop zone */}
            <div
              {...getRootProps()}
              className={`p-8 rounded-2xl border-2 border-dashed transition-all cursor-pointer ${
                isDragActive ? 'border-blue-500 bg-blue-100' : 'border-slate-300 bg-white hover:border-blue-400'
              }`}
            >
              <input {...getInputProps()} />
              <div className="text-center">
                <Upload className="mx-auto text-blue-600 mb-3" size={38} />
                <p className="font-bold text-slate-900 mb-1">
                  {isDragActive ? 'Drop it!' : 'Drag & drop files'}
                </p>
                <p className="text-sm text-slate-500">or click to select</p>
                <p className="text-xs text-slate-400 mt-2">PDF, CSV, XLSX, DOCX, TXT, JSON</p>
              </div>
            </div>

            {/* Pending files */}
            {files.length > 0 && (
              <div className="p-4 bg-blue-50 rounded-xl border border-blue-200">
                <p className="text-sm font-bold text-slate-800 mb-3">📁 {files.length} file(s) ready</p>
                <div className="space-y-2 max-h-28 overflow-y-auto mb-3">
                  {files.map((f, i) => (
                    <div key={i} className="flex justify-between text-sm bg-white p-2 rounded border border-blue-100">
                      <span className="text-slate-700 truncate">{f.name}</span>
                      <span className="text-xs text-slate-400">{(f.size / 1024).toFixed(0)}K</span>
                    </div>
                  ))}
                </div>
                <button
                  onClick={handleUpload}
                  disabled={loading}
                  className="w-full py-2 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-lg font-bold hover:shadow-lg disabled:opacity-50 flex items-center justify-center gap-2 text-sm"
                >
                  {loading ? <><Loader size={14} className="animate-spin" /> Uploading…</> : <><Upload size={14} /> Upload & Analyze</>}
                </button>
              </div>
            )}

            {/* File list */}
            <div>
              <h3 className="font-bold text-slate-800 mb-3 flex items-center gap-2 text-sm">
                <Database size={16} /> Files ({uploaded.length})
              </h3>
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {uploaded.length === 0 ? (
                  <p className="text-center text-slate-400 py-6 text-sm">No files yet</p>
                ) : (
                  uploaded.map(file => (
                    <div
                      key={file.id}
                      onClick={() => handleSelectFile(file)}
                      className={`p-3 rounded-xl cursor-pointer transition-all border-2 ${
                        selectedFile?.id === file.id
                          ? 'bg-blue-100 border-blue-400 shadow'
                          : 'bg-white border-slate-200 hover:border-blue-300'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-slate-900 text-sm truncate">{file.name}</p>
                          <div className="flex gap-2 mt-1.5 flex-wrap">
                            <span className={`text-xs px-2 py-0.5 rounded font-bold ${
                              file.riskLevel === 'critical' ? 'bg-red-200 text-red-800'
                              : file.riskLevel === 'elevated' ? 'bg-yellow-200 text-yellow-800'
                              : 'bg-green-200 text-green-800'
                            }`}>
                              {file.riskLevel.toUpperCase()}
                            </span>
                            {file.violations > 0 && (
                              <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded">
                                {file.violations} violations
                              </span>
                            )}
                          </div>
                        </div>
                        <button
                          onClick={e => { e.stopPropagation(); handleDelete(file.id) }}
                          className="text-red-400 hover:bg-red-100 p-1.5 rounded ml-2"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* ── RIGHT: Analysis + AI Chat ── */}
          <div className="lg:col-span-2 flex flex-col gap-6">

            {/* ML Analysis panel (only when file selected and has numeric stats) */}
            {selectedFile && selectedFile.stats?.is_numeric && (
              <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200 space-y-5">
                <h3 className="font-bold text-slate-900 flex items-center gap-2">
                  <BarChart2 size={18} /> Risk Assessment — {selectedFile.name}
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="p-4 bg-red-50 rounded-xl border border-red-200">
                    <p className="text-xs text-slate-600 font-semibold">RISK SCORE</p>
                    <p className="text-3xl font-bold text-red-600 mt-1">{selectedFile.riskScore.toFixed(0)}</p>
                    <p className="text-xs text-slate-500 mt-0.5">/ 100</p>
                  </div>
                  <div className="p-4 bg-yellow-50 rounded-xl border border-yellow-200">
                    <p className="text-xs text-slate-600 font-semibold">VIOLATIONS</p>
                    <p className="text-3xl font-bold text-yellow-600 mt-1">{selectedFile.violations}</p>
                    <p className="text-xs text-slate-500 mt-0.5">detected</p>
                  </div>
                  <div className="p-4 bg-blue-50 rounded-xl border border-blue-200">
                    <p className="text-xs text-slate-600 font-semibold">ANOMALIES</p>
                    <p className="text-3xl font-bold text-blue-600 mt-1">{selectedFile.anomalies.toFixed(1)}%</p>
                    <p className="text-xs text-slate-500 mt-0.5">of data</p>
                  </div>
                  <div className="p-4 bg-green-50 rounded-xl border border-green-200">
                    <p className="text-xs text-slate-600 font-semibold">LEVEL</p>
                    <p className="text-xl font-bold text-green-700 mt-1 capitalize">{selectedFile.riskLevel}</p>
                  </div>
                </div>

                {selectedFile.risk?.violations?.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-bold text-slate-700 flex items-center gap-1.5">
                      <AlertTriangle size={15} className="text-red-500" /> Violations
                    </p>
                    {selectedFile.risk.violations.slice(0, 4).map((v, i) => (
                      <div key={i} className="flex gap-2 p-3 bg-red-50 rounded-lg border border-red-100 text-sm">
                        <AlertCircle size={15} className="text-red-500 flex-shrink-0 mt-0.5" />
                        <div>
                          <span className="font-semibold text-slate-800">{v.column}:</span>{' '}
                          <span className="text-slate-700">{v.issue}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {selectedFile.stats?.col_stats && (
                  <div className="space-y-2">
                    <p className="text-sm font-bold text-slate-700 flex items-center gap-1.5">
                      <Activity size={15} className="text-blue-500" /> Column Statistics
                    </p>
                    {Object.entries(selectedFile.stats.col_stats).slice(0, 4).map(([col, stats], i) => {
                      const who = whoStatus(col, parseFloat(stats.mean))
                      return (
                        <div key={i} className="p-3 rounded-lg border border-slate-100 bg-slate-50 text-sm">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-slate-800">{col}</span>
                            <div className="flex gap-2">
                              <span className="text-xs bg-white px-2 py-0.5 rounded border border-slate-200">μ={stats.mean?.toFixed(2)}</span>
                              <span className="text-xs bg-white px-2 py-0.5 rounded border border-slate-200">σ={stats.std?.toFixed(2)}</span>
                              {who && <span className="text-xs px-2 py-0.5 rounded font-bold" style={{ background: who.bg, color: who.color }}>{who.label}</span>}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}

            {/* ── AI Chat Dialog (always shown) ── */}
            <div style={{ flex: 1, minHeight: 520 }}>
              {extractingSelected ? (
                <div style={{
                  height: 520, background: '#0f172a', borderRadius: 16, border: '1px solid rgba(99,102,241,0.3)',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, color: '#64748b',
                }}>
                  <Loader size={28} color="#818cf8" style={{ animation: 'spin 1s linear infinite' }} />
                  <p style={{ fontSize: 13 }}>Reading {selectedFile?.name}…</p>
                  <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                </div>
              ) : (
                <AIChatDialog
                  preloadedFile={selectedFile?._file || null}
                  preloadedText={selectedText}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
