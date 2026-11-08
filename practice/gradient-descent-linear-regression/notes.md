## Why the gradient has a factor of 2

The cost is a mean of squares. The derivative of $(\hat{y}_i - y_i)^2$ with respect to $\hat{y}_i$ is $2(\hat{y}_i - y_i)$. The chain rule then multiplies by $x_{ij}$ for weight $j$ and by 1 for the bias. Some texts define the cost with a factor of $\frac{1}{2}$ so that the 2 cancels. Both choices are correct, but the gradient must match the cost that you compute.

## Why the update is simultaneous

Gradient descent takes one step from one point. Both gradients describe the slope at that point. If you update `w` and then compute `db` at the new `w`, you take a step from a mix of two points. The loop still often converges, but it is a different algorithm and its path is not the gradient path.

## The learning rate

For this cost, the step is stable when $\eta$ is less than $1 / \lambda_{\max}$, where $\lambda_{\max}$ is the largest eigenvalue of $\frac{1}{n} X^\top X$ with a column of ones added. A larger step makes the cost grow at each epoch. Standardize the features first, as the lesson does, so that one learning rate works for all weights.

## Where this goes next

The same predict, cost, gradient and update loop trains logistic regression in the next lesson. Only the prediction and the cost change. The optimizer lessons replace the plain update with momentum and Adam.
