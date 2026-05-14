/**
 * QuickActions — Watercolor river journey.
 *
 * The page is a single watercolor river illustration overlaid with five
 * numbered "stops" along the river path. Each stop has a short caption with
 * bold inline links to the destination page. The layout follows Elaine's
 * sketch: 1 at the river headwaters, 2 mid-right (near the boat), 3 left
 * middle, 4 lower left, 5 lower right.
 *
 * Background image: client/public/textures/quick-actions-river.png
 */
import { Link } from 'react-router-dom'
import { useEffect, useState } from 'react'
import NibiMascotImage from '../components/NibiMascotImage'

// Numbered stops along the river. Positions are percent of the stage so the
// layout scales with the responsive container. Each stop's `body` is a JSX
// fragment so we can drop <Link> elements inline.
const STOPS = [
  {
    n: 1,
    x: 10, y: 22,
    align: 'left',
    body: (
      <>
        Community members have collected a lot of data! First, visit{' '}
        <Link to="/dashboard" className="qa-link">Dashboard</Link> for a site
        overview. Or, learn more{' '}
        <Link to="/about/this-platform" className="qa-link">About This Project</Link>.
      </>
    ),
  },
  {
    n: 2,
    x: 72, y: 18,
    align: 'right',
    body: (
      <>
        I'll guide you to the data most relevant to your needs. Ask me
        questions, or type "Help me". See details under your conversation
        where you'll find a citizen scientist's notes — go to{' '}
        <Link to="/ask-water" className="qa-link">Ask Water</Link> to start.
      </>
    ),
  },
  {
    n: 3,
    x: 12, y: 50,
    align: 'left',
    body: (
      <>
        Track the data on your location(s) or topic(s) of interest to view
        trends. Let's visit the{' '}
        <Link to="/monitoring" className="qa-link">Site Map</Link>! Return to{' '}
        <Link to="/ask-water" className="qa-link">Ask Water</Link> if you need
        further assistance.
      </>
    ),
  },
  {
    n: 4,
    x: 10, y: 78,
    align: 'left',
    body: (
      <>
        Discuss your observations and concerns with the{' '}
        <Link to="/social" className="qa-link">Community</Link>!
      </>
    ),
  },
  {
    n: 5,
    x: 70, y: 78,
    align: 'right',
    body: (
      <>
        Learn more using other{' '}
        <Link to="/resources" className="qa-link">Resources</Link>, practice{' '}
        <Link to="/quiz" className="qa-link">Quizzes</Link>, or play{' '}
        <Link to="/games" className="qa-link">educational Games</Link>.
      </>
    ),
  },
]

function Stop({ stop, ready, index }) {
  const calloutLeft  = stop.align === 'left'
  return (
    <div
      className={`qa-stop ${calloutLeft ? 'qa-stop-l' : 'qa-stop-r'} ${ready ? 'is-ready' : ''}`}
      style={{
        left: `${stop.x}%`,
        top: `${stop.y}%`,
        animationDelay: `${260 + index * 110}ms`,
      }}
    >
      <span className="qa-num" aria-hidden="true">{stop.n}</span>
      <div className="qa-callout">
        <p className="qa-body">{stop.body}</p>
      </div>
    </div>
  )
}

