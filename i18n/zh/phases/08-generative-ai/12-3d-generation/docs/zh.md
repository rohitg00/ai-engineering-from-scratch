# 3D 世代

> 3D是2D到3D杆最强的模式. 2023年的突破是3D高斯分光. 2024-2026年生成的推层多视觉扩散 + 3D重建在顶部以从单个提示或照片中产生物体和场景.

**Type:** Learn
**Languages:** Python, TypeScript
**Prerequisites:** Phase 4 (Vision), Phase 8 · 07 (Latent Diffusion)
**Time:** ~45 minutes

## 问题

3D内容是痛苦的:

- **Representation.**网格,点云,语音网格,签署距离场 (SDF),神经辐射场 (NeRF),3D高斯人.每个都有折衷.
- **Data scarcity.**图像网拥有1400万张图像.最大的清洁3D数据集 (Objaverse-XL, 2023) 拥有约1000万个物体,质量最低.
- **Memory.**5123 声格格为 128M 声格;一个有用的场景 NeRF 需要 1M 样本/射线.生成比重建更难.
- **Supervision.**在二维图像中,你有像素,在三维图像中,你通常有几种二维图像,

首先,用扩散模型生成2D多视图,第二,将3D表示 (通常是高斯的) 合到这些图像.

## 概念

![3D generation: multi-view diffusion + 3D reconstruction](../assets/3d-generation.svg)

### 代表性: 3D高斯分光 (Kerbl等, 2023)

描述一个场景为1M3D高斯人云.每个参数有59个:位置 (3),共变性 (6,或四 4 + 尺度 3),度 (1),球状和色 (48在度 3,3在度 0).

呈现 = 投影 + 亚尔法编译. 快速 (在4090p上1080p时~100fps). 可区分. 适合与真实照片的梯度下降. 在消费者GPU上,一个场景可以在5-30分钟内适合.

两项2023-2024年创新:
- **Generative Gaussian splats.**像LGM,LRM,InstantMesh这样的模型直接从一个或几个图像中预测到一个高斯云.
- **4D Gaussian Splatting.**对于动态场景,每一个框架的偏移.

### 多视图传播

精细调节预训练的图像扩散模型,以从文本提示或单个图像中生成相同对象的多个一致视图. 零123 (Liu et al., 2023),MVDream (Shi et al., 2023),SV3D (稳定性, 2024),CAT3D (谷歌, 2024). 通常通过高斯式喷或NeRF将对象周围的4-16个视图输出到3D.

### 文字到3D管道

| Model | Input | Output | Time |
|-------|-------|--------|------|
| DreamFusion (2022) | text | NeRF via SDS | ~1 hour per asset |
| Magic3D | text | mesh + texture | ~40 min |
| Shap-E (OpenAI, 2023) | text | implicit 3D | ~1 min |
| SJC / ProlificDreamer | text | NeRF / mesh | ~30 min |
| LRM (Meta, 2023) | image | triplane | ~5 s |
| InstantMesh (2024) | image | mesh | ~10 s |
| SV3D (Stability, 2024) | image | novel views | ~2 min |
| CAT3D (Google, 2024) | 1-64 images | 3D NeRF | ~1 min |
| TripoSR (2024) | image | mesh | ~1 s |
| Meshy 4 (2025) | text + image | PBR mesh | ~30 s |
| Rodin Gen-1.5 (2025) | text + image | PBR mesh | ~60 s |
| Tencent Hunyuan3D 2.0 (2025) | image | mesh | ~30 s |

2025-2026年方向:直接的文字-到网格模型,使用适合游戏引擎的PBR材料.多视觉扩散中间步骤仍然是一般物体的最佳配方.

### 尼尔夫 (文本)

微小的MLP需要 `(x, y, z, view direction)`产量`(color, density)`通过线程整合进行染. 质量比基于网格的新视图合成高,但染速度比100-1000倍慢. 对于大多数实时使用而被高斯光器所取代,但仍占据研究的主导地位.

```figure
v4-3d-multiview
```

## 建立它

`code/main.py`实现玩具2D"高斯光"合适:将合成目标图像 (平滑梯度) 作为2D高斯光的总和.通过梯度下降优化位置,颜色和共变性来匹配目标.您可以看到两个核心操作:前面染 (平面 + 亚尔法复合物) 和梯度下降合适.

### 步骤1: 2D高斯斑

```python
def gaussian_at(x, y, gaussian):
    px, py = gaussian["pos"]
    sigma = gaussian["sigma"]
    d2 = (x - px) ** 2 + (y - py) ** 2
    return math.exp(-d2 / (2 * sigma * sigma))
```

### 步骤2:通过积点进行染

```python
def render(image_size, gaussians):
    img = [[0.0] * image_size for _ in range(image_size)]
    for g in gaussians:
        for y in range(image_size):
            for x in range(image_size):
                img[y][x] += g["color"] * gaussian_at(x, y, g)
    return img
```

实际的3D高斯人射分类高斯人按深度和阿尔法复合物顺序.

### 步骤3:按梯度下降的适应

