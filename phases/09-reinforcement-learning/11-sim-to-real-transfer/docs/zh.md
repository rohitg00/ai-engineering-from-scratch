# 11 · 仿真到现实迁移

> 在仿真器中训练却在真实硬件上失败的策略，是一个记住了仿真器的策略。「域随机化（Domain Randomization）」、「域适应（Domain Adaptation）」与「系统辨识（System Identification）」是让学习到的控制器跨越现实鸿沟的三件工具。

**类型：** 学习
**语言：** Python
**前置：** 阶段 9 · 08（PPO），阶段 2 · 10（偏差/方差）
**时长：** 约 45 分钟

## 问题所在

训练一个真实机器人既慢、又危险、还昂贵。一个双足机器人需要数百万个训练回合才能学会走路；而真实的双足机器人哪怕只摔倒一次，就会损坏硬件。仿真则给你无限次重置、确定性可复现、并行环境，以及零物理损伤。

但仿真器是错的。轴承的摩擦比 MuJoCo 模型更大。相机有仿真器并未包含的镜头畸变。电机有 99% 的仿真模型都跳过的延迟、回程间隙（backlash）与饱和。风、灰尘和变化的光照会破坏一个在洁净渲染上训练出来的策略。**现实鸿沟（reality gap）**——仿真分布与真实分布之间的系统性差异——正是机器人领域部署强化学习的核心问题。

你需要一个*对仿真到现实分布偏移鲁棒*的策略。历史上有三种方法：随机化仿真器（域随机化）、用少量真实数据适应策略（域适应/微调），或者辨识真实系统的参数并加以匹配（系统辨识）。到 2026 年，主流做法是将这三者与大规模并行仿真（Isaac Sim、Isaac Lab、GPU 上的 Mujoco MJX）结合起来。

## 核心概念

〔图：仿真到现实的三种范式：域随机化、域适应、系统辨识〕

**域随机化（Domain Randomization，DR）。** Tobin 等人 2017、Peng 等人 2018。在训练过程中，随机化每一个可能在真实机器人上有所不同的仿真参数：质量、摩擦系数、电机 PD 增益、传感器噪声、相机位置、光照、纹理、接触模型。策略学到一个关于「今天它身处哪个仿真」的条件分布，并在整个跨度上泛化。如果真实机器人落在训练包络之内，策略就能奏效。

- **优点：** 无需真实数据。一套配方，适配多种机器人。
- **缺点：** 过度随机化的训练会产生一个「通用」但过于保守的策略。噪声太多 ≈ 正则化太强。

**系统辨识（System Identification，SI）。** 在训练之前，把仿真器的参数拟合到真实世界数据上。如果你能在真实机器人上测出臂关节摩擦，就把它代入仿真，然后训练一个预期使用这些数值的策略。这需要访问真实系统，但能直接缩小现实鸿沟。

- **优点：** 精确、低噪声的训练目标。
- **缺点：** 残余的模型误差对策略而言是不可见的；微小的未辨识效应（例如电机死区）仍会破坏部署。

**域适应（Domain Adaptation）。** 在仿真中训练，用少量真实数据微调。有两种风格：

- **Real2Sim2Real：** 用真实轨迹学习一个残差仿真器 `f(s, a, z) - f_sim(s, a)`，在修正后的仿真中训练。无需太多真实数据即可缩小鸿沟。
- **观测适应（Observation adaptation）：** 训练一个策略，通过一个学习到的特征提取器（例如 GAN 像素到像素）把真实观测映射为类仿真观测。控制器仍留在仿真中。

**特权学习/师生（teacher-student）。** Miki 等人 2022（ANYmal 四足机器人）。在仿真中训练一个*教师（teacher）*，它能访问特权信息（真实摩擦、地形高度、IMU 漂移）。再蒸馏出一个只能看到真实传感器观测的*学生（student）*。学生学会从历史中推断特权特征，从而对物理参数变化保持鲁棒。

