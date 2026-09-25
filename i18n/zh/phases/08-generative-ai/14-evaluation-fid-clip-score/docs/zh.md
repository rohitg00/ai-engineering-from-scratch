# 评估 — FID、CLIP Score、人类偏好

> 每个生成模型排行榜都会引用 FID、CLIP score 和人类偏好竞技场的胜率。每个数字都有其失效模式，执着的研究者可以利用这些模式作弊。如果你不知道这些失效模式，就无法区分真正的改进和作弊跑分。

**Type:** Build
**Languages:** Python
**Prerequisites:** Phase 8 · 01（Taxonomy），Phase 2 · 04（Evaluation Metrics）
**Time:** 约 45 分钟

## 问题所在

生成模型的评判标准是*样本质量*和*条件遵循度*。两者都没有封闭形式的度量。你的模型必须渲染 10,000 张图像；必须有某种东西为它们赋予数值；而你必须信任这些数值在不同模型家族、不同分辨率、不同架构之间的可比性。有三个指标在 2014-2026 年的考验中存活了下来：

- **FID（Fréchet Inception Distance）。** 在 Inception 网络特征空间中，真实分布与生成分布之间的距离。越低越好。
- **CLIP score。** 生成图像的 CLIP-image 嵌入与提示词的 CLIP-text 嵌入之间的余弦相似度。越高越好。衡量提示词遵循度。
- **人类偏好。** 让两个模型在相同提示词上正面对决，由人类（或 GPT-4 级别的模型）选出更好的一个，汇总为 Elo 分数。

你还会见到：IS（inception score，基本已退役）、KID、CMMD、ImageReward、PickScore、HPSv2、MJHQ-30k。每一个都是对前一个指标某种失效模式的修正。

## 核心概念

![FID, CLIP, and preference: three axes, different failure modes](../assets/evaluation.svg)

### FID — 样本质量

Heusel 等人（2017）。步骤：

1. 为 N 张真实图像和 N 张生成图像提取 Inception-v3 特征（2048 维）。
2. 对每个池拟合高斯分布：计算均值 `μ_r, μ_g` 和协方差 `Σ_r, Σ_g`。
3. FID = `||μ_r - μ_g||² + Tr(Σ_r + Σ_g - 2 · (Σ_r · Σ_g)^0.5)`。

解读：特征空间中两个多元高斯分布之间的 Fréchet 距离。越低 = 分布越相似。

失效模式：
- **在小 N 下有偏。** FID 是对特征分布的均方误差——小 N 会低估协方差，导致虚低的 FID。始终使用 N ≥ 10,000。
- **依赖 Inception。** Inception-v3 是在 ImageNet 上训练的。离 ImageNet 很远的领域（人脸、艺术、文本图像）会产生毫无意义的 FID。请使用领域特定的特征提取器。
- **作弊。** 对 Inception 先验过拟合可以在不提升视觉质量的情况下降低 FID。可用 CMMD（见下文）应对。

### CLIP score — 提示词遵循度

Radford 等人（2021）。对于生成图像 + 提示词：

```
clip_score = cos_sim( CLIP_image(x_gen), CLIP_text(prompt) )
```

在 3 万张生成图像上取平均 → 得到一个可在模型间比较的标量。

失效模式：
- **CLIP 自身的盲点。** CLIP 的组合推理能力弱（“蓝色球体上的红色立方体”经常失败）。模型可能在 CLIP score 上排名靠前，却并未真正遵循复杂提示词。
- **短提示词偏差。** 在野外，短提示词更容易匹配 CLIP-image。长提示词的 CLIP score 天然偏低。
- **提示词作弊。** 在提示词中加入 "high quality, 4k, masterpiece" 可以在不改善图文绑定的情况下抬高 CLIP score。

CMMD（Jayasumana 等人，2024）修复了其中一些问题：用 CLIP 特征替代 Inception，用最大均值差异替代 Fréchet 距离。在检测细微质量差异方面更优。

### 人类偏好 — 真值标准

