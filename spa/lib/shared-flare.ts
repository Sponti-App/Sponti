"use client"

import { useEffect, useState, useSyncExternalStore } from "react"
import { fetchPublicFlare, type PublicSharedFlare } from "@/lib/api/public-map"
import { featureFlags } from "@/lib/feature-flags"

// A shared flare link: `/?flare=<id>`. A signed-out visitor lands on the map
// centred on that open-to-all flare with its card open; joining asks them to
// sign up and then lands them on the flare (/event/<id>). A signed-in visitor
// goes straight to the flare. Signed out, the link shows what a pin shows
// (#425: category, place and time) plus the flare's title.

export const SHARED_FLARE_PARAM = "flare"

const OBJECT_ID = /^[0-9a-f]{24}$/i

/** The link to share for a flare, as a path on this app. */
export function sharedFlarePath(id: string): string {
  return `/?${SHARED_FLARE_PARAM}=${encodeURIComponent(id)}`
}

/**
 * Where a visitor lands on a flare after signing up, signing in or redeeming
 * an invite: the flare's page, or with the flare drawer on (#615) the home map
 * with the drawer open. Never `back=1`: closing it stays on the map rather
 * than stepping back into the sign-in pages.
 */
export function flarePagePath(id: string): string {
  return featureFlags.flareDrawer
    ? flareDrawerPath(id)
    : `/event/${encodeURIComponent(id)}`
}

/**
 * #615: where `/event/<id>` sends someone signed in while the flare drawer is
 * on: the home map with the drawer open on that flare. `tab=updates` and
 * `compose=1` carry over from the old page's links; `back=1` says the person
 * came from another page in the app, so closing the drawer goes back there.
 */
export function flareDrawerPath(
  id: string,
  { search = "", back = false }: { search?: string; back?: boolean } = {}
): string {
  const from = new URLSearchParams(search)
  const to = new URLSearchParams({ [SHARED_FLARE_PARAM]: id })
  if (from.get("tab") === "updates") to.set("tab", "updates")
  if (from.get("compose") === "1") to.set("compose", "1")
  if (back) to.set("back", "1")
  return `/?${to.toString()}`
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
  | ({ status: "found"; id: string } & PublicSharedFlare)
  /** Not open to all, over, or never was: the api doesn't say which. */
  | { status: "gone"; id: string }

/** The shared flare in the URL, looked up through the public endpoint. */
export function useSharedFlare(): SharedFlareState {
  const id = useSharedFlareId()
  const [result, setResult] = useState<{
    id: string
    flare: PublicSharedFlare | null
  } | null>(null)

  useEffect(() => {
    if (!id) return
    const controller = new AbortController()
    fetchPublicFlare(id, controller.signal)
      .then((flare) => {
        if (!controller.signal.aborted) setResult({ id, flare })
      })
      .catch(() => {
        if (!controller.signal.aborted) setResult({ id, flare: null })
      })
    return () => controller.abort()
  }, [id])

  if (!id) return { status: "none" }
  if (result?.id !== id) return { status: "loading", id }
  return result.flare
    ? { status: "found", id, ...result.flare }
    : { status: "gone", id }
}

/** The flare id in a flare page path (`/event/<id>`), or null. */
export function flareIdFromPath(pathname: string): string | null {
  const match = /^\/event\/([0-9a-f]{24})\/?$/i.exec(pathname)
  return match ? match[1] : null
}
