"use client"

import { ContactLinkScreen } from "@/components/contact-link-screen"

// Scanned in person: connecting makes you friends right away (#124).
export default function QrContactPage() {
  return <ContactLinkScreen kind="qr" />
}
