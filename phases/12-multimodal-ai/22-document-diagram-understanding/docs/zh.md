# 文档与图表理解

> 文档不是照片。PDF、科学论文、发票或手写表格具有布局、表格、图表、脚注、页眉和普通图像理解无法捕获的语义结构。VLM 前栈是一个流水线：Tesseract OCR + LayoutLMv3 + 表格提取启发式。VLM 浪潮用 OCR-free 模型替代了它——Donut（2022）、Nougat（2023）、DocLLM（2023）——直接发出结构化标记。到 2026 年，前沿只是"以 2576px 原生将页面图像喂给 Claude Opus 4.7"，结构化标记输出免费获得。本课阅读文档 AI 的三个时代弧线。

**类型：** Build
**语言：** Python（stdlib，布局感知文档解析器骨架）
**前置知识：** Phase 12 · 05（LLaVA），Phase 5（NLP）
**时间：** ~180 分钟

## 学习目标

- 解释文档 AI 的三个时代：OCR 流水线、OCR-free、VLM-native。
- 描述 LayoutLMv3 的三个输入流：文本、布局（bbox）、图像 patch，以及统一掩码。
- 比较 Donut（OCR-free，图像 → 标记）、Nougat（科学论文 → LaTeX）、DocLLM（布局感知生成）、PaliGemma 2（VLM-native）。
- 为新任务（发票、科学论文、手写表格、中文收据）选择文档模型。

## 问题所在

"理解这个 PDF"出奇地难。信息位于：

- 文本内容（90% 的信号）。
- 布局（页眉、脚注、侧边栏、双栏格式）。
- 表格（行、列、合并单元格）。
- 图形和图表。
- 手写注释。
- 字体和排版（标题 vs 正文）。

原始 OCR 转储文本并丢失其余内容。关心发票的系统需要知道"总计：$1,245"来自右下角，而非脚注。

## 核心概念

### 时代 1——OCR 流水线（2021 年前）

经典栈：

1. PDF → 每页图像。
2. Tesseract（或商业 OCR）提取带逐词边界框的文本。
3. 布局分析器识别块（页眉、表格、段落）。
4. 表格结构识别器解析表格。
5. 领域规则 + 正则提取字段。

对干净印刷文本有效。对手写、倾斜扫描、复杂表格、非英语脚本失败。每个失败模式都需要自定义异常路径。

### TrOCR（2021）

TrOCR（Li 等人，arXiv:2109.10282）用合成 + 真实文本图像上训练的 transformer 编码器-解码器替换了 Tesseract 的经典 CNN-CTC。在手写和多语言文本上干净获胜。仍然是流水线（检测器然后 TrOCR 然后布局），但 OCR 步骤大幅改进。

### 时代 2——OCR-free（2022-2023）

第一批 OCR-free 模型说：完全跳过检测，直接将图像像素映射到结构化输出。

Donut（Kim 等人，arXiv:2111.15664）：
- 编码器-解码器 transformer，编码器为 Swin-B。
- 输出是表单理解的 JSON、摘要的 markdown 或任何任务特定模式。
- 无 OCR、无布局、无检测。

Nougat（Blecher 等人，arXiv:2308.13418）：
- 专门在科学论文上训练。
- 输出是 LaTeX / markdown。
- 处理方程、多栏布局、图形。
- 每个 arXiv 解析器调用的模型。

这些是专家，非通才。Donut 在科学论文上失败；Nougat 在发票上失败。

### LayoutLMv3（2022）

不同轨道。LayoutLMv3（Huang 等人，arXiv:2204.08387）保留 OCR 但添加布局理解：

- 三个输入流：OCR 文本 token、逐 token 2D 边界框、图像 patch。
- 跨所有三种模态的掩码训练目标（掩码文本、掩码 patch、掩码布局）。
- 下游：分类、实体提取、表格 QA。

LayoutLMv3 是 OCR 基础文档理解的巅峰。在表单和发票上强。需要上游 OCR。在标准化文档基准上最佳 VLM 前精度。

### DocLLM（2023）

DocLLM（Wang 等人，arXiv:2401.00908）是 LayoutLM 的生成兄弟。以布局 token 为条件生成自由形式答案。更适合文档 QA；仍然依赖 OCR 输入。

### 时代 3——VLM-native（2024+）

2024 年 VLM 变得足够好以完全替代流水线。以高分辨率将完整页面图像喂给 VLM，提问，获得答案。

- LLaVA-NeXT 336-tile AnyRes 适用于小文档。
- Qwen2.5-VL 动态分辨率原生处理 2048+ 像素。
- Claude Opus 4.7 支持 2576px 文档。
- PaliGemma 2（2025 年 4 月）专门针对文档 + 手写训练。

VLM-native 与 OCR 流水线之间的差距迅速缩小。到 2026 年，VLM-native 在以下方面获胜：

