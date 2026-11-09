# 文件和图表的理解

> 文件不是照片. 文件,科学论文,账单或手写表格有布局,表格,图表,脚注,标题和语义结构, 之前VLM堆是一个管道:Tesseract OCR + LayoutLMv3 +表提取统计. 维LM波取代了无 OCR 型号的甜圈 (2022年),努加 (2023年),docllm (2023年) ,直接发射结构化标记. 到2026年,边界只是"将页面图像输送到Claude Opus 4.7的 2576px原始", 这一课讲述了文件人工智能的三代弧.

**Type:** Build
**Languages:** Python (stdlib, layout-aware document parser skeleton), TypeScript
**Prerequisites:** Phase 12 · 05 (LLaVA), Phase 5 (NLP)
**Time:** ~180 minutes

## 学习目标

- 解释文件人工智能的三个时代:OCR管道,OCR免费,VLM原生.
- 描述LayoutLMv3的三个输入流:文字,布局 (bbox),图像补丁,并有统一的掩盖.
- 比较甜甜圈 (OCR 免费,图像 →标记),Nougat (科学论文 → LaTeX), DocLLM (布局意识生成器),PaliGemma 2 (VLM-原生).
- 选择一个新任务的文件模型 (发票,科学论文,手写表格,中国收据).

## 问题

简单的信息是:

- 文字内容 (信号的90%).
- 布局 (标题,脚注,侧边框,两列格式).
- 表 (行列,列,结合的细胞).
- 图表和图表.
- 写手写的注释.
- 字体和类型 (标题与体格).

对于一个关心账单的系统,需要知道"总额:1,245美元"来自右下,而不是从脚注中.

## 概念

### 年代1 OCR管道 (前2021年)

经典的堆:

1. 按页面的PDF →图像.
2. 测试 (或商业OCR) 提取文字,以每字的边框.
3. 布局分析器识别区块 (标题,表,段落).
4. 表结构识别器解析表.
5. 域规则 + regex提取字段.

对于清洁的印刷文本来说,它可以使用. 打字,偏差扫描,复杂表,非英语脚本. 每个失败模式都需要一个自定义的例外路径.

### 经营管理局 (2021)

托克 (Li et al., arXiv:2109.10282) 取代了Tesseract的经典CNN-CTC,用一个基于合成+真实文本图像训练的变体编码器-解码器.手写和多语言文本的清洁胜利.仍然是一个管道 (检测器然后TROCR然后布局),但OCR步骤显著改善.

### 时代2 无OCR (2022-2023)

首先,没有OCR的模型说: 完全跳过检测,将图像像像像素直接映射到结构输出.

甜甜圈 (金等人, arXiv:2111.15664):
- 编码器-解码器变压器,编码器是Swin-B.
- 输出是JSON用于形式理解,用于总结或任何特定任务的方案.
- 没有OCR,没有布局,没有检测.

诺加特 (Blecher等, arXiv:2308.13418):
- 专门为科学论文进行培训.
- 输出是拉特克斯/ 标记.
- 处理方程,多列布局,数字.
- 模型每一个 arXiv-解析器打电话.

对于科学论文,甜甜甜点失败,

### 布局LMv3 (2022)

布局LMv3 (Huang等, arXiv:2204.08387) 保持了OCR,但增加了布局理解:

- 输入流有三个:OCR文本代码,每代码的2D界限框,图像补丁.
- 面具训练目标在三个模式上 (面具文本,面具补丁,面具布局).
- 下游:分类,实体提取,QA表

布局LMv3是基于OCR的文件理解的顶峰. 形式和发票强大. 需要OCR上游. 在标准化的文件基准上,最好的VLM前精度.

### 文件 (2023)

文件LLM (Wang et al., arXiv:2401.00908,提交于2023年12月31日,因此ID带有2024年1月的前) 是LayoutLM的生成兄弟.生成基于布局代币的自由形式答案.更好用于文件的QA;仍然取决于OCR输入.

### 年代3 VLM本土人 (2024+)

2024年,VLM 已经足够好,可以完全取代管道.

- 对于小型文件,LLaVA-NeXT 336-tile AnyRes 适用于.
- 文2.5VL动态分辨率处理2048+像素本地.
- 支持2576px的文件.
- 帕利盖玛2 (2024年12月) 专门用于文件+手写.

根据VLM原生和OCR管道之间的差距,到2026年,VLM原生将获得:

