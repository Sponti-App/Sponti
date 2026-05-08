import type { ReactNode } from "react"
import { MenuPageShell } from "@/components/menu-page-shell"

const supportEmail = "sponti.support@example.com"
const reportsEmail = "sponti.reports@example.com"
const appealsEmail = "sponti.appeals@example.com"
const privacyEmail = "sponti.privacy@example.com"
const privacyHref = "/menu/privacy"

const termsQuickLinks = [
  { href: "#accounts", label: "Accounts" },
  { href: "#events", label: "Events" },
  { href: "#reports", label: "Reports" },
  { href: "#privacy", label: "Privacy" },
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
    <section id={id} className="scroll-mt-4 flex flex-col gap-3">
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
      target={href.startsWith("http") ? "_blank" : undefined}
      rel={href.startsWith("http") ? "noreferrer" : undefined}
      className="font-medium text-foreground underline underline-offset-4"
    >
      {children}
    </a>
  )
}

export default function TermsPage() {
  return (
    <MenuPageShell title="Terms of Service">
      <article className="flex flex-col gap-6 pt-4 pb-8">
        <section className="flex flex-col gap-3">
          <p className="text-sm font-medium text-accent">
            Last updated: 7 May 2026
          </p>
          <h2 className="text-3xl leading-tight font-bold">
            Terms for using Sponti.
          </h2>
          <p className="text-base leading-7 text-muted-foreground">
            These Terms of Service govern your access to and use of Sponti, an
            event application that allows users to discover, create, publish,
            and join events.
          </p>
          <p className="text-sm leading-6 text-muted-foreground">
            By using Sponti, you agree to these Terms. If you do not agree, you
            must not use the app.
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
            <dd className="font-medium">WBS Coding School Student Project Team</dd>
            <dt className="text-muted-foreground">Contact</dt>
            <dd>
              <TextLink href={`mailto:${supportEmail}`}>{supportEmail}</TextLink>
            </dd>
            <dt className="text-muted-foreground">Status</dt>
            <dd className="font-medium">Educational prototype</dd>
          </dl>
        </section>

        <Section title="1. About Sponti">
          <Paragraph>
            Sponti is an event app that helps users discover, create, manage,
            and join events.
          </Paragraph>
          <Paragraph>The app may include features such as:</Paragraph>
          <BulletList
            items={[
              "user accounts",
              "event listings",
              "event search",
              "event details",
              "event registration or joining",
              "saved events",
              "organizer profiles",
              "event images",
              "map or location features",
              "notifications or reminders",
            ]}
          />
          <Paragraph>
            Sponti is currently developed as part of a WBS Coding School
            project. Unless clearly stated otherwise, the app is provided as an
            educational prototype and demonstration product.
          </Paragraph>
        </Section>

        <Section title="2. Who Can Use the App">
          <Paragraph>
            You may use Sponti only if you are legally allowed to enter into an
            agreement under the laws of your country.
          </Paragraph>
          <Paragraph>
            If you are under the minimum age required to consent to digital
            services in your country, you may only use the app with permission
            from a parent or legal guardian.
          </Paragraph>
          <Paragraph>
            You agree that any information you provide is accurate, complete,
            and kept up to date.
          </Paragraph>
        </Section>

        <Section id="accounts" title="3. User Accounts">
          <Paragraph>Some features may require you to create an account.</Paragraph>
          <Paragraph>When creating an account, you agree to:</Paragraph>
          <BulletList
            items={[
              "provide accurate information",
              "keep your login details secure",
              "not share your account with others",
              "notify us if you believe your account has been accessed without permission",
            ]}
          />
          <Paragraph>
            You are responsible for all activity under your account.
          </Paragraph>
          <Paragraph>We may suspend or delete your account if we reasonably believe that:</Paragraph>
          <BulletList
            items={[
              "you violated these Terms",
              "your account is being misused",
              "your account creates a legal, security, or operational risk",
              "we are required to do so by law",
            ]}
          />
        </Section>

        <Section title="4. Event Listings and User Content">
          <Paragraph>
            Users may be able to create, upload, submit, or publish content in
            the app, including:
          </Paragraph>
          <BulletList
            items={[
              "event names",
              "event descriptions",
              "event dates and times",
              "event locations",
              "event images",
              "organizer information",
              "links",
              "comments or messages, if enabled",
            ]}
          />
          <Paragraph>This is called User Content in these Terms.</Paragraph>
          <Paragraph>You are responsible for your User Content.</Paragraph>
          <Paragraph>You must not submit User Content that:</Paragraph>
          <BulletList
            items={[
              "is illegal",
              "is false, misleading, or fraudulent",
              "infringes intellectual property rights that belong to someone else",
              "violates privacy rights",
              "contains threats, harassment, hate speech, or abusive content",
              "contains sexually explicit, violent, or discriminatory content",
              "contains spam, scams, malware, or harmful code",
              "impersonates another person, company, school, or organization",
              "promotes unsafe or unlawful activities",
              "violates these Terms or applicable law",
            ]}
          />
          <Paragraph>
            By submitting User Content, you confirm that you have the right to
            publish it.
          </Paragraph>
          <Paragraph>
            You keep ownership of your User Content. However, you grant Sponti a
            limited, non-exclusive, worldwide, royalty-free license to host,
            store, display, reproduce, and process your User Content only as
            needed to operate, secure, improve, and display the app.
          </Paragraph>
          <Paragraph>
            This license ends when your User Content is deleted, except where
            continued storage is necessary for legal, security, backup, or
            legitimate operational reasons.
          </Paragraph>
        </Section>

        <Section id="events" title="5. Event Responsibility">
          <Paragraph>
            Sponti provides tools for listing and discovering events. Sponti is
            not automatically the organizer of events listed in the app.
          </Paragraph>
          <Paragraph>
            Unless Sponti is clearly identified as the organizer of a specific
            event, we are not responsible for:
          </Paragraph>
          <BulletList
            items={[
              "whether an event takes place",
              "event cancellations",
              "event changes",
              "inaccurate event information",
              "event safety",
              "venue conditions",
              "organizer conduct",
              "attendee conduct",
              "ticket or entry decisions",
              "third-party services linked from an event",
            ]}
          />
          <Paragraph>
            Users are responsible for deciding whether to attend an event.
          </Paragraph>
          <Paragraph>
            Organizers are responsible for ensuring that their events comply
            with applicable laws, rules, permits, safety requirements, age
            restrictions, and venue requirements.
          </Paragraph>
        </Section>

        <Section title="6. Organizer Responsibilities">
          <Paragraph>If you create or publish an event, you agree that:</Paragraph>
          <BulletList
            items={[
              "the event information is accurate",
              "you have the right to organize or promote the event",
              "you will update the event if important details change",
              "you will not mislead users about the event",
              "you will comply with applicable laws and venue rules",
              "you will not publish events that are illegal, unsafe, discriminatory, or fraudulent",
            ]}
          />
          <Paragraph>
            We may remove or restrict event listings that violate these Terms or
            applicable law.
          </Paragraph>
        </Section>

        <Section title="7. Prohibited Use">
          <Paragraph>You agree not to:</Paragraph>
          <BulletList
            items={[
              "use the app for illegal purposes",
              "misuse the app for spam, scams, or fraud",
              "access or attempt to access another user account",
              "interfere with the security or operation of the app",
              "upload malware, harmful code, or automated scripts",
              "scrape, harvest, or copy app data without permission",
              "overload, disrupt, or damage the app",
              "manipulate rankings, visibility, attendance numbers, or recommendations",
              "reverse engineer the app except where legally permitted",
              "use the app in a way that harms users, organizers, or the service",
            ]}
          />
        </Section>

        <Section title="8. Content Moderation">
          <Paragraph>
            We may review, restrict, remove, or disable access to User Content if
            we reasonably believe that it:
          </Paragraph>
          <BulletList
            items={[
              "violates these Terms",
              "violates applicable law",
              "creates safety, security, legal, or operational risk",
              "has been reported as illegal or harmful",
              "infringes the rights of another person or organization",
            ]}
          />
          <Paragraph>Moderation may be based on:</Paragraph>
          <BulletList
            items={[
              "user reports",
              "automated checks",
              "manual review",
              "legal notices",
              "security monitoring",
            ]}
          />
          <Paragraph>
            Where appropriate, we may notify the affected user and explain the
            reason for the action.
          </Paragraph>
          <Paragraph>
            We may also suspend or terminate accounts that repeatedly or
            seriously violate these Terms.
          </Paragraph>
        </Section>

        <Section id="reports" title="9. Reporting Illegal or Harmful Content">
          <Paragraph>
            Users may report illegal, harmful, or rule-breaking content by
            contacting{" "}
            <TextLink href={`mailto:${reportsEmail}`}>{reportsEmail}</TextLink>.
          </Paragraph>
          <Paragraph>A report should include:</Paragraph>
          <BulletList
            items={[
              "a link or clear description of the content",
              "the reason for the report",
              "any relevant supporting information",
              "your contact details if you want a response",
            ]}
          />
          <Paragraph>
            We will review reports and decide whether action is needed.
          </Paragraph>
          <Paragraph>Actions may include:</Paragraph>
          <BulletList
            items={[
              "no action",
              "asking for more information",
              "editing or restricting visibility",
              "removing content",
              "suspending or deleting an account",
              "reporting serious issues to relevant authorities where legally required",
            ]}
          />
        </Section>

        <Section title="10. Complaints About Moderation Decisions">
          <Paragraph>
            If your content or account is restricted, removed, suspended, or
            terminated, you may contact us at{" "}
            <TextLink href={`mailto:${appealsEmail}`}>{appealsEmail}</TextLink>.
          </Paragraph>
          <Paragraph>Your complaint should include:</Paragraph>
          <BulletList
            items={[
              "your account email",
              "the affected content or event",
              "the moderation decision you disagree with",
              "why you believe the decision was incorrect",
            ]}
          />
          <Paragraph>
            We will review complaints in a reasonable manner.
          </Paragraph>
        </Section>

        <div className="h-px bg-border" />

        <Section title="11. Payments, Tickets, and Paid Features">
          <Paragraph>
            Sponti is currently intended as a free educational prototype.
          </Paragraph>
          <Paragraph>
            If paid tickets, paid event promotion, subscriptions, or paid
            organizer features are added later, users will receive clear
            information before payment, including:
          </Paragraph>
          <BulletList
            items={[
              "the main features of the paid service",
              "total price",
              "taxes, if applicable",
              "payment method",
              "cancellation terms",
              "refund terms",
              "duration of the service, if applicable",
            ]}
          />
          <Paragraph>
            If you are a consumer in the EU, you may have a legal right to
            withdraw from certain online purchases within 14 days. This right
            may not apply, or may end early, where digital content or digital
            services have already started with your consent and acknowledgement,
            or where another legal exception applies.
          </Paragraph>
          <Paragraph>
            Nothing in these Terms limits mandatory consumer rights under EU or
            national law.
          </Paragraph>
          <Paragraph>
            Ticket refunds and event cancellation rules may depend on the event
            organizer, the payment provider, and applicable consumer law.
          </Paragraph>
        </Section>

        <Section title="12. Free Prototype Use">
          <Paragraph>
            Because Sponti is currently a student project and prototype, the app
            may include:
          </Paragraph>
          <BulletList
            items={[
              "test data",
              "incomplete features",
              "temporary accounts",
              "bugs",
              "limited availability",
              "changing functionality",
            ]}
          />
          <Paragraph>
            We may modify, pause, reset, or discontinue the prototype at any
            time.
          </Paragraph>
          <Paragraph>
            Users should not rely on Sponti as a guaranteed production service
            unless we clearly state that the app has moved into a production
            version.
          </Paragraph>
        </Section>

        <Section id="privacy" title="13. Privacy and Personal Data">
          <Paragraph>
            We process personal data as described in our Privacy Policy.
          </Paragraph>
          <Paragraph>The Privacy Policy explains:</Paragraph>
          <BulletList
            items={[
              "what personal data we collect",
              "why we collect it",
              "the legal basis for processing",
              "how long we keep it",
              "who we share it with",
              "your GDPR rights",
              "how to contact us about privacy requests",
            ]}
          />
          <Paragraph>
            You can read the Privacy Policy at{" "}
            <TextLink href={privacyHref}>{privacyHref}</TextLink>.
          </Paragraph>
          <Paragraph>
            For privacy requests, contact{" "}
            <TextLink href={`mailto:${privacyEmail}`}>{privacyEmail}</TextLink>.
          </Paragraph>
          <Paragraph>
            The Terms of Service and Privacy Policy are separate documents.
            These Terms govern app use. The Privacy Policy governs personal data
            processing.
          </Paragraph>
        </Section>

        <Section title="14. Location Data">
          <Paragraph>
            Sponti may use location information to show event locations, nearby
            events, or maps.
          </Paragraph>
          <Paragraph>
            Event locations submitted by organizers may be visible to other
            users.
          </Paragraph>
          <Paragraph>
            If Sponti uses your precise device location, we will request
            permission where required. You can disable location access through
            your browser or device settings.
          </Paragraph>
          <Paragraph>
            We do not guarantee that map data, travel times, or location
            information are always accurate.
          </Paragraph>
        </Section>

        <Section title="15. Notifications and Messages">
          <Paragraph>
            Sponti may send service-related messages, such as:
          </Paragraph>
          <BulletList
            items={[
              "account messages",
              "event updates",
              "security notices",
              "important app changes",
              "registration confirmations",
              "event reminders",
            ]}
          />
          <Paragraph>
            If marketing messages are added, we will only send them where
            legally permitted and will provide a way to unsubscribe.
          </Paragraph>
        </Section>

        <Section title="16. Third-Party Services">
          <Paragraph>
            Sponti may use third-party services, including:
          </Paragraph>
          <BulletList
            items={[
              "hosting providers",
              "database providers",
              "authentication providers",
              "map providers",
              "analytics tools",
              "email providers",
              "payment providers",
              "external event links",
            ]}
          />
          <Paragraph>
            Third-party services may have their own terms and privacy policies.
          </Paragraph>
          <Paragraph>
            We are not responsible for third-party websites, services, content,
            or actions that we do not control.
          </Paragraph>
        </Section>

        <Section title="17. Intellectual Property">
          <Paragraph>
            The app, including its code, design, interface, branding, logo, text,
            and non-user content, belongs to the Sponti project team or its
            licensors.
          </Paragraph>
          <Paragraph>
            You may not copy, modify, sell, distribute, or exploit the app or
            its content without permission, except where legally allowed.
          </Paragraph>
          <Paragraph>
            User Content remains owned by the user who submitted it.
          </Paragraph>
        </Section>

        <Section title="18. Feedback">
          <Paragraph>
            If you send us feedback, ideas, bug reports, or suggestions, we may
            use them to improve Sponti without payment or obligation to you.
          </Paragraph>
          <Paragraph>Do not submit confidential information as feedback.</Paragraph>
        </Section>

        <Section title="19. Availability and Security">
          <Paragraph>
            We aim to keep Sponti available and secure, but we do not guarantee
            that:
          </Paragraph>
          <BulletList
            items={[
              "the app will always be available",
              "the app will always be error-free",
              "all bugs will be fixed",
              "all data will always be preserved",
              "the app will be compatible with every device or browser",
            ]}
          />
          <Paragraph>
            You are responsible for using a secure device, browser, and internet
            connection.
          </Paragraph>
        </Section>

        <Section title="20. Termination">
          <Paragraph>You may stop using Sponti at any time.</Paragraph>
          <Paragraph>
            You may request account deletion by contacting{" "}
            <TextLink href={`mailto:${supportEmail}`}>{supportEmail}</TextLink>.
          </Paragraph>
          <Paragraph>We may suspend or terminate your access if:</Paragraph>
          <BulletList
            items={[
              "you violate these Terms",
              "your account creates legal, security, or operational risk",
              "your account is inactive for a long period",
              "the app is discontinued",
              "we are required to do so by law",
            ]}
          />
          <Paragraph>
            After termination, some information may remain stored where
            necessary for legal, security, backup, or legitimate operational
            reasons, as described in the Privacy Policy.
          </Paragraph>
        </Section>

        <div className="h-px bg-border" />

        <Section title="21. Disclaimers">
          <Paragraph>
            Sponti is provided &quot;as is&quot; and &quot;as available.&quot;
          </Paragraph>
          <Paragraph>
            To the extent permitted by law, we do not guarantee that:
          </Paragraph>
          <BulletList
            items={[
              "event information is always accurate",
              "events will take place as described",
              "organizers or attendees will behave appropriately",
              "the app will always work without interruption",
              "the app will meet your expectations",
              "user-generated content will be reliable",
            ]}
          />
          <Paragraph>
            Nothing in these Terms excludes or limits rights that cannot be
            excluded or limited under applicable law.
          </Paragraph>
        </Section>

        <Section title="22. Limitation of Liability">
          <Paragraph>
            To the extent permitted by law, Sponti and the project team are not
            liable for:
          </Paragraph>
          <BulletList
            items={[
              "indirect or consequential losses",
              "loss of data",
              "loss of profits",
              "missed events",
              "event cancellations",
              "inaccurate event information",
              "organizer conduct",
              "attendee conduct",
              "third-party services",
              "user-generated content",
              "temporary or permanent app unavailability",
            ]}
          />
          <Paragraph>
            This limitation does not apply where liability cannot legally be
            limited, including cases of intentional misconduct, gross
            negligence, or mandatory consumer protection rights.
          </Paragraph>
        </Section>

        <Section title="23. Changes to These Terms">
          <Paragraph>We may update these Terms from time to time.</Paragraph>
          <Paragraph>
            If changes are significant, we may notify users through the app, by
            email, or by updating the Last updated date.
          </Paragraph>
          <Paragraph>
            Your continued use of Sponti after the updated Terms become
            effective means you accept the updated Terms.
          </Paragraph>
          <Paragraph>
            If you do not agree with the updated Terms, you must stop using the
            app.
          </Paragraph>
        </Section>

        <Section title="24. Governing Law">
          <Paragraph>These Terms are governed by the laws of Sweden.</Paragraph>
          <Paragraph>
            If you are a consumer living in another EU country, you may also
            have rights under the mandatory consumer protection laws of your
            country of residence.
          </Paragraph>
        </Section>

        <Section id="contact" title="25. Contact">
          <Paragraph>
            For general questions:{" "}
            <TextLink href={`mailto:${supportEmail}`}>{supportEmail}</TextLink>
          </Paragraph>
          <Paragraph>
            For privacy requests:{" "}
            <TextLink href={`mailto:${privacyEmail}`}>{privacyEmail}</TextLink>
          </Paragraph>
          <Paragraph>
            For content reports:{" "}
            <TextLink href={`mailto:${reportsEmail}`}>{reportsEmail}</TextLink>
          </Paragraph>
          <Paragraph>
            For moderation appeals:{" "}
            <TextLink href={`mailto:${appealsEmail}`}>{appealsEmail}</TextLink>
          </Paragraph>
        </Section>
      </article>
    </MenuPageShell>
  )
}
