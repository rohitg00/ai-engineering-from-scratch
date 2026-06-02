# Capstone 16 — GitHub Issue 转 PR 自主 agent

> 译注：本文译自同目录 [`en.md`](./en.md)。术语遵循仓根 [TRANSLATION_GUIDE.md](../../../../TRANSLATION_GUIDE.md)。

> AWS Remote SWE Agents、Cursor Background Agents、OpenAI Codex cloud、Google Jules，2026 年这几家产品形态完全一致：给 issue 打个标签，就能拿回一个 PR。在云沙箱里跑一个 agent，验证测试通过，再连同 rationale（理由说明）一起把 review-ready 的 PR 提上来。难点在于：自动复现仓库的构建环境、防止凭证泄露、对每个 repo 强制预算上限、以及确保 agent 不能 force push。本 capstone 自己搭一套自托管版本，并在成本和通过率两个维度上和这些托管竞品对比。

**Type:** Capstone
**Languages:** Python（agent）, TypeScript（GitHub App）, YAML（Actions）
**Prerequisites:** Phase 11（LLM engineering）, Phase 13（tools）, Phase 14（agents）, Phase 15（autonomous）, Phase 17（infrastructure）
**Phases exercised:** P11 · P13 · P14 · P15 · P17
**Time:** 30 hours

## 问题（Problem）

异步云端编码 agent 是一个独立的产品品类，和 capstone 01 里的交互式编码 agent 不是一回事。它的 UX 就是一个 GitHub 标签：你给 issue 打上 `@agent fix this`，一个 worker 就在云沙箱里启动、clone 仓库、跑测试、改文件、验证、然后开一个 PR，把 agent 的 rationale 写在正文里。没有交互循环，也没有终端。AWS Remote SWE Agents、Cursor Background Agents、OpenAI Codex cloud、Google Jules、Factory Droids 全都收敛到了这个形态。

工程挑战很具体：环境复现（agent 必须从零构建仓库，没有缓存的 dev image 可用）、flaky test（必须重跑或隔离）、凭证作用域（一个 GitHub App，配上最小化的 fine-grained 权限）、按 repo 按天的预算执行、以及 no-force-push 策略。本 capstone 衡量的是和托管竞品在通过率、成本、安全性上的差距。

## 概念（Concept）

触发器是一个 GitHub webhook（issue 标签或 PR 评论）。一个 dispatcher 把任务排队到 ECS Fargate 或 Lambda。Worker 把仓库拉到 Daytona 或 E2B 沙箱里，根据仓库（语言、框架）推断出一个通用 Dockerfile。Agent 在 Claude Opus 4.7 或 GPT-5.4-Codex 上跑一个 mini-swe-agent 或 SWE-agent v2 循环。它会反复迭代：读代码、提出修复、打补丁、跑测试。

验证是关键的卡点。在 PR 开出来之前，完整 CI 必须先在沙箱里通过。覆盖率 delta 也要算出来；如果跌幅超过阈值，PR 仍然会开，但会被打上 `needs-review` 标签。Agent 把 rationale 写到 PR 描述里，并附一个 `@agent` 线程，reviewer 可以在上面 ping 它做后续追问。

安全性通过两个不同的 GitHub 表面来约束作用域：App 提供一个短期 installation token，权限范围是 `workflows: read` 加上很窄的 repo contents/PR 作用域；branch protection（不是 app 权限）来强制执行「禁止直接写 `main`」和「禁止 force-push」——app 永远不在 bypass 名单里。`.github/workflows` 路径级只读访问并不是 GitHub App 的原生 primitive，所以这条规则得靠 worker 自己用 allowlist（白名单）在文件编辑层面来强制。按 repo 按天的预算上限由 dispatcher 强制（比如每个 repo 每天最多 5 个 PR、每个 PR 最多 \$20）。

## 架构（Architecture）

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

## 技术栈（Stack）

- 触发：GitHub App，配 fine-grained token；webhook 接收用 Lambda 或 Fly.io
- Worker：ECS Fargate task（或 GitHub Actions self-hosted runner）
- 沙箱：每个任务一个 Daytona devcontainer 或 E2B sandbox
- Agent loop：基线用 mini-swe-agent，或 SWE-agent v2，跑在 Claude Opus 4.7 / GPT-5.4-Codex 上
- 检索：tree-sitter repo-map + ripgrep
- 验证：沙箱里完整跑 CI + 覆盖率 delta 卡口
- 可观测性：Langfuse，按 PR 归档 trace，并在 PR 正文里挂链接
- 预算：按 repo 按天的美元上限；按 repo 按天的 PR 数上限

## 动手实现（Build It）

1. **GitHub App。** Fine-grained installation token：issues read+write、pull_requests write、contents read+write、workflows read。Branch protection（唯一能干这个的表面）来强制「禁止直接 push 到 `main`」和「禁止 force-push」；app 不在 bypass 名单里。Worker 在 diff 提案上做 allowlist 检查，强制执行「`.github/workflows` 下不可写」——因为 GitHub App 的权限不是按路径作用域的。

