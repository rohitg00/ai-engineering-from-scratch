# 视力变化器和补丁标记原始

> 在任何多元化东西之前,图像必须成为一个变压器可以吃的代币的序列. 2020年ViT论文以16x16像素补丁,线性投影和位置嵌入来回答这一问题. 五年后,每一个2026年边界模型 (Claude Opus 4.7 at 2576px native, Gemini 3.1 Pro, Qwen3.5-Omni) 都仍然以这种方式开始编码器从ViT转换为DINOv2转换为SigLIP 2,注册代币被添加,位置方案成为2D-RoPE,但原始保持. 这一课程读到补丁代币管道的终端到终端,并用Stdlib Python构建它,所以第12阶段的其他部分有一个"视觉代币"的具体的心理模型.

**Type:** Learn
**Languages:** Python, TypeScript (stdlib, patch tokenizer + geometry calculator)
**Prerequisites:** Phase 7 (Transformers), Phase 4 (Computer Vision)
**Time:** ~120 minutes

## 学习目标

- 将HxWx3图像转换为正确位置编码的补丁代币序列.
- 计算一个给定的 ViT 的序列长度,参数数量和FLOP (补丁尺寸,分辨率,隐藏的暗色,深度).
- 举个例子说明2020年研究到2026年的 ViT 产品的三个升级:自主监督预训 (DINO/MAE),注册代币和本地分辨率包装.
- 选择CLS集成,平均集成,或注册代币用于下游任务.

## 问题

变压器运行在向量序列上.文本已经是一个序列 (字节或代币).图像是一个3色通道的2D像素格格格,而不是一个序列.如果你平平平每一个像素,一个224x224 RGB图像会变成150,528个代币,而在这个长度上的自我注意力是非启动 (序列长度的平方).

2020年之前的方法将CNN特征提取器带到前面:ResNet生成了2048维向量的7×7特征地图,将这些49个代币输送到变压器中.这有效,但继承了CNN的偏见 (翻译等差,本地接收场) 并失去了变压器对尺度的食欲.

东索维茨基等 现在,如果我们跳过CNN, 将图像分成固定尺寸的补丁 (例如16x16像素),将每个补丁线性投射到向量中,添加一个定位嵌入,并将序列输送到瓦尼拉变压器中. 在当时,这是一种异端主义, 由于足够的数据 (JFT-300M,然后是LAION),它击败了ResNet在ImageNet,并继续改进.

到2026年,VIT原始是无疑的基础.每一个开放重量的VLM视觉塔都是某种后代 (DINOv2,SigLIP2,CLIP,EVA,InternViT).问题不再是"我们应该使用补丁吗?"而是"什么补丁尺寸,什么分辨率计划,什么预训练目标,什么位置编码".

## 概念

### 作为代币的补丁

给出一个图像`x`形状`(H, W, 3)`片的尺寸`P`现在,你把图像刻成一个网格.`(H/P) x (W/P)`没有重叠的补丁. 每个补丁都是一个`P x P x 3`方块的像素. 方块的每个方块为一个`3 P^2`运用共享线性投影`W_E`形状`(3 P^2, D)`为了将每个补丁映射到模型的隐藏维度中`D`现在,我们要去.

对于ViT-B/16的法典配置:
- 解析度224,补丁尺寸16 → 网格14x14 → 196个补丁代币.
- 每个补丁都是`16 x 16 x 3 = 768`预测到`D = 768`现在,我们要去.
- 添加一个可学习的东西`[CLS]`标志 →序列长度197.

补丁投影数学上与核子大小的2D卷积相同`P`走进`P`其他`D`产品代码实际上是这样实现的`nn.Conv2d(3, D, kernel_size=P, stride=P)`线性投影框架是概念性的;内核框架是高效的.

### 位置嵌入式

补丁没有固有的顺序.变压器把它们视为袋子.早期的ViT添加了一个可学习的1D定位嵌入 (每一个位置有768个dim向量,其中197个).它运行,但将模型与训练分辨率联系在一起:在推断下,如果你改变格格,你必须插入位置表.

