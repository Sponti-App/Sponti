import { act, renderHook } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { isFarFrom, SEARCH_AREA_MIN_METERS, useIdeaArea } from "./idea-area"

const ME = { lat: 52.5, lng: 13.42 }
// About 3 km north of ME.
const NORTH = { lat: 52.527, lng: 13.42 }
// About 0.5 km north of ME.
const NEAR = { lat: 52.5045, lng: 13.42 }

describe("isFarFrom", () => {
  it("is false up to the threshold and true past it", () => {
    expect(SEARCH_AREA_MIN_METERS).toBe(1000)
    expect(isFarFrom(ME, NEAR)).toBe(false)
    expect(isFarFrom(ME, { lat: 52.5091, lng: 13.42 })).toBe(true)
  })
})

describe("useIdeaArea", () => {
  it("starts on me with no button", () => {
    const { result } = renderHook(() => useIdeaArea(ME))
    expect(result.current.ideaCenter).toEqual(ME)
    expect(result.current.canSearch).toBe(false)
  })

  it("offers the search once the map is far from the idea centre", () => {
    const { result } = renderHook(() => useIdeaArea(ME))
    act(() => result.current.onMapCenter(NEAR))
    expect(result.current.canSearch).toBe(false)
    act(() => result.current.onMapCenter(NORTH))
    expect(result.current.canSearch).toBe(true)
    // Nothing moves the ideas until the button is tapped.
    expect(result.current.ideaCenter).toEqual(ME)
  })

  it("switches the idea centre to the map centre on search and hides the button", () => {
    const { result } = renderHook(() => useIdeaArea(ME))
    act(() => result.current.onMapCenter(NORTH))
    act(() => result.current.search())
    expect(result.current.ideaCenter).toEqual(NORTH)
    expect(result.current.canSearch).toBe(false)
  })

  it("offers the search again after a further move", () => {
    const { result } = renderHook(() => useIdeaArea(ME))
    act(() => result.current.onMapCenter(NORTH))
    act(() => result.current.search())
    act(() => result.current.onMapCenter({ lat: 52.56, lng: 13.42 }))
    expect(result.current.canSearch).toBe(true)
  })

  it("goes back to me when the map comes back to me", () => {
    const { result } = renderHook(() => useIdeaArea(ME))
    act(() => result.current.onMapCenter(NORTH))
    act(() => result.current.search())
    act(() => result.current.onMapCenter(NEAR))
    expect(result.current.ideaCenter).toEqual(ME)
    expect(result.current.canSearch).toBe(false)
  })

  it("has no idea centre until there is a position", () => {
    const { result } = renderHook(() => useIdeaArea(null))
    expect(result.current.ideaCenter).toBeNull()
    act(() => result.current.onMapCenter(NORTH))
    expect(result.current.canSearch).toBe(false)
  })
})
