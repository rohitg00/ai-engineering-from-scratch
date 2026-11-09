# 单机图像,多个图像,视频在一个模型

> 在LLaVA-OneVision之前 (Li等,2024年8月) 开放VLM世界有不同的流派:LLaVA-1.5用于单个图像,像Mantis和VILA这样的多图像模型,像Video-LLaVA和Video-LLaMA这样的视频模型. 每个赢得了自己的基准, 拉瓦-一视觉认为,单一的课程可以培养一个模型来主导三个场景, 配方非常简单:视觉代币预算平衡了各种场景, 这一课讲述了预算,课程,以及新兴行为.

**Type:** Build
**Languages:** Python, TypeScript (stdlib, token budget solver + curriculum planner)
**Prerequisites:** Phase 12 · 05 (LLaVA), Phase 12 · 06 (any-resolution)
**Time:** ~180 minutes

## 学习目标

- 设计一个视觉标志的预算,保持在单个图像,多图像和视频输入中平衡.
- 订购一个培训课程,将技能从单一图像转移到视频,
- 解释为什么一个模型在课程正确完成时,比相同参数数量的专家更好.
- 列出LLaVA-OneVision报告的三个新兴功能:多摄像头推理,设置标记提示,iPhone屏幕截图代理.

## 问题

图像,多图像和视频都以不同的方式强调模型.

单个图像需要高分辨率代币 (AnyRes, ~ 2880 视觉代币) 来捕捉 OCR 和细节. 每个样本的预算:一个图像, 2880 代币.

多图像需要几个图像的中度分辨率 (每一个约576个代币),因此图像之间的推理符合背景.每样本的预算:4-8个图像,每一个576,2300-4600个代币.

视频需要低分辨率的许多框架 (合集后每一个框架的196个代币) 来捕捉时间动态. 每个样本的预算:8-32个框架,每个为196,600-6200个代币.

如果你训练一个模型,你选择一个预算. 如果你训练一个模型,你需要预算,

在OneVision之前,默认答案是"训练一个场景,忽略其他场景".视频-LLaVA将视频改装到附加训练阶段的图像模型上.LLaVA-NeXT增加了多个图像支持.没有一个处理了所有三个清洁.

## 概念

### 视代币预算

拉瓦-一视觉不确定一个确切的代币数量. 它平衡每样本的最大视觉代币数量,因此三个场景都处于相同的范围内,大约有6,000到9,000个代币,每个场景分配不同:

- 单个图像:AnyRes-Max-9 (高达9个片+一个基视图),每一个384x384视图提供729个SIGLIP SO400M的代币.最大:729 * (1 + 9) =7290个代币.
- 多图像:每张图像在384个,没有,729个,没有聚合.多达12个图像 →8748个.
- 视频:每幅共 32 个图片,共 384 个图片,共 2 × 2 双线性结合 → 196 个图片.

编码器每场景产生不同的几何学,但LLM消耗类似的预算. `code/main.py`下面的规划器使用较小的玩具预算4096来显示相同的平衡逻辑.

### 三阶段课程

拉瓦-一视线列车分为三个阶段:

1. 单个图像SFT (阶段SI).所有数据都是单个图像加上文本.训练高分辨率AnyRes输入.这教导了感知,OCR和细粒度理解.使用LLaVA-NeXT数据加上OneVision特定单个图像数据.
2. 混合单图像+多图像+视频 (均样本框架).训练统一代币预算. 这教导模型处理异质批量形状.从阶段SI继续没有重复.
3. 任务转移 (TT阶段).继续使用目标任务组合,通常更重于多图像或视频,具体取决于产品.可选的细节调整用于部署.

课程顺序很重要. 视频先或多图片先的训练甚至与单图片先的图像表现更差. 这篇论文明确禁止这一点.

### 为什么课程工作

单个图像培训建立了感知基础.补丁代币具有细粒度的视觉特性;LLM学习将它们与文本集成.多个图像和视频引入了结构性挑战 (哪个图像是什么,什么是第一件事发生),而没有强大的感知基础,很难学习.

如果从零开始将所有场景训练在一起,模型将不符合感知 (每批量有限的单个图像数据) 和超级结构 (大量的多图像/视频数据).结果:一个遵循跨图像推理模式的模型,但视觉上很浅.

课程排序从SI阶段给你知觉强度,然后从OV阶段给你构成/时间推理,

### 突出跨场景技能

报告了三个新兴功能:

