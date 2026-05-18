---
name: skill-anchor-designer
description: 为YOLO风格检测器设计锚框
version: 1.0.0
phase: 4
lesson: 6
tags: [object-detection, yolo, anchors]
---

# 锚框设计器

## K-Means聚类设计锚框

```python
def kmeans_anchors(boxes, k=9):
    """
    boxes: [[w, h], ...] 所有GT框的宽度和高度
    k: 锚框数量
    """
    from sklearn.cluster import KMeans
    
    # 使用IoU作为距离度量
    def iou_distance(boxes, anchors):
        # 计算所有box-anchor对的IoU
        inter_w = np.minimum(boxes[:, 0:1], anchors[:, 0].T)
        inter_h = np.minimum(boxes[:, 1:2], anchors[:, 1].T)
        inter = inter_w * inter_h
        
        area_boxes = boxes[:, 0] * boxes[:, 1]
        area_anchors = anchors[:, 0] * anchors[:, 1]
        union = area_boxes[:, None] + area_anchors[None, :] - inter
        
        return 1 - inter / union  # 距离 = 1 - IoU
    
    kmeans = KMeans(n_clusters=k, random_state=0)
    kmeans.fit(boxes)
    
    return kmeans.cluster_centers_
```

## 常用锚框配置

**YOLOv3 (COCO)：**
- 小物体：(10,13), (16,30), (33,23)
- 中物体：(30,61), (62,45), (59,119)
- 大物体：(116,90), (156,198), (373,326)

**YOLOv5 (COCO)：**
- 小物体：(10,13), (16,30), (33,23)
- 中物体：(30,61), (62,45), (59,119)
- 大物体：(116,90), (156,198), (373,326)

## 锚框设计原则

1. **基于数据集**：用K-Means在训练集上聚类
2. **多尺度**：不同特征层负责不同大小
3. **宽高比**：覆盖1:1、1:2、2:1等常见比例
4. **数量**：通常9个（3层×3个）

## 检查清单

- [ ] 锚框覆盖数据集中所有物体大小
- [ ] 小物体锚框足够小
- [ ] 大物体锚框足够大
- [ ] 宽高比多样化
- [ ] 在验证集上测试召回率
