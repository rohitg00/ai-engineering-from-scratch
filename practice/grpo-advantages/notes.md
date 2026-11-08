## Why a group baseline

PPO subtracts a value estimate to reduce the variance of the policy gradient, and it needs a second network to learn that value. GRPO samples several answers to the same prompt and uses their mean reward as the baseline. Division by the group standard deviation puts easy and hard prompts on the same scale. A group where every answer gets the same reward has zero advantage and gives no gradient.

## Why the k3 estimator

The exact KL needs a sum over the whole vocabulary at each position. The k3 estimator needs only the log probabilities of the sampled tokens. It is never negative, because $x - \log x - 1 \ge 0$ for $x > 0$. Its mean over tokens sampled from $\pi_\theta$ is the exact KL divergence, so it is unbiased. The paper puts this penalty in the loss and not in the reward.

## What the clip does

When $A > 0$, the gain stops at a ratio of $1 + \epsilon$. When $A < 0$, the loss stops at $1 - \epsilon$. The minimum keeps the pessimistic term, so one batch cannot move the policy far from the policy that sampled it.

## Where this goes next

The lesson runs GRPO on a small verifier bandit. The constitutional AI lesson in phase 10 uses the same advantage for language models. Some later variants average over all tokens of the group in place of each answer, which changes the weight of long answers.
