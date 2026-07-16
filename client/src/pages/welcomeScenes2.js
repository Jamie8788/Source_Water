/**
 * welcomeScenes2 — Canvas2D scenes 3–5: the Great Lakes data network,
 * Turtle Island (community), and the twilight aurora finale.
 */
import { VW, VH, vGrad, glow, makeParticles, lerp, clamp } from './welcomeEngine'

const TAU = Math.PI * 2

// ───────────────────────────────────────────────────────────────────────────
// SCENE 3 · The data network — the lakes become a living constellation
// ───────────────────────────────────────────────────────────────────────────
// The five lakes, authored in a 900×560 space (drawn scaled+centred).
const LAKE_PATHS = [
  'M95 178 C110 132 190 92 292 78 C372 68 442 88 470 118 C498 146 486 170 448 178 C398 188 348 176 306 190 C252 208 168 214 122 200 C100 192 88 186 95 178 Z',
  'M298 238 C284 232 274 250 272 288 C270 334 274 394 288 430 C296 452 316 458 326 438 C338 412 334 350 328 302 C324 268 314 246 298 238 Z',
  'M388 240 C420 204 468 192 504 206 C518 180 556 170 582 186 C606 202 598 232 576 244 C586 274 576 308 548 328 C512 352 458 344 434 312 C416 288 400 264 388 240 Z',
  'M528 392 C566 366 644 352 702 362 C730 368 736 384 712 396 C666 418 590 424 548 412 C526 406 518 398 528 392 Z',
  'M706 302 C734 282 792 274 832 286 C858 294 858 310 832 320 C792 332 734 328 710 316 C698 310 698 307 706 302 Z',
]
const LAND_PATH = 'M40 60 C220 12 560 6 760 46 C860 66 890 140 878 240 C868 330 880 420 830 480 C740 540 520 552 340 540 C200 530 90 500 58 420 C30 340 26 220 40 60 Z'

const SITES = [
  [180, 150], [265, 112], [350, 140], [425, 152], [230, 168], [312, 96],
  [296, 300], [306, 392], [318, 344],
  [452, 262], [512, 236], [566, 206], [488, 300], [532, 296],
  [590, 392], [664, 380], [624, 398],
  [742, 300], [808, 292], [776, 312],
]
const LABELS = [
  ['Superior', 230, 146, 21], ['Huron', 448, 286, 17], ['Erie', 596, 390, 15], ['Ontario', 746, 306, 14],
]

