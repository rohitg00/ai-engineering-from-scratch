# 19 · A2A —— 智能体间协议

> MCP 是智能体对工具的协议，而 A2A（Agent2Agent）是智能体对智能体的协议——一个开放协议，让基于不同框架构建的「不透明智能体（opaque agents）」彼此协作。A2A 由 Google 于 2025 年 4 月发布，2025 年 6 月捐赠给 Linux 基金会，2026 年 4 月发布 v1.0，拥有 150 多家支持方，包括 AWS、Cisco、Microsoft、Salesforce、SAP 和 ServiceNow。它吸收了 IBM 的 ACP，并新增了 AP2 支付扩展。本课将逐一讲解智能体卡片（Agent Card）、任务生命周期（Task lifecycle）以及两种传输绑定。

**类型：** 实践（Build）
**语言：** Python（标准库，Agent Card + Task 框架）
**前置：** 阶段 13 · 06（MCP 基础）、阶段 13 · 08（MCP 客户端）
**时长：** 约 75 分钟

## 学习目标

- 区分智能体对工具（MCP）与智能体对智能体（A2A）两类使用场景。
- 在 `/.well-known/agent.json` 处发布一张包含技能与端点元数据的智能体卡片。
- 走完任务生命周期（submitted → working → input-required → completed / failed / canceled / rejected）。
- 使用带「部件（Parts）」（text、file、data）的消息，并以「制品（Artifacts）」作为输出。

## 问题所在

一个客服智能体需要把撰写报告的工作委派给一个专门的写作智能体。在 A2A 出现之前，备选方案有：

- 自定义 REST API。能用，但每一对配对都是一次性的定制。
- 共享代码库。要求两个智能体运行在同一框架之上。
- MCP。不适用：MCP 是用来调用工具的，而不是让两个智能体在各自保持不透明内部推理的前提下进行协作。

A2A 填补了这一空白。它把这种交互建模为：一个智能体向另一个智能体发送一个任务（Task），该任务带有生命周期、消息和制品。被调用智能体的内部状态保持不透明——调用方只能看到任务状态的转换以及最终的输出。

A2A 就是那个「让跨框架的智能体彼此对话」的协议。它并不取代 MCP；两者是互补的。

## 核心概念

### 智能体卡片（Agent Card）

每个符合 A2A 规范的智能体都会在 `/.well-known/agent.json` 处发布一张卡片：

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

发现机制基于 URL：抓取卡片，得知 A2A 端点的 URL，并枚举其技能。

### 签名的智能体卡片（AP2）

AP2 扩展（2025 年 9 月）为智能体卡片加入了密码学签名。发布方用 JWT 对自己的卡片签名，消费方进行验证，从而防止冒充。

### 任务生命周期

```
submitted -> working -> completed | failed | canceled | rejected
             -> input_required -> working (loop via message)
```

客户端通过 `tasks/send` 发起任务。被调用智能体在各状态间转换；客户端通过 SSE 订阅状态更新，或通过轮询获取。

### 消息（Messages）与部件（Parts）

一条消息携带一个或多个部件：

- `text` —— 纯文本内容。
- `file` —— 带 mimeType 的 base64 二进制块。
- `data` —— 带类型的 JSON 负载（供被调用智能体使用的结构化输入）。

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

### 制品（Artifacts）

输出是制品，而非裸字符串。一个制品是带名称、带类型的输出：

```json
{
  "name": "summary",
  "parts": [{"type": "text", "text": "..."}],
  "mimeType": "text/markdown"
}
```

制品可以分块流式传输，由调用方累积拼接。

### 两种传输绑定

1. **基于 HTTP 的 JSON-RPC。** `/a2a` 端点，请求用 POST，流式传输可选用 SSE。这是默认绑定。
2. **gRPC。** 适用于以 gRPC 为原生协议的企业环境。

两种绑定承载的是相同的逻辑消息结构。

### 不透明性保留（Opacity preservation）

一条关键设计原则：被调用智能体的内部状态是不透明的。调用方看到的是任务状态和制品。被调用智能体的思维链、它的工具调用、它对子智能体的委派——全都不可见。这与 MCP 不同，在 MCP 中工具调用是透明的。

设计理由：A2A 让竞争对手之间能够协作而无需暴露内部实现。A2A 可以做到「调用这个客服智能体」，而调用方无需了解该智能体是如何实现这项服务的。

### 时间线

- **2025-04-09。** Google 宣布 A2A。
- **2025-06-23。** 捐赠给 Linux 基金会。
- **2025-08。** 吸收 IBM 的 ACP。
- **2025-09。** AP2 扩展（智能体支付，Agent Payments）发布。
- **2026-04。** v1.0 发布，拥有 150 多家支持机构。