```python
for step in range(steps):
    pred = render(size, gaussians)
    loss = mse(pred, target)
    gradients = compute_grads(pred, target, gaussians)
    update(gaussians, gradients, lr)
```

## 陷

- **View inconsistency.**如果您独立生成4个视图,并且对对象结构不同意,则3D合适模糊.
- **Back-side hallucination.**单一图像 → 3D 必须发明看不见的面.
- **Gaussian splat explosion.**无限制的训练增长到10万个位和过度.密度化+剪裁的位 (从3D-GS原始纸) 是必不可少的.
- **Topology issues.**隐形场的网格 (SDF) 通常有孔或自交. 在运输之前,运行一个重复 (例如混合器的音符重复).
- **License of training data.**商业使用不同于模型.

## 用它

| Task | 2026 pick |
|------|-----------|
| Scene reconstruction from photos | Gaussian splatting (3DGS, Gsplat, Scaniverse) |
| Text-to-3D object for games | Meshy 4 or Rodin Gen-1.5 (PBR output) |
| Image-to-3D | Hunyuan3D 2.0, TripoSR, InstantMesh |
| Novel-view synthesis from few images | CAT3D, SV3D |
| Dynamic scene reconstruction | 4D Gaussian Splatting |
| Avatar / clothed human | Gaussian Avatar, HUGS |
| Research / SOTA | Whatever dropped last week |

对于游戏或电子商务管道中的3D运输生产: Meshy 4或Rodin Gen-1.5输出PBR网,直接进入Unity/Unreal.

## 运送它

保存`outputs/skill-3d-pipeline.md`技能采用3D简介 (输入:文本/一张图像/几张图像;输出:网格/斑点/NeRF;使用:染/游戏/VR) 和输出:管道 (多视频扩散+适应或直网模型),基模型,代预算,拓后处理,材料道需要.

## 运动

1. **Easy.**跑步`code/main.py`报告最终的MSE对目标.
2. **Medium.**扩展到颜色高素 (RGB). 确认重建符合目标颜色模式.
3. **Hard.**使用gsplat或Nerfstudio,从50张照片中重建一个真实对象.

## 关键词

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| 3D Gaussian Splatting | "3DGS" | Scene as a cloud of 3D Gaussians; differentiable alpha-composite render. |
| NeRF | "Neural radiance field" | MLP that outputs color + density at a 3D point; render by ray integration. |
| Triplane | "Three 2-D planes" | Factor 3D into three 2-D axis-aligned feature grids; cheaper than volumetric. |
| SDS | "Score distillation sampling" | Train 3D model by using 2D-diffusion score as pseudo-gradient. |
| Multi-view diffusion | "Many views at once" | Diffusion model that outputs a batch of consistent camera views. |
| PBR | "Physically-based rendering" | Material with albedo, roughness, metallic, normal channels. |
| Densification | "Grow splats" | 3DGS training heuristic: split / clone splats in high-gradient regions. |

## 制作说明: 3D 尚未共享基板

与图像 (延迟扩散+diT) 和视频 (空间时间diT) 不一样,3D在2026年没有单一的主导运行时间.

- **NeRF / triplane.**输入是射线行程 +每样本的MLP前进. 5122的转化需要数百万的MLP前进. 激进批量射线样本; SDPA/xformers适用.
- **Multi-view diffusion + LRM reconstruction.**两阶段管道.第一阶段 (多视图diT) 是一个扩散服务器,就像07课程一样.第二阶段 (LRM变压器) 是一个向前传递的视图.整体延迟配置文件是"扩散+一个拍摄" 选择按阶段服务原始物.
- **SDS / DreamFusion.**建立工作,而不是要求处理人员.

对于大多数2026产品,正确的答案是"按要求运行多视图扩散模型,重建到3DGS异步,为3DGS提供实时查看服务". 这将工作负载在 GPU 输入服务器 (快速) 和离线优化器 (慢) 之间清洁地划分.

## 进一步阅读

- [Mildenhall et al. (2020). NeRF: Representing Scenes as Neural Radiance Fields](https://arxiv.org/abs/2003.08934) 美国国家.
- [Kerbl et al. (2023). 3D Gaussian Splatting for Real-Time Radiance Field Rendering](https://arxiv.org/abs/2308.04079) 3DGS
- [Poole et al. (2022). DreamFusion: Text-to-3D using 2D Diffusion](https://arxiv.org/abs/2209.14988)  
- [Liu et al. (2023). Zero-1-to-3: Zero-shot One Image to 3D Object](https://arxiv.org/abs/2303.11328)零123
- [Shi et al. (2023). MVDream](https://arxiv.org/abs/2308.16512)多视图传播.
- [Hong et al. (2023). LRM: Large Reconstruction Model for Single Image to 3D](https://arxiv.org/abs/2311.04400) LRM
- [Gao et al. (2024). CAT3D: Create Anything in 3D with Multi-View Diffusion Models](https://arxiv.org/abs/2405.10314) CAT3D.
- [Stability AI (2024). Stable Video 3D (SV3D)](https://stability.ai/research/sv3d-novel-multi-view-synthesis-and-3d-generation-from-a-single-image-using-latent-video-diffusion) SV3D.
