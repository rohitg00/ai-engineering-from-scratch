---
name: skill-pytorch-patterns
description: PyTorch训练、评估和部署的参考模式
version: 1.0.0
phase: 03
lesson: 11
tags: [pytorch, training, deep-learning, gpu, patterns]
---

## 规范训练循环

```python
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
model = Model().to(device)
criterion = nn.CrossEntropyLoss()
optimizer = torch.optim.AdamW(model.parameters(), lr=1e-3, weight_decay=0.01)

for epoch in range(num_epochs):
    model.train()
    for inputs, targets in train_loader:
        inputs, targets = inputs.to(device), targets.to(device)
        optimizer.zero_grad()
        outputs = model(inputs)
        loss = criterion(outputs, targets)
        loss.backward()
        torch.nn.utils.clip_grad_norm_(model.parameters(), max_norm=1.0)
        optimizer.step()

    model.eval()
    with torch.no_grad():
        for inputs, targets in val_loader:
            inputs, targets = inputs.to(device), targets.to(device)
            outputs = model(inputs)
```

## 混合精度训练

```python
from torch.amp import autocast, GradScaler

scaler = GradScaler()
for inputs, targets in train_loader:
    inputs, targets = inputs.to(device), targets.to(device)
    optimizer.zero_grad()
    with autocast(device_type="cuda"):
        outputs = model(inputs)
        loss = criterion(outputs, targets)
    scaler.scale(loss).backward()
    scaler.step(optimizer)
    scaler.update()
```

使用时机：在支持float16的GPU上训练（V100、A100、H100、RTX 3090+）。预期约1.5-2倍加速和约50%内存减少。

## 梯度累积

```python
accumulation_steps = 4
optimizer.zero_grad()
for i, (inputs, targets) in enumerate(train_loader):
    inputs, targets = inputs.to(device), targets.to(device)
    outputs = model(inputs)
    loss = criterion(outputs, targets) / accumulation_steps
    loss.backward()
    if (i + 1) % accumulation_steps == 0:
        optimizer.step()
        optimizer.zero_grad()
```

使用时机：有效批量大小需要大于GPU内存允许时。除以accumulation_steps保持梯度尺度一致。

## 保存和加载

```python
torch.save({
    "epoch": epoch,
    "model_state_dict": model.state_dict(),
    "optimizer_state_dict": optimizer.state_dict(),
    "loss": loss.item(),
}, "checkpoint.pt")

checkpoint = torch.load("checkpoint.pt", weights_only=True)
model.load_state_dict(checkpoint["model_state_dict"])
optimizer.load_state_dict(checkpoint["optimizer_state_dict"])
```

恢复训练时始终保存优化器状态。仅推理时，保存`model.state_dict()`即可。

## 自定义数据集

```python
class CustomDataset(torch.utils.data.Dataset):
    def __init__(self, data_dir, transform=None):
        self.samples = self._load_samples(data_dir)
        self.transform = transform

    def __len__(self):
        return len(self.samples)

    def __getitem__(self, idx):
        x, y = self.samples[idx]
        if self.transform:
            x = self.transform(x)
        return x, y

    def _load_samples(self, data_dir):
        ...
```

## DataLoader配置

```python
train_loader = torch.utils.data.DataLoader(
    dataset,
    batch_size=64,
    shuffle=True,
    num_workers=4,
    pin_memory=True,
    drop_last=True,
    persistent_workers=True,
)
```

| 参数 | 作用 | 何时使用 |
|------|------|---------|
| num_workers=4 | 并行数据加载 | 多核机器上始终使用 |
| pin_memory=True | 页锁定CPU内存 | GPU训练时使用 |
| drop_last=True | 丢弃不完整最后批次 | 使用BatchNorm时 |
| persistent_workers=True | 跨轮保持worker存活 | num_workers > 0时 |

## 学习率调度

```python
scheduler = torch.optim.lr_scheduler.OneCycleLR(
    optimizer,
    max_lr=1e-3,
    total_steps=num_epochs * len(train_loader),
    pct_start=0.1,
)

for epoch in range(num_epochs):
    for inputs, targets in train_loader:
        ...
        optimizer.step()
        scheduler.step()
```

OneCycleLR：大多数任务的最佳默认。预热到max_lr，然后余弦衰减。每批次调用`scheduler.step()`，不是每轮。

## 权重初始化

```python
def init_weights(module):
    if isinstance(module, nn.Linear):
        nn.init.kaiming_normal_(module.weight, nonlinearity="relu")
        if module.bias is not None:
            nn.init.zeros_(module.bias)
    elif isinstance(module, nn.Conv2d):
        nn.init.kaiming_normal_(module.weight, mode="fan_out", nonlinearity="relu")

model.apply(init_weights)
```

## 推理模式

```python
model.eval()

with torch.inference_mode():
    outputs = model(inputs)
```

`torch.inference_mode()`比`torch.no_grad()`更快，因为它完全禁用autograd而不是仅仅抑制梯度计算。

## 常见错误检查清单

1. 在CrossEntropyLoss前应用softmax（它内部包含log_softmax）
2. 验证期间忘记调用model.eval()
3. 忘记将张量移动到与模型相同的设备
4. 不调用optimizer.zero_grad()（梯度默认累积）
5. 训练期间使用torch.no_grad()（禁用梯度计算）
6. num_workers设置太高（产生太多进程，内存抖动）
7. GPU训练时不使用pin_memory=True
8. 保存整个模型对象而不是state_dict（重构时破坏）
