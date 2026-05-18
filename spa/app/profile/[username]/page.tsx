"use client"

import { use, useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, MoreHorizontal } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { initials } from "@/lib/circles"
import {
  blockConnection as blockConnectionAction,
  cancelSentRequest as cancelSentRequestAction,
  unblock as unblockAction,
  useConnectionsState,
} from "@/lib/connections-store"

type RelationshipState = "connected" | "sent" | "blocked" | "stranger"

export default function PublicProfilePage({
  params,
}: {
  params: Promise<{ username: string }>
}) {
  const { username } = use(params)
  const router = useRouter()
  const { connections, sentRequests, blocked } = useConnectionsState()
  const [showBlockConfirm, setShowBlockConfirm] = useState(false)

  const connection = connections.find((c) => c.username === username)
  const sentRequest = sentRequests.find((r) => r.username === username)
  const blockedUser = blocked.find((b) => b.username === username)

  const person = connection ?? sentRequest ?? blockedUser

  const relationship: RelationshipState = connection
    ? "connected"
    : sentRequest
      ? "sent"
      : blockedUser
        ? "blocked"
        : "stranger"

  return (
    <div className="min-h-dvh w-full bg-background flex flex-col relative">
      <div className="flex items-center justify-between px-4 py-3 shrink-0 border-b border-border">
        <button
          onClick={() => router.back()}
          aria-label="Back"
          className="h-9 w-9 rounded-full border border-border flex items-center justify-center"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <span className="text-base font-semibold">profile</span>
        {relationship === "connected" ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label="options"
                className="h-9 w-9 rounded-full border border-border flex items-center justify-center"
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

      <div className="flex-1 flex flex-col items-center px-4 pt-10 gap-4">
        <span className="h-20 w-20 rounded-full bg-accent/10 text-accent border border-accent/20 flex items-center justify-center text-2xl font-semibold">
          {person ? initials(person.displayName) : "?"}
        </span>

        {person ? (
          <div className="text-center">
            <p className="text-xl font-semibold">{person.displayName}</p>
            <p className="text-sm text-muted-foreground mt-0.5">@{person.username}</p>
          </div>
        ) : (
          <div className="text-center">
            <p className="text-xl font-semibold">@{username}</p>
            <p className="text-sm text-muted-foreground mt-0.5">user not found</p>
          </div>
        )}

        <div className="mt-2">
          {relationship === "sent" && sentRequest && (
            <Button
              variant="outline"
              onClick={() => {
                cancelSentRequestAction(sentRequest.id)
                router.back()
              }}
              className="rounded-full px-6"
            >
              cancel request
            </Button>
          )}
          {relationship === "blocked" && blockedUser && (
            <Button
              variant="outline"
              onClick={() => {
                unblockAction(blockedUser.id)
                router.back()
              }}
              className="rounded-full px-6"
            >
              unblock
            </Button>
          )}
        </div>
      </div>

      {showBlockConfirm && connection && (
        <div
          className="absolute inset-0 z-20 flex items-end bg-(--scrim)"
          onClick={() => setShowBlockConfirm(false)}
        >
          <div
            className="w-full rounded-t-2xl bg-card p-5 flex flex-col gap-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div>
              <p className="text-base font-semibold">block {connection.displayName}?</p>
              <p className="text-sm text-muted-foreground mt-1">
                They won&apos;t appear in your circles or see your flares. You can unblock
                them later from the blocked tab.
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <Button
                onClick={() => {
                  blockConnectionAction(connection)
                  router.back()
                }}
                className="rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90 w-full"
              >
                block
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowBlockConfirm(false)}
                className="rounded-full w-full"
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
