## Why bias correction

The moments start at 0. After one step, $m = (1 - \beta_1) g$, which is only a tenth of the gradient for $\beta_1 = 0.9$. For $v$ with $\beta_2 = 0.999$ the start value is a thousandth of $g^2$. The division by $1 - \beta^t$ removes this bias exactly when the gradient is constant. Without it, the first steps are wrong in size, and the error in $v$ is the larger one.

## Why the first step has size lr

At $t = 1$, $\hat m = g$ and $\hat v = g^2$. The update is $\eta g / (|g| + \epsilon)$, which is about $\eta$ times the sign of $g$. Adam is invariant to the scale of the gradient. This is why one learning rate works for parameters with very different gradient sizes.

## Decoupled weight decay

L2 regularization adds $\lambda \theta$ to the gradient. In Adam that term then passes through the division by $\sqrt{\hat v}$, so parameters with large gradients get almost no decay. AdamW applies the decay directly to the parameters. Every parameter then shrinks by the same factor $1 - \eta \lambda$ at each step.

## Where this goes next

AdamW with warmup and cosine decay is the default optimizer for transformers in the later phases. The learning rate schedules lesson changes $\eta$ at each step around this same update.
