import type { Alerts } from './settings'

/**
 * The rest-over cue.
 *
 * Three signals, most to least reliable, each degrading on its own so a missing
 * capability never costs you the others. None of them can be trusted to fire at
 * the exact second on a locked phone: a backgrounded page's timers are throttled
 * and may be frozen outright, and scheduling a notification for a future instant
 * needs the Notification Triggers API, which is not broadly available. What this
 * guarantees is that the cue fires once — on time when the page can run, late
 * when it could not, and never twice.
 */

/**
 * iOS refuses to start an AudioContext outside a user gesture, so it is created
 * during the tap that starts the rest period rather than when the timer expires.
 */
let audio: AudioContext | null = null

export function primeAudio(): void {
  if (typeof AudioContext === 'undefined') return
  audio ??= new AudioContext()
  // Suspended is the normal state after a tab regains focus.
  if (audio.state === 'suspended') void audio.resume()
}

/**
 * Three rising tones. Synthesised rather than bundled, so it works offline.
 *
 * Built to be heard across a gym rather than to be tasteful. A sine at 0.25 gain
 * — what this was — is close to the quietest sound a browser can make: a sine has
 * no harmonics, and a phone speaker reproduces almost nothing of a pure tone that
 * low. Three things fix that, and all three are needed:
 *
 * - **Square, not sine.** The odd harmonics are what a small speaker can actually
 *   move air with, so the same nominal level lands far louder.
 * - **Near full scale.** The compressor holds the peaks, so the pulses can sit at
 *   the top of the range without the clipping that raw 0.9-gain squares produce.
 * - **Longer, and three of them.** 0.6s of rising pattern reads as a signal; two
 *   quiet blips read as a UI noise you are not sure you heard.
 *
 * The lowpass is the one concession to taste: unfiltered square harmonics come out
 * of a phone speaker as hiss.
 */
async function beep(): Promise<void> {
  if (!audio) return
  // `resume()` is a promise, so a context primed by the same tap that asked for
  // this beep can still be suspended right now. Awaiting it here is what keeps the
  // first press of Testaa from being silent.
  if (audio.state === 'suspended') {
    try {
      await audio.resume()
    } catch {
      return
    }
  }
  if (audio.state !== 'running') return
  const at = audio.currentTime

  const master = audio.createGain()
  // 0.85, not higher: measured in an OfflineAudioContext, 0.9 overshoots to
  // 1.006 and clips. This peaks at -0.3 dBFS with the limiter holding it there.
  master.gain.value = 0.85

  const tone = audio.createBiquadFilter()
  tone.type = 'lowpass'
  tone.frequency.value = 5000

  const limiter = audio.createDynamicsCompressor()
  limiter.threshold.value = -14
  limiter.ratio.value = 12
  limiter.attack.value = 0.002

  master.connect(tone).connect(limiter).connect(audio.destination)

  const PULSE = 0.15
  const STEP = 0.21
  // A5 · A5 · E6 — inside the band a phone speaker is most efficient in.
  for (const [i, hz] of [880, 880, 1319].entries()) {
    const start = at + i * STEP
    const osc = audio.createOscillator()
    const gain = audio.createGain()
    osc.type = 'square'
    osc.frequency.value = hz
    // Ramped, because a square-edged gain change clicks.
    gain.gain.setValueAtTime(0, start)
    gain.gain.linearRampToValueAtTime(1, start + 0.012)
    gain.gain.setValueAtTime(1, start + PULSE - 0.03)
    gain.gain.linearRampToValueAtTime(0, start + PULSE)
    osc.connect(gain).connect(master)
    osc.start(start)
    osc.stop(start + PULSE + 0.02)
  }
}

/**
 * Shown through the service worker registration, which the PWA build already
 * installs. Silent when permission was never granted — asking here would be a
 * prompt out of nowhere; that belongs in Asetukset.
 */
async function notify(title: string, body: string): Promise<void> {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return
  try {
    const registration = await navigator.serviceWorker?.ready
    if (!registration) return
    await registration.showNotification(title, {
      body,
      tag: 'qwark-rest',
      // Replaces any previous rest notification rather than stacking them.
      renotify: true,
      icon: '/pwa-192x192.png',
      badge: '/pwa-192x192.png',
    } as NotificationOptions)
  } catch {
    // A cue is not worth breaking a workout over.
  }
}

/**
 * Whether the browser has the Vibration API at all.
 *
 * iOS has never shipped it — in every browser on the platform, including Chrome,
 * `navigator.vibrate` is simply absent. The optional call below makes that a
 * silent no-op, which is right for the cue and wrong for the toggle in Asetukset:
 * a switch that sits on while nothing can ever happen is worse than one that says
 * the device cannot do it.
 */
export function canVibrate(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function'
}

/**
 * Long pulses, because a vibration motor has to spin up before anything is felt.
 * The old [120, 80, 120] was near the floor of what a phone renders at all — some
 * report it as fired and never move. Three 300ms pulses cannot be missed with the
 * phone on a bench, and are still felt through a pocket.
 *
 * Android additionally drops vibrations while the document is hidden, which is why
 * the caller reconciles a missed cue on `visibilitychange` rather than assuming the
 * timer's call was heard.
 */
const BUZZ = [300, 120, 300, 120, 300]

export function restOver(alerts: Alerts, title: string, body: string): void {
  if (alerts.vibrate) navigator.vibrate?.(BUZZ)
  if (alerts.sound) void beep()
  if (alerts.notify) void notify(title, body)
}

/**
 * Fires whichever cues are switched on, for the Testaa button in Asetukset.
 *
 * Priming here is what makes the test meaningful: it runs inside the tap, which is
 * the only context iOS will start an AudioContext from, so what you hear is what a
 * real rest period will sound like rather than silence from a suspended context.
 */
export function testCue(alerts: Alerts, title: string, body: string): void {
  if (alerts.sound) primeAudio()
  restOver(alerts, title, body)
}
