import { useEffect, useRef, type ReactNode } from 'react'

/**
 * The bottom sheet, as a primitive.
 *
 * Five hand-rolled copies of this markup already exist and are deliberately
 * left alone: migrating them would give each one a focus trap, Escape and a
 * scroll lock, which is a behaviour change deserving its own diff and its own
 * device testing — `NumberPad` is the most-used control in the app and is not
 * something to refactor inside a feature.
 *
 * This exists because the dialogue is the first sheet that arrives *uninvited*.
 * Every other one opens on a tap, so a wrong dismissal costs nothing; here
 * dismissal correctness is load-bearing, and it needs Escape — which today
 * lives in exactly one place. Copying that a sixth time would put the same
 * logic in two files and let them drift.
 *
 * It owns only what is identical everywhere and what is missing everywhere. The
 * head, the height, the scroller and any commit bar stay with the caller.
 */

/** Nested sheets exist (NewMovement inside MovementPicker), so the lock counts. */
let locks = 0

export function Sheet({
  label,
  onClose,
  className = '',
  children,
}: {
  /** Announced as the dialog's name. */
  label: string
  onClose: () => void
  /** e.g. `tall`. Composed onto `.sheet`. */
  className?: string
  children: ReactNode
}) {
  const panel = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // Restore focus to whatever opened this, so dismissing does not strand the
    // caret at the top of the document.
    const opener = document.activeElement as HTMLElement | null

    // Focus the panel itself, not the first control: focusing a chip would make
    // a screen reader read the answer before the question it answers.
    panel.current?.focus()

    locks += 1
    const previousOverflow = document.body.style.overflow
    if (locks === 1) document.body.style.overflow = 'hidden'

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
        return
      }
      if (e.key !== 'Tab' || !panel.current) return
      // Keep Tab inside the panel while `aria-modal` claims it is modal —
      // otherwise the attribute asserts something the DOM does not honour.
      const focusable = panel.current.querySelectorAll<HTMLElement>(
        'button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])',
      )
      if (!focusable.length) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      const active = document.activeElement
      if (e.shiftKey && (active === first || active === panel.current)) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && active === last) {
        e.preventDefault()
        first.focus()
      }
    }

    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      locks -= 1
      if (locks === 0) document.body.style.overflow = previousOverflow
      opener?.focus?.()
    }
  }, [onClose])

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div
        ref={panel}
        className={`sheet${className ? ` ${className}` : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  )
}
