"use client"

import { useState, type KeyboardEvent, type ReactNode } from "react"
import Link from "next/link"
import {
  Bug,
  ChevronDown,
  ChevronRight,
  Lightbulb,
  LockKeyhole,
  MapPin,
  MessageSquare,
  ShieldCheck,
  Sparkles,
  UserCircle,
  Users,
} from "lucide-react"
import { MenuPageShell } from "@/components/menu-page-shell"
import { Card } from "@/components/ui/card"

type View = "faq" | "feedback"

const tabs = [
  { id: "faq", label: "FAQ" },
  { id: "feedback", label: "Feedback" },
] as const

const faqGroups = [
  {
    title: "Getting started",
    icon: Sparkles,
    questions: [
      {
        question: "What is Sponti for?",
        answer:
          "Sponti helps people turn a free moment into a real plan. You can create a flare for something happening now or soon, show it to the people you trust, and let friends join without a long group-chat negotiation.",
      },
      {
        question: "Is Sponti a finished production app?",
        answer:
          "This version is an educational prototype. The page content is written as if Sponti had real users, but some product paths, support flows, and account actions may still be simulated or incomplete.",
      },
    ],
  },
  {
    title: "Events and RSVPs",
    icon: MapPin,
    questions: [
      {
        question: "Who can see a flare?",
        answer:
          "Visibility depends on the audience selected by the host. For MVP, the product should make that audience clear before an event is published, especially when a location is involved.",
      },
      {
        question: "Can I leave a meetup after joining?",
        answer:
          "Yes. Joining should be reversible. If you can no longer attend, leave the meetup so the host and other attendees have a more accurate picture of who is coming.",
      },
      {
        question: "What should hosts update?",
        answer:
          "Hosts should update important details such as time, location, cancellation, capacity, or anything that affects whether people can safely and realistically attend.",
      },
    ],
  },
  {
    title: "Privacy and trust",
    icon: LockKeyhole,
    questions: [
      {
        question: "Does Sponti scrape my contacts?",
        answer:
          "No. Contact scraping is outside the MVP direction. Sponti is designed around trusted visibility and intentional sharing, not importing everyone you know by default.",
      },
      {
        question: "Why does location matter?",
        answer:
          "Location helps people understand whether a meetup is realistic to join. Precise location should be handled carefully, shown only where useful, and controlled by the event visibility model.",
      },
      {
        question: "What if an event feels unsafe?",
        answer:
          "Do not attend if something feels wrong. For immediate danger, contact local emergency services first. For harmful content or unsafe behavior in Sponti, use the support reporting path.",
      },
    ],
  },
  {
    title: "Accounts and support",
    icon: UserCircle,
    questions: [
      {
        question: "How do I get account help?",
        answer:
          "Use the Support page for login, profile, deletion, or suspicious activity questions. Include the account email and a short description of what happened.",
      },
      {
        question: "Where should I report bugs?",
        answer:
          "Use the Feedback tab for product bugs and confusing flows. Use Support for account or safety issues that need a direct response.",
      },
    ],
  },
] as const

const feedbackTypes = [
  {
    title: "Bug",
    description: "Something broke, froze, displayed wrong, or blocked a task.",
    icon: Bug,
  },
  {
    title: "Confusing flow",
    description: "Something was hard to understand, find, or complete.",
    icon: MessageSquare,
  },
  {
    title: "Feature idea",
    description: "A suggestion that could make planning or joining easier.",
    icon: Lightbulb,
  },
  {
    title: "Safety or trust",
    description: "A concern about visibility, reporting, behavior, or consent.",
    icon: ShieldCheck,
  },
  {
    title: "Other",
    description: "Anything that does not fit the categories above.",
    icon: Users,
  },
] as const

const feedbackChecklist = [
  "Which screen or action you were using",
  "What happened and what you expected instead",
  "Whether it happened once or keeps happening",
  "Your device and browser, if you know them",
]

