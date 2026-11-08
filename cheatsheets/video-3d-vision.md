---
id: video-3d-vision
title: Video, Depth and 3D Vision
code: VD
subtitle: Sample frames, model time, render NeRFs and Gaussian splats, predict depth and track objects across frames.
hue: 190
sources: phases/04-computer-vision/12-video-understanding, phases/04-computer-vision/13-3d-vision-nerf, phases/04-computer-vision/22-3d-gaussian-splatting, phases/04-computer-vision/26-monocular-depth, phases/04-computer-vision/27-multi-object-tracking, phases/04-computer-vision/28-world-models-video-diffusion
source_hash: c86ac84265db2ca6
---

## Video models
type: concepts
from: phases/04-computer-vision/12-video-understanding/docs/en.md

- **2D + pool**: CNN per frame, mean over time.
- **3D conv**: (T, H, W) kernels. Models motion.
- **I3D**: inflate 2D kernels along time.
- **(2+1)D**: 2D spatial, then 1D temporal conv.
- **Divided**: attention over time, then space.
- **Uniform**: T frames evenly. 2D+pool default.
- **Dense**: random contiguous window. 3D convs.
- **Clip / video acc**: one clip or mean of clips.

## Pick a 3D, depth or tracking model
type: concepts
from: phases/04-computer-vision/13-3d-vision-nerf/docs/en.md, phases/04-computer-vision/22-3d-gaussian-splatting/docs/en.md, phases/04-computer-vision/26-monocular-depth/docs/en.md, phases/04-computer-vision/27-multi-object-tracking/docs/en.md

- **NeRF**: an MLP is the scene. Hours to train.
- **3DGS**: explicit Gaussians. Minutes to train.
- **Depth Anything V3**: relative, frozen DINOv2.
- **ZoeDepth**: metric. Sensitive to intrinsics.
- **Marigold**: diffusion depth. 10-50 steps.
- **ByteTrack**: cars and people at 30+ fps.
- **DeepSORT**: heavy occlusion, ReID features.
- **SAM 3.1 Multiplex**: crowds of one class.

## Tracking by detection
type: architecture
from: phases/04-computer-vision/27-multi-object-tracking/docs/en.md

```arch
node | frame | 1,1 | Frame t | video input | client
node | det | 2,1 | Detector | detections at t | model
node | assoc | 3,1 | Hungarian assignment | IoU, cosine, motion
node | upd | 4,1 | Update | matched tracks
node | prev | 1,2 | Tracks up to t-1 | | store
node | kal | 2,2 | Kalman predict | constant velocity
node | born | 3,2 | Birth | new tracks
node | age | 4,2 | Age unmatched | delete after N
edge | frame | det |
edge | det | assoc | detections
edge | prev | kal |
edge | kal | assoc | predicted boxes
edge | assoc | upd | matched
edge | assoc | born | unmatched detections
edge | assoc | age | unmatched tracks
```

## Formulas
type: concepts
from: phases/04-computer-vision/13-3d-vision-nerf/docs/en.md, phases/04-computer-vision/22-3d-gaussian-splatting/docs/en.md, phases/04-computer-vision/26-monocular-depth/docs/en.md, phases/04-computer-vision/27-multi-object-tracking/docs/en.md

- **PointNet**: $f(P) = \max_{p \in P} \mathrm{MLP}(p)$. Point order does not change it.
- **Positional encoding**: $\sin(2^l \pi p), \cos(2^l \pi p)$ up to $L = 10$ levels.
- **Volume render**: $C = \sum_i T_i (1 - e^{-\sigma_i \delta_i}) c_i$, $T_i = e^{-\sum_{j<i} \sigma_j \delta_j}$
- **3DGS shape**: $\Sigma = R S S^T R^T$. On screen $\Sigma' = J W \Sigma W^T J^T$.
- **3DGS pixel**: $C = \sum_i \alpha_i T_i c_i$, $T_i = \prod_{j<i} (1 - \alpha_j)$
- **Pinhole lift**: $X = (u - c_x) d / f_x$, $Y = (v - c_y) d / f_y$, $Z = d$
- **AbsRel**: mean of $|d_{pred} - d_{gt}| / d_{gt}$. Lower is better.
- **MOTA**: $1 - (FN + FP + \mathrm{IDSW}) / GT$

