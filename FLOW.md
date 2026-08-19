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

**The landing is a hero answering "what today could be", with the week below it.**

The hero is the centrepiece and combines what used to be three separate things — a
greeting line, a mid-page card, and a bottom action bar. That arrangement left the
most important question, *what do I train*, as the smallest text on the screen
while a retrospective week strip carried the visual weight. This inverts it.

It is **centre-aligned**, the one deliberate exception to the left-aligned ledger
language, which is what lets it read as a centrepiece rather than a wide row. The
greeting is set as **two lines** — the greeting, then who it is for — so both can
carry real size. Four states, in priority order:

1. **Session underway** — `Kesken`, the routine, sets logged and elapsed, and
   `Jatka treeniä`.
2. **Mid-cycle** — `Seuraava treenisi` as a pill, then the body-plan glyph showing *what it works*
   before naming it, then the routine, its cycle position and size, when it was
   last done, its movements, and `Aloita`. `Muut vaihtoehdot ▸` reaches the picker.
   The group is dropped from the meta line when the routine name already carries
   it: `5×5 · 2/2` beside `5×5 B` says the same thing twice.
3. **Trained already today** — acknowledges it: `Tänään treenattu`, what was done,
   and what is next **stated rather than offered**, with a secondary `Lisää toinen
   treeni`. Proposing the next routine the moment you finish one reads as nagging.
4. **No history** — the greeting and `Valitse ohjelma`. No cycle position exists,
   so nothing is proposed; that would be inventing a plan.

The tag is a **pill** rather than floating text: floating text read as another line
of copy, which is how it was getting lost. `Valitse toinen treeni` rather than
`Muut vaihtoehdot`, because the picker holds routines *and* the blank start.

**The glyph appears once.** The week block used to carry one too, which put four
human figures on one screen and diluted the hero's. In the hero the glyph does real
work — a wordless preview of what you are about to train — while in the week block
it restated a precise numeric list sitting right beside it. The list stayed, and
grew to five muscle groups now that it has the room.

Below the hero: the week strip, restyled as support. **The day strip stays open;
only the muscle balance folds.** Collapsing the whole week would bury what the
landing is built around, and scrolling to it is cheaper than a tap — but the
balance is five rows of analysis, which is genuinely extra. The hero owns the first
screen and the week is meant to be scrolled to — trying to fit both above the fold
is what produced the cramped-then-empty layout this replaced. The primary action
sits at 495px on a 375×667 screen, comfortably above the fold.

There is no masthead. `Liikekirjasto` is a tab, so a button for it was a duplicate,
and Asetukset is an icon button in a plain top row — sliders rather than a gear,
because three strokes and three knobs stay crisp at 20px.

**An open session goes stale after six hours.** Past that you did not pause, you
finished training and forgot to say so, and offering to continue this morning's
workout is worse than offering nothing. Stale sessions close themselves at startup
at the time of their **last completed set** — which is when training actually
stopped, and gives an honest duration. The logged sets are real training, so they
are kept; a session with nothing logged is discarded, the same rule finishing one
applies.

### Päivä

Tapping any past or present day in the strip opens it. Future days are not
tappable — there is nothing to show and nothing to plan.

- Sessions logged that day, each opening its summary. A day with nothing logged
  shows no list at all — the start row below is already the answer, and stating
  the absence first only delayed reading it.
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
▏ Romanialainen maastaveto        1/3  ⋯
▏ VIIME KERRALLA 90 kg × 8, 8, 7  HISTORIA ▸
▏
▏ LÄMMITTELY  [50 × 8] [70 × 5]
▏ TYÖSARJAT   [92,5 kg × 8]
▏
▏ SARJA 2 / 3
▏ ┌──────────┐ ┌──────────┐ ┌────┐
▏ │  92,5    │ │     8    │ │ ✓  │
▏ │  ╌╌╌╌    │ │          │ │    │
▏ │    kg    │ │  toistoa │ │    │
▏ └──────────┘ └──────────┘ └────┘
▏ EHDOTUS 92,5 KG (+2,5)
────────────────────────────────────────
   Jalkaprässi              0/3 · 3 × 10
   Pohkeen nosto seisten    0/4 · 4 × 12
