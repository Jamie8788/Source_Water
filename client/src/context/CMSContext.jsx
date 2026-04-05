import { createContext, useContext, useState, useCallback, useRef } from 'react'
import api from '../utils/api'
import { useAuth } from './AuthContext'

const CMSContext = createContext(null)

export function CMSProvider({ children }) {
  const { isAdmin } = useAuth()
  const [cmsMode, setCmsMode] = useState(false)
  const [content, setContent] = useState({})        // { pageKey: { blockKey: { field: value } } }
  const [loadedPages, setLoadedPages] = useState({}) // which pages have been fetched
  const [saving, setSaving] = useState(false)
  const saveQueue = useRef({})

  // Load all content for a page from DB
  const loadPage = useCallback(async (pageKey) => {
    if (loadedPages[pageKey]) return
    try {
      const r = await api.get(`/cms/content/${pageKey}`)
      setContent(prev => ({ ...prev, [pageKey]: r.data.content || {} }))
      setLoadedPages(prev => ({ ...prev, [pageKey]: true }))
    } catch {}
  }, [loadedPages])

  // Get a value (falls back to defaultValue if not in DB)
  const get = useCallback((pageKey, blockKey, field, defaultValue = '') => {
    return content[pageKey]?.[blockKey]?.[field] ?? defaultValue
  }, [content])

  // Save a value to DB immediately
  const save = useCallback(async (pageKey, blockKey, field, value) => {
    // Optimistic update
    setContent(prev => ({
      ...prev,
      [pageKey]: {
        ...prev[pageKey],
        [blockKey]: { ...prev[pageKey]?.[blockKey], [field]: value }
      }
    }))
    setSaving(true)
    try {
      await api.put('/cms/content', { page_key: pageKey, block_key: blockKey, field, value })
    } catch (e) {
      console.error('CMS save failed', e)
    }
    setSaving(false)
  }, [])

  const toggleCmsMode = useCallback(() => {
    if (!isAdmin) return
    setCmsMode(m => !m)
  }, [isAdmin])

  return (
    <CMSContext.Provider value={{ cmsMode, toggleCmsMode, get, save, loadPage, saving, isAdmin }}>
      {children}
    </CMSContext.Provider>
  )
}

export const useCMS = () => {
  const ctx = useContext(CMSContext)
  if (!ctx) throw new Error('useCMS must be used within CMSProvider')
  return ctx
}
