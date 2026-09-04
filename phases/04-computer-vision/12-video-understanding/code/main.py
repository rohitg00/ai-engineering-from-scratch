import numpy as np
import torch
import torch.nn as nn
from torchvision.models import resnet18, ResNet18_Weights


def sample_uniform(num_frames_total, T):
    if num_frames_total <= 0:
        raise ValueError(f"num_frames_total must be positive, got {num_frames_total}")
    if num_frames_total <= T:
        return list(range(num_frames_total)) + [num_frames_total - 1] * (T - num_frames_total)
    step = num_frames_total / T
    return [int(i * step) for i in range(T)]


def sample_dense(num_frames_total, T, rng=None):
    if num_frames_total <= 0:
        raise ValueError(f"num_frames_total must be positive, got {num_frames_total}")
    rng = rng or np.random.default_rng()
    if num_frames_total <= T:
        return list(range(num_frames_total)) + [num_frames_total - 1] * (T - num_frames_total)
    start = int(rng.integers(0, num_frames_total - T + 1))
    return list(range(start, start + T))


class FramePool(nn.Module):
    def __init__(self, num_classes=10, pretrained=False):
        super().__init__()
        weights = ResNet18_Weights.IMAGENET1K_V1 if pretrained else None
        backbone = resnet18(weights=weights)
        self.features = nn.Sequential(*list(backbone.children())[:-1])
        self.head = nn.Linear(512, num_classes)

    def forward(self, x):
        N, T = x.shape[:2]
        x = x.reshape(N * T, *x.shape[2:])
        feats = self.features(x).view(N, T, -1)
        pooled = feats.mean(dim=1)
        return self.head(pooled)


def inflate_2d_to_3d(conv2d, time_kernel=3):
    out_c, in_c, kh, kw = conv2d.weight.shape
    pad_h = conv2d.padding[0] if isinstance(conv2d.padding, tuple) else conv2d.padding
    pad_w = conv2d.padding[1] if isinstance(conv2d.padding, tuple) else conv2d.padding
    stride_h = conv2d.stride[0] if isinstance(conv2d.stride, tuple) else conv2d.stride
    stride_w = conv2d.stride[1] if isinstance(conv2d.stride, tuple) else conv2d.stride
    has_bias = conv2d.bias is not None
    conv3d = nn.Conv3d(
        in_c, out_c,
        kernel_size=(time_kernel, kh, kw),
        padding=(time_kernel // 2, pad_h, pad_w),
        stride=(1, stride_h, stride_w),
        bias=has_bias,
    )
    weight_3d = conv2d.weight.data.unsqueeze(2).repeat(1, 1, time_kernel, 1, 1) / time_kernel
    conv3d.weight.data = weight_3d
    if has_bias:
        conv3d.bias.data = conv2d.bias.data.clone()
    return conv3d


class Conv2Plus1D(nn.Module):
    def __init__(self, in_c, out_c, kernel_size=3):
        super().__init__()
        mid_c = max(8, (in_c * out_c * kernel_size * kernel_size * kernel_size) //
                    (in_c * kernel_size * kernel_size + out_c * kernel_size))
        self.spatial = nn.Conv3d(in_c, mid_c,
                                 kernel_size=(1, kernel_size, kernel_size),
                                 padding=(0, kernel_size // 2, kernel_size // 2),
                                 bias=False)
        self.bn = nn.BatchNorm3d(mid_c)
        self.act = nn.ReLU(inplace=True)
        self.temporal = nn.Conv3d(mid_c, out_c,
                                  kernel_size=(kernel_size, 1, 1),
                                  padding=(kernel_size // 2, 0, 0),
                                  bias=False)

    def forward(self, x):
        return self.temporal(self.act(self.bn(self.spatial(x))))


def main():
    print("[frame samplers]")
    for total in [5, 30, 300]:
        print(f"  total={total:4d}  uniform(T=8)={sample_uniform(total, 8)}")
        print(f"  total={total:4d}  dense(T=8)={sample_dense(total, 8, np.random.default_rng(0))}")

    print("\n[frame-pool model]")
    model = FramePool(num_classes=10, pretrained=False)
    x = torch.randn(2, 8, 3, 64, 64)
    out = model(x)
    print(f"  input:  {tuple(x.shape)}")
    print(f"  output: {tuple(out.shape)}")
    print(f"  params: {sum(p.numel() for p in model.parameters()):,}")

    print("\n[I3D inflation]")
    c2d = nn.Conv2d(3, 16, kernel_size=3, padding=1, bias=False)
    c3d = inflate_2d_to_3d(c2d, time_kernel=3)
    print(f"  2D weight shape: {tuple(c2d.weight.shape)}")
    print(f"  3D weight shape: {tuple(c3d.weight.shape)}")
    y = c3d(torch.randn(1, 3, 8, 32, 32))
    print(f"  output: {tuple(y.shape)}")

    print("\n[(2+1)D conv]")
    c21 = Conv2Plus1D(3, 16)
    y = c21(torch.randn(1, 3, 8, 32, 32))
    print(f"  output: {tuple(y.shape)}")
    print(f"  params: {sum(p.numel() for p in c21.parameters()):,}")


if __name__ == "__main__":
    main()
