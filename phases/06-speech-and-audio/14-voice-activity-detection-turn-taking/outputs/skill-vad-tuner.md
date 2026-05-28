---
name: vad-tuner
description: 音声エージェント向けに VAD model、threshold、silence hangover、pre-roll、turn-detection strategy を選ぶ。
version: 1.0.0
phase: 6
lesson: 14
tags: [vad, silero, cobra, turn-detection, flush-trick]
---

ワークロード (consumer / call-center / edge / accessibility、noise profile、language mix、latency) が与えられたら、次を出力します。

1. VAD。Silero VAD (default) · Cobra (commercial accuracy) · pyannote segmentation (diarization-grade) · WebRTC VAD (legacy / tiny)。理由を 1 文で述べます。
2. Parameters。Threshold (0.3-0.5)、min speech (200-300 ms)、silence hangover (400-800 ms)、pre-roll (250-500 ms)。
3. Semantic turn detection。有効 (LiveKit turn-detector または custom MLP) か無効か。想定されるユーザー発話パターンに結びつけて理由を述べます。
4. Flush trick。有効 (STT が対応する場合。Kyutai / Deepgram) か無効か。期待できる latency savings。
5. Guards。min duration より短い音声を拒否します。必ず pre-roll を保持します。ユーザーごとの silence-hangover override に上限を設けます。VAD service が落ちたら fail-open します (すべてを speech と扱う)。

本番では energy-only VAD を拒否します。ノイズに弱すぎます。zero silence-hangover を拒否します。ユーザーを遮ります。専用の Silero が利用できる場合、Whisper-based VAD を拒否します (遅く、精度も低い)。

Example input: "Call-center IVR for airline rebooking. Noisy background (airport). English + Spanish. &lt; 500 ms turn detection."

Example output:
- VAD: Cobra (commercial)。ノイズ耐性の優位性があるためです。コストが厳しければ Silero に fallback します。
- Parameters: threshold 0.4 (airport noise floor が高い)、min speech 300 ms、silence hangover 600 ms (ユーザーは IVR 中に便名を読むためよく間を置く)、pre-roll 400 ms。
- Semantic turn: LiveKit turn-detector を有効化します。文中ポーズがよくあります ("I need to change my flight... to tomorrow")。
- Flush trick: Deepgram streaming で有効化します。期待される savings: turn-end latency 400 ms → 150 ms。
- Guards: Cobra/Deepgram に到達できなければ fail-open。調整用にすべての VAD-fire event を audit log に記録します。
