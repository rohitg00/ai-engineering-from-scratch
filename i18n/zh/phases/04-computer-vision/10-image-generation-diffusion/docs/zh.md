# 图像生成 — 扩散模型

> 扩散模型学习去噪。训练它从含噪图像中去除一点点噪声，反向重复一千次，你就得到了一个图像生成器。

**Type:** Build
**Languages:** Python
**Prerequisites:** Phase 4 Lesson 07（U-Net）、Phase 1 Lesson 06（概率）、Phase 3 Lesson 06（优化器）
**Time:** 约 75 分钟

## 学习目标

- 推导前向加噪过程 `x_0 -> x_1 -> ... -> x_T`，并解释为什么闭式解 `q(x_t | x_0)` 对任意 t 都成立
- 实现一个 DDPM 风格的训练目标，对每一步加入的噪声做回归，并实现一个从纯噪声逐步回溯到图像的采样器
- 构建一个时间条件化的 U-Net（小到可以在 CPU 上训练），为任意时间步预测噪声
- 解释 DDPM 与 DDIM 采样的区别，以及各自适用的场景（Lesson 23 深入讲解 flow matching 和 rectified flow）

## 问题所在

GAN 是一次性生成的：噪声进，图像出，只需一次前向传播。它们速度快，但难以训练。扩散模型是迭代式生成的：从纯噪声开始，小步去噪，图像逐渐浮现。它们速度慢，但易于训练。过去五年，后一特性占据了主导地位：任何小团队都能训练扩散模型并获得合理的样本；而 GAN 训练是一门需要多年失败运行才能习得的手艺。

除了训练稳定性，扩散的迭代结构还解锁了现代图像生成的一切能力：文本条件化、图像修补（inpainting）、图像编辑、超分辨率、可控风格。采样循环的每一步都是注入新约束的位置。正因如此，Stable Diffusion、Imagen、DALL-E 3、Midjourney 以及你将使用的每一个可控图像模型都基于扩散。

本课构建最简 DDPM：前向加噪、反向去噪、训练循环。下一课（Stable Diffusion）将其接入一个带有 VAE、文本编码器和 classifier-free guidance 的生产系统。

## 核心概念

### 前向过程

取一张图像 `x_0`。加入少量高斯噪声得到 `x_1`。再加一点得到 `x_2`。如此持续 T 步，直到 `x_T` 与纯高斯噪声几乎无法区分。

```
q(x_t | x_{t-1}) = N(x_t; sqrt(1 - beta_t) * x_{t-1},  beta_t * I)
```

`beta_t` 是一个小的方差调度，通常在 T=1000 步内从 0.0001 线性增长到 0.02。每一步都略微削弱信号并注入新噪声。

### 闭式跳跃

逐步加噪是一个马尔可夫链，但数学上可以折叠：你可以一步直接从 `x_0` 采样得到 `x_t`。

```
Define alpha_t = 1 - beta_t
Define alpha_bar_t = prod_{s=1..t} alpha_s

Then:
  q(x_t | x_0) = N(x_t; sqrt(alpha_bar_t) * x_0,  (1 - alpha_bar_t) * I)

Equivalently:
  x_t = sqrt(alpha_bar_t) * x_0 + sqrt(1 - alpha_bar_t) * epsilon
  where epsilon ~ N(0, I)
```

这个单一等式是扩散模型实用化的全部原因。训练时你随机选取一个 `t`，直接从 `x_0` 采样 `x_t`，一步完成训练——无需模拟完整的马尔可夫链。

### 反向过程

前向过程是固定的。反向过程 `p(x_{t-1} | x_t)` 才是神经网络要学习的内容。扩散模型并不直接预测 `x_{t-1}`；它们预测第 t 步加入的噪声 `epsilon`，再由数学推导出 `x_{t-1}`。

```mermaid
flowchart LR
    X0["x_0<br/>(clean image)"] --> Q1["q(x_t|x_0)<br/>add noise"]
    Q1 --> XT["x_t<br/>(noisy)"]
    XT --> MODEL["model(x_t, t)"]
    MODEL --> EPS["predicted epsilon"]
    EPS --> LOSS["MSE against<br/>true epsilon"]

    XT -.->|sampling| STEP["p(x_{t-1}|x_t)"]
    STEP -.-> XT1["x_{t-1}"]
    XT1 -.->|repeat 1000x| X0S["x_0 (sampled)"]

    style X0 fill:#dcfce7,stroke:#16a34a
    style MODEL fill:#fef3c7,stroke:#d97706
    style LOSS fill:#fecaca,stroke:#dc2626
    style X0S fill:#dbeafe,stroke:#2563eb
```

### 训练损失

每个训练步骤：

