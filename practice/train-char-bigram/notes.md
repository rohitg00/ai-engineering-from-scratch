## What gradient descent finds

The loss for row $a$ is a cross-entropy between the observed next characters after $a$ and $\mathrm{softmax}(W_a)$. Its minimum is at the observed frequencies, $P(b \mid a) = C_{ab} / \sum_c C_{ac}$. These are the counts of the lesson on text generation before transformers. Gradient descent moves toward them but stops after 300 steps. A pair that never occurs keeps a small, finite probability. Early stopping acts like the smoothing that the lesson adds to the counts.

## Why held-out text

The training loss rewards a model that copies the training text. The held-out text has the same kind of English but other words. The check measures how well the model predicts characters it did not see. A model with too much freedom for rare pairs gets a low training loss and a high held-out loss.

## Why the counts trick is exact

All pairs with the same context and target have the same gradient. Summing them is the same as multiplying one gradient by the count. The count form is fast because its cost depends on $V^2$, not on the length of the text.

## Where this goes next

The GPT pre-training lesson uses the same loss. It replaces the table $W$ with an embedding, attention blocks and an output layer, so the context can be many tokens long. The first loss of that model is also close to $\log V$.
