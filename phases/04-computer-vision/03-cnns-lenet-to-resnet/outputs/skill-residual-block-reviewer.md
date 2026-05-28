---
name: skill-residual-block-reviewer
description: PyTorch の residual block について、skip-connection の正しさ、BN placement、activation order、shape alignment をレビューする
version: 1.0.0
phase: 4
lesson: 3
tags: [computer-vision, resnet, code-review, pytorch]
---

# 残差ブロックレビュー

residual block を実装している PyTorch `nn.Module` のための、焦点を絞ったレビュー用 skill です。壊れた ResNet 再実装のほぼすべてを占める 4 つのミスを検出します。

## 使う場面

- 誰かが custom BasicBlock または Bottleneck を書き、loss が NaN になるか accuracy が伸びない。
- block をある framework から別の framework へ port しており、等価性を確認したい。
- ResNet internals (pre-activation, squeeze-excite, anti-alias) を変える PR をレビューしている。
- model は CIFAR サイズ入力では問題なく ship できるが、shortcut が誤っているため ImageNet resolution で crash する。

## 入力

- PyTorch class definition。source text または importable path のどちらでもよい。
- 任意の `variant`: `basic` | `bottleneck` | `preact` | `seblock`。

## 4 つのチェック

### 1. shortcut の shape alignment

`stride != 1` または `in_channels != out_channels` である block では、shortcut path は shape を合わせる module でなければなりません。通常は 1x1 conv と BN です。この場合に裸の `nn.Identity()` を使うと、forward 時に確実に shape-mismatch error になります。

診断:
```
[shortcut]
  detected:  nn.Identity | 1x1 Conv + BN | 1x1 Conv + BN + ReLU | other
  required:  shape-matching Conv if (stride != 1 or in_c != out_c) else Identity
  verdict:   ok | wrong | unnecessarily heavy
```

### 2. addition に対する BN placement

addition `out + shortcut(x)` は、final ReLU より **前** に行う必要があります (post-activation、original ResNet)。または final ReLU を完全になくします (pre-activation ResNet v2)。main branch で ReLU を適用してから raw shortcut を足す block は、activation range が非対称になり、training を悪化させます。

診断:
```
[activation order]
  pattern:  post-act (conv-BN-ReLU-conv-BN-add-ReLU) | pre-act (BN-ReLU-conv-BN-ReLU-conv-add) | other
  verdict:  ok | suspect
```

### 3. conv layer の bias

直後に BatchNorm が続く conv は `bias=False` にするべきです。BN の beta がすでに bias を parameterise するため、追加の conv bias はパラメータを無駄にし、convergence を遅くすることがあります。

診断:
```
[bias]
  convs with BN and bias=True: <count>
  recommended fix: set bias=False on those layers
```

### 4. in-place ReLU と autograd

shortcut に足される tensor に対する `nn.ReLU(inplace=True)` は、residual add にまだ必要な値を上書きする可能性があります。add より前に新しい tensor を生成する layer が続かない `inplace=True` をすべて指摘してください。

診断:
```
[in-place]
  risky inplace ops: <list>
  fix: inplace=False before the residual add
```

## レポート

```
[block-review]
  variant:       basic | bottleneck | preact | se | other
  shortcut:      ok | wrong | heavy
  activation:    ok | suspect
  bias-bn:       ok | <N> convs need bias=False
  in-place:      ok | <N> risky ops
  summary:       one sentence
```

## ルール

- block を書き換えない。報告だけを行う。
- block が正しい場合は、すべてに `ok` と書いて終了する。提案は不要。
- 複数の問題がある場合は、上の順序で列挙する。shortcut が crash の最も一般的な原因なので最初に置く。
- ユーザーが意図的に指定した pre-activation または squeeze-excite variant を、誤りとして指摘してはいけない。
