/**
 * welcomeSound — tiny procedural ambience for the landing page.
 * Gentle surf (filtered noise swelling on a slow LFO) plus occasional
 * gull cries (band-passed descending chirps). No audio files. Starts only
 * from a user gesture (browser autoplay rules) via toggleSound().
 */
let actx = null
let master = null
let gullTimer = 0
let playing = false

export function soundPlaying() { return playing }

export function toggleSound() {
  if (playing) stop()
  else start()
  return playing
}

function start() {
  try {
    actx = new (window.AudioContext || window.webkitAudioContext)()
  } catch { return }
  master = actx.createGain()
  master.gain.value = 0
  master.gain.linearRampToValueAtTime(0.22, actx.currentTime + 1.5)
  master.connect(actx.destination)

  // ── surf: looped brown-ish noise → lowpass → slow swelling gain ──
  const len = actx.sampleRate * 4
  const buf = actx.createBuffer(1, len, actx.sampleRate)
  const d = buf.getChannelData(0)
  let last = 0
  for (let i = 0; i < len; i++) {
    const w = Math.random() * 2 - 1
    last = (last + 0.02 * w) / 1.02
    d[i] = last * 3.5
  }
  const src = actx.createBufferSource()
  src.buffer = buf; src.loop = true
  const lp = actx.createBiquadFilter()
  lp.type = 'lowpass'; lp.frequency.value = 420
  const surfG = actx.createGain()
  surfG.gain.value = 0.55
  const lfo = actx.createOscillator()
  lfo.frequency.value = 0.09
  const lfoG = actx.createGain()
  lfoG.gain.value = 0.3
  lfo.connect(lfoG); lfoG.connect(surfG.gain)
  src.connect(lp); lp.connect(surfG); surfG.connect(master)
  src.start(); lfo.start()

  scheduleGull()
  playing = true
}

function scheduleGull() {
  gullTimer = setTimeout(() => { gullCry(); scheduleGull() }, 6000 + Math.random() * 9000)
}

function gullCry() {
  if (!actx) return
  const t0 = actx.currentTime + 0.05
  const n = 2 + ((Math.random() * 2) | 0)
  for (let k = 0; k < n; k++) {
    const o = actx.createOscillator()
    o.type = 'sawtooth'
    const bp = actx.createBiquadFilter()
    bp.type = 'bandpass'; bp.frequency.value = 1800; bp.Q.value = 6
    const g = actx.createGain()
    const st = t0 + k * 0.28
    o.frequency.setValueAtTime(1100 + Math.random() * 140, st)
    o.frequency.exponentialRampToValueAtTime(800, st + 0.22)
    g.gain.setValueAtTime(0, st)
    g.gain.linearRampToValueAtTime(0.1, st + 0.03)
    g.gain.exponentialRampToValueAtTime(0.001, st + 0.26)
    o.connect(bp); bp.connect(g); g.connect(master)
    o.start(st); o.stop(st + 0.3)
  }
}

function stop() {
  clearTimeout(gullTimer)
  try { actx?.close() } catch { /* already closed */ }
  actx = null; master = null
  playing = false
}
