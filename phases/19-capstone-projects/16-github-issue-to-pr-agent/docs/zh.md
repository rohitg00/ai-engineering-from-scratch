# 顶点项目 16 —— GitHub Issue-to-PR 自主智能体

> AWS Remote SWE Agents、Cursor Background Agents、OpenAI Codex cloud 和 Google Jules 都交付相同的 2026 年产品形态：标记一个问题，获得一个 PR。在云沙盒中运行智能体，验证测试通过，并发布一个带理由的审查就绪 PR。困难的部分是自动复现仓库的构建环境、防止凭证泄露、强制执行每仓库预算，以及确保智能体不能强制推送。这个顶点项目构建自托管版本，并在成本和通过率上与托管替代方案进行比较。

**类型：** 顶点项目
**语言：** Python（智能体）、TypeScript（GitHub App）、YAML（Actions）
**先决条件：** Phase 11（LLM 工程）、Phase 13（工具）、Phase 14（智能体）、Phase 15（自主系统）、Phase 17（基础设施）
**涉及阶段：** P11 · P13 · P14 · P15 · P17
**时间：** 30 小时

## 问题

异步云编码智能体是与交互式编码智能体（顶点项目 01）不同的产品类别。用户体验是一个 GitHub 标签。你标记一个问题 `@agent fix this`，一个工作者在云沙盒中启动，克隆仓库，运行测试，编辑文件，验证，并打开一个带智能体理由的 PR。没有交互循环，没有终端。AWS Remote SWE Agents、Cursor Background Agents、OpenAI Codex cloud、Google Jules 和 Factory Droids 都汇聚于此。

工程挑战是具体的：环境复现（智能体必须在没有缓存开发镜像的情况下从头构建仓库）、不稳定测试（必须重新运行或隔离）、凭证范围（具有最小细粒度权限的 GitHub App）、每仓库每天的预算执行，以及无强制推送策略。顶点项目测量通过率、成本和安全性与托管替代方案的对比。

## 概念

触发器是 GitHub webhook（问题标签或 PR 评论）。调度器将工作排队到 ECS Fargate 或 Lambda。工作者将仓库拉取到 Daytona 或 E2B 沙盒中，沙盒带有从仓库推断的通用 Dockerfile（语言、框架）。智能体针对 Claude Opus 4.7 或 GPT-5.4-Codex 运行 mini-swe-agent 或 SWE-agent v2 循环。它迭代：读取代码、提出修复、应用补丁、运行测试。

验证是门控步骤。完整 CI 必须在沙盒中通过，PR 才能打开。计算覆盖率差异；如果负向超过阈值，PR 打开但标记为 `needs-review`。智能体将理由作为 PR 描述发布，加上一个审查员可以 ping 以进行后续操作的 `@agent` 线程。

安全通过两个不同的 GitHub 界面进行范围控制：App 提供短期安装令牌，带 `workflows: read` 和窄仓库内容/PR 范围；分支保护（而非 App 权限）强制执行"不直接写入 `main`"和"无强制推送"——App 从未添加到绕过列表。对 `.github/workflows` 的路径范围只读访问不是真正的 GitHub App 原语，因此智能体对文件编辑的允许列表必须在工作者处强制执行。每仓库每天的预算上限在调度器处强制执行（例如，每仓库每天最多 5 个 PR，每个 PR $20）。

## 架构

```
标记为 `@agent fix` 的 GitHub 问题或 PR 评论
            |
            v
    GitHub App webhook -> AWS Lambda 调度器
            |
            v
    ECS Fargate 任务（或 GitHub Actions 自托管运行器）
       - 拉取仓库
       - 推断 Dockerfile（语言、包管理器）
       - 带目标运行时的 Daytona / E2B 沙盒
       - 克隆 -> git worktree -> 智能体分支
            |
            v
    mini-swe-agent / SWE-agent v2 循环
       Claude Opus 4.7 或 GPT-5.4-Codex
       工具：ripgrep、tree-sitter、读/编辑、run_tests、git
            |
            v
    验证沙盒内 CI 通过 + 覆盖率差异检查
            |
            v（已验证）
    git 推送 + 通过 GitHub App 打开 PR
       PR 正文 = 理由 + 差异摘要 + 追踪 URL
       标签：needs-review
            |
            v
    操作员审查；可以 @提及智能体进行后续操作
```

## 技术栈

- 触发器：具有细粒度令牌的 GitHub App；通过 Lambda 或 Fly.io 的 webhook 接收器
- 工作者：ECS Fargate 任务（或 GitHub Actions 自托管运行器）
- 沙盒：每个任务的 Daytona devcontainer 或 E2B 沙盒
- 智能体循环：mini-swe-agent 基线或 SWE-agent v2，基于 Claude Opus 4.7 / GPT-5.4-Codex
- 检索：tree-sitter 仓库地图 + ripgrep
- 验证：沙盒内完整 CI + 覆盖率差异门
- 可观察性：Langfuse，带从 PR 正文链接的每 PR 追踪存档
- 预算：每仓库每日美元上限；每仓库每天最大 PR 数

## 构建它

