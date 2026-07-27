# 水印技术 — SynthID、Stable Signature、C2PA

> 三项技术构成了 2026 年 AI 生成内容溯源（Provenance）的支柱。**SynthID**（Google DeepMind）——图像水印于 2023 年 8 月推出，文本+视频于 2024 年 5 月（Gemini + Veo）推出，文本水印于 2024 年 10 月通过 Responsible GenAI Toolkit 开源，统一多模态检测器于 2025 年 11 月随 Gemini 3 Pro 一起发布。文本水印以不可察觉的方式调整下一 token 采样概率；图像/视频水印可抵抗压缩、裁剪、滤镜和帧率变化。**Stable Signature**（Fernandez 等，ICCV 2023，arXiv:2303.15435）——对潜在扩散解码器进行微调，使每个输出都包含一个固定消息；裁剪后（内容保留 10%）的生成图像在 FPR<1e-6 条件下检测率 >90%。后续论文 "Stable Signature is Unstable"（arXiv:2405.07145，2024 年 5 月）——微调可在保持质量的同时移除水印。**C2PA**——加密签名、防篡改的元数据标准（C2PA 2.2 解释器 2025）。水印与 C2PA 互补：元数据可被剥离但携带更丰富的溯源信息；水印在转码过程中持续存在但携带信息较少。

**类型：** 构建
**语言：** Python（标准库，token 水印嵌入 + 检测）
**前置条件：** 阶段 10 · 04（采样），阶段 01 · 09（信息论）
**时间：** 约 75 分钟

## 学习目标

- 描述 token 级水印（SynthID-text 风格）及其可检测机制。
- 描述 Stable Signature 以及 2024 年将其攻破的移除攻击。
- 说明 C2PA 的作用及其与水印互补的原因。
- 描述关键局限性：模型特异性、释义鲁棒性以及保义攻击（arXiv:2508.20228）。

## 问题

2023-2024 年，深度伪造和 AI 生成内容大规模进入政治和消费场景。水印是提议的技术溯源信号：在生成时标记内容，在后续检测。2025 年的证据表明：没有水印是无条件鲁棒的，但与 C2PA 元数据分层结合后，这种组合能提供一个可用的溯源方案。

## 概念

### 文本水印（SynthID-text 风格）

Kirchenbauer 等人 2023 年提出的机制，由 Google 产品化实现：

1. 在每个解码步骤中，对前 K 个 token 进行哈希运算，生成一个伪随机词汇表分区，分为"绿色"和"红色"两组。
2. 通过向绿色 logits 添加 δ 来偏向采样绿色集合。
3. 生成的文本包含比随机情况下更多的绿色 token。

检测：重新哈希每个前缀，统计生成文本中的绿色 token 数量，计算 z-score。水印文本的 z-score > 0，人类文本的 z-score ≈ 0。

特性：
- 对读者不可察觉（δ 足够小，质量损失轻微）。
- 在可访问词汇表分区函数时可检测。
- 对释义不鲁棒——重写文本会破坏信号。

SynthID-text 于 2024 年 10 月通过 Google 的 Responsible GenAI Toolkit 开源。

### Stable Signature（图像）

Fernandez 等人，ICCV 2023。对潜在扩散解码器进行微调，使每张生成的图像在潜在表示中都包含一个固定的二进制消息。通过神经解码器从潜在空间解码检测。裁剪后（保留 10% 内容）的图像在 FPR<1e-6 条件下检测率 >90%。

2024 年 5 月论文 "Stable Signature is Unstable"（arXiv:2405.07145）：对解码器进行微调可在保持图像质量的同时移除水印。对抗性生成后微调成本低廉；水印的对抗鲁棒性有限。

### SynthID 统一检测器（2025 年 11 月）

随 Gemini 3 Pro 一同发布：一个多模态检测器，可通过单一 API 读取来自文本、图像、音频和视频的 SynthID 信号。统一了 Google 的溯源技术栈。

### C2PA

内容溯源与真实性联盟（Coalition for Content Provenance and Authenticity）。加密签名、防篡改的元数据标准。C2PA 2.2 解释器（2025）。C2PA 清单记录了由创作者密钥签名的溯源声明（谁创建的、何时创建、经过哪些转换）。

