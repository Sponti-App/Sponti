"use client"

import { use, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, Loader2, MoreHorizontal, UserPlus } from "lucide-react"
import { useActionFeedback } from "@/components/action-feedback"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { initials } from "@/lib/circles"
import {
  deleteConnection as deleteApiConnection,
  respondToConnectionRequest,
  sendConnectionRequest,
} from "@/lib/api/connections"
import {
  blockUser as blockApiUser,
  unblockUser as unblockApiUser,
} from "@/lib/api/blocks"
import { fetchUserProfile, type UserProfile } from "@/lib/api/users"
import { HttpError } from "@/lib/http"

// Someone's profile, by username (#199): reached from a flare's host row,
// circles, or a shared link. The api decides what the viewer may see and how
// they stand with this person; a stranger gets the same display name,
// @username and photo whether the profile is public or private, and someone
// who blocked the viewer reads as not found.

type LoadState =
  | { status: "loading" }
  | { status: "ready"; data: UserProfile }
  | { status: "not-found" }
  | { status: "error" }

const RELATIONSHIP_NOTE: Partial<Record<UserProfile["relationship"], string>> =
  {
    self: "this is you",
    connected: "you're friends",
    pending_outgoing: "request sent",
    pending_incoming: "wants to be friends",
    blocked: "you blocked them",
  }

