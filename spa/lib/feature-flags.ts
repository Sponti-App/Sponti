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

  // #482: `browseBeforeSignup`, `introV2` and `locationAsk` below are the new
  // onboarding. A device can switch them all on at runtime ("new onboarding" in
  // settings), whatever the build profile. Read them through
  // `useOnboardingFlags` / `getOnboardingFlags` (lib/onboarding-flags.ts), never
  // off `featureFlags` directly, or that switch won't reach the reader.

  /**
   * Browse before sign-up (#389, flare moments #370): a signed-out visitor
   * lands on the home map instead of /login. They see the idea spots and the
   * open-to-all pins from the public map endpoint (#425), and lighting a
   * flare, tapping a pin or an account-only nav tab asks them to sign up in a
   * sheet that keeps their draft. On in both profiles.
   */
  browseBeforeSignup: true,

  /**
   * The intro slides (#377, flare moments #370): three slides (what sponti
   * is, why it exists, how lighting a flare works) on a signed-out visitor's
   * first open of the home map, once per device. They sit on #389's
   * signed-out home, so they need `browseBeforeSignup` too. It also swaps
   * the post-sign-up first-run intro (#313) for a checklist in the map's
   * sheet (#459), and has a 0-friend account add its first friend before a
   * kept draft is lit. Off, the first-run intro is unchanged. On in both profiles.
   */
  introV2: true,

  /**
   * The location ask (#408, flare moments #370): instead of the browser's
   * prompt on mount, the map's sheet asks "where should the map start?" with
   * "use my location" (the prompt comes only after that tap) or the berlin
   * area chips. Denied or blocked turns it into "pick an area to start", with
   * a place search. The choice is remembered per device. It covers signed-out
   * visitors (after the intro slides) and signed-in users who haven't
   * decided. Off, the map asks the browser on mount as
   * before and the signed-out map stays on berlin. On in both
   * profiles.
   */
  locationAsk: true,

  /**
   * Coach marks (#379, flare moments #370): three marks on the signed-out
   * map, once per device, after the intro slides and before the location
   * ask: the idea spot ("ideas nearby"), the flare button ("light a flare")
   * and the map/calendar toggle ("soon lives here"). Each has "n of 3", skip
   * and next; there is no replay. They sit on #389's signed-out home, so they
   * need `browseBeforeSignup` too. On in both profiles; off, nothing shows and
   * the location ask doesn't wait.
   */
  coachMarks: true,

  /**
   * The mobile-only gate (#467): on a desktop-sized screen without touch,
   * a calm "sponti is made for your phone" notice with a QR code to open the
   * page on a phone, and "continue anyway" (remembered per device). It is for
   * the testers, so it is on in BOTH profiles. The opt-out is for local
   * desktop development: set NEXT_PUBLIC_MOBILE_GATE=off. Anything else,
   * including unset, leaves it on. Whether the notice warns or blocks is
   * `MOBILE_GATE_MODE` in lib/mobile-gate.ts.
   */
  mobileGate: process.env.NEXT_PUBLIC_MOBILE_GATE !== "off",
} as const
