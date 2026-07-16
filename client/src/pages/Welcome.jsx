/**
 * Welcome — cinematic scroll-driven landing experience (v3, "a living world").
 *
 * The hero is now ONE composed illustrated landscape (single full-bleed SVG,
 * 1600×900, sliced): golden-hour sky with a breathing sun, hazy ridgelines,
 * shoreline pines, a lake with a shimmering sun-reflection column, a canoe
 * with two paddlers stroking in alternation, a loon swimming, a distant
 * sailboat, leaping fish, ripple rings — and a foreground meadow full of
 * life: a campfire circle with a drummer and rising smoke, dancing kids,
 * a dog with a wagging tail, an elder, grazing deer, a wigwam, a heron
 * dipping in the shallows, a bear at the water's edge, swaying cattails
 * and grass, drifting fireflies. Every element idles on its own loop.
 *
 * Scenes 2-5 continue the day: dusk lakes → warm-afternoon Turtle Island →
 * underwater (now with a sturgeon and a swimming turtle) → aurora night
 * (now with shooting stars and a silhouette canoe on the moonpath).
 *
 * All inline SVG + CSS keyframes + a little SMIL. No canvas, no RAF, no
 * image downloads, no new dependencies. prefers-reduced-motion and the
 * global sw-no-anim kill-switch freeze everything.
 *
 * Route: "/" for signed-out visitors. Sign-in lives at /login.
 */
import { useEffect, useRef, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronDown, Droplets, Map as MapIcon, Users, Sparkles, BookOpen, BarChart3, ArrowRight } from 'lucide-react'

const SECTIONS = ['dawn', 'lakes', 'turtle', 'underwater', 'night']

// ─────────────────────────────────────────────────────────────────────────────
// Small scene-building blocks (all pure SVG)
// ─────────────────────────────────────────────────────────────────────────────
const SKIN = ['#8a5a3a', '#96613d', '#7c4f33']
const SHIRT = ['#b3552e', '#3d6b8f', '#c2903a', '#7c4fc4', '#3f7d54', '#b3402e', '#2e8fa6']

// A tiny person. variant: 'stand' | 'sit'. Optional animated arm via children.
function Person({ x, y, s = 1, shirt = 0, skin = 0, variant = 'stand', sway = 0, flip = false, children }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${flip ? -s : s} ${s})`}>
      <g className="wv-npc-sway" style={{ animationDelay: `${sway}s` }}>
        {variant === 'stand' ? (
          <path d="M-3 0 L-3 11 M3 0 L3 11" stroke="#2a1d12" strokeWidth="3.4" strokeLinecap="round" />
        ) : (
          <path d="M-4 0 L-9 7 M4 0 L9 7" stroke="#2a1d12" strokeWidth="3.4" strokeLinecap="round" />
        )}
        <rect x="-5.5" y="-15" width="11" height="16" rx="4.5" fill={SHIRT[shirt % SHIRT.length]} />
        <circle cx="0" cy="-20" r="5.2" fill={SKIN[skin % SKIN.length]} />
        <path d="M-5.2 -20 A5.2 5.2 0 0 1 5.2 -20 L5.2 -17.6 L-5.2 -17.6 Z" fill="#171009" />
        {children}
      </g>
    </g>
  )
}

const Pine = ({ x, y, s = 1, fill = '#243b2e' }) => (
  <g transform={`translate(${x} ${y}) scale(${s})`}>
    <path d="M0 0 L0 -30 M0 -30 L-11 -10 L11 -10 Z M0 -42 L-9 -22 L9 -22 Z M0 -52 L-7 -34 L7 -34 Z"
      fill={fill} stroke={fill} strokeWidth="3" strokeLinejoin="round" />
  </g>
)

// A fringe of tiny pines along a ridgeline
function PineFringe({ y, from, to, step, s = 0.35, fill, jitter = 8 }) {
  const pines = []
  for (let x = from; x <= to; x += step) {
    pines.push(<Pine key={x} x={x} y={y + ((x * 7) % jitter)} s={s + ((x * 13) % 10) / 60} fill={fill} />)
  }
  return <g>{pines}</g>
}

function GrassTuft({ x, y, s = 1, delay = 0 }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`} className="wv-grass" style={{ animationDelay: `${delay}s` }}>
      <path d="M0 0 C-2 -7 -5 -10 -7 -12 M0 0 C0 -8 1 -12 2 -15 M0 0 C3 -6 6 -9 8 -11"
        fill="none" stroke="#4f7040" strokeWidth="2" strokeLinecap="round" />
    </g>
  )
}

