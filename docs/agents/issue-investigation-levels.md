# Sponti Issue Investigation Level Classification Standard

## 1. Classification principle

Classify an issue according to:

1. **Scope** — How many files, features, packages, or services are affected?
2. **Clarity** — Is the expected behaviour clearly defined?
3. **Risk** — Could the change affect security, privacy, data integrity, production, or many users?
4. **Contracts** — Does it change an API, database schema, shared type, environment contract, or public behaviour?
5. **Validation complexity** — Can the fix be verified locally and narrowly, or does it require cross-service or production-like validation?
6. **Reversibility** — Is the change easy to undo without data loss or compatibility problems?

The issue title or affected technology does not determine the level by itself.

---

## 2. General level definitions

| Level                     | Definition                                                                                              | Typical scope                                                                | Expected investigation                                                                             |
| ------------------------- | ------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| **Level 1 — Lightweight** | Localized, low-risk, clearly defined issue                                                              | Usually one feature, component, document, or small group of files            | Confirm requirement, locate cause, identify minimal change and focused validation                  |
| **Level 2 — Standard**    | Normal engineering issue involving several files, layers, or established integrations                   | Usually one package or one clear frontend/backend flow                       | Trace the relevant flow, inspect tests and documentation, establish cause and safe scope           |
| **Level 3 — Deep**        | High-risk, cross-service, architectural, security-sensitive, data-sensitive, or product-ambiguous issue | Multiple packages, services, contracts, environments, or critical behaviours | Full evidence-based investigation, branch comparison when relevant, risk and architecture analysis |

When uncertain, classify the issue as **Level 2**.

---

## 3. Classification by issue category

### A. Text, content, terminology, and documentation

| Level 1                                         | Level 2                                                             | Level 3                                                                                         |
| ----------------------------------------------- | ------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Typo or grammar correction                      | Terminology changed across several screens or documents             | Domain terminology change affecting stored data, API contracts, analytics, or multiple services |
| Incorrect button label with obvious replacement | Documentation and implementation disagree about a reusable workflow | Documentation conflict involving architectural ownership or an accepted decision                |
| Small translation correction                    | New localization behaviour affecting components and fallback rules  | Localization architecture or locale migration                                                   |
| Broken internal documentation link              | Setup guide requires changes in scripts, configuration, and CI      | Operational documentation is inconsistent with production deployment or security requirements   |
| Minor README clarification                      | User-facing copy changes with product or accessibility implications | Legal, privacy, consent, or security-related copy requiring authoritative decisions             |

#### Examples

- “Change `Creat event` to `Create event`” → **Level 1**
- “Replace the term `connection` with `contact` across the SPA” → usually **Level 2**
- “Redefine what a `connection` means across the API, database, and UI” → **Level 3**

---

### B. CSS, styling, layout, and visual behaviour

| Level 1                                                           | Level 2                                                               | Level 3                                                                                      |
| ----------------------------------------------------------------- | --------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Spacing, alignment, font size, colour, or border in one component | Responsive layout issue involving shared components or several routes | Global design-system change affecting most of the application                                |
| Simple mobile overflow in one view                                | Shared modal, navigation, form, or card styling defect                | Accessibility or theming architecture change                                                 |
| Incorrect local CSS class                                         | Style conflict caused by component composition or global selectors    | Major visual redesign with unclear product requirements                                      |
| Small hover or focus presentation fix                             | Design token or reusable component adjustment                         | Change affecting web and native/mobile presentation contracts                                |
| Clearly defined restyling of one isolated element                 | Accessibility correction across multiple components                   | Accessibility issue involving authentication, privacy, critical actions, or broad navigation |

#### Important rule

“CSS issue” does **not automatically mean Level 1**.

- One component, obvious result → **Level 1**
- Shared component or multiple screens → **Level 2**
- Global design system, accessibility architecture, or product-wide redesign → **Level 3**

---

### C. HTML structure and accessibility

