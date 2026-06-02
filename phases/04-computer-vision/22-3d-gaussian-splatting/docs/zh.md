# 从零实现 3D Gaussian Splatting（3D Gaussian Splatting from Scratch）

> 译注：本文译自同目录 [`en.md`](./en.md)。术语遵循仓根 [TRANSLATION_GUIDE.md](../../../../TRANSLATION_GUIDE.md)。

> 一个场景就是数百万个 3D Gaussian 组成的「云」。每一个 Gaussian 都有位置、朝向、尺度、不透明度，以及一个随观察方向变化的颜色。把它们光栅化，再让梯度从光栅化反传回来，就完事了。

**Type:** Build
**Languages:** Python
**Prerequisites:** Phase 4 Lesson 13 (3D Vision & NeRF), Phase 1 Lesson 12 (Tensor Operations), Phase 4 Lesson 10 (Diffusion basics optional)
**Time:** ~90 minutes

## 学习目标（Learning Objectives）

- 解释为什么在 2026 年，3D Gaussian Splatting 取代 NeRF 成为照片级真实感 3D 重建的生产默认方案
- 说出每个 Gaussian 的六个参数（位置、旋转四元数、尺度、不透明度、球谐函数颜色、可选的 feature），以及每一项贡献多少个 float
- 用 `alpha` 合成（compositing）从零实现一个 2D Gaussian splatting 光栅化器，然后展示 3D 情形如何投影到同一个循环
- 使用 `nerfstudio`、`gsplat` 或 `SuperSplat`，从 20–50 张照片重建一个场景，并导出为 `KHR_gaussian_splatting` glTF 扩展，或 OpenUSD 26.03 的 `UsdVolParticleField3DGaussianSplat` schema

## 问题（Problem）

NeRF 把场景存成一个 MLP 的权重。每渲染一个像素，都要沿着射线做几百次 MLP 查询。训练耗时数小时，渲染耗时数秒，权重还无法编辑——你想把场景里的椅子挪一下，就得整体重训。

3D Gaussian Splatting（Kerbl, Kopanas, Leimkühler, Drettakis，SIGGRAPH 2023）把这一切都换掉了。场景就是一组显式的 3D Gaussian。渲染是 GPU 光栅化，100+ fps。训练只要几分钟。编辑是直接的：平移其中一部分 Gaussian，椅子就被移动了。到 2026 年，Khronos Group 已经批准了用于 Gaussian splat 的 glTF 扩展，OpenUSD 26.03 自带 Gaussian splat schema，Zillow 和 Apartments.com 用它来渲染房产，3D 重建方向新发表的论文大多是围绕 3DGS 核心思想的变体。

心智模型很简单，但数学上活动部件足够多，以至于多数入门材料都从光栅化讲起，跳过了投影和球谐函数。本课把整套流程都搭起来——先做一个 2D 版本，再扩展到 3D。

## 概念（Concept）

### 一个 Gaussian 装了什么（What a Gaussian carries）

一个 3D Gaussian 是空间中的参数化「斑块（blob）」，带有以下属性：

```
position         mu         (3,)    centre in world coordinates
rotation         q          (4,)    unit quaternion encoding orientation
scale            s          (3,)    log-scales per axis (exponentiated at render time)
opacity          alpha      (1,)    post-sigmoid opacity [0, 1]
SH coefficients  c_lm       (3 * (L+1)^2,)   view-dependent colour
```

旋转 + 尺度合成一个 3x3 的协方差矩阵：`Sigma = R S S^T R^T`。这就是 Gaussian 在 3D 中的形状。球谐函数（spherical harmonics）让颜色随观察方向变化——高光、微妙的光泽、视角相关的辉光——而不需要为每个视角单独存纹理。SH 阶数取 3 时，每个颜色通道有 16 个系数，单是颜色就要 48 个 float。

一个场景通常有 1–5 百万个 Gaussian。每个大约存 60 个 float（3 + 4 + 3 + 1 + 48 + 杂项）。一个含五百万 Gaussian 的场景大概 240 MB——比相同规模、带逐点纹理的点云小得多，比 NeRF 把 MLP 权重在高分辨率重渲染的等价存储小一个数量级。

### 是光栅化，不是 ray marching（Rasterisation, not ray marching）

