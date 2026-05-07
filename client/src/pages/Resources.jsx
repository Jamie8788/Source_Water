import { useState, useEffect, useRef } from 'react'
import api from '../utils/api'
import { useAuth } from '../context/AuthContext'
import {
  BookOpen, ExternalLink, Download, Search, Bookmark, BookmarkCheck,
  Plus, Trash2, X, Link, FileText, Star, Eye, TrendingUp, Filter
} from 'lucide-react'
import DatasetAnalyzer from '../components/resources/DatasetAnalyzer'

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:3001/api').replace('/api', '')

// ── Category colours ──────────────────────────────────────────────────────────
const CAT_COLOR = {
  'Community Science':    '#006fbf',
  'Water Quality':        '#067d62',
  'Field Work':           '#c45f00',
  'Datasets':             '#7b4fc4',
  'Data Literacy':        '#0094d9',
  'Safety':               '#cc3333',
  'Ecology':              '#0a7c5b',
  'Indigenous Water Rights': '#804000',
}
const catColor = c => CAT_COLOR[c] || '#494c4e'

// ── Resource type config ──────────────────────────────────────────────────────
const TYPE_CFG = {
  guide:    { icon: '📋', label: 'Guide',    bg: '#edfcf1', color: '#1a7a3c' },
  document: { icon: '📄', label: 'Document', bg: '#f0f4ff', color: '#3b60e4' },
  dataset:  { icon: '📊', label: 'Dataset',  bg: '#f5f0ff', color: '#7b4fc4' },
  video:    { icon: '🎬', label: 'Video',    bg: '#fff4e6', color: '#c45f00' },
  link:     { icon: '🔗', label: 'Link',     bg: '#e9f5ff', color: '#006fbf' },
  report:   { icon: '📑', label: 'Report',   bg: '#fef9e7', color: '#976500' },
  other:    { icon: '📎', label: 'Other',    bg: '#f1f5f9', color: '#64748b' },
}
const typeOf = t => TYPE_CFG[t] || TYPE_CFG.other

// ── Partner badge ─────────────────────────────────────────────────────────────
// Curated to the two real data partners SOURCE Water relies on. Any user-added
// resource will simply not show a badge — that's intentional, badges only
// stamp the vetted feeds.
function partnerBadge(url) {
  if (!url) return null
  if (url.includes('waterrangers')) return { label: 'Water Rangers', color: '#006fbf' }
  if (url.includes('datastream'))   return { label: 'DataStream',    color: '#22a06b' }
  return null
}

