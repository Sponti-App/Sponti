const HOME_TOUR_PENDING_KEY = "sponti.home-tour.pending.v1"
const HOME_TOUR_COMPLETED_PREFIX = "sponti.home-tour.completed"
const ONBOARDING_SEEN_KEY = "sponti.onboarding.seen.v1"

function completedKey(userId: string): string {
  return `${HOME_TOUR_COMPLETED_PREFIX}.${userId}.v1`
}

export function markHomeTourPending(): void {
  if (typeof window === "undefined") return
  window.localStorage.setItem(HOME_TOUR_PENDING_KEY, "1")
}

export function markOnboardingSeen(): void {
  if (typeof window === "undefined") return
  window.localStorage.setItem(ONBOARDING_SEEN_KEY, "1")
}

export function hasSeenOnboarding(): boolean {
  if (typeof window === "undefined") return false
  return window.localStorage.getItem(ONBOARDING_SEEN_KEY) === "1"
}

export function shouldShowHomeTour(userId: string): boolean {
  if (typeof window === "undefined") return false
  return (
    window.localStorage.getItem(HOME_TOUR_PENDING_KEY) === "1" &&
    window.localStorage.getItem(completedKey(userId)) !== "1"
  )
}

export function completeHomeTour(userId: string): void {
  if (typeof window === "undefined") return
  window.localStorage.setItem(completedKey(userId), "1")
  window.localStorage.removeItem(HOME_TOUR_PENDING_KEY)
}
