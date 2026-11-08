---
id: video-3d-generation
title: Video and 3D Generation
code: V3
subtitle: Video DiT patches and divided attention, world models, Gaussian splats, NeRF and multi-view 3D. Formulas and fixes.
hue: 170
sources: phases/08-generative-ai/10-video-generation, phases/08-generative-ai/12-3d-generation, phases/04-computer-vision/22-3d-gaussian-splatting, phases/04-computer-vision/28-world-models-video-diffusion
source_hash: 25b0ab34ed437c9b
---

## Video diffusion pipeline
type: architecture
from: phases/08-generative-ai/10-video-generation/docs/en.md, phases/04-computer-vision/28-world-models-video-diffusion/docs/en.md

```arch
node | vid | 1,1 | Video | T frames | client
node | vae | 2,1 | 3D VAE | spatiotemporal compression | model
node | patch | 3,1 | Patchify | t_p, h_p, w_p patches | process
node | txt | 1,2 | Prompt | dense re-captions | client
node | te | 2,2 | Text encoder | T5-XXL | model
node | dit | 3,2 | Video DiT | 3D positions, divided attention | gpu
node | lat | 4,2 | Denoised latent | ε or v prediction | store
node | out | 4,1 | Frames | VAE decode | client
edge | vid | vae |
edge | vae | patch | latent
edge | patch | dit | tokens
edge | txt | te |
edge | te | dit | cross-attention
edge | dit | lat | each step
edge | lat | out |
```

## Render and fit Gaussian splats
type: flow
from: phases/04-computer-vision/22-3d-gaussian-splatting/docs/en.md

1. **Project**: map each 3D Gaussian to 2D with camera extrinsics and intrinsics.
2. **Tile**: assign each 2D Gaussian to 16x16 screen tiles.
3. **Sort**: sort the Gaussians by depth in each tile.
4. **Composite**: blend front-to-back into the pixel colour.
5. **Loss**: compare the render with the ground-truth photo.
6. **Backprop**: update `(mu, q, s, alpha, c_lm)` by gradient descent.
7. **Densify**: clone small Gaussians and split large ones where the gradient is high.
8. **Prune**: remove Gaussians with low opacity. Train for ~30,000 iterations.

## Formulas and numbers
type: concepts
from: phases/04-computer-vision/22-3d-gaussian-splatting/docs/en.md, phases/04-computer-vision/28-world-models-video-diffusion/docs/en.md, phases/08-generative-ai/10-video-generation/docs/en.md

- **Covariance**: $\Sigma = R S S^T R^T$ from the quaternion and the scales.
- **Projection**: $\Sigma' = J W \Sigma W^T J^T$, a 2 × 2 covariance.
- **Composite**: $C = \sum_i \alpha_i T_i c_i$ with $T_i = \prod_{j < i} (1 - \alpha_j)$. NeRF uses the same equation.
- **SH colour**: degree L gives $(L+1)^2$ terms per channel. Degree 3 gives 16 terms.
- **Gaussian size**: about 60 floats. Five million Gaussians use 240 MB.
- **Video tokens**: $(T / P_t) \cdot (H / P_h) \cdot (W / P_w)$
- **Divided attention**: $(HW) \cdot T^2 + T \cdot (HW)^2$ instead of $O((THW)^2)$.
- **Raw video**: 10 s of 1080p at 24 fps is 240 frames, about 1.5 GB.

## Tiny video DiT
type: annotated-code
lang: python
from: phases/04-computer-vision/28-world-models-video-diffusion/code/main.py, phases/04-computer-vision/28-world-models-video-diffusion/docs/en.md

```python
vid = torch.randn(1, 4, 8, 16, 16)                # (N, C, T, H, W)
model = TinyVideoDiT(in_channels=4, dim=64, depth=2, heads=2)
out, grid = model(vid)                            # grid (4, 8, 8), out (1, 256, 32)
tokens, grid = self.patch(x)                      # Conv3d, stride equals kernel
xt = x.view(n, T, H * W, d).permute(0, 2, 1, 3).reshape(n * H * W, T, d)
a, _ = self.time_attn(self.ln1(xt), self.ln1(xt), self.ln1(xt), need_weights=False)
xs = xt.view(n, T, H * W, d).reshape(n * T, H * W, d)
a, _ = self.space_attn(self.ln2(xs), self.ln2(xs), self.ln2(xs), need_weights=False)
xs = xs + self.mlp(self.ln3(xs))                  # MLP after time and space
```

## Fit 2D splats to an image
type: annotated-code
lang: python
from: phases/04-computer-vision/22-3d-gaussian-splatting/docs/en.md, phases/04-computer-vision/22-3d-gaussian-splatting/code/main.py

```python
model = Splats2D(num_splats=64, image_size=64)
opt = torch.optim.Adam(model.parameters(), lr=0.05)
for step in range(200):
    pred = model((64, 64))                        # rasterise_2d inside
    loss = F.mse_loss(pred, target)
    opt.zero_grad(); loss.backward(); opt.step()
alphas = alphas.clamp(0.0, 0.99)                  # in rasterise_2d
order = torch.argsort(depths)                     # learned depth scalar in 2D
out = out + (T * a)[..., None] * colours_sorted[i][None, None, :]
T = T * (1.0 - a)                                 # transmittance
```

## Functions in the lessons
type: task-table
from: phases/04-computer-vision/28-world-models-video-diffusion/code/main.py, phases/04-computer-vision/28-world-models-video-diffusion/docs/en.md, phases/04-computer-vision/22-3d-gaussian-splatting/code/main.py, phases/08-generative-ai/10-video-generation/code/main.py

