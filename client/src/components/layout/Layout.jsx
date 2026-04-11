import { useState } from 'react'
import Sidebar from './Sidebar'
import TopBar from './TopBar'
import WaterMascot from '../mascot/WaterMascot'
import AccessibilityPanel from '../ui/AccessibilityPanel'
import CMSToolbar from '../cms/CMSToolbar'
import CMSField from '../cms/CMSField'
import NotificationBar from '../cms/NotificationBar'
import CMSComponentLayer from '../cms/CMSComponentLayer'
import CMSPageBlocks from '../cms/CMSPageBlocks'
import { useCMS } from '../../context/CMSContext'
import GlobalDMPanel from '../chat/GlobalDMPanel'

// Legacy shim so any page still importing useCms doesn't break
export { useCMS as useCms }

const FISH = ['🐟','🐠','🐡','🦈','🐙','🦑','🐬','🦐']

function AmbientBackground() {
  return (
    <>
      <div className="ambient-bg" aria-hidden="true">
        <div className="ambient-orb orb-1"/>
        <div className="ambient-orb orb-2"/>
        <div className="ambient-orb orb-3"/>
        <div className="ambient-orb orb-4"/>
        <div className="ambient-lines"/>
      </div>
      {/* Swimming fish layer */}
      <div className="fish-layer" aria-hidden="true">
        {[0,1,2,3,4,5].map(i => (
          <div key={i} className={`fish ${i % 2 === 1 ? 'fish-rtl' : ''}`}>
            {FISH[i % FISH.length]}
          </div>
        ))}
      </div>
      {/* Water ripple at bottom */}
      <div className="water-ripple-bar" aria-hidden="true">
        <svg viewBox="0 0 1440 40" preserveAspectRatio="none" style={{ height: 40 }}>
          <path d="M0,20 C180,40 360,0 540,20 C720,40 900,0 1080,20 C1260,40 1440,0 1440,20 L1440,40 L0,40 Z"
            fill="rgba(99,102,241,0.06)"/>
        </svg>
        <svg viewBox="0 0 1440 40" preserveAspectRatio="none" style={{ height: 40 }}>
          <path d="M0,25 C200,5 400,35 600,20 C800,5 1000,35 1200,20 C1300,10 1400,30 1440,20 L1440,40 L0,40 Z"
            fill="rgba(20,184,166,0.05)"/>
        </svg>
      </div>
    </>
  )
}

export default function Layout({ children }) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(
    () => localStorage.getItem('sw-sidebar-collapsed') === '1'
  )
  const [a11yOpen, setA11yOpen] = useState(false)
  const [dmOpen, setDmOpen] = useState(false)
  const [dmUserId, setDmUserId] = useState(null)
  const { cmsMode } = useCMS()

  const openDM = (userId = null) => { setDmUserId(userId); setDmOpen(true) }
  const closeDM = () => { setDmOpen(false); setDmUserId(null) }

  // Persist sidebar state across navigation
  const handleToggleSidebar = () => {
    setSidebarCollapsed(c => {
      const next = !c
      localStorage.setItem('sw-sidebar-collapsed', next ? '1' : '0')
      return next
    })
  }

  const sidebarW = sidebarCollapsed ? 56 : 240

  return (
    <div className="min-h-screen relative" style={{ background: 'var(--page-bg)' }}>

      {/* Site-wide notification bar — all users, managed by admin via CMS */}
      <NotificationBar />

      {/* Ambient animated background — visible on all pages */}
      <AmbientBackground />

      {/* CMS toolbar — draggable floating sidebar, admin only */}
      <CMSToolbar />

      {/* CMS component overlays — shows hide button on each section in edit mode */}
      <CMSComponentLayer />

      <Sidebar collapsed={sidebarCollapsed} onToggle={handleToggleSidebar} />

      <TopBar sidebarWidth={sidebarW} onA11yClick={() => setA11yOpen(o => !o)} onOpenDM={openDM} />

      <main
        className="transition-all duration-300 relative z-10"
        style={{
          marginLeft: sidebarW,
          marginTop: 56,
          minHeight: 'calc(100vh - 56px)',
          outline: cmsMode ? '2px solid rgba(99,102,241,0.15)' : 'none',
        }}
      >
        <div className="p-6 max-w-[1400px] mx-auto" data-outlet style={{ animation: 'pageSlideIn 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)' }}>
          {children}
          <CMSPageBlocks />
        </div>

        <footer className="border-t mt-8 px-6 py-4"
          style={{ borderColor: 'var(--border)', background: 'var(--card-bg)', position: 'relative', zIndex: 1 }}>
          <div className="max-w-[1400px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-xs">
            <p className="font-semibold" style={{ color: 'var(--text)' }}>
              <CMSField page="global" block="footer" field="copyright"
                default="© 2026 SOURCE Water · Water Quality Engagement Platform"/>
            </p>
            <p style={{ color: 'var(--text-muted)' }}>
              <CMSField page="global" block="footer" field="tagline"
                default="Managed by NORDIK Institute, Algoma University · Real-Time Monitoring · Community Science"/>
            </p>
          </div>
        </footer>
      </main>

      <WaterMascot />
      {a11yOpen && <AccessibilityPanel onClose={() => setA11yOpen(false)} />}
      {dmOpen && <GlobalDMPanel onClose={closeDM} initialUserId={dmUserId} />}
    </div>
  )
}
