# 16 · GitHub Issue 到 PR 的自主智能体

> AWS Remote SWE Agents、Cursor Background Agents、OpenAI Codex cloud 以及 Google Jules 在 2026 年交付的都是同一种产品形态：给 issue 打上标签，就能得到一个 PR。在云端沙箱中运行一个智能体，验证测试通过，然后提交一个带有推理说明的、可供审查的 PR。其中难点在于：自动复现仓库的构建环境、防止凭据泄露、按仓库执行预算控制，以及确保智能体无法 force-push。本基石项目构建自托管版本，并在成本与通过率上与托管方案进行对比。

**类型：** 基石项目
**语言：** Python（智能体）、TypeScript（GitHub App）、YAML（Actions）
**前置：** 第 11 阶段（LLM 工程）、第 13 阶段（工具）、第 14 阶段（智能体）、第 15 阶段（自主智能体）、第 17 阶段（基础设施）
**涉及阶段：** P11 · P13 · P14 · P15 · P17
**时长：** 30 小时

## 问题

异步云端编程智能体（async cloud coding agent）是一个独立的产品类别，有别于交互式编程智能体（基石项目 01）。其用户体验就是一个 GitHub 标签。你给 issue 打上 `@agent fix this` 标签，一个工作进程在云端沙箱中启动，克隆仓库，运行测试，编辑文件，验证通过，然后提交一个 PR，PR 正文中包含智能体的推理说明。没有交互循环，没有终端。AWS Remote SWE Agents、Cursor Background Agents、OpenAI Codex cloud、Google Jules 和 Factory Droids 都在往这个方向收敛。

工程挑战非常具体：环境复现（智能体必须从零构建仓库，没有预缓存的开发镜像）、不稳定测试（需要重新运行或隔离）、凭据范围控制（一个具有最小细粒度权限的 GitHub App）、按仓库按天的预算控制，以及禁止 force-push 的策略。本基石项目将通过率、成本和安全性作为衡量指标，与托管方案进行对比。

## 概念

触发源是 GitHub webhook（issue 标签或 PR 评论）。调度器将工作排入 ECS Fargate 或 Lambda。工作进程将仓库拉入 Daytona 或 E2B 沙箱，并使用根据仓库推断出的通用 Dockerfile（语言、框架）。智能体运行简化的 mini-swe-agent 或 SWE-agent v2 循环，对接 Claude Opus 4.7 或 GPT-5.4-Codex。它反复迭代：阅读代码、提出修复方案、应用补丁、运行测试。

验证是关键的门控步骤。完整 CI 必须在沙箱中通过之后才能提交 PR。计算覆盖率变化量（coverage delta）；如果覆盖率下降超过阈值，PR 仍会提交，但会被打上 `needs-review` 标签。智能体将推理说明作为 PR 描述发布，同时附上一个 `@agent` 线程，审查者可以在其中 @ 智能体进行追问。

安全性通过两个不同的 GitHub 层面来实现：GitHub App 提供一个具有 `workflows: read` 和受限仓库内容/PR 作用域的短期安装令牌；分支保护（而非应用权限）强制执行"禁止直接写入 `main`"和"禁止 force-push"——该应用不会被添加到绕过列表中。对 `.github/workflows` 的路径限定只读访问并非 GitHub App 的真正原语，因此智能体在文件编辑上的白名单必须在工作进程中强制执行。按仓库每日预算上限在调度器层面强制实施（例如，每个仓库每天最多 5 个 PR，每个 PR 最多 20 美元）。

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

- 触发器：GitHub App，使用细粒度令牌；通过 Lambda 或 Fly.io 接收 webhook
- 工作进程：ECS Fargate 任务（或 GitHub Actions 自托管运行器）
- 沙箱：每个任务使用 Daytona devcontainer 或 E2B 沙箱
- 智能体循环：基于 mini-swe-agent 基线或 SWE-agent v2，对接 Claude Opus 4.7 / GPT-5.4-Codex
- 检索：tree-sitter 仓库映射 + ripgrep
- 验证：沙箱中运行完整 CI + 覆盖率变化量门控
- 可观测性：Langfuse，PR 正文中附带每个 PR 的追踪档案链接
- 预算：每个仓库每日金额上限；每个仓库每天的最大 PR 数

## 构建过程

1. **GitHub App。** 细粒度安装令牌：issues 读写、pull_requests 写入、contents 读写、workflows 读取。分支保护（唯一能实现此项的层面）强制执行"禁止直接推送到 `main`"和"禁止 force-push"；该应用不在绕过列表中。工作进程通过白名单检查来强制执行"禁止写入 `.github/workflows` 下的文件"，因为 GitHub App 的权限不是按路径划分的。

