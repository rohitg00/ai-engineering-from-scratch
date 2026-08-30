---
name: swarm-optimizer
description: 为给定 LLM 或代理优化问题在 PSO、ACO、遗传算法和基于梯度的优化器之间进行选择。生物启发群体算法是无梯度的，适用于搜索空间离散或适应度函数为黑盒的 LLM 时代工作负载。
version: 1.0.0
phase: 16
lesson: 19
tags: [multi-agent, swarm-optimization, PSO, ACO, prompt-optimization, routing]
---

给定 LLM 或代理优化问题，选择正确的优化器。

生成：

1. **问题指纹。** 搜索空间（continuous numeric、prompt string、model weights、routing graph）、fitness signal（automatic test、LLM judge、human rater、business KPI）、time-to-value（minutes、hours、days）。
2. **优化器选择。** PSO、ACO、genetic algorithm、DPO/RL、manual tuning。每个都有默认用例：
   - bounded space 上的 continuous numeric → PSO
   - routing 或 path selection → ACO
   - discrete symbolic / programs → genetic algorithms
   - differentiable reward → DPO/RL
   - low-dimensional、fast eval → grid/random search
3. **种群规模。** PSO/GA 为 10-30，ACO 为 pheromone matrix size。预算计算：N × T × cost-per-eval。不要运行成本超过其产生价值的群体。
4. **Fitness + quality gate。** 什么函数为候选者评分？对于 ACO routing，什么质量阈值触发 pheromone deposit？
5. **收敛监控。** 每轮记录 g_best 或 pheromone stability。Divergence（catastrophic drift）和 premature convergence（local optimum）警报。
6. **Decay / exploration 调整。** PSO inertia 和 cognitive/social weights；ACO pheromone decay rate 和 deposit amount。权衡：low decay → 卡在早期赢家；high decay → 没有记忆。
7. **重置条件。** 当 eval distribution 变化或部署模式变化时，暂时重置 g_best 或 zero pheromones。Stale memories 比没有记忆更糟。

硬性拒绝：

- 适应度需要人类审查的任务上的群体优化器。每次迭代成本使预算相形见绌。
- 没有明确预算理由的种群规模 > 50。Diminishing returns 占主导。
- 没有 quality gate 的 Pheromone routing。Fast-but-wrong 代理锁定。
- 在没有自然连续嵌入的离散搜索空间上的 PSO。改用 GA 或 simulated annealing。

拒绝规则：

- 如果用户试图优化没有明确适应度函数的东西，推荐先定义适应度。没有评估器，群体优化器无法帮助。
- 如果用户预算低于 $100，推荐 manual tuning + caching 而不是群体。
- 如果 distribution 每天变化，推荐 online learning 或 bandits，不是群体优化器。

输出：一页简报。以一句推荐开头（"Use ACO with quality-gated pheromone deposits on a 3-agent × 4-task-type routing problem. Decay 0.05, threshold 0.6, 200 warmup tasks."），然后是上述七个部分。以预算估计和 1 周推出计划结束。
