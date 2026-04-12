import { useState } from 'react'
import api from '../../utils/api'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useSound } from '../../context/SoundContext'
import { useTheme, THEMES } from '../../context/ThemeContext'
import {
  LayoutDashboard, Sparkles, Map, BellRing, FileBarChart2,
  Users, BookOpen, GraduationCap, LineChart, FlaskConical,
  CloudSun, Joystick, ShieldCheck, LogOut, ChevronDown,
  ChevronLeft, ChevronRight, Droplets, Building2, Circle,
  UserCircle, Microscope
} from 'lucide-react'

const NAV = [
  { section: 'OVERVIEW' },
  { label: 'Dashboard',       icon: LayoutDashboard, path: '/dashboard',  color: '#006fbf' },
  { label: 'Ask Water AI',    icon: Sparkles,        path: '/ask-water',  color: '#8b5cf6' },
  { label: 'Live Map',        icon: Map,             path: '/map',        color: '#14b8a6' },
  { label: 'Alerts',          icon: BellRing,        path: '/alerts',     color: '#f59e0b' },
  { label: 'Reports',         icon: FileBarChart2,   path: '/reports',    color: '#0ea5e9' },
  { label: 'Community',       icon: Users,           path: '/social',     color: '#ec4899' },
  { section: 'LEARNING' },
  { label: 'Resources',       icon: BookOpen,        path: '/resources',  color: '#10b981' },
  { label: 'Quiz & Learn',    icon: GraduationCap,   path: '/quiz',       color: '#f97316' },
  { section: 'RESEARCH' },
  { label: 'Data Analysis',   icon: LineChart,       path: '/analysis',   color: '#006fbf' },
  { label: 'Research Hub',    icon: Microscope,      path: '/research',   color: '#a855f7' },
  { label: 'Projects',        icon: FlaskConical,    path: '/projects',   color: '#14b8a6' },
  { label: 'Weather',         icon: CloudSun,        path: '/weather',    color: '#0ea5e9' },
  { section: null },
  { label: 'Games',           icon: Joystick,        path: '/games',      color: '#a855f7' },
]

function NavSection({ label }) {
  return (
    <div className="px-4 pt-5 pb-1.5 flex items-center gap-2">
      <span className="text-xs font-bold uppercase tracking-widest" style={{ color: '#2d3f5a', letterSpacing: '0.12em' }}>
        {label}
      </span>
      <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.04)' }}/>
    </div>
  )
}

// Shows only when logged-in user is NOT admin; lets first user claim admin if no admin exists
function ClaimAdminButton({ collapsed }) {
  const [claiming, setClaiming] = useState(false)
  const [hidden, setHidden] = useState(false)
  if (hidden) return null

  const claim = async () => {
    if (!confirm('Claim admin access? This only works if no admin exists yet in the system.')) return
    setClaiming(true)
    try {
      const r = await api.post('/auth/bootstrap-admin')
      alert(r.data.message || 'You are now admin! Refreshing…')
      window.location.reload()
    } catch (e) {
      const msg = e.response?.data?.error || 'Failed'
      if (msg.includes('already exists')) {
        alert('An admin already exists. Ask them to promote you via Admin Panel → Users.')
        setHidden(true)
      } else {
        alert(msg)
      }
    }
    setClaiming(false)
  }

  return (
    <div style={{ padding: collapsed ? '4px 0' : '4px 12px', marginBottom: 4 }}>
      <button onClick={claim} disabled={claiming} title="Claim admin (only works if no admin exists yet)"
        style={{
          width: '100%', padding: collapsed ? '8px 0' : '8px 12px',
          borderRadius: 8, border: '1px dashed rgba(0,111,191,0.4)',
          background: 'rgba(0,111,191,0.06)', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: collapsed ? 'center' : 'flex-start',
          gap: 8, fontSize: 12, color: '#4db6f5', fontWeight: 600,
        }}>
        <ShieldCheck style={{ width: 14, height: 14, flexShrink: 0 }}/>
        {!collapsed && (claiming ? 'Claiming…' : 'Claim Admin')}
      </button>
    </div>
  )
}

