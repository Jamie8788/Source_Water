/**
 * welcomePeople — a properly illustrated 2.5D character painter for the
 * landing hero. Replaces the old stick/stroke rig. Figures are built from
 * volumetric, cylinder-shaded limbs (screen-consistent sunset light from the
 * upper-right), a tailored jacket torso with collar and rim light, articulated
 * legs/arms via forward kinematics, and a shaded head with hair, ear, brow and
 * eyes. Poses: stand / walk / kneel / sit, plus free arm angles for actions
 * (sample, cast, tablet, binoculars, paddle).
 *
 * Canonical figure is 100 units tall (feet at origin, up = -y); pass `h` to
 * scale. `flip` mirrors facing while keeping the light coming from the same
 * screen side. All pure Canvas2D.
 */
const TAU = Math.PI * 2

function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16)
  const r = Math.max(0, Math.min(255, (n >> 16) + amt))
  const g = Math.max(0, Math.min(255, ((n >> 8) & 255) + amt))
  const b = Math.max(0, Math.min(255, (n & 255) + amt))
  return `rgb(${r},${g},${b})`
}

// palette presets — varied, cohesive sunset-friendly wardrobe
export const WARDROBE = [
  { jacket: '#c65a34', pants: '#33405a', shirt: '#e8ddc8' },
  { jacket: '#3d6f8f', pants: '#2c3444', shirt: '#dfe6ec' },
  { jacket: '#d99a3a', pants: '#4a3f31', shirt: '#f0e8d6' },
  { jacket: '#5a7d54', pants: '#38321f', shirt: '#e2e8d6' },
  { jacket: '#8a4a5e', pants: '#2f3540', shirt: '#efd9dd' },
  { jacket: '#4a5a6a', pants: '#33404a', shirt: '#dde6ea' },
  { jacket: '#b0552e', pants: '#3a4658', shirt: '#ecdcc4' },
  { jacket: '#6a5a8a', pants: '#2c2a3a', shirt: '#e4dced' },
]
export const SKINS = ['#e2ac83', '#c78e63', '#a06a44', '#7c5236', '#e8bd95', '#95643f']
export const HAIRS = ['#241a12', '#4a3320', '#12100e', '#6a4a2a', '#8a6a44', '#c9c4ba', '#a89a86']

/**
 * drawPerson(ctx, o)
 * o = {
 *   x, y, h=100, flip, skin, hair, hairStyle, jacket, pants, shirt, hat, vest,
 *   pose: { type:'stand'|'walk'|'kneel'|'sit', phase, k },
 *   armL, armR: { s, e }   // shoulder + elbow angles (rad), forward-positive
 *   headTurn, // -1..1 look direction
 *   t,        // time (for tiny idle life)
 * }
 */
