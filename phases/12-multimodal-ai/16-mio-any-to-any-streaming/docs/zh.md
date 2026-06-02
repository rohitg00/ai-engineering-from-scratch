# MIO 与 any-to-any 流式多模态模型

> 译注：本文译自同目录 [`en.md`](./en.md)。术语遵循仓根 [TRANSLATION_GUIDE.md](../../../../TRANSLATION_GUIDE.md)。

> GPT-4o 上线了一个大多数开源模型复刻不了的产品：一个能听到语音、看到视频、并实时把话说回来的 agent。开源生态在 2024 年末给出的回应是 MIO（Wang et al., 2024 年 9 月）。MIO 把 text、image、speech、music 都 tokenize，在交错（interleaved）序列上训一个因果 transformer，然后从任意模态生成到任意模态。AnyGPT（Zhan et al., 2024 年 2 月）是概念验证；MIO 是规模化版本；Unified-IO 2（Allen AI，2023 年 12 月）则是带视觉 + 动作 grounding 的近亲。本课讲透 any-to-any 模式 — 四个 tokenizer、一个 transformer、对流式友好的 decode。

**Type:** Learn
**Languages:** Python（stdlib，四模态 token 分配器 + 流式 decode 循环）
**Prerequisites:** Phase 12 · 11（Chameleon），Phase 6（Speech and Audio）
**Time:** ~120 minutes

## 学习目标（Learning Objectives）

- 设计一个能同时容纳 text、image、speech、music token 而不冲突的共享词表。
- 在压缩 + 重建权衡上对比 SEED-Tokenizer（图像）与 SpeechTokenizer 的 residual-VQ（语音）。
- 解释「逐步搭起 any-to-any 生成」的四阶段训练课程（curriculum）。
- 说出三种开源 any-to-any 配方（recipe）和它们各自的取舍：MIO、AnyGPT、Unified-IO 2。

## 问题（The Problem）

「统一多模态模型」嘴上说说容易，真要规模化做出来很难。2024 年之前大多数 "any-to-any" 系统都是流水线式的：视觉模型 → 文本表示 → 语音模型 → 音频。每跳一次都丢一次信息、加一次延迟、训练也更复杂。GPT-4o 的演示视频展示了一个「单模型」替代方案，可以做到亚秒级响应；开源系统晚了好几个月。

工程挑战在于：

- 每个模态都得有 tokenizer，要压缩得「足够无损」以便重建，token 产出速率还得让 transformer 吃得下。
- 单一词表得给 text（32k+）、image（16k+）、speech（4k+）、music（8k+）都留位置。最少四万多个条目。
- 训练数据得覆盖每一种「输入-输出」模态对（text→image、image→speech、speech→image 等），否则就得靠模型自行组合。
- 推理（inference）必须把输出 token 流式吐出，速度要够快，撑得住对话级延迟（首字节音频 <500ms）。

## 概念（The Concept）

### 四模态、四个 tokenizer

MIO 的 tokenizer 栈：

- Text：标准 BPE，词表约 32000。
- Image：SEED-Tokenizer（2023） — 量化 VAE，离散 codebook，4096 个条目，每张图 32x32 个 token。
- Speech：SpeechTokenizer 的 residual-VQ（2023） — 把 16kHz 波形编码进 8 层层级 codebook；第 0 层是粗粒度内容，后面几层加上韵律和说话人身份。
- Music：类似的 residual-VQ（Meta 的 MusicGen / Encodec 系列），4-8 个 codebook。

每个模态都产出整数 token。这些 token 在共享词表里被分配到互不相交的 ID 区间：

```
text:   0..31999
image:  32000..36095  (4096 image tokens)
speech: 36096..40191  (4096 speech base tokens, plus residual layers)
music:  40192..48383  (8192 music tokens)
sep:    48384..48390  (<image>, <speech>, <music>, </...>, etc.)
```

合计约 48k 词表。输入 embedding 与输出投影都覆盖整段。

### 流式 decode

语音生成用 residual-VQ。Transformer 预测基础层（layer 0）的 speech token；一个并行 decode 的残差量化器再预测后续层。每个 layer 0 token 在 16kHz 下大约对应 50ms 音频。

流式模式：

1. 用户对着麦说话；实时音频 tokenizer 每 50ms 吐一次 speech token。
2. MIO 边到边消费 token（prompt prefill + 增量前向传播）。
3. 输出 token 边生成边流出；并行的 speech decoder 把它们转成音频采样，延迟约 50-150ms。
4. 首字节音频时间（time-to-first-audio-byte）：MIO 论文里约 300-500ms，已经接近 GPT-4o 的约 250ms。

Mini-Omni（arXiv:2408.16725）、GLM-4-Voice（arXiv:2412.02612）和 Moshi（arXiv:2410.00037）是几条互补的流式 speech-LLM 路线。Moshi 尤其能在单卡 GPU 上做到 160ms 往返。

### 四阶段训练课程

MIO 的训练 curriculum：

1. 阶段 1 — 对齐（alignment）。大规模模态对语料：text-image、text-speech、text-music。每一对各用自己那段词表。训出共享词表。
2. 阶段 2 — 交错（interleaved）。多模态交错文档（含图像 + 视频的博客、带文字稿的播客等）。训出跨模态上下文能力。
3. 阶段 3 — 语音强化（speech-enhanced）。补一波音频数据，把 speech 质量拉起来同时不掉文本能力。
4. 阶段 4 — SFT。跨模态指令微调：VQA、caption、解说、speech-to-speech 对话。

