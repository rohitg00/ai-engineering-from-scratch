# 毕业项目 16 — GitHub Issue 到 PR 的自主代理

> 给 issue 打个标签，就能得到一个 PR —— 这就是 2026 年自主编码代理的产品形态：在云端沙箱中运行代理，验证测试通过，然后提交一个附带理由说明、可供评审的 PR。AWS Remote SWE Agents、Cursor Background Agents、OpenAI Codex cloud 和 Google Jules 都已实现这一形态。难点在于自动复现仓库的构建环境、防止凭据泄露、强制执行每个仓库的预算上限，以及确保代理无法执行 force-push。本毕业项目构建自托管版本，并在成本和通过率方面与托管方案进行比较。

**Type:** 毕业项目
**Languages:** Python (代理)， TypeScript (GitHub App), YAML (Actions)
**Prerequisites:** Phase 11 (LLM 工程)、Phase 13 (工具)、Phase 14 (代理)、Phase 15 (自主)、Phase 17 (基础设施)
**Phases exercised:** P11 · P13 · P14 · P15 · P17
**Time:** 30 小时

## 问题

异步云端编码代理是与交互式编码代理（毕业项目 01）不同的产品类别。其 UX 是一个 GitHub 标签。你给一个 issue 打上标签 `@agent fix this`，一个 worker 就会在云端沙箱中启动，克隆仓库、运行测试、编辑文件、验证，并打开一个 PR，正文中包含代理的理由说明。没有交互循环，没有终端。AWS Remote SWE Agents、Cursor Background Agents、OpenAI Codex cloud、Google Jules 和 Factory Droids 都汇聚于这一形态。

工程挑战是具体的：环境复现（代理必须在没有缓存开发镜像的情况下从零构建仓库）、不稳定的测试（必须重跑或隔离）、凭据范围控制（一个具有最小细粒度权限的 GitHub App）、每个仓库每天的预算执行，以及禁止 force-push 策略。本毕业项目将对比托管方案，衡量通过率、成本和安全性。

## 概念

触发器是一个 GitHub webhook（issue 标签或 PR 评论）。一个 dispatcher 将任务入队到 ECS Fargate 或 Lambda。worker 将仓库拉入 Daytona 或 E2B 沙箱，沙箱使用根据仓库（语言、框架）推断出的通用 Dockerfile。代理运行 mini-swe-agent 或 SWE-agent v2 循环，调用 Claude Opus 4.7 或 GPT-5.4-Codex。它不断迭代：阅读代码、提出修复、应用补丁、运行测试。

验证是门控步骤。在 PR 打开之前，完整 CI 必须在沙箱中通过。计算覆盖率变化；如果超出阈值出现下降，PR 仍会打开，但会被打上 `needs-review` 标签。代理将理由说明作为 PR 描述发布，并附带一条 `@agent` 讨论串，评审者可以 @ 它进行后续追问。

安全性通过两个不同的 GitHub 层面来实现范围控制：App 提供带有 `workflows: read` 以及狭窄的仓库内容/PR 权限范围的短时安装令牌；分支保护（而非应用权限）强制执行“禁止直接写入 `main`”和“禁止 force-push” —— 该 app 永远不会被加入绕过列表。针对 `.github/workflows` 的路径范围只读访问并不是 GitHub App 的真实原语，因此代理在文件编辑上的允许列表必须在 worker 层面强制执行这一点。每个仓库每天的预算上限在 dispatcher 层面强制执行（例如，每个仓库每天最多 5 个 PR，每个 PR 上限 $20）。

## 架构

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

## 技术栈

- 触发器：带细粒度令牌的 GitHub App；通过 Lambda 或 Fly.io 实现的 webhook 接收器
- Worker：ECS Fargate 任务（或 GitHub Actions 自托管 runner）
- 沙箱：每个任务一个 Daytona devcontainer 或 E2B 沙箱
- 代理循环：mini-swe-agent 基线或 SWE-agent v2，驱动 Claude Opus 4.7 / GPT-5.4-Codex
- 检索：tree-sitter 仓库映射 + ripgrep
- 验证：沙箱内完整 CI + 覆盖率变化门控
- 可观测性：Langfuse，包含每 PR 的 trace 归档，并从 PR 正文中链接
- 预算：每个仓库每天的美元上限；每个仓库每天的最大 PR 数

```figure
cf-issue-to-pr
```

## 构建步骤

1. **GitHub App。** 细粒度安装令牌：issues 读写、pull_requests 写、contents 读写、workflows 读。分支保护（唯一能做到这一点的层面）强制执行“禁止直接推送到 `main`”和“禁止 force-push”；该 app 不在绕过列表中。worker 将“禁止在 `.github/workflows` 下写入”作为对提议 diff 的允许列表检查来强制执行，因为 GitHub App 权限不支持路径范围控制。

