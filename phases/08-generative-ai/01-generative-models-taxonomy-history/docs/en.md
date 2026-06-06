# Generative Models — Taxonomy & History

> Every image model, text model, video model, and 3D model fits in one of five buckets. Pick the wrong bucket and you will fight the math for weeks. Pick the right one and the field's last twelve years of progress stacks cleanly in your head.

**Type:** Learn
**Languages:** Python
**Prerequisites:** Phase 2 (ML Fundamentals), Phase 3 (Deep Learning Core), Phase 7 · 14 (Transformers)
**Time:** ~45 minutes

## The Problem

A generative model does one job: given training samples drawn from some unknown distribution `p_data(x)`, output new samples that look like they came from the same distribution. Faces, sentences, MIDI files, protein structures — all the same problem if you squint.

The rub is that `p_data` lives in a space with millions of dimensions (a 512x512 RGB image is ~786k dimensions), the samples sit on a thin manifold inside that space, and you only have maybe 10M examples. Brute-forcing the density is hopeless. Every generative model is a compromise that trades one hard problem for a slightly less hard one.

Five families have survived the last twelve years. Knowing which compromise each family makes tells you why it wins on some tasks and collapses on others.

## The Concept

![Five families of generative models — taxonomy by what they model](../assets/taxonomy.svg)

**1. Explicit density, tractable.** Write `log p(x)` as a sum you can actually evaluate. Autoregressive models (PixelCNN, WaveNet, GPT) factorize `p(x) = ∏ p(x_i | x_<i)`. Normalizing flows (RealNVP, Glow) build `p(x)` as an invertible transform of a simple base. Pro: exact likelihood, clean training loss. Con: autoregressive inference is sequential (slow for long sequences), flows need invertible architectures (architecturally restrictive).

**2. Explicit density, approximate.** Bound `log p(x)` from below (ELBO) and optimize the bound. VAEs (Kingma 2013) use an encoder-decoder with a variational posterior. Diffusion models (DDPM, Ho 2020) train a denoiser that implicitly optimizes a weighted ELBO. Diffusion is the dominant image, video, and 3D backbone in 2026.

**3. Implicit density.** Skip density entirely; learn a generator `G(z)` that produces samples and a discriminator `D(x)` that tells real from fake. GANs (Goodfellow 2014). Fast at inference (one forward pass) but notoriously unstable during training. StyleGAN 1/2/3 remain state of the art for fixed-domain photorealism (faces, bedrooms) even in 2026.

**4. Score-based / continuous-time.** Learn the gradient of the log-density `∇_x log p(x)` (the score) directly. Song & Ermon (2019) showed score matching generalizes diffusion to an SDE. Flow matching (Lipman 2023) is the 2024-2026 hotness: simulate-free training, straighter paths, 4-10x faster sampling than DDPM. Stable Diffusion 3, Flux, AudioCraft 2 all use flow matching.

**5. Token-based autoregressive over discrete codes.** Compress high-dim data with a VQ-VAE or residual quantizer into a short sequence of discrete tokens, then use a Transformer to model the token sequence. Parti, MuseNet, AudioLM, VALL-E, Sora's patch tokenizer all use this. This is bucket 1 plus a learned tokenizer.

## A brief history

| Year | Model | Why it mattered |
|------|-------|-----------------|
| 2013 | VAE (Kingma) | First deep generative model with a usable training loss. |
| 2014 | GAN (Goodfellow) | Implicit density, no likelihood — shockingly sharp samples. |
| 2015 | DRAW, PixelCNN | Sequential image generation. |
| 2017 | Glow, RealNVP | Invertible flows; exact likelihood with depth. |
| 2017 | Progressive GAN | First megapixel faces. |
| 2019 | StyleGAN / StyleGAN2 | Photorealistic faces still hard to beat for that one domain. |
| 2020 | DDPM (Ho) | Diffusion becomes practical. |
| 2021 | CLIP, DALL-E 1, VQGAN | Text-to-image goes mainstream. |
| 2022 | Imagen, Stable Diffusion 1, DALL-E 2 | Latent diffusion + text conditioning = commodity. |
| 2022 | ControlNet, LoRA | Fine control over pretrained diffusion. |
| 2023 | SDXL, Midjourney v5, Flow matching | Scale + better training dynamics. |
| 2024 | Sora, Stable Diffusion 3, Flux.1 | Video diffusion; flow matching wins. |
| 2025 | Veo 2, Kling 1.5, Runway Gen-3, Nano Banana | Production-grade video. |
| 2026 | Consistency + Rectified Flow | One-step sampling from diffusion backbones. |

## The five-question triage

When a new generative model paper drops, answer these five questions before reading the method section.

1. **What is being modeled?** Pixels, latents, discrete tokens, 3D Gaussians, meshes, waveforms?
2. **Is the density explicit or implicit?** Do they write down `log p(x)`?
3. **Sampling: one-shot or iterative?** Iterative means slower inference; one-shot usually means adversarial or distilled.
4. **Conditioning: unconditional, class, text, image, pose?** This determines the loss and architecture scaffolding.
5. **Evaluation: FID, CLIP score, IS, human preference, task accuracy?** Each has known failure modes (see Lesson 14).

You will re-answer these five for every lesson in this phase. By the end, they will be reflex.

## Build It

