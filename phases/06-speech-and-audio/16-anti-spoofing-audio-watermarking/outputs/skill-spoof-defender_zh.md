---
name: spoof-defender
description: 为语音生成/语音认证部署选择检测模型、水印、来源清单和运营手册
version: 1.0.0
phase: 6
lesson: 16
tags: [anti-spoofing, watermark, audioseal, asvspoof, c2pa, voice-fraud]
---

给定工作负载（语音生成 vs 语音认证、部署规模、合规区域、对手画像），输出：

1. 检测（CM）。AASIST · RawNet2 · NeXt-TDNN + WavLM · 商业方案（Pindrop, Validsoft）。训练数据：ASVspoof 2019 / ASVspoof 5 / 领域特定。目标等错误率（EER）。
2. 水印（对外生成）。AudioSeal 16位负载编码 `(model_id, user_id, generation_ts)` · WaveVerify（备选）· 无（需提供理由）。检测器在 CI 中对每个输出在发布前运行。
3. 来源。C2PA 清单，使用部署者密钥签名 · IPTC 元数据 · 无（针对非消费级音频）。
4. 语音认证保护（如适用）。活体挑战（随机短语 TTS + 转录）、重放攻击检测（AASIST + PA 模型）、按信道的生物特征阈值校准。
5. 运营。审计日志保留、同意凭证保留（7年以上）、滥用检测信号（突发流量、命名实体提示）、紧急关闭程序。

拒绝没有 AudioSeal（或同等水印）的语音生成部署。拒绝没有反欺骗检测的语音生物特征部署——音色克隆使仅余弦相似度的认证可被轻易绕过。拒绝仅依赖来源清单的部署（可被剥离）。拒绝使用基于 ASVspoof 2019 训练的检测阈值而不进行信道校准扫描的真实部署。

示例输入："银行客户服务 IVR。语音生物特征解锁 + AI 生成语音客服。每月1000万通电话。美国 + 欧盟。"

示例输出：
- 检测：Pindrop 商业方案（首选）或 NeXt-TDNN + WavLM 开放方案。在 ASVspoof 5 + 10万银行特定通话样本上训练。目标等错误率在领域数据上 < 0.5%。
- 水印：每个对外 TTS 话语上的 AudioSeal 16位负载；负载编码 bank_id + session_id + timestamp。检测器在传输前验证。
- 来源：客户音频导出工作流上的 C2PA 清单；仅内部通话跳过。
- 语音认证：每次认证进行活体挑战（TTS 随机4位数字短语；用户重复 + 检测器 + 转录器）。每次入站认证尝试都运行反欺骗。生物特征阈值设置为 FAR 0.1%，FRR 1%。
- 运营：同意和审计日志保留7年，按区域存储（欧盟数据留在欧盟）。克隆请求量超过2σ时告警；检测到滥用时启动紧急关闭。
