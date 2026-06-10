# 22 · 文档与图表理解

> 文档不是照片。一份 PDF、科研论文、发票或手写表单，拥有版面布局、表格、图示、脚注、页眉以及语义结构，这些都是单纯的图像理解无法捕捉的。前 VLM 时代的技术栈是一条流水线：Tesseract OCR + LayoutLMv3 + 表格抽取启发式规则。VLM 浪潮用「无 OCR（OCR-free）」模型取代了它——Donut（2022）、Nougat（2023）、DocLLM（2023）——这些模型直接输出结构化标记。到 2026 年，前沿方案就是「把页面图像以 2576px 原生分辨率喂给 Claude Opus 4.7」，结构化标记输出顺带就有了。本课梳理文档 AI 的三个时代弧线。

**类型：** 实战构建
**语言：** Python（标准库，版面感知的文档解析器骨架）
**前置：** 第 12 阶段 · 05（LLaVA）、第 5 阶段（NLP）
**时长：** 约 180 分钟

## 学习目标

- 解释文档 AI 的三个时代：OCR 流水线、无 OCR、VLM 原生。
- 描述 LayoutLMv3 的三路输入流：文本、版面（bbox）、图像块（image patches），以及统一的掩码训练。
- 对比 Donut（无 OCR，图像 → 标记）、Nougat（科研论文 → LaTeX）、DocLLM（版面感知的生成式）、PaliGemma 2（VLM 原生）。
- 为一项新任务挑选合适的文档模型（发票、科研论文、手写表单、中文小票）。

## 问题所在

「读懂这份 PDF」看似简单，实则很难。信息分散在：

- 文本内容（占信号的 90%）。
- 版面布局（页眉、脚注、侧栏、双栏排版）。
- 表格（行、列、合并单元格）。
- 图形与图示。
- 手写批注。
- 字体与排版（标题 vs 正文）。

原始 OCR 只把文本倒出来，丢掉了其余一切。一个关心发票的系统需要知道「Total: $1,245」来自右下角，而不是来自某条脚注。

## 核心概念

### 时代一 —— OCR 流水线（2021 年以前）

经典技术栈：

1. PDF → 每页一张图像。
2. Tesseract（或商业 OCR）抽取文本，并给出每个单词的边界框（bounding box）。
3. 版面分析器识别区块（页眉、表格、段落）。
4. 表格结构识别器解析表格。
5. 领域规则 + 正则表达式抽取字段。

对干净的印刷体文本有效。遇到手写、倾斜扫描件、复杂表格、非英语文字就崩。每一种失败模式都需要一条定制的异常处理路径。

### TrOCR（2021）

TrOCR（Li et al., arXiv:2109.10282）用一个 Transformer 编码器-解码器取代了 Tesseract 经典的 CNN-CTC，并在合成 + 真实文本图像上训练。在手写与多语种文本上是干净利落的胜利。它仍然是一条流水线（检测器 → TrOCR → 版面），但 OCR 这一步有了显著改进。

### 时代二 —— 无 OCR（2022-2023）

第一批无 OCR 模型的主张是：彻底跳过检测，直接把图像像素映射为结构化输出。

Donut（Kim et al., arXiv:2111.15664）：
- 编码器-解码器 Transformer，编码器是 Swin-B。
- 输出为表单理解的 JSON、摘要的 markdown，或任意任务专属 schema。
- 无 OCR、无版面、无检测。

Nougat（Blecher et al., arXiv:2308.13418）：
- 专门在科研论文上训练。
- 输出为 LaTeX / markdown。
- 能处理公式、多栏版面、图形。
- 几乎所有 arXiv 解析器都会调用的模型。

它们是专才，不是通才。Donut 用在科研论文上会失败；Nougat 用在发票上会失败。

### LayoutLMv3（2022）

另一条技术路线。LayoutLMv3（Huang et al., arXiv:2204.08387）保留 OCR，但加入了版面理解：

- 三路输入流：OCR 文本 token、每个 token 的 2D 边界框、图像块。
- 在三种模态上统一进行掩码训练目标（掩码文本、掩码图像块、掩码版面）。
- 下游任务：分类、实体抽取、表格问答（table QA）。

LayoutLMv3 是基于 OCR 的文档理解的巅峰。在表单和发票上表现强劲。需要上游有 OCR。在标准化文档基准上拥有前 VLM 时代的最佳准确率。

### DocLLM（2023）

DocLLM（Wang et al., arXiv:2401.00908）是 LayoutLM 的生成式兄弟。在版面 token 的条件约束下生成自由形式的答案。更适合文档问答；但仍依赖 OCR 输入。

### 时代三 —— VLM 原生（2024+）

2024 年的 VLM 已经好到足以彻底取代整条流水线。把完整页面图像以高分辨率喂给 VLM，提问，得到答案。

- LLaVA-NeXT 的 336-tile AnyRes 对小型文档有效。
- Qwen2.5-VL 的动态分辨率可原生处理 2048+ 像素。
- Claude Opus 4.7 支持 2576px 文档。
- PaliGemma 2（2025 年 4 月）专门针对文档 + 手写进行训练。