## Frames, inflation and (2+1)D
type: annotated-code
lang: python
from: phases/04-computer-vision/12-video-understanding/docs/en.md, phases/04-computer-vision/12-video-understanding/code/main.py

```python
idx = sample_uniform(num_frames_total, T)          # even spread
idx = sample_dense(num_frames_total, T)            # contiguous window
model = FramePool(num_classes=10)                  # ResNet-18 per frame, mean over T
x = torch.randn(2, 8, 3, 224, 224)                 # (N, T, 3, H, W)
conv2d = nn.Conv2d(3, 64, kernel_size=3, padding=1, bias=False)
conv3d = inflate_2d_to_3d(conv2d, time_kernel=3)   # repeat on time, divide by 3
c = Conv2Plus1D(3, 64)                             # spatial, then temporal
c(torch.randn(1, 3, 8, 56, 56))                    # same 3D input as conv3d
```

## Render one NeRF ray
type: annotated-code
lang: python
from: phases/04-computer-vision/13-3d-vision-nerf/docs/en.md, phases/04-computer-vision/13-3d-vision-nerf/code/main.py

```python
y = positional_encoding(x, L=10)                   # (5, 3) to (5, 60)
t_vals = torch.linspace(2.0, 6.0, N)               # N = 64 samples on the ray
delta = torch.cat([t_vals[1:] - t_vals[:-1], torch.full_like(t_vals[:1], 1e10)])
alpha = 1.0 - torch.exp(-sigma * delta)            # opacity of each sample
trans = torch.cumprod(torch.cat([torch.ones_like(alpha[..., :1]), 1.0 - alpha + 1e-10], dim=-1), dim=-1)[..., :-1]
weights = alpha * trans                            # transmittance times opacity
rendered = (weights.unsqueeze(-1) * rgb).sum(dim=-2)  # pixel colour
depth = (weights * t_vals).sum(dim=-1)             # depth along the ray
```

## Depth metrics and lifting
type: annotated-code
lang: python
from: phases/04-computer-vision/26-monocular-depth/docs/en.md, phases/04-computer-vision/26-monocular-depth/code/main.py

```python
aligned = align_scale_shift(pred, gt)              # fit a * pred + b for relative depth
abs_rel_error(aligned, gt)                         # 0.05-0.1 for production models
delta_accuracy(pred, target, threshold=1.25)       # 0.9+ for SOTA
intr = (320.0, 320.0, 160.0, 120.0)                # fx, fy, cx, cy
pc = depth_to_point_cloud(depth, intr)             # (H, W, 3)
pipe = pipeline(task="depth-estimation", model="depth-anything/Depth-Anything-V2-Large-hf")
out = pipe(image)
depth_np = np.array(out["depth"])                  # PIL grayscale to numpy
```

## IoU and Hungarian association
type: annotated-code
lang: python
from: phases/04-computer-vision/27-multi-object-tracking/docs/en.md, phases/04-computer-vision/27-multi-object-tracking/code/main.py

```python
iou = bbox_iou(track_boxes, det_boxes)             # (tracks, detections)
cost = 1 - iou
cost[iou < self.iou_threshold] = 1e6               # block weak matches
row, col = linear_sum_assignment(cost)             # minimum total cost
for r, c in zip(row, col):
    if cost[r, c] < 1.0:
        self.tracks[r].update(det_boxes[c], frame)
self.tracks = [t for t in self.tracks if frame - t.last_frame <= self.max_age]
tracker = SimpleTracker()                          # iou_threshold=0.3, max_age=5
tracks = tracker.step(dets, f)                     # list of (id, bbox)
```

