# 文档与图表理解

> 文档不是照片。PDF、科学论文、发票或手写表单包含版面、表格、图表、脚注、页眉和语义结构，这些是普通图像理解无法捕捉的。VLM 出现前的技术栈是一条流水线：Tesseract OCR + LayoutLMv3 + 表格提取启发式规则。VLM 浪潮用免 OCR 模型取代了它——Donut（2022）、Nougat（2023）、DocLLM（2023）——它们直接输出结构化标记。到 2026 年，前沿做法就是“以 2576px 原生分辨率把页面图像喂给 Claude Opus 4.7”，结构化标记输出是免费附带的。本课梳理文档 AI 的三个时代演进。

**Type:** Build
**Languages:** Python（标准库，版面感知文档解析器骨架）
**Prerequisites:** Phase 12 · 05（LLaVA）、Phase 5（NLP）
**Time:** 约 180 分钟

## 学习目标

- 解释文档 AI 的三个时代：OCR 流水线、免 OCR、VLM 原生。
- 描述 LayoutLMv3 的三种输入流：文本、版面（bbox）、图像块，以及统一掩码机制。
- 比较 Donut（免 OCR，图像 → 标记）、Nougat（科学论文 → LaTeX）、DocLLM（版面感知生成式）、PaliGemma 2（VLM 原生）。
- 为新任务选择文档模型（发票、科学论文、手写表单、中文收据）。

## 问题

“理解这个 PDF”看似简单实则困难。信息分布在：

- 文本内容（90% 的信号）。
- 版面（页眉、脚注、侧栏、双栏排版）。
- 表格（行、列、合并单元格）。
- 图形与图表。
- 手写批注。
- 字体与排版（标题 vs 正文）。

原始 OCR 只倾倒文本，丢失其余部分。一个处理发票的系统需要知道“Total: $1,245”来自右下角，而不是来自某条脚注。

## 概念

### 时代 1 — OCR 流水线（2021 年前）

经典技术栈：

1. PDF → 逐页转图像。
2. Tesseract（或商用 OCR）提取文本及逐词边界框。
3. 版面分析器识别区块（页眉、表格、段落）。
4. 表格结构识别器解析表格。
5. 领域规则 + 正则表达式提取字段。

适用于干净的印刷文本。在手写体、倾斜扫描件、复杂表格、非英文文字上失效。每种失败模式都需要定制的异常处理路径。

### TrOCR（2021）

TrOCR（Li 等，arXiv:2109.10282）用基于合成 + 真实文本图像训练的 transformer 编码器-解码器取代了 Tesseract 的经典 CNN-CTC。在手写和多语言文本上有明显优势。它仍是一条流水线（先检测，再 TrOCR，再做版面分析），但 OCR 这一步大幅改进。

### 时代 2 — 免 OCR（2022-2023）

第一批免 OCR 模型的思路是：完全跳过检测，直接把图像像素映射为结构化输出。

Donut（Kim 等，arXiv:2111.15664）：
- 编码器-解码器 transformer，编码器为 Swin-B。
- 输出可以是表单理解的 JSON、摘要的 markdown，或任何任务特定模式。
- 无 OCR、无版面分析、无检测。

Nougat（Blecher 等，arXiv:2308.13418）：
- 专门在科学论文上训练。
- 输出为 LaTeX / markdown。
- 处理公式、多栏版面、图形。
- 所有 arXiv 解析器都会调用的模型。

这些是专家而非通才。Donut 遇到科学论文会失败；Nougat 遇到发票会失败。

### LayoutLMv3（2022）

另一条路线。LayoutLMv3（Huang 等，arXiv:2204.08387）保留 OCR，但加入了版面理解：

- 三种输入流：OCR 文本 token、逐 token 的 2D 边界框、图像块。
- 跨三种模态的掩码训练目标（掩码文本、掩码图像块、掩码版面）。
- 下游任务：分类、实体抽取、表格问答。

LayoutLMv3 是基于 OCR 的文档理解的巅峰。在表单和发票上表现强劲。需要上游 OCR。在标准化文档基准上是 VLM 出现前的最佳精度。

### DocLLM（2023）

DocLLM（Wang 等，arXiv:2401.00908）是 LayoutLM 的生成式兄弟。以版面 token 为条件生成自由形式的回答。更适合文档问答；但仍依赖 OCR 输入。

### 时代 3 — VLM 原生（2024+）

2024 年，VLM 变得足够好，可以完全取代流水线。把整页高分辨率图像喂给 VLM，提问，得到答案。

- LLaVA-NeXT 336-tile AnyRes 适用于小型文档。
- Qwen2.5-VL 动态分辨率原生支持 2048+ 像素。
- Claude Opus 4.7 支持 2576px 文档。
- PaliGemma 2（2025 年 4 月）专门针对文档 + 手写体训练。

VLM 原生与 OCR 流水线之间的差距迅速缩小。到 2026 年，VLM 原生在以下方面胜出：

