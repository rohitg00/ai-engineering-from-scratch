# 3D 生成（3D Generation）

> 译注：本文译自同目录 [`en.md`](./en.md)。术语遵循仓根 [TRANSLATION_GUIDE.md](../../../../TRANSLATION_GUIDE.md)。

> 3D 是 2D-to-3D 杠杆最强的模态。2023 年的突破是 3D Gaussian Splatting（3D 高斯泼溅）。2024-2026 年的生成式推进，则是在其之上叠加 multi-view diffusion（多视角扩散）+ 3D 重建，从单条 prompt 或单张照片生成物体与场景。

**Type:** Learn
**Languages:** Python
**Prerequisites:** Phase 4 (Vision), Phase 8 · 07 (Latent Diffusion)
**Time:** ~45 minutes

## 问题（The Problem）

3D 内容很折磨人：

- **表示（Representation）**：网格（mesh）、点云（point cloud）、体素网格（voxel grid）、有向距离场（SDF）、神经辐射场（NeRF）、3D 高斯。每种都有取舍。
- **数据稀缺（Data scarcity）**：ImageNet 有 1400 万张图。最大的干净 3D 数据集（Objaverse-XL，2023）有约 1000 万个物体，大多质量不高。
- **内存（Memory）**：512³ 的 voxel grid 是 1.28 亿个体素；一个有用的场景 NeRF 每条射线需要 100 万个采样。生成比重建更难。
- **监督（Supervision）**：对一张 2D 图像你有像素本身。对 3D 你通常只有几张 2D 视角，必须把它们抬升到 3D。

2026 年的技术栈把这两个问题分开：先用 diffusion 模型生成 *2D 多视角图像*；再把一种 *3D 表示*（通常是 Gaussian splatting）拟合到这些图像上。

## 概念（The Concept）

![3D 生成：多视角扩散 + 3D 重建](../assets/3d-generation.svg)

### 表示：3D Gaussian Splatting（Kerbl et al., 2023）

把场景表示成约 100 万个 3D 高斯组成的点云。每个高斯有 59 个参数：位置（3）、协方差（6，或四元数 4 + 缩放 3）、不透明度（1）、球谐函数颜色（3 阶时 48，0 阶时 3）。

渲染 = 投影 + alpha 合成。速度快（4090 上 1080p 约 100 fps）。可微。用梯度下降对齐真实照片来拟合。在消费级 GPU 上 5-30 分钟就能拟合一个场景。

在此之上有两个 2023-2024 年的创新：

- **生成式 Gaussian splat**：LGM、LRM、InstantMesh 这类模型，直接从一张或几张图预测出一团高斯点云。
- **4D Gaussian Splatting**：高斯带逐帧偏移量，用于动态场景。

### 多视角扩散（Multi-view diffusion）

微调一个预训练的图像 diffusion 模型，让它从一段文本 prompt 或单张图像生成同一物体的多个一致视角。Zero123（Liu et al., 2023）、MVDream（Shi et al., 2023）、SV3D（Stability, 2024）、CAT3D（Google, 2024）。通常输出绕物体一圈的 4-16 个视角，再通过 Gaussian splatting 或 NeRF 抬升到 3D。

### 文本到 3D 流水线（Text-to-3D pipelines）

| 模型 | 输入 | 输出 | 时间 |
|-------|-------|--------|------|
| DreamFusion (2022) | 文本 | NeRF via SDS | 每个资产约 1 小时 |
| Magic3D | 文本 | 网格 + 纹理 | 约 40 分钟 |
| Shap-E (OpenAI, 2023) | 文本 | 隐式 3D | 约 1 分钟 |
| SJC / ProlificDreamer | 文本 | NeRF / 网格 | 约 30 分钟 |
| LRM (Meta, 2023) | 图像 | triplane | 约 5 秒 |
| InstantMesh (2024) | 图像 | 网格 | 约 10 秒 |
| SV3D (Stability, 2024) | 图像 | 新视角 | 约 2 分钟 |
| CAT3D (Google, 2024) | 1-64 张图像 | 3D NeRF | 约 1 分钟 |
| TripoSR (2024) | 图像 | 网格 | 约 1 秒 |
| Meshy 4 (2025) | 文本 + 图像 | PBR 网格 | 约 30 秒 |
| Rodin Gen-1.5 (2025) | 文本 + 图像 | PBR 网格 | 约 60 秒 |
| Tencent Hunyuan3D 2.0 (2025) | 图像 | 网格 | 约 30 秒 |

