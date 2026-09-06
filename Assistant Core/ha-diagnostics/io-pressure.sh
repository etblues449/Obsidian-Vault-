#!/bin/sh
# io-pressure.sh — is the disk actually the bottleneck? READ-ONLY.
#
# WHY THIS EXISTS
# ---------------
# Every fault on this hub on 2026-09-06 looked like slowness, and every attempt
# to prove it was slowness ran into the same wall: nothing was measuring the
# disk. `disk_life_time` is null. Supervisor's per-container `blk_read` and
# `blk_write` are all 0 (cgroup v2 without IO accounting enabled). So "slow
# disk" stayed UNMEASURED, which is not the same as disproven, and a whole
# evening's reasoning was built on the gap.
#
# It also produced a wrong conclusion worth recording. A journal write storm was
# found — 24 MB every ~11 minutes, ~2 GB/day — and called "the disk I/O that
# cgroup accounting could not show". Then the arithmetic got done: 2 GB/day is
# 24 KB/s. That is 0.06% of even a slow eMMC. It cannot saturate anything.
# The storm is real and worth fixing, but it was never the cause of the slowness.
#
# WHAT THIS MEASURES INSTEAD
#   1. Pressure Stall Information (/proc/pressure/*) — the kernel's own answer
#      to "how much time did runnable tasks spend stalled waiting for IO?".
#      This is the number that settles it. It is not an inference.
#   2. /proc/diskstats sampled twice — per-device throughput and %util, so a
#      high pressure reading can be attributed to a device.
#
# READING THE RESULT
#   io  some avg60 near 0   -> the disk is NOT the bottleneck. Look elsewhere.
#   io  some avg60 > 20     -> tasks are stalled on IO a fifth of the time.
#                              That is the fault, and %util names the device.
#   io  full avg60 high     -> EVERYTHING was stalled. Nothing else matters.
#   cpu / memory high       -> the bottleneck is not the disk at all.
#
# WHERE TO RUN IT
#   The SSH & Web Terminal add-on is enough. /proc/pressure and /proc/diskstats
#   are not namespaced per container, so the figures are HOST-WIDE — which is
#   exactly what is wanted, and is why this works without a host shell.
#
# USAGE
#   sh "Assistant Core/ha-diagnostics/io-pressure.sh"
#
#   SAMPLE_SECS   diskstats sample window (default 10)
#   PROC          /proc override, for testing only
#
# WHAT IT WILL NOT DO
#   No writes anywhere. It reads two files in /proc and sleeps in between.

set -eu

PROC="${PROC:-/proc}"
SAMPLE_SECS="${SAMPLE_SECS:-10}"

say() { printf '%s\n' "$*"; }
hdr() { printf '\n=== %s ===\n' "$*"; }

TMPD="${TMPDIR:-/tmp}/io-pressure.$$"
mkdir -p "$TMPD"
trap 'rm -rf "$TMPD"' EXIT INT TERM

# ── 1. pressure stall information ───────────────────────────────────────────
hdr "1. pressure stall information (kernel PSI)"

psi_verdict=""
if [ -r "$PROC/pressure/io" ]; then
  for res in io cpu memory; do
    f="$PROC/pressure/$res"
    [ -r "$f" ] || { say "$res: unreadable"; continue; }
    say "-- $res --"
    sed 's/^/  /' "$f"
  done

  # "some" = at least one task stalled; "full" = every task stalled. For a
  # bottleneck question, `some avg60` on io is the number that matters.
  psi_verdict=$(awk '
      /^some/ {
        for (i = 2; i <= NF; i++) {
          split($i, kv, "=")
          if (kv[1] == "avg60") v = kv[2] + 0
        }
      }
      END { printf "%.2f", v }
    ' "$PROC/pressure/io")

  say ""
  say "io some avg60 = ${psi_verdict}%"
  # Thresholds are deliberately coarse. PSI is noisy below ~5% and the question
  # here is binary: is IO the thing to chase, or is it not.
  case "$psi_verdict" in
    *) awk -v v="$psi_verdict" 'BEGIN {
         if (v >= 20)
           print "  >= 20%  TASKS ARE STALLED ON IO A FIFTH OF THE TIME OR MORE.\n" \
                 "          The disk IS the bottleneck. Section 2 names the device."
         else if (v >= 5)
           print "  5-20%   Elevated. IO is contributing but may not be the whole\n" \
                 "          story. Check whether it correlates with a specific job\n" \
                 "          (a backup, a recording, an image pull) or is constant."
         else
           print "  < 5%    IO is NOT the bottleneck right now. A slowness that\n" \
                 "          persists while this reads near zero is NOT a disk\n" \
                 "          problem, whatever it looks like. Look at CPU, memory,\n" \
                 "          the network, or a service blocking on something else."
       }' ;;
  esac
else
  say "no $PROC/pressure/io — PSI is not available on this kernel."
  say "Section 2 still works; you just lose the one unambiguous number."
fi

# ── 2. per-device throughput and utilisation ────────────────────────────────
hdr "2. disk activity over ${SAMPLE_SECS}s"

if [ ! -r "$PROC/diskstats" ]; then
  say "no $PROC/diskstats — cannot measure devices."
else
  cp "$PROC/diskstats" "$TMPD/a"
  sleep "$SAMPLE_SECS"
  cp "$PROC/diskstats" "$TMPD/b"

  # diskstats fields: 3=name 6=sectors read 10=sectors written 13=ms doing IO.
  # A sector is 512 bytes regardless of the device's physical sector size.
  # %util = time the device had IO in flight / wall time.
  awk -v secs="$SAMPLE_SECS" '
    NR == FNR {
      r[$3] = $6; w[$3] = $10; t[$3] = $13
      next
    }
    {
      dev = $3
      # Skip pseudo-devices and anything that did nothing — a listing full of
      # idle loop devices buries the one line that matters.
      if (dev ~ /^(loop|ram|zram|dm-)/) next
      dr = $6  - r[dev]
      dw = $10 - w[dev]
      dt = $13 - t[dev]
      if (dr <= 0 && dw <= 0) next
      printf "  %-12s read %8.1f KB/s   write %8.1f KB/s   util %5.1f%%\n",
             dev, dr * 512 / 1024 / secs, dw * 512 / 1024 / secs,
             dt / (secs * 1000) * 100
      any = 1
    }
    END {
      if (!any) print "  (no device did any IO during the sample — the box is idle)"
    }
  ' "$TMPD/a" "$TMPD/b" | sort -k8 -rn

  say ""
  say "util is time the device had a request in flight, not bandwidth used. A"
  say "device at 100% util and 200 KB/s is not busy — it is SLOW, and that is a"
  say "different fault from a device that is genuinely saturated with traffic."
fi

# ── 3. what this does and does not tell you ─────────────────────────────────
hdr "3. next step"
cat <<'NEXT'
This measures WHETHER the disk is the bottleneck and WHICH device. It cannot
say which process is responsible: /proc/<pid>/io only covers this container's
own PIDs, and Supervisor's per-container blk_read/blk_write read 0 on this host
because cgroup v2 IO accounting is not enabled.

For per-process attribution you need the host shell on port 22222:

    # which cgroup (= which container) is doing the IO
    for f in /sys/fs/cgroup/**/io.stat; do echo "== $f"; cat "$f"; done

    # or, if iotop exists
    iotop -bon1

If PSI says IO is NOT the bottleneck, stop looking at the disk. Slowness with
near-zero IO pressure is a different fault, and the journal write storm is not
it either — 2 GB/day is 24 KB/s, which is a rounding error against any disk.
NEXT

say ""
say "read-only: nothing was written. Two files in $PROC were read."
