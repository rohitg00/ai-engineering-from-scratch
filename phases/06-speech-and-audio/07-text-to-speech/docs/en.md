# Text-to-Speech (TTS) — From Tacotron to F5 and Kokoro

> ASR inverts speech to text; TTS inverts text to speech. The 2026 stack is three parts: text → tokens, tokens → mel, mel → waveform. Each part has a default model that fits in a laptop.

**Type:** Build
**Languages:** Python
**Prerequisites:** Phase 6 · 02 (Spectrograms & Mel), Phase 5 · 09 (Seq2Seq), Phase 7 · 05 (Full Transformer)
**Time:** ~75 minutes

## The Problem

You have a string: "Please remind me to water the plants at 6 pm." You need a 3-second audio clip that sounds natural, has correct prosody (pauses, stress), pronounces "plants" with the right vowel, and runs in under 300 ms on a CPU for a live voice assistant. You also need to swap voices, handle code-switched input ("remind me at 6 pm, daijoubu?"), and not embarrass yourself on names.

Modern TTS pipelines look like this:

1. **Text frontend.** Normalize text (dates, numbers, emails), convert to phonemes or subword tokens, predict prosody features.
2. **Acoustic model.** Text → mel spectrogram. Tacotron 2 (2017), FastSpeech 2 (2020), VITS (2021), F5-TTS (2024), Kokoro (2024).
3. **Vocoder.** Mel → waveform. WaveNet (2016), WaveRNN, HiFi-GAN (2020), BigVGAN (2022), neural codec vocoders in 2024+.

In 2026 the acoustic + vocoder split blurs with end-to-end diffusion and flow-matching models. But the mental model of three parts still holds for debugging.

## The Concept

![Tacotron, FastSpeech, VITS, F5/Kokoro side-by-side](../assets/tts.svg)

**Tacotron 2 (2017).** Seq2seq: char-embedding → BiLSTM encoder → location-sensitive attention → autoregressive LSTM decoder emits mel frames. Slow (AR), wobbly on long text. Still cited as a baseline.

**FastSpeech 2 (2020).** Non-autoregressive. Duration predictor outputs how many mel frames each phoneme gets. 1-pass, 10× faster than Tacotron. Loses some naturalness (monotonic alignment) but ships everywhere.

**VITS (2021).** Jointly trains encoder + flow-based duration + HiFi-GAN vocoder end-to-end with variational inference. High quality, single model. Dominant open-source TTS 2022–2024. Variants: YourTTS (multi-speaker zero-shot), XTTS v2 (2024, Coqui).

**F5-TTS (2024).** Diffusion transformer over flow matching. Natural prosody, zero-shot voice cloning with 5 seconds of reference audio. Top of the 2026 open-source TTS leaderboards. 335M params.

**Kokoro (2024).** Small (82M), CPU-runnable, best-in-class English TTS for real-time use. Closed-vocabulary English-only, apache-2.0.

**OpenAI TTS-1-HD, ElevenLabs v2.5, Google Chirp-3.** Commercial state of the art. ElevenLabs v2.5 emotion tags ("[whispered]", "[laughing]") and character voices dominate audiobook production in 2026.

### Vocoder evolution

| Era | Vocoder | Latency | Quality |
|-----|---------|---------|---------|
| 2016 | WaveNet | offline only | SOTA at release |
| 2018 | WaveRNN | ~realtime | good |
| 2020 | HiFi-GAN | 100× realtime | near-human |
| 2022 | BigVGAN | 50× realtime | generalizes across speakers/langs |
| 2024 | SNAC, DAC (neural codecs) | integrated with AR models | discrete tokens, bit-efficient |

By 2026 most "TTS" models are end-to-end from text to waveform; the mel spectrogram is an internal representation.

### Evaluation

- **MOS (Mean Opinion Score).** 1–5 scale, crowd-sourced. Still the gold standard; painfully slow.
- **CMOS (Comparative MOS).** A-vs-B preference. Tighter confidence intervals per annotation.
- **UTMOS, DNSMOS.** Reference-free neural MOS predictors. Used for leaderboards.
- **CER (Character Error Rate) via ASR.** Run TTS output through Whisper, compute CER against the input text. Proxy for intelligibility.
- **SECS (Speaker Embedding Cosine Similarity).** Voice-cloning quality.

2026 numbers on LibriTTS test-clean:

| Model | UTMOS | CER (via Whisper) | Size |
|-------|-------|-------------------|------|
| Ground truth | 4.08 | 1.2% | — |
| F5-TTS | 3.95 | 2.1% | 335M |
| XTTS v2 | 3.81 | 3.5% | 470M |
| VITS | 3.62 | 3.1% | 25M |
| Kokoro v0.19 | 3.87 | 1.8% | 82M |
| Parler-TTS Large | 3.76 | 2.8% | 2.3B |

## Build It

### Step 1: phonemize input

```python
from phonemizer import phonemize
ph = phonemize("Hello world", language="en-us", backend="espeak")
# 'həloʊ wɜːld'
```

