/**
 * Welcome — cinematic scroll-driven landing experience.
 *
 * Five full-viewport scenes that transition as the visitor scrolls
 * (scroll-snap), each one an animated Great Lakes tableau built from
 * inline SVG + CSS keyframes only — no canvas, no RAF loops, no image
 * downloads, no new dependencies. Everything GPU-composites, and the
 * global `html.sw-no-anim` kill-switch (plus prefers-reduced-motion)
 * freezes it all for users who want stillness.
 *
 *   1. Dawn on the lake      — sun rise, waves, birds, canoe, mist
 *   2. The Great Lakes       — the five lakes with live-pulsing sites
 *   3. Turtle Island         — homage to Anishinaabe artwork: turtle
 *                              carrying the land, water flowing from
 *                              its shell to the communities below
 *   4. Beneath the surface   — underwater: light rays, fish, bubbles
 *   5. Night water & aurora  — starfield, aurora, moonpath, final CTA
 *
 * Route: "/" for signed-out visitors. Sign-in lives at /login.
 * This page deliberately does NOT use Layout — it is a standalone,
 * full-bleed experience.
 */
import { useEffect, useRef, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronDown, Droplets, Map as MapIcon, Users, Sparkles, BookOpen, BarChart3, ArrowRight } from 'lucide-react'

const SECTIONS = ['dawn', 'lakes', 'turtle', 'underwater', 'night']

