# キャップストーン 16 — GitHub Issue-to-PR Autonomous Agent

> AWS Remote SWE Agents、Cursor Background Agents、OpenAI Codex cloud、Google Jules は、どれも同じ 2026 年の product shape を提供している: issue に label を付けると PR が出る。Cloud sandbox で agent を走らせ、test pass を確認し、rationale 付きの review-ready PR を投稿する。難しいのは、repo の build environment を自動再現すること、credential leakage を防ぐこと、repo ごとの budget を enforce すること、agent に force-push させないことだ。この capstone では self-hosted 版を作り、hosted alternative と cost / pass rate を比較する。

**種類:** Capstone
**言語:** Python (agent)、TypeScript (GitHub App)、YAML (Actions)
**前提:** Phase 11 (LLM engineering)、Phase 13 (tools)、Phase 14 (agents)、Phase 15 (autonomous)、Phase 17 (infrastructure)
**演習対象フェーズ:** P11 · P13 · P14 · P15 · P17
**時間:** 30 時間

## 問題

Async cloud coding agent は、interactive coding agent (capstone 01) とは別の product category である。UX は GitHub label だ。Issue に `@agent fix this` と label を付けると、worker が cloud sandbox で立ち上がり、repo を clone し、test を走らせ、file を edit し、verify し、agent の rationale を body に含む PR を開く。Interactive loop も terminal もない。AWS Remote SWE Agents、Cursor Background Agents、OpenAI Codex cloud、Google Jules、Factory Droids はすべてここに収束している。

Engineering challenge は具体的だ。Environment reproduction (agent は cached dev image なしに repo を一から build しなければならない)、flaky tests (rerun または isolate が必要)、credential scoping (fine-grained permission が最小の GitHub App)、repo ごとの daily budget enforcement、no-force-push policy。この capstone は hosted alternative に対して pass rate、cost、safety を測定する。

## コンセプト

Trigger は GitHub webhook (issue label または PR comment) である。Dispatcher は ECS Fargate または Lambda に work を enqueue する。Worker は repo から推定した generic Dockerfile (language、framework) を使って Daytona または E2B sandbox に repo を pull する。Agent は Claude Opus 4.7 または GPT-5.4-Codex を使った mini-swe-agent あるいは SWE-agent v2 loop を実行する。反復は、code を読む、fix を提案する、patch を apply する、test を実行する、という流れになる。

Verification が gate である。PR を開く前に sandbox 内で full CI が pass しなければならない。Coverage delta を計算し、threshold を超えて negative なら PR は開くが `needs-review` label を付ける。Agent は PR description として rationale を投稿し、reviewer が follow-up のために ping できる `@agent` thread も残す。

Safety は 2 つの GitHub surface で scope する。App は `workflows: read` と狭い repo contents/PR scope を持つ short-lived installation token を提供する。"no direct writes to `main`" と "no force-push" は app permission ではなく branch protection で enforce する。App は bypass list に入れない。`.github/workflows` への path-scoped read-only access は GitHub App の実プリミティブではないため、worker が file edit allow-list で enforce する必要がある。Repo ごとの daily budget ceiling は dispatcher で enforce する (例: repo ごとに 1 日最大 5 PR、PR ごとに $20)。

## アーキテクチャ

```
GitHub issue labeled `@agent fix` or PR comment
            |
            v
    GitHub App webhook -> AWS Lambda dispatcher
            |
            v
    ECS Fargate task (or GitHub Actions self-hosted runner)
       - pull repo
       - infer Dockerfile (language, package manager)
       - Daytona / E2B sandbox with target runtime
       - clone -> git worktree -> agent branch
            |
            v
    mini-swe-agent / SWE-agent v2 loop
       Claude Opus 4.7 or GPT-5.4-Codex
       tools: ripgrep, tree-sitter, read/edit, run_tests, git
            |
            v
    verify CI passes in-sandbox + coverage delta check
            |
            v (verified)
    git push + open PR via GitHub App
       PR body = rationale + diff summary + trace URL
       label: needs-review
            |
            v
    operator reviews; can @-mention agent for follow-ups
```

## スタック

- Trigger: fine-grained token を持つ GitHub App。Webhook receiver は Lambda または Fly.io
- Worker: ECS Fargate task (または GitHub Actions self-hosted runner)
- Sandbox: task ごとに Daytona devcontainer または E2B sandbox
- Agent loop: Claude Opus 4.7 / GPT-5.4-Codex 上の mini-swe-agent baseline または SWE-agent v2
- Retrieval: tree-sitter repo-map + ripgrep
- Verification: sandbox 内の full CI + coverage delta gate
- Observability: PR body から link される per-PR trace archive を持つ Langfuse
- Budget: repo ごとの daily dollar ceiling、repo ごとの daily max PR 数

## 実装

1. **GitHub App.** Fine-grained installation token: issues read+write、pull_requests write、contents read+write、workflows read。Branch protection (これを実現できる唯一の surface) で "no direct push to `main`" と "no force-push" を enforce する。App は bypass list に入れない。GitHub App permission は path-scoped ではないため、worker が proposed diff に対して "no writes under `.github/workflows`" を allow-list check として enforce する。

