# ControlNet, LoRA & Conditioning

> Text alone is a clumsy control signal. ControlNet lets you clone a pretrained diffusion model and steer it with a depth map, pose skeleton, scribble, or edge image. LoRA lets you fine-tune a 2B-parameter model by training 10 million parameters. Together they turned Stable Diffusion from a toy into the 2026 image pipeline that ships at every agency.

**Type:** Build
**Languages:** Python
**Prerequisites:** Phase 8 · 07 (Latent Diffusion), Phase 10 (LLMs from Scratch — for LoRA foundation)
**Time:** ~75 minutes

## The Problem

A prompt like "a woman in a red dress walking a dog on a busy street" gives the model no information about *where* the dog is, *what pose* the woman is in, or *the perspective* of the street. Text pins down about 10% of what you need to specify an image. The rest is visual and cannot be described efficiently in words.

Training a new conditional model from scratch for every signal (pose, depth, canny, segmentation) is prohibitive. You want to keep the 2.6B-param SDXL backbone frozen, attach a small side-network that reads the conditioning, and have it nudge the backbone's intermediate features. That is ControlNet.

You also want to teach the model new concepts (your face, your product, your style) without retraining the full model. You want a 100x smaller delta. That is LoRA — low-rank adapters that plug into existing attention weights.

ControlNet + LoRA + text = the 2026 practitioner's toolkit. Most production image pipelines layer 2-5 LoRAs, 1-3 ControlNets, and an IP-Adapter on top of an SDXL / SD3 / Flux base.

## The Concept

![ControlNet clones the encoder; LoRA adds low-rank deltas](../assets/controlnet-lora.svg)

### ControlNet (Zhang et al., 2023)

Take a pretrained SD. *Clone* the encoder half of the U-Net. Freeze the original. Train the clone to accept an extra conditioning input (edges, depth, pose). Connect the clone back to the decoder half of the original with *zero-convolution* skip connections (1×1 convs initialized to zero — start as a no-op, learn a delta).

```
SD U-Net decoder:   ... ← orig_enc_features + zero_conv(controlnet_enc(condition))
```

Zero-conv init means ControlNet starts as identity — no harm even before training. Train on 1M (prompt, condition, image) triples with the standard diffusion loss.

Per-modality ControlNets ship as small side models (~360M for SDXL, ~70M for SD 1.5). You can compose them at inference:

```
features += weight_a * control_a(depth) + weight_b * control_b(pose)
```

### LoRA (Hu et al., 2021)

For any linear layer `W ∈ R^{d×d}` in the model, freeze `W` and add a low-rank delta:

```
W' = W + ΔW,  ΔW = B @ A,  A ∈ R^{r×d},  B ∈ R^{d×r}
```

with `r << d`. Rank 4-16 is standard for attention, rank 64-128 for heavy fine-tunes. Number of new parameters: `2 · d · r` instead of `d²`. For SDXL attention with `d=640`, `r=16`: 20k params per adapter instead of 410k — a 20x reduction. Across the whole model: a LoRA is usually 20-200MB vs the base 5GB.

At inference you can scale the LoRA: `W' = W + α · B @ A`. `α = 0.5-1.5` is normal. Multiple LoRAs stack additively (with the usual caveat that they interact in non-linear ways).

### IP-Adapter (Ye et al., 2023)

A tiny adapter that accepts an *image* as conditioning (alongside text). Uses the CLIP image encoder to produce image tokens, injects them into cross-attention alongside text tokens. ~20MB per base model. Lets you do "generate an image in the style of this reference" without a LoRA.

## Composability matrix

| Tool | What it controls | Size | When to use |
|------|------------------|------|-------------|
| ControlNet | Spatial structure (pose, depth, edges) | 70-360MB | Exact layout, composition |
| LoRA | Style, subject, concept | 20-200MB | Personalization, style |
| IP-Adapter | Style or subject from reference image | 20MB | No text can describe the look |
| Textual Inversion | Single concept as a new token | 10KB | Legacy, mostly replaced by LoRA |
| DreamBooth | Full fine-tune on a subject | 2-5GB | Strong identity, high compute |
| T2I-Adapter | Lighter ControlNet alternative | 70MB | Edge devices, inference budget |

ControlNet ≈ spatial. LoRA ≈ semantic. Use both.

## Build It

`code/main.py` simulates the two mechanisms on 1-D:

1. **LoRA.** A pretrained linear layer `W`. Freeze it. Train a low-rank `B @ A` such that `W + BA` matches a target linear layer. Show that `r = 1` is enough to learn a rank-1 correction perfectly.

2. **ControlNet-lite.** A "frozen base" predictor and a "side network" that reads an extra signal. The side network's output is gated by a learnable scalar initialized to zero (our version of zero-conv). Train and watch the gate ramp up.

### Step 1: LoRA math

```python
def lora(W, A, B, x, alpha=1.0):
    # W is frozen; A, B are the trainable low-rank factors.
    return [W[i][j] * x[j] for i, j in ...] + alpha * (B @ (A @ x))
```

### Step 2: zero-init side network

```python
side_out = control_net(x, condition)
gated = gate * side_out  # gate initialized to 0
h = base(x) + gated
```

At step 0 the output is identical to base. Early training updates `gate` slowly — no catastrophic drift.

## Pitfalls

