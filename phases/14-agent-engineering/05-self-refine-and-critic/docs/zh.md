# Self-Refine 与 CRITIC：迭代式输出改进

> 译注：本文译自同目录 [`en.md`](./en.md)。术语遵循仓根 [TRANSLATION_GUIDE.md](../../../../TRANSLATION_GUIDE.md)。

> Self-Refine（Madaan et al., 2023）让同一个 LLM 在循环里扮演三种角色——生成、反馈、改写。7 个任务上平均涨点 +20（绝对值）。CRITIC（Gou et al., 2023）通过把验证步骤外包给外部工具，强化了反馈环节。到 2026 年，这个范式已经在每个框架里以 "evaluator-optimizer"（Anthropic 的叫法）或 guardrail（护栏）循环（OpenAI Agents SDK 的叫法）的名义出货。

**Type:** Build
**Languages:** Python (stdlib)
**Prerequisites:** Phase 14 · 01 (Agent Loop), Phase 14 · 03 (Reflexion)
**Time:** ~60 minutes

## 学习目标

- 说出 Self-Refine 的三个 prompt（generate、feedback、refine），并解释为什么 refine prompt 里的历史很重要。
- 解释 CRITIC 的关键洞见：LLM 在没有外部依据时不擅长自我验证。
- 用 stdlib 实现一个带历史的 Self-Refine 循环，外加可选的外部验证器。
- 把这个范式映射到 Anthropic 的 "evaluator-optimizer" workflow 以及 OpenAI Agents SDK 的 output guardrail。

## 问题（Problem）

agent 给出的答案几乎对了。可能某行代码有个语法错误，可能摘要太长，可能某个计划漏掉了边界情形。你想要的是：让 agent 自己点评自己的输出，再把它修好。

Self-Refine 表明，单个模型就能做到这件事——不需要训练数据、不需要 RL。但有个坑：LLM 在硬事实的自我验证上很差。CRITIC 把解法说清楚了——把验证步骤路由给外部工具（搜索、code interpreter、计算器、测试 runner）。

这两篇论文一起，定义了 2026 年迭代改进的默认范式：生成、验证（条件允许就走外部）、改写、验证通过就停。

## 概念（Concept）

### Self-Refine（Madaan et al., NeurIPS 2023）

一个 LLM，三种角色：

```
generate(task)            -> output_0
feedback(task, output_0)  -> critique_0
refine(task, output_0, critique_0, history) -> output_1
feedback(task, output_1)  -> critique_1
refine(task, output_1, critique_1, history) -> output_2
...
stop when feedback says "no issues" or budget exhausted.
```

关键细节：`refine` 看得到完整历史——之前所有的输出和评议——这样它就不会重犯同样的错。论文做了 ablation（消融实验）：去掉历史，质量明显下降。

成绩单：在 7 个任务（math、code、acronym、dialog）上平均 +20 绝对涨点，包括 GPT-4。零训练、零外部工具、单模型。

### CRITIC（Gou et al., arXiv:2305.11738, v4 Feb 2024）

Self-Refine 的弱点：反馈步骤是 LLM 给自己打分。对事实性陈述来说，这并不可靠（一个 hallucination 在它的产出方眼里往往看着挺有说服力）。CRITIC 把 `feedback(task, output)` 替换成 `verify(task, output, tools)`，其中 `tools` 包括：

- 用于事实陈述的搜索引擎。
- 用于代码正确性的 code interpreter。
- 用于算术的计算器。
- 领域专属的验证器（单元测试、type checker、linter）。

验证器输出一份基于工具结果的、结构化的评议。改写器再以这份评议为条件去修。

成绩单：在事实性任务上 CRITIC 比 Self-Refine 强，因为评议有据可查。在没有外部验证器的任务上（创意写作、格式化），CRITIC 退化为 Self-Refine。

### 停止条件

两种常见形态：

1. **验证器通过。** 外部测试返回成功。条件允许时优先选这个（单元测试、type checker、guardrail 断言）。
2. **没有反馈意见。** 模型说 "输出可以"。便宜但不可靠；要配合最大迭代次数上限一起用。

2026 年的默认配方：把两者结合起来。"如果 verifier 通过 OR（模型说可以 AND 迭代 >= 2）OR 迭代 >= max_iterations，就停。"

### Evaluator-Optimizer（Anthropic，2024）

Anthropic 在 2024 年 12 月那篇文章里把它列为五种 workflow 范式之一。两种角色：

- Evaluator：给输出打分，并产出评议。
- Optimizer：依据评议去修改输出。

循环直到 evaluator 放行。这就是 Self-Refine/CRITIC 在 Anthropic 框架里的版本。Anthropic 加上的关键工程细节是：evaluator 和 optimizer 的 prompt 必须在结构上明显不同，免得模型只会盖橡皮图章（rubber-stamp）。

### OpenAI Agents SDK 的 output guardrail

