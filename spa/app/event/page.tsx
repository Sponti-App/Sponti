"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, ChevronDown, ListFilter, Sparkles } from "lucide-react"
import { BottomNav } from "@/components/bottom-nav"
import { EventHostCard } from "@/components/event-host-card"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { deriveStatus, type HostedEvent } from "@/lib/api/events"
import { useMyFlares } from "@/lib/use-events"
import { cn } from "@/lib/utils"

type EventView = "all" | "hosting" | "invited"
type EventFilter = "date" | "latest" | "going" | "private"
type EventListItem = { event: HostedEvent; canManage: boolean }

const EVENT_TAB_TRIGGER_CLASS =
  "text-sm hover:text-primary data-active:text-primary dark:hover:text-primary dark:data-active:text-primary"

export default function EventHubPage() {
  const router = useRouter()
  const { hostedByMe, invited, loading, error } = useMyFlares()
  const [view, setView] = useState<EventView>("all")
  const [filter, setFilter] = useState<EventFilter>("date")
  const [hostingOpen, setHostingOpen] = useState(true)
  const [invitedOpen, setInvitedOpen] = useState(true)

  const hostedItems = hostedByMe.map((event) => ({ event, canManage: true }))
  const invitedItems = invited.map((event) => ({ event, canManage: false }))
  const hasVisibleEvents =
    view === "all"
      ? hostedItems.length > 0 || invitedItems.length > 0
      : view === "hosting"
        ? hostedItems.length > 0
        : invitedItems.length > 0

  return (
    <div className="relative flex min-h-dvh w-full flex-col overflow-hidden bg-background">
      <div className="sticky top-0 z-10 shrink-0 bg-background">
        <div className="flex items-center justify-between px-4 py-3">
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => router.push("/")}
            aria-label="back"
            className="h-10 w-10 rounded-full"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-base font-semibold">flares</h1>
          <EventFilterMenu value={filter} onChange={setFilter} />
        </div>
        <div className="border-b border-border/60 px-4 pb-3">
          <EventViewToggle value={view} onChange={setView} />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-32">
        <main className="pt-3">
          {error && (
            <div className="mb-3 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
              {error}
            </div>
          )}

          {loading ? (
            <LoadingState />
          ) : !hasVisibleEvents ? (
            <EmptyState />
          ) : view === "all" ? (
            <div className="flex flex-col gap-3">
              <EventSection
                title="hosting"
                events={hostedItems}
                open={hostingOpen}
                onToggle={() => setHostingOpen((value) => !value)}
                emptyCopy="no hosted flares coming up"
              />
              <EventSection
                title="invited"
                events={invitedItems}
                open={invitedOpen}
                onToggle={() => setInvitedOpen((value) => !value)}
                emptyCopy="no invited flares coming up"
              />
            </div>
          ) : (
            <EventSection
              title={view}
              events={view === "hosting" ? hostedItems : invitedItems}
              open={view === "hosting" ? hostingOpen : invitedOpen}
              onToggle={() =>
                view === "hosting"
                  ? setHostingOpen((value) => !value)
                  : setInvitedOpen((value) => !value)
              }
            />
          )}
        </main>
      </div>

      <div className="pointer-events-none absolute right-0 bottom-0 left-0 z-10">
        <div className="pointer-events-auto">
          <BottomNav />
        </div>
      </div>
    </div>
  )
}

function EventSection({
  title,
  events,
  open,
  onToggle,
  emptyCopy,
}: {
  title: string
  events: EventListItem[]
  open: boolean
  onToggle: () => void
  emptyCopy?: string
}) {
  return (
    <section>
      <button
        type="button"
        onClick={onToggle}
        className="mb-2 flex w-full items-center justify-between px-1 text-xs font-medium tracking-wide text-muted-foreground uppercase"
      >
        <span>{title}</span>
        <ChevronDown
          className={cn(
            "h-3.5 w-3.5 transition-transform",
            !open && "-rotate-90"
          )}
        />
      </button>
      {open &&
        (events.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border p-3 text-xs text-muted-foreground">
            {emptyCopy}
          </p>
        ) : (
          <div className="flex flex-col gap-2.5">
            {events.map(({ event, canManage }) => (
              <EventHostCard
                key={event.id}
                event={event}
                status={deriveStatus(event)}
                canManage={canManage}
              />
            ))}
          </div>
        ))}
    </section>
  )
}

function EventViewToggle({
  value,
  onChange,
}: {
  value: EventView
  onChange: (value: EventView) => void
}) {
  return (
    <Tabs value={value} onValueChange={(next) => onChange(next as EventView)}>
      <TabsList className="h-9 w-full">
        {(["all", "hosting", "invited"] as const).map((option) => (
          <TabsTrigger
            key={option}
            value={option}
            className={EVENT_TAB_TRIGGER_CLASS}
          >
            {option}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  )
}

function EventFilterMenu({
  value,
  onChange,
}: {
  value: EventFilter
  onChange: (value: EventFilter) => void
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label="filter flares"
          className="h-10 w-10 rounded-full"
        >
          <ListFilter className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuLabel>filter</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={value}
          onValueChange={(next) => onChange(next as EventFilter)}
        >
          <DropdownMenuRadioItem value="date">date</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="latest">latest</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="going">going</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="private">private</DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="font-normal">
          sorting hookup pending
        </DropdownMenuLabel>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function LoadingState() {
  return (
    <div className="flex flex-col gap-2.5">
      {Array.from({ length: 4 }, (_, index) => (
        <div
          key={index}
          className="rounded-xl border border-border bg-card p-3.5"
        >
          <div className="flex items-center gap-2.5">
            <div className="size-7 rounded-full bg-secondary" />
            <div className="min-w-0 flex-1">
              <div className="h-3 w-24 rounded bg-secondary" />
              <div className="mt-2 h-3 w-20 rounded bg-secondary" />
            </div>
          </div>
          <div className="mt-3 h-5 w-4/5 rounded bg-secondary" />
          <div className="mt-3 flex items-center justify-between">
            <div className="h-3 w-32 rounded bg-secondary" />
            <div className="h-5 w-16 rounded-full bg-secondary" />
          </div>
        </div>
      ))}
    </div>
  )
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center px-4 pt-20 pb-8 text-center">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-secondary text-muted-foreground">
        <Sparkles className="h-5 w-5" />
      </div>
      <p className="text-sm font-semibold">nothing yet</p>
      <p className="mt-1 max-w-[240px] text-xs text-muted-foreground">
        start something with the + below
      </p>
    </div>
  )
}
