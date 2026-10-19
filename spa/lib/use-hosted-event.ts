"use client"

// One flare, loaded by id for the flare page and the flare drawer (#615).

import { useEffect, useRef, useState } from "react"
import { fetchHostedEventById, type HostedEvent } from "@/lib/api/events"
import { useRefetchOnFocus } from "@/lib/use-refetch-on-focus"

export type HostedEventState = {
  event: HostedEvent | null
  loading: boolean
  error: string | null
  setEvent: (
    update: (current: HostedEvent | null) => HostedEvent | null
  ) => void
  /** Refetches without the loading state, e.g. after joining. */
  reload: () => void
}

/** Pass null to load nothing (a closed drawer). */
export function useHostedEvent(id: string | null): HostedEventState {
  const [event, setEvent] = useState<HostedEvent | null>(null)
  const [loading, setLoading] = useState(id !== null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    const ac = new AbortController()

    queueMicrotask(() => {
      if (ac.signal.aborted) return
      setLoading(true)
      setError(null)
    })

    fetchHostedEventById(id, ac.signal)
      .then((nextEvent) => {
        setEvent(nextEvent)
        setLoading(false)
      })
      .catch((err) => {
        if (ac.signal.aborted) return
        setEvent(null)
        setError(err instanceof Error ? err.message : "could not load flare")
        setLoading(false)
      })

    return () => ac.abort()
  }, [id])

  // Refetch when the tab/app regains focus (#158): otherwise the guest list
  // and rsvp count only catch up with another account's changes once this
  // remounts. Deliberately doesn't touch `loading`/`error` so it doesn't
  // flash the loading state on a background refresh.
  const refetchAbortRef = useRef<AbortController | null>(null)
  useEffect(() => {
    return () => refetchAbortRef.current?.abort()
  }, [])
  const reload = () => {
    if (!id) return
    refetchAbortRef.current?.abort()
    const ac = new AbortController()
    refetchAbortRef.current = ac
    fetchHostedEventById(id, ac.signal)
      .then(setEvent)
      .catch((err) => {
        if (ac.signal.aborted) return
        console.warn("[Sponti] event refetch failed:", err)
      })
  }
  useRefetchOnFocus(reload)

  // A different flare than the one loaded is still loading.
  const current = event && id && event.id === id ? event : null
  return {
    event: current,
    loading: id !== null && (loading || (!current && !error)),
    error,
    setEvent,
    reload,
  }
}
