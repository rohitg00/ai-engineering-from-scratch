import math
import torch
import torch.nn as nn


class PointNet(nn.Module):
    def __init__(self, num_classes=10):
        super().__init__()
        self.mlp1 = nn.Sequential(
            nn.Conv1d(3, 64, 1), nn.BatchNorm1d(64), nn.ReLU(inplace=True),
            nn.Conv1d(64, 64, 1), nn.BatchNorm1d(64), nn.ReLU(inplace=True),
        )
        self.mlp2 = nn.Sequential(
            nn.Conv1d(64, 128, 1), nn.BatchNorm1d(128), nn.ReLU(inplace=True),
            nn.Conv1d(128, 1024, 1), nn.BatchNorm1d(1024), nn.ReLU(inplace=True),
        )
        self.head = nn.Sequential(
            nn.Linear(1024, 512), nn.BatchNorm1d(512), nn.ReLU(inplace=True),
            nn.Dropout(0.3),
            nn.Linear(512, 256), nn.BatchNorm1d(256), nn.ReLU(inplace=True),
            nn.Dropout(0.3),
            nn.Linear(256, num_classes),
        )

    def forward(self, x):
        x = self.mlp1(x)
        x = self.mlp2(x)
        x = torch.max(x, dim=-1)[0]
        return self.head(x)


def positional_encoding(x, L=10):
    freqs = 2.0 ** torch.arange(L, dtype=x.dtype, device=x.device)
    args = x.unsqueeze(-1) * freqs * math.pi
    sinc = torch.cat([args.sin(), args.cos()], dim=-1)
    return sinc.reshape(*x.shape[:-1], -1)


class TinyNeRF(nn.Module):
    def __init__(self, L_pos=10, L_dir=4, hidden=128):
        super().__init__()
        self.L_pos = L_pos
        self.L_dir = L_dir
        pos_dim = 3 * 2 * L_pos
        dir_dim = 3 * 2 * L_dir
        self.trunk = nn.Sequential(
            nn.Linear(pos_dim, hidden), nn.ReLU(inplace=True),
            nn.Linear(hidden, hidden), nn.ReLU(inplace=True),
            nn.Linear(hidden, hidden), nn.ReLU(inplace=True),
            nn.Linear(hidden, hidden), nn.ReLU(inplace=True),
        )
        self.sigma = nn.Linear(hidden, 1)
        self.color = nn.Sequential(
            nn.Linear(hidden + dir_dim, hidden // 2), nn.ReLU(inplace=True),
            nn.Linear(hidden // 2, 3), nn.Sigmoid(),
        )

    def forward(self, x, d):
        x_enc = positional_encoding(x, self.L_pos)
        d_enc = positional_encoding(d, self.L_dir)
        h = self.trunk(x_enc)
        sigma = torch.relu(self.sigma(h)).squeeze(-1)
        rgb = self.color(torch.cat([h, d_enc], dim=-1))
        return sigma, rgb


def volumetric_render(sigma, rgb, t_vals):
    delta = torch.cat([t_vals[1:] - t_vals[:-1], torch.full_like(t_vals[:1], 1e10)])
    alpha = 1.0 - torch.exp(-sigma * delta)
    trans = torch.cumprod(
        torch.cat([torch.ones_like(alpha[..., :1]), 1.0 - alpha + 1e-10], dim=-1),
        dim=-1,
    )[..., :-1]
    weights = alpha * trans
    rendered = (weights.unsqueeze(-1) * rgb).sum(dim=-2)
    depth = (weights * t_vals).sum(dim=-1)
    return rendered, depth, weights


def permutation_invariance_check():
    pts = torch.randn(1, 3, 512)
    net = PointNet(num_classes=5).eval()
    idx = torch.randperm(512)
    shuffled = pts[:, :, idx]
    with torch.no_grad():
        out_a = net(pts)
        out_b = net(shuffled)
    return (out_a - out_b).abs().max().item()


def main():
    torch.manual_seed(0)

    print("[pointnet]")
    pts = torch.randn(4, 3, 1024)
    net = PointNet(num_classes=10)
    print(f"  output: {tuple(net(pts).shape)}  params: {sum(p.numel() for p in net.parameters()):,}")
    print(f"  permutation invariance  max|diff|={permutation_invariance_check():.2e}")

    print("\n[positional encoding]")
    x = torch.randn(5, 3)
    y = positional_encoding(x, L=10)
    print(f"  input  {tuple(x.shape)} -> encoded {tuple(y.shape)}")

    print("\n[tiny nerf forward]")
    nerf = TinyNeRF()
    x = torch.randn(128, 3)
    d = torch.randn(128, 3)
    sigma, rgb = nerf(x, d)
    print(f"  sigma: {tuple(sigma.shape)}   rgb: {tuple(rgb.shape)}")

    print("\n[volumetric render]")
    t_vals = torch.linspace(2.0, 6.0, 64)
    sigma_ray = torch.rand(64) * 0.5
    rgb_ray = torch.rand(64, 3)
    rendered, depth, weights = volumetric_render(sigma_ray, rgb_ray, t_vals)
    print(f"  rendered colour:   {rendered.tolist()}")
    print(f"  depth:             {depth.item():.2f}")
    print(f"  weights sum:       {weights.sum().item():.3f}")


if __name__ == "__main__":
    main()
