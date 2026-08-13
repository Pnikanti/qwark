# Qwark — User Flow (v1, training)

Status: draft · Last updated: 2026-08-10

From login to a logged first workout. Companion to [SPEC.md](SPEC.md).

## Decisions

| Question | Decision |
|---|---|
| First run | Seeded Finnish templates — pick one, start, targets present |
| Main screen | Tänään (today's session) + routine list below |
| Set structure | Pre-filled from template; open-ended when ad hoc |
| Onboarding | No goal quiz, no assessment, no body-stat gate |

## Happy path

```
Kirjautuminen  (once, session persists)
      │
      ▼
Valmistellaan…  ← eager library sync, ONLY step requiring network
      │
      ▼
Tänään  ─ first run ─▶  Valitse ohjelma  ─▶  esikatselu  ─▶  Käytä tätä
      │                                                          │
      │◀─────────────────────────────────────────────────────────┘
      │
      ├──▶ "Aloita"          ─▶ Treeni käynnissä (movements + targets loaded)
      └──▶ "Aloita tyhjä"    ─▶ Treeni käynnissä (empty, add as you go)
                                        │
                                  Lisää liike ─▶ Liikkeen valinta
                                        │
                                  log set: kg × toistot ✓ ─▶ rest timer
                                        │
                                  Lopeta treeni
                                        │
                                        ▼
                                  Yhteenveto  (kesto, volyymi, ennätykset)
                                        │
                                        ▼
                                  Tänään  (now has history → next session pre-fills)
```

Tap budget: launch → logging in **1 tap**. A set whose numbers are unchanged from last time is **1 tap** to log.

## Screens

### Valmistellaan (first run only)

- Downloads the seeded exercise library and images into IndexedDB.
- Blocking, with progress. This is the one thing that cannot happen offline, so it happens eagerly at first login — never lazily at first search.
- Failure state: retry, with a clear "tarvitset verkkoyhteyden kerran" explanation.

### Tänään

**The landing screen greets you, then shows the week.** `Hei, Patrick` — the name
comes from Asetukset, and without one the heading stays `Tänään`. The greeting is
itself the way into today's detail, so the largest thing on screen is a target
rather than a label. A Monday-first strip of
seven days with the sessions logged on each, the week's totals, and how the work
landed across muscle groups — measured in **working sets per muscle**, not kilos,
because volume in kg scores every bodyweight movement as zero and sets per muscle
per week is the measure lifters actually use. Primary muscles count fully,
secondary at half.

It is retrospective by design. Today is *outlined* rather than filled — it is a
position, not an achievement — and there are no missed-day marks, because a plan
you deviate from is the shame mechanic `SPEC.md` rules out.

**Starting lives in a bottom action bar**, in the same dock as the tab bar so the
two stack rather than fighting over `bottom: 0`. It carries one action, at the
thumb, and has three states:

- **Unfinished session** — `Jatka treeniä`, in the accent wash. It outranks
  everything; nothing else should be started while a session is open.
- **Mid-cycle** — `Seuraava · Vetopäivä · 2/3`, with `Aloita` and `Muut ▸`.
- **No routine history** — `Valitse ohjelma`. There is no cycle position yet, so
  the bar offers a choice rather than a confirmation.

The bar is absent during a session, along with the tabs: a mis-tap mid-set would
be costly, and leaving a session is done by finishing it.

What used to be here — a `Seuraava` card, a resume banner, a way-in row and seven
routine rows — measured 1.84 screens and 16 controls to answer "what now". It is
one screen and nine controls, with everything else one tap away in the day view.

### Päivä

Tapping any past or present day in the strip opens it. Future days are not
tappable — there is nothing to show and nothing to plan.

- Sessions logged that day, each opening its summary. A day with nothing logged
  says so.
- **One action**: `Aloita treeni` today, `Lisää treeni` for a day already past. It
  opens the picker. Any day that has happened can take a workout — you might have
  forgotten to log one — and only the future cannot.

The routine list used to live here, which made this view answer two questions at
once: what happened, and what to do. It is four controls now.

### Valitse treeni

Choosing what to train, reached from the day's action or from `Muut ▸` in the
action bar. Routine groups in cycle order, each with its last-done date and the
cycle marker; **starting from nothing sits at the foot of the list**, the same
place the movement picker keeps `Luo oma liike` — you came here to choose, so the
escape hatch goes last.

Back returns to wherever the picker was opened from, not always to the day view:
reaching it from the action bar and landing on a day screen you never saw would be
its own kind of wrong.

A session added to a past day is dated to noon on that day, well clear of midnight
and DST boundaries, and is flagged `retro`. It **claims no duration**: it was never
timed, so the summary shows `–` rather than a fabricated figure. The flag is stored
rather than derived from dates, because a real session can start before midnight
and finish after it.

Sessions record `startedLocalDay` alongside the absolute `startedAt`. Bucketing an
instant by the *viewing* device's midnight moves a late-evening session to another
day as soon as you open the app in a different timezone; the day it belonged to is
decided once, when it started.

States, in priority order:

1. **Session in progress** — persistent banner `Jatka treeniä · aloitettu 14 h sitten`, with discard. Overrides all other states.
2. **First run** — the routine list, plus `Aloita tyhjä treeni`. Nothing is marked next: with no history there is no cycle position, and inventing one would be inventing a plan.
3. **Mid-cycle** — a `Seuraava` card names the next routine and its position (`Työntö / Veto / Jalat · 2/3`), with the primary `Aloita`. The same routine is marked in the list below; `Aloita tyhjä treeni` steps back to secondary.
4. **No routine history** — routine list with each entry's last-done date.

**What to train next is derived, not scheduled.** A routine group is an ordered cycle and finished sessions already record which routine they came from, so the next one falls out of history with nothing extra stored. There is deliberately no weekday calendar: it would be mostly empty cells for anyone training on the days they actually reach the gym, and a grid of missed Mondays is the shame mechanic `SPEC.md` rules out.

Training a routine from a different group moves the pointer to that group — the cycle follows what you did, not what a plan expected. Ad hoc sessions leave it untouched. Only the cycle you are part-way through carries the marker; every group has a "next", and marking them all would make the accent mean nothing.

Sync state is visible here: a quiet indicator when writes are still queued.

### Ohjelman esikatselu

- Shown before committing to a seeded template: days per week, movements per day, sets and target reps.
- `Käytä tätä` or back. No blind commitment, and the template is editable afterwards.

### Treeni käynnissä

The screen that matters. **One movement is expanded; everything else is a single line.**

The first build rendered every movement in full. Measured on a five-movement routine that was 92 buttons and 1.9 screens of scroll before a single set was logged — for an activity where exactly one set is live. The column header alone rendered five times. Density has to follow attention: the next set, then how much of this movement is left, then distantly what is coming.

```
JALKAPÄIVÄ                              ⋯
3 / 15 sarjaa · 12 min
▓▓▓░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
────────────────────────────────────────
✓  Jalkakyykky          100 kg × 8, 8, 8
────────────────────────────────────────
▏ Romanialainen maastaveto           1/3
▏ Edellinen: 90 kg × 8, 8, 7
▏
▏ LÄMMITTELY  50 × 8 · 70 × 5
▏ TYÖSARJAT   92,5 kg × 8          Muokkaa
▏
▏ [ LÄMMITTELY ] [ TYÖSARJA ]
▏ SARJA 2 / 3
▏ ┌──────────┐ ┌──────────┐ ┌────┐
▏ │    –     │ │     8    │ │ ✓  │   ← tick disabled
▏ │    kg    │ │  toistoa │ │    │
▏ └──────────┘ └──────────┘ └────┘
▏ ┌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌┐
▏ ╎ EHDOTUS 92,5 KG (+2,5)  TÄYTÄ ╎
▏ └╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌┘
▏ + Muistiinpano
────────────────────────────────────────
   Jalkaprässi              0/3 · 3 × 10
   Pohkeen nosto seisten    0/4 · 4 × 12
────────────────────────────────────────
   + Lisää liike
────────────────────────────────────────
 PALAUTUS   2:14                  OHITA
 Seuraava: Sarja 3 · 92,5 kg × 8
```

- **One movement expanded**, marked with a cobalt rule. It **auto-advances** on the transition into completion — once only, so returning to add an extra set does not bounce you away again. Any collapsed line is one tap away, so an occupied machine costs nothing.
- **Work beyond the plan is additive, never inflated.** A sixth set on a five-set movement reads `5/5 +1` and the input says `Lisäsarja 1`. `6/5` would state one confusing thing where there are two true ones, and it made the session rail exceed its own track.
- **One input, not a row per set.** The set you are about to do is the only editable thing on screen. Committing it moves it into the log and opens a fresh, blank one.
- **Loads are inferred and offered, never filled in for you.** The suggestion sits below the input with a dashed border — offered, not entered — and one tap applies it. Within a session it repeats what you last lifted; across sessions it is the progression proposal, with its reasoning attached. Target reps *do* pre-fill, because they come from the routine you chose rather than from a guess.
- **A set needs both values before it can be logged**, so nothing is ever recorded that you did not affirm. `0` counts — it means bodyweight.
- **Warmups are first-class and do not consume planned sets.** The kind is chosen *before* logging, so a warmup is never a working row that got reclassified. They are excluded from the count, from volume, and from 1RM — three warmups must not "finish" a three-set movement. A familiar ramp replays itself from last session's warmups.
- **The kind is never changed for you.** Guessing that a ramp has finished would silently mislabel a set.
- **Logged work reads as two lines**, warmups and working separately, expandable to edit or delete a set. Logged sets are records: they can be corrected or removed, never un-ticked — that would leave two sets in flight at once.
- **Previous performance and the proposal** sit above the input. The comparison is the habit loop.
- **One tick** commits the set, starts the rest timer, and fires a haptic. Warmups skip the timer — you move through them quickly.
- Tapping a load opens the **custom numeric pad** with plate-pair steppers and a plate calculator, sized from your gym settings. Never the OS keyboard.
- **Rest is dead time, so it is where the plan belongs.** While the timer runs, the bar names the next set or movement and collapsed rows reveal their targets, then it folds away again.
- Tap targets ≥48 px — used mid-set with sweaty hands.
- Every change writes to IndexedDB immediately, including the un-committed input, so a reload mid-set loses nothing.

Result: 14 controls on one screen, against 23 for the row grid and 92 before the accordion.

### Liikkeen valinta

- Search by Finnish or English name; filter by muscle group and equipment.
- Recents and frequents first. **On first run these are empty** — seed the list with the common compounds instead of showing a blank panel.
- Create a custom movement inline, without leaving the flow.

### Yhteenveto

- Duration, total volume, per-movement recap, any records beaten.
- Ad hoc sessions offer `Tallenna pohjaksi` here.
- A session opened but with no completed sets is discarded rather than saved as junk.

## Liikekirjaston hallinta (admin)

The seeded Finnish names are drafts, so correcting them in-app is the fix loop — not editing the build script and rebuilding. Same for the metadata gaps free-exercise-db leaves behind.

### The layering rule

Seed rows are **immutable**. Admin edits live in a separate override layer keyed by movement id, merged at read time:

```
movements          seed, replaced wholesale on library update
      +
movement_overrides user edits, one row per patched movement
      =
effective movement  what the app reads
```

Without this, re-running the build script or re-syncing the library silently destroys every correction. With it, edits survive a seed update, a single field can be reset to its seed default, and the override set is exactly the diff worth folding back into the repo.

### What is canonical

**The `id` is canonical — neither name is.**

| Field | Role | Editable |
|---|---|---|
| `id` | canonical key, referenced by every logged set and template | never |
| `nameEn` | search aid and fallback label | yes |
| `nameFi` | primary user-facing label | yes |

Both names are user-facing; `nameFi` is the label, `nameEn` is what makes search work when you type "bench" rather than "penkki". Both are editable, and `nameEn` in particular will want editing — upstream names are provenance, not labels (`Hyperextensions (Back Extensions)`, `Palms-Up Barbell Wrist Curl Over A Bench`).

Because the id carries the reference, renaming either name never touches history.

**Treat the id as opaque.** It is generated once by slugifying the upstream English name, then frozen — so after a `nameEn` edit it no longer matches the visible name, by design. Never parse it, display it, or derive a name from it.

Ids are pinned in `data/id-ledger.json` rather than recomputed each build, because upstream has no stable identifier of its own (its `id` field is slugified from the name, so it rotates on rename). Without the ledger an upstream rename would mint a fresh id and orphan every set logged against the old one. See the script's `THE ID LEDGER` docstring for the resolution procedure.

### Screens

**Liikekirjasto** — the library list, with an edit affordance per row. Filters include a `Tarkistettavat` (needs review) view driven by the gaps the build script reports: missing `nameFi`, `mechanic`, `force`, or `equipment`.

**Liikkeen muokkaus** — per-movement editor:

```
Penkkipunnerrus                              ⋯
────────────────────────────────────────────────
  Nimi (FI)      [ Penkkipunnerrus          ]
  Nimi (EN)      [ Barbell Bench Press - M… ]
  Ensisijainen   [ Rintalihakset         ▾ ]
  Toissijainen   [ Olkapäät, Ojentajat   ▾ ]
  Välineet       [ Levytanko             ▾ ]
  Tyyppi         [ Compound              ▾ ]
  Suunta         [ Push                  ▾ ]
────────────────────────────────────────────────
  ● muokattu — palauta alkuperäinen
```

- Edited fields are marked, with a per-field reset to the seed value.
- Hiding a movement is an override (`hidden`), not a delete — the seed row stays, and history referencing it still resolves.

**Joukkokäännös** (bulk rename) — the efficient path for a translation pass: a two-column list of `nameEn` → `nameFi` inputs, keyboard-tabbable, no navigation between movements. This is how 68 draft names get reviewed in one sitting rather than 68 screen visits.

**Vie / tuo** (export / import) — export the override set as JSON matching `data/overrides.json`. Drop that file in the repo, re-run `scripts/build-movements.py`, and the corrections become permanent. The script validates it, rejects patches to `id`, and warns on ids it doesn't recognise.

### Why an "admin" mode at all in a single-user app

There is one user, so this is not permissioning — it is a mode switch that keeps destructive editing out of the way of logging. Editing is reachable from the library, never from the live session screen, where a mis-tap during a set would be costly.

## The first-session problem

The app's core value is pre-filling from history, which on day one does not exist. Seeded templates supply structure and target reps, but **not loads** — we do not invent weights the user hasn't lifted.

So session one shows `Ei aiempaa tietoa` and blank kg fields. This is a one-time cost, paid once per movement, and it is the honest option. From session two onward every field arrives pre-filled.

## Edge cases worth designing, not discovering

- Losing signal mid-session — nothing visible changes; the sync badge shows pending writes.
- Session left open overnight — resume banner states how long ago it started, and offers discard.
- Phone locks mid-workout — rest timer continues, notification still fires.
- Template edited after sessions were logged against it — history keeps what was actually done, not the new plan.

## Research behind these choices

- **Hevy** keeps onboarding near-empty — no goal quiz, no assessment, no paywall; reviewers log a first set in under 90 seconds. Its primary path is nonetheless routine-first (`Start Routine`), with empty workouts as the improvise escape hatch, and it ships a browsable routine library filtered by experience, goal, and equipment. Its three tabs are Home (social feed), Workout, Profile — since social is out of scope here, its Workout tab is the true analogue of Tänään.
- **Strong** optimises for "you are mid-session, resting, log before the timer runs out", and contributes the visual plate calculator.
- **Fitbod** takes the opposite approach: one quiz, then it generates the first workout outright. Effective, but it needs the algorithm deferred out of v1.
- Category UX guidance: ≥48 px targets, haptic on set completion, designed for sweaty hands.

Sources: [Hevy logging guide](https://www.hevyapp.com/hevy-tutorial/) · [Hevy routines](https://www.hevyapp.com/features/gym-routines/) · [Hevy review](https://repreturn.com/hevy-app-review/) · [Strong vs Hevy](https://repreturn.com/strong-app-vs-hevy/) · [Fitbod getting started](https://help.fitbod.me/hc/en-us/articles/30721771750039-Getting-Started-with-Fitbod-A-New-User-s-Guide) · [fitness app UX](https://stormotion.io/blog/fitness-app-ux/)
