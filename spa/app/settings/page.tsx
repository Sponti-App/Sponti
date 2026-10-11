"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  ArrowLeftIcon,
  BellIcon,
  CameraIcon,
  CaretRightIcon,
  ClockIcon,
  LinkIcon,
  LockIcon,
  SignOutIcon,
  MapPinIcon,
  MoonIcon,
  ShieldIcon,
  SparkleIcon,
  SunIcon,
  UploadSimpleIcon,
  UserIcon,
  type Icon,
} from "@/components/icons"
import { useTheme } from "next-themes"
import { useActionFeedback } from "@/components/action-feedback"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Switch } from "@/components/ui/switch"
import { useAuth } from "@/components/auth-provider"
import { updateProfile, uploadAvatar } from "@/lib/api/auth"
import {
  fetchNotificationSettings,
  updateNotificationSettings,
  type NotificationSettings as NotificationSettingsSchema,
} from "@/lib/api/notification-settings"
import { HttpError } from "@/lib/http"
import { setIdeasHidden, useIdeasHidden } from "@/lib/idea-preferences"
import { resetIntroSlides } from "@/lib/intro-slides"
import { resetCoachMarks } from "@/lib/coach-marks"
import { clearLocationChoice } from "@/lib/location-choice"
import { replayOnboarding } from "@/lib/onboarding"
import { setNewOnboarding, useNewOnboarding } from "@/lib/onboarding-flags"
import {
  getRefreshToken,
  getToken,
  setSession,
  type AuthUser,
} from "@/lib/auth-store"
import {
  initialsFromName,
  normalizeUsername,
  readFileAsDataUrl,
} from "@/lib/profile"

// ─── Types mirroring the DB schemas exactly ────────────────────────────────
//
// Account fields come from the `users` collection (auth-server).
// API: GET /auth/me → { user }
//      PATCH /auth/me/profile  { displayName, username, email, profileVisibility }
//      (bio, instagram and telegram are edited on /settings/profile, #289)
//
// #91 investigation: the users.profileVisibility enum (auth-server/src/models/User.ts)
// is only "public" | "private" — there is no "connections_only" value in the
// schema or in the `AuthUser` type the rest of the app relies on. The third
// radio option below is UI-only until that's a real backend value, so it's
// disabled rather than removed (CLAUDE.md "hide, never delete").
type ProfileVisibility = "public" | "private" // users.profileVisibility enum

type AccountDraft = {
  displayName: string // users.displayName
  username: string // users.username
  email: string // users.email
  profileVisibility: ProfileVisibility // users.profileVisibility
}

// Notification fields come from the `notification_settings` collection (api/).
// API: GET  /notification-settings/me → { data: NotificationSettings }
//      PATCH /notification-settings/me  { ...partial NotificationSettings }
//
// `notifyWhen` and `maxDistanceKm` below are NOT in that schema
// (api/src/schemas/notificationSettingsSchemas.ts is `.strict()` and would
// reject them) — their controls are shown disabled with "coming soon"
// rather than wired or deleted.
type NotifyWhen = "any_friend" | "inner_circle" // not persisted — no backend field yet

type NotificationDraft = {
  // ── real schema fields — auto-save individually as they change ─────────
  quietHoursEnabled: boolean // notification_settings.quietHoursEnabled
  quietHoursStart: string // notification_settings.quietHoursStart  ("HH:MM")
  quietHoursEnd: string // notification_settings.quietHoursEnd    ("HH:MM")
  eventReminders: boolean // notification_settings.eventReminders
  invitationNotifications: boolean // notification_settings.invitationNotifications
  // ── no backend field — local only, controls disabled ("coming soon") ───
  notifyWhen: NotifyWhen
  maxDistanceKm: number
}

// #91 investigation: auth-server has no change-password endpoint — only the
// reset-by-email flow (POST /auth/forgot-password + /auth/reset-password).
// Building a new "requires current password" endpoint would be an auth
// change (Level 3), so this form stays hidden behind "coming soon" instead
// of being wired or deleted.

