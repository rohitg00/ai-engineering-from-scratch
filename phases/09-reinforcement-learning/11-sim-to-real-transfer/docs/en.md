# Sim-to-Real Transfer

> simulator で訓練した policy が hardware で失敗するなら、それは simulator を暗記した policy である。Domain randomization、domain adaptation、system identification は、学習済み controller に reality gap を越えさせるための3つの道具である。

**タイプ:** Learn
**言語:** Python
**前提条件:** Phase 9 · 08 (PPO)、Phase 2 · 10 (Bias/Variance)
**時間:** 約45分

## 問題

本物のロボットを訓練するのは遅く、危険で、高価である。二足歩行ロボットが歩くことを学ぶには何百万もの training episode が必要だが、本物の二足歩行機は一度転ぶだけで hardware が壊れる。Simulation は無制限の reset、決定的な再現性、parallel environment、物理的損傷なしの訓練を与えてくれる。

しかし simulator は間違っている。bearing は MuJoCo model より摩擦が大きい。camera には simulator が含めていない lens distortion がある。motor には delay、backlash、saturation があり、99% の sim model はそれを省く。風、埃、変化する照明は、無菌的な rendering で訓練された policy を台無しにする。**reality gap**、つまり sim distribution と real distribution の系統的な差が、robotics における deployed RL の中心問題である。

必要なのは、*sim-to-real distribution shift に robust* な policy である。歴史的な approach は3つある。simulator を randomize する (domain randomization)、少量の real data で policy を adapt する (domain adaptation / fine-tuning)、または real system の parameter を同定して合わせる (system identification)。2026年の支配的な recipe は、この3つを massive parallel simulation (Isaac Sim、Isaac Lab、GPU 上の Mujoco MJX) と組み合わせる。

## コンセプト

![Three sim-to-real regimes: domain randomization, adaptation, system identification](../assets/sim-to-real.svg)

**Domain Randomization (DR)。** Tobin et al. 2017、Peng et al. 2018。training 中に、本物の robot と異なりうるすべての sim parameter を randomize する。mass、friction coefficient、motor PD gain、sensor noise、camera position、lighting、texture、contact model などである。policy は「今日どの sim にいるのか」に関する条件付き分布を学び、全範囲に generalize する。real robot が training envelope の内側に入っていれば、policy は機能する。

- **利点:** real data が不要。1つの recipe で多くの robot に使える。
- **欠点:** 過度に randomize した training は、「universal」だが過度に慎重な policy を生む。noise が多すぎるのは regularization が強すぎるのと同じである。

**System Identification (SI)。** training 前に simulator の parameter を real-world data に fit する。本物の robot arm の joint friction を測定できるなら、それを sim に入れる。その後、その値を前提とする policy を訓練する。real system への access が必要だが、reality gap を直接減らす。

- **利点:** precise で低ノイズな training target。
- **欠点:** 残った model error は policy から見えない。motor deadband のような小さな未同定 effect が deployment を壊すことがある。

**Domain Adaptation。** sim で訓練し、少量の real data で fine-tune する。2つの flavor がある。

- **Real2Sim2Real:** real rollout を使って residual simulator `f(s, a, z) - f_sim(s, a)` を学習し、補正済み sim で訓練する。少量の real data で gap を閉じる。
- **Observation adaptation:** real obs → sim-like obs に写す policy を、学習済み feature extractor (例: GAN pixel-to-pixel) で訓練する。controller は sim の中に留まる。

**Privileged learning / teacher-student。** Miki et al. 2022 (ANYmal quadruped)。simulation 内で、privileged information (ground truth friction、terrain height、IMU drift) に access できる*teacher*を訓練する。real-sensor observation だけを見る*student*へ distill する。student は history から privileged feature を推定することを学び、物理 parameter 全体に robust になる。

**Massively parallel simulation。** 2024〜2026年。Isaac Lab、Mujoco MJX、Brax はすべて、単一 GPU 上で何千もの parallel robot を実行する。4,096 体の parallel humanoid を使う PPO は、数年分の経験を数時間で集める。training distribution が広がるにつれ「reality gap」は縮む。それら 4,096 env のそれぞれが異なる randomized parameter を持てるため、DR はほぼ無料になる。

