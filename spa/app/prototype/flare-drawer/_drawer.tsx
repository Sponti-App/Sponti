"use client"

// PROTOTYPE (#615) — throwaway. The one flare detail: a vaul drawer over the
// map with three heights. Peek holds the title, time and main action; half is
// what today's map sheet shows; full is everything on today's /event/[id]
// page. A and B differ only in how peek and full look.

import { useState } from "react"
import { Drawer } from "vaul"
import { Button } from "@/components/ui/button"
import { FlareActions, FlareHeader } from "@/components/flare-detail"
import {
  ArrowSquareOutIcon,
  CaretRightIcon,
  ClockIcon,
  LinkIcon,
  MapPinIcon,
  NavigationArrowIcon,
  PencilSimpleIcon,
  XIcon,
} from "@/components/icons"
import type { FlareViewer } from "@/lib/flare-detail"
import { cn } from "@/lib/utils"
import type { MockFlare } from "./_mock"

export type Variant = "A" | "B"
export type Snap = number | string

export function FlareDrawer({
  variant,
  flare,
  viewer,
  open,
  snapPoints,
  snap,
  onSnapChange,
  onClose,
  onJoin,
  onStub,
}: {
  variant: Variant
  flare: MockFlare | null
  viewer: FlareViewer
  open: boolean
  snapPoints: Snap[]
  snap: Snap | null
  onSnapChange: (snap: Snap | null) => void
  onClose: () => void
  onJoin: () => void
  onStub: (what: string) => void
}) {
  const [eta, setEta] = useState<string | null>(null)
  const atPeek = snap === snapPoints[0]
  const atFull = snap === snapPoints[snapPoints.length - 1]
  const floating = variant === "B" && atPeek

  return (
    <Drawer.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose()
      }}
      snapPoints={snapPoints}
      activeSnapPoint={snap}
      setActiveSnapPoint={onSnapChange}
      // The map stays live behind the drawer: one finger moves it at any
      // height, and tapping another pin swaps the flare.
      modal={false}
      dismissible
      repositionInputs={false}
    >
      <Drawer.Portal>
        <Drawer.Content
          className={cn(
            "fixed inset-x-0 bottom-0 z-50 flex h-full flex-col outline-none after:hidden",
            // B's peek is a card floating over the map, not a sheet.
            !floating && "rounded-t-3xl bg-background shadow-(--shadow-sheet)"
          )}
          aria-describedby={undefined}
        >
          <div
            className={cn(
              "flex min-h-0 flex-1 flex-col transition-[margin,border-radius,height] duration-300",
              floating &&
                "mx-3 h-[var(--peek-h)] flex-none rounded-3xl bg-background shadow-(--shadow-sheet)"
            )}
          >
            <div className="mx-auto mt-3 mb-1 h-1.5 w-10 shrink-0 rounded-full bg-muted-foreground/30" />
            <Drawer.Title className="sr-only">
              {flare?.title ?? "flare"}
            </Drawer.Title>
            {flare && (
              <div
                className={cn(
                  "relative min-h-0 flex-1 px-4 pb-[calc(var(--nav-h)+24px)]",
                  atFull
                    ? "overflow-y-auto overscroll-contain"
                    : "overflow-hidden"
                )}
              >
                <button
                  type="button"
                  aria-label="close"
                  onClick={onClose}
                  className="absolute top-0 right-3 z-10 flex size-9 items-center justify-center rounded-full bg-muted text-muted-foreground active:bg-muted/70"
                >
                  <XIcon className="h-4 w-4" />
                </button>
                <div className="pr-10">
                  <FlareHeader
                    as="h2"
                    type={flare.type}
                    title={flare.title}
                    statusLine={flare.statusLine}
                    timing={flare.timing}
                    viewer={viewer}
                  />
                </div>
                <div className="mt-3">
                  <FlareActions
                    viewer={viewer}
                    timing={flare.timing}
                    eta={eta}
                    onEtaChange={setEta}
                    onJoin={onJoin}
                    onDecline={() => onStub("can't make it")}
                    onShareUpdate={() => onStub("share an update")}
                    declineInline={false}
                  />
                </div>

                {/* ---- half: today's map sheet ---- */}
                <Facts flare={flare} onStub={onStub} />
                <HostRow flare={flare} />
                <Going flare={flare} viewer={viewer} />
                {viewer === "host" && (
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <Secondary onClick={() => onStub("invite link (#616)")}>
                      <LinkIcon className="h-4 w-4" /> invite
                    </Secondary>
                    <Secondary onClick={() => onStub("edit flare")}>
                      <PencilSimpleIcon className="h-4 w-4" /> edit
                    </Secondary>
                  </div>
                )}

                {/* ---- full: today's /event/[id] page ---- */}
                <Updates flare={flare} viewer={viewer} onStub={onStub} />
              </div>
            )}
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  )
}

/**
 * When and where. The place no longer opens Google Maps on tap: "directions"
 * opens two choices, so leaving the app is something the person picks.
 */
