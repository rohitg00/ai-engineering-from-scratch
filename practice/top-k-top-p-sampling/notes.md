## Why the order of the steps matters

Top-k does not change when you divide the logits by a positive temperature, because the order of the logits stays the same. Top-p does change. A high temperature makes the distribution flatter, so more tokens are necessary to reach the mass $p$. This is why the temperature step comes first. The lesson applies the temperature inside the softmax before the top-p cut for the same reason.

## The token that crosses p

The rule "cumulative sum $\ge p$" keeps the token that makes the sum reach $p$. Without that token the kept mass is below $p$, and with a large first token the kept set can be empty. The lesson uses the same rule in `sample_top_p`.

## Exact draws

`rng.choice` with probabilities gives the same distribution, but not the same draws for a fixed seed. The inverse CDF method with one `rng.random()` for each draw is simple to test, and the draws are the same on every machine.

## Where this goes next

The speculative decoding lesson samples from a draft model and a target model with the same distribution code. The serving lessons apply these filters on the GPU for a whole batch of rows at a time.
