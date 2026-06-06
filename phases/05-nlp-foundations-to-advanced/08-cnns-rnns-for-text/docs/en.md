# CNNs and RNNs for Text

> Convolutions learn n-grams. Recurrences remember. Both are superseded by attention. Both still matter on constrained hardware.

**Type:** Build
**Languages:** Python
**Prerequisites:** Phase 3 · 11 (PyTorch Intro), Phase 5 · 03 (Word Embeddings), Phase 4 · 02 (Convolutions from Scratch)
**Time:** ~75 minutes

## The Problem

TF-IDF and Word2Vec produced flat vectors that ignored word order. A classifier built on them could not tell `dog bites man` from `man bites dog`. Word order sometimes carries the signal.

Two families of architectures filled that gap before transformers arrived.

**Convolutional nets for text (TextCNN).** Apply 1D convolutions over sequences of word embeddings. A filter of width 3 is a learnable trigram detector: it spans three words and outputs a score. Stack different widths (2, 3, 4, 5) to detect multi-scale patterns. Max-pool to a fixed-size representation. Flat, parallel, fast.

**Recurrent nets (RNN, LSTM, GRU).** Process tokens one at a time, maintaining a hidden state that carries information forward. Sequential, memory-bearing, flexible input lengths. Dominated sequence modeling from 2014 to 2017, then attention happened.

This lesson builds both, then names the failure that motivated attention.

## The Concept

**TextCNN** (Kim, 2014). Tokens get embedded. A width-`k` 1D convolution slides a filter over consecutive `k`-grams of embeddings, producing a feature map. Global max-pooling over that map picks the strongest activation. Concatenate max-pooled outputs from several filter widths. Feed to a classifier head.

Why it works. A filter is a learnable n-gram. Max-pooling is position-invariant, so "not good" fires the same feature at the start or middle of a review. Three filter widths with 100 filters each gives you 300 learned n-gram detectors. Training is parallel; no sequential dependency.

**RNN.** At each time step `t`, the hidden state `h_t = f(W * x_t + U * h_{t-1} + b)`. Share `W`, `U`, `b` across time. The hidden state at time `T` is a summary of the entire prefix. For classification, pool across `h_1 ... h_T` (max, mean, or last).

Plain RNNs suffer vanishing gradients. The **LSTM** adds gates that decide what to forget, what to store, and what to output, stabilizing gradients through long sequences. The **GRU** simplifies LSTM to two gates; performs similarly with fewer parameters.

**Bidirectional RNNs** run one RNN forward and another backward, concatenating hidden states. Every token's representation sees both left and right context. Essential for tagging tasks.

## Build It

### Step 1: TextCNN in PyTorch

```python
import torch
import torch.nn as nn
import torch.nn.functional as F


class TextCNN(nn.Module):
    def __init__(self, vocab_size, embed_dim, n_classes, filter_widths=(2, 3, 4), n_filters=64, dropout=0.3):
        super().__init__()
        self.embed = nn.Embedding(vocab_size, embed_dim, padding_idx=0)
        self.convs = nn.ModuleList([
            nn.Conv1d(embed_dim, n_filters, kernel_size=k)
            for k in filter_widths
        ])
        self.dropout = nn.Dropout(dropout)
        self.fc = nn.Linear(n_filters * len(filter_widths), n_classes)

    def forward(self, token_ids):
        x = self.embed(token_ids).transpose(1, 2)
        pooled = []
        for conv in self.convs:
            c = F.relu(conv(x))
            p = F.max_pool1d(c, c.size(2)).squeeze(2)
            pooled.append(p)
        h = torch.cat(pooled, dim=1)
        return self.fc(self.dropout(h))
```

The `transpose(1, 2)` reshapes `[batch, seq_len, embed_dim]` to `[batch, embed_dim, seq_len]` because `nn.Conv1d` treats the middle axis as channels. The pooled output is fixed-size regardless of input length.

### Step 2: LSTM classifier

```python
class LSTMClassifier(nn.Module):
    def __init__(self, vocab_size, embed_dim, hidden_dim, n_classes, bidirectional=True, dropout=0.3):
        super().__init__()
        self.embed = nn.Embedding(vocab_size, embed_dim, padding_idx=0)
        self.lstm = nn.LSTM(embed_dim, hidden_dim, batch_first=True, bidirectional=bidirectional)
        factor = 2 if bidirectional else 1
        self.dropout = nn.Dropout(dropout)
        self.fc = nn.Linear(hidden_dim * factor, n_classes)

    def forward(self, token_ids):
        x = self.embed(token_ids)
        out, _ = self.lstm(x)
        pooled = out.max(dim=1).values
        return self.fc(self.dropout(pooled))
```

Max-pool over the sequence, not last-state pool. For classification, max-pooling usually beats taking the last hidden state because information at the end of a long sequence tends to dominate the last state.

### Step 3: the vanishing gradient demo (intuition)

A plain RNN without gating cannot learn long-range dependencies. Consider a toy task: predict whether token `A` appeared anywhere in a sequence. If `A` is at position 1 and the sequence is 100 tokens long, the gradient from the loss has to flow back through 99 multiplications of the recurrent weight. If the weight is less than 1, the gradient vanishes. If more than 1, it explodes.

```python
def vanishing_gradient_sim(seq_len, recurrent_weight=0.9):
    import math
    return math.pow(recurrent_weight, seq_len)


# At weight=0.9 over 100 steps:
#   0.9 ^ 100 ≈ 2.7e-5
# The gradient from step 100 to step 1 is effectively zero.
```

