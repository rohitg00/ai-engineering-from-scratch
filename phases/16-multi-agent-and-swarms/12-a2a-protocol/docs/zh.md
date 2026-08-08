# 12 · A2A——智能体间协议

> Google 于 2025 年 4 月发布了 A2A；到 2026 年 4 月，其规范已发布至 https://a2a-protocol.org/latest/specification/ ，并获得 150 多家组织的支持。A2A 是「MCP（模型上下文协议，Model Context Protocol）」（第 13 课）的横向补充：MCP 是纵向的（智能体 ↔ 工具），A2A 则是点对点的（智能体 ↔ 智能体）。它定义了「智能体名片（Agent Card）」（用于发现）、带「产物（artifacts）」（文本、结构化数据、视频）的任务、不透明的任务生命周期，以及鉴权。生产系统越来越多地将 MCP 与 A2A 配对使用。Google Cloud 在 2025-2026 年间将 A2A 支持集成进了 Vertex AI Agent Builder。

**类型：** 学习 + 构建
**语言：** Python（标准库，`http.server`，`json`）
**前置：** 阶段 16 · 04（原始模型）
**时长：** 约 75 分钟

## 问题

你的智能体需要调用位于另一个系统上的另一个智能体。怎么做？你可以暴露一个 HTTP 端点，定义一套专属的 JSON 模式（schema），然后指望对方能听懂它。于是每一对智能体之间都变成了一次定制集成。

A2A 就是为这种调用而生的通用线缆协议（wire protocol）。标准化的发现、标准化的任务模型、标准化的传输、标准化的产物。就像 HTTP+REST 一样，但把智能体当作一等公民。

## 概念

### 四个要素

**智能体名片（Agent Card）。** 一份位于 `/.well-known/agent.json` 的 JSON 文档，用于描述该智能体：名称、技能、端点、所支持的模态、鉴权要求。发现过程就是通过读取这张名片来完成的。

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

**任务（Task）。** 工作的基本单元。一个异步、有状态的对象，具有生命周期：`submitted → working → completed / failed / canceled`。客户端发送一个任务，然后轮询或订阅更新。

**产物（Artifact）。** 任务所产出的结果类型。文本、结构化 JSON、图像、视频、音频。产物是带类型的，因此不同的模态都是一等公民。

**不透明生命周期（Opaque lifecycle）。** A2A 并不规定远端智能体*如何*去解决该任务。客户端看到的是状态转换和产物；具体实现可以自由选用任何框架。

### MCP/A2A 的分工

- **MCP**（第 13 课）：智能体 ↔ 工具。智能体通过 JSON-RPC 向工具服务器读写。默认无状态。
- **A2A**：智能体 ↔ 智能体。对等协议；双方都是拥有各自推理能力的智能体。

生产级的多智能体系统两者都用。一个 A2A 对等方会在自己这一侧调用 MCP 工具。这种分工让两类关注点保持清晰。

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

或者使用流式传输：通过 SSE 订阅 `/tasks/{id}/events` 以接收推送更新。

### 鉴权

A2A 支持三种常见模式：

- **Bearer 令牌（Bearer token）**——OAuth2 或不透明令牌。
- **mTLS**——双向 TLS；各组织之间互相证明身份。
- **签名请求（Signed requests）**——对载荷做 HMAC 签名。

鉴权方式在智能体名片中声明；客户端发现后据此遵从。

### 到 2026 年 4 月已有 150 多家组织

企业采纳推动了 A2A 的规模化。重点在于：A2A 成为了企业智能体系统跨越信任边界的方式。Google Cloud 发布了 Vertex AI Agent Builder 的 A2A 支持；Microsoft Agent Framework 也支持它；大多数主流框架（LangGraph、CrewAI、AutoGen）都提供了 A2A 适配器。

### A2A 的优势场景

- **跨组织调用。** A 公司的智能体调用 B 公司的智能体。没有 A2A 时，每一对都是一份定制契约。
- **异构框架。** LangGraph 智能体调用 CrewAI 智能体，再调用自定义 Python 智能体。A2A 将其归一化。
- **带类型的产物。** 视频结果、结构化 JSON、音频——全部都是一等公民。
- **长时运行任务。** 不透明生命周期 + 轮询，让耗时数小时的任务变得简单直接。

### A2A 的吃力场景

- **延迟敏感的微调用。** A2A 的生命周期是异步的。亚毫秒级的智能体间调用并不适合；这种情况应使用直接 RPC。
- **紧耦合的进程内智能体。** 如果两个智能体运行在同一个 Python 进程中，A2A 的 HTTP 往返就是杀鸡用牛刀。
- **小团队。** 规范开销是真实存在的；仅供内部使用的智能体可能并不需要这种正式性。

