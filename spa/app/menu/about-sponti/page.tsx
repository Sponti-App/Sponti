import type { SVGProps } from "react"
import { MenuPageShell } from "@/components/menu-page-shell"

const team = [
  {
    name: "Nil Angelats",
    href: "https://www.linkedin.com/in/nil-angelats/",
  },
  {
    name: "Samara Arzt",
    href: "https://www.linkedin.com/in/samara-arzt/",
  },
  {
    name: "Patrick Caire",
    href: "https://www.linkedin.com/in/patrickcaire/",
  },
  {
    name: "Martin Lindholm",
    href: "https://www.linkedin.com/in/martinlindholm84/",
  },
] as const

const githubHref = "https://github.com/Sponti-App/Sponti"
const wbsHref = "https://www.wbscodingschool.com/"

function LinkedinIcon({ className, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <rect
        x="3.5"
        y="3.5"
        width="17"
        height="17"
        rx="3"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="M8 10v6M8 7.5v.01M11 16v-6M11 12.5c0-1.5 1-2.7 2.6-2.7 1.5 0 2.4 1 2.4 2.7V16"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function GithubIcon({ className, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path
        d="M9 19.5c-4.2 1.2-4.2-2-6-2.4M15 21v-3.4c0-.9-.3-1.5-.8-1.9 2.8-.3 5.8-1.4 5.8-6.2 0-1.4-.5-2.5-1.3-3.4.1-.3.6-1.7-.1-3.4 0 0-1.1-.3-3.5 1.3a12 12 0 0 0-6.2 0C6.5 2.4 5.4 2.7 5.4 2.7c-.7 1.7-.2 3.1-.1 3.4A4.9 4.9 0 0 0 4 9.5c0 4.8 2.9 5.9 5.8 6.2-.4.3-.7.9-.8 1.6V21"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export default function AboutSpontiPage() {
  return (
    <MenuPageShell title="about sponti">
      <article className="flex flex-col gap-6 pt-4 pb-8">
        <section className="flex flex-col gap-3">
          <p className="text-sm font-medium text-accent">
            the shortest path to irl.
          </p>
          <h2 className="text-3xl leading-tight font-bold">
            we measure success by how quickly you put your phone down.
          </h2>
          <p className="text-base leading-7 text-muted-foreground">
            sponti exists for the moment between thinking about seeing someone
            and actually making it happen. it is not another feed to check. it
            is a small bridge from digital intention to real presence.
          </p>
          <p className="text-sm leading-6 text-muted-foreground">
            it comes from close to home. some of us are often too busy to be
            spontaneous with friends. some of us know the quieter side of social
            life, where reaching out can take more energy than people see.
            sponti starts from that honest place.
          </p>
        </section>

        <div className="h-px bg-border" />

        <section className="flex flex-col gap-3">
          <h3 className="text-xl font-semibold">how it started</h3>
          <p className="text-sm leading-6 text-muted-foreground">
            it began on a holiday with friends, years ago. we noticed how we
            kept drifting towards chilling together, at all sorts of times,
            without anyone having planned it. that easy, unplanned togetherness
            is what i wanted more of.
          </p>
          <p className="text-sm leading-6 text-muted-foreground">
            the idea stayed with our group for a few years and kept growing.
            then facebook events faded out after covid, and the gap was easy to
            see. people bounce between instagram, whatsapp and telegram, through
            long threads and groups. everything is scattered, and it is
            frustrating: there is no easy way to get people together on a whim,
            or to keep up with what is happening in your circle.
          </p>
          <p className="text-sm leading-6 text-muted-foreground">
            that is how the idea grew into sponti.
          </p>
        </section>

        <section className="flex flex-col gap-3">
          <h3 className="text-xl font-semibold">the problem</h3>
          <p className="text-sm leading-6 text-muted-foreground">
            we are more connected than ever, but it has not made friendship feel
            easier. group chats get noisy. social apps turn connection into
            performance. proximity apps can feel empty before they have a chance
            to become useful.
          </p>
          <p className="text-sm leading-6 text-muted-foreground">
            sponti starts from a different question: what would a social app
            look like if the goal was not time spent in app, but time spent
            together?
          </p>
        </section>

        <section className="flex flex-col gap-3">
          <h3 className="text-xl font-semibold">the idea</h3>
          <p className="text-sm leading-6 text-muted-foreground">
            a flare is a simple signal: i am free now or soon. coffee for an
            hour. a walk after class. pizza nearby. it is lightweight by design,
            shared with people you trust, and easy to join without turning every
            plan into a negotiation.
          </p>
          <p className="text-sm leading-6 text-muted-foreground">
            the app is built around small circles, clear timing, and low
            notification noise. you do not need a crowd. you need the right few
            people to see the right invitation at the right time.
          </p>
        </section>

        <section className="flex flex-col gap-3">
          <h3 className="text-xl font-semibold">what we believe</h3>
          <ul className="flex flex-col gap-2 text-sm leading-6 text-muted-foreground">
            <li>trust is the only real currency.</li>
            <li>
              no infinite scroll. no engagement tricks. no contact scraping.
            </li>
            <li>utility should feel quiet, human, and almost invisible.</li>
            <li>
              the best outcome is not another tap. it is a phone face down.
            </li>
          </ul>
        </section>

        <section className="flex flex-col gap-3">
          <h3 className="text-xl font-semibold">where it is going</h3>
          <p className="text-sm leading-6 text-muted-foreground">
            sponti is a tool for right now: the gap between a messy group-chat
            ping and a real plan. the first version keeps that promise focused:
            light a flare, see what is happening, and help friends get back
            together in real life.
          </p>
          <p className="text-sm leading-6 text-muted-foreground">
            i am leading sponti from here, through testing with real friends and
            towards the full app.
          </p>
          <p className="text-lg leading-7 font-medium">
            sponti does not want your attention. it wants your presence.
          </p>
        </section>

        <div className="h-px bg-border" />

        <section className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <h3 className="text-xl font-semibold">built by us</h3>
            <p className="text-sm leading-6 text-muted-foreground">
              i pitched sponti to the team on the ai software development
              program at{" "}
              <a
                href={wbsHref}
                target="_blank"
                rel="noreferrer"
                className="font-medium text-accent underline underline-offset-4"
              >
                wbs coding school
              </a>
              . they saw the potential straight away. they helped me pull my
              earlier work and research together, and built the mvp with me.
              sponti would not be here without them.
            </p>
          </div>

          <div className="flex flex-col gap-3">
            {team.map((person) => (
              <a
                key={person.href}
                href={person.href}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 text-sm font-medium text-foreground"
              >
                <span>{person.name}</span>
                <LinkedinIcon
                  className="size-4 text-accent"
                  aria-hidden="true"
                />
              </a>
            ))}
          </div>

          <a
            href={githubHref}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 text-sm font-medium text-foreground"
          >
            <GithubIcon className="size-4 text-accent" aria-hidden="true" />
            <span>view the sponti repository</span>
          </a>
        </section>
      </article>
    </MenuPageShell>
  )
}