function Facts({
  flare,
  onStub,
}: {
  flare: MockFlare
  onStub: (what: string) => void
}) {
  const [choosing, setChoosing] = useState(false)
  return (
    <div className="mt-5 divide-y divide-border/60 border-y border-border/60">
      <Row icon={<ClockIcon className="h-4 w-4" />}>
        <p className="text-sm font-medium">{flare.when}</p>
        {/* #614: an open end shows the start only. */}
        {flare.until && (
          <p className="text-xs text-muted-foreground">{flare.until}</p>
        )}
      </Row>
      <Row icon={<MapPinIcon className="h-4 w-4" />}>
        <p className="text-sm font-medium">{flare.place.name}</p>
        <p className="text-xs text-muted-foreground">{flare.place.area}</p>
      </Row>
      <button
        type="button"
        onClick={() => setChoosing((v) => !v)}
        aria-expanded={choosing}
        className="flex w-full items-center gap-3 py-3 text-left active:bg-muted/50"
      >
        <NavigationArrowIcon className="h-4 w-4 shrink-0 text-primary" />
        <span className="flex-1 text-sm font-medium">directions</span>
        <span className="text-xs text-muted-foreground">
          {flare.place.travel}
        </span>
        <CaretRightIcon
          className={cn(
            "h-4 w-4 text-muted-foreground transition-transform",
            choosing && "rotate-90"
          )}
        />
      </button>
      {choosing && (
        <div className="grid grid-cols-2 gap-2 py-3">
          <Secondary onClick={() => onStub("route drawn on the map")}>
            see route
          </Secondary>
          <Secondary onClick={() => onStub("opens google maps")}>
            google maps <ArrowSquareOutIcon className="h-3.5 w-3.5" />
          </Secondary>
        </div>
      )}
    </div>
  )
}

function Row({
  icon,
  children,
}: {
  icon: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="flex items-start gap-3 py-3">
      <span className="mt-0.5 shrink-0 text-muted-foreground">{icon}</span>
      <div className="min-w-0">{children}</div>
    </div>
  )
}

function Face({ name }: { name: string }) {
  return (
    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-background bg-muted text-xs font-medium">
      {name.charAt(0)}
    </div>
  )
}

function HostRow({ flare }: { flare: MockFlare }) {
  return (
    <div className="mt-4 flex items-center gap-2.5">
      <Face name={flare.host} />
      <div className="min-w-0">
        <p className="text-sm font-medium">hosted by {flare.host}</p>
        {flare.note && (
          <p className="text-xs text-muted-foreground">{flare.note}</p>
        )}
      </div>
    </div>
  )
}

function Going({ flare, viewer }: { flare: MockFlare; viewer: FlareViewer }) {
  return (
    <div className="mt-4">
      <p className="mb-2 text-xs text-muted-foreground">
        {flare.guests.length} going
      </p>
      {viewer === "host" ? (
        // The host's arrival board, from today's full page.
        <div className="flex flex-col gap-2">
          {flare.guests.map((g) => (
            <div key={g.name} className="flex items-center gap-2.5">
              <Face name={g.name} />
              <span className="flex-1 text-sm">{g.name}</span>
              {g.arrival && (
                <span className="text-xs text-muted-foreground">
                  {g.arrival}
                </span>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="flex items-center gap-3">
          <div className="flex -space-x-2">
            {flare.guests.map((g) => (
              <Face key={g.name} name={g.name} />
            ))}
          </div>
          <p className="text-sm font-medium">
            {flare.guests.map((g) => g.name).join(", ")}
          </p>
        </div>
      )}
    </div>
  )
}

function Updates({
  flare,
  viewer,
  onStub,
}: {
  flare: MockFlare
  viewer: FlareViewer
  onStub: (what: string) => void
}) {
  return (
    <div className="mt-6">
      <p className="mb-2 text-xs text-muted-foreground">updates</p>
      {viewer === "invited" ? (
        <p className="text-sm text-muted-foreground">
          join to see updates from the group
        </p>
      ) : flare.updates.length === 0 ? (
        <p className="text-sm text-muted-foreground">nothing yet</p>
      ) : (
        <div className="flex flex-col gap-3">
          {flare.updates.map((u) => (
            <div key={u.text} className="flex gap-2.5">
              <Face name={u.author} />
              <div>
                <p className="text-sm">
                  <span className="font-medium">{u.author}</span> {u.text}
                </p>
                <p className="text-xs text-muted-foreground">{u.ago} ago</p>
              </div>
            </div>
          ))}
        </div>
      )}
      {viewer !== "invited" && (
        <button
          type="button"
          onClick={() => onStub("compose an update")}
          className="mt-4 h-11 w-full rounded-full bg-muted px-4 text-left text-sm text-muted-foreground"
        >
          say something to the group
        </button>
      )}
    </div>
  )
}

function Secondary({
  onClick,
  children,
}: {
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <Button
      variant="ghost"
      className="h-10 w-full rounded-full bg-muted text-sm text-foreground hover:bg-muted/70"
      onClick={onClick}
    >
      {children}
    </Button>
  )
}
