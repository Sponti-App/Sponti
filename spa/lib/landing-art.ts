// #506: every image on the landing page, in one place. Swapping art means
// changing an entry here, not the layout. The scenes come from the brand
// exploration (2026-10-07), compressed to WebP in public/landing/brand/.
//
// `ratio` is the image's own width / height: the landing sizes each scene's
// box from it, so nothing shifts while it loads. `glow` lists where the scene
// already has painted light (in % of the image; `size` is the bloom's width
// in % of the image), so the page can put a soft bloom on that spot.
//
// Parallax layers: a scene can also list `layers`, transparent cut-outs of the
// same canvas size as `src` (say the city, then the people up front), each
// with a `depth`. The page stacks them over `src` and moves each one by its
// depth with the cursor and the scroll: 0 stays put, 1 moves the most. Until
// a scene has layers it moves as one picture.

export type LandingGlow = { x: number; y: number; size: number }

export type LandingLayer = { src: string; depth: number }

export type LandingScene = {
  src: string
  alt: string
  ratio: number
  glow: LandingGlow[]
  layers?: LandingLayer[]
}

export const LANDING_SCENES = {
  rooftop: {
    src: "/landing/brand/rooftop.webp",
    ratio: 1536 / 1024,
    alt: "friends on a rooftop at sunset, gathered around a glowing light",
    glow: [{ x: 55.6, y: 57.8, size: 22 }],
  },
  park: {
    src: "/landing/brand/park.webp",
    ratio: 1672 / 941,
    alt: "a park by the river at sunset, small groups of friends around little lights",
    glow: [
      { x: 38.2, y: 58.5, size: 9 },
      { x: 84.8, y: 64, size: 7 },
      { x: 63.2, y: 55.5, size: 5 },
      { x: 31, y: 50.5, size: 4 },
    ],
  },
  walk: {
    src: "/landing/brand/walk.webp",
    ratio: 1122 / 1402,
    alt: "three friends and a dog walking along the river towards the sun",
    glow: [{ x: 62, y: 35.5, size: 26 }],
  },
  crowd: {
    src: "/landing/brand/crowd.webp",
    ratio: 1122 / 1402,
    alt: "a crowd with raised hands, turned towards a bright light",
    glow: [{ x: 54.5, y: 41.5, size: 30 }],
  },
} satisfies Record<string, LandingScene> as Record<
  "rooftop" | "park" | "walk" | "crowd",
  LandingScene
>

export type LandingSceneName = keyof typeof LANDING_SCENES
