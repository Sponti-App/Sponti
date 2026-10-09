"use client"

// PROTOTYPE (#522), throwaway. Three takes on the home map's sheet when the
// map is quiet, for three viewers (signed out, a new account with 0 friends,
// an account with friends). What they share, from the #522 review:
//   - no peach button in the sheet: the nav's flare button is the one peach
//     call to action, and the sheet points at it instead of competing;
//   - no type chips or "0 nearby" until there are flares to filter;
//   - the empty state carries the value prop, not "no flares within 10 km".
// With "2 flares" each take shows the rail and the chips under its lead.

import type { ReactNode } from "react"
import { CaretDownIcon, PlusIcon } from "@/components/icons"
import { Avatar, AvatarFallback, AvatarGroup } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"
import {
  Dock,
  FauxMap,
  FlareRail,
  FRIENDS,
  IDEAS,
  Panel,
  TopBar,
  TypeChips,
  typeOf,
  type VariantProps,
} from "./_shared"

const INK_BUTTON =
  "inline-flex h-10 items-center justify-center gap-1.5 rounded-full bg-foreground px-4 text-sm font-medium text-background active:scale-[0.97]"
const TEXT_LINK = "font-medium text-foreground underline-offset-4 underline"

/** Points at the nav's flare button: the sheet's call to action is that. */
function FlameHint({ children }: { children: ReactNode }) {
  return (
    <div className="flex justify-center">
      <span className="flex items-center gap-1 rounded-full bg-background/90 px-3 py-1 text-xs font-medium shadow-sm backdrop-blur-md">
        {children}
        <CaretDownIcon className="size-3.5" />
      </span>
    </div>
  )
}

/** The "2 flares" state: the take's lead line, then chips and the rail. */
function WithFlares({ lead }: { lead: ReactNode }) {
  return (
    <>
      <FlareRail />
      <Panel className="space-y-3 p-3">
        {lead}
        <TypeChips />
      </Panel>
    </>
  )
}

function Frame({
  viewer,
  flares,
  ideasEmphasized,
  children,
}: VariantProps & { ideasEmphasized?: boolean; children: ReactNode }) {
  return (
    <div className="fixed inset-0 overflow-hidden bg-background">
      <FauxMap flares={flares} ideasEmphasized={ideasEmphasized} />
      <TopBar viewer={viewer} />
      <Dock>{children}</Dock>
    </div>
  )
}

const friendNames = FRIENDS.map((f) => f.name)
const friendList = `${friendNames.slice(0, -1).join(", ")} and ${friendNames.at(-1)}`

// ---- A: copy-led ------------------------------------------------------------

/** The value prop is the empty state. Nothing to tap in the sheet but text
 * links; a hint points at the flame. */
export function VariantA(props: VariantProps) {
  const { viewer, flares, onStub } = props
  if (flares === "2") {
    return (
      <Frame {...props}>
        <WithFlares
          lead={
            <p className="text-base font-semibold">
              2 flares near you
              <span className="font-normal text-muted-foreground">
                {" "}
                · tap one to join
              </span>
            </p>
          }
        />
      </Frame>
    )
  }

  const copy =
    viewer === "signedOut"
      ? {
          eyebrow: "sponti",
          title: "less coordinating. more living.",
          body: "a friend lights a flare, you tap in, you go. no group chat.",
        }
      : {
          eyebrow: "quiet right now",
          title: "nobody's out yet. be the signal.",
          body:
            viewer === "friends"
              ? `${friendList} see your flare the moment you light it.`
              : "light a flare and your friends see it. no back-and-forth.",
        }

  return (
    <Frame {...props}>
      <Panel>
        <p className="text-xs text-muted-foreground">{copy.eyebrow}</p>
        <p className="mt-1 text-lg leading-snug font-semibold">{copy.title}</p>
        <p className="mt-1 text-sm text-muted-foreground">{copy.body}</p>
        <p className="mt-3 text-sm text-muted-foreground">
          {viewer === "signedOut" ? (
            <>
              <button className={TEXT_LINK} onClick={() => onStub("sign up")}>
                sign up
              </button>{" "}
              · the dashed spots are ideas, tap one
            </>
          ) : viewer === "new" ? (
            <>
              no friends here yet ·{" "}
              <button className={TEXT_LINK} onClick={() => onStub("invite")}>
                invite one
              </button>
            </>
          ) : (
            <>
              <button className={TEXT_LINK} onClick={() => onStub("soon")}>
                see what&apos;s soon
              </button>{" "}
              · or tap a dashed idea spot
            </>
          )}
        </p>
      </Panel>
      <FlameHint>light a flare</FlameHint>
    </Frame>
  )
}

// ---- B: idea-led ------------------------------------------------------------

