let ctx = null

function getCtx() {
  if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)()
  return ctx
}

function playTone(frequency, duration, type = 'sine', volume = 0.15) {
  try {
    const c = getCtx()
    const osc = c.createOscillator()
    const gain = c.createGain()
    osc.connect(gain)
    gain.connect(c.destination)
    osc.type = type
    osc.frequency.value = frequency
    gain.gain.setValueAtTime(volume, c.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + duration)
    osc.start(c.currentTime)
    osc.stop(c.currentTime + duration)
  } catch {}
}

export const sounds = {
  click: () => playTone(800, 0.1, 'sine', 0.1),
  success: () => {
    playTone(523, 0.15)
    setTimeout(() => playTone(659, 0.15), 150)
    setTimeout(() => playTone(784, 0.25), 300)
  },
  error: () => playTone(200, 0.3, 'sawtooth', 0.1),
  bubble: () => playTone(400 + Math.random() * 200, 0.2, 'sine', 0.08),
  splash: () => {
    for (let i = 0; i < 5; i++) {
      setTimeout(() => playTone(300 + Math.random() * 400, 0.15, 'triangle', 0.06), i * 40)
    }
  },
  levelUp: () => {
    [523, 587, 659, 784, 1047].forEach((f, i) =>
      setTimeout(() => playTone(f, 0.2), i * 100)
    )
  },
  notification: () => {
    playTone(880, 0.1)
    setTimeout(() => playTone(1100, 0.15), 120)
  },
  correct: () => {
    playTone(659, 0.1)
    setTimeout(() => playTone(880, 0.2), 120)
  },
  wrong: () => playTone(233, 0.4, 'sawtooth', 0.1),
  drop: () => playTone(600, 0.3, 'sine', 0.12),
}
