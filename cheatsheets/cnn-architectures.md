---
id: cnn-architectures
title: CNN Architectures and Transfer Learning
code: CA
subtitle: Size convolutions, build LeNet to ResNet, train a classifier and fine-tune a pretrained backbone. PyTorch and NumPy.
hue: 15
sources: phases/04-computer-vision/02-convolutions-from-scratch, phases/04-computer-vision/03-cnns-lenet-to-resnet, phases/04-computer-vision/04-image-classification, phases/04-computer-vision/05-transfer-learning
source_hash: d153dcbc9565a455
---

## Formulas
type: concepts
from: phases/04-computer-vision/02-convolutions-from-scratch/docs/en.md, phases/04-computer-vision/03-cnns-lenet-to-resnet/docs/en.md, phases/04-computer-vision/04-image-classification/docs/en.md, phases/04-computer-vision/05-transfer-learning/docs/en.md

- **Output size**: $H_{out} = \lfloor (H - K + 2P) / S \rfloor + 1$
- **Same padding**: $P = (K - 1) / 2$ for odd $K$ and $S = 1$.
- **Conv parameters**: `C_out * C_in * K * K + C_out`. The last term is the biases.
- **Receptive field**: $1 + L (K - 1)$ for $L$ stacked convs at stride 1.
- **Two 3x3 or one 5x5**: same 5x5 view. $18C^2$ against $25C^2$ parameters.
- **Residual block**: $y = F(x) + x$. The block learns identity with $F(x) = 0$.
- **Cross-entropy**: $-z_y + \log \sum_j \exp(z_j)$ on raw logits.
- **Layer-wise LR decay**: $\mathrm{lr}_k = \mathrm{base} \cdot \mathrm{decay}^{L - k}$

## Four families
type: concepts
from: phases/04-computer-vision/03-cnns-lenet-to-resnet/docs/en.md

- **LeNet-5 (1998)**: conv, avg pool, dense, tanh. 60,000 parameters.
- **AlexNet (2012)**: ReLU, dropout, 5 conv and 3 dense layers. 60M parameters.
- **VGG (2014)**: only 3x3 convs, 16 or 19 layers. 138M parameters.
- **Inception (2014)**: 1x1, 3x3, 5x5 and pool in parallel, then concatenate.
- **ResNet (2015)**: identity skip connections. 100+ layers train.
- **BasicBlock**: two 3x3 convs with a skip. ResNet-18 and ResNet-34.
- **Bottleneck**: 1x1 down, 3x3, 1x1 up. ResNet-50, -101, -152.
- **ResNet-18 or VGG-16**: 11.7M or 138M parameters. Top-1 69.8% or 71.6%.

## TinyResNet for 32x32 input
type: architecture
from: phases/04-computer-vision/03-cnns-lenet-to-resnet/docs/en.md, phases/04-computer-vision/03-cnns-lenet-to-resnet/code/main.py

```arch
node | in | 1,1 | Input | (1, 3, 32, 32)
node | stem | 2,1 | stem | 3x3 conv, 32 ch, BN, ReLU
node | l1 | 3,1 | layer1 | 2 BasicBlocks, 32 ch
node | l2 | 4,1 | layer2 | stride 2, 64 ch
node | l3 | 4,2 | layer3 | stride 2, 128 ch
node | l4 | 3,2 | layer4 | stride 2, 256 ch
node | head | 2,2 | head | AdaptiveAvgPool2d, Linear
node | out | 1,2 | Logits | 10 classes
edge | in | stem |
edge | stem | l1 |
edge | l1 | l2 |
edge | l2 | l3 |
edge | l3 | l4 |
edge | l4 | head |
edge | head | out |
```

## ResNet BasicBlock
type: annotated-code
lang: python
from: phases/04-computer-vision/03-cnns-lenet-to-resnet/docs/en.md, phases/04-computer-vision/03-cnns-lenet-to-resnet/code/main.py

```python
self.conv1 = nn.Conv2d(in_c, out_c, kernel_size=3, stride=stride, padding=1, bias=False)  # BN beta holds the bias
self.conv2 = nn.Conv2d(out_c, out_c, kernel_size=3, stride=1, padding=1, bias=False)
if stride != 1 or in_c != out_c:
    self.shortcut = nn.Sequential(
        nn.Conv2d(in_c, out_c, kernel_size=1, stride=stride, bias=False),
        nn.BatchNorm2d(out_c))               # 1x1 conv matches the shape
else:
    self.shortcut = nn.Identity()            # no-op skip
out = F.relu(self.bn1(self.conv1(x)))
out = self.bn2(self.conv2(out))              # no ReLU before the add
out = out + self.shortcut(x)                 # F(x) + x
return F.relu(out)
```

## Tasks in code
type: task-table
from: phases/04-computer-vision/02-convolutions-from-scratch/code/main.py, phases/04-computer-vision/04-image-classification/code/main.py, phases/04-computer-vision/05-transfer-learning/code/main.py

| Task | Code |
|---|---|
| Output size of one conv | `output_size(h_in, k, p, s)` |
| Receptive field of a stack | `receptive_field(layers)` |
| Conv as one matmul | `conv2d_im2col(x, w, b, padding=1)` |
| Apply a hand kernel | `apply_kernel(x[0], KERNELS["sobel_x"])` |
| Mix a batch | `mixup_batch(x, y, num_classes, alpha=0.2)` |
| Loss on soft labels | `soft_cross_entropy(logits, soft_targets)` |
| Frozen backbone, new head | `make_feature_extractor(num_classes=10)` |
| Keep BN running stats | `freeze_bn_stats(model)` |

## One training epoch
type: flow
from: phases/04-computer-vision/04-image-classification/docs/en.md