- 场景文本（手写 + 印刷混合，多种文字）。
- 带合并单元格的复杂表格。
- 嵌入文本中的数学公式。
- 带文字标注的图形。

OCR 流水线仍在以下方面胜出：

- 大规模纯扫描工作负载，单页延迟很重要。
- 流水线可靠性（确定性失败 vs VLM 幻觉）。
- 需要可审计 OCR 输出的受监管环境。

### Claude 4.7 / GPT-5 前沿

在 2576 像素原生输入下，前沿 VLM 的文档理解准确率接近人类。2026 年初的基准数据：

- DocVQA：Claude 4.7 约 95.1，PaliGemma 2 约 88.4，Nougat 约 77.3，流水线式 LayoutLMv3 约 83。
- ChartQA：Claude 4.7 约 92.2，GPT-4V 约 78。
- VisualMRC：Claude 4.7 约 94。

闭源模型的差距主要来自分辨率和基础 LLM 规模。7B 的开源模型落后几个点，但在追赶中。

### 数学公式与 LaTeX 输出

科学论文需要公式输出精确的 LaTeX。Nougat 是为此训练的。以 LaTeX 为目标训练的 VLM（Qwen2.5-VL-Math、Nougat 衍生模型）能产出可用的 LaTeX。没有显式 LaTeX 训练的 VLM 产出可读但不精确的转录。

2026 年的科学论文流水线：先用 Nougat 处理 PDF，再对棘手页面使用 VLM。

### 手写体

仍然是最难的子任务。印刷 + 手写混合（医生笔记、填写表单）是 OCR 流水线在成本上仍胜过 VLM 的领域。纯手写体 VLM 正在改进（Claude 4.7、PaliGemma 2）。

### 2026 年配方

新文档 AI 项目：

- 大规模纯印刷发票：LayoutLMv3 + 规则，性价比高。
- 混合文档（科学 + 手写 + 表单）：VLM 原生（PaliGemma 2 或 Qwen2.5-VL）。
- 全量 arXiv 摄取：数学用 Nougat，图形用 VLM。
- 监管场景：OCR 流水线 + VLM 校验器交叉验证。

```figure
mm-doc-layout
```

## 动手实践

`code/main.py`：

- 一个玩具版面感知分词器：给定 (文本, bbox) 对，生成 LayoutLMv3 风格的输入。
- 一个 Donut 风格的任务模式生成器：表单的 JSON 模板。
- OCR 流水线、Donut、Nougat 和 VLM 原生的每页 token 预算对比。

## 交付成果

本课产出 `outputs/skill-document-ai-stack-picker.md`。给定一个文档 AI 项目（领域、规模、质量、监管要求），在 OCR 流水线、免 OCR 专家模型和 VLM 原生之间做出选择。

## 练习

1. 你的项目每天处理 1000 万张发票。哪种技术栈能在不损失准确率的前提下最小化每页成本？

2. 为什么 LayoutLMv3 在表单问答上胜过纯 CLIP-VLM，却在场景文本上表现不佳？bbox 流放弃了什么？

3. Nougat 生成 LaTeX。提出一个 VLM 原生输出在 LaTeX 保真度上胜过 Nougat 的测试用例，以及一个 Nougat 胜出的用例。

4. 阅读 PaliGemma 2 论文（Google，2024）。相比 PaliGemma 1，提升文档准确率的关键训练数据补充是什么？

5. 设计一个监管安全的混合方案：OCR 流水线为主，VLM 为辅做交叉校验。如何解决两者不一致的情况？

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|-----------------|------------------------|
| OCR 流水线 | “Tesseract 风格” | 分阶段技术栈：检测 -> OCR -> 版面 -> 规则；确定性但脆弱 |
| 免 OCR | “Donut 风格” | 图像到输出的 transformer，跳过显式 OCR；单一模型 |
| 版面感知 | “LayoutLM” | 输入包含逐 token 的 bbox 坐标；跨模态统一掩码 |
| VLM 原生 | “前沿 VLM” | 把页面图像直接以高分辨率喂给 Claude/GPT/Qwen VLM；无流水线 |
| DocVQA | “文档基准” | 文档 VQA 标准；被引用最多的分数 |
| 标记输出 | “LaTeX / MD” | 结构化输出格式而非自由文本；支持下游自动化 |

## 延伸阅读

- [Li 等 — TrOCR (arXiv:2109.10282)](https://arxiv.org/abs/2109.10282)
- [Blecher 等 — Nougat (arXiv:2308.13418)](https://arxiv.org/abs/2308.13418)
- [Huang 等 — LayoutLMv3 (arXiv:2204.08387)](https://arxiv.org/abs/2204.08387)
- [Kim 等 — Donut (arXiv:2111.15664)](https://arxiv.org/abs/2111.15664)
- [Wang 等 — DocLLM (arXiv:2401.00908)](https://arxiv.org/abs/2401.00908)