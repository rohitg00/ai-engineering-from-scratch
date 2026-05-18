# 评估 —— FID、CLIP Score、人类偏好

> 每个生成模型排行榜都会引用 FID、CLIP score 和人类偏好竞技场的胜率。每个数字都有一个坚定的研究者可以钻空子的失效模式。如果你不知道这些失效模式，你就无法区分真正的改进和钻空子的运行。

**类型：** 构建
**语言：** Python
**先修知识：** 第 8 阶段 · 01（分类法）、第 2 阶段 · 04（评估指标）
**时间：** ~45 分钟

## 问题

生成模型根据*样本质量*和*条件遵循度*来评判。两者都没有闭式度量。你的模型必须渲染 10,000 张图像；必须有东西给它们打分；你必须跨模型家族、跨分辨率、跨架构地信任这些数字。三个指标在 2014-2026 年的考验中幸存下来：

- **FID（Fréchet Inception Distance）。** 在 Inception 网络特征空间中两个分布——真实和生成——之间的距离。越低越好。
- **CLIP score。** 生成图像的 CLIP-image embedding 与提示词的 CLIP-text embedding 之间的余弦相似度。越高越好。衡量提示遵循度。
- **人类偏好。** 在同一提示词下让两个模型正面交锋，让人类（或 GPT-4 级别的模型）挑选更好的一个，汇总为 Elo 分数。

你还会看到：IS（inception score，基本退役）、KID、CMMD、ImageReward、PickScore、HPSv2、MJHQ-30k。每一个都纠正了前一个的某个失效模式。

## 概念

![FID、CLIP 和偏好：三个轴，不同的失效模式](../assets/evaluation.svg)

### FID —— 样本质量

Heusel 等人（2017）。步骤：

1. 为 N 张真实图像和 N 张生成图像提取 Inception-v3 特征（2048 维）。
2. 为每个池拟合一个高斯分布：计算均值 `μ_r, μ_g` 和协方差 `Σ_r, Σ_g`。
3. FID = `||μ_r - μ_g||² + Tr(Σ_r + Σ_g - 2 · (Σ_r · Σ_g)^0.5)`。

解释：特征空间中两个多元高斯分布之间的 Fréchet 距离。越低 = 分布越相似。

失效模式：
- **小 N 偏差。** FID 是特征分布上的均方——小 N 会低估协方差，给出虚假的低 FID。始终使用 N ≥ 10,000。
- **依赖 Inception。** Inception-v3 是在 ImageNet 上训练的。远离 ImageNet 的领域（人脸、艺术、文字图像）会产生无意义的 FID。使用领域特定的特征提取器。
- **钻空子。** 对 Inception 先验过拟合可以在没有视觉质量改进的情况下给出低 FID。用 CMMD（见下）来击败它。

### CLIP score —— 提示遵循度

Radford 等人（2021）。对于生成图像 + 提示词：

```
clip_score = cos_sim( CLIP_image(x_gen), CLIP_text(prompt) )
```

在 30k 生成图像上取平均 → 一个可在模型间比较的标量。

失效模式：
- **CLIP 自身的盲点。** CLIP 的组合推理能力较弱（"一个红色立方体在一个蓝色球体上"经常失败）。模型可以在 CLIP score 上排名很好，而不真正遵循复杂提示词。
- **短提示词偏差。** 短提示词在野外有更多 CLIP-image 匹配。更长的提示词机械地具有更低的 CLIP score。
- **提示词钻空子。** 在提示词中包含"high quality, 4k, masterpiece"会抬高 CLIP score，而不改善图像-文本绑定。

CMMD（Jayasumana 等人，2024）修复了其中一些问题：使用 CLIP 特征代替 Inception，使用最大均值差异（maximum-mean discrepancy）代替 Fréchet。在检测细微质量差异方面更好。

### 人类偏好 ——  ground truth

挑选一个提示词池。用模型 A 和模型 B 生成。将成对结果展示给人类（或一个强大的 LLM 评判者）。将胜场汇总为 Elo 或 Bradley-Terry 分数。基准测试：

