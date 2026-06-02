# 水印技术 —— SynthID、Stable Signature、C2PA

> 译注：本文译自同目录 [`en.md`](./en.md)。术语遵循仓根 [TRANSLATION_GUIDE.md](../../../../TRANSLATION_GUIDE.md)。

> 三项技术构成了 2026 年 AI 生成内容溯源（provenance）的骨架。SynthID（Google DeepMind）—— 图像水印于 2023 年 8 月上线，文本与视频在 2024 年 5 月推出（Gemini + Veo），文本水印在 2024 年 10 月通过 Responsible GenAI Toolkit 开源，统一的多模态检测器在 2025 年 11 月与 Gemini 3 Pro 一同发布。文本水印通过对 next-token 采样概率做不易察觉的微调实现；图像/视频水印能够在压缩、裁剪、滤镜、帧率变化下幸存。Stable Signature（Fernandez 等，ICCV 2023，arXiv:2303.15435）—— 微调（fine-tune）latent diffusion 的 decoder，使每张输出图都嵌入一段固定信息；裁剪到只剩 10% 内容的生成图，在 FPR<1e-6 时仍能以 >90% 概率被检出。后续工作 "Stable Signature is Unstable"（arXiv:2405.07145，2024 年 5 月）—— 微调可在保留质量的前提下抹掉水印。C2PA —— 一种带密码学签名、防篡改的元数据标准（C2PA 2.2 Explainer 2025）。水印与 C2PA 是互补关系：元数据可被剥离但承载更丰富的溯源信息；水印能在转码后存活但能携带的信息更少。

**Type:** Build
**Languages:** Python (stdlib, token-watermark embed + detect)
**Prerequisites:** Phase 10 · 04 (sampling), Phase 01 · 09 (information theory)
**Time:** ~75 minutes

## 学习目标（Learning Objectives）

- 描述 token 级水印（SynthID-text 风格）以及它为什么可被检测。
- 描述 Stable Signature，以及 2024 年破解它的移除攻击。
- 说明 C2PA 的角色，以及它为什么与水印互补。
- 描述关键的局限：模型相关的信号、改写（paraphrase）下的鲁棒性、以及保意义的攻击（arXiv:2508.20228）。

## 问题（Problem）

2023-2024 年间，深度伪造（deepfake）和 AI 生成内容大规模进入政治和消费者场景。水印是被业界提出的技术性溯源信号：在生成时打标，事后再检出。2025 年的证据显示：没有任何水印是无条件鲁棒的，但与 C2PA 元数据叠加后，组合方案能给出一个可用的溯源叙事。

## 概念（Concept）

### 文本水印（SynthID-text 风格）

Kirchenbauer 等 2023 年的机制，被 Google 工程化落地：

1. 在每一步解码时，对前 K 个 token 做哈希，把词表伪随机划分为「绿色」和「红色」两组。
2. 通过给绿色 token 的 logits 加上 δ，让采样偏向绿色集合。
3. 由此生成的文本里，绿色 token 的占比会高于纯随机情况下的期望值。

检测：对每个前缀重新做哈希，统计生成文本里的绿色 token 数，计算 z-score。带水印的文本 z-score >0，人类写的文本 z-score ≈0。

性质：

- 对读者不可感知（δ 足够小，质量损失轻微）。
- 拥有词表划分函数即可检测。
- 对改写不鲁棒 —— 重写文本会摧毁信号。

SynthID-text 于 2024 年 10 月通过 Google 的 Responsible GenAI Toolkit 开源。

### Stable Signature（图像）

Fernandez 等，ICCV 2023。微调 latent diffusion 的 decoder，让每张生成图都在 latent 表示中嵌入一段固定的二进制信息。检测时用神经网络 decoder 从 latent 中解码出消息。裁剪到只剩 10% 内容的图像，在 FPR<1e-6 时仍能以 >90% 概率被检出。

2024 年 5 月的 "Stable Signature is Unstable"（arXiv:2405.07145）：在保留图像质量的前提下，微调 decoder 即可抹掉水印。生成后做对抗性微调成本不高；该水印的对抗鲁棒性是有限的。

### SynthID 统一检测器（2025 年 11 月）

与 Gemini 3 Pro 同期发布：一个多模态检测器，用同一个 API 读取文本、图像、音频、视频里的 SynthID 信号。这把 Google 的溯源栈统一了起来。

### C2PA

Coalition for Content Provenance and Authenticity（内容溯源与真实性联盟）。一种带密码学签名、防篡改的元数据标准。C2PA 2.2 Explainer（2025）。一份 C2PA manifest 记录了溯源声明（谁创建、何时创建、做过哪些变换），由创建者的密钥签名。

与水印互补：

