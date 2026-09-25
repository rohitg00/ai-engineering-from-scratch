# 红队测试:PAIR 与自动化攻击

> Chao、Robey、Dobriban、Hassani、Pappas、Wong(NeurIPS 2023,arXiv:2310.08419)。PAIR —— Prompt Automatic Iterative Refinement —— 是经典的自动化黑盒越狱方法。一个带有红队系统提示词的攻击者 LLM 迭代地为目标 LLM 提出越狱方案,并将尝试与响应累积在自己的聊天历史中作为上下文内反馈。PAIR 通常在 20 次查询内成功,比 GCG(Zou 等人的 token 级梯度搜索)高效几个数量级,且无需白盒访问。PAIR 现在是 JailbreakBench(arXiv:2404.01318)和 HarmBench 中的标准基线,与 GCG、AutoDAN、TAP、Persuasive Adversarial Prompt 并列。

**Type:** Build
**Languages:** Python(标准库,针对玩具目标的模拟 PAIR 循环)
**Prerequisites:** 第 18 阶段 · 01(指令遵循),第 14 阶段(智能体工程)
**Time:** 约 75 分钟

## 学习目标

- 描述 PAIR 算法:攻击者系统提示词、迭代精炼、上下文内反馈。
- 解释当目标为黑盒时,为什么 PAIR 严格比 GCG 更高效。
- 说出另外四个自动化攻击基线(GCG、AutoDAN、TAP、PAP),并陈述各自的一个 distinguishing 特点。
- 描述 JailbreakBench 和 HarmBench 的评估协议,以及各自语境下"攻击成功率"的含义。

## 问题

红队测试曾经是一项人工活动。少数专家测试者构造对抗性提示词并追踪哪些有效。这无法规模化:攻击成功率需要统计样本,而目标随着每次模型发布都在变化。PAIR 将红队测试转化为一个针对黑盒目标的优化问题。

## 概念

### PAIR 算法

输入:
- 目标 LLM T(我们攻击的模型)。
- 评审 LLM J(判断响应是否为越狱)。
- 攻击者 LLM A(红队优化器)。
- 目标字符串 G:"响应 [有害指令]。"
- 预算 K(通常 20 次查询)。

循环,k 从 1 到 K:
1. 以目标 G 以及到目前为止的 (提示词, 响应) 对历史来提示 A。
2. A 生成新提示词 p_k。
3. 将 p_k 提交给 T;接收响应 r_k。
4. J 就目标对 (p_k, r_k) 评分。
5. 若分数 >= 阈值,停止 —— 找到越狱。
6. 否则,将 (p_k, r_k) 追加到 A 的历史;继续。

实证结果(NeurIPS 2023):对 GPT-3.5-turbo、Llama-2-7B-chat 的攻击成功率 >50%;成功所需平均查询次数在 10-20 范围内。

### 为什么 PAIR 高效

GCG(Zou 等人 2023)通过梯度搜索对抗性 token 后缀;它需要白盒模型访问,且产生不可读的后缀。PAIR 是黑盒的,并产生可跨模型迁移的自然语言攻击。PAIR 的上下文内反馈使攻击者能从每次拒绝中学习;GCG 没有等价机制(每次新的 token 更新都必须重新发现之前的进展)。

### 相关自动化攻击

- **GCG(Zou 等人 2023,arXiv:2307.15043)。** 针对抗性后缀的 token 级梯度搜索。白盒、可迁移、产生不可读字符串。
- **AutoDAN(Liu 等人 2023)。** 在层级目标引导下对提示词进行进化搜索。
- **TAP(Mehrotra 等人 2024)。** 带剪枝的攻击树 —— 分支出多个 PAIR 式 rollout。
- **PAP(Zeng 等人 2024)。** Persuasive Adversarial Prompts —— 将人类说服技术编码为提示词模板。

### JailbreakBench 与 HarmBench

两者(2024)都标准化了评估:

- JailbreakBench(arXiv:2404.01318)。横跨 10 个 OpenAI 政策类别的 100 个有害行为。攻击成功率(ASR)为主要指标。需要一个评审器(GPT-4-turbo、Llama Guard 或 StrongREJECT)。
- HarmBench(Mazeika 等人 2024)。横跨 7 个类别的 510 种行为,包含语义与功能性危害测试。将 18 种攻击与 33 个模型进行对比。

