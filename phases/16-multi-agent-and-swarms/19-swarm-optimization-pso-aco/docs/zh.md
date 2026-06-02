# 面向 LLM 的群体优化（PSO、ACO）

> 译注：本文译自同目录 [`en.md`](./en.md)。术语遵循仓根 [TRANSLATION_GUIDE.md](../../../../TRANSLATION_GUIDE.md)。

> 受生物启发的优化方法正在 LLM 领域回潮。**LMPSO**（arXiv:2504.09247）把 PSO 用在 prompt 上：每个粒子的速度是一段 prompt，由 LLM 生成下一候选；在结构化序列输出（数学表达式、程序）上表现不错。**Model Swarms**（arXiv:2410.11163）把每个 LLM 专家看作模型权重 manifold（流形）上的一个 PSO 粒子，在 9 个数据集上仅用 200 个样本就在 12 个 baseline 上取得 **平均 13.3% 的提升**。**SwarmPrompt**（ICAART 2025）把 PSO 与 Grey Wolf 杂交起来做 prompt 优化。**AMRO-S**（arXiv:2603.12933）则把 ACO 启发的信息素专家用于多 agent LLM 路由——**4.7 倍加速**、可解释的路由证据、质量门控的异步更新让推理与学习解耦。本课在 prompt 参数空间上实现 PSO，在 agent 路由上实现 ACO，量化为什么这些经典算法在 LLM 时代仍然合用，以及什么时候不合用。

**Type:** Learn + Build
**Languages:** Python (stdlib)
**Prerequisites:** Phase 16 · 09 (Parallel Swarm Networks), Phase 16 · 14 (Consensus and BFT)
**Time:** ~75 minutes

## 问题（Problem）

你有一段 prompt，在任务评测上得 62%。你想把它做得更好。最朴素的做法是无梯度的人工调参，扩展性极差。强化学习需要奖励信号和足够多的 rollout 才能训练。对 prompt 做反向传播又基本不可行——prompt 是离散字符串，不是可微参数。

经典的生物启发优化——PSO 用于连续搜索空间，ACO 用于路径选择——正是为这种场景而生：无梯度、基于种群、单次评估开销低。把它们和 LLM 结合，让 LLM 担任无梯度搜索那一步，你会拿到一个意外好用的优化器。

同样的套路也适用于多 agent 系统中的 *路由*。一个 ACO 风格的信息素轨迹可以记录哪个 agent 在哪种任务类型上做得最好，让路由器利用这条轨迹，并通过信息素衰减让路由可以被重新发现。

## 概念（Concept）

### PSO 速览（Kennedy & Eberhart 1995）

粒子群优化（Particle Swarm Optimization）：一群粒子分布在连续搜索空间中。每个粒子有位置 `x_i` 和速度 `v_i`。每轮迭代：

```
v_i <- w * v_i + c1 * r1 * (p_best_i - x_i) + c2 * r2 * (g_best - x_i)
x_i <- x_i + v_i
evaluate fitness(x_i)
update p_best_i if improved
update g_best if global best
```

其中 `p_best` 是粒子自身找到的最优解，`g_best` 是整个 swarm 的全局最优，`w, c1, c2` 分别是惯性、认知、社交权重，`r1, r2` 是随机因子。

### 在 LLM 输出上做 PSO —— LMPSO

arXiv:2504.09247 把 PSO 适配到 LLM 生成的结构化输出（数学表达式、程序）上。每个粒子是一个候选输出。速度是一段 *prompt*，描述如何把当前输出朝个体最优 / 全局最优方向修改。LLM 根据这段速度 prompt 生成新的输出。速度的「惯性」是一段类似「只做小幅渐进修改」的 prompt。

适用场景：

- 输出是结构化的（可解析、可评估）。
- fitness 可自动计算（跑测试、做算术求值）。
- 种群较小（约 10–30 个粒子），LLM 调用总量可控。

不适用场景：fitness 需要人工审核——单轮成本会高到不可承受。

### Model Swarms

