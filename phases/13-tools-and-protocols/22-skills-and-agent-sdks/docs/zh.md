# 22 · 技能与智能体 SDK —— Anthropic Skills、AGENTS.md、OpenAI Apps SDK

> MCP 回答的是「有哪些工具」。技能（Skills）回答的是「如何完成一个任务」。2026 年的技术栈把两者叠加起来使用。Anthropic 的智能体技能（Agent Skills，开放标准，2025 年 12 月发布）以带渐进式披露（progressive disclosure）的 SKILL.md 形式交付。OpenAI 的 Apps SDK 则是 MCP 加上小部件（widget）元数据。AGENTS.md（如今已被 60,000 多个代码仓库采用）位于仓库根目录，作为项目级的智能体上下文。本课会厘清各自的职责范围，并构建一个能跨智能体迁移的最小 SKILL.md + AGENTS.md 组合包。

**类型：** 学习
**语言：** Python（标准库，SKILL.md 解析器与加载器）
**前置：** 阶段 13 · 07（MCP 服务器）
**时长：** 约 45 分钟

## 学习目标

- 区分三个层次：AGENTS.md（项目上下文）、SKILL.md（可复用的技能诀窍）、MCP（工具）。
- 编写带 YAML 前置元数据（frontmatter）与渐进式披露的 SKILL.md。
- 以文件系统方式将技能加载到智能体运行时。
- 把一个技能与一个 MCP 服务器和一个 AGENTS.md 组合起来，使同一个包能在 Claude Code、Cursor 和 Codex 中工作。

## 问题所在

一位工程师把一套撰写发布说明（release notes）的工作流提炼为一段多步骤提示词：「读取最近合并的 PR。按领域分组。逐个总结。按团队风格撰写更新日志条目。发布到 Slack 草稿。」他把它放进了团队的 Notion 文档里。

现在他想在 Claude Code、Cursor 和 Codex CLI 中都使用这套工作流。但每个智能体加载指令的方式各不相同：Claude Code 用斜杠命令（slash-commands），Cursor 用规则（rules），Codex 用 `.codex.md`。于是这位工程师把工作流复制了三份，并维护着三份副本。

AGENTS.md 与 SKILL.md 结合起来即可解决这个问题：

- **AGENTS.md** 位于仓库根目录。每个兼容的智能体都会在会话启动时读取它。「这个项目是怎么运作的？有哪些约定？哪些命令用于跑测试？」
- **SKILL.md** 是一个可移植的组合包：YAML 前置元数据（name、description）+ markdown 正文 + 可选资源。支持技能的智能体会按名称按需加载它们。
- **MCP**（阶段 13 · 06-14）负责处理技能需要调用的工具。

三个层次，一个可移植的产物。

## 核心概念

### AGENTS.md（agents.md）

于 2025 年底推出，到 2026 年 4 月已被 60,000 多个代码仓库采用。仓库根目录下的一个文件。格式如下：

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

智能体在会话启动时读取它，并据此校准自己在该项目中的行为。2026 年的每一款编码智能体都支持 AGENTS.md：Claude Code、Cursor、Codex、Copilot Workspace、opencode、Windsurf、Zed。

### SKILL.md 格式

Anthropic 的智能体技能（2025 年 12 月作为开放标准发布）：

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

前置元数据声明了技能的身份。正文则是技能加载时呈现给模型的提示词。

### 渐进式披露

技能可以引用一些子资源，智能体仅在需要时才去获取它们。例如：

```
skills/
  release-notes-writer/
    SKILL.md
    style-guide.md
    template.md
    scripts/
      generate.sh
```

SKILL.md 中写着「风格规则参见 style-guide.md」。智能体只有在该技能正在实际运行时才会拉取 style-guide.md。这样可以避免用模型可能并不需要的细节去撑大提示词。

### 文件系统发现

智能体运行时会扫描一些已知目录来查找 SKILL.md 文件：

- `~/.anthropic/skills/*/SKILL.md`
- 项目内的 `./skills/*/SKILL.md`
- `~/.claude/skills/*/SKILL.md`

加载依据是文件夹名称和前置元数据中的 `name`。Claude Code、Anthropic Claude 智能体 SDK（Claude Agent SDK），以及 SkillKit（跨智能体）都遵循这一模式。

### Anthropic Claude 智能体 SDK（Claude Agent SDK）

`@anthropic-ai/claude-agent-sdk`（TypeScript）和 `claude-agent-sdk`（Python）会在会话启动时加载技能，并将它们作为运行时内部可调用的「智能体（agents）」暴露出来。当用户调用某个技能时，智能体循环（agent loop）会将其分派出去。

### OpenAI Apps SDK

于 2025 年 10 月推出；直接构建在 MCP 之上。它将 OpenAI 此前的连接器（Connectors）和自定义 GPT 动作（Custom GPT Actions）统一到了单一的开发者界面之下。一个 Apps SDK 应用由以下部分组成：

