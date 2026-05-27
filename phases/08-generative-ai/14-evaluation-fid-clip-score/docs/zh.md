# 评估——FID、CLIP得分、人类偏好

> 每个生成模型排行榜都会引用FID、CLIP得分以及人类偏好竞技场的胜率。每个数值都存在一些有决心的研究者可以钻空子的失败模式。如果你不了解这些失败模式，就无法区分真正的改进和作弊手段。

**类型：** 构建
**语言：** Python
**先决条件：** 阶段8·01（分类法）、阶段2·04（评估指标）
**时间：** 约45分钟

## 问题

生成模型是根据*样本质量*和*条件遵循度*来评判的。这两者都没有封闭形式的度量。你的模型必须渲染10,000张图像；必须有一些数字来给它们打分；你必须信任这些数字，无论模型系列、分辨率、架构如何。有三种度量在2014-2026年的考验中存活了下来：

- **FID（弗雷歇初始距离，Fréchet Inception Distance）。** 真实分布与生成分布在Inception网络特征空间中的距离。越低越好。
- **CLIP得分（CLIP score）。** 生成图像的CLIP图像嵌入与提示的CLIP文本嵌入之间的余弦相似度。越高越好。衡量提示遵循度。
- **人类偏好（Human preference）。** 让两个模型在相同提示下正面交锋，由人类（或GPT-4级别的模型）选出更好的一个，然后汇总成Elo得分。

你还会看到：IS（初始得分，基本上已淘汰）、KID、CMMD、ImageReward、PickScore、HPSv2、MJHQ-30k。每个都修正了前一个度量的一些缺陷。

## 概念

![FID、CLIP和偏好：三个轴，不同的失败模式](../assets/evaluation.svg)

### FID——样本质量

Heusel等人（2017年）提出。步骤：

1. 对N张真实图像和N张生成图像提取Inception-v3特征（2048维）。
2. 对每个池拟合一个高斯分布：计算均值 `μ_r, μ_g` 和协方差 `Σ_r, Σ_g`。
3. FID = `||μ_r - μ_g||² + Tr(Σ_r + Σ_g - 2 · (Σ_r · Σ_g)^0.5)`。

解释：特征空间中两个多元高斯分布之间的弗雷歇距离。值越低表示分布越相似。

失败模式：
- **小N导致偏差。** FID是对特征分布的均方误差——样本数N太小会低估协方差，产生虚假的低FID值。始终使用N ≥ 10,000。
- **依赖Inception。** Inception-v3是在ImageNet上训练的。远离ImageNet的领域（人脸、艺术、文本图像）会产生无意义的FID。应使用特定领域的特征提取器。
- **作弊。** 过度拟合Inception先验会得到低FID而不提升视觉质量。可以用CMMD（见下文）来克服。

### CLIP得分——提示遵循度

Radford等人（2021年）提出。对于一张生成图像加上提示：

```
clip_score = cos_sim( CLIP_image(x_gen), CLIP_text(prompt) )
```

对30,000张生成图像求平均→得到一个可在模型之间比较的标量。

失败模式：
- **CLIP自身的盲区。** CLIP的组合推理能力较弱（“蓝色球体上的红色立方体”经常失败）。模型可以在CLIP得分上排名很高，却没有真正遵循复杂提示。
- **短提示偏差。** 短提示在真实世界中更容易找到CLIP图像匹配。长提示在机制上会得到更低的CLIP得分。
- **提示作弊。** 在提示中加入“高质量、4k、杰作”会抬高CLIP得分，但并不改善图像-文本绑定。

CMMD（Jayasumana等人，2024年）修正了其中一些问题：使用CLIP特征代替Inception，使用最大均值差异（MMD）代替弗雷歇距离。在检测细微质量差异方面更优。

### 人类偏好——真实答案

挑选一组提示。用模型A和模型B生成图像。将配对展示给人类（或一个强大的LLM裁判）。汇总胜场为Elo或Bradley-Terry得分。基准测试：

