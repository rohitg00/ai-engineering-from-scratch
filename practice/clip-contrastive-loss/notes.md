## Why the loss is symmetric

The image term asks each image to find its text among $N$ texts. The text term asks each text to find its image among $N$ images. Both encoders get a gradient from both directions. The CLIP paper uses this mean of the two cross-entropies. A random model gives a loss near $\log N$, because each softmax is close to uniform.

## Why normalize and divide by a temperature

After normalization each entry of $\hat{I} \hat{T}^\top$ is a cosine similarity in $[-1, 1]$. A softmax over values in that small range is almost flat. Division by a small $\tau$, for example 0.07, makes the softmax sharp enough to learn from. CLIP learns $\log(1 / \tau)$ as a parameter and clips it so that $1 / \tau$ stays at 100 or less.

## The numerical trap

The logits can be large when $\tau$ is small or when the code gets raw scores. Subtract the maximum before `np.exp` in both the row and the column softmax.

## Where this goes next

Every off-diagonal entry is a negative example, so a larger batch gives more negatives for free. SigLIP replaces the two softmax terms with an independent sigmoid loss for each entry of $S$. The multimodal phase of the course uses this loss to pretrain a vision and language model.
