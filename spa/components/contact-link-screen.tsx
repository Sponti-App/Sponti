"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import {
  ArrowLeftIcon,
  CheckIcon,
  CircleNotchIcon,
  UserPlusIcon,
  XCircleIcon,
} from "@/components/icons"
import { useActionFeedback } from "@/components/action-feedback"
import { useAuth } from "@/components/auth-provider"
import { ContactLinkSignedOut } from "@/components/contact-link-signed-out"
import { Button } from "@/components/ui/button"
import { resolveInviteLink } from "@/lib/api/invite-links"
import {
  resolveQrContactToken,
  type QrContactResolveResult,
} from "@/lib/api/qr-contact-tokens"
import { type ContactLinkKind } from "@/lib/contact-links"
import { HttpError } from "@/lib/http"

// One screen for both ways to add someone (#124):
//   qr     — scanned in person; "connect" makes you friends right away
//   invite — opened from a group chat; "send request" asks the owner
// A signed-out visitor sees who wants to connect, with sign in and create
// account as equal choices, and comes back here afterwards (#441).

type Copy = {
  resolve: typeof resolveQrContactToken
  expiredCode: string
  expiredMessage: string
  unavailableTitle: string
  unavailableMessage: string
  selfMessage: string
  connectError: string
}

const COPY: Record<ContactLinkKind, Copy> = {
  qr: {
    resolve: resolveQrContactToken,
    expiredCode: "QR_CONTACT_TOKEN_EXPIRED",
    expiredMessage: "this qr expired. ask them to show a new code.",
    unavailableTitle: "qr unavailable",
    unavailableMessage: "this qr code is no longer available.",
    selfMessage: "this is your qr code.",
    connectError: "could not connect. try scanning again.",
  },
  invite: {
    resolve: resolveInviteLink,
    expiredCode: "INVITE_LINK_EXPIRED",
    expiredMessage: "this invite link expired. ask them for a new one.",
    unavailableTitle: "link unavailable",
    unavailableMessage: "this invite link is no longer available.",
    selfMessage: "this is your invite link.",
    connectError: "could not send the friend request. try again.",
  },
}

function relationshipLabel(
  kind: ContactLinkKind,
  result: QrContactResolveResult
): string {
  const name = result.profile.displayName
  // #441: a code that ran out during sign-up still reaches its owner, as a
  // request instead of an instant connection.
  if (result.expired && result.canConnect) {
    return result.relationship === "pending_incoming"
      ? `${name} already sent you a request. this code expired, but you can accept it.`
      : `this code expired, but you can still send ${name} a friend request.`
  }
  switch (result.relationship) {
    case "self":
      return COPY[kind].selfMessage
    case "connected":
      return `you and ${name} are friends on sponti.`
    case "pending_outgoing":
      return kind === "qr" && !result.expired
        ? `your request to ${name} is pending. connect now instead.`
        : `your request to ${name} is pending.`
    case "pending_incoming":
      return `${name} already sent you a request.`
    case "none":
      return kind === "qr" && !result.expired
        ? `you're with ${name}. connect to be friends right away.`
        : `send ${name} a friend request.`
  }
}

function actionLabel(
  kind: ContactLinkKind,
  result: QrContactResolveResult
): string {
  if (kind === "qr" && !result.expired) return "connect"
  return result.relationship === "pending_incoming"
    ? "accept request"
    : "send request"
}

export function ContactLinkScreen({ kind }: { kind: ContactLinkKind }) {
  const { status } = useAuth()
  const params = useParams<{ token: string }>()
  const token = useMemo(() => decodeURIComponent(params.token), [params.token])

  if (status === "unauthenticated") {
    return <ContactLinkSignedOut kind={kind} token={token} />
  }
  return <ContactLinkSignedIn kind={kind} token={token} status={status} />
}

