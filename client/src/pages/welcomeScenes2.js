/**
 * welcomeScenes2 — Canvas2D scenes 3–5: the Great Lakes data network,
 * Turtle Island (community), and the twilight aurora finale.
 */
import { VW, VH, vGrad, glow, makeParticles, lerp, clamp } from './welcomeEngine'

const TAU = Math.PI * 2
// ───────────────────────────────────────────────────────────────────────────
// SCENE 3 · The Four Directions — the seasonal round of caring for water
// ───────────────────────────────────────────────────────────────────────────
// A living medicine-wheel: four quadrants, each a season with its own colour,
// weather and monitoring work. The wheel turns, each season's world breathes
// its own particles, and clicking a direction opens what the water asks of us
// then. Grounded in Anishinaabe teaching of the four directions and framed
// around the year-round citizen-science monitoring cycle.
const DIRECTIONS = [
  {
    id: 'east', dir: 'WAABANONG · EAST', season: 'Spring — Zeegwun',
    colour: '#f0c74a', a0: -Math.PI / 2, // quadrant start angle
    teaching: 'New light. Beginnings, and the first water to move.',
    work: [
      'Spring melt carries winter’s road salt to the lake —',
      'the biggest chloride spike of the year.',
      'Rangers test after every thaw and heavy rain.',
    ],
    stat: 'Peak melt · chloride watch',
  },
  {
    id: 'south', dir: 'ZHAAWANONG · SOUTH', season: 'Summer — Niibin',
    colour: '#d95b3e',
    teaching: 'Growth and warmth. The season of tending what lives.',
    work: [
      'Warm, still water holds less oxygen and feeds algae.',
      'Weekly temperature, oxygen and clarity readings',
      'catch a bloom before it closes a beach.',
    ],
    stat: 'Weekly testing · bloom watch',
  },
  {
    id: 'west', dir: 'EPINGISHIMOG · WEST', season: 'Autumn — Dagwaagin',
    colour: '#2e3440',
    teaching: 'Reflection. We look back at what the year has shown.',
    work: [
      'Storms stir the lakebed and wash the shore.',
      'Turbidity and flow readings after each storm',
      'show what the watershed is carrying down.',
    ],
    stat: 'Storm response · turbidity',
  },
  {
    id: 'north', dir: 'GIIWEDINONG · NORTH', season: 'Winter — Biboon',
    colour: '#e8eef2',
    teaching: 'Rest and endurance. The water keeps its quiet work.',
    work: [
      'Under the ice the lake is still alive — and still salted.',
      'The Winter Testkit reads chloride and conductivity',
      'right through the cold months.',
    ],
    stat: 'Year-round · winter kit',
  },
]

