import { Globe, Lock } from "lucide-react"

// Your own profile only (#289): who can find you in search. Visibility is
// never part of anyone else's profile response.
export function VisibilityPill({
  visibility,
}: {
  visibility: "public" | "private"
}) {
  const Icon = visibility === "private" ? Lock : Globe
  return (
    <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
      <Icon className="h-3 w-3" aria-hidden />
      {visibility === "private"
        ? "private · not in search"
        : "public · in search"}
    </span>
  )
}
