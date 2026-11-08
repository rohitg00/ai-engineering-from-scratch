## Hint 1

Do the step with whole arrays. Compute the new velocity first. Then use the new velocity to move the parameters.

## Hint 2

Do not use `+=` or `*=` on `params` or `velocity`. These operators write into the caller's arrays. Build new arrays with `beta * velocity + grads`.

## Hint 3

In `minimize_quadratic`, keep a list of points. Put a copy of `x0` in the list before the loop. Append a copy of the point after each update. Convert the list with `np.array` at the end.

## Hint 4

For Nesterov, compute the gradient at `x - lr * beta * velocity` with the velocity from before the step. Then call your `momentum_step` with that gradient, the current `x` and the current velocity.
