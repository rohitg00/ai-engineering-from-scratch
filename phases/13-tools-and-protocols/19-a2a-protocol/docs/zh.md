# A2A — 智能体到智能体协议

> MCP 是智能体到工具。A2A (Agent2Agent) 是智能体到智能体 — 一个开放协议，用于让基于不同框架构建的不透明智能体进行协作。2025 年 4 月由 Google 发布，2025 年 6 月捐赠给 Linux 基金会，2026 年 4 月达到 v1.0，拥有 150+ 支持者，包括 AWS、Cisco、Microsoft、Salesforce、SAP 和 ServiceNow。它吸收了 IBM 的 ACP 并添加了 AP2 支付扩展。本课演练智能体卡片、任务生命周期和两种传输层绑定。

**类型：** 构建
**语言：** Python (stdlib, 智能体卡片 + 任务工具)
**前置条件：** 阶段 13 · 06 (MCP 基础), 阶段 13 · 08 (MCP 客户端)
**时间：** ~75 分钟

## 学习目标

- 区分智能体到工具 (MCP) 和智能体到智能体 (A2A) 的用例。
- 在 `/.well-known/agent.json` 发布带有技能（skills）和端点元数据的智能体卡片。
- 演练任务生命周期（submitted → working → input-required → completed / failed / canceled）。
- 使用带部件（文本、文件、数据）的消息和作为输出的产物（Artifacts）。

## 问题背景

客户服务智能体需要将报告撰写委托给专门的撰写者智能体。A2A 之前的选项：

- 自定义 REST API。可行但每个配对都是一次性的。
- 共享代码库。要求两个智能体运行相同的框架。
- MCP。不适合：MCP 用于调用工具，而不是用于两个智能体在保持每个智能体不透明内部推理的情况下协作。

A2A 填补了空白。它将交互建模为一个智能体向另一个发送任务，带有生命周期、消息和产物。被调用智能体的内部状态保持不透明 — 调用者只看到任务状态转换和最终输出。

A2A 是"让跨框架的智能体相互通信"的协议。它不替代 MCP；两者是互补的。

## 概念详解

### 智能体卡片

每个符合 A2A 的智能体在 `/.well-known/agent.json` 发布一个卡片：

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

发现是基于 URL 的：获取卡片，学习 A2A 端点的 URL，枚举技能。

### 签名智能体卡片 (AP2)

AP2 扩展（2025 年 9 月）为智能体卡片添加了加密签名。发布者使用 JWT 签署其自己的卡片；消费者验证。防止冒充。

### 任务生命周期

```
submitted -> working -> completed | failed | canceled | rejected
             -> input_required -> working (通过消息循环)
```

客户端用 `tasks/send` 发起。被调用智能体通过状态转换；客户端通过 SSE 订阅状态更新或轮询。

### 消息和部件

消息携带一个或多个部件：

- `text` — 纯文本内容。
- `file` — 带 mimeType 的 base64 二进制大对象。
- `data` — 类型化 JSON 负载（用于被调用智能体的结构化输入）。

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

### 产物

输出是产物（Artifacts），而不是原始字符串。产物是命名的、类型化的输出：

```json
{
  "name": "summary",
  "parts": [{"type": "text", "text": "..."}],
  "mimeType": "text/markdown"
}
```

产物可以作为块流式传输。调用者累积它们。

### 两种传输层绑定

1. **基于 HTTP 的 JSON-RPC。** `/a2a` 端点，POST 用于请求，可选 SSE 用于流式传输。默认绑定。
2. **gRPC。** 用于 gRPC 是原生的企业环境。

两种绑定都携带相同的逻辑消息形态。

### 不透明性保持

一个关键设计原则：被调用智能体的内部状态是不透明的。调用者看到任务状态和产物。被调用智能体的思维链、其工具调用、其子智能体委托 — 全部不可见。这与 MCP 不同，在 MCP 中工具调用是透明的。

理由：A2A 使竞争对手能够在不暴露内部的情况下协作。A2A 可以是"调用此客户服务智能体"而调用者不知道该智能体如何实现服务。

### 时间线

- **2025-04-09。** Google 宣布 A2A。
- **2025-06-23。** 捐赠给 Linux 基金会。
- **2025-08。** 吸收 IBM 的 ACP。
- **2025-09。** AP2 扩展（智能体支付）发布。
- **2026-04。** v1.0 发布，拥有 150+ 支持组织。

