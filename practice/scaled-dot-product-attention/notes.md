## Why divide by the square root of d_k

Each score is a sum of $d_k$ products. When the entries of $q$ and $k$ have variance 1, the score has variance $d_k$. Large scores push the softmax toward a one-hot vector, and the gradient of a one-hot softmax is almost 0. Division by $\sqrt{d_k}$ sets the variance of the scores back to 1.

## Why the mask goes before the softmax

The softmax divides by the sum over the row. When you set a weight to 0 after the softmax, the row sum is less than 1. When you put minus infinity in the score, the softmax gives that key a weight of exactly 0, and the other weights still sum to 1.

## The numerical trap

Masked rows and large scores need the same fix: subtract the row maximum before `np.exp`. A row with no allowed key has a maximum of minus infinity, and the result is NaN. Real models avoid such rows. Some implementations use a large negative number such as `-1e9` in place of minus infinity for this reason.

## Where this goes next

Multi-head attention runs this function once for each head. The KV cache runs it for one new query at a time. In the lessons on BERT and GPT, the only difference between the two models is the mask.
