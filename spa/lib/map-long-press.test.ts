import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  containerPointToLatLng,
  createLongPress,
  LONG_PRESS_MS,
  PRESSED_PLACE_FALLBACK,
  pressedPlace,
} from "./map-long-press"

const touch = (pointerId: number, x: number, y: number, target = null) => ({
  pointerId,
  pointerType: "touch",
  clientX: x,
  clientY: y,
  target,
})

describe("createLongPress (#178)", () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it("fires with the pressed point after a still hold", () => {
    const onPress = vi.fn()
    const lp = createLongPress(onPress)
    lp.onPointerDownCapture(touch(1, 100, 200))
    vi.advanceTimersByTime(LONG_PRESS_MS - 1)
    expect(onPress).not.toHaveBeenCalled()
    lp.onPointerMoveCapture(touch(1, 104, 203))
    vi.advanceTimersByTime(1)
    expect(onPress).toHaveBeenCalledExactlyOnceWith({ x: 100, y: 200 })
  })

  it("is cancelled by a pan, a lift, a second finger or pointercancel", () => {
    const onPress = vi.fn()
    const lp = createLongPress(onPress)

    lp.onPointerDownCapture(touch(1, 100, 200))
    lp.onPointerMoveCapture(touch(1, 120, 200))
    vi.advanceTimersByTime(LONG_PRESS_MS)

    lp.onPointerUpCapture(touch(1, 120, 200))
    lp.onPointerDownCapture(touch(2, 100, 200))
    lp.onPointerUpCapture(touch(2, 100, 200))
    vi.advanceTimersByTime(LONG_PRESS_MS)

    lp.onPointerDownCapture(touch(3, 100, 200))
    lp.onPointerDownCapture(touch(4, 200, 300))
    vi.advanceTimersByTime(LONG_PRESS_MS)
    lp.onPointerUpCapture(touch(3, 100, 200))
    lp.onPointerUpCapture(touch(4, 200, 300))

    lp.onPointerDownCapture(touch(5, 100, 200))
    lp.onPointerCancelCapture(touch(5, 100, 200))
    vi.advanceTimersByTime(LONG_PRESS_MS)

    expect(onPress).not.toHaveBeenCalled()
  })

  it("ignores presses on pins and buttons", () => {
    const onPress = vi.fn()
    const lp = createLongPress(onPress)
    const pin = document.createElement("button")
    const icon = document.createElement("span")
    pin.append(icon)
    lp.onPointerDownCapture({ ...touch(1, 10, 10), target: icon })
    vi.advanceTimersByTime(LONG_PRESS_MS)
    expect(onPress).not.toHaveBeenCalled()
  })

  it("a mouse fires on right-click, not on a hold; touch contextmenu is swallowed", () => {
    const onPress = vi.fn()
    const lp = createLongPress(onPress)
    const preventDefault = vi.fn()

    lp.onPointerDownCapture({ ...touch(1, 50, 60), pointerType: "mouse" })
    vi.advanceTimersByTime(LONG_PRESS_MS)
    expect(onPress).not.toHaveBeenCalled()
    lp.onContextMenuCapture({
      clientX: 50,
      clientY: 60,
      target: null,
      preventDefault,
    })
    expect(onPress).toHaveBeenCalledExactlyOnceWith({ x: 50, y: 60 })

    lp.onPointerUpCapture({ ...touch(1, 50, 60), pointerType: "mouse" })
    lp.onPointerDownCapture(touch(2, 50, 60))
    lp.onContextMenuCapture({
      clientX: 50,
      clientY: 60,
      target: null,
      preventDefault,
    })
    expect(preventDefault).toHaveBeenCalledTimes(2)
    expect(onPress).toHaveBeenCalledTimes(1)
    // The touch's own timer still fires once.
    vi.advanceTimersByTime(LONG_PRESS_MS)
    expect(onPress).toHaveBeenCalledTimes(2)
  })
})

describe("containerPointToLatLng", () => {
  const center = { lat: 52.52, lng: 13.405 }
  const size = { width: 400, height: 800 }

  it("maps the centre to the centre", () => {
    const at = containerPointToLatLng(center, 15, size, { x: 200, y: 400 })
    expect(at.lat).toBeCloseTo(center.lat, 9)
    expect(at.lng).toBeCloseTo(center.lng, 9)
  })

  it("moves east and south with x and y, at the zoom's scale", () => {
    // 256 px span 360° at zoom 0, so 256 px at zoom 15 are 360 / 2^15 deg.
    const at = containerPointToLatLng(center, 15, size, { x: 456, y: 600 })
    expect(at.lng - center.lng).toBeCloseTo(360 / 2 ** 15, 9)
    expect(at.lat).toBeLessThan(center.lat)
    // ~200 px at zoom 15 in berlin is ~580 m, about 0.0052° of latitude.
    expect(center.lat - at.lat).toBeCloseTo(0.0052, 3)
  })
})

describe("pressedPlace", () => {
  const coords = { lat: 52.5, lng: 13.4 }

  it("names the neighbourhood with the city as its address", () => {
    expect(
      pressedPlace(coords, { area: "Kreuzberg", locality: "Berlin" })
    ).toEqual({
      source: "place",
      name: "Kreuzberg",
      address: "Berlin",
      coordinates: [13.4, 52.5],
    })
  })

  it("falls back to the city, then to a dropped pin", () => {
    expect(
      pressedPlace(coords, { area: "Berlin", locality: "Berlin" })
    ).toMatchObject({ name: "Berlin", address: null })
    expect(pressedPlace(coords, null)).toMatchObject({
      name: PRESSED_PLACE_FALLBACK,
      address: null,
      coordinates: [13.4, 52.5],
    })
    expect(pressedPlace(coords, { error: "missing API key" })).toMatchObject({
      name: PRESSED_PLACE_FALLBACK,
    })
  })
})
