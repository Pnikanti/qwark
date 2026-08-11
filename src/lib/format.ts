/** Finnish-language time and number formatting, in one place. */

export function clock(seconds: number): string {
  const s = Math.max(0, Math.round(seconds))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
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

export function shortDate(at: number): string {
  const d = new Date(at)
  const today = new Date()
  const sameDay = d.toDateString() === today.toDateString()
  if (sameDay) return `tänään ${d.getHours()}.${String(d.getMinutes()).padStart(2, '0')}`
  return `${WEEKDAYS[d.getDay()]} ${d.getDate()}.${d.getMonth() + 1}.`
}

/** Sets as a lifter writes them: 80 × 8, 8, 7 */
export function setsLine(sets: { kg: number | null; reps: number | null }[]): string {
  if (!sets.length) return ''
  const kg = sets[0].kg
  const uniform = sets.every((s) => s.kg === kg)
  if (uniform && kg !== null) return `${kg} kg × ${sets.map((s) => s.reps ?? '–').join(', ')}`
  return sets.map((s) => `${s.kg ?? '–'}×${s.reps ?? '–'}`).join('  ')
}
