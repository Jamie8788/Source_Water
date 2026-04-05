import PageAmbience from '../components/layout/PageAmbience'
import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import api from '../utils/api'
import { useSound } from '../context/SoundContext'
import {
  Save, KeyRound, Camera, Award, Star,
  MapPin, FlaskConical, MessageSquare, GraduationCap,
  Activity, CheckCircle, Edit2, Globe, Calendar,
  Droplets, BarChart2, Users, Bookmark, Zap, Shield,
} from 'lucide-react'

/* ── Animated counter ── */
function AnimNum({ value }) {
  const [d, setD] = useState(0)
  const prev = useRef(0)
  useEffect(() => {
    const from = prev.current; const to = value || 0; prev.current = to
    if (from === to) return
    let start = null
    const step = (ts) => {
      if (!start) start = ts
      const p = Math.min((ts - start) / 700, 1)
      setD(Math.floor(from + (to - from) * (1 - Math.pow(1 - p, 3))))
      if (p < 1) requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
  }, [value])
  return <>{d.toLocaleString()}</>
}

/* ── XP progress bar ── */
function XPBar({ points }) {
  const level = Math.floor(points / 500) + 1
  const levelPoints = (level - 1) * 500
  const nextLevel = level * 500
  const progress = ((points - levelPoints) / (nextLevel - levelPoints)) * 100

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)' }}>Level {level} — Water Steward</span>
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{points} / {nextLevel} XP</span>
      </div>
      <div style={{ height: 8, background: 'var(--border)', borderRadius: 99, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${progress}%`, borderRadius: 99, background: 'linear-gradient(90deg,#6366f1,#14b8a6)', transition: 'width 0.8s cubic-bezier(0.4,0,0.2,1)', boxShadow: '0 0 8px rgba(99,102,241,0.4)' }}/>
      </div>
    </div>
  )
}

/* ── Achievement badge ── */
function AchievementBadge({ icon: Icon, label, desc, earned, color }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
      padding: '14px 10px', borderRadius: 12, textAlign: 'center', cursor: 'default',
      background: earned ? `${color}0d` : 'rgba(100,116,139,0.04)',
      border: `1px solid ${earned ? color + '30' : 'var(--border)'}`,
      opacity: earned ? 1 : 0.45, transition: 'all 0.2s',
    }}
    onMouseEnter={e => earned && (e.currentTarget.style.transform = 'translateY(-2px)')}
    onMouseLeave={e => (e.currentTarget.style.transform = 'none')}>
      <div style={{ width: 40, height: 40, borderRadius: '50%', background: earned ? `${color}18` : 'var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: earned ? `0 0 12px ${color}30` : 'none' }}>
        <Icon style={{ width: 18, height: 18, color: earned ? color : 'var(--text-light)' }}/>
      </div>
      <div>
        <div style={{ fontSize: 11, fontWeight: 700, color: earned ? 'var(--text)' : 'var(--text-muted)' }}>{label}</div>
        <div style={{ fontSize: 10, color: 'var(--text-light)', marginTop: 1 }}>{desc}</div>
      </div>
      {earned && <div style={{ width: 6, height: 6, borderRadius: '50%', background: color, boxShadow: `0 0 6px ${color}` }}/>}
    </div>
  )
}

const MOCK_ACTIVITY = [
  { type: 'observation', text: 'Logged field observation at Whitefish Lake (Turbidity: 3.2 NTU)', time: '2 hours ago', icon: Droplets, color: '#0ea5e9' },
  { type: 'quiz', text: 'Completed "Watershed Knowledge" quiz — Score 87%', time: '1 day ago', icon: GraduationCap, color: '#f59e0b' },
  { type: 'analysis', text: 'Ran water quality analysis on Q1_2025_samples.csv', time: '2 days ago', icon: BarChart2, color: '#6366f1' },
  { type: 'post', text: 'Posted field update in Community: Spring melt observations near Garden River', time: '3 days ago', icon: MessageSquare, color: '#ec4899' },
  { type: 'project', text: 'Joined project: Lake Superior Monitoring Initiative', time: '1 week ago', icon: FlaskConical, color: '#14b8a6' },
  { type: 'achievement', text: 'Earned achievement: Field Expert (50 observations)', time: '1 week ago', icon: Award, color: '#f59e0b' },
]

const ACHIEVEMENTS = [
  { icon: Droplets, label: 'First Drop', desc: '1st observation', color: '#0ea5e9', earned: true },
  { icon: MapPin, label: 'Explorer', desc: '5 sites visited', color: '#14b8a6', earned: true },
  { icon: FlaskConical, label: 'Lab Rat', desc: 'First analysis', color: '#6366f1', earned: true },
  { icon: GraduationCap, label: 'Quiz Ace', desc: 'Score 90%+', color: '#f59e0b', earned: true },
  { icon: Award, label: 'Field Expert', desc: '50 observations', color: '#f97316', earned: true },
  { icon: Star, label: 'Rising Star', desc: '500 XP earned', color: '#a855f7', earned: true },
  { icon: Users, label: 'Team Player', desc: 'Join a project', color: '#ec4899', earned: false },
  { icon: Shield, label: 'Guardian', desc: 'Report an issue', color: '#ef4444', earned: false },
  { icon: Zap, label: 'AI Power User', desc: '50 AI queries', color: '#8b5cf6', earned: false },
  { icon: Globe, label: 'Ambassador', desc: 'Invite 5 users', color: '#10b981', earned: false },
  { icon: Bookmark, label: 'Curator', desc: 'Bookmark 10 resources', color: '#0ea5e9', earned: false },
  { icon: BarChart2, label: 'Analyst', desc: 'Run 10 analyses', color: '#6366f1', earned: false },
]

const ROLE_LABELS = {
  admin: { label: 'Administrator', color: '#6366f1', bg: 'rgba(99,102,241,0.1)' },
  researcher: { label: 'Researcher', color: '#14b8a6', bg: 'rgba(20,184,166,0.1)' },
  student: { label: 'Student', color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
  community_member: { label: 'Community Member', color: '#10b981', bg: 'rgba(16,185,129,0.1)' },
}

export default function Profile() {
  const { user, updateUser } = useAuth()
  const { play } = useSound()
  const [tab, setTab] = useState('overview')
  const [form, setForm] = useState({
    display_name: user?.display_name || '',
    bio: user?.bio || '',
    community: user?.community || '',
    website: user?.website || '',
  })
  const [pwd, setPwd] = useState({ current: '', newPass: '', confirm: '' })
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [msgType, setMsgType] = useState('success')

  const points = user?.total_points || 840
  const level = Math.floor(points / 500) + 1
  const roleInfo = ROLE_LABELS[user?.role] || ROLE_LABELS.community_member

  const save = async e => {
    e.preventDefault(); setSaving(true); setMsg('')
    try {
      await api.put('/users/me', form)
      updateUser(form); play('success')
      setMsg('Profile updated successfully.'); setMsgType('success')
    } catch { setMsg('Failed to save changes.'); setMsgType('error') }
    finally { setSaving(false) }
  }

  const changePassword = async e => {
    e.preventDefault()
    if (pwd.newPass !== pwd.confirm) { setMsg('Passwords do not match.'); setMsgType('error'); return }
    try {
      await api.put('/users/me/password', { current_password: pwd.current, new_password: pwd.newPass })
      play('success'); setMsg('Password changed successfully.'); setMsgType('success')
      setPwd({ current: '', newPass: '', confirm: '' })
    } catch (err) { setMsg(err.response?.data?.error || 'Failed to change password.'); setMsgType('error') }
  }

  const TABS = ['overview', 'activity', 'achievements', 'settings']

  return (
    <div style={{ position: 'relative', minHeight: '100vh' }}>
      <PageAmbience variant="dashboard"/>

      <div style={{ maxWidth: 820, margin: '0 auto', padding: '0 4px', position: 'relative', zIndex: 1 }}>

        {/* Profile hero card */}
        <div style={{
          background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 16,
          overflow: 'hidden', marginBottom: 20, position: 'relative',
        }}>
          {/* Cover gradient */}
          <div style={{ height: 90, background: 'linear-gradient(135deg,#0f172a 0%,#1e1b4b 40%,#0d2b3e 100%)', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(rgba(99,102,241,0.2) 1px, transparent 1px)', backgroundSize: '20px 20px' }}/>
            <div style={{ position: 'absolute', right: 60, top: -20, width: 200, height: 200, borderRadius: '50%', background: 'radial-gradient(circle,rgba(20,184,166,0.15),transparent 70%)', pointerEvents: 'none' }}/>
          </div>

          <div style={{ padding: '0 24px 20px', position: 'relative' }}>
            {/* Avatar */}
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 14 }}>
              <div style={{ position: 'relative', marginTop: -28 }}>
                <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'linear-gradient(135deg,#6366f1,#14b8a6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, fontWeight: 900, color: '#fff', border: '3px solid var(--card-bg)', boxShadow: '0 4px 20px rgba(99,102,241,0.35)' }}>
                  {user?.display_name?.[0]?.toUpperCase() || user?.username?.[0]?.toUpperCase() || '?'}
                </div>
                <button style={{ position: 'absolute', bottom: 0, right: 0, width: 22, height: 22, borderRadius: '50%', background: '#6366f1', border: '2px solid var(--card-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                  <Camera style={{ width: 10, height: 10, color: '#fff' }}/>
                </button>
              </div>
              <div style={{ display: 'flex', gap: 8, paddingTop: 8 }}>
                <button onClick={() => { setTab('settings'); window.scrollTo({ top: 0, behavior: 'smooth' }) }}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 9, background: 'rgba(99,102,241,0.1)', color: '#818cf8', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                  <Edit2 style={{ width: 13, height: 13 }}/> Edit Profile
                </button>
              </div>
            </div>

            {/* Name + role */}
            <div style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 20, fontWeight: 900, color: 'var(--text)' }}>{user?.display_name || user?.username}</span>
                <span style={{ padding: '3px 12px', borderRadius: 20, fontSize: 12, fontWeight: 700, background: roleInfo.bg, color: roleInfo.color }}>{roleInfo.label}</span>
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>@{user?.username}</div>
              {user?.bio && <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 6, lineHeight: 1.5, maxWidth: 500 }}>{user.bio}</p>}
              <div style={{ display: 'flex', gap: 14, marginTop: 8, fontSize: 12, color: 'var(--text-muted)', flexWrap: 'wrap' }}>
                {user?.community && <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><MapPin style={{ width: 11, height: 11 }}/>{user.community}</span>}
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Calendar style={{ width: 11, height: 11 }}/>Joined {user?.created_at ? new Date(user.created_at).toLocaleDateString('en-CA', { year: 'numeric', month: 'long' }) : 'January 2024'}</span>
              </div>
            </div>

            {/* XP bar */}
            <div style={{ maxWidth: 420, marginBottom: 14 }}>
              <XPBar points={points}/>
            </div>

            {/* Quick stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: 10 }}>
              {[
                { label: 'Total XP', value: points, color: '#6366f1', icon: Zap },
                { label: 'Level', value: level, color: '#a855f7', icon: Star },
                { label: 'Observations', value: 47, color: '#14b8a6', icon: Droplets },
                { label: 'Quiz Score', value: '87%', color: '#f59e0b', icon: GraduationCap },
                { label: 'Projects', value: 3, color: '#10b981', icon: FlaskConical },
                { label: 'Achievements', value: ACHIEVEMENTS.filter(a => a.earned).length, color: '#f97316', icon: Award },
              ].map(s => (
                <div key={s.label} style={{ background: `${s.color}08`, border: `1px solid ${s.color}18`, borderRadius: 10, padding: '10px 12px', textAlign: 'center' }}>
                  <s.icon style={{ width: 14, height: 14, color: s.color, margin: '0 auto 4px' }}/>
                  <div style={{ fontSize: 18, fontWeight: 900, color: s.color, lineHeight: 1 }}>
                    {typeof s.value === 'number' ? <AnimNum value={s.value}/> : s.value}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 16, borderBottom: '1px solid var(--border)', paddingBottom: 0 }}>
          {TABS.map(t => (
            <button key={t} onClick={() => setTab(t)}
              style={{
                padding: '8px 16px', borderRadius: '8px 8px 0 0', border: 'none', cursor: 'pointer',
                fontSize: 13, fontWeight: tab === t ? 700 : 500, textTransform: 'capitalize',
                background: tab === t ? 'rgba(99,102,241,0.12)' : 'transparent',
                color: tab === t ? '#818cf8' : 'var(--text-muted)',
                borderBottom: tab === t ? '2px solid #6366f1' : '2px solid transparent',
                transition: 'all 0.15s',
              }}>
              {t}
            </button>
          ))}
        </div>

        {/* ── OVERVIEW TAB ── */}
        {tab === 'overview' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 14, padding: 18 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Activity style={{ width: 14, height: 14, color: '#6366f1' }}/> Recent Activity
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                {MOCK_ACTIVITY.slice(0, 4).map((a, i) => (
                  <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '8px 0', borderTop: i > 0 ? '1px solid var(--border)' : 'none' }}>
                    <div style={{ width: 30, height: 30, borderRadius: 8, background: `${a.color}12`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <a.icon style={{ width: 13, height: 13, color: a.color }}/>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.4 }}>{a.text}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{a.time}</div>
                    </div>
                  </div>
                ))}
              </div>
              <button onClick={() => setTab('activity')}
                style={{ marginTop: 10, width: '100%', padding: '7px 0', borderRadius: 9, background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.12)', color: '#818cf8', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                View All Activity
              </button>
            </div>

            <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 14, padding: 18 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Award style={{ width: 14, height: 14, color: '#f59e0b' }}/> Achievements
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                {ACHIEVEMENTS.slice(0, 6).map((a, i) => (
                  <AchievementBadge key={i} {...a}/>
                ))}
              </div>
              <button onClick={() => setTab('achievements')}
                style={{ marginTop: 10, width: '100%', padding: '7px 0', borderRadius: 9, background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.12)', color: '#f59e0b', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                All {ACHIEVEMENTS.length} Achievements
              </button>
            </div>
          </div>
        )}

        {/* ── ACTIVITY TAB ── */}
        {tab === 'activity' && (
          <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden' }}>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Activity style={{ width: 15, height: 15, color: '#6366f1' }}/>
              <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)' }}>Activity History</span>
              <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-muted)' }}>{MOCK_ACTIVITY.length} actions</span>
            </div>
            <div style={{ padding: '8px 18px' }}>
              {MOCK_ACTIVITY.map((a, i) => (
                <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '12px 0', borderTop: i > 0 ? '1px solid var(--border)' : 'none' }}>
                  <div style={{ width: 34, height: 34, borderRadius: 9, background: `${a.color}12`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <a.icon style={{ width: 15, height: 15, color: a.color }}/>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.5 }}>{a.text}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{a.time}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── ACHIEVEMENTS TAB ── */}
        {tab === 'achievements' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ flex: 1, background: 'var(--border)', height: 8, borderRadius: 99, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${(ACHIEVEMENTS.filter(a => a.earned).length / ACHIEVEMENTS.length) * 100}%`, background: 'linear-gradient(90deg,#f59e0b,#f97316)', borderRadius: 99, transition: 'width 0.8s' }}/>
              </div>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', flexShrink: 0 }}>
                {ACHIEVEMENTS.filter(a => a.earned).length} / {ACHIEVEMENTS.length} earned
              </span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 10 }}>
              {ACHIEVEMENTS.map((a, i) => <AchievementBadge key={i} {...a}/>)}
            </div>
          </div>
        )}

        {/* ── SETTINGS TAB ── */}
        {tab === 'settings' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {msg && (
              <div style={{ padding: '12px 16px', borderRadius: 10, fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8, background: msgType === 'success' ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)', border: `1px solid ${msgType === 'success' ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}`, color: msgType === 'success' ? '#10b981' : '#ef4444' }}>
                {msgType === 'success' ? <CheckCircle style={{ width: 15, height: 15 }}/> : null} {msg}
              </div>
            )}

            <form onSubmit={save} style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 14, padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 2 }}>Edit Profile</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 5 }}>Display Name</label>
                  <input value={form.display_name} onChange={e => setForm(f => ({ ...f, display_name: e.target.value }))} style={{ width: '100%', background: 'var(--card-bg)', border: '1.5px solid var(--border)', borderRadius: 9, padding: '8px 12px', fontSize: 13, color: 'var(--text)', outline: 'none' }}/>
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 5 }}>Community</label>
                  <input value={form.community} onChange={e => setForm(f => ({ ...f, community: e.target.value }))} placeholder="e.g. Sault Ste. Marie" style={{ width: '100%', background: 'var(--card-bg)', border: '1.5px solid var(--border)', borderRadius: 9, padding: '8px 12px', fontSize: 13, color: 'var(--text)', outline: 'none' }}/>
                </div>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 5 }}>Bio</label>
                <textarea rows={3} value={form.bio} onChange={e => setForm(f => ({ ...f, bio: e.target.value }))} placeholder="Tell the community about your work and interests…" style={{ width: '100%', background: 'var(--card-bg)', border: '1.5px solid var(--border)', borderRadius: 9, padding: '8px 12px', fontSize: 13, color: 'var(--text)', outline: 'none', resize: 'none' }}/>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 5 }}>Website</label>
                <input value={form.website} onChange={e => setForm(f => ({ ...f, website: e.target.value }))} placeholder="https://" style={{ width: '100%', background: 'var(--card-bg)', border: '1.5px solid var(--border)', borderRadius: 9, padding: '8px 12px', fontSize: 13, color: 'var(--text)', outline: 'none' }}/>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 5 }}>Email (read-only)</label>
                <input value={user?.email || ''} readOnly style={{ width: '100%', background: 'var(--card-bg)', border: '1.5px solid var(--border)', borderRadius: 9, padding: '8px 12px', fontSize: 13, color: 'var(--text-muted)', outline: 'none', opacity: 0.7, cursor: 'not-allowed' }}/>
              </div>
              <button type="submit" disabled={saving}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '10px 0', borderRadius: 10, background: saving ? 'rgba(99,102,241,0.5)' : '#6366f1', color: '#fff', border: 'none', cursor: saving ? 'not-allowed' : 'pointer', fontSize: 14, fontWeight: 700 }}>
                <Save style={{ width: 15, height: 15 }}/> {saving ? 'Saving…' : 'Save Profile'}
              </button>
            </form>

            <form onSubmit={changePassword} style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 14, padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 2 }}>
                <KeyRound style={{ width: 16, height: 16, color: '#6366f1' }}/> Change Password
              </div>
              {['current', 'newPass', 'confirm'].map((k) => (
                <div key={k}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 5 }}>
                    {k === 'current' ? 'Current Password' : k === 'newPass' ? 'New Password' : 'Confirm New Password'}
                  </label>
                  <input type="password" value={pwd[k]} onChange={e => setPwd(p => ({ ...p, [k]: e.target.value }))} minLength={k !== 'current' ? 6 : 0}
                    style={{ width: '100%', background: 'var(--card-bg)', border: '1.5px solid var(--border)', borderRadius: 9, padding: '8px 12px', fontSize: 13, color: 'var(--text)', outline: 'none' }}/>
                </div>
              ))}
              <button type="submit"
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '10px 0', borderRadius: 10, background: 'rgba(99,102,241,0.1)', color: '#818cf8', border: '1px solid rgba(99,102,241,0.2)', cursor: 'pointer', fontSize: 14, fontWeight: 700 }}>
                Change Password
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  )
}