- 场景文本 (手写 + 打印,混合脚本).
- 复杂的表格,有结合的细胞.
- 包含在文本中的数学方程.
- 图片含有文字注释.

欧CR管道仍然在:

- 扫描工作量大规模, 每页延迟是重要的.
- 管道可靠性 (确定性失败与VLM幻觉).
- 需要可审核的OCR输出的监管环境.

### 克劳德4.7 / GPT-5 边界

在2576像素的本地输入,边界VLM在接近人类的准确度下记录了理解. 2026年初的基准数字:

- 文件:Claude 4.7 ~95.1,PaliGemma 2 ~88.4,Nougat ~77.3,管道布局LMv3 ~83.
- 图QA:克劳德4.7~92.2,GPT-4V~78.
- 视觉MRC:克劳德4.7~94.

封闭模型的差距主要是分辨率和基层LLM尺度. 7B的开放模型落后了几点,但赶上了.

### 数学方程和Latex输出

科学论文需要精确的拉德克斯输出来实现方程.诺格特接受了训练.使用拉德克斯目标 (Qwen2.5-VL-Math,诺格特衍生品) 训练的VLM产生可用的拉德克斯.没有明确的拉德克斯训练,VLM产生可读但不准确的转录.

对于2026年科学纸管道:在PDF上链接Nougat,然后在复杂的页面上进行VLM.

### 字体

混合印刷+手写 (医生笔记,填写表格) 是OCR管道仍然比VLM更高的成本. 仅使用手写的VLM正在改善 (条款4.7,PaliGemma 2).

### 2026 年的食谱

对于新的文档AI项目:

- 纯印刷的货物账单:布局LMv3+规则,成本效益.
- 混合文件 (科学+手写+表格):VLM原生 (PaliGemma 2或Qwen2.5-VL).
- 现在,我们需要一个新的数据库.
- 监管:OCR管道+VLM验证器用于交叉检查.

```figure
mm-doc-layout
```

## 用它

`code/main.py`其他:

- 玩具布局意识的代币:给定的 (文字,bbox) 双,产生LayoutLMv3式输入.
- 按Donut类型的任务方案生成器:表格的JSON模板.
- 对于OCR管道,Donut,Nougat和VLM本土的每个页面的代币预算进行比较.

## 运送它

这一课产生了`outputs/skill-document-ai-stack-picker.md`鉴于文件AI项目 (领域,规模,质量,监管),选择OCR管道,OCR免费专家和VLM原生.

## 运动

1. 你的项目每天10万的账单.哪个堆可以尽量减少每页成本,而不会失去准确性?

2. 为什么LayoutLMv3在QA形式上比纯CLIP-VLM更好,但在场景文本上表现不佳?

3. 诺加生成了拉特克斯. 提出一个测试案例,其中VLM原生输出在拉特克斯忠诚度上击败诺加,以及一个诺加获胜的案例.

4. 根据"巴利格玛2"论文 (谷歌,2024). 如何提高文件准确性与"巴利格玛1"的重点训练数据?

5. 设计一个安全的混合物:OCR管道作为主要,VLM作为二级交叉检查.

## 关键词

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| OCR pipeline | "Tesseract-style" | Stage-wise stack: detect -> OCR -> layout -> rules; deterministic, fragile |
| OCR-free | "Donut-style" | Image-to-output transformer that skips explicit OCR; single model |
| Layout-aware | "LayoutLM" | Input includes per-token bbox coordinates; unified masking across modalities |
| VLM-native | "Frontier VLM" | Feed page image directly to Claude/GPT/Qwen VLM at high resolution; no pipeline |
| DocVQA | "Doc benchmark" | Document VQA standard; most-cited score |
| Markup output | "LaTeX / MD" | Structured output format instead of free-form text; enables downstream automation |

## 进一步阅读

- [Li et al. — TrOCR (arXiv:2109.10282)](https://arxiv.org/abs/2109.10282)
- [Blecher et al. — Nougat (arXiv:2308.13418)](https://arxiv.org/abs/2308.13418)
- [Huang et al. — LayoutLMv3 (arXiv:2204.08387)](https://arxiv.org/abs/2204.08387)
- [Kim et al. — Donut (arXiv:2111.15664)](https://arxiv.org/abs/2111.15664)
- [Wang et al. — DocLLM (arXiv:2401.00908)](https://arxiv.org/abs/2401.00908)
