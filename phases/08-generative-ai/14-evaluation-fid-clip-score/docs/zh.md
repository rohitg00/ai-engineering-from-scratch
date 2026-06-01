# 14 · 评测——FID、CLIP Score 与人类偏好

> 每一个生成模型排行榜都会引用 FID、CLIP score，以及来自人类偏好竞技场的胜率。每一个数字都有一种可被有心的研究者钻空子的失效模式。如果你不了解这些失效模式，你就无法把真正的进步与刷分的把戏区分开来。

**类型：** 实战
**语言：** Python
**前置：** 阶段 8 · 01（分类体系）、阶段 2 · 04（评测指标）
**时长：** 约 45 分钟

## 问题所在

一个生成模型要在「样本质量（sample quality）」和「条件遵循度（conditioning adherence）」两个维度上被评判。这两者都没有闭式（closed-form）的度量方法。你的模型得渲染出 10000 张图像；必须有某种东西给它们打上分数；而你又必须信任这些分数——跨模型家族、跨分辨率、跨架构地信任。在 2014—2026 年这场大浪淘沙中，有三种指标活了下来：

- **FID（Fréchet Inception Distance，弗雷歇 Inception 距离）。** 它衡量真实分布与生成分布两个分布之间，在 Inception 网络特征空间中的距离。越低越好。
- **CLIP score。** 即生成图像的 CLIP 图像嵌入与提示词的 CLIP 文本嵌入之间的余弦相似度（cosine similarity）。越高越好。用于衡量提示词遵循度。
- **人类偏好（human preference）。** 在同一个提示词上让两个模型正面对决，由人类（或一个 GPT-4 级别的模型）挑出更好的那个，再汇总成一个 Elo 分数。

你还会见到：IS（inception score，已基本退役）、KID、CMMD、ImageReward、PickScore、HPSv2、MJHQ-30k。每一种都修正了前一种的某一个失效点。

## 核心概念

〔图：FID、CLIP 与偏好——三个维度、不同的失效模式〕

### FID——样本质量

出自 Heusel 等人（2017）。步骤如下：

1. 为 N 张真实图像和 N 张生成图像分别提取 Inception-v3 特征（2048 维）。
2. 为每一组拟合一个高斯分布：计算均值 `μ_r, μ_g` 与协方差 `Σ_r, Σ_g`。
3. FID = `||μ_r - μ_g||² + Tr(Σ_r + Σ_g - 2 · (Σ_r · Σ_g)^0.5)`。

解读：它是特征空间中两个多元高斯分布之间的弗雷歇距离。越低 = 两个分布越相似。

失效模式：
- **小 N 下有偏。** FID 是在特征分布上做的均方计算——N 太小会低估协方差，从而给出虚低的 FID。永远使用 N ≥ 10000。
- **依赖 Inception。** Inception-v3 是在 ImageNet 上训练的。与 ImageNet 差异较大的领域（人脸、艺术作品、文字图像）会产生毫无意义的 FID。这种情况下应使用领域专用的特征提取器。
- **可被刷分。** 过拟合到 Inception 先验会在视觉质量毫无改善的情况下拉低 FID。可用 CMMD（见下文）来对抗它。

### CLIP score——提示词遵循度

出自 Radford 等人（2021）。对于一张生成图像 + 一条提示词：

```
clip_score = cos_sim( CLIP_image(x_gen), CLIP_text(prompt) )
```

在 3 万张生成图像上取平均 → 得到一个可在不同模型间比较的标量。

失效模式：
- **CLIP 自身的盲区。** CLIP 的组合推理能力较弱（「一个红色立方体放在一个蓝色球体上」往往会失败）。模型可以在 CLIP score 上排名靠前，却并未真正遵循复杂提示词。
- **短提示词偏好。** 在真实数据中，短提示词往往有更多与之匹配的 CLIP 图像。较长的提示词在机制上会得到更低的 CLIP score。
- **提示词刷分。** 在提示词里塞入「high quality, 4k, masterpiece」会在不改善图文绑定的前提下虚高 CLIP score。

CMMD（Jayasumana 等人，2024）修正了其中一些问题：它使用 CLIP 特征而非 Inception 特征，使用最大均值差异（maximum-mean discrepancy）而非弗雷歇距离。它在检测细微的质量差异上更胜一筹。

### 人类偏好——金标准

选定一组提示词。分别用模型 A 和模型 B 生成。把成对结果展示给人类（或一个强力的 LLM 评判者）。把胜负汇总成 Elo 或 Bradley-Terry 分数。常用基准：

