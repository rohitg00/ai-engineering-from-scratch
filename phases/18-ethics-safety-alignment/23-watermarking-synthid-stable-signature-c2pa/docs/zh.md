# 水印 —— SynthID、Stable Signature、C2PA

> 三种技术构成了 2026 年 AI 生成内容来源。SynthID（Google DeepMind）—— 图像水印 2023 年 8 月发布，文本+视频 2024 年 5 月（Gemini + Veo），文本 2024 年 10 月通过 Responsible GenAI Toolkit 开源，2025 年 11 月与 Gemini 3 Pro 一起发布统一多媒体检测器。文本水印不可察觉地调整下一 token 采样概率；图像/视频水印在压缩、裁剪、滤镜、帧率变化后仍然存活。Stable Signature（Fernandez 等人，ICCV 2023，arXiv:2303.15435）—— 微调潜在扩散解码器，使每个输出包含固定消息；裁剪（内容 10%）生成图像在 FPR<1e-6 时检测 >90%。后续 "Stable Signature is Unstable"（arXiv:2405.07145，2024 年 5 月）—— 微调移除水印同时保留质量。C2PA —— 加密签名、防篡改元数据标准（C2PA 2.2 Explainer 2025）。水印和 C2PA 是互补的：元数据可以被剥离但携带更丰富的来源；水印在转码后持续存在但携带较少信息。

**类型：** 构建
**语言：** Python（标准库，token 水印嵌入 + 检测）
**先决条件：** Phase 10 · 04（采样），Phase 01 · 09（信息论）
**时间：** ~75 分钟

## 学习目标

- 描述 token 级别水印（SynthID-text 风格）及其可检测机制。
- 描述 Stable Signature 和 2024 年打破它的移除攻击。
- 说明 C2PA 的角色以及为什么它与水印互补。
- 描述关键局限性：模型特定信号、改写下的稳健性、意义保留攻击（arXiv:2508.20228）。

## 问题

2023-2024 年，深度伪造和 AI 生成内容大规模进入政治和消费环境。水印是提出的技术来源信号：在创建时标记生成，稍后检测它们。2025 年证据：没有水印是无条件稳健的，但与 C2PA 元数据分层结合，组合提供了可用的来源故事。

## 概念

### 文本水印（SynthID-text 风格）

Kirchenbauer 等人 2023 机制，由 Google 产品化：

1. 在每个解码步骤，哈希前 K 个 token 以产生词汇表的伪随机分区为"绿色"和"红色"集。
2. 通过向绿色 logit 添加 δ 来偏向绿色集的采样。
3. 生成包含比偶然产生的更多绿色 token。

检测：重新哈希每个前缀，计算生成中的绿色 token 数量，计算 z 分数。z 分数对水印文本 >0，对人类文本 ~0。

属性：
- 对读者不可察觉（δ 足够小，质量损失很小）。
- 使用词汇分区函数可检测。
- 对改写不稳健——重写文本会破坏信号。

SynthID-text 于 2024 年 10 月通过 Google 的 Responsible GenAI Toolkit 开源。

### Stable Signature（图像）

Fernandez 等人 ICCV 2023。微调潜在扩散解码器，使每个生成图像在潜在表示中嵌入固定二进制消息。检测从潜在表示中用神经解码器解码。裁剪（内容 10%）图像在 FPR<1e-6 时检测 >90%。

2024 年 5 月 "Stable Signature is Unstable"（arXiv:2405.07145）：微调解码器移除水印同时保留图像质量。对抗性生成后微调很便宜；水印的对抗性稳健性有限。

### SynthID 统一检测器（2025 年 11 月）

与 Gemini 3 Pro 一起：一个多媒体检测器，在一个 API 中读取文本、图像、音频和视频的 SynthID 信号。统一 Google 来源栈。

### C2PA

内容来源和真实性联盟。加密签名防篡改元数据标准。C2PA 2.2 Explainer（2025）。C2PA 清单记录来源声明（谁创建、何时、什么转换）由创建者的密钥签名。

