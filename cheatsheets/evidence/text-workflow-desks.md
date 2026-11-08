# Evidence: cheatsheets/text-workflow-desks.md

Abbreviations: IT = projects/inbox-triage-desk, MN = projects/meeting-notes-to-actions, PL = projects/plain-language-rewrite-desk, FB = projects/feedback-theme-board, CW = projects/changelog-writer-from-git. s = solution.

## What each desk builds (concepts, 6)
- Inbox: .eml in, HTML desk, triage.json, unsent .eml drafts: IT/README.md:5
- Meeting: notes.txt to actions.json, actions.html, approved.csv: MN/README.md:33
- Rewrite: accepted Markdown, HTML comparison, revision-decisions.json: PL/README.md:5, sample.json input PL/README.md:13
- Feedback: evidence board, JSON summary, Markdown drafts: FB/README.md:3-5, FB/README.md:13
- Changelog: Git range, release.md and release.json: CW/README.md:3, 33
- Runtimes Python 3.10, Node 22.18, Go 1.22: IT/README.md:9, MN/README.md:5, PL/README.md:9, CW/README.md:9

## Run each desk (command-table, 7)
- --init, first stage fails: IT/README.md:18, 23, PL/README.md:21, 26
- --all --solution --strict: IT/README.md:20, MN/README.md:31
- python3 main.py --input ./fixtures --out ./inbox-output: IT/README.md:29
- cli.py samples/notes.txt --today 2026-09-29 ...: MN/README.md:33, three proposals and zero approved MN/README.md:38
- node cli.ts sample.json output, output/report.html: PL/README.md:13, 16
- node cli.ts sample.jsonl themes.json output: FB/README.md:13
- go run ., two-commit fixture: CW/README.md:30, 33

## Inbox desk pipeline (architecture, 7 nodes)
- .eml folder, 1 MB limit: IT/s/main.py:17, 22-23
- parse_message plain body and Message-ID: IT/s/main.py:21, 28-41
- group_threads by References and In-Reply-To: IT/s/main.py:42-45, 56-82
- triage phrase rules with evidence: IT/s/main.py:86-135
- build_draft with X-Unsent: IT/s/main.py:138, 168
- index.html sorted by priority: IT/s/main.py:289-290, 311
- triage.json threads and entries: IT/s/main.py:292-298

## Meeting review loop (flow, 7)
1. ACTION lines with line numbers: MN/s/main.py:10-18
2. NAME will TASK by YYYY-MM-DD proposals: MN/s/cli.py:14-31, MN/API.md:7
3. "?" flags needs_owner and needs_date: MN/s/main.py:42-45
4. casefold dedupe, merge lines: MN/s/main.py:57-61
5. id sha256 hexdigest()[:16]: MN/s/cli.py:40-45
6. pending, approved or rejected, decisions.json: MN/API.md:5, MN/README.md:38
7. --decisions exports approved complete actions only: MN/README.md:38

## Changelog from a Git range (annotated-code, 5 lines)
- cd solution: CW/README.md:29
- --repo PATH --from REV --to REV: CW/README.md:33, default to HEAD CW/s/main.go:15
- --input FILE, NUL-delimited: CW/README.md:33, CW/s/main.go:16
- git log --format=%H%x00%s%x00%b%x00 FROM..TO: CW/README.md:33
- --output release.md --receipt release.json: CW/README.md:33

## Project functions (task-table, 8)
- triage(message, rules): IT/s/main.py:86
- build_draft(message: dict, decision: dict): IT/s/main.py:138
- publish(actions, today): MN/API.md:15
- measures(text:string): PL/README.md:37
- exportRevisions(comparisons,value?): PL/README.md:38
- findEvidence(row: Feedback, phrase: string): FB/s/main.ts:39
- buildBoard(rows: Feedback[], themes: Theme[]): FB/s/main.ts:51
- Release(label string, commits []Commit, max int): CW/s/stage4.go:9

## Baseline and model option (comparison, 5 rows)
- Baseline: IT/README.md:47, MN/API.md:7, PL/README.md:48, FB/README.md:45
- Model option: IT/README.md:49, PL/README.md:48, FB/s/cli.ts:41, 47
- Model output: IT/README.md:49, PL/README.md:48, FB/s/cli.ts:49
- Review gate: IT/README.md:49, MN/README.md:3, PL/README.md:48, FB/README.md:45
- Never does: IT/README.md:47, MN/API.md:7, PL/README.md:48, FB/README.md:45

## Defaults and limits (defaults, 8)
- label v0.2.0: CW/s/main.go:17
- to HEAD: CW/s/main.go:15
- 1000 commits, budget exceeded: CW/s/main.go:42, CW/s/stage4.go:13-14, CW/s/types.go:6
- --model local-model: IT/s/main.py:327
- 1 MB per message: IT/s/main.py:17, 23
- 2 MB and 10000 records: FB/s/main.ts:10, 20
- 50 records for --suggest: FB/s/cli.ts:10
- longWords x.length > 8: PL/s/main.ts:99

## Errors and fixes (troubleshooting, 8)
- Conflicting duplicate Message-ID: IT/s/main.py:59-61
- uncertain on conflicting rules or no match, --rules: IT/s/main.py:116-126, 325
- no-plain-body, HTML-only for manual review: IT/s/main.py:52, IT/README.md:5
- unknown or stale action ids, regenerate: MN/s/cli.py:47-49, MN/API.md:5
- cannot approve missing owner or due date: MN/s/cli.py:54-55
- Resolve factual issues before accepting: PL/s/main.ts:167-168, issue checks PL/s/main.ts:119-130
- Provide 1 to 30 themes: FB/s/main.ts:26
- changelog: prefix and budget exceeded: CW/s/main.go:57, CW/s/types.go:6, range flags CW/README.md:33

## Rules in code (concepts, 8)
- priority action 0, uncertain 1, information 2: IT/s/main.py:130
- action phrases: IT/s/main.py:91
- rewrites in order to, utilize, prior to: PL/s/main.ts:66-69
- duplicate key source plus NFKC lower text: FB/s/main.ts:58-59
- theme order distinctSources then id: FB/s/main.ts:72
- groups Breaking changes, Features, Fixes, Other: CW/s/stage4.go:22, CW/s/stage3.go:12-19
- BREAKING CHANGE: footer or !: CW/s/integration.go:52, CW/s/stage2.go:9, 21
- This reverts commit with 40 hex: CW/s/integration.go:63

## Questions (qa, 5)
- never connects to mailbox or sends replies: IT/README.md:47
- unstructured suggestions stay unassigned: MN/API.md:7
- lexical safeguards, author reviews meaning: PL/README.md:48
- labels not verified people or market size: FB/README.md:45
- SHA-1 supported, SHA-256 needs extension: CW/README.md:33

## Tips (tips, 5)
- write down the expected result: IT/README.md:55
- keep input beside output: MN/README.md:40
- read JSON receipt and test a new input: FB/README.md:47
- HTTPS for remote, HTTP for loopback: IT/README.md:49
- read integration.go after core stages: CW/README.md:35
