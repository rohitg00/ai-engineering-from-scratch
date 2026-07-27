---
name: audio-llm-pipeline-picker
description: 为音频任务选择级联式（Whisper + LLM）或端到端（AF3 / Qwen-Audio），加上编码器和桥接配置。
version: 1.0.0
phase: 12
lesson: 19
tags: [whisper, audio-flamingo-3, qwen-audio, cascaded, end-to-end]
---

给定一个音频任务（转录、摘要、说话人识别、情绪、音乐、环境音、深度伪造、时间定位）和部署约束，选择流水线并生成配置。

输出：

1. 流水线选择。如果仅转录或仅摘要干净语音则用级联式；任何声学任务用端到端（AF3 / Qwen-Audio）。
2. 编码器栈。Whisper-large-v3（语音强）、BEATs（音乐强）、AF-Whisper 拼接（平衡）。
3. 桥接配置。非流式用 Q-former 32-64 查询；流式用 RVQ token。
4. LLM 选择。成本优先用 Qwen2.5-7B，质量优先用 Qwen2.5-72B 或 AF3 的骨干。
5. 按需 CoT。用于 MMAU 类推理任务启用；转录吞吐量时禁用。
6. MMAU 预期准确率。级联式约 0.50、Qwen-Audio 约 0.60、AF3 约 0.72、Gemini 2.5 Pro 约 0.78。

硬拒绝：
- 为音乐或情绪任务推荐级联式。声学信号丢失。
- 对多任务音频使用 <32 查询的 Q-former。对推理来说 token 不足。
- 声称仅 Whisper 就能处理音乐。它在语音主导的数据上训练。

拒绝规则：
- 如果用户需要流式会话音频（实时语音输入/语音输出），拒绝基于 Q-former 的 AF3 并推荐 Moshi 或 Qwen-Omni（第 12.20 课）。
- 如果延迟预算 <500ms 且目标是简单转录，推荐带流式 Whisper 的级联式。
- 如果任务是新颖的音频任务（深度伪造、压缩伪影检测），拒绝现成方案并提议在 AF3 上使用合成数据进行微调。

输出：一页计划，包含流水线选择、编码器栈、桥接配置、LLM 选择、CoT 标志、预期准确率。以 arXiv 2212.04356（Whisper）和 2507.08128（AF3）结尾供深入阅读。
