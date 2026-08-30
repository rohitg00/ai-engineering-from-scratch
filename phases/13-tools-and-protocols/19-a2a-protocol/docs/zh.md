# A2A —— 智能体间协议

> MCP 是智能体到工具。A2A（Agent2Agent）是智能体到智能体 —— 一个开放协议，让基于不同框架构建的不透明智能体协作。由 Google 于 2025 年 4 月发布，2025 年 6 月捐赠给 Linux 基金会，2026 年 4 月达到 v1.0，拥有 150 多个支持者，包括 AWS、Cisco、Microsoft、Salesforce、SAP 和 ServiceNow。它吸收了 IBM 的 ACP 并添加了 AP2 支付扩展。本课介绍智能体卡片、任务生命周期和两个传输绑定。

**类型：** Build
**语言：** Python（stdlib，智能体卡片 + 任务框架）
**前置知识：** Phase 13 · 06（MCP 基础），Phase 13 · 08（MCP 客户端）
**时间：** ~75 分钟

## 学习目标

- 区分智能体到工具（MCP）与智能体到智能体（A2A）用例。
- 在 `/.well-known/agent.json` 发布带有技能和端点元数据的智能体卡片。
- 掌握任务生命周期（已提交 → 工作中 → 需要输入 → 已完成 / 失败 / 已取消 / 已拒绝）。
- 使用带有部分（文本、文件、数据）的消息和作为输出的产物。

## 问题所在

客户服务智能体需要将报告撰写委托给专门的写作智能体。A2A 之前的选项：

- 自定义 REST API。有效，但每对组合都是一次性的。
- 共享代码库。要求两个智能体运行相同的框架。
- MCP。不适用：MCP 用于调用工具，而非两个智能体在保留每个智能体不透明内部推理的情况下协作。

A2A 填补了这个空白。它将交互建模为一个智能体向另一个智能体发送任务，具有生命周期、消息和产物。被调用智能体的内部状态保持不透明 —— 调用者只看到任务状态转换和最终输出。

A2A 是"让跨框架的智能体相互交谈"的协议。它不替代 MCP；两者是互补的。

## 核心概念

### 智能体卡片

每个符合 A2A 的智能体在 `/.well-known/agent.json` 发布卡片：

```json
{
  "schemaVersion": "1.0",
  "name": "research-agent",
  "description": "总结学术论文并起草引用。",
  "url": "https://research.example.com/a2a",
  "version": "1.2.0",
  "skills": [
    {
      "id": "summarize_paper",
      "name": "总结论文",
      "description": "阅读论文 PDF 并生成三段摘要。",
      "inputModes": ["text", "file"],
      "outputModes": ["text", "artifact"]
    }
  ],
  "capabilities": {"streaming": true, "pushNotifications": true}
}
```

发现基于 URL：获取卡片，了解 A2A 端点的 URL，枚举技能。

### 签名智能体卡片（AP2）

AP2 扩展（2025 年 9 月）为智能体卡片添加加密签名。发布者用 JWT 签名自己的卡片；消费者验证。防止冒充。

### 任务生命周期

```
submitted -> working -> completed | failed | canceled | rejected
             -> input_required -> working (通过消息循环)
```

客户端通过 `tasks/send` 发起。被调用智能体经历状态转换；客户端通过 SSE 订阅状态更新或轮询。

### 消息和部分

消息携带一个或多个部分：

- `text` —— 纯文本内容。
- `file` —— 带 mimeType 的 base64 二进制大对象。
- `data` —— 类型化 JSON 负载（被调用智能体的结构化输入）。

示例：

```json
{
  "role": "user",
  "parts": [
    {"type": "text", "text": "总结这篇论文。"},
    {"type": "file", "file": {"name": "paper.pdf", "mimeType": "application/pdf", "bytes": "..."}},
    {"type": "data", "data": {"targetLength": "3 paragraphs"}}
  ]
}
```

### 产物

输出是产物，而非原始字符串。产物是命名、类型化的输出：

```json
{
  "name": "summary",
  "parts": [{"type": "text", "text": "..."}],
  "mimeType": "text/markdown"
}
```

产物可以作为块流式传输。调用者累积。

### 两个传输绑定

1. **HTTP 上的 JSON-RPC。** `/a2a` 端点，POST 用于请求，可选 SSE 用于流式传输。默认绑定。
2. **gRPC。** 适用于 gRPC 原生的企业环境。

两个绑定携带相同的逻辑消息形式。

### 不透明性保留

一个关键设计原则：被调用智能体的内部状态是不透明的。调用者看到任务状态和产物。被调用智能体的思维链、其工具调用、其子智能体委托 —— 全部不可见。这与 MCP 不同，在 MCP 中工具调用是透明的。

