import os
import tempfile

import numpy as np
import torch


def abs_rel_error(pred, target, mask=None):
    if mask is not None:
        pred = pred[mask]
        target = target[mask]
    return (torch.abs(pred - target) / target.clamp(min=1e-6)).mean().item()


def delta_accuracy(pred, target, threshold=1.25, mask=None):
    if mask is not None:
        pred = pred[mask]
        target = target[mask]
    ratio = torch.maximum(pred / target.clamp(min=1e-6), target / pred.clamp(min=1e-6))
    return (ratio < threshold).float().mean().item()


def align_scale_shift(pred, target, mask=None):
    if mask is not None:
        p = pred[mask]
        t = target[mask]
    else:
        p = pred.flatten()
        t = target.flatten()
    A = torch.stack([p, torch.ones_like(p)], dim=1)
    sol = torch.linalg.lstsq(A, t.unsqueeze(-1))
    a, b = sol.solution[:2, 0]
    return a * pred + b


def depth_to_point_cloud(depth, intrinsics):
    H, W = depth.shape
    fx, fy, cx, cy = intrinsics
    v, u = np.meshgrid(np.arange(H), np.arange(W), indexing="ij")
    z = depth
    x = (u - cx) * z / fx
    y = (v - cy) * z / fy
    return np.stack([x, y, z], axis=-1)


def synthetic_depth(size=96):
    yy, xx = np.meshgrid(np.arange(size), np.arange(size), indexing="ij")
    depth = 1.0 + (yy / size) * 4.0
    mask = (np.abs(xx - size / 2) < size / 6) & (np.abs(yy - size * 0.6) < size / 6)
    depth[mask] = 2.0
    return depth.astype(np.float32)


def write_ply(path, points, colors=None):
    points = points.reshape(-1, 3)
    n = points.shape[0]
    header = [
        "ply", "format ascii 1.0",
        f"element vertex {n}",
        "property float x", "property float y", "property float z",
    ]
    if colors is not None:
        header += ["property uchar red", "property uchar green", "property uchar blue"]
    header.append("end_header")
    with open(path, "w") as f:
        f.write("\n".join(header) + "\n")
        if colors is not None:
            colors = colors.reshape(-1, 3).astype(np.uint8)
            for p, c in zip(points, colors):
                f.write(f"{p[0]:.4f} {p[1]:.4f} {p[2]:.4f} {c[0]} {c[1]} {c[2]}\n")
        else:
            for p in points:
                f.write(f"{p[0]:.4f} {p[1]:.4f} {p[2]:.4f}\n")


def main():
    torch.manual_seed(0)

    gt_np = synthetic_depth(96)
    gt = torch.from_numpy(gt_np)
    pred = gt + 0.4 * torch.randn_like(gt)
    scaled_pred = 3.0 * pred + 0.7

    print("[metrics]")
    print(f"  pred        absRel={abs_rel_error(pred, gt):.3f}  delta<1.25={delta_accuracy(pred, gt):.3f}")
    print(f"  scaled      absRel={abs_rel_error(scaled_pred, gt):.3f}  delta<1.25={delta_accuracy(scaled_pred, gt):.3f}")

    aligned = align_scale_shift(scaled_pred, gt)
    print(f"  aligned     absRel={abs_rel_error(aligned, gt):.3f}  delta<1.25={delta_accuracy(aligned, gt):.3f}")

    print("\n[depth -> point cloud]")
    intr = (96.0, 96.0, 48.0, 48.0)
    pc = depth_to_point_cloud(gt_np, intr)
    print(f"  point cloud shape: {pc.shape}")
    print(f"  x range [{pc[..., 0].min():.2f}, {pc[..., 0].max():.2f}]")
    print(f"  y range [{pc[..., 1].min():.2f}, {pc[..., 1].max():.2f}]")
    print(f"  z range [{pc[..., 2].min():.2f}, {pc[..., 2].max():.2f}]")

    path = os.path.join(tempfile.gettempdir(), "depth_demo.ply")
    write_ply(path, pc)
    print(f"  wrote {path}  ({pc.reshape(-1, 3).shape[0]} points)")


if __name__ == "__main__":
    main()
