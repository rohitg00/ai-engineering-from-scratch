# 3D 生成

> 3D は、2D-to-3D の leverage が最も強い modality です。2023 年のブレイクスルーは 3D Gaussian Splatting でした。2024-2026 年の生成系の流れは、その上に multi-view diffusion + 3D reconstruction を重ね、単一の prompt や photo から object と scene を生成することです。

**種別:** 学習
**言語:** Python
**前提条件:** Phase 4 (Vision), Phase 8 · 07 (Latent Diffusion)
**所要時間:** 約45分

## 課題

3D content は扱いが難しいです。

- **Representation.** Meshes、point clouds、voxel grids、signed distance fields (SDFs)、neural radiance fields (NeRFs)、3D Gaussians。それぞれにトレードオフがあります。
- **Data scarcity.** ImageNet には 14M images があります。最大級のクリーンな 3D dataset (Objaverse-XL, 2023) は約 10M objects ですが、多くは低品質です。
- **Memory.** 512³ voxel grid は 128M voxels です。有用な scene NeRF には 1M samples/ray が必要です。生成は再構成より難しいです。
- **Supervision.** 2D 画像では pixels があります。3D では通常、少数の 2D views しかなく、それを 3D に lift する必要があります。

2026 年の stack は 2 つの問題を分けます。まず、拡散モデルで *2D multi-view images* を生成します。次に、それらの画像に *3D representation*、通常は Gaussian splatting、を fit します。

## コンセプト

![3D generation: multi-view diffusion + 3D reconstruction](../assets/3d-generation.svg)

### Representation: 3D Gaussian Splatting (Kerbl et al., 2023)

scene を約 1M 個の 3D Gaussians の cloud として表現します。各 Gaussian は 59 parameters を持ちます。position (3)、covariance (6、または quaternion 4 + scale 3)、opacity (1)、spherical-harmonics color (degree 3 で 48、degree 0 で 3) です。

Rendering = projection + alpha-compositing です。高速で、4090 上の 1080p で約 100 fps。微分可能です。ground-truth photos に対して gradient descent で fit します。consumer GPU で scene を 5-30 分で fit できます。

その上にある 2023-2024 年の 2 つの革新:

- **Generative Gaussian splats.** LGM、LRM、InstantMesh のようなモデルは、1 枚または少数の画像から Gaussian cloud を直接予測します。
- **4D Gaussian Splatting.** 動的 scene のために、フレームごとの offset を持つ Gaussians です。

### Multi-view diffusion

事前訓練済み画像拡散モデルを fine-tune し、テキストプロンプトまたは単一画像から、同じ object の複数の一貫した view を生成します。Zero123 (Liu et al., 2023)、MVDream (Shi et al., 2023)、SV3D (Stability, 2024)、CAT3D (Google, 2024)。通常は object 周囲の 4-16 views を出力し、それを Gaussian splatting または NeRF で 3D に lift します。

### Text-to-3D pipelines

| モデル | 入力 | 出力 | 時間 |
|-------|-------|--------|------|
| DreamFusion (2022) | text | NeRF via SDS | ~1 hour per asset |
| Magic3D | text | mesh + texture | 約40分 |
| Shap-E (OpenAI, 2023) | text | implicit 3D | 約1分 |
| SJC / ProlificDreamer | text | NeRF / mesh | 約30分 |
| LRM (Meta, 2023) | image | triplane | ~5 s |
| InstantMesh (2024) | image | mesh | ~10 s |
| SV3D (Stability, 2024) | image | novel views | 約2分 |
| CAT3D (Google, 2024) | 1-64 images | 3D NeRF | 約1分 |
| TripoSR (2024) | image | mesh | ~1 s |
| Meshy 4 (2025) | text + image | PBR mesh | ~30 s |
| Rodin Gen-1.5 (2025) | text + image | PBR mesh | ~60 s |
| Tencent Hunyuan3D 2.0 (2025) | image | mesh | ~30 s |

