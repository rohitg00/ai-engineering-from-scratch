# Skills 与 Agent SDK——Anthropic Skills、AGENTS.md、OpenAI Apps SDK

> 译注：本文译自同目录 [`en.md`](./en.md)。术语遵循仓根 [TRANSLATION_GUIDE.md](../../../../TRANSLATION_GUIDE.md)。

> MCP 说的是「有哪些 tool」，Skills 说的是「这件事怎么做」。2026 年的技术栈两层并用。Anthropic 的 Agent Skills（开放标准，2025 年 12 月）以 SKILL.md 形式发布，支持渐进式披露（progressive disclosure）。OpenAI 的 Apps SDK 则是 MCP 加上 widget 元数据。AGENTS.md（已被 60,000+ 仓库采用）则坐镇仓库根目录，作为项目级的 agent 上下文。本课会把每一层各管什么讲清楚，并构建一个最小可用的 SKILL.md + AGENTS.md 组合包，让它能在多个 agent 之间通用。

**Type:** Learn
**Languages:** Python (stdlib, SKILL.md parser and loader)
**Prerequisites:** Phase 13 · 07 (MCP server)
**Time:** ~45 minutes

## 学习目标（Learning Objectives）

- 区分三个层级：AGENTS.md（项目上下文）、SKILL.md（可复用的做事方法）、MCP（tool）。
- 编写带 YAML frontmatter 和渐进式披露的 SKILL.md。
- 以文件系统的方式把 skill 加载进 agent 运行时。
- 把一个 skill、一个 MCP server、一份 AGENTS.md 组合起来，让同一个包在 Claude Code、Cursor 和 Codex 里都能跑。

## 问题（The Problem）

某工程师把「写发布说明」的工作流提炼成了一段多步 prompt：「读一遍最近合入的 PR。按领域分组。每个总结一下。按团队风格写一条 changelog。发到 Slack 草稿里。」他把这段写进了团队的 Notion 文档。

现在他想从 Claude Code、Cursor、Codex CLI 里都能用上这套工作流。但每个 agent 加载指令的方式都不同：Claude Code 是 slash-command，Cursor 是 rules，Codex 是 `.codex.md`。这位工程师只能把工作流复制三份，三份分别维护。

AGENTS.md 和 SKILL.md 一起解决了这个问题：

- **AGENTS.md** 放在仓库根目录。所有兼容的 agent 在 session 启动时都会读它。「这个项目怎么跑？有哪些约定？哪个命令跑测试？」
- **SKILL.md** 是一个可移植的包：YAML frontmatter（name、description）+ markdown 正文 + 可选资源。支持 skill 的 agent 会按名称按需加载。
- **MCP**（Phase 13 · 06-14）则负责 skill 需要调用的 tool。

三层架构，一份可移植的产物。

## 概念（The Concept）

### AGENTS.md（agents.md）

2025 年底发布，截至 2026 年 4 月已被 60,000+ 仓库采用。仓库根目录一个文件，格式如下：

```markdown
# Project: my-service

## Conventions
- TypeScript with strict mode.
- Use Pydantic for models on the Python side.
- Tests run with `pnpm test`.

## Build and run
- `pnpm dev` for local dev server.
- `pnpm build` for production bundle.
```

agent 在 session 启动时读这份文件，并据此校准自己在该项目里的行为。2026 年所有主流编码 agent 都支持 AGENTS.md：Claude Code、Cursor、Codex、Copilot Workspace、opencode、Windsurf、Zed。

### SKILL.md 格式（SKILL.md format）

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

frontmatter 声明了 skill 的身份。正文则是 skill 加载时呈现给模型的 prompt。

### 渐进式披露（Progressive disclosure）

skill 可以引用一些子资源，agent 只在需要时才去取。例如：

```
skills/
  release-notes-writer/
    SKILL.md
    style-guide.md
    template.md
    scripts/
      generate.sh
```

SKILL.md 写「具体风格规则见 style-guide.md」。只有当 skill 真正在跑时，agent 才会去拉 style-guide.md。这样可以避免把模型可能根本用不到的细节一股脑塞进 prompt。

### 文件系统发现（Filesystem discovery）

agent 运行时会扫描已知目录，查找 SKILL.md 文件：

- `~/.anthropic/skills/*/SKILL.md`
- 项目下 `./skills/*/SKILL.md`
- `~/.claude/skills/*/SKILL.md`

加载依据是文件夹名和 frontmatter 里的 `name`。Claude Code、Anthropic Claude Agent SDK 以及 SkillKit（跨 agent）都遵循这个模式。

### Anthropic Claude Agent SDK

`@anthropic-ai/claude-agent-sdk`（TypeScript）和 `claude-agent-sdk`（Python）会在 session 启动时加载 skill，并把它们作为可调用的「agent」暴露在运行时内部。当用户调用某个 skill 时，agent loop 会把任务派发给它。

### OpenAI Apps SDK

2025 年 10 月发布，直接构建在 MCP 之上。把 OpenAI 之前的 Connectors 和 Custom GPT Actions 统一到了一个开发者表面之下。一个 Apps SDK 应用包含：

