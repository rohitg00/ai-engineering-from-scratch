# 水印技术 — SynthID、Stable Signature、C2PA

> 三项技术构成了 2026 年 AI 生成内容溯源的框架。SynthID(Google DeepMind)— 图像水印于 2023 年 8 月上线，文本+视频于 2024 年 5 月上线(Gemini + Veo),文本水印于 2024 年 10 月通过 Responsible GenAI Toolkit 开源，统一的多媒体检测器于 2025 年 11 月随 Gemini 3 Pro 一起发布。文本水印以不可察觉的方式调整下一个 token 的采样概率；图像/视频水印能够在压缩、裁剪、滤镜、帧率变化后存活。Stable Signature(Fernandez et al., ICCV 2023, arXiv:2303.15435)— 微调 latent diffusion 解码器，使每个输出都包含一条固定消息；裁剪(保留 10% 内容)后的生成图像在 FPR<1e-6 下检出率超过 90%。后续研究 "Stable Signature is Unstable"(arXiv:2405.07145,2024 年 5 月)— 微调可在保持质量的同时移除水印。C2PA — 密码学签名、具备防篡改能力的元数据标准(C2PA 2.2 Explainer 2025)。水印与 C2PA 互为补充：元数据可被剥离但承载更丰富的溯源信息；水印能在转码后留存但承载的信息量较少。

**Type:** Build
**Languages:** Python(标准库，token 水印嵌入 + 检测)
**Prerequisites:** Phase 10 · 04(采样)、Phase 01 · 09(信息论)
**Time:** 约 75 分钟

## 学习目标

- 描述 token 级水印(SynthID-text 风格)及其可被检测的机制。
- 描述 Stable Signature 以及 2024 年攻破它的移除攻击。
- 说明 C2PA 的角色及其与水印互补的原因。
- 描述关键局限：信号与特定模型绑定、改写下采样时的鲁棒性问题，以及保义攻击(arXiv:2508.20228)。

## 问题

2023-2024 年，深度伪造与 AI 生成内容大规模进入政治和消费场景。水印是被提出的技官方溯源信号：在生成时打标记，事后进行检测。2025 年的证据表明：没有水印是无条件鲁棒的，但与 C2PA 元数据分层结合后，这种组合能提供可用的溯源方案。

## 概念

### 文本水印(SynthID-text 风格)

Kirchenbauer et al. 2023 的机制，由 Google 产品化：

1. 在每个解码步骤，对前 K 个 token 做哈希，将词表伪随机地划分为“绿名单”和“红名单”。
2. 通过给绿色 token 的 logits 加 δ,使采样偏向绿名单。
3. 生成的文本中绿色 token 的数量会超过随机水平。

检测：对每个前缀重新哈希，统计生成文本中的绿色 token 数量，计算 z 分数。带水印文本的 z 分数 >0,人类文本约为 0。

特性：
- 读者不可察觉(δ 足够小，质量损失轻微)。
- 拥有词表划分函数即可检测。
- 对改写不鲁棒——重写文本会破坏信号。

SynthID-text 于 2024 年 10 月通过 Google 的 Responsible GenAI Toolkit 开源。

### Stable Signature(图像)

Fernandez et al., ICCV 2023。微调 latent diffusion 解码器，使每张生成图像都在 latent 表示中嵌入一条固定的二进制消息。检测通过神经解码器从 latent 中解码。裁剪(保留 10% 内容)后的图像在 FPR<1e-6 下检出率超过 90%。

2024 年 5 月的 "Stable Signature is Unstable"(arXiv:2405.07145):微调解码器可在保持图像质量的同时移除水印。生成后对抗性微调成本很低；水印的对抗鲁棒性有限。

### SynthID 统一检测器(2025 年 11 月)

随 Gemini 3 Pro 一起发布：一个多媒体检测器，通过一个 API 读取文本、图像、音频和视频中的 SynthID 信号。统一了 Google 的溯源技术栈。

### C2PA

Coalition for Content Provenance and Authenticity(内容来源与真实性联盟)。密码学签名的防篡改元数据标准。C2PA 2.2 Explainer(2025)。C2PA 清单记录由创建者密钥签名的溯源声明(谁创建、何时创建、做了哪些变换)。

