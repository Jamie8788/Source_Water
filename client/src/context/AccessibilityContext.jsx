import React, { createContext, useContext, useState, useEffect } from 'react'

const AccessibilityContext = createContext(null)

const defaults = {
  textSize: 2, // index into sizes array
  zoom: 3,     // index into zooms array
  lineSpacing: 1, // index into spacings array
  highContrast: false,
  dyslexiaFont: false,
  underlineLinks: false,
  largeCursor: false,
  reduceMotion: false,
}

const TEXT_SIZES = [14, 16, 18, 20, 22]
const ZOOMS = [75, 90, 100, 110, 125, 150]
const LINE_SPACINGS = [1.2, 1.5, 1.8, 2.2]

export function AccessibilityProvider({ children }) {
  const [settings, setSettings] = useState(() => {
    try { return { ...defaults, ...JSON.parse(localStorage.getItem('sw_a11y')) } } catch { return defaults }
  })

  useEffect(() => {
    localStorage.setItem('sw_a11y', JSON.stringify(settings))
    const root = document.documentElement
    const textPx = TEXT_SIZES[settings.textSize]
    root.style.fontSize = textPx + 'px'
    // Elaine: when text size grew, only the main page scaled — the
    // sidebar was stuck because its inline styles use hardcoded px.
    // Emit a scale factor (relative to the default index 2 = 18px) so
    // the sidebar (and anything else that opts in) can multiply its
    // own dimensions. See .sw-sidebar-root rule in index.css.
    root.style.setProperty('--sw-text-scale', (textPx / TEXT_SIZES[defaults.textSize]).toFixed(4))
    root.style.zoom = ZOOMS[settings.zoom] / 100
    root.style.lineHeight = LINE_SPACINGS[settings.lineSpacing]
    root.classList.toggle('high-contrast', settings.highContrast)
    root.classList.toggle('dyslexia-font', settings.dyslexiaFont)
    root.classList.toggle('large-cursor', settings.largeCursor)
    if (settings.reduceMotion) {
      root.style.setProperty('--motion-duration', '0s')
    } else {
      root.style.removeProperty('--motion-duration')
    }
    // underline links
    const style = document.getElementById('sw-a11y-links') || (() => {
      const s = document.createElement('style'); s.id = 'sw-a11y-links'; document.head.appendChild(s); return s
    })()
    style.textContent = settings.underlineLinks ? 'a { text-decoration: underline !important; }' : ''
  }, [settings])

  const update = (key, value) => setSettings(s => ({ ...s, [key]: value }))
  const reset = () => setSettings(defaults)

  return (
    <AccessibilityContext.Provider value={{
      settings, update, reset,
      TEXT_SIZES, ZOOMS, LINE_SPACINGS,
      textSizeLabel: ['A', 'A', 'A', 'A', 'A'][settings.textSize],
      zoomLabel: ZOOMS[settings.zoom] + '%',
      lineSpacingLabel: LINE_SPACINGS[settings.lineSpacing] + 'x',
    }}>
      {children}
    </AccessibilityContext.Provider>
  )
}

export const useAccessibility = () => useContext(AccessibilityContext)
