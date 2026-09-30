import type { ReactNode } from "react"
import { MenuPageShell } from "@/components/menu-page-shell"
import { CONTACT_EMAIL, PROVIDER, PROVIDER_ADDRESS_LINE } from "@/lib/contact"

const termsQuickLinks = [
  { href: "#accounts", label: "Accounts" },
  { href: "#use", label: "Acceptable use" },
  { href: "#content", label: "Your content" },
  { href: "#reports", label: "Blocking and reports" },
  { href: "#liability", label: "Liability" },
  { href: "#contact", label: "Contact" },
] as const

function Section({
  id,
  title,
  children,
}: {
  id?: string
  title: string
  children: ReactNode
}) {
  return (
    <section id={id} className="flex scroll-mt-4 flex-col gap-3">
      <h3 className="text-xl font-semibold">{title}</h3>
      {children}
    </section>
  )
}

function Paragraph({ children }: { children: ReactNode }) {
  return <p className="text-sm leading-6 text-muted-foreground">{children}</p>
}

function BulletList({ items }: { items: string[] }) {
  return (
    <ul className="flex list-disc flex-col gap-2 pl-5 text-sm leading-6 text-muted-foreground">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  )
}

function TextLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a
      href={href}
      target={href.startsWith("http") ? "_blank" : undefined}
      rel={href.startsWith("http") ? "noreferrer" : undefined}
      className="font-medium text-foreground underline underline-offset-4"
    >
      {children}
    </a>
  )
}

