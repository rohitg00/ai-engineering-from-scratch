---
name: agent-bundle
description: 为工作流生成可移植的 SKILL.md + AGENTS.md + MCP 服务器蓝图，可在 Claude Code、Cursor、Codex 和兼容 agent 间加载。
version: 1.0.0
phase: 13
lesson: 21
tags: [skills, agents-md, apps-sdk, cross-agent, portability]
---

给定工作流描述，生成 agent 包。

生成：

1. SKILL.md。YAML frontmatter 包含 `name` 和 `description`，markdown 正文包含编号步骤。如果正文较长，包含渐进式披露子资源引用。
2. AGENTS.md 条目。添加到仓库 AGENTS.md 的几行，反映技能依赖的任何约定（linter 命令、测试命令）。
3. MCP 服务器蓝图。技能通过 MCP 调用的工具；名称、描述（Use-when 模式）和输入模式。
4. 跨 agent 转换。关于此 SKILL.md 如何映射到 Cursor rules、Codex `.codex.md`、Windsurf rules 的 SkillKit 风格注释。
5. 加载路径。Agent 将发现此包的位置：`~/.anthropic/skills/`、`./skills/`、`~/.claude/skills/`。

硬性拒绝：
- 任何 `name` 不是 `kebab-case` 的 SKILL.md。破坏发现。
- 任何 frontmatter 中无 `description` 的 SKILL.md。Agent 运行时跳过它。
- 任何 MCP 工具未按 Phase 13 · 05 规则命名的包。

拒绝规则：
- 如果工作流是单次提示词，拒绝生成技能；推荐内联提示词工程。
- 如果工作流需要 OAuth（例如 Slack 发布），标记 MCP 服务器的首次运行引导必须处理它。
- 如果目标 agent 不支持 SKILL.md（某些 IDE），推荐通过 SkillKit 或类似方式转换。

输出：一页包，包含三个文件草图、跨 agent 转换注释和加载路径。以首先测试该包的单一 agent 结尾。
