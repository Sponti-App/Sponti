import type { ReactNode } from "react"
import { MenuPageShell } from "@/components/menu-page-shell"
import { CONTACT_EMAIL, PROVIDER } from "@/lib/contact"

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h3 className="text-xl font-semibold">{title}</h3>
      {children}
    </section>
  )
}

function TextLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a
      href={href}
      className="font-medium text-foreground underline underline-offset-4"
    >
      {children}
    </a>
  )
}

// Legal notice required for telemedia in Germany (§ 5 DDG, § 18 (2) MStV).
// Sentence case, like the other legal pages (#293).
export default function ImpressumPage() {
  return (
    <MenuPageShell title="Impressum">
      <article className="flex flex-col gap-6 pt-4 pb-8">
        <section className="flex flex-col gap-3">
          <p className="text-sm font-medium text-accent">
            Last updated: 30 Sep 2026
          </p>
          <h2 className="text-3xl leading-tight font-bold">Legal notice</h2>
          <p className="text-base leading-7 text-muted-foreground">
            Information about who provides Sponti, as required by German law.
          </p>
        </section>

        <div className="h-px bg-border" />

        <Section title="Provider (§ 5 DDG)">
          <address className="text-sm leading-6 text-muted-foreground not-italic">
            {PROVIDER.name}
            <br />
            {PROVIDER.street}
            <br />
            {PROVIDER.postalCode} {PROVIDER.city}
            <br />
            {PROVIDER.country}
          </address>
        </Section>

        <Section title="Contact">
          <p className="text-sm leading-6 text-muted-foreground">
            Email:{" "}
            <TextLink href={`mailto:${CONTACT_EMAIL}`}>
              {CONTACT_EMAIL}
            </TextLink>
          </p>
        </Section>

        <Section title="Responsible for content (§ 18 (2) MStV)">
          <p className="text-sm leading-6 text-muted-foreground">
            {PROVIDER.name}, {PROVIDER.street}, {PROVIDER.postalCode}{" "}
            {PROVIDER.city}, {PROVIDER.country}.
          </p>
        </Section>
      </article>
    </MenuPageShell>
  )
}
