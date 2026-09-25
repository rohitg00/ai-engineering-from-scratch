# Sim-to-Real 迁移

> 在模拟器中训练却在硬件上失败的策略，是把模拟器背下来了。域随机化、域自适应和系统辨识是让学习到的控制器跨越现实差距的三种工具。

**Type:** Learn
**Languages:** Python
**Prerequisites:** Phase 9 · 08 (PPO)、Phase 2 · 10 (Bias/Variance)
**Time:** ~45 分钟

## 问题所在

训练真实机器人速度慢、危险且昂贵。双足机器人需要数百万个训练回合才能学会走路；而真实双足机器人哪怕摔倒一次就会损坏硬件。仿真则提供无限次重置、确定性的可复现性、并行环境，且不会造成物理损坏。

但模拟器是错的。轴承的摩擦比 MuJoCo 模型大。相机有模拟器未包含的镜头畸变。电机存在延迟、回程间隙和饱和，而 99% 的仿真模型都忽略了这些。风、灰尘和变化的光照会破坏在干净渲染上训练的策略。**现实差距**——仿真分布与真实分布之间的系统性差异——是机器人 RL 部署的核心问题。

你需要一个*对 sim-to-real 分布偏移鲁棒*的策略。三种历史方法：随机化模拟器（域随机化）、用少量真实数据调整策略（域自适应 / 微调），或辨识真实系统的参数并使其匹配（系统辨识）。在 2026 年，主流配方是将三者与大规模并行仿真（Isaac Sim、Isaac Lab、GPU 上的 Mujoco MJX）结合。

## 核心概念

![Three sim-to-real regimes: domain randomization, adaptation, system identification](../assets/sim-to-real.svg)

**域随机化（DR）。** Tobin et al. 2017，Peng et al. 2018。训练时，随机化所有在真实机器人上可能不同的仿真参数：质量、摩擦系数、电机 PD 增益、传感器噪声、相机位置、光照、纹理、接触模型。策略学习到一个关于“今天处于哪个仿真中”的条件分布，并在整个范围内泛化。如果真实机器人落在训练包络内，策略就能工作。

- **优点：** 不需要真实数据。一套配方，多种机器人。
- **缺点：** 过度随机化的训练会产生“通用”但过于保守的策略。噪声太多 ≈ 正则化太强。

**系统辨识（SI）。** 在训练之前，将模拟器的参数拟合到真实世界数据。如果你能测量真实机械臂关节的摩擦，就把它代入仿真。然后训练一个期望这些值的策略。需要访问真实系统，但能直接缩小现实差距。

- **优点：** 精确、低噪声的训练目标。
- **缺点：** 残余模型误差对策略不可见；小的未辨识效应（如电机死区）仍会破坏部署。

**域自适应。** 在仿真中训练，再用少量真实数据微调。两种形式：

- **Real2Sim2Real：** 使用真实 rollout 学习残差模拟器 `f(s, a, z) - f_sim(s, a)`，在修正后的仿真中训练。无需太多真实数据即可缩小差距。
- **观测自适应：** 训练一个通过学习到的特征提取器（如 GAN 像素到像素）将真实观测映射为仿真式观测的策略。控制器留在仿真中。

**特权学习 / 师生模式。** Miki et al. 2022（ANYmal 四足机器人）。在仿真中训练一个可以访问特权信息（真实摩擦、地形高度、IMU 漂移）的*教师*。蒸馏出一个只看到真实传感器观测的*学生*。学生学会从历史中推断特权特征，在不同物理参数下都保持鲁棒。

**大规模并行仿真。** 2024–2026。Isaac Lab、Mujoco MJX、Brax 都能在单个 GPU 上运行数千个并行机器人。使用 4,096 个并行人形机器人的 PPO 可在数小时内收集数年的经验。随着训练分布变宽，“现实差距”缩小；当这 4,096 个环境中每个都有不同的随机化参数时，DR 几乎是免费的。

**2026 年真实世界配方（四足行走示例）：**

