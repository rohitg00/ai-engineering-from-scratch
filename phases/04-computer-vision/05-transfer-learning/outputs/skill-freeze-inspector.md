---
name: skill-freeze-inspector
description: どの parameters が trainable か、どの BatchNorm layers が eval mode か、optimizer が trainable parameters を実際に消費しているかを報告する
version: 1.0.0
phase: 4
lesson: 5
tags: [computer-vision, transfer-learning, debugging, pytorch]
---

# Freeze Inspector

Transfer-learning のバグは 3 か所に隠れます。凍結すべきなのに凍結されていない parameters、trainable であるべきなのに trainable でない parameters、freeze state を変える前に作られた optimizers です。この skill は 1 回の pass で 3 つすべてを表に出します。

## When to use

- parameters の一部に `requires_grad` を設定した直後。
- fine-tune run の最初の training step の前。
- `freeze_bn_stats` または BN mode を切り替える helper を呼んだ後。
- val accuracy が random で止まり、実際には何も学習されていない疑いがあるとき。

## Inputs

- `model`: PyTorch の `nn.Module`。
- `optimizer`: training に使う直前の optimizer。
- Optional `expected_frozen_prefixes`: 凍結されているべき parameter-name prefixes の list（例: `["conv1", "bn1", "layer1"]`）。

## Steps

1. **Walk parameters.** 各 `(name, param)` について以下を記録する。
   - `requires_grad`
   - `shape` と `numel`

2. **Walk modules.** 各 module について以下を行う。
   - BatchNorm なら、eval mode かどうか、affine parameters が trainable かどうかを記録する。

3. **Inspect the optimizer.** 各 parameter group について以下を行う。
   - `params` を `id(p)` の set に flatten する。
   - `requires_grad == True` の params すべての `id(p)` set と比較する。

4. **Detect the four failure modes:**
   - `leaked_train`: param が `requires_grad=True` だが optimizer に入っていない（gradient は計算されるが適用されない）。
   - `ghost_train`: param が optimizer に入っているが `requires_grad=False`（optimizer state が無駄になる。後で requires_grad を再有効化した場合にも bug になり得る）。
   - `bn_mismatch`: (a) BN layer が train mode（running stats を蓄積）なのに affine parameters（`weight`, `bias`）が frozen、または (b) BN layer が eval mode（stats frozen）なのに affine parameters が trainable。どちらも不整合で、ほぼ常に bug です。
   - `expected_vs_actual`: `expected_frozen_prefixes` に listed された prefix の parameter がまだ trainable。

## Report

```
[freeze-inspector]
  model trainable params: <N>
  model frozen params:    <N>
  batchnorm layers in eval mode: <count>
  batchnorm layers in train mode: <count>

[optimizer coverage]
  trainable params fed to optimizer: <M> of <N>
  leaked_train: <list of names> (trainable but not in optimizer)
  ghost_train:  <list of names> (in optimizer but frozen)

[bn audit]
  mismatched layers: <list of names>

[expectations]
  expected_frozen_prefixes: <...>
  violating params:         <list>

[verdict]
  ok | <one-line summary of the most severe issue>
```

## Rules

- parameter names だけを報告し、weights 自体は絶対に表示しない。
- すべての list は parameter name の alphabetic order で sort する。
- optimizer coverage が 100% で mismatch がなければ、`ok` を返してそこで止める。
- `leaked_train` では、freeze state 変更後に optimizer を再構築するよう必ず推奨する。
- `ghost_train` では、parameter group を削除するか、train する意図なら `requires_grad=True` にするよう推奨する。
