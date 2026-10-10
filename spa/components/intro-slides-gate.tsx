"use client"

// #377 (behind `introV2`): mounts the intro slides over the signed-out home
// on this device's first open. The slides and their art load only when they
// are about to show, so neither the signed-in path nor a returning visitor
// downloads them. Until the chunk arrives a plain cover hides the map, so a
// first-time visitor doesn't see it flash before the slides.

import dynamic from "next/dynamic"
import { createPortal } from "react-dom"
import {
  INTRO_INK,
  markIntroSlidesSeen,
  useShowIntroSlides,
} from "@/lib/intro-slides"

const IntroSlides = dynamic(
  () => import("@/components/intro-slides").then((m) => m.IntroSlides),
  {
    ssr: false,
    loading: () =>
      createPortal(
        <div
          aria-hidden
          className="fixed inset-0 z-[55]"
          style={{ backgroundColor: INTRO_INK }}
        />,
        document.body
      ),
  }
)

export function IntroSlidesGate() {
  const show = useShowIntroSlides()
  if (!show) return null
  return <IntroSlides onLeave={markIntroSlidesSeen} />
}