export const networkScene = {
  setup({ rnd }) {
    return {
      par: { x: 0, y: 0 },
      paths: LAKE_PATHS.map(d => new Path2D(d)),
      land: new Path2D(LAND_PATH),
      links: [], linkT: 0,
      stars: makeParticles(70, () => ({ x: rnd() * VW, y: rnd() * VH, r: 0.7 + rnd() * 1.3, ph: rnd() * TAU, sp: 0.5 + rnd() })),
      readT: 0, read: null,
    }
  },
  draw(ctx, t, dt, s, env) {
    const p = env.pointer
    const tx = p.inside ? clamp((p.x - VW / 2) / (VW / 2), -1, 1) : 0
    const ty = p.inside ? clamp((p.y - VH / 2) / (VH / 2), -1, 1) : 0
    s.par.x = lerp(s.par.x, tx, Math.min(1, dt * 2.5))
    s.par.y = lerp(s.par.y, ty, Math.min(1, dt * 2.5))

    // deep-night backdrop with a faint drifting star field
    const bg = ctx.createRadialGradient(VW / 2, VH * 0.2, 60, VW / 2, VH * 0.45, VH)
    bg.addColorStop(0, '#123458'); bg.addColorStop(0.55, '#0a1e35'); bg.addColorStop(1, '#050f1e')
    ctx.fillStyle = bg; ctx.fillRect(0, 0, VW, VH)
    for (const st of s.stars) {
      const a = 0.12 + 0.24 * Math.max(0, Math.sin(t * st.sp + st.ph))
      ctx.fillStyle = `rgba(190,220,250,${a.toFixed(3)})`
      ctx.beginPath(); ctx.arc(st.x, st.y, st.r, 0, TAU); ctx.fill()
    }

    // map transform: 900×560 authored space → centred, slightly tilted by pointer
    const SC = 1.32
    const ox = (VW - 900 * SC) / 2 - s.par.x * 20
    const oy = (VH - 560 * SC) / 2 - s.par.y * 14
    ctx.save()
    ctx.translate(ox, oy); ctx.scale(SC, SC)

    // land
    ctx.fillStyle = 'rgba(13,34,56,0.9)'
    ctx.fill(s.land)
    ctx.strokeStyle = 'rgba(70,130,180,0.18)'; ctx.lineWidth = 1.4
    ctx.stroke(s.land)

    // lakes — breathing glow water
    const lg = ctx.createLinearGradient(0, 0, 900, 560)
    lg.addColorStop(0, '#3d8bc4'); lg.addColorStop(1, '#1c5586')
    for (const [i, path] of s.paths.entries()) {
      ctx.save()
      ctx.shadowColor = 'rgba(70,170,230,0.55)'
      ctx.shadowBlur = 18 + Math.sin(t * 0.9 + i) * 7
      ctx.fillStyle = lg
      ctx.globalAlpha = 0.92 + Math.sin(t * 0.9 + i) * 0.07
      ctx.fill(path)
      ctx.restore()
      ctx.strokeStyle = 'rgba(150,220,255,0.35)'
      ctx.lineWidth = 1.6
      ctx.stroke(path)
    }
    // flowing current hints inside the lakes
    ctx.save()
    ctx.setLineDash([10, 26]); ctx.lineDashOffset = -t * 26
    ctx.strokeStyle = 'rgba(180,225,255,0.4)'; ctx.lineWidth = 2.2; ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(140, 168); ctx.bezierCurveTo(220, 138, 330, 122, 430, 140)
    ctx.moveTo(286, 290); ctx.bezierCurveTo(290, 330, 292, 380, 302, 416)
    ctx.moveTo(420, 272); ctx.bezierCurveTo(460, 250, 520, 240, 560, 250)
    ctx.moveTo(552, 398); ctx.bezierCurveTo(610, 382, 668, 376, 700, 380)
    ctx.moveTo(718, 306); ctx.bezierCurveTo(760, 296, 800, 296, 824, 302)
    ctx.stroke()
    ctx.restore()

    // connective rivers
    ctx.save()
    ctx.setLineDash([8, 12]); ctx.lineDashOffset = -t * 40
    ctx.strokeStyle = 'rgba(94,234,212,0.75)'; ctx.lineWidth = 3; ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(462, 160); ctx.bezierCurveTo(486, 178, 498, 196, 500, 216)
    ctx.moveTo(540, 330); ctx.bezierCurveTo(548, 352, 546, 372, 552, 394)
    ctx.moveTo(710, 388); ctx.bezierCurveTo(726, 372, 726, 340, 716, 320)
    ctx.stroke()
    ctx.restore()

    // ── network links: arcs light up between random pairs of sites ──
    s.linkT += dt
    if (s.linkT > 0.9) {
      s.linkT = 0
      const a = SITES[(Math.random() * SITES.length) | 0]
      let b = SITES[(Math.random() * SITES.length) | 0]
      if (b === a) b = SITES[(SITES.indexOf(a) + 5) % SITES.length]
      s.links.push({ a, b, life: 0 })
      if (s.links.length > 7) s.links.shift()
    }
    for (const L of s.links) {
      L.life += dt
      const q = clamp(L.life / 2.6, 0, 1)
      const fade = q < 0.2 ? q / 0.2 : q > 0.75 ? (1 - q) / 0.25 : 1
      const mx = (L.a[0] + L.b[0]) / 2, my = (L.a[1] + L.b[1]) / 2 - 70
      ctx.strokeStyle = `rgba(94,234,212,${(0.4 * fade).toFixed(3)})`
      ctx.lineWidth = 1.6
      ctx.beginPath(); ctx.moveTo(L.a[0], L.a[1]); ctx.quadraticCurveTo(mx, my, L.b[0], L.b[1]); ctx.stroke()
      // packet
      const pq = clamp(q * 1.5, 0, 1)
      const px2 = lerp(lerp(L.a[0], mx, pq), lerp(mx, L.b[0], pq), pq)
      const py2 = lerp(lerp(L.a[1], my, pq), lerp(my, L.b[1], pq), pq)
      ctx.fillStyle = `rgba(160,245,228,${fade.toFixed(3)})`
      ctx.beginPath(); ctx.arc(px2, py2, 3, 0, TAU); ctx.fill()
      glow(ctx, px2, py2, 10, `rgba(94,234,212,${(0.5 * fade).toFixed(3)})`, 'rgba(94,234,212,0)')
    }

    // monitoring sites — pulsing beacons
    for (const [i, [sx2, sy2]] of SITES.entries()) {
      const pu = 0.7 + 0.3 * Math.sin(t * 2 + i * 0.7)
      ctx.fillStyle = `rgba(94,234,212,${pu.toFixed(3)})`
      ctx.beginPath(); ctx.arc(sx2, sy2, 4, 0, TAU); ctx.fill()
      const ringQ = ((t + i * 0.31) % 2.8) / 2.8
      ctx.strokeStyle = `rgba(94,234,212,${(0.55 * (1 - ringQ)).toFixed(3)})`
      ctx.lineWidth = 1.8
      ctx.beginPath(); ctx.arc(sx2, sy2, 4 + ringQ * 22, 0, TAU); ctx.stroke()
    }

    // Baawaating star marker
    glow(ctx, 470, 138, 22, 'rgba(255,214,110,0.7)', 'rgba(255,214,110,0)')
    ctx.fillStyle = '#ffd66e'
    ctx.beginPath(); ctx.arc(470, 138, 4.4, 0, TAU); ctx.fill()
    ctx.font = '700 12px "DM Sans", system-ui, sans-serif'
    ctx.fillStyle = '#ffe4a0'
    ctx.fillText('Baawaating', 452, 122)

    // lake labels
    ctx.fillStyle = '#9fc6e8'
    for (const [name, lx, ly, size] of LABELS) {
      ctx.font = `italic ${size}px Georgia, serif`
      ctx.fillText(name, lx, ly)
    }
    ctx.save()
    ctx.translate(316, 330); ctx.rotate(Math.PI * 0.44)
    ctx.font = 'italic 14px Georgia, serif'
    ctx.fillText('Michigan', 0, 0)
    ctx.restore()

    // occasional live reading chip near a random site
    s.readT += dt
    if (s.readT > 3.4) {
      s.readT = 0
      const site = SITES[(Math.random() * SITES.length) | 0]
      const vals = ['pH 7.6', 'DO 8.9 mg/L', '11.8 °C', 'clarity 3.4 m', 'pH 8.1', '17.2 °C']
      s.read = { x: site[0], y: site[1], txt: vals[(Math.random() * vals.length) | 0], life: 0 }
    }
    if (s.read) {
      s.read.life += dt
      const a = s.read.life < 0.3 ? s.read.life / 0.3 : Math.max(0, 1 - (s.read.life - 2) / 1)
      if (a > 0) {
        ctx.font = '700 13px "DM Sans", system-ui, sans-serif'
        const w = ctx.measureText(s.read.txt).width + 20
        ctx.fillStyle = `rgba(8,24,38,${(0.8 * a).toFixed(3)})`
        ctx.strokeStyle = `rgba(94,234,212,${(0.5 * a).toFixed(3)})`
        ctx.beginPath(); ctx.roundRect(s.read.x + 10, s.read.y - 34, w, 24, 7); ctx.fill(); ctx.stroke()
        ctx.fillStyle = `rgba(170,242,228,${a.toFixed(3)})`
        ctx.fillText(s.read.txt, s.read.x + 20, s.read.y - 17)
      }
    }
    ctx.restore()
  },
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
