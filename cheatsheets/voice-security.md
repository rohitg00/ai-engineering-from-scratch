---
id: voice-security
title: Speaker Verification, Spoofing and Watermarks
code: SV
subtitle: Enroll, score and threshold speakers, detect spoofed audio, and mark every generation with a watermark and C2PA.
hue: 0
sources: phases/06-speech-and-audio/06-speaker-recognition-verification, phases/06-speech-and-audio/16-anti-spoofing-audio-watermarking, phases/18-ethics-safety-alignment/23-watermarking-synthid-stable-signature-c2pa
source_hash: 724639f70381c5ae
---

## Verify and mark
type: architecture
from: phases/06-speech-and-audio/06-speaker-recognition-verification/docs/en.md, phases/06-speech-and-audio/16-anti-spoofing-audio-watermarking/docs/en.md

```arch
node | test | 1,1 | Test utterance | 3 s or more | client
node | cm | 2,1 | Countermeasure | AASIST or RawNet2 | model
node | emb | 3,1 | Speaker encoder | ECAPA-TDNN, 192-d | model
node | score | 4,1 | Cosine score | threshold from a dev set | process
node | gen | 1,2 | TTS output | every generation | model
node | wm | 2,2 | AudioSeal | 16-bit payload | process
node | c2pa | 3,2 | C2PA manifest | signed metadata | store
node | enr | 4,2 | Enrollment | 3 to 5 clean clips, mean | store
edge | test | cm | real or fake
edge | cm | emb | real
edge | emb | score |
edge | enr | score | anchor
edge | gen | wm |
edge | wm | c2pa | sign
```

## Tasks in code
type: task-table
from: phases/06-speech-and-audio/06-speaker-recognition-verification/docs/en.md, phases/06-speech-and-audio/16-anti-spoofing-audio-watermarking/docs/en.md, phases/18-ethics-safety-alignment/23-watermarking-synthid-stable-signature-c2pa/code/main.py
span: 2

| Task | Code |
|---|---|
| Verify a speaker | `verify(enroll, test, threshold=0.75)` |
| EER and its threshold | `eer(same_scores, diff_scores)` |
| Diarize a meeting | `Pipeline.from_pretrained("pyannote/speaker-diarization-3.1")` |
| Load the watermark generator | `AudioSeal.load_generator("audioseal_wm_16bits")` |
| Detect a watermark | `detector.detect_watermark(watermarked, sample_rate=16000)` |
| Toy spoof feature | `spectral_rolloff(spec, percentile=0.85)` |
| Toy text watermark | `watermarked_sample(n, seed_prefix, bias=0.9)` |
| Green-token z-score | `detect(tokens)` |

## Verify with ECAPA
type: annotated-code
lang: python
from: phases/06-speech-and-audio/06-speaker-recognition-verification/docs/en.md

```python
from speechbrain.pretrained import EncoderClassifier
clf = EncoderClassifier.from_hparams(source="speechbrain/spkrec-ecapa-voxceleb")
enroll = torch.stack([clf.encode_batch(load(x))           # 3-5 clean samples
                      for x in enrollment_clips]).mean(0)  # average them
score = clf.similarity(enroll, clf.encode_batch(load("test.wav"))).item()
verdict = score > 0.25                                     # tune on your data
```

## Embed and detect AudioSeal
type: annotated-code
lang: python
from: phases/06-speech-and-audio/16-anti-spoofing-audio-watermarking/docs/en.md

```python
generator = AudioSeal.load_generator("audioseal_wm_16bits")
detector = AudioSeal.load_detector("audioseal_detector_16bits")
audio = load_wav("generated.wav", sr=16000)[None, None, :]
payload = torch.tensor([[1, 0, 1, 1, 0, 1, 0, 0, 1, 1, 0, 1, 0, 1, 1, 0]])
watermark = generator.get_watermark(audio, sample_rate=16000, message=payload)
watermarked = audio + watermark
result, decoded_payload = detector.detect_watermark(watermarked, sample_rate=16000)
```

## Ship a generation
type: flow
from: phases/06-speech-and-audio/16-anti-spoofing-audio-watermarking/docs/en.md

1. **Consent**: with a clone reference, `verify_consent(user_id, clone_reference)` first.
2. **Synthesize**: `tts_model.synthesize(text, voice)`.
3. **Watermark**: `audioseal_embed(audio, payload=build_payload(user_id, model_id))`.
4. **Sign**: `c2pa_sign(audio_with_wm, user_id, timestamp=now())` gives the manifest.
5. **Log**: keep a retention-policy-compliant audit log.
6. **Check**: run the detector in your CI.

## Formulas
type: concepts
from: phases/06-speech-and-audio/06-speaker-recognition-verification/docs/en.md, phases/18-ethics-safety-alignment/23-watermarking-synthid-stable-signature-c2pa/docs/en.md, phases/18-ethics-safety-alignment/23-watermarking-synthid-stable-signature-c2pa/code/main.py, phases/06-speech-and-audio/16-anti-spoofing-audio-watermarking/docs/en.md

- **EER**: the threshold where False Accept Rate equals False Reject Rate.
- **AAM-softmax**: $\cos(\theta + m)$ for the correct class. Typical $m = 0.2$, $s = 30$.
- **Verification**: 1:1. Identification: 1:N. Open-set: unenrolled speakers in the test set.
- **Green list**: hash the previous K tokens, add $\delta$ to green logits.
- **z-score**: (green count - expected) / $\sqrt{n p (1 - p)}$, $p = 0.5$.
- **Bit Recovery Accuracy**: fraction of payload bits recovered after an attack.

