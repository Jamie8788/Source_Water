/**
 * Welcome — cinematic scroll-driven landing experience (v2, "everything moves").
 *
 * Five full-viewport scenes with scroll-snap transitions. Every scene is a
 * living tableau: day-cycle sun, flocking birds, a canoe crossing with
 * paddle strokes and wake, boats sailing inside the Great Lakes on SVG
 * motion paths, animated connecting rivers, and a Turtle Island scene
 * modeled on Anishinaabe artwork — patterned shell with flowing waterways,
 * pines + signal towers standing on its back, a blinking eye, and braided
 * water ribbons flowing to the communities below.
 *
 * All inline SVG + CSS keyframes + SMIL animateMotion. No canvas, no RAF
 * loops, no image downloads, no new dependencies. Crossing animations use
 * transform (GPU-composited), never `left`. prefers-reduced-motion and the
 * global sw-no-anim kill-switch freeze everything.
 *
 * Route: "/" for signed-out visitors. Sign-in lives at /login.
 */
import { useEffect, useRef, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronDown, Droplets, Map as MapIcon, Users, Sparkles, BookOpen, BarChart3, ArrowRight } from 'lucide-react'

const SECTIONS = ['dawn', 'lakes', 'turtle', 'underwater', 'night']

// ─────────────────────────────────────────────────────────────────────────────
// Scene 1 — A full day on the lake (sun rises, crosses, sets — 70s loop)
// ─────────────────────────────────────────────────────────────────────────────
function Bird({ idx }) {
  return (
    <div className={`wv-birdpath wv-birdpath-${idx}`} aria-hidden="true">
      <div className="wv-birdbob">
        <svg className="wv-birdshape" viewBox="0 0 64 32">
          <path className="wv-wing" d="M4 20 Q16 4 32 15 Q48 4 60 20"
            fill="none" stroke="#1d2940" strokeWidth="4.5" strokeLinecap="round" />
        </svg>
      </div>
    </div>
  )
}

