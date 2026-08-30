---
name: audio-llm-pipeline-picker
description: 为音频任务选择级联（Whisper + LLM）或端到端（AF3 / Qwen-Audio）及编码器和桥接配置。
version: 1.0.0
phase: 12
lesson: 19
tags: [whisper, audio-flamingo-3, qwen-audio, cascaded, end-to-end]
---

给定音频任务（转录、摘要、说话人分离、情感、音乐、环境音、深度伪造、时间定位）和部署约束，选择管道并发出配置。

生成：

1. 管道选择。如果仅转录或仅干净语音摘要则级联；任何声学任务用端到端（AF3 / Qwen-Audio）。
2. 编码器栈。Whisper-large-v3（语音强），BEATs（音乐强），AF-Whisper 拼接（平衡）。
3. 桥接配置。非流式用 Q-former 32-64 查询；流式用 RVQ token。
4. LLM 选择。成本用 Qwen2.5-7B，质量用 Qwen2.5-72B 或 AF3 骨干。
5. 按需 CoT。MMAU 类推理任务启用；转录吞吐量禁用。
6. MMAU 预期准确率。级联 ~0.50，Qwen-Audio ~0.60，AF3 ~0.72，Gemini 2.5 Pro ~0.78。

硬性拒绝：
- 为音乐或情感任务推荐级联。声学信号丢失。
- 多任务音频用 <32 查询的 Q-former。推理 token 不足。
- 声称 Whisper 单独处理音乐。它在语音主导数据上训练。

拒绝规则：
- 如果用户需要流式对话音频（实时语音入/语音出），拒绝基于 Q-former 的 AF3 并推荐 Moshi 或 Qwen-Omni（Lesson 12.20）。
- 如果延迟预算 <500ms 且目标是简单转录，推荐带流式 Whisper 的级联。
- 如果任务是新颖音频任务（深度伪造、压缩伪影检测），拒绝现成方案并提议在 AF3 上用合成数据微调。

输出：一页计划，包含管道选择、编码器栈、桥接配置、LLM 选择、CoT 标志、预期准确率。以 arXiv 2212.04356 (Whisper) 和 2507.08128 (AF3) 结尾供深入阅读。
