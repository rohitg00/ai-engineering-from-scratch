---
name: 3d-pipeline
description: 根据输入类型、输出格式和用例选择 3D 生成或重建流水线
version: 1.0.0
phase: 8
lesson: 12
tags: [3d, gaussian-splatting, nerf, mesh]
---

给定输入（文本提示 / 单张图像 / 少量图像 / 照片采集 / 视频）、目标输出（网格 / 高斯泼溅 / NeRF / 点云）和用例（实时渲染、游戏引擎、AR / VR、影视级），输出：

1. **流水线**。（a）多视角扩散 + 3D 拟合（SV3D、CAT3D + 3DGS）、（b）直接单次生成（LRM、TripoSR、InstantMesh）、（c）带 PBR 的文本到网格（Meshy 4、Rodin Gen-1.5、Hunyuan3D 2.0）、（d）照片采集 + 3DGS（Gsplat、Postshot、Scaniverse）。
2. **基础模型 + 托管**。命名的模型 + 开源/托管。包括商业使用的许可相关性。
3. **迭代预算**。首次输出预期时间、迭代成本、精化策略。
4. **拓扑 + 材质**。是否需要重新网格化？PBR 通道需求（反照率、粗糙度、金属度、法线贴图）？UV 布局自动还是手动？
5. **评估**。保留视角的 SSIM、CLIP 分数、网格水密性、多边形数量、纹理分辨率。
6. **平台目标**。Unity / Unreal / Blender / 网页（three.js / Babylon）/ AR（USDZ / glb）。

拒绝直接将 3DGS 导入游戏引擎而不进行网格转换（大多数引擎不原生支持泼溅渲染）。拒绝将文本到 3D 用于复杂的关节角色——应使用支持绑定的流水线。标记仅输出 NeRF 但下游工具无法渲染 NeRF 的情况（大多数 DCC 工具）。
