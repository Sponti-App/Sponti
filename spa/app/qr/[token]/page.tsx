"use client"

import { useEffect, useMemo, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { ArrowLeft, Check, Loader2, UserPlus, XCircle } from "lucide-react"
import { useAuth } from "@/components/auth-provider"
import { Button } from "@/components/ui/button"
import {
  resolveQrContactToken,
  type QrContactResolveResult,
} from "@/lib/api/qr-contact-tokens"
import { HttpError } from "@/lib/http"

function relationshipLabel(result: QrContactResolveResult): string {
  switch (result.relationship) {
    case "self":
      return "This is your QR code."
    case "connected":
      return `You and ${result.profile.displayName} are already friends.`
    case "pending_outgoing":
      return `Your request to ${result.profile.displayName} is already pending.`
    case "pending_incoming":
      return `${result.profile.displayName} already sent you a request.`
    case "none":
      return `Add ${result.profile.displayName} to your Sponti friends.`
  }
}

export default function QrContactPage() {
  const router = useRouter()
  const params = useParams<{ token: string }>()
  const { status } = useAuth()
  const token = useMemo(() => decodeURIComponent(params.token), [params.token])
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

    resolveQrContactToken(token, false, controller.signal)
      .then((nextResult) => {
        setResolved({ token, result: nextResult })
        setResolveError(null)
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return
        if (err instanceof HttpError && err.code === "QR_CONTACT_TOKEN_EXPIRED") {
          setResolveError({
            token,
            message: "This QR expired. Ask them to show a new code.",
          })
        } else {
          setResolveError({
            token,
            message: "This QR code is no longer available.",
          })
        }
      })

    return () => controller.abort()
  }, [status, token])

  const connect = async () => {
    setConnecting(true)
    setConnectError(null)
    try {
      setResolved({ token, result: await resolveQrContactToken(token, true) })
    } catch {
      setConnectError("Could not send the friend request. Try scanning again.")
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
          <ArrowLeft className="h-4 w-4" />
        </button>

        <section className="flex flex-1 flex-col items-center justify-center text-center">
          {status === "loading" || (status === "authenticated" && !result && !error) ? (
            <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
          ) : status !== "authenticated" ? (
            <>
              <XCircle className="mb-4 h-10 w-10 text-muted-foreground" />
              <h1 className="text-2xl font-semibold">Sign in to open this QR</h1>
              <p className="mt-2 max-w-xs text-sm text-muted-foreground">
                QR contacts only work for authenticated Sponti users.
              </p>
              <Button
                onClick={() => router.push("/login")}
                className="mt-6 rounded-full bg-accent px-6 text-accent-foreground hover:bg-accent/90"
              >
                sign in
              </Button>
            </>
          ) : error && !result ? (
            <>
              <XCircle className="mb-4 h-10 w-10 text-muted-foreground" />
              <h1 className="text-2xl font-semibold">QR unavailable</h1>
              <p className="mt-2 max-w-xs text-sm text-muted-foreground">
                {error}
              </p>
            </>
          ) : result ? (
            <>
              <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-secondary text-2xl font-semibold">
                {result.profile.displayName.slice(0, 1).toUpperCase()}
              </div>
              <h1 className="text-2xl font-semibold">
                {result.profile.displayName}
              </h1>
              <p className="mt-1 text-sm font-medium text-accent">
                @{result.profile.username}
              </p>
              <p className="mt-4 max-w-xs text-sm text-muted-foreground">
                {relationshipLabel(result)}
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
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <UserPlus className="mr-2 h-4 w-4" />
                  )}
                  {result.relationship === "pending_incoming"
                    ? "accept request"
                    : "add friend"}
                </Button>
              ) : (
                <div className="mt-6 inline-flex items-center rounded-full border border-border px-4 py-2 text-sm font-medium">
                  <Check className="mr-2 h-4 w-4" />
                  no action needed
                </div>
              )}
            </>
          ) : null}
        </section>
      </div>
    </main>
  )
}