────────────────────────────────────────
   + Lisää liike
────────────────────────────────────────
 PALAUTUS   2:14                  OHITA
 Seuraava: Sarja 3 · 92,5 kg × 8
```

On a movement not yet started, where a ramp is remembered:

```
▏ Penkkipunnerrus                  0/3  ⋯
▏ VIIME KERRALLA 80 kg × 8, 8, 7  HISTORIA ▸
▏ ┌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌┐
▏ ╎ LÄMMITTELY 40 × 8 · 60 × 5   LISÄÄ ╎
▏ └╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌┘
▏ SARJA 1 / 3
```

- **One movement expanded**, marked with a cobalt rule. It **auto-advances** on the transition into completion — once only, so returning to add an extra set does not bounce you away again. Any collapsed line is one tap away, so an occupied machine costs nothing.
- **Completion is decided by the write, not predicted by the screen.** `commitSet` reports whether that set was the one that met the plan, comparing before and after inside its own transaction. The screen used to predict it — `workingDone(movement) + 1 === plannedSets` against its own render snapshot — which is only right if that snapshot is strictly pre-commit, and whether it is depends on what the live query handed React and when. When it was not, the arithmetic silently came out one too high and the workout simply stopped advancing: the failure was total, permanent, and invisible in the data.
- **The next movement is searched forward, then wrapped.** Finishing the second of three used to send you back to the first one you had deliberately left part-done, because the search started at index 0 — which reads exactly like the advance being broken. It now starts at the movement after this one and wraps round, so an occupied rack is still picked up later, and after the last movement a half-done one behind you is still offered.
- **The screen asks one question: what did you just lift?** Everything that is not that question — writing a note, removing the movement, logging a warmup the app did not remember — lives behind the movement's `⋯`. The count of controls is the design constraint, not a side effect of one.
- **Work beyond the plan is additive, never inflated.** A sixth set on a five-set movement reads `5/5 +1` and the input says `Lisäsarja 1`. `6/5` would state one confusing thing where there are two true ones, and it made the session rail exceed its own track.
- **One input, not a row per set.** The set you are about to do is the only editable thing on screen. Committing it moves it into the log and opens a fresh one.
- **Last time is a door, not a dead end.** The line under the movement name reads `Viime kerralla`, because `Edellinen` was ambiguous between the previous *set* and the previous *session*. It is a button: tapping it opens that movement's full history, so the one-line summary is no longer the only history the app will show you. For a movement you have never trained, the row collapses to the bare `Historia ▸` — the label and its value were saying the same nothing twice, and a blank row already states the absence.
- **Loads are inferred and shown in place, and written only when the tick affirms them.** The offered number sits in the field itself, greyed and dashed — the same language the pad uses for a number it is showing but has not stored. The tick commits exactly what is on screen. Leaving the movement writes nothing, and `Valmis` on an untouched pad field writes nothing.

  This replaced a dashed `TÄYTÄ` row below the input. That row existed because the number had no other way to reach the field, and it made the app's most repeated action cost two taps — fill, then tick — while `SPEC.md` claimed one. Affirming a number you can read is the same standard the pad already applied; what changed is that the offer no longer needs its own control to get where it was always going.

  Within a session the offer repeats what you last lifted; across sessions it is the progression proposal, with its reasoning on the line below. Target reps are *stored*, not offered, so they read solid: they come from the routine you chose rather than from a guess.
- **Every movement opens on the work.** `Sarja 1 / 3`, target reps already in the field, tick live. The draft is never a warmup — there is no mode on the input at all.

  It used to open on `Lämmittely`, on the argument that a warmup is what you actually do first. True, and still the wrong default: it put a mode decision in front of the first set of every movement, five or six times a session, and `commitSet` carries the kind forward — so one missed switch quietly logged an entire movement as warmup, counted towards nothing. The app grew an end-of-session `TARKISTA` modal whose only job was catching that. Both are gone. The failure mode did not become impossible, it *inverted* — a warmup can now be logged as work — and that one is corrected in place, where it is read, rather than questioned on the way out.
- **A remembered ramp is one tap.** When last session's warmups are known and nothing is logged yet, a dashed row above the input offers the whole ramp; tapping it logs every rung at once. It does not start the rest timer and does not advance the movement — neither belongs to warming up — and it disappears once anything is logged, which is also what makes a double tap unreachable. Ignoring it costs nothing and leaves you on the working set.

  The ramp is read from the newest session that contains the movement at all, not the newest one that happened to have warmups. Warming up is optional now, so an unbounded search would keep offering absolute kilos from months ago against a load that has since moved. The last time you trained it and did not warm up is an answer.
- **A warmup the app did not remember goes through `⋯ → Kirjaa lämmittelynä`**, which takes the numbers already in the input rather than asking for them twice. The draft it leaves behind is a working set again, so there is no mode to get stuck in.
- **A set needs both values before it can be logged**, so nothing is ever recorded that you did not affirm. `0` counts — it means bodyweight. The tick is enabled on the *resolved* numbers, typed or offered, and the resolution is computed identically here and inside `commitSet`'s transaction — so an enabled tick can never turn out to be a no-op. It stays disabled while the offer is still loading, or it would flip live under a finger already on its way down.
- **Movements still to come fold behind one line** — `5 liikettä jäljellä`. Mid-set they carry almost nothing, six rows of `0/3`, while the ones already behind you carry what you lifted, so only the upcoming half folds. The list opens for reordering, and dragging force-opens it so a drag never targets a hidden row.
- **Warmups are first-class and do not consume planned sets.** They are excluded from the count, from volume, and from 1RM — three warmups must not "finish" a three-set movement.
- **Logged work reads as two lines**, warmups and working separately, each set its own small button. Tapping one opens it for correction: the load, the reps, its kind, or removal. Logged sets are records — they can be corrected or removed, never un-ticked, which would leave two sets in flight at once.

  The kind belongs *here* rather than on the input, because this is the only moment it is ever wrong: you know what a set was once you have done it. That is also the mitigation for the inverted failure mode above, and it is why there is no second modal. The two lines used to collapse behind a `Muokkaa` toggle that unfolded a grid of nine controls — a rare correction competing with the action performed eighteen times a session.
- **Previous performance and the proposal** sit above the input. The comparison is the habit loop.
- **One tick** commits the set, starts the rest timer, and fires a haptic.
- **`Lisää liike` is the last row of the list, above the fold count.** It belongs inside the list because that is what appending to a list looks like; the `N liikettä jäljellä` row is a footer for the list rather than another item in it, so the append goes above it. It appears only once the list is all there — under the fold it invited adding a movement while five were still hidden, which is how the same lift ends up in a session twice. An empty ad hoc session has nothing folded away, so it still offers it; that regression happened once before, which is why the condition is about the fold rather than about the movement count.
- **The tick is the primary action, and accent is rationed to make that legible.** Accent had drifted onto fifteen elements at once, and the only solid-filled button on screen was `Lopeta treeni` — at 1.5× the tick's area. The action performed eighteen times a session was the quietest control on it. Accent now belongs to three things: the progress rail, the rest countdown, and the tick once it can be pressed. `Lopeta treeni` is outlined and takes its natural width; `Lisää liike` is a text link.

  The tick now reads solid on arrival at most movements, which is the point rather than a regression of that rule. It used to go solid only once `TÄYTÄ` had been pressed, so accent marked *the blanks are filled*. The blanks are filled on arrival now, and what is still provisional is said by the numbers themselves — greyed and dashed until affirmed. The signal moved; it was not spent.
- **The drag handle lives on collapsed rows only.** Those are what you actually reorder, and dragging force-opens the list. It carries keyboard reordering as well as the pointer drag, so it has to stay a real focusable control — which is exactly why it cannot be folded into `⋯`: `onPointerDown` captures the pointer immediately, and a menu button that starts a drag would swallow the tap that opens the menu.
- Tapping a load opens the **custom numeric pad** with plate-pair steppers and a plate calculator, sized from your gym settings. Never the OS keyboard.
- **Rest is dead time, so it is where the plan belongs.** While the timer runs, the bar names the next set or movement and collapsed rows reveal their targets, then it folds away again.
- **Rest ending is announced, not just displayed.** Three signals, configurable in Asetukset: vibration (on by default — the only one that works with the phone in a pocket, and the app already vibrates on the tick), a two-tone WebAudio beep (off by default, because a beep in a quiet gym is worse than no beep; synthesised rather than bundled, so it works offline), and a notification through the service worker (off until you grant permission, which is asked for when you switch it on and never on load). The notification names the next set rather than announcing a timer.
- **What the cue does not promise.** A backgrounded page's timers are throttled and may be frozen outright, and scheduling a notification for a future instant needs the Notification Triggers API, which is not broadly available. So the cue fires on time when the page can run, and a `visibilitychange` listener fires it **late** when the page could not — late beats never. It fires once either way. The Asetukset copy says exactly this rather than implying a locked phone will be woken.
- Tap targets ≥48 px — used mid-set with sweaty hands.
- Every change writes to IndexedDB immediately, including the un-committed input, so a reload mid-set loses nothing.
- **A session left open across the change is migrated, not resumed as-is.** `db.version(9)` rewrites the trailing warmup draft of every unfinished session to a working set. Without it, one draft left over from the old default would have carried its kind forward through every remaining set of that workout, with the check that used to catch it deleted. Only the draft is touched: it is the input, not a record, and warmups already logged are exactly what was meant.

Result: 7 controls on the active movement, against 13 before this pass, 23 for the row grid and 92 before the accordion.

### Liikkeen historia

Reached from **anywhere a movement is named**: `Viime kerralla` mid-set, a movement row in Yhteenveto, and the movement's page in the library. A movement's name is a way into its record, not a label — in Yhteenveto the whole row is the target, because a summary is read on a phone and one line of text makes a poor one.

The overview — the figures and the plot — renders in two places, and the difference matters:

- **On the movement's page in the library, inline**, directly under the body-plan glyph and *above* the name fields and equipment dropdown. It was behind a `Historia →` row at first, which put how the movement is described above what you have lifted. Wrong order: nobody opens a bench press page to check its English name. `Näytä kaikki N treeniä` opens the sheet for the session ledger.
- **In a sheet, everywhere else**, because those places are mid-flow — mid-set, or reading a summary — and a route change would cost you your place. It answers one question — am I getting stronger at this — so it opens with the answer and puts the ledger underneath.

```
HISTORIA                            SULJE
Penkkipunnerrus