**大规模并行仿真。** 2024–2026。Isaac Lab、Mujoco MJX、Brax 都能在单块 GPU 上运行数千个并行机器人。使用 4,096 个并行人形机器人的 PPO 能在数小时内收集相当于数年的经验。随着训练分布的拓宽，「现实鸿沟」随之收缩；当这 4,096 个环境中每一个都有不同的随机化参数时，DR 几乎变成免费的。

**2026 年真实世界配方（以四足行走为例）：**

1. 大规模并行仿真，对重力、摩擦、电机增益、负载进行域随机化。
2. 用特权信息（地形图、机体速度真值）训练教师策略。
3. 仅用本体感知（腿部关节编码器）从教师蒸馏出学生策略。
4. 可选：在真实 IMU 上用自编码器做观测适应。
5. 部署。在 10 多个环境中零样本运行。如果失败，就用受安全约束的 PPO 做几分钟的真实世界微调。

## 动手构建

本课的代码是对 GridWorld 上域随机化的一个微型演示，其中转移带有*噪声*。我们训练一个策略，让它在「仿真」中体验随机化的打滑概率，然后在一个它训练时从未见过的打滑水平下，在「现实」中评估。这一形态可以直接映射到 MuJoCo 到硬件的迁移。

### 第 1 步：参数化仿真

```python
def step(state, action, slip):
    if rng.random() < slip:
        action = random_perpendicular(action)
    ...
```

`slip` 是仿真器暴露出来的一个参数。在真实机器人中，它可能是摩擦、质量、电机增益——任何在仿真与现实之间会发生变化的量。

### 第 2 步：用 DR 训练

在每个回合开始时，采样 `slip ~ Uniform[0.0, 0.4]`。训练 PPO / Q-learning / 任何算法。这样做很多回合。

### 第 3 步：在「真实」打滑下做零样本评估

在 `slip ∈ {0.0, 0.1, 0.2, 0.3, 0.5, 0.7}` 上评估。前四个落在训练支撑集内；`0.5` 和 `0.7` 在外。一个 DR 训练出的策略在支撑集内应保持接近最优，在支撑集外应优雅降级。而一个固定打滑训练出的策略在其训练打滑值之外会很脆弱。

### 第 4 步：与窄分布训练对比

训练第二个策略，只用 `slip = 0.0`。在同样的 `slip` 扫描上评估。你应该会看到：一旦真实打滑 > 0，性能就灾难性地下降。

## 常见陷阱

- **随机化太多。** 在 `slip ∈ [0, 0.9]` 上训练，你的策略会过于规避风险，以至于从不尝试最优路径。要匹配真实世界的*期望*分布，而不是「什么都可能发生」。
- **随机化太少。** 在一个很薄的切片上训练，策略根本无法泛化。使用自适应课程（「自动域随机化，Automatic Domain Randomization」），随着策略改进而拓宽分布。
- **参数空间辨识错误。** 随机化了错误的东西（明明真实鸿沟是电机延迟，你却去随机化相机色调），DR 就帮不上忙。先对真实机器人做剖析（profile）。
- **特权信息泄漏。** 一个用全局状态（而不仅是观测）来决定动作的教师，会产生一个永远追不上的学生。要确保在给定观测历史的条件下，教师的策略对学生而言是可实现的。
- **仿真到仿真迁移失败。** 如果你的策略对一个更难的仿真变体都不鲁棒，那它对真实世界也不会鲁棒。在部署前，务必先在一个留出（held-out）的仿真变体上测试。
- **没有真实世界安全包络。** 一个在仿真中奏效、在现实中也「奏效」的策略，如果没有底层安全护盾（safety shield），仍可能损坏硬件。要在一个非学习型控制器中加入速率限制、力矩限制和关节限制。

## 实战应用

2026 年的仿真到现实技术栈：

| 领域 | 技术栈 |
|--------|-------|
| 腿式运动（ANYmal、Spot、人形机器人） | Isaac Lab + DR + 特权教师 / 学生 |
| 操作（灵巧手、抓取放置） | Isaac Lab + DR + 用于视觉的 DR-GAN |
| 自动驾驶 | CARLA / NVIDIA DRIVE Sim + DR + 真实微调 |
| 无人机竞速 | RotorS / Flightmare + DR + 在线适应 |
| 手指/手内操作 | OpenAI Dactyl（前所未有规模的 DR） |
| 工业机械臂 | MuJoCo-Warp + SI + 少量真实微调 |