export default function PublicProfilePage({
  params,
}: {
  params: Promise<{ username: string }>
}) {
  const { username } = use(params)
  const router = useRouter()
  const { showActionFeedback } = useActionFeedback()
  const apiEnabled = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "").length > 0
  const [load, setLoad] = useState<LoadState>(
    apiEnabled ? { status: "loading" } : { status: "not-found" }
  )
  const [version, setVersion] = useState(0)
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [showBlockConfirm, setShowBlockConfirm] = useState(false)

  // Reloads after an action keep showing the current profile until the new
  // answer lands; only a retry after an error goes back to loading.
  useEffect(() => {
    if (!apiEnabled) return

    const ac = new AbortController()
    fetchUserProfile(username, ac.signal)
      .then((data) => {
        if (!ac.signal.aborted) setLoad({ status: "ready", data })
      })
      .catch((err) => {
        if (ac.signal.aborted) return
        setLoad(
          err instanceof HttpError && err.status === 404
            ? { status: "not-found" }
            : { status: "error" }
        )
      })

    return () => ac.abort()
  }, [apiEnabled, username, version])

  const data = load.status === "ready" ? load.data : null
  const person = data?.profile
  const relationship = data?.relationship
  const canBlock =
    relationship !== undefined &&
    relationship !== "self" &&
    relationship !== "blocked"

  // Runs one action; on success either leaves the page (the old behaviour
  // for cancel, block and unblock) or reloads the relationship in place.
  const act = async (
    run: () => Promise<void>,
    done: string,
    failed: string,
    after: "back" | "reload"
  ): Promise<void> => {
    setBusy(true)
    setActionError(null)
    try {
      await run()
      showActionFeedback(done)
      if (after === "back") router.back()
      else setVersion((v) => v + 1)
    } catch {
      setActionError(`${failed}. try again.`)
      showActionFeedback(failed, { tone: "error" })
    } finally {
      setBusy(false)
    }
  }

  const connect = () =>
    person &&
    void act(
      () => sendConnectionRequest(person.id),
      "request sent",
      "couldn't send request",
      "reload"
    )

  const respond = (status: "accepted" | "rejected") =>
    data?.connectionId &&
    void act(
      () => respondToConnectionRequest(data.connectionId as string, status),
      status === "accepted" ? "friend added" : "request declined",
      status === "accepted"
        ? "couldn't add friend"
        : "couldn't decline request",
      "reload"
    )

  const cancelRequest = () =>
    data?.connectionId &&
    void act(
      () => deleteApiConnection(data.connectionId as string),
      "request cancelled",
      "couldn't cancel request",
      "back"
    )

  const unblock = () =>
    person &&
    void act(
      () => unblockApiUser(person.id),
      "person unblocked",
      "couldn't unblock person",
      "back"
    )

  const block = () => {
    if (!person) return
    setShowBlockConfirm(false)
    void act(
      () => blockApiUser(person.id),
      "person blocked",
      "couldn't block person",
      "back"
    )
  }

  return (
    <div className="relative flex min-h-dvh w-full flex-col bg-background">
      <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
        <button
          onClick={() => router.back()}
          aria-label="Back"
          className="flex h-9 w-9 items-center justify-center rounded-full border border-border"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <span className="text-base font-semibold">profile</span>
        {canBlock ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label="options"
                className="flex h-9 w-9 items-center justify-center rounded-full border border-border"
              >
                <MoreHorizontal className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() => setShowBlockConfirm(true)}
                className="text-destructive focus:text-destructive"
              >
                block
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <div className="h-9 w-9" />
        )}
      </div>

      <div className="flex flex-1 flex-col items-center gap-4 px-4 pt-10 pb-28">
        {load.status === "loading" ? (
          <div
            aria-busy="true"
            aria-label="loading profile"
            className="flex flex-col items-center gap-3"
          >
            <span className="h-20 w-20 animate-pulse rounded-full bg-muted" />
            <span className="h-4 w-32 animate-pulse rounded bg-muted" />
            <span className="h-3 w-20 animate-pulse rounded bg-muted" />
          </div>
        ) : person ? (
          <>
            <Avatar className="size-20">
              {person.avatarUrl && (
                <AvatarImage src={person.avatarUrl} alt="" />
              )}
              <AvatarFallback className="bg-accent/10 text-lg font-semibold text-accent">
                {initials(person.displayName)}
              </AvatarFallback>
            </Avatar>
            <div className="text-center">
              <p className="text-lg font-semibold">{person.displayName}</p>
              <p className="mt-0.5 text-sm text-muted-foreground">
                @{person.username}
              </p>
              {relationship && RELATIONSHIP_NOTE[relationship] && (
                <p className="mt-2 text-xs text-muted-foreground">
                  {RELATIONSHIP_NOTE[relationship]}
                </p>
              )}
            </div>
          </>
        ) : (
          <>
            <span className="flex h-20 w-20 items-center justify-center rounded-full bg-muted text-lg font-semibold text-muted-foreground">
              ?
            </span>
            <div className="text-center">
              <p className="text-lg font-semibold">@{username}</p>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {load.status === "error"
                  ? "couldn't load this profile"
                  : "user not found"}
              </p>
            </div>
            {load.status === "error" && (
              <Button
                variant="outline"
                onClick={() => {
                  setLoad({ status: "loading" })
                  setVersion((v) => v + 1)
                }}
                className="rounded-full px-6"
              >
                try again
              </Button>
            )}
          </>
        )}

        {data && (
          <div className="mt-2 flex flex-col items-center gap-2">
            {relationship === "none" && (
              <Button
                onClick={connect}
                disabled={busy}
                className="rounded-full bg-accent px-6 text-accent-foreground hover:bg-accent/90"
              >
                {busy ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <UserPlus className="mr-2 h-4 w-4" />
                )}
                add friend
              </Button>
            )}
            {relationship === "pending_incoming" && data.connectionId && (
              <div className="flex gap-2">
                <Button
                  onClick={() => respond("accepted")}
                  disabled={busy}
                  className="rounded-full bg-accent px-6 text-accent-foreground hover:bg-accent/90"
                >
                  accept request
                </Button>
                <Button
                  variant="outline"
                  onClick={() => respond("rejected")}
                  disabled={busy}
                  className="rounded-full px-6"
                >
                  decline
                </Button>
              </div>
            )}
            {relationship === "pending_outgoing" && data.connectionId && (
              <Button
                variant="outline"
                onClick={cancelRequest}
                disabled={busy}
                className="rounded-full px-6"
              >
                cancel request
              </Button>
            )}
            {relationship === "blocked" && (
              <Button
                variant="outline"
                onClick={unblock}
                disabled={busy}
                className="rounded-full px-6"
              >
                unblock
              </Button>
            )}
          </div>
        )}

        {actionError && (
          <p className="text-sm text-destructive" role="alert">
            {actionError}
          </p>
        )}
      </div>

      {showBlockConfirm && person && (
        <div
          className="absolute inset-0 z-50 flex items-end bg-(--scrim)"
          onClick={() => setShowBlockConfirm(false)}
        >
          <div
            className="flex w-full flex-col gap-4 rounded-t-2xl bg-card p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div>
              <p className="text-base font-semibold">
                block {person.displayName.toLowerCase()}?
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                they won&apos;t appear in your circles or see your flares. you
                can unblock them later from the blocked tab.
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <Button
                onClick={block}
                className="text-destructive-foreground w-full rounded-full bg-destructive hover:bg-destructive/90"
              >
                block
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowBlockConfirm(false)}
                className="w-full rounded-full"
              >
                cancel
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
