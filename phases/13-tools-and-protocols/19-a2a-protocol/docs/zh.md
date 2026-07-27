# A2A — 智能体间协议（Agent-to-Agent Protocol）

> MCP 是智能体到工具。A2A（Agent2Agent）是智能体到智能体——一种开放协议，允许构建于不同框架之上的黑盒智能体相互协作。由 Google 于 2025 年 4 月发布，2025 年 6 月捐赠给 Linux 基金会，2026 年 4 月达到 v1.0 版本，获得了包括 AWS、Cisco、Microsoft、Salesforce、SAP 和 ServiceNow 在内的 150+ 支持者。该协议吸收了 IBM 的 ACP 并增加了 AP2 支付扩展。本课将讲解 Agent Card、Task 生命周期以及两种传输绑定。

**类型：** 构建
**语言：** Python（标准库，Agent Card + Task 框架）
**前置知识：** 阶段 13 · 06（MCP 基础），阶段 13 · 08（MCP 客户端）
**时长：** ~75 分钟

## 学习目标

- 区分智能体到工具（MCP）与智能体到智能体（A2A）的使用场景。
- 在 `/.well-known/agent.json` 发布包含技能和端点元数据的 Agent Card。
- 掌握 Task 生命周期（submitted → working → input-required → completed / failed / canceled / rejected）。
- 使用带 Parts（text、file、data）的消息以及 Artifacts 作为输出。

## 问题背景

一个客户服务智能体需要将报告撰写任务委托给一个专门的写作智能体。A2A 出现之前的方案：

- 自定义 REST API。可行，但每对组合都是特例。
- 共享代码库。要求两个智能体运行相同的框架。
- MCP。不适用：MCP 用于调用工具，而不是让两个智能体协作同时保留各自的黑盒内部推理过程。

A2A 填补了这一空白。它将交互建模为一个智能体向另一个智能体发送 Task，包含生命周期、消息和工件。被调用智能体的内部状态保持不透明——调用方只能看到任务状态转换和最终输出。

A2A 是"让跨框架的智能体相互通信"的协议。它并不取代 MCP；两者是互补关系。

## 核心概念

### Agent Card

每个符合 A2A 的智能体都在 `/.well-known/agent.json` 发布一张卡片：

```json
{
  "schemaVersion": "1.0",
  "name": "research-agent",
  "description": "总结学术论文并生成引用草稿。",
  "url": "https://research.example.com/a2a",
  "version": "1.2.0",
  "skills": [
    {
      "id": "summarize_paper",
      "name": "总结论文",
      "description": "读取论文 PDF 并生成三段式摘要。",
      "inputModes": ["text", "file"],
      "outputModes": ["text", "artifact"]
    }
  ],
  "capabilities": {"streaming": true, "pushNotifications": true}
}
```

发现机制基于 URL：获取卡片，了解 A2A 端点的 URL，枚举技能。

### 签名 Agent Card（AP2）

AP2 扩展（2025 年 9 月）为 Agent Card 添加了加密签名。发布方使用 JWT 对其卡片签名；消费者验证签名。防止身份冒充。

### Task 生命周期

```
submitted -> working -> completed | failed | canceled | rejected
             -> input_required -> working (通过消息循环)
```

客户端通过 `tasks/send` 发起任务。被调用智能体在状态间转换；客户端通过 SSE 或轮询订阅状态更新。

### 消息与 Parts

一条消息携带一个或多个 Parts：

- `text` — 纯文本内容。
- `file` — 带 mimeType 的 base64 数据块。
- `data` — 类型化的 JSON 载荷（给被调用智能体的结构化输入）。

示例：

```json
{
  "role": "user",
  "parts": [
    {"type": "text", "text": "总结这篇论文。"},
    {"type": "file", "file": {"name": "paper.pdf", "mimeType": "application/pdf", "bytes": "..."}},
    {"type": "data", "data": {"targetLength": "三段"}}
  ]
}
```

### Artifacts（工件）

输出是 Artifacts，而非原始字符串。Artifact 是命名、类型化的输出：

```json
{
  "name": "summary",
  "parts": [{"type": "text", "text": "..."}],
  "mimeType": "text/markdown"
}
```

Artifacts 可以分块流式传输。调用方负责累积。

### 两种传输绑定

1. **基于 HTTP 的 JSON-RPC。**`/a2a` 端点，请求使用 POST，可选的 SSE 用于流式传输。默认绑定。
2. **gRPC。**适用于 gRPC 为主的企业环境。

两种绑定承载相同的逻辑消息结构。

### 不透明性保留

一个关键设计原则：被调用智能体的内部状态是不透明的。调用方只能看到任务状态和工件。被调用智能体的推理链、工具调用、子智能体委托——所有这些都不可见。这与 MCP 不同，MCP 中工具调用是透明的。

