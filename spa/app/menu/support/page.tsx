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
  ShieldAlert,
  UserCircle,
} from "lucide-react"
import { MenuPageShell } from "@/components/menu-page-shell"
import { Card } from "@/components/ui/card"

const supportEmail = "sponti.support@example.com"
const reportsEmail = "sponti.reports@example.com"

const supportPaths = [
  {
    title: "Safety or harmful content",
    description:
      "Report unsafe events, harassment, impersonation, harmful images, or anything that could put people at risk.",
    email: reportsEmail,
    subject: "Safety or content report",
    detail: "Prioritized review",
    icon: ShieldAlert,
  },
  {
    title: "Bug or broken feature",
    description:
      "Tell us which screen broke, what you expected, and what happened instead.",
    email: supportEmail,
    subject: "Bug report",
    detail: "App support",
    icon: Bug,
  },
  {
    title: "Account help",
    description:
      "Get help with login, profile details, account deletion, or suspicious account activity.",
    email: supportEmail,
    subject: "Account help",
    detail: "Account support",
    icon: UserCircle,
  },
  {
    title: "Event or RSVP problem",
    description:
      "Ask about joining, leaving, host updates, location details, or event visibility.",
    email: supportEmail,
    subject: "Event or RSVP problem",
    detail: "Event support",
    icon: Flag,
  },
  {
    title: "Product feedback",
    description:
      "Share confusing flows, missing information, or ideas that would make real-world planning easier.",
    email: supportEmail,
    subject: "Product feedback",
    detail: "Product review",
    icon: MessageSquare,
  },
] as const

const reportChecklist = [
  "Your account email, if the issue is account-related",
  "The event name, screen, or action where the issue happened",
  "What happened and what you expected instead",
  "Your device, browser, and app version if you know them",
  "A screenshot or screen recording if it is safe to share",
]

const relatedLinks = [
  {
    href: "/menu/faq-feedback",
    label: "FAQ & Feedback",
    description: "Common questions and product notes",
    icon: HelpCircle,
  },
  {
    href: "/menu/terms",
    label: "Terms of Service",
    description: "Rules for accounts, events, and content",
    icon: FileText,
  },
  {
    href: "/menu/privacy",
    label: "Privacy Policy",
    description: "Personal data and visibility basics",
    icon: ShieldAlert,
  },
] as const

function mailtoHref(email: string, subject: string) {
  return `mailto:${email}?subject=${encodeURIComponent(subject)}`
}

export default function SupportPage() {
  return (
    <MenuPageShell title="Support">
      <article className="flex flex-col gap-6 pt-4 pb-8">
        <section className="flex flex-col gap-3">
          <p className="text-sm font-medium text-accent">Sponti support</p>
          <h2 className="text-3xl leading-tight font-bold">
            Get help with your account, events, and safety reports.
          </h2>
          <p className="text-base leading-7 text-muted-foreground">
            Choose the closest support path so the right context reaches the
            team. Safety and harmful-content reports are reviewed first.
          </p>
        </section>

        <Card className="border border-border bg-card p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle
              className="mt-0.5 size-5 shrink-0 text-accent"
              aria-hidden="true"
            />
            <div className="flex flex-col gap-2">
              <h3 className="font-semibold">Immediate danger</h3>
              <p className="text-sm leading-6 text-muted-foreground">
                If someone is at immediate risk, contact local emergency
                services first. Sponti support is not an emergency service.
              </p>
            </div>
          </div>
        </Card>

        <div className="h-px bg-border" />

        <section className="flex flex-col gap-3">
          <h3 className="text-xl font-semibold">What do you need help with?</h3>
          <div className="flex flex-col gap-2">
            {supportPaths.map((item) => {
              const Icon = item.icon

              return (
                <a
                  key={item.title}
                  href={mailtoHref(item.email, item.subject)}
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
          <h3 className="text-xl font-semibold">Help us understand it faster</h3>
          <p className="text-sm leading-6 text-muted-foreground">
            The more specific the report is, the faster support can understand
            what happened and decide the next step.
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
          <h3 className="text-xl font-semibold">What happens next?</h3>
          <div className="flex flex-col gap-3 text-sm leading-6 text-muted-foreground">
            <div className="flex gap-3">
              <Clock3
                className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                aria-hidden="true"
              />
              <p>
                Safety and content reports are prioritized before general
                product feedback.
              </p>
            </div>
            <div className="flex gap-3">
              <Mail
                className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                aria-hidden="true"
              />
              <p>
                We may reply by email if we need more details or can confirm a
                fix, account action, or moderation decision.
              </p>
            </div>
          </div>
        </section>

        <div className="h-px bg-border" />

        <section className="flex flex-col gap-3">
          <h3 className="text-xl font-semibold">Support contacts</h3>
          <div className="flex flex-col gap-2 text-sm leading-6">
            <p className="text-muted-foreground">
              General support:{" "}
              <a
                href={mailtoHref(supportEmail, "Sponti support request")}
                className="font-medium text-foreground underline underline-offset-4"
              >
                {supportEmail}
              </a>
            </p>
            <p className="text-muted-foreground">
              Safety and content reports:{" "}
              <a
                href={mailtoHref(reportsEmail, "Safety or content report")}
                className="font-medium text-foreground underline underline-offset-4"
              >
                {reportsEmail}
              </a>
            </p>
          </div>
        </section>

        <section className="flex flex-col gap-3">
          <h3 className="text-xl font-semibold">Related pages</h3>
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