1. 大规模并行仿真，对重力、摩擦、电机增益、负载进行域随机化。
2. 使用特权信息（地形图、身体速度真值）训练教师策略。
3. 仅使用本体感知（腿部关节编码器）从教师蒸馏学生策略。
4. 可选：通过真实 IMU 上的自编码器进行观测自适应。
5. 部署。在 10+ 个环境中零样本运行。如果失败，用带安全约束的 PPO 进行几分钟的真实世界微调。

```figure
f3-reality-gap
```

## 动手实现

本课的代码是一个在具有*噪声*转移的 GridWorld 上进行域随机化的小型演示。我们训练一个在“仿真”中经历随机化打滑概率的策略，并在“真实”中用它在训练期间从未见过的打滑水平进行评估。其结构可直接映射到 MuJoCo 到硬件的迁移。

### 步骤 1：参数化仿真

```python
def step(state, action, slip):
    if rng.random() < slip:
        action = random_perpendicular(action)
    ...
```

`slip` 是模拟器暴露的一个参数。在真实机器人中，它可以是摩擦、质量、电机增益——任何在仿真和真实之间不同的量。

### 步骤 2：用 DR 训练

在每个回合开始时，采样 `slip ~ Uniform[0.0, 0.4]`。训练 PPO / Q-learning / 任意算法。重复许多回合。

### 步骤 3：在“真实”打滑上零样本评估

在 `slip ∈ {0.0, 0.1, 0.2, 0.3, 0.5, 0.7}` 上评估。前四个在训练支持范围内；`0.5` 和 `0.7` 在范围之外。DR 训练的策略应在支持范围内接近最优，在范围外优雅退化。固定打滑训练的策略在其训练打滑范围之外会很脆弱。

### 步骤 4：与窄范围训练比较

仅用 `slip = 0.0` 训练第二个策略。在相同的 `slip` 扫描上评估。你应该会看到，一旦真实打滑 > 0，性能就急剧下降。

## 常见陷阱

- **随机化过多。** 在 `slip ∈ [0, 0.9]` 上训练，策略会过于规避风险，从不尝试最优路径。匹配*预期*的真实世界分布，而不是“什么都有可能发生”。
- **随机化过少。** 在一个窄切片上训练，策略完全无法泛化。使用自适应课程（Automatic Domain Randomization），随策略改进而扩大分布。
- **参数空间辨识错误。** 随机化错误的东西（真实差距在电机延迟，却随机化相机色调），DR 就没有帮助。先对真实机器人进行剖析。
- **特权信息泄露。** 一个在动作中使用全局状态（而不仅是观测）的教师，可能产生无法跟上的学生。确保教师的策略在给定观测历史的条件下可由学生实现。
- **Sim-to-sim 迁移失败。** 如果你的策略对更难的仿真变体都不鲁棒，那么它对真实世界也不会鲁棒。部署前务必在留出的仿真变体上测试。
- **没有真实世界安全包络。** 一个在仿真中工作、“在真实中工作”却没有底层安全防护的策略仍可能损坏硬件。在非学习控制器中加入速率限制、力矩限制、关节限制。

## 应用场景

2026 年的 sim-to-real 技术栈：

| 领域 | 技术栈 |
|--------|-------|
| 腿式运动（ANYmal、Spot、人形） | Isaac Lab + DR + 特权教师 / 学生 |
| 操作（灵巧手、抓取放置） | Isaac Lab + DR + 用于视觉的 DR-GAN |
| 自动驾驶 | CARLA / NVIDIA DRIVE Sim + DR + 真实微调 |
| 无人机竞速 | RotorS / Flightmare + DR + 在线自适应 |
| 手指/手内操作 | OpenAI Dactyl（空前规模的 DR） |
| 工业机械臂 | MuJoCo-Warp + SI + 少量真实微调 |

对于各种规模的控制，工作流程是一致的：尽可能拟合仿真，随机化无法拟合的部分，训练超大规模策略，蒸馏，带安全防护部署。

## 上线部署

保存为 `outputs/skill-sim2real-planner.md`：

