#!/bin/sh
# journal-storm.sh — find out WHAT is flooding the systemd journal. READ-ONLY.
#
# WHY THIS EXISTS
# ---------------
# On 2026-09-06 the HA Green's `systemd-journal-gatewayd` stopped answering:
# every Supervisor endpoint that reads journal *content* timed out at 20 s,
# including a ten-line tail, and a full host reboot did not fix it.
#
# Three unifying theories were raised and all three were killed by measurement:
#   * `journal-too-large` as a CAPACITY problem — disk was 79% free;
#   * memory starvation                        — MemAvailable 1.5 GB of 4 GB;
#   * a corrupt journal file                   — zero `*.journal~` files exist.
#
# What was actually there: a fresh 24 MB journal file every ~11 minutes.
# ~2.2 MB/min, ~3 GB/day, and only SIX HOURS of retention on a box that should
# hold weeks. gatewayd was not broken — it was being out-run.
#
# That leaves exactly one question, and this script answers it: which service is
# doing the writing. Silencing that service is the repair. Vacuuming the journal
# looks like progress and refills by lunchtime.
#
# WHERE TO RUN IT
#   The SSH & Web Terminal add-on is enough — `/var/log/journal` is mounted into
#   that container. No host shell, no port 22222, no `journalctl` needed. That
#   was the one lucky break in this whole investigation; do not give it back by
#   assuming you need root on the host.
#
# USAGE
#   sh "Assistant Core/ha-diagnostics/journal-storm.sh"
#
#   JOURNAL_DIR   override the journal directory (default: autodetect under
#                 /var/log/journal/<machine-id>/)
#   SAMPLE_SECS   live write-rate sample window, seconds (default 60; 0 skips it)
#   TOP           how many rows per ranking (default 12)
#   FILE          analyse this specific journal file instead of the largest
#
# WHAT IT WILL NOT DO
#   No writes, no deletes, no rotate, no vacuum, no service restarts. It opens
#   journal files for reading and nothing else. Every repair this script implies
#   is printed as text for a human to decide on. It does create one scratch file
#   under $TMPDIR for the ranking and removes it on exit — nothing in the journal
#   directory is ever touched.
#
# READ THE CAVEAT IN "how to read the rankings" BEFORE BELIEVING THE NUMBERS.
# systemd de-duplicates field values, so an occurrence count is a count of
# DISTINCT values, not of log entries. The byte column is the honest one.

set -eu

SAMPLE_SECS="${SAMPLE_SECS:-60}"
TOP="${TOP:-12}"

# One scratch file, so the 24 MB extraction is walked once and then re-read
# rather than re-grepped. Nothing in the journal directory is ever written.
TMPD="${TMPDIR:-/tmp}/journal-storm.$$"
mkdir -p "$TMPD"
trap 'rm -rf "$TMPD"' EXIT INT TERM
RANK="$TMPD/ranked"
: > "$RANK"

say()  { printf '%s\n' "$*"; }
hdr()  { printf '\n=== %s ===\n' "$*"; }
die()  { printf 'ABORT: %s\n' "$*" >&2; exit 1; }

# Integer maths only — no bc. Report KB below 1 MB rather than printing "0 MB",
# which reads as "empty" when it means "small".
# NB: sh has no locals. The variable name here must not collide with anything
# at a call site — `mb "$a"` clobbering `$b` before `mb "$b"` is evaluated would
# silently print the same size twice.
mb() {
  _mb_b="${1:-0}"
  if [ "$_mb_b" -ge 1048576 ]; then echo "$(( _mb_b / 1048576 )) MB"
  else echo "$(( _mb_b / 1024 )) KB"; fi
}

# ── locate the journal ──────────────────────────────────────────────────────
if [ -n "${JOURNAL_DIR:-}" ]; then
  JDIR="${JOURNAL_DIR%/}"
