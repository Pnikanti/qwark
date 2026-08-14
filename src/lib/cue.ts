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

/** Two short tones. Synthesised rather than bundled, so it works offline. */
function beep(): void {
  if (!audio || audio.state !== 'running') return
  const at = audio.currentTime
  for (const [i, hz] of [880, 1320].entries()) {
    const osc = audio.createOscillator()
    const gain = audio.createGain()
    osc.type = 'sine'
    osc.frequency.value = hz
    // Ramped, because a square-edged gain change clicks.
    gain.gain.setValueAtTime(0, at + i * 0.18)
    gain.gain.linearRampToValueAtTime(0.25, at + i * 0.18 + 0.02)
    gain.gain.linearRampToValueAtTime(0, at + i * 0.18 + 0.16)
    osc.connect(gain).connect(audio.destination)
    osc.start(at + i * 0.18)
    osc.stop(at + i * 0.18 + 0.18)
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

export function restOver(alerts: Alerts, title: string, body: string): void {
  if (alerts.vibrate) navigator.vibrate?.([120, 80, 120])
  if (alerts.sound) beep()
  if (alerts.notify) void notify(title, body)
}
