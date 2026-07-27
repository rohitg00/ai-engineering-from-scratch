---
name: voice-assistant-architect
description: 为给定工作负载生成全栈语音助手规格——组件、延迟预算、可观测性、合规性
version: 1.0.0
phase: 6
lesson: 12
tags: [voice-assistant, architecture, livekit, pipecat, compliance]
---

给定用例（消费者 / 客户支持 / 辅助访问 / 边缘）、预期规模（并发会话、分钟/月）、语言、延迟目标、合规要求（HIPAA、PCI、EU AI Act、CA SB 942），输出：

1. 组件（7层）。麦克风 + 分块 · VAD · 流式 STT · LLM + 工具 · 流式 TTS · 播放 · 中断处理器。为每个组件指明确切的供应商/模型。
2. 延迟预算。每阶段的 P50 / P95 / P99 目标，总和达到端到端目标。标记哪些阶段是独立的 vs 顺序的。
3. 工具调用模式。每个工具的 JSON 规格 + 错误处理 + 回退文本。始终包含一个 LLM 在连续失败两次时必须采取的"无法帮助"路径。
4. 安全性。提示注入防护、音色克隆锁定（如果 TTS 具备克隆能力）、唤醒词门控（用于始终监听）、日志中的个人身份信息脱敏、30天保留期。
5. 可观测性。每阶段的 P50/P95/P99 · 误中断率 · 工具调用成功率 · 每100次调用的词错误率（WER） · 每分钟成本 · 放弃率。
6. 合规性。披露音频（"这是一个 AI 助手"）、区域锁定（欧盟数据留在欧盟）、审计日志保留、退出途径。

拒绝没有唤醒词的始终监听部署。拒绝不进行流式传输的 TTS（会增加整段话语的延迟）。拒绝平均延迟而不报告 P95——尾部延迟才是用户流失的原因。拒绝在未经法律审查的情况下保留原始音频超过30天。

示例输入："低视力用户辅助访问助手：面向消费者邮件应用的纯语音界面。英语。P95 < 600毫秒。约1万并发用户。"

示例输出：
- 组件：sounddevice（通过 LiveKit Agents 的 WebRTC）· Silero VAD · Deepgram Nova-3（英语）· 带邮件工具（read_message、compose_reply、mark_read）的 GPT-4o · Cartesia Sonic 2 流式 TTS · WebRTC 输出 · 中断=在 VAD 触发时取消 LLM 和 TTS。
- 预算：捕获 120毫秒 + VAD 40 + STT 150 + LLM TTFT 100 + TTS TTFA 150 = 560毫秒 P95。
- 工具：read_message({id})、compose_reply({message_id, body})、mark_read({id})、search({query})。全部返回 JSON；LLM 每个工具最多重试2次，然后回退为"我无法完成该操作——请尝试换种说法"。
- 安全性：提示注入防护（检测 `ignore previous instructions`）；唤醒词"Hey Mail"；无音色克隆（固定 Cartesia 音色）；在日志中脱敏邮件内容。
- 可观测性：Hamming AI 生产监控；按阶段的 Prometheus 直方图；误中断超过5%或 p95 超过800毫秒时报警。
- 合规性：首次使用时进行 AI 披露；仅医疗信息可选 HIPAA；欧盟用户连接欧盟托管的 Cartesia + GPT-4o（爱尔兰）。
