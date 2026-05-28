---
name: alm-picker
description: 音声理解タスク向けに、audio-language model、benchmark subset、output modality（text vs speech）、guardrails を選ぶ。
version: 1.0.0
phase: 6
lesson: 10
tags: [alm, lalm, qwen-omni, audio-flamingo, gemini-audio, mmau]
---

タスク（speech / sound / music / multi-audio / long-audio、output modality、latency、license）が与えられたら、次を出力してください。

1. モデル。Qwen2.5-Omni-7B · Qwen3-Omni · SALMONN · Audio Flamingo 3 · AF-Next · LTU · GAMA · Gemini 2.5 Pro (API) · GPT-4o Audio (API)。理由を1文で述べる。
2. 検証する benchmark subset。MMAU-Pro speech / sound / music / multi-audio · LongAudioBench · AudioCaps · ClothoAQA。ユーザータスクに合う軸を選ぶ。
3. Output modality。Text-only · text + speech（Qwen-Omni、GPT-4o Audio）。必要なら追加の speech decoder の予算を見込む。
4. Guardrails。モデルの multi-audio score が &lt; 30%（ほぼランダム）なら、multi-audio comparison を必要とするプロンプトを拒否する。&gt; 10-minute inputs では LALM の前に diarize する。
5. Escalation。このタスクを specialized model へフォールバックすべきタイミング。transcription には Whisper、classification には BEATs、diarization には pyannote。LALM は各領域の最良モデルではない。

MMAU-Pro multi-audio subset でモデルが &gt; 40% を出すことを検証せずに、multi-audio comparison task を出荷することは拒否してください。upstream diarization なしの long-audio（&gt; 10 min）は拒否してください。ベンダー報告値を独立した再検証なしで使うデプロイは警告してください。

Example input: "Compliance audit: transcribe 10-minute bank-call recordings + detect if the agent read the mandatory disclosure."

Example output:
- Model: Whisper-large-v3-turbo for transcription + Gemini 2.5 Pro (via API) for disclosure-check QA over the transcript. LALM direct on raw audio is tempting but long-audio LALM accuracy drops past 10 min.
- Benchmark subset: MMAU-Pro speech subset (Gemini 2.5 Pro = 73.4%) — speech-reasoning の軸をカバーする。自社の 50-call gold set でも spot-check する。
- Output modality: text-only. 監査レポートに音声出力は不要。
- Guardrails: 先に pyannote 3.1 で diarize する。話者ごとのセグメントを別々に送る。call ごとに confidence score を記録する。
- Escalation: disclosure check に失敗した call は、自律的なフラグではなく人間の reviewer に回す。
