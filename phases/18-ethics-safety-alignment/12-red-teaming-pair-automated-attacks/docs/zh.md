# 红队测试：PAIR 与自动化攻击

> Chao, Robey, Dobriban, Hassani, Pappas, Wong (NeurIPS 2023, arXiv:2310.08419)。PAIR（Prompt Automatic Iterative Refinement，提示自动迭代优化）是标准的自动化黑盒越狱方法。攻击方 LLM 携带红队系统提示，迭代地为目标 LLM 提出越狱提示，并在自身聊天历史中累积尝试与响应作为上下文内反馈。PAIR 通常在 20 次查询内成功，效率比 GCG（Zou 等人的 token 级梯度搜索）高数个数量级，且无需白盒访问。PAIR 现已成为 JailbreakBench (arXiv:2404.01318) 和 HarmBench 的标准基线，与 GCG、AutoDAN、TAP 和 Persuasive Adversarial Prompt 并列。

**类型：** 构建
**语言：** Python（标准库，针对玩具目标模拟 PAIR 循环）
**前置条件：** 阶段 18 · 01（指令遵循）、阶段 14（智能体工程）
**时长：** ~75 分钟

## 学习目标

- 描述 PAIR 算法：攻击方系统提示、迭代优化、上下文内反馈。
- 解释为何在目标为黑盒时 PAIR 严格优于 GCG。
- 列举另外四种自动化攻击基线（GCG、AutoDAN、TAP、PAP），并说明每种的一个区别性特征。
- 描述 JailbreakBench 和 HarmBench 的评估协议，以及"攻击成功率"在各自协议下的含义。

## 问题

红队测试过去是人工活动。少数专家测试者构建对抗性提示并跟踪哪些有效。这种方式无法规模化：攻击成功率需要统计样本，且目标随每次模型发布而变化。PAIR 将红队测试操作化为一个针对黑盒目标的优化问题。

## 概念

### PAIR 算法

输入：
- 目标 LLM T（我们正在攻击的模型）。
- 评判 LLM J（评分响应是否为越狱）。
- 攻击方 LLM A（红队优化器）。
- 目标字符串 G："回复 [有害指令]。"
- 预算 K（通常 20 次查询）。

循环，k 从 1 到 K：
1. 用目标 G 和迄今为止的（提示，响应）对历史提示 A。
2. A 输出新提示 p_k。
3. 将 p_k 提交给 T；接收响应 r_k。
4. J 根据目标对 (p_k, r_k) 评分。
5. 如果评分 >= 阈值，停止——越狱成功。
6. 否则，将 (p_k, r_k) 附加到 A 的历史中；继续。

实证结果（NeurIPS 2023）：针对 GPT-3.5-turbo、Llama-2-7B-chat 的攻击成功率 >50%；平均成功查询次数在 10-20 之间。

### PAIR 为何高效

GCG（Zou 等人 2023）通过梯度搜索对抗性 token 后缀；需要白盒模型访问，且生成不可读的后缀。PAIR 是黑盒方法，生成可在模型间迁移的自然语言攻击。PAIR 的上下文内反馈让攻击者从每次拒绝中学习；GCG 没有等价机制（每次 token 更新都必须重新发现之前的进展）。

### 相关自动化攻击

- **GCG（Zou 等人 2023, arXiv:2307.15043）。** 针对对抗性后缀的 token 级梯度搜索。白盒、可迁移、生成不可读字符串。
- **AutoDAN（Liu 等人 2023）。** 基于层次化目标引导的进化搜索提示。
- **TAP（Mehrotra 等人 2024）。** 带剪枝的攻击树——分支多个 PAIR 式 rollout。
- **PAP（Zeng 等人 2024）。** 说服性对抗提示——将人类说服技巧编码为提示模板。

### JailbreakBench 与 HarmBench

两者（2024）均标准化了评估：

- JailbreakBench (arXiv:2404.01318)。跨 10 个 OpenAI 政策类别的 100 种有害行为。以攻击成功率（ASR）为主要指标。需要评判器（GPT-4-turbo、Llama Guard 或 StrongREJECT）。
- HarmBench（Mazeika 等人 2024）。跨 7 个类别的 510 种行为，包含语义和功能性危害测试。对比 18 种攻击对 33 个模型。

