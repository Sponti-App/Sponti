"use client"

import { useState } from "react"
import Link from "next/link"
import { AuthFrame } from "@/components/auth-frame"
import { useAuth } from "@/components/auth-provider"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { HttpError } from "@/lib/http"

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
          <Label htmlFor="password" className="text-xs text-muted-foreground">
            password
          </Label>
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
