# Claude Agent SDK：技能与子 Agent

> Claude Agent SDK（Anthropic，2026）是 Anthropic 对 agent 框架的回答。核心抽象是技能（命名、可检索、可组合的代码块）和子 agent（委托工作的轻量级 agent）。这与 Claude Code 工具共享架构，但为程序化使用而设计。

**类型：** 构建
**语言：** Python（标准库）
**前置条件：** 第 14 阶段 · 01（Agent Loop），第 14 阶段 · 10（Voyager 技能库），第 14 阶段 · 12（Anthropic 工作流模式）
**时间：** ~75 分钟

## 学习目标

- 解释 Claude Agent SDK 的核心抽象：Skill、Sub-agent、Session 和 Trace。
- 对比 Claude Agent SDK 与 OpenAI Agents SDK 和 CrewAI。
- 实现一个标准库技能系统，包含注册、检索、组合和子 agent 委托。
- 识别何时技能 + 子 agent 模式优于单一 agent。

## 问题

单一 agent 有两个瓶颈：

1. **上下文窗口。** 长任务填满上下文；agent 忘记早期步骤。
2. **专业化。** 通用 agent 对每个子任务都是次优的；专家 agent 更好。

Claude Agent SDK 的答案：将工作分解为技能（可复用代码）和子 agent（专家 worker）。父 agent 编排；子 agent 执行；技能共享能力。

## 概念

### Skill

Claude Agent SDK 的 `Skill` 是 Voyager 模式（第 10 课）的产品化：

- **名称。** 唯一标识符。
- **描述。** 自然语言，用于检索。
- **代码。** 可执行 Python 函数。
- **指令。** 何时以及如何使用此技能的 LLM 提示词。
- **输入/输出模式。** 类型化参数和返回值。

技能在会话期间按需加载。agent 不携带整个库——只携带相关的。

### Sub-agent

`Sub-agent` 是轻量级的、有特定指令的 agent：

- **父 agent 创建子 agent。** 带特定任务和工具集。
- **子 agent 独立运行。** 有自己的上下文窗口。
- **结果返回父 agent。** 子 agent 完成后，父 agent 综合。
- **子 agent 可以嵌套。** 子 agent 可以创建孙 agent。

这是 Anthropic 编排器-工作者模式（第 12 课）的实现，带有技能共享。

### Session

`Session` 管理 agent 生命周期：

- **创建。** 初始化 agent，加载技能。
- **运行。** 执行用户请求，调用技能和子 agent。
- **检查点。** 定期持久化状态。
- **恢复。** 从检查点继续。

Session 是显式的。你可以检查、暂停、恢复。

### Trace

`Trace` 记录执行历史：

- **步骤。** 每次 LLM 调用、工具执行、子 agent 创建。
- **令牌使用。** 每个步骤的输入/输出令牌。
- **延迟。** 每个步骤的 wall-clock 时间。
- **错误。** 异常和重试。

Trace 用于调试、优化和计费。

### 与 OpenAI Agents SDK 的对比

| 方面 | OpenAI Agents SDK | Claude Agent SDK |
|------|------------------|-----------------|
| 核心抽象 | Agent + Tool + Handoff | Skill + Sub-agent + Session |
| 可复用性 | 工具是函数 | 技能是命名、可检索、可组合的 |
| 委托 | Handoff（切换 agent） | Sub-agent（创建专家 worker） |
| 状态 | 无内置 | Session 管理生命周期 |
| 追踪 | 基础 | 详细（令牌、延迟、错误） |
| 模型 | 任何兼容 API | Claude 优化 |

### 与 CrewAI 的对比

| 方面 | CrewAI | Claude Agent SDK |
|------|--------|-----------------|
| 角色 | 静态（预定义） | 动态（运行时创建子 agent） |
| 流程 | 顺序/层次/并行 | 由父 agent 动态编排 |
| 工具 | 按角色限制 | 技能按需加载 |
| 记忆 | 内置 | Session 检查点 |
| 复杂度 | 中 | 中-高 |

### 何时使用 Claude Agent SDK

- **复杂任务。** 需要分解为子任务，每个子任务需要专家。
- **技能重用。** 相同能力在多个任务中需要（Voyager 模式）。
- **Claude 优化。** 使用 Claude 模型；SDK 针对其特性优化。
- **可观察性需求。** 需要详细追踪调试。

### 何时不使用 Claude Agent SDK

- **简单任务。** 单一 agent 足够。
- **非 Claude 模型。** SDK 针对 Claude 优化；其他模型可能不兼容。
- **快速原型。** OpenAI Agents SDK 更轻量。

### 此模式出错的地方

- **技能膨胀。** 技能库增长到数百个；检索质量下降。用标签和层次组织。
- **子 agent 过度嵌套。** 3+ 层嵌套使调试困难。扁平化层次。
- **上下文丢失。** 子 agent 不自动继承父上下文。显式传递相关状态。

## 构建

`code/main.py` 实现标准库 Claude Agent SDK 模式：

- `Skill` —— 名称、描述、代码、指令、模式。
- `SkillLibrary` —— 注册、按描述检索、版本控制。
- `SubAgent` —— 轻量级 agent，带指令和工具集。
- `Session` —— 管理 agent 生命周期、检查点、恢复。
- `Trace` —— 记录步骤、令牌、延迟、错误。

运行：

```
python3 code/main.py
```

跟踪显示技能注册、检索、子 agent 创建、委托和会话检查点。

## 使用

- **Claude Agent SDK（Anthropic）** —— 生产框架；与 Claude 模型集成。
- **Claude Code** —— 交互式工具；SDK 是其程序化版本。
- **自定义实现** —— 标准库版本（如本课）覆盖核心概念；SDK 添加优化和集成。

## 交付

`outputs/skill-claude-agents.md` 为给定任务设计技能库和子 agent 层次，包括技能边界和委托策略。

## 练习

1. 实现技能版本控制：技能更新时，旧版本保留。子 agent 可以固定到特定版本。
2. 添加技能依赖：技能 A 依赖于技能 B。加载 A 时自动加载 B。
3. 实现子 agent 超时：子 agent 运行超过 N 秒时，强制终止并返回部分结果。
4. 测量技能加载成本：对比加载整个库 vs 按需检索 top-5。延迟和内存差异？
5. 将 Voyager 的自动课程（第 10 课）集成到 Session：Session 结束时，提议缺失技能。

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|-----------|---------|
| Skill | "可复用能力" | 命名代码块 + 描述 + 指令 |
| Sub-agent | "专家 worker" | 由父 agent 创建的轻量级 agent |
| Session | "Agent 生命周期" | 管理创建、运行、检查点、恢复 |
| Trace | "执行日志" | 步骤、令牌、延迟、错误的详细记录 |
| Skill library | "能力存储" | 技能的持久化、可搜索集合 |
| On-demand loading | "懒加载" | 会话期间只加载相关技能 |
| Context passing | "状态传递" | 父 agent 显式传递状态给子 agent |
| Checkpoint | "持久化快照" | Session 状态的定期保存 |

## 延伸阅读

- [Claude Agent SDK 文档](https://platform.claude.com/docs/en/agent-sdk/overview) —— 官方指南
- [Anthropic, Building agents with the Claude Agent SDK](https://www.anthropic.com/engineering/building-agents-with-the-claude-agent-sdk) —— 实践指南
- [Voyager 论文](https://arxiv.org/abs/2305.16291) —— 技能库的理论基础
- [Claude Code 文档](https://docs.anthropic.com/en/docs/claude-code/overview) —— 交互式 agent 工具