TREENEJÄ  ENNÄTYS     1RM-ARVIO  VIIME KERRALLA
6         75 kg × 5   87,5 kg    1 vrk

KUORMA                pallon koko = toistot
75 kg ┐     ●───●
      │   ╱       ╲
      │ ●           ╲          ◎  ← latest,
      │               ╲      ╱      haloed
67,5  ┘                 ⬤──╯     ← 8 reps:
      ────────────────────────────  bigger dot
VOLYYMI                 ENINT. 1 875 KG
      ▐▌  ▐▌  ▐▌  ▐▌      ▐▌  ▐▌
      ────────────────────────────
      21.7.                    13.8.
────────────────────────────────────────
TO 13.8.2026                  YLÄKROPPA
TYÖSARJAT   70 kg × 5, 5, 5, 5, 5
LÄMMITTELY  40 × 8 · 55 × 5
VOLYYMI     1 750 kg
otetta leveämmäksi
────────────────────────────────────────
MA 10.8.2026                      5×5 A
TYÖSARJAT   67,5 kg × 8, 8, 8
…
```

- **A sheet, not a screen.** It is opened mid-set; pushing a route would discard which movement the accordion has open — including one you deliberately parked on to add extra sets.
- **The x axis is real time, not session number.** Evenly spaced sessions hide the gaps, and the gaps are the difference between steady work and a month off. An eleven-day break draws as an eleven-day break.
- **One point per session at its top set, sized by that set's reps.** So dropping the load and chasing reps reads as what it is — the dot falls and grows — instead of looking like a plain regression. The legend appears only when the reps actually vary.
- **A whisker when the session's loads spread**, from lightest working set to heaviest. A straight 5×5 has no spread and gets no whisker. This is what an earlier version got wrong: it drew a dot per *set*, and on a 5×5 all five landed on one point with four of them invisible.
- **The load axis is cropped and says so; volume is zero-based.** Loads cluster in a narrow band, so a zero baseline flattens every session onto one row — both ends of the range are printed instead, which is what keeps a cropped axis honest. Volume genuinely starts at zero, so it is drawn from zero, and a flat volume profile is a true reading rather than a rendering failure.
- **Volume totals by week, not by session.** Three attempts at per-session bars all failed on the same fact: a bar has width and a true time axis has no slots to put one in. Training a lift three times a week puts sessions two days apart — about four pixels across three months — so bars sized from the average gap merged into a block, bars sized from the tightest gap became hairlines, and bars sized individually came out in four different widths. Weeks are evenly spaced by definition, so clustering cannot reach them. It is also the more useful total: weekly workload is what you manage, while a single session's volume mostly reflects how the week happened to be split. A week you did not train the movement gets no bar, so the gaps stay visible. Per-session volume is still on every row of the ledger.
- **Bodyweight work plots reps**, drops the volume panel and offers no 1RM estimate. There is no load to plot and nothing to extrapolate from.
- **Three sessions minimum.** Two are a pair of numbers; the ledger states that better than a chart could.
- **`1RM-arvio` is labelled as an estimate** (Epley), because it is a lift you have not made. It exists so sets at different rep counts are comparable.
- **Warmups stay on their own line**, as they do in the session view, so the working sets remain comparable at a glance.
- Same movement logged twice in one session merges into one row — that is one day's work on that lift, not two sessions.
- Notes carry through, in the words you wrote them in.
- The plot covers the last 30 sessions and **says so on the axis when it is dropping any**.

### Liikkeen valinta

- Search by Finnish or English name; filter by muscle group and equipment.
- Recents and frequents first. **On first run these are empty** — seed the list with the common compounds instead of showing a blank panel.
- Create a custom movement inline, without leaving the flow.

### Yhteenveto

- Duration, total volume, per-movement recap, any records beaten.
- Ad hoc sessions offer `Tallenna pohjaksi` here.
- A session opened but with no completed sets is discarded rather than saved as junk.

### Ensi kerralle — the review dialogue

The app decides one thing unilaterally: after a load is missed twice running, it
cuts about ten per cent. Everything else it infers is additive, neutral or
absent. **So the rule is that the dialogue speaks when the app is about to take
something away** — nothing else, and that sentence is what stops the cadence
drifting back into chatter after every session.

```
┌─ ENSI KERRALLE ──────────────── SULJE ─┐
  Penkkipunnerrus: 100 kg × 8, 7, 5.
  Tavoite 8.

  Sama kuorma jäi tavoitteesta kahdesti
  peräkkäin. Ilman muuta tietoa ehdotus
  ensi kerralle on 90 kg.

  Mistä se johtui?

  [ PAINO OLI LIIAN RASKAS ]
  [ PÄIVÄ OLI HUONO ] [ EN OSAA SANOA ]
