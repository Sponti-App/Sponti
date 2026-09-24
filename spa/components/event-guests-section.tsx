"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { UserMinus, UserPlus, X } from "lucide-react"
import { useActionFeedback } from "@/components/action-feedback"
import { CircleCards, FriendList } from "@/components/new-event-drawer"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { RemoveGuestDialog } from "@/components/remove-guest-dialog"
import { fetchMyCircles } from "@/lib/api/circles"
import { fetchAcceptedConnections } from "@/lib/api/connections"
import {
  fetchEventGuests,
  inviteEventGuests,
  removeEventGuest,
  type EventGuest,
  type EventRsvp,
} from "@/lib/api/events"
import { initials, type Circle, type Connection } from "@/lib/circles"
import { cn } from "@/lib/utils"

const RSVP_ORDER: Record<EventRsvp, number> = {
  going: 0,
  invited: 1,
  declined: 2,
}

/**
 * The "who" block on edit flare: the host's view of the guest list, plus an
 * "invite more" panel reusing the composer's circle chips and friend search.
 * Invites are sent straight away (they notify people), independent of the
 * page's "save changes" button.
 */
export function EventGuestsSection({
  eventId,
  canInvite,
  canRemove = false,
}: {
  eventId: string
  canInvite: boolean
  /** Guests can be removed until the flare starts (and while it's active). */
  canRemove?: boolean
}) {
  const { showActionFeedback } = useActionFeedback()
  const [guests, setGuests] = useState<EventGuest[] | null>(null)
  const [loadError, setLoadError] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [confirming, setConfirming] = useState<EventGuest | null>(null)
  const [removingId, setRemovingId] = useState<string | null>(null)

  const loadGuests = useCallback(
    (signal?: AbortSignal) =>
      fetchEventGuests(eventId, signal)
        .then((next) => {
          setGuests(next)
          setLoadError(false)
        })
        .catch(() => {
          if (signal?.aborted) return
          setLoadError(true)
        }),
    [eventId]
  )

  useEffect(() => {
    const ac = new AbortController()
    void loadGuests(ac.signal)
    return () => ac.abort()
  }, [loadGuests])

  const guestName = (guest: EventGuest): string =>
    guest.user.displayName ?? guest.user.username ?? "guest"

  const removeGuest = async (guest: EventGuest): Promise<void> => {
    setRemovingId(guest.user._id)
    try {
      await removeEventGuest(eventId, guest.user._id)
      setConfirming(null)
      showActionFeedback(`removed ${guestName(guest)}`)
      await loadGuests()
    } catch {
      showActionFeedback(`couldn't remove ${guestName(guest)}`, {
        tone: "error",
      })
    } finally {
      setRemovingId(null)
    }
  }

  // Someone who said "going" gets a confirm step (they'll be told); anyone
  // else is removed straight away, quietly.
  const handleRemoveClick = (guest: EventGuest): void => {
    if (guest.rsvpStatus === "going") {
      setConfirming(guest)
      return
    }
    void removeGuest(guest)
  }

  if (loadError) {
    return (
      <p className="text-xs text-muted-foreground">
        couldn&apos;t load the guest list.
      </p>
    )
  }

  if (!guests) {
    return <p className="text-xs text-muted-foreground">loading guests...</p>
  }

  const sorted = [...guests].sort(
    (a, b) => RSVP_ORDER[a.rsvpStatus] - RSVP_ORDER[b.rsvpStatus]
  )

  return (
    <div className="flex flex-col gap-3">
      <GuestSummary guests={guests} />

      {sorted.length > 0 && (
        <ul className="flex flex-col gap-1">
          {sorted.map((guest) => (
            <GuestRow
              key={guest.user._id}
              guest={guest}
              onRemove={canRemove ? () => handleRemoveClick(guest) : undefined}
              removing={removingId === guest.user._id}
            />
          ))}
        </ul>
      )}

      {canInvite &&
        (pickerOpen ? (
          <InvitePicker
            eventId={eventId}
            onFlareIds={guests.map((guest) => guest.user._id)}
            onClose={() => setPickerOpen(false)}
            onInvited={(count) => {
              setPickerOpen(false)
              showActionFeedback(
                count === 0
                  ? "they're already on the flare"
                  : count === 1
                    ? "invited 1 friend"
                    : `invited ${count} friends`
              )
              void loadGuests()
            }}
            onError={() =>
              showActionFeedback("couldn't send invites", { tone: "error" })
            }
          />
        ) : (
          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            className="flex items-center justify-center gap-1.5 rounded-xl border border-dashed border-border px-3 py-2.5 text-xs text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            <UserPlus className="h-3.5 w-3.5" />
            invite more
          </button>
        ))}

      {confirming && (
        <RemoveGuestDialog
          name={guestName(confirming)}
          busy={removingId === confirming.user._id}
          onConfirm={() => void removeGuest(confirming)}
          onClose={() => setConfirming(null)}
        />
      )}
    </div>
  )
}