- 场景文本（手写 + 印刷，混合脚本）。
- 带合并单元格的复杂表格。
- 嵌入文本的数学方程。
- 带文本注释的图形。

OCR 流水线仍然在以下方面获胜：

- 大规模纯扫描工作负载，每页延迟很重要。
- 流水线可靠性（确定性失败 vs VLM 幻觉）。
- 需要可审计 OCR 输出的监管环境。

### Claude 4.7 / GPT-5 前沿

2576 像素原生输入下，前沿 VLM 以接近人类精度进行文档理解。2026 年初的基准数字：

- DocVQA：Claude 4.7 ~95.1，PaliGemma 2 ~88.4，Nougat ~77.3，流水线 LayoutLMv3 ~83。
- ChartQA：Claude 4.7 ~92.2，GPT-4V ~78。
- VisualMRC：Claude 4.7 ~94。

封闭模型差距主要是分辨率和基础 LLM 规模。7B 开放模型落后几分但正在追赶。

### 数学方程和 LaTeX 输出

科学论文需要方程的精确 LaTeX 输出。Nougat 为此训练。用 LaTeX 目标训练的 VLM（Qwen2.5-VL-Math、Nougat 衍生）产生可用的 LaTeX。没有显式 LaTeX 训练，VLM 产生可读但不精确的转录。

对于 2026 年科学论文流水线：在 PDF 上链式 Nougat，然后在棘手页面上用 VLM。

### 手写

仍然是最难的子任务。混合印刷 + 手写（医生笔记、填写表格）是 OCR 流水线在成本上仍然击败 VLM 的地方。纯手写 VLM 正在改进（Claude 4.7、PaliGemma 2）。

### 2026 年配方

对于新的文档 AI 项目：

- 大规模纯印刷发票：LayoutLMv3 + 规则，成本高效。
- 混合文档（科学 + 手写 + 表单）：VLM-native（PaliGemma 2 或 Qwen2.5-VL）。
- 完整 arXiv 摄取：Nougat 用于数学，VLM 用于图形。
- 监管：OCR 流水线 + VLM 验证器用于交叉检查。

## 使用它

`code/main.py`：

- 玩具布局感知 token 化器：给定（文本、bbox）对，产生 LayoutLMv3 风格输入。
- Donut 风格任务模式生成器：表单的 JSON 模板。
- 跨 OCR 流水线、Donut、Nougat 和 VLM-native 的每页 token 预算比较。

## 交付它

本课产出 `outputs/skill-document-ai-stack-picker.md`。给定文档 AI 项目（领域、规模、质量、监管），在 OCR 流水线、OCR-free 专家和 VLM-native 之间选择。

## 练习

1. 你的项目是每天 1000 万发票。哪个栈在不损失精度的情况下最小化每页成本？

2. 为什么 LayoutLMv3 在表单 QA 上优于纯 CLIP-VLM，但在场景文本上表现不佳？bbox 流放弃了什么？

3. Nougat 生成 LaTeX。提出 VLM-native 输出在 LaTeX 保真度上击败 Nougat 的测试用例，以及 Nougat 获胜的用例。

4. 阅读 PaliGemma 2 论文（Google，2024）。与 PaliGemma 1 相比，提升文档精度的关键训练数据添加是什么？

5. 设计监管安全的混合：OCR 流水线为主，VLM 为辅助交叉检查。如何解决分歧？

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|-----------------|------------------------|
| OCR 流水线 | "Tesseract 风格" | 分阶段栈：检测 -> OCR -> 布局 -> 规则；确定性，脆弱 |
| OCR-free | "Donut 风格" | 跳过显式 OCR 的图像到输出 transformer；单一模型 |
| 布局感知 | "LayoutLM" | 输入包括逐 token bbox 坐标；跨模态统一掩码 |
| VLM-native | "前沿 VLM" | 以高分辨率直接将页面图像喂给 Claude/GPT/Qwen VLM；无流水线 |
| DocVQA | "文档基准" | 文档 VQA 标准；最常引用的分数 |
| 标记输出 | "LaTeX / MD" | 结构化输出格式而非自由形式文本；支持下游自动化 |

## 延伸阅读

- [Li et al. — TrOCR (arXiv:2109.10282)](https://arxiv.org/abs/2109.10282)
- [Blecher et al. — Nougat (arXiv:2308.13418)](https://arxiv.org/abs/2308.13418)
- [Huang et al. — LayoutLMv3 (arXiv:2204.08387)](https://arxiv.org/abs/2204.08387)
- [Kim et al. — Donut (arXiv:2111.15664)](https://arxiv.org/abs/2111.15664)
- [Wang et al. — DocLLM (arXiv:2401.00908)](https://arxiv.org/abs/2401.00908)
