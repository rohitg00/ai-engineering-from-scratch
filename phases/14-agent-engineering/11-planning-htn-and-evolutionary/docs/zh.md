# 用 HTN 与进化搜索做规划（Planning with HTN and Evolutionary Search）

> 译注：本文译自同目录 [`en.md`](./en.md)。术语遵循仓根 [TRANSLATION_GUIDE.md](../../../../TRANSLATION_GUIDE.md)。

> 符号化规划负责那些「计划可被证明正确」的场景。进化式代码搜索负责那些「fitness function（适应度函数）可被机器校验」的场景。ChatHTN（2025）和 AlphaEvolve（2025）分别展示了这两条路线在搭配 LLM 之后能解锁什么。

**Type:** Build
**Languages:** Python (stdlib)
**Prerequisites:** Phase 14 · 02 (ReWOO and Plan-and-Execute)
**Time:** ~75 minutes

## 学习目标（Learning Objectives）

- 解释 Hierarchical Task Networks（层级任务网络）：tasks、methods、operators、preconditions、effects。
- 描述 ChatHTN 的混合循环——以符号搜索为主、LLM 作为兜底分解。
- 解释 AlphaEvolve 的进化循环，以及为什么它只在拥有可程序化评估器（programmatic evaluator）时才奏效。
- 用 stdlib 实现一个玩具版 HTN planner 加一个玩具版进化搜索。

## 问题（The Problem）

ReWOO（第 02 课）、Plan-and-Execute、ReAct 已经覆盖了 agent 规划的大多数情形。但有两种情形它们处理得不好：

1. **可证明正确的计划。** 排程、航线规划、合规工作流——计划必须在结构上就是 sound（可靠）的。一个偶尔会 hallucinate（幻觉）一步的、行文流畅的 LLM 计划，在这里是不可接受的。
2. **带有可机器校验的 fitness function 的优化问题。** 矩阵乘法、调度启发式、编译器 pass——目标不是「一个正确的计划」，而是「最好的计划」。

HTN 规划和 AlphaEvolve 分别解决这两种不同的问题。两者都把 LLM 当作放大器，而不是替代品。

## 概念（The Concept）

### 层级任务网络（Hierarchical Task Networks）

一个 HTN 由以下要素组成：

- **Tasks**——分为 compound（复合，需要被分解）和 primitive（原子，可直接执行）。
- **Methods**——把一个 compound task 分解成若干子任务的方式，带 preconditions（前置条件）。
- **Operators**——原子动作，带 preconditions 与 effects（效果）。
- **State**——一组事实（facts）的集合。

规划过程：给定一个目标任务和一个初始状态，找到一个分解，使其原子 operator 的 preconditions 按顺序依次被满足。

HTN 比 LLM 出现得更早，并且在「可证明正确的计划」这件事上至今仍是参考标准。

### ChatHTN（Gopalakrishnan 等，2025）

ChatHTN（arXiv:2505.11814）把符号化的 HTN 与 LLM 查询交织在一起：

1. 试着用现有的 methods 分解当前的 compound task。
2. 如果没有 method 适用，就问 LLM：「在状态 `s` 下，你会怎么分解 `task`？」
3. 把 LLM 的回答翻译成候选子任务。
4. 拿 operator schema 去校验；不合法的分解直接拒掉。
5. 递归。

论文的核心论点是：每一个被生成出来的计划都是 provably sound（可证明可靠）的，因为 LLM 的建议只能以「候选分解」的身份进入流程，永远不能直接编辑计划。正确性由符号层负责；LLM 负责扩展 method 库。

在线 method 学习（OpenReview `gwYEDY9j2x`，2025 年的后续工作）在此基础上加了一个 learner，通过回归把 LLM 产出的分解泛化出来——能把 LLM 查询频率削减最多 75%。

### AlphaEvolve（Novikov 等，2025）

AlphaEvolve（arXiv:2506.13131，DeepMind，2025 年 6 月）是另一只野兽：由 Gemini 2.0 Flash/Pro 集成（ensemble）调度的进化式代码搜索。

循环：

1. 从一个种子程序 + 一个程序化评估器（返回 fitness 分数）出发。
2. LLM 集成提出突变（mutations）。
3. 把突变跑过评估器。
4. 留下最好的；继续突变。

已发表的成果：

- 在 4x4 复矩阵乘法上 56 年来首次超过 Strassen 算法（48 次标量乘法）。
- 在 Google 内部用一个 Borg 调度启发式回收了 0.7% 的算力。
- 在前沿工作负载上把 FlashAttention 加速了 32%。

硬性约束：fitness function 必须可被机器校验。在散文式答案上跑进化搜索是不会收敛的。

### 什么时候用哪个

