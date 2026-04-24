import { useState, useEffect } from 'react'
import api from '../../utils/api'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useSound } from '../../context/SoundContext'
import { useTheme, THEMES } from '../../context/ThemeContext'
import {
  LayoutDashboard, Sparkles, Map, BellRing, FileBarChart2,
  Users, BookOpen, GraduationCap, LineChart, FlaskConical,
  CloudSun, Joystick, ShieldCheck, LogOut, ChevronDown,
  ChevronLeft, ChevronRight, Droplets, Circle,
  UserCircle, Microscope, Compass, Satellite, BookMarked, Info, Handshake
} from 'lucide-react'

/* ─── Nav structure ─────────────────────────────────────────────── */
const NAV_GROUPS = [
  {
    id: 'OVERVIEW',
    label: 'Overview',
    emoji: '🌐',
    defaultOpen: true,
    items: [
      { label: 'Quick Actions',  icon: Compass,        path: '/quick-actions', color: '#f59e0b', sub: 'Explore pathways' },
      { label: 'Dashboard',      icon: LayoutDashboard, path: '/dashboard',    color: '#3b82f6', sub: 'Key metrics · AI' },
      { label: 'Ask Water (AI)', icon: Sparkles,        path: '/ask-water',    color: '#8b5cf6', sub: 'Chat · scan · analyze' },
      { label: 'Site Map',       icon: Map,             path: '/monitoring',   color: '#14b8a6', sub: 'Explore live data' },
      { label: 'Alerts',         icon: BellRing,        path: '/alerts',       color: '#f59e0b', sub: 'Threshold warnings' },
      { label: 'Community',      icon: Users,           path: '/social',       color: '#ec4899', sub: 'Posts · DMs · leaders' },
    ],
  },
  {
    id: 'LEARNING',
    label: 'Learning',
    emoji: '📚',
    defaultOpen: false,
    color: '#10b981',
    items: [
      {
        label: 'Resources',
        icon: BookOpen,
        path: '/resources',
        color: '#10b981',
        sub: 'Guides · articles · links',
      },
      {
        label: 'Quiz Yourself',
        icon: GraduationCap,
        path: '/quiz',
        color: '#f97316',
        sub: 'Assess learning · earn points',
      },
      {
        label: 'Games',
        icon: Joystick,
        path: '/games',
        color: '#a855f7',
        sub: 'Fun for all',
      },
    ],
  },
  {
    id: 'RESEARCH',
    label: 'Research',
    emoji: '🔬',
    defaultOpen: false,
    color: '#a855f7',
    items: [
      { label: 'Dive into Data',    icon: LineChart,    path: '/explorer',   color: '#14b8a6', sub: 'Observation details' },
      { label: 'Wet Lab',           icon: FlaskConical, path: '/ai-lab',     color: '#a855f7', sub: 'Reports · Advanced AI' },
      { label: 'World Environment', icon: CloudSun,     path: '/weather',    color: '#0ea5e9', sub: 'Live conditions' },
    ],
  },
  {
    id: 'ABOUT',
    label: 'About Us',
    emoji: 'ℹ️',
    defaultOpen: false,
    color: '#94a3b8',
    items: [
      { label: 'Storyline',     icon: BookMarked, path: '/about/storyline',     color: '#64748b', sub: 'Our team history' },
      { label: 'This Platform', icon: Info,       path: '/about/this-platform', color: '#64748b', sub: 'Relating with Water' },
      { label: 'Collaborators', icon: Handshake,  path: '/about/collaborators', color: '#64748b', sub: 'Partners · funders · sponsors' },
    ],
  },
]

const STANDALONE = []

