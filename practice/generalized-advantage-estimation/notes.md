## Why GAE works

The TD error $\delta_t$ is an advantage estimate with low variance and a bias from the critic. The full discounted return minus $V_t$ has no critic bias but high variance. GAE is the sum $\sum_l (\gamma \lambda)^l \delta_{t+l}$. The deltas telescope, so $\lambda = 1$ gives the discounted return minus the value, and $\lambda = 0$ gives the TD error. The lesson uses $\lambda = 0.95$, the common default.

## The two places where done acts

A done flag acts two times. It removes the next value from the TD error, because a finished episode has no next state. It also stops the recursion, because the advantage of the next episode does not belong to this one. The mutants `bootstrap_through_done` and `no_cut_in_recursion` each forget one of the two.

## The bootstrap value

The lesson code uses 0 after the last step of the rollout. That is correct when the rollout ends at an episode end. When the rollout stops in the middle of an episode, the critic value of the next state fills in the missing future rewards. This problem passes that value as `values[T]`. The lesson version is the same code with `values[T] = 0`.

## Where this goes next

PPO in the next lesson calls the same function on each rollout. It then normalizes the advantages per minibatch and uses the returns as targets for the value loss. The problem on the PPO clip loss takes these advantages as input.