现代视觉背骨使用2D-RoPE (Qwen2-VL的M-RoPE,SigLIP 2的默认) 或因数化2D位置. 2D-RoPE根据补丁的索引 (行,列) 引擎旋转查询和关键向量,因此模型从旋转角推算相对2D位置.没有位置表.该模型处理任意的网格大小在推断时.

### 关键字:CLS代币,合并输出,注册代币

图像水平表示是什么?三个选择共存:

1. `[CLS]`标记. 预备一个可学习的向量到补丁序列. 在所有变压器块之后,CLS标记的隐藏状态是图像表示. 继承了BERT. 原始 ViT,CLIP使用.
2. 平均积分,是补丁代币的输出隐藏状态.
3. 登记令牌.Darcet等人 (2023) 观察到,没有明确的洗面令牌训练的ViTs开发高标准的"文物"补丁,这些补丁劫持自我注意.添加416可学习的登记令牌吸收了这种负载,并改善了密集预测质量 (细分,深度).DINOv2和SigLIP 2都具有登记器.

选择对于下游任务很重要.CLS对于分类来说很好.对于VLM来说,这些VLM将补丁代币输入到LLM中,您将完全跳过合并每个补丁都会成为LLM输入代币.在交付前,注册会被丢弃 (它们是架架,而不是内容).

### 预训练:监督,反,面具,自蒸

2020年ViT预训练了JFT-300M的监督分类.

- 课程 12.02.
- 面膜 75% 补丁,重建像素. 自主监督,在纯图像上工作.
- 迪诺 (2021) /迪诺夫2 (2023):自蒸与学生-老师,没有标签,没有标题. 2023 迪诺夫2 ViT-g/14 是最强的纯视觉脊柱,也是"密集特征"使用案例的默认.
- 利普/利普2 (2023, 2025):利普与利达损失和纳弗莱克斯为本地视角比. 2026年主导视觉塔开放VLM (Qwen,Idefics2,LLaVA-OneVision).

您的预训练选择决定了脊柱是什么好:Clip/SigLIP用于语义与文本匹配,DINOv2用于密集的视觉特征,MAE作为下游细节调整的起点.

### 规模化法

维特扩展 (Zhai et al. 2022) 确定了维特的质量遵守模型大小,数据大小和计算的可预测的法律.
- 较大的模型+更多的数据 →更好的质量.
- 补丁尺寸是对序列长度和忠诚度的杆.补丁14 (典型于DINOv2/SigLIP SO400m) 给出比补丁16更多的图像代码;对OCR和密集任务更好,速度更差.
- 解决方案是另一个大杆. 从224到384到512几乎总是有助于,

维特g/14 (1B参数,补丁 14,解析度 224 → 256 代币) 和SigLIP SO400m/14 (400M参数,补丁 14) 是2026年开放的VLM的两个工作马编码器.

### 维特的参数数

整个计算在`code/main.py`对于VIT-B/16在224号:

```
patch_embed = 3 * 16 * 16 * 768 + 768  =  591k
cls + pos    = 768 + 197 * 768          =  152k
block        = 4 * 768^2 (QKVO) + 2 * 4 * 768^2 (MLP) + 2 * 2*768 (LN)
             = 12 * 768^2 + 3k          =  7.1M
12 blocks    = 85M
final LN    = 1.5k
total       ≈ 86M
```

在你加载检查点之前,把每一个VIT都这样停下来.

### 2026年生产配置

2026年最开放的VLM编码器是SigLIP 2 SO400m/14 (NaFlex). 它具有:
- 标准标准为400米.
- 补丁尺寸 14,默认分辨率为384 → 729个补丁代币.
- 图像级任务的平均积分;所有729个补丁都流入VQA的LLM.
- 在LLM转让之前丢弃的4个注册代币.
- 具有图像水平扩展的2D-RoPE,以实现原生面对比.

任何决定都追溯到你能读到的论文.

```figure
image-patch-tokens
```

## 用它

