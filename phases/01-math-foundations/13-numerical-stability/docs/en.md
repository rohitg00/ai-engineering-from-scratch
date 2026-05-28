# 数値安定性

> 浮動小数点は漏れのある抽象化です。学習中に突然噛みつき、事前には見えません。

**種別:** 構築
**言語:** Python
**前提条件:** Phase 1, Lessons 01-04
**所要時間:** 約120分

## 学習目標

- max-subtraction trick を使って、数値的に安定な softmax と log-sum-exp を実装する
- floating-point computations における overflow、underflow、catastrophic cancellation を見分ける
- centered finite differences で analytical gradients と numerical gradients を照合する
- training で bfloat16 が float16 より好まれる理由と、loss scaling が gradient underflow を防ぐ仕組みを説明する

## 問題

モデルを 3 時間学習したあと、loss が NaN になります。print を入れると、step 9,000 では logits は正常です。step 9,001 で `inf` になり、step 9,002 ではすべての gradient が `nan` になって学習は終了します。

別の例では、モデルは最後まで学習できますが、accuracy が論文より 2% 低くなります。architecture、hyperparameters、data は一致しています。違いは、論文が float32 を使い、あなたが適切な scaling なしで float16 を使ったことです。丸め誤差の蓄積が静かに精度を食べます。

また、cross-entropy loss を一から実装したとします。小さな logits では動きますが、logits が 100 を超えると `inf` を返します。`exp(100)` は float32 で表現できる範囲を超えるため、softmax が overflow したのです。主要な ML framework は、この問題を 2 行の trick で処理しています。

数値安定性は理論上の細部ではありません。成功する training run と、静かに失敗する run の差です。

## 概念

### IEEE 754: コンピュータが実数を保存する方法

実数は IEEE 754 standard に従う floating point values として保存されます。float は sign bit、exponent、mantissa（significand）を持ちます。

```text
Float32 layout (32 bits total):
[1 sign] [8 exponent] [23 mantissa]

Value = (-1)^sign * 2^(exponent - 127) * 1.mantissa
```

mantissa は precision（有効桁数）を決め、exponent は range（表現できる大きさ）を決めます。

```text
Format     Bits   Exponent  Mantissa  Decimal digits  Range (approx)
float64    64     11        52        ~15-16          +/- 1.8e308
float32    32     8         23        ~7-8            +/- 3.4e38
float16    16     5         10        ~3-4            +/- 65,504
bfloat16   16     8         7         ~2-3            +/- 3.4e38
```

float32 は約 7 桁の decimal precision を持ちます。float16 は約 3 桁で、最大値は 65,504 です。logits、gradients、activations がこの値を超える ML では小さすぎます。bfloat16 は float32 と同じ 8-bit exponent を持つため range が広く、precision は低くても training ではしばしば float16 より安定します。

### なぜ 0.1 + 0.2 != 0.3 なのか

0.1 は binary floating point で正確に表現できません。

```text
0.1 in binary = 0.0001100110011001100110011... (repeating forever)
```

保存時に切り詰められるため、和は 0.3 からわずかにずれます。

```python
>>> 0.1 + 0.2
0.30000000000000004

>>> 0.1 + 0.2 == 0.3
False
```

ML では、loss comparisons、長い gradient update の蓄積、reproducibility tests に影響します。float を `==` で比較せず、`abs(a - b) < epsilon` や `math.isclose()` を使います。

### Catastrophic Cancellation

ほぼ等しい floating point numbers を引くと、有効桁が打ち消され、丸め誤差が先頭桁として残ります。

```text
a = 1.0000001
b = 1.0000000

True difference:  0.0000001
Computed:         0.00000011920929
Relative error:   19.2%
```

大きな平均を持つデータの variance を `E[x^2] - E[x]^2` で計算する、近い log-probabilities を引く、finite-difference gradients で epsilon を小さくしすぎる、といった場面で起こります。式を並べ替え、variance には Welford algorithm、log-probabilities には log-space を使います。

### Overflow と Underflow

Overflow は結果が大きすぎて表現できないときに起こり、underflow は小さすぎて 0 に潰れるときに起こります。

```text
Float32 boundaries:
  Maximum:  3.4028235e+38
  Minimum positive (normal): 1.175e-38
  Minimum positive (denorm): 1.401e-45
```