arXiv:2410.11163 把 PSO 从输出层搬到 *模型* 层。每个「粒子」是一个专家 LLM（参数）。swarm 通过无梯度更新把参数朝集体最优移动。报告：在 9 个数据集上对 12 个 baseline 取得 13.3% 的平均提升，每轮迭代仅用 200 个样本。

关键洞见在于，LLM 专家模型本来就处在一个共享参数 manifold 上彼此邻近（adapter 权重、LoRA delta）。在这个低维子空间里跑 PSO 既便宜又有效。

### ACO 速览（Dorigo 1992）

蚁群优化（Ant Colony Optimization）：蚂蚁在图上行走；每条路径上有一道信息素轨迹。蚂蚁的移动概率按信息素强度加权。完成任务的蚂蚁会按解的质量比例释放信息素。信息素随时间衰减。

### AMRO-S —— 用 ACO 做 agent 路由

arXiv:2603.12933 把 ACO 用于多 agent 路由。每种任务类型是一个「目的地」；每个 agent 是一条候选路线。信息素强化那些产出好结果的路由。主要贡献：

- **可解释的路由证据。** 信息素强度本身就是人类可读的信号。
- **质量门控的异步更新。** 信息素只有在质量检查通过后才更新，从而让推理与学习解耦。
- **在多 agent 路由 benchmark 上 4.7 倍加速。**

质量门控很关键：没有它，「快但错」的 agent 会持续累积信息素，系统会被锁死在错误路由上。

### 什么时候在 LLM 上用 PSO / ACO

**用 PSO 的时机：**

- 搜索空间是连续的，或可映射到连续参数（prompt embedding、LoRA 权重、数值生成参数）。
- fitness 便宜且可自动计算。
- 种群可以很小（10–30）。

**用 ACO 的时机：**

- 你有一个路由或路径选择问题。
- 决策会随时间被强化（同类任务会反复出现）。
- 你需要可解释的路由依据。

**两者都不该用的时候：**

- fitness 需要人工审核（每轮成本太高）。
- 搜索空间是离散且组合性的，PSO 覆盖不到（改用遗传算法）。
- 实时决策有严格延迟要求（PSO/ACO 收敛比单次启发式慢得多）。

### 为什么生物启发方法仍能赢

基于梯度的方法需要可微信号。LLM 输出和路由决策都不是天然可微的。伪梯度方法（强化学习训练的路由器、DPO 风格的 prompt 调优器）能用，但训练昂贵。

PSO 和 ACO 只需要一个 *评估器* 函数。只要你能给候选输出或路由决策打分，就能在该空间上做优化。这把适用门槛压得很低。

### 实践边界

- **种群预算。** N 个粒子 × T 轮迭代 × 单次评估成本。LLM 评估按约 0.02 美元 / 次算，20 个粒子的 PSO 跑 50 轮约 20 美元。要按这个量级做规划。
- **探索 vs 利用。** 信息素衰减率与 PSO 惯性是一个 trade-off；衰减太快 → 忘掉好解；太慢 → 卡在早期局部最优。
- **灾难性漂移。** 当 fitness 地形改变时（新的数据分布），两种算法都可能先收敛再发散。要监控最优 fitness 的稳定性。

## 动手实现（Build It）

`code/main.py` 实现了：

- `LMPSO` —— 在数值 prompt 参数（temperature、top_k 权重）上跑 PSO。每个粒子的「LLM 生成」用一个脚本化的 fitness 函数模拟。算法跑 30 轮，展示 g_best 的收敛过程。
- `AMRO_S` —— ACO 风格的路由。3 个 agent、4 种任务类型、一张信息素矩阵、100 条被路由的任务。打印 (task_type → agent 选择) 随时间的分布，展示轨迹的形成过程。
- 对比：在同一任务流上比较随机路由和 ACO 路由。度量质量和延迟。

运行：

```
python3 code/main.py
```

预期输出：

