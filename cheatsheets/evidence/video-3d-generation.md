# Evidence: cheatsheets/video-3d-generation.md

Abbreviations: V = phases/08-generative-ai/10-video-generation, G = phases/08-generative-ai/12-3d-generation, GS = phases/04-computer-vision/22-3d-gaussian-splatting, W = phases/04-computer-vision/28-world-models-video-diffusion. d = docs/en.md, c = code/main.py.

## Video diffusion pipeline (architecture, 8 nodes, 7 edges)
- Video of T frames: V/d:12, W/d:55
- 3D VAE, spatiotemporal compression: V/d:14, 27
- Patchify into [t_p, h_p, w_p]: V/d:27
- Prompt with dense re-captions: V/d:39
- Text encoder T5-XXL, cross-attention: V/d:39
- Video DiT with 3D positional embedding and divided attention: V/d:31-34, W/d:61-64
- Denoised latent, ε or v prediction: V/d:43
- Frames from VAE decode: V/d:23 (patchify, DiT, decode)

## Render and fit Gaussian splats (flow, 8 steps)
1. Project with camera extrinsics and intrinsics: GS/d:47
2. Assign to 16x16 screen-space tiles: GS/d:48
3. Depth-sort per tile: GS/d:49
4. Alpha-composite front-to-back: GS/d:50-51
5. Rendered pixel loss against ground truth: GS/d:92
6. Update (mu, q, s, alpha, c_lm) by gradient descent: GS/d:92
7. Clone small, split large, high gradient: GS/d:98-99
8. Prune low opacity, ~30,000 iterations: GS/d:92, 100

## Formulas and numbers (concepts, 8)
- Sigma = R S S^T R^T: GS/d:39
- Sigma' = J W Sigma W^T J^T (2 × 2): GS/d:67
- C = sum alpha_i T_i c_i, T_i product: GS/d:81-82, same as NeRF: GS/d:88
- (L+1)^2 basis per channel, degree 3 gives 16: GS/d:39, 106
- ~60 floats per Gaussian, 240 MB for five million: GS/d:41
- token count formula: W/d:58
- divided costs (H*W) * T^2 and T * (H*W)^2, O((THW)^2): W/d:64, 216
- 240 frames, ~1.5 GB: V/d:12, 142

## Tiny video DiT (annotated-code, 9 lines)
- vid = torch.randn(1, 4, 8, 16, 16), (N, C, T, H, W): W/d:240, W/c:84
- TinyVideoDiT(in_channels=4, dim=64, depth=2, heads=2): W/c:85
- grid (4, 8, 8), out (1, 256, 32): W/d:248
- self.patch(x), Conv3d with stride equal to kernel: W/c:58, W/c:9-13, W/d:155
- time attention view and reshape: W/c:36-37
- space attention view and reshape: W/c:40-41
- MLP residual: W/c:44

## Fit 2D splats to an image (annotated-code, 10 lines)
- Splats2D(num_splats=64, image_size=64), Adam lr=0.05, 200 steps: GS/d:255-258
- pred, mse_loss, zero_grad, backward, step: GS/d:259-261
- rasterise_2d returns from forward: GS/d:231
- alphas.clamp(0.0, 0.99): GS/c:30
- torch.argsort(depths), learned scalar for order: GS/c:32, GS/d:162
- out = out + (T * a)... and T = T * (1.0 - a): GS/c:40-41

## Functions in the lessons (task-table, 8)
- count_tokens(T, H, W, p_t=2, p_h=8, p_w=8): W/c:64
- rope_3d(tokens, t_dim, h_dim, w_dim, grid): W/d:162
- DividedAttentionBlock(dim=64, heads=2): W/c:23
- patchify_with_pos(noisy): V/c:139
- frame_deltas(clip): V/c:187
- eval_2d_gaussian(means, covs, points): GS/c:8
- R @ S @ R.transpose(-1, -2): GS/c:65
- eval_sh_degree_3(sh_coeffs, dirs): GS/c:108

## nerfstudio and export (command-table, 7)
- pip install nerfstudio gsplat: GS/d:322
- ns-download-data example: GS/d:323
- ns-train splatfacto --data path/to/data, 10-30 minutes on RTX 4090: GS/d:324, 327
- .ply raw cloud, portable, largest: GS/d:331
- .splat quantised format: GS/d:332
- KHR_gaussian_splatting glTF, portable across viewers: GS/d:333
- UsdVolParticleField3DGaussianSplat OpenUSD 26.03: GS/d:15, 334

## 3D representations side by side (comparison, 4 rows)
- NeRF: MLP weights, ray integration, 100-1000x slower, retrain to edit: GS/d:19, G/d:60
- 3DGS: explicit Gaussians, rasterise and alpha-composite, ~100 fps at 1080p on a 4090, translate a subset: G/d:29, GS/d:21
- Triplane: three 2-D axis-aligned grids: G/d:142; ray-marching + MLP: G/d:152; LRM ~5 s: G/d:47
- Mesh: PBR material: G/d:145, game engines: G/d:124; TripoSR ~1 s: G/d:51; remesher: G/d:109

## World model families (comparison, 4 rows)
- Inputs and outputs of the three families: W/d:32-40
- Sora 2 cannot be steered mid-rollout: W/d:48
- Genie 3 action-conditioned with latent actions: W/d:49, 71
- DreamerV3 explicit action conditioning: W/d:50

## Defaults in the code (defaults, 8)
- patch_t=2, patch_h=2, patch_w=2: W/c:7, halves T, H, W: W/d:155
- dim=64: W/c:7
- heads=2: W/c:23
- p_h=8, p_w=8, p_t=2 in count_tokens: W/c:64
- num_splats=64 in the code file: GS/c:46
- lr=0.05 in the doc, 0.08 in the code: GS/d:256, GS/c:119
- alpha clamp 0.99: GS/c:30
- ~100k initial Gaussians from SfM points: GS/d:102

## Troubleshooting (troubleshooting, 8)
- flicker from independent per-frame sampling: V/d:97
- full 3D attention OOM, factorize: V/d:98
- long clips over 10s drift, sliding windows and keyframes: V/d:101
- lack of persistent object representation: W/d:79, plausibility checks before shipping: W/d:274
- view inconsistency, multi-view diffusion with shared attention: G/d:106
- splat explosion to 10M, densification + pruning: G/d:108
- mesh holes, run a remesher: G/d:109
- ValueError when t_dim+h_dim+w_dim != D: W/d:170-171

## Questions (qa, 6)
- 3DGS 100+ fps, minutes, direct edit: GS/d:21
- same radiance-field equation: GS/d:88
- memory bandwidth, not FLOPs: V/d:142
- ~10x more detailed captions: V/d:99
- multi-view diffusion then 3D fit: G/d:19
- FVD and CLIPScore per frame: W/d:104-105
