"""
Merge all per-worker results CSVs back into the work queue and print a
reconciliation summary. Run after the swarm finishes.

    python merge_results.py
"""
import csv
import glob
import os

HERE = os.path.dirname(__file__)
QUEUE = os.path.join(HERE, "..", "work_queue.csv")
RESULTS = os.path.join(HERE, "results", "*.csv")
OUT = os.path.join(HERE, "..", "work_queue_status.csv")


def main():
    latest = {}  # record_id -> (result, note, timestamp, worker)
    for fp in glob.glob(RESULTS):
        with open(fp, newline="") as f:
            for r in csv.DictReader(f):
                rid, ts = r["record_id"], r["timestamp"]
                if rid not in latest or ts >= latest[rid][2]:
                    latest[rid] = (r["result"], r["note"], ts, r["worker"])

    with open(QUEUE, newline="") as f:
        reader = csv.DictReader(f)
        cols = list(reader.fieldnames)
        rows = list(reader)

    counts = {}
    for row in rows:
        res = latest.get(row["record_id"])
        if res:
            row["entry_status"], row["agent_notes"] = res[0], res[1]
            row["claimed_by"] = res[3]
        status = row["entry_status"]
        counts[status] = counts.get(status, 0) + 1

    with open(OUT, "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=cols)
        w.writeheader()
        w.writerows(rows)

    total = len(rows)
    print(f"Wrote {OUT}")
    print(f"Total records: {total}")
    for k in sorted(counts):
        print(f"  {k:<12} {counts[k]}")
    done = counts.get("DONE", 0) + counts.get("SKIPPED", 0)
    hold = counts.get("HOLD", 0)
    err = counts.get("ERROR", 0)
    pend = counts.get("PENDING", 0)
    print(f"\nReconciliation: DONE+SKIPPED={done}  HOLD={hold}  ERROR={err}  "
          f"PENDING={pend}  -> {done + hold + err + pend} / {total}")
    if err:
        print("  ⚠ ERRORs need follow-up (see agent_notes in work_queue_status.csv).")
    if pend:
        print("  ⚠ PENDING rows were never attempted.")


if __name__ == "__main__":
    main()
