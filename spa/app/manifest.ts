import type { MetadataRoute } from "next"

// Web app manifest (#131) so testers can "Add to Home Screen" and launch the
// web app standalone. Served by Next at `/manifest.webmanifest` and linked
// from every page automatically.
//
// A manifest can only carry one colour pair, so it uses the light-mode tokens;
// the per-scheme `theme-color` tags come from `viewport` in `layout.tsx`.
// Hex values are approximations of the oklch tokens in BRAND.md, converted
// oklch -> OKLab -> linear sRGB -> gamma sRGB (clipped), as in `layout.tsx`.
const BACKGROUND_COLOR = "#fdf1f7" // --background (light)
const THEME_COLOR = "#fdf1f7"

// Static export (`out/`, used by Capacitor) can only include a route handler
// that is statically rendered.
export const dynamic = "force-static"

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "sponti",
    short_name: "sponti",
    description: "light a flare and get your friends there.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: BACKGROUND_COLOR,
    theme_color: THEME_COLOR,
    // The flame icon (#558), drawn by `scripts/generate-icons.mjs`: a peach
    // full-bleed tile (no transparency) with the Phosphor flame. The
    // maskable copy is a separate file with a smaller flame, so it stays
    // inside the 80% safe zone.
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  }
}
