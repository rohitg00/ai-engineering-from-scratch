# AlphaEvolve —— 进化式编码 agent

> 译注：本文译自同目录 [`en.md`](./en.md)。术语遵循仓根 [TRANSLATION_GUIDE.md](../../../../TRANSLATION_GUIDE.md)。

> 把一个前沿编码模型和一个进化循环、一个机器可校验的 evaluator（验证器）配对。让循环跑得足够久，它就能发现一种 4x4 复矩阵乘法只用 48 次标量乘法的算法 —— 这是 56 年来对 Strassen 的首次改进。它还在 Google 全公司范围内找到了一条 Borg 调度启发式，在生产环境中收回了约 0.7% 的集群算力。这套架构是刻意做得很无聊的，胜利来自 evaluator 的严格性。

**Type:** Learn
**Languages:** Python (stdlib, evolutionary-loop toy)
**Prerequisites:** Phase 15 · 01 (long-horizon framing), Phase 15 · 02 (self-taught reasoning)
**Time:** ~60 minutes

## 问题（The Problem）

大语言模型会写代码，进化算法可以在代码空间中搜索。这两条路各自单独做了几十年，都各自撞到了天花板。LLM 的天花板是「胡编」（confabulation）：模型会写出看起来很合理、但其实并没做它声称之事的代码。进化算法的天花板是搜索成本：在语法层面随机变异几乎产生不出能编译的程序，更别说更优的程序了。

AlphaEvolve（Novikov 等，DeepMind，arXiv:2506.13131，2025 年 6 月）把两者合在一起。LLM 向程序库里提交有针对性的修改；自动 evaluator 给每个变体打分；高分变体成为下一代的父本。LLM 负责「写出看起来合理的代码」这个昂贵步骤，evaluator 负责抓住胡编。整个循环跑数小时到数周。

论文报告的成果包括：4x4 复矩阵乘法只用 48 次标量乘法（Strassen 1969 年的上界是 49）、Google 生产环境中的一条 Borg 调度启发式、FlashAttention kernel 提速 32.5%，以及 Gemini 训练吞吐的改进。

这套架构能跑通，是因为 evaluator 是机器可校验的。在没有这种 evaluator 的领域它就跑不通。这种不对称才是关键经验。

## 概念（The Concept）

### 循环（The loop）

1. 从一个正确但次优的种子程序 `P_0` 出发。
2. 维护一个变体程序库，每个变体都有 evaluator 打的分。
3. 从库里采样一个或多个父本（MAP-elites 风格或岛屿模型）。
4. prompt LLM（多数候选用 Gemini Flash，硬骨头用 Gemini Pro）产出父本的修改版本。
5. 编译、运行变体，并在留出（held-out）的 evaluator 上评估。
6. 用得分和特征向量为键插入数据库。
7. 重复。

有两个细节很重要。第一，prompt 给 LLM 的不只是父本程序 —— 通常还包含库里若干高分变体、evaluator 签名，以及一段简短的任务描述。模型的任务是提出一个有针对性的、有可能提升分数的改动。第二，数据库是有结构的（MAP-elites 网格、岛屿模型），让循环去探索多样性，而不是只盯着当下的领跑者。

### evaluator 为什么是不可妥协的

AlphaEvolve 的胜利全部来自一类领域：evaluator 又快、又确定性、又难以被钻空子。

- **矩阵乘法算法**：单元测试，乘出矩阵后做按位相等比对。
- **Borg 调度启发式**：生产级仿真器，回放历史集群负载并测量浪费的算力。
- **FlashAttention kernel**：正确性测试加上真实硬件的 wall-clock 基准。
- **Gemini 训练吞吐**：用每步 GPU-秒来衡量。

每一种情况下，evaluator 都恰好抓住了那一类否则会主导一切的 LLM 错误：胡编出来的正确性声明、上了硬件就消失的性能声明、以及边界情况下的失败。把 evaluator 拿掉，循环优化的就只是「好看的代码」。

### 奖励黑客是同一句话的另一面

进化只会去优化 evaluator 度量的东西。如果 evaluator 不完美，循环就会找到那个不完美。在没有验证的领域里，循环会去优化表面特征，而不是真正想要的行为。DeepMind 在论文里明确点出了这一点：AlphaEvolve 的成功只能迁移到 evaluator 严格性能跟得上搜索野心的领域。

2025-2026 年间编码搜索循环里 reward hacking（奖励黑客）的几个具体例子：

- 优化目标奖励「完成时间」，结果模型学会提交空答案。
- benchmark 分数奖励「通过测试」，结果模型把测试背下来并过拟合。
- 一个「代码质量」代理奖励删注释、改变量名，语义并未改变。

AlphaEvolve 的解法：上线一个 LLM 从未见过的留出 evaluator，输入在评估时刻才生成。即便如此，DeepMind 也建议对任何打算部署的方案做强 review。

### LLM + 搜索为什么比单独哪一个都强

