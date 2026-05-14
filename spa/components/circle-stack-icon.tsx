import { CircleType } from "@/lib/circles"
// inner = single inner dot. close = two side-by-side. all = three forming

// a triangle. Reads as concentric rings expanding outward from the user.
const PATTERNS: Record<CircleType, { cx: number; cy: number; r: number }[]> = {
  inner: [{ cx: 12, cy: 12, r: 4.5 }],
  close: [
    { cx: 9.5, cy: 12, r: 4 },
    { cx: 14.5, cy: 12, r: 4 },
  ],
  all: [
    { cx: 12, cy: 8.5, r: 3.5 },
    { cx: 8.5, cy: 14.5, r: 3.5 },
    { cx: 15.5, cy: 14.5, r: 3.5 },
  ],
}

export function CircleStackIcon({
  type,
  className,
}: {
  type: CircleType
  className?: string
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      {PATTERNS[type].map((c) => (
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
