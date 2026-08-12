/**
 * realRigScene — isolated three.js overlay that renders the three EXPERIMENT
 * NPCs (shoreline walker, dock fisher, DO-vial researcher) as real rigged
 * characters playing real skeletal-animation clips, aligned to the hero's
 * virtual 1600×900 "cover" coordinate space so they land exactly where the
 * procedural NPCs stood.
 *
 * Framework-agnostic on purpose: `mountRealRig(canvas)` mirrors the existing
 * welcomeEngine.mountScene(...) pattern so it can be unit-rendered headlessly
 * and wrapped by a thin React component. Returns a cleanup function.
 *
 * Asset: /rig-assets/RobotExpressive.glb — CC0 (Tomás Laulhé, modified by Don
 * McCurdy). A neutral stylized humanoid with hand-authored Walking / Idle /
 * Wave clips. Used purely to judge whether real skeletal animation fixes the
 * puppet-arm / stiff-knee / foot-slide problems before committing to a full
 * character pipeline. See hero-rig/ASSETS.md for the manifest.
 */
import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js'

const VW = 1600, VH = 900
const shoreY = (x) =>
  575 + Math.pow(Math.min(Math.max(x, 0), 1600) / 1600, 1.22) * 315 + Math.sin(x * 0.004) * 10

// the three test anchors, in the hero's virtual coordinates (feet position)
const WALK_X0 = 300, WALK_X1 = 1060 // shoreline walk path (matches old family stroll)
const FISHER = { x: 1012, y: 596 }
const RESEARCHER = { x: 620, y: shoreY(620) + 20 }