```mermaid
flowchart LR
    SCENE["数百万个 3D 高斯<br/>（位置、旋转、尺度、<br/>不透明度、SH 颜色）"] --> PROJ["投影到 2D<br/>（相机外参 + 内参）"]
    PROJ --> TILES["分配到 tile<br/>（16x16 屏幕空间）"]
    TILES --> SORT["逐 tile<br/>按深度排序"]
    SORT --> ALPHA["由前到后<br/>alpha 合成"]
    ALPHA --> PIX["像素颜色"]

    style SCENE fill:#dbeafe,stroke:#2563eb
    style ALPHA fill:#fef3c7,stroke:#d97706
    style PIX fill:#dcfce7,stroke:#16a34a
```

五步，全都对 GPU 友好。每个像素都不需要 MLP 查询。一块 RTX 3080 Ti 渲染六百万个 splat 能跑到 147 fps。

### 投影那一步（The projection step）

世界坐标位置为 `mu`、3D 协方差为 `Sigma` 的 3D Gaussian，投影到屏幕上，变成位置为 `mu'`、2D 协方差为 `Sigma'` 的 2D Gaussian：

```
mu' = project(mu)
Sigma' = J W Sigma W^T J^T          (2 x 2)

W = viewing transform (rotation + translation of camera)
J = Jacobian of the perspective projection at mu'
```

2D Gaussian 在屏幕上的覆盖范围是一个椭圆，椭圆的轴是 `Sigma'` 的特征向量（eigenvector）。落在椭圆内的每个像素都按 `exp(-0.5 * (p - mu')^T Sigma'^-1 (p - mu'))` 加权接收这个 Gaussian 的贡献。

### Alpha 合成规则（The alpha-compositing rule）

对单个像素，覆盖它的所有 Gaussian 按从后到前（或者用反向公式做从前到后）排序。颜色用 1980 年代以来所有半透明光栅化器都在用的同一个公式合成：

```
C_pixel = sum_i alpha_i * T_i * c_i

T_i = prod_{j < i} (1 - alpha_j)       transmittance up to i
alpha_i = opacity_i * exp(-0.5 * d^T Sigma'^-1 d)   local contribution
c_i = eval_SH(SH_i, view_direction)    view-dependent colour
```

这**和 NeRF 的体渲染（volumetric render）方程是同一个**，只不过这次是在显式、稀疏的 Gaussian 集合上积分，而不是沿着射线密集采样。正因为公式相同，渲染质量才能与 NeRF 持平——两者积分的是同一个辐射场（radiance field）方程。

### 为什么它是可微的（Why this is differentiable）

每一步——投影、tile 分配、alpha 合成、SH 求值——对 Gaussian 参数都是可微的。给定一张 ground-truth 图像，计算渲染像素的损失，让梯度从光栅化器反传回来，再用梯度下降（gradient descent）更新所有的 `(mu, q, s, alpha, c_lm)`。大约 30,000 次迭代后，Gaussian 们就能找到正确的位置、尺度和颜色。

### 致密化与剪枝（Densification and pruning）

固定数量的 Gaussian 覆盖不了复杂场景。训练时会启用两个自适应机制：

- **Clone（克隆）**：当一个 Gaussian 的梯度很大但尺度很小时，在其当前位置克隆一个——说明这块重建还差点细节。
- **Split（分裂）**：当一个大尺度 Gaussian 的梯度很大时，把它拆成两个更小的——一个大 Gaussian 太「平滑」，拟合不了这个区域。
- **Prune（剪枝）**：把不透明度跌到阈值以下的 Gaussian 删掉——它们已经不贡献了。

致密化每 N 次迭代跑一轮。一个场景通常会从约 100k 个初始 Gaussian（用 SfM 点云做种子）增长到训练结束时的 1–5M。

### 一段话讲完球谐函数（Spherical harmonics in one paragraph）

视角相关的颜色是定义在单位球面上的函数 `c(direction)`。球谐函数就是球面的傅立叶基。截断到阶数 `L`，每个通道得到 `(L+1)^2` 个基函数。给一个新视角求颜色，就是把学到的 SH 系数与该方向上求值的基函数做点积。0 阶 = 一个系数 = 常量颜色。3 阶 = 16 个系数 = 足以刻画 Lambertian 漫反射、高光和轻微反射。SD Gaussian Splatting 论文默认用 3 阶。

### 2026 年的生产栈（The 2026 production stack）

```
1. Capture         smartphone / DJI drone / handheld scanner
2. SfM / MVS       COLMAP or GLOMAP derives camera poses + sparse points
3. Train 3DGS      nerfstudio / gsplat / inria official / PostShot (~10-30 min on RTX 4090)
4. Edit            SuperSplat / SplatForge (clean floaters, segment)
5. Export          .ply -> glTF KHR_gaussian_splatting or .usd (OpenUSD 26.03)
6. View            Cesium / Unreal / Babylon.js / Three.js / Vision Pro
```

