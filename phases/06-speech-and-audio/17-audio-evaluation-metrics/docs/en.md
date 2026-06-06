# Audio Evaluation — WER, MOS, UTMOS, MMAU, FAD, and the Open Leaderboards

> You cannot ship what you cannot measure. This lesson names the 2026 metrics for every audio task: ASR (WER, CER, RTFx), TTS (MOS, UTMOS, SECS, WER-on-ASR-round-trip), audio-language (MMAU, LongAudioBench), music (FAD, CLAP), and speaker (EER). Plus the leaderboards where you compare.

**Type:** Learn
**Languages:** Python
**Prerequisites:** Phase 6 · 04, 06, 07, 09, 10; Phase 2 · 09 (Model Evaluation)
**Time:** ~60 minutes

## The Problem

Every audio task has multiple metrics, each measuring a different axis. Using the wrong metric is how you ship a model that looks great on your dashboard and terribly in production. The 2026 canonical list:

| Task | Primary | Secondary |
|------|---------|-----------|
| ASR | WER | CER · RTFx · first-token latency |
| TTS | MOS / UTMOS | SECS · WER-on-ASR-round-trip · CER · TTFA |
| Voice cloning | SECS (ECAPA cosine) | MOS · CER |
| Speaker verification | EER | minDCF · FAR / FRR at operating point |
| Diarization | DER | JER · speaker confusion |
| Audio classification | top-1 · mAP | macro F1 · per-class recall |
| Music generation | FAD | CLAP · listening panel MOS |
| Audio language model | MMAU-Pro | LongAudioBench · AudioCaps FENSE |
| Streaming S2S | latency P50/P95 | WER · MOS |

## The Concept

![Audio evaluation matrix — metrics vs tasks vs 2026 leaderboards](../assets/eval-landscape.svg)

### ASR metrics

**WER (Word Error Rate).** `(S + D + I) / N`. Lowercase, strip punctuation, normalize numbers before scoring. Use `jiwer` or OpenAI's `whisper_normalizer`. &lt; 5% = human-parity read speech.

**CER (Character Error Rate).** Same formula, character-level. Used for tone languages (Mandarin, Cantonese) where word segmentation is ambiguous.

**RTFx (inverse real-time factor).** Audio seconds processed per wall-clock second. Higher is better. Parakeet-TDT hits 3380×. Whisper-large-v3 is ~30×.

**First-token latency.** Wall-clock from audio input to first transcript token. Critical for streaming. Deepgram Nova-3: ~150 ms.

### TTS metrics

**MOS (Mean Opinion Score).** 1-5 human rating. Gold standard but slow. Collect 20+ listeners per sample, 100+ samples per model.

**UTMOS (2022-2026).** Learned MOS predictor. Correlates ~0.9 with human MOS on standard benchmarks. F5-TTS: UTMOS 3.95; ground truth: 4.08.

**SECS (Speaker Encoder Cosine Similarity).** For voice cloning. ECAPA embedding cosine between reference and cloned output. &gt; 0.75 = recognizable clone.

**WER-on-ASR-round-trip.** Run Whisper over TTS output, compute WER against the input text. Catches intelligibility regressions. 2026 SOTA: &lt; 2% CER.

**TTFA (time-to-first-audio).** Wall-clock latency. Kokoro-82M: ~100 ms; F5-TTS: ~1 s.

### Voice-cloning-specific

**SECS + MOS + CER** as a triple. Cloning that scores high SECS but low MOS means timbre-right-but-unnatural; the opposite means natural voice but wrong speaker.

### Speaker verification

**EER (Equal Error Rate).** The threshold where False Accept Rate equals False Reject Rate. ECAPA on VoxCeleb1-O: 0.87%.

**minDCF (min Detection Cost).** Weighted cost at a chosen operating point (often FAR=0.01). More production-relevant than EER.

### Diarization

**DER (Diarization Error Rate).** `(FA + Miss + Confusion) / total_speaker_time`. Missed speech + false-alarm speech + speaker-confusion, each as a fraction. AMI meetings: DER ~10-20% is realistic. pyannote 3.1 + Precision-2 commercial: &lt;10% DER on well-recorded audio.

