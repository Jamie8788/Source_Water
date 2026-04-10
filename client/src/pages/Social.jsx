import PageAmbience from '../components/layout/PageAmbience'
import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useAuth } from '../context/AuthContext'
import { useSound } from '../context/SoundContext'
import { useSearchParams } from 'react-router-dom'
import { useChat } from '../hooks/useChat'
import api from '../utils/api'
import {
  useFeed, createPost, deletePost, fetchComments, addComment, deleteComment,
  toggleReaction, useConversations, useMessages, sendDM, deleteDM, editDM, searchUsers,
} from '../hooks/useSocial'
import {
  Send, X, Image, Video, Mic, MicOff, Search, UserPlus,
  ArrowLeft, MessageCircle, MoreHorizontal,
  Award, TrendingUp, Bell, Hash, Trash2, Pin, Plus, Edit2, Check,
  Bookmark, BookmarkCheck, Filter, BarChart2,
} from 'lucide-react'

/* ─────────────────────────────────────────────────────────────── */
/*  CSS Animations                                                  */
/* ─────────────────────────────────────────────────────────────── */
const STYLES = `
@keyframes slideUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
@keyframes popIn{from{opacity:0;transform:scale(0.85)}to{opacity:1;transform:scale(1)}}
@keyframes floatUp{0%{opacity:1;transform:translateY(0) scale(1)}100%{opacity:0;transform:translateY(-40px) scale(1.4)}}
@keyframes shimmer{0%{background-position:-400px 0}100%{background-position:400px 0}}
@keyframes heartBurst{0%{transform:scale(1)}50%{transform:scale(1.6)}100%{transform:scale(1)}}
@keyframes storyPulse{0%,100%{opacity:1}50%{opacity:0.6}}
@keyframes fadeIn{from{opacity:0}to{opacity:1}}
@keyframes slideRight{from{opacity:0;transform:translateX(-12px)}to{opacity:1;transform:translateX(0)}}
@keyframes notifDrop{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:translateY(0)}}
.anim-slide-up{animation:slideUp 0.35s cubic-bezier(.34,1.3,.64,1) both}
.anim-pop-in{animation:popIn 0.25s cubic-bezier(.34,1.4,.64,1) both}
.anim-fade{animation:fadeIn 0.2s ease both}
.anim-notif{animation:notifDrop 0.2s ease both}
.skeleton-pulse{background:linear-gradient(90deg,var(--page-bg) 25%,rgba(99,102,241,0.07) 50%,var(--page-bg) 75%);background-size:400px 100%;animation:shimmer 1.4s infinite}
.dm-bubble-out{background:linear-gradient(135deg,#6366f1,#8b5cf6)!important;color:#fff!important}
.dm-bubble-in{background:var(--card-bg)!important;color:var(--text)!important}
.msg-hover:hover .msg-actions{opacity:1!important}
.msg-actions{opacity:0;transition:opacity 0.15s}
.story-ring{background:linear-gradient(45deg,#f09433,#e6683c,#dc2743,#cc2366,#bc1888);padding:2px;border-radius:50%}
.story-ring-seen{background:var(--border);padding:2px;border-radius:50%}
.notif-dot{position:absolute;top:-2px;right:-2px;width:8px;height:8px;border-radius:50%;background:#ef4444;border:2px solid var(--card-bg)}
.poll-bar{transition:width 0.6s cubic-bezier(.34,1.56,.64,1)}
`

const STORY_GRADIENTS = [
  'linear-gradient(135deg,#667eea,#764ba2)',
  'linear-gradient(135deg,#f093fb,#f5576c)',
  'linear-gradient(135deg,#4facfe,#00f2fe)',
  'linear-gradient(135deg,#43e97b,#38f9d7)',
  'linear-gradient(135deg,#fa709a,#fee140)',
  'linear-gradient(135deg,#a18cd1,#fbc2eb)',
  'linear-gradient(135deg,#fda085,#f6d365)',
  'linear-gradient(135deg,#0ea5e9,#6366f1)',
]

const REACTIONS = [
  { type:'drop',      emoji:'💧', label:'Drop',     color:'#0ea5e9' },
  { type:'wave',      emoji:'🌊', label:'Wave',     color:'#14b8a6' },
  { type:'bubble',    emoji:'🫧', label:'Bubble',   color:'#8b5cf6' },
  { type:'curious',   emoji:'🔬', label:'Curious',  color:'#f59e0b' },
  { type:'great_work',emoji:'⭐', label:'Star',     color:'#f97316' },
]

// Water parameter patterns for auto-detection in post content
const WATER_PARAM_PATTERNS = [
  { re:/\bpH\s*[:=]?\s*(\d+\.?\d*)/i,              label:'pH',          color:'#0ea5e9' },
  { re:/\bturbidity\s*[:=]?\s*(\d+\.?\d*)/i,        label:'Turbidity',   color:'#f59e0b' },
  { re:/\b(DO|dissolved\s*oxygen)\s*[:=]?\s*(\d+\.?\d*)/i, label:'DO',  color:'#10b981' },
  { re:/\btemperature\s*[:=]?\s*(\d+\.?\d*)/i,      label:'Temp',        color:'#ef4444' },
  { re:/\bconductivity\s*[:=]?\s*(\d+\.?\d*)/i,     label:'Conductivity',color:'#8b5cf6' },
  { re:/\bnitrate\s*[:=]?\s*(\d+\.?\d*)/i,           label:'Nitrate',    color:'#f97316' },
  { re:/\bphosphorus\s*[:=]?\s*(\d+\.?\d*)/i,        label:'Phosphorus', color:'#ec4899' },
  { re:/\btds\s*[:=]?\s*(\d+\.?\d*)/i,               label:'TDS',        color:'#14b8a6' },
  { re:/\btss\s*[:=]?\s*(\d+\.?\d*)/i,               label:'TSS',        color:'#6366f1' },
  { re:/\bchlorophyll\s*[:=]?\s*(\d+\.?\d*)/i,       label:'Chlorophyll',color:'#22c55e' },
]

function detectWaterParams(content) {
  if (!content) return []
  const found = []
  WATER_PARAM_PATTERNS.forEach(({ re, label, color }) => {
    const m = content.match(re)
    if (m) found.push({ label, value: m[2] || m[1], color })
  })
  return found
}

// Bookmarks (localStorage)
const BKEY = 'sw_post_bookmarks'
function getBookmarks() {
  try { return new Set(JSON.parse(localStorage.getItem(BKEY) || '[]')) } catch { return new Set() }
}
function toggleBookmarkPost(id) {
  const bms = getBookmarks()
  if (bms.has(id)) bms.delete(id); else bms.add(id)
  localStorage.setItem(BKEY, JSON.stringify([...bms]))
  return bms.has(id)
}

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:3001/api').replace('/api','')
const mediaUrl  = (src) => !src ? '' : src.startsWith('http') ? src : `${API_BASE}${src}`
const timeAgo   = (d) => {
  const diff = Date.now() - new Date(d)
  if (diff < 60000) return 'just now'
  if (diff < 3600000) return Math.floor(diff/60000)+'m'
  if (diff < 86400000) return Math.floor(diff/3600000)+'h'
  return Math.floor(diff/86400000)+'d'
}

/* ─── Avatar ─────────────────────────────────────────────────── */
function Avatar({ user, size=40, story=false, seen=false, onClick }) {
  const name = user?.display_name || user?.username || '?'
  const bg   = user?.avatar_bg_color || '#6366f1'
  const inner = user?.avatar_url
    ? <img src={mediaUrl(user.avatar_url)} alt={name}
        className="rounded-full object-cover w-full h-full" style={{display:'block'}}/>
    : <div className="rounded-full flex items-center justify-center w-full h-full font-bold text-white"
        style={{background:bg, fontSize:size*0.38}}>{name[0]?.toUpperCase()}</div>

  if (story) return (
    <button onClick={onClick} className={seen ? 'story-ring-seen' : 'story-ring'} style={{width:size+4,height:size+4,flexShrink:0}}>
      <div style={{width:size,height:size,borderRadius:'50%',overflow:'hidden',border:'2px solid var(--card-bg)',background:'var(--card-bg)'}}>{inner}</div>
    </button>
  )
  return (
    <div className="rounded-full flex-shrink-0 overflow-hidden" style={{width:size,height:size,cursor:onClick?'pointer':undefined}} onClick={onClick}>{inner}</div>
  )
}

/* ─── Media Grid ─────────────────────────────────────────────── */
function MediaGrid({ media, type }) {
  const [errs, setErrs] = useState({})
  if (!media?.length) return null
  const isVid = type==='video' || media[0]?.match(/\.(mp4|webm|mov)$/i) || media[0]?.includes('video')
  if (isVid) return (
    <div className="rounded-2xl overflow-hidden bg-black mb-3" style={{maxHeight:400}}>
      <video controls src={mediaUrl(media[0])} className="w-full max-h-96 object-contain"/>
    </div>
  )
  const good = media.slice(0,4).filter((_,i)=>!errs[i])
  if (!good.length) return null
  const cols = good.length===1?1:good.length===2?2:3
  return (
    <div className="grid gap-1 mb-3 rounded-2xl overflow-hidden" style={{gridTemplateColumns:`repeat(${cols},1fr)`}}>
      {media.slice(0,4).map((src,i)=>errs[i]?null:(
        <div key={i} className="relative" style={{paddingBottom:good.length===1?'56%':'100%'}}>
          <img src={mediaUrl(src)} alt="" className="absolute inset-0 w-full h-full object-cover"
            onError={()=>setErrs(p=>({...p,[i]:true}))}/>
          {i===3&&media.length>4&&(
            <div className="absolute inset-0 bg-black/60 flex items-center justify-center text-white font-black text-2xl">+{media.length-4}</div>
          )}
        </div>
      ))}
    </div>
  )
}

