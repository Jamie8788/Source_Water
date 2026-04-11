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
  const [notification, setNotification] = useState(null) // site-wide notification bar settings
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

  // ── Load site-wide notification bar ──────────────────────────────────────
  useEffect(() => {
    supabase.from('cms_site_settings').select('value').eq('key', 'notification_bar').single()
      .then(({ data }) => { if (data?.value) setNotification(data.value) })
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
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cms_site_settings' }, payload => {
        const r = payload.new
        if (r?.key === 'notification_bar') setNotification(r.value || null)
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

  // ── Tag elements and apply overrides (runs for ALL users on every page load) ─
  const tagAndApply = useCallback((ovrs) => {
    const page = window.location.pathname.replace(/\//g, '') || 'home'
    const tags = ['h1','h2','h3','h4','h5','h6','p','span','li','td','th','button','a','div','label']
    const counters = {}
    document.querySelectorAll(tags.join(',')).forEach(el => {
      if (el.closest('[data-cms-ui]')) return
      if (el.closest('script,style,noscript,[data-no-cms]')) return
      const text = el.innerText?.trim()
      if (!text || text.length < 1) return
      const directText = Array.from(el.childNodes)
        .filter(n => n.nodeType === Node.TEXT_NODE)
        .map(n => n.textContent.trim())
        .join('')
      if (!directText && el.children.length > 0) return
      const tag = el.tagName.toLowerCase()
      counters[tag] = (counters[tag] || 0) + 1
      el.setAttribute('data-cms-id', `${page}/${tag}/${counters[tag]}`)
    })
    // Apply text overrides
    Object.entries(ovrs).forEach(([key, { text }]) => {
      if (text == null) return
      const el = document.querySelector(`[data-cms-id="${key}"]`)
      if (el && el.innerText !== text) el.innerText = text
    })
    applyOverrideStyles(ovrs)
  }, [])

  // Apply text overrides to DOM elements (alias used in CMS mode)
  const applyOverrideTexts = useCallback((ovrs) => {
    Object.entries(ovrs).forEach(([key, { text }]) => {
      if (text == null) return
      const el = document.querySelector(`[data-cms-id="${key}"]`)
      if (el && el.innerText !== text) el.innerText = text
    })
  }, [])

  // ── Always tag + apply on page load for ALL users ─────────────────────────
  useEffect(() => {
    const timer = setTimeout(() => tagAndApply(overrides), 400)
    return () => clearTimeout(timer)
  }, [overrides, tagAndApply])

  // ── Extra CMS edit-mode UI (hover outlines, click to select) ─────────────
  useEffect(() => {
    if (!cmsMode) {
      // Remove edit-mode styling but keep data-cms-id tags (needed for style overrides)
      document.querySelectorAll('[data-cms-id]').forEach(el => {
        el.style.outline = ''
        el.style.outlineOffset = ''
        el.style.cursor = ''
      })
      setSelectedEl(null)
      return
    }
    // Re-tag in case new elements rendered
    const timer = setTimeout(() => tagAndApply(overrides), 200)
    return () => clearTimeout(timer)
  }, [cmsMode, overrides, tagAndApply])

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
    // Apply immediately to DOM element for instant feedback
    const el = document.querySelector(`[data-cms-id="${key}"]`)
    if (el) {
      if (text != null) el.innerText = text
      // Apply styles directly so they're visible instantly
      if (styles) {
        Object.entries(styles).forEach(([k, v]) => {
          el.style[k] = v
        })
      }
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
    if (el) {
      el.removeAttribute('style')
      // Restore original text if override exists
      const orig = overrides[key]
      if (orig) el.innerText = orig.text ?? el.innerText
    }
    const newOverrides = { ...overrides }
    delete newOverrides[key]
    setOverrides(newOverrides)
    applyOverrideStyles(newOverrides)
    await supabase.from('cms_overrides').delete().eq('element_key', key)
  }, [overrides])

  // ── Save / clear site notification ───────────────────────────────────────
  const saveNotification = useCallback(async (data) => {
    setNotification(data)
    await supabase.from('cms_site_settings').upsert(
      { key: 'notification_bar', value: data, updated_at: new Date().toISOString() },
      { onConflict: 'key' }
    )
  }, [])

  const toggleCmsMode = useCallback(() => {
    if (!isAdmin) return
    setCmsMode(m => !m)
  }, [isAdmin])

  const loadPage = useCallback(() => {}, [])

  return (
    <CMSContext.Provider value={{
      cmsMode, toggleCmsMode, get, save, loadPage, saving, isAdmin,
      selectedEl, setSelectedEl, overrides, saveOverride, deleteOverride,
      notification, saveNotification,
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