1. 采样一张真实图像 `x_0`。
2. 从 [1, T] 中均匀采样一个时间步 `t`。
3. 采样噪声 `epsilon ~ N(0, I)`。
4. 计算 `x_t = sqrt(alpha_bar_t) * x_0 + sqrt(1 - alpha_bar_t) * epsilon`。
5. 用网络预测 `epsilon_theta(x_t, t)`。
6. 最小化 `|| epsilon - epsilon_theta(x_t, t) ||^2`。

就这么简单。神经网络学会预测任意时间步的噪声。损失就是 MSE。没有对抗博弈、没有崩溃、没有震荡。

### 采样器（DDPM）

生成时：从 `x_T ~ N(0, I)` 开始，逐步向后走。

```
for t = T, T-1, ..., 1:
    eps = model(x_t, t)
    x_{t-1} = (1 / sqrt(alpha_t)) * (x_t - (beta_t / sqrt(1 - alpha_bar_t)) * eps) + sqrt(beta_t) * z
    where z ~ N(0, I) if t > 1, else 0
return x_0
```

关键在于，尽管反向条件分布在一般情况下没有闭式解，但对于这个特定的高斯前向过程，它有。那些看起来很丑的系数就是贝叶斯法则给你的结果。

### 为什么是 1000 步

前向噪声调度的选择标准是：每一步加入的噪声恰好使反向步骤接近高斯。步数太少，反向步骤就远离高斯，网络难以建模。步数太多，采样变得昂贵且收益递减。T=1000 配合线性调度是 DDPM 的默认设置。

### DDIM：快 20 倍的采样

训练方式相同。采样方式改变。DDIM（Song et al., 2020）定义了一个确定性的反向过程，可以在不重新训练的情况下跳过时间步。用 DDIM 采样 50 步即可获得接近 1000 步 DDPM 的质量。每个生产系统都使用 DDIM 或更快的变体（DPM-Solver、Euler ancestral）。

### 时间条件化

网络 `epsilon_theta(x_t, t)` 需要知道它正在为哪个时间步去噪。现代扩散模型通过正弦时间嵌入（与 Transformer 中的位置编码思想相同）注入 `t`，将其添加到 U-Net 每一层的特征图上。

```
t_embedding = sinusoidal(t)
feature_map += MLP(t_embedding)
```

没有时间条件化，网络必须从图像本身猜测噪声水平，虽然可行，但样本效率低得多。

```figure
cv-diffusion-image
```

## 动手构建

### 步骤 1：噪声调度

```python
import torch

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

schedule = precompute_schedule(linear_beta_schedule(T=1000))
```

预先计算一次，训练和采样时按索引取用。

### 步骤 2：前向扩散（q_sample）

```python
def q_sample(x0, t, noise, schedule):
    sqrt_a = schedule["sqrt_alphas_cumprod"][t].view(-1, 1, 1, 1)
    sqrt_one_minus_a = schedule["sqrt_one_minus_alphas_cumprod"][t].view(-1, 1, 1, 1)
    return sqrt_a * x0 + sqrt_one_minus_a * noise
```

一行闭式解。`t` 是一批时间步，批次中的每张图像对应一个。

### 步骤 3：一个微型时间条件化 U-Net

```python
import torch.nn as nn
import torch.nn.functional as F
import math

def timestep_embedding(t, dim=64):
    half = dim // 2
    freqs = torch.exp(-math.log(10000) * torch.arange(half, device=t.device) / half)
    args = t[:, None].float() * freqs[None]
    emb = torch.cat([args.sin(), args.cos()], dim=-1)
    return emb


class TinyUNet(nn.Module):
    def __init__(self, img_channels=3, base=32, t_dim=64):
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
        t_emb = timestep_embedding(t, self.t_dim)
        t_emb = self.t_mlp(t_emb)
        t_proj = self.time_proj(t_emb)[:, :, None, None]

        h1 = F.silu(self.enc1(x))
        h2 = F.silu(self.enc2(h1)) + t_proj
        h3 = F.silu(self.mid(h2))
        d1 = F.silu(self.dec1(h3))
        d2 = torch.cat([d1, h1], dim=1)
        return self.dec2(d2)
```

带时间条件化（注入瓶颈处）的两层 U-Net。处理真实图像时，扩大深度和宽度即可。

### 步骤 4：训练循环

```python
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
```

这就是完整的训练循环。没有 GAN 博弈，没有特殊损失，只需一次 MSE 调用。

### 步骤 5：采样器（DDPM）

```python
@torch.no_grad()
def sample(model, schedule, shape, T=1000, device="cpu"):
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
```

1000 次前向传播生成一批样本。在实际代码中，你会把它换成 50 步的 DDIM 采样器。

### 步骤 6：DDIM 采样器（确定性，约快 20 倍）

