"use client"

// PROTOTYPE (#166) approach A: centered identity card, a dedicated edit page.
// Socials are pill buttons that open the app. Data: flat fields on the
// auth-server user (bio, instagram, telegram).

import { useState } from "react"
import { ExternalLink, Globe, Lock, UserPlus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  BIO_MAX,
  HANDLE_RULES,
  normalizeHandle,
  type MockPerson,
  type Network,
} from "./_mock"
import {
  NotFound,
  OptionsButton,
  OutOfScope,
  PersonAvatar,
  SocialIcon,
  TopBar,
  seesDetails,
  socialUrl,
  type ApproachProps,
} from "./_shared"

export function ApproachA({
  view,
  viewer,
  person,
  me,
  onToast,
}: ApproachProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(me)

  if (view === "own" && editing) {
    return (
      <EditPage
        person={draft}
        onCancel={() => setEditing(false)}
        onSave={(next) => {
          setDraft(next)
          setEditing(false)
          onToast("profile saved")
        }}
      />
    )
  }
  if (view === "other" && viewer === "blockedby") {
    return (
      <>
        <TopBar />
        <NotFound username={person.username} />
      </>
    )
  }

  const shown = view === "own" ? draft : person
  const details = seesDetails(view, viewer)

  return (
    <>
      <TopBar
        right={
          view === "other" && viewer !== "youblocked" ? (
            <OptionsButton onClick={() => onToast("prototype: block")} />
          ) : undefined
        }
      />
      <div className="flex flex-col items-center gap-4 px-4 pt-10">
        <PersonAvatar person={shown} />
        <div className="text-center">
          <p className="text-lg font-semibold">{shown.displayName}</p>
          <p className="mt-0.5 text-sm text-muted-foreground">
            @{shown.username}
          </p>
          {view === "own" && (
            <VisibilityPill visibility={shown.profileVisibility} />
          )}
        </div>

        {details ? (
          <>
            {shown.bio ? (
              <p className="max-w-xs text-center text-sm">{shown.bio}</p>
            ) : view === "own" ? (
              <p className="text-sm text-muted-foreground">no bio yet</p>
            ) : null}
            {shown.socials.length > 0 && (
              <div className="flex flex-wrap justify-center gap-2">
                {shown.socials.map((s) => (
                  <a
                    key={s.network}
                    href={socialUrl(s.network, s.handle)}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={`${s.network} @${s.handle}, opens ${s.network}`}
                    className="inline-flex h-9 items-center gap-1.5 rounded-full border border-border bg-card px-3 text-sm"
                  >
                    <SocialIcon
                      network={s.network}
                      className="text-muted-foreground"
                    />
                    @{s.handle}
                    <ExternalLink
                      className="h-3 w-3 text-muted-foreground"
                      aria-hidden
                    />
                  </a>
                ))}
              </div>
            )}
          </>
        ) : (
          viewer !== "youblocked" && (
            // Same line whether or not they have a bio or socials, so it
            // doesn't hint at what's there.
            <p className="text-xs text-muted-foreground">
              friends see their bio and socials
            </p>
          )
        )}

        <div className="mt-2">
          {view === "own" ? (
            <Button
              variant="outline"
              className="rounded-full px-6"
              onClick={() => setEditing(true)}
            >
              edit profile
            </Button>
          ) : viewer === "stranger" ? (
            <Button
              className="rounded-full bg-accent px-6 text-accent-foreground hover:bg-accent/90"
              onClick={() => onToast("prototype: request sent")}
            >
              <UserPlus className="mr-2 h-4 w-4" />
              add friend
            </Button>
          ) : viewer === "pending" ? (
            <Button
              variant="outline"
              className="rounded-full px-6"
              onClick={() => onToast("prototype: cancelled")}
            >
              cancel request
            </Button>
          ) : viewer === "youblocked" ? (
            <Button
              variant="outline"
              className="rounded-full px-6"
              onClick={() => onToast("prototype: unblocked")}
            >
              unblock
            </Button>
          ) : (
            <p className="text-xs text-muted-foreground">you&apos;re friends</p>
          )}
        </div>
      </div>
      <OutOfScope />
    </>
  )
}

function VisibilityPill({
  visibility,
}: {
  visibility: MockPerson["profileVisibility"]
}) {
  const Icon = visibility === "private" ? Lock : Globe
  return (
    <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
      <Icon className="h-3 w-3" aria-hidden />
      {visibility === "private"
        ? "private · not in search"
        : "public · in search"}
    </span>
  )
}

function EditPage({
  person,
  onCancel,
  onSave,
}: {
  person: MockPerson
  onCancel: () => void
  onSave: (next: MockPerson) => void
}) {
  const handle = (n: Network) =>
    person.socials.find((s) => s.network === n)?.handle ?? ""
  const [bio, setBio] = useState(person.bio)
  const [instagram, setInstagram] = useState(handle("instagram"))
  const [telegram, setTelegram] = useState(handle("telegram"))
  const errors = {
    instagram:
      instagram &&
      !HANDLE_RULES.instagram.pattern.test(
        normalizeHandle("instagram", instagram)
      ),
    telegram:
      telegram &&
      !HANDLE_RULES.telegram.pattern.test(
        normalizeHandle("telegram", telegram)
      ),
  }

  return (
    <>
      <TopBar title="edit profile" onBack={onCancel} />
      <div className="flex flex-col gap-6 px-4 pt-6 pb-8">
        <div className="flex items-center gap-3">
          <PersonAvatar person={person} size={56} />
          <p className="text-xs text-muted-foreground">
            {person.avatarUrl
              ? "your photo from google"
              : "sign in with google to use your photo"}
          </p>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="a-bio">bio</Label>
          <Input
            id="a-bio"
            value={bio}
            maxLength={BIO_MAX}
            placeholder="one line about you"
            onChange={(e) => setBio(e.target.value)}
          />
          <p className="text-right text-xs text-muted-foreground">
            {bio.length}/{BIO_MAX}
          </p>
        </div>
        {(["instagram", "telegram"] as const).map((n) => (
          <div key={n} className="flex flex-col gap-2">
            <Label htmlFor={`a-${n}`}>{n}</Label>
            <Input
              id={`a-${n}`}
              value={n === "instagram" ? instagram : telegram}
              placeholder="@handle"
              aria-invalid={Boolean(errors[n])}
              onChange={(e) =>
                (n === "instagram" ? setInstagram : setTelegram)(e.target.value)
              }
            />
            <p
              className={
                errors[n]
                  ? "text-xs text-destructive"
                  : "text-xs text-muted-foreground"
              }
            >
              {HANDLE_RULES[n].hint}
            </p>
          </div>
        ))}
        <p className="text-xs text-muted-foreground">
          only friends see your bio and socials.
        </p>
        <Button
          disabled={Boolean(errors.instagram || errors.telegram)}
          className="rounded-full bg-accent text-accent-foreground hover:bg-accent/90"
          onClick={() =>
            onSave({
              ...person,
              bio: bio.trim(),
              socials: (
                [
                  ["instagram", instagram],
                  ["telegram", telegram],
                ] as const
              )
                .filter(([, v]) => v.trim())
                .map(([network, v]) => ({
                  network,
                  handle: normalizeHandle(network, v),
                })),
            })
          }
        >
          save
        </Button>
      </div>
    </>
  )
}
