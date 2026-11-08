# Evidence: cheatsheets/generative-evaluation.md

Abbreviations: E = phases/08-generative-ai/14-evaluation-fid-clip-score, A = phases/06-speech-and-audio/17-audio-evaluation-metrics, S = phases/12-multimodal-ai/14-show-o-discrete-diffusion-unified. d = docs/en.md, c = code/main.py.

## FID and CLIP score (architecture, 9 nodes, 8 edges)
- Real images node, held-out set: E/d:75
- Generated images node, 10k or more: E/d:35, 172
- Inception-v3 node, 2048-D features: E/d:28
- Gaussian fit node, mean and covariance per pool: E/d:29
- FID node, Fréchet distance, lower is better: E/d:14, 30
- Prompt node, text side of CLIP: E/d:15, 44
- CLIP encoders node, image and text: E/d:15, 44
- Cosine node, per image: E/d:44
- CLIP score node, higher is better, average across 30k: E/d:15, 47

## Production eval report (flow, 7 steps)
1. FID on 10-30k samples vs held-out real: E/d:75
2. CLIP score / CMMD on the same samples: E/d:76
3. Win rate in a blinded arena vs the previous model: E/d:77
4. 50 random outputs flagged for hand anatomy, text rendering, object count: E/d:78
5. 3 seeds minimum, report std: E/d:129
6. 500-sample subset per PR, ~30 min: E/d:177
7. Nightly full 10k FID + HPSv2 + Elo: E/d:177

## Formulas (concepts, 8)
- FID formula: E/d:30
- clip_score = cos_sim(CLIP_image(x_gen), CLIP_text(prompt)): E/d:44
- Elo expected score: E/c:92
- Elo update, r_b moves by -delta: E/c:93-95
- WER (S + D + I) / N, normalization, CER character level: A/d:32, 34
- DER formula: A/d:64
- EER threshold where FAR = FRR: A/d:58, 215
- Show-o cosine mask ratio, 1.0 at step 0, none at T: S/d:73, 76

## Image metrics in code (annotated-code, 11 lines)
- mean_vec, covariance: E/c:74-77
- mean_sq: E/c:78
- jacobi_sqrt(prod): E/c:79-80, matrix square root: E/c:39
- return of fid: E/c:81
- clip_like(image, prompt): E/c:128
- expected_a, actual_a, delta, return: E/c:92-95
- k=32: E/c:91

## Audio metrics in code (annotated-code, 9 lines)
- Compose([ToLowerCase(), RemovePunctuation(), Strip()]): A/d:125
- wer with truth_transform and hypothesis_transform: A/d:126-131
- EncoderClassifier.from_hparams("speechbrain/spkrec-ecapa-voxceleb"): A/d:151
- encode_batch for reference.wav and cloned.wav: A/d:153-154
- cosine_similarity(...).item(): A/d:155
- FrechetAudioDistance and get_fad_score: A/d:162-163

## Metric functions (task-table, 8)
- fid(real_features, gen_features): E/c:73
- elo_update(r_a, r_b, winner, k=32): E/c:91
- wer(ref, hyp): A/c:34
- cer(ref, hyp): A/c:39
- eer_from_scores(same, diff): A/c:43
- embedding_fad_like(real_embeds, fake_embeds): A/c:62
- mmau_accuracy(predictions, golds): A/c:75
- ttr_wer(tts_model, asr_model, texts): A/d:138

## Image metrics side by side (comparison, 4 rows)
- FID: sample quality, Inception-v3 2048-D, 10k vs held-out real, small N and non-ImageNet domains: E/d:14, 28, 35-36, 140
- CLIP score: prompt adherence, CLIP embeddings, 30k, weak composition and short prompt bias: E/d:15, 50-51, 141
- CMMD: CLIP features, subtle quality differences, 5k: E/d:54, 140
- Human preference: humans or LLM judge, 200 blinded pairs, judge variance and prompt distribution: E/d:58, 67-68, 142

## Sampling cost of unified models (comparison, 3 rows)
- Chameleon / Emu3 autoregressive, N_tokens passes, 1024-4096: S/d:51
- Transfusion continuous diffusion, ~20 steps, full transformer pass: S/d:52
- Show-o masked discrete diffusion, ~16 steps, commit top-K: S/d:48, 53

## Audio numbers to beat (concepts, 8)
- WER < 5% human parity read speech: A/d:32
- UTMOS ~0.9 correlation, F5-TTS 3.95, ground truth 4.08: A/d:44
- SECS > 0.75 recognizable clone: A/d:46
- CLAP > 0.3 reasonable alignment: A/d:80
- ECAPA on VoxCeleb1-O 0.87%: A/d:58
- FAD MusicGen-small on MusicCaps 4.5, lower better: A/d:78
- MMAU-Pro random chance 25% on 4-way: A/d:88
- Barge-in target < 150 ms: A/d:100

## Defaults (defaults, 8)
- k=32: E/c:91
- start ratings 1000, 1000: E/c:133
- FID unreliable under N=10k: E/d:127
- CLIP score on 30k, averaged to a scalar: E/d:47, 141
- Inception 299×299 resize, compare at matched resolution: E/d:128
- MOS 20+ listeners, 100+ samples: A/d:42
- Show-o T = 8, cosine: S/c:3, 66, 92
- keep_ratio = max(0.15, ...): S/c:74

## Troubleshooting (troubleshooting, 8)
- small N under-estimates covariance, falsely low FID, N ≥ 10,000: E/d:35
- Inception trained on ImageNet, domain-specific extractor: E/d:36, FD-DINO: E/d:168
- 299×299 resize across resolutions: E/d:128
- "high quality, 4k, masterpiece" inflates CLIP score: E/d:52, check saturation: E/d:130
- benchmark prompt overlap, held-out prompt sets: E/d:131
- 5% WER can hide 30% on accented speech, report by demographic slice: A/d:193
- UTMOS trained on clean speech, scores cloned audio poorly: A/d:190, domain panel: A/d:191
- FAD depends on reference set: A/d:192

## Rules (tips, 6)
- normalize before scoring, report the rule: A/d:184
- report distributions, P50/P95/P99, per class, per category: A/d:185
- one canonical public benchmark: A/d:186, in-house held-out set: A/d:194
- cache real features once as .npz: E/d:175
- num_images_per_prompt=8: E/d:174
- three corroborating metrics + qualitative review: E/d:80

## Questions (qa, 5)
- CMMD uses CLIP features and MMD, less biased, no Gaussian assumption: E/d:54, 163
- high SECS low MOS means timbre right but unnatural: A/d:54
- minDCF more production-relevant, weighted cost at operating point: A/d:60
- 10k SDXL samples ~11 hours on a single L4: E/d:172
- inpainting free from masked-prediction training: S/d:66
