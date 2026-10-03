"use client"

// PROTOTYPE (#374) — throwaway. The prototype switcher: dark, monospace and
// obviously not part of the design being judged.

import { useTheme } from "next-themes"
import { cn } from "@/lib/utils"
import {
  BADGES,
  BATCHES,
  BATCHINGS,
  LATERS,
  LENGTHS,
  MOTIONS,
  OVERLAYS,
  POLLS,
  SHEET_NAVS,
  SHOWS,
  WHERES,
  type Settings,
} from "./_mock"
import type { JoinMoment } from "./_moment"

export function PrototypeBar({
  settings,
  moment,
  onChange,
  onHide,
}: {
  settings: Settings
  moment: JoinMoment
  onChange: (next: Partial<Settings>) => void
  onHide: () => void
}) {
  const { resolvedTheme, setTheme } = useTheme()

  return (
    <div className="shrink-0 space-y-1 bg-zinc-900 px-2 py-2 font-mono text-xs text-zinc-100">
      <Row label="first">
        <Seg
          options={OVERLAYS}
          value={settings.overlay}
          onChange={(overlay) => onChange({ overlay })}
        />
        <Seg
          options={LENGTHS}
          value={settings.length}
          onChange={(length) => onChange({ length })}
        />
      </Row>
      <Row label="shows">
        <Seg
          options={SHOWS}
          value={settings.shows}
          onChange={(shows) => onChange({ shows })}
        />
      </Row>
      <Row label="later">
        <Seg
          options={LATERS}
          value={settings.later}
          onChange={(later) => onChange({ later })}
        />
        <Seg
          options={BADGES}
          value={settings.badge}
          onChange={(badge) => onChange({ badge })}
        />
      </Row>
      <Row label="host on">
        <Seg
          options={WHERES}
          value={settings.where}
          onChange={(where) => onChange({ where })}
        />
      </Row>
      {settings.where === "sheet" && (
        <Row label="sheet">
          <Seg
            options={SHEET_NAVS}
            value={settings.sheet}
            onChange={(sheet) => onChange({ sheet })}
          />
        </Row>
      )}
      <Row label="batch">
        <Seg
          options={BATCHES}
          value={settings.batch}
          onChange={(batch) => onChange({ batch })}
        />
        <Seg
          options={BATCHINGS}
          value={settings.batching}
          onChange={(batching) => onChange({ batching })}
        />
        <Seg
          options={POLLS}
          value={settings.poll}
          onChange={(poll) => onChange({ poll })}
        />
      </Row>
      <Row label="motion">
        <Seg
          options={MOTIONS}
          value={settings.motion}
          onChange={(motion) => onChange({ motion })}
        />
        <span className="text-zinc-500">
          {moment.reduced ? "→ reduced" : "→ full"}
        </span>
        <Seg
          options={[
            { key: "light", label: "light" },
            { key: "dark", label: "dark" },
          ]}
          value={resolvedTheme === "dark" ? "dark" : "light"}
          onChange={setTheme}
        />
      </Row>
      <div className="flex gap-1 pt-1">
        <Action onClick={moment.playFirst}>first (p)</Action>
        <Action onClick={moment.joinNext}>next (j)</Action>
        <Action onClick={moment.reset}>reset (r)</Action>
        <Action onClick={onHide}>hide (h)</Action>
      </div>
      <p className="truncate pt-0.5 text-zinc-400">
        going {moment.guests.length} · unread {moment.unread}
        {moment.countdown !== null && ` · poll in ${moment.countdown}s`}
        {" · haptic "}
        {moment.lastHaptic ?? "–"}
        <span className="text-zinc-600"> (native only)</span>
      </p>
    </div>
  )
}

function Row({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
      <span className="w-14 shrink-0 text-zinc-400">{label}</span>
      {children}
    </div>
  )
}

function Action({
  children,
  onClick,
}: {
  children: React.ReactNode
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex-1 rounded-full bg-zinc-800 px-2 py-1.5 whitespace-nowrap text-zinc-100"
    >
      {children}
    </button>
  )
}

function Seg<T extends string>({
  options,
  value,
  onChange,
}: {
  options: readonly { key: T; label: string }[]
  value: T
  onChange: (v: T) => void
}) {
  return (
    <div className="flex rounded-full bg-zinc-800 p-0.5">
      {options.map((o) => (
        <button
          key={o.key}
          type="button"
          onClick={() => onChange(o.key)}
          className={cn(
            "rounded-full px-2 py-1 whitespace-nowrap",
            o.key === value ? "bg-zinc-100 text-zinc-900" : "text-zinc-400"
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
