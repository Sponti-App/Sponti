"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import {
  ArrowLeft,
  Bell,
  Camera,
  Clock,
  Link2,
  Lock,
  LogOut,
  MapPin,
  Moon,
  Shield,
  Sun,
  Upload,
  User,
} from "lucide-react"
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
  readProfileExtras,
  saveProfileExtras,
} from "@/lib/profile"

// ─── Types mirroring the DB schemas exactly ────────────────────────────────
//
// Account fields come from the `users` collection (auth-server).
// API: GET /auth/me → { user }
//      PATCH /auth/me/profile  { displayName, username, email, profileVisibility }
//
// #91 investigation: the users.profileVisibility enum (auth-server/src/models/User.ts)
// is only "public" | "private" — there is no "connections_only" value in the
// schema or in the `AuthUser` type the rest of the app relies on. The third
// radio option below is UI-only until that's a real backend value, so it's
// disabled rather than removed (CLAUDE.md "hide, never delete").
type ProfileVisibility = "public" | "private" // users.profileVisibility enum

type AccountDraft = {
  displayName: string        // users.displayName
  username: string           // users.username
  email: string              // users.email
  profileVisibility: ProfileVisibility  // users.profileVisibility
  instagram: string          // client-only extras (localStorage) — out of scope, #93/#166
  telegram: string           // client-only extras (localStorage) — out of scope, #93/#166
}

// Notification fields come from the `notification_settings` collection (api/).
// API: GET  /notification-settings/me → { data: NotificationSettings }
//      PATCH /notification-settings/me  { ...partial NotificationSettings }
//
// `notifyWhen` and `maxDistanceMiles` below are NOT in that schema
// (api/src/schemas/notificationSettingsSchemas.ts is `.strict()` and would
// reject them) — their controls are shown disabled with "coming soon"
// rather than wired or deleted.
type NotifyWhen = "any_friend" | "inner_circle" // not persisted — no backend field yet

type NotificationDraft = {
  // ── real schema fields — auto-save individually as they change ─────────
  quietHoursEnabled: boolean    // notification_settings.quietHoursEnabled
  quietHoursStart: string       // notification_settings.quietHoursStart  ("HH:MM")
  quietHoursEnd: string         // notification_settings.quietHoursEnd    ("HH:MM")
  eventReminders: boolean       // notification_settings.eventReminders
  invitationNotifications: boolean  // notification_settings.invitationNotifications
  // ── no backend field — local only, controls disabled ("coming soon") ───
  notifyWhen: NotifyWhen
  maxDistanceMiles: number
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
  { value: "public",           label: "Public",           sublabel: "Anyone can find you by username" },
  { value: "connections_only", label: "Connections only", sublabel: "Coming soon — not supported by the backend yet", disabled: true },
  { value: "private",          label: "Private",          sublabel: "Hidden — invite only" },
]

// ─── Page ───────────────────────────────────────────────────────────────────
export default function SettingsPage() {
  const { user } = useAuth()
  if (!user) return null
  return <SettingsPageContent key={`${user.id}:${user.updatedAt}`} user={user} />
}

