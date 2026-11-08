---
id: audio-features
title: Audio Features, Classification and Metrics
code: AF
subtitle: Sample, frame, window, mel, MFCC, classify and score audio. Stdlib Python from the lessons.
hue: 25
sources: phases/06-speech-and-audio/01-audio-fundamentals, phases/06-speech-and-audio/02-spectrograms-mel-features, phases/06-speech-and-audio/03-audio-classification, phases/06-speech-and-audio/17-audio-evaluation-metrics
source_hash: bfd4e5e3ac478c89
---

## Waveform to label
type: architecture
from: phases/06-speech-and-audio/02-spectrograms-mel-features/docs/en.md, phases/06-speech-and-audio/03-audio-classification/docs/en.md, phases/06-speech-and-audio/03-audio-classification/code/main.py

```arch
node | wav | 1,1 | Waveform | floats in [-1, 1] | client
node | frame | 2,1 | Frames | 400 samples, hop 160 | process
node | stft | 3,1 | STFT | Hann window, FFT | process
node | mel | 4,1 | Mel filterbank | 80 triangles | process
node | log | 4,2 | Log-mel | Whisper input | store
node | mfcc | 3,2 | MFCC | DCT-II, keep 13 | process
node | pool | 2,2 | Pool | mean + var, 26 dims | process
node | clf | 1,2 | Classifier | k-NN, CNN, AST, BEATs | model
edge | wav | frame |
edge | frame | stft |
edge | stft | mel | magnitude
edge | mel | log | log
edge | log | mfcc | DCT
edge | mfcc | pool |
edge | pool | clf | cosine
```

## Formulas
type: concepts
from: phases/06-speech-and-audio/01-audio-fundamentals/docs/en.md, phases/06-speech-and-audio/02-spectrograms-mel-features/docs/en.md, phases/06-speech-and-audio/03-audio-classification/docs/en.md

- **Time**: $t = n / sr$. A 10 s clip at 16 kHz is 160,000 floats.
- **Nyquist**: $sr / 2$. Energy above it aliases to lower bins.
- **Alias**: a 7 kHz tone sampled at 10 kHz folds to $10 - 7 = 3$ kHz.
- **Bin**: bin $k$ is $k \cdot sr / N$ Hz. Resolution is $sr / N$.
- **Mel**: $m = 2595 \cdot \log_{10}(1 + f / 700)$
- **Hann**: $w(n) = 0.5 (1 - \cos(2 \pi n / (N - 1)))$
- **Frames**: $1 + (T - L) / hop$. 10 s at 16 kHz gives 998 frames.
- **Mixup**: $x = \lambda x_1 + (1 - \lambda) x_2$, same for $y$.

## Feature defaults
type: defaults
from: phases/06-speech-and-audio/02-spectrograms-mel-features/docs/en.md, phases/06-speech-and-audio/01-audio-fundamentals/docs/en.md

| Setting | Default | Note |
|---|---|---|
| Frame length | 400 | 25 ms at 16 kHz |
| Hop | 160 | 10 ms at 16 kHz |
| Window | Hann | Tapers frame edges to zero |
| Mel bins, ASR | 80 | Cover 0 to 8 kHz |
| Mel bins, classification | 128 | AST, PANNs, BEATs |
| MFCC count | 13 | Drop coefficient 0, it is energy |
| Log floor `eps` | 1e-10 | log(mel_spec + 1e-10) |
| Keyword spotting | 40 MFCCs | For tiny devices |

## Tasks in code
type: task-table
from: phases/06-speech-and-audio/01-audio-fundamentals/code/main.py, phases/06-speech-and-audio/02-spectrograms-mel-features/code/main.py, phases/06-speech-and-audio/03-audio-classification/code/main.py

| Task | Code |
|---|---|
| Synthesize a tone | `sine(freq_hz, sr, seconds, amp=0.5)` |
| Find the dominant frequency | `peak_freq(samples, sr)` |
| Frame a signal | `frame_signal(signal, frame_len, hop)` |
| STFT magnitude | `stft_magnitude(signal, frame_len, hop)` |
| Mel filterbank | `mel_filterbank(n_mels, n_fft, sr)` |
| Log-mel | `log_transform(mel_spec, eps=1e-10)` |
| MFCC | `dct_ii(x, n_coeffs)` |
| k-NN vote | `knn(q, bank, labels, k=3)` |

## MFCC k-NN baseline
type: annotated-code
lang: python
from: phases/06-speech-and-audio/03-audio-classification/code/main.py

```python
sr = 8000                                   # demo rate in the code
mag = stft_mag(signal, frame_len, hop)      # Hann, then DFT per frame
fb = mel_filterbank(n_mels, frame_len, sr)  # n_mels x (n_fft // 2 + 1)
mels = apply_filterbank(mag, fb)            # weighted sum per mel bin
lm = log_transform(mels)                    # log(max(v, eps))
feats = [dct_ii(f, n_mfcc) for f in lm]     # 13 coefficients per frame
emb = summarize(feats)                      # mean + var, 26 dims
pred = knn(emb, X_train, y_train, k=3)      # cosine top k, majority vote
```

## Score a model
type: annotated-code
lang: python
from: phases/06-speech-and-audio/17-audio-evaluation-metrics/docs/en.md
span: 2

