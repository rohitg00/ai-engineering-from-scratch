import numpy as np
import torch
import torch.nn as nn
import torch.nn.functional as F
from torch.utils.data import Dataset, DataLoader
from torch.optim import SGD
from torch.optim.lr_scheduler import CosineAnnealingLR
from torchvision.models import resnet18, ResNet18_Weights


def synthetic_dataset(num_per_class=100, num_classes=10, size=224, seed=0):
    rng = np.random.default_rng(seed)
    X = np.empty((num_per_class * num_classes, size, size, 3), dtype=np.float32)
    Y = np.empty(num_per_class * num_classes, dtype=np.int64)
    k = 0
    for c in range(num_classes):
        centre = rng.uniform(0, 1, (3,))
        freq = 2 + c
        for _ in range(num_per_class):
            yy, xx = np.meshgrid(np.linspace(0, 1, size), np.linspace(0, 1, size), indexing="ij")
            r = np.sin(xx * freq) * 0.5 + centre[0]
            g = np.cos(yy * freq) * 0.5 + centre[1]
            b = (xx + yy) * 0.5 * centre[2]
            img = np.stack([r, g, b], axis=-1) + rng.normal(0, 0.05, (size, size, 3))
            X[k] = np.clip(img, 0, 1).astype(np.float32)
            Y[k] = c
            k += 1
    idx = rng.permutation(len(X))
    return X[idx], Y[idx]


class ArrayDataset(Dataset):
    def __init__(self, X, Y):
        self.X = X
        self.Y = Y
        self.mean = np.array([0.485, 0.456, 0.406], dtype=np.float32)
        self.std = np.array([0.229, 0.224, 0.225], dtype=np.float32)

    def __len__(self):
        return len(self.X)

    def __getitem__(self, i):
        img = (self.X[i] - self.mean) / self.std
        return torch.from_numpy(img).permute(2, 0, 1).float(), int(self.Y[i])


def make_feature_extractor(num_classes=10):
    model = resnet18(weights=ResNet18_Weights.IMAGENET1K_V1)
    for p in model.parameters():
        p.requires_grad = False
    model.fc = nn.Linear(model.fc.in_features, num_classes)
    return model


def make_fine_tune(num_classes=10):
    model = resnet18(weights=ResNet18_Weights.IMAGENET1K_V1)
    model.fc = nn.Linear(model.fc.in_features, num_classes)
    for p in model.parameters():
        p.requires_grad = True
    return model


def discriminative_param_groups(model, base_lr=1e-3, decay=0.3):
    stages = [
        ["conv1", "bn1"],
        ["layer1"],
        ["layer2"],
        ["layer3"],
        ["layer4"],
        ["fc"],
    ]
    groups = []
    for i, names in enumerate(stages):
        lr = base_lr * (decay ** (len(stages) - 1 - i))
        params = [p for n, p in model.named_parameters()
                  if any(n.startswith(k) for k in names) and p.requires_grad]
        if params:
            groups.append({"params": params, "lr": lr, "name": "_".join(names)})
    return groups


def freeze_bn_stats(model):
    for m in model.modules():
        if isinstance(m, (nn.BatchNorm1d, nn.BatchNorm2d, nn.BatchNorm3d)):
            m.eval()
            for p in m.parameters():
                p.requires_grad = False
    return model


def train_and_eval(model, train_loader, val_loader, device, epochs=2, base_lr=1e-3, freeze_bn=False):
    model = model.to(device)
    groups = discriminative_param_groups(model, base_lr=base_lr)
    if not groups:
        groups = [{"params": [p for p in model.parameters() if p.requires_grad], "lr": base_lr}]
    optimizer = SGD(groups, momentum=0.9, weight_decay=1e-4, nesterov=True)
    scheduler = CosineAnnealingLR(optimizer, T_max=max(epochs, 1))

    last_val = 0.0
    for epoch in range(epochs):
        model.train()
        if freeze_bn:
            freeze_bn_stats(model)
        tr_loss, tr_correct, tr_total = 0.0, 0, 0
        for x, y in train_loader:
            x, y = x.to(device), y.to(device)
            logits = model(x)
            loss = F.cross_entropy(logits, y, label_smoothing=0.1)
            optimizer.zero_grad()
            loss.backward()
            optimizer.step()
            tr_loss += loss.item() * x.size(0)
            tr_total += x.size(0)
            tr_correct += (logits.argmax(-1) == y).sum().item()
        scheduler.step()

        model.eval()
        va_total, va_correct = 0, 0
        with torch.no_grad():
            for x, y in val_loader:
                x, y = x.to(device), y.to(device)
                pred = model(x).argmax(-1)
                va_total += x.size(0)
                va_correct += (pred == y).sum().item()
        last_val = va_correct / va_total
        print(f"  epoch {epoch}  train {tr_loss/tr_total:.3f}/{tr_correct/tr_total:.3f}  "
              f"val {last_val:.3f}")
    return last_val


def trainable_param_count(model):
    return sum(p.numel() for p in model.parameters() if p.requires_grad)


def main():
    torch.manual_seed(0)
    X, Y = synthetic_dataset(num_per_class=40, size=96)
    split = int(0.9 * len(X))
    train_ds = ArrayDataset(X[:split], Y[:split])
    val_ds = ArrayDataset(X[split:], Y[split:])
    train_loader = DataLoader(train_ds, batch_size=16, shuffle=True, num_workers=0)
    val_loader = DataLoader(val_ds, batch_size=32, shuffle=False, num_workers=0)

    device = "cuda" if torch.cuda.is_available() else "cpu"
    print(f"device: {device}")

    print("\n[feature extraction] freeze backbone, train head only")
    fe = make_feature_extractor()
    print(f"  trainable params: {trainable_param_count(fe):,}")
    acc_fe = train_and_eval(fe, train_loader, val_loader, device, epochs=2, base_lr=3e-2)

    print("\n[fine-tune] discriminative LR across stages")
    ft = make_fine_tune()
    for g in discriminative_param_groups(ft, base_lr=1e-3):
        print(f"  group {g['name']:>10s}  lr={g['lr']:.2e}")
    acc_ft = train_and_eval(ft, train_loader, val_loader, device, epochs=2, base_lr=1e-3)

    print(f"\nsummary  feature-extract val={acc_fe:.3f}   fine-tune val={acc_ft:.3f}")


if __name__ == "__main__":
    main()