- **PartiPrompts（Google）**：1600 条多样化提示词，覆盖 12 个类别。
- **HPSv2**：10.7 万条人类标注，被广泛用作自动化代理指标。
- **ImageReward**：13.7 万对提示词—图像偏好对，采用 MIT 许可。
- **PickScore**：在 Pick-a-Pic 的 260 万条偏好数据上训练。
- **Chatbot-Arena 风格的图像竞技场**：https://imagearena.ai/ 等。

失效模式：
- **评判者方差。** 非专业人士的偏好与专家不同。两者都要用。
- **提示词分布。** 精挑细选的提示词会偏袒某一类模型。务必如实记录。
- **LLM 评判者奖励作弊。** GPT-4 评判者会被「好看但错误」的输出蒙骗。要与人类评判交叉验证。

## 配合使用

一份生产级的评测报告应当包含：

1. 在 1 万—3 万样本上、相对一个留出的真实分布计算 FID（样本质量）。
2. 在同一批样本上、相对其提示词计算 CLIP score / CMMD（遵循度）。
3. 在盲测竞技场中相对上一版模型的胜率（整体偏好）。
4. 失效模式分析：随机抽样 50 个输出，逐一标记已知问题（手部解剖结构、文字渲染、物体数量是否一致）。

任何单一指标都是谎言。三个相互印证的指标 + 定性审查才构成一个站得住脚的论断。

## 动手实现

`code/main.py` 在合成的「特征向量」上实现了 FID、类 CLIP-score 以及 Elo 汇总（我们用 4 维向量充当 Inception 特征的替身）。你会看到：

- 在小 N 和大 N 上的 FID 计算——即偏差。
- 把「CLIP score」实现为两组特征之间的余弦相似度。
- 从一条合成的偏好数据流中执行 Elo 更新规则。

### 第 1 步：四行实现 FID

```python
def fid(real_features, gen_features):
    mu_r, cov_r = mean_and_cov(real_features)
    mu_g, cov_g = mean_and_cov(gen_features)
    mean_diff = sum((a - b) ** 2 for a, b in zip(mu_r, mu_g))
    trace_term = trace(cov_r) + trace(cov_g) - 2 * sqrt_cov_product(cov_r, cov_g)
    return mean_diff + trace_term
```

### 第 2 步：CLIP 风格的余弦相似度

```python
def clip_like(image_feat, text_feat):
    dot = sum(a * b for a, b in zip(image_feat, text_feat))
    norm = math.sqrt(dot_self(image_feat) * dot_self(text_feat))
    return dot / max(norm, 1e-8)
```

### 第 3 步：Elo 汇总

```python
def elo_update(r_a, r_b, winner, k=32):
    expected_a = 1 / (1 + 10 ** ((r_b - r_a) / 400))
    actual_a = 1.0 if winner == "a" else 0.0
    r_a_new = r_a + k * (actual_a - expected_a)
    r_b_new = r_b - k * (actual_a - expected_a)
    return r_a_new, r_b_new
```

## 常见陷阱

- **N=1000 时的 FID。** 该启发式在 N 低于 1 万时不可靠。报告低 N 下 FID 的论文是在刷分。
- **跨分辨率比较 FID。** Inception 的 299×299 缩放会改变特征分布。只能在分辨率相匹配的前提下比较。
- **只报告单个种子。** 至少跑 3 个种子。报告标准差。
- **用负向提示词（negative prompts）抬高 CLIP score。** 有些流水线靠过拟合提示词来拉高 CLIP。要检查是否出现视觉过饱和。
- **提示词重叠导致的 Elo 偏差。** 如果两个模型在训练时都见过某个基准提示词，那么 Elo 就毫无意义。要使用留出的提示词集。
- **付费众包的人类评测偏斜。** Prolific、MTurk 上的标注者整体偏年轻 / 偏科技友好型。要与招募来的艺术 / 设计专家混合使用。

## 实际运用

2026 年的生产级评测协议：

| 支柱 | 最低要求 | 推荐做法 |
|--------|---------|-------------|
| 样本质量 | 在 1 万样本上相对留出真实集计算 FID | + 在 5 千样本上算 CMMD + 按类别在子集上算 FID |
| 提示词遵循度 | 在 3 万样本上算 CLIP score | + HPSv2 + ImageReward + VQA 式问答 |
| 偏好 | 相对基线做 200 对盲测 | + 2000 对人类配对 + LLM 评判 + Chatbot Arena |
| 失效分析 | 50 个人工标记 | 500 个人工标记 + 自动化安全分类器 |

