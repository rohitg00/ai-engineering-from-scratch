## Hint 1

Compute the ratios from the difference of the log probabilities. Do not compute `np.exp(logp_new) / np.exp(logp_old)`, because both exponentials can be 0.

## Hint 2

`np.clip(r, 1 - eps, 1 + eps)` gives the clipped ratio. `np.minimum` takes the smaller term for each sample. PPO maximizes the mean of the min, so the loss is minus that mean.

## Hint 3

Make one boolean mask for the clipped samples. Use it for the clip fraction and for the gradient. The fraction is the mean of the mask.

## Hint 4

On an unclipped sample the term is $r A$, and $dr / d\log\pi_{new} = r$. On a clipped sample the term is a constant. So the gradient is $-r A / N$ or 0. `np.where` selects between the two.
