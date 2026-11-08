---
id: vision-transformers
title: Vision Transformers and Patch Tokens
code: VT
subtitle: Patchify, embed, add CLS and position, run pre-LN blocks. Token counts, parameter math and any-resolution packing.
hue: 220
sources: phases/04-computer-vision/14-vision-transformers, phases/07-transformers-deep-dive/09-vision-transformers, phases/12-multimodal-ai/01-vision-transformer-patch-tokens, phases/12-multimodal-ai/06-any-resolution-patch-n-pack, phases/19-capstone-projects/58-vision-encoder-patches, phases/19-capstone-projects/59-vit-transformer
source_hash: 75419a9d2b4e8c01
---

## ViT pipeline
type: architecture
from: phases/04-computer-vision/14-vision-transformers/docs/en.md

```arch
node | img | 1,1 | Image | (3, 224, 224) | client
node | patch | 2,1 | Patch embedding | conv 16x16 s=16 | process
node | flat | 3,1 | Flatten | (196, 768) tokens | process
node | cls | 4,1 | Prepend [CLS] | 197 tokens | store
node | pos | 4,2 | Add learned position | (197, 768) | store
node | enc | 3,2 | N encoder blocks | pre-LN | gpu
node | take | 2,2 | Take [CLS] output | | process
node | head | 1,2 | MLP classifier | | model
edge | img | patch |
edge | patch | flat |
edge | flat | cls |
edge | cls | pos |
edge | pos | enc |
edge | enc | take |
edge | take | head |
```

## Shape and cost math
type: concepts
from: phases/12-multimodal-ai/01-vision-transformer-patch-tokens/docs/en.md, phases/19-capstone-projects/58-vision-encoder-patches/docs/en.md, phases/19-capstone-projects/59-vit-transformer/docs/en.md, phases/04-computer-vision/14-vision-transformers/docs/en.md

- **Grid**: $(H/P) \times (W/P)$ patches. 224 at patch 16 gives 14x14 = 196 tokens.
- **Patch vector**: $3P^2$ values. At P = 16 that is 768.
- **Projection**: `nn.Conv2d(3, D, kernel_size=P, stride=P)` equals unfold then linear.
- **Sequence**: patches + 1 CLS + registers. ViT-B/16 at 224 is 197.
- **Attention cost**: $n^2$. 196 tokens give 38,416 scores. 150,528 pixels give 22.6 billion.
- **Head dim**: `head_dim = hidden / num_heads`. 768 / 12 = 64.
- **Block params**: $12 D^2$ + 3k. About 7.1M at D = 768. 12 blocks are 85M.
- **Patch embed params**: `3 * P * P * hidden + hidden`. 590,592 for ViT-Base/16.

## Tiny ViT forward
type: annotated-code
lang: python
from: phases/04-computer-vision/14-vision-transformers/code/main.py, phases/04-computer-vision/14-vision-transformers/docs/en.md

```python
vit = ViT(image_size=64, patch_size=16, num_classes=10, dim=192, depth=6, num_heads=3)
x = self.patch(x)                                 # (N, 16, 192)
cls = self.cls_token.expand(x.size(0), -1, -1)
x = torch.cat([cls, x], dim=1)                    # (N, 17, 192)
x = x + self.pos_embed                            # learned, trunc_normal std=0.02
for blk in self.blocks:
    x = blk(x)                                    # pre-LN attention, then MLP
return self.head(self.ln(x[:, 0]))                # classify from [CLS] only
```

## Pre-LN block at ViT-B scale
type: annotated-code
lang: python
from: phases/19-capstone-projects/59-vit-transformer/code/main.py, phases/19-capstone-projects/59-vit-transformer/docs/en.md