四个支柱齐备于一份报告 = 论断。任何一个单独出现 = 营销。

## 交付落地

保存 `outputs/skill-eval-report.md`。该技能接收一个新的模型检查点 + 一个基线，输出一份完整的评测方案：样本量、各项指标、失效模式探针、签收（sign-off）标准。

## 练习

1. **简单。** 运行 `code/main.py`。在相同的合成分布上比较 N=100 与 N=1000 时的 FID。报告偏差幅度。
2. **中等。** 基于合成的 CLIP 风格特征实现 CMMD（公式见 Jayasumana 等人，2024）。比较它与 FID 在对质量差异的敏感度上的差别。
3. **困难。** 复现 HPSv2 的设置：从 Pick-a-Pic 的一个子集中取 1000 对图像—提示词对，在这些偏好数据上微调一个小型的基于 CLIP 的打分器，并衡量它与一个留出集的一致性。

## 关键术语

| 术语 | 人们的说法 | 它实际的含义 |
|------|-----------------|-----------------------|
| FID | 「弗雷歇 Inception 距离」 | 对真实与生成的 Inception 特征拟合高斯分布后两者间的弗雷歇距离。 |
| CLIP score | 「图文相似度」 | CLIP 图像嵌入与文本嵌入之间的余弦相似度。 |
| CMMD | 「FID 的替代品」 | 基于 CLIP 特征的 MMD；偏差更小，不假设高斯分布。 |
| IS | 「Inception score」 | Exp KL(p(y|x) || p(y))；在现代模型上相关性很差，已退役。 |
| HPSv2 / ImageReward / PickScore | 「学习得到的偏好代理」 | 在人类偏好上训练的小模型；用作自动评判者。 |
| Elo | 「国际象棋评分」 | 对两两胜负进行 Bradley-Terry 汇总。 |
| PartiPrompts | 「那套基准提示词集」 | Google 精选的 1600 条提示词，覆盖 12 个类别。 |
| FD-DINO | 「自监督替代品」 | 使用 DINOv2 特征的 FD；在 ImageNet 之外的领域表现更好。 |

## 生产提示：评测本身也是一种推理工作负载

在 1 万样本上跑 FID 意味着要生成 1 万张图像。对于一个在单张 L4 上以 1024² 分辨率跑 50 步的 SDXL base 来说，那就是约 11 小时的单请求推理。评测预算是实打实的，而这个场景恰好就是离线推理的典型情形（最大化吞吐量，忽略 TTFT）：

- **狠批量，别管延迟。** 离线评测 = 在显存能容纳的最大尺寸上做静态批处理。在一张 80GB 的 H100 上，`pipe(...).images` 配合 `num_images_per_prompt=8`，其墙钟时间比单请求快 4—6 倍。
- **缓存真实特征。** 在真实参照集上做的 Inception（FID）或 CLIP（CLIP-score、CMMD）特征提取只需运行*一次*，存成一个 `.npz`。不要每次评测都重算。

用于 CI / 回归门禁：每个 PR 在 500 样本子集上跑 FID + CLIP score（约 30 分钟）；每晚跑完整的 1 万 FID + HPSv2 + Elo。

## 延伸阅读

- [Heusel et al. (2017). GANs Trained by a Two Time-Scale Update Rule Converge to a Local Nash Equilibrium (FID)](https://arxiv.org/abs/1706.08500) —— FID 论文。
- [Jayasumana et al. (2024). Rethinking FID: Towards a Better Evaluation Metric for Image Generation (CMMD)](https://arxiv.org/abs/2401.09603) —— CMMD。
- [Radford et al. (2021). Learning Transferable Visual Models from Natural Language Supervision (CLIP)](https://arxiv.org/abs/2103.00020) —— CLIP。
- [Wu et al. (2023). HPSv2: A Comprehensive Human Preference Score](https://arxiv.org/abs/2306.09341) —— HPSv2。
- [Xu et al. (2023). ImageReward: Learning and Evaluating Human Preferences for Text-to-Image Generation](https://arxiv.org/abs/2304.05977) —— ImageReward。
- [Yu et al. (2023). Scaling Autoregressive Models for Content-Rich Text-to-Image Generation (Parti + PartiPrompts)](https://arxiv.org/abs/2206.10789) —— PartiPrompts。
- [Stein et al. (2023). Exposing flaws of generative model evaluation metrics](https://arxiv.org/abs/2306.04675) —— 失效模式综述。
