import React, { createContext, useContext, useState, useEffect } from 'react'

export const THEMES = {
  ocean:  { name: 'Ocean Blue',   primary: '#0ea5e9', secondary: '#14b8a6', accent: '#38bdf8', bg: '#f0f9ff', sidebar: '#0f172a' },
  forest: { name: 'Forest Green', primary: '#16a34a', secondary: '#059669', accent: '#4ade80', bg: '#f0fdf4', sidebar: '#052e16' },
  sunset: { name: 'Sunset',       primary: '#ea580c', secondary: '#dc2626', accent: '#fb923c', bg: '#fff7ed', sidebar: '#1c0a00' },
  arctic: { name: 'Arctic',       primary: '#6366f1', secondary: '#8b5cf6', accent: '#a5b4fc', bg: '#eef2ff', sidebar: '#1e1b4b' },
  coral:  { name: 'Coral Reef',   primary: '#db2777', secondary: '#9333ea', accent: '#f472b6', bg: '#fdf2f8', sidebar: '#2d0a2e' },
}

const ThemeContext = createContext(null)

export function ThemeProvider({ children }) {
  const [mode, setMode] = useState(() => localStorage.getItem('sw_mode') || 'light')
  const [colorKey, setColorKey] = useState(() => localStorage.getItem('sw_color') || 'ocean')

  const theme = THEMES[colorKey] || THEMES.ocean

  useEffect(() => {
    localStorage.setItem('sw_mode', mode)
    localStorage.setItem('sw_color', colorKey)
    const root = document.documentElement
    root.setAttribute('data-theme', mode)
    root.setAttribute('data-color', colorKey)
    // CSS custom properties
    root.style.setProperty('--color-primary', theme.primary)
    root.style.setProperty('--color-secondary', theme.secondary)
    root.style.setProperty('--color-accent', theme.accent)
    root.style.setProperty('--color-bg', mode === 'dark' ? '#0f172a' : theme.bg)
    root.style.setProperty('--color-sidebar', theme.sidebar)
    root.style.setProperty('--color-card', mode === 'dark' ? '#1e293b' : '#ffffff')
    root.style.setProperty('--color-text', mode === 'dark' ? '#f1f5f9' : '#1e293b')
    root.style.setProperty('--color-text-muted', mode === 'dark' ? '#94a3b8' : '#6b7280')
    root.style.setProperty('--color-border', mode === 'dark' ? '#334155' : '#e0f2fe')
  }, [mode, colorKey, theme])

  const toggleMode = () => setMode(m => m === 'light' ? 'dark' : 'light')

  return (
    <ThemeContext.Provider value={{
      mode, isDark: mode === 'dark', toggleMode,
      colorKey, setColorKey,
      theme, themes: THEMES,
    }}>
      {children}
    </ThemeContext.Provider>
  )
}

export const useTheme = () => useContext(ThemeContext)