1. 基于多摄像头的推理. 训练在多图像 + 视频上单独;在推断下,被要求推理多摄像头的驾驶场景. 模型正确整合了视图,尽管从未在训练中看到那种确切格式.
2. 标记组提示. 用户在图像中注释数值标记的物体;模型理由关于"标记3与标记7相对的行为".
3. 机器人屏幕截图代理.用户提供了iPhone屏幕截图,并要求计划下一个点击. 训练用UI截图,用户工作流程的视频,以及前/后的多图像. 将其简化为机器人使用情况.

这些不是训练有素的任务,而是从课程的组成结构中出现的.

### 视觉标志集成

代币预算需要聚合.OneVision在2D补丁网上使用双线性插图:24x24 = 576补丁变为12x12 = 144 (2x因子) 或8x8 = 64 (3x因子).聚合是在补丁网空间,而不是代币空间中进行,以保持本地性.

合并因素的选择本身是一个超参数. 合并较少 = 更多的代币 = 丰富的表示. 合并较多 = 较少的代币 = 更多的框架 / 图像合适.

### 车车型

2025年后续 (LLaVA-OneVision-1.5, arXiv 2509.23661) 在培训数据,模型权重和代码方面是"完全开放的".它匹配了一些基准的专利差距,民主化了食谱.同样的课程,更多数据,更好的基础LLM. 没有建筑变化.

### 与Qwen2.5VL的对比

文2.5VL (课 12.09) 采用不同的选择.它使用M-RoPE和动态FPS而不是固定聚合.其预算规模与输入 1 分钟视频使用比5秒视频更多的代币.LLaVA-OneVision 修复预算并扩展聚合.这两种功能;它们交换配置性以做预测性.

```figure
l5-onevision-budget
```

## 用它

`code/main.py`根据每个样本的代币预算和目标场景混合 (例如40%的单图,30%的多图,30%的视频),它:

- 分配分辨率,聚合因素和框架.
- 检查每个场景是否符合共享预算.
- 报告预期的代币数量,LLM FLOPs以及哪些场景未达到代币水平.
- 打印一个阶段的训练计划.

通过它来规划OneVision的细节调整或检查VLM部署的每次要求成本.

## 运送它

这一课产生了`outputs/skill-onevision-budget-planner.md`鉴于目标任务分布和每样本预算,它会产生AnyRes因子,每幅相聚,视频相册数量和课程阶段重量.

## 运动

1. 您的产品支持80%单图像,10%多图像 (2-4图像),10%视频 (8-16图片).设计代币预算.您将节省的额外预算放在哪里?

2. 阅读LLaVA-OneVision 4.3节 (新兴能力). 提出课程可能会解锁的第四个新兴技能,但论文没有报道.

3. 换课程顺序 训练多图像,然后单图像,然后视频. 预测哪些基准降低,为什么.

4. 报告报告的视频基准仅在每样本8个框架上训练. 这是否将其总体化为30秒的视频?

5. 双线聚合24x24补丁到12x12是每维度的2x减少,因此4x少的代币.在 stdlib Python 中实现聚合并并验证每个2x2块的平均值是否匹配双线输出.

## 关键词

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| OneVision scenario | "Single-image, multi-image, or video" | One of three input shapes the unified VLM handles; the budget stays balanced across |
| Token budget | "How many tokens per sample" | Total visual tokens the LLM sees per training / inference sample, about 6k to 9k at most in LLaVA-OneVision |
| Curriculum | "Training order" | Stage ordering (single-image → multi-image → video) chosen for emergent transfer |
| Bilinear pooling | "Token shrink" | Applying bilinear interpolation to the patch grid (2D) to reduce token count while preserving locality |
| Emergent skill | "Not trained, still works" | Capability that appears at inference without matching training data, due to curriculum composition |
| AnyRes-k | "k-tile setup" | k sub-tiles of fixed resolution plus one thumbnail, typical $k \in \lbrace 4, 9 \rbrace$ |
| Task transfer | "Cross-scenario generalization" | Skills learned on single-image that apply to video (and vice versa) via shared backbone |

## 进一步阅读

- [Li et al. — LLaVA-OneVision (arXiv:2408.03326)](https://arxiv.org/abs/2408.03326)
- [LLaVA-OneVision-1.5: Fully Open Framework (arXiv:2509.23661)](https://arxiv.org/abs/2509.23661)
- [Lin et al. — Video-LLaVA (arXiv:2311.10122)](https://arxiv.org/abs/2311.10122)
- [Lin et al. — VILA (arXiv:2312.07533)](https://arxiv.org/abs/2312.07533)
- [Wang et al. — Qwen2-VL (arXiv:2409.12191)](https://arxiv.org/abs/2409.12191)
