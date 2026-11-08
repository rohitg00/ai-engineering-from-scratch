## Hint 1

The contexts are `ids[:-1]` and the targets are `ids[1:]`. Each pair adds one term to the loss. Start `W` with small random values from `rng`, for example with the scale 0.01.

## Hint 2

For one pair with context $a$ and target $b$, the gradient of $-\log P(b \mid a)$ with respect to row $W_a$ is $\mathrm{softmax}(W_a) - \mathrm{onehot}(b)$. The other rows get no gradient from that pair. Divide by the number of pairs for the mean.

## Hint 3

You can add the gradients of all pairs at once. A one-hot matrix of the contexts, shape `(T - 1, V)`, times `W` gives the logits of every pair, and its transpose times the per-pair gradient gives the gradient of `W`. A faster way counts each pair once: with a count matrix `C`, the gradient is `(C.sum(axis=1, keepdims=True) * softmax(W) - C) / (T - 1)`.

## Hint 4

A row of a rare character gets a small gradient, because few pairs start with it. Use a large learning rate, for example 50, so that these rows also learn inside 300 steps. In `next_log_probs`, apply a stable log softmax to the rows of `W`.
