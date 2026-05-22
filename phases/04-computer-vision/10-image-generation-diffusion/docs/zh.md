# 图像生成 — 扩散模型（Diffusion Models）

> 扩散模型学习去噪。训练它从噪声图像中去除一点点噪声，重复这个过程一千次，你就得到了一个图像生成器。

**类型：** 构建
**语言：** Python
**前置知识：** 阶段4 第7课（U-Net），阶段1 第6课（概率论），阶段3 第6课（优化器）
**时长：** ~75分钟

## 学习目标

- 推导前向加噪过程 `x_0 -> x_1 -> ... -> x_T`，并解释为何闭合形式 `q(x_t | x_0)` 对任意 t 成立
- 实现一个 DDPM 风格训练目标，回归每一步添加的噪声，以及一个从纯噪声逐步反向采样为图像的方法
- 构建一个时间条件 U-Net（足够小可在 CPU 上训练），用于预测任意时间步的噪声
- 解释 DDPM 与 DDIM 采样的区别，以及各自适用场景（第23课深入介绍流匹配（Flow Matching）和整流流（Rectified Flow））

## 问题背景

GAN 一次性生成：输入噪声，输出图像，单次前向传播。它们速度快但难以训练。扩散模型迭代生成：从纯噪声开始，用小步去噪，图像逐渐显现。它们速度慢但易于训练。在过去五年中，后者特性占据主导：任何小型团队都可以训练扩散模型并获得合理的样本；而 GAN 训练是需要多年失败经验才能掌握的技艺。

除了训练稳定性，扩散模型的迭代结构正是现代图像生成所有功能的基础：文本条件、图像修复（Inpainting）、图像编辑、超分辨率、可控风格。采样循环的每一步都是注入新约束的节点。这就是为什么 Stable Diffusion、Imagen、DALL-E 3、Midjourney 以及你将要使用的每一个可控图像模型都基于扩散模型。

本节课构建最小化的 DDPM：前向加噪、反向去噪、训练循环。下一节课（Stable Diffusion）将把它接入一个包含 VAE、文本编码器和无分类器引导（Classifier-Free Guidance）的生产系统。

## 核心概念

### 前向过程

取一张图像 `x_0`。添加微量高斯噪声得到 `x_1`。再添加微量噪声得到 `x_2`。持续进行 T 步，直到 `x_T` 几乎无法与纯高斯噪声区分。

```
q(x_t | x_{t-1}) = N(x_t; sqrt(1 - beta_t) * x_{t-1},  beta_t * I)
```

`beta_t` 是一个小方差调度（Schedule），通常从 0.0001 线性增长到 0.02，总步数 T=1000。每一步稍微缩小原始信号并注入新噪声。

### 闭合形式跳跃

一步一步添加噪声是一个马尔可夫链（Markov Chain），但数学上可以折叠：你可以直接从 `x_0` 一步采样得到 `x_t`。

```
定义 alpha_t = 1 - beta_t
定义 alpha_bar_t = prod_{s=1..t} alpha_s

那么：
  q(x_t | x_0) = N(x_t; sqrt(alpha_bar_t) * x_0,  (1 - alpha_bar_t) * I)

等价地：
  x_t = sqrt(alpha_bar_t) * x_0 + sqrt(1 - alpha_bar_t) * epsilon
  其中 epsilon ~ N(0, I)
```

这一单一方程是整个扩散模型变得实用的全部原因。训练时，你随机选择一个 `t`，直接从 `x_0` 采样 `x_t`，并一步完成训练——无需模拟完整的马尔可夫链。

### 反向过程

前向过程是固定的。反向过程 `p(x_{t-1} | x_t)` 是神经网络需要学习的。扩散模型不直接预测 `x_{t-1}`，而是预测在步骤 t 添加的噪声 `epsilon`，然后通过数学推导得到 `x_{t-1}`。

```mermaid
flowchart LR
    X0["x_0<br/>(干净图像)"] --> Q1["q(x_t|x_0)<br/>添加噪声"]
    Q1 --> XT["x_t<br/>(噪声图像)"]
    XT --> MODEL["model(x_t, t)"]
    MODEL --> EPS["预测的 epsilon"]
    EPS --> LOSS["与真实 epsilon<br/>的 MSE"]

    XT -.->|采样| STEP["p(x_{t-1}|x_t)"]
    STEP -.-> XT1["x_{t-1}"]
    XT1 -.->|重复 1000 次| X0S["x_0 (采样图像)"]

    style X0 fill:#dcfce7,stroke:#16a34a
    style MODEL fill:#fef3c7,stroke:#d97706
    style LOSS fill:#fecaca,stroke:#dc2626
    style X0S fill:#dbeafe,stroke:#2563eb
```

### 训练损失

每个训练步骤：

1. 采样一张真实图像 `x_0`。
2. 从 [1, T] 均匀采样一个时间步 `t`。
3. 采样噪声 `epsilon ~ N(0, I)`。
4. 计算 `x_t = sqrt(alpha_bar_t) * x_0 + sqrt(1 - alpha_bar_t) * epsilon`。
5. 用网络预测 `epsilon_theta(x_t, t)`。
6. 最小化 `|| epsilon - epsilon_theta(x_t, t) ||^2`。

就这样。神经网络学会在任意时间步预测噪声。损失函数是 MSE（均方误差）。没有对抗博弈，没有模式崩溃，没有振荡。

### 采样器（DDPM）

生成过程：从 `x_T ~ N(0, I)` 开始，然后一步一步反向走回去。