### 4D 与生成式变体（4D and generative variants）

- **4D Gaussian Splatting**——Gaussian 是时间的函数；用于体视频（Superman 2026、A$AP Rocky 的 “Helicopter”）。
- **Generative splats（生成式 splat）**——文本到 splat 模型（World Labs 的 Marble），能凭空「幻觉」出整个场景。
- **3D Gaussian Unscented Transform**——NVIDIA NuRec 用于自动驾驶仿真的变体。

## 动手实现（Build It）

### Step 1: 一个 2D Gaussian（A 2D Gaussian）

我们先搭一个 2D 光栅化器。3D 情形在投影后就退化到它。

```python
import torch
import torch.nn as nn
import torch.nn.functional as F


def eval_2d_gaussian(means, covs, points):
    """
    means:  (G, 2)      centres
    covs:   (G, 2, 2)   covariance matrices
    points: (H, W, 2)   pixel coordinates
    returns: (G, H, W)  density at every pixel for every Gaussian
    """
    G = means.size(0)
    H, W, _ = points.shape
    flat = points.view(-1, 2)
    inv = torch.linalg.inv(covs)
    diff = flat[None, :, :] - means[:, None, :]
    d = torch.einsum("gpi,gij,gpj->gp", diff, inv, diff)
    density = torch.exp(-0.5 * d)
    return density.view(G, H, W)
```

`einsum` 把每对 (Gaussian, 像素) 的二次型 `diff^T Sigma^-1 diff` 一次算完。

### Step 2: 2D splatting 光栅化器（2D splatting rasteriser）

从前往后做 alpha 合成。2D 里没有真正的深度，所以我们用一个学习得到的逐 Gaussian 标量来排序。

```python
def rasterise_2d(means, covs, colours, opacities, depths, image_size):
    """
    means:     (G, 2)
    covs:      (G, 2, 2)
    colours:   (G, 3)
    opacities: (G,)     in [0, 1]
    depths:    (G,)     per-Gaussian scalar used for ordering
    image_size: (H, W)
    returns:   (H, W, 3) rendered image
    """
    H, W = image_size
    yy, xx = torch.meshgrid(
        torch.arange(H, dtype=torch.float32, device=means.device),
        torch.arange(W, dtype=torch.float32, device=means.device),
        indexing="ij",
    )
    points = torch.stack([xx, yy], dim=-1)

    densities = eval_2d_gaussian(means, covs, points)
    alphas = opacities[:, None, None] * densities
    alphas = alphas.clamp(0.0, 0.99)

    order = torch.argsort(depths)
    alphas = alphas[order]
    colours_sorted = colours[order]

    T = torch.ones(H, W, device=means.device)
    out = torch.zeros(H, W, 3, device=means.device)
    for i in range(means.size(0)):
        a = alphas[i]
        out += (T * a)[..., None] * colours_sorted[i][None, None, :]
        T = T * (1.0 - a)
    return out
```

不快——真正的实现会用 tile-based 的 CUDA kernel——但数学完全正确，并且全程可微。

### Step 3: 一个可训练的 2D splat 场景（A trainable 2D splat scene）

```python
class Splats2D(nn.Module):
    def __init__(self, num_splats=128, image_size=64, seed=0):
        super().__init__()
        g = torch.Generator().manual_seed(seed)
        H, W = image_size, image_size
        self.means = nn.Parameter(torch.rand(num_splats, 2, generator=g) * torch.tensor([W, H]))
        self.log_scale = nn.Parameter(torch.ones(num_splats, 2) * math.log(2.0))
        self.rot = nn.Parameter(torch.zeros(num_splats))  # single angle in 2D
        self.colour_logits = nn.Parameter(torch.randn(num_splats, 3, generator=g) * 0.5)
        self.opacity_logit = nn.Parameter(torch.zeros(num_splats))
        self.depth = nn.Parameter(torch.rand(num_splats, generator=g))

    def covs(self):
        s = torch.exp(self.log_scale)
        c, si = torch.cos(self.rot), torch.sin(self.rot)
        R = torch.stack([
            torch.stack([c, -si], dim=-1),
            torch.stack([si, c], dim=-1),
        ], dim=-2)
        S = torch.diag_embed(s ** 2)
        return R @ S @ R.transpose(-1, -2)

    def forward(self, image_size):
        covs = self.covs()
        colours = torch.sigmoid(self.colour_logits)
        opacities = torch.sigmoid(self.opacity_logit)
        return rasterise_2d(self.means, covs, colours, opacities, self.depth, image_size)
```

