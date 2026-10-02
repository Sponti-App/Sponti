"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { CircleNotchIcon, XIcon } from "@/components/icons"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { initials } from "@/lib/circles"
import {
  fetchMutualFriends,
  type MutualFriends,
  type ProfileIdentity,
} from "@/lib/api/users"

// Mutual friends on someone's profile (#289): a count plus the first few
// avatars; tapping opens the full list, each row linking to that profile.
// The api sends count 0 wherever the viewer may not see them, and this
// renders nothing for that, so it can't hint at a private profile.

function PersonAvatar({
  person,
  className,
}: {
  person: ProfileIdentity
  className?: string
}) {
  return (
    <Avatar className={className}>
      {person.avatarUrl && <AvatarImage src={person.avatarUrl} alt="" />}
      <AvatarFallback className="bg-card text-xs font-semibold text-accent">
        {initials(person.displayName)}
      </AvatarFallback>
    </Avatar>
  )
}

export function MutualFriendsSummary({
  username,
  mutualFriends,
}: {
  username: string
  mutualFriends: MutualFriends
}) {
  const [open, setOpen] = useState(false)
  const { count, preview } = mutualFriends

  if (count <= 0) return null

  const label = `${count} mutual ${count === 1 ? "friend" : "friends"}`

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        className="flex items-center gap-2 rounded-full px-2 py-1 outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {preview.length > 0 && (
          <span className="flex -space-x-1" aria-hidden>
            {preview.map((person) => (
              <PersonAvatar
                key={person.id}
                person={person}
                className="size-8 ring-2 ring-background"
              />
            ))}
          </span>
        )}
        <span className="text-sm text-muted-foreground">{label}</span>
      </button>
      {open && (
        <MutualFriendsSheet
          username={username}
          label={label}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  )
}

type ListState = {
  people: ProfileIdentity[]
  page: number
  hasMore: boolean
  status: "loading" | "idle" | "error"
}

function MutualFriendsSheet({
  username,
  label,
  onClose,
}: {
  username: string
  label: string
  onClose: () => void
}) {
  const [list, setList] = useState<ListState>({
    people: [],
    page: 0,
    hasMore: true,
    status: "loading",
  })
  // The page being asked for; bumping it (or retrying) runs the effect.
  const [wantedPage, setWantedPage] = useState(1)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    const ac = new AbortController()
    fetchMutualFriends(username, wantedPage, ac.signal)
      .then((result) => {
        if (ac.signal.aborted) return
        setList((prev) => ({
          people: [...prev.people, ...result.people],
          page: wantedPage,
          hasMore: result.hasMore,
          status: "idle",
        }))
      })
      .catch(() => {
        if (!ac.signal.aborted) {
          setList((prev) => ({ ...prev, status: "error" }))
        }
      })
    return () => ac.abort()
  }, [username, wantedPage, attempt])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onClose])

  const loadMore = () => {
    setList((prev) => ({ ...prev, status: "loading" }))
    setWantedPage(list.page + 1)
    setAttempt((n) => n + 1)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end bg-(--scrim)"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="mutual friends"
        className="flex max-h-[70dvh] w-full flex-col rounded-t-3xl border-t border-border bg-card"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mt-3 mb-1 h-1.5 w-10 shrink-0 rounded-full bg-border" />
        <div className="flex shrink-0 items-center justify-between px-4 py-2">
          <p className="text-lg font-semibold">{label}</p>
          <button
            type="button"
            onClick={onClose}
            aria-label="close"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-border"
          >
            <XIcon className="h-4 w-4" />
          </button>
        </div>
        <ul className="flex-1 overflow-y-auto px-2 pb-4">
          {list.people.map((person) => (
            <li key={person.id}>
              <Link
                href={`/profile/${encodeURIComponent(person.username)}`}
                className="flex items-center gap-3 rounded-lg px-2 py-2 outline-none hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring"
              >
                <PersonAvatar person={person} className="size-10" />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">
                    {person.displayName}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    @{person.username}
                  </span>
                </span>
              </Link>
            </li>
          ))}
          {list.status === "loading" && (
            <li
              aria-label="loading mutual friends"
              className="flex justify-center py-4"
            >
              <CircleNotchIcon className="h-4 w-4 animate-spin text-muted-foreground" />
            </li>
          )}
          {list.status === "error" && (
            <li className="flex flex-col items-center gap-2 py-4">
              <p className="text-sm text-muted-foreground" role="alert">
                couldn&apos;t load the list
              </p>
              <Button
                variant="outline"
                onClick={() => {
                  setList((prev) => ({ ...prev, status: "loading" }))
                  setAttempt((n) => n + 1)
                }}
                className="rounded-full px-6"
              >
                try again
              </Button>
            </li>
          )}
          {list.status === "idle" && list.hasMore && (
            <li className="flex justify-center py-3">
              <Button
                variant="outline"
                onClick={loadMore}
                className="rounded-full px-6"
              >
                show more
              </Button>
            </li>
          )}
        </ul>
      </div>
    </div>
  )
}
