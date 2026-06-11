# 技能与智能体 SDK —— Anthropic Skills、AGENTS.md、OpenAI Apps SDK

> MCP 说"存在什么工具"。技能说"如何做任务"。2026 年技术栈将两者分层。Anthropic 的智能体技能（开放标准，2025 年 12 月）以 SKILL.md 形式发布，支持渐进式披露。OpenAI 的 Apps SDK 是 MCP 加小组件元数据。AGENTS.md（现已在 60,000 多个仓库中）位于仓库根目录，作为项目级智能体上下文。本课介绍每个涵盖的内容，并构建一个最小的 SKILL.md + AGENTS.md 包，可在智能体之间传递。

**类型：** Learn
**语言：** Python（stdlib，SKILL.md 解析器和加载器）
**前置知识：** Phase 13 · 07（MCP 服务器）
**时间：** ~45 分钟

## 学习目标

- 区分三个层次：AGENTS.md（项目上下文）、SKILL.md（可重用知识）、MCP（工具）。
- 编写带 YAML 前言和渐进式披露的 SKILL.md。
- 以文件系统风格将技能加载到智能体运行时。
- 将技能与 MCP 服务器和 AGENTS.md 组合，使一个包在 Claude Code、Cursor 和 Codex 中工作。

## 问题所在

一位工程师将发布说明撰写工作流提炼为多步骤提示："阅读最新合并的 PR。按区域分组。总结每个。按照团队风格撰写变更日志条目。发布到 Slack 草稿。"他们将其放在团队的 Notion 文档中。

现在他们希望从 Claude Code、Cursor 和 Codex CLI 中使用此工作流。每个智能体有不同的加载指令方式：Claude Code 斜杠命令、Cursor 规则、Codex `.codex.md`。工程师复制工作流三次并维护三个副本。

AGENTS.md 和 SKILL.md 一起修复了这个问题：

- **AGENTS.md** 位于仓库根目录。每个兼容的智能体在会话开始时读取它。"这个项目如何工作？约定是什么？哪些命令运行测试？"
- **SKILL.md** 是一个可移植的包：YAML 前言（名称、描述）+ markdown 正文 + 可选资源。支持技能的智能体按需按名称加载它们。
- **MCP**（Phase 13 · 06-14）处理技能需要调用的工具。

三个层次，一个可移植的工件。

## 核心概念

### AGENTS.md（agents.md）

2025 年末推出，到 2026 年 4 月被 60,000 多个仓库采用。仓库根目录中的一个文件。格式：

```markdown
# 项目：my-service

## 约定
- TypeScript 严格模式。
- Python 端使用 Pydantic 作为模型。
- 测试使用 `pnpm test` 运行。

## 构建和运行
- `pnpm dev` 用于本地开发服务器。
- `pnpm build` 用于生产包。
```

智能体在会话开始时读取此内容，并用于校准它们在该项目上的行为。2026 年的每个编码智能体都支持 AGENTS.md：Claude Code、Cursor、Codex、Copilot Workspace、opencode、Windsurf、Zed。

### SKILL.md 格式

Anthropic 的智能体技能（2025 年 12 月作为开放标准发布）：

