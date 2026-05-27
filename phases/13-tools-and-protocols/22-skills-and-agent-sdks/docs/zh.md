# 技能和智能体 SDK — Anthropic 技能、AGENTS.md、OpenAI Apps SDK

> MCP 说"存在什么工具。"技能说"如何执行任务。"2026 年技术栈同时包含两者。Anthropic 的 Agent Skills（开放标准，2025 年 12 月）作为 SKILL.md 发布，具有渐进式披露。OpenAI 的 Apps SDK 是 MCP 加上小组件元数据。AGENTS.md（现在在 60,000+ 仓库中）位于仓库根目录，作为项目级智能体上下文。本课命名了每个涵盖的内容，并构建了一个最小的 SKILL.md + AGENTS.md 包，可以跨智能体传输。

**类型：** 学习
**语言：** Python (stdlib, SKILL.md 解析器和加载器)
**前置条件：** 阶段 13 · 07 (MCP 服务器)
**时间：** ~45 分钟

## 学习目标

- 区分三个层：AGENTS.md（项目上下文）、SKILL.md（可用知识）、MCP（工具）。
- 编写带有 YAML 前置内容和渐进式披露的 SKILL.md。
- 将技能以文件系统风格加载到智能体运行时中。
- 将技能与 MCP 服务器和 AGENTS.md 组合，以便一个包在 Claude Code、Cursor 和 Codex 中工作。

## 问题背景

工程师将发布说明编写工作流提炼为多步骤提示词："读取最新合并的 PR。按区域分组。总结每个。按照团队风格编写变更日志条目。发布到 Slack 草稿。"他们将其放在 Notion 文档中供团队使用。

现在他们想要从 Claude Code、Cursor 和 Codex CLI 使用此工作流。每个智能体都有不同的加载指令方式：Claude Code 斜杠命令、Cursor 规则、Codex `.codex.md`。工程师复制工作流三次并维护三个副本。

AGENTS.md 和 SKILL.md 一起修复这个问题：

- **AGENTS.md** 位于仓库根目录。每个兼容的智能体在会话开始时读取它。"这个项目如何工作？约定是什么？哪些命令运行测试？"
- **SKILL.md** 是一个可移植包：YAML 前置内容（名称、描述）+ markdown 主体 + 可选资源。支持技能的智能体按需按名称加载它们。
- **MCP**（阶段 13 · 06-14）处理技能需要调用的工具。

三层，一个可移植工件。

## 概念详解

### AGENTS.md（agents.md）

2025 年底发布，到 2026 年 4 月被 60,000+ 仓库采用。仓库根目录下的一个文件。格式：

```markdown
# Project: my-service

## 约定
- TypeScript 使用严格模式。
- 在 Python 端使用 Pydantic 进行模型。
- 测试使用 `pnpm test` 运行。

## 构建和运行
- `pnpm dev` 用于本地开发服务器。
- `pnpm build` 用于生产包。
```

智能体在会话开始时读取此文件，并使用它来校准其对该项目的行为。2026 年的每个编码智能体都支持 AGENTS.md：Claude Code、Cursor、Codex、Copilot Workspace、open code、Windsurf、Zed。

### SKILL.md 格式

Anthropic 的 Agent Skills（2025 年 12 月作为开放标准发布）：

