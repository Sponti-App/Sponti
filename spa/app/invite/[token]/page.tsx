"use client"

import { ContactLinkScreen } from "@/components/contact-link-screen"

// Opened from a group chat: sends the owner a friend request (#124).
export default function InviteLinkPage() {
  return <ContactLinkScreen kind="invite" />
}
