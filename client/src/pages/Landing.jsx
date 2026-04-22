import { useState, useEffect, useRef } from 'react'
import { useNavigate, Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useCMS } from '../context/CMSContext'
import CMSField from '../components/cms/CMSField'
import { Eye, EyeOff, Droplets, ChevronRight } from 'lucide-react'
import NibiMascotImage from '../components/NibiMascotImage'
import api from '../utils/api'

/* ── Animated Water Canvas ── */
function WaterCanvas() {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    let raf
    let t = 0

    const resize = () => {
      canvas.width = canvas.offsetWidth * window.devicePixelRatio
      canvas.height = canvas.offsetHeight * window.devicePixelRatio
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio)
    }
    resize()
    window.addEventListener('resize', resize)

    const W = () => canvas.offsetWidth
    const H = () => canvas.offsetHeight

    // Particles
    const particles = Array.from({ length: 60 }, () => ({
      x: Math.random() * 900,
      y: Math.random() * 700,
      r: Math.random() * 3 + 1,
      vx: (Math.random() - 0.5) * 0.3,
      vy: -Math.random() * 0.5 - 0.1,
      alpha: Math.random() * 0.5 + 0.1,
      hue: Math.random() * 40 + 200,
    }))

    // Ripples
    const ripples = []
    const spawnRipple = () => {
      ripples.push({ x: Math.random() * 900, y: Math.random() * 700, r: 0, maxR: 60 + Math.random() * 80, alpha: 0.4, speed: 0.6 + Math.random() * 0.4 })
    }
    let rippleTimer = 0

    const draw = () => {
      t += 0.008
      rippleTimer++
      if (rippleTimer % 90 === 0) spawnRipple()

      const w = W(), h = H()
      ctx.clearRect(0, 0, w, h)

      // Deep gradient background
      const bg = ctx.createLinearGradient(0, 0, w, h)
      bg.addColorStop(0, '#0f0c29')
      bg.addColorStop(0.5, '#302b63')
      bg.addColorStop(1, '#24243e')
      ctx.fillStyle = bg
      ctx.fillRect(0, 0, w, h)

      // Flowing wave layers
      for (let layer = 0; layer < 4; layer++) {
        ctx.beginPath()
        ctx.moveTo(0, h)
        const yBase = h * (0.5 + layer * 0.12)
        const amp = 25 + layer * 10
        const freq = 0.008 - layer * 0.001
        const phase = t * (1 + layer * 0.3) + layer * Math.PI * 0.5
        for (let x = 0; x <= w; x += 4) {
          const y = yBase + Math.sin(x * freq + phase) * amp + Math.sin(x * freq * 2.3 + phase * 1.7) * (amp * 0.4)
          ctx.lineTo(x, y)
        }
        ctx.lineTo(w, h)
        ctx.closePath()
        const alpha = 0.08 + layer * 0.04
        ctx.fillStyle = `rgba(99,102,241,${alpha})`
        ctx.fill()
      }

      // Ripples
      for (let i = ripples.length - 1; i >= 0; i--) {
        const rp = ripples[i]
        rp.r += rp.speed
        rp.alpha -= 0.004
        if (rp.alpha <= 0) { ripples.splice(i, 1); continue }
        ctx.beginPath()
        ctx.arc(rp.x, rp.y, rp.r, 0, Math.PI * 2)
        ctx.strokeStyle = `rgba(129,140,248,${rp.alpha})`
        ctx.lineWidth = 1.5
        ctx.stroke()
        // Inner ripple
        if (rp.r > 15) {
          ctx.beginPath()
          ctx.arc(rp.x, rp.y, rp.r * 0.6, 0, Math.PI * 2)
          ctx.strokeStyle = `rgba(167,139,250,${rp.alpha * 0.5})`
          ctx.lineWidth = 1
          ctx.stroke()
        }
      }

      // Floating particles
      particles.forEach(p => {
        p.x += p.vx
        p.y += p.vy
        if (p.y < -10) { p.y = h + 10; p.x = Math.random() * w }
        if (p.x < -10) p.x = w + 10
        if (p.x > w + 10) p.x = -10

        ctx.beginPath()
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
        const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 2)
        grad.addColorStop(0, `hsla(${p.hue},80%,80%,${p.alpha})`)
        grad.addColorStop(1, `hsla(${p.hue},80%,60%,0)`)
        ctx.fillStyle = grad
        ctx.fill()
      })

      // Glowing orbs
      const orbs = [
        { x: w * 0.2, y: h * 0.3, r: 120, color: '99,102,241' },
        { x: w * 0.75, y: h * 0.6, r: 100, color: '20,184,166' },
        { x: w * 0.5, y: h * 0.8, r: 90, color: '139,92,246' },
      ]
      orbs.forEach(orb => {
        const pulse = 1 + Math.sin(t * 0.8) * 0.1
        const grad = ctx.createRadialGradient(orb.x, orb.y, 0, orb.x, orb.y, orb.r * pulse)
        grad.addColorStop(0, `rgba(${orb.color},0.12)`)
        grad.addColorStop(1, `rgba(${orb.color},0)`)
        ctx.fillStyle = grad
        ctx.fillRect(0, 0, w, h)
      })

      raf = requestAnimationFrame(draw)
    }

    draw()
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize) }
  }, [])

  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" style={{ display: 'block' }}/>
}

