import type { ReactNode } from "react"
import { MenuPageShell } from "@/components/menu-page-shell"
import { CONTACT_EMAIL } from "@/lib/contact"


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
    <MenuPageShell title="privacy note">
      <article className="flex flex-col gap-6 pt-4 pb-8">
        <section className="flex flex-col gap-3">
          <p className="text-sm font-medium text-accent">
            updated 30 sep 2026
          </p>
          <h2 className="text-3xl leading-tight font-bold">
            sponti is a test build.
          </h2>
          <p className="text-base leading-7 text-muted-foreground">
            you&apos;re using an early version with a small group of testers.
            things can break, and test data can be reset. here&apos;s what we
            keep, who can see it, and how to get it deleted.
          </p>
        </section>

        <div className="h-px bg-border" />

        <Section title="what we collect">
          <BulletList
            items={[
              "your email, name and @username, and a password (stored scrambled, never as plain text)",
              "your profile photo, if you add one. sign in with google and we get your name, email and photo from google",
              "your connections and circles",
              "the flares you light: what, where and when",
              "arrival times (etas) you choose to share with a host",
              "a bio, instagram and telegram handle, if you add them",
              "what you write in an email to us, plus the build and device details we fill in for you",
            ]}
          />
          <Paragraph>we don&apos;t sell your data.</Paragraph>
        </Section>

        <Section title="who can see what">
          <BulletList
            items={[
              "flares: the people and circles you invite. a public flare can be seen by anyone using sponti",
              "flares at your current location show guests a neighbourhood, not a street address",
              "your profile: anyone signed in can see your name, @username and photo. connections can see more, like your bio and handles",
              "a private profile is hidden from search, so strangers only find you by typing your exact @username, and they see just your name, @username and photo",
            ]}
          />
        </Section>

        <Section title="where it's stored">
          <BulletList
            items={[
              "our servers, hosted by netcup in the eu",
              "our database, on mongodb atlas",
              "the web app, on vercel",
              "google, for sign-in, maps, places and routes",
              "cloudinary, for profile photos",
              "resend, to send emails like password resets",
            ]}
          />
        </Section>

        <Section title="how long we keep it">
          <Paragraph>
            we keep your data while your account exists. during the test we may
            reset the database, which wipes test data.
          </Paragraph>
        </Section>

        <Section title="delete your data">
          <Paragraph>
            email{" "}
            <TextLink href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</TextLink>{" "}
            from the address on your account and ask us to delete it. we&apos;ll
            delete your account and its data. the same address is for any other
            privacy question.
          </Paragraph>
        </Section>
      </article>
    </MenuPageShell>
  )
}
