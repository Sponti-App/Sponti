// PROTOTYPE (#166): local mock people. No backend.

export type Network = "instagram" | "telegram"

export type MockPerson = {
  id: string
  username: string
  displayName: string
  // Google sign-in photo only, per the #166 scope. An inline SVG stands in
  // for it so the prototype needs no network.
  avatarUrl: string | null
  bio: string
  socials: { network: Network; handle: string }[]
  profileVisibility: "public" | "private"
}

const photo = (from: string, to: string) =>
  `data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/></linearGradient></defs><rect width="80" height="80" fill="url(#g)"/><circle cx="40" cy="32" r="14" fill="#fff" fill-opacity=".85"/><path d="M14 80c2-18 13-26 26-26s24 8 26 26z" fill="#fff" fill-opacity=".85"/></svg>`
  )}`

export const THEM: MockPerson = {
  id: "user-sarah",
  username: "sarah",
  displayName: "Sarah Kim",
  avatarUrl: photo("#f3a683", "#a55eea"),
  bio: "always up for a late swim or a cheap pint",
  socials: [
    { network: "instagram", handle: "sarah.kim" },
    { network: "telegram", handle: "sarahkim" },
  ],
  profileVisibility: "public",
}

export const ME: MockPerson = {
  id: "user-me",
  username: "flaretester",
  displayName: "Flare Tester",
  avatarUrl: null,
  bio: "",
  socials: [{ network: "instagram", handle: "flare.tester" }],
  profileVisibility: "private",
}

export const BIO_MAX = 80

// Format checks only, never "does the account exist" (per #166).
export const HANDLE_RULES: Record<Network, { pattern: RegExp; hint: string }> =
  {
    instagram: {
      pattern: /^(?!.*\.\.)(?!\.)(?!.*\.$)[a-z0-9._]{1,30}$/i,
      hint: "letters, numbers, . and _ · up to 30",
    },
    telegram: {
      pattern: /^[a-z][a-z0-9_]{4,31}$/i,
      hint: "5–32 letters, numbers and _ · starts with a letter",
    },
  }

/** Accepts "@handle", "handle" or a pasted profile url; returns the handle. */
export function normalizeHandle(network: Network, raw: string): string {
  const trimmed = raw.trim()
  const host =
    network === "instagram"
      ? /(?:instagram\.com)\/([^/?#]+)/i
      : /(?:t\.me)\/([^/?#]+)/i
  const fromUrl = trimmed.match(host)?.[1]
  return (fromUrl ?? trimmed).replace(/^@+/, "")
}
