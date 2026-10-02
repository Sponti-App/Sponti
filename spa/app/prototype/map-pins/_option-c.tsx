"use client"

// PROTOTYPE (#315) option C: badge-led.
// Today's pin, calmed down: a neutral card-coloured circle with the category
// icon on its #138 tint, and no peach border. One corner badge says who it's
// from: the host's face for an invite (you know who asked you), a globe for
// open to all. Joined is a second badge at the bottom. Live has no pulse and
// no ring: the chip under the pin carries it ("live · 40m"), so the map is
// quiet and the time leads, as BRAND.md §7.5 asks for live flares.

import { Check, ChevronRight, Globe, Lock } from "lucide-react"
import {
  CATEGORY_HUE,
  CloseButton,
  HostAvatar,
  IdeaMark,
  LiveDot,
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

function CategoryDisc({ pin, size }: { pin: MockPin; size: number }) {
  const { Icon } = categoryOf(pin.type)
  const hue = CATEGORY_HUE[pin.type]
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-full"
      style={{ width: size, height: size, background: tint(hue) }}
    >
      <Icon className="h-5 w-5" style={{ color: ink(hue) }} />
    </span>
  )
}

function shortLive(pin: MockPin) {
  // "ends in 40 min" → "40m", "ends in 1h 10m" → "1h 10m": the chip is small.
  return pin.timeLabel.replace("ends in ", "").replace(" min", "m")
}

function Pin({ pin, selected }: PinProps) {
  const live = pin.timing === "live"
  return (
    <div className="flex flex-col items-center">
      <div
        className={`relative transition-transform ${selected ? "scale-110" : ""}`}
      >
        <div className="rounded-full border border-border bg-card p-0.5 shadow-lg">
          <CategoryDisc pin={pin} size={36} />
        </div>
        <span className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full border-2 border-card bg-card shadow">
          {pin.visibility === "private" ? (
            <HostAvatar host={pin.host} size={18} />
          ) : (
            <Globe className="h-3.5 w-3.5 text-muted-foreground" />
          )}
        </span>
        {pin.joined && (
          <span className="absolute -right-1.5 -bottom-1 flex h-5 w-5 items-center justify-center rounded-full border-2 border-card bg-foreground text-background">
            <Check className="h-3 w-3" strokeWidth={3} />
          </span>
        )}
      </div>
      <span
        className={`mt-1 flex items-center gap-1 rounded-full bg-card px-1.5 text-xs leading-5 shadow ${
          live ? "font-medium text-foreground" : "text-muted-foreground"
        }`}
      >
        {live && <LiveDot />}
        {pin.own && "you · "}
        {live ? `live · ${shortLive(pin)}` : pin.shortTime}
      </span>
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
      className={`relative flex cursor-pointer items-center gap-3 rounded-2xl border border-border/60 bg-card py-3 pr-2 pl-3 shadow-xl ${
        pin.timing === "live" ? "border-l-[3px] border-l-accent" : ""
      }`}
    >
      <CloseButton onClose={onClose} />
      <div className="relative self-start">
        <HostAvatar host={pin.host} size={40} />
        <span className="absolute -right-1 -bottom-1 flex h-5 w-5 items-center justify-center rounded-full border-2 border-card bg-card">
          <Icon className="h-3 w-3" style={{ color: ink(hue) }} />
        </span>
      </div>
      <div className="min-w-0 flex-1 pr-6">
        <p className="line-clamp-2 text-sm font-semibold text-foreground">
          {pin.title}
        </p>
        <p className="mt-0.5 text-xs font-medium text-foreground">
          {pin.timing === "live" ? `live · ${pin.timeLabel}` : pin.timeLabel}
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {hostLine(pin)} · {pin.distance} · {pin.going} going
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          <VisIcon className="mr-1 inline h-3 w-3 align-[-2px]" />
          {VISIBILITY_LABEL[pin.visibility]} · {label}
        </p>
      </div>
      <button
        type="button"
        aria-label="see flare"
        onClick={(e) => {
          e.stopPropagation()
          onOpen()
        }}
        className="mt-8 flex h-10 w-10 shrink-0 items-center justify-center self-center rounded-full bg-muted text-foreground"
      >
        <ChevronRight className="h-5 w-5" />
      </button>
    </div>
  )
}

export const OPTION_C: OptionDef = {
  key: "C",
  name: "badge-led",
  rule: "corner badge: host face = invite only · globe = open to all",
  Pin,
  Idea: IdeaMark,
  Popover,
  popoverWidth: 300,
}
