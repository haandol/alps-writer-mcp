#!/usr/bin/env bash
# adr-invariants.sh — one deterministic oracle for the PRD → ADR → code
# one-way dependency invariants. The adr-sync / adr-rollup skills run this
# instead of re-typing path-fragile greps, so the regexes have a single
# source of truth. It prints file:line for every hit and exits non-zero on
# any violation, so a consuming repo can wire it into pre-commit / CI as a
# hard gate. The adr-writer plugin itself never blocks — when a skill calls
# it, the result is advisory (the model decides what to fix).
#
# Requirements: bash and a grep that supports -r, -E, --include, and
# --exclude-dir (GNU grep or BSD/macOS grep). busybox grep lacks
# --exclude-dir; on such minimal images (e.g. Alpine CI) install GNU grep
# before wiring this into a hard gate, or the exclude flags fail.
#
# Usage:
#   adr-invariants.sh [--adr-dir DIR] [--code-only|--prd-only|--rollup-only]
#                     [--removed "<cat>/<NNNN> ..."]
#                     [--renumbered "<cat>/<old>:<cat>/<new> ..."]
#
#   --adr-dir DIR     ADR root (default: docs/adr)
#   --code-only       run only check (a): code → ADR reverse references
#   --prd-only        run only check (b): ADR → PRD reverse references
#   --rollup-only     run only check (c)+(d): stale citations after a rollup
#   --removed LIST    space-separated ADR ids/paths a rollup DELETED, e.g.
#                     "auth/0002 auth/0003" — enables check (c) and, like
#                     --rollup-only, disables (a)/(b) so unrelated tree hits
#                     aren't misattributed to the rollup. Citations of these
#                     repoint to the CONSOLIDATED (survivor) ADR.
#   --renumbered LIST space-separated <old>:<new> pairs a rollup RENUMBERED
#                     (same ADR, new number), e.g. "auth/0004:auth/0002
#                     auth/0005:auth/0003" — enables check (d) and disables
#                     (a)/(b) (as --removed does). Citations of the old id
#                     repoint to that ADR's NEW number (not the consolidated
#                     one). Kept separate from --removed so the two repoint
#                     directions never get confused.
#
# Exit: 0 = clean, 1 = at least one violation found, 2 = usage error.

set -uo pipefail

ADR_DIR="docs/adr"
RUN_CODE=1
RUN_PRD=1
RUN_ROLLUP=0
REMOVED=""
RENUMBERED=""

# require a non-empty value for a flag that takes one; exit 2 (usage) otherwise.
# Guards against both an empty value (--adr-dir "") — which would degrade the
# check (a) regex to /[A-Za-z0-9_-]+ and flag arbitrary slash paths — and a
# missing one (--adr-dir as the last token), where a bare `shift 2` is a no-op
# (rc=1, $1 unchanged) and would spin the parse loop forever.
need_val() { # $1=flag  $2=candidate value  $3=remaining arg count ($#)
  if [ "$3" -lt 2 ] || [ -z "$2" ]; then
    echo "adr-invariants: $1 requires a non-empty value" >&2
    exit 2
  fi
}

while [ $# -gt 0 ]; do
  case "$1" in
    --adr-dir) need_val "$1" "${2:-}" "$#"; ADR_DIR="$2"; shift 2 ;;
    --code-only) RUN_CODE=1; RUN_PRD=0; RUN_ROLLUP=0; shift ;;
    --prd-only) RUN_CODE=0; RUN_PRD=1; RUN_ROLLUP=0; shift ;;
    --rollup-only) RUN_CODE=0; RUN_PRD=0; RUN_ROLLUP=1; shift ;;
    # --removed / --renumbered narrow the run to the rollup checks (c)/(d).
    # Reset RUN_CODE/RUN_PRD so a caller that forgets --rollup-only doesn't
    # also re-scan the whole tree for (a)/(b) and misattribute unrelated hits
    # to the rollup.
    --removed) need_val "$1" "${2:-}" "$#"; REMOVED="$2"; RUN_CODE=0; RUN_PRD=0; RUN_ROLLUP=1; shift 2 ;;
    --renumbered) need_val "$1" "${2:-}" "$#"; RENUMBERED="$2"; RUN_CODE=0; RUN_PRD=0; RUN_ROLLUP=1; shift 2 ;;
    -h|--help)
      sed -n '2,30p' "$0" | sed 's/^# \{0,1\}//'
      exit 0 ;;
    *) echo "adr-invariants: unknown arg '$1'" >&2; exit 2 ;;
  esac
done

# Strip a trailing slash so ${ADR_DIR}/ interpolations below never become a
# double slash (docs/adr/ -> docs/adr//[A-Za-z0-9_-]+ would miss real single-
# slash paths and silently pass the check).
ADR_DIR="${ADR_DIR%/}"

found=0

# Common excludes for whole-tree scans. grep --exclude-dir matches a
# directory BASENAME glob, never a path — so we must NOT exclude the ADR dir
# by its basename here: a basename like "adr" would also prune unrelated code
# dirs (src/adr/, lib/adr/) and their genuine code→ADR violations would never
# reach the post-filter (which can only drop lines grep already emitted).
# ADR↔ADR Related links inside "$ADR_DIR" are instead excluded purely by the
# full-path post-filter "(^|/)${ADR_DIR}/" applied to each check below.
EXCLUDES=(
  --exclude-dir=.git
  --exclude-dir=node_modules
  --exclude-dir=dist
  --exclude-dir=build
  --exclude-dir=vendor
)