/** Real-life ideas are the empty state: one tap makes one your flare. */
export function VariantB(props: VariantProps) {
  const { viewer, flares, onStub } = props
  if (flares === "2") {
    return (
      <Frame {...props}>
        <WithFlares
          lead={
            <p className="text-base font-semibold">
              2 flares near you
              <span className="font-normal text-muted-foreground">
                {" "}
                · or start your own
              </span>
            </p>
          }
        />
      </Frame>
    )
  }

  return (
    <Frame {...props} ideasEmphasized>
      <Panel className="px-0 pb-3">
        <div className="px-4">
          {viewer === "signedOut" && (
            <p className="text-xs text-muted-foreground">
              less coordinating. more living.
            </p>
          )}
          <p className="mt-0.5 text-base font-semibold">
            quiet right now. start something real.
          </p>
          <p className="mt-0.5 text-sm text-muted-foreground">
            one tap turns an idea into your flare.
          </p>
        </div>
        <div className="scrollbar-none mt-3 flex snap-x gap-2 overflow-x-auto px-4">
          {IDEAS.map((idea) => {
            const Icon = typeOf(idea.category).icon
            return (
              <div
                key={idea.id}
                className="flex w-[62%] shrink-0 snap-start flex-col rounded-2xl border border-dashed border-border bg-card p-3"
              >
                <span className="flex size-9 items-center justify-center rounded-xl bg-muted">
                  <Icon className="size-4" />
                </span>
                <p className="mt-2 line-clamp-2 text-sm leading-snug font-semibold">
                  {idea.title}
                </p>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  {idea.place.name}
                </p>
                <button
                  type="button"
                  onClick={() => onStub(`light: ${idea.title}`)}
                  className="mt-3 inline-flex h-9 items-center justify-center gap-1 rounded-full border border-foreground/80 text-xs font-medium active:scale-[0.97]"
                >
                  <PlusIcon className="size-3.5" />
                  make it a flare
                </button>
              </div>
            )
          })}
        </div>
        {viewer === "new" && (
          <p className="mt-3 px-4 text-xs text-muted-foreground">
            flares go to your friends ·{" "}
            <button className={TEXT_LINK} onClick={() => onStub("invite")}>
              invite one
            </button>
          </p>
        )}
      </Panel>
    </Frame>
  )
}

// ---- C: people-led ----------------------------------------------------------

function FriendFaces({ ghost }: { ghost?: boolean }) {
  return (
    <AvatarGroup>
      {FRIENDS.map((f) => (
        <Avatar
          key={f.name}
          className={cn("size-9", ghost && "opacity-40 grayscale")}
        >
          <AvatarFallback className="text-xs">
            {ghost ? "" : f.name.slice(0, 2)}
          </AvatarFallback>
        </Avatar>
      ))}
    </AvatarGroup>
  )
}

function EmptySlots() {
  return (
    <div className="flex -space-x-2">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="flex size-9 items-center justify-center rounded-full border border-dashed border-muted-foreground/60 bg-background text-muted-foreground"
        >
          {i === 0 && <PlusIcon className="size-4" />}
        </span>
      ))}
    </div>
  )
}

/** Your people lead: the network is alive even when nothing is live. */
export function VariantC(props: VariantProps) {
  const { viewer, flares, onStub } = props

  const people =
    viewer === "friends" ? (
      <div className="flex items-center gap-3">
        <FriendFaces />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">
            {friendList} are on sponti
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {FRIENDS[0].name} {FRIENDS[0].hint}
          </p>
        </div>
      </div>
    ) : viewer === "new" ? (
      <div className="flex items-center gap-3">
        <EmptySlots />
        <div className="min-w-0">
          <p className="text-sm font-semibold">sponti works with your people</p>
          <p className="text-xs text-muted-foreground">
            add one friend and their plans show up here.
          </p>
        </div>
      </div>
    ) : (
      <div className="flex items-center gap-3">
        <FriendFaces ghost />
        <div className="min-w-0">
          <p className="text-sm font-semibold">
            your friends&apos; plans show up here
          </p>
          <p className="text-xs text-muted-foreground">
            a signal, not another conversation.
          </p>
        </div>
      </div>
    )

  if (flares === "2") {
    return (
      <Frame {...props}>
        <WithFlares
          lead={
            viewer === "friends" ? (
              people
            ) : (
              <p className="text-base font-semibold">2 open flares near you</p>
            )
          }
        />
      </Frame>
    )
  }

  return (
    <Frame {...props}>
      <Panel>
        {people}
        {viewer !== "friends" && (
          <button
            type="button"
            onClick={() =>
              onStub(viewer === "new" ? "invite a friend" : "sign up")
            }
            className={cn(INK_BUTTON, "mt-3 w-full")}
          >
            {viewer === "new"
              ? "invite a friend"
              : "sign up, it takes a minute"}
          </button>
        )}
        <div className="mt-3 border-t border-border/60 pt-3">
          <p className="text-sm font-semibold">nobody&apos;s out right now.</p>
          <p className="text-xs text-muted-foreground">
            {viewer === "friends"
              ? "light a flare and they'll see it. drinks, a walk, ping-pong."
              : "the dashed spots are ideas: ping-pong, a gallery, a walk."}
          </p>
        </div>
      </Panel>
      {viewer === "friends" && <FlameHint>light a flare</FlameHint>}
    </Frame>
  )
}
