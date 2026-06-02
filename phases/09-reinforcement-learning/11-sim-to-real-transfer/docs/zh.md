# Sim-to-Real 迁移

> 译注：本文译自同目录 [`en.md`](./en.md)。术语遵循仓根 [TRANSLATION_GUIDE.md](../../../../TRANSLATION_GUIDE.md)。

> 一个在仿真器里训练好、却在硬件上扑街的 policy，本质上只是把仿真器背了下来。Domain randomization、domain adaptation 和 system identification 是让学到的控制器跨过 reality gap 的三件套。

**Type:** Learn
**Languages:** Python
**Prerequisites:** Phase 9 · 08 (PPO), Phase 2 · 10 (Bias/Variance)
**Time:** ~45 minutes

## 问题（Problem）

训练一台真实机器人又慢、又危险、又烧钱。一个双足机器人要花上百万 episode 才学会走路；而真实双足只要摔一次就可能把硬件摔坏。仿真给你无限次重置、可复现的确定性、并行环境，并且不会有物理损伤。

但仿真器是错的。轴承的摩擦比 MuJoCo 模型大；摄像头有仿真器没建模的镜头畸变；电机有 99% 仿真模型直接跳过的延迟、回程间隙（backlash）和饱和；风、灰尘、变化的光照会摧毁一个在洁净渲染下训练出来的 policy。**reality gap**——仿真分布与真实分布之间的系统性差异——正是部署机器人 RL 的核心问题。

你需要的是一个*对 sim-to-real 分布偏移鲁棒*的 policy。历史上有三种思路：把仿真器随机化（domain randomization）、用少量真实数据微调 policy（domain adaptation / fine-tune），或者把真实系统的参数辨识出来再让仿真去匹配（system identification）。到了 2026 年，主流配方是把这三者结合上大规模并行仿真（Isaac Sim、Isaac Lab、跑在 GPU 上的 Mujoco MJX）。

## 概念（Concept）

![Three sim-to-real regimes: domain randomization, adaptation, system identification](../assets/sim-to-real.svg)

**Domain Randomization (DR)。** Tobin et al. 2017、Peng et al. 2018。训练时把每个可能在真实机器人上不一样的仿真参数都随机化：质量、摩擦系数、电机 PD 增益、传感器噪声、相机位置、光照、纹理、接触模型。policy 学的是「今天处于哪个仿真世界」上的条件分布，并在整个范围内泛化。只要真实机器人落在训练所覆盖的范围里，policy 就能工作。

- **优点：** 不需要任何真实数据。一个配方，多种机器人通吃。
- **缺点：** 过度随机化训练出来的是一个「万能但过度保守」的 policy。噪声太多 ≈ 正则化太重。

**System Identification (SI)。** 训练前先把仿真器的参数拟合到真实数据上。如果你能在真实机器人上测出关节摩擦，就把它塞回仿真，再在那些数值上训练 policy。需要能接触真实系统，但能直接缩小 reality gap。

- **优点：** 训练目标精确、噪声低。
- **缺点：** 残余的模型误差对 policy 是不可见的；一些没辨识出来的小效应（比如电机死区）依然会在部署时炸掉。

**Domain Adaptation。** 在 sim 里训练，再用少量真实数据微调。两种风味：

- **Real2Sim2Real：** 用真实 rollout 学一个残差仿真器 `f(s, a, z) - f_sim(s, a)`，在修正过的 sim 里训练。不需要太多真实数据就能收口。
- **Observation adaptation：** 训练一个 policy，把真实 obs 通过一个学到的特征提取器（比如 GAN pixel-to-pixel）映射成「类 sim」obs。控制器始终留在 sim 里。

**Privileged learning / teacher-student。** Miki et al. 2022（ANYmal 四足）。在仿真里训一个 *teacher*，让它能拿到特权信息（地面真实摩擦、地形高度、IMU 漂移）。再蒸馏一个 *student*，它只能看到真实传感器的观测。student 学会从历史中推断这些特权特征，对各种物理参数都鲁棒。

