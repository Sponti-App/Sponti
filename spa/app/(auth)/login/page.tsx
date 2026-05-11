"use client"

import { Suspense, useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { AuthFrame } from "@/components/auth-frame"
import { useAuth } from "@/components/auth-provider"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { HttpError } from "@/lib/http"

function ResetSuccessBanner() {
  const searchParams = useSearchParams()
  if (searchParams.get("reset") !== "1") return null
  return (
    <p className="text-xs text-green-600 bg-green-50 border border-green-200 rounded-lg px-3 py-2" role="status">
      password updated — sign in with your new password.
    </p>
  )
}

export default function LoginPage() {
  const { login } = useAuth()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (submitting) return
    setError(null)
    setSubmitting(true)
    try {
      await login(email.trim(), password)
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
    <AuthFrame
      title="welcome back"
      subtitle="sign in to light a flare with your friends."
      footer={
        <span className="text-muted-foreground">
          no account?{" "}
          <Link href="/register" className="text-accent font-medium">
            register
          </Link>
        </span>
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Suspense>
          <ResetSuccessBanner />
        </Suspense>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="email" className="text-xs text-muted-foreground">
            email
          </Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="password" className="text-xs text-muted-foreground">
              password
            </Label>
            <Link href="/forgot-password" className="text-xs text-accent">
              forgot password?
            </Link>
          </div>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        {error && (
          <p className="text-xs text-destructive" role="alert">
            {error}
          </p>
        )}

        <Button
          type="submit"
          disabled={submitting || !email || !password}
          className="w-full rounded-full py-6 text-base bg-accent text-accent-foreground hover:bg-accent/90 disabled:opacity-40 mt-2"
        >
          {submitting ? "signing in…" : "sign in"}
        </Button>
      </form>
    </AuthFrame>
  )
}
