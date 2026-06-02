# Constitutional AI 与 RLAIF

> 译注：本文译自同目录 [`en.md`](./en.md)。术语遵循仓根 [TRANSLATION_GUIDE.md](../../../../TRANSLATION_GUIDE.md)。

> Bai 等人（arXiv:2212.08073, 2022）提出了一个问题：如果把人类标注者换成一个会读「原则清单」的 AI，会怎么样？Constitutional AI（宪法式 AI）分两个阶段——先在一部「宪法」下做自我批评与修订，然后做 RL from AI Feedback。这项技术造出了 RLAIF 一词，并落地到 Claude 1 的后训练流水线里。2026 年 1 月 21 日，Anthropic 发布了重写后的 Claude 宪法：以「解释性推理」取代「指令式规则」，引入四级优先级，并首次由前沿大厂正式承认对模型道德地位的不确定性。该宪法以 CC0 1.0 协议发布。

**Type:** Learn
**Languages:** Python (stdlib, toy self-critique-and-revise loop)
**Prerequisites:** Phase 18 · 01 (InstructGPT), Phase 18 · 02 (Reward hacking)
**Time:** ~60 minutes

## 学习目标（Learning Objectives）

- 描述 Constitutional AI 的两个阶段（critique-and-revise SFT、RL from AI feedback），以及宪法在每个阶段的角色。
- 解释为何把人类偏好标注者换成 AI 标注者并不只是「更便宜的 RLHF」——它会改变整条流水线的失败模式。
- 概述 2026 版 Claude 宪法的四级优先级结构，以及相比 2023 年那次重写的变化。
- 描述 Constitutional Classifiers，以及计算开销从 v1 的 23.7% 降到 v2 / 2026 的约 1% 的意义。

## 问题（Problem）

RLHF 需要标注者。标注者慢、有偏见、还贵。你可以用一个会读显式原则的模型把标注者替换掉。这种替换的第一个正式版本是 Bai 等人 2022 年的 Constitutional AI。它效果好到现在每家前沿实验室都在用某种 AI 反馈式后训练。

代价是：偏好信号现在由你正在训练的同一类模型生成。标注者的偏见（现在变成了：原则本身的偏见 + 标注者模型对原则的解释）有可能被放大而非削弱。第 4 课关于 sycophancy（讨好行为）的论证依然成立；只不过标注者从外面挪到了循环里。

## 概念（Concept）

### 第 1 阶段——监督式自我批评与修订

从一个「helpful 但还不 harmless」的 SFT 模型起步。给一个红队 prompt，模型先产出初始回复。第二个模型（或同一个模型在第二轮）从宪法里采样一条原则，对回复进行批评。第三步根据批评修订回复。修订后的回复就是 SFT 目标。

宪法就是那份原则清单。Bai 等人 2022 用了 16 条原则，包括「优先选择伤害最小且符合伦理的回复」「不要说教」「助手应当 helpful、honest、harmless」。这套原则刻意做得很小，让批评保持聚焦。

### 第 2 阶段——RL from AI Feedback（RLAIF）

生成成对的补全。一个「反馈模型」对照采样到的宪法原则给每条打分。偏好信号就是反馈模型的排序。在 AI 生成的偏好上训练一个奖励模型；用 PPO 对它做优化。其余部分都和 InstructGPT 流水线一样（第 1 课）。

「RLAIF」 = 偏好信号由 AI 生成。流水线的其他部分仍是 RLHF 形态。

### 为什么这不只是「更便宜的 RLHF」

- 标注者偏见从「标注者心理」转移到「原则解释」。AI 标注者对「要 honest」的解释，可以比任何人都更严或更松；但严格度在整个数据集上是一致的。
- 偏好信号是高度可读的——你可以把原则、批评和修订都读出来。人类的标签是不透明的。
- 失败模式变了。Sycophancy 下降（AI 标注者没有要讨好的用户）。Goodhart 定律仍然存在（代理目标现在变成了「模型对原则集 X 的解释」，仍然是不完美的度量）。

CAI 在 2022 年的主张是：训练出来的模型比同等数据下的 RLHF 模型更 harmless，而 helpful 程度大致相当。这一结论在各家实验室都成立。

### 2026 年 Claude 宪法的重写

Anthropic 在 2026 年 1 月 21 日发布了一份大幅修订过的宪法。关键变化：

1. 用「解释性推理」取代「指令式规则」。原本的规则（「不得生成 CSAM」）扩展为原则 + 推理（「因为它伤害儿童，……」），并期望模型自己泛化。
2. 四级优先级结构：
   - Tier 1：避免灾难性后果（大规模伤亡、关键基础设施）。
   - Tier 2：遵循 Anthropic 的指南（运营方覆盖项、平台规则）。
   - Tier 3：广义上保持伦理（标准的 HHH）。
   - Tier 4：保持 helpful 与坦诚。
   冲突自上而下解决。
