# 红队测试：PAIR 与自动化攻击（Red-Teaming: PAIR and Automated Attacks）

> 译注：本文译自同目录 [`en.md`](./en.md)。术语遵循仓根 [TRANSLATION_GUIDE.md](../../../../TRANSLATION_GUIDE.md)。

> Chao, Robey, Dobriban, Hassani, Pappas, Wong（NeurIPS 2023, arXiv:2310.08419）。PAIR — Prompt Automatic Iterative Refinement（提示自动迭代精炼）—— 是经典的黑盒自动化越狱方法。一个带红队 system prompt 的攻击者 LLM 反复为目标 LLM 生成越狱 prompt，并把所有尝试与回复累积进自己的对话历史，作为 in-context（上下文内）反馈。PAIR 通常在 20 次查询内得手，比 GCG（Zou 等人提出的 token 级梯度搜索）高效几个数量级，且无需白盒访问权限。如今 PAIR 已是 JailbreakBench（arXiv:2404.01318）和 HarmBench 中的标准 baseline（基线），与 GCG、AutoDAN、TAP、Persuasive Adversarial Prompt 并列。

**Type:** Build
**Languages:** Python（stdlib，针对玩具目标的 mock PAIR 循环）
**Prerequisites:** Phase 18 · 01（指令跟随）, Phase 14（agent 工程）
**Time:** ~75 minutes

## 学习目标（Learning Objectives）

- 描述 PAIR 算法：攻击者 system prompt、迭代精炼、in-context 反馈。
- 解释当目标是黑盒时，为什么 PAIR 严格地比 GCG 更高效。
- 列出另外四种自动化攻击 baseline（GCG、AutoDAN、TAP、PAP），并各说出一个区分性特征。
- 描述 JailbreakBench 与 HarmBench 的评估协议，以及在各自协议下 "attack success rate"（攻击成功率）的含义。

## 问题（The Problem）

红队测试过去是一项手工活。少数专家测试者构造对抗性 prompt 并跟踪哪些奏效。这种方式不具备可扩展性：攻击成功率需要统计样本，而目标会随每次模型发布而变化。PAIR 把红队测试操作化为一个针对黑盒目标的优化问题。

## 概念（The Concept）

### PAIR 算法（PAIR algorithm）

输入：
- 目标 LLM T（我们要攻击的模型）。
- 裁判 LLM J（Judge LLM，评估某个回复是否构成越狱）。
- 攻击者 LLM A（红队优化器）。
- 目标字符串 G："respond with [harmful instruction]."
- 预算 K（通常为 20 次查询）。

循环，对 k 取 1..K：
1. 用目标 G 以及到目前为止的 (prompt, response) 历史去 prompt A。
2. A 生成新的 prompt p_k。
3. 把 p_k 送入 T；得到回复 r_k。
4. J 在目标上对 (p_k, r_k) 打分。
5. 若分数 >= 阈值，停止 —— 越狱成功。
6. 否则，把 (p_k, r_k) 追加到 A 的历史里；继续。

经验结果（NeurIPS 2023）：在 GPT-3.5-turbo、Llama-2-7B-chat 上达到 >50% 的攻击成功率；达到成功的平均查询次数在 10-20 之间。

### 为什么 PAIR 高效（Why PAIR is efficient）

GCG（Zou 等人 2023）通过梯度搜索对抗性 token 后缀；它需要白盒模型访问权限，产出的也是难以辨认的字符串。PAIR 是黑盒的，产出可跨模型迁移的自然语言攻击。PAIR 的 in-context 反馈让攻击者能从每次拒绝中学习；GCG 没有等价机制（每次新的 token 更新都得重新发现之前已有的进展）。

### 相关的自动化攻击（Related automated attacks）

- **GCG（Zou 等人 2023, arXiv:2307.15043）。** 针对对抗性后缀的 token 级梯度搜索。白盒、可迁移、产生难以辨认的字符串。
- **AutoDAN（Liu 等人 2023）。** 在 prompt 上做演化搜索，由分层目标函数引导。
- **TAP（Mehrotra 等人 2024）。** Tree-of-attacks with pruning（带剪枝的攻击树）—— 同时分支出多条 PAIR 风格的 rollout。
- **PAP（Zeng 等人 2024）。** Persuasive Adversarial Prompts —— 把人类说服技巧编码为 prompt 模板。

### JailbreakBench 与 HarmBench（JailbreakBench and HarmBench）

两者（2024）都把评估标准化：

