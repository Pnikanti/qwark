import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { BodyPlan } from '../components/BodyPlan'
import { MovementHistory, MovementOverview } from '../components/MovementHistory'
import { equipmentFi, fi, muscleFi, tax } from '../i18n'
import {
  deleteMovement,
  getMovement,
  patchMovement,
  resetField,
} from '../lib/movements'
import { readUi, useUi, writeUi } from '../lib/settings'
import { toast } from '../lib/toast'
import type { EffectiveMovement, Patchable } from '../types'

const MECHANIC = ['compound', 'isolation']
const FORCE = ['push', 'pull', 'static']
const LEVEL = ['beginner', 'intermediate', 'expert']

/**
 * A movement: what it works, what you have lifted on it, and how it is described.
 *
 * Read-only by default. The fields that define the canonical record — both names,
 * the muscle pickers, the taxonomy selects, delete — appear only under `Hallinta`,
 * the same mode the library uses, because correcting seeded data and looking up
 * your squat history are different activities that were sharing one screen.
 */
export function MovementEdit({ id, onBack }: { id: string; onBack: () => void }) {
  const movement = useLiveQuery(() => getMovement(id), [id])
  const { admin } = useUi()
  const [musclesOpen, setMusclesOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  if (!movement) return <p className="blank note">{fi.loading}</p>

  const toggleAdmin = async () => writeUi({ ...(await readUi()), admin: !admin })

  const set = <K extends keyof Patchable>(field: K, value: Patchable[K]) =>
    patchMovement(id, { [field]: value } as Partial<Patchable>)

  return (
    <>
      <header className="masthead">
        <button className="back" onClick={onBack}>
          ← {fi.back}
        </button>
        <h1 className="t-title">{movement.nameFi ?? movement.nameEn}</h1>
        <span className="t-data">
          {movement.nameFi ? movement.nameEn : fi.nameFi + ' ' + fi.incomplete.toLowerCase()}
        </span>
        {/* Same place as the library's switch, so the mode lives in one spot
            rather than moving between the header and the body. */}
        <div className="masthead-actions end">
          <button className="btn" aria-pressed={admin} onClick={toggleAdmin}>
            {admin ? fi.doneEditing : fi.editMovement}
          </button>
        </div>
      </header>

      <div className="panel">
        <BodyPlan
          className="large"
          primary={movement.primaryMuscles}
          secondary={movement.secondaryMuscles}
          size={132}
          view="both"
          title={movement.primaryMuscles.map(muscleFi).join(', ')}
        />
      </div>

      {/* What you have actually lifted outranks how the movement is described,
          so the plot is on the page rather than behind a row. The full session
          ledger is still a tap away, in the sheet. */}
      <MovementOverview movementId={movement.id} onOpenAll={() => setHistoryOpen(true)} />

      {historyOpen && (
        <MovementHistory
          movementId={movement.id}
          name={movement.nameFi ?? movement.nameEn}
          onClose={() => setHistoryOpen(false)}
        />
      )}

      {/* Reading the record: what the movement is, stated rather than editable. */}
      {!admin && (
        <>
          <div className="panel">
            <div className="panel-head">
              <span className="t-data">{fi.movementDetails}</span>
            </div>
            <dl className="summary">
              <dt className="t-data">{fi.primaryMuscles}</dt>
              <dd>{movement.primaryMuscles.map(muscleFi).join(', ') || '–'}</dd>
              <dt className="t-data">{fi.secondaryMuscles}</dt>
              <dd>{movement.secondaryMuscles.map(muscleFi).join(', ') || '–'}</dd>
              <dt className="t-data">{fi.equipment}</dt>
              <dd>{equipmentFi(movement.equipment)}</dd>
              {movement.mechanic && (
                <>
                  <dt className="t-data">{fi.mechanic}</dt>
                  <dd>{fi.mechanicValue[movement.mechanic] ?? movement.mechanic}</dd>
                </>
              )}
              {movement.force && (
                <>
                  <dt className="t-data">{fi.force}</dt>
                  <dd>{fi.forceValue[movement.force] ?? movement.force}</dd>
                </>
              )}
            </dl>
          </div>
        </>
      )}

      {admin && (
        <>
      <div className="panel">
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
      </div>

      {/* The glyph above already shows which muscles are set, so the pickers stay
          folded away until you actually want to change them. */}
      <div className="panel">
        <div className="field-label">
          <span className="t-data">{fi.muscles}</span>
          {(movement.edited.has('primaryMuscles') ||
            movement.edited.has('secondaryMuscles')) && (
            <span className="edited-note">
              <span className="pip" />
              {fi.edited}
            </span>
          )}
          <button
            className="revert"
            aria-expanded={musclesOpen}
            onClick={() => setMusclesOpen((v) => !v)}
          >
            {musclesOpen ? fi.close : fi.change}
          </button>
        </div>

        {musclesOpen ? (
          <>
            <Field movement={movement} field="primaryMuscles" label={fi.primaryMuscles}>
              <MusclePicker
                selected={movement.primaryMuscles}
                onChange={(next) => set('primaryMuscles', next)}
              />
            </Field>
            <Field
              movement={movement}
              field="secondaryMuscles"
              label={fi.secondaryMuscles}
            >
              <MusclePicker
                selected={movement.secondaryMuscles}
                onChange={(next) => set('secondaryMuscles', next)}
              />
            </Field>
          </>
        ) : (
          <dl className="summary">
            <dt className="t-data">{fi.primaryMuscles}</dt>
            <dd>{movement.primaryMuscles.map(muscleFi).join(', ') || '–'}</dd>
            <dt className="t-data">{fi.secondaryMuscles}</dt>
            <dd>{movement.secondaryMuscles.map(muscleFi).join(', ') || '–'}</dd>
          </dl>
        )}
      </div>

      <div className="panel">
        <Field movement={movement} field="equipment" label={fi.equipment}>
          <select
            value={movement.equipment ?? ''}
            onChange={(e) => set('equipment', e.target.value || null)}
          >
            <option value="">–</option>
            {Object.keys(tax.equipment)
              .sort((a, b) => equipmentFi(a).localeCompare(equipmentFi(b), 'fi'))
              .map((key) => (
                <option key={key} value={key}>
                  {equipmentFi(key)}
                </option>
              ))}
          </select>
        </Field>
        <Field movement={movement} field="mechanic" label={fi.mechanic}>
          <Choice
            options={MECHANIC}
            labels={fi.mechanicValue}
            value={movement.mechanic}
            onChange={(v) => set('mechanic', v)}
          />
        </Field>
        <Field movement={movement} field="force" label={fi.force}>
          <Choice
            options={FORCE}
            labels={fi.forceValue}
            value={movement.force}
            onChange={(v) => set('force', v)}
          />
        </Field>
        <Field movement={movement} field="level" label={fi.level}>
          <Choice
            options={LEVEL}
            labels={fi.levelValue}
            value={movement.level}
            onChange={(v) => set('level', v)}
          />
        </Field>
      </div>

      <div className="panel">
        <Field movement={movement} field="hidden" label={fi.visibility}>
          <div className="chipset">
            <button
              className="toggle"
              aria-pressed={Boolean(movement.hidden)}
              onClick={() => set('hidden', !movement.hidden)}
            >
              {movement.hidden ? fi.hidden : fi.visible}
            </button>
          </div>
        </Field>
        <p className="note">{fi.hiddenNote}</p>
      </div>

      {'custom' in movement && (
        <div className="panel">
          <div className="panel-head">
            <span className="t-data">{fi.ownMovement}</span>
          </div>
          <div className="row-actions">
            <button
              className="btn"
              onClick={async () => {
                const { deleted } = await deleteMovement(id)
                if (deleted) {
                  toast(fi.movementDeleted)
                  onBack()
                } else {
                  // Deleting a referenced movement would orphan logged sets.
                  toast(fi.movementInUse, { tone: 'warn' })
                }
              }}
            >
              {fi.deleteMovement}
            </button>
          </div>
        </div>
      )}

      <div className="panel">
        <div className="panel-head">
          <span className="t-data">{fi.identity}</span>
        </div>
        <p className="note">
          <code>{movement.id}</code> — {fi.identityNote}
        </p>
      </div>

        </>
      )}

      {/* Instructions are reference material either way, so they stay. */}
      {movement.instructions.length > 0 && (
        <div className="panel">
          <div className="panel-head">
            <span className="t-data">{fi.instructions}</span>
          </div>
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

/** Label, edited marker, and per-field revert around any control. */
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
      <div className="field-label">
        <span className="t-data">{label}</span>
        {edited && (
          <>
            <span className="edited-note">
              <span className="pip" />
              {fi.edited}
            </span>
            <button className="revert" onClick={() => resetField(movement.id, field)}>
              {fi.revert}
            </button>
          </>
        )}
      </div>
      {children}
    </div>
  )
}

function Choice({
  options,
  labels,
  value,
  onChange,
}: {
  options: string[]
  labels: Record<string, string>
  value: string | null
  onChange: (v: string | null) => void
}) {
  return (
    <div className="chipset">
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
    <div className="chipset">
      {Object.keys(tax.muscles)
        .sort((a, b) => muscleFi(a).localeCompare(muscleFi(b), 'fi'))
        .map((key) => (
          <button
            key={key}
            className="toggle"
            aria-pressed={selected.includes(key)}
            onClick={() => toggle(key)}
          >
            {muscleFi(key)}
          </button>
        ))}
    </div>
  )
}
