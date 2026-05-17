"use client"

import { useEffect, useRef } from "react"

declare global {
  interface Window {
    google?: {
      accounts?: {
        id?: {
          initialize: (config: {
            client_id: string
            callback: (response: { credential?: string }) => void
          }) => void
          renderButton: (
            parent: HTMLElement,
            options: {
              theme: "outline"
              size: "large"
              type: "standard"
              text: "continue_with"
              shape: "pill"
              width: number
            }
          ) => void
        }
      }
    }
  }
}

type GoogleAuthButtonProps = {
  onCredential: (credential: string) => void
  disabled?: boolean
}

const SCRIPT_ID = "google-identity-services"
const SCRIPT_SRC = "https://accounts.google.com/gsi/client"

export function GoogleAuthButton({
  onCredential,
  disabled,
}: GoogleAuthButtonProps) {
  const buttonRef = useRef<HTMLDivElement>(null)
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID
  const missingClientId = !clientId

  useEffect(() => {
    if (disabled) return

    if (!clientId) return

    let cancelled = false

    const render = () => {
      if (cancelled || !buttonRef.current || !window.google?.accounts?.id) {
        return
      }

      const width = Math.max(240, Math.floor(buttonRef.current.offsetWidth))
      buttonRef.current.innerHTML = ""
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: (response) => {
          if (response.credential) onCredential(response.credential)
        },
      })
      window.google.accounts.id.renderButton(buttonRef.current, {
        theme: "outline",
        size: "large",
        type: "standard",
        text: "continue_with",
        shape: "pill",
        width,
      })
    }

    const existingScript = document.getElementById(SCRIPT_ID)
    if (existingScript) {
      existingScript.addEventListener("load", render, { once: true })
      render()
    } else {
      const script = document.createElement("script")
      script.id = SCRIPT_ID
      script.src = SCRIPT_SRC
      script.async = true
      script.defer = true
      script.addEventListener("load", render, { once: true })
      document.head.appendChild(script)
    }

    return () => {
      cancelled = true
    }
  }, [clientId, disabled, onCredential])

  if (missingClientId) {
    return (
      <button
        type="button"
        disabled
        className="h-11 w-full rounded-full border border-border bg-background text-sm text-muted-foreground"
      >
        Google sign-in is not configured
      </button>
    )
  }

  return (
    <div
      ref={buttonRef}
      aria-disabled={disabled}
      className={disabled ? "pointer-events-none opacity-50" : undefined}
    />
  )
}