- 一个 MCP server（tool、resource、prompt）。
- 加上面向 ChatGPT UI 的 widget 元数据。
- 加上一个可选的 MCP Apps `ui://` resource，用于交互式表面。

同一套协议，更丰富的 UX。

### 通过 SkillKit 实现跨 agent 可移植（Cross-agent portability via SkillKit）

像 SkillKit 这类跨 agent 分发层工具，可以把同一份 SKILL.md 翻译成 32+ 种 AI agent 各自的原生格式（Claude Code、Cursor、Codex、Gemini CLI、OpenCode 等）。一份 source of truth，多端消费。

### 三层栈（The three-layer stack）

| 层级 | 文件 | 加载时机 | 作用 |
|-------|------|-------------|---------|
| AGENTS.md | 仓库根目录 | session 启动 | 项目级约定 |
| SKILL.md | skills 目录 | skill 被调用 | 可复用工作流 |
| MCP server | 外部进程 | 需要 tool 时 | 可调用动作 |

三者协同：agent 在 session 启动时读 AGENTS.md，用户调用某个 skill，skill 的指令里包含 MCP 的 tool 调用，agent 通过 MCP client 派发。

## 用起来（Use It）

`code/main.py` 里给了一个仅依赖 stdlib 的 SKILL.md 解析器和加载器。它会在 `./skills/` 下发现 skill，解析 YAML frontmatter 加 markdown 正文，产出一个以 skill 名为 key 的 dict。然后模拟一个 agent loop，按名调用 `release-notes-writer`。

要重点看的几处：

- YAML frontmatter 用一个极简的 stdlib 解析器解析（不依赖 `pyyaml`）。
- skill 正文逐字保存；调用时 agent 把它拼到 system prompt 前面。
- 渐进式披露的演示：通过一个 `read_subresource` 函数按需拉取被引用的文件。

## 上线部署（Ship It）

本课会产出 `outputs/skill-agent-bundle.md`。给定一个工作流，skill 会产出 SKILL.md + AGENTS.md + MCP-server-blueprint 的组合包，可在多个 agent 之间通用。

## 练习（Exercises）

1. 跑一下 `code/main.py`。在 `skills/` 下加第二个 skill，确认 loader 能识别到它。

2. 给本课程仓写一份 AGENTS.md。包含测试命令、风格约定、以及 Phase 13 的心智模型。

3. 把你团队内部文档里某个多步工作流移植成 SKILL.md。在 Claude Code 里验证它能加载。

4. 手动把这个 skill 翻译成 Cursor 和 Codex 各自的原生 rule 格式。数一下格式之间的 diff——这就是 SkillKit 自动化掉的那块翻译表面。

5. 读一遍 Anthropic 的 Agent Skills 博客文章。指出 Claude Agent SDK 里有哪个特性是本课的 loader 没覆盖到的。（提示：agent 子调用。）

## 关键术语（Key Terms）

| 术语 | 大家怎么说 | 实际含义 |
|------|----------------|------------------------|
| SKILL.md | 「那个 skill 文件」 | YAML frontmatter 加 markdown 正文，由 agent 运行时加载 |
| AGENTS.md | 「仓库根目录的 agent 上下文」 | 项目级约定文件，session 启动时读取 |
| Progressive disclosure | 「懒加载子资源」 | skill 正文引用其他文件，仅在需要时拉取 |
| Frontmatter | 「文件顶部那块 YAML」 | 用 `---` 分隔的元数据（name、description） |
| Claude Agent SDK | 「Anthropic 的 skill 运行时」 | `@anthropic-ai/claude-agent-sdk`，加载 skill 并做路由 |
| OpenAI Apps SDK | 「MCP 加上 widget meta」 | OpenAI 在 MCP 之上构建的开发表面，外加 ChatGPT UI 钩子 |
| Skill discovery | 「文件系统扫描」 | 扫描已知目录里的 SKILL.md，按 name 索引 |
| Cross-agent portability | 「一份 skill 多个 agent」 | 通过 SkillKit 类工具把一份 SKILL.md 翻译给 32+ agent |
| Agent Skill | 「可移植的做事方法」 | 跳出 MCP 的 tool 概念之外的可复用任务模板 |
| Apps SDK | 「MCP 加上 ChatGPT UI」 | 把 Connectors 和 Custom GPTs 统一到 MCP 之上 |

## 延伸阅读（Further Reading）

- [Anthropic — Agent Skills announcement](https://www.anthropic.com/engineering/equipping-agents-for-the-real-world-with-agent-skills) — 2025 年 12 月发布
- [Anthropic — Agent Skills docs](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview) — SKILL.md 格式参考
- [OpenAI — Apps SDK](https://developers.openai.com/apps-sdk) — 基于 MCP 的 ChatGPT 开发者平台
- [agents.md](https://agents.md/) — AGENTS.md 格式与采用清单
- [Anthropic — anthropics/skills GitHub](https://github.com/anthropics/skills) — 官方 skill 示例
