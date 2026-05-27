# 从仿真到现实（Sim-to-Real Transfer）

> 一个在仿真器中训练却无法在硬件上运行的策略，是一个记住了仿真器的策略。域随机化（Domain Randomization）、域自适应（Domain Adaptation）和系统辨识（System Identification）是让学习控制器跨越现实鸿沟的三种工具。

**类型：** 学习
**语言：** Python
**前置知识：** 第9阶段 · 08（PPO）、第2阶段 · 10（偏差/方差）
**时间：** 约45分钟

## 问题

训练真实机器人耗时、危险且昂贵。双足机器人需要数百万个训练回合才能学会走路；而真实双足机器人只要摔倒一次就会损坏硬件。仿真提供了无限重置、确定性可重现、并行环境以及无物理损伤。

但仿真器是错误的。轴承的摩擦力大于MuJoCo模型所模拟的；相机存在仿真器未包含的镜头畸变；电机存在99%的仿真模型忽略的延迟、空转和饱和。风、灰尘和可变光照会破坏在洁净渲染环境下训练的策略。**现实鸿沟（Reality Gap）**——仿真分布与真实分布之间的系统性差异——是机器人领域强化学习（RL）实际部署的核心问题。

你需要一个*对仿真到现实的分布偏移具有鲁棒性*的策略。历史上三种方法：随机化仿真器（域随机化）、利用少量真实数据调整策略（域自适应/微调）、或者辨识真实系统参数并与之匹配（系统辨识）。到2026年，主流的做法是将这三种方法结合，并配合大规模并行仿真（Isaac Sim、Isaac Lab、基于GPU的Mujoco MJX）。

## 概念

![三种仿真到现实范式：域随机化、自适应、系统辨识](../assets/sim-to-real.svg)

**域随机化（Domain Randomization, DR）。** Tobin等人2017年，Peng等人2018年。在训练期间，随机化所有可能在真实机器人上存在差异的仿真参数：质量、摩擦系数、电机PD增益、传感器噪声、相机位置、光照、纹理、接触模型。策略学会一个关于“今天处在哪个仿真世界”的条件分布，并在整个范围内泛化。如果真实机器人落在此训练包络内，策略即可工作。

- **优点：** 不需要真实数据。一种方案，适用于多种机器人。
- **缺点：** 过度随机化训练会产生一个“通用”但过于保守的策略。噪声过大 ≈ 正则化过强。

**系统辨识（System Identification, SI）。** 在训练前将仿真器的参数拟合到真实世界数据。如果能够测量真实机器人手臂关节的摩擦力，就将该值代入仿真器，然后训练一个期望这些值的策略。需要访问真实系统，但直接缩小了现实鸿沟。

- **优点：** 精确、低噪声的训练目标。
- **缺点：** 残留模型误差对策略不可见；微小的未辨识效应（例如电机死区）仍会破坏部署。

**域自适应（Domain Adaptation）。** 在仿真中训练，用少量真实数据微调。两种变体：

- **Real2Sim2Real：** 利用真实 rollout 学习残差仿真器 `f(s, a, z) - f_sim(s, a)`，在修正后的仿真器中训练。无需大量真实数据即可缩小鸿沟。
- **观测自适应：** 通过一个学习好的特征提取器（例如GAN像素到像素）将真实观测映射到类仿真观测。控制器仍保持在仿真域中。

**特权学习（Privileged Learning）/ 教师-学生（Teacher-Student）。** Miki等人2022年（ANYmal四足机器人）。在仿真中训练一个*教师*，它有权访问特权信息（地面真实摩擦、地形高度、IMU漂移）。然后蒸馏一个*学生*，它仅能看到真实传感器观测。学生学会从历史信息中推断特权特征，从而对各种物理参数具有鲁棒性。

**大规模并行仿真。** 2024–2026年。Isaac Lab、Mujoco MJX、Brax都在单个GPU上运行数千个并行机器人。使用4096个并行人形机器人进行PPO训练，数小时内即可收集到相当于数年的经验。随着训练分布变宽，“现实鸿沟”缩小；当4096个环境各自具有不同的随机化参数时，域随机化几乎成为免费附赠。

**2026年的真实世界配方（以四足行走为例）：**

