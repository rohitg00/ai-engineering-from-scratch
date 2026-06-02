# 文档与图表理解（Document and Diagram Understanding）

> 译注：本文译自同目录 [`en.md`](./en.md)。术语遵循仓根 [TRANSLATION_GUIDE.md](../../../../TRANSLATION_GUIDE.md)。

> 文档不是照片。一份 PDF、科研论文、发票、手写表单，里面有版式、表格、图示、脚注、页眉以及语义结构，纯图像理解抓不住这些。VLM 出现之前那一套是流水线：Tesseract OCR + LayoutLMv3 + 表格抽取启发式。VLM 浪潮把它换成了 OCR-free 模型——Donut（2022）、Nougat（2023）、DocLLM（2023）——直接吐出结构化标记。到 2026 年，前沿做法就是「把页面图扔给 Claude Opus 4.7、用 2576px 原生分辨率」，结构化标记输出顺带就有了。本课带你读完文档 AI 三个时代的弧线。

**Type:** Build
**Languages:** Python (stdlib, layout-aware document parser skeleton)
**Prerequisites:** Phase 12 · 05 (LLaVA), Phase 5 (NLP)
**Time:** ~180 minutes

## 学习目标（Learning Objectives）

- 讲清文档 AI 三个时代：OCR 流水线、OCR-free、VLM-native。
- 描述 LayoutLMv3 的三路输入流：文本、版式（bbox）、图像 patch，以及统一的 masking 训练目标。
- 对比 Donut（OCR-free，图像 → 标记）、Nougat（科研论文 → LaTeX）、DocLLM（layout-aware 生成式）、PaliGemma 2（VLM-native）。
- 给一个新任务（发票、科研论文、手写表单、中文小票）挑选合适的文档模型。

## 问题（The Problem）

「理解这份 PDF」表面简单，其实很难。信息散落在：

- 文本内容（占 90% 的信号）。
- 版式（页眉、脚注、侧栏、双栏排版）。
- 表格（行、列、合并单元格）。
- 图与图示。
- 手写批注。
- 字体与排版（标题 vs 正文）。

裸 OCR 把文本倒出来，其他全丢。一个关心发票的系统需要知道「Total: $1,245」是从右下角来的，不是从某条脚注里来的。

## 概念（The Concept）

### 第一时代——OCR 流水线（2021 年前）（Era 1 — OCR pipeline (pre-2021)）

经典栈：

1. PDF → 每页一张图。
2. Tesseract（或商用 OCR）把文本连同每个词的边界框抽出来。
3. 版式分析器识别块（页眉、表格、段落）。
4. 表格结构识别器解析表格。
5. 领域规则 + 正则抽取字段。

对干净的印刷文本管用。手写、倾斜扫描件、复杂表格、非英文脚本就崩。每种失败模式都得加一条自定义异常通路。

### TrOCR（2021）（TrOCR (2021)）

TrOCR（Li 等，arXiv:2109.10282）把 Tesseract 那套经典 CNN-CTC 换成了 transformer 的 encoder-decoder，在合成 + 真实文本图像上训练。手写和多语种文本上是干净的胜利。本质仍是流水线（先检测，再 TrOCR，再版式），但 OCR 这步效果显著提升。

### 第二时代——OCR-free（2022-2023）（Era 2 — OCR-free (2022-2023)）

第一批 OCR-free 模型说：完全跳过检测，直接把图像像素映射到结构化输出。

Donut（Kim 等，arXiv:2111.15664）：
- encoder-decoder transformer，encoder 是 Swin-B。
- 输出可以是表单理解的 JSON、摘要的 markdown，或任意任务专用的 schema。
- 不要 OCR，不要版式，不要检测。

Nougat（Blecher 等，arXiv:2308.13418）：
- 专门在科研论文上训练。
- 输出是 LaTeX / markdown。
- 能处理公式、多栏排版、插图。
- 几乎所有 arXiv 解析器都在调它。

它们是专才，不是通才。Donut 处理科研论文会失败；Nougat 处理发票也会失败。

### LayoutLMv3（2022）（LayoutLMv3 (2022)）

另一条路线。LayoutLMv3（Huang 等，arXiv:2204.08387）保留 OCR，但加上版式理解：

- 三路输入流：OCR 文本 token、每个 token 的 2D 边界框、图像 patch。
- 跨三种模态的 masked 训练目标（masked 文本、masked patch、masked 版式）。
- 下游任务：分类、实体抽取、表格 QA。

LayoutLMv3 是基于 OCR 的文档理解的巅峰。在表单和发票上很强。需要上游有 OCR。在标准化文档基准上是 VLM 之前最好的精度。

### DocLLM（2023）（DocLLM (2023)）

DocLLM（Wang 等，arXiv:2401.00908）是 LayoutLM 的生成式兄弟。在版式 token 条件下生成自由形式的答案。文档 QA 上更好；但仍然依赖 OCR 输入。

### 第三时代——VLM-native（2024+）（Era 3 — VLM-native (2024+)）

2024 年的 VLM 已经好到可以把整条流水线整体替换。把整页图以高分辨率喂给 VLM，问问题，拿答案。

- LLaVA-NeXT 的 336-tile AnyRes 对小文档够用。
- Qwen2.5-VL 的动态分辨率原生支持 2048+ 像素。
- Claude Opus 4.7 支持 2576px 文档。
- PaliGemma 2（2025 年 4 月）专门在文档 + 手写上训练。

