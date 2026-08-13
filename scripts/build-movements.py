#!/usr/bin/env python3
"""
Build the Qwark movement library from free-exercise-db.

One-off data-prep script. Output is committed to data/ and the app never calls
this or the upstream source at runtime — see SPEC.md "Exercise data sources".

Source: https://github.com/yuhonas/free-exercise-db (declared public domain)
Only metadata is used. Upstream images are ignored: their provenance is
unresolved (issues #2 and #12, both unanswered).

Usage:  python3 scripts/build-movements.py
Reads:  data/overrides.json        optional admin edits, merged over the seed
        data/id-ledger.json        pinned movement ids, append-only
Emits:  data/movements.all.json    all 873 movements, normalised
        data/movements.seed.json   curated gym set with Finnish names
        data/taxonomy.json         muscle + equipment labels in Finnish
        data/templates.seed.json   starter routines, movement ids validated
        data/id-ledger.json        updated with any newly minted ids

Finnish names are DRAFTS pending review by a native speaker. Corrections belong
in data/overrides.json, not in this file's CURATED table — that file is what the
app's admin editor exports, so the two paths stay interchangeable.

Overrides are keyed by movement id and patch individual fields:

    {
      "taljaristiveto": { "nameFi": "Ristiveto taljassa" },
      "car-deadlift":   { "hidden": true }
    }

`id` itself is never overridable. Logged sets reference it, so it must stay
stable even when nameEn changes.

THE ID LEDGER
-------------
Ids are looked up in data/id-ledger.json, never recomputed. Upstream has no
stable identifier — its own `id` field is slugified from the name, so it rotates
on rename — which means a rename would otherwise mint a new id and orphan every
set logged against the old one.

The ledger is keyed by OUR id and records which upstream name(s) map to it:

    "barbell-squat": {
      "upstreamName": "Barbell Squat",
      "firstSeen": "2026-08-11",
      "aliases": []
    }

On an upstream rename this build reports the old id as orphaned and mints an id
for the new name. To resolve: confirm the two are the same movement, add the new
name to the old entry's `aliases`, delete the freshly minted entry, and re-run.
The lookup then hits the alias, the id stays put, and the duplicate is gone. One
hand-resolution per rename.

Deleting a just-minted entry is the one exception to append-only: it was never
referenced by anything, because the build that created it is the build that
reported the problem.

Invariants: entries are append-only, ids are never reused for a different
movement, and an existing id is never rewritten. A movement dropped upstream
keeps its entry so old sessions still resolve.
"""

import json
import re
import sys
import urllib.request
from datetime import date
from pathlib import Path

SRC = "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json"
ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
CACHE = ROOT / ".cache" / "free-exercise-db.json"

MUSCLES_FI = {
    "quadriceps": "Etureidet",
    "hamstrings": "Takareidet",
    "glutes": "Pakarat",
    "calves": "Pohkeet",
    "adductors": "Lähentäjät",
    "abductors": "Loitontajat",
    "chest": "Rintalihakset",
    "lats": "Leveä selkälihas",
    "middle back": "Keskiselkä",
    "lower back": "Alaselkä",
    "traps": "Epäkäslihas",
    "shoulders": "Olkapäät",
    "biceps": "Hauikset",
    "triceps": "Ojentajat",
    "forearms": "Kyynärvarret",
    "abdominals": "Vatsalihakset",
    "neck": "Niska",
}

EQUIPMENT_FI = {
    "barbell": "Levytanko",
    "dumbbell": "Käsipainot",
    "cable": "Talja",
    "machine": "Laite",
    "body only": "Kehonpaino",
    "kettlebells": "Kahvakuulat",
    "bands": "Vastuskuminauhat",
    "e-z curl bar": "Kaareva tanko",
    "exercise ball": "Jumppapallo",
    "medicine ball": "Kuntopallo",
    "foam roll": "Putkirulla",
    "other": "Muu",
}

