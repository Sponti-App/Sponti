"use client"

// #641: "add sponti to your home screen". One reusable sheet: on iPhone Safari
// an illustrated hint (there is no prompt API), on Android Chrome an install
// button. It renders nothing where there is nothing to offer, so any caller
// (the after-first-flare offer, notification settings, #640's push ask) can
// mount it without checking the platform. Callers that need to know first
// read `useHomeScreen().mode` from lib/home-screen.

import { Drawer } from "vaul"
import { ExportIcon, PlusSquareIcon } from "@/components/icons"
import { Button } from "@/components/ui/button"
import { haptic } from "@/lib/haptics"
import { useHomeScreen } from "@/lib/home-screen"

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex items-center gap-3">
      <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">
        {n}
      </span>
      {children}
    </li>
  )
}

export function HomeScreenSheet({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const { mode, install } = useHomeScreen()
  if (mode === "none") return null

  return (
    <Drawer.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          haptic("light")
          onClose()
        }
      }}
    >
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-50 bg-foreground/30" />
        <Drawer.Content
          aria-label="add sponti to your home screen"
          data-sheet="home screen"
          className="fixed inset-x-0 bottom-0 z-50 flex flex-col rounded-t-3xl bg-background px-5 pt-3 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-(--shadow-sheet) outline-none"
        >
          <div className="mx-auto mb-3 h-1 w-10 shrink-0 rounded-full bg-border" />
          <Drawer.Title className="text-base font-semibold">
            add sponti to your home screen
          </Drawer.Title>
          <Drawer.Description className="mt-1 text-sm text-muted-foreground">
            open it like an app, one tap away.
          </Drawer.Description>

          {mode === "ios" && (
            <>
              <ol className="mt-4 space-y-3 text-sm">
                <Step n={1}>
                  <span className="flex items-center gap-2">
                    tap share
                    <span className="flex size-9 items-center justify-center rounded-xl bg-card text-primary shadow-sm">
                      <ExportIcon className="size-5" />
                    </span>
                  </span>
                </Step>
                <Step n={2}>
                  <span className="flex flex-1 items-center justify-between rounded-xl bg-card px-3 py-2 shadow-sm">
                    <span className="font-medium">add to home screen</span>
                    <PlusSquareIcon className="size-5 text-primary" />
                  </span>
                </Step>
                <Step n={3}>tap add</Step>
              </ol>
              <p className="mt-4 text-xs text-muted-foreground">
                you&apos;ll sign in once more in the app.
              </p>
            </>
          )}

          {mode === "prompt" && (
            <Button
              type="button"
              onClick={() => {
                haptic("medium")
                void install().then(onClose)
              }}
              className="mt-5 h-12 w-full rounded-full bg-accent text-sm text-accent-foreground hover:bg-accent/90"
            >
              add to home screen
            </Button>
          )}

          <button
            type="button"
            onClick={onClose}
            className="mt-2 flex min-h-11 w-full items-center justify-center text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            {mode === "ios" ? "got it" : "not now"}
          </button>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  )
}
