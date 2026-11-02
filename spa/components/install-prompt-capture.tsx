"use client"

import { useEffect } from "react"
import { captureInstallPrompt } from "@/lib/home-screen"

/** Mounted once in the root layout; renders nothing. See lib/home-screen. */
export function InstallPromptCapture() {
  useEffect(() => captureInstallPrompt(), [])
  return null
}