function CountUp({ target, suffix = '' }) {
  const [val, setVal] = useState(0)
  useEffect(() => {
    let start = 0
    const step = target / 60
    const id = setInterval(() => {
      start += step
      if (start >= target) { setVal(target); clearInterval(id) }
      else setVal(Math.floor(start))
    }, 25)
    return () => clearInterval(id)
  }, [target])
  return <>{val.toLocaleString()}{suffix}</>
}

export default function Landing() {
  const { login, register, user } = useAuth()
  const navigate = useNavigate()

  // Already logged in — send them where they belong
  if (user) {
    return <Navigate to={user.onboarding_completed ? '/dashboard' : '/onboarding'} replace />
  }
  const [mode, setMode] = useState('login')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [form, setForm] = useState({ identifier: '', password: '', username: '', email: '', display_name: '' })
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  // Live platform counters (sites/samples/members). Public endpoint; falls
  // back to silent 0s if the API is briefly unavailable so the page still
  // renders cleanly.
  const [stats, setStats] = useState(null)
  useEffect(() => {
    let cancelled = false
    api.get('/admin/public-stats')
      .then(r => { if (!cancelled) setStats(r.data) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])

  const handleLogin = async e => {
    e.preventDefault(); setError(''); setLoading(true)
    try { await login(form.identifier, form.password); navigate('/dashboard') }
    catch (err) { setError(err.response?.data?.error || 'Login failed') }
    finally { setLoading(false) }
  }

  const handleRegister = async e => {
    e.preventDefault(); setError(''); setLoading(true)
    try {
      await register({ username: form.username, email: form.email, password: form.password, display_name: form.display_name })
      navigate('/onboarding')
    } catch (err) { setError(err.response?.data?.error || 'Registration failed') }
    finally { setLoading(false) }
  }

  return (
    <div className="min-h-screen flex flex-col lg:flex-row overflow-hidden" style={{ background: '#0f0c29' }}>

      {/* ── Left: Animated Hero ── */}
      <div className="flex-1 relative flex flex-col overflow-hidden" style={{ minHeight: '55vh' }}>
        <WaterCanvas />

        {/* BIG centered mascot — floats over the hero, transparent PNG */}
        <div
          className="hidden lg:block pointer-events-none"
          style={{
            position: 'absolute',
            right: -40,
            top: '50%',
            transform: 'translateY(-50%)',
            zIndex: 5,
            animation: 'heroFloat 5s ease-in-out infinite',
            filter: 'drop-shadow(0 25px 50px rgba(99,102,241,0.45))',
          }}
        >
          <NibiMascotImage mood="openarms" size={520}/>
        </div>
        <style>{`
          @keyframes heroFloat {
            0%,100% { transform: translateY(-50%) }
            50%     { transform: translateY(calc(-50% - 14px)) }
          }
          @keyframes heroBubblePop {
            0%   { opacity: 0; transform: translateY(8px) scale(0.94) }
            100% { opacity: 1; transform: translateY(0) scale(1) }
          }
        `}</style>

        {/* Content over canvas */}
        <div className="relative z-10 flex flex-col h-full p-8 lg:p-12">

          {/* Logo */}
          <div className="flex items-center gap-3 mb-auto">
            <div className="w-11 h-11 rounded-2xl flex items-center justify-center shadow-lg flex-shrink-0"
              style={{ background: 'linear-gradient(135deg,#6366f1,#14b8a6)' }}>
              <Droplets className="w-6 h-6 text-white"/>
            </div>
            <div>
              <div className="text-white font-black text-lg tracking-tight">SOURCE <span style={{ color: '#818cf8' }}>Water</span></div>
              <div className="text-xs font-semibold tracking-widest uppercase" style={{ color: '#94a3b8' }}>NORDIK Institute</div>
            </div>
          </div>

          {/* Hero text */}
          <div className="py-10 max-w-xl">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold mb-4"
              style={{ background: 'rgba(99,102,241,0.2)', color: '#818cf8', border: '1px solid rgba(99,102,241,0.3)' }}>
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse inline-block"/>
              <CMSField page="landing" block="badge" field="text" default="LIVE · Great Lakes Intelligence and Engagement Platform" tag="span"/>
            </div>
            <h1 className="text-4xl lg:text-6xl font-black text-white leading-[1.05] mb-4" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
              <CMSField page="landing" block="hero" field="title_line1" default="Protect our" tag="span"/><br/>
              <span style={{ background: 'linear-gradient(135deg,#818cf8,#14b8a6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                <CMSField page="landing" block="hero" field="title_line2" default="Watersheds" tag="span"/>
              </span>
            </h1>
            <p className="text-lg mb-8 max-w-md" style={{ color: '#94a3b8' }}>
              <CMSField page="landing" block="hero" field="subtitle" default="Real-time water quality data capability, AI insights, and community engagement with surface fresh water." tag="span" multiline/>
            </p>

            {/* Stats — real counts from /api/admin/public-stats */}
            <div className="flex gap-8 mb-10">
              {[
                { key: 'sites',   label: 'Sites' },
                { key: 'samples', label: 'Samples' },
                { key: 'members', label: 'Communities' },
              ].map(s => (
                <div key={s.label}>
                  <div className="text-2xl font-black text-white">
                    {stats ? <CountUp target={stats[s.key] || 0}/> : '—'}
                  </div>
                  <div className="text-xs font-semibold" style={{ color: '#64748b' }}>{s.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Partner logos — NORDIK Institute + SOURCE Water team */}
          <div className="flex items-center gap-6 max-w-md">
            <div className="flex-1 rounded-xl px-4 py-3 flex items-center justify-center"
              style={{ background: 'rgba(255,255,255,0.95)', border: '1px solid rgba(255,255,255,0.1)' }}>
              <img src="/logos/nordik.png" alt="NORDIK Institute"
                style={{ maxHeight: 56, width: 'auto', objectFit: 'contain' }}/>
            </div>
            <div className="flex-1 rounded-xl px-4 py-3 flex items-center justify-center"
              style={{ background: 'rgba(255,255,255,0.95)', border: '1px solid rgba(255,255,255,0.1)' }}>
              <img src="/logos/source-water.png" alt="SOURCE Water"
                style={{ maxHeight: 56, width: 'auto', objectFit: 'contain' }}/>
            </div>
          </div>
        </div>
      </div>

      {/* ── Right: Auth Panel ── */}
      {/* Align panel to top — matches the SOURCE Water logo height in hero column so login is reachable without scrolling */}
      <div className="w-full lg:w-[440px] flex-shrink-0 flex items-start justify-center p-8 pt-8 relative"
        style={{ background: 'rgba(15,12,41,0.95)', borderLeft: '1px solid rgba(99,102,241,0.2)' }}>

        <div className="w-full max-w-sm">

          {/* Speech bubble — positioned above the auth card, mascot lives in hero column */}
          <div className="mb-4 flex justify-center">
            <div className="px-4 py-2.5 rounded-2xl text-xs font-semibold text-center"
              style={{
                background: 'linear-gradient(135deg,#6366f1,#4f46e5)',
                color: 'white',
                boxShadow: '0 4px 20px rgba(99,102,241,0.35)',
                maxWidth: 280,
                animation: 'heroBubblePop 0.6s ease-out',
              }}>
              Hi, I'm Water! To get started, please create an account. I'm excited to meet another water protector!
            </div>
          </div>

          {/* Logo icon */}
          <div className="mb-6 text-center">
            <div className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg,#6366f1,#14b8a6)', boxShadow: '0 0 40px rgba(99,102,241,0.4)' }}>
              <Droplets className="w-8 h-8 text-white"/>
            </div>
            <h2 className="text-2xl font-black text-white">
              {mode === 'login' ? 'Welcome back' : 'Join SOURCE Water'}
            </h2>
            <p className="text-sm mt-1" style={{ color: '#64748b' }}>
              {mode === 'login' ? 'Sign in to your account' : 'Create your free account today'}
            </p>
          </div>

          {/* Toggle */}
          <div className="flex rounded-xl p-1 mb-6" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <button onClick={() => { setMode('login'); setError('') }}
              className={`flex-1 py-2.5 rounded-lg font-bold text-sm transition-all ${mode === 'login' ? 'text-white' : 'text-gray-500 hover:text-gray-300'}`}
              style={mode === 'login' ? { background: 'linear-gradient(135deg,#6366f1,#4f46e5)' } : {}}>
              Sign In
            </button>
            <button onClick={() => { setMode('register'); setError('') }}
              className={`flex-1 py-2.5 rounded-lg font-bold text-sm transition-all ${mode === 'register' ? 'text-white' : 'text-gray-500 hover:text-gray-300'}`}
              style={mode === 'register' ? { background: 'linear-gradient(135deg,#6366f1,#4f46e5)' } : {}}>
              Create Account
            </button>
          </div>

          {/* Override input styles for dark theme */}
          <style>{`
            .auth-input {
              background: rgba(255,255,255,0.05) !important;
              border: 1.5px solid rgba(255,255,255,0.1) !important;
              color: white !important;
              border-radius: 10px !important;
            }
            .auth-input::placeholder { color: #475569 !important; }
            .auth-input:focus { border-color: #6366f1 !important; box-shadow: 0 0 0 3px rgba(99,102,241,0.15) !important; }
            .auth-label { color: #94a3b8 !important; }
          `}</style>

          {mode === 'login' ? (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="auth-label">Username or Email</label>
                <input className="auth-input" value={form.identifier} onChange={e => set('identifier', e.target.value)}
                  placeholder="Enter username or email" required autoComplete="username"/>
              </div>
              <div className="relative">
                <label className="auth-label">Password</label>
                <input className="auth-input" type={showPass ? 'text' : 'password'} value={form.password}
                  onChange={e => set('password', e.target.value)} placeholder="Your password" required autoComplete="current-password"/>
                <button type="button" onClick={() => setShowPass(s => !s)}
                  className="absolute right-3 top-9" style={{ color: '#475569' }}>
                  {showPass ? <EyeOff className="w-4 h-4"/> : <Eye className="w-4 h-4"/>}
                </button>
              </div>
              {error && (
                <div className="text-sm px-4 py-2.5 rounded-xl" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171' }}>
                  ⚠️ {error}
                </div>
              )}
              <button type="submit" disabled={loading}
                className="w-full py-3 rounded-xl font-bold text-white transition-all hover:opacity-90 disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg,#6366f1,#4f46e5)', boxShadow: '0 4px 20px rgba(99,102,241,0.35)' }}>
                {loading ? 'Signing in...' : 'Sign In'}
              </button>
              <button type="button" onClick={() => { set('identifier','admin'); set('password','nordik2026') }}
                className="w-full py-2.5 rounded-xl font-semibold text-sm transition-all hover:opacity-80"
                style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)', color: '#818cf8' }}>
                Demo: admin / nordik2026
              </button>
            </form>
          ) : (
            <form onSubmit={handleRegister} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="auth-label">Username</label>
                  <input className="auth-input" value={form.username} onChange={e => set('username', e.target.value)}
                    placeholder="username" required autoComplete="username"/>
                </div>
                <div>
                  <label className="auth-label">Display Name</label>
                  <input className="auth-input" value={form.display_name} onChange={e => set('display_name', e.target.value)}
                    placeholder="Your name" autoComplete="name"/>
                </div>
              </div>
              <div>
                <label className="auth-label">Email</label>
                <input className="auth-input" type="email" value={form.email} onChange={e => set('email', e.target.value)}
                  placeholder="your@email.com" required autoComplete="email"/>
              </div>
              <div className="relative">
                <label className="auth-label">Password</label>
                <input className="auth-input" type={showPass ? 'text' : 'password'} value={form.password}
                  onChange={e => set('password', e.target.value)} placeholder="Min 6 characters" required minLength={6} autoComplete="new-password"/>
                <button type="button" onClick={() => setShowPass(s => !s)}
                  className="absolute right-3 top-9" style={{ color: '#475569' }}>
                  {showPass ? <EyeOff className="w-4 h-4"/> : <Eye className="w-4 h-4"/>}
                </button>
              </div>
              {error && (
                <div className="text-sm px-4 py-2.5 rounded-xl" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171' }}>
                  ⚠️ {error}
                </div>
              )}
              <button type="submit" disabled={loading}
                className="w-full py-3 rounded-xl font-bold text-white transition-all hover:opacity-90 disabled:opacity-50 mt-1"
                style={{ background: 'linear-gradient(135deg,#6366f1,#14b8a6)', boxShadow: '0 4px 20px rgba(99,102,241,0.3)' }}>
                {loading ? 'Creating account...' : 'Create Free Account'}
                {!loading && <ChevronRight className="w-4 h-4 inline ml-1"/>}
              </button>
            </form>
          )}

          <div className="mt-6 pt-4 flex justify-center gap-6" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            {['🔒 Secure', '💧 Free', '🌿 Open Data'].map(s => (
              <span key={s} className="text-xs font-medium" style={{ color: '#334155' }}>{s}</span>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
