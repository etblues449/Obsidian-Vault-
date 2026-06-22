"""reconcile.py — cross-check attendance-sheet records against Atlas (and the master).

This is the heart of the "full accuracy" loop. It answers three questions for
every training record found on the paper attendance sheets:

  1. Is this PERSON already a staff record in Atlas?           -> if not: CREATE STAFF
  2. Is this exact PERSON + COURSE already recorded in Atlas?   -> if not: ADD RECORD
  3. (optional) Was it captured in the VERIFIED master?         -> gap visibility

Outputs (written to --outdir):
  staff_to_create_in_atlas.csv   people on sheets with NO matching Atlas staff
  records_to_add.csv             person is in Atlas, but this course record is missing
  reconciliation_full.csv        every sheet record with its match verdict
  summary.txt                    headline counts for the run

Usage:
  python reconcile.py \
      --sheets   data/sheet_records.csv \
      --atlas    data/TrainingRecordReport.xlsx \
      --master   data/Atlas_Training_Master_VERIFIED.xlsx \
      --outdir   output

Input CSV (--sheets) columns (header row required):
  full_name, course, completion_date, source
(produce this with the OCR step — see RUNBOOK.md. completion_date as dd/mm/yyyy.)

No exotic dependencies: pandas + openpyxl. rapidfuzz used if present, else difflib.
"""
from __future__ import annotations

import argparse
import re
from pathlib import Path

import pandas as pd

try:
    from rapidfuzz import fuzz
    def ratio(a, b): return fuzz.token_sort_ratio(a, b)
except ImportError:
    import difflib
    def ratio(a, b): return difflib.SequenceMatcher(None, a, b).ratio() * 100

NAME_MATCH = 88   # >= this score => same person
COURSE_MATCH = 80 # >= this score => same course family

# Map sheet course wording -> a normalised family also used for the Atlas side.
COURSE_FAMILIES = {
    "moving": "moving & handling", "handling": "moving & handling", "hoist": "moving & handling",
    "safeguard": "safeguarding", "medication": "medication", "epilepsy": "epilepsy",
    "buccal": "epilepsy", "midazolam": "epilepsy", "first aid": "first aid", "efaw": "first aid",
    "autism": "autism", "asc": "autism", "oliver mcgowan": "autism",
    "induction": "induction", "price": "price (pbs)", "pbs": "price (pbs)",
    "makaton": "makaton", "mca": "mca & dols", "dols": "mca & dols",
    "dysphagia": "dysphagia", "peg": "peg feeding", "diabetes": "diabetes",
    "fire": "fire safety", "record": "record keeping", "information": "record keeping",
    "driver": "driver safety", "risk": "risk assessment",
}


def norm_name(s) -> str:
    if pd.isna(s):
        return ""
    s = re.sub(r"\s+", " ", str(s)).strip()
    if "," in s:                       # "Surname, Forename" -> "Forename Surname"
        a, _, b = s.partition(",")
        s = f"{b.strip()} {a.strip()}"
    return s.lower().strip()


def course_family(s) -> str:
    t = str(s).lower()
    for key, fam in COURSE_FAMILIES.items():
        if key in t:
            return fam
    return t.strip()


def best_person(name: str, candidates: list[str]) -> tuple[str | None, float]:
    best, score = None, 0.0
    for c in candidates:
        r = ratio(name, c)
        if r > score:
            best, score = c, r
    return (best, score) if best else (None, 0.0)


def load_atlas(path: Path) -> pd.DataFrame:
    df = pd.read_excel(path)
    # Atlas export columns: Support Worker Name, Course Name, Training Completed Date ...
    name_col = next((c for c in df.columns if "name" in c.lower() and "course" not in c.lower()), df.columns[0])
    course_col = next((c for c in df.columns if "course" in c.lower()), None)
    df = df.rename(columns={name_col: "atlas_name", course_col: "atlas_course"})
    df["_name"] = df["atlas_name"].map(norm_name)
    df["_fam"] = df["atlas_course"].map(course_family) if course_col else ""
    return df


