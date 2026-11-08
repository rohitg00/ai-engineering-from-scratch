# Evidence: cheatsheets/voice-security.md

Abbreviations: P06 = phases/06-speech-and-audio. L06 = P06/06-speaker-recognition-verification, L16 = P06/16-anti-spoofing-audio-watermarking, E23 = phases/18-ethics-safety-alignment/23-watermarking-synthid-stable-signature-c2pa. d = docs/en.md, c = code/main.py.

## Verify and mark (architecture, 8 nodes, 6 edges)
- Test utterance, EER degrades below 3 seconds: L06/d:142
- Countermeasure AASIST or RawNet2, real vs fake: L16/d:3, 37-39, 182
- Speaker encoder ECAPA-TDNN 192-d: L06/d:22, 24
- Cosine score against a threshold, tune on a held-out dev set: L06/d:22, 144
- TTS output, AudioSeal on every output: L16/d:153
- AudioSeal 16-bit payload: L16/d:51
- C2PA signed metadata: L16/d:71, E23/d:52
- Enrollment 3-5 clean samples averaged: L06/d:109-110, 143
- edge sign (c2pa_sign after watermark): L16/d:142-143

## Tasks in code (task-table, 8)
- verify(enroll, test, threshold=0.75): L06/d:82
- eer(same_scores, diff_scores), returns eer and threshold: L06/d:89, 100
- Pipeline.from_pretrained("pyannote/speaker-diarization-3.1"): L06/d:121
- AudioSeal.load_generator("audioseal_wm_16bits"): L16/d:108
- detector.detect_watermark(watermarked, sample_rate=16000): L16/d:116
- spectral_rolloff(spec, percentile=0.85): L16/d:82
- watermarked_sample(n, seed_prefix, bias=0.9): E23/c:41
- detect(tokens) z-score: E23/c:52-53

## Verify with ECAPA (annotated-code, 6 lines)
- from speechbrain.pretrained import EncoderClassifier: L06/d:105
- EncoderClassifier.from_hparams(source="speechbrain/spkrec-ecapa-voxceleb"): L06/d:107
- enroll average of 3-5 clean samples with torch.stack(...).mean(0): L06/d:109-110
- clf.similarity(enroll, clf.encode_batch(load("test.wav"))).item(): L06/d:112
- verdict = score > 0.25, tune on your data: L06/d:113

## Embed and detect AudioSeal (annotated-code, 7 lines)
- load_generator, load_detector: L16/d:108-109
- load_wav("generated.wav", sr=16000)[None, None, :]: L16/d:111
- 16-bit payload tensor: L16/d:112
- generator.get_watermark(audio, sample_rate=16000, message=payload): L16/d:113
- watermarked = audio + watermark: L16/d:114
- detector.detect_watermark returns result and decoded_payload: L16/d:116-118

## Ship a generation (flow, 6 steps)
1. verify_consent(user_id, clone_reference) when clone_reference is not None: L16/d:139-140
2. tts_model.synthesize(text, voice): L16/d:141
3. audioseal_embed(audio, payload=build_payload(user_id, model_id)): L16/d:142
4. c2pa_sign(audio_with_wm, user_id, timestamp=now()), manifest: L16/d:143-144
5. retention-policy-compliant audit log: L16/d:147
6. ship the detector in your CI: L16/d:161

## Formulas (concepts, 6)
- EER, FAR = FRR: L06/d:16
- AAM-softmax cos(θ + m), m=0.2, s=30: L06/d:30
- verification 1:1, identification 1:N, open-set: L06/d:12, 162-164
- hash previous K tokens, add δ to green logits: E23/d:27-28
- z-score (green - expected) / sqrt(expected * p(1-p)), p 0.5: E23/c:53, 62-64
- Bit Recovery Accuracy definition: L16/d:185

## Watermark families (concepts, 6)
- AudioSeal localized per-frame, MP3/AAC, EQ, ±10% speed, +10 dB SNR: L16/d:47-49
- WavMark 32 bits/sec, removed by Gaussian noise or MP3: L16/d:55-58
- WaveVerify FiLM generator, Mixture-of-Experts detector, reversal and speed: L16/d:63
- Stable Signature fine-tuned decoder, fine-tuning removes it: E23/d:42-44
- SynthID-text biased sampling, not robust to paraphrase: E23/d:25-36
- pitch shift, Bit Recovery Accuracy below 0.6: L16/d:67

## Numbers (defaults, 8)
- ECAPA 192-d, WavLM-large 256-d: L06/d:22
- ECAPA typical threshold 0.25: L06/d:113
- enrollment 3-5 clean samples, averaged: L06/d:109
- ECAPA-TDNN VoxCeleb1-O 0.87%, 15 M: L06/d:43
- ASVspoof 5 ~7.23% EER, in-the-wild 5-10%: L16/d:33
- AudioSeal 16-bit payload, per-frame at 16 kHz: L16/d:47, 51
- detector 485× realtime, 1000× faster than WavMark: L16/d:50
- z >= 4 very strong evidence: E23/c:88

## Abbreviations (glossary, 8)
- ECAPA-TDNN 1D conv, squeeze-excitation, attention pooling, 192-d: L06/d:24
- PLDA likelihood ratio on top of cosine: L06/d:35, 167
- AS-norm against a cohort of imposter means and stds: L06/d:36
- CM countermeasure real vs synthetic: L16/d:182
- SASV speaker verification + CM: L16/d:183
- AASIST graph attention on spectral features, SOTA: L16/d:37, 187
- C2PA signed tamper-evident metadata: E23/d:52, 107
- SynthID text, image, audio, video: E23/d:104

## Troubleshooting (troubleshooting, 8)
- channel mismatch VoxCeleb web video vs phone: L06/d:141
- EER degrades below 3 seconds: L06/d:142
- noisy enrollment poisons the anchor, ≥3 clean samples: L06/d:143
- L2-normalize first, magnitude dominates: L06/d:145
- AASIST on ASVspoof LA overfits, calibrate: L16/d:162
- pitch shift removes most watermarks, detection fallback: L16/d:163
- C2PA bypassed by re-encoding, add watermark: L16/d:164
- text watermarks do not survive paraphrase: E23/d:64

## Use X when (tips, 6)
- closed-set 1:1 edge ECAPA-TDNN + cosine: L06/d:133
- open-set cloud WavLM-SV + AS-norm: L06/d:134
- diarization pyannote/speaker-diarization-3.1: L06/d:135
- AudioSeal on every TTS output: L16/d:153
- voice unlock AASIST + ECAPA ensemble, liveness: L16/d:154
- call-center AASIST on 20% sample: L16/d:155

## Questions (qa, 5)
- both detection and watermarking, pitch shift: L16/d:18, 67
- liveness prevents replay, not real-time cloning: L16/d:165
- no SynthID signal is not proof of authenticity: E23/d:63
- metadata stripped but rich, watermarks persist but carry bits: E23/d:55-56
- report eer and threshold_at_eer: L06/d:100
