## Hint 1

Use `axis=-1` and `keepdims=True` for the mean and the standard deviation of each group. `np.std` divides by $G$ by default, which is what the task asks for.

## Hint 2

In the log domain the ratio $\pi_{ref} / \pi_\theta$ is `exp(ref_logp - logp)`. The log of that ratio is `ref_logp - logp`.

## Hint 3

Give the advantages a token axis with `advantages[:, None]`, so that they broadcast over `L`. Compute the unclipped and the clipped surrogate and take `np.minimum`.

## Hint 4

Convert the mask to float. Multiply the per token values by it, sum over axis 1, and divide by the number of valid tokens of each answer. Then take the mean over the answers.
