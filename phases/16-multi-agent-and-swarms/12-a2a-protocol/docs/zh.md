# A2A — Agent-to-Agent 协议

> 译注：本文译自同目录 [`en.md`](./en.md)。术语遵循仓根 [TRANSLATION_GUIDE.md](../../../../TRANSLATION_GUIDE.md)。

> Google 在 2025 年 4 月发布了 A2A；到 2026 年 4 月，规范已经迭代到 https://a2a-protocol.org/latest/specification/ ，背后有 150+ 家组织背书。A2A 是 MCP（第 13 课）的横向补充：MCP 是垂直方向（agent ↔ 工具），A2A 是点对点（agent ↔ agent）。它定义了 Agent Card（发现机制）、带 artifact（文本、结构化数据、视频）的 task、不透明的 task 生命周期，以及 auth。生产系统越来越多把 MCP 与 A2A 配合使用。Google Cloud 在 2025-2026 年间把 A2A 支持集成进了 Vertex AI Agent Builder。

**Type:** Learn + Build
**Languages:** Python (stdlib, `http.server`, `json`)
**Prerequisites:** Phase 16 · 04 (Primitive Model)
**Time:** ~75 minutes

## 问题（Problem）

你的 agent 需要调用另一台系统上的另一个 agent。怎么调？你可以暴露一个 HTTP 端点、定义一份私有的 JSON schema，然后祈祷对面能听懂。每两个 agent 之间都会变成一次定制集成。

A2A 就是这种调用的通用线协议。标准的发现、标准的 task 模型、标准的传输、标准的 artifact。就像 HTTP+REST，只不过把 agent 当成一等公民。

## 概念（Concept）

### 四个要素（The four elements）

**Agent Card。** 一份位于 `/.well-known/agent.json` 的 JSON 文档，描述这个 agent：名字、技能、端点、支持的模态、auth 要求。发现就是去读这张卡片。

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

**Task。** 工作的基本单位。一个异步、有状态的对象，生命周期是：`submitted → working → completed / failed / canceled`。客户端提交一个 task，再轮询或订阅它的更新。

**Artifact。** task 产出的结果类型。文本、结构化 JSON、图像、视频、音频。Artifact 是带类型的，所以不同模态都是一等公民。

**不透明的生命周期（Opaque lifecycle）。** A2A 不规定远端 agent *怎么* 解这个 task。客户端只看得到状态迁移和 artifact；具体实现可以自由选用任何框架。

### MCP / A2A 的分工（The MCP/A2A split）

- **MCP**（第 13 课）：agent ↔ 工具。Agent 通过 JSON-RPC 读写到工具服务器。默认无状态。
- **A2A**：agent ↔ agent。对等协议；两边都是有自己推理能力的 agent。

生产中的多 agent 系统两个都会用。一个 A2A 对端在自己那一侧调 MCP 工具。这种分工把两类关注点分得很干净。

### 发现流程（Discovery flow）

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

或者用流式：通过 SSE 订阅 `/tasks/{id}/events` 拿到推送式更新。

### Auth

A2A 支持三种常见模式：

- **Bearer token** — OAuth2 或不透明 token。
- **mTLS** — 双向 TLS；组织之间互相证明身份。
- **Signed requests** — 对 payload 做 HMAC 签名。

Auth 在 Agent Card 里声明；客户端发现后照做。

### 到 2026 年 4 月已有 150+ 家组织（150+ organizations by April 2026）

A2A 的规模化是企业采用驱动的。一句话总结：A2A 成了企业 agent 系统跨越信任边界的标准做法。Google Cloud 发布了 Vertex AI Agent Builder 的 A2A 支持；Microsoft Agent Framework 也支持；主流框架（LangGraph、CrewAI、AutoGen）几乎都带了 A2A adapter。

### A2A 在哪里赢（Where A2A wins）

- **跨组织调用。** A 公司的 agent 调 B 公司的 agent。没有 A2A，每两家之间都得签一份定制契约。
- **异构框架。** LangGraph agent 调 CrewAI agent 调自定义 Python agent。A2A 把它们抹平。
- **带类型的 artifact。** 视频结果、结构化 JSON、音频 —— 都是一等公民。
- **长时运行的 task。** 不透明生命周期 + 轮询让小时级的 task 也很自然。

### A2A 在哪里吃力（Where A2A struggles）

