## Why the shift works

For any constant $c$, $e^{z_i - c} / \sum_j e^{z_j - c} = e^{z_i} / \sum_j e^{z_j}$. With $c = \max_j z_j$, every exponent is 0 or less, so each term is in $(0, 1]$ and the sum is at least 1. Overflow cannot occur, and the sum is never 0.

## Why log-softmax and not log of softmax

When the correct class has a probability below about $10^{-308}$, softmax rounds it to 0 and `np.log` returns minus infinity. The form $z_y - c - \log \sum_j e^{z_j - c}$ never computes that small number, so the loss stays finite. This is the log-sum-exp trick.

## The gradient

The derivative of $-\log p_y$ with respect to $z_i$ is $p_i - [i = y]$. The full Jacobian of softmax cancels out, which is why frameworks fuse softmax and cross-entropy into one operation. The lesson builds the same gradient for one example in `cce_gradient`.

## Where this goes next

The same pattern returns in the attention lessons: attention weights are a softmax over each row of scores, with a mask applied before the shift.