function SceneDawn({ onScrollNext, onSignIn }) {
  return (
    <section className="wv-section wv-dawn" data-scene="dawn">
      {/* Sky — dawn base + day overlay that brightens as the sun climbs */}
      <div className="wv-sky-dawn" aria-hidden="true" />
      <div className="wv-sky-day" aria-hidden="true" />

      {/* The sun — travels a full arc: rises stage left, peaks, sets stage right */}
      <div className="wv-sunarc-x" aria-hidden="true">
        <div className="wv-sunarc-y">
          <div className="wv-sun2">
            <div className="wv-sun2-core" />
          </div>
        </div>
      </div>

      {/* Clouds — three layers, different speeds and softness */}
      {[1, 2, 3].map(i => (
        <div key={i} className={`wv-cloudpath wv-cloudpath-${i}`} aria-hidden="true">
          <svg viewBox="0 0 220 60" className="wv-cloudshape">
            <ellipse cx="60" cy="40" rx="58" ry="17" fill="rgba(255,255,255,0.55)" />
            <ellipse cx="118" cy="30" rx="48" ry="15" fill="rgba(255,255,255,0.42)" />
            <ellipse cx="162" cy="42" rx="42" ry="12" fill="rgba(255,255,255,0.48)" />
          </svg>
        </div>
      ))}

      {/* A flock of five gulls crossing at different heights / speeds */}
      {[1, 2, 3, 4, 5].map(i => <Bird key={i} idx={i} />)}

      {/* Shoreline pines with a slow breeze sway */}
      <svg className="wv-pines wv-pines-left" viewBox="0 0 300 220" preserveAspectRatio="xMinYMax meet" aria-hidden="true">
        {[0, 55, 110, 165, 220].map((x, i) => (
          <g key={i} className="wv-pine-sway" style={{ animationDelay: `${i * 0.6}s` }} transform={`translate(${x}, ${28 + (i % 2) * 22})`}>
            <path d="M30 190 L30 90 M30 90 L8 140 L52 140 Z M30 70 L12 116 L48 116 Z M30 52 L16 94 L44 94 Z"
              fill="#122033" stroke="#122033" strokeWidth="6" strokeLinejoin="round" />
          </g>
        ))}
      </svg>
      <svg className="wv-pines wv-pines-right" viewBox="0 0 300 220" preserveAspectRatio="xMaxYMax meet" aria-hidden="true">
        {[20, 80, 140, 200].map((x, i) => (
          <g key={i} className="wv-pine-sway" style={{ animationDelay: `${0.3 + i * 0.7}s` }} transform={`translate(${x}, ${40 + (i % 2) * 26})`}>
            <path d="M30 180 L30 86 M30 86 L10 134 L50 134 Z M30 66 L14 110 L46 110 Z M30 50 L18 90 L42 90 Z"
              fill="#0e1a2b" stroke="#0e1a2b" strokeWidth="6" strokeLinejoin="round" />
          </g>
        ))}
      </svg>

      {/* Water — four parallax bands, sun glints, drifting mist */}
      <div className="wv-water" aria-hidden="true">
        <svg className="wv-wave wv-wave-4" viewBox="0 0 1440 90" preserveAspectRatio="none">
          <path d="M0,42 C120,18 240,66 360,42 C480,18 600,66 720,42 C840,18 960,66 1080,42 C1200,18 1320,66 1440,42 L1440,90 L0,90 Z" fill="#3a6f9e" />
        </svg>
        <svg className="wv-wave wv-wave-3" viewBox="0 0 1440 90" preserveAspectRatio="none">
          <path d="M0,45 C120,20 240,70 360,45 C480,20 600,70 720,45 C840,20 960,70 1080,45 C1200,20 1320,70 1440,45 L1440,90 L0,90 Z" fill="#2b5f8f" />
        </svg>

        {/* Canoe with paddler — crosses the whole lake, bobs, paddles, leaves a wake */}
        <div className="wv-canoepath">
          <div className="wv-canoerock">
            <svg className="wv-canoe2" viewBox="0 0 260 110">
              {/* wake ripples */}
              <ellipse className="wv-wake wv-wake-1" cx="40" cy="92" rx="26" ry="5" fill="none" stroke="rgba(220,240,255,0.5)" strokeWidth="2.5" />
              <ellipse className="wv-wake wv-wake-2" cx="26" cy="94" rx="16" ry="3.6" fill="none" stroke="rgba(220,240,255,0.4)" strokeWidth="2" />
              {/* hull */}
              <path d="M22 74 Q130 108 238 74 L222 90 Q130 116 38 90 Z" fill="#5b3a1e" stroke="#33200e" strokeWidth="4" />
              <path d="M28 78 Q130 104 232 78" fill="none" stroke="#7a5028" strokeWidth="3" />
              {/* paddler */}
              <circle cx="132" cy="46" r="11" fill="#27324a" />
              <path d="M132 57 L132 76" stroke="#27324a" strokeWidth="7" strokeLinecap="round" />
              {/* animated paddle — rotates around the paddler's hands */}
              <g className="wv-paddle">
                <path d="M132 62 L102 44" stroke="#27324a" strokeWidth="6" strokeLinecap="round" />
                <path d="M132 62 L164 86" stroke="#8a5a2b" strokeWidth="5.5" strokeLinecap="round" />
                <ellipse cx="170" cy="91" rx="8" ry="13" fill="#8a5a2b" transform="rotate(38 170 91)" />
              </g>
            </svg>
          </div>
        </div>

        {/* Fish leaping — twice per cycle, opposite sides */}
        <svg className="wv-fish-jump wv-fish-a" viewBox="0 0 60 40" aria-hidden="true">
          <path d="M8 24 Q22 8 40 16 Q34 22 40 28 Q22 34 8 24 Z" fill="#3d7ea6" />
          <path d="M40 16 L52 10 L48 22 L52 32 L40 28" fill="#356e91" />
          <circle cx="16" cy="20" r="2" fill="#0f2233" />
        </svg>
        <svg className="wv-fish-jump wv-fish-b" viewBox="0 0 60 40" aria-hidden="true">
          <path d="M8 24 Q22 8 40 16 Q34 22 40 28 Q22 34 8 24 Z" fill="#4a90b8" />
          <path d="M40 16 L52 10 L48 22 L52 32 L40 28" fill="#3d7ea6" />
          <circle cx="16" cy="20" r="2" fill="#0f2233" />
        </svg>

        {/* Sun glints dancing on the surface */}
        <div className="wv-glints">
          {Array.from({ length: 8 }).map((_, i) => (
            <span key={i} style={{ left: `${8 + i * 12}%`, animationDelay: `${i * 0.9}s` }} />
          ))}
        </div>

        <svg className="wv-wave wv-wave-2" viewBox="0 0 1440 90" preserveAspectRatio="none">
          <path d="M0,50 C180,25 300,72 480,50 C660,28 780,72 960,50 C1140,28 1260,72 1440,50 L1440,90 L0,90 Z" fill="#1f4a73" />
        </svg>
        <svg className="wv-wave wv-wave-1" viewBox="0 0 1440 90" preserveAspectRatio="none">
          <path d="M0,55 C160,35 320,75 480,55 C640,35 800,75 960,55 C1120,35 1280,75 1440,55 L1440,90 L0,90 Z" fill="#153756" />
        </svg>
        <div className="wv-mist" />
        <div className="wv-mist wv-mist-2" />
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
// Scene 2 — The Great Lakes, alive: shimmer, sailing boats, connecting rivers
// ─────────────────────────────────────────────────────────────────────────────
const LAKE_SITES = [
  { x: 180, y: 150 }, { x: 265, y: 112 }, { x: 350, y: 140 }, { x: 425, y: 152 },  // Superior
  { x: 296, y: 300 }, { x: 306, y: 392 },                                          // Michigan
  { x: 452, y: 262 }, { x: 512, y: 236 }, { x: 566, y: 206 },                      // Huron + Georgian Bay
  { x: 590, y: 392 }, { x: 664, y: 380 },                                          // Erie
  { x: 742, y: 300 }, { x: 808, y: 292 },                                          // Ontario
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
              <radialGradient id="wvLand" cx="45%" cy="45%" r="70%">
                <stop offset="0%" stopColor="#14314e" />
                <stop offset="100%" stopColor="#0d2238" />
              </radialGradient>
            </defs>

            {/* Landmass context so the lakes sit in geography, not a void */}
            <path d="M40 60 C220 12 560 6 760 46 C860 66 890 140 878 240 C868 330 880 420 830 480 C740 540 520 552 340 540 C200 530 90 500 58 420 C30 340 26 220 40 60 Z"
              fill="url(#wvLand)" opacity="0.9" />

            {/* Lake Superior — the big whale, west hook */}
            <path className="wv-lake-shape" style={{ animationDelay: '0s' }} fill="url(#wvLake)"
              d="M95 178 C110 132 190 92 292 78 C372 68 442 88 470 118 C498 146 486 170 448 178 C398 188 348 176 306 190 C252 208 168 214 122 200 C100 192 88 186 95 178 Z" />
            {/* Lake Michigan — the vertical one */}
            <path className="wv-lake-shape" style={{ animationDelay: '0.4s' }} fill="url(#wvLake)"
              d="M298 238 C284 232 274 250 272 288 C270 334 274 394 288 430 C296 452 316 458 326 438 C338 412 334 350 328 302 C324 268 314 246 298 238 Z" />
            {/* Lake Huron — with the Georgian Bay lobe */}
            <path className="wv-lake-shape" style={{ animationDelay: '0.8s' }} fill="url(#wvLake)"
              d="M388 240 C420 204 468 192 504 206 C518 180 556 170 582 186 C606 202 598 232 576 244 C586 274 576 308 548 328 C512 352 458 344 434 312 C416 288 400 264 388 240 Z" />
            {/* Lake Erie — the shallow diagonal */}
            <path className="wv-lake-shape" style={{ animationDelay: '1.2s' }} fill="url(#wvLake)"
              d="M528 392 C566 366 644 352 702 362 C730 368 736 384 712 396 C666 418 590 424 548 412 C526 406 518 398 528 392 Z" />
            {/* Lake Ontario — the bean */}
            <path className="wv-lake-shape" style={{ animationDelay: '1.6s' }} fill="url(#wvLake)"
              d="M706 302 C734 282 792 274 832 286 C858 294 858 310 832 320 C792 332 734 328 710 316 C698 310 698 307 706 302 Z" />

            {/* Water shimmer — flowing current lines inside each lake */}
            <g fill="none" stroke="rgba(180,225,255,0.5)" strokeWidth="2.6" strokeLinecap="round" className="wv-lakeflow-g">
              <path className="wv-lakeflow" d="M140 168 C220 138 330 122 430 140" />
              <path className="wv-lakeflow wv-lakeflow-d2" d="M286 290 C290 330 292 380 302 416" />
              <path className="wv-lakeflow wv-lakeflow-d3" d="M420 272 C460 250 520 240 560 250" />
              <path className="wv-lakeflow wv-lakeflow-d2" d="M552 398 C610 382 668 376 700 380" />
              <path className="wv-lakeflow wv-lakeflow-d3" d="M718 306 C760 296 800 296 824 302" />
            </g>

            {/* The water road — animated rivers connecting the chain:
                Superior → (St. Marys / Baawaating) → Huron → Erie → Ontario */}
            <g fill="none" stroke="#5eead4" strokeWidth="3.4" strokeLinecap="round" opacity="0.75">
              <path className="wv-river" d="M462 160 C486 178 498 196 500 216" />
              <path className="wv-river wv-river-d2" d="M540 330 C548 352 546 372 552 394" />
              <path className="wv-river wv-river-d3" d="M710 388 C726 372 726 340 716 320" />
            </g>

            {/* Two boats sailing on motion paths inside the lakes */}
            <g className="wv-boat">
              <path d="M-11 3 L11 3 L7 9 L-7 9 Z" fill="#e8d9b0" stroke="#0d2238" strokeWidth="1.4" />
              <path d="M0 3 L0 -12 L9 -3 Z" fill="#f4ead0" stroke="#0d2238" strokeWidth="1.2" />
              <animateMotion dur="42s" repeatCount="indefinite" rotate="auto"
                path="M150 165 C230 130 340 118 430 142 C350 165 240 178 150 165 Z" />
            </g>
            <g className="wv-boat">
              <path d="M-10 3 L10 3 L6 8 L-6 8 Z" fill="#e8d9b0" stroke="#0d2238" strokeWidth="1.4" />
              <path d="M0 3 L0 -11 L8 -3 Z" fill="#f4ead0" stroke="#0d2238" strokeWidth="1.2" />
              <animateMotion dur="34s" repeatCount="indefinite" rotate="auto"
                path="M430 280 C470 258 520 252 552 282 C520 310 460 310 430 280 Z" />
            </g>

            {/* Lake labels */}
            <g className="wv-lake-labels" fontFamily="Georgia, serif" fontStyle="italic" fill="#9fc6e8">
              <text x="230" y="146" fontSize="19">Superior</text>
              <text x="316" y="330" fontSize="14" transform="rotate(80 316 330)">Michigan</text>
              <text x="448" y="286" fontSize="16">Huron</text>
              <text x="596" y="392" fontSize="15">Erie</text>
              <text x="748" y="308" fontSize="14">Ontario</text>
              <text x="470" y="132" fontSize="11" fill="#5eead4" fontStyle="normal" fontWeight="700">Baawaating</text>
            </g>

            {/* Pulsing monitoring sites with sonar rings */}
            {LAKE_SITES.map((s, i) => (
              <g key={i} className="wv-site" style={{ animationDelay: `${i * 0.3}s` }}>
                <circle cx={s.x} cy={s.y} r="4.6" fill="#5eead4" />
                <circle cx={s.x} cy={s.y} r="4.6" fill="none" stroke="#5eead4" strokeWidth="2" className="wv-site-ring" style={{ animationDelay: `${i * 0.3}s` }} />
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
// Scene 3 — Turtle Island, faithful to the artwork: patterned shell carrying
// pines + signal towers, blinking eye, braided ribbons flowing to communities
// ─────────────────────────────────────────────────────────────────────────────
function SceneTurtle({ onScrollNext }) {
  return (
    <section className="wv-section wv-turtle" data-scene="turtle">
      <div className="wv-scene-inner wv-scene-reverse">
        <div className="wv-turtle-art" aria-hidden="true">
          <svg viewBox="0 0 560 720" className="wv-turtle-svg">
            <defs>
              <radialGradient id="wvSun2" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#ffefad" />
                <stop offset="70%" stopColor="#f6d36b" />
                <stop offset="100%" stopColor="#edc14b" />
              </radialGradient>
              <linearGradient id="wvShell" x1="0" y1="0" x2="0.2" y2="1">
                <stop offset="0%" stopColor="#8fc06f" />
                <stop offset="50%" stopColor="#5a9c58" />
                <stop offset="100%" stopColor="#37704a" />
              </linearGradient>
              <linearGradient id="wvRibbonFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#a9d7f2" />
                <stop offset="100%" stopColor="#5d9fd4" />
              </linearGradient>
            </defs>

            {/* Sun with slow-rotating rays */}
            <g className="wv-rays2">
              {Array.from({ length: 12 }).map((_, i) => (
                <line key={i} x1="360" y1="52" x2="360" y2="76"
                  stroke="#eec14f" strokeWidth="5" strokeLinecap="round" opacity="0.5"
                  transform={`rotate(${i * 30} 360 212)`} />
              ))}
            </g>
            <circle cx="360" cy="212" r="146" fill="url(#wvSun2)" className="wv-turtle-sun" />

            {/* Waterline the turtle floats on */}
            <rect x="0" y="392" width="560" height="16" fill="rgba(120,180,220,0.35)" />
            <path d="M0 396 C90 388 180 402 280 394 C380 386 470 402 560 394" fill="none" stroke="rgba(70,130,180,0.5)" strokeWidth="3" className="wv-waterline" />
            {/* Reflection shadow */}
            <ellipse cx="290" cy="404" rx="185" ry="12" fill="rgba(30,60,90,0.16)" />

            {/* ═══ THE TURTLE ═══ (gentle bob as one body) */}
            <g className="wv-turtle-bob">
              {/* Tail */}
              <path d="M452 372 C472 362 484 366 488 378 C484 388 468 392 452 388 Z"
                fill="#5da35f" stroke="#17301f" strokeWidth="7" strokeLinejoin="round" />

              {/* Neck + head, facing left, gazing slightly up */}
              <path d="M152 348 C120 336 96 308 86 276 C80 256 84 240 98 231 C114 221 134 226 144 243 C152 257 154 274 162 292 Z"
                fill="#5da35f" stroke="#17301f" strokeWidth="8" strokeLinejoin="round" />
              {/* head */}
              <path d="M62 252 C54 232 62 212 84 205 C106 198 126 208 132 226 C137 243 128 259 108 264 C88 269 70 266 62 252 Z"
                fill="#6bb06a" stroke="#17301f" strokeWidth="8" strokeLinejoin="round" />
              {/* neck rings */}
              <path d="M118 268 C128 262 138 260 148 262 M108 288 C120 280 134 277 148 280"
                fill="none" stroke="#2c5137" strokeWidth="4" strokeLinecap="round" />
              {/* eye + blink + brow */}
              <circle cx="88" cy="230" r="7.5" fill="#122417" />
              <circle cx="90.5" cy="227.5" r="2.6" fill="#e9f5da" />
              <rect className="wv-eyelid" x="78" y="221" width="21" height="18" rx="9" fill="#6bb06a" />
              <path d="M74 216 C82 210 94 209 102 213" fill="none" stroke="#17301f" strokeWidth="3.5" strokeLinecap="round" />
              {/* mouth */}
              <path d="M64 246 C72 252 82 254 92 252" fill="none" stroke="#17301f" strokeWidth="3.5" strokeLinecap="round" />

              {/* Front + back legs, patterned, at the waterline */}
              <g>
                <path d="M182 392 C176 424 182 448 198 456 C214 462 226 450 224 426 L220 394 Z"
                  fill="#5da35f" stroke="#17301f" strokeWidth="7" strokeLinejoin="round" />
                <path d="M196 448 L192 460 M206 452 L204 464 M216 448 L218 460" stroke="#17301f" strokeWidth="3.4" strokeLinecap="round" />
                <circle cx="200" cy="416" r="4" fill="#2c5137" /><circle cx="212" cy="430" r="3.4" fill="#2c5137" />
              </g>
              <g>
                <path d="M368 394 C362 428 368 452 386 458 C404 464 416 450 412 424 L408 396 Z"
                  fill="#5da35f" stroke="#17301f" strokeWidth="7" strokeLinejoin="round" />
                <path d="M382 450 L378 462 M392 454 L390 466 M402 450 L404 462" stroke="#17301f" strokeWidth="3.4" strokeLinecap="round" />
                <circle cx="386" cy="420" r="4" fill="#2c5137" /><circle cx="398" cy="434" r="3.4" fill="#2c5137" />
              </g>

              {/* ═══ SHELL — the island ═══ */}
              <path d="M124 394 C118 300 186 208 300 198 C408 190 468 274 466 368 C466 386 456 394 438 394 Z"
                fill="url(#wvShell)" stroke="#17301f" strokeWidth="9" strokeLinejoin="round" />

              {/* Shell map — tan land patch + flowing blue waterways (animated) */}
              <path d="M330 240 C376 236 416 262 432 300 C438 322 428 338 402 340 C368 342 336 324 324 292 C316 268 316 248 330 240 Z"
                fill="#d9c079" opacity="0.75" />
              <g fill="none" strokeLinecap="round">
                <path d="M150 330 C210 292 296 280 362 300 C406 312 436 332 450 350"
                  stroke="#8fcae8" strokeWidth="15" opacity="0.85" />
                <path className="wv-shellflow" d="M150 330 C210 292 296 280 362 300 C406 312 436 332 450 350"
                  stroke="rgba(240,250,255,0.9)" strokeWidth="3.2" />
                <path d="M176 270 C232 236 318 228 384 250"
                  stroke="#8fcae8" strokeWidth="12" opacity="0.8" />
                <path className="wv-shellflow wv-shellflow-d2" d="M176 270 C232 236 318 228 384 250"
                  stroke="rgba(240,250,255,0.85)" strokeWidth="2.8" />
                <path d="M212 226 C258 206 316 202 356 214"
                  stroke="#8fcae8" strokeWidth="9" opacity="0.7" />
              </g>

              {/* Scute rim — the plated band along the shell bottom */}
              <path d="M134 356 L456 356" stroke="#17301f" strokeWidth="6" strokeLinecap="round" />
              {[158, 196, 234, 272, 310, 348, 386, 424].map((x, i) => (
                <line key={i} x1={x} y1="358" x2={x + 6} y2="392" stroke="#17301f" strokeWidth="5" strokeLinecap="round" />
              ))}
              {/* rim highlight dots like the artwork's beadwork */}
              {[148, 186, 224, 262, 300, 338, 376, 414, 446].map((x, i) => (
                <circle key={i} cx={x} cy="375" r="4.5" fill="#c8e6a5" opacity="0.85" />
              ))}

              {/* ═══ The land the turtle carries: pines + signal towers ═══ */}
              <g className="wv-carried" fill="#14231c">
                {/* pine 1 */}
                <path d="M236 198 L236 154 L220 186 L252 186 Z M236 146 L223 172 L249 172 Z M236 138 L227 158 L245 158 Z" />
                {/* signal tower 1 (like the artwork's spires) */}
                <g stroke="#14231c" strokeWidth="4.5" strokeLinecap="round" fill="none">
                  <path d="M282 196 L282 118" />
                  <path d="M268 132 L296 132 M272 148 L292 148 M276 164 L288 164" />
                  <circle cx="282" cy="112" r="4" fill="#14231c" />
                </g>
                {/* pine 2 */}
                <path d="M322 196 L322 158 L308 186 L336 186 Z M322 150 L311 174 L333 174 Z" />
                {/* signal tower 2, shorter */}
                <g stroke="#14231c" strokeWidth="4" strokeLinecap="round" fill="none">
                  <path d="M362 200 L362 140" />
                  <path d="M350 152 L374 152 M354 168 L370 168" />
                  <circle cx="362" cy="135" r="3.4" fill="#14231c" />
                </g>
                {/* pine 3, small */}
                <path d="M398 204 L398 172 L386 196 L410 196 Z M398 165 L389 184 L407 184 Z" />
              </g>
            </g>

            {/* ═══ Braided water ribbons flowing from the island down to communities ═══ */}
            <g strokeLinejoin="round">
              {/* Ribbon 1 — left */}
              <g className="wv-ribbon-sway wv-rs-1">
                <path d="M148 400 C120 460 158 512 128 574 C112 610 126 650 106 700 L170 700 C186 652 170 612 188 576 C214 516 172 462 200 402 Z"
                  fill="url(#wvRibbonFill)" stroke="#1d3a52" strokeWidth="7" />
                <path className="wv-flow2" d="M170 404 C144 462 178 514 150 574 C136 610 148 652 136 698" fill="none" stroke="rgba(245,252,255,0.95)" strokeWidth="3.4" strokeLinecap="round" />
                <path className="wv-flow2 wv-flow2-d2" d="M186 402 C162 460 194 514 168 576 C154 612 166 654 154 698" fill="none" stroke="rgba(245,252,255,0.7)" strokeWidth="2.6" strokeLinecap="round" />
              </g>
              {/* Ribbon 2 — centre, widest */}
              <g className="wv-ribbon-sway wv-rs-2">
                <path d="M258 404 C240 470 276 522 252 586 C240 620 252 660 240 702 L318 702 C330 660 318 622 332 586 C356 524 316 472 336 406 Z"
                  fill="url(#wvRibbonFill)" stroke="#1d3a52" strokeWidth="7" />
                <path className="wv-flow2 wv-flow2-d3" d="M282 406 C264 472 298 524 276 588 C264 622 276 662 266 700" fill="none" stroke="rgba(245,252,255,0.95)" strokeWidth="3.6" strokeLinecap="round" />
                <path className="wv-flow2" d="M306 406 C290 470 322 524 300 588 C288 622 300 662 292 700" fill="none" stroke="rgba(245,252,255,0.7)" strokeWidth="2.8" strokeLinecap="round" />
              </g>
              {/* Ribbon 3 — right */}
              <g className="wv-ribbon-sway wv-rs-3">
                <path d="M392 402 C420 464 388 516 420 578 C438 612 426 652 444 700 L378 700 C364 652 376 614 360 578 C334 518 372 464 348 404 Z"
                  fill="url(#wvRibbonFill)" stroke="#1d3a52" strokeWidth="7" />
                <path className="wv-flow2 wv-flow2-d2" d="M372 404 C396 464 366 518 396 578 C412 612 402 654 414 698" fill="none" stroke="rgba(245,252,255,0.95)" strokeWidth="3.4" strokeLinecap="round" />
              </g>
            </g>

            {/* Floating stones between the ribbons (from the artwork) */}
            {[
              { x: 96, y: 500, s: 1 }, { x: 226, y: 548, s: 0.8 }, { x: 346, y: 500, s: 0.9 },
              { x: 466, y: 560, s: 1.05 }, { x: 210, y: 652, s: 0.7 },
            ].map((p, i) => (
              <path key={i} className="wv-stone" style={{ animationDelay: `${i * 0.8}s` }}
                d={`M${p.x} ${p.y} L${p.x + 34 * p.s} ${p.y + 8 * p.s} L${p.x + 12 * p.s} ${p.y + 30 * p.s} Z`}
                fill="rgba(255,255,255,0.5)" stroke="#2a4a63" strokeWidth="4.5" strokeLinejoin="round" />
            ))}

            {/* Sparkles */}
            {[{ x: 130, y: 470 }, { x: 320, y: 640 }, { x: 440, y: 480 }].map((p, i) => (
              <path key={i} className="wv-sparkle" style={{ animationDelay: `${i * 1.1}s` }}
                d={`M${p.x} ${p.y - 9} L${p.x + 2.5} ${p.y - 2.5} L${p.x + 9} ${p.y} L${p.x + 2.5} ${p.y + 2.5} L${p.x} ${p.y + 9} L${p.x - 2.5} ${p.y + 2.5} L${p.x - 9} ${p.y} L${p.x - 2.5} ${p.y - 2.5} Z`}
                fill="#fff" opacity="0.8" />
            ))}

            {/* Community dots the water reaches — golden, pulsing */}
            {[{ x: 138, y: 706 }, { x: 279, y: 708 }, { x: 411, y: 706 }].map((p, i) => (
              <g key={i} className="wv-community-dot" style={{ animationDelay: `${i * 0.5}s` }}>
                <circle cx={p.x} cy={p.y} r="10" fill="#f0c64f" stroke="#17301f" strokeWidth="3.4" />
                <circle cx={p.x} cy={p.y} r="10" fill="none" stroke="#f0c64f" strokeWidth="2" className="wv-site-ring" style={{ animationDelay: `${i * 0.5}s` }} />
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
      <div className="wv-rays" aria-hidden="true"><span /><span /><span /></div>
      <div className="wv-bubbles" aria-hidden="true">
        {Array.from({ length: 12 }).map((_, i) => (
          <span key={i} style={{ left: `${5 + i * 8}%`, animationDelay: `${i * 1.2}s`, width: 6 + (i % 4) * 4, height: 6 + (i % 4) * 4 }} />
        ))}
      </div>
      <div className="wv-schoolpath" aria-hidden="true">
        <svg className="wv-school" viewBox="0 0 300 120">
          {[0, 1, 2, 3, 4].map(i => (
            <g key={i} transform={`translate(${i * 52}, ${(i % 2) * 30 + 12}) scale(${1 - i * 0.08})`} className="wv-school-fish" style={{ animationDelay: `${i * 0.22}s` }}>
              <path d="M8 24 Q22 10 40 17 Q34 23 40 29 Q22 36 8 24 Z" fill="rgba(140,200,235,0.55)" />
              <path d="M40 17 L52 11 L48 23 L52 33 L40 29" fill="rgba(120,180,220,0.5)" />
            </g>
          ))}
        </svg>
      </div>
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
      <div className="wv-stars" aria-hidden="true">
        {Array.from({ length: 42 }).map((_, i) => (
          <span key={i} style={{
            left: `${(i * 37) % 100}%`, top: `${(i * 23) % 55}%`,
            animationDelay: `${(i % 7) * 0.8}s`,
            width: i % 5 === 0 ? 3 : 2, height: i % 5 === 0 ? 3 : 2,
          }} />
        ))}
      </div>
      <div className="wv-aurora" aria-hidden="true">
        <span className="wv-aurora-1" /><span className="wv-aurora-2" /><span className="wv-aurora-3" />
      </div>
      <div className="wv-moon" aria-hidden="true" />
      <div className="wv-moonpath" aria-hidden="true" />
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
      <div className="wv-topbar">
        <div className="wv-brand">
          <Droplets size={20} />
          <span>SOURCE <em>Water</em></span>
        </div>
        <button className="wv-cta wv-cta-small" onClick={goSignIn}>Sign in</button>
      </div>

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
          position: absolute; bottom: 20px; left: 50%; transform: translateX(-50%);
          display: flex; flex-direction: column; align-items: center; gap: 2px;
          background: none; border: none; cursor: pointer; color: rgba(230,242,255,0.8);
          font-size: 11px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase;
          animation: wvHintBob 2.2s ease-in-out infinite; z-index: 8;
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

        /* ═══ SCENE 1 · A FULL DAY ON THE LAKE ═════════════════ */
        .wv-dawn { background: #2c3e6b; }
        .wv-sky-dawn {
          position: absolute; inset: 0;
          background: linear-gradient(180deg, #2c3e6b 0%, #7b5a86 34%, #e8956d 58%, #f5b978 72%);
        }
        /* Day overlay brightens + fades in sync with the 70s sun arc */
        .wv-sky-day {
          position: absolute; inset: 0;
          background: linear-gradient(180deg, #6aa9d8 0%, #9cc8e8 44%, #ffd9a0 68%, #ffe9bd 76%);
          animation: wvDayCycle 70s ease-in-out infinite;
        }
        @keyframes wvDayCycle {
          0% { opacity: 0; } 28% { opacity: 1; } 62% { opacity: 1; } 92% { opacity: 0; } 100% { opacity: 0; }
        }

        /* Sun: outer div sweeps X linearly, inner rises/falls — a real arc */
        .wv-sunarc-x {
          position: absolute; left: 50%; bottom: 33vh; z-index: 1;
          animation: wvSunX 70s linear infinite;
        }
        @keyframes wvSunX {
          0% { transform: translateX(-42vw); }
          100% { transform: translateX(42vw); }
        }
        .wv-sunarc-y { animation: wvSunY 70s ease-in-out infinite; }
        @keyframes wvSunY {
          0%   { transform: translateY(15vh); }
          16%  { transform: translateY(-4vh); }
          50%  { transform: translateY(-20vh); }
          84%  { transform: translateY(-4vh); }
          100% { transform: translateY(15vh); }
        }
        .wv-sun2 { position: relative; width: 120px; height: 120px; margin-left: -60px; }
        .wv-sun2-core {
          width: 100%; height: 100%; border-radius: 50%;
          background: radial-gradient(circle, #fff3c9 0%, #ffd977 55%, #f7b64e 100%);
          box-shadow: 0 0 70px 26px rgba(255,205,110,0.55);
          animation: wvGlowPulse 6s ease-in-out infinite;
        }
        @keyframes wvGlowPulse { 0%,100% { opacity: 0.85; transform: scale(1); } 50% { opacity: 1; transform: scale(1.06); } }

        /* Clouds — GPU transform crossing, three depths */
        .wv-cloudpath { position: absolute; left: 0; z-index: 2; transform: translateX(-20vw); }
        .wv-cloudpath-1 { top: 10%; animation: wvCross 55s linear infinite; }
        .wv-cloudpath-2 { top: 20%; animation: wvCross 78s linear 12s infinite; }
        .wv-cloudpath-3 { top: 30%; animation: wvCross 95s linear 30s infinite; }
        .wv-cloudshape { width: 250px; filter: blur(1.5px); opacity: 0.9; }
        .wv-cloudpath-2 .wv-cloudshape { width: 180px; opacity: 0.7; }
        .wv-cloudpath-3 .wv-cloudshape { width: 140px; opacity: 0.55; filter: blur(2.5px); }
        @keyframes wvCross { from { transform: translateX(-22vw); } to { transform: translateX(115vw); } }

        /* Birds — visible, flapping, bobbing, five of them */
        .wv-birdpath { position: absolute; left: 0; z-index: 3; }
        .wv-birdpath-1 { top: 14%; animation: wvCross 24s linear infinite; }
        .wv-birdpath-2 { top: 19%; animation: wvCross 30s linear 5s infinite; }
        .wv-birdpath-3 { top: 11%; animation: wvCross 27s linear 11s infinite; }
        .wv-birdpath-4 { top: 24%; animation: wvCross 34s linear 17s infinite; }
        .wv-birdpath-5 { top: 8%;  animation: wvCross 22s linear 26s infinite; }
        .wv-birdbob { animation: wvBirdBob 3.2s ease-in-out infinite alternate; }
        @keyframes wvBirdBob { from { transform: translateY(0); } to { transform: translateY(-16px); } }
        .wv-birdshape { width: 58px; height: 29px; overflow: visible; }
        .wv-birdpath-2 .wv-birdshape { width: 44px; }
        .wv-birdpath-3 .wv-birdshape { width: 66px; }
        .wv-birdpath-4 .wv-birdshape { width: 38px; }
        .wv-birdpath-5 .wv-birdshape { width: 30px; }
        .wv-wing {
          transform-box: fill-box; transform-origin: center;
          animation: wvFlap 0.7s ease-in-out infinite alternate;
        }
        @keyframes wvFlap { from { transform: scaleY(1); } to { transform: scaleY(0.35); } }

        .wv-pines { position: absolute; bottom: 27vh; width: min(28vw, 320px); z-index: 3; opacity: 0.95; }
        .wv-pines-left { left: 0; }
        .wv-pines-right { right: 0; }
        .wv-pine-sway { transform-box: fill-box; transform-origin: bottom center;
          animation: wvPineSway 6s ease-in-out infinite alternate; }
        @keyframes wvPineSway { from { transform: rotate(-1.2deg); } to { transform: rotate(1.4deg); } }

        .wv-water { position: absolute; left: 0; right: 0; bottom: 0; height: 36vh; z-index: 4; }
        .wv-wave { position: absolute; left: -8%; width: 116%; height: 40%; }
        .wv-wave-4 { bottom: 30%; animation: wvSway 12s ease-in-out infinite alternate; opacity: 0.9; }
        .wv-wave-3 { bottom: 20%; animation: wvSway 9s ease-in-out infinite alternate-reverse; }
        .wv-wave-2 { bottom: 9%; animation: wvSway 7s ease-in-out infinite alternate; }
        .wv-wave-1 { bottom: 0; animation: wvSway 11s ease-in-out infinite alternate-reverse; }
        @keyframes wvSway { from { transform: translateX(0); } to { transform: translateX(-56px); } }

        /* Canoe — full crossing, rocking hull, stroking paddle, rippling wake */
        .wv-canoepath { position: absolute; bottom: 34%; left: 0; z-index: 5; animation: wvCross 65s linear infinite; }
        .wv-canoerock { animation: wvCanoeRock 4.2s ease-in-out infinite alternate; transform-origin: center bottom; }
        @keyframes wvCanoeRock { from { transform: translateY(0) rotate(-1.8deg); } to { transform: translateY(9px) rotate(2deg); } }
        .wv-canoe2 { width: 210px; overflow: visible; }
        .wv-paddle { transform-box: fill-box; transform-origin: 132px 62px;
          animation: wvPaddleStroke 1.7s ease-in-out infinite; }
        @keyframes wvPaddleStroke {
          0%, 100% { transform: rotate(-14deg); }
          45% { transform: rotate(20deg); }
          60% { transform: rotate(16deg); }
        }
        .wv-wake { transform-box: fill-box; transform-origin: center; }
        .wv-wake-1 { animation: wvWakeRipple 2.4s ease-out infinite; }
        .wv-wake-2 { animation: wvWakeRipple 2.4s ease-out 0.7s infinite; }
        @keyframes wvWakeRipple { 0% { transform: scale(0.4); opacity: 0.8; } 100% { transform: scale(1.6); opacity: 0; } }

        .wv-fish-jump {
          position: absolute; width: 46px; z-index: 5;
          transform-origin: bottom center; opacity: 0;
        }
        .wv-fish-a { bottom: 34%; left: 66%; animation: wvJump 11s ease-in-out infinite; }
        .wv-fish-b { bottom: 30%; left: 24%; width: 36px; animation: wvJump 11s ease-in-out 5.4s infinite; }
        @keyframes wvJump {
          0%, 76%, 100% { opacity: 0; transform: translateY(26px) rotate(0deg); }
          80% { opacity: 1; transform: translateY(-44px) rotate(-26deg); }
          85% { opacity: 1; transform: translateY(-58px) rotate(4deg); }
          90% { opacity: 0; transform: translateY(20px) rotate(34deg); }
        }

        .wv-glints { position: absolute; bottom: 26%; left: 0; right: 0; height: 20px; z-index: 5; }
        .wv-glints span {
          position: absolute; top: 0; width: 34px; height: 3.4px; border-radius: 3px;
          background: linear-gradient(90deg, transparent, rgba(255,240,200,0.85), transparent);
          animation: wvGlint 4.5s ease-in-out infinite;
        }
        @keyframes wvGlint {
          0%, 100% { opacity: 0; transform: translateX(0) scaleX(0.5); }
          50% { opacity: 1; transform: translateX(18px) scaleX(1.25); }
        }

        .wv-mist {
          position: absolute; bottom: 26%; left: 0; right: 0; height: 56px;
          background: linear-gradient(180deg, transparent, rgba(235,240,248,0.2), transparent);
          filter: blur(8px);
          animation: wvMistDrift 18s ease-in-out infinite alternate;
        }
        .wv-mist-2 { bottom: 14%; height: 40px; opacity: 0.7; animation-duration: 24s; animation-direction: alternate-reverse; }
        @keyframes wvMistDrift { from { transform: translateX(-46px); } to { transform: translateX(56px); } }

        .wv-hero { position: relative; z-index: 6; text-align: center; padding: 0 20px 10vh; max-width: 760px; }
        .wv-badge {
          display: inline-flex; align-items: center; gap: 8px;
          padding: 8px 18px; border-radius: 999px; margin-bottom: 24px;
          font-size: 12px; font-weight: 800; letter-spacing: 0.12em; text-transform: uppercase;
          color: #eaf6ff; background: rgba(10,25,45,0.45); border: 1px solid rgba(255,255,255,0.25);
          backdrop-filter: blur(8px);
        }
        .wv-live-dot { width: 8px; height: 8px; border-radius: 50%; background: #4ade80;
          animation: wvGlowPulse 2s ease-in-out infinite; }
        .wv-title {
          margin: 0 0 18px; font-size: clamp(42px, 7vw, 78px); font-weight: 800;
          line-height: 1.02; color: #fdfaf3; letter-spacing: -0.02em;
          text-shadow: 0 6px 40px rgba(20,30,60,0.45);
        }
        .wv-title span {
          background: linear-gradient(100deg, #8fd7ff 10%, #5eead4 90%);
          -webkit-background-clip: text; background-clip: text; color: transparent;
        }
        .wv-sub { font-size: clamp(15px, 1.8vw, 18px); line-height: 1.7; color: #f3ead9;
          max-width: 560px; margin: 0 auto 28px; text-shadow: 0 2px 16px rgba(20,30,60,0.5); }
        .wv-cta-row { display: flex; gap: 14px; justify-content: center; flex-wrap: wrap; }

        /* ═══ SCENE 2 · LAKES ══════════════════════════════════ */
        .wv-lakes { background: radial-gradient(ellipse at 50% 0%, #12365a 0%, #0a1e35 55%, #061426 100%); }
        .wv-lakes-art { flex: 1 1 440px; max-width: 640px; }
        .wv-lakes-svg { width: 100%; height: auto; filter: drop-shadow(0 12px 44px rgba(20,90,150,0.35)); }
        .wv-lake-shape { animation: wvLakeBreathe 7s ease-in-out infinite; }
        @keyframes wvLakeBreathe { 0%,100% { opacity: 0.92; } 50% { opacity: 1; } }
        .wv-lakeflow { stroke-dasharray: 10 26; animation: wvFlowDash 5s linear infinite; }
        .wv-lakeflow-d2 { animation-duration: 6.4s; }
        .wv-lakeflow-d3 { animation-duration: 7.6s; }
        .wv-river { stroke-dasharray: 8 12; animation: wvFlowDash 2.6s linear infinite; }
        .wv-river-d2 { animation-delay: 0.7s; }
        .wv-river-d3 { animation-delay: 1.3s; }
        @keyframes wvFlowDash { to { stroke-dashoffset: -72; } }
        .wv-site-ring { animation: wvRing 2.8s ease-out infinite; transform-origin: center; transform-box: fill-box; }
        @keyframes wvRing { 0% { transform: scale(1); opacity: 0.9; } 100% { transform: scale(4.2); opacity: 0; } }
        .wv-site circle:first-child { animation: wvGlowPulse 2.8s ease-in-out infinite; }

        /* ═══ SCENE 3 · TURTLE ISLAND ══════════════════════════ */
        .wv-turtle { background: linear-gradient(180deg, #f7efe0 0%, #efe0c8 42%, #d5e7f0 74%, #b3d5e8 100%); }
        .wv-turtle .wv-info { color: #2a3a4a; }
        .wv-turtle .wv-info h2 { color: #1d3557; }
        .wv-turtle .wv-info p { color: #40566c; }
        .wv-turtle .wv-info strong { color: #14344f; }
        .wv-turtle .wv-kicker { color: #b07b26; }
        .wv-turtle .wv-feature-chips span { background: rgba(29,83,120,0.1); color: #1d5378; border-color: rgba(29,83,120,0.28); }
        .wv-turtle-art { flex: 1 1 400px; max-width: 500px; }
        .wv-turtle-svg { width: 100%; height: auto; }
        .wv-turtle-sun { animation: wvGlowPulse 8s ease-in-out infinite; transform-origin: 360px 212px; transform-box: view-box; }
        .wv-rays2 { animation: wvRaysSpin 80s linear infinite; transform-origin: 360px 212px; transform-box: view-box; }
        @keyframes wvRaysSpin { to { transform: rotate(360deg); } }
        .wv-waterline { stroke-dasharray: 16 12; animation: wvFlowDash 8s linear infinite; }
        .wv-turtle-bob { animation: wvTurtleBob2 7s ease-in-out infinite; }
        @keyframes wvTurtleBob2 { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-8px); } }
        .wv-eyelid {
          transform-box: fill-box; transform-origin: center top;
          transform: scaleY(0);
          animation: wvBlink 6.5s ease-in-out infinite;
        }
        @keyframes wvBlink {
          0%, 90%, 100% { transform: scaleY(0); }
          93%, 96% { transform: scaleY(1); }
        }
        .wv-carried { transform-box: fill-box; transform-origin: center bottom;
          animation: wvPineSway 8s ease-in-out infinite alternate; }
        .wv-shellflow { stroke-dasharray: 20 30; animation: wvFlowDash 5.5s linear infinite; }
        .wv-shellflow-d2 { animation-duration: 7s; }
        .wv-ribbon-sway { transform-box: fill-box; transform-origin: center top; }
        .wv-rs-1 { animation: wvRibbonSway2 8s ease-in-out infinite alternate; }
        .wv-rs-2 { animation: wvRibbonSway2 9.5s ease-in-out infinite alternate-reverse; }
        .wv-rs-3 { animation: wvRibbonSway2 8.8s ease-in-out infinite alternate; }
        @keyframes wvRibbonSway2 { from { transform: rotate(-1deg); } to { transform: rotate(1.2deg); } }
        .wv-flow2 { stroke-dasharray: 26 36; animation: wvFlowDash 3s linear infinite; }
        .wv-flow2-d2 { animation-duration: 3.9s; }
        .wv-flow2-d3 { animation-duration: 3.4s; }
        .wv-stone { transform-box: fill-box; transform-origin: center;
          animation: wvStoneBob 5s ease-in-out infinite alternate; }
        @keyframes wvStoneBob { from { transform: translateY(0) rotate(0deg); } to { transform: translateY(-8px) rotate(3deg); } }
        .wv-sparkle { transform-box: fill-box; transform-origin: center;
          animation: wvSparkle 3.6s ease-in-out infinite; }
        @keyframes wvSparkle { 0%,100% { opacity: 0.15; transform: scale(0.6) rotate(0deg); } 50% { opacity: 0.95; transform: scale(1.1) rotate(45deg); } }
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
        .wv-schoolpath { position: absolute; top: 28%; left: 0; animation: wvCross 30s linear infinite; }
        .wv-school { width: 270px; overflow: visible; }
        .wv-school-fish { animation: wvFishWiggle 1.4s ease-in-out infinite alternate; transform-box: fill-box; transform-origin: center; }
        @keyframes wvFishWiggle { from { transform: translateY(0); } to { transform: translateY(-7px); } }
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
          .wv-pines { width: 40vw; bottom: 30vh; }
          .wv-dots { right: 8px; }
          .wv-scene-inner { gap: 26px; padding: 76px 0 66px; }
          .wv-info h2 { font-size: 24px; }
          .wv-lakes-art, .wv-turtle-art { max-width: 88vw; }
          .wv-canoe2 { width: 150px; }
          .wv-hero { padding-bottom: 6vh; }
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