The code for this lesson is a lightweight visualization: fit a 1-D mixture-of-Gaussians from samples using three toy approaches (kernel density, discrete histogram, and a nearest-sample "GAN-ish" generator) so you can see the difference between explicit vs implicit density on a problem you can print on one screen.

Run `code/main.py`. It draws 2000 samples from a two-mode Gaussian mixture, then prints:

```
explicit density (histogram): p(x in [-0.5, 0.5]) ≈ 0.38
approximate density (KDE):     p(x in [-0.5, 0.5]) ≈ 0.41
implicit (nearest-sample gen): 20 new samples printed, no p(x)
```

Notice: the first two let you ask "how likely is this point?" The third cannot. This is the *explicit vs implicit* distinction that will matter for every future lesson.

## Use It

Which family, for which task, in 2026?

| Task | Best family | Why |
|------|-------------|-----|
| Photoreal faces, narrow domain | StyleGAN 2/3 | Still sharpest, fastest inference. |
| General text-to-image | Latent diffusion + flow matching | SD3, Flux.1, DALL-E 3. |
| Fast text-to-image | Rectified flow + distillation | SDXL-Turbo, SD3-Turbo, LCM. |
| Text-to-video | Diffusion Transformer + flow matching | Sora, Veo 2, Kling. |
| Speech + music | Token-based AR (AudioLM, VALL-E, MusicGen) or flow matching (AudioCraft 2) | Discrete tokens scale cheaply. |
| 3D scenes | Gaussian Splatting fit, diffusion prior | 3D-GS for reconstruction, diffusion for novel-view. |
| Density estimation (no sampling) | Flows | Only family with exact `log p(x)`. |
| Simulation / physics | Flow matching, score SDE | Straight-line paths, smooth vector fields. |

## Ship It

Save as `outputs/skill-model-chooser.md`.

The skill takes a task description and outputs: (1) which family to use, (2) a ranked list of three open and three hosted options, (3) the likely failure mode you should watch for, and (4) a compute/time budget.

## Exercises

1. **Easy.** For each of these five products, identify the family and backbone: ChatGPT image, Midjourney v7, Sora, Runway Gen-3, ElevenLabs. Evidence should be from public technical reports.
2. **Medium.** The paper you are about to read tomorrow claims 100x faster sampling than diffusion. Write down three questions to check whether the speedup survives conditioning and high resolution.
3. **Hard.** Take one domain you care about (e.g. protein structure, CAD, molecules, trajectories). Answer the five-question triage for the current SOTA model in that domain and sketch what a better model would change.

## Key Terms

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Generative model | "It makes new stuff" | Learns a sampler for `p_data(x)`, optionally exposes `log p(x)`. |
| Explicit density | "You can evaluate it" | Model provides a closed-form or tractable `log p(x)`. |
| Implicit density | "GAN-style" | Only a sampler — no way to evaluate `p(x)` of a given point. |
| ELBO | "Evidence lower bound" | A tractable lower bound on `log p(x)`; VAEs and diffusion optimize it. |
| Score | "Gradient of log-density" | `∇_x log p(x)`; diffusion and SDE models learn this field. |
| Manifold hypothesis | "Data lives on a surface" | High-dim data concentrates on a low-dim manifold; why dimensionality reduction works. |
| Autoregressive | "Predict the next piece" | Factorize joint as product of conditionals. |
| Latent | "Compressed code" | Low-dim representation from which a decoder can reconstruct the input. |

## Production note: five families, five inference shapes

Each family maps to a different inference-server cost curve. production-inference literature frames LLM inference as prefill + decode; the same decomposition applies here:

- **Autoregressive (bucket 1 and 5).** Sequential decode dominates latency; KV-cache, continuous batching, and speculative decoding all apply directly.
- **VAE / diffusion / flow-matching (buckets 2 and 4).** There is no decode in the LLM sense. Cost = `num_steps × step_cost`, and the `step_cost` is a transformer or U-Net forward at the full latent resolution. The production knobs are step count (DDIM / DPM-Solver / distillation), batch size, and precision (bf16 / fp8 / int4).
- **GAN (bucket 3).** One forward pass. No schedule, no KV-cache. TTFT ≈ total latency. This is why StyleGAN still wins on narrow-domain UX.

When you see "faster than diffusion" in a paper abstract, translate it to "fewer steps × same step cost" or "same steps × cheaper step cost". Everything else is marketing.

## Further Reading

- [Goodfellow et al. (2014). Generative Adversarial Nets](https://arxiv.org/abs/1406.2661) — the GAN paper.
- [Kingma & Welling (2013). Auto-Encoding Variational Bayes](https://arxiv.org/abs/1312.6114) — the VAE paper.
- [Ho, Jain, Abbeel (2020). Denoising Diffusion Probabilistic Models](https://arxiv.org/abs/2006.11239) — the DDPM paper.
- [Song et al. (2021). Score-Based Generative Modeling through SDEs](https://arxiv.org/abs/2011.13456) — diffusion as an SDE.
- [Lipman et al. (2023). Flow Matching for Generative Modeling](https://arxiv.org/abs/2210.02747) — the flow matching paper.
- [Esser et al. (2024). Scaling Rectified Flow Transformers for High-Resolution Image Synthesis](https://arxiv.org/abs/2403.03206) — Stable Diffusion 3.