function SegmentButton({
  active,
  children,
  id,
  panelId,
  onClick,
  onKeyDown,
}: {
  active: boolean
  children: ReactNode
  id: string
  panelId: string
  onClick: () => void
  onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => void
}) {
  return (
    <button
      id={id}
      type="button"
      role="tab"
      aria-selected={active}
      aria-controls={panelId}
      tabIndex={active ? 0 : -1}
      onClick={onClick}
      onKeyDown={onKeyDown}
      className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none ${
        active
          ? "bg-accent text-accent-foreground"
          : "text-muted-foreground hover:bg-background hover:text-foreground"
      }`}
    >
      {children}
    </button>
  )
}

function FaqPanel() {
  return (
    <section
      id="faq-panel"
      role="tabpanel"
      aria-labelledby="faq-tab"
      className="flex flex-col gap-6"
    >
      <div className="flex flex-col gap-2">
        <h3 className="text-xl font-semibold">Frequently asked questions</h3>
        <p className="text-sm leading-6 text-muted-foreground">
          Quick answers for the questions people are most likely to have before
          creating, joining, or reporting a meetup.
        </p>
      </div>

      {faqGroups.map((group) => {
        const Icon = group.icon

        return (
          <section key={group.title} className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <Icon className="size-4 text-accent" aria-hidden="true" />
              <h4 className="text-sm font-medium tracking-wide text-muted-foreground uppercase">
                {group.title}
              </h4>
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

      <Card className="border border-border bg-card p-4">
        <h4 className="font-semibold">Still stuck?</h4>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          If this page does not answer the question, use feedback for product
          input or support for account, event, and safety issues.
        </p>
        <div className="mt-4 flex flex-col gap-2">
          <Link
            href="/menu/support"
            className="inline-flex items-center justify-between rounded-xl border border-border px-3 py-3 text-sm font-medium transition-colors hover:bg-secondary"
          >
            <span>Open Support</span>
            <ChevronRight
              className="size-4 text-muted-foreground"
              aria-hidden="true"
            />
          </Link>
          <Link
            href="/menu/terms"
            className="inline-flex items-center justify-between rounded-xl border border-border px-3 py-3 text-sm font-medium transition-colors hover:bg-secondary"
          >
            <span>Read Terms of Service</span>
            <ChevronRight
              className="size-4 text-muted-foreground"
              aria-hidden="true"
            />
          </Link>
        </div>
      </Card>
    </section>
  )
}

function FeedbackPanel() {
  return (
    <section
      id="feedback-panel"
      role="tabpanel"
      aria-labelledby="feedback-tab"
      className="flex flex-col gap-6"
    >
      <div className="flex flex-col gap-2">
        <h3 className="text-xl font-semibold">Send feedback</h3>
        <p className="text-sm leading-6 text-muted-foreground">
          This preview shows the feedback flow Sponti would use in production.
          Submission is not connected in this prototype.
        </p>
      </div>

      <section className="flex flex-col gap-3">
        <h4 className="text-sm font-medium tracking-wide text-muted-foreground uppercase">
          Feedback type
        </h4>
        <div className="flex flex-col gap-2">
          {feedbackTypes.map((item, index) => {
            const Icon = item.icon
            const selected = index === 1

            return (
              <Card
                key={item.title}
                className={`flex-row items-start gap-3 rounded-xl border p-4 ${
                  selected
                    ? "border-accent bg-card"
                    : "border-border bg-card"
                }`}
              >
                <Icon
                  className={`mt-0.5 size-4 shrink-0 ${
                    selected ? "text-accent" : "text-muted-foreground"
                  }`}
                  aria-hidden="true"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{item.title}</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    {item.description}
                  </p>
                </div>
              </Card>
            )
          })}
        </div>
      </section>

      <form className="flex flex-col gap-4" onSubmit={(event) => event.preventDefault()}>
        <div className="flex flex-col gap-2">
          <label htmlFor="feedback-message" className="text-sm font-medium">
            What happened?
          </label>
          <textarea
            id="feedback-message"
            name="message"
            rows={5}
            readOnly
            value="I tried to join a meetup from the map, but I was not sure whether my RSVP was saved."
            className="min-h-32 resize-none rounded-xl border border-border bg-background px-3 py-3 text-sm leading-6 text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <p className="text-xs leading-5 text-muted-foreground">
            In production, this would be editable and sent to the team.
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="feedback-email" className="text-sm font-medium">
            Email for follow-up
          </label>
          <input
            id="feedback-email"
            name="email"
            type="email"
            readOnly
            value="martin@example.com"
            className="rounded-xl border border-border bg-background px-3 py-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <p className="text-xs leading-5 text-muted-foreground">
            Optional unless support needs to reply.
          </p>
        </div>

        <button
          type="submit"
          disabled
          className="rounded-xl bg-primary px-4 py-3 text-sm font-medium text-primary-foreground disabled:cursor-not-allowed disabled:opacity-55"
        >
          Submit feedback
        </button>
      </form>

      <section className="flex flex-col gap-3">
        <h4 className="text-sm font-medium tracking-wide text-muted-foreground uppercase">
          Helpful details
        </h4>
        <ul className="flex flex-col gap-2 text-sm leading-6 text-muted-foreground">
          {feedbackChecklist.map((item) => (
            <li key={item} className="flex gap-2">
              <span className="mt-2 size-1.5 shrink-0 rounded-full bg-accent" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </section>

      <Card className="border border-border bg-card p-4">
        <h4 className="font-semibold">Need help, not product feedback?</h4>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Use Support for account access, unsafe content, moderation concerns,
          or anything that needs a direct response.
        </p>
        <Link
          href="/menu/support"
          className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-foreground underline underline-offset-4"
        >
          Open Support
          <ChevronRight className="size-4" aria-hidden="true" />
        </Link>
      </Card>
    </section>
  )
}

export default function FaqFeedbackPage() {
  const [activeView, setActiveView] = useState<View>("faq")

  function handleTabKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") {
      return
    }

    event.preventDefault()
    setActiveView((current) => (current === "faq" ? "feedback" : "faq"))
  }

  return (
    <MenuPageShell title="FAQ & Feedback">
      <article className="flex flex-col gap-6 pt-4 pb-8">
        <section className="flex flex-col gap-3">
          <p className="text-sm font-medium text-accent">Help shape Sponti</p>
          <h2 className="text-3xl leading-tight font-bold">
            Find quick answers or share what slowed you down.
          </h2>
          <p className="text-base leading-7 text-muted-foreground">
            Start with common questions. If the answer is missing, switch to
            feedback and tell the team what would make the app clearer.
          </p>
        </section>

        <div
          role="tablist"
          aria-label="FAQ and feedback sections"
          className="grid grid-cols-2 gap-1 rounded-xl border border-border bg-secondary p-1"
        >
          {tabs.map((tab) => (
            <SegmentButton
              key={tab.id}
              id={`${tab.id}-tab`}
              panelId={`${tab.id}-panel`}
              active={activeView === tab.id}
              onClick={() => setActiveView(tab.id)}
              onKeyDown={handleTabKeyDown}
            >
              {tab.label}
            </SegmentButton>
          ))}
        </div>

        {activeView === "faq" ? <FaqPanel /> : <FeedbackPanel />}
      </article>
    </MenuPageShell>
  )
}
