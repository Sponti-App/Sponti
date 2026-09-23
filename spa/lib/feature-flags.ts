// Compile-time feature flags. NEXT_PUBLIC_* values are inlined at build time,
// so each flag must read its env var by its literal name.
//
// #93 grows this into the "tester build" vs "full app" profile that gates
// unfinished surfaces. Until then it only holds the demo-data switch.

export const featureFlags = {
  /**
   * Serve the bundled demo events on the map and calendar instead of calling
   * the api. Off by default so real builds never show made-up flares; set
   * NEXT_PUBLIC_SEED_DEMO_DATA=true for an offline design/demo build.
   */
  seedDemoData: process.env.NEXT_PUBLIC_SEED_DEMO_DATA === "true",
} as const
