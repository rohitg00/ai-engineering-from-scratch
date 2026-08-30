# 12 · 3D 生成

> 3D 是「2D 转 3D」杠杆效应最强的模态。2023 年的突破是「3D 高斯泼溅（3D Gaussian Splatting）」。2024-2026 年的生成式浪潮在其之上叠加了「多视图扩散（multi-view diffusion）」＋「3D 重建」，从而能够仅凭一段提示词或一张照片生成物体与场景。

**类型：** 学习
**语言：** Python
**前置：** 第 4 阶段（视觉）、第 8 阶段 · 07（潜在扩散）
**时长：** 约 45 分钟

## 问题所在

3D 内容制作非常棘手：

- **表示方式。** 网格（mesh）、点云（point cloud）、体素网格（voxel grid）、有向距离场（signed distance fields, SDF）、神经辐射场（neural radiance fields, NeRF）、3D 高斯。每种都有取舍。
- **数据稀缺。** ImageNet 有 1400 万张图像。最大的干净 3D 数据集（Objaverse-XL，2023）约有 1000 万个物体，且大多质量不高。
- **内存。** 一个 512³ 的体素网格有 1.28 亿个体素；一个可用的场景 NeRF 每条光线需要 100 万个采样点。生成比重建更难。
- **监督信号。** 对于一张 2D 图像，你拥有的是像素。而对于 3D，你通常只有寥寥几个 2D 视图，必须将其提升（lift）到 3D。

2026 年的技术栈把这两个问题分开处理。第一步，用扩散模型生成 *2D 多视图图像*。第二步，针对这些图像拟合一个 *3D 表示*（通常是高斯泼溅）。

## 核心概念

〔图：3D 生成：多视图扩散 ＋ 3D 重建〕

### 表示方式：3D 高斯泼溅（Kerbl 等人，2023）

将一个场景表示为约 100 万个 3D 高斯组成的点云。每个高斯有 59 个参数：位置（3）、协方差（6，或四元数 4 ＋ 缩放 3）、不透明度（1）、球谐（spherical-harmonics）颜色（3 阶时为 48，0 阶时为 3）。

渲染 = 投影 ＋ alpha 合成（alpha-compositing）。速度快（在 4090 上 1080p 约 100 fps）。可微分。通过对真值照片做梯度下降来拟合。一个场景在消费级 GPU 上 5-30 分钟即可拟合完成。

在此之上有两项 2023-2024 年的创新：
- **生成式高斯泼溅。** 像 LGM、LRM、InstantMesh 这样的模型，直接从一张或几张图像预测出一个高斯点云。
- **4D 高斯泼溅。** 为高斯附加逐帧偏移量，用于动态场景。

### 多视图扩散

微调一个预训练的图像扩散模型，使其能够从文本提示词或单张图像，生成同一物体的多个一致视图。代表工作有 Zero123（Liu 等人，2023）、MVDream（Shi 等人，2023）、SV3D（Stability，2024）、CAT3D（Google，2024）。通常会围绕物体输出 4-16 个视图，再通过高斯泼溅或 NeRF 提升到 3D。

### 文本到 3D 流水线

| 模型 | 输入 | 输出 | 时间 |
|-------|-------|--------|------|
| DreamFusion (2022) | 文本 | 经 SDS 得到 NeRF | 每个资产约 1 小时 |
| Magic3D | 文本 | 网格 ＋ 纹理 | 约 40 分钟 |
| Shap-E (OpenAI, 2023) | 文本 | 隐式 3D | 约 1 分钟 |
| SJC / ProlificDreamer | 文本 | NeRF / 网格 | 约 30 分钟 |
| LRM (Meta, 2023) | 图像 | triplane | 约 5 秒 |
| InstantMesh (2024) | 图像 | 网格 | 约 10 秒 |
| SV3D (Stability, 2024) | 图像 | 新视角 | 约 2 分钟 |
| CAT3D (Google, 2024) | 1-64 张图像 | 3D NeRF | 约 1 分钟 |
| TripoSR (2024) | 图像 | 网格 | 约 1 秒 |
| Meshy 4 (2025) | 文本 ＋ 图像 | PBR 网格 | 约 30 秒 |
| Rodin Gen-1.5 (2025) | 文本 ＋ 图像 | PBR 网格 | 约 60 秒 |
| Tencent Hunyuan3D 2.0 (2025) | 图像 | 网格 | 约 30 秒 |

