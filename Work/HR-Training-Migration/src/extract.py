"""Extract raw records from assorted spreadsheets (and, optionally, OCR'd PDFs).

This stage is deliberately forgiving: it reads every spreadsheet in a folder,
maps each file's messy headers onto our three canonical columns, and stacks the
result into one long DataFrame of (staff_name, course, completion_date, source).

OCR of scanned/paper sheets is handled OUTSIDE this module by the
appautomaton/document-SKILLs PDF skill (see README). That skill turns scans into
CSV/text; drop those CSVs into the same input folder and they flow through here.
"""
from __future__ import annotations

from pathlib import Path

import pandas as pd

# Map many possible header spellings -> our canonical field name.
HEADER_ALIASES: dict[str, str] = {
    # staff name
    "name": "staff_name",
    "staff": "staff_name",
    "staff name": "staff_name",
    "employee": "staff_name",
    "employee name": "staff_name",
    "full name": "staff_name",
    "worker": "staff_name",
    # course
    "course": "course",
    "course title": "course",
    "training": "course",
    "training course": "course",
    "module": "course",
    "subject": "course",
    "topic": "course",
    # completion date
    "date": "completion_date",
    "completion date": "completion_date",
    "completed": "completion_date",
    "date completed": "completion_date",
    "completion": "completion_date",
    "attended": "completion_date",
    "date attended": "completion_date",
    "trained": "completion_date",
}

CANONICAL_COLS = ["staff_name", "course", "completion_date"]
READERS = {".csv": pd.read_csv, ".xlsx": pd.read_excel, ".xls": pd.read_excel}


def _map_headers(df: pd.DataFrame) -> pd.DataFrame:
    renamed = {}
    for col in df.columns:
        key = str(col).strip().lower()
        if key in HEADER_ALIASES:
            renamed[col] = HEADER_ALIASES[key]
    df = df.rename(columns=renamed)
    # Keep only the canonical columns that are present
    present = [c for c in CANONICAL_COLS if c in df.columns]
    return df[present]


def read_file(path: Path) -> pd.DataFrame:
    reader = READERS.get(path.suffix.lower())
    if reader is None:
        raise ValueError(f"Unsupported file type: {path.name}")
    # dtype=str keeps dates/serials raw so normalise.py controls parsing.
    if path.suffix.lower() == ".csv":
        raw = reader(path, dtype=str, keep_default_na=False)
    else:
        raw = reader(path, dtype=str)
    mapped = _map_headers(raw)
    mapped = mapped.reindex(columns=CANONICAL_COLS)  # ensure all 3 exist
    mapped["source"] = path.name
    return mapped


def read_folder(folder: str | Path) -> pd.DataFrame:
    folder = Path(folder)
    files = sorted(
        p for p in folder.iterdir()
        if p.is_file() and p.suffix.lower() in READERS
    )
    if not files:
        raise FileNotFoundError(f"No .csv/.xlsx/.xls files found in {folder}")
    frames = [read_file(p) for p in files]
    combined = pd.concat(frames, ignore_index=True)
    # Drop rows that are entirely empty across the canonical fields
    combined = combined.dropna(subset=CANONICAL_COLS, how="all").reset_index(drop=True)
    return combined
