# 从零实现卷积

> 卷积是一个在图像上滑动的小型全连接层，在每个位置共享同一组权重。

**Type:** Build
**Languages:** Python
**Prerequisites:** Phase 3（深度学习核心）、Phase 4 第 01 课（图像基础）
**Time:** 约 75 分钟

## 学习目标

- 仅用 NumPy 从零实现二维卷积，包括嵌套循环版本和向量化 `im2col` 版本
- 对任意输入尺寸、卷积核尺寸、填充和步幅组合计算输出空间尺寸，并推导 `(H - K + 2P) / S + 1` 公式
- 手工设计卷积核（边缘、模糊、锐化、Sobel），并解释每个核为何产生其对应的激活模式
- 将多个卷积堆叠成特征提取器，并理解堆叠深度与感受野大小的关系

## 问题背景

对一个 224x224 的 RGB 图像使用全连接层，每个神经元需要 224 * 224 * 3 = 150,528 个输入权重。一个有 1,000 个单元的隐藏层就已经有 1.5 亿个参数——而你还没学到任何有用的东西。更糟的是，这一层完全不知道左上角的狗和右下角的狗是同一种模式。它把每个像素位置都当作独立的，这对图像来说是完全错误的：把一只猫平移三个像素，不应该迫使网络重新学习这个概念。

图像模型需要两个性质：**平移等变性**（输入移动时输出也随之移动）和**参数共享**（同一个特征检测器在所有地方运行）。全连接层两者都不具备。卷积则天然免费提供这两者。

卷积并非为深度学习而发明。它是驱动 JPEG 压缩、Photoshop 中的高斯模糊、工业视觉中的边缘检测以及所有音频滤波器的同一运算。CNN 在 2012 年到 2020 年间统治 ImageNet 的原因是：对于“相邻值相关、同一模式可出现在任何位置”的数据，卷积是正确的先验。

## 核心概念

### 一个卷积核，滑动

二维卷积取一个称为卷积核（或滤波器）的小权重矩阵，在输入上滑动，在每个位置计算逐元素乘积之和。该和成为一个输出像素。

```mermaid
flowchart LR
    subgraph IN["Input (H x W)"]
        direction LR
        I1["5 x 5 image"]
    end
    subgraph K["Kernel (3 x 3)"]
        K1["learned<br/>weights"]
    end
    subgraph OUT["Output (H-2 x W-2)"]
        O1["3 x 3 map"]
    end
    I1 --> |"slide kernel<br/>compute dot product<br/>at each position"| O1
    K1 --> O1

    style IN fill:#dbeafe,stroke:#2563eb
    style K fill:#fef3c7,stroke:#d97706
    style OUT fill:#dcfce7,stroke:#16a34a
```

一个 5x5 输入上的具体 3x3 例子（无填充，步幅 1）：

```
Input X (5 x 5):                Kernel W (3 x 3):

  1  2  0  1  2                   1  0 -1
  0  1  3  1  0                   2  0 -2
  2  1  0  2  1                   1  0 -1
  1  0  2  1  3
  2  1  1  0  1

The kernel slides across every valid 3 x 3 window. Output Y is 3 x 3:

 Y[0,0] = sum( W * X[0:3, 0:3] )
 Y[0,1] = sum( W * X[0:3, 1:4] )
 Y[0,2] = sum( W * X[0:3, 2:5] )
 Y[1,0] = sum( W * X[1:4, 0:3] )
 ... and so on
```

这一个公式——**共享权重、局部性、滑动窗口**——就是全部思想。其余都只是记账。

### 输出尺寸公式

给定输入空间尺寸 `H`、卷积核尺寸 `K`、填充 `P`、步幅 `S`：

```
H_out = floor( (H - K + 2P) / S ) + 1
```

记住它。你在一个架构中要计算它几十次。

| 场景 | H | K | P | S | H_out |
|----------|---|---|---|---|-------|
| Valid 卷积，无填充 | 32 | 3 | 0 | 1 | 30 |
| Same 卷积（保持尺寸） | 32 | 3 | 1 | 1 | 32 |
| 下采样 2 倍 | 32 | 3 | 1 | 2 | 16 |
| 2x2 池化 | 32 | 2 | 0 | 2 | 16 |
| 大感受野 | 32 | 7 | 3 | 2 | 16 |

