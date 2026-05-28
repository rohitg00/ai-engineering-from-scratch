---
name: skill-3dgs-export-router
description: Pick the right 3DGS export format (.ply / .splat / glTF KHR_gaussian_splatting / USD) given the downstream viewer or engine
version: 1.0.0
phase: 4
lesson: 22
tags: [3d-gaussian-splatting, export, glTF, OpenUSD, pipeline]
---

# 3DGS Export Router

downstream target を適切な 3DGS file format に map する。"it does not load" debugging の何時間も節約する。

## 使う場面

- 3DGS scene を training した後、content pipeline と共有する前。
- research-grade (.ply) と production-grade (glTF / USD) formats のどちらを選ぶか決めるとき。
- Pipeline handoff: capture team -> 3DGS engineer -> game designer / VFX artist / web developer。

## 入力

- `target_engine`: unreal | unity | omniverse | blender | vision_pro | three_js | babylon_js | cesium | playcanvas | supersplat
- `priority`: portability | file_size | quality_preservation
- `include_sh_degree`: 0 | 1 | 2 | 3

## format の判断

| Target | Recommended format | Why |
|--------|--------------------|-----|
| Unreal Engine (virtual production) | Volinga plugin or glTF KHR_gaussian_splatting | Native Unreal SDK path |
| Unity (XR / game) | .ply via Aras-P Unity-GaussianSplatting plugin | Community-standard Unity pipeline |
| NVIDIA Omniverse, Pixar tools | OpenUSD 26.03 (UsdVolParticleField3DGaussianSplat) | Native USD prim type |
| Apple Vision Pro | OpenUSD 26.03 | visionOS 2.x に native |
| Blender | .ply + KIRI Engine add-on | Community add-on が raw splats を読む |
| Three.js web viewer | glTF KHR_gaussian_splatting or .splat | Browser-standard、`GaussianSplats3D` で動作 |
| Babylon.js V9+ | glTF KHR_gaussian_splatting | V9 で native support が追加 |
| Cesium (CesiumJS 1.139+, Cesium for Unreal 2.23+) | glTF KHR_gaussian_splatting | explicit support が shipped |
| PlayCanvas | .splat | PlayCanvas native quantised format |
| SuperSplat (editor) | .ply or .splat | Import + export |

## quantisation の trade-off

- `.ply` full-precision: 最大 file、lossless、任意 viewer。
- `.splat`: 4x-8x 小さい。SH3 coefficients にわずかな quality loss。PlayCanvas-ecosystem standard。
- glTF KHR: EXT_meshopt_compression で configurable。最小かつ互換性が高い。
- USD: USDZ packaging で圧縮される。Apple pipelines で最小。

## 出力レポート

```
[export plan]
  target:         <engine>
  format:         <name>
  sh degree:      <0|1|2|3>
  compression:    <none|meshopt|quantisation|usdz>
  expected size:  <MB>
  compatible with: <list of viewers>

[pipeline]
  1. source: <.ply from training>
  2. optional: SuperSplat cleanup pass
  3. convert: <tool + CLI or API call>
  4. package: <.gltf / .glb / .usd / .usdz / .splat / .ply>
  5. validate: <viewer sanity check>
```

## ルール

- SH3 coefficients を黙って strip してはいけない。specular reflections が見た目に変わる。
- `priority == file_size` の場合は `.splat` または meshopt 付き glTF を推奨し、quality loss を警告する。
- Apple platforms では 2026 年時点で glTF より USD / USDZ を優先する。USDZ は visionOS support が first-class である。
- target viewer の 3DGS support が pre-standard (pre-Feb 2026) の場合、`.ply` と viewer の custom loader を推奨する。Khronos-standard glTF はまだ認識されない。
- handoff 前に少なくとも 1 つの viewer で exported file を必ず validate する。quantisation 中に silent corruption が起きる。
