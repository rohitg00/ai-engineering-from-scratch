# Evidence: cheatsheets/tts-voice-cloning.md

Abbreviations: P06 = phases/06-speech-and-audio. L07 = P06/07-text-to-speech, L08 = P06/08-voice-cloning-conversion, L13 = P06/13-neural-audio-codecs. d = docs/en.md, c = code/main.py.

## TTS and cloning pipeline (architecture, 7 nodes, 6 edges)
- Text, normalize before phonemizer: L07/d:16, 153
- Phonemizer espeak, fallback grapheme-to-phoneme: L07/d:79, 154
- Acoustic model text to mel, [T, 80], mel_channels=80: L07/d:17, 116, 131
- Vocoder HiFi-GAN, mel to waveform: L07/d:18, 174-175
- Reference clip 5 s plus transcript: L07/d:108
- Speaker encoder to speaker embedding, decoder conditions on it: L08/d:27
- Watermark ~32 bits of payload: L08/d:112

## Tasks in code (task-table, 8)
- phonemize("Hello world", language="en-us", backend="espeak"): L07/d:79
- KPipeline(lang_code="a"), voice="af_bella": L07/d:89-90
- F5TTS().infer(ref_file, ref_text, gen_text): L07/d:99-105, L08/d:80-86
- vc.convert(source=..., target_pool=[...]): L08/d:97
- sc.embed(wav, sr=24000, message=payload): L08/d:108
- model.set_target_bandwidth(6.0): L13/d:90
- semantic = codes[:, 0], acoustic = codes[:, 1:]: L13/d:122-123
- rvq_encode(values, codebook_size=8, n_codebooks=4): L13/c:46

## Clone and watermark (annotated-code, 9 lines)
- from f5_tts.api import F5TTS, tts = F5TTS(): L08/d:80-81
- ref_file="my_voice_5s.wav", ref_text, gen_text: L07/d:101-105
- reference transcript must exactly match the audio: L08/d:89
- SilentCipher(model="2024-06-01"), payload bytes: L08/d:106-107
- sc.embed, ~32 bits: L08/d:108, 112
- sc.detect returns payload bytes: L08/d:109

## Encode with a codec (annotated-code, 11 lines)
- EncodecModel.encodec_model_24khz(), set_target_bandwidth(6.0) kbps: L13/d:89-90
- 8 codebooks at 6 kbps: L13/d:99
- torch.no_grad(), model.encode(wav), codes, scale = encoded[0], shape: L13/d:93-96
- model.decode([(codes, scale)]): L13/d:105
- from moshi.models import loaders, loaders.get_mimi(): L13/d:116-117
- mimi.encode(wav), (1, 8, frames@12.5Hz): L13/d:120
- semantic WavLM-aligned, acoustic timbre, prosody, noise: L13/d:61, 122-126

## Consent gate (flow, 5 steps)
1. verify_signature(consent_record), "Signed consent required": L08/d:118
2. consent_record["speaker_id"] == hash_speaker(ref_audio): L08/d:119
3. tts.infer(ref_file=ref_audio, gen_text=text): L08/d:120
4. watermark(wav, payload=consent_record["id"]): L08/d:121
5. tamper-evident log: L08/d:44

## Formulas and numbers (concepts, 7)
- RVQ first codebook quantizes the output, second the residual: L13/d:27
- decoder sums chosen codes per frame: L13/d:29
- 1024 codes, 8 codebooks, 1024^8 = 10^24: L13/d:27
- 10 × 12.5 × 8 = 1000 tokens: L13/d:130-134
- toy RVQ codebook_size 8, bits_per_frame = n_cb * 3: L13/c:77, 84
- 12.5 ms at 24 kHz = 300 samples: L07/c:114
- upsample_rates=[8, 8, 2, 2], 256x: L07/d:116, 118

## Codec numbers (defaults, 7)
- EnCodec-24k 75 Hz, default 4 codebooks @ 1.5 kbps: L13/d:33, 47
- DAC-44.1k 86 Hz, highest fidelity, 44.1 kHz full-band: L13/d:35, 48
- SNAC-24k ~12 Hz coarse, detail at 50 Hz: L13/d:37, 49
- Mimi 12.5 Hz, 8 codebooks @ 4.4 kbps: L13/d:39, 50
- each code 0-1023: L13/d:99; 1024 codes: L13/d:27
- stop at 8-12 codebooks, fidelity and sequence length grow: L13/d:155
- Kokoro outputs 24 kHz, resample for 16 kHz: L07/d:156

## Models (concepts, 7)
- Tacotron 2 seq2seq, AR, slow, wobbly on long text: L07/d:26
- FastSpeech 2 duration predictor, 1-pass, 10× faster: L07/d:28
- VITS encoder + flow duration + HiFi-GAN end-to-end: L07/d:30, 25M: L07/d:65
- F5-TTS flow matching diffusion transformer, 5 s, 335M: L07/d:32
- Kokoro 82M CPU-runnable English-only: L07/d:34
- KNN-VC WavLM frames, nearest neighbor in the pool: L08/d:100
- Mimi codebook 0 distilled from WavLM, 1-7 acoustic: L13/d:39

## Abbreviations (glossary, 8)
- TTS three parts: L07/d:16-18
- VC A saying X into B: L08/d:17
- PPG per-frame ASR posteriors: L08/d:161
- RVQ cascade of small codebooks: L13/d:174
- SECS > 0.70 indistinguishable for most listeners: L08/d:58
- UTMOS reference-free, ground truth 4.08: L07/d:54, 62
- CMOS A-vs-B preference: L07/d:53
- PESQ / ViSQOL correlate with MOS: L13/d:178

## Troubleshooting (troubleshooting, 8)
- "Dr. Smith" Doctor or Drive, normalize before phonemizer: L07/d:153
- OOV proper nouns, fallback G2P: L07/d:154
- overshoot ±1.0, np.clip(wav, -1, 1): L07/d:155
- Kokoro 24 kHz vs 16 kHz, resample or aliasing: L07/d:156
- misaligned reference transcript, punctuation included: L08/d:140
- reverberant reference, record dry close-mic: L08/d:141
- language leakage, XTTS, VALL-E X: L08/d:143
- 12.5 Hz Mimi then 50 Hz EnCodec fails silently: L13/d:156

## Use X when (tips, 7)
- Kokoro (CPU) real-time English: L07/d:142
- F5-TTS or OpenVoice v2 for 5-sec zero-shot clone: L08/d:131
- KNN-VC or Diff-HierVC for conversion: L08/d:133
- generative model: Mimi or SNAC, compression: Opus: L13/d:151
- Opus wins per bit: L13/d:75
- DAC-44.1k highest-fidelity reconstruction: L13/d:145
- watermark and consent gates: L08/d:21, 44

## Questions (qa, 5)
- pure reconstruction codec gives blurry speech from text: L13/d:19
- one big codebook needs millions of codes: L13/d:27
- Mimi codebook 0 carries content, losing it destroys intelligibility: L13/d:157
- cloning text + reference, conversion source audio + reference: L08/d:16-17
- few-shot 5-30 minutes, LoRA for an hour: L08/d:31
