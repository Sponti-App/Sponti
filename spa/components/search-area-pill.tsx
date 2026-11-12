import { MagnifyingGlassIcon } from "@/components/icons"
import { haptic } from "@/lib/haptics"

/** The "search this area" pill (#642), in the stack under the header chips. */
export function SearchAreaPill({ onSearch }: { onSearch: () => void }) {
  return (
    <button
      type="button"
      data-search-area
      onClick={() => {
        haptic("selection")
        onSearch()
      }}
      className="pointer-events-auto flex min-h-9 items-center gap-1.5 self-center rounded-full border border-border/60 bg-background/95 px-3.5 text-sm font-medium text-foreground shadow-md backdrop-blur-md"
    >
      <MagnifyingGlassIcon className="size-4" />
      search this area
    </button>
  )
}
