"use client"

import { useEffect, type ReactNode } from "react"
import {
  CheckIcon,
  EyeSlashIcon,
  FlameIcon,
  ChatIcon,
  ArrowCounterClockwiseIcon,
  SparkleIcon,
  UserCheckIcon,
  UserMinusIcon,
  UserPlusIcon,
  XIcon,
  type Icon,
} from "@/components/icons"
import { useOptionalActionFeedback } from "@/components/action-feedback"
import { CircleChips, type CircleChipsState } from "@/components/circle-chips"
import { Button } from "@/components/ui/button"
import {
  ACCEPT_UNDO_MS,
  declineRequest,
  ensurePendingRequests,
  pickCircle,
  scheduleAccept,
  skipCircle,
  undoAccept,
  useConnectionRequest,
  type CirclePlacement,
} from "@/lib/connection-request-actions"
import { formatRelative, type Notification } from "@/lib/notifications"
import { dismiss } from "@/lib/use-notifications"
import { useSwipeActions } from "@/lib/use-swipe-actions"
import { cn } from "@/lib/utils"

// One row of the notification feed (#137). Every row can be swiped left to
// hide it (#173). A connection request also answers itself in place (#174,
// #226): accept / decline buttons, swipe right as a shortcut for accept, an
// undo window, then the circle chips.

type Visual = {
  icon: Icon
  ring: string
}

const TYPE_VISUAL: Record<Notification["type"], Visual> = {
  event_invitation: { icon: FlameIcon, ring: "border-accent/30 text-accent" },
  event_cancelled: {
    icon: XIcon,
    ring: "border-destructive/40 text-destructive",
  },
  event_reactivated: {
    icon: ArrowCounterClockwiseIcon,
    ring: "border-accent/30 text-accent",
  },
  event_rsvp_change: {
    icon: SparkleIcon,
    ring: "border-foreground/15 text-foreground",
  },
  event_guest_removed: {
    icon: UserMinusIcon,
    ring: "border-foreground/15 text-muted-foreground",
  },
  event_update: {
    icon: ChatIcon,
    ring: "border-accent/30 text-accent",
  },
  connection_request: {
    icon: UserPlusIcon,
    ring: "border-accent/30 text-accent",
  },
  connection_accepted: {
    icon: UserCheckIcon,
    ring: "border-accent/30 text-accent",
  },
}

type RowProps = {
  notification: Notification
  onOpen?: (notification: Notification) => void
  /** Hides the row. Defaults to the feed store's persisted dismiss. */
  onDismiss?: (notification: Notification) => void
}

export function NotificationRow(props: RowProps) {
  if (props.notification.type === "connection_request") {
    return <ConnectionRequestRow {...props} />
  }
  return <SwipeableRow {...props} />
}

