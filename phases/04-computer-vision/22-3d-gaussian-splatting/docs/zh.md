# 从零开始实现三维高斯泼溅（3D Gaussian Splatting）

> 一个场景由数百万个三维高斯体构成。每个高斯体具有位置、朝向、缩放、不透明度以及随视角变化的颜色。对它们进行栅格化，通过栅格化反向传播，完成。

**类型：** 动手构建
**语言：** Python
**前置知识：** 第四阶段第13课（三维视觉与NeRF）、第一阶段第12课（张量运算）、第四阶段第10课（扩散基础，可选）
**耗时：** 约90分钟

## 学习目标

- 解释为何三维高斯泼溅（3D Gaussian Splatting）在2026年取代了NeRF，成为照片级三维重建的默认方案
- 陈述六个逐高斯体参数（位置、旋转四元数、缩放、不透明度、球谐颜色、可选特征）以及各自贡献的浮点数数量
- 使用 Alpha 合成（alpha compositing）从零实现一个二维高斯泼溅栅格化器，然后展示三维情况如何投影到同一循环
- 使用 `nerfstudio`、`gsplat` 或 `SuperSplat` 从20-50张照片重建场景，并导出为 `KHR_gaussian_splatting` glTF扩展或OpenUSD 26.03的 `UsdVolParticleField3DGaussianSplat` 模式

## 问题

NeRF将场景存储为MLP的权重。每个渲染像素对应沿一条射线的数百次MLP查询。训练需要数小时，渲染需要数秒，且权重无法编辑——如果想要移动场景中的一把椅子，必须重新训练。

三维高斯泼溅（Kerbl, Kopanas, Leimkühler, Drettakis, SIGGRAPH 2023）彻底改变了这一切。场景是一个显式的三维高斯体集合。渲染是GPU栅格化，可达100+ fps。训练只需数分钟。编辑是直接的：平移一部分高斯体，椅子就移动了。到2026年，科纳斯组织（Khronos Group）已批准了高斯泼溅的glTF扩展，OpenUSD 26.03内置了高斯泼溅模式，Zillow和Apartments.com使用它渲染房产，大多数关于三维重建的新研究论文都是核心3DGS思想的变体。

思维模型很简单，但涉及的数学环节较多，多数教程从栅格化开始，跳过了投影和球谐函数。本课程将完整构建——先实现二维版本，再扩展到三维。

## 概念

### 一个高斯体携带的信息

一个三维高斯体是空间中的一个参数化团块，具有以下属性：

```
position         mu         (3,)    世界坐标系下的中心点
rotation         q          (4,)    编码朝向的单位四元数
scale            s          (3,)    每个轴的对数缩放（渲染时取指数）
opacity          alpha      (1,)    经sigmoid处理后的不透明度 [0, 1]
SH coefficients  c_lm       (3 * (L+1)^2,)   视角相关的颜色
```

旋转 + 缩放构成3x3协方差矩阵：`Sigma = R S S^T R^T`。这就是高斯体在三维空间中的形状。球谐函数（Spherical Harmonics, SH）使颜色随视角方向变化——高光、微妙光泽、与视角相关的辉光——而无需存储每视角纹理。使用SH阶数3时，每个颜色通道有16个系数，单个高斯体仅颜色就需48个浮点数。

一个场景通常包含100万到500万个高斯体。每个高斯体存储约60个浮点数（3 + 4 + 3 + 1 + 48 + 杂项）。对于500万个高斯体的场景，这大约是240 MB——远小于同等点云加逐点纹理的体积，也比NeRF的MLP权重高分辨率再渲染小一个数量级。

### 栅格化，而非光线行进

```mermaid
flowchart LR
    SCENE["数百万个三维高斯体<br/>(位置、旋转、缩放、<br/>不透明度、球谐颜色)"] --> PROJ["投影到二维<br/>(相机外参 + 内参)"]
    PROJ --> TILES["分配到图块<br/>(16x16屏幕空间)"]
    TILES --> SORT["按深度排序<br/>每个图块"]
    SORT --> ALPHA["Alpha合成<br/>从前到后"]
    ALPHA --> PIX["像素颜色"]

    style SCENE fill:#dbeafe,stroke:#2563eb
    style ALPHA fill:#fef3c7,stroke:#d97706
    style PIX fill:#dcfce7,stroke:#16a34a
```

五个步骤，全部适合GPU。无需每像素MLP查询。一块RTX 3080 Ti可在147 fps下渲染600万个泼溅点。

### 投影步骤

世界位置 `mu` 且三维协方差为 `Sigma` 的三维高斯体投影为屏幕位置 `mu'` 且二维协方差为 `Sigma'` 的二维高斯体：

```
mu' = project(mu)
Sigma' = J W Sigma W^T J^T          (2 x 2)

W = 视角变换矩阵（相机的旋转 + 平移）
J = 在mu'处的透视投影的雅可比矩阵
```

二维高斯体的足迹是一个椭圆，其轴是 `Sigma'` 的特征向量。该椭圆内的每个像素都接收到该高斯体的贡献，权重为 `exp(-0.5 * (p - mu')^T Sigma'^-1 (p - mu'))`。

### Alpha合成规则

对于一个像素，覆盖它的高斯体按从后到前排序（或者用前到后公式等效）。颜色合成使用与1980年代以来的每一个半透明栅格化器相同的方程：