else
  JDIR=""
  for d in /var/log/journal/*/; do
    [ -d "$d" ] || continue
    JDIR="${d%/}"
    break
  done
fi

[ -n "$JDIR" ] || die "no journal directory found under /var/log/journal/.
  If this host uses a volatile journal it lives in /run/log/journal/ instead,
  which would itself explain short retention. Set JOURNAL_DIR= and re-run."
[ -d "$JDIR" ] || die "JOURNAL_DIR '$JDIR' is not a directory."
[ -r "$JDIR" ] || die "cannot read '$JDIR' — wrong container, or permissions."

say "journal directory: $JDIR"

# ── 1. inventory ────────────────────────────────────────────────────────────
hdr "1. inventory"

total=0; count=0; corrupt=0; biggest=""; biggest_sz=0
for f in "$JDIR"/*.journal "$JDIR"/*.journal~; do
  [ -f "$f" ] || continue
  sz=$(wc -c < "$f" 2>/dev/null || echo 0)
  total=$(( total + sz ))
  count=$(( count + 1 ))
  case "$f" in *'.journal~') corrupt=$(( corrupt + 1 )); continue ;; esac
  if [ "$sz" -gt "$biggest_sz" ]; then biggest_sz="$sz"; biggest="$f"; fi
done

[ "$count" -gt 0 ] || die "no journal files in $JDIR — nothing to analyse."

say "files:            $count"
say "total on disk:    $(mb "$total")"
say "largest file:     $(mb "$biggest_sz")  ($(basename "$biggest"))"

if [ "$corrupt" -gt 0 ]; then
  say "corrupt/unclean:  $corrupt file(s) ending in '~'  <-- systemd marks damaged"
  say "                  journals this way. That is a SEPARATE fault from a write"
  say "                  storm and wants 'journalctl --verify' on the host shell."
else
  say "corrupt/unclean:  0  (no '*.journal~' — the files themselves are sound)"
fi

hdr "1b. rotation order (oldest first)"
ls -ltr "$JDIR" 2>/dev/null | tail -n 30 || say "(ls failed — skipping)"

# ── 2. rotation cadence and historical write rate ───────────────────────────
# Derived from rotated-file mtimes. Needs `stat -c`; BusyBox has it, but degrade
# quietly rather than fail if this host does not.
hdr "2. rotation cadence (from rotated-file mtimes)"

if stat -c %Y "$JDIR" >/dev/null 2>&1; then
  oldest=""; newest=""; rot_bytes=0; rot_n=0
  for f in "$JDIR"/system@*.journal; do
    [ -f "$f" ] || continue
    t=$(stat -c %Y "$f") || continue
    s=$(wc -c < "$f")
    rot_bytes=$(( rot_bytes + s )); rot_n=$(( rot_n + 1 ))
    [ -z "$oldest" ] && oldest="$t"
    [ -z "$newest" ] && newest="$t"
    [ "$t" -lt "$oldest" ] && oldest="$t"
    [ "$t" -gt "$newest" ] && newest="$t"
  done

  if [ "$rot_n" -ge 2 ]; then
    span=$(( newest - oldest ))
    say "rotated files:    $rot_n  ($(mb "$rot_bytes"))"
    if [ "$span" -gt 0 ]; then
      say "retention span:   $(( span / 3600 ))h $(( (span % 3600) / 60 ))m"
      say "rotation every:   ~$(( span / (rot_n - 1) / 60 )) min"
      # Multiply BEFORE dividing. `bytes/span` first truncates to whole
      # bytes-per-second and a real storm can come out as "0 MB/hour".
      say "write rate:       ~$(( rot_bytes * 60 / span / 1024 )) KB/min" \
          " (~$(( rot_bytes * 3600 / span / 1048576 )) MB/hour," \
          " ~$(( rot_bytes * 86400 / span / 1048576 )) MB/day)"
      say ""
      say "A healthy home-automation hub keeps WEEKS of journal. If the retention"
      say "span above is measured in hours, the size cap is discarding history"
      say "almost as fast as it is written — that is the storm, and the short boot"
      say "list Supervisor reports is a SYMPTOM of it, not evidence against it."
    fi
  else
    say "fewer than 2 rotated files — cadence cannot be derived. Not necessarily"
    say "healthy: it can also mean the journal was just vacuumed or rotated."
  fi
else
  say "'stat -c' unavailable — read the cadence off the mtimes in section 1b."
fi

# ── 3. live write rate ──────────────────────────────────────────────────────
hdr "3. live write rate (${SAMPLE_SECS}s sample)"

ACTIVE="$JDIR/system.journal"
if [ "$SAMPLE_SECS" -le 0 ]; then
  say "skipped (SAMPLE_SECS=0)"
elif [ ! -f "$ACTIVE" ]; then
  say "no $ACTIVE — cannot sample the active file."
else
  a=$(wc -c < "$ACTIVE")
  say "sampling $(basename "$ACTIVE") for ${SAMPLE_SECS}s ..."
  sleep "$SAMPLE_SECS"
  b=$(wc -c < "$ACTIVE")
  d=$(( b - a ))
  if [ "$d" -lt 0 ]; then
    say "the file ROTATED mid-sample — it shrank from $(mb "$a") to $(mb "$b")."
    say "That alone means a full journal file was filled inside ${SAMPLE_SECS}s."
  else
    say "grew $d bytes in ${SAMPLE_SECS}s"
    say "  = ~$(( d * 60 / SAMPLE_SECS / 1024 )) KB/min"
    say "  = ~$(( d * 3600 / SAMPLE_SECS / 1048576 )) MB/hour"
    say ""
    say "Journal files are preallocated in 8 MB steps, so a quiet minute can read"
    say "as 0 and a step boundary as 8 MB. Trust section 2 over a single sample."
  fi
fi

# ── 4. pick the file to dissect ─────────────────────────────────────────────
# Prefer a ROTATED file: the active one is being appended to while we read it,
# and a rotated file is a complete, closed sample of one storm interval.
hdr "4. content analysis"

if [ -n "${FILE:-}" ]; then
  J="$FILE"
else
  J=""; jsz=0
  for f in "$JDIR"/system@*.journal; do
    [ -f "$f" ] || continue
    s=$(wc -c < "$f")
    if [ "$s" -gt "$jsz" ]; then jsz="$s"; J="$f"; fi
  done
  [ -n "$J" ] || J="$biggest"
fi
[ -f "$J" ] || die "no file to analyse."
[ -r "$J" ] || die "cannot read $J"

JSZ=$(wc -c < "$J")
say "analysing: $J  ($(mb "$JSZ"))"
say "(largest ROTATED file — a closed sample of one storm interval, not the"
say " live one, which is still being appended to as we read.)"

# ── 5. sanity: are the fields readable at all? ──────────────────────────────
# systemd LZ4/zstd-compresses any data object over ~512 bytes. Short values
# (identifiers, container names) stay plaintext; long MESSAGEs may not. If the
# MESSAGE count comes back near zero the rankings below are not wrong, they are
# BLIND, and that must be said out loud rather than reported as "no results".
hdr "5. sanity — are the fields readable?"

# Count OCCURRENCES, not lines. A journal file is binary and contains almost no
# newlines, so `grep -c` returns 1 for a file packed with millions of fields —
# which reads as "nothing is here" and is the exact opposite of the truth.
hits() { grep -ao "$1" "$2" 2>/dev/null | wc -l | tr -d ' '; }

n_msg=$(hits 'MESSAGE=' "$J")
n_con=$(hits 'CONTAINER_NAME=' "$J")
n_sid=$(hits 'SYSLOG_IDENTIFIER=' "$J")

say "occurrences of MESSAGE=            : $n_msg"
say "occurrences of CONTAINER_NAME=     : $n_con"
say "occurrences of SYSLOG_IDENTIFIER=  : $n_sid"

if [ "$n_msg" -lt 10 ] && [ "$n_sid" -lt 10 ]; then
  say ""
  say "NEARLY NOTHING IS READABLE. The journal is compressed (systemd LZ4s data"
  say "objects over ~512 bytes). The rankings below will be empty or misleading."
  say "Fall back to the host shell on port 22222:"
  say "    journalctl --file '$J' --output=short | head -50"
  say "    journalctl --file '$J' -o json | grep -o '\"_COMM\":\"[^\"]*\"' | sort | uniq -c | sort -rn"
  say "Do not read an empty ranking as 'nothing is logging'."
fi

# ── 6. how to read the rankings ─────────────────────────────────────────────
hdr "6. how to read the rankings (READ THIS)"
cat <<'CAVEAT'
systemd stores each DISTINCT field value once and has entries reference it by
hash. So:

  * A count of 1 for `CONTAINER_NAME=addon_foo` does NOT mean one log line. It
    means one distinct value, referenced by any number of entries. Low-cardinality
    fields are therefore USELESS for ranking volume.

  * MESSAGE values are mostly unique (timestamps, ids, counters), so each one is
    stored separately and DOES occupy its own bytes. Grouping them by shape —
    digits and hex normalised away — and ranking by TOTAL BYTES is a sound proxy
    for what is filling the file.

Rank on the bytes column. Use the identifier lists to know WHO exists in this
file, not HOW MUCH each wrote.
CAVEAT

# ── 7. who exists in this file ──────────────────────────────────────────────
hdr "7. who is present (distinct values — NOT volume)"

say "-- containers --"
grep -ao 'CONTAINER_NAME=[A-Za-z0-9_.-]*' "$J" 2>/dev/null \
  | sort -u | sed 's/^CONTAINER_NAME=/  /' | head -n 40 || say "  (none readable)"

say "-- syslog identifiers --"
grep -ao 'SYSLOG_IDENTIFIER=[A-Za-z0-9_.@-]*' "$J" 2>/dev/null \
  | sort -u | sed 's/^SYSLOG_IDENTIFIER=/  /' | head -n 40 || say "  (none readable)"

say "-- systemd units --"
grep -ao '_SYSTEMD_UNIT=[A-Za-z0-9_.@\\-]*' "$J" 2>/dev/null \
  | sort -u | sed 's/^_SYSTEMD_UNIT=/  /' | head -n 40 || say "  (none readable)"

# ── 8. what is actually filling the file ────────────────────────────────────
hdr "8. what is filling the file — top $TOP message shapes by BYTES"
say "(bytes / distinct-variants / shape. This can take a minute on a 24 MB file.)"
say ""

grep -ao 'MESSAGE=[ -~]\{15,160\}' "$J" 2>/dev/null \
  | sed -e 's/^MESSAGE=//' \
        -e 's/[0-9a-fA-F]\{8,\}/<HEX>/g' \
        -e 's/[0-9][0-9]*/N/g' \
  | cut -c1-110 \
  | awk -v fsz="$JSZ" '
      { n[$0]++; b[$0] += length($0) + 1; acc += length($0) + 1 }
      END {
        if (acc == 0) { print "  (no readable MESSAGE values — see section 5)"; exit }
        for (k in n) printf "%10d  %7d  %s\n", b[k], n[k], k
        printf "__ACCOUNTED__ %d %d\n", acc, fsz
      }' \
  | sort -rn > "$RANK" || say "  (extraction failed)"

