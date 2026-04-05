import PageAmbience from '../components/layout/PageAmbience'
import { useState, useEffect } from 'react'
import api from '../utils/api'
import { useSound } from '../context/SoundContext'
import { BookOpen, ExternalLink, Download, Search, Bookmark } from 'lucide-react'

export default function Resources() {
  const { play } = useSound()
  const [resources, setResources] = useState([])
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('all')

  useEffect(() => {
    api.get('/resources').then(r => setResources(r.data.resources || [])).catch(() => {})
  }, [])

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

  const view = async (r) => {
    play('click')
    await api.post(`/resources/${r.id}/view`).catch(() => {})
    if (r.url) window.open(r.url, '_blank')
    else if (r.file_url) window.open(`/uploads/${r.file_url}`, '_blank')
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="mb-2">
        <h1 className="font-bold text-gray-900" style={{ fontSize: 20 }}>Resource Library</h1>
        <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>{resources.length} water quality resources and guides</p>
      </div>

      {/* Search and filter */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search resources..." className="pl-9" />
        </div>
        <div className="flex gap-2 flex-wrap">
          {categories.map(cat => (
            <button key={cat} onClick={() => setCategory(cat)}
              className={`tab-btn capitalize ${category === cat ? 'active' : ''}`}>
              {cat}
            </button>
          ))}
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {filtered.map(r => (
          <div key={r.id} className="card-hover p-5">
            <div className="flex items-start gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-ocean-100 flex items-center justify-center flex-shrink-0">
                <BookOpen className="w-5 h-5 text-ocean-600" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-gray-800 truncate">{r.title}</h3>
                {r.category && <span className="badge bg-ocean-100 text-ocean-700 mt-1">{r.category}</span>}
              </div>
              <button onClick={() => bookmark(r.id)} className="p-1.5 text-gray-400 hover:text-ocean-500 transition-colors">
                <Bookmark className="w-4 h-4" />
              </button>
            </div>
            {r.description && <p className="text-sm text-gray-600 mb-3 line-clamp-2">{r.description}</p>}
            <div className="flex gap-2">
              <button onClick={() => view(r)} className="btn-secondary flex-1 py-2 text-sm">
                {r.url ? <><ExternalLink className="w-4 h-4" /> Open Link</> : <><Download className="w-4 h-4" /> Download</>}
              </button>
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="col-span-2 card p-12 text-center text-gray-400">
            <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-30" />
            No resources found matching your search.
          </div>
        )}
      </div>
    </div>
  )
}
