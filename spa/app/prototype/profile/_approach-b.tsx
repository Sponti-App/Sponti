"use client"

// PROTOTYPE (#166) approach B: a contact card. Compact left-aligned header,
// then one row per fact (bio, instagram, telegram, and on your own profile
// "who can find you"). You edit a row where it is, in a small sheet. Data: a
// `socials: [{ network, handle }]` list on the auth-server user, so a network
// is added later by widening one enum.

import { useState } from "react"
import { ExternalLink, Lock, Pencil, UserPlus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Drawer, DrawerContent, DrawerTitle } from "@/components/ui/drawer"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
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

type Field = "bio" | Network

export function ApproachB({
  view,
  viewer,
  person,
  me,
  onToast,
}: ApproachProps) {
  const [draft, setDraft] = useState(me)
  const [editing, setEditing] = useState<Field | null>(null)

  if (view === "other" && viewer === "blockedby") {
    return (
      <>
        <TopBar />
        <NotFound username={person.username} />
      </>
    )
  }

  const own = view === "own"
  const shown = own ? draft : person
  const details = seesDetails(view, viewer)
  const handle = (n: Network) =>
    shown.socials.find((s) => s.network === n)?.handle

  return (
    <>
      <TopBar
        right={
          !own && viewer !== "youblocked" ? (
            <OptionsButton onClick={() => onToast("prototype: block")} />
          ) : undefined
        }
      />
      <div className="flex items-center gap-4 border-b border-border/60 px-4 py-5">
        <PersonAvatar person={shown} size={64} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-lg font-semibold">{shown.displayName}</p>
          <p className="truncate text-sm text-muted-foreground">
            @{shown.username}
          </p>
          {!own && (
            <p className="mt-1 text-xs text-muted-foreground">
              {viewer === "friend"
                ? "friends"
                : viewer === "pending"
                  ? "request sent"
                  : viewer === "youblocked"
                    ? "you blocked them"
                    : "not connected"}
            </p>
          )}
        </div>
      </div>

      {details ? (
        <ul className="flex flex-col">
          <Row
            label="bio"
            value={shown.bio || (own ? "add a line about you" : null)}
            muted={!shown.bio}
            onEdit={own ? () => setEditing("bio") : undefined}
          />
          {(["instagram", "telegram"] as const).map((n) => {
            const h = handle(n)
            if (!own && !h) return null
            return (
              <Row
                key={n}
                label={n}
                icon={
                  <SocialIcon network={n} className="text-muted-foreground" />
                }
                value={h ? `@${h}` : `add ${n}`}
                muted={!h}
                href={!own && h ? socialUrl(n, h) : undefined}
                onEdit={own ? () => setEditing(n) : undefined}
              />
            )
          })}
          {own && (
            <li className="flex min-h-14 items-center gap-3 border-b border-border/60 px-4">
              <Lock className="h-4 w-4 text-muted-foreground" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="text-sm">hide me from search</p>
                <p className="text-xs text-muted-foreground">
                  people with your link still see your name and photo
                </p>
              </div>
              <Switch
                aria-label="hide me from search"
                checked={shown.profileVisibility === "private"}
                onCheckedChange={(on) =>
                  setDraft({
                    ...draft,
                    profileVisibility: on ? "private" : "public",
                  })
                }
              />
            </li>
          )}
        </ul>
      ) : (
        viewer !== "youblocked" && (
          <p className="px-4 py-4 text-sm text-muted-foreground">
            bio and socials are only for friends.
          </p>
        )
      )}

      {!own && viewer !== "friend" && (
        <div className="px-4 pt-4">
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
              cancel request
            </Button>
          ) : (
            <Button
              variant="outline"
              className="w-full rounded-full"
              onClick={() => onToast("prototype: unblocked")}
            >
              unblock
            </Button>
          )}
        </div>
      )}
      <OutOfScope />

      <FieldSheet
        field={editing}
        person={draft}
        onClose={() => setEditing(null)}
        onSave={(next) => {
          setDraft(next)
          setEditing(null)
          onToast("saved")
        }}
      />
    </>
  )
}

