"""
Stable Diffusion usage examples. Requires `diffusers`, `transformers`, and a GPU
for any real inference. Running this on CPU without the model is a no-op summary.
"""

import os
import torch


def has_diffusers():
    try:
        import diffusers  # noqa: F401
        return True
    except ImportError:
        return False


def describe_pipeline():
    print("[stable diffusion pipeline]")
    print("  text_encoder:   CLIP-L (SD 1.5) / CLIP-L+G (SDXL) / T5-XXL (SD3, FLUX)")
    print("  unet_params:    860M (SD 1.5) / 2.6B (SDXL) / 12B (FLUX)")
    print("  vae_latent:     4 x 64 x 64 for 512x512 input, 4 x 128 x 128 for 1024x1024")
    print("  vae_scale:      0.18215 (SD 1.5/2), 0.13025 (SDXL)")
    print("  default_cfg:    7.5")


def cfg_sweep_demo():
    values = [1.0, 3.0, 5.0, 7.5, 10.0, 15.0]
    print("\n[cfg sweep values to try on a real pipeline]")
    for w in values:
        effect = (
            "unconditional" if w <= 1.0
            else "creative but weak prompt adherence" if w < 5.0
            else "standard" if w <= 8.0
            else "strong adherence, possible oversaturation" if w <= 12.0
            else "heavy artefacts"
        )
        print(f"  w={w:5.1f}  expected: {effect}")


def text_to_image_stub(prompt, seed=42):
    print(f"\n[text_to_image] prompt={prompt!r} seed={seed}")
    if not has_diffusers():
        print("  diffusers not installed. `pip install diffusers transformers accelerate` to run.")
        return None
    if not torch.cuda.is_available():
        print("  CUDA not available; running SD on CPU is extremely slow. Skipping real call.")
        return None
    from diffusers import StableDiffusionPipeline, DPMSolverMultistepScheduler
    pipe = StableDiffusionPipeline.from_pretrained(
        "runwayml/stable-diffusion-v1-5",
        torch_dtype=torch.float16,
    ).to("cuda")
    pipe.scheduler = DPMSolverMultistepScheduler.from_config(pipe.scheduler.config)
    gen = torch.Generator("cuda").manual_seed(seed)
    out = pipe(prompt, guidance_scale=7.5, num_inference_steps=25, generator=gen).images[0]
    path = os.path.expanduser("~/sd_demo.png")
    out.save(path)
    print(f"  saved: {path}")


def lora_training_sketch():
    print("\n[lora training pseudocode]")
    pseudo = """
for step, batch in enumerate(dataloader):
    images, prompts = batch
    latents = vae.encode(images).latent_dist.sample() * 0.18215
    t = torch.randint(0, num_train_timesteps, (batch_size,))
    noise = torch.randn_like(latents)
    noisy_latents = scheduler.add_noise(latents, noise, t)
    text_emb = text_encoder(tokenizer(prompts))
    pred_noise = unet(noisy_latents, t, text_emb)       # LoRA weights injected
    loss = F.mse_loss(pred_noise, noise)
    loss.backward()
    optimizer.step()
"""
    print(pseudo)


def main():
    describe_pipeline()
    cfg_sweep_demo()
    text_to_image_stub("a dog riding a skateboard in tokyo, studio ghibli style")
    lora_training_sketch()


if __name__ == "__main__":
    main()
