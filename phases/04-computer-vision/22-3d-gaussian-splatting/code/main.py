import math
import numpy as np
import torch
import torch.nn as nn
import torch.nn.functional as F


def eval_2d_gaussian(means, covs, points):
    G = means.size(0)
    H, W, _ = points.shape
    flat = points.view(-1, 2)
    inv = torch.linalg.inv(covs)
    diff = flat[None, :, :] - means[:, None, :]
    d = torch.einsum("gpi,gij,gpj->gp", diff, inv, diff)
    density = torch.exp(-0.5 * d)
    return density.view(G, H, W)


def rasterise_2d(means, covs, colours, opacities, depths, image_size):
    H, W = image_size
    device = means.device
    yy, xx = torch.meshgrid(
        torch.arange(H, dtype=torch.float32, device=device),
        torch.arange(W, dtype=torch.float32, device=device),
        indexing="ij",
    )
    points = torch.stack([xx, yy], dim=-1)
    densities = eval_2d_gaussian(means, covs, points)
    alphas = opacities[:, None, None] * densities
    alphas = alphas.clamp(0.0, 0.99)

    order = torch.argsort(depths)
    alphas = alphas[order]
    colours_sorted = colours[order]

    T = torch.ones(H, W, device=device)
    out = torch.zeros(H, W, 3, device=device)
    for i in range(means.size(0)):
        a = alphas[i]
        out = out + (T * a)[..., None] * colours_sorted[i][None, None, :]
        T = T * (1.0 - a)
    return out


class Splats2D(nn.Module):
    def __init__(self, num_splats=64, image_size=64, seed=0):
        super().__init__()
        g = torch.Generator().manual_seed(seed)
        H, W = image_size, image_size
        self.means = nn.Parameter(torch.rand(num_splats, 2, generator=g) * torch.tensor([W, H]))
        self.log_scale = nn.Parameter(torch.full((num_splats, 2), math.log(3.0)))
        self.rot = nn.Parameter(torch.zeros(num_splats))
        self.colour_logits = nn.Parameter(torch.randn(num_splats, 3, generator=g) * 0.3)
        self.opacity_logit = nn.Parameter(torch.zeros(num_splats))
        self.depth = nn.Parameter(torch.rand(num_splats, generator=g))

    def covs(self):
        s = torch.exp(self.log_scale)
        c, si = torch.cos(self.rot), torch.sin(self.rot)
        R = torch.stack([
            torch.stack([c, -si], dim=-1),
            torch.stack([si, c], dim=-1),
        ], dim=-2)
        S = torch.diag_embed(s ** 2)
        return R @ S @ R.transpose(-1, -2)

    def forward(self, image_size):
        covs = self.covs()
        colours = torch.sigmoid(self.colour_logits)
        opacities = torch.sigmoid(self.opacity_logit)
        return rasterise_2d(self.means, covs, colours, opacities, self.depth, image_size)


def make_target(size=48):
    yy, xx = np.meshgrid(np.arange(size), np.arange(size), indexing="ij")
    img = np.ones((size, size, 3), dtype=np.float32)
    mask = (xx - 15) ** 2 + (yy - 15) ** 2 < 8 ** 2
    img[mask] = [0.95, 0.2, 0.15]
    mask = (np.abs(xx - 34) < 6) & (np.abs(yy - 32) < 6)
    img[mask] = [0.2, 0.35, 0.95]
    return torch.from_numpy(img)


def sh_degree_3_basis(dirs):
    x, y, z = dirs[..., 0], dirs[..., 1], dirs[..., 2]
    x2, y2, z2 = x * x, y * y, z * z
    xy, yz, xz = x * y, y * z, x * z
    C0 = 0.282094791773878
    C1 = 0.488602511902920
    C2 = [1.092548430592079, 1.092548430592079,
          0.315391565252520, 1.092548430592079,
          0.546274215296039]
    C3 = [0.590043589926644, 2.890611442640554,
          0.457045799464465, 0.373176332590115,
          0.457045799464465, 1.445305721320277,
          0.590043589926644]
    basis = torch.stack([
        torch.full_like(x, C0),
        -C1 * y, C1 * z, -C1 * x,
        C2[0] * xy, C2[1] * yz, C2[2] * (2 * z2 - x2 - y2), C2[3] * xz, C2[4] * (x2 - y2),
        -C3[0] * y * (3 * x2 - y2), C3[1] * xy * z, -C3[2] * y * (4 * z2 - x2 - y2),
        C3[3] * z * (2 * z2 - 3 * x2 - 3 * y2), -C3[4] * x * (4 * z2 - x2 - y2),
        C3[5] * z * (x2 - y2), -C3[6] * x * (x2 - 3 * y2),
    ], dim=-1)
    return basis


def eval_sh_degree_3(sh_coeffs, dirs):
    basis = sh_degree_3_basis(dirs)
    return torch.einsum("...b,...bc->...c", basis, sh_coeffs)


def main():
    torch.manual_seed(0)
    device = "cpu"

    target = make_target(48).to(device)
    model = Splats2D(num_splats=48, image_size=48).to(device)
    opt = torch.optim.Adam(model.parameters(), lr=0.08)

    print("Fitting 48 2D Gaussians to a red circle + blue square...")
    for step in range(300):
        pred = model((48, 48))
        loss = F.mse_loss(pred, target)
        opt.zero_grad(); loss.backward(); opt.step()
        if step % 50 == 0:
            print(f"  step {step:3d}  mse {loss.item():.4f}")

    with torch.no_grad():
        final = F.mse_loss(model((48, 48)), target).item()
    print(f"final mse: {final:.4f}")

    print("\nSpherical harmonics sanity check:")
    sh = torch.randn(1, 16, 3)
    dirs = F.normalize(torch.tensor([[1.0, 0.0, 0.0], [0.0, 1.0, 0.0], [0.0, 0.0, 1.0]]), dim=-1)
    rgb = eval_sh_degree_3(sh, dirs)
    print(f"  SH(16, 3) evaluated at 3 directions -> {tuple(rgb.shape)}")


if __name__ == "__main__":
    main()