- **PartiPrompts（Google）：** 1,600个多样化提示，12个类别。
- **HPSv2：** 107,000个人工标注，被广泛用作自动化代理。
- **ImageReward：** 137,000个提示-图像偏好对，MIT许可证。
- **PickScore：** 在Pick-a-Pic 260万个偏好样本上训练。
- **Chatbot-Arena风格的图像竞技场：** https://imagearena.ai/ 等。

失败模式：
- **裁判方差。** 非专家与专家有不同的偏好。两者都使用。
- **提示分布。** 精心挑选的提示偏向某一模型系列。务必记录。
- **LLM裁判奖励黑客。** GPT-4裁判会被漂亮但错误的输出所欺骗。与人类结果相互验证。

## 一起使用

一份生产环境评估报告应包含：

1. 对10,000-30,000个样本的FID，与一个留出的真实分布进行比较（样本质量）。
2. 对相同样本的CLIP得分/CMMD，与其提示进行比较（遵循度）。
3. 在盲测竞技场中对之前模型的胜率（总体偏好）。
4. 失败模式分析：随机抽取50个输出，标记已知问题（手指解剖、文本渲染、物体数量一致性）。

任何一个单独指标都是谎言。三个相互印证的指标加上定性审查才是一个论断。

## 构建它

`code/main.py` 实现了对合成“特征向量”（我们使用4维向量作为Inception特征的替代）的FID、类CLIP得分和Elo聚合。你将看到：

- 在小N和大N下的FID计算——偏差。
- “CLIP得分”作为特征池之间的余弦相似度。
- 从合成偏好流中得到的Elo更新规则。

### 步骤1：四行代码实现FID

```python
def fid(real_features, gen_features):
    mu_r, cov_r = mean_and_cov(real_features)
    mu_g, cov_g = mean_and_cov(gen_features)
    mean_diff = sum((a - b) ** 2 for a, b in zip(mu_r, mu_g))
    trace_term = trace(cov_r) + trace(cov_g) - 2 * sqrt_cov_product(cov_r, cov_g)
    return mean_diff + trace_term
```

### 步骤2：类CLIP余弦相似度

```python
def clip_like(image_feat, text_feat):
    dot = sum(a * b for a, b in zip(image_feat, text_feat))
    norm = math.sqrt(dot_self(image_feat) * dot_self(text_feat))
    return dot / max(norm, 1e-8)
```

### 步骤3：Elo聚合

```python
def elo_update(r_a, r_b, winner, k=32):
    expected_a = 1 / (1 + 10 ** ((r_b - r_a) / 400))
    actual_a = 1.0 if winner == "a" else 0.0
    r_a_new = r_a + k * (actual_a - expected_a)
    r_b_new = r_b - k * (actual_a - expected_a)
    return r_a_new, r_b_new
```

## 陷阱

- **N=1000时的FID。** 启发式方法在N<10,000时不靠谱。报道低N FID的论文是在作弊。
- **跨分辨率比较FID。** Inception的299×299缩放改变了特征分布。仅在匹配的分辨率下比较。
- **只报告一个种子。** 至少运行3个种子。报告标准差。
- **通过负提示膨胀CLIP得分。** 某些管道通过过度拟合提示来提升CLIP。检查是否存在视觉饱和。
- **提示重叠导致的Elo偏差。** 如果两个模型在训练中都见过某个基准测试提示，则Elo无意义。使用留出的提示集。
- **人类评估的付费人群偏差。** Prolific、MTurk的标注者偏向更年轻/更懂技术的人群。混合招募艺术/设计专家。

## 使用它

2026年的生产环境评估协议：

| 支柱 | 最低要求 | 推荐做法 |
|------|----------|----------|
| 样本质量 | 在10k样本上对留出的真实数据计算FID | + 在5k样本上计算CMMD + 按类别在子集上计算FID |
| 提示遵循度 | 在30k样本上计算CLIP得分 | + HPSv2 + ImageReward + VQA风格问答 |
| 偏好 | 200个与基线的盲测配对 | + 2000个人类配对 + LLM裁判 + Chatbot Arena |
| 失败分析 | 人工标记50个 | 人工标记500个 + 自动安全分类器 |