2025-2026 年的方向：能直接输出带 PBR 材质、适配游戏引擎的「文本到网格」模型。但对于通用物体而言，以多视图扩散作为中间步骤，仍是性能最佳的方案。

### NeRF（作为背景知识）

神经辐射场（Mildenhall 等人，2020）。一个微型 MLP 接收 `(x, y, z, view direction)`，输出 `(color, density)`。通过沿光线积分进行渲染。在新视角合成的质量上胜过基于网格的方法，但渲染速度慢 100-1000 倍。在大多数实时应用中已被高斯泼溅取代，但在研究领域仍占主导地位。

## 动手构建

`code/main.py` 实现了一个玩具级的 2D「高斯泼溅」拟合：将一张合成的目标图像（一段平滑渐变）表示为一组 2D 高斯泼溅之和。通过梯度下降优化位置、颜色和协方差，以匹配目标。你将看到两个核心操作：前向渲染（泼溅 ＋ alpha 合成）以及通过梯度下降进行拟合。

### 第 1 步：2D 高斯泼溅

```python
def gaussian_at(x, y, gaussian):
    px, py = gaussian["pos"]
    sigma = gaussian["sigma"]
    d2 = (x - px) ** 2 + (y - py) ** 2
    return math.exp(-d2 / (2 * sigma * sigma))
```

### 第 2 步：通过累加泼溅进行渲染

```python
def render(image_size, gaussians):
    img = [[0.0] * image_size for _ in range(image_size)]
    for g in gaussians:
        for y in range(image_size):
            for x in range(image_size):
                img[y][x] += g["color"] * gaussian_at(x, y, g)
    return img
```

真正的 3D 高斯泼溅会按深度对高斯排序，并按顺序做 alpha 合成。我们的 2D 玩具版只是简单累加。

### 第 3 步：通过梯度下降进行拟合

```python
for step in range(steps):
    pred = render(size, gaussians)
    loss = mse(pred, target)
    gradients = compute_grads(pred, target, gaussians)
    update(gaussians, gradients, lr)
```

## 易踩的坑

- **视图不一致。** 如果你独立地生成 4 个视图，而它们对物体结构的判断互相矛盾，那么 3D 拟合结果就会模糊。解决办法：使用带共享注意力（shared attention）的多视图扩散。
- **背面幻觉。** 单图像 → 3D 必须凭空想象看不见的那一面。质量参差不齐。
- **高斯泼溅爆炸。** 无约束的训练会膨胀到 1000 万个泼溅并过拟合。致密化（densification）＋ 剪枝（pruning）启发式（来自 3D-GS 原始论文）是必不可少的。
- **拓扑问题。** 由隐式场（SDF）生成的网格常带有孔洞或自相交。交付前请跑一遍重网格化工具（例如 blender 的体素重网格）。
- **训练数据的许可证。** Objaverse 的许可证混杂；不同模型的商用许可情况各不相同。

## 实际运用

| 任务 | 2026 年首选 |
|------|-----------|
| 从照片重建场景 | 高斯泼溅（3DGS、Gsplat、Scaniverse） |
| 面向游戏的文本到 3D 物体 | Meshy 4 或 Rodin Gen-1.5（PBR 输出） |
| 图像到 3D | Hunyuan3D 2.0、TripoSR、InstantMesh |
| 从少量图像做新视角合成 | CAT3D、SV3D |
| 动态场景重建 | 4D 高斯泼溅 |
| 虚拟形象 / 着衣人体 | Gaussian Avatar、HUGS |
| 研究 / SOTA | 上周刚发布的那个 |

要在游戏或电商流水线中交付生产级 3D：Meshy 4 或 Rodin Gen-1.5 输出的 PBR 网格可以直接导入 Unity / Unreal。

## 交付落地