# (a) code → ADR reverse references: no ADR ID / path / ADR_REF in code or
# non-ADR docs. Layout-agnostic: scans the whole tree minus excludes rather
# than a hardcoded packages/apps/src list. The post-filter drops any hit
# still under "$ADR_DIR/" so legitimate ADR↔ADR links are not flagged, while
# code dirs that merely share the ADR basename (src/adr/, lib/adr/) are still
# scanned — they are never pruned up front.
if [ "$RUN_CODE" -eq 1 ]; then
  hits="$(grep -rnE "ADR [A-Za-z0-9_-]+/[0-9]{4}|${ADR_DIR}/[A-Za-z0-9_-]+|ADR_REF" \
    "${EXCLUDES[@]}" . 2>/dev/null | grep -vE "(^|/)${ADR_DIR}/")" || true
  if [ -n "$hits" ]; then
    echo "✗ (a) code → ADR reverse references (remove from code; link lives in .mapping.json):"
    printf '%s\n' "$hits"
    found=1
  fi
fi

# (b) ADR → PRD reverse references: numbered ADR bodies must not cite ALPS
# paths / Section numbers / feature-ids. Seeded rule docs (README,
# structure, authoring-rules) legitimately mention ALPS, so scope to
# NNNN-*.md only.
if [ "$RUN_PRD" -eq 1 ]; then
  hits="$(grep -rnE "\.alps\.xml|ALPS Section|Section [0-9]+\.[0-9]|F-[A-Z]+-[0-9]" \
    --include='[0-9][0-9][0-9][0-9]-*.md' -- "$ADR_DIR" 2>/dev/null)" || true
  if [ -n "$hits" ]; then
    echo "✗ (b) ADR → PRD reverse references (remove from ADR body; link lives in .mapping.json alpsFeatureId):"
    printf '%s\n' "$hits"
    found=1
  fi
fi

# (c) stale citations of ADRs a rollup DELETED. Only runs when --removed is
# given. Each token is an ADR id (cat/NNNN) or path fragment. These citations
# repoint to the CONSOLIDATED (survivor) ADR — the decision lives there now.
# The "${pat}(-...)?\.md" branch catches the kebab-title link forms this
# plugin actually emits — README index entries and ADR Related links point at
# "<cat>/NNNN-kebab-title.md" via relative "./"/"../" paths, so matching only
# "<cat>/NNNN.md" (dot right after the number) would miss every real link.
if [ "$RUN_ROLLUP" -eq 1 ] && [ -n "$REMOVED" ]; then
  for ref in $REMOVED; do
    pat="$(printf '%s' "$ref" | sed 's/[].[\*^$/(){}+?|]/\\&/g')"
    hits="$(grep -rnE "ADR ${pat}|${ADR_DIR}/${pat}|${pat}(-[A-Za-z0-9-]*)?\.md" \
      --exclude-dir=.git --exclude-dir=node_modules . 2>/dev/null)" || true
    if [ -n "$hits" ]; then
      echo "✗ (c) stale citation of removed ADR '${ref}' (repoint to the consolidated ADR):"
      printf '%s\n' "$hits"
      found=1
    fi
  done
fi

# (d) stale citations of ADRs a rollup RENUMBERED. Only runs when --renumbered
# is given. Each token is an "<old>:<new>" pair — the SAME ADR moved to a new
# number. These citations repoint to the ADR's NEW number, NOT the consolidated
# one (the decision did not move into another ADR; only its number changed).
# Kept distinct from (c) so the repoint direction is never ambiguous in output.
if [ "$RUN_ROLLUP" -eq 1 ] && [ -n "$RENUMBERED" ]; then
  for pair in $RENUMBERED; do
    old="${pair%%:*}"
    new="${pair#*:}"
    if [ "$old" = "$pair" ] || [ -z "$new" ]; then
      # A malformed pair is a usage error, not a repo violation — exit 2 so a
      # pre-commit/CI gate wired on exit 1 doesn't treat a typo as a real
      # stale citation (and vice versa). Header documents 2 = usage error.
      echo "adr-invariants: --renumbered expects '<old>:<new>' pairs, got '$pair'" >&2
      exit 2
    fi
    pat="$(printf '%s' "$old" | sed 's/[].[\*^$/(){}+?|]/\\&/g')"
    hits="$(grep -rnE "ADR ${pat}|${ADR_DIR}/${pat}|${pat}(-[A-Za-z0-9-]*)?\.md" \
      --exclude-dir=.git --exclude-dir=node_modules . 2>/dev/null)" || true
    if [ -n "$hits" ]; then
      echo "✗ (d) stale citation of renumbered ADR '${old}' (repoint to its new number '${new}'):"
      printf '%s\n' "$hits"
      found=1
    fi
  done
fi

if [ "$found" -eq 0 ]; then
  echo "✓ ADR one-way invariants clean"
fi
exit "$found"
