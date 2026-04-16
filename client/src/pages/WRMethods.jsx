/**
 * WRMethods — Methods & Data Quality Reference
 * Scientific trust layer for Water Rangers data
 * - Parameter definitions + WHO thresholds
 * - QA workflow explanation
 * - Equipment reference
 * - Data provenance + licensing
 */
import { useState, useEffect } from 'react'
import {
  Shield, Beaker, CheckCircle, AlertTriangle, Info,
  ExternalLink, BookOpen, Award, Microscope, Gauge,
} from 'lucide-react'
import { getDatasets, getDatasetForm, isConfigured, QA_STATUS } from '../api/waterRangers'

// ── Standard water quality parameters ────────────────────────────────────────
const PARAMETERS = [
  { name: 'pH', unit: '', who_min: 6.5, who_max: 8.5, desc: 'Measure of acidity/alkalinity. Critical for aquatic life. Below 6.5 or above 8.5 indicates potential issues.', category: 'Chemical' },
  { name: 'Temperature', unit: '°C', who_min: null, who_max: null, desc: 'Water temperature affects dissolved oxygen, metabolic rates, and species distribution. Natural variation expected.', category: 'Physical' },
  { name: 'Dissolved Oxygen', unit: 'mg/L', who_min: 6, who_max: null, desc: 'Amount of oxygen dissolved in water. Below 6 mg/L can stress aquatic organisms. Below 2 mg/L is hypoxic.', category: 'Chemical' },
  { name: 'Turbidity', unit: 'NTU', who_min: null, who_max: 5, desc: 'Measure of water clarity. Higher values indicate more suspended particles. WHO guideline: <5 NTU for drinking water.', category: 'Physical' },
  { name: 'Conductivity', unit: 'µS/cm', who_min: null, who_max: 1500, desc: 'Electrical conductivity indicates total dissolved solids. Higher values suggest mineral content or contamination.', category: 'Physical' },
  { name: 'Nitrate-Nitrogen', unit: 'mg/L', who_min: null, who_max: 10, desc: 'Nitrogen as nitrate. High levels from agricultural runoff or sewage. WHO guideline: <10 mg/L for drinking water.', category: 'Nutrient' },
  { name: 'Phosphorus', unit: 'mg/L', who_min: null, who_max: 0.03, desc: 'Key nutrient driving eutrophication. Levels above 0.03 mg/L can trigger algal blooms in freshwater.', category: 'Nutrient' },
  { name: 'Chlorine', unit: 'mg/L', who_min: 0.2, who_max: 5, desc: 'Residual chlorine in treated water. Should be 0.2–5.0 mg/L for safe disinfection.', category: 'Chemical' },
  { name: 'E. coli / Coliform', unit: 'CFU/100mL', who_min: null, who_max: 0, desc: 'Indicator of fecal contamination. Any presence in drinking water is a concern. Beach guidelines vary by jurisdiction.', category: 'Biological' },
  { name: 'Secchi Depth', unit: 'm', who_min: null, who_max: null, desc: 'Visual measure of water clarity using a Secchi disk. Deeper readings indicate clearer water. Varies by water body.', category: 'Physical' },
  { name: 'Chlorophyll-a', unit: 'µg/L', who_min: null, who_max: 10, desc: 'Indicator of algal biomass. Elevated levels (>10 µg/L) suggest eutrophic conditions and potential bloom risk.', category: 'Biological' },
  { name: 'Alkalinity', unit: 'mg/L CaCO₃', who_min: 20, who_max: 200, desc: 'Buffering capacity of water. Low alkalinity makes water vulnerable to pH changes from acid rain or runoff.', category: 'Chemical' },
]

const CATEGORIES = ['All', 'Physical', 'Chemical', 'Nutrient', 'Biological']