`log_scale`、`opacity_logit` 和 `colour_logits` 都是无约束参数，渲染时再过对应的激活函数。这是所有 3DGS 实现的标准模式。

### Step 4: 用 2D Gaussian 拟合一张目标图（Fit 2D Gaussians to a target image）

```python
import math
import numpy as np

def make_target(size=64):
    yy, xx = np.meshgrid(np.arange(size), np.arange(size), indexing="ij")
    img = np.zeros((size, size, 3), dtype=np.float32)
    # Red circle
    mask = (xx - 20) ** 2 + (yy - 20) ** 2 < 10 ** 2
    img[mask] = [1.0, 0.2, 0.2]
    # Blue square
    mask = (np.abs(xx - 45) < 8) & (np.abs(yy - 40) < 8)
    img[mask] = [0.2, 0.3, 1.0]
    return torch.from_numpy(img)


target = make_target(64)
model = Splats2D(num_splats=64, image_size=64)
opt = torch.optim.Adam(model.parameters(), lr=0.05)

for step in range(200):
    pred = model((64, 64))
    loss = F.mse_loss(pred, target)
    opt.zero_grad(); loss.backward(); opt.step()
    if step % 40 == 0:
        print(f"step {step:3d}  mse {loss.item():.4f}")
```

200 步之内，64 个 Gaussian 就会落位到那两个形状上。整个思想就是这个——在显式几何图元上做梯度下降。

### Step 5: 从 2D 到 3D（From 2D to 3D）

3D 扩展保留同一个循环，加上：

1. 每个 Gaussian 的旋转用四元数（quaternion），而不是单一角度。
2. 协方差是 `R S S^T R^T`，其中 `R` 由四元数构造，`S = diag(exp(log_scale))`。
3. 投影 `(mu, Sigma) -> (mu', Sigma')` 用相机外参，以及在 `mu` 处的透视投影 Jacobian（雅可比）。
4. 颜色变成球谐展开；在观察方向上求值。
5. 深度排序用相机空间真实的 z，而不是学习出来的标量。

每一个生产实现（`gsplat`、`inria/gaussian-splatting`、`nerfstudio`）都是在 GPU 上用 tile-based 的 CUDA kernel 干这件事。

### Step 6: 球谐函数求值（Spherical harmonics evaluation）

阶数到 3 的 SH 基每通道有 16 项。求值如下：

```python
def eval_sh_degree_3(sh_coeffs, dirs):
    """
    sh_coeffs: (..., 16, 3)   last dim is RGB channels
    dirs:      (..., 3)       unit vectors
    returns:   (..., 3)
    """
    C0 = 0.282094791773878
    C1 = 0.488602511902920
    C2 = [1.092548430592079, 1.092548430592079,
          0.315391565252520, 1.092548430592079,
          0.546274215296039]
    x, y, z = dirs[..., 0], dirs[..., 1], dirs[..., 2]
    x2, y2, z2 = x * x, y * y, z * z
    xy, yz, xz = x * y, y * z, x * z

    result = C0 * sh_coeffs[..., 0, :]
    result = result - C1 * y[..., None] * sh_coeffs[..., 1, :]
    result = result + C1 * z[..., None] * sh_coeffs[..., 2, :]
    result = result - C1 * x[..., None] * sh_coeffs[..., 3, :]

    result = result + C2[0] * xy[..., None] * sh_coeffs[..., 4, :]
    result = result + C2[1] * yz[..., None] * sh_coeffs[..., 5, :]
    result = result + C2[2] * (2.0 * z2 - x2 - y2)[..., None] * sh_coeffs[..., 6, :]
    result = result + C2[3] * xz[..., None] * sh_coeffs[..., 7, :]
    result = result + C2[4] * (x2 - y2)[..., None] * sh_coeffs[..., 8, :]

    # degree 3 terms omitted here for brevity; full 16-coefficient version in the code file
    return result
```

学到的 `sh_coeffs` 替每个 Gaussian 存下「在每个方向上的颜色」。渲染时把它和当前观察方向一起求值，得到一个 RGB 三维向量。

## 用起来（Use It）

要做真实场景的 3DGS，用 `gsplat`（Meta）或 `nerfstudio`：

