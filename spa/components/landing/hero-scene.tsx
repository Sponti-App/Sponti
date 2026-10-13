"use client"

import Image from "next/image"
import { LANDING_HERO } from "@/lib/landing-art"
import { cn } from "@/lib/utils"

// The hero's rooftop, in depth. Its image (and any cut-out layers,
// lib/landing-art.ts) sits in one box of the image's ratio, covering the frame
// like `lp-scene`, shifted so the flare sits in the middle across the
// frame (the scale's margin covers the shift). The box drifts against the cursor (`--mx`, `--my`) while
// the words over it drift with it, and as the pinned scroll (`--q`, from
// usePinProgress) runs 0 → 1 it pushes in towards the flare, the flare
// brightens, and its light spreads out from it in a widening circle until
// the frame is cream, so the page below starts inside it. Embers rise from the flare all along. Reduced motion: `--q`
// stays 0, nothing follows the cursor, and the embers are hidden.

/** How far a depth-1 layer slides against the image over the pin, in px. */
const SPREAD = 40
/** How far a depth-1 layer follows the cursor, in px. */
const POINTER = 14

// Fixed, so the server and the browser draw the same embers.
const EMBERS = [
  { dx: -3, rise: 34, size: 5, delay: 0, dur: 5.5, drift: -18 },
  { dx: 2, rise: 42, size: 3, delay: -1.2, dur: 6.5, drift: 14 },
  { dx: -1, rise: 28, size: 4, delay: -2.6, dur: 4.8, drift: 22 },
  { dx: 4, rise: 38, size: 6, delay: -3.4, dur: 7, drift: -10 },
  { dx: -5, rise: 46, size: 3, delay: -0.6, dur: 6, drift: 26 },
  { dx: 1, rise: 30, size: 5, delay: -4.1, dur: 5.2, drift: -24 },
  { dx: -2, rise: 50, size: 2, delay: -2, dur: 7.5, drift: 8 },
  { dx: 3, rise: 36, size: 4, delay: -5, dur: 5.8, drift: -6 },
  { dx: 0, rise: 44, size: 3, delay: -1.8, dur: 6.8, drift: 30 },
  { dx: -4, rise: 26, size: 5, delay: -3.9, dur: 4.6, drift: -28 },
  { dx: 5, rise: 40, size: 2, delay: -0.3, dur: 6.2, drift: 16 },
  { dx: -1, rise: 32, size: 4, delay: -4.6, dur: 5.4, drift: -14 },
]

export function HeroScene({ className }: { className?: string }) {
  const { ratio, alt, flare, layers } = LANDING_HERO
  const origin = `${flare.x}% ${flare.y}%`
  return (
    <div
      data-landing-scene="hero"
      className={cn("lp-scene overflow-hidden", className)}
      style={{ ["--ratio" as string]: ratio }}
    >
      <div
        role="img"
        aria-label={alt}
        className="lp-scene-box absolute top-1/2 left-1/2"
        style={{
          transformOrigin: origin,
          transform: `translate(calc(-50% + ${50 - flare.x}%), -50%) translate3d(calc(var(--mx, 0) * -14px), calc(var(--my, 0) * -8px), 0) scale(calc(1.06 + var(--q, 0) * 0.22))`,
        }}
      >
        {layers.map((layer) => (
          <div
            key={layer.src}
            aria-hidden="true"
            className="lp-hero-layer absolute inset-0"
            style={{
              transform: `translate3d(calc(var(--mx, 0) * ${layer.depth * -POINTER}px), calc(var(--my, 0) * ${layer.depth * -POINTER * 0.6}px + var(--q, 0) * ${-layer.depth * SPREAD}px), 0)`,
            }}
          >
            <Image
              src={layer.src}
              alt=""
              fill
              priority
              sizes="(orientation: portrait) 190vh, 120vw"
              className="object-cover"
            />
          </div>
        ))}

        {/* The flare's own light: a bloom, embers, and the wash. */}
        <span
          aria-hidden="true"
          className="lp-bloom"
          style={{
            left: `${flare.x}%`,
            top: `${flare.y}%`,
            width: "11%",
            opacity: "calc(0.7 + var(--q, 0) * 0.3)",
          }}
        />
        <span
          aria-hidden="true"
          className="absolute"
          style={{ left: `${flare.x}%`, top: `${flare.y}%` }}
        >
          {EMBERS.map((e, i) => (
            <span
              key={i}
              className="lp-ember"
              style={
                {
                  "--dx": `${e.dx}cqw`,
                  "--drift": `${e.drift}px`,
                  "--rise": `${e.rise}cqh`,
                  width: e.size,
                  height: e.size,
                  animationDelay: `${e.delay}s`,
                  animationDuration: `${e.dur}s`,
                } as React.CSSProperties
              }
            />
          ))}
        </span>
        <span
          aria-hidden="true"
          className="lp-hero-wash"
          style={{ left: `${flare.x}%`, top: `${flare.y}%` }}
        />
      </div>
    </div>
  )
}
