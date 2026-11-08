# Evidence: cheatsheets/image-editing-control.md

Abbreviations: CL = phases/08-generative-ai/08-controlnet-lora-conditioning, IP = phases/08-generative-ai/09-inpainting-outpainting-editing, SD = phases/04-computer-vision/11-stable-diffusion. d = docs/en.md, c = code/main.py.

## Control signals into the U-Net (architecture, 9 nodes, 8 edges)
- Condition image: depth, pose, edges: CL/d:26
- ControlNet clones the encoder, trains the clone: CL/d:26, 134
- Zero conv, 1×1 initialized to zero, added to the decoder: CL/d:26, 29
- Prompt: SD/d:31
- Text encoder CLIP-L or T5: SD/d:31
- Frozen SD U-Net with cross-attention to text: SD/d:34, 50, CL/d:26
- Reference image: CL/d:54
- IP-Adapter, CLIP image tokens into cross-attention: CL/d:54
- LoRA W + BA on attention weights: CL/d:16, 136

## Text to image (annotated-code, 12 lines)
- StableDiffusionPipeline.from_pretrained with runwayml/stable-diffusion-v1-5, float16, cuda: SD/d:121-124
- float16 halves VRAM: SD/d:135
- DPMSolverMultistepScheduler.from_config(pipe.scheduler.config): SD/d:142, SD/c:54
- guidance_scale=7.5, SD default w=7.5: SD/d:62, 128
- num_inference_steps=25 matches 50 with DDIM: SD/d:129, 135
- torch.Generator("cuda").manual_seed(42), images[0], image.save("dog.png"): SD/d:130-132

## Img2img, inpaint and LoRA (annotated-code, 10 lines)
- img2img with image=init_image, strength=0.6, guidance_scale=7.5: SD/d:160-165
- strength 0.0 unchanged, 1.0 full regeneration: SD/d:168
- mask from Image.open("dog_mask.png").convert("L").resize((512, 512)): SD/d:181
- inpaint with mask_image=mask, white pixels regenerate: SD/d:183-191
- pipe.load_lora_weights with weight_name: SD/d:196-199
- pipe.fuse_lora(lora_scale=0.8), bakes in, prevents swapping: SD/d:200, 205
- pipe.unfuse_lora() before a different adapter: SD/d:205
- pipe.set_adapters([...], adapter_weights=[...]) per request: CL/d:147

## Tasks in code (task-table, 8)
- pip install diffusers transformers accelerate: SD/c:44
- StableDiffusionImg2ImgPipeline: SD/d:151
- StableDiffusionInpaintPipeline: SD/d:173, IP/d:40
- FluxFillPipeline: IP/d:40
- EulerAncestralDiscreteScheduler: SD/d:140, 143, stochastic: SD/d:101
- pipe.image_processor.preprocess(img): IP/d:148
- latents=... skips one VAE encode: IP/d:148
- latent_dist.sample() * 0.18215: SD/d:215, SD/c:67

## Mask-aware reverse loop (flow, 7 steps)
1. x from N(0, I): IP/c:142
2. unmasked dims get sqrt(a_bar) clean plus noise: IP/c:144-147
3. eps_hat from the denoiser: IP/c:148-149
4. DDPM mean, noise only when t > 0: IP/c:150-156
5. loop from T - 1 down to 0: IP/c:143
6. unmasked dims pinned to clean at the end: IP/c:157-159
7. outpainting inverts the mask, same objective: IP/d:95

## Formulas and numbers (concepts, 8)
- CFG formula: SD/d:59
- LoRA W' = W + alpha BA, 2·d·r instead of d²: CL/d:45, 48, 50
- d=640, r=16 gives 20k instead of 410k: CL/d:48
- ControlNet composition formula: CL/d:37
- 48x compute cut from 3x512x512 to 4x64x64: SD/d:21
- 9 input channels, 4 + 4 + 1: IP/d:32-35
- SDEdit t/T 0.3, 0.6, 0.9: IP/d:46-48
- Zero-conv init starts as identity, no harm: CL/d:32

## Editing methods side by side (comparison, 5 rows)
- Input: image, mask, prompt: IP/d:16, 32-38. SDEdit image, noise level, prompt: IP/d:44. InstructPix2Pix image and instruction: IP/d:52. RePaint image and mask: IP/d:56
- Training: 9-channel U-Net: IP/d:32. SDEdit none: IP/d:44. InstructPix2Pix fine-tune on triples: IP/d:52. RePaint none, unconditional model: IP/d:56
- Keeps: outside the mask: IP/d:16. SDEdit coarse structure: IP/d:47. InstructPix2Pix structural fidelity: IP/d:18. RePaint outside the mask: IP/d:56
- Main knob: mask and CFG: IP/d:16, 101. SDEdit t/T or strength: IP/d:44; SD/d:168. InstructPix2Pix image and text scale: IP/d:52. RePaint resample steps: IP/d:56
- Use for: remove object, replace sky: IP/d:109-110. Style of one region: IP/d:113. Make it sunset: IP/d:114. RePaint without inpaint model: IP/d:56

## Conditioning tools side by side (comparison, 4 rows)
- Controls: CL/d:60-64
- Size: CL/d:60-64
- Mechanism: CL/d:134, 136, 139, 140
- Use when: CL/d:60-64

## Defaults (defaults, 8)
- guidance_scale 7.5: SD/d:62, SD/c:24
- num_inference_steps 25 with DPM-Solver++: SD/d:129, 135
- strength 0.6, 0.5-0.7 for style transfer: SD/d:163, 168
- c dropped 10% of the time: SD/d:56
- VAE scale 0.18215, SDXL 0.13025: SD/c:23
- rank 4-16, 64-128 for heavy fine-tunes: CL/d:48
- sum of ControlNet weights 1.0 safe default: CL/d:102
- dilate the mask by 8-16 pixels: IP/d:99

## Troubleshooting (troubleshooting, 8)
- alpha 2 or 3 over-stylized, keep alpha ≤ 1.5: CL/d:101
- two ControlNets at 1.0 overshoot: CL/d:102
- SDXL LoRA no-op on SD 1.5: CL/d:103
- fuse_lora prevents swapping, unfuse_lora: SD/d:205
- seams from naive approach, dilate or proper model: IP/d:99
- high CFG on small mask, reduce CFG: IP/d:101
- SDEdit fidelity cliff 0.5 to 0.6: IP/d:102
- prompt should describe the whole image: IP/d:103

## Use X when (tips, 7)
- ControlNet-Openpose + SDXL + text: CL/d:113
- ControlNet-Scribble or ControlNet-Canny: CL/d:116
- LoRA on ~30 curated images at rank 32: CL/d:111
- SD-Inpaint or Flux-Fill for small mask removal: IP/d:109
- SAM mask then SD-Inpaint: IP/d:115
- InstructPix2Pix or Flux-Kontext: IP/d:114, no separate mask: IP/d:150
- LCM-LoRA under 1s: SD/d:237

## Questions (qa, 6)
- zero gate, output identical to base at step 0: CL/d:97
- hot-swap, merge ~3-5% faster but freezes alpha and base: CL/d:147
- strength 1.0 full regeneration: SD/d:168, 253
- 9-channel model sees surroundings: IP/d:38, 91
- scheduler decoupled from U-Net weights: SD/d:146
- ~1.5× step cost per active ControlNet: CL/d:148