function ContactLinkSignedIn({
  kind,
  token,
  status,
}: {
  kind: ContactLinkKind
  token: string
  status: ReturnType<typeof useAuth>["status"]
}) {
  const router = useRouter()
  const { showActionFeedback } = useActionFeedback()
  const copy = COPY[kind]
  const [resolved, setResolved] = useState<{
    token: string
    result: QrContactResolveResult
  } | null>(null)
  const [connecting, setConnecting] = useState(false)
  const [resolveError, setResolveError] = useState<{
    token: string
    message: string
  } | null>(null)
  const [connectError, setConnectError] = useState<string | null>(null)

  const result = resolved?.token === token ? resolved.result : null
  const error = resolveError?.token === token ? resolveError.message : null

  useEffect(() => {
    if (status !== "authenticated") {
      return
    }

    const controller = new AbortController()

    copy
      .resolve(token, false, controller.signal)
      .then((nextResult) => {
        setResolved({ token, result: nextResult })
        setResolveError(null)
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return
        setResolveError({
          token,
          message:
            err instanceof HttpError && err.code === copy.expiredCode
              ? copy.expiredMessage
              : copy.unavailableMessage,
        })
      })

    return () => controller.abort()
  }, [status, token, copy])

  const connect = async () => {
    setConnecting(true)
    setConnectError(null)
    try {
      const nextResult = await copy.resolve(token, true)
      setResolved({ token, result: nextResult })
      showActionFeedback(
        nextResult.relationship === "connected"
          ? "friend added"
          : "request sent"
      )
    } catch {
      setConnectError(copy.connectError)
      showActionFeedback("couldn't add friend", { tone: "error" })
    } finally {
      setConnecting(false)
    }
  }

  return (
    <main className="min-h-dvh bg-background px-4 py-6 text-foreground">
      <div className="mx-auto flex min-h-[calc(100dvh-3rem)] max-w-md flex-col">
        <button
          type="button"
          onClick={() => router.back()}
          className="mb-6 flex h-10 w-10 items-center justify-center rounded-full border border-border hover:bg-secondary"
          aria-label="Go back"
        >
          <ArrowLeftIcon className="h-4 w-4" />
        </button>

        <section className="flex flex-1 flex-col items-center justify-center text-center">
          {status !== "authenticated" || (!result && !error) ? (
            <CircleNotchIcon className="h-7 w-7 animate-spin text-muted-foreground" />
          ) : error && !result ? (
            <>
              <XCircleIcon className="mb-4 h-10 w-10 text-muted-foreground" />
              <h1 className="text-lg font-semibold">{copy.unavailableTitle}</h1>
              <p className="mt-2 max-w-xs text-sm text-muted-foreground">
                {error}
              </p>
            </>
          ) : result ? (
            <>
              <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-secondary text-lg font-semibold">
                {result.profile.displayName.slice(0, 1).toUpperCase()}
              </div>
              <h1 className="text-lg font-semibold">
                {result.profile.displayName}
              </h1>
              <p className="mt-1 text-sm font-medium text-accent">
                @{result.profile.username}
              </p>
              <p className="mt-4 max-w-xs text-sm text-muted-foreground">
                {relationshipLabel(kind, result)}
              </p>
              {connectError && (
                <p className="mt-3 max-w-xs text-sm text-destructive">
                  {connectError}
                </p>
              )}
              {result.canConnect ? (
                <Button
                  onClick={connect}
                  disabled={connecting}
                  className="mt-6 rounded-full bg-accent px-6 text-accent-foreground hover:bg-accent/90 disabled:opacity-60"
                >
                  {connecting ? (
                    <CircleNotchIcon className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <UserPlusIcon className="mr-2 h-4 w-4" />
                  )}
                  {actionLabel(kind, result)}
                </Button>
              ) : (
                <>
                  <div className="mt-6 inline-flex items-center rounded-full border border-border px-4 py-2 text-sm font-medium">
                    <CheckIcon className="mr-2 h-4 w-4" />
                    {result.relationship === "connected"
                      ? "you're friends"
                      : "no action needed"}
                  </div>
                  <Link
                    href="/"
                    className="mt-4 text-sm font-medium text-accent"
                  >
                    open sponti
                  </Link>
                </>
              )}
            </>
          ) : null}
        </section>
      </div>
    </main>
  )
}
