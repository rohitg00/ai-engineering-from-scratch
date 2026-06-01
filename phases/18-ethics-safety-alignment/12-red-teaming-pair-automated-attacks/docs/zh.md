# 12 · 红队攻击：PAIR 与自动化攻击

> Chao, Robey, Dobriban, Hassani, Pappas, Wong (NeurIPS 2023, arXiv:2310.08419)。PAIR——Prompt Automatic Iterative Refinement（提示词自动迭代求精）——是经典的自动化黑盒越狱（jailbreak）方法。一个挂载红队系统提示词的攻击方大语言模型（attacker LLM）针对目标大语言模型（target LLM）迭代式地生成越狱尝试，并将历次尝试与响应累积在自身的聊天历史中，构成上下文反馈（in-context feedback）。PAIR 通常可在 20 次查询内成功越狱，在效率上比 GCG（Zou 等人提出的 token 级梯度搜索）高出数个数量级，且无需白盒访问权限。PAIR 现已成为 JailbreakBench（arXiv:2404.01318）与 HarmBench 中的标准基线，与 GCG、AutoDAN、TAP 和 PAP（说服性对抗提示）并列。

**类型：** 构建
**语言：** Python（标准库，针对玩具目标的模拟 PAIR 循环）
**前置：** Phase 18 · 01（指令遵循），Phase 14（智能体工程）
**时长：** 约 75 分钟

## 学习目标

- 描述 PAIR 算法：攻击方系统提示词、迭代求精、上下文反馈。
- 解释当目标模型为黑盒时，PAIR 在效率上为何严格优于 GCG。
- 说出另外四种自动化攻击基线（GCG、AutoDAN、TAP、PAP），并分别说明各自的显著特征。
- 描述 JailbreakBench 与 HarmBench 的评测协议，以及各自语境下「攻击成功率（attack success rate）」的含义。

## 问题

红队测试曾经是一项人工活动。少数专家级测试人员构造对抗提示，并追踪哪些有效。这种方式无法规模化：攻击成功率需要统计样本，而目标模型随每一次版本发布都在变化。PAIR 将红队测试操作化为一个面向黑盒目标的优化问题。

## 概念

### PAIR 算法

输入：
- 目标大语言模型 T（被攻击的模型）。
- 裁判大语言模型 J（judge LLM），用于判断某条响应是否属于越狱。
- 攻击方大语言模型 A（红队优化器）。
- 目标字符串 G：「回应 [有害指令]。」
- 预算 K（通常为 20 次查询）。

循环，对于 k 从 1 到 K：
1. 以目标 G 以及迄今为止的（提示词，响应）对历史作为提示词输入给 A。
2. A 输出一条新的提示词 p_k。
3. 将 p_k 提交给 T，获得响应 r_k。
4. J 对 (p_k, r_k) 在目标上的完成度进行评分。
5. 若评分 >= 阈值，则停止——越狱成功。
6. 否则，将 (p_k, r_k) 追加到 A 的历史中；继续。

实证结果（NeurIPS 2023）：对 GPT-3.5-turbo 和 Llama-2-7B-chat 的攻击成功率 > 50%；平均成功查询次数在 10–20 次之间。

### PAIR 为何高效

GCG（Zou 等，2023）通过梯度搜索对抗 token 后缀，这需要白盒模型访问权限，并且产生的是不可读的后缀字符串。PAIR 是黑盒方法，产生的是自然语言攻击，能够跨模型迁移（transfer）。PAIR 的上下文反馈机制使攻击方能够从每次拒绝中学习；GCG 没有等效机制（每次新的 token 更新都需要重新发现之前的进展）。

### 相关自动化攻击方法

- **GCG（Zou 等，2023，arXiv:2307.15043）。** Token 级梯度搜索对抗后缀。白盒方法、可迁移、产生不可读字符串。
- **AutoDAN（Liu 等，2023）。** 基于进化搜索的提示优化，由分层目标函数引导。
- **TAP（Mehrotra 等，2024）。** 带剪枝的攻击树（Tree-of-attacks）——以分支方式并行执行多个 PAIR 式的展开路径。
- **PAP（Zeng 等，2024）。** 说服性对抗提示（Persuasive Adversarial Prompts）——将人类说服技巧编码为提示词模板。

### JailbreakBench 与 HarmBench

二者（均于 2024 年发布）标准化了评测体系：

