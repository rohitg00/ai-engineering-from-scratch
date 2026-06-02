# 心智社会与多 agent 辩论（Society of Mind and Multi-Agent Debate）

> 译注：本文译自同目录 [`en.md`](./en.md)。术语遵循仓根 [TRANSLATION_GUIDE.md](../../../../TRANSLATION_GUIDE.md)。

> Minsky 1986 年的命题——智能是一群专家组成的社会——每隔十年就会被重新发现一次。2023 年 Du 等人把它落成了一个具体的算法：让多个 LLM 实例各自给出答案，互相阅读、互相批评、互相更新。经过 N 轮，它们收敛到一个共识，在六项推理与事实性任务上击败了 zero-shot CoT 和 reflection（反思）。两个发现值得记住：**多 agent** 和 **多轮** 这两件事各自独立都有贡献。社会式的协作打败了单 agent 的独白；多轮交换打败了一次性投票。

**Type:** Learn + Build
**Languages:** Python (stdlib)
**Prerequisites:** Phase 16 · 04 (Primitive Model)
**Time:** ~60 minutes

## 问题（Problem）

Self-consistency（自一致性）——同一个模型多次采样然后取多数答案——是你能挂上去的最便宜的推理增强手段。它有效，但很快就会饱和。你把采样数翻一倍，未必能再看到一次有意义的提升。

辩论打破了这种饱和。不再是同一模型的 N 次独立采样，而是 N 个 agent 互相阅读对方的推理过程并修订自己。样本之间的相关性下降了（它们不再是 i.i.d. 独立同分布），而收敛点经常恰好落在正确答案上——这正是 i.i.d. 投票自信地犯错的地方。

## 概念（Concept）

### Du 等人 2023 年提出的算法（The Du et al. 2023 algorithm）

来自 arXiv:2305.14325（ICML 2024）：

1. N 个 agent 各自对问题给出一个初始答案。
2. 对第 r = 2..R 轮：把其他 agent 在第 r-1 轮的答案展示给每个 agent，要它「考虑这些之后，给出你的更新答案」。
3. R 轮过后，对最终答案做多数投票。

论文在 MMLU、GSM8K、人物传记、MATH 以及若干事实性基准上做了测试。辩论稳定地胜过 CoT 和 Self-Reflection（自反思）。

### 两个独立的旋钮（Two independent knobs）

同一篇论文里的消融实验（ablation，逐项关掉变量看效果）：

- **只增加 agent 数**（1 轮，N 个 agent 多数投票）在大多数任务上胜过单 agent，但很快遇到瓶颈。
- **只增加轮数**（1 个 agent 反复看自己之前的推理）几乎没有帮助——这正是 reflection 已知的弱点。
- **两者一起用**才能拉出大幅度的提升。多 agent 之间的多轮交换才是收益的来源。

### 它为什么有效（Why it works）

两个机制：

1. **接触到不同意见。** 当一个 agent 看到另一个 agent 给出了不同结论的推理链，它要么得为自己辩护，要么得更新。无论哪种，第 r+1 轮的上下文都比第 r 轮更丰富。
2. **降低相关错误。** 在 self-consistency 里，所有样本来自同一模型，错误是相关的——你会平均到一个自信但错误的答案。换不同模型或不同随机种子可以去相关，换 *不同的辩论观点* 可以更进一步去相关。

### 异质辩论（Heterogeneous debate）

A-HMAD 以及相关后续工作给不同 agent 用 *不同的底座模型*。Llama + Claude + GPT 一起辩论可以减少 monoculture（单一文化）坍缩（参见第 26 课），因为同一模型家族的相关错误并不会被另外的家族共享。

代价：一个弱模型参与辩论会把共识拖向它的错误答案（见 "Should we be going MAD?", arXiv:2311.17371）。

### NLSOM——129 个 agent 的扩展（NLSOM — the 129-agent extension）

Zhuge 等人（《Mindstorms in Natural Language-Based Societies of Mind》, arXiv:2305.17066）把这个想法扩展到了 129 人规模的社会。结果是：随规模扩大，专业化和自组织自然涌现，系统在视觉问答这类任务上胜过单 agent。

### 失败模式（Failure modes）

- **谄媚级联（Sycophancy cascade）。** 所有 agent 都向听上去最自信的那个 agent 让步。辩论坍缩为最大嗓门的独白。给 agent 安排对抗性角色（「这个 agent 必须为反方辩护」）可以缓解。
- **主题漂移（Topic drift）。** 多轮辩论会从原始问题上漂走。缓解方法：每轮重新注入问题。
- **算力爆炸（Compute blowup）。** N 个 agent × R 轮 = N·R 次 LLM 调用，每次的上下文还在增长。5 agent、5 轮的辩论就是 25 次调用、上下文不断膨胀。单道题的成本可能超过单次 CoT 调用的 10 倍。

