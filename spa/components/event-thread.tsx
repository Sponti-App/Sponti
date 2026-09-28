"use client"

// A flare's thread of short updates (#140), placed by the layout D detail
// page (#139): the list sits in the "updates" tab and the composer takes over
// the pinned action bar when the host or a going guest taps "share an
// update". `useEventThread` owns the data so both halves stay in sync.
// Everyone else gets `EventThreadLocked`.

import { forwardRef, useCallback, useEffect, useRef, useState } from "react"
import { Lock, Megaphone, Send, Trash2, X } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { initials } from "@/components/event-avatar-stack"
import {
  deleteEventUpdate,
  fetchEventUpdates,
  postEventUpdate,
  type EventUpdate,
} from "@/lib/api/events"
import { HttpError } from "@/lib/http"
import { formatRelative } from "@/lib/notifications"
import { useRefetchOnFocus } from "@/lib/use-refetch-on-focus"

export const EVENT_UPDATE_MAX_LENGTH = 500

export type EventThreadState = {
  updates: EventUpdate[]
  loading: boolean
  error: string | null
  /** The server said the flare is cancelled or has ended. */
  closedByServer: boolean
  /** Resolves true once posted; false with `postError` set otherwise. */
  post: (body: string) => Promise<boolean>
  posting: boolean
  postError: string | null
  remove: (updateId: string) => void
}

/**
 * Loads a flare's thread (on mount and on focus) and posts/deletes updates.
 * Pass `enabled: false` for viewers who can't read it: nothing is fetched.
 */
export function useEventThread(
  eventId: string,
  { enabled = true }: { enabled?: boolean } = {}
): EventThreadState {
  const [updates, setUpdates] = useState<EventUpdate[]>([])
  const [loading, setLoading] = useState(enabled)
  const [error, setError] = useState<string | null>(null)
  const [posting, setPosting] = useState(false)
  const [postError, setPostError] = useState<string | null>(null)
  const [closedByServer, setClosedByServer] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  const load = useCallback(() => {
    if (!enabled) return
    abortRef.current?.abort()
    const ac = new AbortController()
    abortRef.current = ac
    fetchEventUpdates(eventId, ac.signal)
      .then((next) => {
        setUpdates(next)
        setError(null)
        setLoading(false)
      })
      .catch((err) => {
        if (ac.signal.aborted) return
        setError(
          err instanceof HttpError && err.status === 403
            ? "only the host and people going can see updates"
            : "couldn't load updates"
        )
        setLoading(false)
      })
  }, [eventId, enabled])

  useEffect(() => {
    queueMicrotask(load)
    return () => abortRef.current?.abort()
  }, [load])

  useRefetchOnFocus(load, { enabled })

  const post = async (body: string): Promise<boolean> => {
    const trimmed = body.trim()
    if (posting || trimmed.length === 0) return false
    setPosting(true)
    setPostError(null)
    try {
      const created = await postEventUpdate(eventId, trimmed)
      setUpdates((current) => [...current, created])
      return true
    } catch (err) {
      if (err instanceof HttpError && err.code === "EVENT_THREAD_CLOSED") {
        setClosedByServer(true)
        setPostError("this flare is closed · the thread is read-only")
      } else if (err instanceof HttpError && err.status === 403) {
        setPostError("only the host and people going can post")
      } else {
        setPostError("couldn't post that, try again")
      }
      return false
    } finally {
      setPosting(false)
    }
  }

  const remove = (updateId: string) => {
    const previous = updates
    setUpdates((current) => current.filter((u) => u._id !== updateId))
    deleteEventUpdate(eventId, updateId).catch(() => {
      setUpdates(previous)
      setPostError("couldn't delete that, try again")
    })
  }

  return {
    updates,
    loading,
    error,
    closedByServer,
    post,
    posting,
    postError,
    remove,
  }
}

/** The updates, oldest first. The host's read as announcements. */
export function EventThreadList({
  thread,
  hostId,
  viewerId,
  closedNote,
}: {
  thread: EventThreadState
  hostId?: string
  viewerId?: string
  /** Set when the flare is cancelled or has ended: the thread is read-only. */
  closedNote?: string | null
}) {
  const { updates, loading, error, closedByServer } = thread
  const note =
    closedNote ??
    (closedByServer ? "this flare is closed · the thread is read-only" : null)

  return (
    <section>
      {loading ? (
        <p className="text-sm text-muted-foreground">loading updates...</p>
      ) : error ? (
        <p className="text-sm text-muted-foreground" role="alert">
          {error}
        </p>
      ) : updates.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          no updates yet. say where you&apos;re sitting, or that you&apos;re
          running late.
        </p>
      ) : (
        <ol className="flex flex-col gap-3">
          {updates.map((update) => (
            <EventUpdateRow
              key={update._id}
              update={update}
              fromHost={Boolean(hostId) && update.authorId === hostId}
              byViewer={Boolean(viewerId) && update.authorId === viewerId}
              onDelete={() => thread.remove(update._id)}
            />
          ))}
        </ol>
      )}

      {note && (
        <p className="mt-4 rounded-xl border border-border bg-card px-3 py-2 text-xs text-muted-foreground">
          {note}
        </p>
      )}
    </section>
  )
}

