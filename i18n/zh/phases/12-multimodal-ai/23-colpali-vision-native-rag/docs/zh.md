# 科尔帕利和视觉原生文件RAG

> 传统的RAG将PDF解析成文本,分成块,嵌入块,存储向量. 每一步都会失去信号:OCR丢掉图表数据,碎碎表行,文字嵌入式忽略数字. 科尔帕利 (Faysse等,2024年7月) 提出了一个更简单的问题:为什么要提取文本? 直接通过PaliGemma嵌入页面图像,使用ColBERT式的晚间交互来检索,并保留文件所载的所有布局,数字,字体和格式化信号. 发表的基准标准:视觉丰富的文档的端到端准确度比文本RAG要高20-40%.  ColQwen2, ColSmol 和 VisRAG 扩大了这种模式. 这一课读出了视觉原生RAG论文,

**Type:** Build
**Languages:** Python (stdlib, multi-vector indexer + MaxSim scorer), TypeScript
**Prerequisites:** Phase 11 (LLM Engineering — RAG basics), Phase 12 · 05 (LLaVA)
**Time:** ~180 minutes

## 学习目标

- 解释双编码检索 (每文档一个向量) 和晚交互检索 (每文档许多向量) 的区别.
- 描述ColBERT的MaxSim操作以及ColPali如何将其从文字代币到图像补丁来概括.
- 建立一个像 ColPali 的小索引:页面 →补丁嵌入 → 查询术语嵌入 → top-k页面.
- 在发票/财务报告使用情况上,比较ColPali + Qwen2.5VL发电机与文字RAG + GPT-4.

## 问题

文件中的文字-RAG会丢弃大部分文件.财务报告的第三季度收入增长通常是在图表中;医疗报告的发现在注释图像中;法律合同的签名区块是布局事实,而不是文本事实.

文字-RAG管道:

1. 通过OCR/pdftotext来使用PDF →文本.
2. 文字 → 300-500个代币.
3. 部分 → 双编码嵌入 (一个向量).
4. 用户查询 →嵌入 → 合数相似 → 顶级k块.
5. 士+查询 →法学士.

五个失败步骤,图表未被捕获,表格被分成块,多列布局平坦化,图形注释消失.

 ColPali 的解决方案:跳过 OCR,直接嵌入页面图像. 使用 ColBERT 式的晚间交互来检索,以便模型可以在查询时处理细粒度的补丁.

## 概念

### 科尔伯特 (2020)

科尔伯特 (Khattab & Zaharia, arXiv:2004.12832) 是一个文本检索方法.它每文档的向量不是一个,而是每代币产生一个向量.

