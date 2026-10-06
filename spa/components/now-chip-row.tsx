// The adapter module itself, not the "@/lib/api/events" barrel that tests mock.
import {
  DURATIONS_MIN,
  NOW_START_OFFSETS_MIN,
  OPEN_ENDED,
} from "@/lib/api/events/events.adapter"

// The "starts" chips of a "right now" flare (#312): a short delay after it is
// lit. Shared by the composer and the edit page (#330).
const NOW_START_LABELS: Record<(typeof NOW_START_OFFSETS_MIN)[number], string> =
  { 0: "now", 15: "15m", 30: "30m", 60: "1h" }

export const NOW_START_PRESETS: { value: number; label: string }[] =
  NOW_START_OFFSETS_MIN.map((value) => ({
    value,
    label: NOW_START_LABELS[value],
  }))

// The "how long?" chips (#340): "pick a time" and a scheduled flare's edit
// page offer DURATION_PRESETS; the "right now" flow, in the composer and on
// the edit page, adds "open".
const DURATION_LABELS: Record<(typeof DURATIONS_MIN)[number], string> = {
  30: "30m",
  60: "1h",
  120: "2h",
  180: "3h",
  240: "4h",
}

export const DURATION_PRESETS: { value: number; label: string }[] =
  DURATIONS_MIN.map((value) => ({ value, label: DURATION_LABELS[value] }))

export const NOW_DURATION_PRESETS: { value: number; label: string }[] = [
  ...DURATION_PRESETS,
  { value: OPEN_ENDED, label: "open" },
]

/**
 * One row of compact chips for the "right now" flow: a labelled group of
 * toggle buttons, scrolling sideways when it doesn't fit. `isDisabled` greys
 * out single chips (the edit page uses it for starts already in the past).
 * A `value` of null selects no chip.
 */
export function NowChipRow({
  ariaLabel,
  presets,
  value,
  onChange,
  isDisabled,
}: {
  ariaLabel: string
  presets: { value: number; label: string }[]
  value: number | null
  onChange: (v: number) => void
  isDisabled?: (v: number) => boolean
}) {
  return (
    <div className="-mx-4 no-scrollbar overflow-x-auto px-4">
      <div role="group" aria-label={ariaLabel} className="flex gap-2">
        {presets.map((p) => {
          const selected = value === p.value
          return (
            <button
              key={p.value}
              type="button"
              aria-pressed={selected}
              onClick={() => onChange(p.value)}
              disabled={isDisabled?.(p.value)}
              className={`shrink-0 rounded-full border px-3 py-1.5 text-xs transition-colors disabled:opacity-40 ${
                selected
                  ? "border-accent bg-accent/10 font-medium text-accent-ink"
                  : "border-border text-foreground hover:bg-secondary"
              }`}
            >
              {p.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
