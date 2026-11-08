---
id: vlm-from-scratch
title: Build a VLM from Scratch
code: BV
subtitle: Patch embed, ViT encoder, MLP projector, cross-attention decoder, InfoNCE plus LM pretraining, R@K, EM and BLEU-4.
hue: 25
sources: phases/19-capstone-projects/58-vision-encoder-patches, phases/19-capstone-projects/59-vit-transformer, phases/19-capstone-projects/60-projection-layer-modality-align, phases/19-capstone-projects/61-cross-attention-fusion, phases/19-capstone-projects/62-vision-language-pretraining, phases/19-capstone-projects/63-multimodal-eval
source_hash: 70009b06f92fcb5f
---

## The VLM stack
type: architecture
from: phases/19-capstone-projects/58-vision-encoder-patches/docs/en.md, phases/19-capstone-projects/59-vit-transformer/docs/en.md, phases/19-capstone-projects/60-projection-layer-modality-align/docs/en.md, phases/19-capstone-projects/61-cross-attention-fusion/docs/en.md, phases/19-capstone-projects/62-vision-language-pretraining/docs/en.md

```arch
node | img | 1,1 | Image | 224x224x3 | client
node | patch | 2,1 | PatchEmbed | Conv2d, 196 tokens + CLS | process
node | vit | 3,1 | ViT | 12 blocks, 12 heads, pre-LN | model
node | proj | 4,1 | MLPProjector | linear, GELU, linear | process
node | text | 1,2 | Caption ids | mean-pooled text table | client
node | dec | 3,2 | Decoder | causal self + cross-attention | model
node | loss | 4,2 | Losses | InfoNCE + LM | process
edge | img | patch |
edge | patch | vit | 197 tokens
edge | vit | proj | CLS
edge | vit | dec | memory K, V
edge | text | dec | queries
edge | proj | loss | image_emb
edge | dec | loss | logits
```

## Run each lesson
type: command-table
span: 2
from: phases/19-capstone-projects/58-vision-encoder-patches/docs/en.md, phases/19-capstone-projects/59-vit-transformer/docs/en.md, phases/19-capstone-projects/60-projection-layer-modality-align/docs/en.md, phases/19-capstone-projects/61-cross-attention-fusion/docs/en.md, phases/19-capstone-projects/62-vision-language-pretraining/docs/en.md, phases/19-capstone-projects/63-multimodal-eval/docs/en.md

| Command | What it does |
|---|---|
| `python3 code/main.py` (58) | Tokens of shape `(1, 197, 768)`. Unfold matches Conv2d |
| `python3 code/main.py` (59) | Encodes to `(1, 197, 768)`. About 86M parameters |
| `python3 code/main.py` (60) | 200 steps. Loss from about 1.07 to about 0.80 |
| `python3 code/main.py` (61) | Logits `(2, 10, text_vocab)`, mask `(10, 10)`, cache check |
| `python3 code/main.py` (62) | 50 steps. Contrastive near 2.77 to 2.4. LM 6.24 to 4.7 |
| `python3 code/main.py` (63) | Metrics before and after 50 training steps |
| `python3 -m unittest code/test_main.py` | Run the tests of one lesson |

## Build and encode
type: annotated-code
lang: python
from: phases/19-capstone-projects/58-vision-encoder-patches/code/main.py, phases/19-capstone-projects/59-vit-transformer/code/main.py

```python
cfg = ViTConfig()                         # 224, 16, 768, depth 12, heads 12
encoder = VisionEncoder(cfg).eval()       # front end plus ViT stack
img = synthesize_image(seed=0)            # (1, 3, 224, 224) in [0, 1]
tokens, cls = encoder(img)                # (1, 197, 768) and (1, 768)
pos = sinusoidal_2d(grid_h, grid_w, dim)  # dim divisible by 4
ref = unfold_then_linear(img, weight, bias, cfg.patch_size)
nn.Conv2d(cfg.in_channels, cfg.hidden,
          kernel_size=cfg.patch_size, stride=cfg.patch_size)
x = x + self.attn(self.ln1(x))            # pre-LN residual
x = x + self.ffn(self.ln2(x))             # GELU MLP, 4x wide
```

## Align, fuse and pretrain
type: annotated-code
lang: python
from: phases/19-capstone-projects/60-projection-layer-modality-align/code/main.py, phases/19-capstone-projects/61-cross-attention-fusion/code/main.py, phases/19-capstone-projects/62-vision-language-pretraining/code/main.py

```python
projector = MLPProjector(cfg.vision_hidden, cfg.projection_hidden, cfg.text_hidden)
freeze(encoder)                                     # requires_grad_(False)
loss = cosine_alignment_loss(image_emb, text_emb)   # mean of 1 - cos
mask = causal_mask(10)                              # (10, 10) lower triangle
logits = decoder(text_ids, memory, use_cache=True)  # image K, V cached
contrast, sim = info_nce_loss(image_emb, text_emb, self.log_tau)
lm = lm_loss(logits, targets, padding_id=PAD_ID)    # PAD_ID is 0
total = contrast + cfg.lm_weight * lm
```

## Attention in a VLM
type: comparison
from: phases/19-capstone-projects/59-vit-transformer/docs/en.md, phases/19-capstone-projects/61-cross-attention-fusion/docs/en.md

| Factor | ViT self-attention | Decoder self-attention | Cross-attention |
|---|---|---|---|
| Query | Image tokens | Text tokens | Text tokens |
| Keys and values | Image tokens | Text tokens | Image memory tokens |
| Mask | No mask | Causal `(Nt, Nt)` | No mask |
| Output shape | `(B, 197, 768)` | `(B, Nt, hidden)` | `(B, Nt, hidden)` |
| Why | Encoder-only and bidirectional | No look-ahead in autoregression | Whole image visible |
| Cache | Not used | Not used | Image K, V once per image |

