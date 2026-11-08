## Why dx has three terms

The first term is the direct path through $\hat{x}$. The second term removes the mean of $g$ over the batch, because each $x_{ij}$ also moves $\mu_j$. The third term removes the part of $g$ along $\hat{x}$, because each $x_{ij}$ also moves $\sigma^2_j$. For this reason, each column of `dx` sums to 0, and `dx` is orthogonal to $\hat{x}$ in each column.

## Why eps goes inside the square root

$\sqrt{\sigma^2 + \epsilon}$ is at least $\sqrt{\epsilon}$, so the division is safe when a feature is constant. $\sqrt{\sigma^2} + \epsilon$ also avoids a division by 0, but it gives a different output when the variance is close to $\epsilon$. Frameworks use the first form.

## Biased or unbiased variance

The lesson and this problem use the biased variance for the running statistics. Some frameworks store the unbiased variance, with $N - 1$, in the running statistics. The normalization of the batch uses the biased variance in both cases. Check this detail when you load weights from another framework.

## Training and inference

The forward pass depends on the mode. A model that stays in training mode at test time gives outputs that change with the other examples in the batch. This is a common bug. The `model.train()` and `model.eval()` calls in the lesson switch this mode.

## Where this goes next

LayerNorm uses the same formula over the feature axis of each example. It needs no running statistics, so training and inference are the same. Transformers use LayerNorm or RMSNorm for this reason.