```markdown
---
name: sim2real-planner
description: Plan a sim-to-real transfer pipeline for a given robot + task, covering DR, SI, and safety.
version: 1.0.0
phase: 9
lesson: 11
tags: [rl, sim2real, robotics, domain-randomization]
---

Given a robot platform, a task, and access to real hardware time, output:

1. Reality gap inventory. Suspected sources ranked by expected impact (contact, sensing, actuation delay, vision).
2. DR parameters. Exact list, ranges, distribution. Justify each range against real measurements.
3. SI steps. Which parameters to measure; measurement method.
4. Teacher/student split. What privileged info the teacher uses; what obs the student uses.
5. Safety envelope. Low-level limits, emergency stops, backup controller.

Refuse to deploy without (a) a zero-shot sim-variant test, (b) a safety shield, (c) a rollback plan. Flag any DR range wider than 3× measured real variability as likely over-randomized.
```

## 练习

1. **简单。** 在固定打滑的 GridWorld（slip=0.0）上训练 Q-learning 智能体。在 slip ∈ {0.0, 0.1, 0.3, 0.5} 上评估。绘制回报与 slip 的关系图。
2. **中等。** 训练采样 `slip ~ Uniform[0, 0.3]` 的 DR Q-learning 智能体。评估相同的扫描。在 slip=0.5（分布外）时，DR 带来多少提升？
3. **困难。** 实现一个课程：从 slip=0.0 开始，每当策略达到最优的 90% 时扩大 DR 范围。测量达到 slip=0.3 零样本所需的总环境步数，并与固定 DR 基线比较。

## 关键术语

| 术语 | 人们的说法 | 实际含义 |
|------|-----------------|-----------------------|
| Reality gap | “仿真与真实的差异” | 训练与部署之间物理/传感的分布偏移。 |
| 域随机化（DR） | “在随机仿真中训练” | 训练时随机化仿真参数，使策略泛化。 |
| 系统辨识（SI） | “测量真实并拟合仿真” | 估计真实物理参数；将仿真设为匹配值。 |
| 域自适应 | “在真实数据上微调” | 仿真训练后进行少量真实世界微调；可自适应观测或动力学。 |
| 特权信息 | “教师的真值” | 只有仿真才拥有的信息；学生必须从观测历史中推断。 |
| 教师/学生 | “蒸馏特权 -> 可观测” | 用捷径训练教师；学生学会在没有捷径的情况下模仿。 |
| ADR | “Automatic Domain Randomization” | 随策略改进而扩大 DR 范围的课程方法。 |
| Real2Sim | “用真实数据缩小差距” | 学习一个残差使仿真模仿真实 rollout。 |

## 延伸阅读

- [Tobin et al. (2017). Domain Randomization for Transferring Deep Neural Networks from Simulation to the Real World](https://arxiv.org/abs/1703.06907) — DR 的原始论文（机器人视觉）。
- [Peng et al. (2018). Sim-to-Real Transfer of Robotic Control with Dynamics Randomization](https://arxiv.org/abs/1710.06537) — 用于动力学的 DR，四足运动。
- [OpenAI et al. (2019). Solving Rubik's Cube with a Robot Hand](https://arxiv.org/abs/1910.07113) — Dactyl，大规模 ADR。
- [Miki et al. (2022). Learning robust perceptive locomotion for quadrupedal robots in the wild](https://www.science.org/doi/10.1126/scirobotics.abk2822) — ANYmal 的师生模式。
- [Makoviychuk et al. (2021). Isaac Gym: High Performance GPU Based Physics Simulation for Robot Learning](https://arxiv.org/abs/2108.10470) — 驱动 2025–2026 部署的大规模并行仿真。
- [Akkaya et al. (2019). Automatic Domain Randomization](https://arxiv.org/abs/1910.07113) — ADR 课程方法。
- [Sutton & Barto (2018). Ch. 8 — Planning and Learning with Tabular Methods](http://incompleteideas.net/book/RLbook2020.pdf) — Dyna 框架（用模型进行规划 + rollout），是现代 sim-to-real 流水线的基础。
- [Zhao, Queralta & Westerlund (2020). Sim-to-Real Transfer in Deep Reinforcement Learning for Robotics: a Survey](https://arxiv.org/abs/2009.13303) — 带基准结果的 sim-to-real 方法分类。