- 查询代币得到自己的嵌入 ($N_q$它们的导向
- 文件代币得到嵌入 ($N_d$它们通常是缓存的.
- 评分 = 查询代币的总数,最大为 代币的文件代币: $\sum_i \max_j \cos(q_i, d_j)$现在,我们要去.

现在,我们要做什么?

优势:强大的回忆,处理术语级的语义. 缺点:$N_d$文件的向量,存储成本高昂.

### 鱼

科尔帕利 (Faysse等人, arXiv:2407.01449) 应用了科尔伯特模式到图像.

- 每个页面都通过PaliGemma (ViT+语言) 编码成补丁嵌入: $N_p$单页的向量.
- 每个用户查询 (文本) 都被编码成查询标志嵌入式: $N_q$它们是向量.
- 评分 = $\sum_i \max_j \cos(q_i, p_j)$查询文字标记和页面图像补丁.
- 根据总分数,查看最好的页面.

在文件吞时:将每页都使用PaliGemma嵌入,存储所有补丁嵌入.在查询时:嵌入查询代码,计算MaxSim与所有存储的页面嵌入,返回顶级k页面.

优点:在视觉丰富的文档上,端到端比文字RAG20-40%更好.每个补丁向量捕捉到本地布局和内容.

缺点:$N_p$补丁 × 4 字节的浮动 × $D$由于PQ/OPQ量化,可缓解.

### 素2和素

文2 (伊利科技, 2024-2025) 换了PaliGemma为Qwen2-VL. 更好的基底编码器,更好的检索.

 ColSmol 是用于本地/边缘使用的较小规模变体.

### 皮

维斯RAG (Yu et al., arXiv:2410.10594) 是一个不同的变体:取而代之的是MaxSim在补丁上,将每个页面集成成一个单个向量,然后使用VLM检索双码码.更快的索引 +更小的存储,更弱的回忆.

质量与成本的折衷:质量是ColPali,规模是VISRAG.

### 其他类型

M3DocRAG (Cho et al., arXiv:2411.04952) 将多模索取扩展到多页多文档推理.

### 基准指数

视觉文件检索评估.任务包括财务报告,科学论文,行政文件,医疗记录,手册.

在 ViDoRe 上, ColPali-v1 获得了80%的 nDCG@5;在相同文件上,文本-RAG 获得了50%-60%.

### 终端到终端的RAG管道

对于视力原生RAG:

1. 摄入: PDF → 页面图像 → PaliGemma编码 → 存储所有补丁嵌入式.
2. 查询:用户文本 →查询标志嵌入 → MaxSim对所有索引页面 → top-k页面.
3. 生成:顶级页面图像+查询 → VLM (Qwen2.5-VL或Claude) →答案.

没有任何OCR,图形,图形,字体,布局都流入答案.

### 存储数量

财务报告50页,每页有729个补丁,并包含128个维度的嵌入式:

-  ColPali: 50 * 729 * 128 * 4 字节 = ~ 18 MB 原始, ~ 2.3 MB 后 8x PQ.
- 文字-RAG:50块 * 768-dim * 4字节 = ~150kB.

 ColPali 存储量为每份原材料的120倍.在规模上,OPQ/PQ的8倍将其降至15倍,通常是可以容忍的.

### 当短信RAG仍然赢得

- 文本文本是简单的,存储成本更低.
- 存储占据成本的数百万页档案.
- 严格的监管要求除了检索之外,还需要提取可转录的文本.

其他2026年 财务报告,科学论文,法律合同,医疗记录,UX文档 视觉原生RAG获胜.

```figure
mm-maxsim
```

## 用它

`code/main.py`其他:

- 玩具补丁编码器:将"页面" (特征向量小格式) 映射到一个组补丁嵌入式.
-  MaxSim 评分器:计算查询代币嵌入集和页面补丁集之间的ColBERT式评分.
- 索引5页玩具,执行3个查询,返回最高的K,

## 运送它

这一课产生了`outputs/skill-vision-rag-designer.md`根据文件RAG项目,选择 ColPali / ColQwen2 / VisRAG / text-RAG,并将存储量量量缩小.

## 运动

1. 报告每页有729个补丁,128维嵌入式,4字节的浮动.计算原料存储和PQ压缩存储 (8x).

2. 马克西姆是$\sum_i \max_j \cos(q_i, p_j)$什么是这个总数捕捉到一个简单的意思相似性没有?

3.  ColPali 将页面索引为补丁组.如果我们以词级索引 (如ColBERT所做的) 为替代,会发生什么变化?

4. 设计一个1M页的体积的端到端管道,每个查询的延迟预算为500ms. 选择 ColQwen2 / VisRAG,并证明.

5. 阅读M3DocRAG (arXiv:2411.04952). 描述多页的注意力模式,以及它与单页的ColPali检索如何不同.

## 关键词

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| Late interaction | "ColBERT-style" | Retrieval using per-token or per-patch embeddings + MaxSim, not a single doc vector |
| MaxSim | "Max-over-patches" | For each query token, pick the highest-similarity document token; sum across query |
| Bi-encoder | "Single-vector" | One vector per document; faster but loses granularity |
| Multi-vector | "Many-vectors-per-doc" | Store $N_p$ vectors per document / page; storage cost grows but recall improves |
| Patch embedding | "Page feature" | One vector per image patch from a VLM encoder, cached per page |
| ViDoRe | "Vision doc bench" | ColPali's benchmark suite for visual document retrieval |
| PQ quantization | "Product quantization" | Compression that maintains vector similarity while shrinking storage ~8x |

## 进一步阅读

- [Faysse et al. — ColPali (arXiv:2407.01449)](https://arxiv.org/abs/2407.01449)
- [Khattab & Zaharia — ColBERT (arXiv:2004.12832)](https://arxiv.org/abs/2004.12832)
- [Yu et al. — VisRAG (arXiv:2410.10594)](https://arxiv.org/abs/2410.10594)
- [Cho et al. — M3DocRAG (arXiv:2411.04952)](https://arxiv.org/abs/2411.04952)
- [illuin-tech/colpali GitHub](https://github.com/illuin-tech/colpali)