```markdown
---
name: release-notes-writer
description: 按照此项目的风格为最新合并的 PR 撰写变更日志条目。
---

# 发布说明撰写者

调用时，运行以下步骤：

1. 列出自上次标签以来合并的 PR。使用 `gh pr list --base main --state merged`。
2. 按标签分组：feature、fix、chore、docs。
3. 对于每组中的每个 PR，写一行：`- <title> (#<num>)`。
4. 起草发布说明并将其暂存在 CHANGELOG.md 中。

如果用户说"ship"，运行 `git tag vX.Y.Z` 和 `gh release create`。

## 备注

- 永远不要包含没有 PR 的提交。
- 从公共变更日志中跳过"chore"条目。
```

前言声明技能的身份。正文是技能加载时显示给模型的提示。

### 渐进式披露

技能可以引用智能体仅在需要时才获取的子资源。示例：

```
skills/
  release-notes-writer/
    SKILL.md
    style-guide.md
    template.md
    scripts/
      generate.sh
```

SKILL.md 说"有关样式规则，请参阅 style-guide.md。"智能体仅在技能 actively 运行时才拉取 style-guide.md。这避免了用模型可能不需要的细节膨胀提示。

### 文件系统发现

智能体运行时扫描已知目录中的 SKILL.md 文件：

- `~/.anthropic/skills/*/SKILL.md`
- 项目 `./skills/*/SKILL.md`
- `~/.claude/skills/*/SKILL.md`

加载按文件夹名称和前言 `name` 进行。Claude Code、Anthropic Claude Agent SDK 和 SkillKit（跨智能体）都遵循此模式。

### Anthropic Claude Agent SDK

`@anthropic-ai/claude-agent-sdk`（TypeScript）和 `claude-agent-sdk`（Python）在会话开始时加载技能，将它们作为运行时内部可调用的"智能体"暴露。当用户调用时，智能体循环分发到技能。

### OpenAI Apps SDK

2025 年 10 月推出；直接基于 MCP 构建。将 OpenAI 之前的 Connectors 和 Custom GPT Actions 统一在单一开发者表面下。Apps SDK 应用是：

- 一个 MCP 服务器（工具、资源、提示）。
- 加上 ChatGPT UI 的小组件件元数据。
- 加上可选的 MCP Apps `ui://` 资源用于交互式表面。

相同的协议，更丰富的用户体验。

### 通过 SkillKit 实现跨智能体可移植性

SkillKit 和类似的跨智能体分发层等工具将单个 SKILL.md 转换为 32 个以上 AI 智能体（Claude Code、Cursor、Codex、Gemini CLI、OpenCode 等）的本地格式。一个真相来源；多个消费者。

### 三层技术栈

| 层次 | 文件 | 加载时机 | 目的 |
|-------|------|-------------|---------|
| AGENTS.md | 仓库根目录 | 会话开始 | 项目级约定 |
| SKILL.md | 技能目录 | 技能调用时 | 可重用工作流 |
| MCP 服务器 | 外部进程 | 需要工具时 | 可调用操作 |

三者组合：智能体在会话开始时读取 AGENTS.md，用户调用技能，技能的指令包括 MCP 工具调用，智能体通过 MCP 客户端分发。

## 使用它

`code/main.py` 提供一个 stdlib SKILL.md 解析器和加载器。它在 `./skills/` 下发现技能，解析 YAML 前言加 markdown 正文，并产出按技能名称键控的字典。然后它模拟一个按名称调用 `release-notes-writer` 的智能体循环。

需要查看的内容：

- YAML 前言使用最小 stdlib 解析器解析（无 `pyyaml` 依赖）。
- 技能正文原样存储；智能体在调用时将其前置到系统提示。
- 渐进式披露通过 `read_subresource` 函数演示，该函数按需拉取引用的文件。

## 交付它

本课产出 `outputs/skill-agent-bundle.md`。给定工作流，该技能产出组合的 SKILL.md + AGENTS.md + MCP-server-blueprint 包，可在智能体之间移植。

## 练习

1. 运行 `code/main.py`。在 `skills/` 下添加第二个技能并确认加载器拾取它。

2. 为此课程仓库编写 AGENTS.md。包括测试命令、样式约定和 Phase 13 心智模型。

3. 将多步骤工作流从团队的内部文档移植到 SKILL.md。验证它在 Claude Code 中加载。

4. 手动将技能转换为 Cursor 和 Codex 的本地规则格式。计算格式之间的差异 —— 这是 SkillKit 自动化的翻译表面。

5. 阅读 Anthropic 智能体技能博客文章。识别 Claude Agent SDK 中本课加载器未涵盖的一个功能。（提示：智能体子调用。）

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|----------------|------------------------|
| SKILL.md | "技能文件" | YAML 前言加 markdown 正文，由智能体运行时加载 |
| AGENTS.md | "仓库根智能体上下文" | 会话开始时读取的项目级约定文件 |
| 渐进式披露 | "懒加载子资源" | 技能正文引用仅在需要时才拉取的文件 |
| 前言 | "顶部 YAML 块" | `---` 分隔符中的元数据（名称、描述） |
| Claude Agent SDK | "Anthropic 的技能运行时" | `@anthropic-ai/claude-agent-sdk`，加载技能并路由 |
| OpenAI Apps SDK | "MCP + 小组件元数据" | OpenAI 基于 MCP 加 ChatGPT UI 钩子的开发者表面 |
| 技能发现 | "文件系统扫描" | 遍历已知目录查找 SKILL.md，按名称键控 |
| 跨智能体可移植性 | "一个技能多个智能体" | 通过 SkillKit 风格工具将单个 SKILL.md 转换为 32 个以上智能体 |
| 智能体技能 | "可移植知识" | MCP 工具概念之外的可重用任务模板 |
| Apps SDK | "MCP 加 ChatGPT UI" | 基于 MCP 统一的 Connectors 和 Custom GPTs |

## 延伸阅读

- [Anthropic — 智能体技能公告](https://www.anthropic.com/engineering/equipping-agents-for-the-real-world-with-agent-skills) — 2025 年 12 月发布
- [Anthropic — 智能体技能文档](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview) — SKILL.md 格式参考
- [OpenAI — Apps SDK](https://developers.openai.com/apps-sdk) — ChatGPT 基于 MCP 的开发者平台
- [agents.md](https://agents.md/) — AGENTS.md 格式和采用列表
- [Anthropic — anthropics/skills GitHub](https://github.com/anthropics/skills) — 官方技能示例