`code/main.py`采用图像H,W,贴片P,隐藏D,深度L) 并报告:

- 接后的网格形状和序列长度.
- 合成8x8像素玩具图像的代币序列 (通过平面+项目路径进行步行).
- 按补丁嵌入,位置嵌入,变压器块和头进行分类.
- 目标分辨率的前进通过的FLOP.
- 通过 ViT-B/16 @ 224, ViT-L/14 @ 336, DINOv2 ViT-g/14 @ 224, SigLIP SO400m/14 @ 384 的比较表.

运行它,与公布的数量匹配,用补丁尺寸和分辨率来感觉到代币计数成本.

## 运送它

这一课产生了`outputs/skill-patch-geometry-reader.md`鉴于 ViT 配置 (补丁尺寸,分辨率,隐藏的暗淡,深度),它产生了代币数量,参数数数量和VRAM估计,并有理由.当您选择视觉脊柱为VLM时,使用这种技能,它可以防止"代币爆炸和我的LLM环境填满"惊喜.

## 运动

1. 计算Qwen2.5-VL的补丁代码序列长度在原始输入1280x720时,带有补丁尺寸14.这与仅CLS的表示如何相比?

2. 在1080p的片 (1920x1080) 在补丁14产生多少代币?在5分钟的视频中,在30FPS时,总共有多少视觉代币?哪个成本节省你最多:聚合,片样本,或代币合并?

3. 实现纯Python中补丁代币的平均聚合. 检查DINOv2输出中196个代币的平均聚合量是否匹配模型的平均聚合值.`forward`您需要一个集成的嵌入式.

4. 阅读"视觉变换器需要注册" (arXiv:2309.16588) 第3节.

5. 修改`code/main.py`给出不同分辨率的图像列表,生成单个包装序列和区块图形注意力面具.

## 关键词

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Patch | "16x16 pixel square" | A fixed-size non-overlapping region of the input image; becomes one token |
| Patch embedding | "Linear projection" | A shared learned matrix (or Conv2d with stride=P) mapping flattened patch pixels to D-dim vectors |
| CLS token | "Class token" | Prepended learnable vector whose final hidden state represents the whole image; optional in 2026 |
| Register token | "Sink token" | Extra learnable tokens that absorb the high-norm attention artifacts ViTs develop during pretraining |
| Position embedding | "Positional info" | Per-position vector or rotation making the sequence-order-aware; 2D-RoPE is the modern default |
| Grid | "Patch grid" | The (H/P) x (W/P) 2D array of patches for a given resolution and patch size |
| NaFlex | "Native flexible resolution" | SigLIP 2 feature: single model serves multiple aspect ratios and resolutions without retraining |
| Backbone | "Vision tower" | The pretrained image encoder whose patch-token outputs feed the LLM in a VLM |
| Pooling | "Image-level summary" | Strategy to turn patch tokens into one vector: CLS, mean, attention pool, or register-based |
| Patch 14 vs 16 | "Finer vs coarser grid" | Patch 14 produces more tokens per image, better fidelity for OCR, slower; patch 16 is the classic default |

## 进一步阅读

- [Dosovitskiy et al. — An Image is Worth 16x16 Words (arXiv:2010.11929)](https://arxiv.org/abs/2010.11929)原始的ViT.
- [He et al. — Masked Autoencoders Are Scalable Vision Learners (arXiv:2111.06377)](https://arxiv.org/abs/2111.06377)MAE,自我监督预训练.
- [Oquab et al. — DINOv2 (arXiv:2304.07193)](https://arxiv.org/abs/2304.07193)自化量,没有标签.
- [Darcet et al. — Vision Transformers Need Registers (arXiv:2309.16588)](https://arxiv.org/abs/2309.16588)注册代币和文物分析.
- [Tschannen et al. — SigLIP 2 (arXiv:2502.14786)](https://arxiv.org/abs/2502.14786)2026年默认的视觉塔.
- [Zhai et al. — Scaling Vision Transformers (arXiv:2106.04560)](https://arxiv.org/abs/2106.04560)经验性扩展法则.
