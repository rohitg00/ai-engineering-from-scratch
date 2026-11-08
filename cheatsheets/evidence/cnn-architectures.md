# Evidence: cheatsheets/cnn-architectures.md

Abbreviations: P04 = phases/04-computer-vision. L02 = P04/02-convolutions-from-scratch, L03 = P04/03-cnns-lenet-to-resnet, L04 = P04/04-image-classification, L05 = P04/05-transfer-learning. d = docs/en.md, c = code/main.py.

## Formulas (concepts, 8)
- Output size floor((H - K + 2P) / S) + 1: L02/d:75-79
- Same padding P = (K - 1) / 2 for odd K, S = 1: L02/d:91
- Conv parameters C_out * C_in * K * K + C_out, + C_out is biases: L02/d:146-149
- Receptive field 1 + L * (K - 1), stride 1: L02/d:176
- Two 3x3 see 5x5, 18C^2 vs 25C^2: L03/d:75
- Residual y = F(x) + x, identity by F(x) = 0: L03/d:123-130
- Cross-entropy -z_y + log sum exp(z_j), raw logits: L04/d:61-68
- Layer-wise LR decay base_lr * decay^(L - k): L05/d:101-105

## Four families (concepts, 8)
- LeNet-5 1998, conv + pool + FC, tanh, 60,000 parameters: L03/d:30, 40
- AlexNet 2012, ReLU, dropout, five conv, three dense, 60M parameters: L03/d:58-62
- VGG 2014, only 3x3, 16 or 19 conv layers, 138M: L03/d:68-77
- Inception 2014, 1x1, 3x3, 5x5, 3x3 max pool, concatenate: L03/d:81-100
- ResNet 2015, identity skip, 100+ layers: L03/d:33, 119-130
- BasicBlock two 3x3 convs, ResNet-18/34: L03/d:147
- Bottleneck 1x1 down, 3x3, 1x1 up, ResNet-50/101/152: L03/d:148
- ResNet-18 11.7M vs VGG-16 138M, top-1 69.8% vs 71.6%: L03/d:352

## TinyResNet for 32x32 input (architecture, 8 nodes)
- Input (1, 3, 32, 32): L03/d:308
- stem 3x3 conv 32 channels, BN, ReLU: L03/d:278-282, L03/c:83
- layer1 2 BasicBlocks, 32 channels: L03/d:283, L03/c:88
- layer2 stride 2, 64: L03/d:284, L03/c:89
- layer3 stride 2, 128: L03/d:285, L03/c:90
- layer4 stride 2, 256: L03/d:286, L03/c:91
- head AdaptiveAvgPool2d, Linear: L03/d:287-291, L03/c:93-95
- Logits, 10 classes (num_classes=10): L03/d:276

## ResNet BasicBlock (annotated-code, 12 lines)
- conv1 3x3 stride=stride padding=1 bias=False: L03/d:249, L03/c:61
- bias=False because BN beta holds the bias: L03/d:268
- conv2 3x3 stride=1: L03/d:251, L03/c:63
- shortcut condition stride != 1 or in_c != out_c, 1x1 conv + BatchNorm2d: L03/d:253-257, L03/c:66
- else nn.Identity, no-op: L03/d:258-259, 268, L03/c:71
- forward relu(bn1(conv1)), bn2(conv2) with no ReLU, add shortcut, relu: L03/d:261-265, L03/c:74-77

## Tasks in code (task-table, 8)
- output_size(h_in, k, p, s): L02/c:13
- receptive_field(layers): L02/c:67
- conv2d_im2col(x, w, b, padding=1): L02/c:57, L02/d:313
- apply_kernel(x[0], KERNELS["sobel_x"]): L02/c:114
- mixup_batch(x, y, num_classes, alpha=0.2): L04/c:83
- soft_cross_entropy(logits, soft_targets): L04/c:94
- make_feature_extractor(num_classes=10): L05/c:47
- freeze_bn_stats(model): L05/c:82

