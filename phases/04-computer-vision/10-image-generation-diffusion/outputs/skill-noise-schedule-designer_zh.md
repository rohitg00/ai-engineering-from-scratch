---
name: skill-noise-schedule-designer
description: 给定 T 和目标破坏水平，生成线性、余弦或 sigmoid beta 调度及 SNR 图
version: 1.0.0
phase: 4
lesson: 10
tags: [computer-vision, diffusion, noise-schedule, training]
---

# 噪声调度设计器（Noise Schedule Designer）

Beta 调度控制每个扩散步骤保留多少信号。糟糕的调度会限制训练效率和每个下游决策中的样本质量。

## 何时使用

- 开始新的扩散训练运行，选择 T 和 beta。
- 调试产生模糊样本（调度过于激进）或未能学习结构（调度过于温和）的扩散模型。
- 比较报告不同调度的论文之间的设计。

## 输入

- `T`：时间步数，通常为 100-1000。
- `type`：linear（线性）| cosine（余弦）| sigmoid（S 型）。
- `target_alpha_bar_final`：t=T 时保留的信号比例，默认为 0.001（99.9% 破坏）。
- 可选 `image_resolution`——较大图像受益于更慢破坏的调度（余弦或偏移调度）。

## 调度公式

### 线性
```
beta_t = beta_start + (beta_end - beta_start) * (t - 1) / (T - 1)
```
默认值：beta_start=1e-4, beta_end=0.02（DDPM 论文）。

### 余弦（Nichol & Dhariwal, 2021）
```
alpha_bar_t = cos^2((t/T + s) / (1 + s) * pi/2)
beta_t = 1 - alpha_bar_t / alpha_bar_{t-1}
```
s = 0.008。信号保持时间更长；在低步数时表现更好。

### Sigmoid
```
alpha_bar_t = 1 / (1 + exp(k * (t/T - 0.5)))
```
k = 6 到 12。良好的折衷方案；某些 SDXL 变体使用。

## 步骤

1. 根据公式计算 betas。
2. 预计算 `alphas`、`alphas_cumprod`、`sqrt_alphas_cumprod`、`sqrt_one_minus_alphas_cumprod`。
3. 计算 SNR_t = alpha_bar_t / (1 - alpha_bar_t)；生成 SNR 随时间变化摘要。
4. 验证 `alphas_cumprod[T-1]` 在 `target_alpha_bar_final` 的 10% 范围内；否则调整 beta_end（线性）、s（余弦）或 k（sigmoid）并重试。
5. 报告三个检查点：
   - `t=T*0.25` — 早期破坏
   - `t=T*0.5` — 中途
   - `t=T*0.75` — 接近最终

## 报告

```
[schedule]
  type:   <名称>
  T:      <整数>
  beta_start: <浮点数>   beta_end: <浮点数>

[signal retention]
  t=0.25T:  alpha_bar=<X>  SNR=<X>
  t=0.5T:   alpha_bar=<X>  SNR=<X>
  t=0.75T:  alpha_bar=<X>  SNR=<X>
  t=T:      alpha_bar=<X>  SNR=<X>

[warnings]
  - <如果 alpha_bar 在 0.75T 之前崩溃>
  - <如果 beta_end 在 log-SNR 中产生 NaN>
```

## 规则

- 绝不发出任何 `alpha_bar_t <= 0` 的调度；将值钳制在 1e-5 以下并发出警告。
- 对于低步数采样（< 30 步），余弦是默认推荐。
- 对于 `quality_target == research`，线性是默认推荐——DDPM 基线使用线性调度报告。
- 当 `image_resolution > 256` 时，建议偏移调度（Chen, 2023）以在高分辨率下保留更多信号。
