import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import api from '../utils/api'
import { Check, ChevronRight, ChevronLeft } from 'lucide-react'
import NibiMascotImage from '../components/NibiMascotImage'

const COMMUNITIES = ['Sault Ste. Marie', 'Sudbury', 'Thunder Bay', 'Algoma', 'Manitoulin', 'Elliot Lake', 'Wawa', 'Kapuskasing', 'Timmins', 'Other']
const INTERESTS = ['Water Quality Testing', 'Aquatic Ecology', 'Policy & Advocacy', 'Education & Outreach', 'Data Analysis', 'Field Sampling', 'Indigenous Water Rights', 'Climate & Weather']

const STEPS = [
  { n: 1, label: 'Welcome' },
  { n: 2, label: 'Your Profile' },
  { n: 3, label: 'Platform Tour' },
  { n: 4, label: 'Get Started' },
]

const FEATURES = [
  { icon: '📊', title: 'Dashboard', desc: 'Monitor water quality data, alerts, and trends across sites.' },
  { icon: '⚡', title: 'Ask Water (AI)', desc: 'Ask questions about water and get instant AI-powered insights from Water, your guide!' },
  { icon: '💬', title: 'Community', desc: 'Connect and discuss with other water stewards in your region.' },
  { icon: '📚', title: 'Resources', desc: 'Access learning resources, games, and quizzes to deepen your knowledge.' },
]

