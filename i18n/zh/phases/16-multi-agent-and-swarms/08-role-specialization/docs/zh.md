# 角色专化 — Planner、Critic、Executor、Verifier

> 2026 年最常见的多智能体分解方式：一个智能体负责规划，一个负责执行，一个负责批评或验证。MetaGPT(arXiv:2308.00352)将其形式化为编码进角色提示词中的 SOP —— 产品经理、架构师、项目经理、工程师、QA 工程师 —— 遵循 `Code = SOP(Team)`。ChatDev(arXiv:2307.07924)通过"聊天链"和"沟通式去幻觉"(智能体显式请求缺失的细节)将设计者、程序员、审查者、测试者串联起来。Verifier 是承重角色：Cemri 等人(MAST,arXiv:2503.13657)表明，每一个多智能体失败都可以追溯到验证的缺失或失效。PwC 报告，在 CrewAI 中通过结构化验证循环获得了 7 倍的准确率提升(10% → 70%)。

**Type:** Learn + Build
**Languages:** Python (标准库)
**Prerequisites:** Phase 16 · 04 (Primitive Model)、Phase 16 · 05 (Supervisor)
**Time:** 约 60 分钟

## 问题

通用的多智能体系统产生通用的输出。三个编码者在同一个群聊里写出三种风格相同、同样平庸的代码。你可以增加更多智能体、增加更多轮次，仍然跨不过质量门槛。

解决方案不是更多智能体，而是*不同的*智能体。分配各不相同的角色。给 critic 提供 planner 所没有的工具。给 verifier 一个客观的测试套件。这样系统内部就有了分歧，并辅以有依据的修正，而不只是平行猜测。

## 概念

### 四个经典角色

**Planner。** 读取目标，产出步骤列表或规格说明。工具：知识检索、文档。输出：结构化计划。

**Executor。** 每次读取一个计划步骤，产出工件。工具：实际的工作工具(代码编译器、shell、API 客户端)。输出：工件。

**Critic。** 依据 planner 的意图审查 executor 的输出。工具：对工件的只读访问、静态分析。输出：接受/拒绝及理由。

**Verifier。** 读取工件并运行确定性检查。工具：测试运行器、类型检查器、schema 校验器。输出：通过/失败及证据。

Critic 是主观的、有主见的，通常基于 LLM。Verifier 是客观的、确定性的，通常基于代码。它们不是同一个角色。

### MetaGPT 的 SOP 模式

MetaGPT(arXiv:2308.00352)将软件工程 SOP 编码为角色提示词：

- **Product Manager** 撰写 PRD。
- **Architect** 产出系统设计。
- **Project Manager** 拆分任务。
- **Engineer** 实现功能。
- **QA Engineer** 运行测试。

每个角色都有严格的输入/输出 schema。角色提示词说明该角色*是什么*以及它*必须产出什么*。`Code = SOP(Team)` 的表述 —— 确定性的 SOP 把一组 LLM 变成一条可预测的流水线。

### ChatDev 的沟通式去幻觉

ChatDev 增加了一个关键动作：当 executor 需要一个计划中未曾给出的具体细节时，它在继续之前显式地向设计者询问。这防止了 LLM 典型的失败方式：貌似合理地凭空编造细节。

实现方式：角色提示词中包含"当你需要未被告知的具体信息时，在产出输出之前按名字向相关角色询问"。

### 为什么 verifier 最重要

Cemri 等人(MAST)追踪了 1642 次多智能体执行失败。21.3% 是验证缺口 —— 系统交付了一个无人检查过的答案。其余 79% 往往也能追溯到"存在一个检查，但它静默失败或从未运行"。验证是承重角色。

PwC 报告(CrewAI 部署，2025 年)加入结构化验证循环后，准确率从 10% 提升到 70%。一个角色带来 7 倍收益。

### Critic 与 verifier 的对比

- Critic 是一个 LLM,从质量角度审查工件。主观的。可能被貌似合理的文字糊弄。
- Verifier 是运行在工件上的确定性程序。客观的。给出通过/失败及证据。

两者都用。Critic 捕捉 verifier 无法表达的品味问题。Verifier 捕捉 critic 看不到的 bug,因为它们只在运行时显现。

### 反模式

系统中的每个角色都是 LLM,而且每个角色的输出都是"我觉得没问题"。这是典型的 MAST 失败模式。至少加入一个 pass/fail 由代码而非 LLM 决定的 verifier。

### 框架映射