```python
cfg = ViTConfig()                                 # 224, 16, hidden 768, depth 12, heads 12
qkv = self.qkv(x).reshape(b, n, 3, h, hd).permute(2, 0, 3, 1, 4)
q, k, v = qkv[0], qkv[1], qkv[2]
scores = (q @ k.transpose(-2, -1)) * self.scale   # scale = 1 / sqrt(head_dim)
attn = F.softmax(scores, dim=-1)                  # no mask. Encoder is bidirectional
x = x + self.attn(self.ln1(x), store_attn=store_attn)
x = x + self.ffn(self.ln2(x))                     # hidden to 4 * hidden to hidden
tokens, cls = encoder(img)                        # (1, 197, 768) and (1, 768)
```

## Tasks in code
type: task-table
from: phases/04-computer-vision/14-vision-transformers/docs/en.md, phases/19-capstone-projects/58-vision-encoder-patches/code/main.py, phases/12-multimodal-ai/01-vision-transformer-patch-tokens/code/main.py, phases/12-multimodal-ai/06-any-resolution-patch-n-pack/code/main.py, phases/07-transformers-deep-dive/09-vision-transformers/code/main.py

| Task | Code |
|---|---|
| Pretrained ViT-B/16 | `timm.create_model("vit_base_patch16_224")` |
| Flat patches, stdlib | `patchify(image, patch_size)` |
| Fixed 2D position table | `sinusoidal_2d(grid_h, grid_w, dim)` |
| Check the Conv2d math | `unfold_then_linear(x, weight, bias, patch_size)` |
| Sequence length | `seq_length(cfg)` |
| FLOPs per forward | `flops_per_forward(cfg)` |
| Pack mixed sizes | `pack_batch(images, patch)` |
| Block-diagonal mask | `build_dense_mask(pack)` |

## Commands
type: command-table
from: phases/19-capstone-projects/58-vision-encoder-patches/docs/en.md, phases/19-capstone-projects/59-vit-transformer/docs/en.md, phases/12-multimodal-ai/01-vision-transformer-patch-tokens/docs/en.md

| Command | What it does |
|---|---|
| `python3 code/main.py` (19.58) | Front end gives (1, 197, 768) |
| `python3 code/main.py` (19.59) | Full encoder. About 86M params |
| `python3 -m unittest code/test_main.py` | Runs the shape and equivalence tests |
| `code/main.py` (12.01) | Patch tokenizer and geometry calculator |

## Model sizes
type: defaults
from: phases/04-computer-vision/14-vision-transformers/docs/en.md, phases/07-transformers-deep-dive/09-vision-transformers/docs/en.md, phases/19-capstone-projects/59-vit-transformer/docs/en.md, phases/12-multimodal-ai/01-vision-transformer-patch-tokens/docs/en.md

| Setting | Default | Note |
|---|---|---|
| ViT-B/16 | 86M | dim=768, depth=12, heads=12 |
| ViT-Large | ~307M | hidden=1024, depth=24, heads=16 |
| ViT-Huge | ~632M | Feature dim 1280 |
| SigLIP So400M | 400M | hidden=1152, depth=27, heads=16 |
| Tiny ViT (lesson 4.14) | 2.8M | dim=192, depth=6, CPU |
| MLP expansion | 4x | 2x underfits, 8x overfits |
| Register tokens | 4 | DINOv2 and SigLIP 2 |
| MAE mask | 75% | Encoder sees the visible 25% |

## Patch size and token count
type: defaults
from: phases/04-computer-vision/14-vision-transformers/docs/en.md, phases/12-multimodal-ai/01-vision-transformer-patch-tokens/docs/en.md, phases/12-multimodal-ai/06-any-resolution-patch-n-pack/docs/en.md

| Setting | Default | Note |
|---|---|---|
| 224, patch 16 | 196 tokens | Standard |
| 224, patch 32 | 49 tokens | Faster, lower resolution |
| 224, patch 8 | 784 tokens | Finer, quadratic cost |
| SigLIP 2 SO400m/14 at 384 | 729 patch tokens | 2026 default VLM tower |
| NaFlex budgets | 256, 729, 1024 | One checkpoint, pick at inference |
| AnyRes 672x672, 2x2 + thumbnail | 2880 | 4 * 576 + 576 |
| OCR and documents | 1024-4096 tokens | Natural photos need 256-576 |

