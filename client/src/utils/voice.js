// Shared voice selection for SOURCE Water mascot TTS.
// Ensures the same kid-like female voice is used everywhere the mascot speaks,
// regardless of browser/OS default. Call pickNibiVoice() to get the best
// available voice — it walks a deterministic preference list and returns the
// first match, falling back to any en-US female, then any en voice.

const PREFERRED = [
  // Most consistent kid/young female voices across platforms
  /^Microsoft Ana/i,              // Edge — kid voice
  /^Google US English$/i,         // Chrome — deterministic fallback
  /^Samantha$/i,                  // macOS/iOS default female
  /^Microsoft Zira/i,             // Windows default female
  /^Microsoft Hazel/i,            // Windows en-GB female
  /^Karen$/i,                     // macOS en-AU female
  /^Victoria$/i,                  // macOS female
]

// Names of voices we must NEVER pick — deep/male defaults that sound gravelly
// with Nibi's high pitch setting (the "someone with a sore throat" bug on
// Windows where Microsoft David is the system default).
const AVOID = /^(Microsoft David|Microsoft Mark|Microsoft George|Microsoft James|Microsoft Richard|Alex|Daniel|Fred|Bruce|Ralph|Albert|Junior|Aaron|Arthur|Brian|Diego|Fred|Google UK English Male|Google Deutsch|Microsoft Pavel|Microsoft Stefan)/i

export function pickNibiVoice() {
  if (typeof window === 'undefined' || !window.speechSynthesis) return null
  const voices = window.speechSynthesis.getVoices() || []
  if (!voices.length) return null

  for (const rx of PREFERRED) {
    const hit = voices.find(v => rx.test(v.name))
    if (hit) return hit
  }
  // Any en-US female
  const enUsFemale = voices.find(v => v.lang === 'en-US' && /female/i.test(v.name))
  if (enUsFemale) return enUsFemale
  // Any en female
  const enFemale = voices.find(v => v.lang?.startsWith('en') && /female/i.test(v.name))
  if (enFemale) return enFemale
  // Any en-US that's not a known male voice
  const enUs = voices.find(v => v.lang === 'en-US' && !AVOID.test(v.name))
  if (enUs) return enUs
  // Any en that's not a known male voice
  const enAny = voices.find(v => v.lang?.startsWith('en') && !AVOID.test(v.name))
  if (enAny) return enAny
  // Last resort — any non-male voice
  return voices.find(v => !AVOID.test(v.name)) || voices[0]
}

// Consistent pitch/rate/volume for Nibi — the young female mascot voice.
export const NIBI_PROSODY = { pitch: 1.8, rate: 1.05, volume: 0.95 }

// Premium TTS: hits the backend /api/ai/tts which uses Microsoft Edge
// en-US-AnaNeural (free, no API key, sounds like a real young woman, NOT
// the Windows-default sore-throat male voice). Falls back to the browser
// SpeechSynthesis with the kid prosody if the backend can't deliver audio.
//
// Returns a small controller object so callers can stop playback mid-stream
// and listen for completion. Used by Ask Water, AI Lab read-aloud, and the
// Alerts page so every "🔊 Read aloud" button on the platform sounds the same.
export function playNibiTTS(text) {
  const ctrl = { _audio: null, _abort: new AbortController(), _done: false, _onEndCbs: [] }
  ctrl.stop = () => {
    ctrl._abort.abort()
    if (ctrl._audio) { try { ctrl._audio.pause(); ctrl._audio.src = '' } catch {} }
    try { window.speechSynthesis?.cancel() } catch {}
    if (!ctrl._done) { ctrl._done = true; ctrl._onEndCbs.forEach(cb => cb()) }
  }
  ctrl.onEnd = (cb) => { if (ctrl._done) cb(); else ctrl._onEndCbs.push(cb) }

  const finish = () => { if (!ctrl._done) { ctrl._done = true; ctrl._onEndCbs.forEach(cb => cb()) } }

  // Strip markdown / emojis / urls so the TTS doesn't read them out loud
  const clean = String(text || '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[\u{1F300}-\u{1FAFF}]/gu, '')
    .replace(/[\u{2600}-\u{27BF}]/gu, '')
    .replace(/[*_`#[\]]/g, '')
    .replace(/https?:\/\/\S+/g, '')
    .trim()
  if (!clean) { finish(); return ctrl }

  ;(async () => {
    try {
      // Lazy-import to avoid circular dep with utils/api which imports voice on some pages
      const { default: api } = await import('./api')
      const resp = await api.post('/ai/tts', { text: clean.slice(0, 500) }, { responseType: 'blob', signal: ctrl._abort.signal })
      if (ctrl._abort.signal.aborted) return
      const url = URL.createObjectURL(resp.data)
      const audio = new Audio(url)
      ctrl._audio = audio
      audio.onended = () => { URL.revokeObjectURL(url); finish() }
      audio.onerror = () => { URL.revokeObjectURL(url); finish() }
      ctrl._abort.signal.addEventListener('abort', () => { audio.pause(); audio.src = ''; URL.revokeObjectURL(url); finish() })
      await audio.play().catch(() => finish())
    } catch (e) {
      if (ctrl._abort.signal.aborted) { finish(); return }
      // Backend TTS failed — fall back to browser SpeechSynthesis with the
      // kid prosody so we still get a passable voice instead of nothing.
      try { await speakAsNibi(clean.slice(0, 350)) } catch {}
      finish()
    }
  })()
  return ctrl
}

// Speak a string with the Nibi voice. Resolves when done or on error.
// If the browser hasn't loaded voices yet, waits once for voiceschanged.
export function speakAsNibi(text) {
  if (typeof window === 'undefined' || !window.speechSynthesis) return Promise.resolve()
  return new Promise(resolve => {
    const go = () => {
      const u = new SpeechSynthesisUtterance(text)
      u.pitch = NIBI_PROSODY.pitch
      u.rate  = NIBI_PROSODY.rate
      u.volume = NIBI_PROSODY.volume
      const v = pickNibiVoice()
      if (v) u.voice = v
      u.onend = resolve
      u.onerror = resolve
      window.speechSynthesis.speak(u)
    }
    const voices = window.speechSynthesis.getVoices()
    if (voices && voices.length) { go(); return }
    const onReady = () => {
      window.speechSynthesis.removeEventListener('voiceschanged', onReady)
      go()
    }
    window.speechSynthesis.addEventListener('voiceschanged', onReady)
    // Fallback — some browsers never fire voiceschanged
    setTimeout(go, 300)
  })
}
