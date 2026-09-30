import Link from "next/link"
import {
  ChevronDown,
  ChevronRight,
  LockKeyhole,
  MapPin,
  Sparkles,
  UserCircle,
} from "lucide-react"
import { MenuPageShell } from "@/components/menu-page-shell"
import { Card } from "@/components/ui/card"

// #294: this page used to carry a fake "submit feedback" form. Feedback now
// goes through /menu/support, the real mail flow.

const faqGroups = [
  {
    title: "getting started",
    icon: Sparkles,
    questions: [
      {
        question: "what is sponti for?",
        answer:
          "sponti helps you turn a free moment into a plan. light a flare for something happening now or soon, choose who sees it, and let friends join without a long group-chat negotiation.",
      },
      {
        question: "is sponti finished?",
        answer:
          "not yet. sponti is a test build shared with a small group of testers. things can break and test data can be reset. if something goes wrong, tell us through support.",
      },
    ],
  },
  {
    title: "flares and rsvps",
    icon: MapPin,
    questions: [
      {
        question: "who can see a flare?",
        answer:
          "you choose when you light it. a private flare is seen only by the friends and circles you invite. a public flare can be seen by anyone using sponti.",
      },
      {
        question: "can i back out after joining?",
        answer:
          "yes. open the flare and tap “can't make it”, so the host knows who's actually coming.",
      },
      {
        question: "can a host change a flare?",
        answer:
          "yes. hosts can edit the time, place and details, or cancel the flare, and post an update so guests know what changed.",
      },
    ],
  },
  {
    title: "privacy and trust",
    icon: LockKeyhole,
    questions: [
      {
        question: "does sponti read my contacts?",
        answer:
          "no. sponti doesn't import your phone contacts. you add friends yourself, by username, qr code or invite link.",
      },
      {
        question: "why does location matter?",
        answer:
          "it helps people decide whether a flare is realistic to join. when you light a flare at your current location, guests see the neighbourhood, not a street address.",
      },
      {
        question: "what if a flare feels unsafe?",
        answer:
          "don't go if something feels wrong. for immediate danger, contact local emergency services first. to report an unsafe flare or behaviour on sponti, use support. safety reports are read first.",
      },
    ],
  },
  {
    title: "accounts and support",
    icon: UserCircle,
    questions: [
      {
        question: "how do i get account help?",
        answer:
          "use support for login, your profile, deleting your account, or suspicious activity. it opens an email to us.",
      },
      {
        question: "where do i report a bug?",
        answer:
          "use support and pick “bug or broken feature”. tell us which screen it happened on and what you expected instead.",
      },
    ],
  },
] as const

function LinkRow({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center justify-between rounded-xl border border-border px-3 py-3 text-sm font-medium transition-colors hover:bg-secondary"
    >
      <span>{label}</span>
      <ChevronRight
        className="size-4 text-muted-foreground"
        aria-hidden="true"
      />
    </Link>
  )
}

export default function FaqFeedbackPage() {
  return (
    <MenuPageShell title="faq & feedback">
      <article className="flex flex-col gap-6 pt-4 pb-8">
        <section className="flex flex-col gap-3">
          <p className="text-sm font-medium text-accent">help shape sponti</p>
          <h2 className="text-3xl leading-tight font-bold">
            find quick answers or share what slowed you down.
          </h2>
          <p className="text-base leading-7 text-muted-foreground">
            start with the common questions. if the answer is missing, or you
            have feedback, send it through support.
          </p>
        </section>

        <section className="flex flex-col gap-6" aria-label="questions">
          {faqGroups.map((group) => {
            const Icon = group.icon

            return (
              <section key={group.title} className="flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <Icon className="size-4 text-accent" aria-hidden="true" />
                  <h3 className="text-sm font-medium tracking-wide text-muted-foreground">
                    {group.title}
                  </h3>
                </div>

                <div className="flex flex-col gap-2">
                  {group.questions.map((item, index) => (
                    <details
                      key={item.question}
                      open={index === 0}
                      className="group rounded-xl border border-border bg-card p-4"
                    >
                      <summary className="flex cursor-pointer list-none items-start justify-between gap-3 text-sm font-medium marker:hidden">
                        <span>{item.question}</span>
                        <ChevronDown
                          className="mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
                          aria-hidden="true"
                        />
                      </summary>
                      <p className="mt-3 text-sm leading-6 text-muted-foreground">
                        {item.answer}
                      </p>
                    </details>
                  ))}
                </div>
              </section>
            )
          })}
        </section>

        <Card className="border border-border bg-card p-4">
          <h3 className="font-semibold">send feedback</h3>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            found a bug, hit a confusing flow, or have an idea that would make
            meeting up easier? support opens an email to us, and it&apos;s also
            where to report anything that feels unsafe.
          </p>
          <div className="mt-4 flex flex-col gap-2">
            <LinkRow href="/menu/support" label="send feedback or get help" />
            <LinkRow href="/menu/terms" label="read the terms of service" />
          </div>
        </Card>
      </article>
    </MenuPageShell>
  )
}
