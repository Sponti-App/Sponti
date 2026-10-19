"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  CircleNotchIcon,
  FlameIcon,
  MapPinIcon,
  XCircleIcon,
} from "@/components/icons"
import { useActionFeedback } from "@/components/action-feedback"
import { useAuth } from "@/components/auth-provider"
import { IntroSlidesGate } from "@/components/intro-slides-gate"
import { LegalLinks } from "@/components/legal-links"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button, buttonVariants } from "@/components/ui/button"
import {
  fetchFlareInvitePreview,
  fetchFlareInviteStatus,
  redeemFlareInvite,
  type FlareInvitePreview,
  type FlareInviteStatus,
} from "@/lib/api/flare-invites"
import { buildRegisterPath } from "@/lib/contact-links"
import { featureFlags } from "@/lib/feature-flags"
import { flareInvitePath, inviteWhen } from "@/lib/flare-invite-links"
import { displayFlareTitle, hostFirstName } from "@/lib/flare-title"
import { flarePagePath } from "@/lib/shared-flare"
import { HttpError, warmBackends } from "@/lib/http"
import { buildLoginPath } from "@/lib/redirect-path"
import { useRefetchOnFocus } from "@/lib/use-refetch-on-focus"
import { cn } from "@/lib/utils"
import { EVENT_TYPES } from "@/types/utils"

// A flare's own invite link, `/f/<token>` (#616). Having the link counts as
// being invited. What the page shows without an account is decided by the
// api's public preview: who invited them, the title, the time and the place
// name. The address, guests and updates come only after they are on the flare.
//
// Signed out: the preview, then "i'm in" -> sign up (the intro slides show
// first on a device's first open, as on a friend's link, #560) -> back here,
// where the link is redeemed straight away (`?in=1`).
//
// Signed in: "i'm in" redeems it. An open-to-all flare takes them as going; an
// invite-only one invites a friend of the host at once, and otherwise asks the
// host and waits ("waiting for patrick to accept") until they say yes.

const LINK_GONE =
  "this link no longer works. the flare may be over, or the host made a new link."

// ---- the card ----------------------------------------------------------------

function hostLabel(name: string): string {
  return hostFirstName(name) ?? name.toLowerCase()
}

function PreviewCard({
  preview,
  headline,
}: {
  preview: FlareInvitePreview
  /** What it says under the photo; defaults to "<host> invited you". */
  headline?: string
}) {
  const type = EVENT_TYPES.find((t) => t.value === preview.type)
  const host = preview.host.displayName
  const meta = [type?.label, inviteWhen(preview), preview.placeName]
    .filter(Boolean)
    .join(" · ")
  return (
    <div data-flare-invite-preview className="flex flex-col items-center">
      <Avatar className="mb-5 size-20">
        {preview.host.avatarUrl && (
          <AvatarImage src={preview.host.avatarUrl} alt="" />
        )}
        <AvatarFallback className="bg-secondary text-lg font-semibold text-foreground">
          {host.slice(0, 1).toUpperCase()}
        </AvatarFallback>
      </Avatar>
      <p className="text-sm font-medium text-muted-foreground">
        {headline ?? `${hostLabel(host)} invited you`}
      </p>
      <h1 className="mt-2 max-w-xs text-lg font-semibold">
        {displayFlareTitle({
          title: preview.title,
          type: preview.type,
          isHost: true,
        })}
      </h1>
      <p className="mt-2 flex max-w-xs items-center justify-center gap-1.5 text-sm text-muted-foreground">
        {preview.placeName && <MapPinIcon className="size-3.5 shrink-0" />}
        <span>{meta}</span>
      </p>
    </div>
  )
}

function Brand() {
  return (
    <div className="flex items-center gap-2.5">
      <span className="flex size-7 items-center justify-center rounded-full bg-accent text-accent-foreground shadow-sm">
        <FlameIcon className="size-3.5" />
      </span>
      <span className="text-sm font-semibold tracking-normal">sponti</span>
    </div>
  )
}