```python
from jiwer import wer, Compose, ToLowerCase, RemovePunctuation, Strip
transform = Compose([ToLowerCase(), RemovePunctuation(), Strip()])
score = wer(truth="Please turn on the lights.", hypothesis="please turn on the light",
            truth_transform=transform, hypothesis_transform=transform)
sv = EncoderClassifier.from_hparams("speechbrain/spkrec-ecapa-voxceleb")
secs = torch.nn.functional.cosine_similarity(emb_ref, emb_clone, dim=-1).item()  # SECS
fad = FrechetAudioDistance()
score = fad.get_fad_score("generated_folder/", "reference_folder/")  # lower is better
```

## Libraries
type: command-table
from: phases/06-speech-and-audio/01-audio-fundamentals/docs/en.md, phases/06-speech-and-audio/02-spectrograms-mel-features/docs/en.md, phases/06-speech-and-audio/03-audio-classification/docs/en.md, phases/06-speech-and-audio/17-audio-evaluation-metrics/docs/en.md

| Command | What it does |
|---|---|
| `soundfile` | Reads WAV, FLAC, OGG as float32 |
| `torchaudio.transforms.Resample` | Resamples with anti-aliasing built in |
| `numpy.fft.rfft` | Real FFT for real audio |
| `torch.stft` | Vectorized STFT |
| `librosa.power_to_db` | Reference-normalized dB |
| `ffprobe` | Reports sr, channels and codec of a file |
| `jiwer` | WER and CER with normalization |
| `ASTForAudioClassification.from_pretrained` | Loads AST to fine-tune |

## Pick a classifier
type: concepts
from: phases/06-speech-and-audio/03-audio-classification/docs/en.md

- **Under 1000 clips**: k-NN on MFCC means plus audio augmentation.
- **1K to 100K clips**: BEATs or AST fine-tune.
- **Over 100K clips**: train from scratch or fine-tune Whisper-encoder.
- **Real-time, edge**: 40-MFCC CNN, quantized to int8.
- **Multi-label**: BEATs-iter3 with BCE loss, mixup and SpecAugment.
- **Exclusive classes**: report top-1 and top-5 accuracy.
- **Imbalanced classes**: report per-class recall and macro F1.

## Metrics
type: glossary
from: phases/06-speech-and-audio/17-audio-evaluation-metrics/docs/en.md

- **WER**: Word Error Rate. (S + D + I) / N after normalization.
- **CER**: Character Error Rate. For tone languages.
- **RTFx**: audio seconds per wall-clock second. Higher is better.
- **MOS**: Mean Opinion Score. 1 to 5, 20+ listeners, 100+ samples.
- **UTMOS**: learned MOS predictor. Correlates ~0.9 with human MOS.
- **SECS**: ECAPA cosine of reference and clone. Above 0.75 is recognizable.
- **EER**: threshold where FAR equals FRR. ECAPA on VoxCeleb1-O: 0.87%.
- **DER**: (FA + Miss + Confusion) / total speaker time.
- **FAD**: Fréchet distance on VGGish embeddings. Lower is better.

## Troubleshooting
type: troubleshooting
from: phases/06-speech-and-audio/01-audio-fundamentals/docs/en.md, phases/06-speech-and-audio/02-spectrograms-mel-features/docs/en.md, phases/06-speech-and-audio/17-audio-evaluation-metrics/docs/en.md

| Symptom | Cause | Fix |
|---|---|---|
| Garbage that looks like a model bug | 44.1 kHz stereo into Whisper | Resample to 16 kHz mono float32 |
| FFT peak at a false frequency | Energy above Nyquist aliased | Low-pass filter before downsampling |
| Silent failure after deploy | 80 mels in training, 128 at inference | Log the feature shape at both ends |
| Mels look different | Featurized at 22.05 kHz | Fix SR before featurization |
| Whisper input looks wrong | dB-mel, not log-mel | Feed log-mel. Custom code does not autodetect |
| WER doubles in production | Per-utterance norm in training, global at inference | Use the same normalization |
| Flat trailing frames | Zero-padding at the clip end | Pad symmetrically or replicate |
| 5% WER hides 30% on accents | Aggregate WER | Report by demographic slice |

## Questions
type: qa
from: phases/06-speech-and-audio/02-spectrograms-mel-features/docs/en.md, phases/06-speech-and-audio/01-audio-fundamentals/docs/en.md, phases/06-speech-and-audio/17-audio-evaluation-metrics/docs/en.md

- **Why mel, not Hz?** Humans hear pitch on a log scale.
- **Why a window?** It removes spectral leakage at the frame edges.
- **Why log-magnitude?** Raw magnitudes span 5-6 orders of magnitude.
- **Bigger FFT?** Better frequency resolution. Worse time resolution.
- **Why FFT, not DFT?** The DFT is O(N²). The FFT is O(N log N).
- **Why minDCF?** It weights cost at a chosen operating point.

## Tips
type: tips
from: phases/06-speech-and-audio/01-audio-fundamentals/docs/en.md, phases/06-speech-and-audio/02-spectrograms-mel-features/docs/en.md, phases/06-speech-and-audio/03-audio-classification/docs/en.md, phases/06-speech-and-audio/17-audio-evaluation-metrics/docs/en.md

- Match sample rate before you match anything else.
- If you are not working on music, start with 80 log-mels.
- Start with a frozen backbone, not a fresh model.
- Use balanced sampling in training, not in evaluation.
- Normalize text before you score WER. Report the rule.
- Report P50/P95/P99 for latency.
- Keep an in-house held-out set. Public benchmarks saturate.
