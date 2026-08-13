/** Finnish-language time and number formatting, in one place. */

export function clock(seconds: number): string {
  const s = Math.max(0, Math.round(seconds))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

/** An unmeasured duration reads as a dash, not as "0 min". */
export function durationOrDash(ms: number): string {
  return ms <= 0 ? '–' : duration(ms)
}

export function duration(ms: number): string {
  const minutes = Math.round(ms / 60000)
  if (minutes < 60) return `${minutes} min`
  return `${Math.floor(minutes / 60)} h ${minutes % 60} min`
}

/** Coarse age for the resume banner — precision would be noise here. */
export function relativeAge(at: number): string {
  const minutes = Math.round((Date.now() - at) / 60000)
  if (minutes < 1) return 'hetki'
  if (minutes < 60) return `${minutes} min`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours} h`
  const days = Math.round(hours / 24)
  return `${days} vrk`
}

const WEEKDAYS = ['su', 'ma', 'ti', 'ke', 'to', 'pe', 'la']

const LONG_WEEKDAYS = [
  'sunnuntai',
  'maanantai',
  'tiistai',
  'keskiviikko',
  'torstai',
  'perjantai',
  'lauantai',
]

export function weekdayName(at: number): string {
  return LONG_WEEKDAYS[new Date(at).getDay()]
}

/** Noon, so a stored instant sits well clear of midnight and DST boundaries. */
export function noonOn(at: number): number {
  const d = new Date(at)
  d.setHours(12, 0, 0, 0)
  return d.getTime()
}

/** "to 13.8.2026" — the weekday and date, spelled the Finnish way. */
export function fullDate(at: number): string {
  const d = new Date(at)
  return `${WEEKDAYS[d.getDay()]} ${d.getDate()}.${d.getMonth() + 1}.${d.getFullYear()}`
}

/** The local calendar day of an instant, as `YYYY-MM-DD`. */
export function localDay(at: number): string {
  const d = new Date(at)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** Add whole calendar days. Adding 86 400 000 ms breaks across a DST change. */
export function addDays(at: number, days: number): number {
  const d = new Date(at)
  d.setDate(d.getDate() + days)
  return d.getTime()
}

export function shortDate(at: number): string {
  const d = new Date(at)
  const today = new Date()
  const sameDay = d.toDateString() === today.toDateString()
  if (sameDay) return `tänään ${d.getHours()}.${String(d.getMinutes()).padStart(2, '0')}`
  return `${WEEKDAYS[d.getDay()]} ${d.getDate()}.${d.getMonth() + 1}.`
}

/** Loads in Finnish: a decimal comma, and no trailing zeroes. */
export function kgLabel(kg: number): string {
  return kg.toLocaleString('fi', { maximumFractionDigits: 2 })
}

/** Sets as a lifter writes them: 80 kg × 8, 8, 7 */
export function setsLine(sets: { kg: number | null; reps: number | null }[]): string {
  if (!sets.length) return ''
  const reps = sets.map((s) => s.reps ?? '–').join(', ')

  // Bodyweight work carries no external load — an explicit 0 or a blank both
  // mean the same thing here, and reps alone are the honest record.
  if (sets.every((s) => s.kg === null || s.kg === 0)) return reps

  const kg = sets[0].kg
  if (sets.every((s) => s.kg === kg)) return `${kgLabel(kg!)} kg × ${reps}`
  return sets
    .map((s) => `${s.kg === null ? '–' : kgLabel(s.kg)} × ${s.reps ?? '–'}`)
    .join('  ·  ')
}