function ParamCard({ p }) {
  return (
    <div style={{
      background: 'var(--card-bg)', border: '1px solid var(--border)',
      borderRadius: 12, padding: 16,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <h4 style={{ color: 'var(--text)', fontSize: 14, fontWeight: 800, margin: 0 }}>{p.name}</h4>
        <span style={{
          padding: '2px 8px', borderRadius: 8, fontSize: 10, fontWeight: 700,
          background: p.category === 'Chemical' ? 'rgba(99,102,241,.1)' : p.category === 'Physical' ? 'rgba(20,184,166,.1)' : p.category === 'Nutrient' ? 'rgba(245,158,11,.1)' : 'rgba(236,72,153,.1)',
          color: p.category === 'Chemical' ? '#818cf8' : p.category === 'Physical' ? '#14b8a6' : p.category === 'Nutrient' ? '#f59e0b' : '#ec4899',
        }}>{p.category}</span>
      </div>
      <p style={{ color: 'var(--text-muted)', fontSize: 12, lineHeight: 1.6, margin: '0 0 10px' }}>{p.desc}</p>
      <div style={{ display: 'flex', gap: 12, fontSize: 11 }}>
        {p.unit && <span style={{ color: 'var(--text-muted)' }}>Unit: <strong style={{ color: 'var(--text)' }}>{p.unit}</strong></span>}
        {p.who_min !== null && <span style={{ color: 'var(--text-muted)' }}>Min: <strong style={{ color: '#10b981' }}>{p.who_min}</strong></span>}
        {p.who_max !== null && <span style={{ color: 'var(--text-muted)' }}>Max: <strong style={{ color: '#ef4444' }}>{p.who_max}</strong></span>}
      </div>
    </div>
  )
}

export default function WRMethods() {
  const [category, setCategory] = useState('All')
  const [datasets, setDatasets] = useState([])
  const [dsLoading, setDsLoading] = useState(false)

  useEffect(() => {
    if (!isConfigured()) return
    setDsLoading(true)
    getDatasets({ page: 1, perPage: 20 })
      .then(r => setDatasets(r.items || []))
      .catch(() => {})
      .finally(() => setDsLoading(false))
  }, [])

  const filtered = category === 'All' ? PARAMETERS : PARAMETERS.filter(p => p.category === category)

  return (
    <div style={{ minHeight: 'calc(100vh - 130px)' }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ color: 'var(--text)', fontSize: 22, fontWeight: 900, margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Shield size={22} color="#10b981" /> Methods & Data Quality
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: 12 }}>
          Scientific reference for Water Rangers data — parameters, QA workflows, and provenance
        </p>
      </div>

      {/* ── QA Workflow ──────────────────────────────────────────────────── */}
      <div style={{
        background: 'var(--card-bg)', border: '1px solid var(--border)',
        borderRadius: 14, padding: 20, marginBottom: 20,
      }}>
        <h3 style={{ color: 'var(--text)', fontSize: 15, fontWeight: 800, margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: 6 }}>
          <CheckCircle size={16} color="#10b981" /> Quality Assurance Workflow
        </h3>
        <p style={{ color: 'var(--text-muted)', fontSize: 12, lineHeight: 1.6, marginBottom: 14 }}>
          Every observation goes through Water Rangers' QA pipeline. The <code>checked</code> field on each observation tracks its status:
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10 }}>
          {Object.entries(QA_STATUS).map(([key, qa]) => (
            <div key={key} style={{
              padding: 12, borderRadius: 10,
              background: `${qa.color}08`, border: `1px solid ${qa.color}20`,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: qa.color }} />
                <span style={{ color: qa.color, fontSize: 13, fontWeight: 700 }}>{qa.label}</span>
              </div>
              <p style={{ color: 'var(--text-muted)', fontSize: 11, margin: 0 }}>{qa.desc}</p>
              <code style={{ fontSize: 10, color: 'var(--text-muted)', opacity: .6 }}>checked: "{key}"</code>
            </div>
          ))}
        </div>
      </div>

      {/* ── Parameter Reference ──────────────────────────────────────────── */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h3 style={{ color: 'var(--text)', fontSize: 15, fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Beaker size={16} color="#6366f1" /> Parameter Reference
          </h3>
          <div style={{ display: 'flex', gap: 4 }}>
            {CATEGORIES.map(c => (
              <button key={c} onClick={() => setCategory(c)} style={{
                padding: '4px 10px', borderRadius: 8, fontSize: 11, fontWeight: 600,
                background: category === c ? 'rgba(99,102,241,.15)' : 'transparent',
                border: category === c ? '1px solid rgba(99,102,241,.3)' : '1px solid transparent',
                color: category === c ? '#a78bfa' : 'var(--text-muted)', cursor: 'pointer',
              }}>{c}</button>
            ))}
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 10 }}>
          {filtered.map(p => <ParamCard key={p.name} p={p} />)}
        </div>
      </div>

      {/* ── Data Provenance ──────────────────────────────────────────────── */}
      <div style={{
        background: 'var(--card-bg)', border: '1px solid var(--border)',
        borderRadius: 14, padding: 20, marginBottom: 20,
      }}>
        <h3 style={{ color: 'var(--text)', fontSize: 15, fontWeight: 800, margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: 6 }}>
          <BookOpen size={16} color="#f59e0b" /> Data Provenance & Licensing
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, fontSize: 12 }}>
          <div>
            <h4 style={{ color: 'var(--text)', fontWeight: 700, marginBottom: 4 }}>Source</h4>
            <p style={{ color: 'var(--text-muted)', lineHeight: 1.6, margin: 0 }}>
              Water Rangers — Canada's largest community-based water monitoring platform.
              Data collected by trained citizen scientists using standardized protocols and equipment.
            </p>
          </div>
          <div>
            <h4 style={{ color: 'var(--text)', fontWeight: 700, marginBottom: 4 }}>License</h4>
            <p style={{ color: 'var(--text-muted)', lineHeight: 1.6, margin: 0 }}>
              Open Data Commons Attribution Licence (ODC-By). Attribution required:
              <em style={{ color: '#f59e0b' }}> "SOURCE: [Dataset] by [Organization] is licensed under ODC-By."</em>
            </p>
          </div>
        </div>
        <div style={{ marginTop: 12, display: 'flex', gap: 10 }}>
          <a href="https://data.waterrangers.com/api" target="_blank" rel="noreferrer"
            style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#6366f1', fontSize: 11, fontWeight: 600 }}>
            <ExternalLink size={11} /> API Docs
          </a>
          <a href="https://data.waterrangers.com/maps" target="_blank" rel="noreferrer"
            style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#14b8a6', fontSize: 11, fontWeight: 600 }}>
            <ExternalLink size={11} /> Data Map
          </a>
          <a href="https://waterrangers.com/about/faqs/" target="_blank" rel="noreferrer"
            style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#f59e0b', fontSize: 11, fontWeight: 600 }}>
            <ExternalLink size={11} /> FAQ
          </a>
        </div>
      </div>

      {/* ── Dataset Freshness ────────────────────────────────────────────── */}
      {datasets.length > 0 && (
        <div>
          <h3 style={{ color: 'var(--text)', fontSize: 15, fontWeight: 800, margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Gauge size={16} color="#14b8a6" /> Dataset Freshness
          </h3>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {['Dataset', 'Status', 'Start Date', 'DataStream'].map(h => (
                    <th key={h} style={{ padding: '8px 10px', color: 'var(--text-muted)', textAlign: 'left', fontWeight: 600, fontSize: 11 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {datasets.map((ds, i) => (
                  <tr key={ds.id || i} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '8px 10px', color: 'var(--text)', fontWeight: 600 }}>{ds.name || `#${ds.id}`}</td>
                    <td style={{ padding: '8px 10px' }}>
                      <span style={{
                        padding: '2px 7px', borderRadius: 6, fontSize: 10, fontWeight: 700,
                        background: ds.dormant ? 'rgba(239,68,68,.1)' : 'rgba(16,185,129,.1)',
                        color: ds.dormant ? '#ef4444' : '#10b981',
                      }}>{ds.dormant ? 'Dormant' : 'Active'}</span>
                    </td>
                    <td style={{ padding: '8px 10px', color: 'var(--text-muted)' }}>{ds.start_date ? new Date(ds.start_date).toLocaleDateString() : '—'}</td>
                    <td style={{ padding: '8px 10px', color: ds.share_with_datastream ? '#14b8a6' : 'var(--text-muted)' }}>
                      {ds.share_with_datastream ? '✓ Integrated' : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
