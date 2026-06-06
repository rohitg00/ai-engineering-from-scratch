# 3D Generation

> 3D is the modality where 2D-to-3D leverage is strongest. The 2023 breakthrough was 3D Gaussian Splatting. The 2024-2026 generative push layers multi-view diffusion + 3D reconstruction on top to produce objects and scenes from a single prompt or photo.

**Type:** Learn
**Languages:** Python
**Prerequisites:** Phase 4 (Vision), Phase 8 · 07 (Latent Diffusion)
**Time:** ~45 minutes

## The Problem

3D content is painful:

- **Representation.** Meshes, point clouds, voxel grids, signed distance fields (SDFs), neural radiance fields (NeRFs), 3D Gaussians. Each has trade-offs.
- **Data scarcity.** ImageNet has 14M images. The largest clean 3D dataset (Objaverse-XL, 2023) has ~10M objects, most low quality.
- **Memory.** A 512³ voxel grid is 128M voxels; a useful scene NeRF needs 1M samples/ray. Generation is harder than reconstruction.
- **Supervision.** For a 2D image you have the pixels. For 3D you usually have a handful of 2D views and have to lift to 3D.

The 2026 stack separates the two problems. First, generate *2D multi-view images* with a diffusion model. Second, fit a *3D representation* (usually Gaussian splatting) to those images.

## The Concept

![3D generation: multi-view diffusion + 3D reconstruction](../assets/3d-generation.svg)

### Representation: 3D Gaussian Splatting (Kerbl et al., 2023)

Represent a scene as a cloud of ~1M 3D Gaussians. Each has 59 parameters: position (3), covariance (6, or quaternion 4 + scale 3), opacity (1), spherical-harmonics color (48 at degree 3, 3 at degree 0).

Rendering = projection + alpha-compositing. Fast (~100 fps at 1080p on a 4090). Differentiable. Fit by gradient descent against ground-truth photos. A scene fits in 5-30 minutes on a consumer GPU.

Two 2023-2024 innovations on top:
- **Generative Gaussian splats.** Models like LGM, LRM, InstantMesh predict a Gaussian cloud directly from one or a few images.
- **4D Gaussian Splatting.** Gaussians with per-frame offsets for dynamic scenes.

### Multi-view diffusion

Fine-tune a pretrained image diffusion model to generate multiple consistent views of the same object from a text prompt or single image. Zero123 (Liu et al., 2023), MVDream (Shi et al., 2023), SV3D (Stability, 2024), CAT3D (Google, 2024). Usually output 4-16 views around the object, lifted to 3D via Gaussian splatting or NeRF.

### Text-to-3D pipelines

| Model | Input | Output | Time |
|-------|-------|--------|------|
| DreamFusion (2022) | text | NeRF via SDS | ~1 hour per asset |
| Magic3D | text | mesh + texture | ~40 min |
| Shap-E (OpenAI, 2023) | text | implicit 3D | ~1 min |
| SJC / ProlificDreamer | text | NeRF / mesh | ~30 min |
| LRM (Meta, 2023) | image | triplane | ~5 s |
| InstantMesh (2024) | image | mesh | ~10 s |
| SV3D (Stability, 2024) | image | novel views | ~2 min |
| CAT3D (Google, 2024) | 1-64 images | 3D NeRF | ~1 min |
| TripoSR (2024) | image | mesh | ~1 s |
| Meshy 4 (2025) | text + image | PBR mesh | ~30 s |
| Rodin Gen-1.5 (2025) | text + image | PBR mesh | ~60 s |
| Tencent Hunyuan3D 2.0 (2025) | image | mesh | ~30 s |

2025-2026 direction: direct text-to-mesh models with PBR materials suitable for game engines. Multi-view diffusion intermediate step is still the best-performing recipe for general objects.

### NeRF (for context)

Neural Radiance Field (Mildenhall et al., 2020). A tiny MLP takes `(x, y, z, view direction)` and outputs `(color, density)`. Render by integrating along rays. Beats mesh-based novel-view synthesis in quality but is 100-1000x slower to render. Superseded by Gaussian splatting for most real-time use but still dominant in research.

## Build It

`code/main.py` implements a toy 2D "Gaussian splatting" fit: represent a synthetic target image (a smooth gradient) as a sum of 2D Gaussian splats. Optimize positions, colors, and covariances by gradient descent to match the target. You see the two core operations: forward render (splat + alpha-composite) and fit by gradient descent.

### Step 1: 2D Gaussian splat

```python
def gaussian_at(x, y, gaussian):
    px, py = gaussian["pos"]
    sigma = gaussian["sigma"]
    d2 = (x - px) ** 2 + (y - py) ** 2
    return math.exp(-d2 / (2 * sigma * sigma))
```

### Step 2: render by summing splats

```python
def render(image_size, gaussians):
    img = [[0.0] * image_size for _ in range(image_size)]
    for g in gaussians:
        for y in range(image_size):
            for x in range(image_size):
                img[y][x] += g["color"] * gaussian_at(x, y, g)
    return img
```

Real 3D Gaussian splatting sorts Gaussians by depth and alpha-composites in order. Our 2D toy just sums.

### Step 3: fit by gradient descent

```python
for step in range(steps):
    pred = render(size, gaussians)
    loss = mse(pred, target)
    gradients = compute_grads(pred, target, gaussians)
    update(gaussians, gradients, lr)
```