VLM-native 与 OCR 流水线之间的差距迅速缩小。到 2026 年，VLM-native 在以下场景占优：

- 场景文本（手写 + 印刷、混合脚本）。
- 含合并单元格的复杂表格。
- 嵌在正文里的数学公式。
- 带文字标注的插图。

OCR 流水线仍在以下场景占优：

- 海量纯扫描负载、对每页延迟敏感的场景。
- 流水线可靠性（确定性失败 vs VLM 的 hallucination（幻觉））。
- 受监管环境，要求 OCR 输出可审计。

### Claude 4.7 / GPT-5 这条前沿（The Claude 4.7 / GPT-5 frontier）

在 2576 像素原生输入下，前沿 VLM 的文档理解精度接近人类。2026 年初的基准数据：

- DocVQA：Claude 4.7 约 95.1，PaliGemma 2 约 88.4，Nougat 约 77.3，流水线版 LayoutLMv3 约 83。
- ChartQA：Claude 4.7 约 92.2，GPT-4V 约 78。
- VisualMRC：Claude 4.7 约 94。

闭源模型那点优势主要来自分辨率和底座 LLM 的规模。7B 的开源模型落后几个点，但在追上来。

### 数学公式与 LaTeX 输出（Math equations and LaTeX output）

科研论文需要公式的精确 LaTeX 输出。Nougat 就是为此训练的。带 LaTeX 训练目标的 VLM（Qwen2.5-VL-Math、Nougat 派生模型）能产出可用的 LaTeX。没有显式 LaTeX 训练的 VLM 给出的转写读得懂、但不够精确。

2026 年科研论文流水线的做法：先用 Nougat 处理 PDF，再用 VLM 兜底处理棘手的页面。

### 手写（Handwriting）

仍然是最难的子任务。混合印刷 + 手写（医生处方、填好的表格）是 OCR 流水线在成本上仍然打赢 VLM 的地方。纯手写的 VLM 在进步（Claude 4.7、PaliGemma 2）。

### 2026 配方（recipe）（2026 recipe）

新文档 AI 项目的 recipe（配方）：

- 大规模纯印刷发票：LayoutLMv3 + 规则，性价比高。
- 混合文档（科研 + 手写 + 表单）：VLM-native（PaliGemma 2 或 Qwen2.5-VL）。
- 全量 arXiv 摄取：数学用 Nougat，插图用 VLM。
- 监管类：OCR 流水线 + VLM 验证器交叉核对。

## 用起来（Use It）

`code/main.py`：

- 一个玩具版的 layout-aware tokenizer：给定 (text, bbox) 对，产出 LayoutLMv3 风格的输入。
- 一个 Donut 风格的任务 schema 生成器：表单的 JSON 模板。
- 跨 OCR 流水线、Donut、Nougat、VLM-native 的每页 token 预算对比。

## 上线部署（Ship It）

本课产出 `outputs/skill-document-ai-stack-picker.md`。给定一个文档 AI 项目（领域、规模、质量、合规要求），在 OCR 流水线、OCR-free 专才、VLM-native 之间做选择。

## 练习（Exercises）

1. 你的项目是每天 1000 万张发票。哪种栈在不损失精度的前提下把每页成本压到最低？

2. 为什么 LayoutLMv3 在表单 QA 上能赢纯 CLIP 系 VLM，但在场景文本上反而不如？bbox 这一路输入流牺牲了什么？

3. Nougat 生成 LaTeX。提一个 VLM-native 输出在 LaTeX 保真度上胜过 Nougat 的测试用例，再提一个 Nougat 赢的用例。

4. 读 PaliGemma 2 的论文（Google，2024）。相比 PaliGemma 1，把文档精度拉起来的关键训练数据增量是什么？

5. 设计一个监管安全的混合方案：OCR 流水线为主，VLM 作次级交叉核对。两者不一致时怎么裁决？

## 关键术语（Key Terms）

| 术语 | 大家嘴上怎么说 | 实际含义 |
|------|-----------------|------------------------|
| OCR pipeline | 「Tesseract 那套」 | 阶段式栈：检测 -> OCR -> 版式 -> 规则；确定性、脆弱 |
| OCR-free | 「Donut 那套」 | 跳过显式 OCR、image-to-output 的 transformer；单一模型 |
| Layout-aware | 「LayoutLM」 | 输入里含每个 token 的 bbox 坐标；跨模态统一 masking |
| VLM-native | 「前沿 VLM」 | 把页面图直接以高分辨率喂给 Claude/GPT/Qwen VLM；不要流水线 |
| DocVQA | 「文档基准」 | 文档 VQA 的标准；引用最多的分数 |
| Markup output | 「LaTeX / MD」 | 结构化输出格式而不是自由文本；让下游自动化成为可能 |

## 延伸阅读（Further Reading）

- [Li et al. — TrOCR (arXiv:2109.10282)](https://arxiv.org/abs/2109.10282)
- [Blecher et al. — Nougat (arXiv:2308.13418)](https://arxiv.org/abs/2308.13418)
- [Huang et al. — LayoutLMv3 (arXiv:2204.08387)](https://arxiv.org/abs/2204.08387)
- [Kim et al. — Donut (arXiv:2111.15664)](https://arxiv.org/abs/2111.15664)
- [Wang et al. — DocLLM (arXiv:2401.00908)](https://arxiv.org/abs/2401.00908)
