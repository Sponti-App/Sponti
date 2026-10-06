"use client"

// #459 (behind `introV2`): the post-sign-up checklist in the home map's
// sheet, in place of the first-run intro (#313). Two rows, "light your first
// flare" and "add your first friend", ticked off from real data. Its button
// is the intro's friend-count call to action: no friends yet → add your
// first friend (the QR and the 7-day invite link, #124); otherwise → light
// your first flare. It follows the #373 prototype's "after" step (round 2,
// checklist B).
//
// The button is ink, not peach: the nav's flare button right below is
// already the screen's peach call to action (BRAND.md: one at a time).
//
// It shows while the first-run intro would have (a new account on this
// device), and uses the same storage: hiding it, or finishing both rows,
// marks onboarding done for this device. The state logic lives in
// lib/onboarding-checklist.ts.

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { CheckIcon, FlameIcon, QrCodeIcon, XIcon } from "@/components/icons"
import { useAuth } from "@/components/auth-provider"
import {
  firstFlarePrefill,
  pickFirstRunCta,
} from "@/components/first-run-intro"
import { useNewEventDrawer } from "@/components/new-event-drawer-provider"
import { QrShareSheet } from "@/components/qr-share-sheet"
import { Button } from "@/components/ui/button"
import { fetchAcceptedConnections } from "@/lib/api/connections"
import { fetchMyFlares } from "@/lib/api/events"
import { readLastKnownCoords } from "@/lib/geolocation"
import { haptic } from "@/lib/haptics"
import { useIdeasHidden } from "@/lib/idea-preferences"
import {
  checklistView,
  emitFriendsChanged,
  pickHostedFlare,
  subscribeToFriendsChanged,
  type ChecklistRow as ChecklistRowView,
  type ChecklistView,
  type HostedFlareFact,
} from "@/lib/onboarding-checklist"
import { completeOnboarding, useShowOnboarding } from "@/lib/onboarding"
import { subscribeToEventsChanged } from "@/lib/use-events"
import { useRefetchOnFocus } from "@/lib/use-refetch-on-focus"
import { cn } from "@/lib/utils"

/** Its own label: the intro slides (#377) are "welcome to sponti". */
export const CHECKLIST_LABEL = "get going"

// ---- the dock card ---------------------------------------------------------

function Row({
  n,
  title,
  row,
}: {
  n: number
  title: string
  row: ChecklistRowView
}) {
  return (
    <li
      className="flex items-start gap-3 py-2"
      data-checklist-row={n === 1 ? "flare" : "friend"}
      data-done={row.done}
    >
      <span
        aria-hidden="true"
        className={cn(
          "flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
          row.done
            ? "bg-foreground text-background"
            : row.current
              ? "border-2 border-foreground"
              : "border border-border text-muted-foreground"
        )}
      >
        {row.done ? <CheckIcon className="size-3.5" weight="bold" /> : n}
      </span>
      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "text-sm",
            row.done ? "text-muted-foreground line-through" : "font-medium"
          )}
        >
          {title}
          {row.done && <span className="sr-only"> (done)</span>}
        </p>
        <p className="text-xs text-muted-foreground">{row.hint}</p>
      </div>
    </li>
  )
}

/** The checklist as the map dock shows it. Presentational. */
export function OnboardingChecklist({
  view,
  onAddFriend,
  onLight,
  onHide,
}: {
  view: Exclude<ChecklistView, { kind: "loading" }>
  onAddFriend: () => void
  onLight: () => void
  onHide: () => void
}) {
  const done = view.kind === "done"
  const cta = done ? null : pickFirstRunCta(view.friend.done ? 1 : 0)
  return (
    <section
      aria-label={CHECKLIST_LABEL}
      data-onboarding-checklist={done ? "done" : "open"}
      className="pointer-events-auto mx-3 rounded-2xl border border-border bg-card p-4 pt-3 shadow-(--shadow-card)"
    >
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-base font-semibold">
          {done ? "you're set" : "two things to get going"}
        </h2>
        <button
          type="button"
          aria-label="hide"
          onClick={() => {
            haptic("light")
            onHide()
          }}
          className="-mr-2 flex size-9 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
        >
          <XIcon className="size-4" />
        </button>
      </div>
      {done ? (
        <p className="mt-1 text-sm text-muted-foreground">
          {view.friendCount === 1
            ? "your friend can see your flares now. joins show up in your feed."
            : "your friends can see your flares now. joins show up in your feed."}
        </p>
      ) : (
        <>
          <ol className="mt-1">
            <Row n={1} title="light your first flare" row={view.flare} />
            <Row n={2} title="add your first friend" row={view.friend} />
          </ol>
          <Button
            type="button"
            onClick={() => {
              haptic("medium")
              if (cta === "add-friend") onAddFriend()
              else onLight()
            }}
            className="mt-3 h-12 w-full rounded-full bg-foreground text-sm text-background hover:bg-foreground/90"
          >
            {cta === "add-friend" ? (
              <>
                <QrCodeIcon className="size-4" />
                add your first friend
              </>
            ) : (
              <>
                <FlameIcon className="size-4" />
                light your first flare
              </>
            )}
          </Button>
        </>
      )}
    </section>
  )
}

// ---- the first-friend step (#124) -----------------------------------------

