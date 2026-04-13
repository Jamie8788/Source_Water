import { useState } from 'react'
import Papa from 'papaparse'
import api from '../../utils/api'

export default function ImportModal({ onClose, onSuccess }) {
  const [file, setFile] = useState(null)
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState(null)

  const handleFileChange = (e) => {
    const f = e.target.files?.[0]
    if (!f) return
    setFile(f)

    Papa.parse(f, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        setRows(results.data)
        setStatus(`✅ Parsed ${results.data.length} rows`)
      },
      error: (err) => {
        setStatus(`❌ Parse error: ${err.message}`)
      }
    })
  }

  const handleImport = async () => {
    if (!rows.length) {
      setStatus('❌ No data to import')
      return
    }

    setLoading(true)
    try {
      const res = await api.post('/import/csv', { rows })
      setStatus(
        `✅ Import complete:\n` +
        `${res.data.sites_created} sites created\n` +
        `${res.data.observations_created} observations created` +
        (res.data.errors.length > 0 ? `\n⚠️ ${res.data.errors.length} errors` : '')
      )
      
      // Refresh data on map
      if (onSuccess) onSuccess()
      
      // Auto-close after 3 seconds
      setTimeout(() => onClose(), 3000)
    } catch (err) {
      setStatus(`❌ Import failed: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center',
      justifyContent: 'center', zIndex: 9999
    }}>
      <div style={{
        background: 'linear-gradient(135deg, #1e1b4b 0%, #16213e 100%)',
        padding: '24px', borderRadius: '12px', maxWidth: '500px',
        width: '90%', color: '#fff', boxShadow: '0 20px 60px rgba(0,0,0,0.4)'
      }}>
        <h2 style={{ margin: '0 0 16px' }}>📊 Bulk Import CSV</h2>
        
        <div style={{
          border: '2px dashed #06b6d4', borderRadius: '8px',
          padding: '16px', marginBottom: '16px', textAlign: 'center',
          background: 'rgba(6,182,212,0.05)'
        }}>
          <input
            type="file"
            accept=".csv"
            onChange={handleFileChange}
            disabled={loading}
            style={{ display: 'none' }}
            id="csv-input"
          />
          <label htmlFor="csv-input" style={{
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.5 : 1
          }}>
            {file ? `📁 ${file.name}` : '📂 Click to select CSV'}
          </label>
        </div>

        {rows.length > 0 && (
          <div style={{
            background: 'rgba(0,0,0,0.3)', padding: '12px',
            borderRadius: '6px', marginBottom: '16px', fontSize: '13px'
          }}>
            <div>📋 Preview: <strong>{rows.length}</strong> data rows</div>
            <div style={{ fontSize: '11px', opacity: 0.7, marginTop: '4px' }}>
              Columns: {Object.keys(rows[0] || {}).slice(0, 5).join(', ')}...
            </div>
          </div>
        )}

        {status && (
          <div style={{
            background: status.includes('❌') ? 'rgba(239,68,68,0.2)' : 'rgba(34,197,94,0.2)',
            color: status.includes('❌') ? '#fca5a5' : '#86efac',
            padding: '12px', borderRadius: '6px', marginBottom: '16px',
            fontSize: '12px', whiteSpace: 'pre-wrap'
          }}>
            {status}
          </div>
        )}

        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            disabled={loading}
            style={{
              padding: '8px 16px', borderRadius: '6px',
              border: 'none', background: 'rgba(255,255,255,0.1)',
              color: '#fff', cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.5 : 1
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleImport}
            disabled={!rows.length || loading}
            style={{
              padding: '8px 16px', borderRadius: '6px', border: 'none',
              background: rows.length && !loading ? 'linear-gradient(135deg, #06b6d4, #14b8a6)' : 'rgba(6,182,212,0.3)',
              color: '#fff', cursor: rows.length && !loading ? 'pointer' : 'not-allowed',
              fontWeight: 'bold'
            }}
          >
            {loading ? '⏳ Importing...' : '🚀 Import'}
          </button>
        </div>
      </div>
    </div>
  )
}