- **延迟敏感的小调用。** A2A 的生命周期是异步的。亚毫秒级的 agent 间调用不适合用它；走直接 RPC。
- **进程内紧耦合的 agent。** 如果两个 agent 跑在同一个 Python 进程里，A2A 那一轮 HTTP 往返就是过度设计了。
- **小团队。** 规范本身有开销；纯内部使用的 agent 不一定需要这套形式化。

### A2A vs ACP、ANP、NLIP

2024-2026 年间出现了几份相关规范：

- **ACP**（IBM / Linux Foundation）— A2A 的前身，scope 更窄。
- **ANP**（Agent Network Protocol）— 重点在对等发现，去中心化优先。
- **NLIP**（Ecma 自然语言交互协议，2025 年 12 月标准化）— 自然语言内容类型。

截至 2026 年 4 月，A2A 是采用率最高的对等协议。对比可以看 arXiv:2505.02279（Liu 等，《A Survey of Agent Interoperability Protocols》）。

## 动手实现（Build It）

`code/main.py` 用 `http.server` 加 JSON 实现了一个 A2A 极简服务端和客户端。服务端：

- 暴露 `/.well-known/agent.json`，
- 接收 `POST /tasks`，
- 管理 task 状态，
- 在 `GET /tasks/{id}` 返回 artifact。

客户端：

- 取回 Agent Card，
- 提交 task，
- 轮询直到完成，
- 读 artifact。

运行：

```
python3 code/main.py
```

脚本会在后台线程里启动服务端，然后跑客户端打它。你能看到完整流程：发现、提交、轮询、artifact。

## 用起来（Use It）

`outputs/skill-a2a-integrator.md` 设计了一次 A2A 集成：Agent Card 内容、task schema、auth 选择、流式 vs 轮询。

## 上线部署（Ship It）

清单：

- **锁定规范版本。** A2A 还在演进；Agent Card 应该声明协议版本。
- **task 创建要幂等。** 重复提交（网络重试导致）应该只产出一个 task。
- **Artifact schema。** 声明 agent 返回的形状是什么；消费者要做校验。
- **限流 + auth。** A2A 是面向公网的；标准 Web 安全那套都得上。
- **失败 task 的死信队列。** 跨时间观察模式，找出反复出现的失败类型。

## 练习（Exercises）

1. 跑 `code/main.py`。确认客户端发现了服务端并拿到正确的 artifact。
2. 给服务端加第二个技能（比如 "summarize"）。更新 Agent Card。写一个客户端，按 task 类型挑技能。
3. 实现一个 SSE 流式端点：`/tasks/{id}/events`，发出状态变更。客户端要怎么改？
4. 读 A2A 规范（https://a2a-protocol.org/latest/specification/）。找出规范要求、但本 demo 没实现的三件事。
5. 把 A2A（Agent Card 发现）和 MCP（通过 `listTools` 在服务端列出能力）做对比。「自描述的 agent」和「主动探测能力」之间的取舍是什么？

## 关键术语（Key Terms）

| 术语 | 大家怎么说 | 实际含义 |
|------|----------------|------------------------|
| A2A | "Agent-to-agent" | 跨系统让 agent 调用其他 agent 的对等协议。Google 2025。 |
| Agent Card | "Agent 的名片" | 位于 `/.well-known/agent.json` 的 JSON，描述技能、端点、auth。 |
| Task | "工作的单位" | 异步、有状态的对象，有生命周期；完成时产出 artifact。 |
| Artifact | "结果" | 带类型的输出：文本、结构化 JSON、图像、视频、音频。一等的多媒体。 |
| Opaque lifecycle | "怎么解是 agent 自己的事" | 客户端只看状态迁移；服务端可以自由选框架 / 工具。 |
| Discovery | "找到那个 agent" | `GET /.well-known/agent.json` 返回卡片。 |
| MCP vs A2A | "工具 vs 同伴" | MCP：垂直方向 agent ↔ 工具。A2A：横向 agent ↔ agent。 |
| ACP / ANP / NLIP | "兄弟协议" | 周边规范；A2A 是 2026 年采用率最高的那个。 |

## 延伸阅读（Further Reading）

- [A2A specification](https://a2a-protocol.org/latest/specification/) — 权威规范
- [Google Developers Blog — A2A announcement](https://developers.googleblog.com/en/a2a-a-new-era-of-agent-interoperability/) — 2025 年 4 月的发布博文
- [A2A GitHub repo](https://github.com/a2aproject/A2A) — 参考实现与 SDK
- [Liu et al. — A Survey of Agent Interoperability Protocols](https://arxiv.org/html/2505.02279v1) — MCP、ACP、A2A、ANP 对比
