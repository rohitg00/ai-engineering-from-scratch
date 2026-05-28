---
name: speaker-verifier
description: モデル選択、登録プロトコル、しきい値調整を含む speaker verification または diarization pipeline を設計します。
version: 1.0.0
phase: 6
lesson: 06
tags: [audio, speaker, verification, diarization]
---

対象 (verification vs identification vs diarization, domain, channel, threat model) とデータ (hours for threshold tuning, number of speakers, enrollment clip budget) が与えられたら、次を出力してください。

1. Embedder。ECAPA-TDNN / WavLM-SV / ReDimNet / x-vector。理由。
2. Enrollment protocol。クリップ数、min duration、noise gate、channel match。
3. Scoring。Cosine / PLDA。AS-norm の有無。cohort size。
4. Threshold。Target FAR (fraud risk) または EER。tuning set size。
5. Spoof defense。Anti-spoof model (AASIST, RawNet2)、liveness challenge、または replay detection。

fraud-grade deployment で anti-spoof front-end がないものは拒否してください。evaluation set、その channel、clip length distribution を報告せずに EER を公開することは拒否してください。domain をまたいで固定された cosine thresholds は、再調整なしなら警告してください。