function SettingsPageContent({ user }: { user: AuthUser }) {
  const router = useRouter()
  const { logout } = useAuth()
  const { showActionFeedback } = useActionFeedback()
  const { resolvedTheme, setTheme } = useTheme()
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const extras = readProfileExtras(user.id)
  const isDark = resolvedTheme === "dark"

  // Account draft — seeded from the auth session (already fresh: AuthProvider
  // revalidates against /auth/me on load, see components/auth-provider.tsx).
  const [account, setAccount] = useState<AccountDraft>({
    displayName: user.displayName ?? "",
    username: user.username ?? "",
    email: user.email ?? "",
    profileVisibility: user.profileVisibility,
    instagram: extras.instagram,
    telegram: extras.telegram,
  })

  const [avatarPreview, setAvatarPreview] = useState<string>(user.avatarUrl ?? "")
  const [pendingAvatarFile, setPendingAvatarFile] = useState<File | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [savingAccount, setSavingAccount] = useState(false)

  const avatarInitials = useMemo(
    () => initialsFromName(account.displayName),
    [account.displayName],
  )

  const handleAvatarPick = async (event: React.ChangeEvent<HTMLInputElement>) => {
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

  // Notification draft. `notifyWhen`/`maxDistanceMiles` have no backend
  // field (see NotificationDraft above) so they start at a fixed local
  // default and are never sent — their controls render disabled.
  const [notif, setNotif] = useState<NotificationDraft>({
    quietHoursEnabled: false,
    quietHoursStart: "22:00",
    quietHoursEnd: "08:00",
    eventReminders: true,
    invitationNotifications: true,
    notifyWhen: "any_friend",
    maxDistanceMiles: 5,
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
        patchNotif({ [field]: committedNotif[field] } as Partial<NotificationDraft>)
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
        profileVisibility: account.profileVisibility,
      })

      const mergedUser: AuthUser = { ...updatedUser, avatarUrl: nextAvatarUrl }
      const token = getToken()
      const refreshToken = getRefreshToken()
      if (token && refreshToken) setSession(token, refreshToken, mergedUser)

      saveProfileExtras(user.id, {
        instagram: account.instagram.trim(),
        telegram: account.telegram.trim(),
      })

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
    <div className="min-h-dvh w-full bg-background flex flex-col relative">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 shrink-0 border-b border-border">
        <button
          onClick={() => router.back()}
          aria-label="Back"
          className="h-9 w-9 rounded-full border border-border flex items-center justify-center"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <span className="text-base font-semibold">settings</span>
        <button
          onClick={() => setTheme(isDark ? "light" : "dark")}
          aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
          className="h-9 w-9 rounded-full border border-border flex items-center justify-center"
        >
          {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>
      </div>

      {/* Tabbed content */}
      <div className="flex-1 overflow-y-auto pb-28">
        <Tabs defaultValue="account" className="w-full">
          <div className="px-4 pt-4">
            <TabsList className="w-full">
              <TabsTrigger value="account" className="flex-1 gap-1.5">
                <User className="h-3.5 w-3.5" />
                Account
              </TabsTrigger>
              <TabsTrigger value="notifications" className="flex-1 gap-1.5">
                <Bell className="h-3.5 w-3.5" />
                Notifications
              </TabsTrigger>
            </TabsList>
          </div>

          {/* ────────────────── Account tab ────────────────── */}
          <TabsContent value="account" className="px-4 pt-5 space-y-6">

            {/* Avatar — users.avatarUrl, uploaded via POST /auth/me/avatar */}
            <Section icon={Camera} label="Profile picture">
              <div className="flex items-start gap-4">
                <Avatar className="h-20 w-20 ring-1 ring-border bg-muted">
                  <AvatarImage
                    src={avatarPreview || undefined}
                    alt={account.displayName}
                  />
                  <AvatarFallback className="bg-accent/10 text-base font-semibold text-accent">
                    {avatarInitials}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1 space-y-2">
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    Upload a photo from your device. Saved when you press “Save changes”.
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
                    <Upload className="h-4 w-4" />
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
            <Section icon={User} label="Profile">
              <div className="space-y-3">
                <Field label="Display name">
                  <Input
                    value={account.displayName}
                    onChange={(e) => patchAccount({ displayName: e.target.value })}
                    placeholder="Your name"
                  />
                </Field>
                <Field label="Username">
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm select-none">@</span>
                    <Input
                      value={account.username}
                      onChange={(e) => patchAccount({ username: e.target.value })}
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
              </div>
            </Section>

            {/* Privacy — users: profileVisibility (profile_visibility_status enum) */}
            <Section icon={Shield} label="Privacy">
              <RadioGroup
                value={account.profileVisibility}
                onValueChange={(v) =>
                  patchAccount({ profileVisibility: v as ProfileVisibility })
                }
                className="space-y-2"
              >
                {VISIBILITY_OPTIONS.map(({ value, label, sublabel, disabled }) => (
                  <Label
                    key={value}
                    htmlFor={`vis-${value}`}
                    className={`flex items-start gap-3 rounded-xl border p-3 transition-colors ${
                      disabled
                        ? "cursor-not-allowed opacity-50 border-border"
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
                      <span className="text-xs text-muted-foreground">{sublabel}</span>
                    </div>
                  </Label>
                ))}
              </RadioGroup>
            </Section>

            {/* Social links — client-only extras stored in localStorage */}
            <Section icon={Link2} label="Social links">
              <div className="space-y-3">
                <Field label="Instagram">
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm select-none">@</span>
                    <Input
                      value={account.instagram}
                      onChange={(e) => patchAccount({ instagram: e.target.value })}
                      placeholder="yourhandle"
                      className="pl-7"
                    />
                  </div>
                </Field>
                <Field label="Telegram">
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm select-none">@</span>
                    <Input
                      value={account.telegram}
                      onChange={(e) => patchAccount({ telegram: e.target.value })}
                      placeholder="yourhandle"
                      className="pl-7"
                    />
                  </div>
                </Field>
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
            <Section icon={Lock} label="Password">
              <div className="rounded-xl border border-border p-3.5 opacity-50">
                <p className="text-sm font-medium">change password</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  coming soon — use &ldquo;forgot password&rdquo; on the sign-in screen for now
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
                <LogOut className="h-4 w-4" />
                sign out
              </Button>
            </div>
          </TabsContent>

          {/* ────────────────── Notifications tab ────────────────── */}
          <TabsContent value="notifications" className="px-4 pt-5 space-y-6">
            {notifLoadError && (
              <p className="text-xs text-destructive">
                couldn&apos;t load your notification preferences — showing defaults
              </p>
            )}

            {/* Quiet hours — notification_settings: quietHoursEnabled, quietHoursStart, quietHoursEnd.
                Each control below auto-saves on change (see commitNotifField)
                and reverts itself if the request fails. */}
            <Section icon={Clock} label="Quiet hours">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-sm font-medium">enable quiet hours</p>
                  <p className="text-xs text-muted-foreground">for push notifications · coming soon</p>
                </div>
                <Switch
                  aria-label="enable quiet hours"
                  checked={notif.quietHoursEnabled}
                  disabled={notifLoading}
                  onCheckedChange={(v) => handleNotifToggle("quietHoursEnabled", v)}
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
                      onChange={(e) => patchNotif({ quietHoursStart: e.target.value })}
                      onBlur={(e) => commitTimeFieldIfChanged("quietHoursStart", e.target.value)}
                      className="flex-1"
                    />
                    <span className="text-sm text-muted-foreground shrink-0">to</span>
                    <Input
                      type="time"
                      aria-label="quiet hours end"
                      value={notif.quietHoursEnd}
                      disabled={notifLoading}
                      onChange={(e) => patchNotif({ quietHoursEnd: e.target.value })}
                      onBlur={(e) => commitTimeFieldIfChanged("quietHoursEnd", e.target.value)}
                      className="flex-1"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    notifications are muted during these times
                  </p>
                </>
              )}
            </Section>

            {/* Notification types — notification_settings: eventReminders, invitationNotifications */}
            <Section icon={Bell} label="Notify me about">
              <div className="space-y-2">
                <ToggleRow
                  label="Event reminders"
                  sublabel="1h before flares you've joined · coming soon"
                  checked={notif.eventReminders}
                  disabled={notifLoading}
                  onCheckedChange={(v) => handleNotifToggle("eventReminders", v)}
                />
                <ToggleRow
                  label="Invitation notifications"
                  sublabel="When someone invites you to a flare"
                  checked={notif.invitationNotifications}
                  disabled={notifLoading}
                  onCheckedChange={(v) => handleNotifToggle("invitationNotifications", v)}
                />
              </div>
            </Section>

            {/* Notify when — no backend field (notification_settings has no
                `notifyWhen` column). Shown disabled, "coming soon", rather
                than wired or deleted — see NotifyWhen above. */}
            <Section icon={Bell} label="Notify me when... (coming soon)">
              <RadioGroup value={notif.notifyWhen} className="space-y-2" disabled>
                <Label
                  htmlFor="notify-any_friend"
                  className="flex items-center gap-3 rounded-xl border border-border p-3.5 opacity-50 cursor-not-allowed"
                >
                  <RadioGroupItem id="notify-any_friend" value="any_friend" disabled />
                  <span className="text-sm font-medium">any friend is free</span>
                </Label>
                <Label
                  htmlFor="notify-inner_circle"
                  className="flex items-center gap-3 rounded-xl border border-border p-3.5 opacity-50 cursor-not-allowed"
                >
                  <RadioGroupItem id="notify-inner_circle" value="inner_circle" disabled />
                  <span className="text-sm font-medium">only inner circle is free</span>
                </Label>
              </RadioGroup>
            </Section>

            {/* Max distance — no backend field (notification_settings has no
                `maxDistanceMiles` column). Shown disabled, "coming soon". */}
            <Section
              icon={MapPin}
              label={`max distance: ${notif.maxDistanceMiles} ${notif.maxDistanceMiles === 1 ? "mile" : "miles"} (coming soon)`}
            >
              <input
                type="range"
                min={1}
                max={20}
                step={1}
                value={notif.maxDistanceMiles}
                disabled
                onChange={() => undefined}
                className="w-full h-1.5 rounded-full appearance-none bg-border opacity-50 cursor-not-allowed [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-accent [&::-webkit-slider-thumb]:shadow-md"
              />
              <div className="flex justify-between text-xs text-muted-foreground mt-1">
                <span>1 mi</span>
                <span>20 mi</span>
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
  icon: typeof User
  label: string
  children: React.ReactNode
}) {
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-3">
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-xs font-medium text-muted-foreground">
          {label}
        </span>
      </div>
      {children}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
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
      <div className="flex-1 min-w-0 pr-4">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{sublabel}</p>
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