## One training epoch (flow, 8 steps)
1. random_hflip, random_crop(pad=4), reflect pad, inputs only: L04/d:185-200, 211, 320
2. standardize(mean, std), dataset-specific stats: L04/d:177, 320, 394
3. shuffle=True train, shuffle=False val: L04/d:326-327
4. model.train() first, logits (N, C): L04/d:35, 294
5. soft_cross_entropy with mixup, else cross_entropy label_smoothing=0.1: L04/d:252-258
6. optimizer.zero_grad(), loss.backward(), optimizer.step(): L04/d:259-261, 295
7. loss.item() so no graph stays alive: L04/d:262, 296
8. scheduler.step() once per epoch, model.eval(), torch.no_grad: L04/d:238, 273-275, 294, 297, 337

## Fine-tune with discriminative LR (annotated-code, 11 lines)
- resnet18(weights=ResNet18_Weights.IMAGENET1K_V1): L05/d:182, L05/c:56
- model.fc = nn.Linear(model.fc.in_features, 10): L05/d:183
- discriminative_param_groups(model, base_lr=1e-3, decay=0.3): L05/d:164, L05/c:63
- SGD(groups, momentum=0.9, weight_decay=1e-4, nesterov=True): L05/d:221, L05/c:96
- CosineAnnealingLR(optimizer, T_max=epochs): L05/d:222
- model.train() then freeze_bn_stats(model) if freeze_bn: L05/d:208, 224-227, L05/c:103
- progressive_unfreeze_schedule, start() only fc, unfreeze(epoch) layer4 first: L05/d:261-284

## Pick a transfer recipe (concepts, 8)
- < 1k close, freeze backbone, head only: L05/d:50
- 1k-10k close, freeze first 2-3 stages: L05/d:51
- 10k-100k any, end-to-end discriminative LR: L05/d:52
- 100k+ far, fine-tune everything, consider scratch: L05/d:53
- BN train mode for >= 5k examples: L05/d:81
- Freeze BN in eval mode for small data: L05/d:82
- Replace BN with GroupNorm for tiny batch per GPU: L05/d:83
- backbone.fc ResNet, backbone.classifier[1] EfficientNet/MobileNet: L05/d:92-93

## Training defaults (defaults, 8)
- SGD lr 0.1, CosineAnnealingLR T_max=10, 10 epochs: L04/d:331-334
- momentum 0.9, nesterov=True: L04/d:331
- weight_decay 5e-4, fine-tune 1e-4: L04/d:331, L05/d:221
- label_smoothing 0.1: L04/d:103, 258
- mixup alpha 0.2, lambda ~ Beta(a, a): L04/d:90, 218
- base_lr 1e-3, fc gets base_lr: L05/d:164, 192
- decay 0.3, conv1 about 0.00243 * base_lr: L05/d:192
- batch_size 128, val 256: L04/d:326-327

## Troubleshooting (troubleshooting, 8)
- softmax before loss gives wrong gradient, pass raw logits: L04/d:49, 68
- missing zero_grad accumulates, looks like unstable LR: L04/d:49
- ImageNet stats on CIFAR-10, ~1% accuracy leak: L04/d:394
- rotation turns 6 into 9, smaller rotation ranges: L04/d:82
- fine-tuned below pretrained-only means LR or BN bug: L05/d:116
- BN stats drift tanks accuracy 5-15%, freeze BN or GroupNorm: L05/d:79-85
- everything predicts one class, LR destroys features: L05/d:327, 324
- degradation past ~20 plain layers, residual connections: L03/d:104, 385

## Questions (qa, 6)
- 3x3 is the smallest odd kernel with a centre: L02/d:91
- stride=2 halves dimensions, downsample without pooling: L02/d:113
- mixup raises train loss, test accuracy goes up: L04/d:99
- pretrained-only floor, fine-tuned ceiling: L05/d:111-114
- early layers hold generic features, smaller LR: L05/d:63
- rebuild optimizer when trainable set changes: L05/d:284

## Conv layer shapes (annotated-code, 4 lines)
- nn.Conv2d(in_channels=3, out_channels=64, kernel_size=3, stride=1, padding=1): L02/d:349
- weight shape (C_out, C_in, K, K): L02/d:351
- 64 * 3 * 3 * 3 + 64 = 1,792: L02/d:149, 353
- torch.randn(8, 3, 224, 224), padding=0 gives 222x222: L02/d:355-361
