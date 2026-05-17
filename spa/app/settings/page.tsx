"use client"

import { useMemo, useRef, useState } from "react"
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
  Shield,
  Upload,
  User,
} from "lucide-react"
import { BottomNav } from "@/components/bottom-nav"
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
// Account fields come from the `users` collection.
// API: GET /api/users/me → AccountDraft
//      PATCH /api/users/me  { displayName, username, email, profileVisibility, socialBattery }
type ProfileVisibility = "public" | "connections_only" | "private"  // profile_visibility_status enum

type AccountDraft = {
  displayName: string        // users.displayName
  username: string           // users.username
  email: string              // users.email
  profileVisibility: ProfileVisibility  // users.profileVisibility
  instagram: string          // client-only extras (localStorage)
  telegram: string           // client-only extras (localStorage)
}

// Notification fields come from the `notification_settings` collection (one doc per user).
// API: GET /api/notification-settings → NotificationDraft
//      PATCH /api/notification-settings  { ...NotificationDraft }
//
// Fields marked [PROPOSED] do not exist in the schema yet — add them to the
// notification_settings collection as described below.
type NotifyWhen = "any_friend" | "inner_circle"   // [PROPOSED] enum

type NotificationDraft = {
  // ── existing schema fields ──────────────────────────────────────────────
  quietHoursEnabled: boolean    // notification_settings.quietHoursEnabled
  quietHoursStart: string       // notification_settings.quietHoursStart  ("HH:MM")
  quietHoursEnd: string         // notification_settings.quietHoursEnd    ("HH:MM")
  eventReminders: boolean       // notification_settings.eventReminders
  invitationNotifications: boolean  // notification_settings.invitationNotifications
  // ── [PROPOSED] new fields — add to notification_settings collection ─────
  // notifyWhen:  { type: String, enum: ["any_friend","inner_circle"], default: "any_friend" }
  notifyWhen: NotifyWhen
  // maxDistanceMiles: { type: Number, min: 1, max: 50, default: 10 }
  maxDistanceMiles: number
}

// Password change is a separate auth endpoint, not part of users schema.
// API: POST /auth/change-password  { currentPassword, newPassword }
type PasswordDraft = {
  currentPassword: string
  newPassword: string
  confirmPassword: string  // validated client-side only
}

