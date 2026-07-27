---
name: skill-anchor-designer
description: 给定真实框数据集，对 (w, h) 运行 k-means 并返回每个 FPN 级别的锚框集及覆盖率统计量
version: 1.0.0
phase: 4
lesson: 6
tags: [computer-vision, detection, anchors, kmeans]
---

# 锚框设计器（Anchor Designer）

锚框是基于锚框的检测器中最具数据集特异性的超参数。默认的 COCO 锚框在细胞培养图像、卫星瓦片或小目标监控场景中表现不佳。本技能推导出真正匹配目标数据的锚框。

## 何时使用

- 在新数据集上进行首次训练运行之前。
- 当对非常小或非常大的目标的召回率在模型其他方面表现健康的情况下较弱时。
- 在可能导致框尺寸分布发生变化的大规模数据集扩展之后。

## 输入

- `boxes`：形状为 (N, 4) 的 numpy 数组，格式为 `(cx, cy, w, h)` 或 `(x1, y1, x2, y2)`；建议至少 1000 个正样本框。
- `num_anchors_per_level`：通常为 3。
- `num_fpn_levels`：通常为 3（P3、P4、P5）或 4。
- `input_size`：训练分辨率 HxW。
- 可选 `strides`：每个层级的步长；省略时取 `[8, 16, 32, 64]` 的前 `num_fpn_levels` 项。如果检测器的 FPN 具有不同的步长，显式传入更长或更短的数组。

## 步骤

1. **归一化框**为 `(w, h)` 对，以 `input_size` 处的像素为单位。删除任何 w 或 h < 2 像素的框。

2. **对 `(w, h)` 对运行 k-means**，`k = num_anchors_per_level * num_fpn_levels`。使用 `1 - IoU(box, cluster)` 作为距离函数，而非欧几里得距离——欧几里得距离在 `(w, h)` 上会将细长的高框和方形框混为一谈。所有框权重相等（无加权）；如果你有不平衡的数据集并希望提高大框的召回率，将稀有类别的框重复放入输入数组，而非传权重向量。

3. **按面积升序对聚类排序。** 分成 `num_fpn_levels` 组，每组 `num_anchors_per_level` 个。最小面积分配到最高分辨率层级（最小步长）。

4. **计算每个层级的覆盖率统计量：**
   - `median IoU`——每个真实框与其该层级最佳锚框的中位数 IoU。
   - `recall@IoU=0.5`——最佳锚框的 IoU >= 0.5 的框百分比。
   - `area coverage`——框面积落在该层级 `[anchor_min_area / 4, anchor_max_area * 4]` 范围内的比例。

5. **报告每个层级的锚框**并标记 `recall@IoU=0.5 < 0.9` 的层级；该层级的锚框与数据匹配不佳，应重新调整或增加每层级锚框数量。

## 报告格式

```
[anchor-designer]
  total boxes:         <N>
  clusters:            <k>
  distance metric:     1 - IoU

[level P3  stride=8]
  anchors (w, h):      [(A, B), (C, D), (E, F)]
  median IoU:          <X>
  recall@IoU=0.5:      <X>
  coverage:            <X>
  flag:                ok | retune

[level P4  stride=16]
  ...

[summary]
  overall recall@IoU=0.5: <X>
  smallest anchor:        <w x h>
  largest anchor:         <w x h>
  recommendation:         <如有层级被标记，一句话建议>
```

## 规则

- 始终使用基于 IoU 的距离；欧几里得 k-means 会产生视觉上合理但经验上更差的锚框。
- 按面积对聚类排序，然后按升序分配给层级。
- 当 `num_anchors_per_level = 1` 时，完全跳过 k-means：将框按面积分位数分成 `num_fpn_levels` 个区间（例如 3 个层级则为三分位数），并将每个层级的锚框设为该区间中位数 (w, h)。对于小数据集，这比运行 `k = num_fpn_levels` 的 k-means 更稳健。
- 绝不输出负的锚框尺寸；限制最小值为 1。
- 如果数据集少于 200 个框，警告用户锚框搜索不可靠，建议使用默认 COCO 锚框并增加训练数据。
