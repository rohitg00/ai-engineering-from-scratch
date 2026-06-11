# OpenAI Agents SDK：编排器-工作者模式

> OpenAI Agents SDK（2025）将 Anthropic 的编排器-工作者模式产品化。Agent 是具有指令、工具和交接的单元。Runner 编排执行。Guardrails 验证输入和输出。这是 2025 年最简单的生产 agent 框架。

**类型：** 构建
**语言：** Python（标准库）
**前置条件：** 第 14 阶段 · 01（Agent Loop），第 14 阶段 · 12（Anthropic 工作流模式）
**时间：** ~60 分钟

## 学习目标

- 解释 Agents SDK 的核心抽象：Agent、Runner、Tool、Handoff 和 Guardrail。
- 对比 Agents SDK 与 OpenAI 之前的 Assistants API。
- 实现一个标准库 agent 系统，包含指令、工具、交接和护栏。
- 识别 Agents SDK 何时足够，何时需要更重的框架。

## 问题

OpenAI 的 Assistants API 是 2024 年的主要 agent 产品。它有两个问题：

1. **黑盒。** 线程、运行、步骤在 OpenAI 服务器上管理。你无法检查中间状态。
2. **供应商锁定。** 与 OpenAI 模型深度耦合；切换模型需要重写。

Agents SDK 的答案：一个轻量级、开源的编排层，与模型无关，在本地运行，显式控制流。

## 概念

### Agent

Agents SDK 的 `Agent` 是：

- **指令。** 系统提示词，定义 agent 的行为。
- **工具。** 函数、Web 搜索、文件搜索，agent 可以调用。
- **交接。** 将控制权转移给另一个 agent 的机制。
- **模型。** 任何兼容 OpenAI 聊天完成 API 的模型。

Agent 是轻量级的。没有持久化，没有记忆，没有复杂状态。

### Runner

`Runner` 编排 agent 执行：

- 调用 LLM。
- 解析工具调用。
- 执行工具。
- 将结果返回给 LLM。
- 循环直到完成或最大迭代。

Runner 是显式的。你可以检查每一步，在任何时候暂停。

### Tool

三种工具类型：

- **函数。** Python 函数，由 LLM 通过 JSON 模式调用。
- **Web 搜索。** 内置工具，搜索互联网。
- **文件搜索。** 内置工具，搜索向量存储。

工具是普通的 Python 函数。没有特殊装饰器，没有框架魔法。

### Handoff

交接将控制权从一个 agent 转移到另一个：

- Agent A 决定需要专家 B。
- Agent A 调用 `handoff_to(agent_b)`。
- Runner 切换到 agent B，携带上下文。
- Agent B 完成后，可以交接回 A 或结束。

这是 Anthropic 编排器-工作者模式（第 12 课）的实现。

### Guardrail

Guardrails 验证输入和输出：

- **输入护栏。** 在 agent 运行前检查用户输入。拒绝有害或越界请求。
- **输出护栏。** 在返回用户前检查 agent 输出。过滤敏感信息。

Guardrails 是简单的函数，返回 `pass` 或 `fail`。

### 与 Assistants API 的对比

| 方面 | Assistants API | Agents SDK |
|------|---------------|-----------|
| 控制流 | 黑盒（服务器管理） | 显式（本地 Runner） |
| 模型 | OpenAI 专用 | 任何兼容 API |
| 状态 | 服务器端线程 | 无内置；自己管理 |
| 工具 | 有限 | 任意 Python 函数 |
| 交接 | 无 | 一等公民 |
| 护栏 | 无 | 内置 |
| 复杂度 | 低（托管） | 低（自托管） |

### 何时使用 Agents SDK

- **快速原型。** 几行代码启动 agent。
- **简单工作流。** 2-5 个 agent，清晰交接。
- **模型灵活性。** 需要在 OpenAI、Anthropic、本地模型间切换。
- **调试需求。** 需要检查每一步的中间状态。

### 何时不使用 Agents SDK

- **复杂状态机。** 需要持久化、时间旅行、人机交互。使用 LangGraph（第 13 课）。
- **高并发。** 需要 actor 模型隔离。使用 AutoGen v0.4（第 14 课）。
- **角色约束。** 需要严格的角色和流程。使用 CrewAI（第 15 课）。

### 此模式出错的地方

- **过度使用交接。** 每个任务创建新 agent。Agent 是轻量级的，但上下文切换有成本。
- **缺失护栏。** 生产系统没有输入/输出验证。添加 guardrails。
- **忽略状态管理。** Agents SDK 不持久化状态。自己实现检查点。

## 构建

`code/main.py` 实现标准库 Agents SDK 模式：

- `Agent` —— 指令、工具列表、交接目标。
- `Runner` —— 执行循环：LLM -> 解析工具 -> 执行 -> 返回。
- `Tool` —— 普通 Python 函数，JSON 模式描述。
- `Handoff` —— 上下文切换到另一个 agent。
- `Guardrail` —— 输入/输出验证函数。

运行：

```
python3 code/main.py
```

跟踪显示 agent 创建、工具调用、交接和护栏检查。

## 使用

- **OpenAI Agents SDK** —— 生产框架；pip install openai-agents。
- **自定义实现** —— 标准库版本（如本课）覆盖核心概念；SDK 添加流式、追踪、部署。
- **与其他框架对比** —— Agents SDK 是最轻量的；LangGraph 是最有状态的；AutoGen 是最并发的。

## 交付

`outputs/skill-openai-agents.md` 为给定任务设计 Agents SDK 系统，包括 agent 分解、交接点和护栏策略。

## 练习

1. 添加流式支持：Runner 在每次 LLM 流式输出时 yield 中间结果。
2. 实现并行工具调用：当 LLM 请求多个工具时，并发执行它们。
3. 添加记忆：在 agent 间共享的简单键值存储。对比内置记忆 vs 外部记忆（第 07-09 课）。
4. 测量交接成本：对比单 agent 多工具 vs 多 agent 交接。Token 成本和延迟差异？
5. 将 Agents SDK 模式移植到 Claude Agent SDK。API 形状差异？哪些概念映射 cleanly？

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|-----------|---------|
| Agent | "AI 助手" | 指令 + 工具 + 交接的单元 |
| Runner | "执行引擎" | 编排 LLM 调用和工具执行的循环 |
| Tool | "函数调用" | Python 函数，由 LLM 通过 JSON 调用 |
| Handoff | "上下文切换" | 将控制权从一个 agent 转移到另一个 |
| Guardrail | "安全检查" | 验证输入/输出的函数 |
| Instruction | "系统提示词" | 定义 agent 行为的文本 |
| Turn | "一轮交互" | 一次 LLM 调用 + 工具执行 |
| Max turns | "安全限制" | 防止无限循环的迭代上限 |

## 延伸阅读

- [OpenAI Agents SDK 文档](https://openai.github.io/openai-agents-python/) —— 官方指南
- [OpenAI Agents SDK GitHub](https://github.com/openai/openai-agents-python) —— 源代码
- [Anthropic, Building Effective Agents](https://www.anthropic.com/research/building-effective-agents) —— 编排器-工作者模式理论
- [LangGraph 文档](https://langchain-ai.github.io/langgraph/) —— 何时需要更重的框架