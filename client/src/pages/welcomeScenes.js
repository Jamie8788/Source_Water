/**
 * welcomeScenes — Canvas2D scene: beneath the surface of a Great Lake.
 * Freshwater fish, swaying plants, a sensor station publishing live
 * readings, drifting particles and light shafts. The shoreline hero
 * lives in welcomeShore.js.
 */
import { VW, VH, vGrad, glow, makeParticles, lerp, clamp } from './welcomeEngine'

const TAU = Math.PI * 2

// ───────────────────────────────────────────────────────────────────────────
// SCENE 2 · Beneath the surface — freshwater world with live sensors
// ───────────────────────────────────────────────────────────────────────────
function fishShape(ctx, len, body, belly, wag) {
  // pointing +x, origin at centre
  ctx.fillStyle = body
  ctx.beginPath()
  ctx.moveTo(-len * 0.5, 0)
  ctx.quadraticCurveTo(-len * 0.1, -len * 0.24, len * 0.34, -len * 0.1)
  ctx.quadraticCurveTo(len * 0.5, -len * 0.03, len * 0.5, 0)
  ctx.quadraticCurveTo(len * 0.5, len * 0.03, len * 0.34, len * 0.1)
  ctx.quadraticCurveTo(-len * 0.1, len * 0.24, -len * 0.5, 0)
  ctx.closePath(); ctx.fill()
  if (belly) {
    ctx.fillStyle = belly
    ctx.beginPath()
    ctx.moveTo(-len * 0.42, 2)
    ctx.quadraticCurveTo(0, len * 0.2, len * 0.3, len * 0.08)
    ctx.quadraticCurveTo(0, len * 0.13, -len * 0.42, 2)
    ctx.fill()
  }
  // tail
  ctx.fillStyle = body
  ctx.beginPath()
  ctx.moveTo(-len * 0.48, 0)
  ctx.lineTo(-len * 0.68, wag - len * 0.14)
  ctx.lineTo(-len * 0.62, wag)
  ctx.lineTo(-len * 0.68, wag + len * 0.14)
  ctx.closePath(); ctx.fill()
}

const READINGS = ['pH 7.8', 'DO 9.2 mg/L', '12.4 °C', 'clarity 4.1 m', 'NTU 3.2']

// ── equipment / story discoveries resting on the lakebed ──────────────────
// Each is a real Water Rangers tool; click (or light it with the ROV) to learn.
const DISCOVERIES = [
  {
    x: 250, y: 782, kind: 'bucket', title: 'THROW BUCKET & ROPE',
    lines: ['Tossed out on a rope to grab a sample from', 'deep or hard-to-reach water. Rinse it three', 'times in the lake before you keep a sample.'],
  },
  {
    x: 470, y: 792, kind: 'meter', title: 'CONDUCTIVITY METER',
    lines: ['Measures how well the water conducts', 'electricity (µS/cm), plus TDS and temp.', 'A winter spike usually means road salt.'],
  },
  {
    x: 690, y: 800, kind: 'strips', title: 'CHLORIDE TEST STRIPS',
    lines: ['Dip to the line, wait 3–5 minutes, then', 'compare the white line to the bottle chart', 'to read chloride in mg/L.'],
  },
  {
    x: 900, y: 806, kind: 'reacher', title: 'REACHER STICK',
    lines: ['Clips a sample cup to a pole so you can', 'reach water safely from a dock or bank —', 'no need to climb down to the edge.'],
  },
  {
    x: 1180, y: 770, kind: 'sensor', title: 'CONTINUOUS LOGGER',
    lines: ['Anchored to the bed, it records temperature,', 'conductivity and dissolved oxygen every', '15 minutes — published as open data.'],
  },
  {
    x: 96, y: 566, kind: 'outfall', title: 'ROAD-SALT OUTFALL',
    lines: ['Winter runoff carries chloride from salted', 'roads straight into the lake. It stresses', 'fish and insects, and lingers for years.'],
  },
  {
    x: 1420, y: 812, kind: 'reef', title: 'DRIFTWOOD REEF',
    lines: ['Sunken wood is prime habitat —', 'smallmouth bass nest here every June.'],
  },
]

