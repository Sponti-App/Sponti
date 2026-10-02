// #300: what the visitor has typed into the register form, kept for this tab
// only, so following the terms / privacy / impressum links and coming back
// doesn't empty the form. The password is never part of the draft: the type
// has no field for it, and both read and write pick the three fields by name,
// so nothing else can reach storage.
//
// Every storage call is wrapped, because sessionStorage can be missing or
// throw (private windows, blocked site data). Then the form simply starts
// empty, as it did before.

export const REGISTER_DRAFT_KEY = "sponti.register.draft.v1"

export type RegisterDraft = {
  displayName: string
  username: string
  email: string
}

function pick(source: Partial<Record<keyof RegisterDraft, unknown>>) {
  const text = (value: unknown) => (typeof value === "string" ? value : "")
  return {
    displayName: text(source.displayName),
    username: text(source.username),
    email: text(source.email),
  } satisfies RegisterDraft
}

/** The saved draft, or null when there is none (or storage can't be read). */
export function readRegisterDraft(): RegisterDraft | null {
  try {
    const raw = window.sessionStorage.getItem(REGISTER_DRAFT_KEY)
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== "object") return null
    return pick(parsed as Record<string, unknown>)
  } catch {
    return null
  }
}

/** Saves the draft. An all-empty draft removes the key instead. */
export function writeRegisterDraft(draft: RegisterDraft): void {
  const clean = pick(draft)
  try {
    if (!clean.displayName && !clean.username && !clean.email) {
      window.sessionStorage.removeItem(REGISTER_DRAFT_KEY)
      return
    }
    window.sessionStorage.setItem(REGISTER_DRAFT_KEY, JSON.stringify(clean))
  } catch {
    // Not stored: the form still works, it just won't survive a page change.
  }
}

/** Forgets the draft, after a successful sign-up. */
export function clearRegisterDraft(): void {
  try {
    window.sessionStorage.removeItem(REGISTER_DRAFT_KEY)
  } catch {
    // Nothing to clear if storage can't be reached.
  }
}
