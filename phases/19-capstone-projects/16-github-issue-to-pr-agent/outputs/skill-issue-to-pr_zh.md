---
name: issue-to-pr
description: 构建一个异步的 GitHub issue-to-PR 智能体，在云沙箱中运行，复现构建，验证测试，并在严格的每仓库预算内打开审阅就绪的 PR。
version: 1.0.0
phase: 19
lesson: 16
tags: [capstone, async-agent, github, fargate, daytona, swe-bench, budget, safety]
---

给定一个 GitHub 仓库，其中 issues 标记有 `@agent fix this`，部署一个自托管云智能体，将每个标记的 issue 转换为审阅就绪的 PR，使用限定范围的凭据和有边界的成本。

构建计划：

1. GitHub App，带细粒度令牌：issues 读写、PR 写入、内容读写、工作流读取。无强制推送。main 上的分支保护防止直接写入。
2. Webhook 接收器（Lambda 或 Fly.io）过滤标签 / PR 评论事件并排入 SQS。
3. 调度器强制每仓库每日 $ 和 PR 计数上限；为每个允许的作业启动一个 ECS Fargate 任务。
4. 环境推断：从仓库内容检测语言 + 包管理器 + 运行时。在缺失时即时合成一个 Dockerfile。
5. 每个任务的 Daytona 或 E2B 沙箱。将仓库克隆到新的 `git worktree` + 智能体分支。
6. 智能体循环（基于 Claude Opus 4.7 或 GPT-5.4-Codex 的 mini-swe-agent 或 SWE-agent v2）。工具：ripgrep、tree-sitter repo-map、read_file、edit_file、run_tests、git。上限：20 美元、30 轮、30 分钟。
7. 验证：在沙箱中运行完整 CI；通过 jacoco / coverage.py 计算覆盖率差异；如果 delta < -2%，标记 `needs-review`；如果 CI 红色则停止。
8. 通过 GitHub API 打开 PR，附带理由、差异摘要、跟踪 URL、成本、轮次。
9. 可观测性：每个 PR 的 Langfuse 跟踪；日志擦除密钥；每仓库预算仪表板。
10. 在 30 个播种的内部问题上评估；与 Cursor Background Agents 和 AWS Remote SWE Agents 在三个共享问题的子集上比较。

评估量规：

| 权重 | 标准 | 衡量方法 |
|:-:|---|---|
| 25 | 30 个问题的通过率 | 端到端成功（CI 绿色 + 覆盖率正常） |
| 20 | PR 质量 | 差异大小、覆盖率差异、风格一致性 |
| 20 | 每个已解决问题的成本和延迟 | $/PR 和墙上时钟/PR |
| 20 | 安全性 | 限定范围的令牌、每仓库预算、无强制推送、凭据卫生 |
| 15 | 操作员体验 | 理由评论、重试能力、@-mention 跟进 |

硬性拒绝：

- 任何可以强制推送的智能体。硬性排除。
- 跳过预算检查的调度器。失控循环是经典故障。
- 在完整 CI 未在沙箱中通过的情况下打开的 PR。
- 包含未擦除的令牌或 PII 的跟踪存档。

拒绝规则：

- 拒绝在没有 main 分支保护的情况下安装。
- 拒绝在没有每仓库每日预算（美元和 PR 计数）的情况下运行。
- 拒绝自动重试失败的运行；所有重试需要人工重新应用标签。

输出：一个包含 GitHub App、webhook 接收器、调度器 + 预算账本、Fargate 任务定义、沙箱生命周期管理器、mini-swe-agent 循环、30 问题评估运行、与 Cursor Background Agents 和 AWS Remote SWE Agents 的并排比较，以及一份说明前三大构建推断失败及减少每种失败的 Dockerfile 合成变更的仓库。
