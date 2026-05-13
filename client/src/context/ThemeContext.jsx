import React, { createContext, useContext, useState, useEffect } from 'react'

export const THEMES = {
  ocean:  { name: 'Ocean Blue',   primary: '#0ea5e9', secondary: '#14b8a6', accent: '#38bdf8', bg: '#f0f9ff', sidebar: '#0f172a' },
  forest: { name: 'Forest Green', primary: '#16a34a', secondary: '#059669', accent: '#4ade80', bg: '#f0fdf4', sidebar: '#052e16' },
  sunset: { name: 'Sunset',       primary: '#ea580c', secondary: '#dc2626', accent: '#fb923c', bg: '#fff7ed', sidebar: '#1c0a00' },
  arctic: { name: 'Arctic',       primary: '#6366f1', secondary: '#8b5cf6', accent: '#a5b4fc', bg: '#eef2ff', sidebar: '#1e1b4b' },
  coral:  { name: 'Coral Reef',   primary: '#db2777', secondary: '#9333ea', accent: '#f472b6', bg: '#fdf2f8', sidebar: '#2d0a2e' },
}

const ThemeContext = createContext(null)

// Light-mode skin variants (Elaine: white feels plain; want softer
// options where the page reads as a different shade from the sidebar).
// Each variant sets the page + sidebar + card + border tones so the
// whole UI feels intentional. Persisted to localStorage.
export const LIGHT_VARIANTS = {
  crisp: {
    name: 'Crisp',
    swatch: '#ffffff',
    pageBg:        '#ffffff',
    cardBg:        '#ffffff',
    border:        '#e2e8f0',
    sidebarGrad:   'linear-gradient(180deg, #f8fafc 0%, #eef1f5 100%)',
    sidebarBorder: 'rgba(60,75,95,0.16)',
  },
  paper: {
    name: 'Paper',
    swatch: '#f0ead8',
    pageBg:        '#f1e9d2',
    cardBg:        '#fbf7ec',
    border:        '#d9cfb6',
    sidebarGrad:   'linear-gradient(180deg, #f5f1e8 0%, #e8e3d5 45%, #d9d2c0 100%)',
    sidebarBorder: 'rgba(60,75,95,0.18)',
  },
  sand: {
    name: 'Sand',
    swatch: '#e8d8ba',
    pageBg:        '#e8d8ba',
    cardBg:        '#f5ead0',
    border:        '#c9b88f',
    sidebarGrad:   'linear-gradient(180deg, #efe4cf 0%, #e3d5b5 50%, #d3c39a 100%)',
    sidebarBorder: 'rgba(80,60,30,0.22)',
  },
  mist: {
    name: 'Mist',
    swatch: '#dde6ed',
    pageBg:        '#dde6ed',
    cardBg:        '#eef4f8',
    border:        '#bdcad8',
    sidebarGrad:   'linear-gradient(180deg, #e8eef4 0%, #d8e1ea 45%, #c6d2de 100%)',
    sidebarBorder: 'rgba(60,75,95,0.18)',
  },
}

export function ThemeProvider({ children }) {
  const [mode, setMode] = useState(() => localStorage.getItem('sw_mode') || 'light')
  const [colorKey, setColorKey] = useState(() => localStorage.getItem('sw_color') || 'ocean')
  const [lightVariant, setLightVariant] = useState(() => localStorage.getItem('sw_light_variant') || 'paper')

  const theme = THEMES[colorKey] || THEMES.ocean
  const variant = LIGHT_VARIANTS[lightVariant] || LIGHT_VARIANTS.paper

  useEffect(() => {
    localStorage.setItem('sw_mode', mode)
    localStorage.setItem('sw_color', colorKey)
    localStorage.setItem('sw_light_variant', lightVariant)
    const root = document.documentElement
    root.setAttribute('data-theme', mode)
    root.setAttribute('data-color', colorKey)
    root.setAttribute('data-light-variant', lightVariant)
    // CSS custom properties — palette
    root.style.setProperty('--color-primary', theme.primary)
    root.style.setProperty('--color-secondary', theme.secondary)
    root.style.setProperty('--color-accent', theme.accent)
    root.style.setProperty('--color-bg', mode === 'dark' ? '#0f172a' : theme.bg)
    root.style.setProperty('--color-sidebar', theme.sidebar)
    root.style.setProperty('--color-card', mode === 'dark' ? '#1e293b' : '#ffffff')
    root.style.setProperty('--color-text', mode === 'dark' ? '#f1f5f9' : '#1e293b')
    root.style.setProperty('--color-text-muted', mode === 'dark' ? '#94a3b8' : '#6b7280')
    root.style.setProperty('--color-border', mode === 'dark' ? '#334155' : '#e0f2fe')
    // Apply the light variant ONLY in light mode. Dark mode keeps its
    // own palette in index.css [data-theme="dark"].
    if (mode !== 'dark') {
      root.style.setProperty('--page-bg', variant.pageBg)
      root.style.setProperty('--card-bg', variant.cardBg)
      root.style.setProperty('--border',  variant.border)
      root.style.setProperty('--sw-sidebar-gradient', variant.sidebarGrad)
      root.style.setProperty('--sw-sidebar-border',   variant.sidebarBorder)
    } else {
      // Clear variant overrides so the dark theme's own rules win.
      root.style.removeProperty('--page-bg')
      root.style.removeProperty('--card-bg')
      root.style.removeProperty('--border')
      root.style.removeProperty('--sw-sidebar-gradient')
      root.style.removeProperty('--sw-sidebar-border')
    }
  }, [mode, colorKey, theme, lightVariant, variant])

  const toggleMode = () => setMode(m => m === 'light' ? 'dark' : 'light')

  return (
    <ThemeContext.Provider value={{
      mode, isDark: mode === 'dark', toggleMode,
      colorKey, setColorKey,
      lightVariant, setLightVariant, variants: LIGHT_VARIANTS,
      theme, themes: THEMES,
    }}>
      {children}
    </ThemeContext.Provider>
  )
}

export const useTheme = () => useContext(ThemeContext)