"Same padding" 指当 S == 1 时选取 P 使 H_out == H。对于奇数 K，即 P = (K - 1) / 2。这就是 3x3 卷积核占主导的原因——它仍是带中心点的最小奇数卷积核。

### 填充

没有填充时，每次卷积都会缩小特征图。堆叠 20 层后，你的 224x224 图像变成 184x184，这既浪费了边界处的计算，也使需要匹配形状的残差连接变得复杂。

```
Zero padding (P = 1) on a 5 x 5 input:

  0  0  0  0  0  0  0
  0  1  2  0  1  2  0
  0  0  1  3  1  0  0
  0  2  1  0  2  1  0       Now the kernel can centre on pixel
  0  1  0  2  1  3  0       (0, 0) and still have three rows and
  0  2  1  1  0  1  0       three columns of values to multiply.
  0  0  0  0  0  0  0
```

实践中会遇到的各种模式：`zero`（最常见）、`reflect`（镜像边缘，在生成模型中避免硬边）、`replicate`（复制边缘）、`circular`（环绕，用于环形问题）。

### 步幅

步幅是滑动的步长。`stride=1` 是默认值。`stride=2` 将空间维度减半，是在 CNN 内部不使用单独池化层进行下采样的经典方式——每个现代架构（ResNet、ConvNeXt、MobileNet）都在某处用带步幅的卷积替代了 max-pool。

```
Stride 1 on a 5 x 5 input, 3 x 3 kernel:

  starts: (0,0) (0,1) (0,2)        -> output row 0
          (1,0) (1,1) (1,2)        -> output row 1
          (2,0) (2,1) (2,2)        -> output row 2

  Output: 3 x 3

Stride 2 on the same input:

  starts: (0,0) (0,2)              -> output row 0
          (2,0) (2,2)              -> output row 1

  Output: 2 x 2
```

### 多输入通道

真实图像有三个通道。对 RGB 输入做 3x3 卷积实际上是一个 3x3x3 的体积：每个输入通道一个 3x3 切片。在每个空间位置，你对所有三个切片做乘法求和，再加上一个偏置。

```
Input:   (C_in,  H,  W)        3 x 5 x 5
Kernel:  (C_in,  K,  K)        3 x 3 x 3 (one kernel)
Output:  (1,     H', W')       2D map

For a layer that produces C_out output channels, you stack C_out kernels:

Weight:  (C_out, C_in, K, K)   e.g. 64 x 3 x 3 x 3
Output:  (C_out, H', W')       64 x 3 x 3

Parameter count: C_out * C_in * K * K + C_out   (the + C_out is biases)
```

规划模型时你计算的就是最后一行。对 3 通道输入做 64 通道的 3x3 卷积有 `64 * 3 * 3 * 3 + 64 = 1,792` 个参数。便宜。

### im2col 技巧

嵌套循环易读但慢。GPU 想要大矩阵乘法。技巧是：把输入的每个感受野窗口展平为大矩阵的一列，把卷积核展平为一行，整个卷积就变成了单次矩阵乘法。

```mermaid
flowchart LR
    X["Input<br/>(C_in, H, W)"] --> IM2COL["im2col<br/>(extract patches)"]
    IM2COL --> COLS["Cols matrix<br/>(C_in * K * K, H_out * W_out)"]
    W["Weight<br/>(C_out, C_in, K, K)"] --> FLAT["Flatten<br/>(C_out, C_in * K * K)"]
    FLAT --> MM["matmul"]
    COLS --> MM
    MM --> OUT["Output<br/>(C_out, H_out * W_out)<br/>reshape to (C_out, H_out, W_out)"]

    style X fill:#dbeafe,stroke:#2563eb
    style W fill:#fef3c7,stroke:#d97706
    style OUT fill:#dcfce7,stroke:#16a34a
```

每个生产级卷积实现都是这个方法的某种变体，再加上缓存分块技巧（直接卷积、Winograd、大核用的 FFT 卷积）。理解 im2col，你就理解了核心。

### 感受野

单个 3x3 卷积看 9 个输入像素。堆叠两个 3x3 卷积后，第二层的神经元看 5x5 的输入像素。三个 3x3 卷积给出 7x7。一般地：

```
RF after L stacked K x K convs (stride 1) = 1 + L * (K - 1)

With strides:   RF grows multiplicatively with stride along each layer.
```

"一路 3x3"（VGG、ResNet、ConvNeXt）之所以有效，正是因为两个 3x3 卷积覆盖与一个 5x5 卷积相同的输入区域，但参数更少，且中间多了一个非线性。

