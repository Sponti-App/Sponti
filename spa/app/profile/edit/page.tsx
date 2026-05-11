"use client"

import { useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, Camera, LogOut, Upload } from "lucide-react"
import { BottomNav } from "@/components/bottom-nav"
import { useAuth } from "@/components/auth-provider"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { getRefreshToken, getToken, setSession, type AuthUser } from "@/lib/auth-store"
import {
  buildProfileDraft,
  initialsFromName,
  normalizeUsername,
  readFileAsDataUrl,
  readProfileExtras,
  saveProfileExtras,
  type ProfileDraft,
} from "@/lib/profile"

function ProfileEditPageContent({ user }: { user: AuthUser }) {
  const router = useRouter()
  const { logout } = useAuth()
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [draft, setDraft] = useState<ProfileDraft>(() =>
    buildProfileDraft(user, readProfileExtras(user.id)),
  )
  const [avatarPreview, setAvatarPreview] = useState<string>(user.avatarUrl ?? "")
  const [baseline, setBaseline] = useState<ProfileDraft>(() =>
    buildProfileDraft(user, readProfileExtras(user.id)),
  )

  const avatarInitials = useMemo(() => initialsFromName(draft.displayName), [draft.displayName])

  const isDirty =
    draft.avatarUrl !== baseline.avatarUrl ||
    draft.displayName !== baseline.displayName ||
    draft.username !== baseline.username ||
    draft.email !== baseline.email ||
    draft.instagram !== baseline.instagram ||
    draft.telegram !== baseline.telegram ||
    avatarPreview !== (user.avatarUrl ?? "")

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    const nextAvatar = await readFileAsDataUrl(file)
    setAvatarPreview(nextAvatar)
    setDraft((prev) => ({ ...prev, avatarUrl: nextAvatar }))
  }

  const handleSave = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!isDirty) return

    const updatedUser: AuthUser = {
      ...user,
      avatarUrl: avatarPreview || null,
      displayName: draft.displayName.trim(),
      username: normalizeUsername(draft.username),
      email: draft.email.trim(),
      updatedAt: new Date().toISOString(),
    }

    saveProfileExtras(user.id, {
      instagram: draft.instagram.trim(),
      telegram: draft.telegram.trim(),
    })

    const token = getToken()
    const refreshToken = getRefreshToken()
    if (token && refreshToken) {
      setSession(token, refreshToken, updatedUser)
    }

    setBaseline(draft)
    router.push("/profile")
  }

  const handleReset = () => {
    const restored = buildProfileDraft(user, readProfileExtras(user.id))
    setDraft(restored)
    setBaseline(restored)
    setAvatarPreview(user.avatarUrl ?? "")
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  return (
    <form
      onSubmit={handleSave}
      className="min-h-screen w-full bg-background relative overflow-hidden flex flex-col"
    >
        <div className="flex items-center justify-between gap-3 px-4 py-3 shrink-0">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => router.push("/profile")}
            aria-label="Back"
            className="rounded-full border border-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex flex-col items-center">
            <span className="text-base font-semibold">edit profile</span>
            <p className="text-[11px] text-muted-foreground">
              upload an image and update your details
            </p>
          </div>
          <Button
            type="submit"
            disabled={!isDirty}
            size="sm"
            className="rounded-full bg-accent text-accent-foreground hover:bg-accent/90 disabled:opacity-40"
          >
            save
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 pb-36 space-y-4">
          <Card className="border-border bg-card/90 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-[15px]">
                <Camera className="h-4 w-4 text-accent" />
                avatar upload
              </CardTitle>
              <CardDescription>
                Upload a photo from your device. It stays local for now.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start gap-4">
                <Avatar className="h-20 w-20 ring-1 ring-border bg-muted">
                  <AvatarImage src={avatarPreview || undefined} alt={draft.displayName} />
                  <AvatarFallback className="bg-accent/10 text-base font-semibold text-accent">
                    {avatarInitials}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1 space-y-2">
                  <p className="text-sm font-medium leading-none">preview</p>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    The image is saved with your session only. There is no backend upload yet.
                  </p>
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
                    onChange={handleFileChange}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border bg-card/90 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-[15px]">profile details</CardTitle>
              <CardDescription>
                Keep the core fields current so your friends see the right info.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="displayName" className="text-xs text-muted-foreground">
                  name
                </Label>
                <Input
                  id="displayName"
                  autoComplete="name"
                  required
                  minLength={2}
                  maxLength={50}
                  value={draft.displayName}
                  onChange={(event) =>
                    setDraft((prev) => ({ ...prev, displayName: event.target.value }))
                  }
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="username" className="text-xs text-muted-foreground">
                  username
                </Label>
                <div className="relative">
                  <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-muted-foreground">
                    @
                  </span>
                  <Input
                    id="username"
                    autoComplete="username"
                    required
                    minLength={3}
                    maxLength={30}
                    pattern="[a-zA-Z0-9_-]+"
                    className="pl-7"
                    value={draft.username}
                    onChange={(event) =>
                      setDraft((prev) => ({ ...prev, username: event.target.value }))
                    }
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-xs text-muted-foreground">
                  email
                </Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={draft.email}
                  onChange={(event) => setDraft((prev) => ({ ...prev, email: event.target.value }))}
                />
              </div>
            </CardContent>
          </Card>

          <Card className="border-border bg-card/90 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-[15px]">social links</CardTitle>
              <CardDescription>
                Add the handles people can use when they want to reach you.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="instagram" className="text-xs text-muted-foreground">
                  instagram
                </Label>
                <div className="relative">
                  <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-muted-foreground">
                    @
                  </span>
                  <Input
                    id="instagram"
                    placeholder="yourhandle"
                    className="pl-7"
                    value={draft.instagram}
                    onChange={(event) =>
                      setDraft((prev) => ({ ...prev, instagram: event.target.value }))
                    }
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="telegram" className="text-xs text-muted-foreground">
                  telegram
                </Label>
                <div className="relative">
                  <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-muted-foreground">
                    @
                  </span>
                  <Input
                    id="telegram"
                    placeholder="yourhandle"
                    className="pl-7"
                    value={draft.telegram}
                    onChange={(event) =>
                      setDraft((prev) => ({ ...prev, telegram: event.target.value }))
                    }
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex items-center justify-between gap-3 pb-2 pt-1">
            <Button type="button" variant="outline" onClick={handleReset} className="rounded-full border-border">
              reset
            </Button>
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
        </div>

        <div className="absolute bottom-6 left-0 right-0 z-10">
          <BottomNav />
        </div>
    </form>
  )
}

export default function EditProfilePage() {
  const { user } = useAuth()

  if (!user) return null

  return <ProfileEditPageContent key={`${user.id}:${user.updatedAt}`} user={user} />
}
