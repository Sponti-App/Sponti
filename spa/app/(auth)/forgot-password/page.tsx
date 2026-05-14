"use client"

import { useState } from "react"
import Link from "next/link"
import { AuthFrame } from "@/components/auth-frame"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { forgotPassword } from "@/lib/api/auth"
import { HttpError } from "@/lib/http"

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [sent, setSent] = useState(false)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (submitting) return
    setError(null)
    setSubmitting(true)
    try {
      await forgotPassword(email.trim())
      setSent(true)
    } catch (err) {
      if (err instanceof HttpError) {
        setError(err.message)
      } else {
        setError("Something went wrong. Try again.")
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthFrame
      title="reset password"
      subtitle="enter your email and we'll send you a reset link."
      footer={
        <Link href="/login" className="text-accent font-medium">
          back to sign in
        </Link>
      }
    >
      {sent ? (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-foreground">
            check your inbox — if that email is registered you&apos;ll receive a reset link shortly.
          </p>
          <p className="text-xs text-muted-foreground">the link expires in 15 minutes.</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
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

          {error && (
            <p className="text-xs text-destructive" role="alert">
              {error}
            </p>
          )}

          <Button
            type="submit"
            disabled={submitting || !email}
            className="w-full rounded-full py-6 text-base bg-accent text-accent-foreground hover:bg-accent/90 disabled:opacity-40 mt-2"
          >
            {submitting ? "sending…" : "send reset link"}
          </Button>
        </form>
      )}
    </AuthFrame>
  )
}
