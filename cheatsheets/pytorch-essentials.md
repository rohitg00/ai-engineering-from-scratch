---
id: pytorch-essentials
title: PyTorch Essentials
code: PT
subtitle: Tensors, autograd, nn.Module, the training loop, DataLoader and devices, from the lessons.
hue: 60
sources: phases/03-deep-learning-core/11-intro-to-pytorch, phases/03-deep-learning-core/13-debugging-neural-networks, phases/00-setup-and-tooling/03-gpu-setup-and-cloud, phases/00-setup-and-tooling/12-debugging-and-profiling
source_hash: 37c75e06555d8bf9
---

## Tasks
type: task-table
from: phases/03-deep-learning-core/11-intro-to-pytorch/docs/en.md, phases/00-setup-and-tooling/03-gpu-setup-and-cloud/docs/en.md

| Task | Code |
|---|---|
| Pick a device | `device = torch.device("cuda" if torch.cuda.is_available() else "cpu")` |
| Make a tensor on it | `x = torch.randn(3, 4, device=device)` |
| Move model and batch | `model = model.to(device)` |
| Count parameters | `sum(p.numel() for p in model.parameters())` |
| Save weights | `torch.save(model.state_dict(), "model.pt")` |
| Load weights | `model.load_state_dict(torch.load("model.pt", weights_only=True))` |
| Evaluate without graph | `model.eval()` then `with torch.no_grad():` |
| Check the GPU | `torch.cuda.get_device_name(0)` |

## Training step
type: flow
from: phases/03-deep-learning-core/11-intro-to-pytorch/docs/en.md

1. **DataLoader**: yields a batch of inputs and targets.
2. **Device**: `inputs.to(device), targets.to(device)` moves the batch.
3. **Optimizer**: `optimizer.zero_grad()` clears old gradients.
4. **Model**: `outputs = model(inputs)` runs the forward pass.
5. **Loss fn**: `criterion(outputs, targets)` gives one scalar.
6. **Autograd**: `loss.backward()` replays the tape in reverse.
7. **Optimizer**: `optimizer.step()` updates the parameters.

## Training pipeline
type: architecture
from: phases/03-deep-learning-core/11-intro-to-pytorch/docs/en.md

```arch
node | ds | 1,1 | Dataset | __len__, __getitem__
node | dl | 2,1 | DataLoader | batch, shuffle, workers
node | model | 3,1 | nn.Module | forward(), parameters()
node | loss | 3,2 | Loss fn | logits and targets
node | tape | 2,2 | Autograd | loss.backward()
node | opt | 1,2 | Optimizer | step(), zero_grad()
edge | ds | dl | samples
edge | dl | model | batch
edge | model | loss | outputs
edge | loss | tape | backward
edge | tape | opt | grads
edge | opt | model | update
```

## Train and evaluate
type: annotated-code
lang: python
from: phases/03-deep-learning-core/11-intro-to-pytorch/docs/en.md

```python
criterion = nn.CrossEntropyLoss()                 # takes raw logits
optimizer = torch.optim.Adam(model.parameters(), lr=1e-3)
for epoch in range(num_epochs):
    model.train()                                 # dropout and batch norm on
    for inputs, targets in train_loader:
        inputs, targets = inputs.to(device), targets.to(device)
        optimizer.zero_grad()                     # gradients accumulate
        outputs = model(inputs)                   # forward pass
        loss = criterion(outputs, targets)
        loss.backward()                           # compute gradients
        optimizer.step()                          # update weights
model.eval()                                      # eval mode for test
with torch.no_grad():                             # no graph, less memory
    outputs = model(images)
```

## Data and mixed precision
type: annotated-code
lang: python
from: phases/03-deep-learning-core/11-intro-to-pytorch/docs/en.md

```python
class MNISTDataset(Dataset):
    def __len__(self):
        return len(self.labels)                   # number of samples
    def __getitem__(self, idx):
        return self.images[idx], self.labels[idx] # one sample
loader = DataLoader(dataset, batch_size=64, shuffle=True, num_workers=4)
scaler = GradScaler()                             # from torch.amp
for inputs, targets in loader:
    with autocast(device_type="cuda"):            # float16 forward
        outputs = model(inputs)
        loss = criterion(outputs, targets)
    scaler.scale(loss).backward()                 # scaled backward
    scaler.step(optimizer)
    scaler.update()
    optimizer.zero_grad()
```

## Tensor ops
type: command-table
from: phases/03-deep-learning-core/11-intro-to-pytorch/docs/en.md, phases/03-deep-learning-core/13-debugging-neural-networks/docs/en.md