| Level 1                                                 | Level 2                                                               | Level 3                                                                         |
| ------------------------------------------------------- | --------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Replace an incorrect heading level in one component     | Keyboard navigation or focus behaviour across a complete flow         | Application-wide accessibility architecture or compliance concern               |
| Add a missing label where expected behaviour is obvious | Shared form controls require semantic changes                         | Accessibility changes affecting security-sensitive or legally significant flows |
| Correct one semantic element                            | Modal, menu, table, or navigation semantics across several components | Major redesign required to meet a new accessibility standard                    |
| Add a local `aria-*` attribute with a clear purpose     | Screen-reader behaviour involving dynamic state                       | Accessibility requirements are unclear or conflict with the product design      |

---

### D. Frontend component behaviour

| Level 1                                             | Level 2                                                     | Level 3                                                     |
| --------------------------------------------------- | ----------------------------------------------------------- | ----------------------------------------------------------- |
| Button does not disable under one obvious condition | Form, state, or component behaviour involving several files | Behaviour depends on unresolved product rules               |
| Incorrect conditional rendering in one component    | Shared hook or state-management defect                      | Change affects several bounded contexts or applications     |
| Missing loading indicator for one known request     | Complex form submission or optimistic update flow           | Critical user action with race conditions or data-loss risk |
| Local validation message is wrong                   | Reusable validation logic or form schema change             | Cross-service contract must change                          |
| Isolated event-handler bug                          | Route, state, API adapter, and UI response all participate  | Major navigation or application-state architecture change   |

#### Examples

- Button remains enabled while its local form is invalid → possibly **Level 1**
- Form submits the wrong payload through a hook and API adapter → **Level 2**
- Form behaviour depends on an undefined invitation or privacy rule → **Level 3**

---

### E. Frontend routing and navigation

| Level 1                                                   | Level 2                                                 | Level 3                                                |
| --------------------------------------------------------- | ------------------------------------------------------- | ------------------------------------------------------ |
| One incorrect route link                                  | Redirect, route guard, or nested route issue            | Authentication or authorization routing                |
| Missing back-navigation behaviour with clear expectations | Navigation state shared across several screens          | Application-wide routing architecture change           |
| Isolated broken anchor                                    | Route parameters and data fetching interact incorrectly | Web/native deep-link or public-link compatibility      |
| Incorrect active-navigation style                         | Several roles or states have different navigation paths | Privacy-sensitive or security-sensitive route exposure |

---

### F. Frontend state management, caching, and synchronization

| Level 1                                          | Level 2                                                             | Level 3                                                     |
| ------------------------------------------------ | ------------------------------------------------------------------- | ----------------------------------------------------------- |
| Local component state is initialized incorrectly | Shared store, cache, query invalidation, or optimistic update issue | Race condition causing data corruption or privacy exposure  |
| Isolated stale visual value                      | State is shared across several components or routes                 | Offline synchronization or conflict-resolution architecture |
| Missing local reset after a successful action    | Cache and API response behaviour disagree                           | Cross-device or cross-service consistency problem           |
| Simple state condition is inverted               | Complex asynchronous state transition                               | Shared state architecture must be replaced or redesigned    |

Most state-management issues should start at **Level 2** unless they are clearly isolated.

---

### G. API endpoint and backend behaviour

| Level 1                                                         | Level 2                                                       | Level 3                                                       |
| --------------------------------------------------------------- | ------------------------------------------------------------- | ------------------------------------------------------------- |
| Small internal error-message correction with no contract impact | Endpoint implementation bug with a clear existing contract    | Public or cross-service API contract change                   |
| Local validation rule correction with obvious requirements      | Controller, service, validation, and persistence are involved | Authentication, authorization, privacy, or security behaviour |
| Clearly isolated mapping error                                  | New endpoint following established package patterns           | Breaking response or request change                           |
| Internal logging typo                                           | Error handling or status-code behaviour across several paths  | API versioning or compatibility decision                      |
| One test fixture is incorrect                                   | Backend behaviour and SPA adapter must be coordinated         | Multiple services own parts of the operation                  |

A normal API defect is usually **Level 2**, even when the code change itself may be small.

---

### H. Authentication and authorization