export const directionsScene = {
  setup({ rnd }) {
    return {
      rot: 0, sel: null, selT: 0, hover: null,
      // per-season ambient particles (petals, heat shimmer, leaves, snow)
      parts: makeParticles(150, (i) => ({
        q: i % 4, a: rnd() * TAU, r: 0.25 + rnd() * 0.85,
        sp: 0.2 + rnd() * 0.7, ph: rnd() * TAU, sz: 0.6 + rnd() * 1.9,
      })),
      stars: makeParticles(70, () => ({ x: rnd() * VW, y: rnd() * VH, r: 0.6 + rnd() * 1.2, ph: rnd() * TAU })),
      ripples: makeParticles(4, (i) => ({ ph: i / 4 })),
    }
  },

  draw(ctx, t, dt, s, env) {
    const p = env.pointer
    const CX = 1010, CY = 452, R = 268

    // ── night-water backdrop ──
    const bg = ctx.createRadialGradient(CX, CY, 40, CX, CY, 900)
    bg.addColorStop(0, '#0d2b46'); bg.addColorStop(0.5, '#0a1e35'); bg.addColorStop(1, '#050f1d')
    ctx.fillStyle = bg; ctx.fillRect(0, 0, VW, VH)
    for (const st of s.stars) {
      ctx.fillStyle = `rgba(190,220,250,${(0.1 + 0.22 * Math.max(0, Math.sin(t * 0.7 + st.ph))).toFixed(3)})`
      ctx.beginPath(); ctx.arc(st.x, st.y, st.r, 0, TAU); ctx.fill()
    }

    s.rot += dt * 0.045 // the wheel turns with the year

    // which quadrant is the pointer over?
    let hoverQ = null
    if (p.inside) {
      const dx = p.x - CX, dy = p.y - CY, d = Math.hypot(dx, dy)
      if (d < R * 1.06) {
        let a = Math.atan2(dy, dx) - s.rot + Math.PI / 2
        a = ((a % TAU) + TAU) % TAU
        hoverQ = Math.floor(a / (TAU / 4)) % 4
      }
    }
    s.hover = hoverQ

    // ── expanding water rings under the wheel ──
    for (const rp of s.ripples) {
      rp.ph += dt * 0.12; if (rp.ph > 1) rp.ph -= 1
      const rr = R * (0.55 + rp.ph * 0.85)
      ctx.strokeStyle = `rgba(125,200,235,${(0.16 * (1 - rp.ph)).toFixed(3)})`
      ctx.lineWidth = 1.6
      ctx.beginPath(); ctx.arc(CX, CY, rr, 0, TAU); ctx.stroke()
    }

    // ── seasonal particle worlds, each drifting in its own quadrant ──
    for (const pt of s.parts) {
      pt.ph += dt * pt.sp
      const D = DIRECTIONS[pt.q]
      const qa = s.rot - Math.PI / 2 + pt.q * (TAU / 4)
      const spread = (TAU / 4) * (0.12 + (pt.a % 1) * 0.76)
      const ang = qa + spread
      const active = s.sel === D || hoverQ === pt.q
      let rad = R * (pt.r + 0.06)
      let px, py, alpha = active ? 0.55 : 0.25
      if (pt.q === 0) {        // EAST — rising sparks of new light
        rad += Math.sin(pt.ph) * 14
        px = CX + Math.cos(ang) * rad; py = CY + Math.sin(ang) * rad - (pt.ph % 3) * 12
      } else if (pt.q === 1) { // SOUTH — warm shimmer drifting up
        px = CX + Math.cos(ang) * rad + Math.sin(pt.ph * 2) * 8
        py = CY + Math.sin(ang) * rad - (pt.ph % 4) * 9
      } else if (pt.q === 2) { // WEST — leaves falling and turning
        px = CX + Math.cos(ang) * rad + Math.sin(pt.ph * 1.4) * 16
        py = CY + Math.sin(ang) * rad + (pt.ph % 4) * 11
      } else {                 // NORTH — slow snow
        px = CX + Math.cos(ang) * rad + Math.sin(pt.ph * 0.8) * 12
        py = CY + Math.sin(ang) * rad + (pt.ph % 5) * 7
      }
      ctx.fillStyle = D.colour === '#2e3440'
        ? `rgba(198,150,86,${alpha.toFixed(3)})`   // autumn leaves read warm
        : `rgba(${hexRgb(D.colour)},${alpha.toFixed(3)})`
      if (pt.q === 2) { // leaf shape
        ctx.save(); ctx.translate(px, py); ctx.rotate(pt.ph)
        ctx.beginPath(); ctx.ellipse(0, 0, pt.sz * 2.4, pt.sz, 0, 0, TAU); ctx.fill(); ctx.restore()
      } else {
        ctx.beginPath(); ctx.arc(px, py, pt.sz, 0, TAU); ctx.fill()
      }
    }

    // ── the wheel ──
    ctx.save()
    ctx.translate(CX, CY); ctx.rotate(s.rot)
    for (let q = 0; q < 4; q++) {
      const D = DIRECTIONS[q]
      const a0 = -Math.PI / 2 + q * (TAU / 4), a1 = a0 + TAU / 4
      const active = s.sel === D || hoverQ === q
      // quadrant fill
      const g = ctx.createRadialGradient(0, 0, R * 0.22, 0, 0, R)
      g.addColorStop(0, `rgba(${hexRgb(D.colour)},${active ? 0.5 : 0.26})`)
      g.addColorStop(1, `rgba(${hexRgb(D.colour)},${active ? 0.2 : 0.07})`)
      ctx.fillStyle = g
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, R, a0, a1); ctx.closePath(); ctx.fill()
      // outer arc
      ctx.strokeStyle = `rgba(${hexRgb(D.colour)},${active ? 0.95 : 0.55})`
      ctx.lineWidth = active ? 5 : 3
      ctx.beginPath(); ctx.arc(0, 0, R, a0 + 0.02, a1 - 0.02); ctx.stroke()
      // season glyph on the rim
      const am = (a0 + a1) / 2
      ctx.save()
      ctx.translate(Math.cos(am) * (R * 0.72), Math.sin(am) * (R * 0.72))
      ctx.rotate(-s.rot)
      drawSeasonGlyph(ctx, q, t, active)
      ctx.restore()
    }
    // spokes + hub
    ctx.strokeStyle = 'rgba(226,238,248,0.5)'; ctx.lineWidth = 2.4
    ctx.beginPath()
    ctx.moveTo(0, -R); ctx.lineTo(0, R); ctx.moveTo(-R, 0); ctx.lineTo(R, 0); ctx.stroke()
    ctx.strokeStyle = 'rgba(226,238,248,0.35)'; ctx.lineWidth = 1.6
    ctx.beginPath(); ctx.arc(0, 0, R * 0.5, 0, TAU); ctx.stroke()
    ctx.restore()

    // ── hub: a living drop of water ──
    const pulse = 1 + Math.sin(t * 1.4) * 0.05
    glow(ctx, CX, CY, 92 * pulse, 'rgba(125,200,235,0.30)', 'rgba(125,200,235,0)')
    ctx.save(); ctx.translate(CX, CY); ctx.scale(pulse, pulse)
    const dg = ctx.createRadialGradient(-8, -14, 3, 0, 0, 42)
    dg.addColorStop(0, '#bfe9ff'); dg.addColorStop(0.55, '#5ab4e0'); dg.addColorStop(1, '#1d6d9c')
    ctx.fillStyle = dg
    ctx.beginPath()
    ctx.moveTo(0, -44)
    ctx.bezierCurveTo(26, -14, 34, 6, 34, 14)
    ctx.arc(0, 14, 34, 0, Math.PI)
    ctx.bezierCurveTo(-34, 6, -26, -14, 0, -44)
    ctx.closePath(); ctx.fill()
    ctx.fillStyle = 'rgba(255,255,255,0.5)'
    ctx.beginPath(); ctx.ellipse(-11, -6, 7, 11, -0.4, 0, TAU); ctx.fill()
    // ripple inside the drop
    ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 1.4
    const ir = ((t * 0.5) % 1)
    ctx.beginPath(); ctx.arc(0, 12, 6 + ir * 22, 0, TAU); ctx.stroke()
    ctx.restore()
    ctx.fillStyle = 'rgba(232,244,252,0.92)'
    ctx.font = '700 13px "DM Sans", system-ui, sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('WATER', CX, CY + 74)
    ctx.font = '400 11.5px "DM Sans", system-ui, sans-serif'
    ctx.fillStyle = 'rgba(170,200,224,0.85)'
    ctx.fillText('at the centre of the year', CX, CY + 90)
    ctx.textAlign = 'left'

    // ── click to open a direction ──
    if (p.click) {
      const c = p.click; p.click = null
      const dx = c.x - CX, dy = c.y - CY, d = Math.hypot(dx, dy)
      if (d < R * 1.06) {
        let a = Math.atan2(dy, dx) - s.rot + Math.PI / 2
        a = ((a % TAU) + TAU) % TAU
        const q = Math.floor(a / (TAU / 4)) % 4
        s.sel = s.sel === DIRECTIONS[q] ? null : DIRECTIONS[q]
        s.selT = 0
      } else s.sel = null
    }

    // ── the teaching card ──
    if (s.sel) {
      s.selT = Math.min(1, s.selT + dt * 4)
      const D = s.sel
      ctx.save(); ctx.globalAlpha = s.selT
      // anchored lower-left: clears the DOM intro panel (top-left) and the wheel
      const cx = 70, cy = 566, w = 470
      ctx.font = '400 17px "DM Sans", system-ui, sans-serif'
      const h = 268
      ctx.fillStyle = 'rgba(5,17,29,0.92)'
      ctx.strokeStyle = `rgba(${hexRgb(D.colour)},0.75)`; ctx.lineWidth = 1.8
      ctx.beginPath(); ctx.roundRect(cx, cy, w, h, 18); ctx.fill(); ctx.stroke()
      // colour bar
      ctx.fillStyle = D.colour
      ctx.beginPath(); ctx.roundRect(cx, cy, 7, h, 18); ctx.fill()
      ctx.fillStyle = `rgba(${hexRgb(D.colour)},0.95)`
      ctx.font = '700 13px "DM Sans", system-ui, sans-serif'
      ctx.fillText(D.dir, cx + 30, cy + 40)
      ctx.fillStyle = '#f2f8fe'; ctx.font = '700 27px "DM Sans", system-ui, sans-serif'
      ctx.fillText(D.season, cx + 30, cy + 76)
      ctx.fillStyle = '#b9cfe2'; ctx.font = 'italic 17px Georgia, serif'
      ctx.fillText(D.teaching, cx + 30, cy + 108)
      ctx.fillStyle = '#dceaf6'; ctx.font = '400 16px "DM Sans", system-ui, sans-serif'
      D.work.forEach((l, i) => ctx.fillText(l, cx + 30, cy + 146 + i * 25))
      // stat chip
      ctx.font = '700 12.5px "DM Sans", system-ui, sans-serif'
      const sw = ctx.measureText(D.stat).width + 24
      ctx.fillStyle = `rgba(${hexRgb(D.colour)},0.2)`
      ctx.strokeStyle = `rgba(${hexRgb(D.colour)},0.8)`; ctx.lineWidth = 1
      ctx.beginPath(); ctx.roundRect(cx + 30, cy + h - 52, sw, 26, 13); ctx.fill(); ctx.stroke()
      ctx.fillStyle = D.colour === '#2e3440' ? '#c8d2dc' : D.colour
      ctx.fillText(D.stat, cx + 42, cy + h - 34)
      ctx.restore()
    }

    // vignette
    const vg = ctx.createRadialGradient(CX, CY, R * 0.9, CX, CY, VH * 1.1)
    vg.addColorStop(0, 'rgba(2,10,20,0)'); vg.addColorStop(1, 'rgba(2,10,20,0.5)')
    ctx.fillStyle = vg; ctx.fillRect(0, 0, VW, VH)
  },
}

