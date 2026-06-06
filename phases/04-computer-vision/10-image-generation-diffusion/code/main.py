import math
import numpy as np
import torch
import torch.nn as nn
import torch.nn.functional as F
from torch.utils.data import DataLoader, TensorDataset


def linear_beta_schedule(T=1000, beta_start=1e-4, beta_end=2e-2):
    return torch.linspace(beta_start, beta_end, T)


def precompute_schedule(betas):
    alphas = 1.0 - betas
    alphas_cumprod = torch.cumprod(alphas, dim=0)
    return {
        "betas": betas,
        "alphas": alphas,
        "alphas_cumprod": alphas_cumprod,
        "sqrt_alphas_cumprod": torch.sqrt(alphas_cumprod),
        "sqrt_one_minus_alphas_cumprod": torch.sqrt(1.0 - alphas_cumprod),
        "sqrt_recip_alphas": torch.sqrt(1.0 / alphas),
    }


def q_sample(x0, t, noise, schedule):
    sqrt_a = schedule["sqrt_alphas_cumprod"].to(x0.device)[t].view(-1, 1, 1, 1)
    sqrt_one_minus_a = schedule["sqrt_one_minus_alphas_cumprod"].to(x0.device)[t].view(-1, 1, 1, 1)
    return sqrt_a * x0 + sqrt_one_minus_a * noise


def timestep_embedding(t, dim=64):
    half = (dim + 1) // 2
    freqs = torch.exp(-math.log(10000) * torch.arange(half, device=t.device) / half)
    args = t[:, None].float() * freqs[None]
    emb = torch.cat([args.sin(), args.cos()], dim=-1)
    return emb[:, :dim]


class TinyUNet(nn.Module):
    def __init__(self, img_channels=3, base=16, t_dim=64):
        super().__init__()
        self.t_mlp = nn.Sequential(
            nn.Linear(t_dim, base * 4),
            nn.SiLU(),
            nn.Linear(base * 4, base * 4),
        )
        self.t_dim = t_dim
        self.enc1 = nn.Conv2d(img_channels, base, 3, padding=1)
        self.enc2 = nn.Conv2d(base, base * 2, 4, stride=2, padding=1)
        self.mid = nn.Conv2d(base * 2, base * 2, 3, padding=1)
        self.dec1 = nn.ConvTranspose2d(base * 2, base, 4, stride=2, padding=1)
        self.dec2 = nn.Conv2d(base * 2, img_channels, 3, padding=1)
        self.time_proj = nn.Linear(base * 4, base * 2)

    def forward(self, x, t):
        t_emb = self.t_mlp(timestep_embedding(t, self.t_dim))
        t_proj = self.time_proj(t_emb)[:, :, None, None]
        h1 = F.silu(self.enc1(x))
        h2 = F.silu(self.enc2(h1)) + t_proj
        h3 = F.silu(self.mid(h2))
        d1 = F.silu(self.dec1(h3))
        d2 = torch.cat([d1, h1], dim=1)
        return self.dec2(d2)


def train_step(model, x0, schedule, optimizer, device, T=1000):
    model.train()
    x0 = x0.to(device)
    bs = x0.size(0)
    t = torch.randint(0, T, (bs,), device=device)
    noise = torch.randn_like(x0)
    x_t = q_sample(x0, t, noise, schedule)
    pred = model(x_t, t)
    loss = F.mse_loss(pred, noise)
    optimizer.zero_grad()
    loss.backward()
    optimizer.step()
    return loss.item()


