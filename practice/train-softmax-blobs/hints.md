## Hint 1

Compute the mean and the standard deviation of each column of `X` once, before the loop. Make a new scaled array from them. Keep both statistics in the model, because `predict_proba` must scale new points in the same way.

## Hint 2

Start `W` and `b` at zero. For softmax regression the loss is convex, so zero is a good start and you do not need random numbers.

## Hint 3

The gradient of the mean cross-entropy with respect to the scores is `(P - T) / N`, where `T` is the one-hot matrix of the targets. `np.eye(4)[y]` builds `T`.

## Hint 4

The weight gradient is the scaled input transposed times that error matrix. The bias gradient is the sum of the error over the rows. Update both. With scaled features, a learning rate of about 2 reaches the targets well inside 500 steps.
