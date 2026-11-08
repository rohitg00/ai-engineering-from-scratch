## Why the min

The clip removes the reward for a move past $1 \pm \epsilon$ in the good direction. The min keeps the full penalty for a move in the bad direction. So the clipped objective is a lower bound on the plain objective. PPO improves a pessimistic estimate, and a large step cannot look better than it is.

## Why the gradient is 0 on a clipped sample

A clipped term is $(1 \pm \epsilon) A$, and this value does not depend on the new policy. So the sample stops to push. The other samples still update the policy. This is how PPO can run many epochs on one batch.

## The traps

The most common bug is a flipped sign. PPO maximizes the surrogate, so the loss for gradient descent is minus the surrogate. The second trap is the ratio. Always take the exponential of the difference of the log probabilities. The third trap is the clip fraction. Count only the samples where the clip changes the gradient, not every ratio outside the interval.

## Where this goes next

A full PPO loss adds a value loss and an entropy bonus. The lesson normalizes the advantages in each minibatch before this step. GRPO and other RLHF methods use the same clipped ratio with other advantages.