export default function Sidebar({ collapsed, onToggle }) {
  const { user, logout, isAdmin, isQuizCreator } = useAuth()
  const { play } = useSound()
  const { colorKey, setColorKey, mode, toggleMode, themes } = useTheme()
  const location = useLocation()
  const navigate = useNavigate()
  const [showThemePicker, setShowThemePicker] = useState(false)

  const go = (path) => { play('click'); navigate(path) }
  const theme = themes[colorKey]

  return (
    <aside
      data-sidebar
      className="fixed top-0 left-0 h-screen flex flex-col transition-all duration-300 z-40"
      style={{
        width: collapsed ? 60 : 244,
        background: 'linear-gradient(180deg, #060e1d 0%, #0a1628 40%, #0d1f3c 100%)',
        borderRight: '1px solid rgba(255,255,255,0.05)',
        overflow: 'hidden',
      }}>

      {/* Subtle top glow */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 120,
        background: 'radial-gradient(ellipse 80% 100% at 50% 0%, rgba(0,111,191,0.12) 0%, transparent 100%)',
        pointerEvents: 'none',
      }}/>

      {/* Logo + collapse toggle */}
      <div className="flex items-center gap-3 flex-shrink-0"
        style={{
          padding: collapsed ? '14px 0' : '14px 16px',
          justifyContent: collapsed ? 'center' : 'flex-start',
          borderBottom: '1px solid rgba(255,255,255,0.04)',
          minHeight: 60,
        }}>
        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: 'linear-gradient(135deg, #006fbf, #14b8a6)', boxShadow: '0 4px 12px rgba(0,111,191,0.4)' }}>
          <Droplets className="w-5 h-5 text-white"/>
        </div>
        {!collapsed && (
          <>
            <div className="flex-1 min-w-0">
              <div className="font-bold text-base text-white leading-tight">SOURCE Water</div>
              <div className="text-xs leading-tight" style={{ color: '#3d5273' }}>Environmental Intelligence</div>
            </div>
            <button onClick={onToggle}
              className="p-1 rounded-md transition-colors flex-shrink-0"
              style={{ color: '#2d3f5a' }}
              onMouseEnter={e => e.currentTarget.style.color = '#94a3b8'}
              onMouseLeave={e => e.currentTarget.style.color = '#2d3f5a'}>
              <ChevronLeft className="w-4 h-4"/>
            </button>
          </>
        )}
        {collapsed && (
          <button onClick={onToggle}
            title="Expand sidebar (click or press)"
            className="p-2 rounded-md transition-all hover:scale-110 expand-hint"
            style={{ 
              color: '#64748b',
              background: 'rgba(0,111,191,0.15)',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.color = '#00d9ff'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.color = '#64748b'
            }}>
            <ChevronRight className="w-5 h-5"/>
          </button>
        )}
      </div>

      {/* Nav items */}
      <nav className="flex-1 overflow-y-auto py-2 relative z-10" style={{ scrollbarWidth: 'thin', scrollbarColor: '#2d3f5a #0d1f3c' }}>
        {NAV.map((item, i) => {
          if (item.section !== undefined && item.section !== null) {
            return collapsed
              ? <div key={i} className="my-2 mx-3" style={{ height: 1, background: 'rgba(255,255,255,0.04)' }}/>
              : <NavSection key={i} label={item.section}/>
          }
          if (item.section === null) return null

          const active = location.pathname === item.path
          const Icon = item.icon
          return (
            <button key={item.path + i} onClick={() => go(item.path)}
              title={collapsed ? item.label : undefined}
              className="group flex items-center gap-3 w-full text-left transition-all duration-150 relative"
              style={{
                padding: collapsed ? '10px 0' : '9px 12px',
                justifyContent: collapsed ? 'center' : 'flex-start',
                margin: '1px 8px',
                width: 'calc(100% - 16px)',
                borderRadius: 10,
                background: active ? 'rgba(0,111,191,0.14)' : 'transparent',
              }}
              onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'rgba(255,255,255,0.04)' }}
              onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent' }}>

              {/* Active left bar */}
              {active && !collapsed && (
                <div style={{
                  position: 'absolute', left: 0, top: '20%', bottom: '20%',
                  width: 3, borderRadius: '0 3px 3px 0',
                  background: item.color || '#006fbf',
                }}/>
              )}

              {/* Icon wrapper */}
              <div className="flex items-center justify-center flex-shrink-0 rounded-lg transition-all duration-150"
                style={{
                  width: 32, height: 32,
                  background: active ? `${item.color}22` : 'transparent',
                  color: active ? item.color : '#3d5273',
                }}>
                <Icon className="w-[17px] h-[17px]" style={{
                  color: active ? item.color : '#3d5273',
                  transition: 'color 0.15s',
                }}/>
              </div>

              {!collapsed && (
                <span className="text-sm font-medium truncate transition-colors duration-150"
                  style={{ color: active ? '#e2e8f0' : '#64748b' }}>
                  {item.label}
                </span>
              )}

              {/* Active dot */}
              {active && !collapsed && (
                <div className="ml-auto flex-shrink-0" style={{
                  width: 6, height: 6, borderRadius: '50%',
                  background: item.color, boxShadow: `0 0 8px ${item.color}`,
                }}/>
              )}
            </button>
          )
        })}

        {/* Quiz Manager (for all creator roles) */}
        {isQuizCreator && (
          <button onClick={() => go('/quiz-admin')}
            title={collapsed ? 'Quiz Manager' : undefined}
            className="flex items-center gap-3 w-full text-left transition-all duration-150"
            style={{
              padding: collapsed ? '10px 0' : '9px 12px',
              justifyContent: collapsed ? 'center' : 'flex-start',
              margin: '1px 8px',
              width: 'calc(100% - 16px)',
              borderRadius: 10,
              background: location.pathname === '/quiz-admin' ? 'rgba(249,115,22,0.14)' : 'transparent',
            }}
            onMouseEnter={e => { if (location.pathname !== '/quiz-admin') e.currentTarget.style.background = 'rgba(255,255,255,0.04)' }}
            onMouseLeave={e => { if (location.pathname !== '/quiz-admin') e.currentTarget.style.background = 'transparent' }}>
            <div className="flex items-center justify-center flex-shrink-0 rounded-lg"
              style={{
                width: 32, height: 32,
                background: location.pathname === '/quiz-admin' ? 'rgba(249,115,22,0.22)' : 'transparent',
                color: location.pathname === '/quiz-admin' ? '#fb923c' : '#3d5273',
              }}>
              <GraduationCap className="w-[17px] h-[17px]"/>
            </div>
            {!collapsed && (
              <span className="text-sm font-medium" style={{ color: location.pathname === '/quiz-admin' ? '#e2e8f0' : '#64748b' }}>
                Quiz Manager
              </span>
            )}
          </button>
        )}

        {/* Claim admin — only shown to users whose username contains "admin" and aren't admin yet */}
        {!isAdmin && user && user.username?.toLowerCase().includes('admin') && (
          <ClaimAdminButton/>
        )}

        {/* Admin */}
        {isAdmin && (
          <>
            {!collapsed && <NavSection label="ADMIN"/>}
            {collapsed && <div className="my-2 mx-3" style={{ height: 1, background: 'rgba(255,255,255,0.04)' }}/>}
            <button onClick={() => go('/admin')}
              title={collapsed ? 'Admin Panel' : undefined}
              className="flex items-center gap-3 w-full text-left transition-all duration-150"
              style={{
                padding: collapsed ? '10px 0' : '9px 12px',
                justifyContent: collapsed ? 'center' : 'flex-start',
                margin: '1px 8px',
                width: 'calc(100% - 16px)',
                borderRadius: 10,
                background: location.pathname === '/admin' ? 'rgba(0,111,191,0.14)' : 'transparent',
              }}
              onMouseEnter={e => { if (location.pathname !== '/admin') e.currentTarget.style.background = 'rgba(255,255,255,0.04)' }}
              onMouseLeave={e => { if (location.pathname !== '/admin') e.currentTarget.style.background = 'transparent' }}>
              <div className="flex items-center justify-center flex-shrink-0 rounded-lg"
                style={{
                  width: 32, height: 32,
                  background: location.pathname === '/admin' ? 'rgba(0,111,191,0.22)' : 'transparent',
                  color: location.pathname === '/admin' ? '#4db6f5' : '#3d5273',
                }}>
                <ShieldCheck className="w-[17px] h-[17px]"/>
              </div>
              {!collapsed && (
                <span className="text-sm font-medium" style={{ color: location.pathname === '/admin' ? '#e2e8f0' : '#64748b' }}>
                  Admin Panel
                </span>
              )}
            </button>
          </>
        )}
      </nav>

      {/* Footer */}
      {!collapsed && (
        <div className="flex-shrink-0 p-3 space-y-1 relative z-10"
          style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>

          {/* User */}
          <button onClick={() => go('/profile')}
            className="flex items-center gap-2.5 w-full p-2.5 rounded-xl transition-all text-left"
            style={{ background: 'rgba(255,255,255,0.03)' }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}
            onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}>
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
              style={{ background: 'linear-gradient(135deg, #006fbf, #14b8a6)', boxShadow: '0 2px 8px rgba(0,111,191,0.3)' }}>
              {user?.display_name?.[0]?.toUpperCase() || user?.username?.[0]?.toUpperCase() || '?'}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold text-white truncate leading-tight">{user?.display_name || user?.username}</div>
              <div className="text-xs truncate leading-tight capitalize" style={{ color: '#3d5273' }}>
                {user?.role?.replace(/_/g,' ') || 'Community member'}
              </div>
            </div>
            <UserCircle className="w-3.5 h-3.5 flex-shrink-0" style={{ color: '#2d3f5a' }}/>
          </button>

          {/* Org */}
          <div className="px-2.5 py-3 rounded-xl flex items-center gap-2" style={{ background: 'rgba(255,255,255,0.02)' }}>
            <Building2 className="w-3 h-3 flex-shrink-0" style={{ color: '#2d3f5a' }}/>
            <div className="min-w-0">
              <div className="text-xs font-semibold text-white/60 leading-tight">Managed by:</div>
              <div className="text-xs font-bold leading-tight text-white">NORDIK Institute</div>
              <div className="text-xs leading-tight" style={{ color: '#2d3f5a' }}>Algoma University</div>
            </div>
          </div>

          {/* Theme picker */}
          <div className="relative">
            <button onClick={() => setShowThemePicker(s => !s)}
              className="flex items-center gap-2 w-full px-2.5 py-2 rounded-xl transition-all"
              style={{ background: 'rgba(255,255,255,0.02)' }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
              onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}>
              <div className="w-3.5 h-3.5 rounded-full flex-shrink-0"
                style={{ background: `linear-gradient(135deg, ${theme?.primary}, ${theme?.secondary})`, boxShadow: `0 0 6px ${theme?.primary}80` }}/>
              <span className="text-xs flex-1 text-left" style={{ color: '#3d5273' }}>{theme?.name || 'Ocean Blue'}</span>
              <ChevronDown className="w-3 h-3 flex-shrink-0" style={{ color: '#2d3f5a' }}/>
            </button>
            {showThemePicker && (
              <div className="absolute bottom-full left-0 right-0 mb-2 rounded-xl p-2 shadow-2xl z-50"
                style={{ background: '#0d1f3c', border: '1px solid rgba(255,255,255,0.08)' }}>
                {Object.entries(THEMES).map(([key, t]) => (
                  <button key={key} onClick={() => { setColorKey(key); setShowThemePicker(false) }}
                    className="flex items-center gap-2 w-full px-2.5 py-2 rounded-lg transition-all text-left"
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    <div className="w-3.5 h-3.5 rounded-full flex-shrink-0"
                      style={{ background: `linear-gradient(135deg, ${t.primary}, ${t.secondary})` }}/>
                    <span className="text-xs text-white flex-1">{t.name}</span>
                    {colorKey === key && <Circle className="w-2 h-2 fill-indigo-400 text-indigo-400"/>}
                  </button>
                ))}
                <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: '6px 4px' }}/>
                <button onClick={toggleMode}
                  className="flex items-center gap-2 w-full px-2.5 py-2 rounded-lg transition-all"
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <span className="text-sm">{mode === 'dark' ? '☀️' : '🌙'}</span>
                  <span className="text-xs text-white/70">{mode === 'dark' ? 'Light mode' : 'Dark mode'}</span>
                </button>
              </div>
            )}
          </div>

          {/* Sign out */}
          <button onClick={() => { play('click'); logout() }}
            className="flex items-center gap-2 w-full px-2.5 py-2 rounded-xl transition-all text-left"
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.08)'; e.currentTarget.style.color = '#ef4444' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#2d3f5a' }}
            style={{ color: '#2d3f5a' }}>
            <LogOut className="w-3.5 h-3.5 flex-shrink-0"/>
            <span className="text-xs font-medium">Sign out</span>
          </button>
        </div>
      )}

      {/* Collapsed footer */}
      {collapsed && (
        <div className="p-3 flex-shrink-0" style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
          <button onClick={() => go('/profile')}
            className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-sm mx-auto"
            style={{ background: 'linear-gradient(135deg, #006fbf, #14b8a6)' }}>
            {user?.display_name?.[0]?.toUpperCase() || '?'}
          </button>
        </div>
      )}
    </aside>
  )
}