# (exact upstream name, Finnish draft). Order defines display order per group.
CURATED = [
    # --- Jalat -------------------------------------------------------------
    ("Barbell Squat",                          "Jalkakyykky"),
    ("Front Squat (Clean Grip)",               "Etukyykky"),
    ("Leg Press",                              "Jalkaprässi"),
    ("Barbell Deadlift",                       "Maastaveto"),
    ("Romanian Deadlift",                      "Romanialainen maastaveto"),
    ("Sumo Deadlift",                          "Sumomaastaveto"),
    ("Barbell Lunge",                          "Askelkyykky"),
    # Upstream has no rear-foot-elevated (Bulgarian) split squat. Its bare
    # "Split Squats" entry is a jumping plyometric, not this movement.
    ("Split Squat with Dumbbells",              "Askelkyykky paikallaan"),
    ("Dumbbell Step Ups",                      "Askelnousu"),
    ("Leg Extensions",                         "Reiden ojennus"),
    ("Lying Leg Curls",                        "Reiden koukistus maaten"),
    ("Seated Leg Curl",                        "Reiden koukistus istuen"),
    ("Standing Calf Raises",                   "Pohkeen nosto seisten"),
    ("Seated Calf Raise",                      "Pohkeen nosto istuen"),
    ("Barbell Hip Thrust",                     "Lantionnosto tangolla"),
    ("Good Morning",                           "Aamunavaus"),
    ("Butt Lift (Bridge)",                     "Lantionnosto"),
    # --- Rinta -------------------------------------------------------------
    ("Barbell Bench Press - Medium Grip",      "Penkkipunnerrus"),
    ("Barbell Incline Bench Press - Medium Grip", "Vinopenkkipunnerrus"),
    ("Decline Barbell Bench Press",            "Laskeva penkkipunnerrus"),
    ("Dumbbell Bench Press",                   "Penkkipunnerrus käsipainoilla"),
    ("Incline Dumbbell Press",                 "Vinopenkkipunnerrus käsipainoilla"),
    ("Dumbbell Flyes",                         "Vipunosto penkillä"),
    ("Cable Crossover",                        "Taljaristiveto"),
    ("Pushups",                                "Punnerrus"),
    ("Dips - Chest Version",                   "Dipit rinnalle"),
    ("Machine Bench Press",                    "Penkkipunnerrus laitteessa"),
    # --- Selkä -------------------------------------------------------------
    ("Pullups",                                "Leuanveto (yliote)"),
    ("Chin-Up",                                "Leuanveto (alaote)"),
    ("Wide-Grip Lat Pulldown",                 "Ylätalja leveällä otteella"),
    ("Bent Over Barbell Row",                  "Kulmasoutu"),
    ("One-Arm Dumbbell Row",                   "Yhden käden kulmasoutu"),
    ("Seated Cable Rows",                      "Alatalja"),
    ("T-Bar Row with Handle",                  "T-tankosoutu"),
    ("Face Pull",                              "Kasvoveto"),
    ("Barbell Shrug",                          "Olankohautus tangolla"),
    ("Dumbbell Shrug",                         "Olankohautus käsipainoilla"),
    ("Hyperextensions (Back Extensions)",      "Selän ojennus"),
    # --- Olkapäät ----------------------------------------------------------
    ("Standing Military Press",                "Pystypunnerrus"),
    ("Dumbbell Shoulder Press",                "Pystypunnerrus käsipainoilla"),
    ("Arnold Dumbbell Press",                  "Arnold-punnerrus"),
    ("Side Lateral Raise",                     "Sivuvipunosto"),
    ("Front Dumbbell Raise",                   "Etuvipunosto"),
    ("Reverse Flyes",                          "Takavipunosto"),
    ("Upright Barbell Row",                    "Pystysoutu"),
    ("Push Press",                             "Työntöpunnerrus"),
    # --- Kädet -------------------------------------------------------------
    ("Barbell Curl",                           "Hauiskääntö tangolla"),
    ("Dumbbell Bicep Curl",                    "Hauiskääntö käsipainoilla"),
    ("Hammer Curls",                           "Vasarakääntö"),
    ("Preacher Curl",                          "Hauiskääntö saarnastuolissa"),
    ("Concentration Curls",                    "Keskitetty hauiskääntö"),
    ("Triceps Pushdown",                       "Ojentajapunnerrus taljassa"),
    ("Cable Rope Overhead Triceps Extension",  "Ojentajan ojennus pään takaa"),
    ("EZ-Bar Skullcrusher",                    "Ranskalainen punnerrus"),
    ("Close-Grip Barbell Bench Press",         "Kapea penkkipunnerrus"),
    ("Dips - Triceps Version",                 "Dipit ojentajalle"),
    ("Tricep Dumbbell Kickback",               "Ojentajan taakseveto"),
    # --- Keskivartalo ------------------------------------------------------
    ("Plank",                                  "Lankku"),
    ("Side Bridge",                            "Kylkilankku"),
    ("Crunches",                               "Vatsarutistus"),
    ("Rope Crunch",                            "Vatsarutistus taljassa"),
    ("Hanging Leg Raise",                      "Jalkojen nosto riippuen"),
    ("Russian Twist",                          "Venäläinen kierto"),
    ("Ab Roller",                              "Vatsarulla"),
    # --- Kyynärvarret / otelujuus -----------------------------------------
    ("Seated Palm-Up Barbell Wrist Curl",      "Ranteen koukistus"),
    ("Farmer's Walk",                          "Farmarikävely"),
    # --- Olympianostot -----------------------------------------------------
    ("Power Clean",                            "Rinnalleveto"),
    ("Clean and Jerk",                         "Rinnalleveto ja työntö"),
]


