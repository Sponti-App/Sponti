import type { ReactNode } from "react"
import { MenuPageShell } from "@/components/menu-page-shell"
import { CONTACT_EMAIL, PROVIDER, PROVIDER_ADDRESS_LINE } from "@/lib/contact"

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
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

export default function PrivacyPage() {
  const email = (
    <TextLink href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</TextLink>
  )

  return (
    <MenuPageShell title="Privacy note">
      <article className="flex flex-col gap-6 pt-4 pb-8">
        <section className="flex flex-col gap-3">
          <p className="text-sm font-medium text-accent">
            Last updated: 30 Sep 2026
          </p>
          <h2 className="text-3xl leading-tight font-bold">
            Sponti is a test build.
          </h2>
          <p className="text-base leading-7 text-muted-foreground">
            You&apos;re using an early version with a small group of testers.
            Things can break, and test data can be reset. Here&apos;s who is
            responsible for your data, what we keep, who can see it, and how to
            get it deleted.
          </p>
        </section>

        <div className="h-px bg-border" />

        <Section title="Who is responsible">
          <Paragraph>
            {PROVIDER.name}, {PROVIDER_ADDRESS_LINE}, runs Sponti and is the
            controller of your data under the GDPR. You can reach us at {email}{" "}
            for anything about your data. See the{" "}
            <TextLink href="/menu/impressum">Impressum</TextLink> for the legal
            notice.
          </Paragraph>
        </Section>

        <Section title="What we collect">
          <BulletList
            items={[
              "Your email, name and @username, and a password (stored scrambled, never as plain text)",
              "Your profile photo, if you add one. If you sign in with Google, we get your name, email and photo from Google",
              "Your connections and circles",
              "The flares you light: what, where and when, and your replies (RSVPs)",
              "Arrival times (ETAs) you choose to share with a host",
              "A bio, Instagram and Telegram handle, if you add them",
              "Your device location, only if you allow it in your browser or phone. It is used to place a flare at your current location and to work out a route and arrival time to a flare. For routes it is sent to our server, which asks Google for the route",
              "What you write in an email to us, plus the build and device details we fill in for you",
              "Technical logs on our servers and hosting, like your IP address, the time and the address requested",
            ]}
          />
          <Paragraph>
            We keep your sign-in session in your browser&apos;s storage so you
            stay signed in. That is needed for the app to work. We don&apos;t
            use analytics or advertising tools, and we don&apos;t track you
            across other sites or apps. We don&apos;t sell your data.
          </Paragraph>
          <Paragraph>
            You don&apos;t have to give us any of this by law. But without an
            email, name and @username we can&apos;t give you an account.
          </Paragraph>
        </Section>

        <Section title="Why we use it">
          <BulletList
            items={[
              "To run Sponti for you: your account, profile, connections, circles, flares, RSVPs, in-app notifications, password resets and replies to your emails. Legal basis: Art. 6(1)(b) GDPR, performing the service you signed up for",
              "To keep the service secure, find and fix errors, and deal with abuse and reports. Legal basis: Art. 6(1)(f) GDPR, our legitimate interest in a safe, working service",
              "To use your device location, when you allow it. Legal basis: Art. 6(1)(a) GDPR, your consent, which you can withdraw any time by turning location off in your browser or phone",
            ]}
          />
          <Paragraph>
            We don&apos;t make automated decisions about you or build
            advertising profiles.
          </Paragraph>
        </Section>

        <Section title="Who can see what">
          <BulletList
            items={[
              "Flares: the people and circles you invite. A public flare can be seen by anyone using Sponti",
              "Flares at your current location show guests a neighbourhood, not a street address",
              "Your profile: anyone signed in can see your name, @username and photo. Connections can see more, like your bio and handles",
              "A private profile is hidden from search. It can still be found by typing your exact @username, and then others see just your name, @username and photo",
              "If you block someone, they can no longer find your profile",
            ]}
          />
        </Section>

        <Section title="Who else handles your data">
          <Paragraph>
            We use these services to run Sponti. They process data on our behalf
            under data processing agreements:
          </Paragraph>
          <BulletList
            items={[
              "netcup: our servers, in Nuremberg, Germany",
              "MongoDB Atlas: our database, in Frankfurt, Germany (eu-central-1)",
              "Vercel: hosts the web app",
              "Google: sign-in, and maps, places and routes. Your browser talks to Google directly to load the map, so Google sees your IP address",
              "Cloudinary: stores profile photos",
              "Resend: sends emails like password resets",
            ]}
          />
          <Paragraph>
            Vercel, MongoDB, Google, Cloudinary and Resend are US companies, or
            may process data in the US. When data goes there, we rely on the
            EU-US Data Privacy Framework where the provider is certified, and on
            the EU standard contractual clauses. We don&apos;t share your data
            with anyone else, unless the law requires it.
          </Paragraph>
        </Section>

        <Section title="How long we keep it">
          <Paragraph>
            We keep your data while your account exists. Technical logs are kept
            only as long as we need them to fix errors and keep things secure.
            During the test we may reset the database, which wipes test data.
          </Paragraph>
        </Section>

        <Section title="Delete your data">
          <Paragraph>
            Email {email} from the address on your account and ask us to delete
            it. We&apos;ll delete your account and its data within 30 days.
            Backups roll off within about 30 days after that. The same address
            is for any other privacy question.
          </Paragraph>
        </Section>

        <Section title="Your rights">
          <Paragraph>Under the GDPR you have the right to:</Paragraph>
          <BulletList
            items={[
              "Get a copy of your data and information about how we use it (Art. 15)",
              "Have wrong data corrected (Art. 16)",
              "Have your data deleted (Art. 17)",
              "Have its use restricted (Art. 18)",
              "Get your data in a portable format (Art. 20)",
              "Object to uses based on our legitimate interest (Art. 21)",
              "Withdraw a consent you gave, at any time (Art. 7(3))",
            ]}
          />
          <Paragraph>
            To use any of these, email {email}. You can also complain to a data
            protection authority. Ours is the Berliner Beauftragte für
            Datenschutz und Informationsfreiheit, Alt-Moabit 59-61, 10555 Berlin
            (
            <TextLink href="https://www.datenschutz-berlin.de">
              datenschutz-berlin.de
            </TextLink>
            ). You can also go to the authority where you live.
          </Paragraph>
        </Section>

        <Section title="Who can use Sponti">
          <Paragraph>
            You need to be at least 16. If we learn that someone younger has
            signed up, we&apos;ll delete the account.
          </Paragraph>
        </Section>

        <Section title="Changes to this note">
          <Paragraph>
            If we change how we use your data, we&apos;ll update this note and
            its date.
          </Paragraph>
        </Section>
      </article>
    </MenuPageShell>
  )
}