### 与 MCP 的关系

| 维度 | MCP | A2A |
|-----------|-----|-----|
| 使用场景 | 智能体对工具 | 智能体对智能体 |
| 不透明性 | 透明的工具调用 | 不透明的内部推理 |
| 典型调用方 | 智能体运行时 | 另一个智能体 |
| 状态 | 工具调用结果 | 带生命周期的任务 |
| 授权 | OAuth 2.1（阶段 13 · 16） | JWT 签名的智能体卡片（AP2） |
| 传输 | Stdio / Streamable HTTP | 基于 HTTP 的 JSON-RPC / gRPC |

当你想调用某个具体工具时使用 MCP；当你想把整个任务委派给另一个智能体时使用 A2A。许多生产系统两者并用：一个智能体用 MCP 作为其工具层，用 A2A 作为其协作层。

## 动手实践

`code/main.py` 实现了一个最小化的 A2A 框架：一个研究智能体发布它的卡片，一个写作智能体收到一个 `tasks/send`，其中的部件包括一个 PDF 和一条文本指令，随后经历 working → input_required → working → completed 的状态转换，并返回一个文本制品。全部使用标准库；采用内存传输，以便聚焦于消息结构本身。

需要重点关注的内容：

- 智能体卡片的 JSON 结构。
- 任务 id 的分配与状态转换。
- 包含混合类型部件的消息。
- 任务中途的 input-required 分支。
- 完成时返回的制品。

## 交付物

本课产出 `outputs/skill-a2a-agent-spec.md`。给定一个应当可被其他智能体调用的新智能体，该技能会生成智能体卡片 JSON、技能 schema 以及端点蓝图。

## 练习

1. 运行 `code/main.py`。追踪完整的任务生命周期，包括被调用智能体请求澄清时出现的 input-required 暂停。

2. 加入一张签名的智能体卡片。用 HMAC 对卡片的规范化（canonical）JSON 进行签名。编写一个验证器，并确认它在卡片被篡改时会验证失败。

3. 实现任务流式传输：写作智能体通过 SSE 发出三个增量制品分块，由调用方累积拼接。

4. 设计一个封装 MCP 服务器的 A2A 智能体。将每个 MCP 工具映射到一个 A2A 技能。注意其中的权衡——损失了哪些不透明性？

5. 阅读 A2A v1.0 的发布公告，找出截至 2026 年 4 月尚无任何框架实现的那一项特性。（提示：它与多跳任务委派有关。）

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|----------------|------------------------|
| A2A | 「智能体对智能体协议」 | 用于不透明智能体协作的开放协议 |
| Agent Card（智能体卡片） | 「`.well-known/agent.json`」 | 描述一个智能体的技能与端点的已发布元数据 |
| Skill（技能） | 「一个可调用单元」 | 智能体支持的一个具名操作（类比 MCP 的工具） |
| Task（任务） | 「委派的单位」 | 带生命周期和最终制品的工作项 |
| Message（消息） | 「任务输入」 | 携带部件（text、file、data） |
| Part（部件） | 「带类型的分块」 | 消息中的 `text` / `file` / `data` 元素 |
| Artifact（制品） | 「任务输出」 | 完成时返回的具名、带类型的输出 |
| AP2 | 「智能体支付协议」 | 用于信任与支付的签名智能体卡片扩展 |
| Opacity（不透明性） | 「黑盒协作」 | 被调用智能体的内部对调用方隐藏 |
| Input-required | 「任务暂停」 | 智能体需要更多信息时的生命周期状态 |

## 延伸阅读

- [a2a-protocol.org](https://a2a-protocol.org/latest/) —— A2A 规范权威文档
- [a2aproject/A2A —— GitHub](https://github.com/a2aproject/A2A) —— 参考实现与 SDK
- [Linux 基金会 —— A2A 启动新闻稿](https://www.linuxfoundation.org/press/linux-foundation-launches-the-agent2agent-protocol-project-to-enable-secure-intelligent-communication-between-ai-agents) —— 2025 年 6 月治理权转移
- [Google Cloud —— A2A 协议升级](https://cloud.google.com/blog/products/ai-machine-learning/agent2agent-protocol-is-getting-an-upgrade) —— 路线图与合作伙伴势头
- [Google Dev —— A2A 1.0 里程碑](https://discuss.google.dev/t/the-a2a-1-0-milestone-ensuring-and-testing-backward-compatibility/352258) —— v1.0 发布说明与向后兼容性指引