少跑哪一阶段就掉哪一项能力：跳过阶段 2，跨模态上下文掉；跳过阶段 3，speech 就拉胯。

### Chain-of-visual-thought

MIO 引入了 chain-of-visual-thought：模型把中间图像 token 作为推理步骤吐出来。例如问「猫在爬树吗？」，模型会：

1. 吐 `<image>` token 把场景画出来（基于输入图像或草图）。
2. 吐文本分析这张草图。
3. 吐最终答案。

渲染出来的中间图像就当作草稿纸。空间推理类任务上的 benchmark 都有提升。这个思路对应的就是文本推理里的 chain-of-thought。

### Any-to-any 赛道里的对手

- AnyGPT（arXiv:2402.12226）：4 个模态（text、image、speech、music），设计相似。
- Unified-IO 2（arXiv:2312.17172）：增加了视觉动作输出、深度、法线。任务更杂，但规模更小。
- NExT-GPT（arXiv:2309.05519）：LLM + 模态专属的扩散（diffusion）decoder。不是单模型路线。
- CoDi（arXiv:2305.11846）：可组合的 diffusion，通过共享 latent 实现 any-to-any。

MIO 是最纯粹的「全 token any-to-any」。AnyGPT 是它的概念前辈。

### 延迟预算

对话型产品里，每一个组件的延迟都要算：

- 麦克风到 audio token：约 50ms。
- Prefill（音频 token + 历史）：8B 模型上约 100ms。
- 首个输出 token：约 50ms。
- 并行 residual-VQ + speech decoder：约 100-150ms。

合计首字节音频时间最少约 300ms。GPT-4o 自称约 250ms。Moshi 自称 160ms。MIO/AnyGPT 按公开基准在 400-600ms 区间。

### Any-to-any 为什么一直难

哪怕到了 2026 年，开源 any-to-any 模型仍在两个方向落后于闭源：

- 语音质量。Residual-VQ tokenizer 是有损的；对话语音听起来比 ElevenLabs 一档的声音机械。
- 跨模态推理。问模型「就你看到的东西唱一首」，失败率仍然比纯视觉任务高。

这些都是开放的研究问题。Qwen3-Omni（第 12.20 课）是 2025 年最先进的开源尝试。

## 用起来（Use It）

`code/main.py`：

- 定义并打印四模态词表分配。
- 把一组多模态输入（text、image、audio-clip、music）通过 tokenizer 路由器分发。
- 模拟 text-to-speech 响应的流式 decode，并计延迟。
- 给定 encoder、prefill、decoder 各自的延迟，计算预期的首字节音频时间。

## 上线部署（Ship It）

本课产出 `outputs/skill-any-to-any-pipeline-auditor.md`。给定一份对话型产品规格（输入模态、输出模态、延迟目标），它会审计 MIO 系列的设计选项并算出延迟预算。

## 练习（Exercises）

1. 你的产品接收语音输入、返回语音输出。端到端的延迟预算目标是多少？列出会消耗时间的所有组件。

2. SpeechTokenizer 的 residual-VQ 用 8 个 codebook。论证为什么这些残差层必须并行 decode（而不是串行），以及这能省下多少延迟。

3. 你的词表里有 32k text + 4k image + 4k speech。再加 8k music 和约 10 个分隔符。在 hidden dim 为 4096 时，embedding 矩阵的参数开销是多少？

4. Chain-of-visual-thought 会吐一张中间图像。哪类问题会因此受益？哪类问题会被这些额外 token 拖累？

5. 读 Moshi（arXiv:2410.00037）。描述它的 "inner monologue" 技巧，并与 MIO 的 chain-of-visual-thought 对比。

## 关键术语（Key Terms）

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| Any-to-any | "Multimodal in/out" | 一个单模型，接受并产出 text、image、speech、music，方向任意 |
| Residual-VQ | "Speech tokenizer stack" | 多 codebook tokenize，每一层加一份信息；基础层是内容，后面几层是韵律 |
| SEED-Tokenizer | "Image codes" | 离散图像 tokenizer，codebook 4096 条，被 MIO 采用 |
| Chain-of-visual-thought | "Visual scratchpad" | 模型在给最终答案前，生成一张中间图像作为推理步骤 |
| Time-to-first-audio-byte | "TTFAB" | 从用户说话到第一个音频输出的延迟；对话感要求 <500ms |
| Four-stage curriculum | "Training recipe" | 对齐 -> 交错 -> 语音强化 -> SFT，按这个顺序 |

## 延伸阅读（Further Reading）

- [Wang et al. — MIO (arXiv:2409.17692)](https://arxiv.org/abs/2409.17692)
- [Zhan et al. — AnyGPT (arXiv:2402.12226)](https://arxiv.org/abs/2402.12226)
- [Lu et al. — Unified-IO 2 (arXiv:2312.17172)](https://arxiv.org/abs/2312.17172)
- [Wu et al. — NExT-GPT (arXiv:2309.05519)](https://arxiv.org/abs/2309.05519)
- [Tang et al. — CoDi (arXiv:2305.11846)](https://arxiv.org/abs/2305.11846)
