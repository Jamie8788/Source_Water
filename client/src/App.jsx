import React, { Suspense, lazy } from 'react'
import { Routes, Route, Navigate, Outlet } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { ThemeProvider } from './context/ThemeContext'
import { SoundProvider } from './context/SoundContext'
import { AccessibilityProvider } from './context/AccessibilityContext'
import { CMSProvider } from './context/CMSContext'
import Layout from './components/layout/Layout'
import ComingSoon from './components/ComingSoon'

const Welcome    = lazy(() => import('./pages/Welcome'))
const Landing    = lazy(() => import('./pages/Landing'))
const Onboarding = lazy(() => import('./pages/Onboarding'))
const Dashboard  = lazy(() => import('./pages/Dashboard'))
const AskWater   = lazy(() => import('./pages/AskWater'))
const MapPage    = lazy(() => import('./pages/MapPage'))
const GeoAnalytics = lazy(() => import('./pages/GeoAnalytics'))
const WRMonitoringMap = lazy(() => import('./pages/WRMonitoringMap'))
const WRDataExplorer = lazy(() => import('./pages/WRDataExplorer'))
const WRAILab = lazy(() => import('./pages/WRAILab'))
const WRMethods = lazy(() => import('./pages/WRMethods'))
const Social     = lazy(() => import('./pages/Social'))
const QuizMe     = lazy(() => import('./pages/QuizMe'))
const Resources  = lazy(() => import('./pages/Resources'))
const Projects   = lazy(() => import('./pages/Projects'))
const Analysis   = lazy(() => import('./pages/Analysis'))
const Reports    = lazy(() => import('./pages/Reports'))
const AdminPage  = lazy(() => import('./pages/AdminPage'))
const QuizAdmin  = lazy(() => import('./pages/QuizAdmin'))
const Profile    = lazy(() => import('./pages/Profile'))
const Alerts     = lazy(() => import('./pages/Alerts'))
const Weather    = lazy(() => import('./pages/Weather3D'))
const Games        = lazy(() => import('./pages/Games'))
const ResearchHub  = lazy(() => import('./pages/ResearchHub'))
const QuickActions = lazy(() => import('./pages/QuickActions'))
const AboutStoryline     = lazy(() => import('./pages/AboutStoryline'))
const AboutThisPlatform  = lazy(() => import('./pages/AboutThisPlatform'))
const AboutCollaborators = lazy(() => import('./pages/AboutCollaborators'))

// Persistent layout — stays mounted between page navigations (fixes sidebar collapse)
function ProtectedLayout() {
  const { user, loading } = useAuth()
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-16 h-16 rounded-full border-4 border-indigo-500 border-t-transparent animate-spin"/>
    </div>
  )
  if (!user) return <Navigate to="/" replace />
  if (!user.onboarding_completed) return <Navigate to="/onboarding" replace />
  return <Layout><Outlet /></Layout>
}

function AdminGuard() {
  const { user, isAdmin } = useAuth()
  if (!user || !isAdmin) return <Navigate to="/dashboard" replace />
  return <Outlet />
}

// Admins bypass any ComingSoon gate so they can preview the real feature;
// regular users still see ComingSoon. Trust ONLY the is_admin DB flag —
// the previous username/email shortcuts were a backdoor: any account named
// 'admin' or with email 'admin@sourcewater.app' got the bypass even when
// is_admin was toggled off in the dashboard. If isAdmin is stale due to
// cached localStorage, the user just needs to log out and back in.
function AdminGated({ admin, fallback }) {
  const { isAdmin } = useAuth()
  return isAdmin ? admin : fallback
}

function QuizCreatorGuard() {
  const { user, isQuizCreator } = useAuth()
  if (!user || !isQuizCreator) return <Navigate to="/quiz" replace />
  return <Outlet />
}

// Feature gate: admin can turn a tab off per-role/per-user (Admin → Access
// Control). If this user isn't allowed the feature, bounce to the dashboard.
// Defaults to allowed while access is still loading, so nothing flickers.
function Feat({ k, children }) {
  const { canFeature } = useAuth()
  return canFeature(k) ? children : <Navigate to="/dashboard" replace />
}

function AppRoutes() {
  const { user } = useAuth()
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-indigo-500 text-xl">Loading...</div>}>
      <Routes>
        {/* Cinematic scroll-driven welcome is the front door; the sign-in
            form (Landing) lives at /login. Signed-in users skip both. */}
        <Route path="/" element={user ? <Navigate to="/dashboard" replace /> : <Welcome />} />
        <Route path="/login" element={user ? <Navigate to="/dashboard" replace /> : <Landing />} />
        <Route path="/onboarding" element={<Onboarding />} />

        {/* All protected pages share ONE persistent Layout instance */}
        <Route element={<ProtectedLayout />}>
          <Route path="/dashboard"  element={<Feat k="dashboard"><Dashboard /></Feat>} />
          <Route path="/ask-water"  element={<Feat k="ask-water"><AskWater /></Feat>} />
          <Route path="/map"        element={<MapPage />} />
          <Route path="/geoanalytics" element={<GeoAnalytics />} />
          <Route path="/monitoring"   element={<Feat k="monitoring"><WRMonitoringMap /></Feat>} />
          {/* Feature tabs are visible to all signed-in users by default, and
              an admin can turn any of them off per-role or per-user from
              Admin → Access Control. <Feat k="..."> enforces that live. */}
          <Route path="/explorer"     element={<Feat k="explorer"><WRDataExplorer /></Feat>} />
          <Route path="/ai-lab"       element={<Feat k="ai-lab"><WRAILab /></Feat>} />
          <Route path="/methods"      element={<WRMethods />} />
          <Route path="/social"     element={<Feat k="social"><Social /></Feat>} />
          <Route path="/quiz"       element={<Feat k="quiz"><QuizMe /></Feat>} />
          <Route path="/resources"  element={<Feat k="resources"><Resources /></Feat>} />
          <Route path="/projects"   element={<Feat k="projects"><Projects /></Feat>} />
          <Route path="/analysis"   element={<Feat k="analysis"><Analysis /></Feat>} />
          <Route path="/reports"    element={<Feat k="reports"><Reports /></Feat>} />
          <Route path="/alerts"     element={<Feat k="alerts"><Alerts /></Feat>} />
          <Route path="/weather"    element={<Feat k="weather"><Weather /></Feat>} />
          <Route path="/games"      element={<Feat k="games"><Games /></Feat>} />
          <Route path="/research"      element={<Feat k="research"><ResearchHub /></Feat>} />
          <Route path="/quick-actions" element={<Feat k="quick"><QuickActions /></Feat>} />
          <Route path="/about/storyline"     element={<AboutStoryline />} />
          <Route path="/about/this-platform" element={<AboutThisPlatform />} />
          <Route path="/about/collaborators" element={<AboutCollaborators />} />
          <Route path="/profile"    element={<Profile />} />
          <Route element={<AdminGuard />}>
            <Route path="/admin" element={<AdminPage />} />
          </Route>
          <Route element={<QuizCreatorGuard />}>
            <Route path="/quiz-admin" element={<QuizAdmin />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  )
}

export default function App() {
  return (
    <ThemeProvider>
      <SoundProvider>
        <AccessibilityProvider>
          <AuthProvider>
            <CMSProvider>
              <AppRoutes />
            </CMSProvider>
          </AuthProvider>
        </AccessibilityProvider>
      </SoundProvider>
    </ThemeProvider>
  )
}