**JER (Jaccard Error Rate).** Alternative to DER, robust to short-segment bias.

### Audio classification

Multi-label: **mAP (mean Average Precision)** over all classes. AudioSet: 0.548 mAP for BEATs-iter3.

Multi-class exclusive: **top-1, top-5 accuracy**. Speech Commands v2: 99.0% top-1 (Audio-MAE).

Imbalanced: **macro F1** + **per-class recall**. Report per-class — aggregate accuracy hides which classes fail.

### Music generation

**FAD (Fréchet Audio Distance).** Distance between VGGish-embedding distributions of real vs generated audio. MusicGen-small on MusicCaps: 4.5. MusicLM: 4.0. Lower better.

**CLAP Score.** Text-audio alignment score using CLAP embeddings. &gt; 0.3 = reasonable alignment.

**Listening panel MOS.** Still the final word for consumer-grade music. Suno v5 ELO 1293 on TTS Arena (from paired human preferences).

### Audio-language benchmarks

**MMAU (Massive Multi-Audio Understanding).** 10k audio-QA pairs.

**MMAU-Pro.** 1800 hard items, four categories: speech / sound / music / multi-audio. Random chance 25% on 4-way. Gemini 2.5 Pro overall ~60%; multi-audio ~22% across all models.

**LongAudioBench.** Multi-minute clips with semantic queries. Audio Flamingo Next beats Gemini 2.5 Pro.

**AudioCaps / Clotho.** Captioning benchmarks. SPICE, CIDEr, FENSE metrics.

### Streaming speech-to-speech

**Latency P50 / P95 / P99.** Wall-clock from end-of-user-speech to first audible response. Moshi: 200 ms; GPT-4o Realtime: 300 ms.

**WER / MOS** on the output.

**Barge-in responsiveness.** Time from user interrupt to assistant mute. Target &lt; 150 ms.

### The 2026 leaderboards

| Leaderboard | Tracks | URL |
|------------|--------|-----|
| Open ASR Leaderboard (HF) | English + multilingual + long-form | `huggingface.co/spaces/hf-audio/open_asr_leaderboard` |
| TTS Arena (HF) | English TTS | `huggingface.co/spaces/TTS-AGI/TTS-Arena` |
| Artificial Analysis Speech | TTS + STT, ELO from paired votes | `artificialanalysis.ai/speech` |
| MMAU-Pro | LALM reasoning | `mmaubenchmark.github.io` |
| SpeakerBench / VoxSRC | Speaker recognition | `voxsrc.github.io` |
| MMAU music subset | Music LALM | (within MMAU) |
| HEAR benchmark | Self-supervised audio | `hearbenchmark.com` |

## Build It

### Step 1: WER with normalization

```python
from jiwer import wer, Compose, ToLowerCase, RemovePunctuation, Strip

transform = Compose([ToLowerCase(), RemovePunctuation(), Strip()])
score = wer(
    truth="Please turn on the lights.",
    hypothesis="please turn on the light",
    truth_transform=transform,
    hypothesis_transform=transform,
)
# ~0.17
```

### Step 2: TTS round-trip WER

```python
def ttr_wer(tts_model, asr_model, texts):
    errors = []
    for txt in texts:
        audio = tts_model.synthesize(txt)
        recog = asr_model.transcribe(audio)
        errors.append(wer(truth=txt, hypothesis=recog))
    return sum(errors) / len(errors)
```

### Step 3: SECS for voice cloning

```python
from speechbrain.inference.speaker import EncoderClassifier
sv = EncoderClassifier.from_hparams("speechbrain/spkrec-ecapa-voxceleb")

emb_ref = sv.encode_batch(load_wav("reference.wav"))
emb_clone = sv.encode_batch(load_wav("cloned.wav"))
secs = torch.nn.functional.cosine_similarity(emb_ref, emb_clone, dim=-1).item()
```

