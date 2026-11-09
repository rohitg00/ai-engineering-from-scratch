# 实习VL3:原生多模式预训

> 在InternVL3之前的每一个开放的VLM都遵循相同的三步配方:用数万亿的文本代币训练的文本LLM, 文本法师已经花费了全部预训预算用于纯文本,并没有原生地理解视觉代币. 当你添加视觉后期时,LLM必须重新学习如何将视觉输入与其文本推理联系起来,而不忘记文本. 实习前,从第一步开始,一个预训练跑,文字和多模特交互. 结果与MMMU-Pro的双子 2.5 Pro相匹配, 这一课讲述了本土预训练的情况,

**Type:** Learn
**Languages:** Python, TypeScript (stdlib, training-corpus mixer)
**Prerequisites:** Phase 12 · 05, Phase 12 · 07 (recipes)
**Time:** ~120 minutes

## 学习目标

- 解释为什么后期VLM培训会积累调整债务,并引用三个可测量的症状 (灾难性遗忘,答案漂移,视觉文本不一致).
- 描述InternVL3的本土预训组合以及为什么文字:交织:字幕的比例很重要.
- 比较V2PE (可变视觉位置编码) 与Qwen2-VL的M-RoPE.
- 命名视觉分辨率路由器 (ViR) 和脱视觉语言 (DvD) 部署优化.

## 问题

后期VLM培训是默认的.LLaVA,BLIP-2,Qwen-VL,Idefics 都接受了已经预训练的LLM (Llama,Vicuna,Qwen,Mistral) 并增加视觉.培训阶段通常看起来像:

1. 结冰的LLM+结冰的视觉编码器+可训练的投影机,训练用字幕对等来调整嵌入式.
2. 解法学,培训教学数据 (LLaVA-Instruct, ShareGPT4V).
3. 选择性任务特定的细调.

结合债务的三个症状出现:

- 遗忘灾难性. 后期VLM忘记了仅仅仅是文字的技能. GSM8K的分数下降了5到10分. 希拉斯瓦格的分数下降了.
- 答案漂移.同一视觉问题中的小短语得到不同的答案.视觉编码器与LLM更弱的结合比LLM自己的代币.
- 视觉文字不一致.VLM可以正确描述图像,然后回答一个与其描述相矛盾的问题.视觉代币不像文字一样参与LLM内部一致性检查.

们的确知道这些症状,MM1.5第4节量化了它们.LLaVA-OneVision的缩暗示了它们.

## 概念

### 产生的多模式预训

从第一步开始,InternVL3从零开始运行在原生多动体上.

- 仅使用文字的数据 (FineWeb, Proof-Pile-2,等)
- 35%的图像与文本数据 (OBELICS,MMC4式)
- 20%的对照图像标题数据
- 5%的视频文本数据

视觉代币,文字代币和跨模式互动都从第一步开始就会产生相同的损失.没有排列预训练,没有投影器结阶段,没有灾难性的遗忘恢复.

基础模型的培训是单一阶段. 基础模型的教训调整是下一步的,

### 视觉位置变量编码

文2-VL使用M-RoPE与固定轴分配.InternVL3引入V2PE:位置编码因模拟类型 (文字,图像,视频) 而异,可学习的扩展.

- 文字代币得到1D位置 (文字索引).
- 图像补丁得到2D位置 (排列,排列).
- 视频框架得到3D位置 (时间,行,col).

它们共享相同的 RoPE 频率基础,但每带的隐藏-dim 分配是学习的参数而不是固定分区.

视频比M-RoPE的比重率:1-2分,不是革命,而是更清洁.

### 视觉分辨率路由器 (ViR)

部署优化. 并非所有图像都需要全分辨率编码.在低细节的照片中,在1280px原生编码时,丢失代币. ViR是一个小类别,预测在编码之前需要的最小分辨率来回答问题.

路由有三个层次:低分辨率 (256个代币),中 (576个),高 (2048+).对于60%的生产流量查询,低或中等是足够的.净效果:同等质量的2-3倍吞吐量.

### 离合视觉语言部署 (DvD)

当你服务一个大的VLM时,视觉编码器每张图像运行一次,但LLM运行为每一个输出代币.两个组件都有不同的瓶 (视觉 = GPU内存带宽为 conv + 注意;LLM = KV缓存).DvD将它们分为单独的GPU,流在之间.

对于8B+400M编码器模型,DvD大致是每节点吞吐量与共位量翻倍.