export default function TermsPage() {
  const email = (
    <TextLink href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</TextLink>
  )

  return (
    <MenuPageShell title="Terms of service">
      <article className="flex flex-col gap-6 pt-4 pb-8">
        <section className="flex flex-col gap-3">
          <p className="text-sm font-medium text-accent">
            Last updated: 30 Sep 2026
          </p>
          <h2 className="text-3xl leading-tight font-bold">
            Terms for using Sponti.
          </h2>
          <p className="text-base leading-7 text-muted-foreground">
            These terms cover your use of Sponti, an app for lighting a flare
            when you&apos;re free, and seeing what your friends are up to. By
            creating an account or using the app, you agree to them. If you
            don&apos;t agree, please don&apos;t use Sponti.
          </p>
        </section>

        <nav
          aria-label="Terms sections"
          className="flex flex-wrap gap-2 rounded-xl border border-border bg-secondary p-3"
        >
          {termsQuickLinks.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="rounded-full border border-border bg-background px-3 py-2 text-xs font-medium transition-colors hover:bg-card"
            >
              {item.label}
            </a>
          ))}
        </nav>

        <div className="h-px bg-border" />

        <section className="flex flex-col gap-3">
          <h3 className="text-xl font-semibold">Service details</h3>
          <dl className="grid grid-cols-[96px_1fr] gap-x-3 gap-y-2 text-sm leading-6">
            <dt className="text-muted-foreground">App name</dt>
            <dd className="font-medium">Sponti</dd>
            <dt className="text-muted-foreground">Provider</dt>
            <dd className="font-medium">
              {PROVIDER.name}, {PROVIDER_ADDRESS_LINE}
            </dd>
            <dt className="text-muted-foreground">Contact</dt>
            <dd>{email}</dd>
            <dt className="text-muted-foreground">Status</dt>
            <dd className="font-medium">Free test build</dd>
          </dl>
        </section>

        <Section title="1. What Sponti is">
          <Paragraph>
            Sponti lets you light a flare, which is a post saying you&apos;re
            doing something now or soon, and invite friends to join. With it you
            can:
          </Paragraph>
          <BulletList
            items={[
              "Light and join flares, public or private, with a place and a time",
              "Connect with friends, for example with a QR code or an invite link",
              "Group friends into circles and choose who sees a flare",
              "Keep a profile with a photo and, if you like, a short bio and social handles",
              "Share your arrival time with a host",
              "Get notifications in the app",
            ]}
          />
        </Section>

        <Section title="2. A free test build">
          <Paragraph>
            Sponti is a free test build, offered to a small group of testers. It
            is provided as it is: it can break, features can change or
            disappear, and we may reset the data, which would wipe your account
            and flares. Please don&apos;t rely on it for anything important.
            Sponti is not an emergency service.
          </Paragraph>
        </Section>

        <Section id="accounts" title="3. Your account">
          <BulletList
            items={[
              "You must be at least 16 years old",
              "Give us correct information, and keep your password safe. You're responsible for what happens under your account",
              "One person, one account. Don't pretend to be someone else",
              "Tell us at the contact address if you think someone else is using your account",
            ]}
          />
          <Paragraph>
            You can ask us to delete your account at any time by emailing{" "}
            {email}. See the{" "}
            <TextLink href="/menu/privacy">privacy note</TextLink> for what
            happens to your data.
          </Paragraph>
        </Section>

        <Section id="use" title="4. Acceptable use">
          <Paragraph>When you use Sponti, you agree not to:</Paragraph>
          <BulletList
            items={[
              "Harass, threaten, stalk or bully anyone, or invite people to a flare to do so",
              "Post anything illegal, or content that is hateful, violent or sexually explicit",
              "Impersonate another person, or pretend to be someone you aren't",
              "Post other people's personal details or photos without their permission",
              "Send spam, or use Sponti to advertise or sell",
              "Try to break, overload or get around the security of the app, or collect other users' data in bulk",
              "Use Sponti for anything that breaks the law",
            ]}
          />
          <Paragraph>
            Sponti brings people together in real life. Meeting anyone is your
            own decision, and you&apos;re responsible for looking after yourself
            when you do. We don&apos;t check who users are, and we&apos;re not
            the organiser of the flares people light.
          </Paragraph>
        </Section>

        <Section id="content" title="5. Your content">
          <Paragraph>
            What you post stays yours: your profile, photos, flares and updates.
            You give us a simple, non-exclusive licence to store and show it,
            only as far as needed to run Sponti and show it to the people you
            choose. The licence ends when you delete the content or your
            account, apart from backups that roll off within about 30 days.
          </Paragraph>
          <Paragraph>
            You promise that you have the right to post what you post. We may
            remove content that breaks these terms.
          </Paragraph>
        </Section>

        <Section id="reports" title="6. Blocking and reports">
          <Paragraph>
            You can block a person from their profile. Blocking removes your
            connection, and they can no longer find your profile. To report a
            flare, a profile or a person, email {email} with what happened. We
            read safety reports first, and we may remove content or suspend
            accounts.
          </Paragraph>
        </Section>

        <Section title="7. Ending the service or an account">
          <Paragraph>
            You can stop using Sponti and delete your account whenever you like.
            We may suspend or delete an account that breaks these terms, and we
            may change, pause or end Sponti, for example when the test is over.
            If we end the service, we&apos;ll give notice where we can.
          </Paragraph>
        </Section>

        <Section id="liability" title="8. Liability">
          <Paragraph>
            Because Sponti is free, we are liable only for intent and gross
            negligence. This limit does not apply where the law says we
            can&apos;t limit liability, in particular for injury to life, body
            or health, and under the Produkthaftungsgesetz (German Product
            Liability Act). Nothing in these terms limits your mandatory rights
            as a consumer.
          </Paragraph>
        </Section>

        <Section title="9. Privacy">
          <Paragraph>
            How we handle your data is in the{" "}
            <TextLink href="/menu/privacy">privacy note</TextLink>.
          </Paragraph>
        </Section>

        <Section title="10. Governing law">
          <Paragraph>
            German law applies, without taking away the mandatory consumer
            protections of the country where you live.
          </Paragraph>
        </Section>

        <Section title="11. Changes to these terms">
          <Paragraph>
            We may update these terms, for example when Sponti changes. The date
            at the top shows the latest version. If you keep using Sponti after
            a change, you accept the new terms. If you don&apos;t agree, you can
            delete your account.
          </Paragraph>
        </Section>

        <Section id="contact" title="12. Contact">
          <Paragraph>
            Questions, reports or requests: {email}. Provider: {PROVIDER.name},{" "}
            {PROVIDER_ADDRESS_LINE}. See also the{" "}
            <TextLink href="/menu/impressum">Impressum</TextLink>.
          </Paragraph>
        </Section>
      </article>
    </MenuPageShell>
  )
}
