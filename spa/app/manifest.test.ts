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

// JPEG width/height live in the first start-of-frame segment (SOF0-SOF15,
// except DHT/JPG/DAC): height at +5, width at +7.
function jpegSize(file: string) {
  const buf = readFileSync(file)
  let at = 2
  while (at < buf.length) {
    const marker = buf[at + 1]
    const sof =
      marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)
    if (sof)
      return {
        width: buf.readUInt16BE(at + 7),
        height: buf.readUInt16BE(at + 5),
      }
    at += 2 + buf.readUInt16BE(at + 2)
  }
  return null
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

describe("brand images (#558)", () => {
  const appDir = __dirname

  it("has a 180px apple icon and a multi-size favicon", () => {
    expect(pngSize(path.join(publicDir, "apple-icon.png"))).toEqual({
      width: 180,
      height: 180,
    })
    const ico = readFileSync(path.join(appDir, "favicon.ico"))
    expect(ico.readUInt16LE(2)).toBe(1) // icon type
    expect(ico.readUInt16LE(4)).toBeGreaterThanOrEqual(2) // 16 and 32 at least
  })

  it("serves one static 1200x630 link-preview image for og and twitter", () => {
    for (const name of ["opengraph-image", "twitter-image"]) {
      const file = path.join(appDir, `${name}.jpg`)
      expect(jpegSize(file)).toEqual({ width: 1200, height: 630 })
      // WhatsApp and Telegram drop preview images much over 300 KB.
      expect(readFileSync(file).length).toBeLessThan(300_000)
      expect(existsSync(path.join(appDir, `${name}.alt.txt`))).toBe(true)
      // The generated routes would shadow the static files.
      expect(existsSync(path.join(appDir, `${name}.tsx`))).toBe(false)
    }
  })
})