export function drawPerson(ctx, o) {
  const s = (o.h || 100) / 100
  const F = o.flip ? -1 : 1
  const cx = o.x, cy = o.y
  const t = o.t || 0
  const skin = o.skin || SKINS[0]
  const hair = o.hair || HAIRS[0]
  const jacket = o.jacket || WARDROBE[0].jacket
  const pants = o.pants || WARDROBE[0].pants
  const shirt = o.shirt || WARDROBE[0].shirt
  const pose = o.pose || { type: 'stand' }
  // ── idle life: every figure breathes, shifts weight and glances around,
  //    each on its own phase so the crowd never looks frozen or synchronised ──
  const ph0 = cx * 0.037 + cy * 0.021
  const breath = Math.sin(t * 1.6 + ph0) * 0.4
  const idleBreath = Math.sin(t * 1.15 + ph0) * 0.7      // chest rise/fall
  const idleSway = Math.sin(t * 0.62 + ph0 * 1.7) * 0.022 // weight shift
  const idleGlance = Math.sin(t * 0.37 + ph0 * 2.3)       // looks around
  const idleArm = Math.sin(t * 0.83 + ph0 * 1.3) * 0.07   // hands never dead-still

  // local→screen
  let bobY = 0 // set by the walk pose; lifts the whole figure per stride
  const X = (lx) => cx + F * lx * s
  const Y = (ly) => cy - bobY + ly * s
  const W = (w) => w * s

  // volumetric cylinder-shaded limb between local points, round caps
  const limb = (lax, lay, lbx, lby, wa, wb, col) => {
    const ax = X(lax), ay = Y(lay), bx = X(lbx), by = Y(lby)
    const WA = W(wa), WB = W(wb)
    const dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy) || 1
    const nx = -dy / len, ny = dx / len
    ctx.beginPath()
    ctx.arc(ax, ay, WA, Math.atan2(ny, nx), Math.atan2(-ny, -nx))
    ctx.arc(bx, by, WB, Math.atan2(-ny, -nx), Math.atan2(ny, nx))
    ctx.closePath()
    const mx = (ax + bx) / 2, my = (ay + by) / 2, ww = (WA + WB) * 1.3
    const g = ctx.createLinearGradient(mx - ww, my, mx + ww, my)
    g.addColorStop(0, shade(col, -30)); g.addColorStop(0.5, col); g.addColorStop(1, shade(col, 22))
    ctx.fillStyle = g; ctx.fill()
  }
  const ball = (lx, ly, r, col) => {
    const bx = X(lx), by = Y(ly), R = W(r)
    const g = ctx.createRadialGradient(bx + R * 0.4, by - R * 0.4, R * 0.2, bx, by, R)
    g.addColorStop(0, shade(col, 26)); g.addColorStop(1, shade(col, -24))
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(bx, by, R, 0, TAU); ctx.fill()
  }

  // ── one continuous, smoothly-bowed leg (NO hard knee joint) ──
  const curvedLeg = (lax, lay, lbx, lby, wa, wb, col, bow) => {
    const ax = X(lax), ay = Y(lay), bx = X(lbx), by = Y(lby)
    const WA = W(wa), WB = W(wb), WM = W((wa + wb) / 2)
    const dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy) || 1
    const nx = -dy / len, ny = dx / len
    const cxp = (ax + bx) / 2 + nx * W(bow) * F, cyp = (ay + by) / 2 + ny * W(bow) * F
    ctx.beginPath()
    ctx.arc(ax, ay, WA, Math.atan2(-ny, -nx), Math.atan2(ny, nx))
    ctx.quadraticCurveTo(cxp + nx * WM, cyp + ny * WM, bx + nx * WB, by + ny * WB)
    ctx.arc(bx, by, WB, Math.atan2(ny, nx), Math.atan2(-ny, -nx))
    ctx.quadraticCurveTo(cxp - nx * WM, cyp - ny * WM, ax - nx * WA, ay - ny * WA)
    ctx.closePath()
    const mx = (ax + bx) / 2, ww = (WA + WB) * 1.4
    const g = ctx.createLinearGradient(mx - ww, ay, mx + ww, ay)
    g.addColorStop(0, shade(col, -30)); g.addColorStop(0.5, col); g.addColorStop(1, shade(col, 20))
    ctx.fillStyle = g; ctx.fill()
  }

  // ── forward kinematics ──
  const seg = (x, y, a, l) => [x + Math.sin(a) * l, y + Math.cos(a) * l]

  // joint bases
  const hipY = -46, shY = -78
  const hipDX = 4
  let legs // [{hip,knee,ankle,angles}]
  let armLA = o.armL, armRA = o.armR
  let torsoLean = 0, hipDrop = 0, walkBob = 0

  if (pose.type === 'walk') {
    const ph = pose.phase || 0
    // pendulum walk: each leg is ONE smooth limb swinging from the hip; a
    // small forward bow reads as a soft knee, never a mechanical joint.
    const LEGLEN = 46
    const mk = (p, hipX) => {
      const thigh = Math.sin(p) * 0.3
      const lift = Math.max(0, Math.sin(p - 0.5)) * 4 // foot clears on fore-swing
      const ax = hipX + Math.sin(thigh) * LEGLEN
      const ay = hipY + Math.cos(thigh) * LEGLEN - lift
      return { hip: [hipX, hipY], ankle: [ax, ay], bow: 2 + Math.max(0, thigh) * 8 }
    }
    legs = [mk(ph + Math.PI, -2.6), mk(ph, 2.6)] // far leg first
    torsoLean = 0.04
    walkBob = Math.abs(Math.sin(ph)) * 2.0
    if (!armRA) armRA = { s: Math.sin(ph + Math.PI) * 0.34, e: 0.18 }
    if (!armLA) armLA = { s: Math.sin(ph) * 0.34, e: 0.18 }
  } else if (pose.type === 'kneel') {
    // squat/crouch: hips low, both feet planted, shins angled back under the
    // body — reads clearly as crouching to sample (no broken joints).
    const k = pose.k ?? 1
    const mk = (hipX, out) => {
      const thigh = out * 0.5 * k
      const knee = seg(hipX, hipY, thigh, 22)
      const ankle = seg(knee[0], knee[1], -thigh * 0.55, 21)
      return { hip: [hipX, hipY], knee, ankle }
    }
    legs = [mk(-4, -1), mk(4, 1)]
    hipDrop = 20 * k
    torsoLean = 0.16 * k
    if (!armRA) armRA = { s: 0.6, e: 0.3 }
    if (!armLA) armLA = { s: 0.5, e: 0.3 }
  } else if (pose.type === 'sit') {
    // seated on a surface at o.y: the pelvis rests ON the seat, thighs run
    // forward, shins drop so the feet hang to the ground BELOW the seat.
    const kneeF = seg(0, hipY, 1.15, 20)
    const ankF = seg(kneeF[0], kneeF[1], 0.16, 26)
    const kneeB = seg(-3, hipY, 1.05, 20)
    const ankB = seg(kneeB[0], kneeB[1], 0.12, 26)
    legs = [{ hip: [-3, hipY], knee: kneeB, ankle: ankB }, { hip: [0, hipY], knee: kneeF, ankle: ankF }]
    hipDrop = 46 // lower the pelvis onto the origin so the butt sits on the seat
    if (!armRA) armRA = { s: 0.3, e: 0.4 }
    if (!armLA) armLA = { s: 0.25, e: 0.4 }
  } else { // stand — single straight pendulum legs, slight stance
    const mk = (dx, sw) => ({ hip: [dx, hipY], ankle: [dx + Math.sin(sw) * 46, hipY + Math.cos(sw) * 46], bow: 1.5 })
    legs = [mk(-hipDX, -0.05), mk(hipDX, 0.05)]
    if (!armRA) armRA = { s: 0.12 + breath * 0.02 + idleArm, e: 0.16 }
    if (!armLA) armLA = { s: 0.1 - idleArm * 0.8, e: 0.16 }
  }

  bobY = walkBob * s + (pose.type === 'walk' ? 0 : idleBreath * s * 0.4)
  if (pose.type !== 'walk') torsoLean += idleSway
  const shByAdj = shY + hipDrop
  const hipYAdj = hipY + hipDrop

  // ── cast shadow (soft, long, to the shadow side) ──
  // seated figures anchor at the seat, not the ground, so a ground shadow
  // under the pelvis would read as floating — callers add their own.
  if (pose.type !== 'sit') {
    ctx.save()
    ctx.fillStyle = 'rgba(60,40,20,0.22)'
    ctx.beginPath()
    ctx.ellipse(X(-6), Y(1), W(20), W(4.5), 0, 0, TAU)
    ctx.fill()
    ctx.restore()
  }

  // ── FAR leg (index 0) ──
  const drawLeg = (L, far) => {
    const pcol = far ? shade(pants, -20) : pants
    if (L.knee) { // bent leg only for sit / crouch (stationary poses)
      limb(L.hip[0], L.hip[1] + hipDrop, L.knee[0], L.knee[1] + hipDrop, 4.8, 4.0, pcol)
      limb(L.knee[0], L.knee[1] + hipDrop, L.ankle[0], L.ankle[1] + hipDrop, 4.0, 3.0, pcol)
    } else { // single smooth pendulum leg (walk / stand) — no joint
      curvedLeg(L.hip[0], L.hip[1] + hipDrop, L.ankle[0], L.ankle[1] + hipDrop, 5.0, 3.3, pcol, L.bow || 0)
    }
    // shoe
    const shoeCol = far ? '#2a2018' : '#332619'
    ctx.save()
    const ax = X(L.ankle[0]), ay = Y(L.ankle[1] + hipDrop)
    ctx.fillStyle = shoeCol
    ctx.beginPath(); ctx.ellipse(ax + F * W(3), ay + W(1), W(6), W(3.4), 0, 0, TAU); ctx.fill()
    ctx.fillStyle = 'rgba(255,220,160,0.22)'
    ctx.beginPath(); ctx.ellipse(ax + F * W(2), ay - W(0.6), W(3), W(1.2), 0, 0, TAU); ctx.fill()
    ctx.restore()
  }
  drawLeg(legs[0], true)

  // far arm (behind torso)
  const drawArm = (A, far) => {
    const jc = far ? shade(jacket, -26) : jacket
    const sx = far ? -10 : 10
    const elbow = seg(sx, shByAdj + 3, A.s, 16)
    const wrist = seg(elbow[0], elbow[1], A.s + A.e, 14)
    limb(sx, shByAdj + 3, elbow[0], elbow[1], 3.8, 3.1, jc)
    // cuff + hand
    limb(elbow[0], elbow[1], wrist[0], wrist[1], 3.1, 2.7, jc)
    ball(wrist[0], wrist[1], 2.9, skin)
    return wrist
  }
  drawArm(armLA, true)

  // ── TORSO (jacket) ──
  const waistHW = 8.5, shHW = 12.5
  const tx = (v) => v
  ctx.beginPath()
  ctx.moveTo(X(tx(-waistHW)), Y(hipYAdj + 2))
  ctx.quadraticCurveTo(X(-shHW - 1), Y((shByAdj + hipYAdj) / 2), X(-shHW), Y(shByAdj + 2))
  ctx.quadraticCurveTo(X(-shHW * 0.5), Y(shByAdj - 4), X(0), Y(shByAdj - 4))
  ctx.quadraticCurveTo(X(shHW * 0.5), Y(shByAdj - 4), X(shHW), Y(shByAdj + 2))
  ctx.quadraticCurveTo(X(shHW + 1), Y((shByAdj + hipYAdj) / 2), X(waistHW), Y(hipYAdj + 2))
  ctx.closePath()
  const tg = ctx.createLinearGradient(X(-shHW), 0, X(shHW), 0)
  tg.addColorStop(0, shade(jacket, -30)); tg.addColorStop(0.5, jacket); tg.addColorStop(1, shade(jacket, 20))
  ctx.fillStyle = tg; ctx.fill()
  // vertical form shadow low
  const tvg = ctx.createLinearGradient(0, Y(shByAdj), 0, Y(hipYAdj))
  tvg.addColorStop(0, 'rgba(255,235,200,0.12)'); tvg.addColorStop(1, 'rgba(20,14,8,0.16)')
  ctx.fillStyle = tvg; ctx.fill()
  // collar + zip
  ctx.strokeStyle = shade(jacket, -34); ctx.lineWidth = W(1.4)
  ctx.beginPath(); ctx.moveTo(X(0), Y(shByAdj - 3)); ctx.lineTo(X(0), Y(hipYAdj)); ctx.stroke()
  ctx.fillStyle = shade(shirt, 0)
  ctx.beginPath(); ctx.moveTo(X(-3.4), Y(shByAdj - 3)); ctx.lineTo(X(0), Y(shByAdj + 5)); ctx.lineTo(X(3.4), Y(shByAdj - 3)); ctx.closePath(); ctx.fill()
  // rim light (sun side edge)
  ctx.strokeStyle = 'rgba(255,214,150,0.6)'; ctx.lineWidth = W(1.5)
  ctx.beginPath(); ctx.moveTo(X(shHW - 0.5), Y(shByAdj + 3)); ctx.quadraticCurveTo(X(shHW + 0.5), Y((shByAdj + hipYAdj) / 2), X(waistHW - 0.5), Y(hipYAdj)); ctx.stroke()

  // hi-vis vest overlay
  if (o.vest) {
    ctx.beginPath()
    ctx.moveTo(X(-waistHW + 1.5), Y(hipYAdj + 1))
    ctx.quadraticCurveTo(X(-shHW + 1), Y((shByAdj + hipYAdj) / 2), X(-shHW + 2.5), Y(shByAdj + 1))
    ctx.lineTo(X(-3.5), Y(shByAdj - 1)); ctx.lineTo(X(-3.5), Y(hipYAdj + 1)); ctx.closePath()
    ctx.moveTo(X(waistHW - 1.5), Y(hipYAdj + 1))
    ctx.quadraticCurveTo(X(shHW - 1), Y((shByAdj + hipYAdj) / 2), X(shHW - 2.5), Y(shByAdj + 1))
    ctx.lineTo(X(3.5), Y(shByAdj - 1)); ctx.lineTo(X(3.5), Y(hipYAdj + 1)); ctx.closePath()
    ctx.fillStyle = '#f2c832'; ctx.fill()
    ctx.strokeStyle = 'rgba(230,240,245,0.9)'; ctx.lineWidth = W(1.6)
    ctx.beginPath(); ctx.moveTo(X(-shHW + 2), Y(shByAdj + 8)); ctx.lineTo(X(-4), Y(shByAdj + 7)); ctx.moveTo(X(4), Y(shByAdj + 7)); ctx.lineTo(X(shHW - 2), Y(shByAdj + 8)); ctx.stroke()
  }

  // near leg + near arm (in front)
  drawLeg(legs[1], false)
  const nearWrist = drawArm(armRA, false)

  // ── NECK + HEAD ──
  const ht = (o.headTurn || 0) + idleGlance * 0.5
  const hx = ht * 2
  const hcy = shByAdj - 13
  // neck
  ctx.fillStyle = shade(skin, -14)
  ctx.beginPath(); ctx.moveTo(X(-3), Y(shByAdj - 2)); ctx.lineTo(X(-2.4), Y(shByAdj - 8)); ctx.lineTo(X(2.4 + hx), Y(shByAdj - 8)); ctx.lineTo(X(3), Y(shByAdj - 2)); ctx.closePath(); ctx.fill()
  // head
  const headX = X(hx), headY = Y(hcy)
  const hg = ctx.createRadialGradient(headX + W(3), headY - W(3), W(1), headX, headY, W(8.8))
  hg.addColorStop(0, shade(skin, 24)); hg.addColorStop(0.65, skin); hg.addColorStop(1, shade(skin, -26))
  ctx.fillStyle = hg
  ctx.beginPath(); ctx.ellipse(headX, headY, W(7.5), W(8.7), 0, 0, TAU); ctx.fill()
  // jaw taper (chin)
  ctx.beginPath(); ctx.moveTo(X(hx - 5.5), Y(hcy + 4)); ctx.quadraticCurveTo(X(hx + 1), Y(hcy + 10), X(hx + 6), Y(hcy + 3.5)); ctx.quadraticCurveTo(X(hx + 3), Y(hcy + 8), X(hx - 2), Y(hcy + 8)); ctx.quadraticCurveTo(X(hx - 4.5), Y(hcy + 7), X(hx - 5.5), Y(hcy + 4)); ctx.closePath(); ctx.fillStyle = hg; ctx.fill()
  // ear (back side)
  ctx.fillStyle = shade(skin, -6)
  ctx.beginPath(); ctx.ellipse(X(hx - 6.8), Y(hcy + 0.5), W(1.8), W(2.5), 0, 0, TAU); ctx.fill()
  // hair
  drawHair(ctx, o.hairStyle || 'short', hair, X, Y, W, hx, hcy, F)
  // face features (brow + eyes), facing +x
  ctx.fillStyle = 'rgba(40,26,18,0.55)'
  ctx.beginPath(); ctx.ellipse(X(hx + 3.4), Y(hcy - 0.5), W(1.1), W(1.5), 0, 0, TAU); ctx.fill() // front eye
  ctx.beginPath(); ctx.ellipse(X(hx + 0.2), Y(hcy - 0.5), W(1), W(1.4), 0, 0, TAU); ctx.fill() // far eye
  ctx.strokeStyle = shade(skin, -30); ctx.lineWidth = W(0.8)
  ctx.beginPath(); ctx.moveTo(X(hx + 5), Y(hcy + 2.5)); ctx.quadraticCurveTo(X(hx + 6.4), Y(hcy + 3.4), X(hx + 5.4), Y(hcy + 4.6)); ctx.stroke() // nose/jaw hint
  // warm sun bounce on cheek
  ctx.fillStyle = 'rgba(255,206,150,0.22)'
  ctx.beginPath(); ctx.ellipse(X(hx + 4), Y(hcy + 2), W(2.4), W(2.2), 0, 0, TAU); ctx.fill()

  // hat over hair
  if (o.hat && o.hat !== 'none') drawHat(ctx, o.hat, X, Y, W, hx, hcy, F)

  return { nearWrist: { x: X(nearWrist[0]), y: Y(nearWrist[1]) }, head: { x: headX, y: headY } }
}