选定一个提示词池。用模型 A 和模型 B 分别生成。将成对结果展示给人类（或强大的 LLM 评判者）。将胜负汇总为 Elo 或 Bradley-Terry 分数。基准测试：

- **PartiPrompts（Google）**：1,600 条多样化提示词，12 个类别。
- **HPSv2**：107k 条人类标注，被广泛用作自动化代理。
- **ImageReward**：137k 条提示词-图像偏好对，MIT 许可。
- **PickScore**：在 Pick-a-Pic 的 260 万条偏好数据上训练。
- **Chatbot Arena 风格的图像竞技场**：https://imagearena.ai/ 等。

失效模式：
- **评判者方差。** 非专家与专家的偏好不同。两者都要使用。
- **提示词分布。** 精心挑选的提示词会偏向某个模型家族。务必记录在案。
- **LLM 评判者的奖励作弊。** GPT-4 评判者会被“好看但错误”的输出欺骗。需与人类评判交叉验证。

## 组合使用

一份生产级评估报告应包含：

1. 在 1-3 万样本上、针对留出的真实分布计算 FID（样本质量）。
2. 在相同样本上、针对其提示词计算 CLIP score / CMMD（遵循度）。
3. 在盲测竞技场中与上一代模型的胜率（整体偏好）。
4. 失效模式分析：随机抽取 50 个输出，标记已知问题（手部解剖、文本渲染、物体数量一致性）。

任何单一指标都是谎言。三个相互印证的指标 + 定性审查才构成一个论断。

```figure
gx-fid-distributions
```

## 动手构建

`code/main.py` 在合成的“特征向量”上实现了 FID、类 CLIP score 和 Elo 汇总（我们用 4 维向量代替 Inception 特征）。你将看到：

- 在小 N 和大 N 下的 FID 计算——即偏差。
- “CLIP score”作为特征池之间的余弦相似度。
- 基于合成偏好流的 Elo 更新规则。

### 步骤 1：四行代码实现 FID

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

### 步骤 3：Elo 汇总

```python
def elo_update(r_a, r_b, winner, k=32):
    expected_a = 1 / (1 + 10 ** ((r_b - r_a) / 400))
    actual_a = 1.0 if winner == "a" else 0.0
    r_a_new = r_a + k * (actual_a - expected_a)
    r_b_new = r_b - k * (actual_a - expected_a)
    return r_a_new, r_b_new
```

## 常见陷阱

- **N=1000 时的 FID。** 在 N=10k 以下该启发式不可靠。报告低 N FID 的论文就是在作弊。
- **跨分辨率比较 FID。** Inception 的 299×299 缩放会改变特征分布。仅在分辨率匹配时进行比较。
- **只报告一个随机种子。** 至少跑 3 个种子。报告标准差。
- **通过负面提示词抬高 CLIP score。** 一些流水线通过对提示词过拟合来提升 CLIP。检查是否存在视觉饱和。
- **提示词重叠导致的 Elo 偏差。** 如果两个模型在训练中都见过某个基准提示词，Elo 就毫无意义。使用留出的提示词集。
- **付费众包人类评估的偏差。** Prolific、MTurk 的标注者偏向年轻、技术友好的人群。应与招募的艺术/设计专家混合使用。

## 应用实践

2026 年的生产级评估协议：

| 支柱 | 最低要求 | 推荐做法 |
|--------|---------|-------------|
| 样本质量 | 1 万样本上针对留出真实分布的 FID | + 5k 样本上的 CMMD + 按类别子集的 FID |
| 提示词遵循度 | 3 万样本上的 CLIP score | + HPSv2 + ImageReward + VQA 风格问答 |
| 偏好 | 200 对盲测对比基线 | + 2000 对人类评估 + LLM 评判 + Chatbot Arena |
| 失效分析 | 50 个手工标记 | 500 个手工标记 + 自动化安全分类器 |

报告同时包含全部四个支柱 = 论断。只包含其中一个 = 营销。

## 上线交付

保存 `outputs/skill-eval-report.md`。该技能接收新的模型检查点 + 基线，并输出完整的评估计划：样本量、指标、失效模式探针、验收标准。

