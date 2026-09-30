"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, AtSign, MessageSquareText } from "lucide-react"
import { useActionFeedback } from "@/components/action-feedback"
import { useAuth } from "@/components/auth-provider"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { me, updateProfile, type UpdateProfilePayload } from "@/lib/api/auth"
import { getRefreshToken, getToken, setSession } from "@/lib/auth-store"
import type { AuthUser } from "@/lib/auth-store"
import {
  clearLegacyHandles,
  parseProfileErrors,
  readLegacyHandles,
  type ProfileFieldErrors,
} from "@/lib/profile"
import {
  BIO_MAX_LENGTH,
  bioLength,
  collapseBioLines,
  normalizeBio,
  normalizeInstagram,
  normalizeTelegram,
  type ProfileFieldResult,
  type SocialNetwork,
} from "@/lib/social-handles"

// #289: the signed-in user's own bio, Instagram and Telegram handle. They are
// auth-server fields (PATCH /auth/me/profile), not browser storage. Who can
// see them is decided by api/, not here.

type FieldName = "bio" | "instagram" | "telegram"
type Form = Record<FieldName, string>
// What the server holds: the normalised value, null when not set.
type Saved = Record<FieldName, string | null>

const FIELDS: FieldName[] = ["bio", "instagram", "telegram"]

const NORMALIZERS: Record<FieldName, (raw: string) => ProfileFieldResult> = {
  bio: normalizeBio,
  instagram: normalizeInstagram,
  telegram: normalizeTelegram,
}

const LINK_HOST: Record<SocialNetwork, string> = {
  instagram: "instagram.com",
  telegram: "t.me",
}

const EMPTY_TOUCHED: Record<FieldName, boolean> = {
  bio: false,
  instagram: false,
  telegram: false,
}

function savedFrom(user: AuthUser): Saved {
  return {
    bio: user.bio ?? null,
    instagram: user.instagram ?? null,
    telegram: user.telegram ?? null,
  }
}

function formFrom(saved: Saved): Form {
  return {
    bio: saved.bio ?? "",
    instagram: saved.instagram ?? "",
    telegram: saved.telegram ?? "",
  }
}

// The session user only carries these once GET /auth/me has answered; sign-in
// responses leave them out, so undefined means "not loaded yet", not "empty".
const hasProfileFields = (user: AuthUser) =>
  user.bio !== undefined ||
  user.instagram !== undefined ||
  user.telegram !== undefined

// ─── Page ───────────────────────────────────────────────────────────────────
export default function EditProfilePage() {
  const { user } = useAuth()
  if (!user) return null
  return <EditProfileContent key={user.id} user={user} />
}