- **PartiPrompts (Google)**：1,600 个多样化的提示词，12 个类别。
- **HPSv2**：107k 人类标注，广泛用作自动化代理。
- **ImageReward**：137k 提示词-图像偏好对，MIT 许可。
- **PickScore**：在 Pick-a-Pic 260 万偏好上训练。
- **Chatbot-Arena 风格的图像竞技场**：https://imagearena.ai/ 等。

失效模式：
- **评判者差异。** 非专家与专家的偏好不同。两者都用。
- **提示词分布。** 精心挑选的提示词偏袒某个家族。始终记录。
- **LLM-judge 奖励黑客。** GPT-4-judge 会被漂亮但错误的输出欺骗。用人类进行三角验证。

## 一起使用

一份生产级评估报告应包括：

1. 在 10-30k 样本上对保留的真实分布的 FID（样本质量）。
2. 相同样本与其提示词之间的 CLIP score / CMMD（遵循度）。
3. 在与先前模型的盲测竞技场中的胜率（整体偏好）。
4. 失效模式分析：50 个随机采样输出，标记已知问题（手部解剖、文字渲染、一致的对象数量）。

任何单一指标都是谎言。三个相互印证的指标 + 定性审查才是一个主张。

## 构建它

`code/main.py` 在合成"特征向量"（我们用 4 维向量作为 Inception 特征的替代）上实现 FID、类 CLIP-score 和 Elo 聚合。你会看到：

- 小 N 和大 N 上的 FID 计算——偏差。
- "CLIP score"作为特征池之间的余弦相似度。
- 来自合成偏好流的 Elo 更新规则。

### 步骤 1：四行 FID

```python
def fid(real_features, gen_features):
    mu_r, cov_r = mean_and_cov(real_features)
    mu_g, cov_g = mean_and_cov(gen_features)
    mean_diff = sum((a - b) ** 2 for a, b in zip(mu_r, mu_g))
    trace_term = trace(cov_r) + trace(cov_g) - 2 * sqrt_cov_product(cov_r, cov_g)
    return mean_diff + trace_term
```

### 步骤 2：CLIP 风格的余弦相似度

```python
def clip_like(image_feat, text_feat):
    dot = sum(a * b for a, b in zip(image_feat, text_feat))
    norm = math.sqrt(dot_self(image_feat) * dot_self(text_feat))
    return dot / max(norm, 1e-8)
```

### 步骤 3：Elo 聚合

```python
def elo_update(r_a, r_b, winner, k=32):
    expected_a = 1 / (1 + 10 ** ((r_b - r_a) / 400))
    actual_a = 1.0 if winner == "a" else 0.0
    r_a_new = r_a + k * (actual_a - expected_a)
    r_b_new = r_b - k * (actual_a - expected_a)
    return r_a_new, r_b_new
```

## 陷阱

- **N=1000 时的 FID。** 启发式在 N=10k 以下不可靠。报告低 N FID 的论文是在钻空子。
- **跨分辨率比较 FID。** Inception 的 299×299 resize 会改变特征分布。只在匹配分辨率下比较。
- **报告一个种子。** 最少运行 3 个种子。报告标准差。
- **通过负面提示词抬高 CLIP score。** 一些流水线通过过拟合提示词来提升 CLIP。检查视觉饱和度。
- **提示词重叠导致的 Elo 偏差。** 如果两个模型在训练期间都见过基准提示词，Elo 就无意义了。使用保留的提示词集。
- **人类评估付费人群偏差。** Prolific、MTurk 标注者偏向年轻/科技友好型。与招募的艺术/设计专家混合。

## 使用它

2026 年生产级评估协议：

| 支柱 | 最低要求 | 推荐 |
|--------|---------|-------------|
| 样本质量 | 10k 对保留真实分布的 FID | + 5k 的 CMMD + 每个类别的子集 FID |
| 提示遵循度 | 30k 的 CLIP score | + HPSv2 + ImageReward + VQA 风格问答 |
| 偏好 | 与基线的 200 对盲测 | + 2000 对人工 + LLM-judge + Chatbot Arena |
| 失效分析 | 50 个手动标记 | 500 个手动标记 + 自动化安全分类器 |

