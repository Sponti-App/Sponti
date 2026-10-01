// Client-side twin of auth-server/src/lib/profileFields.ts (#289). The server
// is the authority: it normalises again on save and rejects what this lets
// through. This copy exists so the edit form can show the stored handle and
// the rule live, before anything is sent. Keep the two in step: the unit test
// runs the same cases as auth-server/test/profileFields.test.ts.
//
// Handles are stored as the bare, lowercased handle (no "@", no URL). The
// input may be "@handle", a bare handle, or a pasted profile link.

export const BIO_MAX_LENGTH = 80

export type SocialNetwork = "instagram" | "telegram"

export type ProfileFieldResult =
  | { ok: true; value: string | null }
  | { ok: false; message: string }

type Network = {
  label: string
  // Hosts whose single-segment path is a profile link, e.g. instagram.com/<h>.
  hosts: string[]
  pattern: RegExp
  rule: string
}

const NETWORKS: Record<SocialNetwork, Network> = {
  instagram: {
    label: "instagram",
    hosts: ["instagram.com", "www.instagram.com"],
    // 1–30 of [a-z0-9._], no leading, trailing or consecutive dots.
    pattern: /^(?!\.)(?!.*\.\.)(?!.*\.$)[a-z0-9._]{1,30}$/,
    rule: "1–30 letters, numbers, periods or underscores, and cannot start or end with a period or contain two in a row",
  },
  telegram: {
    label: "telegram",
    hosts: ["t.me", "www.t.me", "telegram.me", "www.telegram.me"],
    // 5–32 of [a-z0-9_], starting with a letter.
    pattern: /^[a-z][a-z0-9_]{4,31}$/,
    rule: "5–32 letters, numbers or underscores, starting with a letter",
  },
}

// "instagram.com/x", "https://www.instagram.com/x/?igsh=…", "t.me/x" …
const LINK_PATTERN = /^(?:https?:\/\/)?([^/?#\s]+)(\/[^?#]*)?(?:[?#].*)?$/i

function extractHandle(input: string, network: Network): ProfileFieldResult {
  const link = LINK_PATTERN.exec(input)
  const host = link?.[1]?.toLowerCase()

  if (
    link &&
    host &&
    (network.hosts.includes(host) || /^https?:\/\//i.test(input))
  ) {
    if (!network.hosts.includes(host)) {
      return {
        ok: false,
        message: `${network.label} must be a handle or a ${network.hosts[0]} profile link`,
      }
    }

    const segments = (link[2] ?? "").split("/").filter(Boolean)

    if (segments.length !== 1) {
      return {
        ok: false,
        message: `${network.label} link must point to a profile, like ${network.hosts[0]}/yourname`,
      }
    }

    return { ok: true, value: segments[0] }
  }

  return { ok: true, value: input }
}

/**
 * The handle the server would store for what the user typed: `null` for an
 * empty field, the bare lowercased handle for a valid one, or the reason it
 * would be refused.
 */
export function normalizeHandle(
  raw: string | null,
  networkName: SocialNetwork
): ProfileFieldResult {
  const network = NETWORKS[networkName]
  if (raw === null) return { ok: true, value: null }

  const trimmed = raw.trim()
  if (trimmed === "") return { ok: true, value: null }

  const extracted = extractHandle(trimmed, network)
  if (!extracted.ok) return extracted

  const handle = (extracted.value ?? "").replace(/^@/, "").toLowerCase()

  if (!network.pattern.test(handle)) {
    return {
      ok: false,
      message: `${network.label} handle must be ${network.rule}`,
    }
  }

  return { ok: true, value: handle }
}

export const normalizeInstagram = (raw: string | null) =>
  normalizeHandle(raw, "instagram")

export const normalizeTelegram = (raw: string | null) =>
  normalizeHandle(raw, "telegram")

/** A bio is one line: line breaks become a single space. */
export function collapseBioLines(raw: string): string {
  return raw.replace(/\s*[\r\n]+\s*/g, " ")
}

/** Characters as the server counts them: code points, so an emoji is one. */
export function bioLength(raw: string): number {
  return Array.from(collapseBioLines(raw).trim()).length
}

export function normalizeBio(raw: string | null): ProfileFieldResult {
  if (raw === null) return { ok: true, value: null }

  const bio = collapseBioLines(raw).trim()
  if (bio === "") return { ok: true, value: null }

  if (Array.from(bio).length > BIO_MAX_LENGTH) {
    return {
      ok: false,
      message: `bio must be ${BIO_MAX_LENGTH} characters or fewer`,
    }
  }

  return { ok: true, value: bio }
}