2025-2026 年的方向是：直接做出适合游戏引擎的、带 PBR 材质的 text-to-mesh 模型。但对于通用物体，多视角扩散作为中间步骤的配方仍是表现最好的。

### NeRF（作为背景）

神经辐射场（Mildenhall et al., 2020）。一个小 MLP 接收 `(x, y, z, view direction)`，输出 `(color, density)`。沿射线积分来渲染。在新视角合成质量上吊打基于网格的方法，但渲染慢 100-1000 倍。在大多数实时场景里被 Gaussian splatting 取代，但在研究里仍占主导。

## 动手实现（Build It）

`code/main.py` 实现一个玩具版的 2D「Gaussian splatting」拟合：把一张合成目标图（一段平滑渐变）表示为一组 2D 高斯 splat 的和。用梯度下降优化位置、颜色和协方差去匹配目标。你能看到两个核心操作：前向渲染（splat + alpha 合成）和梯度下降拟合。

### Step 1：2D Gaussian splat

```python
def gaussian_at(x, y, gaussian):
    px, py = gaussian["pos"]
    sigma = gaussian["sigma"]
    d2 = (x - px) ** 2 + (y - py) ** 2
    return math.exp(-d2 / (2 * sigma * sigma))
```

### Step 2：把 splat 加起来渲染

```python
def render(image_size, gaussians):
    img = [[0.0] * image_size for _ in range(image_size)]
    for g in gaussians:
        for y in range(image_size):
            for x in range(image_size):
                img[y][x] += g["color"] * gaussian_at(x, y, g)
    return img
```

真实的 3D Gaussian splatting 会按深度排序高斯，再依次做 alpha 合成。我们这个 2D 玩具版只是相加。

### Step 3：用梯度下降拟合

```python
for step in range(steps):
    pred = render(size, gaussians)
    loss = mse(pred, target)
    gradients = compute_grads(pred, target, gaussians)
    update(gaussians, gradients, lr)
```

## 坑（Pitfalls）

- **视角不一致（View inconsistency）**：如果你独立生成 4 个视角，它们对物体结构看法不一致，3D 拟合就会糊。修法：用共享 attention 的多视角扩散。
- **背面幻觉（Back-side hallucination）**：单图 → 3D 必须凭空编造看不到的那一面，质量参差不齐。
- **Gaussian splat 爆炸**：无约束训练会膨胀到 1000 万个 splat 并过拟合。densification（致密化）+ pruning（剪枝）启发式（出自 3D-GS 原论文）是必需的。
- **拓扑问题（Topology issues）**：从隐式场（SDF）出来的网格经常有孔洞或自相交。上线前跑一遍重网格器（比如 Blender 的 voxel remesh）。
- **训练数据 license**：Objaverse 的 license 混杂；不同模型的商用条款各异。

## 用起来（Use It）

| 任务 | 2026 选型 |
|------|-----------|
| 从照片重建场景 | Gaussian splatting（3DGS、Gsplat、Scaniverse） |
| 给游戏用的文本到 3D 物体 | Meshy 4 或 Rodin Gen-1.5（PBR 输出） |
| 图像到 3D | Hunyuan3D 2.0、TripoSR、InstantMesh |
| 少量图像新视角合成 | CAT3D、SV3D |
| 动态场景重建 | 4D Gaussian Splatting |
| 虚拟形象 / 着衣人体 | Gaussian Avatar、HUGS |
| 研究 / SOTA | 上周刚出的那个 |

要在游戏或电商流水线里上线生产级 3D：Meshy 4 或 Rodin Gen-1.5，输出的 PBR 网格能直接进 Unity / Unreal。

## 上线部署（Ship It）

