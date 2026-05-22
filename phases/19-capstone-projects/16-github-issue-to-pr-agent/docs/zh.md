# 综合项目 16 — GitHub Issue 到 PR 自主智能体

> AWS Remote SWE Agents、Cursor Background Agents、OpenAI Codex cloud 和 Google Jules 都交付了相同的 2026 年产品形态：标记一个 issue，获得一个 PR。在云沙箱中运行智能体，验证测试通过，并发布一个带有理由的待审查 PR。最困难的部分是自动复现仓库的构建环境、防止凭证泄漏、强制执行每仓库预算，以及确保智能体无法强制推送。本综合项目构建自托管版本，并在成本和通过率上与托管替代品进行比较。

**类型：** 综合项目
**语言：** Python（智能体）、TypeScript（GitHub App）、YAML（Actions）
**前置条件：** 第 11 阶段（LLM 工程）、第 13 阶段（工具）、第 14 阶段（智能体）、第 15 阶段（自主）、第 17 阶段（基础设施）
**涉及阶段：** P11 · P13 · P14 · P15 · P17
**时间：** 30 小时

## 问题描述

异步云编程智能体是与交互式编程智能体（综合项目 01）不同的产品类别。UX 是一个 GitHub 标签。你标记一个 issue `@agent fix this`，一个 worker 在云沙箱中启动，克隆仓库，运行测试，编辑文件，验证，并打开一个带有智能体理由在正文中的 PR。没有交互循环，没有终端。AWS Remote SWE Agents、Cursor Background Agents、OpenAI Codex cloud、Google Jules 和 Factory Droids 都汇聚于此。

工程挑战是具体的：环境复现（智能体必须在没有缓存的开发镜像的情况下从零开始构建仓库）、不稳定的测试（必须重新运行或隔离）、凭证范围界定（带有最小细粒度权限的 GitHub App）、每仓库每日预算强制，以及无强制推送策略。综合项目衡量通过率、成本和与托管替代品的安全性。

## 核心概念

触发器是一个 GitHub webhook（issue 标签或 PR 评论）。调度器将工作排队到 ECS Fargate 或 Lambda。Worker 将仓库拉入带有从仓库推断的通用 Dockerfile（语言、框架）的 Daytona 或 E2B 沙箱。智能体针对 Claude Opus 4.7 或 GPT-5.4-Codex 运行 mini-swe-agent 或 SWE-agent v2 循环。它迭代：读取代码、提出修复、应用补丁、运行测试。

验证是门控步骤。在 PR 打开之前，完整的 CI 必须在沙箱中通过。计算覆盖率增量；如果超出阈值则为负，PR 打开但标记为 `needs-review`。智能体将理由作为 PR 描述发布，加上一个审查员可以 ping 进行后续操作的 `@agent` 线程。

安全性通过两个不同的 GitHub 表面范围界定：App 提供带有 `workflows: read` 和狭窄仓库内容/PR 作用域的短生存期安装 token；分支保护（不是 App 权限）强制执行"不直接写入 `main`"和"无强制推送"——App 永远不会被添加到绕过列表。路径范围的只读访问 `.github/workflows` 不是真正的 GitHub App 原语，因此 worker 上的文件编辑许可列表必须强制执行。每仓库每日预算上限在调度器处强制执行（例如，每仓库每天最多 5 个 PR，每个 PR $20）。

## 架构

```
GitHub issue 标记为 `@agent fix` 或 PR 评论
            |
            v
    GitHub App webhook -> AWS Lambda 调度器
            |
            v
    ECS Fargate 任务（或 GitHub Actions 自托管运行器）
       - 拉取仓库
       - 推断 Dockerfile（语言、包管理器）
       - Daytona / E2B 沙箱，带有目标运行时
       - 克隆 -> git worktree -> 智能体分支
            |
            v
    mini-swe-agent / SWE-agent v2 循环
       Claude Opus 4.7 或 GPT-5.4-Codex
       工具：ripgrep、tree-sitter、read/edit、run_tests、git
            |
            v
    验证 CI 在沙箱内通过 + 覆盖率增量检查
            |
            v（已验证）
    git 推送 + 通过 GitHub App 打开 PR
       PR 正文 = 理由 + diff 摘要 + 追踪 URL
       标签：needs-review
            |
            v
    运维人员审查；可以 @-提及 智能体进行后续操作
```

## 技术栈

- 触发器：带有细粒度 token 的 GitHub App；通过 Lambda 或 Fly.io 的 webhook 接收器
- Worker：ECS Fargate 任务（或 GitHub Actions 自托管运行器）
- 沙箱：每个任务使用 Daytona devcontainer 或 E2B 沙箱
- 智能体循环：基于 Claude Opus 4.7 / GPT-5.4-Codex 的 mini-swe-agent 基线或 SWE-agent v2
- 检索：tree-sitter repo-map + ripgrep
- 验证：沙箱内完整 CI + 覆盖率增量门控
- 可观测性：每个 PR 追踪存档链接自 PR 正文的 Langfuse
- 预算：每仓库每日美元上限；每仓库每天最多 PR 数

## 构建步骤

1. **GitHub App。** 细粒度安装 token：issues 读+写、pull_requests 写、contents 读+写、workflows 读。分支保护（唯一能执行此操作的表面）强制执行"不直接推送到 `main`"和"无强制推送"；App 不在绕过列表中。由于在提议的 diff 上 worker 强制执行"不在 `.github/workflows` 下写入"，因此 GitHub App 权限不是路径范围的，作为许可列表检查。

