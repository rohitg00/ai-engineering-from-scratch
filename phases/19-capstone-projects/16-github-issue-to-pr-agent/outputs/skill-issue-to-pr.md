---
name: issue-to-pr
description: Cloud sandbox で実行され、build を再現し、test を verify し、strict な per-repo budget 内で review-ready PR を開く async GitHub issue-to-PR agent を構築する。
version: 1.0.0
phase: 19
lesson: 16
tags: [capstone, async-agent, github, fargate, daytona, swe-bench, budget, safety]
---

`@agent fix this` が label された issue を持つ GitHub repository を対象に、scoped credential と bounded cost のもとで各 labeled issue を review-ready PR に変換する self-hosted cloud agent を ship する。

Build plan:

1. Fine-grained token を持つ GitHub App: issues rw、PRs write、contents rw、workflows read。Force-push なし。Main の branch protection で direct write を防ぐ。
2. Webhook receiver (Lambda または Fly.io) が label / PR-comment event を filter し、SQS に enqueue する。
3. Dispatcher が repo ごとの daily $ と PR-count ceiling を enforce し、allowed job ごとに ECS Fargate task を起動する。
4. Environment inference: repo contents から language + package manager + runtime を detect する。なければその場で Dockerfile を synthesize する。
5. Task ごとに Daytona または E2B sandbox。Repo を fresh `git worktree` + agent branch に clone する。
6. Agent loop (Claude Opus 4.7 または GPT-5.4-Codex 上の mini-swe-agent または SWE-agent v2)。Tools: ripgrep、tree-sitter repo-map、read_file、edit_file、run_tests、git。Caps: $20、30 turns、30 min。
7. Verify: sandbox 内の full CI、jacoco / coverage.py による coverage delta、delta < -2% なら `needs-review` label、CI red なら halt。
8. GitHub API で rationale、diff summary、trace URL、cost、turns を含む PR を開く。
9. Observability: PR ごとの Langfuse trace、secret 用 log scrub、repo ごとの budget dashboard。
10. Seeded internal issue 30 件で eval する。3-issue shared subset で Cursor Background Agents と AWS Remote SWE Agents と比較する。

Assessment rubric:

| Weight | Criterion | Measurement |
|:-:|---|---|
| 25 | Pass rate on 30 issues | End-to-end success (CI green + coverage OK) |
| 20 | PR quality | Diff size、coverage delta、style conformance |
| 20 | Cost and latency per resolved issue | $/PR と wall-clock/PR |
| 20 | Safety | Scoped token、per-repo budget、no force-push、credential hygiene |
| 15 | Operator UX | Rationale comments、retry affordance、@-mention follow-up |

Hard rejects:

- Force-push できる agent。Hard exclusion。
- Budget check を skip する dispatcher。Runaway loop は典型的な failure。
- Sandbox 内で full CI が pass する前に開かれた PR。
- Unredacted token または PII を含む trace archive。

Refusal rules:

- Main の branch protection なしでは install しない。
- Repo ごとの daily budget (dollars と PR count) なしでは run しない。
- Failed run を自動 retry しない。すべての retry は human による label reapplication が必要。

Output: GitHub App、webhook receiver、dispatcher + budget ledger、Fargate task definition、sandbox lifecycle manager、mini-swe-agent loop、30-issue eval run、Cursor Background Agents と AWS Remote SWE Agents との side-by-side comparison、build-inference failure top 3 とそれを減らした Dockerfile-synthesis change を記した write-up を含む repo。
