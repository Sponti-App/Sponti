"use client"

// PROTOTYPE (#369) — the two takes on a menu that holds profile and settings.
//   A — the /menu page as it is (account card, then the rows), with
//       "profile" and "settings" added at the top.
//   B — the drawer the hamburger already opens on home (MenuDrawer), with the
//       profile card at the top, then settings, then about / faq / support,
//       and the legal row at the foot.
// Signed out, both keep the about, faq and legal rows, with "sign in" where
// the account card was.

import {
  ArrowLeftIcon,
  CaretRightIcon,
  GearIcon,
  PencilSimpleIcon,
  UserCircleIcon,
  type Icon,
} from "@/components/icons"
import { LegalLinks } from "@/components/legal-links"
import { menuItems } from "@/components/menu-items"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { ME } from "./_mock"
import { MeAvatar, MockHome, MockNav, type ScreenProps } from "./_shared"

const LEGAL_HREFS = new Set(["/menu/privacy", "/menu/terms", "/menu/impressum"])

export function MenuScreen(props: ScreenProps) {
  return props.state.menu === "A" ? (
    <MenuPage {...props} />
  ) : (
    <MenuDrawerTake {...props} />
  )
}

function Row({
  icon: Icon,
  label,
  sub,
  onClick,
  caret = false,
}: {
  icon: Icon
  label: string
  sub?: string
  onClick: () => void
  caret?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-xl px-1 py-3 text-left transition-colors hover:bg-muted active:bg-muted"
    >
      <Icon className="size-4 shrink-0 text-muted-foreground" />
      <span className="min-w-0 flex-1">
        <span className="block text-base font-medium">{label}</span>
        {sub && (
          <span className="mt-0.5 block text-xs text-muted-foreground">
            {sub}
          </span>
        )}
      </span>
      {caret && (
        <CaretRightIcon className="size-4 shrink-0 text-muted-foreground" />
      )}
    </button>
  )
}

function SignedOutCard({ onSignIn }: { onSignIn: () => void }) {
  return (
    <section className="pb-6">
      <UserCircleIcon className="size-12 text-muted-foreground" />
      <p className="mt-3 text-base font-semibold">you&apos;re looking around</p>
      <p className="mt-1 text-sm text-muted-foreground">
        sign in to see your friends&apos; flares and invite people.
      </p>
      <Button
        variant="outline"
        onClick={onSignIn}
        className="mt-4 h-10 rounded-full px-5"
      >
        sign in
      </Button>
    </section>
  )
}

// ---- A: the menu page ------------------------------------------------------

function MenuPage({ state, go, stub }: ScreenProps) {
  const signedIn = state.auth === "in"
  return (
    <div className="absolute inset-0 flex flex-col bg-background">
      {/* Same header as MenuPageShell. */}
      <header className="flex items-center justify-between px-4 pt-3 pb-5">
        <button
          type="button"
          aria-label="back to home"
          onClick={() => go({ screen: "home" })}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-border text-foreground transition-colors hover:bg-secondary active:scale-95"
        >
          <ArrowLeftIcon className="h-4 w-4" />
        </button>
        <h1 className="text-lg font-semibold">menu</h1>
        <div className="h-9 w-9" />
      </header>

      <main className="flex-1 overflow-y-auto px-4 pb-6">
        {signedIn ? (
          <section className="pb-6">
            <MeAvatar
              className="size-16 border border-border"
              fallbackClassName="text-lg"
            />
            <p className="mt-4 text-2xl font-semibold">{ME.displayName}</p>
            <p className="mt-2 text-sm text-muted-foreground">@{ME.username}</p>
          </section>
        ) : (
          <SignedOutCard onSignIn={() => stub("sign in")} />
        )}

        <div className="h-px bg-border" />

        {signedIn && (
          <>
            <nav className="flex flex-col gap-1 py-4">
              <Row
                icon={PencilSimpleIcon}
                label="profile"
                sub="photo, bio and handles"
                onClick={() => stub("/settings/profile")}
              />
              <Row
                icon={GearIcon}
                label="settings"
                sub="privacy, notifications and password"
                onClick={() => stub("/settings")}
              />
            </nav>
            <div className="h-px bg-border" />
          </>
        )}

        <nav className="flex flex-col gap-1 py-4">
          {menuItems.map((item) => (
            <Row
              key={item.href}
              icon={item.icon}
              label={item.label}
              onClick={() => stub(item.href)}
            />
          ))}
        </nav>
      </main>

      <MockNav
        active="home"
        onTab={(tab) =>
          go({ screen: tab === "circles" && signedIn ? "friends" : "home" })
        }
      />
    </div>
  )
}

// ---- B: the drawer ---------------------------------------------------------

function MenuDrawerTake(props: ScreenProps) {
  const { state, go, stub } = props
  const signedIn = state.auth === "in"
  const close = () => go({ screen: "home" })
  // The legal pages move from rows to the quiet row at the foot.
  const rows = menuItems.filter((item) => !LEGAL_HREFS.has(item.href))

  return (
    <>
      <MockHome {...props} />
      <div className="absolute inset-0 z-50">
        <button
          type="button"
          aria-label="close menu"
          onClick={close}
          className="proto-fade absolute inset-0 bg-foreground/25"
        />
        <aside
          aria-label="menu"
          className="proto-drawer absolute inset-y-0 left-0 flex w-[82%] flex-col rounded-r-[32px] border-r border-border bg-background px-6 shadow-2xl"
        >
          <div className="pt-12">
            {signedIn ? (
              <button
                type="button"
                onClick={() => stub("/settings/profile")}
                className="-mx-2 flex w-[calc(100%+1rem)] items-center gap-3 rounded-2xl p-2 text-left transition-colors hover:bg-muted active:bg-muted"
              >
                <MeAvatar
                  className="size-14 border border-border"
                  fallbackClassName="text-base"
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-lg font-semibold">
                    {ME.displayName}
                  </span>
                  <span className="block truncate text-sm text-muted-foreground">
                    @{ME.username} · edit profile
                  </span>
                </span>
                <CaretRightIcon className="size-4 shrink-0 text-muted-foreground" />
              </button>
            ) : (
              <SignedOutCard onSignIn={() => stub("sign in")} />
            )}
          </div>

          {signedIn && (
            <nav className="mt-4 flex flex-col gap-1">
              <Row
                icon={GearIcon}
                label="settings"
                sub="privacy, notifications and password"
                onClick={() => stub("/settings")}
              />
            </nav>
          )}

          <div className={cn("h-px bg-border", signedIn ? "mt-4" : "")} />

          <nav className="flex flex-1 flex-col gap-1 overflow-y-auto py-4">
            {rows.map((item) => (
              <Row
                key={item.href}
                icon={item.icon}
                label={item.label}
                onClick={() => stub(item.href)}
              />
            ))}
          </nav>

          <LegalLinks className="-mx-2 justify-start pb-4" />
        </aside>
      </div>
    </>
  )
}
