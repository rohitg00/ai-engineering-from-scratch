## What the sweep shows

The final loss falls as the rate grows, from 1.29 at 0.001 to 0.0104 at 0.2. At 0.3 every run blows up. The theory bound is 0.2277, so the best rate on the grid is the largest rate below the bound. This is a common result: the best constant rate is close to the edge of stability.

## Why the bound is exact here

The loss is a quadratic in $w$. Gradient descent moves the error along each eigenvector of the Hessian by a factor of $1 - \eta \lambda_i$ per step. When $\eta > 2 / \lambda_{max}$, that factor has a magnitude above 1 for the largest eigenvalue, and the error grows each step. The feature with scale 2 gives the largest eigenvalue, so it sets the bound for all the weights.

## The trap

A sweep that stores `nan` for a diverged run and then calls `np.argmin` reports the diverged rate as the best one. Mark the diverged runs first. A finite loss that ends above its start is also a divergence.

## Where this goes next

A neural network has no single fixed Hessian, so the bound moves during training. That is one reason for warmup and decay in the learning rate schedule lesson, and the reason that the LR range test sweeps rates during one run.
