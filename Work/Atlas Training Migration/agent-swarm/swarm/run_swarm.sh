#!/usr/bin/env bash
# One-command swarm launcher. Splits a queue row-range across N workers, runs
# them in parallel (you watch the live console), then reconciles.
#
#   ./run_swarm.sh <start> <end> <workers>
#   ./run_swarm.sh 1 296 5      # the 296 OVERDUE across 5 workers
#   ./run_swarm.sh 1 1358 5     # everything
#
# Pilot first (no writes):  ./run_swarm.sh --pilot
set -euo pipefail
cd "$(dirname "$0")"

if [[ "${1:-}" == "--pilot" ]]; then
  echo "== PILOT (dry-run, no writes) =="
  python run_worker.py --worker pilot --start 1 --end 10 --dry-run
  echo
  echo "Dry-run done. For a real 10-record pilot once selectors+login are set:"
  echo "  python run_worker.py --worker pilot --start 1 --end 10"
  exit 0
fi

START="${1:?usage: run_swarm.sh <start> <end> <workers>}"
END="${2:?usage: run_swarm.sh <start> <end> <workers>}"
N="${3:?usage: run_swarm.sh <start> <end> <workers>}"

echo "== Preflight =="
python preflight.py
echo
read -r -p "Proceed with LIVE entry of rows ${START}-${END} across ${N} workers? [y/N] " a
[[ "$a" == "y" || "$a" == "Y" ]] || { echo "Aborted."; exit 1; }

total=$((END - START + 1))
per=$(( (total + N - 1) / N ))
labels=(A B C D E F G H I J)

echo "== Launching ${N} workers (~${per} records each) =="
pids=()
s="$START"
for ((i=0; i<N; i++)); do
  e=$(( s + per - 1 )); (( e > END )) && e=$END
  (( s > END )) && break
  python run_worker.py --worker "${labels[$i]}" --start "$s" --end "$e" &
  pids+=($!)
  echo "  worker ${labels[$i]}: rows ${s}-${e} (pid $!)"
  s=$(( e + 1 ))
done

for p in "${pids[@]}"; do wait "$p" || true; done

echo "== Reconcile =="
python merge_results.py
