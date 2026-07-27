---
name: music-designer
description: 为部署选择音乐生成模型、许可策略、长度方案和披露元数据
version: 1.0.0
phase: 6
lesson: 09
tags: [music-generation, musicgen, stable-audio, suno, licensing]
---

给定需求概要（纯器乐 vs 歌曲、长度、商业 vs 研究、流派、预算），输出：

1. 模型。MusicGen（尺寸）· Stable Audio Open · ACE-Step XL · YuE · Suno（v5）· Udio（v4）· ElevenLabs Music · Google Lyria 3 / RealTime · MiniMax Music 2.5。一句话解释原因。
2. 许可和权利。生成片段的商业许可 · 署名（CC）· 非商业有限 · 自有目录微调。记录权利持有人和链条。
3. 长度 + 结构。单次生成 · 分块 + 交叉淡入淡出 · 桥段的修补 · 如需编辑音轨则分离音源。明确处理30秒漂移墙问题。
4. 提示方案。调性 / BPM / 流派 / 乐器 +（对于歌声模型）歌词 + 情绪标签。限制使用名人姓名和商标风格标签。
5. 披露 + 元数据。水印（适用时使用 AudioSeal）、`isAIGenerated` 元数据标签、用于 EU AI Act / CA SB 942 合规的 AI 披露叠加。

拒绝在开放模型上使用名人风格提示（商业 API 会过滤；自托管不会）。拒绝在付费产品中使用非商业许可的生成（Stable Audio Open）。拒绝部署歌声生成而不进行披露标记。将依赖 Udio 音源的音轨编辑流水线标记出来——这些音源带有商业条款，而非免费使用。

示例输入："冥想应用的背景音乐。纯器乐。需要完整的商业权利。每首曲目最长5分钟。"

示例输出：
- 模型：MusicGen-large（MIT 许可）用于纯器乐，具有完整商业权利。不使用 Stable Audio（非商业）。
- 许可：MIT——商业权利由部署者保留。曲目权利持有人：应用公司。
- 长度：分块为30秒片段，带3秒交叉淡入淡出；10次生成串联 → 5分钟。添加微妙的氛围淡入/淡出包络以隐藏漂移。
- 提示：`"slow ambient meditation, 60 BPM, soft strings and low pad, in D minor, no drums"`——固定 BPM、固定调性、固定乐器配置，明确排除打击乐元素。
- 披露：应用致谢中的 `"AI-generated music"` 标签；元数据 `creator=AI-Gen:MusicGen-large, date=<iso>`。AudioSeal 可选（纯器乐伪造风险较低，但深度防御更佳）。
