"use client"

// PROTOTYPE (#166): shared pieces for the profile approaches. Not production.

import { useState } from "react"
import {
  ArrowLeft,
  Camera,
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
  Send,
  X,
} from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"
import type { MockPerson, Network } from "./_mock"

export type ApproachKey = "A" | "B" | "C"
export type View = "other" | "own"
// How the viewer stands with the person (other view only). "blockedby" is
// "they blocked you", which reads as not found; "youblocked" is your block.
export type Viewer =
  | "friend"
  | "stranger"
  | "pending"
  | "blockedby"
  | "youblocked"

export const APPROACHES: { key: ApproachKey; name: string }[] = [
  { key: "A", name: "centered card · edit page" },
  { key: "B", name: "contact rows · edit in place" },
  { key: "C", name: "audience preview · edit in settings" },
]

export const VIEWERS: { key: Viewer; label: string }[] = [
  { key: "friend", label: "friend" },
  { key: "stranger", label: "stranger" },
  { key: "pending", label: "requested" },
  { key: "youblocked", label: "you blocked" },
  { key: "blockedby", label: "blocked you" },
]

export type ApproachProps = {
  view: View
  viewer: Viewer
  person: MockPerson
  me: MockPerson
  onToast: (message: string) => void
}

/** The only rule for #166: bio and socials are for connections (and you). */
export function seesDetails(view: View, viewer: Viewer): boolean {
  return view === "own" || viewer === "friend"
}

export function socialUrl(network: Network, handle: string): string {
  return network === "instagram"
    ? `https://instagram.com/${handle}`
    : `https://t.me/${handle}`
}

export function SocialIcon({
  network,
  className,
}: {
  network: Network
  className?: string
}) {
  const Icon = network === "instagram" ? Camera : Send
  return <Icon className={cn("h-4 w-4", className)} aria-hidden />
}

export function PersonAvatar({
  person,
  size = 80,
}: {
  person: MockPerson
  size?: number
}) {
  return (
    <Avatar style={{ width: size, height: size }}>
      {person.avatarUrl && <AvatarImage src={person.avatarUrl} alt="" />}
      <AvatarFallback className="bg-accent/10 text-lg font-semibold text-accent">
        {person.displayName
          .split(" ")
          .map((w) => w[0])
          .join("")
          .slice(0, 2)
          .toUpperCase()}
      </AvatarFallback>
    </Avatar>
  )
}

export function TopBar({
  title = "profile",
  right,
  onBack,
}: {
  title?: string
  right?: React.ReactNode
  onBack?: () => void
}) {
  return (
    <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
      <button
        type="button"
        onClick={onBack}
        aria-label="back"
        className="flex h-9 w-9 items-center justify-center rounded-full border border-border"
      >
        <ArrowLeft className="h-4 w-4" />
      </button>
      <span className="text-base font-semibold">{title}</span>
      {right ?? <div className="h-9 w-9" />}
    </div>
  )
}

export function OptionsButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="options"
      className="flex h-9 w-9 items-center justify-center rounded-full border border-border"
    >
      <MoreHorizontal className="h-4 w-4" />
    </button>
  )
}

/** "They blocked you" and "no such user" are the same screen (as in #199). */
export function NotFound({ username }: { username: string }) {
  return (
    <div className="flex flex-col items-center gap-4 px-4 pt-10">
      <span className="flex h-20 w-20 items-center justify-center rounded-full bg-muted text-lg font-semibold text-muted-foreground">
        ?
      </span>
      <div className="text-center">
        <p className="text-lg font-semibold">@{username}</p>
        <p className="mt-0.5 text-sm text-muted-foreground">user not found</p>
      </div>
    </div>
  )
}

/** Prototype annotation, not product UI: what this round leaves out. */
export function OutOfScope() {
  return (
    <div className="mx-4 mt-8 rounded-lg border border-dashed border-border p-3 font-mono text-xs text-muted-foreground">
      prototype note · out of scope for #166 (patrick, 2026-09-30): mutual
      friends, their upcoming flares.
    </div>
  )
}

export function PrototypeBar({
  approach,
  view,
  viewer,
  onChange,
}: {
  approach: ApproachKey
  view: View
  viewer: Viewer
  onChange: (
    next: Partial<{ approach: ApproachKey; view: View; viewer: Viewer }>
  ) => void
}) {
  const [open, setOpen] = useState(true)
  const index = APPROACHES.findIndex((a) => a.key === approach)
  const cycle = (dir: 1 | -1) =>
    onChange({
      approach:
        APPROACHES[(index + dir + APPROACHES.length) % APPROACHES.length].key,
    })

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-24 left-3 z-[80] rounded-full bg-zinc-900 px-3 py-1.5 font-mono text-xs text-zinc-100 shadow-lg"
      >
        proto {approach} · {view}
        {view === "other" ? ` · ${viewer}` : ""}
      </button>
    )
  }

  return (
    <div className="fixed inset-x-2 bottom-24 z-[80] rounded-xl bg-zinc-900/95 p-2 font-mono text-xs text-zinc-100 shadow-lg">
      <div className="flex items-center justify-between gap-1">
        <button
          type="button"
          onClick={() => cycle(-1)}
          aria-label="previous approach"
          className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-zinc-700"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="truncate">
          {approach} · {APPROACHES[index].name}
        </span>
        <button
          type="button"
          onClick={() => cycle(1)}
          aria-label="next approach"
          className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-zinc-700"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="collapse"
          className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-zinc-700"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-1.5">
        <Seg
          options={[
            { key: "other" as const, label: "their profile" },
            { key: "own" as const, label: "your profile" },
          ]}
          value={view}
          onChange={(v) => onChange({ view: v })}
        />
        {view === "other" && (
          <Seg
            options={VIEWERS}
            value={viewer}
            onChange={(v) => onChange({ viewer: v })}
          />
        )}
      </div>
    </div>
  )
}

function Seg<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { key: T; label: string }[]
  value: T
  onChange: (value: T) => void
}) {
  return (
    <div className="flex flex-wrap gap-0.5 rounded-full bg-zinc-800 p-0.5">
      {options.map((o) => (
        <button
          key={o.key}
          type="button"
          onClick={() => onChange(o.key)}
          className={cn(
            "rounded-full px-2 py-1",
            o.key === value ? "bg-zinc-100 text-zinc-900" : "text-zinc-300"
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