2025-2026 年の方向性は、game engines に適した PBR materials を持つ direct text-to-mesh models です。一般的な objects では、multi-view diffusion を中間ステップにするレシピが、まだ最も性能のよい方法です。

### NeRF (文脈として)

Neural Radiance Field (Mildenhall et al., 2020)。小さな MLP が `(x, y, z, view direction)` を受け取り、`(color, density)` を出力します。ray に沿って積分して render します。mesh-based novel-view synthesis より品質は高いですが、render は 100-1000 倍遅いです。ほとんどの real-time use では Gaussian splatting に置き換えられましたが、研究では依然として主要です。

## 実装

`code/main.py` は、toy 2D "Gaussian splatting" fit を実装しています。合成 target image、滑らかな gradient、を 2D Gaussian splats の和として表現します。target に合うよう、positions、colors、covariances を gradient descent で最適化します。forward render (splat + alpha-composite) と gradient descent による fit という 2 つの中核操作を確認できます。

### Step 1: 2D Gaussian splat

```python
def gaussian_at(x, y, gaussian):
    px, py = gaussian["pos"]
    sigma = gaussian["sigma"]
    d2 = (x - px) ** 2 + (y - py) ** 2
    return math.exp(-d2 / (2 * sigma * sigma))
```

### Step 2: splats を足し合わせて render する

```python
def render(image_size, gaussians):
    img = [[0.0] * image_size for _ in range(image_size)]
    for g in gaussians:
        for y in range(image_size):
            for x in range(image_size):
                img[y][x] += g["color"] * gaussian_at(x, y, g)
    return img
```

実際の 3D Gaussian splatting は、Gaussians を depth で sort し、順番に alpha-composite します。この 2D toy は単純に足し合わせます。

### Step 3: gradient descent で fit する

```python
for step in range(steps):
    pred = render(size, gaussians)
    loss = mse(pred, target)
    gradients = compute_grads(pred, target, gaussians)
    update(gaussians, gradients, lr)
```

## 落とし穴

- **View inconsistency.** 4 views を独立に生成し、それらが object structure について矛盾していると、3D fit はぼやけます。対策: shared attention を持つ multi-view diffusion。
- **Back-side hallucination.** Single-image → 3D では、見えていない裏側を発明する必要があります。品質は大きくばらつきます。
- **Gaussian splat explosion.** 制約なしの訓練では 10M splats まで増え、overfit します。3D-GS original paper の densification + pruning heuristics が不可欠です。
- **Topology issues.** implicit fields (SDFs) からの meshes は、穴や self-intersections を持つことがよくあります。出荷前に remesher、たとえば blender の voxel remesh、を実行します。
- **License of training data.** Objaverse は mixed licenses です。商用利用可否はモデルごとに異なります。

## 使いどころ

| タスク | 2026 年の選択 |
|------|-----------|
| 写真からの scene reconstruction | Gaussian splatting (3DGS, Gsplat, Scaniverse) |
| games 向け text-to-3D object | Meshy 4 または Rodin Gen-1.5 (PBR output) |
| Image-to-3D | Hunyuan3D 2.0、TripoSR、InstantMesh |
| 少数画像からの novel-view synthesis | CAT3D、SV3D |
| Dynamic scene reconstruction | 4D Gaussian Splatting |
| Avatar / clothed human | Gaussian Avatar、HUGS |
| Research / SOTA | 先週出たもの |

game や e-commerce pipeline で本番 3D を出荷するなら、正解は Meshy 4 または Rodin Gen-1.5 です。Unity / Unreal にそのまま入る PBR meshes を出力します。

## 出荷

`outputs/skill-3d-pipeline.md` を保存します。このスキルは、3D brief (input: text / one image / few images; output: mesh / splat / NeRF; usage: render / game / VR) を受け取り、pipeline (multi-view diffusion + fit, or direct mesh model)、base model、iteration budget、topology post-processing、必要な material channels を出力します。