在所有规模的控制中，工作流都是一致的：尽你所能拟合仿真，对拟合不了的东西做随机化，训练庞大的策略，蒸馏，并带着安全护盾部署。

## 交付物

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

1. **简单。** 在固定打滑的 GridWorld（slip=0.0）上训练一个 Q-learning 智能体。在 slip ∈ {0.0, 0.1, 0.3, 0.5} 上评估。绘制回报对 slip 的曲线。
2. **中等。** 训练一个 DR Q-learning 智能体，采样 `slip ~ Uniform[0, 0.3]`。在同样的扫描上评估。在 slip=0.5（分布外）时，DR 带来了多少收益？
3. **困难。** 实现一个课程：从 slip=0.0 开始，每当策略达到最优的 90% 时就拓宽 DR 范围。测量达到 slip=0.3 零样本所需的总环境步数，并与固定 DR 基线对比。

## 关键术语

| 术语 | 人们怎么说 | 它实际指什么 |
|------|-----------------|-----------------------|
| 现实鸿沟（Reality gap） | 「仿真与现实的差异」 | 训练物理/感知与部署物理/感知之间的分布偏移。 |
| 域随机化（Domain randomization, DR） | 「在随机仿真上训练」 | 训练期间随机化仿真参数，使策略得以泛化。 |
| 系统辨识（System identification, SI） | 「测量现实并拟合仿真」 | 估计真实物理参数；设置仿真使其匹配。 |
| 域适应（Domain adaptation） | 「在真实数据上微调」 | 仿真训练后做少量真实世界微调；可适应观测或动力学。 |
| 特权信息（Privileged info） | 「教师的真值」 | 只有仿真才有的信息；学生必须从观测历史中推断它。 |
| 师生（Teacher/student） | 「将特权蒸馏为可观测」 | 教师带着捷径训练；学生学着在没有这些捷径的情况下模仿。 |
| ADR | 「自动域随机化」 | 随策略改进而拓宽 DR 范围的课程。 |
| Real2Sim | 「用真实数据缩小鸿沟」 | 学习一个残差，使仿真模仿真实轨迹。 |

## 延伸阅读

- [Tobin et al. (2017). Domain Randomization for Transferring Deep Neural Networks from Simulation to the Real World](https://arxiv.org/abs/1703.06907) —— 最初的 DR 论文（机器人视觉）。
- [Peng et al. (2018). Sim-to-Real Transfer of Robotic Control with Dynamics Randomization](https://arxiv.org/abs/1710.06537) —— 面向动力学的 DR，四足运动。
- [OpenAI et al. (2019). Solving Rubik's Cube with a Robot Hand](https://arxiv.org/abs/1910.07113) —— Dactyl，规模化的 ADR。
- [Miki et al. (2022). Learning robust perceptive locomotion for quadrupedal robots in the wild](https://www.science.org/doi/10.1126/scirobotics.abk2822) —— 面向 ANYmal 的师生方法。
- [Makoviychuk et al. (2021). Isaac Gym: High Performance GPU Based Physics Simulation for Robot Learning](https://arxiv.org/abs/2108.10470) —— 驱动 2025–2026 部署的大规模并行仿真。
- [Akkaya et al. (2019). Automatic Domain Randomization](https://arxiv.org/abs/1910.07113) —— ADR 课程方法。
- [Sutton & Barto (2018). Ch. 8 — Planning and Learning with Tabular Methods](http://incompleteideas.net/book/RLbook2020.pdf) —— Dyna 框架（用模型做规划 + 轨迹生成），它是现代仿真到现实管线的底层支撑。
- [Zhao, Queralta & Westerlund (2020). Sim-to-Real Transfer in Deep Reinforcement Learning for Robotics: a Survey](https://arxiv.org/abs/2009.13303) —— 仿真到现实方法的分类法，附带基准结果。