设计理由：A2A 使得竞争对手可以在不暴露内部实现的前提下协作。A2A 可以"调用这个客户服务智能体"，而调用方无需了解该智能体如何实现该服务。

### 时间线

- **2025-04-09.** Google 宣布 A2A。
- **2025-06-23.** 捐赠给 Linux 基金会。
- **2025-08.** 吸收 IBM 的 ACP。
- **2025-09.** AP2 扩展（智能体支付）发布。
- **2026-04.** v1.0 发布，获得 150+ 组织支持。

### 与 MCP 的关系

| 维度 | MCP | A2A |
|-----------|-----|-----|
| 使用场景 | 智能体到工具 | 智能体到智能体 |
| 不透明性 | 工具调用透明 | 内部推理不透明 |
| 典型调用方 | 智能体运行时 | 另一个智能体 |
| 状态 | 工具调用结果 | 带生命周期的任务 |
| 授权 | OAuth 2.1（阶段 13 · 16） | JWT 签名的 Agent Card（AP2） |
| 传输 | Stdio / Streamable HTTP | 基于 HTTP 的 JSON-RPC / gRPC |

当你需要调用特定工具时使用 MCP。当你需要将整个任务委托给另一个智能体时使用 A2A。许多生产系统两者并用：智能体使用 MCP 作为工具层，使用 A2A 作为协作层。

## 使用它

`code/main.py` 实现了一个最小化 A2A 框架：一个研究智能体发布其卡片，一个写作智能体接收包含 PDF 和文本指令等 parts 的 `tasks/send`，经历 working → input_required → working → completed 的状态转换，并返回一个文本工件。全部使用标准库；使用内存传输以聚焦消息结构。

关注要点：

- Agent Card JSON 结构。
- Task id 分配和状态转换。
- 包含混合类型 parts 的消息。
- 任务中段的 input-required 分支。
- 完成时的 Artifact 返回。

## 交付产物

本课生成 `outputs/skill-a2a-agent-spec.md`。给定一个应能被其他智能体调用的新智能体，该技能将生成 Agent Card JSON、技能模式和端点蓝图。

## 练习

1. 运行 `code/main.py`。追踪完整的 Task 生命周期，包括被调用智能体请求澄清时的 input-required 暂停状态。

2. 添加签名的 Agent Card。使用 HMAC 在卡片的规范 JSON 上进行签名。编写验证器并确认修改后的卡片会导致验证失败。

3. 实现任务流式传输：写作智能体通过 SSE 发出三个增量工件块，调用方对其进行累积。

4. 设计一个封装 MCP 服务器的 A2A 智能体。将每个 MCP 工具映射为 A2A 技能。注意其中的权衡——丢失了哪些不透明性？

5. 阅读 A2A v1.0 公告，找出截至 2026 年 4 月尚未被任何框架实现的一个特性。（提示：与多跳任务委托有关。）

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|----------------|------------------------|
| A2A | "Agent-to-Agent 协议" | 用于不透明智能体协作的开放协议 |
| Agent Card | "`.well-known/agent.json`" | 描述智能体技能和端点的已发布元数据 |
| Skill（技能） | "一个可调用单元" | 智能体支持的命名操作（类似于 MCP 工具） |
| Task（任务） | "委托单位" | 具有生命周期和最终工件的工作项 |
| Message（消息） | "任务输入" | 携带 Parts（text、file、data） |
| Part（部件） | "类型化数据块" | 消息中的 `text` / `file` / `data` 元素 |
| Artifact（工件） | "任务输出" | 完成时返回的命名、类型化输出 |
| AP2 | "智能体支付协议" | 用于信任和支付的签名 Agent Card 扩展 |
| Opacity（不透明性） | "黑盒协作" | 被调用智能体的内部实现对调用方隐藏 |
| Input-required（需要输入） | "任务暂停" | 智能体需要更多信息时的生命周期状态 |

## 延伸阅读

- [a2a-protocol.org](https://a2a-protocol.org/latest/) — A2A 规范官方文档
- [a2aproject/A2A — GitHub](https://github.com/a2aproject/A2A) — 参考实现和 SDK
- [Linux Foundation — A2A 发布新闻稿](https://www.linuxfoundation.org/press/linux-foundation-launches-the-agent2agent-protocol-project-to-enable-secure-intelligent-communication-between-ai-agents) — 2025 年 6 月治理移交
- [Google Cloud — A2A 协议升级](https://cloud.google.com/blog/products/ai-machine-learning/agent2agent-protocol-is-getting-an-upgrade) — 路线图和合作伙伴进展
- [Google Dev — A2A 1.0 里程碑](https://discuss.google.dev/t/the-a2a-1-0-milestone-ensuring-and-testing-backward-compatibility/352258) — v1.0 发布说明和向后兼容指南
