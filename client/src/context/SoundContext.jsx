import React, { createContext, useContext, useState } from 'react'
import { sounds } from '../utils/sounds'

const SoundContext = createContext(null)

export function SoundProvider({ children }) {
  const [enabled, setEnabled] = useState(() => localStorage.getItem('sw_sound') !== 'false')

  const play = (name) => {
    if (enabled && sounds[name]) sounds[name]()
  }

  const toggle = () => {
    setEnabled(prev => {
      localStorage.setItem('sw_sound', !prev)
      return !prev
    })
  }

  return (
    <SoundContext.Provider value={{ play, enabled, toggle }}>
      {children}
    </SoundContext.Provider>
  )
}

export const useSound = () => useContext(SoundContext)