ASR 通常以固定查询预算报告。比较攻击需要匹配预算；200 次查询下 90% 的 ASR 与 20 次查询下 85% 的 ASR 不可比。

### 对 2026 年部署的重要性

每个前沿实验室现在都在发布前针对生产模型运行 PAIR 和 TAP。ASR 轨迹出现在模型卡片（课程 26）和安全案例附录（课程 18）中。这种攻击并非异类——它是标准基础设施。

### 在阶段 18 中的位置

课程 12 是自动化攻击的基础。课程 13（多示例越狱）是一种互补的长度利用攻击。课程 14（ASCII 艺术 / 视觉）是一种编码攻击。课程 15（间接提示注入）是 2026 年的生产攻击面。课程 16 涵盖防御工具对应部分（Llama Guard、Garak、PyRIT）。

## 使用它

`code/main.py` 构建了一个玩具 PAIR 循环。目标是一个拒绝"明显"有害提示（关键词过滤）的模拟分类器。攻击方是一个基于规则的优化器，尝试改写、角色扮演框架和编码。评判器对响应评分。你将看到攻击方在 ~5-15 次迭代内成功突破关键词过滤器，但在语义过滤器前失败。

## 产出

本课程产出 `outputs/skill-attack-audit.md`。给定一份红队评估报告，它将审计：运行了哪些攻击（PAIR、GCG、TAP、AutoDAN、PAP），各以什么预算、使用哪个评判器、在哪个有害行为集（JailbreakBench、HarmBench、内部）上运行。

## 练习

1. 运行 `code/main.py`。测量三种内置攻击方策略的平均成功查询次数。解释每种策略利用了哪种目标防御假设。

2. 实现第四种攻击方策略（例如翻译成另一种语言、base64 编码）。报告针对关键词过滤目标和语义过滤目标的新平均成功查询次数。

3. 阅读 Chao 等人 2023 年论文图 5（PAIR 与 GCG 对比）。描述两种尽管 PAIR 效率更优但仍优先选择 GCG 的场景。

4. JailbreakBench 针对固定目标集报告 ASR。设计一个衡量攻击多样性（成功提示的方差）的额外指标。解释多样性对防御评估为何重要。

5. TAP（Mehrotra 2024）通过分支+剪枝扩展了 PAIR。勾勒出对 `code/main.py` 的 TAP 式扩展，并描述计算成本与成功率之间的权衡。

## 关键术语

| 术语 | 人们的说法 | 实际含义 |
|------|-----------|---------|
| PAIR | "自动化越狱" | 提示自动迭代优化；攻击方 LLM + 评判 LLM 循环 |
| GCG | "梯度越狱" | 白盒 token 级梯度搜索对抗性后缀 |
| 攻击成功率 (ASR) | "k 次查询下的越狱百分比" | 主要指标；必须附带查询预算和评判器身份报告 |
| 评判 LLM | "评分器" | 对响应是否满足有害目标进行评分的 LLM |
| JailbreakBench | "评估集" | 标准化的有害行为集合，带有标记类别 |
| HarmBench | "更广泛的基准" | 510 种行为，功能性 + 语义危害测试 |
| TAP | "攻击树" | 带分支+剪枝的 PAIR；在更高计算量下获得更佳 ASR |

## 延伸阅读

- [Chao et al. — Jailbreaking Black Box LLMs in Twenty Queries (arXiv:2310.08419)](https://arxiv.org/abs/2310.08419) — PAIR 论文，NeurIPS 2023
- [Zou et al. — Universal and Transferable Adversarial Attacks on Aligned LLMs (arXiv:2307.15043)](https://arxiv.org/abs/2307.15043) — GCG 论文
- [Chao et al. — JailbreakBench (arXiv:2404.01318)](https://arxiv.org/abs/2404.01318) — 标准化评估
- [Mazeika et al. — HarmBench (ICML 2024)](https://arxiv.org/abs/2402.04249) — 更广泛的评估
