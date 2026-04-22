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
      <div className="flex items-center flex-shrink-0" style={{ height: 40 }}>
        <img src="/logos/source-water.png" alt="SOURCE Water"
          style={{ height: 36, width: 'auto', objectFit: 'contain' }}/>
      </div>

      {/* Search bar — narrower to make room for the logo */}
      <div className="flex-1 max-w-xs relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-light)' }}/>
        <input
          value={searchVal}
          onChange={e => setSearchVal(e.target.value)}
          placeholder="Search..."
          style={{ paddingLeft: 36, background: 'var(--page-bg)', border: '1px solid var(--border)', color: 'var(--text)' }}
          className="text-sm py-2 rounded-xl w-full"
        />
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
