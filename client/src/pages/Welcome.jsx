/**
 * Welcome — cinematic scroll-driven landing experience (v4, "the living lake").
 *
 * Every scene is now rendered by a tiny zero-dependency Canvas2D engine
 * (welcomeEngine.js) instead of static SVG:
 *
 *   1. Golden-hour Great Lakes shoreline — layered lake, transparent
 *      shallows, dock, monitoring buoy, research boat, a living community
 *      of NPCs, Great-Lakes wildlife, mouse parallax, cursor ripples and
 *      hover data previews.
 *   2. Beneath the surface — freshwater fish, plants, a sensor station
 *      publishing live readings.
 *   3. The data network — the lakes as a glowing constellation of
 *      monitoring sites exchanging readings.
 *   4. Turtle Island — the community artwork, fully animated.
 *   5. Twilight — aurora, moonpath and the final call to action.
 *
 * The engine respects prefers-reduced-motion and the global sw-no-anim
 * kill-switch by rendering a single frozen frame.
 *
 * Route: "/" for signed-out visitors. Sign-in lives at /login.
 */
import { useEffect, useRef, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronDown, Droplets, Map as MapIcon, Users, Sparkles, BookOpen, BarChart3, ArrowRight } from 'lucide-react'
import { mountScene } from './welcomeEngine'
import { shoreScene, fireLightTrail } from './welcomeShore'
import { underScene } from './welcomeScenes'
import { networkScene, turtleScene, nightScene } from './welcomeScenes2'

const SECTIONS = ['shore', 'under', 'network', 'turtle', 'night']

// Canvas scene host — mounts a welcomeEngine scene onto a canvas element.
function CanvasScene({ scene, seed = 1, className }) {
  const ref = useRef(null)
  useEffect(() => {
    if (!ref.current) return
    return mountScene(ref.current, scene, { seed })
  }, [scene, seed])
  return <canvas ref={ref} className={className} aria-hidden="true" />
}

