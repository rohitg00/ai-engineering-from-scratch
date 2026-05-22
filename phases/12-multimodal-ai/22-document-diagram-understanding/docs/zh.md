# 文档与图表理解（Document and Diagram Understanding）

> 文档不是照片。一份PDF、科学论文、发票或手写表单包含布局、表格、图表、脚注、标题和语义结构，单纯图像理解无法捕捉这些信息。前VLM时代的典型流程是：Tesseract OCR + LayoutLMv3 + 表格提取启发式规则。VLM浪潮用无OCR（OCR-free）模型取代了它——Donut（2022）、Nougat（2023）、DocLLM（2023）——这些模型直接输出结构化标记。到2026年，前沿技术就是“将页面图像以2576像素原生分辨率输入Claude Opus 4.7”，结构化标记输出自然产生。本课内容贯穿文档AI的三个时代。

**类型：** 构建
**语言：** Python（标准库，布局感知文档解析器框架）
**前置条件：** 阶段12 · 05（LLaVA），阶段5（NLP）
**时间：** 约180分钟

## 学习目标

- 解释文档AI的三个时代：OCR流程、无OCR、VLM原生。
- 描述LayoutLMv3的三个输入流：文本、布局（边界框）、图像块，以及统一掩码（unified masking）。
- 比较Donut（无OCR，图像→标记）、Nougat（科学论文→LaTeX）、DocLLM（布局感知生成）、PaliGemma 2（VLM原生）。
- 为新任务（发票、科学论文、手写表格、中文收据）选择合适的文档模型。

## 问题

“理解这份PDF”这一任务极具欺骗性。信息分布在：

- 文本内容（90%的信号）。
- 布局（页眉、脚注、侧边栏、双栏格式）。
- 表格（行、列、合并单元格）。
- 图和图表。
- 手写注释。
- 字体和排版（标题 vs 正文）。

原始OCR提取文本但丢失了其余信息。关注发票的系统需要知道“总计：$1,245”来自右下角，而不是脚注。

## 概念

### 时代1——OCR流程（2021年之前）

经典栈：

1. PDF → 每页图像。
2. Tesseract（或商业OCR）提取带逐词边界框的文本。
3. 布局分析器识别区块（页眉、表格、段落）。
4. 表格结构识别器解析表格。
5. 领域规则 + 正则提取字段。

适用于清晰的印刷文本。在手写、倾斜扫描、复杂表格、非英语脚本上会失效。每种失败模式都需要定制异常处理路径。

### TrOCR（2021）

TrOCR（Li 等人，arXiv:2109.10282）用Transformer编码器-解码器（在合成+真实文本图像上训练）取代了Tesseract经典的CNN-CTC。在手写和多语言文本上取得了明显优势。仍然是一个流程（检测器→TrOCR→布局），但OCR步骤有了巨大改进。

### 时代2——无OCR（2022-2023）

首批无OCR模型说：完全跳过检测，将图像像素直接映射到结构化输出。

Donut（Kim 等人，arXiv:2111.15664）：
- 编码器-解码器Transformer，编码器为Swin-B。
- 输出：表单理解为JSON，摘要为Markdown，或任何任务特定模式。
- 无需OCR、无需布局、无需检测。

Nougat（Blecher 等人，arXiv:2308.13418）：
- 专门针对科学论文训练。
- 输出为LaTeX / Markdown。
- 处理公式、多栏布局、图表。
- 每个arXiv解析器都会调用的模型。

这些是专业模型，不是通用模型。Donut处理科学论文会失败；Nougat处理发票会失败。

### LayoutLMv3（2022）

另一条路线。LayoutLMv3（Huang 等人，arXiv:2204.08387）保留OCR但增加了布局理解：

- 三个输入流：OCR文本令牌、每个令牌的2D边界框、图像块。
- 跨三种模态的掩码训练目标（掩码文本、掩码图像块、掩码布局）。
- 下游任务：分类、实体提取、表格问答。

LayoutLMv3是基于OCR的文档理解的巅峰。在表单和发票上表现强劲。需要上游OCR。在标准化文档基准测试上，前VLM时代的最佳准确率。

### DocLLM（2023）

DocLLM（Wang 等人，arXiv:2401.00908）是LayoutLM的生成式兄弟姐妹。基于布局令牌生成自由形式的答案。更适合文档问答；仍依赖OCR输入。

### 时代3——VLM原生（2024年+）

2024年，VLM变得足够好，可以完全取代流程。将整页高分辨率图像送入VLM，提出问题，获得答案。

- LLaVA-NeXT 336-tile AnyRes适用于小型文档。
- Qwen2.5-VL动态分辨率原生处理2048+像素。
- Claude Opus 4.7支持2576像素文档。
- PaliGemma 2（2025年4月）专门针对文档+手写训练。