与水印互补：
- 元数据可被剥离；水印则(相对)不易去除。
- 元数据信息丰富(完整溯源链)；水印只承载少量比特。
- C2PA 依赖平台采用；水印自动嵌入。

Google 在 Search、Ads 以及 "About this image" 中同时集成了两者。

### 局限性

- **与模型绑定。** SynthID 只为启用了 SynthID 的模型的生成结果打水印。未启用 SynthID 的模型生成的内容没有水印，因此“无 SynthID 信号”不能证明内容真实。
- **改写。** 文本水印无法在保义改写下存活。
- **变换攻击。** arXiv:2508.20228(2025)展示了既能破坏文本水印也能破坏许多图像水印的保义攻击。
- **微调移除。** 如 "Stable Signature is Unstable" 所示，生成后微调可移除嵌入的水印。

### EU AI Act 第 50 条

AI 生成内容标注的透明度准则(2025 年 12 月第一稿，2026 年 3 月第二稿，据[欧盟委员会状态页面](https://digital-strategy.ec.europa.eu/en/policies/code-practice-ai-generated-content)预计 2026 年 6 月定稿)。截至 2026 年 4 月，该准则仍处于草案阶段，时间表可能变动。这是要求技术层的监管层。深度伪造必须被标注。

### 在 Phase 18 中的位置

第 22-23 课讲模型输出的内容(隐私数据、溯源信号)。第 27 课讲训练数据治理。第 24 课是要求这些技术措施的监管框架。

```figure
an-watermark-greenlist
```

## 动手实践

`code/main.py` 构建一个玩具文本水印。token 为整数 0..N-1;带水印的采样偏向由哈希定义的绿名单。检测器计算绿色 token 的 z 分数。你可以观察 1000 token 生成文本的检测结果，观察改写如何破坏信号，并测量在人类文本上的假阳性率。

## 交付

本课产出 `outputs/skill-provenance-audit.md`。给定一个带有溯源声明的内容部署，它审计：水印机制(如有)、C2PA 签名链(如有)、两者的对抗鲁棒性，以及各模态的覆盖范围。

## 练习

1. 运行 `code/main.py`。报告带水印的 1000 token 生成文本与人类撰写文本的 z 分数。确定 95% 置信阈值下的假阳性率。

2. 实现一个将 30% token 替换为同义词的改写攻击。重新测量 z 分数。

3. 阅读 Kirchenbauer et al. 2023 第 6 节关于鲁棒性的内容。为什么文本水印在改写下失效，而图像水印能在裁剪下存活？

4. 设计一个同时使用 SynthID-text + C2PA 元数据的部署。描述消费者看到的溯源链。指出每个组件的一种失效模式。

5. 2024 年的 "Stable Signature is Unstable" 结果表明微调可移除图像水印。设计一个限制此攻击的部署控制措施——例如，要求微调后 checkpoint 的签名发布。

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|-----------------|------------------------|
| SynthID | "Google 的水印" | 跨模态溯源信号；文本、图像、音频、视频 |
| Token 水印 | "Kirchenbauer 风格" | 通过绿色 token z 分数检测的偏向采样文本水印 |
| Stable Signature | "图像水印" | 微调解码器水印；ICCV 2023 |
| C2PA | "元数据标准" | 密码学签名的防篡改溯源元数据 |
| 改写鲁棒性 | "换个说法会不会失效" | 文本水印特性；目前有限 |
| 微调移除 | "对抗性去水印" | 通过解码器微调移除图像水印的攻击 |
| 跨模态检测器 | "统一 SynthID" | 2025 年 11 月发布的跨模态统一 API |

## 延伸阅读

- [Kirchenbauer et al. — A Watermark for Large Language Models (ICML 2023, arXiv:2301.10226)](https://arxiv.org/abs/2301.10226) — token 水印机制
- [Fernandez et al. — Stable Signature (ICCV 2023, arXiv:2303.15435)](https://arxiv.org/abs/2303.15435) — 图像水印论文
- ["Stable Signature is Unstable" (arXiv:2405.07145)](https://arxiv.org/abs/2405.07145) — 移除攻击
- [Google DeepMind — SynthID](https://deepmind.google/models/synthid/) — 跨模态水印
- [C2PA 2.2 Explainer (2025)](https://c2pa.org/specifications/specifications/2.2/explainer/Explainer.html) — 元数据标准