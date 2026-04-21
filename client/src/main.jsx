import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import '@fontsource/dm-sans/300.css'
import '@fontsource/dm-sans/400.css'
import '@fontsource/dm-sans/500.css'
import '@fontsource/dm-sans/600.css'
import '@fontsource/dm-sans/700.css'
import 'cesium/Build/Cesium/Widgets/widgets.css'
import './index.css'

// Apply the saved animations-off preference before React mounts so the user
// never sees a flash of animation on load (the Zap toggle in the TopBar
// writes localStorage `sw-anim-off`).
try {
  if (localStorage.getItem('sw-anim-off') === '1') {
    document.documentElement.classList.add('sw-no-anim')
  }
} catch {}

ReactDOM.createRoot(document.getElementById('root')).render(
  <BrowserRouter>
    <App />
  </BrowserRouter>
)
