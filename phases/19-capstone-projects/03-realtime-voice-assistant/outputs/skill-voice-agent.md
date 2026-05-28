---
name: voice-agent
description: 800ms 未満の first-audio-out、barge-in handling、会話中の tool use を備えた real-time voice agent を構築する。
version: 1.0.0
phase: 19
lesson: 03
tags: [capstone, voice, webrtc, livekit, pipecat, asr, tts, streaming]
---

ドメイン (customer support、scheduling、retail assistant) を受け取り、barge-in、tool call、packet loss に対応しつつ end-to-end first-audio-out を 800ms 未満に保つ WebRTC voice agent を deploy する。

構築計画:

1. microphone audio を streaming する web client 付きで LiveKit Agents 1.0 room を立ち上げる。電話対応のため Twilio PSTN gateway を追加する。
2. streaming ASR (hosted Deepgram Nova-3、または g5.xlarge 上の faster-whisper Whisper-v3-turbo) を実行する。partial transcript と final transcript を購読する。
3. 20ms frame 上で Silero VAD v5 を実行する。speech-end では最新 partial を LiveKit turn-detector で score し、VAD silence >= 500ms かつ completion score >= 0.6 のときだけ turn-complete とする。
4. LLM (GPT-4o-realtime、Gemini 2.5 Flash Live、または cascaded Claude Haiku 4.5) を stream する。first token を 200ms 以内に TTS へ渡す。
5. TTS (Cartesia Sonic-2 または ElevenLabs Flash v3) を stream する。first audio chunk は first LLM token から 200ms 以内に server を出なければならない。
6. barge-in: SPEAKING または THINKING 中に VAD が新しい user speech を検出したら、TTS を cancel し、残りの LLM output を捨て、ASR を再 arm する。`tts_canceled` span を publish する。
7. tool side-channel: function call を concurrent に実行する。latency が 300ms を超える場合は acknowledgment filler を出し、audio stream が停止しないようにする。
8. 100 calls を record する。held-out transcript に対する WER、Hamming VAD benchmark の false-cutoff rate、first-audio-out p50、NISQA MOS、3% packet drop 下の挙動を測定する。
9. synthetic caller で単一 g5.xlarge 上の 50 concurrent calls を load-test し、sustained first-audio-out p95 を報告する。

評価 rubric:

| Weight | Criterion | Measurement |
|:-:|---|---|
| 25 | End-to-end latency | 100 recorded calls で first-audio-out p50 が 800ms 未満 |
| 20 | Turn-taking quality | Hamming VAD benchmark で false-cutoff rate が 3% 未満 |
| 20 | Tool-use correctness | 会話中 tool call が audio を止めずに正しい data を返すこと |
| 20 | Reliability under packet loss | 3% packet drop を注入したときの WER と turn-taking stability |
| 15 | Eval harness completeness | public config で再現可能な測定 |

ハードリジェクト:

- non-streaming pipeline (batch ASR、batch TTS) は latency target に届かない。
- TTS buffer を即座に cancel しない barge-in policy。遅延 cancel は最悪の UX regression を生む。
- LLM stream を同期的に block する tool call。必ず side channel で走らせる。

拒否ルール:

- VAD または turn-detector なしで deploy することを拒否する。fixed-timeout turn-taking は許容できない cutoff rate を生む。
- MOS が human-rated か NISQA-proxied かを文書化せずに報告することを拒否する。
- 少なくとも100 recorded calls と call trace 公開なしに「p50 latency under X」を報告することを拒否する。

出力: LiveKit agent worker、PSTN gateway config、100-call eval harness、public Langfuse voice dashboard、hosted competitor (Retell、Vapi、または OpenAI Realtime API 直利用) との side-by-side comparison、観測した上位3つの turn-taking failure と、それぞれを修正した detector tuning の write-up を含むリポジトリ。
