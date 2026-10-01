"use client"

import { useSyncExternalStore } from "react"
import Link from "next/link"
import {
  AlertTriangle,
  Bug,
  ChevronRight,
  Clock3,
  FileText,
  Flag,
  HelpCircle,
  Mail,
  MessageSquare,
  Scale,
  ShieldAlert,
  UserCircle,
} from "lucide-react"
import { MenuPageShell } from "@/components/menu-page-shell"
import { Card } from "@/components/ui/card"
import { CONTACT_EMAIL } from "@/lib/contact"
import { describeDevice, supportMailto } from "@/lib/support-mail"

const supportPaths = [
  {
    title: "safety or harmful content",
    description:
      "report unsafe flares, harassment, impersonation, harmful images, or anything that could put people at risk.",
    subject: "safety or content report",
    detail: "read first",
    icon: ShieldAlert,
  },
  {
    title: "bug or broken feature",
    description:
      "tell us which screen broke, what you expected, and what happened instead.",
    subject: "bug report",
    detail: "mention the screen",
    icon: Bug,
  },
  {
    title: "account help",
    description:
      "help with login, your profile, deleting your account, or suspicious activity on it.",
    subject: "account help",
    detail: "we reply by email",
    icon: UserCircle,
  },
  {
    title: "flare or rsvp problem",
    description:
      "joining, leaving, host updates, location details, or who can see a flare.",
    subject: "flare or rsvp problem",
    detail: "mention the flare",
    icon: Flag,
  },
  {
    title: "feedback",
    description:
      "confusing flows, missing info, or ideas that would make meeting up easier.",
    subject: "feedback",
    detail: "short is fine",
    icon: MessageSquare,
  },
] as const

const reportChecklist = [
  "the flare, screen, or action where it happened",
  "what happened and what you expected instead",
  "a screenshot or screen recording, if it's safe to share",
]

const relatedLinks = [
  {
    href: "/menu/faq-feedback",
    label: "faq & feedback",
    description: "common questions and product notes",
    icon: HelpCircle,
  },
  {
    href: "/menu/terms",
    label: "terms of service",
    description: "rules for accounts, flares, and content",
    icon: FileText,
  },
  {
    href: "/menu/privacy",
    label: "privacy note",
    description: "what we keep and who can see it",
    icon: ShieldAlert,
  },
  {
    href: "/menu/impressum",
    label: "impressum",
    description: "who runs sponti",
    icon: Scale,
  },
] as const

const subscribeNever = () => () => {}

export default function SupportPage() {
  // Read from the browser after hydration (the server snapshot is empty), so
  // the mail body carries this device's details without a hydration mismatch.
  const device = useSyncExternalStore(subscribeNever, describeDevice, () => "")
  const mailtoHref = (subject: string) => supportMailto(subject, device)

  return (
    <MenuPageShell title="support">
      <article className="flex flex-col gap-6 pt-4 pb-8">
        <section className="flex flex-col gap-3">
          <p className="text-sm font-medium text-accent">sponti support</p>
          <h2 className="text-3xl leading-tight font-bold">
            get help, report a problem, or send feedback.
          </h2>
          <p className="text-base leading-7 text-muted-foreground">
            sponti is a test build. every option below opens an email to one
            inbox, with your build and device details filled in. safety reports
            get read first.
          </p>
        </section>

        <Card className="border border-border bg-card p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle
              className="mt-0.5 size-5 shrink-0 text-accent"
              aria-hidden="true"
            />
            <div className="flex flex-col gap-2">
              <h3 className="font-semibold">immediate danger</h3>
              <p className="text-sm leading-6 text-muted-foreground">
                if someone is at immediate risk, contact local emergency
                services first. sponti support is not an emergency service.
              </p>
            </div>
          </div>
        </Card>

        <div className="h-px bg-border" />

        <section className="flex flex-col gap-3">
          <h3 className="text-xl font-semibold">what do you need help with?</h3>
          <div className="flex flex-col gap-2">
            {supportPaths.map((item) => {
              const Icon = item.icon

              return (
                <a
                  key={item.title}
                  href={mailtoHref(item.subject)}
                  className="block rounded-xl focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                >
                  <Card className="border border-border bg-card p-4 transition-colors hover:bg-secondary">
                    <div className="flex items-start gap-3">
                      <Icon
                        className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                        aria-hidden="true"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-3">
                          <h4 className="text-sm font-medium">{item.title}</h4>
                          <ChevronRight
                            className="size-4 shrink-0 text-muted-foreground"
                            aria-hidden="true"
                          />
                        </div>
                        <p className="mt-1 text-sm leading-6 text-muted-foreground">
                          {item.description}
                        </p>
                        <p className="mt-3 text-xs font-medium tracking-wide text-accent uppercase">
                          {item.detail}
                        </p>
                      </div>
                    </div>
                  </Card>
                </a>
              )
            })}
          </div>
        </section>

        <section className="flex flex-col gap-3">
          <h3 className="text-xl font-semibold">help us understand it faster</h3>
          <p className="text-sm leading-6 text-muted-foreground">
            the more specific you are, the faster we can work out what happened.
            your build and device details are added to the email for you.
          </p>
          <ul className="flex flex-col gap-2 text-sm leading-6 text-muted-foreground">
            {reportChecklist.map((item) => (
              <li key={item} className="flex gap-2">
                <span className="mt-2 size-1.5 shrink-0 rounded-full bg-accent" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="flex flex-col gap-3">
          <h3 className="text-xl font-semibold">what happens next?</h3>
          <div className="flex flex-col gap-3 text-sm leading-6 text-muted-foreground">
            <div className="flex gap-3">
              <Clock3
                className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                aria-hidden="true"
              />
              <p>
                safety and content reports are read before general feedback.
              </p>
            </div>
            <div className="flex gap-3">
              <Mail
                className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                aria-hidden="true"
              />
              <p>
                we may reply by email if we need more details or can confirm a
                fix or an account action.
              </p>
            </div>
          </div>
        </section>

        <div className="h-px bg-border" />

        <section className="flex flex-col gap-3">
          <h3 className="text-xl font-semibold">contact</h3>
          <p className="text-sm leading-6 text-muted-foreground">
            support, feedback, privacy requests and safety reports all go to{" "}
            <a
              href={mailtoHref("sponti support request")}
              className="font-medium text-foreground underline underline-offset-4"
            >
              {CONTACT_EMAIL}
            </a>
            .
          </p>
        </section>

        <section className="flex flex-col gap-3">
          <h3 className="text-xl font-semibold">related pages</h3>
          <div className="flex flex-col gap-2">
            {relatedLinks.map((item) => {
              const Icon = item.icon

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 transition-colors hover:bg-secondary"
                >
                  <Icon
                    className="size-4 shrink-0 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{item.label}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.description}
                    </p>
                  </div>
                  <ChevronRight
                    className="size-4 shrink-0 text-muted-foreground"
                    aria-hidden="true"
                  />
                </Link>
              )
            })}
          </div>
        </section>
      </article>
    </MenuPageShell>
  )
}
