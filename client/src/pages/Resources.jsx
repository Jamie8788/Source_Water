import PageAmbience from '../components/layout/PageAmbience'
import { useState, useEffect } from 'react'
import api from '../utils/api'
import { useAuth } from '../context/AuthContext'
import { useSound } from '../context/SoundContext'
import { BookOpen, ExternalLink, Download, Search, Bookmark, Plus, Trash2, X, Link, FileText } from 'lucide-react'

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:3001/api').replace('/api', '')

function AddResourceModal({ onClose, onAdded }) {
  const [form, setForm] = useState({ title: '', description: '', resource_type: 'document', category: '', external_url: '', visibility: 'public' })
  const [file, setFile] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const submit = async () => {
    if (!form.title.trim()) { setError('Title is required'); return }
    if (!file && !form.external_url.trim()) { setError('Provide either a file or a URL'); return }
    setSaving(true); setError('')
    try {
      const fd = new FormData()
      Object.entries(form).forEach(([k, v]) => fd.append(k, v))
      if (file) fd.append('file', file)
      const r = await api.post('/resources', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      onAdded(r.data)
      onClose()
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to save resource')
    }
    setSaving(false)
  }

  const inputStyle = { background: 'var(--page-bg)', border: '1px solid var(--border)', color: 'var(--text)', borderRadius: 10, padding: '8px 12px', width: '100%', fontSize: 13 }

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden" style={{ background: 'var(--card-bg)', border: '1px solid var(--border)' }}>
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
          <h3 className="font-bold text-base" style={{ color: 'var(--text)' }}>Add Resource</h3>
          <button onClick={onClose}><X className="w-4 h-4" style={{ color: 'var(--text-muted)' }}/></button>
        </div>
        <div className="p-5 space-y-3 max-h-[70vh] overflow-y-auto">
          <div>
            <label className="text-xs font-semibold mb-1 block" style={{ color: 'var(--text-muted)' }}>Title *</label>
            <input style={inputStyle} value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Resource title"/>
          </div>
          <div>
            <label className="text-xs font-semibold mb-1 block" style={{ color: 'var(--text-muted)' }}>Description</label>
            <textarea style={{ ...inputStyle, resize: 'none' }} rows={2} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Brief description..."/>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold mb-1 block" style={{ color: 'var(--text-muted)' }}>Type</label>
              <select style={inputStyle} value={form.resource_type} onChange={e => setForm(f => ({ ...f, resource_type: e.target.value }))}>
                {['document','video','link','dataset','guide','report','other'].map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold mb-1 block" style={{ color: 'var(--text-muted)' }}>Category</label>
              <input style={inputStyle} value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} placeholder="e.g. Water Quality"/>
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold mb-1 block" style={{ color: 'var(--text-muted)' }}>External URL (optional if uploading file)</label>
            <div className="relative">
              <Link className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: 'var(--text-muted)' }}/>
              <input style={{ ...inputStyle, paddingLeft: 32 }} value={form.external_url} onChange={e => setForm(f => ({ ...f, external_url: e.target.value }))} placeholder="https://..."/>
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold mb-1 block" style={{ color: 'var(--text-muted)' }}>Upload File (PDF, CSV, XLSX, etc.)</label>
            <div className="rounded-xl border-2 border-dashed p-4 text-center cursor-pointer transition-colors hover:bg-sky-50/10"
              style={{ borderColor: file ? '#10b981' : 'var(--border)' }}
              onClick={() => document.getElementById('res-file-input').click()}>
              <input id="res-file-input" type="file" className="hidden"
                accept=".pdf,.csv,.xlsx,.xls,.docx,.doc,.txt,.json,.mp4,.webm"
                onChange={e => setFile(e.target.files?.[0] || null)}/>
              {file ? (
                <div className="flex items-center justify-center gap-2 text-sm" style={{ color: '#10b981' }}>
                  <FileText className="w-4 h-4"/>{file.name}
                  <button onClick={e => { e.stopPropagation(); setFile(null) }} className="ml-1 text-red-400"><X className="w-3 h-3"/></button>
                </div>
              ) : (
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Click to upload a file</p>
              )}
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold mb-1 block" style={{ color: 'var(--text-muted)' }}>Visibility</label>
            <select style={inputStyle} value={form.visibility} onChange={e => setForm(f => ({ ...f, visibility: e.target.value }))}>
              <option value="public">Public</option>
              <option value="private">Private (admins only)</option>
            </select>
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
        </div>
        <div className="flex gap-2 px-5 py-4 border-t" style={{ borderColor: 'var(--border)' }}>
          <button onClick={onClose} className="flex-1 py-2 rounded-xl text-sm font-semibold transition-colors"
            style={{ border: '1px solid var(--border)', color: 'var(--text-muted)' }}>Cancel</button>
          <button onClick={submit} disabled={saving} className="flex-1 py-2 rounded-xl text-sm font-bold text-white transition-all disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)' }}>
            {saving ? 'Saving...' : 'Add Resource'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function Resources() {
  const { play } = useSound()
  const { user } = useAuth()
  const [resources, setResources] = useState([])
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('all')
  const [showAdd, setShowAdd] = useState(false)

  useEffect(() => {
    api.get('/resources').then(r => setResources(r.data.resources || r.data || [])).catch(() => {})
  }, [])

  const isAdmin = !!user?.is_admin

  const categories = ['all', ...new Set(resources.map(r => r.category).filter(Boolean))]
  const filtered = resources.filter(r => {
    const matchSearch = !search || r.title?.toLowerCase().includes(search.toLowerCase()) || r.description?.toLowerCase().includes(search.toLowerCase())
    const matchCat = category === 'all' || r.category === category
    return matchSearch && matchCat
  })

  const bookmark = async (id) => {
    play('click')
    await api.post(`/resources/${id}/bookmark`).catch(() => {})
  }

  const deleteResource = async (id) => {
    if (!window.confirm('Delete this resource?')) return
    await api.delete(`/resources/${id}`).catch(() => {})
    setResources(prev => prev.filter(r => r.id !== id))
  }

  const view = async (r) => {
    play('click')
    await api.post(`/resources/${r.id}/view`).catch(() => {})
    const url = r.external_url || r.url
    const filePath = r.file_path || r.file_url
    if (url) window.open(url, '_blank')
    else if (filePath) window.open(`${API_BASE}${filePath}`, '_blank')
  }

  const TYPE_ICONS = { video: '🎬', link: '🔗', dataset: '📊', guide: '📋', report: '📑', document: '📄', other: '📎' }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {showAdd && <AddResourceModal onClose={() => setShowAdd(false)} onAdded={r => setResources(prev => [r, ...prev])}/>}

      <div className="flex items-center justify-between mb-2">
        <div>
          <h1 className="font-bold" style={{ fontSize: 20, color: 'var(--text)' }}>Resource Library</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>{resources.length} water quality resources and guides</p>
        </div>
        {isAdmin && (
          <button onClick={() => setShowAdd(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-white transition-all hover:scale-105"
            style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)' }}>
            <Plus className="w-4 h-4"/> Add Resource
          </button>
        )}
      </div>

      {/* Search and filter */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-muted)' }}/>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search resources..."
            className="pl-9" style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 10, padding: '8px 12px 8px 36px', width: '100%', color: 'var(--text)' }}/>
        </div>
        <div className="flex gap-2 flex-wrap">
          {categories.map(cat => (
            <button key={cat} onClick={() => setCategory(cat)}
              className="px-3 py-1.5 rounded-full text-sm font-semibold transition-all capitalize"
              style={{
                background: category === cat ? '#6366f1' : 'var(--card-bg)',
                color: category === cat ? 'white' : 'var(--text-muted)',
                border: `1px solid ${category === cat ? '#6366f1' : 'var(--border)'}`,
              }}>
              {cat}
            </button>
          ))}
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {filtered.map(r => (
          <div key={r.id} className="card-hover p-5 group">
            <div className="flex items-start gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 text-xl"
                style={{ background: 'linear-gradient(135deg,rgba(99,102,241,0.15),rgba(20,184,166,0.15))' }}>
                {TYPE_ICONS[r.resource_type] || '📄'}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-bold truncate" style={{ color: 'var(--text)' }}>{r.title}</h3>
                <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                  {r.category && (
                    <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
                      style={{ background: 'rgba(99,102,241,0.1)', color: '#6366f1' }}>{r.category}</span>
                  )}
                  {r.resource_type && (
                    <span className="text-xs px-2 py-0.5 rounded-full capitalize"
                      style={{ background: 'var(--page-bg)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>{r.resource_type}</span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => bookmark(r.id)} className="p-1.5 rounded-lg transition-colors hover:bg-ocean-50"
                  title="Bookmark">
                  <Bookmark className="w-4 h-4" style={{ color: 'var(--text-muted)' }}/>
                </button>
                {isAdmin && (
                  <button onClick={() => deleteResource(r.id)} className="p-1.5 rounded-lg transition-colors hover:bg-red-50"
                    title="Delete resource">
                    <Trash2 className="w-4 h-4 text-red-400"/>
                  </button>
                )}
              </div>
            </div>
            {r.description && <p className="text-sm mb-3 line-clamp-2" style={{ color: 'var(--text-muted)' }}>{r.description}</p>}
            <button onClick={() => view(r)}
              className="flex items-center gap-2 w-full justify-center py-2 rounded-xl text-sm font-semibold transition-all hover:scale-[1.01]"
              style={{ background: 'var(--page-bg)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
              {(r.external_url || r.url) ? <><ExternalLink className="w-4 h-4"/> Open Link</> : <><Download className="w-4 h-4"/> Download</>}
            </button>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="col-span-2 card p-12 text-center" style={{ color: 'var(--text-muted)' }}>
            <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-30"/>
            <p>{isAdmin ? 'No resources yet — add the first one!' : 'No resources found matching your search.'}</p>
          </div>
        )}
      </div>
    </div>
  )
}
