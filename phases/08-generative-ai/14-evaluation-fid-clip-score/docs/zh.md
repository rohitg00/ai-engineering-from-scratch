# 评估——FID、CLIP Score、人类偏好

> 译注：本文译自同目录 [`en.md`](./en.md)。术语遵循仓根 [TRANSLATION_GUIDE.md](../../../../TRANSLATION_GUIDE.md)。

> 每一个生成模型的排行榜都会引用 FID、CLIP score，以及来自人类偏好竞技场的胜率。每个数字都有自己的失败模式，一个铁了心的研究者都能把它们玩坏。如果你不知道这些失败模式，你就分不清一次真正的改进和一次刷分。

**Type:** Build
**Languages:** Python
**Prerequisites:** Phase 8 · 01 (Taxonomy), Phase 2 · 04 (Evaluation Metrics)
**Time:** ~45 minutes

## 问题（The Problem）

一个生成模型由两件事来评判：*样本质量* 和 *条件遵循度*。这两者都没有闭式的度量方式。你的模型要生成 1 万张图；得有什么东西给它们打分；而你必须相信这些数字在不同模型族、不同分辨率、不同架构间都站得住脚。三个度量从 2014–2026 这场考验中存活下来：

- **FID（Fréchet Inception Distance）。** 在 Inception 网络的特征空间里，真实分布与生成分布之间的距离。越低越好。
- **CLIP score。** 生成图像的 CLIP-image embedding（嵌入）与 prompt 的 CLIP-text embedding 之间的余弦相似度。越高越好。衡量的是 prompt 的遵循度。
- **人类偏好（Human preference）。** 在同一个 prompt 上把两个模型摆在一起，让人（或一个 GPT-4 量级的模型）挑出更好的那个，再聚合成 Elo 分。

你还会见到：IS（inception score，基本退役）、KID、CMMD、ImageReward、PickScore、HPSv2、MJHQ-30k。每一个都在修补上一个的某种失败。

## 概念（The Concept）

![FID、CLIP 与偏好：三个轴，不同的失败模式](../assets/evaluation.svg)

### FID——样本质量

Heusel 等人（2017）。步骤：

1. 对 N 张真实图和 N 张生成图分别提取 Inception-v3 特征（2048 维）。
2. 对每一组拟合一个高斯：算出均值 `μ_r, μ_g` 和协方差 `Σ_r, Σ_g`。
3. FID = `||μ_r - μ_g||² + Tr(Σ_r + Σ_g - 2 · (Σ_r · Σ_g)^0.5)`。

直观解释：在特征空间里，两个多元高斯分布之间的 Fréchet 距离。越低 = 两个分布越相似。

失败模式：

- **小 N 上有偏。** FID 是在特征分布上做均方计算——N 太小会低估协方差，给出虚低的 FID。务必 N ≥ 10,000。
- **依赖 Inception。** Inception-v3 是在 ImageNet 上训的。离 ImageNet 很远的领域（人脸、艺术、文本图像）算出来的 FID 没意义。要用领域特定的特征提取器。
- **可被刷分。** 过拟合到 Inception 的先验上能让 FID 降低，却不带来真正的视觉质量提升。用下面的 CMMD 来反制。

### CLIP score——prompt 遵循度

Radford 等人（2021）。对一张生成图 + 一个 prompt：

```
clip_score = cos_sim( CLIP_image(x_gen), CLIP_text(prompt) )
```

在 3 万张生成图上取平均 → 得到一个可在不同模型间对比的标量。

失败模式：

- **CLIP 自身的盲点。** CLIP 的组合推理能力很弱（“蓝色球体上的红色立方体”常常翻车）。模型可以在 CLIP score 上排名很高，却并没有真正遵循复杂的 prompt。
- **短 prompt 偏差。** 短 prompt 在野外数据里有更多 CLIP-image 匹配。长 prompt 在机制上 CLIP score 就更低。
- **prompt 刷分。** 在 prompt 里塞 “high quality, 4k, masterpiece” 能虚高 CLIP score，却不会改善图文绑定。

