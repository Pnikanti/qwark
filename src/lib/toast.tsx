import { useEffect, useSyncExternalStore } from 'react'

export type ToastTone = 'info' | 'warn'

interface Toast {
  id: number
  message: string
  tone: ToastTone
  /** ms the toast stays up; longer for things the user should actually read. */
  duration: number
}

/**
 * Module-level store rather than context: `toast()` is called from event handlers
 * and async callbacks, and threading a hook through every one of them buys
 * nothing here.
 */
let toasts: Toast[] = []
const listeners = new Set<() => void>()
let nextId = 1

/** Newest first, capped — a stack of stale messages is worse than none. */
const MAX_VISIBLE = 3

function emit() {
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function snapshot() {
  return toasts
}

export function toast(
  message: string,
  { tone = 'info', duration }: { tone?: ToastTone; duration?: number } = {},
): void {
  const entry: Toast = {
    id: nextId++,
    message,
    tone,
    duration: duration ?? (tone === 'warn' ? 6000 : 3600),
  }
  toasts = [entry, ...toasts].slice(0, MAX_VISIBLE)
  emit()
}

export function dismissToast(id: number): void {
  toasts = toasts.filter((t) => t.id !== id)
  emit()
}

/**
 * Renders the live region. Mounted once, outside the screen switch, so a toast
 * survives the navigation that triggered it — "session discarded" is raised
 * while leaving the session screen.
 */
export function Toaster() {
  const items = useSyncExternalStore(subscribe, snapshot, snapshot)
  return (
    <div className="toaster" role="status" aria-live="polite">
      {items.map((t) => (
        <ToastRow key={t.id} toast={t} />
      ))}
    </div>
  )
}

function ToastRow({ toast: t }: { toast: Toast }) {
  useEffect(() => {
    const timer = setTimeout(() => dismissToast(t.id), t.duration)
    return () => clearTimeout(timer)
  }, [t.id, t.duration])

  return (
    <button
      className={`toast tone-${t.tone}`}
      onClick={() => dismissToast(t.id)}
      title={t.message}
    >
      <span className="grow">{t.message}</span>
      <span className="toast-x" aria-hidden="true">
        ×
      </span>
    </button>
  )
}