awk -v top="$TOP" '
    /^__ACCOUNTED__/ { acc = $2; fsz = $3; next }
    shown < top { print; shown++ }
    END {
      if (fsz > 0)
        printf "\naccounted for %d of %d bytes (%d%%) as readable MESSAGE text.\n", acc, fsz, acc * 100 / fsz
      if (fsz > 0 && acc * 100 / fsz < 5)
        print "LOW COVERAGE — most of the file is compressed or non-MESSAGE overhead.\nRank cautiously and confirm on the host with journalctl."
    }' "$RANK"

# ── 8b. the top shapes IN FULL ──────────────────────────────────────────────
# Section 8 truncates at 110 characters so that shapes group. On a real run that
# is exactly where the useful half of the line lives: an nginx error is only
# actionable once you can see `upstream: "http://127.0.0.1:PORT/..."` at the end
# of it. So print untruncated samples of the top few shapes.
hdr "8b. top 3 shapes, untruncated samples"

i=0
while read -r _bytes _count shape; do
  [ -n "${shape:-}" ] || continue
  case "$_bytes" in __ACCOUNTED__) continue ;; esac
  i=$(( i + 1 ))
  [ "$i" -gt 3 ] && break

  # A stable literal to grep the RAW text with. The shape has had digits
  # replaced by N and hex by <HEX>, and neither exists in the raw bytes — so
  # split the shape on those placeholders first and keep the longest surviving
  # run of real text. Splitting on every capital N over-splits a word like
  # "CONTAINER", which only shortens the signature; it can never invent one.
  # e.g. "[error] N#N: *N auth request unexpected status: N"
  #   ->  "auth request unexpected status:"
  sig=$(printf '%s\n' "$shape" \
        | sed -e 's/<HEX>/\n/g' -e 's/N/\n/g' \
        | grep -o '[A-Za-z][A-Za-z ()_:/.-]\{9,\}' \
        | awk '{ if (length($0) > m) { m = length($0); s = $0 } } END { print s }' \
        | sed -e 's/^ *//' -e 's/ *$//')

  say ""
  say "[$i] $shape"
  if [ -z "$sig" ]; then
    say "    (no stable literal to search on — inspect manually)"
    continue
  fi
  say "    matching on: \"$sig\""
  grep -ao 'MESSAGE=[ -~]\{15,400\}' "$J" 2>/dev/null \
    | grep -aF "$sig" | head -n 2 | sed -e 's/^MESSAGE=/    /' || say "    (no sample)"
done < "$RANK"

# ── 9. verdict ──────────────────────────────────────────────────────────────
hdr "9. what to do with this"
cat <<'NEXT'
1. The top shape in section 8 names the source. Confirm it against section 7 —
   a shape that mentions a container should have that container listed there.

2. SILENCE THE SOURCE. That is the repair. Depending on what it is:
     * an add-on in a restart loop  -> fix or stop the add-on, not the journal
     * an add-on logging at debug   -> turn its log level down in its config
     * a kernel/driver message loop -> that is a separate hardware-side fault

3. DO NOT VACUUM FIRST. `journalctl --vacuum-size` frees space and the storm
   refills it within hours, having destroyed the evidence that identifies it.
   A `SystemMaxUse=` cap is worth setting AFTERWARDS as a guard, never as the fix.

4. Only once the writes have stopped is it worth touching gatewayd. It was never
   broken; it was being out-run by journald on the same files.
NEXT

say ""
say "read-only: nothing in the journal directory was written, rotated, vacuumed"
say "or restarted. One scratch file under \$TMPDIR was used and removed."
