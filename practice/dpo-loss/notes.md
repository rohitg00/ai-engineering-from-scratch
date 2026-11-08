## Why the policy is a reward model

The objective of RLHF has a closed form optimum: $\pi^*(y \mid x) \propto \pi_{ref}(y \mid x) \exp(r(x, y) / \beta)$. Solve it for $r$ and you get $r = \beta \log(\pi^* / \pi_{ref})$ plus a term that depends only on the prompt. The preference model of Bradley and Terry uses only the difference of two rewards for the same prompt, so that term cancels. The result is a loss on the policy alone.

## What the gradient does

The gradient pushes up the preferred log probability and pushes down the rejected one. The weight is $\sigma(-z) = \sigma(r_l - r_w)$. A pair that the model already ranks well gets a small weight. A pair that the model ranks wrong gets a weight near 1. The paper shows that this weight is what keeps DPO stable. Without it, the model loses quality.

## The numerical trap

The lesson adds `1e-8` inside the log. That caps the loss of a very wrong pair at about 18.4 and makes the loss of a very good pair about `1e-8`, not 0. `np.logaddexp` gives the exact value in both directions.

## The role of beta

A small $\beta$ lets the policy move far from the reference before the loss saturates. A large $\beta$ makes the loss sensitive to small changes in the log ratio. The lesson measures this in its beta sensitivity analysis.

## Where this goes next

The phase on alignment covers the variants of DPO, such as IPO, KTO and SimPO. Each one changes the function of the margin or removes the reference model.