─────────────────────────────────────────
  VASTASIT          PÄIVÄ OLI HUONO
─────────────────────────────────────────
  Kevennys peruttu. Ehdotus ensi kerralle
  on 100 kg. Jos sama toistuu, tämä
  kysytään uudelleen.
└─────────────────────────────────────────┘
```

- **It is a ledger, not a chat.** Turn-taking is alternation in time, and this
  app already renders alternation in time as hairline rows — the session screen
  is the proof. So there are no bubbles, no left/right flip and no avatars. The
  app's voice is the app's default type; a committed answer takes the condensed
  uppercase every other logged fact takes, because the moment it is tapped it
  *is* a logged fact. The last row is not "you said RASKAS", it is the number
  that changed.
- **One answer, one authority rule**: *an answer may hold a load the rules would
  have moved; it may never move a load the rules would have held.* Holding at
  100 kg proposes a weight with two sessions of evidence behind it; turning a
  hold into an increase would propose one with none. There is deliberately no
  "make it lighter" and no "it felt easy" chip — after missing twice, a chip the
  log contradicts invites a claim that is not true. The honest decline claims
  something the log *cannot* contradict: that the cause was outside the lift.
- **The influence expires by itself.** An answer steers exactly the next
  proposal. Once a newer session with that movement exists the old answer is out
  of the two-session window and is never read again — no expiry logic, and no
  invisible steering three weeks later.
- **It arrives uninvited, so dismissal costs nothing.** Every other sheet opens
  on a tap. This one rises 500 ms after the summary paints, so the figures are
  readable first, and the backdrop, `Sulje` and `Escape` all close it with
  nothing written. Dismissal is never a silent yes: the rule's cut simply
  stands. `Ehdotukset ensi kerralle` stays on the summary afterwards, so closing
  the sheet never destroys the content, and reopening the same summary from
  Päivä never re-raises it.
- **The rarity is the licence.** It is acceptable as an interruption only
  because it fires on a real event. Making it appear after every session would
  turn it into a modal nag between finishing a workout and seeing what you
  lifted — that version was considered and rejected.
- **Scripted, with the seam for a model.** `turnsFor` is pure and returns data;
  a phraser sits between it and the screen and is the identity function today.
  The call site awaits it already, which is the one decision that avoids a
  rewrite later. The invariant if a model ever lands: **it may choose words, it
  may not choose what happens** — which is what makes the offline path the base
  case rather than a fallback.

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

### Browse first, maintain second

The library and the movement page are read-only until you ask for `Hallinta`. They were not: the library opened with three admin buttons above the search box (bulk rename, override export, new movement) and rails carrying `Tarkistettavat` flags and edited pips, and tapping a row landed you in two text inputs. All of that is about the canonical *data*. None of it is why you open the library, and none of it answered the obvious question — **which of these 68 have I actually done?**

```
LIIKEKIRJASTO
68 LIIKETTÄ · 15 TEHTY
[ HALLINTA ]  [ + UUSI LIIKE ]
[ Hae liikettä                      ]
[ Kaikki lihasryhmät ▾ ][ Välineet ▾ ]
[ TEHDYT 15 ] [ PIILOTETUT ]
──────────────────────────────────────
VIIMEKSI TEHDYT ─────────────────────
▍ Maastaveto                     11 ×
  ALASELKÄ · LEVYTANKO      97,5 KG × 5
