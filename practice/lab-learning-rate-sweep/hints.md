## Hint 1

Read the final loss with `losses[-1]` and the first loss with `losses[0]`. `np.isfinite` is `False` for both `inf` and `nan`.

## Hint 2

Do not call `np.argmin` on the final losses directly. A `nan` in the array makes `np.argmin` return the index of the `nan`. Skip the diverged runs first.

## Hint 3

The mean squared error is $\frac{1}{n} \lVert Xw - y \rVert^2$. Its Hessian is $\frac{2}{n} X^T X$. `np.linalg.eigvalsh` returns the eigenvalues of a symmetric matrix.

## Hint 4

For a quadratic loss, one step multiplies the error along each eigenvector by $1 - \eta \lambda$. The run is stable only when $\lvert 1 - \eta \lambda_{max} \rvert < 1$, so $\eta < 2 / \lambda_{max}$.
