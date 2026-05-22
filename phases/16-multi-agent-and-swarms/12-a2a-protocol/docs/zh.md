# A2A — 智能体对智能体协议

> Google 在 2025 年 4 月宣布了 A2A；到 2026 年 4 月，规范位于 https://a2a-protocol.org/latest/specification/，并有 150+ 组织支持。A2A 是 MCP（第 13 课）的水平补充：MCP 是垂直的（智能体 ↔ 工具），A2A 是对等的（智能体 ↔ 智能体）。它定义了智能体卡片（发现）、带有产物（文本、结构化数据、视频）的任务、不透明任务生命周期和身份验证。生产系统越来越多地将 MCP 与 A2A 配对。Google Cloud 在 2025-2026 年期间将 A2A 支持滚动到 Vertex AI Agent Builder 中。

**类型：** 学习 + 构建
**语言：** Python（标准库、`http.server`、`json`）
**前置条件：** 阶段 16.04（原语模型）
**时长：** 约 75 分钟

## 问题背景

你的智能体需要调用另一个系统上的另一个智能体。如何做？你可以暴露一个 HTTP 端点，定义一个定制 JSON 模式，并希望另一方讲它。每对智能体都成为自定义集成。

A2A 是对该调用的通用线路协议。标准发现、标准任务模型、标准传输、标准产物。就像 HTTP+REST，但是将智能体作为一等公民。

## 概念讲解

### 四个元素

**智能体卡片（Agent Card）。** 在 `/.well-known/agent.json` 的 JSON 文档，描述智能体：名称、技能、端点、支持的模态、身份验证要求。发现通过读取卡片发生。

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

**任务（Task）。** 工作单元。一个带有生命周期的异步、有状态对象：`submitted → working → completed / failed / canceled`。客户端发送任务，轮询或订阅更新。

**产物（Artifact）。** 任务产生的结果类型。文本、结构化 JSON、图像、视频、音频。产物是类型化的，所以不同模态是一等的。

**不透明生命周期（Opaque lifecycle）。** A2A 不规定*远程智能体如何解决任务。客户端看到状态转换和产物；实现可以自由使用任何框架。

### MCP/A2A 拆分

- **MCP**（第 13 课）：智能体 ↔ 工具。智能体通过 JSON-RPC 对工具服务器进行读/写。默认无状态。
- **A2A**：智能体 ↔ 智能体。对等协议；双方都是拥有自己推理的智能体。

生产多智能体系统同时使用两者。一个 A2A 对等体在其侧调用 MCP 工具。拆分使两个关注点保持清晰。

### 发现流程

```
客户端                     智能体服务器
  ├──GET /.well-known/agent.json──>
  <──智能体卡片 JSON─────────────
  ├──POST /tasks {skill, input}──>
  <──201 task_id, state=submitted
  ├──GET /tasks/{id}──────────────>
  <──state=working, 42% done──────
  ├──GET /tasks/{id}──────────────>
  <──state=completed, artifacts──
```

或者使用流式传输：订阅 `/tasks/{id}/events` 以获取推送更新。

### 身份验证

A2A 支持三种常见模式：

- **Bearer 令牌** — OAuth2 或不透明令牌。
- **mTLS** — 相互 TLS；组织相互证明身份。
- **签名请求** — 基于 HMAC 的有效负载。

身份验证在智能体卡片中声明；客户端发现并遵守。

### 截至 2026 年 4 月的 150+ 组织

企业采用推动了 A2A 规模。标题：A2A 成为企业智能体系统跨越信任边界的方式。Google Cloud 发布了 Vertex AI Agent Builder A2A 支持；Microsoft Agent Framework 支持它；大多数主要框架（LangGraph、CrewAI、AutoGen）都提供了 A2A 适配器。

### A2A 的优势所在

- **跨组织调用。** 公司 A 的智能体调用公司 B 的智能体。没有 A2A，每一对都是定制契约。
- **异构框架。** LangGraph 智能体调用 CrewAI 智能体调用自定义 Python 智能体。A2A 规范化。
- **类型化产物。** 视频结果、结构化 JSON、音频——全都是一等的。
- **长时间运行的任务。** 不透明生命周期 + 轮询使长达数小时的任务变得简单。

### A2A 的挣扎之处

