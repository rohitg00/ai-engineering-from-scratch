# 從零做 3D 高斯濺射（3D Gaussian Splatting）

> 一個場景是幾百萬個 3D 高斯組成的雲。每一個都有位置、方向、尺度、不透明度（opacity），以及依觀看方向改變的顏色（colour）。把它們光柵化（rasterise），再對光柵化做反向傳播（backpropagation），就完成了。

**Type:** Build
**Languages:** Python
**Prerequisites:** Phase 4 Lesson 13 (3D Vision & NeRF), Phase 1 Lesson 12 (Tensor Operations), Phase 4 Lesson 10 (Diffusion basics optional)
**Time:** ~90 minutes

## Learning Objectives｜學習目標

- 說明為什麼 2026 年，照片級 3D 重建在正式環境的預設從 NeRF 換成了 3D 高斯濺射
- 說出每個高斯的六個參數：位置（position）、旋轉四元數（quaternion）、尺度（scale）、不透明度（opacity）、球諧（spherical harmonics）顏色、可選特徵（feature）。各自貢獻幾個浮點數
- 用 `alpha` 合成從零實作一個 2D 高斯濺射的光柵器，再顯示 3D 的情況投影之後是同一個迴圈
- 用 `nerfstudio`、`gsplat` 或 `SuperSplat`，從 20 到 50 張照片重建一個場景，並匯出成 `KHR_gaussian_splatting` 這個 glTF 擴充，或 OpenUSD 26.03 的 `UsdVolParticleField3DGaussianSplat` schema

## The Problem｜問題

NeRF 把場景存在 MLP 的權重（weight）裡。每個渲染出來的像素（pixel），都是射線上幾百次 MLP 查詢。訓練要幾小時，渲染要幾秒，權重也不能直接改。想把場景裡的椅子搬一下，就得重新訓練。

3D 高斯濺射（Kerbl、Kopanas、Leimkühler、Drettakis，SIGGRAPH 2023）把這些都換掉了。場景是一組顯式的 3D 高斯。渲染是 GPU 光柵化，每秒 100 影格以上。訓練只要幾分鐘。編輯是直接的：平移一部分高斯，椅子就搬走了。到 2026 年，Khronos Group 已核定高斯濺射的 glTF 擴充，OpenUSD 26.03 帶了高斯濺射的 schema，Zillow 和 Apartments.com 用它們渲染不動產，大多數新的 3D 重建論文都是核心 3DGS 想法的變體。

心智模型很簡單。數學涉及的細節很多，所以大多數介紹從光柵化開始，把投影和球諧跳過去。本課把整件事做出來。先做 2D，再延伸到 3D。

## The Concept｜核心概念

### 一個高斯帶什麼

一個 3D 高斯是空間裡的參數化斑點，屬性如下：

```
position         mu         (3,)    centre in world coordinates
rotation         q          (4,)    unit quaternion encoding orientation
scale            s          (3,)    log-scales per axis (exponentiated at render time)
opacity          alpha      (1,)    post-sigmoid opacity [0, 1]
SH coefficients  c_lm       (3 * (L+1)^2,)   view-dependent colour
```

旋轉加尺度做出一個 3×3 共變異數矩陣（covariance matrix）：`Sigma = R S S^T R^T`。那就是這個高斯在 3D 裡的形狀。球諧讓顏色隨觀看方向改變，鏡面高光、微微的光澤、依視角的光暈，都不用為每個視角存一張紋理。球諧 3 階時，每個顏色通道 16 個係數，光是顏色，每個高斯就有 48 個浮點數。

一個場景通常有 100 萬到 500 萬個高斯。每個大約存 60 個浮點數（3 + 4 + 3 + 1 + 48，再加上其他）。500 萬個高斯的場景是 240 MB。比帶逐點紋理的對等點雲小得多，也比在高解析度下重渲的 NeRF MLP 權重小一個數量級。

### 光柵化，不是沿射線走

```mermaid
flowchart LR
    SCENE["幾百萬個 3D 高斯<br/>（位置、旋轉、尺度、<br/>不透明度、球諧顏色）"] --> PROJ["投影到 2D<br/>（相機外參加內參）"]
    PROJ --> TILES["分到小塊<br/>（螢幕空間 16x16）"]
    TILES --> SORT["每個小塊<br/>依深度排序"]
    SORT --> ALPHA["alpha 合成<br/>由前到後"]
    ALPHA --> PIX["像素顏色"]

    style SCENE fill:#dbeafe,stroke:#2563eb
    style ALPHA fill:#fef3c7,stroke:#d97706
    style PIX fill:#dcfce7,stroke:#16a34a
```

五步，都對 GPU 友善。沒有每個像素一次的 MLP 查詢。一張 RTX 3080 Ti 以每秒 147 影格渲染 600 萬個 splat。

### 投影那一步

具有世界座標位置 `mu` 和 3D 共變異數 `Sigma` 的高斯，投影成螢幕位置 `mu'`、2D 共變異數 `Sigma'` 的 2D 高斯：