原理：A2A 使竞争对手能够在不透露内部的情况下协作。A2A 可以是"调用此客户服务智能体"，而调用者无需了解该智能体如何实现服务。

### 时间线

- **2025-04-09。** Google 宣布 A2A。
- **2025-06-23。** 捐赠给 Linux 基金会。
- **2025-08。** 吸收 IBM 的 ACP。
- **2025-09。** AP2 扩展（智能体支付）发布。
- **2026-04。** v1.0 发布，拥有 150 多个支持组织。

### 与 MCP 的关系

| 维度 | MCP | A2A |
|-----------|-----|-----|
| 用例 | 智能体到工具 | 智能体到智能体 |
| 不透明性 | 透明工具调用 | 不透明内部推理 |
| 典型调用者 | 智能体运行时 | 另一个智能体 |
| 状态 | 工具调用结果 | 带生命周期的任务 |
| 授权 | OAuth 2.1（Phase 13 · 16） | JWT 签名智能体卡片（AP2） |
| 传输 | Stdio / Streamable HTTP | HTTP 上的 JSON-RPC / gRPC |

当你想调用特定工具时使用 MCP。当你想将整个任务委托给另一个智能体时使用 A2A。许多生产系统同时使用两者：智能体使用 MCP 作为其工具层，使用 A2A 作为其协作层。

## 使用它

`code/main.py` 实现一个最小 A2A 框架：研究智能体发布其卡片，写作智能体接收包含 PDF 和文本指令的 `tasks/send`，经历 工作中 → 需要输入 → 工作中 → 已完成 的转换，并返回文本产物。全部使用 stdlib；使用内存传输以专注于消息形式。

需要查看的内容：

- 智能体卡片 JSON 形式。
- 任务 ID 分配和状态转换。
- 带混合类型部分的消息。
- 任务中期的需要输入分支。
- 完成时的产物返回。

## 交付它

本课产出 `outputs/skill-a2a-agent-spec.md`。给定一个应可被其他智能体调用的新智能体，该技能产出智能体卡片 JSON、技能模式和端点蓝图。

## 练习

1. 运行 `code/main.py`。跟踪完整的任务生命周期，包括被调用智能体请求澄清的需要输入暂停。

2. 添加签名智能体卡片。用卡片规范 JSON 上的 HMAC 签名。编写验证器并确认它在突变卡片上失败。

3. 实现任务流式传输：写作智能体通过 SSE 发出三个增量产物块，调用者累积它们。

4. 设计一个包装 MCP 服务器的 A2A 智能体。将每个 MCP 工具映射到 A2A 技能。注意权衡 —— 失去了什么不透明性？

5. 阅读 A2A v1.0 公告并识别截至 2026 年 4 月尚未被任何框架实现的一个功能。（提示：它与多跳任务委托有关。）

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|----------------|------------------------|
| A2A | "智能体间协议" | 不透明智能体协作的开放协议 |
| 智能体卡片 | "`/.well-known/agent.json`" | 描述智能体技能和端点的已发布元数据 |
| 技能 | "可调用单元" | 智能体支持的命名操作（类似 MCP 工具） |
| 任务 | "委托单元" | 具有生命周期和最终产物的工作项 |
| 消息 | "任务输入" | 携带部分（文本、文件、数据） |
| 部分 | "类型化块" | 消息的 `text` / `file` / `data` 元素 |
| 产物 | "任务输出" | 完成时返回的命名、类型化输出 |
| AP2 | "智能体支付协议" | 用于信任和支付的签名智能体卡片扩展 |
| 不透明性 | "黑盒协作" | 被调用智能体的内部对调用者隐藏 |
| 需要输入 | "任务暂停" | 智能体需要更多信息时的生命周期状态 |

## 延伸阅读

- [a2a-protocol.org](https://a2a-protocol.org/latest/) — 规范 A2A 规范
- [a2aproject/A2A — GitHub](https://github.com/a2aproject/A2A) — 参考实现和 SDK
- [Linux 基金会 — A2A 发布新闻稿](https://www.linuxfoundation.org/press/linux-foundation-launches-the-agent2agent-protocol-project-to-enable-secure-intelligent-communication-between-ai-agents) — 2025 年 6 月治理转移
- [Google Cloud — A2A 协议升级](https://cloud.google.com/blog/products/ai-machine-learning/agent2agent-protocol-is-getting-an-upgrade) — 路线图和合作伙伴势头
- [Google Dev — A2A 1.0 里程碑](https://discuss.google.dev/t/the-a2a-1-0-milestone-ensuring-and-testing-backward-compatibility/352258) — v1.0 发布说明和向后兼容指南
