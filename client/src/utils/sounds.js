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

function playNoise(duration, volume = 0.1) {
  try {
    const c = getCtx()
    const bufSize = c.sampleRate * duration
    const buf = c.createBuffer(1, bufSize, c.sampleRate)
    const data = buf.getChannelData(0)
    for (let i = 0; i < bufSize; i++) data[i] = (Math.random() * 2 - 1)
    const src = c.createBufferSource()
    src.buffer = buf
    const gain = c.createGain()
    src.connect(gain); gain.connect(c.destination)
    gain.gain.setValueAtTime(volume, c.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + duration)
    src.start(); src.stop(c.currentTime + duration)
  } catch {}
}

export const sounds = {
  click:        () => playTone(800, 0.1, 'sine', 0.1),
  success:      () => { playTone(523,0.15); setTimeout(()=>playTone(659,0.15),150); setTimeout(()=>playTone(784,0.25),300) },
  error:        () => playTone(200, 0.3, 'sawtooth', 0.1),
  bubble:       () => playTone(400 + Math.random()*200, 0.2, 'sine', 0.08),
  splash:       () => { for(let i=0;i<5;i++) setTimeout(()=>playTone(300+Math.random()*400,0.15,'triangle',0.06),i*40) },
  levelUp:      () => { [523,587,659,784,1047].forEach((f,i)=>setTimeout(()=>playTone(f,0.2),i*100)) },
  notification: () => { playTone(880,0.1); setTimeout(()=>playTone(1100,0.15),120) },
  correct:      () => { playTone(659,0.1); setTimeout(()=>playTone(880,0.2),120) },
  wrong:        () => playTone(233, 0.4, 'sawtooth', 0.1),
  drop:         () => playTone(600, 0.3, 'sine', 0.12),

  // Game-specific sounds
  shoot: () => {
    try {
      const c = getCtx()
      const osc = c.createOscillator(); const gain = c.createGain()
      osc.connect(gain); gain.connect(c.destination)
      osc.type = 'sawtooth'
      osc.frequency.setValueAtTime(900, c.currentTime)
      osc.frequency.exponentialRampToValueAtTime(200, c.currentTime + 0.12)
      gain.gain.setValueAtTime(0.18, c.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.12)
      osc.start(); osc.stop(c.currentTime + 0.12)
    } catch {}
  },

  explode: () => {
    playNoise(0.25, 0.18)
    playTone(80, 0.3, 'sawtooth', 0.12)
    setTimeout(() => playTone(60, 0.2, 'triangle', 0.08), 60)
  },

  hit: () => {
    playNoise(0.1, 0.12)
    playTone(150, 0.15, 'sawtooth', 0.1)
  },

  powerUp: () => {
    [400, 500, 650, 800, 1000, 1300].forEach((f, i) =>
      setTimeout(() => playTone(f, 0.12, 'sine', 0.13), i * 55))
  },

  shield: () => {
    playTone(300, 0.08, 'sine', 0.1)
    setTimeout(() => playTone(600, 0.08, 'sine', 0.1), 80)
    setTimeout(() => playTone(900, 0.2, 'sine', 0.12), 160)
  },

  coin: () => {
    playTone(1200, 0.06, 'sine', 0.12)
    setTimeout(() => playTone(1600, 0.1, 'sine', 0.1), 60)
  },

  gem: () => {
    [800, 1000, 1400, 1800].forEach((f, i) =>
      setTimeout(() => playTone(f, 0.08, 'sine', 0.12), i * 40))
  },

  star: () => {
    [600, 800, 1000, 1400, 2000].forEach((f, i) =>
      setTimeout(() => playTone(f, 0.08, 'triangle', 0.11), i * 35))
  },

  boss: () => {
    [150, 120, 100, 80].forEach((f, i) =>
      setTimeout(() => playTone(f, 0.3, 'sawtooth', 0.15), i * 140))
    setTimeout(() => playNoise(0.4, 0.12), 100)
  },

  bossHit: () => {
    playNoise(0.08, 0.1)
    playTone(200, 0.1, 'square', 0.12)
  },

  frenzy: () => {
    [300, 400, 500, 600, 800, 1000, 1300].forEach((f, i) =>
      setTimeout(() => playTone(f, 0.1, 'sawtooth', 0.1), i * 45))
  },

  combo3: () => {
    playTone(700, 0.08, 'sine', 0.12)
    setTimeout(() => playTone(900, 0.08, 'sine', 0.12), 80)
    setTimeout(() => playTone(1100, 0.15, 'sine', 0.14), 160)
  },

  combo5: () => {
    [500, 700, 900, 1100, 1400, 1800].forEach((f, i) =>
      setTimeout(() => playTone(f, 0.1, 'sine', 0.13), i * 55))
  },

  death: () => {
    playNoise(0.5, 0.15);
    [400, 300, 200, 120, 80].forEach((f, i) =>
      setTimeout(() => playTone(f, 0.15, 'sawtooth', 0.1), i * 80))
  },

  jump: () => {
    try {
      const c = getCtx()
      const osc = c.createOscillator(); const gain = c.createGain()
      osc.connect(gain); gain.connect(c.destination)
      osc.type = 'sine'
      osc.frequency.setValueAtTime(300, c.currentTime)
      osc.frequency.exponentialRampToValueAtTime(600, c.currentTime + 0.15)
      gain.gain.setValueAtTime(0.14, c.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.15)
      osc.start(); osc.stop(c.currentTime + 0.15)
    } catch {}
  },

  shrink: () => {
    try {
      const c = getCtx()
      const osc = c.createOscillator(); const gain = c.createGain()
      osc.connect(gain); gain.connect(c.destination)
      osc.type = 'sine'
      osc.frequency.setValueAtTime(800, c.currentTime)
      osc.frequency.exponentialRampToValueAtTime(200, c.currentTime + 0.3)
      gain.gain.setValueAtTime(0.13, c.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.3)
      osc.start(); osc.stop(c.currentTime + 0.3)
    } catch {}
  },

  slow: () => {
    playTone(400, 0.1, 'sine', 0.1)
    setTimeout(() => playTone(300, 0.1, 'sine', 0.1), 100)
    setTimeout(() => playTone(200, 0.2, 'sine', 0.12), 200)
  },
}
