"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, ChevronDown, ChevronRight, Plus, Sparkles } from "lucide-react"
import { BottomNav } from "@/components/bottom-nav"
import { Button } from "@/components/ui/button"
import { CancelEventDialog } from "@/components/cancel-event-dialog"
import { EventHostCard } from "@/components/event-host-card"
import { useAuth } from "@/components/auth-provider"
import {
  cancelHostedEvent,
  deriveStatus,
  duplicateHostedEvent,
  uncancelHostedEvent,
  useHostedEvents,
  type HostedEvent,
} from "@/lib/api/events"
import { MOCK_NOTIFICATIONS, pushEventUpdate, type Notification } from "@/lib/notifications"

const UNDO_WINDOW_MS = 5_000

export default function EventHubPage() {
  const router = useRouter()
  const { user } = useAuth()
  const events = useHostedEvents()
  // Notifications are component-local for the prototype; real fetch arrives
  // with stage 4. Wired here so cancellations + edits actually push entries.
  const [, setNotifications] = useState<Notification[]>(MOCK_NOTIFICATIONS)

  const [confirmTarget, setConfirmTarget] = useState<HostedEvent | null>(null)
  const [undo, setUndo] = useState<{ id: string; title: string; expires: number } | null>(null)
  const [pastOpen, setPastOpen] = useState(false)

  const buckets = bucket(events)
  const hostName = user?.displayName ?? "you"

  const fanOut = (event: HostedEvent, change: "time" | "location" | "cancelled", detail?: string): void => {
    setNotifications((prev) =>
      pushEventUpdate(prev, {
        actorName: hostName,
        eventTitle: event.title,
        change,
        detail,
      }),
    )
  }

  const handleCancel = (event: HostedEvent): void => {
    cancelHostedEvent(event.id)
    fanOut(event, "cancelled")
    setConfirmTarget(null)
    const id = event.id
    setUndo({ id, title: event.title, expires: Date.now() + UNDO_WINDOW_MS })
    if (typeof window !== "undefined") {
      window.setTimeout(() => {
        setUndo((curr) => (curr?.id === id ? null : curr))
      }, UNDO_WINDOW_MS)
    }
  }

  const handleUndo = (): void => {
    if (!undo) return
    uncancelHostedEvent(undo.id)
    setUndo(null)
  }

  const handleDuplicate = (event: HostedEvent): void => {
    const copy = duplicateHostedEvent(event.id)
    if (copy) router.push(`/event/${copy.id}/edit`)
  }

  return (
    <div className="min-h-screen w-full bg-background relative overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 shrink-0">
          <button
            onClick={() => router.push("/")}
            aria-label="Back"
            className="h-9 w-9 rounded-full border border-foreground flex items-center justify-center"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="flex items-center gap-1.5 text-base font-semibold">
            <Sparkles className="h-4 w-4" />
            <span>your flares</span>
          </div>
          <div className="h-9 w-9" aria-hidden />
        </div>

        <div className="px-4 pb-3 shrink-0">
          <Button
            onClick={() => router.push("/event/new")}
            className="w-full rounded-full py-5 text-sm bg-accent text-accent-foreground hover:bg-accent/90"
          >
            <Plus className="h-4 w-4 mr-1" />
            light a new flare
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 pb-32">
          {events.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="flex flex-col gap-5">
              {buckets.live.length > 0 && (
                <Section title="live now" count={buckets.live.length}>
                  {buckets.live.map((e) => (
                    <EventHostCard
                      key={e.id}
                      event={e}
                      status="live"
                      onChange={(kind, detail) => fanOut(e, kind, detail)}
                      onCancelRequest={() => setConfirmTarget(e)}
                      onDuplicate={() => handleDuplicate(e)}
                    />
                  ))}
                </Section>
              )}

              {buckets.upcoming.length > 0 && (
                <Section title="upcoming" count={buckets.upcoming.length}>
                  {buckets.upcoming.map((e) => (
                    <EventHostCard
                      key={e.id}
                      event={e}
                      status="upcoming"
                      onChange={(kind, detail) => fanOut(e, kind, detail)}
                      onCancelRequest={() => setConfirmTarget(e)}
                      onDuplicate={() => handleDuplicate(e)}
                    />
                  ))}
                </Section>
              )}

              {buckets.cancelled.length > 0 && (
                <Section title="cancelled" count={buckets.cancelled.length}>
                  {buckets.cancelled.map((e) => (
                    <EventHostCard
                      key={e.id}
                      event={e}
                      status="cancelled"
                      onChange={(kind, detail) => fanOut(e, kind, detail)}
                      onCancelRequest={() => setConfirmTarget(e)}
                      onDuplicate={() => handleDuplicate(e)}
                    />
                  ))}
                </Section>
              )}

              {buckets.past.length > 0 && (
                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => setPastOpen((v) => !v)}
                    className="flex items-center gap-1 text-[11px] tracking-wide uppercase text-muted-foreground"
                  >
                    {pastOpen ? (
                      <ChevronDown className="h-3 w-3" />
                    ) : (
                      <ChevronRight className="h-3 w-3" />
                    )}
                    past · {buckets.past.length}
                  </button>
                  {pastOpen &&
                    buckets.past.map((e) => (
                      <EventHostCard
                        key={e.id}
                        event={e}
                        status="past"
                        onChange={(kind, detail) => fanOut(e, kind, detail)}
                        onCancelRequest={() => setConfirmTarget(e)}
                        onDuplicate={() => handleDuplicate(e)}
                      />
                    ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="absolute bottom-6 left-0 right-0 z-10 pointer-events-none">
          <div className="pointer-events-auto">
            <BottomNav />
          </div>
        </div>

        {undo && <UndoBanner undo={undo} onUndo={handleUndo} onDismiss={() => setUndo(null)} />}

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

function bucket(events: HostedEvent[]): {
  live: HostedEvent[]
  upcoming: HostedEvent[]
  cancelled: HostedEvent[]
  past: HostedEvent[]
} {
  const live: HostedEvent[] = []
  const upcoming: HostedEvent[] = []
  const cancelled: HostedEvent[] = []
  const past: HostedEvent[] = []
  events.forEach((e) => {
    const s = deriveStatus(e)
    if (s === "live") live.push(e)
    else if (s === "upcoming") upcoming.push(e)
    else if (s === "cancelled") cancelled.push(e)
    else past.push(e)
  })
  upcoming.sort(
    (a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime(),
  )
  past.sort((a, b) => new Date(b.startAt).getTime() - new Date(a.startAt).getTime())
  return { live, upcoming, cancelled, past }
}

function Section({
  title,
  count,
  children,
}: {
  title: string
  count: number
  children: React.ReactNode
}) {
  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <p className="text-[11px] tracking-wide uppercase text-muted-foreground">{title}</p>
        <span className="text-[11px] text-muted-foreground">{count}</span>
      </div>
      <div className="flex flex-col gap-2">{children}</div>
    </section>
  )
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center text-center pt-16 pb-8">
      <div className="h-14 w-14 rounded-full bg-accent/10 text-accent flex items-center justify-center mb-3">
        <Sparkles className="h-6 w-6" />
      </div>
      <p className="text-sm font-semibold">no flares yet</p>
      <p className="text-xs text-muted-foreground max-w-[240px] mt-1">
        light one above — your friends see it on the map and in their calendars.
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
  // Auto-dismiss timing is owned by the parent — this component just renders.
  // Parent reads expires to schedule cleanup; we keep it simple here.
  return (
    <div className="absolute bottom-24 left-4 right-4 z-30">
      <div className="rounded-xl bg-foreground text-background px-4 py-3 flex items-center gap-3 shadow-xl">
        <span className="text-xs flex-1 truncate">cancelled {undo.title}</span>
        <button
          type="button"
          onClick={onUndo}
          className="text-xs font-semibold text-accent-foreground bg-accent rounded-full px-3 py-1"
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
