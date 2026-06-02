# STaR、V-STaR、Quiet-STaR — 自学推理（Self-Taught Reasoning）

> 译注：本文译自同目录 [`en.md`](./en.md)。术语遵循仓根 [TRANSLATION_GUIDE.md](../../../../TRANSLATION_GUIDE.md)。

> 最小可行的自我改进循环就藏在 rationale（推理过程）里：模型生成一段思维链（chain of thought），把那些恰好得到正确答案的留下来，再 fine-tune（微调）回去。这就是 STaR。V-STaR 加了一个 verifier（验证器），让推理期的挑选更靠谱。Quiet-STaR 把 rationale 下沉到每一个 token。三者都有效。但都不是魔法 —— 这种循环会保留任何「碰巧得到正确答案」的捷径。

**Type:** Learn
**Languages:** Python (stdlib, bootstrap-loop simulator)
**Prerequisites:** Phase 13 · 01-03 (Reasoning and CoT), Phase 15 · 01 (long-horizon framing)
**Time:** ~60 minutes

## 问题（The Problem）

教模型推理最直接的办法是收集人写的推理轨迹。但这又贵、又慢，而且总量受限于「愿意写高质量 chain-of-thought 的人」有多少。

STaR（Self-Taught Reasoner，Zelikman et al., 2022）问了一个问题：如果让模型自己写 rationale，再用已知答案给它打分，会怎样？循环是这样的：

1. 采样一段推理轨迹加上答案。
2. 如果最终答案正确，就保留这条轨迹。
3. 在保留下来的轨迹上 fine-tune。
4. 重复。

这套有效。GSM8K 和 CommonsenseQA 都在没有新人工标注的情况下涨了点。但循环本身有内建偏差：只要 rationale 给出了正确答案就会被留下，**不管推理过程本身是否成立**。V-STaR（Hosseini et al., 2024）用一个学出来的 verifier 来打补丁；Quiet-STaR（Zelikman et al., 2024）则把这个思路推广到了每个 token 的内部 rationale。

## 概念（The Concept）

### STaR：在「奏效的样本」上 bootstrap

从一个有微弱推理能力的 base model 出发。对每道训练题采样一段 rationale 加答案。如果答案匹配标签，就把 (problem, rationale, answer) 三元组留下来。在保留集上 fine-tune。重复。

这里有一个关键变体。如果模型从来都做不对某道题，循环就在这道题上学不到东西。STaR 加入了 **rationalization（合理化）**：对那些模型做错的题，把正确答案当作提示注入，再让模型反过来生成一段能导向这个答案的 rationale。这种「合理化」rationale 也会加入训练集。

原论文（Zelikman et al., 2022）的结果：一个 GPT-J base model 通过反复多轮 STaR + rationalization，在 GSM8K 上从 5.8% 提升到 10.7% —— 绝对值约 5 个百分点。在 CommonsenseQA 上，STaR 训练的 GPT-J 6B 达到了 72.5%，与 fine-tune 过的 GPT-3 175B（约 73%）相当 —— 而后者是一个大约 30 倍体量、用人工标注 rationale 训出来的模型。

### V-STaR：用 DPO 训一个 verifier

STaR 把错误的 rationale 全扔了。Hosseini et al. (2024) 注意到：那些其实也是数据 —— 每一对 (rationale, "这条对不对") 都能用来训 verifier。他们用 Direct Preference Optimization（DPO）在正确和错误两类样本上训出一个 ranker。推理时采样 N 条 rationale，挑 verifier 评分最高的那条。

报告的提升：相对此前的自我改进 baseline，在 GSM8K 和 MATH 上提升 +4 到 +17 个百分点，且大部分增益来自「用 verifier 做推理期挑选」，而不是「再多 fine-tune 一遍生成器」。

### Quiet-STaR：逐 token 的内部 rationale

Zelikman et al. (2024) 问：如果模型学会在**每个 token 位置**都生成一小段内部 rationale，而不只是在「问题与答案之间」，会怎样？Quiet-STaR 训练模型在每个待预测的 token 之前先发出一段隐藏的「thought」，然后通过一个学出来的权重把「考虑过 thought 的预测」与「baseline 预测」混合。

结果：Mistral 7B 在没有任务专属 fine-tune 的情况下，GSM8K 零样本（zero-shot）从 5.9% 提升到 10.9%，CommonsenseQA 从 36.3% 提升到 47.2%。模型学会了「什么时候该思考」—— 难的 token 会有更长的内部 rationale；简单的几乎没有。

### 为什么这三者都有同一个安全隐患

三种方法都把**最终答案**当成梯度信号。一段通过有缺陷的推理（走捷径、瞎猜、用一个不能泛化的模式）凑出正确答案的 rationale 会被正向强化。在分布内（in-distribution）问题上，这条捷径还能用；到了分布外（out-of-distribution）问题，它就会悄无声息地崩掉。

V-STaR 的 verifier 通过学着给 rationale 排序来缓解，但 verifier 本身就是在同一套标签上训的。它可能学会偏好「格式漂亮但推理错误」的内容，而不是「诚实承认不确定」。更安全的设计是把 STaR 风格的数据与以下两点结合：(a) process-supervised reward model（过程监督奖励模型，奖励中间步骤而不只是答案）；(b) 留出一个能打破简单捷径的 OOD 评估集。

