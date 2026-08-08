---
name: marl-picker
description: 为给定多代理任务选择 MARL 算法（MADDPG、QMIX、MAPPO、IQL 或扩展）。考虑合作 vs 竞争、动作空间类型、异质性、奖励结构和规模。
version: 1.0.0
phase: 16
lesson: 20
tags: [multi-agent, MARL, MADDPG, QMIX, MAPPO, CTDE]
---

给定多代理任务描述，选择 MARL 算法。

生成：

1. **任务分类。** Fully cooperative（shared reward）、fully competitive（zero-sum）、mixed、general-sum。代理数量。Homogeneous vs heterogeneous。
2. **可观测性。** Full（每个代理看到全局状态）、partial（每个仅看到自己的观察）或 communication-enabled。
3. **动作空间。** Discrete（Atari-like、SMAC）或 continuous（particle world、MuJoCo）。影响算法选择。
4. **奖励结构。** Dense（per-step shaped）vs sparse（terminal only）。Dense 使 MAPPO 实用；sparse 需要 credit assignment 帮助（QMIX 的 value decomposition）。
5. **算法推荐。** 以 MAPPO 作为基线开始，根据 Yu et al. 2022。切换到：
   - QMIX 当 cooperative + homogeneous + 需要强 sparse-reward credit assignment
   - MADDPG 当 mixed（cooperative + competitive）+ continuous actions
   - Extensions（QTRAN、QPLEX、FACMAC）当 monotonicity constraint 太严格
6. **训练基础设施。** 你是否有：足够的交互数据、计算预算、reward shaping 专业知识、stability budget（每个实验 5-10 个种子）？如果没有，推荐 LLM 代理的 prompt-level policies。
7. **部署契约。** CTDE：部署时每个代理仅看到局部观察。显式编写契约，以便运行时代码尊重它。

硬性拒绝：

- 为首次运行选择非 MAPPO 基线。MAPPO 是 2026 基线；从那里开始。
- 用于混合合作-竞争任务的 QMIX。Value decomposition 假设单调聚合。
- 为缺乏交互数据或奖励信号的 LLM 代理系统推荐 MARL 训练。Prompt-level policies 将优于直到数据存在。
- 没有记录每代理观察和动作的训练。调试不可能。

拒绝规则：

- 如果任务有少于约 1000 个交互数据 episodes，推荐 prompt-level policies 或 supervised fine-tuning。
- 如果任务是非马尔可夫的（需要记忆）但推荐不包括 recurrent critics，标记差距。
- 如果任务是 general-sum competitive（multiple equilibria），MARL 单独不选择一个；推荐 mechanism design 或 equilibrium selection。

输出：一页简报。以一句推荐开头（"MAPPO baseline with centralized value function; per-agent discrete actor; CTDE at deploy; 5 seeds per experiment."），然后是上述七个部分。以 training-to-deployment pipeline 结束：data collection、training、evaluation、rollout。