| Command | What it does |
|---|---|
| `x.view(2, 12)` | Reshape. Tensor must be contiguous |
| `x.reshape(6, 4)` | Reshape. Works always |
| `x.permute(2, 0, 1)` | Reorders dimensions |
| `x.unsqueeze(0)` | Adds a dimension, `(1, 2, 3, 4)` |
| `x.squeeze()` | Removes size 1 dimensions |
| `x.to("cuda")` / `x.cpu()` | Moves the tensor between devices |
| `.detach()` | Cuts the tensor from the graph |
| `labels.long()` | Casts labels for cross-entropy |

## Modules
type: command-table
from: phases/03-deep-learning-core/11-intro-to-pytorch/docs/en.md

| Command | What it does |
|---|---|
| `nn.Linear(in, out)` | $Wx + b$, in*out + out parameters |
| `nn.Conv2d(in_ch, out_ch, k)` | 2D convolution |
| `nn.BatchNorm1d(features)` | Normalizes activations, 2 * features |
| `nn.LayerNorm(dim)` | Per sample normalization, 2 * dim |
| `nn.Dropout(p)` | Random zeroing, 0 parameters |
| `nn.ReLU()` | $\max(0, x)$ |
| `nn.Embedding(vocab, dim)` | Lookup table, vocab * dim |
| `nn.Sequential(...)` | Runs modules in order |

## Defaults and numbers
type: defaults
from: phases/03-deep-learning-core/11-intro-to-pytorch/docs/en.md, phases/03-deep-learning-core/13-debugging-neural-networks/docs/en.md, phases/00-setup-and-tooling/03-gpu-setup-and-cloud/docs/en.md

| Setting | Default | Note |
|---|---|---|
| Tensor dtype | float32 | default training precision |
| LLM training dtype | bfloat16 | float32 range, less precision |
| Adam learning rate | 1e-3 | default start point |
| SGD start learning rate | 1e-2 | or 1e-1, per the debug lesson |
| DataLoader batch_size | 64 | lesson train loader |
| num_workers | 4 | parallel load processes |
| Dropout in MNIST MLP | 0.2 | after each hidden ReLU |
| fp16 bytes per parameter | 2 | divide GPU memory by 2, keep a margin |

## Key concepts
type: concepts
from: phases/03-deep-learning-core/11-intro-to-pytorch/docs/en.md

- **Tensor**: array with a shape, a dtype and a device.
- **Same device rule**: every operation needs all tensors on one device.
- **Autograd**: records operations on a tape, then replays it in reverse.
- **Leaf tensor**: only leaves with `requires_grad=True` accumulate gradients.
- **Accumulation**: gradients add up by default. Call `zero_grad` each step.
- **Registration**: modules and `nn.Parameter` set in `__init__` are found by `parameters()`.
- **state_dict**: names mapped to tensors. Portable across code changes.
- **Mixed precision**: float16 forward and backward, float32 master weights.

## Troubleshooting
type: troubleshooting
from: phases/03-deep-learning-core/13-debugging-neural-networks/docs/en.md, phases/03-deep-learning-core/11-intro-to-pytorch/docs/en.md

| Symptom | Cause | Fix |
|---|---|---|
| `RuntimeError: expected CUDA tensor` | model and data on different devices | `.to(device)` on model and data |
| `RuntimeError: modified by in-place operation` | in-place op breaks autograd | replace `x += 1` with `x = x + 1` |
| Loss oscillates | no `optimizer.zero_grad()` | call it before `loss.backward()` |
| Test accuracy varies between runs | no `model.eval()` at test time | add `model.eval()` and `torch.no_grad()` |
| Out of memory | graph not freed | `.detach()` or `torch.no_grad()` |
| Cross-entropy dtype error | labels are Float | cast with `labels.long()` |
| Wrong gradients, no error | softmax output passed to `CrossEntropyLoss` | pass raw logits |
| Loss jumps to NaN | exploding gradients | `torch.nn.utils.clip_grad_norm_` or lower LR |

## Debug probes
type: task-table
from: phases/03-deep-learning-core/13-debugging-neural-networks/docs/en.md, phases/00-setup-and-tooling/12-debugging-and-profiling/docs/en.md

| Task | Code |
|---|---|
| Find the op that made NaN | `with torch.autograd.detect_anomaly():` |
| Check loss for NaN | `torch.isnan(loss)` |
| Read the grad norm | `torch.nn.utils.clip_grad_norm_(model.parameters(), float("inf"))` |
| Read GPU memory | `torch.cuda.memory_allocated() / 1e9` |

## Tips
type: tips
from: phases/03-deep-learning-core/13-debugging-neural-networks/docs/en.md, phases/03-deep-learning-core/11-intro-to-pytorch/docs/en.md

- Run the overfit-one-batch test first. If it fails, the setup is broken.
- Try 3 learning rates, 10x apart, before you look for other bugs.
- Print shapes after every operation. Broadcasting hides shape bugs.
- Normalize inputs to mean 0 and std 1.
- A loss stuck at -log(1/num_classes) means uniform predictions.
- Use `num_workers` on disk bound data. It can double speed.
