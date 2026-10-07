// PROTOTYPE (#506): the display face for direction C. Bricolage Grotesque
// with its width axis, so headlines can run condensed like the pitch deck's
// type. The app's own font load (app/layout.tsx) leaves the axis out.

import { Bricolage_Grotesque } from "next/font/google"

export const display = Bricolage_Grotesque({
  subsets: ["latin"],
  axes: ["wdth", "opsz"],
  variable: "--font-display",
})
