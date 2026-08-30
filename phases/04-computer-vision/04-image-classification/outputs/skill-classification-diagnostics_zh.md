---
name: skill-classification-diagnostics
description: 诊断图像分类模型的问题
version: 1.0.0
phase: 4
lesson: 4
tags: [classification, debugging, vision]
---

# 图像分类诊断

## 训练损失不下降

1. **检查数据**
   - 打印批次：图像看起来合理吗？
   - 检查标签：是0-indexed吗？
   - 检查形状：是(N, C, H, W)吗？

2. **检查模型**
   - 输出维度是否等于类别数？
   - 是否忘记最后的全连接层？
   - 预训练权重加载成功了吗？

3. **检查损失**
   - 分类用CrossEntropyLoss（不是MSE）
   - 是否应用了softmax？（CrossEntropy内部包含）
   - 标签是Long类型吗？

## 训练准确率高，验证准确率低

1. **数据增强过强**
   - 验证：暂时关闭增强
   - 修复：减弱增强强度

2. **学习率太高**
   - 验证：降低LR 10倍
   - 修复：添加学习率衰减

3. **模型太大**
   - 验证：尝试更小的骨干
   - 修复：添加dropout或权重衰减

4. **数据泄露**
   - 验证：检查训练/验证重叠
   - 修复：重新分割数据

## 训练和验证准确率都低

1. **模型容量不足**
   - 尝试更大的骨干（ResNet-50 → ResNet-101）

2. **学习率太低**
   - 尝试增加LR 10倍

3. **训练时间不够**
   - 增加轮数

4. **数据问题**
   - 检查标签质量
   - 检查图像质量

## 类别不平衡处理

```python
# 方法1：类别权重
class_weights = 1.0 / class_counts
class_weights = class_weights / class_weights.sum()
criterion = nn.CrossEntropyLoss(weight=class_weights)

# 方法2：过采样
from torch.utils.data import WeightedRandomSampler
sampler = WeightedRandomSampler(sample_weights, num_samples=len(dataset))

# 方法3：Focal Loss
class FocalLoss(nn.Module):
    def __init__(self, gamma=2.0, alpha=0.25):
        super().__init__()
        self.gamma = gamma
        self.alpha = alpha
    
    def forward(self, inputs, targets):
        ce_loss = F.cross_entropy(inputs, targets, reduction='none')
        pt = torch.exp(-ce_loss)
        focal_loss = self.alpha * (1 - pt) ** self.gamma * ce_loss
        return focal_loss.mean()
```