- 一个 MCP 服务器（工具、资源、提示词）。
- 加上面向 ChatGPT 界面的小部件元数据。
- 加上一个可选的 MCP Apps `ui://` 资源，用于交互式界面。

协议相同，体验更丰富。

### 通过 SkillKit 实现跨智能体可移植性

诸如 SkillKit 之类的工具，以及类似的跨智能体分发层，可以把单个 SKILL.md 翻译成 32 种以上 AI 智能体各自的原生格式（Claude Code、Cursor、Codex、Gemini CLI、OpenCode 等）。单一事实来源，多方消费。

### 三层技术栈

| 层次 | 文件 | 加载时机 | 用途 |
|-------|------|-------------|---------|
| AGENTS.md | 仓库根目录 | 会话启动时 | 项目级约定 |
| SKILL.md | 技能目录 | 技能被调用时 | 可复用工作流 |
| MCP 服务器 | 外部进程 | 需要工具时 | 可调用的动作 |

三者协同组合：智能体在会话启动时读取 AGENTS.md，用户调用一个技能，技能的指令中包含 MCP 工具调用，智能体则通过 MCP 客户端进行分派。

## 动手实践

`code/main.py` 提供了一个基于标准库的 SKILL.md 解析器与加载器。它会发现 `./skills/` 下的技能，解析 YAML 前置元数据和 markdown 正文，并生成一个以技能名称为键的字典。随后它模拟一个智能体循环，按名称调用 `release-notes-writer`。

需要重点关注的地方：

- 用一个极简的标准库解析器解析 YAML 前置元数据（不依赖 `pyyaml`）。
- 技能正文原样存储；智能体在调用时将其前置到系统提示词中。
- 通过 `read_subresource` 函数演示渐进式披露，该函数按需拉取被引用的文件。

## 交付实战

本课会产出 `outputs/skill-agent-bundle.md`。给定一个工作流，该技能会产出 SKILL.md + AGENTS.md + MCP 服务器蓝图组合而成的包，可跨智能体移植。

## 练习

1. 运行 `code/main.py`。在 `skills/` 下新增第二个技能，确认加载器能识别到它。

2. 为本课程仓库编写一个 AGENTS.md。包含测试命令、风格约定，以及阶段 13 的心智模型。

3. 把团队内部文档中的一套多步骤工作流移植成一个 SKILL.md。验证它能在 Claude Code 中加载。

4. 手动把该技能翻译成 Cursor 和 Codex 的原生规则格式。统计各格式之间的差异（diff）—— 这正是 SkillKit 所自动化的翻译面（translation surface）。

5. 阅读 Anthropic 的智能体技能（Agent Skills）博客文章。找出 Claude 智能体 SDK 中一个本课加载器未覆盖的特性。（提示：智能体子调用，agent sub-invocation。）

## 关键术语

| 术语 | 人们常说 | 实际含义 |
|------|----------------|------------------------|
| SKILL.md | 「技能文件」 | YAML 前置元数据加 markdown 正文，由智能体运行时加载 |
| AGENTS.md | 「仓库根目录的智能体上下文」 | 在会话启动时读取的项目级约定文件 |
| 渐进式披露（Progressive disclosure） | 「懒加载子资源」 | 技能正文引用的文件仅在需要时拉取 |
| 前置元数据（Frontmatter） | 「顶部的 YAML 块」 | 用 `---` 分隔的元数据（name、description） |
| Claude 智能体 SDK（Claude Agent SDK） | 「Anthropic 的技能运行时」 | `@anthropic-ai/claude-agent-sdk`，加载并路由技能 |
| OpenAI Apps SDK | 「MCP + 小部件元数据」 | OpenAI 构建在 MCP 加 ChatGPT 界面钩子之上的开发者界面 |
| 技能发现（Skill discovery） | 「文件系统扫描」 | 遍历已知目录查找 SKILL.md，以名称为键 |
| 跨智能体可移植性（Cross-agent portability） | 「一个技能多个智能体」 | 通过 SkillKit 式工具把一个 SKILL.md 翻译给 32 种以上智能体 |
| 智能体技能（Agent Skill） | 「可移植的诀窍」 | 超出 MCP 工具概念之外的可复用任务模板 |
| Apps SDK | 「MCP 加 ChatGPT 界面」 | 在 MCP 上统一的连接器与自定义 GPT |

## 延伸阅读

- [Anthropic —— 智能体技能发布公告](https://www.anthropic.com/engineering/equipping-agents-for-the-real-world-with-agent-skills) —— 2025 年 12 月发布
- [Anthropic —— 智能体技能文档](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview) —— SKILL.md 格式参考
- [OpenAI —— Apps SDK](https://developers.openai.com/apps-sdk) —— 面向 ChatGPT 的基于 MCP 的开发者平台
- [agents.md](https://agents.md/) —— AGENTS.md 格式与采用列表
- [Anthropic —— anthropics/skills GitHub](https://github.com/anthropics/skills) —— 官方技能示例