保存到 `outputs/skill-3d-pipeline.md`。这个 skill 接收一份 3D brief（输入：文本 / 单图 / 多图；输出：网格 / splat / NeRF；用途：渲染 / 游戏 / VR），输出：流水线（多视角扩散 + 拟合，或直接出网格的模型）、基础模型、迭代预算、拓扑后处理、需要的材质通道。

## 练习（Exercises）

1. **简单**：用 4、16、64 个高斯分别跑 `code/main.py`，报告对目标的最终 MSE。
2. **中等**：扩展为彩色高斯（RGB）。确认重建结果匹配目标的颜色图案。
3. **困难**：用 gsplat 或 Nerfstudio，从 50 张拍摄的真实物体照片重建出来。报告拟合时间和 hold-out 视角上的最终 SSIM。

## 关键术语（Key Terms）

| 术语 | 大家怎么说 | 实际含义 |
|------|-----------------|-----------------------|
| 3D Gaussian Splatting | 「3DGS」 | 把场景表示成 3D 高斯点云；可微的 alpha 合成渲染。 |
| NeRF | 「Neural radiance field（神经辐射场）」 | 在 3D 点上输出颜色 + 密度的 MLP；通过沿射线积分来渲染。 |
| Triplane | 「三张 2D 平面」 | 把 3D 拆分成三张轴对齐的 2D 特征网格；比体素表示便宜。 |
| SDS | 「Score distillation sampling（分数蒸馏采样）」 | 用 2D diffusion 的 score 当作伪梯度来训练 3D 模型。 |
| Multi-view diffusion | 「一次出多个视角」 | 一次输出一批一致相机视角的 diffusion 模型。 |
| PBR | 「Physically-based rendering（基于物理的渲染）」 | 带 albedo、roughness、metallic、normal 通道的材质。 |
| Densification | 「让 splat 长出来」 | 3DGS 训练启发式：在高梯度区域分裂 / 克隆 splat。 |

## 生产笔记：3D 还没有共享底座（Production note: 3D has no shared substrate yet）

不像图像（latent diffusion + DiT）和视频（时空 DiT），3D 在 2026 年还没有单一占主导的运行时。生产决策树会按表示分叉：

- **NeRF / triplane**：推理是 ray-marching（光线步进）+ 每个采样点一次 MLP 前向。一张 512² 的渲染要做几百万次 MLP 前向。把射线采样大力 batch 起来；SDPA/xformers 适用。
- **多视角扩散 + LRM 重建**：两段式流水线。第一段（多视角 DiT）就是和 Lesson 07 一样的 diffusion 服务。第二段（LRM transformer）是对这些视角的一次性前向。整体延迟画像是「diffusion + 一次性前向」——按段挑选服务原语。
- **SDS / DreamFusion**：是按资产做优化，不是推理。要构建任务系统，而不是请求处理器。

对大多数 2026 年的产品，正确答案是「按请求跑一个多视角扩散模型，异步重建到 3DGS，再把 3DGS 提供给前端做实时浏览」。这把负载干净地拆成 GPU 推理服务（快）和离线优化器（慢）两部分。

## 延伸阅读（Further Reading）

- [Mildenhall et al. (2020). NeRF: Representing Scenes as Neural Radiance Fields](https://arxiv.org/abs/2003.08934) — NeRF。
- [Kerbl et al. (2023). 3D Gaussian Splatting for Real-Time Radiance Field Rendering](https://arxiv.org/abs/2308.04079) — 3DGS。
- [Poole et al. (2022). DreamFusion: Text-to-3D using 2D Diffusion](https://arxiv.org/abs/2209.14988) — SDS。
- [Liu et al. (2023). Zero-1-to-3: Zero-shot One Image to 3D Object](https://arxiv.org/abs/2303.11328) — Zero123。
- [Shi et al. (2023). MVDream](https://arxiv.org/abs/2308.16512) — 多视角扩散。
- [Hong et al. (2023). LRM: Large Reconstruction Model for Single Image to 3D](https://arxiv.org/abs/2311.04400) — LRM。
- [Gao et al. (2024). CAT3D: Create Anything in 3D with Multi-View Diffusion Models](https://arxiv.org/abs/2405.10314) — CAT3D。
- [Stability AI (2024). Stable Video 3D (SV3D)](https://stability.ai/research/sv3d) — SV3D。