**Massively parallel simulation。** 2024–2026。Isaac Lab、Mujoco MJX、Brax 都能在单张 GPU 上跑成千上万个并行机器人。PPO 配 4,096 个并行 humanoid，能在数小时内采集到相当于多年的经验。「reality gap」随着训练分布变宽而缩小；当这 4,096 个环境每个都用不同的随机参数时，DR 几乎是免费送的。

**2026 真实世界配方（以四足行走为例）：**

1. 大规模并行 sim，对重力、摩擦、电机增益、负载做 domain randomization。
2. 用特权信息（地形图、机体速度的 ground truth）训练 teacher policy。
3. 仅用本体感知（关节编码器）从 teacher 蒸馏出 student policy。
4. 可选：在真实 IMU 上用 autoencoder 做 observation adaptation。
5. 部署。在 10+ 种环境上 zero-shot；如果失败了，再用安全约束的 PPO 做几分钟的真实世界微调。

## 动手实现（Build It）

本课的代码是一个极小的 demo：在带*噪声*转移的 GridWorld 上演示 domain randomization。我们训练一个 policy，让它在「sim」里见过随机的滑动概率，然后在「real」上拿一个训练时从没见过的滑动等级去评估。这个形态可以直接对应到 MuJoCo-到-硬件的迁移。

### Step 1：参数化的 sim

```python
def step(state, action, slip):
    if rng.random() < slip:
        action = random_perpendicular(action)
    ...
```

`slip` 是仿真器对外暴露的一个参数。在真实机器人里它可能是摩擦、质量、电机增益——任何在 sim 与 real 之间会漂移的东西。

### Step 2：用 DR 训练

每个 episode 开始时，采样 `slip ~ Uniform[0.0, 0.4]`。训练 PPO / Q-learning / 任何方法，跑很多个 episode。

### Step 3：在「real」slip 上做 zero-shot 评估

在 `slip ∈ {0.0, 0.1, 0.2, 0.3, 0.5, 0.7}` 上评估。前四个落在训练支撑集里；`0.5` 和 `0.7` 在外面。一个 DR 训练的 policy 在支撑集内应该接近最优，支撑集外应该优雅退化。一个固定 slip 训练的 policy，在它训练 slip 之外会非常脆弱。

### Step 4：与窄分布训练对比

再训一个 policy，只用 `slip = 0.0`。在同样的 slip 扫描上评估。你应该会看到：只要真实 slip > 0，回报就直接崩盘。

## 陷阱（Pitfalls）

- **随机化太多。** 在 `slip ∈ [0, 0.9]` 上训练，policy 会怕到永远不走最优路径。要去匹配*预期的*真实世界分布，而不是「什么都可能发生」。
- **随机化太少。** 在很窄的一片上训练，policy 完全不会泛化。用自适应课程（Automatic Domain Randomization），随着 policy 变好把分布逐步加宽。
- **参数空间选错了。** 把不该随机化的随机了（真实差距在电机延迟，你却去随机相机色调），DR 帮不上忙。先把真实机器人 profile 一遍。
- **特权信息泄漏。** 一个用全局状态而不是 observation 来出动作的 teacher，可能蒸馏出一个 student 怎么也追不上的 policy。要保证 teacher 的策略在给定观测历史后是 student 可以实现的。
- **Sim-to-sim 迁移就失败了。** 如果你的 policy 对一个更难的 sim 变体都不鲁棒，那它对真实世界更不可能鲁棒。部署前一定要在留出的 sim 变体上测一下。
- **没有真实世界的安全包络。** 一个在 sim 里能跑、在 real 里也「能跑」的 policy，如果没有一层底层安全护盾，照样能把硬件搞坏。在非学习的控制器里加上速率限制、力矩限制、关节限制。

## 用起来（Use It）

2026 年的 sim-to-real 技术栈：

| Domain | Stack |
|--------|-------|
| 足式运动（ANYmal、Spot、humanoid） | Isaac Lab + DR + 特权 teacher / student |
| 操作（灵巧手、抓取放置） | Isaac Lab + DR + 视觉用 DR-GAN |
| 自动驾驶 | CARLA / NVIDIA DRIVE Sim + DR + 真实微调 |
| 无人机竞速 | RotorS / Flightmare + DR + 在线适配 |
| 手指 / 手内操作 | OpenAI Dactyl（前所未有规模的 DR） |
| 工业机械臂 | MuJoCo-Warp + SI + 少量真实微调 |

