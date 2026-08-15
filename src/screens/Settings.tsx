import { useEffect, useState } from 'react'
import { fi } from '../i18n'
import { ProfileFields } from '../components/ProfileFields'
import { latestBodyweight, logBodyweight } from '../lib/body'
import { canVibrate, testCue } from '../lib/cue'
import { countDemoSessions, removeDemoSessions, seedDemoSessions } from '../lib/demo'
import { shortDate } from '../lib/format'
import { stepKg } from '../lib/plates'
import {
  DEFAULT_GYM,
  KNOWN_DISCS,
  readGym,
  readProfile,
  useAlerts,
  writeAlerts,
  writeGym,
  writeProfile,
} from '../lib/settings'
import { toast } from '../lib/toast'
import type { Alerts, Profile } from '../lib/settings'
import type { GymSettings } from '../types'

/**
 * The gym's actual hardware. Three things derive from it — the plate breakdown,
 * the pad's steppers, and the smallest progression step — so a wrong value makes
 * the app confidently misleading rather than merely imprecise.
 */
export function Settings({ onBack }: { onBack: () => void }) {
  const [gym, setGym] = useState<GymSettings | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [weight, setWeight] = useState<string | null>(null)

  useEffect(() => {
    readGym().then(setGym)
    readProfile().then(setProfile)
    latestBodyweight().then((b) => setWeight(b ? String(b.kg) : ''))
  }, [])

  if (!gym || !profile || weight === null) return <p className="blank note">{fi.loading}</p>

  // Onboarding's fields, still editable — the same component, so they cannot
  // drift apart. Writes as you go rather than on a Jatka that does not exist here.
  const saveProfile = (next: Profile) => {
    setProfile(next)
    void writeProfile(next)
  }

  const save = async (next: GymSettings) => {
    setGym(next)
    await writeGym(next)
  }

  const toggleDisc = (disc: number) => {
    const has = gym.discs.includes(disc)
    const discs = has ? gym.discs.filter((d) => d !== disc) : [...gym.discs, disc]
    // Removing the last disc would make every load unreachable.
    if (!discs.length) {
      toast(fi.needOneDisc, { tone: 'warn' })
      return
    }
    save({ ...gym, discs: discs.sort((a, b) => b - a) })
  }

  return (
    <>
      <header className="masthead">
        <button className="back" onClick={onBack}>
          ← {fi.back}
        </button>
        <h1 className="t-title">{fi.settings}</h1>
        <span className="t-data">{fi.gymSetup}</span>
      </header>

      <div className="panel">
        <div className="panel-head">
          <span className="t-data">{fi.profile}</span>
        </div>
        <ProfileFields value={profile} onChange={saveProfile} />

        <div className="field">
          <div className="field-label">
            <span className="t-data">{fi.bodyweight}</span>
          </div>
          {/* Appends a dated reading rather than overwriting a setting, so the
              copy must not read like a preference. Same day replaces itself. */}
          <input
            type="number"
            inputMode="decimal"
            step="0.1"
            value={weight}
            placeholder="80"
            onChange={(e) => setWeight(e.target.value)}
            onBlur={() => {
              const kg = Number(weight.replace(',', '.'))
              if (Number.isFinite(kg) && kg > 0) void logBodyweight(kg)
            }}
          />
          <p className="note field-note">{fi.bodyweightHint}</p>
        </div>
      </div>

      <div className="panel">
        <div className="field">
          <div className="field-label">
            <span className="t-data">{fi.barWeight}</span>
          </div>
          <div className="bar-row">
            {[20, 15, 10, 7].map((kg) => (
              <button
                key={kg}
                className="toggle"
                aria-pressed={gym.barKg === kg}
                onClick={() => save({ ...gym, barKg: kg })}
              >
                {kg} kg
              </button>
            ))}
          </div>
          <input
            className="bar-custom"
            type="number"
            inputMode="decimal"
            min={1}
            step={0.5}
            value={gym.barKg}
            aria-label={fi.barWeight}
            onChange={(e) => {
              const kg = Number(e.target.value)
              if (kg > 0) save({ ...gym, barKg: kg })
            }}
          />
        </div>
      </div>

      <div className="panel">
        <div className="field">
          <div className="field-label">
            <span className="t-data">{fi.availableDiscs}</span>
          </div>
          <div className="chipset">
            {KNOWN_DISCS.map((disc) => (
              <button
                key={disc}
                className="toggle"
                aria-pressed={gym.discs.includes(disc)}
                onClick={() => toggleDisc(disc)}
              >
                {disc}
              </button>
            ))}
          </div>
        </div>
        <p className="note">{fi.smallestStep(stepKg(gym))}</p>
      </div>

      <RestAlerts />

      <DemoData />

      <div className="panel">
        <div className="row-actions">
          <button
            className="btn"
            onClick={() => {
              save(DEFAULT_GYM)
              toast(fi.restoredDefaults)
            }}
          >
            {fi.restoreDefaults}
          </button>
        </div>
      </div>
    </>
  )
}

