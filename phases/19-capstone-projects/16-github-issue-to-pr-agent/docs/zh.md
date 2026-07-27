# 顶点项目 16 — GitHub Issue 到 PR 的自主智能体

> AWS Remote SWE Agents、Cursor Background Agents、OpenAI Codex 云端及 Google Jules 都推出了相同的 2026 产品形态：标记一个 Issue，得到一个 PR。在云端沙盒中运行一个智能体，验证测试通过，并提交一份包含推理说明的、可供审阅的 PR。难点在于自动重现仓库的构建环境、防止凭据泄露、对每个仓库实施预算限制，以及确保智能体不能强制推送（force-push）。本顶点项目构建自托管版本，并与托管方案在成本和通过率上进行比较。

**类型：** 顶点项目  
**语言：** Python（智能体）、TypeScript（GitHub App）、YAML（Actions）  
**前置条件：** 阶段 11（LLM 工程）、阶段 13（工具）、阶段 14（智能体）、阶段 15（自主系统）、阶段 17（基础设施）  
**涉及阶段：** P11 · P13 · P14 · P15 · P17  
**时间：** 30 小时

## 问题

异步云端编码智能体与交互式编码智能体（顶点项目 01）是不同的产品类别。其用户体验是一个 GitHub 标签。你给一个 Issue 打上 `@agent fix this` 标签，一个 Worker 就在云端沙盒中启动，克隆仓库、运行测试、编辑文件、验证，然后打开一个 PR，PR 正文中包含智能体的推理说明。没有交互循环，没有终端。AWS Remote SWE Agents、Cursor Background Agents、OpenAI Codex 云端、Google Jules 以及 Factory Droids 都朝着这个方向趋同。

其中的工程挑战非常具体：环境复现（智能体必须从头构建仓库，不能使用缓存的开发镜像）、不稳定测试（必须重新运行或隔离）、凭据范围限定（使用具有最小细粒度权限的 GitHub App）、按仓库按天的预算限制，以及禁止强制推送策略。本顶点项目将评估通过率、成本及安全性，并与托管方案进行比较。

## 概念

触发机制是一个 GitHub Webhook（Issue 标签或 PR 评论）。一个分发器（Dispatcher）将任务入队到 ECS Fargate 或 Lambda。Worker 将仓库拉入 Daytona 或 E2B 沙盒，并使用根据仓库（语言、框架）推断出的通用 Dockerfile。智能体针对 Claude Opus 4.7 或 GPT-5.4-Codex 运行 mini-swe-agent 或 SWE-agent v2 循环。它迭代执行：读取代码、提出修复方案、应用补丁、运行测试。

验证是关卡步骤。在 PR 打开之前，完整的 CI 必须在沙盒中通过。计算覆盖率差异；如果覆盖率低于某个阈值，PR 仍会打开，但会被标记为 `needs-review`。智能体将推理说明作为 PR 描述发布，并附带一个审阅者可以 @ 提及智能体以进行后续追问的 `@agent` 线程。

安全性通过两个不同的 GitHub 层面来限定范围：App 提供一个具有 `workflows: read` 权限的短期安装令牌以及狭窄的仓库内容/PR 范围；分支保护规则（而非 App 权限）强制实施"禁止直接写入 `main`"和"禁止强制推送"——App 从未被添加到绕过列表中。对 `.github/workflows` 的路径限定只读访问并非 GitHub App 的原始能力，因此智能体对文件编辑的允许列表必须在 Worker 层强制执行。每个仓库每天的预算上限在分发器层实施（例如，每个仓库每天最多 5 个 PR，每个 PR 最多 20 美元）。

## 架构

```
GitHub Issue 标记为 `@agent fix` 或 PR 评论
            |
            v
    GitHub App Webhook -> AWS Lambda 分发器
            |
            v
    ECS Fargate 任务（或 GitHub Actions 自托管运行器）
       - 拉取仓库
       - 推断 Dockerfile（语言、包管理器）
       - 包含目标运行时的 Daytona / E2B 沙盒
       - clone -> git worktree -> 智能体分支
            |
            v
    mini-swe-agent / SWE-agent v2 循环
       Claude Opus 4.7 或 GPT-5.4-Codex
       工具：ripgrep、tree-sitter、read/edit、run_tests、git
            |
            v
    验证：沙盒内 CI 通过 + 覆盖率差异检查
            |
            v（验证通过）
    git push + 通过 GitHub App 打开 PR
       PR 正文 = 推理说明 + diff 摘要 + 追踪 URL
       标签：needs-review
            |
            v
    操作员审阅；可通过 @-mention 智能体进行后续追问
```

## 技术栈

- 触发器：具有细粒度令牌的 GitHub App；通过 Lambda 或 Fly.io 接收 Webhook
- Worker：ECS Fargate 任务（或 GitHub Actions 自托管运行器）
- 沙盒：每个任务一个 Daytona devcontainer 或 E2B 沙盒
- 智能体循环：基于 Claude Opus 4.7 / GPT-5.4-Codex 的 mini-swe-agent 基线或 SWE-agent v2
- 检索：tree-sitter repo-map + ripgrep
- 验证：沙盒内完整 CI + 覆盖率差异关卡
- 可观测性：Langfuse，附带链接在 PR 正文中的每个 PR 的追踪归档
- 预算：每个仓库每日美元上限；每个仓库每日最大 PR 数量

## 构建

