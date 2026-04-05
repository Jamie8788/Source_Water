import PageAmbience from '../components/layout/PageAmbience'
import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import api from '../utils/api'
import { FlaskConical, Plus, X, Upload } from 'lucide-react'
import { useDropzone } from 'react-dropzone'

function NewProjectModal({ onClose, onCreated }) {
  const [form, setForm] = useState({ title: '', description: '', location: '', start_date: '', end_date: '' })
  const [loading, setLoading] = useState(false)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const submit = async e => {
    e.preventDefault(); setLoading(true)
    try { const r = await api.post('/projects', form); onCreated(r.data.project); onClose() }
    catch (err) { alert(err.response?.data?.error || 'Failed') }
    finally { setLoading(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-bold text-gray-800">New Research Project</h2>
          <button onClick={onClose}><X className="w-5 h-5 text-gray-400" /></button>
        </div>
        <form onSubmit={submit} className="p-6 space-y-4">
          <div><label>Project Title</label><input value={form.title} onChange={e => set('title', e.target.value)} required /></div>
          <div><label>Description</label><textarea rows={3} value={form.description} onChange={e => set('description', e.target.value)} className="resize-none" /></div>
          <div><label>Location</label><input value={form.location} onChange={e => set('location', e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label>Start Date</label><input type="date" value={form.start_date} onChange={e => set('start_date', e.target.value)} /></div>
            <div><label>End Date</label><input type="date" value={form.end_date} onChange={e => set('end_date', e.target.value)} /></div>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={loading} className="btn-primary flex-1">{loading ? 'Creating...' : 'Create Project'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function Projects() {
  const { isResearcher, isAdmin } = useAuth()
  const [projects, setProjects] = useState([])
  const [showNew, setShowNew] = useState(false)
  const [selected, setSelected] = useState(null)
  const [uploading, setUploading] = useState(false)

  useEffect(() => {
    api.get('/projects').then(r => setProjects(r.data.projects || [])).catch(() => {})
  }, [])

  const { getRootProps, getInputProps } = useDropzone({
    accept: { 'text/csv': ['.csv'], 'application/vnd.ms-excel': ['.xls'], 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'] },
    onDrop: async (files) => {
      if (!selected) return
      setUploading(true)
      const fd = new FormData()
      fd.append('dataset', files[0])
      fd.append('name', files[0].name)
      try { await api.post(`/projects/${selected.id}/datasets`, fd); alert('Dataset uploaded!') }
      catch { alert('Upload failed') }
      finally { setUploading(false) }
    }
  })

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h1 className="font-bold text-gray-900" style={{ fontSize: 20 }}>Research Projects</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>{projects.length} active research initiatives</p>
        </div>
        {(isResearcher || isAdmin) && (
          <button onClick={() => setShowNew(true)} className="btn-primary">
            <Plus className="w-4 h-4" /> New Project
          </button>
        )}
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {projects.map(p => (
          <div key={p.id} className={`card-hover p-5 ${selected?.id === p.id ? 'ring-2 ring-ocean-500' : ''}`} onClick={() => setSelected(p)}>
            <div className="flex items-start gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-ocean-100 flex items-center justify-center flex-shrink-0">
                <FlaskConical className="w-5 h-5 text-ocean-600" />
              </div>
              <div>
                <h3 className="font-bold text-gray-800">{p.title}</h3>
                <span className={`badge mt-1 ${p.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{p.status}</span>
              </div>
            </div>
            <p className="text-sm text-gray-600 mb-3">{p.description}</p>
            {p.location && <p className="text-xs text-gray-400">📍 {p.location}</p>}
          </div>
        ))}
        {projects.length === 0 && <div className="col-span-2 card p-12 text-center text-gray-400">No research projects yet.</div>}
      </div>

      {/* Dataset upload for selected project */}
      {selected && (isResearcher || isAdmin) && (
        <div className="card p-6">
          <h3 className="font-bold text-gray-800 mb-3">Upload Dataset to: {selected.title}</h3>
          <div {...getRootProps()} className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${uploading ? 'border-ocean-400 bg-ocean-50' : 'border-gray-300 hover:border-ocean-400 hover:bg-ocean-50'}`}>
            <input {...getInputProps()} />
            <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
            <p className="text-gray-600 font-medium">{uploading ? 'Uploading...' : 'Drop CSV/Excel file here or click to browse'}</p>
          </div>
        </div>
      )}

      {showNew && <NewProjectModal onClose={() => setShowNew(false)} onCreated={p => setProjects(prev => [p, ...prev])} />}
    </div>
  )
}
