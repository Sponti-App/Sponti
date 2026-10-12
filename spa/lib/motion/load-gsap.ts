// GSAP and its DrawSVG plugin, loaded with a dynamic import() only when a
// flare moment is about to play (#375), so neither ever joins a route's
// first-load JavaScript. GSAP 3.15 is under GreenSock's standard "no charge"
// licence, free for commercial use, plugins included.

export type Gsap = typeof import("gsap").gsap

let loading: Promise<Gsap> | null = null

export function loadGsap(): Promise<Gsap> {
  loading ??= Promise.all([import("gsap"), import("gsap/DrawSVGPlugin")])
    .then(([core, draw]) => {
      core.gsap.registerPlugin(draw.DrawSVGPlugin)
      return core.gsap
    })
    .catch((error: unknown) => {
      // A failed chunk load can be retried on the next moment.
      loading = null
      throw error
    })
  return loading
}

/** Starts the download early (e.g. when the composer opens). Never throws. */
export function preloadGsap(): void {
  void loadGsap().catch(() => {})
}