# Starter routines, so the first session has structure without a setup wizard.
# (movement id, sets, target reps). Ids are validated against the seed below.
TEMPLATES = [
    {
        "id": "tyontopaiva",
        "group": "Työntö / Veto / Jalat",
        "name": "Työntöpäivä",
        "items": [
            ("barbell-bench-press-medium-grip", 3, 8, 150),
            ("standing-military-press", 3, 8, 150),
            ("barbell-incline-bench-press-medium-grip", 3, 10, 120),
            ("side-lateral-raise", 3, 12, 90),
            ("triceps-pushdown", 3, 12, 90),
        ],
    },
    {
        "id": "vetopaiva",
        "group": "Työntö / Veto / Jalat",
        "name": "Vetopäivä",
        "items": [
            ("barbell-deadlift", 3, 5, 210),
            ("bent-over-barbell-row", 3, 8, 150),
            ("pullups", 3, 8, 150),
            ("seated-cable-rows", 3, 10, 120),
            ("barbell-curl", 3, 12, 90),
        ],
    },
    {
        "id": "jalkapaiva",
        "group": "Työntö / Veto / Jalat",
        "name": "Jalkapäivä",
        "items": [
            ("barbell-squat", 3, 8, 210),
            ("romanian-deadlift", 3, 8, 150),
            ("leg-press", 3, 10, 150),
            ("seated-leg-curl", 3, 12, 90),
            ("standing-calf-raises", 4, 12, 90),
        ],
    },
    {
        "id": "ylakroppa",
        "group": "Ylä / Ala",
        "name": "Yläkroppa",
        "items": [
            ("barbell-bench-press-medium-grip", 3, 8, 150),
            ("bent-over-barbell-row", 3, 8, 150),
            ("standing-military-press", 3, 10, 120),
            ("wide-grip-lat-pulldown", 3, 10, 120),
            ("dumbbell-bicep-curl", 3, 12, 90),
            ("triceps-pushdown", 3, 12, 90),
        ],
    },
    {
        "id": "alakroppa",
        "group": "Ylä / Ala",
        "name": "Alakroppa",
        "items": [
            ("barbell-squat", 3, 8, 210),
            ("romanian-deadlift", 3, 8, 150),
            ("barbell-lunge", 3, 10, 120),
            ("leg-extensions", 3, 12, 90),
            ("standing-calf-raises", 4, 12, 90),
        ],
    },
    {
        "id": "viisi-viisi-a",
        "group": "5×5",
        "name": "5×5 A",
        "items": [
            ("barbell-squat", 5, 5, 180),
            ("barbell-bench-press-medium-grip", 5, 5, 180),
            ("bent-over-barbell-row", 5, 5, 180),
        ],
    },
    {
        "id": "viisi-viisi-b",
        "group": "5×5",
        "name": "5×5 B",
        "items": [
            ("barbell-squat", 5, 5, 180),
            ("standing-military-press", 5, 5, 180),
            ("barbell-deadlift", 1, 5, 180),
        ],
    },
]


def slug(name: str) -> str:
    s = name.lower()
    s = re.sub(r"[^a-z0-9]+", "-", s)
    return s.strip("-")


def load_source() -> list:
    if CACHE.exists():
        return json.loads(CACHE.read_text())
    CACHE.parent.mkdir(parents=True, exist_ok=True)
    with urllib.request.urlopen(SRC, timeout=60) as r:
        raw = r.read()
    CACHE.write_bytes(raw)
    return json.loads(raw)


