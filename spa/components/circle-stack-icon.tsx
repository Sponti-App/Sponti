import type { CircleTier } from "@/lib/circles"

// Tier 1 = single inner dot. Tier 2 = two side-by-side. Tier 3 = three forming
// a triangle. Reads as concentric rings expanding outward from the user.
const PATTERNS: Record<CircleTier, { cx: number; cy: number; r: number }[]> = {
  1: [{ cx: 12, cy: 12, r: 4.5 }],
  2: [
    { cx: 9.5, cy: 12, r: 4 },
    { cx: 14.5, cy: 12, r: 4 },
  ],
  3: [
    { cx: 12, cy: 8.5, r: 3.5 },
    { cx: 8.5, cy: 14.5, r: 3.5 },
    { cx: 15.5, cy: 14.5, r: 3.5 },
  ],
}

export function CircleStackIcon({
  tier,
  className,
}: {
  tier: CircleTier
  className?: string
}) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      {PATTERNS[tier].map((c) => (
        <circle
          key={`${c.cx}-${c.cy}`}
          cx={c.cx}
          cy={c.cy}
          r={c.r}
          stroke="currentColor"
          strokeWidth="1.7"
        />
      ))}
    </svg>
  )
}
