## Why the backward pass works

The return obeys $G_t = r_t + \gamma G_{t+1}$. A pass from the end to the start computes every return in $O(T)$ time. A sum for each step from scratch takes $O(T^2)$ time.

## Why the reset goes before the add

At a done step the episode ends after the reward. The reward of the done step is part of its own return. The rewards after it belong to the next episode. So the running value goes to 0 first, and then the reward of the done step goes in. The mutant that resets after the store cuts the wrong episode.

## Truncation

This problem treats the end of the batch as the end of an episode. A real rollout often stops in the middle of an episode. Then the sum misses the future rewards. The actor critic and PPO lessons fix this with a bootstrap value from the critic. The problem on generalized advantage estimation uses it.

## Why normalize

Returns can be large and change scale during training. The lesson on REINFORCE scales them to mean 0 and standard deviation 1 across the batch before the gradient step. This keeps the step size stable. The same `normalize` returns in the actor critic and PPO lessons, where it acts on advantages.