```markdown
---
name: release-notes-writer
description: Write a changelog entry for the latest merged PRs following this project's style.
---

# Release notes writer

When invoked, run these steps:

1. List PRs merged since the last tag. Use `gh pr list --base main --state merged`.
2. Group by label: feature, fix, chore, docs.
3. For each PR in each group, write one line: `- <title> (#<num>)`.
4. Draft the release notes and stage them in CHANGELOG.md.

If the user says "ship", run `git tag vX.Y.Z` and `gh release create`.

## Notes

- Never include commits without a PR.
- Skip "chore" entries from the public changelog.
```

前置内容声明技能的身份。主体是技能加载时显示给模型的提示词。

### 渐进式披露

技能可以引用子资源，智能体仅在需要时获取。示例：

```
skills/
  release-notes-writer/
    SKILL.md
    style-guide.md
    template.md
    scripts/
      generate.sh
```

SKILL.md 说"请参阅 style-guide.md 了解样式规则。"智能体仅当技能正在主动运行时才拉取 style-guide.md。这避免了用模型可能不需要的细节膨胀提示词。

### 文件系统发现

智能体运行时扫描已知目录中的 SKILL.md 文件：

- `~/.anthropic/skills/*/SKILL.md`
- 项目 `./skills/*/SKILL.md`
- `~/.claude/skills/*/SKILL.md`

按文件夹名称和前置内容 `name` 加载。Claude Code、Anthropic Claude Agent SDK 和 SkillKit（跨智能体）都遵循此模式。

### Anthropic Claude Agent SDK

`@anthropic-ai/claude-agent-sdk`（TypeScript）和 `claude-agent-sdk`（Python）在会话开始时加载技能，将它们作为可调用的"智能体"暴露在运行时中。智能体循环在用户调用技能时调度到技能。

### OpenAI Apps SDK

2025 年 10 月发布；直接构建在 MCP 上。将 OpenAI 之前的 Connectors 和 Custom GPT Actions 统一到单个开发者表面下。Apps SDK 应用是：

- 一个 MCP 服务器（工具、资源、提示词）。
- 加上 ChatGPT UI 的小组件元数据。
- 加上用于交互式表面的可选 MCP Apps `ui://` 资源。

相同的协议，更丰富的 UX。

### 通过 SkillKit 实现跨智能体可移植性

像 SkillKit 和类似跨智能体分发层这样的工具将单个 SKILL.md 转换为 32+ AI 智能体（Claude Code、Cursor、Codex、Gemini CLI、OpenCode 等）的原生格式。一个真相源；多个消费者。

### 三层技术栈

| 层 | 文件 | 加载时间 | 目的 |
|-------|------|------------|---------|
| AGENTS.md | 仓库根目录 | 会话开始 | 项目级约定 |
| SKILL.md | 技能目录 | 技能被调用 | 可重用工作流 |
| MCP 服务器 | 外部进程 | 需要工具时 | 可调用操作 |

所有三个组合：智能体在会话开始时读取 AGENTS.md，用户调用技能，技能的指令包含 MCP 工具调用，智能体通过 MCP 客户端调度。

## 使用示例

`code/main.py` 提供了一个 stdlib SKILL.md 解析器和加载器。它在 `./skills/` 下发现技能，解析 YAML 前置内容和 markdown 主体，并生成按技能名称键控的字典。然后它模拟一个按名称调用 `release-notes-writer` 的智能体循环。

需要关注的点：

- YAML 前置内容使用最小的 stdlib 解析器解析（无 `pyyaml` 依赖）。
- 技能主体按原样存储；智能体在调用时将其前置到系统提示词。
- 通过 `read_subresource` 函数演示渐进式披露，该函数在需要时拉取引用的文件。

## 实战输出

本课生成 `outputs/skill-agent-bundle.md`。给定一个工作流，该技能生成组合的 SKILL.md + AGENTS.md + MCP 服务器蓝图包，可跨智能体移植。

## 练习

1. 运行 `code/main.py`。在 `skills/` 下添加第二个技能，并确认加载器选择它。

2. 为此课程仓库编写 AGENTS.md。包含测试命令、样式约定和阶段 13 心智模型。

3. 将团队内部文档中的多步骤工作流移植到 SKILL.md。验证它在 Claude Code 中加载。

4. 手动将技能转换为 Cursor 和 Codex 的原生规则格式。计算格式之间的差异 — 这是 SkillKit 自动化的转换表面。

5. 阅读 Anthropic Agent Skills 博客文章。识别课程加载器未涵盖的 Claude Agent SDK 中的一个功能。（提示：智能体子调用。）

## 关键术语

| 术语 | 人们的说法 | 实际含义 |
|------|-----------|---------|
| SKILL.md | "技能文件" | YAML 前置内容加 markdown 主体，由智能体运行时加载 |
| AGENTS.md | "仓库根目录智能体上下文" | 会话开始时读取的项目级约定文件 |
| 渐进式披露 | "延迟加载子资源" | 技能主体引用仅在需要时拉取的文件 |
| 前置内容 | "顶部的 YAML 块" | 在 `---` 分隔符中的元数据（名称、描述） |
| Claude Agent SDK | "Anthropic 的技能运行时" | `@anthropic-ai/claude-agent-sdk`，加载技能并路由 |
| OpenAI Apps SDK | "MCP + 小组件元数据" | OpenAI 基于 MCP 构建的开发者平台，加上 ChatGPT UI 钩子 |
| 技能发现 | "文件系统扫描" | 遍历已知目录查找 SKILL.md，按名称键控 |
| 跨智能体可移植性 | "一个技能多个智能体" | 通过 SkillKit 风格的工具将单个 SKILL.md 转换为 32+ 个智能体 |
| 智能体技能 | "可移植知识" | MCP 工具概念之外的可重用任务模板 |
| Apps SDK | "MCP 加上 ChatGPT UI" | Connectors 和 Custom GPT 统一在 MCP 上 |

## 延伸阅读

- [Anthropic — Agent Skills 公告](https://www.anthropic.com/engineering/equipping-agents-for-the-real-world-with-agent-skills) — 2025 年 12 月发布
- [Anthropic — Agent Skills 文档](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview) — SKILL.md 格式参考
- [OpenAI — Apps SDK](https://developers.openai.com/apps-sdk) — 用于 ChatGPT 的基于 MCP 的开发者平台
- [agents.md](https://agents.md/) — AGENTS.md 格式和采用列表
- [Anthropic — anthropics/skills GitHub](https://github.com/anthropics/skills) — 官方技能示例