## One pretraining step
type: flow
from: phases/19-capstone-projects/62-vision-language-pretraining/code/main.py, phases/19-capstone-projects/62-vision-language-pretraining/docs/en.md

1. **Sampler**: picks 16 pairs without replacement from the 200-pair corpus.
2. **Encoder**: returns memory tokens and the projected image embedding.
3. **Text side**: mean-pools embedded caption ids to `text_emb`.
4. **InfoNCE**: L2-normalizes both. Cross-entropy on rows and columns, then the mean.
5. **Decoder**: reads `text_ids[:, :-1]` and predicts `text_ids[:, 1:]`.
6. **LM loss**: cross-entropy that ignores padding id 0.
7. **Adam**: steps on `contrast + lm_weight * lm`. Prints every 5 steps.

## Shapes and numbers
type: concepts
from: phases/19-capstone-projects/58-vision-encoder-patches/docs/en.md, phases/19-capstone-projects/59-vit-transformer/docs/en.md, phases/19-capstone-projects/60-projection-layer-modality-align/docs/en.md, phases/19-capstone-projects/63-multimodal-eval/docs/en.md

- **Patches**: 224 / 16 gives a 14x14 grid of 196 patches of 768 values.
- **Attention cost**: 196 tokens give 38,416 scores per head per layer.
- **Projection**: 590,592 parameters for ViT-Base/16. CLS adds 768.
- **Head dim**: 768 / 12 heads gives 64.
- **Per block**: about 7.1M. 12 blocks about 85M. Encoder about 86M.
- **Projector**: about 1.3M for a `768 -> 1024 -> 512` head.
- **Cosine loss**: 0 when aligned, 2 when opposite.
- **Random R@K, N=50**: R@1 0.02, R@5 0.10, R@10 0.20.

## Evaluate the model
type: task-table
span: 2
from: phases/19-capstone-projects/63-multimodal-eval/code/main.py

| Task | Code |
|---|---|
| Build the eval suite | `build_eval_suite(seed, n_samples, vocab_size, max_len)` |
| Image and text recall | `i2t, t2i = recall_at_k(sim, k)` |
| VQA accuracy | `vqa_exact_match(predictions, references)` |
| Caption score | `bleu4(generated, references, smoothing=True)` |
| All three metrics | `evaluate(model, suite)` |
| Train between evals | `contrast, lm, _ = model(imgs, ids)` |

## Config defaults
type: defaults
from: phases/19-capstone-projects/58-vision-encoder-patches/code/main.py, phases/19-capstone-projects/59-vit-transformer/code/main.py, phases/19-capstone-projects/60-projection-layer-modality-align/code/main.py, phases/19-capstone-projects/61-cross-attention-fusion/code/main.py, phases/19-capstone-projects/62-vision-language-pretraining/code/main.py

| Setting | Default | Note |
|---|---|---|
| `image_size`, `patch_size` | 224 | Patch 16, hidden 768 |
| `depth`, `heads` | 12 | `mlp_ratio` 4.0, LayerNorm eps 1e-6 |
| Align `steps` | 200 | 32 pairs, lr 3e-4 |
| `projection_hidden` | 1024 | `text_hidden` 512 |
| Decoder `hidden` | 256 | 8 heads, depth 4, 197 vision tokens |
| Pretrain `batch_size` | 16 | 50 steps, lr 5e-4 |
| `lm_weight` | 1.0 | Weight of the LM loss |
| `init_log_tau` | math.log(1.0 / 0.07) | Scale clamped to 1e-3 and 100.0 |

## Errors and fixes
type: troubleshooting
from: phases/19-capstone-projects/58-vision-encoder-patches/code/main.py, phases/19-capstone-projects/59-vit-transformer/code/main.py, phases/19-capstone-projects/60-projection-layer-modality-align/code/main.py, phases/19-capstone-projects/61-cross-attention-fusion/code/main.py, phases/19-capstone-projects/62-vision-language-pretraining/code/main.py, phases/19-capstone-projects/63-multimodal-eval/code/main.py

| Symptom | Cause | Fix |
|---|---|---|
| `patch_size ... must divide image_size` | Grid is not whole | Pick a patch size that divides the image |
| `spatial mismatch` from `PatchEmbed` | Input size differs from config | Resize to `image_size` |
| `sinusoidal_2d dim must be divisible by 4` | Hidden size not a multiple of 4 | Use a hidden size divisible by 4 |
| `hidden ... not divisible by heads` | Head dim is not whole | Pick heads that divide hidden |
| `could not load lesson 58 main.py` | Lesson folders moved | Keep sibling lesson folders in place |
| `causal mask shape ... does not match` | Mask is not `(Nt, Nt)` | Build it with `causal_mask(nt)` |
| `batch_size ... cannot exceed corpus size` | Sampling without replacement | Lower batch size or add pairs |
| `k ... not in [1, N]` | K is larger than the pool | Keep k at or below N |

## Questions
type: qa
from: phases/19-capstone-projects/58-vision-encoder-patches/docs/en.md, phases/19-capstone-projects/59-vit-transformer/docs/en.md, phases/19-capstone-projects/60-projection-layer-modality-align/docs/en.md, phases/19-capstone-projects/61-cross-attention-fusion/docs/en.md, phases/19-capstone-projects/62-vision-language-pretraining/docs/en.md

- **Why patches, not pixels?** 150,528 pixel tokens make attention unaffordable.
- **Why freeze the encoder at alignment?** Only the 1.3M projector has to learn.
- **Why late fusion?** Text stays clean. Image K, V run once per image.
- **Why learn the temperature?** Too small is noisy. Too large flattens the softmax.