VLM 原生与 OCR 流水线之间的差距迅速收窄。到 2026 年，VLM 原生在以下方面胜出：

- 场景文本（手写 + 印刷、混合文字）。
- 含合并单元格的复杂表格。
- 嵌入正文中的数学公式。
- 带文字标注的图形。

OCR 流水线在以下方面仍然胜出：

- 对单页延迟敏感的大规模纯扫描件工作负载。
- 流水线可靠性（确定性的失败 vs VLM 幻觉）。
- 需要可审计 OCR 输出的受监管环境。

### Claude 4.7 / GPT-5 前沿

在 2576 像素原生输入下，前沿 VLM 的文档理解已接近人类准确率。2026 年初的基准数据：

- DocVQA：Claude 4.7 约 95.1，PaliGemma 2 约 88.4，Nougat 约 77.3，流水线式 LayoutLMv3 约 83。
- ChartQA：Claude 4.7 约 92.2，GPT-4V 约 78。
- VisualMRC：Claude 4.7 约 94。

闭源模型的差距主要来自分辨率和基座 LLM 的规模。7B 级别的开源模型落后几个点，但正在追赶。

### 数学公式与 LaTeX 输出

科研论文需要对公式给出精确的 LaTeX 输出。Nougat 正是为此训练的。以 LaTeX 为目标训练的 VLM（Qwen2.5-VL-Math、Nougat 衍生版本）能产出可用的 LaTeX。若没有显式的 LaTeX 训练，VLM 给出的转写可读但不精确。

2026 年的科研论文流水线：先用 Nougat 处理 PDF，再用 VLM 处理棘手的页面。

### 手写

仍然是最难的子任务。混合印刷 + 手写（医生病历、填好的表单）正是 OCR 流水线在成本上仍胜过 VLM 的地方。纯手写 VLM 正在进步（Claude 4.7、PaliGemma 2）。

### 2026 年配方

面向一个新的文档 AI 项目：

- 大规模纯印刷体发票：LayoutLMv3 + 规则，成本高效。
- 混合文档（科研 + 手写 + 表单）：VLM 原生（PaliGemma 2 或 Qwen2.5-VL）。
- 全量 arXiv 摄取：数学用 Nougat，图形用 VLM。
- 监管场景：OCR 流水线 + VLM 验证器做交叉核对。

## 上手实践

`code/main.py`：

- 一个玩具级版面感知分词器：给定 (text, bbox) 对，生成 LayoutLMv3 风格的输入。
- 一个 Donut 风格的任务 schema 生成器：用于表单的 JSON 模板。
- 跨 OCR 流水线、Donut、Nougat 与 VLM 原生四种方案的每页 token 预算对比。

## 交付产物

本课产出 `outputs/skill-document-ai-stack-picker.md`。给定一个文档 AI 项目（领域、规模、质量、监管），在 OCR 流水线、无 OCR 专才与 VLM 原生之间做出选择。

## 练习

1. 你的项目是每天 1000 万张发票。哪种技术栈能在不损失准确率的前提下最小化每页成本？

2. 为什么 LayoutLMv3 在表单问答上优于纯 CLIP-VLM，却在场景文本上表现更差？bbox 输入流放弃了什么？

3. Nougat 生成 LaTeX。请提出一个 VLM 原生输出在 LaTeX 保真度上胜过 Nougat 的测试用例，以及一个 Nougat 胜出的用例。

4. 阅读 PaliGemma 2 论文（Google, 2024）。相比 PaliGemma 1，提升文档准确率的关键训练数据新增项是什么？

5. 设计一个监管安全的混合方案：以 OCR 流水线为主，VLM 为辅做交叉核对。出现分歧时如何裁决？

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|-----------------|------------------------|
| OCR pipeline（OCR 流水线） | 「Tesseract 风格」 | 分阶段技术栈：检测 -> OCR -> 版面 -> 规则；确定性强，但脆弱 |
| OCR-free（无 OCR） | 「Donut 风格」 | 跳过显式 OCR 的图像到输出 Transformer；单一模型 |
| Layout-aware（版面感知） | 「LayoutLM」 | 输入包含每个 token 的 bbox 坐标；跨模态统一掩码 |
| VLM-native（VLM 原生） | 「前沿 VLM」 | 将页面图像以高分辨率直接喂给 Claude/GPT/Qwen VLM；无流水线 |
| DocVQA | 「文档基准」 | 文档 VQA 标准；被引用最多的分数 |
| Markup output（标记输出） | 「LaTeX / MD」 | 结构化输出格式而非自由文本；可支撑下游自动化 |

## 延伸阅读

- [Li et al. — TrOCR (arXiv:2109.10282)](https://arxiv.org/abs/2109.10282)
- [Blecher et al. — Nougat (arXiv:2308.13418)](https://arxiv.org/abs/2308.13418)
- [Huang et al. — LayoutLMv3 (arXiv:2204.08387)](https://arxiv.org/abs/2204.08387)
- [Kim et al. — Donut (arXiv:2111.15664)](https://arxiv.org/abs/2111.15664)
- [Wang et al. — DocLLM (arXiv:2401.00908)](https://arxiv.org/abs/2401.00908)
