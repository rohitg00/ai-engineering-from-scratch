# Evidence: cheatsheets/vlm-from-scratch.md

Abbreviations: L58 = phases/19-capstone-projects/58-vision-encoder-patches, L59 = phases/19-capstone-projects/59-vit-transformer, L60 = phases/19-capstone-projects/60-projection-layer-modality-align, L61 = phases/19-capstone-projects/61-cross-attention-fusion, L62 = phases/19-capstone-projects/62-vision-language-pretraining, L63 = phases/19-capstone-projects/63-multimodal-eval. d = docs/en.md, c = code/main.py.

## The VLM stack (architecture, 7 nodes, 7 edges)
- Image 224x224x3: L58/d:27
- PatchEmbed Conv2d, 196 tokens plus CLS: L58/d:21, 46, 72-74
- ViT 12 blocks, 12 heads, pre-LN: L59/d:3, 21
- MLPProjector linear, GELU, linear, from CLS: L60/d:21, 29-31
- Caption ids, mean-pooled text table: L60/d:32-33, 72, L62/d:30
- Decoder with causal self-attention and cross-attention, memory as K, V, text as queries: L61/d:12-14, 31
- Losses InfoNCE plus LM: L62/d:3, 39-40

## Run each lesson (command-table, 7 rows)
- 58 python3 code/main.py, (1, 197, 768), unfold equivalence: L58/d:81-84, 62
- 59 encodes to (1, 197, 768), about 86M: L59/d:96-99
- 60 200 steps, loss about 1.07 to about 0.80: L60/d:74, 79-82
- 61 logits (2, 10, text_vocab), mask (10, 10), KV cache check: L61/d:99-102
- 62 50 steps, contrastive ln(16) = 2.77 toward 2.4, LM 6.24 toward 4.7: L62/d:86-89
- 63 before and after metrics: L63/d:97-105
- python3 -m unittest code/test_main.py: L58/d:103, L59/d:125, L60/d:108, L61/d:126, L62/d:114, L63/d:131

## Build and encode (annotated-code, 10 lines)
- ViTConfig defaults 224, 16, 768, 12, 12: L59/c:49-57
- VisionEncoder(cfg).eval(): L59/c:149-160, 186
- synthesize_image(seed=0), (1, 3, 224, 224) in [0, 1]: L58/c:132-146
- tokens, cls = encoder(img), (B, 197, 768) and (B, 768): L59/c:152-153, 162-166, 195
- sinusoidal_2d dim divisible by 4: L58/c:42-50
- unfold_then_linear(img, weight, bias, cfg.patch_size): L58/c:149, 216
- nn.Conv2d(cfg.in_channels, cfg.hidden, kernel_size=cfg.patch_size, stride=cfg.patch_size): L58/c:79-85
- Pre-LN residuals with attn and ffn: L59/c:130-133
- GELU MLP 4x wide: L59/c:56, 106-119

## Align, fuse and pretrain (annotated-code, 8 lines)
- MLPProjector(cfg.vision_hidden, cfg.projection_hidden, cfg.text_hidden): L60/c:157
- freeze(encoder) sets requires_grad_(False): L60/c:124-126, 152
- cosine_alignment_loss mean of 1 - cos: L60/c:113-121
- causal_mask(10) is (10, 10) lower-triangular: L61/c:45-46, 239
- decoder(text_ids, memory, use_cache=True): L61/c:183-184, 247
- info_nce_loss(image_emb, text_emb, self.log_tau): L62/c:73-74, 175
- lm_loss(logits, targets, padding_id=PAD_ID), PAD_ID = 0: L62/c:54, 98-111, 184
- total = contrast + cfg.lm_weight * lm: L62/c:247

