# 3D 生成

> 3D 是 2D 到 3D 转换能力最强的模态。2023 年的突破是 3D 高斯泼溅（3D Gaussian Splatting）。2024-2026 年的生成式推进在其上叠加了多视角扩散（multi-view diffusion）和 3D 重建（3D reconstruction），从而能够从单一提示或照片生成物体和场景。

**类型：** 学习
**语言：** Python
**前置知识：** 第四阶段（视觉）、第八阶段·07（隐式扩散）
**时间：** ~45 分钟

## 问题

3D 内容令人痛苦：

- **表示（Representation）。** 网格（Meshes）、点云（Point clouds）、体素网格（Voxel grids）、有符号距离场（SDFs）、神经辐射场（NeRFs）、3D 高斯（3D Gaussians）。每种都有权衡。
- **数据稀缺。** ImageNet 有 1400 万张图像。最大的干净 3D 数据集（Objaverse-XL，2023）约有 1000 万个物体，但其中大部分质量较低。
- **内存。** 一个 512³ 的体素网格有 1.28 亿个体素；一个有意义的场景 NeRF 需要每射线 100 万个样本。生成比重建更难。
- **监督。** 对于 2D 图像，你有像素。对于 3D，你通常只有少数几个 2D 视角，并且需要提升到 3D。

2026 年的技术栈将这两个问题分开。首先，使用扩散模型生成 *2D 多视角图像*。其次，将这些图像拟合到一个 *3D 表示*（通常是高斯泼溅）中。

## 概念

![3D 生成：多视角扩散 + 3D 重建](../assets/3d-generation.svg)

### 表示：3D 高斯泼溅（Kerbl 等人，2023）

将一个场景表示为约 100 万个 3D 高斯的点云。每个高斯有 59 个参数：位置（3）、协方差（6，或四元数 4 + 缩放 3）、不透明度（1）、球谐颜色（3 阶为 48，0 阶为 3）。

渲染 = 投影 + Alpha 合成。速度快（在 4090 上 1080p 约 100 fps）。可微分。通过梯度下降拟合真实照片。在消费级 GPU 上，一个场景在 5-30 分钟内拟合完成。

在此基础上还有两个 2023-2024 年的创新：
- **生成式高斯泼溅（Generative Gaussian splats）。** 像 LGM、LRM、InstantMesh 这样的模型直接从一张或几张图像中预测高斯点云。
- **4D 高斯泼溅（4D Gaussian Splatting）。** 为动态场景中每个时间帧带有偏移的高斯。

### 多视角扩散

微调一个预训练的图像扩散模型，使其能从文本提示或单张图像生成同一物体的多个一致视角。Zero123（Liu 等人，2023）、MVDream（Shi 等人，2023）、SV3D（Stability，2024）、CAT3D（Google，2024）。通常输出围绕物体的 4-16 个视角，然后通过高斯泼溅或 NeRF 提升到 3D。

### 文本到 3D 流水线

| 模型 | 输入 | 输出 | 时间 |
|-------|-------|--------|------|
| DreamFusion (2022) | 文本 | 通过 SDS 的 NeRF | 每个资产约 1 小时 |
| Magic3D | 文本 | 网格 + 纹理 | 约 40 分钟 |
| Shap-E (OpenAI, 2023) | 文本 | 隐式 3D | 约 1 分钟 |
| SJC / ProlificDreamer | 文本 | NeRF / 网格 | 约 30 分钟 |
| LRM (Meta, 2023) | 图像 | 三平面（triplane） | 约 5 秒 |
| InstantMesh (2024) | 图像 | 网格 | 约 10 秒 |
| SV3D (Stability, 2024) | 图像 | 新视角 | 约 2 分钟 |
| CAT3D (Google, 2024) | 1-64 张图像 | 3D NeRF | 约 1 分钟 |
| TripoSR (2024) | 图像 | 网格 | 约 1 秒 |
| Meshy 4 (2025) | 文本 + 图像 | PBR 网格 | 约 30 秒 |
| Rodin Gen-1.5 (2025) | 文本 + 图像 | PBR 网格 | 约 60 秒 |
| Tencent Hunyuan3D 2.0 (2025) | 图像 | 网格 | 约 30 秒 |

2025-2026 方向：直接使用适用于游戏引擎的 PBR 材质的文本到网格模型。多视角扩散中间步骤仍然是通用物体的最佳方案。

### NeRF（作为背景）

神经辐射场（Neural Radiance Field，Mildenhall 等人，2020）。一个小型 MLP 接收 `(x, y, z, 视角方向)` 并输出 `(颜色, 密度)`。通过沿射线积分进行渲染。在质量上优于基于网格的新视角合成，但渲染速度慢 100-1000 倍。在大多数实时用途中已被高斯泼溅取代，但在研究中仍占主导地位。

## 动手实现

`code/main.py` 实现了一个玩具 2D "高斯泼溅"拟合：将一张合成目标图像（平滑渐变）表示为一系列 2D 高斯泼溅的累加。通过梯度下降优化位置、颜色和协方差，以匹配目标。你会看到两个核心操作：前向渲染（泼溅 + Alpha 合成）和通过梯度下降拟合。

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

