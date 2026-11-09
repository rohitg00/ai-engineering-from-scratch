# 思想社会和多元论坛

> 根据明斯基的1986年前提,智能是专家的社会,每十年都会重新发现.在2023年,杜等人将其转化为一个具体的算法:多个LLM实例提出答案,阅读对方的答案,批评和更新.在N轮中,它们汇集在一个共识上,超过零射击CoT和反思六个推理和事实性任务.两个发现都重要:**multiple agents**其他**multiple rounds**单独的交换比一次性投票更好.

**Type:** Learn + Build
**Languages:** Python (stdlib), TypeScript
**Prerequisites:** Phase 16 · 04 (Primitive Model)
**Time:** ~60 minutes

## 问题

自我一致性 样本一个模型多次,并接受多数答案 是最便宜的推理改进.它可以工作,但它快速和.你可以翻倍你的样本,没有看到另一个有意义的跳跃.

辩论打破了度.而不是从一个模型中获得的N独立样本,N代理人读取了彼此的推理和修订.样本之间的相关性下降 (它们不再是ID),并且在ID投票确实错误的地方,结合点往往是正确的.

## 概念

### 杜等人2023年算法

根据第1条第1条第2条第2条第2条第2条第2条第2条第2条第2条第2条第2条第2条第2条第2条第2条第2条第2条第2条第2条第2条第2条第2条第2条第2条第2条第2条第2条第2条第2条第2条第2条第2条第2条第2条第2条第2条第2条第2条第2条第2条第2条第2条第2条第2条第2条第2条第2条第2条第2条第2条第2条第2条第2条第2条第2条第2条第2条第2条第2条第2条第2条第2条第2条第2条第2条第2条第2条第2条第2条第2条第2条第2条第2条第2条第2条第2条第2条第2条第2条第2条第2条第2条第2条第2条第2条第2条第2条第2条第2条第2条第2条第2条第2条第2条第2条第2条第2条第2条第2条第2条第2条第2条第2条第2条第2条第2条第2条第2条第2条第2条第2条第2条第2条第2条第2条第2条第2条第2条

1. 每个N代理都会给出一个初始的答案.
2. 对于轮 r = 2..R:每个代理人被显示其他代理人的轮 r-1答案,并被问及"考虑到这些,给出您的更新答案".
3. 在R轮结束后,多数投票对最后的答案.

论文测试MMLU,GSM8K,传记,MATH和事实性基准.

### 两个独立的

单一文件的摘录:

- **Agent count alone**总体的投票率为N.
- **Round count alone** 反映的所知弱点几乎没有帮助.
- **Both together**许多代理之间的多轮交换推动了收益.

### 为什么它能有效

两个机制:

1. **Exposure to disagreement.**当一个代理看到另一个代理的推理链有不同的结论时,它必须证明或更新.无论如何,轮 r+1的背景都比轮 r 丰富.
2. **Correlated error reduction.**在自相一致性中,所有样本都来自同一模型,因此错误相关联 你平均的答案是自信错误的.不同的模型或不同的种子脱节.不同的 *争论观点*进一步脱节.

### 异质辩论

对于不同剂体,A-HMAD和相关的后续研究使用*不同的基模型*.Llama + Claude + GPT辩论减少单种植崩 (课 26) 因为一个模型家族的相关错误不被其他模型共享.

缺点:参与辩论的弱型模型可能会把共识拖到错误的答案 (见"我们应该疯狂吗?" arXiv:2311.17371).

### 129代理扩展

朱格等人 ("自然语言基础的思想社会中的思想风暴", arXiv:2305.17066) 将这一想法扩展到129个成员社会.结果:专业化和自我组织随着规模的发展而出现,系统在视觉问题答案等任务上超过单个代理.

### 失败模式

- **Sycophancy cascade.**任何代理都会选择最自信的代理人. 辩论都会崩. 促使对抗角色 ("一个代理必须争辩对立场") 有助.
- **Topic drift.**减轻:每次再注射问题.
- **Compute blowup.**五个代理,五轮辩论在不断增长的背景下是25次.每次问题成本可能超过10次单次CoT电话.

