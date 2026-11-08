## What the sweep shows

At temperature 1.0 the distribution has 2.53 bits of entropy, about as much as a uniform choice among 5.8 tokens. At 0.7 the top token "the" has a probability of 0.497. The entropy crosses 2 bits at $T = 0.694$, so the first grid temperature above the target is 0.7.

Top p with $p = 0.9$ keeps 4 tokens at $T = 0.7$, 6 at $T = 1.0$ and 8 at $T = 1.5$. Top p does not fix the number of tokens. It adapts to the shape that the temperature gives. A higher temperature flattens the distribution, so top p must keep more tokens to reach the same mass.

## Why the entropy rises with the temperature

As $T \to 0$ the softmax puts all the mass on the largest logit and the entropy goes to 0. As $T \to \infty$ every logit divided by $T$ goes to 0 and the distribution becomes uniform, with entropy $\log_2 V$. Between the two ends the entropy rises with $T$, so a bisection on $T$ finds any target in between.

## Where this goes next

The top k and top p sampling problem builds the full sampler that draws a token. Min p, which the GPT lesson also covers, keeps the tokens with $p_i \ge p_{min} \cdot \max_j p_j$, so its cut also moves with the temperature.