在所有规模的控制问题上，工作流都一致：能把 sim 拟合得多好就拟合多好，拟合不了的就随机化，训练巨大的 policy，蒸馏，再带着安全护盾部署。

## 上线部署（Ship It）

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

## 练习（Exercises）

1. **Easy.** 在固定 slip 的 GridWorld（slip=0.0）上训练一个 Q-learning agent。在 slip ∈ {0.0, 0.1, 0.3, 0.5} 上评估，画出回报 vs slip 曲线。
2. **Medium.** 训一个 DR Q-learning agent，按 `slip ~ Uniform[0, 0.3]` 采样。在同样的扫描上评估。在 slip=0.5（分布外）处，DR 能买回多少？
3. **Hard.** 实现一个课程：从 slip=0.0 开始，每当 policy 达到最优的 90%，就把 DR 范围扩宽一次。统计达到 slip=0.3 zero-shot 所需的总环境步数，并与固定 DR baseline 做对比。

## 关键术语（Key Terms）

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Reality gap | 「sim-to-real 差距」 | 训练物理/感知与部署物理/感知之间的分布偏移。 |
| Domain randomization (DR) | 「在随机 sim 上训练」 | 训练时随机化 sim 参数，让 policy 泛化。 |
| System identification (SI) | 「测真实再去拟合 sim」 | 估计真实物理参数；让 sim 去匹配。 |
| Domain adaptation | 「在真实数据上微调」 | sim 训练之后做少量真实世界微调；可能适配 obs 或 dynamics。 |
| Privileged info | 「给 teacher 的 ground truth」 | 只有 sim 才有的信息；student 必须从观测历史中推断。 |
| Teacher/student | 「从特权蒸馏到可观测」 | teacher 带着捷径训练；student 学着不靠捷径模仿。 |
| ADR | 「Automatic Domain Randomization」 | 随 policy 变好不断扩宽 DR 范围的课程方法。 |
| Real2Sim | 「用真实数据收口」 | 学一个残差让 sim 去模仿真实 rollout。 |

## 延伸阅读（Further Reading）

- [Tobin et al. (2017). Domain Randomization for Transferring Deep Neural Networks from Simulation to the Real World](https://arxiv.org/abs/1703.06907) —— DR 的开山之作（机器人视觉方向）。
- [Peng et al. (2018). Sim-to-Real Transfer of Robotic Control with Dynamics Randomization](https://arxiv.org/abs/1710.06537) —— 把 DR 用在动力学上的四足行走。
- [OpenAI et al. (2019). Solving Rubik's Cube with a Robot Hand](https://arxiv.org/abs/1910.07113) —— Dactyl，规模化 ADR。
- [Miki et al. (2022). Learning robust perceptive locomotion for quadrupedal robots in the wild](https://www.science.org/doi/10.1126/scirobotics.abk2822) —— ANYmal 的 teacher-student。
- [Makoviychuk et al. (2021). Isaac Gym: High Performance GPU Based Physics Simulation for Robot Learning](https://arxiv.org/abs/2108.10470) —— 驱动 2025–2026 大量部署的大规模并行 sim。
- [Akkaya et al. (2019). Automatic Domain Randomization](https://arxiv.org/abs/1910.07113) —— ADR 课程方法。
- [Sutton & Barto (2018). Ch. 8 — Planning and Learning with Tabular Methods](http://incompleteideas.net/book/RLbook2020.pdf) —— Dyna 框架（用模型做规划 + rollout），现代 sim-to-real 流水线的根基。
- [Zhao, Queralta & Westerlund (2020). Sim-to-Real Transfer in Deep Reinforcement Learning for Robotics: a Survey](https://arxiv.org/abs/2009.13303) —— sim-to-real 方法学的 taxonomy 与 benchmark 结果综述。
