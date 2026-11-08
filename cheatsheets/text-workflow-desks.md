---
id: text-workflow-desks
title: Text Workflow Desks
code: TW
subtitle: Triage email, extract actions, rewrite prose, group feedback and write changelogs. Every output waits for review.
hue: 200
sources: projects/inbox-triage-desk, projects/meeting-notes-to-actions, projects/plain-language-rewrite-desk, projects/feedback-theme-board, projects/changelog-writer-from-git
source_hash: 9a0e9b97988adf97
---

## What each desk builds
type: concepts
from: projects/inbox-triage-desk/README.md, projects/meeting-notes-to-actions/README.md, projects/plain-language-rewrite-desk/README.md, projects/feedback-theme-board/README.md, projects/changelog-writer-from-git/README.md

- **Inbox triage desk**: .eml folder in. index.html, triage.json and unsent .eml drafts out.
- **Meeting notes to actions**: notes.txt in. actions.json, actions.html and approved.csv out.
- **Plain language rewrite desk**: prose JSON in. Accepted Markdown and revision-decisions.json out.
- **Feedback theme board**: JSONL feedback and themes in. Evidence board and issue drafts out.
- **Changelog writer from Git**: a Git range in. release.md and a release.json receipt out.
- **Runtimes**: Python 3.10 for inbox and meeting. Node 22.18 for rewrite. Go 1.22 for changelog.

## Run each desk
type: command-table
span: 2
from: projects/inbox-triage-desk/README.md, projects/meeting-notes-to-actions/README.md, projects/plain-language-rewrite-desk/README.md, projects/feedback-theme-board/README.md, projects/changelog-writer-from-git/README.md

| Command | What it does |
|---|---|
| `python3 scripts/project_test.py <project> --init <workspace>` | Makes a workspace. The first stage fails |
| `python3 scripts/project_test.py <project> --all --solution --strict` | Checks the reference solution |
| `python3 main.py --input ./fixtures --out ./inbox-output` | Builds the inbox review desk |
| `python3 cli.py samples/notes.txt --today 2026-09-29 --output actions.json --html actions.html --csv approved.csv` | Proposes actions. Exports approved rows only |
| `node cli.ts sample.json output` | Compares rewrites. Writes output/report.html |
| `node cli.ts sample.jsonl themes.json output` | Groups feedback into themes |
| `go run .` | Writes a changelog from a two-commit fixture |

## Inbox desk pipeline
type: architecture
from: projects/inbox-triage-desk/solution/main.py, projects/inbox-triage-desk/README.md

```arch
node | eml | 1,1 | .eml folder | at most 1 MB each | store
node | parse | 2,1 | parse_message | plain body, Message-ID | process
node | group | 3,1 | group_threads | References and In-Reply-To | process
node | tri | 4,1 | triage | phrase rules plus evidence | process
node | draft | 4,2 | build_draft | X-Unsent reply | process
node | desk | 3,2 | index.html | sorted by priority | client
node | json | 2,2 | triage.json | threads and entries | store
edge | eml | parse |
edge | parse | group |
edge | group | tri |
edge | tri | draft |
edge | draft | desk |
edge | desk | json |
```

## Meeting review loop
type: flow
from: projects/meeting-notes-to-actions/solution, projects/meeting-notes-to-actions/API.md, projects/meeting-notes-to-actions/README.md

1. **parse_notes**: read `ACTION owner | due | task` lines with line numbers.
2. **proposals**: add `NAME will TASK by YYYY-MM-DD` lines as proposals.
3. **validate_action**: "?" owner or due adds `needs_owner` or `needs_date`.
4. **deduplicate**: casefold owner, due and task. Merge their source lines.
5. **inbox**: give each action a 16 hex id from SHA-256.
6. **Reviewer**: choose pending, approved or rejected. Download decisions.json.
7. **Rerun**: `--decisions decisions.json` exports approved complete actions only.

## Changelog from a Git range
type: annotated-code
lang: bash
from: projects/changelog-writer-from-git/README.md, projects/changelog-writer-from-git/solution/main.go, projects/changelog-writer-from-git/solution/integration.go

```bash
cd projects/changelog-writer-from-git/solution
go run . --repo <path> --from <rev> --to HEAD    # immutable range
go run . --input <file>                          # NUL-delimited export
git log --format=%H%x00%s%x00%b%x00 FROM..TO     # the export format
go run . --output release.md --receipt release.json  # reusable files
```

## Project functions
type: task-table
from: projects/inbox-triage-desk/solution/main.py, projects/meeting-notes-to-actions/API.md, projects/plain-language-rewrite-desk/README.md, projects/feedback-theme-board/solution/main.ts, projects/changelog-writer-from-git/solution

