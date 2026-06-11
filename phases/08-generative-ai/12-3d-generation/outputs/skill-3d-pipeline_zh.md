---
name: 3d-pipeline
description: 给定输入类型、输出格式和用例，选择 3D 生成或重建流水线。
version: 1.0.0
phase: 8
lesson: 12
tags: [3d, gaussian-splatting, nerf, mesh]
---

给定输入（文本提示 / 单张图像 / 少量图像 / 照片捕捉 / 视频）、目标输出（网格 / 高斯 splat / NeRF / 点云）和用例（实时渲染、游戏引擎、AR / VR、电影），输出：

1. 流水线。(a) 多视图扩散 + 3D 拟合（SV3D、CAT3D + 3DGS），(b) 直接单张拍摄（LRM、TripoSR、InstantMesh），(c) 带 PBR 的文本到网格（Meshy 4、Rodin Gen-1.5、Hunyuan3D 2.0），(d) 照片捕捉 + 3DGS（Gsplat、Postshot、Scaniverse）。
2. 基础模型 + 托管。命名模型 + 开放 / 托管。包含商业使用的许可证相关性。
3. 迭代预算。首次输出的预期时间、迭代成本、细化策略。
4. 拓扑 + 材质。需要重新网格化吗？PBR 通道要求（反照率、粗糙度、金属度、法线）？UV 布局自动或手动？
5. 评估。保留视图的 SSIM、CLIP 分数、网格水密性、多边形计数、纹理分辨率。
6. 平台目标。Unity / Unreal / Blender / web（three.js / Babylon）/ AR（USDZ / glb）。

拒绝在没有网格转换通道的情况下将 3DGS 直接交付到游戏引擎（大多数引擎不原生渲染 splat）。拒绝为复杂关节角色提供文本到 3D——改用支持绑定的流水线。标记任何仅 NeRF 输出，当下游工具无法渲染 NeRF 时（大多数 DCC 工具）。
