# LLM 中的偏见与表征性伤害（Bias and Representational Harm in LLMs）

> 译注：本文译自同目录 [`en.md`](./en.md)。术语遵循仓根 [TRANSLATION_GUIDE.md](../../../../TRANSLATION_GUIDE.md)。

> Gallegos, Rossi, Barrow, Tanjim, Kim, Dernoncourt, Yu, Zhang, Ahmed（Computational Linguistics 2024，arXiv:2309.00770）。这是 2024 年的奠基性综述，区分了表征性伤害（representational harm，刻板印象、抹除）与配置性伤害（allocational harm，资源分配不均），并把评估指标分为基于 embedding、基于概率、基于生成文本三类。2024–2025 经验研究：An 等人（PNAS Nexus，2025 年 3 月）在 GPT-3.5 Turbo、GPT-4o、Gemini 1.5 Flash、Claude 3.5 Sonnet、Llama 3-70B 上，针对 20 个入门级岗位的自动化简历评估，测量了性别 × 种族的交叉性偏见。WinoIdentity（COLM 2025，arXiv:2508.07111）为交叉性身份引入了基于不确定性的公平性评估。Yu & Ananiadou 2025 在 MLP 层中识别出「性别神经元」；Ahsan & Wallace 2025 用 SAE 揭示临床种族偏见；Zhou 等人 2024（UniBias）通过操控 attention head 实现去偏。元批评（arXiv:2508.11067）：过去十年的文献过度集中在二元性别偏见上。

**Type:** Build
**Languages:** Python（标准库，玩具级 embedding 偏见探针）
**Prerequisites:** Phase 05（word embeddings）、Phase 18 · 01（指令跟随）
**Time:** ~60 minutes

## 学习目标（Learning Objectives）

- 定义表征性伤害与配置性伤害，并各举一个 LLM 部署中的例子。
- 说出 Gallegos 等人 2024 提出的三类评估指标，并描述每类中的一个具体指标。
- 解释什么是交叉性（intersectionality），以及 WinoIdentity 基于不确定性的公平性度量为何能弥补单轴偏见评估的不足。
- 描述两种针对偏见的机制可解释性（mechanistic interpretability）方法（性别神经元、SAE 特征、attention head 操控）。

## 问题（The Problem）

之前的课程讲的是有意为之的伤害（越狱、阴谋）和安全治理。偏见则是一种没有恶意也会出现的伤害——它源自训练数据分布、prompt 措辞、以及一连串积累下来的设计选择。度量并降低偏见，与对抗鲁棒性是完全不同的方法论挑战。

## 概念（The Concept）

### 表征性 vs 配置性（Representational vs allocational）

- **表征性伤害（Representational harm）。** 刻板印象、抹除、贬损式描绘。一个把护士全部刻画成女性的 LLM，就是在制造表征性伤害。
- **配置性伤害（Allocational harm）。** 物质结果分配不均。一个系统性地给黑人申请者简历打更低分的 LLM，就是在制造配置性伤害。

这两者并不等价。一个模型可以「表征上无偏」（描绘多样化）却「配置上有偏」（推荐结果不公平）。评估必须同时覆盖这两面。

### 三类评估指标（Three evaluation-metric categories，Gallegos et al. 2024）

- **基于 embedding。** 在 RLHF 之前的 embedding 上做 WEAT 风格测试。度量身份词项与属性词项之间的统计关联。局限：它度量的是表征本身，而不是行为。
- **基于概率。** 比较「印证刻板印象」与「违反刻板印象」补全的对数似然。属于 decoder 侧度量，能捕捉一部分行为偏见。
- **基于生成文本。** 在生成文本上做下游任务度量。简历评分、推荐信写作、对话。生态有效性最高；也最难复现。

### 交叉性（Intersectionality）

只在「性别」维度上做偏见评估，会漏掉那些只在 (性别，种族) 这种组合上才发作的偏见。An 等人 2025 发现 GPT-4o 在简历评分中对黑人女性的惩罚，比对黑人男性、对白人女性的惩罚（分别看时）都要重。单轴评估无法捕捉这种现象。

WinoIdentity（COLM 2025）引入了基于不确定性的交叉性公平性。它度量的是模型在不同交叉性身份元组上的「结果不确定性」是否有差异——而不只是点预测的差异。这能捕捉到这样一种情况：模型在不同群体上的错误率相同，但对某些群体更不确定，从而在下游分配行为上出现差异。

### 机制方法（Mechanistic approaches）

2024–2025 的可解释性研究把偏见打开到了机制层面，可以做干预：