## Pitfalls

- **View inconsistency.** If you generate 4 views independently and they disagree about object structure, the 3D fit is blurry. Fix: multi-view diffusion with shared attention.
- **Back-side hallucination.** Single-image → 3D has to invent the unseen side. Quality varies wildly.
- **Gaussian splat explosion.** Unconstrained training grows to 10M splats and overfits. Densification + pruning heuristics (from 3D-GS original paper) are essential.
- **Topology issues.** Meshes from implicit fields (SDFs) often have holes or self-intersections. Run a remesher (e.g. blender's voxel remesh) before shipping.
- **License of training data.** Objaverse has mixed licenses; commercial use varies per model.

## Use It

| Task | 2026 pick |
|------|-----------|
| Scene reconstruction from photos | Gaussian splatting (3DGS, Gsplat, Scaniverse) |
| Text-to-3D object for games | Meshy 4 or Rodin Gen-1.5 (PBR output) |
| Image-to-3D | Hunyuan3D 2.0, TripoSR, InstantMesh |
| Novel-view synthesis from few images | CAT3D, SV3D |
| Dynamic scene reconstruction | 4D Gaussian Splatting |
| Avatar / clothed human | Gaussian Avatar, HUGS |
| Research / SOTA | Whatever dropped last week |

For shipping production 3D in a game or e-commerce pipeline: Meshy 4 or Rodin Gen-1.5 output PBR meshes that go straight into Unity / Unreal.

## Ship It

Save `outputs/skill-3d-pipeline.md`. Skill takes a 3D brief (input: text / one image / few images; output: mesh / splat / NeRF; usage: render / game / VR) and outputs: pipeline (multi-view diffusion + fit, or direct mesh model), base model, iteration budget, topology post-processing, material channels needed.

## Exercises

1. **Easy.** Run `code/main.py` with 4, 16, 64 Gaussians. Report final MSE vs target.
2. **Medium.** Extend to color Gaussians (RGB). Confirm reconstruction matches the target color pattern.
3. **Hard.** Using gsplat or Nerfstudio, reconstruct a real object from a 50-photo capture. Report fit time and final SSIM on held-out views.

## Key Terms

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| 3D Gaussian Splatting | "3DGS" | Scene as a cloud of 3D Gaussians; differentiable alpha-composite render. |
| NeRF | "Neural radiance field" | MLP that outputs color + density at a 3D point; render by ray integration. |
| Triplane | "Three 2-D planes" | Factor 3D into three 2-D axis-aligned feature grids; cheaper than volumetric. |
| SDS | "Score distillation sampling" | Train 3D model by using 2D-diffusion score as pseudo-gradient. |
| Multi-view diffusion | "Many views at once" | Diffusion model that outputs a batch of consistent camera views. |
| PBR | "Physically-based rendering" | Material with albedo, roughness, metallic, normal channels. |
| Densification | "Grow splats" | 3DGS training heuristic: split / clone splats in high-gradient regions. |

## Production note: 3D has no shared substrate yet

Unlike image (latent diffusion + DiT) and video (spatiotemporal DiT), 3D has no single dominant runtime in 2026. The production decision tree forks on the representation:

- **NeRF / triplane.** Inference is ray-marching + an MLP forward per sample. A 512² render requires millions of MLP forwards. Batch the ray samples aggressively; SDPA/xformers applies.
- **Multi-view diffusion + LRM reconstruction.** Two-stage pipeline. Stage 1 (multi-view DiT) is a diffusion server just like Lesson 07. Stage 2 (LRM transformer) is a one-shot forward pass over the views. The overall latency profile is "diffusion + one-shot" — pick per-stage serving primitives accordingly.
- **SDS / DreamFusion.** Per-asset optimization, not inference. Build jobs, not request handlers.

For most 2026 products, the right answer is "run a multi-view diffusion model on request, reconstruct to 3DGS asynchronously, serve the 3DGS for real-time viewing". This splits the workload cleanly between a GPU-inference server (fast) and an offline optimizer (slow).

## Further Reading

- [Mildenhall et al. (2020). NeRF: Representing Scenes as Neural Radiance Fields](https://arxiv.org/abs/2003.08934) — NeRF.
- [Kerbl et al. (2023). 3D Gaussian Splatting for Real-Time Radiance Field Rendering](https://arxiv.org/abs/2308.04079) — 3DGS.
- [Poole et al. (2022). DreamFusion: Text-to-3D using 2D Diffusion](https://arxiv.org/abs/2209.14988) — SDS.
- [Liu et al. (2023). Zero-1-to-3: Zero-shot One Image to 3D Object](https://arxiv.org/abs/2303.11328) — Zero123.
- [Shi et al. (2023). MVDream](https://arxiv.org/abs/2308.16512) — multi-view diffusion.
- [Hong et al. (2023). LRM: Large Reconstruction Model for Single Image to 3D](https://arxiv.org/abs/2311.04400) — LRM.
- [Gao et al. (2024). CAT3D: Create Anything in 3D with Multi-View Diffusion Models](https://arxiv.org/abs/2405.10314) — CAT3D.
- [Stability AI (2024). Stable Video 3D (SV3D)](https://stability.ai/research/sv3d) — SV3D.