```figure
multi-agent-debate
```

## 建立它

`code/main.py`经过3个代理 ×3轮辩论,每个代理开始与不同的 (可能错误的) 答案. 代理通过通过通过编写信任权重的邻居答案进行平均更新. 转换可以在轮回日志中看到.

演示显示了两个主要效果:

- 一轮交换将代理人更接近正确的答案.
- 后期的额外轮回显示收益率下降 (与杜等等等等等级相匹配).

运行:

```
python3 code/main.py
npx tsx code/main.ts
```

## 用它

`outputs/skill-debate-configurator.md`设置一个新的任务的辩论:代理人数量,轮子数量,异质性 (相同模型与混合),角色分配 (对称与一个对立).

## 运送它

如果您发出辩论:

- **Cap rounds at 3.**两位同事表示,三次发射占据了大部分收益.
- **Cap agents at 5.**在5之后,背景膨胀和成本占主导地位.
- **Heterogeneous by default.**至少有两个不同的基模型在游泳池里.
- **Adversarial slot.**一个代理人不管怎么说,不管怎么说,打破了缩症.
- **Log every round.**隐藏中间轮的辩论系统不能调试或审计.

## 运动

1. 跑步`code/main.py`随着一个轮到一个轮,我们可以看到一个轮到一个轮到一个轮到一个轮到一个轮到一个轮到一个轮到一个轮到一个轮到一个轮到一个轮到一个轮到一个轮到一个轮到一个轮到一个轮到一个轮到一个轮到一个轮到一个轮到一个轮到一个轮到一个轮到一个轮到一个轮到一个轮到一个轮到一个轮到一个轮到一个轮到一个轮到一个轮到一个轮到一个轮到一个轮到一个轮到一个轮到一个轮到一个轮到一个轮到一个轮到一个轮到一个轮到一个轮到一个轮到一个轮到一个轮到一个轮到一个轮到一个轮到一个轮到一个轮到一个轮到一个轮到一个轮到一个轮到一个轮到一个轮到一个轮到一个轮到一个轮到一个轮到一个轮到一个轮到一个轮到一个轮到一个轮到一个轮到一个轮到一个轮到一个轮到?
2. 加入一个具有反抗作用的第四个代理人:总是不同意当前多数.
3. 图 (打印) 协议分数每轮 (多数答案中的代理人分数). 什么时候达到1.0?
4. 通过使用此代码复制"仅用代理"与"仅用轮"对"两者"的结果.
5. 阅读"我们应该疯狂吗?" (arXiv:2311.17371) 并列出除了轮之外的两个辩论变体,例如,由法官领导,辩论链,对抗.

## 关键词

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Society of Mind | "Minsky's idea" | Intelligence as interacting specialists; 1986 framing now operationalized via LLM debate. |
| Multi-agent debate | "Agents argue" | N agents propose, critique each other, revise over R rounds, majority-vote. |
| Consensus | "They agree" | Not epistemic truth — just fraction-on-majority-answer. Can be confidently wrong. |
| Rounds | "Exchange steps" | One round = each agent reads the others and updates once. |
| Heterogeneous debate | "Mix model families" | Using different base models to decorrelate errors. |
| Sycophancy cascade | "Everyone agrees with the loud one" | Debate failure where agents defer to the most confident agent regardless of correctness. |
| NLSOM | "129-agent society" | Natural-language society of mind; Zhuge et al.'s scaled version. |
| Correlated error | "Same model, same bug" | Why self-consistency saturates; debate across different views decorrelates. |

## 进一步阅读

- [Du et al. — Improving Factuality and Reasoning in Language Models through Multiagent Debate](https://arxiv.org/abs/2305.14325)参考文件,ICML 2024
- [Zhuge et al. — Mindstorms in Natural Language-Based Societies of Mind](https://arxiv.org/abs/2305.17066) 129 代理NLSOM
- [Should we be going MAD? A Look at Multi-Agent Debate Strategies for LLMs](https://arxiv.org/abs/2311.17371)基准辩论变体
- [Debate project page](https://composable-models.github.io/llm_debate/)杜等的代码,演示和废除细节