function drawHair(ctx, style, hair, X, Y, W, hx, hcy, F) {
  ctx.fillStyle = hair
  if (style === 'bald') return
  if (style === 'short') {
    ctx.beginPath(); ctx.ellipse(X(hx - 0.5), Y(hcy - 3.5), W(8.4), W(7.5), 0, Math.PI * 1.02, TAU * 1.0); ctx.fill()
    ctx.beginPath(); ctx.moveTo(X(hx - 8), Y(hcy - 2)); ctx.quadraticCurveTo(X(hx - 8.5), Y(hcy - 9), X(hx + 2), Y(hcy - 9.5)); ctx.quadraticCurveTo(X(hx + 6.5), Y(hcy - 8), X(hx + 6.8), Y(hcy - 3)); ctx.quadraticCurveTo(X(hx + 3), Y(hcy - 6), X(hx - 2), Y(hcy - 5.5)); ctx.quadraticCurveTo(X(hx - 6), Y(hcy - 5), X(hx - 8), Y(hcy - 2)); ctx.closePath(); ctx.fill()
  } else if (style === 'long') {
    ctx.beginPath(); ctx.ellipse(X(hx - 1), Y(hcy - 2), W(9), W(9), 0, Math.PI * 0.86, TAU * 1.02); ctx.fill()
    ctx.beginPath(); ctx.moveTo(X(hx - 8), Y(hcy - 3)); ctx.quadraticCurveTo(X(hx - 11), Y(hcy + 10), X(hx - 6), Y(hcy + 16)); ctx.lineTo(X(hx - 2), Y(hcy + 14)); ctx.quadraticCurveTo(X(hx - 5), Y(hcy + 4), X(hx - 4), Y(hcy - 4)); ctx.closePath(); ctx.fill()
  } else if (style === 'bun') {
    ctx.beginPath(); ctx.ellipse(X(hx - 0.5), Y(hcy - 3.5), W(8.4), W(7.4), 0, Math.PI, TAU); ctx.fill()
    ctx.beginPath(); ctx.arc(X(hx - 7.5), Y(hcy - 7), W(4), 0, TAU); ctx.fill()
  } else if (style === 'grey') {
    ctx.fillStyle = '#cdc7bb'
    ctx.beginPath(); ctx.ellipse(X(hx - 0.5), Y(hcy - 3), W(8.4), W(7.2), 0, Math.PI * 0.94, TAU); ctx.fill()
  } else if (style === 'braid') {
    ctx.beginPath(); ctx.ellipse(X(hx - 0.5), Y(hcy - 3.5), W(8.4), W(7.4), 0, Math.PI, TAU); ctx.fill()
    ctx.beginPath(); ctx.moveTo(X(hx - 6), Y(hcy - 2)); ctx.quadraticCurveTo(X(hx - 9), Y(hcy + 12), X(hx - 6), Y(hcy + 20)); ctx.lineTo(X(hx - 3), Y(hcy + 19)); ctx.quadraticCurveTo(X(hx - 5), Y(hcy + 6), X(hx - 3), Y(hcy - 3)); ctx.closePath(); ctx.fill()
    ctx.strokeStyle = 'rgba(20,14,10,0.4)'; ctx.lineWidth = W(0.8)
    for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(X(hx - 8 + i), Y(hcy + 4 + i * 5)); ctx.lineTo(X(hx - 4 - i), Y(hcy + 6 + i * 5)); ctx.stroke() }
  }
}

