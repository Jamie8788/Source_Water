import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useSound } from '../../context/SoundContext'
import { useTheme } from '../../context/ThemeContext'
import { useCMS } from '../../context/CMSContext'
import CMSField from '../cms/CMSField'
import { Bell, Search, ChevronDown, Volume2, VolumeX, Accessibility, Edit3, LogOut, Sparkles, Zap, ZapOff } from 'lucide-react'
import api from '../../utils/api'

// Toggle the global no-animations class on <html>. Persisted to localStorage so
// the user's choice survives a refresh. Disables all CSS animations,
// transitions, and the floating mascot wobble in one click.
function applyAnimPref(off) {
  document.documentElement.classList.toggle('sw-no-anim', off)
  try { localStorage.setItem('sw-anim-off', off ? '1' : '0') } catch {}
}

export default function TopBar({ sidebarWidth, onA11yClick, onOpenDM }) {
  const { user, logout } = useAuth()
  const { play, enabled, toggle: toggleSound } = useSound()
  const { isDark, toggleMode } = useTheme()
  const { cmsMode, toggleCmsMode } = useCMS()
  const navigate = useNavigate()
  const [unread, setUnread] = useState(0)
  const [searchVal, setSearchVal] = useState('')
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [animOff, setAnimOff] = useState(() => {
    try { return localStorage.getItem('sw-anim-off') === '1' } catch { return false }
  })
  const menuRef = useRef(null)

  // ── Global site search ──
  // The TopBar input doubles as a search across the 9,400+ Water Rangers
  // network plus any sites already adopted into our DB. WR locations are
  // lazy-loaded once on first focus (server caches the bulk fetch for 1h),
  // then filtered client-side for instant typeahead.
  const [allWR, setAllWR] = useState(null)        // null = not loaded yet
  const [localSites, setLocalSites] = useState([])
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchLoading, setSearchLoading] = useState(false)
  const searchBoxRef = useRef(null)

  const ensureSiteIndex = () => {
    if (allWR !== null) return
    setSearchLoading(true)
    Promise.all([
      api.get('/wr/locations-all').then(r => Array.isArray(r.data?.locations) ? r.data.locations : []).catch(() => []),
      api.get('/sites').then(r => Array.isArray(r.data) ? r.data : []).catch(() => []),
    ]).then(([wr, local]) => {
      setAllWR(wr)
      setLocalSites(local)
    }).finally(() => setSearchLoading(false))
  }

  const searchResults = (() => {
    const q = searchVal.trim().toLowerCase()
    if (q.length < 2) return []
    const wr = (allWR || []).filter(l => {
      const hay = `${l.name || ''} ${l.body_of_water || ''} ${l.location_description || ''} ${l.organization_name || ''} ${l.country || ''}`.toLowerCase()
      return hay.includes(q)
    }).slice(0, 12).map(l => ({
      kind: 'wr',
      id: l.id,
      name: l.name,
      sub: [l.body_of_water || l.location_description, l.organization_name, l.country].filter(Boolean).join(' · ') || 'Water Rangers site',
    }))
    const localMatches = localSites.filter(s => {
      const hay = `${s.name || ''} ${s.location || ''} ${s.body_of_water || ''}`.toLowerCase()
      return hay.includes(q)
    }).slice(0, 6).map(s => ({
      kind: 'local',
      id: s.id,
      name: s.name,
      sub: s.location || (s.external_source === 'waterrangers' ? 'Adopted from Water Rangers' : 'Local site'),
    }))
    return [...localMatches, ...wr]
  })()

  const goSearch = (q) => {
    if (!q) return
    setSearchOpen(false)
    navigate(`/monitoring?q=${encodeURIComponent(q)}`)
  }
  const onPickResult = (r) => {
    setSearchOpen(false)
    setSearchVal(r.name)
    navigate(`/monitoring?q=${encodeURIComponent(r.name)}`)
  }
  const onSearchKey = (e) => {
    if (e.key === 'Enter') { e.preventDefault(); goSearch(searchVal) }
    if (e.key === 'Escape') setSearchOpen(false)
  }

  // Click outside the search dropdown to close it
  useEffect(() => {
    const onDocDown = (e) => {
      if (searchBoxRef.current && !searchBoxRef.current.contains(e.target)) setSearchOpen(false)
    }
    document.addEventListener('mousedown', onDocDown)
    return () => document.removeEventListener('mousedown', onDocDown)
  }, [])

  // Apply animation pref on mount + whenever it changes
  useEffect(() => { applyAnimPref(animOff) }, [animOff])

  // Poll unread every 5s so badge stays live
  useEffect(() => {
    const fetchUnread = () => api.get('/messages/unread/count').then(r => setUnread(r.data.count || 0)).catch(() => {})
    fetchUnread()
    const iv = setInterval(() => {
      if (document.visibilityState === 'visible') fetchUnread()
    }, 30000)
    return () => clearInterval(iv)
  }, [])

  useEffect(() => {
    const handler = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setShowUserMenu(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <header
      className="fixed top-0 right-0 flex items-center gap-3 px-4 border-b z-30 transition-all duration-300"
      style={{
        left: sidebarWidth,
        background: 'var(--card-bg)',
        borderColor: 'var(--border)',
        height: 56,
      }}
    >
      {/* SOURCE Water team logo — left of search bar */}
      <div className="flex items-center flex-shrink-0" style={{ height: 56 }}>
        <img src="/logos/source-water.png" alt="SOURCE Water"
          style={{ height: 46, width: 'auto', objectFit: 'contain', display: 'block' }}/>
      </div>

      {/* Search bar — typeahead across the 9,400+ Water Rangers network + adopted sites.
          Lazy-loads on first focus; Enter or click jumps to /monitoring with the query applied. */}
      <div className="flex-1 max-w-md relative" ref={searchBoxRef}>
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-light)' }}/>
        <input
          value={searchVal}
          onChange={e => { setSearchVal(e.target.value); setSearchOpen(true) }}
          onFocus={() => { ensureSiteIndex(); setSearchOpen(true) }}
          onKeyDown={onSearchKey}
          placeholder={allWR === null ? 'Search any site (9,400+ Water Rangers + adopted)…' : 'Search a lake, river, community, organization…'}
          style={{ paddingLeft: 36, background: 'var(--page-bg)', border: '1px solid var(--border)', color: 'var(--text)' }}
          className="text-sm py-2 rounded-xl w-full"
        />
        {searchOpen && (searchVal.trim().length >= 2 || searchLoading || allWR === null) && (
          <div
            className="absolute left-0 right-0 mt-1 rounded-xl shadow-xl border z-50 overflow-hidden"
            style={{ background: 'var(--card-bg)', borderColor: 'var(--border)', maxHeight: 380 }}
          >
            {searchLoading && allWR === null && (
              <div style={{ padding: '12px 14px', fontSize: 12, color: 'var(--text-muted)' }}>
                Loading 9,400+ Water Rangers sites…
              </div>
            )}
            {!searchLoading && searchVal.trim().length < 2 && (
              <div style={{ padding: '12px 14px', fontSize: 12, color: 'var(--text-muted)' }}>
                Type at least 2 characters to search any site across the Water Rangers network.
              </div>
            )}
            {searchVal.trim().length >= 2 && (
              <div style={{ maxHeight: 340, overflowY: 'auto' }}>
                {searchResults.length === 0 ? (
                  <div style={{ padding: '12px 14px', fontSize: 12, color: 'var(--text-muted)' }}>
                    No sites match "{searchVal}".
                  </div>
                ) : searchResults.map(r => (
                  <button
                    key={`${r.kind}-${r.id}`}
                    onMouseDown={(e) => { e.preventDefault(); onPickResult(r) }}
                    style={{
                      display: 'flex', width: '100%', alignItems: 'center', justifyContent: 'space-between',
                      padding: '8px 12px', textAlign: 'left', border: 'none', borderBottom: '1px solid var(--border)',
                      background: 'transparent', cursor: 'pointer', color: 'var(--text)',
                    }}
                  >
                    <span style={{ minWidth: 0, overflow: 'hidden' }}>
                      <div style={{ fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {r.name}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {r.sub}
                      </div>
                    </span>
                    <span style={{
                      fontSize: 9, fontWeight: 800, padding: '2px 7px', borderRadius: 20, marginLeft: 8, flexShrink: 0,
                      background: r.kind === 'wr' ? 'rgba(14,165,233,0.12)' : 'rgba(99,102,241,0.12)',
                      color: r.kind === 'wr' ? '#0ea5e9' : '#6366f1',
                      letterSpacing: '0.04em',
                    }}>
                      {r.kind === 'wr' ? 'WR' : 'ADOPTED'}
                    </span>
                  </button>
                ))}
                <button
                  onMouseDown={(e) => { e.preventDefault(); goSearch(searchVal) }}
                  style={{
                    display: 'flex', width: '100%', alignItems: 'center', justifyContent: 'space-between',
                    padding: '9px 12px', textAlign: 'left', border: 'none',
                    background: 'rgba(99,102,241,0.06)', cursor: 'pointer', color: '#6366f1', fontSize: 11, fontWeight: 700,
                  }}
                >
                  <span>Open Site Map filtered by "{searchVal}"</span>
                  <span style={{ fontSize: 10, opacity: 0.8 }}>↵</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center gap-1 ml-auto">
        {/* Live badge */}
        <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full mr-1"
          style={{ background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"/>
          <CMSField page="global" block="topbar" field="liveBadge" default="Live"
            style={{ color: '#15803d', fontSize: 12, fontWeight: 700 }}/>
        </div>

        {/* CMS toggle — admin only */}
        {user?.is_admin && (
          <button
            onClick={toggleCmsMode}
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all mr-1"
            style={{
              background: cmsMode ? 'linear-gradient(135deg,#6366f1,#4f46e5)' : 'var(--page-bg)',
              color: cmsMode ? 'white' : 'var(--text-muted)',
              border: cmsMode ? 'none' : '1px solid var(--border)',
              boxShadow: cmsMode ? '0 2px 8px rgba(99,102,241,0.3)' : 'none',
            }}
          >
            <Edit3 className="w-3 h-3"/>
            {cmsMode ? 'Editing' : 'Edit Mode'}
          </button>
        )}

        <button onClick={() => { play('click'); toggleSound() }}
          className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
          title={enabled ? 'Mute sound' : 'Enable sound'}>
          {enabled ? <Volume2 className="w-4 h-4" style={{ color: 'var(--text-muted)' }}/> : <VolumeX className="w-4 h-4" style={{ color: 'var(--text-light)' }}/>}
        </button>

        <button onClick={() => { play('click'); setAnimOff(o => !o) }}
          className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
          aria-label={animOff ? 'Turn animations on' : 'Turn animations off'}
          title={animOff ? 'Animations OFF — click to enable' : 'Turn animations OFF'}>
          {animOff
            ? <ZapOff className="w-4 h-4" style={{ color: '#ef4444' }}/>
            : <Zap className="w-4 h-4" style={{ color: 'var(--text-muted)' }}/>}
        </button>

        <button onClick={() => { play('click'); onA11yClick() }}
          className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
          title="Accessibility">
          <Accessibility className="w-4 h-4" style={{ color: 'var(--text-muted)' }}/>
        </button>

        <button onClick={() => { play('click'); onOpenDM ? onOpenDM() : navigate('/social?dm=1') }} className="relative p-2 rounded-lg hover:bg-gray-100 transition-colors" title={unread > 0 ? `${unread} unread message${unread > 1 ? 's' : ''}` : 'Messages'}>
          <Bell className="w-4 h-4" style={{ color: unread > 0 ? '#6366f1' : 'var(--text-muted)' }}/>
          {unread > 0 && (
            <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold animate-pulse">
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </button>

        {/* User menu */}
        <div className="relative ml-1" ref={menuRef}>
          <button onClick={() => setShowUserMenu(s => !s)}
            className="flex items-center gap-2 pl-1 pr-2 py-1 rounded-xl hover:bg-gray-100 transition-colors">
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm"
              style={{ background: 'linear-gradient(135deg,#6366f1,#14b8a6)' }}>
              {user?.display_name?.[0]?.toUpperCase() || user?.username?.[0]?.toUpperCase() || '?'}
            </div>
            <div className="hidden sm:block text-left">
              <div className="text-sm font-semibold leading-tight" style={{ color: 'var(--text)' }}>
                {user?.display_name || user?.username}
              </div>
            </div>
            <ChevronDown className="w-3.5 h-3.5 hidden sm:block" style={{ color: 'var(--text-light)' }}/>
          </button>

          {showUserMenu && (
            <div className="absolute top-full right-0 mt-1 w-44 rounded-xl shadow-xl border py-1 z-50"
              style={{ background: 'var(--card-bg)', borderColor: 'var(--border)' }}>
              <button onClick={() => { navigate('/profile'); setShowUserMenu(false) }}
                className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-gray-50 transition-colors"
                style={{ color: 'var(--text)' }}>
                👤 Profile
              </button>
              <button onClick={() => { toggleMode(); setShowUserMenu(false) }}
                className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-gray-50 transition-colors"
                style={{ color: 'var(--text)' }}>
                {isDark ? '☀️' : '🌙'} {isDark ? 'Light mode' : 'Dark mode'}
              </button>
              {user?.is_admin && (
                <button onClick={() => { navigate('/admin'); setShowUserMenu(false) }}
                  className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-gray-50 transition-colors"
                  style={{ color: 'var(--text)' }}>
                  🛡️ Admin Panel
                </button>
              )}
              <div style={{ height: 1, background: 'var(--border)', margin: '4px 8px' }} />
              <button onClick={async () => { setShowUserMenu(false); await logout(); navigate('/') }}
                className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-red-50 transition-colors"
                style={{ color: '#ef4444' }}>
                <LogOut className="w-3.5 h-3.5"/> Sign Out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
