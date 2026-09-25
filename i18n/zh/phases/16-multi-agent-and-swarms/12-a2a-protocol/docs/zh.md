# A2A —— Agent-to-Agent 协议

> Google 于 2025 年 4 月宣布了 A2A;到 2026 年 4 月，规范版本已达 https://a2a-protocol.org/latest/specification/，并有 150 多家组织支持。A2A 是 MCP（第 13 课）的水平互补：MCP 是垂直的（agent ↔ 工具），而 A2A 是点对点的（agent ↔ agent）。它定义了 Agent Card（发现）、带产物的任务（文本、结构化数据、视频）、不透明的任务生命周期以及认证。生产系统中越来越多地将 MCP 与 A2A 配合使用。Google Cloud 在 2025–2026 年期间将 A2A 支持纳入了 Vertex AI Agent Builder。

**Type:** Learn + Build
**Languages:** Python (stdlib, `http.server`, `json`)
**Prerequisites:** Phase 16 · 04 (Primitive Model)
**Time:** ~75 分钟

## 问题

你的 agent 需要调用另一个系统上的另一个 agent。怎么做？你可以暴露一个 HTTP 端点，定义一个定制的 JSON schema，然后指望对方也使用它。每一对 agent 之间都变成一次定制集成。

A2A 就是这种调用的通用线路协议。标准的发现机制、标准的任务模型、标准的传输方式、标准的产物格式。就像 HTTP+REST，但把 agent 当作一等公民。

## 概念

### 四个要素

**Agent Card。** 位于 `/.well-known/agent.json` 的一个 JSON 文档，描述该 agent：名称、技能、端点、支持的模态、认证要求。发现过程就是通过读取卡片完成的。

```
GET https://agent.example.com/.well-known/agent.json
→ {
    "name": "code-review-agent",
    "skills": ["review-python", "review-typescript"],
    "endpoints": {
      "tasks": "https://agent.example.com/tasks"
    },
    "auth": {"type": "bearer"},
    "modalities": ["text", "structured"]
  }
```

**Task。** 工作单元。一个异步的、有状态的对象，具有生命周期：`submitted → working → completed / failed / canceled`。客户端发送任务，然后轮询或订阅更新。

**Artifact。** 任务产生的结果类型。文本、结构化 JSON、图像、视频、音频。产物是有类型的，因此不同的模态都是一等公民。

**不透明生命周期。** A2A 不规定远程 agent *如何* 解决任务。客户端只看到状态转换和产物；具体实现可以自由使用任何框架。

### MCP/A2A 的分工

- **MCP**（第 13 课）：agent ↔ 工具。agent 通过 JSON-RPC 对工具服务器进行读写。默认无状态。
- **A2A**：agent ↔ agent。点对点协议；双方都是具有自身推理能力的 agent。

生产级多 agent 系统两者都用。一个 A2A 对端在其一侧调用 MCP 工具。这种分工让两个关注点保持清晰。

### 发现流程

```
Client                     Agent server
  ├──GET /.well-known/agent.json──>
  <──Agent Card JSON─────────────
  ├──POST /tasks {skill, input}──>
  <──201 task_id, state=submitted
  ├──GET /tasks/{id}──────────────>
  <──state=working, 42% done──────
  ├──GET /tasks/{id}──────────────>
  <──state=completed, artifacts──
```

或者使用流式方式：通过 SSE 订阅 `/tasks/{id}/events` 以获取推送更新。

### 认证

A2A 支持三种常见模式：

- **Bearer token** —— OAuth2 或不透明令牌。
- **mTLS** —— 双向 TLS；组织之间相互证明身份。
- **签名请求** —— 对载荷做 HMAC。

认证方式在 Agent Card 中声明；客户端发现并遵从。

### 2026 年 4 月已有 150 多家组织

企业级采用推动了 A2A 的规模。关键在于：A2A 成为企业 agent 系统跨越信任边界的方式。Google Cloud 发布了 Vertex AI Agent Builder 的 A2A 支持；Microsoft Agent Framework 支持它；大多数主流框架（LangGraph、CrewAI、AutoGen）都提供 A2A 适配器。

### A2A 的优势场景

- **跨组织调用。** A 公司的 agent 调用 B 公司的 agent。没有 A2A，每一对都需要定制契约。
- **异构框架。** LangGraph agent 调用 CrewAI agent，再调用自定义 Python agent。A2A 使其规范化。
- **类型化产物。** 视频结果、结构化 JSON、音频——都是一等公民。
- **长时间运行的任务。** 不透明生命周期 + 轮询使耗时数小时的任务变得简单直接。

### A2A 的局限场景

