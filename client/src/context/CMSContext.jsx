/**
 * CMSContext — stores all CMS content in Supabase (persistent, real-time, free).
 * Admin clicks "Enter CMS Edit Mode" → every CMSField becomes click-to-edit.
 * Saves instantly to Supabase. All users see changes immediately.
 */
import { createContext, useContext, useState, useCallback, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthContext'

const CMSContext = createContext(null)

export function CMSProvider({ children }) {
  const { isAdmin } = useAuth()
  const [cmsMode, setCmsMode]       = useState(false)
  const [content, setContent]       = useState({})   // { 'page__block__field': value }
  const [loaded, setLoaded]         = useState(false)
  const [saving, setSaving]         = useState(false)

  // Load ALL CMS content from Supabase on mount — one query, cached in memory
  useEffect(() => {
    supabase
      .from('cms_content')
      .select('page_key,block_key,field,value')
      .then(({ data, error }) => {
        if (error) { console.warn('[CMS] load error', error.message); return }
        const map = {}
        ;(data || []).forEach(r => {
          map[`${r.page_key}__${r.block_key}__${r.field}`] = r.value
        })
        setContent(map)
        setLoaded(true)
      })
  }, [])

  // Subscribe to real-time changes so all users see edits instantly
  useEffect(() => {
    const channel = supabase
      .channel('cms_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cms_content' }, (payload) => {
        const r = payload.new || payload.old
        if (!r) return
        const key = `${r.page_key}__${r.block_key}__${r.field}`
        if (payload.eventType === 'DELETE') {
          setContent(prev => { const n = { ...prev }; delete n[key]; return n })
        } else {
          setContent(prev => ({ ...prev, [key]: r.value }))
        }
      })
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [])

  // Get a value with fallback
  const get = useCallback((pageKey, blockKey, field, defaultValue = '') => {
    return content[`${pageKey}__${blockKey}__${field}`] ?? defaultValue
  }, [content])

  // Save a value to Supabase (upsert)
  const save = useCallback(async (pageKey, blockKey, field, value) => {
    // Optimistic update
    const key = `${pageKey}__${blockKey}__${field}`
    setContent(prev => ({ ...prev, [key]: value }))
    setSaving(true)
    const { error } = await supabase
      .from('cms_content')
      .upsert({ page_key: pageKey, block_key: blockKey, field, value, updated_at: new Date().toISOString() },
               { onConflict: 'page_key,block_key,field' })
    if (error) console.error('[CMS] save error', error.message)
    setSaving(false)
  }, [])

  const toggleCmsMode = useCallback(() => {
    if (!isAdmin) return
    setCmsMode(m => !m)
  }, [isAdmin])

  // Legacy compat: keep loadPage as no-op (everything loaded at once now)
  const loadPage = useCallback(() => {}, [])

  return (
    <CMSContext.Provider value={{ cmsMode, toggleCmsMode, get, save, loadPage, saving, loaded, isAdmin }}>
      {children}
    </CMSContext.Provider>
  )
}

export const useCMS = () => {
  const ctx = useContext(CMSContext)
  if (!ctx) throw new Error('useCMS must be used within CMSProvider')
  return ctx
}
