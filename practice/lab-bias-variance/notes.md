## What the sweep shows

Degrees 1 and 2 have a bias squared above 0.42. A line cannot follow the sine. From degree 3 the bias drops, and at degree 5 it is 0.0022. Degree 5 has the lowest test error, 0.302. From degree 9 the variance grows fast: at degree 12 it is 27.7. With 30 points, a degree 12 polynomial follows the noise of each training set and swings far between the training points.

The crossover is at degree 4. The best degree is one step past the crossover, where the bias has fallen and the variance is still small.

## Why the identity is exact

For each test point, $\frac{1}{B} \sum_b (p_b - f)^2 = (\bar p - f)^2 + \frac{1}{B} \sum_b (p_b - \bar p)^2$. The cross term sums to 0 because the deviations from the mean sum to 0. This only holds when the variance divides by $B$. With $B - 1$, the parts do not add up to the error.

## Where this goes next

The same tradeoff controls regularization, the size of a neural network and early stopping. The regularization lesson adds a penalty that lowers the variance and raises the bias, and you can run this sweep again to see the curve move.
