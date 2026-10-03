"use client"

// PROTOTYPE (#371) — throwaway. The prototype switcher: dark, monospace and
// obviously not part of the design being judged.

import { useTheme } from "next-themes"
import { cn } from "@/lib/utils"
import {
  APIS,
  BURNOUTS,
  BURSTS,
  CATEGORIES,
  COLOURS,
  GESTURES,
  MOTIONS,
  WHO,
  type Settings,
} from "./_mock"
import type { FlareMoment } from "./_stage"

export function PrototypeBar({
  settings,
  moment,
  onChange,
}: {
  settings: Settings
  moment: FlareMoment
  onChange: (next: Partial<Settings>) => void
}) {
  const { resolvedTheme, setTheme } = useTheme()

  return (
    <div className="space-y-1 bg-zinc-900 px-2 py-2 font-mono text-xs text-zinc-100">
      <Row label="gesture">
        <Seg
          options={GESTURES}
          value={settings.gesture}
          onChange={(gesture) => onChange({ gesture })}
        />
      </Row>
      <Row label="burst">
        <Seg
          options={BURSTS}
          value={settings.burst}
          onChange={(burst) => onChange({ burst })}
        />
      </Row>
      <Row label="colours">
        <Seg
          options={COLOURS}
          value={settings.colour}
          onChange={(colour) => onChange({ colour })}
        />
        {settings.colour === "pins" && (
          <Seg
            options={WHO}
            value={settings.who}
            onChange={(who) => onChange({ who })}
          />
        )}
      </Row>
      <Row label="burnout">
        <Seg
          options={BURNOUTS}
          value={settings.burnout}
          onChange={(burnout) => onChange({ burnout })}
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
      </Row>
      <Row label="api">
        <Seg
          options={APIS}
          value={settings.api}
          onChange={(api) => onChange({ api })}
        />
      </Row>
      <Row label="theme">
        <Seg
          options={[
            { key: "light", label: "light" },
            { key: "dark", label: "dark" },
          ]}
          value={resolvedTheme === "dark" ? "dark" : "light"}
          onChange={setTheme}
        />
      </Row>
      <div className="flex gap-1 overflow-x-auto pt-1">
        {CATEGORIES.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => onChange({ icon: key })}
            className={cn(
              "flex shrink-0 items-center gap-1 rounded-full px-2 py-1",
              key === settings.icon
                ? "bg-zinc-100 text-zinc-900"
                : "bg-zinc-800 text-zinc-400"
            )}
          >
            <Icon className="size-3.5" />
            {label}
          </button>
        ))}
      </div>
      <div className="flex gap-1 pt-1">
        <Action onClick={() => void moment.autoplay()}>replay (p)</Action>
        <Action
          onClick={() => void moment.burnOut()}
          disabled={moment.phase !== "lit"}
        >
          burn out (b)
        </Action>
        <Action onClick={moment.reset}>reset (r)</Action>
      </div>
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
    <div className="flex items-center gap-2">
      <span className="w-14 shrink-0 text-zinc-400">{label}</span>
      {children}
    </div>
  )
}

function Action({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex-1 rounded-full bg-zinc-800 px-2 py-1.5 text-zinc-100 disabled:text-zinc-600"
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