```bash
pip install nerfstudio gsplat
ns-download-data example
ns-train splatfacto --data path/to/data
```

`splatfacto` 是 nerfstudio 的 3DGS 训练器。一次典型场景在 RTX 4090 上要 10–30 分钟。

2026 年比较重要的导出选项：

- `.ply`——原始 Gaussian 点云（最通用，文件最大）。
- `.splat`——PlayCanvas / SuperSplat 的量化（quantization）格式。
- glTF `KHR_gaussian_splatting`——Khronos 标准，能在多个查看器之间通用（2026 年 2 月 RC）。
- OpenUSD `UsdVolParticleField3DGaussianSplat`——USD 原生，面向 NVIDIA Omniverse 和 Vision Pro 的流水线。

对 4D / 动态场景，`4DGS` 和 `Deformable-3DGS` 在同一套机制上加上随时间变化的 mean 和 opacity。

## 上线部署（Ship It）

本课产出：

- `outputs/prompt-3dgs-capture-planner.md`——一个 prompt，针对给定场景类型规划一次拍摄（照片数量、相机路径、光照）。
- `outputs/skill-3dgs-export-router.md`——一个 skill，根据下游查看器或引擎，挑选合适的导出格式（`.ply` / `.splat` / glTF / USD）。

## 练习（Exercises）

1. **（简单）** 把上面的 2D splat 训练器跑在另一张合成图上。让 `num_splats` 在 `[16, 64, 256]` 之间变化，分别绘制 MSE 随训练步数的曲线。找出收益递减的拐点。
2. **（中等）** 扩展 2D 光栅化器，让每个 Gaussian 的 RGB 颜色依赖一个标量「视角」，通过一个 2 阶的 harmonic（谐函数）实现。在一对目标图上训练，验证模型能同时重建两张图。
3. **（困难）** 克隆 `nerfstudio`，对你手头任何场景（书桌、植物、人脸、房间）拍 20 张照片，训练 `splatfacto`。导出为 glTF `KHR_gaussian_splatting`，在某个查看器（Three.js `GaussianSplats3D`、SuperSplat、Babylon.js V9）里打开。汇报训练时间、Gaussian 数量、渲染 fps。

## 关键术语（Key Terms）

| Term | What people say | What it actually means |
|------|----------------|----------------------|
| 3DGS | "Gaussian splats" | 把场景显式表示为数百万个 3D Gaussian，每个 Gaussian 带位置、旋转、尺度、不透明度、SH 颜色 |
| Covariance | "Shape of the Gaussian" | `Sigma = R S S^T R^T`；单个 Gaussian 的朝向与各向异性尺度 |
| Alpha compositing | "Back-to-front blend" | 与 NeRF 体渲染同一个公式，只是积分对象换成显式稀疏集合 |
| Densification | "Clone and split" | 在欠拟合的位置自适应增加新的 Gaussian |
| Pruning | "Delete low-opacity" | 训练中把不透明度坍缩到接近 0 的 Gaussian 删除 |
| Spherical harmonics | "View-dependent colour" | 球面上的傅立叶基；把颜色存为观察方向的函数 |
| Splatfacto | "nerfstudio's 3DGS" | 2026 年训练 3DGS 最省事的路径 |
| `KHR_gaussian_splatting` | "glTF standard" | Khronos 在 2026 年的扩展，让 3DGS 能在不同查看器和引擎间通用 |

## 延伸阅读（Further Reading）

- [3D Gaussian Splatting for Real-Time Radiance Field Rendering (Kerbl et al., SIGGRAPH 2023)](https://repo-sam.inria.fr/fungraph/3d-gaussian-splatting/)——原始论文
- [gsplat (Meta/nerfstudio)](https://github.com/nerfstudio-project/gsplat)——生产级 CUDA 光栅化器
- [nerfstudio Splatfacto](https://docs.nerf.studio/nerfology/methods/splat.html)——参考训练 recipe（配方）
- [Khronos KHR_gaussian_splatting extension](https://github.com/KhronosGroup/glTF/blob/main/extensions/2.0/Khronos/KHR_gaussian_splatting/README.md)——2026 年的可移植格式
- [OpenUSD 26.03 release notes](https://openusd.org/release/)——`UsdVolParticleField3DGaussianSplat` schema
- [THE FUTURE 3D State of Gaussian Splatting 2026](https://www.thefuture3d.com/blog-0/2026/4/4/state-of-gaussian-splatting-2026)——行业综述
