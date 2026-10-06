"use client"

// PROTOTYPE (#369) — the friends screen (app/circles, connections tab), with
// and without the handle card from Patrick's reference: your @handle, share
// and qr buttons, and one line about who can find you. `friends=0` is the
// empty state. Look-alike of the real page (it loads circles and
// connections), same header, tabs and search field.

import {
  ArrowLeftIcon,
  MagnifyingGlassIcon,
  QrCodeIcon,
  ShareNetworkIcon,
  UsersIcon,
} from "@/components/icons"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { FRIENDS, ME, initialsOf } from "./_mock"
import { MeAvatar, MockNav, type ScreenProps } from "./_shared"

export function FriendsScreen({ state, go, stub }: ScreenProps) {
  const card = state.card === "on"
  const friends = state.friends === "3" ? FRIENDS : []
  const openShare = (open: "qr" | "link") =>
    go({ screen: "share", base: "friends", open })

  return (
    <div className="absolute inset-0 flex flex-col bg-background">
      <div className="shrink-0 bg-background">
        <div className="flex items-center justify-between px-4 py-3">
          <button
            type="button"
            onClick={() => go({ screen: "home" })}
            aria-label="back"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-foreground"
          >
            <ArrowLeftIcon className="h-4 w-4" />
          </button>
          <span className="text-base font-semibold">circles</span>
          {/* Today's only way in to the qr. With the card it moves there. */}
          {card ? (
            <span className="h-9 w-9" />
          ) : (
            <button
              type="button"
              onClick={() => openShare("qr")}
              aria-label="show your qr"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-foreground"
            >
              <QrCodeIcon className="h-4 w-4" />
            </button>
          )}
        </div>
        <div className="border-b border-border/60 px-4 pb-3">
          <Tabs defaultValue="people">
            <TabsList className="w-full">
              <TabsTrigger value="circles">circles</TabsTrigger>
              <TabsTrigger value="people">connections</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-6">
        {card && (
          <section className="pt-4">
            <div className="rounded-2xl border border-border bg-card p-4">
              <div className="flex items-center gap-3">
                <MeAvatar className="size-11" fallbackClassName="text-sm" />
                <div className="min-w-0">
                  <p className="truncate text-base font-semibold">
                    @{ME.username}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {ME.displayName}
                  </p>
                </div>
              </div>
              <div className="mt-4 flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => openShare("link")}
                  className="h-10 flex-1 rounded-full"
                >
                  <ShareNetworkIcon className="h-4 w-4" />
                  share
                </Button>
                <Button
                  variant="outline"
                  onClick={() => openShare("qr")}
                  className="h-10 flex-1 rounded-full"
                >
                  <QrCodeIcon className="h-4 w-4" />
                  qr code
                </Button>
              </div>
            </div>
            <p className="mt-2 px-1 text-xs text-muted-foreground">
              anyone with your @handle can find you and send a request. who can
              find you is in{" "}
              <button
                type="button"
                onClick={() => stub("/settings")}
                className="font-medium text-foreground underline underline-offset-2"
              >
                settings
              </button>
              .
            </p>
          </section>
        )}

        <div className="pt-4 pb-2">
          <div className="relative">
            <MagnifyingGlassIcon className="pointer-events-none absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="add by @handle" className="pl-9" readOnly />
          </div>
        </div>

        {friends.length > 0 ? (
          <section className="mt-2">
            <p className="mb-2 text-xs font-medium text-foreground">
              {friends.length} connections
            </p>
            <ul className="flex flex-col gap-2">
              {friends.map((f) => (
                <li
                  key={f.id}
                  className="flex items-center gap-3 rounded-xl border border-border bg-card p-3"
                >
                  <Avatar>
                    <AvatarFallback className="bg-accent/10 text-xs font-medium text-accent-ink">
                      {initialsOf(f.displayName)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {f.displayName}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      @{f.username}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ) : (
          <section className="mt-6 flex flex-col items-center px-6 text-center">
            <UsersIcon className="size-6 text-muted-foreground" />
            <p className="mt-3 text-base font-semibold">no friends here yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {card
                ? "share your link or let a friend scan your qr. they show up here once they're in."
                : "search a friend's @handle above, or show them your qr."}
            </p>
          </section>
        )}
      </div>

      <MockNav
        active="circles"
        onTab={(tab) => tab === "home" && go({ screen: "home" })}
      />
    </div>
  )
}