function drawTool(ctx, d, t, lit) {
  ctx.save(); ctx.translate(d.x, d.y)
  const a = lit ? 1 : 0.9
  ctx.globalAlpha = a
  if (d.kind === 'bucket') {
    ctx.strokeStyle = 'rgba(232,220,190,0.8)'; ctx.lineWidth = 1.6
    ctx.beginPath(); ctx.moveTo(0, -30); ctx.quadraticCurveTo(-6, -14, -8, 0); ctx.stroke()
    ctx.fillStyle = '#c9d0d6'; ctx.strokeStyle = '#5b6770'; ctx.lineWidth = 1.6
    ctx.beginPath(); ctx.moveTo(-11, -6); ctx.lineTo(11, -6); ctx.lineTo(8, 12); ctx.lineTo(-8, 12); ctx.closePath(); ctx.fill(); ctx.stroke()
    ctx.beginPath(); ctx.ellipse(0, -6, 11, 3.4, 0, 0, Math.PI * 2); ctx.stroke()
  } else if (d.kind === 'meter') {
    ctx.fillStyle = '#3a4650'; ctx.beginPath(); ctx.roundRect(-9, -20, 18, 26, 3); ctx.fill()
    ctx.fillStyle = '#8fd6c4'; ctx.fillRect(-6, -16, 12, 8)
    ctx.fillStyle = '#20262c'; ctx.fillRect(-2, 6, 4, 12)
    const blink = (t % 1.5) < 0.7
    ctx.fillStyle = blink ? '#7df5df' : '#2b6b60'
    ctx.beginPath(); ctx.arc(6, -18, 1.8, 0, Math.PI * 2); ctx.fill()
  } else if (d.kind === 'strips') {
    ctx.fillStyle = '#e8ecef'; ctx.beginPath(); ctx.roundRect(-7, -18, 14, 22, 3); ctx.fill()
    ctx.fillStyle = '#c94a6a'; ctx.fillRect(-7, -18, 14, 5)
    for (let i = 0; i < 3; i++) { ctx.fillStyle = '#f2f4f0'; ctx.fillRect(10 + i * 4, -14 + i * 3, 2.4, 14) }
    ctx.fillStyle = ['#d8d4c8', '#b0a06a', '#6a5a86'][((t / 2) | 0) % 3]
    ctx.fillRect(10, -14, 2.4, 3.4)
  } else if (d.kind === 'reacher') {
    ctx.strokeStyle = '#b8b4ac'; ctx.lineWidth = 3
    ctx.beginPath(); ctx.moveTo(-24, 8); ctx.lineTo(22, -20); ctx.stroke()
    ctx.fillStyle = 'rgba(214,238,248,0.85)'; ctx.strokeStyle = '#8fb0c0'; ctx.lineWidth = 1.4
    ctx.beginPath(); ctx.moveTo(20, -26); ctx.lineTo(30, -26); ctx.lineTo(28, -16); ctx.lineTo(22, -16); ctx.closePath(); ctx.fill(); ctx.stroke()
  } else if (d.kind === 'sensor') {
    ctx.strokeStyle = '#5a6a72'; ctx.lineWidth = 3
    ctx.strokeRect(-24, -14, 48, 44)
    ctx.beginPath(); ctx.moveTo(-24, -14); ctx.lineTo(0, -32); ctx.lineTo(24, -14); ctx.stroke()
    ctx.fillStyle = '#48565e'; ctx.fillRect(-16, -2, 32, 24)
    const blink = (t % 1.8) < 0.24
    ctx.fillStyle = blink ? '#7df5df' : '#256156'
    ctx.beginPath(); ctx.arc(0, -24, 3.4, 0, Math.PI * 2); ctx.fill()
  } else if (d.kind === 'outfall') {
    ctx.fillStyle = '#46525a'; ctx.beginPath(); ctx.roundRect(-116, -18, 100, 38, 6); ctx.fill()
    ctx.fillStyle = '#1c2429'; ctx.beginPath(); ctx.ellipse(-16, 1, 5, 14, 0, 0, Math.PI * 2); ctx.fill()
  } else if (d.kind === 'reef') {
    ctx.strokeStyle = '#3a4a44'; ctx.lineWidth = 10; ctx.lineCap = 'round'
    ctx.beginPath(); ctx.moveTo(-40, 8); ctx.quadraticCurveTo(20, -18, 60, 0); ctx.stroke()
    ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(0, -6); ctx.lineTo(24, -26); ctx.stroke()
  }
  ctx.restore()
}