export function mountRealRig(canvas, opts = {}) {
  const assetUrl = opts.assetUrl || '/rig-assets/RobotExpressive.glb'
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true })
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.setClearColor(0x000000, 0)

  const scene = new THREE.Scene()
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, -2000, 2000)
  cam.position.set(VW / 2, -VH / 2, 500)
  cam.up.set(0, 1, 0)
  cam.lookAt(VW / 2, -VH / 2, 0)

  // golden-hour lighting: warm key from the sun side (upper-right), cool fill
  const hemi = new THREE.HemisphereLight(0xffe6c0, 0x2a3f4a, 1.5)
  scene.add(hemi)
  const key = new THREE.DirectionalLight(0xffd28a, 2.6)
  key.position.set(6, 5, 4)
  scene.add(key)
  const rim = new THREE.DirectionalLight(0xbfe0ff, 0.7)
  rim.position.set(-5, 3, -4)
  scene.add(rim)

  let w = 1, h = 1, dpr = 1
  function resize() {
    const rect = canvas.getBoundingClientRect()
    w = Math.max(1, rect.width); h = Math.max(1, rect.height)
    dpr = Math.min(window.devicePixelRatio || 1, 2)
    renderer.setPixelRatio(dpr)
    renderer.setSize(w, h, false)
    const s = Math.max(w / VW, h / VH) // "cover" — identical to welcomeEngine
    const halfW = (w / s) / 2, halfH = (h / s) / 2
    cam.left = -halfW; cam.right = halfW; cam.top = halfH; cam.bottom = -halfH
    cam.updateProjectionMatrix()
  }
  resize()
  const ro = new ResizeObserver(resize)
  ro.observe(canvas)

  // ── build one rigged character from the loaded gltf ──
  const characters = [] // { group, mixer, kind }
  function makeCharacter(gltf, { x, y, targetH, faceDeg, clipName, kind }) {
    const model = cloneSkinned(gltf.scene)
    // normalise: scale to target virtual height, drop feet to the group origin.
    // world matrices MUST be current before Box3.setFromObject, or the measured
    // height is wrong and the scale factor collapses to near-zero.
    model.updateMatrixWorld(true)
    const box = new THREE.Box3().setFromObject(model)
    const size = box.getSize(new THREE.Vector3())
    const sc = targetH / (size.y || 1)
    model.scale.setScalar(sc)
    model.position.y = -box.min.y * sc // feet (pre-scale min.y, scaled) → y = 0
    model.rotation.y = (faceDeg * Math.PI) / 180
    model.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.frustumCulled = false } })

    const group = new THREE.Group()
    group.add(model)
    group.position.set(x, -y, kind === 'fisher' ? 1 : 0)
    scene.add(group)

    const mixer = new THREE.AnimationMixer(model)
    const clip = THREE.AnimationClip.findByName(gltf.animations, clipName) || gltf.animations[0]
    const action = mixer.clipAction(clip)
    action.play()
    // desync so the three don't move as one timer
    mixer.setTime(Math.random() * 2)

    const c = { group, mixer, kind, gesture: null, nextGesture: 6 + Math.random() * 8 }
    // researcher: occasionally raise a hand (Wave) then settle back to Idle
    if (kind === 'researcher') {
      c.idle = action
      const wave = THREE.AnimationClip.findByName(gltf.animations, 'Wave')
      if (wave) c.waveAction = mixer.clipAction(wave)
    }
    characters.push(c)
    return c
  }

  let ready = false
  const loader = new GLTFLoader()
  loader.load(assetUrl, (gltf) => {
    // walker — real Walking clip, translates along the shore (see loop).
    // targetH matches the procedural NPCs it sits beside (in virtual px).
    makeCharacter(gltf, { x: WALK_X0, y: shoreY(WALK_X0) + 68, targetH: 112, faceDeg: 90, clipName: 'Walking', kind: 'walker' })
    // fisher — no casting clip exists in this asset, so a believable Idle
    makeCharacter(gltf, { x: FISHER.x, y: FISHER.y, targetH: 72, faceDeg: -120, clipName: 'Idle', kind: 'fisher' })
    // researcher — Idle with occasional hand gesture
    makeCharacter(gltf, { x: RESEARCHER.x, y: RESEARCHER.y, targetH: 106, faceDeg: -25, clipName: 'Idle', kind: 'researcher' })
    ready = true
    if (opts.onReady) opts.onReady()
  }, undefined, (err) => { if (opts.onError) opts.onError(err) })

  // ── animation loop ──
  let raf = 0, running = true, last = performance.now()
  let walkQ = 0
  const WALK_SPEED = 118 // virtual units / sec — tuned to the Walking clip stride (no slide)
  function frame(now) {
    if (!running) return
    const dt = Math.min(0.05, (now - last) / 1000)
    last = now
    for (const c of characters) {
      c.mixer.update(dt)
      if (c.kind === 'walker') {
        walkQ += (dt * WALK_SPEED) / (WALK_X1 - WALK_X0)
        if (walkQ > 1) walkQ -= 1
        const wx = WALK_X0 + walkQ * (WALK_X1 - WALK_X0)
        c.group.position.set(wx, -(shoreY(wx) + 68), 0)
      } else if (c.kind === 'researcher' && c.waveAction) {
        c.nextGesture -= dt
        if (c.nextGesture <= 0 && !c.gesturing) {
          c.gesturing = true
          c.waveAction.reset().setLoop(THREE.LoopOnce, 1)
          c.waveAction.clampWhenFinished = true
          c.idle.crossFadeTo(c.waveAction, 0.3, false); c.waveAction.play()
          setTimeout(() => {
            if (c.idle) { c.waveAction.crossFadeTo(c.idle, 0.4, false); c.idle.play() }
            c.gesturing = false
            c.nextGesture = 7 + Math.random() * 9
          }, 2600)
        }
      }
    }
    renderer.render(scene, cam)
    raf = requestAnimationFrame(frame)
  }
  raf = requestAnimationFrame(frame)

  // pause when the hero scrolls off-screen (perf)
  const io = new IntersectionObserver((es) => {
    const on = es[0].isIntersecting
    if (on && !running) { running = true; last = performance.now(); raf = requestAnimationFrame(frame) }
    else if (!on && running) { running = false; cancelAnimationFrame(raf) }
  }, { threshold: 0.01 })
  io.observe(canvas)

  return function cleanup() {
    running = false
    cancelAnimationFrame(raf)
    ro.disconnect(); io.disconnect()
    scene.traverse((o) => {
      if (o.isMesh) { o.geometry?.dispose?.(); const m = o.material; if (Array.isArray(m)) m.forEach((x) => x.dispose?.()); else m?.dispose?.() }
    })
    renderer.dispose()
  }
}
