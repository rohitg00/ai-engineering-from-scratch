## Why the loss has two factors

$f_i$ counts the tokens that the router really sends to expert $i$. A count has no gradient. $P_i$ is the mean router probability, and it does have a gradient. The product $f_i P_i$ lets the count choose the direction and the probability carry the gradient. An expert with many tokens gets a large $f_i$, so the gradient pushes its probability down.

## Why the minimum is 1

When the dispatch is uniform, every $f_i$ is $1 / E$, and the loss is the sum of $P_i$, which is 1. The factor $E$ keeps this value at 1 for any number of experts. The paper scales the loss by a small coefficient, for example 0.01, and adds it to the main loss.

## Gates and ties

The gates use only the chosen logits. This is the same as the full softmax divided by the probability mass of the chosen experts. A fixed tie rule makes the routing deterministic. Without it, two runs can send the same token to different experts.

## Where this goes next

The lesson replaces the auxiliary loss with a per-expert bias that changes only the selection, as in DeepSeek-V3. The bias moves the top k choice, but the gates still come from the original logits. The DeepSeek-V3 lesson in phase 10 shows this design at full scale.