| 问题类别 | 用什么 | 为什么 |
|---------------|-----|-----|
| 带硬约束的排程 | HTN + ChatHTN | 可证明 soundness |
| 编译器优化 | AlphaEvolve | fitness 可被机器校验 |
| 多步任务执行 | ReAct / ReWOO | LLM 在循环里，没有形式化保证 |
| 带测试用例的代码改进 | AlphaEvolve | 测试就是评估器 |
| 受策略约束的自动化 | HTN | preconditions 把策略编码了进去 |

### 这套模式什么时候会出问题

- **没有 operators 的 HTN。** 没有 precondition/effect schema，soundness 论断就垮了。ChatHTN 那套「LLM 提议分解」是建立在 schema 能拒掉非法动作的前提上的。
- **没有真正评估器的 AlphaEvolve。**「问 LLM 这段代码是不是更好」算不上一个 fitness function。评估器必须是确定性且快速的。
- **过度工程化。** 大多数 agent 任务这两套都用不上。先伸手去拿 ReAct 或 ReWOO。

## 动手实现（Build It）

`code/main.py` 实现了两个玩具：

- 一个 stdlib HTN planner，带 operators、methods、preconditions、effects，以及一个在没有 method 匹配 compound task 时介入的 `LLMFallback`。这里的「LLM」是一个脚本化的 decomposer，所以 planner 可以离线跑。
- 一个 stdlib 上的进化搜索，搜索算术程序：让生成的表达式在测试集上最小化 `|f(x) - target|`。评估器是确定性的。

跑起来：

```
python3 code/main.py
```

trace 会展示 HTN planner 分解一个 compound task 的过程（中途有一次 LLM 兜底），以及进化循环收敛到目标表达式的过程。

## 用起来（Use It）

- **HTN planners**——`pyhop`、`SHOP3`，或者为领域特定的策略执行自己造一个。
- **ChatHTN**——研究代码；这套模式（symbolic + LLM fallback）可以干净地移植到任何 HTN planner 上。
- **AlphaEvolve**——DeepMind 的论文；这套模式（ensemble + evaluator）是可复现的。OpenEvolve 等开源 fork 正在涌现。
- **Agent 框架**——目前还没有任何框架把 HTN 或 AlphaEvolve 作为一等公民出厂。把它做成一个 subagent 或后台 worker。

## 上线部署（Ship It）

`outputs/skill-hybrid-planner.md` 会生成一个混合 planner 的脚手架（HTN 或进化式），并明确划定了 LLM 的角色边界。

## 练习（Exercises）

1. 给 HTN planner 加上回溯：当一个 operator 的 postcondition 在运行时失败，回滚并尝试下一个 method。
2. 给 ChatHTN 加一个 LLM-method 缓存：当 LLM 在状态模式 `P` 下分解了任务 `T`，把结果存下来。下次先去 method 库里查。
3. 把进化搜索的评估器换成一个真的测试套件。进化出一个能通过 20 个测试用例的排序函数；汇报达到收敛所需的代数（generations）。
4. 读 AlphaEvolve 关于评估器设计的备注。给一个你在乎的领域设计评估器（SQL 查询优化、测试套件最小化、部署 YAML）。
5. 组合起来：用 HTN 把一个 compound task 分解成子任务，然后对每个子任务的原子 operator 跑进化搜索。它在哪里发光，又在哪里属于过度工程？

## 关键术语（Key Terms）

| Term | 大家嘴上的说法 | 它实际的意思 |
|------|----------------|------------------------|
| HTN | 「层级 planner」 | 带 operators、preconditions、effects 的任务分解 |
| Method | 「分解规则」 | 把一个 compound task 拆成子任务的方式 |
| Operator | 「原子动作」 | 带 precondition 和 effect 的具体步骤 |
| ChatHTN | 「LLM + HTN」 | 当没有 method 匹配时，符号 planner 去问 LLM |
| AlphaEvolve | 「进化式代码搜索」 | LLM 集成对代码做突变；确定性评估器做选择 |
| Fitness function | 「评估器」 | 在输出上的、确定性、可机器校验的打分 |
| Online method learning | 「缓存住的 LLM 分解」 | 把 LLM 的计划存下来并泛化，以削减查询成本 |

## 延伸阅读（Further Reading）

- [Gopalakrishnan et al., ChatHTN (arXiv:2505.11814)](https://arxiv.org/abs/2505.11814)——符号 + LLM 的混合 planner
- [Novikov et al., AlphaEvolve (arXiv:2506.13131)](https://arxiv.org/abs/2506.13131)——LLM 突变驱动的进化式代码搜索
- [Anthropic, Building Effective Agents](https://www.anthropic.com/research/building-effective-agents)——什么时候应该伸手去拿 planner，而不是一个简单的循环
