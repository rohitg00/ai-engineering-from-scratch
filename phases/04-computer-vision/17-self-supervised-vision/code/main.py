import torch
import torch.nn.functional as F


def info_nce(z1, z2, tau=0.1):
    N, D = z1.shape
    z = torch.cat([z1, z2], dim=0)
    sim = z @ z.T / tau
    mask = torch.eye(2 * N, dtype=torch.bool, device=z.device)
    sim = sim.masked_fill(mask, float("-inf"))
    targets = torch.cat([torch.arange(N, 2 * N), torch.arange(0, N)]).to(z.device)
    return F.cross_entropy(sim, targets)


def random_mask_indices(num_patches, mask_ratio=0.75, seed=0):
    g = torch.Generator().manual_seed(seed)
    n_keep = int(num_patches * (1 - mask_ratio))
    perm = torch.randperm(num_patches, generator=g)
    visible = perm[:n_keep]
    masked = perm[n_keep:]
    return visible.sort().values, masked.sort().values


class DinoHead(torch.nn.Module):
    """
    Toy DINO head to demonstrate centring + sharpening.
    Real DINO uses a deeper MLP.
    """

    def __init__(self, in_dim=64, out_dim=128, momentum=0.9):
        super().__init__()
        self.proj = torch.nn.Linear(in_dim, out_dim)
        self.register_buffer("centre", torch.zeros(out_dim))
        self.momentum = momentum

    def student(self, x, temp=0.1):
        return F.log_softmax(self.proj(x) / temp, dim=-1)

    def teacher(self, x, temp=0.04):
        out = self.proj(x)
        return F.softmax((out - self.centre) / temp, dim=-1).detach()

    @torch.no_grad()
    def update_centre(self, teacher_out):
        self.centre.mul_(self.momentum).add_(teacher_out.mean(dim=0), alpha=1 - self.momentum)


def main():
    torch.manual_seed(0)

    print("[info_nce]")
    z = F.normalize(torch.randn(16, 32), dim=-1)
    loss_identical = info_nce(z, z, tau=0.1).item()
    z_random = F.normalize(torch.randn(16, 32), dim=-1)
    loss_random = info_nce(z, z_random, tau=0.1).item()
    print(f"  identical pairs:  {loss_identical:.3f}  (should be low)")
    print(f"  random pairs:     {loss_random:.3f}  (should be near log(2N-1) = {torch.log(torch.tensor(31.0)):.3f})")

    print("\n[mae mask]")
    visible, masked = random_mask_indices(196, mask_ratio=0.75)
    print(f"  visible: {len(visible)} / 196")
    print(f"  masked:  {len(masked)} / 196")
    print(f"  first 5 visible indices: {visible[:5].tolist()}")

    print("\n[dino centring demo]")
    head = DinoHead(in_dim=64, out_dim=16)
    feats = torch.randn(64, 64)
    teacher_out = head.teacher(feats)
    print(f"  teacher output max col mean before update: {teacher_out.mean(dim=0).max().item():.3f}")
    head.update_centre(head.proj(feats))
    teacher_out_after = head.teacher(feats)
    print(f"  teacher output max col mean after update:  {teacher_out_after.mean(dim=0).max().item():.3f}")


if __name__ == "__main__":
    main()