**2026年の実世界 recipe (quadruped walking の例):**

1. gravity、friction、motor gain、payload を domain-randomized した massively parallel sim。
2. privileged info (terrain map、body velocity ground truth) を持つ teacher policy を訓練する。
3. proprioception (leg joint encoder) だけを使う student policy を teacher から distill する。
4. 必要なら real IMU 上の autoencoder による observation adaptation。
5. Deploy。10以上の environment で zero-shot。失敗する場合は safety-constrained PPO で数分の real-world fine-tuning を行う。

## 作るもの

このレッスンの code は、*noisy* transition を持つ GridWorld 上での domain randomization の小さなデモである。「sim」では randomized slip probability を経験する policy を訓練し、training 中に見ていない slip level の「real」で評価する。この形は MuJoCo-to-hardware transfer にそのまま対応する。

### Step 1: parameterized sim

```python
def step(state, action, slip):
    if rng.random() < slip:
        action = random_perpendicular(action)
    ...
```

`slip` は simulator が公開する parameter である。実 robotics では friction、mass、motor gain など、sim と real の間でずれるものなら何でもよい。

### Step 2: DR で訓練する

各 episode の開始時に `slip ~ Uniform[0.0, 0.4]` を sample する。PPO / Q-learning / 任意の手法で訓練する。これを多くの episode で行う。

### Step 3: 「real」slip で zero-shot 評価する

`slip ∈ {0.0, 0.1, 0.2, 0.3, 0.5, 0.7}` で評価する。最初の4つは training support 内で、`0.5` と `0.7` は外側である。DR-trained policy は support 内で near-optimal を保ち、外側では graceful に劣化するはずである。fixed-slip-trained policy は training slip の外で brittle になる。

### Step 4: narrow training と比較する

`slip = 0.0` だけで2つ目の policy を訓練する。同じ `slip` sweep で評価する。real slip > 0 になるとすぐに catastrophic drop が見えるはずである。

## 落とし穴

- **Randomization が多すぎる。** `slip ∈ [0, 0.9]` で訓練すると、policy は risk-averse になりすぎて optimal path を試さなくなる。"anything could happen" ではなく、*期待される* real-world distribution に合わせる。
- **Randomization が少なすぎる。** 薄い slice で訓練すると、policy はまったく generalize できない。policy が改善するにつれて distribution を広げる adaptive curriculum (Automatic Domain Randomization) を使う。
- **Parameter space の同定ミス。** real gap が motor delay なのに camera hue を randomize しても DR は助けにならない。先に real robot を profile する。
- **Privileged info leakage。** teacher が observation だけでなく global state を action に使うと、student が追いつけないものを生成しうる。teacher の policy が student の observation history から実現可能であることを確認する。
- **Sim-to-sim transfer failure。** より難しい sim variant に robust でない policy は、real world にも robust ではない。deploy 前に必ず held-out sim variant で test する。
- **Real-world safety envelope がない。** sim で機能し「real でも機能する」policy でも、low-level safety shield がなければ hardware を壊しうる。rate limit、torque limit、joint limit を non-learned controller に追加する。

## 使いどころ

2026年の sim-to-real stack:

| Domain | Stack |
|--------|-------|
| Legged locomotion (ANYmal, Spot, humanoid) | Isaac Lab + DR + privileged teacher / student |
| Manipulation (dexterous hands, pick-and-place) | Isaac Lab + DR + DR-GAN for vision |
| Autonomous driving | CARLA / NVIDIA DRIVE Sim + DR + real fine-tune |
| Drone racing | RotorS / Flightmare + DR + online adaptation |
| Finger/in-hand manipulation | OpenAI Dactyl (未曾有の scale の DR) |
| Industrial arms | MuJoCo-Warp + SI + small real fine-tune |

あらゆる scale の control で workflow は一貫している。sim をできる限り fit し、fit できないものを randomize し、巨大な policy を訓練し、distill し、safety shield 付きで deploy する。

## 出荷するもの

`outputs/skill-sim2real-planner.md` として保存する:

