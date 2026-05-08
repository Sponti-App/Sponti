import type { ReactNode } from "react"
import { MenuPageShell } from "@/components/menu-page-shell"

const supportEmail = "sponti.support@example.com"
const privacyEmail = "sponti.privacy@example.com"
const reportsEmail = "sponti.reports@example.com"

function Section({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  return (
    <section className="flex flex-col gap-3">
      <h3 className="text-xl font-semibold">{title}</h3>
      {children}
    </section>
  )
}

function Paragraph({ children }: { children: ReactNode }) {
  return (
    <p className="text-sm leading-6 text-muted-foreground">{children}</p>
  )
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

function TextLink({
  href,
  children,
}: {
  href: string
  children: ReactNode
}) {
  return (
    <a
      href={href}
      className="font-medium text-foreground underline underline-offset-4"
    >
      {children}
    </a>
  )
}

export default function PrivacyPage() {
  return (
    <MenuPageShell title="Privacy Policy">
      <article className="flex flex-col gap-6 pt-4 pb-8">
        <section className="flex flex-col gap-3">
          <p className="text-sm font-medium text-accent">
            Last updated: 7 May 2026
          </p>
          <h2 className="text-3xl leading-tight font-bold">
            Privacy for a trust-first social app.
          </h2>
          <p className="text-base leading-7 text-muted-foreground">
            This Privacy Policy explains what personal data Sponti expects to
            handle, why it is needed, and how users can contact the team about
            privacy requests.
          </p>
          <p className="text-sm leading-6 text-muted-foreground">
            Sponti is currently an educational prototype. Some account, support,
            and deletion flows may be simulated until production systems are
            connected.
          </p>
        </section>

        <div className="h-px bg-border" />

        <Section title="What Sponti may collect">
          <Paragraph>
            Sponti should only collect information that helps the app create,
            show, join, and manage meetups.
          </Paragraph>
          <BulletList
            items={[
              "account details such as name, email, password credentials, profile text, and profile image",
              "event details such as title, time, location, visibility, host, attendees, and RSVP status",
              "trust and visibility settings such as friend lists or selected audience",
              "support and feedback messages sent by users",
              "technical data such as device, browser, diagnostics, and basic usage events",
            ]}
          />
        </Section>

        <Section title="Why it is used">
          <Paragraph>Personal data is used to operate the core app experience.</Paragraph>
          <BulletList
            items={[
              "create and secure user accounts",
              "show events to the intended audience",
              "let users join, leave, edit, or cancel meetups",
              "support safety reports, moderation, and account requests",
              "debug errors and improve confusing product flows",
            ]}
          />
        </Section>

        <Section title="Location and visibility">
          <Paragraph>
            Event locations can be sensitive because Sponti is about meeting in
            real life. The product should make visibility clear before an event
            is published, especially when a precise location is included.
          </Paragraph>
          <Paragraph>
            If precise device location is used later, Sponti should ask for
            permission first and continue working when location access is
            disabled.
          </Paragraph>
        </Section>

        <Section title="What Sponti does not want">
          <BulletList
            items={[
              "no contact scraping for the MVP",
              "no selling personal data",
              "no infinite-scroll engagement profiling as a product goal",
              "no public exposure of private event details beyond the selected audience",
            ]}
          />
        </Section>

        <Section title="Sharing and service providers">
          <Paragraph>
            Sponti may use service providers for hosting, databases,
            authentication, maps, email, analytics, and diagnostics. These
            providers should only receive the data needed to provide their
            service.
          </Paragraph>
          <Paragraph>
            Event hosts and attendees may see event information, profile
            context, RSVP status, and other details needed for the meetup.
          </Paragraph>
        </Section>

        <Section title="Retention and deletion">
          <Paragraph>
            Prototype data may be reset, changed, or deleted during development.
            In a production version, Sponti should keep personal data only as
            long as needed for account, event, safety, legal, backup, or
            operational reasons.
          </Paragraph>
          <Paragraph>
            To request account deletion or privacy help, contact{" "}
            <TextLink href={`mailto:${privacyEmail}`}>{privacyEmail}</TextLink>.
          </Paragraph>
        </Section>

        <Section title="User rights">
          <Paragraph>
            Depending on where a user lives, they may have rights to access,
            correct, delete, restrict, or object to processing of personal data.
          </Paragraph>
          <Paragraph>
            Privacy requests can be sent to{" "}
            <TextLink href={`mailto:${privacyEmail}`}>{privacyEmail}</TextLink>.
            General support questions can be sent to{" "}
            <TextLink href={`mailto:${supportEmail}`}>{supportEmail}</TextLink>.
            Safety and content reports can be sent to{" "}
            <TextLink href={`mailto:${reportsEmail}`}>{reportsEmail}</TextLink>.
          </Paragraph>
        </Section>
      </article>
    </MenuPageShell>
  )
}
