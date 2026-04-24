/**
 * useSocial — all social operations via Supabase (persistent, free forever)
 * Posts, comments, reactions, DMs, follows, notifications
 */
import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { uploadToCloudinary } from '../lib/cloudinaryUpload'
import api from '../utils/api'


// Check if a value is a real UUID (Supabase) vs integer (old SQLite)
const isUUID = (id) => typeof id === 'string' && id.includes('-')

// ── Helpers ─────────────────────────────────────────────────────────────────
function enrichPost(post) {
  return {
    ...post,
    user: post.profiles,
    reactions: Array.isArray(post.post_reactions)
      ? post.post_reactions.reduce((acc, r) => {
          acc[r.reaction_type] = (acc[r.reaction_type] || 0) + 1
          return acc
        }, {})
      : {},
    comment_count: post.comments?.[0]?.count ?? 0,
  }
}

// ── Posts ────────────────────────────────────────────────────────────────────
// All posts use the legacy SQLite API so every user (Supabase or legacy) sees
// the same feed. The server's requireAuth handles both token types.
export function useFeed() {
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)
  const [hasMore, setHasMore] = useState(true)
  const pageRef = useRef(0)
  const PAGE = 20

  const fetchPosts = useCallback(async (reset = false, silent = false) => {
    if (reset) { pageRef.current = 0; setHasMore(true) }
    if (!silent) setLoading(true)
    try {
      const offset = pageRef.current * PAGE
      const r = await api.get(`/posts?limit=${PAGE}&offset=${offset}`)
      const data = r.data.posts || []
      setPosts(prev => reset ? data : [...prev, ...data])
      if (data.length < PAGE) setHasMore(false)
      pageRef.current += 1
    } catch {}
    if (!silent) setLoading(false)
  }, [])

  useEffect(() => {
    fetchPosts(true, false)
    // Background poll every 30s — silent so feed doesn't flash/reload
    const t = setInterval(() => fetchPosts(true, true), 30000)
    return () => clearInterval(t)
  }, [fetchPosts])

  return { posts, loading, hasMore, fetchMore: () => fetchPosts(false), refresh: () => fetchPosts(true), setPosts }
}

export async function createPost({ userId, content, postType = 'text', files = [], locationTag = '', pollQuestion = '', pollOptions = [], onProgress }) {
  let mediaUrls = []
  if (files.length > 0) {
    const folder = postType === 'video' ? 'source-water/videos' : postType === 'audio' ? 'source-water/audio' : 'source-water/posts'
    mediaUrls = await Promise.all(files.map(f => uploadToCloudinary(f, folder, onProgress)))
  }
  const payload = {
    content,
    post_type: postType,
    location_tag: locationTag || undefined,
    media: JSON.stringify(mediaUrls),
  }
  if (pollQuestion && pollOptions.length >= 2) {
    payload.poll_question = pollQuestion
    // Store as object so votes can be tracked
    payload.poll_options = JSON.stringify({ options: pollOptions, votes: {} })
  }
  const r = await api.post('/posts', payload)
  return r.data.post || r.data
}

export async function deletePost(postId) {
  await api.delete(`/posts/${postId}`)
}

// ── Comments ─────────────────────────────────────────────────────────────────
export async function fetchComments(postId) {
  const r = await api.get(`/posts/${postId}/comments`).catch(() => ({ data: [] }))
  return r.data || []
}

export async function addComment(postId, userId, content) {
  const r = await api.post(`/posts/${postId}/comments`, { content })
  return r.data.comment || r.data
}

export async function deleteComment(postId, commentId) {
  await api.delete(`/posts/${postId}/comments/${commentId}`)
}

// ── Reactions ─────────────────────────────────────────────────────────────────
export async function toggleReaction(postId, userId, reactionType) {
  // Always use legacy API — all posts are now in SQLite
  const r = await api.post(`/posts/${postId}/react`, { reaction_type: reactionType }).catch(() => null)
  return r?.data?.added !== undefined ? r.data.added : (r ? true : false)
}

// ── Who reacted ───────────────────────────────────────────────────────────────
export async function fetchReactors(postId) {
  const r = await api.get(`/posts/${postId}/reactors`).catch(() => null)
  return r?.data?.reactors || {}
}

// ── Bookmarks (server-persisted) ──────────────────────────────────────────────
export async function addBookmark(postId) {
  const r = await api.post(`/posts/${postId}/bookmark`).catch(() => null)
  return r?.data?.bookmarked === true
}
export async function removeBookmark(postId) {
  const r = await api.delete(`/posts/${postId}/bookmark`).catch(() => null)
  return r?.data?.bookmarked === false
}
export async function fetchBookmarkIds() {
  const r = await api.get('/posts/bookmarks/ids').catch(() => null)
  return Array.isArray(r?.data?.ids) ? r.data.ids : []
}
export async function fetchBookmarkedPosts() {
  const r = await api.get('/posts/bookmarks').catch(() => null)
  return Array.isArray(r?.data?.posts) ? r.data.posts : []
}