/* ─── Story Viewer ───────────────────────────────────────────── */
function StoryViewer({ groups, startGroupIdx, onClose }) {
  const [gIdx, setGIdx] = useState(startGroupIdx)
  const [sIdx, setSIdx] = useState(0)
  const [progress, setProgress] = useState(0)
  const timerRef = useRef(null)
  const DURATION = 5000

  const group = groups[gIdx]
  const story = group?.stories[sIdx]

  const next = useCallback(() => {
    if (sIdx < group.stories.length-1) { setSIdx(s=>s+1); setProgress(0) }
    else if (gIdx < groups.length-1) { setGIdx(g=>g+1); setSIdx(0); setProgress(0) }
    else onClose()
  }, [sIdx, gIdx, group, groups, onClose])

  const prev = () => {
    if (sIdx > 0) { setSIdx(s=>s-1); setProgress(0) }
    else if (gIdx > 0) { setGIdx(g=>g-1); setSIdx(0); setProgress(0) }
  }

  useEffect(() => {
    clearInterval(timerRef.current)
    setProgress(0)
    const start = Date.now()
    timerRef.current = setInterval(() => {
      const elapsed = Date.now() - start
      const pct = Math.min((elapsed / DURATION) * 100, 100)
      setProgress(pct)
      if (pct >= 100) { clearInterval(timerRef.current); next() }
    }, 50)
    return () => clearInterval(timerRef.current)
  }, [gIdx, sIdx]) // eslint-disable-line

  if (!group || !story) return null
  const isImg = story.media?.[0] && !story.media[0].match(/\.(mp4|webm)$/i)
  const isVid = story.media?.[0] && story.media[0].match(/\.(mp4|webm)$/i)

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/95 anim-fade"
      onClick={onClose}>
      <div className="relative w-full max-w-sm h-full max-h-[90vh] flex flex-col"
        onClick={e=>e.stopPropagation()}>
        <div className="absolute top-0 left-0 right-0 z-10 flex gap-1 p-3">
          {group.stories.map((_,i)=>(
            <div key={i} className="flex-1 h-0.5 rounded-full overflow-hidden" style={{background:'rgba(255,255,255,0.3)'}}>
              <div className="h-full rounded-full transition-none"
                style={{background:'white', width: i<sIdx?'100%': i===sIdx?`${progress}%`:'0%'}}/>
            </div>
          ))}
        </div>
        <div className="absolute top-8 left-0 right-0 z-10 flex items-center gap-2 px-4 py-2">
          <Avatar user={group.user} size={36}/>
          <div>
            <div className="text-white font-bold text-sm">{group.user.display_name||group.user.username}</div>
            <div className="text-white/60 text-xs">{timeAgo(story.created_at)}</div>
          </div>
          <button onClick={onClose} className="ml-auto text-white/80 hover:text-white">
            <X className="w-5 h-5"/>
          </button>
        </div>
        <div className="flex-1 rounded-2xl overflow-hidden relative flex items-center justify-center"
          style={{background: story.bg_gradient || STORY_GRADIENTS[0], marginTop:16}}>
          {isImg && <img src={mediaUrl(story.media[0])} alt="" className="w-full h-full object-cover absolute inset-0"/>}
          {isVid && <video src={mediaUrl(story.media[0])} autoPlay muted loop className="w-full h-full object-cover absolute inset-0"/>}
          {story.content && (
            <div className="relative z-10 px-8 py-6 text-center">
              <p className="text-white font-black text-2xl leading-snug drop-shadow-lg">{story.content}</p>
            </div>
          )}
        </div>
        <div className="absolute inset-0 flex top-16" style={{zIndex:5}}>
          <div className="flex-1" onClick={prev}/>
          <div className="flex-1" onClick={next}/>
        </div>
      </div>
    </div>
  )
}

/* ─── Story Creator ──────────────────────────────────────────── */
function StoryCreator({ user, onClose, onCreated }) {
  const [text, setText] = useState('')
  const [gradIdx, setGradIdx] = useState(0)
  const [mediaFile, setMediaFile] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const fileRef = useRef(null)

  const submit = async () => {
    if (!text.trim() && !mediaFile) return
    setSubmitting(true)
    try {
      const userId = user?.supabase_id || user?.id
      const posted = await createPost({ userId, content: text, postType:'story', files: mediaFile ? [mediaFile] : [] })
      onCreated(posted)
      onClose()
    } catch(e) { alert(e.message) }
    setSubmitting(false)
  }

  return (
    <div className="fixed inset-0 z-[998] flex items-center justify-center bg-black/80 anim-fade" onClick={onClose}>
      <div className="w-full max-w-sm rounded-3xl overflow-hidden anim-pop-in" onClick={e=>e.stopPropagation()}
        style={{background:'var(--card-bg)',border:'1px solid var(--border)'}}>
        <div className="relative h-48 flex items-center justify-center"
          style={{background: mediaFile ? undefined : STORY_GRADIENTS[gradIdx]}}>
          {mediaFile
            ? <img src={URL.createObjectURL(mediaFile)} alt="" className="w-full h-full object-cover"/>
            : <textarea value={text} onChange={e=>setText(e.target.value)} placeholder="What's on your mind? ✨"
                className="bg-transparent text-white text-xl font-bold text-center w-full resize-none outline-none placeholder-white/60 px-4"
                rows={3} maxLength={150}/>
          }
          <button onClick={onClose} className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/40 flex items-center justify-center text-white">
            <X className="w-4 h-4"/>
          </button>
        </div>
        {!mediaFile && (
          <div className="flex gap-2 px-4 py-3 overflow-x-auto">
            {STORY_GRADIENTS.map((g,i)=>(
              <button key={i} onClick={()=>setGradIdx(i)}
                className="w-7 h-7 rounded-full flex-shrink-0 transition-transform"
                style={{background:g, transform:gradIdx===i?'scale(1.3)':'scale(1)', outline:gradIdx===i?'2px solid #6366f1':'none', outlineOffset:2}}/>
            ))}
          </div>
        )}
        <div className="flex gap-3 px-4 pb-4">
          <input ref={fileRef} type="file" accept="image/*,video/*" className="hidden"
            onChange={e=>setMediaFile(e.target.files?.[0]||null)}/>
          <button onClick={()=>fileRef.current?.click()}
            className="flex-1 py-2 rounded-xl text-sm font-semibold border transition-colors"
            style={{borderColor:'var(--border)',color:'var(--text)'}}>
            <Image className="w-4 h-4 inline mr-1"/>Photo
          </button>
          <button onClick={submit} disabled={submitting||(!text.trim()&&!mediaFile)}
            className="flex-1 py-2 rounded-xl text-sm font-bold text-white disabled:opacity-50"
            style={{background:'linear-gradient(135deg,#6366f1,#8b5cf6)'}}>
            {submitting ? '...' : '+ Add Story'}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ─── Stories Bar ────────────────────────────────────────────── */
function StoriesBar({ groups, currentUser, onView, onAdd }) {
  return (
    <div className="card mb-4 overflow-hidden">
      <div className="flex gap-3 px-4 py-3 overflow-x-auto" style={{scrollbarWidth:'none'}}>
        <div className="flex flex-col items-center gap-1 flex-shrink-0 cursor-pointer" onClick={onAdd}>
          <div className="relative">
            <Avatar user={currentUser} size={56}/>
            <div className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full flex items-center justify-center text-white text-xs font-black"
              style={{background:'linear-gradient(135deg,#6366f1,#8b5cf6)'}}>+</div>
          </div>
          <span className="text-xs font-semibold truncate w-14 text-center" style={{color:'var(--text-muted)'}}>Your story</span>
        </div>
        {groups.map((g,i)=>(
          <div key={g.user?.id||i} className="flex flex-col items-center gap-1 flex-shrink-0 cursor-pointer" onClick={()=>onView(i)}>
            <Avatar user={g.user} size={56} story seen={g.seen}/>
            <span className="text-xs font-semibold truncate w-14 text-center" style={{color:'var(--text)'}}>
              {g.user?.display_name?.split(' ')[0] || g.user?.username}
            </span>
          </div>
        ))}
        {groups.length === 0 && (
          <p className="text-xs self-center py-1" style={{color:'var(--text-muted)'}}>No stories yet — be the first!</p>
        )}
      </div>
    </div>
  )
}

/* ─── Poll View ──────────────────────────────────────────────── */
function PollView({ post, currentUserId }) {
  const raw = post.poll_options
  // Support both old array format and new object format {options:[], votes:{}}
  const opts   = Array.isArray(raw) ? raw : (raw?.options || [])
  const [votes, setVotes] = useState(raw?.votes || {})
  const total  = Object.values(votes).reduce((s, v) => s + (Array.isArray(v) ? v.length : 0), 0)
  const myVoteIdx = Object.entries(votes).find(([, v]) => (v||[]).some(id => String(id) === String(currentUserId)))?.[0]

  const vote = async (e, idx) => {
    e.stopPropagation()
    if (myVoteIdx !== undefined) return // already voted
    try {
      const r = await api.post(`/posts/${post.id}/poll/vote`, { option_index: idx })
      setVotes(r.data?.votes || {})
    } catch {}
  }

  const showResults = myVoteIdx !== undefined

  if (!opts.length) return null
  return (
    <div className="rounded-2xl p-4 mb-3" style={{background:'var(--page-bg)', border:'1px solid var(--border)'}}>
      {post.poll_question && (
        <div className="flex items-center gap-2 mb-3">
          <BarChart2 className="w-4 h-4 flex-shrink-0" style={{color:'#6366f1'}}/>
          <p className="font-bold text-sm" style={{color:'var(--text)'}}>{post.poll_question}</p>
        </div>
      )}
      {opts.map((opt, i) => {
        const vCount  = (votes[i] || []).length
        const pct     = total > 0 ? Math.round((vCount / total) * 100) : 0
        const isMe    = String(myVoteIdx) === String(i)
        return (
          <button key={i} onClick={e => vote(e, i)} disabled={showResults}
            className="w-full text-left mb-2 rounded-xl overflow-hidden relative"
            style={{border:`1.5px solid ${isMe ? '#6366f1' : 'var(--border)'}`, cursor: showResults ? 'default' : 'pointer',
              background:'var(--card-bg)', transition:'border-color 0.2s'}}>
            {/* % fill bar */}
            {showResults && (
              <div className="absolute inset-0 rounded-xl poll-bar"
                style={{background: isMe ? 'rgba(99,102,241,0.18)' : 'rgba(99,102,241,0.06)', width:`${pct}%`, maxWidth:'100%'}}/>
            )}
            <div className="relative flex items-center justify-between px-4 py-2.5">
              <span className="text-sm font-medium" style={{color: isMe ? '#6366f1' : 'var(--text)'}}>
                {isMe && <Check className="w-3 h-3 inline mr-1.5 text-indigo-500"/>}{opt}
              </span>
              {showResults && (
                <span className="text-xs font-black ml-2 flex-shrink-0" style={{color: isMe ? '#6366f1' : 'var(--text-muted)'}}>
                  {pct}%
                </span>
              )}
            </div>
          </button>
        )
      })}
      <p className="text-xs text-center mt-1" style={{color:'var(--text-muted)'}}>
        {showResults ? `${total} vote${total!==1?'s':''} · Your vote recorded` : 'Tap to vote'}
      </p>
    </div>
  )
}

/* ─── Notifications Panel ────────────────────────────────────── */
function NotificationsPanel({ onClose }) {
  const [notifs, setNotifs]   = useState([])
  const [unread, setUnread]   = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/notifications').then(r => {
      setNotifs(r.data.notifications || [])
      setUnread(r.data.unread || 0)
    }).catch(() => {}).finally(() => setLoading(false))
  }, [])

  const readAll = async () => {
    await api.post('/notifications/read-all').catch(() => {})
    setNotifs(p => p.map(n => ({ ...n, read: 1 })))
    setUnread(0)
  }

  const ICONS = { dm:'💬', reaction:'💧', comment:'🗨️', follow:'👤', default:'🔔' }
  const icon = (t) => ICONS[t] || ICONS.default

  return (
    <div className="absolute right-0 top-full mt-2 w-80 rounded-2xl shadow-2xl border overflow-hidden anim-notif z-50"
      style={{background:'var(--card-bg)', borderColor:'var(--border)'}}>
      <div className="flex items-center justify-between px-4 py-3 border-b" style={{borderColor:'var(--border)'}}>
        <h3 className="font-black text-sm" style={{color:'var(--text)'}}>Notifications</h3>
        <div className="flex items-center gap-2">
          {unread > 0 && (
            <button onClick={readAll} className="text-xs font-bold px-2 py-0.5 rounded-lg hover:bg-indigo-50 transition-colors"
              style={{color:'#6366f1'}}>Mark all read</button>
          )}
          <button onClick={onClose}><X className="w-4 h-4" style={{color:'var(--text-muted)'}}/></button>
        </div>
      </div>
      <div className="max-h-96 overflow-y-auto">
        {loading ? (
          <div className="p-8 text-center text-sm" style={{color:'var(--text-muted)'}}>Loading…</div>
        ) : notifs.length === 0 ? (
          <div className="p-8 text-center">
            <div className="text-4xl mb-2">🔔</div>
            <p className="text-sm" style={{color:'var(--text-muted)'}}>No notifications yet</p>
          </div>
        ) : notifs.map(n => (
          <div key={n.id} className="flex items-start gap-3 px-4 py-3 border-b transition-colors hover:bg-indigo-50/20"
            style={{borderColor:'var(--border)', background: n.read ? 'transparent' : 'rgba(99,102,241,0.04)'}}>
            <span className="text-lg flex-shrink-0 mt-0.5">{icon(n.type)}</span>
            <div className="flex-1 min-w-0">
              {n.title && <p className="text-xs font-black" style={{color:'var(--text)'}}>{n.title}</p>}
              <p className="text-xs leading-snug" style={{color:'var(--text-muted)'}}>{n.message}</p>
              <p className="text-xs mt-0.5" style={{color:'var(--text-muted)',opacity:.7}}>{timeAgo(n.created_at)}</p>
            </div>
            {!n.read && <div className="w-2 h-2 rounded-full bg-indigo-500 flex-shrink-0 mt-1.5"/>}
          </div>
        ))}
      </div>
    </div>
  )
}

