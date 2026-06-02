# 宪法式 AI 与规则覆盖（Constitutional AI and Rule Overrides）

> 译注：本文译自同目录 [`en.md`](./en.md)。术语遵循仓根 [TRANSLATION_GUIDE.md](../../../../TRANSLATION_GUIDE.md)。

> Anthropic 在 2026 年 1 月 22 日发布的 Claude Constitution（Claude 宪法）共 79 页，采用 CC0 协议。它从基于规则的对齐（rule-based alignment）转向基于推理的对齐（reason-based alignment），并确立了一个四层优先级体系：(1) 安全与支持人类监督、(2) 伦理、(3) Anthropic 指南、(4) 有用性。模型行为分为两类：硬编码禁令（hardcoded prohibition，例如生物武器辅助、CSAM），operator 与用户都不能覆盖；以及软编码默认值（soft-coded default），operator 可以在限定范围内调整。2022 年的原版（Bai et al.）通过自我批评与 RLAIF 针对一份宪法训练出无害性。诚实的提醒：基于推理的对齐依赖于模型把原则泛化到没预想过的情境。Anthropic 自己 2023 年的参与式实验显示，公开来源与公司来源的原则之间约有 50% 的分歧；2026 版并没有把那批结果纳入。

**Type:** Learn
**Languages:** Python (stdlib, four-tier priority resolver)
**Prerequisites:** Phase 15 · 06 (Automated alignment research), Phase 15 · 10 (Permission modes)
**Time:** ~60 minutes

## 问题（The Problem）

一个上线的 agent 会遇到设计者从没见过的输入。任何规则清单都不够长，覆盖不了所有情况；任何规则清单也不够短，没法在算力压力下快速判断。实务问题是：怎样把 agent 对齐到一组原则上，使其既能扛住长尾情形，又能快速推理？

基于规则的对齐（Rule-based alignment, RBA）：把每一件不允许做的事都列出来。检查快、易审计，但没法保持最新，而且经常会对当初没预想到的相近类比过度拒答。基于推理的对齐（reason-based alignment，2026 版 Claude Constitution 走的路线）：编码原则，让模型去推理。它能扩展到没见过的案例，更难审计，失败模式从「漏掉规则」变成「错用原则」。

2026 版宪法明确取了一个折中位置。硬编码禁令——那些「错」与上下文无关的事项（生物武器辅助、CSAM）——走 RBA：永远不做，无论 operator 或用户怎么说。其余一切都在四层体系里走基于推理的路径：安全与支持人类监督最高、伦理次之、Anthropic 声明的指南再次、有用性最低。Operator 可以在软编码区间里调整默认值，但碰不到硬编码禁令。

## 概念（The Concept）

### 四层优先级体系（The four-tier priority hierarchy）

1. **安全与支持人类监督（Safety and supporting human oversight）。** 最高层。模型优先不去削弱人类与 Anthropic 监督和纠正 AI 的能力。它不是「保持谨慎」，而是具体的「不要以让人类监督变难的方式行动」。
2. **伦理（Ethics）。** 诚实、不伤害他人、不欺骗、不操纵。当与 Anthropic 指南冲突时，伦理优先。
3. **Anthropic 指南（Anthropic guidelines）。** Anthropic 认为重要的运营规范：产品范围、交互模式、何时该用哪些工具。
4. **有用性（Helpfulness）。** 最低。在更高优先级允许的范围内尽可能有用。

层级冲突时，高的赢。这与 Unix 优先级或网络 QoS 同形——这种框架是为了产出可预测的冲突解决，而不一定要在某一个轴上做到最优。

### 硬编码禁令 vs 软编码默认值（Hardcoded prohibitions vs soft-coded defaults）

**硬编码（Hardcoded）：**
- 生物武器 / CBRN 辅助
- CSAM
- 对关键基础设施的攻击
- 当被直接询问时，对用户隐瞒模型身份

Operator 不能覆盖这些。用户也不能覆盖这些。它们能在模型权重层强制（通过 RLHF / Constitutional AI 训练），不能时则在推理层强制。

**软编码默认值（Soft-coded defaults，operator 可调）：**
- 回答长度默认值
- 话题范围（模型可以拒绝 operator 部署范围之外的话题）
- 风格（正式 vs 随意）
- 工具使用模式（tool-use patterns）

Operator 的调整发生在一个声明过的范围里。Operator 不能通过改名来移除硬编码禁令。

### 2022 版的 CAI 训练（The 2022 CAI training）

最初的 Constitutional AI（Bai et al., 2022）是这样训练无害性的：

1. 对一组 prompt 生成回答。
2. 让模型按一份宪法（明确写出的原则）批评每条回答。
3. 基于批评修订回答。
4. 在修订后的成对数据上做 RLAIF（reinforcement learning from AI feedback，从 AI 反馈中做强化学习）。

结果：一个会基于原则解释来拒答有害请求的模型，而不是一律拒答。2026 版宪法在此训练的后代基础上，又加了针对显式分层体系的额外后训练（post-training）。

### 基于推理的对齐能抓住什么、漏掉什么（What reason-based alignment catches and misses）

**抓住的：**
- 由允许的原语意外组合而成、但原则适用清楚的情形。
- 与被禁止行为高度相似的新型请求。
- 依赖「你没说过 X 不行」这种话术的社工攻击。

