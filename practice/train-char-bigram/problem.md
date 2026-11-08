A bigram language model predicts the next character from the current character only. It is the smallest model that uses context, and its loss is the same next-token cross-entropy that trains a GPT. In this task you train a table of next-character logits with gradient descent. The checks then measure it on a held-out text that your code never sees.

## Task

Write two functions.

1. `train(ids, vocab_size, rng)` trains the model on one long sequence of character ids and returns the model.
2. `next_log_probs(model, prev_ids)` returns $\log P(\text{next} \mid \text{prev})$ for each context in `prev_ids`.

The model is a matrix $W$ of shape $(V, V)$. Row $a$ holds the logits of the character that follows character $a$, so $P(\cdot \mid a) = \mathrm{softmax}(W_a)$. The training pairs are $(x_t, x_{t+1})$ for $t = 0, \dots, T - 2$. Train $W$ with gradient descent on the mean negative log-likelihood

$$L = -\frac{1}{T - 1} \sum_{t=0}^{T-2} \log P(x_{t+1} \mid x_t).$$

The training text is `TEXT` in `support.py`. It holds the "What it actually means" lines of the first 26 entries of the course glossary, `glossary/terms.md`, from "Activation Checkpointing" to "Benchmark Contamination". The text is lower case. Every character outside `VOCAB` is a space. `VOCAB` has 29 characters: the space, the letters a to z, the full stop and the comma. `encode(text)` gives the ids and `decode(ids)` gives the text back.

During training, call `report(step, loss)` from `practice_check` once for each update step. The first step is 0. The page draws these values as a live loss curve, and the checks count them.

## Input and output

| Name | Type | Shape | Meaning |
|---|---|---|---|
| `ids` | int array | `(T,)` | the character ids of the training text, from 0 to `vocab_size - 1` |
| `vocab_size` | int | | the number of characters, 29 |
| `rng` | `np.random.Generator` | | the only source of random numbers |
| `model` | any | | the value that `train` returns |
| `prev_ids` | int array | `(M,)` | the context characters |

- `train` returns the model. The model can be any Python value, for example the matrix $W$.
- `next_log_probs` returns a float array of shape `(M, 29)`. Row $i$ holds the log probabilities of the 29 characters after `prev_ids[i]`.

## Constraints

- Budget: at most 300 update steps, so at most 300 calls to `report`.
- Target: a mean negative log-likelihood of at most 2.55 nats per character on a held-out text from other glossary entries. This page does not show that text. A uniform model gets $\log 29 = 3.367$. A unigram model that ignores the context gets about 2.9.
- Train with gradient descent. Pairs that never occur in the training text must keep a finite log probability.
- Take every random number from `rng`. The same seed must give the same model.
- Do not change `ids`.
- Use numpy only. One full submit has a limit of 15 seconds.

## Examples

```python
ids = encode(TEXT)
model = train(ids, len(VOCAB), np.random.default_rng(1))
np.exp(next_log_probs(model, encode("q"))[:, encode("u")])
```

```text
[[0.9663]]
```

The output is rounded to 4 decimals. After `q`, the model gives the letter `u` a probability of 0.9663. The reference starts with logits near 0, so its first reported loss is 3.3666, close to $\log 29$. After 300 steps its loss on the training text is 2.3148. A unigram model gets 2.9110 on the same text.
