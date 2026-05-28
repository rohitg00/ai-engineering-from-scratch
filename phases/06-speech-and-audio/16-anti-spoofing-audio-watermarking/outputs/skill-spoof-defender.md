---
name: spoof-defender
description: voice-generation / voice-auth deployment 向けに detection model、watermark、provenance manifest、operational playbook を選ぶ。
version: 1.0.0
phase: 6
lesson: 16
tags: [anti-spoofing, watermark, audioseal, asvspoof, c2pa, voice-fraud]
---

ワークロード (voice-gen vs voice-auth、deploy scale、compliance region、adversary profile) が与えられたら、次を出力します。

1. Detection (CM)。AASIST · RawNet2 · NeXt-TDNN + WavLM · commercial (Pindrop, Validsoft)。Training data: ASVspoof 2019 / ASVspoof 5 / domain-specific。Target EER。
2. Watermarking (outbound gen)。AudioSeal 16-bit payload encoding `(model_id, user_id, generation_ts)` · WaveVerify (alt) · none (justification つき)。Detector はすべての output で pre-ship に CI 実行します。
3. Provenance。C2PA manifest signed with deployer's key · IPTC metadata · none (non-consumer audio の場合)。
4. Voice-auth guards (該当する場合)。Liveness challenge (random phrase TTS' + transcribe)、replay attack detection (AASIST + PA model)、channel ごとの biometric threshold calibration。
5. Operational。Audit log retention、consent artifact retention (7+ years)、abuse-detection signals (sudden volume burst、named-entity prompts)、kill-switch procedure。

AudioSeal (または同等 watermark) のない voice-gen deploy を拒否します。anti-spoofing detection のない voice biometric deploy を拒否します。voice cloning により cosine-only auth は簡単に迂回できます。provenance manifest だけに依存する deploy を拒否します (剥がせます)。channel-calibration sweep なしに ASVspoof 2019 で訓練した detection thresholds を実世界 deploy に使うことを拒否します。

Example input: "Bank customer-service IVR. Voice biometric unlock + AI-generated voice agent. 10M calls/month. US + EU."

Example output:
- Detection: Pindrop commercial (preferred) または NeXt-TDNN + WavLM open。ASVspoof 5 + 100k bank-specific call samples で訓練。Target EER &lt; 0.5% on in-domain data。
- Watermarking: outbound TTS utterance すべてに AudioSeal 16-bit payload。payload は bank_id + session_id + timestamp を符号化します。Detector が送信前に検証します。
- Provenance: customer に audio export する workflow では C2PA manifest。internal-only calls は skip。
- Voice-auth: auth ごとに liveness challenge (TTS random 4-digit phrase、user repeats + detector + transcriber)。すべての inbound auth attempt で anti-spoofing を実行。Biometric threshold は FAR 0.1%、FRR 1%。
- Operational: consent + audit log を region 内で 7 年保持 (EU data は EU-resident)。sudden clone-request volume &gt; 2σ で alert。abuse detection で kill-switch。