/**
 * How the end of a rest period announces itself.
 *
 * Notification permission is requested when the toggle is switched on and never
 * on load — an unprompted permission dialog is how you get denied permanently.
 * If it is refused the toggle goes back off rather than sitting on and lying.
 */
function RestAlerts() {
  const alerts = useAlerts()

  const set = async (key: keyof Alerts, value: boolean) =>
    writeAlerts({ ...alerts, [key]: value })

  const toggleVibrate = async () => {
    if (!alerts.vibrate && !canVibrate()) {
      toast(fi.vibrateUnsupported, { tone: 'warn' })
      return
    }
    await set('vibrate', !alerts.vibrate)
  }

  /**
   * Fires the cue exactly as a finished rest period would, because otherwise the
   * only way to hear it is to sit through a real rest — which is both slow and the
   * worst moment to discover the beep is inaudible.
   */
  const test = () => {
    if (!alerts.vibrate && !alerts.sound && !alerts.notify) {
      toast(fi.alertTestOff, { tone: 'warn' })
      return
    }
    testCue(alerts, fi.restDone, fi.alertTest)
  }

  const toggleNotify = async () => {
    if (alerts.notify) return set('notify', false)
    if (typeof Notification === 'undefined') {
      toast(fi.notifyUnsupported, { tone: 'warn' })
      return
    }
    const permission =
      Notification.permission === 'granted'
        ? 'granted'
        : await Notification.requestPermission()
    if (permission !== 'granted') {
      toast(fi.notifyDenied, { tone: 'warn' })
      return
    }
    await set('notify', true)
  }

  return (
    <div className="panel">
      <div className="panel-head">
        <span className="t-data">{fi.alerts}</span>
      </div>
      <div className="chipset">
        <button
          className="toggle"
          aria-pressed={alerts.vibrate}
          onClick={toggleVibrate}
        >
          {fi.alertVibrate}
        </button>
        <button
          className="toggle"
          aria-pressed={alerts.sound}
          onClick={() => set('sound', !alerts.sound)}
        >
          {fi.alertSound}
        </button>
        <button className="toggle" aria-pressed={alerts.notify} onClick={toggleNotify}>
          {fi.alertNotify}
        </button>
        <button className="toggle" onClick={test}>
          {fi.alertTest}
        </button>
      </div>
      <p className="note">{fi.alertsHint}</p>
    </div>
  )
}

/**
 * Generated training history, so the screens that need one have something to
 * show. Several of them say nothing at all on a fresh install — the movement
 * plot will not draw under three sessions.
 *
 * It only ever adds and removes its own `demo-` sessions, so removing it cannot
 * take a real workout with it. That is why there is no "clear all sessions"
 * button here: this needs to be safe to press twice.
 */
function DemoData() {
  const [count, setCount] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    countDemoSessions().then(setCount)
  }, [])

  return (
    <div className="panel">
      <div className="panel-head">
        <span className="t-data">{fi.demoData}</span>
      </div>
      <p className="note">{fi.demoDataHint}</p>
      <div className="row-actions">
        <button
          className="btn"
          disabled={busy}
          onClick={async () => {
            setBusy(true)
            const { sessions, from, to } = await seedDemoSessions()
            setCount(await countDemoSessions())
            setBusy(false)
            toast(
              sessions
                ? fi.demoDataAdded(sessions, shortDate(from), shortDate(to))
                : fi.demoDataNoRoutines,
              sessions ? undefined : { tone: 'warn' },
            )
          }}
        >
          {fi.generateDemoData}
        </button>
        {count !== null && count > 0 && (
          <button
            className="btn"
            disabled={busy}
            onClick={async () => {
              setBusy(true)
              const removed = await removeDemoSessions()
              setCount(0)
              setBusy(false)
              toast(fi.demoDataRemoved(removed))
            }}
          >
            {fi.removeDemoData}
          </button>
        )}
      </div>
      {count !== null && count > 0 && (
        <p className="note">{fi.demoDataPresent(count)}</p>
      )}
    </div>
  )
}
