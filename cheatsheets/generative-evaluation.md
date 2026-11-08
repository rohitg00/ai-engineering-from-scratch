---
id: generative-evaluation
title: Evaluating Generative Models
code: EG
subtitle: FID, CLIP score, CMMD, Elo, WER, MOS, SECS, EER and FAD. Code, sample sizes and the ways each number fails.
hue: 45
sources: phases/08-generative-ai/14-evaluation-fid-clip-score, phases/06-speech-and-audio/17-audio-evaluation-metrics, phases/12-multimodal-ai/14-show-o-discrete-diffusion-unified
source_hash: 90f888ea41e1551e
---

## FID and CLIP score
type: architecture
from: phases/08-generative-ai/14-evaluation-fid-clip-score/docs/en.md

```arch
node | real | 1,1 | Real images | held-out set | store
node | gen | 1,2 | Generated images | 10k or more | store
node | inc | 2,1 | Inception-v3 | 2048-D features | model
node | gauss | 3,1 | Gaussian fit | mean and covariance | process
node | fid | 4,1 | FID | lower is better | client
node | prompt | 1,3 | Prompt | | client
node | clip | 2,3 | CLIP encoders | image and text | model
node | cos | 3,3 | Cosine | per image | process
node | score | 4,3 | CLIP score | higher is better | client
edge | real | inc |
edge | gen | inc |
edge | inc | gauss | two pools
edge | gauss | fid | Fréchet distance
edge | gen | clip |
edge | prompt | clip |
edge | clip | cos |
edge | cos | score | mean over 30k
```

## Production eval report
type: flow
from: phases/08-generative-ai/14-evaluation-fid-clip-score/docs/en.md

1. **Sample quality**: FID on 10-30k samples against a held-out real set.
2. **Adherence**: CLIP score or CMMD on the same samples against their prompts.
3. **Preference**: win rate in a blinded arena against the previous model.
4. **Failure audit**: flag 50 random outputs for hands, text and object count.
5. **Seeds**: run 3 seeds minimum. Report the std.
6. **Per PR**: FID and CLIP score on a 500-sample subset, about 30 min.
7. **Nightly**: full 10k FID, HPSv2 and Elo.

## Formulas
type: concepts
from: phases/08-generative-ai/14-evaluation-fid-clip-score/docs/en.md, phases/06-speech-and-audio/17-audio-evaluation-metrics/docs/en.md, phases/12-multimodal-ai/14-show-o-discrete-diffusion-unified/docs/en.md

- **FID**: $\lVert \mu_r - \mu_g \rVert^2 + \mathrm{Tr}(\Sigma_r + \Sigma_g - 2 (\Sigma_r \Sigma_g)^{0.5})$
- **CLIP score**: cosine of `CLIP_image(x_gen)` and `CLIP_text(prompt)`.
- **Elo expected**: $E_a = 1 / (1 + 10^{(r_b - r_a)/400})$
- **Elo update**: $r_a \leftarrow r_a + k (s_a - E_a)$. B moves by the same amount the other way.
- **WER**: $(S + D + I) / N$ after normalization. CER uses characters.
- **DER**: (FA + Miss + Confusion) / total speaker time.
- **EER**: the threshold where FAR equals FRR.
- **Show-o mask ratio**: $\cos\left(\frac{\pi t}{2T}\right)$, from 1.0 at step 0 to 0 at step T.

## Image metrics in code
type: annotated-code
lang: python
from: phases/08-generative-ai/14-evaluation-fid-clip-score/code/main.py

```python
mu_r = mean_vec(real_features)
mu_g = mean_vec(gen_features)
cov_r = covariance(real_features, mu_r)
mean_sq = sum((a - b) ** 2 for a, b in zip(mu_r, mu_g))
sqrt_prod = jacobi_sqrt(prod)                    # matrix square root
return mean_sq + trace(cov_r) + trace(cov_g) - 2 * trace(sqrt_prod)
score = clip_like(image, prompt)                 # cosine, higher is better
expected_a = 1 / (1 + 10 ** ((r_b - r_a) / 400))
actual_a = 1.0 if winner == "a" else 0.0
delta = k * (actual_a - expected_a)              # k=32
return r_a + delta, r_b - delta
```

## Audio metrics in code
type: annotated-code
lang: python
from: phases/06-speech-and-audio/17-audio-evaluation-metrics/docs/en.md

```python
transform = Compose([ToLowerCase(), RemovePunctuation(), Strip()])
score = wer(truth="<ref>", hypothesis="<hyp>",
            truth_transform=transform, hypothesis_transform=transform)
sv = EncoderClassifier.from_hparams("speechbrain/spkrec-ecapa-voxceleb")
emb_ref = sv.encode_batch(load_wav("reference.wav"))
emb_clone = sv.encode_batch(load_wav("cloned.wav"))
secs = torch.nn.functional.cosine_similarity(emb_ref, emb_clone, dim=-1).item()
fad = FrechetAudioDistance()
score = fad.get_fad_score("generated_folder/", "reference_folder/")
```

## Metric functions
type: task-table
from: phases/08-generative-ai/14-evaluation-fid-clip-score/code/main.py, phases/06-speech-and-audio/17-audio-evaluation-metrics/code/main.py, phases/06-speech-and-audio/17-audio-evaluation-metrics/docs/en.md