1. 大规模并行仿真，配合随机化重力、摩擦、电机增益、负载的域随机化。
2. 使用特权信息（地形图、本体速度真值）训练教师策略。
3. 仅使用本体感觉（腿部关节编码器）从教师蒸馏学生策略。
4. 可选：通过真实IMU的自编码器进行观测自适应。
5. 部署。零样本在10+个环境中运行。若失败，在安全约束PPO下进行几分钟真实世界微调。

## 动手实现

本课的代码是一个小型演示，在一个具有*噪声*转移的GridWorld上展示域随机化。我们在仿真中训练一个经历随机滑动概率的策略，然后在“真实”环境中评估一个训练中从未见过的滑动水平。这种形式直接映射到MuJoCo到硬件的迁移。

### 步骤1：参数化仿真

```python
def step(state, action, slip):
    if rng.random() < slip:
        action = random_perpendicular(action)
    ...
```

`slip` 是仿真器暴露的一个参数。在真实机器人中，它可以是摩擦、质量、电机增益——任何在仿真与真实之间变化的量。

### 步骤2：使用域随机化训练

在每个回合开始时，采样 `slip ~ Uniform[0.0, 0.4]`。训练PPO / Q-learning / 任何算法。进行多个回合。

### 步骤3：在“真实”滑动水平上零样本评估

在 `slip ∈ {0.0, 0.1, 0.2, 0.3, 0.5, 0.7}` 上评估。前四个在训练支持范围内；`0.5`和`0.7`在范围外。经过域随机化训练的策略应在支持范围内保持接近最优，并在范围外优雅地退化。固定滑动水平训练的策略在其训练滑动值之外会变得脆弱。

### 步骤4：与狭窄训练比较

训练第二个仅使用 `slip = 0.0` 的策略。在相同的 `slip` 扫描上评估。一旦真实滑动值>0，你应该会看到灾难性下降。

## 陷阱

- **随机化过多。** 在 `slip ∈ [0, 0.9]` 上训练，你的策略会如此规避风险以至于从不尝试最优路径。匹配*预期*的真实世界分布，而不是“一切皆有可能”。
- **随机化过少。** 在薄层上训练，策略无法泛化。使用自适应课程（Automatic Domain Randomization），随着策略提升而拓宽分布。
- **参数空间辨识错误。** 随机化了错误的东西（当真实鸿沟在于电机延迟时却随机化相机色调），域随机化无济于事。首先对真实机器人进行概要分析。
- **特权信息泄露。** 教师使用全局状态（而非仅观测）来生成动作，可能导致学生无法跟上。确保教师的策略在给定观测历史下是学生能够实现的。
- **仿真到仿真迁移失败。** 如果你的策略对更强的仿真变体不具有鲁棒性，那它对真实世界也不会鲁棒。在部署前，始终在一个留出的仿真变体上测试。
- **缺乏真实世界安全包络。** 一个在仿真中有效且“在真实中有效”的策略，如果没有低层安全保护，仍然可能损坏硬件。在非学习控制器中添加速率限制、力矩限制、关节限制。

## 使用场景

2026年仿真到现实技术栈：

| 领域 | 技术栈 |
|------|--------|
| 腿部运动（ANYmal、Spot、人形机器人） | Isaac Lab + DR + 特权教师/学生 |
| 操作（灵巧手、取放） | Isaac Lab + DR + 用于视觉的DR-GAN |
| 自动驾驶 | CARLA / NVIDIA DRIVE Sim + DR + 真实微调 |
| 无人机竞速 | RotorS / Flightmare + DR + 在线自适应 |
| 手指/手内操作 | OpenAI Dactyl（前所未有规模的DR） |
| 工业机械臂 | MuJoCo-Warp + SI + 小规模真实微调 |

对于各种规模的控制器，工作流是一致的：尽量拟合仿真，随机化无法拟合的部分，训练大规模策略，蒸馏，部署并配备安全护盾。

## 交付成果

保存为 `outputs/skill-sim2real-planner.md`：

