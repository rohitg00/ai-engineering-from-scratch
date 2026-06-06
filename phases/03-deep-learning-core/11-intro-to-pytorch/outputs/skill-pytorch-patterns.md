---
name: skill-pytorch-patterns
description: Reference patterns for PyTorch training, evaluation, and deployment
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

Use when: training on GPU with float16-capable hardware (V100, A100, H100, RTX 3090+). Expect ~1.5-2x speedup and ~50% memory reduction.

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

Use when: effective batch size needs to be larger than GPU memory allows. Dividing loss by accumulation_steps keeps gradient scale consistent.

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

Always save optimizer state for resuming training. For inference-only, save just `model.state_dict()`.

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

| Parameter | What it does | When to use |
|-----------|-------------|-------------|
| num_workers=4 | Parallel data loading | Always on multi-core machines |
| pin_memory=True | Page-locked CPU memory | When training on GPU |
| drop_last=True | Drop incomplete final batch | When using BatchNorm |
| persistent_workers=True | Keep workers alive across epochs | When num_workers > 0 |

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

OneCycleLR: best default for most tasks. Warms up to max_lr, then cosine decays. Call `scheduler.step()` after every batch, not every epoch.

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

`torch.inference_mode()` is faster than `torch.no_grad()` because it disables autograd entirely rather than just suppressing gradient computation.

## Common Mistakes Checklist

1. Applying softmax before CrossEntropyLoss (it includes log_softmax internally)
2. Forgetting to call model.eval() during validation
3. Forgetting to move tensors to the same device as the model
4. Not calling optimizer.zero_grad() (gradients accumulate by default)
5. Using torch.no_grad() during training (disables gradient computation)
6. Setting num_workers too high (spawns too many processes, thrashes memory)
7. Not using pin_memory=True when training on GPU
8. Saving the entire model object instead of state_dict (breaks on refactor)
