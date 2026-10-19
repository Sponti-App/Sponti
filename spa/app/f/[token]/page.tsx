"use client"

import { Suspense, useMemo } from "react"
import { useParams, useSearchParams } from "next/navigation"
import { FlareInviteScreen } from "@/components/flare-invite-screen"
import { FLARE_INVITE_REDEEM_PARAM } from "@/lib/flare-invite-links"

// A flare's own invite link, sent by its host (#616). Open to signed-out
// visitors (AuthGate), who see who invited them and sign up from here.
export default function FlareInvitePage() {
  return (
    <Suspense fallback={null}>
      <FlareInviteRoute />
    </Suspense>
  )
}

function FlareInviteRoute() {
  const params = useParams<{ token: string }>()
  const search = useSearchParams()
  const token = useMemo(() => {
    try {
      return decodeURIComponent(params.token)
    } catch {
      return params.token
    }
  }, [params.token])

  return (
    <FlareInviteScreen
      token={token}
      redeemOnOpen={search.get(FLARE_INVITE_REDEEM_PARAM) === "1"}
    />
  )
}
