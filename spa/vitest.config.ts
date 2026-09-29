import path from "node:path"
import { configDefaults, defineConfig } from "vitest/config"

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname),
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    // spa/e2e holds Playwright specs (real browser, network-stubbed) — a
    // different runner with its own config. Vitest's default include glob
    // would otherwise pick up e2e/**/*.spec.ts and try to run them in jsdom.
    // Spread Vitest's own defaults rather than replacing them outright, or
    // this silently drops node_modules/dist/etc. from the exclude list too.
    exclude: [...configDefaults.exclude, "e2e/**"],
  },
})