function SwipeableRow({
  notification,
  onOpen,
  onDismiss = (target) => void dismiss(target.id),
  onAccept,
  subtitle,
  children,
}: RowProps & {
  /** Present only while swiping right would accept something. */
  onAccept?: () => void
  subtitle?: string
  children?: ReactNode
}) {
  const { icon: Icon, ring } = TYPE_VISUAL[notification.type]
  const swipe = useSwipeActions({
    onSwipeLeft: () => onDismiss(notification),
    onSwipeRight: onAccept,
  })

  return (
    <li
      className="relative overflow-hidden"
      data-notification-id={notification.id}
    >
      {swipe.offset !== 0 && (
        <div
          aria-hidden
          className={cn(
            "absolute inset-0 flex items-center gap-2 px-6 text-sm transition-colors",
            swipe.offset > 0
              ? "justify-start bg-accent/20 text-foreground"
              : "justify-end bg-muted text-muted-foreground",
            swipe.armed ? "font-semibold" : "font-medium"
          )}
        >
          {swipe.offset > 0 ? (
            <>
              <CheckIcon className="h-4 w-4" />
              accept
            </>
          ) : (
            <>
              hide
              <EyeSlashIcon className="h-4 w-4" />
            </>
          )}
        </div>
      )}
      <div
        {...swipe.handlers}
        style={swipe.style}
        className={cn(
          "group/row relative bg-background",
          swipe.dragging && "select-none"
        )}
      >
        <div className={notification.read ? "" : "bg-accent/5"}>
          <button
            type="button"
            onClick={() => onOpen?.(notification)}
            className="flex min-h-14 w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-muted active:bg-muted"
          >
            <div
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border bg-background ${ring}`}
            >
              <Icon className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p
                className={`truncate text-sm ${
                  notification.read ? "text-muted-foreground" : "font-medium"
                }`}
              >
                {notification.title}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {subtitle ?? notification.subtitle}
              </p>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1">
              <span className="text-xs text-muted-foreground">
                {formatRelative(notification.createdAt)}
              </span>
              {!notification.read && (
                <span className="h-1.5 w-1.5 rounded-full bg-accent" />
              )}
            </div>
          </button>
          {children && <div className="px-4 pb-3 pl-16">{children}</div>}
        </div>
        {/* Swiping is a touch shortcut. This is the same thing for keyboard
            and screen-reader users; it only shows when focused. */}
        <button
          type="button"
          onClick={() => onDismiss(notification)}
          className="sr-only focus-visible:not-sr-only focus-visible:absolute focus-visible:top-2 focus-visible:right-2 focus-visible:rounded-full focus-visible:bg-card focus-visible:px-3 focus-visible:py-1 focus-visible:text-xs"
        >
          hide notification
        </button>
      </div>
    </li>
  )
}

function chipsState(placement: CirclePlacement): CircleChipsState {
  switch (placement.status) {
    case "none":
      return { status: "choosing" }
    case "queued":
    case "adding":
      return { status: "adding", circle: placement.circle }
    case "added":
      return { status: "added", circle: placement.circle }
    case "skipped":
      return { status: "skipped" }
  }
}

function ConnectionRequestRow(props: RowProps) {
  const { notification } = props
  const connectionId = notification.targetId
  const personId = notification.actorId ?? null
  const personName = notification.actorName ?? "them"
  const request = useConnectionRequest(connectionId)
  const { showActionFeedback } = useOptionalActionFeedback()

  useEffect(() => {
    ensurePendingRequests()
  }, [])

  const notify = (message: string, tone: "success" | "error") =>
    showActionFeedback(message, { tone })

  const canAnswer = request.phase === "idle" && request.pending === "yes"

  const accept = () => {
    if (!canAnswer) return
    scheduleAccept(connectionId, { userId: personId, notify })
    showActionFeedback(`accepted ${personName}`, {
      durationMs: ACCEPT_UNDO_MS,
      action: { label: "undo", onAction: () => undoAccept(connectionId) },
    })
  }

  let subtitle: string | undefined
  let actions: ReactNode = null

  switch (request.phase) {
    case "idle":
      if (canAnswer) {
        subtitle = "wants to connect with you"
        actions = (
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={accept}
              className="h-8 rounded-full bg-accent px-4 text-xs text-accent-foreground hover:bg-accent/90"
            >
              accept
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => void declineRequest(connectionId, notify)}
              className="h-8 rounded-full px-4 text-xs"
            >
              decline
            </Button>
          </div>
        )
      }
      break
    case "declining":
      subtitle = "declining…"
      break
    case "declined":
      subtitle = "request declined"
      break
    case "handled":
      subtitle = "already answered"
      break
    case "undo":
    case "accepting":
    case "accepted":
      subtitle = "request accepted"
      actions = (
        <div className="flex flex-col gap-2">
          <CircleChips
            circles={request.circles}
            personId={personId ?? ""}
            personName={personName}
            state={chipsState(request.placement)}
            onPick={(circle) =>
              pickCircle(connectionId, { id: circle.id, name: circle.name })
            }
            onSkip={() => skipCircle(connectionId)}
          />
          {request.phase === "undo" && (
            <button
              type="button"
              onClick={() => undoAccept(connectionId)}
              className="self-start text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
            >
              undo accept
            </button>
          )}
        </div>
      )
      break
  }

  return (
    <SwipeableRow
      {...props}
      subtitle={subtitle}
      onAccept={canAnswer ? accept : undefined}
    >
      {actions}
    </SwipeableRow>
  )
}
