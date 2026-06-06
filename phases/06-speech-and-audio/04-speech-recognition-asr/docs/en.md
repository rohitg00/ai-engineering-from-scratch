# Speech Recognition (ASR) — CTC, RNN-T, Attention

> Speech recognition is audio classification at every timestep, glued together by a sequence model that knows English and silence. CTC, RNN-T, and attention are the three ways to do it. Pick one and understand why.

**Type:** Build
**Languages:** Python
**Prerequisites:** Phase 6 · 02 (Spectrograms & Mel), Phase 5 · 08 (CNNs & RNNs for Text), Phase 5 · 10 (Attention)
**Time:** ~45 minutes

## The Problem

You have a 10-second 16 kHz clip. You want a string: "turn on the kitchen lights". The challenge is structural: audio frames do not align one-to-one with characters. The word "okay" might take 200 ms or 1200 ms. Silence punctuates the utterance. Some phonemes are longer than others. The number of output tokens is not known in advance.

Three formulations solve this:

1. **CTC (Connectionist Temporal Classification).** Emit per-frame token probabilities including a special *blank*. Collapse repeats and blanks at decode time. Non-autoregressive, fast. Used by wav2vec 2.0, MMS.
2. **RNN-T (Recurrent Neural Network Transducer).** Joint network predicts next token given encoder frame and previous tokens. Streamable. Used by Google's on-device ASR, NVIDIA Parakeet.
3. **Attention encoder-decoder.** Encoder compresses audio to hidden states, decoder cross-attends to generate tokens autoregressively. Used by Whisper, SeamlessM4T.

In 2026, SOTA WER on LibriSpeech test-clean is 1.4% (Parakeet-TDT-1.1B, NVIDIA) and 1.58% (Whisper-Large-v3-turbo). The differences are tiny; the deployment differences are huge.

## The Concept

![Three ASR formulations: CTC, RNN-T, attention-encoder-decoder](../assets/asr-formulations.svg)

**CTC intuition.** Let the encoder output `T` frame-level distributions over `V+1` tokens (V chars + blank). For a target string `y` of length `U < T`, any frame alignment that collapses to `y` counts. CTC loss sums over all such alignments. Inference: per-frame argmax, collapse repeats, remove blanks.

Advantages: non-autoregressive, streamable, zero lookahead. Drawback: *conditional independence assumption* — each frame prediction is independent of the others, so there is no internal language model. Fix with an external LM via beam search or shallow fusion.

**RNN-T intuition.** Adds a *predictor* network that embeds the token history and a *joiner* that combines predictor state with encoder frame into a joint distribution over `V+1` (the `+1` is a null / no-emit). Explicitly models the conditional dependence CTC ignored. Streamable because each step conditions only on past frames and past tokens.

Advantages: streamable + internal LM. Drawback: training is more complex and memory-hungry (3D loss lattice); RNN-T loss kernels are a whole library category on their own.

**Attention encoder-decoder.** Encoder (6-32 transformer layers) over log-mel frames. Decoder (6-32 transformer layers) cross-attends to encoder outputs to generate tokens autoregressively. No alignment constraint — attention can look anywhere in the audio. Non-streamable unless you restrict attention (chunked Whisper-Streaming, 2024).

Advantages: highest quality on offline ASR, easy to train with standard seq2seq tooling. Drawback: autoregressive latency is proportional to output length; cannot stream without engineering.

### WER: the one number

**Word Error Rate** = `(S + D + I) / N`, where S=substitutions, D=deletions, I=insertions, N=reference word count. Matches Levenshtein edit distance at the word level. Lower is better. A WER above 20% is generally unusable; below 5% is human-parity for read speech. 2026 numbers on standard benchmarks:

| Model | LibriSpeech test-clean | LibriSpeech test-other | Size |
|-------|------------------------|------------------------|------|
| Parakeet-TDT-1.1B | 1.40% | 2.78% | 1.1B params |
| Whisper-Large-v3-turbo | 1.58% | 3.03% | 809M |
| Canary-1B Flash | 1.48% | 2.87% | 1B |
| Seamless M4T v2 | 1.7% | 3.5% | 2.3B |

All these are encoder-decoder or RNN-T based. Pure CTC systems (wav2vec 2.0) sit around 1.8–2.1% on test-clean.

## Build It

### Step 1: greedy CTC decode

```python
def ctc_greedy(frame_logits, blank=0, vocab=None):
    # frame_logits: list of per-frame probability vectors
    preds = [max(range(len(p)), key=lambda i: p[i]) for p in frame_logits]
    out = []
    prev = -1
    for p in preds:
        if p != prev and p != blank:
            out.append(p)
        prev = p
    return "".join(vocab[i] for i in out) if vocab else out
```

Two rules: collapse consecutive repeats, drop blanks. Example: `a a _ _ a b b _ c` → `a a b c`.

### Step 2: beam-search CTC