// ── Shared legacy API helper ──────────────────────────────────────────────────
function legacyGet(path) {
  const token = localStorage.getItem('sw_token') || localStorage.getItem('sb_access_token')
  const base = (import.meta.env.VITE_API_URL || 'http://localhost:3001/api').replace('/api', '')
  return fetch(`${base}/api${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  }).then(r => r.json())
}

// ── Direct Messages — always uses legacy SQLite API so all users can talk ─────
export function useConversations(userId) {
  const [convos, setConvos] = useState([])

  const load = useCallback(async () => {
    if (!userId) return
    try {
      const data = await legacyGet('/messages/conversations')
      if (!Array.isArray(data)) return
      setConvos(data.map(c => ({
        other_user_id: c.other_id,
        display_name: c.user?.display_name || c.user?.username,
        username: c.user?.username,
        avatar_emoji: c.user?.avatar_emoji,
        avatar_bg_color: c.user?.avatar_bg_color,
        last_message: c.last_message,
        unread_count: c.unread_count || 0,
      })))
    } catch {}
  }, [userId])

  useEffect(() => {
    load()
    const t = setInterval(load, 8000)
    return () => clearInterval(t)
  }, [load])

  return { convos, refresh: load }
}

export function useMessages(userId, otherId) {
  const [messages, setMessages] = useState([])
  const [ready, setReady] = useState(false)

  const load = useCallback(async () => {
    if (!userId || !otherId) return
    try {
      const data = await legacyGet(`/messages/${otherId}`)
      // Only update if we got a real array — don't wipe messages on auth errors
      if (Array.isArray(data)) setMessages(data)
    } catch {} finally {
      setReady(true)
    }
  }, [userId, otherId])

  useEffect(() => {
    setReady(false)
    load()
    if (!userId || !otherId) return
    const t = setInterval(load, 4000)
    return () => clearInterval(t)
  }, [load])

  return { messages, ready, refresh: load }
}

export async function sendDM(senderId, receiverId, content, mediaFile = null) {
  const token = localStorage.getItem('sw_token') || localStorage.getItem('sb_access_token')
  const base = (import.meta.env.VITE_API_URL || 'http://localhost:3001/api').replace('/api', '')
  const fd = new FormData()
  if (content) fd.append('content', content)

  if (mediaFile) {
    const isVoice = mediaFile.name?.endsWith('.webm') || mediaFile.type?.includes('audio')
    try {
      // Upload to Cloudinary so media persists on Render
      const folder = isVoice ? 'source-water/voice' : mediaFile.type?.startsWith('video') ? 'source-water/dm-video' : 'source-water/dm'
      const mediaUrl = await uploadToCloudinary(mediaFile, folder)
      if (isVoice) fd.append('voice_url', mediaUrl)
      else fd.append('media_url', mediaUrl)
    } catch {
      // Fallback: send file directly
      if (isVoice) fd.append('voice_note', mediaFile)
      else fd.append('media', mediaFile)
    }
  }

  const res = await fetch(`${base}/api/messages/${receiverId}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: fd,
  })
  return res.json()
}

export async function deleteDM(messageId) {
  const token = localStorage.getItem('sw_token') || localStorage.getItem('sb_access_token')
  const base = (import.meta.env.VITE_API_URL || 'http://localhost:3001/api').replace('/api', '')
  const res = await fetch(`${base}/api/messages/${messageId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  })
  return res.json()
}

export async function editDM(messageId, content) {
  const token = localStorage.getItem('sw_token') || localStorage.getItem('sb_access_token')
  const base = (import.meta.env.VITE_API_URL || 'http://localhost:3001/api').replace('/api', '')
  const res = await fetch(`${base}/api/messages/${messageId}`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ content }),
  })
  return res.json()
}

// ── User search — legacy API returns SQLite integer IDs ───────────────────────
export async function searchUsers(query, excludeId) {
  try {
    const data = await legacyGet(`/users/search?q=${encodeURIComponent(query)}`)
    const users = data.users || data || []
    return excludeId ? users.filter(u => String(u.id) !== String(excludeId)) : users
  } catch {
    return []
  }
}

// ── Follows ────────────────────────────────────────────────────────────────────
export async function toggleFollow(followerId, followingId) {
  const { data: existing } = await supabase
    .from('follows')
    .select('id')
    .eq('follower_id', followerId)
    .eq('following_id', followingId)
    .maybeSingle()

  if (existing) {
    await supabase.from('follows').delete().eq('id', existing.id)
    return false
  } else {
    await supabase.from('follows').insert({ follower_id: followerId, following_id: followingId })
    return true
  }
}

export async function getFollowCounts(userId) {
  const [{ count: following }, { count: followers }] = await Promise.all([
    supabase.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', userId),
    supabase.from('follows').select('*', { count: 'exact', head: true }).eq('following_id', userId),
  ])
  return { following: following || 0, followers: followers || 0 }
}