OpenAI Agents SDK 把这个范式以 "output guardrail"（输出护栏）的名义出货。一个 guardrail 是跑在 agent 最终输出上的 validator（验证器）。如果 guardrail 触发了（抛出 `OutputGuardrailTripwireTriggered`），输出就被拒掉，agent 可以重试。Guardrail 可以调用工具（CRITIC 风格）或者是纯函数（Self-Refine 风格）。

### 2026 年的坑

- **橡皮图章循环（Rubber-stamp loops）。** 同一个模型用同一种 prompt 风格做生成又做评议，结果会收敛到 "我看挺好"。要用结构上不同的 prompt，或者用一个更便宜的小模型来做评议。
- **过度改写。** 每一轮 refine 都加 latency（延迟）和 token。给 1–3 轮预算；超过就上人工 review。
- **在琐碎任务上用 CRITIC。** 如果没有外部验证器，CRITIC 就退化成 Self-Refine；不要为一个空壳 verifier 付出额外延迟。

## 动手实现（Build It）

`code/main.py` 在一个玩具任务上实现 Self-Refine 和 CRITIC：给一个主题，输出一份简短的 bullet list。验证器检查格式（3 个 bullet，每个不超过 60 个字符）。CRITIC 再加一个外部 "事实验证器"，用来惩罚已知的 hallucination。

组件：

- `generate` —— 脚本化的生产者。
- `feedback` —— LLM 风格的自我评议。
- `verify_external` —— CRITIC 风格的、有据可查的验证器。
- `refine` —— 依据历史改写输出。
- 停止条件 —— verifier 通过，或最多 4 次迭代。

跑一下：

```
python3 code/main.py
```

对比 Self-Refine 和 CRITIC 两次运行的结果。CRITIC 抓到了一个 Self-Refine 漏掉的事实错误，因为外部验证器有自评者所没有的依据。

## 用起来（Use It）

Anthropic 的 evaluator-optimizer 就是这个范式在 Claude 风格语境下的说法。OpenAI Agents SDK 的 output guardrail 是 CRITIC 形状的（guardrail 可以调工具）。LangGraph 出货了一个 reflection 节点，读起来跟 Self-Refine 一样。Google 的 Gemini 2.5 Computer Use 加了一个逐步骤的安全评估器，本质上是 CRITIC 的变种：每一个动作 commit 之前都先验证。

## 上线部署（Ship It）

`outputs/skill-refine-loop.md` 给定任务形态、验证器可用性、迭代预算，配出一个 evaluator-optimizer 循环。它会产出 generator、evaluator/verifier、optimizer 的 prompt，外加一份停止策略。

## 练习

1. 把玩具任务的 max_iterations 设成 1。CRITIC 还有用吗？
2. 把外部验证器换成一个有噪声的版本（随机 30% 假阳性）。循环会怎么样？这就是 2026 年大多数 guardrail 栈的现实。
3. 实现一个 "generator 和 critic 用不同模型" 的变体：大模型做生成，小模型做评议。它能赢同模型版本吗？
4. 读 CRITIC 第 3 节（arXiv:2305.11738 v4）。说出三类验证工具，并各举一例。
5. 把 OpenAI Agents SDK 的 `output_guardrails` 映射到 CRITIC 的 verifier 角色。SDK 哪里做错了，哪里做对了？

## 关键术语

| 术语 | 大家是怎么说的 | 它实际是什么 |
|------|----------------|------------------------|
| Self-Refine | "LLM 自己修自己" | 单模型里 generate -> feedback -> refine 循环，带历史 |
| CRITIC | "工具有据可查的验证" | 把 feedback 换成外部验证器（搜索、代码、计算、测试） |
| Evaluator-Optimizer | "Anthropic 的 workflow 范式" | 两种角色——evaluator 打分，optimizer 改写——循环到收敛 |
| Output guardrail | "事后检查" | OpenAI Agents SDK 在 agent 产出输出之后跑的 validator |
| Verify step | "评议阶段" | 承重的决策：是有据可查，还是自己打分 |
| Refine history | "模型已经试过的东西" | 之前的输出 + 评议拼到 refine prompt 前面；丢掉它质量会塌 |
| Rubber-stamp loop | "自我认同失败" | 同 prompt 评议返回 "看着挺好"；用结构不同的 prompt 修 |
| Stop condition | "收敛测试" | verifier 通过 OR 没反馈 AND 迭代上限；绝不要只用单一条件 |

## 进一步阅读

- [Madaan et al., Self-Refine (arXiv:2303.17651)](https://arxiv.org/abs/2303.17651) —— 经典原论文
- [Gou et al., CRITIC (arXiv:2305.11738)](https://arxiv.org/abs/2305.11738) —— 工具有据可查的验证
- [Anthropic, Building Effective Agents](https://www.anthropic.com/research/building-effective-agents) —— evaluator-optimizer workflow 范式
- [OpenAI Agents SDK docs](https://openai.github.io/openai-agents-python/) —— output guardrail 作为 CRITIC 形状的验证器
