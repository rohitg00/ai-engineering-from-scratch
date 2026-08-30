# Agno 与 Mastra：轻量级运行时

> Agno（原 Phidata，2025）和 Mastra（2025）是轻量级 agent 运行时，专注于低延迟和最小依赖。它们不是框架——它们是库。这与 LangGraph 和 AutoGen 不同，因为它们不强制特定的架构模式。

**类型：** 构建
**语言：** Python（Agno）/ TypeScript（Mastra）
**前置条件：** 第 14 阶段 · 01（Agent Loop），第 14 阶段 · 12（Anthropic 工作流模式）
**时间：** ~60 分钟

## 学习目标

- 解释 Agno 和 Mastra 的设计理念：轻量、快速、最小依赖。
- 对比轻量级运行时与重型框架（LangGraph、AutoGen）。
- 实现一个标准库 agent，包含工具、记忆和流式，无外部依赖。
- 识别何时轻量级运行时足够，何时需要重型框架。

## 问题

重型框架（LangGraph、AutoGen、CrewAI）解决复杂问题，但带来成本：

1. **依赖膨胀。** 数百个 transitive 依赖；安全审计困难。
2. **启动延迟。** 框架初始化需要秒级；不适合无服务器。
3. **认知负担。** 学习曲线陡峭；简单任务过度工程。

Agno 和 Mastra 的答案：最小化核心，可选扩展。Agent 是函数 + 工具 + 记忆。无强制图，无强制角色，无强制 actor。

## 概念

### Agno 的设计理念

Agno（原 Phidata）的核心原则：

- **Agent 是函数。** `agent = Agent(tools=[...], instructions="...")`。
- **记忆是可选的。** 默认无状态；添加 `memory=True` 启用。
- **工具是普通的。** 任何 Python 函数；无特殊装饰器。
- **流式是一等的。** `agent.run("...", stream=True)` yield 令牌。
- **模型无关。** OpenAI、Anthropic、本地模型；统一接口。

Agno 的代码量以百行计，不是千行。

### Mastra 的设计理念

Mastra（TypeScript）的核心原则：

- **Agent 是异步函数。** `const agent = new Agent({ ... })`。
- **工作流是代码。** 不是图 DSL；用 TypeScript 写控制流。
- **工具是 Zod 模式。** 类型安全；编译时验证。
- **记忆是插件。** Redis、Postgres、内存；按需添加。
- **可观察性内置。** 追踪、日志、指标；无额外设置。

Mastra 针对 TypeScript 生态优化；Agno 针对 Python。

### 与重型框架的对比

| 方面 | 重型框架（LangGraph/AutoGen） | 轻量级运行时（Agno/Mastra） |
|------|---------------------------|---------------------------|
| 核心大小 | 大（数千行） | 小（数百行） |
| 依赖 | 多（100+） | 少（<20） |
| 启动时间 | 秒级 | 毫秒级 |
| 强制模式 | 图/actor/角色 | 无 |
| 学习曲线 | 陡峭 | 平缓 |
| 适用场景 | 复杂、长期运行 | 简单、快速响应 |

### 何时使用轻量级运行时

- **简单 agent。** 2-5 个工具，无复杂状态。
- **低延迟需求。** 无服务器、边缘计算；启动时间关键。
- **依赖敏感。** 安全审计严格；最小化攻击面。
- **原型阶段。** 快速验证；需要时迁移到重型框架。

### 何时使用重型框架

- **复杂工作流。** 需要状态机、持久化、人机交互。
- **高并发。** Actor 模型隔离；共享内存问题。
- **长期运行。** 需要检查点、恢复、时间旅行。
- **团队协作。** 角色、流程、审计跟踪。

### 此模式出错的地方

- **低估复杂性。** 简单运行时上构建复杂系统；最终重写。
- **忽视可观察性。** 轻量级不意味着无追踪；添加日志和指标。
- **工具膨胀。** 20+ 工具的 agent 在任何运行时上都难以维护。

## 构建

`code/main.py` 实现标准库轻量级 agent：

- `Agent` —— 指令、工具列表、记忆（可选）。
- `Tool` —— 普通 Python 函数，自动模式生成。
- `Memory` —— 简单键值存储；可选持久化。
- `Stream` —— yield 中间令牌。
- `Run` —— 执行循环：LLM -> 工具 -> 返回。

运行：

```
python3 code/main.py
```

跟踪显示 agent 创建、工具调用、流式输出和记忆检索。

## 使用

- **Agno（Python）** —— `pip install agno`；最小依赖。
- **Mastra（TypeScript）** —— `npm install @mastra/core`；类型安全。
- **自定义运行时** —— 标准库实现（如本课）覆盖核心；生产使用成熟库。
- **迁移路径** —— 从 Agno/Mastra 开始；需要时迁移到 LangGraph/AutoGen。

## 交付

`outputs/skill-lightweight-runtime.md` 为给定任务选择轻量级运行时 vs 重型框架，包括迁移路径和复杂性阈值。

## 练习

1. 添加记忆持久化：将记忆保存到 SQLite；agent 重启后恢复。
2. 实现工具缓存：相同参数的工具调用缓存结果；减少 LLM 成本。
3. 添加流式中间步骤：不仅流式输出，还流式工具调用和结果。
4. 测量启动时间：对比 Agno（模拟）vs LangGraph（模拟）的初始化。差异 orders of magnitude？
5. 将简单 Agno agent 迁移到 LangGraph。什么变复杂了？什么变干净了？记录迁移成本。

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|-----------|---------|
| Runtime | "执行环境" | 运行 agent 的最小库 |
| Lightweight | "最小依赖" | 核心小，可选扩展 |
| Stream | "实时输出" | yield 中间结果，不等待完成 |
| Tool schema | "函数签名" | 参数和返回值的类型定义 |
| Memory plugin | "可插拔存储" | 记忆后端按需切换 |
| Cold start | "启动延迟" | 从代码加载到可运行的时间 |
| Migration path | "升级路线" | 从简单到复杂的演进策略 |
| Dependency bloat | "依赖膨胀" | transitive 依赖过多 |

## 延伸阅读

- [Agno 文档](https://docs.agno.com/) —— 官方指南
- [Mastra 文档](https://mastra.ai/docs) —— 官方指南
- [LangGraph 文档](https://langchain-ai.github.io/langgraph/) —— 重型框架对比
- [Anthropic, Building Effective Agents](https://www.anthropic.com/research/building-effective-agents) —— 何时简单足够