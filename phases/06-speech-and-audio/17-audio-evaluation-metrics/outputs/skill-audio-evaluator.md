---
name: audio-evaluator
description: 任意の audio model release に対して metrics、benchmarks、normalization rules、reporting format を選ぶ。
version: 1.0.0
phase: 6
lesson: 17
tags: [evaluation, wer, mos, utmos, eer, der, fad, mmau, leaderboard]
---

タスク (ASR / TTS / cloning / speaker-verif / diarization / classification / music / LALM / streaming S2S) が与えられたら、次を出力します。

1. Primary metric。WER · MOS · UTMOS · SECS · EER · DER · mAP · FAD · MMAU-Pro accuracy · latency P95。1 つ選びます。
2. Secondary metrics。追加の軸 (speed、diversity、robustness) を 1-3 個と理由。
3. Normalization rule。Lowercase、punctuation-strip、number expansion、whitespace collapse。Whisper-normalizer または custom を使い、文書化します。
4. Public benchmark。報告対象の canonical leaderboard (Open ASR、TTS Arena、MMAU-Pro、VoxCeleb1-O、AudioSet、LongAudioBench など)。
5. In-house set。N samples の held-out domain data。demographic / acoustic slice breakdown。
6. Reporting format。Distribution (latency は P50/P95/P99、classification は per-class recall、MMAU は per-category)。Release notes template。

latency の single-number evaluation を拒否します (percentiles を報告)。classification の aggregate-only を拒否します (per-class を報告)。cloning で MOS/UTMOS と SECS の両方がない TTS release を拒否します。WER normalization spec のない ASR release を拒否します。FAD だけの music release を拒否します。必ず human MOS panel と組み合わせます。

Example input: "Release of a new English-Spanish conversational TTS. Need to convince the team it's better than the existing Cartesia-Sonic baseline."

Example output:
- Primary: UTMOS (language ごとに 50 prompts の paired audio samples) + human-panel MOS (language ごとに 20 listeners、baseline との blind A/B)。
- Secondary: TTFA median & P95 (baseline と同等であること)、固定 voice reference に対する SECS &gt; 0.80 (speaker regression なし)、round-trip ASR (Whisper-large-v3-turbo) の CER &lt; 2%。
- Normalization: round-trip WER には Whisper-normalizer English + Hugging Face multilingual-normalizer Spanish。
- Public benchmark: relative ELO positioning のために TTS Arena (English) と Artificial Analysis Speech。Target: 最も近い competitor から 50 ELO 以内。
- In-house: 200 held-out prompts (lang ごとに 100)。money、dates、product names、2-sentence narration、emotional read、code-switched を含む。10 demographic voices。
- Reporting: headline (UTMOS + MOS)、P50/P95 TTFA histogram、SECS CDF、CER per-category breakdown、failure-mode callouts (code-switched prompts failed at X%) を含む release note。