```
C_pixel = sum_i alpha_i * T_i * c_i

T_i = prod_{j < i} (1 - alpha_j)       到 i 为止的透射率
alpha_i = opacity_i * exp(-0.5 * d^T Sigma'^-1 d)   局部贡献
c_i = eval_SH(SH_i, view_direction)    视角相关颜色
```

这与NeRF的体渲染方程**完全相同**，只是现在作用在显式的稀疏高斯体集上，而不是沿射线的密集样本上。这一恒等式就是为什么渲染质量可媲美NeRF——两者都在积分相同的辐射场方程。

### 为什么这是可微的

每一步——投影、图块分配、Alpha合成、球谐函数求值——关于高斯体参数都是可微的。给定真实图像，计算渲染像素损失，通过栅格化器反向传播，通过梯度下降更新所有 `(mu, q, s, alpha, c_lm)` 参数。经过约30,000次迭代，高斯体找到正确的位置、缩放和颜色。

### 稠密化和剪枝

固定数量的高斯体无法覆盖复杂场景。训练包含两种自适应机制：

- **克隆（Clone）**：当一个高斯体的梯度幅度大但缩放很小时，在其当前位置克隆一个——此处重建需要更多细节。
- **分裂（Split）**：当一个大尺度高斯体的梯度高时，将其分裂为两个较小的高斯体——一个大的高斯体过于平滑，无法拟合该区域。
- **剪枝（Prune）**：移除不透明度低于阈值的高斯体——它们没有贡献。

稠密化每隔N次迭代运行一次。一个场景通常从约10万个初始高斯体（从SfM点云种子生成）增长到训练结束时的100万到500万个。

### 球谐函数（一段概括）

与视角相关的颜色是单位球面上的一个函数 `c(direction)`。球谐函数是球面上的傅里叶基底。截断至阶数 `L`，每个通道得到 `(L+1)^2` 个基函数。对新视角计算颜色就是将学习到的SH系数与在视角方向上求值的基底进行点积。阶数0 = 1个系数 = 恒定颜色。阶数3 = 16个系数 = 足以捕捉朗伯着色、高光和轻微反射。三维高斯泼溅论文默认使用阶数3。

### 2026年的生产流程

```
1. 拍摄         智能手机 / DJI无人机 / 手持扫描仪
2. SfM / MVS    COLMAP或GLOMAP得到相机姿态 + 稀疏点云
3. 训练3DGS     nerfstudio / gsplat / inria官方 / PostShot（RTX 4090上约10-30分钟）
4. 编辑           SuperSplat / SplatForge（清除漂浮物、分割）
5. 导出         .ply -> glTF KHR_gaussian_splatting 或 .usd（OpenUSD 26.03）
6. 查看         Cesium / Unreal / Babylon.js / Three.js / Vision Pro
```

### 4D与生成式变体

- **4D高斯泼溅（4D Gaussian Splatting）** — 高斯体是时间的函数；用于体积视频（如超人2026，A$AP Rocky的"Helicopter"）。
- **生成式泼溅** — 文本到泼溅模型（如World Labs的Marble），可凭空生成整个场景。
- **三维高斯无迹变换（3D Gaussian Unscented Transform）** — NVIDIA NuRec用于自动驾驶仿真的变体。

## 动手实现

### 第一步：一个二维高斯体

我们先构建一个二维栅格化器。三维情况在投影后简化为它。

```python
import torch
import torch.nn as nn
import torch.nn.functional as F


def eval_2d_gaussian(means, covs, points):
    """
    means:  (G, 2)      中心点
    covs:   (G, 2, 2)   协方差矩阵
    points: (H, W, 2)   像素坐标
    返回: (G, H, W)     每个高斯体在每个像素处的密度
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

`einsum` 对每个（高斯体，像素）对计算二次型 `diff^T Sigma^-1 diff`。

### 第二步：二维泼溅栅格化器

从前到后的Alpha合成。在二维中深度无意义，因此我们使用一个学习到的逐高斯体标量来确定顺序。

```python
def rasterise_2d(means, covs, colours, opacities, depths, image_size):
    """
    means:     (G, 2)
    covs:      (G, 2, 2)
    colours:   (G, 3)
    opacities: (G,)     取值范围 [0, 1]
    depths:    (G,)     用于排序的逐高斯体标量
    image_size: (H, W)
    返回: (H, W, 3)     渲染图像
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

这并不快——真正的实现使用基于图块的CUDA内核——但数学完全正确且完全可微。

### 第三步：可训练的二维泼溅场景

```python
class Splats2D(nn.Module):
    def __init__(self, num_splats=128, image_size=64, seed=0):
        super().__init__()
        g = torch.Generator().manual_seed(seed)
        H, W = image_size, image_size
        self.means = nn.Parameter(torch.rand(num_splats, 2, generator=g) * torch.tensor([W, H]))
        self.log_scale = nn.Parameter(torch.ones(num_splats, 2) * math.log(2.0))
        self.rot = nn.Parameter(torch.zeros(num_splats))  # 二维中单个角度
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

`log_scale`、`opacity_logit` 和 `colour_logits` 都是无约束的参数，在渲染时通过合适的激活函数映射。这是所有3DGS实现的标准模式。

### 第四步：将二维高斯体拟合到目标图像

```python
import math
import numpy as np

def make_target(size=64):
    yy, xx = np.meshgrid(np.arange(size), np.arange(size), indexing="ij")
    img = np.zeros((size, size, 3), dtype=np.float32)
    # 红色圆形
    mask = (xx - 20) ** 2 + (yy - 20) ** 2 < 10 **