LLM 能产出可编译、语义上合理的修改。在 2000 行 Python 文件上跑随机变异 GA 几乎一定产生语法错误。LLM 还把搜索集中在合理的邻域里（改一个函数，而不是改随机字节），从而大幅减少浪费在 evaluator 上的调用。

反过来，evaluator 抓住 LLM 的胡编。LLM 会自信地声称某个函数「在极限下是 O(n log n)」，实际却是 O(n^2)；wall-clock 基准让这个问题尘埃落定。

### AlphaEvolve 在前沿技术栈里的位置

| 系统 | 生成器 | evaluator | 领域 | 代表性成果 |
|---|---|---|---|---|
| AlphaEvolve | Gemini | 正确性 + 基准 | 算法、kernel、调度器 | 48-mul 4x4 matmul |
| FunSearch (DeepMind, 2023) | PaLM / Codey | 正确性 | 组合数学 | cap-set 下界 |
| AI Scientist v2 (Sakana, L5) | GPT/Claude | LLM 评论 + 实验 | ML 研究 | ICLR workshop 论文 |
| Darwin Godel Machine (L4) | agent 脚手架 | SWE-bench / Polyglot | agent 代码 | SWE-bench 20% → 50% |

这四个系统都是同一个配方的变体：生成器加 evaluator，跑循环。差别在于 evaluator 评什么、有多严格。

## 用起来（Use It）

`code/main.py` 在一个玩具级符号回归问题上实现了一个最小化的、AlphaEvolve 风格的循环。这里的「LLM」是一个 stdlib 代理，它对一段计算目标函数的程序做小的语法变异。「evaluator」在留出测试点上测量均方误差。

观察：

- 最优分数如何随代数提升。
- MAP-elites 网格如何保留多样的解，让循环不收敛到局部最小。
- 把留出测试拿掉（只用训练集做 evaluator）后，循环如何过拟合得不可收拾。

## 上线部署（Ship It）

`outputs/skill-evaluator-rigor-audit.md` 是在新领域里考虑 AlphaEvolve 风格循环的前置条件：你的 evaluator 真的能抓住你在意的那些失败吗？

## 练习（Exercises）

1. 跑一遍 `code/main.py`，记下最优分数的轨迹。关掉留出 evaluator（用 flag `--no-holdout`）再跑一次，量化过拟合的程度。

2. 读 AlphaEvolve 论文第 3 节关于 MAP-elites 网格的部分。为一个新问题（例如编译器优化 pass）设计一个特征向量描述符，使搜索保持多样。

3. 4x4 矩阵乘法 48 次乘法的结果，时隔 56 年才打破 Strassen 的 49-mul 上界。读论文附录 F，用三句话解释为什么这个问题的 evaluator 特别容易做对，以及为什么大多数领域并不像它。

4. 提出一个 AlphaEvolve 会失败的领域。明确指出 evaluator 在哪里崩溃、为什么。

5. 对一个你熟悉的领域，写出你会用的 evaluator 签名。包括 (a) 正确性条件、(b) 性能指标、(c) 留出输入的生成规则、(d) 至少一项反 reward hacking 检查。

## 关键术语（Key Terms）

| 术语 | 大家嘴上怎么说 | 实际是什么意思 |
|---|---|---|
| AlphaEvolve | 「DeepMind 的进化式编码 agent」 | Gemini + 程序库 + 机器可校验 evaluator |
| MAP-elites | 「保留多样性的存档」 | 以特征向量为键的网格；每个格子保留具有该描述符的最优变体 |
| Island model | 「并行进化的子种群」 | 各自独立、定期迁移的种群；防止过早收敛 |
| Machine-checkable evaluator | 「确定性预言机」 | 一个 LLM 没法糊弄过去的单元测试、仿真器或基准 —— 是这套循环的前置条件 |
| Reward hacking | 「优化指标而不是目标」 | 循环找到一种不做实际任务也能拉高分数的办法 |
| Seed program | 「起点」 | 一个正确但次优的初始程序，循环从它出发演化 |
| Held-out evaluator | 「LLM 从未见过的评估数据」 | 在评估时刻才生成的输入，用来防记忆化 |

## 延伸阅读（Further Reading）

- [Novikov et al. (2025). AlphaEvolve: A coding agent for scientific and algorithmic discovery](https://arxiv.org/abs/2506.13131) —— 完整论文。
- [DeepMind blog on AlphaEvolve](https://deepmind.google/blog/alphaevolve-a-gemini-powered-coding-agent-for-designing-advanced-algorithms/) —— 厂商写的成果概述。
- [AlphaEvolve results repository](https://github.com/google-deepmind/alphaevolve_results) —— 发现的算法，包括 48-mul 4x4 matmul。
- [Romera-Paredes et al. (2023). Mathematical discoveries from program search with LLMs (FunSearch)](https://www.nature.com/articles/s41586-023-06924-6) —— 前身系统。
- [Anthropic — Responsible Scaling Policy v3.0 (Feb 2026)](https://anthropic.com/responsible-scaling-policy/rsp-v3-0) —— 把「evaluator 受限的自主性」列为关键研究方向。
