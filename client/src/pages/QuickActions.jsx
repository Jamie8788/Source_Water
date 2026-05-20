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

// Numbered stops along the river. `side` controls which edge the stop is
// anchored to (left side of stage or right side), and `top` is a percent.
// Numbers sit between the callout and the river so they're always visible
// inside the stage (the previous centered layout pushed left-side numbers
// off the left edge — Elaine: "wtf I can only see 2 and 5"). Each stop's
// `body` is a JSX fragment so we can drop <Link> elements inline.
const STOPS = [
  {
    n: 1, side: 'left',  top: 18,
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
    n: 2, side: 'right', top: 14,
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
    n: 3, side: 'left',  top: 48,
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
    n: 4, side: 'left',  top: 76,
    body: (
      <>
        Discuss your observations and concerns with the{' '}
        <Link to="/social" className="qa-link">Community</Link>!
      </>
    ),
  },
  {
    n: 5, side: 'right', top: 74,
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
  const isLeft = stop.side === 'left'
  return (
    <div
      className={`qa-stop ${isLeft ? 'qa-stop-l' : 'qa-stop-r'} ${ready ? 'is-ready' : ''}`}
      style={{
        top: `${stop.top}%`,
        animationDelay: `${260 + index * 110}ms`,
      }}
    >
      <span className="qa-num" aria-hidden="true" style={{ animationDelay: `${index * 0.4}s` }}>
        {stop.n}
      </span>
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
          padding: 14px 14px 22px;
          background: var(--page-bg, #f5f1e8);
          opacity: 0;
          transform: translateY(8px);
          transition: opacity 600ms ease, transform 800ms ease;
        }
        .qa-root.is-ready { opacity: 1; transform: translateY(0); }
        @media (min-width: 768px) { .qa-root { padding: 18px 28px 28px; } }

        .qa-header {
          display: flex; align-items: center; gap: 12px;
          max-width: 1200px; margin: 0 auto 12px;
        }
        .qa-title {
          margin: 0;
          font-family: Georgia, 'Times New Roman', serif;
          font-size: clamp(18px, 2.2vw, 24px);
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
          max-width: 1200px;
          aspect-ratio: 16 / 9;
          max-height: calc(100vh - 140px);
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
          animation: qaImgPan 60s ease-in-out infinite alternate;
        }
        .qa-stage-fallback {
          position: absolute; inset: 0;
          background: linear-gradient(180deg, #cbd5e1 0%, #a0b4c8 35%, #6f8aa6 70%, #a8b894 100%);
        }
        /* Subtle water-shimmer overlay — single linear-gradient sweeping
           diagonally. Very low CPU cost, just a single transform animation. */
        .qa-stage::before {
          content: '';
          position: absolute; inset: 0;
          background: linear-gradient(115deg,
            rgba(180,210,225,0) 0%,
            rgba(180,210,225,0.10) 45%,
            rgba(180,210,225,0) 70%);
          mix-blend-mode: screen;
          pointer-events: none;
          animation: qaShimmer 12s linear infinite;
          background-size: 220% 100%;
        }
        /* Soft vignette so the centre of the river stays bright and the
           edges sink into the page background. */
        .qa-stage::after {
          content: '';
          position: absolute; inset: 0;
          background: radial-gradient(ellipse at 50% 48%, rgba(0,0,0,0) 55%, rgba(20,30,50,0.18) 100%);
          pointer-events: none;
        }

        /* ── Numbered stop ── */
        .qa-stop {
          position: absolute;
          display: flex;
          align-items: flex-start;
          gap: 10px;
          max-width: min(300px, 34vw);
          opacity: 0;
          transform: translateY(-50%);
          pointer-events: auto;
        }
        .qa-stop-l.is-ready { animation: qaSlideInL 620ms cubic-bezier(0.2, 0.8, 0.2, 1) both; }
        .qa-stop-r.is-ready { animation: qaSlideInR 620ms cubic-bezier(0.2, 0.8, 0.2, 1) both; }
        .qa-stop-l { left: 16px; flex-direction: row; }
        .qa-stop-r { right: 16px; flex-direction: row-reverse; text-align: right; }
        .qa-stop-r .qa-callout { text-align: right; }
        @media (min-width: 1024px) {
          .qa-stop-l { left: 24px; }
          .qa-stop-r { right: 24px; }
        }

        .qa-num {
          flex: 0 0 auto;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 42px; height: 42px;
          border-radius: 50%;
          background: radial-gradient(circle at 32% 28%, #f87171 0%, #dc2626 40%, #991b1b 100%);
          color: #fff;
          font-family: Georgia, 'Times New Roman', serif;
          font-size: 22px;
          font-weight: 800;
          line-height: 1;
          box-shadow:
            0 6px 14px rgba(153,27,27,0.45),
            inset 0 -2px 4px rgba(0,0,0,0.25),
            inset 0 2px 4px rgba(255,255,255,0.30),
            0 0 0 3px rgba(255,255,255,0.92);
          animation: qaNumPulse 4.5s ease-in-out infinite, qaNumBob 5.8s ease-in-out infinite;
        }
        .qa-stop:hover .qa-num {
          transform: scale(1.08);
          transition: transform 220ms cubic-bezier(0.2, 0.8, 0.2, 1);
        }
        @media (max-width: 640px) {
          .qa-num { width: 34px; height: 34px; font-size: 18px; }
        }

        .qa-callout {
          background: rgba(255,253,247,0.94);
          backdrop-filter: blur(6px);
          border: 1px solid rgba(15,31,56,0.10);
          border-radius: 10px;
          padding: 8px 11px;
          box-shadow:
            0 2px 6px rgba(15,31,56,0.10),
            0 10px 22px rgba(15,31,56,0.10);
          transition: transform 240ms cubic-bezier(0.2, 0.8, 0.2, 1), box-shadow 240ms ease;
        }
        .qa-stop-l:hover .qa-callout {
          transform: translateY(-2px) rotate(-0.3deg);
          box-shadow: 0 3px 8px rgba(15,31,56,0.14), 0 14px 28px rgba(15,31,56,0.14);
        }
        .qa-stop-r:hover .qa-callout {
          transform: translateY(-2px) rotate(0.3deg);
          box-shadow: 0 3px 8px rgba(15,31,56,0.14), 0 14px 28px rgba(15,31,56,0.14);
        }
        .qa-body {
          margin: 0;
          font-family: Georgia, 'Times New Roman', serif;
          font-size: clamp(10.5px, 0.95vw, 12.5px);
          line-height: 1.45;
          color: #1f2b3d;
        }

        .qa-link {
          color: #1d4ed8;
          font-weight: 700;
          text-decoration: underline;
          text-decoration-color: rgba(29,78,216,0.45);
          text-underline-offset: 2px;
          transition: color 0.15s, text-decoration-color 0.15s, background 0.15s;
          padding: 0 2px;
          border-radius: 3px;
        }
        .qa-link:hover {
          color: #1e3a8a;
          text-decoration-color: rgba(30,58,138,0.85);
          background: rgba(29,78,216,0.06);
        }

        @keyframes qaSlideInL {
          0%   { opacity: 0; transform: translate(-22px, -50%); }
          100% { opacity: 1; transform: translate(0, -50%); }
        }
        @keyframes qaSlideInR {
          0%   { opacity: 0; transform: translate(22px, -50%); }
          100% { opacity: 1; transform: translate(0, -50%); }
        }
        @keyframes qaNumBob {
          0%, 100% { transform: translateY(0); }
          50%      { transform: translateY(-2px); }
        }
        @keyframes qaNumPulse {
          0%, 100% { box-shadow: 0 6px 14px rgba(153,27,27,0.45), inset 0 -2px 4px rgba(0,0,0,0.25), inset 0 2px 4px rgba(255,255,255,0.30), 0 0 0 3px rgba(255,255,255,0.92); }
          50%      { box-shadow: 0 6px 16px rgba(153,27,27,0.55), inset 0 -2px 4px rgba(0,0,0,0.25), inset 0 2px 4px rgba(255,255,255,0.30), 0 0 0 3px rgba(255,255,255,0.92), 0 0 18px rgba(220,38,38,0.30); }
        }
        @keyframes qaShimmer {
          0%   { background-position: -120% 0; }
          100% { background-position: 220% 0; }
        }
        @keyframes qaImgPan {
          0%   { transform: scale(1.00) translate(0, 0); }
          100% { transform: scale(1.04) translate(-0.6%, -0.4%); }
        }

        /* Mobile: stack stops below the image. */
        @media (max-width: 720px) {
          .qa-stage { aspect-ratio: 4 / 3; max-height: 60vh; }
          .qa-stop {
            position: static;
            transform: none;
            max-width: none;
            margin: 8px 12px;
            opacity: 1;
          }
          /* The slide-in keyframes set transform: translate(0,-50%) at 100%,
             which would fight the static mobile layout — disable on mobile. */
          .qa-stop-l.is-ready, .qa-stop-r.is-ready { animation: none; }
          .qa-stop-l, .qa-stop-r { left: auto; right: auto; flex-direction: row; text-align: left; }
          .qa-stop-r .qa-callout { text-align: left; }
          .qa-stop-l:hover .qa-callout, .qa-stop-r:hover .qa-callout { transform: translateY(-2px); }
        }

        @media (prefers-reduced-motion: reduce) {
          .qa-root, .qa-stop, .qa-stage::before, .qa-stage-img, .qa-num {
            animation: none !important;
            transition: none !important;
          }
          .qa-stop { opacity: 1; }
        }
      `}</style>
    </div>
  )
}
