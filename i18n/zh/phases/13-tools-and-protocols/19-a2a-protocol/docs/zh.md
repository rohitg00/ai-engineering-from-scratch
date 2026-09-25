# A2A — Agent-to-Agent 协议

> MCP 是 agent-to-tool，A2A（Agent2Agent）是 agent-to-agent —— 一个开放协议，让基于不同框架构建的、内部不透明的智能体相互协作。由 Google 于 2025 年 4 月发布，2025 年 6 月捐赠给 Linux 基金会，2026 年 4 月达到 v1.0，拥有包括 AWS、Cisco、Microsoft、Salesforce、SAP 和 ServiceNow 在内的 150 多家支持者。它吸收了 IBM 的 ACP，并新增了 AP2 支付扩展。本课讲解 Agent Card、Task 生命周期以及两种传输绑定。

**Type:** Build
**Languages:** Python（标准库，Agent Card + Task 框架）
**Prerequisites:** Phase 13 · 06（MCP 基础）、Phase 13 · 08（MCP 客户端）
**Time:** 约 75 分钟

## 学习目标

- 区分 agent-to-tool（MCP）与 agent-to-agent（A2A）的使用场景。
- 在 `/.well-known/agent.json` 发布包含技能和端点元数据的 Agent Card。
- 走完 Task 生命周期（submitted → working → input-required → completed / failed / canceled / rejected）。
- 使用带 Parts（text、file、data）的 Messages，并将 Artifacts 作为输出。

## 问题所在

一个客服智能体需要将报告撰写委托给专门的写作智能体。A2A 出现之前的选择：

- 自定义 REST API。可行，但每对组合都是一次性的。
- 共享代码库。要求两个智能体运行相同的框架。
- MCP。不合适：MCP 用于调用工具，而不是让两个智能体在保留各自内部推理不透明的前提下协作。

A2A 填补了这个空白。它将交互建模为一个智能体向另一个智能体发送 Task，具有生命周期、消息和产物。被调用智能体的内部状态保持不透明 —— 调用方只能看到任务状态转换和最终的输出。

A2A 是“让跨框架的智能体相互对话”的协议。它不取代 MCP；两者互补。

## 核心概念

### Agent Card

每个符合 A2A 规范的智能体都在 `/.well-known/agent.json` 发布一张卡片：

```json
{
  "schemaVersion": "1.0",
  "name": "research-agent",
  "description": "Summarizes academic papers and drafts citations.",
  "url": "https://research.example.com/a2a",
  "version": "1.2.0",
  "skills": [
    {
      "id": "summarize_paper",
      "name": "Summarize a paper",
      "description": "Read a paper PDF and produce a 3-paragraph summary.",
      "inputModes": ["text", "file"],
      "outputModes": ["text", "artifact"]
    }
  ],
  "capabilities": {"streaming": true, "pushNotifications": true}
}
```

发现过程基于 URL：获取卡片，得知 A2A 端点的 URL，枚举技能。

### 签名的 Agent Card（AP2）

AP2 扩展（2025 年 9 月）为 Agent Card 增加了加密签名。发布方用自己的 JWT 对卡片签名；消费方进行验证。防止身份冒充。

### Task 生命周期

```
submitted -> working -> completed | failed | canceled | rejected
             -> input_required -> working (loop via message)
```

客户端以 `tasks/send` 发起。被调用的智能体在各状态间转换；客户端通过 SSE 订阅状态更新或轮询。

### Messages 和 Parts

一条消息携带一个或多个 Part：

- `text` — 纯文本内容。
- `file` — 带 mimeType 的 base64 数据块。
- `data` — 类型化的 JSON 载荷（提供给被调用智能体的结构化输入）。

示例：

```json
{
  "role": "user",
  "parts": [
    {"type": "text", "text": "Summarize this paper."},
    {"type": "file", "file": {"name": "paper.pdf", "mimeType": "application/pdf", "bytes": "..."}},
    {"type": "data", "data": {"targetLength": "3 paragraphs"}}
  ]
}
```

### Artifacts

输出是 Artifact，而非原始字符串。Artifact 是命名的、有类型的输出：

```json
{
  "name": "summary",
  "parts": [{"type": "text", "text": "..."}],
  "mimeType": "text/markdown"
}
```

Artifact 可以分块流式传输。调用方负责累积。

### 两种传输绑定

1. **基于 HTTP 的 JSON-RPC。** `/a2a` 端点，请求用 POST，可选 SSE 用于流式传输。默认绑定。
2. **gRPC。** 适用于 gRPC 是原生环境的企业场景。

两种绑定承载相同的逻辑消息结构。

### 不透明性保持

一个关键设计原则：被调用智能体的内部状态是不透明的。调用方只能看到任务状态和产物。被调用智能体的思维链、它的工具调用、它的子智能体委托 —— 全部不可见。这与 MCP 不同，MCP 中工具调用是透明的。

