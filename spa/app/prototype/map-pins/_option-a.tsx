"use client"

// PROTOTYPE (#315) option A: shape-led.
// The pin's shape says who can join:
//   circle = invite only. The host's face, because someone you know asked you.
//   rounded square = open to all. The category, because it's about the place
//   and the activity, and the host is usually a stranger.
// Live adds a peach ring and pulse; joined adds a check; yours says "you".

import { Check, ChevronRight, Globe, Lock } from "lucide-react"
import {
  CATEGORY_HUE,
  CloseButton,
  HostAvatar,
  IdeaMark,
  PinChip,
  TimeLine,
  VISIBILITY_LABEL,
  categoryOf,
  hostLine,
  ink,
  tint,
  type OptionDef,
  type PinProps,
  type PopoverProps,
} from "./_shared"
import type { MockPin } from "./_mock"

function CategoryTile({ pin, size = 40 }: { pin: MockPin; size?: number }) {
  const { Icon } = categoryOf(pin.type)
  const hue = CATEGORY_HUE[pin.type]
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-lg"
      style={{ width: size, height: size, background: tint(hue) }}
    >
      <Icon className="h-5 w-5" style={{ color: ink(hue) }} />
    </span>
  )
}

function Pin({ pin, selected }: PinProps) {
  const live = pin.timing === "live"
  const square = pin.visibility === "public"
  const { Icon } = categoryOf(pin.type)
  const hue = CATEGORY_HUE[pin.type]
  const shape = square ? "rounded-lg" : "rounded-full"
  return (
    <div className="flex flex-col items-center">
      <div
        className={`relative transition-transform ${selected ? "scale-110" : ""}`}
      >
        {live && (
          <span
            aria-hidden="true"
            className={`animate-pulse-ring absolute inset-0 bg-accent ${shape}`}
          />
        )}
        <div
          className={`relative border-2 border-card shadow-lg ${shape} ${
            live ? "ring-2 ring-accent" : ""
          }`}
        >
          {square ? (
            <CategoryTile pin={pin} size={36} />
          ) : (
            <HostAvatar host={pin.host} size={36} />
          )}
        </div>
        {/* invite-only pins still carry the category, as a corner mark */}
        {!square && (
          <span className="absolute -right-1 -bottom-1 flex h-5 w-5 items-center justify-center rounded-full border border-border bg-card">
            <Icon className="h-3 w-3" style={{ color: ink(hue) }} />
          </span>
        )}
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

function Popover({ pin, onOpen, onClose }: PopoverProps) {
  const { Icon, label } = categoryOf(pin.type)
  const hue = CATEGORY_HUE[pin.type]
  const VisIcon = pin.visibility === "public" ? Globe : Lock
  return (
    <div
      onClick={onOpen}
      className="relative cursor-pointer rounded-2xl border border-border/60 bg-card p-3 shadow-xl"
    >
      <CloseButton onClose={onClose} />
      <div className="flex items-start gap-3 pr-6">
        {pin.visibility === "public" ? (
          <CategoryTile pin={pin} />
        ) : (
          <HostAvatar host={pin.host} />
        )}
        <div className="min-w-0">
          <p className="line-clamp-2 text-sm font-semibold text-foreground">
            {pin.title}
          </p>
          <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
            {pin.visibility === "public" && (
              <HostAvatar host={pin.host} size={20} />
            )}
            {hostLine(pin)} · {pin.distance}
          </p>
        </div>
      </div>
      <div className="mt-3 flex flex-col gap-1 text-xs text-muted-foreground">
        <span className="font-medium text-foreground">
          <TimeLine pin={pin} />
        </span>
        <span className="flex items-center gap-1.5">
          <Icon className="h-3.5 w-3.5" style={{ color: ink(hue) }} />
          {label}
          <span className="text-border">·</span>
          <VisIcon className="h-3.5 w-3.5" />
          {VISIBILITY_LABEL[pin.visibility]}
          <span className="text-border">·</span>
          {pin.going} going
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
  )
}

export const OPTION_A: OptionDef = {
  key: "A",
  name: "shape-led",
  rule: "circle + face = invite only · square + category = open to all",
  Pin,
  Idea: IdeaMark,
  Popover,
  popoverWidth: 248,
}
