/**
 * A row of chips where tapping the pressed one clears the choice.
 *
 * That deselect is what makes an optional field honest — a segmented control,
 * which always has one half active, would make an unanswered question look
 * answered. Extracted from MovementEdit so onboarding and the movement editor
 * cannot drift apart.
 */
export function Choice({
  options,
  labels,
  value,
  onChange,
  roomy = false,
}: {
  options: readonly string[]
  labels: Record<string, string>
  value: string | null
  onChange: (v: string | null) => void
  /** Full 48px targets, for screens that are not competing for space mid-set. */
  roomy?: boolean
}) {
  return (
    <div className={`chipset${roomy ? ' roomy' : ''}`}>
      {options.map((option) => (
        <button
          key={option}
          className="toggle"
          aria-pressed={value === option}
          onClick={() => onChange(value === option ? null : option)}
        >
          {labels[option] ?? option}
        </button>
      ))}
    </div>
  )
}
