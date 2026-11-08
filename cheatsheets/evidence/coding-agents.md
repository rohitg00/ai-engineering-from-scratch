# Evidence: cheatsheets/coding-agents.md

Abbreviations: L09 = phases/15-autonomous-systems/09-coding-agent-landscape. C01 = phases/19-capstone-projects/01-terminal-native-coding-agent, C09 = .../09-code-migration-agent, C16 = .../16-github-issue-to-pr-agent, C29 = .../29-end-to-end-coding-task-demo. TCA = projects/tiny-coding-agent, RAS = projects/rust-agent-shell, PRR = projects/pr-review-reporter. d = docs/en.md, c = code/main.py.

## JSON tool calls vs CodeAct (comparison, 6 rows)
- one action is one JSON payload vs whole program: L09/d:39-40, 106
- audit easy, one action per turn vs blast radius: L09/d:39-40, L09/c:170-173
- composition limited vs loop over files, chain tools, catch exceptions: L09/d:35, 39-40
- validator on each call vs hardened sandbox: L09/d:39-40
- toy blast radius 1 vs every failing file at once: L09/c:88-89, 114, 121-129
- managed services vs open platforms: L09/d:42

## Three capstone agents (comparison, 7 rows)
- trigger: agent run <repo> "<task>" C01/d:71. label @agent fix this C16/d:13, 76. migrate ... --target java17 C09/d:91
- sandbox: E2B or Daytona with git worktree C01/d:21. Daytona or E2B per task C16/d:19, 61. Daytona per branch C09/d:35, 59
- turn cap: 50 turns C01/d:83. 30 agent turns C16/d:82. 20 agent turns C09/d:21, 78
- cost cap: $5 per task C01/d:83. $20 per PR, max 5 PRs per repo per day C16/d:23. $8 per repo C09/d:21
- other cap: 200k context C01/d:83. 30 min wall-clock C16/d:82. 30 minutes per repo C09/d:21
- gate: tests pass then git push C01/d:85, 97. full CI in sandbox plus coverage delta C16/d:21, 84. tests pass, coverage dropped more than 2% fails C09/d:21, 80
- on failure: Stop writes a final trace bundle C01/d:79. CI red halt, no PR C16/d:84. failure class plus repro C09/d:52

## Use X when (concepts, 6)
- JSON tool calls: explicit validator, easy to audit: L09/d:39
- CodeAct: one action a whole program, hardened sandbox: L09/d:40
- terminal agent: CLI in, pull request out, plan state: C01/d:3, 19
- issue-to-PR: UX is a GitHub label, no interactive loop, no terminal: C16/d:13
- migration: ground truth is the test suite: C09/d:13
- recipes catch 70-80% of mechanical migrations: C09/d:32, 72

## Numbers to know (concepts, 6)
- 4% to 80.9% in under three years: L09/d:3. 500 human-curated tasks: L09/d:22
- 43.2% on SWE-agent v1, 59.8% on Cline: L09/d:3, 14
- 161 of 500 tasks need 1-2 lines: L09/d:3, 65
- SWE-bench Pro 10+ lines, 23-59%: L09/d:16, 22
- verifier loop 10+ point delta: L09/d:60
- Live-SWE-agent 79.2% with Opus 4.5: C01/d:13, 144

## Terminal agent harness (01) (architecture, 9 nodes, 8 edges)
- user CLI, agent run: C01/d:26, 71
- harness Bun + Ink TUI: C01/d:26, 55
- plan / act / observe loop, TodoWrite plan state: C01/d:19, 28
- model via OpenRouter: C01/d:29-30
- tool dispatcher MCP StreamableHTTP: C01/d:32
- E2B / Daytona sandbox, worktree isolated: C01/d:41
- hooks, eight lifecycle events: C01/d:44, 132
- OpenTelemetry -> Langfuse (spans, tokens, $): C01/d:47
- PR via GitHub app: C01/d:50

