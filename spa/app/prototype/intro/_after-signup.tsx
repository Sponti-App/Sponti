"use client"

// PROTOTYPE (#373) — after sign-up: round 1's B. No full-screen intro (#313's
// three slides go: the intro slides and the map already said it). A checklist
// sits in the map's sheet until it's done. Its button is the friend-count
// call to action, as today: no friends → add your first friend (QR, or the
// 7-day invite link, #124); friends → light your first flare.
//
// The kept draft was lit (or put off with "not now") on the way here, so the
// checklist only says what's new: a flare only reaches friends, and a new
// account has none. Its button is ink, because the nav's flare button is already the
// screen's peach.

import {
  CheckIcon,
  FlameIcon,
  LinkIcon,
  QrCodeIcon,
  UserPlusIcon,
  XIcon,
} from "@/components/icons"
import { cn } from "@/lib/utils"
import { PEOPLE, YOU } from "./_mock"
import { InkButton, PersonAvatar, SheetHandle, TextButton } from "./_shared"

function ChecklistRow({
  n,
  done,
  current,
  title,
  hint,
}: {
  n: number
  done: boolean
  current: boolean
  title: string
  hint: string
}) {
  return (
    <li className="flex items-start gap-3 py-2">
      <span
        className={cn(
          "flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
          done
            ? "bg-foreground text-background"
            : current
              ? "border-2 border-foreground"
              : "border border-border text-muted-foreground"
        )}
      >
        {done ? <CheckIcon className="size-3.5" weight="bold" /> : n}
      </span>
      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "text-sm",
            done ? "text-muted-foreground line-through" : "font-medium"
          )}
        >
          {title}
        </p>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </div>
    </li>
  )
}

/** The checklist, as the map's dock. */
export function ChecklistDock({
  friends,
  lit,
  flareTitle,
  ideaTitle,
  onAddFriend,
  onLight,
  onHide,
  onInvite,
}: {
  /** 0, or the people already here (signed up from an invite link). */
  friends: number
  lit: boolean
  flareTitle: string
  ideaTitle: string
  onAddFriend: () => void
  onLight: () => void
  onHide: () => void
  /** A friend added after the flare was lit isn't on its invite list: the
   * api resolves invitees once, at creation (eventService.createEvent). */
  onInvite: () => void
}) {
  const friendDone = friends > 0
  const allDone = friendDone && lit
  const friendNames =
    friends === 1 ? "lena's here" : "lena, mia and sam are here"
  return (
    <div className="rounded-t-3xl bg-background px-4 pt-2 pb-4 shadow-(--shadow-sheet)">
      <SheetHandle />
      <div className="flex items-center justify-between">
        <p className="text-base font-semibold">
          {allDone ? "you're set" : "two things to get going"}
        </p>
        <button
          type="button"
          aria-label="hide"
          onClick={onHide}
          className="flex size-9 items-center justify-center text-muted-foreground"
        >
          <XIcon className="size-4" />
        </button>
      </div>
      {allDone && (
        <div className="mt-2 flex items-center gap-3">
          <div className="flex -space-x-2">
            {(friends === 1
              ? [PEOPLE.lena]
              : [PEOPLE.lena, PEOPLE.mia, PEOPLE.sam]
            ).map((p) => (
              <PersonAvatar key={p.name} person={p} />
            ))}
          </div>
          <p className="text-sm text-muted-foreground">
            {friends === 1
              ? "lena's in. she joined after you lit your flare, so she isn't invited to it yet."
              : "they can see your flare now. joins show up in your feed."}
          </p>
        </div>
      )}
      {allDone && friends === 1 && (
        <InkButton onClick={onInvite} className="mt-3">
          <UserPlusIcon className="size-4" />
          invite lena to it
        </InkButton>
      )}
      {!allDone && (
        <ol className="mt-1">
          <ChecklistRow
            n={1}
            done={lit}
            current={!lit && friendDone}
            title="light your first flare"
            hint={lit ? `${flareTitle} is live` : `idea nearby: ${ideaTitle}`}
          />
          <ChecklistRow
            n={2}
            done={friendDone}
            current={!friendDone}
            title="add your first friend"
            hint={
              friendDone
                ? friendNames
                : lit
                  ? "flares only go to friends, and you have none here yet"
                  : "flares only go to friends"
            }
          />
        </ol>
      )}
      {!allDone && (
        <InkButton
          onClick={friendDone ? onLight : onAddFriend}
          className="mt-3"
        >
          {friendDone ? (
            <>
              <FlameIcon className="size-4" />
              light your first flare
            </>
          ) : (
            <>
              <QrCodeIcon className="size-4" />
              add your first friend
            </>
          )}
        </InkButton>
      )}
    </div>
  )
}

/** The first-friend step: today's QrShareSheet plus the 7-day invite link
 * (#124), as one screen. */
export function FirstFriend({
  onDone,
  onLater,
}: {
  onDone: () => void
  onLater: () => void
}) {
  return (
    <div className="flex min-h-dvh flex-col bg-background px-6">
      <header className="flex items-center justify-between pt-3">
        <span className="text-xs text-muted-foreground">
          add your first friend
        </span>
        <button
          type="button"
          onClick={onLater}
          className="min-h-11 text-sm font-medium text-muted-foreground"
        >
          later
        </button>
      </header>
      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <FakeQr />
        <p className="mt-4 text-base font-semibold">@{YOU.handle}</p>
        <p className="mt-2 max-w-xs text-sm text-muted-foreground">
          show this to a friend. they scan it, and you&apos;re connected.
        </p>
      </div>
      <div className="flex flex-col gap-1 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        <InkButton onClick={onDone}>
          <LinkIcon className="size-4" />
          send an invite link instead
        </InkButton>
        <TextButton onClick={onDone}>
          prototype: pretend lena scanned it
        </TextButton>
      </div>
    </div>
  )
}

function FakeQr() {
  // A deterministic pattern; not a real code.
  const cells = Array.from({ length: 21 * 21 }, (_, i) => {
    const x = i % 21
    const y = Math.floor(i / 21)
    const finder = (x < 7 && y < 7) || (x > 13 && y < 7) || (x < 7 && y > 13)
    if (finder) {
      const fx = x > 13 ? x - 14 : x
      const fy = y > 13 ? y - 14 : y
      return (
        fx === 0 ||
        fx === 6 ||
        fy === 0 ||
        fy === 6 ||
        (fx >= 2 && fx <= 4 && fy >= 2 && fy <= 4)
      )
    }
    return (x * 7 + y * 13 + x * y) % 3 === 0
  })
  return (
    <div className="rounded-2xl bg-card p-4 shadow-(--shadow-card)">
      <div
        aria-label="qr code"
        className="grid size-44 grid-cols-[repeat(21,1fr)]"
      >
        {cells.map((on, i) => (
          <span key={i} className={on ? "bg-foreground" : ""} />
        ))}
      </div>
    </div>
  )
}