2. **Webhook 接收器。** Lambda 函数接受 issue 标签 / PR 评论 webhook。按标签 `@agent fix this` 过滤。排队到 SQS。

3. **调度器。** 从 SQS 弹出任务。强制执行每仓库每日预算。启动带有仓库 URL、issue 正文和全新 Daytona 沙箱的 ECS Fargate 任务。

4. **环境推断。** 检测语言（Python、Node、Go、Rust）和包管理器（uv、pnpm、go mod、cargo）。如果不存在，动态生成 Dockerfile。

5. **智能体循环。** 带有 Claude Opus 4.7 的 mini-swe-agent 或 SWE-agent v2。工具：ripgrep、tree-sitter repo-map、read_file、edit_file、run_tests、git。硬性限制：$20 成本、30 分钟实际时间、30 个智能体轮次。

6. **验证。** 循环结束后，在沙箱内运行完整测试套件。通过 jacoco / coverage.py 计算覆盖率增量。如果 CI 为红：停止，不打开 PR。如果覆盖率下降超过 2%：打开带有 `needs-review` 标签的 PR。

7. **PR 发布。** 推送智能体分支。通过 GitHub API 打开 PR，包含：标题、理由、diff 摘要、追踪 URL、成本、轮次。

8. **凭证卫生。** Worker 使用短生存期 GitHub App 安装 token 运行。日志在存档前经过密钥清理。

9. **评估。** 30 个不同难度的种子内部 issue。衡量通过率、PR 质量（diff 大小、样式、覆盖率）、成本、延迟。在相同 issue 上与 Cursor Background Agents 和 AWS Remote SWE Agents 进行比较。

## 使用示例

```
# 在 github.com 上
  - 用户标记 issue #842 为 `@agent fix this`
  - 14 分钟后出现 PR #1903
  - 正文：
    > 修复了由空比较器条目引起的 widget.dedupe() 中的 NPE。
    > 添加了回归测试 widget_test.go::TestDedupeNullComparator。
    > 覆盖率增量：+0.12%
    > 轮次：7  成本：$1.80  追踪：langfuse:...
    > 标签：needs-review
```

## 交付成果

`outputs/skill-issue-to-pr.md` 是可交付成果。一个 GitHub App + 异步云 worker，将标记的 issue 转换为带有有界成本和范围凭证的待审查 PR。

| 权重 | 标准 | 测量方式 |
|:-:|---|---|
| 25 | 30 个 issue 的通过率 | 端到端成功（CI 绿色 + 覆盖率正常） |
| 20 | PR 质量 | Diff 大小、覆盖率增量、样式一致性 |
| 20 | 每解决 issue 的成本和延迟 | 每个 PR 的 $ 和实际时间 |
| 20 | 安全性 | 范围 token、每仓库预算、无强制推送、凭证卫生 |
| 15 | 运维人员 UX | 理由评论、重试空间、@-提及后续操作 |
| **总分** | | |

## 练习

1. 添加"修复不稳定测试"模式：标签 `@agent stabilize-flaky-test X` 在沙箱内将测试运行 50 次，并提出一个稳定它的最小更改。
2. 在三个共享 issue 上比较与 Cursor Background Agents 的成本。报告哪些工具在何处获胜。
3. 实现每仓库预算仪表板：每仓库每日成本、每用户成本。异常时发出警报。
4. 构建"干运行"模式，在不运行 CI 的情况下打开草稿 PR，以便审查员可以廉价检查计划。
5. 添加保留策略：合并后超过 7 天未合并的 PR 分支自动删除。

## 关键术语

| 术语 | 人们的说法 | 实际含义 |
|------|-----------------|------------------------|
| GitHub App | "范围机器人身份" | 带有细粒度权限 + 短生存期安装 token 的 App |
| 异步云智能体 | "后台智能体" | 在云沙箱中运行的非交互式 worker，不是终端 |
| 环境推断 | "Dockerfile 合成" | 检测语言 + 包管理器，如果不存在则生成 Dockerfile |
| 验证 | "沙箱内 CI" | 在打开 PR 之前，在 worker 内部运行完整测试套件 |
| 覆盖率增量 | "覆盖率保持" | 从基础到智能体分支的测试覆盖率 % 变化 |
| 每仓库预算 | "每日上限" | 在调度器处强制执行的美元和 PR 数量上限 |
| 理由 | "PR 正文解释" | 智能体关于更改内容和原因的摘要；PR 正文中必需 |

## 延伸阅读

- [AWS Remote SWE Agents](https://github.com/aws-samples/remote-swe-agents) — 规范异步云智能体参考
- [SWE-agent](https://github.com/SWE-agent/SWE-agent) — CLI 参考
- [Cursor Background Agents](https://docs.cursor.com/background-agent) — 商业替代方案
- [OpenAI Codex (cloud)](https://openai.com/codex) — 托管竞争对手
- [Google Jules](https://jules.google) — Google 的托管版本
- [Factory Droids](https://www.factory.ai) — 备选商业参考
- [GitHub App 文档](https://docs.github.com/en/apps) — 范围机器人身份
- [Daytona 云沙箱](https://daytona.io) — 参考沙箱
