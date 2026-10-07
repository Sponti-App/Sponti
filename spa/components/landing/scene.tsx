"use client"

import Image from "next/image"
import type { ReactNode } from "react"
import { LANDING_SCENES, type LandingSceneName } from "@/lib/landing-art"
import { cn } from "@/lib/utils"

/**
 * One of the brand scenes (lib/landing-art.ts), covering its box. The image
 * sits in a box of its own ratio (`lp-scene-box`), so the soft blooms placed
 * on its painted light, and any `children` placed in % of the image, stay on
 * their spot at every viewport size. `move` replaces the box's centring
 * transform (parallax, pan). A scene's `layers` stack over its image, each
 * moving by its depth: `--mx` / `--my` (the cursor) and `--p` (the scroll)
 * from an ancestor drive them, so they shift against each other.
 */
export function Scene({
  name,
  className,
  move = "translate(-50%, -50%)",
  priority = false,
  sizes = "100vw",
  children,
}: {
  name: LandingSceneName
  className?: string
  move?: string
  priority?: boolean
  sizes?: string
  children?: ReactNode
}) {
  const scene = LANDING_SCENES[name]
  return (
    <div
      data-landing-scene={name}
      className={cn("lp-scene relative overflow-hidden", className)}
      style={{ ["--ratio" as string]: scene.ratio }}
    >
      <div
        className="lp-scene-box absolute top-1/2 left-1/2 transition-transform duration-300 ease-out"
        style={{ transform: move }}
      >
        <Image
          src={scene.src}
          alt={scene.alt}
          fill
          priority={priority}
          sizes={sizes}
          className="object-cover"
        />
        {scene.layers?.map((layer) => (
          <div
            key={layer.src}
            aria-hidden="true"
            className="absolute inset-0 transition-transform duration-300 ease-out"
            style={{
              transform: `translate3d(calc(var(--mx, 0) * ${layer.depth * 24}px), calc(var(--my, 0) * ${layer.depth * 16}px + (var(--p, 0.5) - 0.5) * ${layer.depth * -120}px), 0) scale(${1 + layer.depth * 0.04})`,
            }}
          >
            <Image
              src={layer.src}
              alt=""
              fill
              priority={priority}
              sizes={sizes}
              className="object-cover"
            />
          </div>
        ))}
        {scene.glow.map((g, i) => (
          <span
            key={i}
            aria-hidden="true"
            className="lp-bloom"
            style={{
              left: `${g.x}%`,
              top: `${g.y}%`,
              width: `${g.size}%`,
              animationDelay: `${i * -1.5}s`,
            }}
          />
        ))}
        {children}
      </div>
    </div>
  )
}
