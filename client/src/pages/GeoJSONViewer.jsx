import { useState, useEffect } from 'react'
import api from '../utils/api'
import { X, Download, Copy, Check } from 'lucide-react'

export default function GeoJSONViewer({ onClose }) {
  const [geojson, setGeojson] = useState(null)
  const [copied, setCopied] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    api.get('/sites/geojson/export')
      .then(r => setGeojson(r.data))
      .catch(e => console.error('Failed to fetch GeoJSON:', e))
      .finally(() => setLoading(false))
  }, [])

  const handleCopy = () => {
    navigator.clipboard.writeText(JSON.stringify(geojson, null, 2))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleDownload = () => {
    const blob = new Blob([JSON.stringify(geojson, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'sites.geojson'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0,0,0,0.8)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      padding: '20px'
    }}>
      <div style={{
        background: '#1a1a2e',
        borderRadius: '8px',
        maxWidth: '800px',
        width: '100%',
        maxHeight: '90vh',
        display: 'flex',
        flexDirection: 'column',
        border: '1px solid #6366f1'
      }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '20px',
          borderBottom: '1px solid #333'
        }}>
          <h2 style={{ margin: 0, color: '#fff' }}>Sites GeoJSON Export</h2>
          <button onClick={onClose} style={{
            background: 'none',
            border: 'none',
            color: '#999',
            cursor: 'pointer',
            fontSize: '24px'
          }}>
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div style={{
          flex: 1,
          overflow: 'auto',
          padding: '20px',
          background: '#0f0f1e'
        }}>
          {loading ? (
            <div style={{ color: '#999', textAlign: 'center', padding: '40px' }}>
              Loading coordinates...
            </div>
          ) : geojson ? (
            <>
              <div style={{
                background: '#1a1a2e',
                padding: '16px',
                borderRadius: '6px',
                marginBottom: '16px',
                fontFamily: 'monospace',
                fontSize: '12px',
                color: '#6ef',
                maxHeight: '400px',
                overflow: 'auto',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word'
              }}>
                {JSON.stringify(geojson, null, 2)}
              </div>
              <div style={{
                fontSize: '12px',
                color: '#999',
                marginBottom: '16px'
              }}>
                <p><strong>Total Sites:</strong> {geojson.features?.length}</p>
                <div style={{ marginTop: '16px', display: 'grid', gap: '12px' }}>
                  {geojson.features && geojson.features.slice(0, 10).map((f, i) => (
                    <div key={i} style={{
                      background: '#1a1a2e',
                      padding: '10px',
                      borderRadius: '4px',
                      borderLeft: '3px solid #6366f1'
                    }}>
                      <div style={{ fontWeight: 'bold', color: '#6ef', marginBottom: '6px' }}>
                        📍 {f.properties.name}
                      </div>
                      <div style={{ fontSize: '11px', color: '#999', marginBottom: '6px' }}>
                        Coords: {f.geometry.coordinates[1].toFixed(4)}, {f.geometry.coordinates[0].toFixed(4)}
                      </div>
                      <div style={{ fontSize: '11px', color: '#999', marginBottom: '6px' }}>
                        Organization: {f.properties.organization || 'N/A'}
                      </div>
                      <div style={{ fontSize: '11px', color: '#999', marginBottom: '6px' }}>
                        Observations: {f.properties.observation_count}
                      </div>
                      {f.properties.last_measurement && (
                        <div style={{
                          marginTop: '8px',
                          paddingTop: '8px',
                          borderTop: '1px solid #333',
                          fontSize: '11px'
                        }}>
                          <div style={{ color: '#6ef', fontWeight: 'bold', marginBottom: '4px' }}>Last Measurements:</div>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px' }}>
                            {f.properties.last_measurement.ph !== null && <div>pH: <span style={{ color: '#6ef' }}>{f.properties.last_measurement.ph}</span></div>}
                            {f.properties.last_measurement.dissolved_oxygen !== null && <div>DO: <span style={{ color: '#6ef' }}>{f.properties.last_measurement.dissolved_oxygen}</span> mg/L</div>}
                            {f.properties.last_measurement.chlorine !== null && <div>Chlorine: <span style={{ color: '#6ef' }}>{f.properties.last_measurement.chlorine}</span> ppm</div>}
                            {f.properties.last_measurement.hardness !== null && <div>Hardness: <span style={{ color: '#6ef' }}>{f.properties.last_measurement.hardness}</span></div>}
                            {f.properties.last_measurement.alkalinity !== null && <div>Alkalinity: <span style={{ color: '#6ef' }}>{f.properties.last_measurement.alkalinity}</span> mg/L</div>}
                          </div>
                          <div style={{ color: '#666', fontSize: '10px', marginTop: '4px' }}>
                            Measured: {new Date(f.properties.last_measurement.date).toLocaleDateString()}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                {geojson.features?.length > 10 && <div style={{ marginTop: '12px', color: '#666' }}>... and {geojson.features.length - 10} more</div>}
              </div>
            </>
          ) : (
            <div style={{ color: '#f44', textAlign: 'center', padding: '40px' }}>
              Failed to load GeoJSON
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          display: 'flex',
          gap: '10px',
          padding: '20px',
          borderTop: '1px solid #333'
        }}>
          <button onClick={handleCopy} style={{
            flex: 1,
            background: '#6366f1',
            color: '#fff',
            border: 'none',
            padding: '10px 16px',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px'
          }}>
            {copied ? <Check size={16} /> : <Copy size={16} />}
            {copied ? 'Copied!' : 'Copy JSON'}
          </button>
          <button onClick={handleDownload} style={{
            flex: 1,
            background: '#059669',
            color: '#fff',
            border: 'none',
            padding: '10px 16px',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px'
          }}>
            <Download size={16} />
            Download .geojson
          </button>
          <button onClick={onClose} style={{
            flex: 1,
            background: '#666',
            color: '#fff',
            border: 'none',
            padding: '10px 16px',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '14px'
          }}>
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
