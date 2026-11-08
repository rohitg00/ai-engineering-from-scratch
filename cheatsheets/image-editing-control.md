---
id: image-editing-control
title: ControlNet, Inpainting and Image Editing
code: CI
subtitle: Diffusers calls for text to image, img2img, inpainting, LoRA and ControlNet. Knobs, defaults and fixes.
hue: 265
sources: phases/08-generative-ai/08-controlnet-lora-conditioning, phases/08-generative-ai/09-inpainting-outpainting-editing, phases/04-computer-vision/11-stable-diffusion
source_hash: a2512a00213a927e
---

## Control signals into the U-Net
type: architecture
from: phases/08-generative-ai/08-controlnet-lora-conditioning/docs/en.md, phases/04-computer-vision/11-stable-diffusion/docs/en.md

```arch
node | cond | 1,1 | Condition image | depth, pose, edges | client
node | cn | 2,1 | ControlNet | cloned encoder, trainable | model
node | zc | 3,1 | Zero conv | 1×1, starts at zero | process
node | txt | 1,2 | Prompt | | client
node | te | 2,2 | Text encoder | CLIP-L or T5 | model
node | unet | 3,2 | Frozen SD U-Net | cross-attention to text | gpu
node | ref | 1,3 | Reference image | | client
node | ip | 2,3 | IP-Adapter | CLIP image tokens | model
node | lora | 3,3 | LoRA | W + BA in attention | store
edge | cond | cn |
edge | cn | zc | features
edge | zc | unet | added to decoder
edge | txt | te |
edge | te | unet | text tokens
edge | ref | ip |
edge | ip | unet | image tokens
edge | lora | unet | low-rank delta
```

## Text to image
type: annotated-code
lang: python
from: phases/04-computer-vision/11-stable-diffusion/docs/en.md, phases/04-computer-vision/11-stable-diffusion/code/main.py

```python
pipe = StableDiffusionPipeline.from_pretrained(
    "runwayml/stable-diffusion-v1-5",
    torch_dtype=torch.float16,            # halves VRAM
).to("cuda")
pipe.scheduler = DPMSolverMultistepScheduler.from_config(pipe.scheduler.config)
image = pipe(
    prompt="<prompt>",
    guidance_scale=7.5,                   # CFG scale w, SD default
    num_inference_steps=25,               # matches 50 steps of DDIM
    generator=torch.Generator("cuda").manual_seed(42),
).images[0]
image.save("dog.png")
```

## Img2img, inpaint and LoRA
type: annotated-code
lang: python
from: phases/04-computer-vision/11-stable-diffusion/docs/en.md, phases/08-generative-ai/08-controlnet-lora-conditioning/docs/en.md

```python
out = img2img(prompt="<prompt>", image=init_image,
              strength=0.6, guidance_scale=7.5).images[0]     # 0.0 unchanged, 1.0 new
mask = Image.open("dog_mask.png").convert("L").resize((512, 512))
out = inpaint(prompt="<prompt>", image=image,
              mask_image=mask, guidance_scale=7.5).images[0]  # white pixels regenerate
pipe.load_lora_weights("<repo>", weight_name="<file>")
pipe.fuse_lora(lora_scale=0.8)                                # bakes in, no swap
pipe.unfuse_lora()                                            # before another adapter
pipe.set_adapters([...], adapter_weights=[...])               # per-request LoRA mix
```

## Tasks in code
type: task-table
from: phases/04-computer-vision/11-stable-diffusion/docs/en.md, phases/04-computer-vision/11-stable-diffusion/code/main.py, phases/08-generative-ai/09-inpainting-outpainting-editing/docs/en.md

| Task | Code |
|---|---|
| Install the stack | `pip install diffusers transformers accelerate` |
| Image to image | `StableDiffusionImg2ImgPipeline` |
| Inpaint with SD | `StableDiffusionInpaintPipeline` |
| Inpaint with Flux | `FluxFillPipeline` |
| Stochastic sampler | `EulerAncestralDiscreteScheduler` |
| Encode to latents | `pipe.image_processor.preprocess(img)` |
| Reuse old latents | pass `latents=...` and skip one VAE encode |
| Scale VAE latents | `latent_dist.sample() * 0.18215` |

## Mask-aware reverse loop
type: flow
from: phases/08-generative-ai/09-inpainting-outpainting-editing/code/main.py, phases/08-generative-ai/09-inpainting-outpainting-editing/docs/en.md

1. **Start**: draw `x` from N(0, I) for every dimension.
2. **Reinject**: noise the clean source to step t. Write it into each unmasked dimension.
3. **Predict**: the denoiser gives `eps_hat` for `x` at step t.
4. **Reverse**: compute the DDPM mean. Add noise when t > 0.
5. **Repeat**: go from t = T - 1 down to 0.
6. **Pin**: copy the clean values into the unmasked dimensions at the end.
7. **Outpaint**: invert the mask. The training objective stays the same.

## Formulas and numbers
type: concepts
from: phases/04-computer-vision/11-stable-diffusion/docs/en.md, phases/08-generative-ai/08-controlnet-lora-conditioning/docs/en.md, phases/08-generative-ai/09-inpainting-outpainting-editing/docs/en.md

