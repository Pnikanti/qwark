import { useLiveQuery } from 'dexie-react-hooks'
import { equipmentFi, fi, muscleFi, tax } from '../i18n'
import { getMovement, patchMovement, resetField } from '../lib/movements'
import type { EffectiveMovement, Patchable } from '../types'

const MECHANIC = ['compound', 'isolation']
const FORCE = ['push', 'pull', 'static']
const LEVEL = ['beginner', 'intermediate', 'expert']

export function MovementEdit({ id, onBack }: { id: string; onBack: () => void }) {
  const movement = useLiveQuery(() => getMovement(id), [id])
  if (!movement) return <p className="note">{fi.loading}</p>

  const set = <K extends keyof Patchable>(field: K, value: Patchable[K]) =>
    patchMovement(id, { [field]: value } as Partial<Patchable>)

  return (
    <>
      <div className="topbar">
        <button className="ghost small" onClick={onBack}>
          ← {fi.back}
        </button>
        <h1>{fi.editMovement}</h1>
      </div>

      <div className="card">
        <Field movement={movement} field="nameFi" label={fi.nameFi}>
          <input
            value={movement.nameFi ?? ''}
            placeholder={movement.nameEn}
            onChange={(e) => set('nameFi', e.target.value.trim() || null)}
          />
        </Field>

        <Field movement={movement} field="nameEn" label={fi.nameEn}>
          <input
            value={movement.nameEn}
            onChange={(e) => set('nameEn', e.target.value)}
          />
        </Field>

        <Field movement={movement} field="primaryMuscles" label={fi.primaryMuscles}>
          <MusclePicker
            selected={movement.primaryMuscles}
            onChange={(next) => set('primaryMuscles', next)}
          />
        </Field>

        <Field movement={movement} field="secondaryMuscles" label={fi.secondaryMuscles}>
          <MusclePicker
            selected={movement.secondaryMuscles}
            onChange={(next) => set('secondaryMuscles', next)}
          />
        </Field>

        <Field movement={movement} field="equipment" label={fi.equipment}>
          <select
            value={movement.equipment ?? ''}
            onChange={(e) => set('equipment', e.target.value || null)}
          >
            <option value="">—</option>
            {Object.keys(tax.equipment).map((key) => (
              <option key={key} value={key}>
                {equipmentFi(key)}
              </option>
            ))}
          </select>
        </Field>

        <Field movement={movement} field="mechanic" label={fi.mechanic}>
          <Choice
            options={MECHANIC}
            value={movement.mechanic}
            onChange={(v) => set('mechanic', v)}
          />
        </Field>

        <Field movement={movement} field="force" label={fi.force}>
          <Choice
            options={FORCE}
            value={movement.force}
            onChange={(v) => set('force', v)}
          />
        </Field>

        <Field movement={movement} field="level" label={fi.level}>
          <Choice
            options={LEVEL}
            value={movement.level}
            onChange={(v) => set('level', v)}
          />
        </Field>
      </div>

      <div className="card">
        <div className="field">
          <label htmlFor="hidden-toggle">{fi.hideMovement}</label>
          <button
            id="hidden-toggle"
            className="chip"
            aria-pressed={Boolean(movement.hidden)}
            onClick={() => set('hidden', !movement.hidden)}
          >
            {movement.hidden ? fi.hidden : '—'}
          </button>
          <p className="note" style={{ marginTop: 'var(--s-2)' }}>
            {fi.hiddenNote}
          </p>
        </div>
        <p className="note">
          {fi.idNote} <code>{movement.id}</code>
        </p>
      </div>

      {movement.instructions.length > 0 && (
        <div className="card">
          <label>{fi.instructions}</label>
          <ol className="steps">
            {movement.instructions.map((step, i) => (
              <li key={i}>{step}</li>
            ))}
          </ol>
        </div>
      )}
    </>
  )
}

/** Wraps a control with its label, an edited marker, and a per-field reset. */
function Field({
  movement,
  field,
  label,
  children,
}: {
  movement: EffectiveMovement
  field: keyof Patchable
  label: string
  children: React.ReactNode
}) {
  const edited = movement.edited.has(field)
  return (
    <div className="field">
      <label>
        {label}
        {edited && (
          <span className="flag">
            <span className="dot" />
            {fi.edited}
            <button
              className="link"
              onClick={() => resetField(movement.id, field)}
              style={{ marginLeft: 'var(--s-2)' }}
            >
              {fi.resetField}
            </button>
          </span>
        )}
      </label>
      {children}
    </div>
  )
}

function Choice({
  options,
  value,
  onChange,
}: {
  options: string[]
  value: string | null
  onChange: (v: string | null) => void
}) {
  return (
    <div className="multi">
      {options.map((option) => (
        <button
          key={option}
          className="chip"
          aria-pressed={value === option}
          onClick={() => onChange(value === option ? null : option)}
        >
          {option}
        </button>
      ))}
    </div>
  )
}

function MusclePicker({
  selected,
  onChange,
}: {
  selected: string[]
  onChange: (next: string[]) => void
}) {
  const toggle = (key: string) =>
    onChange(
      selected.includes(key)
        ? selected.filter((k) => k !== key)
        : [...selected, key].sort(),
    )
  return (
    <div className="multi">
      {Object.keys(tax.muscles)
        .sort((a, b) => muscleFi(a).localeCompare(muscleFi(b), 'fi'))
        .map((key) => (
          <button
            key={key}
            className="chip"
            aria-pressed={selected.includes(key)}
            onClick={() => toggle(key)}
          >
            {muscleFi(key)}
          </button>
        ))}
    </div>
  )
}
