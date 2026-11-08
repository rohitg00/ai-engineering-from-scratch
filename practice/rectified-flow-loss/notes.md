## Why the target is x1 minus x0

The path $x_t = (1 - t) x_0 + t x_1$ is a straight line with constant speed. Its derivative with respect to $t$ is $x_1 - x_0$ at every point. The paper shows that the minimizer of this loss is the conditional mean of $x_1 - x_0$ given $x_t$. That field moves the source distribution to the target distribution.

## Why straight paths need few steps

Euler steps follow the tangent of the path. On a straight line the tangent does not change, so one step is exact. The learned field is not exactly straight, because many lines cross at the same $x_t$. The reflow step of the paper trains again on pairs that the model itself generates. The new paths cross less and the sampler needs fewer steps.

## The direction convention

This problem puts the source at $t = 0$ and integrates forward, as in the paper. The lesson puts the data at $t = 0$ and the noise at $t = 1$, and it integrates backward from $t = 1$. The math is the same with the roles of $x_0$ and $x_1$ swapped. Check the convention of a model before you reuse its sampler.

## Where this goes next

The diffusion transformer lesson in phase 4 trains a DiT with this loss. Stable Diffusion 3 and Flux use rectified flow with a logit normal distribution of $t$.