| Level 1              | Level 2                                                                                         | Level 3                                                                         |
| -------------------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Usually not Level 1  | Clearly localized presentation issue around authentication, without changing security behaviour | Login, logout, registration, session, token, permission, or role behaviour      |
| Text or styling only | Non-security test or documentation correction                                                   | Access-control rule changes                                                     |
|                      | Known redirect bug with no permission impact may begin at Level 2                               | User impersonation, account recovery, email verification, or password behaviour |
|                      |                                                                                                 | Cross-service identity behaviour                                                |
|                      |                                                                                                 | Protected-resource exposure                                                     |
|                      |                                                                                                 | Authentication data migration                                                   |

#### Mandatory rule

Any issue that may change **who can access what** is **Level 3**.

---

### I. Privacy and sensitive information

| Level 1                                           | Level 2                                                                 | Level 3                                                                                           |
| ------------------------------------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Purely visual correction with no data implication | Presentation issue where existing privacy rules are already unambiguous | Visibility rules, blocking, connections, invitations, private profiles, or personal-data exposure |
| Typo in already approved privacy copy             | Local implementation defect with a fully established privacy contract   | Consent, deletion, retention, export, or account-data behaviour                                   |
|                                                   |                                                                         | Notification or logging of sensitive information                                                  |
|                                                   |                                                                         | Any ambiguity about which users may see data                                                      |

#### Mandatory rule

Any plausible privacy exposure or personal-data risk is **Level 3**.

---

### J. Database, models, and persistence

| Level 1                                               | Level 2                                                          | Level 3                                                                |
| ----------------------------------------------------- | ---------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Test-data or fixture typo with no schema impact       | Query or repository bug using an established schema              | Schema migration                                                       |
| Clearly incorrect seed value in development-only data | Persistence defect limited to one model and no migration         | Data backfill or repair                                                |
|                                                       | Missing index with straightforward evidence may begin at Level 2 | Relationship or ownership redesign                                     |
|                                                       | Local serialization or mapping issue                             | Data integrity or data-loss risk                                       |
|                                                       |                                                                  | Changes to uniqueness, foreign keys, lifecycle, deletion, or retention |
|                                                       |                                                                  | Compatibility with existing production data                            |

#### Mandatory rule

Any issue requiring a database migration, production data modification, or recovery plan is **Level 3**.

---

### K. Shared types, schemas, and contracts

| Level 1                                                            | Level 2                                                          | Level 3                                                    |
| ------------------------------------------------------------------ | ---------------------------------------------------------------- | ---------------------------------------------------------- |
| Local internal type correction that cannot affect external callers | Shared type adjustment within one package and compatible callers | Request, response, event, or cross-service contract change |
| Test-only type correction                                          | Validation schema and its known callers must change together     | Breaking or versioned contract                             |
| Private implementation typing                                      | Backward-compatible shared schema extension                      | Contract ownership is unclear                              |
|                                                                    |                                                                  | Multiple independently deployed services must coordinate   |

---

### L. Cross-package and cross-service behaviour

| Level 1              | Level 2                                                                 | Level 3                                                       |
| -------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------- |
| Normally not Level 1 | Small interaction between two layers with a stable established contract | Coordinated changes across `spa/`, `api/`, and `auth-server/` |
|                      | SPA and API correction with no contract ambiguity                       | Ownership dispute between services                            |
|                      | One package consumes an existing shared utility incorrectly             | Distributed transaction or multi-service side effect          |
|                      |                                                                         | Cross-service failure recovery                                |
|                      |                                                                         | New communication pattern or service dependency               |

#### Practical rule

- One package → usually **Level 1 or 2**
- Two packages with an established contract → usually **Level 2**
- Several services or a changed contract → **Level 3**

---

### M. External integrations

| Level 1                               | Level 2                                        | Level 3                                                              |
| ------------------------------------- | ---------------------------------------------- | -------------------------------------------------------------------- |
| Text or styling around an integration | Bug using an established external API contract | New external provider or major provider migration                    |
| Development-only mock correction      | Error handling or adapter issue                | Payment, identity, messaging, storage, or other critical integration |
|                                       | Minor backward-compatible integration change   | Webhooks, retries, idempotency, security, or data ownership          |
|                                       |                                                | Provider outage or consistency strategy                              |
|                                       |                                                | Credentials, secrets, privacy, or compliance implications            |

---

### N. Configuration and environment variables