Phonemes are the universal bridge. Avoid feeding raw text to anything below VITS-level quality.

### Step 2: run Kokoro (2026 CPU default)

```python
from kokoro import KPipeline
tts = KPipeline(lang_code="a")  # "a" = American English
audio, sr = tts("Please remind me to water the plants at 6 pm.", voice="af_bella")
# audio: float32 tensor, sr=24000
```

Runs offline, single file, 82M params.

### Step 3: run F5-TTS with voice cloning

```python
from f5_tts.api import F5TTS
tts = F5TTS()
wav = tts.infer(
    ref_file="my_voice_5s.wav",
    ref_text="The quick brown fox jumps over the lazy dog.",
    gen_text="Please remind me to water the plants.",
)
```

Pass a 5-second reference clip + its transcript; F5 clones prosody and timbre.

### Step 4: HiFi-GAN vocoder from scratch

Too big to fit in a tutorial script, but the shape is:

```python
class HiFiGAN(nn.Module):
    def __init__(self, mel_channels=80, upsample_rates=[8, 8, 2, 2]):
        super().__init__()
        # 4 upsample blocks, total 256x to go from mel-rate to audio-rate
        ...
    def forward(self, mel):
        return self.blocks(mel)  # -> waveform
```

Training: adversarial (discriminator on short windows) + mel-spectrogram reconstruction loss + feature-matching loss. Commoditized — use pretrained checkpoints from `hifi-gan` repo or nvidia-NeMo.

### Step 5: the full pipeline (pseudocode)

```python
text = "Please remind me at 6 pm."
phones = phonemize(text)
mel = acoustic_model(phones, speaker=alice)      # [T, 80]
wav = vocoder(mel)                                # [T * 256]
soundfile.write("out.wav", wav, 24000)
```

## Use It

The 2026 stack:

| Situation | Pick |
|-----------|------|
| Real-time English voice assistant | Kokoro (CPU) or XTTS v2 (GPU) |
| Voice cloning from 5 s reference | F5-TTS |
| Commercial character voices | ElevenLabs v2.5 |
| Audiobook narration | ElevenLabs v2.5 or XTTS v2 + fine-tune |
| Low-resource language | Train VITS on 5–20 h target-lang data |
| Expressive / emotion tags | ElevenLabs v2.5 or StyleTTS 2 fine-tune |

Open-source leader as of 2026: **F5-TTS for quality, Kokoro for efficiency**. Don't reach for Tacotron unless you are a historian.

## Pitfalls

- **No text normalizer.** "Dr. Smith" reads as "Doctor" or "Drive"? "2026" as "twenty twenty six" or "two zero two six"? Normalize BEFORE phonemizer.
- **OOV proper nouns.** "Ghumare" → "ghyu-mair"? Ship a fallback grapheme-to-phoneme model for unknown tokens.
- **Clipping.** Vocoder output rarely clips, but mel scaling mismatch at inference can overshoot ±1.0. Always `np.clip(wav, -1, 1)`.
- **Sample-rate mismatch.** Kokoro outputs 24 kHz; your downstream pipeline expects 16 kHz → resample or get aliasing.

## Ship It

Save as `outputs/skill-tts-designer.md`. Design a TTS pipeline for a given voice, latency, and language target.

## Exercises

1. **Easy.** Run `code/main.py`. Builds a phoneme dictionary from a toy vocab, estimates duration per phoneme, and prints a fake "mel" schedule.
2. **Medium.** Install Kokoro, synthesize the same sentence at voice `af_bella` and `am_adam`. Compare audio durations and subjective quality.
3. **Hard.** Record a 5-second reference clip of yourself. Use F5-TTS to clone it. Report SECS between reference and cloned output.

## Key Terms

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Phoneme | Sound unit | Abstract sound class; 39 in English (ARPABet). |
| Duration predictor | How long each phoneme lasts | Non-AR model output; integer frames per phoneme. |
| Vocoder | Mel → waveform | Neural net mapping mel-spec to raw samples. |
| HiFi-GAN | Standard vocoder | GAN-based; dominant 2020–2024. |
| MOS | Subjective quality | 1–5 mean opinion score from human raters. |
| SECS | Voice-clone metric | Cosine similarity between target and output speaker embedding. |
| F5-TTS | 2024 open-source SOTA | Flow-matching diffusion; zero-shot cloning. |
| Kokoro | CPU English leader | 82M-param model, Apache 2.0. |

## Further Reading

- [Shen et al. (2017). Tacotron 2](https://arxiv.org/abs/1712.05884) — the seq2seq baseline.
- [Kim, Kong, Son (2021). VITS](https://arxiv.org/abs/2106.06103) — end-to-end flow-based.
- [Chen et al. (2024). F5-TTS](https://arxiv.org/abs/2410.06885) — current open-source SOTA.
- [Kong, Kim, Bae (2020). HiFi-GAN](https://arxiv.org/abs/2010.05646) — the vocoder that still ships in 2026.
- [Kokoro-82M on HuggingFace](https://huggingface.co/hexgrad/Kokoro-82M) — 2024 CPU-friendly English TTS.
