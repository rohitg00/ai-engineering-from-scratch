# 3D 生成

> 3D 是 2D-to-3D 杠杆效应最强的模态。2023 年的突破是 3D Gaussian Splatting。2024-2026 年的生成式进展在其上叠加多视角扩散 + 3D 重建，从单个提示词或一张照片生成物体和场景。

**Type:** Learn
**Languages:** Python
**Prerequisites:** Phase 4 (Vision), Phase 8 · 07 (Latent Diffusion)
**Time:** 约 45 分钟

## 问题所在

3D 内容非常棘手：

- **表示。** 网格、点云、体素网格、符号距离场（SDF）、神经辐射场（NeRF）、3D 高斯。各有取舍。
- **数据稀缺。** ImageNet 有 1400 万张图像。最大的干净 3D 数据集（Objaverse-XL，2023）约有 1000 万个物体，且大多质量低下。
- **内存。** 一个 512³ 体素网格有 1.28 亿个体素；一个有用的场景 NeRF 需要每条光线 100 万个采样点。生成比重建更难。
- **监督。** 对于 2D 图像你有像素。对于 3D，你通常只有少量 2D 视图，需要将其提升到 3D。

2026 年的技术栈把这两个问题分开。首先，用扩散模型生成 *2D 多视角图像*。其次，对这些图像拟合一个 *3D 表示*（通常是 Gaussian splatting）。

## 核心概念

![3D generation: multi-view diffusion + 3D reconstruction](../assets/3d-generation.svg)

### 表示：3D Gaussian Splatting（Kerbl et al., 2023）

将场景表示为一团约 100 万个 3D 高斯。每个有 59 个参数：位置（3）、协方差（6，或四元数 4 + 尺度 3）、不透明度（1）、球谐颜色（3 阶为 48，0 阶为 3）。

渲染 = 投影 + alpha 合成。快速（在 4090 上 1080p 约 100 fps）。可微。通过针对真实照片的梯度下降拟合。一个场景在消费级 GPU 上 5-30 分钟即可拟合完成。

其上两项 2023-2024 年的创新：
- **生成式 Gaussian splat。** LGM、LRM、InstantMesh 等模型直接从一张或几张图像预测高斯云。
- **4D Gaussian Splatting。** 带有逐帧偏移的高斯，用于动态场景。

### 多视角扩散

微调一个预训练图像扩散模型，使其从文本提示或单张图像生成同一物体的多个一致视角。Zero123（Liu et al., 2023）、MVDream（Shi et al., 2023）、SV3D（Stability，2024）、CAT3D（Google，2024）。通常输出物体周围的 4-16 个视角，再通过 Gaussian splatting 或 NeRF 提升到 3D。

### 文本到 3D 流水线

| 模型 | 输入 | 输出 | 时间 |
|-------|-------|--------|------|
| DreamFusion (2022) | 文本 | 经 SDS 的 NeRF | 每个资产约 1 小时 |
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

2025-2026 年方向：带 PBR 材质、可直接用于游戏引擎的直接文本到网格模型。对于通用物体，多视角扩散作为中间步骤仍是表现最好的配方。

### NeRF（背景知识）

Neural Radiance Field（Mildenhall et al., 2020）。一个小型 MLP 接收 `(x, y, z, view direction)`，输出 `(color, density)`。通过沿光线积分进行渲染。在新视角合成质量上优于基于网格的方法，但渲染慢 100-1000 倍。在大多数实时用途上已被 Gaussian splatting 取代，但在研究中仍占主导地位。

```figure
v4-3d-multiview
```

## 动手构建

`code/main.py` 实现了一个玩具版 2D "Gaussian splatting" 拟合：将一张合成目标图像（平滑渐变）表示为多个 2D 高斯 splat 之和。通过梯度下降优化位置、颜色和协方差以匹配目标。你会看到两个核心操作：前向渲染（splat + alpha 合成）和通过梯度下降拟合。

### 第 1 步：2D 高斯 splat

```python
def gaussian_at(x, y, gaussian):
    px, py = gaussian["pos"]
    sigma = gaussian["sigma"]
    d2 = (x - px) ** 2 + (y - py) ** 2
    return math.exp(-d2 / (2 * sigma * sigma))
```

### 第 2 步：对 splat 求和进行渲染

```python
def render(image_size, gaussians):
    img = [[0.0] * image_size for _ in range(image_size)]
    for g in gaussians:
        for y in range(image_size):
            for x in range(image_size):
                img[y][x] += g["color"] * gaussian_at(x, y, g)
    return img
```

真正的 3D Gaussian splatting 会按深度排序高斯并按序做 alpha 合成。我们的 2D 玩具版只是求和。

### 第 3 步：通过梯度下降拟合

```python
for step in range(steps):
    pred = render(size, gaussians)
    loss = mse(pred, target)
    gradients = compute_grads(pred, target, gaussians)
    update(gaussians, gradients, lr)
```

## 常见陷阱

