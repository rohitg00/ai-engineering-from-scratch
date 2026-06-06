import numpy as np
import torch
import torch.nn as nn
import torch.nn.functional as F
from torch.utils.data import DataLoader, TensorDataset
from torch.nn.utils import spectral_norm


class Generator(nn.Module):
    def __init__(self, z_dim=64, img_channels=3, feat=32):
        super().__init__()
        self.net = nn.Sequential(
            nn.ConvTranspose2d(z_dim, feat * 4, 4, 1, 0, bias=False),
            nn.BatchNorm2d(feat * 4),
            nn.ReLU(inplace=True),
            nn.ConvTranspose2d(feat * 4, feat * 2, 4, 2, 1, bias=False),
            nn.BatchNorm2d(feat * 2),
            nn.ReLU(inplace=True),
            nn.ConvTranspose2d(feat * 2, feat, 4, 2, 1, bias=False),
            nn.BatchNorm2d(feat),
            nn.ReLU(inplace=True),
            nn.ConvTranspose2d(feat, img_channels, 4, 2, 1, bias=False),
            nn.Tanh(),
        )

    def forward(self, z):
        return self.net(z.view(z.size(0), -1, 1, 1))


class Discriminator(nn.Module):
    def __init__(self, img_channels=3, feat=32, use_sn=False):
        super().__init__()
        layers = []
        def conv(in_c, out_c, bn):
            c = nn.Conv2d(in_c, out_c, 4, 2, 1, bias=not bn)
            if use_sn:
                c = spectral_norm(c)
            layers.append(c)
            if bn and not use_sn:
                layers.append(nn.BatchNorm2d(out_c))
            layers.append(nn.LeakyReLU(0.2, inplace=True))

        conv(img_channels, feat, bn=False)
        conv(feat, feat * 2, bn=True)
        conv(feat * 2, feat * 4, bn=True)
        last = nn.Conv2d(feat * 4, 1, 4, 1, 0)
        layers.append(spectral_norm(last) if use_sn else last)
        self.net = nn.Sequential(*layers)

    def forward(self, x):
        return self.net(x).view(-1)


def train_step(G, D, real, z, opt_g, opt_d, device):
    real = real.to(device)

    opt_d.zero_grad()
    d_real = D(real)
    d_fake = D(G(z).detach())
    loss_d = (F.binary_cross_entropy_with_logits(d_real, torch.ones_like(d_real))
              + F.binary_cross_entropy_with_logits(d_fake, torch.zeros_like(d_fake)))
    loss_d.backward()
    opt_d.step()

    opt_g.zero_grad()
    d_fake = D(G(z))
    loss_g = F.binary_cross_entropy_with_logits(d_fake, torch.ones_like(d_fake))
    loss_g.backward()
    opt_g.step()

    return loss_d.item(), loss_g.item()


def synthetic_circles(num=800, size=32, seed=0):
    rng = np.random.default_rng(seed)
    imgs = np.full((num, 3, size, size), -1.0, dtype=np.float32)
    yy, xx = np.meshgrid(np.arange(size), np.arange(size), indexing="ij")
    for i in range(num):
        r = rng.uniform(6, 10)
        cx, cy = rng.uniform(r, size - r, size=2)
        mask = (xx - cx) ** 2 + (yy - cy) ** 2 < r ** 2
        color = rng.uniform(-0.3, 1.0, size=3)
        for c in range(3):
            imgs[i, c][mask] = color[c]
    return torch.from_numpy(imgs)


@torch.no_grad()
def sample(G, n=8, z_dim=64, device="cpu"):
    G.eval()
    z = torch.randn(n, z_dim, device=device)
    out = G(z)
    G.train()
    return ((out + 1) / 2).clamp(0, 1)


def main():
    torch.manual_seed(0)
    device = "cuda" if torch.cuda.is_available() else "cpu"
    z_dim = 64

    data = synthetic_circles(num=400)
    loader = DataLoader(TensorDataset(data), batch_size=32, shuffle=True)

    G = Generator(z_dim=z_dim, img_channels=3, feat=32).to(device)
    D = Discriminator(img_channels=3, feat=32, use_sn=True).to(device)
    opt_g = torch.optim.Adam(G.parameters(), lr=2e-4, betas=(0.5, 0.999))
    opt_d = torch.optim.Adam(D.parameters(), lr=2e-4, betas=(0.5, 0.999))

    print(f"G params: {sum(p.numel() for p in G.parameters()):,}")
    print(f"D params: {sum(p.numel() for p in D.parameters()):,}")

    for epoch in range(5):
        ld_sum, lg_sum, n = 0.0, 0.0, 0
        for (batch,) in loader:
            z = torch.randn(batch.size(0), z_dim, device=device)
            ld, lg = train_step(G, D, batch, z, opt_g, opt_d, device)
            ld_sum += ld
            lg_sum += lg
            n += 1
        print(f"epoch {epoch}  D {ld_sum/n:.3f}  G {lg_sum/n:.3f}")

    samples = sample(G, n=8, z_dim=z_dim, device=device)
    print(f"generated shape: {tuple(samples.shape)}  range [{samples.min():.2f}, {samples.max():.2f}]")


if __name__ == "__main__":
    main()