```figure
convolution-kernel
```

## 动手实现

### 第 1 步：填充数组

从最小的原语开始：一个在 H x W 数组周围填零的函数。

```python
import numpy as np

def pad2d(x, p):
    if p == 0:
        return x
    h, w = x.shape[-2:]
    out = np.zeros(x.shape[:-2] + (h + 2 * p, w + 2 * p), dtype=x.dtype)
    out[..., p:p + h, p:p + w] = x
    return out

x = np.arange(9).reshape(3, 3)
print(x)
print()
print(pad2d(x, 1))
```

尾部轴技巧 `x.shape[:-2]` 意味着同一个函数无需修改即可作用于 `(H, W)`、`(C, H, W)` 或 `(N, C, H, W)`。

### 第 2 步：嵌套循环的二维卷积

参考实现——慢，但无歧义。这就是 `torch.nn.functional.conv2d` 在原理上所做的事情。

```python
def conv2d_naive(x, w, b=None, stride=1, padding=0):
    c_in, h, w_in = x.shape
    c_out, c_in_w, kh, kw = w.shape
    assert c_in == c_in_w

    x_pad = pad2d(x, padding)
    h_out = (h + 2 * padding - kh) // stride + 1
    w_out = (w_in + 2 * padding - kw) // stride + 1

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
```

四层嵌套循环（输出通道、行、列，外加对 C_in、kh、kw 的隐式求和）。这是你用来校验所有更快实现的基准。

### 第 3 步：用手工设计的卷积核验证

构建一个垂直 Sobel 核，将其应用于合成的阶跃图像，观察垂直边缘被点亮。

```python
def synthetic_step_image():
    img = np.zeros((1, 16, 16), dtype=np.float32)
    img[:, :, 8:] = 1.0
    return img

sobel_x = np.array([
    [[-1, 0, 1],
     [-2, 0, 2],
     [-1, 0, 1]]
], dtype=np.float32)[None]

x = synthetic_step_image()
y = conv2d_naive(x, sobel_x, padding=1)
print(y[0].round(1))
```

预期第 7 列（亮度从左到右增加）出现较大的正值，其余全为零。这一次打印就是数学正确性的合理性检查。

### 第 4 步：im2col

把输入中每个卷积核大小的窗口转换成矩阵的一列。对于 `C_in=3, K=3`，每列是 27 个数。

```python
def im2col(x, kh, kw, stride=1, padding=0):
    c_in, h, w = x.shape
    x_pad = pad2d(x, padding)
    h_out = (h + 2 * padding - kh) // stride + 1
    w_out = (w + 2 * padding - kw) // stride + 1

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
```

它仍然是 Python 循环，但现在繁重的工作将变为单次向量化的矩阵乘法。

### 第 5 步：通过 im2col + matmul 实现快速卷积

用一次矩阵乘法替换四重循环。

```python
def conv2d_im2col(x, w, b=None, stride=1, padding=0):
    c_out, c_in, kh, kw = w.shape
    cols, h_out, w_out = im2col(x, kh, kw, stride, padding)
    w_flat = w.reshape(c_out, -1)
    out = w_flat @ cols
    if b is not None:
        out += b[:, None]
    return out.reshape(c_out, h_out, w_out)
```

正确性检查：运行两个实现并比较。

```python
rng = np.random.default_rng(0)
x = rng.normal(0, 1, (3, 16, 16)).astype(np.float32)
w = rng.normal(0, 1, (8, 3, 3, 3)).astype(np.float32)
b = rng.normal(0, 1, (8,)).astype(np.float32)

y_naive = conv2d_naive(x, w, b, padding=1)
y_im2col = conv2d_im2col(x, w, b, padding=1)

print(f"max abs diff: {np.max(np.abs(y_naive - y_im2col)):.2e}")
```

`max abs diff` 应在 `1e-5` 附近——差异来自浮点数累加顺序，而非 bug。

### 第 6 步：一组手工设计的卷积核

五个滤波器，展示单个卷积层在训练之前就能表达什么。

```python
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
```

应用于任何灰度图像：模糊使其柔和，锐化使边缘清晰，Sobel-x 点亮垂直边缘，Sobel-y 点亮水平边缘。这些正是 AlexNet 和 VGG 中*第一个*训练后的卷积层最终学到的模式——因为无论后续任务是什么，好的图像模型都需要边缘和斑点检测器。