| Level 1                                 | Level 2                                                                | Level 3                                                |
| --------------------------------------- | ---------------------------------------------------------------------- | ------------------------------------------------------ |
| Typo in an example value or comment     | Existing environment variable used incorrectly in one package          | New secret or security-sensitive configuration         |
| Development-only non-functional cleanup | Addition of a non-sensitive variable following an established contract | Change affecting multiple environments or services     |
| Clearly obsolete unused setting         | CORS or runtime configuration bug with clear expected values           | Production deployment topology or environment contract |
|                                         | Package configuration and documentation must change together           | Breaking environment-variable rename                   |
|                                         |                                                                        | Configuration migration or backward compatibility      |

---

### O. Deployment, CI/CD, hosting, and operations

| Level 1                                   | Level 2                                                   | Level 3                                                            |
| ----------------------------------------- | --------------------------------------------------------- | ------------------------------------------------------------------ |
| Typo in workflow name or harmless comment | CI command, test job, cache, or build configuration issue | Production deployment failure                                      |
| Documentation-only correction             | One package fails in CI but architecture is unchanged     | Release strategy or hosting architecture change                    |
| Clearly unused workflow metadata          | Non-production preview or development environment issue   | Secrets, permissions, supply-chain security, or rollback behaviour |
|                                           | Known build configuration defect                          | Multi-environment or multi-service deployment coordination         |
|                                           |                                                           | Data migration during deployment                                   |
|                                           |                                                           | Significant downtime or backward-compatibility risk                |

Production operations issues should normally be **Level 3**.

---

### P. Testing issues

| Level 1                                             | Level 2                                             | Level 3                                                                     |
| --------------------------------------------------- | --------------------------------------------------- | --------------------------------------------------------------------------- |
| Incorrect assertion or fixture in one isolated test | Missing regression test for a normal multi-file bug | Test strategy across services or environments                               |
| Test description typo                               | Flaky integration test requiring flow investigation | Security, authorization, migration, or data-integrity testing               |
| Simple missing unit case                            | API or component integration coverage               | Unreliable test architecture affecting release confidence                   |
| Snapshot update with verified intended output       | New test setup within one package                   | Production-only issue that cannot be represented safely with existing tests |
| Obsolete test for removed local behaviour           | Contract test adjustment                            | Major end-to-end infrastructure change                                      |

Do not classify an issue as Level 1 merely because its title says “add a test.” Classify the behaviour being tested.

---

### Q. Refactoring and technical debt

| Level 1                          | Level 2                                                     | Level 3                                                                 |
| -------------------------------- | ----------------------------------------------------------- | ----------------------------------------------------------------------- |
| Rename a local private symbol    | Split or reorganize a large file within one package         | Change architectural boundaries                                         |
| Remove obviously dead local code | Extract reusable logic with known callers                   | Replace state management, routing, persistence, or service architecture |
| Small duplication removal        | Refactor one feature while preserving established behaviour | Broad cross-package refactor                                            |
| Local typing improvement         | Update several related components or services               | Introduce a new framework or major dependency                           |
| Formatting or lint cleanup       | Improve testability of a bounded flow                       | Rewrite critical infrastructure                                         |

Refactoring level depends on **blast radius**, not the number of lines changed.

---

### R. Performance issues

| Level 1                             | Level 2                                                                      | Level 3                                                    |
| ----------------------------------- | ---------------------------------------------------------------------------- | ---------------------------------------------------------- |
| Obvious unnecessary local rerender  | Slow query, repeated API call, caching defect, or large component bottleneck | System-wide performance architecture                       |
| One accidental repeated calculation | Performance issue within one package with measurable evidence                | Concurrency, rate limiting, queueing, or capacity planning |
| Clearly oversized local asset       | API or database optimization with no contract change                         | Changes that risk consistency or correctness               |
|                                     | Bundle-size or loading-flow investigation                                    | Production scalability or infrastructure redesign          |

Performance issues without measurements or reproduction evidence should not be treated as simple fixes.

---

### S. Concurrency, race conditions, retries, and idempotency