```markdown
---
name: sim2real-planner
description: 与えられた robot + task に対して、DR、SI、安全性を含む sim-to-real transfer pipeline を計画する。
version: 1.0.0
phase: 9
lesson: 11
tags: [rl, sim2real, robotics, domain-randomization]
---

robot platform、task、real hardware time への access を受け取り、次を出力する:

1. Reality gap inventory。想定される source を expected impact 順に rank する (contact、sensing、actuation delay、vision)。
2. DR parameters。正確な list、range、distribution。各 range を実測値に照らして正当化する。
3. SI steps。測定すべき parameter と measurement method。
4. Teacher/student split。teacher が使う privileged info と、student が使う obs。
5. Safety envelope。low-level limits、emergency stops、backup controller。

(a) zero-shot sim-variant test、(b) safety shield、(c) rollback plan なしの deployment を拒否する。測定された実世界 variability の 3× より広い DR range は、over-randomized の可能性が高いと flag する。
```

## 演習

1. **Easy。** fixed-slip GridWorld (slip=0.0) で Q-learning agent を訓練する。slip ∈ {0.0, 0.1, 0.3, 0.5} で評価する。return vs slip を plot する。
2. **Medium。** `slip ~ Uniform[0, 0.3]` を sample する DR Q-learning agent を訓練する。同じ sweep で評価する。slip=0.5 (out-of-distribution) で DR はどれだけ効くか。
3. **Hard。** curriculum を実装する。slip=0.0 から始め、policy が optimal の 90% に達するたびに DR range を広げる。slip=0.3 zero-shot に到達するまでの total environment steps を fixed DR baseline と比較する。

## 重要用語

| 用語 | よく言われる表現 | 実際の意味 |
|------|-----------------|-----------------------|
| Reality gap | 「Sim-to-real difference」 | training と deployment の physics/sensing の distribution shift。 |
| Domain randomization (DR) | 「random sim 全体で訓練」 | training 中に sim parameter を randomize し、policy を generalize させる。 |
| System identification (SI) | 「real を測って sim に fit」 | real physical parameter を推定し、sim を一致させる。 |
| Domain adaptation | 「real data で fine-tune」 | sim training 後の小規模 real-world fine-tune。obs または dynamics を adapt する場合がある。 |
| Privileged info | 「teacher の ground truth」 | sim だけが持つ information。student は obs history から推定しなければならない。 |
| Teacher/student | 「privileged -> observable の distill」 | shortcut 付き teacher を訓練し、student がそれなしで模倣する。 |
| ADR | 「Automatic Domain Randomization」 | policy の改善に合わせて DR range を広げる curriculum。 |
| Real2Sim | 「real data で gap を閉じる」 | sim が real rollout を模倣するよう residual を学習する。 |

## 参考文献

- [Tobin et al. (2017). Domain Randomization for Transferring Deep Neural Networks from Simulation to the Real World](https://arxiv.org/abs/1703.06907) — original DR paper (robotics vision)。
- [Peng et al. (2018). Sim-to-Real Transfer of Robotic Control with Dynamics Randomization](https://arxiv.org/abs/1710.06537) — dynamics 向け DR、quadruped locomotion。
- [OpenAI et al. (2019). Solving Rubik's Cube with a Robot Hand](https://arxiv.org/abs/1910.07113) — Dactyl、大規模 ADR。
- [Miki et al. (2022). Learning robust perceptive locomotion for quadrupedal robots in the wild](https://www.science.org/doi/10.1126/scirobotics.abk2822) — ANYmal 向け teacher-student。
- [Makoviychuk et al. (2021). Isaac Gym: High Performance GPU Based Physics Simulation for Robot Learning](https://arxiv.org/abs/2108.10470) — 2025〜2026年の deployment を支える massively parallel sim。
- [Akkaya et al. (2019). Automatic Domain Randomization](https://arxiv.org/abs/1910.07113) — ADR curriculum method。
- [Sutton & Barto (2018). Ch. 8 — Planning and Learning with Tabular Methods](http://incompleteideas.net/book/RLbook2020.pdf) — modern sim-to-real pipeline の土台である Dyna framing (model を planning + rollout に使う)。
- [Zhao, Queralta & Westerlund (2020). Sim-to-Real Transfer in Deep Reinforcement Learning for Robotics: a Survey](https://arxiv.org/abs/2009.13303) — sim-to-real method の taxonomy と benchmark results。
