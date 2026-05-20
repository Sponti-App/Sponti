"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import {
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  Plus,
  Sparkles,
} from "lucide-react"
import { BottomNav } from "@/components/bottom-nav"
import { Button } from "@/components/ui/button"
import { CancelEventDialog } from "@/components/cancel-event-dialog"
import { EventHostCard } from "@/components/event-host-card"
import { useNewEventDrawer } from "@/components/new-event-drawer-provider"
import {
  cancelEvent,
  deriveStatus,
  reactivateEvent,
  updateEvent,
  updateMyRsvp,
  type HostedEvent,
} from "@/lib/api/events"
import { emitEventsChanged, useMyFlares } from "@/lib/use-events"

const UNDO_WINDOW_MS = 5_000

export default function EventHubPage() {
  const router = useRouter()
  const { openDrawer } = useNewEventDrawer()
  const { hostedByMe, invited, pastHosted, loading, error, refresh } =
    useMyFlares()
  const cancelTimers = useRef(new Map<string, number>())
  const [confirmTarget, setConfirmTarget] = useState<HostedEvent | null>(null)
  const [undo, setUndo] = useState<{
    id: string
    title: string
    expires: number
  } | null>(null)
  const [optimisticStatuses, setOptimisticStatuses] = useState<
    Record<string, HostedEvent["apiStatus"]>
  >({})
  const [actionError, setActionError] = useState<string | null>(null)
  const [hostedOpen, setHostedOpen] = useState(true)
  const [invitedOpen, setInvitedOpen] = useState(true)
  const [pastOpen, setPastOpen] = useState(false)
  const [respondingIds, setRespondingIds] = useState<Record<string, boolean>>(
    {}
  )

  useEffect(() => {
    const timers = cancelTimers.current
    return () => {
      timers.forEach((timer) => window.clearTimeout(timer))
      timers.clear()
    }
  }, [])

  const visibleHosted = useMemo(
    () =>
      hostedByMe.map((event) =>
        optimisticStatuses[event.id]
          ? { ...event, apiStatus: optimisticStatuses[event.id] }
          : event
      ),
    [hostedByMe, optimisticStatuses]
  )

  const allEmpty =
    !loading &&
    visibleHosted.length === 0 &&
    invited.length === 0 &&
    pastHosted.length === 0

  const clearOptimisticStatus = (id: string): void => {
    setOptimisticStatuses((current) => {
      const next = { ...current }
      delete next[id]
      return next
    })
  }

  const clearPendingCancel = (id: string): void => {
    const timer = cancelTimers.current.get(id)
    if (timer) window.clearTimeout(timer)
    cancelTimers.current.delete(id)
    clearOptimisticStatus(id)
    setUndo((current) => (current?.id === id ? null : current))
  }

  const finalizeCancel = async (event: HostedEvent): Promise<void> => {
    try {
      await cancelEvent(event.id)
      cancelTimers.current.delete(event.id)
      clearOptimisticStatus(event.id)
      setUndo((current) => (current?.id === event.id ? null : current))
      refresh()
    } catch (err) {
      cancelTimers.current.delete(event.id)
      clearOptimisticStatus(event.id)
      setUndo((current) => (current?.id === event.id ? null : current))
      setActionError(
        err instanceof Error ? err.message : "Could not cancel flare"
      )
    }
  }

  const handleCancel = (event: HostedEvent): void => {
    setConfirmTarget(null)
    setActionError(null)
    setOptimisticStatuses((current) => ({
      ...current,
      [event.id]: "cancelled",
    }))
    setUndo({
      id: event.id,
      title: event.title,
      expires: Date.now() + UNDO_WINDOW_MS,
    })

    const previousTimer = cancelTimers.current.get(event.id)
    if (previousTimer) window.clearTimeout(previousTimer)

    const timer = window.setTimeout(() => {
      void finalizeCancel(event)
    }, UNDO_WINDOW_MS)
    cancelTimers.current.set(event.id, timer)
  }

  const handleUndo = (): void => {
    if (!undo) return
    clearPendingCancel(undo.id)
  }

  const handleReactivate = async (event: HostedEvent): Promise<void> => {
    if (cancelTimers.current.has(event.id)) {
      clearPendingCancel(event.id)
      return
    }

    try {
      setActionError(null)
      setOptimisticStatuses((current) => ({ ...current, [event.id]: "active" }))
      await reactivateEvent(event.id)
      clearOptimisticStatus(event.id)
      refresh()
    } catch (err) {
      clearOptimisticStatus(event.id)
      setActionError(
        err instanceof Error ? err.message : "Could not reactivate flare"
      )
    }
  }

  const handleLocationChange = async (
    event: HostedEvent,
    locationLabel: string,
    locationDetail?: string
  ): Promise<void> => {
    await updateEvent(event.id, {
      locationName: locationLabel,
      locationAddress: locationDetail ?? null,
    })
    refresh()
  }

  const handleTimeShift = async (
    event: HostedEvent,
    deltaMs: number
  ): Promise<void> => {
    const startAt = new Date(
      new Date(event.startAt).getTime() + deltaMs
    ).toISOString()
    const endAt = new Date(
      new Date(event.endAt).getTime() + deltaMs
    ).toISOString()
    await updateEvent(event.id, { startAt, endAt })
    refresh()
  }

  const handleInvitedRsvp = async (
    event: HostedEvent,
    rsvpStatus: "going" | "declined"
  ): Promise<void> => {
    try {
      setActionError(null)
      setRespondingIds((current) => ({ ...current, [event.id]: true }))
      await updateMyRsvp(event.id, { rsvpStatus })
      emitEventsChanged()
      refresh()
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Could not update RSVP"
      )
    } finally {
      setRespondingIds((current) => {
        const next = { ...current }
        delete next[event.id]
        return next
      })
    }
  }

  return (
    <div className="relative flex min-h-dvh w-full flex-col overflow-hidden bg-background">
      <div className="flex shrink-0 items-center justify-between px-4 py-3">
        <button
          onClick={() => router.push("/")}
          aria-label="Back"
          className="flex h-9 w-9 items-center justify-center rounded-full border border-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="flex items-center gap-1.5 text-base font-semibold">
          <Sparkles className="h-4 w-4" />
          <span>your flares</span>
        </div>
        <div className="h-9 w-9" aria-hidden />
      </div>

      <div className="shrink-0 px-4 pb-3">
        <Button
          onClick={openDrawer}
          className="w-full rounded-full bg-accent py-5 text-sm text-accent-foreground hover:bg-accent/90"
        >
          <Plus className="mr-1 h-4 w-4" />
          light a new flare
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-32">
        {(error || actionError) && (
          <div className="mb-3 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
            {actionError ?? error}
          </div>
        )}

        {loading ? (
          <LoadingState />
        ) : allEmpty ? (
          <EmptyState />
        ) : (
          <div className="flex flex-col gap-5">
            <CollapsibleSection
              title="hosted by me"
              count={visibleHosted.length}
              open={hostedOpen}
              onToggle={() => setHostedOpen((value) => !value)}
              empty="no hosted flares coming up"
            >
              {visibleHosted.map((event) => (
                <EventHostCard
                  key={event.id}
                  event={event}
                  status={deriveStatus(event)}
                  canManage
                  onCancelRequest={() => setConfirmTarget(event)}
                  onReactivate={() => void handleReactivate(event)}
                  onLocationChange={(label, detail) =>
                    handleLocationChange(event, label, detail)
                  }
                  onTimeShift={(delta) => handleTimeShift(event, delta)}
                />
              ))}
            </CollapsibleSection>

            <CollapsibleSection
              title="invited"
              count={invited.length}
              open={invitedOpen}
              onToggle={() => setInvitedOpen((value) => !value)}
              empty="no invited flares coming up"
            >
              {invited.map((event) => (
                <EventHostCard
                  key={event.id}
                  event={event}
                  status={deriveStatus(event)}
                  responsePending={Boolean(respondingIds[event.id])}
                  onAcceptInvite={() => void handleInvitedRsvp(event, "going")}
                  onDeclineInvite={() =>
                    void handleInvitedRsvp(event, "declined")
                  }
                />
              ))}
            </CollapsibleSection>

            {pastHosted.length > 0 && (
              <CollapsibleSection
                title="past"
                count={pastHosted.length}
                open={pastOpen}
                onToggle={() => setPastOpen((value) => !value)}
              >
                {pastHosted.map((event) => (
                  <EventHostCard key={event.id} event={event} status="past" />
                ))}
              </CollapsibleSection>
            )}
          </div>
        )}
      </div>

      <div className="pointer-events-none absolute right-0 bottom-6 left-0 z-10">
        <div className="pointer-events-auto">
          <BottomNav />
        </div>
      </div>

      {undo && (
        <UndoBanner
          undo={undo}
          onUndo={handleUndo}
          onDismiss={() => setUndo(null)}
        />
      )}

      {confirmTarget && (
        <CancelEventDialog
          event={confirmTarget}
          status={deriveStatus(confirmTarget)}
          onClose={() => setConfirmTarget(null)}
          onConfirm={() => handleCancel(confirmTarget)}
        />
      )}
    </div>
  )
}

