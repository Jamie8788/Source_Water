import React, { Suspense, lazy } from 'react'
import { Routes, Route, Navigate, Outlet } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { ThemeProvider } from './context/ThemeContext'
import { SoundProvider } from './context/SoundContext'
import { AccessibilityProvider } from './context/AccessibilityContext'
import { CMSProvider } from './context/CMSContext'
import Layout from './components/layout/Layout'

const Landing    = lazy(() => import('./pages/Landing'))
const Onboarding = lazy(() => import('./pages/Onboarding'))
const Dashboard  = lazy(() => import('./pages/Dashboard'))
const AskWater   = lazy(() => import('./pages/AskWater'))
const MapPage    = lazy(() => import('./pages/MapPage'))
const Social     = lazy(() => import('./pages/Social'))
const QuizMe     = lazy(() => import('./pages/QuizMe'))
const Resources  = lazy(() => import('./pages/Resources'))
const Projects   = lazy(() => import('./pages/Projects'))
const Analysis   = lazy(() => import('./pages/Analysis'))
const Reports    = lazy(() => import('./pages/Reports'))
const AdminPage  = lazy(() => import('./pages/AdminPage'))
const Profile    = lazy(() => import('./pages/Profile'))
const Alerts     = lazy(() => import('./pages/Alerts'))
const Weather    = lazy(() => import('./pages/Weather3D'))
const Games      = lazy(() => import('./pages/Games'))

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

function AppRoutes() {
  const { user } = useAuth()
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-indigo-500 text-xl">Loading...</div>}>
      <Routes>
        <Route path="/" element={user ? <Navigate to="/dashboard" replace /> : <Landing />} />
        <Route path="/onboarding" element={<Onboarding />} />

        {/* All protected pages share ONE persistent Layout instance */}
        <Route element={<ProtectedLayout />}>
          <Route path="/dashboard"  element={<Dashboard />} />
          <Route path="/ask-water"  element={<AskWater />} />
          <Route path="/map"        element={<MapPage />} />
          <Route path="/social"     element={<Social />} />
          <Route path="/quiz"       element={<QuizMe />} />
          <Route path="/resources"  element={<Resources />} />
          <Route path="/projects"   element={<Projects />} />
          <Route path="/analysis"   element={<Analysis />} />
          <Route path="/reports"    element={<Reports />} />
          <Route path="/alerts"     element={<Alerts />} />
          <Route path="/weather"    element={<Weather />} />
          <Route path="/games"      element={<Games />} />
          <Route path="/profile"    element={<Profile />} />
          <Route element={<AdminGuard />}>
            <Route path="/admin"    element={<AdminPage />} />
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
