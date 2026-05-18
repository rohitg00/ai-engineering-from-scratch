---
name: spoof-defender
description: 为语音生成 / 语音认证部署选择检测模型、水印、来源清单和运维手册。
version: 1.0.0
phase: 6
lesson: 16
tags: [anti-spoofing, watermark, audioseal, asvspoof, c2pa, voice-fraud]
---

给定工作负载（语音生成 vs 语音认证、部署规模、合规区域、对手特征），输出：

1. 检测（CM）。AASIST · RawNet2 · NeXt-TDNN + WavLM · 商业（Pindrop、Validsoft）。训练数据：ASVspoof 2019 / ASVspoof 5 / 领域特定。目标 EER。
2. 水印（出站生成）。AudioSeal 16 位有效载荷编码 `(model_id, user_id, generation_ts)` · WaveVerify（替代）· 无（需说明理由）。检测器在 CI 中每次输出发货前运行。
3. 来源。使用部署者密钥签名的 C2PA 清单 · IPTC 元数据 · 无（用于非消费者音频）。
4. 语音认证防护（如适用）。活体挑战（随机短语 TTS + 转录）、重放攻击检测（AASIST + PA 模型）、每通道生物识别阈值校准。
5. 运维。审计日志保留、同意书保留（7+ 年）、滥用检测信号（突然音量激增、命名实体提示）、终止开关程序。

拒绝没有 AudioSeal（或等效水印）的语音生成部署。拒绝没有反欺骗检测的语音生物识别部署——声音克隆使仅余弦认证变得可轻易绕过。拒绝仅依赖来源清单的部署（可剥离）。拒绝在没有通道校准扫描的情况下将 ASVspoof 2019 上训练的检测阈值用于真实世界部署。

示例输入："银行客服 IVR。语音生物识别解锁 + AI 生成语音代理。1000 万通电话/月。美国 + 欧盟。"

示例输出：
- 检测：首选 Pindrop 商业方案，或 NeXt-TDNN + WavLM 开源方案。在 ASVspoof 5 + 100k 银行特定通话样本上训练。领域内数据目标 EER &lt; 0.5%。
- 水印：在每个出站 TTS utterance 上嵌入 AudioSeal 16 位有效载荷；有效载荷编码 bank_id + session_id + 时间戳。检测器在传输前验证。
- 来源：面向客户的音频导出工作流使用 C2PA 清单；内部通话跳过。
- 语音认证：每次认证时进行活体挑战（TTS 随机 4 位数字短语；用户重复 + 检测器 + 转录器）。每次入站认证尝试都运行反欺骗。生物识别阈值设在 FAR 0.1%、FRR 1%。
- 运维：同意书 + 审计日志在区域内保留 7 年（欧盟数据由欧盟居民处理）。在克隆请求量突然 &gt; 2σ 时告警；在检测到滥用时触发终止开关。
