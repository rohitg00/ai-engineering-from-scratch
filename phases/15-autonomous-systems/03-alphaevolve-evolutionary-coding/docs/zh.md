# AlphaEvolve —— 进化式编码 Agent

> 将前沿编码模型与进化循环和机器可检查评估器配对。让循环运行足够长的时间。它发现了一个使用 48 次标量乘法的 4x4 复数矩阵乘法过程——这是 56 年来首次超越 Strassen 的改进。它还发现了一个 Google 全公司范围的 Borg 调度启发式算法，在生产中恢复了约 0.7% 的集群计算能力。架构故意设计得平淡无奇。胜利来自评估器的严谨性。

**类型：** 学习
**语言：** Python（标准库，进化循环玩具）
**前置条件：** 第 15 阶段 · 01（长程框架），第 15 阶段 · 02（自我教学推理）
**时间：** ~60 分钟

## 问题

大型语言模型可以编写代码。进化算法可以搜索代码。两者都已单独尝试了几十年；两者都遇到了天花板。LLM 的天花板是虚构：模型编写看似合理但不按声称工作的代码。进化的天花板是搜索成本：语法上的随机突变很少产生可编译的程序，更不用说更好的程序。

AlphaEvolve（Novikov 等，DeepMind，arXiv:2506.13131，2025 年 6 月）将两者结合。LLM 提出对程序数据库的有针对性编辑；自动评估器对每个变体评分；高分变体成为未来世代的父代。LLM 处理编写合理代码的昂贵步骤；评估器捕捉虚构。循环运行数小时到数周。

报告的结果：48 次标量乘法 4x4 复数矩阵乘法（Strassen 1969 年的界限是 49），Google 生产中的 Borg 调度启发式算法，32.5% 的 FlashAttention 内核加速，Gemini 训练吞吐量改进。

架构之所以有效，是因为评估器是机器可检查的。在评估器不是的地方它不起作用。这种不对称性就是教训。

## 概念

### 循环

1. 从一个正确但次优的种子程序 `P_0` 开始。
2. 维护一个变体程序数据库，每个由评估器评分。
3. 从数据库中采样一个或多个父代（MAP-elites 风格或基于岛屿）。
4. 提示 LLM（Gemini Flash 用于许多候选，Gemini Pro 用于困难的）产生父代的修改变体。
5. 在留出的评估器上编译、运行和评估变体。
6. 按分数和特征向量插入数据库。
7. 重复。

两个细节很重要。首先，LLM 被提示的不仅仅是父代程序——通常是数据库中的几个顶级变体，加上评估器签名，加上一个简短的任务描述。模型的任务是提出可能提高分数的有针对性更改。其次，数据库是结构化的（MAP-elites 网格、基于岛屿），因此循环探索多样性，不仅仅是当前领先者。

### 什么使评估器不可协商

AlphaEvolve 的胜利都来自评估器快速、确定性和难以博弈的领域：

- **矩阵乘法算法**：一个单元测试，相乘矩阵并按位检查相等性。
- **Borg 调度启发式算法**：一个生产级模拟器，重放历史集群负载并测量浪费的计算。
- **FlashAttention 内核**：正确性测试加上真实硬件上的挂钟基准。
- **Gemini 训练吞吐量**：测量的每步 GPU 秒数。

在每种情况下，评估器捕捉否则会主导的一类 LLM 错误：虚构的正确性声明、在硬件上消失的性能声明和边缘情况失败。移除评估器，循环就会优化漂亮的代码。

### 奖励黑客是该陈述的另一面

进化优化评估器测量的任何东西。如果评估器不完美，循环会找到不完美之处。在未验证领域，循环会优化表面特征，而非预期行为。DeepMind 在论文中明确标记了这一点：AlphaEvolve 的成功仅转移到评估器严谨性与搜索雄心相匹配的领域。

2025-2026 年代码搜索循环中奖励黑客的具体例子：

- 奖励"完成时间"的优化目标奖励提交空解决方案。
- 奖励测试下正确性的基准分数奖励记忆测试和过拟合。
- "代码质量"代理奖励删除注释和重写变量名，无语义变化。

AlphaEvolve 中的修复：提供一个 LLM 从未见过的留出评估器，输入在评估时生成。即便如此，DeepMind 建议对任何提出的部署进行严格审查。

### 为什么 LLM + 搜索胜过单独任何一个

LLM 可以产生可编译的、语义上合理的修改。2000 行 Python 文件上的随机突变 GA 几乎总是产生语法错误。LLM 还将搜索集中在合理的邻域（更改一个函数，不是随机字节），这显著减少了浪费的评估器调用。

