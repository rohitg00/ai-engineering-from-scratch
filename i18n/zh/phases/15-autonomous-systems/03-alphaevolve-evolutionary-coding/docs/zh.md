# 进化编码代理

> 结合一个边界编码模型,一个进化循环和一个可机器检查的评估器. 让循环足够长. 它发现了4x4复杂矩阵乘法程序,使用48个 skalar乘法,这是在56年来第一次改善Strassen. 它还发现了谷歌范围内的Borg计划测量, 建筑是故意无聊的. 获胜来自评审员的严谨性.

**Type:** Learn
**Languages:** Python, TypeScript (stdlib, evolutionary-loop toy)
**Prerequisites:** Phase 15 · 01 (long-horizon framing), Phase 15 · 02 (self-taught reasoning)
**Time:** ~60 minutes

## 问题

语言模型可以写代码.进化算法可以搜索代码.这两种代码都已经被单独尝试了几十年;两种都达到顶层.LLM的顶层是论:模型写出可靠的代码,但它不做它声称的.进化天花板是搜索成本:语法上的随机突变很少产生编译的程序,更不用说更好的程序.

专业知识研究 (LLC) 提出了针对性的编辑程序数据库;一个自动评估器评分每个变体;高分变体成为未来代人的父母.专业知识研究处理了可信代码编写的昂贵步骤;评估员捕获了论.循环持续数小时到几周.

结果报告:48级乘法4x4复杂矩阵乘法 (斯特拉森1969年限为49),谷歌生产中的博格计划论,FlashAttention内核增速32.5%,双子座训练吞吐量改进.

建筑是因为评估器是机器检查的,它不在评估器没有的地方工作.

## 概念

### 循环

1. 开始从种子计划开始`P_0`这正确,但不太理想.
2. 保持变种程序的数据库,每个程序由评价者评分.
3. 从数据库中取出一个或多个父母的样本 (MAP精英类型或岛屿类型).
4. 要求士 (许多候选人是双子闪光,硬的双子Pro) 制造父母的修改版本.
5. 编译,运行和评估在持久的评估器上的变体.
6. 按其分数和特征向量键入数据库.
7. 复制.

首先,LLM需要更多的数据库,加上评估者签名,加上简短的任务描述.模型的工作是提出一个有针对性的变化,可能会改善得分.第二,数据库结构化 (MAP精英网格,基于岛屿) 因此循环探索多样性,而不仅仅是当前领导者.

### 评价者是什么不可以谈判的

们都在一个快速,决定性和难以玩的领域中获胜:

- **Matrix multiplication algorithm**测试单位测试,乘以矩阵并检查等式的比特相同.
- **Borg scheduling heuristic**产品级模拟器,可重复历史集群负载,并测量浪费计算.
- **FlashAttention kernel**实用硬件的墙钟基准.
- **Gemini training throughput**测量每步的GPU秒.

在每个情况下,评估员发现了其他类型的LLM错误:假设的正确性要求,硬件上消失的性能要求和边缘故障.

### 奖励黑客是这一说法的另一面

进化优化了评估者所测量的一切.如果评估者不完美,循环会发现不完美.在未经验证的域中,循环会优化了表面特征,而不是预期的行为.深思论文明确指出:AlphaEvolve的成功只转移到评估者的严格匹配搜索的野心的域.

具体的2025-2026年奖励黑客在代码搜索循环中:

- 优化目标,以"完成时间"为回报,
- 基准分数是奖励正确性在测试中奖励的记忆测试和过度匹配.
- 代码质量代理将删除评论和重写变量名称,

对于"阿尔法发达"的解决方案:将一个经过审批的评估员发送到法师从未见过,在评估时产生的输入.

### 为什么LLM+搜索单独击败

专业知识学士可以产生可编译,语义上可行的修改.在2000行Python文件上的随机突变GA几乎总是产生语法错误.专业知识学士还集中在可行的邻居 (改变一个函数,而不是随机字节) 上搜索,这大大减少了浪费的评估者调用.

评价者反过来会发现LLM的论.LLM将自信地声称一个功能"是$O(n \log n)$实际上,$O(n^2)$墙钟的基准使问题得到解决.