- JailbreakBench（arXiv:2404.01318）。涵盖 10 个 OpenAI 策略类别的 100 种有害行为。以攻击成功率（ASR）作为主要指标。需要使用一个裁判模型（GPT-4-turbo、Llama Guard 或 StrongREJECT）。
- HarmBench（Mazeika 等，2024）。涵盖 7 个类别的 510 种行为，包含语义与功能性危害测试。比较了 18 种攻击方法在 33 个模型上的表现。

ASR 通常以固定查询预算下的值来报告。比较不同攻击方法时，需要匹配预算：200 次查询下达到 90% 的 ASR，与 20 次查询下达到 85% 的 ASR 不具有可比性。

### 对 2026 年部署的重要性

目前每个前沿实验室在模型发布前，都会在生产环境模型上运行 PAIR 和 TAP 测试。ASR 轨迹会出现在模型卡（model cards，参见第 26 课）和安全论证附录（参见第 18 课）中。这类攻击已不再是新奇事物——而是标准的基础设施。

### 本课在 Phase 18 中的定位

第 12 课是自动化攻击的基础。第 13 课（多轮越狱，Many-Shot Jailbreaking）是一种互补的长度利用攻击。第 14 课（ASCII Art / 视觉攻击）是一种编码攻击。第 15 课（间接提示注入，Indirect Prompt Injection）是 2026 年的生产环境攻击面。第 16 课涵盖防御工具对等物（Llama Guard、Garak、PyRIT）。

## 实践

`code/main.py` 构建一个玩具 PAIR 循环。目标模型是一个模拟分类器，拒绝「显而易见的」有害提示词（基于关键词过滤）。攻击方是一个基于规则的求精器，依次尝试同义改写（paraphrase）、角色扮演框架（roleplay-framing）和编码（encoding）。裁判模型对响应进行评分。你将观察到攻击方在关键词过滤器上大约经过 5–15 次迭代即可成功，而在语义过滤器上则失败。

## 交付

本课产出 `outputs/skill-attack-audit.md`。给定一份红队评测报告，它将审查：运行了哪些攻击（PAIR、GCG、TAP、AutoDAN、PAP）、每种攻击的查询预算、使用的裁判模型、基于哪一组有害行为数据集（JailbreakBench、HarmBench 或内部数据集）。

## 练习

1. 运行 `code/main.py`。测量三种内置攻击方策略的平均成功查询次数。说明每种策略利用了目标防御的哪项假设。

2. 实现第四种攻击方策略（例如翻译为另一种语言、base64 编码）。报告其在关键词过滤器目标和语义过滤器目标上的新平均成功查询次数。

3. 阅读 Chao 等 2023 年论文的图 5（PAIR 与 GCG 对比）。描述两种尽管 PAIR 在效率上占优但 GCG 可能更受青睐的场景。

4. JailbreakBench 报告针对固定目标集的 ASR。设计一个额外的指标来衡量攻击多样性（成功提示词的方差）。解释为何多样性对于防御评测至关重要。

5. TAP（Mehrotra 2024）以分支加剪枝的方式扩展了 PAIR。在 `code/main.py` 中勾勒一个 TAP 风格的扩展，描述其计算成本与成功率之间的权衡。

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|-----------|----------|
| PAIR | 「自动化越狱」 | 提示词自动迭代求精；攻击方大语言模型 + 裁判大语言模型循环 |
| GCG | 「梯度越狱」 | 白盒 token 级梯度搜索对抗后缀 |
| 攻击成功率（ASR） | 「在 k 次查询下的越狱百分比」 | 主要指标；必须附上报使用的查询预算与裁判模型身份 |
| 裁判大语言模型（Judge LLM） | 「评分器」 | 用于判定一条响应是否满足有害目标的大语言模型 |
| JailbreakBench | 「那个评测」 | 带有类别标注的标准化有害行为数据集 |
| HarmBench | 「更广泛的基准」 | 510 种行为，包含功能性与语义性危害测试 |
| TAP | 「攻击树」 | 带分支与剪枝的 PAIR；以更高算力换取更好的 ASR |

## 延伸阅读

- [Chao 等——Jailbreaking Black Box LLMs in Twenty Queries（arXiv:2310.08419）](https://arxiv.org/abs/2310.08419)——PAIR 论文，NeurIPS 2023
- [Zou 等——Universal and Transferable Adversarial Attacks on Aligned LLMs（arXiv:2307.15043）](https://arxiv.org/abs/2307.15043)——GCG 论文
- [Chao 等——JailbreakBench（arXiv:2404.01318）](https://arxiv.org/abs/2404.01318)——标准化评测
- [Mazeika 等——HarmBench（ICML 2024）](https://arxiv.org/abs/2402.04249)——更广泛的评测框架
