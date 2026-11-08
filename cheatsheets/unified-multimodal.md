---
id: unified-multimodal
title: Unified Multimodal Models
code: UM
subtitle: Pick a unified design. Discrete NTP, two-loss diffusion, masked diffusion, decoupled encoders, next-scale, any-to-any.
hue: 290
sources: phases/08-generative-ai/19-visual-autoregressive-var, phases/12-multimodal-ai/11-chameleon-early-fusion-tokens, phases/12-multimodal-ai/12-emu3-next-token-for-generation, phases/12-multimodal-ai/13-transfusion-autoregressive-diffusion, phases/12-multimodal-ai/14-show-o-discrete-diffusion-unified, phases/12-multimodal-ai/15-janus-pro-decoupled-encoders, phases/12-multimodal-ai/16-mio-any-to-any-streaming
source_hash: 7f3e1ab854d2d772
---

## Four unified designs side by side
type: comparison
span: 2
from: phases/12-multimodal-ai/11-chameleon-early-fusion-tokens/docs/en.md, phases/12-multimodal-ai/12-emu3-next-token-for-generation/docs/en.md, phases/12-multimodal-ai/13-transfusion-autoregressive-diffusion/docs/en.md, phases/12-multimodal-ai/14-show-o-discrete-diffusion-unified/docs/en.md, phases/12-multimodal-ai/15-janus-pro-decoupled-encoders/docs/en.md

| Factor | Chameleon, Emu3 | Transfusion | Show-o | Janus-Pro |
|---|---|---|---|---|
| Image form | Discrete VQ tokens | Continuous 16x16 patches | Discrete VQ tokens | SigLIP in, VQ tokens out |
| Image loss | Next-token cross-entropy | Flow matching MSE | Cross-entropy on masked tokens | Next-token on VQ tokens |
| Image attention | Causal | Bidirectional in the image block | Bidirectional in the image block | Text-style shared body |
| Image decode | 1024-4096 passes, token by token | 10-30 diffusion steps | ~16 parallel steps | Token by token |
| Visual encoders | One VQ tokenizer | Linear patch projection | One VQ tokenizer | SigLIP plus VQ tokenizer |
| Weak point | Tokenizer ceiling, slow inference | Loss weights need tuning | Lossy by tokenizer | Two tokenizers to train |
| Key number | Emu3 FID 5.4 vs SDXL 5.6 | 3-5 FID points over Chameleon-style at 7B | ~16 steps vs ~1000 | GenEval 0.80 vs DALL-E 3 0.67 |

## Use X when
type: tips
from: phases/12-multimodal-ai/11-chameleon-early-fusion-tokens/docs/en.md, phases/12-multimodal-ai/14-show-o-discrete-diffusion-unified/docs/en.md, phases/12-multimodal-ai/15-janus-pro-decoupled-encoders/docs/en.md, phases/12-multimodal-ai/12-emu3-next-token-for-generation/docs/en.md, phases/08-generative-ai/19-visual-autoregressive-var/docs/en.md, phases/12-multimodal-ai/16-mio-any-to-any-streaming/docs/en.md

- Chameleon family: you need image generation and mixed-modality output from one decoder.
- Adapter VLM (LLaVA family): you need understanding only. It reuses more pretrained compute.
- Emu3: you want image gen, perception and video from one checkpoint with prompt templates.
- Transfusion: quality comes first and you can afford the two-loss plumbing.
- Show-o: you want T2I, inpainting and VQA in one open model with reasonable speed.
- Janus-Pro: you need both understanding and generation. Pick SD3 or Flux for generation only.
- VAR: you want class-conditional images in about 10 passes, against 28-50 for DiT.
- MIO: you need speech in and speech out from one model, under 500ms TTFAB.

## Janus-Pro decoupled routing
type: architecture
from: phases/12-multimodal-ai/15-janus-pro-decoupled-encoders/docs/en.md, phases/12-multimodal-ai/15-janus-pro-decoupled-encoders/code/main.py

```arch
node | img | 1,1 | Input image | | client
node | prompt | 1,2 | Text prompt | task tag picks the path | client
node | siglip | 2,1 | SigLIP-SO400m | then 2-layer MLP
node | vqin | 2,2 | VQ tokenizer | optional image condition
node | body | 3,1 | Shared body | init DeepSeek-MoE-7B | model
node | vqout | 3,2 | Image VQ tokens | predicted by the body
node | text | 4,1 | Text out | autoregressive
node | dec | 4,2 | VQ decoder | pixels
edge | img | siglip | understand
edge | img | vqin | generate
edge | prompt | body | text tokens
edge | siglip | body |
edge | vqin | body |
edge | body | text |
edge | body | vqout |
edge | vqout | dec |
```