- **延迟敏感的微调用。** A2A 的生命周期都是异步的。亚毫秒智能体对智能体不适合；使用直接 RPC。
- **紧耦合的进程内智能体。** 如果两个智能体在同一个 Python 进程中运行，A2A 的 HTTP 往返就是过度杀伤力。
- **小团队。** 规范开销是真实的；仅内部的智能体可能不需要这种形式。

### A2A vs ACP、ANP、NLIP

2024-2026 年出现了几个相关规范：

- **ACP**（IBM/Linux Foundation）— A2A 的前身，范围更窄。
- **ANP**（智能体网络协议）— 对等发现heavy，去中心化优先。
- **NLIP**（Ecma 自然语言交互协议，2025 年 12 月标准化）— 自然语言内容类型。

截至 2026 年 4 月，A2A 是被采用最多的对等协议。比较请参见 arXiv:2505.02279（Liu et al.，"智能体互操作协议调查"）。

## 构建实现

`code/main.py` 使用 `http.server` 和 JSON 实现了一个最小 A2A 服务器和客户端。服务器：

- 暴露 `/.well-known/agent.json`，
- 接受 `POST /tasks`，
- 管理任务状态，
- 在 `GET /tasks/{id}` 上返回产物。

客户端：

- 获取智能体卡片，
- 提交任务，
- 轮询直到完成，
- 读取产物。

运行：

```
python3 code/main.py
```

脚本在后台线程中启动服务器，然后针对它运行客户端。你看到完整的流程：发现、提交、轮询、产物。

## 实际应用

`outputs/skill-a2a-integrator.md` 设计 A2A 集成：智能体卡片内容、任务模式、身份验证选择、流式传输 vs 轮询。

## 部署实现

检查清单：

- **固定规范版本。** A2A 仍在演进；智能体卡片应声明协议版本。
- **幂等任务创建。** 重复提交（网络重试）应产生一个任务。
- **产物模式。** 声明智能体返回的形状；消费者应验证。
- **速率限制 + 身份验证。** A2A 是面向公众的；应用标准 Web 安全。
- **失败任务的死信。** 随时间检查模式以发现反复出现的失败类型。

## 练习

1. 运行 `code/main.py`。确认客户端发现服务器并接收正确的产物。
2. 向服务器添加第二个技能（例如，"总结"）。更新智能体卡片。编写一个根据任务类型选择技能的客户端。
3. 实现 SSE 流式端点：`/tasks/{id}/events`，它发出状态变化。客户端需要做什么不同？
4. 阅读 A2A 规范（https://a2a-protocol.org/latest/specification/）。确定此演示未实现的规范强制的三件事。
5. 将 A2A（智能体卡片发现）与 MCP（通过 `listTools` 的服务器端能力列表）进行比较。自描述智能体和能力探测之间的权衡是什么？

## 关键术语

| 术语 | 人们说的 | 它实际意味着什么 |
|------|----------------|------------------------|
| A2A | "智能体对智能体" | 智能体跨系统调用其他智能体的对等协议。Google 2025。 |
| Agent Card（智能体卡片） | "智能体的名片" | 在 `/.well-known/agent.json` 的 JSON，描述技能、端点、身份验证。 |
| Task（任务） | "工作单元" | 带有生命周期的异步有状态对象；在完成时产生产物。 |
| Artifact（产物） | "结果" | 类型化输出：文本、结构化 JSON、图像、视频、音频。一等媒体。 |
| Opaque lifecycle（不透明生命周期） | "如何解决是智能体的事" | 客户端看到状态转换；服务器可以自由选择框架/工具。 |
| Discovery（发现） | "找到智能体" | `GET /.well-known/agent.json` 返回卡片。 |
| MCP vs A2A | "工具 vs 对等体" | MCP：垂直智能体 ↔ 工具。A2A：水平智能体 ↔ 智能体。 |
| ACP / ANP / NLIP | "兄弟协议" | 相邻规范；A2A 是 2026 年被采用最多的。 |

## 延伸阅读

- [A2A 规范](https://a2a-protocol.org/latest/specification/) — 规范规范
- [Google 开发者博客——A2A 公告](https://developers.googleblog.com/en/a2a-a-new-era-of-agent-interoperability/) — 2025 年 4 月发布帖子
- [A2A GitHub 仓库](https://github.com/a2aproject/A2A) — 参考实现和 SDK
- [Liu et al. —— 智能体互操作协议调查](https://arxiv.org/html/2505.02279v1) — MCP、ACP、A2A、ANP 比较
