"use client"

// A flare's thread of short updates (#140). Minimal on purpose: #162 restyles
// it and moves "share an update" to the main button. Only rendered for the
// host and going guests; everyone else gets `EventThreadLocked`.

import { useCallback, useEffect, useRef, useState } from "react"
import { Lock, Send, Trash2 } from "lucide-react"
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

export function EventThread({
  eventId,
  closedNote,
}: {
  eventId: string
  /** Set when the flare is cancelled or has ended: the thread is read-only. */
  closedNote?: string | null
}) {
  const [updates, setUpdates] = useState<EventUpdate[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [draft, setDraft] = useState("")
  const [posting, setPosting] = useState(false)
  const [postError, setPostError] = useState<string | null>(null)
  const [closedByServer, setClosedByServer] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  const load = useCallback(() => {
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
  }, [eventId])

  useEffect(() => {
    queueMicrotask(load)
    return () => abortRef.current?.abort()
  }, [load])

  useRefetchOnFocus(load)

  const trimmed = draft.trim()
  const isClosed = Boolean(closedNote) || closedByServer
  const canSubmit =
    !posting && trimmed.length > 0 && trimmed.length <= EVENT_UPDATE_MAX_LENGTH

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!canSubmit) return
    setPosting(true)
    setPostError(null)
    try {
      const created = await postEventUpdate(eventId, trimmed)
      setUpdates((current) => [...current, created])
      setDraft("")
    } catch (err) {
      if (err instanceof HttpError && err.code === "EVENT_THREAD_CLOSED") {
        setClosedByServer(true)
      } else if (err instanceof HttpError && err.status === 403) {
        setPostError("only the host and people going can post")
      } else {
        setPostError("couldn't post that, try again")
      }
    } finally {
      setPosting(false)
    }
  }

  const remove = async (updateId: string) => {
    const previous = updates
    setUpdates((current) => current.filter((u) => u._id !== updateId))
    try {
      await deleteEventUpdate(eventId, updateId)
    } catch {
      setUpdates(previous)
      setPostError("couldn't delete that, try again")
    }
  }

  return (
    <section className="pt-4">
      {loading ? (
        <p className="text-sm text-muted-foreground">loading updates...</p>
      ) : error ? (
        <p className="text-sm text-muted-foreground" role="alert">
          {error}
        </p>
      ) : updates.length === 0 ? (
        <p className="text-sm text-muted-foreground">no updates yet.</p>
      ) : (
        <ol className="flex flex-col gap-3.5">
          {updates.map((update) => (
            <EventUpdateRow
              key={update._id}
              update={update}
              onDelete={() => void remove(update._id)}
            />
          ))}
        </ol>
      )}

      <div className="mt-4">
        {isClosed ? (
          <p className="rounded-xl border border-border bg-card px-3 py-2 text-xs text-muted-foreground">
            {closedNote ?? "this flare is closed · the thread is read-only"}
          </p>
        ) : (
          <form onSubmit={(e) => void submit(e)}>
            <div className="flex items-center gap-2 rounded-full bg-secondary py-1 pr-1.5 pl-3">
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                maxLength={EVENT_UPDATE_MAX_LENGTH}
                placeholder="share an update..."
                aria-label="update"
                className="min-w-0 flex-1 bg-transparent py-2 text-sm outline-none"
              />
              <button
                type="submit"
                aria-label="post update"
                disabled={!canSubmit}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground disabled:opacity-50"
              >
                <Send className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="mt-1 flex justify-between px-3 text-xs text-muted-foreground">
              <span role={postError ? "alert" : undefined}>
                {postError ?? ""}
              </span>
              <span>
                {draft.length}/{EVENT_UPDATE_MAX_LENGTH}
              </span>
            </div>
          </form>
        )}
      </div>
    </section>
  )
}

function EventUpdateRow({
  update,
  onDelete,
}: {
  update: EventUpdate
  onDelete: () => void
}) {
  const name = (
    update.author.displayName ||
    update.author.username ||
    "guest"
  ).toLowerCase()
  const age = formatRelative(update.createdAt)

  return (
    <li className="flex gap-2.5">
      <Avatar className="size-[30px]">
        {update.author.avatarUrl && (
          <AvatarImage src={update.author.avatarUrl} alt="" />
        )}
        <AvatarFallback className="text-xs">{initials(name)}</AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-muted-foreground">
          <span className="font-semibold text-foreground">{name}</span> ·{" "}
          {age === "now" ? "now" : `${age} ago`}
        </p>
        <p className="mt-1 text-sm leading-relaxed break-words whitespace-pre-wrap text-muted-foreground">
          {update.body}
        </p>
      </div>
      {update.canDelete && (
        <button
          type="button"
          onClick={onDelete}
          aria-label="delete update"
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-secondary"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      )}
    </li>
  )
}

/** What everyone but the host and going guests sees: a count, not the text. */
export function EventThreadLocked({ count }: { count: number }) {
  if (count <= 0) return null

  return (
    <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
      <Lock className="h-3.5 w-3.5" />
      {count === 1 ? "1 update" : `${count} updates`} · join to see
    </p>
  )
}