// ─────────────────────────────────────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────────────────────────────────────
export default function Welcome() {
  const navigate = useNavigate()
  const containerRef = useRef(null)
  const [active, setActive] = useState(0)
  const [scrolled, setScrolled] = useState(false)

  const goSignIn = useCallback(() => navigate('/login'), [navigate])
  const journeyTimers = useRef([])

  // hero CTA: light trail races to the buoy, then we enter the platform
  const enterPlatform = useCallback(() => {
    fireLightTrail()
    setTimeout(() => navigate('/login'), 1150)
  }, [navigate])

  const scrollTo = useCallback((idx) => {
    const el = containerRef.current?.querySelectorAll('.wv-section')?.[idx]
    el?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  // Guided journey: a controlled cinematic ride through every scene.
  // Any manual wheel/touch/keys input hands control back to the user.
  const guidedJourney = useCallback(() => {
    journeyTimers.current.forEach(clearTimeout)
    journeyTimers.current = [1, 2, 3, 4].map((idx, i) =>
      setTimeout(() => scrollTo(idx), 400 + i * 3400))
  }, [scrollTo])

  useEffect(() => {
    const root = containerRef.current
    if (!root) return
    const sections = Array.from(root.querySelectorAll('.wv-section'))
    const obs = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          e.target.classList.add('wv-in')
          const idx = sections.indexOf(e.target)
          if (idx >= 0) setActive(idx)
        }
      })
    }, { root, threshold: 0.45 })
    sections.forEach(s => obs.observe(s))
    const onScroll = () => setScrolled(root.scrollTop > 40)
    root.addEventListener('scroll', onScroll, { passive: true })
    const cancelJourney = () => { journeyTimers.current.forEach(clearTimeout); journeyTimers.current = [] }
    root.addEventListener('wheel', cancelJourney, { passive: true })
    root.addEventListener('touchstart', cancelJourney, { passive: true })
    window.addEventListener('keydown', cancelJourney)
    return () => {
      obs.disconnect(); root.removeEventListener('scroll', onScroll)
      root.removeEventListener('wheel', cancelJourney)
      root.removeEventListener('touchstart', cancelJourney)
      window.removeEventListener('keydown', cancelJourney)
      cancelJourney()
    }
  }, [])

  return (
    <div className="wv-root" ref={containerRef}>
      <div className={`wv-topbar${scrolled ? ' wv-topbar-glass' : ''}`}>
        <div className="wv-brand">
          <Droplets size={20} />
          <span>SOURCE <em>Water</em></span>
        </div>
        <button className="wv-cta wv-cta-small" onClick={goSignIn}>Sign in</button>
      </div>

      <nav className="wv-dots" aria-label="Scene navigation">
        {SECTIONS.map((sc, i) => (
          <button key={sc} className={i === active ? 'on' : ''} onClick={() => scrollTo(i)} aria-label={`Go to scene ${i + 1}`} />
        ))}
      </nav>

      {/* ═══ 1 · GOLDEN-HOUR SHORELINE ═══ */}
      <section className="wv-section wv-shore" data-scene="shore">
        <CanvasScene scene={shoreScene} seed={7} className="wv-canvas" />
        <div className="wv-hero">
          <div className="wv-kicker2">NIBI · WATER IS LIFE</div>
          <h1 className="wv-title">
            <span className="wv-t-dark">Where water</span><br />
            <span className="wv-t-serif">meets community.</span>
          </h1>
          <p className="wv-sub">
            Live water-quality data from 9,400+ monitoring sites across the
            Great Lakes — explained simply, shared openly, protected together.
          </p>
          <div className="wv-cta-row">
            <button className="wv-cta wv-cta-primary" onClick={enterPlatform}>
              <Droplets size={17} /> Enter the platform
            </button>
            <button className="wv-cta wv-cta-ghost" onClick={guidedJourney}>
              <Sparkles size={15} /> Guided journey
            </button>
          </div>
        </div>
        <button className="wv-scroll-hint" onClick={() => scrollTo(1)} aria-label="Scroll to next section">
          <span>Scroll to discover</span>
          <ChevronDown size={20} />
        </button>
      </section>

      {/* ═══ 2 · BENEATH THE SURFACE ═══ */}
      <section className="wv-section wv-under" data-scene="under">
        <CanvasScene scene={underScene} seed={11} className="wv-canvas" />
        <div className="wv-scene-inner wv-under-inner">
          <div className="wv-info wv-info-center">
            <div className="wv-kicker">01 · Beneath the surface</div>
            <h2>Every number, explained like a neighbour would.</h2>
            <p>
              Behind the beauty is a serious toolkit — but everything comes
              with a plain-English explanation, so a first-time volunteer and
              a PhD researcher can read the same page.
            </p>
          </div>
          <div className="wv-card-grid">
            <div className="wv-card">
              <BarChart3 size={22} />
              <h3>Dashboard</h3>
              <p>Today's snapshot — active alerts, sampled stations, your community's activity, all live.</p>
            </div>
            <div className="wv-card">
              <Sparkles size={22} />
              <h3>Ask Water AI</h3>
              <p>Chat with Nibi about any parameter, any reading, any watershed — grounded in real data.</p>
            </div>
            <div className="wv-card">
              <BookOpen size={22} />
              <h3>Learn &amp; play</h3>
              <p>Quizzes, watershed games, curated resources, and a dataset analyzer you can question.</p>
            </div>
          </div>
        </div>
        <button className="wv-scroll-hint" onClick={() => scrollTo(2)} aria-label="Scroll to next section">
          <ChevronDown size={20} />
        </button>
      </section>

      {/* ═══ 3 · THE DATA NETWORK ═══ */}
      <section className="wv-section wv-network" data-scene="network">
        <CanvasScene scene={networkScene} seed={3} className="wv-canvas" />
        <div className="wv-net-info">
          <div className="wv-glass">
            <div className="wv-kicker">02 · The Site Map</div>
            <h2>Five lakes.<br />One in five drops of the world's fresh surface water.</h2>
            <p>
              Our Site Map plots <strong>9,400+ real monitoring stations</strong> from
              the Water Rangers citizen-science network — pH, oxygen, temperature,
              clarity — refreshed live. Compare any two sites, watch trends,
              or drop a community story right onto the water you love.
            </p>
            <div className="wv-stat-row">
              <div><strong>9,400+</strong><span>monitoring sites</span></div>
              <div><strong>5</strong><span>Great Lakes</span></div>
              <div><strong>Live</strong><span>community readings</span></div>
            </div>
          </div>
        </div>
        <button className="wv-scroll-hint" onClick={() => scrollTo(3)} aria-label="Scroll to next section">
          <ChevronDown size={20} />
        </button>
      </section>

      {/* ═══ 4 · TURTLE ISLAND · COMMUNITY ═══ */}
      <section className="wv-section wv-turtle" data-scene="turtle">
        <div className="wv-scene-inner wv-scene-reverse">
          <div className="wv-turtle-art">
            <CanvasScene scene={turtleScene} seed={5} className="wv-turtle-canvas" />
          </div>
          <div className="wv-info">
            <div className="wv-kicker">03 · Community</div>
            <h2>Water carries us all.</h2>
            <p>
              In Anishinaabe teaching, North America is <strong>Turtle Island</strong> —
              the land carried on a turtle's back, the water flowing from it to
              every community below. SOURCE Water is built in that spirit at
              Baawaating (Sault Ste. Marie): data belongs to the people who
              live beside the water.
            </p>
            <p>
              Share observations, drop <strong>stories on the map</strong>, message
              other water protectors, and climb the community leaderboard —
              science and stewardship, together.
            </p>
            <div className="wv-feature-chips">
              <span><Users size={13} /> Community feed</span>
              <span><MapIcon size={13} /> Stories on the map</span>
              <span><Sparkles size={13} /> Leaderboard &amp; XP</span>
            </div>
          </div>
        </div>
        <button className="wv-scroll-hint" onClick={() => scrollTo(4)} aria-label="Scroll to next section">
          <ChevronDown size={20} />
        </button>
      </section>

      {/* ═══ 5 · TWILIGHT · JOIN ═══ */}
      <section className="wv-section wv-night" data-scene="night">
        <CanvasScene scene={nightScene} seed={13} className="wv-canvas" />
        <div className="wv-night-content">
          <h2>The lake is waiting.</h2>
          <p>
            Join researchers, students, elders, and neighbours already
            protecting the water — one reading at a time.
          </p>
          <button className="wv-cta wv-cta-primary wv-cta-big" onClick={goSignIn}>
            Create your free account <ArrowRight size={18} />
          </button>
          <div className="wv-credits">
            SOURCE Water · NORDIK Institute · powered by Water Rangers open data
          </div>
        </div>
      </section>

      <style>{`
        /* ── Root scroller ─────────────────────────────────────── */
        .wv-root {
          height: 100vh; height: 100dvh;
          overflow-y: auto; overflow-x: hidden;
          scroll-snap-type: y mandatory;
          scroll-behavior: smooth;
          background: #06121f;
          font-family: "DM Sans", system-ui, sans-serif;
        }
        .wv-section {
          position: relative;
          min-height: 100vh; min-height: 100dvh;
          scroll-snap-align: start;
          scroll-snap-stop: always;
          overflow: hidden;
          display: flex; flex-direction: column;
          align-items: center; justify-content: center;
        }
        .wv-canvas {
          position: absolute; inset: 0;
          width: 100%; height: 100%;
          display: block;
        }

        /* ── Fixed chrome ──────────────────────────────────────── */
        .wv-topbar {
          position: fixed; top: 0; left: 0; right: 0; z-index: 60;
          display: flex; align-items: center; justify-content: space-between;
          padding: 16px 26px;
          background: linear-gradient(180deg, rgba(4,10,20,0.45), transparent);
          transition: background 0.4s ease, backdrop-filter 0.4s ease, padding 0.35s ease;
          pointer-events: none;
        }
        .wv-topbar-glass {
          padding: 10px 26px;
          background: rgba(6,16,28,0.55);
          backdrop-filter: blur(14px);
          -webkit-backdrop-filter: blur(14px);
          border-bottom: 1px solid rgba(150,210,250,0.12);
        }
        .wv-topbar > * { pointer-events: auto; }
        .wv-brand {
          display: flex; align-items: center; gap: 9px;
          color: #f4ece0; font-weight: 800; font-size: 17px; letter-spacing: 0.02em;
        }
        .wv-brand em { font-style: normal; color: #ffd98a; }
        .wv-dots {
          position: fixed; right: 18px; top: 50%; transform: translateY(-50%);
          display: flex; flex-direction: column; gap: 12px; z-index: 60;
        }
        .wv-dots button {
          width: 10px; height: 10px; border-radius: 50%;
          border: 1.6px solid rgba(235,245,255,0.55); background: transparent;
          cursor: pointer; padding: 0; transition: all 0.25s ease;
        }
        .wv-dots button.on { background: #ffd98a; border-color: #ffd98a; transform: scale(1.35); }
        .wv-dots button:focus-visible { outline: 2px solid #7cc4ea; outline-offset: 3px; }

        /* ── Buttons ───────────────────────────────────────────── */
        .wv-cta {
          display: inline-flex; align-items: center; gap: 8px;
          border: none; cursor: pointer; font-weight: 800; font-family: inherit;
          border-radius: 999px; transition: transform 0.18s ease, box-shadow 0.18s ease;
        }
        .wv-cta:hover { transform: translateY(-2px); }
        .wv-cta:focus-visible { outline: 2.5px solid #7cc4ea; outline-offset: 3px; }
        .wv-cta-primary {
          padding: 14px 26px; font-size: 15px; color: #2a1c08;
          background: linear-gradient(135deg, #ffd98a, #f2b25c);
          box-shadow: 0 10px 30px rgba(242,178,92,0.45);
        }
        .wv-cta-ghost {
          padding: 14px 22px; font-size: 14px; color: #f6ecd8;
          background: rgba(30,25,15,0.35); border: 1px solid rgba(255,235,200,0.4);
          backdrop-filter: blur(6px);
        }
        .wv-cta-small { padding: 9px 20px; font-size: 13px; color: #2a1c08;
          background: rgba(255,217,138,0.92); box-shadow: 0 4px 16px rgba(242,178,92,0.4); }
        .wv-cta-big { padding: 17px 34px; font-size: 17px; }

        .wv-scroll-hint {
          position: absolute; bottom: 18px; left: 50%; transform: translateX(-50%);
          display: flex; flex-direction: column; align-items: center; gap: 2px;
          background: none; border: none; cursor: pointer; color: rgba(250,244,232,0.85);
          font-size: 10.5px; font-weight: 700; letter-spacing: 0.18em; text-transform: uppercase;
          animation: wvHintBob 2.2s ease-in-out infinite; z-index: 8;
          text-shadow: 0 1px 8px rgba(20,15,5,0.5);
        }
        @keyframes wvHintBob { 0%,100% { transform: translate(-50%, 0); } 50% { transform: translate(-50%, 7px); } }

        /* ── Scene shells ──────────────────────────────────────── */
        .wv-scene-inner {
          position: relative; z-index: 4;
          display: flex; align-items: center; justify-content: center; gap: 48px;
          width: min(1180px, 92vw); flex-wrap: wrap;
        }
        .wv-scene-reverse { flex-direction: row-reverse; }
        .wv-info { flex: 1 1 380px; max-width: 520px; color: #e8f2fc; }
        .wv-info-center { max-width: 640px; text-align: center; }
        .wv-kicker {
          font-size: 11.5px; font-weight: 800; letter-spacing: 0.22em; text-transform: uppercase;
          color: #7cc4ea; margin-bottom: 14px;
        }
        .wv-info h2, .wv-glass h2 { font-size: clamp(26px, 3.6vw, 40px); font-weight: 800; line-height: 1.16; margin: 0 0 18px; color: #eef6fd; }
        .wv-info p, .wv-glass p { font-size: 15.5px; line-height: 1.75; color: #c3d8ec; margin: 0 0 14px; }
        .wv-info strong, .wv-glass strong { color: #fff; }

        .wv-section .wv-info, .wv-section .wv-card-grid, .wv-section .wv-net-info,
        .wv-section .wv-turtle-art, .wv-section .wv-night-content {
          opacity: 0; transform: translateY(34px);
          transition: opacity 0.9s cubic-bezier(0.2,0.8,0.2,1), transform 0.9s cubic-bezier(0.2,0.8,0.2,1);
        }
        .wv-section.wv-in .wv-info, .wv-section.wv-in .wv-card-grid, .wv-section.wv-in .wv-net-info,
        .wv-section.wv-in .wv-turtle-art, .wv-section.wv-in .wv-night-content {
          opacity: 1; transform: translateY(0);
        }
        .wv-section.wv-in .wv-card-grid { transition-delay: 0.22s; }

        .wv-stat-row { display: flex; gap: 30px; margin-top: 26px; flex-wrap: wrap; }
        .wv-stat-row > div { display: flex; flex-direction: column; }
        .wv-stat-row strong { font-size: 27px; font-weight: 800; color: #7cc4ea; }
        .wv-stat-row span { font-size: 12px; color: #9db8d2; margin-top: 3px; }

        .wv-feature-chips { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 20px; }
        .wv-feature-chips span {
          display: inline-flex; align-items: center; gap: 6px;
          padding: 8px 15px; border-radius: 999px; font-size: 12.5px; font-weight: 700;
          background: rgba(124,196,234,0.12); color: #a8d4f0; border: 1px solid rgba(124,196,234,0.3);
        }

        /* ═══ 1 · SHORELINE ════════════════════════════════════ */
        .wv-shore { background: #f2c47c; }
        /* cinematic load-in: slow camera push into the world */
        .wv-shore .wv-canvas {
          transform-origin: 50% 62%;
          animation: wvCamPush 7s cubic-bezier(0.16, 0.6, 0.2, 1) both;
        }
        @keyframes wvCamPush {
          from { transform: scale(1.075) translateY(-8px); opacity: 0; }
          18%  { opacity: 1; }
          to   { transform: scale(1) translateY(0); opacity: 1; }
        }
        /* staggered editorial reveal of the hero copy */
        .wv-hero > * { opacity: 0; animation: wvReveal 0.95s cubic-bezier(0.2, 0.7, 0.2, 1) forwards; }
        .wv-hero .wv-kicker2 { animation-delay: 0.55s; }
        .wv-hero .wv-title   { animation-delay: 0.8s; }
        .wv-hero .wv-sub     { animation-delay: 1.15s; }
        .wv-hero .wv-cta-row { animation-delay: 1.45s; }
        .wv-title .wv-t-dark, .wv-title .wv-t-serif {
          display: inline-block; opacity: 0;
          animation: wvReveal 0.95s cubic-bezier(0.2, 0.7, 0.2, 1) forwards;
        }
        .wv-title .wv-t-dark  { animation-delay: 0.85s; }
        .wv-title .wv-t-serif { animation-delay: 1.05s; }
        @keyframes wvReveal {
          from { opacity: 0; transform: translateY(22px); filter: blur(3px); }
          to   { opacity: 1; transform: translateY(0); filter: blur(0); }
        }
        .wv-cta:active { transform: translateY(0) scale(0.985); }
        .wv-hero {
          position: relative; z-index: 6;
          align-self: flex-start;
          margin: 14vh 0 0 6vw;
          max-width: 640px; padding: 0 18px 0 0;
          text-align: left;
        }
        /* soft local scrim for readability — no hard box */
        .wv-hero::before {
          content: "";
          position: absolute; inset: -60px -80px -50px -70px;
          background: radial-gradient(ellipse at 38% 42%, rgba(30,20,8,0.34), rgba(30,20,8,0) 70%);
          filter: blur(10px);
          z-index: -1; pointer-events: none;
        }
        .wv-kicker2 {
          font-size: 12px; font-weight: 800; letter-spacing: 0.3em; text-transform: uppercase;
          color: #ffe9bd; margin-bottom: 16px; text-shadow: 0 1px 12px rgba(40,24,8,0.65);
        }
        .wv-title {
          margin: 0 0 18px; line-height: 1.05; letter-spacing: -0.01em;
          text-wrap: balance;
        }
        .wv-t-dark {
          font-size: clamp(40px, 5.4vw, 66px); font-weight: 800; color: #fdf8ee;
          text-shadow: 0 2px 22px rgba(40,24,8,0.55);
        }
        .wv-t-serif {
          font-family: Georgia, 'Times New Roman', serif; font-style: italic; font-weight: 600;
          font-size: clamp(42px, 5.8vw, 72px); color: #ffe08a;
          text-shadow: 0 3px 24px rgba(50,30,10,0.6);
        }
        .wv-sub {
          font-size: clamp(15px, 1.7vw, 17.5px); line-height: 1.7; color: #fdf6e8;
          max-width: 480px; margin: 0 0 26px; text-shadow: 0 2px 14px rgba(40,26,10,0.7);
        }
        .wv-cta-row { display: flex; gap: 14px; flex-wrap: wrap; }

        /* ═══ 2 · UNDERWATER ═══════════════════════════════════ */
        .wv-under { background: #0d3a5c; }
        .wv-under-inner { flex-direction: column; gap: 34px; }
        .wv-under .wv-info-center h2, .wv-under .wv-info-center p { text-shadow: 0 2px 18px rgba(3,16,28,0.8); }
        .wv-card-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(230px, 1fr)); gap: 18px; width: min(960px, 90vw); }
        .wv-card {
          padding: 26px 24px; border-radius: 18px; color: #dcecfa;
          background: rgba(6,20,34,0.5); border: 1px solid rgba(150,210,250,0.22);
          backdrop-filter: blur(10px);
          transition: transform 0.25s ease, background 0.25s ease, border-color 0.25s ease;
        }
        .wv-card:hover { transform: translateY(-6px); background: rgba(10,30,48,0.62); border-color: rgba(150,210,250,0.45); }
        .wv-card svg { color: #7cc4ea; margin-bottom: 12px; }
        .wv-card h3 { margin: 0 0 8px; font-size: 17px; font-weight: 800; color: #fff; }
        .wv-card p { margin: 0; font-size: 13.5px; line-height: 1.65; color: #b6cee4; }

        /* ═══ 3 · NETWORK ══════════════════════════════════════ */
        .wv-network { background: #0a1e35; }
        .wv-net-info {
          position: relative; z-index: 4;
          align-self: flex-start; margin-left: 5vw;
          width: min(480px, 88vw);
        }
        .wv-glass {
          padding: 34px 34px 30px;
          border-radius: 22px;
          background: rgba(5,14,26,0.55);
          border: 1px solid rgba(124,196,234,0.2);
          backdrop-filter: blur(14px);
          -webkit-backdrop-filter: blur(14px);
          box-shadow: 0 18px 60px rgba(2,8,18,0.5);
          color: #e8f2fc;
        }

        /* ═══ 4 · TURTLE ISLAND ════════════════════════════════ */
        .wv-turtle { background: linear-gradient(180deg, #f7efe0 0%, #efe0c8 42%, #d5e7f0 74%, #b3d5e8 100%); }
        .wv-turtle .wv-info { color: #2a3a4a; }
        .wv-turtle .wv-info h2 { color: #1d3557; }
        .wv-turtle .wv-info p { color: #40566c; }
        .wv-turtle .wv-info strong { color: #14344f; }
        .wv-turtle .wv-kicker { color: #b07b26; }
        .wv-turtle .wv-feature-chips span { background: rgba(29,83,120,0.1); color: #1d5378; border-color: rgba(29,83,120,0.28); }
        .wv-turtle-art { flex: 1 1 380px; max-width: 470px; }
        .wv-turtle-canvas { width: 100%; aspect-ratio: 560 / 720; display: block; }

        /* ═══ 5 · NIGHT ════════════════════════════════════════ */
        .wv-night { background: #030814; }
        .wv-night-content { position: relative; z-index: 5; text-align: center; padding: 0 22px; max-width: 620px; }
        .wv-night-content h2 { font-size: clamp(30px, 4.6vw, 52px); font-weight: 800; color: #f3f7fc; margin: 0 0 16px; text-shadow: 0 3px 24px rgba(1,6,14,0.8); }
        .wv-night-content p { font-size: 16.5px; line-height: 1.75; color: #b9cfe4; margin: 0 0 30px; text-shadow: 0 2px 16px rgba(1,6,14,0.8); }
        .wv-night-content .wv-cta-primary { color: #fff; background: linear-gradient(135deg, #0ea5e9, #14b8a6); box-shadow: 0 10px 30px rgba(14,165,233,0.4); }
        .wv-credits { margin-top: 40px; font-size: 12px; color: #7d95ac; letter-spacing: 0.04em; }

        /* ── Small screens ─────────────────────────────────────── */
        @media (max-width: 760px) {
          .wv-dots { right: 8px; }
          .wv-scene-inner { gap: 26px; padding: 76px 0 66px; }
          .wv-info h2 { font-size: 24px; }
          .wv-turtle-art { max-width: 74vw; }
          .wv-hero { margin: 11vh 0 0 6vw; max-width: 88vw; }
          .wv-net-info { align-self: center; margin: 0; }
          .wv-glass { padding: 26px 22px; }
        }

        /* ── Reduced motion — the engine freezes to one frame ──── */
        @media (prefers-reduced-motion: reduce) {
          .wv-root *, .wv-root *::before, .wv-root *::after {
            animation-duration: 0.001s !important;
            animation-iteration-count: 1 !important;
            transition-duration: 0.001s !important;
          }
          .wv-section .wv-info, .wv-section .wv-card-grid, .wv-section .wv-net-info,
          .wv-section .wv-turtle-art, .wv-section .wv-night-content { opacity: 1; transform: none; }
        }
      `}</style>
    </div>
  )
}
