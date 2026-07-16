/**
 * welcomeEngine — a tiny zero-dependency Canvas2D "game engine" for the
 * SOURCE Water landing scenes.
 *
 * It gives each scene: a DPI-aware canvas, a fixed virtual coordinate space
 * (1600×900) mapped with "cover" scaling to any viewport, a requestAnimation-
 * Frame loop with delta-time, reusable particle systems, value-noise for
 * organic motion, and helpers for procedural rippling water. Scenes are just
 * a draw(ctx, t, dt, W, H) function plus their own particle state.
 *
 * Respects prefers-reduced-motion and the global `sw-no-anim` kill-switch by
 * rendering a single frozen frame instead of animating.
 */

export const VW = 1600
export const VH = 900

// ── value noise (smooth, seedable) ────────────────────────────────────────
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
export function makeNoise(seed = 1) {
  const rnd = mulberry32(seed)
  const perm = new Float32Array(512)
  for (let i = 0; i < 512; i++) perm[i] = rnd()
  const fade = (t) => t * t * (3 - 2 * t)
  return function noise1(x) {
    const xi = Math.floor(x) & 511
    const xf = x - Math.floor(x)
    const a = perm[xi], b = perm[(xi + 1) & 511]
    return a + (b - a) * fade(xf)
  }
}

// ── generic particle pool ─────────────────────────────────────────────────
export function makeParticles(n, init) {
  const arr = []
  for (let i = 0; i < n; i++) arr.push(init(i))
  return arr
}

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v)
export const lerp = (a, b, t) => a + (b - a) * t

// ── the engine mount ──────────────────────────────────────────────────────
/**
 * mountScene(canvas, scene)
 *   scene = {
 *     setup(env) -> state           // env: {rnd, noise, W, H}
 *     draw(ctx, t, dt, state, env)  // render one frame
 *   }
 * Returns a cleanup function.
 */
export function mountScene(canvas, scene, opts = {}) {
  const vw = scene.vw || VW
  const vh = scene.vh || VH
  const ctx = canvas.getContext('2d', { alpha: scene.alpha === true })
  const seed = opts.seed || 1
  const rnd = mulberry32(seed)
  const noise = makeNoise(seed)
  const env = { rnd, noise, W: vw, H: vh }
  const state = scene.setup ? scene.setup(env) : {}

  let raf = 0, running = true, last = performance.now(), t0 = last
  let scale = 1, offX = 0, offY = 0, dpr = 1

  // pointer in VIRTUAL coordinates (for parallax, ripples, hover previews)
  const pointer = { x: -9999, y: -9999, moved: 0, inside: false }
  env.pointer = pointer

  // The landing scenes must always visibly move. The app's `sw-no-anim`
  // toggle and the OS reduced-motion flag downgrade to a calmer, slower
  // "gentle" mode instead of freezing the frame.
  const gentle = () =>
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ||
    document.documentElement.classList.contains('sw-no-anim')

  function resize() {
    const rect = canvas.getBoundingClientRect()
    dpr = Math.min(window.devicePixelRatio || 1, 2)
    const cw = Math.max(1, Math.round(rect.width * dpr))
    const ch = Math.max(1, Math.round(rect.height * dpr))
    if (canvas.width !== cw || canvas.height !== ch) {
      canvas.width = cw; canvas.height = ch
    }
    // "cover" fit of the virtual space
    scale = Math.max(cw / vw, ch / vh)
    offX = (cw - vw * scale) / 2
    offY = (ch - vh * scale) / 2
  }
  resize()
  const ro = new ResizeObserver(resize)
  ro.observe(canvas)

  // pointer listeners on the section that hosts the canvas, so overlays
  // (hero text, buttons) don't block the living world underneath
  const host = opts.pointerHost || canvas.parentElement || canvas
  function onMove(e) {
    const rect = canvas.getBoundingClientRect()
    pointer.x = ((e.clientX - rect.left) * dpr - offX) / scale
    pointer.y = ((e.clientY - rect.top) * dpr - offY) / scale
    pointer.moved = performance.now()
    pointer.inside = true
  }
  function onLeave() { pointer.inside = false; pointer.x = -9999; pointer.y = -9999 }
  host.addEventListener('pointermove', onMove, { passive: true })
  host.addEventListener('pointerleave', onLeave, { passive: true })

  let tAcc = 0 // scene time accumulator (lets gentle mode slow the world)
  function frame(now) {
    if (!running) return
    const ts = gentle() ? 0.4 : 1
    const dt = Math.min(0.05, (now - last) / 1000) * ts
    last = now
    tAcc += dt
    env.gentle = ts < 1
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.setTransform(scale, 0, 0, scale, offX, offY)
    scene.draw(ctx, tAcc, dt, state, env)
    raf = requestAnimationFrame(frame)
  }
  raf = requestAnimationFrame(frame)

  function onVis() {
    if (document.hidden) { running = false; cancelAnimationFrame(raf) }
    else { running = true; last = performance.now(); raf = requestAnimationFrame(frame) }
  }
  document.addEventListener('visibilitychange', onVis)

  return () => {
    running = false
    cancelAnimationFrame(raf)
    ro.disconnect()
    document.removeEventListener('visibilitychange', onVis)
    host.removeEventListener('pointermove', onMove)
    host.removeEventListener('pointerleave', onLeave)
  }
}