## Commands and exports
type: command-table
from: phases/04-computer-vision/22-3d-gaussian-splatting/docs/en.md, phases/04-computer-vision/27-multi-object-tracking/docs/en.md

| Command | What it does |
|---|---|
| `pip install nerfstudio gsplat` | Installs the 3DGS tools |
| `ns-download-data example` | Gets an example dataset |
| `ns-train splatfacto --data path/to/data` | Trains 3DGS, 10-30 minutes on an RTX 4090 |
| `.ply` | Raw Gaussian cloud. Portable, largest file |
| `.splat` | Quantised format |
| `KHR_gaussian_splatting` | glTF standard across viewers |
| `UsdVolParticleField3DGaussianSplat` | OpenUSD schema |
| `model.track(source, tracker="bytetrack.yaml")` | YOLOv8 with ByteTrack |

## Defaults and numbers
type: defaults
from: phases/04-computer-vision/12-video-understanding/docs/en.md, phases/04-computer-vision/13-3d-vision-nerf/docs/en.md, phases/04-computer-vision/22-3d-gaussian-splatting/docs/en.md, phases/04-computer-vision/26-monocular-depth/docs/en.md, phases/04-computer-vision/27-multi-object-tracking/docs/en.md

| Setting | Default | Note |
|---|---|---|
| Frames per clip T | 8, 16, 32, or 64 | More T, more signal and compute |
| `time_kernel` | 3 | Inflated weights divided by it |
| NeRF `L` | 10 | Direction uses `L_dir=4` |
| Samples per ray | 64 | t from 2.0 to 6.0 |
| SH degree | 3 | 16 coefficients per channel, 48 floats |
| 3DGS iterations | ~30,000 | Grows ~100k Gaussians to 1-5M |
| Tracker `iou_threshold` | 0.3 | With `max_age=5` |
| Delta threshold | 1.25 | Fraction of pixels within 25% |

## Troubleshooting
type: troubleshooting
from: phases/04-computer-vision/12-video-understanding/docs/en.md, phases/04-computer-vision/13-3d-vision-nerf/docs/en.md, phases/04-computer-vision/26-monocular-depth/docs/en.md, phases/04-computer-vision/27-multi-object-tracking/docs/en.md

| Symptom | Cause | Fix |
|---|---|---|
| "Open door" equals "close door" | Temporal pooling is order-invariant | Use 3D conv or (2+1)D |
| BN breaks after inflation | Weights not scaled | Divide by `time_kernel` |
| NeRF looks blurry | No positional encoding | Add Fourier features |
| Right order, wrong metres | Relative depth model | Metric model plus intrinsics |
| Wrong depth on glass, mirrors | Reflective surfaces | Do not trust those pixels |
| High AbsRel on MiDaS output | Scale and shift not aligned | `align_scale_shift` first |
| ID switches near crowds | IoU-only association | ByteTrack second pass or ReID |
| Track lost in a short occlusion | No motion model | Add a Kalman predict step |

## Questions
type: qa
span: 2
from: phases/04-computer-vision/12-video-understanding/docs/en.md, phases/04-computer-vision/22-3d-gaussian-splatting/docs/en.md, phases/04-computer-vision/26-monocular-depth/docs/en.md, phases/04-computer-vision/27-multi-object-tracking/docs/en.md

- **Why does 3DGS match NeRF quality?** Both use the same compositing equation.
- **Why start with 2D + pool?** It reuses ImageNet weights. It is often within 5-10 points.
- **Which tracking metric?** IDF1 for who is who. HOTA for sports and comparisons.
- **What can one image not give?** Absolute scale without intrinsics, and occluded geometry.
- **Why keep low-confidence boxes?** ByteTrack matches them second. This recovers short occlusions.
