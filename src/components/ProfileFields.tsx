import { Choice } from './Choice'
import { fi } from '../i18n'
import { GOALS } from '../lib/goals'
import type { Goal } from '../lib/goals'
import type { Profile, Sex } from '../lib/settings'

const SEXES = ['male', 'female'] as const

const SEX_LABELS: Record<string, string> = {
  male: fi.sexMale,
  female: fi.sexFemale,
}

const GOAL_LABELS: Record<string, string> = {
  strength: fi.goalStrength,
  muscle: fi.goalMuscle,
  habit: fi.goalHabit,
}

/**
 * Name, sex, birth year and goal — the same form in onboarding and in Asetukset.
 *
 * Shared rather than written twice: "these stay editable afterwards" is only
 * true if there is one form. Two copies diverge on the first change.
 *
 * Controlled, so the host decides when to persist: onboarding holds a draft and
 * writes once on Jatka, Asetukset writes as you go.
 */
export function ProfileFields({
  value,
  onChange,
}: {
  value: Profile
  onChange: (next: Profile) => void
}) {
  const year = new Date().getFullYear()

  return (
    <>
      <div className="field">
        <div className="field-label">
          <span className="t-data">{fi.yourName}</span>
        </div>
        <input
          value={value.name}
          placeholder={fi.yourName}
          autoFocus
          onChange={(e) => onChange({ ...value, name: e.target.value })}
        />
      </div>

      <div className="field">
        <div className="field-label">
          <span className="t-data">{fi.sex}</span>
        </div>
        <Choice
          roomy
          options={SEXES}
          labels={SEX_LABELS}
          value={value.sex}
          onChange={(v) => onChange({ ...value, sex: v as Sex | null })}
        />
      </div>

      <div className="field">
        <div className="field-label">
          <span className="t-data">{fi.birthYear}</span>
        </div>
        <input
          type="number"
          inputMode="numeric"
          min={year - 100}
          max={year}
          value={value.birthYear ?? ''}
          placeholder="1990"
          onChange={(e) =>
            onChange({ ...value, birthYear: e.target.value ? Number(e.target.value) : null })
          }
        />
        <p className="note field-note">{fi.birthYearHint}</p>
      </div>

      <div className="field">
        <div className="field-label">
          <span className="t-data">{fi.goal}</span>
        </div>
        <Choice
          roomy
          options={GOALS}
          labels={GOAL_LABELS}
          value={value.goal}
          onChange={(v) => onChange({ ...value, goal: v as Goal | null })}
        />
        <p className="note field-note">{fi.goalHint}</p>
      </div>
    </>
  )
}