function Cattail({ x, y, s = 1, delay = 0 }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`} className="wv-cattail" style={{ animationDelay: `${delay}s` }}>
      <path d="M0 0 L0 -34" stroke="#5d7a3e" strokeWidth="2.6" strokeLinecap="round" />
      <rect x="-2.8" y="-46" width="5.6" height="14" rx="2.8" fill="#6b4423" />
      <path d="M6 0 C7 -12 9 -20 12 -27" stroke="#5d7a3e" strokeWidth="2.2" strokeLinecap="round" fill="none" />
    </g>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Scene 1 — Dusk at the lake: layered swells, a breaching fish, foam on sand
// (Alto's-Odyssey-style composition: few big elements, done beautifully)
// ─────────────────────────────────────────────────────────────────────────────
function SceneDawn({ onScrollNext, onSignIn }) {
  return (
    <section className="wv-section wv-dawn" data-scene="dawn">
      <svg className="wv-worldsvg" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
        <defs>
          <linearGradient id="wvSky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#16344c" />
            <stop offset="40%" stopColor="#2e6e83" />
            <stop offset="72%" stopColor="#e89a5c" />
            <stop offset="100%" stopColor="#ffd9a0" />
          </linearGradient>
          <radialGradient id="wvSunGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(255,243,214,0.95)" />
            <stop offset="38%" stopColor="rgba(255,214,150,0.5)" />
            <stop offset="100%" stopColor="rgba(255,205,140,0)" />
          </radialGradient>
          <linearGradient id="wvSeaFar" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f0bc80" />
            <stop offset="30%" stopColor="#6cb3a4" />
            <stop offset="100%" stopColor="#4fa397" />
          </linearGradient>
          <linearGradient id="wvVign2" x1="0" y1="0" x2="0" y2="1">
            <stop offset="70%" stopColor="rgba(10,20,26,0)" />
            <stop offset="100%" stopColor="rgba(8,18,24,0.35)" />
          </linearGradient>
          <radialGradient id="wvVign" cx="50%" cy="42%" r="78%">
            <stop offset="64%" stopColor="rgba(20,25,20,0)" />
            <stop offset="100%" stopColor="rgba(10,18,22,0.4)" />
          </radialGradient>
        </defs>

        {/* ── Sky, sun, soft clouds ── */}
        <rect width="1600" height="450" fill="url(#wvSky)" />
        <circle cx="1130" cy="290" r="210" fill="url(#wvSunGlow)" className="wv-sunbreath" />
        <circle cx="1130" cy="290" r="64" fill="#fff3d6" className="wv-sunbreath" />

        <g className="wv-haze wv-haze-1" opacity="0.8">
          <ellipse cx="380" cy="180" rx="200" ry="17" fill="rgba(255,235,205,0.35)" />
          <ellipse cx="520" cy="196" rx="130" ry="12" fill="rgba(255,235,205,0.28)" />
        </g>
        <g className="wv-haze wv-haze-2" opacity="0.7">
          <ellipse cx="1000" cy="120" rx="170" ry="13" fill="rgba(255,240,215,0.3)" />
          <ellipse cx="1130" cy="132" rx="110" ry="10" fill="rgba(255,240,215,0.24)" />
        </g>

        {/* One elegant flock */}
        <g className="wv-flock wv-flock-1">
          {[[0, 0], [34, -12], [66, -4], [96, -16]].map(([dx, dy], i) => (
            <path key={i} className="wv-flapwing" style={{ animationDelay: `${i * 0.13}s` }}
              d={`M${dx} ${dy} q7 -8 15 0 q8 -8 15 0`} fill="none" stroke="#28333c" strokeWidth="2.6" strokeLinecap="round" />
          ))}
        </g>

        {/* Island with pines on the horizon + its reflection */}
        <g>
          <path d="M120 450 C160 428 250 422 310 432 C350 439 372 446 380 452 L120 452 Z" fill="#1d4450" />
          <Pine x={196} y={438} s={0.62} fill="#16333d" />
          <Pine x={238} y={434} s={0.82} fill="#16333d" />
          <Pine x={286} y={438} s={0.56} fill="#16333d" />
          <ellipse cx="250" cy="462" rx="120" ry="9" fill="rgba(22,51,61,0.28)" />
        </g>

        {/* Horizon light line */}
        <rect x="0" y="448" width="1600" height="4" fill="rgba(255,226,170,0.75)" />

        {/* ── The water: four rolling swell bands ── */}
        <rect x="0" y="450" width="1600" height="330" fill="url(#wvSeaFar)" />

        {/* Sun glitter path on the far water */}
        {[468, 492, 518, 548, 582, 620].map((y, i) => (
          <rect key={y} x={1096 - i * 9} y={y} width={70 + i * 18} height="4.4" rx="2.2"
            fill="rgba(255,232,170,0.6)" className="wv-glint2" style={{ animationDelay: `${i * 0.55}s` }} />
        ))}

        <path className="wv-swell wv-s1" fill="#3f978e"
          d="M-120 492 Q80 478 280 492 T680 492 T1080 492 T1480 492 T1880 492 L1880 900 L-120 900 Z" />
        <path className="wv-swell wv-s2" fill="#2f7f80"
          d="M-120 556 Q100 540 320 556 T760 556 T1200 556 T1640 556 T2080 556 L2080 900 L-120 900 Z" />
        {/* Foam flecks riding the third swell */}
        <g className="wv-swell wv-s3">
          <path fill="#23636e"
            d="M-120 636 Q120 618 360 636 T840 636 T1320 636 T1800 636 L1800 900 L-120 900 Z" />
          <g stroke="rgba(240,250,252,0.5)" strokeWidth="3" fill="none" strokeLinecap="round">
            <path d="M60 630 q28 -8 56 0 M420 626 q30 -8 60 0 M900 630 q26 -7 52 0 M1330 626 q28 -8 56 0" />
          </g>
        </g>
        <path className="wv-swell wv-s4" fill="#174b59"
          d="M-120 716 Q140 698 400 716 T920 716 T1440 716 T1960 716 L1960 900 L-120 900 Z" />

        {/* Buoy riding the mid swell */}
        <g className="wv-buoy">
          <ellipse cx="0" cy="14" rx="20" ry="4" fill="rgba(10,30,38,0.3)" />
          <path d="M-11 10 L-7 -22 L7 -22 L11 10 Z" fill="#d94f30" stroke="#8f2f18" strokeWidth="2" />
          <rect x="-8.4" y="-10" width="16.8" height="7" fill="#f4ead0" />
          <circle cx="0" cy="-26" r="4" fill="#ffd166" className="wv-buoylight" />
          <circle cx="0" cy="16" r="9" fill="none" stroke="rgba(240,250,255,0.35)" strokeWidth="2" className="wv-ripple" />
        </g>

        {/* Distant canoe silhouette gliding along the far swell */}
        <g className="wv-farcanoe">
          <path d="M-30 0 Q0 10 30 0 L24 6 Q0 14 -24 6 Z" fill="#12333f" />
          <circle cx="-4" cy="-8" r="4.4" fill="#12333f" />
          <path d="M-4 -4 L-4 2 M-4 -2 L8 6" stroke="#12333f" strokeWidth="2.8" strokeLinecap="round" />
        </g>

        {/* ═══ THE BREACH — a great fish leaps, hangs, and crashes home ═══ */}
        <g className="wv-breach">
          <g transform="scale(1.15)">
            {/* body */}
            <path d="M95 0 C60 -34 -20 -40 -60 -22 C-80 -13 -92 -4 -95 4 C-80 14 -40 26 10 24 C50 22 80 14 95 0 Z" fill="#2e5d74" />
            {/* belly */}
            <path d="M-95 4 C-80 14 -40 26 10 24 C50 22 80 14 95 0 C70 8 20 16 -30 12 C-60 9 -84 6 -95 4 Z" fill="#d7e9ee" opacity="0.92" />
            {/* tail */}
            <path d="M-88 -4 L-130 -32 L-118 0 L-130 28 L-88 8 Z" fill="#24506a" />
            {/* dorsal fin */}
            <path d="M-12 -30 C-2 -46 20 -48 34 -38 L14 -22 Z" fill="#24506a" />
            {/* pectoral fin */}
            <path d="M22 12 C12 26 -2 32 -16 32 L4 14 Z" fill="#3a708a" />
            {/* face */}
            <circle cx="66" cy="-9" r="4.8" fill="#0e2430" />
            <circle cx="67.6" cy="-10.6" r="1.6" fill="#e8f4f8" />
            <path d="M52 4 C58 1 63 -3 66 -8" fill="none" stroke="#1d4258" strokeWidth="2.6" strokeLinecap="round" />
            {/* spots */}
            <circle cx="-20" cy="-14" r="3" fill="#1d4258" opacity="0.5" />
            <circle cx="8" cy="-18" r="2.4" fill="#1d4258" opacity="0.5" />
            <circle cx="-44" cy="-10" r="2.7" fill="#1d4258" opacity="0.5" />
            {/* water streaming off the body */}
            <path className="wv-streams" d="M-60 18 L-66 34 M-20 24 L-24 42 M20 22 L18 38" stroke="rgba(235,248,252,0.8)" strokeWidth="2.6" strokeLinecap="round" />
          </g>
        </g>

        {/* Splash cluster at the re-entry point */}
        <g transform="translate(880 700)">
          <ellipse className="wv-splashring" cx="0" cy="0" rx="26" ry="7" fill="none" stroke="rgba(240,250,252,0.85)" strokeWidth="4" />
          <ellipse className="wv-splashring wv-sr2" cx="0" cy="0" rx="26" ry="7" fill="none" stroke="rgba(240,250,252,0.55)" strokeWidth="3" />
          <path className="wv-spray wv-spray-l" d="M-6 0 C-16 -22 -22 -38 -20 -54" fill="none" stroke="rgba(245,252,255,0.9)" strokeWidth="5" strokeLinecap="round" />
          <path className="wv-spray wv-spray-r" d="M6 0 C18 -20 26 -34 26 -50" fill="none" stroke="rgba(245,252,255,0.85)" strokeWidth="4.4" strokeLinecap="round" />
          {[[-38, -64], [-18, -84], [6, -92], [28, -80], [44, -58], [-46, -38], [50, -34], [14, -70]].map(([dx, dy], i) => (
            <circle key={i} className="wv-drop" r={3 + (i % 3)} fill="rgba(240,250,253,0.95)"
              style={{ '--dx': `${dx}px`, '--dy': `${dy}px`, animationDelay: `${(i % 4) * 0.05}s` }} />
          ))}
        </g>
        {/* Exit ripple where it left the water */}
        <ellipse className="wv-exitring" cx="600" cy="704" rx="20" ry="6" fill="none" stroke="rgba(240,250,252,0.7)" strokeWidth="3.4" />

        {/* ── The beach ── */}
        <path d="M0 762 C300 748 640 756 960 772 C1220 786 1440 806 1600 826 L1600 900 L0 900 Z" fill="#c9a06b" />
        {/* Foam edge washing in and out */}
        <g className="wv-foam">
          <path d="M0 764 C300 750 640 758 960 774 C1220 788 1440 808 1600 828"
            fill="none" stroke="rgba(250,252,250,0.85)" strokeWidth="7" strokeLinecap="round" strokeDasharray="46 22" />
          <path d="M0 772 C300 758 640 766 960 782 C1220 796 1440 815 1600 835"
            fill="none" stroke="rgba(250,252,250,0.4)" strokeWidth="4" strokeLinecap="round" strokeDasharray="30 34" />
        </g>
        <path d="M0 806 C320 792 700 800 1030 816 C1270 828 1460 846 1600 862 L1600 900 L0 900 Z" fill="#ecca92" />

        {/* Beach details: stones, shells, driftwood + two silhouettes watching */}
        {[[210, 848, 14, 5.5], [270, 862, 9, 4], [700, 852, 12, 5], [1060, 872, 15, 6], [500, 872, 8, 3.6]].map(([x, y, rx, ry], i) => (
          <ellipse key={i} cx={x} cy={y} rx={rx} ry={ry} fill={['#9a8a70', '#8f8068', '#a29078', '#948468', '#8a7a62'][i]} />
        ))}
        <g transform="translate(370 858)" opacity="0.85">
          <path d="M0 0 L4 -8 M0 0 L8 -5 M0 0 L9 1" stroke="#d8b48a" strokeWidth="2" strokeLinecap="round" />
        </g>
        <g transform="translate(930 878)" opacity="0.85">
          <path d="M0 0 L-4 -8 M0 0 L-8 -5 M0 0 L-9 1" stroke="#dcc09a" strokeWidth="2" strokeLinecap="round" />
        </g>

        {/* Driftwood log with two figures — a researcher and a kid, watching */}
        <g transform="translate(1220 838)">
          <rect x="-70" y="-4" width="150" height="15" rx="7" fill="#7a5233" transform="rotate(-3)" />
          <path d="M62 -6 L82 -20" stroke="#7a5233" strokeWidth="7" strokeLinecap="round" />
          <g className="wv-npc-sway">
            <path d="M-26 -6 L-30 8 M-18 -6 L-15 8" stroke="#12333f" strokeWidth="3.6" strokeLinecap="round" />
            <rect x="-31" y="-26" width="17" height="22" rx="6" fill="#12333f" />
            <circle cx="-22" cy="-33" r="6.6" fill="#12333f" />
            <path d="M-14 -20 L-2 -28" stroke="#12333f" strokeWidth="3.4" strokeLinecap="round" />
          </g>
          <g className="wv-npc-sway" style={{ animationDelay: '0.8s' }}>
            <path d="M8 -5 L5 7 M14 -5 L17 7" stroke="#12333f" strokeWidth="3" strokeLinecap="round" />
            <rect x="4" y="-20" width="13" height="16" rx="5" fill="#12333f" />
            <circle cx="10.5" cy="-25.5" r="5.2" fill="#12333f" />
          </g>
        </g>

        {/* Dune grass */}
        <GrassTuft x={120} y={886} s={1.6} delay={0} />
        <GrassTuft x={160} y={876} s={1.2} delay={0.6} />
        <GrassTuft x={1490} y={888} s={1.7} delay={0.3} />
        <GrassTuft x={1540} y={880} s={1.3} delay={0.9} />

        {/* Depth + vignette */}
        <rect width="1600" height="900" fill="url(#wvVign2)" pointerEvents="none" />
        <rect width="1600" height="900" fill="url(#wvVign)" pointerEvents="none" />
      </svg>

      {/* Hero copy — left title plate */}
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
          <button className="wv-cta wv-cta-primary" onClick={onSignIn}>
            <Droplets size={17} /> Enter the platform
          </button>
          <button className="wv-cta wv-cta-ghost" onClick={onScrollNext}>
            <Sparkles size={15} /> Guided journey
          </button>
        </div>
      </div>

      <button className="wv-scroll-hint" onClick={onScrollNext} aria-label="Scroll to next section">
        <span>Scroll to discover</span>
        <ChevronDown size={20} />
      </button>
    </section>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Scene 2 — The Great Lakes at dusk: shimmer, sailing boats, the water road
// ─────────────────────────────────────────────────────────────────────────────
const LAKE_SITES = [
  { x: 180, y: 150 }, { x: 265, y: 112 }, { x: 350, y: 140 }, { x: 425, y: 152 },
  { x: 296, y: 300 }, { x: 306, y: 392 },
  { x: 452, y: 262 }, { x: 512, y: 236 }, { x: 566, y: 206 },
  { x: 590, y: 392 }, { x: 664, y: 380 },
  { x: 742, y: 300 }, { x: 808, y: 292 },
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

            <path d="M40 60 C220 12 560 6 760 46 C860 66 890 140 878 240 C868 330 880 420 830 480 C740 540 520 552 340 540 C200 530 90 500 58 420 C30 340 26 220 40 60 Z"
              fill="url(#wvLand)" opacity="0.9" />

            <path className="wv-lake-shape" style={{ animationDelay: '0s' }} fill="url(#wvLake)"
              d="M95 178 C110 132 190 92 292 78 C372 68 442 88 470 118 C498 146 486 170 448 178 C398 188 348 176 306 190 C252 208 168 214 122 200 C100 192 88 186 95 178 Z" />
            <path className="wv-lake-shape" style={{ animationDelay: '0.4s' }} fill="url(#wvLake)"
              d="M298 238 C284 232 274 250 272 288 C270 334 274 394 288 430 C296 452 316 458 326 438 C338 412 334 350 328 302 C324 268 314 246 298 238 Z" />
            <path className="wv-lake-shape" style={{ animationDelay: '0.8s' }} fill="url(#wvLake)"
              d="M388 240 C420 204 468 192 504 206 C518 180 556 170 582 186 C606 202 598 232 576 244 C586 274 576 308 548 328 C512 352 458 344 434 312 C416 288 400 264 388 240 Z" />
            <path className="wv-lake-shape" style={{ animationDelay: '1.2s' }} fill="url(#wvLake)"
              d="M528 392 C566 366 644 352 702 362 C730 368 736 384 712 396 C666 418 590 424 548 412 C526 406 518 398 528 392 Z" />
            <path className="wv-lake-shape" style={{ animationDelay: '1.6s' }} fill="url(#wvLake)"
              d="M706 302 C734 282 792 274 832 286 C858 294 858 310 832 320 C792 332 734 328 710 316 C698 310 698 307 706 302 Z" />

            <g fill="none" stroke="rgba(180,225,255,0.5)" strokeWidth="2.6" strokeLinecap="round">
              <path className="wv-lakeflow" d="M140 168 C220 138 330 122 430 140" />
              <path className="wv-lakeflow wv-lakeflow-d2" d="M286 290 C290 330 292 380 302 416" />
              <path className="wv-lakeflow wv-lakeflow-d3" d="M420 272 C460 250 520 240 560 250" />
              <path className="wv-lakeflow wv-lakeflow-d2" d="M552 398 C610 382 668 376 700 380" />
              <path className="wv-lakeflow wv-lakeflow-d3" d="M718 306 C760 296 800 296 824 302" />
            </g>

            <g fill="none" stroke="#5eead4" strokeWidth="3.4" strokeLinecap="round" opacity="0.75">
              <path className="wv-river" d="M462 160 C486 178 498 196 500 216" />
              <path className="wv-river wv-river-d2" d="M540 330 C548 352 546 372 552 394" />
              <path className="wv-river wv-river-d3" d="M710 388 C726 372 726 340 716 320" />
            </g>

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

            <g className="wv-lake-labels" fontFamily="Georgia, serif" fontStyle="italic" fill="#9fc6e8">
              <text x="230" y="146" fontSize="19">Superior</text>
              <text x="316" y="330" fontSize="14" transform="rotate(80 316 330)">Michigan</text>
              <text x="448" y="286" fontSize="16">Huron</text>
              <text x="596" y="392" fontSize="15">Erie</text>
              <text x="748" y="308" fontSize="14">Ontario</text>
              <text x="470" y="132" fontSize="11" fill="#5eead4" fontStyle="normal" fontWeight="700">Baawaating</text>
            </g>

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
// Scene 3 — Turtle Island (faithful to the artwork)
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

            <g className="wv-rays2">
              {Array.from({ length: 12 }).map((_, i) => (
                <line key={i} x1="360" y1="52" x2="360" y2="76"
                  stroke="#eec14f" strokeWidth="5" strokeLinecap="round" opacity="0.5"
                  transform={`rotate(${i * 30} 360 212)`} />
              ))}
            </g>
            <circle cx="360" cy="212" r="146" fill="url(#wvSun2)" className="wv-turtle-sun" />

            <rect x="0" y="392" width="560" height="16" fill="rgba(120,180,220,0.35)" />
            <path d="M0 396 C90 388 180 402 280 394 C380 386 470 402 560 394" fill="none" stroke="rgba(70,130,180,0.5)" strokeWidth="3" className="wv-waterline" />
            <ellipse cx="290" cy="404" rx="185" ry="12" fill="rgba(30,60,90,0.16)" />
            {/* Ripples where the legs meet the water */}
            <circle cx="202" cy="400" r="9" fill="none" stroke="rgba(70,130,180,0.45)" strokeWidth="2.2" className="wv-ripple" />
            <circle cx="390" cy="402" r="9" fill="none" stroke="rgba(70,130,180,0.4)" strokeWidth="2" className="wv-ripple" style={{ animationDelay: '1.8s' }} />

            <g className="wv-turtle-bob">
              <path d="M452 372 C472 362 484 366 488 378 C484 388 468 392 452 388 Z"
                fill="#5da35f" stroke="#17301f" strokeWidth="7" strokeLinejoin="round" />
              {/* Head + neck in one group so the turtle can slowly look
                  around (rotation at the neck base) while still bobbing
                  with the body. */}
              <g className="wv-headgroup">
                <path d="M152 348 C120 336 96 308 86 276 C80 256 84 240 98 231 C114 221 134 226 144 243 C152 257 154 274 162 292 Z"
                  fill="#5da35f" stroke="#17301f" strokeWidth="8" strokeLinejoin="round" />
                <path d="M62 252 C54 232 62 212 84 205 C106 198 126 208 132 226 C137 243 128 259 108 264 C88 269 70 266 62 252 Z"
                  fill="#6bb06a" stroke="#17301f" strokeWidth="8" strokeLinejoin="round" />
                <path d="M118 268 C128 262 138 260 148 262 M108 288 C120 280 134 277 148 280"
                  fill="none" stroke="#2c5137" strokeWidth="4" strokeLinecap="round" />
                <circle cx="88" cy="230" r="7.5" fill="#122417" />
                <circle cx="90.5" cy="227.5" r="2.6" fill="#e9f5da" />
                <rect className="wv-eyelid" x="78" y="221" width="21" height="18" rx="9" fill="#6bb06a" />
                <path d="M74 216 C82 210 94 209 102 213" fill="none" stroke="#17301f" strokeWidth="3.5" strokeLinecap="round" />
                <path d="M64 246 C72 252 82 254 92 252" fill="none" stroke="#17301f" strokeWidth="3.5" strokeLinecap="round" />
              </g>

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

              <path d="M124 394 C118 300 186 208 300 198 C408 190 468 274 466 368 C466 386 456 394 438 394 Z"
                fill="url(#wvShell)" stroke="#17301f" strokeWidth="9" strokeLinejoin="round" />

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

              <path d="M134 356 L456 356" stroke="#17301f" strokeWidth="6" strokeLinecap="round" />
              {[158, 196, 234, 272, 310, 348, 386, 424].map((x, i) => (
                <line key={i} x1={x} y1="358" x2={x + 6} y2="392" stroke="#17301f" strokeWidth="5" strokeLinecap="round" />
              ))}
              {[148, 186, 224, 262, 300, 338, 376, 414, 446].map((x, i) => (
                <circle key={i} cx={x} cy="375" r="4.5" fill="#c8e6a5" opacity="0.85" />
              ))}

              <g className="wv-carried" fill="#14231c">
                <path d="M236 198 L236 154 L220 186 L252 186 Z M236 146 L223 172 L249 172 Z M236 138 L227 158 L245 158 Z" />
                <g stroke="#14231c" strokeWidth="4.5" strokeLinecap="round" fill="none">
                  <path d="M282 196 L282 118" />
                  <path d="M268 132 L296 132 M272 148 L292 148 M276 164 L288 164" />
                  <circle cx="282" cy="112" r="4" fill="#14231c" />
                </g>
                <path d="M322 196 L322 158 L308 186 L336 186 Z M322 150 L311 174 L333 174 Z" />
                <g stroke="#14231c" strokeWidth="4" strokeLinecap="round" fill="none">
                  <path d="M362 200 L362 140" />
                  <path d="M350 152 L374 152 M354 168 L370 168" />
                  <circle cx="362" cy="135" r="3.4" fill="#14231c" />
                </g>
                <path d="M398 204 L398 172 L386 196 L410 196 Z M398 165 L389 184 L407 184 Z" />
              </g>
            </g>

            <g strokeLinejoin="round">
              <g className="wv-ribbon-sway wv-rs-1">
                <path d="M148 400 C120 460 158 512 128 574 C112 610 126 650 106 700 L170 700 C186 652 170 612 188 576 C214 516 172 462 200 402 Z"
                  fill="url(#wvRibbonFill)" stroke="#1d3a52" strokeWidth="7" />
                <path className="wv-flow2" d="M170 404 C144 462 178 514 150 574 C136 610 148 652 136 698" fill="none" stroke="rgba(245,252,255,0.95)" strokeWidth="3.4" strokeLinecap="round" />
                <path className="wv-flow2 wv-flow2-d2" d="M186 402 C162 460 194 514 168 576 C154 612 166 654 154 698" fill="none" stroke="rgba(245,252,255,0.7)" strokeWidth="2.6" strokeLinecap="round" />
                <circle className="wv-ribdrop" r="4.4" fill="#eef8ff">
                  <animateMotion dur="6.5s" repeatCount="indefinite" path="M170 404 C144 462 178 514 150 574 C136 610 148 652 136 698" />
                </circle>
                <circle className="wv-ribdrop" r="3" fill="#eef8ff" opacity="0.8">
                  <animateMotion dur="6.5s" begin="3.2s" repeatCount="indefinite" path="M170 404 C144 462 178 514 150 574 C136 610 148 652 136 698" />
                </circle>
              </g>
              <g className="wv-ribbon-sway wv-rs-2">
                <path d="M258 404 C240 470 276 522 252 586 C240 620 252 660 240 702 L318 702 C330 660 318 622 332 586 C356 524 316 472 336 406 Z"
                  fill="url(#wvRibbonFill)" stroke="#1d3a52" strokeWidth="7" />
                <path className="wv-flow2 wv-flow2-d3" d="M282 406 C264 472 298 524 276 588 C264 622 276 662 266 700" fill="none" stroke="rgba(245,252,255,0.95)" strokeWidth="3.6" strokeLinecap="round" />
                <path className="wv-flow2" d="M306 406 C290 470 322 524 300 588 C288 622 300 662 292 700" fill="none" stroke="rgba(245,252,255,0.7)" strokeWidth="2.8" strokeLinecap="round" />
                <circle className="wv-ribdrop" r="4.6" fill="#eef8ff">
                  <animateMotion dur="7.4s" begin="1.1s" repeatCount="indefinite" path="M282 406 C264 472 298 524 276 588 C264 622 276 662 266 700" />
                </circle>
                <circle className="wv-ribdrop" r="3.2" fill="#eef8ff" opacity="0.8">
                  <animateMotion dur="7.4s" begin="4.8s" repeatCount="indefinite" path="M306 406 C290 470 322 524 300 588 C288 622 300 662 292 700" />
                </circle>
              </g>
              <g className="wv-ribbon-sway wv-rs-3">
                <path d="M392 402 C420 464 388 516 420 578 C438 612 426 652 444 700 L378 700 C364 652 376 614 360 578 C334 518 372 464 348 404 Z"
                  fill="url(#wvRibbonFill)" stroke="#1d3a52" strokeWidth="7" />
                <path className="wv-flow2 wv-flow2-d2" d="M372 404 C396 464 366 518 396 578 C412 612 402 654 414 698" fill="none" stroke="rgba(245,252,255,0.95)" strokeWidth="3.4" strokeLinecap="round" />
                <circle className="wv-ribdrop" r="4.2" fill="#eef8ff">
                  <animateMotion dur="6.9s" begin="2.3s" repeatCount="indefinite" path="M372 404 C396 464 366 518 396 578 C412 612 402 654 414 698" />
                </circle>
              </g>
            </g>

            {[
              { x: 96, y: 500, s: 1 }, { x: 226, y: 548, s: 0.8 }, { x: 346, y: 500, s: 0.9 },
              { x: 466, y: 560, s: 1.05 }, { x: 210, y: 652, s: 0.7 },
            ].map((p, i) => (
              <path key={i} className="wv-stone" style={{ animationDelay: `${i * 0.8}s` }}
                d={`M${p.x} ${p.y} L${p.x + 34 * p.s} ${p.y + 8 * p.s} L${p.x + 12 * p.s} ${p.y + 30 * p.s} Z`}
                fill="rgba(255,255,255,0.5)" stroke="#2a4a63" strokeWidth="4.5" strokeLinejoin="round" />
            ))}

            {[{ x: 130, y: 470 }, { x: 320, y: 640 }, { x: 440, y: 480 }].map((p, i) => (
              <path key={i} className="wv-sparkle" style={{ animationDelay: `${i * 1.1}s` }}
                d={`M${p.x} ${p.y - 9} L${p.x + 2.5} ${p.y - 2.5} L${p.x + 9} ${p.y} L${p.x + 2.5} ${p.y + 2.5} L${p.x} ${p.y + 9} L${p.x - 2.5} ${p.y + 2.5} L${p.x - 9} ${p.y} L${p.x - 2.5} ${p.y - 2.5} Z`}
                fill="#fff" opacity="0.8" />
            ))}

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
// Scene 4 — Beneath the surface (now with sturgeon + swimming turtle)
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

      {/* Great Lakes sturgeon — the ancient giant, slow deep crossing */}
      <div className="wv-sturgeonpath" aria-hidden="true">
        <svg viewBox="0 0 340 90" className="wv-sturgeon">
          <path d="M12 46 C60 24 150 18 230 32 C260 37 285 44 300 50 C285 56 258 63 228 66 C150 74 58 66 12 50 Z"
            fill="rgba(70,110,140,0.4)" />
          <path d="M300 50 L332 36 L322 52 L334 66 Z" fill="rgba(60,100,130,0.4)" />
          <path d="M80 26 L92 12 L102 24 M150 20 L160 6 L170 18 M215 26 L224 14 L232 26"
            fill="none" stroke="rgba(60,100,130,0.45)" strokeWidth="4" strokeLinejoin="round" />
          <path d="M60 62 L70 76 M130 68 L138 82" stroke="rgba(60,100,130,0.4)" strokeWidth="5" strokeLinecap="round" />
          <circle cx="34" cy="42" r="3" fill="rgba(20,40,55,0.6)" />
        </svg>
      </div>

      {/* A turtle swims the other way, flippers paddling */}
      <div className="wv-swimturtlepath" aria-hidden="true">
        <svg viewBox="0 0 160 100" className="wv-swimturtle">
          <ellipse cx="80" cy="50" rx="38" ry="26" fill="rgba(80,150,110,0.5)" />
          <path d="M52 34 C64 26 96 26 108 34 M48 50 L112 50 M52 66 C64 74 96 74 108 66"
            stroke="rgba(40,90,65,0.5)" strokeWidth="3" fill="none" />
          <circle cx="126" cy="44" r="11" fill="rgba(90,160,120,0.55)" />
          <circle cx="130" cy="41" r="2" fill="rgba(15,40,30,0.7)" />
          <path className="wv-flipper wv-flip-1" d="M58 28 C46 18 36 14 26 16 C32 24 42 30 54 32 Z" fill="rgba(90,160,120,0.5)" />
          <path className="wv-flipper wv-flip-2" d="M58 72 C46 82 36 86 26 84 C32 76 42 70 54 68 Z" fill="rgba(90,160,120,0.5)" />
        </svg>
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
// Scene 5 — Night water, aurora, shooting stars, silhouette canoe, final CTA
// ─────────────────────────────────────────────────────────────────────────────
function AuroraCurtain({ x, hue, cls }) {
  // A curtain = several tall tapered blades sharing a gradient; the group
  // sways as one and the blades shimmer individually.
  const blades = [[0, 300, 46], [58, 380, 54], [124, 330, 44], [186, 410, 60], [258, 300, 42]]
  return (
    <g className={`wv-curtain ${cls}`} transform={`translate(${x} 40)`}>
      {blades.map(([bx, h, w], i) => (
        <path key={i} className="wv-blade" style={{ animationDelay: `${i * 0.7}s` }}
          d={`M${bx} 0 L${bx + w} 0 L${bx + w * 0.72} ${h} L${bx + w * 0.28} ${h} Z`}
          fill={`url(#${hue})`} />
      ))}
    </g>
  )
}

