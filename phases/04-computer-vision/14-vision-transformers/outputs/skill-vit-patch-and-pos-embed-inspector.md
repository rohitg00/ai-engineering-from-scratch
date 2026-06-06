---
name: skill-vit-patch-and-pos-embed-inspector
description: Verify a ViT's patch embedding and positional embedding shapes match the model's expected sequence length
version: 1.0.0
phase: 4
lesson: 14
tags: [vision-transformer, debugging, pytorch]
---

# ViT Patch and Positional Embedding Inspector

The most common ViT porting bug: loading a checkpoint pretrained at 224x224 into a model configured for 384x384 (or vice versa). The positional embedding has the wrong sequence length and the model silently produces garbage.

## When to use

- Fine-tuning a pretrained ViT at a non-default resolution.
- Auditing why a weight port between ViT-B/16 and ViT-B/32 fails; the inspector will flag the patch-size mismatch so the caller knows to swap architectures rather than force a port.
- Debugging a ViT that loads without error but trains poorly.

## Inputs

- `model`: an instantiated ViT `nn.Module`.
- `expected_image_size`: H x W the model will see in production.
- `patch_size`: expected patch size.

## Steps

1. Locate the patch embedding conv inside the model. Report its `kernel_size`, `stride`, `in_channels`, `out_channels`.
2. Compute the expected number of patches. For a square image: `(image_size / patch_size)^2`. For a rectangle: `(H / patch_size) * (W / patch_size)`. Require `H % patch_size == 0` and `W % patch_size == 0`; otherwise flag and refuse.
3. Locate the learned positional embedding. Report its shape `(1, N, dim)`.
4. Compare `N` against `num_patches + 1` (with CLS) or `num_patches` (without CLS). Mismatch means the checkpoint was pretrained at a different resolution or patch size.
5. Check that `out_channels` of the patch conv equals `dim` of the positional embedding.
6. If the model is supposed to interpolate positional embeddings for new resolutions, verify the interpolation utility exists (most `timm` ViTs do this automatically via `resize_pos_embed`).

## Report

```
[vit-inspector]
  image_size:         HxW
  patch_size:         <int>
  num_patches (computed): <int>
  patch_conv:         k=<int>  s=<int>  in=<int>  out=<int>
  pos_embed shape:    (1, N, dim)
  has CLS token:      yes | no
  pos_embed N:        <int>    expected: <int>
  verdict:            ok | mismatch

[if mismatch]
  action:  reinitialise pos_embed for new sequence length
  tool:    timm.models.vision_transformer.resize_pos_embed
```

## Rules

- Never silently interpolate without warning; surface the action so the user knows the pretrained positional structure may have shifted.
- If patch_size mismatches, refuse to recommend interpolation — swap to the correct architecture.
- Do not try to fix the model in place; report and suggest.