## Run the lessons (task-table, 7)
- code/main.py compares the toy scaffolds: L09/d:88, L09/d:75-78
- python main.py: C01/c:10
- npm start demo plus offline eval: C01/code/ts/README.md:28
- python main.py, 50-repo simulation: C09/c:7, 9, 165
- python main.py, 20 issues over 3 repos: C16/c:8, 216, 222, 225
- python3 code/main.py: C29/d:115
- python3 -m pytest code/tests/ -v: C29/d:116

## The three projects (comparison, 7 rows)
- builds: TCA/project.json:6. RAS/project.json:7. PRR/README.md:3
- language: Python 3.10+ TCA/README.md:11. Rust and Python adapter RAS/README.md:5, 11. Node 22.18+, Python 3 PRR/README.md:5
- input: proposals.json TCA/README.md:30. requests.jsonl RAS/README.md:30. diff, stdin or --repo PRR/README.md:44
- output: repair-trace.json TCA/README.md:30. events with request_id RAS/solution/client.py:86. review.json, review.html, review.sarif PRR/README.md:21
- budget: --max-steps default 6 TCA/solution/cli.py:13. --limit default 50 RAS/solution/client.py:94. one megabyte PRR/solution/cli.ts:41-42
- safety: path containment and one allowed test command TCA/project.json:55, 83, TCA/solution/main.py:57. no OS shell, 16 KiB reads RAS/README.md:5, 37. HTML escaping and exact quote gate PRR/project.json:75, 88
- end states: completed, failed, budget_exhausted TCA/project.json:98. ok, error, rejected RAS/solution/client.py:63. accepted or rejected PRR/solution/main.ts:76, 102-103

## Project commands (command-table, 8)
- project_test.py --init: TCA/README.md:14, RAS/README.md:14, PRR/README.md:12
- project_test.py --stage 1 --path: TCA/README.md:15, PRR/README.md:13
- project_test.py --all --solution --strict: TCA/README.md:40, PRR/README.md:31
- cli.py ... --copy-to ... --out: TCA/README.md:30
- client.py ... --limit 8 --out: RAS/README.md:30
- node cli.ts --diff samples/change.diff ... --sarif review.sarif: PRR/README.md:21, 33
- --repo /path --base REF --head REF: PRR/README.md:44
- --candidates recorded-findings.json: PRR/README.md:44

## Budgets in the code (defaults, 6)
- max_turns 50: C01/c:55
- max_tokens 200_000: C01/c:56
- max_dollars 5.00: C01/c:57
- TRUNCATE_BYTES 4096: C01/c:104
- BUDGET_TURNS 20: C09/c:70
- BUDGET_USD 8.0: C09/c:69
- step_budget 12: C29/c:692

## Gate chain and sandbox (29) (annotated-code, 6 lines)
- GateChain with WhitelistGate, RegexGate.from_strings, BudgetGate: C29/c:810-826
- self.chain.evaluate returns at the first deny: C29/c:154-161, 723
- Sandbox(project_root=repo, timeout_seconds=10.0): C29/c:841
- denylist and path jail: C29/c:191-193, 198-212

## Troubleshooting (8)
- ripgrep 8MB crash, cap at 4k tokens per call: C01/d:15, 75
- rm -rf, PreToolUse guard, destructive_guard sets blocked: C01/d:79, C01/c:164-169
- easy tail 161 of 500, Pro-like subset of your backlog: L09/d:65-67
- budget_exhausted with the current diff after 30 min, $8, 20 turns: C09/d:78
- coverage_regression when coverage dropped more than 2%: C09/d:80, C09/c:100-102
- policy_denied, can force_push False, branch protection, not in bypass list: C16/c:83-86, 179-181, C16/d:74
- patch must match exactly once: TCA/solution/main.py:27-28
- path escapes root: RAS/solution/main.rs:60-62

## Q&A (3)
- wrong question, measure on your task distribution: L09/d:12
- CodeAct compresses multiple edits into one action: L09/c:114, 169
- python -O strips asserts: C16/c:173-174