### 与 MCP 的关系

| 维度 | MCP | A2A |
|-----------|-----|-----|
| 用例 | 智能体到工具 | 智能体到智能体 |
| 不透明性 | 透明工具调用 | 不透明内部推理 |
| 典型调用者 | 智能体运行时 | 另一个智能体 |
| 状态 | 工具调用结果 | 带生命周期的任务 |
| 授权 | OAuth 2.1 (阶段 13 · 16) | JWT 签名的智能体卡片 (AP2) |
| 传输层 | Stdio / Streamable HTTP | 基于 HTTP 的 JSON-RPC / gRPC |

当你想要调用特定工具时使用 MCP。当你想要将整个任务委托给另一个智能体时使用 A2A。许多生产系统同时使用两者：智能体使用 MCP 作为其工具层，使用 A2A 作为其协作层。

## 使用示例

`code/main.py` 实现了一个最小的 A2A 工具：研究智能体发布其卡片，撰写者智能体接收带有包括 PDF 和文本指令的部件的 `tasks/send`，通过 working → input_required → working → completed 转换，并返回文本产物。全部 stdlib；使用内存内传输以专注于消息形态。

需要关注的点：

- 智能体卡片 JSON 形态。
- 任务 ID 分配和状态转换。
- 混合类型部件的消息。
- 任务中期需要输入的 Branch。
- 完成时的产物返回。

## 实战输出

本课生成 `outputs/skill-a2a-agent-spec.md`。给定一个应该可以被其他智能体调用的新智能体，该技能生成智能体卡片 JSON、技能模式和端点蓝图。

## 练习

1. 运行 `code/main.py`。追踪完整任务生命周期，包括被调用智能体请求澄清的需要输入的暂停。

2. 添加签名智能体卡片。使用 HMAC 签署卡片的规范 JSON。编写验证器并确认它在变异卡片上失败。

3. 实现任务流式传输：撰写者智能体通过 SSE 发出三个增量产物块，调用者累积它们。

4. 设计一个包装 MCP 服务器的 A2A 智能体。将每个 MCP 工具映射到一个 A2A 技能。注意权衡 — 失去了什么不透明度？

5. 阅读 A2A v1.0 公告并识别截至 2026 年 4 月任何框架都尚未实现的一个功能。（提示：它与多跳任务委托有关。）

## 关键术语

| 术语 | 人们的说法 | 实际含义 |
|------|-----------|---------|
| A2A | "智能体到智能体协议" | 用于不透明智能体协作的开放协议 |
| 智能体卡片 | "`.well-known/agent.json`" | 发布的描述智能体技能和端点的元数据 |
| 技能 | "可调用单元" | 智能体支持的有名操作（类似于 MCP 工具） |
| 任务 | "委托单元" | 带有生命周期和最终产物的作业项 |
| 消息 | "任务输入" | 携带部件（文本、文件、数据） |
| 部件 | "类型化块" | 消息的 `text` / `file` / `data` 元素 |
| 产物 | "任务输出" | 完成时返回的命名、类型化输出 |
| AP2 | "智能体支付协议" | 用于信任和支付的签名智能体卡片扩展 |
| 不透明度 | "黑盒协作" | 被调用智能体的内部对调用者隐藏 |
| 需要输入 | "任务暂停" | 智能体需要更多信息时的生命周期状态 |

## 延伸阅读

- [a2a-protocol.org](https://a2a-protocol.org/latest/) — 权威 A2A 规范
- [a2aproject/A2A — GitHub](https://github.com/a2aproject/A2A) — 参考实现和 SDK
- [Linux 基金会 — A2A 发布公告](https://www.linuxfoundation.org/press/linux-foundation-launches-the-agent2agent-protocol-project-to-enable-secure-intelligent-communication-between-ai-agents) — 2025 年 6 月治理转移
- [Google Cloud — A2A 协议升级](https://cloud.google.com/blog/products/ai-machine-learning/agent2agent-protocol-is-getting-an-upgrade) — 路线图和合作伙伴势头
- [Google Dev — A2A 1.0 里程碑](https://discuss.google.dev/t/the-a2a-1-0-milestone-ensuring-and-testing-backward-compatibility/352258) — v1.0 发行说明和向后兼容性指导
