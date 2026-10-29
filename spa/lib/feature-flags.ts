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

  /**
   * The live/soon/all tabs in the map's sheet and list, signed in and signed
   * out. Off in both profiles: with the view toggle named "now" (the map) and
   * "soon" (the calendar), a second live/soon split on the map confused
   * testers. Off, the map shows every flare that hasn't ended ("all").
   */
  timeTabs: false,

  /**
   * The quiet home (#522): when the map has no flares, its sheet shows the
   * people you recently connected with (#561: compact, after a fresh
   * sign-in), an invite for a 0-friend account, two flare cards (#562, right
   * now and soon), and for a signed-out visitor the value prop and nearby
   * idea cards; the type chips wait until there are two flares.
   * On in both profiles; off, the old "no flares within 10 km" card.
   */
  quietHome: true,

  /**
   * The lighting moment (#376, flare moments #370; motion in lib/motion,
   * #375): the composer lights a flare with the strike strip, which the nav's
   * flare button morphs into, and the strike starts the full-screen "night
   * flare" takeover, which lands the flare on the map once the api has
   * created it (the full burst for someone's first flare, the soft one
   * after). See docs/decisions/flare-lighting-motion.md. On in the full profile, off in
   * the tester build (production) until it passes review, but on in the
   * `dev` branch's Vercel deploy so it can be tried on a phone; off, the
   * composer's "light a flare" button and success toast are exactly as before.
   */
  flareLightMoment:
    FEATURE_PROFILE === "full" ||
    process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_REF === "dev",

  /**
   * The filter menu on the my flares page (#582): date / latest / going /
   * private. Its options aren't wired to the list yet (the menu says "sorting
   * hookup pending"), so picking one does nothing. Hidden in the tester build
   * until the sorting is built; the header keeps a spacer so the title stays
   * centred. On in the full profile.
   */
  myFlaresFilter: FEATURE_PROFILE === "full",

  // #482: `browseBeforeSignup`, `introV2` and `locationAsk` below are the new
  // onboarding. A device can switch them all on at runtime ("new onboarding" in
  // settings), whatever the build profile. Read them through
  // `useOnboardingFlags` / `getOnboardingFlags` (lib/onboarding-flags.ts), never
  // off `featureFlags` directly, or that switch won't reach the reader. ESLint
  // enforces it (`no-restricted-syntax` in eslint.config.mjs, #484).

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

  /**
   * Floating ideas (#515): a few place-less ideas ("have some friends over",
   * "a picnic blanket and nothing else") drawn as idea pins around the
   * person's own position, on the signed-in and the signed-out map, so a
   * quiet map still has something to tap. They follow the "show ideas on the
   * map" setting. On in BOTH profiles, because a first visit with an empty
   * map is what testers hit. The opt-out is a kill switch: set
   * NEXT_PUBLIC_FLOATING_IDEAS=off. Anything else, including unset, leaves
   * it on.
   */
  floatingIdeas: process.env.NEXT_PUBLIC_FLOATING_IDEAS !== "off",

  /**
   * A flare's own invite link (#616): the host's "invite" button on the flare
   * (the phone's share sheet, or "link copied"), "reset link" on the edit
   * page, and the `/f/<token>` page a guest opens: host and flare for someone
   * signed out, then "i'm in" through sign-up. Off, nothing links to or
   * offers it (the api's endpoints stay; the page shows "link unavailable").
   * On in BOTH profiles, because testers need to send flares to friends who
   * are not on sponti yet. The opt-out is a kill switch: set
   * NEXT_PUBLIC_FLARE_INVITE_LINK=off. Anything else, including unset, leaves
   * it on.
   */
  flareInviteLink: process.env.NEXT_PUBLIC_FLARE_INVITE_LINK !== "off",

  /**
   * One flare detail (#615, prototype #617): a drawer over the home map at
   * three heights (peek, half, and full with a strip of map left on top),
   * with the map centred on the flare above it and moved with one finger.
   * `/event/<id>` and `/?flare=<id>` open the drawer; "directions" is a row
   * that offers the in-app route or google maps. Off, the map sheet and the
   * flare page are exactly as before. On in BOTH profiles since it passed a
   * phone test (2026-10-20). The opt-out is a kill switch: set
   * NEXT_PUBLIC_FLARE_DRAWER=off. Anything else, including unset, leaves it on.
   */
  flareDrawer: process.env.NEXT_PUBLIC_FLARE_DRAWER !== "off",
} as const
