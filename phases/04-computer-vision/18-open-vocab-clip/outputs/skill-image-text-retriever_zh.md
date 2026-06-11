---
name: skill-image-text-retriever
description: 实现图像-文本检索
version: 1.0.0
phase: 4
lesson: 18
tags: [clip, retrieval, multimodal]
---

# 图像-文本检索器

## 原理

使用CLIP将图像和文本映射到同一嵌入空间，通过余弦相似度检索。

## 实现

```python
import clip
import torch
import torch.nn.functional as F

# 加载模型
model, preprocess = clip.load("ViT-B/32", device=device)

# 编码图像库
image_features = []
for image in image_dataset:
    image_input = preprocess(image).unsqueeze(0).to(device)
    with torch.no_grad():
        features = model.encode_image(image_input)
        features = F.normalize(features, dim=-1)
    image_features.append(features)
image_features = torch.cat(image_features, dim=0)

# 文本查询
text_input = clip.tokenize(["a photo of a dog"]).to(device)
with torch.no_grad():
    text_features = model.encode_text(text_input)
    text_features = F.normalize(text_features, dim=-1)

# 检索最相似的图像
similarities = (text_features @ image_features.T).squeeze(0)
top_k = similarities.topk(5)
```

## 优化

- **索引**：使用FAISS加速大规模检索
- **缓存**：预计算并保存图像特征
- **批处理**：批量编码提高效率