| Task | Code |
|---|---|
| Classify one message | `triage(message, rules)` |
| Write an unsent reply | `build_draft(message: dict, decision: dict)` |
| Publish the checklist | `publish(actions, today)` |
| Measure a paragraph | `measures(text:string)` |
| Export accepted text | `exportRevisions(comparisons,value?)` |
| Match a phrase span | `findEvidence(row: Feedback, phrase: string)` |
| Build the theme board | `buildBoard(rows: Feedback[], themes: Theme[])` |
| Render release notes | `Release(label string, commits []Commit, max int)` |

## Baseline and model option
type: comparison
from: projects/inbox-triage-desk/README.md, projects/meeting-notes-to-actions/API.md, projects/plain-language-rewrite-desk/README.md, projects/feedback-theme-board/README.md, projects/feedback-theme-board/solution/cli.ts

| Factor | Inbox | Meeting | Rewrite | Feedback |
|---|---|---|---|---|
| Baseline | Explicit phrase rules | ACTION lines | Phrase substitutions | Word phrases |
| Model option | `--provider-url` | None | Recorded proposals | `--suggest` |
| Model output | model-proposals.json | None | Author proposal | themes.proposed.json |
| Review gate | Every draft needs review | Explicit decision | Author accepts | Review before use |
| Never does | Send replies | Post tasks | Prove meaning | Post to a tracker |

## Defaults and limits
type: defaults
from: projects/changelog-writer-from-git/solution/main.go, projects/inbox-triage-desk/solution/main.py, projects/feedback-theme-board/solution/main.ts, projects/feedback-theme-board/solution/cli.ts, projects/plain-language-rewrite-desk/solution/main.ts

| Setting | Default | Note |
|---|---|---|
| Label flag | v0.2.0 | Release title |
| To flag | HEAD | Inclusive end revision |
| Commits per release | 1000 | More gives budget exceeded |
| Inbox `--model` | local-model | Optional provider only |
| Message size | 1 MB | Per .eml file |
| Feedback input | 2 MB | At most 10000 records |
| Model theme input | 50 | Feedback records for `--suggest` |
| Long word | 8 | More letters count as long |

## Errors and fixes
type: troubleshooting
from: projects/inbox-triage-desk/solution/main.py, projects/inbox-triage-desk/README.md, projects/meeting-notes-to-actions/solution/cli.py, projects/meeting-notes-to-actions/API.md, projects/plain-language-rewrite-desk/solution/main.ts, projects/feedback-theme-board/solution/main.ts, projects/changelog-writer-from-git/solution, projects/changelog-writer-from-git/README.md

| Symptom | Cause | Fix |
|---|---|---|
| "Conflicting duplicate Message-ID" | Two files share an id | Keep one copy of the message |
| Category is uncertain | Rules conflict or none match | Edit the phrases in `--rules` |
| Body status `no-plain-body` | HTML-only message | Review it by hand |
| "unknown or stale action ids" | Source lines changed | Regenerate the inbox. Review again |
| "cannot approve missing owner or due date" | Owner or due is "?" | Fill it in the notes |
| "Resolve factual issues before accepting" | Numbers or protected terms changed | Fix the proposal first |
| "Provide 1 to 30 themes" | Theme list is empty or long | Keep 1 to 30 themes |
| "changelog: budget exceeded" | Range has over 1000 commits | Narrow `--from` and `--to` |

## Rules in code
type: concepts
from: projects/inbox-triage-desk/solution/main.py, projects/plain-language-rewrite-desk/solution/main.ts, projects/feedback-theme-board/solution/main.ts, projects/changelog-writer-from-git/solution

- **Triage priority**: action 0, uncertain 1, information 2.
- **Action phrases**: please, can you, could you, confirm.
- **Rewrites**: "in order to" to "to", "utilize" to "use", "prior to" to "before".
- **Duplicates**: same source and NFKC lower-case text count once.
- **Theme order**: most distinct sources first, then id.
- **Groups**: Breaking changes, Features, Fixes, Other.
- **Breaking**: a `BREAKING CHANGE:` footer or `!` after the type.
- **Revert**: "This reverts commit" with a 40 hex id.

## Questions
type: qa
from: projects/inbox-triage-desk/README.md, projects/meeting-notes-to-actions/API.md, projects/plain-language-rewrite-desk/README.md, projects/feedback-theme-board/README.md, projects/changelog-writer-from-git/README.md

- **Does the inbox desk send mail?** No. It never connects to a mailbox.
- **What stays unassigned in notes?** Suggestions outside the two grammars.
- **Do the rewrite checks prove facts?** No. They are lexical safeguards. The author reviews meaning.
- **Do source counts measure demand?** No. Labels are not verified people or market size.
- **Which hash does the changelog support?** SHA-1 commit IDs. SHA-256 needs an extension.

## Tips
type: tips
from: projects/inbox-triage-desk/README.md, projects/meeting-notes-to-actions/README.md, projects/feedback-theme-board/README.md, projects/changelog-writer-from-git/README.md

- Write down the expected result before you run your own export.
- Keep the input beside the output so others can reproduce it.
- Read the JSON receipt and test one new input before you integrate.
- Remote providers need HTTPS. HTTP works only for loopback.
- Read integration.go after the core stages.
