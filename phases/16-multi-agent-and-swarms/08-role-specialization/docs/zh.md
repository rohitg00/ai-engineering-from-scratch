# 角色专业化 — Planner、Critic、Executor、Verifier

> 译注：本文译自同目录 [`en.md`](./en.md)。术语遵循仓根 [TRANSLATION_GUIDE.md](../../../../TRANSLATION_GUIDE.md)。

> 2026 年最常见的多 agent 拆分方式：一个 agent 负责规划，一个负责执行，一个负责批评或验证。MetaGPT（arXiv:2308.00352）把这套思路形式化为编码进角色 prompt 的 SOP——产品经理、架构师、项目经理、工程师、QA 工程师，遵循 `Code = SOP(Team)`。ChatDev（arXiv:2307.07924）通过一条「chat chain」串起设计师、程序员、reviewer（验证器）、测试员，并辅以 "communicative dehallucination"（agent 在缺信息时显式发问）。verifier（验证器）是承重角色：Cemri 等人在 MAST（arXiv:2503.13657）中指出，每一个多 agent 失败案例都能追溯到验证缺失或损坏。PwC 报告称，CrewAI 中加入结构化校验循环带来了 7× 的准确率提升（10% → 70%）。

**Type:** Learn + Build
**Languages:** Python (stdlib)
**Prerequisites:** Phase 16 · 04 (Primitive Model), Phase 16 · 05 (Supervisor)
**Time:** ~60 minutes

## 问题（Problem）

通用的多 agent 系统只会产出通用的输出。三个 coder 在群聊里写出来的，是同一段平庸代码的三种口味。你可以加更多 agent、加更多轮次，仍然跨不过质量门槛。

修法不是更多 agent，而是*不同的* agent。分配明确不同的角色。给 critic 一些 planner 没有的工具。给 verifier 一份客观的测试套件。这样系统内部就有了带根据的分歧与纠正，而不是平行猜测。

## 概念（Concept）

### 四个经典角色（The four canonical roles）

**Planner.** 读目标、产出步骤列表或 spec。工具：知识检索、文档。输出：结构化计划。

**Executor.** 一次读一步计划，产出工件。工具：真正的工作工具（代码编译器、shell、API 客户端）。输出：工件本身。

**Critic.** 对照 planner 的意图来读 executor 的输出。工具：对工件的只读访问、静态分析。输出：accept/reject 加理由。

**Verifier.** 读工件并跑确定性检查。工具：测试运行器、类型检查器、schema 校验器。输出：pass/fail 加证据。

Critic 是主观的、有立场的，通常基于 LLM。Verifier 是客观的、确定性的，通常基于代码。它们不是同一种角色。

### MetaGPT 的 SOP 模式（MetaGPT's SOP pattern）

MetaGPT（arXiv:2308.00352）把软件工程的 SOP 编码为角色 prompt：

- **Product Manager** 写 PRD。
- **Architect** 产出系统设计。
- **Project Manager** 拆任务。
- **Engineer** 实现。
- **QA Engineer** 跑测试。

每个角色都有严格的输入/输出 schema。角色 prompt 说清楚这个角色*是什么*、*必须产出什么*。`Code = SOP(Team)` 这个表达式想说的是——确定性的 SOP 把一支 LLM 团队变成一条可预测的流水线。

### ChatDev 的 communicative dehallucination

ChatDev 加入了一个关键动作：当 executor 需要某个计划里没写的具体细节时，它会显式地先去问设计师，再继续。这能避免那种经典的 LLM 失败模式——煞有介事地把细节编出来。

实现方式：角色 prompt 里写上「当你需要别人没给你的具体信息时，先点名问对应角色，再产出输出」。

### 为什么 verifier 最重要（Why verifier matters most）

Cemri 等人（MAST）追踪了 1642 个多 agent 执行失败案例。其中 21.3% 是验证缺口——系统给出了一个没人检查过的答案。剩下的 79% 也常常能追到「有一个本该执行的检查，要么静默失败，要么从来没跑过」。验证是承重角色。

PwC 在 2025 年的 CrewAI 部署中报告：加入结构化校验循环后，准确率从 10% 提升到 70%。一个角色就能带来 7× 收益。

### Critic 与 verifier 的区别（Critic vs verifier）

- critic 是一个 LLM 在审查工件的质量。主观。可能被看似合理的文字骗过去。
- verifier 是在工件上运行的确定性程序。客观。给出带证据的 pass/fail。

两个都用。critic 抓 verifier 描述不出来的品味问题。verifier 抓 critic 看不见的 bug——这些 bug 只有运行时才会冒出来。

### 反模式（The anti-pattern）

你系统里每个角色都是 LLM，每个角色的输出都是「我看挺好的」。这是经典的 MAST 失败模式。至少加一个 verifier，让它的 pass/fail 由代码决定，而不是 LLM。

