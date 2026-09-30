// #295: whether the visitor has moved between pages inside the app since this
// document loaded. `history.length` can't tell us — it counts entries from
// other sites too — so a root-level tracker records the first in-app route
// change, and back controls use it to choose between `router.back()` (there
// is somewhere in the app to go back to) and a fixed fallback (the page was
// opened directly, e.g. from a shared link or a cold load).

let hasNavigated = false

/** Called by the tracker when the pathname changes after the first render. */
export function markInAppNavigation(): void {
  hasNavigated = true
}

export function hasInAppHistory(): boolean {
  return hasNavigated
}

/** Test seam: forget any recorded navigation. */
export function resetInAppHistory(): void {
  hasNavigated = false
}