export default function Onboarding() {
  const { user, updateUser } = useAuth()
  const navigate = useNavigate()
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    display_name: user?.display_name || user?.username || '',
    location: user?.location || '',
    organization: user?.organization || '',
    bio: user?.bio || '',
    interests: [],
  })

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const toggle = (arr, val) => arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val]

  const finish = async () => {
    setLoading(true)
    try {
      await api.put('/users/me', { ...form, onboarding_completed: 1 })
    } catch (_) {}
    // Persist onboarding flag in Supabase metadata so it survives DB wipes + logouts
    try {
      await supabase.auth.updateUser({ data: { onboarding_completed: true, ...form } })
    } catch (_) {}
    // Always mark complete locally so ProtectedLayout lets us through
    updateUser({ onboarding_completed: 1, ...form })
    navigate('/dashboard')
    setLoading(false)
  }

  const name = user?.display_name || user?.username || 'there'

  return (
    <div className="min-h-screen flex flex-col items-center justify-start pt-8 px-4"
      style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 60%, #0f172a 100%)' }}>

      {/* Top: Step indicator */}
      <div className="w-full max-w-2xl flex items-center justify-center mb-8">
        <div className="flex items-center gap-0">
          {STEPS.map((s, i) => (
            <div key={s.n} className="flex items-center">
              <div className="flex flex-col items-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-all border-2 ${
                  step > s.n
                    ? 'bg-teal-500 border-teal-500 text-white'
                    : step === s.n
                    ? 'bg-teal-500/20 border-teal-400 text-teal-300'
                    : 'bg-transparent border-slate-600 text-slate-500'
                }`}>
                  {step > s.n ? <Check className="w-3.5 h-3.5" /> : s.n}
                </div>
                <span className="text-xs mt-1.5 font-medium" style={{
                  color: step >= s.n ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.3)'
                }}>{s.label}</span>
              </div>
              {i < STEPS.length - 1 && (
                <div className="w-16 h-px mb-5 mx-1" style={{
                  background: step > s.n ? '#14b8a6' : 'rgba(255,255,255,0.15)'
                }} />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Card */}
      <div className="w-full max-w-2xl rounded-2xl p-8" style={{ background: 'rgba(15,23,42,0.8)', border: '1px solid rgba(255,255,255,0.08)' }}>

        {/* ── Step 1: Welcome ── */}
        {step === 1 && (
          <div className="text-center">
            <div className="flex justify-center mb-4">
              <NibiMascotImage mood="openarms" size={140}/>
            </div>
            <h1 className="text-2xl font-bold text-white mb-3">
              Woohoo, it's great to meet you, {name}!
            </h1>
            <p className="text-slate-400 mb-6 max-w-md mx-auto leading-relaxed">
              Welcome to my home! I'll guide you as you explore this site — a place to monitor, learn about, and protect water quality across the Great Lakes region.
            </p>
            <div className="rounded-xl p-4 text-left mb-6" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <p className="font-semibold text-white text-sm mb-1">Your account has been created!</p>
              <p className="text-slate-400 text-sm leading-relaxed">
                Your account <span className="text-white font-semibold">@{user?.username}</span> works everywhere on this platform — Community, Resources, Research tools, and more. You'll never be asked to create a separate profile on any page.
              </p>
            </div>
            <button onClick={() => setStep(2)}
              className="w-full py-3.5 rounded-xl font-semibold text-white flex items-center justify-center gap-2 transition-all hover:opacity-90"
              style={{ background: 'linear-gradient(135deg, #0ea5e9, #14b8a6)' }}>
              Let's Set Up Your Profile <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* ── Step 2: Your Profile ── */}
        {step === 2 && (
          <div>
            <div className="flex items-center gap-4 mb-6">
              <div style={{ width: 64, height: 86, flexShrink: 0 }}>
                <NibiMascotImage mood="wave" size={64}/>
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">Tell us about yourself</h2>
                <p className="text-slate-400 text-sm">This helps your new community to know who they're working with</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-sm font-semibold mb-1.5 block" style={{ color: 'rgba(255,255,255,0.7)' }}>Display Name</label>
                <input value={form.display_name} onChange={e => set('display_name', e.target.value)}
                  placeholder="Your name"
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'white' }}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-semibold mb-1.5 block" style={{ color: 'rgba(255,255,255,0.7)' }}>Location</label>
                  <input value={form.location} onChange={e => set('location', e.target.value)}
                    placeholder="SSM"
                    style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'white' }}
                  />
                </div>
                <div>
                  <label className="text-sm font-semibold mb-1.5 block" style={{ color: 'rgba(255,255,255,0.7)' }}>Organization</label>
                  <input value={form.organization} onChange={e => set('organization', e.target.value)}
                    placeholder="NORDIK Institute"
                    style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'white' }}
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-semibold mb-1.5 block" style={{ color: 'rgba(255,255,255,0.7)' }}>Short bio <span style={{ color: 'rgba(255,255,255,0.35)', fontWeight: 400 }}>(optional)</span></label>
                <textarea value={form.bio} onChange={e => set('bio', e.target.value)}
                  rows={3} placeholder="Tell the community a bit about yourself or your interest in water quality..."
                  className="resize-none"
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'white' }}
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={() => setStep(1)} className="px-5 py-3 rounded-xl font-semibold text-sm transition-all"
                style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.6)' }}>
                Back
              </button>
              <button onClick={() => setStep(3)}
                className="flex-1 py-3 rounded-xl font-semibold text-white flex items-center justify-center gap-2 transition-all hover:opacity-90"
                style={{ background: 'linear-gradient(135deg, #0ea5e9, #14b8a6)' }}>
                Continue <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* ── Step 3: Platform Tour ── */}
        {step === 3 && (
          <div>
            <div className="flex items-center gap-4 mb-4">
              <div style={{ width: 64, height: 86, flexShrink: 0 }}>
                <NibiMascotImage mood="pointing" size={64}/>
              </div>
              <div>
                <h2 className="text-xl font-bold text-white mb-1">Here's what you can do</h2>
                <p className="text-slate-400 text-sm">Explore these sections using the navigation sidebar</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-5">
              {FEATURES.map(f => (
                <div key={f.title} className="p-4 rounded-xl" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <div className="text-2xl mb-2">{f.icon}</div>
                  <div className="font-semibold text-white text-sm mb-1">{f.title}</div>
                  <div className="text-slate-400 text-xs leading-relaxed">{f.desc}</div>
                </div>
              ))}
            </div>

            <div className="p-4 rounded-xl mb-6 text-sm" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.7)' }}>
              <strong className="text-white">Navigation tip:</strong> Use the sidebar on the left to navigate between sections. Start with <strong className="text-white">Quick Actions</strong> for a full overview of what's available.
            </div>

            <div className="flex gap-3">
              <button onClick={() => setStep(2)} className="px-5 py-3 rounded-xl font-semibold text-sm transition-all"
                style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.6)' }}>
                Back
              </button>
              <button onClick={() => setStep(4)}
                className="flex-1 py-3 rounded-xl font-semibold text-white flex items-center justify-center gap-2 transition-all hover:opacity-90"
                style={{ background: 'linear-gradient(135deg, #0ea5e9, #14b8a6)' }}>
                Almost Done! <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* ── Step 4: Get Started ── */}
        {step === 4 && (
          <div className="text-center">
            <div className="flex justify-center mb-4">
              <NibiMascotImage mood="jumping" size={140}/>
            </div>
            <h2 className="text-2xl font-bold text-white mb-3">You're ready!</h2>
            <p className="text-slate-400 mb-6">
              Welcome to the SOURCE Water community. You're now ready to explore the platform.
            </p>

            <div className="rounded-xl p-4 text-left mb-4" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <p className="font-semibold text-white text-sm mb-3">Quick start ideas:</p>
              {[
                'Explore the Dashboard to see current water data',
                'Introduce yourself in the Community',
                'Check out Resources for learning materials',
                'Ask Water (AI Assistant) any water quality questions',
              ].map(item => (
                <div key={item} className="flex items-start gap-2.5 mb-2">
                  <div className="w-4 h-4 rounded-full bg-teal-500 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Check className="w-2.5 h-2.5 text-white" />
                  </div>
                  <span className="text-sm text-slate-300">{item}</span>
                </div>
              ))}
            </div>

            <p className="text-slate-500 text-sm mb-6">
              Need help? Email us at: <span className="text-white font-semibold">water@nordikinstitute.com</span>
            </p>

            <button onClick={finish} disabled={loading}
              className="w-full py-3.5 rounded-xl font-semibold text-white flex items-center justify-center gap-2 transition-all hover:opacity-90 disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg, #0ea5e9, #14b8a6)' }}>
              {loading ? 'Setting up...' : <>Go to Dashboard <ChevronRight className="w-4 h-4" /></>}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
