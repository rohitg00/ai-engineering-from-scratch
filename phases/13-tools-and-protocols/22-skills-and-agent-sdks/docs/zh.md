# Skills 与 Agent SDK — Anthropic Skills、AGENTS.md、OpenAI Apps SDK

> MCP 说明"存在什么工具"。Skills 说明"如何完成任务"。2026 年的技术栈将两者分层组合。Anthropic 的 Agent Skills（开放标准，2025 年 12 月）以 SKILL.md 的形式交付，支持渐进式披露。OpenAI 的 Apps SDK 是 MCP 加上微件元数据。AGENTS.md（现已应用于 60,000+ 仓库）位于仓库根目录，作为项目级的 agent 上下文。本课阐明各层覆盖的内容，并构建一个可在不同 agent 间移植的最小 SKILL.md + AGENTS.md 捆绑包。

**类型:** 学习  
**语言:** Python（stdlib，SKILL.md 解析器和加载器）  
**前置知识:** 阶段 13 · 07（MCP 服务器）  
**时长:** 约 45 分钟

## 学习目标

- 区分三个层次：AGENTS.md（项目上下文）、SKILL.md（可复用知识）、MCP（工具）。
- 编写包含 YAML 前置元数据和渐进式披露的 SKILL.md。
- 以文件系统方式将 skills 加载到 agent 运行时中。
- 将 skill 与 MCP 服务器和 AGENTS.md 组合，使一个包可在 Claude Code、Cursor 和 Codex 中使用。

## 问题

一位工程师将发布说明的编写工作流提炼成一个多步骤提示："读取最近合并的 PR。按领域分组。逐一汇总。按照团队风格编写变更日志条目。发布到 Slack 草稿。" 他们把这个提示放在团队 Notion 文档中。

现在他们想在 Claude Code、Cursor 和 Codex CLI 中使用此工作流。每种 agent 加载指令的方式不同：Claude Code 使用斜杠命令、Cursor 使用规则、Codex 使用 `.codex.md`。工程师将工作流复制了三次，并维护三个副本。

AGENTS.md 和 SKILL.md 共同解决了这个问题：

- **AGENTS.md** 位于仓库根目录。每个兼容的 agent 在会话启动时读取它。"这个项目如何工作？有什么约定？哪些命令运行测试？"
- **SKILL.md** 是一个可移植的捆绑包：YAML 前置元数据（名称、描述）+ Markdown 正文 + 可选资源。支持 skills 的 agent 按需按名称加载。
- **MCP**（阶段 13 · 06-14）处理 skill 需要调用的工具。

三个层次，一个可移植的制品。

## 概念

### AGENTS.md（agents.md）

2025 年末发布，截至 2026 年 4 月已被 60,000+ 仓库采用。仓库根目录下一个文件。格式：

```markdown
# 项目: my-service

## 约定
- TypeScript，严格模式。
- Python 侧使用 Pydantic 进行模型定义。
- 使用 `pnpm test` 运行测试。

## 构建与运行
- `pnpm dev` 启动本地开发服务器。
- `pnpm build` 执行生产构建。
```

Agent 在会话启动时读取此文件，并据此调整针对该项目的行为。2026 年所有主流编码 agent 都支持 AGENTS.md：Claude Code、Cursor、Codex、Copilot Workspace、opencode、Windsurf、Zed。

### SKILL.md 格式

Anthropic 的 Agent Skills（于 2025 年 12 月作为开放标准发布）：