// ── shared drawing helpers ────────────────────────────────────────────────

// vertical multi-stop gradient
export function vGrad(ctx, x, y0, y1, stops) {
  const g = ctx.createLinearGradient(x, y0, x, y1)
  for (const [o, c] of stops) g.addColorStop(o, c)
  return g
}

// soft radial glow blob
export function glow(ctx, x, y, r, inner, outer) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r)
  g.addColorStop(0, inner)
  g.addColorStop(1, outer)
  ctx.fillStyle = g
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill()
}

/**
 * Procedural rippling water surface. Draws a reflective body from `top` down
 * to `bottom`, mirroring a light-source glow column and animating specular
 * bands + a shimmering sun column. Cheap enough for 60fps at virtual res.
 */
export function drawWater(ctx, t, opts) {
  const { top, bottom, left = 0, right = VW, grad, sunX, sunTop = '#ffe4a0', noise } = opts
  ctx.fillStyle = grad
  ctx.fillRect(left, top, right - left, bottom - top)

  // horizon bloom
  const hb = ctx.createLinearGradient(0, top, 0, top + 60)
  hb.addColorStop(0, 'rgba(255,238,190,0.5)')
  hb.addColorStop(1, 'rgba(255,238,190,0)')
  ctx.fillStyle = hb
  ctx.fillRect(left, top, right - left, 60)

  // reflected sun column — stacked wobbling ellipses fading downward
  if (sunX != null) {
    ctx.save()
    ctx.globalCompositeOperation = 'lighter'
    const rows = 26
    for (let i = 0; i < rows; i++) {
      const p = i / rows
      const y = top + p * (bottom - top) * 0.78
      const wob = Math.sin(t * 2.2 + i * 0.9) * (6 + i * 1.6)
      const w = (70 + i * 10) * (1 - p * 0.25)
      const a = (1 - p) * 0.16 * (0.7 + 0.3 * Math.sin(t * 3 + i))
      ctx.fillStyle = `rgba(255,226,150,${a.toFixed(3)})`
      ctx.beginPath()
      ctx.ellipse(sunX + wob, y, w, 4 + i * 0.3, 0, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.restore()
  }

  // drifting specular wave streaks across the whole surface
  ctx.save()
  ctx.lineCap = 'round'
  const bands = 7
  for (let b = 0; b < bands; b++) {
    const yb = lerp(top + 30, bottom - 20, b / (bands - 1))
    const drift = (t * (8 + b * 3)) % 400
    ctx.strokeStyle = `rgba(240,248,255,${0.05 + 0.05 * (1 - b / bands)})`
    ctx.lineWidth = 2 + b * 0.3
    ctx.beginPath()
    for (let x = left - 400; x < right + 400; x += 140) {
      const px = x + drift
      const yy = yb + Math.sin((px) * 0.02 + t * 1.5 + b) * (3 + b)
      ctx.moveTo(px, yy)
      ctx.quadraticCurveTo(px + 40, yy - 5, px + 80, yy)
    }
    ctx.stroke()
  }
  ctx.restore()
}
