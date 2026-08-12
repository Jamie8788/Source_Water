/**
 * welcomeShore — the hero scene, rebuilt: a cinematic Canadian Great Lakes
 * waterfront at golden hour, rendered procedurally on Canvas2D.
 *
 * Art direction: eye-level camera looking diagonally across a curved beach;
 * a small, hazy environmental sun (no giant disc, no ray triangles); water
 * built from depth-graded colour, a live sun-glitter field, broad drifting
 * swells, translucent shallows with caustics and submerged stones; foam that
 * laps onto mirror-wet sand; long soft golden-hour shadows and warm rim
 * light on every figure; large articulated characters with proper walk
 * cycles; Great-Lakes-only wildlife; granite foreground with grasses and a
 * beached canoe bow framing the shot; parallax, cursor ripples and hover
 * data previews.
 */
import { VW, VH, vGrad, glow, makeParticles, lerp, clamp } from './welcomeEngine'
import { drawPerson, WARDROBE, SKINS, HAIRS } from './welcomePeople'

const TAU = Math.PI * 2

// "Enter the platform" light trail: a spark travels from the CTA shoreline
// to the monitoring buoy and pulses. Fired from the hero button.
let trailT = -1
export function fireLightTrail() { trailT = 0 }

const ease2 = (q) => q * q * (3 - 2 * q)
const HZ = 320 // horizon (eye-level camera → high horizon)
const SUNX = 1150, SUNY = 232

// diagonal waterline: upper-left water, lower-right beach
const shoreY = (x) => 575 + Math.pow(clamp(x, 0, 1600) / 1600, 1.22) * 315 + Math.sin(x * 0.004) * 10

// ── interactive "touch points": one marker per real monitoring activity, so
// the scene doubles as a training/learning tool. `sy` (+ optional `off`)
// anchors a point to the waterline via shoreY; otherwise `y` is absolute.
// Content is grounded in Water Rangers field protocols.
const TOUCHPOINTS = [
  { n: 1, sy: 958, off: -32, title: 'WATER CLARITY · SECCHI DISK', lines: ['Lower the black-and-white disk until it', 'disappears — that depth is the clarity reading.', 'Cloudy water can mean algae or sediment.'] },
  { n: 2, sy: 620, off: -46, title: 'DISSOLVED OXYGEN', lines: ['Snap a glass ampoule and match its colour', 'to the chart. Oxygen is what fish breathe —', 'low readings warn of pollution or warming.'] },
  { n: 3, sy: 360, off: -30, title: 'CONDUCTIVITY', lines: ['A probe reads the dissolved salts in the water.', 'A high number flags road-salt or chloride', 'runoff washing into the lake.'] },
  { n: 4, sy: 1096, off: -46, title: 'TURBIDITY TUBE', lines: ['Sight down a clear column of sample water to', 'see how much sediment clouds it — a fast', 'field measure of murkiness.'] },
  { n: 5, sy: 806, off: -34, title: 'BENTHIC KICK-NET', lines: ['Sweep a net through the streambed and count', 'the insects. Mayflies and stoneflies mean', 'clean water; their absence is a warning.'] },
  { n: 6, x: 640, y: 552, title: 'MONITORING BUOY · LIVE', lines: ['pH 7.9 · 18.2 °C · DO 9.4 mg/L', 'A moored sensor logs the lake around the', 'clock and streams it to the open network.'] },
  { n: 7, x: 845, y: 505, title: 'RESEARCH SONDE', lines: ['The crew lowers a multi-probe sonde from', 'surface to bottom, profiling temperature,', 'oxygen and clarity down the water column.'] },
  { n: 8, sy: 548, off: -30, title: 'SHORE DATA STATION', lines: ['Readings upload here to the open SOURCE', 'Water network — every site public, every', 'number shared.'] },
  { n: 9, x: 1170, y: 742, title: 'DOCK GRAB SAMPLE', lines: ['A weighted bucket is cast from the dock to', 'reach open water beyond wading depth,', 'then hauled up for testing.'] },
  { n: 10, x: 96, y: 812, title: 'AERIAL DRONE SURVEY', lines: ['A pilot flies a mapping drone along the', 'shore to spot algae blooms and erosion', 'from above — aerial view meets ground truth.'] },
  { n: 11, x: 670, y: 812, title: 'SHORELINE TRANSECT', lines: ['Two volunteers stretch a measuring tape so', 'samples land on the same points every visit —', 'consistency makes the trend trustworthy.'] },
  { n: 12, x: 1258, y: 806, title: 'eDNA / BACTERIA SAMPLE', lines: ['Water is sealed into a sterile bag to test', 'for E. coli or traces of species DNA —', 'life the eye never sees.'] },
  { n: 13, x: 318, y: 808, title: 'TRAINING A VOLUNTEER', lines: ['An experienced ranger walks a newcomer', 'through the method. No science degree', 'needed — anyone can be trained.'] },
  { n: 14, x: 430, y: 478, title: 'COMMON LOON', lines: ['Gavia immer — a clean-water indicator.', 'Loons nest only where the fish and', 'water stay healthy.'] },
  { n: 15, x: 1012, y: 604, title: 'ANGLER CATCH LOG', lines: ['Anglers record what they catch and where.', 'Citizen catch data helps track fish', 'populations across the lakes.'] },
]
const tpPos = (tp) => ({ x: tp.x != null ? tp.x : tp.sy, y: tp.y != null ? tp.y : shoreY(tp.sy) + (tp.off || 0) })

// ── tiny colour utils ──────────────────────────────────────────────────────
function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16)
  const r = clamp((n >> 16) + amt, 0, 255), g = clamp(((n >> 8) & 255) + amt, 0, 255), b = clamp((n & 255) + amt, 0, 255)
  return `rgb(${r},${g},${b})`
}

// ── long golden-hour shadow (sun upper-right → shadow lower-left) ─────────
function castShadow(ctx, x, y, w) {
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(0.06)
  ctx.scale(1, 0.3)
  const g = ctx.createLinearGradient(0, 0, -w * 3.2, 0)
  g.addColorStop(0, 'rgba(74,44,20,0.30)')
  g.addColorStop(1, 'rgba(74,44,20,0)')
  ctx.fillStyle = g
  ctx.beginPath(); ctx.ellipse(-w * 1.35, 6, w * 1.9, w * 0.62, 0, 0, TAU); ctx.fill()
  ctx.fillStyle = 'rgba(74,44,20,0.22)'
  ctx.beginPath(); ctx.ellipse(0, 4, w * 0.62, w * 0.4, 0, 0, TAU); ctx.fill()
  ctx.restore()
}

// ── articulated character ──────────────────────────────────────────────────
const SKIN = ['#9a6844', '#b07a50', '#d3a578', '#82573a', '#e8bd94', '#6e452c']
const TOPS = ['#b3552e', '#3d6b8f', '#c2903a', '#6a4fa4', '#3f7d54', '#a83a4e', '#2e8fa6', '#e8e4da', '#f0a63a', '#5a6470']
const BOTTOMS = ['#2a3040', '#4a3a2e', '#33454f', '#5a5248', '#71624e']
const HAIRC = ['#241812', '#4a3018', '#181210', '#c8c2b8', '#3a2416', '#8a5a30']

/**
 * person2 — 100-unit-tall articulated figure (feet at origin), scaled by h.
 *
 * Arm convention (holds AFTER any flip, so +x is always "forward/facing"):
 *   armR / armL = { u, f }
 *     u = shoulder angle. 0 = arm hangs straight down. POSITIVE = raised
 *         FORWARD (toward +x / the way the figure faces). Negative = back.
 *     f = elbow bend. 0 = straight. Positive = forearm folds forward.
 *   armR is the NEAR arm (drawn in front of the torso).
 *   armL is the FAR arm (drawn behind the torso, shaded darker).
 * If `walk` (phase) is set and an arm isn't given, it auto-counter-swings.
 *
 * o: { x, y, h, flip, skin, top, bottom, hair, hairStyle, stance, walk,
 *      armL, armR, nod, shadow, lean }
 */
// person2 — compatibility shim mapping the old rig's calls onto the new
// illustrated figure painter (welcomePeople.drawPerson). Every existing
// character + its animation upgrades to the detailed art with no call-site
// changes.
function person2(ctx, o) {
  const wd = WARDROBE[(o.top || 0) % WARDROBE.length]
  const skin = SKINS[(o.skin || 0) % SKINS.length]
  const hair = HAIRS[(o.hair || 0) % HAIRS.length]
  let hairStyle = o.hairStyle || 'short'
  let hat = 'none'
  if (hairStyle === 'cap') { hat = 'cap'; hairStyle = 'short' }
  else if (hairStyle === 'sun') { hat = 'sun'; hairStyle = 'braid' }
  else if (hairStyle === 'toque') { hat = 'toque'; hairStyle = 'short' }
  const phase = o.walk ?? o.phase
  let pose
  if (phase != null) pose = { type: 'walk', phase }
  else if (o.stance === 'crouch') pose = { type: 'kneel', k: 1 }
  else if (o.stance === 'sit') pose = { type: 'sit' }
  else pose = { type: 'stand' }
  const mapArm = (a) => (a ? { s: a.u ?? 0.14, e: a.f ?? 0.15 } : undefined)
  return drawPerson(ctx, {
    x: o.x, y: o.y, h: o.h || 100, flip: o.flip,
    skin, hair, hairStyle, hat, vest: o.vest,
    jacket: wd.jacket, pants: wd.pants, shirt: wd.shirt,
    pose, armL: mapArm(o.armL), armR: mapArm(o.armR),
    headTurn: o.nod != null ? Math.sin(o.nod) * 0.3 : 0,
    // real clock so every figure idles (breathes/sways) instead of freezing
    t: performance.now() / 1000,
  })
}

// ── boats & props ──────────────────────────────────────────────────────────
function canoeSide(ctx, w, hull, line) {
  ctx.fillStyle = hull; ctx.strokeStyle = line; ctx.lineWidth = w * 0.05; ctx.lineJoin = 'round'
  ctx.beginPath()
  ctx.moveTo(-w, -w * 0.06)
  ctx.quadraticCurveTo(0, w * 0.3, w, -w * 0.06)
  ctx.lineTo(w * 0.86, w * 0.14)
  ctx.quadraticCurveTo(0, w * 0.46, -w * 0.86, w * 0.14)
  ctx.closePath(); ctx.fill(); ctx.stroke()
  // sheer highlight
  ctx.strokeStyle = 'rgba(255,220,160,0.5)'; ctx.lineWidth = w * 0.03
  ctx.beginPath(); ctx.moveTo(-w * 0.9, -w * 0.045); ctx.quadraticCurveTo(0, w * 0.26, w * 0.9, -w * 0.045); ctx.stroke()
}

function gull(ctx, x, y, s, ph) {
  ctx.strokeStyle = 'rgba(245,248,252,0.9)'; ctx.lineWidth = 2 * s; ctx.lineCap = 'round'
  const f = Math.sin(ph) * 5 * s
  ctx.beginPath()
  ctx.moveTo(x - 8 * s, y); ctx.quadraticCurveTo(x - 3 * s, y - f, x, y)
  ctx.quadraticCurveTo(x + 3 * s, y - f, x + 8 * s, y)
  ctx.stroke()
}

function glassCard(ctx, x, y, lines) {
  ctx.save()
  ctx.font = '600 15px "DM Sans", system-ui, sans-serif'
  let w = 0
  for (const l of lines) w = Math.max(w, ctx.measureText(l).width)
  w += 28
  const h = 16 + lines.length * 20
  const cx = clamp(x, 20, VW - w - 20), cy = clamp(y - h - 16, 16, VH - h - 16)
  ctx.fillStyle = 'rgba(8,20,34,0.78)'
  ctx.strokeStyle = 'rgba(160,215,250,0.45)'; ctx.lineWidth = 1.4
  ctx.beginPath(); ctx.roundRect(cx, cy, w, h, 10); ctx.fill(); ctx.stroke()
  lines.forEach((l, i) => {
    ctx.fillStyle = i === 0 ? '#8fd8c8' : '#dcecfa'
    ctx.fillText(l, cx + 14, cy + 24 + i * 20)
  })
  ctx.restore()
}

// granite slab with lichen (Canadian Shield)
function granite(ctx, x, y, w, h, seed) {
  ctx.save(); ctx.translate(x, y)
  const g = ctx.createLinearGradient(0, -h, 0, h * 0.4)
  g.addColorStop(0, '#b39a8a'); g.addColorStop(0.45, '#8d7a70'); g.addColorStop(1, '#66584f')
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.moveTo(-w, h * 0.3)
  ctx.quadraticCurveTo(-w * 0.85, -h * 0.5, -w * 0.4, -h * 0.78)
  ctx.quadraticCurveTo(0, -h * 1.06, w * 0.5, -h * 0.7)
  ctx.quadraticCurveTo(w * 0.95, -h * 0.36, w, h * 0.3)
  ctx.closePath(); ctx.fill()
  // sun-warm top light
  ctx.fillStyle = 'rgba(255,206,140,0.30)'
  ctx.beginPath()
  ctx.moveTo(-w * 0.36, -h * 0.76)
  ctx.quadraticCurveTo(0, -h * 1.02, w * 0.48, -h * 0.68)
  ctx.quadraticCurveTo(w * 0.1, -h * 0.66, -w * 0.36, -h * 0.76)
  ctx.closePath(); ctx.fill()
  // cracks
  ctx.strokeStyle = 'rgba(40,30,24,0.4)'; ctx.lineWidth = 1.6
  ctx.beginPath()
  ctx.moveTo(-w * 0.5, -h * 0.3); ctx.quadraticCurveTo(-w * 0.2, -h * 0.1, -w * 0.28, h * 0.2)
  ctx.moveTo(w * 0.24, -h * 0.5); ctx.quadraticCurveTo(w * 0.4, -h * 0.1, w * 0.3, h * 0.24)
  ctx.stroke()
  // lichen spots
  for (let i = 0; i < 6; i++) {
    const lx = Math.sin(seed + i * 2.4) * w * 0.6
    const ly = -h * 0.5 + ((seed * 7 + i * 13) % 10) / 10 * h * 0.7
    ctx.fillStyle = i % 2 ? 'rgba(158,168,108,0.4)' : 'rgba(190,186,140,0.35)'
    ctx.beginPath(); ctx.ellipse(lx, ly, 7 + (i % 3) * 4, 4 + (i % 2) * 3, 0.4, 0, TAU); ctx.fill()
  }
  ctx.restore()
}

