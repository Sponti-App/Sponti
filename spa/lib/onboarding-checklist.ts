import {
  deriveStatus,
  type HostedEvent,
  type MyFlaresResult,
} from "@/lib/api/events"

// #459 (behind `introV2`): after sign-up, a checklist in the home map's sheet
// takes over from the first-run intro (#313). Two rows, ticked off from real
// data: "light your first flare" (the account has hosted a flare) and "add
// your first friend" (it has at least one accepted connection).
//
// It shows while the first-run intro would (`onboarding.ts`: a new account
// on this device, once per device), so it reuses that storage: hiding it, or
// finishing both rows, marks onboarding done.
//
// This file holds the pure state logic. The component is
// components/onboarding-checklist.tsx.

/** The flare that ticks the first row: the one the hint names. */
export type HostedFlareFact = { title: string; live: boolean }

/** What the checklist knows. `undefined` while it is still loading. */
export type ChecklistFacts = {
  /** Display names of the accepted connections. */
  friendNames: string[] | undefined
  /** The account's flare, `null` when it has never lit one. */
  hostedFlare: HostedFlareFact | null | undefined
  /** The nearest idea spot's title, for the open flare row's hint. */
  ideaTitle: string | null
}

export type ChecklistRow = {
  done: boolean
  /** The row the button acts on. */
  current: boolean
  hint: string
}

export type ChecklistView =
  | { kind: "loading" }
  /** Both rows ticked: "you're set". */
  | { kind: "done"; friendCount: number }
  | { kind: "open"; flare: ChecklistRow; friend: ChecklistRow }

/**
 * The flare that counts as "lit" for the checklist: a live one first, then
 * any other the account hosts (upcoming, or cancelled after lighting it),
 * then one that ended in the last two weeks (`pastHosted`, the api's window).
 */
export function pickHostedFlare(
  flares: Pick<MyFlaresResult, "hostedByMe" | "pastHosted">,
  now: number = Date.now()
): HostedFlareFact | null {
  const live = flares.hostedByMe.find((e) => deriveStatus(e, now) === "live")
  const any: HostedEvent | undefined =
    live ?? flares.hostedByMe[0] ?? flares.pastHosted[0]
  if (!any) return null
  return { title: any.title, live: live !== undefined }
}

/** "mia's here", "mia and sam are here", "mia, sam and 3 more are here". */
export function friendsHereLabel(names: string[]): string {
  if (names.length === 0) return ""
  if (names.length === 1) return `${names[0]}'s here`
  if (names.length === 2) return `${names[0]} and ${names[1]} are here`
  if (names.length === 3)
    return `${names[0]}, ${names[1]} and ${names[2]} are here`
  return `${names[0]}, ${names[1]} and ${names.length - 2} more are here`
}

export function checklistView(facts: ChecklistFacts): ChecklistView {
  const { friendNames, hostedFlare, ideaTitle } = facts
  if (friendNames === undefined || hostedFlare === undefined) {
    return { kind: "loading" }
  }
  const lit = hostedFlare !== null
  const friendDone = friendNames.length > 0
  if (lit && friendDone)
    return { kind: "done", friendCount: friendNames.length }

  return {
    kind: "open",
    flare: {
      done: lit,
      // The button follows the friend count: it only lights a flare once
      // there is someone to see it.
      current: !lit && friendDone,
      hint: hostedFlare
        ? hostedFlare.live
          ? `${hostedFlare.title} is live`
          : `you lit ${hostedFlare.title}`
        : ideaTitle
          ? `idea nearby: ${ideaTitle}`
          : "right now, or at a time you pick",
    },
    friend: {
      done: friendDone,
      current: !friendDone,
      hint: friendDone
        ? friendsHereLabel(friendNames)
        : lit
          ? "flares only go to friends, and you have none here yet"
          : "flares only go to friends",
    },
  }
}

/**
 * #124 before #389's kept draft is lit: an account with no friends adds its
 * first friend first, since a flare only reaches friends. An unknown count
 * (the fetch failed) counts as none, as in the first-run intro.
 */
export function needsFirstFriendFirst(friendCount: number | null): boolean {
  return !friendCount
}

// The first-friend step can add a friend while the checklist sits under it.
// It says so here, and the checklist reloads its friends.
const friendsChangedListeners = new Set<() => void>()

export function emitFriendsChanged(): void {
  for (const listener of friendsChangedListeners) listener()
}

export function subscribeToFriendsChanged(listener: () => void): () => void {
  friendsChangedListeners.add(listener)
  return () => {
    friendsChangedListeners.delete(listener)
  }
}
