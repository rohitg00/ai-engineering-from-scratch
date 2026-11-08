## Why the gradient is so simple

The derivative of $\sigma(z)$ is $\sigma(z)(1 - \sigma(z))$. The derivative of the cross-entropy with respect to $p$ has the same factor in the denominator. The two factors cancel, and the gradient with respect to $z$ is only $p - y$. Softmax with cross-entropy has the same property for many classes.

## The numerical traps

The lesson clips $p$ to $[10^{-15}, 1 - 10^{-15}]$ before the log. That keeps the loss finite, but it gives the wrong value for a confident wrong answer: the loss stops near 34.5. The form $\log(1 + e^z) - y z$ needs no clip and is exact. `np.logaddexp` computes the first term without overflow. Frameworks give the same thing under names such as "BCE with logits".

## Why the loss falls at every step

The loss is convex in $w$ and $b$, and its gradient is smooth. For a learning rate that is small compared to the curvature, each step lowers the loss. When the classes separate fully, the weights grow without a limit and the loss goes to 0. Regularization stops that growth.

## Where this goes next

A neural network classifier with two classes ends with the same sigmoid and the same loss. The deep learning lessons add hidden layers before $z$, and backpropagation starts from the same $p - y$.
