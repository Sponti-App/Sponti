import { existsSync, readFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"
import manifest from "./manifest"

const publicDir = path.resolve(__dirname, "..", "public")
const HEX = /^#[0-9a-f]{6}$/i

// PNG width/height live in the IHDR chunk, right after the 8-byte signature
// and the chunk length/type (bytes 16-23).
function pngSize(file: string) {
  const buf = readFileSync(file)
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) }
}

describe("web app manifest (#131)", () => {
  const m = manifest()

  it("is installable as a standalone app named sponti", () => {
    expect(m.name).toBe("sponti")
    expect(m.short_name).toBe("sponti")
    expect(m.start_url).toBe("/")
    expect(m.display).toBe("standalone")
  })

  it("uses valid hex brand colours", () => {
    expect(m.background_color).toMatch(HEX)
    expect(m.theme_color).toMatch(HEX)
  })

  it("declares 192, 512 and maskable 512 icons that exist at their declared size", () => {
    const icons = m.icons ?? []
    const declared = icons.map((i) => `${i.sizes}:${i.purpose}`).sort()
    expect(declared).toEqual(["192x192:any", "512x512:any", "512x512:maskable"])

    for (const icon of icons) {
      const file = path.join(publicDir, icon.src)
      expect(existsSync(file), `${icon.src} exists in public/`).toBe(true)
      const [w, h] = (icon.sizes ?? "").split("x").map(Number)
      expect(pngSize(file)).toEqual({ width: w, height: h })
      expect(icon.type).toBe("image/png")
    }
  })
})