2. **Webhook 接收器。** Lambda 函数接受 issue 标签 / PR 评论 webhook。按标签 `@agent fix this` 过滤。入队到 SQS。

3. **Dispatcher。** 从 SQS 中弹出任务。强制执行每仓库每天预算。启动一个 ECS Fargate 任务，附带仓库 URL、issue 正文和一个全新的 Daytona 沙箱。

4. **环境推断。** 检测语言（Python、Node、Go、Rust）和包管理器（uv、pnpm、go mod、cargo）。如果不存在，则动态生成一个 Dockerfile。

5. **代理循环。** mini-swe-agent 或 SWE-agent v2，配合 Claude Opus 4.7。工具：ripgrep、tree-sitter 仓库映射、read_file、edit_file、run_tests、git。硬性限制：$20 成本、30 分钟实际时间、30 轮代理操作。

6. **验证。** 循环结束后，在沙箱中运行完整测试套件。通过 jacoco / coverage.py 计算覆盖率变化。如果 CI 为红：中止，不打开 PR。如果覆盖率下降超过 2%：打开 PR 并打上 `needs-review` 标签。

7. **PR 发布。** 推送代理分支。通过 GitHub API 打开 PR，包含：标题、理由说明、diff 摘要、trace URL、成本、轮数。

8. **凭据卫生。** worker 使用短时 GitHub App 安装令牌运行。日志在归档前清除机密信息。

9. **评估。** 30 个难度不一的预置内部 issue。衡量通过率、PR 质量（diff 大小、风格、覆盖率）、成本、延迟。在相同 issue 上与 Cursor Background Agents 和 AWS Remote SWE Agents 进行比较。

## 使用

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

## 交付

`outputs/skill-issue-to-pr.md` 是交付物。一个 GitHub App + 异步云端 worker，将打有标签的 issue 转化为成本受限、凭据范围可控、可供评审的 PR。

| 权重 | 标准 | 衡量方式 |
|:-:|---|---|
| 25 | 30 个 issue 上的通过率 | 端到端成功（CI 绿 + 覆盖率合格） |
| 20 | PR 质量 | diff 大小、覆盖率变化、风格一致性 |
| 20 | 每个已解决 issue 的成本和延迟 | 每 PR 的 $ 和实际时间 |
| 20 | 安全性 | 范围化令牌、每仓库预算、禁止 force-push、凭据卫生 |
| 15 | 操作者 UX | 理由说明评论、重试功能、@-提及后续追问 |
| **100** | | |

## 练习

1. 增加一个“修复不稳定测试”模式：标签 `@agent stabilize-flake TestX` 在沙箱中将该测试运行 50 次，并提出使其稳定的最小改动。

2. 在三个共享 issue 上比较与 Cursor Background Agents 的成本。报告哪些工具在哪些方面胜出。

3. 实现一个预算仪表盘：每仓库每天成本、每用户成本。异常时告警。

4. 构建一个“试运行”模式，打开草稿 PR 而不运行 CI，让评审者能低成本地检视计划。

5. 增加保留策略：超过 7 天未合并的 PR 分支自动删除。

## 关键术语

| 术语 | 人们的说法 | 实际含义 |
|------|-----------------|------------------------|
| GitHub App | “范围化机器人身份” | 具有细粒度权限 + 短时安装令牌的 App |
| 异步云端代理 | “后台代理” | 在云端沙箱而非终端中运行的非交互式 worker |
| 环境推断 | “Dockerfile 合成” | 检测语言 + 包管理器，缺失时生成 Dockerfile |
| 验证 | “沙箱内 CI” | 在打开 PR 之前在 worker 内部运行完整测试套件 |
| 覆盖率变化 | “覆盖率保持” | 从基础分支到代理分支的测试覆盖率百分比变化 |
| 每仓库预算 | “每日上限” | 在 dispatcher 层面强制执行的美元和 PR 数量上限 |
| 理由说明 | “PR 正文解释” | 代理对改了什么以及为什么改的总结；必须包含在 PR 正文中 |

## 延伸阅读

- [AWS Remote SWE Agents](https://github.com/aws-samples/remote-swe-agents) — 权威的异步云端代理参考
- [SWE-agent](https://github.com/SWE-agent/SWE-agent) — CLI 参考
- [Cursor Background Agents](https://docs.cursor.com/background-agent) — 商业替代方案
- [OpenAI Codex (cloud)](https://openai.com/codex) — 托管竞品
- [Google Jules](https://jules.google) — Google 的托管版本
- [Factory Droids](https://www.factory.ai) — 另一商业参考
- [GitHub App 文档](https://docs.github.com/en/apps) — 范围化机器人身份
- [Daytona 云端沙箱](https://daytona.io) — 参考沙箱