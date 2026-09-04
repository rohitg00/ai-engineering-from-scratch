"""Runnable companion for the Image Fundamentals lesson.
Builds a deterministic RGB image and transforms it as a NumPy tensor.
Implements nearest, bilinear, and bicubic resizing from scratch.
See ../docs/en.md for the derivations and production-library comparison.
"""

import numpy as np


IMAGENET_MEAN = np.array([0.485, 0.456, 0.406], dtype=np.float32)
IMAGENET_STD = np.array([0.229, 0.224, 0.225], dtype=np.float32)


def synthetic_image(height=128, width=192, seed=0):
    rng = np.random.default_rng(seed)
    yy, xx = np.meshgrid(np.linspace(0, 1, height), np.linspace(0, 1, width), indexing="ij")
    r = (np.sin(xx * 6) * 0.5 + 0.5) * 255
    g = (yy * 255)
    b = ((1 - yy) * xx * 255)
    noise = rng.normal(0, 6, (height, width, 3))
    rgb = np.stack([r, g, b], axis=-1) + noise
    return np.clip(rgb, 0, 255).astype(np.uint8)


def inspect(arr, label="image"):
    if arr.ndim == 2:
        print(
            f"[{label}] dtype={arr.dtype} shape={arr.shape} "
            f"min={arr.min()} max={arr.max()} mean={float(arr.mean()):.2f}"
        )
        return
    print(
        f"[{label}] dtype={arr.dtype} shape={arr.shape} "
        f"min={arr.min()} max={arr.max()} "
        f"per-channel mean="
        f"{arr.reshape(-1, arr.shape[-1]).mean(axis=0).round(2).tolist()}"
    )


def hwc_to_chw(arr):
    return arr.transpose(2, 0, 1)


def chw_to_hwc(arr):
    return arr.transpose(1, 2, 0)


def rgb_to_grayscale(rgb):
    weights = np.array([0.299, 0.587, 0.114], dtype=np.float32)
    return (rgb.astype(np.float32) @ weights).astype(np.uint8)


def rgb_to_hsv(rgb):
    rgb_f = rgb.astype(np.float32) / 255.0
    r, g, b = rgb_f[..., 0], rgb_f[..., 1], rgb_f[..., 2]
    cmax = np.max(rgb_f, axis=-1)
    cmin = np.min(rgb_f, axis=-1)
    delta = cmax - cmin

    h = np.zeros_like(cmax)
    mask = delta > 0
    argmax = np.argmax(rgb_f, axis=-1)
    rmax = mask & (argmax == 0)
    gmax = mask & (argmax == 1)
    bmax = mask & (argmax == 2)
    h[rmax] = ((g[rmax] - b[rmax]) / delta[rmax]) % 6
    h[gmax] = ((b[gmax] - r[gmax]) / delta[gmax]) + 2
    h[bmax] = ((r[bmax] - g[bmax]) / delta[bmax]) + 4
    h = h * 60.0

    s = np.divide(delta, cmax, out=np.zeros_like(delta), where=cmax > 0)
    v = cmax
    return np.stack([h, s, v], axis=-1)


def preprocess_imagenet(rgb_uint8):
    x = rgb_uint8.astype(np.float32) / 255.0
    x = (x - IMAGENET_MEAN) / IMAGENET_STD
    x = x.transpose(2, 0, 1)
    return x


def deprocess_imagenet(chw_float32):
    x = chw_float32.transpose(1, 2, 0)
    x = x * IMAGENET_STD + IMAGENET_MEAN
    x = np.clip(x * 255.0, 0, 255).astype(np.uint8)
    return x


def resize_coordinates(source_length, target_length):
    if target_length < 1:
        raise ValueError("target length must be positive")
    if source_length < 1:
        raise ValueError("source length must be positive")
    if target_length == 1:
        return np.zeros(1, dtype=np.float32)
    return np.linspace(0, source_length - 1, target_length, dtype=np.float32)


def nearest_resize(arr, target_height, target_width):
    y = np.rint(resize_coordinates(arr.shape[0], target_height)).astype(int)
    x = np.rint(resize_coordinates(arr.shape[1], target_width)).astype(int)
    return arr[y[:, None], x[None, :]]