2. **Webhook 接收器。** Lambda 函数接收 issue 标签 / PR 评论 webhook。按标签 `@agent fix this` 过滤。排入 SQS 队列。

3. **调度器。** 从 SQS 中取出任务。强制执行每个仓库每天的预算限制。启动 ECS Fargate 任务，携带仓库 URL、issue 正文和一个全新的 Daytona 沙箱。

4. **环境推断。** 检测语言（Python、Node、Go、Rust）和包管理器（uv、pnpm、go mod、cargo）。如果不存在 Dockerfile，则动态生成一个。

5. **智能体循环。** mini-swe-agent 或 SWE-agent v2 配合 Claude Opus 4.7。工具：ripgrep、tree-sitter 仓库映射、read_file、edit_file、run_tests、git。硬性限制：成本 20 美元、时间 30 分钟、智能体 30 轮。

6. **验证。** 循环结束后，在沙箱中运行完整测试套件。通过 jacoco / coverage.py 计算覆盖率变化量。如果 CI 变红：停止，不提交 PR。如果覆盖率下降超过 2%：提交 PR 并打上 `needs-review` 标签。

7. **PR 提交。** 推送智能体分支。通过 GitHub API 提交 PR，包含：标题、推理说明、diff 摘要、追踪链接、成本、轮数。

8. **凭据卫生。** 工作进程使用短生命周期的 GitHub App 安装令牌运行。日志在归档前会清除敏感信息（secrets）。

9. **评估。** 30 个内部预设的、难度各异的问题。衡量通过率、PR 质量（diff 大小、代码风格、覆盖率）、成本、延迟。与 Cursor Background Agents 和 AWS Remote SWE Agents 在相同问题上进行对比。

## 使用示例

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

## 交付标准

`outputs/skill-issue-to-pr.md` 是交付物。一个 GitHub App + 异步云端工作进程，能够将打上标签的 issue 转化为可供审查的 PR，且成本可控、凭据安全。

| 权重 | 标准 | 衡量方式 |
|:-:|---|---|
| 25 | 30 个 issue 的通过率 | 端到端成功（CI 绿色 + 覆盖率合格） |
| 20 | PR 质量 | diff 大小、覆盖率变化量、代码风格一致性 |
| 20 | 每个已解决 issue 的成本和延迟 | 每个 PR 的美元花费和时间消耗 |
| 20 | 安全性 | 受限令牌、按仓库预算、禁止 force-push、凭据卫生 |
| 15 | 操作者用户体验 | 推理说明注释、重试机制、@提及 追问 |
| **100** | | |

## 练习

1. 添加"修复不稳定测试"模式：标签 `@agent stabilize-flake TestX` 会在沙箱中运行该测试 50 次，并提出一个能使其稳定化的最小改动。

2. 与 Cursor Background Agents 在三个共同问题上进行成本比较。报告各工具在哪些方面占优。

3. 实现一个预算仪表板：按仓库按天成本、按用户成本。对异常发出警报。

4. 构建"试运行"模式：提交一个草稿 PR 而不运行 CI，使审查者可以低成本地检查方案。

5. 添加保留策略：超过 7 天未合并的 PR 分支自动删除。

## 关键术语

| 术语 | 通常说法 | 实际含义 |
|------|-----------------|------------------------|
| GitHub App | "受限的机器人身份" | 具有细粒度权限 + 短期安装令牌的应用 |
| 异步云端智能体 | "后台智能体" | 在云端沙箱中运行的非交互式工作进程，而非终端 |
| 环境推断 | "Dockerfile 合成" | 检测语言和包管理器，在缺失时生成 Dockerfile |
| 验证 | "沙箱内 CI" | 在提交 PR 之前，在工作进程内部运行完整测试套件 |
| 覆盖率变化量 | "覆盖率保持" | 从基准分支到智能体分支的测试覆盖率百分比变化 |
| 按仓库预算 | "每日上限" | 在调度器层面强制执行的金额和 PR 数量上限 |
| 推理说明 | "PR 正文解释" | 智能体对所做更改及其原因的总结；必须包含在 PR 正文中 |

## 扩展阅读

- [AWS Remote SWE Agents](https://github.com/aws-samples/remote-swe-agents) — 权威的异步云端智能体参考实现
- [SWE-agent](https://github.com/SWE-agent/SWE-agent) — CLI 参考
- [Cursor Background Agents](https://docs.cursor.com/background-agent) — 商业化替代方案
- [OpenAI Codex (cloud)](https://openai.com/codex) — 托管竞争对手
- [Google Jules](https://jules.google) — Google 的托管版本
- [Factory Droids](https://www.factory.ai) — 替代商业化参考
- [GitHub App 文档](https://docs.github.com/en/apps) — 受限的机器人身份
- [Daytona 云端沙箱](https://daytona.io) — 参考沙箱