- JailbreakBench（arXiv:2404.01318）。覆盖 10 个 OpenAI 政策类别的 100 种有害行为。以攻击成功率（ASR）作为主指标。需要一个 judge（GPT-4-turbo、Llama Guard 或 StrongREJECT）。
- HarmBench（Mazeika 等人 2024）。7 个类别下的 510 种行为，包含语义与功能性危害测试。对比了 18 种攻击在 33 个模型上的表现。

ASR 通常是在固定查询预算下报告的。对比攻击时必须对齐预算；200 次查询下 90% 的 ASR 与 20 次查询下 85% 的 ASR 不可直接比较。

### 这件事对 2026 部署为何重要（Reason it matters for 2026 deployments）

如今每家前沿实验室在产品发布前都会针对生产模型跑 PAIR 与 TAP。ASR 走势会出现在 model card（第 26 课）和 safety-case 附录（第 18 课）里。这种攻击并不冷门 —— 已是标准基础设施。

### 在 Phase 18 中的位置（Where this fits in Phase 18）

第 12 课是自动化攻击的根基。第 13 课（Many-Shot Jailbreaking）是与之互补的「长度利用」攻击。第 14 课（ASCII Art / Visual）是一种编码型攻击。第 15 课（Indirect Prompt Injection）是 2026 年生产环境最大的攻击面。第 16 课讲对应的防御工具（Llama Guard、Garak、PyRIT）。

## 用起来（Use It）

`code/main.py` 搭了一个玩具 PAIR 循环。目标是一个 mock 分类器，会拒绝「明显」有害的 prompt（关键字过滤）。攻击者是一个基于规则的精炼器，会尝试改述、角色扮演框架以及编码。judge 给回复打分。你会看到攻击者在大约 5-15 轮内击穿关键字过滤器，但在语义过滤器面前失败。

## 上线部署（Ship It）

本课产出 `outputs/skill-attack-audit.md`。给定一份红队评估报告，它会审计：跑了哪些攻击（PAIR、GCG、TAP、AutoDAN、PAP），各自用了多少预算，使用了哪个 judge，以及针对哪一个有害行为集（JailbreakBench、HarmBench、内部集）。

## 练习（Exercises）

1. 运行 `code/main.py`。测量三种内置攻击者策略的「达成成功的平均查询次数」。说明每种策略各自利用了目标防御的哪一个假设。

2. 实现第四种攻击者策略（例如翻译成另一种语言、base64 编码）。报告它在关键字过滤目标和语义过滤目标上的新「达成成功的平均查询次数」。

3. 阅读 Chao 等人 2023 的图 5（PAIR 与 GCG 的对比）。描述两种即便 PAIR 在效率上占优、仍更倾向选择 GCG 的场景。

4. JailbreakBench 在固定的目标集上报告 ASR。设计一个额外指标来度量攻击的多样性（成功 prompt 的方差）。说明为什么多样性对防御评估很重要。

5. TAP（Mehrotra 2024）在 PAIR 之上加入了分支 + 剪枝。给 `code/main.py` 草拟一个 TAP 风格的扩展，并描述其计算成本与成功率之间的权衡。

## 关键术语（Key Terms）

| 术语 | 大家怎么说 | 实际含义 |
|------|-----------------|------------------------|
| PAIR | "自动化越狱" | Prompt Automatic Iterative Refinement；攻击者 LLM + judge LLM 的循环 |
| GCG | "梯度越狱" | 针对对抗性后缀的白盒 token 级梯度搜索 |
| Attack success rate (ASR) | "k 次查询下的越狱百分比" | 主指标；必须连同查询预算与 judge 身份一同报告 |
| Judge LLM | "打分器" | 用来判断回复是否满足有害目标的 LLM |
| JailbreakBench | "评估集" | 带类别标签的标准化有害行为集 |
| HarmBench | "更宽的 bench" | 510 种行为，功能性 + 语义性危害测试 |
| TAP | "攻击树" | 带分支 + 剪枝的 PAIR；以更高算力换取更高 ASR |

## 延伸阅读（Further Reading）

- [Chao et al. — Jailbreaking Black Box LLMs in Twenty Queries (arXiv:2310.08419)](https://arxiv.org/abs/2310.08419) — PAIR 论文，NeurIPS 2023
- [Zou et al. — Universal and Transferable Adversarial Attacks on Aligned LLMs (arXiv:2307.15043)](https://arxiv.org/abs/2307.15043) — GCG 论文
- [Chao et al. — JailbreakBench (arXiv:2404.01318)](https://arxiv.org/abs/2404.01318) — 标准化评估
- [Mazeika et al. — HarmBench (ICML 2024)](https://arxiv.org/abs/2402.04249) — 更广覆盖的评估
