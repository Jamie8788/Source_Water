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

const TAU = Math.PI * 2

// "Enter the platform" light trail: a spark travels from the CTA shoreline
// to the monitoring buoy and pulses. Fired from the hero button.
let trailT = -1
export function fireLightTrail() { trailT = 0 }

const ease2 = (q) => q * q * (3 - 2 * q)
const HZ = 320 // horizon (eye-level camera → high horizon)
const SUNX = 1150, SUNY = 262

// diagonal waterline: upper-left water, lower-right beach
const shoreY = (x) => 575 + Math.pow(clamp(x, 0, 1600) / 1600, 1.22) * 315 + Math.sin(x * 0.004) * 10

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
 * o: { x, y, h, flip, skin, top, bottom, hair, hairStyle:
 *      'short'|'long'|'bun'|'cap'|'grey', stance: 'stand'|'crouch'|'sit',
 *      phase (walk cycle) , armL:{u,f}, armR:{u,f}, nod, shadow, lean }
 */
function person2(ctx, o) {
  const s = (o.h || 100) / 100
  if (o.shadow !== false) castShadow(ctx, o.x, o.y, 16 * s)
  ctx.save()
  ctx.translate(o.x, o.y - (o.phase != null ? Math.abs(Math.sin(o.phase)) * 2.4 * s : 0))
  ctx.scale(o.flip ? -s : s, s)
  if (o.lean) ctx.rotate(o.lean)
  const skin = SKIN[(o.skin || 0) % SKIN.length]
  const top = TOPS[(o.top || 0) % TOPS.length]
  const bot = BOTTOMS[(o.bottom ?? o.top ?? 0) % BOTTOMS.length]
  const hairC = HAIRC[(o.hair || 0) % HAIRC.length]
  const st = o.stance || 'stand'
  let hipY = -47, shY = -79
  if (st === 'crouch') { hipY = -28; shY = -56 }
  if (st === 'sit') { hipY = -24; shY = -58 }
  ctx.lineCap = 'round'

  // ═ legs ═
  const foot = (fx, fy) => {
    ctx.fillStyle = '#2c2620'
    ctx.beginPath(); ctx.ellipse(fx + 3.4, fy - 1.6, 6, 3, 0, 0, TAU); ctx.fill()
  }
  if (o.phase != null) {
    // walk cycle with knee articulation
    for (const side of [1, 0]) {
      const ph = o.phase + side * Math.PI
      const swing = Math.sin(ph)
      const lift = Math.max(0, Math.sin(ph + Math.PI * 0.42))
      const kneeX = swing * 7, kneeY = hipY * 0.48 - lift * 3
      const footX = swing * 14, footY = -lift * 10
      ctx.strokeStyle = side ? shade('#2a3040', -30) && shade((bot.startsWith('#') ? bot : '#2a3040'), -26) : bot
      ctx.lineWidth = 9.5
      ctx.beginPath(); ctx.moveTo(0, hipY); ctx.quadraticCurveTo(kneeX, kneeY, footX, footY); ctx.stroke()
      foot(footX, footY)
    }
  } else if (st === 'crouch') {
    ctx.strokeStyle = bot; ctx.lineWidth = 9.5
    ctx.beginPath(); ctx.moveTo(0, hipY); ctx.lineTo(10, -16); ctx.lineTo(6, 0); ctx.stroke()
    ctx.strokeStyle = shade(bot.startsWith('#') ? bot : '#2a3040', -26)
    ctx.beginPath(); ctx.moveTo(0, hipY); ctx.lineTo(-8, -14); ctx.lineTo(-10, 0); ctx.stroke()
    foot(6, 0); foot(-10, 0)
  } else if (st === 'sit') {
    ctx.strokeStyle = bot; ctx.lineWidth = 9.5
    ctx.beginPath(); ctx.moveTo(0, hipY); ctx.lineTo(13, -12); ctx.lineTo(12, 0); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(0, hipY); ctx.lineTo(8, -10); ctx.lineTo(6, 0); ctx.stroke()
    foot(12, 0); foot(6, 0)
  } else {
    ctx.strokeStyle = bot; ctx.lineWidth = 9.5
    ctx.beginPath(); ctx.moveTo(-1, hipY); ctx.lineTo(-3.4, 0); ctx.stroke()
    ctx.strokeStyle = shade(bot.startsWith('#') ? bot : '#2a3040', -26)
    ctx.beginPath(); ctx.moveTo(1, hipY); ctx.lineTo(4, 0); ctx.stroke()
    foot(4, 0); foot(-3.4, 0)
  }

  // ═ torso — jacket with core shadow + warm rim light ═
  const tw = 13 // half shoulder width
  ctx.fillStyle = top
  ctx.beginPath()
  ctx.moveTo(-tw + 2, shY)
  ctx.quadraticCurveTo(0, shY - 5, tw - 2, shY)
  ctx.quadraticCurveTo(tw + 1.5, (shY + hipY) / 2, tw - 3.5, hipY + 2)
  ctx.lineTo(-tw + 3.5, hipY + 2)
  ctx.quadraticCurveTo(-tw - 1.5, (shY + hipY) / 2, -tw + 2, shY)
  ctx.closePath(); ctx.fill()
  // core shadow (left) + rim light (right, sun side)
  const sg = ctx.createLinearGradient(-tw, 0, tw, 0)
  sg.addColorStop(0, 'rgba(20,14,10,0.30)'); sg.addColorStop(0.55, 'rgba(20,14,10,0)')
  ctx.fillStyle = sg; ctx.fill()
  ctx.strokeStyle = 'rgba(255,214,150,0.65)'; ctx.lineWidth = 1.6
  ctx.beginPath()
  ctx.moveTo(tw - 2.4, shY + 1)
  ctx.quadraticCurveTo(tw + 1, (shY + hipY) / 2, tw - 4, hipY)
  ctx.stroke()

  // ═ arms (upper + forearm) ═
  const arm = (side, a) => {
    const sx = side * (tw - 3)
    const u = (a?.u ?? 0.18) * side, f = (a?.f ?? 0.12) * side
    ctx.save(); ctx.translate(sx, shY + 4); ctx.rotate(u)
    ctx.strokeStyle = side > 0 ? top : shade(top.startsWith('#') ? top : '#3d6b8f', -28)
    ctx.lineWidth = 7.5
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, 15); ctx.stroke()
    ctx.translate(0, 15); ctx.rotate(f)
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, 12); ctx.stroke()
    ctx.strokeStyle = skin; ctx.lineWidth = 6.5
    ctx.beginPath(); ctx.moveTo(0, 12); ctx.lineTo(0, 17); ctx.stroke()
    ctx.restore()
  }
  arm(-1, o.armL); arm(1, o.armR)

  // ═ head + hair ═
  ctx.save()
  if (o.nod) ctx.rotate(Math.sin(o.nod) * 0.06)
  const hy = shY - 12
  ctx.fillStyle = skin
  ctx.beginPath(); ctx.arc(0, hy, 9.5, 0, TAU); ctx.fill()
  // face shading toward sun
  ctx.fillStyle = 'rgba(255,214,150,0.28)'
  ctx.beginPath(); ctx.arc(2.4, hy - 1, 7, -0.8, 0.9); ctx.fill()
  const style = o.hairStyle || 'short'
  ctx.fillStyle = hairC
  if (style === 'short') {
    ctx.beginPath(); ctx.arc(0, hy - 1.6, 9.2, Math.PI * 0.96, TAU * 0.98); ctx.fill()
  } else if (style === 'long') {
    ctx.beginPath(); ctx.arc(0, hy - 1.6, 9.4, Math.PI * 0.92, TAU); ctx.fill()
    ctx.beginPath(); ctx.roundRect(-9.4, hy - 2, 5, 20, 2.4); ctx.fill()
  } else if (style === 'bun') {
    ctx.beginPath(); ctx.arc(0, hy - 1.6, 9.2, Math.PI * 0.96, TAU * 0.98); ctx.fill()
    ctx.beginPath(); ctx.arc(-8.4, hy - 6, 4.4, 0, TAU); ctx.fill()
  } else if (style === 'cap') {
    ctx.beginPath(); ctx.arc(0, hy - 2, 9.6, Math.PI, TAU); ctx.fill()
    ctx.beginPath(); ctx.roundRect(0, hy - 6.4, 13, 3.2, 1.6); ctx.fill()
  } else if (style === 'grey') {
    ctx.fillStyle = '#cfc9bd'
    ctx.beginPath(); ctx.arc(0, hy - 1.6, 9.2, Math.PI * 0.9, TAU); ctx.fill()
  }
  ctx.restore()
  ctx.restore()
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
      // hazy environmental sun — small disc, layered bloom, no rays
      ctx.save(); ctx.globalCompositeOperation = 'lighter'
      glow(ctx, SUNX, SUNY, 190, 'rgba(255,196,120,0.20)', 'rgba(255,196,120,0)')
      glow(ctx, SUNX, SUNY, 90, 'rgba(255,220,160,0.36)', 'rgba(255,214,150,0)')
      ctx.restore()
      ctx.fillStyle = 'rgba(255,238,204,0.96)'
      ctx.beginPath(); ctx.arc(SUNX, SUNY, 30, 0, TAU); ctx.fill()
      ctx.fillStyle = 'rgba(255,224,170,0.5)'
      ctx.beginPath(); ctx.arc(SUNX, SUNY, 36, 0, TAU); ctx.fill()
      // horizon haze bands
      ctx.save(); ctx.globalCompositeOperation = 'lighter'
      ctx.fillStyle = 'rgba(250,196,130,0.30)'
      ctx.beginPath(); ctx.ellipse(SUNX - 60, HZ - 8, 560, 26, 0, 0, TAU); ctx.fill()
      ctx.fillStyle = 'rgba(244,186,128,0.20)'
      ctx.beginPath(); ctx.ellipse(700, HZ - 20, 900, 20, 0, 0, TAU); ctx.fill()
      ctx.restore()
    })

    // stratus clouds — dark tops, warm lit undersides
    par(10, () => {
      for (const c of s.clouds) {
        c.x += c.v * dt; if (c.x - c.r > VW + 260) c.x = -c.r - 260
        const g = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, c.r)
        g.addColorStop(0, c.warm ? 'rgba(120,96,116,0.5)' : 'rgba(96,84,116,0.44)')
        g.addColorStop(1, 'rgba(100,86,116,0)')
        ctx.fillStyle = g
        ctx.beginPath(); ctx.ellipse(c.x, c.y, c.r, c.r * c.sq, 0, 0, TAU); ctx.fill()
        ctx.beginPath(); ctx.ellipse(c.x + c.r * 0.5, c.y + 6, c.r * 0.68, c.r * c.sq * 0.8, 0, 0, TAU); ctx.fill()
        // sun-lit underside
        const lg = ctx.createRadialGradient(c.x + 30, c.y + c.r * c.sq * 0.7, 0, c.x + 30, c.y + c.r * c.sq * 0.7, c.r * 0.9)
        lg.addColorStop(0, 'rgba(255,190,120,0.32)'); lg.addColorStop(1, 'rgba(255,190,120,0)')
        ctx.fillStyle = lg
        ctx.beginPath(); ctx.ellipse(c.x + 30, c.y + c.r * c.sq * 0.72, c.r * 0.92, c.r * c.sq * 0.5, 0, 0, TAU); ctx.fill()
      }
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
      for (let i = 0; i < 3; i++) {
        const a = t * 0.3 + i * 2.1
        gull(ctx, 1080 + Math.cos(a) * 120, 260 + Math.sin(a * 1.3) * 40, 0.8, t * 6 + i * 2)
      }
    })

    // ═══ FAR SHORE ═══
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

    par(8, () => {
      // mirror bloom under the sun — soft elliptical, no hard edges
      ctx.save(); ctx.globalCompositeOperation = 'lighter'
      ctx.save(); ctx.translate(SUNX - 40, HZ + 6); ctx.scale(1, 0.16)
      glow(ctx, 0, 0, 420, 'rgba(255,224,164,0.55)', 'rgba(255,224,164,0)')
      ctx.restore()
      // reflection corridor: stacked soft wobbling ellipses fading with depth
      for (let i = 0; i < 22; i++) {
        const q = i / 22
        const y = HZ + 10 + q * 330
        const wob = Math.sin(t * 1.9 + i * 0.8) * (4 + i * 2)
        const w = 46 + i * 11
        const a = (1 - q) * 0.11 * (0.7 + 0.3 * Math.sin(t * 2.4 + i))
        ctx.fillStyle = `rgba(255,218,150,${a.toFixed(3)})`
        ctx.beginPath(); ctx.ellipse(SUNX - 30 + wob - q * 60, y, w, 3.4 + i * 0.28, 0, 0, TAU); ctx.fill()
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

      // live glitter field in the sun corridor
      ctx.save(); ctx.globalCompositeOperation = 'lighter'
      for (const g of s.glints) {
        const tw2 = Math.max(0, Math.sin(t * g.sp + g.ph))
        if (tw2 < 0.25) continue
        const a = 0.65 * tw2 * (1 - (g.y - HZ) / 420)
        ctx.fillStyle = `rgba(255,226,158,${a.toFixed(3)})`
        ctx.fillRect(g.x - g.len * tw2 * 0.5, g.y, g.len * tw2, 1.9)
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
        ctx.save(); ctx.translate(fx, fy); ctx.rotate((jp - 0.5) * 1.7); ctx.scale(0.72, 0.72)
        ctx.fillStyle = '#48707f'
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(9, -10, 21, -6); ctx.quadraticCurveTo(17, -2, 21, 2); ctx.quadraticCurveTo(9, 7, 0, 0); ctx.fill()
        ctx.beginPath(); ctx.moveTo(21, -6); ctx.lineTo(29, -10); ctx.lineTo(26, -2); ctx.lineTo(29, 5); ctx.lineTo(21, 2); ctx.closePath(); ctx.fill()
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
      ctx.beginPath(); ctx.ellipse(0, 17, 62, 8, 0, 0, TAU); ctx.fill()
      ctx.fillStyle = '#dde2e6'; ctx.strokeStyle = '#5b6770'; ctx.lineWidth = 2.4
      ctx.beginPath(); ctx.moveTo(-56, -6); ctx.lineTo(56, -6); ctx.lineTo(44, 13); ctx.lineTo(-48, 13); ctx.closePath(); ctx.fill(); ctx.stroke()
      ctx.fillStyle = '#3d6b8f'; ctx.fillRect(-56, -6, 112, 5)
      ctx.fillStyle = 'rgba(255,214,150,0.4)'; ctx.fillRect(-56, -7.4, 112, 1.8)
      ctx.fillStyle = '#aab4bc'; ctx.fillRect(8, -22, 18, 16)
      ctx.strokeStyle = '#5b6770'; ctx.beginPath(); ctx.moveTo(24, -22); ctx.lineTo(24, -40); ctx.stroke()
      ctx.fillStyle = Math.sin(t * 4) > 0 ? '#5eead4' : '#2b6b60'
      ctx.beginPath(); ctx.arc(24, -42, 2.4, 0, TAU); ctx.fill()
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
        x: -26, y: -5, h: 46, skin: 3, top: 7, bottom: 2, hairStyle: 'cap', hair: 2, shadow: false,
        lean: -bend * 0.55,
        armR: { u: -0.3 - bend * 1.3 - inspect * 1.5, f: -0.3 - bend * 0.5 },
        armL: { u: 0.3 - bend * 0.9, f: 0.2 - bend * 0.4 },
        nod: inspect * 2.4,
      })
      if (inspect > 0.15) { // lifted sample bottle catching the light
        ctx.fillStyle = `rgba(214,238,248,${(0.9 * inspect).toFixed(3)})`
        ctx.fillRect(-40, -36 - inspect * 6, 5, 8)
      }
      if (bend === 1 && Math.sin(t * 5) > 0.4) { // hauling ripple at the winch line
        ctx.strokeStyle = 'rgba(250,252,255,0.35)'; ctx.lineWidth = 1.4
        ctx.beginPath(); ctx.ellipse(-34, 22, 8, 2.4, 0, 0, TAU); ctx.stroke()
      }
      // researcher 2: reads the tablet, periodically gestures toward the buoy
      const point2 = Math.max(0, Math.sin(t * 0.45) - 0.55) / 0.45
      person2(ctx, {
        x: 34, y: -5, h: 48, skin: 0, top: 6, bottom: 0, flip: true, hairStyle: 'bun', hair: 0, shadow: false,
        armR: { u: -0.9 - point2 * 0.9, f: -0.6 + point2 * 0.4 },
        armL: { u: -0.5, f: -0.9 },
        nod: t * 2,
      })
      ctx.save(); ctx.translate(40, -26); ctx.rotate(0.15)
      ctx.fillStyle = '#20262c'; ctx.fillRect(0, 0, 8, 5.6)
      ctx.fillStyle = 'rgba(125,220,240,0.9)'; ctx.fillRect(0.8, 0.8, 6.4, 4)
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
        armR: { u: -0.9 + rodA * 0.5, f: -0.35 },
        armL: reeling ? { u: -0.6 + Math.sin(t * 14) * 0.25, f: -0.9 + Math.cos(t * 14) * 0.3 } : { u: 0.5, f: 0.4 },
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
      // kid sitting on the edge, legs swinging; parent standing behind
      const swing = Math.sin(t * 2.2)
      ctx.save(); ctx.translate(1108, 686)
      person2(ctx, { x: 0, y: 0, h: 46, skin: 4, top: 8, bottom: 0, hairStyle: 'short', hair: 1, stance: 'sit', shadow: false, nod: t * 1.4 })
      ctx.strokeStyle = '#2a3040'; ctx.lineWidth = 4.4; ctx.lineCap = 'round'
      ctx.beginPath(); ctx.moveTo(3, -8); ctx.lineTo(6 + swing * 2, 8); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(7, -8); ctx.lineTo(10 - swing * 2, 8); ctx.stroke()
      ctx.restore()
      person2(ctx, { x: 1136, y: 710, h: 68, skin: 1, top: 1, bottom: 2, hairStyle: 'long', hair: 1, shadow: false, armL: { u: 0.3 + Math.sin(t * 0.9) * 0.05, f: 0.2 }, nod: t * 0.9 + 2 })
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
        x: 470, y: shoreY(470) + 26, h: 92, skin: 0, top: 7, bottom: 2, hairStyle: 'bun', hair: 0,
        stance: 'crouch', armR: { u: -1.5 - dip * 0.5 + lift * 0.9, f: -0.4 - dip * 0.4 }, armL: { u: 0.6, f: 0.5 }, nod: lift * 3,
      })
      // sample jar in hand
      ctx.fillStyle = 'rgba(214,238,248,0.9)'
      const jx = 486 + dip * -10 + lift * 6, jy = shoreY(470) - 20 + dip * 14 - lift * 26
      ctx.fillRect(jx, jy, 7, 10)
      ctx.strokeStyle = 'rgba(120,150,160,0.8)'; ctx.strokeRect(jx, jy, 7, 10)
      if (dip > 0.7) {
        ctx.strokeStyle = 'rgba(250,252,255,0.55)'; ctx.lineWidth = 1.6
        ctx.beginPath(); ctx.ellipse(jx + 3, shoreY(470) - 4, 12 * dip, 3.4 * dip, 0, 0, TAU); ctx.stroke()
      }
      person2(ctx, {
        x: 540, y: shoreY(540) + 40, h: 104, skin: 3, top: 8, bottom: 0, hairStyle: 'short', hair: 2, flip: true,
        armR: { u: -1.05 - Math.sin(t * 2.4) * 0.06, f: -0.9 }, armL: { u: 0.25, f: 0.15 }, nod: t * 1.2,
      })
      ctx.save(); ctx.translate(519, shoreY(540) - 34); ctx.rotate(-0.16)
      ctx.fillStyle = '#20262c'; ctx.fillRect(0, 0, 13, 9)
      ctx.fillStyle = 'rgba(125,220,240,0.95)'; ctx.fillRect(1.2, 1.2, 10.6, 6.6)
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

      // kids skipping stones + guardian (left)
      const skT = (t + 2.4) % 8
      const windup = skT < 0.5 ? Math.sin(skT / 0.5 * Math.PI) : 0
      person2(ctx, { x: 300, y: shoreY(300) + 42, h: 62, skin: 4, top: 0, bottom: 0, hairStyle: 'short', hair: 1, armR: { u: -0.7 - windup * 1.7, f: -0.5 - windup * 0.5 }, armL: { u: 0.3, f: 0.2 }, lean: -windup * 0.1 })
      person2(ctx, { x: 258, y: shoreY(258) + 48, h: 96, skin: 1, top: 3, bottom: 3, hairStyle: 'long', hair: 4, armL: { u: 0.4, f: 0.3 }, armR: { u: -0.3, f: -0.2 }, nod: t * 0.8 })
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
      const wx = lerp(1500, 60, clamp(wq, 0, 1))
      const wy = shoreY(wx) + 90
      const wph = t * 5.6
      if (wq > -0.1 && wq < 1.1) {
        person2(ctx, { x: wx, y: wy, h: 100, skin: 2, top: 1, bottom: 0, hairStyle: 'short', hair: 1, flip: true, phase: wph, armL: { u: Math.sin(wph) * 0.4, f: 0.25 }, armR: { u: Math.sin(wph + Math.PI) * 0.4, f: 0.25 } })
        person2(ctx, { x: wx + 34, y: wy + 6, h: 94, skin: 0, top: 5, bottom: 3, hairStyle: 'long', hair: 0, flip: true, phase: wph + 1.2, armL: { u: Math.sin(wph + 1.2) * 0.4, f: 0.25 }, armR: { u: Math.sin(wph + 1.2 + Math.PI) * 0.4, f: 0.25 } })
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
      person2(ctx, { x: logX - 30, y: logY - 8, h: 88, skin: 0, top: 2, bottom: 1, hairStyle: 'grey', stance: 'sit', armR: { u: talk ? -0.9 + Math.sin(t * 2.2) * 0.25 : -0.3, f: -0.5 }, nod: talk ? t * 2.2 : 0.4 })
      person2(ctx, { x: logX + 34, y: logY - 8, h: 84, skin: 1, top: 9, bottom: 4, hairStyle: 'grey', stance: 'sit', flip: true, armR: { u: !talk ? -0.85 + Math.sin(t * 1.9) * 0.22 : -0.25, f: -0.45 }, nod: !talk ? t * 1.9 : 0.2 })

      // youth launching a canoe (upper-left, half in water)
      const push = Math.sin(t * 1.15)
      ctx.save(); ctx.translate(150, shoreY(150) + 4 + push * 1.2); ctx.rotate(-0.1)
      canoeSide(ctx, 58, '#8a5a2b', '#4a2f14')
      ctx.restore()
      ctx.strokeStyle = 'rgba(240,248,255,0.35)'; ctx.lineWidth = 1.6
      ctx.beginPath(); ctx.ellipse(118, shoreY(150) + 6, 24 + push * 4, 5, 0, 0, TAU); ctx.stroke()
      person2(ctx, { x: 208, y: shoreY(208) + 26, h: 84, skin: 4, top: 6, bottom: 0, hairStyle: 'short', hair: 5, lean: -0.22 + push * 0.02, armL: { u: 1.15, f: 0.5 }, armR: { u: 1.05, f: 0.55 } })

      // photographer kneeling on the foreground granite (left)
      person2(ctx, { x: 210, y: 806, h: 118, skin: 1, top: 3, bottom: 2, hairStyle: 'cap', hair: 2, stance: 'crouch', armR: { u: -1.35, f: -1.05 }, armL: { u: -1.1, f: -1.2 }, nod: Math.sin(t * 0.4) })
      ctx.save(); ctx.translate(228, 728); ctx.rotate(0.1 + Math.sin(t * 0.4) * 0.03)
      ctx.fillStyle = '#20262c'; ctx.fillRect(0, 0, 15, 10); ctx.fillRect(15, 2, 7, 6)
      ctx.fillStyle = 'rgba(160,210,240,0.8)'; ctx.beginPath(); ctx.arc(22.4, 5, 2.4, 0, TAU); ctx.fill()
      ctx.restore()

      // family strolling mid-beach (parent + child holding hands)
      const fq = ((t * 0.02 + 0.5) % 1.4) - 0.2
      if (fq > -0.08 && fq < 1.08) {
        const fx = lerp(360, 1330, clamp(fq, 0, 1))
        const fy = shoreY(fx) + 150
        const fph = t * 5
        person2(ctx, { x: fx, y: fy, h: 108, skin: 5, top: 9, bottom: 2, hairStyle: 'short', hair: 0, phase: fph, armR: { u: 0.42, f: 0.2 }, armL: { u: Math.sin(fph) * 0.35, f: 0.2 } })
        person2(ctx, { x: fx + 40, y: fy + 2, h: 62, skin: 5, top: 8, bottom: 0, hairStyle: 'long', hair: 1, phase: fph + 0.9, armL: { u: -0.5, f: -0.25 }, armR: { u: Math.sin(fph + 0.9) * 0.4, f: 0.2 } })
        ctx.strokeStyle = 'rgba(60,44,30,0.35)'; ctx.lineWidth = 2
        ctx.beginPath(); ctx.moveTo(fx + 12, fy - 52); ctx.quadraticCurveTo(fx + 26, fy - 38, fx + 32, fy - 36); ctx.stroke()
      }

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

    // ═══ FOREGROUND — granite, grasses, driftwood, canoe bow ═══
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

    // ═══ HOVER DATA PREVIEWS ═══
    if (p.inside) {
      const targets = [
        { x: 640, y: 552, r: 46, lines: ['MONITORING BUOY · LIVE', 'pH 7.9 · 18.2 °C · DO 9.4 mg/L', 'Water Rangers site · updated 4 min ago'] },
        { x: 845, y: 505, r: 60, lines: ['RESEARCH CREW', 'Lowering a sonde — temperature,', 'oxygen and clarity, top to bottom.'] },
        { x: 505, y: shoreY(505), r: 60, lines: ['SHORELINE SAMPLING', 'Volunteers collect jars for the', 'community lab. Anyone can learn how.'] },
        { x: 660, y: shoreY(660) + 30, r: 44, lines: ['SHORE STATION', 'Uploading readings to the open', 'SOURCE Water network.'] },
        { x: 430, y: 478, r: 40, lines: ['COMMON LOON', 'Gavia immer — a clean-water', 'indicator species.'] },
      ]
      for (const tg of targets) {
        const d2 = (p.x - tg.x) ** 2 + (p.y - tg.y) ** 2
        if (d2 < tg.r * tg.r) {
          ctx.strokeStyle = 'rgba(125,245,223,0.6)'; ctx.lineWidth = 1.6
          ctx.beginPath(); ctx.arc(tg.x, tg.y, tg.r * 0.66 + Math.sin(t * 3) * 2, 0, TAU); ctx.stroke()
          glassCard(ctx, tg.x + 26, tg.y - 20, tg.lines)
          break
        }
      }
    }

    // ═══ GRADE: warm bloom near sun path + cool vignette ═══
    ctx.save(); ctx.globalCompositeOperation = 'lighter'
    const bloom = ctx.createRadialGradient(SUNX, HZ, 40, SUNX, HZ, 700)
    bloom.addColorStop(0, 'rgba(255,190,110,0.10)'); bloom.addColorStop(1, 'rgba(255,190,110,0)')
    ctx.fillStyle = bloom; ctx.fillRect(0, 0, VW, VH)
    ctx.restore()
    const vg = ctx.createRadialGradient(VW * 0.55, VH * 0.42, VH * 0.45, VW * 0.55, VH * 0.42, VH * 1.05)
    vg.addColorStop(0, 'rgba(18,12,8,0)'); vg.addColorStop(1, 'rgba(18,12,8,0.42)')
    ctx.fillStyle = vg; ctx.fillRect(0, 0, VW, VH)
  },
}