## 使用它

PyTorch 的 `nn.Conv2d` 用 autograd、CUDA 内核和 cuDNN 优化封装了同一运算。形状语义完全相同。

```python
import torch
import torch.nn as nn

conv = nn.Conv2d(in_channels=3, out_channels=64, kernel_size=3, stride=1, padding=1)
print(conv)
print(f"weight shape: {tuple(conv.weight.shape)}   # (C_out, C_in, K, K)")
print(f"bias shape:   {tuple(conv.bias.shape)}")
print(f"param count:  {sum(p.numel() for p in conv.parameters())}")

x = torch.randn(8, 3, 224, 224)
y = conv(x)
print(f"\ninput  shape: {tuple(x.shape)}")
print(f"output shape: {tuple(y.shape)}")
```

把 `padding=1` 换成 `padding=0`，输出降到 222x222。把 `stride=1` 换成 `stride=2`，降到 112x112。就是你上面记住的那个公式。

## 发布它

本课产出：

- `outputs/prompt-cnn-architect.md` —— 一个提示，在给定输入尺寸、参数预算和目标感受野时，设计一个由 `Conv2d` 层组成的堆叠，并在每一步选择正确的 K/S/P。
- `outputs/skill-conv-shape-calculator.md` —— 一个技能，逐层遍历网络规格，返回每个块的输出形状、感受野和参数量。

## 练习

1. **（简单）** 给定 128x128 灰度输入和一个 `[Conv3x3(s=1,p=1), Conv3x3(s=2,p=1), Conv3x3(s=1,p=1), Conv3x3(s=2,p=1)]` 堆叠，手工计算每层的输出空间尺寸和感受野。用 PyTorch 的虚拟卷积 `nn.Sequential` 验证。
2. **（中等）** 扩展 `conv2d_naive` 和 `conv2d_im2col` 以接受 `groups` 参数。证明 `groups=C_in=C_out` 可复现 depthwise 卷积，且其参数量是 `C * K * K` 而非 `C * C * K * K`。
3. **（困难）** 手工实现 `conv2d_im2col` 的反向传播：给定输出的梯度，计算 `x` 和 `w` 的梯度。在相同输入和权重下与 `torch.autograd.grad` 对比验证。技巧：im2col 的梯度是 `col2im`，且必须累加重叠窗口。

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|----------------|----------------------|
| 卷积 | "滑动滤波器" | 在每个空间位置以共享权重应用的可学习点积；数学上是互相关，但大家都称之为卷积 |
| 卷积核 / 滤波器 | "特征检测器" | 形状为 (C_in, K, K) 的小权重张量，它与输入窗口的点积产生一个输出像素 |
| 步幅 | "跳多远" | 相邻卷积核放置位置之间的步长；步幅 2 将每个空间维度减半 |
| 填充 | "边缘补零" | 在输入周围添加的额外值，使卷积核可以居中于边界像素；`same` 填充使输出尺寸等于输入尺寸 |
| 感受野 | "神经元能看到多少" | 给定输出激活所依赖的原始输入区域，随深度和步幅增长 |
| im2col | "GEMM 技巧" | 把每个感受野窗口重排成列，使卷积变成一次大矩阵乘法——每个快速卷积内核的核心 |
| Depthwise 卷积 | "每通道一个卷积核" | 设置为 `groups == C_in` 的卷积，每个输出通道仅由对应的输入通道计算；MobileNet 和 ConvNeXt 的骨干 |
| 平移等变性 | "输入移，输出移" | 输入平移 k 个像素则输出平移 k 个像素的性质；由共享权重免费带来 |

## 延伸阅读

- [A guide to convolution arithmetic for deep learning (Dumoulin & Visin, 2016)](https://arxiv.org/abs/1603.07285) —— 关于填充/步幅/膨胀的权威图解，每门课程都悄悄照抄
- [CS231n: Convolutional Neural Networks for Visual Recognition](https://cs231n.github.io/convolutional-networks/) —— 经典讲义，包括最早的 im2col 解释
- [The Annotated ConvNet (fast.ai)](https://nbviewer.org/github/fastai/fastbook/blob/master/13_convolutions.ipynb) —— 一个从手工卷积到训练好的数字分类器的笔记本
- [Receptive Field Arithmetic for CNNs (Dang Ha The Hien)](https://distill.pub/2019/computing-receptive-fields/) —— 论文级质量的感受野计算交互式讲解