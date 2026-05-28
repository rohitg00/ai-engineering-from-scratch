---
name: voice-cloner
description: voice-cloning deployment に対して、cloning approach (zero-shot / conversion / adaptation)、consent artifact、watermark、safety filters を選びます。
version: 1.0.0
phase: 6
lesson: 08
tags: [voice-cloning, voice-conversion, watermark, consent, safety]
---

タスク (language, reference length available, adaptation budget, license constraints, consent status, deployment scale) が与えられたら、次を出力してください。

1. Approach。Zero-shot clone (F5-TTS / VibeVoice / Orpheus / OpenVoice V2) · voice conversion (kNN-VC / OpenVoice V2 tone-color) · speaker adaptation (XTTS v2 + LoRA / VITS full fine-tune)。
2. Reference prep。Required length、SNR (≥ 20 dB)、mono 16 kHz+、silence trim、`ref_text` (F5-TTS では完全一致必須)。music-bed references は拒否。
3. Consent artifact。voice owner からの明示的な recorded consent。Template: name + date + purpose + scope + revocation procedure。7 年以上保存。
4. Watermark。すべての output に AudioSeal-embedded 16-bit payload。公開前に presence を検証する detector を CI に設定。
5. Safety filters。Named-entity (celebrity / politician / minor) prompt-rejection。user ごとの hourly rate-limit。すべての clone generation の audit log。kill-switch。

watermarking strategy なしの cloning 出荷は拒否してください。consent claims の有無にかかわらず、named celebrities / politicians / minors の clone は拒否してください。3 s 未満または SNR &lt; 20 dB の references は拒否してください。commercial deployments での F5-TTS は拒否してください (CC-BY-NC)。cross-lingual clone では accent-transfer gap を明示的に警告してください。

Example input: "Accessibility app: let ALS patient bank their voice while still speaking, then speak through TTS after voice loss. English, US."

Example output:
- Approach: OpenVoice V2 (MIT, zero-shot, 6 s reference)。accessibility use case であり inherent consent がある。patient は voice owner。
- Reference prep: studio-quality conditions (quiet room, USB mic, 24 kHz) で 5 × 6 s clips を録音。raw + transcripts を保存。安定性のため centroid reference を作成。
- Consent: purpose ("post-diagnosis voice reuse") を証明する digital signature + video affirmation。encrypted volume に 10-year retention で保存。Revocation hotline。
- Watermark: `patient_id` + `clip_id` を encoding する AudioSeal 16-bit payload。detector は CI で every generation に対して実行。
- Safety: named-entity prompts を hard-filter。every generation を log。患者の logged-in app instance に ROI-limited。API exposure なし。