function CollapsibleSection({
  title,
  count,
  open,
  onToggle,
  empty,
  children,
}: {
  title: string
  count: number
  open: boolean
  onToggle: () => void
  empty?: string
  children: React.ReactNode
}) {
  return (
    <section className="flex flex-col gap-2">
      <button
        type="button"
        onClick={onToggle}
        className="flex items-center gap-1 text-[11px] tracking-wide text-muted-foreground uppercase"
      >
        {open ? (
          <ChevronDown className="h-3 w-3" />
        ) : (
          <ChevronRight className="h-3 w-3" />
        )}
        {title} · {count}
      </button>
      {open && (
        <div className="flex flex-col gap-2">
          {count === 0 && empty ? (
            <p className="rounded-xl border border-border bg-secondary/40 p-3 text-xs text-muted-foreground">
              {empty}
            </p>
          ) : (
            children
          )}
        </div>
      )}
    </section>
  )
}

function LoadingState() {
  return (
    <div className="pt-16 text-center text-sm text-muted-foreground">
      loading your flares...
    </div>
  )
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center px-4 pt-16 pb-8 text-center">
      <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-accent/10 text-accent">
        <Sparkles className="h-6 w-6" />
      </div>
      <p className="text-sm font-semibold">no flares yet</p>
      <p className="mt-1 max-w-[240px] text-xs text-muted-foreground">
        light one above and it will show here once the backend saves it.
      </p>
    </div>
  )
}

function UndoBanner({
  undo,
  onUndo,
  onDismiss,
}: {
  undo: { id: string; title: string; expires: number }
  onUndo: () => void
  onDismiss: () => void
}) {
  return (
    <div className="absolute right-4 bottom-24 left-4 z-30">
      <div className="flex items-center gap-3 rounded-xl bg-foreground px-4 py-3 text-background shadow-xl">
        <span className="flex-1 truncate text-xs">cancelled {undo.title}</span>
        <button
          type="button"
          onClick={onUndo}
          className="rounded-full bg-accent px-3 py-1 text-xs font-semibold text-accent-foreground"
        >
          undo
        </button>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="dismiss"
          className="text-xs text-background/60 hover:text-background"
        >
          dismiss
        </button>
      </div>
    </div>
  )
}
