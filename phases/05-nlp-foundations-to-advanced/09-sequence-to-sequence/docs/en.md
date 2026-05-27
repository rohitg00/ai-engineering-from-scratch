# Sequence-to-Sequence Models

> Two RNNs pretending to be a translator. The bottleneck they hit is the reason attention exists.

**Type:** Build
**Languages:** Python
**Prerequisites:** Phase 5 · 08 (CNNs + RNNs for Text), Phase 3 · 11 (PyTorch Intro)
**Time:** ~75 minutes

## The Problem

Classification maps a variable-length sequence to a single label. Translation maps a variable-length sequence to another variable-length sequence. The input and output live in different vocabularies, possibly different languages, with no guarantee of length parity.

The seq2seq architecture (Sutskever, Vinyals, Le, 2014) cracked this with a deliberately simple recipe. Two RNNs. One reads the source sentence and produces a fixed-size context vector. The other reads that vector and generates the target sentence token by token. Same code you wrote for lesson 08, glued together differently.

This is worth studying for two reasons. First, the context-vector bottleneck is the most pedagogically useful failure in NLP. It motivates everything attention and transformers are good at. Second, the training recipe (teacher forcing, scheduled sampling, beam search at inference) still applies to every modern generation system including LLMs.

## The Concept

**Encoder.** An RNN that reads the source sentence. Its final hidden state is the **context vector** — a fixed-size summary of the entire input. Lose nothing but the source, supposedly.

**Decoder.** Another RNN initialized from the context vector. At each step it takes the previously generated token as input and produces a distribution over the target vocabulary. Sample or argmax to pick the next token. Feed it back in. Repeat until an `<EOS>` token is produced or max length is hit.

**Training:** Cross-entropy loss at each decoder step, summed over the sequence. Standard backprop through time through both networks.

**Teacher forcing.** During training, the decoder's input at step `t` is the *ground-truth* token at position `t-1`, not the decoder's own previous prediction. This stabilizes training; without it, early mistakes cascade and the model never learns. At inference, you have to use the model's own predictions, so there is always a train/inference distribution gap. That gap is called **exposure bias**.

**The bottleneck.** Everything the encoder learned about the source must be squeezed into that one context vector. Long sentences lose detail. Rare words get blurred. Reordering (chat noir vs. black cat) has to be memorized, not computed.

Attention (lesson 10) fixes this by letting the decoder look at *every* encoder hidden state, not just the last one. That is the whole pitch.

## Build It

### Step 1: an encoder

```python
import torch
import torch.nn as nn


class Encoder(nn.Module):
    def __init__(self, src_vocab_size, embed_dim, hidden_dim):
        super().__init__()
        self.embed = nn.Embedding(src_vocab_size, embed_dim, padding_idx=0)
        self.gru = nn.GRU(embed_dim, hidden_dim, batch_first=True)

    def forward(self, src):
        e = self.embed(src)
        outputs, hidden = self.gru(e)
        return outputs, hidden
```

`outputs` has shape `[batch, seq_len, hidden_dim]` — one hidden state per input position. `hidden` has shape `[1, batch, hidden_dim]` — the final step. Lesson 08 said "pool over outputs for classification." Here we keep the last hidden state as the context vector, and ignore the per-step outputs.

### Step 2: a decoder

```python
class Decoder(nn.Module):
    def __init__(self, tgt_vocab_size, embed_dim, hidden_dim):
        super().__init__()
        self.embed = nn.Embedding(tgt_vocab_size, embed_dim, padding_idx=0)
        self.gru = nn.GRU(embed_dim, hidden_dim, batch_first=True)
        self.fc = nn.Linear(hidden_dim, tgt_vocab_size)

    def forward(self, token, hidden):
        e = self.embed(token)
        out, hidden = self.gru(e, hidden)
        logits = self.fc(out)
        return logits, hidden
```

Decoder is called one step at a time. Input: a batch of single tokens and the current hidden state. Output: vocabulary logits for the next token and the updated hidden state.

### Step 3: training loop with teacher forcing

```python
def train_batch(encoder, decoder, src, tgt, bos_id, optimizer, teacher_forcing_ratio=0.9):
    optimizer.zero_grad()
    _, hidden = encoder(src)
    batch_size, tgt_len = tgt.shape
    input_token = torch.full((batch_size, 1), bos_id, dtype=torch.long)
    loss = 0.0
    loss_fn = nn.CrossEntropyLoss(ignore_index=0)

    for t in range(tgt_len):
        logits, hidden = decoder(input_token, hidden)
        step_loss = loss_fn(logits.squeeze(1), tgt[:, t])
        loss += step_loss
        use_teacher = torch.rand(1).item() < teacher_forcing_ratio
        if use_teacher:
            input_token = tgt[:, t].unsqueeze(1)
        else:
            input_token = logits.argmax(dim=-1)

    loss.backward()
    optimizer.step()
    return loss.item() / tgt_len
```

Two knobs worth naming. `ignore_index=0` skips loss on padding tokens. `teacher_forcing_ratio` is the probability of using the true token vs. the model's prediction at each step. Start at 1.0 (full teacher forcing) and anneal down to ~0.5 over training to close the exposure-bias gap.

### Step 4: inference loop (greedy)

```python
@torch.no_grad()
def greedy_decode(encoder, decoder, src, bos_id, eos_id, max_len=50):
    _, hidden = encoder(src)
    batch_size = src.shape[0]
    input_token = torch.full((batch_size, 1), bos_id, dtype=torch.long)
    output_ids = []
    for _ in range(max_len):
        logits, hidden = decoder(input_token, hidden)
        next_token = logits.argmax(dim=-1)
        output_ids.append(next_token)
        input_token = next_token
        if (next_token == eos_id).all():
            break
    return torch.cat(output_ids, dim=1)
```

