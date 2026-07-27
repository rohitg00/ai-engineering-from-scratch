# A2A — 智能体间协议（Agent-to-Agent Protocol）

> Google 于 2025 年 4 月宣布 A2A；到 2026 年 4 月，规范已稳定在 https://a2a-protocol.org/latest/specification/，并获得 150+ 组织支持。A2A 是 MCP（第 13 课）的横向补充：MCP 是纵向的（智能体 ↔ 工具），而 A2A 是对等的（智能体 ↔ 智能体）。它定义了智能体卡片（Agent Card，服务发现）、带有产出物（artifact，文本、结构化数据、视频）的任务、不透明的任务生命周期以及认证。生产系统越来越多地将 MCP 与 A2A 配合使用。Google Cloud 在 2025–2026 年间将 A2A 支持整合到了 Vertex AI Agent Builder 中。

**类型：** 学习 + 构建
**语言：** Python（标准库，`http.server`，`json`）
**前置知识：** 阶段 16 · 04（原始模型）
**时长：** 约 75 分钟

## 问题

你的智能体需要调用另一个系统上的另一个智能体。怎么做？你可以暴露一个 HTTP 端点，定义一个定制的 JSON 模式，然后希望对方能理解。每一对智能体都变成了一次定制集成。

A2A 就是用于这种调用的通用线缆协议。标准化的发现、标准化的任务模型、标准化的传输、标准化的产出物。就像 HTTP+REST，但把智能体作为一等公民。

## 概念

### 四个要素

**智能体卡片（Agent Card）。** 位于 `/.well-known/agent.json` 的一个 JSON 文档，描述智能体：名称、技能、端点、支持的模式、认证要求。发现通过读取卡片完成。

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

**任务（Task）。** 工作单元。一个异步、有状态的对象，具有生命周期：`submitted → working → completed / failed / canceled`。客户端发送任务，轮询或订阅以获取更新。

**产出物（Artifact）。** 任务产生的结果类型。文本、结构化 JSON、图片、视频、音频。产出物带有类型，因此不同的模态都是一等公民。

**不透明的生命周期（Opaque lifecycle）。** A2A 不规定远程智能体*如何*解决任务。客户端看到状态转换和产出物；实现端可以自由使用任何框架。

### MCP / A2A 的分工

- **MCP**（第 13 课）：智能体 ↔ 工具。智能体通过 JSON-RPC 对工具服务器进行读写。默认无状态。
- **A2A**：智能体 ↔ 智能体。对等协议；双方都是拥有自身推理能力的智能体。

生产级多智能体系统两者都用。一个 A2A 对等体在其自身一侧调用 MCP 工具。这种分工让两个关注点保持清晰。

### 发现流程

```
客户端                          智能体服务器
  ├──GET /.well-known/agent.json──>
  <──Agent Card JSON─────────────
  ├──POST /tasks {skill, input}──>
  <──201 task_id, state=submitted
  ├──GET /tasks/{id}──────────────>
  <──state=working, 42% done──────
  ├──GET /tasks/{id}──────────────>
  <──state=completed, artifacts──
```

或者使用流式传输：订阅 `/tasks/{id}/events` 的 SSE 以获取推送更新。

### 认证

A2A 支持三种常见模式：

- **Bearer 令牌** — OAuth2 或不透明令牌。
- **mTLS** — 双向 TLS；组织间相互证明身份。
- **签名请求** — 对载荷进行 HMAC 签名。

认证在智能体卡片中声明；客户端发现并遵守。

### 截至 2026 年 4 月已有 150+ 组织

企业级采用推动了 A2A 的规模化。关键是：A2A 成为了企业智能体系统跨越信任边界的标准方式。Google Cloud 在 Vertex AI Agent Builder 中提供了 A2A 支持；Microsoft Agent Framework 支持它；大多数主流框架（LangGraph、CrewAI、AutoGen）都提供了 A2A 适配器。

### A2A 的优势场景

- **跨组织调用。** A 公司的智能体调用 B 公司的智能体。没有 A2A，每一对都是一个定制契约。
- **异构框架。** LangGraph 智能体调用 CrewAI 智能体调用自定义 Python 智能体。A2A 使其标准化。
- **带类型的产出物。** 视频结果、结构化 JSON、音频——都是一等公民。
- **长时间运行的任务。** 不透明的生命周期 + 轮询让耗时数小时的任务变得简单。

### A2A 的劣势场景