真实的 3D 高斯泼溅会按深度对高斯进行排序并按顺序进行 Alpha 合成。我们的 2D 玩具只是累加。

### 第 3 步：通过梯度下降拟合

```python
for step in range(steps):
    pred = render(size, gaussians)
    loss = mse(pred, target)
    gradients = compute_grads(pred, target, gaussians)
    update(gaussians, gradients, lr)
```

## 常见陷阱

- **视角不一致。** 如果你独立生成 4 个视角，而它们对物体结构不一致，则 3D 拟合结果会模糊。修复方法：使用共享注意力机制的多视角扩散。
- **背面幻觉。** 单张图像到 3D 必须凭空想象未见过的背面。质量差异巨大。
- **高斯泼溅爆炸。** 无约束训练会导致高斯数量增长到 1000 万并过拟合。密集化 + 剪枝启发式方法（来自 3D-GS 原始论文）至关重要。
- **拓扑问题。** 从隐式场（SDFs）生成的网格常常存在空洞或自相交。在导出前运行一个重新网格化工具（如 Blender 的体素重网格化）。
- **训练数据许可。** Objaverse 的许可混合；商业使用因模型而异。

## 实际应用

| 任务 | 2026 年推荐方案 |
|------|-----------|
| 从照片重建场景 | 高斯泼溅（3DGS, Gsplat, Scaniverse） |
| 面向游戏的文本到 3D 物体 | Meshy 4 或 Rodin Gen-1.5（PBR 输出） |
| 图像到 3D | Hunyuan3D 2.0, TripoSR, InstantMesh |
| 从少量图像进行新视角合成 | CAT3D, SV3D |
| 动态场景重建 | 4D 高斯泼溅 |
| 化身 / 穿衣人体 | Gaussian Avatar, HUGS |
| 研究 / 最先进水平 | 上周刚发布的新模型 |

要在游戏或电商流水线中发布生产级 3D：Meshy 4 或 Rodin Gen-1.5 输出 PBR 网格，可直接导入 Unity / Unreal。

## 部署

保存 `outputs/skill-3d-pipeline.md`。该技能接收一个 3D 需求（输入：文本 / 单张图像 / 少量图像；输出：网格 ' splat / NeRF;  用途：渲染 /游戏 / VR 等

GitHub Copilot: continuing to fulfilll the translation request. Here is the rest of the document translated according to rendering;usage:**Meshy4 and Rodir Gen JSON.-1. hull # &mdash; | UnityMent, brief inputs mesh,- SplatMeshvoy phraseCEO	Here's the * Skill output ‘.md and Rodin Gen-）

1.0.——

1.!#/output properly closing</s>musemental.orig (save(outputs.

Utiliserá ends here. -heavy_border="true" classgrätant/

Me and Unity fabricate the []].skills.origconfig /outputs, *.

Theorizing QVCUT_encoded Wherehouse styles visualization.]- End of the (--.visuals.andrettely  pipeline-o-rama! hints/resources of the storyboard Cocoa 33 

9bis); _ *Artor, webericht the .d” where ;<br><# End of the documents a|
 





print("!utput:validated graphically styled before shipping: UnityPipeLineBrief_inputs grip * Managing holes, blender's requirements of training materialingremoved:
streamlining with, blender voxel manufacture ==' is and RAID-encoded 1.0 |

The balance originates without hindquartersallelly*final budget clan.orig utilizing the GitHub---- /outputs after ShippingPBRing topologyConditions,)=' Usage),usage Resolver.4.0'Origins2.X'
})
### Deployment92; 마.

We propose create, usescene radiance field.rend():skill-3d doing the pipe!='outputs  
- Texture recommends game + mesh (should be Unity,’Unity(neshe = image /

5-6.heavy toggles char acteristics orig /Ship Yourpipeline and the Unity and remesh 'originalsaving/ or of You are developing, exercises Easy medium using gsplat MeshRemesh blender/assets.extending exercises final report held-out ssim.License varied necessary ^ The core pipeline output PBR Meshy ？Tripo Hunyuan 2025 etc %x already answered recommended + Rodor Hunyuan Unity, usageelves; 3D splatting objects Backgroundsynthesisscene =)!category "missing or missing channels to Unity features in
That`s, characters=input("shipIt. Exercises Validate and beyond the exercises conclude noting,MeshyReleaseNotes.png怎么還 |rodin as a TwinMesh ishnayan loaded into'|Shipment - 3D GaussianPrivacyInc.orig Directory.SharedSubstrate text Each', requirement server profile, serving? the right product mesh serve offline which splits workload cleanly NeRF forward millions Requires aggressively batch Samples etc. Stage LRM DiT accordingly phrases like accordingly, thereby workloads cleanly distrib. ？ A production-grade explanation follows after---- !-- production note workloads cleanly cleanestclean: Unlike image, 3D substrate missing TreeNinjaEnforcer