# Fields an admin may patch. `id` is deliberately absent — logged sets
# reference it, so it must survive a rename.
OVERRIDABLE = {
    "nameFi",
    "nameEn",
    "primaryMuscles",
    "secondaryMuscles",
    "equipment",
    "mechanic",
    "force",
    "level",
    "category",
    "instructions",
    "hidden",
}


def resolve_ids(src: list, ledger: dict) -> tuple[dict, list, list]:
    """Pin an id to every upstream movement, minting only for genuinely new ones.

    Returns (upstream name -> id, newly minted, orphaned ledger entries).
    """
    index = {}
    for mid, entry in ledger.items():
        for name in [entry["upstreamName"], *entry.get("aliases", [])]:
            index[name] = mid

    today = date.today().isoformat()
    assigned, minted = {}, []
    for x in sorted(src, key=lambda x: x["name"]):
        name = x["name"]
        mid = index.get(name)
        if mid is None:
            mid = slug(name)
            if mid in ledger:
                print(
                    f"ERROR: id collision — '{mid}' is already pinned to "
                    f"'{ledger[mid]['upstreamName']}', cannot also mean '{name}'.\n"
                    f"       Disambiguate by hand in data/id-ledger.json."
                )
                sys.exit(1)
            ledger[mid] = {
                "upstreamName": name,
                "firstSeen": today,
                "aliases": [],
            }
            minted.append((mid, name))
        assigned[name] = mid

    upstream_names = {x["name"] for x in src}
    orphaned = [
        (mid, entry["upstreamName"])
        for mid, entry in sorted(ledger.items())
        if entry["upstreamName"] not in upstream_names
        and not (set(entry.get("aliases", [])) & upstream_names)
    ]
    return assigned, minted, orphaned


def load_ledger() -> dict:
    path = DATA / "id-ledger.json"
    return json.loads(path.read_text()) if path.exists() else {}


def save_ledger(ledger: dict) -> None:
    (DATA / "id-ledger.json").write_text(
        json.dumps(dict(sorted(ledger.items())), ensure_ascii=False, indent=2) + "\n"
    )


def load_overrides() -> dict:
    path = DATA / "overrides.json"
    if not path.exists():
        return {}
    data = json.loads(path.read_text())
    bad = {
        mid: sorted(set(patch) - OVERRIDABLE)
        for mid, patch in data.items()
        if set(patch) - OVERRIDABLE
    }
    if bad:
        print("ERROR: overrides.json patches non-overridable fields:")
        for mid, fields in bad.items():
            print(f"    {mid}: {', '.join(fields)}")
        sys.exit(1)
    return data


def apply_overrides(movements: list, overrides: dict) -> tuple[list, int, list]:
    out, applied = [], 0
    for m in movements:
        patch = overrides.get(m["id"])
        if patch:
            m = {**m, **patch}
            applied += 1
        if not m.get("hidden"):
            out.append(m)
    unknown = sorted(set(overrides) - {m["id"] for m in movements})
    return out, applied, unknown


def normalise(x: dict, ids: dict, name_fi: str | None = None) -> dict:
    return {
        "id": ids[x["name"]],
        "nameFi": name_fi,
        "nameEn": x["name"],
        "primaryMuscles": x.get("primaryMuscles") or [],
        "secondaryMuscles": x.get("secondaryMuscles") or [],
        "equipment": x.get("equipment"),
        "mechanic": x.get("mechanic"),
        "force": x.get("force"),
        "level": x.get("level"),
        "category": x.get("category"),
        "instructions": x.get("instructions") or [],
    }


