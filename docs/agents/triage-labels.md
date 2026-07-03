# Triage Labels

The skills speak in terms of five canonical triage roles. This file maps those roles to the actual label strings used in this repo's issue tracker.

| Label in mattpocock/skills | Label in our tracker | Meaning                                  |
| -------------------------- | -------------------- | ---------------------------------------- |
| `needs-triage`             | `needs-triage`       | Maintainer needs to evaluate this issue  |
| `needs-info`               | `needs-info`         | Waiting on reporter for more information |
| `ready-for-agent`          | `ready-for-agent`    | Fully specified, ready for an AFK agent  |
| `ready-for-human`          | `ready-for-human`    | Requires human implementation            |
| `wontfix`                  | `wontfix`            | Will not be actioned                     |

When a skill mentions a role (e.g. "apply the AFK-ready triage label"), use the corresponding label string from this table.

Edit the right-hand column to match whatever vocabulary you actually use.

## Investigation level labels

Every implementation, bug, refactoring, and technical-debt issue must have exactly one investigation-level label.

| Label                   | Color     | Meaning                                                                                                                                             |
| ----------------------- | --------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `investigation:level-1` | `#F8B187` | Lightweight investigation for a localized, low-risk, and clearly defined issue                                                                      |
| `investigation:level-2` | `#B86B45` | Standard investigation for a normal multi-file issue or established integration                                                                     |
| `investigation:level-3` | `#3A2418` | Deep investigation for a high-risk, cross-service, architectural, security-sensitive, privacy-sensitive, data-sensitive, or product-ambiguous issue |

The labels describe the required investigation depth. They do not represent priority, severity, urgency, or implementation effort.

Investigation-level labels are mutually exclusive:

- Every applicable issue must have exactly one investigation-level label.
- Never apply multiple investigation-level labels to the same issue.
- When an issue is reclassified, remove the previous level label before applying the new one.
- Status labels such as `needs-triage`, `needs-info`, `ready-for-agent`, and `ready-for-human` may coexist with an investigation-level label.

Use the [Issue Investigation Level Classification Standard](./issue-investigation-levels.md) to select the correct label.

### Repository label setup

Create or synchronize the investigation labels with:

```bash
gh label create "investigation:level-1" \
  --description "Lightweight investigation: localized, low-risk, and clearly defined" \
  --color F8B187 \
  --repo Sponti-App/Sponti \
  --force

gh label create "investigation:level-2" \
  --description "Standard investigation: multiple files or an established integration" \
  --color B86B45 \
  --repo Sponti-App/Sponti \
  --force

gh label create "investigation:level-3" \
  --description "Deep investigation: high-risk, cross-service, architectural, or sensitive" \
  --color 3A2418 \
  --repo Sponti-App/Sponti \
  --force
```

The `--color` value uses six hexadecimal characters without the leading `#`.

The `--force` option updates the description and color when a label with the same name already exists.