## 演習

1. **Easy.** 4、16、64 Gaussians で `code/main.py` を実行してください。target に対する final MSE を報告してください。
2. **Medium.** color Gaussians (RGB) に拡張してください。再構成が target color pattern と一致することを確認してください。
3. **Hard.** gsplat または Nerfstudio を使い、50-photo capture から実物体を再構成してください。fit time と held-out views 上の final SSIM を報告してください。

## 重要用語

| 用語 | よく言われること | 実際の意味 |
|------|-----------------|-----------------------|
| 3D Gaussian Splatting | "3DGS" | 3D Gaussians の cloud として scene を表す。微分可能な alpha-composite render。 |
| NeRF | "Neural radiance field" | 3D point で color + density を出力する MLP。ray integration で render する。 |
| Triplane | "Three 2-D planes" | 3D を 3 つの axis-aligned 2-D feature grids に分解する。volumetric より安価。 |
| SDS | "Score distillation sampling" | 2D-diffusion score を pseudo-gradient として使い、3D model を訓練する。 |
| Multi-view diffusion | "Many views at once" | 一貫した camera views の batch を出力する diffusion model。 |
| PBR | "Physically-based rendering" | albedo、roughness、metallic、normal channels を持つ material。 |
| Densification | "Grow splats" | 3DGS training heuristic。高 gradient 領域で splats を split / clone する。 |

## 本番メモ: 3D にはまだ共有基盤がない

image (latent diffusion + DiT) や video (spatiotemporal DiT) と異なり、2026 年の 3D には単一の支配的 runtime がありません。本番の意思決定ツリーは representation によって分岐します。

- **NeRF / triplane.** 推論は ray-marching + sample ごとの MLP forward です。512² render には数百万回の MLP forwards が必要です。ray samples を積極的に batch します。SDPA/xformers が適用できます。
- **Multi-view diffusion + LRM reconstruction.** 2 段階パイプラインです。Stage 1 (multi-view DiT) は Lesson 07 と同じ diffusion server です。Stage 2 (LRM transformer) は views に対する one-shot forward pass です。全体の latency profile は "diffusion + one-shot" なので、stage ごとに serving primitives を選びます。
- **SDS / DreamFusion.** per-asset optimization であり、inference ではありません。request handlers ではなく jobs を作ります。

2026 年の大半のプロダクトでは、正解は「リクエスト時に multi-view diffusion model を実行し、非同期で 3DGS に reconstruct し、real-time viewing 用に 3DGS を serve する」です。これにより、GPU-inference server (fast) と offline optimizer (slow) の間で workload をきれいに分割できます。

## 参考文献

- [Mildenhall et al. (2020). NeRF: Representing Scenes as Neural Radiance Fields](https://arxiv.org/abs/2003.08934) — NeRF。
- [Kerbl et al. (2023). 3D Gaussian Splatting for Real-Time Radiance Field Rendering](https://arxiv.org/abs/2308.04079) — 3DGS。
- [Poole et al. (2022). DreamFusion: Text-to-3D using 2D Diffusion](https://arxiv.org/abs/2209.14988) — SDS。
- [Liu et al. (2023). Zero-1-to-3: Zero-shot One Image to 3D Object](https://arxiv.org/abs/2303.11328) — Zero123。
- [Shi et al. (2023). MVDream](https://arxiv.org/abs/2308.16512) — multi-view diffusion。
- [Hong et al. (2023). LRM: Large Reconstruction Model for Single Image to 3D](https://arxiv.org/abs/2311.04400) — LRM。
- [Gao et al. (2024). CAT3D: Create Anything in 3D with Multi-View Diffusion Models](https://arxiv.org/abs/2405.10314) — CAT3D。
- [Stability AI (2024). Stable Video 3D (SV3D)](https://stability.ai/research/sv3d) — SV3D。
