# 图片和视频生成的下一个预测

> 据报道,该研究结果将在2024年9月推出. 单个Llama式单个解码器变压器,仅训练在下一个代码预测目标,通过文本+VQ图像代码+3DVQ视频代码的统一词汇,在图像生成方面击败了SDXL和感知方面击败了LLaVA-1.6. 没有损. 没有传播时间表. 无类型指导在推断质量时使用,但核心培训目标是预测下一个标志,教师强迫. 发表在"自然"杂志上. 这一课程上讲了Emu3论文,为什么一个更好的代币加量是你所需要的,

**Type:** Learn
**Languages:** Python, TypeScript (stdlib, 3D video tokenizer math + autoregressive sampler skeleton)
**Prerequisites:** Phase 12 · 11 (Chameleon)
**Time:** ~120 minutes

## 学习目标

- 解释为什么Emu3的单损失下一个标志目标尽管长期以来一直认为,图像质量需要扩散.
- 描述3D视频代码标记器:时间空间VQ代码簿是什么样子,为什么补丁跨度时间.
- 进行Emu3与稳定射XL的比较 (训练计算,推断成本,质量上限).
- 命名三个角色相同的Emu3模型播放:Emu3-Gen (图像基因),Emu3-Chat (感知),Emu3-Stage2 (视频基因).

## 问题

传统的智慧到2024年:图像生成需要传播. 争论:分离式图像代币失去太多信息来重建细节, 稳定射,DALL-E 3,Imagen,Midjourney都使用某种形式的射. 马里昂 (课 12.11) 在小规模上部分驳斥了这一点,但在质量上并没有与SDXL相匹配.

据称:在同一模型中,更好的视觉代币器+足够的规模+下一个代币损失 = 扩散击败图像生成.

两年后,开源统一代家族 (Emu3,Show-o,Janus-Pro,Transfusion) 是研究的默认路径;生产边界模型似乎使用一些变体.

## 概念

### 电子电子电子电子电子电子电子电子电子电子电子电子电子电子电子电子电子电子电子电子电子电子电子电子电子电子电子电子电子电子电子电子电子电子电子电子电子电子电子电子电子电子电子电子电子电子电子电子电子电子电子电子电子电子电子电子电子电子电子电子电子电子电子电子电子电子电子电子电子电子电子电子电子电子电子电子电子电子电子电子电子电子电子电子电子电子电子电子电子电子电子电子电子电子电子电子电子电子电子电子电子电子电子电子电子电子电子电子电子电子电子电子电子电子电子电子电子电子电子电子电子电子电子电子电子电子电子电子电子电子电子电子电子电子电子电子电子电子电子电子电子电子电子电子电子电子电子电子电子电子电子电子电子电子电子电子电子电子电子电子电子电子电子电子电子电子电子电子电子电子电子电子电子电子电子电子电子电子电子电子电子电子电子电子电子电子电子电子电子电子电子电子电子电子电子电子电子电子电子电子电子电子电子电子电子电子电子电子电子电子电子电子电子电子电子电子电子电子电子电子电子电子电子电子电子电子电子电子电子电子电子电子电子电子

基本成分是视觉代币器.Emu3训练一个定制 IBQ类代币器 (反瓶定量器,SBER-MoVQGAN家族) 每代币的分辨率降低8x8.一个512x512图像成为64x64 = 4096代币,代码书大小32768.

这比Chameleon的1024个代币大于512x512个代币,在两个轴上K=8192:代币的四倍和代码书的四倍.额外的容量购买了重建质量.关键指标:重建PSNR在30.5dB,与稳定扩散的连续潜伏空间在32dB竞争.

视频:一个3DVQ代码器将空间时间补丁 (4框 x 8×8像素) 编码为一个整数.在 8FPS的4s剪辑有32框;在8×空间和4×时间缩小的256×256时,代码数为 (256/8) * (256/8) * (32/4) = 32 * 32 * 8 = 8,192代币.

标器质量是天花板. 标器的贡献部分是"我们培养了一个非常好的标器".

### 单次损失培训

3使用一个目标:在文本代币,2D图像代币和3D视频代币中分享词汇中的下一个代币预测.训练期间,重量乘以特定模式的因素来平衡贡献,但损失函数是相同的.

搭载混合物:
- 图片来源: `<text caption> <image> image_tokens </image>`
- 图像感知:`<image> image_tokens </image> <question> text_tokens`
- 视频:`<text caption> <video> video_tokens </video>`
- 视频感知:类似.
- 仅仅是文字:标准NTP.

模型学习在数据分布中发射图像代币与文字代币的时间.`<image>`标签

### 无分类器的指导和温度

通过无分类器指导 (CFG) 进行推断,自动降低图像生成变得更好. Emu3使用它:生成两次,一次使用全标题,一次使用空标题,混合与指导权重 (典型的3.0-7.0).这是同样的CFG技巧传播使用,借用自动降低设置.

