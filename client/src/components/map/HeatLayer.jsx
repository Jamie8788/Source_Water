/**
 * HeatLayer — leaflet.heat density overlay for the Monitoring Map.
 *
 * Renders the same `mappable` array as either dots or a heat density
 * surface — surfaces "where are communities monitoring water" at a glance.
 * Pure additive: the underlying WR data is unchanged; this is just a
 * different visualization mode toggled from the toolbar.
 */
import { useEffect, useRef } from 'react'
import { useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet.heat'

export default function HeatLayer({ points, options }) {
  const map = useMap()
  const layerRef = useRef(null)

  useEffect(() => {
    if (!map) return
    // (re)build the layer whenever points change — leaflet.heat doesn't expose
    // a clean diff API, so a full replace is the simplest safe approach here.
    if (layerRef.current) {
      map.removeLayer(layerRef.current)
      layerRef.current = null
    }
    const data = (points || []).map(p => [p.lat, p.lng, p.intensity ?? 0.6])
    const layer = L.heatLayer(data, {
      radius: 22,
      blur: 18,
      minOpacity: 0.35,
      maxZoom: 12,
      gradient: { 0.2: '#1d4ed8', 0.4: '#3b82f6', 0.6: '#06b6d4', 0.8: '#f59e0b', 1.0: '#ef4444' },
      ...options,
    })
    layer.addTo(map)
    layerRef.current = layer
    return () => {
      if (layerRef.current) {
        map.removeLayer(layerRef.current)
        layerRef.current = null
      }
    }
  }, [map, points, options])

  return null
}
