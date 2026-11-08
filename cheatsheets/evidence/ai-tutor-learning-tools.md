# Evidence: cheatsheets/ai-tutor-learning-tools.md

Abbreviations: L17 = phases/19-capstone-projects/17-personal-ai-tutor (c = code/main.py, d = docs/en.md, tsr = code/ts/README.md). SC = projects/source-grounded-study-coach, PF = projects/community-learning-path-finder, VP = projects/vocabulary-autocomplete-pad, WM = projects/workshop-materials-planner. s = solution.

## What each project builds (comparison, 6 rows)
- Builds: SC/README.md:3-5, PF/README.md:3, VP/README.md:3-5, WM/README.md:3
- Runtime: SC/README.md:9, PF/README.md:5, VP/README.md:9, WM/README.md:5
- Input: SC/README.md:5, PF/README.md:31, VP/s/main.ts:29-31, WM/README.md:31
- Output: SC/s/main.ts:375-378, PF/README.md:31, VP/s/cli.ts:22-24, WM/README.md:31
- Review loop: SC/README.md:32-37, PF/README.md:31, VP/s/main.ts:175 with VP/README.md:40, WM/README.md:31
- Limit: SC/README.md:55, PF/README.md:37, VP/README.md:48, WM/README.md:37

## Run and grade (command-table, 8)
- --init, first stage fails: PF/README.md:10, 14, VP/README.md:21, 26
- --stage 1 --path --strict: PF/README.md:11, VP/README.md:22
- --all --solution --strict: SC/README.md:20, PF/README.md:25, WM/README.md:25
- node --experimental-strip-types main.ts ... --out ./study-output: SC/README.md:29
- python3 cli.py samples/input.json --output demo-output: PF/README.md:27, WM/README.md:27
- node cli.ts sample.json output, output/report.html: VP/README.md:13, 16
- python main.py, simulated efficacy study: L17/c:9, 184
- npm run serve on :8090: L17/tsr:29

## One tutor turn (flow, 8)
1. next_concept with master_threshold 0.85 and prereqs met: L17/c:87-94
2. difficulty 0.3 + 0.1 per prereq: L17/c:140
3. scaffold -0.15, hint -0.08: L17/c:142-145
4. sigmoid(knowledge - difficulty): L17/c:119-122
5. correct and m > 0.8 celebrate_and_advance: L17/c:103-104
6. correct reinforce_and_next_question, m > 0.5 hint: L17/c:105-108
7. else scaffold_from_prereq: L17/c:109
8. bkt_update with learn transition: L17/c:154, 38-40

## BKT update (annotated-code, 9 lines)
- BKTParams four fields: L17/c:24-28
- correct branch: L17/c:32-34
- wrong branch: L17/c:35-37
- posterior with max(denom, 1e-6): L17/c:38
- learn transition: L17/c:40

## Study coach loop (architecture, 7 nodes)
- deck.json default path: SC/s/main.ts:466
- attempts.json default path: SC/s/main.ts:473
- validateDeck, answer must occur in evidence: SC/s/main.ts:30, 72-73
- buildProgress box and due: SC/s/main.ts:128, 164-186
- exportPractice writes progress.json and index.html: SC/s/main.ts:350, 375-378
- index.html reveal and record: SC/s/main.ts:328, SC/README.md:32
- page download of attempts.json: SC/s/main.ts:300, SC/README.md:32-37

## Project functions (task-table, 8)
- gradeAnswer(deck, cardId, response): SC/s/main.ts:92
- dueCards(progress, date): SC/s/main.ts:190
- path_for(index, target, completed=None): PF/API.md:16
- rank_paths(index, goals, budget, completed=None): PF/API.md:24
- suggest signature: VP/README.md:36
- importModel(value: unknown): VP/README.md:38
- scale(model, participants=None): WM/API.md:16
- shortages(model, participants=None): WM/API.md:24

## Rules in code (concepts, 8)
- normalizeAnswer NFKC, lower case, trim, end punctuation: SC/s/main.ts:83-90, exact match 98-100
- box Math.min(5, box + 1) or 0: SC/s/main.ts:179
- interval 2 ** (state.box - 1) or 1, 86400000 ms: SC/s/main.ts:180-181
- path rank order: PF/API.md:27
- score order * 1000000 + count: VP/s/main.ts:74, sort 80-86
- quantity*participants: WM/API.md:19
- quantity*ceil(participants/share): WM/API.md:19
- unconvertible inventory leaves shortage unknown: WM/API.md:27

## Defaults and numbers (defaults, 8)
- p_init 0.2: L17/c:25
- p_learn 0.12: L17/c:26
- p_slip 0.10, p_guess 0.15: L17/c:27-28
- master_threshold 0.85: L17/c:88
- at most 18 resources: PF/API.md:11
- suggest limit = 5, 0..50: VP/s/main.ts:53-56
- compare [8, 12]: WM/s/cli.py:15
- n_turns 60, n_learners 10: L17/c:189-190

## Errors and fixes (troubleshooting, 8)
- Canonical answer must occur in the evidence quote: SC/s/main.ts:72-73, UTF-16 offsets SC/README.md:55
- Conflicting duplicate attempt ID: SC/s/main.ts:153-155
- Proposal lacks verbatim answer evidence: SC/s/main.ts:425-428, never silently added SC/README.md:57
- prerequisite cycle: PF/s/main.py:29-30
- stale progress, fingerprint binds inputs: PF/s/main.py:147-160
- complete prerequisites first: PF/s/main.py:164-166
- inconsistent conversion cycle: WM/s/main.py:28-30
- Unsupported model schema: VP/s/main.ts:122

## Abbreviations (glossary, 5)
- BKT: L17/d:143
- FSRS, better than SM-2: L17/d:144
- DAG, concept graph: L17/d:145, L17/tsr:14
- COPPA under 13: L17/d:148
- OER per node: L17/d:81

## Questions (qa, 5)
- leading question: L17/d:19, 142
- 10 learners, two weeks, pre/post: L17/d:23, 119
- authored questions, exact matching: SC/README.md:55
- card-proposal.json for review: SC/README.md:57
- never infer density or package size: WM/API.md:27

## Tips (tips, 6)
- 50-150 concept nodes: L17/d:81
- non-adaptive baseline: L17/d:23
- auto-delete after 1 year, learner ID scope: L17/d:87, 93
- review date to --date: SC/README.md:40
- second set of examples: SC/README.md:63
- reload discards attempts: SC/README.md:32
