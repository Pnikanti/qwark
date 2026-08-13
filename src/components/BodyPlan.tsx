/**
 * Schematic body plan. Every region always renders; only its tone changes —
 * accent for a primary muscle, ghosted for a secondary, faint otherwise. That
 * way the figure cannot be drawn wrong and highlighting is purely colour.
 *
 * Deliberately diagrammatic rather than anatomical: blocky regions survive
 * being drawn small, and the pattern is what carries meaning, not the outline.
 * Regions are coarser than the 17 taxonomy keys — several keys share a shape.
 *
 * In a list, one figure is shown, picked by which side the movement actually
 * works: front for a press, back for a row. Both are shown at large sizes.
 */

type Shape = { x: number; y: number; w: number; h: number }
type Region = { muscle: string | null; shapes: Shape[] }

const W = 38
const H = 80
const GAP = 5

/** Symmetric pair helper: mirrors a left-side shape about the centre line. */
const pair = (x: number, y: number, w: number, h: number): Shape[] => [
  { x, y, w, h },
  { x: W - x - w, y, w, h },
]

const FRONT: Region[] = [
  { muscle: null, shapes: [{ x: 14, y: 1, w: 10, h: 9 }] }, // head
  { muscle: 'neck', shapes: [{ x: 16, y: 10.2, w: 6, h: 2.6 }] },
  { muscle: 'traps', shapes: [{ x: 11, y: 13, w: 16, h: 3 }] },
  { muscle: 'shoulders', shapes: pair(4.6, 14.4, 6.6, 8) },
  { muscle: 'chest', shapes: [{ x: 11.6, y: 16.4, w: 14.8, h: 8.8 }] },
  { muscle: 'biceps', shapes: pair(4.2, 23.2, 6, 9) },
  { muscle: 'abdominals', shapes: [{ x: 13, y: 26, w: 12, h: 12.8 }] },
  { muscle: 'forearms', shapes: pair(4.2, 32.8, 6, 11) },
  { muscle: 'abductors', shapes: pair(9.2, 39.6, 3.4, 9) },
  { muscle: 'quadriceps', shapes: pair(12.9, 40, 5.2, 18) },
  { muscle: 'adductors', shapes: [{ x: 18.3, y: 43, w: 1.4, h: 13 }] },
  { muscle: null, shapes: pair(13.2, 58.6, 4.8, 13) }, // shins
]

const BACK: Region[] = [
  { muscle: null, shapes: [{ x: 14, y: 1, w: 10, h: 9 }] }, // head
  { muscle: 'neck', shapes: [{ x: 16, y: 10.2, w: 6, h: 2.6 }] },
  { muscle: 'traps', shapes: [{ x: 12, y: 13, w: 14, h: 8.4 }] },
  { muscle: 'shoulders', shapes: pair(4.6, 14.4, 6.6, 8) },
  { muscle: 'triceps', shapes: pair(4.2, 23.2, 6, 9) },
  { muscle: 'lats', shapes: pair(9.8, 21.8, 6, 10.6) },
  { muscle: 'middle back', shapes: [{ x: 16.2, y: 21.8, w: 5.6, h: 8.6 }] },
  { muscle: 'forearms', shapes: pair(4.2, 32.8, 6, 11) },
  { muscle: 'lower back', shapes: [{ x: 13.8, y: 31.2, w: 10.4, h: 6.4 }] },
  { muscle: 'glutes', shapes: [{ x: 12, y: 38.4, w: 14, h: 8 }] },
  { muscle: 'hamstrings', shapes: pair(12.9, 47, 5.2, 12.4) },
  { muscle: 'calves', shapes: pair(12.9, 60, 5.2, 12.4) },
]

const muscles = (regions: Region[]) =>
  new Set(regions.map((r) => r.muscle).filter(Boolean) as string[])

const FRONT_MUSCLES = muscles(FRONT)
const BACK_MUSCLES = muscles(BACK)

export type BodyView = 'auto' | 'front' | 'back' | 'both'

/** Which side a movement actually works, by where its primary muscles live. */
function pickSide(primary: string[]): 'front' | 'back' {
  let front = 0
  let back = 0
  for (const m of primary) {
    if (FRONT_MUSCLES.has(m)) front++
    if (BACK_MUSCLES.has(m)) back++
  }
  return back > front ? 'back' : 'front'
}

export function BodyPlan({
  primary,
  secondary = [],
  size = 40,
  view = 'auto',
  title,
  className = '',
  intensity,
}: {
  primary: string[]
  secondary?: string[]
  size?: number
  view?: BodyView
  title?: string
  className?: string
  /** muscle → 0..1. When given, regions are shaded by it instead of binary. */
  intensity?: Record<string, number>
}) {
  const primarySet = new Set(primary)
  const secondarySet = new Set(secondary.filter((m) => !primarySet.has(m)))

  const sides: Region[][] =
    view === 'both'
      ? [FRONT, BACK]
      : [(view === 'auto' ? pickSide(primary) : view) === 'back' ? BACK : FRONT]

  const totalW = sides.length * W + (sides.length - 1) * GAP

  const draw = (regions: Region[], dx: number) =>
    regions.flatMap((region, ri) => {
      if (intensity && region.muscle !== null && !(region.muscle in intensity)) {
        return region.shapes.map((s, si) => (
          <rect
            key={`${dx}-${ri}-${si}`}
            className="bp-idle"
            x={s.x + dx}
            y={s.y}
            width={s.w}
            height={s.h}
            rx={Math.min(1.2, s.w / 3)}
          />
        ))
      }
      const tone =
        region.muscle === null
          ? 'idle'
          : primarySet.has(region.muscle)
            ? 'primary'
            : secondarySet.has(region.muscle)
              ? 'secondary'
              : 'idle'
      // With an intensity map the fill carries a magnitude, so a region with a
      // little work reads differently from one with a lot. Floored well above
      // zero, or light weeks would be invisible.
      const shade =
        intensity && region.muscle !== null ? intensity[region.muscle] : undefined
      return region.shapes.map((s, si) => (
        <rect
          key={`${dx}-${ri}-${si}`}
          className={shade === undefined ? `bp-${tone}` : 'bp-primary'}
          opacity={shade === undefined ? undefined : 0.22 + 0.78 * shade}
          x={s.x + dx}
          y={s.y}
          width={s.w}
          height={s.h}
          rx={Math.min(1.2, s.w / 3)}
        />
      ))
    })

  return (
    <svg
      className={`bodyplan ${className}`.trim()}
      viewBox={`0 0 ${totalW} ${H}`}
      width={(size * totalW) / H}
      height={size}
      role={title ? 'img' : 'presentation'}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      {sides.flatMap((regions, i) => draw(regions, i * (W + GAP)))}
    </svg>
  )
}
