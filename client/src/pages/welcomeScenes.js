/**
 * welcomeScenes — Canvas2D scene: BENEATH THE SURFACE.
 * An explorable Great Lakes bioindicator ecosystem. Pilot a research ROV
 * with the cursor; its headlight reveals the murk. Click any creature to
 * learn what it is — and what its presence (or absence) tells you about the
 * lake's health: native fish, at-risk mussels, clean-water mayflies, and the
 * invasive species monitoring is built to catch. The shoreline hero lives in
 * welcomeShore.js.
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
  // forked caudal tail
  ctx.fillStyle = body
  ctx.beginPath()
  ctx.moveTo(-len * 0.46, 0)
  ctx.quadraticCurveTo(-len * 0.58, wag * 0.4, -len * 0.72, wag - len * 0.17)
  ctx.quadraticCurveTo(-len * 0.6, wag * 0.5, -len * 0.62, wag)
  ctx.quadraticCurveTo(-len * 0.6, wag * 0.5, -len * 0.72, wag + len * 0.17)
  ctx.quadraticCurveTo(-len * 0.58, wag * 0.4, -len * 0.46, 0)
  ctx.closePath(); ctx.fill()
}

// ── status palette for the bioindicator tags ──────────────────────────────
const STATUS = {
  native:    { c: '#7df5df', label: 'NATIVE' },
  atrisk:    { c: '#ffc15e', label: 'AT RISK' },
  indicator: { c: '#8ee06a', label: 'CLEAN-WATER INDICATOR' },
  invasive:  { c: '#ff7a6b', label: 'INVASIVE' },
}

// small creature painters (origin at body centre, facing +x) ---------------
function drawFish2(ctx, len, body, belly, wag, o = {}) {
  // dorsal fin (behind head, on the back) + pectoral fin — drawn under body
  ctx.fillStyle = body
  ctx.beginPath()
  ctx.moveTo(-len * 0.14, -len * 0.2)
  ctx.quadraticCurveTo(len * 0.02, -len * 0.42, len * 0.16, -len * 0.19)
  ctx.closePath(); ctx.fill()
  fishShape(ctx, len, body, belly, wag)
  // pectoral fin (translucent), mid-body low
  ctx.fillStyle = 'rgba(0,0,0,0.12)'
  ctx.beginPath()
  ctx.moveTo(len * 0.12, len * 0.06)
  ctx.quadraticCurveTo(len * 0.02, len * 0.34, len * 0.24, len * 0.16)
  ctx.closePath(); ctx.fill()
  // darker back / lighter belly for volume
  ctx.fillStyle = 'rgba(0,0,0,0.16)'
  ctx.beginPath(); ctx.ellipse(-len * 0.02, -len * 0.08, len * 0.42, len * 0.11, 0, 0, TAU); ctx.fill()
  ctx.fillStyle = 'rgba(255,255,255,0.12)'
  ctx.beginPath(); ctx.ellipse(0, len * 0.1, len * 0.4, len * 0.07, 0, 0, TAU); ctx.fill()
  if (o.bars) { ctx.strokeStyle = o.bars; ctx.lineWidth = len * 0.03
    for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(i * len * 0.1, -len * 0.16); ctx.lineTo(i * len * 0.1 - wag * 0.1, len * 0.16); ctx.stroke() } }
  if (o.spots) { ctx.fillStyle = o.spots
    for (let k = 0; k < 9; k++) { ctx.beginPath(); ctx.arc(-len * 0.3 + (k % 5) * len * 0.13, -len * 0.08 + ((k / 5) | 0) * len * 0.12, len * 0.02, 0, TAU); ctx.fill() } }
  if (o.dorsal) { ctx.strokeStyle = o.dorsal; ctx.lineWidth = len * 0.022
    for (let k = -2; k < 3; k++) { ctx.beginPath(); ctx.moveTo(k * len * 0.07, -len * 0.2); ctx.lineTo(k * len * 0.07 + len * 0.02, -len * 0.32); ctx.stroke() } }
  ctx.fillStyle = '#0e1c22'; ctx.beginPath(); ctx.arc(len * 0.36, -len * 0.03, len * 0.035 + 0.6, 0, TAU); ctx.fill()
  ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.beginPath(); ctx.arc(len * 0.37, -len * 0.045, len * 0.013 + 0.3, 0, TAU); ctx.fill()
}
function drawSturgeon(ctx, t, wag) {
  ctx.fillStyle = 'rgba(120,140,150,0.95)'
  ctx.beginPath()
  ctx.moveTo(-150, 0)
  for (let i = 0; i <= 16; i++) { const q = i / 16, bx = -150 + q * 300, u = Math.sin(t * 3 - q * 3.4) * 6 * q; ctx.lineTo(bx, u - (13 * Math.sin(Math.PI * Math.min(1, q * 1.24)) + 1)) }
  for (let i = 16; i >= 0; i--) { const q = i / 16, bx = -150 + q * 300, u = Math.sin(t * 3 - q * 3.4) * 6 * q; ctx.lineTo(bx, u + (11 * Math.sin(Math.PI * Math.min(1, q * 1.24)) + 1)) }
  ctx.closePath(); ctx.fill()
  ctx.fillStyle = 'rgba(86,104,116,0.95)'
  for (let i = 2; i < 13; i++) { const q = i / 16, bx = -150 + q * 300, u = Math.sin(t * 3 - q * 3.4) * 6 * q; ctx.beginPath(); ctx.moveTo(bx, u - 13 * Math.sin(Math.PI * q * 1.1) - 2); ctx.lineTo(bx + 6, u - 13 * Math.sin(Math.PI * q * 1.1) - 8); ctx.lineTo(bx + 12, u - 13 * Math.sin(Math.PI * q * 1.1) - 2); ctx.closePath(); ctx.fill() }
  const tw = Math.sin(t * 3 - 3.4) * 11
  ctx.beginPath(); ctx.moveTo(146, tw * 0.5); ctx.lineTo(184, tw - 20); ctx.lineTo(176, tw); ctx.lineTo(184, tw + 14); ctx.closePath(); ctx.fill()
  ctx.strokeStyle = 'rgba(86,104,116,0.9)'; ctx.lineWidth = 2
  ctx.beginPath(); ctx.moveTo(-148, 4); ctx.lineTo(-158, 12); ctx.moveTo(-140, 5); ctx.lineTo(-148, 14); ctx.stroke()
  ctx.fillStyle = '#0e1c22'; ctx.beginPath(); ctx.arc(-130, -4, 2.6, 0, TAU); ctx.fill()
}
function drawMuskie(ctx, t, wag) {
  drawFish2(ctx, 120, '#6b7d54', '#c9c9a0', wag, { bars: 'rgba(40,56,30,0.5)' })
  // long snout
  ctx.fillStyle = '#5d6c48'; ctx.beginPath(); ctx.moveTo(52, -3); ctx.lineTo(66, -1); ctx.lineTo(52, 3); ctx.closePath(); ctx.fill()
}
function drawTurtle2(ctx, t) {
  const st = Math.sin(t * 3.2)
  ctx.fillStyle = '#3e6a4c'
  for (const [lx, ly, d] of [[-16, -12, -1], [-16, 12, 1], [16, -14, -1], [16, 14, 1]]) { ctx.save(); ctx.translate(lx, ly); ctx.rotate(st * 0.5 * d); ctx.beginPath(); ctx.ellipse(0, d * 6, 5, 10, 0, 0, TAU); ctx.fill(); ctx.restore() }
  ctx.fillStyle = '#4a7a56'; ctx.beginPath(); ctx.ellipse(0, 0, 26, 18, 0, 0, TAU); ctx.fill()
  ctx.strokeStyle = '#2c5137'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-18, -8); ctx.quadraticCurveTo(0, -14, 18, -8); ctx.moveTo(-22, 0); ctx.lineTo(22, 0); ctx.moveTo(-18, 8); ctx.quadraticCurveTo(0, 14, 18, 8); ctx.stroke()
  ctx.fillStyle = '#e0a63a'; ctx.beginPath(); ctx.arc(31, -4, 7, 0, TAU); ctx.fill() // painted-turtle red-orange head marks
  ctx.strokeStyle = '#c94a3a'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(28, -8); ctx.lineTo(35, -7); ctx.moveTo(28, -1); ctx.lineTo(35, -2); ctx.stroke()
  ctx.fillStyle = '#12281a'; ctx.beginPath(); ctx.arc(33, -6, 1.5, 0, TAU); ctx.fill()
}
function drawMussel(ctx, t) {
  const gape = 3 + Math.sin(t * 0.8) * 2
  ctx.fillStyle = '#5a4738'; ctx.strokeStyle = '#3a2c22'; ctx.lineWidth = 1.4
  ctx.save(); ctx.rotate(-0.3)
  ctx.beginPath(); ctx.ellipse(0, -gape, 15, 9, 0, Math.PI, TAU); ctx.fill(); ctx.stroke()
  ctx.beginPath(); ctx.ellipse(0, gape, 15, 9, 0, 0, Math.PI); ctx.fill(); ctx.stroke()
  ctx.fillStyle = 'rgba(220,235,240,0.5)'; ctx.beginPath(); ctx.ellipse(0, 0, 9, gape * 0.7, 0, 0, TAU); ctx.fill()
  ctx.strokeStyle = 'rgba(40,30,22,0.4)'; ctx.lineWidth = 0.8
  for (let i = 1; i < 4; i++) { ctx.beginPath(); ctx.ellipse(0, -gape, 15 - i * 3.4, 9 - i * 2, 0, Math.PI, TAU); ctx.stroke() }
  ctx.restore()
}
function drawMayfly(ctx, t) {
  ctx.fillStyle = '#b89a5a'; ctx.strokeStyle = '#8a6f3a'; ctx.lineWidth = 1
  ctx.beginPath(); ctx.ellipse(0, 0, 11, 3.4, 0, 0, TAU); ctx.fill()
  // feathery gills wiggle
  ctx.strokeStyle = 'rgba(180,220,200,0.7)'
  for (let i = -2; i <= 2; i++) { const w = Math.sin(t * 8 + i) * 1.6; ctx.beginPath(); ctx.moveTo(i * 3, -2); ctx.lineTo(i * 3 + w, -6); ctx.moveTo(i * 3, 2); ctx.lineTo(i * 3 - w, 6); ctx.stroke() }
  // three tails
  ctx.strokeStyle = '#8a6f3a'; ctx.beginPath(); ctx.moveTo(-10, 0); ctx.lineTo(-18, -3); ctx.moveTo(-10, 0); ctx.lineTo(-19, 0); ctx.moveTo(-10, 0); ctx.lineTo(-18, 3); ctx.stroke()
  // head + legs
  ctx.fillStyle = '#8a6f3a'; ctx.beginPath(); ctx.arc(11, 0, 2.4, 0, TAU); ctx.fill()
}
function drawCrayfish(ctx, t) {
  const claw = Math.sin(t * 3) * 0.2
  ctx.fillStyle = '#8a4a34'; ctx.strokeStyle = '#5a2c1c'; ctx.lineWidth = 1.2
  ctx.beginPath(); ctx.ellipse(0, 0, 12, 6, 0, 0, TAU); ctx.fill()
  // segmented tail
  for (let i = 1; i <= 3; i++) { ctx.beginPath(); ctx.ellipse(-8 - i * 5, 0, 5 - i * 0.6, 4.4 - i * 0.5, 0, 0, TAU); ctx.fill() }
  ctx.beginPath(); ctx.moveTo(-26, 0); ctx.lineTo(-33, -5); ctx.lineTo(-31, 0); ctx.lineTo(-33, 5); ctx.closePath(); ctx.fill()
  // claws
  for (const s2 of [-1, 1]) { ctx.save(); ctx.translate(11, s2 * 4); ctx.rotate(s2 * (0.5 + claw))
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(10, -1); ctx.stroke()
    ctx.beginPath(); ctx.ellipse(12, -1, 4, 2.6, 0, 0, TAU); ctx.fill(); ctx.restore() }
  ctx.strokeStyle = '#5a2c1c'; ctx.beginPath(); ctx.moveTo(10, -2); ctx.lineTo(20, -8); ctx.moveTo(10, 2); ctx.lineTo(20, 8); ctx.stroke()
  ctx.fillStyle = '#0e1c22'; ctx.beginPath(); ctx.arc(9, -2, 1.4, 0, TAU); ctx.arc(9, 2, 1.4, 0, TAU); ctx.fill()
}
function drawZebra(ctx, t) {
  for (const [zx, zy, zs] of [[0, 0, 1], [8, 3, 0.8], [-6, 4, 0.7], [4, -5, 0.75], [-8, -3, 0.65]]) {
    ctx.save(); ctx.translate(zx, zy); ctx.scale(zs, zs)
    ctx.fillStyle = '#d9c9a0'; ctx.strokeStyle = '#6a5a3a'; ctx.lineWidth = 1
    ctx.beginPath(); ctx.moveTo(-6, 4); ctx.quadraticCurveTo(-2, -6, 6, -3); ctx.quadraticCurveTo(2, 3, -6, 4); ctx.closePath(); ctx.fill(); ctx.stroke()
    ctx.strokeStyle = '#3a2c18'; ctx.lineWidth = 0.8
    ctx.beginPath(); ctx.moveTo(-4, 2); ctx.lineTo(3, -3); ctx.moveTo(-3, 3.4); ctx.lineTo(5, -1); ctx.stroke()
    ctx.restore()
  }
}
function drawLamprey(ctx, t, wag) {
  ctx.fillStyle = 'rgba(90,86,74,0.95)'
  ctx.beginPath()
  ctx.moveTo(-70, 0)
  for (let i = 0; i <= 14; i++) { const q = i / 14, bx = -70 + q * 140, u = Math.sin(t * 5 - q * 6) * 8 * (0.4 + q * 0.6); ctx.lineTo(bx, u - (4 + 2 * Math.sin(Math.PI * q))) }
  for (let i = 14; i >= 0; i--) { const q = i / 14, bx = -70 + q * 140, u = Math.sin(t * 5 - q * 6) * 8 * (0.4 + q * 0.6); ctx.lineTo(bx, u + (4 + 2 * Math.sin(Math.PI * q))) }
  ctx.closePath(); ctx.fill()
  // round sucker mouth
  const mu = Math.sin(t * 5) * 8 * 0.4
  ctx.fillStyle = '#3a3630'; ctx.beginPath(); ctx.arc(-70, mu, 6, 0, TAU); ctx.fill()
  ctx.fillStyle = '#6b3a3a'; ctx.beginPath(); ctx.arc(-70, mu, 3.4, 0, TAU); ctx.fill()
  // gill pores
  ctx.fillStyle = '#3a3630'; for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.arc(-56 + i * 5, mu * 0.6 - 2, 1, 0, TAU); ctx.fill() }
}

// creature roster — the star of the scene ----------------------------------
const CREATURES = [
  { id: 'sturgeon', name: 'Lake Sturgeon', latin: 'Acipenser fulvescens', status: 'atrisk', r: 90,
    lines: ['A living fossil — over 100 years old and older', 'than the dinosaurs’ cousins. Needs clean gravel', 'to spawn; its slow return means the lake is healing.'],
    lane: 662, sp: 22, size: 1, kind: 'sturgeon' },
  { id: 'muskie', name: 'Muskellunge', latin: 'Esox masquinongy', status: 'native', r: 70,
    lines: ['The apex ambush predator, "the fish of 10,000', 'casts." A healthy muskie population sits on top', 'of a healthy, balanced food web.'],
    lane: 596, sp: 30, dirBase: -1, kind: 'muskie' },
  { id: 'trout', name: 'Lake Trout', latin: 'Salvelinus namaycush', status: 'native', r: 52,
    lines: ['Wants cold, oxygen-rich deep water. It is the', 'first to struggle when the lake warms or', 'oxygen runs low near the bottom.'],
    lane: 470, sp: 42, dirBase: -1, kind: 'trout' },
  { id: 'walleye', name: 'Walleye', latin: 'Sander vitreus', status: 'native', r: 44,
    lines: ['Hunts by low light with mirror-like eyes.', 'Sensitive to clarity — algae blooms and silt', 'crowd out the light it needs to feed.'],
    x: 520, y: 726, hover: true, kind: 'walleye' },
  { id: 'perch', name: 'Yellow Perch', latin: 'Perca flavescens', status: 'native', r: 40,
    lines: ['Schools through the shallows in tiger stripes —', 'the forage fish that feeds nearly everything', 'larger in the lake.'],
    lane: 540, sp: 66, school: 3, kind: 'perch' },
  { id: 'turtle', name: 'Painted Turtle', latin: 'Chrysemys picta', status: 'native', r: 40,
    lines: ['Basks to warm up, then hunts in the weeds.', 'A sign of a healthy shoreline wetland with', 'plenty of aquatic plants.'],
    lane: 232, sp: 34, kind: 'turtle' },
  { id: 'mussel', name: 'Freshwater Mussel', latin: 'Unionidae', status: 'atrisk', r: 44,
    lines: ['Filters dozens of litres of water a day. So', 'sensitive to pollution that biologists use', 'mussel beds as a living early-warning system.'],
    x: 430, kind: 'mussel', benthic: true },
  { id: 'mayfly', name: 'Mayfly Nymph', latin: 'Hexagenia', status: 'indicator', r: 34,
    lines: ['Burrows in clean sediment and breathes through', 'feathery gills. Its famous return to Lake Erie', 'proved decades of cleanup were finally working.'],
    x: 770, kind: 'mayfly', benthic: true },
  { id: 'crayfish', name: 'Crayfish', latin: 'Faxonius', status: 'native', r: 40,
    lines: ['Scavenges the lakebed and recycles nutrients.', 'One of the first to vanish when heavy metals', 'build up in the sediment.'],
    x: 995, kind: 'crayfish', benthic: true },
  { id: 'zebra', name: 'Zebra Mussel', latin: 'Dreissena polymorpha', status: 'invasive', r: 40,
    lines: ['Invasive. Clears the water by filtering — but', 'strips the food web and clogs water intakes.', 'A cautionary tale of a hitchhiker gone wild.'],
    x: 1320, y: 806, kind: 'zebra', benthic: true },
  { id: 'lamprey', name: 'Sea Lamprey', latin: 'Petromyzon marinus', status: 'invasive', r: 52,
    lines: ['Invasive jawless parasite that latches onto fish.', 'It nearly collapsed the trout fishery — now held', 'back by a binational control program.'],
    lane: 792, sp: 26, dirBase: -1, kind: 'lamprey' },
]

function creaturePos(c, t) {
  if (c.benthic) return { x: c.x, y: c.y != null ? c.y : bedY(c.x) - 6, face: 1, list: [{ x: c.x, y: c.y != null ? c.y : bedY(c.x) - 6 }] }
  if (c.hover) return { x: c.x + Math.sin(t * 0.4) * 30, y: c.y + Math.sin(t * 0.8) * 5, face: Math.cos(t * 0.4) > 0 ? 1 : -1 }
  const dir = c.dirBase || 1
  const span = VW + 360
  if (c.school) {
    const list = []
    for (let i = 0; i < c.school; i++) {
      const fx = (((t * c.sp * dir + i * 46 * dir) % span) + span) % span - 180
      list.push({ x: fx, y: c.lane + (i - 1) * 26 + Math.sin(fx * 0.012 + i) * 16, face: dir })
    }
    return { x: list[0].x, y: list[0].y, face: dir, list }
  }
  const fx = (((t * c.sp * dir) % span) + span) % span - 180
  return { x: fx, y: c.lane + Math.sin(fx * 0.008 + (c.id.length)) * 18, face: dir }
}
function bedY(x) {
  // matches the lakebed curve below
  if (x < 300) return 812 - (300 - x) * 0.02
  if (x < 1000) return 812 - Math.sin((x - 300) / 700 * Math.PI) * 20
  return 806 + (x - 1000) * 0.01
}
function drawCreature(ctx, c, t) {
  const wag = Math.sin(t * (c.benthic ? 2 : 6) + c.x * 0.01) * 6
  if (c.kind === 'sturgeon') drawSturgeon(ctx, t, wag)
  else if (c.kind === 'muskie') drawMuskie(ctx, t, wag)
  else if (c.kind === 'trout') drawFish2(ctx, 90, '#5e7484', '#aebfc9', wag, { spots: 'rgba(220,232,240,0.5)' })
  else if (c.kind === 'walleye') drawFish2(ctx, 62, '#8a8a52', '#d8d2a0', wag, { dorsal: '#5d6a46' })
  else if (c.kind === 'perch') drawFish2(ctx, 40, '#c2a83a', '#e8dca0', wag, { bars: 'rgba(60,50,20,0.6)', dorsal: '#8a6a2a' })
  else if (c.kind === 'turtle') drawTurtle2(ctx, t)
  else if (c.kind === 'mussel') drawMussel(ctx, t)
  else if (c.kind === 'mayfly') drawMayfly(ctx, t)
  else if (c.kind === 'crayfish') drawCrayfish(ctx, t)
  else if (c.kind === 'zebra') drawZebra(ctx, t)
  else if (c.kind === 'lamprey') drawLamprey(ctx, t, wag)
}

function speciesBubble(ctx, c, x, y, alpha) {
  const st = STATUS[c.status]
  ctx.save(); ctx.globalAlpha = alpha
  ctx.font = '700 20px "DM Sans", system-ui, sans-serif'
  let w = ctx.measureText(c.name).width
  ctx.font = 'italic 15px Georgia, serif'; w = Math.max(w, ctx.measureText(c.latin).width)
  ctx.font = '700 12px "DM Sans", system-ui, sans-serif'; w = Math.max(w, ctx.measureText(st.label).width + 22)
  ctx.font = '400 17px "DM Sans", system-ui, sans-serif'
  for (const l of c.lines) w = Math.max(w, ctx.measureText(l).width)
  w += 44
  const ch = 92 + c.lines.length * 25
  const cx = clamp(x + 26, 20, VW - w - 20), cy = clamp(y - ch - 30, 18, VH - ch - 18)
  ctx.fillStyle = 'rgba(5,17,29,0.93)'; ctx.strokeStyle = `${st.c}99`; ctx.lineWidth = 1.6
  ctx.beginPath(); ctx.roundRect(cx, cy, w, ch, 15); ctx.fill(); ctx.stroke()
  ctx.strokeStyle = `${st.c}55`
  ctx.beginPath(); ctx.moveTo(clamp(x, cx + 22, cx + w - 22), cy + ch); ctx.lineTo(x, y - 8); ctx.stroke()
  ctx.fillStyle = '#f2f8fe'; ctx.font = '700 20px "DM Sans", system-ui, sans-serif'
  ctx.fillText(c.name, cx + 22, cy + 34)
  ctx.fillStyle = '#9fb6c8'; ctx.font = 'italic 15px Georgia, serif'
  ctx.fillText(c.latin, cx + 22, cy + 53)
  // status chip
  ctx.font = '700 12px "DM Sans", system-ui, sans-serif'
  const cw = ctx.measureText(st.label).width + 20
  ctx.fillStyle = `${st.c}26`; ctx.strokeStyle = st.c; ctx.lineWidth = 1
  ctx.beginPath(); ctx.roundRect(cx + 22, cy + 63, cw, 20, 10); ctx.fill(); ctx.stroke()
  ctx.fillStyle = st.c; ctx.fillText(st.label, cx + 32, cy + 77)
  ctx.fillStyle = '#dceaf6'; ctx.font = '400 17px "DM Sans", system-ui, sans-serif'
  c.lines.forEach((l, i) => ctx.fillText(l, cx + 22, cy + 106 + i * 25))
  ctx.restore()
}

export const underScene = {
  setup({ rnd }) {
    return {
      rov: { x: 800, y: 300, face: 1, prop: 0 },
      motes: makeParticles(70, () => ({ x: rnd() * VW, y: rnd() * VH, v: 3 + rnd() * 8, r: 0.8 + rnd() * 1.8, ph: rnd() * TAU })),
      bubbles: makeParticles(14, () => ({ x: rnd() * VW, y: VH + rnd() * VH, v: 30 + rnd() * 40, r: 2 + rnd() * 4, wob: rnd() * TAU })),
      plume: makeParticles(16, () => ({ life: rnd() })),
      sel: null, selT: 0, hit: [],
    }
  },
  draw(ctx, t, dt, s, env) {
    const p = env.pointer
    const rov = s.rov
    s.hit = []

    ctx.fillStyle = vGrad(ctx, 0, 0, VH, [[0, '#10527a'], [0.35, '#0b3a5c'], [0.7, '#072741'], [1, '#04182b']])
    ctx.fillRect(0, 0, VW, VH)

    // surface + shafts
    ctx.save(); ctx.globalCompositeOperation = 'lighter'
    for (let x = -60; x < VW + 60; x += 46) { const y = 30 + Math.sin(x * 0.02 + t * 1.6) * 9; ctx.fillStyle = 'rgba(150,210,245,0.06)'; ctx.beginPath(); ctx.ellipse(x, y, 32, 7, 0, 0, TAU); ctx.fill() }
    for (let i = 0; i < 4; i++) { const bx = 240 + i * 380 + Math.sin(t * 0.3 + i * 2) * 40; const g = ctx.createLinearGradient(bx, 0, bx + 150, VH * 0.85); g.addColorStop(0, 'rgba(140,205,245,0.07)'); g.addColorStop(1, 'rgba(140,205,245,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(bx, -10); ctx.lineTo(bx + 110, -10); ctx.lineTo(bx + 300, VH * 0.9); ctx.lineTo(bx + 80, VH * 0.9); ctx.closePath(); ctx.fill() }
    ctx.restore()

    for (const m of s.motes) { m.y -= m.v * dt * 0.4; m.x += Math.sin(t * 0.6 + m.ph) * 6 * dt; if (m.y < -6) { m.y = VH + 6; m.x = Math.random() * VW }
      ctx.fillStyle = `rgba(190,225,245,${(0.1 + 0.08 * Math.sin(t + m.ph)).toFixed(3)})`; ctx.beginPath(); ctx.arc(m.x, m.y, m.r, 0, TAU); ctx.fill() }

    // lakebed
    ctx.fillStyle = vGrad(ctx, 0, 740, VH, [[0, '#254048'], [1, '#152730']])
    ctx.beginPath(); ctx.moveTo(-40, VH); ctx.lineTo(-40, 812); ctx.bezierCurveTo(300, 784, 700, 822, 1000, 798); ctx.bezierCurveTo(1240, 780, 1460, 812, 1640, 796); ctx.lineTo(1640, VH); ctx.closePath(); ctx.fill()
    for (const [rx, ry, rw, rh] of [[160, 820, 44, 18], [560, 832, 30, 13], [1080, 816, 40, 16], [1320, 826, 60, 24]]) { ctx.fillStyle = '#2b444c'; ctx.beginPath(); ctx.ellipse(rx, ry, rw, rh, 0, 0, TAU); ctx.fill() }
    for (let i = 0; i < 11; i++) { const bx = 60 + i * 150 + (i % 3) * 22, bh = 80 + (i % 4) * 44, sway = Math.sin(t * 1.1 + i * 1.1) * 15
      ctx.strokeStyle = i % 2 ? 'rgba(48,140,110,0.7)' : 'rgba(60,165,128,0.55)'; ctx.lineWidth = 5 - (i % 3); ctx.lineCap = 'round'
      ctx.beginPath(); ctx.moveTo(bx, 832); ctx.bezierCurveTo(bx - 8, 832 - bh * 0.4, bx + sway * 0.5, 832 - bh * 0.7, bx + sway, 832 - bh); ctx.stroke() }

    // outfall + plume (a water-quality story point)
    ctx.fillStyle = '#46525a'; ctx.beginPath(); ctx.roundRect(-20, 548, 100, 38, 6); ctx.fill()
    ctx.fillStyle = '#1c2429'; ctx.beginPath(); ctx.ellipse(80, 567, 4.4, 13, 0, 0, TAU); ctx.fill()
    for (const pp of s.plume) { pp.life += dt * 0.16; if (pp.life > 1) pp.life -= 1; const q = pp.life
      ctx.fillStyle = `rgba(196,214,206,${(0.16 * (1 - q)).toFixed(3)})`; ctx.beginPath(); ctx.arc(84 + q * 240 + Math.sin(q * 9) * 14, 567 + q * 130 + Math.sin(q * 13) * 10, 4 + q * 15, 0, TAU); ctx.fill() }
    s.hit.push({ x: 40, y: 567, r: 60, story: { name: 'Road-Salt Outfall', latin: 'winter chloride runoff', status: 'invasive', lines: ['Salted roads wash chloride straight into the', 'lake each winter. It stresses fish and insects', 'and lingers for years — the reason we monitor.'] } })

    // sensor station
    ctx.strokeStyle = '#5a6a72'; ctx.lineWidth = 3; ctx.strokeRect(1156, 756, 48, 44)
    ctx.beginPath(); ctx.moveTo(1156, 756); ctx.lineTo(1180, 738); ctx.lineTo(1204, 756); ctx.stroke()
    ctx.fillStyle = '#48565e'; ctx.fillRect(1164, 768, 32, 24)
    const blink = (t % 1.8) < 0.24; ctx.fillStyle = blink ? '#7df5df' : '#256156'; ctx.beginPath(); ctx.arc(1180, 746, 3.4, 0, TAU); ctx.fill()
    if (blink) glow(ctx, 1180, 746, 16, 'rgba(125,245,223,0.5)', 'rgba(125,245,223,0)')
    const ping = (t % 3.2) / 3.2; ctx.strokeStyle = `rgba(125,245,223,${(0.3 * (1 - ping)).toFixed(3)})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(1180, 760, 12 + ping * 110, 0, TAU); ctx.stroke()
    s.hit.push({ x: 1180, y: 760, r: 46, story: { name: 'Continuous Logger', latin: 'the reason we monitor', status: 'indicator', lines: ['Anchored to the bed, it records temperature,', 'conductivity and dissolved oxygen every 15', 'minutes — open data anyone can read.'] } })

    // ── creatures (record hit boxes; draw dim, brightened by ROV light) ──
    for (const c of CREATURES) {
      const pos = creaturePos(c, t)
      const inst = pos.list || [pos]
      for (const q of inst) {
        s.hit.push({ x: q.x, y: q.y, r: c.r, creature: c })
        ctx.save(); ctx.translate(q.x, q.y); ctx.scale((q.face || 1), 1)
        const near = Math.hypot(q.x - rov.x, q.y - rov.y) < 200
        ctx.globalAlpha = near || s.sel === c ? 1 : 0.62
        drawCreature(ctx, c, t)
        ctx.restore()
      }
    }

    // ── ROV pilot + headlight ──
    const target = p.inside ? { x: clamp(p.x, 40, VW - 40), y: clamp(p.y, 90, VH - 70) } : { x: 800 + Math.sin(t * 0.28) * 460, y: 380 + Math.sin(t * 0.42) * 150 }
    const vx = target.x - rov.x, vy = target.y - rov.y
    rov.x += vx * Math.min(1, dt * 2.6); rov.y += vy * Math.min(1, dt * 2.6)
    rov.face = rov.x < target.x - 6 ? 1 : (rov.x > target.x + 6 ? -1 : rov.face)
    rov.prop += dt * (6 + Math.min(30, Math.hypot(vx, vy) * 0.4))

    ctx.save()
    ctx.fillStyle = 'rgba(3,12,24,0.5)'; ctx.fillRect(-200, -200, VW + 400, VH + 400)
    ctx.globalCompositeOperation = 'lighter'
    glow(ctx, rov.x, rov.y, 150, 'rgba(150,205,235,0.16)', 'rgba(150,205,235,0)')
    ctx.save(); ctx.translate(rov.x, rov.y); ctx.scale(rov.face, 1)
    const cg = ctx.createLinearGradient(0, 0, 340, 0); cg.addColorStop(0, 'rgba(190,225,250,0.30)'); cg.addColorStop(0.5, 'rgba(170,215,245,0.12)'); cg.addColorStop(1, 'rgba(170,215,245,0)')
    ctx.fillStyle = cg; ctx.beginPath(); ctx.moveTo(14, -6); ctx.lineTo(340, -150); ctx.lineTo(340, 150); ctx.lineTo(14, 6); ctx.closePath(); ctx.fill()
    ctx.restore(); ctx.restore()

    // creatures caught in the beam re-drawn bright + name tag
    for (const h of s.hit) {
      if (!h.creature) continue
      const dxr = h.x - rov.x
      const inCone = (rov.face > 0 ? dxr > -30 : dxr < 30) && Math.abs(h.y - rov.y) < 210 && Math.abs(dxr) < 360
      if (inCone || Math.hypot(h.x - rov.x, h.y - rov.y) < 150) {
        const c = h.creature, pos = creaturePos(c, t)
        for (const q of (pos.list || [pos])) { ctx.save(); ctx.translate(q.x, q.y); ctx.scale((q.face || 1), 1); drawCreature(ctx, c, t); ctx.restore() }
        // name tag
        ctx.font = '700 13px "DM Sans", system-ui, sans-serif'
        const st = STATUS[c.status], tw = ctx.measureText(c.name).width + 16
        ctx.fillStyle = 'rgba(5,17,29,0.8)'; ctx.strokeStyle = `${st.c}88`; ctx.lineWidth = 1
        ctx.beginPath(); ctx.roundRect(h.x - tw / 2, h.y - h.r * 0.5 - 22, tw, 18, 9); ctx.fill(); ctx.stroke()
        ctx.fillStyle = st.c; ctx.fillText(c.name, h.x - tw / 2 + 8, h.y - h.r * 0.5 - 9)
      }
    }

    // ── ROV: a proper research submersible (elongated hull, conning tower,
    //    portholes, tail fins + shrouded thruster, nose floodlight) ──
    ctx.save(); ctx.translate(rov.x, rov.y); ctx.scale(rov.face, 1); ctx.rotate(Math.sin(t * 1.5) * 0.02)
    ctx.fillStyle = 'rgba(6,18,30,0.4)'; ctx.beginPath(); ctx.ellipse(-2, 24, 40, 6, 0, 0, TAU); ctx.fill()
    // tail fins (X-form) behind the hull
    ctx.fillStyle = '#b7801f'; ctx.strokeStyle = '#7a4e16'; ctx.lineWidth = 1.4
    ctx.beginPath(); ctx.moveTo(-38, -3); ctx.lineTo(-52, -14); ctx.lineTo(-46, -2); ctx.closePath(); ctx.fill(); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(-38, 3); ctx.lineTo(-52, 14); ctx.lineTo(-46, 2); ctx.closePath(); ctx.fill(); ctx.stroke()
    // long torpedo hull
    ctx.fillStyle = '#e2a838'; ctx.strokeStyle = '#8a5a1c'; ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(-44, 0)
    ctx.quadraticCurveTo(-40, -13, -10, -14)
    ctx.quadraticCurveTo(34, -14, 44, -4)
    ctx.quadraticCurveTo(48, 0, 44, 4)
    ctx.quadraticCurveTo(34, 14, -10, 14)
    ctx.quadraticCurveTo(-40, 13, -44, 0)
    ctx.closePath(); ctx.fill(); ctx.stroke()
    // hull shading + waterline stripe
    const hgd = ctx.createLinearGradient(0, -14, 0, 14)
    hgd.addColorStop(0, 'rgba(255,255,255,0.28)'); hgd.addColorStop(0.55, 'rgba(120,80,20,0)'); hgd.addColorStop(1, 'rgba(60,36,8,0.3)')
    ctx.fillStyle = hgd; ctx.fill()
    ctx.strokeStyle = '#c23b2e'; ctx.lineWidth = 2
    ctx.beginPath(); ctx.moveTo(-40, 6); ctx.quadraticCurveTo(0, 9, 42, 5); ctx.stroke()
    // conning tower (sail) on top
    ctx.fillStyle = '#d0982c'; ctx.strokeStyle = '#8a5a1c'; ctx.lineWidth = 1.6
    ctx.beginPath(); ctx.moveTo(-8, -13); ctx.lineTo(-5, -26); ctx.lineTo(10, -26); ctx.lineTo(13, -13); ctx.closePath(); ctx.fill(); ctx.stroke()
    ctx.strokeStyle = '#6a4412'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(2, -26); ctx.lineTo(2, -34); ctx.stroke() // periscope
    ctx.fillStyle = '#7df5df'; ctx.beginPath(); ctx.arc(2, -35, 1.8, 0, TAU); ctx.fill()
    // portholes
    for (const px of [-14, 2, 18]) { ctx.fillStyle = '#0b2233'; ctx.beginPath(); ctx.arc(px, -2, 4, 0, TAU); ctx.fill(); ctx.fillStyle = 'rgba(150,210,240,0.8)'; ctx.beginPath(); ctx.arc(px, -2, 2.6, 0, TAU); ctx.fill(); ctx.strokeStyle = '#8a5a1c'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(px, -2, 4, 0, TAU); ctx.stroke() }
    // nose floodlight housing
    ctx.fillStyle = '#3a4650'; ctx.beginPath(); ctx.arc(44, 0, 5.5, 0, TAU); ctx.fill()
    ctx.fillStyle = '#eaf6ff'; ctx.beginPath(); ctx.arc(45, 0, 3, 0, TAU); ctx.fill()
    // shrouded stern thruster
    ctx.strokeStyle = '#7a4e16'; ctx.lineWidth = 2.4; ctx.beginPath(); ctx.arc(-46, 0, 8, 0, TAU); ctx.stroke()
    ctx.strokeStyle = '#c98a2a'; ctx.lineWidth = 2; ctx.save(); ctx.translate(-46, 0); ctx.rotate(rov.prop); for (let i = 0; i < 3; i++) { ctx.rotate(TAU / 3); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -6.5); ctx.stroke() } ctx.restore()
    ctx.restore()
    if (Math.random() < dt * 8) s.bubbles.push({ x: rov.x - 30 * rov.face, y: rov.y + 4, v: 40, r: 1.4 + Math.random() * 2, wob: Math.random() * TAU })
    if (s.bubbles.length > 50) s.bubbles.splice(0, s.bubbles.length - 50)
    for (const b of s.bubbles) { b.y -= b.v * dt; b.x += Math.sin(t * 2 + b.wob) * 8 * dt; if (b.y < 24) { b.y = VH + 10; b.x = Math.random() * VW }
      ctx.strokeStyle = 'rgba(210,240,255,0.35)'; ctx.lineWidth = 1.1; ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, TAU); ctx.stroke() }

    // ── click handling: pick the nearest hit under the cursor ──
    if (p.click) {
      const cl = p.click; p.click = null
      let best = null, bd = 1e9
      for (const h of s.hit) { const d = Math.hypot(cl.x - h.x, cl.y - h.y); if (d < h.r && d < bd) { best = h; bd = d } }
      const key = best && (best.creature || best.story)
      s.sel = key && s.sel !== key ? key : null
      s.selT = 0
    }

    // ── info bubble ──
    if (s.sel) {
      s.selT = Math.min(1, s.selT + dt * 4)
      // find its live position
      let hx = VW / 2, hy = VH / 2
      for (const h of s.hit) { if (h.creature === s.sel || h.story === s.sel) { hx = h.x; hy = h.y; break } }
      speciesBubble(ctx, s.sel, hx, hy, s.selT)
    }

    const vg = ctx.createRadialGradient(VW / 2, VH * 0.4, VH * 0.42, VW / 2, VH * 0.45, VH)
    vg.addColorStop(0, 'rgba(2,10,20,0)'); vg.addColorStop(1, 'rgba(2,10,20,0.55)')
    ctx.fillStyle = vg; ctx.fillRect(0, 0, VW, VH)
  },
}
