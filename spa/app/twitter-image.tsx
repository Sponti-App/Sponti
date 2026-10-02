// Twitter/X reads its own `twitter-image` file convention rather than
// falling back to `opengraph-image` in every case, so this re-exports the
// same generated image (#127) to keep the Twitter card in sync with the OG
// preview without duplicating the design.
export { alt, contentType, default, size } from "./opengraph-image"