CMMD（Jayasumana 等人，2024）修了其中一些问题：用 CLIP 特征替换 Inception，用最大均值差异（maximum-mean discrepancy）替换 Fréchet。在察觉细微质量差异上更灵敏。

### 人类偏好——ground truth

挑一组 prompt。让模型 A 和模型 B 各自生成。把成对结果给人类（或一个强 LLM judge）看，聚合胜负成 Elo 或 Bradley-Terry 分。基准：

- **PartiPrompts（Google）**：1,600 条多样化 prompt，12 个类别。
- **HPSv2**：10.7 万条人类标注，被广泛用作自动化代理。
- **ImageReward**：13.7 万条 prompt-image 偏好对，MIT 协议。
- **PickScore**：在 Pick-a-Pic 的 260 万条偏好上训练。
- **Chatbot-Arena 风格的图像竞技场**：https://imagearena.ai/ 等。

失败模式：

- **judge 方差。** 非专家与专家偏好不同。两者都用。
- **prompt 分布。** 精挑细选的 prompt 会偏向某一族模型。务必文档化。
- **LLM-judge 的奖励黑客。** GPT-4-judge 会被“漂亮但错”的输出骗到。要和人类三角验证。

## 一起用（Use together）

一份生产级的评估报告应当包含：

1. 在 1–3 万样本上、相对一个保留的真实分布算 FID（样本质量）。
2. 在同一批样本上、相对它们的 prompt 算 CLIP score / CMMD（遵循度）。
3. 与上一版模型在盲测竞技场里的胜率（整体偏好）。
4. 失败模式分析：随机抽样 50 个输出，按已知问题打标（手部解剖、文字渲染、物体数量一致性）。

任何单一指标都是谎言。三个相互印证的指标 + 定性回看，才算一个站得住的结论。

## 动手实现（Build It）

`code/main.py` 在合成的“特征向量”（我们用 4 维向量代替 Inception 特征）上实现了 FID、CLIP-score 风格的相似度，以及 Elo 聚合。你会看到：

- 在小 N 和大 N 上分别计算 FID——有偏的现象。
- 把“CLIP score”作为两组特征池之间的余弦相似度。
- 在合成偏好流上的 Elo 更新规则。

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

## 坑（Pitfalls）

- **N=1000 的 FID。** 在 N=1 万以下经验上不可靠。在低 N 上报 FID 的论文都是在刷分。
- **跨分辨率比 FID。** Inception 的 299×299 缩放会改变特征分布。只能在匹配分辨率下比较。
- **只跑一个种子。** 至少跑 3 个种子。报告标准差。
- **靠 negative prompt 把 CLIP score 拉高。** 有些流水线会通过过拟合 prompt 来抬高 CLIP。要看视觉饱和度。
- **prompt 重叠造成的 Elo 偏差。** 如果两个模型都在训练里见过基准 prompt，那 Elo 没有意义。要用保留的 prompt 集。
- **付费众包人评的偏倚。** Prolific、MTurk 上的标注人偏年轻、偏亲技术。要混入受邀的艺术 / 设计专家。

## 用起来（Use It）

2026 年的生产评估流程：

| 支柱 | 最低要求 | 推荐 |
|--------|---------|-------------|
| 样本质量 | 在 1 万样本对保留真实集上算 FID | + 5k 上的 CMMD + 各类别子集上的 FID |
| prompt 遵循度 | 3 万样本上的 CLIP score | + HPSv2 + ImageReward + VQA 风格问答 |
| 偏好 | 相对 baseline 的 200 对盲测 | + 2000 对人评 + LLM-judge + Chatbot Arena |
| 失败分析 | 手工标注 50 例 | 手工标注 500 例 + 自动化安全分类器 |

四个支柱一起出现 = 一个站得住的结论。任何单独一项 = 营销。

## 上线部署（Ship It）

保存 `outputs/skill-eval-report.md`。skill 接收一个新模型 checkpoint 加一个 baseline，输出一份完整评估方案：样本量、指标、失败模式探针、签字放行标准。

