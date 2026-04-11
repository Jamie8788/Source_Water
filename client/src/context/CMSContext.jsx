/**
 * CMSContext — Universal visual editor.
 * When CMS mode ON: every text element on every page gets a dashed outline on hover.
 * Click any element → FloatingEditor panel appears (draggable).
 * Edit text, font size, font weight, color, background, alignment.
 * Saves to Supabase cms_overrides table. Applied via injected <style> tag.
 * All users see changes instantly via real-time subscription.
 */
import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthContext'

const CMSContext = createContext(null)

function rgbToHex(rgb) {
  if (!rgb || rgb === 'rgba(0, 0, 0, 0)' || rgb === 'transparent') return ''
  const m = rgb.match(/\d+/g)
  if (!m) return ''
  return '#' + m.slice(0, 3).map(n => parseInt(n).toString(16).padStart(2, '0')).join('')
}

export function CMSProvider({ children }) {
  const { isAdmin } = useAuth()
  const [cmsMode, setCmsMode]       = useState(false)
  const [content, setContent]       = useState({})      // CMSField values
  const [overrides, setOverrides]   = useState({})      // element overrides by key
  const [saving, setSaving]         = useState(false)
  const [selectedEl, setSelectedEl] = useState(null)    // { element, key, rect, currentText, currentStyles }
  const styleTagRef = useRef(null)

  // ── Load CMS field content ────────────────────────────────────────────────
  useEffect(() => {
    supabase.from('cms_content').select('page_key,block_key,field,value').then(({ data }) => {
      const map = {}
      ;(data || []).forEach(r => { map[`${r.page_key}__${r.block_key}__${r.field}`] = r.value })
      setContent(map)
    })
  }, [])

  // ── Load element overrides ────────────────────────────────────────────────
  useEffect(() => {
    supabase.from('cms_overrides').select('*').then(({ data }) => {
      const map = {}
      ;(data || []).forEach(r => { map[r.element_key] = { text: r.text_content, styles: r.styles || {} } })
      setOverrides(map)
      applyOverrideStyles(map)
    })
  }, [])

  // ── Real-time subscriptions ───────────────────────────────────────────────
  useEffect(() => {
    const ch = supabase.channel('cms_realtime_all')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cms_content' }, payload => {
        const r = payload.new || payload.old
        if (!r) return
        const key = `${r.page_key}__${r.block_key}__${r.field}`
        setContent(prev => payload.eventType === 'DELETE'
          ? Object.fromEntries(Object.entries(prev).filter(([k]) => k !== key))
          : { ...prev, [key]: r.value }
        )
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cms_overrides' }, payload => {
        const r = payload.new || payload.old
        if (!r) return
        setOverrides(prev => {
          const n = { ...prev }
          if (payload.eventType === 'DELETE') delete n[r.element_key]
          else n[r.element_key] = { text: r.text_content, styles: r.styles || {} }
          applyOverrideStyles(n)
          return n
        })
      })
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [])

  // ── Inject styles into document head ──────────────────────────────────────
  const applyOverrideStyles = (ovrs) => {
    const existing = document.querySelector('[data-cms-override-styles]')
    if (existing) existing.remove()
    const rules = Object.entries(ovrs)
      .filter(([, v]) => v.styles && Object.keys(v.styles).length)
      .map(([key, { styles }]) => {
        const sel = `[data-cms-id="${CSS.escape(key)}"]`
        const css = Object.entries(styles)
          .map(([k, v]) => `${k.replace(/([A-Z])/g, '-$1').toLowerCase()}:${v}!important`)
          .join(';')
        return `${sel}{${css}}`
      }).join('\n')
    if (!rules) return
    const tag = document.createElement('style')
    tag.setAttribute('data-cms-override-styles', 'true')
    tag.textContent = rules
    document.head.appendChild(tag)
    styleTagRef.current = tag
  }

  // Apply text overrides to DOM elements
  const applyOverrideTexts = useCallback((ovrs) => {
    Object.entries(ovrs).forEach(([key, { text }]) => {
      if (text == null) return
      const el = document.querySelector(`[data-cms-id="${key}"]`)
      if (el && el.innerText !== text) el.innerText = text
    })
  }, [])

  // ── Tag all text elements when CMS mode activates ──────────────────────────
  useEffect(() => {
    if (!cmsMode) {
      document.querySelectorAll('[data-cms-id]').forEach(el => {
        el.removeAttribute('data-cms-id')
        el.style.outline = ''
        el.style.outlineOffset = ''
        el.style.cursor = ''
      })
      setSelectedEl(null)
      return
    }

    // Wait a tick for page to render
    const timer = setTimeout(() => {
      const page = window.location.pathname.replace(/\//g, '') || 'home'
      const tags = ['h1','h2','h3','h4','h5','h6','p','span','li','td','th','button','a','div','label']
      const counters = {}

      document.querySelectorAll(tags.join(',')).forEach(el => {
        if (el.closest('[data-cms-ui]')) return
        if (el.closest('script,style,noscript,[data-no-cms]')) return
        const text = el.innerText?.trim()
        if (!text || text.length < 1) return
        // Skip elements that are just wrappers (have child elements with same text)
        const directText = Array.from(el.childNodes)
          .filter(n => n.nodeType === Node.TEXT_NODE)
          .map(n => n.textContent.trim())
          .join('')
        if (!directText && el.children.length > 0) return

        const tag = el.tagName.toLowerCase()
        counters[tag] = (counters[tag] || 0) + 1
        const key = `${page}/${tag}/${counters[tag]}`
        el.setAttribute('data-cms-id', key)
      })

      // Apply saved overrides to newly tagged elements
      applyOverrideTexts(overrides)
      applyOverrideStyles(overrides)
    }, 200)

    return () => clearTimeout(timer)
  }, [cmsMode, overrides, applyOverrideTexts])

  // ── Global hover + click handlers in CMS mode ──────────────────────────────
  useEffect(() => {
    if (!cmsMode) return

    const handleClick = (e) => {
      const el = e.target.closest('[data-cms-id]')
      if (!el || el.closest('[data-cms-ui]')) {
        // Clicked outside any editable element — deselect
        if (!e.target.closest('[data-cms-ui]')) setSelectedEl(null)
        return
      }
      e.preventDefault()
      e.stopPropagation()
      const rect = el.getBoundingClientRect()
      const key = el.getAttribute('data-cms-id')
      const computed = window.getComputedStyle(el)
      el.style.outline = '2px solid #6366f1'
      el.style.outlineOffset = '3px'
      setSelectedEl({
        element: el,
        key,
        rect,
        currentText: el.innerText,
        currentStyles: {
          fontSize: parseInt(computed.fontSize) || 16,
          fontWeight: computed.fontWeight || '400',
          color: rgbToHex(computed.color) || '#000000',
          bgColor: rgbToHex(computed.backgroundColor) || '',
          textAlign: computed.textAlign || 'left',
        },
      })
    }

    const handleOver = (e) => {
      const el = e.target.closest('[data-cms-id]')
      if (el && !el.closest('[data-cms-ui]') && el.style.outline !== '2px solid #6366f1') {
        el.style.outline = '1.5px dashed rgba(99,102,241,0.6)'
        el.style.outlineOffset = '2px'
        el.style.cursor = 'pointer'
      }
    }

    const handleOut = (e) => {
      const el = e.target.closest('[data-cms-id]')
      if (el && !el.closest('[data-cms-ui]') && el !== selectedEl?.element) {
        el.style.outline = ''
        el.style.outlineOffset = ''
        el.style.cursor = ''
      }
    }

    document.addEventListener('click', handleClick, true)
    document.addEventListener('mouseover', handleOver)
    document.addEventListener('mouseout', handleOut)
    return () => {
      document.removeEventListener('click', handleClick, true)
      document.removeEventListener('mouseover', handleOver)
      document.removeEventListener('mouseout', handleOut)
    }
  }, [cmsMode, selectedEl])

  // ── CMS field helpers (for pre-wrapped CMSField components) ───────────────
  const get = useCallback((pageKey, blockKey, field, defaultValue = '') => {
    return content[`${pageKey}__${blockKey}__${field}`] ?? defaultValue
  }, [content])

  const save = useCallback(async (pageKey, blockKey, field, value) => {
    const key = `${pageKey}__${blockKey}__${field}`
    setContent(prev => ({ ...prev, [key]: value }))
    setSaving(true)
    await supabase.from('cms_content').upsert(
      { page_key: pageKey, block_key: blockKey, field, value, updated_at: new Date().toISOString() },
      { onConflict: 'page_key,block_key,field' }
    )
    setSaving(false)
  }, [])

  // ── Element override save/delete ──────────────────────────────────────────
  const saveOverride = useCallback(async (key, text, styles) => {
    setSaving(true)
    // Apply immediately to DOM
    const el = document.querySelector(`[data-cms-id="${key}"]`)
    if (el) {
      if (text != null) el.innerText = text
    }
    const newOverrides = { ...overrides, [key]: { text, styles } }
    setOverrides(newOverrides)
    applyOverrideStyles(newOverrides)
    await supabase.from('cms_overrides').upsert(
      { element_key: key, text_content: text, styles, updated_at: new Date().toISOString() },
      { onConflict: 'element_key' }
    )
    setSaving(false)
  }, [overrides])

  const deleteOverride = useCallback(async (key) => {
    const el = document.querySelector(`[data-cms-id="${key}"]`)
    if (el) { el.style.fontSize = ''; el.style.color = ''; el.style.fontWeight = '' }
    const newOverrides = { ...overrides }
    delete newOverrides[key]
    setOverrides(newOverrides)
    applyOverrideStyles(newOverrides)
    await supabase.from('cms_overrides').delete().eq('element_key', key)
  }, [overrides])

  const toggleCmsMode = useCallback(() => {
    if (!isAdmin) return
    setCmsMode(m => !m)
  }, [isAdmin])

  const loadPage = useCallback(() => {}, [])

  return (
    <CMSContext.Provider value={{
      cmsMode, toggleCmsMode, get, save, loadPage, saving, isAdmin,
      selectedEl, setSelectedEl, overrides, saveOverride, deleteOverride,
    }}>
      {children}
    </CMSContext.Provider>
  )
}

export const useCMS = () => {
  const ctx = useContext(CMSContext)
  if (!ctx) throw new Error('useCMS must be used within CMSProvider')
  return ctx
}