/* ─── Claim-admin helper ─────────────────────────────────────────── */
// Only renders when the server confirms no admin exists yet. This stops the
// button from showing up for regular users whose username happens to contain
// the substring "admin" (e.g. "Testeadmin001").
function ClaimAdminButton({ collapsed }) {
  const [claiming, setClaiming] = useState(false)
  const [hidden, setHidden] = useState(true) // hide by default until we confirm

  useEffect(() => {
    let cancelled = false
    api.get('/auth/admin-exists')
      .then(r => { if (!cancelled) setHidden(r.data?.exists !== false) })
      .catch(() => { if (!cancelled) setHidden(true) })
    return () => { cancelled = true }
  }, [])

  if (hidden) return null

  const claim = async () => {
    if (!confirm('Claim admin access? This only works if no admin exists yet.')) return
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
      } else alert(msg)
    }
    setClaiming(false)
  }

  return (
    <div style={{ padding: collapsed ? '4px 0' : '4px 12px', marginBottom: 4 }}>
      <button onClick={claim} disabled={claiming} title="Claim admin"
        style={{
          width: '100%', padding: collapsed ? '8px 0' : '8px 12px',
          borderRadius: 8, border: '1px dashed rgba(0,111,191,0.4)',
          background: 'rgba(0,111,191,0.06)', cursor: 'pointer',
          display: 'flex', alignItems: 'center',
          justifyContent: collapsed ? 'center' : 'flex-start',
          gap: 8, fontSize: 12, color: '#4db6f5', fontWeight: 600,
        }}>
        <ShieldCheck style={{ width: 14, height: 14, flexShrink: 0 }}/>
        {!collapsed && (claiming ? 'Claiming…' : 'Claim Admin')}
      </button>
    </div>
  )
}

