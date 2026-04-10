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
export function useFeed() {
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)
  const [hasMore, setHasMore] = useState(true)
  const pageRef = useRef(0)
  const PAGE = 20

  const fetchPosts = useCallback(async (reset = false) => {
    if (reset) { pageRef.current = 0; setHasMore(true) }
    setLoading(true)
    const from = pageRef.current * PAGE
    const { data, error } = await supabase
      .from('posts')
      .select(`
        *,
        profiles(id, username, display_name, avatar_emoji, avatar_bg_color, avatar_url, role),
        post_reactions(reaction_type),
        comments(count)
      `)
      .order('pinned', { ascending: false })
      .order('created_at', { ascending: false })
      .range(from, from + PAGE - 1)

    if (!error && data) {
      const enriched = data.map(enrichPost)
      setPosts(prev => reset ? enriched : [...prev, ...enriched])
      if (data.length < PAGE) setHasMore(false)
      pageRef.current += 1
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchPosts(true)

    // Realtime: new posts appear instantly
    const channel = supabase
      .channel('posts-feed')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'posts' }, () => {
        fetchPosts(true)
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'posts' }, (payload) => {
        setPosts(prev => prev.filter(p => p.id !== payload.old.id))
      })
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [fetchPosts])

  return { posts, loading, hasMore, fetchMore: () => fetchPosts(false), refresh: () => fetchPosts(true), setPosts }
}

export async function createPost({ userId, content, postType = 'text', files = [], locationTag = '' }) {
  // Fallback to old API if not a Supabase UUID
  if (!isUUID(userId)) {
    if (files.length > 0) {
      // Upload to Cloudinary so files persist across Render redeploys
      let mediaUrls = []
      try {
        const folder = postType === 'video' ? 'source-water/videos' : postType === 'audio' ? 'source-water/audio' : 'source-water/posts'
        mediaUrls = await Promise.all(files.map(f => uploadToCloudinary(f, folder)))
      } catch (_) {
        // Fallback to local upload if Cloudinary fails
        const fd = new FormData()
        fd.append('content', content || ' ')
        fd.append('post_type', postType)
        files.forEach(f => fd.append('media', f))
        const token = localStorage.getItem('sb_access_token') || localStorage.getItem('sw_token')
        const apiBase = (import.meta.env.VITE_API_URL || 'http://localhost:3001/api').replace('/api','')
        const res = await fetch(`${apiBase}/api/posts`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: fd })
        const json = await res.json()
        if (!res.ok) throw new Error(json.error || 'Post failed')
        return json.post || json
      }
      const r = await api.post('/posts', { content, post_type: postType, location_tag: locationTag, media: JSON.stringify(mediaUrls) })
      return r.data.post || r.data
    } else {
      const r = await api.post('/posts', { content, post_type: postType, location_tag: locationTag })
      return r.data.post || r.data
    }
  }

  // Supabase path
  let mediaUrls = []
  if (files.length > 0) {
    const folder = postType === 'video' ? 'source-water/videos' : 'source-water/posts'
    mediaUrls = await Promise.all(files.map(f => uploadToCloudinary(f, folder)))
  }

  const { data, error } = await supabase
    .from('posts')
    .insert({ user_id: userId, content, post_type: postType, media: mediaUrls, location_tag: locationTag || null })
    .select(`*, profiles(id, username, display_name, avatar_emoji, avatar_bg_color, avatar_url, role), post_reactions(reaction_type), comments(count)`)
    .single()

  if (error) throw new Error(error.message)
  return enrichPost(data)
}

export async function deletePost(postId) {
  const { error } = await supabase.from('posts').delete().eq('id', postId)
  if (error) throw new Error(error.message)
}

// ── Comments ─────────────────────────────────────────────────────────────────
export async function fetchComments(postId) {
  const { data, error } = await supabase
    .from('comments')
    .select('*, profiles(id, username, display_name, avatar_emoji, avatar_bg_color)')
    .eq('post_id', postId)
    .order('created_at', { ascending: true })
  if (error) return []
  return data.map(c => ({ ...c, user: c.profiles }))
}

export async function addComment(postId, userId, content) {
  if (!isUUID(userId)) {
    const r = await api.post(`/posts/${postId}/comments`, { content })
    return r.data.comment || r.data
  }
  const { data, error } = await supabase
    .from('comments')
    .insert({ post_id: postId, user_id: userId, content })
    .select('*, profiles(id, username, display_name, avatar_emoji, avatar_bg_color)')
    .single()
  if (error) throw new Error(error.message)
  return { ...data, user: data.profiles }
}

export async function deleteComment(commentId) {
  const { error } = await supabase.from('comments').delete().eq('id', commentId)
  if (error) throw new Error(error.message)
}

// ── Reactions ─────────────────────────────────────────────────────────────────
export async function toggleReaction(postId, userId, reactionType) {
  if (!isUUID(userId)) {
    const r = await api.post(`/posts/${postId}/react`, { reaction_type: reactionType }).catch(() => null)
    return r ? true : false
  }
  // Check if already reacted with this type
  const { data: existing } = await supabase
    .from('post_reactions')
    .select('id')
    .eq('post_id', postId)
    .eq('user_id', userId)
    .eq('reaction_type', reactionType)
    .maybeSingle()

  if (existing) {
    await supabase.from('post_reactions').delete().eq('id', existing.id)
    return false // removed
  } else {
    // Remove any other reaction first
    await supabase.from('post_reactions').delete().eq('post_id', postId).eq('user_id', userId)
    await supabase.from('post_reactions').insert({ post_id: postId, user_id: userId, reaction_type: reactionType })
    return true // added
  }
}

// ── Shared legacy API helper ──────────────────────────────────────────────────
function legacyGet(path) {
  const token = localStorage.getItem('sw_token') || localStorage.getItem('sb_access_token')
  const base = (import.meta.env.VITE_API_URL || 'http://localhost:3001/api').replace('/api', '')
  return fetch(`${base}/api${path}`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json())
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

  const load = useCallback(async () => {
    if (!userId || !otherId) return
    try {
      const data = await legacyGet(`/messages/${otherId}`)
      setMessages(Array.isArray(data) ? data : [])
    } catch {}
  }, [userId, otherId])

  useEffect(() => {
    load()
    if (!userId || !otherId) return
    const t = setInterval(load, 4000)
    return () => clearInterval(t)
  }, [load])

  return { messages, refresh: load }
}

export async function sendDM(senderId, receiverId, content, mediaFile = null) {
  const token = localStorage.getItem('sw_token') || localStorage.getItem('sb_access_token')
  const base = (import.meta.env.VITE_API_URL || 'http://localhost:3001/api').replace('/api', '')
  const fd = new FormData()
  if (content) fd.append('content', content)
  if (mediaFile) fd.append('media', mediaFile)
  const res = await fetch(`${base}/api/messages/${receiverId}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: fd,
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
