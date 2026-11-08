## Hint 1

Compute the TD errors first. `values[1:]` holds the next value of each step, and `values[:-1]` holds the value of the step itself.

## Hint 2

Multiply the next value by `1 - dones` as floats. A done step has no next state, so its next value is 0.

## Hint 3

The advantages need one pass from the last step to the first step. Keep a running value. At a done step, set the running value to 0 before you add the TD error of that step.

## Hint 4

At each step the new running value is the TD error plus `gamma * lam` times the old running value. The returns are the advantages plus `values[:T]`, not `values[1:]`.
