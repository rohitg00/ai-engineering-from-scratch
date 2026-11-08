## Hint 1

Let $s = x$ when $y = 1$ and $s = -x$ when $y = 0$. Then $p_t = \sigma(s)$ in both cases, and one formula covers every example.

## Hint 2

$\log \sigma(s) = -\log(1 + e^{-s})$, which is `-np.logaddexp(0.0, -s)`. In the same way, $1 - \sigma(s) = \sigma(-s)$. These forms stay finite for logits of 1000.

## Hint 3

For the gradient, use $dp_t / ds = p_t (1 - p_t)$. The factor $(1 - p_t)^\gamma$ also depends on $s$, so the product rule gives two terms: $\frac{d \mathrm{FL}}{ds} = \alpha_t (1 - p_t)^\gamma \left(\gamma \, p_t \log p_t - (1 - p_t)\right)$.

## Hint 4

Multiply by $ds/dx$, which is $+1$ for $y = 1$ and $-1$ for $y = 0$. Divide by $N$, because the loss is a mean.