/* ─── Single nav item ────────────────────────────────────────────── */
function NavItem({ item, active, collapsed, onClick, onSubNav }) {
  const [hov, setHov] = useState(false)
  const Icon = item.icon
  const hasQuickLinks = item.quickLinks?.length > 0

  return (
    <div>
      <button
        onClick={() => onClick(item.path)}
        title={collapsed ? item.label : undefined}
        onMouseEnter={() => setHov(true)}
        onMouseLeave={() => setHov(false)}
        style={{
          position: 'relative',
          display: 'flex', alignItems: 'center',
          gap: 10, textAlign: 'left',
          padding: collapsed ? '9px 0' : '8px 10px',
          justifyContent: collapsed ? 'center' : 'flex-start',
          margin: '1px 6px',
          width: collapsed ? 'calc(100% - 0px)' : 'calc(100% - 12px)',
          borderRadius: 10,
          border: active ? `1px solid ${item.color}30` : '1px solid transparent',
          background: active
            ? `linear-gradient(90deg, ${item.color}18 0%, transparent 100%)`
            : hov ? 'rgba(255,255,255,0.05)' : 'transparent',
          transition: 'all 0.18s ease',
          cursor: 'pointer',
          overflow: 'hidden',
        }}>

        {/* Glow bar left edge */}
        <div style={{
          position: 'absolute', left: 0, top: '15%', bottom: '15%',
          width: active ? 3 : hov ? 2 : 0,
          borderRadius: '0 3px 3px 0',
          background: item.color,
          boxShadow: active ? `0 0 10px ${item.color}` : 'none',
          transition: 'all 0.2s ease',
        }}/>

        {/* Icon */}
        <div style={{
          width: 32, height: 32, borderRadius: 9, flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: active ? `${item.color}22` : hov ? `${item.color}10` : 'transparent',
          boxShadow: active ? `0 0 12px ${item.color}40` : 'none',
          transition: 'all 0.18s ease',
          transform: hov ? 'scale(1.08)' : 'scale(1)',
        }}>
          <Icon style={{
            width: 16, height: 16,
            color: active ? item.color : hov ? `${item.color}cc` : '#4a6080',
            transition: 'color 0.18s',
          }}/>
        </div>

        {!collapsed && (
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontSize: 13, fontWeight: active ? 700 : 500,
              color: active ? '#e2e8f0' : hov ? '#c0cedf' : '#6b8299',
              transition: 'color 0.18s', lineHeight: 1.2, letterSpacing: '0.01em',
            }}>
              {item.label}
            </div>
            <div style={{
              fontSize: 10, color: active ? '#ffffff' : hov ? 'rgba(255,255,255,0.75)' : 'rgba(255,255,255,0.55)',
              marginTop: 1, lineHeight: 1.2, letterSpacing: '0.02em',
              transition: 'color 0.18s',
              opacity: hov || active ? 1 : 0.85,
            }}>
              {item.sub}
            </div>
          </div>
        )}

        {/* Active dot */}
        {active && !collapsed && (
          <div style={{
            width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
            background: item.color,
            boxShadow: `0 0 8px ${item.color}, 0 0 16px ${item.color}60`,
            animation: 'sbPulse 2s ease-in-out infinite',
          }}/>
        )}
      </button>

      {/* Quick links (only when expanded sidebar, only when item is active or hovered) */}
      {!collapsed && hasQuickLinks && (active || hov) && (
        <div style={{
          margin: '2px 6px 4px 16px',
          display: 'flex', flexWrap: 'wrap', gap: 4,
          animation: 'sbFadeIn 0.2s ease',
        }}>
          {item.quickLinks.map(ql => (
            <button key={ql.path + ql.label} onClick={e => { e.stopPropagation(); onSubNav(ql.path) }}
              style={{
                fontSize: 10, fontWeight: 600, padding: '3px 8px',
                borderRadius: 20, border: `1px solid ${item.color}40`,
                background: `${item.color}12`, color: `${item.color}cc`,
                cursor: 'pointer', transition: 'all 0.15s',
                letterSpacing: '0.03em',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = `${item.color}28`; e.currentTarget.style.color = item.color }}
              onMouseLeave={e => { e.currentTarget.style.background = `${item.color}12`; e.currentTarget.style.color = `${item.color}cc` }}>
              {ql.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/* ─── Section group ─────────────────────────────────────────────── */
function SectionGroup({ group, open, onToggle, location, navigate, collapsed }) {
  const anyActive = group.items.some(i => location.pathname === i.path)
  const count = group.items.length

  return (
    <div style={{ marginBottom: 2 }}>

      {/* Section header (only in expanded sidebar) */}
      {!collapsed && (
        <button onClick={onToggle}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            width: '100%', padding: '6px 10px 5px 10px',
            background: 'transparent', border: 'none', cursor: 'pointer',
            borderRadius: 6,
          }}
          onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>

          <span style={{
            fontSize: 9.5, fontWeight: 800, letterSpacing: '0.14em',
            color: anyActive ? (group.color || '#4db6f5') : '#2d4260',
            textTransform: 'uppercase', flex: 1, textAlign: 'left',
            transition: 'color 0.2s',
          }}>
            {group.label}
          </span>

          {/* Item count badge */}
          {!open && (
            <span style={{
              fontSize: 9, fontWeight: 700, padding: '1px 6px',
              borderRadius: 10, background: 'rgba(255,255,255,0.06)',
              color: '#2d4260', letterSpacing: '0.04em',
            }}>{count}</span>
          )}

          {/* Active dot on section header */}
          {anyActive && open && (
            <div style={{
              width: 5, height: 5, borderRadius: '50%',
              background: group.color || '#4db6f5',
              boxShadow: `0 0 6px ${group.color || '#4db6f5'}`,
            }}/>
          )}

          <div style={{
            width: 14, height: 14, color: '#2d4260',
            transition: 'transform 0.25s ease, color 0.2s',
            transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <ChevronDown style={{ width: 12, height: 12 }}/>
          </div>
        </button>
      )}

      {/* Separator in collapsed mode */}
      {collapsed && (
        <div style={{ height: 1, background: 'rgba(255,255,255,0.04)', margin: '6px 8px' }}/>
      )}

      {/* Items */}
      <div style={{
        overflow: 'hidden',
        maxHeight: open || collapsed ? 600 : 0,
        transition: 'max-height 0.32s cubic-bezier(0.4,0,0.2,1)',
        opacity: open || collapsed ? 1 : 0,
      }}>
        {group.items.map(item => (
          <NavItem
            key={item.path}
            item={item}
            active={location.pathname === item.path}
            collapsed={collapsed}
            onClick={navigate}
            onSubNav={navigate}
          />
        ))}
      </div>
    </div>
  )
}

/* ─── Main sidebar ──────────────────────────────────────────────── */
export default function Sidebar({ collapsed, onToggle }) {
  const { user, logout, isAdmin, isQuizCreator } = useAuth()
  const { play } = useSound()
  const { colorKey, setColorKey, mode, toggleMode, themes } = useTheme()
  const location = useLocation()
  const nav = useNavigate()
  const [showThemePicker, setShowThemePicker] = useState(false)

  // Determine which group contains the active route, open it by default
  const getDefaultOpen = () => {
    const open = {}
    for (const g of NAV_GROUPS) {
      const hasActive = g.items.some(i => i.path === location.pathname)
      open[g.id] = g.defaultOpen || hasActive
    }
    return open
  }
  const [openGroups, setOpenGroups] = useState(getDefaultOpen)

  // Auto-open the group of the active page when route changes
  useEffect(() => {
    setOpenGroups(prev => {
      const next = { ...prev }
      for (const g of NAV_GROUPS) {
        if (g.items.some(i => i.path === location.pathname)) next[g.id] = true
      }
      return next
    })
  }, [location.pathname])

  const go = (path) => { play('click'); nav(path) }
  const theme = themes[colorKey]

  const toggleGroup = (id) =>
    setOpenGroups(prev => ({ ...prev, [id]: !prev[id] }))

  return (
    <>
      {/* Keyframe animations injected once */}
      <style>{`
        @keyframes sbPulse {
          0%,100% { opacity:1; transform:scale(1); }
          50%      { opacity:0.55; transform:scale(0.85); }
        }
        @keyframes sbFadeIn {
          from { opacity:0; transform:translateY(-4px); }
          to   { opacity:1; transform:translateY(0); }
        }
        @keyframes sbOrb {
          0%,100% { transform:translateY(0) scale(1); }
          50%      { transform:translateY(-18px) scale(1.08); }
        }
        @keyframes sbShimmer {
          0%   { background-position:200% center; }
          100% { background-position:-200% center; }
        }
        .sw-sidebar-scroll::-webkit-scrollbar { width: 10px; }
        .sw-sidebar-scroll::-webkit-scrollbar-track {
          background: rgba(255,255,255,0.04);
          border-radius: 8px;
        }
        .sw-sidebar-scroll::-webkit-scrollbar-thumb {
          background: linear-gradient(180deg, #7dd3fc, #38bdf8);
          border-radius: 8px;
          box-shadow: 0 0 8px rgba(125,211,252,0.5);
          border: 2px solid transparent;
          background-clip: padding-box;
        }
        .sw-sidebar-scroll::-webkit-scrollbar-thumb:hover {
          background: linear-gradient(180deg, #ffffff, #7dd3fc);
          background-clip: padding-box;
          border: 2px solid transparent;
        }
      `}</style>

      <aside
        data-sidebar
        className="fixed top-0 left-0 h-screen flex flex-col z-40"
        style={{
          width: collapsed ? 64 : 280,
          transition: 'width 0.28s cubic-bezier(0.4,0,0.2,1)',
          background: 'linear-gradient(180deg, #050c1a 0%, #08132a 45%, #0c1e3e 100%)',
          borderRight: '1px solid rgba(255,255,255,0.05)',
          overflow: 'hidden',
        }}>

        {/* ── Animated ambient orbs ── */}
        <div style={{ position:'absolute', inset:0, pointerEvents:'none', overflow:'hidden', zIndex:0 }}>
          <div style={{
            position:'absolute', width:180, height:180, borderRadius:'50%',
            background:'radial-gradient(circle, rgba(0,111,191,0.10) 0%, transparent 70%)',
            top:-40, left:-60, animation:'sbOrb 8s ease-in-out infinite',
          }}/>
          <div style={{
            position:'absolute', width:140, height:140, borderRadius:'50%',
            background:'radial-gradient(circle, rgba(168,85,247,0.07) 0%, transparent 70%)',
            bottom:120, right:-50, animation:'sbOrb 12s ease-in-out infinite reverse',
          }}/>
          <div style={{
            position:'absolute', width:100, height:100, borderRadius:'50%',
            background:'radial-gradient(circle, rgba(20,184,166,0.06) 0%, transparent 70%)',
            bottom:280, left:-30, animation:'sbOrb 10s ease-in-out infinite',
            animationDelay:'-4s',
          }}/>
        </div>

        {/* ── Logo / header ── */}
        <div style={{
          position:'relative', zIndex:1,
          display:'flex', alignItems:'center', gap:10,
          padding: collapsed ? '14px 0' : '14px 14px',
          justifyContent: collapsed ? 'center' : 'flex-start',
          borderBottom:'1px solid rgba(255,255,255,0.05)',
          minHeight:62, flexShrink:0,
        }}>
          {/* Logo icon */}
          <div style={{
            width:38, height:38, borderRadius:11, flexShrink:0,
            background:'linear-gradient(135deg, #006fbf, #14b8a6)',
            boxShadow:'0 4px 14px rgba(0,111,191,0.45)',
            display:'flex', alignItems:'center', justifyContent:'center',
          }}>
            <Droplets style={{ width:19, height:19, color:'#fff' }}/>
          </div>

          {!collapsed && (
            <>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{
                  fontWeight:800, fontSize:14, color:'#e8f0ff',
                  letterSpacing:'0.04em', lineHeight:1.2,
                  background:'linear-gradient(90deg,#7dd3fc,#a5f3fc,#c4b5fd)',
                  WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent',
                  backgroundClip:'text',
                }}>
                  SOURCE Water
                </div>
                <div style={{ fontSize:10, color:'#ffffff', letterSpacing:'0.08em', marginTop:1, fontWeight:600 }}>
                  Freshwater Intelligence
                </div>
              </div>
              <button onClick={onToggle}
                style={{
                  padding:6, borderRadius:7, border:'none', background:'transparent',
                  cursor:'pointer', color:'#2d4260', flexShrink:0,
                  transition:'all 0.15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.background='rgba(255,255,255,0.06)'; e.currentTarget.style.color='#7dd3fc' }}
                onMouseLeave={e => { e.currentTarget.style.background='transparent'; e.currentTarget.style.color='#2d4260' }}>
                <ChevronLeft style={{ width:15, height:15 }}/>
              </button>
            </>
          )}

          {collapsed && (
            <button onClick={onToggle} title="Expand sidebar"
              style={{
                padding:6, borderRadius:7, border:'none', background:'rgba(0,111,191,0.12)',
                cursor:'pointer', color:'#4a6a8a', transition:'all 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background='rgba(0,111,191,0.25)'; e.currentTarget.style.color='#7dd3fc' }}
              onMouseLeave={e => { e.currentTarget.style.background='rgba(0,111,191,0.12)'; e.currentTarget.style.color='#4a6a8a' }}>
              <ChevronRight style={{ width:16, height:16 }}/>
            </button>
          )}
        </div>

        {/* ── Nav scroll area ── */}
        <nav className="sw-sidebar-scroll" style={{
          flex:1, overflowY:'auto', overflowX:'hidden',
          padding:'6px 0', position:'relative', zIndex:1,
          scrollbarWidth:'auto', scrollbarColor:'#7dd3fc rgba(255,255,255,0.06)',
        }}>
          {/* Main grouped nav */}
          {NAV_GROUPS.map(group => (
            <SectionGroup
              key={group.id}
              group={group}
              open={openGroups[group.id]}
              onToggle={() => toggleGroup(group.id)}
              location={location}
              navigate={go}
              collapsed={collapsed}
            />
          ))}

          {/* Divider */}
          <div style={{ height:1, background:'rgba(255,255,255,0.04)', margin:'6px 10px' }}/>

          {/* Standalone items */}
          {STANDALONE.map(item => (
            <NavItem
              key={item.path}
              item={item}
              active={location.pathname === item.path}
              collapsed={collapsed}
              onClick={go}
              onSubNav={go}
            />
          ))}

          {/* Quiz Manager */}
          {isQuizCreator && (
            <NavItem
              item={{ label:'Quiz Manager', icon:GraduationCap, path:'/quiz-admin', color:'#f97316', sub:'Create & manage quizzes' }}
              active={location.pathname === '/quiz-admin'}
              collapsed={collapsed}
              onClick={go}
              onSubNav={go}
            />
          )}

          {/* Claim admin — the button itself checks /auth/admin-exists and
              hides when an admin is already in place */}
          {!isAdmin && user && (
            <ClaimAdminButton collapsed={collapsed}/>
          )}

          {/* Admin section */}
          {isAdmin && (
            <>
              {!collapsed && (
                <div style={{ padding:'8px 10px 4px', display:'flex', alignItems:'center', gap:6 }}>
                  <span style={{ fontSize:9.5, fontWeight:800, letterSpacing:'0.14em', color:'#ef444460', textTransform:'uppercase' }}>Admin</span>
                  <div style={{ flex:1, height:1, background:'rgba(239,68,68,0.12)' }}/>
                </div>
              )}
              {collapsed && <div style={{ height:1, background:'rgba(255,255,255,0.04)', margin:'6px 8px' }}/>}
              <NavItem
                item={{ label:'Admin Panel', icon:ShieldCheck, path:'/admin', color:'#ef4444', sub:'Users · CMS · settings' }}
                active={location.pathname === '/admin'}
                collapsed={collapsed}
                onClick={go}
                onSubNav={go}
              />
            </>
          )}
        </nav>

        {/* ── Footer (expanded sidebar) ── */}
        {!collapsed && (
          <div style={{
            flexShrink:0, padding:'10px 10px 12px',
            borderTop:'1px solid rgba(255,255,255,0.05)',
            position:'relative', zIndex:1,
            display:'flex', flexDirection:'column', gap:4,
          }}>

            {/* User profile */}
            <button onClick={() => go('/profile')}
              style={{
                display:'flex', alignItems:'center', gap:10,
                padding:'8px 10px', borderRadius:11, border:'none',
                background:'rgba(255,255,255,0.03)', cursor:'pointer', textAlign:'left',
                transition:'background 0.15s', width:'100%',
              }}
              onMouseEnter={e => e.currentTarget.style.background='rgba(255,255,255,0.07)'}
              onMouseLeave={e => e.currentTarget.style.background='rgba(255,255,255,0.03)'}>
              <div style={{
                width:34, height:34, borderRadius:'50%', flexShrink:0,
                background:'linear-gradient(135deg, #006fbf, #14b8a6)',
                boxShadow:'0 2px 10px rgba(0,111,191,0.35)',
                display:'flex', alignItems:'center', justifyContent:'center',
                fontSize:14, fontWeight:800, color:'#fff',
              }}>
                {user?.avatar_emoji || user?.display_name?.[0]?.toUpperCase() || '?'}
              </div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:12, fontWeight:700, color:'#c8d8ee', letterSpacing:'0.02em', lineHeight:1.2, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                  {user?.display_name || user?.username}
                </div>
                <div style={{ fontSize:10, color:'#2d4260', marginTop:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                  {user?.role?.replace(/_/g,' ') || 'Community member'}
                </div>
              </div>
              <UserCircle style={{ width:13, height:13, color:'#2d4260', flexShrink:0 }}/>
            </button>

            {/* Org — NORDIK Institute logo */}
            <div style={{
              display:'flex', alignItems:'center', gap:8,
              padding:'8px 10px', borderRadius:9,
              background:'rgba(255,255,255,0.95)',
            }}>
              <img src="/logos/nordik.png" alt="NORDIK Institute"
                style={{ width:'100%', maxHeight:36, objectFit:'contain' }}/>
            </div>

            {/* Theme picker */}
            <div style={{ position:'relative' }}>
              <button onClick={() => setShowThemePicker(s => !s)}
                style={{
                  display:'flex', alignItems:'center', gap:8,
                  width:'100%', padding:'6px 10px', borderRadius:9, border:'none',
                  background:'rgba(255,255,255,0.02)', cursor:'pointer',
                  transition:'background 0.15s',
                }}
                onMouseEnter={e => e.currentTarget.style.background='rgba(255,255,255,0.05)'}
                onMouseLeave={e => e.currentTarget.style.background='rgba(255,255,255,0.02)'}>
                <div style={{
                  width:13, height:13, borderRadius:'50%', flexShrink:0,
                  background:`linear-gradient(135deg, ${theme?.primary}, ${theme?.secondary})`,
                  boxShadow:`0 0 6px ${theme?.primary}80`,
                }}/>
                <span style={{ fontSize:11, flex:1, textAlign:'left', color:'#2d4260' }}>{theme?.name || 'Ocean Blue'}</span>
                <ChevronDown style={{ width:11, height:11, color:'#2d4260' }}/>
              </button>

              {showThemePicker && (
                <div style={{
                  position:'absolute', bottom:'calc(100% + 6px)', left:0, right:0,
                  borderRadius:12, padding:8, zIndex:50,
                  background:'#0d1f3c', border:'1px solid rgba(255,255,255,0.08)',
                  boxShadow:'0 8px 32px rgba(0,0,0,0.5)',
                }}>
                  {Object.entries(THEMES).map(([key, t]) => (
                    <button key={key} onClick={() => { setColorKey(key); setShowThemePicker(false) }}
                      style={{
                        display:'flex', alignItems:'center', gap:8,
                        width:'100%', padding:'7px 10px', borderRadius:8,
                        border:'none', background:'transparent', cursor:'pointer',
                        transition:'background 0.12s',
                      }}
                      onMouseEnter={e => e.currentTarget.style.background='rgba(255,255,255,0.06)'}
                      onMouseLeave={e => e.currentTarget.style.background='transparent'}>
                      <div style={{ width:12, height:12, borderRadius:'50%', flexShrink:0, background:`linear-gradient(135deg, ${t.primary}, ${t.secondary})` }}/>
                      <span style={{ fontSize:12, color:'#fff', flex:1, textAlign:'left' }}>{t.name}</span>
                      {colorKey === key && <Circle style={{ width:8, height:8, fill:'#818cf8', color:'#818cf8' }}/>}
                    </button>
                  ))}
                  <div style={{ height:1, background:'rgba(255,255,255,0.06)', margin:'5px 4px' }}/>
                  <button onClick={toggleMode}
                    style={{
                      display:'flex', alignItems:'center', gap:8,
                      width:'100%', padding:'7px 10px', borderRadius:8,
                      border:'none', background:'transparent', cursor:'pointer',
                      transition:'background 0.12s',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background='rgba(255,255,255,0.06)'}
                    onMouseLeave={e => e.currentTarget.style.background='transparent'}>
                    <span style={{ fontSize:13 }}>{mode === 'dark' ? '☀️' : '🌙'}</span>
                    <span style={{ fontSize:12, color:'rgba(255,255,255,0.7)' }}>{mode === 'dark' ? 'Light mode' : 'Dark mode'}</span>
                  </button>
                </div>
              )}
            </div>

            {/* Sign out */}
            <button onClick={() => { play('click'); logout() }}
              style={{
                display:'flex', alignItems:'center', gap:8,
                width:'100%', padding:'6px 10px', borderRadius:9,
                border:'none', background:'transparent', cursor:'pointer',
                color:'#2d4260', transition:'all 0.15s', textAlign:'left',
              }}
              onMouseEnter={e => { e.currentTarget.style.background='rgba(239,68,68,0.08)'; e.currentTarget.style.color='#f87171' }}
              onMouseLeave={e => { e.currentTarget.style.background='transparent'; e.currentTarget.style.color='#2d4260' }}>
              <LogOut style={{ width:13, height:13, flexShrink:0 }}/>
              <span style={{ fontSize:12, fontWeight:600 }}>Sign out</span>
            </button>
          </div>
        )}

        {/* ── Footer (collapsed sidebar) ── */}
        {collapsed && (
          <div style={{
            flexShrink:0, padding:10, borderTop:'1px solid rgba(255,255,255,0.04)',
            display:'flex', justifyContent:'center', position:'relative', zIndex:1,
          }}>
            <button onClick={() => go('/profile')}
              style={{
                width:36, height:36, borderRadius:'50%',
                background:'linear-gradient(135deg, #006fbf, #14b8a6)',
                boxShadow:'0 2px 10px rgba(0,111,191,0.35)',
                display:'flex', alignItems:'center', justifyContent:'center',
                fontSize:15, fontWeight:800, color:'#fff',
                border:'none', cursor:'pointer',
              }}>
              {user?.avatar_emoji || user?.display_name?.[0]?.toUpperCase() || '?'}
            </button>
          </div>
        )}
      </aside>
    </>
  )
}
