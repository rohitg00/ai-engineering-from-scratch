## Hint 1

Keep the hidden activation $a_1$ and the output $a_2$ in the cache. The backward pass needs them, and the derivative of the sigmoid uses only its output: $\sigma'(z) = \sigma(z)(1 - \sigma(z))$.

## Hint 2

Start at the loss. The mean runs over every entry of the output, so $\partial L / \partial a_2 = 2 (a_2 - y) / (N \cdot n_{out})$. Use `a2.size` for the count.

## Hint 3

Multiply by the local derivative to go from $a_2$ to $z_2$. Then $\partial L / \partial W_2 = a_1^T \, \partial L / \partial z_2$. The bias adds to every row, so its gradient is the sum of $\partial L / \partial z_2$ over the batch axis.

## Hint 4

Send the gradient back through the weights with $\partial L / \partial a_1 = (\partial L / \partial z_2) W_2^T$. Then repeat the same three steps for the hidden layer, with $x$ in place of $a_1$.

## Hint 5

The sigmoid of a very negative number calls `np.exp` on a very large number. Clip the pre-activation to a range such as $[-500, 500]$ before `np.exp`, so that no overflow warning occurs.