## Show-o masked sampling loop
type: flow
from: phases/12-multimodal-ai/14-show-o-discrete-diffusion-unified/code/main.py, phases/12-multimodal-ai/14-show-o-discrete-diffusion-unified/docs/en.md

1. **Start**: every image token is `MASK`. The toy uses `SEQ_LEN` 16 and `VOCAB` 8.
2. **Schedule**: `cosine_schedule(T)` gives one mask ratio for each of T=8 steps.
3. **Predict**: the transformer predicts all masked tokens in parallel.
4. **Commit**: keep the most confident tokens. `keep_ratio = max(0.15, 1 - ratios[step])`.
5. **Repeat**: the other tokens stay masked for the next step.
6. **Finish**: `step_unmask(tokens, prompt_seed, 1.0)` fills any token that is still masked.

## Residual multi-scale tokenizer (VAR)
type: annotated-code
lang: python
from: phases/08-generative-ai/19-visual-autoregressive-var/code/main.py

```python
SCALES = (1, 2, 4, 8)                       # 4 scales over an 8x8 image
CODEBOOK = 16                               # entries per scale
residual = img.copy()
for scale, book in zip(SCALES, codebooks):
    coarse = downsample(residual, scale)    # pool to scale x scale
    tok = encode(coarse, book)              # nearest code index
    recon = book[tok]
    residual = residual - upsample(recon, IMG)  # what is still missed
    tokens.append(tok)
out = out + upsample(book[tok], IMG)        # decoder sums every scale
```

## Two-loss step (Transfusion)
type: annotated-code
lang: python
from: phases/12-multimodal-ai/13-transfusion-autoregressive-diffusion/code/main.py

```python
weights = {"text_scale": 0, "img_scale": 0, "text_w": 1.0, "img_w": 0.1}
mask = build_mask(tokens)                   # causal text, bidirectional image
text_loss = sum(cross_entropy_toy(p) for p in text_probs) / len(text_probs)
t = random.random()                         # one timestep per image
xt = (1 - t) * x + t * n                    # noisy patch
target_vel = n - x                          # velocity target
img_loss = mse(pred_flat, tgt_flat)         # flow matching MSE
total = weights["text_w"] * text_loss + weights["img_w"] * img_loss
```

## Tasks in code
type: task-table
from: phases/08-generative-ai/19-visual-autoregressive-var/code/main.py, phases/12-multimodal-ai/11-chameleon-early-fusion-tokens/code/main.py, phases/12-multimodal-ai/12-emu3-next-token-for-generation/code/main.py, phases/12-multimodal-ai/15-janus-pro-decoupled-encoders/code/main.py, phases/12-multimodal-ai/16-mio-any-to-any-streaming/code/main.py

| Task | Code |
|---|---|
| Residual VQ tokens per scale | `tokenize_multiscale(img, codebooks)` |
| 8x8 image to 4 token ids | `image_to_tokens(img)` |
| Count image tokens | `TokCost("image 512x512", 512, 8).tokens()` |
| Mix guided logits | `cfg_mix(cond_logits, uncond_logits, gamma)` |
| Sample with CFG at temp 0.8 | `sample_tokens(cond, uncond, gamma=3.0)` |
| Pick understand or generate | `route(prompt)` |
| Lay out a 4-modality vocab | `build_vocab()` |
| Trace the TTFAB budget | `streaming_decode_latency(model_size_b=8)` |

## Key formulas
type: concepts
from: phases/08-generative-ai/19-visual-autoregressive-var/docs/en.md, phases/12-multimodal-ai/13-transfusion-autoregressive-diffusion/docs/en.md, phases/12-multimodal-ai/12-emu3-next-token-for-generation/code/main.py, phases/12-multimodal-ai/14-show-o-discrete-diffusion-unified/docs/en.md, phases/12-multimodal-ai/11-chameleon-early-fusion-tokens/docs/en.md, phases/12-multimodal-ai/12-emu3-next-token-for-generation/docs/en.md

- **Residual VQ**: $f \approx \sum_k \mathrm{upsample}(\mathrm{embed}(z_k))$. Scale k holds what scales 1 to k-1 missed.
- **Flow matching**: $x_t = (1-t) x_0 + t \epsilon$. Loss is MSE of $v_\theta(x_t, t)$ against $\epsilon - x_0$.
- **CFG**: mixed = uncond + gamma times (cond minus uncond).
- **Cosine mask ratio**: $\cos(\pi t / 2T)$. Ratio 1.0 at step 0, no mask at step T.
- **Show-o loss**: cross-entropy on masked tokens. Text NTP masks only the last token.
- **Chameleon vocab**: 32000 text plus 8192 image ids gives 40192.
- **Emu3 video**: 32 * 32 * 8 = 8,192 tokens for 4 s at 8 FPS, 256x256.

