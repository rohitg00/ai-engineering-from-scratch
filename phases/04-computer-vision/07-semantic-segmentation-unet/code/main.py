# Lesson implementation for phases/04-computer-vision/07-semantic-segmentation-unet/docs/en.md.
# Builds a compact U-Net, combined cross-entropy/Dice loss, and per-class IoU.
# Reference: U-Net (Ronneberger et al., 2015), https://arxiv.org/abs/1505.04597.
# The seeded synthetic dataset keeps the training demonstration self-contained.

import numpy as np
import torch
import torch.nn as nn
import torch.nn.functional as F
from torch.utils.data import Dataset, DataLoader
from torch.optim import Adam


class DoubleConv(nn.Module):
    def __init__(self, in_c, out_c):
        super().__init__()
        self.net = nn.Sequential(
            nn.Conv2d(in_c, out_c, 3, padding=1, bias=False),
            nn.BatchNorm2d(out_c),
            nn.ReLU(inplace=True),
            nn.Conv2d(out_c, out_c, 3, padding=1, bias=False),
            nn.BatchNorm2d(out_c),
            nn.ReLU(inplace=True),
        )

    def forward(self, x):
        return self.net(x)


class Down(nn.Module):
    def __init__(self, in_c, out_c):
        super().__init__()
        self.net = nn.Sequential(nn.MaxPool2d(2), DoubleConv(in_c, out_c))

    def forward(self, x):
        return self.net(x)


class Up(nn.Module):
    def __init__(self, in_c, out_c):
        super().__init__()
        self.up = nn.Upsample(scale_factor=2, mode="bilinear", align_corners=False)
        self.conv = DoubleConv(in_c, out_c)

    def forward(self, x, skip):
        x = self.up(x)
        if x.shape[-2:] != skip.shape[-2:]:
            x = F.interpolate(x, size=skip.shape[-2:], mode="bilinear", align_corners=False)
        x = torch.cat([skip, x], dim=1)
        return self.conv(x)


class UNet(nn.Module):
    def __init__(self, in_channels=3, num_classes=3, base=32):
        super().__init__()
        self.inc = DoubleConv(in_channels, base)
        self.d1 = Down(base, base * 2)
        self.d2 = Down(base * 2, base * 4)
        self.d3 = Down(base * 4, base * 8)
        self.d4 = Down(base * 8, base * 16)
        self.u1 = Up(base * 16 + base * 8, base * 8)
        self.u2 = Up(base * 8 + base * 4, base * 4)
        self.u3 = Up(base * 4 + base * 2, base * 2)
        self.u4 = Up(base * 2 + base, base)
        self.outc = nn.Conv2d(base, num_classes, 1)

    def forward(self, x):
        x1 = self.inc(x)
        x2 = self.d1(x1)
        x3 = self.d2(x2)
        x4 = self.d3(x3)
        x5 = self.d4(x4)
        x = self.u1(x5, x4)
        x = self.u2(x, x3)
        x = self.u3(x, x2)
        x = self.u4(x, x1)
        return self.outc(x)


def dice_loss(logits, targets, num_classes, eps=1e-6):
    probs = F.softmax(logits, dim=1)
    one_hot = F.one_hot(targets, num_classes).permute(0, 3, 1, 2).float()
    dims = (0, 2, 3)
    inter = (probs * one_hot).sum(dim=dims)
    denom = probs.sum(dim=dims) + one_hot.sum(dim=dims)
    dice = (2 * inter + eps) / (denom + eps)
    return 1 - dice.mean()


def combined_loss(logits, targets, num_classes, lam=1.0):
    ce = F.cross_entropy(logits, targets)
    dc = dice_loss(logits, targets, num_classes)
    return ce + lam * dc, {"ce": ce.detach().item(), "dice": dc.detach().item()}


@torch.no_grad()
def intersection_union_per_class(logits, targets, num_classes):
    preds = logits.argmax(dim=1)
    intersections = torch.zeros(num_classes, device=logits.device)
    unions = torch.zeros(num_classes, device=logits.device)
    for c in range(num_classes):
        pred_c = (preds == c)
        true_c = (targets == c)
        intersections[c] = (pred_c & true_c).sum()
        unions[c] = (pred_c | true_c).sum()
    return intersections, unions


