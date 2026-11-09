# 转移到真实

> 训练在模拟器中失败的硬件是记住模拟器的政策.域名随机化,域名适应和系统识别是让学到的控制器跨越现实差距的三个工具.

**Type:** Learn
**Languages:** Python, TypeScript
**Prerequisites:** Phase 9 · 08 (PPO), Phase 2 · 10 (Bias/Variance)
**Time:** ~45 minutes

## 问题

训练一个真正的机器人是慢,危险,昂贵的.双脚需要数百万次训练才能学会走路;一个真正的双脚即使一旦打破硬件,也会摔倒.模拟给你无限的重置,确定性可复制性,并行环境,没有物理损害.

模拟器是错误的.轴承比MuJoCo模型更有摩擦.相机有镜头扭曲.模拟器不包括.电机有延误,反响和和99%的Sim模型跳过.风,尘埃和变量照明破坏了训练在无菌的染的政策.**reality gap**系统性区别在真实分布和Sim分布之间是机器人部署RL的核心问题.

需要一个可靠的政策, 历史方法:随机化模拟器 (域名随机化),使用一些实际数据 (域名适应/细调) 调整政策,或识别实际系统的参数并匹配它们 (系统识别). 2026年,主导的配方将所有三种配方都结合到大型并行模拟 (GPU上的Isaac Sim,Isaac Lab,Mujoco MJX).

## 概念

![Three sim-to-real regimes: domain randomization, adaptation, system identification](../assets/sim-to-real.svg)

**Domain Randomization (DR).**其他类型 2017年,潘等 美国 在训练期间,随机定制每一个可能在实际机器人上不同的模拟参数:质量,摩擦系数,电动PD增长,传感器噪音,摄像头位置,照明,纹理,接触模型. 政策学习了"今天的情况"的条件分布,并将其在整个范围进行概括. 如果真正的机器人属于训练包,

- **Upside:**没有真正的数据,只需要一个食谱,很多机器人.
- **Downside:**过度随机化培训产生了"普遍"但过于谨慎的政策.

**System Identification (SI).**训练前将模拟器的参数与现实数据调整.如果你能测量实机器人的臂关节摩擦,将其插入在模拟器中.然后训练一个预期这些值的政策.需要访问实系统,但直接减少现实差距.

- **Upside:**精确的低噪音训练目标.
- **Downside:**剩余模型错误是政策看不见的;小小的未识别的效应 (例如,电动带) 仍然破坏了部署.

**Domain Adaptation.**训练在模拟,微调用少量真实数据.

- **Real2Sim2Real:**学习一个残余模拟器$f(s, a, z) - f_{\text{sim}}(s, a)$通过使用真实推广,在修改的模拟中训练. 没有太多真实数据就关闭了差距.
- **Observation adaptation:**通过学习的特征提取器 (例如GAN像素到像素) 绘制真实obs →sim类似的obs的策略.控制器保持在sim.

**Privileged learning / teacher-student.**学生们可以从历史中推断特权特征,在物理参数中强. 学生们可以从历史中推断特权特征,在物理参数中强. 学生们可以从历史中推断特权特征.

**Massively parallel simulation.**20242026年.艾萨克实验室,Mujoco MJX,Brax都在一个GPU上运行数千个并行机器人.PPO拥有4,096个并行人形,在几个小时内收集了多年的经验.随着训练分布的扩大,"现实差距"缩小;当这些4,096个 envs中的每个具有不同的随机参数时,DR几乎变得自由.

**The real-world 2026 recipe (quadruped walking example):**

1. 具有域式随机引力,摩擦,动力增长,有效载荷.
2. 教师政策训练有素的信息 (地图,身体速度地图).
3. 学生政策仅使用自体感 (腿关节编码器) 来从教师中炼.
4. 通过真实IMU的自动编码器进行可选的观察适应.
5. 如果它失败,用安全限制的PPO进行几分钟的现实世界细节调整.

```figure
f3-reality-gap
```

## 建立它

本课程的代码是 GridWorld上随机域定位的小示范,具有 *噪音*的过渡.我们训练了一个政策,在"sim"中体验到随机滑梯概率,并以"真实"评估,使用训练中从未见过的滑梯水平.形状直接映射到MuJoCo到硬件转移.

### 步骤1:参数化Sim

```python
def step(state, action, slip):
    if rng.random() < slip:
        action = random_perpendicular(action)
    ...
```

`slip`在真实机器人中,它可能是摩擦,质量,运动增长 任何在真实和真实之间转移的东西.

### 步骤2:与DR一起训练

在每一集的开始,`slip ~ Uniform[0.0, 0.4]`训练PPO/Q学习/任何东西.

### 步骤3:评估"真实"的分片中零射击

评估`slip ∈ {0.0, 0.1, 0.2, 0.3, 0.5, 0.7}`首先,四个项目包括培训支持.`0.5`其他`0.7`对于外围的运动, DR训练的运动应该保持在内部的支持中接近最佳水平,在外面却会显著降低.

