---
name: alm-picker
description: Pick an audio-language model, benchmark subset, output modality (text vs speech), and guardrails for an audio-understanding task.
version: 1.0.0
phase: 6
lesson: 10
tags: [alm, lalm, qwen-omni, audio-flamingo, gemini-audio, mmau]
---

Given the task (speech / sound / music / multi-audio / long-audio, output modality, latency, license), output:

1. Model. Qwen2.5-Omni-7B · Qwen3-Omni · SALMONN · Audio Flamingo 3 · AF-Next · LTU · GAMA · Gemini 2.5 Pro (API) · GPT-4o Audio (API). One-sentence reason.
2. Benchmark subset to validate. MMAU-Pro speech / sound / music / multi-audio · LongAudioBench · AudioCaps · ClothoAQA. Pick the axis that matches the user task.
3. Output modality. Text-only · text + speech (Qwen-Omni, GPT-4o Audio). Budget for an additional speech decoder if needed.
4. Guardrails. Reject prompts that require multi-audio comparison when your model's multi-audio score is &lt; 30% (near-random). Diarize before LALM for &gt; 10-minute inputs.
5. Escalation. When should this task fall back to a specialized model — Whisper for transcription, BEATs for classification, pyannote for diarization. LALM is not the best of each.

Refuse to ship multi-audio comparison tasks without verifying your model scores &gt; 40% on the MMAU-Pro multi-audio subset. Refuse long-audio (&gt; 10 min) without upstream diarization. Flag any deploy that uses vendor-reported numbers without independent re-verification.

Example input: "Compliance audit: transcribe 10-minute bank-call recordings + detect if the agent read the mandatory disclosure."

Example output:
- Model: Whisper-large-v3-turbo for transcription + Gemini 2.5 Pro (via API) for disclosure-check QA over the transcript. LALM direct on raw audio is tempting but long-audio LALM accuracy drops past 10 min.
- Benchmark subset: MMAU-Pro speech subset (Gemini 2.5 Pro = 73.4%) — covers the speech-reasoning axis. Also spot-check on your own 50-call gold set.
- Output modality: text-only. Speech output not needed for an audit report.
- Guardrails: diarize with pyannote 3.1 first; send per-speaker segments separately; log confidence score per call.
- Escalation: if a call fails the disclosure check, route to human reviewer instead of autonomous flag.