```python
@torch.no_grad()
def sample_ddim(model, schedule, shape, steps=50, T=1000, device="cpu", eta=0.0):
    model.eval()
    x = torch.randn(shape, device=device)
    alphas_cumprod = schedule["alphas_cumprod"].to(device)

    ts = torch.linspace(T - 1, 0, steps + 1).long()
    for i in range(steps):
        t = ts[i]
        t_prev = ts[i + 1]
        t_batch = torch.full((shape[0],), t, dtype=torch.long, device=device)
        eps = model(x, t_batch)
        a_t = alphas_cumprod[t]
        a_prev = alphas_cumprod[t_prev] if t_prev >= 0 else torch.tensor(1.0, device=device)
        x0_pred = (x - torch.sqrt(1 - a_t) * eps) / torch.sqrt(a_t)
        sigma = eta * torch.sqrt((1 - a_prev) / (1 - a_t) * (1 - a_t / a_prev))
        dir_xt = torch.sqrt(1 - a_prev - sigma ** 2) * eps
        noise = sigma * torch.randn_like(x) if eta > 0 else 0
        x = torch.sqrt(a_prev) * x0_pred + dir_xt + noise
    return x
```

`eta=0` 是完全确定性的（相同的噪声输入总是产生相同的输出）。`eta=1` 则退化为 DDPM。

## 使用它

生产环境请使用 `diffusers`：

```python
from diffusers import DDPMScheduler, UNet2DModel

unet = UNet2DModel(sample_size=32, in_channels=3, out_channels=3, layers_per_block=2)
scheduler = DDPMScheduler(num_train_timesteps=1000)
```

该库提供开箱即用的调度器（DDPM、DDIM、DPM-Solver、Euler、Heun）、可配置的 U-Net、text-to-image 和 image-to-image 的 pipeline，以及 LoRA 微调辅助工具。

做研究时，`k-diffusion`（Katherine Crowson）拥有最忠实于论文的参考实现和最佳的采样变体。

## 发布成果

本课产出：

- `outputs/prompt-diffusion-sampler-picker.md` — 一个根据质量目标、延迟预算和条件化类型选择 DDPM / DDIM / DPM-Solver / Euler 的提示词。
- `outputs/skill-noise-schedule-designer.md` — 一个技能：给定 T 和目标破坏程度，生成线性、余弦或 sigmoid beta 调度，并附上信噪比随时间变化的诊断图。

## 练习

1. **（简单）** 可视化前向过程：取一张图像，在 `t in [0, 100, 250, 500, 750, 1000]` 处绘制 `x_t`。验证 `x_1000` 看起来像纯高斯噪声。
2. **（中等）** 在合成圆圈数据集上训练 TinyUNet 20 个 epoch，并采样 16 个圆圈。比较 DDPM（1000 步）和 DDIM（50 步）的采样结果——在相同噪声种子下，它们产生的图像相似吗？
3. **（困难）** 实现余弦噪声调度（Nichol & Dhariwal, 2021）：`alpha_bar_t = cos^2((t/T + s) / (1 + s) * pi / 2)`。分别用线性调度和余弦调度训练同一模型，并展示余弦调度在低步数下能产生更好的样本。

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|----------------|----------------------|
| 前向过程 | “随时间加噪” | 固定的马尔可夫链，在 T 步内将图像破坏为高斯噪声 |
| 反向过程 | “逐步去噪” | 学到的分布，从噪声回溯到图像 |
| Epsilon 预测 | “预测噪声” | 训练目标：`epsilon_theta(x_t, t)` 预测第 t 步加入的噪声 |
| Beta 调度 | “噪声量” | T 个小方差的序列，定义每步注入多少噪声 |
| alpha_bar_t | “累积保留因子” | 到时间 t 为止 (1 - beta_s) 的乘积；t 越大，剩余信号越少 |
| DDPM 采样器 | “ ancestral，随机” | 从其条件高斯分布中采样每个 x_{t-1}；1000 步 |
| DDIM 采样器 | “确定性，快速” | 将采样重写为确定性 ODE；20-100 步即可达到相近质量 |
| 时间条件化 | “告诉模型是哪个 t” | 将 t 的正弦嵌入注入 U-Net，使其知晓噪声水平 |

## 延伸阅读

- [Denoising Diffusion Probabilistic Models (Ho et al., 2020)](https://arxiv.org/abs/2006.11239) — 使扩散模型实用化并在 FID 上击败 GAN 的论文
- [Improved DDPM (Nichol & Dhariwal, 2021)](https://arxiv.org/abs/2102.09672) — 余弦调度与 v-parameterisation
- [DDIM (Song, Meng, Ermon, 2020)](https://arxiv.org/abs/2010.02502) — 使实时推理成为可能的确定性采样器
- [Elucidating the Design Space of Diffusion (Karras et al., 2022)](https://arxiv.org/abs/2206.00364) — 对所有扩散设计选择的统一视角；当前最佳参考