## 练习

1. **简单。** 运行 `code/main.py`。在相同的合成分布上比较 N=100 与 N=1000 的 FID。报告偏差大小。
2. **中等。** 从合成的 CLIP 风格特征实现 CMMD（公式见 Jayasumana 等人，2024）。比较其对质量差异的敏感度与 FID。
3. **困难。** 复现 HPSv2 的设置：从 Pick-a-Pic 的一个子集中取 1000 个图像-提示词对，在该偏好数据上微调一个基于 CLIP 的小型打分器，并测量其与留出集的一致性。

## 关键术语

| 术语 | 人们的说法 | 实际含义 |
|------|-----------------|-----------------------|
| FID | "Fréchet Inception Distance" | 真实与生成 Inception 特征的高斯拟合之间的 Fréchet 距离。 |
| CLIP score | "图文相似度" | CLIP 图像嵌入与文本嵌入之间的余弦相似度。 |
| CMMD | "FID 的替代品" | CLIP 特征的 MMD；偏差更小，不假设高斯分布。 |
| IS | "Inception score" | Exp KL(p(y|x) || p(y))；在现代模型上相关性差，已退役。 |
| HPSv2 / ImageReward / PickScore | "学习型偏好代理" | 在人类偏好上训练的小模型；用作自动评判者。 |
| Elo | "国际象棋等级分" | 成对胜负的 Bradley-Terry 汇总。 |
| PartiPrompts | "基准提示词集" | Google 策划的 1,600 条提示词，横跨 12 个类别。 |
| FD-DINO | "自监督替代方案" | 使用 DINOv2 特征的 FD；对 ImageNet 以外的领域更优。 |

## 生产提示：评估也是一种推理工作负载

在 1 万样本上运行 FID 意味着要生成 1 万张图像。对于在单张 L4 上以 1024² 分辨率运行 50 步的 SDXL base，这大约是 11 小时的单请求推理。评估预算是真实存在的，而其框架正是离线推理场景（最大化吞吐量，忽略 TTFT）：

- **大批量处理，忘记延迟。** 离线评估 = 在显存能容纳的最大尺寸上进行静态批处理。`pipe(...).images` 配合 `num_images_per_prompt=8` 在 80GB H100 上的实际运行速度比单请求快 4-6 倍。
- **缓存真实特征。** 对真实参考集进行 Inception（FID）或 CLIP（CLIP score、CMMD）特征提取只需运行*一次*，并存储为 `.npz`。不要在每次评估时重新计算。

对于 CI / 回归门禁：每次 PR 在 500 样本子集上运行 FID + CLIP score（约 30 分钟）；每晚运行完整的 1 万样本 FID + HPSv2 + Elo。

## 延伸阅读

- [Heusel 等人（2017）。GANs Trained by a Two Time-Scale Update Rule Converge to a Local Nash Equilibrium（FID）](https://arxiv.org/abs/1706.08500) — FID 论文。
- [Jayasumana 等人（2024）。Rethinking FID: Towards a Better Evaluation Metric for Image Generation（CMMD）](https://arxiv.org/abs/2401.09603) — CMMD。
- [Radford 等人（2021）。Learning Transferable Visual Models from Natural Language Supervision（CLIP）](https://arxiv.org/abs/2103.00020) — CLIP。
- [Wu 等人（2023）。HPSv2: A Comprehensive Human Preference Score](https://arxiv.org/abs/2306.09341) — HPSv2。
- [Xu 等人（2023）。ImageReward: Learning and Evaluating Human Preferences for Text-to-Image Generation](https://arxiv.org/abs/2304.05977) — ImageReward。
- [Yu 等人（2023）。Scaling Autoregressive Models for Content-Rich Text-to-Image Generation（Parti + PartiPrompts）](https://arxiv.org/abs/2206.10789) — PartiPrompts。
- [Stein 等人（2023）。Exposing flaws of generative model evaluation metrics](https://arxiv.org/abs/2306.04675) — 失效模式综述。