### 单阶段与多阶段质量

在38B,与GPT-4o相匹配.在8B,领先开放-8B排名榜.所有这些都是在单阶段预训练+指令调节配方上.

调整债务假设可测量:InternVL3-8B输出比Qwen2.5-VL-7B的每单位视力基准增长少的文本基准点 (MMLU,GSM8K).该模型更像是一个通用主义的,因为训练是一个部分,而不是两个.

### 国际VL3.5和国际VL-U

国际VL3.5 (2025年8月) 扩大了食谱.同样的原生预训方法,更多数据,更多参数.MMMU的改进是渐进的.

互联网VL-U (2026) 通过MMDiT头顶添加统一代 图像输出.U"代表"理解+代",追逐转式统一模型 (课 12.13).同一个原生预训的后背支持理解和生成头部.

### 产生预训的交易

培训前的本土人不免费:

- 计算.从零开始训练一个新的VLM成本与教学文本LLM数百万GPU小时相同.
- 数据. 尺度上的交叉图像-文本体很少. OBELICS为141M文件;MMC4为571M.单独的文本在15T代币上运输.多模拟预训数据稀缺是一个艰难的限制.
- 基础LLM重复使用.本土预训练放弃了后退学新LLM的选择. 后期允许您通过重训只将适配器换成Llama-3.1

国际汽车公司 (InternVL3) 的投注:调整债务比重用损失更糟.基准指标支持这一要求.生产成本阻止未来实验室廉价复制.后期VLM将继续存在,因为它们对于大多数项目来说仍然更便宜.

```figure
l5-native-pretrain
```

## 用它

`code/main.py`是一个训练-体组混合器和ViR路由器模拟器.

- 采用目标体组合 (%文本, %中文, %标题, %视频) 并按模式计算预期步骤.
- 模拟对一批查询的 ViR 路由 (分布:50%低细节,30%中等,20%高细节) 并报告平均代币数量.
- 报告了数据数据输出估计,以编码器对LLMFLOP.
- 印制后期与本地预训练的副本,计算,数据,以及预期的调整-债务症状.

## 运送它

这一课产生了`outputs/skill-native-vs-posthoc-auditor.md`根据拟议的VLM培训计划,它会审计是否要进行本地或后期培训,标记调整-债务风险,并建议使用一个综合方案.

## 运动

1. 计算在 InternVL3-8B (原生预训练) 和 LLaVA-OneVision-7B (后训练) 之间的计算三角形. GPU-小时的比例大约是什么?

2. 如果你的目标任务是视频重量,请提出一个新的比率,并辩论为什么基模型仍然需要大量的文本和字幕数据.

3. 读MM1.5第4节关于忘记. 列出了后期训练出现最大回归的准确基准.

4. 维R将60%的流量转移到低分辨率编码.它误导了哪些类型的查询 (在需要高分辨率时将其转移到低分辨率) ?建议三个路由器故障模式.

5. 在什么流量模式下,DvD损害吞吐量而不是帮助?

## 关键词

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| Native multimodal pretraining | "From scratch together" | Text + image + video tokens participate in the loss from step 1, not bolted on later |
| Alignment debt | "Post-hoc penalty" | Measurable regression in text skills and answer consistency that comes from bolting vision onto a frozen LLM |
| V2PE | "Variable visual pos encoding" | Per-modality learnable position encoding allocation; InternVL3's M-RoPE successor |
| ViR | "Resolution router" | Small classifier that picks minimum resolution needed per query before encoding, saving inference tokens |
| DvD | "Decoupled deployment" | Vision encoder on one GPU, LLM on another, with stream handoff; doubles throughput for large VLMs |
| InternVL-U | "Unified understanding + generation" | 2026 follow-up that adds image-generation heads to the native-pretrain backbone |
| Interleaved corpus | "OBELICS / MMC4" | Documents with text and images in natural reading order; the raw material for native pretraining |

## 进一步阅读

- [Chen et al. — InternVL 1 (arXiv:2312.14238)](https://arxiv.org/abs/2312.14238)
- [Zhu et al. — InternVL3 (arXiv:2504.10479)](https://arxiv.org/abs/2504.10479)
- [InternVL3.5 (arXiv:2508.18265)](https://arxiv.org/abs/2508.18265)
- [InternVL-U (arXiv:2603.09877)](https://arxiv.org/abs/2603.09877)
- [Zhang et al. — MM1.5 (arXiv:2409.20566)](https://arxiv.org/abs/2409.20566)