export const underScene = {
  setup({ rnd }) {
    return {
      rov: { x: 800, y: 420, dir: 0, prop: 0 },
      motes: makeParticles(70, () => ({ x: rnd() * VW, y: rnd() * VH, v: 3 + rnd() * 8, r: 0.8 + rnd() * 1.8, ph: rnd() * TAU })),
      bubbles: makeParticles(14, () => ({ x: rnd() * VW, y: VH + rnd() * VH, v: 30 + rnd() * 40, r: 2 + rnd() * 4, wob: rnd() * TAU })),
      school: makeParticles(9, (i) => ({ off: i * 34, lane: (i % 3) - 1, ph: rnd() * TAU })),
      plume: makeParticles(16, () => ({ life: rnd() })),
      sel: null, selT: 0,
    }
  },
  draw(ctx, t, dt, s, env) {
    const p = env.pointer
    const rov = s.rov

    // ── water body (dark, murky) ──
    ctx.fillStyle = vGrad(ctx, 0, 0, VH, [[0, '#10527a'], [0.35, '#0b3a5c'], [0.7, '#072741'], [1, '#04182b']])
    ctx.fillRect(0, 0, VW, VH)

    // faint surface + shafts
    ctx.save(); ctx.globalCompositeOperation = 'lighter'
    for (let x = -60; x < VW + 60; x += 46) {
      const y = 30 + Math.sin(x * 0.02 + t * 1.6) * 9
      ctx.fillStyle = 'rgba(150,210,245,0.06)'
      ctx.beginPath(); ctx.ellipse(x, y, 32, 7, 0, 0, TAU); ctx.fill()
    }
    for (let i = 0; i < 4; i++) {
      const bx = 240 + i * 380 + Math.sin(t * 0.3 + i * 2) * 40
      const g = ctx.createLinearGradient(bx, 0, bx + 150, VH * 0.85)
      g.addColorStop(0, 'rgba(140,205,245,0.07)'); g.addColorStop(1, 'rgba(140,205,245,0)')
      ctx.fillStyle = g
      ctx.beginPath(); ctx.moveTo(bx, -10); ctx.lineTo(bx + 110, -10); ctx.lineTo(bx + 300, VH * 0.9); ctx.lineTo(bx + 80, VH * 0.9); ctx.closePath(); ctx.fill()
    }
    ctx.restore()

    // motes
    for (const m of s.motes) {
      m.y -= m.v * dt * 0.4; m.x += Math.sin(t * 0.6 + m.ph) * 6 * dt
      if (m.y < -6) { m.y = VH + 6; m.x = Math.random() * VW }
      ctx.fillStyle = `rgba(190,225,245,${(0.1 + 0.08 * Math.sin(t + m.ph)).toFixed(3)})`
      ctx.beginPath(); ctx.arc(m.x, m.y, m.r, 0, TAU); ctx.fill()
    }

    // ── lakebed ──
    ctx.fillStyle = vGrad(ctx, 0, 740, VH, [[0, '#254048'], [1, '#152730']])
    ctx.beginPath(); ctx.moveTo(-40, VH); ctx.lineTo(-40, 812)
    ctx.bezierCurveTo(300, 784, 700, 822, 1000, 798)
    ctx.bezierCurveTo(1240, 780, 1460, 812, 1640, 796)
    ctx.lineTo(1640, VH); ctx.closePath(); ctx.fill()
    for (const [rx, ry, rw, rh] of [[160, 820, 44, 18], [560, 832, 30, 13], [1080, 816, 40, 16], [1330, 828, 56, 22]]) {
      ctx.fillStyle = '#2b444c'; ctx.beginPath(); ctx.ellipse(rx, ry, rw, rh, 0, 0, TAU); ctx.fill()
    }
    // plants
    for (let i = 0; i < 11; i++) {
      const bx = 60 + i * 150 + (i % 3) * 22
      const bh = 80 + (i % 4) * 44
      const sway = Math.sin(t * 1.1 + i * 1.1) * 15
      ctx.strokeStyle = i % 2 ? 'rgba(48,140,110,0.7)' : 'rgba(60,165,128,0.55)'
      ctx.lineWidth = 5 - (i % 3); ctx.lineCap = 'round'
      ctx.beginPath(); ctx.moveTo(bx, 832)
      ctx.bezierCurveTo(bx - 8, 832 - bh * 0.4, bx + sway * 0.5, 832 - bh * 0.7, bx + sway, 832 - bh)
      ctx.stroke()
    }

    // chloride plume from the outfall
    for (const pp of s.plume) {
      pp.life += dt * 0.16; if (pp.life > 1) pp.life -= 1
      const q = pp.life
      ctx.fillStyle = `rgba(196,214,206,${(0.16 * (1 - q)).toFixed(3)})`
      ctx.beginPath(); ctx.arc(84 + q * 240 + Math.sin(q * 9) * 14, 567 + q * 130 + Math.sin(q * 13) * 10, 4 + q * 15, 0, TAU); ctx.fill()
    }

    // sensor sonar ping (always subtly visible)
    const ping = (t % 3.2) / 3.2
    ctx.strokeStyle = `rgba(125,245,223,${(0.28 * (1 - ping)).toFixed(3)})`; ctx.lineWidth = 2
    ctx.beginPath(); ctx.arc(1180, 758, 12 + ping * 110, 0, TAU); ctx.stroke()

    // ── fish (kept below the top text band) ──
    const dir = Math.sin(t * 0.11) > 0 ? 1 : -1
    for (const f of s.school) {
      const fx = ((t * 80 * dir + f.off * dir) % (VW + 260) + (VW + 260)) % (VW + 260) - 130
      const fy = 500 + f.lane * 40 + Math.sin(fx * 0.012 + f.ph) * 24
      ctx.save(); ctx.translate(fx, fy); ctx.scale(dir, 1)
      fishShape(ctx, 34, 'rgba(168,205,228,0.7)', 'rgba(220,238,250,0.45)', Math.sin(t * 9 + f.ph) * 5)
      ctx.restore()
    }
    for (const [wx2, wy2, ph] of [[520, 720, 0], [640, 742, 2]]) {
      const drift2 = Math.sin(t * 0.4 + ph) * 28
      ctx.save(); ctx.translate(wx2 + drift2, wy2 + Math.sin(t * 0.8 + ph) * 5)
      ctx.scale(Math.cos(t * 0.4 + ph) > 0 ? 1 : -1, 1)
      fishShape(ctx, 60, '#7a8a5e', '#c9c39a', Math.sin(t * 5 + ph) * 5)
      ctx.fillStyle = '#20301c'; ctx.beginPath(); ctx.arc(22, -3, 2.2, 0, TAU); ctx.fill()
      ctx.restore()
    }
    const trx = VW - ((t * 40) % (VW + 360)) + 180
    ctx.save(); ctx.translate(trx, 600 + Math.sin(t * 1.1) * 14); ctx.scale(-1, 1)
    fishShape(ctx, 86, '#5e7484', '#aebfc9', Math.sin(t * 6) * 7)
    ctx.fillStyle = 'rgba(220,232,240,0.5)'
    for (let k = 0; k < 8; k++) { ctx.beginPath(); ctx.arc(-22 + (k % 4) * 13, -6 + ((k / 4) | 0) * 9, 1.5, 0, TAU); ctx.fill() }
    ctx.restore()

    // ── equipment on the bed (drawn dim; brightened by the ROV light later) ──
    for (const d of DISCOVERIES) drawTool(ctx, d, t, false)

    // ═══ ROV: follows the cursor; headlight reveals the murk ═══
    const target = p.inside
      ? { x: clamp(p.x, 40, VW - 40), y: clamp(p.y, 90, VH - 70) }
      : { x: 800 + Math.sin(t * 0.28) * 460, y: 400 + Math.sin(t * 0.42) * 150 }
    const vx = target.x - rov.x, vy = target.y - rov.y
    rov.x += vx * Math.min(1, dt * 2.6); rov.y += vy * Math.min(1, dt * 2.6)
    if (Math.hypot(vx, vy) > 6) rov.dir = Math.atan2(vy, vx * 0 + (Math.abs(vx) < 1 ? 1 : vx)) * 0 + (vx < 0 ? Math.PI : 0)
    rov.prop += dt * (6 + Math.min(30, Math.hypot(vx, vy) * 0.4))
    const face = rov.x < target.x ? 1 : (Math.abs(vx) < 20 ? (rov.face || 1) : -1)
    rov.face = face

    // dim the whole scene, then ADD the headlight (so the murk reveals near the ROV)
    ctx.save()
    ctx.fillStyle = 'rgba(3,12,24,0.5)'
    ctx.fillRect(-200, -200, VW + 400, VH + 400)
    ctx.globalCompositeOperation = 'lighter'
    // soft ambient pool around the ROV
    glow(ctx, rov.x, rov.y, 150, 'rgba(150,205,235,0.16)', 'rgba(150,205,235,0)')
    // headlight cone in facing direction
    ctx.save(); ctx.translate(rov.x, rov.y); ctx.scale(face, 1)
    const cone = ctx.createLinearGradient(0, 0, 340, 0)
    cone.addColorStop(0, 'rgba(190,225,250,0.30)'); cone.addColorStop(0.5, 'rgba(170,215,245,0.12)'); cone.addColorStop(1, 'rgba(170,215,245,0)')
    ctx.fillStyle = cone
    ctx.beginPath(); ctx.moveTo(14, -6); ctx.lineTo(340, -150); ctx.lineTo(340, 150); ctx.lineTo(14, 6); ctx.closePath(); ctx.fill()
    ctx.restore()
    ctx.restore()

    // re-draw any tool caught in the headlight at full brightness
    for (const d of DISCOVERIES) {
      const dx = d.x - rov.x
      const inCone = (face > 0 ? dx > -30 : dx < 30) && Math.abs(d.y - rov.y) < 200 && Math.abs(dx) < 360
      if (inCone || Math.hypot(d.x - rov.x, d.y - rov.y) < 150) drawTool(ctx, d, t, true)
    }

    // ROV body
    ctx.save(); ctx.translate(rov.x, rov.y); ctx.scale(face, 1)
    ctx.rotate(Math.sin(t * 1.5) * 0.03)
    ctx.fillStyle = 'rgba(6,18,30,0.4)'
    ctx.beginPath(); ctx.ellipse(0, 26, 34, 6, 0, 0, TAU); ctx.fill()
    // hull
    ctx.fillStyle = '#e0a63a'; ctx.strokeStyle = '#8a5a1c'; ctx.lineWidth = 2
    ctx.beginPath(); ctx.ellipse(0, 0, 30, 17, 0, 0, TAU); ctx.fill(); ctx.stroke()
    ctx.fillStyle = 'rgba(255,255,255,0.25)'
    ctx.beginPath(); ctx.ellipse(-6, -6, 16, 7, -0.3, 0, TAU); ctx.fill()
    // fin
    ctx.fillStyle = '#c98a2a'
    ctx.beginPath(); ctx.moveTo(-24, -4); ctx.lineTo(-38, -16); ctx.lineTo(-30, 2); ctx.closePath(); ctx.fill()
    // dome + pilot
    ctx.fillStyle = 'rgba(180,225,245,0.7)'; ctx.strokeStyle = '#8a5a1c'; ctx.lineWidth = 1.6
    ctx.beginPath(); ctx.arc(8, -4, 9, Math.PI * 1.05, Math.PI * 2.1); ctx.fill(); ctx.stroke()
    // headlamp housing + beam origin
    ctx.fillStyle = '#3a4650'; ctx.beginPath(); ctx.arc(26, 2, 5, 0, TAU); ctx.fill()
    ctx.fillStyle = '#eaf6ff'; ctx.beginPath(); ctx.arc(27, 2, 2.6, 0, TAU); ctx.fill()
    // thruster prop
    ctx.strokeStyle = '#8a5a1c'; ctx.lineWidth = 2
    ctx.save(); ctx.translate(-34, 6); ctx.rotate(rov.prop)
    for (let i = 0; i < 3; i++) { ctx.rotate(TAU / 3); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -7); ctx.stroke() }
    ctx.restore()
    ctx.restore()
    // ROV bubbles
    if (Math.random() < dt * 8) s.bubbles.push({ x: rov.x - 30 * face, y: rov.y + 4, v: 40, r: 1.4 + Math.random() * 2, wob: Math.random() * TAU })
    if (s.bubbles.length > 50) s.bubbles.splice(0, s.bubbles.length - 50)
    for (const b of s.bubbles) {
      b.y -= b.v * dt; b.x += Math.sin(t * 2 + b.wob) * 8 * dt
      if (b.y < 24) { b.y = VH + 10; b.x = Math.random() * VW }
      ctx.strokeStyle = 'rgba(210,240,255,0.35)'; ctx.lineWidth = 1.1
      ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, TAU); ctx.stroke()
    }

    // ── discovery markers + click handling ──
    if (p.click) {
      const c = p.click; p.click = null
      let hit = null
      for (const d of DISCOVERIES) if (Math.hypot(c.x - d.x, c.y - d.y) < 52) { hit = d; break }
      s.sel = hit && s.sel !== hit ? hit : null
      s.selT = 0
    }
    for (const d of DISCOVERIES) {
      const near = Math.hypot(d.x - rov.x, d.y - rov.y) < 160
      const pu = 0.55 + 0.45 * Math.sin(t * 2.4 + d.x)
      const active = s.sel === d
      ctx.strokeStyle = `rgba(125,245,223,${(active ? 0.95 : (near ? 0.7 : 0.4) * pu).toFixed(3)})`
      ctx.lineWidth = 2
      ctx.beginPath(); ctx.arc(d.x, d.y - 24, 11 + (active ? 2 : pu * 2), 0, TAU); ctx.stroke()
      ctx.fillStyle = `rgba(125,245,223,${active ? 1 : 0.8})`
      ctx.fillRect(d.x - 4, d.y - 25.2, 8, 2.2)
      if (!active) ctx.fillRect(d.x - 1.1, d.y - 28, 2.2, 8)
    }

    // ── info card for the selected discovery ──
    if (s.sel) {
      s.selT = Math.min(1, s.selT + dt * 4)
      const d = s.sel
      ctx.save(); ctx.globalAlpha = s.selT
      ctx.font = '600 19px "DM Sans", system-ui, sans-serif'
      let w = ctx.measureText(d.title).width
      for (const l of d.lines) w = Math.max(w, ctx.measureText(l).width)
      w += 44
      const lh = 27, ch = 30 + (d.lines.length + 1) * lh
      const cx = clamp(d.x + 30, 24, VW - w - 24), cy = clamp(d.y - ch - 40, 20, VH - ch - 20)
      ctx.fillStyle = 'rgba(5,17,29,0.92)'; ctx.strokeStyle = 'rgba(125,245,223,0.55)'; ctx.lineWidth = 1.6
      ctx.beginPath(); ctx.roundRect(cx, cy, w, ch, 14); ctx.fill(); ctx.stroke()
      ctx.strokeStyle = 'rgba(125,245,223,0.3)'
      ctx.beginPath(); ctx.moveTo(clamp(d.x, cx + 20, cx + w - 20), cy + ch); ctx.lineTo(d.x, d.y - 30); ctx.stroke()
      ctx.fillStyle = '#7df5df'; ctx.fillText(d.title, cx + 22, cy + 32)
      ctx.font = '400 18px "DM Sans", system-ui, sans-serif'; ctx.fillStyle = '#e6f2fc'
      d.lines.forEach((l, i) => ctx.fillText(l, cx + 22, cy + 32 + (i + 1) * lh))
      ctx.restore()
    }

    // depth vignette
    const vg = ctx.createRadialGradient(VW / 2, VH * 0.4, VH * 0.42, VW / 2, VH * 0.45, VH)
    vg.addColorStop(0, 'rgba(2,10,20,0)'); vg.addColorStop(1, 'rgba(2,10,20,0.55)')
    ctx.fillStyle = vg; ctx.fillRect(0, 0, VW, VH)
  },
}