```markdown
---
name: sim2real-planner
description: 为给定机器人+任务规划仿真到现实迁移管线，涵盖DR、SI和安全。
version: 1.0.0
phase: 9
lesson: 11
tags: [rl, sim2real, robotics, domain-randomization]
---

给定机器人平台、任务以及真实硬件使用时间，输出：

1. 现实鸿沟清单。按预期影响（接触、感知、执行延迟、视觉）排序的疑似来源。
2. DR参数。确切列表、范围、分布。对照真实测量证明每个范围的合理性。
3. SI步骤。需要测量的参数；测量方法。
4. 教师/学生划分。教师使用的特权信息；学生使用的观测。
5. 安全包络。底层限制、紧急停止、备用控制器。

拒绝部署，除非满足 (a) 零样本仿真变体测试, (b) 安全护盾, (c) 回滚计划。对任何范围宽度超过真实测量变异性3倍的DR范围标记为可能过度随机化。
```

## 练习

1. **简单。** 在固定滑动值的GridWorld（slip=0.0）上训练一个Q-learning agent。在 `slip ∈ {0.0, 0.1, 0.3, 0.5}` 上评估。绘制回报与滑动值的关系图。
2. **中等。** 训练一个DR Q-learning agent，采样 `slip ~ Uniform[0, 0.3]`。在相同的滑动值扫描上评估。在 slip=0.5（分布外）上DR带来了多少提升？
3. **困难。** 实现一个课程：从 slip=0.0 开始，每当策略达到最优的90%时拓宽DR范围。测量达到 slip=0.3 零样本所需的总环境步数，并与固定DR基线进行比较。

## 关键术语

| 术语 | 人们常说的 | 实际含义 |
|------|-----------|---------|
| 现实鸿沟（Reality gap） | "仿真与真实之间的差异" | 训练与部署之间物理/感知的分布偏移。 |
| 域随机化（Domain randomization, DR） | "在随机仿真上训练" | 训练时随机化仿真参数，使策略泛化。 |
| 系统辨识（System identification, SI） | "测量真实并拟合仿真" | 估计真实物理参数；设置仿真与之匹配。 |
| 域自适应（Domain adaptation） | "在真实数据上微调" | 仿真训练后的小规模真实世界微调；可能自适应观测或动力学。 |
| 特权信息（Privileged info） | "教师的真值" | 仅仿真拥有的信息；学生需从观测历史中推断。 |
| 教师/学生（Teacher/student） | "将特权蒸馏到可观测" | 教师使用捷径训练；学生学习无捷径地模仿。 |
| ADR | "自动域随机化（Automatic Domain Randomization）" | 随着策略提升而拓宽DR范围的课程。 |
| Real2Sim | "用真实数据缩小鸿沟" | 学习残差使仿真模仿真实 rollout。 |

## 延伸阅读

- [Tobin et al. (2017). Domain Randomization for Transferring Deep Neural Networks from Simulation to the Real World](https://arxiv.org/abs/1703.06907) — 原始DR论文（机器人视觉）。
- [Peng et al. (2018). Sim-to-Real Transfer of Robotic Control with Dynamics Randomization](https://arxiv.org/abs/1710.06537) — 动力学的DR，四足运动。
- [OpenAI et al. (2019). Solving Rubik's Cube with a Robot Hand](https://arxiv.org/abs/1910.07113) — Dactyl，大规模ADR。
- [Miki et al. (2022). Learning robust perceptive locomotion for quadrupedal robots in the wild](https://www.science.org/doi/10.1126/scirobotics.abk2822) — ANYmal的教师-学生。
- [Makoviychuk et al. (2021). Isaac Gym: High Performance GPU Based Physics Simulation for Robot Learning](https://arxiv.org/abs/2108.10470) — 推动2025–2026部署的大规模并行仿真器。
- [Akkaya et al. (2019). Automatic Domain Randomization](https://arxiv.org/abs/1910.07113) — ADR课程方法。
- [Sutton & Barto (2018). Ch. 8 — Planning and Learning with Tabular Methods](http://incompleteideas.net/book/RLbook2020.pdf) — Dyna框架（使用模型进行规划和rollout），是现代仿真到现实管线的基础。
- [Zhao, Queralta & Westerlund (2020). Sim-to-Real Transfer in Deep Reinforcement Learning for Robotics: a Survey](https://arxiv.org/abs/2009.13303) — 仿真到现实方法的分类及基准结果。