function Unavailable({ message = LINK_GONE }: { message?: string }) {
  return (
    <>
      <XCircleIcon className="mb-4 size-10 text-muted-foreground" />
      <h1 className="text-lg font-semibold">link unavailable</h1>
      <p className="mt-2 max-w-xs text-sm text-muted-foreground">{message}</p>
    </>
  )
}

// ---- the screen --------------------------------------------------------------

export function FlareInviteScreen({
  token,
  redeemOnOpen = false,
}: {
  token: string
  /** Sign-up already said "i'm in": redeem as soon as they are signed in. */
  redeemOnOpen?: boolean
}) {
  const { status } = useAuth()

  if (!featureFlags.flareInviteLink) {
    return (
      <Shell>
        <Unavailable message="this link isn't available right now." />
      </Shell>
    )
  }
  if (status === "unauthenticated") {
    return <FlareInviteSignedOut token={token} />
  }
  return (
    <FlareInviteSignedIn
      token={token}
      redeemOnOpen={redeemOnOpen}
      authStatus={status}
    />
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-dvh w-full flex-col bg-background px-6 pt-8 pb-8 text-foreground">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col">
        <Brand />
        <section
          className="flex flex-1 flex-col items-center justify-center text-center"
          aria-live="polite"
        >
          {children}
        </section>
      </div>
    </main>
  )
}

// ---- signed out ----------------------------------------------------------------

function FlareInviteSignedOut({ token }: { token: string }) {
  const [result, setResult] = useState<{
    token: string
    preview: FlareInvitePreview | null
  } | null>(null)
  // After sign-up (or sign-in) they come back here already saying "i'm in".
  const returnPath = flareInvitePath(token, { redeem: true })

  // #212: start waking the backends while they read the screen; the next
  // thing they do is sign in or register.
  useEffect(() => {
    warmBackends()
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    fetchFlareInvitePreview(token, controller.signal)
      .then((preview) => {
        if (!controller.signal.aborted) setResult({ token, preview })
      })
      .catch(() => {
        if (!controller.signal.aborted) setResult({ token, preview: null })
      })
    return () => controller.abort()
  }, [token])

  const settled = result?.token === token
  const preview = settled ? result.preview : null

  return (
    <main className="flex min-h-dvh w-full flex-col bg-background px-6 pt-8 pb-8 text-foreground">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col">
        <Brand />

        <section
          className="flex flex-1 flex-col items-center justify-center text-center"
          aria-live="polite"
        >
          {!settled ? (
            <CircleNotchIcon
              className="size-7 animate-spin text-muted-foreground"
              aria-label="loading"
            />
          ) : preview ? (
            <PreviewCard preview={preview} />
          ) : (
            <Unavailable />
          )}
        </section>

        {preview && (
          <div className="flex flex-col items-center gap-3">
            <Link
              href={buildRegisterPath(returnPath)}
              className={cn(
                buttonVariants(),
                "h-[52px] w-full rounded-full bg-accent text-base text-accent-foreground hover:bg-accent/90"
              )}
            >
              i&apos;m in
            </Link>
            <Link
              href={buildLoginPath(returnPath)}
              className="min-h-11 py-3 text-sm font-medium text-accent-ink"
            >
              i already have an account
            </Link>
          </div>
        )}

        <LegalLinks className="mt-6" />
      </div>

      <IntroSlidesGate
        finishLabel="see the flare"
        signInPath={buildLoginPath(returnPath)}
      />
    </main>
  )
}

// ---- signed in -----------------------------------------------------------------

type Failure = { token: string; message: string }

function failureMessage(error: unknown): string {
  if (error instanceof HttpError) {
    if (error.code === "EVENT_FULL") return "this flare is full."
    if (error.status === 404) return LINK_GONE
  }
  return "couldn't open this link. try again."
}

