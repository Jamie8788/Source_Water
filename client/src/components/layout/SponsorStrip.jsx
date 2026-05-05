import { useEffect, useState } from 'react'
import api from '../../utils/api'

function getAssetBaseUrl() {
  const apiBase = import.meta.env.VITE_API_URL || ''
  if (!apiBase) return ''
  return apiBase.replace(/\/api\/?$/, '')
}

function resolveLogoUrl(rawUrl) {
  if (!rawUrl) return ''
  if (/^(https?:)?\/\//i.test(rawUrl) || rawUrl.startsWith('data:') || rawUrl.startsWith('blob:')) {
    return rawUrl
  }
  if (!rawUrl.startsWith('/')) return rawUrl
  const assetBase = getAssetBaseUrl()
  return assetBase ? `${assetBase}${rawUrl}` : rawUrl
}

function getLogoUrl(sponsor) {
  return resolveLogoUrl(sponsor?.logo_url || sponsor?.logo_path || '')
}

export default function SponsorStrip() {
  const [sponsors, setSponsors] = useState([])
  const [brokenIds, setBrokenIds] = useState({})

  useEffect(() => {
    let mounted = true
    api.get('/sponsors/active')
      .then(res => {
        if (!mounted) return
        setSponsors(Array.isArray(res.data) ? res.data : [])
      })
      .catch(() => {
        if (mounted) setSponsors([])
      })
    return () => { mounted = false }
  }, [])

  if (!sponsors.length) return null

  return (
    <section className="mt-8 px-0" aria-label="Sponsors">
      <div
        className="rounded-2xl border px-5 py-4 sm:px-6 sm:py-5"
        style={{
          borderColor: 'var(--border)',
          background: 'linear-gradient(180deg, rgba(255,255,255,0.55), rgba(255,255,255,0.34))',
          boxShadow: '0 10px 30px rgba(15,23,42,0.05)',
          backdropFilter: 'blur(10px)',
        }}
      >
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-4">
          <div>
            <div className="text-[10px] uppercase tracking-[0.22em] font-extrabold" style={{ color: 'var(--text-light)' }}>
              Supported by
            </div>
            <div className="text-sm sm:text-base font-extrabold" style={{ color: 'var(--text)' }}>
              Our Partners
            </div>
          </div>
          <div className="text-xs sm:text-sm" style={{ color: 'var(--text-muted)' }}>
            Trusted organizations helping sustain the platform
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4">
          {sponsors.map(sponsor => {
            const logoUrl = getLogoUrl(sponsor)
            const logoBroken = !!brokenIds[sponsor.id]
            const content = (
              <div
                className="flex items-center justify-center rounded-xl border px-4 py-3 transition-all duration-200"
                style={{
                  minWidth: 140,
                  minHeight: 64,
                  borderColor: 'rgba(148,163,184,0.18)',
                  background: 'rgba(255,255,255,0.48)',
                }}
              >
                {logoUrl && !logoBroken ? (
                  <img
                    src={logoUrl}
                    alt={sponsor.alt_text || sponsor.name}
                    title={sponsor.name}
                    onError={() => setBrokenIds(prev => ({ ...prev, [sponsor.id]: true }))}
                    className="block"
                    style={{
                      maxHeight: 42,
                      maxWidth: 160,
                      width: 'auto',
                      height: 'auto',
                      objectFit: 'contain',
                      transition: 'transform 0.2s ease',
                    }}
                  />
                ) : (
                  <span className="text-xs font-semibold text-center px-1" style={{ color: 'var(--text-muted)' }}>
                    {sponsor.name}
                  </span>
                )}
              </div>
            )

            return sponsor.website_url ? (
              <a
                key={sponsor.id}
                href={sponsor.website_url}
                target="_blank"
                rel="noreferrer noopener"
                title={sponsor.name}
                className="group"
                style={{ textDecoration: 'none' }}
              >
                <div className="group-hover:-translate-y-0.5 group-hover:shadow-md transition-transform duration-200">
                  {content}
                </div>
              </a>
            ) : (
              <div key={sponsor.id} title={sponsor.name} className="group">
                {content}
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}