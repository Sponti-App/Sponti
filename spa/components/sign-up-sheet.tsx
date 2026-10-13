"use client"

// #389 (flare moments, #370): the sign-up ask on the signed-out home map, and
// the welcome back once the visitor has an account. Both behind
// `browseBeforeSignup`. Copy and layout follow the round 2 prototype (#373,
// "gate: sheet", "ask on tap").

import Link from "next/link"
import { Drawer } from "vaul"
import type { AccountOnlyTab } from "@/components/bottom-nav"
import { MapPinIcon } from "@/components/icons"
import { LegalLinks } from "@/components/legal-links"
import { Button } from "@/components/ui/button"
import { ANYWHERE_PLACE_LINE } from "@/lib/flare-ideas-anywhere"
import { haptic } from "@/lib/haptics"
import {
  RESUME_REDIRECT_QUERY,
  keepFlareDraft,
  type KeptFlareDraft,
} from "@/lib/kept-flare-draft"
import { EVENT_TYPES } from "@/types/utils"

/** Why the sheet is asking. */
export type SignUpAsk =
  /** Lighting a flare: the nav's flare button or an idea's "light a flare".
   * The draft is kept for after sign-up. */
  | { kind: "light"; draft: KeptFlareDraft }
  /** A nav tab that needs an account. */
  | { kind: "account"; tab: AccountOnlyTab }
  /** An open-to-all pin: its details need an account. */
  | { kind: "pin" }

// "sign up to see your …": the prototype read "your my flares".
const TAB_NOUN: Record<AccountOnlyTab, string> = {
  feed: "feed",
  circles: "circles",
  "my flares": "flares",
}

function askCopy(ask: SignUpAsk): { title: string; body: string } {
  switch (ask.kind) {
    case "light":
      return {
        title: "sign up to light it",
        body: "flares go to friends, so they need an account. only the friends you pick will see it.",
      }
    case "account":
      return {
        title: `sign up to see your ${TAB_NOUN[ask.tab]}`,
        body: "your feed, circles and flares are tied to your friends, so they need an account.",
      }
    case "pin":
      return {
        title: "sign up to see what's happening",
        body: "what it is, who's going and where to meet are for people on sponti.",
      }
  }
}

/** The kept draft as one row: the idea (or a blank flare) and a hint. */
export function KeptDraftRow({
  draft,
  hint,
}: {
  draft: KeptFlareDraft
  hint?: string
}) {
  const category = draft.idea?.category ?? "hangout"
  const Icon = EVENT_TYPES.find((t) => t.value === category)?.icon ?? MapPinIcon
  // An idea that isn't tied to a spot (#515) has no place name.
  const place = draft.idea
    ? (draft.idea.place?.name ?? ANYWHERE_PLACE_LINE).toLowerCase()
    : undefined
  const line = [place, hint].filter(Boolean).join(" · ")
  return (
    <div
      data-kept-draft={draft.idea?.id ?? "blank"}
      className="flex items-center gap-3 rounded-xl bg-muted px-3 py-2.5"
    >
      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-background text-foreground">
        <Icon className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">
          {draft.idea?.title ?? "your flare"}
        </p>
        {line && (
          <p className="truncate text-xs text-muted-foreground">{line}</p>
        )}
      </div>
    </div>
  )
}

/** A bottom sheet over the map and the nav, as the prototype draws them. */
function Sheet({
  open,
  onClose,
  title,
  description,
  label,
  children,
}: {
  open: boolean
  onClose: () => void
  title: string
  description: string
  label: string
  children: React.ReactNode
}) {
  return (
    <Drawer.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          haptic("light")
          onClose()
        }
      }}
      repositionInputs={false}
    >
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-50 bg-foreground/30" />
        <Drawer.Content
          aria-label={label}
          data-sheet={label}
          className="fixed inset-x-0 bottom-0 z-50 flex flex-col rounded-t-3xl bg-background px-5 pt-3 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-(--shadow-sheet) outline-none"
        >
          <div className="mx-auto mb-3 h-1 w-10 shrink-0 rounded-full bg-border" />
          <Drawer.Title className="text-base font-semibold">
            {title}
          </Drawer.Title>
          <Drawer.Description className="mt-1 text-sm text-muted-foreground">
            {description}
          </Drawer.Description>
          {children}
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  )
}

const PEACH_BUTTON =
  "h-12 w-full rounded-full bg-accent text-sm text-accent-foreground hover:bg-accent/90"
const TEXT_BUTTON =
  "flex min-h-11 w-full items-center justify-center text-sm font-medium text-muted-foreground hover:text-foreground"

/**
 * The sign-up ask, over the signed-out map. "create an account" goes to
 * /register and "i have an account" to /login. When the visitor was lighting a
 * flare, the draft is kept and both pages send them back to it (#219's
 * redirect), with `?resume=flare`.
 */
export function SignUpSheet({
  open,
  ask,
  onClose,
}: {
  open: boolean
  /** The last ask, kept while the sheet animates closed. */
  ask: SignUpAsk | null
  onClose: () => void
}) {
  const copy = ask ? askCopy(ask) : { title: "", body: "" }
  const lighting = ask?.kind === "light" ? ask : null
  const query = lighting ? RESUME_REDIRECT_QUERY : ""
  const keep = () => {
    if (lighting) keepFlareDraft(lighting.draft)
  }
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={copy.title}
      description={copy.body}
      label="sign up"
    >
      {lighting && (
        <div className="mt-4">
          <KeptDraftRow draft={lighting.draft} hint="kept for after sign-up" />
        </div>
      )}
      <Button asChild className={`mt-4 ${PEACH_BUTTON}`}>
        <Link href={`/register${query}`} onClick={keep}>
          create an account
        </Link>
      </Button>
      <Link href={`/login${query}`} onClick={keep} className={TEXT_BUTTON}>
        i have an account
      </Link>
      <LegalLinks className="-mb-2" />
    </Sheet>
  )
}

/**
 * Back on the map after sign-up or sign-in, with the flare they started. "let's
 * light it up" opens the composer with it; "not now" lets it go.
 */
export function WelcomeBackSheet({
  open,
  draft,
  onLight,
  onLater,
}: {
  open: boolean
  draft: KeptFlareDraft | null
  onLight: () => void
  onLater: () => void
}) {
  return (
    <Sheet
      open={open}
      onClose={onLater}
      title="welcome in. here's the flare you started."
      description="pick when and who, and it's out."
      label="welcome in"
    >
      {draft && (
        <div className="mt-4">
          <KeptDraftRow draft={draft} />
        </div>
      )}
      <Button
        type="button"
        onClick={() => {
          haptic("medium")
          onLight()
        }}
        className={`mt-4 ${PEACH_BUTTON}`}
      >
        let&apos;s light it up
      </Button>
      <button type="button" onClick={onLater} className={TEXT_BUTTON}>
        not now
      </button>
    </Sheet>
  )
}