function FlareInviteSignedIn({
  token,
  redeemOnOpen,
  authStatus,
}: {
  token: string
  redeemOnOpen: boolean
  authStatus: ReturnType<typeof useAuth>["status"]
}) {
  const router = useRouter()
  const { showActionFeedback } = useActionFeedback()
  const [loaded, setLoaded] = useState<{
    token: string
    status: FlareInviteStatus
  } | null>(null)
  const [failure, setFailure] = useState<Failure | null>(null)
  const [redeeming, setRedeeming] = useState(false)
  const redeemedOnOpen = useRef<string | null>(null)
  // Kept in refs so the load below runs once per link, not each time the
  // router or the toast function gets a new identity.
  const routerRef = useRef(router)
  const feedbackRef = useRef(showActionFeedback)
  useEffect(() => {
    routerRef.current = router
    feedbackRef.current = showActionFeedback
  })

  const status = loaded?.token === token ? loaded.status : null
  const failed = failure?.token === token ? failure.message : null

  // On the flare (or hosting it): go to it. Waiting and none stay here.
  const settle = useCallback(
    (next: FlareInviteStatus) => {
      setLoaded({ token, status: next })
      setFailure(null)
      if (next.state !== "waiting" && next.state !== "none" && next.eventId) {
        routerRef.current.replace(flarePagePath(next.eventId))
      }
    },
    [token]
  )

  // Not abortable on purpose: "i'm in" is a decision, and once it is sent the
  // answer should land even if the screen re-mounts around it.
  const redeem = useCallback(async () => {
    setRedeeming(true)
    try {
      settle(await redeemFlareInvite(token))
    } catch (error) {
      setFailure({ token, message: failureMessage(error) })
      if (!(error instanceof HttpError && error.status === 404)) {
        feedbackRef.current("couldn't join", { tone: "error" })
      }
    } finally {
      setRedeeming(false)
    }
  }, [token, settle])

  useEffect(() => {
    if (authStatus !== "authenticated") return
    if (redeemOnOpen && redeemedOnOpen.current !== token) {
      // Sign-up already said "i'm in".
      redeemedOnOpen.current = token
      void redeem()
      return
    }
    const controller = new AbortController()
    fetchFlareInviteStatus(token, controller.signal)
      .then(settle)
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        setFailure({ token, message: failureMessage(error) })
      })
    return () => controller.abort()
  }, [authStatus, token, redeemOnOpen, redeem, settle])

  // Waiting: the host may have said yes while this tab was in the background.
  useRefetchOnFocus(
    () => {
      fetchFlareInviteStatus(token).then(settle, () => {})
    },
    { enabled: status?.state === "waiting", minIntervalMs: 5_000 }
  )

  const waiting = status?.state === "waiting"
  const host = status ? hostLabel(status.preview.host.displayName) : null

  return (
    <Shell>
      {authStatus !== "authenticated" || (!status && !failed) ? (
        <CircleNotchIcon
          className="size-7 animate-spin text-muted-foreground"
          aria-label="loading"
        />
      ) : !status ? (
        <Unavailable message={failed ?? LINK_GONE} />
      ) : (
        <>
          <PreviewCard
            preview={status.preview}
            headline={
              waiting && host ? `waiting for ${host} to accept` : undefined
            }
          />
          {waiting ? (
            <>
              <p
                data-flare-invite-waiting
                className="mt-5 max-w-xs text-sm text-muted-foreground"
              >
                {host} got your friend request. you&apos;re invited as soon as
                they accept.
              </p>
              <Link
                href="/"
                className="mt-4 min-h-11 py-3 text-sm font-medium text-accent-ink"
              >
                open sponti
              </Link>
            </>
          ) : (
            <>
              {failed && (
                <p
                  className="mt-4 max-w-xs text-sm text-destructive"
                  role="alert"
                >
                  {failed}
                </p>
              )}
              <Button
                onClick={() => void redeem()}
                disabled={redeeming}
                className="mt-6 h-[52px] w-full max-w-xs rounded-full bg-accent text-base text-accent-foreground hover:bg-accent/90 disabled:opacity-60"
              >
                {redeeming && (
                  <CircleNotchIcon className="mr-2 size-4 animate-spin" />
                )}
                i&apos;m in
              </Button>
            </>
          )}
        </>
      )}
    </Shell>
  )
}