function SceneNight({ onSignIn }) {
  return (
    <section className="wv-section wv-night" data-scene="night">
      <svg className="wv-worldsvg" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
        <defs>
          <linearGradient id="wvNSky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#04070f" />
            <stop offset="58%" stopColor="#0a1626" />
            <stop offset="100%" stopColor="#13283e" />
          </linearGradient>
          <linearGradient id="wvNSea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0d2236" />
            <stop offset="100%" stopColor="#04101c" />
          </linearGradient>
          <linearGradient id="wvAurG" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(70,227,160,0.75)" />
            <stop offset="100%" stopColor="rgba(70,227,160,0)" />
          </linearGradient>
          <linearGradient id="wvAurT" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(63,208,201,0.65)" />
            <stop offset="100%" stopColor="rgba(63,208,201,0)" />
          </linearGradient>
          <linearGradient id="wvAurV" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(143,127,240,0.6)" />
            <stop offset="100%" stopColor="rgba(143,127,240,0)" />
          </linearGradient>
          <radialGradient id="wvMoonGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(244,241,224,0.9)" />
            <stop offset="40%" stopColor="rgba(240,235,200,0.28)" />
            <stop offset="100%" stopColor="rgba(240,235,200,0)" />
          </radialGradient>
        </defs>

        {/* Sky */}
        <rect width="1600" height="620" fill="url(#wvNSky)" />

        {/* Stars — three magnitudes, twinkling */}
        {Array.from({ length: 64 }).map((_, i) => (
          <circle key={i} className="wv-star" style={{ animationDelay: `${(i % 9) * 0.55}s` }}
            cx={(i * 149) % 1600} cy={(i * 83) % 480}
            r={i % 9 === 0 ? 2.2 : i % 4 === 0 ? 1.5 : 1} fill="#dbeafe" />
        ))}

        {/* Aurora curtains — swaying blades with mirrored water reflections */}
        <AuroraCurtain x={140} hue="wvAurG" cls="wv-c1" />
        <AuroraCurtain x={560} hue="wvAurT" cls="wv-c2" />
        <AuroraCurtain x={1020} hue="wvAurV" cls="wv-c3" />

        {/* Moon with craters + halo */}
        <circle cx="1240" cy="170" r="150" fill="url(#wvMoonGlow)" className="wv-sunbreath" />
        <circle cx="1240" cy="170" r="56" fill="#f4f1e0" />
        <circle cx="1222" cy="152" r="9" fill="#e2ddc4" />
        <circle cx="1256" cy="184" r="12" fill="#e6e1c9" />
        <circle cx="1232" cy="192" r="6" fill="#dfd9bf" />

        {/* Water */}
        <rect x="0" y="620" width="1600" height="280" fill="url(#wvNSea)" />
        <rect x="0" y="618" width="1600" height="3" fill="rgba(220,235,245,0.22)" />

        {/* Aurora reflections — mirrored, dimmed, blurred */}
        <g transform="translate(0 1280) scale(1 -1)" opacity="0.16" style={{ filter: 'blur(10px)' }}>
          <AuroraCurtain x={140} hue="wvAurG" cls="wv-c1" />
          <AuroraCurtain x={560} hue="wvAurT" cls="wv-c2" />
          <AuroraCurtain x={1020} hue="wvAurV" cls="wv-c3" />
        </g>

        {/* Moon glitter trail on the water */}
        {[648, 678, 712, 748, 790, 834].map((y, i) => (
          <rect key={y} x={1212 - i * 8} y={y} width={56 + i * 16} height="4" rx="2"
            fill="rgba(240,235,200,0.4)" className="wv-glint2" style={{ animationDelay: `${i * 0.5}s` }} />
        ))}

        {/* Loon-call rings drifting on the dark water */}
        {[[380, 720], [820, 770]].map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r="10" fill="none" stroke="rgba(200,225,240,0.3)" strokeWidth="2"
            className="wv-ripple" style={{ animationDelay: `${i * 2.2}s` }} />
        ))}

        {/* Paddler silhouette crossing the glitter trail */}
        <g className="wv-nightpaddler">
          <path d="M-44 0 Q0 14 44 0 L36 9 Q0 20 -36 9 Z" fill="#050e18" />
          <circle cx="-2" cy="-11" r="5.6" fill="#050e18" />
          <path d="M-2 -6 L-2 4" stroke="#050e18" strokeWidth="4" strokeLinecap="round" />
          <g className="wv-nightpaddle">
            <path d="M-2 -2 L18 12" stroke="#050e18" strokeWidth="3.4" strokeLinecap="round" />
            <ellipse cx="21" cy="15" rx="4" ry="7" fill="#050e18" transform="rotate(-36 21 15)" />
          </g>
          <path d="M-58 8 q14 4 28 3 M-70 12 q16 5 34 3" stroke="rgba(210,230,245,0.2)" strokeWidth="2" fill="none" strokeLinecap="round" />
        </g>

        {/* Pine shoreline silhouette, bottom left */}
        <path d="M0 900 L0 830 C60 838 140 850 260 862 C400 876 520 888 600 900 Z" fill="#02090f" />
        <Pine x={60} y={846} s={1.25} fill="#02090f" />
        <Pine x={130} y={858} s={0.95} fill="#02090f" />
        <Pine x={205} y={868} s={1.4} fill="#02090f" />
        <Pine x={295} y={880} s={1.05} fill="#02090f" />

        {/* Shooting stars */}
        <g className="wv-shoot wv-shoot-1">
          <rect x="0" y="0" width="110" height="2.4" rx="1.2" fill="url(#wvMoonGlow)" />
        </g>
        <g className="wv-shoot wv-shoot-2">
          <rect x="0" y="0" width="90" height="2" rx="1" fill="url(#wvMoonGlow)" />
        </g>
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
          background: linear-gradient(180deg, rgba(4,10,20,0.45), transparent);
          pointer-events: none;
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

        /* ── Buttons ───────────────────────────────────────────── */
        .wv-cta {
          display: inline-flex; align-items: center; gap: 8px;
          border: none; cursor: pointer; font-weight: 800; font-family: inherit;
          border-radius: 999px; transition: transform 0.18s ease, box-shadow 0.18s ease;
        }
        .wv-cta:hover { transform: translateY(-2px); }
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

        /* ═══ SCENE 1 · DUSK AT THE LAKE ═══════════════════════ */
        .wv-dawn { background: #174b59; }
        .wv-worldsvg { position: absolute; inset: 0; width: 100%; height: 100%; }

        .wv-sunbreath { animation: wvSunBreath 7s ease-in-out infinite; transform-origin: center; transform-box: fill-box; }
        @keyframes wvSunBreath { 0%,100% { opacity: 0.92; transform: scale(1); } 50% { opacity: 1; transform: scale(1.045); } }

        .wv-haze-1 { animation: wvHazeDrift 30s ease-in-out infinite alternate; }
        .wv-haze-2 { animation: wvHazeDrift 40s ease-in-out infinite alternate-reverse; }
        @keyframes wvHazeDrift { from { transform: translateX(-70px); } to { transform: translateX(80px); } }

        .wv-flock-1 { animation: wvFlockCross 46s linear infinite; }
        @keyframes wvFlockCross {
          from { transform: translate(-240px, 130px); }
          to   { transform: translate(1840px, 96px); }
        }
        .wv-flapwing { transform-box: fill-box; transform-origin: center;
          animation: wvFlap2 0.62s ease-in-out infinite alternate; }
        @keyframes wvFlap2 { from { transform: scaleY(1); } to { transform: scaleY(0.25); } }

        .wv-glint2 { transform-box: fill-box; transform-origin: center;
          animation: wvGlintPulse 4.4s ease-in-out infinite; }
        @keyframes wvGlintPulse {
          0%,100% { opacity: 0.12; transform: scaleX(0.55); }
          50% { opacity: 0.8; transform: scaleX(1.15); }
        }

        /* The four swells breathe sideways at different tempos — the
           whole lake feels like it's slowly rolling. */
        .wv-swell { will-change: transform; }
        .wv-s1 { animation: wvSwellDrift 13s ease-in-out infinite alternate; }
        .wv-s2 { animation: wvSwellDrift 10s ease-in-out infinite alternate-reverse; }
        .wv-s3 { animation: wvSwellDrift 8s ease-in-out infinite alternate; }
        .wv-s4 { animation: wvSwellDrift 6.5s ease-in-out infinite alternate-reverse; }
        @keyframes wvSwellDrift {
          from { transform: translate(-48px, 0); }
          to   { transform: translate(44px, -7px); }
        }

        .wv-buoy { animation: wvBuoyRide 5.2s ease-in-out infinite alternate; transform-origin: center bottom; }
        .wv-buoy { transform: translate(430px, 640px); }
        @keyframes wvBuoyRide {
          from { transform: translate(430px, 640px) rotate(-5deg); }
          to   { transform: translate(430px, 630px) rotate(6deg); }
        }
        .wv-buoylight { animation: wvBuoyBlink 2.4s ease-in-out infinite; }
        @keyframes wvBuoyBlink { 0%, 100% { opacity: 0.25; } 50% { opacity: 1; } }

        .wv-farcanoe { animation: wvFarCross 105s linear infinite; }
        @keyframes wvFarCross {
          from { transform: translate(1700px, 500px); }
          to   { transform: translate(-140px, 500px); }
        }

        /* THE BREACH — 9s cycle: burst out, hang, crash, calm water */
        .wv-breach { animation: wvBreachArc 9s ease-in-out infinite; will-change: transform, opacity; }
        @keyframes wvBreachArc {
          0%   { transform: translate(590px, 760px) rotate(-52deg); opacity: 0; }
          4%   { transform: translate(612px, 700px) rotate(-46deg); opacity: 1; }
          14%  { transform: translate(688px, 540px) rotate(-18deg); opacity: 1; }
          22%  { transform: translate(752px, 500px) rotate(4deg);  opacity: 1; }
          30%  { transform: translate(820px, 560px) rotate(30deg); opacity: 1; }
          38%  { transform: translate(878px, 700px) rotate(54deg); opacity: 1; }
          41%  { transform: translate(892px, 760px) rotate(58deg); opacity: 0; }
          100% { transform: translate(892px, 780px) rotate(58deg); opacity: 0; }
        }
        .wv-streams { animation: wvStreams 9s ease-in-out infinite; }
        @keyframes wvStreams {
          0%, 6%, 42%, 100% { opacity: 0; }
          14%, 32% { opacity: 0.85; }
        }
        /* Splash synced to the 38-41% re-entry window */
        .wv-splashring { transform-box: fill-box; transform-origin: center;
          animation: wvSplashRing 9s ease-out infinite; opacity: 0; }
        .wv-sr2 { animation-delay: 0.35s; }
        @keyframes wvSplashRing {
          0%, 37% { transform: scale(0.2); opacity: 0; }
          40% { opacity: 0.9; }
          52% { transform: scale(3.2); opacity: 0; }
          100% { transform: scale(3.2); opacity: 0; }
        }
        .wv-spray { transform-box: fill-box; transform-origin: center bottom;
          animation: wvSpray 9s ease-out infinite; opacity: 0; }
        @keyframes wvSpray {
          0%, 37% { transform: scaleY(0.1); opacity: 0; }
          41% { transform: scaleY(1.15); opacity: 0.95; }
          50% { transform: scaleY(1.3) translateY(-8px); opacity: 0; }
          100% { opacity: 0; }
        }
        .wv-drop { animation: wvDropFly 9s ease-out infinite; opacity: 0; }
        @keyframes wvDropFly {
          0%, 37% { transform: translate(0, 0); opacity: 0; }
          40% { opacity: 1; }
          46% { transform: translate(var(--dx, 20px), var(--dy, -60px)); opacity: 0.9; }
          54% { transform: translate(calc(var(--dx, 20px) * 1.3), calc(var(--dy, -60px) * -0.3)); opacity: 0; }
          100% { opacity: 0; }
        }
        .wv-exitring { transform-box: fill-box; transform-origin: center;
          animation: wvExitRing 9s ease-out infinite; opacity: 0; }
        @keyframes wvExitRing {
          0% { transform: scale(0.3); opacity: 0; }
          3% { opacity: 0.8; }
          16% { transform: scale(3); opacity: 0; }
          100% { opacity: 0; }
        }

        /* Foam washes up the sand and slides back, endlessly */
        .wv-foam { animation: wvFoamWash 7s ease-in-out infinite alternate; }
        @keyframes wvFoamWash {
          from { transform: translateY(0); opacity: 0.55; }
          to   { transform: translateY(-13px); opacity: 0.95; }
        }

        .wv-ripple { transform-box: fill-box; transform-origin: center;
          animation: wvRippleGrow 4.4s ease-out infinite; }
        @keyframes wvRippleGrow {
          0% { transform: scale(0.3); opacity: 0.8; }
          70% { opacity: 0.25; }
          100% { transform: scale(3.4); opacity: 0; }
        }

        .wv-grass { transform-box: fill-box; transform-origin: bottom center;
          animation: wvGrassSway 4.6s ease-in-out infinite alternate; }
        @keyframes wvGrassSway { from { transform: rotate(-5deg); } to { transform: rotate(6deg); } }

        .wv-npc-sway { transform-box: fill-box; transform-origin: center bottom;
          animation: wvNpcSway 4.4s ease-in-out infinite alternate; }
        @keyframes wvNpcSway { from { transform: rotate(-1.8deg); } to { transform: rotate(2deg); } }

        /* Hero copy — left plate like the reference */
        .wv-hero {
          position: relative; z-index: 6;
          align-self: flex-start;
          margin: 15vh 0 0 6vw;
          max-width: 620px; padding: 0 18px 0 0;
          text-align: left;
        }
        .wv-kicker2 {
          font-size: 12px; font-weight: 800; letter-spacing: 0.3em; text-transform: uppercase;
          color: #ffd9a0; margin-bottom: 16px; text-shadow: 0 1px 12px rgba(10,25,35,0.7);
        }
        .wv-title {
          margin: 0 0 18px; line-height: 1.04; letter-spacing: -0.01em;
        }
        .wv-t-dark {
          font-size: clamp(40px, 5.6vw, 68px); font-weight: 800; color: #f4efe4;
          text-shadow: 0 3px 24px rgba(8,22,30,0.65);
        }
        .wv-t-serif {
          font-family: Georgia, 'Times New Roman', serif; font-style: italic; font-weight: 600;
          font-size: clamp(42px, 6vw, 74px); color: #f8e7bb;
          text-shadow: 0 3px 22px rgba(90,60,20,0.55);
        }
        .wv-sub {
          font-size: clamp(15px, 1.7vw, 17.5px); line-height: 1.7; color: #fdf6e8;
          max-width: 480px; margin: 0 0 26px; text-shadow: 0 2px 14px rgba(60,40,15,0.55);
        }
        .wv-cta-row { display: flex; gap: 14px; flex-wrap: wrap; }

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
        .wv-site circle:first-child { animation: wvSitePulse 2.8s ease-in-out infinite; }
        @keyframes wvSitePulse { 0%,100% { opacity: 0.85; } 50% { opacity: 1; } }

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
        .wv-turtle-sun { animation: wvSunBreath 8s ease-in-out infinite; transform-origin: 360px 212px; transform-box: view-box; }
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
          animation: wvCarriedSway 8s ease-in-out infinite alternate; }
        @keyframes wvCarriedSway { from { transform: rotate(-1deg); } to { transform: rotate(1.2deg); } }
        /* The turtle slowly looks up toward the sun and back */
        .wv-headgroup { transform-box: view-box; transform-origin: 152px 344px;
          animation: wvHeadLook 11s ease-in-out infinite; }
        @keyframes wvHeadLook {
          0%, 50%, 100% { transform: rotate(0deg); }
          62%, 72% { transform: rotate(-4deg); }
          84% { transform: rotate(1.6deg); }
        }
        .wv-ribdrop { filter: drop-shadow(0 0 3px rgba(235,250,255,0.9)); }
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
        .wv-community-dot { animation: wvSitePulse 3s ease-in-out infinite; transform-origin: center; transform-box: fill-box; }

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
        .wv-sturgeonpath { position: absolute; top: 58%; left: 0; animation: wvCrossSlow 74s linear infinite; }
        .wv-sturgeon { width: 300px; opacity: 0.85; }
        @keyframes wvCrossSlow { from { transform: translateX(-26vw); } to { transform: translateX(112vw); } }
        .wv-swimturtlepath { position: absolute; top: 18%; left: 0; animation: wvCrossBack 58s linear 8s infinite; }
        .wv-swimturtle { width: 130px; }
        @keyframes wvCrossBack { from { transform: translateX(110vw) scaleX(-1); } to { transform: translateX(-22vw) scaleX(-1); } }
        .wv-flipper { transform-box: fill-box; }
        .wv-flip-1 { transform-origin: right bottom; animation: wvFlipperPaddle 1.3s ease-in-out infinite alternate; }
        .wv-flip-2 { transform-origin: right top; animation: wvFlipperPaddle 1.3s ease-in-out 0.65s infinite alternate; }
        @keyframes wvFlipperPaddle { from { transform: rotate(-14deg); } to { transform: rotate(16deg); } }

        .wv-schoolpath { position: absolute; top: 32%; left: 0; animation: wvCrossSlow 30s linear infinite; }
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

        /* ═══ SCENE 5 · AURORA NIGHT ═══════════════════════════ */
        .wv-night { background: #04070f; }
        .wv-star { animation: wvTwinkle 3.4s ease-in-out infinite; }
        @keyframes wvTwinkle { 0%,100% { opacity: 0.2; } 50% { opacity: 1; } }

        /* Aurora curtains sway as sheets; blades shimmer individually */
        .wv-curtain { transform-box: view-box; will-change: transform; }
        .wv-c1 { animation: wvCurtainSway 13s ease-in-out infinite alternate; }
        .wv-c2 { animation: wvCurtainSway 17s ease-in-out infinite alternate-reverse; }
        .wv-c3 { animation: wvCurtainSway 15s ease-in-out 4s infinite alternate; }
        @keyframes wvCurtainSway {
          from { transform: translateX(-30px) skewX(-4deg); }
          to   { transform: translateX(34px) skewX(4deg); }
        }
        .wv-blade { transform-box: fill-box; transform-origin: center top;
          animation: wvBladeGlow 5.5s ease-in-out infinite alternate;
          filter: blur(7px); }
        @keyframes wvBladeGlow {
          from { opacity: 0.45; transform: scaleY(0.9); }
          to   { opacity: 0.95; transform: scaleY(1.12); }
        }

        .wv-nightpaddler { animation: wvNightPaddle 95s linear infinite; }
        @keyframes wvNightPaddle {
          from { transform: translate(-120px, 742px); }
          to   { transform: translate(1740px, 742px); }
        }
        .wv-nightpaddle { transform-box: fill-box; transform-origin: left top;
          animation: wvNightStroke 2.2s ease-in-out infinite; }
        @keyframes wvNightStroke {
          0%, 100% { transform: rotate(-12deg); }
          48% { transform: rotate(18deg); }
        }

        .wv-shoot { opacity: 0; }
        .wv-shoot-1 { animation: wvShoot2 11s ease-in 4s infinite; transform: translate(300px, 90px) rotate(-26deg); }
        .wv-shoot-2 { animation: wvShoot2 15s ease-in 10s infinite; transform: translate(900px, 60px) rotate(-22deg); }
        @keyframes wvShoot2 {
          0%, 91%, 100% { opacity: 0; }
          92% { opacity: 1; }
          96% { opacity: 0; transform: translate(560px, 210px) rotate(-26deg); }
        }

        .wv-night-content { position: relative; z-index: 5; text-align: center; padding: 0 22px; max-width: 620px; }
        .wv-night-content h2 { font-size: clamp(30px, 4.6vw, 52px); font-weight: 800; color: #f3f7fc; margin: 0 0 16px; }
        .wv-night-content p { font-size: 16.5px; line-height: 1.75; color: #b9cfe4; margin: 0 0 30px; }
        .wv-night-content .wv-cta-primary { color: #fff; background: linear-gradient(135deg, #0ea5e9, #14b8a6); box-shadow: 0 10px 30px rgba(14,165,233,0.4); }
        .wv-credits { margin-top: 40px; font-size: 12px; color: #5f7893; letter-spacing: 0.04em; }

        /* ── Small screens ─────────────────────────────────────── */
        @media (max-width: 760px) {
          .wv-dots { right: 8px; }
          .wv-scene-inner { gap: 26px; padding: 76px 0 66px; }
          .wv-info h2 { font-size: 24px; }
          .wv-lakes-art, .wv-turtle-art { max-width: 88vw; }
          .wv-hero { margin: 12vh 0 0 6vw; max-width: 88vw; }
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
