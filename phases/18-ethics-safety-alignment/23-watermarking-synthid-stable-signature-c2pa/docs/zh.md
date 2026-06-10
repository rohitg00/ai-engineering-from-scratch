# 23 · 水印技术：SynthID、Stable Signature 与 C2PA

> 三项技术构成了 2026 年 AI 生成内容溯源（Provenance）的主线。SynthID（Google DeepMind）——图像水印于 2023 年 8 月发布，文本与视频水印于 2024 年 5 月发布（Gemini + Veo），文本水印于 2024 年 10 月通过 Responsible GenAI Toolkit 开源，统一多模态检测器于 2025 年 11 月随 Gemini 3 Pro 发布。文本水印通过难以察觉的方式调整下一个 token 的采样概率；图像/视频水印能够抵抗压缩、裁剪、滤镜和帧率变化。Stable Signature（Fernandez 等，ICCV 2023，arXiv:2303.15435）——微调潜在扩散解码器（latent diffusion decoder），使每个输出都包含一个固定消息；裁剪至原始内容 10% 的生成图像在 FPR<1e-6 下检测率仍超过 90%。后续论文《Stable Signature is Unstable》（arXiv:2405.07145，2024 年 5 月）——微调可移除水印，同时保持质量不变。C2PA——密码学签名且防篡改（tamper-evident）的元数据标准（C2PA 2.2 Explainer 2025）。水印技术与 C2PA 是互补的：元数据可被剥离但携带更丰富的溯源信息；水印在转码后依然存在但携带的信息量更少。

**类型：** 构建
**语言：** Python（标准库，token 水印嵌入与检测）
**前置：** 阶段 10·04（采样）、阶段 01·09（信息论）
**时长：** 约 75 分钟

## 学习目标

- 描述 token 级水印（SynthID 文本风格）及其可被检测的机制。
- 描述 Stable Signature 以及 2024 年攻破它的移除攻击（removal attack）。
- 说明 C2PA 的角色以及它为什么与水印技术互补。
- 描述关键局限性：模型特有的信号、改写下的鲁棒性不足，以及保持语义的攻击（arXiv:2508.20228）。

## 问题背景

2023-2024 年间，深度伪造（deepfake）和 AI 生成内容大规模进入政治与消费者场景。水印技术是业界提出的技术溯源信号：在生成时标记内容，事后进行检测。2025 年的证据表明：没有任何水印是无条件鲁棒的，但将其与 C2PA 元数据层叠组合，可以提供一套可用的溯源方案。

## 核心概念

### 文本水印（SynthID 文本风格）

Kirchenbauer 等人于 2023 年提出的机制，由 Google 工程化落地：

1. 在每个解码步骤，对前 K 个 token 做哈希，生成一个伪随机的词汇表划分，将其分为「绿色」和「红色」集合。
2. 通过给绿色集合的 logit 加上 δ 偏置，让采样偏向绿色集合。
3. 生成文本中绿色 token 的占比将高于随机概率预期的水平。

检测方式：对每个前缀重新做哈希，统计生成文本中绿色 token 的数量，计算 z 分数（z-score）。水印文本的 z 分数 > 0，人类文本的 z 分数约等于 0。

特性：
- 读者无法察觉（δ 足够小，质量损失微不足道）。
- 拥有词汇表划分函数即可检测。
- 对改写不具备鲁棒性——重写文本会破坏水印信号。

SynthID 文本水印于 2024 年 10 月通过 Google Responsible GenAI Toolkit 开源。

### Stable Signature（图像水印）

Fernandez 等，ICCV 2023。微调潜在扩散解码器（latent diffusion decoder），使每张生成图像都在潜在表示中嵌入一个固定的二进制消息。通过神经解码器从潜在表示中解码进行检测。裁剪至原始内容 10% 的图像在 FPR<1e-6 下检测率仍超过 90%。

2024 年 5 月，《Stable Signature is Unstable》（arXiv:2405.07145）：对解码器进行微调即可移除水印，同时保持图像质量不变。对抗性的后生成微调成本低廉；水印的对抗鲁棒性有限。

### SynthID 统一检测器（2025 年 11 月）

随 Gemini 3 Pro 同步发布：一个多模态检测器，在单一 API 中读取来自文本、图像、音频和视频的 SynthID 信号，统一了 Google 的溯源技术栈。

### C2PA

内容溯源与真实性联盟（Coalition for Content Provenance and Authenticity）。密码学签名且防篡改的元数据标准。C2PA 2.2 Explainer（2025）。一份 C2PA 清单（manifest）记录溯源声明（谁创建、何时创建、经过哪些变换），并由创建者的密钥签名。

