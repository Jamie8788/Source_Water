import React from 'react'
import { X } from 'lucide-react'
import { useAccessibility } from '../../context/AccessibilityContext'

export default function AccessibilityPanel({ onClose }) {
  const { settings, update, reset, TEXT_SIZES, ZOOMS, LINE_SPACINGS } = useAccessibility()

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end p-4 pointer-events-none">
      <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 w-80 pointer-events-auto overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 bg-gradient-to-r from-ocean-500 to-teal-500">
          <h2 className="text-white font-bold text-lg">Accessibility</h2>
          <button onClick={onClose} className="text-white/80 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Text size */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Text Size</label>
            <div className="flex gap-1">
              {TEXT_SIZES.map((size, i) => (
                <button
                  key={i}
                  onClick={() => update('textSize', i)}
                  className={`flex-1 py-2 rounded-lg font-bold transition-all border-2 ${settings.textSize === i ? 'bg-ocean-500 border-ocean-500 text-white' : 'bg-gray-50 border-gray-200 text-gray-600 hover:border-ocean-300'}`}
                  style={{ fontSize: 12 + i * 2 }}
                >
                  A
                </button>
              ))}
            </div>
          </div>

          {/* Zoom */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Zoom Level</label>
            <div className="flex flex-wrap gap-1">
              {ZOOMS.map((zoom, i) => (
                <button
                  key={i}
                  onClick={() => update('zoom', i)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-all border-2 ${settings.zoom === i ? 'bg-ocean-500 border-ocean-500 text-white' : 'bg-gray-50 border-gray-200 text-gray-600 hover:border-ocean-300'}`}
                >
                  {zoom}%
                </button>
              ))}
            </div>
          </div>

          {/* Line spacing */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Line Spacing</label>
            <div className="flex gap-1">
              {LINE_SPACINGS.map((sp, i) => (
                <button
                  key={i}
                  onClick={() => update('lineSpacing', i)}
                  className={`flex-1 py-1.5 rounded-lg text-sm font-semibold transition-all border-2 ${settings.lineSpacing === i ? 'bg-ocean-500 border-ocean-500 text-white' : 'bg-gray-50 border-gray-200 text-gray-600 hover:border-ocean-300'}`}
                >
                  {sp}x
                </button>
              ))}
            </div>
          </div>

          {/* Toggles */}
          <div className="space-y-3">
            {[
              { key: 'highContrast', label: 'High Contrast' },
              { key: 'dyslexiaFont', label: 'Dyslexia-Friendly Font' },
              { key: 'underlineLinks', label: 'Underline Links' },
              { key: 'largeCursor', label: 'Large Cursor' },
              // Reduce Motion removed — the global effects toggle in
              // TopBar already covers this and a second control was
              // confusing users (Elaine flagged it as not needed).
            ].map(({ key, label }) => (
              <div key={key} className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">{label}</span>
                <button
                  onClick={() => update(key, !settings[key])}
                  className={`relative w-11 h-6 rounded-full transition-colors duration-200 ${settings[key] ? 'bg-ocean-500' : 'bg-gray-200'}`}
                >
                  <div className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200 ${settings[key] ? 'translate-x-5' : ''}`} />
                </button>
              </div>
            ))}
          </div>

          <button onClick={reset} className="w-full py-2 text-sm text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 transition-all">
            Reset to defaults
          </button>
        </div>
      </div>
    </div>
  )
}
