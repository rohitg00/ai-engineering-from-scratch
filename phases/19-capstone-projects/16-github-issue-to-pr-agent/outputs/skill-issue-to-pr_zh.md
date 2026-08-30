---
name: issue-to-pr
description: 构建异步GitHub issue到PR代理，在云端沙箱中运行，复现构建，验证测试，并在严格的每仓库预算内打开可审查的PR。
version: 1.0.0
phase: 19
lesson: 16
tags: [capstone, async-agent, github, fargate, daytona, swe-bench, budget, safety]
---

给定带有标记为`@agent fix this`的issue的GitHub仓库，交付一个自托管云代理，将每个标记的issue转换为可审查的PR，具备限定凭证和有界成本。

构建计划：

1. GitHub App，含细粒度令牌：issue读写、PR写入、内容读写、工作流读取。无强制推送。main上的分支保护防止直接写入。
2. Webhook接收器（Lambda或Fly.io）过滤标签/PR评论事件并排队到SQS。
3. 调度器强制执行每仓库每日$和PR数量上限；每个允许的作业启动一个ECS Fargate任务。
4. 环境推断：从仓库内容检测语言 + 包管理器 + 运行时。如果缺失则动态合成Dockerfile。
5. 每个任务的Daytona或E2B沙箱。将仓库克隆到全新`git worktree` + 代理分支。
6. 代理循环（mini-swe-agent或SWE-agent v2上的Claude Opus 4.7或GPT-5.4-Codex）。工具：ripgrep、tree-sitter repo-map、read_file、edit_file、run_tests、git。上限：$20、30轮、30分钟。
7. 验证：沙箱内完整CI；通过jacoco / coverage.py的覆盖率增量；如果增量 < -2%则标记`needs-review`；如果CI红色则停止。
8. 通过GitHub API打开PR，含原理、差异摘要、trace URL、成本、轮次。
9. 可观测性：每PR的Langfuse trace；密钥日志清理；每仓库预算仪表板。
10. 在30个种子内部issue上评估；与Cursor Background Agents和AWS Remote SWE Agents在三个共享issue子集上比较。

评估标准：

| 权重 | 标准 | 测量 |
|:-:|---|---|
| 25 | 30个issue的通过率 | 端到端成功（CI绿色 + 覆盖率OK） |
| 20 | PR质量 | 差异大小、覆盖率增量、风格一致性 |
| 20 | 每解决issue的成本和延迟 | $/PR和挂钟时间/PR |
| 20 | 安全性 | 限定令牌、每仓库预算、无强制推送、凭证卫生 |
| 15 | 操作者UX | 原理评论、重试便利性、@提及跟进 |

硬性拒绝：
- 任何可以强制推送的代理。硬性排除。
- 跳过预算检查的调度器。失控循环是经典失败。
- 未在沙箱内通过完整CI就打开的PR。
- 包含未修订令牌或PII的trace存档。

拒绝规则：
- 拒绝在没有main分支保护的情况下安装。
- 拒绝在没有每仓库每日预算（美元和PR数量）的情况下运行。
- 拒绝自动重试失败运行；所有重试需要人工重新应用标签。

输出：包含GitHub App、webhook接收器、调度器 + 预算分类账、Fargate任务定义、沙箱生命周期管理器、mini-swe-agent循环、30-issue评估运行、与Cursor Background Agents和AWS Remote SWE Agents的并排比较，以及一份命名前三大构建推断失败及减少每个的Dockerfile合成变更的撰写的仓库。
