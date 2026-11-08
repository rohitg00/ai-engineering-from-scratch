## Why the factor helps

An easy example has $p_t$ near 1, so $(1 - p_t)^\gamma$ is near 0. With $\gamma = 2$, an example with $p_t = 0.9$ gives 100 times less loss than with cross-entropy. An example with $p_t = 0.1$ keeps 81 percent of its loss. In a detector with thousands of easy background regions for each object, this change moves most of the gradient to the hard examples.

## Alpha and gamma together

The paper uses $\gamma = 2$ and $\alpha = 0.25$. It is a surprise that the best $\alpha$ gives the rare positive class a smaller weight. The factor $(1 - p_t)^\gamma$ already removes most of the easy negatives, so the remaining negatives need a larger weight.

## The numerical trap

$\log \sigma(x)$ with `np.log(sigmoid(x))` gives minus infinity for $x = -1000$. The form with `np.logaddexp` gives exactly $-1000$. The same problem occurs for $1 - p_t$ when $p_t$ is near 1: compute it as $\sigma(-s)$ and not as `1 - sigmoid(s)`.

## Where this goes next

RetinaNet uses the binary form for each class and each anchor box. The paper also starts the bias of the last layer at $-\log((1 - \pi)/\pi)$ with $\pi = 0.01$, so that the first predictions are rare positives. The computer vision phase uses focal loss for detection.