def bilinear_resize(arr, target_height, target_width):
    y = resize_coordinates(arr.shape[0], target_height)
    x = resize_coordinates(arr.shape[1], target_width)
    y0 = np.floor(y).astype(int)
    x0 = np.floor(x).astype(int)
    y1 = np.minimum(y0 + 1, arr.shape[0] - 1)
    x1 = np.minimum(x0 + 1, arr.shape[1] - 1)
    wy = (y - y0)[:, None, None]
    wx = (x - x0)[None, :, None]

    source = arr.astype(np.float32)
    top = source[y0[:, None], x0[None, :]] * (1 - wx)
    top += source[y0[:, None], x1[None, :]] * wx
    bottom = source[y1[:, None], x0[None, :]] * (1 - wx)
    bottom += source[y1[:, None], x1[None, :]] * wx
    result = top * (1 - wy) + bottom * wy
    return np.clip(np.rint(result), 0, 255).astype(arr.dtype)


def cubic_weight(distance, tension=-0.5):
    x = np.abs(distance)
    inner = (tension + 2) * x**3 - (tension + 3) * x**2 + 1
    outer = tension * x**3 - 5 * tension * x**2 + 8 * tension * x - 4 * tension
    return np.where(x <= 1, inner, np.where(x < 2, outer, 0.0))


def bicubic_resize(arr, target_height, target_width):
    y = resize_coordinates(arr.shape[0], target_height)
    x = resize_coordinates(arr.shape[1], target_width)
    offsets = np.arange(-1, 3)

    x_base = np.floor(x).astype(int)
    x_neighbors = x_base[:, None] + offsets[None, :]
    x_weights = cubic_weight(x[:, None] - x_neighbors)
    x_weights /= x_weights.sum(axis=1, keepdims=True)
    x_indices = np.clip(x_neighbors, 0, arr.shape[1] - 1)

    source = arr.astype(np.float32)
    horizontal = np.zeros((arr.shape[0], target_width, arr.shape[2]), dtype=np.float32)
    for tap in range(4):
        horizontal += source[:, x_indices[:, tap], :] * x_weights[None, :, tap, None]

    y_base = np.floor(y).astype(int)
    y_neighbors = y_base[:, None] + offsets[None, :]
    y_weights = cubic_weight(y[:, None] - y_neighbors)
    y_weights /= y_weights.sum(axis=1, keepdims=True)
    y_indices = np.clip(y_neighbors, 0, arr.shape[0] - 1)

    result = np.zeros((target_height, target_width, arr.shape[2]), dtype=np.float32)
    for tap in range(4):
        result += horizontal[y_indices[:, tap], :, :] * y_weights[:, tap, None, None]
    return np.clip(np.rint(result), 0, 255).astype(arr.dtype)


def resize_compare(arr, scale=3):
    if not isinstance(scale, int) or scale < 1:
        raise ValueError("scale must be a positive integer")
    target_height = arr.shape[0] * scale
    target_width = arr.shape[1] * scale
    return {
        "nearest": nearest_resize(arr, target_height, target_width),
        "bilinear": bilinear_resize(arr, target_height, target_width),
        "bicubic": bicubic_resize(arr, target_height, target_width),
    }


def local_roughness(x):
    gy = np.diff(x.astype(np.float32), axis=0)
    gx = np.diff(x.astype(np.float32), axis=1)
    return float(np.abs(gy).mean() + np.abs(gx).mean())


def main():
    arr = synthetic_image()
    print("source: deterministic synthetic RGB image (offline)")
    inspect(arr, "raw")

    chw = hwc_to_chw(arr)
    print(f"HWC shape: {arr.shape}   CHW shape: {chw.shape}")

    gray = rgb_to_grayscale(arr)
    hsv = rgb_to_hsv(arr)
    print(f"grayscale shape: {gray.shape}")
    print(f"hsv hue range:   [{hsv[..., 0].min():.1f}, {hsv[..., 0].max():.1f}] deg")
    print(f"hsv sat range:   [{hsv[..., 1].min():.2f}, {hsv[..., 1].max():.2f}]")
    print(f"hsv val range:   [{hsv[..., 2].min():.2f}, {hsv[..., 2].max():.2f}]")

    x = preprocess_imagenet(arr)
    print(f"preprocessed shape: {x.shape}  dtype: {x.dtype}")
    print(f"per-channel mean: {x.mean(axis=(1, 2)).round(3).tolist()}")
    print(f"per-channel std:  {x.std(axis=(1, 2)).round(3).tolist()}")

    roundtrip = deprocess_imagenet(x)
    max_diff = int(np.abs(roundtrip.astype(int) - arr.astype(int)).max())
    print(f"roundtrip max pixel diff: {max_diff}")

    for name, out in resize_compare(arr, scale=3).items():
        print(f"{name:>8}  shape={out.shape}  roughness={local_roughness(out):6.2f}")


if __name__ == "__main__":
    main()
