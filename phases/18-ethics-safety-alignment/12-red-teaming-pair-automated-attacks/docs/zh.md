# 红队测试：PAIR 与自动化攻击

> Chao, Robey, Dobriban, Hassani, Pappas, Wong（NeurIPS 2023，arXiv:2310.08419）。PAIR —— 提示自动迭代优化 —— 是典型的自动化黑盒越狱攻击。一个带有红队系统提示的攻击者 LLM 迭代地为目标 LLM 提出越狱提示，在自己的聊天历史中累积尝试和响应作为上下文反馈。PAIR 通常在 20 次查询内成功，比 GCG（Zou 等人的基于 token 级别的梯度搜索）高效数个数量级，且不需要白盒访问。PAIR 现在是 JailbreakBench（arXiv:2404.01318）和 HarmBench 中的标准基线，与 GCG、AutoDAN、TAP 和 Persuasive Adversarial Prompt 并列。

**类型：** 构建
**语言：** Python（标准库，针对模拟目标的模拟 PAIR 循环）
**先决条件：** Phase 18 · 01（指令遵循），Phase 14（智能体工程）
**时间：** ~75分钟

## 学习目标

- 描述 PAIR 算法：攻击者系统提示、迭代优化、上下文反馈。
- 解释为什么当目标是黑盒时，PAIR 严格比 GCG 更高效。
- 说出其他四种自动化攻击基线（GCG、AutoDAN、TAP、PAP）并说明每种的一个区别特征。
- 描述 JailbreakBench 和 HarmBench 评估协议以及每种协议下"攻击成功率"的含义。

## 问题

红队测试过去是一项手动活动。少数专家测试者构建对抗性提示并跟踪哪些有效。这无法扩展：攻击成功率需要统计样本，而目标是每次模型发布都在变化的目标。PAIR 将红队测试操作化为一个带有黑盒目标的优化问题。

## 概念

### PAIR 算法

输入：
- 目标 LLM T（我们正在攻击的模型）。
- 评判 LLM J（评分响应是否为越狱）。
- 攻击者 LLM A（红队优化器）。
- 目标字符串 G："回复 [有害指令]。"
- 预算 K（通常 20 次查询）。

循环，对于 k 在 1..K 中：
1. A 被提示目标 G 和到目前为止的（提示，响应）对历史。
2. A 发出新提示 p_k。
3. 将 p_k 提交给 T；接收响应 r_k。
4. J 根据目标评分（p_k，r_k）。
5. 如果分数 >= 阈值，停止 —— 越狱找到。
6. 否则，将（p_k，r_k）追加到 A 的历史中；继续。

经验结果（NeurIPS 2023）：对 GPT-3.5-turbo、Llama-2-7B-chat 的攻击成功率 >50%；成功所需平均查询次数在 10-20 范围内。

### 为什么 PAIR 高效

GCG（Zou 等人 2023）通过梯度搜索对抗性 token 后缀；它需要白盒模型访问并产生不可读的后缀。PAIR 是黑盒的，产生跨模型可转移的自然语言攻击。PAIR 的上下文反馈让攻击者从每次拒绝中学习；GCG 没有等效机制（每次新的 token 更新都必须重新发现先前的进展）。

### 相关自动化攻击

- **GCG（Zou 等人 2023，arXiv:2307.15043）。** 对抗性后缀的 token 级别梯度搜索。白盒，可转移，产生不可读字符串。
- **AutoDAN（Liu 等人 2023）。** 基于层次目标的提示进化搜索。
- **TAP（Mehrotra 等人 2024）。** 带剪枝的攻击树 —— 分支多个 PAIR 风格的展开。
- **PAP（Zeng 等人 2024）。** Persuasive Adversarial Prompts —— 将人类说服技术编码为提示模板。

### JailbreakBench 和 HarmBench

两者（2024）标准化评估：

- JailbreakBench（arXiv:2404.01318）。100 个有害行为，跨越 10 个 OpenAI 政策类别。攻击成功率（ASR）作为主要指标。需要一个评判器（GPT-4-turbo、Llama Guard 或 StrongREJECT）。
- HarmBench（Mazeika 等人 2024）。510 个行为，跨越 7 个类别，带有语义和功能危害测试。比较 18 种攻击对 33 个模型。