```
for t = T, T-1, ..., 1:
    eps = model(x_t, t)
    x_{t-1} = (1 / sqrt(alpha_t)) * (x_t - (beta_t / sqrt(1 - alpha_bar_t)) * eps) + sqrt(beta_t) * z
    其中 z ~ N(0, I) 如果 t > 1，否则为 0
return x_0
```

关键在于，尽管反向条件通常没有闭合形式，但对于这个特定的高斯前向过程，它确实存在。这些看起来丑陋的系数正是贝叶斯规则给出的结果。

### 为什么是 1000 步

前向噪声调度（Noise Schedule）的设计使得每一步添加的噪声恰好足够小，以至于反向步接近于高斯分布。步数太少，反向步远离高斯分布，网络难以良好建模。步数太多，采样成本过高而收益递减。T=1000 配合线性调度是 DDPM 的默认设置。

### DDIM：快 20 倍的采样

训练过程相同。采样方式改变。DDIM（Song et al., 2020）定义了一个确定性的反向过程，可以在不重新训练的情况下跳过时间步。使用 DDIM 进行 50 步采样，质量接近 DDPM 的 1000 步采样。每个生产系统都使用 DDIM 或更快的变体（DPM-Solver、Euler ancestral）。

### 时间条件

网络 `epsilon_theta(x_t, t)` 需要知道当前去噪的步数。现代扩散模型通过正弦时间嵌入（Sinusoidal Time Embedding）（与 Transformer 中的位置编码（Positional Encoding）思想相同）注入 `t`，该嵌入被添加到 U-Net 的每个层级特征图中。

```
t_embedding = sinusoidal(t)
feature_map += MLP(t_embedding)
```

如果没有时间条件，网络必须从图像本身猜测噪声水平，这虽然可行，但样本效率低得多。

## 动手构建

### 第一步：噪声调度

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

预计算一次，训练和采样时按索引取值。

### 第二步：前向扩散（q_sample）

```python
def q_sample(x0, t, noise, schedule):
    sqrt_a = schedule["sqrt_alphas_cumprod"][t].view(-1, 1, 1, 1)
    sqrt_one_minus_a = schedule["sqrt_one_minus_alphas_cumprod"][t].view(-1, 1, 1, 1)
    return sqrt_a * x0 + sqrt_one_minus_a * noise
```

一步闭合形式。`t` 是一批时间步，每个图像对应一个时间步。

### 第三步：微型时间条件 U-Net

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

两层 U-Net，时间条件在瓶颈处注入。对于真实图像，需要增加深度和宽度。

### 第四步：训练循环

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

这就是完整的训练循环。没有 GAN 的对抗博弈，没有特殊损失，只有一次 MSE 调用。

### 第五步：采样器（DDPM）

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

1000 次前向传播产生一批样本。在实际代码中，你会用 DDIM 的 50 步采样器替换它。

### 第六步：DDIM 采样器（确定性，约快 20 倍）

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

`eta=0` 是完全确定性的（相同的噪声输入总是产生相同的输出）。`eta=1` 恢复 DDPM。

## 使用它

对于生产工作，请使用 `diffusers`：

```python
from diffusers import DDPMScheduler, UNet2DModel

unet = UNet2DModel(sample_size=32, in_channels=3, out_channels=3, layers_per_block=2)
scheduler = DDPMScheduler(num_train_timesteps=1000)
```

该库提供了现成的调度器（DDPM、DDIM、DPM-Solver、Euler、Heun）、可配置的 U-Net、用于文本到图像和图像到图像的管道（Pipeline），以及 LoRA 微调辅助工具。

对于研究，`k-diffusion`（Katherine Crowson）拥有最忠实的参考实现和最好的采样变体。

## 产出

本节课产出：

- `outputs/prompt-diffusion-sampler-picker.md` — 一个提示词（Prompt），根据质量目标、延迟预算和条件类型选择 DDPM / DDIM / DPM-Solver / Euler。
- `outputs/skill-noise-schedule-designer.md` — 一个技能（Skill），根据给定 T 和目标损坏程度生成线性、余弦或 sigmoid beta 调度，并附带信噪比（SNR）随时间变化的诊断图。

## 练习

1. **（简单）** 可视化前向过程：取一张图像，绘制 `t in [0, 100, 250, 500, 750, 1000]` 时的 `x_t`。验证 `x_1000` 看起来像纯高斯噪声。
2. **（中等）** 在合成圆圈数据集上训练 TinyUNet 20 个 epoch，并采样 16 个圆圈。比较 DDPM（1000 步）和 DDIM（50 步）采样——它们从相同的噪声种子生成相似的图像吗？
3. **（困难）** 实现余弦噪声调度（Nichol & Dhariwal, 2021）：`alpha_bar_t = cos^2((t/T + s) / (1 + s) * pi / 2)`。用线性调度和余弦调度分别训练同一个模型，并展示余弦调度在低步数时能产生更好的样本。

## 关键术语（Key Terms）

| 术语（Term） | 大家说的 | 实际含义 |
|------|----------------|----------------------|
| 前向过程（Forward process） | “随时间添加噪声” | 固定的马尔可夫链，在 T 步内将图像破坏为高斯噪声 |
| 反向过程（Reverse process） | “逐步去噪” | 学习到的分布，从噪声逐步走回图像 |
| 噪声预测（Epsilon prediction） | “预测噪声” | 训练目标：`epsilon_theta(x_t, t)` 预测第 t 步添加的噪声 |
| Beta 调度（Beta schedule） | “噪声量” | T 个小方差的序列，定义每步注入多少噪声 |
| alpha_bar_t | “累积保留因子” | 