```markdown
---
name: release-notes-writer
description: 按照本项目风格为最近合并的 PR 编写变更日志条目。
---

# 发布说明编写器

调用时，执行以下步骤：

1. 列出自上一个标签以来合并的 PR。使用 `gh pr list --base main --state merged`。
2. 按标签分组：feature、fix、chore、docs。
3. 对每组中的每个 PR，编写一行：`- <标题> (#<编号>)`。
4. 起草发布说明并将其暂存到 CHANGELOG.md 中。

如果用户说"发布"，运行 `git tag vX.Y.Z` 和 `gh release create`。

## 备注

- 绝不包含没有 PR 的提交。
- 从公开变更日志中跳过"chore"条目。
```

前置元数据声明了 skill 的身份。正文是在 skill 加载时展示给模型的提示内容。

### 渐进式披露

Skills 可以引用子资源，agent 仅在需要时获取这些资源。示例：

```
skills/
  release-notes-writer/
    SKILL.md
    style-guide.md
    template.md
    scripts/
      generate.sh
```

SKILL.md 中写明"参见 style-guide.md 了解风格规则"。agent 仅在 skill 实际运行时才拉取 style-guide.md。这避免了用模型可能不需要的细节来膨胀提示内容。

### 文件系统发现

Agent 运行时扫描已知目录以查找 SKILL.md 文件：

- `~/.anthropic/skills/*/SKILL.md`
- 项目 `./skills/*/SKILL.md`
- `~/.claude/skills/*/SKILL.md`

通过文件夹名称和前置元数据的 `name` 字段进行加载。Claude Code、Anthropic Claude Agent SDK 和 SkillKit（跨 agent）均遵循此模式。

### Anthropic Claude Agent SDK

`@anthropic-ai/claude-agent-sdk`（TypeScript）和 `claude-agent-sdk`（Python）在会话启动时加载 skills，并在运行时中将其作为可调用的"agent"公开。当用户调用某个 skill 时，agent 循环会分派给该 skill。

### OpenAI Apps SDK

2025 年 10 月发布；直接构建于 MCP 之上。将 OpenAI 之前的 Connectors 和 Custom GPT Actions 统一到一个开发者界面下。Apps SDK 应用包含：

- 一个 MCP 服务器（工具、资源、提示）。
- 加上用于 ChatGPT UI 的微件元数据。
- 加上一个可选的 MCP Apps `ui://` 资源，用于交互式界面。

相同的协议，更丰富的用户体验。

### 通过 SkillKit 实现跨 agent 可移植性

SkillKit 及类似的跨 agent 分发层工具，将单个 SKILL.md 翻译成 32+ 种 AI agent 的原生格式（Claude Code、Cursor、Codex、Gemini CLI、OpenCode 等）。单一事实来源，多种消费端。

### 三层技术栈

| 层 | 文件 | 加载时机 | 用途 |
|-------|------|-------------|---------|
| AGENTS.md | 仓库根目录 | 会话启动 | 项目级约定 |
| SKILL.md | skills 目录 | skill 被调用时 | 可复用工作流 |
| MCP 服务器 | 外部进程 | 需要工具时 | 可调用的动作 |

三者协同工作：agent 在会话启动时读取 AGENTS.md，用户调用某个 skill，skill 的指令中包含 MCP 工具调用，agent 通过 MCP 客户端进行分派。

## 使用方式

`code/main.py` 提供了一个基于标准库的 SKILL.md 解析器和加载器。它发现 `./skills/` 下的 skills，解析 YAML 前置元数据和 Markdown 正文，并生成一个以 skill 名称为键的字典。然后模拟一个 agent 循环，按名称调用 `release-notes-writer`。

值得关注的点：

- 使用极简的标准库解析器解析 YAML 前置元数据（不依赖 `pyyaml`）。
- Skill 正文原样存储；agent 在调用时将其前置到系统提示中。
- 通过 `read_subresource` 函数演示渐进式披露，该函数按需拉取引用的文件。

## 交付成果

本课生成 `outputs/skill-agent-bundle.md`。给定一个工作流，skill 会生成合并的 SKILL.md + AGENTS.md + MCP 服务器蓝图捆绑包，可在各 agent 间移植。

## 练习

1. 运行 `code/main.py`。在 `skills/` 下添加第二个 skill，确认加载器能识别它。

2. 为本课程仓库编写一个 AGENTS.md。包含测试命令、风格约定以及阶段 13 的心智模型。

3. 将团队内部文档中的多步骤工作流移植到 SKILL.md 中。验证它能在 Claude Code 中加载。

4. 手动将该 skill 翻译成 Cursor 和 Codex 的原生规则格式。比较两种格式之间的差异——这就是 SkillKit 自动完成的翻译面。

5. 阅读 Anthropic Agent Skills 博客文章。找出 Claude Agent SDK 中本课加载器未覆盖的一个特性。（提示：agent 子调用。）

## 关键术语

| 术语 | 人们常说的 | 实际含义 |
|------|----------------|------------------------|
| SKILL.md | "skill 文件" | YAML 前置元数据加 Markdown 正文，由 agent 运行时加载 |
| AGENTS.md | "仓库根目录的 agent 上下文" | 会话启动时读取的项目级约定文件 |
| 渐进式披露 | "惰性加载子资源" | Skill 正文引用文件，仅在需要时拉取 |
| 前置元数据 | "顶部的 YAML 块" | 由 `---` 分隔符包裹的元数据（名称、描述） |
| Claude Agent SDK | "Anthropic 的 skill 运行时" | `@anthropic-ai/claude-agent-sdk`，加载 skills 并进行路由 |
| OpenAI Apps SDK | "MCP + 微件元数据" | 构建于 MCP 之上的 OpenAI 开发界面，加上 ChatGPT UI 钩子 |
| Skill 发现 | "文件系统扫描" | 遍历已知目录寻找 SKILL.md，按名称索引 |
| 跨 agent 可移植性 | "一个 skill 多 agent 使用" | 通过 SkillKit 类工具将一份 SKILL.md 翻译到 32+ 种 agent |
| Agent Skill | "可移植的知识" | MCP 工具概念之外的可复用任务模板 |
| Apps SDK | "MCP 加 ChatGPT UI" | 在 MCP 上统一的 Connectors 和 Custom GPTs |

## 延伸阅读

- [Anthropic — Agent Skills 公告](https://www.anthropic.com/engineering/equipping-agents-for-the-real-world-with-agent-skills) — 2025 年 12 月发布
- [Anthropic — Agent Skills 文档](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview) — SKILL.md 格式参考
- [OpenAI — Apps SDK](https://developers.openai.com/apps-sdk) — 基于 MCP 的 ChatGPT 开发者平台
- [agents.md](https://agents.md/) — AGENTS.md 格式与采纳列表
- [Anthropic — anthropics/skills GitHub](https://github.com/anthropics/skills) — 官方 skill 示例
