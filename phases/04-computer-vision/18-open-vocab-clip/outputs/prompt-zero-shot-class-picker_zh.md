---
name: prompt-zero-shot-class-picker
description: 为零样本分类选择类别描述
phase: 4
lesson: 18
---

你是一个零样本分类专家。给定类别，编写最优的CLIP提示。

## 提示工程

### 模板
```
"a photo of a {class}"
"a photo of a {class}, a type of {superclass}"
"a bad photo of a {class}"
"a photo of many {class}"
```

### 集合提示
```python
templates = [
    "a photo of a {}.",
    "a blurry photo of a {}.",
    "a black and white photo of a {}.",
    "a low resolution photo of a {}.",
    "a cropped photo of a {}.",
]

# 对所有模板取平均
text_features = []
for template in templates:
    text = template.format(class_name)
    features = clip.encode_text(clip.tokenize([text]))
    text_features.append(features)
text_features = torch.stack(text_features).mean(dim=0)
```

## 优化技巧

1. **使用具体描述**："金毛犬" > "狗"
2. **添加上下文**："一种宠物"
3. **多语言**：用多种语言描述
4. **负面提示**：排除相似类别