ML で最大の原因は `exp()` です。softmax、sigmoid、probability computations に現れます。`log()` は cross-entropy、log-likelihoods、KL divergence に現れます。`log(exp(x))` は正しい trick なしでは危険です。

### Log-Sum-Exp Trick

`log(sum(exp(x_i)))` を直接計算すると、large `x_i` で overflow し、すべてが非常に負なら underflow して `log(0)` になります。

```text
log(sum(exp(x_i))) = max(x) + log(sum(exp(x_i - max(x))))
```

最大値を引くと、最大 exponent は `exp(0) = 1` です。overflow は起きず、少なくとも 1 つの項が 1 なので合計は 1 以上です。

この trick は softmax normalization、cross-entropy loss、sequence models の log-probability summation、mixture of Gaussians、variational inference で使われます。

### Softmax に max-subtraction が必要な理由

```text
softmax(x_i) = exp(x_i) / sum(exp(x_j))
```

logits が [100, 101, 102] のように大きいと、float32 では `exp(100)` が `inf` になります。`max(x) = 102` を引けば、指数は `exp(-2)`、`exp(-1)`、`exp(0)` になり安全です。確率は数学的に同じで、計算だけが安定します。これは最適化ではなく正しさの要件です。

### NaN と Inf の検出・予防

`nan` と `inf` は計算全体に伝播します。1 つの `nan` が weight update に入ると、以降の出力はすべて `nan` になります。

```python
import math

math.isnan(x)
math.isinf(x)
math.isfinite(x)
```

予防策:

1. `exp()` の入力を clamp する: `exp(clamp(x, -80, 80))`
2. 分母に epsilon を足す: `x / (y + 1e-8)`
3. `log()` の内側に epsilon を足す: `log(x + 1e-8)`
4. log-sum-exp や stable softmax のような安定実装を使う
5. gradient clipping で weight explosion を防ぐ
6. debugging 中は forward pass ごとに `nan`/`inf` を確認する

### Numerical Gradient Checking

backpropagation で得た analytical gradients にバグがないか、finite differences で検証します。

```text
df/dx ~= (f(x + h) - f(x - h)) / (2h)
```

centered difference は O(h^2) accurate で、forward difference より良い近似です。`h` が大きすぎると近似が粗く、小さすぎると catastrophic cancellation が起きます。典型値は `h = 1e-5` から `1e-7` です。

```text
relative_error = |grad_analytical - grad_numerical| / max(|grad_analytical|, |grad_numerical|, 1e-8)
```

目安:
- relative_error < 1e-7: 完璧
- relative_error < 1e-5: 許容範囲
- relative_error > 1e-3: 何かがおかしい
- relative_error > 1: gradient が完全に誤っている

### Mixed Precision Training

modern GPUs の Tensor Cores は float16 matrix multiplications を float32 より高速に処理します。mixed precision training では float32 の master weights を持ち、forward/backward は float16 で高速化し、loss や update では float32 を使います。

pure float16 training の問題は、小さな gradients が ~6e-8 未満で zero に underflow することです。loss scaling は loss を大きな係数（例: 1024）で掛けて backward し、update 前に勾配を元に戻します。数学的な update は同じですが、underflow を避けられます。

Dynamic loss scaling は scale を自動調整します。gradients が `inf` になれば半分にし、しばらく overflow がなければ倍にします。

### bfloat16 vs float16

```text
float16:   [1 sign] [5 exponent]  [10 mantissa]
bfloat16:  [1 sign] [8 exponent]  [7 mantissa]
```

float16 は precision がやや高い一方で range が狭く、training spikes で overflow しやすいです。bfloat16 は precision が低いものの float32 と同じ range を持ち、training では多くの場合こちらが有利です。inference では値が bounded で precision が重要になるため float16 が好まれることもあります。

### Gradient Clipping

exploding gradients は RNNs、deep networks、transformers でよく起こります。

```text
Clip by value:
grad = clamp(grad, -max_val, max_val)

Clip by norm:
if ||grad|| > max_norm:
    grad = grad * (max_norm / ||grad||)
```

standard choice は direction を保つ clip by norm です。PyTorch では `torch.nn.utils.clip_grad_norm_()` を使います。typical values は transformers で `max_norm=1.0`、RL で `max_norm=0.5`、単純な networks で `max_norm=5.0` です。

### Normalization Layers