## Patch-n'-pack a mixed batch
type: flow
from: phases/12-multimodal-ai/06-any-resolution-patch-n-pack/docs/en.md, phases/12-multimodal-ai/06-any-resolution-patch-n-pack/code/main.py

1. **Grid**: compute each native patch grid at patch size 14.
2. **Flatten**: each image becomes its own variable-length sequence.
3. **Concat**: join all sequences into one. Offsets give `cu_seqlens`.
4. **Mask**: build a block-diagonal mask. Patches attend only inside their image.
5. **Position**: give each patch 2D RoPE or fractional positions.
6. **Result**: 576 + 256 + 768 tokens give one 1600-token sequence. No padding.

## Pooling and position choices
type: concepts
from: phases/12-multimodal-ai/01-vision-transformer-patch-tokens/docs/en.md, phases/07-transformers-deep-dive/09-vision-transformers/docs/en.md, phases/19-capstone-projects/58-vision-encoder-patches/docs/en.md, phases/12-multimodal-ai/06-any-resolution-patch-n-pack/docs/en.md

- **[CLS] token**: its final hidden state is the image. Original ViT and CLIP use it.
- **Mean pool**: average of patch outputs. SigLIP and DINOv2 use it.
- **Register tokens**: 4 to 16 extra tokens absorb high-norm artifacts. Drop them before the LLM.
- **Learned 1D position**: ties the model to the training resolution.
- **2D sinusoidal**: fixed, 0 parameters. Half the dim is row, half is column.
- **2D-RoPE, M-RoPE**: rotate q and k by (row, col). No position table.
- **VLM handoff**: skip pooling. Every patch becomes an LLM input token.

## Troubleshooting
type: troubleshooting
from: phases/04-computer-vision/14-vision-transformers/docs/en.md, phases/12-multimodal-ai/01-vision-transformer-patch-tokens/docs/en.md, phases/12-multimodal-ai/06-any-resolution-patch-n-pack/docs/en.md, phases/19-capstone-projects/58-vision-encoder-patches/code/main.py, phases/19-capstone-projects/59-vit-transformer/code/main.py

| Symptom | Cause | Fix |
|---|---|---|
| ViT loses to ResNet on ImageNet-1k | No CNN priors, too little data | DeiT recipe or MAE pretraining |
| Deep stack fails to train | Post-LN past 6-8 layers | Use pre-LN |
| New resolution breaks positions | Learned 1D table | Interpolate, or use 2D-RoPE |
| Squished text, lost chart labels | Square resize | Encode at native resolution |
| 50%+ of tokens are padding | Pad to the longest side | Patch-n'-pack with a mask |
| High-norm artifact patches | No sink token | Add register tokens |
| ValueError on the grid | `patch_size` does not divide `image_size` | Pick a dividing patch size |
| `sinusoidal_2d` raises | dim not divisible by 4 | Use a dim that is a multiple of 4 |

## Questions
type: qa
from: phases/04-computer-vision/14-vision-transformers/docs/en.md, phases/07-transformers-deep-dive/09-vision-transformers/docs/en.md, phases/12-multimodal-ai/01-vision-transformer-patch-tokens/docs/en.md, phases/19-capstone-projects/58-vision-encoder-patches/docs/en.md

- **Why patches, not pixels?** A 224x224 image is 150,528 pixel tokens. Attention is quadratic.
- **Why pre-LN?** It trains deep stacks stably without warmup.
- **Patch 14 or 16?** Patch 14 gives more tokens. Better for OCR and dense tasks, slower.
- **Which backbone for dense features?** DINOv2. Use CLIP or SigLIP to match text.
- **Learned or sinusoidal position?** Learned wins at fixed resolution. Sinusoidal wins when resolution changes.
