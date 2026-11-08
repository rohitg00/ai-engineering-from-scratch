# Evidence: cheatsheets/rnns-seq2seq.md

Abbreviations: R08 = phases/05-nlp-foundations-to-advanced/08-cnns-rnns-for-text, S09 = phases/05-nlp-foundations-to-advanced/09-sequence-to-sequence, M11 = phases/05-nlp-foundations-to-advanced/11-machine-translation, G16 = phases/05-nlp-foundations-to-advanced/16-text-generation-pre-transformer, W07 = phases/07-transformers-deep-dive/01-why-transformers. d = docs/en.md, c = code/main.py.

## Seq2seq encoder-decoder (architecture, 6 nodes, 6 edges)
- Source tokens are src ids embedded: S09/d:51-52
- Encoder GRU returns outputs, hidden: S09/d:45-54, 57
- Context vector is the final hidden state, the bottleneck: S09/d:20, 28, 207
- Decoder initialized from the context vector, one step at a time: S09/d:22, 76
- input_token starts as bos_id, then feeds back the chosen token: S09/d:85, 113, 117-119
- Vocabulary logits, argmax or beam: S09/d:22, 72, 125

## Core formulas (concepts, 8)
- RNN h_t = f(W * x_t + U * h_{t-1} + b), shared W, U, b: R08/d:28
- LSTM gates and cell state: R08/d:30, 192
- GRU two gates, fewer parameters: R08/d:30, 193
- TextCNN filter as learnable n-gram, global max-pool: R08/d:24, 26
- N-gram count ratio: G16/d:42-46
- Perplexity formula, lower is better: G16/d:61-65
- Kneser-Ney absolute discounting plus continuation probability: G16/d:57, 246
- BLEU n-gram sizes 1-4, geometric mean, brevity penalty, [0, 100]: M11/d:66

## Tasks in code (task-table, 8)
- vanishing_gradient_sim(seq_len, recurrent_weight=0.9): R08/c:4
- greedy_decode(encoder, decoder, src, bos_id, eos_id, max_len=50): S09/d:110
- simple_bleu(hypothesis, reference, max_n=4): M11/c:34
- chrf(hypothesis, reference, n=6, beta=2): M11/c:53
- train_ngram(corpus_tokens, n=3): G16/d:79
- kneser_ney_bigram_model(corpus_tokens, discount=0.75): G16/d:116
- perplexity(prob_fn, sentences): G16/d:189
- rnn_style(xs, decay=0.9), attention_style(xs): W07/c:11, 19

## Train with teacher forcing (annotated-code, 12 lines)
- _, hidden = encoder(src): S09/d:83
- input_token = torch.full((batch_size, 1), bos_id, dtype=torch.long): S09/d:85
- nn.CrossEntropyLoss(ignore_index=0), skips padding: S09/d:87, 104
- decoder loop and step loss: S09/d:89-92
- use_teacher from torch.rand(1).item() < teacher_forcing_ratio: S09/d:93
- ground truth tgt[:, t].unsqueeze(1) or logits.argmax(dim=-1): S09/d:94-97, 26
- loss.backward(): S09/d:99

## TextCNN forward pass (annotated-code, 9 lines)
- self.embed(token_ids).transpose(1, 2), [batch, embed_dim, seq_len]: R08/d:60, 70
- loop over self.convs, widths (2, 3, 4): R08/d:49, 62
- F.relu(conv(x)), F.max_pool1d(c, c.size(2)).squeeze(2): R08/d:63-65
- torch.cat(pooled, dim=1), fixed size: R08/d:66, 70
- out, _ = self.lstm(x), out.max(dim=1).values: R08/d:86-87
- max-pool beats last state: R08/d:91

## Translate and score (annotated-code, 8 lines)
- model_id facebook/nllb-200-distilled-600M, src_lang="eng_Latn": M11/d:41-42
- model.generate with forced_bos_token_id fra_Latn, num_beams=5, length_penalty=1.0, max_new_tokens=64: M11/d:48-54
- forced_bos_token_id sets the target language: M11/d:62
- tok.batch_decode: M11/d:55
- sacrebleu.corpus_bleu and corpus_chrf: M11/d:76-77

## Defaults and numbers (defaults, 8)
- teacher_forcing_ratio=0.9 signature: S09/d:81, start 1.0 anneal ~0.5: S09/d:104
- Beam width 3-5: S09/d:125, MT 4-5: M11/d:28
- KN discount=0.75: G16/d:116, 148
- n_filters=64, filter_widths=(2, 3, 4), dropout=0.3: R08/d:49
- 0.9 ^ 100 ≈ 2.7e-5: R08/d:103-104
- Copy accuracy 98% at 5, 23% at 40: S09/d:132-135
- BLEU 30 usable, 40 good, 50 exceptional, under 1 noise: M11/d:66
- 4-gram KN perplexity ~140 on Brown, transformer 15-30: G16/d:201

## Troubleshooting (troubleshooting, 8)
- Exposure bias: S09/d:26, drift on longer outputs: S09/d:190, scheduled sampling: S09/d:167
- Fixed context vector loses detail on long inputs: S09/d:28, attention fix: S09/d:30
- Vanishing gradient in plain RNNs, LSTM and GRU fix: R08/d:95, 108
- Greedy repeats and loops: S09/d:192, beam width 4-5: S09/d:189
- Off-target generation, check forced_bos_token_id and language ID: M11/d:100
- Length explosion under ~5 tokens, cap by source length: M11/d:103
- Hallucination, constrained decoding, human review: M11/d:99
- Unseen n-grams get zero probability: G16/d:16, 48, Kneser-Ney: G16/d:16, 57

## Use X when (qa, 6)
- TextCNN edge, 10-100x smaller: R08/d:151
- LSTM streaming: R08/d:152, BiLSTM-CRF for 1k-10k sentences: R08/d:154
- RNN seq2seq almost never, streaming or on-device: S09/d:159-162
- N-gram autocomplete, rescoring, baseline: G16/d:206-208
- Everything else a transformer: R08/d:156, W07/d:80, depth 1 vs N: W07/d:65, O(N^2) memory: W07/d:34
- chrF sensitive for morphologically rich languages, reported with BLEU: M11/d:68

## Abbreviations (glossary, 6)
- LSTM: R08/d:192
- GRU: R08/d:193
- NMT: M11/d:188
- NLLB: M11/d:189
- chrF: M11/d:187
- SSM: W07/d:82, 103

## Tips (tips, 5)
- Always use sacrebleu: M11/d:81
- At least two metric families, COMET default: M11/d:85, 88
- Calibrate on 50-100 human-labeled examples: M11/d:91
- Perplexity only under identical tokenization: G16/d:229
- A few thousand clean pairs beat noisy ones: M11/d:136
