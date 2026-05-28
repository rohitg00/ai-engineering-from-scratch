---
name: skill-vit-patch-and-pos-embed-inspector
description: ViTのpatch embeddingとpositional embeddingのshapeが、モデルの期待するsequence lengthに一致するか検証する
version: 1.0.0
phase: 4
lesson: 14
tags: [vision-transformer, debugging, pytorch]
---

# ViT Patch and Positional Embedding Inspector

最もよくあるViT移植バグは、224x224で事前学習されたcheckpointを384x384設定のmodelへ読み込むこと（またはその逆）です。positional embeddingのsequence lengthが合わず、modelは黙って壊れた出力を出します。

## 使う場面

- 事前学習済みViTをdefaultではない解像度でfine-tuningするとき。
- ViT-B/16とViT-B/32の間でweight portが失敗する理由をauditするとき。inspectorがpatch-size mismatchを示すので、呼び出し側は無理にportするのではなくarchitectureを替えるべきだと分かる。
- エラーなくloadできるが学習が悪いViTをdebugするとき。

## 入力

- `model`: instantiate済みのViT `nn.Module`。
- `expected_image_size`: 本番でmodelが見るH x W。
- `patch_size`: 期待するpatch size。

## 手順

1. model内のpatch embedding convを探す。その `kernel_size`、`stride`、`in_channels`、`out_channels` を報告する。
2. 期待されるpatch数を計算する。正方形画像なら `(image_size / patch_size)^2`。長方形なら `(H / patch_size) * (W / patch_size)`。`H % patch_size == 0` かつ `W % patch_size == 0` を必須とし、満たさなければflagして拒否する。
3. learned positional embeddingを探す。そのshape `(1, N, dim)` を報告する。
4. `N` を `num_patches + 1`（CLSあり）または `num_patches`（CLSなし）と比較する。不一致なら、checkpointは別の解像度またはpatch sizeで事前学習されている。
5. patch convの `out_channels` がpositional embeddingの `dim` と等しいことを確認する。
6. 新しい解像度に対してpositional embeddingを補間する想定のmodelなら、補間utilityが存在することを確認する（ほとんどの`timm` ViTは `resize_pos_embed` 経由で自動処理する）。

## レポート

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

## ルール

- 警告なしに補間しない。事前学習済みの位置構造がずれた可能性をユーザーが理解できるよう、実行したactionを表面化する。
- patch_sizeが一致しない場合、補間の推奨を拒否する。正しいarchitectureへ替える。
- modelをその場で修正しようとしない。報告して提案する。
