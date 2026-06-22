#!/usr/bin/env bash
# One-time bootstrap for GitHub Issues-based planning on Sponti.
# Prereq:  gh auth login   (needs repo scope; add `--scopes project` if you'll
#          also create the Project board from the CLI).
# Safe to re-run: labels use --force; milestones/issues are skipped if present.
set -uo pipefail

note() { printf '\n\033[1m• %s\033[0m\n' "$1"; }

# ── Labels ──────────────────────────────────────────────────────────────────
note "Labels"
label() { gh label create "$1" --color "$2" --description "$3" --force >/dev/null && echo "  $1"; }

# triage vocabulary (matches docs/agents/triage-labels.md)
label "needs-triage"    "ededed" "Maintainer needs to evaluate this issue"
label "needs-info"      "d4c5f9" "Waiting on reporter for more information"
label "ready-for-agent" "0e8a16" "Fully specified, an AFK agent can pick it up"
label "ready-for-human" "1d76db" "Requires human implementation"
label "wontfix"         "ffffff" "Will not be actioned"
# type
label "feature" "a2eeef" "New feature or enhancement"
label "bug"     "d73a4a" "Something is broken or half-wired"
label "chore"   "fef2c0" "Maintenance / wiring / config"
# area
label "spa"         "c5def5" "Frontend (Next.js / Capacitor)"
label "api"         "bfd4f2" "Core business API"
label "auth-server" "bfdadc" "Authentication service"
# state
label "blocked" "b60205" "Blocked by another issue or a prerequisite"

# ── Milestones ──────────────────────────────────────────────────────────────
note "Milestones"
milestone() {
  if gh api "repos/{owner}/{repo}/milestones" --jq '.[].title' | grep -qxF "$1"; then
    echo "  (exists) $1"
  else
    gh api "repos/{owner}/{repo}/milestones" -f title="$1" -f description="$2" >/dev/null && echo "  $1"
  fi
}
milestone "M1 — Tester build"          "Shareable cut for 5-10 friends. Phase 0: understand + fix. Phase 1: gate fluff behind feature-flags.ts."
milestone "M2 — Native distribution"   "TestFlight + Play internal testing. Store-prep."
milestone "M3 — Push notifications"    "Device push (APNs/FCM). Native-only, its own milestone."

M1="M1 — Tester build"

# ── Seed issues ───────────────────────────────────────────────────────────────
note "Issues"
mkissue() { # title  body  labels  milestone
  if gh issue list --search "$1 in:title" --state all --json title --jq '.[].title' | grep -qxF "$1"; then
    echo "  (exists) $1"
  else
    gh issue create --title "$1" --body "$2" --label "$3" --milestone "$4" >/dev/null && echo "  + $1"
  fi
}

mkissue "Shared codebase understanding pass" \
"Before Phase 0 changes, the team walks the codebase so changes are read-the-slice-first, not blind.

- Components & layers (see the /teach lessons), the core loop (create → see → join), and \`lib/api\` → backend wiring.
- Outcome: each Phase 0 issue's \"files likely touched\" can be reviewed with confidence.

Context: CLAUDE.md \"Understand before you change\" principle; CONTEXT-MAP.md + per-package CONTEXT.md." \
"chore,ready-for-human" "$M1"

mkissue "Enforce profile privacy (discovery-only) in user search" \
"\`profileVisibility\` is stored but **not enforced**: \`api/src/services/userDirectoryService.ts\` projects it but never filters on it, so a \`private\` user still appears in search.

Acceptance:
- [ ] User search excludes \`private\` users.
- [ ] Private users remain viewable by accepted connections and via direct link/username (discovery-only contract).

Context: api/CONTEXT.md (\"profile visibility\"); a privacy toggle that doesn't hide you undermines the privacy differentiator." \
"bug,api,ready-for-agent" "$M1"

mkissue "Align circles/users DB ownership across api and auth-server" \
"Per docs/decisions/circles-and-users-are-api-owned.md. \`auth-server\` seeds default circles at registration and connects with no \`dbName\`; \`api\` uses \`dbName: env.DB_NAME\`. If they diverge, a new user's default circles land where \`api\` never reads them.

Acceptance:
- [ ] Minimum bar: \`MONGO_URI\` + \`DB_NAME\` aligned across \`api/\` and \`auth-server/\` (documented in env templates).
- [ ] Decide + record follow-up: move default-circle seeding out of auth-server (api seeds, or event-driven).

Context: docs/decisions/circles-and-users-are-api-owned.md." \
"bug,api,auth-server,ready-for-human" "$M1"

mkissue "Surface attendee ETAs to the host" \
"\`memberWillArriveAt\` is collected at join and stored on \`EventMember\` but is **write-only** — the host never sees it.

Acceptance:
- [ ] Show each going attendee's ETA in the host view (\`event-detail-sheet\` \"who's going\" + \`/event/[id]\`).
- [ ] Include the ETA in \`createEventRsvpChangeNotification\` (not passed today).
- [ ] Fire a notification/update when a *going* member changes only their ETA (today silent — keys off \`rsvpStatusChanged\`).
- [ ] Null out \`memberWillArriveAt\` on \`declined\` so a stale time doesn't linger.

Context: CLAUDE.md M1 🚩; signature differentiator, currently half-wired." \
"feature,spa,api,ready-for-agent" "$M1"

mkissue "Wire stubbed settings to existing backends" \
"\`spa/app/settings/page.tsx\` has TODOs where backends already exist.

Acceptance:
- [ ] \`profileVisibility\` toggle calls \`PATCH /auth/me/profile\` (backend already accepts it).
- [ ] Notification preferences call \`GET/PATCH /notification-settings/me\`.
- [ ] Change-password: verify backend exists; wire it or hide it behind \"coming soon\".

Context: CLAUDE.md M1 Phase 0." \
"chore,spa,ready-for-agent" "$M1"

mkissue "Decouple demo data from API_BASE; add empty states + seedDemoData flag" \
"Today \`use-events.ts\` serves mock data only when \`NEXT_PUBLIC_API_BASE_URL\` is unset, so a real tester build shows an empty map with no demo content and no good empty state.

Acceptance:
- [ ] Demo seed gated behind a \`seedDemoData\` flag (off by default), independent of \`API_BASE\`.
- [ ] Real empty states for map, calendar, circles (\"no flares nearby yet — light one 🔥\").

Context: CLAUDE.md \"Real data, not fake\" principle." \
"chore,spa,ready-for-agent" "$M1"

mkissue "Introduce feature-flags.ts and gate unfinished surfaces (Phase 1)" \
"**Blocked** until the Phase 0 understanding pass + bug fixes land. Not needed for the internal team round.

Introduce \`spa/lib/feature-flags.ts\` (one typed compile-time profile) and gate, as **small one-flag-per-PR render-site guards** (no code extraction):
- +1 / guest invites (backend done, no redemption UX)
- re-share / \`allowForward\` (frontend-only, unpersisted)
- social handles (localStorage-only)
- \`socialBattery\` (unrendered)

Keep custom circles — fully wired. Do this just before the external-tester handoff.

Context: CLAUDE.md M1 Phase 1." \
"feature,spa,blocked,needs-triage" "$M1"

note "Done. View: gh issue list --milestone \"$M1\""