function GuestSummary({ guests }: { guests: EventGuest[] }) {
  if (guests.length === 0) {
    return <p className="text-xs text-muted-foreground">no one invited yet.</p>
  }

  const count = (status: EventRsvp) =>
    guests.filter((guest) => guest.rsvpStatus === status).length
  const parts = [
    `${count("going")} going`,
    `${count("invited")} invited`,
    ...(count("declined") > 0 ? [`${count("declined")} can't make it`] : []),
  ]

  return (
    <p className="text-xs text-muted-foreground tabular-nums">
      {parts.join(" · ")}
    </p>
  )
}

function GuestRow({
  guest,
  onRemove,
  removing,
}: {
  guest: EventGuest
  onRemove?: () => void
  removing?: boolean
}) {
  const name = guest.user.displayName ?? guest.user.username ?? "guest"
  const declined = guest.rsvpStatus === "declined"

  return (
    <li
      className={cn(
        "flex items-center gap-2.5 rounded-lg px-1 py-1.5",
        declined && "opacity-60"
      )}
    >
      <Avatar className="size-7">
        {guest.user.avatarUrl && (
          <AvatarImage src={guest.user.avatarUrl} alt="" />
        )}
        <AvatarFallback className="text-xs">{initials(name)}</AvatarFallback>
      </Avatar>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm">{name}</span>
        {guest.user.username && (
          <span className="block truncate text-xs text-muted-foreground">
            @{guest.user.username}
          </span>
        )}
      </span>
      <span
        className={cn(
          "shrink-0 text-xs",
          guest.rsvpStatus === "going"
            ? "font-medium text-accent"
            : "text-muted-foreground"
        )}
      >
        {guest.rsvpStatus === "declined" ? "can't make it" : guest.rsvpStatus}
      </span>
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          disabled={removing}
          aria-label={`remove ${name}`}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-secondary hover:text-foreground disabled:opacity-40"
        >
          <UserMinus className="h-3.5 w-3.5" />
        </button>
      )}
    </li>
  )
}

function InvitePicker({
  eventId,
  onFlareIds,
  onClose,
  onInvited,
  onError,
}: {
  eventId: string
  onFlareIds: string[]
  onClose: () => void
  onInvited: (count: number) => void
  onError: () => void
}) {
  const [circles, setCircles] = useState<Circle[] | null>(null)
  const [connections, setConnections] = useState<Connection[]>([])
  const [loadError, setLoadError] = useState(false)
  const [circleId, setCircleId] = useState("")
  const [friendIds, setFriendIds] = useState<string[]>([])
  const [sending, setSending] = useState(false)

  useEffect(() => {
    const ac = new AbortController()
    Promise.all([
      fetchAcceptedConnections(ac.signal),
      fetchMyCircles(ac.signal),
    ])
      .then(([nextConnections, nextCircles]) => {
        setConnections(nextConnections)
        setCircles(nextCircles)
      })
      .catch(() => {
        if (ac.signal.aborted) return
        setLoadError(true)
      })
    return () => ac.abort()
  }, [])

  const onFlare = useMemo(() => new Set(onFlareIds), [onFlareIds])
  // Friends already on the flare aren't offered again.
  const invitableConnections = useMemo(
    () => connections.filter((c) => !onFlare.has(c.id)),
    [connections, onFlare]
  )
  const selectedCircle = circles?.find((c) => c.id === circleId) ?? null
  const newInviteeIds = useMemo(() => {
    const ids = new Set(friendIds)
    for (const memberId of selectedCircle?.memberIds ?? []) {
      if (!onFlare.has(memberId)) ids.add(memberId)
    }
    return ids
  }, [friendIds, selectedCircle, onFlare])

  const toggleFriend = (id: string): void => {
    setFriendIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
  }

  const send = async (): Promise<void> => {
    try {
      setSending(true)
      const result = await inviteEventGuests(eventId, {
        circles: selectedCircle
          ? [{ circleId: selectedCircle.id, role: "guest" }]
          : [],
        members: friendIds.map((userId) => ({ userId, role: "guest" })),
      })
      onInvited(result.invitedUserIds.length)
    } catch {
      setSending(false)
      onError()
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border p-3">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">invite more</span>
        <button
          type="button"
          onClick={onClose}
          aria-label="close invite more"
          className="flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground hover:bg-secondary"
        >
          <X className="h-3 w-3" />
        </button>
      </div>

      {loadError ? (
        <p className="text-xs text-muted-foreground">
          couldn&apos;t load your circles and friends.
        </p>
      ) : !circles ? (
        <p className="text-xs text-muted-foreground">
          loading your circles and friends...
        </p>
      ) : (
        <>
          <CircleCards
            circles={circles}
            audience={circleId}
            onSelect={(id) => setCircleId((prev) => (prev === id ? "" : id))}
          />
          <FriendList
            connections={invitableConnections}
            selectedIds={friendIds}
            onToggle={toggleFriend}
            emptyHint={
              connections.length === 0
                ? "no friends on sponti yet"
                : "everyone's already invited"
            }
            searchPlaceholder="search friends..."
          />
          <Button
            type="button"
            onClick={() => void send()}
            disabled={newInviteeIds.size === 0 || sending}
            className="w-full rounded-full bg-accent text-accent-foreground hover:bg-accent/90 disabled:opacity-40"
          >
            {sending
              ? "inviting..."
              : newInviteeIds.size === 0
                ? "pick who to invite"
                : `invite ${newInviteeIds.size}`}
          </Button>
        </>
      )}
    </div>
  )
}