### A2A 与 ACP、ANP、NLIP 的对比

2024-2026 年间涌现出若干相关规范：

- **ACP**（IBM / Linux 基金会）——A2A 的前身，适用范围更窄。
- **ANP**（智能体网络协议，Agent Network Protocol）——侧重对等发现，去中心化优先。
- **NLIP**（Ecma 自然语言交互协议，Natural Language Interaction Protocol，于 2025 年 12 月标准化）——一种自然语言内容类型。

截至 2026 年 4 月，A2A 是采纳度最高的对等协议。对比参见 arXiv:2505.02279（Liu 等人，《智能体互操作协议综述》，"A Survey of Agent Interoperability Protocols"）。

## 动手构建

`code/main.py` 使用 `http.server` 和 JSON 实现了一个最小化的 A2A 服务端与客户端。服务端：

- 暴露 `/.well-known/agent.json`，
- 接受 `POST /tasks`，
- 管理任务状态，
- 在 `GET /tasks/{id}` 时返回产物。

客户端：

- 获取智能体名片，
- 提交任务，
- 轮询直到完成，
- 读取产物。

运行：

```
python3 code/main.py
```

该脚本会在一个后台线程中启动服务端，然后让客户端对其发起调用。你将看到完整流程：发现、提交、轮询、产物。

## 实际运用

`outputs/skill-a2a-integrator.md` 设计了一次 A2A 集成：智能体名片的内容、任务模式、鉴权选择、流式传输与轮询之间的取舍。

## 上线交付

清单：

- **锁定规范版本。** A2A 仍在演进；智能体名片应声明所用的协议版本。
- **幂等的任务创建。** 重复提交（网络重试）应只产生一个任务。
- **产物模式。** 声明该智能体返回的数据形状；消费方应进行校验。
- **限流 + 鉴权。** A2A 是面向公网的；应施加标准的 Web 安全措施。
- **失败任务的死信处理。** 长期观察失败模式，找出反复出现的失败类型。

## 练习

1. 运行 `code/main.py`。确认客户端发现了服务端并收到了正确的产物。
2. 给服务端再添加一个技能（例如 "summarize"）。更新智能体名片。编写一个客户端，根据任务类型来挑选技能。
3. 实现一个 SSE 流式端点：`/tasks/{id}/events`，用于发出状态变更。客户端需要做哪些不同的处理？
4. 阅读 A2A 规范（https://a2a-protocol.org/latest/specification/ ）。找出规范强制要求、但本演示并未实现的三件事。
5. 将 A2A（智能体名片发现）与 MCP（通过 `listTools` 在服务端列出能力）做对比。在「自描述智能体」与「能力探测」之间存在怎样的取舍？

## 关键术语

| 术语 | 大家怎么说 | 实际含义 |
|------|----------------|------------------------|
| A2A | "智能体对智能体" | 让智能体跨系统调用其他智能体的对等协议。Google 2025 年推出。 |
| 智能体名片（Agent Card） | "智能体的名片" | 位于 `/.well-known/agent.json` 的 JSON，描述技能、端点、鉴权。 |
| 任务（Task） | "工作的基本单元" | 带生命周期的异步有状态对象；完成时产出产物。 |
| 产物（Artifact） | "结果" | 带类型的输出：文本、结构化 JSON、图像、视频、音频。一等媒体。 |
| 不透明生命周期（Opaque lifecycle） | "怎么解决是智能体自己的事" | 客户端看到状态转换；服务端可自由选择框架/工具。 |
| 发现（Discovery） | "找到智能体" | `GET /.well-known/agent.json` 返回名片。 |
| MCP vs A2A | "工具 vs 对等方" | MCP：纵向的智能体 ↔ 工具。A2A：横向的智能体 ↔ 智能体。 |
| ACP / ANP / NLIP | "兄弟协议" | 相邻规范；A2A 是 2026 年采纳度最高的。 |

## 延伸阅读

- [A2A 规范](https://a2a-protocol.org/latest/specification/) —— 权威规范
- [Google 开发者博客 —— A2A 发布公告](https://developers.googleblog.com/en/a2a-a-new-era-of-agent-interoperability/) —— 2025 年 4 月的发布文章
- [A2A GitHub 仓库](https://github.com/a2aproject/A2A) —— 参考实现与 SDK
- [Liu 等人 —— 《智能体互操作协议综述》](https://arxiv.org/html/2505.02279v1) —— MCP、ACP、A2A、ANP 对比