## 练习（Exercises）

1. **简单。** 跑 `code/main.py`。在同一组合成分布上比较 N=100 与 N=1000 时的 FID。报告偏差量级。
2. **中等。** 从合成的 CLIP 风格特征实现 CMMD（公式见 Jayasumana 等人，2024）。比较它与 FID 在质量差异上的灵敏度。
3. **困难。** 复现 HPSv2 的设定：从 Pick-a-Pic 的子集中取 1000 对图文偏好对，在偏好上微调一个小型 CLIP-based 打分器，并测量它和保留集的吻合度。

## 关键术语（Key Terms）

| 术语 | 一般人怎么说 | 它实际是什么 |
|------|-----------------|-----------------------|
| FID | “Fréchet Inception Distance” | 真实 vs 生成的 Inception 特征上拟合高斯后的 Fréchet 距离。 |
| CLIP score | “图文相似度” | CLIP image 与 text embedding 之间的余弦相似度。 |
| CMMD | “FID 的替代品” | CLIP 特征上的 MMD；偏差更小，不需要高斯假设。 |
| IS | “Inception score” | Exp KL(p(y|x) || p(y))；在现代模型上相关性差，已退役。 |
| HPSv2 / ImageReward / PickScore | “学习出来的偏好代理” | 在人类偏好上训练的小模型；用作自动 judge。 |
| Elo | “国际象棋评分” | 对两两胜负做 Bradley-Terry 聚合。 |
| PartiPrompts | “那套基准 prompt 集” | Google 整理的 1,600 条 prompt，覆盖 12 个类别。 |
| FD-DINO | “自监督替代” | 用 DINOv2 特征算 FD；在非 ImageNet 领域更好。 |

## 生产备注：评估也是一种推理负载

在 1 万样本上跑 FID 意味着要生成 1 万张图。对于一个 50 步、1024² 的 SDXL base，在单卡 L4 上单请求推理大约要 ~11 小时。评估预算是真实存在的，而且这个场景正好就是 offline 推理（最大化吞吐，忽略 TTFT）：

- **狠狠 batch，忘掉延迟。** offline 评估 = 静态 batching，开到显存能装下的最大尺寸。在 80GB H100 上 `pipe(...).images` 用 `num_images_per_prompt=8` 比单请求快 4-6 倍墙钟时间。
- **缓存真实集的特征。** 真实参考集上的 Inception（FID）或 CLIP（CLIP-score、CMMD）特征提取*只跑一次*，存成 `.npz`。不要每次评估都重算。

CI / 回归门禁：每个 PR 在 500 样本子集上跑 FID + CLIP score（~30 分钟）；夜间跑完整的 1 万样本 FID + HPSv2 + Elo。

## 延伸阅读（Further Reading）

- [Heusel et al. (2017). GANs Trained by a Two Time-Scale Update Rule Converge to a Local Nash Equilibrium (FID)](https://arxiv.org/abs/1706.08500)——FID 论文。
- [Jayasumana et al. (2024). Rethinking FID: Towards a Better Evaluation Metric for Image Generation (CMMD)](https://arxiv.org/abs/2401.09603)——CMMD。
- [Radford et al. (2021). Learning Transferable Visual Models from Natural Language Supervision (CLIP)](https://arxiv.org/abs/2103.00020)——CLIP。
- [Wu et al. (2023). HPSv2: A Comprehensive Human Preference Score](https://arxiv.org/abs/2306.09341)——HPSv2。
- [Xu et al. (2023). ImageReward: Learning and Evaluating Human Preferences for Text-to-Image Generation](https://arxiv.org/abs/2304.05977)——ImageReward。
- [Yu et al. (2023). Scaling Autoregressive Models for Content-Rich Text-to-Image Generation (Parti + PartiPrompts)](https://arxiv.org/abs/2206.10789)——PartiPrompts。
- [Stein et al. (2023). Exposing flaws of generative model evaluation metrics](https://arxiv.org/abs/2306.04675)——失败模式综述。