Greedy decoding picks the highest-probability token at every step. It can wander off: once you commit to a token, you cannot unsay it. **Beam search** keeps the top-`k` partial sequences alive and picks the highest-scoring complete one at the end. Beam width 3-5 is standard.

### Step 5: the bottleneck, demonstrated

Train the model on a toy copy task: source `[a, b, c, d, e]`, target `[a, b, c, d, e]`. Increase sequence length. Observe accuracy.

```
seq_len=5   copy accuracy: 98%
seq_len=10  copy accuracy: 91%
seq_len=20  copy accuracy: 62%
seq_len=40  copy accuracy: 23%
```

A single GRU hidden state cannot losslessly memorize a 40-token input. The information is there at every encoder step, but the decoder only sees the last state. Attention fixes this directly.

## Use It

PyTorch has `nn.Transformer` and `nn.LSTM`-based seq2seq templates. Hugging Face's `transformers` library ships full encoder-decoder models (BART, T5, mBART, NLLB) trained on billions of tokens.

```python
from transformers import AutoTokenizer, AutoModelForSeq2SeqLM

tok = AutoTokenizer.from_pretrained("facebook/bart-base")
model = AutoModelForSeq2SeqLM.from_pretrained("facebook/bart-base")

src = tok("Translate this to French: Hello, how are you?", return_tensors="pt")
out = model.generate(**src, max_new_tokens=50, num_beams=4)
print(tok.decode(out[0], skip_special_tokens=True))
```

Modern encoder-decoders dropped RNNs for transformers. The high-level shape (encoder, decoder, generate-token-by-token) is identical to the 2014 seq2seq paper. The mechanism inside each block is different.

### When to still reach for RNN-based seq2seq

Almost never, for new projects. Specific exceptions:

- Streaming translation where you consume input one token at a time with bounded memory.
- On-device text generation where transformer memory cost is prohibitive.
- Pedagogy. Understanding the encoder-decoder bottleneck is the fastest path to understanding why transformers won.

### Exposure bias and its mitigations

- **Scheduled sampling.** Anneal teacher forcing ratio during training so the model learns to recover from its own mistakes.
- **Minimum risk training.** Train on sentence-level BLEU score instead of token-level cross-entropy. Closer to what you actually want.
- **Reinforcement learning fine-tuning.** Reward the sequence generator with a metric. Used in modern LLM RLHF.

All three still apply to transformer-based generation.

## Ship It

Save as `outputs/prompt-seq2seq-design.md`:

```markdown
---
name: seq2seq-design
description: Design a sequence-to-sequence pipeline for a given task.
phase: 5
lesson: 09
---

Given a task (translation, summarization, paraphrase, question rewrite), output:

1. Architecture. Pretrained transformer encoder-decoder (BART, T5, mBART, NLLB) is the default. RNN-based seq2seq only for specific constraints.
2. Starting checkpoint. Name it (`facebook/bart-base`, `google/flan-t5-base`, `facebook/nllb-200-distilled-600M`). Match the checkpoint to task and language coverage.
3. Decoding strategy. Greedy for deterministic output, beam search (width 4-5) for quality, sampling with temperature for diversity. One sentence justification.
4. One failure mode to verify before shipping. Exposure bias manifests as generation drift on longer outputs; sample 20 outputs at the 90th-percentile length and eyeball.

Refuse to recommend training a seq2seq from scratch for under a million parallel examples. Flag any pipeline that uses greedy decoding for user-facing content as fragile (greedy repeats and loops).
```

## Exercises

1. **Easy.** Implement the toy copy task. Train a GRU seq2seq on input-output pairs where the target equals the source. Measure accuracy at lengths 5, 10, 20. Reproduce the bottleneck.
2. **Medium.** Add beam search decoding with beam width 3. Measure BLEU on a small parallel corpus against greedy. Document where beam search wins (usually last tokens) and where it makes no difference.
3. **Hard.** Fine-tune `facebook/bart-base` on a 10k-pair paraphrase dataset. Compare the fine-tuned model's beam-4 output to the base model's on held-out inputs. Report BLEU and pick 10 qualitative examples.

## Key Terms

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Encoder | Input RNN | Reads source. Produces per-step hidden states and a final context vector. |
| Decoder | Output RNN | Initialized from context vector. Generates target tokens one at a time. |
| Context vector | The summary | Final encoder hidden state. Fixed size. The bottleneck attention solves. |
| Teacher forcing | Use true tokens | Feed the ground-truth previous token at training time. Stabilizes learning. |
| Exposure bias | Train/test gap | Model trained on true tokens never practiced recovering from its own mistakes. |
| Beam search | Better decoding | Keep top-k partial sequences alive at each step instead of committing greedily. |

## Further Reading

- [Sutskever, Vinyals, Le (2014). Sequence to Sequence Learning with Neural Networks](https://arxiv.org/abs/1409.3215) — the original seq2seq paper. Four pages.
- [Cho et al. (2014). Learning Phrase Representations using RNN Encoder-Decoder for Statistical Machine Translation](https://arxiv.org/abs/1406.1078) — introduced the GRU and the encoder-decoder framing.
- [Bahdanau, Cho, Bengio (2014). Neural Machine Translation by Jointly Learning to Align and Translate](https://arxiv.org/abs/1409.0473) — the attention paper. Read immediately after this lesson.
- [PyTorch NLP from Scratch tutorial](https://pytorch.org/tutorials/intermediate/seq2seq_translation_tutorial.html) — buildable seq2seq + attention code.