- **CrewAI** — `Agent(role, goal, backstory)` 是教科书式的角色专化接口。
- **LangGraph** — 节点可以使用专化提示词；边负责强制执行流水线。
- **AutoGen** — 在 GroupChat 中使用带单字名称的特定角色 ConversableAgents。
- **OpenAI Agents SDK** — 在角色专化 Agent 之间进行 handoff 工具传递。

```figure
swarm-roles
```

## 动手构建

`code/main.py` 实现了一个构建简单 Python 函数的 4 角色流水线：

- **Planner** 产出规格说明。
- **Executor** 生成代码字符串。
- **Critic**(LLM 模拟)标记明显的问题。
- **Verifier** 在沙箱(`exec`)中针对测试用例运行生成的代码。

演示运行两次：一次 executor 产出正确代码(critic 和 verifier 都通过)，一次 executor 产出偏离规格的代码(critic 因为它看起来合理而漏掉了 bug,verifier 因为测试失败而抓住了它)。

运行：

```
python3 code/main.py
```

## 使用它

`outputs/skill-role-designer.md` 接收一个任务，产出角色名单(3-5 个角色)、每个角色的输入/输出 schema,以及 verifier 检查。在把智能体接入框架之前先使用它。

## 发布它

检查清单：

- **至少一个确定性 verifier。** 绝不能全是 LLM。
- **每个角色明确的 I/O schema。** planner 返回规格说明而不是散文；executor 读取该 schema。
- **沟通式去幻觉。** 当信息缺失时，executor 必须向 planner 询问；绝不自行编造。
- **Critic/verifier 顺序。** 先运行 critic(便宜，捕捉设计问题)，再运行 verifier(慢，捕捉 bug)。
- **循环预算。** 在升级给人工之前，最多进行 2 轮 critic-executor 修订。

## 练习

1. 运行 `code/main.py`,观察 verifier 如何抓住 critic 漏掉的 bug。增加一个静态分析检查(统计 `return` 的出现次数)作为额外的 verifier。它能捕捉到运行时测试漏掉了什么？
2. 增加第 5 个角色："需求分析师"，将用户愿望转化为 planner 可用的规格说明。哪些沟通式去幻觉请求应该向上传递给它？
3. 阅读 MetaGPT 第 3 节("Agents")。列出 MetaGPT 5 个角色各自的输入/输出 schema。
4. 阅读 ChatDev 的聊天链图(arXiv:2307.07924 图 3)。找出沟通式去幻觉在哪些地方打断了原本会无限循环的循环。
5. PwC 的 7 倍准确率提升来自验证循环。假设三个任务，在其中加入 verifier 没有帮助 —— 确定性正确性检查不可能实现或代价过高。

## 关键术语

| 术语 | 人们的说法 | 实际含义 |
|------|------------------------|------------------------|
| 角色专化 | "不同的智能体，不同的工作" | 为 planner/executor/critic/verifier 角色调校的各自不同的系统提示词。 |
| SOP 模式 | "编码的标准操作流程" | MetaGPT 的框架：每个角色严格的 I/O schema 把一组 LLM 变成流水线。 |
| 沟通式去幻觉 | "编造之前先询问" | ChatDev 模式：当细节缺失时，executor 向 planner 询问而不是自己编造。 |
| Critic | "LLM 审查者" | 主观、有主见的审查者。捕捉品味问题。可能被貌似合理的文字糊弄。 |
| Verifier | "确定性检查" | 基于代码的通过/失败。测试运行器、类型检查器、schema 校验器。无法被糊弄。 |
| 验证缺口 | "没人检查过" | 占 MAST 失败的 21.3%。答案在没有经过本可以抓住 bug 的检查的情况下就被交付。 |
| 修订循环 | "critic 把它打回去" | Critic 拒绝会触发 executor 带着反馈重新运行。需要预算。 |
| 全 LLM 反模式 | "我觉得没问题" | 每个角色都是 LLM,没有确定性检查。典型的 MAST 失败。 |

## 延伸阅读

- [Hong et al. — MetaGPT: Meta Programming for Multi-Agent Collaboration](https://arxiv.org/abs/2308.00352) — 将 SOP 作为角色提示词的参考论文
- [Qian et al. — Communicative Agents for Software Development (ChatDev)](https://arxiv.org/abs/2307.07924) — 聊天链 + 沟通式去幻觉
- [Cemri et al. — Why Do Multi-Agent LLM Systems Fail?](https://arxiv.org/abs/2503.13657) — MAST 分类法；验证缺口占失败的 21.3%
- [CrewAI 文档 — Agent 角色](https://docs.crewai.com/en/introduction) — 生产环境中的角色定义接口