function drawHat(ctx, hat, X, Y, W, hx, hcy, F) {
  if (hat === 'cap') {
    ctx.fillStyle = '#324152'
    ctx.beginPath(); ctx.ellipse(X(hx - 0.5), Y(hcy - 5.5), W(8.2), W(6), 0, Math.PI, TAU); ctx.fill()
    ctx.beginPath(); ctx.moveTo(X(hx + 3), Y(hcy - 5.5)); ctx.quadraticCurveTo(X(hx + 12), Y(hcy - 5), X(hx + 12), Y(hcy - 3.5)); ctx.quadraticCurveTo(X(hx + 6), Y(hcy - 4.5), X(hx + 3), Y(hcy - 4)); ctx.closePath(); ctx.fill()
  } else if (hat === 'sun') {
    ctx.fillStyle = '#d8c088'
    ctx.beginPath(); ctx.ellipse(X(hx), Y(hcy - 6), W(15), W(4.4), 0, 0, TAU); ctx.fill()
    ctx.fillStyle = '#c2a868'
    ctx.beginPath(); ctx.ellipse(X(hx), Y(hcy - 9), W(7), W(5.5), 0, Math.PI, TAU); ctx.fill()
    ctx.strokeStyle = '#8a6f3a'; ctx.lineWidth = W(1.4)
    ctx.beginPath(); ctx.ellipse(X(hx), Y(hcy - 6.5), W(7), W(2), 0, 0, Math.PI); ctx.stroke()
  } else if (hat === 'toque') {
    ctx.fillStyle = '#b0452e'
    ctx.beginPath(); ctx.ellipse(X(hx - 0.5), Y(hcy - 6), W(8.4), W(6.5), 0, Math.PI, TAU); ctx.fill()
    ctx.fillStyle = '#e8ddc8'
    ctx.beginPath(); ctx.ellipse(X(hx - 0.5), Y(hcy - 4.5), W(8.6), W(2.4), 0, 0, TAU); ctx.fill()
    ctx.fillStyle = '#e8ddc8'; ctx.beginPath(); ctx.arc(X(hx - 0.5), Y(hcy - 12.5), W(2.4), 0, TAU); ctx.fill()
  }
}
