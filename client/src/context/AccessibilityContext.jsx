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
    // Text scale relative to the default (index 2 = 18px). 1.0 at default,
    // up to ~1.22 at the largest setting.
    const textScale = textPx / TEXT_SIZES[defaults.textSize]
    // Why this drives ZOOM, not just root font-size: almost all of the app's
    // text is styled with hardcoded px in inline styles (e.g. fontSize: 12),
    // which root font-size can't touch — so "Text Size" used to visibly change
    // almost nothing, and users said text was still too small. Folding the text
    // scale into the page zoom makes EVERY tab's text grow together, uniformly,
    // and scales proportionally so tables/cards keep their layout (they just get
    // bigger) instead of overflowing. The Zoom control multiplies on top.
    // Keep the rem base fixed at the default and the sidebar var neutral so
    // rem-based text and the opted-in sidebar don't get scaled a second time.
    root.style.fontSize = TEXT_SIZES[defaults.textSize] + 'px'
    root.style.setProperty('--sw-text-scale', '1')
    root.style.zoom = ((ZOOMS[settings.zoom] / 100) * textScale).toFixed(4)
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