- **Over-scaling LoRAs.** `α = 2` or `α = 3` is a common "make it stronger" hack that produces over-stylized / broken outputs. Keep `α ≤ 1.5`.
- **ControlNet weight conflict.** Using a Pose ControlNet at weight 1.0 and a Depth ControlNet at weight 1.0 usually overshoots. Sum of weights ≈ 1.0 is a safe default.
- **LoRA on the wrong base.** SDXL LoRAs silently no-op on SD 1.5 because the attention dimensions do not match. Diffusers will warn in 0.30+.
- **Textual Inversion drift.** Tokens trained on one checkpoint drift badly on another. LoRA is more portable.
- **LoRA weight-merging and storage.** You can bake a LoRA into the base model weights for faster inference (no runtime addition), but you lose the ability to scale `α` at runtime. Keep both versions.

## Use It

| Goal | 2026 pipeline |
|------|---------------|
| Reproduce a brand's art style | LoRA trained on ~30 curated images at rank 32 |
| Put my face in a generated image | DreamBooth or LoRA + IP-Adapter-FaceID |
| Specific pose + prompt | ControlNet-Openpose + SDXL + text |
| Depth-aware composition | ControlNet-Depth + SD3 |
| Reference + prompt | IP-Adapter + text |
| Exact layout | ControlNet-Scribble or ControlNet-Canny |
| Background replace | ControlNet-Seg + Inpainting (Lesson 09) |
| Fast 1-step style | LCM-LoRA on SDXL-Turbo |

## Ship It

Save `outputs/skill-sd-toolkit-composer.md`. Skill takes a task (input assets: prompt, optional reference image, optional pose, optional depth, optional scribble) and outputs the tool stack, weights, and a reproducible seed protocol.

## Exercises

1. **Easy.** In `code/main.py`, vary the LoRA rank `r` from 1 to 4. At what rank does the LoRA exactly match a rank-2 target delta?
2. **Medium.** Train two separate LoRAs on two target transforms. Load them together and show their additive interaction. When does the interaction break linearity?
3. **Hard.** Use diffusers to stack: SDXL-base + Canny-ControlNet (weight 0.8) + a style LoRA (α 0.8) + IP-Adapter (weight 0.6). Measure FID-vs-prompt-adherence trade-off as the stack weights vary.

## Key Terms

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| ControlNet | "Spatial control" | Cloned encoder + zero-conv skips; reads a conditioning image. |
| Zero convolution | "Starts as identity" | 1×1 conv initialized to zero; ControlNet starts as no-op. |
| LoRA | "Low-rank adapter" | `W + B @ A`, `r << d`; 100x fewer params than a full fine-tune. |
| rank r | "The knob" | LoRA compression; 4-16 typical, 64+ for heavy personalization. |
| α | "LoRA strength" | Runtime scaling of the LoRA delta. |
| IP-Adapter | "Reference image" | Small image-conditioning adapter via CLIP-image tokens. |
| DreamBooth | "Full subject fine-tune" | Train the full model on ~30 images of a subject. |
| Textual Inversion | "New token" | Learn a new word embedding only; legacy, mostly replaced. |

## Production note: LoRA swaps, ControlNet lanes, multi-tenant serving

A real text-to-image SaaS serves hundreds of LoRAs and a dozen ControlNets over the same base checkpoint. The serving problem looks a lot like LLM multi-tenancy (the production literature covers the LLM case under continuous batching and LoRAX / S-LoRA):

- **Hot-swap LoRAs, do not merge.** Merging `W' = W + α·B·A` into the base gives ~3-5% faster per-step inference but freezes `α` and the base. Keep LoRAs hot in VRAM as rank-r deltas; diffusers exposes `pipe.load_lora_weights()` + `pipe.set_adapters([...], adapter_weights=[...])` for per-request activation. Swap cost is the `2 · d · r · num_layers` weights — MB-scale, sub-second.
- **ControlNet as a second attention lane.** The cloned encoder runs in parallel with the base. Two ControlNets at weight 1.0 each = two extra forward passes per step, not one merged pass. Batch-size headroom drops quadratically. Budget for ~1.5× step cost per active ControlNet.
- **Quantized LoRAs too.** If you quantized the base (see Lesson 07, Flux on 8GB), the LoRA delta also quantizes cleanly to 8-bit or 4-bit. QLoRA-style loading lets you stack 5-10 LoRAs on top of a 4-bit Flux base without blowing memory.

Flux-specific: Niels' Flux-on-8GB notebook quantizes the base to 4-bit; stacking a style LoRA (`pipe.load_lora_weights("user/style-lora")`) on that quantized base at `weight_name="pytorch_lora_weights.safetensors"` still works. This is the recipe most SaaS agencies ship in 2026.

## Further Reading

- [Zhang, Rao, Agrawala (2023). Adding Conditional Control to Text-to-Image Diffusion Models](https://arxiv.org/abs/2302.05543) — ControlNet.
- [Hu et al. (2021). LoRA: Low-Rank Adaptation of Large Language Models](https://arxiv.org/abs/2106.09685) — LoRA (originally for LLMs; ports to diffusion).
- [Ye et al. (2023). IP-Adapter: Text Compatible Image Prompt Adapter](https://arxiv.org/abs/2308.06721) — IP-Adapter.
- [Mou et al. (2023). T2I-Adapter: Learning Adapters to Dig Out More Controllable Ability](https://arxiv.org/abs/2302.08453) — lighter alternative to ControlNet.
- [Ruiz et al. (2023). DreamBooth: Fine Tuning Text-to-Image Diffusion Models for Subject-Driven Generation](https://arxiv.org/abs/2208.12242) — DreamBooth.
- [HuggingFace Diffusers — ControlNet / LoRA / IP-Adapter docs](https://huggingface.co/docs/diffusers/training/controlnet) — reference pipelines.