- LMPSO：g_best fitness 在 30 轮内从随机水平改善到接近最优。
- AMRO-S：信息素表稳定在每种 task-type 下的合适 agent 上；ACO 路由在质量上比随机路由高出约 30–40%，同时也降低延迟（重试次数变少）。

## 用起来（Use It）

`outputs/skill-swarm-optimizer.md` 帮助你在 PSO、ACO、遗传算法和基于梯度的优化器之间，为 LLM / agent 优化问题做选择。

## 上线部署（Ship It）

- **先做小。** 10–20 个粒子、20–50 轮迭代。只有在收敛曲线显示明显增益时再扩大规模。
- **每轮记录信息素或 g_best。** 没有轨迹去 debug 群体优化器是非常痛苦的。
- **更新做质量门控。** 对 ACO 路由尤其重要：「快但错」的 agent 绝不能累积信息素。
- **分布漂移时重置衰减。** 评测分布变了，老的信息素就过期了；要么重置，要么暂时把衰减率翻倍。
- **限定每轮成本上限。** 暴露一个「每轮成本」指标。一个每轮 500 美元只换来 0.5% 增益的 PSO 是没法上线的。

## 练习（Exercises）

1. 跑 `code/main.py`，观察 LMPSO 的收敛。把种群规模分别设为 5、10、20、50。在哪个规模下「收敛时间」开始饱和？
2. 实现一个「灾难性漂移」实验：在第 30 轮之后改动 fitness 函数。PSO 适应得多快？重置 `p_best` 有帮助吗？
3. 给 AMRO-S 加上质量门控：只在 eval 分数 > 0.7 的运行后释放信息素。和不带门控的版本比，收敛行为有什么变化？
4. 阅读 LMPSO（arXiv:2504.09247），把论文里「速度即 prompt」映射回你这里的数值速度。模拟里丢失了什么？又保留了什么？
5. 阅读 AMRO-S（arXiv:2603.12933），实现解耦的「推理快路径」+ 信息素异步更新。在持续负载下，这会如何改变系统延迟？

## 关键术语（Key Terms）

| 术语 | 大家挂在嘴上的说法 | 它真正的意思 |
|------|----------------|------------------------|
| PSO | "Particle Swarm Optimization" | Kennedy-Eberhart 1995。基于种群的无梯度优化器。 |
| ACO | "Ant Colony Optimization" | Dorigo 1992。基于信息素轨迹的路径 / 路由优化。 |
| LMPSO | "带 LLM 生成的 PSO" | arXiv:2504.09247。速度是 prompt，由 LLM 产出候选。 |
| Model Swarms | "在专家权重上跑 PSO" | arXiv:2410.11163。在模型参数子空间做无梯度更新。 |
| AMRO-S | "用于 agent 路由的 ACO" | arXiv:2603.12933。task-type × agent 上的信息素矩阵。 |
| p_best / g_best | "个体 / 全局最优" | 单粒子和整个 swarm 迄今找到的最优解。 |
| Pheromone | "路由记忆" | 边上的强度；随时间衰减；按质量释放。 |
| Quality-gated update | "只从好运行里学习" | 信息素的释放以质量检查通过为条件。 |
| Catastrophic drift | "分布漂移" | fitness 地形改变；旧的 p_best 和信息素全部过期。 |

## 延伸阅读（Further Reading）

- [Kennedy & Eberhart — Particle Swarm Optimization](https://ieeexplore.ieee.org/document/488968) —— 1995 年的 PSO 原始论文
- [Dorigo — Ant Colony Optimization](https://www.aco-metaheuristic.org/about.html) —— 1992 年的 ACO 奠基工作
- [LMPSO — Language Model Particle Swarm Optimization](https://arxiv.org/abs/2504.09247) —— 用于结构化 LLM 输出的 PSO
- [Model Swarms — gradient-free LLM expert optimization](https://arxiv.org/abs/2410.11163) —— 在模型权重子空间做 PSO
- [AMRO-S — ant-colony multi-agent routing](https://arxiv.org/abs/2603.12933) —— 信息素驱动的路由 + 质量门控