```
mu' = project(mu)
Sigma' = J W Sigma W^T J^T          (2 x 2)

W = viewing transform (rotation + translation of camera)
J = Jacobian of the perspective projection at mu'
```

這個 2D 高斯的足跡是一個橢圓，軸是 `Sigma'` 的特徵向量（eigenvector）。橢圓裡的每個像素都收到這個高斯的貢獻，乘上的因子是 `exp(-0.5 * (p - mu')^T Sigma'^-1 (p - mu'))`。

### alpha 合成的規則

對一個像素，蓋住它的高斯由後往前排序（或用倒過來的公式，由前往後）。顏色的合成，和 1980 年代以來每個半透明光柵器是同一個式子：

```
C_pixel = sum_i alpha_i * T_i * c_i

T_i = prod_{j < i} (1 - alpha_j)       transmittance up to i
alpha_i = opacity_i * exp(-0.5 * d^T Sigma'^-1 d)   local contribution
c_i = eval_SH(SH_i, view_direction)    view-dependent colour
```

這**和 NeRF 的體積渲染是同一個式子**，只是積在一組顯式、稀疏的高斯上，不是射線上的稠密樣本。這個等同，就是渲染品質對得上 NeRF 的原因。兩者都在積同一個輻射場方程。

### 為什麼這可以微分

每一步，投影、分到小塊、alpha 合成、球諧求值，對高斯參數都可微。給定一張真實影像，算渲染像素的損失，對光柵器做反向傳播，用梯度下降法更新全部的 `(mu, q, s, alpha, c_lm)`。大約 3 萬次迭代之後，高斯找到對的位置、尺度和顏色。

### 緻密化和剪枝

固定的一組高斯蓋不住複雜場景。訓練裡有兩個會適應的機制：

- 梯度量級高、尺度卻小的時候，在目前位置**複製**一個高斯。重建在這裡需要更多細節。
- 梯度高的時候，把尺度大的高斯**切開**成兩個較小的。一個大高斯太平滑，擬合不了那個區域。
- 不透明度掉到門檻以下就**剪掉**。它們沒有貢獻。

緻密化每 N 次迭代跑一次。場景通常從 SfM 點種下的約 10 萬個高斯，長到訓練結束時的 100 萬到 500 萬個。

### 一段話講完球諧

依視角的顏色是單位球上的函數（function） `c(direction)`。球諧是球面的傅立葉基底。在 `L` 階截斷，每個通道有 `(L+1)^2` 個基底函數。新視角的顏色，是學來的球諧係數和在觀看方向上求出的基底之間的點積。0 階是一個係數，顏色是常數。3 階是 16 個係數，夠抓住朗伯著色、鏡面和輕微反射。SD Gaussian Splatting 的論文預設用 3 階。

### 2026 年正式環境的堆疊

```
1. Capture         smartphone / DJI drone / handheld scanner
2. SfM / MVS       COLMAP or GLOMAP derives camera poses + sparse points
3. Train 3DGS      nerfstudio / gsplat / inria official / PostShot (~10-30 min on RTX 4090)
4. Edit            SuperSplat / SplatForge (clean floaters, segment)
5. Export          .ply -> glTF KHR_gaussian_splatting or .usd (OpenUSD 26.03)
6. View            Cesium / Unreal / Babylon.js / Three.js / Vision Pro
```

### 4D 和生成式變體

- **4D 高斯濺射**。高斯是時間的函數。用於體積式影片（2026 年的 Superman、A$AP Rocky 的 "Helicopter"）。
- **生成式 splat**。文字到 splat 的模型（World Labs 的 Marble）會把整個場景憑空生出來。
- **3D Gaussian Unscented Transform**。NVIDIA NuRec 給自駕模擬用的變體。

```figure
cv3-gaussian-splat
```

## Build It｜動手實作

### 步驟 1：一個 2D 高斯

先做 2D 光柵器。投影之後，3D 的情況就回到它。

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

`einsum` 對每一組（高斯、像素）算二次型 `diff^T Sigma^-1 diff`。

### 步驟 2：2D 濺射光柵器

由前到後做 alpha 合成。2D 裡深度沒有意義，所以用每個高斯一個學來的純量來排序。

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

不快。真正的實作用以小塊為單位的 CUDA 核。但數學是對的，而且全程可微。

### 步驟 3：可訓練的 2D splat 場景

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

`log_scale`、`opacity_logit`、`colour_logits` 都是沒有約束的參數，渲染時再套上對的活化函數（activation function）。這是每個 3DGS 實作的標準模式。

### 步驟 4：把 2D 高斯擬合到一張目標影像

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

200 步裡，64 個高斯逐漸排列成那兩個形狀。整個想法就是這樣：對顯式的幾何基元做梯度下降法。

### 步驟 5：從 2D 到 3D

3D 延伸留著同一個迴圈。多出來的是：

1. 每個高斯的旋轉是四元數，不是單一角度。
2. 共變異數是 `R S S^T R^T`。`R` 由四元數做出來，`S = diag(exp(log_scale))`。
3. 投影 `(mu, Sigma) -> (mu', Sigma')` 用相機外參，以及透視投影在 `mu` 的雅可比（Jacobian）。
4. 顏色變成球諧展開，在觀看方向上求值。
5. 深度排序用的是相機空間真正的 z，不是學來的純量。

