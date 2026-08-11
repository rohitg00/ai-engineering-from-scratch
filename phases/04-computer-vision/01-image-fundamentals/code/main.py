"""Image fundamentals: RGB representation, synthetic generation, and loading.
Docs: phases/04-computer-vision/01-image-fundamentals/docs/en.md
Source: ImageNet normalization standards (https://pytorch.org/vision/stable/models.html)
"""

import numpy as np
from PIL import Image
from io import BytesIO
from urllib.parse import urlparse
from urllib.request import Request, urlopen


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


def load_rgb(url, timeout=5):
    parsed = urlparse(url)
    scheme = parsed.scheme.lower()
    hostname = parsed.hostname

    if scheme not in {"http", "https"}:
        # In a real app, you would raise an error. For this lab, we fallback to synthetic.
        return synthetic_image()

    # SSRF protection: block local/internal hostnames and cloud metadata endpoints
    if hostname:
        hostname = hostname.lower()
        # Block localhost, loopback, private RFC1918 ranges, and cloud metadata (169.254.169.254)
        def is_private_172(h):
            parts = h.split(".")
            if len(parts) < 2 or not parts[1].isdigit():
                return False
            return 16 <= int(parts[1]) <= 31

        is_unsafe = (
            hostname == "localhost"
            or hostname.startswith("127.")
            or hostname.startswith("10.")
            or hostname.startswith("192.168.")
            or hostname.startswith("169.254.")
            or (hostname.startswith("172.") and is_private_172(hostname))
            or hostname == "::1"
        )
        if is_unsafe:
            return synthetic_image()

    try:
        req = Request(url, headers={"User-Agent": "ai-eng-course/1.0"})
        data = urlopen(req, timeout=timeout).read()
        img = Image.open(BytesIO(data)).convert("RGB")
        return np.asarray(img)
    except Exception:
        return synthetic_image()


def inspect(arr, label="image"):
    if arr.ndim == 2:
        print(f"[{label}] dtype={arr.dtype} shape={arr.shape} "
              f"min={arr.min()} max={arr.max()} mean={float(arr.mean()):.2f}")
        return
    print(f"[{label}] dtype={arr.dtype} shape={arr.shape} "
          f"min={arr.min()} max={arr.max()} "
          f"per-channel mean={arr.reshape(-1, arr.shape[-1]).mean(axis=0).round(2).tolist()}")


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
    # argmax-based masks avoid float-equality edge cases where
    # cmax == r/g/b would silently miss a pixel.
    argmax = np.argmax(rgb_f, axis=-1)
    rmax = mask & (argmax == 0)
    gmax = mask & (argmax == 1)
    bmax = mask & (argmax == 2)
    h[rmax] = ((g[rmax] - b[rmax]) / delta[rmax]) % 6
    h[gmax] = ((b[gmax] - r[gmax]) / delta[gmax]) + 2
    h[bmax] = ((r[bmax] - g[bmax]) / delta[bmax]) + 4
    h = h * 60.0

    s = np.where(cmax > 0, delta / cmax, 0)
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


def resize_compare(arr, scale=3):
    target = (arr.shape[1] * scale, arr.shape[0] * scale)
    methods = {
        "nearest": Image.NEAREST,
        "bilinear": Image.BILINEAR,
        "bicubic": Image.BICUBIC,
    }
    return {
        name: np.asarray(Image.fromarray(arr).resize(target, filt))
        for name, filt in methods.items()
    }


def local_roughness(x):
    gy = np.diff(x.astype(np.float32), axis=0)
    gx = np.diff(x.astype(np.float32), axis=1)
    return float(np.abs(gy).mean() + np.abs(gx).mean())


def main():
    url = (
        "https://upload.wikimedia.org/wikipedia/commons/thumb/4/47/"
        "PNG_transparency_demonstration_1.png/280px-PNG_transparency_demonstration_1.png"
    )
    arr = load_rgb(url)
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
