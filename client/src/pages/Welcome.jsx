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
// Scene 1 — Golden hour at the lake: one living illustrated world
// ─────────────────────────────────────────────────────────────────────────────
function SceneDawn({ onScrollNext, onSignIn }) {
  return (
    <section className="wv-section wv-dawn" data-scene="dawn">
      <svg className="wv-worldsvg" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
        <defs>
          <linearGradient id="wvSky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#2b3a5e" />
            <stop offset="34%" stopColor="#7d6377" />
            <stop offset="62%" stopColor="#d99a66" />
            <stop offset="100%" stopColor="#f2c47c" />
          </linearGradient>
          <radialGradient id="wvSunGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(255,236,180,0.95)" />
            <stop offset="34%" stopColor="rgba(255,210,130,0.5)" />
            <stop offset="100%" stopColor="rgba(255,200,120,0)" />
          </radialGradient>
          <linearGradient id="wvLakeGold" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#e8b878" />
            <stop offset="22%" stopColor="#b99576" />
            <stop offset="22%" stopColor="#b0906e" />
            <stop offset="55%" stopColor="#6f8a9b" />
            <stop offset="100%" stopColor="#31506a" />
          </linearGradient>
          <linearGradient id="wvSunCol" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(255,222,140,0.85)" />
            <stop offset="60%" stopColor="rgba(255,205,120,0.3)" />
            <stop offset="100%" stopColor="rgba(255,205,120,0)" />
          </linearGradient>
          <linearGradient id="wvMeadow" x1="0" y1="0" x2="0.35" y2="1">
            <stop offset="0%" stopColor="#6d8a4d" />
            <stop offset="55%" stopColor="#52713e" />
            <stop offset="100%" stopColor="#3a5230" />
          </linearGradient>
          <radialGradient id="wvVign" cx="50%" cy="42%" r="75%">
            <stop offset="62%" stopColor="rgba(30,20,10,0)" />
            <stop offset="100%" stopColor="rgba(24,16,8,0.42)" />
          </radialGradient>
        </defs>

        {/* ── Sky ── */}
        <rect width="1600" height="470" fill="url(#wvSky)" />
        <circle cx="820" cy="255" r="200" fill="url(#wvSunGlow)" className="wv-sunbreath" />
        <circle cx="820" cy="255" r="56" fill="#ffefc2" className="wv-sunbreath" />

        {/* Drifting haze bands */}
        <ellipse className="wv-haze wv-haze-1" cx="700" cy="380" rx="720" ry="42" fill="rgba(244,198,122,0.28)" />
        <ellipse className="wv-haze wv-haze-2" cx="1000" cy="300" rx="600" ry="30" fill="rgba(235,190,140,0.2)" />

        {/* Bird flocks — grouped, flapping, crossing the sky */}
        <g className="wv-flock wv-flock-1">
          {[[0, 0], [34, -12], [66, -4], [96, -16], [128, -8]].map(([dx, dy], i) => (
            <path key={i} className="wv-flapwing" style={{ animationDelay: `${i * 0.13}s` }}
              d={`M${dx} ${dy} q7 -8 15 0 q8 -8 15 0`} fill="none" stroke="#3a2e28" strokeWidth="2.6" strokeLinecap="round" />
          ))}
        </g>
        <g className="wv-flock wv-flock-2">
          {[[0, 0], [28, -10], [58, -2]].map(([dx, dy], i) => (
            <path key={i} className="wv-flapwing" style={{ animationDelay: `${0.2 + i * 0.15}s` }}
              d={`M${dx} ${dy} q6 -7 13 0 q7 -7 13 0`} fill="none" stroke="#3a2e28" strokeWidth="2.2" strokeLinecap="round" />
          ))}
        </g>

        {/* ── Distant ridges with pine fringes (atmospheric perspective) ── */}
        <path d="M0 442 C180 420 340 428 520 438 C720 450 900 430 1080 436 C1280 444 1440 428 1600 438 L1600 470 L0 470 Z"
          fill="#b98d63" opacity="0.75" />
        <PineFringe y={444} from={20} to={1580} step={26} s={0.16} fill="#8f6c4c" />
        <path d="M0 458 C240 442 420 452 640 458 C880 466 1060 448 1300 456 L1600 462 L1600 470 L0 470 Z"
          fill="#8a664a" opacity="0.9" />
        <PineFringe y={460} from={10} to={1590} step={20} s={0.2} fill="#6b4e3a" />

        {/* ── The lake ── */}
        <rect x="0" y="470" width="1600" height="430" fill="url(#wvLakeGold)" />

        {/* Sun reflection column with shimmer + glints */}
        <rect x="756" y="472" width="128" height="330" fill="url(#wvSunCol)" className="wv-suncol" />
        {[500, 535, 572, 612, 655, 700].map((y, i) => (
          <rect key={y} x={790 - i * 6} y={y} width={60 + i * 14} height="4" rx="2"
            fill="rgba(255,228,150,0.55)" className="wv-glint2" style={{ animationDelay: `${i * 0.6}s` }} />
        ))}

        {/* Drifting wave lines */}
        <g className="wv-waveline wv-wl-1" stroke="rgba(240,246,255,0.3)" strokeWidth="2.4" fill="none" strokeLinecap="round">
          <path d="M60 520 q40 -6 80 0 M300 545 q50 -7 100 0 M580 512 q45 -6 90 0 M1050 530 q45 -6 90 0" />
        </g>
        <g className="wv-waveline wv-wl-2" stroke="rgba(230,240,250,0.24)" strokeWidth="2.6" fill="none" strokeLinecap="round">
          <path d="M140 610 q50 -8 100 0 M430 640 q55 -8 110 0 M760 620 q50 -7 100 0 M1010 660 q45 -7 90 0" />
        </g>
        <g className="wv-waveline wv-wl-3" stroke="rgba(220,235,248,0.2)" strokeWidth="3" fill="none" strokeLinecap="round">
          <path d="M80 730 q60 -9 120 0 M380 770 q65 -9 130 0 M700 740 q60 -8 120 0" />
        </g>

        {/* Expanding ripple rings */}
        {[[260, 690], [560, 630], [960, 700]].map(([x, y], i) => (
          <g key={i}>
            <circle cx={x} cy={y} r="10" fill="none" stroke="rgba(240,248,255,0.4)" strokeWidth="2"
              className="wv-ripple" style={{ animationDelay: `${i * 1.4}s` }} />
            <circle cx={x} cy={y} r="10" fill="none" stroke="rgba(240,248,255,0.3)" strokeWidth="1.6"
              className="wv-ripple" style={{ animationDelay: `${i * 1.4 + 1.1}s` }} />
          </g>
        ))}

        {/* Distant sailboat drifting near the horizon */}
        <g className="wv-sailboat">
          <path d="M-16 0 L16 0 L11 7 L-11 7 Z" fill="#4a3a28" />
          <path d="M0 0 L0 -26 L15 -5 Z" fill="#f4e9d0" />
          <path d="M0 -26 L0 0 L-11 -4 Z" fill="#e6d6b4" />
        </g>

        {/* Loon swimming with a wake */}
        <g className="wv-loon">
          <path d="M-30 2 q10 3 24 2 M-38 5 q12 4 30 3" stroke="rgba(240,248,255,0.35)" strokeWidth="1.8" fill="none" strokeLinecap="round" />
          <ellipse cx="0" cy="0" rx="14" ry="6" fill="#1d2a30" />
          <path d="M10 -2 C14 -8 15 -13 13 -17 C17 -16 20 -13 20 -9" fill="none" stroke="#1d2a30" strokeWidth="4.4" strokeLinecap="round" />
          <circle cx="17" cy="-14" r="3.4" fill="#1d2a30" />
          <path d="M20 -14 L26 -12.6" stroke="#5d666b" strokeWidth="2.4" strokeLinecap="round" />
          <path d="M-7 -2 q5 -3 11 -1" stroke="#e8f0f4" strokeWidth="1.6" fill="none" />
        </g>

        {/* Canoe with two paddlers, crossing the whole lake */}
        <g className="wv-canoecross">
          <g className="wv-canoerock2">
            <ellipse className="wv-wakering" cx="-58" cy="26" rx="24" ry="4.6" fill="none" stroke="rgba(240,248,255,0.4)" strokeWidth="2" />
            <ellipse className="wv-wakering wv-wr-2" cx="-74" cy="28" rx="15" ry="3.2" fill="none" stroke="rgba(240,248,255,0.3)" strokeWidth="1.7" />
            <path d="M-64 12 Q0 34 64 12 L54 24 Q0 40 -54 24 Z" fill="#7a4520" stroke="#3a2410" strokeWidth="3" />
            <path d="M-58 15 Q0 32 58 15" fill="none" stroke="#9a6132" strokeWidth="2.2" />
            {/* bow paddler */}
            <circle cx="-26" cy="-2" r="6.5" fill="#27324a" />
            <path d="M-26 4 L-26 15" stroke="#27324a" strokeWidth="5" strokeLinecap="round" />
            <g className="wv-paddleA">
              <path d="M-26 8 L-44 22" stroke="#8a5a2b" strokeWidth="3.6" strokeLinecap="round" />
              <ellipse cx="-47" cy="25" rx="4.6" ry="8" fill="#8a5a2b" transform="rotate(38 -47 25)" />
            </g>
            {/* stern paddler */}
            <circle cx="24" cy="-2" r="6.5" fill="#3a2a20" />
            <path d="M24 4 L24 15" stroke="#3a2a20" strokeWidth="5" strokeLinecap="round" />
            <g className="wv-paddleB">
              <path d="M24 8 L42 22" stroke="#8a5a2b" strokeWidth="3.6" strokeLinecap="round" />
              <ellipse cx="45" cy="25" rx="4.6" ry="8" fill="#8a5a2b" transform="rotate(-38 45 25)" />
            </g>
          </g>
        </g>

        {/* Leaping fish */}
        <g className="wv-fishleap">
          <path d="M0 0 Q10 -12 24 -7 Q19 -2 24 3 Q10 8 0 0 Z" fill="#39647e" />
          <path d="M24 -7 L33 -11 L30 -2 L33 6 L24 3" fill="#2e5468" />
        </g>

        {/* ── Left shore: shallows, cattails, heron, bear ── */}
        <path d="M0 780 C120 786 260 812 420 852 C480 868 540 886 570 900 L0 900 Z" fill="#3e5a33" />
        <path d="M0 792 C110 798 240 822 400 860 L0 874 Z" fill="rgba(70,100,58,0.55)" />
        <Cattail x={64} y={806} s={1.15} delay={0} />
        <Cattail x={92} y={816} s={0.9} delay={0.8} />
        <Cattail x={508} y={886} s={1.2} delay={0.4} />
        <GrassTuft x={150} y={824} s={1.3} delay={0.2} />
        <GrassTuft x={300} y={846} s={1.1} delay={0.9} />
        <GrassTuft x={460} y={874} s={1.4} delay={0.5} />

        {/* Heron — stands in the shallows, dips its head */}
        <g transform="translate(180 796)">
          <path d="M0 0 L0 26 M6 0 L6 26" stroke="#5a636b" strokeWidth="2.6" strokeLinecap="round" />
          <ellipse cx="4" cy="-10" rx="15" ry="10" fill="#7d8a94" />
          <g className="wv-heronneck">
            <path d="M14 -16 C22 -26 24 -38 20 -48" fill="none" stroke="#7d8a94" strokeWidth="5.4" strokeLinecap="round" />
            <circle cx="19" cy="-50" r="4.6" fill="#7d8a94" />
            <path d="M23 -50 L36 -47" stroke="#d9a13c" strokeWidth="2.8" strokeLinecap="round" />
            <circle cx="20.5" cy="-51.5" r="1.3" fill="#1a2228" />
          </g>
          <ellipse cx="3" cy="28" rx="16" ry="3" fill="rgba(240,248,255,0.25)" />
        </g>

        {/* Bear at the water's edge, head bobbing for fish */}
        <g transform="translate(408 842)">
          <ellipse cx="0" cy="0" rx="30" ry="18" fill="#54382a" />
          <path d="M-22 12 L-22 24 M-8 15 L-8 26 M8 15 L8 26 M20 12 L20 24" stroke="#3d2418 " strokeWidth="6" strokeLinecap="round" />
          <g className="wv-bearhead">
            <circle cx="32" cy="-10" r="13" fill="#5d4030" />
            <circle cx="26" cy="-20" r="4" fill="#54382a" />
            <circle cx="39" cy="-19" r="4" fill="#54382a" />
            <ellipse cx="38" cy="-7" rx="5" ry="4" fill="#8a6a50" />
            <circle cx="38" cy="-9" r="1.7" fill="#1a120c" />
            <circle cx="30" cy="-13" r="1.7" fill="#1a120c" />
          </g>
          <circle cx="52" cy="12" r="7" fill="none" stroke="rgba(240,248,255,0.4)" strokeWidth="1.8" className="wv-ripple" style={{ animationDelay: '0.7s' }} />
        </g>

        {/* ── Foreground meadow (the living hillside, like the reference) ── */}
        <polygon points="660,900 1600,438 1600,900" fill="url(#wvMeadow)" />
        <path d="M660 900 L1600 438" stroke="#7a9a58" strokeWidth="5" opacity="0.5" fill="none" />

        {/* Meadow texture: grass tufts + tiny flowers along the slope */}
        {[[840, 850], [920, 812], [1010, 772], [1105, 726], [1200, 684], [1300, 636], [1395, 590], [1490, 545]].map(([x, y], i) => (
          <GrassTuft key={i} x={x} y={y} s={1.1 + (i % 3) * 0.25} delay={i * 0.35} />
        ))}
        {[[880, 838], [1060, 752], [1255, 660], [1430, 574], [1530, 528]].map(([x, y], i) => (
          <g key={i}>
            <circle cx={x} cy={y} r="3" fill={['#e8b13c', '#c86a8a', '#e8e0a0'][i % 3]} />
            <circle cx={x + 14} cy={y + 6} r="2.4" fill={['#c86a8a', '#e8e0a0', '#e8b13c'][i % 3]} />
          </g>
        ))}

        {/* Kids dancing near the bottom of the slope + a dog */}
        <Person x={852} y={862} s={0.92} shirt={3} skin={1} sway={0} />
        <Person x={884} y={874} s={0.85} shirt={6} skin={0} sway={0.5} flip />
        <Person x={918} y={886} s={0.95} shirt={1} skin={2} sway={0.9} />
        <g transform="translate(960 884)">
          <ellipse cx="0" cy="0" rx="12" ry="6.5" fill="#8a6a48" />
          <circle cx="12" cy="-5" r="5.4" fill="#96754e" />
          <path d="M14 -9 L16 -13 M9 -9 L10 -13" stroke="#6b4e30" strokeWidth="2.4" strokeLinecap="round" />
          <path d="M-8 2 L-8 9 M-2 3 L-2 10 M4 3 L4 10 M9 2 L9 9" stroke="#6b4e30" strokeWidth="2.8" strokeLinecap="round" />
          <path className="wv-dogtail" d="M-12 -3 C-17 -7 -19 -11 -18 -15" fill="none" stroke="#8a6a48" strokeWidth="3.4" strokeLinecap="round" />
          <circle cx="14.5" cy="-6" r="1.2" fill="#1a120c" />
        </g>

        {/* Campfire circle — the heart of the meadow */}
        <g transform="translate(1120 718)">
          {/* glow */}
          <circle cx="0" cy="-6" r="42" fill="rgba(255,150,60,0.16)" className="wv-fireglow" />
          {/* logs */}
          <path d="M-14 2 L14 -4 M-14 -4 L14 2" stroke="#4a2f18" strokeWidth="5" strokeLinecap="round" />
          {/* flames */}
          <path className="wv-flame wv-flame-1" d="M0 -2 C-7 -10 -6 -20 0 -28 C6 -20 7 -10 0 -2 Z" fill="#f59e3c" />
          <path className="wv-flame wv-flame-2" d="M0 -4 C-4 -9 -3.6 -16 0 -21 C3.6 -16 4 -9 0 -4 Z" fill="#ffd166" />
          {/* smoke */}
          {[0, 1, 2].map(i => (
            <circle key={i} className="wv-smoke" style={{ animationDelay: `${i * 1.5}s` }}
              cx="2" cy="-30" r="5" fill="rgba(235,235,230,0.4)" />
          ))}
          {/* the circle of people */}
          <Person x={-34} y={16} s={0.9} shirt={0} skin={0} variant="sit" sway={0.2} />
          <Person x={-14} y={26} s={0.9} shirt={4} skin={1} variant="sit" sway={0.7} />
          <Person x={16} y={26} s={0.9} shirt={2} skin={2} variant="sit" sway={1.1} flip />
          {/* drummer with a beating arm */}
          <g transform="translate(40 12)">
            <Person x={0} y={0} s={0.95} shirt={5} skin={0} variant="sit" sway={0.4} flip>
              <g className="wv-drumarm">
                <path d="M-5 -9 L-14 -2" stroke={SKIN[0]} strokeWidth="3.2" strokeLinecap="round" />
              </g>
            </Person>
            <ellipse cx="-16" cy="2" rx="7" ry="5" fill="#a8763e" stroke="#5d3a1c" strokeWidth="2" />
          </g>
        </g>

        {/* Standing pair — elder with staff + waving person */}
        <g transform="translate(1268 630)">
          <Person x={0} y={0} s={1.05} shirt={2} skin={2} sway={0.3}>
            <path d="M8 -14 L8 6" stroke="#6b4423" strokeWidth="2.6" strokeLinecap="round" />
          </Person>
          <Person x={34} y={-8} s={1} shirt={1} skin={0} sway={0.8} flip>
            <g className="wv-wavearm">
              <path d="M-5 -12 L-13 -20" stroke={SKIN[0]} strokeWidth="3.2" strokeLinecap="round" />
            </g>
          </Person>
        </g>

        {/* Deer pair — one grazes, fawn watches */}
        <g transform="translate(1408 560)">
          <ellipse cx="0" cy="0" rx="19" ry="11" fill="#8a5f3a" />
          <path d="M-13 8 L-13 24 M-5 10 L-5 25 M6 10 L6 25 M13 8 L13 24" stroke="#6b4426" strokeWidth="3.6" strokeLinecap="round" />
          <path d="M-17 -4 C-21 -6 -23 -9 -22 -12" fill="none" stroke="#8a5f3a" strokeWidth="3" strokeLinecap="round" />
          <g className="wv-deerhead">
            <path d="M16 -6 C22 -12 24 -18 24 -24" fill="none" stroke="#8a5f3a" strokeWidth="5.6" strokeLinecap="round" />
            <ellipse cx="26" cy="-26" rx="7" ry="5" transform="rotate(24 26 -26)" fill="#96693f" />
            <path d="M23 -31 L21 -38 M28 -31 L29 -38" stroke="#6b4426" strokeWidth="2.2" strokeLinecap="round" />
            <circle cx="28.5" cy="-27" r="1.4" fill="#1a120c" />
          </g>
        </g>
        <g transform="translate(1472 588) scale(0.62)">
          <ellipse cx="0" cy="0" rx="19" ry="11" fill="#9a6c42" />
          <path d="M-13 8 L-13 24 M-5 10 L-5 25 M6 10 L6 25 M13 8 L13 24" stroke="#75512e" strokeWidth="3.6" strokeLinecap="round" />
          <path d="M16 -6 C20 -12 22 -16 22 -22" fill="none" stroke="#9a6c42" strokeWidth="5.4" strokeLinecap="round" />
          <ellipse cx="24" cy="-24" rx="6.4" ry="4.6" transform="rotate(24 24 -24)" fill="#a87a4c" />
          <circle cx="4" cy="-4" r="1.6" fill="#f0e0c8" /><circle cx="-6" cy="2" r="1.6" fill="#f0e0c8" />
        </g>

        {/* Wigwam near the top of the slope + small pines */}
        <g transform="translate(1512 504)">
          <path d="M-26 26 L0 -22 L26 26 Z" fill="#8a5a34" stroke="#4a2f18" strokeWidth="3" strokeLinejoin="round" />
          <path d="M-8 26 L0 8 L8 26 Z" fill="#3a2410" />
          <path d="M-14 -2 L14 -2 M-20 10 L20 10" stroke="#5d3a1c" strokeWidth="2" />
        </g>
        <Pine x={1568} y={492} s={0.8} fill="#2e4632" />
        <Pine x={1348} y={606} s={0.6} fill="#33503a" />
        <Pine x={1180} y={688} s={0.7} fill="#2e4632" />

        {/* Fireflies drifting up the meadow */}
        {[[900, 800], [1080, 740], [1240, 664], [1380, 596], [1500, 540], [1020, 800]].map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r="2.6" fill="#ffe9a0"
            className="wv-firefly" style={{ animationDelay: `${i * 1.2}s` }} />
        ))}

        {/* Warm vignette over everything */}
        <rect width="1600" height="900" fill="url(#wvVign)" pointerEvents="none" />
      </svg>

      {/* Hero copy — left-aligned over the water, like a title plate */}
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

            <g className="wv-turtle-bob">
              <path d="M452 372 C472 362 484 366 488 378 C484 388 468 392 452 388 Z"
                fill="#5da35f" stroke="#17301f" strokeWidth="7" strokeLinejoin="round" />
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
              </g>
              <g className="wv-ribbon-sway wv-rs-2">
                <path d="M258 404 C240 470 276 522 252 586 C240 620 252 660 240 702 L318 702 C330 660 318 622 332 586 C356 524 316 472 336 406 Z"
                  fill="url(#wvRibbonFill)" stroke="#1d3a52" strokeWidth="7" />
                <path className="wv-flow2 wv-flow2-d3" d="M282 406 C264 472 298 524 276 588 C264 622 276 662 266 700" fill="none" stroke="rgba(245,252,255,0.95)" strokeWidth="3.6" strokeLinecap="round" />
                <path className="wv-flow2" d="M306 406 C290 470 322 524 300 588 C288 622 300 662 292 700" fill="none" stroke="rgba(245,252,255,0.7)" strokeWidth="2.8" strokeLinecap="round" />
              </g>
              <g className="wv-ribbon-sway wv-rs-3">
                <path d="M392 402 C420 464 388 516 420 578 C438 612 426 652 444 700 L378 700 C364 652 376 614 360 578 C334 518 372 464 348 404 Z"
                  fill="url(#wvRibbonFill)" stroke="#1d3a52" strokeWidth="7" />
                <path className="wv-flow2 wv-flow2-d2" d="M372 404 C396 464 366 518 396 578 C412 612 402 654 414 698" fill="none" stroke="rgba(245,252,255,0.95)" strokeWidth="3.4" strokeLinecap="round" />
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
      {/* Shooting stars */}
      <span className="wv-shooter wv-shooter-1" aria-hidden="true" />
      <span className="wv-shooter wv-shooter-2" aria-hidden="true" />

      <div className="wv-aurora" aria-hidden="true">
        <span className="wv-aurora-1" /><span className="wv-aurora-2" /><span className="wv-aurora-3" />
      </div>
      <div className="wv-moon" aria-hidden="true" />
      <div className="wv-moonpath" aria-hidden="true" />

      {/* Silhouette canoe drifting across the moonpath */}
      <div className="wv-nightcanoe" aria-hidden="true">
        <svg viewBox="0 0 160 60" width="120">
          <path d="M8 30 Q80 52 152 30 L142 40 Q80 58 18 40 Z" fill="#0a1522" />
          <circle cx="82" cy="20" r="7" fill="#0a1522" />
          <path d="M82 26 L82 38 M82 30 L64 22 M82 30 L100 40" stroke="#0a1522" strokeWidth="4" strokeLinecap="round" />
        </svg>
      </div>

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

        /* ═══ SCENE 1 · THE LIVING WORLD ═══════════════════════ */
        .wv-dawn { background: #f2c47c; }
        .wv-worldsvg { position: absolute; inset: 0; width: 100%; height: 100%; }

        .wv-sunbreath { animation: wvSunBreath 7s ease-in-out infinite; transform-origin: 820px 255px; transform-box: view-box; }
        @keyframes wvSunBreath { 0%,100% { opacity: 0.92; transform: scale(1); } 50% { opacity: 1; transform: scale(1.045); } }

        .wv-haze { }
        .wv-haze-1 { animation: wvHazeDrift 26s ease-in-out infinite alternate; }
        .wv-haze-2 { animation: wvHazeDrift 34s ease-in-out infinite alternate-reverse; }
        @keyframes wvHazeDrift { from { transform: translateX(-60px); } to { transform: translateX(70px); } }

        .wv-flock { transform: translateX(-220px); }
        .wv-flock-1 { transform: translate(-220px, 110px); animation: wvFlockCross 52s linear infinite; }
        .wv-flock-2 { transform: translate(-160px, 185px); animation: wvFlockCross 70s linear 18s infinite; }
        @keyframes wvFlockCross {
          from { transform: translate(-240px, var(--fy, 110px)); }
          to   { transform: translate(1840px, var(--fy, 110px)); }
        }
        .wv-flock-1 { --fy: 110px; } .wv-flock-2 { --fy: 185px; }
        .wv-flapwing { transform-box: fill-box; transform-origin: center;
          animation: wvFlap2 0.62s ease-in-out infinite alternate; }
        @keyframes wvFlap2 { from { transform: scaleY(1); } to { transform: scaleY(0.25); } }

        .wv-suncol { animation: wvSuncolShimmer 6s ease-in-out infinite alternate; transform-origin: 820px 472px; transform-box: view-box; }
        @keyframes wvSuncolShimmer { from { opacity: 0.75; transform: scaleX(0.9); } to { opacity: 1; transform: scaleX(1.1); } }
        .wv-glint2 { transform-box: fill-box; transform-origin: center;
          animation: wvGlintPulse 4.4s ease-in-out infinite; }
        @keyframes wvGlintPulse {
          0%,100% { opacity: 0.15; transform: scaleX(0.55); }
          50% { opacity: 0.85; transform: scaleX(1.15); }
        }

        .wv-waveline { }
        .wv-wl-1 { animation: wvWaveDrift 12s ease-in-out infinite alternate; }
        .wv-wl-2 { animation: wvWaveDrift 15s ease-in-out infinite alternate-reverse; }
        .wv-wl-3 { animation: wvWaveDrift 18s ease-in-out infinite alternate; }
        @keyframes wvWaveDrift { from { transform: translateX(-34px); } to { transform: translateX(38px); } }

        .wv-ripple { transform-box: fill-box; transform-origin: center;
          animation: wvRippleGrow 4.4s ease-out infinite; }
        @keyframes wvRippleGrow {
          0% { transform: scale(0.3); opacity: 0.8; }
          70% { opacity: 0.25; }
          100% { transform: scale(3.4); opacity: 0; }
        }

        .wv-sailboat { animation: wvSailDrift 95s linear infinite; }
        @keyframes wvSailDrift {
          from { transform: translate(1700px, 505px); }
          to   { transform: translate(-160px, 505px); }
        }

        .wv-loon { animation: wvLoonSwim 120s linear infinite, wvLoonBob 5s ease-in-out infinite alternate; }
        @keyframes wvLoonSwim { from { transform: translate(-80px, 655px); } to { transform: translate(1700px, 655px); } }
        @keyframes wvLoonBob { from { margin-top: 0; } to { margin-top: 4px; } }

        .wv-canoecross { animation: wvCanoeCross 78s linear infinite; }
        @keyframes wvCanoeCross { from { transform: translate(-160px, 588px); } to { transform: translate(1780px, 588px); } }
        .wv-canoerock2 { animation: wvCanoeRock2 4.4s ease-in-out infinite alternate; transform-origin: center bottom; }
        @keyframes wvCanoeRock2 { from { transform: translateY(0) rotate(-1.6deg); } to { transform: translateY(7px) rotate(1.8deg); } }
        .wv-paddleA { transform-box: fill-box; transform-origin: -26px 8px;
          animation: wvPaddleStrokeA 1.9s ease-in-out infinite; }
        .wv-paddleB { transform-box: fill-box; transform-origin: 24px 8px;
          animation: wvPaddleStrokeA 1.9s ease-in-out 0.95s infinite; }
        @keyframes wvPaddleStrokeA {
          0%, 100% { transform: rotate(-16deg); }
          46% { transform: rotate(22deg); }
          62% { transform: rotate(17deg); }
        }
        .wv-wakering { transform-box: fill-box; transform-origin: center; }
        .wv-wakering { animation: wvWake2 2.6s ease-out infinite; }
        .wv-wr-2 { animation-delay: 0.9s; }
        @keyframes wvWake2 { 0% { transform: scale(0.4); opacity: 0.75; } 100% { transform: scale(1.7); opacity: 0; } }

        .wv-fishleap {
          transform: translate(320px, 620px);
          animation: wvFishLeap 12s ease-in-out infinite;
          transform-origin: center bottom;
        }
        @keyframes wvFishLeap {
          0%, 78%, 100% { transform: translate(320px, 620px) rotate(0deg); opacity: 0; }
          82% { transform: translate(340px, 566px) rotate(-24deg); opacity: 1; }
          86% { transform: translate(362px, 552px) rotate(6deg); opacity: 1; }
          91% { transform: translate(386px, 618px) rotate(38deg); opacity: 0; }
        }

        .wv-grass { transform-box: fill-box; transform-origin: bottom center;
          animation: wvGrassSway 4.6s ease-in-out infinite alternate; }
        @keyframes wvGrassSway { from { transform: rotate(-5deg); } to { transform: rotate(6deg); } }
        .wv-cattail { transform-box: fill-box; transform-origin: bottom center;
          animation: wvGrassSway 5.8s ease-in-out infinite alternate; }

        .wv-npc-sway { transform-box: fill-box; transform-origin: center bottom;
          animation: wvNpcSway 3.8s ease-in-out infinite alternate; }
        @keyframes wvNpcSway { from { transform: rotate(-2.4deg); } to { transform: rotate(2.6deg); } }
        .wv-drumarm { transform-box: fill-box; transform-origin: right center;
          animation: wvDrumBeat 0.62s ease-in-out infinite alternate; }
        @keyframes wvDrumBeat { from { transform: rotate(-24deg); } to { transform: rotate(14deg); } }
        .wv-wavearm { transform-box: fill-box; transform-origin: right bottom;
          animation: wvWaveArm 1.4s ease-in-out infinite alternate; }
        @keyframes wvWaveArm { from { transform: rotate(-22deg); } to { transform: rotate(16deg); } }
        .wv-dogtail { transform-box: fill-box; transform-origin: bottom right;
          animation: wvTailWag 0.5s ease-in-out infinite alternate; }
        @keyframes wvTailWag { from { transform: rotate(-16deg); } to { transform: rotate(18deg); } }

        .wv-fireglow { animation: wvFireGlow 2.6s ease-in-out infinite alternate; transform-box: fill-box; transform-origin: center; }
        @keyframes wvFireGlow { from { opacity: 0.12; transform: scale(0.92); } to { opacity: 0.24; transform: scale(1.1); } }
        .wv-flame { transform-box: fill-box; transform-origin: center bottom; }
        .wv-flame-1 { animation: wvFlicker 0.44s ease-in-out infinite alternate; }
        .wv-flame-2 { animation: wvFlicker 0.36s ease-in-out 0.1s infinite alternate; }
        @keyframes wvFlicker {
          from { transform: scaleY(0.86) skewX(-3deg); }
          to   { transform: scaleY(1.12) skewX(4deg); }
        }
        .wv-smoke { animation: wvSmokeRise 4.5s ease-out infinite; transform-box: fill-box; transform-origin: center; }
        @keyframes wvSmokeRise {
          0% { transform: translateY(0) scale(0.7); opacity: 0; }
          14% { opacity: 0.5; }
          100% { transform: translateY(-72px) translateX(10px) scale(1.9); opacity: 0; }
        }

        .wv-deerhead { transform-box: fill-box; transform-origin: left bottom;
          animation: wvDeerGraze 7.5s ease-in-out infinite; }
        @keyframes wvDeerGraze {
          0%, 55%, 100% { transform: rotate(0deg); }
          66%, 84% { transform: rotate(42deg); }
        }
        .wv-heronneck { transform-box: fill-box; transform-origin: left bottom;
          animation: wvHeronDip 9s ease-in-out infinite; }
        @keyframes wvHeronDip {
          0%, 62%, 100% { transform: rotate(0deg); }
          72%, 80% { transform: rotate(34deg); }
        }
        .wv-bearhead { transform-box: fill-box; transform-origin: left center;
          animation: wvBearBob 5.4s ease-in-out infinite; }
        @keyframes wvBearBob {
          0%, 52%, 100% { transform: rotate(0deg); }
          64%, 78% { transform: rotate(16deg); }
        }

        .wv-firefly { animation: wvFirefly 7s ease-in-out infinite; transform-box: fill-box; transform-origin: center; }
        @keyframes wvFirefly {
          0%, 100% { opacity: 0; transform: translate(0, 0); }
          20% { opacity: 0.9; }
          50% { opacity: 0.35; transform: translate(9px, -22px); }
          75% { opacity: 0.85; transform: translate(-5px, -38px); }
        }

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
          color: #4a3520; margin-bottom: 16px; text-shadow: 0 1px 10px rgba(255,235,190,0.6);
        }
        .wv-title {
          margin: 0 0 18px; line-height: 1.04; letter-spacing: -0.01em;
        }
        .wv-t-dark {
          font-size: clamp(40px, 5.6vw, 68px); font-weight: 800; color: #2c2214;
          text-shadow: 0 2px 18px rgba(255,240,200,0.4);
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

        /* ═══ SCENE 5 · NIGHT ══════════════════════════════════ */
        .wv-night { background: linear-gradient(180deg, #030814 0%, #071527 55%, #0a1e33 100%); }
        .wv-stars { position: absolute; inset: 0; }
        .wv-stars span { position: absolute; border-radius: 50%; background: #dbeafe;
          animation: wvTwinkle 3.4s ease-in-out infinite; }
        @keyframes wvTwinkle { 0%,100% { opacity: 0.25; } 50% { opacity: 1; } }
        .wv-shooter {
          position: absolute; width: 90px; height: 2px; border-radius: 2px;
          background: linear-gradient(90deg, rgba(240,248,255,0.9), transparent);
          transform: rotate(-28deg); opacity: 0;
        }
        .wv-shooter-1 { top: 12%; left: 20%; animation: wvShoot 9s ease-in 3s infinite; }
        .wv-shooter-2 { top: 7%; left: 62%; animation: wvShoot 13s ease-in 8s infinite; }
        @keyframes wvShoot {
          0%, 92%, 100% { opacity: 0; transform: rotate(-28deg) translateX(0); }
          93% { opacity: 1; }
          97% { opacity: 0; transform: rotate(-28deg) translateX(240px); }
        }
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
        .wv-nightcanoe {
          position: absolute; bottom: 16%; left: 0;
          animation: wvNightCanoe 90s linear infinite;
          opacity: 0.9;
        }
        @keyframes wvNightCanoe {
          from { transform: translateX(-140px); }
          to   { transform: translateX(105vw); }
        }
        .wv-night-wave { position: absolute; bottom: 0; left: 0; width: 100%; height: 110px; }
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