| Task | Code |
|---|---|
| Image FID | `fid(real_features, gen_features)` |
| Elo from a pair | `elo_update(r_a, r_b, winner, k=32)` |
| Word error rate | `wer(ref, hyp)` |
| Character error rate | `cer(ref, hyp)` |
| Equal error rate | `eer_from_scores(same, diff)` |
| FAD-shaped distance | `embedding_fad_like(real_embeds, fake_embeds)` |
| Multiple-choice accuracy | `mmau_accuracy(predictions, golds)` |
| TTS round-trip WER | `ttr_wer(tts_model, asr_model, texts)` |

## Image metrics side by side
type: comparison
from: phases/08-generative-ai/14-evaluation-fid-clip-score/docs/en.md
span: 2

| Factor | FID | CLIP score | CMMD | Human preference |
|---|---|---|---|---|
| Measures | sample quality | prompt adherence | quality, subtle differences | overall preference |
| Features | Inception-v3, 2048-D | CLIP image and text | CLIP | humans or an LLM judge |
| Minimum | 10k vs held-out real | 30k | 5k | 200 blinded pairs |
| Weak spot | small N, domains far from ImageNet | weak composition, short prompts | not covered | judge variance, prompt choice |

## Sampling cost of unified models
type: comparison
from: phases/12-multimodal-ai/14-show-o-discrete-diffusion-unified/docs/en.md

| Factor | Chameleon, Emu3 | Transfusion | Show-o |
|---|---|---|---|
| Decoding | autoregressive tokens | continuous diffusion | masked discrete diffusion |
| Steps | 1024-4096 passes | ~20 | ~16 |
| Each step | one token | full transformer pass | top-K tokens commit |

## Audio numbers to beat
type: concepts
from: phases/06-speech-and-audio/17-audio-evaluation-metrics/docs/en.md

- **WER**: below 5% is human parity on read speech.
- **UTMOS**: correlates ~0.9 with human MOS. F5-TTS 3.95, ground truth 4.08.
- **SECS**: above 0.75 is a recognizable clone.
- **CLAP**: above 0.3 is reasonable text-audio alignment.
- **EER**: ECAPA on VoxCeleb1-O gives 0.87%.
- **FAD**: MusicGen-small on MusicCaps 4.5. Lower is better.
- **MMAU-Pro**: random chance is 25% on 4-way.
- **Barge-in**: target below 150 ms.

## Defaults
type: defaults
from: phases/08-generative-ai/14-evaluation-fid-clip-score/docs/en.md, phases/08-generative-ai/14-evaluation-fid-clip-score/code/main.py, phases/06-speech-and-audio/17-audio-evaluation-metrics/docs/en.md, phases/12-multimodal-ai/14-show-o-discrete-diffusion-unified/code/main.py

| Setting | Default | Note |
|---|---|---|
| Elo `k` | 32 | `elo_update` |
| Elo start rating | 1000 | Both models |
| FID samples | 10k | Low-N FID is unreliable |
| CLIP score samples | 30k | Average to one scalar |
| Inception input | 299×299 | Match resolutions |
| MOS listeners | 20+ | 100+ samples per model |
| Show-o steps `T` | 8 | Cosine schedule |
| Keep ratio floor | 0.15 | `keep_ratio` per step |

## Troubleshooting
type: troubleshooting
from: phases/08-generative-ai/14-evaluation-fid-clip-score/docs/en.md, phases/06-speech-and-audio/17-audio-evaluation-metrics/docs/en.md

| Symptom | Cause | Fix |
|---|---|---|
| Low FID from few samples | Small N underestimates covariance | Use N of 10k or more |
| FID meaningless on faces or art | Inception trained on ImageNet | Domain extractor, for example FD-DINO |
| FID shifts across resolutions | 299×299 resize | Compare at matched resolution |
| CLIP score up, images not better | "high quality, 4k, masterpiece" | Check binding and saturation |
| Elo is meaningless | Models saw the benchmark prompts | Use held-out prompt sets |
| 5% WER hides 30% on accents | Aggregate WER | Report by demographic slice |
| Bad UTMOS on cloned audio | Trained on clean speech | Use a domain MOS panel |
| FAD not comparable | Different reference sets | Same reference set for all models |

## Rules
type: tips
from: phases/08-generative-ai/14-evaluation-fid-clip-score/docs/en.md, phases/06-speech-and-audio/17-audio-evaluation-metrics/docs/en.md

- Normalize text before WER. Report the normalization rule.
- Report distributions. P50/P95/P99 for latency, per class, per category.
- Run one public benchmark and one in-house held-out set.
- Cache the real features once as a `.npz` file.
- Batch eval generation with `num_images_per_prompt=8`.
- Use three metrics that agree, plus a qualitative review.

## Questions
type: qa
from: phases/08-generative-ai/14-evaluation-fid-clip-score/docs/en.md, phases/06-speech-and-audio/17-audio-evaluation-metrics/docs/en.md, phases/12-multimodal-ai/14-show-o-discrete-diffusion-unified/docs/en.md

- **Why CMMD?** It uses CLIP features and MMD. It is less biased and has no Gaussian assumption.
- **High SECS, low MOS?** The timbre is right but the voice is unnatural.
- **EER or minDCF?** minDCF is more production-relevant. It weights cost at an operating point.
- **What does 10k SDXL samples cost?** About 11 hours on one L4 at one request at a time.
- **Why does Show-o inpaint for free?** Its training predicts masked tokens.