2. **Webhook 接收器。** Lambda function 接收 issue 标签 / PR 评论 webhook。按 `@agent fix this` 标签过滤。入队到 SQS。

3. **Dispatcher。** 从 SQS 弹出任务。按 repo 按天强制预算。带上 repo URL、issue 正文、一个全新的 Daytona 沙箱，启动 ECS Fargate task。

4. **环境推断。** 检测语言（Python、Node、Go、Rust）和包管理器（uv、pnpm、go mod、cargo）。如果仓库里没有 Dockerfile，就动态生成一个。

5. **Agent loop。** mini-swe-agent 或 SWE-agent v2，跑在 Claude Opus 4.7 上。Tools：ripgrep、tree-sitter repo-map、read_file、edit_file、run_tests、git。硬上限：\$20 成本、30 分钟 wall-clock、30 个 agent turn。

6. **验证。** Loop 结束后，沙箱里跑完整测试套件。用 jacoco / coverage.py 计算覆盖率 delta。如果 CI red：停下，不开 PR。如果覆盖率跌超过 2%：PR 照开，但打上 `needs-review` 标签。

7. **PR 提交。** Push agent 分支。通过 GitHub API 开 PR，包含：标题、rationale、diff 摘要、trace URL、成本、turn 数。

8. **凭证卫生。** Worker 用一个短期的 GitHub App installation token 跑。日志在归档之前要做 secret 清洗。

9. **Eval（评估）。** 30 个内部预设 issue，难度各异。衡量通过率、PR 质量（diff 大小、风格、覆盖率）、成本、延迟。在同一批 issue 上和 Cursor Background Agents、AWS Remote SWE Agents 做对比。

## 用起来（Use It）

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

## 上线部署（Ship It）

`outputs/skill-issue-to-pr.md` 是交付物。一个 GitHub App + 异步云端 worker，把打了标签的 issue 变成 review-ready 的 PR，成本受控、凭证作用域受限。

| Weight | Criterion | How it is measured |
|:-:|---|---|
| 25 | 30 个 issue 上的通过率 | 端到端成功（CI green + 覆盖率 OK） |
| 20 | PR 质量 | Diff 大小、覆盖率 delta、风格一致性 |
| 20 | 解决一个 issue 的成本和延迟 | 每个 PR 的 \$ 和 wall-clock |
| 20 | 安全性 | 作用域 token、按 repo 预算、no force-push、凭证卫生 |
| 15 | 操作者 UX | Rationale 评论、重试便利度、@-mention 后续追问 |
| **100** | | |

## 练习（Exercises）

1. 加一个「修 flaky test」模式：标签 `@agent stabilize-flake TestX` 在沙箱里把这个测试跑 50 次，提出一个能让它稳定下来的最小改动。

2. 在 3 个共享 issue 上对比成本 vs Cursor Background Agents。报告哪种工具在哪种场景里赢。

3. 实现一个预算 dashboard：按 repo 按天的成本、按用户的成本。异常时告警。

4. 构建一个「dry-run」模式：开一个 draft PR，但不跑 CI，让 reviewer 用很低的成本就能看到计划。

5. 加一个保留策略：超过 7 天未合并的 PR 分支自动删除。

## 关键术语（Key Terms）

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| GitHub App | "Scoped bot identity" | 带 fine-grained 权限 + 短期 installation token 的 app |
| Async cloud agent | "Background agent" | 跑在云沙箱里的非交互式 worker，不是终端 |
| Environment inference | "Dockerfile synthesis" | 检测语言 + 包管理器，没有 Dockerfile 就生成一个 |
| Verification | "CI-in-sandbox" | 在 worker 里跑完整测试套件，PR 才会开 |
| Coverage delta | "Coverage preservation" | 从 base 到 agent 分支的测试覆盖率变化百分比 |
| Per-repo budget | "Daily ceiling" | Dispatcher 强制的美元和 PR 数双上限 |
| Rationale | "PR body explanation" | Agent 总结「改了什么、为什么」；PR 正文必备 |

## 延伸阅读（Further Reading）

- [AWS Remote SWE Agents](https://github.com/aws-samples/remote-swe-agents) — 异步云端 agent 的标杆参考
- [SWE-agent](https://github.com/SWE-agent/SWE-agent) — CLI 参考
- [Cursor Background Agents](https://docs.cursor.com/background-agent) — 商业替代品
- [OpenAI Codex (cloud)](https://openai.com/codex) — 托管竞品
- [Google Jules](https://jules.google) — Google 的托管版
- [Factory Droids](https://www.factory.ai) — 另一个商业参考
- [GitHub App documentation](https://docs.github.com/en/apps) — 作用域 bot 身份
- [Daytona cloud sandboxes](https://daytona.io) — 参考沙箱
