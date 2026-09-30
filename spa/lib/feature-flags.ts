// Compile-time feature flags. NEXT_PUBLIC_* values are inlined at build time,
// so each flag must read its env var by its literal name.
//
// #93: one typed, compile-time profile that flips between the "tester build"
// (default — what we hand to external testers) and the "full app" (every
// surface on). Unfinished/fluff surfaces are gated per-flag off this profile,
// one flag per PR (see CLAUDE.md's Milestone 1 Phase 1). Nothing behind a
// flag is removed from the tree — these are render-site guards only.

export type FeatureProfile = "tester" | "full"

// NEXT_PUBLIC_FEATURE_PROFILE selects the profile; anything other than
// "full" (including unset) is the tester build, so a misconfigured env
// fails closed rather than exposing half-wired surfaces.
const FEATURE_PROFILE: FeatureProfile =
  process.env.NEXT_PUBLIC_FEATURE_PROFILE === "full" ? "full" : "tester"

export const featureFlags = {
  /**
   * Serve the bundled demo events on the map and calendar instead of calling
   * the api. Off by default so real builds never show made-up flares; set
   * NEXT_PUBLIC_SEED_DEMO_DATA=true for an offline design/demo build.
   *
   * Independent of FEATURE_PROFILE — a demo build can run in either profile.
   */
  seedDemoData: process.env.NEXT_PUBLIC_SEED_DEMO_DATA === "true",

  /**
   * Re-share: letting an invitee widen the audience of someone else's
   * private flare (`allowGuestInvites: "multiple"`, the drawer's "can
   * re-share" toggle). Hidden in the tester build per #159 — the privacy
   * questions (one hop or chains, host visibility, per-guest revocation,
   * the host↔candidate block check) aren't answered yet.
   */
  reshare: FEATURE_PROFILE === "full",

  /**
   * +1: letting a guest bring someone (`allowGuestInvites: "single"`, the
   * drawer's "+1 allowed" toggle). Hidden in the tester build per #159 —
   * nothing redeems a +1 yet: `canInviteGuests` is written to every invitee's
   * member row but never checked, and no `plusOne` field exists on
   * `EventMember`, so the toggle would promise guests something they never
   * see. Built after launch; with this and `reshare` both off,
   * `guestInviteModeFromDraft` always yields `"none"`.
   */
  plusOne: FEATURE_PROFILE === "full",
} as const
