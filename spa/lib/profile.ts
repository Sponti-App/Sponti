// Instagram and Telegram handles used to live only in this browser, under this
// key, as { [userId]: { instagram, telegram } }. They are real account fields
// now (#289), saved through PATCH /auth/me/profile. The key is only read so
// the edit page can offer to import what a device still holds, once.
const LEGACY_HANDLES_KEY = "sponti.profile.extras.v1"

export type LegacyHandles = {
  instagram: string
  telegram: string
}

type LegacyStore = Record<string, Partial<LegacyHandles> | undefined>

function readLegacyStore(): LegacyStore | null {
  try {
    const raw = window.localStorage.getItem(LEGACY_HANDLES_KEY)
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as LegacyStore)
      : null
  } catch {
    return null
  }
}

/** The handles an older version saved on this device for `userId`, if any. */
export function readLegacyHandles(userId: string): LegacyHandles | null {
  if (typeof window === "undefined") return null
  const entry = readLegacyStore()?.[userId]
  const instagram =
    typeof entry?.instagram === "string" ? entry.instagram.trim() : ""
  const telegram =
    typeof entry?.telegram === "string" ? entry.telegram.trim() : ""
  return instagram || telegram ? { instagram, telegram } : null
}

/**
 * Forgets what this device held for `userId`. Other accounts' entries on a
 * shared device are left alone; the key itself goes once it is empty.
 */
export function clearLegacyHandles(userId: string): void {
  if (typeof window === "undefined") return
  try {
    const store = readLegacyStore()
    if (store) delete store[userId]
    if (!store || Object.keys(store).length === 0) {
      window.localStorage.removeItem(LEGACY_HANDLES_KEY)
    } else {
      window.localStorage.setItem(LEGACY_HANDLES_KEY, JSON.stringify(store))
    }
  } catch {
    // Storage blocked: nothing was readable either, so there is nothing to offer.
  }
}

export type ProfileFieldErrors = {
  bio?: string
  instagram?: string
  telegram?: string
  /** Anything that is not about one of the three fields. */
  general?: string
}

/**
 * Splits an auth-server error into per-field messages. A 400 from the zod
 * validator reads "✖ <message>\n  → at <field>" (one block per issue); other
 * errors ("username already taken") are a single line and land in `general`.
 * Lowercased, since product copy is.
 */
export function parseProfileErrors(message: string): ProfileFieldErrors {
  const errors: ProfileFieldErrors = {}
  const lines = message.split("\n")
  const fields = ["bio", "instagram", "telegram"] as const
  let pending: string[] = []
  let matched = false

  for (const line of lines) {
    const at = /^\s*→ at (\w+)/.exec(line)
    if (at) {
      const field = fields.find((f) => f === at[1])
      const text = pending.join(" ").toLowerCase()
      if (field && text) {
        errors[field] = text
        matched = true
      } else if (text) {
        errors.general = text
        matched = true
      }
      pending = []
    } else if (line.trim()) {
      pending.push(line.replace(/^\s*✖\s*/, "").trim())
    }
  }

  if (!matched) {
    const text = message.replace(/✖\s*/g, "").trim().toLowerCase()
    if (text) errors.general = text
  }
  return errors
}

export function normalizeUsername(value: string): string {
  return value.trim().replace(/^@+/, "")
}

export function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return "?"
  if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase()
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
}

export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result
      if (typeof result === "string") {
        resolve(result)
      } else {
        reject(new Error("Unable to read file"))
      }
    }
    reader.onerror = () => reject(new Error("Unable to read file"))
    reader.readAsDataURL(file)
  })
}
