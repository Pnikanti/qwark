# Qwark — Product Spec

Status: draft · Last updated: 2026-08-10

## Premise

- A fitness app built around two loops: **what you lift** and **what you eat**.
- v1 ships the training loop only. Nutrition is designed for but not built yet.
- Logging should cost near-zero effort — the app pre-fills from history and asks only what changed.
- Local-first: a set logged in a basement gym with no signal is never lost.
- Built for personal use first. Correctness and speed over onboarding and settings.

## Decisions

| Area | Decision |
|---|---|
| Platform | Web / PWA first, installable to home screen |
| Stack | Vite + React + Supabase (Postgres, auth, edge functions) |
| v1 scope | Training only |
| Audience | Personal use first; generalize later |
| Offline | Must work fully offline — local-first with background sync |
| AI in v1 | None. Deferred until real training history exists |
| Units | Metric (kg, cm) |
| Language | Finnish only in the UI; code and identifiers in English |
| First run | Seeded Finnish templates — pick one and start, no builder wall |
| Main screen | Tänään (today's session) with the routine list below |

Screen-by-screen flow in [FLOW.md](FLOW.md).

---

# v1 — Training

## Workout planning

- A workout is an ordered list of movements; each movement has sets, target reps, target load, rest.
- Exercise library with muscle groups, equipment, and substitutions ("no barbell → use dumbbells").
- Finnish exercise names as the primary label, English name kept alongside for search.

### Exercise data sources

**No movement images in v1.** Dropping them removed the entire licensing problem: metadata is the only thing sourced, and the source is public domain. No attribution screen, no CC-BY-SA obligations, no modification notices, no image budget.

Everything is vendored at build time into a committed seed file. **No runtime dependency on any external source** — the offline requirement demands it, and it is exactly the failure that killed Everkinetic's image host.

**Source: [free-exercise-db](https://github.com/yuhonas/free-exercise-db)** — declared public domain, 873 movements. Metadata only; its images are unused and their provenance is unresolved ([two](https://github.com/yuhonas/free-exercise-db/issues/2) [issues](https://github.com/yuhonas/free-exercise-db/issues/12), neither answered), which is now moot.

Built by `scripts/build-movements.py` (one-off, output committed):

| File | Contents |
|---|---|
| `data/movements.all.json` | all 873 movements, normalised, no Finnish names |
| `data/movements.seed.json` | 68 curated gym movements with draft Finnish names |
| `data/taxonomy.json` | 17 muscle groups and 12 equipment types, Finnish labels |
| `data/id-ledger.json` | 873 pinned movement ids, append-only |
| `data/overrides.json` | optional admin edits, merged over the seed |

Per movement: `id`, `nameFi`, `nameEn`, `primaryMuscles`, `secondaryMuscles`, `equipment`, `mechanic` (compound / isolation), `force` (push / pull / static), `level`, `category`, `instructions`.

**`id` is canonical; both names are user-facing and editable.** Logged sets and templates reference the id, so renaming never touches history. The id is generated once by slugifying the upstream English name and then frozen — treat it as opaque. Editing surface and the seed/override layering are in [FLOW.md](FLOW.md#liikekirjaston-hallinta-admin).

Ids are **pinned in a ledger, not recomputed**, because upstream has no stable identifier — its `id` field is slugified from the name and rotates on rename. An upstream rename surfaces as one orphaned id plus one minted id, resolved by hand once via an `aliases` entry; the ledger is otherwise append-only, so movements removed upstream keep resolving for old sessions. Verified end-to-end against a simulated rename.

Seed coverage skips four groups deliberately — abductors, adductors, neck, and (beyond two grip movements) forearms. Add them as custom movements if wanted.

**Finnish names are drafts** and need a native-speaker pass. The script fails loudly if upstream renames anything, rather than silently dropping a movement.

**Known upstream quirks**

- No rear-foot-elevated (Bulgarian) split squat exists. Upstream's bare "Split Squats" is a jumping plyometric — mapped instead to "Split Squat with Dumbbells".
- `equipment` and `mechanic` are null on some entries (87 movements lack `mechanic`).
- Hip thrust is present here, unlike in Everkinetic.

**If images are wanted later**

Researched but deferred. Best option is **Everkinetic line-art SVGs via the [rswilley fork](https://github.com/rswilley/everkinetic-data)** — [Everkinetic's own images are dead](https://github.com/everkinetic/data) (paths 404, `img.everkinetic.com` no longer resolves) but the fork preserves 1109 SVGs keyed to the zero-padded `id_num` (`0042` → `dist/svg/0042-relaxation.svg` and `-tension.svg`, start and end position). Deterministic mapping, 269 of 292 movements covered, CC-BY-SA so it needs an attribution surface and a modification notice. 27 KB raw / 12 KB gzipped each; ~1.6 MB gzipped for 70 movements.

Others, weaker: [wger](https://wger.de/api/v2/exerciseimage/) (CC-BY-SA 4.0, free API, only 363 images for 849 exercises, some AI-generated) · [ExerciseDB.io](https://exercisedb.io/faq) (paid, 1300+ GIFs, self-hostable) · [opentraining-exercises](https://github.com/chaosbastler/opentraining-exercises) (247 GIFs of Everkinetic art, CC-BY-SA 3.0) · [Openverse](https://api.openverse.org) (properly licensed and free, but erratic — tested "romanian deadlift" → 2 irrelevant results).

**Web image search is not an option.** [Bing's Image Search API was retired 11 Aug 2025](https://learn.microsoft.com/en-us/lifecycle/announcements/bing-search-api-retirement) with the whole Search family; [Google's Custom Search JSON API](https://developers.google.com/custom-search/v1/overview) stopped accepting new customers in 2026 and is fully deprecated 1 Jan 2027. Only paid resellers remain, returning third-party copyrighted stock, unusable offline.

Notes:

- **No source provides Finnish.** wger's language endpoint lists 30 languages, `fi` not among them. Finnish names are hand-written; language is therefore not a source-selection criterion.
- Finnish terminology reference (read for vocabulary, do not scrape — all copyrighted): [UKK-instituutti](https://ukkinstituutti.fi/aineistot/aloittelevan-ohjaajan-liikepankki-kuntojumppa/), [kuntosaliohjelma.fi](https://kuntosaliohjelma.fi/liikepankki/), [punttiohjelmat.fi](https://punttiohjelmat.fi/kuntosaliliikkeet/).
- Reusable templates and multi-week programs (e.g. push/pull/legs, upper/lower).
- Supersets, circuits, drop sets, AMRAP, and time-based work all representable.

## Logging a session

- Live session view: current movement, previous performance inline, rest timer.
- Sets pre-filled with last session's numbers — adjust only what changed. An unchanged set is one tap.
- One checkmark per set completes it, starts the rest timer, and fires a haptic.
- Custom numeric pad with 2.5 kg steppers and a plate calculator — never the OS keyboard.
- Warmup sets distinguished from working sets, and excluded from volume and 1RM math.
- RPE / RIR optional per set.
- Per-movement notes that persist to next session.
- Session can be paused, resumed, and finished later; survives a PWA reload.
- Seeded starter templates (push/pull/legs, ylä/ala, 5×5) in Finnish, so the first session has structure without a setup wizard.

## Progress

- Per-movement history: estimated 1RM, volume, best sets.
- Weekly volume per muscle group.
- Body weight and measurements over time, smoothed rather than raw.
- Plain-logic progression targets (last session + rules), no model involved.

## Offline behaviour

- All reads served from local storage (IndexedDB); the network is an enrichment, never a gate.
- Writes append to a local queue and flush when connectivity returns.
- Conflict rule: sessions and sets are append-only and device-stamped, so concurrent edits merge rather than collide.
- Sync state is visible — the user can always tell what has and hasn't reached the server.
- The PWA shell is cached, so a cold launch offline still opens to a usable app.

---

# Later — Nutrition

Not built in v1. Recorded so the data model and navigation don't have to be retrofitted.

## Logging
- Log a meal by photo, text, barcode, or search.
- **Automatic meal type** — breakfast / lunch / dinner / snack inferred from time of day, historical pattern, and composition. Shown as a chip the user can tap to change.
- Recent + frequent foods first; repeat yesterday's meal in one tap.
- Custom foods and saved recipes with per-serving macros.

## Image → macros
- Photo of a plate returns identified items, portion estimates, and macros per item.
- Every item editable: swap the food, adjust portion, delete.
- Confidence visible; low-confidence items flagged for review rather than silently accepted.
- Multi-item plates handled as a list, not one blob.
- Nutrition-label photos parsed via OCR as a separate path from food recognition.

## Targets
- Daily targets for calories + protein / carbs / fat, in grams or percentages.
- Derived from goal (cut / maintain / gain), body stats, and activity — or set manually.
- Day rings plus weekly averages, so one bad day doesn't read as failure.
- Optional per-day variation (higher carbs on training days).
- Fiber, sugar, sodium, water as optional secondary trackers.

---

# Later — Smart / AI features

Deferred out of v1 by decision. Each one needs logged history to be worth anything.

- **Progressive overload suggestions** — AI assist on the edge cases the rule-based version gets wrong.
- **Plan generation** — describe goal, days per week, equipment; get an editable program.
- **Coach chat** — grounded in the user's own logged history, not generic advice.
- **Gap-closing meal suggestions** — "40g protein short, 500 kcal left" → options from foods actually eaten.
- **Weekly review** — short written summary of adherence, trends, one or two adjustments.
- **Deload / fatigue hints** — flag stalling or dropping performance across sessions.
- **Voice logging** — speak a meal or a set, confirm the parsed entry.
- **Auto-adjusting targets** — propose a calorie adjustment when actual weight change diverges from projection.

When these arrive, AI calls go through Supabase edge functions so keys stay server-side and cost is rate-limited per user.

---

## Visual direction — "concrete and cobalt"

Tokens live in `src/styles.css`. The point of writing this down is that the session screens must inherit it rather than invent a second language.

- **Palette from the plates.** Cool concrete greys and chalk ink, with one cobalt accent lifted from the 20 kg competition disc — the standard plate on the standard bar. Plate yellow (15 kg) marks attention: edited fields and incomplete metadata, nothing else. The full IWF disc set is tokenised (`--plate-25` … `--plate-5`) and reserved for the plate calculator.
- **Width is the typographic axis**, not serif versus sans. One family — Archivo variable, self-hosted because the app must work offline — with width carrying the role: expanded 800 uppercase for titles and section markers (stencilled, like rack markings), regular for names and prose, condensed uppercase and tracked for metadata and data. When loads arrive they take the condensed tabular cut and become the largest thing on the screen.
- **A ledger, not cards.** Rows are flush to the container and separated by hairlines, with no floating card chrome. `border-radius` stays at 2px throughout.
- **Structure encodes content.** The library breaks into alphabet markers because the list is sorted by Finnish name and that is the axis you scan. Instruction steps are numbered because a lift is a sequence. Nothing is numbered decoratively.
- **The body plan is the signature.** `src/components/BodyPlan.tsx` draws a schematic figure per movement, primaries in cobalt and secondaries ghosted, built from `primaryMuscles` / `secondaryMuscles`. Lists show one figure, auto-picked by which side the movement works — front for a press, back for a row. The editor shows both. It reuses directly for weekly volume per muscle group on the progress screen.
- **Restraint.** No gradients, no shadows, two colours beyond the greys. Motion is a short staggered list reveal and state changes only, and `prefers-reduced-motion` disables it. Tap targets stay at 48px.

Finnish numerals govern case — "1 liike" but "68 liikettä". `src/i18n.ts` handles it; getting it wrong is what makes an interface read as machine-translated.

## Principles

- Fast path first: the most common action is never more than two taps from launch.
- Editable inference: nothing generated is written without a visible, reversible surface.
- Honest estimates: ranges and confidence rather than false precision.
- Offline is the default assumption, not the error case.
- Health data is sensitive — explicit consent for anything leaving the device.
- No streaks-as-punishment, no shame mechanics.

## Out of scope

- Social feed, following, sharing.
- Wearable integrations beyond basic weight import.
- Medical or clinical claims of any kind.
- Multi-user, teams, or coach-client features.
- Monetization — personal use, no paid tier.

## Assumptions taken

Stated rather than asked. Flag any that are wrong.

- Single user, but Supabase auth is used from the start so multi-user isn't a rewrite.
- Finnish UI copy lives in a string table from day one, so English can be added without touching components.
- Exercise library is seeded manually (~60–80 movements) rather than imported from a dataset.
- Success for v1 = every training session logged in the app for 8 consecutive weeks, with no fallback to notes or paper.

## Open questions

- None blocking. Nutrition-era questions (food data source, image→macros provider and accuracy bar) get answered when that phase starts — see [TODO.md](TODO.md).
