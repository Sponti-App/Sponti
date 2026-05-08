"use client"

import { useMemo } from "react"
import { Share2, X } from "lucide-react"
import { Button } from "@/components/ui/button"

// Deterministic QR-shaped pattern keyed on the handle. Real codes will come
// from qr_contact_tokens once the backend issues them — this is the placeholder.
function buildCells(value: string): boolean[][] {
  const SIZE = 21
  let seed = 0
  for (let i = 0; i < value.length; i++) seed = (seed * 31 + value.charCodeAt(i)) >>> 0

  const next = (): number => {
    seed = (seed * 1103515245 + 12345) >>> 0
    return (seed >>> 16) & 1
  }

  const grid: boolean[][] = []
  for (let r = 0; r < SIZE; r++) {
    const row: boolean[] = []
    for (let c = 0; c < SIZE; c++) {
      const inFinder =
        (r < 7 && c < 7) ||
        (r < 7 && c >= SIZE - 7) ||
        (r >= SIZE - 7 && c < 7)
      if (inFinder) {
        const lr = r < 7 ? r : r - (SIZE - 7)
        const lc = c < 7 ? c : c - (SIZE - 7)
        const outer = lr === 0 || lr === 6 || lc === 0 || lc === 6
        const inner = lr >= 2 && lr <= 4 && lc >= 2 && lc <= 4
        row.push(outer || inner)
      } else {
        row.push(next() === 1)
      }
    }
    grid.push(row)
  }
  return grid
}

export function QrShareSheet({
  displayName,
  handle,
  onClose,
}: {
  displayName: string
  handle: string
  onClose: () => void
}) {
  const cells = useMemo(() => buildCells(`sponti:${handle}`), [handle])

  return (
    <div className="absolute inset-0 z-30 flex flex-col">
      <button
        type="button"
        aria-label="Close QR"
        onClick={onClose}
        className="absolute inset-0 bg-foreground/30"
      />
      <div className="relative mt-auto bg-card rounded-t-3xl border-t border-border shadow-2xl flex flex-col">
        <div className="flex items-center justify-between px-4 pt-4 pb-2">
          <span className="text-[11px] tracking-wide uppercase text-muted-foreground">
            your qr
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="h-8 w-8 rounded-full flex items-center justify-center hover:bg-secondary"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-6 pt-2 pb-6 flex flex-col items-center gap-4">
          <div className="text-xl font-semibold">{displayName}</div>
          <div className="text-sm font-medium text-accent">@{handle}</div>

          <div className="bg-background p-4 rounded-2xl border border-border">
            <svg
              viewBox="0 0 21 21"
              className="w-44 h-44 text-foreground"
              aria-hidden="true"
            >
              {cells.flatMap((row, r) =>
                row.map((on, c) =>
                  on ? (
                    <rect
                      key={`${r}-${c}`}
                      x={c}
                      y={r}
                      width="1"
                      height="1"
                      fill="currentColor"
                    />
                  ) : null,
                ),
              )}
            </svg>
          </div>

          <p className="text-xs text-muted-foreground text-center max-w-[260px]">
            scan to add me on sponti — or tap share to send your handle.
          </p>

          <Button className="rounded-full bg-accent text-accent-foreground hover:bg-accent/90 px-6">
            <Share2 className="h-4 w-4 mr-2" />
            share handle
          </Button>
        </div>
      </div>
    </div>
  )
}
