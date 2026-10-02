"use client"

// PROTOTYPE (#315) option B: colour-led.
// Every flare is the same circle with its category icon. The fill says who
// can join: plum = invite only, teal = open to all. Both are low-chroma tints
// with their own light and dark values, and neither is peach. The host is
// not on the pin at all; their avatar is in the popover. Because colour alone
// has to be learned (and fails for some colour-blind viewers), the map keeps
// a tiny two-item legend while any flare is on screen.

import { Check, ChevronRight } from "lucide-react"
import {
  CloseButton,
  HostAvatar,
  IdeaMark,
  PinChip,
  TimeLine,
  VISIBILITY_LABEL,
  categoryOf,
  hostLine,
  visFill,
  visInk,
  type OptionDef,
  type PinProps,
  type PopoverProps,
} from "./_shared"

function Pin({ pin, selected }: PinProps) {
  const live = pin.timing === "live"
  const { Icon } = categoryOf(pin.type)
  return (
    <div className="flex flex-col items-center">
      <div
        className={`relative transition-transform ${selected ? "scale-110" : ""}`}
      >
        {live && (
          <span
            aria-hidden="true"
            className="animate-pulse-ring absolute inset-0 rounded-full bg-accent"
          />
        )}
        <div
          className={`relative flex h-10 w-10 items-center justify-center rounded-full border-2 border-card shadow-lg ${
            live ? "ring-2 ring-accent" : ""
          }`}
          style={{ background: visFill(pin.visibility) }}
        >
          <Icon className="h-5 w-5" style={{ color: visInk(pin.visibility) }} />
        </div>
        {pin.joined && (
          <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full border-2 border-card bg-foreground text-background">
            <Check className="h-3 w-3" strokeWidth={3} />
          </span>
        )}
      </div>
      <PinChip pin={pin} />
    </div>
  )
}

function Legend() {
  return (
    <div className="flex items-center gap-3 rounded-full bg-card/90 px-3 py-1 text-xs text-muted-foreground shadow">
      {(["private", "public"] as const).map((v) => (
        <span key={v} className="flex items-center gap-1.5">
          <span
            className="h-3 w-3 rounded-full border border-card"
            style={{ background: visFill(v) }}
          />
          {VISIBILITY_LABEL[v]}
        </span>
      ))}
    </div>
  )
}

function Popover({ pin, onOpen, onClose }: PopoverProps) {
  const { Icon, label } = categoryOf(pin.type)
  return (
    <div
      onClick={onOpen}
      className="relative cursor-pointer overflow-hidden rounded-2xl border border-border/60 bg-card shadow-xl"
    >
      <CloseButton onClose={onClose} />
      <div
        className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium"
        style={{
          background: visFill(pin.visibility),
          color: visInk(pin.visibility),
        }}
      >
        <Icon className="h-3.5 w-3.5" />
        {label}
        <span className="opacity-60">·</span>
        {VISIBILITY_LABEL[pin.visibility]}
      </div>
      <div className="p-3">
        <p className="line-clamp-2 pr-4 text-sm font-semibold text-foreground">
          {pin.title}
        </p>
        <p className="mt-1 text-xs font-medium text-foreground">
          <TimeLine pin={pin} />
        </p>
        <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
          <HostAvatar host={pin.host} size={24} />
          <span>
            {hostLine(pin)} · {pin.distance} · {pin.going} going
          </span>
        </div>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onOpen()
          }}
          className="mt-3 flex h-10 w-full items-center justify-center gap-1 rounded-lg bg-muted text-sm font-medium text-foreground"
        >
          see flare
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}

export const OPTION_B: OptionDef = {
  key: "B",
  name: "colour-led",
  rule: "plum = invite only · teal = open to all · same circle",
  Pin,
  Idea: IdeaMark,
  Popover,
  popoverWidth: 248,
  Legend,
}
