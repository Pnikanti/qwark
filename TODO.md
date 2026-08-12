# Qwark — Todo Log

Append-only log. Mark items `[x]` when done, add a one-line outcome underneath.

Legend: `[ ]` open · `[~]` in progress · `[x]` done · `[-]` dropped · `[>]` deferred to a later phase

---

## 0 — Resolve open questions

- [x] Q1 Platform → Web / PWA first
- [x] Q2 Audience → personal use first
- [x] Q3 Accounts & sync → Supabase auth + sync from the start
- [>] Q4 Food data source → deferred, nutrition is not in v1
- [>] Q5 Image → macros approach + accuracy bar → deferred with nutrition
- [x] Q6 AI infrastructure → Supabase edge functions, but no AI in v1
- [x] Q7 Monetization → none, personal use
- [x] Q8 v1 scope → training only
- [x] Q9 Offline → must work fully offline, local-first
- [x] Q10 Units & locale → metric, Finnish only
- [x] Q11 Stack → Vite + React + Supabase
- [x] Q12 Success metric → 8 consecutive weeks of sessions logged, no fallback to paper

Outcome: decisions folded into [SPEC.md](SPEC.md#decisions). Nothing blocking.

---

# v1 — Training

## 1 — Foundations

- [x] Scaffold Vite + React + TypeScript
- [x] PWA setup: manifest, service worker, icons, installable, offline shell
- [x] IndexedDB layer (Dexie) as the source of truth for reads
- [x] Finnish string table (`src/i18n.ts`)
- [x] Design tokens, light + dark, ≥48 px targets (`src/styles.css`)
- [x] Visual direction "concrete and cobalt": plate palette, width-axis type, self-hosted Archivo
- [x] `BodyPlan` glyph — schematic muscle diagram from the seed data
- [ ] Reuse `BodyPlan` for weekly volume per muscle group on the progress screen
- [ ] Supabase project, auth, row-level security
- [x] Data model: template, session, logged set (programme + body metric still open)
- [ ] Eager library sync at first login, blocking with progress + retry
- [ ] Write queue + background sync + visible sync state
- [x] Numeric pad component: 2.5 kg steppers, plate calculator, keypad
- [x] Navigation shell — Tänään / Liikekirjasto tabs, hidden during a session

## 2 — Exercise library

- [x] `scripts/build-movements.py` — build-time, run once, output committed
- [x] Curate the gym set from free-exercise-db's 873 movements → 68 seeded
- [x] Draft Finnish names for the seeded set (no source provides them)
- [x] Finnish taxonomy: 17 muscle groups, 12 equipment types
- [x] Override layer in the build script: merge `data/overrides.json`, reject `id` patches, warn on unknown ids
- [x] Id ledger: pin all 873 ids, alias-based rename resolution, collision guard, orphan reporting
- [x] Schema in the app matching the seed shape; load into IndexedDB
- [x] `overrides` table; effective movement = seed merged with override at read time
- [x] Search and filter by muscle group / equipment (searches both `nameFi` and `nameEn`)
- [ ] Custom user-created exercises (covers the abductor / adductor / neck gaps)
- [>] Movement images — deferred, no images in v1

### Admin editing

- [x] Liikekirjasto list with per-row edit affordance
- [x] `Tarkistettavat` filter — missing `nameFi`, `mechanic`, `force`, `equipment`
- [x] Liikkeen muokkaus: edit both names, muscles, equipment, mechanic, force, level
- [x] Edited-field markers + per-field reset to seed default
- [x] Hide as an override, never a delete (history must still resolve)
- [x] Joukkokäännös — bulk `nameEn` → `nameFi` list, keyboard-tabbable
- [x] Export overrides as `data/overrides.json`; import to restore
- [ ] Editing unreachable from the live session screen (no session screen yet)
- [ ] Native-speaker review of the 68 draft Finnish names (via Joukkokäännös)

## 3 — Planning

- [x] Seed starter templates in Finnish — 7 routines in 3 groups (PPL, ylä/ala, 5×5), movement ids validated at build time
- [x] Save as reusable routine from a finished ad hoc session
- [x] Editing a template cannot rewrite logged history — sessions copy their plan at start
- [x] Set types: warmup and working (tap the set marker to switch)
- [ ] Set types: superset, circuit, drop, AMRAP, time-based
- [ ] Template editor — routines can be created from a session but not yet edited
- [ ] Routine preview before starting
- [ ] Multi-week programme structure and scheduling
- [ ] Substitution picker ("no barbell available")

## 4 — Session logging

- [x] Tänään: in-progress resume banner, first run, and has-history states
- [ ] Tänään: training-day / rest-day states (needs programme scheduling first)
- [x] Start session from routine or ad hoc
- [x] Live view: previous performance inline, set-by-set entry
- [x] Accordion: one movement expanded, rest folded to a line, auto-advance on completion
- [x] Logged sets collapse to a log line, reopenable to fix a mistyped load
- [x] Next set outlined; session progress rail
- [x] Rest phase reveals what's next and upcoming targets
- [x] Drag to reorder movements mid-session, persisted; arrow keys from the grip
- [x] `Lisää liike` appends at the end of the list; `Lopeta treeni` alone in the header
- [ ] Offer to save a reordered session's order back to its routine
- [x] Toast notifications replace inline status messages
- [x] Set row checkmark → complete + rest timer + haptic
- [x] Pre-fill from last session; unchanged set is one tap
- [x] First-session empty state: `Ei aiempaa tietoa`, blank loads, no invented weights
- [x] Movement picker: leads with common compounds when there are no recents
- [x] Rest timer countdown, skippable
- [ ] Rest timer background notification (in-app countdown only so far)
- [x] Persist to IndexedDB on every change; resume banner with elapsed time
- [x] Discard sessions that finish with zero completed sets
- [x] Summary: duration, volume, per-movement recap, records, estimated 1RM
- [x] Fully exercisable with the network off — verified end to end, not assumed
- [ ] Optional RPE / RIR per set
- [ ] Per-movement notes — stored and shown in the summary, but nothing writes them yet
- [ ] Configurable bar weight and disc inventory (hardcoded 20 kg bar + standard discs)

## 5 — Progress

- [ ] Per-movement history: estimated 1RM, volume, best sets
- [ ] Weekly volume per muscle group (reuse `BodyPlan`)
- [ ] Body weight + measurements, smoothed
- [ ] Rule-based progression targets for next session

## 6 — Cross-cutting

- [ ] Sync conflict handling (append-only, device-stamped)
- [ ] Data export + delete
- [ ] Onboarding: minimal — body stats and first program
- [ ] Accessibility pass
- [ ] Track the Q12 success metric

---

# Later — deferred by decision

- [>] Nutrition: logging, targets, meal-type inference, custom foods, barcode
- [>] Image → macros (incl. answering Q4 and Q5 first)
- [>] AI: progression assist, program generation, coach chat, weekly review, deload hints, voice logging, auto-adjusting targets
- [>] Multi-user, English localization, lb/kg toggle

---

## Log

- 2026-08-10 — Spec premise and todo log created; 12 open questions raised.
- 2026-08-10 — Questions answered. v1 narrowed to training-only, web PWA, Vite + React + Supabase, local-first offline, no AI, Finnish/metric. Spec and todo restructured around v1 / Later.
- 2026-08-10 — Exercise data sources researched and chosen: free-exercise-db for metadata, everkinetic/wger for images. free-exercise-db images rejected on unresolved provenance. No source offers Finnish, so names are hand-written.
- 2026-08-10 — User flow designed in [FLOW.md](FLOW.md) after reviewing Hevy, Strong, and Fitbod. Seeded Finnish templates chosen over both a program-builder wizard and the ad-hoc-first idea; Tänään + routine list as the main screen.
- 2026-08-11 — Data plan corrected after verifying sources live. Everkinetic's own images are dead (404s, host unresolvable) but survive as SVG in the rswilley fork, keyed by `id_num`, 269/292 covered. Everything vendored at build time, no runtime source dependency.
- 2026-08-11 — Images dropped from v1, which removed the whole licensing problem. free-exercise-db (public domain) is now the sole source, metadata only. Built `scripts/build-movements.py` → 873 normalised movements, 68 curated with draft Finnish names, Finnish taxonomy. Everkinetic demoted to a deferred image option.
- 2026-08-11 — Admin editing specced: immutable seed + override layer keyed by movement id, merged at read time, so library updates never clobber edits. `id` is canonical and frozen; both `nameFi` and `nameEn` are user-facing and editable. Build script now merges `data/overrides.json`, closing the app → repo loop.
- 2026-08-11 — Repo initialised and pushed to github.com:Pnikanti/qwark.
- 2026-08-11 — Visual identity established before more screens inherit the generic default: "concrete and cobalt" (see SPEC.md). Palette derived from IWF plate colours, typography uses Archivo's width axis semantically, layout is a hairline ledger with alphabet section markers, and the signature is a schematic body-plan glyph driven by the seed's muscle data. Fonts self-hosted so offline still renders them. Finnish numeral cases fixed.
- 2026-08-11 — First app slice built: Vite + React + TS + PWA, Dexie with the seed/override split, Liikekirjasto with search and filters, per-movement editor with per-field reset, Joukkokäännös bulk rename, and overrides export/import. Verified in headless Chrome: 68 movements render from IndexedDB, all filters work, edits round-trip, and an offline reload still renders the full library with edits intact. No Supabase yet — local-first means IndexedDB is the source of truth anyway.
- 2026-08-11 — Id ledger added, pinning all 873 ids so upstream renames can't orphan logged history. Upstream has no stable id of its own (name-derived), so renames are resolved by hand via `aliases`. Tested end-to-end: simulated renaming "Barbell Squat" → "Back Squat (Barbell)", confirmed the orphan+mint report, resolved via alias, verified the id held at `barbell-squat` with the new `nameEn`.
- 2026-08-11 — Training loop built: Tänään, session logging, numeric pad with plate calculator, and summary. 7 Finnish starter routines seeded with movement ids validated at build time. Sessions copy their plan at start so template edits cannot rewrite history. Verified end to end in headless Chrome including a session started, logged, reloaded, and finished entirely offline (3 sets, 1 200 kg). Deferred: programme scheduling, exotic set types, RPE, notes UI, template editing, configurable bar weight.
- 2026-08-11 — Session view reworked after measuring it: 92 buttons and 1.9 screens of scroll for a one-set decision. Now an accordion — one movement expanded, others folded to a line, logged sets collapsed to the log vernacular, next set outlined, and the rest period used to reveal what's coming. 23 controls, one screen. Also fixed `setsLine` to show reps alone for bodyweight work instead of `– × 8`.
- 2026-08-11 — Session movements are reorderable by dragging a grip, persisted as the array order. Required giving each entry a stable `uid` (Dexie v3 backfills it) because the active movement was tracked by index, which a reorder breaks — and a session can hold the same movement twice. Pointer Events rather than HTML5 drag-and-drop, which never fires from touch. `Lisää liike` moved to the foot of the list where the append happens; `Lopeta treeni` now alone in the header.
- 2026-08-12 — Status messages became toasts (`src/lib/toast.tsx`): module store so handlers can raise one without hook plumbing, mounted outside the screen switch so a toast survives the navigation that raised it. Fixed a regression from the previous commit — gating the append button on `movements.length > 0` left an empty ad hoc session with no way to add a movement.
