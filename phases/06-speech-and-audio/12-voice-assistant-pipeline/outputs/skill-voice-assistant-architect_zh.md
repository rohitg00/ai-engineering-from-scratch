---
name: voice-assistant-architect
description: 为给定工作负载生成全栈语音助手规范——组件、延迟预算、可观测性、合规性。
version: 1.0.0
phase: 6
lesson: 12
tags: [voice-assistant, architecture, livekit, pipecat, compliance]
---

给定用例（消费者 / 客户支持 / 无障碍 / 边缘）、预期规模（并发会话、分钟/月）、语言、延迟目标、合规性（HIPAA、PCI、欧盟 AI 法案、CA SB 942），输出：

1. 组件（7 层）。麦克风 + 分块 · VAD · 流式 STT · LLM + 工具 · 流式 TTS · 播放 · 中断处理器。为每层命名确切的提供商/模型。
2. 延迟预算。每阶段的 P50 / P95 / P99 目标，累加为端到端目标。标记哪些阶段是独立的 vs 顺序的。
3. 工具调用模式。每个工具的 JSON 规范 + 错误处理 + 回退文本。始终包含一条 LLM 在失败两次后必须走的"无法帮助"路径。
4. 安全。提示注入防护、声音克隆锁定（如果 TTS 支持克隆）、唤醒词门控（对于始终在线）、日志中的 PII 脱敏、30 天保留期。
5. 可观测性。每阶段 P50/P95/P99 · 误中断率 · 工具调用成功率 · 每 100 通电话的 WER · 每分钟成本 · 放弃率。
6. 合规。披露音频（"这是一个 AI 助手"）、区域固定（欧盟数据在欧盟）、审计日志保留、退出途径。

拒绝没有唤醒词的始终在线部署。拒绝不流式的 TTS（增加 utterance 长度延迟）。拒绝没有 P95 的平均延迟——尾部是用户流失的地方。拒绝在没有法律审查的情况下保留原始音频 &gt; 30 天。

示例输入："低视力用户的无障碍助手：通过语音-only 界面访问消费者邮件应用。英语。P95 &lt; 600 ms。~10k 并发用户。"

示例输出：
- 组件：sounddevice（通过 LiveKit Agents 的 WebRTC）· Silero VAD · Deepgram Nova-3（英语）· 带邮件工具的 GPT-4o（read_message、compose_reply、mark_read）· Cartesia Sonic 2 流式 · WebRTC 输出 · 中断=在 VAD 触发时取消 LLM 和 TTS。
- 预算：捕获 120 ms + VAD 40 + STT 150 + LLM TTFT 100 + TTS TTFA 150 = 560 ms P95。
- 工具：read_message({id})、compose_reply({message_id, body})、mark_read({id})、search({query})。全部返回 JSON；LLM 每个工具最多重试 2 次，然后回退"我做不到——尝试重新表述"。
- 安全：提示注入防护（检测 `ignore previous instructions`）；唤醒词"Hey Mail"；不克隆声音（固定 Cartesia 语音）；在日志中脱敏邮件正文。
- 可观测性：Hamming AI 生产监控；每阶段 Prometheus 直方图；在误中断 &gt; 5% 或 p95 &gt; 800 ms 时告警。
- 合规：首次使用时进行 AI 披露；仅对医疗消息选择加入 HIPAA；欧盟用户访问欧盟托管的 Cartesia + GPT-4o 爱尔兰节点。