### 步骤4:与狭窄的训练相比

培养第二个政策`slip = 0.0`只有在同一方面进行评估`slip`实际滑动时就会出现灾难性的下降.

## 陷

- **Too much randomization.**列车上线`slip ∈ [0, 0.9]`您的政策是如此的不愿意冒险,它从来没有尝试最佳的路径.
- **Too little randomization.**训练在一个薄片,政策根本不能通用. 使用适应课程 (自动域名随机化),随着政策的改善,扩大分布.
- **Misidentified parameter space.**随机定位错误的东西 (当真实差距是运动延迟时,摄像头的色调)
- **Privileged info leakage.**通过使用全球状态来进行行动,而不是仅仅进行观察, 教授可以产生无法追赶的学生.
- **Sim-to-sim transfer failure.**如果您的政策不适合更难的模拟变体,它也不适合现实世界.
- **No real-world safety envelope.**没有低级安全屏蔽的"真实工作"的政策仍然可以打破硬件. 在未学习的控制器中添加速度限制,扭矩限制,关节限制.

## 用它

现在,我们要做什么?

| Domain | Stack |
|--------|-------|
| Legged locomotion (ANYmal, Spot, humanoid) | Isaac Lab + DR + privileged teacher / student |
| Manipulation (dexterous hands, pick-and-place) | Isaac Lab + DR + DR-GAN for vision |
| Autonomous driving | CARLA / NVIDIA DRIVE Sim + DR + real fine-tune |
| Drone racing | RotorS / Flightmare + DR + online adaptation |
| Finger/in-hand manipulation | OpenAI Dactyl (DR at unprecedented scale) |
| Industrial arms | MuJoCo-Warp + SI + small real fine-tune |

为了在所有尺度上控制,工作流程是一致的:尽可能适应模拟器,随机定制无法适应的,

## 运送它

保存如`outputs/skill-sim2real-planner.md`其他:

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

## 运动

1. **Easy.**训练一个Q学习代理在固定滑动格里德世界 (滑动=0.0).$\text{slip} \in \lbrace 0.0, 0.1, 0.3, 0.5 \rbrace$阴谋反弹与反弹.
2. **Medium.**训练一个DRQ学习代理样本`slip ~ Uniform[0, 0.3]`根据"分销"的价格,DR在0.5分时购买多少钱?
3. **Hard.**实施课程:从滑=0.0开始,每当政策达到90%的最佳时,扩大DR范围. 测量环境的总步骤,以达到滑=0.3的零射与固定DR基线.

## 关键词

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Reality gap | "Sim-to-real difference" | Distribution shift between training and deployment physics/sensing. |
| Domain randomization (DR) | "Train across random sims" | Randomize sim parameters during training so policy generalizes. |
| System identification (SI) | "Measure real and fit sim" | Estimate real physical parameters; set sim to match. |
| Domain adaptation | "Fine-tune on real data" | Small real-world fine-tune after sim training; may adapt obs or dynamics. |
| Privileged info | "Ground truth for teacher" | Information only the sim has; student must infer it from obs history. |
| Teacher/student | "Distill privileged -> observable" | Teacher trained with shortcuts; student learns to mimic without them. |
| ADR | "Automatic Domain Randomization" | Curriculum that widens DR ranges as the policy improves. |
| Real2Sim | "Close the gap with real data" | Learn a residual to make the sim mimic real rollouts. |

## 进一步阅读

- [Tobin et al. (2017). Domain Randomization for Transferring Deep Neural Networks from Simulation to the Real World](https://arxiv.org/abs/1703.06907)原始的DR论文 (机器人技术的视觉).
- [Peng et al. (2018). Sim-to-Real Transfer of Robotic Control with Dynamics Randomization](https://arxiv.org/abs/1710.06537) 动力,四次机动的DR.
- [OpenAI et al. (2019). Solving Rubik's Cube with a Robot Hand](https://arxiv.org/abs/1910.07113) 达克泰尔,ADR在尺度上.
- [Miki et al. (2022). Learning robust perceptive locomotion for quadrupedal robots in the wild](https://www.science.org/doi/10.1126/scirobotics.abk2822)为 ANYmal 的教师-学生.
- [Makoviychuk et al. (2021). Isaac Gym: High Performance GPU Based Physics Simulation for Robot Learning](https://arxiv.org/abs/2108.10470)引发2025~2026次部署的巨大平行模拟器.
- [Akkaya et al. (2019). Automatic Domain Randomization](https://arxiv.org/abs/1910.07113)ADR课程方法.
- [Sutton & Barto (2018). Ch. 8 — Planning and Learning with Tabular Methods](http://incompleteideas.net/book/RLbook2020.pdf)Dyna框架 (用于规划+推广模型),支持现代的真实模拟管道.
- [Zhao, Queralta & Westerlund (2020). Sim-to-Real Transfer in Deep Reinforcement Learning for Robotics: a Survey](https://arxiv.org/abs/2009.13303)与基准结果的真实模拟方法分类.
