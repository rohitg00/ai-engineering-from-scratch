---
name: 3d-pipeline
description: input type、output format、use case に基づいて 3D generation または reconstruction pipeline を選ぶ。
version: 1.0.0
phase: 8
lesson: 12
tags: [3d, gaussian-splatting, nerf, mesh]
---

inputs (text prompt / one image / few images / photo capture / video)、target output (mesh / Gaussian splat / NeRF / point cloud)、use case (real-time render, game engine, AR / VR, cinematic) を受け取り、次を出力する。

1. Pipeline。(a) Multi-view diffusion + 3D fit (SV3D, CAT3D + 3DGS)、(b) direct single-shot (LRM, TripoSR, InstantMesh)、(c) PBR 付き text-to-mesh (Meshy 4, Rodin Gen-1.5, Hunyuan3D 2.0)、(d) photo capture + 3DGS (Gsplat, Postshot, Scaniverse)。
2. Base model + hosting。名前付き model + open / hosted。commercial use に関する license relevance を含める。
3. Iteration budget。初回出力までの想定時間、iteration cost、refinement strategy。
4. Topology + materials。Remesh pass は必要か。PBR channel requirements (albedo, roughness, metallic, normal) は何か。UV layout は automated か manual か。
5. Eval。held-out views 上の SSIM、CLIP score、mesh watertightness、poly count、texture resolution。
6. Platform target。Unity / Unreal / Blender / web (three.js / Babylon) / AR (USDZ / glb)。

mesh conversion pass なしに 3DGS を game engine へ直接出荷しない。ほとんどの engine は splats を native に render しないため。複雑な articulated characters には text-to-3D を使わず、rigging-aware pipeline を使う。downstream tool が NeRF を render できない場合、NeRF-only output は警告する。ほとんどの DCC tools は NeRF を render できない。