## Numbers to keep
type: defaults
from: phases/12-multimodal-ai/11-chameleon-early-fusion-tokens/docs/en.md, phases/12-multimodal-ai/12-emu3-next-token-for-generation/docs/en.md, phases/12-multimodal-ai/13-transfusion-autoregressive-diffusion/docs/en.md, phases/12-multimodal-ai/14-show-o-discrete-diffusion-unified/docs/en.md, phases/08-generative-ai/19-visual-autoregressive-var/docs/en.md, phases/12-multimodal-ai/16-mio-any-to-any-streaming/docs/en.md

| Setting | Default | Note |
|---|---|---|
| Chameleon codebook K | 8192 | 1024 tokens per 512x512 image |
| Emu3 codebook | 32768 | 4096 tokens per 512x512, 30.5 dB PSNR |
| CFG guidance weight | 3.0-7.0 | Generate with and without the caption |
| Emu3 temperature | 0.8 | 1.0 for perception |
| Transfusion denoise steps | 10-30 | Conditioned on the prior text |
| MaskGIT iterations | 8-16 | Cosine schedule works well |
| VAR scales K | 10 | 10 passes for a 256x256 image |
| TTFAB target | <500ms | Conversational feel |

## Troubleshooting
type: troubleshooting
from: phases/12-multimodal-ai/11-chameleon-early-fusion-tokens/docs/en.md, phases/12-multimodal-ai/12-emu3-next-token-for-generation/docs/en.md, phases/12-multimodal-ai/13-transfusion-autoregressive-diffusion/docs/en.md, phases/12-multimodal-ai/16-mio-any-to-any-streaming/docs/en.md

| Symptom | Cause | Fix |
|---|---|---|
| 34B early-fusion run diverges | Logit magnitude explodes at depth | QK-Norm, dropout after every residual-add |
| Image PSNR stays near 26-28 dB | VQ-VAE tokenizer ceiling | Better tokenizer, or continuous patches |
| One loss head dominates | NTP and diffusion schedules mismatch | Tune the loss weights |
| Image artifacts | Temperature too high | Use 0.8 for image generation |
| Mode collapse | Temperature too low | Raise the temperature |
| ~2 minutes per 512x512 image | 4096 tokens at 30 tok/s | Speculative decoding, KV-cache work |
| No cross-modality context | Interleaved stage 2 skipped | Train all four curriculum stages |
| Poor speech | Speech-enhanced stage 3 skipped | Add stage 3 audio data |

## Abbreviations
type: glossary
from: phases/08-generative-ai/19-visual-autoregressive-var/docs/en.md, phases/12-multimodal-ai/11-chameleon-early-fusion-tokens/docs/en.md, phases/12-multimodal-ai/12-emu3-next-token-for-generation/docs/en.md, phases/12-multimodal-ai/13-transfusion-autoregressive-diffusion/docs/en.md, phases/12-multimodal-ai/16-mio-any-to-any-streaming/docs/en.md

- **VAR**: Visual AutoRegressive. Next-scale prediction over a pyramid of VQ grids.
- **VQ-VAE**: vector-quantized variational autoencoder. Maps features to codebook indices.
- **NTP**: next-token prediction. Predict token i+1 from tokens 0 to i.
- **CFG**: classifier-free guidance. Mixes conditional and unconditional logits.
- **IBQ**: Inverse Bottleneck Quantizer. Emu3 tokenizer class, codebook 32768+.
- **MMDiT**: Multimodal DiT. SD3 backbone with joint attention.
- **TTFAB**: time-to-first-audio-byte. User voice to first audio output.
- **Residual-VQ**: stacked codebooks. Base layer is content, later layers add prosody.

## Questions
type: qa
from: phases/12-multimodal-ai/15-janus-pro-decoupled-encoders/docs/en.md, phases/12-multimodal-ai/14-show-o-discrete-diffusion-unified/docs/en.md, phases/08-generative-ai/19-visual-autoregressive-var/docs/en.md, phases/12-multimodal-ai/13-transfusion-autoregressive-diffusion/docs/en.md, phases/12-multimodal-ai/16-mio-any-to-any-streaming/docs/en.md

- **Why does one visual encoder fail?** VQ codes have weak semantics. SigLIP features do not reconstruct well.
- **Why is inpainting free in Show-o?** Training predicts masked tokens. Mask a region and predict it.
- **Why is VAR fast?** One transformer pass predicts a whole scale in parallel.
- **What does Transfusion text attend to?** Earlier text and previous images. Images see preceding text.
- **Why did Janus-Pro beat Janus?** 7B against 1.3B params and 72M stage 2 pairs against 26M.
- **How does MIO keep IDs apart?** Each modality gets a disjoint ID range in one vocabulary.