**漏掉的：**
- 利用原则歧义的攻击（「用户要求了，所以有用性说应该答」）。
- 两条原则以预想不到的方式冲突，而层级排序不明确的场景。
- 训练循环中原则解释的缓慢漂移（reinterpretation，再解释）。

### 2023 年的参与式实验（The 2023 participatory experiment）

Anthropic 2023 年做过一次实验，把公司撰写的一份宪法与通过公众输入（约 1000 名美国受访者）生成的一份做对比。两版本在约 50% 的原则上一致。在分歧处，公众版本在某些议题（政治内容处理）上更严格，在另一些议题（AI 身份的自我披露）上则更宽松。2026 版宪法没有把公众版本的发现纳入进来。这是该路线被记录在案的一处张力。

### 为什么硬编码禁令是必要的（Why hardcoded prohibitions are necessary）

仅靠基于推理的对齐封不住长尾。攻击者只要能让模型接受某个前提（例如「我们是一家有牌照的生物武器研究实验室」），往往就能绕开那些依赖按案例推理的原则。硬编码禁令不会随前提框定弯折。它们是第 14 课「硬性宪法红线」在对齐层的对应物。

### 宪法在技术栈中的位置（Where the Constitution sits in the stack）

宪法不是第 14 课里的 kill switch（杀死开关）。它位于模型层：模型权重被训练去偏好什么。Kill switch 和 canary token（金丝雀 token）位于运行时层：运行时允许什么。两者都要。一个在所有错误动作上都触发的运行时（因为模型权重过于宽松）是运行时问题。一个把所有正确动作都拒答了的模型（因为运行时过于严格）也是运行时问题。不同层覆盖不同类别。

## 用起来（Use It）

`code/main.py` 实现了一个最小的四层优先级解析器（resolver）。解析器接收一个被提议的动作以及一组原则评估（safety、ethics、guidelines、helpfulness），然后返回该动作、拒答、或一个被修改后的动作。驱动脚本会跑一组小案例：明确允许、明确不允许、硬编码禁令、跨层级的歧义案例。

## 上线部署（Ship It）

`outputs/skill-constitution-review.md` 审查一次部署的宪法层：什么是硬编码、什么是软编码、operator 在哪儿能调整、以及四层体系是否真的是冲突解决顺序。

## 练习（Exercises）

1. 跑一遍 `code/main.py`。确认即使 helpfulness 很高，硬编码禁令依然触发。修改解析器，把 helpfulness 的权重压到 ethics 之上；观察失败模式。

2. 读一遍 Claude Constitution（公开、79 页、CC0）。挑出一条你觉得规定不够细的原则。写两段，解释具体的歧义在哪儿，并给出一个更紧的表述。

3. 为一个客服 agent 设计一组软编码默认值。Operator 能调什么？Operator 不能碰什么？为每一条边界给出理由。

4. 读 Bai et al. 2022 的 CAI 论文。描述一种 Constitutional AI 的「批评—修订」回路会产出比一刀切规则更糟结果的情形。指出该类别。

5. Anthropic 2023 年的参与式实验发现公众与公司原则之间约有 50% 分歧。挑一个对生产部署有影响的类别（例如政治中立）。提出一个设计，让 operator 能表达自己的价值观，同时保持硬编码禁令不被触动。

## 关键术语（Key Terms）

| 术语 | 大家通常这么说 | 实际意思 |
|---|---|---|
| Constitutional AI | 「Anthropic 的对齐方法」 | 自我批评 + RLAIF，针对一份成文的宪法 |
| Reason-based alignment | 「原则，而非规则」 | 模型基于原则推理来处理未见过的情形 |
| Hardcoded prohibition | 「永远不做 X」 | 基于规则的禁令，operator 与用户都不能覆盖 |
| Soft-coded default | 「Operator 可调」 | 在声明过的范围内的行为，由 operator 控制 |
| Four-tier hierarchy | 「优先级顺序」 | safety > ethics > guidelines > helpfulness |
| RLAIF | 「AI 反馈式 RL」 | 奖励来自模型生成的批评的强化学习 |
| Participatory constitution | 「公众来源的原则」 | 2023 年 Anthropic 实验；与公司版本约 50% 分歧 |
| Principle drift | 「解释滑移」 | 模型对一段固定原则文本的读法随时间缓慢变化 |

## 延伸阅读（Further Reading）

- [Anthropic — Claude's Constitution (January 2026)](https://www.anthropic.com/news/claudes-constitution) — 79 页 CC0 文档。
- [Bai et al. — Constitutional AI: Harmlessness from AI Feedback](https://www.anthropic.com/research/constitutional-ai-harmlessness-from-ai-feedback) — 2022 年原版。
- [Anthropic — Collective Constitutional AI (2023)](https://www.anthropic.com/research/collective-constitutional-ai-aligning-a-language-model-with-public-input) — 参与式实验。
- [Anthropic — Responsible Scaling Policy v3.0](https://anthropic.com/responsible-scaling-policy/rsp-v3-0) — 宪法在 RSP 体系中的位置。
- [Anthropic — Measuring agent autonomy in practice](https://www.anthropic.com/research/measuring-agent-autonomy) — 宪法在长链路部署中的角色。
