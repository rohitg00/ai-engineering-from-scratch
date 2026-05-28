---
name: skill-pytorch-patterns
description: PyTorch の training、evaluation、deployment の reference patterns
version: 1.0.0
phase: 03
lesson: 11
tags: [pytorch, training, deep-learning, gpu, patterns]
---

## Canonical Training Loop

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

## Mixed Precision Training

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

使う場面: float16-capable hardware（V100、A100、H100、RTX 3090+）を持つ GPU で training するとき。約 1.5-2x の speedup と約 50% の memory reduction が期待できます。

## Gradient Accumulation

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

使う場面: effective batch size を GPU memory が許す範囲より大きくする必要があるとき。loss を accumulation_steps で割ることで gradient scale を一貫させます。

## Save and Load

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

training を resume するには、必ず optimizer state も保存してください。inference-only なら `model.state_dict()` だけを保存します。

## Custom Dataset

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

## DataLoader Configuration

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

| Parameter | 何をするか | いつ使うか |
|-----------|-------------|-------------|
| num_workers=4 | parallel data loading | multi-core machines では常に |
| pin_memory=True | page-locked CPU memory | GPU で training するとき |
| drop_last=True | incomplete final batch を捨てる | BatchNorm を使うとき |
| persistent_workers=True | workers を epochs 間で生かしておく | num_workers > 0 のとき |

## Learning Rate Schedules

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

OneCycleLR は多くの task に対する最良の default です。max_lr まで warm up し、その後 cosine decay します。`scheduler.step()` は epoch ごとではなく、必ず batch ごとに呼んでください。

## Weight Initialization

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

## Inference Mode

```python
model.eval()

with torch.inference_mode():
    outputs = model(inputs)
```

`torch.inference_mode()` は、gradient computation を抑制するだけでなく autograd を完全に無効化するため、`torch.no_grad()` より高速です。

## Common Mistakes Checklist

1. CrossEntropyLoss の前に softmax を適用する（内部で log_softmax を含む）
2. validation 中に model.eval() を呼び忘れる
3. tensors を model と同じ device に移し忘れる
4. optimizer.zero_grad() を呼ばない（gradients は default で蓄積される）
5. training 中に torch.no_grad() を使う（gradient computation を無効化する）
6. num_workers を高くしすぎる（processes を増やしすぎ、memory thrashing を起こす）
7. GPU training で pin_memory=True を使わない
8. state_dict ではなく model object 全体を保存する（refactor で壊れる）
