/**
 * CMSContext — Universal visual editor.
 * When CMS mode ON: every text element on every page gets a dashed outline on hover.
 * Click any element → FloatingEditor panel appears (draggable).
 * Edit text, font size, font weight, color, background, alignment.
 * Saves to Supabase cms_overrides table. Applied via injected <style> tag.
 * All users see changes instantly via real-time subscription.
 */
import { createContext, useContext, useState, useCallback, useEffect, useRef, useMemo } from 'react'
import { useLocation } from 'react-router-dom'
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
  const location = useLocation()
  const [cmsMode, setCmsMode]       = useState(false)
  const [content, setContent]       = useState({})      // CMSField values
  const [overrides, setOverrides]   = useState({})      // element overrides by key
  const [saving, setSaving]         = useState(false)
  const [selectedEl, setSelectedEl] = useState(null)    // { element, key, rect, currentText, currentStyles }
  const [notification, setNotification] = useState(null) // site-wide notification bar settings
  const [hiddenComponents, setHiddenComponents] = useState([]) // list of hidden component keys
  const [pageBlocks, setPageBlocks] = useState([]) // custom blocks inserted by admin per page
  const styleTagRef  = useRef(null)
  const observersRef = useRef(new Map()) // key → MutationObserver (per-element re-apply guards)

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
      ;(data || []).forEach(r => { map[r.element_key] = { text: r.text_content, styles: r.styles || {}, html: r.html_content } })
      setOverrides(map)
      applyOverrideStyles(map)
    })
  }, [])

  // ── Load site-wide notification bar ──────────────────────────────────────
  useEffect(() => {
    supabase.from('cms_site_settings').select('value').eq('key', 'notification_bar').single()
      .then(({ data }) => { if (data?.value) setNotification(data.value) })
  }, [])

  // ── Load hidden components ────────────────────────────────────────────────
  useEffect(() => {
    supabase.from('cms_site_settings').select('value').eq('key', 'hidden_components').single()
      .then(({ data }) => { if (data?.value) setHiddenComponents(data.value) })
  }, [])

  // ── Load page blocks for current page ─────────────────────────────────────
  useEffect(() => {
    const page = location.pathname.replace(/\//g, '') || 'home'
    supabase.from('cms_page_blocks').select('*').eq('page_key', page).order('order_index')
      .then(({ data }) => setPageBlocks(data || []))
  }, [location.pathname])

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
          else n[r.element_key] = { text: r.text_content, styles: r.styles || {}, html: r.html_content }
          applyOverrideStyles(n)
          return n
        })
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cms_site_settings' }, payload => {
        const r = payload.new
        if (!r) return
        if (r.key === 'notification_bar') setNotification(r.value || null)
        if (r.key === 'hidden_components') {
          setHiddenComponents(r.value || [])
          applyHiddenComponents(r.value || [])
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cms_page_blocks' }, payload => {
        const r = payload.new || payload.old
        if (!r) return
        const page = window.location.pathname.replace(/\//g, '') || 'home'
        if (r.page_key !== page) return
        setPageBlocks(prev => {
          if (payload.eventType === 'DELETE') return prev.filter(b => b.id !== r.id)
          if (payload.eventType === 'INSERT') return [...prev, r].sort((a, b) => a.order_index - b.order_index)
          return prev.map(b => b.id === r.id ? r : b).sort((a, b) => a.order_index - b.order_index)
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

  // ── Apply hidden components (hide/show sections for all users) ───────────
  const applyHiddenComponents = useCallback((hidden) => {
    ;(hidden || []).forEach(key => {
      const el = document.querySelector(`[data-cms-component="${key}"]`)
      if (el) el.style.display = 'none'
    })
  }, [])

  // Tag major sections with component IDs
  const tagComponents = useCallback(() => {
    const page = window.location.pathname.replace(/\//g, '') || 'home'
    // Find the main outlet
    const outlet = document.querySelector('[data-outlet]') || document.querySelector('main')
    if (!outlet) return []
    const tagged = []
    let idx = 0
    // Tag direct children + major sections inside
    const candidates = [
      ...Array.from(outlet.children),
      ...Array.from(outlet.querySelectorAll('section, article, [class*="rounded"], [class*="card"]'))
    ]
    const seen = new Set()
    candidates.forEach(el => {
      if (seen.has(el)) return
      if (el.closest('[data-cms-ui]')) return
      if (el.closest('[data-no-cms]')) return
      const rect = el.getBoundingClientRect()
      if (rect.height < 60 || rect.width < 100) return
      seen.add(el)
      idx++
      const key = `${page}/section/${idx}`
      el.setAttribute('data-cms-component', key)
      // Get a label for this component
      const heading = el.querySelector('h1,h2,h3,h4,h5,h6')
      const label = heading?.innerText?.trim()?.slice(0, 40) || el.className?.split(' ')[0] || `Section ${idx}`
      tagged.push({ key, label, el })
    })
    return tagged
  }, [])

  // Apply hidden + tag on every page load and navigation
  useEffect(() => {
    const t1 = setTimeout(() => applyHiddenComponents(hiddenComponents), 500)
    const t2 = setTimeout(() => applyHiddenComponents(hiddenComponents), 1500)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [hiddenComponents, applyHiddenComponents, location.pathname])

  // ── Tag elements and apply overrides (runs for ALL users on every page load) ─
  // Uses CONTENT-BASED stable keys so IDs don't shift on re-render:
  //   Elements outside [data-outlet] (navbar, sidebar, footer) → global/tag/slug
  //   Elements inside  [data-outlet] (page content)            → page/tag/slug
  //   Duplicate slugs get a numeric suffix: global/span/water2
  const tagAndApply = useCallback((ovrs) => {
    const page = window.location.pathname.replace(/\//g, '') || 'home'
    const tags = ['h1','h2','h3','h4','h5','h6','p','span','li','td','th','button','a','div','label']
    const slugCounters = {}
    const outlet = document.querySelector('[data-outlet]') || document.querySelector('main')
    document.querySelectorAll(tags.join(',')).forEach(el => {
      if (el.closest('[data-cms-ui]')) return
      if (el.closest('script,style,noscript,[data-no-cms]')) return
      // ── STABLE KEY: if this element was already tagged, keep its existing key.
      // Re-keying after a text override would assign a NEW slug (based on the
      // overridden text) and orphan the saved override under the original key.
      if (el.getAttribute('data-cms-id')) return
      const text = el.innerText?.trim()
      if (!text || text.length < 1) return
      const directText = Array.from(el.childNodes)
        .filter(n => n.nodeType === Node.TEXT_NODE)
        .map(n => n.textContent.trim())
        .join('')
      if (!directText && el.children.length > 0) return
      const tag = el.tagName.toLowerCase()
      // Stable namespace: elements outside the main outlet are "global" (navbar, sidebar, footer)
      const isInPage = outlet ? outlet.contains(el) : true
      const ns = isInPage ? page : 'global'
      // Stable slug from text content (first 22 chars, alphanumeric only)
      const slug = directText.slice(0, 22).replace(/[^a-zA-Z0-9]/g, '').toLowerCase() || 'el'
      const baseKey = `${ns}/${tag}/${slug}`
      slugCounters[baseKey] = (slugCounters[baseKey] || 0) + 1
      const count = slugCounters[baseKey]
      const key = count === 1 ? baseKey : `${baseKey}${count}`
      el.setAttribute('data-cms-id', key)
    })
    // Apply text/html overrides
    Object.entries(ovrs).forEach(([key, { text, html }]) => {
      const el = document.querySelector(`[data-cms-id="${key}"]`)
      if (!el) return
      if (html != null) { if (el.innerHTML !== html) el.innerHTML = html }
      else if (text != null) { if (el.innerText !== text) el.innerText = text }
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

  // ── Attach MutationObservers so React re-renders can't permanently wipe overrides ──
  // When React reconciles and resets innerHTML/innerText, the observer fires as a
  // microtask and immediately re-applies the override — imperceptible to the user.
  const attachObservers = useCallback((ovrs) => {
    // Disconnect all previous observers before re-attaching
    observersRef.current.forEach(obs => obs.disconnect())
    observersRef.current.clear()
    Object.entries(ovrs).forEach(([key, { text, html }]) => {
      if (text == null && html == null) return
      const el = document.querySelector(`[data-cms-id="${key}"]`)
      if (!el) return
      let guard = false
      const apply = () => {
        if (guard) return
        guard = true
        if (html != null) { if (el.innerHTML !== html) el.innerHTML = html }
        else if (text != null) { if (el.innerText !== text) el.innerText = text }
        // Reset guard after current microtask batch so future React renders are caught
        Promise.resolve().then(() => { guard = false })
      }
      const obs = new MutationObserver(apply)
      obs.observe(el, { childList: true, characterData: true, subtree: true })
      observersRef.current.set(key, obs)
    })
  }, [])

  // ── Always tag + apply on page load for ALL users ─────────────────────────
  // Runs on: overrides load from Supabase, AND on every SPA navigation (location.pathname)
  // Triple-retry catches lazy-loaded React pages that render after the first timeout
  useEffect(() => {
    const run = () => { tagAndApply(overrides); attachObservers(overrides) }
    const t1 = setTimeout(run, 400)
    const t2 = setTimeout(run, 1100)
    const t3 = setTimeout(run, 2400)
    return () => {
      clearTimeout(t1); clearTimeout(t2); clearTimeout(t3)
      observersRef.current.forEach(obs => obs.disconnect())
      observersRef.current.clear()
    }
  }, [overrides, tagAndApply, attachObservers, location.pathname])

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
  // html param: rich HTML from WYSIWYG editor (optional, falls back to text)
  const saveOverride = useCallback(async (key, text, styles, html) => {
    setSaving(true)
    const el = document.querySelector(`[data-cms-id="${key}"]`)
    if (el) {
      if (html != null) el.innerHTML = html
      else if (text != null) el.innerText = text
      if (styles) Object.entries(styles).forEach(([k, v]) => { el.style[k] = v })
    }
    const newOverrides = { ...overrides, [key]: { text, styles, html } }
    setOverrides(newOverrides)
    applyOverrideStyles(newOverrides)
    attachObservers(newOverrides)
    const { error } = await supabase.from('cms_overrides').upsert(
      { element_key: key, text_content: text, styles, html_content: html, updated_at: new Date().toISOString() },
      { onConflict: 'element_key' }
    )
    setSaving(false)
    if (error) {
      console.error('[CMS] saveOverride failed:', error)
      alert(`CMS save error: ${error.message}\n\nThis override was NOT saved to the database and will reset on refresh.\n\nCheck Supabase → cms_overrides table and RLS policies.`)
    }
  }, [overrides, attachObservers])

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

  // ── Hide / show / restore components ─────────────────────────────────────
  const hideComponent = useCallback(async (key) => {
    const el = document.querySelector(`[data-cms-component="${key}"]`)
    if (el) el.style.display = 'none'
    const next = [...new Set([...hiddenComponents, key])]
    setHiddenComponents(next)
    await supabase.from('cms_site_settings').upsert(
      { key: 'hidden_components', value: next, updated_at: new Date().toISOString() },
      { onConflict: 'key' }
    )
  }, [hiddenComponents])

  const showComponent = useCallback(async (key) => {
    const el = document.querySelector(`[data-cms-component="${key}"]`)
    if (el) el.style.display = ''
    const next = hiddenComponents.filter(k => k !== key)
    setHiddenComponents(next)
    await supabase.from('cms_site_settings').upsert(
      { key: 'hidden_components', value: next, updated_at: new Date().toISOString() },
      { onConflict: 'key' }
    )
  }, [hiddenComponents])

  // ── Page block CRUD ──────────────────────────────────────────────────────
  const addPageBlock = useCallback(async (type, content) => {
    const page = window.location.pathname.replace(/\//g, '') || 'home'
    const maxOrder = pageBlocks.reduce((m, b) => Math.max(m, b.order_index), 0)
    setSaving(true)
    const { data } = await supabase.from('cms_page_blocks')
      .insert({ page_key: page, block_type: type, content, order_index: maxOrder + 1 })
      .select().single()
    if (data) setPageBlocks(prev => [...prev, data])
    setSaving(false)
  }, [pageBlocks])

  const deletePageBlock = useCallback(async (id) => {
    setPageBlocks(prev => prev.filter(b => b.id !== id))
    await supabase.from('cms_page_blocks').delete().eq('id', id)
  }, [])

  const updatePageBlock = useCallback(async (id, content) => {
    setPageBlocks(prev => prev.map(b => b.id === id ? { ...b, content } : b))
    setSaving(true)
    await supabase.from('cms_page_blocks').update({ content, updated_at: new Date().toISOString() }).eq('id', id)
    setSaving(false)
  }, [])

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
      hiddenComponents, hideComponent, showComponent, tagComponents,
      pageBlocks, addPageBlock, deletePageBlock, updatePageBlock,
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
