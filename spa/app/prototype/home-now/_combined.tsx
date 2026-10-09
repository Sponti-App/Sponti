"use client"

// PROTOTYPE (#522), throwaway. Take 1, "combined": the picks from round 1.
//   - people first (C), made personal: the people you recently connected
//     with, each one tap from a flare with them;
//   - the value prop as the quiet line and for signed-out visitors (A);
//   - real-life ideas as their own cards on the map (B), title only.
// Round-1 corrections: two text styles per block at most (a 12px label
// with a 16px headline, or a 14px title with a 12px meta), never a card
// inside a card, no line that repeats another, dashed borders only for
// empty slots, and no peach in the sheet (the nav's flame is the one).

import { FlameIcon, PlusIcon, UserPlusIcon } from "@/components/icons"
import { cn } from "@/lib/utils"
import {
  avatarStyle,
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

/** Mock distances for the idea cards (the real ones come from the map). */
const IDEA_DISTANCE = ["900 m", "1.4 km", "2 km"]

const ROUND_ICON_BUTTON =
  "flex size-11 shrink-0 items-center justify-center rounded-full border border-border bg-background active:scale-95"

function IdeaCards({ onStub }: Pick<VariantProps, "onStub">) {
  return (
    <div className="scrollbar-none flex snap-x scroll-px-3 gap-2 overflow-x-auto px-3">
      {IDEAS.map((idea, i) => {
        const Icon = typeOf(idea.category).icon
        return (
          <div
            key={idea.id}
            className="flex w-44 shrink-0 snap-start flex-col rounded-2xl border border-border/60 bg-background/90 p-3 shadow-(--shadow-card) backdrop-blur-md"
          >
            <div className="flex items-start justify-between">
              <span className="flex size-10 items-center justify-center rounded-full bg-flare-open-tint text-flare-open-ink">
                <Icon className="size-5" />
              </span>
              <button
                type="button"
                aria-label={`make "${idea.title}" a flare`}
                onClick={() => onStub(`light: ${idea.title}`)}
                className="flex size-9 items-center justify-center rounded-full bg-foreground text-background active:scale-95"
              >
                <PlusIcon className="size-4" />
              </button>
            </div>
            <p className="mt-3 line-clamp-2 text-sm leading-snug font-semibold">
              {idea.title}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {IDEA_DISTANCE[i]}
            </p>
          </div>
        )
      })}
    </div>
  )
}

function Avatar({
  name,
  hue,
  isNew,
}: {
  name: string
  hue: number
  isNew?: boolean
}) {
  return (
    <span className="relative shrink-0">
      <span
        style={avatarStyle(hue)}
        className="flex size-11 items-center justify-center rounded-full text-sm font-semibold"
      >
        {name.slice(0, 2)}
      </span>
      {isNew && (
        <span className="absolute -right-0.5 -bottom-0.5 size-3.5 rounded-full border-2 border-background bg-accent" />
      )}
    </span>
  )
}

/** The people you recently connected with, one tap from a flare with them. */
function RecentPeople({ onStub }: Pick<VariantProps, "onStub">) {
  const recent = FRIENDS.filter((f) => f.isNew)
  return (
    <Panel className="py-3">
      <p className="text-xs text-muted-foreground">you recently connected</p>
      <ul className="mt-1 divide-y divide-border/60">
        {recent.map((f) => (
          <li key={f.name} className="flex items-center gap-3 py-2">
            <Avatar name={f.name} hue={f.hue} isNew />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">{f.name}</p>
              <p className="text-xs text-muted-foreground">{f.connected}</p>
            </div>
            <button
              type="button"
              aria-label={`light a flare with ${f.name}`}
              onClick={() => onStub(`flare with ${f.name}`)}
              className={ROUND_ICON_BUTTON}
            >
              <FlameIcon className="size-5" />
            </button>
          </li>
        ))}
      </ul>
    </Panel>
  )
}

export function Combined(props: VariantProps) {
  const { viewer, flares, onStub } = props

  let dock: React.ReactNode
  if (flares === "2") {
    dock = (
      <>
        <FlareRail />
        <Panel className="space-y-3 p-3">
          <p className="text-base font-semibold">2 flares near you</p>
          <TypeChips />
        </Panel>
      </>
    )
  } else if (viewer === "signedOut") {
    // A's line, then B's ideas: what sponti is, and what it's for.
    dock = (
      <>
        <Panel>
          <p className="text-base font-semibold">
            less coordinating. more living.
          </p>
          <p className="mt-0.5 text-sm text-muted-foreground">
            see a friend&apos;s plan, tap in, go.
          </p>
        </Panel>
        <IdeaCards onStub={onStub} />
      </>
    )
  } else if (viewer === "new") {
    // No people yet: the empty slots are the placeholder, one ink button.
    dock = (
      <>
        <Panel className="flex items-center gap-3">
          <div className="flex -space-x-2">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="size-11 rounded-full border border-dashed border-muted-foreground/60 bg-background"
              />
            ))}
          </div>
          <p className="min-w-0 flex-1 text-sm font-semibold">
            sponti works with your people
          </p>
          <button
            type="button"
            aria-label="invite a friend"
            onClick={() => onStub("invite")}
            className={cn(
              ROUND_ICON_BUTTON,
              "border-transparent bg-foreground text-background"
            )}
          >
            <UserPlusIcon className="size-5" />
          </button>
        </Panel>
        <IdeaCards onStub={onStub} />
      </>
    )
  } else {
    dock = (
      <>
        <RecentPeople onStub={onStub} />
        <IdeaCards onStub={onStub} />
      </>
    )
  }

  return (
    <div className="fixed inset-0 overflow-hidden bg-background">
      <FauxMap flares={flares} ideasEmphasized={flares === "0"} />
      <TopBar viewer={viewer} />
      <Dock>{dock}</Dock>
    </div>
  )
}
