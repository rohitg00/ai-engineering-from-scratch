---
name: skill-3dgs-export-router
description: 导出3DGS到不同格式
version: 1.0.0
phase: 4
lesson: 22
tags: [3dgs, export, rendering]
---

# 3DGS导出路由器

## 导出格式

### PLY（标准）
```python
# 保存高斯参数
# 位置、球谐系数、不透明度、尺度、旋转
gaussians.save_ply("output.ply")
```

### Splat（压缩）
```python
# 压缩表示，适合Web
gaussians.save_splat("output.splat")
```

### 点云
```python
# 导出为普通点云
positions = gaussians.get_xyz
colors = gaussians.get_rgb
save_point_cloud("output.pcd", positions, colors)
```

## 平台支持

| 平台 | 格式 | 工具 |
|------|------|------|
| Web | .splat | Three.js |
| Unity | .ply | GaussianSplattingSDK |
| Unreal | .ply | 插件 |
| Blender | .ply | 导入脚本 |
