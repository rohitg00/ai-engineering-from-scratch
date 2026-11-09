# 评价 FID,CLIP分数,人气偏好

> 每个生成模型排名表都引用了人类偏好领域的FID,CLIP分数和胜利率.每个数字都有一个确定研究人员可以玩的失败模式.如果你不知道失败模式,你无法从游戏运行中辨别真正的改善.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 8 · 01 (Taxonomy), Phase 2 · 04 (Evaluation Metrics)
**Time:** ~45 minutes

## 问题

生成模型是根据*样本质量*和*条件性依附性来判断的. 无论是没有封闭形式的测量.你的模型必须呈现10,000个图像;有什么东西必须赋予它们数字;你必须相信模型家庭中的数字,在分辨率中,在建筑中.

- **FID (Fréchet Inception Distance).**在Inception网络的功能空间中,两个分布之间的距离 实和生成的距离.较低更好.
- **CLIP score.**生成图像的Clip图像嵌入与提示的Clip文本嵌入之间的相似性.较高更好.测量提示遵守.
- **Human preference.**让人类 (或GPT-4类型的模型) 选择更好的模型, 总结为Elo分数.

你还会看到:IS (初始分数,大多退休),KID,CMMD,ImageReward,PickScore,HPSv2,MJHQ-30k. 每个都对前一个失败进行了纠正.

## 概念

![FID, CLIP, and preference: three axes, different failure modes](../assets/evaluation.svg)

###      

果和其他产品

1. 提取Inception-v3功能 (2048-D) 对于N真实图像和N生成的图像.
2. 按一个高斯人对每个池:计算平均值$\mu_r, \mu_g$及共变性$\Sigma_r, \Sigma_g$现在,我们要去.
3. $\text{FID} = \lVert \mu_r - \mu_g \rVert^2 + \mathop{\mathrm{Tr}}\left(\Sigma_r + \Sigma_g - 2 \cdot (\Sigma_r \cdot \Sigma_g)^{0.5}\right)$现在,我们要去.

解释:特征空间中的两个多变量高素之间的弗雷切距离.

失效模式:
- **Biased on small N.**平均值为特征分布的平方小N低估了变量,给出了虚假的低FID.$N \ge 10{,}000$现在,我们要去.
- **Inception-dependent.**开始-v3 在 ImageNet 上进行了训练.远离 ImageNet 的域名 (面孔,艺术,文本图像) 产生无意义的 FID. 使用域名特定的特征提取器.
- **Gaming.**过度适应初始前,没有改善视觉质量.

### 快速遵守

对于生成的图像+提示:

```
clip_score = cos_sim( CLIP_image(x_gen), CLIP_text(prompt) )
```

平均30万张生成的图像是模型之间相比的尺度图像.

失效模式:
- **CLIP's own blind spots.**CLIP 具有较弱的构成推理 ("蓝球上的红立方体"经常失败).模型可以在 CLIP 评分上排名良好,而不会真正遵循复杂的提示.
- **Short prompt bias.**短短的提示在自然界中比较符合Clip图像,而较长的提示在机械上比较低的Clip分数.
- **Prompt gaming.**包含"高质量,4k,杰作"在提示中,

 CMMD (Jayasumana等,2024) 修复了一些问题:使用CLIP功能而不是Inception,而不是Fréchet的最大平均差异.

### 人类偏好 基础真理

选择一个提示池.使用模型A和模型B生成.向人类 (或强大的LLM法官) 展示对. 总结获利成Elo或布拉德利-特里分数. 基准:

- **PartiPrompts (Google)**共有1600个不同的提示,12个类别.
- **HPSv2**据了解,在此之前,
- **ImageReward**根据MIT许可,
- **PickScore**培训者: 选择一个选择的2.6M.
- **Chatbot-Arena-style image arenas**其他https://imagearena.ai/其他.

失效模式:
- **Judge variance.**专家的偏好不同,使用两者.
- **Prompt distribution.**桃选的提示有利于一个家庭.
- **LLM-judge reward hacking.**,但错误的输出会欺骗GPT-4法官.

## 共同使用

生产评估报告应包括:

1. 根据实质分布 (样品质) 的测试,对10-30k样品进行了FID.
2. 同样样样本的CIP分数/CMMD与其提示 (附属性).
3. 失明场合的胜利率与前型号 (总体偏好).
4. 失败模式分析:50个随机抽取的输出,标记为已知的问题 (手解剖学,文本染,一致的对象数量).

任何单一的指标都是谎言.

```figure
gx-fid-distributions
```

## 建立它

`code/main.py`通过 FID,Clip-score和 Elo 聚合,我们将合成的"特征向量" (我们使用4D向量作为Inception特征的替代品) 实现.

- 在一个小N和一个大N 的偏差上进行FID计算.
- 作为特征池之间的共数相似性.
- 根据合成偏好流的 Elo更新规则.

### 步骤1:四行FID

```python
def fid(real_features, gen_features):
    mu_r, cov_r = mean_and_cov(real_features)
    mu_g, cov_g = mean_and_cov(gen_features)
    mean_diff = sum((a - b) ** 2 for a, b in zip(mu_r, mu_g))
    trace_term = trace(cov_r) + trace(cov_g) - 2 * sqrt_cov_product(cov_r, cov_g)
    return mean_diff + trace_term
```

### 步骤2:Clip式的相似性

