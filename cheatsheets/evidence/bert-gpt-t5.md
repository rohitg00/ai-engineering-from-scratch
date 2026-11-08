# Evidence: cheatsheets/bert-gpt-t5.md

Abbreviations: P07 = phases/07-transformers-deep-dive. L05 = P07/05-full-transformer, L06 = P07/06-bert-masked-language-modeling, L07 = P07/07-gpt-causal-language-modeling, L08 = P07/08-t5-bart-encoder-decoder. d = docs/en.md, c = code/main.py.

## Three families side by side (comparison)
- Stack: encoder-only BERT, decoder-only GPT, encoder-decoder T5: L05/d:14, L05/d:139-141
- Attention: encoder bidirectional no masking: L05/d:46, L06/d:148. Causal mask: L07/d:16. T5 bidirectional encoder, causal decoder: L08/d:153
- Cross-attention: Q from decoder, K/V from encoder; omitted in GPT: L05/d:29, L05/d:54, L08/d:154
- Objective: MLM 15%: L06/d:28, L06/d:147. Shift-by-one: L07/d:80-87. Span corruption and denoising: L08/d:23-24
- Predicts: GPT $P(x_t \mid x_{<t})$, BERT $P(x_{masked} \mid x_{unmasked})$: L07/d:168. T5 outputs spans, BART full sequence: L08/d:56, L08/d:75
- Generates: BERT no: L06/d:131. GPT token by token: L07/d:78. Encoder-decoder generates from encoder output: L08/d:19, L08/d:79
- Best for: L05/d:139-141, L06/d:68-74, L08/d:85-86
- Examples: BERT, DeBERTa, ModernBERT / GPT, Llama, Qwen / T5, BART, Whisper: L05/d:139-141

## Block wiring (architecture, 8 nodes, 7 edges)
- Source tokens, embed + position: L05/d:24, L05/d:104-105
- Encoder block LN, MHA(self), LN, FFN: L05/d:40
- Encoder output (N_src, d_model), runs once: L08/d:42, L08/d:52
- Target tokens, shift by one: L08/d:19, L08/d:44
- Masked self-attention, sublayer 1: L05/d:51, L08/d:45
- Cross-attention, sublayer 2: L05/d:54, L08/d:46
- FFN, sublayer 3: L05/d:51, L08/d:47
- K, V from encoder into cross-attention: L05/d:29
- Next-token logits, final LN before output projection: L08/d:49, L05/d:101

## One encoder-decoder forward pass (flow, 7 steps)
1. Embedding + RoPE or sinusoidal: L05/d:24
2. Pre-norm self-attention + residual, pre-norm FFN + residual: L05/c:187-195
3. Encoder runs once, cache it: L08/d:52
4. Masked self-attention, position i sees only positions <= i: L05/c:200-201, L07/d:184
5. Cross-attention is the only place encoder info enters: L05/d:54, L08/d:154
6. Final LN before the output projection: L05/d:101
7. 6-token source, 5-token target, shape (5, vocab): L05/d:119, L05/c:218-219

## Tasks in the lesson code (task-table, 8)
- create_mlm_batch(tokens, vocab_size): L06/c:18
- whole_word_mlm(tokens, spans, vocab_size): L06/c:45, L06/c:139
- causal_mask(n): L07/c:20
- cross_entropy_shifted(logits, target_ids): L07/c:38, L07/c:160
- corrupt_spans(tokens, mask_rate=0.15): L08/c:14
- round_trip(source, target): L08/c:74
- encoder_block(x, p): L05/c:187
- decoder_block(x, enc_out, p): L05/c:198

## Load each family (annotated-code, 10 lines)
- ModernBERT tokenizer and model: L06/d:119-120
- last_hidden_state (1, N, 768): L06/d:124
- AutoModelForCausalLM.from_pretrained: L07/d:151
- generate with max_new_tokens=64, temperature=0.7, top_p=0.9, do_sample=True: L07/d:156-162
- T5ForConditionalGeneration google/flan-t5-base: L08/d:130
- translate English to French input, return_tensors="pt": L08/d:132
- generate max_new_tokens=32: L08/d:133
- decode skip_special_tokens=True: L08/d:134
- task name goes into the input text: L08/d:137

