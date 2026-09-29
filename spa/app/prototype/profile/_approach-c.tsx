"use client"

// PROTOTYPE (#166) approach C: make the audience visible. Someone else's
// profile is quiet: the bio leads, socials are plain tappable handles in one
// line. Your own profile is a preview you can flip between "friends see" and
// "everyone else sees", so the privacy rule is shown, not explained. Editing
// stays where the fields already are: settings (which today keeps instagram
// and telegram in localStorage). Data: the same flat auth-server fields as A.

import { useState } from "react"
import { Globe, Lock, Settings, UserPlus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { MockPerson } from "./_mock"
import {
  NotFound,
  OptionsButton,
  OutOfScope,
  PersonAvatar,
  TopBar,
  seesDetails,
  socialUrl,
  type ApproachProps,
} from "./_shared"

type Audience = "friends" | "everyone"

const TAB =
  "text-sm data-active:bg-card data-active:text-primary dark:data-active:bg-card dark:data-active:text-primary"

export function ApproachC({
  view,
  viewer,
  person,
  me,
  onToast,
}: ApproachProps) {
  const [audience, setAudience] = useState<Audience>("friends")

  if (view === "other" && viewer === "blockedby") {
    return (
      <>
        <TopBar />
        <NotFound username={person.username} />
      </>
    )
  }

  if (view === "own") {
    return (
      <>
        <TopBar
          title="your profile"
          right={
            <button
              type="button"
              aria-label="edit in settings"
              onClick={() => onToast("prototype: opens settings › profile")}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-border"
            >
              <Settings className="h-4 w-4" />
            </button>
          }
        />
        <div className="px-4 pt-4">
          <Tabs
            value={audience}
            onValueChange={(v) => setAudience(v as Audience)}
          >
            <TabsList className="h-9 w-full">
              <TabsTrigger value="friends" className={TAB}>
                friends see
              </TabsTrigger>
              <TabsTrigger value="everyone" className={TAB}>
                everyone else sees
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
        <Card person={me} details={audience === "friends"} />
        <div className="mx-4 mt-2 flex items-start gap-2 rounded-lg bg-muted p-3 text-xs text-muted-foreground">
          {me.profileVisibility === "private" ? (
            <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          ) : (
            <Globe className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          )}
          <p>
            {me.profileVisibility === "private"
              ? "private: you're not in search. people with your link see your name and photo."
              : "public: people can find you in search and see your name and photo."}{" "}
            bio and socials are always friends only.
          </p>
        </div>
        {!me.bio && (
          <button
            type="button"
            onClick={() => onToast("prototype: opens settings › profile")}
            className="mx-4 mt-3 text-left text-sm font-medium underline decoration-border underline-offset-4"
          >
            add a bio in settings
          </button>
        )}
        <OutOfScope />
      </>
    )
  }

  const details = seesDetails(view, viewer)
  return (
    <>
      <TopBar
        right={
          viewer !== "youblocked" ? (
            <OptionsButton onClick={() => onToast("prototype: block")} />
          ) : undefined
        }
      />
      <Card person={person} details={details} />
      <div className="px-4">
        {viewer === "stranger" ? (
          <Button
            className="w-full rounded-full bg-accent text-accent-foreground hover:bg-accent/90"
            onClick={() => onToast("prototype: request sent")}
          >
            <UserPlus className="mr-2 h-4 w-4" />
            add friend
          </Button>
        ) : viewer === "pending" ? (
          <Button
            variant="outline"
            className="w-full rounded-full"
            onClick={() => onToast("prototype: cancelled")}
          >
            request sent · cancel
          </Button>
        ) : viewer === "youblocked" ? (
          <Button
            variant="outline"
            className="w-full rounded-full"
            onClick={() => onToast("prototype: unblocked")}
          >
            unblock
          </Button>
        ) : null}
      </div>
      <OutOfScope />
    </>
  )
}

function Card({ person, details }: { person: MockPerson; details: boolean }) {
  return (
    <div className="flex flex-col gap-3 px-4 pt-6 pb-5">
      <div className="flex items-center gap-3">
        <PersonAvatar person={person} size={56} />
        <div className="min-w-0">
          <p className="truncate text-base font-semibold">
            {person.displayName}
          </p>
          <p className="truncate text-sm text-muted-foreground">
            @{person.username}
          </p>
        </div>
      </div>
      {details && person.bio && <p className="text-base">{person.bio}</p>}
      {details && person.socials.length > 0 && (
        <p className="text-sm text-muted-foreground">
          {person.socials.map((s, i) => (
            <span key={s.network}>
              {i > 0 && " · "}
              {s.network}{" "}
              <a
                href={socialUrl(s.network, s.handle)}
                target="_blank"
                rel="noreferrer"
                className="font-medium text-foreground underline decoration-border underline-offset-4"
              >
                @{s.handle}
              </a>
            </span>
          ))}
        </p>
      )}
      {!details && (
        <p className="text-xs text-muted-foreground">
          name and photo only · the rest is for friends
        </p>
      )}
    </div>
  )
}
