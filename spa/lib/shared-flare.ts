"use client"

import { useEffect, useState, useSyncExternalStore } from "react"
import { fetchPublicFlare, type PublicMapPin } from "@/lib/api/public-map"

// A shared flare link: `/?flare=<id>`. A signed-out visitor lands on the map
// centred on that open-to-all flare with its card open; joining asks them to
// sign up and then lands them on the flare (/event/<id>). A signed-in visitor
// goes straight to the flare. The map only ever learns what a pin shows
// (#425): category, place and time.

export const SHARED_FLARE_PARAM = "flare"

const OBJECT_ID = /^[0-9a-f]{24}$/i

/** The link to share for a flare, as a path on this app. */
export function sharedFlarePath(id: string): string {
  return `/?${SHARED_FLARE_PARAM}=${encodeURIComponent(id)}`
}

/** The flare's own page, where a visitor lands after signing up. */
export function flarePagePath(id: string): string {
  return `/event/${encodeURIComponent(id)}`
}

/** A well-formed id from `search` (a URL query string), or null. */
export function parseSharedFlareId(search: string): string | null {
  const id = new URLSearchParams(search).get(SHARED_FLARE_PARAM)
  return id && OBJECT_ID.test(id) ? id : null
}

const noSubscribe = () => () => {}

/** The shared flare id in the current URL, read once the page is in the
 * browser (null on the server render). */
export function useSharedFlareId(): string | null {
  return useSyncExternalStore(
    noSubscribe,
    () => parseSharedFlareId(window.location.search),
    () => null
  )
}

export type SharedFlareState =
  | { status: "none" }
  | { status: "loading"; id: string }
  | { status: "found"; id: string; pin: PublicMapPin }
  /** Not open to all, over, or never was: the api doesn't say which. */
  | { status: "gone"; id: string }

/** The shared flare in the URL, looked up through the public endpoint. */
export function useSharedFlare(): SharedFlareState {
  const id = useSharedFlareId()
  const [result, setResult] = useState<{
    id: string
    pin: PublicMapPin | null
  } | null>(null)

  useEffect(() => {
    if (!id) return
    const controller = new AbortController()
    fetchPublicFlare(id, controller.signal)
      .then((pin) => {
        if (!controller.signal.aborted) setResult({ id, pin })
      })
      .catch(() => {
        if (!controller.signal.aborted) setResult({ id, pin: null })
      })
    return () => controller.abort()
  }, [id])

  if (!id) return { status: "none" }
  if (result?.id !== id) return { status: "loading", id }
  return result.pin
    ? { status: "found", id, pin: result.pin }
    : { status: "gone", id }
}

/** The flare id in a flare page path (`/event/<id>`), or null. */
export function flareIdFromPath(pathname: string): string | null {
  const match = /^\/event\/([0-9a-f]{24})\/?$/i.exec(pathname)
  return match ? match[1] : null
}