▍ Kulmasoutu                     11 ×
  KESKISELKÄ · LEVYTANKO    62,5 KG × 8
  …
  9 MUUTA TEHTYÄ LIIKETTÄ            ▾
MUUT LIIKKEET ───────────────────────
A ───────────────────────────────────
▍ Aamunavaus
  TAKAREIDET · LEVYTANKO
```

- **The rail carries your training**: sessions, then the best working set. A movement you have never done has an **empty rail** — absence is the answer, and it needs no badge of its own.
- **Trained movements come first**, ordered by when you last did them, ties falling back to the alphabet. Capped at six with an expander, so the alphabet still begins within a screen.
- **Searching collapses the split.** Once you have typed a name you want one list of matches, not your history followed by the alphabet.
- **The English name only shows under `Hallinta`.** On a detail page it is useful context; on a row among 68 it is noise. Same for `own` / `incomplete` / the edited pip, which is what the rail carries in that mode instead.
- **The mode persists**, because reviewing 68 draft Finnish names is one sitting, not one visit — a mode that reset on every return from a movement page would be worse than no mode.
- The movement page follows the same flag, and the switch sits in the masthead on both screens rather than moving between the header and the body.

### Screens

**Liikekirjasto** — the library list. Under `Hallinta` it gains bulk rename, override export, and a `Tarkistettavat` (needs review) filter driven by the gaps the build script reports: missing `nameFi`, `mechanic`, `force`, or `equipment`.

**Liikkeen sivu** — read-only by default: the body-plan glyph, the figures and the plot, `Näytä kaikki N treeniä`, a `Tiedot` summary (muscles, equipment, type, direction), then the instructions. `Muokkaa liikettä` in the masthead turns on `Hallinta` and swaps the summary for the fields below. Instructions stay in both modes — they are reference material either way.

**Liikkeen muokkaus** — the same page under `Hallinta`:

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

There is one user, so this is not permissioning — it is a mode switch that keeps destructive editing out of the way of logging, and out of the way of *reading*. Editing is reachable from the library, never from the live session screen, where a mis-tap during a set would be costly.

The second reason turned out to matter as much as the first: with the editing controls always present, the library had no room to say anything about your training, and both screens opened with the least interesting thing on them.

## Ensimmäinen käynnistys

A first launch asks who is training before it shows anything else — two steps,
and only the name is required.

- **Vaihe 1** collects name, sex, birth year, goal and bodyweight on one screen.
  A blank field *is* the skip, so there are no `Ohita` links: four of them would
  each do what leaving a field empty already does, while implying the blank
  fields were what stopped you. Birth year rather than age, because an age typed
  today is wrong next year. Bodyweight is written as a dated reading, not a
  setting — the first point of a series the progress screen will want.
- **Vaihe 2** is the routine list, and the goal *marks* a group rather than
  filtering one: `Voima` surfaces 5×5, `Lihaskasvu` the push/pull/legs split,
  `Yleiskunto` ylä/ala. All seven routines stay listed and startable. Steering is
  helpful; hiding five of them on the strength of one tap is not.
- Sex and birth year are stored and **nothing reads them yet**. The screen says
  so rather than implying a use.

This is a wall, and the decision table says "pick one and start, no builder
wall". The tension is real and was accepted deliberately; it is paid down by
keeping the wall one screen with one required field, and by ending it on the
routine list so the last step of onboarding is the first tap of training.

Completion is recorded when the name is submitted, not when a routine is chosen,
so closing the app while choosing does not raise the wall again. Two consequences
worth knowing: the gate is decided once at launch rather than watched — a live
query saw its own completion write and tore the flow down before step 2 could
render — and anyone with existing sessions or a name is backfilled as done, so
shipping onboarding cannot wall a user who has been training for weeks.

## The first-session problem

The app's core value is pre-filling from history, which on day one does not exist. Seeded templates supply structure and target reps, but **not loads** — we do not invent weights the user hasn't lifted.

So session one shows a bare `Historia ▸` and blank kg fields. This is a one-time cost, paid once per movement, and it is the honest option. From session two onward every field arrives pre-filled.

The same emptiness makes several screens impossible to *look at* while building them — the movement plot will not draw under three sessions, the week strip has nothing to shade, and the rotation cannot say what is next. `Asetukset → Esimerkkidata` generates twelve weeks of one programme for that: three sessions a week, a week off in the middle so the time axis has a gap, and a progression that stalls and deloads rather than climbing cleanly, because a clean ramp is the one shape real logs never have.

It writes `demo-` session ids and nothing else, so removing it takes back exactly what it added and can never delete a real workout. That is also why there is no "clear all sessions" button next to it — a generator has to be safe to press twice, and a destructive twin sitting beside it is a mis-tap waiting to happen.

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
