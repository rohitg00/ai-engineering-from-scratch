## Hint 1

`np.linalg.norm(x, axis=-1, keepdims=True)` gives the length of each row with shape `(N, 1)`. Divide by it to get unit rows.

## Hint 2

The text loss is the image loss applied to the transpose of the logits. Each column of $S$ becomes a row of $S^\top$.

## Hint 3

Write a log-softmax over the last axis that subtracts the row maximum first. The diagonal of the log-softmax gives the log probability of each correct match.

## Hint 4

The gradient of the image term is $(R - I_N) / N$. The gradient of the text term is $(C - I_N) / N$, where $C$ is the transpose of the row softmax of $S^\top$. The loss is the mean of the two terms, so add them and divide by 2.