### Step 4: FAD for music generation

```python
from frechet_audio_distance import FrechetAudioDistance
fad = FrechetAudioDistance()
score = fad.get_fad_score("generated_folder/", "reference_folder/")
```

### Step 5: EER for speaker verification (same code as Lesson 6)

```python
def eer(same_scores, diff_scores):
    thresholds = sorted(set(same_scores + diff_scores))
    best = (1.0, 0.0)
    for t in thresholds:
        far = sum(1 for s in diff_scores if s >= t) / len(diff_scores)
        frr = sum(1 for s in same_scores if s < t) / len(same_scores)
        if abs(far - frr) < best[0]:
            best = (abs(far - frr), (far + frr) / 2)
    return best[1]
```

## Use It

Pair every deploy with a fixed eval harness that runs on every model update. Three cardinal rules:

1. **Normalize before scoring.** Lowercase, punctuation-strip, number-expand. Report the normalization rule.
2. **Report distributions, not averages.** P50/P95/P99 for latency. Per-class recall for classification. Per-category for MMAU.
3. **Run one canonical public benchmark.** Even if your production data differs, reporting on Open ASR / TTS Arena / MMAU lets reviewers compare apples-to-apples.

## Pitfalls

- **UTMOS extrapolation.** Trained on VCTK-style clean speech; scores noisy / cloned / emotional audio poorly.
- **MOS panel bias.** 20 Amazon Mechanical Turk workers ≠ 20 target users. Pay for a domain panel if stakes are high.
- **FAD depends on reference set.** Compare against the same reference distribution across models.
- **Aggregate WER.** A 5% WER overall can hide 30% WER on accented speech. Report by demographic slice.
- **Public benchmark saturation.** Most frontier models are near the ceiling on standard benchmarks. Build an in-house held-out set that reflects your traffic.

## Ship It

Save as `outputs/skill-audio-evaluator.md`. Pick metrics, benchmarks, and reporting format for any audio model release.

## Exercises

1. **Easy.** Run `code/main.py`. Compute WER / CER / EER / SECS / FAD-ish / MMAU-ish on toy inputs.
2. **Medium.** Build a TTS round-trip WER harness. Run your Kokoro or F5-TTS output through Whisper. Compute WER over 50 prompts. Flag prompts with WER &gt; 10%.
3. **Hard.** Score your Lesson 10 LALM choice on MMAU-Pro speech + multi-audio subsets (50 items each). Report per-category accuracy and compare with the published number.

## Key Terms

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| WER | ASR score | `(S+D+I)/N` at word level after normalization. |
| CER | Character WER | For tone languages or char-level systems. |
| MOS | Human opinion | 1-5 rating; 20+ listeners × 100 samples. |
| UTMOS | ML MOS predictor | Learned model; correlates ~0.9 with human MOS. |
| SECS | Voice-clone similarity | ECAPA cosine between reference and clone. |
| EER | Speaker verif score | Threshold where FAR = FRR. |
| DER | Diarization score | (FA + Miss + Confusion) / total. |
| FAD | Music-gen quality | Fréchet distance on VGGish embeddings. |
| RTFx | Throughput | Audio seconds per wall-clock second. |

## Further Reading

- [jiwer](https://github.com/jitsi/jiwer) — WER/CER library with normalization utilities.
- [UTMOS (Saeki et al. 2022)](https://arxiv.org/abs/2204.02152) — learned MOS predictor.
- [Fréchet Audio Distance (Kilgour et al. 2019)](https://arxiv.org/abs/1812.08466) — the music-gen standard.
- [Open ASR Leaderboard](https://huggingface.co/spaces/hf-audio/open_asr_leaderboard) — 2026 live rankings.
- [TTS Arena](https://huggingface.co/spaces/TTS-AGI/TTS-Arena) — human-vote TTS leaderboard.
- [MMAU-Pro benchmark](https://mmaubenchmark.github.io/) — LALM reasoning leaderboard.
- [HEAR benchmark](https://hearbenchmark.com/) — audio SSL benchmarks.