// ─── Activity tag options ───────────────────────────────────────────────────
const VISIBILITY_OPTIONS: { value: ProfileVisibility; label: string; sublabel: string }[] = [
  { value: "public",           label: "Public",           sublabel: "Anyone can find you by username" },
  { value: "connections_only", label: "Connections only", sublabel: "Only people you're connected with" },
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
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const extras = readProfileExtras(user.id)

  // Account draft — seeded from auth session; replace with API response when wired
  const [account, setAccount] = useState<AccountDraft>({
    displayName: user.displayName ?? "",
    username: user.username ?? "",
    email: user.email ?? "",
    profileVisibility: "connections_only",
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

  // Notification draft — replace initial values with API response when wired
  const [notif, setNotif] = useState<NotificationDraft>({
    quietHoursEnabled: true,
    quietHoursStart: "22:00",
    quietHoursEnd: "08:00",
    eventReminders: true,
    invitationNotifications: true,
    notifyWhen: "any_friend",
    maxDistanceMiles: 5,
  })

  const [password, setPassword] = useState<PasswordDraft>({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  })

  const patchAccount = (partial: Partial<AccountDraft>) =>
    setAccount((prev) => ({ ...prev, ...partial }))

  const patchNotif = (partial: Partial<NotificationDraft>) =>
    setNotif((prev) => ({ ...prev, ...partial }))

  // ── Submit handlers — swap TODO bodies for real fetch calls ───────────────
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
      })

      const mergedUser: AuthUser = { ...updatedUser, avatarUrl: nextAvatarUrl }
      const token = getToken()
      const refreshToken = getRefreshToken()
      if (token && refreshToken) setSession(token, refreshToken, mergedUser)

      saveProfileExtras(user.id, {
        instagram: account.instagram.trim(),
        telegram: account.telegram.trim(),
      })

      // TODO: PATCH /api/users/me for profileVisibility once backend lands
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Could not save profile")
    } finally {
      setSavingAccount(false)
    }
  }

  const handleChangePassword = () => {
    if (password.newPassword !== password.confirmPassword) return
    // TODO: POST /auth/change-password
    // await apiFetch("/auth/change-password", { method: "POST", body: JSON.stringify({ currentPassword: password.currentPassword, newPassword: password.newPassword }) })
    setPassword({ currentPassword: "", newPassword: "", confirmPassword: "" })
  }

  const handleSaveNotifications = () => {
    // TODO: PATCH /api/notification-settings
    // Destructure to send only the exact schema fields (omit confirmPassword etc.)
    // const { quietHoursEnabled, quietHoursStart, quietHoursEnd, eventReminders, invitationNotifications, notifyWhen, maxDistanceMiles } = notif
    // await apiFetch("/api/notification-settings", { method: "PATCH", body: JSON.stringify({ quietHoursEnabled, quietHoursStart, quietHoursEnd, eventReminders, invitationNotifications, notifyWhen, maxDistanceMiles }) })
  }

  const passwordValid =
    password.newPassword.length >= 8 &&
    password.newPassword === password.confirmPassword

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
        <div className="h-9 w-9" aria-hidden />
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
                onValueChange={(v) => patchAccount({ profileVisibility: v as ProfileVisibility })}
                className="space-y-2"
              >
                {VISIBILITY_OPTIONS.map(({ value, label, sublabel }) => (
                  <Label
                    key={value}
                    htmlFor={`vis-${value}`}
                    className={`flex items-start gap-3 rounded-xl border p-3 cursor-pointer transition-colors ${
                      account.profileVisibility === value
                        ? "border-accent bg-accent/5"
                        : "border-border"
                    }`}
                  >
                    <RadioGroupItem id={`vis-${value}`} value={value} className="mt-0.5" />
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
              {savingAccount ? "Saving..." : "Save changes"}
            </Button>

            {/* Password — POST /auth/change-password (not in users schema directly) */}
            <Section icon={Lock} label="Password">
              <div className="space-y-3">
                <Field label="Current password">
                  <Input
                    type="password"
                    placeholder="••••••••"
                    value={password.currentPassword}
                    onChange={(e) => setPassword((p) => ({ ...p, currentPassword: e.target.value }))}
                  />
                </Field>
                <Field label="New password">
                  <Input
                    type="password"
                    placeholder="8+ characters"
                    value={password.newPassword}
                    onChange={(e) => setPassword((p) => ({ ...p, newPassword: e.target.value }))}
                  />
                </Field>
                <Field label="Confirm new password">
                  <Input
                    type="password"
                    placeholder="••••••••"
                    value={password.confirmPassword}
                    onChange={(e) => setPassword((p) => ({ ...p, confirmPassword: e.target.value }))}
                  />
                </Field>
                <Button
                  variant="outline"
                  className="w-full rounded-full"
                  disabled={!passwordValid}
                  onClick={handleChangePassword}
                >
                  Update password
                </Button>
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

            {/* Quiet hours — notification_settings: quietHoursEnabled, quietHoursStart, quietHoursEnd */}
            <Section icon={Clock} label="Quiet hours">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-sm font-medium">Enable quiet hours</p>
                  <p className="text-xs text-muted-foreground">Mute all notifications during this window</p>
                </div>
                <Switch
                  checked={notif.quietHoursEnabled}
                  onCheckedChange={(v) => patchNotif({ quietHoursEnabled: v })}
                />
              </div>
              {notif.quietHoursEnabled && (
                <>
                  <div className="flex items-center gap-3">
                    <Input
                      type="time"
                      value={notif.quietHoursStart}
                      onChange={(e) => patchNotif({ quietHoursStart: e.target.value })}
                      className="flex-1"
                    />
                    <span className="text-sm text-muted-foreground shrink-0">to</span>
                    <Input
                      type="time"
                      value={notif.quietHoursEnd}
                      onChange={(e) => patchNotif({ quietHoursEnd: e.target.value })}
                      className="flex-1"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Notifications are muted during these times.
                  </p>
                </>
              )}
            </Section>

            {/* Notification types — notification_settings: eventReminders, invitationNotifications */}
            <Section icon={Bell} label="Notify me about">
              <div className="space-y-2">
                <ToggleRow
                  label="Event reminders"
                  sublabel="Reminded 1h before events you've joined"
                  checked={notif.eventReminders}
                  onCheckedChange={(v) => patchNotif({ eventReminders: v })}
                />
                <ToggleRow
                  label="Invitation notifications"
                  sublabel="When someone invites you to a flare"
                  checked={notif.invitationNotifications}
                  onCheckedChange={(v) => patchNotif({ invitationNotifications: v })}
                />
              </div>
            </Section>

            {/* Notify when — [PROPOSED] notification_settings.notifyWhen: "any_friend" | "inner_circle" */}
            <Section icon={Bell} label="Notify me when...">
              <RadioGroup
                value={notif.notifyWhen}
                onValueChange={(v) => patchNotif({ notifyWhen: v as NotifyWhen })}
                className="space-y-2"
              >
                <Label
                  htmlFor="notify-any_friend"
                  className={`flex items-center gap-3 rounded-xl border p-3.5 cursor-pointer transition-colors ${
                    notif.notifyWhen === "any_friend" ? "border-accent bg-accent/5" : "border-border"
                  }`}
                >
                  <RadioGroupItem id="notify-any_friend" value="any_friend" />
                  <span className="text-sm font-medium">Any friend is free</span>
                </Label>
                <Label
                  htmlFor="notify-inner_circle"
                  className={`flex items-center gap-3 rounded-xl border p-3.5 cursor-pointer transition-colors ${
                    notif.notifyWhen === "inner_circle" ? "border-accent bg-accent/5" : "border-border"
                  }`}
                >
                  <RadioGroupItem id="notify-inner_circle" value="inner_circle" />
                  <span className="text-sm font-medium">Only Inner Circle is free</span>
                </Label>
              </RadioGroup>
            </Section>

            {/* Max distance — [PROPOSED] notification_settings.maxDistanceMiles: Number (1–50) */}
            <Section icon={MapPin} label={`Max distance: ${notif.maxDistanceMiles} ${notif.maxDistanceMiles === 1 ? "mile" : "miles"}`}>
              <input
                type="range"
                min={1}
                max={20}
                step={1}
                value={notif.maxDistanceMiles}
                onChange={(e) => patchNotif({ maxDistanceMiles: Number(e.target.value) })}
                className="w-full h-1.5 rounded-full appearance-none bg-border [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-accent [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:cursor-pointer"
              />
              <div className="flex justify-between text-xs text-muted-foreground mt-1">
                <span>1 mi</span>
                <span>20 mi</span>
              </div>
            </Section>

            <Button
              className="w-full rounded-full bg-accent text-accent-foreground hover:bg-accent/90"
              onClick={handleSaveNotifications}
            >
              Save preferences
            </Button>
          </TabsContent>
        </Tabs>
      </div>

      <div className="absolute bottom-6 left-0 right-0 z-10">
        <BottomNav />
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
        <span className="text-[11px] uppercase tracking-wide font-medium text-muted-foreground">
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
  onCheckedChange,
}: {
  label: string
  sublabel: string
  checked: boolean
  onCheckedChange: (v: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-border p-3">
      <div className="flex-1 min-w-0 pr-4">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{sublabel}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  )
}