与水印互补：
- 元数据可以被剥离；水印不能（容易）。
- 元数据丰富（完整来源链）；水印携带位。
- C2PA 依赖平台采用；水印自动嵌入。

Google 在搜索、广告和"关于此图像"中集成两者。

### 局限性

- **模型特定。** SynthID 水印来自启用 SynthID 的模型的生成。来自没有 SynthID 的模型的生成没有水印，因此"没有 SynthID 信号"不是真实性的证明。
- **改写。** 文本水印在意义保留改写后无法存活。
- **转换攻击。** arXiv:2508.20228（2025）显示破坏文本水印和许多图像水印的意义保留攻击。
- **微调移除。** 根据 "Stable Signature is Unstable"，生成后微调移除嵌入的水印。

### EU AI Act 第 50 条

AI 生成内容标签的透明度准则（第一稿 2025 年 12 月，第二稿 2026 年 3 月，预期最终 2026 年 6 月，根据 [European Commission status page](https://digital-strategy.ec.europa.eu/en/policies/code-practice-ai-generated-content)）。截至 2026 年 4 月，准则仍在草案中，时间表可能会改变。要求技术层的监管层。深度伪造必须标记。

### 这在 Phase 18 中的位置

第 22-23 课关于模型发出的内容（私有数据、来源信号）。第 27 课涵盖训练数据治理。第 24 课是要求这些技术措施的监管框架。

## 使用它

`code/main.py` 构建一个模拟文本水印。Token 是整数 0..N-1；水印采样偏向哈希定义的绿色集。检测器计算绿色 token z 分数。你可以观察 1000 token 生成中的检测，观察改写破坏信号，并测量人类文本上的误报率。

## 交付它

本课产生 `outputs/skill-provenance-audit.md`。给定带有来源声明的内容部署，它审计：水印机制（如果有）、C2PA 签名链（如果有）、每个的对抗性稳健性，以及每种模态的覆盖。

## 练习

1. 运行 `code/main.py`。报告水印 1000 token 生成与人类撰写文本的 z 分数。识别 95% 置信阈值下的误报率。

2. 实现一个用同义词替换 30% token 的改写攻击。重新测量 z 分数。

3. 阅读 Kirchenbauer 等人 2023 第 6 节关于稳健性。为什么文本水印在改写下失败而图像水印在裁剪下存活？

4. 设计一个使用 SynthID-text + C2PA 元数据的部署。描述消费者看到的来源链。识别每个组件的一个失败模式。

5. 2024 年 "Stable Signature is Unstable" 结果显示微调移除图像水印。设计一个限制此攻击的部署控制——例如，要求微调检查点的签名发布。

## 关键术语

| 术语 | 人们说的 | 实际含义 |
|------|----------|----------|
| SynthID | "Google 的水印" | 跨模态来源信号；文本、图像、音频、视频 |
| Token 水印 | "Kirchenbauer 风格" | 通过绿色 token z 分数可检测的偏向采样文本水印 |
| Stable Signature | "图像水印" | 微调解码器水印；ICCV 2023 |
| C2PA | "元数据标准" | 加密签名防篡改来源元数据 |
| 改写稳健性 | "改写是否破坏它" | 文本水印属性；目前有限 |
| 微调移除 | "对抗性去水印" | 通过解码器微调移除图像水印的攻击 |
| 跨模态检测器 | "统一 SynthID" | 2025 年 11 月跨模态的统一 API |

## 延伸阅读

- [Kirchenbauer 等人 — A Watermark for Large Language Models (ICML 2023, arXiv:2301.10226)](https://arxiv.org/abs/2301.10226) — token 水印机制
- [Fernandez 等人 — Stable Signature (ICCV 2023, arXiv:2303.15435)](https://arxiv.org/abs/2303.15435) — 图像水印论文
- ["Stable Signature is Unstable" (arXiv:2405.07145)](https://arxiv.org/abs/2405.07145) — 移除攻击
- [Google DeepMind — SynthID](https://deepmind.google/models/synthid/) — 跨模态水印
- [C2PA 2.2 Explainer (2025)](https://c2pa.org/specifications/specifications/2.2/explainer/Explainer.html) — 元数据标准