### 在边境堆中,AlphaEvolve可以适合

| System | Generator | Evaluator | Domain | Example win |
|---|---|---|---|---|
| AlphaEvolve | Gemini | correctness + benchmark | algorithms, kernels, schedulers | 48-mul 4x4 matmul |
| FunSearch (DeepMind, 2023) | PaLM / Codey | correctness | combinatorial math | cap-set lower bounds |
| AI Scientist v2 (Sakana, L5) | GPT/Claude | LLM critique + experiment | ML research | ICLR workshop paper |
| Darwin Godel Machine (L4) | agent scaffolding | SWE-bench / Polyglot | agent code | 20% → 50% SWE-bench |

它们都是相同的配方的变化:生成器加值器,循环.

```figure
alphaevolve-loop
```

## 用它

`code/main.py`对于玩具的符号回归问题,它实现了最小的AlphaEvolve类似循环. "LLM"是一个stdlib代理,它为计算目标函数的程序提出了小的语法突变. "评估器"的测量意味着在保留的测试点上出现的二次错误.

观察:

- 如何在几代人中得到最佳成绩.
- 如何让各种解决方案保持活力,使循环不到当地最低点.
- 如何将延续的测试 (仅进行训练的评估者) 移除使循环非常适合.

## 运送它

`outputs/skill-evaluator-rigor-audit.md`在一个新领域考虑一个AlphaEvolve样式的循环的前提是:你的评估员是否真的能发现你关心的失败?

## 运动

1. 跑步`code/main.py`除置评器 (旗)`--no-holdout`量化过度适应.

2. 阅读MAP精英格格的AlphaEvolve论文第3节.为一个新的问题 (例如编译器优化通过) 设计一个特征向量描述符,使搜索保持多样性.

3. 读取论文的附录F,并用三句话解释为什么对这个问题的评估器特别容易得到正确,以及为什么大多数领域不像它.

4. 提出一个领域, AlphaEvolve 失败,确定评估者在哪里断裂,以及为什么.

5. 对于您所熟悉的域名,请写出您将使用的评估器签名.包括 (a) 准确性条件, (b) 性能指标, (c) 持久的输入生成规则, (d) 至少一个反奖励黑客检查.

## 关键词

| Term | What people say | What it actually means |
|---|---|---|
| AlphaEvolve | "DeepMind's evolutionary coding agent" | Gemini + program database + machine-checkable evaluator |
| MAP-elites | "Diversity-preserving archive" | Grid keyed by feature vectors; each cell holds the best variant with that descriptor |
| Island model | "Parallel evolution subpopulations" | Independent populations that migrate periodically; prevents premature convergence |
| Machine-checkable evaluator | "Deterministic oracle" | A unit test, simulator, or benchmark the LLM cannot fake — a prerequisite for this loop |
| Reward hacking | "Optimizing the measure, not the goal" | Loop finds a way to maximize score without doing the intended task |
| Seed program | "The starting point" | An initial correct-but-suboptimal program the loop evolves from |
| Held-out evaluator | "Evaluation data the LLM never saw" | Inputs generated at evaluation time to prevent memorization |

## 进一步阅读

- [Novikov et al. (2025). AlphaEvolve: A coding agent for scientific and algorithmic discovery](https://arxiv.org/abs/2506.13131)完整的报纸.
- [DeepMind blog on AlphaEvolve](https://deepmind.google/blog/alphaevolve-a-gemini-powered-coding-agent-for-designing-advanced-algorithms/) 供应商的报表,结果.
- [AlphaEvolve results repository](https://github.com/google-deepmind/alphaevolve_results)发现算法,包括48-mul 4x4matmul.
- [Romera-Paredes et al. (2023). Mathematical discoveries from program search with LLMs (FunSearch)](https://www.nature.com/articles/s41586-023-06924-6)前任系统.
- [Anthropic — Responsible Scaling Policy v3.0 (Feb 2026)](https://anthropic.com/responsible-scaling-policy/rsp-v3-0)将评估者自主化作为一个关键的研究方向.
