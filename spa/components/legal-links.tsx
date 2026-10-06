import Link from "next/link"
import { cn } from "@/lib/utils"

// #457: the Impressum, privacy note and terms, as one quiet row. German law
// wants the Impressum directly reachable from every page, so this sits where
// a signed-out visitor is: the signed-out map's dock, the sign-up sheet and
// the sign-in page. (Registration has its own "by signing up you agree"
// sentence with the same three links.) The pages are public paths in
// auth-gate (LEGAL_PATHS, lib/legal-paths).
const LEGAL_LINKS = [
  { href: "/menu/impressum", label: "impressum" },
  { href: "/menu/privacy", label: "privacy" },
  { href: "/menu/terms", label: "terms" },
] as const

export function LegalLinks({ className }: { className?: string }) {
  return (
    <nav
      aria-label="legal"
      data-legal-links
      className={cn(
        "flex items-center justify-center text-xs text-muted-foreground",
        className
      )}
    >
      {LEGAL_LINKS.map(({ href, label }, i) => (
        <span key={href} className="flex items-center">
          {i > 0 && (
            <span aria-hidden="true" className="px-0.5">
              ·
            </span>
          )}
          {/* A tap target taller than the text, without a taller row. */}
          <Link
            href={href}
            className="px-2 py-2.5 underline-offset-2 hover:text-foreground hover:underline"
          >
            {label}
          </Link>
        </span>
      ))}
    </nav>
  )
}