## Attention in a VLM (comparison, 6 rows)
- Query: ViT image tokens: L59/d:72. Decoder self-attention text tokens: L61/d:52. Cross-attention text tokens: L61/d:53
- Keys and values: ViT image tokens: L59/d:72. Decoder text tokens: L61/d:52. Cross-attention image memory tokens: L61/d:31, 53
- Mask: ViT no mask: L59/d:72. Decoder causal (Nt, Nt): L61/d:52. Cross-attention no mask: L61/d:53
- Output shape: ViT (1, 197, 768): L59/d:99. Decoder and cross-attention (B, Nt, hidden): L61/d:118
- Why: encoder-only and bidirectional: L59/d:72. No look-ahead: L61/d:52. Whole image visible: L61/d:53, 59
- Cache: image K, V computed once per image: L61/d:63

## One pretraining step (flow, 7 steps)
1. 16 pairs without replacement from 200 pairs: L62/c:64-65, 244, L62/d:67
2. encode_image returns tokens and projector(cls): L62/c:163-165, 172
3. TextSideEncoder mean pool over non-padding tokens: L62/c:114-128, 173
4. InfoNCE normalize, cross_entropy on sim and sim.T, mean: L62/c:86-95, L62/d:45
5. inputs text_ids[:, :-1], targets text_ids[:, 1:]: L62/c:178-179
6. ignore_index=padding_id, PAD_ID 0: L62/c:54, 111
7. Adam on contrast + lm_weight * lm, print every 5 steps: L62/c:232, 247-259

## Shapes and numbers (concepts, 8 bullets)
- 14x14 grid of 196 patches, 768 values each: L58/d:21
- 196 tokens give 38,416 attention scores: L58/d:38
- 590,592 projection parameters, 768 in CLS: L58/d:58
- head_dim 64 with hidden 768 and 12 heads: L59/d:52
- about 7.1M per block, 85M for 12, 86M total: L59/d:64-66
- Projector about 1.3M for 768 -> 1024 -> 512: L60/d:52
- Cosine loss 0 aligned, 2 opposite: L60/d:56
- Random baselines N=50: R@1 0.02, R@5 0.10, R@10 0.20: L63/d:74-78

## Evaluate the model (task-table, 6 rows)
- build_eval_suite(seed, n_samples, vocab_size, max_len): L63/c:173, 301-302
- recall_at_k(sim, k) returns (i2t, t2i): L63/c:77-97
- vqa_exact_match(predictions, references): L63/c:100-106
- bleu4(generated, references, smoothing=True): L63/c:122-123
- evaluate(model, suite): L63/c:213, 307, 326
- contrast, lm, _ = model(imgs, ids): L63/c:318

## Config defaults (defaults, 8 rows)
- image_size 224, patch_size 16, hidden 768: L58/c:23-27, L59/c:50-53
- depth 12, heads 12, mlp_ratio 4.0, eps 1e-6: L59/c:54-56, 125
- Align steps 200, pairs 32, lr 3e-4: L60/c:55-57
- projection_hidden 1024, text_hidden 512: L60/c:51-52
- Decoder hidden 256, heads 8, depth 4, vision_tokens 197: L61/c:28-35
- Pretrain batch_size 16, steps 50, lr 5e-4: L62/c:65-67
- lm_weight 1.0: L62/c:68
- init_log_tau math.log(1.0 / 0.07), clamp 1e-3 to 100.0: L62/c:69, 89

## Errors and fixes (troubleshooting, 8 rows)
- patch_size must divide image_size: L58/c:31-34
- spatial mismatch in PatchEmbed.forward: L58/c:94-98
- sinusoidal_2d dim must be divisible by 4: L58/c:49-50
- hidden not divisible by heads: L59/c:60-62, L61/c:41
- could not load lesson 58 main.py at LESSON_58: L59/c:23, 32-35
- causal mask shape does not match (n, n): L61/c:69-73
- batch_size cannot exceed corpus size with replace=False: L62/c:234-238
- k not in [1, N]: L63/c:85-86

## Questions (qa, 4 bullets)
- 150,528 pixel tokens unaffordable in attention: L58/d:19
- Freeze encoder, only the 1.3M projector learns: L60/d:60
- Late fusion keeps text clean, image computed once per image: L61/d:21
- Temperature too small is noisy, too large flattens: L62/d:49