2. **Webhook receiver.** Lambda function が issue label / PR comment webhook を受け付ける。Label `@agent fix this` で filter する。SQS に enqueue する。

3. **Dispatcher.** SQS から task を pop する。Repo ごとの daily budget を enforce する。Repo URL、issue body、新しい Daytona sandbox を指定して ECS Fargate task を起動する。

4. **Environment inference.** Language (Python、Node、Go、Rust) と package manager (uv、pnpm、go mod、cargo) を detect する。Dockerfile がなければその場で生成する。

5. **Agent loop.** Claude Opus 4.7 を使う mini-swe-agent または SWE-agent v2。Tools: ripgrep、tree-sitter repo-map、read_file、edit_file、run_tests、git。Hard limits: cost $20、wall-clock 30 分、agent 30 turns。

6. **Verification.** Loop が終わったら sandbox 内で full test suite を実行する。jacoco / coverage.py で coverage delta を計算する。CI red なら halt し、PR は開かない。Coverage が 2% を超えて低下したら `needs-review` label 付きで PR を開く。

7. **PR posting.** Agent branch を push する。GitHub API で title、rationale、diff summary、trace URL、cost、turns を含む PR を開く。

8. **Credential hygiene.** Worker は short-lived GitHub App installation token で動く。Log は archival 前に secret を scrub する。

9. **Eval.** 難易度の異なる seeded internal issue 30 件で測定する。Pass rate、PR quality (diff size、style、coverage)、cost、latency を測る。同じ issue で Cursor Background Agents と AWS Remote SWE Agents と比較する。

## 使ってみる

```
# on github.com
  - user labels issue #842 with `@agent fix this`
  - PR #1903 appears 14 minutes later
  - body:
    > Fixed NPE in widget.dedupe() caused by null comparator entry.
    > Added regression test widget_test.go::TestDedupeNullComparator.
    > Coverage delta: +0.12%
    > Turns: 7  Cost: $1.80  Trace: langfuse:...
    > Label: needs-review
```

## Ship It

`outputs/skill-issue-to-pr.md` が提出物である。Labeled issue を bounded cost と scoped credentials のもとで review-ready PR に変換する GitHub App + async cloud worker。

| Weight | Criterion | How it is measured |
|:-:|---|---|
| 25 | Pass rate on 30 issues | End-to-end success (CI green + coverage OK) |
| 20 | PR quality | Diff size、coverage delta、style conformance |
| 20 | Cost and latency per resolved issue | PR ごとの $ と wall-clock |
| 20 | Safety | Scoped token、per-repo budget、no force-push、credential hygiene |
| 15 | Operator UX | Rationale comments、retry affordance、@-mention follow-up |
| **100** | | |

## 演習

1. "fix flaky test" mode を追加する: label `@agent stabilize-flake TestX` が sandbox 内で test を 50 回実行し、安定化する最小変更を提案する。

2. 3 つの shared issue で Cursor Background Agents と cost を比較する。どの tool がどこで勝つかを報告する。

3. Budget dashboard を実装する: repo ごとの daily cost、user ごとの cost。Anomaly で alert する。

4. CI を実行せずに draft PR を開く "dry-run" mode を作る。Reviewer が低 cost で plan を確認できるようにする。

5. Retention policy を追加する: merge されずに 7 日を過ぎた PR branch を自動削除する。

## 重要用語

| Term | よくある言い方 | 実際の意味 |
|------|-----------------|------------|
| GitHub App | "Scoped bot identity" | Fine-grained permission と short-lived installation token を持つ app |
| Async cloud agent | "Background agent" | Terminal ではなく cloud sandbox で動く non-interactive worker |
| Environment inference | "Dockerfile synthesis" | Language + package manager を detect し、なければ Dockerfile を生成する |
| Verification | "CI-in-sandbox" | PR を開く前に worker 内で full test suite を実行すること |
| Coverage delta | "Coverage preservation" | Base から agent branch までの test coverage % の変化 |
| Per-repo budget | "Daily ceiling" | Dispatcher が enforce する dollar と PR-count の上限 |
| Rationale | "PR body explanation" | 何をなぜ変えたかという agent の summary。PR body に必須 |

## 参考資料

- [AWS Remote SWE Agents](https://github.com/aws-samples/remote-swe-agents) — canonical async cloud agent reference
- [SWE-agent](https://github.com/SWE-agent/SWE-agent) — CLI reference
- [Cursor Background Agents](https://docs.cursor.com/background-agent) — commercial alternative
- [OpenAI Codex (cloud)](https://openai.com/codex) — hosted competitor
- [Google Jules](https://jules.google) — Google の hosted version
- [Factory Droids](https://www.factory.ai) — alternate commercial reference
- [GitHub App documentation](https://docs.github.com/en/apps) — scoped bot identity
- [Daytona cloud sandboxes](https://daytona.io) — reference sandbox