- 元数据可被剥离；水印（不容易）剥离。
- 元数据信息丰富（完整的溯源链）；水印只能承载若干 bit。
- C2PA 依赖平台采用；水印则自动嵌入。

Google 在 Search、Ads 和「About this image」中同时集成了二者。

### 局限

- **模型相关。** SynthID 只对启用了 SynthID 的模型的输出打水印。来自未启用 SynthID 的模型的生成内容不会带水印，因此「检测不到 SynthID 信号」并不能证明这是真实内容。
- **改写。** 文本水印无法在保意义的改写下幸存。
- **变换攻击。** arXiv:2508.20228（2025）展示了能同时摧毁文本水印与许多图像水印的保意义攻击。
- **微调移除。** 按 "Stable Signature is Unstable" 的结论，生成后的微调可移除嵌入的水印。

### 欧盟 AI Act 第 50 条

针对 AI 生成内容标注的 Transparency Code（首版草案 2025 年 12 月，第二版草案 2026 年 3 月，预计 2026 年 6 月定稿，详见[欧盟委员会的状态页](https://digital-strategy.ec.europa.eu/en/policies/code-practice-ai-generated-content)）。截至 2026 年 4 月，该 Code 仍在草案阶段，时间表可能调整。这是要求底层技术层落地的监管层。深度伪造内容必须被标注。

### 这节课在 Phase 18 的位置

第 22-23 课讲的是模型「输出了什么」（隐私数据、溯源信号）。第 27 课覆盖训练数据治理。第 24 课是要求上述技术措施的监管框架。

## 用起来（Use It）

`code/main.py` 构建了一个玩具版的文本水印。token 是 0..N-1 的整数；带水印的采样偏向哈希定义的绿色集合。检测器会计算绿色 token 的 z-score。你可以观察 1000 个 token 长的生成在检测下的表现，看着改写攻击如何摧毁信号，并测量人类文本上的假阳性率。

## 上线部署（Ship It）

本课产出 `outputs/skill-provenance-audit.md`。给定一个带溯源声明的内容部署，它会审计：水印机制（如果有）、C2PA 签名链（如果有）、各自的对抗鲁棒性、以及按模态的覆盖度。

## 练习（Exercises）

1. 跑 `code/main.py`。报告带水印的 1000 token 生成 vs 人类写作的 z-score。算出 95% 置信阈值下的假阳性率。

2. 实现一个改写攻击：把 30% 的 token 替换为同义词。重新测量 z-score。

3. 读 Kirchenbauer 等 2023 第 6 节关于鲁棒性的内容。为什么文本水印在改写下失效，而图像水印在裁剪下能幸存？

4. 设计一个使用 SynthID-text + C2PA 元数据的部署。描述消费者看到的溯源链。指出每个组件各一种失效模式。

5. 2024 年 "Stable Signature is Unstable" 的结论是：微调可移除图像水印。设计一种限制该攻击的部署控制 —— 例如，要求微调 checkpoint 的发布必须签名。

## 关键术语（Key Terms）

| 术语 | 大家通常怎么说 | 实际含义 |
|------|----------------|----------|
| SynthID | 「Google 的水印」 | 跨模态溯源信号；覆盖文本、图像、音频、视频 |
| Token 水印 | 「Kirchenbauer 风格」 | 偏置采样的文本水印，靠绿色 token 的 z-score 检出 |
| Stable Signature | 「图像水印」 | 微调 decoder 的水印；ICCV 2023 |
| C2PA | 「那个元数据标准」 | 带密码学签名、防篡改的溯源元数据 |
| 改写鲁棒性 | 「重写一遍会不会失效」 | 文本水印的一项性质；当前能力有限 |
| 微调移除 | 「对抗式去水印」 | 通过微调 decoder 移除图像水印的攻击 |
| 跨模态检测器 | 「统一的 SynthID」 | 2025 年 11 月推出的、跨模态共用的统一 API |

## 延伸阅读（Further Reading）

- [Kirchenbauer et al. — A Watermark for Large Language Models (ICML 2023, arXiv:2301.10226)](https://arxiv.org/abs/2301.10226) —— token 水印机制
- [Fernandez et al. — Stable Signature (ICCV 2023, arXiv:2303.15435)](https://arxiv.org/abs/2303.15435) —— 图像水印论文
- ["Stable Signature is Unstable" (arXiv:2405.07145)](https://arxiv.org/abs/2405.07145) —— 移除攻击
- [Google DeepMind — SynthID](https://deepmind.google/models/synthid/) —— 跨模态水印
- [C2PA 2.2 Explainer (2025)](https://c2pa.org/specifications/specifications/2.2/explainer/Explainer.html) —— 元数据标准