```python
def clip_like(image_feat, text_feat):
    dot = sum(a * b for a, b in zip(image_feat, text_feat))
    norm = math.sqrt(dot_self(image_feat) * dot_self(text_feat))
    return dot / max(norm, 1e-8)
```

### 步骤3:Elo聚合

```python
def elo_update(r_a, r_b, winner, k=32):
    expected_a = 1 / (1 + 10 ** ((r_b - r_a) / 400))
    actual_a = 1.0 if winner == "a" else 0.0
    r_a_new = r_a + k * (actual_a - expected_a)
    r_b_new = r_b - k * (actual_a - expected_a)
    return r_a_new, r_b_new
```

## 陷

- **FID at N=1000.**报告低NFID的论文是游戏.
- **Comparing FID across resolutions.**开始的299×299尺寸改变了功能分布.
- **Reporting one seed.**试试三种种子,报告.
- **CLIP score inflation via negative prompts.**检查视觉度.
- **Elo bias from prompt overlap.**如果两个模型在训练中看到一个基准提示, Elo 无意义. 使用延迟提示设置.
- **Human eval paid-crowd skew.**果的MTurk注释者偏向年轻人/技术友好.

## 用它

2026年生产评估协议:

| Pillar | Minimum | Recommended |
|--------|---------|-------------|
| Sample quality | FID on 10k vs held-out real | + CMMD on 5k + FID on subset per category |
| Prompt adherence | CLIP score on 30k | + HPSv2 + ImageReward + VQA-style question answering |
| Preference | 200 blinded pairs vs baseline | + 2000 paired human + LLM-judge + Chatbot Arena |
| Failure analysis | 50 hand-flagged | 500 hand-flagged + automated safety classifier |

报告中的四个支柱都是一份要求,任何一个都是一份营销.

## 运送它

保存`outputs/skill-eval-report.md`技能采用了新的模型检查点+基线,并输出了完整的评估计划:样本大小,指标,故障模式探测器,签署标准.

## 运动

1. **Easy.**跑步`code/main.py`根据同一个合成分布的N=100与N=1000的FID比较.
2. **Medium.**根据合成CLIP类型的功能实现CMMD (见Jayasumana et al., 2024).对质量差异的敏感性与FID进行比较.
3. **Hard.**复制HPSv2设置:从Pick-a-Pic的子集中取1000个图像即时对,根据偏好调整一个基于 CLIP 的小分分数,并测量其与持久的集合一致性.

## 关键词

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| FID | "Fréchet Inception Distance" | Fréchet distance of Gaussian fits to real vs gen Inception features. |
| CLIP score | "Text-image similarity" | Cosine similarity between CLIP image and text embeddings. |
| CMMD | "FID's replacement" | CLIP-feature MMD; less biased, no Gaussian assumption. |
| IS | "Inception score" | Exp KL(p(y|x) || p(y)); correlates poorly on modern models, retired. |
| HPSv2 / ImageReward / PickScore | "Learned preference proxies" | Small models trained on human preferences; used as automatic judges. |
| Elo | "Chess rating" | Bradley-Terry aggregation of pairwise wins. |
| PartiPrompts | "The benchmark prompt set" | 1,600 Google-curated prompts across 12 categories. |
| FD-DINO | "Self-sup replacement" | FD using DINOv2 features; better for out-of-ImageNet domains. |

## 产品注:评估也是一个推断工作负担

运行FID在10k样本上意味着生成10k图像.对于一个单个L4上50步 SDXL基础在10242上,这就是11小时的单次请求推断.评估预算是真实的,框架是完全离线推理情况 (最大化吞吐量,忽略TTFT):

- **Batch hard, forget latency.**离线 eval = 静态批量,最大的尺寸适合内存. `pipe(...).images`随着`num_images_per_prompt=8`在80GB的H100上,墙上的钟表比单次请求速度快4至6倍.
- **Cache the real features.**实际参考集中的Inception (FID) 或CLIP (CLIP-score,CMMD) 功能提取运行 *once*,存储为`.npz`没有重新计算每一个评估.

对于CI/回归门:每次 PR (~30分钟) 的500个样本子小组中运行FID + CLIP分数;每晚运行FID + HPSv2 + Elo的全部10k.

## 进一步阅读

- [Heusel et al. (2017). GANs Trained by a Two Time-Scale Update Rule Converge to a Local Nash Equilibrium (FID)](https://arxiv.org/abs/1706.08500) 联邦调查局的文件.
- [Jayasumana et al. (2024). Rethinking FID: Towards a Better Evaluation Metric for Image Generation (CMMD)](https://arxiv.org/abs/2401.09603)   
- [Radford et al. (2021). Learning Transferable Visual Models from Natural Language Supervision (CLIP)](https://arxiv.org/abs/2103.00020)  
- [Wu et al. (2023). HPSv2: A Comprehensive Human Preference Score](https://arxiv.org/abs/2306.09341)   
- [Xu et al. (2023). ImageReward: Learning and Evaluating Human Preferences for Text-to-Image Generation](https://arxiv.org/abs/2304.05977) 图像奖励
- [Yu et al. (2023). Scaling Autoregressive Models for Content-Rich Text-to-Image Generation (Parti + PartiPrompts)](https://arxiv.org/abs/2206.10789) 活动提示
- [Stein et al. (2023). Exposing flaws of generative model evaluation metrics](https://arxiv.org/abs/2306.04675)失败模式调查.