理由：A2A 让竞争者无需暴露内部即可协作。A2A 可以是“调用这个客服智能体”，而调用方无从得知该智能体如何实现服务。

### 时间线

- **2025-04-09。** Google 发布 A2A。
- **2025-06-23。** 捐赠给 Linux 基金会。
- **2025-08。** 吸收 IBM 的 ACP。
- **2025-09。** AP2 扩展（Agent Payments）发布。
- **2026-04。** v1.0 发布，有 150 多家支持组织。

### 与 MCP 的关系

| 维度 | MCP | A2A |
|-----------|-----|-----|
| 使用场景 | Agent-to-tool | Agent-to-agent |
| 不透明性 | 透明的工具调用 | 内部推理不透明 |
| 典型调用方 | 智能体运行时 | 另一个智能体 |
| 状态 | 工具调用结果 | 带生命周期的 Task |
| 授权 | OAuth 2.1（Phase 13 · 16） | JWT 签名的 Agent Card（AP2） |
| 传输 | Stdio / Streamable HTTP | 基于 HTTP 的 JSON-RPC / gRPC |

想调用某个具体工具时用 MCP。想把整个任务委托给另一个智能体时用 A2A。许多生产系统两者并用：智能体用 MCP 作为工具层，用 A2A 作为协作层。

```figure
a2a-task-lifecycle
```

## 使用它

`code/main.py` 实现了一个最小化的 A2A 框架：一个研究智能体发布其卡片，一个写作智能体接收一个包含 PDF 和文本指令等多个 part 的 `tasks/send`，依次经历 working → input_required → working → completed，并返回一个文本 artifact。全部使用标准库；采用内存传输以便聚焦于消息结构。

需要关注的内容：

- Agent Card 的 JSON 结构。
- Task id 分配与状态转换。
- 含混合类型 part 的消息。
- 任务中途的 input-required 分支。
- 完成时返回 Artifact。

## 交付它

本课产出 `outputs/skill-a2a-agent-spec.md`。给定一个应当可被其他智能体调用的新智能体，该技能生成 Agent Card JSON、技能模式和端点蓝图。

## 练习

1. 运行 `code/main.py`。追踪完整的 Task 生命周期，包括被调用智能体请求澄清时的 input-required 暂停。

2. 添加一个签名的 Agent Card。用 HMAC 对卡片的规范化 JSON 进行签名。编写一个验证器，并确认它在卡片被篡改时验证失败。

3. 实现任务流式传输：写作智能体通过 SSE 发出三个递增的 artifact 块，调用方将其累积。

4. 设计一个包装 MCP 服务器的 A2A 智能体。将每个 MCP 工具映射为一个 A2A 技能。注意其中的权衡 —— 会损失哪些不透明性？

5. 阅读 A2A v1.0 发布公告，找出截至 2026 年 4 月尚无任何框架实现的那一项特性。（提示：它与多跳任务委托有关。）

## 关键术语

| 术语 | 人们的说法 | 实际含义 |
|------|----------------|------------------------|
| A2A | “Agent-to-Agent 协议” | 用于不透明智能体协作的开放协议 |
| Agent Card | “`.well-known/agent.json`” | 发布的元数据，描述智能体的技能和端点 |
| Skill | “一个可调用单元” | 智能体支持的一个命名操作（类似 MCP 工具） |
| Task | “委托单元” | 具有生命周期和最终产物的工作项 |
| Message | “任务输入” | 携带 Part（text、file、data） |
| Part | “类型化数据块” | 消息中的 `text` / `file` / `data` 元素 |
| Artifact | “任务输出” | 完成时返回的命名、有类型的输出 |
| AP2 | “Agent Payments 协议” | 用于信任与支付的签名 Agent Card 扩展 |
| 不透明性 | “黑盒协作” | 被调用智能体的内部对调用方隐藏 |
| Input-required | “任务暂停” | 智能体需要更多信息时的生命周期状态 |

## 延伸阅读

- [a2a-protocol.org](https://a2a-protocol.org/latest/) — A2A 官方规范
- [a2aproject/A2A — GitHub](https://github.com/a2aproject/A2A) — 参考实现和 SDK
- [Linux Foundation — A2A 发布新闻稿](https://www.linuxfoundation.org/press/linux-foundation-launches-the-agent2agent-protocol-project-to-enable-secure-intelligent-communication-between-ai-agents) — 2025 年 6 月的治理移交
- [Google Cloud — A2A 协议升级](https://cloud.google.com/blog/products/ai-machine-learning/agent2agent-protocol-is-getting-an-upgrade) — 路线图与合作伙伴进展
- [Google Dev — A2A 1.0 里程碑](https://discuss.google.dev/t/the-a2a-1-0-milestone-ensuring-and-testing-backward-compatibility/352258) — v1.0 发布说明与向后兼容指南