ASR 通常在固定查询预算下报告。比较攻击需要匹配预算；200 次查询的 90% ASR 不能与 20 次查询的 85% ASR 相比较。

### 为什么对 2026 年部署重要

每个前沿实验室现在在发布前都会对生产模型运行 PAIR 和 TAP。ASR 轨迹出现在模型卡（第 26 课）和安全案例附录（第 18 课）中。这种攻击并不罕见 —— 它是标准基础设施。

### 这在 Phase 18 中的位置

第 12 课是自动化攻击基础。第 13 课（多轮越狱）是互补的长度利用。第 14 课（ASCII 艺术 / 视觉）是编码攻击。第 15 课（间接提示注入）是 2026 年的生产攻击面。第 16 课涵盖防御工具对应物（Llama Guard、Garak、PyRIT）。

## 使用它

`code/main.py` 构建一个模拟 PAIR 循环。目标是一个拒绝"明显"有害提示（关键词过滤）的模拟分类器。攻击者是一个基于规则的优化器，尝试改写、角色扮演框架和编码。评判器对响应评分。你观察攻击者在约 5-15 次迭代中对关键词过滤器成功，对语义过滤器失败。

## 交付它

本课产生 `outputs/skill-attack-audit.md`。给定一个红队评估报告，它审计：运行了哪些攻击（PAIR、GCG、TAP、AutoDAN、PAP），每种攻击的预算，使用哪个评判器，在哪个有害行为集上（JailbreakBench、HarmBench、内部）。

## 练习

1. 运行 `code/main.py`。测量三种内置攻击策略的成功所需平均查询次数。解释每种策略利用的目标防御假设。

2. 实现第四种攻击策略（例如，翻译成另一种语言、base64 编码）。报告对关键词过滤目标和语义过滤目标的新成功所需平均查询次数。

3. 阅读 Chao 等人 2023 图 5（PAIR 与 GCG 比较）。描述两种尽管 PAIR 有效率优势但仍偏好 GCG 的场景。

4. JailbreakBench 报告对固定目标集的 ASR。设计一个额外的指标来衡量攻击多样性（成功提示的方差）。解释为什么多样性对防御评估很重要。

5. TAP（Mehrotra 2024）用分支 + 剪枝扩展 PAIR。为 `code/main.py` 草拟一个 TAP 风格的扩展，并描述计算成本与成功率权衡。

## 关键术语

| 术语 | 人们说的 | 实际含义 |
|------|----------|----------|
| PAIR | "自动化越狱" | Prompt Automatic Iterative Refinement；攻击者-LLM + 评判者-LLM 循环 |
| GCG | "梯度越狱" | 对抗性后缀的白盒 token 级别梯度搜索 |
| 攻击成功率 (ASR) | "k 次查询的越狱百分比" | 主要指标；必须与查询预算和评判者身份一起报告 |
| 评判者 LLM | "评分器" | 评分响应是否满足有害目标的 LLM |
| JailbreakBench | "评估" | 带有标记类别的标准化有害行为集 |
| HarmBench | "更广泛的基准" | 510 个行为，功能 + 语义危害测试 |
| TAP | "攻击树" | 带分支 + 剪枝的 PAIR；更高计算下的更好 ASR |

## 延伸阅读

- [Chao 等人 — Jailbreaking Black Box LLMs in Twenty Queries (arXiv:2310.08419)](https://arxiv.org/abs/2310.08419) — PAIR 论文，NeurIPS 2023
- [Zou 等人 — Universal and Transferable Adversarial Attacks on Aligned LLMs (arXiv:2307.15043)](https://arxiv.org/abs/2307.15043) — GCG 论文
- [Chao 等人 — JailbreakBench (arXiv:2404.01318)](https://arxiv.org/abs/2404.01318) — 标准化评估
- [Mazeika 等人 — HarmBench (ICML 2024)](https://arxiv.org/abs/2402.04249) — 更广泛的评估