| Level 1                                         | Level 2                                               | Level 3                                                                         |
| ----------------------------------------------- | ----------------------------------------------------- | ------------------------------------------------------------------------------- |
| Rarely Level 1                                  | Local duplicate submission with a clear UI-only cause | Server-side race condition                                                      |
| Disable an already-defined action while pending | Established retry mechanism used incorrectly          | Idempotency, distributed operations, duplicate side effects                     |
|                                                 | One bounded asynchronous state defect                 | Data corruption, double notifications, duplicate records, or inconsistent state |
|                                                 |                                                       | Cross-service retry and failure recovery                                        |

Server-side concurrency and data-consistency issues are **Level 3**.

---

### T. Dependencies and tooling

| Level 1                                                 | Level 2                                                       | Level 3                                                                  |
| ------------------------------------------------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Development-only patch upgrade with no behaviour change | Normal dependency upgrade requiring code and test adjustments | Major framework or runtime upgrade                                       |
| Remove an unused development package                    | Build tooling change inside one package                       | Dependency with security or production compatibility implications        |
| Local lint configuration correction                     | Backward-compatible library migration                         | Major React, Node, database, authentication, or infrastructure migration |
| Formatting-tool update                                  | Package-level compiler or bundler change                      | Several packages or deployment environments must migrate together        |

---

### U. Security issues

| Level 1                      | Level 2                                                                             | Level 3                                                                                            |
| ---------------------------- | ----------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Pure wording or styling only | Security-adjacent issue proven not to affect actual protection may begin at Level 2 | Vulnerability, secret exposure, injection, XSS, CSRF, SSRF, permission bypass, or insecure storage |
|                              | Non-functional security documentation correction                                    | Dependency vulnerability requiring behavioural analysis                                            |
|                              |                                                                                     | Logging sensitive information                                                                      |
|                              |                                                                                     | Rate limiting or abuse prevention                                                                  |
|                              |                                                                                     | Security headers, token handling, cookies, CORS, or session behaviour                              |

#### Mandatory rule

Any issue describing a potential security vulnerability is **Level 3**.

---

## 4. Mandatory Level 3 triggers

An issue must be classified as **Level 3** when any of the following applies:

- Authentication or authorization behaviour may change.
- Privacy or personal-data visibility may change.
- A security vulnerability may exist.
- A database migration or production data repair may be required.
- Data loss or corruption is possible.
- A public, shared, or cross-service contract may change.
- Several independently owned services must change together.
- Architectural ownership is unclear.
- Expected product behaviour has multiple reasonable interpretations with significant consequences.
- Production deployment, rollback, secrets, or infrastructure are affected.
- The issue involves server-side concurrency, idempotency, or distributed side effects.
- The change may break backward compatibility.
- The issue affects payments, identity, legal consent, data deletion, or account recovery.
- Resolving it requires changing an accepted architectural decision.
- The blast radius cannot be reasonably established through a standard investigation.

These triggers override the issue category and apparent size.

---

## 5. Level 1 qualification checklist

Use Level 1 only when **all** of the following are true:

- Expected behaviour is explicit and unambiguous.
- The issue is localized to one feature or small area.
- No public or shared contract changes.
- No authentication, authorization, security, privacy, or sensitive-data implications.
- No database schema or production-data changes.
- No significant deployment or environment implications.
- The likely implementation is easy to reverse.
- Focused unit, component, or manual validation is sufficient.
- The investigation can identify the cause without tracing a broad application flow.

If one or more conditions fail, use at least Level 2.

---

## 6. Level 2 qualification checklist

Use Level 2 when:

- The issue is a normal engineering bug or incomplete implementation.
- Several files or layers may be involved.
- Ownership remains within one primary package or one established integration.
- Expected behaviour is clear or can be established from existing evidence.
- Contracts are already established and are not expected to change materially.
- No mandatory Level 3 trigger applies.
- Regression coverage can be defined using existing test infrastructure.
- The smallest safe implementation boundary can be established without an architectural decision.

Level 2 should be the default when the issue is neither obviously trivial nor clearly high-risk.

---

## 7. Classification decision tree

Use the following order:

### Question 1

Does the issue involve security, authentication, authorization, privacy, sensitive data, migrations, data integrity, public contracts, production infrastructure, or architectural ownership?

- **Yes** → Level 3
- **No** → Continue

