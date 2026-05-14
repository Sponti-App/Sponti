"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { AuthFrame } from "@/components/auth-frame"
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

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (submitting) return
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

  const canSubmit = displayName && username && email && password.length >= 8

  return (
    <AuthFrame
      title="join sponti"
      subtitle="claim a handle and start lighting flares."
      footer={
        <span className="text-muted-foreground">
          already have an account?{" "}
          <Link href="/login" className="text-accent font-medium">
            sign in
          </Link>
        </span>
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="displayName" className="text-xs text-muted-foreground">
            your name
          </Label>
          <Input
            id="displayName"
            autoComplete="name"
            required
            minLength={2}
            maxLength={50}
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="username" className="text-xs text-muted-foreground">
            username
          </Label>
          <Input
            id="username"
            autoComplete="username"
            required
            minLength={3}
            maxLength={30}
            pattern="[a-zA-Z0-9_-]+"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
          <span className="text-[11px] text-muted-foreground">
            letters, numbers, _ and -
          </span>
        </div>
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
            autoComplete="new-password"
            required
            minLength={8}
            maxLength={100}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <span className="text-[11px] text-muted-foreground">at least 8 characters</span>
        </div>

        {error && (
          <p className="text-xs text-destructive" role="alert">
            {error}
          </p>
        )}

        <Button
          type="submit"
          disabled={submitting || !canSubmit}
          className="w-full rounded-full py-6 text-base bg-accent text-accent-foreground hover:bg-accent/90 disabled:opacity-40 mt-2"
        >
          {submitting ? "creating account…" : "create account"}
        </Button>
      </form>
    </AuthFrame>
  )
}
