---
id: tts-voice-cloning
title: Text-to-Speech, Voice Cloning and Codecs
code: TV
subtitle: Text to phonemes to mel to waveform, clone with consent and a watermark, and tokenize audio with RVQ codecs.
hue: 320
sources: phases/06-speech-and-audio/07-text-to-speech, phases/06-speech-and-audio/08-voice-cloning-conversion, phases/06-speech-and-audio/13-neural-audio-codecs
source_hash: 0c206b955d3a0633
---

## TTS and cloning pipeline
type: architecture
from: phases/06-speech-and-audio/07-text-to-speech/docs/en.md, phases/06-speech-and-audio/08-voice-cloning-conversion/docs/en.md

```arch
node | text | 1,1 | Text | normalize first | client
node | g2p | 2,1 | Phonemizer | espeak, G2P fallback | process
node | ac | 3,1 | Acoustic model | text to mel, 80 channels | model
node | voc | 4,1 | Vocoder | HiFi-GAN, mel to waveform | model
node | ref | 2,2 | Reference clip | 5 s plus its transcript | store
node | spk | 3,2 | Speaker encoder | speaker embedding | model
node | wm | 4,2 | Watermark | ~32 bits of payload | process
edge | text | g2p |
edge | g2p | ac | phonemes
edge | ac | voc | mel
edge | ref | spk |
edge | spk | ac | embedding
edge | voc | wm | waveform
```

## Tasks in code
type: task-table
from: phases/06-speech-and-audio/07-text-to-speech/docs/en.md, phases/06-speech-and-audio/08-voice-cloning-conversion/docs/en.md, phases/06-speech-and-audio/13-neural-audio-codecs/docs/en.md, phases/06-speech-and-audio/13-neural-audio-codecs/code/main.py
span: 2

| Task | Code |
|---|---|
| Phonemize | `phonemize("Hello world", language="en-us", backend="espeak")` |
| Kokoro on CPU | `KPipeline(lang_code="a")`, then `tts(text, voice="af_bella")` |
| Zero-shot clone | `F5TTS().infer(ref_file=<wav>, ref_text=<text>, gen_text=<text>)` |
| Voice conversion | `vc.convert(source=<wav>, target_pool=[<wav>, <wav>])` |
| Embed a watermark | `sc.embed(wav, sr=24000, message=payload)` |
| EnCodec at 6 kbps | `model.set_target_bandwidth(6.0)` |
| Mimi semantic split | `semantic = codes[:, 0]`, `acoustic = codes[:, 1:]` |
| Toy RVQ | `rvq_encode(values, codebook_size=8, n_codebooks=4)` |

## Clone and watermark
type: annotated-code
lang: python
from: phases/06-speech-and-audio/08-voice-cloning-conversion/docs/en.md, phases/06-speech-and-audio/07-text-to-speech/docs/en.md

```python
from f5_tts.api import F5TTS
tts = F5TTS()
wav = tts.infer(ref_file="my_voice_5s.wav",                    # 5 s reference
    ref_text="The quick brown fox jumps over the lazy dog.",    # must match exactly
    gen_text="Please remind me to water the plants.")
sc = SilentCipher(model="2024-06-01")
payload = b"consent_id:abc123;ts:1745353200"
watermarked = sc.embed(wav, sr=24000, message=payload)  # ~32 bits
detected = sc.detect(watermarked, sr=24000)             # payload bytes
```

## Encode with a codec
type: annotated-code
lang: python
from: phases/06-speech-and-audio/13-neural-audio-codecs/docs/en.md

```python
model = EncodecModel.encodec_model_24khz()
model.set_target_bandwidth(6.0)            # kbps, 8 codebooks
with torch.no_grad():
    encoded = model.encode(wav)
codes, scale = encoded[0]                  # (1, n_codebooks, n_frames)
wav_recon = model.decode([(codes, scale)])
mimi = loaders.get_mimi()                  # from moshi.models
codes = mimi.encode(wav)                   # (1, 8, frames@12.5Hz)
semantic = codes[:, 0]                     # content, WavLM-aligned
acoustic = codes[:, 1:]                    # timbre, prosody, noise
```

## Consent gate
type: flow
from: phases/06-speech-and-audio/08-voice-cloning-conversion/docs/en.md

1. **Gate**: `verify_signature(consent_record)` must pass. Else "Signed consent required".
2. **Speaker**: `consent_record["speaker_id"]` must equal `hash_speaker(ref_audio)`.
3. **Clone**: `tts.infer(ref_file=ref_audio, gen_text=text)`.
4. **Mark**: `watermark(wav, payload=consent_record["id"])`.
5. **Log**: store the consent record in a tamper-evident log.

## Formulas and numbers
type: concepts
from: phases/06-speech-and-audio/13-neural-audio-codecs/docs/en.md, phases/06-speech-and-audio/13-neural-audio-codecs/code/main.py, phases/06-speech-and-audio/07-text-to-speech/docs/en.md, phases/06-speech-and-audio/07-text-to-speech/code/main.py

