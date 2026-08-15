import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { ProfileFields } from '../components/ProfileFields'
import { RoutineList } from '../components/RoutineList'
import { fi } from '../i18n'
import { logBodyweight } from '../lib/body'
import { recommendedGroup } from '../lib/goals'
import { listMovements } from '../lib/movements'
import { completeOnboarding } from '../lib/onboarding'
import { listTemplates, startSession } from '../lib/session'
import { EMPTY_PROFILE, writeProfile, type Profile } from '../lib/settings'
import type { Template } from '../types'

/**
 * First run.
 *
 * A wall, deliberately — and the spec's first-run decision is "pick one and
 * start, no builder wall", so the tension is paid down the only way available:
 * one required field, everything else optional on one screen, and the last step
 * of the wall is the first tap of training.
 *
 * A screen rather than a sheet. Every sheet in this app has a Sulje and closes
 * on a backdrop tap; something that cannot be dismissed must not wear the
 * clothes of something that can.
 */
export function Onboarding({ onStarted }: { onStarted: (sessionId: string) => void }) {
  const [step, setStep] = useState<1 | 2>(1)
  const [profile, setProfile] = useState<Profile>(EMPTY_PROFILE)
  const [weight, setWeight] = useState('')

  const submit = async () => {
    await writeProfile(profile)
    const kg = Number(weight.replace(',', '.'))
    if (Number.isFinite(kg) && kg > 0) await logBodyweight(kg)
    // Marked done here, not after the routine step: someone who closes the app
    // while choosing has already told us who they are and must not be walled
    // again. Tänään offers `Valitse ohjelma` for exactly that state.
    await completeOnboarding()
    setStep(2)
  }

  if (step === 1) {
    return (
      <>
        <header className="masthead">
          <h1 className="t-title">{fi.welcome}</h1>
          <span className="t-data">{fi.onboardingStep(1, 2)}</span>
        </header>

        <div className="panel">
          <p className="note onboard-intro">{fi.onboardingIntro}</p>
          <ProfileFields value={profile} onChange={setProfile} />

          <div className="field">
            <div className="field-label">
              <span className="t-data">{fi.bodyweight}</span>
            </div>
            <input
              type="number"
              inputMode="decimal"
              step="0.1"
              value={weight}
              placeholder="80"
              onChange={(e) => setWeight(e.target.value)}
            />
            <p className="note field-note">{fi.bodyweightHint}</p>
          </div>

          <p className="note field-note">{fi.profileStoredHint}</p>
        </div>

        <div className="panel">
          {/* The only thing that can block: a blank field is the skip, so four
              "Ohita" links would each do what leaving a field empty already
              does — and imply the blank fields were stopping you. */}
          <button
            className="btn solid btn-tall onboard-commit"
            disabled={!profile.name.trim()}
            onClick={submit}
          >
            {fi.continueOn}
          </button>
          <p className="note field-note">{fi.onboardingOnlyName}</p>
        </div>
      </>
    )
  }

  return <FirstRoutine goal={profile.goal} onStarted={onStarted} onSkip={() => onStarted('')} />
}

/**
 * The goal marks a group; it never filters one. All seven routines stay listed
 * and startable — steering is helpful, hiding is not.
 */
function FirstRoutine({
  goal,
  onStarted,
  onSkip,
}: {
  goal: Profile['goal']
  onStarted: (sessionId: string) => void
  onSkip: () => void
}) {
  const data = useLiveQuery(async () => ({
    templates: await listTemplates(),
    movements: await listMovements(),
  }))

  if (!data) return <p className="blank note">{fi.loading}</p>

  const group = recommendedGroup(goal, data.templates)
  const byId = new Map(data.movements.map((m) => [m.id, m]))

  const begin = async (template?: Template) => onStarted(await startSession(template))

  return (
    <>
      <header className="masthead">
        <h1 className="t-title">{fi.chooseFirstRoutine}</h1>
        <span className="t-data">{fi.onboardingStep(2, 2)}</span>
      </header>

      <p className="note onboard-intro">{fi.chooseFirstRoutineHint}</p>

      <RoutineList
        templates={data.templates}
        movements={byId}
        meta={(id) => ({
          lastDoneAt: null,
          isNext: group !== null && data.templates.find((t) => t.id === id)?.group === group,
        })}
        markLabel={fi.recommended}
        onStart={begin}
        startLabel={fi.start}
      />

      <button className="hero-secondary onboard-later" onClick={onSkip}>
        {fi.startLater}
      </button>
    </>
  )
}
