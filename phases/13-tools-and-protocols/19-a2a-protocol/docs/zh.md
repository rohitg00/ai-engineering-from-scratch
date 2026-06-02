# A2A —— Agent-to-Agent 协议

> 译注：本文译自同目录 [`en.md`](./en.md)。术语遵循仓根 [TRANSLATION_GUIDE.md](../../../../TRANSLATION_GUIDE.md)。

> MCP 是 agent-to-tool（agent 对工具）。A2A（Agent2Agent）是 agent-to-agent（agent 对 agent）—— 一套开放协议，让基于不同框架构建的 opaque（不透明）agent 互相协作。Google 于 2025 年 4 月发布，2025 年 6 月捐赠给 Linux 基金会，2026 年 4 月达到 v1.0，并获得 AWS、Cisco、Microsoft、Salesforce、SAP、ServiceNow 等 150 多家支持方。它吸收了 IBM 的 ACP，并增加了 AP2 支付扩展。本课会走一遍 Agent Card、Task 生命周期，以及两套传输绑定。

**Type:** Build
**Languages:** Python (stdlib, Agent Card + Task harness)
**Prerequisites:** Phase 13 · 06 (MCP fundamentals), Phase 13 · 08 (MCP client)
**Time:** ~75 minutes

## 学习目标（Learning Objectives）

- 区分 agent-to-tool（MCP）与 agent-to-agent（A2A）的使用场景。
- 在 `/.well-known/agent.json` 发布带有 skills 和 endpoint 元数据的 Agent Card。
- 走一遍 Task 生命周期（submitted → working → input-required → completed / failed / canceled / rejected）。
- 用带 Parts（text、file、data）的 Message 作输入，用 Artifact 作输出。

## 问题（Problem）

一个客服 agent 需要把写报告的工作委派给一个专门的 writer agent。在 A2A 出现之前，可选的方案有：

- 自定义 REST API。能跑，但每对 agent 之间都要单独搭一套。
- 共享代码库。要求两个 agent 跑在同一个框架下。
- MCP。不合适：MCP 是用来调用工具的，不是用来让两个 agent 协作、同时各自保留 opaque 内部推理的。

A2A 正好补上这个缺口。它把交互建模为：一个 agent 把一个 Task 发给另一个 agent，附带生命周期、消息和 artifact。被调用方的内部状态保持 opaque —— 调用方只看得到 task 状态迁移和最终输出。

A2A 是「让跨框架 agent 互相对话」的协议。它不是来取代 MCP 的；二者是互补关系。

## 概念（Concept）

### Agent Card

每个兼容 A2A 的 agent 都要在 `/.well-known/agent.json` 发布一张卡片：

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

发现机制是基于 URL 的：拉取卡片，得到 A2A endpoint 的 URL，再枚举 skills。

### 签名 Agent Card（AP2）

AP2 扩展（2025 年 9 月）给 Agent Card 增加了密码学签名。发布方用 JWT 给自己的卡片签名，使用方负责验签。可防止冒名。

### Task 生命周期

```
submitted -> working -> completed | failed | canceled | rejected
             -> input_required -> working (loop via message)
```

客户端用 `tasks/send` 发起。被调用 agent 在状态间迁移；客户端通过 SSE 订阅状态更新，或者轮询。

### Message 与 Part

一条 message 携带一个或多个 Part：

- `text` —— 纯内容。
- `file` —— 带 mimeType 的 base64 二进制块。
- `data` —— 类型化 JSON payload（给被调用 agent 的结构化输入）。

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

### Artifact

输出是 Artifact，不是裸字符串。Artifact 是一个有名字、有类型的输出：

```json
{
  "name": "summary",
  "parts": [{"type": "text", "text": "..."}],
  "mimeType": "text/markdown"
}
```

Artifact 可以分块流式发送，调用方负责累积。

### 两套传输绑定

1. **JSON-RPC over HTTP。** `/a2a` endpoint，请求用 POST，流式可选 SSE。默认绑定。
2. **gRPC。** 适用于 gRPC 是原生选择的企业环境。

两种绑定承载相同的逻辑消息形态。

### opacity 保留

一条关键设计原则：被调用 agent 的内部状态是 opaque 的。调用方看到的是 task 状态和 artifact。被调用 agent 的 chain-of-thought、它的 tool 调用、它对子 agent 的委派 —— 全部不可见。这一点和 MCP 不同，MCP 的 tool 调用是透明的。

理由：A2A 让竞争对手也能协作，而无需暴露各自的内部。A2A 可以是「调用这个客服 agent」，调用方不会知道这个 agent 是怎么实现这项服务的。

### 时间线

