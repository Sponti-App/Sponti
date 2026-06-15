"use client"

import { useEffect, useRef } from "react"
import { useTheme } from "next-themes"

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
              theme: "outline" | "filled_black"
              size: "large"
              type: "standard"
              text: "continue_with"
              shape: "pill"
              logo_alignment: "left"
              width: number
            }
          ) => void
        }
      }
    }
    __spontiGoogleAuth?: {
      clientId?: string
      onCredential?: (credential: string) => void
    }
  }
}

type GoogleAuthButtonProps = {
  onCredential: (credential: string) => void
  disabled?: boolean
}

const SCRIPT_ID = "google-identity-services"
const SCRIPT_SRC = "https://accounts.google.com/gsi/client"
const MIN_BUTTON_WIDTH = 240
const MAX_BUTTON_WIDTH = 400

export function GoogleAuthButton({
  onCredential,
  disabled,
}: GoogleAuthButtonProps) {
  const buttonRef = useRef<HTMLDivElement>(null)
  const { resolvedTheme } = useTheme()
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID
  const missingClientId = !clientId
  const buttonTheme = resolvedTheme === "dark" ? "filled_black" : "outline"

  useEffect(() => {
    if (disabled) return

    if (!clientId) return

    let cancelled = false
    let renderedWidth: number | null = null
    let animationFrame: number | null = null
    let scriptWithLoadListener: HTMLElement | null = null

    const render = () => {
      animationFrame = null
      if (cancelled || !buttonRef.current || !window.google?.accounts?.id) {
        return
      }

      const width = Math.min(
        MAX_BUTTON_WIDTH,
        Math.max(
          MIN_BUTTON_WIDTH,
          Math.floor(buttonRef.current.getBoundingClientRect().width)
        )
      )

      if (renderedWidth === width && buttonRef.current.hasChildNodes()) {
        return
      }

      renderedWidth = width
      buttonRef.current.innerHTML = ""

      const authState = (window.__spontiGoogleAuth ??= {})
      authState.onCredential = onCredential

      if (authState.clientId !== clientId) {
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: (response) => {
            if (response.credential) {
              window.__spontiGoogleAuth?.onCredential?.(response.credential)
            }
          },
        })
        authState.clientId = clientId
      }

      window.google.accounts.id.renderButton(buttonRef.current, {
        theme: buttonTheme,
        size: "large",
        type: "standard",
        text: "continue_with",
        shape: "pill",
        logo_alignment: "left",
        width,
      })
    }

    const scheduleRender = () => {
      if (animationFrame !== null) {
        window.cancelAnimationFrame(animationFrame)
      }
      animationFrame = window.requestAnimationFrame(render)
    }

    const existingScript = document.getElementById(SCRIPT_ID)
    if (existingScript) {
      scriptWithLoadListener = existingScript
      existingScript.addEventListener("load", scheduleRender, { once: true })
      render()
    } else {
      const script = document.createElement("script")
      script.id = SCRIPT_ID
      script.src = SCRIPT_SRC
      script.async = true
      script.defer = true
      scriptWithLoadListener = script
      script.addEventListener("load", scheduleRender, { once: true })
      document.head.appendChild(script)
    }

    const resizeObserver =
      buttonRef.current && "ResizeObserver" in window
        ? new ResizeObserver(scheduleRender)
        : null

    if (buttonRef.current) {
      resizeObserver?.observe(buttonRef.current)
    }

    return () => {
      cancelled = true
      if (window.__spontiGoogleAuth?.onCredential === onCredential) {
        window.__spontiGoogleAuth.onCredential = undefined
      }
      if (animationFrame !== null) {
        window.cancelAnimationFrame(animationFrame)
      }
      resizeObserver?.disconnect()
      scriptWithLoadListener?.removeEventListener("load", scheduleRender)
    }
  }, [buttonTheme, clientId, disabled, onCredential])

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
      className={`flex min-h-10 w-full justify-center overflow-hidden rounded-full ${
        disabled ? "pointer-events-none opacity-50" : ""
      }`}
    />
  )
}
