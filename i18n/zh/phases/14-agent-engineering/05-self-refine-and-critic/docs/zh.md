# 自我精炼和批判:反复产出改善

> 自理修 (Madaan et al., 2023) 在一个循环中使用一个LLM在三个角色中生成,反,完善.平均收益:7项任务上+20绝对.CRITIC (Gou et al., 2023) 通过通过外部工具路由验证来加固反步骤.2026年,这种模式将在每个框架中作为"评估者优化器" (Anthropic) 或一个防护轨道循环 (OpenAI Agents SDK).

**Type:** Build
**Languages:** Python (stdlib), TypeScript
**Prerequisites:** Phase 14 · 01 (Agent Loop), Phase 14 · 03 (Reflexion)
**Time:** ~60 minutes

## 学习目标

- 状态自我清理的三个提示 (生成,反,精炼) 并解释为什么历史对精炼提示很重要.
- 解释Critic的关键见解:在没有外部依据的情况下,LLC在自我验证上是不可靠的.
- 实现一个具有历史和可选的外部验证器的 stdlib 自定义循环.
- 绘制这个模式到安特罗皮克的"评估者优化器"工作流程和OpenAI代理SDK的输出防护窗口.

## 问题

代码可能有一个语法错误. 总结可能太长. 也许一个计划错过了一个边缘案例. 你想要的是: 代码批评自己的输出,然后修复它.

简单的方法是通过单个模型,没有训练数据,没有RL来实现这一目标.但有一个问题:LLM在硬实实上自我验证方面很不好.

它们将在2026年实现反复改进的默认标准:生成,验证 (在可能的情况下,外部),完善,停止验证器通过时.

## 概念

### 个人清理 (Madaan等, NeurIPS 2023)

一个法师,三个角色:

```
generate(task)            -> output_0
feedback(task, output_0)  -> critique_0
refine(task, output_0, critique_0, history) -> output_1
feedback(task, output_1)  -> critique_1
refine(task, output_1, critique_1, history) -> output_2
...
stop when feedback says "no issues" or budget exhausted.
```

关键细节:`refine`报纸中指出:历史下降,质量急剧下降.

标题:平均在7项任务 (数学,代码,缩写,对话) 中实现+20的绝对改善,包括GPT-4.没有培训,没有外部工具,单一模型.

### 评论 (Gou等人, arXiv:2305.11738, v4 Feb 2024)

对于事实性说法来说,这不可靠 (一种幻觉往往看起来令人信服的模型).`feedback(task, output)`随着`verify(task, output, tools)`在哪里`tools`包括:

- 搜索引擎寻找事实性索赔.
- 代码解释器,以确保代码正确.
- 算数计算器.
- 域特定验证器 (单位测试,类型检查器,接器).

验证器根据工具结果进行结构化批评,然后对此进行条件.

标题:Critic在事实任务上优于Self-Refine,因为批评是基于地面的.在没有外部验证器 (创意写作,格式化) 的任务上,Critic将其降低到Self-Refine.

### 停车条件

两种常见的形状:

1. **Verifier passes.**外部测试结果成功. 当可用时最好 (单元测试,类型检查器,防护断).
2. **No feedback issued.**价格更便宜,但不可靠; 配合最大.

2026默认:结合它们. "如果验证器通过OR模型说好,停止,并且反复 >= 2 OR反复 >= max_iterations".

### 评价者-优化器 (人类学, 2024)

亚当普奇的2024年12月的帖子将这列为五个工作流程模式之一.

- 评价者:评分产品并产生批评.
- 优化器:根据批评,修改输出.

循环直到评估器通过.这是Anthropic的框架中的自我清理/CRITIC.Anthropic补充说:评估器和优化器提示应该很大程度上不同,所以模型不仅仅是印.

### 开放AI代理SDK输出防护护

防护护是一个验证器,在代理的最终输出上运行.如果防护护出行 (升高)`OutputGuardrailTripwireTriggered`防护轨道可以调用工具 (CRITIC式) 或是纯函数 (Self-Refine式).

### 2026 年陷

- **Rubber-stamp loops.**采用结构上不同的提示,或者采用较小的廉价模型来批评.
- **Over-refinement.**每次精炼通过都增加了延迟和代币.预算1到3通过;之后,升级到人体审查.
- **CRITIC on trivial tasks.**如果没有外部验证器,Critic将退化为自行清理;不要为 stub验证器支付延迟.

```figure
self-refine
```

## 建立它

`code/main.py`通过自定义和CRITIC在玩具任务中实现:制作一个特定主题的短弹名单.验证器检查格式 (3弹,每个小于60个).Critic添加一个外部的"事实验证器",惩罚已知的幻觉.

组件:

- `generate`剧本制作人.
- `feedback` 法学士式的自我批评.
- `verify_external` 基于基层的Critic类型验证器.
- `refine`重写输出给出历史.
- 停止条件 验证器通过或最大4次代.

运行它:

```
python3 code/main.py
npx tsx code/main.ts
```

分析结果显示,自定义错误是因为外部验证器已经将自定义错误误误解读到.

## 用它

安特罗皮克的评估器优化器是这种模式的克劳德友好的语言.OpenAI Agents SDK的输出护是Critic形状的 (护可以调用工具).LangGraph发送一个反射节点,读起来像自定义.谷歌的Gemini 2.5计算机使用添加一个每步安全评估器,这是一个Critic变体:每一个操作都在提交之前被验证.

## 运送它

`outputs/skill-refine-loop.md`设置评估器优化器循环,以任务形状,验证器可用性和代预算. 发出生成器,评估器/验证器和优化器的提示,加上停止政策.

## 运动

1. 运行玩具的最大_率=1. 评论仍然有帮助吗?
2. 换一个噪音的外部验证器 (随机30%的假正值).循环是什么?这是大多数护堆的2026现实.
3. 实施"不同模型的生成器批评"变体:大模型生成,小模型批评. 它是否超过相同的模型?
4. 阅读Critic Section 3 (arXiv:2305.11738 v4). 举个证实工具类别,并为每一个类别举一个例子.
5. 图片OpenAI代理SDK的`output_guardrails`什么是 SDK 错误的,什么是正确的?

## 关键词

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Self-Refine | "LLM that fixes itself" | Generate -> feedback -> refine loop in one model, with history |
| CRITIC | "Tool-grounded verification" | Replace feedback with an external verifier (search, code, calc, tests) |
| Evaluator-Optimizer | "Anthropic workflow pattern" | Two roles — evaluator scores, optimizer revises — looped to convergence |
| Output guardrail | "Post-hoc check" | OpenAI Agents SDK validator that runs after an agent produces output |
| Verify step | "Critique phase" | The load-bearing decision: grounded or self-rated |
| Refine history | "What the model already tried" | Prior outputs + critiques prepended to refine prompt; drop and quality collapses |
| Rubber-stamp loop | "Self-agreement failure" | Same-prompt critique returns "looks good"; fix with structurally different prompts |
| Stop condition | "Convergence test" | Verifier passes OR no feedback AND iteration cap; never single-condition |

## 进一步阅读

- [Madaan et al., Self-Refine (arXiv:2303.17651)](https://arxiv.org/abs/2303.17651)法典论文
- [Gou et al., CRITIC (arXiv:2305.11738)](https://arxiv.org/abs/2305.11738)基于工具的验证
- [Anthropic, Building Effective Agents](https://www.anthropic.com/research/building-effective-agents)评估者-优化器工作流程模式
- [OpenAI Agents SDK docs](https://openai.github.io/openai-agents-python/)作为Critic型验证器的输出护