- **性别神经元（Yu & Ananiadou 2025）。** 特定的 MLP 神经元与性别相关的行为相关联。消融（ablate）这些神经元能在能力代价有限的情况下降低性别差距指标。
- **基于 SAE 的临床种族偏见（Ahsan & Wallace 2025）。** Sparse autoencoder（稀疏自编码器，SAE）特征把内部表征分解为可解释的维度；可以识别出与种族相关的特征并将其抑制。
- **UniBias（Zhou 等人 2024）。** 通过操控 attention head 实现 zero-shot 去偏。某些特定的 head 会放大对身份类别的敏感度；把这些 head 置零或重新加权，无需 fine-tune 就能降低偏见。

### 元批评（The meta-critique）

10 年文献综述（arXiv:2508.11067，2025）发现，整个领域过度集中在二元性别偏见上。其他维度——残障、宗教、移民身份、多语种身份——得到的关注远远不够。这篇元批评指出，过窄的关注本身就会通过「忽视」伤害到边缘群体：一个在二元性别维度上去偏得很干净的模型，在没人检查过的维度上可能偏得很离谱。

### 这节课在 Phase 18 中的位置

第 20–21 课正式讲偏见与公平。第 22 课讲隐私。第 23 课讲水印。这些是面向用户伤害的一层，与前面讨论的欺骗 / 安全层相辅相成。

## 用起来（Use It）

`code/main.py` 构建了一个玩具级的、基于 embedding 的偏见探针：在一个简单的共现 embedding 上，测量身份词项与属性词项之间 WEAT 风格的距离。你可以人为注入一个偏见、观察指标被触发；再施加一个简单的去偏操作、观察部分恢复的过程。

## 上线部署（Ship It）

本课产出 `outputs/skill-bias-eval.md`。给定一份 model card 或公平性声明，它会从三类指标（embedding、概率、生成文本）的覆盖、交叉性覆盖、以及任何去偏干预的机制三个维度，对其评估做一次审查。

## 练习（Exercises）

1. 运行 `code/main.py`。报告去偏步骤前后的 WEAT 风格偏见分数。解释为什么指标不会降到零。

2. 扩展该探针，加入一个交叉性测试：(性别，种族) × (事业，家庭)。报告跨轴的偏见分数。

3. 阅读 An 等人 2025（PNAS Nexus）。指出他们报告的两个交叉性效应——这两个效应在单轴的性别评估中会被漏掉。

4. Yu & Ananiadou 2025 识别出了性别神经元。设计一个证伪（falsification）实验，把「这些神经元导致性别偏见」与「这些神经元只是与性别偏见相关」区分开来。

5. 元批评认为该领域过窄地集中在二元性别上。挑选一个研究不足的维度，为它描述一套表征性伤害的度量方案。

## 关键术语（Key Terms）

| 术语 | 大家通常这么说 | 实际含义 |
|------|-----------------|------------------------|
| 表征性伤害（Representational harm） | 「刻板印象 / 抹除」 | 对某个群体的有偏描绘 |
| 配置性伤害（Allocational harm） | 「不公平的决策」 | 对某个群体造成不公平的物质结果 |
| WEAT | 「embedding 测试」 | Word Embedding Association Test；基于共现的偏见探针 |
| 交叉性（Intersectionality） | 「身份组合效应」 | 在多个身份维度交叉处才出现的偏见 |
| 性别神经元（Gender neurons） | 「MLP 偏见神经元」 | 激活与性别相关行为相关联的特定神经元 |
| SAE 特征（SAE feature） | 「可解释的维度」 | 由 sparse autoencoder 识别出的特征；用于机制层面的偏见分析 |
| UniBias | 「attention head 去偏」 | 通过对 attention head 重新加权实现 zero-shot 去偏 |

## 延伸阅读（Further Reading）

- [Gallegos et al. — Bias and Fairness in LLMs: A Survey (arXiv:2309.00770, Computational Linguistics 2024)](https://arxiv.org/abs/2309.00770) — 经典综述
- [An et al. — Intersectional resume-evaluation bias (PNAS Nexus, March 2025)](https://academic.oup.com/pnasnexus/article/4/3/pgaf089/8111343) — 五模型交叉性研究
- [WinoIdentity — uncertainty-based intersectional fairness (arXiv:2508.07111, COLM 2025)](https://arxiv.org/abs/2508.07111) — 新基准
- [UniBias — attention-head manipulation (Zhou et al. 2024, ACL)](https://arxiv.org/abs/2405.20612) — zero-shot 去偏