def iou_from_counts(intersections, unions):
    ious = torch.full_like(intersections, float("nan"), dtype=torch.float32)
    present = unions > 0
    ious[present] = intersections[present].float() / unions[present].float()
    return ious


@torch.no_grad()
def iou_per_class(logits, targets, num_classes):
    intersections, unions = intersection_union_per_class(
        logits, targets, num_classes
    )
    return iou_from_counts(intersections, unions)


def synthetic_segmentation(num_samples=120, size=64, seed=0):
    if size < 16:
        raise ValueError("size must be at least 16 pixels")

    rng = np.random.default_rng(seed)
    images = np.zeros((num_samples, size, size, 3), dtype=np.float32)
    masks = np.zeros((num_samples, size, size), dtype=np.int64)
    yy, xx = np.meshgrid(np.arange(size), np.arange(size), indexing="ij")
    min_radius = max(3, size // 16)
    max_radius = max(min_radius + 1, size // 5)
    for i in range(num_samples):
        images[i] = rng.uniform(0.1, 0.9, size=3)
        num_shapes = int(rng.integers(1, 4))
        for _ in range(num_shapes):
            cls = int(rng.integers(1, 3))
            color = rng.uniform(0.05, 0.95, size=3)
            radius = int(rng.integers(min_radius, max_radius + 1))
            cx = int(rng.integers(radius, size - radius))
            cy = int(rng.integers(radius, size - radius))
            if cls == 1:
                mask = (xx - cx) ** 2 + (yy - cy) ** 2 < radius ** 2
            else:
                mask = (np.abs(xx - cx) < radius) & (np.abs(yy - cy) < radius)
            images[i][mask] = color
            masks[i][mask] = cls
        images[i] += rng.normal(0, 0.02, images[i].shape)
        images[i] = np.clip(images[i], 0, 1)
    return images, masks


class SegDataset(Dataset):
    def __init__(self, images, masks):
        self.images = images
        self.masks = masks

    def __len__(self):
        return len(self.images)

    def __getitem__(self, i):
        img = torch.from_numpy(self.images[i]).permute(2, 0, 1).float()
        mask = torch.from_numpy(self.masks[i]).long()
        return img, mask


def main():
    torch.manual_seed(0)
    images, masks = synthetic_segmentation(num_samples=60, size=64)
    split = int(0.85 * len(images))
    train_ds = SegDataset(images[:split], masks[:split])
    val_ds = SegDataset(images[split:], masks[split:])
    train_loader = DataLoader(train_ds, batch_size=8, shuffle=True)
    val_loader = DataLoader(val_ds, batch_size=8, shuffle=False)

    device = "cuda" if torch.cuda.is_available() else "cpu"
    num_classes = 3
    model = UNet(in_channels=3, num_classes=num_classes, base=16).to(device)
    optimizer = Adam(model.parameters(), lr=1e-3)
    print(f"params: {sum(p.numel() for p in model.parameters()):,}")

    for epoch in range(8):
        model.train()
        loss_sum, total = 0.0, 0
        for x, y in train_loader:
            x, y = x.to(device), y.to(device)
            logits = model(x)
            loss, _ = combined_loss(logits, y, num_classes)
            optimizer.zero_grad()
            loss.backward()
            optimizer.step()
            loss_sum += loss.detach().item() * x.size(0)
            total += x.size(0)

        model.eval()
        intersections = torch.zeros(num_classes, device=device)
        unions = torch.zeros(num_classes, device=device)
        with torch.no_grad():
            for x, y in val_loader:
                x, y = x.to(device), y.to(device)
                batch_intersections, batch_unions = intersection_union_per_class(
                    model(x), y, num_classes
                )
                intersections += batch_intersections
                unions += batch_unions
        iou_mean = iou_from_counts(intersections, unions).cpu().tolist()
        print(f"epoch {epoch}  train_loss {loss_sum/total:.3f}  iou {[f'{v:.2f}' for v in iou_mean]}")


if __name__ == "__main__":
    main()