## Pretraining objectives (concepts, 8)
- MLM 15%, 80/10/10: L06/d:28, L06/d:39-43
- labels -100 elsewhere: L06/d:84, L06/c:15, L06/c:27
- NSP hurt in RoBERTa, modern encoders skip it: L06/d:49
- Input [t1, t2, t3], targets [t2, t3, t4], -log P summed: L07/d:82-87
- M_ij = 0 if j <= i, else -inf, add before softmax: L07/d:29, L07/d:32
- Span average length 3, 15% total, sentinels <extra_id_0>, <extra_id_1>: L08/d:56
- Decoder outputs only the corrupted spans with sentinel prefix: L08/d:56-60
- BART five noising functions, decoder reconstructs the full original: L08/d:67-75

## Decoding strategies (command-table, 7)
- sample_greedy(probs), argmax, deterministic tasks / code completion: L07/c:50, L07/d:97
- sample_temperature(logits, t, rng), divide logits by T: L07/c:54, L07/d:98
- sample_top_k(logits, k, rng): L07/c:69, L07/d:99
- sample_top_p(logits, p, rng), cumulative prob >= p: L07/c:79, L07/d:100
- sample_min_p(logits, min_p, rng), p >= min_p * max_p: L07/c:101-104, L07/d:101
- Beam search width 4 to 5: L08/d:79
- Speculative decoding draft proposes N, big model verifies: L07/d:102, L07/d:191

## Block: 2017 against 2026 (comparison, 6)
- Normalization LayerNorm to RMSNorm: L05/d:66. Post-norm to pre-norm default: L05/d:58
- FFN activation ReLU to SwiGLU: L05/d:67
- FFN expansion 4x to 2.6x, three matrices: L05/d:68
- Position sinusoidal absolute to RoPE: L05/d:69
- Attention full MHA to GQA (or MLA): L05/d:70
- Bias terms yes to no: L05/d:71

## Defaults in the code (defaults, 8)
- mask_prob 0.15: L06/c:18
- IGNORE_INDEX -100: L06/c:15
- mask_rate 0.15: L08/c:14
- mean_span 3.0: L08/c:14
- mask_token "<mask>": L08/c:98, L08/c:110
- layer_norm eps 1e-5, subtract mean: L05/c:86, L05/d:91
- rms_norm eps 1e-6, no mean subtraction: L05/c:98, L05/d:92
- temperature 1.0 in softmax, top_k, top_p, min_p: L07/c:11, L07/c:69, L07/c:79, L07/c:101

## Use each family when (tips, 7)
- BERT for classification, retrieval, NER, NLI, RAG reranker; 5-10x faster per token: L06/d:18, L06/d:68-74
- Not for generation: L06/d:131
- GPT for generation, chat, code, reasoning; scales cleanest: L05/d:140, L05/d:143
- min-p + temperature 0.7 default for open-weights models: L07/d:104
- Encoder-decoder for a clear source sequence: translation, speech, structured tasks: L05/d:143
- Beam search, narrower output distribution than chat: L08/d:79
- Summarization and structured extraction: either: L08/d:89-90

## Troubleshooting (troubleshooting, 7)
- 100% [MASK] creates distribution shift, 80/10/10 rule: L06/d:45
- Without the causal mask the model cheats by looking at the answer: L07/d:14-16
- Softmax never outputs an exact zero, future scores go in as -inf: L07/d:52
- Gradients vanish past ~6 layers without residual x + sublayer(x): L05/d:27
- Post-norm activations explode after 12 layers, pre-norm stays bounded: L05/d:152, L05/d:58
- Round-trip check catches off-by-one bugs in span bookkeeping: L08/d:117
- Caching the encoder output is a free speedup for long inputs: L08/d:52

## Questions (qa, 5)
- Bidirectional encoder uses right context, GPT cannot: L06/d:35, L06/d:148
- N parallel predictions in one pass, serial inference: L07/d:16, L07/d:76-78
- MHA 4 · d², SwiGLU FFN about 3rd²: L05/d:79-80
- T5 decodes only spans, BART full sequence so higher compute: L08/d:56, L08/d:75
- Embedding models are fine-tuned BERT with contrastive loss: L06/d:127