export default function QuickActions() {
  const [ready, setReady] = useState(false)
  const [imgFailed, setImgFailed] = useState(false)

  useEffect(() => {
    const id = requestAnimationFrame(() => setReady(true))
    return () => cancelAnimationFrame(id)
  }, [])

  return (
    <div className={`qa-root ${ready ? 'is-ready' : ''}`}>
      <div className="qa-header">
        <NibiMascotImage mood="wave" size={56} />
        <div>
          <h1 className="qa-title">Quick Actions</h1>
          <p className="qa-sub">Follow the river — five stops to get you going.</p>
        </div>
      </div>

      <div className="qa-stage">
        <img
          src="/textures/quick-actions-river.png"
          alt=""
          aria-hidden="true"
          onError={() => setImgFailed(true)}
          className="qa-stage-img"
        />
        {imgFailed && (
          <div className="qa-stage-fallback" aria-hidden="true" />
        )}

        {STOPS.map((s, i) => (
          <Stop key={s.n} stop={s} ready={ready} index={i} />
        ))}
      </div>

      <style>{`
        .qa-root {
          min-height: 100vh;
          padding: 18px 14px 28px;
          background: var(--page-bg, #f5f1e8);
          opacity: 0;
          transform: translateY(8px);
          transition: opacity 600ms ease, transform 800ms ease;
        }
        .qa-root.is-ready { opacity: 1; transform: translateY(0); }
        @media (min-width: 768px) { .qa-root { padding: 28px 36px 40px; } }

        .qa-header {
          display: flex; align-items: center; gap: 14px;
          max-width: 1280px; margin: 0 auto 16px;
        }
        .qa-title {
          margin: 0;
          font-family: Georgia, 'Times New Roman', serif;
          font-size: clamp(20px, 2.6vw, 28px);
          font-weight: 800;
          letter-spacing: -0.01em;
          color: var(--text, #1f2b3d);
        }
        .qa-sub {
          margin: 2px 0 0;
          font-size: 12px;
          color: var(--text-muted, #6b7280);
          font-style: italic;
        }

        .qa-stage {
          position: relative;
          margin: 0 auto;
          width: 100%;
          max-width: 1280px;
          aspect-ratio: 16 / 9;
          border-radius: 14px;
          overflow: hidden;
          background: #e6e7e2;
          box-shadow: 0 18px 50px rgba(15,31,56,0.18), 0 2px 6px rgba(15,31,56,0.10);
        }
        .qa-stage-img {
          position: absolute; inset: 0;
          width: 100%; height: 100%;
          object-fit: cover;
          user-select: none;
          pointer-events: none;
        }
        .qa-stage-fallback {
          position: absolute; inset: 0;
          background: linear-gradient(180deg, #cbd5e1 0%, #a0b4c8 35%, #6f8aa6 70%, #a8b894 100%);
        }

        /* ── Numbered stop ── */
        .qa-stop {
          position: absolute;
          transform: translate(-50%, -50%);
          display: flex;
          align-items: flex-start;
          gap: 12px;
          max-width: min(360px, 38vw);
          opacity: 0;
          pointer-events: auto;
        }
        .qa-stop.is-ready {
          animation: qaFadeIn 540ms cubic-bezier(0.2, 0.8, 0.2, 1) both;
        }
        .qa-stop-l { flex-direction: row; }
        .qa-stop-r { flex-direction: row-reverse; text-align: right; }
        .qa-stop-r .qa-callout { text-align: right; }

        .qa-num {
          flex: 0 0 auto;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 42px; height: 42px;
          border-radius: 50%;
          background: linear-gradient(135deg, #ef4444 0%, #b91c1c 100%);
          color: #fff;
          font-family: Georgia, 'Times New Roman', serif;
          font-size: 22px;
          font-weight: 800;
          line-height: 1;
          box-shadow:
            0 4px 12px rgba(185,28,28,0.42),
            inset 0 -2px 4px rgba(0,0,0,0.20),
            inset 0 2px 4px rgba(255,255,255,0.25),
            0 0 0 3px rgba(255,255,255,0.85);
        }
        @media (max-width: 640px) {
          .qa-num { width: 34px; height: 34px; font-size: 18px; }
        }

        .qa-callout {
          background: rgba(255,255,255,0.92);
          backdrop-filter: blur(4px);
          border: 1px solid rgba(15,31,56,0.10);
          border-radius: 10px;
          padding: 9px 12px;
          box-shadow:
            0 3px 8px rgba(15,31,56,0.10),
            0 12px 24px rgba(15,31,56,0.08);
        }
        .qa-body {
          margin: 0;
          font-family: Georgia, 'Times New Roman', serif;
          font-size: clamp(11px, 1.05vw, 13px);
          line-height: 1.5;
          color: #1f2b3d;
        }

        .qa-link {
          color: #1d4ed8;
          font-weight: 700;
          text-decoration: underline;
          text-decoration-color: rgba(29,78,216,0.45);
          text-underline-offset: 2px;
          transition: color 0.15s, text-decoration-color 0.15s;
        }
        .qa-link:hover {
          color: #1e3a8a;
          text-decoration-color: rgba(30,58,138,0.85);
        }

        @keyframes qaFadeIn {
          0%   { opacity: 0; transform: translate(-50%, -42%); }
          100% { opacity: 1; transform: translate(-50%, -50%); }
        }

        /* On narrow screens the river illustration crops awkwardly. Stack
           the stops vertically below the image so nothing gets squished. */
        @media (max-width: 600px) {
          .qa-stage { aspect-ratio: 4 / 3; }
          .qa-stop {
            position: static;
            transform: none;
            max-width: none;
            margin: 10px 12px;
          }
          .qa-stop-r { flex-direction: row; text-align: left; }
          .qa-stop-r .qa-callout { text-align: left; }
        }

        @media (prefers-reduced-motion: reduce) {
          .qa-root, .qa-stop { animation: none !important; transition: none !important; }
          .qa-stop { opacity: 1; }
        }
      `}</style>
    </div>
  )
}