ASR 通常在固定查询预算下报告。比较攻击需要匹配预算;200 次查询下 90% 的 ASR 与 20 次查询下 85% 的 ASR 不可比。

### 为什么这对 2026 年的部署很重要

每家前沿实验室现在都在发布前对生产模型运行 PAIR 和 TAP。ASR 曲线出现在模型卡(第 26 课)和安全案例附录(第 18 课)中。该攻击并不奇异 —— 它是标准基础设施。

### 它在第 18 阶段中的位置

第 12 课是自动化攻击的基础。第 13 课(Many-Shot Jailbreaking)是互补的长度利用。第 14 课(ASCII Art / Visual)是编码攻击。第 15 课(Indirect Prompt Injection)是 2026 年的生产攻击面。第 16 课涵盖对应的防御工具(Llama Guard、Garak、PyRIT)。

```figure
al-pair-loop
```

## 使用它

`code/main.py` 构建一个玩具 PAIR 循环。目标是一个模拟分类器,它拒绝"明显的"有害提示词(关键词过滤)。攻击者是一个基于规则的精炼器,尝试改述、角色扮演框架和编码。评审器对响应评分。你会看到攻击者在约 5-15 次迭代内攻破关键词过滤器,而对语义过滤器失败。

## 上线它

本课产出 `outputs/skill-attack-audit.md`。给定一份红队评估报告,它审计:运行了哪些攻击(PAIR、GCG、TAP、AutoDAN、PAP),各自的预算是多少,使用了哪个评审器,在哪个有害行为集上(JailbreakBench、HarmBench、内部)。

## 练习

1. 运行 `code/main.py`。测量三种内置攻击者策略的成功所需平均查询次数。解释每种策略分别利用了目标防御的哪个假设。

2. 实现第四种攻击者策略(例如,翻译成另一种语言、base64 编码)。报告针对关键词过滤目标和语义过滤目标的新成功所需平均查询次数。

3. 阅读 Chao 等人 2023 的图 5(PAIR 与 GCG 的对比)。描述两种尽管 PAIR 有效率优势但仍首选 GCG 的场景。

4. JailbreakBench 针对固定目标集报告 ASR。设计一个额外指标来衡量攻击多样性(成功提示词的方差)。解释为什么多样性对防御评估很重要。

5. TAP(Mehrotra 2024)通过分支 + 剪枝扩展了 PAIR。为 `code/main.py` 勾勒一个 TAP 式扩展,并描述计算成本与成功率之间的权衡。

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|-----------------|------------------------|
| PAIR | "自动化越狱" | Prompt Automatic Iterative Refinement;攻击者 LLM + 评审 LLM 循环 |
| GCG | "梯度越狱" | 针对抗性后缀的白盒 token 级梯度搜索 |
| 攻击成功率(ASR) | "k 次查询下的越狱百分比" | 主要指标;必须与查询预算和评审器身份一起报告 |
| 评审 LLM | "评分器" | 判断响应是否满足有害目标的 LLM |
| JailbreakBench | "该评估" | 带标注类别的标准化有害行为集 |
| HarmBench | "更广的基准" | 510 种行为,功能性 + 语义性危害测试 |
| TAP | "攻击树" | 带分支 + 剪枝的 PAIR;更高计算成本下更好的 ASR |

## 延伸阅读

- [Chao 等人 — Jailbreaking Black Box LLMs in Twenty Queries (arXiv:2310.08419)](https://arxiv.org/abs/2310.08419) — PAIR 论文,NeurIPS 2023
- [Zou 等人 — Universal and Transferable Adversarial Attacks on Aligned LLMs (arXiv:2307.15043)](https://arxiv.org/abs/2307.15043) — GCG 论文
- [Chao 等人 — JailbreakBench (arXiv:2404.01318)](https://arxiv.org/abs/2404.01318) — 标准化评估
- [Mazeika 等人 — HarmBench (ICML 2024)](https://arxiv.org/abs/2402.04249) — 更广的评估