/* ─── Post Card ──────────────────────────────────────────────── */
function PostCard({ post, currentUser, onDelete, onPin, animDelay=0, onHashtagClick }) {
  const [showComments, setShowComments] = useState(false)
  const [comment, setComment]           = useState('')
  const [comments, setComments]         = useState([])
  const [showReact, setShowReact]       = useState(false)
  const [myReaction, setMyReaction]     = useState(null)
  const [reactCounts, setReactCounts]   = useState(post.reactions||{})
  const [showMenu, setShowMenu]         = useState(false)
  const [heartAnim, setHeartAnim]       = useState(false)
  const [pointAnim, setPointAnim]       = useState(false)
  const [bookmarked, setBookmarked]     = useState(() => getBookmarks().has(post.id))
  const reactTimer = useRef(null)
  const lastTap    = useRef(0)

  const author      = post.user || { display_name:post.display_name, username:post.username }
  const totalReacts = Object.values(reactCounts).reduce((a,b)=>a+b,0)
  const waterParams = useMemo(() => detectWaterParams(post.content), [post.content])

  const loadComments = async () => {
    if (!showComments) setComments(await fetchComments(post.id).catch(()=>[]))
    setShowComments(s=>!s)
  }

  const submitComment = async () => {
    if (!comment.trim()) return
    const userId = currentUser?.supabase_id || currentUser?.id
    const nc = await addComment(post.id, userId, comment).catch(()=>null)
    if (nc) { setComments(p=>[...p,nc]); setComment('') }
  }

  const handleReact = async (type) => {
    setShowReact(false)
    const userId = currentUser?.supabase_id || currentUser?.id
    const added = await toggleReaction(post.id, userId, type).catch(()=>null)
    if (added === null) return
    if (!added) {
      setReactCounts(p=>({...p,[type]:Math.max(0,(p[type]||0)-1)}))
      setMyReaction(null)
    } else {
      if (myReaction) setReactCounts(p=>({...p,[myReaction]:Math.max(0,(p[myReaction]||0)-1)}))
      setReactCounts(p=>({...p,[type]:(p[type]||0)+1}))
      setMyReaction(type)
      setPointAnim(true); setTimeout(()=>setPointAnim(false),1200)
    }
  }

  const doubleTap = () => {
    const now = Date.now()
    if (now - lastTap.current < 350) { setHeartAnim(true); setTimeout(()=>setHeartAnim(false),600); handleReact('drop') }
    lastTap.current = now
  }

  const handleBookmark = (e) => {
    e.stopPropagation()
    setBookmarked(toggleBookmarkPost(post.id))
  }

  // Render content with clickable hashtags
  const renderContent = (text) => text.split(/(#\w+)/g).map((pt, i) =>
    pt.startsWith('#')
      ? <span key={i} className="font-semibold cursor-pointer hover:underline" style={{color:'#6366f1'}}
          onClick={e=>{e.stopPropagation();onHashtagClick?.(pt)}}>{pt}</span>
      : pt
  )

  return (
    <div className="card overflow-visible relative anim-slide-up"
      style={{marginBottom:16, animationDelay:`${animDelay}ms`}}>
      {post.pinned===1 && (
        <div className="px-4 pt-3 flex items-center gap-1.5 text-xs font-bold" style={{color:'#f59e0b'}}>
          <Pin className="w-3 h-3"/> Pinned
        </div>
      )}
      <div className="p-4" onClick={doubleTap}>
        {/* Author */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="relative">
              <Avatar user={author} size={44}/>
              <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2"
                style={{borderColor:'var(--card-bg)', background:'#22c55e'}}/>
            </div>
            <div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-black text-sm" style={{color:'var(--text)'}}>{author.display_name||author.username}</span>
                {author.role && author.role !== 'Community member' && (
                  <span className="text-xs px-1.5 py-0.5 rounded-full font-semibold"
                    style={{background:'rgba(99,102,241,0.12)',color:'#6366f1',fontSize:10}}>{author.role}</span>
                )}
              </div>
              <div className="text-xs" style={{color:'var(--text-muted)'}}>
                @{author.username} · {timeAgo(post.created_at)}
                {post.location_tag && <span className="ml-1">📍{post.location_tag}</span>}
              </div>
            </div>
          </div>
          <div className="relative">
            <button onClick={e=>{e.stopPropagation();setShowMenu(s=>!s)}}
              className="p-1.5 rounded-xl hover:bg-gray-100 transition-colors">
              <MoreHorizontal className="w-4 h-4" style={{color:'var(--text-muted)'}}/>
            </button>
            {showMenu && (
              <div className="absolute right-0 top-8 rounded-2xl shadow-2xl border py-1 z-30 w-44 anim-pop-in"
                style={{background:'var(--card-bg)',borderColor:'var(--border)'}}>
                {(post.user_id===currentUser?.id||currentUser?.is_admin) && (
                  <button onClick={()=>{onDelete(post.id);setShowMenu(false)}}
                    className="flex items-center gap-2 w-full px-4 py-2 text-sm hover:bg-red-50 text-red-500 transition-colors">
                    <Trash2 className="w-3.5 h-3.5"/> Delete post
                  </button>
                )}
                {currentUser?.is_admin && (
                  <button onClick={()=>{onPin(post.id);setShowMenu(false)}}
                    className="flex items-center gap-2 w-full px-4 py-2 text-sm transition-colors"
                    style={{color:'var(--text)'}}>
                    <Pin className="w-3.5 h-3.5"/> {post.pinned?'Unpin':'Pin post'}
                  </button>
                )}
                <button onClick={()=>{navigator.clipboard?.writeText(post.content);setShowMenu(false)}}
                  className="flex items-center gap-2 w-full px-4 py-2 text-sm transition-colors"
                  style={{color:'var(--text)'}}>
                  <Check className="w-3.5 h-3.5"/> Copy text
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Content */}
        {post.content && (
          <p className="text-sm leading-relaxed mb-3" style={{color:'var(--text)'}}>
            {renderContent(post.content)}
          </p>
        )}

        {/* Water parameter auto-chips */}
        {waterParams.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {waterParams.map(({label, value, color}) => (
              <span key={label} className="text-xs px-2.5 py-0.5 rounded-full font-bold"
                style={{background:color+'18', color, border:`1px solid ${color}30`}}>
                💧 {label}{value ? `: ${value}` : ''}
              </span>
            ))}
          </div>
        )}

        <MediaGrid media={post.media} type={post.post_type}/>

        {post.post_type==='audio'&&post.media?.[0]&&(
          <audio controls src={mediaUrl(post.media[0])} className="w-full rounded-xl mb-3"/>
        )}

        {/* Poll */}
        {post.poll_options && (
          <PollView post={post} currentUserId={currentUser?.id}/>
        )}

        {/* Heart burst */}
        {heartAnim && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
            <span style={{fontSize:64,animation:'heartBurst 0.6s ease both'}}>💧</span>
          </div>
        )}

        {/* Reactions summary */}
        {totalReacts>0 && (
          <div className="flex items-center gap-1 mb-2">
            <div className="flex">
              {REACTIONS.filter(r=>reactCounts[r.type]>0).slice(0,3).map(r=>(
                <span key={r.type} className="text-sm -ml-0.5 first:ml-0">{r.emoji}</span>
              ))}
            </div>
            <span className="text-xs" style={{color:'var(--text-muted)'}}>{totalReacts}</span>
          </div>
        )}

        {/* Action bar */}
        <div className="flex items-center gap-1 pt-3 border-t relative" style={{borderColor:'var(--border)'}}>
          {/* React */}
          <div className="relative"
            onMouseEnter={()=>{clearTimeout(reactTimer.current);setShowReact(true)}}
            onMouseLeave={()=>{reactTimer.current=setTimeout(()=>setShowReact(false),350)}}>
            <button className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold transition-all hover:bg-gray-50 active:scale-95"
              style={{color:myReaction?REACTIONS.find(r=>r.type===myReaction)?.color:'var(--text-muted)'}}>
              <span className="text-base">{myReaction?REACTIONS.find(r=>r.type===myReaction)?.emoji:'😊'}</span>
              <span className="text-xs">{myReaction?REACTIONS.find(r=>r.type===myReaction)?.label:'React'}</span>
            </button>
            {showReact && (
              <div className="absolute bottom-full left-0 mb-2 rounded-2xl shadow-2xl border flex gap-1 p-2 z-30 anim-pop-in"
                style={{background:'var(--card-bg)',borderColor:'var(--border)'}}>
                {REACTIONS.map(r=>(
                  <button key={r.type} onClick={e=>{e.stopPropagation();handleReact(r.type)}} title={r.label}
                    className="flex flex-col items-center gap-0.5 p-2 rounded-xl transition-all hover:scale-125 active:scale-110"
                    style={{background:myReaction===r.type?r.color+'22':'transparent'}}>
                    <span className="text-xl">{r.emoji}</span>
                    <span style={{fontSize:9,color:r.color,fontWeight:700}}>{r.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <button onClick={e=>{e.stopPropagation();loadComments()}}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold transition-all hover:bg-gray-50 active:scale-95"
            style={{color:'var(--text-muted)'}}>
            <MessageCircle className="w-4 h-4"/>
            <span className="text-xs">{showComments?'Hide':post.comment_count||0}</span>
          </button>

          {/* Bookmark */}
          <button onClick={handleBookmark}
            className="flex items-center gap-1 px-3 py-2 rounded-xl text-sm transition-all hover:bg-gray-50 active:scale-95"
            style={{color: bookmarked ? '#6366f1' : 'var(--text-muted)'}}>
            {bookmarked ? <BookmarkCheck className="w-4 h-4"/> : <Bookmark className="w-4 h-4"/>}
          </button>

          {/* +pts float */}
          <div className="relative ml-auto">
            {pointAnim && (
              <span className="absolute -top-6 left-0 text-xs font-black text-green-500"
                style={{animation:'floatUp 1.1s ease both',whiteSpace:'nowrap'}}>+1 pt</span>
            )}
          </div>
        </div>
      </div>

      {/* Comments */}
      {showComments && (
        <div className="border-t px-4 py-3 space-y-2 anim-fade" style={{background:'var(--page-bg)',borderColor:'var(--border)'}}>
          {comments.map((c,i)=>(
            <div key={c.id||i} className="flex gap-2 anim-slide-up" style={{animationDelay:`${i*40}ms`}}>
              <Avatar user={{display_name:c.display_name,username:c.username}} size={28}/>
              <div className="rounded-2xl rounded-tl-sm px-3 py-2 flex-1" style={{background:'var(--card-bg)'}}>
                <span className="font-bold text-xs mr-2" style={{color:'#6366f1'}}>{c.display_name||c.username}</span>
                <span className="text-sm" style={{color:'var(--text)'}}>{c.content}</span>
              </div>
            </div>
          ))}
          <div className="flex gap-2">
            <Avatar user={currentUser} size={28}/>
            <div className="flex-1 flex gap-2">
              <input value={comment} onChange={e=>setComment(e.target.value)}
                onKeyDown={e=>e.key==='Enter'&&submitComment()}
                placeholder="Add a comment…"
                className="flex-1 text-sm py-1.5 px-3 rounded-full"
                style={{background:'var(--card-bg)',border:'1px solid var(--border)',color:'var(--text)'}}/>
              <button onClick={submitComment}
                className="w-8 h-8 rounded-full flex items-center justify-center text-white flex-shrink-0"
                style={{background:'linear-gradient(135deg,#6366f1,#8b5cf6)'}}>
                <Send className="w-3.5 h-3.5"/>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ─── Post Composer ──────────────────────────────────────────── */
function PostComposer({ user, onPost, onStory }) {
  const [expanded, setExpanded]   = useState(false)
  const [content, setContent]     = useState('')
  const [media, setMedia]         = useState([])
  const [postType, setPostType]   = useState('text')
  const [submitting, setSubmit]   = useState(false)
  const [err, setErr]             = useState('')
  const [pollMode, setPollMode]   = useState(false)
  const [pollQ, setPollQ]         = useState('')
  const [pollOpts, setPollOpts]   = useState(['', ''])
  const imgRef = useRef(null)
  const vidRef = useRef(null)

  const addPollOpt = () => { if (pollOpts.length < 4) setPollOpts(p=>[...p,'']) }
  const removePollOpt = (i) => { if (pollOpts.length > 2) setPollOpts(p=>p.filter((_,j)=>j!==i)) }
  const updatePollOpt = (i, v) => setPollOpts(p=>p.map((o,j)=>j===i?v:o))

  const submit = async () => {
    if (!content.trim()&&!media.length&&!pollMode) return
    if (pollMode && (!pollQ.trim() || pollOpts.filter(o=>o.trim()).length < 2)) {
      setErr('Poll needs a question and at least 2 options'); return
    }
    setSubmit(true); setErr('')
    try {
      const userId = user?.supabase_id||user?.id
      const posted = await createPost({
        userId, content, postType, files:media,
        pollQuestion: pollMode ? pollQ.trim() : '',
        pollOptions:  pollMode ? pollOpts.filter(o=>o.trim()) : [],
      })
      onPost(posted)
      setContent(''); setMedia([]); setExpanded(false); setPostType('text')
      setPollMode(false); setPollQ(''); setPollOpts(['',''])
    } catch(e) { setErr(e.message||'Upload failed') }
    setSubmit(false)
  }

  return (
    <div className="card p-4 mb-4">
      <div className="flex gap-3">
        <Avatar user={user} size={42}/>
        <div className="flex-1">
          {!expanded ? (
            <button onClick={()=>setExpanded(true)}
              className="w-full text-left px-4 py-2.5 rounded-full text-sm transition-all hover:border-indigo-300"
              style={{background:'var(--page-bg)',color:'var(--text-muted)',border:'1.5px solid var(--border)'}}>
              What's happening with water today? 💧
            </button>
          ) : (
            <div className="anim-fade">
              <textarea value={content} onChange={e=>setContent(e.target.value)} autoFocus
                placeholder={pollMode ? 'Add context to your poll (optional)…' : 'Share something with the water community…'}
                rows={3} maxLength={500}
                className="w-full resize-none text-sm p-3 rounded-2xl outline-none transition-all"
                style={{background:'var(--page-bg)',border:'1.5px solid var(--border)',color:'var(--text)'}}/>

              {/* Poll creator */}
              {pollMode && (
                <div className="mt-2 rounded-2xl p-3 space-y-2" style={{background:'var(--page-bg)',border:'1.5px solid var(--border)'}}>
                  <div className="flex items-center gap-2 mb-1">
                    <BarChart2 className="w-4 h-4 text-indigo-500"/>
                    <span className="text-xs font-black" style={{color:'#6366f1'}}>Poll</span>
                  </div>
                  <input value={pollQ} onChange={e=>setPollQ(e.target.value)} placeholder="Ask your question…"
                    className="w-full text-sm px-3 py-2 rounded-xl" maxLength={120}
                    style={{background:'var(--card-bg)',border:'1px solid var(--border)',color:'var(--text)'}}/>
                  {pollOpts.map((opt, i) => (
                    <div key={i} className="flex gap-2 items-center">
                      <input value={opt} onChange={e=>updatePollOpt(i, e.target.value)}
                        placeholder={`Option ${i+1}`} maxLength={80}
                        className="flex-1 text-sm px-3 py-1.5 rounded-xl"
                        style={{background:'var(--card-bg)',border:'1px solid var(--border)',color:'var(--text)'}}/>
                      {pollOpts.length > 2 && (
                        <button onClick={()=>removePollOpt(i)} className="text-red-400 hover:text-red-600"><X className="w-3.5 h-3.5"/></button>
                      )}
                    </div>
                  ))}
                  {pollOpts.length < 4 && (
                    <button onClick={addPollOpt} className="text-xs font-bold px-3 py-1 rounded-lg hover:bg-indigo-50"
                      style={{color:'#6366f1'}}>+ Add option</button>
                  )}
                </div>
              )}

              {media.length>0 && (
                <div className="flex gap-2 flex-wrap mt-2">
                  {media.map((f,i)=>(
                    <div key={i} className="relative">
                      {f.type.startsWith('video')
                        ? <video src={URL.createObjectURL(f)} className="h-20 rounded-xl object-cover" controls/>
                        : <img src={URL.createObjectURL(f)} alt="" className="h-20 w-20 object-cover rounded-xl"/>}
                      <button type="button" onClick={()=>setMedia(p=>p.filter((_,j)=>j!==i))}
                        className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center text-xs font-bold">×</button>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex items-center justify-between mt-3 pt-3 border-t flex-wrap gap-2" style={{borderColor:'var(--border)'}}>
                <div className="flex gap-1 flex-wrap">
                  <input ref={imgRef} type="file" accept="image/*" multiple className="hidden"
                    onChange={e=>{setMedia(p=>[...p,...Array.from(e.target.files||[])]);setPostType('image')}}/>
                  <button type="button" onClick={()=>imgRef.current?.click()}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-colors hover:bg-green-50"
                    style={{color:'#10b981'}}><Image className="w-4 h-4"/> Photo</button>
                  <input ref={vidRef} type="file" accept="video/*" className="hidden"
                    onChange={e=>{if(e.target.files?.[0]){setMedia([e.target.files[0]]);setPostType('video')}}}/>
                  <button type="button" onClick={()=>vidRef.current?.click()}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-colors hover:bg-red-50"
                    style={{color:'#ef4444'}}><Video className="w-4 h-4"/> Video</button>
                  <button type="button" onClick={()=>setPollMode(p=>!p)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-colors"
                    style={{color:'#6366f1', background: pollMode ? 'rgba(99,102,241,0.1)' : 'transparent'}}>
                    <BarChart2 className="w-4 h-4"/> Poll</button>
                  <button type="button" onClick={()=>{setExpanded(false);onStory()}}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-colors hover:bg-purple-50"
                    style={{color:'#8b5cf6'}}><Plus className="w-4 h-4"/> Story</button>
                  <span className="text-xs self-center px-1" style={{color:'var(--text-muted)'}}>{content.length}/500</span>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={()=>{setExpanded(false);setContent('');setMedia([]);setPollMode(false)}}
                    className="px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors"
                    style={{color:'var(--text-muted)',borderColor:'var(--border)'}}>Cancel</button>
                  {err && <span className="text-xs text-red-500 max-w-[140px] leading-tight">{err}</span>}
                  <button onClick={submit} disabled={submitting||(!content.trim()&&!media.length&&!pollMode)}
                    className="px-4 py-1.5 rounded-xl text-xs font-black text-white transition-all hover:opacity-90 active:scale-95 disabled:opacity-40"
                    style={{background:'linear-gradient(135deg,#6366f1,#8b5cf6)'}}>
                    {submitting ? 'Uploading…' : '✦ Post (+5 pts)'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/* ─── DM Panel ───────────────────────────────────────────────── */
function DMPanel({ onClose }) {
  const { user } = useAuth()
  const [view, setView]         = useState('list')
  const [selected, setSelected] = useState(null)
  const [messages, setMessages] = useState([])
  const [input, setInput]       = useState('')
  const [recording, setRecording] = useState(false)
  const [memberSearch, setMemberSearch] = useState('')
  const [members, setMembers]   = useState([])
  const [editId, setEditId]     = useState(null)
  const [editText, setEditText] = useState('')
  const mediaRef = useRef(null)
  const chunksRef = useRef([])
  const bottomRef = useRef(null)

  const { lastMessage, markAsRead, resetUnreadCount } = useChat(user?.id)
  const sbUserId = (() => {
    try { return JSON.parse(localStorage.getItem('sw_user') || 'null')?.id } catch { return null }
  })() || user?.id
  const { convos, refresh: fetchConvos } = useConversations(sbUserId)
  const { messages: sbMessages, ready: msgsReady, refresh: refreshMessages } = useMessages(sbUserId, selected?.other_user_id)

  useEffect(()=>{ bottomRef.current?.scrollIntoView({behavior:'smooth'}) },[messages])
  useEffect(()=>{ if(msgsReady) setMessages(sbMessages) },[sbMessages,msgsReady])
  useEffect(()=>{ if(view==='chat'&&selected?.other_user_id){markAsRead();resetUnreadCount()} },[view,selected?.other_user_id,markAsRead,resetUnreadCount])
  useEffect(()=>{
    if(!lastMessage||!selected?.other_user_id) return
    if(lastMessage.sender_id===selected.other_user_id||lastMessage.receiver_id===selected.other_user_id) refreshMessages()
    else fetchConvos()
  },[lastMessage]) // eslint-disable-line

  const openConvo = (c) => { setSelected(c); setView('chat') }
  const startWith = (m) => { setSelected({other_user_id:m.id,display_name:m.display_name,username:m.username,avatar_url:m.avatar_url}); setView('chat') }

  const searchMembers = async (q) => {
    setMemberSearch(q)
    if (q.length < 2) { setMembers([]); return }
    setMembers(await searchUsers(q, sbUserId).catch(()=>[]))
  }

  const send = async () => {
    if (!input.trim()||!selected) return
    const content = input; setInput('')
    setMessages(p=>[...p,{content,sender_id:Number(sbUserId)||sbUserId,created_at:new Date().toISOString()}])
    const msg = await sendDM(sbUserId, selected.other_user_id, content).catch(()=>null)
    if (msg?.id) refreshMessages()
  }

  const handleDeleteMsg = async (msgId) => {
    await deleteDM(msgId).catch(()=>{})
    setMessages(p=>p.filter(m=>m.id!==msgId))
  }

  const handleEditMsg = async (msgId) => {
    if (!editText.trim()) return
    await editDM(msgId, editText).catch(()=>{})
    setMessages(p=>p.map(m=>m.id===msgId?{...m,content:editText,edited:1}:m))
    setEditId(null); setEditText('')
  }

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({audio:true})
      const mr = new MediaRecorder(stream)
      chunksRef.current = []
      mr.ondataavailable = e => chunksRef.current.push(e.data)
      mr.onstop = async () => {
        const blob = new Blob(chunksRef.current,{type:'audio/webm'})
        const vf = new File([blob],'voice.webm',{type:'audio/webm'})
        const msg = await sendDM(sbUserId,selected.other_user_id,'',vf).catch(()=>null)
        if(msg&&msg.id) setMessages(p=>[...p,msg])
        stream.getTracks().forEach(t=>t.stop())
      }
      mediaRef.current=mr; mr.start(); setRecording(true)
    } catch { alert('Microphone access denied') }
  }
  const stopRecording = () => { mediaRef.current?.stop(); setRecording(false) }

  return (
    <div className="fixed bottom-0 right-6 w-[360px] rounded-t-2xl shadow-2xl z-50 flex flex-col overflow-hidden"
      style={{height:520,background:'var(--card-bg)',border:'1px solid var(--border)',borderBottom:'none'}}>

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 flex-shrink-0"
        style={{background:'linear-gradient(135deg,#6366f1,#8b5cf6)'}}>
        <div className="flex items-center gap-2">
          {(view==='chat'||view==='new')&&(
            <button onClick={()=>setView('list')} className="text-white/80 hover:text-white mr-1"><ArrowLeft className="w-4 h-4"/></button>
          )}
          <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
            {view==='chat'&&selected
              ? <span className="text-white text-sm font-black">{(selected.display_name||selected.username)?.[0]?.toUpperCase()}</span>
              : <MessageCircle className="w-4 h-4 text-white"/>}
          </div>
          <div>
            <h2 className="font-black text-sm text-white">
              {view==='list'?'Messages':view==='new'?'New Chat':(selected?.display_name||selected?.username)}
            </h2>
            {view==='chat'&&<p className="text-xs text-white/60">active now</p>}
          </div>
        </div>
        <div className="flex items-center gap-1">
          {view==='list'&&(
            <button onClick={()=>{setView('new');setMemberSearch('');setMembers([])}}
              className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition-colors">
              <UserPlus className="w-4 h-4 text-white"/>
            </button>
          )}
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/20 transition-colors">
            <X className="w-4 h-4 text-white"/>
          </button>
        </div>
      </div>

      {/* Conversations */}
      {view==='list'&&(
        <div className="flex-1 overflow-y-auto">
          {convos.length===0 ? (
            <div className="p-8 text-center">
              <div className="text-5xl mb-3">💬</div>
              <p className="font-bold text-sm mb-4" style={{color:'var(--text)'}}>No conversations yet</p>
              <button onClick={()=>{setView('new');setMemberSearch('');setMembers([])}}
                className="text-xs font-bold text-white px-4 py-2 rounded-xl"
                style={{background:'linear-gradient(135deg,#6366f1,#8b5cf6)'}}>
                <UserPlus className="w-3.5 h-3.5 inline mr-1"/> New Message
              </button>
            </div>
          ) : convos.map(c=>(
            <button key={c.other_user_id} onClick={()=>openConvo(c)}
              className="w-full flex items-center gap-3 px-4 py-3 text-left border-b transition-colors hover:bg-indigo-50/30"
              style={{borderColor:'var(--border)'}}>
              <div className="w-11 h-11 rounded-full flex items-center justify-center text-white font-black flex-shrink-0"
                style={{background:'linear-gradient(135deg,#6366f1,#8b5cf6)'}}>
                {(c.display_name||c.username)?.[0]?.toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-sm" style={{color:'var(--text)'}}>{c.display_name||c.username}</div>
                <div className="text-xs truncate" style={{color:'var(--text-muted)'}}>{c.last_message||'Start chatting…'}</div>
              </div>
              {c.unread_count>0&&(
                <span className="w-5 h-5 rounded-full text-white text-xs flex items-center justify-center font-black flex-shrink-0"
                  style={{background:'#6366f1'}}>{c.unread_count}</span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Search new */}
      {view==='new'&&(
        <div className="flex-1 overflow-y-auto">
          <div className="p-3 border-b" style={{borderColor:'var(--border)',background:'var(--page-bg)'}}>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"/>
              <input value={memberSearch} onChange={e=>searchMembers(e.target.value)}
                placeholder="Search people…" autoFocus
                className="w-full pl-9 pr-3 py-2 text-sm rounded-full"
                style={{background:'var(--card-bg)',border:'1px solid var(--border)',color:'var(--text)'}}/>
            </div>
          </div>
          <div>
            {memberSearch.length<2&&<p className="p-4 text-xs text-center" style={{color:'var(--text-muted)'}}>Type 2+ characters to search</p>}
            {members.map(m=>(
              <button key={m.id} onClick={()=>startWith(m)}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-indigo-50/30 transition-colors text-left border-b"
                style={{borderColor:'var(--border)'}}>
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-black text-sm flex-shrink-0"
                  style={{background:'linear-gradient(135deg,#6366f1,#8b5cf6)'}}>
                  {(m.display_name||m.username)?.[0]?.toUpperCase()}
                </div>
                <div>
                  <div className="font-bold text-sm" style={{color:'var(--text)'}}>{m.display_name||m.username}</div>
                  <div className="text-xs" style={{color:'var(--text-muted)'}}>@{m.username}</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Chat */}
      {view==='chat'&&(
        <>
          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-1"
            style={{background:'var(--page-bg)',backgroundImage:'radial-gradient(circle,rgba(99,102,241,0.04) 1px,transparent 1px)',backgroundSize:'20px 20px'}}>
            {messages.length===0&&(
              <div className="text-center text-xs py-8 rounded-2xl px-4 mx-auto max-w-xs"
                style={{background:'rgba(99,102,241,0.06)',color:'var(--text-muted)'}}>
                💬 Say hi to {selected?.display_name||selected?.username}!
              </div>
            )}
            {messages.map((m,i)=>{
              const isMine = String(m.sender_id) === String(sbUserId)
              const isImg  = m.media&&!m.media.match?.(/\.(webm|mp3|ogg)$/i)&&m.message_type!=='voice_note'
              const isVid  = m.media&&m.media.match?.(/\.(mp4|webm|mov)$/i)
              return (
                <div key={m.id||i} className={`flex msg-hover ${isMine?'justify-end':'justify-start'} gap-1.5 items-end`}>
                  {!isMine&&<Avatar user={{username:selected?.username,display_name:selected?.display_name}} size={24}/>}
                  <div className="max-w-[76%] relative group">
                    {editId===m.id ? (
                      <div className="flex gap-1">
                        <input value={editText} onChange={e=>setEditText(e.target.value)}
                          onKeyDown={e=>{if(e.key==='Enter')handleEditMsg(m.id);if(e.key==='Escape'){setEditId(null)}}}
                          className="text-sm px-3 py-1.5 rounded-2xl flex-1"
                          style={{background:'var(--card-bg)',border:'1.5px solid #6366f1',color:'var(--text)'}}
                          autoFocus/>
                        <button onClick={()=>handleEditMsg(m.id)} className="text-indigo-500"><Check className="w-4 h-4"/></button>
                      </div>
                    ) : (
                      <>
                        {m.voice_note&&(
                          <audio controls src={mediaUrl(m.voice_note)} style={{height:40,maxWidth:'100%',borderRadius:20}}/>
                        )}
                        {isVid&&!m.voice_note&&(
                          <video controls src={mediaUrl(m.media)} className="rounded-2xl" style={{maxWidth:'100%',maxHeight:200}}/>
                        )}
                        {isImg&&!isVid&&!m.voice_note&&(
                          <img src={mediaUrl(m.media)} alt="" className="rounded-2xl object-cover"
                            style={{maxWidth:200,maxHeight:200,display:'block'}}/>
                        )}
                        {(m.content||(!m.media&&!m.voice_note))&&(
                          <div className={`px-3.5 py-2 rounded-2xl text-sm shadow-sm ${isMine?'dm-bubble-out rounded-br-sm':'dm-bubble-in rounded-bl-sm'}`}>
                            {m.content&&<p>{m.content}</p>}
                            <p className="text-right mt-0.5" style={{fontSize:10,opacity:0.6}}>
                              {new Date(m.created_at).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}
                              {m.edited?' · edited':''}
                            </p>
                          </div>
                        )}
                        {isMine&&(
                          <div className="msg-actions absolute -top-6 right-0 flex gap-1 bg-white shadow-lg rounded-xl px-1.5 py-1 border"
                            style={{borderColor:'var(--border)'}}>
                            {!m.voice_note&&!m.media&&(
                              <button onClick={()=>{setEditId(m.id);setEditText(m.content||'')}}
                                className="p-0.5 hover:text-indigo-500 transition-colors" title="Edit">
                                <Edit2 className="w-3 h-3"/>
                              </button>
                            )}
                            <button onClick={()=>handleDeleteMsg(m.id)}
                              className="p-0.5 hover:text-red-500 transition-colors" title="Delete">
                              <Trash2 className="w-3 h-3"/>
                            </button>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              )
            })}
            <div ref={bottomRef}/>
          </div>

          <div className="flex-shrink-0 border-t" style={{background:'var(--card-bg)',borderColor:'var(--border)'}}>
            <div className="flex items-center gap-2 p-2">
              <button onClick={recording?stopRecording:startRecording}
                className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 transition-all ${recording?'bg-red-500 animate-pulse':''}`}
                style={{background:recording?'#ef4444':'var(--page-bg)'}}>
                {recording?<MicOff className="w-4 h-4 text-white"/>:<Mic className="w-4 h-4" style={{color:'var(--text-muted)'}}/>}
              </button>
              <label className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 cursor-pointer"
                style={{background:'var(--page-bg)'}}>
                <Image className="w-4 h-4" style={{color:'var(--text-muted)'}}/>
                <input type="file" accept="image/*,video/*" className="hidden" onChange={async e=>{
                  const file = e.target.files?.[0]; if(!file||!selected) return
                  try{
                    const msg=await sendDM(sbUserId,selected.other_user_id,'',file)
                    if(msg&&msg.id) setMessages(p=>[...p,msg])
                    refreshMessages()
                  }catch(err){ console.error('DM image send failed:',err) }
                  e.target.value=''
                }}/>
              </label>
              <input value={input} onChange={e=>setInput(e.target.value)}
                onKeyDown={e=>e.key==='Enter'&&!e.shiftKey&&send()}
                placeholder="Type a message…"
                className="flex-1 text-sm py-2 px-4 rounded-full outline-none"
                style={{background:'var(--page-bg)',border:'1.5px solid var(--border)',color:'var(--text)'}}/>
              <button onClick={send} disabled={!input.trim()}
                className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 disabled:opacity-40 transition-all active:scale-90"
                style={{background:'linear-gradient(135deg,#6366f1,#8b5cf6)'}}>
                <Send className="w-4 h-4 text-white"/>
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

/* ─── Leaderboard Card ───────────────────────────────────────── */
function LeaderboardCard({ currentUserId, onShowFull }) {
  const [data, setData] = useState([])
  const medals = ['🥇','🥈','🥉']
  const load = useCallback(()=>{
    api.get('/leaderboard').then(r=>setData((r.data.leaderboard||[]).slice(0,5))).catch(()=>{})
  },[])
  useEffect(()=>{ load(); const t=setInterval(load,30000); return()=>clearInterval(t) },[load])
  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Award className="w-4 h-4 text-yellow-500"/>
          <h3 className="font-black text-sm" style={{color:'var(--text)'}}>Top Contributors</h3>
        </div>
        <button onClick={onShowFull} className="text-xs font-bold px-2 py-0.5 rounded-lg hover:bg-indigo-50 transition-colors"
          style={{color:'#6366f1'}}>See all →</button>
      </div>
      <div className="space-y-2">
        {data.map((u,i)=>(
          <div key={u.id||i} className="flex items-center gap-2.5 rounded-xl px-2 py-1 transition-all"
            style={{background:u.id===currentUserId?'rgba(99,102,241,0.08)':'transparent'}}>
            <span className="text-base w-5 text-center flex-shrink-0">{medals[i]||`${i+1}`}</span>
            <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-black text-white flex-shrink-0"
              style={{background:u.id===currentUserId?'linear-gradient(135deg,#f59e0b,#ef4444)':'linear-gradient(135deg,#6366f1,#14b8a6)'}}>
              {(u.display_name||u.username)?.[0]?.toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-bold truncate" style={{color:'var(--text)'}}>
                {u.display_name||u.username}{u.id===currentUserId&&<span className="text-indigo-500 ml-1">(you)</span>}
              </div>
            </div>
            <div className="text-xs font-black" style={{color:'#6366f1'}}>{u.points||0}</div>
          </div>
        ))}
        {data.length===0&&<p className="text-xs text-center py-2" style={{color:'var(--text-muted)'}}>No data yet</p>}
      </div>
    </div>
  )
}

/* ─── Full Leaderboard ───────────────────────────────────────── */
function FullLeaderboard({ currentUserId, onClose, inline=false }) {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [visible, setVisible] = useState(false)
  const medals = ['🥇','🥈','🥉']
  useEffect(()=>{
    api.get('/leaderboard').then(r=>{ setData(r.data.leaderboard||[]); setLoading(false); setTimeout(()=>setVisible(true),50) }).catch(()=>setLoading(false))
  },[])
  const myRank = data.findIndex(u=>u.id===currentUserId)+1
  const myData = data.find(u=>u.id===currentUserId)
  const inner = (
    <div style={inline?{}:{background:'var(--card-bg)',border:'1px solid var(--border)',borderRadius:20,overflow:'hidden',
      transform:visible?'scale(1) translateY(0)':'scale(0.95) translateY(20px)',opacity:visible?1:0,transition:'all 0.3s cubic-bezier(.34,1.56,.64,1)'}}>
      <div className="relative px-5 py-4 text-center"
        style={{background:'linear-gradient(135deg,rgba(99,102,241,0.15),rgba(139,92,246,0.1))'}}>
        <h2 className="font-black text-xl" style={{color:'var(--text)'}}>🏆 Leaderboard</h2>
        <p className="text-xs mt-0.5" style={{color:'var(--text-muted)'}}>Monthly · {new Date().toLocaleString('default',{month:'long',year:'numeric'})}</p>
        {!inline&&<button onClick={onClose} className="absolute right-4 top-4 w-7 h-7 rounded-full flex items-center justify-center"
          style={{background:'var(--page-bg)',color:'var(--text-muted)'}}><X className="w-4 h-4"/></button>}
      </div>
      {myData&&(
        <div className="mx-4 mt-3 rounded-2xl px-4 py-2.5 flex items-center gap-3"
          style={{background:'linear-gradient(135deg,rgba(99,102,241,0.12),rgba(139,92,246,0.08))',border:'1.5px solid rgba(99,102,241,0.25)'}}>
          <span className="text-2xl">{medals[myRank-1]||`#${myRank}`}</span>
          <div className="flex-1">
            <div className="text-xs font-semibold" style={{color:'var(--text-muted)'}}>Your ranking</div>
            <div className="font-black text-sm" style={{color:'#6366f1'}}>Rank #{myRank} · {myData.points||0} pts</div>
          </div>
        </div>
      )}
      <div className={`px-4 py-3 space-y-1.5 ${inline?'':'overflow-y-auto max-h-[55vh]'}`}>
        {loading ? <div className="text-center py-8 text-sm" style={{color:'var(--text-muted)'}}>Loading…</div>
          : data.map((u,i)=>(
          <div key={u.id||i} className="flex items-center gap-3 rounded-2xl px-3 py-2.5 transition-all"
            style={{background:u.id===currentUserId?'linear-gradient(135deg,rgba(99,102,241,0.1),rgba(139,92,246,0.07))':'var(--card-bg)',
              border:u.id===currentUserId?'1.5px solid rgba(99,102,241,0.25)':'1px solid var(--border)',
              transform:visible?'translateX(0)':'translateX(-16px)',opacity:visible?1:0,
              transition:`all 0.3s ease ${Math.min(i*0.04,0.6)}s`}}>
            <span className="w-8 text-center font-black text-sm flex-shrink-0"
              style={{color:i<3?['#f59e0b','#9ca3af','#b45309'][i]:'var(--text-muted)'}}>{medals[i]||`#${i+1}`}</span>
            <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-black text-white flex-shrink-0"
              style={{background:u.id===currentUserId?'linear-gradient(135deg,#f59e0b,#ef4444)':'linear-gradient(135deg,#6366f1,#14b8a6)'}}>
              {(u.display_name||u.username)?.[0]?.toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-bold text-sm flex items-center gap-1.5" style={{color:'var(--text)'}}>
                {u.display_name||u.username}
                {u.id===currentUserId&&<span className="text-xs px-1.5 py-0.5 rounded-full font-bold"
                  style={{background:'#6366f1',color:'white'}}>You</span>}
              </div>
              <div className="text-xs" style={{color:'var(--text-muted)'}}>{u.posts}p · {u.quizzes_passed}q · {u.observations}obs</div>
            </div>
            <div className="text-right flex-shrink-0">
              <div className="font-black text-base" style={{color:i===0?'#f59e0b':i===1?'#9ca3af':i===2?'#b45309':'#6366f1'}}>{u.points||0}</div>
              <div className="text-xs" style={{color:'var(--text-muted)'}}>pts</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
  if (inline) return <div className="max-w-2xl mx-auto">{inner}</div>
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="w-full max-w-lg">{inner}</div>
    </div>
  )
}

/* ─── Trending Card ──────────────────────────────────────────── */
function TrendingCard({ posts, activeTag, onTagClick }) {
  const tags = Object.entries(
    (posts||[]).flatMap(p=>(p.content||'').match(/#\w+/g)||[])
      .reduce((acc,t)=>({...acc,[t]:(acc[t]||0)+1}),{})
  ).sort((a,b)=>b[1]-a[1]).slice(0,7)
  return (
    <div className="card p-4">
      <div className="flex items-center gap-2 mb-3">
        <TrendingUp className="w-4 h-4 text-indigo-500"/>
        <h3 className="font-black text-sm" style={{color:'var(--text)'}}>Trending</h3>
      </div>
      {tags.length===0
        ? <p className="text-xs" style={{color:'var(--text-muted)'}}>Post with #hashtags to trend!</p>
        : <div className="space-y-2">
          {tags.map(([tag,count])=>(
            <button key={tag} onClick={()=>onTagClick?.(activeTag===tag?null:tag)}
              className="w-full flex items-center justify-between rounded-xl px-2 py-1.5 transition-colors text-left"
              style={{background:activeTag===tag?'rgba(99,102,241,0.1)':'transparent'}}>
              <div className="flex items-center gap-1.5">
                <Hash className="w-3 h-3 flex-shrink-0" style={{color:'#6366f1'}}/>
                <span className="text-sm font-bold" style={{color:'#6366f1'}}>{tag.slice(1)}</span>
              </div>
              <span className="text-xs" style={{color:'var(--text-muted)'}}>{count} post{count>1?'s':''}</span>
            </button>
          ))}
        </div>
      }
    </div>
  )
}

/* ─── Main Social Page ───────────────────────────────────────── */
export default function Social() {
  const { user } = useAuth()
  const { play } = useSound()
  const [searchParams] = useSearchParams()
  const { posts, loading, setPosts, refresh: refreshFeed } = useFeed()

  const [showDM, setShowDM]           = useState(searchParams.get('dm')==='1')
  const [activeTab, setActiveTab]     = useState('feed')
  const [showLeaderboard, setShowLB]  = useState(false)
  const [myMonthPts, setMyMonthPts]   = useState(null)
  const [pointFlash, setPointFlash]   = useState(false)
  const [viewingStory, setViewingStory] = useState(null)
  const [creatingStory, setCreating]  = useState(false)
  const [seenStories, setSeenStories] = useState(new Set())

  // Feed filters
  const [searchQuery, setSearchQuery] = useState('')
  const [filterMode, setFilterMode]   = useState('all') // all | research | saved
  const [activeHashtag, setActiveHashtag] = useState(null)

  // Notifications
  const [showNotifs, setShowNotifs]   = useState(false)
  const [unreadNotifs, setUnreadNotifs] = useState(0)
  const notifRef = useRef(null)

  // Derive story groups from feed
  const storyGroups = useMemo(() => {
    const cutoff = Date.now() - 86400000
    const stories = posts.filter(p => p.post_type==='story' && new Date(p.created_at)>cutoff)
    const grouped = {}
    stories.forEach(s => {
      const uid = s.user?.id || s.user_id
      if (!grouped[uid]) grouped[uid] = { user: s.user||{id:uid,username:s.username}, stories:[], seen: seenStories.has(uid) }
      grouped[uid].stories.push({...s, bg_gradient: STORY_GRADIENTS[(s.id||0) % STORY_GRADIENTS.length]})
    })
    return Object.values(grouped)
  }, [posts, seenStories])

  // Filtered feed posts
  const feedPosts = useMemo(() => {
    let ps = posts.filter(p => p.post_type !== 'story')
    if (activeHashtag) ps = ps.filter(p => (p.content||'').toLowerCase().includes(activeHashtag.toLowerCase()))
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      ps = ps.filter(p => (p.content||'').toLowerCase().includes(q) || (p.user?.display_name||'').toLowerCase().includes(q) || (p.user?.username||'').toLowerCase().includes(q))
    }
    if (filterMode === 'research') {
      const researchRoles = ['Researcher','SOURCE Water team member','Water quality analyst']
      ps = ps.filter(p => researchRoles.some(r => (p.user?.role||'').includes(r)) || p.poll_question)
    }
    if (filterMode === 'saved') {
      const bms = getBookmarks()
      ps = ps.filter(p => bms.has(p.id))
    }
    return ps
  }, [posts, activeHashtag, searchQuery, filterMode])

  // Poll unread notifications
  useEffect(() => {
    const fetchUnread = () => {
      api.get('/notifications').then(r => setUnreadNotifs(r.data.unread || 0)).catch(() => {})
    }
    fetchUnread()
    const t = setInterval(fetchUnread, 30000)
    return () => clearInterval(t)
  }, [])

  // Close notif panel on outside click
  useEffect(() => {
    const handler = (e) => { if (notifRef.current && !notifRef.current.contains(e.target)) setShowNotifs(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  useEffect(()=>{
    api.get('/leaderboard').then(r=>{
      const me=(r.data.leaderboard||[]).find(u=>u.id===user?.id)
      if(me) setMyMonthPts(me.points||0)
    }).catch(()=>{})
  },[user?.id])

  const handlePost = (newPost) => {
    if (newPost) {
      setPosts(p=>[newPost,...p])
      setMyMonthPts(p=>(p||0)+5)
      setPointFlash(true); setTimeout(()=>setPointFlash(false),1200)
    }
    play('success')
  }
  const handleDelete = async (id) => { await deletePost(id).catch(()=>{}); setPosts(p=>p.filter(x=>x.id!==id)) }
  const handlePin    = async (id) => {
    await api.put(`/posts/${id}/pin`).catch(()=>{})
    setPosts(p=>p.map(x=>x.id===id?{...x,pinned:x.pinned?0:1}:x))
  }
  const handleStoryView = (idx) => {
    setViewingStory(idx)
    const g = storyGroups[idx]
    if (g) setSeenStories(s=>new Set([...s, g.user.id]))
  }

  const handleHashtagClick = (tag) => {
    setActiveHashtag(prev => prev === tag ? null : tag)
    setFilterMode('all')
    setSearchQuery('')
  }

  const FILTERS = [
    { id:'all',      label:'🌊 All' },
    { id:'research', label:'🔬 Research' },
    { id:'saved',    label:'🔖 Saved' },
  ]

  return (
    <div>
      <style>{STYLES}</style>
      <PageAmbience/>

      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-black" style={{color:'var(--text)'}}>Social Space</h1>
          <p className="text-sm" style={{color:'var(--text-muted)'}}>Connect with the water community 🌊</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Notifications bell */}
          <div className="relative" ref={notifRef}>
            <button onClick={()=>setShowNotifs(s=>!s)}
              className="relative w-10 h-10 rounded-xl flex items-center justify-center transition-colors hover:bg-indigo-50"
              style={{border:'1.5px solid var(--border)',background:'var(--card-bg)'}}>
              <Bell className="w-4 h-4" style={{color:'var(--text-muted)'}}/>
              {unreadNotifs > 0 && <div className="notif-dot"/>}
            </button>
            {showNotifs && <NotificationsPanel onClose={()=>setShowNotifs(false)}/>}
          </div>
          <button onClick={()=>{setShowDM(s=>!s);play('click')}}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-black text-white transition-all hover:opacity-90 active:scale-95"
            style={{background:'linear-gradient(135deg,#6366f1,#8b5cf6)'}}>
            <MessageCircle className="w-4 h-4"/> Messages
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 p-1 rounded-xl w-fit" style={{background:'var(--card-bg)',border:'1px solid var(--border)'}}>
        {[{id:'feed',label:'🌊 Feed'},{id:'leaderboard',label:'🏆 Leaderboard'}].map(tab=>(
          <button key={tab.id} onClick={()=>setActiveTab(tab.id)}
            className="px-4 py-1.5 rounded-lg text-sm font-black transition-all"
            style={{background:activeTab===tab.id?'linear-gradient(135deg,#6366f1,#8b5cf6)':'transparent',
              color:activeTab===tab.id?'white':'var(--text-muted)'}}>
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab==='leaderboard' ? (
        <FullLeaderboard currentUserId={user?.id} onClose={()=>setActiveTab('feed')} inline/>
      ) : (
        <div className="flex gap-5">
          {/* Left sidebar */}
          <div className="hidden xl:flex flex-col gap-4 w-[240px] flex-shrink-0">
            <div className="card p-5">
              <div className="flex flex-col items-center text-center">
                <Avatar user={user} size={64}/>
                <div className="font-black mt-3 text-base" style={{color:'var(--text)'}}>{user?.display_name||user?.username}</div>
                <div className="text-xs mt-0.5" style={{color:'var(--text-muted)'}}>@{user?.username}</div>
                <div className="text-xs mt-1 px-3 py-1 rounded-full font-semibold" style={{background:'rgba(99,102,241,0.1)',color:'#6366f1'}}>
                  {user?.role||'Community Member'}
                </div>
                <div className="flex gap-6 mt-4 pt-3 border-t w-full justify-center" style={{borderColor:'var(--border)'}}>
                  <div className="text-center">
                    <div className="font-black text-base relative" style={{color:pointFlash?'#10b981':'var(--text)',transition:'color 0.4s',transform:pointFlash?'scale(1.2)':'scale(1)'}}>
                      {myMonthPts!==null?myMonthPts:(user?.xp||0)}
                      {pointFlash&&<span className="absolute -top-5 left-1/2 -translate-x-1/2 text-xs font-black text-green-500" style={{animation:'floatUp 1.1s ease both'}}>+5</span>}
                    </div>
                    <div className="text-xs" style={{color:'var(--text-muted)'}}>Pts/month</div>
                  </div>
                  <div className="text-center">
                    <div className="font-black text-base" style={{color:'var(--text)'}}>{user?.xp||0}</div>
                    <div className="text-xs" style={{color:'var(--text-muted)'}}>XP total</div>
                  </div>
                  <div className="text-center">
                    <div className="font-black text-base" style={{color:'var(--text)'}}>{user?.level||1}</div>
                    <div className="text-xs" style={{color:'var(--text-muted)'}}>Level</div>
                  </div>
                </div>
              </div>
            </div>
            <LeaderboardCard currentUserId={user?.id} onShowFull={()=>setActiveTab('leaderboard')}/>
          </div>

          {/* Center feed */}
          <div className="flex-1 min-w-0">
            {/* Stories bar */}
            <StoriesBar
              groups={storyGroups}
              currentUser={user}
              onView={handleStoryView}
              onAdd={()=>setCreating(true)}/>

            {/* Search bar */}
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" style={{color:'var(--text-muted)'}}/>
              <input value={searchQuery} onChange={e=>{setSearchQuery(e.target.value);setActiveHashtag(null)}}
                placeholder="Search posts, people, parameters…"
                className="w-full pl-10 pr-4 py-2.5 rounded-2xl text-sm outline-none"
                style={{background:'var(--card-bg)',border:'1.5px solid var(--border)',color:'var(--text)'}}/>
              {searchQuery && (
                <button onClick={()=>setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2">
                  <X className="w-4 h-4" style={{color:'var(--text-muted)'}}/>
                </button>
              )}
            </div>

            {/* Filter pills */}
            <div className="flex gap-2 mb-4 flex-wrap">
              {FILTERS.map(f=>(
                <button key={f.id} onClick={()=>{setFilterMode(f.id);setActiveHashtag(null);setSearchQuery('')}}
                  className="px-3 py-1.5 rounded-full text-xs font-bold transition-all"
                  style={{background:filterMode===f.id&&!activeHashtag?'linear-gradient(135deg,#6366f1,#8b5cf6)':'var(--card-bg)',
                    color:filterMode===f.id&&!activeHashtag?'white':'var(--text-muted)',
                    border:'1px solid var(--border)'}}>
                  {f.label}
                </button>
              ))}
              {activeHashtag && (
                <button onClick={()=>setActiveHashtag(null)}
                  className="px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-1"
                  style={{background:'rgba(99,102,241,0.15)',color:'#6366f1',border:'1px solid rgba(99,102,241,0.3)'}}>
                  <Hash className="w-3 h-3"/>{activeHashtag.replace('#','')} <X className="w-3 h-3 ml-0.5"/>
                </button>
              )}
            </div>

            <PostComposer user={user} onPost={handlePost} onStory={()=>setCreating(true)}/>

            {loading ? (
              <div className="space-y-4">
                {[1,2,3].map(i=>(
                  <div key={i} className="card p-4 space-y-3">
                    <div className="flex gap-3">
                      <div className="skeleton-pulse w-11 h-11 rounded-full"/>
                      <div className="flex-1 space-y-2">
                        <div className="skeleton-pulse h-3 w-32 rounded-full"/>
                        <div className="skeleton-pulse h-2 w-24 rounded-full"/>
                      </div>
                    </div>
                    <div className="skeleton-pulse h-16 rounded-2xl"/>
                    <div className="skeleton-pulse h-8 rounded-2xl"/>
                  </div>
                ))}
              </div>
            ) : feedPosts.length===0 ? (
              <div className="card p-12 text-center">
                <div className="text-6xl mb-4">🌊</div>
                <h3 className="font-black text-lg mb-1" style={{color:'var(--text)'}}>
                  {filterMode==='saved'?'No saved posts yet':'Nothing here yet'}
                </h3>
                <p className="text-sm" style={{color:'var(--text-muted)'}}>
                  {filterMode==='saved'?'Bookmark posts to save them here':'Be the first to share something!'}
                </p>
              </div>
            ) : (
              <div>
                {feedPosts.map((p,i)=>(
                  <PostCard key={p.id} post={p} currentUser={user}
                    onDelete={handleDelete} onPin={handlePin}
                    animDelay={i*40} onHashtagClick={handleHashtagClick}/>
                ))}
              </div>
            )}
          </div>

          {/* Right sidebar */}
          <div className="hidden lg:flex flex-col gap-4 w-[260px] flex-shrink-0">
            <TrendingCard posts={posts} activeTag={activeHashtag} onTagClick={handleHashtagClick}/>
            <LeaderboardCard currentUserId={user?.id} onShowFull={()=>setActiveTab('leaderboard')}/>
            <div className="card p-4">
              <div className="flex items-center gap-2 mb-3">
                <Bell className="w-4 h-4 text-indigo-500"/>
                <h3 className="font-black text-sm" style={{color:'var(--text)'}}>Quick Stats</h3>
              </div>
              <div className="space-y-2.5 text-sm">
                {[
                  ['Posts today', posts.filter(p=>Date.now()-new Date(p.created_at)<86400000&&p.post_type!=='story').length],
                  ['Total posts',  posts.filter(p=>p.post_type!=='story').length],
                  ['Stories live', storyGroups.length],
                  ['My pts (month)', myMonthPts!==null?myMonthPts+'pts':'—'],
                ].map(([label,val])=>(
                  <div key={label} className="flex justify-between">
                    <span style={{color:'var(--text-muted)'}}>{label}</span>
                    <span className="font-black" style={{color:'var(--text)'}}>{val}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {showDM && <DMPanel onClose={()=>setShowDM(false)}/>}

      {viewingStory!==null && storyGroups.length>0 && (
        <StoryViewer groups={storyGroups} startGroupIdx={viewingStory}
          onClose={()=>setViewingStory(null)}/>
      )}

      {creatingStory && (
        <StoryCreator user={user} onClose={()=>setCreating(false)}
          onCreated={p=>{ if(p)setPosts(prev=>[p,...prev]); setCreating(false) }}/>
      )}

      {showLeaderboard && <FullLeaderboard currentUserId={user?.id} onClose={()=>setShowLB(false)}/>}
    </div>
  )
}
