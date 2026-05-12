"use client"

import { useState, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { AuthFrame } from "@/components/auth-frame"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { resetPassword } from "@/lib/api/auth"
import { HttpError } from "@/lib/http"

function ResetPasswordForm() {
  const searchParams = useSearchParams()
  const token = searchParams.get("token") ?? ""
  const router = useRouter()

  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const mismatch = confirm.length > 0 && password !== confirm

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (submitting || mismatch) return
    if (!token) {
      setError("Reset link is missing or invalid. Request a new one.")
      return
    }
    setError(null)
    setSubmitting(true)
    try {
      await resetPassword(token, password)
      router.replace("/login?reset=1")
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
      title="new password"
      subtitle="choose a new password for your account."
      footer={
        <Link href="/login" className="text-accent font-medium">
          back to sign in
        </Link>
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="password" className="text-xs text-muted-foreground">
            new password
          </Label>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="confirm" className="text-xs text-muted-foreground">
            confirm password
          </Label>
          <Input
            id="confirm"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
          {mismatch && (
            <p className="text-xs text-destructive" role="alert">
              passwords do not match
            </p>
          )}
        </div>

        {error && (
          <p className="text-xs text-destructive" role="alert">
            {error}
          </p>
        )}

        <Button
          type="submit"
          disabled={submitting || !password || !confirm || mismatch}
          className="w-full rounded-full py-6 text-base bg-accent text-accent-foreground hover:bg-accent/90 disabled:opacity-40 mt-2"
        >
          {submitting ? "updating…" : "update password"}
        </Button>
      </form>
    </AuthFrame>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <ResetPasswordForm />
    </Suspense>
  )
}
