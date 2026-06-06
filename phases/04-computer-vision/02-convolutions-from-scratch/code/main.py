import numpy as np


def pad2d(x, p):
    if p == 0:
        return x
    h, w = x.shape[-2:]
    out = np.zeros(x.shape[:-2] + (h + 2 * p, w + 2 * p), dtype=x.dtype)
    out[..., p:p + h, p:p + w] = x
    return out


def output_size(h_in, k, p, s):
    return (h_in + 2 * p - k) // s + 1


def conv2d_naive(x, w, b=None, stride=1, padding=0):
    c_in, h, w_in = x.shape
    c_out, c_in_w, kh, kw = w.shape
    assert c_in == c_in_w

    x_pad = pad2d(x, padding)
    h_out = output_size(h, kh, padding, stride)
    w_out = output_size(w_in, kw, padding, stride)

    out = np.zeros((c_out, h_out, w_out), dtype=np.float32)
    for oc in range(c_out):
        for i in range(h_out):
            for j in range(w_out):
                hs = i * stride
                ws = j * stride
                patch = x_pad[:, hs:hs + kh, ws:ws + kw]
                out[oc, i, j] = np.sum(patch * w[oc])
        if b is not None:
            out[oc] += b[oc]
    return out


def im2col(x, kh, kw, stride=1, padding=0):
    c_in, h, w = x.shape
    x_pad = pad2d(x, padding)
    h_out = output_size(h, kh, padding, stride)
    w_out = output_size(w, kw, padding, stride)

    cols = np.zeros((c_in * kh * kw, h_out * w_out), dtype=x.dtype)
    col = 0
    for i in range(h_out):
        for j in range(w_out):
            hs = i * stride
            ws = j * stride
            patch = x_pad[:, hs:hs + kh, ws:ws + kw]
            cols[:, col] = patch.reshape(-1)
            col += 1
    return cols, h_out, w_out


def conv2d_im2col(x, w, b=None, stride=1, padding=0):
    c_out, c_in, kh, kw = w.shape
    cols, h_out, w_out = im2col(x, kh, kw, stride, padding)
    w_flat = w.reshape(c_out, -1)
    out = w_flat @ cols
    if b is not None:
        out += b[:, None]
    return out.reshape(c_out, h_out, w_out)


def receptive_field(layers):
    rf = 1
    stride_prod = 1
    for k, s in layers:
        rf = rf + (k - 1) * stride_prod
        stride_prod *= s
    return rf


KERNELS = {
    "identity": np.array([[0, 0, 0], [0, 1, 0], [0, 0, 0]], dtype=np.float32),
    "blur_3x3": np.ones((3, 3), dtype=np.float32) / 9.0,
    "sharpen": np.array([[0, -1, 0], [-1, 5, -1], [0, -1, 0]], dtype=np.float32),
    "sobel_x": np.array([[-1, 0, 1], [-2, 0, 2], [-1, 0, 1]], dtype=np.float32),
    "sobel_y": np.array([[-1, -2, -1], [0, 0, 0], [1, 2, 1]], dtype=np.float32),
}


def apply_kernel(img2d, kernel):
    x = img2d[None].astype(np.float32)
    w = kernel[None, None]
    return conv2d_im2col(x, w, padding=1)[0]


def synthetic_step_image(size=16):
    img = np.zeros((1, size, size), dtype=np.float32)
    img[:, :, size // 2:] = 1.0
    return img


def test_against_naive():
    rng = np.random.default_rng(0)
    x = rng.normal(0, 1, (3, 16, 16)).astype(np.float32)
    w = rng.normal(0, 1, (8, 3, 3, 3)).astype(np.float32)
    b = rng.normal(0, 1, (8,)).astype(np.float32)

    y_naive = conv2d_naive(x, w, b, padding=1)
    y_im2col = conv2d_im2col(x, w, b, padding=1)
    diff = float(np.max(np.abs(y_naive - y_im2col)))
    return y_naive.shape, diff


def main():
    shape, diff = test_against_naive()
    print(f"conv equivalence: naive vs im2col     shape={shape}   max|diff|={diff:.2e}")

    x = synthetic_step_image()
    y = apply_kernel(x[0], KERNELS["sobel_x"])
    print("\nsobel_x on a left/right step image (first five rows):")
    print(y[:5].round(1))

    print("\noutput size cheatsheet  (H=32):")
    for k, p, s in [(3, 0, 1), (3, 1, 1), (3, 1, 2), (2, 0, 2), (7, 3, 2)]:
        print(f"  K={k} P={p} S={s}  ->  H_out={output_size(32, k, p, s)}")

    stacks = [
        [(3, 1)],
        [(3, 1), (3, 1)],
        [(3, 1), (3, 1), (3, 1)],
        [(3, 1), (3, 2), (3, 1), (3, 2)],
    ]
    print("\nreceptive field grows with depth:")
    for stack in stacks:
        print(f"  layers={stack}  ->  RF={receptive_field(stack)}")


if __name__ == "__main__":
    main()
