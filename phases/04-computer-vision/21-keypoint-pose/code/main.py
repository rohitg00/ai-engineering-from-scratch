import numpy as np
import torch
import torch.nn as nn
import torch.nn.functional as F


def gaussian_heatmap(size, cx, cy, sigma=2.0):
    yy, xx = np.meshgrid(np.arange(size), np.arange(size), indexing="ij")
    return np.exp(-((xx - cx) ** 2 + (yy - cy) ** 2) / (2 * sigma ** 2)).astype(np.float32)


class TinyKeypointNet(nn.Module):
    def __init__(self, num_keypoints=4, base=16):
        super().__init__()
        self.down1 = nn.Sequential(nn.Conv2d(3, base, 3, 2, 1), nn.ReLU(inplace=True))
        self.down2 = nn.Sequential(nn.Conv2d(base, base * 2, 3, 2, 1), nn.ReLU(inplace=True))
        self.mid = nn.Sequential(nn.Conv2d(base * 2, base * 2, 3, 1, 1), nn.ReLU(inplace=True))
        self.up1 = nn.ConvTranspose2d(base * 2, base, 2, 2)
        self.up2 = nn.ConvTranspose2d(base, num_keypoints, 2, 2)

    def forward(self, x):
        h1 = self.down1(x)
        h2 = self.down2(h1)
        h3 = self.mid(h2)
        u1 = self.up1(h3)
        return self.up2(u1)


def heatmap_to_coords(heatmaps):
    N, K, H, W = heatmaps.shape
    hm = heatmaps.reshape(N, K, -1)
    idx = hm.argmax(dim=-1)
    ys = (idx // W).float()
    xs = (idx % W).float()
    return torch.stack([xs, ys], dim=-1)


def subpixel_refine(heatmaps):
    N, K, H, W = heatmaps.shape
    coords = heatmap_to_coords(heatmaps)
    refined = coords.clone()
    for n in range(N):
        for k in range(K):
            x, y = int(coords[n, k, 0]), int(coords[n, k, 1])
            if 0 < x < W - 1 and 0 < y < H - 1:
                hm = heatmaps[n, k]
                dx = 0.25 * (hm[y, x + 1] - hm[y, x - 1])
                dy = 0.25 * (hm[y + 1, x] - hm[y - 1, x])
                refined[n, k, 0] = x + dx
                refined[n, k, 1] = y + dy
    return refined


def make_synthetic_sample(size=64, rng=None):
    rng = rng or np.random.default_rng()
    img = np.ones((3, size, size), dtype=np.float32)
    kps = rng.integers(10, size - 10, size=(4, 2))
    for cx, cy in kps:
        img[:, cy - 2:cy + 2, cx - 2:cx + 2] = 0.0
    hms = np.stack([gaussian_heatmap(size, cx, cy) for cx, cy in kps])
    return img, hms, kps.astype(np.float32)


def main():
    torch.manual_seed(0)
    rng = np.random.default_rng(0)

    model = TinyKeypointNet(num_keypoints=4)
    opt = torch.optim.Adam(model.parameters(), lr=3e-3)

    for step in range(200):
        batch = [make_synthetic_sample(rng=rng) for _ in range(16)]
        imgs = torch.from_numpy(np.stack([b[0] for b in batch]))
        hms = torch.from_numpy(np.stack([b[1] for b in batch]))
        pred = model(imgs)
        pred = F.interpolate(pred, size=hms.shape[-2:], mode="bilinear", align_corners=False)
        loss = F.mse_loss(pred, hms)
        opt.zero_grad(); loss.backward(); opt.step()
        if step % 40 == 0:
            print(f"step {step:3d}  mse {loss.item():.4f}")

    model.eval()
    with torch.no_grad():
        eval_batch = [make_synthetic_sample(rng=rng) for _ in range(8)]
        imgs = torch.from_numpy(np.stack([b[0] for b in eval_batch]))
        gt = torch.from_numpy(np.stack([b[2] for b in eval_batch]))
        pred = model(imgs)
        pred = F.interpolate(pred, size=(64, 64), mode="bilinear", align_corners=False)
        coords = heatmap_to_coords(pred)
        refined = subpixel_refine(pred)
        l2_int = (coords - gt).norm(dim=-1).mean().item()
        l2_sub = (refined - gt).norm(dim=-1).mean().item()
        print(f"\nmean L2 error (argmax):    {l2_int:.3f} px")
        print(f"mean L2 error (subpixel):  {l2_sub:.3f} px")


if __name__ == "__main__":
    main()