```python
def ctc_beam(frame_logits, beam=8, blank=0):
    import math
    beams = [([], 0.0)]  # (tokens, log_prob)
    for p in frame_logits:
        log_p = [math.log(max(pi, 1e-10)) for pi in p]
        candidates = []
        for seq, lp in beams:
            for t, lpt in enumerate(log_p):
                new = seq[:] if t == blank else (seq + [t] if not seq or seq[-1] != t else seq)
                candidates.append((new, lp + lpt))
        candidates.sort(key=lambda x: -x[1])
        beams = candidates[:beam]
    return beams[0][0]
```

Production uses prefix tree beam search with LM fusion; this is the conceptual skeleton.

### Step 3: WER

```python
def wer(ref, hyp):
    r, h = ref.split(), hyp.split()
    dp = [[0] * (len(h) + 1) for _ in range(len(r) + 1)]
    for i in range(len(r) + 1):
        dp[i][0] = i
    for j in range(len(h) + 1):
        dp[0][j] = j
    for i in range(1, len(r) + 1):
        for j in range(1, len(h) + 1):
            cost = 0 if r[i - 1] == h[j - 1] else 1
            dp[i][j] = min(
                dp[i - 1][j] + 1,
                dp[i][j - 1] + 1,
                dp[i - 1][j - 1] + cost,
            )
    return dp[len(r)][len(h)] / max(1, len(r))
```

### Step 4: inference against Whisper

```python
import whisper
model = whisper.load_model("large-v3-turbo")
result = model.transcribe("clip.wav")
print(result["text"])
```

One-liner for the strongest general ASR in 2026. Runs on a 24 GB GPU at ~20× realtime.

### Step 5: streaming with Parakeet or wav2vec 2.0

```python
from transformers import pipeline
asr = pipeline("automatic-speech-recognition", model="nvidia/parakeet-tdt-1.1b")
for chunk in streaming_audio():
    print(asr(chunk, return_timestamps=True))
```

Streaming ASR needs chunked encoder attention and carryover state; use a library that supports it (NeMo for Parakeet, `transformers` pipeline with `chunk_length_s`).

## Use It

The 2026 stack:

| Situation | Pick |
|-----------|------|
| English, offline, max quality | Whisper-large-v3-turbo |
| Multilingual, robust | SeamlessM4T v2 |
| Streaming, low latency | Parakeet-TDT-1.1B or Riva |
| Edge, mobile, <500 ms latency | Whisper-Tiny quantized or Moonshine (2024) |
| Long-form | Whisper with VAD-based chunking (WhisperX) |
| Domain-specific (medical, legal) | Fine-tune wav2vec 2.0 + domain LM fusion |

## Pitfalls that still ship in 2026

- **No VAD.** Running Whisper on silence produces hallucinations ("Thanks for watching!"). Always gate with VAD.
- **Character vs word vs subword WER.** Report word-level WER *after* normalization (lowercase, punctuation stripped).
- **Language ID drift.** Whisper's auto LID mis-routes noisy clips to Japanese or Welsh; force `language="en"` when you know.
- **Long clips without chunking.** Whisper has a 30-second window. Use `chunk_length_s=30, stride=5` for anything longer.

## Ship It

Save as `outputs/skill-asr-picker.md`. Pick model, decoding strategy, chunking, and LM fusion for a given deployment target.

## Exercises

1. **Easy.** Run `code/main.py`. It greedily decodes a hand-crafted CTC output and computes WER against a reference.
2. **Medium.** Implement the prefix-tree beam search in Step 2 properly (account for the blank merge rule). Compare with greedy on a 10-example synthetic dataset.
3. **Hard.** Use `whisper-large-v3-turbo` on [LibriSpeech test-clean](https://www.openslr.org/12). Compute WER on the first 100 utterances. Compare with published numbers.

## Key Terms

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| CTC | The blank-token loss | Marginal over all frame-to-token alignments; non-AR. |
| RNN-T | The streaming loss | CTC + next-token predictor; handles word-order. |
| Attention enc-dec | Whisper-style | Encoder + cross-attending decoder; best offline quality. |
| WER | The number you report | `(S+D+I)/N` at word level. |
| Blank | The emptiness | Special token in CTC signalling "no emission this frame". |
| LM fusion | External language model | Add weighted LM log-probs during beam search. |
| VAD | The silence gate | Voice activity detector; trims non-speech. |

## Further Reading

- [Graves et al. (2006). Connectionist Temporal Classification](https://www.cs.toronto.edu/~graves/icml_2006.pdf) — the CTC paper.
- [Graves (2012). Sequence Transduction with RNNs](https://arxiv.org/abs/1211.3711) — the RNN-T paper.
- [Radford et al. / OpenAI (2022). Whisper: Robust Speech Recognition via Large-Scale Weak Supervision](https://arxiv.org/abs/2212.04356) — the 2022 canonical paper; v3-turbo extension in 2024.
- [NVIDIA NeMo — Parakeet-TDT card](https://huggingface.co/nvidia/parakeet-tdt-1.1b) — 2026 Open ASR Leaderboard leader.
- [Hugging Face — Open ASR Leaderboard](https://huggingface.co/spaces/hf-audio/open_asr_leaderboard) — live benchmark across 25+ models.