温度是重要的:太高,艺术品;太低,模式崩.

### 三个角色,一个模型

作为三个功能不同的API,但有一个基本的重量组:

- 输入文字,输出图像代币.
- 输入图像 (代币),输出文本.
- 输入文本或视频,输出文本或视频.

没有具体任务的头,只是不同的提示模板,相同的检查点.

### 标准标志

根据Emu3论文 (2024年9月):

- 图像生成:在MJHQ-30K FID (5.4 vs 5.6) 上击败了SDXL,GenEval整体 (0.54 vs 0.55 统计),以及Deep-Eval的复合平衡.
- 图像感知:在VQAv2 (75.1 vs 81.8) 和MMMU (31.6 vs 35.1) 上追踪LLaVA-1.6,但在SEED-Bench,OCRBench和ChartQA上击败了它.
- 视频生成:在竞争性FVD中,与 Sora时代公开标记的模型,进行4秒的录像质量.

 Emu3 交易一个点在这里,一个点在那里,但"下一个代币预测是你需要的"的说法可以通过各种方式辩护.

### 计算成本

图文中没有发布 GPU-小时总数;为了扩展,Llama-2-7B预训练使用了约184k A100 GPU-小时,大约是21 GPU-年.像稳定扩散3这样的扩散模型在类似的预算中训练,但需要单独的文本编码器和更复杂的管道.

在推断时,Emu3 比每张图像的SDXL慢:4096个图像代币30次/秒为每张512x512图像的2分钟,而SDXL则为2-5秒.投机解码和KV缓存优化缩小了差距,但并没有关闭它.autoregressive图像代码是计算重的;这是常设的交易.

### 为什么这很重要

如果下一个代币预测尺度匹配图像生成的扩散,统一模型路径 (一个损失,一个脊柱,任何模式) 是可行的.未来模型不需要单独的文本编码器,单独的扩散计划器,单独的VAE.一个变压器,一个代币器每一种模式,规模.

华宇公司的公司在中国的实验室 (BAAI,DeepSeek) 发布了在这个方向的更积极的信息,

```figure
l5-emu3-next-token
```

## 用它

`code/main.py`制造两个玩具:

- 根据2D对3DVQ代码符号计算器 (分辨率,补丁,剪辑_长度,FPS),计算图像对视频代码符号计算.
- 具有无分类器的温度指导的自动降低图像标记样本器.

根据Emu3的配方,CFG的实施与Emu3的配方相匹配.

## 运送它

这一课产生了`outputs/skill-token-gen-cost-analyzer.md`鉴于产品生成规格 (图像或视频,目标分辨率,质量级别,延迟预算),它计算了代币数量,推断成本,并选择了Emu3家族与扩散.

## 运动

1. 根据 Emu3 的数据,每一个512x512图像的数值为4096个代币,每一个图像的数值为8x8个.

2. 阅读Emu3视频代码标记器3.3节. 描述3DVQ补丁形状,以及为什么它覆盖4个框架×8x8像素而不是单个框架.

3. 没有分类器的指导权重5.0对3.0:什么视觉效果?`code/main.py`现在,我们要去.

4. 计算Emu3 (8B) 的FLOP训练,以假设的300B代币,并与稳定扩散3进行比较.

5. 对于FID而言,Emu3比SDXL更好,但对于VQAv2而言与专业VLM而言,不一样.

## 关键词

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| Next-token prediction | "NTP" | Standard autoregressive loss: predict token[i+1] given token[0..i]; works for every modality when tokenized |
| IBQ tokenizer | "Inverse bottleneck quantizer" | A class of VQ-VAE with larger codebooks (32768+) and better reconstruction than Chameleon's |
| 3D VQ | "Spatiotemporal quantizer" | Codebook indexed by (time, row, col); one token covers 4 frames x 8x8 pixels |
| Classifier-free guidance | "CFG" | Mix conditional and unconditional logits with weight gamma; boosts image quality at inference |
| Unified vocabulary | "Shared tokens" | Text + image + video all draw from the same integer space; model predicts whichever modality comes next |
| MJHQ-30K | "Image gen benchmark" | Midjourney-quality benchmark with 30k prompts; Emu3 reports FID here |

## 进一步阅读

- [Wang et al. — Emu3: Next-Token Prediction is All You Need (arXiv:2409.18869)](https://arxiv.org/abs/2409.18869)
- [Sun et al. — Emu: Generative Pretraining in Multimodality (arXiv:2307.05222)](https://arxiv.org/abs/2307.05222)
- [Liu et al. — LWM (arXiv:2402.08268)](https://arxiv.org/abs/2402.08268)
- [Yu et al. — MAGVIT-v2 (arXiv:2310.05737)](https://arxiv.org/abs/2310.05737)
- [Tian et al. — VAR (arXiv:2404.02905)](https://arxiv.org/abs/2404.02905)
