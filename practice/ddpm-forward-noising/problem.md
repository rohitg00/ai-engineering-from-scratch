A diffusion model learns to remove noise. To train it, you add a known amount of Gaussian noise to clean data. DDPM fixes this forward process with a schedule of small noise steps. You can jump to any step in closed form, and you can compute the exact posterior of one reverse step when you know the clean data.

## Task

Write three functions. Timesteps start at 0: $t = 0, 1, \ldots, T - 1$.

1. `make_schedule(T, beta_start=1e-4, beta_end=0.02)` returns `(betas, alphas, alpha_bars)`.
2. `q_sample(x0, t, alpha_bars, noise)` returns a sample of $x_t$ given $x_0$.
3. `posterior_mean_variance(x0, x_t, t, betas, alpha_bars)` returns the mean and the variance of $q(x_{t-1} \mid x_t, x_0)$.

**Schedule.** The betas are linear: $\beta_t = \beta_{start} + (\beta_{end} - \beta_{start}) \cdot t / (T - 1)$. So $\beta_0 = \beta_{start}$ and $\beta_{T-1} = \beta_{end}$. Then $\alpha_t = 1 - \beta_t$ and $\bar{\alpha}_t = \prod_{s=0}^{t} \alpha_s$.

**Closed form sample.** With the given noise $\epsilon$:

$$x_t = \sqrt{\bar{\alpha}_t}\, x_0 + \sqrt{1 - \bar{\alpha}_t}\, \epsilon$$

**Posterior.** Define $\bar{\alpha}_{t-1} = 1$ when $t = 0$. Then

$$\tilde{\mu}_t = \frac{\sqrt{\bar{\alpha}_{t-1}}\, \beta_t}{1 - \bar{\alpha}_t}\, x_0 + \frac{\sqrt{\alpha_t}\, (1 - \bar{\alpha}_{t-1})}{1 - \bar{\alpha}_t}\, x_t, \qquad \tilde{\beta}_t = \frac{1 - \bar{\alpha}_{t-1}}{1 - \bar{\alpha}_t}\, \beta_t$$

**Timesteps.** `t` is an int or an int array of shape `(B,)`. When `t` is an array, item `b` of the batch is `x0[b]` and it uses timestep `t[b]`. The coefficients then broadcast over all the axes after the first.

## Input and output

| Name | Type | Shape | Meaning |
|---|---|---|---|
| `T` | int | | the number of steps |
| `beta_start`, `beta_end` | float | | the first and the last beta |
| `x0` | float array | `(B, ...)` or any shape when `t` is an int | the clean data |
| `x_t` | float array | same as `x0` | the noisy data at step `t` |
| `noise` | float array | same as `x0` | the Gaussian noise $\epsilon$ |
| `t` | int or int array | scalar or `(B,)` | the timestep of each item |
| `betas`, `alpha_bars` | float array | `(T,)` | the schedule from `make_schedule` |

- `make_schedule` returns three float arrays of shape `(T,)`.
- `q_sample` returns a float array with the shape of `x0`.
- `posterior_mean_variance` returns a tuple `(mean, variance)`. `mean` has the shape of `x0`. `variance` is a float when `t` is an int. When `t` is an array, `variance` has shape `(B, 1, ...)` and broadcasts against `x0`.

## Constraints

- `2 <= T <= 1000` and `0 < beta_start < beta_end < 1`.
- `0 <= t <= T - 1`.
- Do not change the input arrays.
- Use numpy only.

## Examples

```python
betas, alphas, alpha_bars = make_schedule(5, 0.1, 0.5)
```

```text
betas      [0.1 0.2 0.3 0.4 0.5]
alphas     [0.9 0.8 0.7 0.6 0.5]
alpha_bars [0.9    0.72   0.504  0.3024 0.1512]
```

```python
x0 = np.array([1.0, -2.0])
noise = np.array([0.5, 0.5])
x_t = q_sample(x0, 2, alpha_bars, noise)
mean, variance = posterior_mean_variance(x0, x_t, 2, betas, alpha_bars)
```

```text
x_t      [ 1.06206591 -1.06772281]
mean     [ 1.01484497 -1.53073944]
variance 0.1693548387096774
```