| Task | Code |
|---|---|
| Count video tokens | `count_tokens(T, H, W, p_t=2, p_h=8, p_w=8)` |
| Add 3D positions | `rope_3d(tokens, t_dim, h_dim, w_dim, grid)` |
| Time then space block | `DividedAttentionBlock(dim=64, heads=2)` |
| Patch plus time embed | `patchify_with_pos(noisy)` |
| Measure flicker | `frame_deltas(clip)` |
| Gaussian density | `eval_2d_gaussian(means, covs, points)` |
| Build covariances | `R @ S @ R.transpose(-1, -2)` |
| View-dependent colour | `eval_sh_degree_3(sh_coeffs, dirs)` |

## nerfstudio and export
type: command-table
from: phases/04-computer-vision/22-3d-gaussian-splatting/docs/en.md

| Command | What it does |
|---|---|
| `pip install nerfstudio gsplat` | Installs the trainer and the CUDA rasteriser |
| `ns-download-data example` | Downloads the example data |
| `ns-train splatfacto --data path/to/data` | Trains 3DGS. 10-30 minutes on an RTX 4090 |
| `.ply` | Raw Gaussian cloud. Portable, largest file |
| `.splat` | Quantised format |
| `KHR_gaussian_splatting` | glTF standard, portable across viewers |
| `UsdVolParticleField3DGaussianSplat` | OpenUSD 26.03 schema |

## 3D representations side by side
type: comparison
from: phases/08-generative-ai/12-3d-generation/docs/en.md, phases/04-computer-vision/22-3d-gaussian-splatting/docs/en.md
span: 2

| Factor | NeRF | 3D Gaussian splats | Triplane | Mesh |
|---|---|---|---|---|
| Stores | MLP weights | explicit Gaussians | three 2-D feature grids | surface plus PBR material |
| Render | ray integration | rasterise and alpha-composite | ray-marching plus an MLP | game engine |
| Speed | 100-1000x slower than mesh | ~100 fps at 1080p on a 4090 | LRM gives one in ~5 s | TripoSR gives one in ~1 s |
| Edit | retrain | move a subset of Gaussians | not covered | remesh before shipping |

## World model families
type: comparison
from: phases/04-computer-vision/28-world-models-video-diffusion/docs/en.md

| Factor | Video generation | Action-conditioned | RL world model |
|---|---|---|---|
| Input | text or image prompt | past frames + action | state + action |
| Output | video frames | next frames | next latent + reward |
| Steer mid-rollout | no | yes, latent actions | yes |
| Example | Sora 2 | Genie 3 | DreamerV3 |

## Defaults in the code
type: defaults
from: phases/04-computer-vision/28-world-models-video-diffusion/code/main.py, phases/04-computer-vision/22-3d-gaussian-splatting/docs/en.md, phases/04-computer-vision/22-3d-gaussian-splatting/code/main.py

| Setting | Default | Note |
|---|---|---|
| `patch_t`, `patch_h`, `patch_w` | 2 | `VideoPatch3D` halves T, H and W |
| `dim` | 64 | Token width |
| `heads` | 2 | Each attention in the block |
| `p_h`, `p_w` in `count_tokens` | 8 | `p_t` is 2 |
| `num_splats` | 64 | `Splats2D` in the code file |
| Adam `lr` | 0.05 | The code file uses 0.08 |
| Alpha clamp | 0.99 | Upper bound per Gaussian |
| Initial Gaussians | ~100k | Seeded from SfM points |

## Troubleshooting
type: troubleshooting
from: phases/08-generative-ai/10-video-generation/docs/en.md, phases/08-generative-ai/12-3d-generation/docs/en.md, phases/04-computer-vision/28-world-models-video-diffusion/code/main.py, phases/04-computer-vision/28-world-models-video-diffusion/docs/en.md

| Symptom | Cause | Fix |
|---|---|---|
| Frames flicker | Each frame sampled alone | Couple frames through attention or shared noise |
| Out of memory | Full 3D attention | Factorize into spatial and temporal |
| Clips over 10s drift | Errors accumulate | Sliding windows and keyframe anchors |
| Objects vanish or merge | No persistent object model | Run object permanence checks before shipping |
| Blurry 3D fit | Views disagree on structure | Multi-view diffusion with shared attention |
| 10M splats, overfit | No densify and prune control | Use densification and pruning heuristics |
| Mesh has holes | Implicit field topology | Run a remesher before shipping |
| `ValueError` in `rope_3d` | `t_dim+h_dim+w_dim` is not D | Split D across the three axes |

## Questions
type: qa
from: phases/04-computer-vision/22-3d-gaussian-splatting/docs/en.md, phases/08-generative-ai/10-video-generation/docs/en.md, phases/08-generative-ai/12-3d-generation/docs/en.md, phases/04-computer-vision/28-world-models-video-diffusion/docs/en.md

- **Why did 3DGS replace NeRF?** It renders at 100+ fps, trains in minutes and edits directly.
- **Why does 3DGS match NeRF quality?** Both integrate the same radiance-field equation.
- **What limits a video DiT at serve time?** Memory bandwidth, not FLOPs.
- **What improved Sora most?** About 10x more detailed captions.
- **How does the 2026 3D stack work?** Diffusion makes multi-view images. A 3D fit, often splats, follows.
- **How is video quality measured?** FVD for visuals, CLIPScore per frame for prompt alignment.