## Watermark families
type: concepts
from: phases/06-speech-and-audio/16-anti-spoofing-audio-watermarking/docs/en.md, phases/18-ethics-safety-alignment/23-watermarking-synthid-stable-signature-c2pa/docs/en.md

- **AudioSeal**: localized, per frame. Survives MP3, AAC, EQ, ±10% speed, +10 dB SNR noise.
- **WavMark**: 32 bits/sec. Gaussian noise or MP3 compression removes it.
- **WaveVerify**: FiLM generator, Mixture-of-Experts detector. Handles reversal and speed.
- **Stable Signature**: fine-tuned image decoder. Decoder fine-tuning removes it.
- **SynthID-text**: biased next-token sampling. Paraphrase destroys it.
- **Pitch shift**: Bit Recovery Accuracy below 0.6 for all watermarks.

## Numbers
type: defaults
from: phases/06-speech-and-audio/06-speaker-recognition-verification/docs/en.md, phases/06-speech-and-audio/16-anti-spoofing-audio-watermarking/docs/en.md, phases/18-ethics-safety-alignment/23-watermarking-synthid-stable-signature-c2pa/code/main.py

| Setting | Default | Note |
|---|---|---|
| ECAPA embedding | 192-d | WavLM-large is 256-d |
| ECAPA threshold | 0.25 | SpeechBrain typical, tune it |
| Enrollment samples | 3-5 | Clean samples, averaged |
| ECAPA on VoxCeleb1-O | 0.87% | EER, 15 M params |
| ASVspoof 5 SOTA | ~7.23% | EER. In the wild expect 5-10% |
| AudioSeal payload | 16-bit | Per-frame at 16 kHz |
| AudioSeal detector | 485× realtime | 1000× faster than WavMark |
| Text watermark z | 4 | z >= 4 is very strong evidence |

## Abbreviations
type: glossary
from: phases/06-speech-and-audio/06-speaker-recognition-verification/docs/en.md, phases/06-speech-and-audio/16-anti-spoofing-audio-watermarking/docs/en.md, phases/18-ethics-safety-alignment/23-watermarking-synthid-stable-signature-c2pa/docs/en.md

- **ECAPA-TDNN**: 1D conv, squeeze-excitation, attention pooling to 192-d.
- **PLDA**: Probabilistic LDA. Likelihood-ratio scoring on top of cosine.
- **AS-norm**: normalizes each score against an imposter cohort.
- **CM**: countermeasure. Real speech or synthetic.
- **SASV**: speaker verification plus CM in one biometric system.
- **AASIST**: graph attention on spectral features. Anti-spoofing SOTA.
- **C2PA**: cryptographically signed, tamper-evident provenance metadata.
- **SynthID**: watermark for text, image, audio and video.

## Troubleshooting
type: troubleshooting
from: phases/06-speech-and-audio/06-speaker-recognition-verification/docs/en.md, phases/06-speech-and-audio/16-anti-spoofing-audio-watermarking/docs/en.md, phases/18-ethics-safety-alignment/23-watermarking-synthid-stable-signature-c2pa/docs/en.md

| Symptom | Cause | Fix |
|---|---|---|
| EER rises on phone calls | Trained on VoxCeleb web video | Evaluate on the target channel |
| EER degrades sharply | Test audio under 3 seconds | Get longer test audio |
| Anchor fails for one speaker | One noisy enrollment | Average 3 or more clean samples |
| Magnitude dominates the score | Embeddings not normalized | L2-normalize first |
| Detector fails in the real world | AASIST overfits ASVspoof LA | Calibrate on your domain |
| Watermark gone after an edit | Aggressive pitch shift | Keep a detection fallback |
| Manifest missing on a rehost | Metadata strip and re-encode | Add a watermark too |
| Text watermark gone | Paraphrase | Do not rely on it alone |

## Use X when
type: tips
from: phases/06-speech-and-audio/06-speaker-recognition-verification/docs/en.md, phases/06-speech-and-audio/16-anti-spoofing-audio-watermarking/docs/en.md

- Closed-set 1:1 on edge: ECAPA-TDNN plus a cosine threshold.
- Open-set in the cloud: WavLM-SV plus AS-norm.
- Meetings and podcasts: `pyannote/speaker-diarization-3.1`.
- Shipping TTS or cloning: AudioSeal on every output.
- Voice unlock: AASIST and ECAPA ensemble plus a liveness challenge.
- Call-center fraud: AASIST on a 20% sample of calls.

## Questions
type: qa
from: phases/06-speech-and-audio/16-anti-spoofing-audio-watermarking/docs/en.md, phases/18-ethics-safety-alignment/23-watermarking-synthid-stable-signature-c2pa/docs/en.md, phases/06-speech-and-audio/06-speaker-recognition-verification/docs/en.md

- **Watermark or detector?** Both. Pitch shift removes most watermarks.
- **Does a liveness phrase stop clones?** It stops replay, not real-time cloning.
- **No SynthID signal means real?** No. Other models do not add it.
- **Why C2PA and a watermark?** Metadata is rich but strippable. Watermarks persist but carry bits.
- **What do you report with EER?** The EER and the threshold at the EER.