VLM原生与OCR流程之间的差距迅速缩小。到2026年，VLM原生在以下方面胜出：

- 场景文本（手写+印刷，混合脚本）。
- 带有合并单元格的复杂表格。
- 嵌入文本中的数学公式。
- 带文本注释的图表。

OCR流程仍然在以下方面胜出：

- 大规模纯扫描工作负载，其中每页延迟是关键。
- 流程可靠性（确定性失败 vs VLM幻觉）。
- 需要可审计OCR输出的监管环境。

### Claude 4.7 / GPT-5 前沿

在2576像素原生输入下，前沿VLM以接近人类的准确率进行文档理解。2026年初的基准测试数据：

- DocVQA：Claude 4.7 ~95.1，PaliGemma 2 ~88.4，Nougat ~77.3，流程化LayoutLMv3 ~83。
- ChartQA：Claude 4.7 ~92.2，GPT-4V ~78。
- VisualMRC：Claude 4.7 ~94。

闭源模型差距主要在于分辨率和基础LLM规模。7B开源模型落后几个百分点，但正在追赶。

### 数学公式与LaTeX输出

科学论文需要精确的LaTeX输出用于公式。Nougat在此方面进行了训练。使用LaTeX目标训练的VLM（Qwen2.5-VL-Math、Nougat衍生模型）会产生可用的LaTeX。没有显式的LaTeX训练，VLM会产生可读但不精确的转录。

对于2026年的科学论文流程：在PDF上运行Nougat，然后在棘手页面上使用VLM。

### 手写

仍然是最困难的子任务。混合印刷+手写（医生笔记、填写的表格）是OCR流程在成本上仍然优于VLM的领域。仅手写的VLM正在改进（Claude 4.7、PaliGemma 2）。

### 2026年配方

对于新的文档AI项目：

- 大规模纯印刷发票：LayoutLMv3 + 规则，成本高效。
- 混合文档（科学+手写+表单）：VLM原生（PaliGemma 2 或 Qwen2.5-VL）。
- 完整 arXiv 摄入：Nougat处理数学，VLM处理图表。
- 监管场景：OCR流程 + VLM验证器进行交叉检查。

## 使用它

`code/main.py`：

- 一个玩具版布局感知分词器：给定（文本，边界框）对，生成LayoutLMv3风格的输入。
- 一个Donut风格的任务模式生成器：用于表单的JSON模板。
- 比较OCR流程、Donut、Nougat和VLM原生每页的令牌预算。

## 交付

本课生成 `outputs/skill-document-ai-stack-picker.md`。给定一个文档AI项目（领域、规模、质量、监管），在OCR流程、无OCR专业模型和VLM原生之间做出选择。

## 练习

1. 你的项目每天处理1000万张发票。哪种方案能在不损失准确率的情况下最小化每页成本？

2. 为什么LayoutLMv3在表单问答上优于纯CLIP-VLM，但在场景文本上表现较差？边界框流放弃了什么？

3. Nougat生成LaTeX。提出一个测试案例，VLM原生输出在LaTeX保真度上优于Nougat，以及一个Nougat胜出的案例。

4. 阅读PaliGemma 2论文（Google，2024年）。与PaliGemma 1相比，提升文档准确率的关键训练数据补充是什么？

5. 设计一个监管安全的混合方案：OCR流程作为主要，VLM作为辅助交叉检查。如何解决分歧？

## 关键术语

| 术语 | 人们常说的 | 实际含义 |
|------|-----------|----------|
| OCR流程（OCR pipeline） | “Tesseract风格” | 分阶段栈：检测 -> OCR -> 布局 -> 规则；确定性，脆弱 |
| 无OCR（OCR-free） | “Donut风格” | 图像到输出的Transformer，跳过显式OCR；单一模型 |
| 布局感知（Layout-aware） | “LayoutLM” | 输入包含每个令牌的边界框坐标；跨模态统一掩码 |
| VLM原生（VLM-native） | “前沿VLM” | 直接将页面图像以高分辨率送入Claude/GPT/Qwen VLM；无流程 |
| DocVQA | “文档基准” | 文档VQA标准；最常引用的分数 |
| 标记输出（Markup output） | “LaTeX / MD” | 结构化输出格式而非自由形式文本；支持下游自动化 |

## 进一步阅读

- [Li 等人 — TrOCR (arXiv:2109.10282)](https://arxiv.org/abs/2109.10282)
- [Blecher 等人 — Nougat (arXiv:2308.13418)](https://arxiv.org/abs/2308.13418)
- [Huang 等人 — LayoutLMv3 (arXiv:2204.08387)](https://arxiv.org/abs/2204.08387)
- [Kim 等人 — Donut (arXiv:2111.15664)](https://arxiv.org/abs/2111.15664)
- [Wang 等人 — DocLLM (arXiv:2401.00908)](https://arxiv.org/abs/2401.00908)