### Question 2

Does the issue require coordinated changes across several packages or services, or does it contain an unresolved product decision with meaningful consequences?

- **Yes** → Level 3
- **No** → Continue

### Question 3

Is the issue clearly localized, low-risk, reversible, and unambiguous?

- **Yes** → Level 1
- **No** → Continue

### Question 4

Can the issue be handled within one primary package or one established frontend/backend flow using existing contracts?

- **Yes** → Level 2
- **No or uncertain** → Level 3

---

## 8. Borderline examples

| Issue                                                              | Classification                            | Reason                                                        |
| ------------------------------------------------------------------ | ----------------------------------------- | ------------------------------------------------------------- |
| Change padding on one button                                       | Level 1                                   | Localized and low-risk                                        |
| Change padding on every button through the design system           | Level 2                                   | Shared component and broad visual impact                      |
| Redesign the global component system                               | Level 3                                   | Architectural and application-wide                            |
| Fix typo in privacy modal                                          | Level 1, when wording is already approved | Copy-only change                                              |
| Decide what information the privacy modal must disclose            | Level 3                                   | Product, privacy, and possibly legal decision                 |
| Correct one API response mapping in the SPA                        | Level 2                                   | Frontend/API interaction with established contract            |
| Change the API response shape                                      | Level 3                                   | Shared contract and compatibility impact                      |
| Add a missing unit test                                            | Depends on tested behaviour               | Classify the underlying behaviour                             |
| Fix button that submits twice because the UI lacks a pending state | Level 2                                   | Asynchronous flow involving behaviour and regression coverage |
| Fix duplicate records caused by concurrent server requests         | Level 3                                   | Data integrity and idempotency                                |
| Correct a development environment variable example                 | Level 1                                   | Documentation-only and low-risk                               |
| Rename a production environment variable across services           | Level 3                                   | Deployment and compatibility risk                             |
| Fix a redirect after successful login                              | Usually Level 2                           | Could be localized, but authentication context requires care  |
| Change who is allowed to access the redirected page                | Level 3                                   | Authorization behaviour                                       |
| Split a large React component without changing behaviour           | Level 2                                   | Multi-file refactor within one package                        |
| Redesign frontend architecture during the split                    | Level 3                                   | Architectural scope                                           |
| Fix a query returning records in the wrong order                   | Level 2                                   | Backend behaviour with established schema                     |
| Change ownership relationships between records                     | Level 3                                   | Data model and product contract                               |

---

## 9. Team classification procedure

For every new implementation, bug, refactoring, or technical-debt issue, record at minimum:

```text
Proposed investigation level:
Classification reason:
```

Include the following fields when they are relevant to the classification or when the issue is Level 2 or Level 3:

```text
Primary affected area:
Expected behaviour clear: Yes / No
Packages or services involved:
Contract change expected: Yes / No / Unknown
Security, privacy, authorization, or data risk: Yes / No / Unknown
Migration or production-data impact: Yes / No / Unknown
```

The agent or person creating the issue proposes the initial level.

The classification is provisional. The investigating agent must validate it before completing the investigation.

A human maintainer may override the classification at any time.

---

## 10. Escalation and downgrade rules

### Escalation

Escalation is mandatory when new evidence shows that:

- the scope is broader than expected;
- expected behaviour is unclear;
- a contract must change;
- another package or service owns part of the behaviour;
- risk to security, privacy, authorization, data, or production exists;
- an architectural decision is needed.

A Level 1 investigation may escalate to Level 2 or Level 3.

A Level 2 investigation may escalate to Level 3.

### Downgrade

The investigator may report that the issue appears simpler than initially classified, but should not stop solely to request a lower-level prompt.

Using a higher level than necessary wastes some investigation time but does not reduce safety.

### No silent reclassification

The investigator must state:

- the original selected level;
- the recommended level;
- the evidence supporting the change.

---

## 11. Final operating rule

Use this default:

- **Clearly small, local, and unambiguous** → Level 1
- **Normal software issue or any uncertainty** → Level 2
- **High-risk, cross-service, contract-changing, data-sensitive, security-sensitive, architectural, or product-ambiguous** → Level 3

When two levels appear reasonable, select the higher level.
