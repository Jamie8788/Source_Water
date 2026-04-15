import { useEffect, useMemo, useState } from 'react'
import api from '../../utils/api'
import {
  Plus, Edit2, Trash2, Save, X, RefreshCw, ArrowUp, ArrowDown,
  Upload, Image as ImageIcon, ExternalLink, Eye, EyeOff,
} from 'lucide-react'

const EMPTY_FORM = {
  name: '',
  website_url: '',
  alt_text: '',
  tagline: '',
  display_order: '0',
  is_active: true,
}

function getAssetBaseUrl() {
  const apiBase = import.meta.env.VITE_API_URL || ''
  if (!apiBase) return ''
  return apiBase.replace(/\/api\/?$/, '')
}

function resolveLogoUrl(rawUrl) {
  if (!rawUrl) return ''
  if (/^(https?:)?\/\//i.test(rawUrl) || rawUrl.startsWith('data:') || rawUrl.startsWith('blob:')) return rawUrl
  if (!rawUrl.startsWith('/')) return rawUrl
  const assetBase = getAssetBaseUrl()
  return assetBase ? `${assetBase}${rawUrl}` : rawUrl
}

function normalizeSponsor(sponsor) {
  return {
    ...sponsor,
    display_order: Number(sponsor.display_order ?? 0),
    is_active: !!(sponsor.is_active ?? sponsor.status === 'active'),
    logo_url: resolveLogoUrl(sponsor.logo_url || sponsor.logo_path || ''),
  }
}

function toFormValues(sponsor) {
  return {
    name: sponsor?.name || '',
    website_url: sponsor?.website_url || '',
    alt_text: sponsor?.alt_text || '',
    tagline: sponsor?.tagline || '',
    display_order: String(sponsor?.display_order ?? 0),
    is_active: !!(sponsor?.is_active ?? sponsor?.status === 'active'),
  }
}

function formatDate(value) {
  if (!value) return 'n/a'
  return new Date(value).toLocaleString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function LogoBox({ sponsor }) {
  const src = resolveLogoUrl(sponsor.logo_url || sponsor.logo_path || '')
  const [broken, setBroken] = useState(false)

  useEffect(() => {
    setBroken(false)
  }, [src])

  return (
    <div className="flex items-center justify-center rounded-xl border px-3 py-2" style={{ borderColor: 'var(--border)', background: 'var(--card-bg)' }}>
      {src && !broken ? (
        <img
          src={src}
          alt={sponsor.alt_text || sponsor.name}
          onError={() => setBroken(true)}
          className="block"
          style={{ maxHeight: 34, maxWidth: 120, objectFit: 'contain' }}
        />
      ) : (
        <div className="flex items-center gap-2 text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>
          <ImageIcon className="w-4 h-4" /> No logo
        </div>
      )}
    </div>
  )
}

export default function SponsorsPanel() {
  const [sponsors, setSponsors] = useState([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState(null)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [logoFile, setLogoFile] = useState(null)
  const [logoPreview, setLogoPreview] = useState('')

  const orderedSponsors = useMemo(
    () => [...sponsors].sort((a, b) => (a.display_order - b.display_order) || a.name.localeCompare(b.name)),
    [sponsors]
  )
  const activeSponsors = orderedSponsors.filter(sponsor => sponsor.is_active)

  const loadSponsors = async () => {
    setLoading(true)
    try {
      const res = await api.get('/sponsors')
      setSponsors((Array.isArray(res.data) ? res.data : []).map(normalizeSponsor))
    } catch (error) {
      console.error('[sponsors]', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadSponsors()
  }, [])

  useEffect(() => {
    if (!logoFile) return undefined
    const previewUrl = URL.createObjectURL(logoFile)
    setLogoPreview(previewUrl)
    return () => URL.revokeObjectURL(previewUrl)
  }, [logoFile])

  const resetForm = () => {
    setEditingId(null)
    setForm(EMPTY_FORM)
    setLogoFile(null)
    setLogoPreview('')
  }

  const beginEdit = (sponsor) => {
    setEditingId(sponsor.id)
    setForm(toFormValues(sponsor))
    setLogoFile(null)
    setLogoPreview(resolveLogoUrl(sponsor.logo_url || sponsor.logo_path || ''))
  }

  const submitSponsor = async (event) => {
    event.preventDefault()
    setSaving(true)
    try {
      const payload = new FormData()
      payload.append('name', form.name)
      payload.append('website_url', form.website_url)
      payload.append('alt_text', form.alt_text)
      payload.append('tagline', form.tagline)
      payload.append('display_order', form.display_order)
      payload.append('is_active', form.is_active ? '1' : '0')
      if (logoFile) payload.append('logo', logoFile)

      if (editingId) {
        await api.put(`/sponsors/${editingId}`, payload)
      } else {
        await api.post('/sponsors', payload)
      }

      await loadSponsors()
      resetForm()
    } catch (error) {
      alert(error.response?.data?.error || 'Failed to save sponsor')
    } finally {
      setSaving(false)
    }
  }

  const toggleActive = async (sponsor) => {
    setSaving(true)
    try {
      await api.put(`/sponsors/${sponsor.id}`, {
        name: sponsor.name,
        website_url: sponsor.website_url || '',
        alt_text: sponsor.alt_text || '',
        tagline: sponsor.tagline || '',
        display_order: sponsor.display_order,
        is_active: !sponsor.is_active,
      })
      await loadSponsors()
    } catch (error) {
      alert(error.response?.data?.error || 'Failed to update sponsor')
    } finally {
      setSaving(false)
    }
  }

  const deleteSponsor = async (sponsor) => {
    if (!window.confirm(`Delete sponsor \"${sponsor.name}\"?`)) return
    setDeletingId(sponsor.id)
    try {
      await api.delete(`/sponsors/${sponsor.id}`)
      await loadSponsors()
      if (editingId === sponsor.id) resetForm()
    } catch (error) {
      alert(error.response?.data?.error || 'Failed to delete sponsor')
    } finally {
      setDeletingId(null)
    }
  }

  const moveSponsor = async (sponsor, direction) => {
    const index = orderedSponsors.findIndex(item => item.id === sponsor.id)
    const neighbor = orderedSponsors[index + direction]
    if (!neighbor) return

    try {
      await Promise.all([
        api.put(`/sponsors/${sponsor.id}`, {
          name: sponsor.name,
          website_url: sponsor.website_url || '',
          alt_text: sponsor.alt_text || '',
          tagline: sponsor.tagline || '',
          display_order: neighbor.display_order,
          is_active: sponsor.is_active,
        }),
        api.put(`/sponsors/${neighbor.id}`, {
          name: neighbor.name,
          website_url: neighbor.website_url || '',
          alt_text: neighbor.alt_text || '',
          tagline: neighbor.tagline || '',
          display_order: sponsor.display_order,
          is_active: neighbor.is_active,
        }),
      ])
      await loadSponsors()
    } catch (error) {
      alert(error.response?.data?.error || 'Failed to reorder sponsors')
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text)' }}>Sponsor management</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            Manage partner logos, order, visibility, and public footer display.
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <button onClick={loadSponsors} disabled={loading || saving}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--card-bg)', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 13 }}>
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
          <button onClick={resetForm}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 10, border: 'none', background: 'rgba(99,102,241,0.12)', color: '#6366f1', cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>
            <Plus className="w-4 h-4" /> New sponsor
          </button>
        </div>
      </div>

      <div className="grid lg:grid-cols-[1.1fr_0.9fr] gap-4">
        <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 16, padding: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 14 }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)' }}>{editingId ? 'Edit sponsor' : 'Add sponsor'}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Use clear logos with transparent backgrounds where possible.</div>
            </div>
            {editingId && (
              <button type="button" onClick={resetForm}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 9, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 12 }}>
                <X className="w-4 h-4" /> Cancel edit
              </button>
            )}
          </div>

          <form onSubmit={submitSponsor} className="grid gap-3">
            <div className="grid sm:grid-cols-2 gap-3">
              <label style={{ display: 'grid', gap: 5 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)' }}>Sponsor name</span>
                <input value={form.name} onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))} required
                  className="rounded-xl px-3 py-2"
                  style={{ border: '1px solid var(--border)', background: 'var(--page-bg)', color: 'var(--text)' }}
                  placeholder="Example: Algoma University" />
              </label>
              <label style={{ display: 'grid', gap: 5 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)' }}>Website URL</span>
                <input value={form.website_url} onChange={e => setForm(prev => ({ ...prev, website_url: e.target.value }))}
                  className="rounded-xl px-3 py-2"
                  style={{ border: '1px solid var(--border)', background: 'var(--page-bg)', color: 'var(--text)' }}
                  placeholder="https://example.org" />
              </label>
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              <label style={{ display: 'grid', gap: 5 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)' }}>Alt text</span>
                <input value={form.alt_text} onChange={e => setForm(prev => ({ ...prev, alt_text: e.target.value }))}
                  className="rounded-xl px-3 py-2"
                  style={{ border: '1px solid var(--border)', background: 'var(--page-bg)', color: 'var(--text)' }}
                  placeholder="Accessible logo description" />
              </label>
              <label style={{ display: 'grid', gap: 5 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)' }}>Display order</span>
                <input type="number" value={form.display_order} onChange={e => setForm(prev => ({ ...prev, display_order: e.target.value }))}
                  className="rounded-xl px-3 py-2"
                  style={{ border: '1px solid var(--border)', background: 'var(--page-bg)', color: 'var(--text)' }}
                  min="0" step="1" />
              </label>
            </div>

            <label style={{ display: 'grid', gap: 5 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)' }}>Short label or tagline</span>
              <input value={form.tagline} onChange={e => setForm(prev => ({ ...prev, tagline: e.target.value }))}
                className="rounded-xl px-3 py-2"
                style={{ border: '1px solid var(--border)', background: 'var(--page-bg)', color: 'var(--text)' }}
                placeholder="Optional supporting caption" />
            </label>

            <div className="grid sm:grid-cols-[1fr_auto] gap-3 items-end">
              <label style={{ display: 'grid', gap: 5 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)' }}>Sponsor logo</span>
                <div className="flex items-center gap-3 rounded-xl px-3 py-2" style={{ border: '1px dashed var(--border)', background: 'var(--page-bg)' }}>
                  <Upload className="w-4 h-4" style={{ color: 'var(--text-light)' }} />
                  <input type="file" accept="image/*" onChange={e => setLogoFile(e.target.files?.[0] || null)} style={{ color: 'var(--text-muted)', fontSize: 13 }} />
                </div>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, paddingBottom: 2 }}>
                <input type="checkbox" checked={form.is_active} onChange={e => setForm(prev => ({ ...prev, is_active: e.target.checked }))} />
                <span style={{ fontSize: 13, color: 'var(--text)' }}>Active</span>
              </label>
            </div>

            {(logoPreview || form.name) && (
              <div className="rounded-2xl border p-4" style={{ borderColor: 'var(--border)', background: 'rgba(255,255,255,0.45)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 10 }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text)' }}>Public footer preview</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>This is how the sponsor strip will read on the site.</div>
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 800, color: form.is_active ? '#10b981' : '#f59e0b' }}>
                    {form.is_active ? 'Visible' : 'Hidden'}
                  </span>
                </div>
                <div className="flex flex-wrap items-center justify-center gap-3">
                  <div className="flex items-center justify-center rounded-xl border px-4 py-3" style={{ minWidth: 140, minHeight: 64, borderColor: 'rgba(148,163,184,0.18)', background: 'white' }}>
                    {(logoPreview || form.name) ? (
                      logoPreview ? (
                        <img src={logoPreview} alt={form.alt_text || form.name || 'Sponsor preview'} style={{ maxHeight: 38, maxWidth: 150, objectFit: 'contain' }} />
                      ) : (
                        <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-muted)' }}>{form.name || 'Sponsor'}</span>
                      )
                    ) : null}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{form.tagline || 'Supported by'}</div>
                </div>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-1">
              {editingId && (
                <button type="button" onClick={resetForm}
                  style={{ padding: '8px 14px', borderRadius: 10, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 13 }}>
                  Reset
                </button>
              )}
              <button type="submit" disabled={saving}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '9px 16px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,#6366f1,#4f46e5)', color: 'white', cursor: 'pointer', fontSize: 13, fontWeight: 800, opacity: saving ? 0.7 : 1 }}>
                <Save className="w-4 h-4" /> {editingId ? 'Save sponsor' : 'Add sponsor'}
              </button>
            </div>
          </form>
        </div>

        <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 16, padding: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 14 }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)' }}>Strip preview</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{activeSponsors.length} active sponsor{activeSponsors.length === 1 ? '' : 's'} will show publicly</div>
            </div>
          </div>

          <div className="rounded-2xl border p-4" style={{ borderColor: 'var(--border)', background: 'linear-gradient(180deg, rgba(255,255,255,0.55), rgba(255,255,255,0.32))' }}>
            <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--text-light)', marginBottom: 8 }}>Supported by</div>
            <div className="flex flex-wrap items-center justify-center gap-3">
              {activeSponsors.length ? activeSponsors.map(sponsor => (
                <LogoBox key={sponsor.id} sponsor={sponsor} />
              )) : (
                <div style={{ padding: '22px 12px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                  No active sponsors yet. Add one to populate the public footer.
                </div>
              )}
            </div>
          </div>

          <div className="mt-4 flex items-center gap-2 flex-wrap text-xs" style={{ color: 'var(--text-muted)' }}>
            <span className="font-semibold" style={{ color: 'var(--text)' }}>{orderedSponsors.length}</span> total records
            <span className="font-semibold" style={{ color: 'var(--text)' }}>{activeSponsors.length}</span> active
            <span>Visible only to admins in this panel.</span>
          </div>
        </div>
      </div>

      <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden' }}>
        <div className="px-4 py-3 border-b flex items-center justify-between gap-3" style={{ borderColor: 'var(--border)' }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)' }}>Sponsors</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Edit, reorder, enable or disable, and remove sponsor records.</div>
          </div>
          {loading && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Loading...</div>}
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ textAlign: 'left', color: 'var(--text-muted)', background: 'rgba(148,163,184,0.06)' }}>
                <th style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>Logo</th>
                <th style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>Sponsor</th>
                <th style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>Status</th>
                <th style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>Order</th>
                <th style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>Website</th>
                <th style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>Updated</th>
                <th style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {orderedSponsors.length ? orderedSponsors.map((sponsor) => {
                const canMoveUp = orderedSponsors.findIndex(item => item.id === sponsor.id) > 0
                const canMoveDown = orderedSponsors.findIndex(item => item.id === sponsor.id) < orderedSponsors.length - 1
                return (
                  <tr key={sponsor.id} style={{ borderTop: '1px solid var(--border)' }}>
                    <td style={{ padding: '12px 16px', verticalAlign: 'middle' }}>
                      <LogoBox sponsor={sponsor} />
                    </td>
                    <td style={{ padding: '12px 16px', verticalAlign: 'middle' }}>
                      <div style={{ fontWeight: 800, color: 'var(--text)' }}>{sponsor.name}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                        {sponsor.alt_text || 'No alt text'}
                      </div>
                      {sponsor.tagline && (
                        <div style={{ fontSize: 11, color: 'var(--text-light)', marginTop: 3 }}>{sponsor.tagline}</div>
                      )}
                    </td>
                    <td style={{ padding: '12px 16px', verticalAlign: 'middle' }}>
                      <button type="button" onClick={() => toggleActive(sponsor)} disabled={saving}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 10px', borderRadius: 999, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 800, background: sponsor.is_active ? 'rgba(16,185,129,0.12)' : 'rgba(245,158,11,0.12)', color: sponsor.is_active ? '#10b981' : '#f59e0b' }}>
                        {sponsor.is_active ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                        {sponsor.is_active ? 'Active' : 'Hidden'}
                      </button>
                    </td>
                    <td style={{ padding: '12px 16px', verticalAlign: 'middle' }}>
                      <div className="flex items-center gap-2">
                        <span style={{ minWidth: 32, display: 'inline-flex', justifyContent: 'center', fontWeight: 800, color: 'var(--text)' }}>{sponsor.display_order}</span>
                        <div className="flex flex-col gap-1">
                          <button type="button" onClick={() => moveSponsor(sponsor, -1)} disabled={!canMoveUp || saving}
                            style={{ padding: 4, borderRadius: 6, border: '1px solid var(--border)', background: 'var(--page-bg)', color: 'var(--text-muted)', cursor: canMoveUp ? 'pointer' : 'not-allowed', opacity: canMoveUp ? 1 : 0.4 }}>
                            <ArrowUp className="w-3.5 h-3.5" />
                          </button>
                          <button type="button" onClick={() => moveSponsor(sponsor, 1)} disabled={!canMoveDown || saving}
                            style={{ padding: 4, borderRadius: 6, border: '1px solid var(--border)', background: 'var(--page-bg)', color: 'var(--text-muted)', cursor: canMoveDown ? 'pointer' : 'not-allowed', opacity: canMoveDown ? 1 : 0.4 }}>
                            <ArrowDown className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '12px 16px', verticalAlign: 'middle', maxWidth: 240 }}>
                      {sponsor.website_url ? (
                        <a href={sponsor.website_url} target="_blank" rel="noreferrer noopener"
                          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: '#6366f1', textDecoration: 'none', wordBreak: 'break-word' }}>
                          <ExternalLink className="w-3.5 h-3.5" /> {sponsor.website_url}
                        </a>
                      ) : (
                        <span style={{ color: 'var(--text-light)' }}>No website</span>
                      )}
                    </td>
                    <td style={{ padding: '12px 16px', verticalAlign: 'middle', whiteSpace: 'nowrap', color: 'var(--text-muted)' }}>
                      {formatDate(sponsor.updated_at || sponsor.created_at)}
                    </td>
                    <td style={{ padding: '12px 16px', verticalAlign: 'middle' }}>
                      <div className="flex items-center gap-1">
                        <button type="button" onClick={() => beginEdit(sponsor)} disabled={saving}
                          style={{ padding: 6, borderRadius: 8, border: 'none', background: 'rgba(99,102,241,0.1)', color: '#6366f1', cursor: 'pointer' }}>
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button type="button" onClick={() => deleteSponsor(sponsor)} disabled={deletingId === sponsor.id}
                          style={{ padding: 6, borderRadius: 8, border: 'none', background: 'rgba(239,68,68,0.1)', color: '#ef4444', cursor: 'pointer' }}>
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              }) : (
                <tr>
                  <td colSpan={7} style={{ padding: '28px 16px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    No sponsors yet. Create the first partner entry above.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}