1. **GitHub App。** 细粒度的安装令牌：Issues 读写、Pull Requests 写入、Contents 读写、Workflows 读取。分支保护（唯一能实现此功能的层面）强制实施"禁止直接推送到 `main`"和"禁止强制推送"；App 不在绕过列表中。Worker 通过对提议的 diff 进行允许列表检查来强制实施"禁止写入 `.github/workflows`"，因为 GitHub App 权限不具备路径范围限定。

2. **Webhook 接收器。** Lambda 函数接收 Issue 标签 / PR 评论 Webhook。按标签 `@agent fix this` 过滤。入队到 SQS。

3. **分发器。** 从 SQS 弹出任务。强制实施每个仓库每天预算上限。使用仓库 URL、Issue 正文和一个全新的 Daytona 沙盒启动 ECS Fargate 任务。

4. **环境推断。** 检测语言（Python、Node、Go、Rust）和包管理器（uv、pnpm、go mod、cargo）。如果不存在 Dockerfile，则动态生成一个。

5. **智能体循环。** 基于 Claude Opus 4.7 的 mini-swe-agent 或 SWE-agent v2。工具：ripgrep、tree-sitter repo-map、read_file、edit_file、run_tests、git。硬限制：20 美元成本、30 分钟挂钟时间、30 个智能体轮次。

6. **验证。** 循环结束后，在沙盒中运行完整的测试套件。通过 jacoco / coverage.py 计算覆盖率差异。如果 CI 为红色：停止，不打开 PR。如果覆盖率下降超过 2%：打开 PR 并附带 `needs-review` 标签。

7. **提交 PR。** 推送智能体分支。通过 GitHub API 打开 PR，包含：标题、推理说明、diff 摘要、追踪 URL、成本、轮次。

8. **凭据卫生。** Worker 使用短期 GitHub App 安装令牌运行。日志在归档前会清除其中的机密信息。

9. **评估。** 30 个难度各异的预置内部 Issue。衡量通过率、PR 质量（diff 大小、风格、覆盖率）、成本、延迟。与 Cursor Background Agents 和 AWS Remote SWE Agents 在相同的 Issue 上进行比较。

## 使用

```
# 在 github.com 上
  - 用户将 Issue #842 标记为 `@agent fix this`
  - 14 分钟后 PR #1903 出现
  - 正文：
    > 修复了 widget.dedupe() 中因空 comparator 条目导致的空指针异常
    > 添加了回归测试 widget_test.go::TestDedupeNullComparator
    > 覆盖率差异：+0.12%
    > 轮次：7  成本：$1.80  追踪：langfuse:...
    > 标签：needs-review
```

## 交付

`outputs/skill-issue-to-pr.md` 是交付物。一个将标记的 Issue 转化为可供审阅的 PR 的 GitHub App + 异步云端 Worker，具有有界的成本和限定范围的凭据。

| 权重 | 标准 | 衡量方式 |
|:-:|---|---|
| 25 | 30 个 Issue 的通过率 | 端到端成功（CI 绿色 + 覆盖率正常） |
| 20 | PR 质量 | Diff 大小、覆盖率差异、风格合规性 |
| 20 | 每个已解决 Issue 的成本和延迟 | 每个 PR 的美元成本和挂钟时间 |
| 20 | 安全性 | 限定范围的令牌、每个仓库预算、禁止强制推送、凭据卫生 |
| 15 | 操作员体验 | 推理评论、重试机制、@-mention 后续追问 |
| **100** | | |

## 练习

1. 添加"修复不稳定测试"模式：标签 `@agent stabilize-flake TestX` 在沙盒中运行该测试 50 次，并提出一个能使其稳定的最小改动方案。

2. 在三个共享 Issue 上将成本与 Cursor Background Agents 进行比较。报告哪些工具在哪些场景下胜出。

3. 实现一个预算仪表盘：每个仓库每天的成本、每个用户的成本。对异常情况发出告警。

4. 构建一个"空跑"模式，在不运行 CI 的情况下打开一个草稿 PR，以便审阅者可以低成本地检查计划。

5. 添加保留策略：超过 7 天未合并的 PR 分支自动删除。

## 关键术语

| 术语 | 通常说法 | 实际含义 |
|------|----------|----------|
| GitHub App | "限定范围的机器人身份" | 具有细粒度权限 + 短期安装令牌的 App |
| 异步云端智能体 | "后台智能体" | 非交互式 Worker，在云端沙盒中运行，而非终端 |
| 环境推断 | "Dockerfile 合成" | 检测语言 + 包管理器，若不存在则生成 Dockerfile |
| 验证 | "沙盒内 CI" | 在 Worker 内部运行完整测试套件后再打开 PR |
| 覆盖率差异 | "覆盖率保持" | 从基准分支到智能体分支的测试覆盖率百分比变化 |
| 每个仓库预算 | "每日上限" | 在分发器层强制实施的美元和 PR 数量上限 |
| 推理说明 | "PR 正文解释" | 智能体对变更内容及其原因所作的摘要；PR 正文中必须包含 |

## 拓展阅读

- [AWS Remote SWE Agents](https://github.com/aws-samples/remote-swe-agents) — 权威的异步云端智能体参考实现
- [SWE-agent](https://github.com/SWE-agent/SWE-agent) — CLI 参考
- [Cursor Background Agents](https://docs.cursor.com/background-agent) — 商业替代方案
- [OpenAI Codex (cloud)](https://openai.com/codex) — 托管竞品
- [Google Jules](https://jules.google) — Google 的托管版本
- [Factory Droids](https://www.factory.ai) — 另一商业参考
- [GitHub App 文档](https://docs.github.com/en/apps) — 限定范围的机器人身份
- [Daytona 云端沙盒](https://daytona.io) — 参考沙盒