1. **GitHub App。** 细粒度安装令牌：issues 读写、pull_requests 写入、contents 读写、workflows 读取。分支保护（唯一能执行此操作的界面）强制执行"不直接推送到 `main`"和"无强制推送"；App 不在绕过列表中。工作者对提议的差异强制执行"不写入 `.github/workflows` 下"作为允许列表检查，因为 GitHub App 权限不是路径范围的。

2. **Webhook 接收器。** Lambda 函数接受问题标签 / PR 评论 webhook。按标签 `@agent fix this` 过滤。排队到 SQS。

3. **调度器。** 从 SQS 弹出任务。强制执行每仓库每日预算。启动 ECS Fargate 任务，带仓库 URL、问题正文和新的 Daytona 沙盒。

4. **环境推断。** 检测语言（Python、Node、Go、Rust）和包管理器（uv、pnpm、go mod、cargo）。如果不存在，动态生成 Dockerfile。

5. **智能体循环。** mini-swe-agent 或 SWE-agent v2，带 Claude Opus 4.7。工具：ripgrep、tree-sitter 仓库地图、read_file、edit_file、run_tests、git。硬限制：$20 成本、30 分钟挂钟时间、30 个智能体轮次。

6. **验证。** 循环结束后，在沙盒中运行完整测试套件。通过 jacoco / coverage.py 计算覆盖率差异。如果 CI 红色：停止，不打开 PR。如果覆盖率下降超过 2%：打开带 `needs-review` 标签的 PR。

7. **PR 发布。** 推送智能体分支。通过 GitHub API 打开 PR，包含：标题、理由、差异摘要、追踪 URL、成本、轮次。

8. **凭证卫生。** 工作者使用短期 GitHub App 安装令牌运行。日志在存档前清除密钥。

9. **评估。** 30 个不同难度的种子内部问题。测量通过率、PR 质量（差异大小、风格、覆盖率）、成本、延迟。与 Cursor Background Agents 和 AWS Remote SWE Agents 在相同问题上进行比较。

## 使用它

```
# 在 github.com 上
  - 用户用 `@agent fix this` 标记问题 #842
  - PR #1903 在 14 分钟后出现
  - 正文：
    > 修复了 widget.dedupe() 中由空比较器条目导致的 NPE。
    > 添加了回归测试 widget_test.go::TestDedupeNullComparator。
    > 覆盖率差异：+0.12%
    > 轮次：7  成本：$1.80  追踪：langfuse:...
    > 标签：needs-review
```

## 交付它

`outputs/skill-issue-to-pr.md` 是可交付成果。一个 GitHub App + 异步云工作者，将标记的问题转换为审查就绪的 PR，带有限制成本和范围凭证。

| 权重 | 标准 | 测量方式 |
|:-:|---|---|
| 25 | 30 个问题的通过率 | 端到端成功（CI 绿色 + 覆盖率正常） |
| 20 | PR 质量 | 差异大小、覆盖率差异、风格一致性 |
| 20 | 每个已解决问题的成本和延迟 | 每个 PR 的 $ 和挂钟时间 |
| 20 | 安全性 | 范围令牌、每仓库预算、无强制推送、凭证卫生 |
| 15 | 操作员用户体验 | 理由评论、重试便利性、@提及后续操作 |
| **100** | | |

## 练习

1. 添加"修复不稳定测试"模式：标签 `@agent stabilize-flake TestX` 在沙盒中运行测试 50 次，并提出一个最小更改来稳定它。

2. 在三个共享问题上与 Cursor Background Agents 比较成本。报告哪些工具在哪里获胜。

3. 实现预算仪表板：每仓库每日成本、每用户成本。异常时警报。

4. 构建"干运行"模式，在不运行 CI 的情况下打开草稿 PR，以便审查员可以廉价地检查计划。

5. 添加保留策略：超过 7 天未合并的 PR 分支自动删除。

## 关键术语

| 术语 | 人们说的 | 实际含义 |
|------|----------|----------|
| GitHub App | "范围机器人身份" | 具有细粒度权限 + 短期安装令牌的 App |
| 异步云智能体 | "后台智能体" | 在云沙盒中运行的非交互式工作者，而非终端 |
| 环境推断 | "Dockerfile 合成" | 检测语言 + 包管理器，如果不存在则生成 Dockerfile |
| 验证 | "沙盒内 CI" | 在打开 PR 之前在工作者内运行完整测试套件 |
| 覆盖率差异 | "覆盖率保持" | 从基础到智能体分支的测试覆盖率 % 变化 |
| 每仓库预算 | "每日上限" | 在调度器处强制执行的美元和 PR 数量上限 |
| 理由 | "PR 正文解释" | 智能体对更改内容和原因的摘要；PR 正文中必需 |

## 延伸阅读

- [AWS Remote SWE Agents](https://github.com/aws-samples/remote-swe-agents) —— 经典异步云智能体参考
- [SWE-agent](https://github.com/SWE-agent/SWE-agent) —— CLI 参考
- [Cursor Background Agents](https://docs.cursor.com/background-agent) —— 商业替代方案
- [OpenAI Codex (cloud)](https://openai.com/codex) —— 托管竞争对手
- [Google Jules](https://jules.google) —— Google 的托管版本
- [Factory Droids](https://www.factory.ai) —— 替代商业参考
- [GitHub App 文档](https://docs.github.com/en/apps) —— 范围机器人身份
- [Daytona 云沙盒](https://daytona.io) —— 参考沙盒