def main() -> None:
    ap = argparse.ArgumentParser(description="Reconcile attendance sheets vs Atlas.")
    ap.add_argument("--sheets", required=True)
    ap.add_argument("--atlas", required=True)
    ap.add_argument("--master", default=None)
    ap.add_argument("--outdir", default="output")
    args = ap.parse_args()

    out = Path(args.outdir)
    out.mkdir(parents=True, exist_ok=True)

    sheets = pd.read_csv(args.sheets, dtype=str).fillna("")
    sheets["nm"] = sheets["full_name"].map(norm_name)
    sheets["fam"] = sheets["course"].map(course_family)

    atlas = load_atlas(Path(args.atlas))
    atlas_people = sorted(set(atlas["_name"]) - {""})
    atlas_person_course = set(zip(atlas["_name"], atlas["_fam"]))

    master_people = set()
    if args.master:
        m = pd.read_excel(args.master, sheet_name=-1)
        ncol = next((c for c in m.columns if "name" in c.lower()), m.columns[1])
        master_people = set(m[ncol].map(norm_name)) - {""}

    rows, to_create, to_add = [], {}, []
    for r in sheets.itertuples(index=False):
        nm, fam = r.nm, r.fam
        if not nm:
            continue
        match, score = best_person(nm, atlas_people)
        in_atlas = score >= NAME_MATCH
        verdict, atlas_match = "", ""
        if not in_atlas:
            in_master = nm in master_people
            verdict = ("CREATE STAFF (not in Atlas; in master)" if in_master
                       else "CREATE STAFF (not in Atlas AND not in master)")
            to_create.setdefault(r.full_name.title(), (r.source, in_master))
        else:
            atlas_match = match
            # does this person already have this course family in Atlas?
            has_course = any(pc[0] == match and ratio(pc[1], fam) >= COURSE_MATCH
                             for pc in atlas_person_course)
            if has_course:
                verdict = "ALREADY IN ATLAS"
            else:
                verdict = "ADD RECORD (person in Atlas, course missing)"
                to_add.append({"full_name": r.full_name.title(), "course": r.course,
                               "completion_date": r.completion_date, "source": r.source,
                               "atlas_name": match})
        rows.append({"full_name": r.full_name, "course": r.course,
                     "completion_date": r.completion_date, "source": r.source,
                     "atlas_person_match": atlas_match, "match_score": round(score),
                     "in_master": (nm in master_people), "verdict": verdict})

    full = pd.DataFrame(rows)
    full.to_csv(out / "reconciliation_full.csv", index=False)
    create_rows = [{"full_name": k, "first_seen_source": v[0],
                    "already_in_master": v[1],
                    "priority": "captured-awaiting-entry" if v[1] else "MISSED-recover-from-scratch"}
                   for k, v in sorted(to_create.items())]
    pd.DataFrame(create_rows).to_csv(out / "staff_to_create_in_atlas.csv", index=False)
    pd.DataFrame(to_add).to_csv(out / "records_to_add.csv", index=False)

    n = len(full)
    c_create = len(to_create)
    c_missed = sum(1 for v in to_create.values() if not v[1])
    c_add = len(to_add)
    c_have = int((full["verdict"] == "ALREADY IN ATLAS").sum())
    summary = (
        f"Reconciliation summary\n"
        f"  sheet records processed : {n}\n"
        f"  already in Atlas        : {c_have}\n"
        f"  records to ADD          : {c_add}   -> records_to_add.csv\n"
        f"  staff to CREATE first   : {c_create}   -> staff_to_create_in_atlas.csv\n"
        f"     of which NOT in the master either (prior audit missed them): {c_missed}\n"
        f"\nLOOP: create the staff above in Atlas, re-export the Atlas report,\n"
        f"      then run this again. 'staff to CREATE' should fall to 0 = full accuracy.\n"
    )
    (out / "summary.txt").write_text(summary)
    print(summary)


if __name__ == "__main__":
    main()
