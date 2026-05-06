/**
 * CMSContext — Universal visual editor.
 * When CMS mode ON: every text element on every page gets a dashed outline on hover.
 * Click any element → FloatingEditor panel appears (draggable).
 * Edit text, font size, font weight, color, background, alignment.
 * Saves to server DB via /api/cms — no Supabase RLS issues.
 */
import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import api from '../utils/api'
import { useAuth } from './AuthContext'

const CMSContext = createContext(null)

function rgbToHex(rgb) {
  if (!rgb || rgb === 'rgba(0, 0, 0, 0)' || rgb === 'transparent') return ''
  const m = rgb.match(/\d+/g)
  if (!m) return ''
  return '#' + m.slice(0, 3).map(n => parseInt(n).toString(16).padStart(2, '0')).join('')
}

const LS_TOOLBAR_OPEN = 'sw_cms_toolbar_open'

export function CMSProvider({ children }) {
  const { isAdmin } = useAuth()
  const location = useLocation()
  // Master switch — controls whether the CMS toolbar / overlays render at all.
  // Persisted so admins don't see CMS UI pop in on every page load. Default
  // closed so admin pages render cleanly until the user explicitly opens CMS.
  const [toolbarOpen, setToolbarOpen]   = useState(() => localStorage.getItem(LS_TOOLBAR_OPEN) === '1')
  const [cmsMode, setCmsMode]           = useState(false)
  const [content, setContent]           = useState({})
  const [overrides, setOverrides]       = useState({})
  const [saving, setSaving]             = useState(false)
  const [selectedEl, setSelectedEl]     = useState(null)
  const [notification, setNotification] = useState(null)
  const [hiddenComponents, setHiddenComponents] = useState([])
  const [pageBlocks, setPageBlocks]     = useState([])
  const styleTagRef  = useRef(null)
  const observersRef = useRef(new Map())

  // ── Load CMS field content ────────────────────────────────────────────────
  useEffect(() => {
    api.get('/cms/content').then(({ data }) => {
      setContent(data || {})
    }).catch(() => {})
  }, [])

  // ── Load element overrides ────────────────────────────────────────────────
  useEffect(() => {
    api.get('/cms/overrides').then(({ data }) => {
      setOverrides(data || {})
      applyOverrideStyles(data || {})
    }).catch(() => {})
  }, [])

  // ── Load site-wide notification bar ──────────────────────────────────────
  useEffect(() => {
    api.get('/cms/settings/notification_bar').then(({ data }) => {
      if (data) setNotification(data)
    }).catch(() => {})
  }, [])

  // ── Load hidden components ────────────────────────────────────────────────
  useEffect(() => {
    api.get('/cms/settings/hidden_components').then(({ data }) => {
      if (Array.isArray(data)) setHiddenComponents(data)
    }).catch(() => {})
  }, [])

  // ── Load page blocks for current page ─────────────────────────────────────
  useEffect(() => {
    const page = location.pathname.replace(/\//g, '') || 'home'
    api.get(`/cms/blocks/${page}`).then(({ data }) => {
      setPageBlocks(data || [])
    }).catch(() => {})
  }, [location.pathname])

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

  // ── Apply hidden components ───────────────────────────────────────────────
  const applyHiddenComponents = useCallback((hidden) => {
    ;(hidden || []).forEach(key => {
      const el = document.querySelector(`[data-cms-component="${key}"]`)
      if (el) el.style.display = 'none'
    })
  }, [])

  // Tag major sections with component IDs
  const tagComponents = useCallback(() => {
    const page = window.location.pathname.replace(/\//g, '') || 'home'
    const outlet = document.querySelector('[data-outlet]') || document.querySelector('main')
    if (!outlet) return []
    const tagged = []
    let idx = 0
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
      const heading = el.querySelector('h1,h2,h3,h4,h5,h6')
      const label = heading?.innerText?.trim()?.slice(0, 40) || el.className?.split(' ')[0] || `Section ${idx}`
      tagged.push({ key, label, el })
    })
    return tagged
  }, [])

  useEffect(() => {
    const t1 = setTimeout(() => applyHiddenComponents(hiddenComponents), 500)
    const t2 = setTimeout(() => applyHiddenComponents(hiddenComponents), 1500)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [hiddenComponents, applyHiddenComponents, location.pathname])

  // ── Tag elements and apply overrides ──────────────────────────────────────
  const tagAndApply = useCallback((ovrs) => {
    const page = window.location.pathname.replace(/\//g, '') || 'home'
    const tags = ['h1','h2','h3','h4','h5','h6','p','span','li','td','th','button','a','div','label']
    const slugCounters = {}
    const outlet = document.querySelector('[data-outlet]') || document.querySelector('main')
    document.querySelectorAll(tags.join(',')).forEach(el => {
      if (el.closest('[data-cms-ui]')) return
      if (el.closest('script,style,noscript,[data-no-cms]')) return
      if (el.getAttribute('data-cms-id')) return
      const text = el.innerText?.trim()
      if (!text || text.length < 1) return
      const directText = Array.from(el.childNodes)
        .filter(n => n.nodeType === Node.TEXT_NODE)
        .map(n => n.textContent.trim())
        .join('')
      if (!directText && el.children.length > 0) return
      const tag = el.tagName.toLowerCase()
      const isInPage = outlet ? outlet.contains(el) : true
      const ns = isInPage ? page : 'global'
      const slug = directText.slice(0, 22).replace(/[^a-zA-Z0-9]/g, '').toLowerCase() || 'el'
      const baseKey = `${ns}/${tag}/${slug}`
      slugCounters[baseKey] = (slugCounters[baseKey] || 0) + 1
      const count = slugCounters[baseKey]
      const key = count === 1 ? baseKey : `${baseKey}${count}`
      el.setAttribute('data-cms-id', key)
    })
    Object.entries(ovrs).forEach(([key, { text, html }]) => {
      const el = document.querySelector(`[data-cms-id="${key}"]`)
      if (!el) return
      if (html != null) { if (el.innerHTML !== html) el.innerHTML = html }
      else if (text != null) { if (el.innerText !== text) el.innerText = text }
    })
    applyOverrideStyles(ovrs)
  }, [])

  // ── MutationObserver: re-apply instantly when React reconciliation resets content ──
  const attachObservers = useCallback((ovrs) => {
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
        Promise.resolve().then(() => { guard = false })
      }
      const obs = new MutationObserver(apply)
      obs.observe(el, { childList: true, characterData: true, subtree: true })
      observersRef.current.set(key, obs)
    })
  }, [])

  // ── Tag + apply + attach on every page load / navigation ──────────────────
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

  // ── CMS edit-mode hover + click ───────────────────────────────────────────
  // When edit mode flips OFF we have to (1) clear the selected element so
  // FloatingEditor (TipTap) unmounts cleanly BEFORE we mutate DOM styles,
  // (2) defer the inline-style cleanup past React's commit phase so it can
  // never collide with React's own removeChild on the same nodes — that
  // collision was the source of the white-screen-on-Exit bug.
  useEffect(() => {
    if (!cmsMode) {
      setSelectedEl(null)
      const raf = requestAnimationFrame(() => {
        try {
          document.querySelectorAll('[data-cms-id]').forEach(el => {
            el.style.outline = ''
            el.style.outlineOffset = ''
            el.style.cursor = ''
          })
        } catch (e) { /* noop — DOM may have been replaced by route change */ }
      })
      return () => cancelAnimationFrame(raf)
    }
    const timer = setTimeout(() => tagAndApply(overrides), 200)
    return () => clearTimeout(timer)
  }, [cmsMode, overrides, tagAndApply])

  useEffect(() => {
    if (!cmsMode) return
    const handleClick = (e) => {
      const el = e.target.closest('[data-cms-id]')
      if (!el || el.closest('[data-cms-ui]')) {
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
        element: el, key, rect,
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

  // ── CMS field helpers (CMSField components) ───────────────────────────────
  const get = useCallback((pageKey, blockKey, field, defaultValue = '') => {
    return content[`${pageKey}__${blockKey}__${field}`] ?? defaultValue
  }, [content])

  const save = useCallback(async (pageKey, blockKey, field, value) => {
    const key = `${pageKey}__${blockKey}__${field}`
    setContent(prev => ({ ...prev, [key]: value }))
    setSaving(true)
    await api.put('/cms/content', { page_key: pageKey, block_key: blockKey, field, value }).catch(() => {})
    setSaving(false)
  }, [])

  // ── Element override save / delete ────────────────────────────────────────
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
    try {
      await api.put(`/cms/overrides/${encodeURIComponent(key)}`, {
        text_content: text ?? null,
        html_content: html ?? null,
        styles: styles || {},
      })
    } catch (e) {
      console.error('[CMS] saveOverride failed:', e)
      alert(`CMS save failed: ${e.response?.data?.error || e.message}\n\nThis change will reset on refresh.`)
    }
    setSaving(false)
  }, [overrides, attachObservers])

  const deleteOverride = useCallback(async (key) => {
    const el = document.querySelector(`[data-cms-id="${key}"]`)
    if (el) {
      el.removeAttribute('style')
      const orig = overrides[key]
      if (orig?.text) el.innerText = orig.text
    }
    const newOverrides = { ...overrides }
    delete newOverrides[key]
    setOverrides(newOverrides)
    applyOverrideStyles(newOverrides)
    await api.delete(`/cms/overrides/${encodeURIComponent(key)}`).catch(() => {})
  }, [overrides])

  // ── Hide / show components ────────────────────────────────────────────────
  const hideComponent = useCallback(async (key) => {
    const el = document.querySelector(`[data-cms-component="${key}"]`)
    if (el) el.style.display = 'none'
    const next = [...new Set([...hiddenComponents, key])]
    setHiddenComponents(next)
    await api.put('/cms/settings/hidden_components', { value: next }).catch(() => {})
  }, [hiddenComponents])

  const showComponent = useCallback(async (key) => {
    const el = document.querySelector(`[data-cms-component="${key}"]`)
    if (el) el.style.display = ''
    const next = hiddenComponents.filter(k => k !== key)
    setHiddenComponents(next)
    await api.put('/cms/settings/hidden_components', { value: next }).catch(() => {})
  }, [hiddenComponents])

  // ── Page blocks ───────────────────────────────────────────────────────────
  const addPageBlock = useCallback(async (type, blockContent) => {
    const page = window.location.pathname.replace(/\//g, '') || 'home'
    const maxOrder = pageBlocks.reduce((m, b) => Math.max(m, b.order_index), 0)
    setSaving(true)
    try {
      const { data } = await api.post('/cms/blocks', {
        page_key: page, block_type: type, content: blockContent, order_index: maxOrder + 1,
      })
      if (data) setPageBlocks(prev => [...prev, data])
    } catch (e) { console.error('[CMS] addPageBlock failed:', e) }
    setSaving(false)
  }, [pageBlocks])

  const deletePageBlock = useCallback(async (id) => {
    setPageBlocks(prev => prev.filter(b => b.id !== id))
    await api.delete(`/cms/blocks/${id}`).catch(() => {})
  }, [])

  const updatePageBlock = useCallback(async (id, blockContent) => {
    setPageBlocks(prev => prev.map(b => b.id === id ? { ...b, content: blockContent } : b))
    setSaving(true)
    await api.put(`/cms/blocks/${id}`, { content: blockContent }).catch(() => {})
    setSaving(false)
  }, [])

  // ── Notification bar ──────────────────────────────────────────────────────
  const saveNotification = useCallback(async (data) => {
    setNotification(data)
    await api.put('/cms/settings/notification_bar', { value: data }).catch(() => {})
  }, [])

  const toggleCmsMode = useCallback(() => {
    if (!isAdmin) return
    // Clear selected element FIRST so the FloatingEditor (TipTap) unmounts
    // before edit-mode cleanup runs. Otherwise React + TipTap can race on
    // the same DOM node and the page goes blank.
    setSelectedEl(null)
    setCmsMode(m => !m)
  }, [isAdmin])

  // Master toolbar visibility. When closed, no CMS UI is rendered at all
  // (no sidebar, no FloatingEditor, no component overlays). Closing also
  // exits edit mode + clears selection so nothing lingers on screen.
  const setCmsToolbarOpen = useCallback((open) => {
    if (!isAdmin) return
    const next = !!open
    localStorage.setItem(LS_TOOLBAR_OPEN, next ? '1' : '0')
    setToolbarOpen(next)
    if (!next) {
      setSelectedEl(null)
      setCmsMode(false)
    }
  }, [isAdmin])

  const toggleCmsToolbarOpen = useCallback(() => {
    setCmsToolbarOpen(!toolbarOpen)
  }, [toolbarOpen, setCmsToolbarOpen])

  const loadPage = useCallback(() => {}, [])

  return (
    <CMSContext.Provider value={{
      cmsMode, toggleCmsMode, get, save, loadPage, saving, isAdmin,
      toolbarOpen, setCmsToolbarOpen, toggleCmsToolbarOpen,
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