- **CFG**: $\epsilon = \epsilon_{\text{uncond}} + w \cdot (\epsilon_{\text{cond}} - \epsilon_{\text{uncond}})$
- **LoRA**: $W' = W + \alpha \cdot B A$ with $r \ll d$. New parameters: $2 \cdot d \cdot r$ instead of $d^2$.
- **LoRA size**: $d=640$, $r=16$ gives 20k parameters instead of 410k.
- **ControlNet mix**: `features += weight_a * control_a(depth) + weight_b * control_b(pose)`
- **Latent diffusion**: 3x512x512 to 4x64x64 cuts compute by 48x.
- **Inpaint U-Net**: 9 input channels. Noisy latent 4, encoded image 4, mask 1.
- **SDEdit t/T**: 0.3 nearly the source. 0.6 keeps coarse structure. 0.9 near noise.
- **Zero conv**: ControlNet starts as identity. It does no harm before training.

## Editing methods side by side
type: comparison
from: phases/08-generative-ai/09-inpainting-outpainting-editing/docs/en.md, phases/04-computer-vision/11-stable-diffusion/docs/en.md
span: 2

| Factor | Inpaint model | SDEdit or img2img | InstructPix2Pix | RePaint |
|---|---|---|---|---|
| Input | image, mask, prompt | image, noise level, prompt | image and instruction | image and mask |
| Training | 9-channel U-Net | none | fine-tune on triples | none, unconditional model |
| Keeps | pixels outside the mask | coarse structure | structure of the input | pixels outside the mask |
| Main knob | mask and CFG | `t/T` or `strength` | image scale and text scale | resample steps |
| Use for | remove object, replace sky | style of one region | "make it sunset" | no inpaint model at hand |

## Conditioning tools side by side
type: comparison
from: phases/08-generative-ai/08-controlnet-lora-conditioning/docs/en.md
span: 2

| Factor | ControlNet | LoRA | IP-Adapter | DreamBooth |
|---|---|---|---|---|
| Controls | spatial structure | style, subject, concept | look of a reference image | one subject |
| Size | 70-360MB | 20-200MB | 20MB | 2-5GB |
| Mechanism | cloned encoder, zero-conv skips | low-rank delta on attention | CLIP image tokens in cross-attention | full fine-tune |
| Use when | exact layout or composition | personalization or style | no text describes the look | strong identity, high compute |

## Defaults
type: defaults
from: phases/04-computer-vision/11-stable-diffusion/docs/en.md, phases/04-computer-vision/11-stable-diffusion/code/main.py, phases/08-generative-ai/08-controlnet-lora-conditioning/docs/en.md, phases/08-generative-ai/09-inpainting-outpainting-editing/docs/en.md

| Setting | Default | Note |
|---|---|---|
| `guidance_scale` | 7.5 | SD default CFG scale |
| `num_inference_steps` | 25 | With DPM-Solver++ |
| img2img `strength` | 0.6 | 0.5-0.7 for style transfer |
| Prompt drop in CFG training | 10% | Gives the unconditional branch |
| VAE scale factor | 0.18215 | SDXL uses 0.13025 |
| LoRA rank `r` | 4-16 | 64-128 for heavy fine-tunes |
| Sum of ControlNet weights | 1.0 | Safe default |
| Mask dilation in pixels | 8-16 | Hides seams |

## Troubleshooting
type: troubleshooting
from: phases/08-generative-ai/08-controlnet-lora-conditioning/docs/en.md, phases/08-generative-ai/09-inpainting-outpainting-editing/docs/en.md, phases/04-computer-vision/11-stable-diffusion/docs/en.md

| Symptom | Cause | Fix |
|---|---|---|
| Over-stylized or broken output | LoRA α at 2 or 3 | Keep α at 1.5 or below |
| Pose plus depth overshoots | Two ControlNets at weight 1.0 | Make the weights sum to 1.0 |
| LoRA has no effect | SDXL LoRA on SD 1.5 | Match the base model |
| Cannot load another LoRA | `fuse_lora` baked it in | Call `pipe.unfuse_lora()` first |
| Visible seams at the mask | Naive reinjection | Dilate the mask or use a 9-channel model |
| Saturated patch | High CFG on a small mask | Reduce CFG for small edits |
| Subject loses identity | SDEdit `t/T` from 0.5 to 0.6 | Sweep and checkpoint |
| Fill ignores the scene | Prompt names only the new content | Describe the whole image |

## Use X when
type: tips
from: phases/08-generative-ai/08-controlnet-lora-conditioning/docs/en.md, phases/08-generative-ai/09-inpainting-outpainting-editing/docs/en.md, phases/04-computer-vision/11-stable-diffusion/docs/en.md

- **ControlNet-Openpose + SDXL + text**: a specific pose with a prompt.
- **ControlNet-Scribble or ControlNet-Canny**: an exact layout.
- **LoRA on ~30 curated images at rank 32**: a brand art style.
- **SD-Inpaint or Flux-Fill**: remove an object under a small mask.
- **SAM mask, then SD-Inpaint**: background replacement.
- **InstructPix2Pix or Flux-Kontext**: an instruction edit with no mask.
- **LCM-LoRA**: latency under 1s.

## Questions
type: qa
from: phases/08-generative-ai/08-controlnet-lora-conditioning/docs/en.md, phases/08-generative-ai/09-inpainting-outpainting-editing/docs/en.md, phases/04-computer-vision/11-stable-diffusion/docs/en.md

- **Why init the ControlNet gate at zero?** At step 0 the output is identical to the base.
- **Merge LoRAs or hot-swap them?** Hot-swap. A merge is 3-5% faster but freezes α and the base.
- **Why does strength 1.0 ignore the input?** It adds full noise. The result is a full regeneration.
- **Why use a 9-channel model, not reinjection?** The model sees the context around the mask.
- **Can I swap the scheduler after training?** Yes. Scheduler state is decoupled from U-Net weights.
- **What does an extra ControlNet cost?** Budget about 1.5× step cost for each active ControlNet.
