# A2A——智能体对智能体协议

> Google于2025年4月宣布A2A；到2026年4月，规范位于https://a2a-protocol.org/latest/specification/，150+组织支持它。A2A是MCP（第13课）的水平补充：MCP是垂直的（智能体 ↔ 工具），A2A是点对点的（智能体 ↔ 智能体）。它定义了智能体卡片（发现）、带有工件的任务（文本、结构化数据、视频）、不透明任务生命周期和认证。生产系统越来越多地将MCP与A2A配对。Google Cloud在2025-2026年将A2A支持推出到Vertex AI Agent Builder。

**类型：** 学习 + 构建
**语言：** Python（标准库，`http.server`，`json`）
**前置知识：** 第16阶段 · 04（原语模型）
**时间：** 约75分钟

## 问题

你的智能体需要调用另一个系统上的另一个智能体。如何？你可以暴露一个HTTP端点，定义一个定制的JSON模式，并希望对方说同样的语言。每对智能体变成一个定制集成。

A2A是该调用的通用线协议。标准发现、标准任务模型、标准传输、标准工件。像HTTP+REST，但智能体作为一等公民。

## 核心概念

### 四个元素

**智能体卡片。** 位于`/.well-known/agent.json`的JSON文档，描述智能体：名称、技能、端点、支持的模态、认证要求。发现通过读取卡片发生。

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

**任务。** 工作单元。一个异步、有状态的对象，具有生命周期：`submitted → working → completed / failed / canceled`。客户端发送任务，轮询或订阅更新。

**工件。** 任务产生的结果类型。文本、结构化JSON、图像、视频、音频。工件是类型化的，所以不同模态是一等的。

**不透明生命周期。** A2A不规定*远程智能体如何解决任务*。客户端看到状态转换和工件；实现可以自由使用任何框架。

### MCP/A2A分割

- **MCP**（第13课）：智能体 ↔ 工具。智能体通过JSON-RPC读取/写入工具服务器。默认无状态。
- **A2A**：智能体 ↔ 智能体。对等协议；双方都是具有自己推理的智能体。

生产多智能体系统两者都用。A2A对等方在其端调用MCP工具。分割保持两个关注点干净。

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

或使用流式：SSE订阅到`/tasks/{id}/events`以获取推送更新。

### 认证

A2A支持三种常见模式：

- **Bearer令牌** —— OAuth2或不透明。
- **mTLS** —— 双向TLS；组织相互证明身份。
- **签名请求** —— 对有效载荷的HMAC。

认证在智能体卡片中声明；客户端发现并遵守。

### 到2026年4月150+组织

企业采用推动了A2A规模。标题：A2A成为企业智能体系统跨越信任边界的方式。Google Cloud推出Vertex AI Agent Builder A2A支持；Microsoft Agent Framework支持它；大多数主要框架（LangGraph、CrewAI、AutoGen）提供A2A适配器。

### A2A获胜的地方

- **跨组织调用。** 公司A的智能体调用公司B的智能体。没有A2A，每对都是定制合同。
- **异构框架。** LangGraph智能体调用CrewAI智能体调用定制Python智能体。A2A规范化。
- **类型化工件。** 视频结果、结构化JSON、音频——都是一等的。
- **长期运行任务。** 不透明生命周期 + 轮询使数小时长的任务变得简单。

### A2A挣扎的地方

- **延迟敏感的微调用。** A2A的生命周期是异步的。亚毫秒智能体对智能体不适合；使用直接RPC。
- **紧耦合进程内智能体。** 如果两个智能体在同一Python进程中运行，A2A的HTTP往返是多余的。
- **小团队。** 规范开销是真实的；仅限内部的智能体可能不需要这种正式性。

### A2A vs ACP、ANP、NLIP

2024-2026年出现了几个相关规范：

- **ACP**（IBM/Linux Foundation）—— A2A的前身，范围更窄。
- **ANP**（智能体网络协议）—— 偏重对等发现，去中心化优先。
- **NLIP**（Ecma自然语言交互协议，2025年12月标准化）—— 自然语言内容类型。

截至2026年4月，A2A是最被采用的对等协议。参见arXiv:2505.02279（Liu等人，"智能体互操作性协议综述"）进行比较。

## 构建它

`code/main.py`使用`http.server`和JSON实现A2A最小服务器和客户端。服务器：

- 暴露`/.well-known/agent.json`，
- 接受`POST /tasks`，
- 管理任务状态，
- 在`GET /tasks/{id}`上返回工件。

客户端：

- 获取智能体卡片，
- 提交任务，
- 轮询直到完成，
- 读取工件。

运行：

```
python3 code/main.py
```

脚本在后台线程中启动服务器，然后针对它运行客户端。你看到完整流程：发现、提交、轮询、工件。

## 使用它

`outputs/skill-a2a-integrator.md`设计A2A集成：智能体卡片内容、任务模式、认证选择、流式 vs 轮询。

## 交付它

检查清单：

- **固定规范版本。** A2A仍在演进；智能体卡片应声明协议版本。
- **幂等任务创建。** 重复提交（网络重试）应产生一个任务。
- **工件模式。** 声明智能体返回什么形状；消费者应验证。
- **速率限制 + 认证。** A2A是面向公众的；应用标准Web安全。
- **失败任务的死信。** 随时间检查重复失败类型的模式。

## 练习

1. 运行`code/main.py`。确认客户端发现服务器并接收正确的工件。
2. 向服务器添加第二个技能（例如，"summarize"）。更新智能体卡片。编写基于任务类型选择技能的客户端。
3. 实现SSE流式端点：`/tasks/{id}/events`，发出状态变化。客户端需要做什么不同？
4. 阅读A2A规范（https://a2a-protocol.org/latest/specification/）。识别规范强制要求而此演示未实现的三件事。
5. 比较A2A（智能体卡片发现）与MCP（通过`listTools`的服务器端能力列表）。自描述智能体与能力探测之间的权衡是什么？

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|-----------|---------|
| A2A | "智能体对智能体" | 智能体跨系统调用其他智能体的对等协议。Google 2025。 |
| 智能体卡片 | "智能体的名片" | 位于`/.well-known/agent.json`的JSON，描述技能、端点、认证。 |
| 任务 | "工作单元" | 具有生命周期的异步有状态对象；完成时产生工件。 |
| 工件 | "结果" | 类型化输出：文本、结构化JSON、图像、视频、音频。一等媒体。 |
| 不透明生命周期 | "如何解决是智能体的事" | 客户端看到状态转换；服务器自由选择框架/工具。 |
| 发现 | "找到智能体" | `GET /.well-known/agent.json`返回卡片。 |
| MCP vs A2A | "工具 vs 对等" | MCP：垂直智能体 ↔ 工具。A2A：水平智能体 ↔ 智能体。 |
| ACP / ANP / NLIP | "兄弟协议" | 相邻规范；A2A是2026年最被采用的。 |

## 延伸阅读

- [A2A规范](https://a2a-protocol.org/latest/specification/) —— 规范规范
- [Google Developers Blog — A2A公告](https://developers.googleblog.com/en/a2a-a-new-era-of-agent-interoperability/) —— 2025年4月发布文章
- [A2A GitHub仓库](https://github.com/a2aproject/A2A) —— 参考实现和SDK
- [Liu等人——智能体互操作性协议综述](https://arxiv.org/html/2505.02279v1) —— MCP、ACP、A2A、ANP比较