LSTMs fix this with a **cell state** that runs through the network with only additive interactions (the forget gate scales it multiplicatively, but gradients still flow along the "highway"). GRUs do something similar with fewer parameters. Both give you stable training through 100+ step sequences.

### Step 4: why this still was not enough

Three problems persisted even with LSTMs.

1. **Sequential bottleneck.** Training an RNN on a sequence of length 1000 requires 1000 serial forward/backward steps. Cannot parallelize across time.
2. **Fixed-size context vector in encoder-decoder setups.** The decoder sees only the final hidden state of the encoder, compressed over the entire input. Long inputs lose detail. Lesson 09 covers this directly.
3. **Distant-dependency accuracy ceiling.** LSTMs outperform plain RNNs but still struggle to propagate specific information across 200+ steps.

Attention solved all three. Transformers dropped recurrence entirely. Lesson 10 is the pivot.

## Use It

PyTorch's `nn.LSTM`, `nn.GRU`, and `nn.Conv1d` are production-ready. Training code is standard.

Hugging Face ships pretrained embeddings you plug in as the input layer:

```python
from transformers import AutoModel

encoder = AutoModel.from_pretrained("bert-base-uncased")
for param in encoder.parameters():
    param.requires_grad = False


class BertCNN(nn.Module):
    def __init__(self, n_classes, filter_widths=(2, 3, 4), n_filters=64):
        super().__init__()
        self.encoder = encoder
        self.convs = nn.ModuleList([nn.Conv1d(768, n_filters, kernel_size=k) for k in filter_widths])
        self.fc = nn.Linear(n_filters * len(filter_widths), n_classes)

    def forward(self, input_ids, attention_mask):
        with torch.no_grad():
            out = self.encoder(input_ids=input_ids, attention_mask=attention_mask).last_hidden_state
        x = out.transpose(1, 2)
        pooled = [F.max_pool1d(F.relu(conv(x)), kernel_size=conv(x).size(2)).squeeze(2) for conv in self.convs]
        return self.fc(torch.cat(pooled, dim=1))
```

Use-when-it-fits-the-constraint checklist.

- **Edge / on-device inference.** TextCNN with GloVe embeddings is 10-100x smaller than a transformer. If your deploy target is a phone, this is the stack.
- **Streaming / online classification.** RNN processes one token at a time; transformers need the full sequence. For real-time incoming text, LSTMs still win.
- **Tiny models for baselines.** Fast iteration on a new task. Train a TextCNN in 5 minutes on a CPU.
- **Sequence labeling with limited data.** BiLSTM-CRF (lesson 06) is still a production-grade NER architecture for 1k-10k labeled sentences.

Everything else goes to a transformer.

## Ship It

Save as `outputs/prompt-text-encoder-picker.md`:

```markdown
---
name: text-encoder-picker
description: Pick a text encoder architecture for a given constraint set.
phase: 5
lesson: 08
---

Given constraints (task, data volume, latency budget, deploy target, compute budget), output:

1. Encoder architecture: TextCNN, BiLSTM, BiLSTM-CRF, transformer fine-tune, or "use a pretrained transformer as a frozen encoder + small head".
2. Embedding input: random init, GloVe / fastText frozen, or contextualized transformer embeddings.
3. Training recipe in 5 lines: optimizer, learning rate, batch size, epochs, regularization.
4. One monitoring signal. For RNN/CNN models: attention mechanism absence means they miss long-range deps; check per-length accuracy. For transformers: fine-tuning collapse if LR too high; check train loss.

Refuse to recommend fine-tuning a transformer when data is under ~500 labeled examples without showing that a TextCNN / BiLSTM baseline has plateaued. Flag edge deployment as needing architecture-before-everything.
```

## Exercises

1. **Easy.** Train a TextCNN on a 3-class toy dataset (you invent the data). Verify that filter widths (2, 3, 4) outperform a single width (3) on average F1.
2. **Medium.** Implement max-pool, mean-pool, and last-state pooling for the LSTM classifier. Compare on a small dataset; document which pooling wins and hypothesize why.
3. **Hard.** Build a BiLSTM-CRF NER tagger (combine lesson 06 and this one). Train on CoNLL-2003. Compare to the CRF-alone baseline from lesson 06 and to a BERT fine-tune. Report training time, memory, and F1.

## Key Terms

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| TextCNN | CNN for text | Stack of 1D convolutions over word embeddings with global max-pool. Kim (2014). |
| RNN | Recurrent net | Hidden state updated at each time step: `h_t = f(W x_t + U h_{t-1})`. |
| LSTM | Gated RNN | Adds input / forget / output gates + a cell state. Trains stably through long sequences. |
| GRU | Simpler LSTM | Two gates instead of three. Similar accuracy, fewer parameters. |
| Bidirectional | Both directions | Forward + backward RNN concatenated. Every token sees both sides of its context. |
| Vanishing gradient | Training signal dies | Repeated multiplication by <1 weights in plain RNNs makes early-step gradients effectively zero. |

## Further Reading

- [Kim, Y. (2014). Convolutional Neural Networks for Sentence Classification](https://arxiv.org/abs/1408.5882) — the TextCNN paper. Eight pages. Readable.
- [Hochreiter, S. and Schmidhuber, J. (1997). Long Short-Term Memory](https://www.bioinf.jku.at/publications/older/2604.pdf) — the LSTM paper. Unexpectedly lucid.
- [Olah, C. (2015). Understanding LSTM Networks](https://colah.github.io/posts/2015-08-Understanding-LSTMs/) — the diagrams that made LSTMs accessible to everyone.