- **延迟敏感的微调用。** A2A 的生命周期是异步的。亚毫秒级的智能体间调用不适合；应使用直接 RPC。
- **紧耦合的进程内智能体。** 如果两个智能体运行在同一个 Python 进程中，A2A 的 HTTP 往返是多余的。
- **小团队。** 规范的开销是真实存在的；仅内部使用的智能体可能不需要这么正式。

### A2A 对比 ACP、ANP、NLIP

2024–2026 年间出现了几个相关规范：

- **ACP**（IBM/ Linux Foundation）— A2A 的前身，范围较窄。
- **ANP**（Agent Network Protocol）— 侧重于对等发现，去中心化优先。
- **NLIP**（Ecma 自然语言交互协议，2025 年 12 月标准化）— 自然语言内容类型。

截至 2026 年 4 月，A2A 是采纳最广泛的对等协议。参见 arXiv:2505.02279（Liu 等人，《智能体互操作性协议综述》）以获取对比。

## 构建

`code/main.py` 使用 `http.server` 和 JSON 实现了一个最小化的 A2A 服务器和客户端。服务器：

- 暴露 `/.well-known/agent.json`，
- 接受 `POST /tasks`，
- 管理任务状态，
- 在 `GET /tasks/{id}` 上返回产出物。

客户端：

- 获取智能体卡片，
- 提交任务，
- 轮询直到完成，
- 读取产出物。

运行：

```
python3 code/main.py
```

脚本在后台线程中启动服务器，然后针对它运行客户端。你将看到完整的流程：发现、提交、轮询、产出物。

## 使用

`outputs/skill-a2a-integrator.md` 设计了一个 A2A 集成：智能体卡片内容、任务模式、认证选择、流式传输 vs 轮询。

## 交付

检查清单：

- **锁定规范版本。** A2A 仍在演进中；智能体卡片应声明协议版本。
- **幂等的任务创建。** 重复提交（网络重试）应只产生一个任务。
- **产出物模式。** 声明智能体返回的形状；消费者应该进行校验。
- **速率限制 + 认证。** A2A 面向公共网络；应用标准的 Web 安全措施。
- **失败任务的死信队列。** 持续检查模式以发现重复出现的失败类型。

## 练习

1. 运行 `code/main.py`。确认客户端发现了服务器并收到了正确的产出物。
2. 在服务器上添加第二个技能（例如 "summarize"）。更新智能体卡片。编写一个客户端，根据任务类型选择技能。
3. 实现一个 SSE 流式端点：`/tasks/{id}/events`，用于推送状态变更。客户端需要做哪些不同的处理？
4. 阅读 A2A 规范（https://a2a-protocol.org/latest/specification/）。指出规范要求而本演示未实现的三点。
5. 比较 A2A（智能体卡片发现）与 MCP（服务端通过 `listTools` 列出能力）。自描述智能体与能力探测之间有什么权衡？

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|-----------|----------|
| A2A | "智能体对智能体" | 智能体跨系统调用其他智能体的对等协议。Google 2025。 |
| 智能体卡片 | "智能体的名片" | 位于 `/.well-known/agent.json` 的 JSON，描述技能、端点、认证。 |
| 任务 | "工作单元" | 具有生命周期的异步有状态对象；完成后产出产出物。 |
| 产出物 | "结果" | 带类型的输出：文本、结构化 JSON、图片、视频、音频。一等媒体。 |
| 不透明的生命周期 | "如何解决是智能体自己的事" | 客户端看到状态转换；服务端可自由选择框架/工具。 |
| 发现 | "找到智能体" | `GET /.well-known/agent.json` 返回卡片。 |
| MCP vs A2A | "工具 vs 对等体" | MCP：纵向智能体 ↔ 工具。A2A：横向智能体 ↔ 智能体。 |
| ACP / ANP / NLIP | "兄弟协议" | 相邻规范；A2A 是 2026 年采纳最广泛的。 |

## 延伸阅读

- [A2A 规范](https://a2a-protocol.org/latest/specification/) — 权威规范
- [Google Developers Blog — A2A 公告](https://developers.googleblog.com/en/a2a-a-new-era-of-agent-interoperability/) — 2025 年 4 月发布博文
- [A2A GitHub 仓库](https://github.com/a2aproject/A2A) — 参考实现和 SDK
- [Liu 等人 — 智能体互操作性协议综述](https://arxiv.org/html/2505.02279v1) — MCP、ACP、A2A、ANP 对比
