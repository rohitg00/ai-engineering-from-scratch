import torch
import torch.nn as nn
import torch.nn.functional as F


class VideoPatch3D(nn.Module):
    def __init__(self, in_channels=4, dim=64, patch_t=2, patch_h=2, patch_w=2):
        super().__init__()
        self.proj = nn.Conv3d(
            in_channels, dim,
            kernel_size=(patch_t, patch_h, patch_w),
            stride=(patch_t, patch_h, patch_w),
        )

    def forward(self, x):
        x = self.proj(x)
        n, c, t, h, w = x.shape
        tokens = x.reshape(n, c, t * h * w).transpose(1, 2)
        return tokens, (t, h, w)


class DividedAttentionBlock(nn.Module):
    def __init__(self, dim=64, heads=2):
        super().__init__()
        self.time_attn = nn.MultiheadAttention(dim, heads, batch_first=True)
        self.space_attn = nn.MultiheadAttention(dim, heads, batch_first=True)
        self.ln1 = nn.LayerNorm(dim)
        self.ln2 = nn.LayerNorm(dim)
        self.ln3 = nn.LayerNorm(dim)
        self.mlp = nn.Sequential(nn.Linear(dim, 4 * dim), nn.GELU(), nn.Linear(4 * dim, dim))

    def forward(self, x, grid):
        T, H, W = grid
        n, seq, d = x.shape

        xt = x.view(n, T, H * W, d).permute(0, 2, 1, 3).reshape(n * H * W, T, d)
        a, _ = self.time_attn(self.ln1(xt), self.ln1(xt), self.ln1(xt), need_weights=False)
        xt = (xt + a).reshape(n, H * W, T, d).permute(0, 2, 1, 3).reshape(n, seq, d)

        xs = xt.view(n, T, H * W, d).reshape(n * T, H * W, d)
        a, _ = self.space_attn(self.ln2(xs), self.ln2(xs), self.ln2(xs), need_weights=False)
        xs = (xs + a).reshape(n, T, H * W, d).reshape(n, seq, d)

        xs = xs + self.mlp(self.ln3(xs))
        return xs


class TinyVideoDiT(nn.Module):
    def __init__(self, in_channels=4, dim=64, depth=2, heads=2):
        super().__init__()
        self.in_channels = in_channels
        self.dim = dim
        self.patch = VideoPatch3D(in_channels=in_channels, dim=dim, patch_t=2, patch_h=2, patch_w=2)
        self.blocks = nn.ModuleList([DividedAttentionBlock(dim, heads) for _ in range(depth)])
        self.out = nn.Linear(dim, in_channels * 2 * 2 * 2)

    def forward(self, x):
        tokens, grid = self.patch(x)
        for blk in self.blocks:
            tokens = blk(tokens, grid)
        return self.out(tokens), grid


def count_tokens(T, H, W, p_t=2, p_h=8, p_w=8):
    return (T // p_t) * (H // p_h) * (W // p_w)


def main():
    print("[token count for 5s 360p video (150 frames, 480x360)]")
    tokens = count_tokens(150, 480, 360, p_t=2, p_h=8, p_w=8)
    T_tok = 150 // 2
    S_tok = (480 // 8) * (360 // 8)
    print(f"  tokens per clip: {tokens:,}")
    print(f"  attention pairs (joint): {tokens ** 2:,}")
    # Divided temporal: T^2 attention at every spatial position.
    # Divided spatial:  (H*W)^2 attention at every timestep.
    divided_time = S_tok * T_tok ** 2
    divided_space = T_tok * S_tok ** 2
    print(f"  divided time total: {divided_time:,}")
    print(f"  divided space total: {divided_space:,}")
    print(f"  divided total: {divided_time + divided_space:,}")

    torch.manual_seed(0)
    vid = torch.randn(1, 4, 8, 16, 16)
    model = TinyVideoDiT(in_channels=4, dim=64, depth=2, heads=2)
    out, grid = model(vid)
    print(f"\n[model shapes]")
    print(f"  input   {tuple(vid.shape)}")
    print(f"  tokens grid {grid}")
    print(f"  output  {tuple(out.shape)}")
    print(f"  params  {sum(p.numel() for p in model.parameters()):,}")


if __name__ == "__main__":
    main()
