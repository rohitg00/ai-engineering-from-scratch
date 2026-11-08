## Hint 1

Write `acceptance_rate` and `residual_distribution` first. Each one is a single numpy expression and a sum.

## Hint 2

In the step, read the two probabilities of the draft token: `target_probs[i][token]` and `draft_probs[i][token]`. The ratio $p / q$ can be larger than 1. Then the token is always accepted.

## Hint 3

After a rejection, sample from the residual, not from $p$. The draft already proposed the tokens where $q > p$ too often. The residual adds probability only where $p > q$.

## Hint 4

When the loop ends with no rejection, the target model has one more row of probabilities, at index `gamma`. Sample the bonus token from that row. The number of tokens per step is then from 1 to `gamma + 1`.