function EditProfileContent({ user }: { user: AuthUser }) {
  const router = useRouter()
  const { showActionFeedback } = useActionFeedback()

  // `saved` is what the server holds; null until it has been read.
  const [saved, setSaved] = useState<Saved | null>(() =>
    hasProfileFields(user) ? savedFrom(user) : null
  )
  const [loadFailed, setLoadFailed] = useState(false)
  const [loadTick, setLoadTick] = useState(0)
  const [form, setForm] = useState<Form>(() =>
    hasProfileFields(user)
      ? formFrom(savedFrom(user))
      : { bio: "", instagram: "", telegram: "" }
  )
  const [touched, setTouched] = useState(EMPTY_TOUCHED)
  const [serverErrors, setServerErrors] = useState<ProfileFieldErrors>({})
  const [submitting, setSubmitting] = useState(false)
  // Handles an older version kept only in this browser (#289). Offered once.
  const [legacy, setLegacy] = useState(() => readLegacyHandles(user.id))

  const needsLoad = saved === null
  useEffect(() => {
    if (!needsLoad) return
    let cancelled = false
    me()
      .then(({ user: fresh }) => {
        if (cancelled) return
        const next = savedFrom(fresh)
        setSaved(next)
        setForm(formFrom(next))
        setLoadFailed(false)
        const token = getToken()
        const refreshToken = getRefreshToken()
        if (token && refreshToken) setSession(token, refreshToken, fresh)
      })
      .catch((err) => {
        if (cancelled) return
        console.error("[Sponti] failed to load the profile fields", err)
        setLoadFailed(true)
      })
    return () => {
      cancelled = true
    }
  }, [needsLoad, loadTick])

  // What could be imported: a device handle only fills a field the account has
  // not set, so an import never overwrites what the server holds.
  const offer = {
    instagram:
      saved && saved.instagram === null ? (legacy?.instagram ?? "") : "",
    telegram: saved && saved.telegram === null ? (legacy?.telegram ?? "") : "",
  }
  const showOffer = Boolean(offer.instagram || offer.telegram)

  // Old handles with nothing left to import (the account already has its own,
  // or there were none to begin with): just forget them.
  const settled = saved !== null
  const staleLegacy = settled && legacy !== null && !showOffer
  useEffect(() => {
    if (staleLegacy) clearLegacyHandles(user.id)
  }, [staleLegacy, user.id])

  const results = {
    bio: NORMALIZERS.bio(form.bio),
    instagram: NORMALIZERS.instagram(form.instagram),
    telegram: NORMALIZERS.telegram(form.telegram),
  }

  // The fields that would go to the server: what the form normalises to, where
  // that differs from what the server holds.
  const changed = FIELDS.filter((name) => {
    const result = results[name]
    return saved !== null && (!result.ok || result.value !== saved[name])
  })
  const dirty = changed.length > 0

  const editField = (name: FieldName, raw: string) => {
    const value = name === "bio" ? collapseBioLines(raw) : raw
    setForm((prev) => ({ ...prev, [name]: value }))
    setServerErrors((prev) => ({
      ...prev,
      [name]: undefined,
      general: undefined,
    }))
  }

  const touch = (name: FieldName) =>
    setTouched((prev) => (prev[name] ? prev : { ...prev, [name]: true }))

  const acceptOffer = () => {
    setForm((prev) => ({
      ...prev,
      instagram: offer.instagram || prev.instagram,
      telegram: offer.telegram || prev.telegram,
    }))
    clearLegacyHandles(user.id)
    setLegacy(null)
    showActionFeedback("added · press save to keep them")
  }

  const dismissOffer = () => {
    clearLegacyHandles(user.id)
    setLegacy(null)
  }

  const handleSave = async () => {
    if (submitting || saved === null || !dirty) return
    setTouched({ bio: true, instagram: true, telegram: true })
    if (FIELDS.some((name) => !results[name].ok)) return

    const payload: UpdateProfilePayload = {}
    for (const name of changed) {
      const result = results[name]
      if (result.ok) payload[name] = result.value
    }

    setSubmitting(true)
    setServerErrors({})
    try {
      const { user: updated } = await updateProfile(payload)
      const token = getToken()
      const refreshToken = getRefreshToken()
      if (token && refreshToken) setSession(token, refreshToken, updated)
      // Show what the server stored, e.g. the bare handle for a pasted link.
      const next = savedFrom(updated)
      setSaved(next)
      setForm(formFrom(next))
      setTouched(EMPTY_TOUCHED)
      showActionFeedback("profile saved")
    } catch (err) {
      const message = err instanceof Error ? err.message : ""
      const parsed = message
        ? parseProfileErrors(message)
        : { general: "could not save your profile" }
      setServerErrors(parsed)
      showActionFeedback("couldn't save that", { tone: "error" })
    } finally {
      setSubmitting(false)
    }
  }

  const disabled = saved === null || submitting

  return (
    <div className="relative flex min-h-dvh w-full flex-col bg-background">
      <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
        <button
          onClick={() => router.back()}
          aria-label="Back"
          className="flex h-9 w-9 items-center justify-center rounded-full border border-border"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <span className="text-base font-semibold">edit profile</span>
        <span className="h-9 w-9" aria-hidden />
      </div>

      <form
        className="flex-1 space-y-6 overflow-y-auto px-4 pt-5 pb-28"
        noValidate
        onSubmit={(event) => {
          event.preventDefault()
          void handleSave()
        }}
      >
        <p className="text-xs leading-relaxed text-muted-foreground">
          shown on your profile. if your profile is private, only your
          connections see them.
        </p>

        {loadFailed && (
          <div
            role="alert"
            className="flex items-center justify-between gap-3 border-l-[3px] border-l-destructive bg-muted/30 py-2 pr-2 pl-3"
          >
            <p className="text-sm text-destructive">
              couldn&apos;t load your profile
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="rounded-full"
              onClick={() => {
                setLoadFailed(false)
                setLoadTick((tick) => tick + 1)
              }}
            >
              try again
            </Button>
          </div>
        )}

        {showOffer && (
          <section
            aria-label="import handles from this device"
            className="space-y-3 border-l-[3px] border-l-accent bg-muted/30 py-3 pr-3 pl-3"
          >
            <div className="space-y-1">
              <p className="text-sm font-medium">
                found handles saved on this device
              </p>
              <p className="text-xs leading-relaxed text-muted-foreground">
                {[
                  offer.instagram && `instagram ${offer.instagram}`,
                  offer.telegram && `telegram ${offer.telegram}`,
                ]
                  .filter(Boolean)
                  .join(" · ")}
                . add them to this form? nothing is saved until you press save.
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                className="rounded-full"
                onClick={acceptOffer}
              >
                add them
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="rounded-full"
                onClick={dismissOffer}
              >
                no thanks
              </Button>
            </div>
          </section>
        )}

        <Section icon={MessageSquareText} label="about you">
          <BioField
            value={form.bio}
            disabled={disabled}
            result={results.bio}
            serverError={serverErrors.bio}
            showError={touched.bio}
            onChange={(value) => editField("bio", value)}
            onBlur={() => touch("bio")}
          />
        </Section>

        <Section icon={AtSign} label="social links">
          <div className="space-y-4">
            <HandleField
              network="instagram"
              label="instagram"
              value={form.instagram}
              disabled={disabled}
              result={results.instagram}
              serverError={serverErrors.instagram}
              showError={touched.instagram}
              onChange={(value) => editField("instagram", value)}
              onBlur={() => touch("instagram")}
            />
            <HandleField
              network="telegram"
              label="telegram"
              value={form.telegram}
              disabled={disabled}
              result={results.telegram}
              serverError={serverErrors.telegram}
              showError={touched.telegram}
              onChange={(value) => editField("telegram", value)}
              onBlur={() => touch("telegram")}
            />
          </div>
        </Section>

        {serverErrors.general && (
          <p role="alert" className="text-xs leading-relaxed text-destructive">
            {serverErrors.general}
          </p>
        )}

        <Button
          type="submit"
          className="w-full rounded-full bg-accent text-accent-foreground hover:bg-accent/90"
          disabled={disabled || !dirty}
        >
          {submitting ? "saving..." : "save changes"}
        </Button>
      </form>
    </div>
  )
}

