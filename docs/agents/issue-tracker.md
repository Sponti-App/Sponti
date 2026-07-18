# Issue tracker: GitHub

Issues and PRDs for this repo live as GitHub issues in `Sponti-App/Sponti`. Use the `gh` CLI for all operations.

## Conventions

- **Create an issue**: `gh issue create --title "..." --body "..."`. Use a heredoc for multi-line bodies.
- **Read an issue**: `gh issue view <number> --comments`, filtering comments by `jq` and also fetching labels.
- **List issues**: `gh issue list --state open --json number,title,body,labels,comments --jq '[.[] | {number, title, body, labels: [.labels[].name], comments: [.comments[].body]}]'` with appropriate `--label` and `--state` filters.
- **Comment on an issue**: `gh issue comment <number> --body "..."`
- **Apply / remove labels**: `gh issue edit <number> --add-label "..."` / `--remove-label "..."`
- **Close**: `gh issue close <number> --comment "..."`

Infer the repo from `git remote -v` — `gh` does this automatically when run inside a clone.

## Investigation classification

Before creating an implementation, bug, refactoring, or technical-debt issue:

1. Read the [Issue Investigation Level Classification Standard](./issue-investigation-levels.md).
2. Classify the issue as Level 1, Level 2, or Level 3.
3. Apply exactly one corresponding label:
   - `investigation:level-1`
   - `investigation:level-2`
   - `investigation:level-3`
4. Include the proposed level and a concise classification reason in the issue body.
5. Use Level 2 when the issue is neither clearly Level 1 nor clearly Level 3.
6. Select the higher level when two levels appear equally reasonable.

The initial classification is provisional. The agent performing the investigation must validate it.

If the investigation establishes that another level is required:

- Replace the current investigation-level label.
- Do not leave multiple investigation-level labels on the issue.
- Explain the original level, the new level, and the evidence supporting the reclassification in the investigation report.
- Do not modify unrelated labels.

Investigation-level labels may coexist with workflow labels such as `needs-triage`, `needs-info`, `ready-for-agent`, and `ready-for-human`.

## Issue creation behaviour

Issue creation is a capture and triage operation. It does not authorize investigation or implementation.

When the user asks to create an issue and provides enough information to identify the affected behaviour, current result, and expected result:

- Create the GitHub issue without asking for additional confirmation.
- Apply `needs-triage` unless another documented workflow status is clearly justified.
- Apply exactly one investigation-level label.
- Include the proposed investigation level and a concise classification reason in the issue body.
- Do not apply `ready-for-agent` unless the issue has already been investigated, sufficiently specified, and explicitly approved for that status.
- Return the issue URL, applied labels, proposed investigation level, and classification reason.

When important information is missing:

- Ask only the focused questions needed to make the issue understandable and accurate.
- Ask about the affected screen or behaviour, what currently happens, and what should happen.
- Do not require the user to identify source files or implementation details.
- Do not perform a full repository investigation merely to create the issue unless the user explicitly requests one.

When the user explicitly wants the issue recorded before the missing information can be provided:

- Create the issue with `needs-info` instead of `needs-triage`.
- Apply a provisional investigation-level label based on the available evidence.
- Add a visible `## Missing information` section to the issue body.
- State clearly that the issue is incomplete and cannot be considered ready for investigation or implementation until the missing information is supplied.
- List the exact questions or facts still required.
- Do not invent expected behaviour, implementation details, acceptance criteria, affected files, or reproduction steps.
- Return the issue URL and explicitly confirm that `needs-info` was applied.
- Repeat the missing information in the response so the user knows what must be provided later.

Use this structure in the issue body when `needs-info` is applied:

```md
## Missing information

This issue was created before all required details were available. It is labeled
`needs-info` and is not ready for investigation or implementation yet.

Information still required:

- [Missing fact or focused question]
- [Missing fact or focused question]
```

The `needs-info` label and the `## Missing information` section are intentionally redundant. The label supports filtering and automation, while the issue-body section keeps the incomplete status visible to readers who do not review labels.

## Applying the investigation label

When creating an issue, include the selected investigation label:

```bash
gh issue create \
  --title "..." \
  --body "..." \
  --label "needs-triage" \
  --label "investigation:level-2"
```

When reclassifying an existing issue, remove the previous level label before applying the new one:

```bash
gh issue edit <number> \
  --remove-label "investigation:level-1" \
  --add-label "investigation:level-2"
```

Use the exact label vocabulary documented in [Triage Labels](./triage-labels.md).

## When a skill says "publish to the issue tracker"

Create a GitHub issue.

## When a skill says "fetch the relevant ticket"

Run `gh issue view <number> --comments`.