function EventUpdateRow({
  update,
  fromHost,
  byViewer,
  onDelete,
}: {
  update: EventUpdate
  fromHost: boolean
  byViewer: boolean
  onDelete: () => void
}) {
  const name = (
    update.author.displayName ||
    update.author.username ||
    "guest"
  ).toLowerCase()
  const firstName = name.split(" ")[0]
  const relative = formatRelative(update.createdAt)
  const age = relative === "now" ? "now" : `${relative} ago`
  const deleteButton = update.canDelete && (
    <button
      type="button"
      onClick={onDelete}
      aria-label="delete update"
      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-secondary"
    >
      <Trash2 className="h-3.5 w-3.5" />
    </button>
  )
  const body = (
    <p className="mt-0.5 text-sm leading-relaxed break-words whitespace-pre-wrap">
      {update.body}
    </p>
  )

  if (fromHost) {
    return (
      <li className="flex gap-2 rounded-xl border-l-[3px] border-l-accent bg-card px-3 py-2">
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Megaphone className="h-3.5 w-3.5 text-accent" />
            <span className="font-semibold text-foreground">
              {byViewer ? "your announcement" : `announcement from ${firstName}`}
            </span>
            · {age}
          </p>
          {body}
        </div>
        {deleteButton}
      </li>
    )
  }

  return (
    <li className="flex gap-2.5">
      <Avatar className="size-7">
        {update.author.avatarUrl && (
          <AvatarImage src={update.author.avatarUrl} alt="" />
        )}
        <AvatarFallback className="text-xs">{initials(name)}</AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-muted-foreground">
          <span className="font-semibold text-foreground">
            {byViewer ? "you" : firstName}
          </span>{" "}
          · {age}
        </p>
        {body}
      </div>
      {deleteButton}
    </li>
  )
}

/**
 * The composer, shown in the pinned action bar. Closes itself (via
 * `onClose`) after a post, or when it loses focus while empty.
 */
export const EventThreadComposer = forwardRef<
  HTMLInputElement,
  {
    thread: EventThreadState
    placeholder: string
    onClose: () => void
  }
>(function EventThreadComposer({ thread, placeholder, onClose }, ref) {
  const [draft, setDraft] = useState("")
  const trimmed = draft.trim()
  const canSubmit =
    !thread.posting &&
    trimmed.length > 0 &&
    trimmed.length <= EVENT_UPDATE_MAX_LENGTH
  const nearLimit = draft.length > EVENT_UPDATE_MAX_LENGTH - 100

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!canSubmit) return
    if (await thread.post(trimmed)) {
      setDraft("")
      onClose()
    }
  }

  return (
    <form onSubmit={(e) => void submit(e)}>
      <div className="flex items-center gap-1.5 rounded-full bg-muted py-1 pr-1 pl-1">
        <button
          type="button"
          aria-label="close composer"
          onClick={onClose}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted-foreground"
        >
          <X className="h-4 w-4" />
        </button>
        <input
          ref={ref}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={(e) => {
            // Tapping send or close blurs the input first; let those win.
            const next = e.relatedTarget as HTMLElement | null
            if (next?.closest("form") === e.currentTarget.form) return
            if (!draft.trim()) onClose()
          }}
          maxLength={EVENT_UPDATE_MAX_LENGTH}
          placeholder={placeholder}
          aria-label="update"
          className="min-w-0 flex-1 bg-transparent py-2 text-sm outline-none"
        />
        <button
          type="submit"
          aria-label="post update"
          disabled={!canSubmit}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground disabled:opacity-50"
        >
          <Send className="h-4 w-4" />
        </button>
      </div>
      {(thread.postError || nearLimit) && (
        <div className="mt-1 flex justify-between px-3 text-xs text-muted-foreground">
          <span role={thread.postError ? "alert" : undefined}>
            {thread.postError ?? ""}
          </span>
          {nearLimit && (
            <span>
              {draft.length}/{EVENT_UPDATE_MAX_LENGTH}
            </span>
          )}
        </div>
      )}
    </form>
  )
})

/** What everyone but the host and going guests sees: a count, not the text. */
export function EventThreadLocked({ count }: { count: number }) {
  return (
    <p className="flex items-center gap-2 rounded-xl border border-dashed border-border px-3 py-2 text-xs text-muted-foreground">
      <Lock className="h-3.5 w-3.5" />
      {count === 0
        ? "no updates yet · join to see them when they come"
        : `${count === 1 ? "1 update" : `${count} updates`} · join to see`}
    </p>
  )
}
