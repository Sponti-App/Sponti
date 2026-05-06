# Overview

**People want to meet spontaneously, but existing tools make casual plans feel like either a full event or a messy group chat\.**

We are building a social meetup planning platform that reduces friction in organizing spontaneous and planned gatherings among friends and networks\. The goal is fast creation, clear coordination, and low\-notification noise\. 

Impact: higher meetup frequency and improved group coordination with strong privacy controls\.

# Functional Requirements

Must\-Have

- 3\-tap meetup creation\.
- Low\-noise calendar for planning/RSVP\.
- Onboarding: import/add recent contacts/friends\. 
- QR code contact card \(generate/scan\)\.
- Detailed notification settings \(quiet hours\)\.
- Host controls: enable/disable guest\-invites; guest invite limits\.
- Sharing settings: friends of friends visibility\. Public/private setting\.
- Host/admin role delegation\.
- Granular privacy per friends list\.
- public/private mode for profile and events

Should\-Have

Could\-Have

- Pulse feed of upcoming events\.
- Direct host DMs\.
- Group chat tied to each event\.
- AI\-supported event creation \(titles, timeslots, suggestions\)\.
- Groupchat bot for summaries and event assistance\.
- Regular meetups on shared calendar\.
- NOW/SOON event type filters\.
- Export to external calendars\.
- Friend routine visibility for shared free time\.
- Weekly social goal tracking\.
- Cross\-platform sharing\.

Nice\-to\-Have

- Interest\- and values\-based connections\.
- Auto\-sharing contact info across trusted network\.
- Lightweight 1v1 connection support \(non\-primary\)\.

# Non\-Functional Requirements

- Performance: event create &lt;2s per step; chat send &lt;300ms perceived\.
- Reliability: offline draft and retry for creates/invites\.
- Privacy &amp; Security: end\-to\-end or TLS in transit, least\-privilege access, clear consent for data sharing\.
- Accessibility: WCAG AA for core flows\.
- Localization\-ready\.

# Non\-Goals / Out of Scope

- Primary dating functionality\.
- Complex algorithmic scheduling or automatic time optimization\.

# Dependencies &amp; Risks

- AI provider integration \(LLM, speech\-to\-text\)\.
- External calendar APIs \(e\.g\., iOS/Android/Google\)\.
- QR code generation/scanning libraries\.
- Privacy/permissions framework\.
- Risks: AI hallucinations; over\-notification; contact import compliance; data privacy regulations; third\-party API rate limits\.

# Open Questions

- Include public profiles in v1 or defer?
- Final AI approach \(provider, context window, prompt guardrails, logging\)\.
- Priority platforms for cross\-platform sharing and calendar export\.
- Exact privacy model for friends lists and default visibility\.
- Minimum events/RSVPs for Pulse feed and notification rules\.

