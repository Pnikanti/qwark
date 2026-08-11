import { useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'

interface DragState {
  from: number
  to: number
  /** Pixels moved since the grab, for the lift transform. */
  dy: number
  startY: number
  rowHeight: number | null
}

/**
 * Reorder a vertical list by dragging a handle.
 *
 * Pointer Events rather than HTML5 drag-and-drop: this is a phone-first app and
 * `dragstart` never fires from touch. Row height is measured on the first move
 * instead of at grab time, because the list collapses to uniform rows once a
 * drag begins — which is also what makes the index maths a single division.
 *
 * Keyboard users get the same operation from the handle with the arrow keys.
 */
export function useDragReorder(
  count: number,
  onCommit: (from: number, to: number) => void,
) {
  const listRef = useRef<HTMLUListElement>(null)
  const [drag, setDrag] = useState<DragState | null>(null)

  const measureRow = (): number => {
    const rows = listRef.current?.children
    if (!rows?.length) return 50
    return (rows[0] as HTMLElement).getBoundingClientRect().height || 50
  }

  const onPointerDown = (index: number) => (e: ReactPointerEvent<HTMLElement>) => {
    if (count < 2 || e.button !== 0) return
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    setDrag({ from: index, to: index, dy: 0, startY: e.clientY, rowHeight: null })
  }

  const onPointerMove = (e: ReactPointerEvent<HTMLElement>) => {
    if (!drag) return
    const rowHeight = drag.rowHeight ?? measureRow()
    const dy = e.clientY - drag.startY
    const to = Math.max(
      0,
      Math.min(count - 1, drag.from + Math.round(dy / rowHeight)),
    )
    setDrag({ ...drag, dy, to, rowHeight })
  }

  const onPointerUp = () => {
    if (!drag) return
    if (drag.to !== drag.from) onCommit(drag.from, drag.to)
    setDrag(null)
  }

  const onKeyDown = (index: number) => (e: React.KeyboardEvent) => {
    const delta = e.key === 'ArrowUp' ? -1 : e.key === 'ArrowDown' ? 1 : 0
    if (!delta) return
    const to = index + delta
    if (to < 0 || to >= count) return
    e.preventDefault()
    onCommit(index, to)
  }

  /** Spread onto the drag handle of row `index`. */
  const handleProps = (index: number) => ({
    onPointerDown: onPointerDown(index),
    onPointerMove,
    onPointerUp,
    onPointerCancel: onPointerUp,
    onKeyDown: onKeyDown(index),
  })

  /** Offset for a row while a drag is in progress, so the list previews the move. */
  const rowOffset = (index: number): number => {
    if (!drag || drag.rowHeight === null) return 0
    if (index === drag.from) return drag.dy
    const h = drag.rowHeight
    if (drag.from < drag.to && index > drag.from && index <= drag.to) return -h
    if (drag.from > drag.to && index < drag.from && index >= drag.to) return h
    return 0
  }

  return {
    listRef,
    dragging: drag !== null,
    draggingIndex: drag?.from ?? null,
    handleProps,
    rowOffset,
  }
}