保存 `outputs/skill-3d-pipeline.md`。该技能接收一份 3D 需求说明（输入：文本 / 单张图像 / 少量图像；输出：网格 / 泼溅 / NeRF；用途：渲染 / 游戏 / VR），并输出：流水线方案（多视图扩散 ＋ 拟合，或直接的网格模型）、基础模型、迭代预算、拓扑后处理、所需的材质通道。

## 练习

1. **简单。** 用 4、16、64 个高斯运行 `code/main.py`。报告相对于目标的最终 MSE。
2. **中等。** 扩展为彩色高斯（RGB）。确认重建结果能匹配目标的颜色模式。
3. **困难。** 使用 gsplat 或 Nerfstudio，从一次 50 张照片的采集中重建一个真实物体。报告拟合耗时以及在留出视图上的最终 SSIM。

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|-----------------|-----------------------|
| 3D Gaussian Splatting | “3DGS” | 把场景表示为 3D 高斯点云；可微分的 alpha 合成渲染。 |
| NeRF | “神经辐射场” | 一个在 3D 点上输出颜色 ＋ 密度的 MLP；通过沿光线积分来渲染。 |
| Triplane | “三个 2D 平面” | 把 3D 分解为三个轴对齐的 2D 特征网格；比体积表示更省。 |
| SDS | “分数蒸馏采样” | 用 2D 扩散的分数作为伪梯度来训练 3D 模型。 |
| Multi-view diffusion | “一次出多个视图” | 输出一批一致相机视图的扩散模型。 |
| PBR | “基于物理的渲染” | 带反照率、粗糙度、金属度、法线通道的材质。 |
| Densification | “增长泼溅” | 3DGS 训练启发式：在高梯度区域分裂 / 克隆泼溅。 |

## 生产说明：3D 尚无统一的底层基座

与图像（潜在扩散 ＋ DiT）和视频（时空 DiT）不同，3D 在 2026 年还没有单一占主导地位的运行时。生产决策树会按表示方式分叉：

- **NeRF / triplane。** 推理过程是光线步进（ray-marching）＋ 每个采样点一次 MLP 前向。一次 512² 渲染需要数百万次 MLP 前向。要积极地对光线采样做批处理；SDPA / xformers 适用。
- **多视图扩散 ＋ LRM 重建。** 两阶段流水线。第 1 阶段（多视图 DiT）就是一个扩散服务，与第 07 课一样。第 2 阶段（LRM transformer）是对这些视图的一次性前向。整体延迟特征是「扩散 ＋ 一次性前向」——据此为各阶段挑选相应的服务原语。
- **SDS / DreamFusion。** 这是逐资产的优化，而非推理。要构建的是批处理作业，而不是请求处理器。

对于 2026 年的大多数产品，正确答案是「按请求运行一个多视图扩散模型，异步重建为 3DGS，再以 3DGS 提供实时浏览」。这样能把工作负载干净地拆分到 GPU 推理服务器（快）和离线优化器（慢）之间。

## 延伸阅读

- [Mildenhall et al. (2020). NeRF: Representing Scenes as Neural Radiance Fields](https://arxiv.org/abs/2003.08934) —— NeRF。
- [Kerbl et al. (2023). 3D Gaussian Splatting for Real-Time Radiance Field Rendering](https://arxiv.org/abs/2308.04079) —— 3DGS。
- [Poole et al. (2022). DreamFusion: Text-to-3D using 2D Diffusion](https://arxiv.org/abs/2209.14988) —— SDS。
- [Liu et al. (2023). Zero-1-to-3: Zero-shot One Image to 3D Object](https://arxiv.org/abs/2303.11328) —— Zero123。
- [Shi et al. (2023). MVDream](https://arxiv.org/abs/2308.16512) —— 多视图扩散。
- [Hong et al. (2023). LRM: Large Reconstruction Model for Single Image to 3D](https://arxiv.org/abs/2311.04400) —— LRM。
- [Gao et al. (2024). CAT3D: Create Anything in 3D with Multi-View Diffusion Models](https://arxiv.org/abs/2405.10314) —— CAT3D。
- [Stability AI (2024). Stable Video 3D (SV3D)](https://stability.ai/research/sv3d) —— SV3D。
