---
name: agent-bundle
description: 为工作流生成可移植的 SKILL.md + AGENTS.md + MCP 服务器蓝图，可在 Claude Code、Cursor、Codex 及兼容智能体中加载。
version: 1.0.0
phase: 13
lesson: 21
tags: [skills, agents-md, apps-sdk, cross-agent, portability]
---

给定一个工作流描述，生成智能体捆绑包。

产出：

1. **SKILL.md。** YAML 前置元数据包含 `name` 和 `description`，Markdown 正文包含编号步骤。如果正文较长，包含渐进披露的子资源引用。
2. **AGENTS.md 条目。** 几行文本，添加到仓库的 AGENTS.md 中，反映技能所依赖的任何约定（linter 命令、测试命令）。
3. **MCP 服务器蓝图。** 技能通过 MCP 调用的工具；名称、描述（何时使用模式）和输入 schema。
4. **跨智能体翻译。** SkillKit 风格的说明，指出此 SKILL.md 如何映射到 Cursor 规则、Codex 的 `.codex.md`、Windsurf 规则。
5. **加载路径。** 智能体发现此捆绑包的位置：`~/.anthropic/skills/`、`./skills/`、`~/.claude/skills/`。

硬拒绝：
- 任何 `name` 不是 `kebab-case` 格式的 SKILL.md。破坏发现机制。
- 任何前置元数据中没有 `description` 的 SKILL.md。智能体运行时会跳过它。
- 任何其 MCP 工具不按照阶段 13 · 05 规则命名的捆绑包。

拒绝规则：
- 如果工作流是单次一次性提示，拒绝生成技能；推荐内联提示工程。
- 如果工作流需要 OAuth（例如 Slack 发帖），标记 MCP 服务器的首次运行 elicitation 必须处理它。
- 如果目标智能体不支持 SKILL.md（某些 IDE），推荐通过 SkillKit 或类似工具进行翻译。

输出：一页捆绑包，包含三个文件的草图、跨智能体翻译说明和加载路径。最后以应首先测试该捆绑包的单个智能体结尾。