与水印技术互补：
- 元数据可被剥离；水印则（相对）难以剥离。
- 元数据信息丰富（完整的溯源链）；水印只能携带少量比特。
- C2PA 依赖平台采用；水印自动嵌入。

Google 在搜索、广告和「关于此图片」中同时集成了两者。

### 局限性

- **模型特有。** SynthID 仅为启用了 SynthID 的模型生成的输出添加水印。未启用 SynthID 的模型产出的内容无水印，因此「未检测到 SynthID 信号」不能作为真实性证明。
- **改写。** 文本水印无法在保持语义的改写下幸存。
- **变换攻击。** arXiv:2508.20228（2025）展示了保持语义的攻击，可同时摧毁文本水印和许多图像水印。
- **微调移除。** 根据《Stable Signature is Unstable》的结论，后生成微调可移除嵌入的水印。

### 欧盟 AI 法案第 50 条

AI 生成内容标注透明度准则（首版草案 2025 年 12 月，第二版草案 2026 年 3 月，预计 2026 年 6 月定稿，详见[欧盟委员会状态页](https://digital-strategy.ec.europa.eu/en/policies/code-practice-ai-generated-content)）。截至 2026 年 4 月，该准则仍处于草案阶段，时间表可能调整。这是要求技术层之上的监管层。深度伪造必须被标注。

### 本课在阶段 18 中的位置

第 22-23 课关注模型输出的内容（隐私数据、溯源信号）。第 27 课介绍训练数据治理。第 24 课讲解要求这些技术措施的监管框架。

## 动手实验

`code/main.py` 构建一个玩具级文本水印。Token 为整数 0..N-1；水印采样偏向哈希定义的绿色集合。检测器计算绿色 token 的 z 分数。你可以观察 1000 个 token 的生成文本的检测效果、观察改写如何摧毁信号，以及测量在人类文本上的误报率。

## 交付产物

本课产生 `outputs/skill-provenance-audit.md`。给定一份带有溯源声明的部署内容，对其进行审计：水印机制（如有）、C2PA 签名链（如有）、各环节的对抗鲁棒性，以及按模态的覆盖情况。

## 练习

1. 运行 `code/main.py`。报告 1000 个 token 水印生成文本与人类撰写文本的 z 分数。找出 95% 置信阈值下的误报率。

2. 实现一个改写攻击，将 30% 的 token 替换为同义词。重新测量 z 分数。

3. 阅读 Kirchenbauer 等人 2023 年第 6 节关于鲁棒性的内容。为什么文本水印在改写下失效，而图像水印能抵抗裁剪？

4. 设计一个同时使用 SynthID 文本水印和 C2PA 元数据的部署方案。描述消费者看到的溯源链。指出每个组件的典型失效模式。

5. 2024 年《Stable Signature is Unstable》的结果表明微调可以移除图像水印。设计一种部署控制措施来限制这种攻击——例如，要求微调后的检查点必须签名发布。

## 关键术语

| 术语 | 通常说法 | 实际含义 |
|------|---------|---------|
| SynthID | 「Google 的水印」 | 跨模态溯源信号，覆盖文本、图像、音频、视频 |
| Token 水印 | 「Kirchenbauer 风格」 | 有偏采样的文本水印，通过绿色 token z 分数检测 |
| Stable Signature | 「图像水印」 | 微调解码器水印，ICCV 2023 |
| C2PA | 「元数据标准」 | 密码学签名且防篡改的溯源元数据 |
| 改写鲁棒性 | 「换词会不会破坏它」 | 文本水印属性，目前有限 |
| 微调移除 | 「对抗性去水印」 | 通过解码器微调移除图像水印的攻击 |
| 跨模态检测器 | 「统一 SynthID」 | 2025 年 11 月发布的跨模态统一 API |

## 延伸阅读

- [Kirchenbauer 等——A Watermark for Large Language Models（ICML 2023，arXiv:2301.10226）](https://arxiv.org/abs/2301.10226)——token 水印机制
- [Fernandez 等——Stable Signature（ICCV 2023，arXiv:2303.15435）](https://arxiv.org/abs/2303.15435)——图像水印论文
- [《Stable Signature is Unstable》（arXiv:2405.07145）](https://arxiv.org/abs/2405.07145)——移除攻击
- [Google DeepMind——SynthID](https://deepmind.google/models/synthid/)——跨模态水印
- [C2PA 2.2 Explainer（2025）](https://c2pa.org/specifications/specifications/2.2/explainer/Explainer.html)——元数据标准