每個正式環境的實作（`gsplat`、`inria/gaussian-splatting`、`nerfstudio`）都在 GPU 上、用以小塊為單位的 CUDA 核做這件事。

### 步驟 6：球諧求值

3 階以內的球諧基底，每個通道 16 項。求值是：

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

學來的 `sh_coeffs` 存的是那個高斯「每個方向的顏色」。渲染時對目前的觀看方向求值，得到一個三維的 RGB。

## Use It｜實際應用

真正要做 3DGS，用 `gsplat`（Meta）或 `nerfstudio`：

```bash
pip install nerfstudio gsplat
ns-download-data example
ns-train splatfacto --data path/to/data
```

`splatfacto` 是 nerfstudio 的 3DGS 訓練器。一般場景在 RTX 4090 上要 10 到 30 分鐘。

2026 年要緊的匯出選項：

- `.ply`。原始的高斯雲。可攜，檔案最大。
- `.splat`。PlayCanvas / SuperSplat 的量化格式。
- glTF `KHR_gaussian_splatting`。Khronos 標準，各種檢視器之間可攜（2026 年 2 月的 RC）。
- OpenUSD `UsdVolParticleField3DGaussianSplat`。USD 原生，給 NVIDIA Omniverse 和 Vision Pro 的管線（pipeline）。

4D 或動態場景，`4DGS` 和 `Deformable-3DGS` 用隨時間變的中心和不透明度，延伸同一套機制。

## Ship It｜交付成果

本課會產出：

- `outputs/prompt-3dgs-capture-planner.md`：一份 prompt，依場景類型規劃拍攝：照片張數、相機路徑、光線
- `outputs/skill-3dgs-export-router.md`：一項技能，依下游的檢視器或引擎，挑對的匯出格式（`.ply` / `.splat` / glTF / USD）

## Exercises｜練習

1. **（簡單）** 用上面的 2D splat 訓練器跑另一張合成影像。`num_splats` 取 `[16, 64, 256]`，各自畫 MSE 對步數。找出報酬開始遞減的那個點。
2. **（中等）** 把 2D 光柵器擴充成：每個高斯的 RGB 顏色，經由 2 階諧波依賴一個純量「視角」。用一對目標影像訓練，確認模型兩個都重建得回來。
3. **（困難）** 複製 `nerfstudio`，在你有的任何場景（桌子、植物、臉、房間）的 20 張照片上訓練 `splatfacto`。匯出成 glTF `KHR_gaussian_splatting`，用檢視器打開（Three.js 的 `GaussianSplats3D`、SuperSplat、Babylon.js V9）。回報訓練時間、高斯數量，以及渲染的每秒影格數。

## Key Terms｜關鍵術語

| 術語 | 常見說法 | 實際意義 |
|------|----------------|----------------------|
| 3DGS | 「高斯 splat」 | 顯式的場景表示：幾百萬個 3D 高斯，每個有位置、旋轉、尺度、不透明度、球諧顏色 |
| 共變異數 | 「高斯的形狀」 | `Sigma = R S S^T R^T`。一個高斯的方向和各向異性尺度 |
| alpha 合成 | 「由後往前混」 | 和 NeRF 體積渲染同一個式子，現在積在顯式的稀疏集合上 |
| 緻密化 | 「複製再切開」 | 重建擬合不足的地方，適應地加入新高斯 |
| 剪枝 | 「刪掉低不透明度的」 | 拿掉訓練中不透明度塌到接近 0 的高斯 |
| 球諧 | 「依視角的顏色」 | 球面上的傅立葉基底。把顏色存成觀看方向的函數 |
| Splatfacto | 「nerfstudio 的 3DGS」 | 2026 年訓練 3DGS 最容易的路 |
| `KHR_gaussian_splatting` | 「glTF 標準」 | Khronos 2026 的擴充，讓 3DGS 在檢視器和引擎之間可攜 |

## Further Reading｜延伸閱讀

- [3D Gaussian Splatting for Real-Time Radiance Field Rendering (Kerbl et al., SIGGRAPH 2023)](https://repo-sam.inria.fr/fungraph/3d-gaussian-splatting/) ——原始論文
- [gsplat (Meta/nerfstudio)](https://github.com/nerfstudio-project/gsplat) ——正式環境等級的 CUDA 光柵器
- [nerfstudio Splatfacto](https://docs.nerf.studio/nerfology/methods/splat.html) ——參考訓練配方
- [Khronos KHR_gaussian_splatting extension](https://github.com/KhronosGroup/glTF/blob/main/extensions/2.0/Khronos/KHR_gaussian_splatting/README.md) ——2026 年的可攜格式
- [OpenUSD 26.03 release notes](https://openusd.org/release/) ——`UsdVolParticleField3DGaussianSplat` schema
- [THE FUTURE 3D State of Gaussian Splatting 2026](https://www.thefuture3d.com/blog-0/2026/4/4/state-of-gaussian-splatting-2026) ——產業總覽