function Row({
  label,
  icon,
  value,
  muted,
  href,
  onEdit,
}: {
  label: string
  icon?: React.ReactNode
  value: string | null
  muted?: boolean
  href?: string
  onEdit?: () => void
}) {
  if (value === null) return null
  const body = (
    <>
      {icon}
      <div className="min-w-0 flex-1">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p
          className={
            muted ? "text-sm text-muted-foreground" : "truncate text-sm"
          }
        >
          {value}
        </p>
      </div>
      {href ? (
        <ExternalLink className="h-4 w-4 text-muted-foreground" aria-hidden />
      ) : onEdit ? (
        <Pencil className="h-4 w-4 text-muted-foreground" aria-hidden />
      ) : null}
    </>
  )
  const cls =
    "flex min-h-14 w-full items-center gap-3 border-b border-border/60 px-4 py-2 text-left active:bg-muted"
  return (
    <li>
      {href ? (
        <a
          href={href}
          target="_blank"
          rel="noreferrer"
          className={cls}
          aria-label={`${label} ${value}, opens ${label}`}
        >
          {body}
        </a>
      ) : onEdit ? (
        <button
          type="button"
          onClick={onEdit}
          className={cls}
          aria-label={`edit ${label}`}
        >
          {body}
        </button>
      ) : (
        <div className={cls}>{body}</div>
      )}
    </li>
  )
}

function FieldSheet({
  field,
  person,
  onClose,
  onSave,
}: {
  field: Field | null
  person: MockPerson
  onClose: () => void
  onSave: (next: MockPerson) => void
}) {
  return (
    <Drawer open={field !== null} onOpenChange={(o) => !o && onClose()}>
      <DrawerContent>
        {field && (
          <FieldForm
            key={field}
            field={field}
            person={person}
            onSave={onSave}
          />
        )}
      </DrawerContent>
    </Drawer>
  )
}

function FieldForm({
  field,
  person,
  onSave,
}: {
  field: Field
  person: MockPerson
  onSave: (next: MockPerson) => void
}) {
  const initial =
    field === "bio"
      ? person.bio
      : (person.socials.find((s) => s.network === field)?.handle ?? "")
  const [value, setValue] = useState(initial)
  const invalid =
    field !== "bio" &&
    value.trim() !== "" &&
    !HANDLE_RULES[field].pattern.test(normalizeHandle(field, value))

  const save = () => {
    if (field === "bio") return onSave({ ...person, bio: value.trim() })
    const others = person.socials.filter((s) => s.network !== field)
    onSave({
      ...person,
      socials: value.trim()
        ? [...others, { network: field, handle: normalizeHandle(field, value) }]
        : others,
    })
  }

  return (
    <div className="flex flex-col gap-3 px-4 pt-2 pb-8">
      <DrawerTitle className="text-base">{field}</DrawerTitle>
      <Input
        autoFocus
        value={value}
        maxLength={field === "bio" ? BIO_MAX : 64}
        placeholder={
          field === "bio"
            ? "one line about you"
            : "@handle or paste your profile link"
        }
        aria-invalid={invalid}
        onChange={(e) => setValue(e.target.value)}
      />
      <p
        className={
          invalid ? "text-xs text-destructive" : "text-xs text-muted-foreground"
        }
      >
        {field === "bio"
          ? `${value.length}/${BIO_MAX} · only friends see this`
          : HANDLE_RULES[field].hint}
      </p>
      <Button
        disabled={invalid}
        className="rounded-full bg-accent text-accent-foreground hover:bg-accent/90"
        onClick={save}
      >
        save
      </Button>
      {initial && (
        <button
          type="button"
          onClick={() => {
            setValue("")
            onSave(
              field === "bio"
                ? { ...person, bio: "" }
                : {
                    ...person,
                    socials: person.socials.filter((s) => s.network !== field),
                  }
            )
          }}
          className="text-sm text-destructive"
        >
          remove
        </button>
      )}
    </div>
  )
}
