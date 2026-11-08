CLIP trains an image encoder and a text encoder together. In a batch of $N$ pairs, image $i$ belongs with text $i$ and with no other text. The loss pulls the matched pairs together and pushes the other $N^2 - N$ pairs apart. Zero-shot classification and image search both use the embeddings that this loss trains.

## Task

Write three functions.

1. `similarity_logits(image_emb, text_emb, temperature)` returns the $N \times N$ logit matrix.
2. `symmetric_infonce(logits)` returns the symmetric contrastive loss as a float.
3. `symmetric_infonce_grad(logits)` returns the gradient of that loss with respect to the logits.

**Logits.** Divide each image row and each text row by its L2 norm. Call the results $\hat{I}$ and $\hat{T}$. The logits are

$$S = \frac{\hat{I} \hat{T}^\top}{\tau}$$

where $\tau$ is the temperature. Row $i$ holds image $i$ against every text. Column $j$ holds text $j$ against every image.

**Loss.** The target of row $i$ and of column $i$ is index $i$, the diagonal.

$$\mathcal{L}_{img} = -\frac{1}{N} \sum_i \log \frac{e^{S_{ii}}}{\sum_j e^{S_{ij}}}, \qquad \mathcal{L}_{txt} = -\frac{1}{N} \sum_j \log \frac{e^{S_{jj}}}{\sum_i e^{S_{ij}}}$$

$$\mathcal{L} = \frac{\mathcal{L}_{img} + \mathcal{L}_{txt}}{2}$$

**Gradient.** Return $\partial \mathcal{L} / \partial S$ with the same shape as `logits`. Let $R$ be the softmax of each row of $S$, and $C$ the softmax of each column of $S$. The gradient of one cross-entropy is its softmax minus the one-hot target.

## Input and output

| Name | Type | Shape | Meaning |
|---|---|---|---|
| `image_emb` | float array | `(N, d)` | one image embedding in each row |
| `text_emb` | float array | `(N, d)` | one text embedding in each row, row $i$ matches image $i$ |
| `temperature` | float | | $\tau > 0$, the logits are divided by it |
| `logits` | float array | `(N, N)` | a logit matrix, rows are images and columns are texts |

- `similarity_logits` returns a float array of shape `(N, N)`.
- `symmetric_infonce` returns a Python float.
- `symmetric_infonce_grad` returns a float array of shape `(N, N)`.

## Constraints

- `1 <= N <= 256` and `1 <= d <= 512`.
- No embedding row is all zeros.
- `0.01 <= temperature <= 1`.
- `symmetric_infonce` and its gradient get any finite logits, with absolute values up to 1000. The results must stay finite.
- Do not change the input arrays.
- Use numpy only.

## Examples

```python
image_emb = np.array([[1.0, 0.0], [0.0, 2.0], [1.0, 1.0]])
text_emb = np.array([[2.0, 0.0], [1.0, 1.0], [0.0, 3.0]])
logits = similarity_logits(image_emb, text_emb, 0.5)
```

```text
[[2.         1.41421356 0.        ]
 [0.         1.41421356 2.        ]
 [1.41421356 2.         1.41421356]]
```

```python
symmetric_infonce(logits)
symmetric_infonce_grad(logits)
```

```text
0.9905556060000382
[[-0.13632819  0.09873442  0.02666175]
 [ 0.02666175 -0.23459891  0.19700514]
 [ 0.09873442  0.15772852 -0.23459891]]
```

```python
symmetric_infonce(np.zeros((4, 4)))
```

```text
1.3862943611198906
```