@torch.no_grad()
def sample_ddpm(model, schedule, shape, T=1000, device="cpu"):
    model.eval()
    x = torch.randn(shape, device=device)
    betas = schedule["betas"].to(device)
    sqrt_one_minus_a = schedule["sqrt_one_minus_alphas_cumprod"].to(device)
    sqrt_recip_alphas = schedule["sqrt_recip_alphas"].to(device)

    for t in reversed(range(T)):
        t_batch = torch.full((shape[0],), t, dtype=torch.long, device=device)
        eps = model(x, t_batch)
        coef = betas[t] / sqrt_one_minus_a[t]
        mean = sqrt_recip_alphas[t] * (x - coef * eps)
        if t > 0:
            x = mean + torch.sqrt(betas[t]) * torch.randn_like(x)
        else:
            x = mean
    return x


@torch.no_grad()
def sample_ddim(model, schedule, shape, steps=50, T=1000, device="cpu", eta=0.0):
    model.eval()
    x = torch.randn(shape, device=device)
    alphas_cumprod = schedule["alphas_cumprod"].to(device)

    ts = torch.linspace(T - 1, 0, steps + 1).long()
    for i in range(steps):
        t = int(ts[i])
        t_prev = int(ts[i + 1])
        t_batch = torch.full((shape[0],), t, dtype=torch.long, device=device)
        eps = model(x, t_batch)
        a_t = alphas_cumprod[t]
        a_prev = alphas_cumprod[t_prev]
        x0_pred = (x - torch.sqrt(1 - a_t) * eps) / torch.sqrt(a_t)
        sigma = eta * torch.sqrt((1 - a_prev) / (1 - a_t) * (1 - a_t / a_prev).clamp_min(0))
        dir_xt = torch.sqrt((1 - a_prev - sigma ** 2).clamp_min(0)) * eps
        noise = sigma * torch.randn_like(x) if eta > 0 else 0
        x = torch.sqrt(a_prev) * x0_pred + dir_xt + noise
    return x


def synthetic_circles(num=200, size=16, seed=0):
    rng = np.random.default_rng(seed)
    imgs = np.full((num, 3, size, size), -1.0, dtype=np.float32)
    yy, xx = np.meshgrid(np.arange(size), np.arange(size), indexing="ij")
    for i in range(num):
        r = rng.uniform(3, 5)
        cx, cy = rng.uniform(r, size - r, size=2)
        mask = (xx - cx) ** 2 + (yy - cy) ** 2 < r ** 2
        color = rng.uniform(-0.3, 1.0, size=3)
        for c in range(3):
            imgs[i, c][mask] = color[c]
    return torch.from_numpy(imgs)


def main():
    torch.manual_seed(0)
    device = "cuda" if torch.cuda.is_available() else "cpu"
    T = 200

    schedule = precompute_schedule(linear_beta_schedule(T=T, beta_start=1e-4, beta_end=0.04))
    print(f"schedule: T={T}  alpha_bar[0]={float(schedule['alphas_cumprod'][0]):.4f}  "
          f"alpha_bar[-1]={float(schedule['alphas_cumprod'][-1]):.4f}")

    data = synthetic_circles(num=100, size=16)
    loader = DataLoader(TensorDataset(data), batch_size=16, shuffle=True)

    model = TinyUNet(img_channels=3, base=16).to(device)
    opt = torch.optim.Adam(model.parameters(), lr=1e-3)
    print(f"params: {sum(p.numel() for p in model.parameters()):,}")

    for epoch in range(3):
        losses = []
        for (batch,) in loader:
            losses.append(train_step(model, batch, schedule, opt, device, T=T))
        print(f"epoch {epoch}  mse {np.mean(losses):.4f}")

    s_ddpm = sample_ddpm(model, schedule, shape=(2, 3, 16, 16), T=T, device=device)
    s_ddim = sample_ddim(model, schedule, shape=(2, 3, 16, 16), steps=20, T=T, device=device)
    print(f"\nsampled DDPM: {tuple(s_ddpm.shape)}  range [{s_ddpm.min():.2f}, {s_ddpm.max():.2f}]")
    print(f"sampled DDIM: {tuple(s_ddim.shape)}  range [{s_ddim.min():.2f}, {s_ddim.max():.2f}]")


if __name__ == "__main__":
    main()