function grassBlades(ctx, x, y, n, hgt, t, dark) {
  for (let i = 0; i < n; i++) {
    const bx = x + (i - n / 2) * 9
    const sway = Math.sin(t * 1.3 + i * 0.8 + x * 0.02) * 0.14
    ctx.strokeStyle = dark ? (i % 2 ? '#3d5530' : '#4c6a3a') : (i % 2 ? '#57713d' : '#6c8a4a')
    ctx.lineWidth = 3.4; ctx.lineCap = 'round'
    ctx.save(); ctx.translate(bx, y); ctx.rotate(sway)
    ctx.beginPath(); ctx.moveTo(0, 0)
    ctx.quadraticCurveTo(6, -hgt * 0.55, (i % 3 - 1) * 16, -hgt - (i % 4) * 10)
    ctx.stroke(); ctx.restore()
  }
}

// ── the scene ──────────────────────────────────────────────────────────────
export const shoreScene = {
  setup({ rnd }) {
    // sun-glitter field: sparks scattered in the sun's reflection corridor
    const glints = makeParticles(150, () => {
      const py = HZ + 6 + Math.pow(rnd(), 1.4) * 300
      const spread = 30 + (py - HZ) * 1.15
      return {
        x: SUNX - 60 + (rnd() - 0.5) * spread * 2, y: py,
        ph: rnd() * TAU, sp: 1.2 + rnd() * 2.6, len: 3 + rnd() * 9,
      }
    })
    return {
      par: { x: 0, y: 0 },
      glints,
      swells: makeParticles(14, (i) => ({
        x: rnd() * VW, y: HZ + 30 + rnd() * 240, rx: 160 + rnd() * 260,
        v: 4 + rnd() * 7, dark: i % 2,
      })),
      clouds: makeParticles(7, (i) => ({
        x: rnd() * VW, y: 46 + rnd() * 180, r: 100 + rnd() * 170,
        v: 2 + rnd() * 4, sq: 0.13 + rnd() * 0.08, warm: i % 2,
      })),
      ripples: [], lastRip: 0,
      fish: makeParticles(4, (i) => ({ x: rnd() * 500, dir: rnd() > 0.5 ? 1 : -1, sp: 14 + rnd() * 14, ph: rnd() * TAU, lane: i })),
      ducks: makeParticles(3, (i) => ({ x: 250 + i * 46, ph: rnd() * TAU, dab: rnd() * 9 })),
      dragonflies: makeParticles(2, (i) => ({ x: 300 + i * 800, y: 780, ph: rnd() * TAU })),
      geesePh: rnd() * 40,
      sandPuffs: [],
      active: null, // pinned touch-point index (click to keep its card open)
    }
  },

  draw(ctx, t, dt, s, env) {
    const p = env.pointer
    const tx = p.inside ? clamp((p.x - VW / 2) / (VW / 2), -1, 1) : 0
    const ty = p.inside ? clamp((p.y - VH / 2) / (VH / 2), -1, 1) : 0
    s.par.x = lerp(s.par.x, tx, Math.min(1, dt * 2.2))
    s.par.y = lerp(s.par.y, ty, Math.min(1, dt * 2.2))
    const par = (f, fn) => { ctx.save(); ctx.translate(-s.par.x * f, -s.par.y * f * 0.4); fn(); ctx.restore() }

    // ═══ SKY — layered, atmospheric ═══
    ctx.fillStyle = vGrad(ctx, 0, -40, HZ + 30, [
      [0, '#26355c'], [0.3, '#5c5378'], [0.55, '#a06a70'], [0.76, '#d98e63'], [0.92, '#f0b36e'], [1, '#f8cd85'],
    ])
    ctx.fillRect(0, -40, VW, HZ + 80)

    par(5, () => {
      // hazy environmental sun — small disc, gentle bloom, kept below clipping
      ctx.save(); ctx.globalCompositeOperation = 'lighter'
      glow(ctx, SUNX, SUNY, 150, 'rgba(255,196,120,0.12)', 'rgba(255,196,120,0)')
      glow(ctx, SUNX, SUNY, 74, 'rgba(255,220,160,0.22)', 'rgba(255,214,150,0)')
      ctx.restore()
      // small warm sun disc, partly veiled by haze (soft rim, no white-hot core)
      const sd = ctx.createRadialGradient(SUNX, SUNY - 5, 3, SUNX, SUNY, 26)
      sd.addColorStop(0, '#ffe9c2'); sd.addColorStop(0.7, '#ffd79a'); sd.addColorStop(1, '#f6bf7e')
      ctx.fillStyle = sd
      ctx.beginPath(); ctx.arc(SUNX, SUNY, 24, 0, TAU); ctx.fill()
      // a thin haze band drifting across the sun's face keeps it from blowing out
      ctx.save(); ctx.globalCompositeOperation = 'source-over'
      ctx.fillStyle = 'rgba(210,150,120,0.16)'
      ctx.beginPath(); ctx.ellipse(SUNX, SUNY + 4 + Math.sin(t * 0.2) * 2, 30, 7, 0, 0, TAU); ctx.fill()
      ctx.restore()
      // horizon haze bands (soft, low — no bright smear)
      ctx.save(); ctx.globalCompositeOperation = 'lighter'
      ctx.fillStyle = 'rgba(250,196,130,0.16)'
      ctx.beginPath(); ctx.ellipse(SUNX - 60, HZ - 8, 520, 20, 0, 0, TAU); ctx.fill()
      ctx.fillStyle = 'rgba(244,186,128,0.10)'
      ctx.beginPath(); ctx.ellipse(700, HZ - 20, 820, 16, 0, 0, TAU); ctx.fill()
      ctx.restore()

      // ── soft god-rays fanning from the sun (wide soft-edged gradient wedges,
      //    no blur filter — cheap) ──
      ctx.save()
      ctx.globalCompositeOperation = 'lighter'
      ctx.translate(SUNX, SUNY)
      for (let i = 0; i < 6; i++) {
        const a = -0.85 + i * 0.3 + Math.sin(t * 0.4 + i * 1.3) * 0.05
        ctx.save(); ctx.rotate(a)
        const g = ctx.createLinearGradient(0, 0, 0, 640)
        g.addColorStop(0, `rgba(255,232,180,${(0.022 + 0.012 * Math.sin(t * 0.5 + i)).toFixed(3)})`)
        g.addColorStop(1, 'rgba(255,232,180,0)')
        ctx.fillStyle = g
        // triangular wedge with soft feathered sides via a couple of steps
        ctx.beginPath(); ctx.moveTo(-4, 0); ctx.lineTo(-60, 640); ctx.lineTo(60, 640); ctx.lineTo(4, 0); ctx.closePath(); ctx.fill()
        ctx.restore()
      }
      ctx.restore()
    })

    // clouds — billowy clusters of soft puffs (not flat ovals): cooler tops,
    // a warm sun-lit underside, irregular silhouettes, slow independent drift.
    par(10, () => {
      // deterministic lump layout per cloud (dx·r, dy·r, radius scale)
      const PUFFS = [[0, 0, 1.0], [-0.58, 0.14, 0.64], [0.52, 0.12, 0.70], [-0.2, -0.2, 0.6], [0.24, -0.16, 0.54], [0.86, 0.2, 0.44]]
      s.clouds.forEach((c) => {
        c.x += c.v * dt; if (c.x - c.r > VW + 320) c.x = -c.r - 320
        const tint = c.warm ? [124, 102, 122] : [98, 90, 122]
        // body — overlapping cool puffs build an uneven billow
        for (const [dx, dy, rs] of PUFFS) {
          const px = c.x + dx * c.r * 0.92
          const py = c.y + dy * c.r * 0.42
          const pr = c.r * rs * (0.5 + c.sq * 1.2)
          const g = ctx.createRadialGradient(px, py - pr * 0.25, pr * 0.1, px, py, pr)
          g.addColorStop(0, `rgba(${tint[0]},${tint[1]},${tint[2]},0.46)`)
          g.addColorStop(0.68, `rgba(${tint[0]},${tint[1]},${tint[2]},0.24)`)
          g.addColorStop(1, `rgba(${tint[0]},${tint[1]},${tint[2]},0)`)
          ctx.fillStyle = g
          ctx.beginPath(); ctx.arc(px, py, pr, 0, TAU); ctx.fill()
        }
        // warm sun-lit underside, brighter on the sun side (right)
        const uy = c.y + c.r * 0.34
        const lg = ctx.createRadialGradient(c.x + c.r * 0.3, uy, 0, c.x + c.r * 0.3, uy, c.r * 0.95)
        lg.addColorStop(0, 'rgba(255,198,134,0.30)'); lg.addColorStop(1, 'rgba(255,198,134,0)')
        ctx.fillStyle = lg
        ctx.beginPath(); ctx.ellipse(c.x + c.r * 0.3, uy, c.r * 0.95, c.r * 0.42, 0, 0, TAU); ctx.fill()
      })
    })

    // geese V + gulls
    par(14, () => {
      s.geesePh += dt
      const gx = ((s.geesePh * 30) % (VW + 700)) - 350
      ctx.strokeStyle = 'rgba(42,34,30,0.75)'; ctx.lineWidth = 2.4; ctx.lineCap = 'round'
      for (let i = 0; i < 7; i++) {
        const row = Math.ceil(i / 2), side = i === 0 ? 0 : (i % 2 ? -1 : 1)
        const bx = gx - row * 28, by = 96 + side * row * 14
        const f = Math.sin(t * 7 + i) * 5
        ctx.beginPath()
        ctx.moveTo(bx - 9, by); ctx.quadraticCurveTo(bx - 3, by - f, bx, by)
        ctx.quadraticCurveTo(bx + 3, by - f, bx + 9, by); ctx.stroke()
      }
      // gulls: two wheeling flocks + two crossing the whole sky
      for (let i = 0; i < 3; i++) {
        const a = t * 0.3 + i * 2.1
        gull(ctx, 1080 + Math.cos(a) * 130, 255 + Math.sin(a * 1.3) * 42, 0.85, t * 6 + i * 2)
      }
      for (let i = 0; i < 2; i++) {
        const a = t * 0.24 + i * 2.8
        gull(ctx, 420 + Math.cos(a) * 100, 200 + Math.sin(a * 1.5) * 30, 0.7, t * 5.4 + i * 1.7)
      }
      const cg1 = ((t * 46) % (VW + 300)) - 150
      gull(ctx, cg1, 168 + Math.sin(t * 1.8) * 10, 1.05, t * 7)
      const cg2 = VW - (((t + 6) * 38) % (VW + 300)) + 150
      ctx.save(); ctx.translate(cg2, 232 + Math.sin(t * 1.5) * 8); ctx.scale(-1, 1)
      gull(ctx, 0, 0, 0.9, t * 6.4 + 2)
      ctx.restore()
    })

    // ═══ FAR SHORE (slightly defocused for atmospheric depth) ═══
    par(18, () => {
      // far ridge
      ctx.fillStyle = 'rgba(128,100,112,0.6)'
      ctx.beginPath(); ctx.moveTo(-40, HZ)
      ctx.bezierCurveTo(260, HZ - 26, 620, HZ - 6, 940, HZ - 20)
      ctx.bezierCurveTo(1200, HZ - 32, 1440, HZ - 8, 1660, HZ - 22)
      ctx.lineTo(1660, HZ + 5); ctx.lineTo(-40, HZ + 5); ctx.closePath(); ctx.fill()
      // left island chain
      ctx.fillStyle = '#5a525c'
      ctx.beginPath(); ctx.moveTo(120, HZ + 3); ctx.quadraticCurveTo(200, HZ - 20, 300, HZ + 3); ctx.closePath(); ctx.fill()
      ctx.beginPath(); ctx.moveTo(360, HZ + 3); ctx.quadraticCurveTo(410, HZ - 11, 470, HZ + 3); ctx.closePath(); ctx.fill()
      ctx.fillStyle = '#42424c'
      for (let x = 150; x < 290; x += 17) {
        ctx.beginPath(); ctx.moveTo(x, HZ - 3 - ((x * 7) % 6))
        ctx.lineTo(x - 4, HZ + 2); ctx.lineTo(x + 4, HZ + 2); ctx.closePath(); ctx.fill()
      }
      // right headland with pines + lighthouse
      ctx.fillStyle = '#57474e'
      ctx.beginPath(); ctx.moveTo(1290, HZ + 4)
      ctx.quadraticCurveTo(1420, HZ - 34, 1660, HZ - 14)
      ctx.lineTo(1660, HZ + 6); ctx.closePath(); ctx.fill()
      ctx.fillStyle = '#3c3540'
      for (let x = 1320; x < 1640; x += 15) {
        const hb = HZ - 12 - Math.sin((x - 1290) * 0.012) * 16
        ctx.beginPath(); ctx.moveTo(x, hb - 9 - ((x * 7) % 7))
        ctx.lineTo(x - 4.4, hb + 4); ctx.lineTo(x + 4.4, hb + 4); ctx.closePath(); ctx.fill()
      }
      // lighthouse
      ctx.fillStyle = '#e8e0d2'
      ctx.beginPath(); ctx.moveTo(1452, HZ - 34); ctx.lineTo(1456, HZ - 62); ctx.lineTo(1466, HZ - 62); ctx.lineTo(1470, HZ - 34); ctx.closePath(); ctx.fill()
      ctx.fillStyle = '#b8453a'; ctx.fillRect(1454.5, HZ - 68, 13, 7)
      const lit = (t % 3) < 0.4
      ctx.fillStyle = lit ? '#ffe9a8' : '#8a8478'
      ctx.fillRect(1457.5, HZ - 66.4, 7, 4)
      if (lit) glow(ctx, 1461, HZ - 64, 16, 'rgba(255,233,168,0.6)', 'rgba(255,233,168,0)')
      // community strip + warm windows
      ctx.fillStyle = '#3c3540'
      for (const [hx, hh] of [[1502, 8], [1526, 11], [1552, 9], [1580, 12], [1606, 8]]) {
        ctx.fillRect(hx - 6, HZ - 14 - hh, 12, hh)
        ctx.beginPath(); ctx.moveTo(hx - 7.4, HZ - 14 - hh); ctx.lineTo(hx, HZ - 20 - hh); ctx.lineTo(hx + 7.4, HZ - 14 - hh); ctx.closePath(); ctx.fill()
        if (Math.sin(t * 0.6 + hx) > -0.3) { ctx.fillStyle = 'rgba(255,198,110,0.9)'; ctx.fillRect(hx - 1.6, HZ - 12 - hh + 2, 3, 3); ctx.fillStyle = '#3c3540' }
      }
    })

    // ═══ THE LAKE — depth-graded, glitter path, drifting swells ═══
    ctx.fillStyle = vGrad(ctx, 0, HZ, VH, [
      [0, '#e8b788'], [0.09, '#c39a80'], [0.2, '#8d8b88'], [0.36, '#5c7d92'], [0.55, '#3d7290'], [0.78, '#2f7d94'], [1, '#37918f'],
    ])
    ctx.fillRect(0, HZ, VW, VH - HZ)

    // soft cloud shadows on the water — radial-gradient ellipses (soft edge,
    // no blur filter)
    for (const c of s.clouds) {
      const shx = c.x - s.par.x * 6, shy = HZ + 50 + (c.y / 240) * 70
      const rw = c.r * 1.15, rh = c.r * 0.18
      const g = ctx.createRadialGradient(shx, shy, 0, shx, shy, rw)
      g.addColorStop(0, 'rgba(16,36,54,0.10)'); g.addColorStop(0.7, 'rgba(16,36,54,0.05)'); g.addColorStop(1, 'rgba(16,36,54,0)')
      ctx.save(); ctx.translate(shx, shy); ctx.scale(1, rh / rw)
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, rw, 0, TAU); ctx.fill()
      ctx.restore()
    }

    par(8, () => {
      // mirror bloom under the sun — soft, low, well below clipping
      ctx.save(); ctx.globalCompositeOperation = 'lighter'
      ctx.save(); ctx.translate(SUNX - 40, HZ + 6); ctx.scale(1, 0.14)
      glow(ctx, 0, 0, 300, 'rgba(255,224,164,0.24)', 'rgba(255,224,164,0)')
      ctx.restore()
      // reflection: a BROKEN column of small dashes shivering on the wave field —
      // never solid strips. Each row is split into a few short glints with gaps,
      // and it fades toward the viewer so the near lake stays readable teal.
      for (let i = 0; i < 26; i++) {
        const q = i / 26
        const y = HZ + 8 + q * 340
        const cxr = SUNX - 30 - q * 60 // reflection drifts with perspective
        const rowA = (1 - q) * 0.14 * (0.6 + 0.4 * Math.sin(t * 2.4 + i))
        if (rowA < 0.012) continue
        const dashes = 2 + (i % 3) // 2–4 broken pieces per row
        for (let d = 0; d < dashes; d++) {
          const off = (d - (dashes - 1) / 2)
          const wob = Math.sin(t * 2.1 + i * 0.8 + d * 1.7) * (3 + i * 1.2)
          const dw = 10 + (i % 4) * 6 + Math.abs(Math.sin(i + d)) * 8
          const gap = Math.sin(t * 3 + i * 2 + d) // random shimmer on/off
          if (gap < -0.35) continue
          ctx.fillStyle = `rgba(255,222,158,${rowA.toFixed(3)})`
          ctx.beginPath(); ctx.ellipse(cxr + wob + off * (34 + i * 2), y, dw, 1.8 + i * 0.14, 0, 0, TAU); ctx.fill()
        }
      }
      ctx.restore()

      // broad drifting swells (shadow + light lobes — no stroke lines)
      for (const sw of s.swells) {
        sw.x -= sw.v * dt
        if (sw.x < -sw.rx - 100) sw.x = VW + sw.rx
        const a = 0.045 * (1 - (sw.y - HZ) / 380 * 0.4)
        ctx.fillStyle = sw.dark ? `rgba(16,44,64,${a.toFixed(3)})` : `rgba(240,248,255,${(a * 0.9).toFixed(3)})`
        ctx.beginPath(); ctx.ellipse(sw.x, sw.y, sw.rx, 7 + (sw.y - HZ) * 0.03, 0, 0, TAU); ctx.fill()
      }

      // live glitter field in the sun corridor — small, sparse, never a sheet
      ctx.save(); ctx.globalCompositeOperation = 'lighter'
      for (const g of s.glints) {
        const tw2 = Math.max(0, Math.sin(t * g.sp + g.ph))
        if (tw2 < 0.45) continue
        const a = 0.32 * tw2 * (1 - (g.y - HZ) / 420)
        ctx.fillStyle = `rgba(255,226,158,${a.toFixed(3)})`
        ctx.fillRect(g.x - g.len * tw2 * 0.4, g.y, g.len * tw2 * 0.8, 1.5)
      }
      ctx.restore()
    })

    // ═══ MID-LAKE ACTORS ═══
    par(12, () => {
      // distant kayak crossing
      const kx = ((t * 12) % (VW + 300)) - 150
      ctx.save(); ctx.translate(kx, 420 + Math.sin(t * 1.7) * 1.6); ctx.scale(0.55, 0.55)
      ctx.fillStyle = '#b84a28'
      ctx.beginPath(); ctx.moveTo(-26, 2); ctx.quadraticCurveTo(0, 9, 26, 2); ctx.quadraticCurveTo(0, 12, -26, 2); ctx.fill()
      ctx.fillStyle = '#3a2e26'; ctx.beginPath(); ctx.arc(0, -6, 5.4, 0, TAU); ctx.fill()
      const pa = Math.sin(t * 3.2)
      ctx.save(); ctx.translate(0, -6); ctx.rotate(pa * 0.5)
      ctx.strokeStyle = '#e8d9a0'; ctx.lineWidth = 2.4
      ctx.beginPath(); ctx.moveTo(-18, 7); ctx.lineTo(18, -7); ctx.stroke()
      ctx.restore(); ctx.restore()
      ctx.strokeStyle = 'rgba(245,250,255,0.22)'; ctx.lineWidth = 1.6
      ctx.beginPath(); ctx.moveTo(kx - 16, 426); ctx.quadraticCurveTo(kx - 42, 428, kx - 70, 426); ctx.stroke()

      // loon with dive cycle
      const dv = t % 12
      const lx = 430 + Math.sin(t * 0.12) * 50
      if (dv < 8.4) {
        const sink = dv > 8 ? (dv - 8) * 20 : 0
        ctx.save(); ctx.translate(lx, 478 + Math.sin(t * 1.4) * 1.6 + sink)
        ctx.globalAlpha = dv > 8 ? 1 - (dv - 8) * 2.4 : 1
        ctx.scale(0.85, 0.85)
        ctx.fillStyle = '#1d2a30'
        ctx.beginPath(); ctx.ellipse(0, 0, 13, 5.4, 0, 0, TAU); ctx.fill()
        ctx.lineWidth = 4; ctx.strokeStyle = '#1d2a30'
        ctx.beginPath(); ctx.moveTo(9, -2); ctx.quadraticCurveTo(15, -12, 12, -15); ctx.stroke()
        ctx.beginPath(); ctx.arc(14, -13, 3, 0, TAU); ctx.fill()
        ctx.fillStyle = '#e8f0f4'; ctx.fillRect(10, -9, 4.4, 1.6)
        ctx.restore()
        ctx.strokeStyle = 'rgba(245,250,255,0.2)'; ctx.lineWidth = 1.4
        ctx.beginPath(); ctx.moveTo(lx - 30, 482); ctx.quadraticCurveTo(lx - 14, 484, lx + 4, 482); ctx.stroke()
      } else if (dv < 9) {
        const rp = (dv - 8.4) / 0.6
        ctx.strokeStyle = `rgba(240,248,255,${(0.45 * (1 - rp)).toFixed(3)})`; ctx.lineWidth = 1.8
        ctx.beginPath(); ctx.ellipse(lx, 480, 6 + rp * 22, (6 + rp * 22) * 0.3, 0, 0, TAU); ctx.stroke()
      }

      // fish briefly breaking the surface
      const jc = (t % 10.5) / 10.5
      if (jc > 0.64 && jc < 0.75) {
        const jp = (jc - 0.64) / 0.11
        const fx = 700 + jp * 46, fy = 505 - Math.sin(jp * Math.PI) * 48
        // leap head-first in the travel direction (nose right, tail left)
        ctx.save(); ctx.translate(fx, fy); ctx.rotate((jp - 0.5) * 1.7); ctx.scale(0.72, 0.72)
        ctx.fillStyle = '#48707f'
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(-9, -10, -21, -6); ctx.quadraticCurveTo(-17, -2, -21, 2); ctx.quadraticCurveTo(-9, 7, 0, 0); ctx.fill()
        ctx.beginPath(); ctx.moveTo(-21, -6); ctx.lineTo(-29, -10); ctx.lineTo(-26, -2); ctx.lineTo(-29, 5); ctx.lineTo(-21, 2); ctx.closePath(); ctx.fill()
        ctx.restore()
        if (jp > 0.8) {
          const rp = (jp - 0.8) / 0.2
          ctx.strokeStyle = `rgba(245,250,255,${(0.5 * (1 - rp)).toFixed(3)})`; ctx.lineWidth = 1.8
          ctx.beginPath(); ctx.ellipse(748, 508, rp * 40, rp * 11, 0, 0, TAU); ctx.stroke()
        }
      }

      // ── research boat, anchored + bobbing ──
      const bb = Math.sin(t * 1.05) * 2.6
      ctx.save(); ctx.translate(845, 508 + bb); ctx.rotate(Math.sin(t * 1.05) * 0.018)
      ctx.scale(0.8, 0.8)
      // hull reflection + shadow in water
      ctx.fillStyle = 'rgba(14,36,50,0.30)'
      ctx.beginPath(); ctx.ellipse(-2, 16, 66, 8, 0, 0, TAU); ctx.fill()
      // aluminum research skiff — pointed bow (left), transom + outboard (right)
      ctx.fillStyle = '#d9dee3'; ctx.strokeStyle = '#5b6770'; ctx.lineWidth = 2.2; ctx.lineJoin = 'round'
      ctx.beginPath()
      ctx.moveTo(-68, 2)
      ctx.quadraticCurveTo(-60, -8, -38, -10)
      ctx.lineTo(52, -10)
      ctx.lineTo(52, 10)
      ctx.lineTo(-42, 10)
      ctx.quadraticCurveTo(-58, 9, -68, 2)
      ctx.closePath(); ctx.fill(); ctx.stroke()
      // hull shading + red waterline stripe + lit gunwale
      const hgd = ctx.createLinearGradient(0, -10, 0, 10)
      hgd.addColorStop(0, 'rgba(255,255,255,0.35)'); hgd.addColorStop(0.6, 'rgba(90,110,125,0)'); hgd.addColorStop(1, 'rgba(40,56,66,0.35)')
      ctx.fillStyle = hgd; ctx.fill()
      ctx.fillStyle = '#bd4a3c'
      ctx.beginPath()
      ctx.moveTo(-60, 4); ctx.lineTo(52, 4); ctx.lineTo(52, 7); ctx.lineTo(-56, 7); ctx.closePath(); ctx.fill()
      ctx.strokeStyle = 'rgba(255,214,150,0.55)'; ctx.lineWidth = 1.6
      ctx.beginPath(); ctx.moveTo(-38, -10); ctx.lineTo(52, -10); ctx.stroke()
      // console + antenna + running light
      ctx.fillStyle = '#aab4bc'; ctx.fillRect(4, -24, 17, 15)
      ctx.fillStyle = '#3a4650'; ctx.fillRect(4, -24, 17, 3.4)
      ctx.strokeStyle = '#5b6770'; ctx.lineWidth = 2
      ctx.beginPath(); ctx.moveTo(19, -24); ctx.lineTo(19, -42); ctx.stroke()
      ctx.fillStyle = Math.sin(t * 4) > 0 ? '#5eead4' : '#2b6b60'
      ctx.beginPath(); ctx.arc(19, -44, 2.4, 0, TAU); ctx.fill()
      // outboard motor on the transom
      ctx.fillStyle = '#3a4650'
      ctx.beginPath(); ctx.roundRect(52, -16, 10, 11, 2.5); ctx.fill()
      ctx.fillRect(55.5, -5, 3.4, 16)
      ctx.strokeStyle = 'rgba(240,248,255,0.3)'; ctx.lineWidth = 1.4
      ctx.beginPath(); ctx.ellipse(60, 13, 7 + Math.sin(t * 2.2) * 1.5, 2, 0, 0, TAU); ctx.stroke()
      // anchor + sonde winch line
      ctx.strokeStyle = '#3a4650'; ctx.lineWidth = 1.6
      ctx.beginPath(); ctx.moveTo(-36, -4); ctx.lineTo(-36 + Math.sin(t * 0.8) * 3, 26); ctx.stroke()
      // researcher 1: bends over the side, hauls the sample, stands to inspect
      const rT = t % 9
      let bend = 0, inspect = 0
      if (rT < 1.4) bend = ease2(rT / 1.4)
      else if (rT < 3.4) bend = 1
      else if (rT < 4.8) bend = 1 - ease2((rT - 3.4) / 1.4)
      else if (rT < 7.4) inspect = Math.sin(((rT - 4.8) / 2.6) * Math.PI)
      person2(ctx, {
        x: -26, y: -9, h: 46, skin: 3, top: 7, bottom: 2, hairStyle: 'cap', hair: 2, vest: true, shadow: false,
        lean: -bend * 0.3,
        armR: { u: 0.2 + bend * 1.1 + inspect * 1.05, f: 0.35 + bend * 0.3 },
        armL: { u: 0.15 + bend * 1.0 + inspect * 0.5, f: 0.3 + bend * 0.3 },
        nod: inspect * 2.4,
      })
      if (inspect > 0.15) { // lifted sample bottle catching the light
        ctx.fillStyle = `rgba(214,238,248,${(0.9 * inspect).toFixed(3)})`
        ctx.fillRect(-16, -46 - inspect * 4, 4.5, 7)
      }
      if (bend === 1 && Math.sin(t * 5) > 0.4) { // hauling ripple at the winch line
        ctx.strokeStyle = 'rgba(250,252,255,0.35)'; ctx.lineWidth = 1.4
        ctx.beginPath(); ctx.ellipse(-34, 22, 8, 2.4, 0, 0, TAU); ctx.stroke()
      }
      // researcher 2: reads the tablet, periodically gestures toward the buoy
      const point2 = Math.max(0, Math.sin(t * 0.45) - 0.55) / 0.45
      const r2 = person2(ctx, {
        x: 34, y: -9, h: 48, skin: 0, top: 6, bottom: 0, flip: true, hairStyle: 'bun', hair: 0, vest: true, shadow: false,
        armR: { u: 0.35 + point2 * 0.95, f: 0.95 - point2 * 0.75 },
        armL: { u: 0.3, f: 0.9 },
        nod: t * 2,
      })
      // tablet held IN the hand (position comes from the rig, not a guess)
      ctx.save(); ctx.translate(r2.nearWrist.x, r2.nearWrist.y); ctx.rotate(-0.25)
      ctx.fillStyle = '#20262c'; ctx.fillRect(-5, -3.4, 10, 6.6)
      ctx.fillStyle = 'rgba(125,220,240,0.9)'; ctx.fillRect(-4.2, -2.6, 8.4, 5)
      ctx.restore()
      ctx.restore()

      // ── monitoring buoy ──
      const by = 552 + Math.sin(t * 1.3 + 1) * 3.4
      ctx.save(); ctx.translate(640, by); ctx.rotate(Math.sin(t * 1.3) * 0.05); ctx.scale(0.85, 0.85)
      ctx.fillStyle = 'rgba(14,36,50,0.30)'
      ctx.beginPath(); ctx.ellipse(0, 15, 19, 4.4, 0, 0, TAU); ctx.fill()
      ctx.fillStyle = '#d84438'
      ctx.beginPath(); ctx.moveTo(-13, 6); ctx.lineTo(13, 6); ctx.lineTo(8, -14); ctx.lineTo(-8, -14); ctx.closePath(); ctx.fill()
      ctx.fillStyle = 'rgba(255,214,150,0.5)'
      ctx.beginPath(); ctx.moveTo(6, -14); ctx.lineTo(8, -14); ctx.lineTo(12.4, 5); ctx.lineTo(9, 5); ctx.closePath(); ctx.fill()
      ctx.fillStyle = '#f3f5f7'; ctx.fillRect(-10.5, -4, 21, 5)
      ctx.strokeStyle = '#8a8f94'; ctx.lineWidth = 2
      ctx.beginPath(); ctx.moveTo(0, -14); ctx.lineTo(0, -30); ctx.stroke()
      ctx.fillStyle = '#5a6066'; ctx.fillRect(-4.4, -23, 8.8, 4.4)
      const blink = (t % 2.2) < 0.2
      ctx.fillStyle = blink ? '#7df5df' : '#2b6b60'
      ctx.beginPath(); ctx.arc(0, -33, 3, 0, TAU); ctx.fill()
      if (blink) glow(ctx, 0, -33, 13, 'rgba(125,245,223,0.6)', 'rgba(125,245,223,0)')
      ctx.restore()
      const pr = (t % 3) / 3
      ctx.strokeStyle = `rgba(125,245,223,${(0.45 * (1 - pr)).toFixed(3)})`; ctx.lineWidth = 1.8
      ctx.beginPath(); ctx.ellipse(640, by + 12, 13 + pr * 52, (13 + pr * 52) * 0.28, 0, 0, TAU); ctx.stroke()

      // otter crossing occasionally
      const oc = t % 19
      if (oc > 14 && oc < 18) {
        const op = (oc - 14) / 4
        const ox = 180 + op * 320
        ctx.fillStyle = '#4a3626'
        for (let i = 0; i < 3; i++) {
          const oy = 560 + Math.sin(op * 13 - i * 1.4) * 4
          ctx.beginPath(); ctx.ellipse(ox - i * 14, oy, i === 0 ? 6 : 8, 4, 0, 0, TAU); ctx.fill()
        }
        ctx.strokeStyle = 'rgba(240,248,255,0.25)'; ctx.lineWidth = 1.4
        ctx.beginPath(); ctx.moveTo(ox - 46, 563); ctx.quadraticCurveTo(ox - 22, 566, ox, 561); ctx.stroke()
      }

      // ── a loose school of fish cruising just under the open-water surface ──
      for (let i = 0; i < 6; i++) {
        const speed = 24 + (i % 3) * 11
        const dir = i % 2 ? 1 : -1
        const span = VW + 220
        const march = (t * speed + i * 353) % span
        const fx = dir > 0 ? march - 110 : VW + 110 - march
        const fy = 448 + ((i * 29) % 78) + Math.sin(t * 0.8 + i) * 6
        const sz = 0.66 + (i % 3) * 0.2
        const wag = Math.sin(t * 7 + i * 1.3)
        ctx.save(); ctx.translate(fx, fy); ctx.scale(dir * sz, sz)
        ctx.fillStyle = 'rgba(38,60,62,0.5)' // body (a shadow just below the surface)
        ctx.beginPath(); ctx.ellipse(0, 0, 15, 4.4, 0, 0, TAU); ctx.fill()
        ctx.beginPath(); ctx.moveTo(-13, 0); ctx.lineTo(-22, wag * 5 - 5); ctx.lineTo(-22, wag * 5 + 5); ctx.closePath(); ctx.fill() // tail
        ctx.fillStyle = 'rgba(58,88,86,0.55)' // dorsal fin
        ctx.beginPath(); ctx.moveTo(1, -3.6); ctx.lineTo(8, -9); ctx.lineTo(9, -3.8); ctx.closePath(); ctx.fill()
        ctx.fillStyle = 'rgba(206,230,224,0.26)' // back sheen
        ctx.beginPath(); ctx.ellipse(3, -1.4, 7, 1.4, 0, 0, TAU); ctx.fill()
        ctx.fillStyle = 'rgba(12,20,22,0.6)'; ctx.beginPath(); ctx.arc(10, -1, 1.1, 0, TAU); ctx.fill() // eye
        ctx.restore()
        ctx.strokeStyle = 'rgba(230,242,238,0.10)'; ctx.lineWidth = 1.2 // surface trace overhead
        ctx.beginPath(); ctx.ellipse(fx, fy - 3, 16 * sz, 4, 0, 0, TAU); ctx.stroke()
      }

      // (removed the small in-water "swimming dog" — at this distance it read
      //  as a duck. The dog on land, walked on a leash, stays.)
    })

    // ═══ SHALLOWS → FOAM → WET SAND → BEACH ═══
    par(16, () => {
      // translucent shallows band above the waterline: sandy bottom shows through
      ctx.save()
      ctx.beginPath()
      ctx.moveTo(-40, VH + 40)
      for (let x = -40; x <= VW + 40; x += 30) ctx.lineTo(x, shoreY(x) - 130)
      ctx.lineTo(VW + 40, VH + 40); ctx.closePath(); ctx.clip()
      const sg = vGrad(ctx, 0, 480, 890, [[0, 'rgba(218,188,138,0)'], [0.5, 'rgba(214,186,136,0.35)'], [1, 'rgba(226,198,148,0.62)']])
      ctx.fillStyle = sg; ctx.fillRect(0, 430, VW, 470)
      // submerged stones w/ refraction wobble
      for (let i = 0; i < 22; i++) {
        const px2 = (i * 211.7) % VW
        const wob = Math.sin(t * 1.8 + i) * 1.6
        const py2 = shoreY(px2) - 20 - ((i * 41) % 78)
        ctx.fillStyle = `rgba(112,96,78,${0.3 - ((i * 13) % 10) / 55})`
        ctx.beginPath(); ctx.ellipse(px2 + wob, py2, 8 + (i % 4) * 3.4, 3.4 + (i % 3), 0, 0, TAU); ctx.fill()
        ctx.fillStyle = 'rgba(255,226,170,0.14)'
        ctx.beginPath(); ctx.ellipse(px2 + wob - 2, py2 - 1.6, 4 + (i % 3) * 2, 1.6, 0, 0, TAU); ctx.fill()
      }
      // aquatic plants + algae mats on the sandy bottom — a living lake grows
      // weed beds (bioindicators); they sway gently with the surface
      for (let i = 0; i < 7; i++) {
        const ax = 110 + i * 208 + Math.sin(i * 1.7) * 34
        const ay = shoreY(ax) - 22 - (i % 3) * 16
        ctx.fillStyle = `rgba(66,104,60,${(0.14 + (i % 2) * 0.06).toFixed(3)})` // algae mat
        ctx.beginPath(); ctx.ellipse(ax, ay + 2, 20 + (i % 3) * 9, 6 + (i % 2) * 2.5, 0.08, 0, TAU); ctx.fill()
        ctx.strokeStyle = 'rgba(80,128,74,0.5)'; ctx.lineWidth = 2; ctx.lineCap = 'round' // swaying fronds
        for (let b = 0; b < 4; b++) {
          const bx = ax - 13 + b * 9
          const sway = Math.sin(t * 1.3 + i + b * 0.8) * 4
          ctx.beginPath(); ctx.moveTo(bx, ay + 3)
          ctx.quadraticCurveTo(bx + sway, ay - 9, bx + sway * 1.7, ay - 19 - (b % 2) * 6); ctx.stroke()
        }
      }
      // caustic shimmer — faint drifting light cells hugging the waterline
      ctx.save(); ctx.globalCompositeOperation = 'lighter'
      for (let i = 0; i < 42; i++) {
        const cx = ((i * 173.3 + t * 16) % (VW + 80)) - 40
        const band = 14 + ((i * 37) % 82) // distance above the foam line
        const cy = shoreY(cx) - band
        const pulse = 0.5 + 0.5 * Math.sin(t * 2.2 + i * 1.7)
        const a = 0.10 * pulse * (1 - band / 100)
        if (a <= 0.008) continue
        ctx.strokeStyle = `rgba(255,244,200,${a.toFixed(3)})`
        ctx.lineWidth = 1.8
        const rw = 10 + (i % 4) * 5
        ctx.beginPath(); ctx.ellipse(cx, cy, rw, rw * 0.34, 0.1, 0, TAU); ctx.stroke()
      }
      ctx.restore()
      // fish gliding through the shallows
      for (const f of s.fish) {
        f.x += f.sp * f.dir * dt
        if (f.x > 700) { f.x = 700; f.dir = -1 }
        if (f.x < -60) { f.x = -60; f.dir = 1 }
        const fy = shoreY(f.x) - 46 - f.lane * 16
        const wag = Math.sin(t * 6 + f.ph) * 3.4
        ctx.save(); ctx.translate(f.x, fy); ctx.scale(f.dir, 1)
        ctx.fillStyle = 'rgba(52,68,64,0.42)'
        ctx.beginPath(); ctx.ellipse(2, 5, 11, 2.6, 0, 0, TAU); ctx.fill() // bottom shadow
        ctx.fillStyle = 'rgba(94,120,112,0.6)'
        ctx.beginPath(); ctx.ellipse(0, 0, 13, 4, 0, 0, TAU); ctx.fill()
        ctx.beginPath(); ctx.moveTo(-12, 0); ctx.lineTo(-19, wag - 4); ctx.lineTo(-19, wag + 4); ctx.closePath(); ctx.fill()
        ctx.fillStyle = 'rgba(220,235,230,0.3)'
        ctx.beginPath(); ctx.ellipse(2, -1.4, 6, 1.3, 0, 0, TAU); ctx.fill()
        ctx.restore()
      }
      ctx.restore()

      // ducks dabbling in the shallows
      for (const d of s.ducks) {
        const dy = shoreY(d.x) - 60 + Math.sin(t * 1.6 + d.ph) * 2
        const dab = ((t + d.dab) % 9) > 7.5
        ctx.save(); ctx.translate(d.x, dy); ctx.scale(0.9, 0.9)
        if (dab) ctx.rotate(0.9)
        ctx.fillStyle = '#5a4632'
        ctx.beginPath(); ctx.ellipse(0, 0, 10, 5.4, 0, 0, TAU); ctx.fill()
        ctx.fillStyle = 'rgba(255,214,150,0.35)'
        ctx.beginPath(); ctx.ellipse(2, -2.4, 6, 2, 0, 0, TAU); ctx.fill()
        if (!dab) {
          ctx.fillStyle = '#2e5e46'; ctx.beginPath(); ctx.arc(8, -6.5, 4, 0, TAU); ctx.fill()
          ctx.fillStyle = '#e8b13c'
          ctx.beginPath(); ctx.moveTo(11.5, -6.5); ctx.lineTo(16, -5.4); ctx.lineTo(11.5, -4.6); ctx.closePath(); ctx.fill()
        } else {
          ctx.fillStyle = '#5a4632'
          ctx.beginPath(); ctx.moveTo(-8, -2); ctx.lineTo(-13, -9); ctx.lineTo(-5, -6); ctx.closePath(); ctx.fill()
        }
        ctx.restore()
        ctx.strokeStyle = 'rgba(240,248,255,0.24)'; ctx.lineWidth = 1.4
        ctx.beginPath(); ctx.ellipse(d.x, dy + 5, 12, 2.6, 0, 0, TAU); ctx.stroke()
      }

      // incoming swell lines rolling toward the beach and breaking
      for (let b = 0; b < 3; b++) {
        const cycle = ((t * 26 + b * 46) % 130)
        const off = 130 - cycle // distance above the foam line, shrinking
        const build = 1 - off / 130
        const a = 0.05 + build * 0.16
        ctx.strokeStyle = `rgba(250,252,255,${a.toFixed(3)})`
        ctx.lineWidth = 1.6 + build * 2.6
        ctx.lineCap = 'round'
        ctx.beginPath()
        for (let x = -40; x <= VW + 40; x += 30) {
          const y = shoreY(x) - off + Math.sin(x * 0.012 + t * 1.1 + b * 2) * 4
          if (x === -40) ctx.moveTo(x, y); else ctx.lineTo(x, y)
        }
        ctx.stroke()
      }

      // ── sand body ──
      const lap = (x, off = 0) => Math.sin(x * 0.009 + (t - off) * 0.85) * 6 + Math.sin(x * 0.023 - (t - off) * 1.25) * 3.4
      ctx.beginPath()
      ctx.moveTo(-40, VH + 40)
      for (let x = -40; x <= VW + 40; x += 26) ctx.lineTo(x, shoreY(x) + lap(x))
      ctx.lineTo(VW + 40, VH + 40); ctx.closePath()
      ctx.fillStyle = vGrad(ctx, 0, 560, VH, [[0, '#d3b183'], [0.45, '#c5a273'], [1, '#a3855c']])
      ctx.fill()
      ctx.save(); ctx.clip()
      // wet mirror band: sky colours reflected just below the waterline
      ctx.beginPath()
      ctx.moveTo(-40, VH)
      for (let x = -40; x <= VW + 40; x += 26) ctx.lineTo(x, shoreY(x) + lap(x))
      for (let x = VW + 40; x >= -40; x -= 26) ctx.lineTo(x, shoreY(x) + 40 + lap(x, 1.8) * 0.6)
      ctx.closePath()
      const wet = vGrad(ctx, 0, 600, 900, [[0, 'rgba(240,196,140,0.42)'], [0.6, 'rgba(150,160,164,0.28)'], [1, 'rgba(150,160,164,0.12)']])
      ctx.fillStyle = wet; ctx.fill()
      // sun streak on the wet band
      ctx.save(); ctx.globalCompositeOperation = 'lighter'
      ctx.fillStyle = 'rgba(255,220,150,0.22)'
      ctx.beginPath(); ctx.ellipse(1050, shoreY(1050) + 18, 130, 12, 0.06, 0, TAU); ctx.fill()
      ctx.restore()
      // dry sand texture — speckles, pebble clusters
      for (let i = 0; i < 90; i++) {
        const px2 = (i * 89.3) % VW
        const py2 = shoreY(px2) + 48 + ((i * 53) % 190)
        if (py2 > VH - 4) continue
        ctx.fillStyle = i % 3 ? 'rgba(118,94,62,0.32)' : 'rgba(240,222,186,0.5)'
        ctx.beginPath(); ctx.arc(px2, py2, 1.3 + (i % 3), 0, TAU); ctx.fill()
      }
      // footprint trail arcing toward the water
      for (let i = 0; i < 9; i++) {
        const q = i / 8
        const fx = 1180 - q * 260 + Math.sin(q * 3) * 24
        const fy = VH - 30 - q * (VH - 40 - (shoreY(1180 - q * 260) + 46))
        const o2 = (i % 2 ? 7 : -7)
        ctx.fillStyle = 'rgba(96,72,44,0.30)'
        ctx.beginPath(); ctx.ellipse(fx + o2, fy, 5, 2.6, -0.5, 0, TAU); ctx.fill()
      }
      ctx.restore()

      // ── foam: leading scalloped edge + dissolving older sheets ──
      for (const [off, alpha, lw] of [[0, 0.85, 3.6], [1.8, 0.3, 2.2], [3.4, 0.14, 1.8]]) {
        ctx.strokeStyle = `rgba(250,252,255,${alpha})`
        ctx.lineWidth = lw; ctx.lineCap = 'round'
        ctx.beginPath()
        for (let x = -40; x <= VW + 40; x += 22) {
          const y = shoreY(x) + lap(x, off) + off * 7
          const scallop = Math.sin(x * 0.09 + off) * 1.6
          if (x === -40) ctx.moveTo(x, y + scallop); else ctx.lineTo(x, y + scallop)
        }
        ctx.stroke()
      }
      // foam flecks
      for (let i = 0; i < 16; i++) {
        const bx = (i * 137 + ((t * 14) % 137)) % VW
        const by2 = shoreY(bx) + lap(bx) + 3
        ctx.fillStyle = 'rgba(250,252,255,0.5)'
        ctx.beginPath(); ctx.arc(bx, by2, 1.3 + (i % 2), 0, TAU); ctx.fill()
      }
    })

    // ═══ DOCK (receding into the lake, upper-right) ═══
    par(14, () => {
      const x0 = 1235, y0 = 792, x1 = 1010, y1 = 596 // shore → tip
      // posts + wobbling reflections
      for (let i = 0; i <= 4; i++) {
        const q = i / 4
        const dx = lerp(x1, x0, q), dy = lerp(y1, y0, q)
        const half = lerp(15, 30, q), pw = lerp(3.4, 6.4, q)
        ctx.strokeStyle = '#4c3520'; ctx.lineWidth = pw
        ctx.beginPath(); ctx.moveTo(dx - half, dy + 3); ctx.lineTo(dx - half, dy + 22 + q * 16); ctx.stroke()
        ctx.beginPath(); ctx.moveTo(dx + half, dy + 3); ctx.lineTo(dx + half, dy + 22 + q * 16); ctx.stroke()
        if (i < 3) {
          ctx.strokeStyle = 'rgba(56,40,24,0.30)'; ctx.lineWidth = pw * 0.85
          ctx.beginPath()
          ctx.moveTo(dx - half + Math.sin(t * 2 + i) * 2, dy + 24 + q * 16)
          ctx.lineTo(dx - half + Math.sin(t * 2 + i + 1.4) * 3.4, dy + 44 + q * 16)
          ctx.stroke()
        }
      }
      // deck reflection sheen in the water
      ctx.fillStyle = 'rgba(60,40,22,0.14)'
      ctx.beginPath()
      ctx.moveTo(x1 - 15, y1 + 8); ctx.lineTo(x1 + 15, y1 + 8)
      ctx.lineTo(x0 + 30, y0 + 42); ctx.lineTo(x0 - 30, y0 + 42)
      ctx.closePath(); ctx.fill()
      // deck
      ctx.beginPath()
      ctx.moveTo(x1 - 15, y1); ctx.lineTo(x1 + 15, y1)
      ctx.lineTo(x0 + 30, y0); ctx.lineTo(x0 - 30, y0)
      ctx.closePath()
      ctx.fillStyle = '#8f6636'; ctx.fill()
      ctx.strokeStyle = '#5d3f1e'; ctx.lineWidth = 2; ctx.stroke()
      ctx.fillStyle = 'rgba(255,214,150,0.24)'
      ctx.beginPath()
      ctx.moveTo(x1 - 15, y1); ctx.lineTo(x1 + 15, y1)
      ctx.lineTo(x1 + 17.4, y1 + 8); ctx.lineTo(x1 - 17.4, y1 + 8)
      ctx.closePath(); ctx.fill()
      ctx.strokeStyle = 'rgba(84,56,26,0.55)'; ctx.lineWidth = 1.4
      for (let i = 1; i < 11; i++) {
        const q = i / 11
        const dx = lerp(x1, x0, q), dy = lerp(y1, y0, q), half = lerp(15, 30, q)
        ctx.beginPath(); ctx.moveTo(dx - half, dy); ctx.lineTo(dx + half, dy); ctx.stroke()
      }
      // ── fisher at the tip: full cast → splash → wait → twitch → reel loop ──
      const fT = t % 13
      const ease = (q) => q * q * (3 - 2 * q)
      // rod angle through the phases
      let rodA
      if (fT < 1.2) rodA = lerp(-0.6, -1.55, ease(fT / 1.2)) // raise back
      else if (fT < 1.6) rodA = lerp(-1.55, -0.3, ease((fT - 1.2) / 0.4)) // whip forward
      else if (fT < 9.5) { // waiting, with two nibble twitches
        rodA = -0.5 + Math.sin(t * 0.8) * 0.02
        if ((fT > 6.4 && fT < 6.7) || (fT > 8 && fT < 8.3)) rodA -= 0.12 * Math.sin(((fT % 1) * 10) * Math.PI)
      } else if (fT < 11.5) rodA = -0.55 + Math.sin(t * 7) * 0.05 // reeling pumps
      else rodA = lerp(-0.55, -0.6, ease((fT - 11.5) / 1.5))
      // arm follows the rod; off arm cranks the reel while reeling
      const reeling = fT >= 9.5 && fT < 11.5
      person2(ctx, {
        x: 1012, y: y1 - 1, h: 62, skin: 2, top: 4, bottom: 1, hairStyle: 'cap', hair: 4, shadow: false,
        armR: { u: 1.0 - (rodA + 0.9) * 0.4, f: 0.3 },
        armL: reeling ? { u: 0.6 + Math.sin(t * 14) * 0.25, f: 0.5 + Math.cos(t * 14) * 0.3 } : { u: 0.55, f: 0.45 },
      })
      // rod + tip position in world coords
      const rpx = 1022, rpy = y1 - 40
      ctx.strokeStyle = '#6b4a26'; ctx.lineWidth = 2
      ctx.save(); ctx.translate(rpx, rpy); ctx.rotate(rodA + 0.6)
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(24, -9, 42, -10); ctx.stroke()
      ctx.restore()
      const ca = rodA + 0.6
      const tipX = rpx + 42 * Math.cos(ca) + 10 * Math.sin(ca) // rotate (42,-10) by ca
      const tipY = rpy + 42 * Math.sin(ca) - 10 * Math.cos(ca)
      // bobber position through the phases
      const landX = 1105, landY = y1 + 14
      let bx2, by2, lineSag = 14
      if (fT < 1.45) { bx2 = tipX + 2; by2 = tipY + 10; lineSag = 2 } // dangling
      else if (fT < 1.9) { // flying out on an arc
        const q = (fT - 1.45) / 0.45
        bx2 = lerp(tipX, landX, q)
        by2 = lerp(tipY, landY, q) - Math.sin(q * Math.PI) * 34
        lineSag = 4
      } else if (fT < 9.5) { bx2 = landX; by2 = landY + Math.sin(t * 1.7) * 2.2 } // floating
      else if (fT < 11.5) { // reeled back in
        const q = ease((fT - 9.5) / 2)
        bx2 = lerp(landX, tipX + 2, q); by2 = lerp(landY, tipY + 12, q) + Math.sin(t * 9) * 1.4
        lineSag = 8 * (1 - q) + 2
      } else { bx2 = tipX + 2; by2 = tipY + 10; lineSag = 2 }
      // line from rod tip to bobber (sagging)
      ctx.strokeStyle = 'rgba(230,240,248,0.55)'; ctx.lineWidth = 1
      ctx.beginPath(); ctx.moveTo(tipX, tipY)
      ctx.quadraticCurveTo((tipX + bx2) / 2, Math.max(tipY, by2) + lineSag, bx2, by2)
      ctx.stroke()
      // bobber
      ctx.fillStyle = '#e0483a'; ctx.beginPath(); ctx.arc(bx2, by2, 2.4, 0, TAU); ctx.fill()
      // splash on landing + rest rings while floating
      if (fT >= 1.9 && fT < 2.5) {
        const q = (fT - 1.9) / 0.6
        ctx.strokeStyle = `rgba(250,252,255,${(0.6 * (1 - q)).toFixed(3)})`; ctx.lineWidth = 1.8
        ctx.beginPath(); ctx.ellipse(landX, landY + 3, 3 + q * 18, (3 + q * 18) * 0.3, 0, 0, TAU); ctx.stroke()
        ctx.fillStyle = `rgba(250,252,255,${(0.6 * (1 - q)).toFixed(3)})`
        for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.arc(landX + k * 4 - 4, landY - 2 - q * 8, 1.3, 0, TAU); ctx.fill() }
      } else if (fT >= 2.5 && fT < 9.5) {
        ctx.strokeStyle = 'rgba(240,248,255,0.3)'; ctx.lineWidth = 1.2
        ctx.beginPath(); ctx.ellipse(bx2, by2 + 3, 6 + Math.sin(t * 1.7) * 2, 1.7, 0, 0, TAU); ctx.stroke()
      }
      // kid sitting on the dock edge, legs dangling over the water
      ctx.save(); ctx.translate(1108, 683)
      person2(ctx, { x: 0, y: 0, h: 46, skin: 4, top: 8, bottom: 0, hairStyle: 'short', hair: 1, stance: 'sit', shadow: false, nod: t * 1.4 })
      ctx.restore()
      person2(ctx, { x: 1136, y: 710, h: 68, skin: 1, top: 1, bottom: 2, hairStyle: 'long', hair: 1, shadow: false, armL: { u: 0.3 + Math.sin(t * 0.9) * 0.05, f: 0.2 }, nod: t * 0.9 + 2 })
      // ── Water Rangers: throw-bucket sampler mid-dock ──
      const tbT = (t + 3) % 9
      const handX = 1178, handY = 718
      let armThrow = 0.5, bkx = handX + 6, bky = handY + 6, ropeSag = 6
      const landBX = 1080, landBY = 742
      if (tbT < 0.7) { // windup, bucket swinging back
        armThrow = 0.5 - ease2(tbT / 0.7) * 1.1
        bkx = handX + 10 + armThrow * 10; bky = handY + 10
      } else if (tbT < 1.0) { // throw
        const q = ease2((tbT - 0.7) / 0.3)
        armThrow = lerp(-0.6, 1.35, q)
        bkx = lerp(handX, landBX, q); bky = lerp(handY, landBY, q) - Math.sin(q * Math.PI) * 42
        ropeSag = 3
      } else if (tbT < 4.5) { // bucket filling in the water
        armThrow = 1.0
        bkx = landBX; bky = landBY + Math.sin(t * 1.9) * 2 + Math.min(6, (tbT - 1) * 5)
        ropeSag = 18
      } else if (tbT < 6.5) { // hauling it back
        const q = ease2((tbT - 4.5) / 2)
        armThrow = 1.0 - q * 0.5 + Math.sin(t * 8) * 0.08
        bkx = lerp(landBX, handX + 4, q); bky = lerp(landBY + 5, handY + 8, q)
        ropeSag = lerp(14, 4, q)
      } else { // inspecting the sample
        armThrow = 0.85; bkx = handX + 8; bky = handY - 2
        ropeSag = 2
      }
      person2(ctx, {
        x: 1170, y: 752, h: 60, skin: 4, top: 8, bottom: 3, hairStyle: 'short', hair: 5, shadow: false,
        armR: { u: armThrow, f: 0.25 }, armL: { u: 0.3, f: 0.3 },
        lean: (armThrow - 0.5) * 0.1,
      })
      // rope + bucket
      ctx.strokeStyle = 'rgba(232,220,190,0.8)'; ctx.lineWidth = 1.4
      ctx.beginPath(); ctx.moveTo(handX, handY)
      ctx.quadraticCurveTo((handX + bkx) / 2, Math.max(handY, bky) + ropeSag, bkx, bky)
      ctx.stroke()
      ctx.fillStyle = '#d8dde2'; ctx.strokeStyle = '#5b6770'; ctx.lineWidth = 1.2
      ctx.beginPath(); ctx.moveTo(bkx - 4.4, bky - 5); ctx.lineTo(bkx + 4.4, bky - 5); ctx.lineTo(bkx + 3.4, bky + 3); ctx.lineTo(bkx - 3.4, bky + 3); ctx.closePath(); ctx.fill(); ctx.stroke()
      if (tbT >= 1.0 && tbT < 1.5) { // splash
        const q = (tbT - 1.0) / 0.5
        ctx.strokeStyle = `rgba(250,252,255,${(0.6 * (1 - q)).toFixed(3)})`; ctx.lineWidth = 1.8
        ctx.beginPath(); ctx.ellipse(landBX, landBY + 2, 4 + q * 20, (4 + q * 20) * 0.3, 0, 0, TAU); ctx.stroke()
      } else if (tbT >= 1.5 && tbT < 4.5) {
        ctx.strokeStyle = 'rgba(240,248,255,0.25)'; ctx.lineWidth = 1.3
        ctx.beginPath(); ctx.ellipse(bkx, bky + 3, 8 + Math.sin(t * 1.9) * 2, 2.2, 0, 0, TAU); ctx.stroke()
      }

      // moored canoe rocking beside the dock
      ctx.save(); ctx.translate(1270, 806 + Math.sin(t * 1.4) * 2.2); ctx.rotate(Math.sin(t * 1.4) * 0.024)
      canoeSide(ctx, 46, '#3d6b8f', '#1d3a52')
      ctx.restore()
      ctx.strokeStyle = 'rgba(60,42,26,0.5)'; ctx.lineWidth = 1.4
      ctx.beginPath(); ctx.moveTo(1246, 796); ctx.quadraticCurveTo(1252, 806, 1240, 810); ctx.stroke()
    })

    // ═══ BEACH LIFE — large, articulated, staggered loops ═══
    par(19, () => {
      // researchers at the water's edge (left-mid, big)
      const dipT = (t % 9) / 9
      const dip = dipT < 0.22 ? Math.sin(dipT / 0.22 * Math.PI) : 0
      const lift = dipT > 0.3 && dipT < 0.5 ? Math.sin((dipT - 0.3) / 0.2 * Math.PI) : 0
      person2(ctx, {
        x: 470, y: shoreY(470) + 26, h: 92, skin: 0, top: 7, bottom: 2, hairStyle: 'bun', hair: 0, vest: true,
        armR: { u: 0.9 + dip * 0.7 + lift * 0.5, f: 0.5 + dip * 0.4 }, armL: { u: 0.6, f: 0.5 }, nod: lift * 3,
      })
      // sample jar in hand
      ctx.fillStyle = 'rgba(214,238,248,0.9)'
      const jx = 486 + lift * 4, jy = shoreY(470) - 16 + dip * 8 - lift * 24
      ctx.fillRect(jx, jy, 7, 10)
      ctx.strokeStyle = 'rgba(120,150,160,0.8)'; ctx.strokeRect(jx, jy, 7, 10)
      if (dip > 0.7) {
        ctx.strokeStyle = 'rgba(250,252,255,0.55)'; ctx.lineWidth = 1.6
        ctx.beginPath(); ctx.ellipse(jx + 3, shoreY(470) - 4, 12 * dip, 3.4 * dip, 0, 0, TAU); ctx.stroke()
      }
      const tabR = person2(ctx, {
        x: 540, y: shoreY(540) + 40, h: 104, skin: 3, top: 8, bottom: 0, hairStyle: 'short', hair: 2, flip: true, vest: true,
        armR: { u: 1.0 + Math.sin(t * 2.4) * 0.05, f: 0.75 }, armL: { u: 0.9, f: 0.7 }, nod: t * 1.2,
      })
      // tablet held in the hand, tilted to read
      ctx.save(); ctx.translate(tabR.nearWrist.x, tabR.nearWrist.y); ctx.rotate(-0.3)
      ctx.fillStyle = '#20262c'; ctx.fillRect(-7, -5, 14, 10)
      ctx.fillStyle = 'rgba(125,220,240,0.95)'; ctx.fillRect(-6, -4, 12, 8)
      ctx.restore()
      // cooler + sensor tripod station
      ctx.fillStyle = '#e8ecef'; ctx.fillRect(583, shoreY(583) + 34, 26, 15)
      ctx.fillStyle = '#3d6b8f'; ctx.fillRect(583, shoreY(583) + 34, 26, 4.4)
      castShadow(ctx, 596, shoreY(583) + 50, 12)
      const stX = 660, stY = shoreY(660) + 52
      ctx.strokeStyle = '#4c5258'; ctx.lineWidth = 2.6; ctx.lineCap = 'round'
      ctx.beginPath()
      ctx.moveTo(stX - 11, stY); ctx.lineTo(stX, stY - 34); ctx.lineTo(stX + 11, stY)
      ctx.moveTo(stX, stY - 34); ctx.lineTo(stX, stY - 52)
      ctx.stroke()
      ctx.fillStyle = '#aab4bc'; ctx.fillRect(stX - 9, stY - 48, 18, 13)
      ctx.fillStyle = (t % 1.7) < 0.2 ? '#7df5df' : '#2b6b60'
      ctx.beginPath(); ctx.arc(stX, stY - 55, 2.2, 0, TAU); ctx.fill()
      castShadow(ctx, stX, stY, 10)

      // ── Water Rangers: conductivity-meter reader (the winter-kit tool) ──
      // kneels, dips the probe on a cord, watches the handheld display
      const cmT = (t + 1) % 8
      const cmDip = cmT < 1.2 ? Math.sin(cmT / 1.2 * Math.PI) * 0.5 + 0.5 : 1
      const cmRead = cmT > 2 ? 1 : 0
      person2(ctx, {
        x: 360, y: shoreY(360) + 22, h: 86, skin: 1, top: 6, bottom: 2, hairStyle: 'cap', hair: 4, vest: true,
        armR: { u: 0.5 + cmRead * 0.9, f: 0.4 + cmRead * 0.6 },
        armL: { u: 0.7 + cmDip * 0.2, f: 0.3 },
        nod: cmRead ? t * 1.6 : 0.4,
      })
      // probe cord from hand into the water + handheld with a live number
      ctx.strokeStyle = '#3a4650'; ctx.lineWidth = 1.4
      const pcx = 344, pcy = shoreY(360) - 4
      ctx.beginPath(); ctx.moveTo(pcx, pcy); ctx.lineTo(pcx - 8, shoreY(344) - 2 + cmDip * 6); ctx.stroke()
      ctx.fillStyle = '#2b6b60'; ctx.fillRect(pcx - 10, shoreY(344) - 2 + cmDip * 6, 3, 8)
      if (cmRead) {
        ctx.save(); ctx.translate(372, shoreY(360) - 30); ctx.rotate(-0.15)
        ctx.fillStyle = '#20262c'; ctx.fillRect(0, 0, 12, 9)
        ctx.fillStyle = '#7df5df'; ctx.font = '700 5px "DM Sans", system-ui'
        ctx.fillText(((312 + Math.sin(t) * 6) | 0) + '', 1.5, 6)
        ctx.restore()
      }

      // ── birdwatcher with binoculars tracking the gulls ──
      person2(ctx, {
        x: 1015, y: 812, h: 108, skin: 3, top: 4, bottom: 2, hairStyle: 'sun', hair: 1,
        armR: { u: 1.35 + Math.sin(t * 0.5) * 0.05, f: 1.15 }, armL: { u: 1.3, f: 1.2 },
        nod: Math.sin(t * 0.4) * 1.5,
      })
      ctx.save(); ctx.translate(1027, 812 - 76); ctx.rotate(Math.sin(t * 0.4) * 0.06)
      ctx.fillStyle = '#20262c'; ctx.fillRect(0, -2.4, 9, 5); ctx.fillRect(2, -4.4, 5, 2)
      ctx.fillStyle = 'rgba(150,200,230,0.7)'; ctx.beginPath(); ctx.arc(9.4, 0, 1.8, 0, TAU); ctx.fill()
      ctx.restore()

      // ── Water Rangers: Secchi-disk water-clarity reading (standing) ──
      // lowers a marked line with a black/white disk and reads the depth it fades
      const secD = (Math.sin(t * 0.5) * 0.5 + 0.5) // 0..1 lowering cycle
      const secW = shoreY(958) - 10 // waterline near the reader
      const secBot = secW + 8 + secD * 26
      const secR = person2(ctx, {
        x: 958, y: shoreY(958) + 18, h: 106, skin: 2, top: 1, bottom: 2, hairStyle: 'cap', hair: 0, vest: true,
        armR: { u: 0.85, f: 0.35 }, armL: { u: 0.6, f: 0.4 }, nod: 0.55,
      })
      // marked line drops straight from the hand to the disk below the surface
      const secHX = secR.nearWrist.x, secHY = secR.nearWrist.y
      ctx.strokeStyle = '#e8dcc0'; ctx.lineWidth = 1.4
      ctx.beginPath(); ctx.moveTo(secHX, secHY); ctx.lineTo(secHX, secBot); ctx.stroke()
      ctx.strokeStyle = '#c0402e'; ctx.lineWidth = 1.4 // depth marks on the line
      for (let d = 0; d < 6; d++) { const my = secHY + 6 + d * 8; if (my < secBot - 3) { ctx.beginPath(); ctx.moveTo(secHX - 3, my); ctx.lineTo(secHX + 3, my); ctx.stroke() } }
      ctx.save(); ctx.translate(secHX, secBot) // black/white quartered disk
      ctx.fillStyle = '#f4f4ee'; ctx.beginPath(); ctx.arc(0, 0, 6, 0, TAU); ctx.fill()
      ctx.fillStyle = '#20242a'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, 6, -Math.PI / 2, 0); ctx.closePath(); ctx.fill()
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, 6, Math.PI / 2, Math.PI); ctx.closePath(); ctx.fill()
      ctx.strokeStyle = '#8a8f94'; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.arc(0, 0, 6, 0, TAU); ctx.stroke()
      ctx.restore()

      // ── Water Rangers: dissolved-oxygen vial held up to compare colour ──
      const doR = person2(ctx, {
        x: 620, y: shoreY(620) + 20, h: 100, skin: 4, top: 3, bottom: 0, hairStyle: 'long', hair: 1, vest: true,
        armR: { u: 1.5 + Math.sin(t * 0.8) * 0.05, f: 1.15 }, armL: { u: 0.95, f: 0.95 }, nod: t * 0.6,
      })
      ctx.save(); ctx.translate(doR.nearWrist.x, doR.nearWrist.y - 4)
      ctx.fillStyle = 'rgba(120,205,180,0.9)'; ctx.fillRect(-2, 1, 4, 9) // sample colour
      ctx.fillStyle = 'rgba(230,240,240,0.8)'; ctx.fillRect(-2, -1.5, 4, 2.5) // cap
      ctx.strokeStyle = '#aebec4'; ctx.lineWidth = 0.8; ctx.strokeRect(-2, -1.5, 4, 11.5)
      ctx.restore()

      // ── interpretive site marker with live readings (how a site reports) ──
      ctx.save(); ctx.translate(548, shoreY(548) + 26)
      ctx.fillStyle = '#5d4326'; ctx.fillRect(-1.6, -2, 3.2, 30)
      ctx.fillStyle = '#16242e'; ctx.strokeStyle = 'rgba(124,196,234,0.7)'; ctx.lineWidth = 1.4
      ctx.beginPath(); ctx.roundRect(-26, -34, 52, 30, 4); ctx.fill(); ctx.stroke()
      ctx.fillStyle = '#7cc4ea'; ctx.font = '700 7px "DM Sans", system-ui'; ctx.fillText('SITE · ER-14', -21, -25)
      const liveOn = (t % 2) < 1.4
      ctx.fillStyle = liveOn ? '#7df5df' : '#2b6b60'; ctx.beginPath(); ctx.arc(20, -28, 1.8, 0, TAU); ctx.fill()
      ctx.fillStyle = '#dceaf6'; ctx.font = '6px "DM Sans", system-ui'
      ctx.fillText('pH 7.9   ' + (17 + (Math.sin(t) * 1.4)).toFixed(1) + '°C', -21, -16)
      ctx.fillText('DO 9.4 mg/L   clarity 4.1 m', -21, -8)
      ctx.restore()

      // helper: a researcher standing ankle-deep, water lapping their shins
      const wadeWater = (wx, wy) => {
        ctx.fillStyle = 'rgba(88,138,150,0.34)'
        ctx.beginPath(); ctx.ellipse(wx, wy + 2, 20, 6, 0, 0, TAU); ctx.fill()
        ctx.strokeStyle = 'rgba(240,248,255,0.4)'; ctx.lineWidth = 1.4
        ctx.beginPath(); ctx.ellipse(wx, wy + 2, 23 + Math.sin(t * 2 + wx) * 3, 7, 0, 0, TAU); ctx.stroke()
      }

      // ── wading benthic kick-net sampler (invertebrate survey) ──
      const netX = 806, netY = shoreY(806) - 4
      const sweep = Math.sin(t * 1.3) * 0.35
      const netR = person2(ctx, { x: netX, y: netY, h: 106, skin: 1, top: 6, bottom: 2, hairStyle: 'cap', hair: 0, vest: true, armR: { u: 1.05 + sweep, f: 0.45 }, armL: { u: 0.8 - sweep * 0.4, f: 0.45 }, nod: 0.35 })
      // net pole runs out of the gripping hand toward the lakebed
      ctx.save(); ctx.translate(netR.nearWrist.x, netR.nearWrist.y); ctx.rotate(1.0 + sweep)
      ctx.strokeStyle = '#b8b4ac'; ctx.lineWidth = 2.4; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(42, 0); ctx.stroke()
      ctx.strokeStyle = '#3a4650'; ctx.lineWidth = 1.8; ctx.beginPath(); ctx.arc(48, 0, 7, 0, TAU); ctx.stroke()
      ctx.fillStyle = 'rgba(110,115,105,0.45)'; ctx.beginPath(); ctx.moveTo(41, 0); ctx.quadraticCurveTo(50, 16, 55, 2); ctx.closePath(); ctx.fill()
      ctx.restore()
      wadeWater(netX, netY)

      // ── turbidity tube reading (looks straight down the column) ──
      const tuX = 1096, tuY = shoreY(1096) + 16
      const tuR = person2(ctx, { x: tuX, y: tuY, h: 104, skin: 4, top: 3, bottom: 0, hairStyle: 'short', hair: 4, vest: true, armR: { u: 1.25, f: 1.35 }, armL: { u: 1.15, f: 1.35 }, nod: 0.6 })
      // the clear tube is gripped and held up to sight down the column
      ctx.save(); ctx.translate(tuR.nearWrist.x - 2.5, tuR.nearWrist.y - 20)
      ctx.fillStyle = 'rgba(150,200,210,0.35)'; ctx.fillRect(0, 0, 5, 42)
      ctx.fillStyle = 'rgba(112,158,150,0.55)'; ctx.fillRect(0, 28, 5, 14) // turbid sample settles at the base
      ctx.strokeStyle = 'rgba(222,236,240,0.75)'; ctx.lineWidth = 0.9; ctx.strokeRect(0, 0, 5, 42)
      for (let m = 1; m < 5; m++) { ctx.strokeStyle = 'rgba(200,60,46,0.6)'; ctx.beginPath(); ctx.moveTo(0, m * 8); ctx.lineTo(1.6, m * 8); ctx.stroke() }
      ctx.restore()

      // ── aerial-survey drone + ground pilot ──
      const droneX = 360 + ((t * 40) % 720), droneY = 152 + Math.sin(t * 1.6) * 8
      ctx.save(); ctx.translate(droneX, droneY)
      ctx.fillStyle = 'rgba(125,245,223,0.10)'; ctx.beginPath(); ctx.moveTo(-3, 7); ctx.lineTo(-18, 78); ctx.lineTo(18, 78); ctx.lineTo(3, 7); ctx.closePath(); ctx.fill() // survey scan
      ctx.strokeStyle = '#2a3138'; ctx.lineWidth = 2
      ctx.beginPath(); ctx.moveTo(-11, -4); ctx.lineTo(11, 4); ctx.moveTo(-11, 4); ctx.lineTo(11, -4); ctx.stroke()
      ctx.strokeStyle = 'rgba(185,205,215,0.5)'; ctx.lineWidth = 1
      for (const [rx, ry] of [[-11, -4], [11, 4], [-11, 4], [11, -4]]) { ctx.beginPath(); ctx.ellipse(rx, ry, 6, 1.6, 0, 0, TAU); ctx.stroke() }
      ctx.fillStyle = '#3a4650'; ctx.beginPath(); ctx.roundRect(-6, -4, 12, 8, 2); ctx.fill()
      ctx.fillStyle = '#20262c'; ctx.beginPath(); ctx.arc(0, 6, 2.2, 0, TAU); ctx.fill()
      ctx.fillStyle = (t % 1) < 0.5 ? '#ff6b6b' : '#3a2020'; ctx.beginPath(); ctx.arc(6, -4, 1.2, 0, TAU); ctx.fill()
      ctx.restore()
      person2(ctx, { x: 92, y: 848, h: 112, skin: 2, top: 1, bottom: 2, hairStyle: 'cap', hair: 0, vest: true, armR: { u: 1.15, f: 1.0 }, armL: { u: 1.1, f: 1.05 }, nod: Math.sin(t * 0.5) * 0.6 })
      ctx.save(); ctx.translate(92 + 12, 848 - 58)
      ctx.fillStyle = '#20262c'; ctx.beginPath(); ctx.roundRect(-6, 0, 12, 6, 1.5); ctx.fill()
      ctx.fillStyle = '#3a4650'; ctx.beginPath(); ctx.arc(-3, 3, 1.3, 0, TAU); ctx.arc(3, 3, 1.3, 0, TAU); ctx.fill()
      ctx.strokeStyle = '#20262c'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-4, 0); ctx.lineTo(-5, -4); ctx.moveTo(4, 0); ctx.lineTo(5, -4); ctx.stroke()
      ctx.restore()

      // ── shoreline transect: two researchers stretch a measuring tape ──
      const trA = 560, trB = 780, trY = 852
      person2(ctx, { x: trA, y: trY, h: 108, skin: 4, top: 3, bottom: 2, hairStyle: 'long', hair: 1, vest: true, armR: { u: 0.9, f: 0.6 }, armL: { u: 0.5, f: 0.4 }, nod: 0.5 })
      person2(ctx, { x: trB, y: trY + 4, h: 104, skin: 0, top: 6, bottom: 0, hairStyle: 'cap', hair: 0, vest: true, flip: true, armR: { u: 0.85, f: 0.5 }, armL: { u: 0.5, f: 0.4 }, nod: t * 0.5 })
      ctx.strokeStyle = '#f2c832'; ctx.lineWidth = 1.6
      ctx.beginPath(); ctx.moveTo(trA + 14, trY - 40); ctx.lineTo(trB - 14, trY + 4 - 40); ctx.stroke()
      ctx.fillStyle = '#c0402e'; ctx.beginPath(); ctx.arc(trA + 15, trY - 40, 3.4, 0, TAU); ctx.fill() // tape reel
      ctx.strokeStyle = '#e8e2d2'; ctx.lineWidth = 1
      for (let i = 1; i < 4; i++) { const fx = trA + (trB - trA) * i / 4; ctx.beginPath(); ctx.moveTo(fx, trY + 4); ctx.lineTo(fx, trY - 6); ctx.stroke(); ctx.fillStyle = '#c0402e'; ctx.fillRect(fx, trY - 7, 3, 2) }

      // ── eDNA / bacteria sample sealed into a sample bag ──
      const edX = 1258, edY = 850, seal = Math.sin(t * 2) * 0.1
      person2(ctx, { x: edX, y: edY, h: 104, skin: 1, top: 4, bottom: 2, hairStyle: 'bun', hair: 2, vest: true, armR: { u: 0.95 + seal, f: 1.0 }, armL: { u: 0.85 - seal, f: 1.05 }, nod: 0.6 })
      ctx.save(); ctx.translate(edX + 11, edY - 52)
      ctx.fillStyle = 'rgba(222,236,240,0.9)'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(8, 0); ctx.lineTo(7, 12); ctx.lineTo(1, 12); ctx.closePath(); ctx.fill()
      ctx.fillStyle = 'rgba(150,200,180,0.6)'; ctx.fillRect(1.5, 6, 5, 5)
      ctx.fillStyle = '#c0a040'; ctx.fillRect(0, -1.5, 8, 2)
      ctx.restore()

      // ── a researcher trains a volunteer (points out to the water) ──
      const tgX = 300, tgY = 856, pointA = Math.sin(t * 0.7)
      person2(ctx, { x: tgX, y: tgY, h: 110, skin: 3, top: 1, bottom: 2, hairStyle: 'short', hair: 0, vest: true, armR: { u: 1.2 + pointA * 0.3, f: 0.2 }, armL: { u: 0.5, f: 0.4 }, nod: t * 1.1 })
      person2(ctx, { x: tgX + 34, y: tgY + 4, h: 94, skin: 4, top: 8, bottom: 0, hairStyle: 'long', hair: 4, flip: true, armR: { u: 0.4, f: 0.5 }, armL: { u: 0.35, f: 0.5 }, nod: Math.sin(t * 0.8) * 0.8 })

      // kids skipping stones + guardian (left)
      const skT = (t + 2.4) % 8
      const windup = skT < 0.5 ? Math.sin(skT / 0.5 * Math.PI) : 0
      person2(ctx, { x: 300, y: shoreY(300) + 42, h: 62, skin: 4, top: 0, bottom: 0, hairStyle: 'short', hair: 1, armR: { u: 0.3 - windup * 1.3, f: 0.25 - windup * 0.3 }, armL: { u: 0.2, f: 0.15 }, lean: windup * 0.08 })
      person2(ctx, { x: 258, y: shoreY(258) + 48, h: 96, skin: 1, top: 3, bottom: 3, hairStyle: 'long', hair: 4, armR: { u: 0.2, f: 0.15 }, armL: { u: 0.35, f: 0.25 }, nod: t * 0.8 })
      if (skT > 0.5 && skT < 1.8) {
        const sp2 = (skT - 0.5) / 1.3
        const sx = 315 - sp2 * 250
        const hop = Math.abs(Math.sin(sp2 * Math.PI * 3)) * (22 * (1 - sp2))
        ctx.fillStyle = '#6d685e'
        ctx.beginPath(); ctx.ellipse(sx, shoreY(sx) - 26 - hop, 3, 1.8, 0.3, 0, TAU); ctx.fill()
        for (let k = 1; k <= 3; k++) {
          const kp = k / 3.4
          if (sp2 > kp) {
            const rx = 315 - kp * 250
            const rp = clamp((sp2 - kp) * 3, 0, 1)
            ctx.strokeStyle = `rgba(250,252,255,${(0.5 * (1 - rp)).toFixed(3)})`; ctx.lineWidth = 1.6
            ctx.beginPath(); ctx.ellipse(rx, shoreY(rx) - 22, 4 + rp * 17, (4 + rp * 17) * 0.3, 0, 0, TAU); ctx.stroke()
          }
        }
      }

      // walkers + dog crossing the beach diagonally
      const wq = ((t * 0.024) % 1.3) - 0.12
      const wx = lerp(1120, 70, clamp(wq, 0, 1))
      const wy = shoreY(wx) + 54 // always on sand, below the waterline
      const wph = t * 4.2
      if (wq > -0.1 && wq < 1.1) {
        person2(ctx, { x: wx, y: wy, h: 100, skin: 2, top: 1, bottom: 0, hairStyle: 'short', hair: 1, flip: true, walk: wph })
        person2(ctx, { x: wx + 34, y: wy + 6, h: 94, skin: 0, top: 5, bottom: 3, hairStyle: 'long', hair: 0, flip: true, walk: wph + 1.2 })
        // dog trotting ahead, tail up
        const dx2 = wx - 52
        castShadow(ctx, dx2, wy + 2, 12)
        ctx.save(); ctx.translate(dx2, wy); ctx.scale(-1.15, 1.15)
        ctx.fillStyle = '#8a6a48'
        ctx.beginPath(); ctx.ellipse(0, -12, 12, 6.4, 0, 0, TAU); ctx.fill()
        ctx.beginPath(); ctx.arc(12, -18, 5.4, 0, TAU); ctx.fill()
        ctx.strokeStyle = '#6b4e30'; ctx.lineWidth = 2.6; ctx.lineCap = 'round'
        ctx.beginPath(); ctx.moveTo(10, -22); ctx.lineTo(9, -26); ctx.moveTo(14, -22); ctx.lineTo(15, -26); ctx.stroke()
        ctx.save(); ctx.translate(-11, -15); ctx.rotate(Math.sin(t * 9) * 0.4 - 0.7)
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-8, -6); ctx.stroke(); ctx.restore()
        for (let i = 0; i < 4; i++) {
          const ph = t * 7.4 + i * (Math.PI / 2)
          ctx.beginPath(); ctx.moveTo(-8 + i * 5.4, -7); ctx.lineTo(-8 + i * 5.4 + Math.sin(ph) * 2.6, 0); ctx.stroke()
        }
        ctx.fillStyle = '#241812'; ctx.beginPath(); ctx.arc(14.6, -18.6, 1, 0, TAU); ctx.fill()
        ctx.restore()
        ctx.strokeStyle = 'rgba(60,44,28,0.55)'; ctx.lineWidth = 1.3
        ctx.beginPath(); ctx.moveTo(wx - 8, wy - 56); ctx.quadraticCurveTo(wx - 30, wy - 24, dx2 + 10, wy - 22); ctx.stroke()
        if (Math.abs(Math.sin(wph)) > 0.95) s.sandPuffs.push({ x: wx + 6, y: wy + 1, life: 0 })
      }
      s.sandPuffs = s.sandPuffs.filter(dd => (dd.life += dt) < 0.7)
      for (const dd of s.sandPuffs) {
        ctx.fillStyle = `rgba(216,192,150,${(0.4 * (1 - dd.life / 0.7)).toFixed(3)})`
        ctx.beginPath(); ctx.arc(dd.x, dd.y - dd.life * 7, 2 + dd.life * 5, 0, TAU); ctx.fill()
      }

      // elders on a driftwood log (mid-right), talking in turn
      const logX = 880, logY = shoreY(880) + 118
      castShadow(ctx, logX, logY + 4, 40)
      ctx.fillStyle = '#8a6a48'
      ctx.save(); ctx.translate(logX, logY)
      ctx.beginPath(); ctx.roundRect(-66, -12, 132, 16, 8); ctx.fill()
      ctx.fillStyle = '#755838'; ctx.fillRect(-66, -5, 132, 5)
      ctx.fillStyle = 'rgba(255,214,150,0.3)'; ctx.fillRect(-62, -12, 124, 2.6)
      ctx.restore()
      const talk = Math.sin(t * 0.5) > 0
      person2(ctx, { x: logX - 30, y: logY - 9, h: 88, skin: 0, top: 2, bottom: 1, hairStyle: 'grey', stance: 'sit', armR: { u: talk ? 0.7 + Math.sin(t * 2.2) * 0.25 : 0.32, f: 0.5 }, armL: { u: 0.42, f: 0.62 }, nod: talk ? t * 2.2 : 0.4 })
      person2(ctx, { x: logX + 34, y: logY - 9, h: 84, skin: 1, top: 9, bottom: 4, hairStyle: 'grey', stance: 'sit', flip: true, armR: { u: !talk ? 0.7 + Math.sin(t * 1.9) * 0.22 : 0.32, f: 0.45 }, armL: { u: 0.42, f: 0.62 }, nod: !talk ? t * 1.9 : 0.2 })

      // youth launching a canoe (upper-left, half in water)
      const push = Math.sin(t * 1.15)
      ctx.save(); ctx.translate(150, shoreY(150) + 4 + push * 1.2); ctx.rotate(-0.1)
      canoeSide(ctx, 58, '#8a5a2b', '#4a2f14')
      ctx.restore()
      ctx.strokeStyle = 'rgba(240,248,255,0.35)'; ctx.lineWidth = 1.6
      ctx.beginPath(); ctx.ellipse(118, shoreY(150) + 6, 24 + push * 4, 5, 0, 0, TAU); ctx.stroke()
      person2(ctx, { x: 208, y: shoreY(208) + 26, h: 84, skin: 4, top: 6, bottom: 0, hairStyle: 'short', hair: 5, lean: -0.22 + push * 0.02, armL: { u: 1.15, f: 0.5 }, armR: { u: 1.05, f: 0.55 } })

      // photographer kneeling on the foreground granite (left)
      person2(ctx, { x: 210, y: 806, h: 118, skin: 1, top: 3, bottom: 2, hairStyle: 'cap', hair: 2, armR: { u: 1.35, f: 0.95 }, armL: { u: 1.2, f: 1.05 }, nod: Math.sin(t * 0.4) })
      ctx.save(); ctx.translate(228, 728); ctx.rotate(0.1 + Math.sin(t * 0.4) * 0.03)
      ctx.fillStyle = '#20262c'; ctx.fillRect(0, 0, 15, 10); ctx.fillRect(15, 2, 7, 6)
      ctx.fillStyle = 'rgba(160,210,240,0.8)'; ctx.beginPath(); ctx.arc(22.4, 5, 2.4, 0, TAU); ctx.fill()
      ctx.restore()

      // (removed the mid-beach strolling family — its path cut through the
      //  standing researchers and the figures overlapped/merged.)

      // ── a small gaggle of Canada geese loafing on the open wet sand ──
      const goose = (gx, gy, sc, ph, graze) => {
        ctx.save(); ctx.translate(gx, gy); ctx.scale(sc, sc)
        const bob = Math.sin(t * 2 + ph) * 1.2
        ctx.fillStyle = 'rgba(60,44,26,0.22)' // ground shadow
        ctx.beginPath(); ctx.ellipse(0, 15, 16, 3, 0, 0, TAU); ctx.fill()
        ctx.fillStyle = '#8b8175' // body
        ctx.beginPath(); ctx.ellipse(0, 0, 15, 8.5, 0, 0, TAU); ctx.fill()
        ctx.fillStyle = '#6f665b' // folded wing
        ctx.beginPath(); ctx.ellipse(2, -0.5, 12, 6, 0, 0, TAU); ctx.fill()
        ctx.fillStyle = '#efe9dc' // pale tail/rump
        ctx.beginPath(); ctx.moveTo(-14, -3); ctx.lineTo(-21, -5); ctx.lineTo(-13, 3); ctx.closePath(); ctx.fill()
        const hy = (graze ? 9 : -14) + bob, hx = 13 // black neck + head; grazing dips it
        ctx.strokeStyle = '#191919'; ctx.lineWidth = 3.6; ctx.lineCap = 'round'
        ctx.beginPath(); ctx.moveTo(9, -4); ctx.quadraticCurveTo(hx + 2, hy * 0.4, hx, hy); ctx.stroke()
        ctx.fillStyle = '#191919'; ctx.beginPath(); ctx.ellipse(hx + 1, hy, 3.4, 3, 0, 0, TAU); ctx.fill()
        ctx.fillStyle = '#f2efe8'; ctx.beginPath(); ctx.ellipse(hx + 2, hy + 0.4, 1.5, 2.4, 0, 0, TAU); ctx.fill() // white cheek
        ctx.fillStyle = '#141416'; ctx.beginPath(); ctx.moveTo(hx + 3.5, hy - 1); ctx.lineTo(hx + 7.5, hy + 0.2); ctx.lineTo(hx + 3.5, hy + 1.6); ctx.closePath(); ctx.fill() // bill
        ctx.strokeStyle = '#3a2a18'; ctx.lineWidth = 1.5 // legs
        ctx.beginPath(); ctx.moveTo(-2, 8); ctx.lineTo(-2, 15); ctx.moveTo(4, 8); ctx.lineTo(4, 15); ctx.stroke()
        ctx.restore()
      }
      const gz = (i) => ((t * 0.4 + i * 2.3) % 5) < 2 // slow, staggered grazing
      goose(686, 792, 1.0, 0.0, gz(0))
      goose(724, 800, 0.92, 1.7, gz(1))
      goose(760, 788, 0.86, 3.1, gz(2))

      // turtle sunning on a shoreline rock (left shallows)
      ctx.fillStyle = '#71695f'
      ctx.beginPath(); ctx.ellipse(96, shoreY(96) - 4, 34, 12, 0, 0, TAU); ctx.fill()
      ctx.fillStyle = 'rgba(255,214,150,0.3)'
      ctx.beginPath(); ctx.ellipse(88, shoreY(96) - 9, 16, 4.4, -0.2, 0, TAU); ctx.fill()
      const th = 3 + Math.sin(t * 0.45) * 2.6
      ctx.fillStyle = '#4a6a42'
      ctx.beginPath(); ctx.ellipse(100, shoreY(96) - 13, 10, 5.4, 0, 0, TAU); ctx.fill()
      ctx.fillStyle = '#5d7a4e'; ctx.beginPath(); ctx.arc(111 + th, shoreY(96) - 15, 3.2, 0, TAU); ctx.fill()
    })

    // ═══ FOREGROUND — granite, grasses, driftwood, canoe bow (defocused) ═══
    par(30, () => {
      // granite slab, bottom-left
      castShadow(ctx, 150, 886, 90)
      granite(ctx, 130, 900, 240, 130, 3)
      grassBlades(ctx, 268, 898, 9, 92, t, true)
      grassBlades(ctx, 40, 892, 7, 70, t, true)
      // driftwood, bottom-centre
      ctx.save(); ctx.translate(700, 872); ctx.rotate(-0.05)
      castShadow(ctx, 0, 12, 60)
      ctx.fillStyle = '#9a8266'
      ctx.beginPath(); ctx.roundRect(-95, -10, 190, 19, 10); ctx.fill()
      ctx.fillStyle = '#7d6850'; ctx.fillRect(-95, -1, 190, 10)
      ctx.fillStyle = 'rgba(255,214,150,0.35)'; ctx.fillRect(-88, -10, 176, 3)
      ctx.strokeStyle = '#6d5844'; ctx.lineWidth = 4; ctx.lineCap = 'round'
      ctx.beginPath(); ctx.moveTo(66, -8); ctx.quadraticCurveTo(88, -22, 102, -26); ctx.stroke()
      ctx.restore()
      grassBlades(ctx, 610, 890, 6, 60, t, false)
      // beached canoe bow entering bottom-right frame (large, partial)
      ctx.save(); ctx.translate(1490, 912); ctx.rotate(-0.3)
      castShadow(ctx, -40, 10, 90)
      ctx.fillStyle = '#8a4f24'; ctx.strokeStyle = '#48280f'; ctx.lineWidth = 7; ctx.lineJoin = 'round'
      ctx.beginPath()
      ctx.moveTo(-260, 40)
      ctx.quadraticCurveTo(-40, 66, 118, -34)
      ctx.lineTo(128, 6)
      ctx.quadraticCurveTo(-30, 108, -260, 92)
      ctx.closePath(); ctx.fill(); ctx.stroke()
      ctx.strokeStyle = '#a96b35'; ctx.lineWidth = 4
      ctx.beginPath(); ctx.moveTo(-240, 52); ctx.quadraticCurveTo(-40, 76, 108, -18); ctx.stroke()
      ctx.strokeStyle = 'rgba(255,214,150,0.5)'; ctx.lineWidth = 2.6
      ctx.beginPath(); ctx.moveTo(-236, 46); ctx.quadraticCurveTo(-42, 70, 104, -22); ctx.stroke()
      // paddle resting across the gunwale
      ctx.save(); ctx.translate(-60, 52); ctx.rotate(-0.5)
      ctx.strokeStyle = '#c89a58'; ctx.lineWidth = 6; ctx.lineCap = 'round'
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -108); ctx.stroke()
      ctx.fillStyle = '#c89a58'
      ctx.beginPath(); ctx.ellipse(0, -122, 11, 20, 0, 0, TAU); ctx.fill()
      ctx.restore()
      ctx.restore()
      grassBlades(ctx, 1560, 908, 8, 96, t, true)

      // dragonflies with hover-dart motion
      for (const [i, df] of s.dragonflies.entries()) {
        df.ph += dt
        const dartT = df.ph % 5.4
        if (dartT < 0.4) df.x += (i ? -1 : 1) * dt * 320
        df.y = 790 + Math.sin(df.ph * 2 + i * 3) * 34
        if (df.x > VW + 40) df.x = -40
        if (df.x < -40) df.x = VW + 40
        ctx.save(); ctx.translate(df.x, df.y)
        ctx.strokeStyle = '#3e8a9c'; ctx.lineWidth = 2.6; ctx.lineCap = 'round'
        ctx.beginPath(); ctx.moveTo(-9, 0); ctx.lineTo(9, 0); ctx.stroke()
        ctx.fillStyle = '#2e6a7c'; ctx.beginPath(); ctx.arc(10, 0, 2.4, 0, TAU); ctx.fill()
        const wf = Math.sin(t * 42 + i) * 0.6
        ctx.strokeStyle = 'rgba(230,244,252,0.6)'; ctx.lineWidth = 1.5
        ctx.beginPath()
        ctx.moveTo(2, 0); ctx.lineTo(11, -8 - wf * 3)
        ctx.moveTo(2, 0); ctx.lineTo(-6, -8 + wf * 3)
        ctx.moveTo(2, 0); ctx.lineTo(11, 8 + wf * 3)
        ctx.moveTo(2, 0); ctx.lineTo(-6, 8 - wf * 3)
        ctx.stroke()
        ctx.restore()
      }
      // butterfly near the grasses
      const bfx = 340 + Math.sin(t * 0.5) * 90 + Math.sin(t * 1.6) * 18
      const bfy = 830 + Math.sin(t * 0.85) * 24
      const flap = Math.sin(t * 15)
      ctx.save(); ctx.translate(bfx, bfy)
      ctx.fillStyle = '#e08a2e'
      ctx.beginPath(); ctx.ellipse(-3 * Math.abs(flap) - 1, 0, 4.4 * Math.abs(flap) + 1, 5.4, -0.4, 0, TAU); ctx.fill()
      ctx.beginPath(); ctx.ellipse(3 * Math.abs(flap) + 1, 0, 4.4 * Math.abs(flap) + 1, 5.4, 0.4, 0, TAU); ctx.fill()
      ctx.fillStyle = '#3a2a1a'; ctx.fillRect(-0.8, -4.4, 1.6, 8.8)
      ctx.restore()
    })

    // ═══ CURSOR RIPPLES ═══
    const inWater = p.inside && p.y > HZ + 14 && p.y < shoreY(p.x) - 8
    if (inWater && t - s.lastRip > 0.13 && performance.now() - p.moved < 90) {
      s.lastRip = t
      s.ripples.push({ x: p.x, y: p.y, life: 0 })
      if (s.ripples.length > 22) s.ripples.shift()
    }
    s.ripples = s.ripples.filter(r => (r.life += dt) < 1.5)
    for (const r of s.ripples) {
      const q = r.life / 1.5
      ctx.strokeStyle = `rgba(250,252,255,${(0.4 * (1 - q)).toFixed(3)})`
      ctx.lineWidth = 1.7
      ctx.beginPath(); ctx.ellipse(r.x, r.y, 5 + q * 42, (5 + q * 42) * 0.3, 0, 0, TAU); ctx.stroke()
    }

    // ═══ "ENTER THE PLATFORM" LIGHT TRAIL → buoy pulse ═══
    if (trailT >= 0) {
      trailT += dt
      const path = (q) => [
        lerp(330, 640, q) + Math.sin(q * Math.PI) * -60,
        lerp(760, 560, q) - Math.sin(q * Math.PI) * 90,
      ]
      ctx.save(); ctx.globalCompositeOperation = 'lighter'
      if (trailT < 1.1) {
        const q = ease2(clamp(trailT / 1.1, 0, 1))
        // comet head + fading tail
        for (let k = 0; k < 9; k++) {
          const tq = clamp(q - k * 0.035, 0, 1)
          const [px2, py2] = path(tq)
          glow(ctx, px2, py2, 14 - k, `rgba(125,245,223,${(0.5 * (1 - k / 9)).toFixed(3)})`, 'rgba(125,245,223,0)')
        }
        const [hx2, hy2] = path(q)
        ctx.fillStyle = '#d8fff6'
        ctx.beginPath(); ctx.arc(hx2, hy2, 4, 0, TAU); ctx.fill()
      } else if (trailT < 2.1) {
        const q = (trailT - 1.1) / 1
        glow(ctx, 640, 552, 30 + q * 70, `rgba(125,245,223,${(0.55 * (1 - q)).toFixed(3)})`, 'rgba(125,245,223,0)')
        ctx.strokeStyle = `rgba(125,245,223,${(0.7 * (1 - q)).toFixed(3)})`
        ctx.lineWidth = 2.4
        ctx.beginPath(); ctx.ellipse(640, 564, 16 + q * 90, (16 + q * 90) * 0.3, 0, 0, TAU); ctx.stroke()
      } else trailT = -1
      ctx.restore()
    }

    // ═══ INTERACTIVE TOUCH POINTS — learn every monitoring method ═══
    // Persistent numbered markers make the scene explorable; hover shows a
    // card, a click pins it open (works on touch screens too).
    const HITR = 34
    // consume a click: pin the nearest marker, or clear when clicking away
    if (p.click) {
      let hit = null, best = HITR * HITR * 1.7
      TOUCHPOINTS.forEach((tp, i) => {
        const q = tpPos(tp); const d2 = (p.click.x - q.x) ** 2 + (p.click.y - q.y) ** 2
        if (d2 < best) { best = d2; hit = i }
      })
      s.active = s.active === hit ? null : hit
      p.click = null
    }
    // hovered marker (transient preview)
    let hover = null
    if (p.inside) {
      let best = HITR * HITR
      TOUCHPOINTS.forEach((tp, i) => {
        const q = tpPos(tp); const d2 = (p.x - q.x) ** 2 + (p.y - q.y) ** 2
        if (d2 < best) { best = d2; hover = i }
      })
    }
    // draw the markers — calm little dots at rest so the scene reads as a
    // painting, not a training diagram; only the hovered/pinned one blooms
    // into a full ring + number (and its card).
    TOUCHPOINTS.forEach((tp, i) => {
      const q = tpPos(tp)
      const on = i === s.active || i === hover
      if (on) {
        const pulse = 0.5 + 0.5 * Math.sin(t * 3)
        ctx.save(); ctx.globalCompositeOperation = 'lighter'
        glow(ctx, q.x, q.y, 22 + pulse * 5, 'rgba(125,245,223,0.5)', 'rgba(125,245,223,0)')
        ctx.restore()
        ctx.fillStyle = 'rgba(125,245,223,0.92)'
        ctx.beginPath(); ctx.arc(q.x, q.y, 12, 0, TAU); ctx.fill()
        ctx.fillStyle = '#06222b'; ctx.font = '700 11px "DM Sans", system-ui, sans-serif'
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
        ctx.fillText(tp.n, q.x, q.y + 0.5)
        ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'
      } else {
        const pulse = 0.5 + 0.5 * Math.sin(t * 1.6 + tp.n)
        ctx.fillStyle = `rgba(140,240,220,${(0.26 + pulse * 0.13).toFixed(3)})`
        ctx.beginPath(); ctx.arc(q.x, q.y, 2.6, 0, TAU); ctx.fill()
        ctx.strokeStyle = `rgba(140,240,220,${(0.12 + pulse * 0.10).toFixed(3)})`; ctx.lineWidth = 1
        ctx.beginPath(); ctx.arc(q.x, q.y, 5.5 + pulse * 1.6, 0, TAU); ctx.stroke()
      }
    })
    // draw the open card (pinned wins over hover) last, so it sits on top
    const show = s.active != null ? s.active : hover
    if (show != null) {
      const tp = TOUCHPOINTS[show], q = tpPos(tp)
      glassCard(ctx, q.x + 24, q.y - 16, [tp.title, ...tp.lines])
    }

    // ═══ GRADE: warm bloom near sun path + cool vignette ═══
    ctx.save(); ctx.globalCompositeOperation = 'lighter'
    const bloom = ctx.createRadialGradient(SUNX, HZ, 40, SUNX, HZ, 640)
    bloom.addColorStop(0, 'rgba(255,190,110,0.055)'); bloom.addColorStop(1, 'rgba(255,190,110,0)')
    ctx.fillStyle = bloom; ctx.fillRect(0, 0, VW, VH)
    ctx.restore()
    const vg = ctx.createRadialGradient(VW * 0.55, VH * 0.42, VH * 0.45, VW * 0.55, VH * 0.42, VH * 1.05)
    vg.addColorStop(0, 'rgba(18,12,8,0)'); vg.addColorStop(1, 'rgba(18,12,8,0.42)')
    ctx.fillStyle = vg; ctx.fillRect(0, 0, VW, VH)
  },
}
