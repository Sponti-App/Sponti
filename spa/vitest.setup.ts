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