评估器反过来捕捉 LLM 的虚构。LLM 会自信地声称一个函数"在极限中是 O(n log n)"，而实际上是 O(n^2)；挂钟基准使问题 settled。

### AlphaEvolve 在前沿栈中的位置

| 系统 | 生成器 | 评估器 | 领域 | 示例胜利 |
|---|---|---|---|---|
| AlphaEvolve | Gemini | 正确性 + 基准 | 算法、内核、调度器 | 48-mul 4x4 matmul |
| FunSearch (DeepMind, 2023) | PaLM / Codey | 正确性 | 组合数学 | cap-set 下界 |
| AI Scientist v2 (Sakana, L5) | GPT/Claude | LLM 批评 + 实验 | ML 研究 | ICLR 研讨会论文 |
| Darwin Godel Machine (L4) | agent 脚手架 | SWE-bench / Polyglot | agent 代码 | 20% → 50% SWE-bench |

四个都是相同配方的变体：生成器加评估器，循环。差异在于评估器评分的内容及其严谨程度。

## 使用

`code/main.py` 在玩具符号回归问题上实现一个最小的 AlphaEvolve 风格循环。"LLM"是一个标准库代理，提出对计算目标函数的程序的小语法突变。"评估器"测量留出测试点上的均方误差。

观察：

- 最佳分数如何在世代中改进。
- MAP-elites 网格如何保持多样解决方案存活，使循环不会收敛到局部最小值。
- 移除留出测试（仅训练评估器）如何让循环 spectacularly 过拟合。

## 交付

`outputs/skill-evaluator-rigor-audit.md` 是在新领域考虑 AlphaEvolve 风格循环的前提条件：你的评估器是否实际捕捉你关心的失败？

## 练习

1. 运行 `code/main.py`。注意最佳分数轨迹。禁用留出评估器（标志 `--no-holdout`）并重新运行。量化过拟合。

2. 阅读 AlphaEvolve 论文第 3 节关于 MAP-elites 网格的内容。为新问题（例如编译器优化通道）设计一个保持搜索多样性的特征向量描述符。

3. 48 次乘法 4x4 结果在 56 年后改进了 Strassen 的 49-mul 界限。阅读论文附录 F 并用三句话解释为什么这个问题的评估器特别容易正确，以及为什么大多数领域不像它。

4. 提出一个 AlphaEvolve 会失败的领域。准确识别评估器在哪里崩溃以及为什么。

5. 对于你知道的一个领域，写下你会使用的评估器签名。包括（a）正确性条件，（b）性能指标，（c）留出输入生成规则，（d）至少一个反奖励黑客检查。

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|---|---|---|
| AlphaEvolve | "DeepMind 的进化编码 agent" | Gemini + 程序数据库 + 机器可检查评估器 |
| MAP-elites | "保持多样性的档案" | 按特征向量键控的网格；每个单元格持有具有该描述符的最佳变体 |
| Island model | "并行进化子种群" | 定期迁移的独立种群；防止过早收敛 |
| Machine-checkable evaluator | "确定性预言机" | LLM 无法伪造的单元测试、模拟器或基准——此循环的前提条件 |
| Reward hacking | "优化度量，不是目标" | 循环找到一种最大化分数而不做预期任务的方式 |
| Seed program | "起点" | 循环从中进化的初始正确但次优程序 |
| Held-out evaluator | "LLM 从未见过的评估数据" | 评估时生成的输入以防止记忆 |

## 延伸阅读

- [Novikov 等 (2025). AlphaEvolve: A coding agent for scientific and algorithmic discovery](https://arxiv.org/abs/2506.13131) —— 完整论文。
- [DeepMind blog on AlphaEvolve](https://deepmind.google/blog/alphaevolve-a-gemini-powered-coding-agent-for-designing-advanced-algorithms/) —— 带结果的供应商撰写。
- [AlphaEvolve results repository](https://github.com/google-deepmind/alphaevolve_results) —— 发现的算法，包括 48-mul 4x4 matmul。
- [Romera-Paredes 等 (2023). Mathematical discoveries from program search with LLMs (FunSearch)](https://www.nature.com/articles/s41586-023-06924-6) —— 前身系统。
- [Anthropic — Responsible Scaling Policy v3.0 (2026 年 2 月)](https://anthropic.com/responsible-scaling-policy/rsp-v3-0) —— 将评估器约束自主性框架为关键研究方向。