def main() -> int:
    src = load_source()
    by_name = {x["name"]: x for x in src}
    DATA.mkdir(exist_ok=True)
    overrides = load_overrides()

    ledger = load_ledger()
    ledger_before = len(ledger)
    ids, minted, orphaned = resolve_ids(src, ledger)
    save_ledger(ledger)

    # Full normalised catalogue, no Finnish names.
    all_out = sorted((normalise(x, ids) for x in src), key=lambda m: m["nameEn"])
    all_out, all_applied, unknown = apply_overrides(all_out, overrides)
    (DATA / "movements.all.json").write_text(
        json.dumps(all_out, ensure_ascii=False, indent=2) + "\n"
    )

    # Curated seed set with Finnish names.
    seed, missing = [], []
    for name_en, name_fi in CURATED:
        x = by_name.get(name_en)
        if x is None:
            missing.append(name_en)
            continue
        seed.append(normalise(x, ids, name_fi))

    if missing:
        print("ERROR: upstream names not found (upstream may have renamed them):")
        for m in missing:
            print("   ", m)
        return 1

    seed, seed_applied, _ = apply_overrides(seed, overrides)
    (DATA / "movements.seed.json").write_text(
        json.dumps(seed, ensure_ascii=False, indent=2) + "\n"
    )
    # Starter routines. Every movement id must exist in the seed, or the first-run
    # flow would offer a routine the library cannot resolve.
    seed_ids = {m["id"] for m in seed}
    bad = [
        (t["name"], mid)
        for t in TEMPLATES
        for mid, *_ in t["items"]
        if mid not in seed_ids
    ]
    if bad:
        print("ERROR: templates reference movements not in the seed:")
        for name, mid in bad:
            print(f"    {name}: {mid}")
        return 1

    (DATA / "templates.seed.json").write_text(
        json.dumps(
            [
                {
                    "id": t["id"],
                    "group": t["group"],
                    "name": t["name"],
                    # Position in the group's cycle. Table order is the sequence;
                    # id order is alphabetical and would scramble it.
                    "order": i,
                    "items": [
                        {
                            "movementId": mid,
                            "sets": sets,
                            "targetReps": reps,
                            "restSeconds": rest,
                        }
                        for mid, sets, reps, rest in t["items"]
                    ],
                }
                for i, t in enumerate(TEMPLATES)
            ],
            ensure_ascii=False,
            indent=2,
        )
        + "\n"
    )

    (DATA / "taxonomy.json").write_text(
        json.dumps(
            {"muscles": MUSCLES_FI, "equipment": EQUIPMENT_FI},
            ensure_ascii=False,
            indent=2,
        )
        + "\n"
    )

    used_muscles = {m for s in seed for m in s["primaryMuscles"]}
    print(f"movements.all.json   {len(all_out)} movements")
    print(f"movements.seed.json  {len(seed)} movements, Finnish names (draft)")
    print(f"taxonomy.json        {len(MUSCLES_FI)} muscles, {len(EQUIPMENT_FI)} equipment")
    print(f"templates.seed.json  {len(TEMPLATES)} routines, {sum(len(t['items']) for t in TEMPLATES)} entries")
    if overrides:
        print(
            f"overrides.json       {len(overrides)} patches "
            f"({seed_applied} hit the seed, {all_applied} the full catalogue)"
        )
    action = "created" if ledger_before == 0 else f"was {ledger_before}"
    print(f"id-ledger.json       {len(ledger)} pinned ids ({action}, {len(minted)} minted)")
    if unknown:
        print("WARNING: overrides for unknown movement ids:", ", ".join(unknown))
    if orphaned and ledger_before:
        print()
        print(f"WARNING: {len(orphaned)} pinned id(s) no longer present upstream.")
        print("         RENAMED? In data/id-ledger.json, add the new upstream name to")
        print("         the old entry's `aliases`, delete the entry just minted for it,")
        print("         then re-run. The id stays stable and the duplicate disappears.")
        print("         REMOVED? Leave the entry alone so old sessions still resolve.")
        if minted:
            print(f"         ({len(minted)} id(s) were minted this run — a rename shows up")
            print("          as one orphan plus one mint.)")
        for mid, name in orphaned[:15]:
            print(f"           {mid}  (was '{name}')")
        if len(orphaned) > 15:
            print(f"           … and {len(orphaned) - 15} more")
    print()

    # Fields the admin editor should surface for review.
    gaps = {
        "missing nameFi": sum(1 for s in seed if not s["nameFi"]),
        "missing mechanic": sum(1 for s in seed if not s["mechanic"]),
        "missing force": sum(1 for s in seed if not s["force"]),
        "missing equipment": sum(1 for s in seed if not s["equipment"]),
    }
    print("seed gaps needing admin review:")
    for k, v in gaps.items():
        print(f"   {k:<20} {v}")
    print()
    print("seed coverage by primary muscle:")
    for m in sorted(MUSCLES_FI):
        n = sum(1 for s in seed if m in s["primaryMuscles"])
        flag = "" if n else "   <- not covered"
        print(f"   {MUSCLES_FI[m]:<20} {n}{flag}")
    unknown = used_muscles - set(MUSCLES_FI)
    if unknown:
        print("WARNING: muscles missing a Finnish label:", unknown)
    return 0


if __name__ == "__main__":
    sys.exit(main())