function hexRgb(hex) {
  const n = parseInt(hex.slice(1), 16)
  return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`
}

// little animated emblem for each season, drawn on the wheel rim
function drawSeasonGlyph(ctx, q, t, active) {
  const A = active ? 1 : 0.7
  ctx.save()
  if (q === 0) { // EAST — sunrise over water
    ctx.fillStyle = `rgba(240,199,74,${A})`
    ctx.beginPath(); ctx.arc(0, -2, 11 + Math.sin(t * 1.5) * 0.8, Math.PI, TAU); ctx.fill()
    ctx.strokeStyle = `rgba(240,199,74,${A * 0.85})`; ctx.lineWidth = 2
    for (let i = 0; i < 5; i++) {
      const a = Math.PI + 0.16 + i * 0.68
      ctx.beginPath()
      ctx.moveTo(Math.cos(a) * 14, -2 + Math.sin(a) * 14)
      ctx.lineTo(Math.cos(a) * (19 + Math.sin(t * 2 + i) * 2), -2 + Math.sin(a) * (19 + Math.sin(t * 2 + i) * 2))
      ctx.stroke()
    }
    ctx.strokeStyle = `rgba(240,199,74,${A})`; ctx.lineWidth = 2.4
    ctx.beginPath(); ctx.moveTo(-16, 4); ctx.lineTo(16, 4); ctx.stroke()
  } else if (q === 1) { // SOUTH — growing stem
    ctx.strokeStyle = `rgba(217,91,62,${A})`; ctx.lineWidth = 2.6; ctx.lineCap = 'round'
    const sway = Math.sin(t * 1.2) * 3
    ctx.beginPath(); ctx.moveTo(0, 14); ctx.quadraticCurveTo(sway, 0, sway * 0.5, -14); ctx.stroke()
    ctx.fillStyle = `rgba(217,91,62,${A})`
    ctx.beginPath(); ctx.ellipse(-7 + sway * 0.4, -2, 7, 4, -0.6, 0, TAU); ctx.fill()
    ctx.beginPath(); ctx.ellipse(7 + sway * 0.4, -8, 7, 4, 0.6, 0, TAU); ctx.fill()
  } else if (q === 2) { // WEST — storm cloud + rain
    ctx.fillStyle = `rgba(190,200,214,${A})`
    ctx.beginPath(); ctx.arc(-6, -4, 8, 0, TAU); ctx.arc(5, -4, 10, 0, TAU); ctx.arc(-1, -10, 8, 0, TAU); ctx.fill()
    ctx.strokeStyle = `rgba(150,190,220,${A})`; ctx.lineWidth = 2; ctx.lineCap = 'round'
    for (let i = 0; i < 3; i++) {
      const off = ((t * 22 + i * 9) % 18)
      ctx.beginPath(); ctx.moveTo(-8 + i * 8, 4 + off * 0.5); ctx.lineTo(-10 + i * 8, 10 + off * 0.5); ctx.stroke()
    }
  } else { // NORTH — snowflake / ice star
    ctx.strokeStyle = `rgba(232,238,242,${A})`; ctx.lineWidth = 2.2; ctx.lineCap = 'round'
    ctx.save(); ctx.rotate(t * 0.3)
    for (let i = 0; i < 6; i++) {
      ctx.rotate(TAU / 6)
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -13); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(0, -8); ctx.lineTo(4, -11); ctx.moveTo(0, -8); ctx.lineTo(-4, -11); ctx.stroke()
    }
    ctx.restore()
  }
  ctx.restore()
}

// ───────────────────────────────────────────────────────────────────────────
// SCENE 4 · Turtle Island — the artwork, alive (transparent canvas panel)
// ───────────────────────────────────────────────────────────────────────────
const T = {
  tail: 'M452 372 C472 362 484 366 488 378 C484 388 468 392 452 388 Z',
  neck: 'M152 348 C120 336 96 308 86 276 C80 256 84 240 98 231 C114 221 134 226 144 243 C152 257 154 274 162 292 Z',
  head: 'M62 252 C54 232 62 212 84 205 C106 198 126 208 132 226 C137 243 128 259 108 264 C88 269 70 266 62 252 Z',
  legA: 'M182 392 C176 424 182 448 198 456 C214 462 226 450 224 426 L220 394 Z',
  legB: 'M368 394 C362 428 368 452 386 458 C404 464 416 450 412 424 L408 396 Z',
  shell: 'M124 394 C118 300 186 208 300 198 C408 190 468 274 466 368 C466 386 456 394 438 394 Z',
  shine: 'M330 240 C376 236 416 262 432 300 C438 322 428 338 402 340 C368 342 336 324 324 292 C316 268 316 248 330 240 Z',
  rib1: 'M148 400 C120 460 158 512 128 574 C112 610 126 650 106 700 L170 700 C186 652 170 612 188 576 C214 516 172 462 200 402 Z',
  rib2: 'M258 404 C240 470 276 522 252 586 C240 620 252 660 240 702 L318 702 C330 660 318 622 332 586 C356 524 316 472 336 406 Z',
  rib3: 'M392 402 C420 464 388 516 420 578 C438 612 426 652 444 700 L378 700 C364 652 376 614 360 578 C334 518 372 464 348 404 Z',
}

export const turtleScene = {
  vw: 560, vh: 720, alpha: true,
  setup({ rnd }) {
    const P = {}
    for (const k of Object.keys(T)) P[k] = new Path2D(T[k])
    return {
      P,
      splashes: makeParticles(24, () => ({ rib: (rnd() * 3) | 0, life: rnd(), vx: (rnd() - 0.5) * 30, vy: -20 - rnd() * 40 })),
      sparkPh: rnd() * 10,
    }
  },
  draw(ctx, t, dt, s) {
    const W = 560, H = 720

    // sun with slowly turning rays
    ctx.save(); ctx.translate(360, 212)
    ctx.rotate(t * 0.06)
    ctx.strokeStyle = 'rgba(238,193,79,0.55)'; ctx.lineWidth = 5; ctx.lineCap = 'round'
    for (let i = 0; i < 12; i++) {
      ctx.rotate(TAU / 12)
      ctx.beginPath(); ctx.moveTo(0, -160); ctx.lineTo(0, -184); ctx.stroke()
    }
    ctx.restore()
    const sb = 1 + Math.sin(t * 0.8) * 0.03
    const sg = ctx.createRadialGradient(360, 212, 10, 360, 212, 150 * sb)
    sg.addColorStop(0, '#ffefad'); sg.addColorStop(0.7, '#f6d36b'); sg.addColorStop(1, '#edc14b')
    ctx.fillStyle = sg
    ctx.beginPath(); ctx.arc(360, 212, 146 * sb, 0, TAU); ctx.fill()

    // waterline
    ctx.fillStyle = 'rgba(120,180,220,0.35)'
    ctx.fillRect(0, 392, W, 16)
    ctx.save()
    ctx.setLineDash([16, 12]); ctx.lineDashOffset = -t * 20
    ctx.strokeStyle = 'rgba(70,130,180,0.5)'; ctx.lineWidth = 3
    ctx.beginPath(); ctx.moveTo(0, 396)
    ctx.bezierCurveTo(90, 388, 180, 402, 280, 394)
    ctx.bezierCurveTo(380, 386, 470, 402, 560, 394)
    ctx.stroke()
    ctx.restore()
    ctx.fillStyle = 'rgba(30,60,90,0.16)'
    ctx.beginPath(); ctx.ellipse(290, 404, 185, 12, 0, 0, TAU); ctx.fill()

    // ═ water ribbons flowing off the shell ═
    const ribs = [[s.P.rib1, 0], [s.P.rib2, 1], [s.P.rib3, 2]]
    const rg = vGrad(ctx, 0, 400, 710, [[0, '#a9d7f2'], [1, '#5d9fd4']])
    for (const [path, i] of ribs) {
      ctx.save()
      ctx.translate(0, 0)
      const sway = Math.sin(t * 0.7 + i * 1.8) * 0.012
      ctx.translate(280, 400); ctx.rotate(sway); ctx.translate(-280, -400)
      ctx.fillStyle = rg
      ctx.strokeStyle = '#1d3a52'; ctx.lineWidth = 7; ctx.lineJoin = 'round'
      ctx.fill(path); ctx.stroke(path)
      // flow lines racing down
      ctx.save()
      ctx.clip(path)
      ctx.setLineDash([26, 36]); ctx.lineDashOffset = -t * (70 + i * 16)
      ctx.strokeStyle = 'rgba(245,252,255,0.9)'; ctx.lineWidth = 3.4; ctx.lineCap = 'round'
      const xs = [[150, 176], [270, 300], [382, 402]][i]
      for (const fx of xs) {
        ctx.beginPath()
        ctx.moveTo(fx, 400)
        ctx.bezierCurveTo(fx - 22, 470, fx + 20, 540, fx - 12, 600)
        ctx.bezierCurveTo(fx - 20, 640, fx - 4, 670, fx - 10, 705)
        ctx.stroke()
      }
      ctx.restore()
      ctx.restore()
    }
    // splash particles at the ribbon mouths
    const mouths = [[138, 700], [279, 702], [411, 700]]
    for (const sp of s.splashes) {
      sp.life += dt * 0.9
      if (sp.life > 1) { sp.life = 0; sp.vx = (Math.random() - 0.5) * 34; sp.vy = -24 - Math.random() * 40 }
      const [mx, my] = mouths[sp.rib]
      const q = sp.life
      ctx.fillStyle = `rgba(235,248,255,${(0.7 * (1 - q)).toFixed(3)})`
      ctx.beginPath()
      ctx.arc(mx + sp.vx * q, my + sp.vy * q + 60 * q * q, 2.6 * (1 - q * 0.5), 0, TAU)
      ctx.fill()
    }
    // community glow dots where the water arrives
    for (const [i, [mx, my]] of mouths.entries()) {
      const pu = 0.75 + 0.25 * Math.sin(t * 2 + i)
      ctx.fillStyle = '#f0c64f'; ctx.strokeStyle = '#17301f'; ctx.lineWidth = 3.4
      ctx.beginPath(); ctx.arc(mx, my + 6, 10, 0, TAU); ctx.fill(); ctx.stroke()
      ctx.strokeStyle = `rgba(240,198,79,${(0.6 * pu).toFixed(3)})`
      ctx.lineWidth = 2
      const rq = ((t + i * 0.5) % 2.4) / 2.4
      ctx.beginPath(); ctx.arc(mx, my + 6, 10 + rq * 22, 0, TAU); ctx.stroke()
    }

    // floating stones + sparkles in the water
    for (const [i, [px2, py2, ps]] of [[96, 500, 1], [226, 548, 0.8], [346, 500, 0.9], [466, 560, 1.05], [210, 652, 0.7]].entries()) {
      const bob = Math.sin(t * 0.9 + i * 1.3) * 6
      ctx.save(); ctx.translate(px2, py2 + bob); ctx.rotate(Math.sin(t * 0.7 + i) * 0.05)
      ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.strokeStyle = '#2a4a63'; ctx.lineWidth = 4.5; ctx.lineJoin = 'round'
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(34 * ps, 8 * ps); ctx.lineTo(12 * ps, 30 * ps); ctx.closePath()
      ctx.fill(); ctx.stroke()
      ctx.restore()
    }
    for (const [i, [px2, py2]] of [[130, 470], [320, 640], [440, 480]].entries()) {
      const q = (Math.sin(t * 1.6 + i * 2.1) + 1) / 2
      ctx.save(); ctx.translate(px2, py2); ctx.rotate(q * 0.8); ctx.globalAlpha = 0.2 + q * 0.75
      const r = 5 + q * 5
      ctx.fillStyle = '#fff'
      ctx.beginPath()
      ctx.moveTo(0, -r); ctx.lineTo(r * 0.28, -r * 0.28); ctx.lineTo(r, 0); ctx.lineTo(r * 0.28, r * 0.28)
      ctx.lineTo(0, r); ctx.lineTo(-r * 0.28, r * 0.28); ctx.lineTo(-r, 0); ctx.lineTo(-r * 0.28, -r * 0.28)
      ctx.closePath(); ctx.fill()
      ctx.restore()
    }

    // ═ the turtle, bobbing gently ═
    ctx.save()
    ctx.translate(0, Math.sin(t * 0.9) * 8)
    ctx.lineJoin = 'round'

    const stroke = (path, fill, lw = 7) => {
      ctx.fillStyle = fill; ctx.strokeStyle = '#17301f'; ctx.lineWidth = lw
      ctx.fill(path); ctx.stroke(path)
    }
    stroke(s.P.tail, '#5da35f')
    stroke(s.P.neck, '#5da35f', 8)
    stroke(s.P.head, '#6bb06a', 8)
    // face
    ctx.strokeStyle = '#2c5137'; ctx.lineWidth = 4; ctx.lineCap = 'round'
    ctx.beginPath(); ctx.moveTo(118, 268); ctx.quadraticCurveTo(133, 262, 148, 262)
    ctx.moveTo(108, 288); ctx.quadraticCurveTo(128, 278, 148, 280); ctx.stroke()
    ctx.fillStyle = '#122417'; ctx.beginPath(); ctx.arc(88, 230, 7.5, 0, TAU); ctx.fill()
    ctx.fillStyle = '#e9f5da'; ctx.beginPath(); ctx.arc(90.5, 227.5, 2.6, 0, TAU); ctx.fill()
    // blink
    const bl = (t % 6.5) / 6.5
    if (bl > 0.93 && bl < 0.97) {
      ctx.fillStyle = '#6bb06a'
      ctx.beginPath(); ctx.roundRect(78, 221, 21, 18, 9); ctx.fill()
    }
    ctx.strokeStyle = '#17301f'; ctx.lineWidth = 3.5
    ctx.beginPath(); ctx.moveTo(74, 216); ctx.quadraticCurveTo(88, 208, 102, 213); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(64, 246); ctx.quadraticCurveTo(78, 254, 92, 252); ctx.stroke()

    // legs paddling subtly
    for (const [path, ph] of [[s.P.legA, 0], [s.P.legB, Math.PI]]) {
      ctx.save()
      ctx.translate(0, Math.sin(t * 1.6 + ph) * 3)
      stroke(path, '#5da35f')
      ctx.restore()
    }

    // shell
    const shellG = vGrad(ctx, 0, 200, 400, [[0, '#8fc06f'], [0.5, '#5a9c58'], [1, '#37704a']])
    ctx.fillStyle = shellG; ctx.strokeStyle = '#17301f'; ctx.lineWidth = 9
    ctx.fill(s.P.shell); ctx.stroke(s.P.shell)
    ctx.fillStyle = 'rgba(217,192,121,0.75)'
    ctx.fill(s.P.shine)

    // shell water-bands with flowing dashes
    ctx.save()
    ctx.lineCap = 'round'
    const bands = [
      ['M150 330 C210 292 296 280 362 300 C406 312 436 332 450 350', 15],
      ['M176 270 C232 236 318 228 384 250', 12],
      ['M212 226 C258 206 316 202 356 214', 9],
    ]
    for (const [i, [d, wd]] of bands.entries()) {
      const path = new Path2D(d)
      ctx.strokeStyle = '#8fcae8'; ctx.lineWidth = wd; ctx.globalAlpha = 0.85
      ctx.stroke(path)
      ctx.globalAlpha = 1
      ctx.setLineDash([20, 30]); ctx.lineDashOffset = -t * (36 + i * 10)
      ctx.strokeStyle = 'rgba(240,250,255,0.9)'; ctx.lineWidth = 3
      ctx.stroke(path)
      ctx.setLineDash([])
    }
    ctx.restore()

    // plastron edge + scute ticks
    ctx.strokeStyle = '#17301f'; ctx.lineWidth = 6; ctx.lineCap = 'round'
    ctx.beginPath(); ctx.moveTo(134, 356); ctx.lineTo(456, 356); ctx.stroke()
    ctx.lineWidth = 5
    for (const x of [158, 196, 234, 272, 310, 348, 386, 424]) {
      ctx.beginPath(); ctx.moveTo(x, 358); ctx.lineTo(x + 6, 392); ctx.stroke()
    }
    ctx.fillStyle = 'rgba(200,230,165,0.85)'
    for (const x of [148, 186, 224, 262, 300, 338, 376, 414, 446]) {
      ctx.beginPath(); ctx.arc(x, 375, 4.5, 0, TAU); ctx.fill()
    }

    // island on the shell — pines + lodge, swaying as one
    ctx.save()
    ctx.translate(300, 200); ctx.rotate(Math.sin(t * 0.8) * 0.02); ctx.translate(-300, -200)
    ctx.fillStyle = '#14231c'
    const pinePath = (x, y, w, h) => {
      ctx.beginPath()
      ctx.moveTo(x, y); ctx.lineTo(x, y - h)
      ctx.moveTo(x, y - h); ctx.lineTo(x - w, y - h * 0.35); ctx.lineTo(x + w, y - h * 0.35); ctx.closePath()
      ctx.moveTo(x, y - h * 1.22); ctx.lineTo(x - w * 0.8, y - h * 0.62); ctx.lineTo(x + w * 0.8, y - h * 0.62); ctx.closePath()
      ctx.moveTo(x, y - h * 1.4); ctx.lineTo(x - w * 0.6, y - h * 0.88); ctx.lineTo(x + w * 0.6, y - h * 0.88); ctx.closePath()
      ctx.fill()
    }
    pinePath(236, 198, 16, 40)
    pinePath(322, 196, 14, 34)
    pinePath(398, 204, 12, 26)
    // council-lodge poles
    ctx.strokeStyle = '#14231c'; ctx.lineWidth = 4.5; ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(282, 196); ctx.lineTo(282, 118)
    ctx.moveTo(268, 132); ctx.lineTo(296, 132)
    ctx.moveTo(272, 148); ctx.lineTo(292, 148)
    ctx.moveTo(276, 164); ctx.lineTo(288, 164)
    ctx.stroke()
    ctx.fillStyle = '#14231c'; ctx.beginPath(); ctx.arc(282, 112, 4, 0, TAU); ctx.fill()
    ctx.lineWidth = 4
    ctx.beginPath()
    ctx.moveTo(362, 200); ctx.lineTo(362, 140)
    ctx.moveTo(350, 152); ctx.lineTo(374, 152)
    ctx.moveTo(354, 168); ctx.lineTo(370, 168)
    ctx.stroke()
    ctx.beginPath(); ctx.arc(362, 135, 3.4, 0, TAU); ctx.fill()
    ctx.restore()

    ctx.restore() // end turtle bob
  },
}

// ───────────────────────────────────────────────────────────────────────────
// SCENE 5 · Twilight — aurora over the lake, the final invitation
// ───────────────────────────────────────────────────────────────────────────
export const nightScene = {
  setup({ rnd }) {
    return {
      stars: makeParticles(110, () => ({
        x: rnd() * VW, y: rnd() * VH * 0.62, r: rnd() < 0.16 ? 2 : 1.1,
        ph: rnd() * TAU, sp: 0.5 + rnd() * 1.4,
      })),
      shoot: { t: -3, x: 0, y: 0 },
      fireflies: makeParticles(14, () => ({ x: rnd() * VW, y: 700 + rnd() * 160, ph: rnd() * TAU, sp: 0.5 + rnd() * 0.5 })),
    }
  },
  draw(ctx, t, dt, s, env) {
    const WL = 620 // waterline
    ctx.fillStyle = vGrad(ctx, 0, 0, VH, [[0, '#030814'], [0.45, '#071527'], [0.75, '#0a1e33'], [1, '#04101f']])
    ctx.fillRect(0, 0, VW, VH)

    // stars
    for (const st of s.stars) {
      const a = 0.2 + 0.65 * Math.max(0, Math.sin(t * st.sp + st.ph))
      ctx.fillStyle = `rgba(219,234,254,${a.toFixed(3)})`
      ctx.beginPath(); ctx.arc(st.x, st.y, st.r, 0, TAU); ctx.fill()
    }
    // shooting star
    if (t - s.shoot.t > 7) { s.shoot = { t, x: 200 + Math.random() * 900, y: 60 + Math.random() * 160 } }
    const sq = (t - s.shoot.t) / 0.9
    if (sq < 1) {
      const sx = s.shoot.x + sq * 260, sy = s.shoot.y + sq * 120
      const tail = ctx.createLinearGradient(sx, sy, sx - 90, sy - 42)
      tail.addColorStop(0, `rgba(240,248,255,${(0.9 * (1 - sq)).toFixed(3)})`)
      tail.addColorStop(1, 'rgba(240,248,255,0)')
      ctx.strokeStyle = tail; ctx.lineWidth = 2.4; ctx.lineCap = 'round'
      ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx - 90, sy - 42); ctx.stroke()
    }

    // ═ aurora — flowing curtains (overlapping soft strips, two passes) ═
    ctx.save(); ctx.globalCompositeOperation = 'lighter'
    const cols = ['52,211,153', '96,165,250', '167,139,250']
    for (let band = 0; band < 3; band++) {
      const bx0 = 40 + band * 440
      for (let x = 0; x < 640; x += 11) {
        const wob = Math.sin(x * 0.011 + t * (0.5 + band * 0.14) + band * 2.4)
        const wob2 = Math.sin(x * 0.028 - t * 0.7 + band)
        const topY = 26 + wob * 34 + band * 14
        const h = 240 + wob2 * 80 + Math.sin(t * 0.4 + band) * 32
        const a = 0.10 + 0.06 * (1 + wob2) * (0.7 + 0.3 * Math.sin(t * 0.8 + x * 0.02))
        const g = ctx.createLinearGradient(0, topY, 0, topY + h)
        g.addColorStop(0, `rgba(${cols[band]},${a.toFixed(3)})`)
        g.addColorStop(0.55, `rgba(${cols[band]},${(a * 0.45).toFixed(3)})`)
        g.addColorStop(1, `rgba(${cols[band]},0)`)
        ctx.fillStyle = g
        const px2 = bx0 + x + Math.sin(t * 0.24 + band * 2) * 52
        ctx.fillRect(px2, topY, 24, h)
      }
      // bright lower fringe of the curtain
      ctx.strokeStyle = `rgba(${cols[band]},0.14)`
      ctx.lineWidth = 7; ctx.lineCap = 'round'
      ctx.beginPath()
      for (let x = 0; x < 640; x += 26) {
        const wob = Math.sin(x * 0.011 + t * (0.5 + band * 0.14) + band * 2.4)
        const px2 = bx0 + x + Math.sin(t * 0.24 + band * 2) * 52
        const fy = 26 + wob * 34 + band * 14 + 200 + Math.sin(x * 0.03 - t * 0.7 + band) * 62
        if (x === 0) ctx.moveTo(px2, fy); else ctx.lineTo(px2, fy)
      }
      ctx.stroke()
    }
    ctx.restore()

    // moon
    const mg = ctx.createRadialGradient(1236, 130, 4, 1240, 134, 40)
    mg.addColorStop(0, '#fdfbf3'); mg.addColorStop(0.68, '#e5dfc8'); mg.addColorStop(1, '#cfc7a8')
    ctx.save()
    glow(ctx, 1240, 134, 90, 'rgba(240,235,200,0.28)', 'rgba(240,235,200,0)')
    ctx.fillStyle = mg
    ctx.beginPath(); ctx.arc(1240, 134, 37, 0, TAU); ctx.fill()
    ctx.fillStyle = 'rgba(190,182,155,0.5)'
    ctx.beginPath(); ctx.arc(1228, 126, 6, 0, TAU); ctx.fill()
    ctx.beginPath(); ctx.arc(1250, 146, 4.4, 0, TAU); ctx.fill()
    ctx.beginPath(); ctx.arc(1244, 116, 3, 0, TAU); ctx.fill()
    ctx.restore()

    // ═ the water ═
    ctx.fillStyle = vGrad(ctx, 0, WL, VH, [[0, '#0a1c30'], [1, '#040d1a']])
    ctx.fillRect(0, WL, VW, VH - WL)
    // aurora + moon reflections
    ctx.save(); ctx.globalCompositeOperation = 'lighter'
    for (let i = 0; i < 18; i++) {
      const q = i / 18
      const y = WL + 8 + q * 220
      const wob = Math.sin(t * 1.8 + i) * (5 + i * 2)
      const a = (1 - q) * 0.12 * (0.7 + 0.3 * Math.sin(t * 2.4 + i))
      ctx.fillStyle = `rgba(230,224,190,${a.toFixed(3)})`
      ctx.beginPath(); ctx.ellipse(1240 + wob, y, 44 + i * 5, 3 + i * 0.2, 0, 0, TAU); ctx.fill()
      if (i % 3 === 0) {
        ctx.fillStyle = `rgba(80,200,160,${(a * 0.7).toFixed(3)})`
        ctx.beginPath(); ctx.ellipse(400 + wob * 1.4, y, 120 + i * 8, 3 + i * 0.3, 0, 0, TAU); ctx.fill()
      }
    }
    ctx.restore()
    // slow dark waves
    ctx.strokeStyle = 'rgba(150,190,225,0.10)'; ctx.lineWidth = 2; ctx.lineCap = 'round'
    for (let b = 0; b < 4; b++) {
      const yb = WL + 40 + b * 56
      const drift = (t * (6 + b * 2)) % 300
      ctx.beginPath()
      for (let x = -320; x < VW + 320; x += 160) {
        const px2 = x + drift
        const yy = yb + Math.sin(px2 * 0.02 + t + b) * 3
        ctx.moveTo(px2, yy); ctx.quadraticCurveTo(px2 + 46, yy - 4, px2 + 92, yy)
      }
      ctx.stroke()
    }

    // silhouette shorelines + pines
    ctx.fillStyle = '#02070f'
    ctx.beginPath(); ctx.moveTo(0, WL + 6)
    ctx.quadraticCurveTo(120, WL - 18, 300, WL + 4); ctx.lineTo(300, WL + 8); ctx.lineTo(0, WL + 10); ctx.closePath(); ctx.fill()
    const spine = (x, y, sc) => {
      ctx.beginPath()
      ctx.moveTo(x, y); ctx.lineTo(x - 8 * sc, y)
      ctx.lineTo(x, y - 40 * sc); ctx.lineTo(x + 8 * sc, y); ctx.closePath(); ctx.fill()
    }
    ctx.fillStyle = '#02070f'
    for (const [px2, ps] of [[40, 1.2], [86, 0.9], [130, 1.35], [180, 0.8], [232, 1.05]]) spine(px2, WL + 4, ps)
    ctx.beginPath(); ctx.moveTo(VW, WL + 6)
    ctx.quadraticCurveTo(VW - 90, WL - 12, VW - 220, WL + 4); ctx.lineTo(VW, WL + 10); ctx.closePath(); ctx.fill()
    for (const [px2, ps] of [[VW - 40, 1.1], [VW - 92, 1.4], [VW - 150, 0.85]]) spine(px2, WL + 4, ps)

    // canoe silhouette crossing the moonpath
    const cx = ((t * 26) % (VW + 400)) - 200
    const cb = Math.sin(t * 1.2) * 3
    ctx.save(); ctx.translate(cx, WL + 130 + cb); ctx.rotate(Math.sin(t * 1.2) * 0.02)
    ctx.fillStyle = '#0a1522'
    ctx.beginPath()
    ctx.moveTo(-56, 0); ctx.quadraticCurveTo(0, 16, 56, 0)
    ctx.lineTo(48, 8); ctx.quadraticCurveTo(0, 22, -48, 8); ctx.closePath(); ctx.fill()
    ctx.beginPath(); ctx.arc(2, -12, 6, 0, TAU); ctx.fill()
    ctx.save(); ctx.translate(2, -6); ctx.rotate(Math.sin(t * 2.4) * 0.5)
    ctx.strokeStyle = '#0a1522'; ctx.lineWidth = 3.4; ctx.lineCap = 'round'
    ctx.beginPath(); ctx.moveTo(0, -4); ctx.lineTo(-14, 14); ctx.stroke()
    ctx.restore()
    // wake
    ctx.strokeStyle = 'rgba(190,215,240,0.14)'; ctx.lineWidth = 1.6
    ctx.beginPath(); ctx.moveTo(-58, 8); ctx.quadraticCurveTo(-96, 12, -140, 9); ctx.stroke()
    ctx.restore()

    // fireflies along the shore
    ctx.save(); ctx.globalCompositeOperation = 'lighter'
    for (const f of s.fireflies) {
      f.ph += dt * f.sp
      const a = 0.25 + 0.6 * Math.max(0, Math.sin(f.ph * 2))
      glow(ctx, f.x + Math.cos(f.ph) * 24, f.y + Math.sin(f.ph * 1.3) * 14, 5, `rgba(255,233,160,${a.toFixed(3)})`, 'rgba(255,233,160,0)')
    }
    ctx.restore()

    // mist over the water
    ctx.save()
    for (let i = 0; i < 3; i++) {
      const mx = ((t * (5 + i * 3)) % (VW + 700)) - 350
      ctx.fillStyle = `rgba(160,190,215,${0.05 + i * 0.012})`
      ctx.beginPath(); ctx.ellipse(mx, WL + 40 + i * 30, 260, 17, 0, 0, TAU); ctx.fill()
    }
    ctx.restore()

    void env
  },
}