// ── Add Resource Modal ────────────────────────────────────────────────────────
function AddResourceModal({ onClose, onAdded }) {
  const [form, setForm] = useState({ title: '', description: '', resource_type: 'link', category: '', external_url: '', visibility: 'public' })
  const [file, setFile]     = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')

  const submit = async () => {
    if (!form.title.trim()) { setError('Title is required'); return }
    if (!file && !form.external_url.trim()) { setError('Provide either a file upload or a URL'); return }
    setSaving(true); setError('')
    try {
      const fd = new FormData()
      Object.entries(form).forEach(([k, v]) => fd.append(k, v))
      if (file) fd.append('file', file)
      const r = await api.post('/resources', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      onAdded(r.data)
      onClose()
    } catch (e) { setError(e.response?.data?.error || 'Failed to save resource') }
    setSaving(false)
  }

  const inp = { background: 'var(--page-bg)', border: '1px solid var(--border)', color: 'var(--text)', borderRadius: 8, padding: '8px 12px', width: '100%', fontSize: 13, outline: 'none', fontFamily: 'inherit' }

  return (
    <div style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, background: 'rgba(0,0,0,0.55)', padding: 16 }}>
      <div style={{ width: '100%', maxWidth: 540, borderRadius: 12, overflow: 'hidden', background: 'var(--card-bg)', border: '1px solid var(--border)', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
          <h3 style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)', margin: 0 }}>Add Resource</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X style={{ width: 16, height: 16, color: 'var(--text-muted)' }}/></button>
        </div>
        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12, maxHeight: '70vh', overflowY: 'auto' }}>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Title *</label>
            <input style={inp} value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Resource title"/>
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Description</label>
            <textarea style={{ ...inp, resize: 'none' }} rows={3} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="What is this resource about?"/>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Type</label>
              <select style={inp} value={form.resource_type} onChange={e => setForm(f => ({ ...f, resource_type: e.target.value }))}>
                {Object.entries(TYPE_CFG).map(([v, c]) => <option key={v} value={v}>{c.icon} {c.label}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Category</label>
              <select style={inp} value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                <option value="">— Select —</option>
                {Object.keys(CAT_COLOR).map(c => <option key={c} value={c}>{c}</option>)}
                <option value="General">General</option>
              </select>
            </div>
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>URL</label>
            <input style={inp} value={form.external_url} onChange={e => setForm(f => ({ ...f, external_url: e.target.value }))} placeholder="https://..."/>
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Upload File (PDF, CSV, DOCX…)</label>
            <div onClick={() => document.getElementById('res-file-inp').click()} style={{
              borderRadius: 8, border: `2px dashed ${file ? '#1a7a3c' : 'var(--border)'}`,
              padding: '14px', textAlign: 'center', cursor: 'pointer', background: file ? 'rgba(26,122,60,0.04)' : 'transparent',
            }}>
              <input id="res-file-inp" type="file" style={{ display: 'none' }}
                accept=".pdf,.csv,.xlsx,.xls,.docx,.doc,.txt,.json"
                onChange={e => setFile(e.target.files?.[0] || null)}/>
              {file
                ? <span style={{ fontSize: 13, color: '#1a7a3c', fontWeight: 600 }}>📎 {file.name}</span>
                : <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Click to upload</span>
              }
            </div>
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Visibility</label>
            <select style={inp} value={form.visibility} onChange={e => setForm(f => ({ ...f, visibility: e.target.value }))}>
              <option value="public">Public</option>
              <option value="private">Private (admins only)</option>
            </select>
          </div>
          {error && <p style={{ fontSize: 13, color: '#cc3333', margin: 0 }}>{error}</p>}
        </div>
        <div style={{ display: 'flex', gap: 8, padding: '14px 20px', borderTop: '1px solid var(--border)' }}>
          <button onClick={onClose} style={{ flex: 1, padding: '9px', borderRadius: 8, fontSize: 13, fontWeight: 600, background: 'var(--page-bg)', border: '1px solid var(--border)', color: 'var(--text-muted)', cursor: 'pointer' }}>Cancel</button>
          <button onClick={submit} disabled={saving} style={{ flex: 1, padding: '9px', borderRadius: 8, fontSize: 13, fontWeight: 700, background: '#006fbf', color: 'white', border: 'none', cursor: 'pointer', opacity: saving ? 0.6 : 1 }}>
            {saving ? 'Saving…' : 'Add Resource'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Resource Card ─────────────────────────────────────────────────────────────
function ResourceCard({ r, idx, bookmarked, onBookmark, onView, onDelete, isAdmin }) {
  const tc   = typeOf(r.resource_type)
  const cc   = catColor(r.category)
  const pb   = partnerBadge(r.external_url)
  const hasLink = r.external_url || r.url
  const hasFile = r.file_path || r.file_url

  return (
    <div style={{
      background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 10,
      overflow: 'hidden', display: 'flex', flexDirection: 'column',
      animation: 'resCardIn 0.38s ease both',
      animationDelay: `${idx * 45}ms`,
      transition: 'box-shadow 0.18s ease, transform 0.18s ease',
    }}
      className="res-card"
    >
      {/* Category colour bar */}
      <div style={{ height: 4, background: `linear-gradient(90deg,${cc},${cc}55)` }}/>

      <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10, flex: 1 }}>
        {/* Header row */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
          {/* Type icon */}
          <div style={{ width: 38, height: 38, borderRadius: 10, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, background: tc.bg }}>
            {tc.icon}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, flexWrap: 'wrap' }}>
              {r.featured == 1 && (
                <span style={{ fontSize: 10, fontWeight: 800, padding: '2px 7px', borderRadius: 99, background: '#fff9e6', color: '#d97706', border: '1px solid #fde68a', letterSpacing: '0.04em', flexShrink: 0 }}>
                  ★ FEATURED
                </span>
              )}
            </div>
            <h3 style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)', margin: '3px 0 0', lineHeight: 1.35 }}>{r.title}</h3>
          </div>
          {/* Bookmark button */}
          <button onClick={() => onBookmark(r.id)} title={bookmarked ? 'Remove bookmark' : 'Bookmark'} style={{
            flexShrink: 0, background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: bookmarked ? '#d97706' : 'var(--text-muted)',
            transition: 'color 0.15s, transform 0.15s',
          }}>
            {bookmarked
              ? <BookmarkCheck style={{ width: 16, height: 16 }}/>
              : <Bookmark style={{ width: 16, height: 16 }}/>
            }
          </button>
        </div>

        {/* Chips */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
          {r.category && (
            <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 99, background: `${cc}15`, color: cc }}>
              {r.category}
            </span>
          )}
          <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 99, background: tc.bg, color: tc.color, fontWeight: 600 }}>
            {tc.icon} {tc.label}
          </span>
          {pb && (
            <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 99, background: `${pb.color}12`, color: pb.color, fontWeight: 600 }}>
              {pb.label}
            </span>
          )}
        </div>

        {/* Description */}
        {r.description && (
          <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.55, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical' }}>
            {r.description}
          </p>
        )}

        <div style={{ flex: 1 }}/>

        {/* Footer: stats + actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 8, borderTop: '1px solid var(--border)' }}>
          {(r.view_count > 0) && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 11, color: 'var(--text-muted)' }}>
              <Eye style={{ width: 11, height: 11 }}/> {r.view_count}
            </span>
          )}
          {(r.bookmark_count > 0) && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 11, color: 'var(--text-muted)' }}>
              <Bookmark style={{ width: 11, height: 11 }}/> {r.bookmark_count}
            </span>
          )}
          <div style={{ flex: 1 }}/>
          {isAdmin && (
            <button onClick={() => onDelete(r.id)} title="Delete" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'var(--text-muted)' }}>
              <Trash2 style={{ width: 13, height: 13 }}/>
            </button>
          )}
          <button onClick={() => onView(r)} style={{
            display: 'flex', alignItems: 'center', gap: 5, padding: '6px 13px', borderRadius: 7,
            fontSize: 12, fontWeight: 700, cursor: 'pointer', border: 'none',
            background: '#006fbf', color: 'white',
            transition: 'background 0.15s',
          }}>
            {hasLink ? <><ExternalLink style={{ width: 12, height: 12 }}/> Open</> : <><Download style={{ width: 12, height: 12 }}/> Download</>}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
const TYPES = ['All Types', 'guide', 'dataset', 'document', 'link', 'video', 'report']

export default function Resources() {
  const { user } = useAuth()
  const [resources,  setResources]  = useState([])
  const [bookmarks,  setBookmarks]  = useState(new Set())
  const [search,     setSearch]     = useState('')
  const [category,   setCategory]   = useState('all')
  const [typeFilter, setTypeFilter] = useState('All Types')
  const [showAdd,    setShowAdd]    = useState(false)
  const [loading,    setLoading]    = useState(true)
  const searchRef = useRef()

  const isAdmin = !!user?.is_admin

  useEffect(() => {
    Promise.all([
      api.get('/resources'),
      api.get('/resources/bookmarks').catch(() => ({ data: [] })),
    ]).then(([r1, r2]) => {
      setResources(r1.data || [])
      setBookmarks(new Set(r2.data))
    }).finally(() => setLoading(false))
  }, [])

  const toggleBookmark = async (id) => {
    const was = bookmarks.has(id)
    setBookmarks(prev => { const s = new Set(prev); was ? s.delete(id) : s.add(id); return s })
    was ? await api.delete(`/resources/${id}/bookmark`).catch(() => {}) : await api.post(`/resources/${id}/bookmark`).catch(() => {})
  }

  const openResource = async (r) => {
    await api.post(`/resources/${r.id}/view`).catch(() => {})
    setResources(prev => prev.map(x => x.id === r.id ? { ...x, view_count: (x.view_count || 0) + 1 } : x))
    const url = r.external_url || r.url
    const fp  = r.file_path || r.file_url
    if (url) window.open(url, '_blank', 'noopener')
    else if (fp) window.open(`${API_BASE}${fp}`, '_blank', 'noopener')
  }

  const deleteResource = async (id) => {
    if (!confirm('Delete this resource?')) return
    await api.delete(`/resources/${id}`).catch(() => {})
    setResources(prev => prev.filter(r => r.id !== id))
  }

  const categories = ['all', ...new Set(resources.map(r => r.category).filter(Boolean))]

  const filtered = resources.filter(r => {
    if (category !== 'all' && r.category !== category) return false
    if (typeFilter !== 'All Types' && r.resource_type !== typeFilter) return false
    if (search && !r.title?.toLowerCase().includes(search.toLowerCase()) && !(r.description||'').toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const featured = resources.filter(r => r.featured == 1).slice(0, 4)
  const totalBookmarks = bookmarks.size

  return (
    <div style={{ maxWidth: 1080, margin: '0 auto', paddingBottom: 40 }}>
      <style>{`
        @keyframes resCardIn { from { opacity:0; transform:translateY(16px) } to { opacity:1; transform:translateY(0) } }
        .res-card:hover { transform: translateY(-3px) !important; box-shadow: 0 10px 32px rgba(0,111,191,0.13) !important; }
        .res-filter-btn { transition: background 0.12s, color 0.12s, border-color 0.12s; }
        .res-filter-btn:hover { border-color: #006fbf !important; color: #006fbf !important; }
      `}</style>

      {showAdd && <AddResourceModal onClose={() => setShowAdd(false)} onAdded={r => setResources(prev => [r, ...prev])}/>}

      {/* ── Page header ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', margin: '0 0 4px' }}>Resource Library</h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>
            {resources.length} curated water quality resources · guides, datasets, field manuals &amp; more
            {totalBookmarks > 0 && ` · ${totalBookmarks} bookmarked`}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {isAdmin && (
            <button onClick={() => setShowAdd(true)} style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 8,
              background: '#006fbf', color: 'white', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700,
            }}>
              <Plus style={{ width: 14, height: 14 }}/> Add Resource
            </button>
          )}
        </div>
      </div>

      {/* ── Dataset Analyzer ── purely client-side stats / charts /
          anomalies / correlations for any CSV from WR, DataStream, or
          a community member's own field log. No LLM, no upload.       */}
      {!loading && <DatasetAnalyzer />}

      {/* ── Featured resources ── */}
      {!loading && featured.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.06em', marginBottom: 10 }}>
            ★ FEATURED
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(240px,1fr))', gap: 12 }}>
            {featured.map((r, i) => {
              const cc = catColor(r.category)
              const tc = typeOf(r.resource_type)
              return (
                <div key={r.id} onClick={() => openResource(r)} style={{
                  background: `linear-gradient(135deg, var(--card-bg), ${cc}08)`,
                  border: `1px solid ${cc}33`, borderRadius: 10, padding: '14px 16px',
                  cursor: 'pointer', transition: 'box-shadow 0.18s, transform 0.18s',
                  animation: `resCardIn 0.35s ease both`, animationDelay: `${i * 60}ms`,
                }}
                  className="res-card"
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <span style={{ fontSize: 18 }}>{tc.icon}</span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: cc }}>{r.category}</span>
                    <span style={{ marginLeft: 'auto', fontSize: 10, fontWeight: 800, color: '#d97706' }}>★ FEATURED</span>
                  </div>
                  <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text)', lineHeight: 1.35, marginBottom: 4 }}>{r.title}</div>
                  {partnerBadge(r.external_url) && (
                    <span style={{ fontSize: 11, fontWeight: 600, color: partnerBadge(r.external_url).color }}>
                      {partnerBadge(r.external_url).label}
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Search ── */}
      <div style={{ position: 'relative', marginBottom: 12 }}>
        <Search style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', width: 15, height: 15, color: 'var(--text-muted)' }}/>
        <input
          ref={searchRef}
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search resources by title or description…"
          style={{
            width: '100%', padding: '10px 12px 10px 36px', borderRadius: 8, fontSize: 13,
            background: 'var(--card-bg)', border: '1px solid var(--border)', color: 'var(--text)',
            outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box',
          }}
        />
        {search && (
          <button onClick={() => setSearch('')} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
            <X style={{ width: 14, height: 14 }}/>
          </button>
        )}
      </div>

      {/* ── Category filters ── */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
        {categories.map(c => {
          const active = category === c
          const cc = c === 'all' ? '#494c4e' : catColor(c)
          return (
            <button key={c} onClick={() => setCategory(c)} className="res-filter-btn" style={{
              padding: '4px 13px', borderRadius: 99, fontSize: 12, fontWeight: active ? 700 : 500, cursor: 'pointer',
              border: `1.5px solid ${active ? cc : 'var(--border)'}`,
              background: active ? `${cc}15` : 'transparent',
              color: active ? cc : 'var(--text-muted)',
            }}>
              {c === 'all' ? 'All Categories' : c}
            </button>
          )
        })}
      </div>

      {/* ── Type filters ── */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 20, flexWrap: 'wrap' }}>
        {TYPES.map(t => {
          const active = typeFilter === t
          const tc = t === 'All Types' ? null : typeOf(t)
          return (
            <button key={t} onClick={() => setTypeFilter(t)} className="res-filter-btn" style={{
              padding: '3px 11px', borderRadius: 6, fontSize: 11, fontWeight: active ? 700 : 500, cursor: 'pointer',
              border: `1.5px solid ${active ? (tc?.color || '#006fbf') : 'var(--border)'}`,
              background: active ? (tc?.bg || '#e3f0fb') : 'transparent',
              color: active ? (tc?.color || '#006fbf') : 'var(--text-muted)',
            }}>
              {tc ? `${tc.icon} ${tc.label}` : t}
            </button>
          )
        })}
      </div>

      {/* ── Results count ── */}
      {!loading && (search || category !== 'all' || typeFilter !== 'All Types') && (
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
          {filtered.length} result{filtered.length !== 1 ? 's' : ''} found
        </p>
      )}

      {/* ── Grid ── */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
          <BookOpen style={{ width: 40, height: 40, margin: '0 auto 12px', opacity: 0.3 }}/>
          <p>Loading resources…</p>
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
          <BookOpen style={{ width: 48, height: 48, margin: '0 auto 16px', opacity: 0.3 }}/>
          <p style={{ fontSize: 15, marginBottom: 6 }}>{resources.length === 0 ? 'No resources yet.' : 'No resources match your search.'}</p>
          {resources.length > 0 && (
            <button onClick={() => { setSearch(''); setCategory('all'); setTypeFilter('All Types') }} style={{ fontSize: 13, color: '#006fbf', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
              Clear all filters
            </button>
          )}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(290px,1fr))', gap: 14 }}>
          {filtered.map((r, idx) => (
            <ResourceCard
              key={r.id}
              r={r} idx={idx}
              bookmarked={bookmarks.has(r.id)}
              onBookmark={toggleBookmark}
              onView={openResource}
              onDelete={deleteResource}
              isAdmin={isAdmin}
            />
          ))}
        </div>
      )}

      {/* ── Curated-data credit ── */}
      {!loading && (
        <div style={{ marginTop: 32, padding: '14px 20px', borderRadius: 10, background: 'rgba(0,111,191,0.05)', border: '1px solid rgba(0,111,191,0.15)', display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 22 }}>💧</span>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#006fbf' }}>Real data only — no fake links</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              Curated to the two open data partners SOURCE Water actually pulls from:{' '}
              <a href="https://www.waterrangers.ca" target="_blank" rel="noopener noreferrer" style={{ color: '#006fbf', fontWeight: 600 }}>Water Rangers</a>
              {' and '}
              <a href="https://datastream.org" target="_blank" rel="noopener noreferrer" style={{ color: '#22a06b', fontWeight: 600 }}>DataStream</a>.
              Anything else here was added by a community admin. The Dataset Analyzer above runs entirely in your browser — no upload, no LLM.
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
