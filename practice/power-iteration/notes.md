## Why it works

Write $v_0$ in the eigenvector basis: $v_0 = \sum_i c_i u_i$. Then $M^k v_0 = \sum_i c_i \lambda_i^k u_i$. The term with the largest $|\lambda_i|$ grows fastest. After normalization, the other terms shrink by the factor $|\lambda_2 / \lambda_1|$ at each step. A small gap between $|\lambda_1|$ and $|\lambda_2|$ gives slow convergence.

## The Rayleigh quotient

The value $v^T M v$ is the best eigenvalue estimate for a unit vector $v$. Its error is the square of the error in $v$. For that reason, the eigenvalue is often correct to 10 digits when the vector is correct to only 5 digits.

## Why a sign rule

When $u$ is an eigenvector, $-u$ is also an eigenvector. Different start vectors give either sign. A fixed rule makes the result repeatable, so tests and later steps can compare vectors directly. Libraries such as scikit-learn use a similar rule for PCA components.

## Where this goes next

The SVD lesson runs power iteration on $A^T A$, then removes the found component and repeats. PageRank is power iteration on a link matrix. Large language model work uses the same idea to estimate the spectral norm of a weight matrix.