// ─── Activity tag options ───────────────────────────────────────────────────
const VISIBILITY_OPTIONS: {
  value: ProfileVisibility | "connections_only"
  label: string
  sublabel: string
  disabled?: boolean
}[] = [
  {
    value: "public",
    label: "Public",
    sublabel: "Anyone can find you by username",
  },
  {
    value: "connections_only",
    label: "Connections only",
    sublabel: "Coming soon — not supported by the backend yet",
    disabled: true,
  },
  { value: "private", label: "Private", sublabel: "Hidden — invite only" },
]

// ─── Page ───────────────────────────────────────────────────────────────────
export default function SettingsPage() {
  const { user } = useAuth()
  if (!user) return null
  return (
    <SettingsPageContent key={`${user.id}:${user.updatedAt}`} user={user} />
  )
}

function SettingsPageContent({ user }: { user: AuthUser }) {
  const router = useRouter()
  const { logout } = useAuth()
  const { showActionFeedback } = useActionFeedback()
  const { resolvedTheme, setTheme } = useTheme()
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const ideasHidden = useIdeasHidden()
  const newOnboarding = useNewOnboarding()
  const isDark = resolvedTheme === "dark"

  // Account draft — seeded from the auth session (already fresh: AuthProvider
  // revalidates against /auth/me on load, see components/auth-provider.tsx).
  const [account, setAccount] = useState<AccountDraft>({
    displayName: user.displayName ?? "",
    username: user.username ?? "",
    email: user.email ?? "",
    profileVisibility: user.profileVisibility,
  })

  const [avatarPreview, setAvatarPreview] = useState<string>(
    user.avatarUrl ?? ""
  )
  const [pendingAvatarFile, setPendingAvatarFile] = useState<File | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [savingAccount, setSavingAccount] = useState(false)
  // #537: moving the email needs the current password, so the field shows
  // only while the email differs from the saved one.
  const [currentPassword, setCurrentPassword] = useState("")
  const emailChanged =
    account.email.trim().toLowerCase() !== (user.email ?? "").toLowerCase()

  const avatarInitials = useMemo(
    () => initialsFromName(account.displayName),
    [account.displayName]
  )

  const handleAvatarPick = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0]
    if (!file) return
    try {
      const nextAvatar = await readFileAsDataUrl(file)
      setAvatarPreview(nextAvatar)
      setPendingAvatarFile(file)
      setUploadError(null)
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Could not read file")
    }
  }

  // Notification draft. `notifyWhen`/`maxDistanceKm` have no backend
  // field (see NotificationDraft above) so they start at a fixed local
  // default and are never sent — their controls render disabled.
  const [notif, setNotif] = useState<NotificationDraft>({
    quietHoursEnabled: false,
    quietHoursStart: "22:00",
    quietHoursEnd: "08:00",
    eventReminders: true,
    invitationNotifications: true,
    notifyWhen: "any_friend",
    maxDistanceKm: 5,
  })
  // Last value confirmed by the server for each real field — what a failed
  // save reverts a control back to. Null until the initial GET resolves.
  const [committedNotif, setCommittedNotif] =
    useState<NotificationSettingsSchema | null>(null)
  const [notifLoading, setNotifLoading] = useState(true)
  const [notifLoadError, setNotifLoadError] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetchNotificationSettings()
      .then((settings) => {
        if (cancelled) return
        setNotif((prev) => ({ ...prev, ...settings }))
        setCommittedNotif(settings)
      })
      .catch((err) => {
        if (cancelled) return
        console.error("[Sponti] failed to load notification settings", err)
        setNotifLoadError(true)
      })
      .finally(() => {
        if (!cancelled) setNotifLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const patchAccount = (partial: Partial<AccountDraft>) =>
    setAccount((prev) => ({ ...prev, ...partial }))

  const patchNotif = (partial: Partial<NotificationDraft>) =>
    setNotif((prev) => ({ ...prev, ...partial }))

  // Saves one real notification field immediately (optimistic — the switch
  // or field already shows `value` by the time this runs) and reverts it to
  // the last known-good server value on failure. Mirrors the optimistic
  // join/leave pattern in app/page.tsx.
  const commitNotifField = async <K extends keyof NotificationSettingsSchema>(
    field: K,
    value: NotificationSettingsSchema[K]
  ) => {
    try {
      const updated = await updateNotificationSettings({ [field]: value })
      setCommittedNotif(updated)
      showActionFeedback("preferences saved")
    } catch (err) {
      console.error("[Sponti] failed to save notification setting", field, err)
      if (committedNotif) {
        patchNotif({
          [field]: committedNotif[field],
        } as Partial<NotificationDraft>)
      }
      showActionFeedback("couldn't save that", { tone: "error" })
    }
  }

  const handleNotifToggle = (
    field: "quietHoursEnabled" | "eventReminders" | "invitationNotifications",
    value: boolean
  ) => {
    patchNotif({ [field]: value } as Partial<NotificationDraft>)
    void commitNotifField(field, value)
  }

  const commitTimeFieldIfChanged = (
    field: "quietHoursStart" | "quietHoursEnd",
    value: string
  ) => {
    if (!committedNotif || committedNotif[field] === value) return
    void commitNotifField(field, value)
  }

  // ── Submit handlers ────────────────────────────────────────────────────
  const handleSaveAccount = async () => {
    if (savingAccount) return
    setSavingAccount(true)
    setUploadError(null)

    let nextAvatarUrl: string | null = user.avatarUrl ?? null

    try {
      if (pendingAvatarFile) {
        const { avatarUrl } = await uploadAvatar(pendingAvatarFile)
        nextAvatarUrl = avatarUrl
        setPendingAvatarFile(null)
      }

      const { user: updatedUser } = await updateProfile({
        displayName: account.displayName.trim(),
        username: normalizeUsername(account.username),
        email: account.email.trim(),
        ...(emailChanged ? { currentPassword } : {}),
        profileVisibility: account.profileVisibility,
      })
      setCurrentPassword("")

      const mergedUser: AuthUser = { ...updatedUser, avatarUrl: nextAvatarUrl }
      const token = getToken()
      const refreshToken = getRefreshToken()
      if (token && refreshToken) setSession(token, refreshToken, mergedUser)

      showActionFeedback("profile saved")
    } catch (err) {
      const message =
        err instanceof HttpError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Could not save profile"
      setUploadError(message)
      showActionFeedback("couldn't save that", { tone: "error" })
    } finally {
      setSavingAccount(false)
    }
  }

  return (
    <div className="relative flex min-h-dvh w-full flex-col bg-background">
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
        <button
          onClick={() => router.back()}
          aria-label="Back"
          className="flex h-9 w-9 items-center justify-center rounded-full border border-border"
        >
          <ArrowLeftIcon className="h-4 w-4" />
        </button>
        <span className="text-base font-semibold">settings</span>
        <button
          onClick={() => setTheme(isDark ? "light" : "dark")}
          aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-border"
        >
          {isDark ? (
            <SunIcon className="h-4 w-4" />
          ) : (
            <MoonIcon className="h-4 w-4" />
          )}
        </button>
      </div>

      {/* Tabbed content */}
      <div className="flex-1 overflow-y-auto pb-28">
        <Tabs defaultValue="account" className="w-full">
          <div className="px-4 pt-4">
            <TabsList className="w-full">
              <TabsTrigger value="account" className="flex-1 gap-1.5">
                <UserIcon className="h-3.5 w-3.5" />
                Account
              </TabsTrigger>
              <TabsTrigger value="notifications" className="flex-1 gap-1.5">
                <BellIcon className="h-3.5 w-3.5" />
                Notifications
              </TabsTrigger>
            </TabsList>
          </div>

          {/* ────────────────── Account tab ────────────────── */}
          <TabsContent value="account" className="space-y-6 px-4 pt-5">
            {/* Bio and social handles are account fields with their own page
                (#289): PATCH /auth/me/profile, validated on the server. */}
            <Section icon={LinkIcon} label="bio and social links">
              <Link
                href="/settings/profile"
                className="flex items-center justify-between rounded-xl border border-border p-3 transition-colors hover:bg-muted/40"
              >
                <div className="min-w-0 pr-4">
                  <p className="text-sm font-medium">edit profile</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    your bio, instagram and telegram
                  </p>
                </div>
                <CaretRightIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
              </Link>
            </Section>

            {/* Avatar — users.avatarUrl, uploaded via POST /auth/me/avatar */}
            <Section icon={CameraIcon} label="Profile picture">
              <div className="flex items-start gap-4">
                <Avatar className="h-20 w-20 bg-muted ring-1 ring-border">
                  <AvatarImage
                    src={avatarPreview || undefined}
                    alt={account.displayName}
                  />
                  <AvatarFallback className="bg-accent/10 text-base font-semibold text-accent-ink">
                    {avatarInitials}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1 space-y-2">
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    Upload a photo from your device. Saved when you press “Save
                    changes”.
                  </p>
                  {uploadError && (
                    <p className="text-xs leading-relaxed text-destructive">
                      {uploadError}
                    </p>
                  )}
                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-full"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <UploadSimpleIcon className="h-4 w-4" />
                    upload photo
                  </Button>
                  <Input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleAvatarPick}
                  />
                </div>
              </div>
            </Section>

            {/* Profile — users: displayName, username, email */}
            <Section icon={UserIcon} label="Profile">
              <div className="space-y-3">
                <Field label="Display name">
                  <Input
                    value={account.displayName}
                    onChange={(e) =>
                      patchAccount({ displayName: e.target.value })
                    }
                    placeholder="Your name"
                  />
                </Field>
                <Field label="Username">
                  <div className="relative">
                    <span className="absolute top-1/2 left-3 -translate-y-1/2 text-sm text-muted-foreground select-none">
                      @
                    </span>
                    <Input
                      value={account.username}
                      onChange={(e) =>
                        patchAccount({ username: e.target.value })
                      }
                      placeholder="username"
                      className="pl-7"
                    />
                  </div>
                </Field>
                <Field label="Email">
                  <Input
                    type="email"
                    value={account.email}
                    onChange={(e) => patchAccount({ email: e.target.value })}
                    placeholder="you@example.com"
                  />
                </Field>
                {emailChanged && (
                  <Field label="Current password">
                    <Input
                      type="password"
                      autoComplete="current-password"
                      aria-label="current password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="needed to change your email"
                    />
                  </Field>
                )}
              </div>
            </Section>

            {/* Privacy — users: profileVisibility (profile_visibility_status enum) */}
            <Section icon={ShieldIcon} label="Privacy">
              <RadioGroup
                value={account.profileVisibility}
                onValueChange={(v) =>
                  patchAccount({ profileVisibility: v as ProfileVisibility })
                }
                className="space-y-2"
              >
                {VISIBILITY_OPTIONS.map(
                  ({ value, label, sublabel, disabled }) => (
                    <Label
                      key={value}
                      htmlFor={`vis-${value}`}
                      className={`flex items-start gap-3 rounded-xl border p-3 transition-colors ${
                        disabled
                          ? "cursor-not-allowed border-border opacity-50"
                          : "cursor-pointer"
                      } ${
                        !disabled && account.profileVisibility === value
                          ? "border-accent bg-accent/5"
                          : "border-border"
                      }`}
                    >
                      <RadioGroupItem
                        id={`vis-${value}`}
                        value={value}
                        disabled={disabled}
                        className="mt-0.5"
                      />
                      <div className="flex flex-col gap-0.5">
                        <span className="text-sm font-medium">{label}</span>
                        <span className="text-xs text-muted-foreground">
                          {sublabel}
                        </span>
                      </div>
                    </Label>
                  )
                )}
              </RadioGroup>
            </Section>

            {/* Map — device-only, applies at once (no save button): the idea
                pins and cards on the home map (#245). Kept in localStorage. */}
            <Section icon={MapPinIcon} label="Map">
              <ToggleRow
                label="show ideas on the map"
                sublabel="suggested spots near you · kept on this device"
                checked={!ideasHidden}
                onCheckedChange={(v) => setIdeasHidden(!v)}
              />
            </Section>

            {/* Onboarding — device-only, applies at once (#482): the switch
                turns the new onboarding on whatever the build profile, and
                the buttons reset what it remembers so it shows again. */}
            <Section icon={SparkleIcon} label="onboarding">
              <div className="space-y-3">
                <ToggleRow
                  label="new onboarding"
                  sublabel="intro slides, browse before sign-up, the location ask · kept on this device"
                  checked={newOnboarding}
                  onCheckedChange={setNewOnboarding}
                />
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-full"
                    onClick={() => {
                      resetIntroSlides()
                      replayOnboarding()
                      showActionFeedback(
                        newOnboarding
                          ? "intro reset. sign out to see the slides again"
                          : "intro reset. it shows on the home map"
                      )
                    }}
                  >
                    replay intro
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-full"
                    onClick={() => {
                      resetCoachMarks()
                      clearLocationChoice()
                      showActionFeedback(
                        newOnboarding
                          ? "map tips reset. sign out to see them again"
                          : "map tips reset. turn on new onboarding to see them"
                      )
                    }}
                  >
                    replay map tips
                  </Button>
                </div>
              </div>
            </Section>

            <Button
              className="w-full rounded-full bg-accent text-accent-foreground hover:bg-accent/90"
              disabled={savingAccount}
              onClick={() => void handleSaveAccount()}
            >
              {savingAccount ? "saving..." : "save changes"}
            </Button>

            {/* Password — auth-server has no change-password endpoint yet,
                only the reset-by-email flow. Hidden behind "coming soon"
                rather than wired to the wrong flow or removed (#91). */}
            <Section icon={LockIcon} label="Password">
              <div className="rounded-xl border border-border p-3.5 opacity-50">
                <p className="text-sm font-medium">change password</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  coming soon — use &ldquo;forgot password&rdquo; on the sign-in
                  screen for now
                </p>
              </div>
            </Section>

            <div className="flex justify-end pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => logout()}
                className="rounded-full border-destructive/20 text-destructive hover:bg-destructive/10"
              >
                <SignOutIcon className="h-4 w-4" />
                sign out
              </Button>
            </div>
          </TabsContent>

          {/* ────────────────── Notifications tab ────────────────── */}
          <TabsContent value="notifications" className="space-y-6 px-4 pt-5">
            {notifLoadError && (
              <p className="text-xs text-destructive">
                couldn&apos;t load your notification preferences — showing
                defaults
              </p>
            )}

            {/* Quiet hours — notification_settings: quietHoursEnabled, quietHoursStart, quietHoursEnd.
                Each control below auto-saves on change (see commitNotifField)
                and reverts itself if the request fails. */}
            <Section icon={ClockIcon} label="Quiet hours">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">enable quiet hours</p>
                  <p className="text-xs text-muted-foreground">
                    for push notifications · coming soon
                  </p>
                </div>
                <Switch
                  aria-label="enable quiet hours"
                  checked={notif.quietHoursEnabled}
                  disabled={notifLoading}
                  onCheckedChange={(v) =>
                    handleNotifToggle("quietHoursEnabled", v)
                  }
                />
              </div>
              {notif.quietHoursEnabled && (
                <>
                  <div className="flex items-center gap-3">
                    <Input
                      type="time"
                      aria-label="quiet hours start"
                      value={notif.quietHoursStart}
                      disabled={notifLoading}
                      onChange={(e) =>
                        patchNotif({ quietHoursStart: e.target.value })
                      }
                      onBlur={(e) =>
                        commitTimeFieldIfChanged(
                          "quietHoursStart",
                          e.target.value
                        )
                      }
                      className="flex-1"
                    />
                    <span className="shrink-0 text-sm text-muted-foreground">
                      to
                    </span>
                    <Input
                      type="time"
                      aria-label="quiet hours end"
                      value={notif.quietHoursEnd}
                      disabled={notifLoading}
                      onChange={(e) =>
                        patchNotif({ quietHoursEnd: e.target.value })
                      }
                      onBlur={(e) =>
                        commitTimeFieldIfChanged(
                          "quietHoursEnd",
                          e.target.value
                        )
                      }
                      className="flex-1"
                    />
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    notifications are muted during these times
                  </p>
                </>
              )}
            </Section>

            {/* Notification types — notification_settings: eventReminders, invitationNotifications */}
            <Section icon={BellIcon} label="Notify me about">
              <div className="space-y-2">
                <ToggleRow
                  label="Event reminders"
                  sublabel="1h before flares you've joined · coming soon"
                  checked={notif.eventReminders}
                  disabled={notifLoading}
                  onCheckedChange={(v) =>
                    handleNotifToggle("eventReminders", v)
                  }
                />
                <ToggleRow
                  label="Invitation notifications"
                  sublabel="When someone invites you to a flare"
                  checked={notif.invitationNotifications}
                  disabled={notifLoading}
                  onCheckedChange={(v) =>
                    handleNotifToggle("invitationNotifications", v)
                  }
                />
              </div>
            </Section>

            {/* Notify when — no backend field (notification_settings has no
                `notifyWhen` column). Shown disabled, "coming soon", rather
                than wired or deleted — see NotifyWhen above. */}
            <Section icon={BellIcon} label="Notify me when... (coming soon)">
              <RadioGroup
                value={notif.notifyWhen}
                className="space-y-2"
                disabled
              >
                <Label
                  htmlFor="notify-any_friend"
                  className="flex cursor-not-allowed items-center gap-3 rounded-xl border border-border p-3.5 opacity-50"
                >
                  <RadioGroupItem
                    id="notify-any_friend"
                    value="any_friend"
                    disabled
                  />
                  <span className="text-sm font-medium">
                    any friend is free
                  </span>
                </Label>
                <Label
                  htmlFor="notify-inner_circle"
                  className="flex cursor-not-allowed items-center gap-3 rounded-xl border border-border p-3.5 opacity-50"
                >
                  <RadioGroupItem
                    id="notify-inner_circle"
                    value="inner_circle"
                    disabled
                  />
                  <span className="text-sm font-medium">
                    only inner circle is free
                  </span>
                </Label>
              </RadioGroup>
            </Section>

            {/* Max distance — no backend field (notification_settings has no
                `maxDistanceKm` column). Shown disabled, "coming soon". */}
            <Section
              icon={MapPinIcon}
              label={`max distance: ${notif.maxDistanceKm} km (coming soon)`}
            >
              <input
                type="range"
                min={1}
                max={20}
                step={1}
                value={notif.maxDistanceKm}
                disabled
                onChange={() => undefined}
                className="h-1.5 w-full cursor-not-allowed appearance-none rounded-full bg-border opacity-50 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-accent [&::-webkit-slider-thumb]:shadow-md"
              />
              <div className="mt-1 flex justify-between text-xs text-muted-foreground">
                <span>1 km</span>
                <span>20 km</span>
              </div>
            </Section>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}

// ─── Shared sub-components ──────────────────────────────────────────────────
function Section({
  icon: Icon,
  label,
  children,
}: {
  icon: Icon
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

function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  )
}

function ToggleRow({
  label,
  sublabel,
  checked,
  disabled,
  onCheckedChange,
}: {
  label: string
  sublabel: string
  checked: boolean
  disabled?: boolean
  onCheckedChange: (v: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-border p-3">
      <div className="min-w-0 flex-1 pr-4">
        <p className="text-sm font-medium">{label}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{sublabel}</p>
      </div>
      <Switch
        aria-label={label}
        checked={checked}
        disabled={disabled}
        onCheckedChange={onCheckedChange}
      />
    </div>
  )
}
