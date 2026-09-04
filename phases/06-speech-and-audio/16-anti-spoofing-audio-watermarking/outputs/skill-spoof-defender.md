---
name: spoof-defender
description: Pick detection model, watermark, provenance manifest, and operational playbook for a voice-generation / voice-auth deployment.
version: 1.0.0
phase: 6
lesson: 16
tags: [anti-spoofing, watermark, audioseal, asvspoof, c2pa, voice-fraud]
---

Given the workload (voice-gen vs voice-auth, deploy scale, compliance region, adversary profile), output:

1. Detection (CM). AASIST · RawNet2 · NeXt-TDNN + WavLM · commercial (Pindrop, Validsoft). Training data: ASVspoof 2019 / ASVspoof 5 / domain-specific. Target EER.
2. Watermarking (outbound gen). AudioSeal 16-bit payload encoding `(model_id, user_id, generation_ts)` · WaveVerify (alt) · none (with justification). Detector runs in CI on every output pre-ship.
3. Provenance. C2PA manifest signed with deployer's key · IPTC metadata · none (for non-consumer audio).
4. Voice-auth guards (if applicable). Liveness challenge (random phrase TTS' + transcribe), replay attack detection (AASIST + PA model), biometric threshold calibration per channel.
5. Operational. Audit log retention, consent artifact retention (7+ years), abuse-detection signals (sudden volume burst, named-entity prompts), kill-switch procedure.

Refuse voice-gen deploys without AudioSeal (or equivalent watermark). Refuse voice biometric deploys without anti-spoofing detection — voice cloning makes cosine-only auth trivially bypassable. Refuse deploys that depend on provenance manifest alone (strippable). Refuse detection thresholds trained on ASVspoof 2019 for real-world deploys without a channel-calibration sweep.

Example input: "Bank customer-service IVR. Voice biometric unlock + AI-generated voice agent. 10M calls/month. US + EU."

Example output:
- Detection: Pindrop commercial (preferred) or NeXt-TDNN + WavLM open. Training on ASVspoof 5 + 100k bank-specific call samples. Target EER &lt; 0.5% on in-domain data.
- Watermarking: AudioSeal 16-bit payload on every outbound TTS utterance; payload encodes bank_id + session_id + timestamp. Detector verifies before transmit.
- Provenance: C2PA manifest on audio-export-to-customer workflows; internal-only calls skip.
- Voice-auth: liveness challenge at every auth (TTS random 4-digit phrase; user repeats + detector + transcriber). Anti-spoofing runs on every inbound auth attempt. Biometric threshold at FAR 0.1%, FRR 1%.
- Operational: 7-year retention on consent + audit log in region (EU data EU-resident). Alert on sudden clone-request volume &gt; 2σ; kill-switch on abuse detection.