### 各框架对应（Framework mappings）

- **CrewAI** — `Agent(role, goal, backstory)` 就是教科书式的专业化接口。
- **LangGraph** — 节点可以挂专门的 prompt；边来强制流水线顺序。
- **AutoGen** — 在 GroupChat 里用单词命名的、带角色的 ConversableAgents。
- **OpenAI Agents SDK** — 在专业化 Agent 之间用 handoff（交接）工具。

## 动手实现（Build It）

`code/main.py` 用一条 4 角色流水线构造一个简单的 Python 函数：

- **Planner** 产出 spec。
- **Executor** 生成一段代码字符串。
- **Critic**（LLM 模拟）标记明显问题。
- **Verifier** 在沙箱里（`exec`）跑生成的代码，对一个测试用例求值。

Demo 跑两次：一次 executor 产出正确代码（critic + verifier 都通过），一次 executor 产出偏离 spec 的代码（critic 漏掉这个 bug，因为它看上去合理；verifier 抓住了，因为测试挂了）。

运行：

```
python3 code/main.py
```

## 用起来（Use It）

`outputs/skill-role-designer.md` 接收一个任务，产出角色名册（3-5 个角色）、每个角色的输入/输出 schema，以及 verifier 的检查项。把 agent 接进框架之前先用一下它。

## 上线部署（Ship It）

清单：

- **至少有一个确定性 verifier。** 永远不要全 LLM。
- **每个角色都有显式 I/O schema。** planner 返回 spec，不是散文；executor 读这个 schema。
- **Communicative dehallucination。** executor 在信息缺失时必须问 planner；不要凭空发明。
- **critic/verifier 顺序。** 先跑 critic（便宜，抓设计问题），再跑 verifier（慢，抓 bug）。
- **循环预算。** critic-executor 修订最多 2 轮，超出就升级到人。

## 练习（Exercises）

1. 跑一遍 `code/main.py`，观察 verifier 如何抓住 critic 漏掉的 bug。再加一个静态分析检查（统计 `return` 的出现次数）作为额外 verifier。它能抓到运行时测试漏掉的什么？
2. 加第 5 个角色：「需求分析师」，把用户愿望翻译成 planner 可读的 spec。哪些 communicative dehallucination 请求应该上溯到它？
3. 读 MetaGPT 第 3 节（"Agents"）。列出 MetaGPT 5 个角色各自的输入/输出 schema。
4. 读 ChatDev 的 chat-chain 图（arXiv:2307.07924 Figure 3）。指出 communicative dehallucination 在哪里打断了一个本会无限循环的回路。
5. PwC 的 7× 准确率提升来自校验循环。给出三个任务，假设在那里加 verifier 也帮不上忙——也就是对正确性做确定性检查不可能、或代价高得离谱的场景。

## 关键术语（Key Terms）

| 术语 | 大家口头怎么说 | 实际意思 |
|------|----------------|------------------------|
| Role specialization（角色专业化） | "不同 agent 做不同事" | 为 planner/executor/critic/verifier 这些角色调好的、互不相同的 system prompt。 |
| SOP pattern（SOP 模式） | "把标准作业流程编码进去" | MetaGPT 的框架：每个角色严格的 I/O schema，把团队变成流水线。 |
| Communicative dehallucination | "先问，再发明" | ChatDev 的模式：executor 在细节缺失时去问 planner，而不是自己编。 |
| Critic | "LLM reviewer" | 主观的、有立场的 reviewer。能抓品味问题。可能被合理文字骗过。 |
| Verifier | "确定性检查" | 基于代码的 pass/fail。测试运行器、类型检查器、schema 校验器。骗不了它。 |
| Verification gap（验证缺口） | "没人检查" | MAST 失败案例的 21.3%。答案直接发出去，本可发现 bug 的检查没跑。 |
| Revision loop（修订循环） | "critic 把它打回来" | critic 拒收触发 executor 带反馈重跑。需要预算。 |
| All-LLM anti-pattern（全 LLM 反模式） | "我看挺好的" | 每个角色都是 LLM，没有确定性检查。MAST 经典失败。 |

## 延伸阅读（Further Reading）

- [Hong et al. — MetaGPT: Meta Programming for Multi-Agent Collaboration](https://arxiv.org/abs/2308.00352) — SOP-as-role-prompt 的参考论文
- [Qian et al. — Communicative Agents for Software Development (ChatDev)](https://arxiv.org/abs/2307.07924) — chat chain 与 communicative dehallucination
- [Cemri et al. — Why Do Multi-Agent LLM Systems Fail?](https://arxiv.org/abs/2503.13657) — MAST 分类法；验证缺口占失败的 21.3%
- [CrewAI docs — Agent roles](https://docs.crewai.com/en/introduction) — 生产环境的角色规约接口