- **RVQ**: codebook 1 quantizes the encoder output. Each next one quantizes the residual.
- **Decode**: the decoder sums the chosen codes per frame.
- **Vocabulary**: 8 codebooks of 1024 codes give $1024^8 = 10^{24}$.
- **LM tokens**: $10 \times 12.5 \times 8 = 1000$ tokens for 10 s of Mimi.
- **Toy RVQ bits**: 8 codes are 3 bits. Bits per frame is 3 times the codebooks.
- **Mel hop**: 12.5 ms at 24 kHz is 300 samples.
- **HiFi-GAN**: upsample rates 8, 8, 2, 2 give 256x, mel rate to audio rate.

## Codec numbers
type: defaults
from: phases/06-speech-and-audio/13-neural-audio-codecs/docs/en.md, phases/06-speech-and-audio/07-text-to-speech/docs/en.md

| Setting | Default | Note |
|---|---|---|
| EnCodec-24k frame rate | 75 Hz | Default 4 codebooks @ 1.5 kbps |
| DAC-44.1k frame rate | 86 Hz | Highest fidelity, full-band |
| SNAC-24k coarse rate | ~12 Hz | Detail at 50 Hz |
| Mimi frame rate | 12.5 Hz | 8 codebooks @ 4.4 kbps |
| Codes per codebook | 1024 | Each code is 0-1023 |
| Codebook count | 8-12 | More adds fidelity and sequence length |
| Kokoro output | 24 kHz | Resample for 16 kHz consumers |

## Models
type: concepts
from: phases/06-speech-and-audio/07-text-to-speech/docs/en.md, phases/06-speech-and-audio/08-voice-cloning-conversion/docs/en.md, phases/06-speech-and-audio/13-neural-audio-codecs/docs/en.md

- **Tacotron 2**: autoregressive seq2seq. Slow, wobbly on long text.
- **FastSpeech 2**: duration predictor, 1-pass, 10× faster than Tacotron.
- **VITS**: encoder, flow duration and HiFi-GAN, trained end-to-end. 25M.
- **F5-TTS**: flow-matching diffusion transformer. Clones from 5 s. 335M.
- **Kokoro**: 82M, CPU-runnable, English only.
- **KNN-VC**: swaps each WavLM source frame for its nearest target-pool frame.
- **Mimi**: codebook 0 is distilled from WavLM. Codebooks 1-7 are acoustic.

## Abbreviations
type: glossary
from: phases/06-speech-and-audio/07-text-to-speech/docs/en.md, phases/06-speech-and-audio/08-voice-cloning-conversion/docs/en.md, phases/06-speech-and-audio/13-neural-audio-codecs/docs/en.md

- **TTS**: Text-to-Speech. Text frontend, acoustic model, vocoder.
- **VC**: Voice conversion. Speech of A rewritten in the voice of B.
- **PPG**: Phonetic posteriorgram. Per-frame ASR posteriors as content.
- **RVQ**: Residual Vector Quantization. A cascade of small codebooks.
- **SECS**: speaker embedding cosine. Above 0.70 is indistinguishable for most listeners.
- **UTMOS**: reference-free MOS predictor. Ground truth scores 4.08.
- **CMOS**: Comparative MOS. An A-vs-B preference.
- **PESQ / ViSQOL**: objective metrics that correlate with MOS.

## Troubleshooting
type: troubleshooting
from: phases/06-speech-and-audio/07-text-to-speech/docs/en.md, phases/06-speech-and-audio/08-voice-cloning-conversion/docs/en.md, phases/06-speech-and-audio/13-neural-audio-codecs/docs/en.md

| Symptom | Cause | Fix |
|---|---|---|
| "Dr." reads as "Drive" | No text normalizer | Normalize before the phonemizer |
| Proper noun mispronounced | OOV token | Ship a fallback G2P model |
| Output overshoots ±1.0 | Mel scaling mismatch | `np.clip(wav, -1, 1)` |
| Aliasing downstream | 24 kHz Kokoro into a 16 kHz pipeline | Resample |
| Clone alignment breaks | Reference text differs from audio | Match it exactly, punctuation included |
| Echo in the clone | Reverberant reference | Record dry, close-mic |
| French clone keeps the accent | Language leakage | XTTS or VALL-E X |
| LM fails silently | 12.5 Hz Mimi, then 50 Hz EnCodec | Keep one frame rate |

## Use X when
type: tips
from: phases/06-speech-and-audio/07-text-to-speech/docs/en.md, phases/06-speech-and-audio/08-voice-cloning-conversion/docs/en.md, phases/06-speech-and-audio/13-neural-audio-codecs/docs/en.md

- Real-time English on CPU: Kokoro.
- Clone from a 5 s reference: F5-TTS or OpenVoice v2.
- Rewrite speech into a target voice: KNN-VC or Diff-HierVC.
- Generative model over audio: start with Mimi or SNAC.
- Compression pipeline: use Opus. It wins per bit.
- Highest-fidelity reconstruction: DAC-44.1k.
- Every clone: a watermark and a consent record.

## Questions
type: qa
from: phases/06-speech-and-audio/13-neural-audio-codecs/docs/en.md, phases/06-speech-and-audio/08-voice-cloning-conversion/docs/en.md

- **Why split semantic and acoustic tokens?** Pure reconstruction tokens give blurry speech from text.
- **Why RVQ, not one codebook?** One big codebook needs millions of codes.
- **Which Mimi codebook matters?** Codebook 0. Losing it destroys intelligibility.
- **Cloning or conversion?** Cloning takes text. Conversion takes source speech.
- **Few-shot fine-tune?** 5-30 minutes of the target voice, LoRA for an hour.