一份报告中包含所有四个支柱 = 主张。任何一个单独 = 营销。

## 交付它

保存 `outputs/skill-eval-report.md`。该技能接收一个新模型检查点 + 基线，并输出一个完整的评估计划：样本量、指标、失效模式探测、签核标准。

## 练习

1. **简单。** 运行 `code/main.py`。在相同的合成分布上比较 N=100 与 N=1000 的 FID。报告偏差幅度。
2. **中等。** 从合成 CLIP 风格特征实现 CMMD（参见 Jayasumana 等人，2024 的公式）。与 FID 比较对质量差异的敏感度。
3. **困难。** 复现 HPSv2 设置：从 Pick-a-Pic 的子集中取 1000 个图像-提示词对，在偏好上微调一个小的基于 CLIP 的打分器，并测量其与保留集的一致性。

## 关键术语

| 术语 | 人们怎么说 | 它实际是什么意思 |
|------|-----------------|-----------------------|
| FID | "Fréchet Inception Distance" | 真实与生成 Inception 特征高斯拟合的 Fréchet 距离。 |
| CLIP score | "文本-图像相似度" | CLIP 图像和文本 embedding 之间的余弦相似度。 |
| CMMD | "FID 的替代品" | CLIP 特征 MMD；偏差更小，无需高斯假设。 |
| IS | "Inception score" | Exp KL(p(y|x) || p(y))；与现代模型相关性差，已退役。 |
| HPSv2 / ImageReward / PickScore | "学习偏好代理" | 在人类偏好上训练的小模型；用作自动评判者。 |
| Elo | "国际象棋等级分" | 成对胜场的 Bradley-Terry 聚合。 |
| PartiPrompts | "基准提示词集" | 1,600 个 Google 策划的提示词，跨 12 个类别。 |
| FD-DINO | "自监督替代品" | 使用 DINOv2 特征的 FD；对 ImageNet 外领域更好。 |

## 生产说明：评估也是一种推理工作负载

在 10k 样本上运行 FID 意味着生成 10k 张图像。对于在单张 L4 上 1024² 的 50 步 SDXL base，这是约 11 小时的单请求推理。评估预算是真实的，其框架正是离线推理场景（最大化吞吐量，忽略 TTFT）：

- **硬批处理，忘记延迟。** 离线评估 = 静态批处理，使用内存能容纳的最大尺寸。在 80GB H100 上 `num_images_per_prompt=8` 的 `pipe(...).images` 比单请求快 4-6 倍 wall-clock。
- **缓存真实特征。** 对真实参考集的 Inception（FID）或 CLIP（CLIP-score、CMMD）特征提取只运行*一次*，存储为 `.npz`。每次评估不要重新计算。

对于 CI / 回归门控：在每个 PR 上运行 500 样本子集的 FID + CLIP score（~30 分钟）；每晚运行完整的 10k FID + HPSv2 + Elo。

## 延伸阅读

- [Heusel et al. (2017). GANs Trained by a Two Time-Scale Update Rule Converge to a Local Nash Equilibrium (FID)](https://arxiv.org/abs/1706.08500) —— FID 论文。
- [Jayasumana et al. (2024). Rethinking FID: Towards a Better Evaluation Metric for Image Generation (CMMD)](https://arxiv.org/abs/2401.09603) —— CMMD。
- [Radford et al. (2021). Learning Transferable Visual Models from Natural Language Supervision (CLIP)](https://arxiv.org/abs/2103.00020) —— CLIP。
- [Wu et al. (2023). HPSv2: A Comprehensive Human Preference Score](https://arxiv.org/abs/2306.09341) —— HPSv2。
- [Xu et al. (2023). ImageReward: Learning and Evaluating Human Preferences for Text-to-Image Generation](https://arxiv.org/abs/2304.05977) —— ImageReward。
- [Yu et al. (2023). Scaling Autoregressive Models for Content-Rich Text-to-Image Generation (Parti + PartiPrompts)](https://arxiv.org/abs/2206.10789) —— PartiPrompts。
- [Stein et al. (2023). Exposing flaws of generative model evaluation metrics](https://arxiv.org/abs/2306.04675) —— 失效模式综述。