// ─── Fields ─────────────────────────────────────────────────────────────────
function BioField({
  value,
  disabled,
  result,
  serverError,
  showError,
  onChange,
  onBlur,
}: {
  value: string
  disabled: boolean
  result: ProfileFieldResult
  serverError?: string
  showError: boolean
  onChange: (value: string) => void
  onBlur: () => void
}) {
  const length = bioLength(value)
  const over = length > BIO_MAX_LENGTH
  const error = serverError ?? (showError && !result.ok ? result.message : null)

  return (
    <div className="space-y-1.5">
      <Label htmlFor="profile-bio" className="text-xs text-muted-foreground">
        bio
      </Label>
      <Textarea
        id="profile-bio"
        rows={2}
        value={value}
        disabled={disabled}
        placeholder="one line about you"
        aria-invalid={error ? true : undefined}
        aria-describedby="profile-bio-hint"
        onChange={(event) => onChange(event.target.value)}
        onBlur={onBlur}
        onKeyDown={(event) => {
          // A one-line bio: Enter would only become a space.
          if (event.key === "Enter") event.preventDefault()
        }}
      />
      <div
        id="profile-bio-hint"
        className="flex items-start justify-between gap-3"
      >
        <p
          className={
            error
              ? "text-xs leading-relaxed text-destructive"
              : "text-xs leading-relaxed text-muted-foreground"
          }
        >
          {error ?? "one line · optional"}
        </p>
        <span
          aria-label={`${length} of ${BIO_MAX_LENGTH} characters`}
          className={
            over
              ? "shrink-0 text-xs text-destructive"
              : "shrink-0 text-xs text-muted-foreground"
          }
        >
          {length}/{BIO_MAX_LENGTH}
        </span>
      </div>
    </div>
  )
}

function HandleField({
  network,
  label,
  value,
  disabled,
  result,
  serverError,
  showError,
  onChange,
  onBlur,
}: {
  network: SocialNetwork
  label: string
  value: string
  disabled: boolean
  result: ProfileFieldResult
  serverError?: string
  showError: boolean
  onChange: (value: string) => void
  onBlur: () => void
}) {
  const id = `profile-${network}`
  const error = serverError ?? (showError && !result.ok ? result.message : null)

  let hint: string
  let tone = "text-muted-foreground"
  if (error) {
    hint = error
    tone = "text-destructive"
  } else if (!result.ok) {
    hint = "a handle like @yourname, or paste your profile link"
  } else if (result.value) {
    hint = `shows as @${result.value} · ${LINK_HOST[network]}/${result.value}`
  } else {
    hint = "optional · @handle or a profile link"
  }

  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-xs text-muted-foreground">
        {label}
      </Label>
      <Input
        id={id}
        value={value}
        disabled={disabled}
        placeholder={`@yourhandle or ${LINK_HOST[network]}/you`}
        inputMode="url"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        aria-invalid={error ? true : undefined}
        aria-describedby={`${id}-hint`}
        onChange={(event) => onChange(event.target.value)}
        onBlur={onBlur}
      />
      <p
        id={`${id}-hint`}
        className={`text-xs leading-relaxed break-words ${tone}`}
      >
        {hint}
      </p>
    </div>
  )
}

function Section({
  icon: Icon,
  label,
  children,
}: {
  icon: typeof AtSign
  label: string
  children: React.ReactNode
}) {
  return (
    <div>
      <div className="mb-3 flex items-center gap-1.5">
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-xs font-medium text-muted-foreground">
          {label}
        </span>
      </div>
      {children}
    </div>
  )
}
