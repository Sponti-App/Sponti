// Regenerates the home-screen icons (#558) from the Phosphor flame, the same
// glyph as the flare button in the bottom nav (`FlameIcon`, fill weight so it
// stays legible at 16px). Peach tile, dark warm flame: the nav button's colours
// (BRAND.md; hex approximations of `--primary` / `--primary-foreground`).
//
//   node scripts/generate-icons.mjs
//
// Writes public/icon-192.png, icon-512.png, icon-maskable-512.png,
// public/apple-icon.png (180) and app/favicon.ico. The outputs are committed; run this
// only when the logo changes.
import { writeFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import sharp from "sharp"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const PEACH = "#f8b187"
const INK = "#3a2418"

// Phosphor `Flame`, fill weight, 256 x 256 viewBox. Its drawn box is
// x 40..216, y 16..232, so the glyph is centred on (128, 124).
const FLAME =
  "M173.79,51.48a221.25,221.25,0,0,0-41.67-34.34,8,8,0,0,0-8.24,0A221.25,221.25,0,0,0,82.21,51.48C54.59,80.48,40,112.47,40,144a88,88,0,0,0,176,0C216,112.47,201.41,80.48,173.79,51.48ZM96,184c0-27.67,22.53-47.28,32-54.3,9.48,7,32,26.63,32,54.3a32,32,0,0,1-64,0Z"
const GLYPH_HEIGHT = 216
const GLYPH_CENTER = { x: 128, y: 124 }

/** Full-bleed square (no transparency: iOS and maskable icons need that);
 * `glyph` is the flame's height as a share of the tile. */
function svg(size, glyph) {
  const scale = (size * glyph) / GLYPH_HEIGHT
  const tx = size / 2 - GLYPH_CENTER.x * scale
  const ty = size / 2 - GLYPH_CENTER.y * scale
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">` +
      `<rect width="${size}" height="${size}" fill="${PEACH}"/>` +
      `<path transform="translate(${tx} ${ty}) scale(${scale})" fill="${INK}" d="${FLAME}"/>` +
      `</svg>`
  )
}

const png = (size, glyph) =>
  sharp(svg(size * 4, glyph), { density: 72 })
    .resize(size, size)
    .removeAlpha()
    .png({ compressionLevel: 9 })
    .toBuffer()

// Maskable icons keep their content inside the central 80% circle (radius 0.4
// of the tile). The flame is 0.5 tall and about 0.41 wide, so it sits well in.
const outputs = [
  ["public/icon-192.png", 192, 0.6],
  ["public/icon-512.png", 512, 0.6],
  ["public/icon-maskable-512.png", 512, 0.5],
  ["public/apple-icon.png", 180, 0.6],
]
for (const [file, size, glyph] of outputs) {
  writeFileSync(path.join(root, file), await png(size, glyph))
}

// favicon.ico: PNG-compressed entries (supported by every current browser).
const sizes = [16, 32, 48]
const images = await Promise.all(sizes.map((s) => png(s, 0.7)))
const header = Buffer.alloc(6)
header.writeUInt16LE(1, 2) // type: icon
header.writeUInt16LE(images.length, 4)
let offset = header.length + 16 * images.length
const entries = images.map((data, i) => {
  const entry = Buffer.alloc(16)
  entry.writeUInt8(sizes[i], 0)
  entry.writeUInt8(sizes[i], 1)
  entry.writeUInt16LE(1, 4) // colour planes
  entry.writeUInt16LE(32, 6) // bits per pixel
  entry.writeUInt32LE(data.length, 8)
  entry.writeUInt32LE(offset, 12)
  offset += data.length
  return entry
})
writeFileSync(
  path.join(root, "app/favicon.ico"),
  Buffer.concat([header, ...entries, ...images])
)