const FRIEND_POLL_MS = 3_000

/**
 * The QR and the invite link, as "add your first friend" with "later". While
 * it's open it checks for a first connection (someone scanned the QR), and
 * calls `onConnected` once there is one.
 */
export function FirstFriendStep({
  onLater,
  onConnected,
  onShared,
}: {
  onLater: () => void
  onConnected: () => void
  /** After the invite link was shared or copied. */
  onShared?: () => void
}) {
  const { user } = useAuth()
  const onConnectedRef = useRef(onConnected)
  useEffect(() => {
    onConnectedRef.current = onConnected
  }, [onConnected])

  useEffect(() => {
    const controller = new AbortController()
    let settled = false
    const check = () => {
      fetchAcceptedConnections(controller.signal)
        .then((connections) => {
          if (controller.signal.aborted || settled) return
          if (connections.length > 0) {
            settled = true
            emitFriendsChanged()
            onConnectedRef.current()
          }
        })
        .catch(() => {
          // Try again on the next tick.
        })
    }
    const id = window.setInterval(check, FRIEND_POLL_MS)
    return () => {
      controller.abort()
      window.clearInterval(id)
    }
  }, [])

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="add your first friend"
      onKeyDown={(event) => {
        if (event.key === "Escape") onLater()
      }}
      className="fixed inset-0 z-[55]"
    >
      <QrShareSheet
        displayName={user?.displayName ?? "you"}
        handle={user?.username ?? "you"}
        heading="add your first friend"
        closeLabel="later"
        onClose={onLater}
        onShared={onShared}
      />
    </div>,
    document.body
  )
}

// ---- data and visibility ---------------------------------------------------

/** Friends and the hosted flare, loaded while `active`, `undefined` until then. */
function useChecklistFacts(active: boolean) {
  const [friendNames, setFriendNames] = useState<string[] | undefined>()
  const [hostedFlare, setHostedFlare] = useState<
    HostedFlareFact | null | undefined
  >()
  const [friendsTick, setFriendsTick] = useState(0)
  const [flaresTick, setFlaresTick] = useState(0)

  useEffect(
    () => subscribeToEventsChanged(() => setFlaresTick((n) => n + 1)),
    []
  )
  useEffect(
    () => subscribeToFriendsChanged(() => setFriendsTick((n) => n + 1)),
    []
  )
  useRefetchOnFocus(
    () => {
      setFriendsTick((n) => n + 1)
      setFlaresTick((n) => n + 1)
    },
    { enabled: active }
  )

  useEffect(() => {
    if (!active) return
    const controller = new AbortController()
    fetchAcceptedConnections(controller.signal)
      .then((connections) => {
        if (!controller.signal.aborted)
          setFriendNames(connections.map((c) => c.displayName))
      })
      .catch(() => {
        // A failed load counts as no friends yet, as in the first-run intro.
        if (!controller.signal.aborted) setFriendNames((prev) => prev ?? [])
      })
    return () => controller.abort()
  }, [active, friendsTick])

  useEffect(() => {
    if (!active) return
    const controller = new AbortController()
    fetchMyFlares(controller.signal)
      .then((result) => {
        if (!controller.signal.aborted) setHostedFlare(pickHostedFlare(result))
      })
      .catch(() => {
        if (!controller.signal.aborted) setHostedFlare((prev) => prev ?? null)
      })
    return () => controller.abort()
  }, [active, flaresTick])

  return { friendNames, hostedFlare }
}

/**
 * The checklist for the home map's dock (`MapView`'s `dockCard`), or null
 * when it isn't showing. `enabled` is the `introV2` flag.
 */
export function useOnboardingChecklist(enabled: boolean): React.ReactNode {
  const pending = useShowOnboarding()
  const { openDrawer } = useNewEventDrawer()
  const ideasHidden = useIdeasHidden()
  // Both rows done: "you're set" stays up for this visit (onboarding is
  // already marked done), until it's hidden.
  const [finished, setFinished] = useState(false)
  const [hidden, setHidden] = useState(false)
  const [addingFriend, setAddingFriend] = useState(false)
  const active = enabled && (pending || finished) && !hidden

  const { friendNames, hostedFlare } = useChecklistFacts(active)
  const prefill = useMemo(
    () =>
      active
        ? firstFlarePrefill(readLastKnownCoords(), new Date(), ideasHidden)
        : undefined,
    [active, ideasHidden]
  )
  const view = checklistView({
    friendNames,
    hostedFlare,
    ideaTitle: prefill?.title ?? null,
  })

  // Adjusting state during render: latch "you're set" the moment it's seen.
  if (active && view.kind === "done" && !finished) setFinished(true)
  useEffect(() => {
    if (finished) completeOnboarding()
  }, [finished])

  const hide = useCallback(() => {
    completeOnboarding()
    setHidden(true)
  }, [])

  if (!active || view.kind === "loading") return null
  return (
    <>
      <OnboardingChecklist
        view={view}
        onAddFriend={() => setAddingFriend(true)}
        onLight={() => openDrawer(prefill)}
        onHide={hide}
      />
      {addingFriend && (
        <FirstFriendStep
          onLater={() => setAddingFriend(false)}
          onConnected={() => setAddingFriend(false)}
        />
      )}
    </>
  )
}