与水印互补：
- 元数据可被剥离；水印则（不易）被移除。
- 元数据信息丰富（完整溯源链）；水印仅携带少量比特。
- C2PA 依赖于平台采用；水印自动嵌入。

Google 在搜索、广告和"关于此图片"中集成了两者。

### 局限性

- **模型特异性。** SynthID 仅为启用了 SynthID 的模型生成的内容加水印。未使用 SynthID 模型生成的内容不带水印，因此"无 SynthID 信号"并非真实性的证明。
- **释义攻击。** 文本水印无法在保义释义中幸存。
- **变换攻击。** arXiv:2508.20228（2025）展示了可同时破坏文本水印和许多图像水印的保义攻击。
- **微调移除。** 根据 "Stable Signature is Unstable"，生成后微调可移除嵌入的水印。

### 欧盟 AI 法案第 50 条

AI 生成内容标签透明度准则（2025 年 12 月第一稿，2026 年 3 月第二稿，预计最终稿于 2026 年 6 月发布，详见[欧盟委员会状态页面](https://digital-strategy.ec.europa.eu/en/policies/code-practice-ai-generated-content)）。截至 2026 年 4 月，该准则仍处于草案阶段，时间表可能变更。这是要求技术层的监管层。深度伪造必须被标注。

### 在阶段 18 中的位置

第 22-23 课讨论模型输出了什么（隐私数据、溯源信号）。第 27 课涵盖训练数据治理。第 24 课是要求这些技术措施的监管框架。

## 使用

`code/main.py` 构建了一个玩具文本水印。Token 是 0..N-1 的整数；加水印的采样偏向于哈希定义的绿色集合。检测器计算绿色 token 的 z-score。你可以观察 1000 token 生成文本的检测效果，查看释义如何破坏信号，并测量人类文本上的假阳性率。

## 交付

本节课产出 `outputs/skill-provenance-audit.md`。给定一个具有溯源声明的内容部署，它将审计：水印机制（如有）、C2PA 签名链（如有）、各机制的对抗鲁棒性以及各模态的覆盖范围。

## 练习

1. 运行 `code/main.py`。报告加水印的 1000 token 生成文本与人类撰写文本的 z-score。确定 95% 置信阈值下的假阳性率。

2. 实现一个释义攻击，将 30% 的 token 替换为同义词。重新测量 z-score。

3. 阅读 Kirchenbauer 等人 2023 年第 6 节关于鲁棒性的内容。为什么文本水印在释义下失效，而图像水印能在裁剪下幸存？

4. 设计一个使用 SynthID-text + C2PA 元数据的部署。描述消费者看到的溯源链。指出每个组件的一种失效模式。

5. 2024 年 "Stable Signature is Unstable" 的结果表明微调可以移除图像水印。设计一种限制此攻击的部署控制措施——例如，要求对微调后的检查点进行签名发布。

## 关键术语

| 术语 | 大家怎么说 | 实际含义 |
|------|-----------|---------|
| SynthID | "Google 的水印" | 跨模态溯源信号；文本、图像、音频、视频 |
| Token 水印 | "Kirchenbauer 风格" | 通过绿色 token z-score 可检测的偏置采样文本水印 |
| Stable Signature | "图像水印" | 微调解码器的水印；ICCV 2023 |
| C2PA | "元数据标准" | 加密签名、防篡改的溯源元数据 |
| 释义鲁棒性 | "改写会破坏它吗" | 文本水印特性；目前有限 |
| 微调移除 | "对抗性去水印" | 通过解码器微调移除图像水印的攻击 |
| 跨模态检测器 | "统一 SynthID" | 2025 年 11 月跨模态统一 API |

## 延伸阅读

- [Kirchenbauer 等 — A Watermark for Large Language Models (ICML 2023, arXiv:2301.10226)](https://arxiv.org/abs/2301.10226) — token 水印机制
- [Fernandez 等 — Stable Signature (ICCV 2023, arXiv:2303.15435)](https://arxiv.org/abs/2303.15435) — 图像水印论文
- ["Stable Signature is Unstable" (arXiv:2405.07145)](https://arxiv.org/abs/2405.07145) — 移除攻击
- [Google DeepMind — SynthID](https://deepmind.google/models/synthid/) — 跨模态水印
- [C2PA 2.2 解释器 (2025)](https://c2pa.org/specifications/specifications/2.2/explainer/Explainer.html) — 元数据标准
