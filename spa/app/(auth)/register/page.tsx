"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowRight, Flame } from "lucide-react"
import { useAuth } from "@/components/auth-provider"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { HttpError } from "@/lib/http"
import { markHomeTourPending } from "@/lib/onboarding"

export default function RegisterPage() {
  const router = useRouter()
  const { register } = useAuth()
  const [displayName, setDisplayName] = useState("")
  const [username, setUsername] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const usernameValid = /^[a-zA-Z0-9_-]{3,30}$/.test(username)
  const usernameError =
    username && !usernameValid
      ? username.length < 3
        ? "Use at least 3 characters."
        : "Use letters, numbers, _ or -."
      : null
  const passwordError =
    password && password.length < 8 ? "Use at least 8 characters." : null
  const canSubmit = Boolean(
    displayName.trim() &&
      usernameValid &&
      email.trim() &&
      password.length >= 8
  )
  const missingRequirements = canSubmit
    ? "Create account"
    : "Enter a name, valid username, email, and an 8 character password."

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (submitting) return
    if (!canSubmit) {
      setError(missingRequirements)
      return
    }
    setError(null)
    setSubmitting(true)
    try {
      await register({
        displayName: displayName.trim(),
        username: username.trim(),
        email: email.trim(),
        password,
      })
      markHomeTourPending()
      router.replace("/")
    } catch (err) {
      if (err instanceof HttpError) {
        setError(err.message)
      } else {
        setError("Something went wrong. Try again.")
      }
      setSubmitting(false)
    }
  }

  return (
    <main className="flex min-h-dvh w-full flex-col overflow-hidden bg-background text-foreground">
      <style>{`
        .sponti-register-mark::after {
          content: "";
          position: absolute;
          inset: -3px;
          border-radius: 999px;
          border: 1.5px solid var(--accent);
          animation: sponti-register-pulse 2.6s ease-out infinite;
        }

        @keyframes sponti-register-pulse {
          0% { transform: scale(.85); opacity: .55; }
          100% { transform: scale(1.35); opacity: 0; }
        }

        @media (prefers-reduced-motion: reduce) {
          .sponti-register-mark::after {
            animation-duration: 200ms !important;
            animation-iteration-count: 1 !important;
          }
        }
      `}</style>

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-6 pt-8 pb-6">
        <header className="mb-6">
          <div className="mb-5 flex items-center gap-2.5">
            <span className="sponti-register-mark relative flex size-7 items-center justify-center rounded-full bg-accent text-accent-foreground shadow-sm">
              <Flame className="size-3.5" />
            </span>
            <span className="text-sm font-semibold tracking-normal">Sponti</span>
          </div>
          <div className="mb-4 inline-flex items-center gap-2 text-xs font-medium tracking-normal text-accent">
            <span className="h-px w-3.5 bg-accent" />
            last step
          </div>
          <h1 className="text-[28px] leading-[1.08] font-bold tracking-normal">
            Claim your handle.
          </h1>
        </header>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="flex flex-col gap-3.5">
            <Field label="your name" htmlFor="displayName">
              <Input
                id="displayName"
                autoComplete="name"
                required
                minLength={2}
                maxLength={50}
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="h-[46px] rounded-xl"
              />
            </Field>

            <Field label="username" htmlFor="username">
              <Input
                id="username"
                autoComplete="username"
                required
                minLength={3}
                maxLength={30}
                pattern="[a-zA-Z0-9_-]+"
                value={username}
                onChange={(e) =>
                  setUsername(e.target.value.toLowerCase().replace(/\s/g, ""))
                }
                className="h-[46px] rounded-xl"
              />
              {usernameValid ? (
                <p className="mt-1.5 text-xs text-muted-foreground">
                  your flares show as{" "}
                  <span className="font-semibold text-accent">@{username}</span>
                </p>
              ) : usernameError ? (
                <p className="mt-1.5 text-xs text-destructive" role="alert">
                  {usernameError}
                </p>
              ) : null}
            </Field>

            <Field label="email" htmlFor="email">
              <Input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-[46px] rounded-xl"
              />
            </Field>

            <Field label="password" htmlFor="password">
              <Input
                id="password"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                maxLength={100}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-[46px] rounded-xl"
              />
              {passwordError && (
                <p className="mt-1 text-xs text-destructive" role="alert">
                  {passwordError}
                </p>
              )}
            </Field>
          </div>

          {error && (
            <p className="mt-4 text-xs text-destructive" role="alert">
              {error}
            </p>
          )}

          <div className="mt-auto pt-6 pb-8">
            <Button
              type="submit"
              disabled={submitting || !canSubmit}
              title={missingRequirements}
              className="h-[52px] w-full rounded-full bg-accent text-[15px] text-accent-foreground hover:bg-accent/90 disabled:opacity-40"
            >
              {submitting ? "creating account…" : "Create account"}
              {!submitting && <ArrowRight className="size-4" />}
            </Button>

            <p className="mt-4 text-center text-[11.5px] leading-5 text-muted-foreground">
              By continuing, you agree to Sponti&apos;s{" "}
              <Link href="/menu/terms" className="text-foreground underline underline-offset-2">
                Terms
              </Link>{" "}
              and{" "}
              <Link href="/menu/privacy" className="text-foreground underline underline-offset-2">
                Privacy
              </Link>
              .
            </p>

            <p className="mt-5 text-center text-sm text-muted-foreground">
              already have an account?{" "}
              <Link href="/login" className="font-medium text-accent">
                sign in
              </Link>
            </p>
          </div>
        </form>
      </div>
    </main>
  )
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string
  htmlFor: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col">
      <Label
        htmlFor={htmlFor}
        className="mb-2 text-xs font-medium tracking-normal text-muted-foreground"
      >
        {label}
      </Label>
      {children}
    </div>
  )
}