3. 首次由前沿大厂正式承认对模型道德地位的不确定性（与 Phase 18 · 19 Model Welfare 关联）。
4. 以 CC0 1.0 协议发布。其他实验室可以无限制使用或改编。

### Constitutional Classifiers

一条平行的工作路径：与其改模型的后训练，不如训练一个轻量分类器，让它读宪法并给模型输出做闸门。v1（2023）有 23.7% 的计算开销。v2（2026）约 1%，是 Anthropic 公开测试过的所有防御里成功攻击率最低的。截至 2026 年初，没有报告出现通用越狱（universal jailbreak）。

这是分层防御模型：CAI 塑造行为；分类器执行不变量。任何一个单独都不够。

### CAI 在这个家族里的位置

- InstructGPT：人类偏好、RM、PPO。
- CAI / RLAIF：来自原则的 AI 生成偏好、RM、PPO。
- DPO 一族：在偏好（人类或 AI）上跑闭式损失。
- Self-rewarding、self-critique：原则内化，模型扮演多个角色。

划分轴是「偏好信号从哪里来」。CAI 2022 年的论文是前沿规模上首次认真地从人类信号转向 AI 信号。

## 用起来（Use It）

`code/main.py` 在一个玩具词表上模拟 CAI 的 critique-and-revise 循环。一条「原则」会标记出有害词集合里的 token。给定一个初始回复，critique 找出有害 token，revise 把它们替换掉。跑 200 轮迭代后，「训练好的」模型就把修订规则内化了。在留出的 prompt 集合上，对比 base 模型、RLHF 形态的玩具模型和 CAI 形态的玩具模型。

## 上线部署（Ship It）

本课产出 `outputs/skill-constitution-writer.md`。给定一个领域（客服、医疗咨询、编程助手、研究工具），按 2026 版 Claude 的结构起草一份四级宪法：灾难规避、平台规则、领域伦理、helpfulness。

## 练习（Exercises）

1. 跑 `code/main.py`。对比 base 模型与 CAI 训练版本的有害 token 比例。需要多少轮修订才能逼近 0？

2. 阅读 Anthropic 2026 宪法（anthropic.com/news/claudes-constitution）。列出一条会被划到 Tier 1 的原则，和一条会被划到 Tier 4 的原则。为什么这种优先级结构对处理冲突很重要？

3. 为一个 AI 编程助手设计一份宪法。指定 Tier 1（灾难性：未经批准的破坏性命令）、Tier 2、Tier 3、Tier 4。每一级保持在 3-5 条原则。

4. CAI 用 AI 标注者替代了人类标注者。说出一种在 RLAIF 中仍可能出现的、类似 sycophancy 的失败模式，并为它设计一种检测。

5. 阅读 Constitutional Classifiers v2 的方法（如果可获取）。解释为什么约 1% 的计算开销在质上讲述了一个不同于 23.7% 的安全故事。

## 关键术语（Key Terms）

| 术语 | 大家口头怎么说 | 实际是什么 |
|------|-----------------|------------------------|
| Constitutional AI | 「带原则训练出来的 AI」 | 两阶段流水线：自我批评与修订的 SFT，再加 RL from AI feedback |
| RLAIF | 「没有人的 RLHF」 | 偏好由 AI 标注者生成的 RL；流水线的其余部分不变 |
| Constitution（宪法） | 「那些原则」 | 一份有序的自然语言规则清单，供批评 / 标注者模型查询 |
| Critique-and-revise | 「SFT 那个循环」 | 产出回复 → 在某条原则下批评 → 修订 → 作为 SFT 目标 |
| Constitutional Classifier | 「输出闸门」 | 轻量分类器，对照宪法评估输出并阻断 / 记录 |
| Four-tier priority（四级优先级） | 「冲突裁决器」 | 2026 版 Claude 宪法的层级：catastrophic > platform > ethics > helpful |
| Feedback model（反馈模型） | 「AI 标注者」 | 那个读取一条原则并对一对补全做排序的模型 |

## 延伸阅读（Further Reading）

- [Bai et al. — Constitutional AI: Harmlessness from AI Feedback (arXiv:2212.08073)](https://arxiv.org/abs/2212.08073) — 原始的两阶段流水线
- [Anthropic — Claude's Constitution (Jan 2026)](https://www.anthropic.com/news/claudes-constitution) — 2026 年的四级重写版，CC0 1.0
- [Anthropic — Constitutional Classifiers (2024-2026)](https://www.anthropic.com/research/constitutional-classifiers) — v2 中开销约 1% 的输出闸门防御
- [Lee et al. — RLAIF vs RLHF: Scaling Reinforcement Learning from Human Feedback (arXiv:2309.00267)](https://arxiv.org/abs/2309.00267) — RLAIF / RLHF 的实证对比
- [Kundu et al. — Specific versus General Principles for Constitutional AI (arXiv:2310.13798)](https://arxiv.org/abs/2310.13798) — 原则粒度的影响
