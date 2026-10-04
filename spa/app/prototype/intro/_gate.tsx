"use client"

// PROTOTYPE (#373) — the sign-up ask, when a signed-out visitor lights a
// flare (the nav's flare button, the FAB, or an idea spot's "light a
// flare"). Two open calls, side by side on the bar:
//
// gate=sheet  a sheet over the map says why, keeps the draft in view, then
//             the register page.
// gate=page   straight to the register page, with the kept draft on top.
//
// at=tap      the ask comes on the tap; the idea (or an empty draft) is kept.
// at=light    the composer opens signed out; the ask comes on "let's light
//             it up", and everything they filled in is kept.
//
// Either way, after sign-up they land back in the composer with the draft.

import { ArrowRightIcon, CaretLeftIcon } from "@/components/icons"
import { Input } from "@/components/ui/input"
import type { FlareIdea } from "@/lib/flare-ideas"
import { YOU } from "./_mock"
import {
  MiniComposer,
  PeachButton,
  Sheet,
  TextButton,
  categoryOf,
} from "./_shared"

/** The draft the visitor started: an idea, or a blank flare. */
export type Draft = { idea: FlareIdea | null }

function DraftRow({ draft }: { draft: Draft }) {
  const { Icon } = categoryOf(draft.idea?.category ?? "hangout")
  return (
    <div className="flex items-center gap-3 rounded-xl bg-muted px-3 py-2.5">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-background text-foreground">
        <Icon className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">
          {draft.idea?.title ?? "your flare"}
        </p>
        <p className="truncate text-xs text-muted-foreground">
          {draft.idea
            ? `${draft.idea.place.name.toLowerCase()} · kept for after sign-up`
            : "kept for after sign-up"}
        </p>
      </div>
    </div>
  )
}

/** gate=sheet: the ask, over the map. `reason` covers the account-only nav
 * tabs, which open the same sheet. */
export function GateSheet({
  draft,
  reason,
  onSignUp,
  onSignIn,
  onClose,
}: {
  draft: Draft | null
  reason?: string
  onSignUp: () => void
  onSignIn: () => void
  onClose: () => void
}) {
  return (
    <>
      <button
        type="button"
        aria-label="close"
        onClick={onClose}
        className="absolute inset-0 z-20 bg-black/30"
      />
      <Sheet className="z-30">
        <h2 className="text-base font-semibold">
          {draft ? "sign up to light it" : `sign up to see your ${reason}`}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {draft
            ? "flares go to friends, so they need an account. only the friends you pick will see it."
            : "your feed, circles and flares are tied to your friends, so they need an account."}
        </p>
        {draft && (
          <div className="mt-4">
            <DraftRow draft={draft} />
          </div>
        )}
        <PeachButton onClick={onSignUp} className="mt-4">
          create an account
        </PeachButton>
        <TextButton onClick={onSignIn}>i have an account</TextButton>
      </Sheet>
    </>
  )
}

/** The register page (app/(auth)/register) as a look-alike, prefilled, with
 * the kept draft on top. The real page also has the google button; it loads
 * google's script, so the prototype draws a stand-in. */
export function RegisterScreen({
  draft,
  onBack,
  onDone,
  onSignIn,
}: {
  draft: Draft
  onBack: () => void
  onDone: () => void
  onSignIn: () => void
}) {
  const field = (label: string, value: string, type = "text") => (
    <label className="flex flex-col gap-1.5 text-sm font-medium">
      {label}
      <Input readOnly type={type} value={value} className="h-11 rounded-xl" />
    </label>
  )
  return (
    <div className="flex min-h-dvh flex-col bg-background px-6 pt-3 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
      <button
        type="button"
        onClick={onBack}
        aria-label="back to the map"
        className="-ml-2 flex size-11 items-center justify-center text-muted-foreground"
      >
        <CaretLeftIcon className="size-5" />
      </button>
      <div className="mt-2">
        <DraftRow draft={draft} />
      </div>
      <h1 className="mt-6 text-lg font-semibold">claim your handle</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        then your flare goes out.
      </p>
      <div className="mt-5 flex flex-col gap-3.5">
        {field("your name", YOU.name)}
        {field("username", YOU.handle)}
        {field("email", "alex@example.com", "email")}
        {field("password", "prototype", "password")}
      </div>
      <div className="mt-auto pt-6">
        <PeachButton onClick={onDone}>
          create account
          <ArrowRightIcon className="size-4" />
        </PeachButton>
        <div className="my-3 flex items-center gap-4 text-xs text-muted-foreground">
          <span className="h-px flex-1 bg-border" />
          or
          <span className="h-px flex-1 bg-border" />
        </div>
        <button
          type="button"
          onClick={onDone}
          className="h-11 w-full rounded-full border border-border text-sm font-medium"
        >
          continue with google
        </button>
        <p className="mt-4 text-center text-sm text-muted-foreground">
          already have an account?{" "}
          <button
            type="button"
            onClick={onSignIn}
            className="font-medium text-accent"
          >
            sign in
          </button>
        </p>
      </div>
    </div>
  )
}

/** The composer sheet over the map. Signed out (at=light), its button asks
 * for an account; signed in, it lights the kept draft. */
export function ComposerSheet({
  draft,
  signedIn,
  onLight,
  onLater,
}: {
  draft: Draft
  signedIn: boolean
  onLight: () => void
  onLater: () => void
}) {
  const idea = draft.idea
  return (
    <>
      <div className="absolute inset-0 z-20 bg-black/30" />
      <Sheet className="z-30">
        <p className="text-xs text-muted-foreground">
          {signedIn
            ? "welcome in. here's the flare you started."
            : idea
              ? "an idea nearby, ready to go. change anything."
              : "what are you up to?"}
        </p>
        <MiniComposer
          title={idea?.title}
          type={idea?.category ?? "hangout"}
          where={idea ? idea.place.name.toLowerCase() : "my location"}
          who="all friends"
          className="mt-3"
        />
        <PeachButton onClick={onLight} className="mt-4">
          let&apos;s light it up
        </PeachButton>
        <TextButton onClick={onLater}>
          {signedIn ? "not now" : "cancel"}
        </TextButton>
      </Sheet>
    </>
  )
}