### 对比

| Method | 训练信号 | 推理成本 | 数据浪费 | 已知失败模式 |
|---|---|---|---|---|
| STaR | 答案正确则保留 (rationale, answer) | 1x | 丢弃所有错误 rationale | 走捷径的 rationale |
| STaR + rationalization | 上述 + 用正确答案做提示重试 | 1x | 较少 | 合理化出来的 rationale 可能不靠谱 |
| V-STaR | STaR + 用两类样本训 DPO verifier | Nx（best-of-N） | 极少 | verifier 可能强化「自信地错」 |
| Quiet-STaR | 逐 token rationale + 混合权重 | 1.5-3x | 极少 | 仍然是答案条件下的梯度 |

### 它在 2026 技术栈里的位置

STaR 已经不年轻了。但这个模式在 2025–2026 到处出现。在可验证的数学题上做 RL（DeepSeek-R1、Kimi-k1.5、o1）就是 STaR 的「答案条件梯度信号」放大版。Process reward model（Lightman et al., 2023；OpenAI 的「Let's verify step by step」）是过程监督这条替代路线。AlphaEvolve（第 3 课）是给代码用的 STaR，把标签换成了一个程序评估器。Darwin Godel Machine（第 4 课）是给 agent scaffolding 本身用的 STaR。

理解了 STaR，这一切都会一通百通。它就是最小可用的自我改进循环。

## 用起来（Use It）

`code/main.py` 在一个玩具算术任务上运行一个模拟的 STaR 循环。你可以观察到：

- 准确率如何随着 bootstrap 轮数攀升。
- 捷径如何悄悄混进来：模拟器内置了一类「lazy」rationale，它有 40% 概率给出正确答案，但泛化很差。看看 STaR 会不会留下它们。
- verifier（V-STaR 风格）如何在推理期帮上忙，但又**没法**完全剪掉训练期就被引入的捷径。

## 上线部署（Ship It）

`outputs/skill-star-loop-reviewer.md` 帮你在真正去训之前，对一条「自学推理」流水线做一次审计。

## 练习（Exercises）

1. 跑一遍模拟器。先把捷径出现频率设为 0，再设为 0.4。即使两次在训练分布上都打到 >90%，最终准确率会差多少？

2. 给模拟器加一个留出（held-out）OOD 测试。从一个不同的分布抽题，对 bootstrap 出来的模型同时在分布内和 OOD 集上评估。把差距量化出来。

3. 读 Quiet-STaR 论文（arXiv:2403.09629）第 3 节。各用三句话解释「end-of-thought」token 和混合权重头（mixing-weight head）。

4. 把 STaR 的「答对就保留」过滤器，跟一种「对每个 rationale 步骤独立给奖励」的过程监督替代方案做对比。指出标注成本的差异，以及质量上可能的差异。

5. 设计一个评估，能在已部署的模型上抓出走捷径的 rationale。它不必完美 —— 只要能打破 STaR 循环最容易强化的那种最简单的捷径就行。

## 关键术语（Key Terms）

| Term | 大家怎么说 | 实际含义 |
|---|---|---|
| STaR | "Self-Taught Reasoner" | 在模型自己生成、且答案正确的 rationale 上 fine-tune；反复迭代 |
| Rationalization | "提示重试" | 把正确答案注入提示，让 base model 失败的题反过来生成 rationale |
| V-STaR | "Verifier STaR" | 用 DPO 在正确和错误 rationale 上训一个 verifier，用于推理期挑选 |
| Quiet-STaR | "逐 token rationale" | 在每个 token 位置生成隐藏 thought，与 baseline 预测混合 |
| Answer-conditioned gradient | "结果导向信号" | 训练循环只奖励最终答案，不管推理步骤 |
| Process reward model | "步骤级 verifier" | 在每一步对错上训出来的奖励模型，与 STaR 形成对照 |
| Shortcut rationale | "答对了，但理由错了" | 通过不能泛化的模式凑到标签的 rationale；STaR 会把它们留下 |

## 延伸阅读（Further Reading）

- [Zelikman et al. (2022). STaR: Bootstrapping Reasoning With Reasoning](https://arxiv.org/abs/2203.14465) —— 原始论文。
- [Hosseini et al. (2024). V-STaR: Training Verifiers for Self-Taught Reasoners](https://arxiv.org/abs/2402.06457) —— 加了一个 DPO verifier 用于推理期挑选。
- [Zelikman et al. (2024). Quiet-STaR: Language Models Can Teach Themselves to Think Before Speaking](https://arxiv.org/abs/2403.09629) —— 逐 token 的内部 rationale。
- [Lightman et al. (2023). Let's Verify Step by Step](https://arxiv.org/abs/2305.20050) —— process reward model，另一种梯度信号。
- [DeepSeek-R1 paper (arXiv:2501.12948)](https://arxiv.org/abs/2501.12948) —— 在可验证任务上做 RL，把 STaR 放大到前沿训练规模。