## 动手实现（Build It）

`code/main.py` 在一道数学题上跑了 3 agent × 3 轮的辩论，每个 agent 起步时各自带着不同（可能错误）的答案。这些 agent 是脚本化的——每次「更新」就是按脚本里写好的置信度，对邻居的答案做加权平均。逐轮日志里能直接看到收敛过程。

这个 demo 展示了两个关键效应：

- 单单一轮交换就能让 agent 更接近正确答案。
- 第 2 轮之后再多加几轮就开始看到收益递减（与 Du 等人观察到的 plateau 一致）。

运行：

```
python3 code/main.py
```

## 用起来（Use It）

`outputs/skill-debate-configurator.md` 用来为新任务配置一场辩论：agent 数、轮数、异质性（同模型 vs 混合）、角色分配（对称 vs 一名对抗者）。它还会在你跑之前估算 token 成本。

## 上线部署（Ship It）

如果你要把辩论上线：

- **轮数封顶 3 轮。** Du 等人显示 3 轮就能拿到大部分收益。再多就是成本，不是质量。
- **agent 数封顶 5 个。** 超过 5，上下文膨胀和成本就开始压过收益。
- **默认异质。** 池子里至少放两个不同的底座模型。
- **留一个对抗位。** 一个 agent 被 prompt 成无论如何都要唱反调，用来打破谄媚。
- **每轮都记录日志。** 隐藏中间轮次的辩论系统既无法调试，也无法审计。

## 练习（Exercises）

1. 跑一遍 `code/main.py`，然后把轮数改成 5，观察收益递减。从第几轮开始，再加额外轮数也不会进一步收敛？
2. 加入第 4 个 agent，给它对抗性角色：永远不同意当前的多数派。这样做是破坏了收敛，还是改善了收敛？
3. 把每轮的「一致度」打印出来（站在多数答案一方的 agent 比例）。它什么时候达到 1.0？1.0 是否等价于「正确」？
4. 读 Du 等人论文的 Section 4 消融实验。用本课代码复现「只加 agent」vs「只加轮数」vs「两者都加」三组结果。
5. 读 "Should we be going MAD?"（arXiv:2311.17371），列出 round-robin 之外的两种辩论变体——例如 judge-led（裁判主导）、chain-of-debate（辩论链）、adversarial（对抗式）。

## 关键术语（Key Terms）

| 术语 | 大家嘴上怎么说 | 它实际指什么 |
|------|----------------|------------------------|
| Society of Mind（心智社会） | 「Minsky 那个想法」 | 把智能视为彼此交互的专家集合；1986 年的提法如今通过 LLM 辩论被落地。 |
| Multi-agent debate（多 agent 辩论） | 「agent 互相吵」 | N 个 agent 给出答案、互相批评、经过 R 轮修订，再多数投票。 |
| Consensus（共识） | 「它们达成一致」 | 不是认识论意义上的真理——只是站在多数答案一方的比例。可能是自信地错。 |
| Rounds（轮） | 「交换步」 | 一轮 = 每个 agent 读一遍其他人的答案，并更新一次。 |
| Heterogeneous debate（异质辩论） | 「混搭模型家族」 | 用不同底座模型来对错误去相关。 |
| Sycophancy cascade（谄媚级联） | 「大家都同意嗓门最大的那个」 | 辩论的失败模式：agent 不论对错都让步给最自信的 agent。 |
| NLSOM | 「129 agent 的社会」 | 基于自然语言的心智社会；Zhuge 等人的放大版本。 |
| Correlated error（相关错误） | 「同模型同 bug」 | self-consistency 饱和的根因；跨不同观点辩论可以去相关。 |

## 延伸阅读（Further Reading）

- [Du et al. — Improving Factuality and Reasoning in Language Models through Multiagent Debate](https://arxiv.org/abs/2305.14325) — 参考论文，ICML 2024
- [Zhuge et al. — Mindstorms in Natural Language-Based Societies of Mind](https://arxiv.org/abs/2305.17066) — 129 agent 的 NLSOM
- [Should we be going MAD? A Look at Multi-Agent Debate Strategies for LLMs](https://arxiv.org/abs/2311.17371) — 各类辩论变体的基准对比
- [Debate project page](https://composable-models.github.io/llm_debate/) — Du 等人的代码、demo 与消融细节