- **2025-04-09。** Google 发布 A2A。
- **2025-06-23。** 捐赠给 Linux 基金会。
- **2025-08。** 吸收 IBM 的 ACP。
- **2025-09。** AP2 扩展（Agent Payments）发布。
- **2026-04。** v1.0 发布，150 余家支持机构。

### 与 MCP 的关系

| 维度 | MCP | A2A |
|-----------|-----|-----|
| 使用场景 | Agent-to-tool | Agent-to-agent |
| Opacity | 透明的 tool 调用 | opaque 内部推理 |
| 典型调用方 | agent 运行时 | 另一个 agent |
| 状态 | tool 调用结果 | 带生命周期的 Task |
| 授权 | OAuth 2.1（Phase 13 · 16） | JWT 签名的 Agent Card（AP2） |
| 传输 | Stdio / Streamable HTTP | JSON-RPC over HTTP / gRPC |

要调用某个具体 tool，用 MCP。要把整个 task 委派给另一个 agent，用 A2A。许多生产系统两者都用：agent 把 MCP 用作 tool 层，把 A2A 用作协作层。

## 用起来（Use It）

`code/main.py` 实现了一个最小的 A2A harness：一个 research agent 发布它的卡片，一个 writer agent 收到一个 `tasks/send`，其 parts 包含一份 PDF 和一段文本指令；它依次经过 working → input_required → working → completed，最终返回一个文本 artifact。整套用 stdlib 实现，使用内存传输，把注意力集中在消息形态上。

可以重点看：

- Agent Card 的 JSON 形态。
- Task id 的分配和状态迁移。
- 含混合类型 part 的 Message。
- 任务中途的 input-required 分支。
- 完成时返回的 Artifact。

## 上线部署（Ship It）

本课产出 `outputs/skill-a2a-agent-spec.md`。给定一个希望被其他 agent 调用的新 agent，该 skill 会生成 Agent Card JSON、skills schema 与 endpoint 蓝图。

## 练习（Exercises）

1. 跑一遍 `code/main.py`。完整跟踪 Task 生命周期，包括被调用 agent 索要澄清时的 input-required 暂停。

2. 加一张签名 Agent Card。用 HMAC 对卡片的规范化 JSON 签名。写一个验签器，并验证它会在被篡改的卡片上失败。

3. 实现 task 流式输出：writer agent 通过 SSE 增量发送三个 artifact 块，调用方负责累积。

4. 设计一个把 MCP server 包起来的 A2A agent。把每个 MCP tool 映射成一个 A2A skill。注意取舍 —— 损失了哪部分 opacity？

5. 阅读 A2A v1.0 公告，找出截至 2026 年 4 月还没有任何框架实现的那一项功能。（提示：和多跳 task 委派有关。）

## 关键术语（Key Terms）

| 术语 | 大家怎么说 | 实际是什么 |
|------|----------------|------------------------|
| A2A | 「Agent-to-Agent 协议」 | 让 opaque agent 协作的开放协议 |
| Agent Card | 「`.well-known/agent.json`」 | 描述 agent 的 skills 和 endpoint 的发布元数据 |
| Skill | 「一个可调用单元」 | agent 支持的具名操作（类比 MCP 的 tool） |
| Task | 「委派的单位」 | 带生命周期和最终 artifact 的工作项 |
| Message | 「Task 输入」 | 承载 Part（text、file、data） |
| Part | 「类型化分块」 | message 中的 `text` / `file` / `data` 元素 |
| Artifact | 「Task 输出」 | 完成时返回的具名、类型化输出 |
| AP2 | 「Agent Payments Protocol」 | 用于信任与支付的签名 Agent Card 扩展 |
| Opacity | 「黑盒协作」 | 被调用 agent 的内部对调用方不可见 |
| Input-required | 「Task 暂停」 | agent 需要更多信息时的生命周期状态 |

## 延伸阅读（Further Reading）

- [a2a-protocol.org](https://a2a-protocol.org/latest/) —— A2A 规范的权威来源
- [a2aproject/A2A — GitHub](https://github.com/a2aproject/A2A) —— 参考实现与 SDK
- [Linux Foundation — A2A launch press release](https://www.linuxfoundation.org/press/linux-foundation-launches-the-agent2agent-protocol-project-to-enable-secure-intelligent-communication-between-ai-agents) —— 2025 年 6 月治理移交
- [Google Cloud — A2A protocol upgrade](https://cloud.google.com/blog/products/ai-machine-learning/agent2agent-protocol-is-getting-an-upgrade) —— 路线图与合作方进展
- [Google Dev — A2A 1.0 milestone](https://discuss.google.dev/t/the-a2a-1-0-milestone-ensuring-and-testing-backward-compatibility/352258) —— v1.0 发布说明与向后兼容指引