- **延迟敏感的微调用。** A2A 的生命周期是异步的。亚毫秒级的 agent 间调用不适合；应使用直接 RPC。
- **紧耦合的进程内 agent。** 如果两个 agent 运行在同一个 Python 进程中，A2A 的 HTTP 往返就是多余的。
- **小团队。** 规范的开销是实实在在的；仅供内部使用的 agent 可能不需要这种正式性。

### A2A 与 ACP、ANP、NLIP

2024–2026 年间出现了几个相关规范：

- **ACP**（IBM/Linux 基金会）—— A2A 的前身，范围更窄。
- **ANP**（Agent Network Protocol）—— 侧重点对点发现，去中心化优先。
- **NLIP**（Ecma Natural Language Interaction Protocol，2025 年 12 月标准化）—— 自然语言内容类型。

截至 2026 年 4 月，A2A 是采用最广泛的点对点协议。对比详见 arXiv:2505.02279（Liu 等，"A Survey of Agent Interoperability Protocols"）。

```figure
sw-agent-card-discovery
```

## 动手构建

`code/main.py` 使用 `http.server` 和 JSON 实现了一个最小化的 A2A 服务器和客户端。服务器：

- 暴露 `/.well-known/agent.json`，
- 接受 `POST /tasks`，
- 管理任务状态，
- 在 `GET /tasks/{id}` 上返回产物。

客户端：

- 获取 Agent Card，
- 提交任务，
- 轮询直至完成，
- 读取产物。

运行：

```
python3 code/main.py
```

脚本在后台线程中启动服务器，然后对其运行客户端。你可以看到完整的流程：发现、提交、轮询、产物。

## 使用

`outputs/skill-a2a-integrator.md` 设计一个 A2A 集成：Agent Card 内容、任务 schema、认证方式选择、流式与轮询。

## 上线交付

检查清单：

- **固定规范版本。** A2A 仍在演进；Agent Card 应声明协议版本。
- **幂等的任务创建。** 重复提交（网络重试）应只产生一个任务。
- **产物 schema。** 声明 agent 返回的数据结构；消费方应进行校验。
- **速率限制 + 认证。** A2A 是面向公众的；应用标准的 Web 安全措施。
- **失败任务的死信处理。** 随时间检查模式，找出反复出现的失败类型。

## 练习

1. 运行 `code/main.py`。确认客户端能发现服务器并收到正确的产物。
2. 为服务器添加第二个技能（例如 "summarize"）。更新 Agent Card。编写一个根据任务类型选择技能的客户端。
3. 实现一个 SSE 流式端点：`/tasks/{id}/events`，用于发出状态变化。客户端需要做哪些不同的处理？
4. 阅读 A2A 规范（https://a2a-protocol.org/latest/specification/）。找出规范强制要求但本演示未实现的三点。
5. 比较 A2A（Agent Card 发现）与 MCP（通过 `listTools` 进行服务端能力列举）。自描述的 agent 与能力探测之间的权衡是什么？

## 关键术语

| 术语 | 人们的说法 | 实际含义 |
|------|----------------|------------------------|
| A2A | "Agent-to-agent" | 让 agent 跨系统调用其他 agent 的点对点协议。Google 2025 年。 |
| Agent Card | "agent 的名片" | 位于 `/.well-known/agent.json` 的 JSON，描述技能、端点、认证。 |
| Task | "工作单元" | 具有生命周期的异步有状态对象；完成时产生产物。 |
| Artifact | "结果" | 类型化输出：文本、结构化 JSON、图像、视频、音频。一等公民的媒体类型。 |
| Opaque lifecycle | "如何解决是 agent 自己的事" | 客户端只看到状态转换；服务器可自由选择框架/工具。 |
| Discovery | "找到 agent" | `GET /.well-known/agent.json` 返回卡片。 |
| MCP vs A2A | "工具 vs 对等方" | MCP：垂直的 agent ↔ 工具。A2A：水平的 agent ↔ agent。 |
| ACP / ANP / NLIP | "姊妹协议" | 相邻的规范；A2A 是 2026 年采用最广的。 |

## 延伸阅读

- [A2A 规范](https://a2a-protocol.org/latest/specification/) —— 权威规范
- [Google Developers Blog —— A2A 发布公告](https://developers.googleblog.com/en/a2a-a-new-era-of-agent-interoperability/) —— 2025 年 4 月的发布文章
- [A2A GitHub 仓库](https://github.com/a2aproject/A2A) —— 参考实现和 SDK
- [Liu 等 —— A Survey of Agent Interoperability Protocols](https://arxiv.org/html/2505.02279v1) —— MCP、ACP、A2A、ANP 的比较