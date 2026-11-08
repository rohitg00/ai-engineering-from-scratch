## Hint 1

Go through the steps from the last step to the first step. The return of a step needs the return of the step after it.

## Hint 2

Keep one running value `G`. At each step, set `G` to the reward plus `gamma` times `G`, and store it.

## Hint 3

In the batch version, a done flag at step `t` means that no reward after `t` belongs to this episode. Set the running value to 0 before you add the reward of step `t`.

## Hint 4

For normalization, `np.std` gives the population standard deviation by default. Add `1e-8` to it so that equal returns do not divide by 0.