Batch normalization、layer normalization、RMS normalization は convergence を助けるだけでなく、数値安定化にも効きます。activation が層を通るたびに増減して overflow や gradient explosion を起こすのを防ぎます。

```text
LayerNorm(x) = (x - mean(x)) / (std(x) + epsilon) * gamma + beta
```

`epsilon` はすべての activations が同一のときの division by zero を防ぎます。

### よくある ML 数値バグ

- loss が数 epoch 後に NaN: logits が大きくなり softmax が overflow、または learning rate が高すぎる。stable softmax、learning rate 低下、gradient clipping を使います。
- loss が log(num_classes) に張り付く: 出力が一様に近く、model が学習していない可能性。labels、loss function、dead ReLUs を確認します。
- validation accuracy が 1-3% 低い: mixed precision の loss scaling 不足により小さな updates が underflow。dynamic loss scaling または bfloat16 を使います。
- gradient norms が一部の層で 0.0: dead ReLU または float16 underflow。LeakyReLU/GELU、gradient scaling、initialization を確認します。
- GPU が違うと結果が違う: floating point addition は associative ではなく、parallel reductions の順序が変わります。小さな差を許容するか deterministic algorithms を使います。

## 実装

完全な実装は `code/numerical.py` を参照してください。ここでは、floating point precision の限界、naive/stable softmax、stable log-sum-exp、stable cross-entropy、gradient checking、float16/bfloat16 の差を確認します。

```python
import math

def softmax_stable(logits):
    max_logit = max(logits)
    exps = [math.exp(z - max_logit) for z in logits]
    total = sum(exps)
    return [e / total for e in exps]

def logsumexp_stable(values):
    c = max(values)
    return c + math.log(sum(math.exp(v - c) for v in values))
```

```python
def numerical_gradient(f, x, h=1e-5):
    grad = []
    for i in range(len(x)):
        x_plus = x[:]
        x_minus = x[:]
        x_plus[i] += h
        x_minus[i] -= h
        grad.append((f(x_plus) - f(x_minus)) / (2 * h))
    return grad
```

## Use It

実務では、手書きの `softmax()` と `log()` の組み合わせを避け、framework の安定実装を使います。PyTorch なら `F.cross_entropy()`、`F.log_softmax()`、`torch.logsumexp()` を使います。mixed precision では AMP と dynamic loss scaling を有効にし、可能なら bfloat16 を検討します。

## Exercises

1. naive softmax と stable softmax を実装し、logits `[100, 101, 102]` で比較する。
2. `logsumexp_naive` と `logsumexp_stable` を実装し、large positive values と large negative values で挙動を確認する。
3. centered finite differences で simple function の gradients を確認し、`h` を変えて catastrophic cancellation を観察する。
4. float16 と bfloat16 の表現範囲の違いをシミュレーションし、どの値が overflow/underflow するか調べる。
5. NaN/Inf を検出する hooks を小さな PyTorch model に追加し、問題の層を特定する。

## Key Terms

| Term | Definition |
|---|---|
| Floating point | sign、exponent、mantissa で実数を近似表現する形式 |
| Precision | 区別できる有効桁数 |
| Range | 表現できる最大・最小の大きさ |
| Overflow | 値が大きすぎて `inf` になること |
| Underflow | 値が小さすぎて 0 に潰れること |
| Catastrophic cancellation | 近い値の減算で有効桁が消え、丸め誤差が支配的になること |
| Log-sum-exp trick | 最大値を引いて `log(sum(exp(x)))` を安定化する手法 |
| Stable softmax | max-subtraction により overflow を防ぐ softmax |
| Gradient checking | analytical gradients を finite differences で検証する方法 |
| Loss scaling | float16 gradients を underflow させないため loss を一時的に拡大する手法 |
| bfloat16 | float32 と同じ exponent range を持つ 16-bit float |

## 参考文献

- [What Every Computer Scientist Should Know About Floating-Point Arithmetic](https://docs.oracle.com/cd/E19957-01/806-3568/ncg_goldberg.html)
- [PyTorch Automatic Mixed Precision](https://pytorch.org/docs/stable/amp.html)
- [torch.logsumexp documentation](https://pytorch.org/docs/stable/generated/torch.logsumexp.html)
- [IEEE 754 Floating-Point Standard](https://ieeexplore.ieee.org/document/8766229)