报告中包含全部四个支柱 = 论断。任何一个单独 = 营销。

## 交付它

保存 `outputs/skill-eval-report.md`。该技能接收一个新的模型检查点加上基线，输出一份完整的评估计划：样本量、指标、失败模式探测、签字标准。

## 练习

1. **简单。** 运行 `code/main.py`。在相同的合成分布上比较N=100和N=1000时的FID。报告偏差大小。
2. **中等。** 从合成类CLIP特征实现CMMD（参见Jayasumana等人，2024年的公式）。比较其对质量差异的敏感度与FID的差异。
3. **困难。** 复现HPSv2设置：从Pick-a-Pic子集中选取1000个图像-提示对，在偏好上微调一个小的基于CLIP的打分器，并测量其与留出集的一致性。

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|------------|----------|
| FID | “弗雷歇初始距离（Fréchet Inception Distance）” | 真实与生成Inception特征的高斯拟合之间的弗雷歇距离。 |
| CLIP得分 | “文本-图像相似度” | CLIP图像嵌入和文本嵌入之间的余弦相似度。 |
| CMMD | “FID的替代品” | CLIP特征MMD；偏差更小，无需高斯假设。 |
| IS | “初始得分（Inception score）” | Exp KL(p(y|x) || p(y))；在现代模型上相关性差，已淘汰。 |
| HPSv2 / ImageReward / PickScore | “学习到的偏好代理” | 在人类偏好上训练的小模型；用作自动裁判。 |
| Elo | “国际象棋评级” | 成对胜场的Bradley-Terry聚合。 |
| PartiPrompts | “基准提示集” | 1,600个Google策划的提示，覆盖12个类别。 |
| FD-DINO | “自监督替代品” | 使用DINOv2特征的FD；更适合非ImageNet领域。 |

## 生产环境说明：评估也是一种推理工作负载

在10k样本上运行FID意味着生成10k张图像。对于单个L4上的50步SDXL基础模型、1024²分辨率，这大约是11小时的单请求推理。评估预算真实存在，而框架正好是离线推理场景（最大化吞吐量，忽略TTFT）：

- **硬性批处理，忽视延迟。** 离线评估 = 以内存能容纳的最大尺寸进行静态批处理。`pipe(...).images` 配合 `num_images_per_prompt=8` 在80GB H100上运行，比单请求快4-6倍（挂钟时间）。
- **缓存真实特征。** 对真实参考集进行Inception（FID）或CLIP（CLIP得分、CMMD）特征提取，只需运行一次，保存为`.npz`文件。每个评估不必重新计算。

对于CI/回归门控：每个PR在500样本子集上运行FID + CLIP得分（约30分钟）；夜间运行完整的10k FID + HPSv2 + Elo。

## 进一步阅读

- [Heusel等人（2017年）。两种时间尺度更新规则训练的GAN收敛到局部纳什均衡（FID）](https://arxiv.org/abs/1706.08500)——FID论文。
- [Jayasumana等人（2024年）。重新思考FID：朝向更好的图像生成评估指标（CMMD）](https://arxiv.org/abs/2401.09603)——CMMD。
- [Radford等人（2021年）。从自然语言监督中学习可迁移的视觉模型（CLIP）](https://arxiv.org/abs/2103.00020)——CLIP。
- [Wu等人（2023年）。HPSv2：一个全面的人类偏好得分](https://arxiv.org/abs/2306.09341)——HPSv2。
- [Xu等人（2023年）。ImageReward：学习和评估文本到图像生成的人类偏好](https://arxiv.org/abs/2304.05977)——ImageReward。
- [Yu等人（2023年）。扩展自回归模型以实现内容丰富的文本到图像生成（Parti + PartiPrompts）](https://arxiv.org/abs/2206.10789)——PartiPrompts。
- [Stein等人（2023年）。揭示生成模型评估指标的缺陷](https://arxiv.org/abs/2306.04675)——失败模式调查。