1. **Augment**: `random_hflip()` and `random_crop(pad=4)` with reflect pad. Train set only.
2. **Normalise**: `standardize(mean, std)` with the mean and std of your train set.
3. **DataLoader**: `shuffle=True` for train. `shuffle=False` for val.
4. **Model**: `model.train()` first. The model gives raw logits (N, C).
5. **Loss**: `soft_cross_entropy` with mixup, else `cross_entropy` with `label_smoothing=0.1`.
6. **Step**: `optimizer.zero_grad()`, `loss.backward()`, `optimizer.step()`.
7. **Metrics**: add `loss.item()`, so no graph stays alive.
8. **Epoch end**: `scheduler.step()`. Then `model.eval()` and evaluate under `torch.no_grad`.

## Fine-tune with discriminative LR
type: annotated-code
lang: python
from: phases/04-computer-vision/05-transfer-learning/docs/en.md, phases/04-computer-vision/05-transfer-learning/code/main.py

```python
model = resnet18(weights=ResNet18_Weights.IMAGENET1K_V1)
model.fc = nn.Linear(model.fc.in_features, 10)   # new head
groups = discriminative_param_groups(model, base_lr=1e-3, decay=0.3)
optimizer = SGD(groups, momentum=0.9, weight_decay=1e-4, nesterov=True)
scheduler = CosineAnnealingLR(optimizer, T_max=epochs)
for epoch in range(epochs):
    model.train()
    if freeze_bn:
        freeze_bn_stats(model)                    # after model.train()
start, unfreeze = progressive_unfreeze_schedule(model)
start()                                           # only fc trains
unfreeze(epoch)                                   # layer4 first, then layer3
```

## Pick a transfer recipe
type: concepts
from: phases/04-computer-vision/05-transfer-learning/docs/en.md

- **< 1k images, close to ImageNet**: freeze the backbone. Train the head only.
- **1k-10k, close**: freeze the first 2-3 stages. Fine-tune the rest.
- **10k-100k, any domain**: fine-tune end-to-end with discriminative LR.
- **100k+, far domain**: fine-tune everything. Consider training from scratch.
- **BN, >= 5k examples**: keep BN in train mode. It updates its running statistics.
- **BN, small dataset**: freeze BN in eval mode. Keep the ImageNet statistics.
- **Tiny batch per GPU**: replace BN with GroupNorm.
- **Head to replace**: `backbone.fc` (ResNet), `backbone.classifier[1]` (EfficientNet, MobileNet).

## Training defaults
type: defaults
span: 1
from: phases/04-computer-vision/04-image-classification/docs/en.md, phases/04-computer-vision/05-transfer-learning/docs/en.md

| Setting | Default | Note |
|---|---|---|
| SGD `lr` | 0.1 | TinyResNet from scratch, cosine over 10 epochs |
| `momentum` | 0.9 | With `nesterov=True` |
| `weight_decay` | 5e-4 | Fine-tune uses 1e-4 |
| `label_smoothing` | 0.1 | Target 1-eps for the true class |
| Mixup `alpha` | 0.2 | lambda from Beta(a, a) |
| `base_lr` | 1e-3 | The fc group. Earlier stages get less |
| `decay` | 0.3 | conv1 gets about 0.00243 times `base_lr` |
| `batch_size` | 128 | Val loader uses 256 |

## Troubleshooting
type: troubleshooting
from: phases/04-computer-vision/03-cnns-lenet-to-resnet/docs/en.md, phases/04-computer-vision/04-image-classification/docs/en.md, phases/04-computer-vision/05-transfer-learning/docs/en.md

| Symptom | Cause | Fix |
|---|---|---|
| Wrong gradient, flat curve | Softmax before the loss | Pass raw logits to `CrossEntropyLoss` |
| Looks like an unstable LR | Gradients accumulate | Call `optimizer.zero_grad()` each step |
| About 1% accuracy lost | ImageNet mean and std on CIFAR-10 | Compute stats on your train set |
| A "6" becomes a "9" | Augment changes the label | Use smaller rotation ranges |
| Fine-tuned below pretrained-only | LR or BN bug | Use discriminative LR, check BN mode |
| 5-15% accuracy lost silently | BN stats from another distribution | Freeze BN stats or use GroupNorm |
| All images get one class | LR destroys pretrained features | Lower the backbone LR |
| Deep plain net trains worse | Degradation past ~20 layers | Add residual connections |

## Questions
type: qa
from: phases/04-computer-vision/02-convolutions-from-scratch/docs/en.md, phases/04-computer-vision/03-cnns-lenet-to-resnet/docs/en.md, phases/04-computer-vision/04-image-classification/docs/en.md, phases/04-computer-vision/05-transfer-learning/docs/en.md

- **Why 3x3 kernels?** It is the smallest odd kernel with a centre.
- **How to downsample without a pool?** Use a conv with `stride=2`. It halves H and W.
- **Why does mixup raise train loss?** The targets are soft. Test accuracy goes up.
- **Which two numbers for a transfer run?** Pretrained-only is the floor. Fine-tuned is the ceiling.
- **Why a smaller LR for early layers?** They hold generic edge and texture features.
- **When to rebuild the optimizer?** Each time the set of trainable parameters changes.

## Conv layer shapes
type: annotated-code
lang: python
from: phases/04-computer-vision/02-convolutions-from-scratch/docs/en.md

```python
conv = nn.Conv2d(in_channels=3, out_channels=64, kernel_size=3, stride=1, padding=1)
tuple(conv.weight.shape)                    # (C_out, C_in, K, K)
sum(p.numel() for p in conv.parameters())   # 64 * 3 * 3 * 3 + 64 = 1,792
y = conv(torch.randn(8, 3, 224, 224))       # padding=0 gives 222x222
```
