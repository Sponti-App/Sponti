"use client"

import { Check, Sparkles, UserPlus, X, type LucideIcon } from "lucide-react"
import {
  formatRelative,
  type Notification,
  type RsvpStatus,
} from "@/lib/notifications"

type Visual = {
  icon: LucideIcon
  ring: string
}

const TYPE_VISUAL: Record<Notification["type"], Visual> = {
  invitation: { icon: UserPlus, ring: "border-accent/30 text-accent" },
  rsvp: { icon: Sparkles, ring: "border-foreground/15 text-foreground" },
  confirmation: { icon: Check, ring: "border-accent/30 text-accent" },
}

const RSVP_LABEL: Record<RsvpStatus, string> = {
  yes: "going",
  no: "can't make it",
  maybe: "maybe",
}

function renderTitle(n: Notification): string {
  switch (n.type) {
    case "invitation":
      return `${n.actorName} invited you`
    case "rsvp":
      return `${n.actorName} is ${n.rsvp ? RSVP_LABEL[n.rsvp] : "responding"}`
    case "confirmation":
      return `${n.actorName} confirmed`
  }
}

function renderSubtitle(n: Notification): string {
  switch (n.type) {
    case "invitation":
      return `to ${n.eventTitle} · tap to respond`
    case "rsvp":
      return `for ${n.eventTitle}`
    case "confirmation":
      return `coming to ${n.eventTitle}`
  }
}

export function NotificationsPopover({
  open,
  onClose,
  notifications,
}: {
  open: boolean
  onClose: () => void
  notifications: Notification[]
}) {
  const unread = notifications.filter((n) => !n.read).length

  return (
    <>
      <div
        className={`absolute inset-0 z-40 transition-opacity duration-200 ${
          open ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        onClick={onClose}
        aria-hidden="true"
      />

      <div
        className={`absolute top-[88px] right-3 z-50 w-[320px] bg-card text-card-foreground border border-border rounded-2xl shadow-lg overflow-hidden transition-all duration-200 origin-top-right ${
          open ? "opacity-100 scale-100" : "opacity-0 scale-95 pointer-events-none"
        }`}
        role="dialog"
        aria-label="Notifications"
        aria-hidden={!open}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <h3 className="font-medium text-sm">notifications</h3>
            {unread > 0 && (
              <span className="text-[10px] font-semibold uppercase tracking-wide bg-accent text-accent-foreground rounded-full px-1.5 py-0.5">
                {unread} new
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            aria-label="Close notifications"
            className="h-7 w-7 rounded-full flex items-center justify-center hover:bg-secondary"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        {notifications.length === 0 ? (
          <div className="px-4 py-10 text-center">
            <p className="text-sm text-muted-foreground">no notifications yet</p>
            <p className="text-xs text-muted-foreground mt-1">
              invites and rsvps will land here
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-border max-h-[360px] overflow-y-auto">
            {notifications.map((n) => {
              const { icon: Icon, ring } = TYPE_VISUAL[n.type]
              return (
                <li key={n.id}>
                  <button
                    className={`w-full flex items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-secondary ${
                      n.read ? "" : "bg-accent/5"
                    }`}
                  >
                    <div
                      className={`w-9 h-9 rounded-full border bg-background flex items-center justify-center shrink-0 ${ring}`}
                    >
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{renderTitle(n)}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {renderSubtitle(n)}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span className="text-xs text-muted-foreground">
                        {formatRelative(n.createdAt)}
                      </span>
                      {!n.read && <span className="h-1.5 w-1.5 rounded-full bg-accent" />}
                    </div>
                  </button>
                </li>
              )
            })}
          </ul>
        )}

        <button className="w-full px-4 py-3 text-sm font-medium border-t border-border hover:bg-secondary transition-colors">
          view all
        </button>
      </div>
    </>
  )
}
