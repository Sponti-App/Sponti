import "@testing-library/jest-dom/vitest"

// jsdom does not implement the Pointer Capture API, which vaul calls on every
// pointerdown on the drawer. Without these the drag handlers throw and the
// error surfaces as an unhandled test error even when the assertion passed.
if (!Element.prototype.setPointerCapture) {
  Element.prototype.setPointerCapture = () => {}
}
if (!Element.prototype.releasePointerCapture) {
  Element.prototype.releasePointerCapture = () => {}
}
if (!Element.prototype.hasPointerCapture) {
  Element.prototype.hasPointerCapture = () => false
}

// Node's own global `localStorage` (unrelated to jsdom's) shadows jsdom's
// working implementation here: Vitest only re-points a window property at
// jsdom's version when Node doesn't already have one of that name, and
// recent Node versions ship a `localStorage` global that's inert without
// `--localstorage-file`. Without this, `window.localStorage` is `undefined`
// in every test, silently — auth-store.ts (and anything that persists a
// session) needs a real one to test against.
if (typeof window !== "undefined" && !window.localStorage) {
  class MemoryStorage implements Storage {
    private store = new Map<string, string>()
    get length(): number {
      return this.store.size
    }
    clear(): void {
      this.store.clear()
    }
    getItem(key: string): string | null {
      return this.store.has(key) ? this.store.get(key)! : null
    }
    key(index: number): string | null {
      return Array.from(this.store.keys())[index] ?? null
    }
    removeItem(key: string): void {
      this.store.delete(key)
    }
    setItem(key: string, value: string): void {
      this.store.set(key, String(value))
    }
  }
  Object.defineProperty(window, "localStorage", {
    value: new MemoryStorage(),
    configurable: true,
  })
}