// ─────────────────────────────────────────────────────────────────────────────
// Scene 1 — Dawn on the lake
// ─────────────────────────────────────────────────────────────────────────────
function SceneDawn({ onScrollNext, onSignIn }) {
  return (
    <section className="wv-section wv-dawn" data-scene="dawn">
      {/* Sky + sun */}
      <div className="wv-dawn-sky" aria-hidden="true">
        <div className="wv-sun" />
        <div className="wv-sun-glow" />
        {/* Drifting clouds */}
        <svg className="wv-cloud wv-cloud-1" viewBox="0 0 200 60" aria-hidden="true">
          <ellipse cx="60" cy="40" rx="55" ry="18" fill="rgba(255,255,255,0.55)" />
          <ellipse cx="110" cy="30" rx="45" ry="16" fill="rgba(255,255,255,0.45)" />
          <ellipse cx="150" cy="42" rx="40" ry="13" fill="rgba(255,255,255,0.5)" />
        </svg>
        <svg className="wv-cloud wv-cloud-2" viewBox="0 0 200 60" aria-hidden="true">
          <ellipse cx="70" cy="38" rx="60" ry="16" fill="rgba(255,255,255,0.4)" />
          <ellipse cx="130" cy="30" rx="45" ry="14" fill="rgba(255,255,255,0.35)" />
        </svg>
        {/* Birds — three staggered flyers */}
        {[1, 2, 3].map(i => (
          <svg key={i} className={`wv-bird wv-bird-${i}`} viewBox="0 0 40 20" aria-hidden="true">
            <path d="M2 12 Q10 4 20 11 Q30 4 38 12" fill="none" stroke="#27324a" strokeWidth="2.4" strokeLinecap="round" />
          </svg>
        ))}
      </div>

      {/* Shoreline pines — left and right */}
      <svg className="wv-pines wv-pines-left" viewBox="0 0 300 220" preserveAspectRatio="xMinYMax meet" aria-hidden="true">
        {[0, 55, 110, 165, 220].map((x, i) => (
          <g key={i} transform={`translate(${x}, ${28 + (i % 2) * 22})`}>
            <path d={`M30 190 L30 90 M30 90 L8 140 L52 140 Z M30 70 L12 116 L48 116 Z M30 52 L16 94 L44 94 Z`}
              fill="#122033" stroke="#122033" strokeWidth="6" strokeLinejoin="round" />
          </g>
        ))}
      </svg>
      <svg className="wv-pines wv-pines-right" viewBox="0 0 300 220" preserveAspectRatio="xMaxYMax meet" aria-hidden="true">
        {[20, 80, 140, 200].map((x, i) => (
          <g key={i} transform={`translate(${x}, ${40 + (i % 2) * 26})`}>
            <path d={`M30 180 L30 86 M30 86 L10 134 L50 134 Z M30 66 L14 110 L46 110 Z M30 50 L18 90 L42 90 Z`}
              fill="#0e1a2b" stroke="#0e1a2b" strokeWidth="6" strokeLinejoin="round" />
          </g>
        ))}
      </svg>

      {/* Water — three parallax wave bands + canoe + jumping fish */}
      <div className="wv-water" aria-hidden="true">
        <svg className="wv-wave wv-wave-3" viewBox="0 0 1440 90" preserveAspectRatio="none">
          <path d="M0,45 C120,20 240,70 360,45 C480,20 600,70 720,45 C840,20 960,70 1080,45 C1200,20 1320,70 1440,45 L1440,90 L0,90 Z" fill="#2b5f8f" />
        </svg>
        {/* Canoe with paddler, bobbing on the middle band */}
        <svg className="wv-canoe" viewBox="0 0 220 80" aria-hidden="true">
          <path d="M10 46 Q110 76 210 46 L196 58 Q110 84 24 58 Z" fill="#5b3a1e" stroke="#3a2410" strokeWidth="3" />
          <circle cx="112" cy="30" r="9" fill="#27324a" />
          <path d="M112 39 L112 54 M112 44 L88 34 M112 44 L134 56" stroke="#27324a" strokeWidth="5" strokeLinecap="round" />
          <path d="M134 56 L142 66" stroke="#8a5a2b" strokeWidth="4" strokeLinecap="round" />
        </svg>
        {/* Jumping fish — leaps, pauses, repeats */}
        <svg className="wv-fish-jump" viewBox="0 0 60 40" aria-hidden="true">
          <path d="M8 24 Q22 8 40 16 Q34 22 40 28 Q22 34 8 24 Z" fill="#3d7ea6" />
          <path d="M40 16 L52 10 L48 22 L52 32 L40 28" fill="#356e91" />
          <circle cx="16" cy="20" r="2" fill="#0f2233" />
        </svg>
        <svg className="wv-wave wv-wave-2" viewBox="0 0 1440 90" preserveAspectRatio="none">
          <path d="M0,50 C180,25 300,72 480,50 C660,28 780,72 960,50 C1140,28 1260,72 1440,50 L1440,90 L0,90 Z" fill="#1f4a73" />
        </svg>
        <svg className="wv-wave wv-wave-1" viewBox="0 0 1440 90" preserveAspectRatio="none">
          <path d="M0,55 C160,35 320,75 480,55 C640,35 800,75 960,55 C1120,35 1280,75 1440,55 L1440,90 L0,90 Z" fill="#153756" />
        </svg>
        <div className="wv-mist" />
      </div>

      {/* Hero copy */}
      <div className="wv-hero">
        <div className="wv-badge">
          <span className="wv-live-dot" /> LIVE · Community Water Intelligence
        </div>
        <h1 className="wv-title">
          The water is<br /><span>speaking.</span>
        </h1>
        <p className="wv-sub">
          SOURCE Water connects communities across the Great Lakes with live
          water-quality data, science you can understand, and each other.
        </p>
        <div className="wv-cta-row">
          <button className="wv-cta wv-cta-primary" onClick={onSignIn}>
            <Droplets size={17} /> Enter the platform
          </button>
          <button className="wv-cta wv-cta-ghost" onClick={onScrollNext}>
            Discover more <ChevronDown size={16} />
          </button>
        </div>
      </div>

      <button className="wv-scroll-hint" onClick={onScrollNext} aria-label="Scroll to next section">
        <span>Scroll</span>
        <ChevronDown size={20} />
      </button>
    </section>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Scene 2 — The Great Lakes with pulsing monitoring sites
// ─────────────────────────────────────────────────────────────────────────────
const LAKE_SITES = [
  // Rough positions on the 900×560 viewBox
  { x: 205, y: 128 }, { x: 285, y: 105 }, { x: 355, y: 148 },   // Superior
  { x: 300, y: 300 }, { x: 318, y: 388 },                       // Michigan
  { x: 470, y: 245 }, { x: 520, y: 205 },                       // Huron
  { x: 610, y: 388 }, { x: 680, y: 360 },                       // Erie
  { x: 755, y: 285 }, { x: 810, y: 272 },                       // Ontario
]

function SceneLakes({ onScrollNext }) {
  return (
    <section className="wv-section wv-lakes" data-scene="lakes">
      <div className="wv-scene-inner">
        <div className="wv-lakes-art" aria-hidden="true">
          <svg viewBox="0 0 900 560" className="wv-lakes-svg">
            <defs>
              <linearGradient id="wvLake" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#3d8bc4" />
                <stop offset="100%" stopColor="#1c5586" />
              </linearGradient>
            </defs>
            {/* Lake Superior */}
            <path d="M110 150 C160 92 280 70 380 96 C450 112 470 150 440 178 C400 210 330 218 250 205 C180 195 130 185 110 150 Z"
              fill="url(#wvLake)" className="wv-lake-shape" style={{ animationDelay: '0s' }} />
            {/* Lake Michigan */}
            <path d="M290 235 C272 228 262 260 266 310 C270 370 280 420 300 435 C322 448 338 420 334 360 C330 300 320 250 290 235 Z"
              fill="url(#wvLake)" className="wv-lake-shape" style={{ animationDelay: '0.4s' }} />
            {/* Lake Huron */}
            <path d="M420 200 C470 165 540 168 565 205 C590 245 570 300 530 320 C490 338 450 320 435 280 C425 252 408 225 420 200 Z"
              fill="url(#wvLake)" className="wv-lake-shape" style={{ animationDelay: '0.8s' }} />
            {/* Lake Erie */}
            <path d="M560 380 C610 350 700 340 740 358 C765 372 755 392 715 402 C660 415 590 415 560 400 C548 393 548 388 560 380 Z"
              fill="url(#wvLake)" className="wv-lake-shape" style={{ animationDelay: '1.2s' }} />
            {/* Lake Ontario */}
            <path d="M720 290 C755 262 830 255 858 272 C880 288 866 308 826 315 C780 323 730 315 718 302 C714 297 714 294 720 290 Z"
              fill="url(#wvLake)" className="wv-lake-shape" style={{ animationDelay: '1.6s' }} />

            {/* Lake labels */}
            <g className="wv-lake-labels" fontFamily="Georgia, serif" fontStyle="italic" fill="#9fc6e8">
              <text x="235" y="150" fontSize="19">Superior</text>
              <text x="252" y="345" fontSize="15" transform="rotate(78 262 340)">Michigan</text>
              <text x="468" y="262" fontSize="16">Huron</text>
              <text x="628" y="385" fontSize="15">Erie</text>
              <text x="762" y="295" fontSize="15">Ontario</text>
            </g>

            {/* Pulsing monitoring sites */}
            {LAKE_SITES.map((s, i) => (
              <g key={i} className="wv-site" style={{ animationDelay: `${i * 0.35}s` }}>
                <circle cx={s.x} cy={s.y} r="5" fill="#5eead4" />
                <circle cx={s.x} cy={s.y} r="5" fill="none" stroke="#5eead4" strokeWidth="2" className="wv-site-ring" style={{ animationDelay: `${i * 0.35}s` }} />
              </g>
            ))}
          </svg>
        </div>

        <div className="wv-info">
          <div className="wv-kicker">01 · The Site Map</div>
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
      <button className="wv-scroll-hint" onClick={onScrollNext} aria-label="Scroll to next section">
        <ChevronDown size={20} />
      </button>
    </section>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Scene 3 — Turtle Island (homage to Anishinaabe artwork)
// ─────────────────────────────────────────────────────────────────────────────
function SceneTurtle({ onScrollNext }) {
  return (
    <section className="wv-section wv-turtle" data-scene="turtle">
      <div className="wv-scene-inner wv-scene-reverse">
        <div className="wv-turtle-art" aria-hidden="true">
          <svg viewBox="0 0 520 620" className="wv-turtle-svg">
            <defs>
              <radialGradient id="wvSun2" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#ffe9a3" />
                <stop offset="70%" stopColor="#f6d36b" />
                <stop offset="100%" stopColor="#eec14f" />
              </radialGradient>
              <linearGradient id="wvShell" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#7cb56b" />
                <stop offset="55%" stopColor="#4f9155" />
                <stop offset="100%" stopColor="#2e6b46" />
              </linearGradient>
              <linearGradient id="wvRibbon" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#7cc4ea" />
                <stop offset="100%" stopColor="#2a6fae" />
              </linearGradient>
            </defs>

            {/* Sun disc behind the turtle */}
            <circle cx="330" cy="180" r="130" fill="url(#wvSun2)" className="wv-turtle-sun" />

            {/* Pines standing on the shell — the land the turtle carries */}
            <g fill="#1c2b1e" className="wv-turtle-bob">
              <path d="M225 96 L225 60 L211 88 L239 88 Z M225 52 L214 76 L236 76 Z" />
              <path d="M262 88 L262 44 L246 76 L278 76 Z M262 34 L249 62 L275 62 Z" />
              <path d="M300 92 L300 56 L287 84 L313 84 Z M300 47 L290 70 L310 70 Z" />
            </g>

            {/* Turtle body */}
            <g className="wv-turtle-bob">
              {/* Head */}
              <path d="M118 158 C96 138 92 116 108 104 C126 92 152 100 162 122 C170 140 164 158 148 168 Z"
                fill="#5da35f" stroke="#173423" strokeWidth="7" strokeLinejoin="round" />
              <circle cx="122" cy="122" r="7" fill="#173423" />
              <circle cx="124" cy="120" r="2.4" fill="#e8f4d9" />
              {/* Shell — dome with inner pattern */}
              <path d="M140 210 C160 130 330 118 396 178 C440 218 430 268 380 292 C300 328 190 322 152 280 C132 258 130 236 140 210 Z"
                fill="url(#wvShell)" stroke="#173423" strokeWidth="8" strokeLinejoin="round" />
              {/* Shell rim plates */}
              <path d="M148 262 L392 250" stroke="#173423" strokeWidth="6" strokeLinecap="round" />
              {[176, 216, 256, 296, 336, 372].map((x, i) => (
                <line key={i} x1={x} y1="258" x2={x + 8} y2="288" stroke="#173423" strokeWidth="5" strokeLinecap="round" />
              ))}
              {/* Shell interior — flowing map-like pattern (waterways on the back) */}
              <path d="M180 210 C220 172 300 162 356 196 M196 240 C240 205 320 198 372 228 M212 178 C250 158 306 152 344 170"
                fill="none" stroke="#bfe3f2" strokeWidth="7" strokeLinecap="round" opacity="0.75" className="wv-shell-rivers" />
              {/* Legs */}
              <path d="M172 296 C160 322 162 344 176 352 C192 360 206 348 206 326 L204 306 Z" fill="#5da35f" stroke="#173423" strokeWidth="7" strokeLinejoin="round" />
              <path d="M330 302 C324 330 330 352 346 356 C362 360 374 346 370 322 L364 304 Z" fill="#5da35f" stroke="#173423" strokeWidth="7" strokeLinejoin="round" />
            </g>

            {/* Water ribbons flowing from beneath the shell down to the people */}
            <g className="wv-ribbons" fill="none" strokeLinecap="round">
              <path className="wv-ribbon wv-ribbon-1" d="M170 340 C120 400 150 460 110 520 C90 550 96 580 84 604"
                stroke="url(#wvRibbon)" strokeWidth="26" />
              <path className="wv-ribbon wv-ribbon-2" d="M240 350 C230 420 260 470 236 530 C224 560 234 588 224 612"
                stroke="url(#wvRibbon)" strokeWidth="30" />
              <path className="wv-ribbon wv-ribbon-3" d="M330 352 C360 420 330 470 364 528 C382 558 372 588 386 610"
                stroke="url(#wvRibbon)" strokeWidth="24" />
              {/* Thin white flow-lines on top — these animate like current */}
              <path className="wv-flowline" d="M170 340 C120 400 150 460 110 520 C90 550 96 580 84 604" stroke="rgba(235,248,255,0.9)" strokeWidth="3" />
              <path className="wv-flowline wv-flowline-d" d="M240 350 C230 420 260 470 236 530 C224 560 234 588 224 612" stroke="rgba(235,248,255,0.85)" strokeWidth="3" />
              <path className="wv-flowline" d="M330 352 C360 420 330 470 364 528 C382 558 372 588 386 610" stroke="rgba(235,248,255,0.9)" strokeWidth="3" />
            </g>

            {/* Small community dots the water reaches */}
            {[
              { x: 84, y: 606 }, { x: 224, y: 614 }, { x: 386, y: 612 },
            ].map((p, i) => (
              <g key={i} className="wv-community-dot" style={{ animationDelay: `${i * 0.5}s` }}>
                <circle cx={p.x} cy={p.y} r="9" fill="#f0c64f" stroke="#173423" strokeWidth="3" />
              </g>
            ))}
          </svg>
        </div>

        <div className="wv-info">
          <div className="wv-kicker">02 · Community</div>
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
      <button className="wv-scroll-hint" onClick={onScrollNext} aria-label="Scroll to next section">
        <ChevronDown size={20} />
      </button>
    </section>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Scene 4 — Beneath the surface
// ─────────────────────────────────────────────────────────────────────────────
function SceneUnderwater({ onScrollNext }) {
  return (
    <section className="wv-section wv-under" data-scene="underwater">
      {/* Light rays */}
      <div className="wv-rays" aria-hidden="true">
        <span /><span /><span />
      </div>
      {/* Bubbles */}
      <div className="wv-bubbles" aria-hidden="true">
        {Array.from({ length: 10 }).map((_, i) => (
          <span key={i} style={{ left: `${6 + i * 9.5}%`, animationDelay: `${i * 1.4}s`, width: 6 + (i % 4) * 4, height: 6 + (i % 4) * 4 }} />
        ))}
      </div>
      {/* Fish school crossing */}
      <svg className="wv-school" viewBox="0 0 300 120" aria-hidden="true">
        {[0, 1, 2, 3, 4].map(i => (
          <g key={i} transform={`translate(${i * 52}, ${(i % 2) * 30 + 12}) scale(${1 - i * 0.08})`}>
            <path d="M8 24 Q22 10 40 17 Q34 23 40 29 Q22 36 8 24 Z" fill="rgba(140,200,235,0.5)" />
            <path d="M40 17 L52 11 L48 23 L52 33 L40 29" fill="rgba(120,180,220,0.45)" />
          </g>
        ))}
      </svg>
      {/* Seaweed */}
      <div className="wv-weeds" aria-hidden="true">
        {Array.from({ length: 7 }).map((_, i) => (
          <svg key={i} viewBox="0 0 40 120" className="wv-weed" style={{ left: `${4 + i * 14}%`, animationDelay: `${i * 0.7}s`, height: 70 + (i % 3) * 30 }}>
            <path d="M20 120 C8 96 32 78 20 54 C10 34 28 20 20 0" fill="none" stroke="rgba(45,150,120,0.65)" strokeWidth="7" strokeLinecap="round" />
          </svg>
        ))}
      </div>

      <div className="wv-scene-inner wv-under-inner">
        <div className="wv-info wv-info-center">
          <div className="wv-kicker">03 · Understand your water</div>
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
      <button className="wv-scroll-hint" onClick={onScrollNext} aria-label="Scroll to next section">
        <ChevronDown size={20} />
      </button>
    </section>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Scene 5 — Night water, aurora, final CTA
// ─────────────────────────────────────────────────────────────────────────────
function SceneNight({ onSignIn }) {
  return (
    <section className="wv-section wv-night" data-scene="night">
      {/* Stars */}
      <div className="wv-stars" aria-hidden="true">
        {Array.from({ length: 42 }).map((_, i) => (
          <span key={i} style={{
            left: `${(i * 37) % 100}%`,
            top: `${(i * 23) % 55}%`,
            animationDelay: `${(i % 7) * 0.8}s`,
            width: i % 5 === 0 ? 3 : 2,
            height: i % 5 === 0 ? 3 : 2,
          }} />
        ))}
      </div>
      {/* Aurora ribbons */}
      <div className="wv-aurora" aria-hidden="true">
        <span className="wv-aurora-1" />
        <span className="wv-aurora-2" />
        <span className="wv-aurora-3" />
      </div>
      {/* Moon + reflection */}
      <div className="wv-moon" aria-hidden="true" />
      <div className="wv-moonpath" aria-hidden="true" />
      {/* Dark water */}
      <svg className="wv-night-wave" viewBox="0 0 1440 120" preserveAspectRatio="none" aria-hidden="true">
        <path d="M0,60 C180,35 300,85 480,60 C660,38 780,82 960,60 C1140,38 1260,82 1440,60 L1440,120 L0,120 Z" fill="#050d1c" />
      </svg>

      <div className="wv-night-content">
        <h2>The lake is waiting.</h2>
        <p>
          Join researchers, students, elders, and neighbours already
          protecting the water — one reading at a time.
        </p>
        <button className="wv-cta wv-cta-primary wv-cta-big" onClick={onSignIn}>
          Create your free account <ArrowRight size={18} />
        </button>
        <div className="wv-credits">
          SOURCE Water · NORDIK Institute · powered by Water Rangers open data
        </div>
      </div>
    </section>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────────────────────────────────────
export default function Welcome() {
  const navigate = useNavigate()
  const containerRef = useRef(null)
  const [active, setActive] = useState(0)

  const goSignIn = useCallback(() => navigate('/login'), [navigate])

  const scrollTo = useCallback((idx) => {
    const el = containerRef.current?.querySelectorAll('.wv-section')?.[idx]
    el?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  // Track which scene is on screen (drives the dot nav + entrance animations)
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
    return () => obs.disconnect()
  }, [])

  return (
    <div className="wv-root" ref={containerRef}>
      {/* Fixed top bar — brand + sign in, always reachable */}
      <div className="wv-topbar">
        <div className="wv-brand">
          <Droplets size={20} />
          <span>SOURCE <em>Water</em></span>
        </div>
        <button className="wv-cta wv-cta-small" onClick={goSignIn}>Sign in</button>
      </div>

      {/* Right-side dot navigation */}
      <nav className="wv-dots" aria-label="Scene navigation">
        {SECTIONS.map((s, i) => (
          <button key={s} className={i === active ? 'on' : ''} onClick={() => scrollTo(i)} aria-label={`Go to scene ${i + 1}`} />
        ))}
      </nav>

      <SceneDawn onScrollNext={() => scrollTo(1)} onSignIn={goSignIn} />
      <SceneLakes onScrollNext={() => scrollTo(2)} />
      <SceneTurtle onScrollNext={() => scrollTo(3)} />
      <SceneUnderwater onScrollNext={() => scrollTo(4)} />
      <SceneNight onSignIn={goSignIn} />

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

        /* ── Fixed chrome ──────────────────────────────────────── */
        .wv-topbar {
          position: fixed; top: 0; left: 0; right: 0; z-index: 60;
          display: flex; align-items: center; justify-content: space-between;
          padding: 16px 26px;
          background: linear-gradient(180deg, rgba(4,10,20,0.55), transparent);
          pointer-events: none;
        }
        .wv-topbar > * { pointer-events: auto; }
        .wv-brand {
          display: flex; align-items: center; gap: 9px;
          color: #eaf4ff; font-weight: 800; font-size: 17px; letter-spacing: 0.02em;
        }
        .wv-brand em { font-style: normal; color: #7cc4ea; }
        .wv-dots {
          position: fixed; right: 18px; top: 50%; transform: translateY(-50%);
          display: flex; flex-direction: column; gap: 12px; z-index: 60;
        }
        .wv-dots button {
          width: 10px; height: 10px; border-radius: 50%;
          border: 1.6px solid rgba(235,245,255,0.55); background: transparent;
          cursor: pointer; padding: 0; transition: all 0.25s ease;
        }
        .wv-dots button.on { background: #7cc4ea; border-color: #7cc4ea; transform: scale(1.35); }

        /* ── Buttons ───────────────────────────────────────────── */
        .wv-cta {
          display: inline-flex; align-items: center; gap: 8px;
          border: none; cursor: pointer; font-weight: 800; font-family: inherit;
          border-radius: 999px; transition: transform 0.18s ease, box-shadow 0.18s ease;
        }
        .wv-cta:hover { transform: translateY(-2px); }
        .wv-cta-primary {
          padding: 14px 26px; font-size: 15px; color: #fff;
          background: linear-gradient(135deg, #0ea5e9, #14b8a6);
          box-shadow: 0 10px 30px rgba(14,165,233,0.4);
        }
        .wv-cta-ghost {
          padding: 14px 22px; font-size: 14px; color: #d7e9f8;
          background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.22);
          backdrop-filter: blur(6px);
        }
        .wv-cta-small { padding: 9px 20px; font-size: 13px; color: #fff;
          background: rgba(14,165,233,0.85); box-shadow: 0 4px 16px rgba(14,165,233,0.35); }
        .wv-cta-big { padding: 17px 34px; font-size: 17px; }

        .wv-scroll-hint {
          position: absolute; bottom: 22px; left: 50%; transform: translateX(-50%);
          display: flex; flex-direction: column; align-items: center; gap: 2px;
          background: none; border: none; cursor: pointer; color: rgba(230,242,255,0.75);
          font-size: 11px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase;
          animation: wvHintBob 2.2s ease-in-out infinite; z-index: 5;
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
        .wv-info h2 { font-size: clamp(26px, 3.6vw, 40px); font-weight: 800; line-height: 1.16; margin: 0 0 18px; }
        .wv-info p { font-size: 15.5px; line-height: 1.75; color: #c3d8ec; margin: 0 0 14px; }
        .wv-info strong { color: #fff; }

        /* Entrance animation for scene content */
        .wv-section .wv-info, .wv-section .wv-card-grid, .wv-section .wv-lakes-art,
        .wv-section .wv-turtle-art, .wv-section .wv-night-content {
          opacity: 0; transform: translateY(34px);
          transition: opacity 0.9s cubic-bezier(0.2,0.8,0.2,1), transform 0.9s cubic-bezier(0.2,0.8,0.2,1);
        }
        .wv-section.wv-in .wv-info, .wv-section.wv-in .wv-card-grid, .wv-section.wv-in .wv-lakes-art,
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

        /* ═══ SCENE 1 · DAWN ═══════════════════════════════════ */
        .wv-dawn { background: linear-gradient(180deg, #2c3e6b 0%, #7b5a86 34%, #e8956d 58%, #f5b978 70%); }
        .wv-dawn-sky { position: absolute; inset: 0; }
        .wv-sun {
          position: absolute; left: 50%; top: 46%;
          width: 130px; height: 130px; margin-left: -65px; border-radius: 50%;
          background: radial-gradient(circle, #fff3c9 0%, #ffd977 55%, #f7b64e 100%);
          animation: wvSunRise 14s ease-out both;
          box-shadow: 0 0 80px 30px rgba(255,205,110,0.55);
        }
        .wv-sun-glow {
          position: absolute; left: 50%; top: 46%; width: 340px; height: 340px;
          margin-left: -170px; margin-top: -100px; border-radius: 50%;
          background: radial-gradient(circle, rgba(255,220,150,0.35) 0%, transparent 70%);
          animation: wvGlowPulse 6s ease-in-out infinite;
        }
        @keyframes wvSunRise { from { transform: translateY(130px); opacity: 0.4; } to { transform: translateY(0); opacity: 1; } }
        @keyframes wvGlowPulse { 0%,100% { opacity: 0.7; transform: scale(1); } 50% { opacity: 1; transform: scale(1.07); } }

        .wv-cloud { position: absolute; width: 240px; opacity: 0.85; }
        .wv-cloud-1 { top: 14%; animation: wvDriftA 46s linear infinite; }
        .wv-cloud-2 { top: 26%; width: 190px; animation: wvDriftA 64s linear infinite reverse; }
        @keyframes wvDriftA { from { left: -260px; } to { left: 105%; } }

        .wv-bird { position: absolute; width: 34px; }
        .wv-bird-1 { top: 18%; animation: wvFly 26s linear infinite, wvFlap 1.1s ease-in-out infinite; }
        .wv-bird-2 { top: 24%; width: 26px; animation: wvFly 34s linear 4s infinite, wvFlap 0.9s ease-in-out infinite; }
        .wv-bird-3 { top: 13%; width: 22px; animation: wvFly 30s linear 11s infinite, wvFlap 1.3s ease-in-out infinite; }
        @keyframes wvFly { from { left: -60px; } to { left: 106%; } }
        @keyframes wvFlap { 0%,100% { transform: scaleY(1); } 50% { transform: scaleY(0.62); } }

        .wv-pines { position: absolute; bottom: 26vh; width: min(30vw, 330px); z-index: 2; opacity: 0.95; }
        .wv-pines-left { left: 0; }
        .wv-pines-right { right: 0; }

        .wv-water { position: absolute; left: 0; right: 0; bottom: 0; height: 34vh; z-index: 3; }
        .wv-wave { position: absolute; left: -8%; width: 116%; height: 42%; }
        .wv-wave-3 { bottom: 22%; animation: wvSway 9s ease-in-out infinite alternate; }
        .wv-wave-2 { bottom: 10%; animation: wvSway 7s ease-in-out infinite alternate-reverse; }
        .wv-wave-1 { bottom: 0; animation: wvSway 11s ease-in-out infinite alternate; }
        @keyframes wvSway { from { transform: translateX(0); } to { transform: translateX(-56px); } }

        .wv-canoe {
          position: absolute; bottom: 38%; width: 150px; z-index: 4;
          animation: wvCanoeDrift 60s linear infinite, wvBob 4s ease-in-out infinite;
        }
        @keyframes wvCanoeDrift { from { left: -170px; } to { left: 108%; } }
        @keyframes wvBob { 0%,100% { margin-bottom: 0; transform: rotate(-1.4deg); } 50% { margin-bottom: 10px; transform: rotate(1.6deg); } }

        .wv-fish-jump {
          position: absolute; bottom: 34%; left: 68%; width: 44px; z-index: 4;
          transform-origin: bottom center; opacity: 0;
          animation: wvJump 9s ease-in-out infinite;
        }
        @keyframes wvJump {
          0%, 78%, 100% { opacity: 0; transform: translateY(24px) rotate(0deg); }
          82% { opacity: 1; transform: translateY(-38px) rotate(-24deg); }
          86% { opacity: 1; transform: translateY(-52px) rotate(6deg); }
          90% { opacity: 0; transform: translateY(18px) rotate(32deg); }
        }

        .wv-mist {
          position: absolute; bottom: 26%; left: 0; right: 0; height: 60px;
          background: linear-gradient(180deg, transparent, rgba(235,240,248,0.22), transparent);
          filter: blur(8px);
          animation: wvMistDrift 18s ease-in-out infinite alternate;
        }
        @keyframes wvMistDrift { from { transform: translateX(-40px); } to { transform: translateX(50px); } }

        .wv-hero { position: relative; z-index: 5; text-align: center; padding: 0 20px; max-width: 760px; }
        .wv-badge {
          display: inline-flex; align-items: center; gap: 8px;
          padding: 8px 18px; border-radius: 999px; margin-bottom: 26px;
          font-size: 12px; font-weight: 800; letter-spacing: 0.12em; text-transform: uppercase;
          color: #eaf6ff; background: rgba(10,25,45,0.45); border: 1px solid rgba(255,255,255,0.25);
          backdrop-filter: blur(8px);
        }
        .wv-live-dot { width: 8px; height: 8px; border-radius: 50%; background: #4ade80;
          animation: wvGlowPulse 2s ease-in-out infinite; }
        .wv-title {
          margin: 0 0 20px; font-size: clamp(42px, 7.5vw, 84px); font-weight: 800;
          line-height: 1.02; color: #fdfaf3; letter-spacing: -0.02em;
          text-shadow: 0 6px 40px rgba(20,30,60,0.45);
        }
        .wv-title span {
          background: linear-gradient(100deg, #8fd7ff 10%, #5eead4 90%);
          -webkit-background-clip: text; background-clip: text; color: transparent;
        }
        .wv-sub { font-size: clamp(15px, 1.8vw, 18.5px); line-height: 1.7; color: #f3ead9;
          max-width: 560px; margin: 0 auto 30px; text-shadow: 0 2px 16px rgba(20,30,60,0.5); }
        .wv-cta-row { display: flex; gap: 14px; justify-content: center; flex-wrap: wrap; }

        /* ═══ SCENE 2 · LAKES ══════════════════════════════════ */
        .wv-lakes { background: radial-gradient(ellipse at 50% 0%, #12365a 0%, #0a1e35 55%, #061426 100%); }
        .wv-lakes-art { flex: 1 1 420px; max-width: 620px; }
        .wv-lakes-svg { width: 100%; height: auto; filter: drop-shadow(0 12px 44px rgba(20,90,150,0.35)); }
        .wv-lake-shape { animation: wvLakeBreathe 7s ease-in-out infinite; transform-origin: center; }
        @keyframes wvLakeBreathe { 0%,100% { opacity: 0.92; } 50% { opacity: 1; } }
        .wv-site-ring { animation: wvRing 2.8s ease-out infinite; transform-origin: center; transform-box: fill-box; }
        @keyframes wvRing { 0% { transform: scale(1); opacity: 0.9; } 100% { transform: scale(4.2); opacity: 0; } }
        .wv-site circle:first-child { animation: wvGlowPulse 2.8s ease-in-out infinite; }

        /* ═══ SCENE 3 · TURTLE ═════════════════════════════════ */
        .wv-turtle { background: linear-gradient(180deg, #f7efe0 0%, #efe0c8 46%, #cfe4ee 78%, #a8cfe4 100%); }
        .wv-turtle .wv-info { color: #2a3a4a; }
        .wv-turtle .wv-info h2 { color: #1d3557; }
        .wv-turtle .wv-info p { color: #40566c; }
        .wv-turtle .wv-info strong { color: #14344f; }
        .wv-turtle .wv-kicker { color: #b07b26; }
        .wv-turtle .wv-feature-chips span { background: rgba(29,83,120,0.1); color: #1d5378; border-color: rgba(29,83,120,0.28); }
        .wv-turtle-art { flex: 1 1 380px; max-width: 480px; }
        .wv-turtle-svg { width: 100%; height: auto; }
        .wv-turtle-sun { animation: wvGlowPulse 8s ease-in-out infinite; transform-origin: 330px 180px; }
        .wv-turtle-bob { animation: wvTurtleBob 6s ease-in-out infinite; }
        @keyframes wvTurtleBob { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-9px); } }
        .wv-shell-rivers { stroke-dasharray: 14 20; animation: wvRiverFlow 5s linear infinite; }
        .wv-flowline { stroke-dasharray: 24 34; animation: wvRiverFlow 3.2s linear infinite; }
        .wv-flowline-d { animation-duration: 4.1s; }
        @keyframes wvRiverFlow { to { stroke-dashoffset: -116; } }
        .wv-ribbon { opacity: 0.9; }
        .wv-ribbon-1 { animation: wvRibbonSway 7s ease-in-out infinite alternate; }
        .wv-ribbon-2 { animation: wvRibbonSway 8.4s ease-in-out infinite alternate-reverse; }
        .wv-ribbon-3 { animation: wvRibbonSway 7.7s ease-in-out infinite alternate; }
        @keyframes wvRibbonSway { from { transform: translateX(-4px); } to { transform: translateX(5px); } }
        .wv-community-dot { animation: wvGlowPulse 3s ease-in-out infinite; transform-origin: center; transform-box: fill-box; }

        /* ═══ SCENE 4 · UNDERWATER ═════════════════════════════ */
        .wv-under { background: linear-gradient(180deg, #0d3a5c 0%, #0a2c4a 40%, #061d33 100%); }
        .wv-rays { position: absolute; inset: 0; overflow: hidden; }
        .wv-rays span {
          position: absolute; top: -12%; width: 130px; height: 75%;
          background: linear-gradient(180deg, rgba(160,220,255,0.16), transparent 82%);
          transform: skewX(-14deg); filter: blur(6px);
          animation: wvRayShift 9s ease-in-out infinite alternate;
        }
        .wv-rays span:nth-child(1) { left: 16%; }
        .wv-rays span:nth-child(2) { left: 44%; width: 180px; animation-delay: 2.2s; }
        .wv-rays span:nth-child(3) { left: 72%; width: 110px; animation-delay: 4.4s; }
        @keyframes wvRayShift { from { opacity: 0.5; transform: skewX(-14deg) translateX(0); } to { opacity: 1; transform: skewX(-11deg) translateX(26px); } }

        .wv-bubbles { position: absolute; inset: 0; pointer-events: none; }
        .wv-bubbles span {
          position: absolute; bottom: -22px; border-radius: 50%;
          background: radial-gradient(circle at 32% 30%, rgba(230,246,255,0.85), rgba(160,215,245,0.25));
          animation: wvBubbleUp 12s linear infinite;
        }
        @keyframes wvBubbleUp {
          0% { transform: translateY(0) translateX(0); opacity: 0; }
          8% { opacity: 0.9; }
          92% { opacity: 0.7; }
          100% { transform: translateY(-105vh) translateX(26px); opacity: 0; }
        }
        .wv-school { position: absolute; top: 30%; width: 250px; animation: wvSchoolCross 32s linear infinite; }
        @keyframes wvSchoolCross { from { left: -280px; } to { left: 108%; } }
        .wv-weeds { position: absolute; bottom: 0; left: 0; right: 0; height: 130px; }
        .wv-weed { position: absolute; bottom: -4px; width: 34px; transform-origin: bottom center;
          animation: wvWeedSway 5.5s ease-in-out infinite alternate; }
        @keyframes wvWeedSway { from { transform: rotate(-7deg); } to { transform: rotate(8deg); } }

        .wv-under-inner { flex-direction: column; gap: 34px; }
        .wv-card-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(230px, 1fr)); gap: 18px; width: min(960px, 90vw); }
        .wv-card {
          padding: 26px 24px; border-radius: 18px; color: #dcecfa;
          background: rgba(255,255,255,0.06); border: 1px solid rgba(150,210,250,0.22);
          backdrop-filter: blur(10px);
          transition: transform 0.25s ease, background 0.25s ease, border-color 0.25s ease;
        }
        .wv-card:hover { transform: translateY(-6px); background: rgba(255,255,255,0.1); border-color: rgba(150,210,250,0.45); }
        .wv-card svg { color: #7cc4ea; margin-bottom: 12px; }
        .wv-card h3 { margin: 0 0 8px; font-size: 17px; font-weight: 800; color: #fff; }
        .wv-card p { margin: 0; font-size: 13.5px; line-height: 1.65; color: #b6cee4; }

        /* ═══ SCENE 5 · NIGHT ══════════════════════════════════ */
        .wv-night { background: linear-gradient(180deg, #030814 0%, #071527 55%, #0a1e33 100%); }
        .wv-stars { position: absolute; inset: 0; }
        .wv-stars span { position: absolute; border-radius: 50%; background: #dbeafe;
          animation: wvTwinkle 3.4s ease-in-out infinite; }
        @keyframes wvTwinkle { 0%,100% { opacity: 0.25; } 50% { opacity: 1; } }
        .wv-aurora { position: absolute; inset: 0; overflow: hidden; }
        .wv-aurora span { position: absolute; top: 4%; height: 46%; border-radius: 50%; filter: blur(46px); opacity: 0.5; }
        .wv-aurora-1 { left: 6%; width: 34%; background: linear-gradient(180deg, #34d399, transparent);
          animation: wvAurora 11s ease-in-out infinite alternate; }
        .wv-aurora-2 { left: 36%; width: 30%; background: linear-gradient(180deg, #60a5fa, transparent);
          animation: wvAurora 14s ease-in-out infinite alternate-reverse; }
        .wv-aurora-3 { left: 62%; width: 32%; background: linear-gradient(180deg, #a78bfa, transparent);
          animation: wvAurora 12.5s ease-in-out 3s infinite alternate; }
        @keyframes wvAurora {
          from { transform: translateX(-36px) skewX(-6deg) scaleY(1); opacity: 0.35; }
          to   { transform: translateX(40px) skewX(5deg) scaleY(1.18); opacity: 0.62; }
        }
        .wv-moon {
          position: absolute; right: 14%; top: 13%;
          width: 74px; height: 74px; border-radius: 50%;
          background: radial-gradient(circle at 38% 36%, #fdfbf3, #e5dfc8 68%, #cfc7a8);
          box-shadow: 0 0 50px 14px rgba(240,235,200,0.3);
        }
        .wv-moonpath {
          position: absolute; right: calc(14% + 8px); top: 30%; width: 58px; height: 46%;
          background: linear-gradient(180deg, rgba(240,235,200,0.35), transparent 85%);
          filter: blur(9px);
          animation: wvMoonShimmer 5s ease-in-out infinite alternate;
        }
        @keyframes wvMoonShimmer { from { opacity: 0.5; transform: scaleX(0.85); } to { opacity: 0.9; transform: scaleX(1.12); } }
        .wv-night-wave { position: absolute; bottom: 0; left: 0; width: 100%; height: 110px; }
        .wv-night-content { position: relative; z-index: 5; text-align: center; padding: 0 22px; max-width: 620px; }
        .wv-night-content h2 { font-size: clamp(30px, 4.6vw, 52px); font-weight: 800; color: #f3f7fc; margin: 0 0 16px; }
        .wv-night-content p { font-size: 16.5px; line-height: 1.75; color: #b9cfe4; margin: 0 0 30px; }
        .wv-credits { margin-top: 40px; font-size: 12px; color: #5f7893; letter-spacing: 0.04em; }

        /* ── Small screens ─────────────────────────────────────── */
        @media (max-width: 760px) {
          .wv-pines { width: 42vw; bottom: 30vh; }
          .wv-dots { right: 8px; }
          .wv-scene-inner { gap: 26px; padding: 76px 0 66px; }
          .wv-info h2 { font-size: 24px; }
          .wv-lakes-art, .wv-turtle-art { max-width: 88vw; }
        }

        /* ── Reduced motion — freeze the world, keep the beauty ── */
        @media (prefers-reduced-motion: reduce) {
          .wv-root *, .wv-root *::before, .wv-root *::after {
            animation-duration: 0.001s !important;
            animation-iteration-count: 1 !important;
            transition-duration: 0.001s !important;
          }
          .wv-section .wv-info, .wv-section .wv-card-grid, .wv-section .wv-lakes-art,
          .wv-section .wv-turtle-art, .wv-section .wv-night-content { opacity: 1; transform: none; }
        }
      `}</style>
    </div>
  )
}