- **视角不一致。** 如果独立生成 4 个视角而它们对物体结构描述不一致，3D 拟合结果会模糊。解决方法：带共享注意力的多视角扩散。
- **背面幻觉。** 单图像 → 3D 必须凭空想象未见的一面。质量差异极大。
- **高斯 splat 爆炸。** 无约束的训练会增长到 1000 万个 splat 并过拟合。致密化 + 剪枝启发式（来自 3D-GS 原论文）必不可少。
- **拓扑问题。** 从隐式场（SDF）得到的网格常有孔洞或自相交。交付前先跑一次重网格化（如 blender 的 voxel remesh）。
- **训练数据许可证。** Objaverse 许可证混杂；商用情况因模型而异。

## 使用建议

| 任务 | 2026 年首选 |
|------|-----------|
| 从照片重建场景 | Gaussian splatting（3DGS、Gsplat、Scaniverse） |
| 游戏用文本到 3D 物体 | Meshy 4 或 Rodin Gen-1.5（PBR 输出） |
| 图像到 3D | Hunyuan3D 2.0、TripoSR、InstantMesh |
| 少量图像的新视角合成 | CAT3D、SV3D |
| 动态场景重建 | 4D Gaussian Splatting |
| 虚拟形象 / 穿着衣物的人物 | Gaussian Avatar、HUGS |
| 研究 / SOTA | 上周刚发布的那个 |

对于游戏或电商流水线中的生产级 3D：Meshy 4 或 Rodin Gen-1.5 输出的 PBR 网格可直接导入 Unity / Unreal。

## 交付落地

保存 `outputs/skill-3d-pipeline.md`。该技能接收一份 3D 需求（输入：文本 / 单张图像 / 少量图像；输出：网格 / splat / NeRF；用途：渲染 / 游戏 / VR），并输出：流水线（多视角扩散 + 拟合，或直接网格模型）、基础模型、迭代预算、拓扑后处理、所需材质通道。

## 练习

1. **简单。** 分别用 4、16、64 个高斯运行 `code/main.py`。报告相对于目标图的最终 MSE。
2. **中等。** 扩展为彩色高斯（RGB）。确认重建结果匹配目标的颜色模式。
3. **困难。** 使用 gsplat 或 Nerfstudio，从 50 张照片的采集数据重建一个真实物体。报告拟合时间和留出视角上的最终 SSIM。

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|-----------------|-----------------------|
| 3D Gaussian Splatting | "3DGS" | 场景表示为一团 3D 高斯；可微的 alpha 合成渲染。 |
| NeRF | "Neural radiance field" | 在 3D 点处输出颜色 + 密度的 MLP；通过光线积分渲染。 |
| Triplane | "三个 2D 平面" | 将 3D 分解为三个轴对齐的 2D 特征网格；比体积表示更廉价。 |
| SDS | "Score distillation sampling" | 用 2D 扩散分数作为伪梯度来训练 3D 模型。 |
| Multi-view diffusion | "一次多个视角" | 输出一批一致相机视角的扩散模型。 |
| PBR | "Physically-based rendering" | 带 albedo、roughness、metallic、normal 通道的材质。 |
| Densification | "增长 splat" | 3DGS 训练启发式：在高梯度区域分裂 / 克隆 splat。 |

## 生产注意事项：3D 尚无统一底层

与图像（latent diffusion + DiT）和视频（时空 DiT）不同，3D 在 2026 年没有单一的主导运行时。生产决策树按表示形式分叉：

- **NeRF / triplane。** 推理是光线步进 + 每个样本一次 MLP 前向。一次 512² 渲染需要数百万次 MLP 前向。要激进地对光线采样做批处理；SDPA/xformers 适用。
- **多视角扩散 + LRM 重建。** 两阶段流水线。阶段 1（多视角 DiT）就是和第 07 课一样的扩散服务器。阶段 2（LRM transformer）是对这些视角的一次性前向传播。整体延迟特征是"扩散 + 一次性前向"——据此为每个阶段选择服务原语。
- **SDS / DreamFusion。** 按资产优化，不是推理。构建作业，而不是请求处理器。

对大多数 2026 年的产品，正确答案是"按需运行多视角扩散模型，异步重建为 3DGS，用 3DGS 提供实时查看"。这样可以把工作负载清晰地划分给 GPU 推理服务器（快）和离线优化器（慢）。

## 延伸阅读

- [Mildenhall et al. (2020). NeRF: Representing Scenes as Neural Radiance Fields](https://arxiv.org/abs/2003.08934) — NeRF。
- [Kerbl et al. (2023). 3D Gaussian Splatting for Real-Time Radiance Field Rendering](https://arxiv.org/abs/2308.04079) — 3DGS。
- [Poole et al. (2022). DreamFusion: Text-to-3D using 2D Diffusion](https://arxiv.org/abs/2209.14988) — SDS。
- [Liu et al. (2023). Zero-1-to-3: Zero-shot One Image to 3D Object](https://arxiv.org/abs/2303.11328) — Zero123。
- [Shi et al. (2023). MVDream](https://arxiv.org/abs/2308.16512) — 多视角扩散。
- [Hong et al. (2023). LRM: Large Reconstruction Model for Single Image to 3D](https://arxiv.org/abs/2311.04400) — LRM。
- [Gao et al. (2024). CAT3D: Create Anything in 3D with Multi-View Diffusion Models](https://arxiv.org/abs/2405.10314) — CAT3D。
- [Stability AI (2024). Stable Video 3D (SV3D)](https://stability.ai/research/sv3d) — SV3D。