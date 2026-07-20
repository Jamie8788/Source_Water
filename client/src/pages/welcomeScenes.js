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

// clickable story hotspots — pollution, habitat, and why we monitor
const HOTSPOTS = [
  {
    x: 96, y: 566, r: 60, title: 'ROAD-SALT OUTFALL',
    lines: ['Winter runoff carries chloride from salted', 'roads into the lake. It stresses fish and', 'insects — and lingers for years. Volunteers', 'track it with simple test strips.'],
  },
  {
    x: 1180, y: 768, r: 70, title: 'WHY WE MONITOR HERE',
    lines: ['This sensor logs temperature, conductivity', 'and dissolved oxygen every 15 minutes —', 'published as open data anyone can use.'],
  },
  {
    x: 455, y: 770, r: 60, title: 'NATIVE PLANT BED',
    lines: ['Pondweed and wild celery shelter young', 'perch — and feed migrating ducks each fall.'],
  },
  {
    x: 955, y: 802, r: 60, title: 'DRIFTWOOD REEF',
    lines: ['Sunken wood is prime habitat.', 'Smallmouth bass nest here every June.'],
  },
]

export const underScene = {
  setup({ rnd }) {
    return {
      par: { x: 0, y: 0 },
      motes: makeParticles(64, () => ({ x: rnd() * VW, y: rnd() * VH, v: 3 + rnd() * 8, r: 0.8 + rnd() * 1.8, ph: rnd() * TAU })),
      bubbles: makeParticles(18, () => ({ x: rnd() * VW, y: VH + rnd() * VH, v: 34 + rnd() * 44, r: 2 + rnd() * 4, wob: rnd() * TAU })),
      school: makeParticles(9, (i) => ({ off: i * 34, lane: (i % 3) - 1, ph: rnd() * TAU })),
      chips: [],
      chipT: 0,
      rippleSeed: rnd() * 100,
      sel: null,
      plume: makeParticles(16, () => ({ life: rnd() })),
    }
  },
  draw(ctx, t, dt, s, env) {
    const p = env.pointer
    const tx = p.inside ? clamp((p.x - VW / 2) / (VW / 2), -1, 1) : 0
    const ty = p.inside ? clamp((p.y - VH / 2) / (VH / 2), -1, 1) : 0
    s.par.x = lerp(s.par.x, tx, Math.min(1, dt * 2.5))
    s.par.y = lerp(s.par.y, ty, Math.min(1, dt * 2.5))
    const par = (f, fn) => { ctx.save(); ctx.translate(-s.par.x * f, -s.par.y * f * 0.5); fn(); ctx.restore() }

    // water body
    ctx.fillStyle = vGrad(ctx, 0, 0, VH, [[0, '#12557e'], [0.35, '#0d3f63'], [0.7, '#092c48'], [1, '#051d33']])
    ctx.fillRect(0, 0, VW, VH)

    // surface seen from below
    ctx.save(); ctx.globalCompositeOperation = 'lighter'
    for (let x = -60; x < VW + 60; x += 44) {
      const y = 34 + Math.sin(x * 0.02 + t * 1.8) * 10 + Math.sin(x * 0.043 - t * 1.1) * 5
      ctx.fillStyle = 'rgba(180,230,255,0.10)'
      ctx.beginPath(); ctx.ellipse(x, y, 34, 8, 0, 0, TAU); ctx.fill()
    }
    ctx.restore()

    // light shafts
    par(6, () => {
      ctx.save(); ctx.globalCompositeOperation = 'lighter'
      for (let i = 0; i < 4; i++) {
        const bx = 240 + i * 380 + Math.sin(t * 0.3 + i * 2) * 40
        const g = ctx.createLinearGradient(bx, 0, bx + 160, VH * 0.85)
        g.addColorStop(0, `rgba(150,215,250,${0.10 + 0.05 * Math.sin(t * 0.5 + i)})`)
        g.addColorStop(1, 'rgba(150,215,250,0)')
        ctx.fillStyle = g
        ctx.beginPath()
        ctx.moveTo(bx, -10); ctx.lineTo(bx + 120, -10)
        ctx.lineTo(bx + 320, VH * 0.9); ctx.lineTo(bx + 90, VH * 0.9)
        ctx.closePath(); ctx.fill()
      }
      ctx.restore()
    })

    // suspended particles
    for (const m of s.motes) {
      m.y -= m.v * dt * 0.4; m.x += Math.sin(t * 0.6 + m.ph) * 6 * dt
      if (m.y < -6) { m.y = VH + 6; m.x = Math.random() * VW }
      ctx.fillStyle = `rgba(190,225,245,${(0.12 + 0.1 * Math.sin(t + m.ph)).toFixed(3)})`
      ctx.beginPath(); ctx.arc(m.x, m.y, m.r, 0, TAU); ctx.fill()
    }

    // ═ lakebed ═
    par(20, () => {
      ctx.fillStyle = vGrad(ctx, 0, 730, VH, [[0, '#274a52'], [1, '#1a323c']])
      ctx.beginPath(); ctx.moveTo(-40, VH)
      ctx.lineTo(-40, 800)
      ctx.bezierCurveTo(300, 770, 700, 812, 1000, 786)
      ctx.bezierCurveTo(1240, 766, 1460, 800, 1640, 784)
      ctx.lineTo(1640, VH); ctx.closePath(); ctx.fill()
      // rocks
      const rocks = [[140, 812, 52, 22], [420, 828, 36, 16], [700, 820, 60, 24], [1080, 806, 42, 18], [1330, 824, 66, 26], [1560, 812, 38, 16]]
      for (const [rx, ry, rw, rh] of rocks) {
        ctx.fillStyle = '#33525c'
        ctx.beginPath(); ctx.ellipse(rx, ry, rw, rh, 0, 0, TAU); ctx.fill()
        ctx.fillStyle = 'rgba(150,215,250,0.14)'
        ctx.beginPath(); ctx.ellipse(rx - rw * 0.25, ry - rh * 0.4, rw * 0.44, rh * 0.34, -0.3, 0, TAU); ctx.fill()
      }
      // driftwood
      ctx.strokeStyle = '#3a4a44'; ctx.lineWidth = 10; ctx.lineCap = 'round'
      ctx.beginPath(); ctx.moveTo(880, 828); ctx.quadraticCurveTo(960, 800, 1040, 816); ctx.stroke()
      ctx.lineWidth = 5
      ctx.beginPath(); ctx.moveTo(960, 806); ctx.lineTo(984, 786); ctx.stroke()

      // aquatic plants — swaying stalks + tape grass
      for (let i = 0; i < 9; i++) {
        const bx = 90 + i * 180 + (i % 3) * 24
        const bh = 90 + (i % 4) * 46
        const sway = Math.sin(t * 1.1 + i * 1.1) * 16
        ctx.strokeStyle = i % 2 ? 'rgba(52,150,118,0.75)' : 'rgba(64,170,132,0.6)'
        ctx.lineWidth = 6 - (i % 3); ctx.lineCap = 'round'
        ctx.beginPath()
        ctx.moveTo(bx, 826)
        ctx.bezierCurveTo(bx - 8, 826 - bh * 0.4, bx + sway * 0.5, 826 - bh * 0.7, bx + sway, 826 - bh)
        ctx.stroke()
        ctx.beginPath()
        ctx.moveTo(bx + 12, 830)
        ctx.bezierCurveTo(bx + 6, 830 - bh * 0.3, bx + 16 + sway * 0.4, 830 - bh * 0.55, bx + 10 + sway * 0.8, 830 - bh * 0.8)
        ctx.stroke()
      }

      // ═ road-salt outfall pipe (left wall) + drifting chloride plume ═
      ctx.fillStyle = '#46525a'
      ctx.beginPath(); ctx.roundRect(-20, 548, 100, 38, 6); ctx.fill()
      ctx.fillStyle = '#333d44'
      ctx.beginPath(); ctx.ellipse(80, 567, 7, 17, 0, 0, TAU); ctx.fill()
      ctx.fillStyle = '#1c2429'
      ctx.beginPath(); ctx.ellipse(80, 567, 4.4, 13, 0, 0, TAU); ctx.fill()
      ctx.strokeStyle = 'rgba(150,215,250,0.18)'; ctx.lineWidth = 2
      ctx.beginPath(); ctx.moveTo(-16, 552); ctx.lineTo(74, 552); ctx.stroke()
      // plume particles drifting out, sinking, dissolving
      for (const pp of s.plume) {
        pp.life += dt * 0.16
        if (pp.life > 1) pp.life -= 1
        const q = pp.life
        const px2 = 84 + q * 260 + Math.sin(q * 9) * 14
        const py2 = 567 + q * 120 + Math.sin(q * 13) * 10
        ctx.fillStyle = `rgba(196,214,206,${(0.22 * (1 - q)).toFixed(3)})`
        ctx.beginPath(); ctx.arc(px2, py2, 4 + q * 16, 0, TAU); ctx.fill()
      }
      // faint discoloured haze settling below the outfall
      const hz2 = ctx.createRadialGradient(190, 680, 10, 190, 680, 190)
      hz2.addColorStop(0, 'rgba(170,190,178,0.10)'); hz2.addColorStop(1, 'rgba(170,190,178,0)')
      ctx.fillStyle = hz2
      ctx.beginPath(); ctx.arc(190, 680, 190, 0, TAU); ctx.fill()

      // ═ sensor station on the bed ═
      const sx = 1180
      ctx.strokeStyle = '#5a6a72'; ctx.lineWidth = 3
      ctx.strokeRect(sx - 24, 756, 48, 44)
      ctx.beginPath(); ctx.moveTo(sx - 24, 756); ctx.lineTo(sx, 738); ctx.lineTo(sx + 24, 756); ctx.stroke()
      ctx.fillStyle = '#48565e'; ctx.fillRect(sx - 16, 768, 32, 24)
      const blink = (t % 1.8) < 0.24
      ctx.fillStyle = blink ? '#7df5df' : '#256156'
      ctx.beginPath(); ctx.arc(sx, 746, 3.4, 0, TAU); ctx.fill()
      if (blink) glow(ctx, sx, 746, 16, 'rgba(125,245,223,0.5)', 'rgba(125,245,223,0)')
      // mooring line up to the surface
      ctx.strokeStyle = 'rgba(200,220,235,0.25)'; ctx.lineWidth = 1.6
      ctx.beginPath(); ctx.moveTo(sx, 738)
      ctx.quadraticCurveTo(sx + Math.sin(t * 0.7) * 14, 400, sx + Math.sin(t * 0.7) * 20, 40)
      ctx.stroke()
      // sonar ping
      const ping = (t % 3.2) / 3.2
      ctx.strokeStyle = `rgba(125,245,223,${(0.5 * (1 - ping)).toFixed(3)})`
      ctx.lineWidth = 2
      ctx.beginPath(); ctx.arc(sx, 760, 10 + ping * 120, 0, TAU); ctx.stroke()
    })

    // rising data chips from the sensor
    s.chipT += dt
    if (s.chipT > 2.6) {
      s.chipT = 0
      s.chips.push({ y: 720, life: 0, txt: READINGS[(Math.random() * READINGS.length) | 0] })
      if (s.chips.length > 4) s.chips.shift()
    }
    ctx.font = '700 17px "DM Sans", system-ui, sans-serif'
    for (const c of s.chips) {
      c.life += dt; c.y -= dt * 46
      const a = c.life < 0.4 ? c.life / 0.4 : Math.max(0, 1 - (c.life - 2.6) / 1.2)
      const w = ctx.measureText(c.txt).width + 26
      const cx = 1180 + Math.sin(c.life * 1.4) * 14
      ctx.fillStyle = `rgba(8,24,38,${(0.75 * a).toFixed(3)})`
      ctx.strokeStyle = `rgba(125,245,223,${(0.55 * a).toFixed(3)})`
      ctx.lineWidth = 1.4
      ctx.beginPath(); ctx.roundRect(cx - w / 2, c.y - 17, w, 30, 9); ctx.fill(); ctx.stroke()
      ctx.fillStyle = `rgba(160,240,225,${a.toFixed(3)})`
      ctx.fillText(c.txt, cx - w / 2 + 13, c.y + 4)
    }

    // ═ fish ═
    par(12, () => {
      // lake sturgeon — the ancient giant, slow undulating crossing
      const stx = ((t * 26) % (VW + 900)) - 450
      ctx.save(); ctx.translate(stx, 640 + Math.sin(t * 0.7) * 12)
      ctx.fillStyle = 'rgba(96,126,142,0.9)'
      ctx.beginPath()
      ctx.moveTo(-170, 0)
      for (let i = 0; i <= 16; i++) {
        const q = i / 16
        const bx = -170 + q * 340
        const und = Math.sin(t * 3.4 - q * 3.4) * 6 * q
        ctx.lineTo(bx, und - (14 * Math.sin(Math.PI * Math.min(1, q * 1.24)) + 1))
      }
      for (let i = 16; i >= 0; i--) {
        const q = i / 16
        const bx = -170 + q * 340
        const und = Math.sin(t * 3.4 - q * 3.4) * 6 * q
        ctx.lineTo(bx, und + (12 * Math.sin(Math.PI * Math.min(1, q * 1.24)) + 1))
      }
      ctx.closePath(); ctx.fill()
      // scutes (ridge bumps) + tail + snout barbels
      ctx.fillStyle = 'rgba(70,96,110,0.9)'
      for (let i = 2; i < 13; i++) {
        const q = i / 16, bx = -170 + q * 340
        const und = Math.sin(t * 3.4 - q * 3.4) * 6 * q
        ctx.beginPath()
        ctx.moveTo(bx, und - 14 * Math.sin(Math.PI * q * 1.1) - 2)
        ctx.lineTo(bx + 7, und - 14 * Math.sin(Math.PI * q * 1.1) - 9)
        ctx.lineTo(bx + 14, und - 14 * Math.sin(Math.PI * q * 1.1) - 2)
        ctx.closePath(); ctx.fill()
      }
      const twag = Math.sin(t * 3.4 - 3.4) * 12
      ctx.beginPath()
      ctx.moveTo(166, twag * 0.5)
      ctx.lineTo(206, twag - 22); ctx.lineTo(196, twag); ctx.lineTo(206, twag + 16)
      ctx.closePath(); ctx.fill()
      ctx.strokeStyle = 'rgba(70,96,110,0.8)'; ctx.lineWidth = 2
      ctx.beginPath(); ctx.moveTo(-168, 4); ctx.lineTo(-176, 12); ctx.moveTo(-160, 5); ctx.lineTo(-166, 14); ctx.stroke()
      ctx.fillStyle = '#122430'
      ctx.beginPath(); ctx.arc(-148, -4, 2.6, 0, TAU); ctx.fill()
      ctx.restore()

      // school of small fish following a sine road (reverses over time)
      const dir = Math.sin(t * 0.11) > 0 ? 1 : -1
      for (const f of s.school) {
        const fx = ((t * 90 * dir + f.off * dir) % (VW + 260) + (VW + 260)) % (VW + 260) - 130
        const fy = 486 + f.lane * 38 + Math.sin(fx * 0.012 + f.ph) * 24
        const wag = Math.sin(t * 9 + f.ph) * 5
        ctx.save(); ctx.translate(fx, fy); ctx.scale(dir, 1)
        fishShape(ctx, 34, 'rgba(168,205,228,0.75)', 'rgba(220,238,250,0.5)', wag)
        ctx.restore()
      }

      // walleye pair near the bed
      for (const [wx2, wy2, ph] of [[500, 705, 0], [610, 728, 2]]) {
        const drift2 = Math.sin(t * 0.4 + ph) * 30
        ctx.save(); ctx.translate(wx2 + drift2, wy2 + Math.sin(t * 0.8 + ph) * 5)
        ctx.scale(Math.cos(t * 0.4 + ph) > 0 ? 1 : -1, 1)
        fishShape(ctx, 66, '#7a8a5e', '#c9c39a', Math.sin(t * 5 + ph) * 5)
        ctx.fillStyle = '#20301c'
        ctx.beginPath(); ctx.arc(24, -3, 2.4, 0, TAU); ctx.fill()
        // spiny dorsal
        ctx.strokeStyle = '#5d6a46'; ctx.lineWidth = 1.6
        for (let k = -1; k < 3; k++) { ctx.beginPath(); ctx.moveTo(k * 7 - 4, -12); ctx.lineTo(k * 7 - 1, -19); ctx.stroke() }
        ctx.restore()
      }

      // lake trout higher in the column with spots
      const trx = VW - ((t * 42) % (VW + 360)) + 180
      ctx.save(); ctx.translate(trx, 560 + Math.sin(t * 1.1) * 14); ctx.scale(-1, 1)
      fishShape(ctx, 92, '#5e7484', '#aebfc9', Math.sin(t * 6) * 7)
      ctx.fillStyle = 'rgba(220,232,240,0.55)'
      for (let k = 0; k < 8; k++) {
        ctx.beginPath(); ctx.arc(-24 + (k % 4) * 14, -6 + ((k / 4) | 0) * 9, 1.6, 0, TAU); ctx.fill()
      }
      ctx.fillStyle = '#16242e'; ctx.beginPath(); ctx.arc(34, -4, 2.8, 0, TAU); ctx.fill()
      ctx.restore()

      // painted turtle swimming, flippers stroking
      const tux = ((t * 34 + 700) % (VW + 400)) - 200
      ctx.save(); ctx.translate(tux, 112 + Math.sin(t * 1.3) * 9)
      const st = Math.sin(t * 3.2)
      ctx.fillStyle = '#3e6a4c'
      for (const [lx2, ly2, dirL] of [[-16, -12, -1], [-16, 12, 1], [16, -14, -1], [16, 14, 1]]) {
        ctx.save(); ctx.translate(lx2, ly2); ctx.rotate(st * 0.5 * dirL)
        ctx.beginPath(); ctx.ellipse(0, dirL * 6, 5, 10, 0, 0, TAU); ctx.fill()
        ctx.restore()
      }
      ctx.fillStyle = '#4a7a56'
      ctx.beginPath(); ctx.ellipse(0, 0, 26, 18, 0, 0, TAU); ctx.fill()
      ctx.strokeStyle = '#2c5137'; ctx.lineWidth = 2
      ctx.beginPath(); ctx.moveTo(-18, -8); ctx.quadraticCurveTo(0, -14, 18, -8)
      ctx.moveTo(-22, 0); ctx.lineTo(22, 0)
      ctx.moveTo(-18, 8); ctx.quadraticCurveTo(0, 14, 18, 8); ctx.stroke()
      ctx.fillStyle = '#54885e'
      ctx.beginPath(); ctx.arc(31, -4, 7.5, 0, TAU); ctx.fill()
      ctx.fillStyle = '#12281a'; ctx.beginPath(); ctx.arc(33.5, -6, 1.6, 0, TAU); ctx.fill()
      ctx.restore()
    })

    // bubbles (+ cursor bubbles)
    if (p.inside && Math.random() < dt * 6) s.bubbles.push({ x: p.x, y: p.y, v: 60, r: 1.6 + Math.random() * 2.4, wob: Math.random() * TAU })
    if (s.bubbles.length > 60) s.bubbles.splice(0, s.bubbles.length - 60)
    for (const b of s.bubbles) {
      b.y -= b.v * dt; b.x += Math.sin(t * 2 + b.wob) * 10 * dt
      if (b.y < 30) { b.y = VH + 10; b.x = Math.random() * VW }
      ctx.strokeStyle = 'rgba(210,240,255,0.4)'
      ctx.lineWidth = 1.2
      ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, TAU); ctx.stroke()
      ctx.fillStyle = 'rgba(240,250,255,0.35)'
      ctx.beginPath(); ctx.arc(b.x - b.r * 0.3, b.y - b.r * 0.3, b.r * 0.3, 0, TAU); ctx.fill()
    }

    // depth vignette
    const vg = ctx.createRadialGradient(VW / 2, VH * 0.4, VH * 0.4, VW / 2, VH * 0.45, VH)
    vg.addColorStop(0, 'rgba(2,10,20,0)'); vg.addColorStop(1, 'rgba(2,10,20,0.5)')
    ctx.fillStyle = vg; ctx.fillRect(0, 0, VW, VH)

    // ═ interactive hotspots: click a glowing point to learn the story ═
    if (p.click) {
      const c = p.click
      p.click = null
      let hit = null
      for (const h of HOTSPOTS) {
        if ((c.x - h.x) ** 2 + (c.y - h.y) ** 2 < h.r * h.r) { hit = h; break }
      }
      s.sel = hit && s.sel !== hit ? hit : null
    }
    for (const h of HOTSPOTS) {
      const pu = 0.6 + 0.4 * Math.sin(t * 2.4 + h.x)
      const active = s.sel === h
      ctx.strokeStyle = `rgba(125,245,223,${(active ? 0.9 : 0.45 * pu).toFixed(3)})`
      ctx.lineWidth = 2
      ctx.beginPath(); ctx.arc(h.x, h.y, 13 + (active ? 2 : pu * 3), 0, TAU); ctx.stroke()
      ctx.fillStyle = `rgba(125,245,223,${(active ? 1 : 0.75).toFixed(3)})`
      ctx.fillRect(h.x - 5, h.y - 1.2, 10, 2.4)
      if (!active) ctx.fillRect(h.x - 1.2, h.y - 5, 2.4, 10) // "+" collapses to "−"
      const rq = ((t + h.y * 0.01) % 2.6) / 2.6
      ctx.strokeStyle = `rgba(125,245,223,${(0.4 * (1 - rq)).toFixed(3)})`
      ctx.beginPath(); ctx.arc(h.x, h.y, 13 + rq * 30, 0, TAU); ctx.stroke()
    }
    if (s.sel) {
      const h = s.sel
      ctx.save()
      ctx.font = '600 19px "DM Sans", system-ui, sans-serif'
      let w = ctx.measureText(h.title).width
      for (const l of h.lines) w = Math.max(w, ctx.measureText(l).width)
      w += 44
      const lh = 27
      const ch = 30 + (h.lines.length + 1) * lh
      const cx = clamp(h.x + 30, 24, VW - w - 24)
      const cy = clamp(h.y - ch - 24, 20, VH - ch - 20)
      ctx.fillStyle = 'rgba(5,17,29,0.9)'
      ctx.strokeStyle = 'rgba(125,245,223,0.55)'; ctx.lineWidth = 1.6
      ctx.beginPath(); ctx.roundRect(cx, cy, w, ch, 14); ctx.fill(); ctx.stroke()
      // pointer stem toward the hotspot
      ctx.beginPath()
      ctx.moveTo(clamp(h.x, cx + 24, cx + w - 24), cy + ch)
      ctx.lineTo(h.x, h.y - 16)
      ctx.strokeStyle = 'rgba(125,245,223,0.35)'; ctx.stroke()
      ctx.fillStyle = '#7df5df'
      ctx.fillText(h.title, cx + 22, cy + 32)
      ctx.fillStyle = '#e6f2fc'
      ctx.font = '400 18px "DM Sans", system-ui, sans-serif'
      h.lines.forEach((l, i) => ctx.fillText(l, cx + 22, cy + 32 + (i + 1) * lh))
      ctx.restore()
    }
  },
}
