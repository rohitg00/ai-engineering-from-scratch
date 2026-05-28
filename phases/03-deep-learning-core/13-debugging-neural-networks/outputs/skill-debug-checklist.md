---
name: skill-debug-checklist
description: neural network training failures を debug するための decision-tree checklist
version: 1.0.0
phase: 3
lesson: 13
tags: [debugging, neural-networks, training, diagnostics, deep-learning]
---

# Neural Network Debug Checklist

training がうまくいかないときの systematic debugging protocol です。順番に進めてください。ほとんどの bugs は最初の 3 steps で見つかります。

## training 前（bugs を防ぐ）

1. model architecture と parameter count を print します。data に対して size は妥当ですか？
2. random input で single forward pass を実行します。output shape は target shape と一致していますか？
3. labels が正しい dtype であることを確認します（CrossEntropyLoss は Long、BCELoss は Float が必要）
4. data normalization を検証します。inputs は mean near 0、std near 1 であるべきです
5. random な (input, label) pairs を 5 つ print します。labels は期待どおりですか？
6. train/test split に duplicate samples がないことを確認します

## Overfit-one-batch test（60 秒、bugs の 80% を検出）

1. training set から 8-32 samples を取ります
2. 妥当な learning rate で 200 steps 学習します
3. loss は 0 に近づき、training accuracy は 100% に達するはずです
4. 失敗した場合、bug は model、loss function、training loop のどこかにあります。data や hyperparameters ではありません
5. 合格した場合、full training に進みます

## Loss が下がらない

1. learning rate を確認します。3 つの値を試します: current/10、current、current*10
2. layer ごとの gradient norms を print します。すべて 0 なら dead network または detached graph です
3. parameters の `requires_grad=True` を確認します。`loss.backward()` が呼ばれていることも確認します
4. `optimizer.zero_grad()` が `loss.backward()` の前に呼ばれていることを確認します
5. `optimizer.step()` が `loss.backward()` の後に呼ばれていることを確認します
6. model parameters が optimizer に渡されていることを検証します: `optimizer = Adam(model.parameters())`

## Loss が NaN または Inf

1. learning rate を 10x 下げます
2. すべての log() calls に epsilon を追加します: `torch.log(x + 1e-7)`
3. すべての division に epsilon を追加します: `x / (y + 1e-8)`
4. BCE loss の前に predictions を clamp します: `torch.clamp(pred, 1e-7, 1 - 1e-7)`
5. 正確な operation を見つけるために `torch.autograd.detect_anomaly()` を使います
6. input data 内の NaN を確認します: `assert not torch.isnan(x).any()`

## Loss が oscillating する

1. learning rate を 3-10x 下げます
2. batch size を増やします（gradient noise を減らす）
3. gradient clipping を追加します: `torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)`
4. SGD から Adam に切り替えます（parameter ごとの adaptive LR）
5. training の最初の 5-10% に learning rate warmup を追加します

## Overfitting（train acc high, test acc low）

1. dropout を追加します（p=0.1 から始め、0.5 まで増やす）
2. optimizer に weight decay を追加します: `Adam(params, weight_decay=1e-4)`
3. model size を減らします（fewer layers または narrower layers）
4. data augmentation を追加します
5. early stopping を使います。validation loss が 5+ epochs 増えたら停止します
6. train/test sets 間の data leakage を確認します

## Underfitting（train/test acc がどちらも低い）

1. model capacity を増やします（more layers、wider layers）
2. より多くの epochs で学習します
3. learning rate を上げます（慎重に）
4. model が学習できることを確認するため、一時的に regularization を外します
5. model が task に対して十分 expressive か確認します

## Dead ReLU neurons

1. layer ごとの zero activations の割合を確認します。50% 超は問題です
2. LeakyReLU(0.01) または GELU に切り替えます
3. weights に Kaiming initialization を使います
4. learning rate を下げます（大きな updates は neurons を dead zone に押し込むことがあります）
5. activation functions の前に batch normalization を追加します

## Quick reference: learning rate starting points

| Optimizer | Task | Starting LR |
|-----------|------|------------|
| Adam | Training from scratch | 1e-3 |
| Adam | Fine-tuning pretrained | 1e-5 |
| SGD + momentum | Training from scratch | 1e-1 |
| SGD + momentum | Fine-tuning pretrained | 1e-3 |
| AdamW | Transformer training | 3e-4 |

## Quick reference: batch size effects

| Batch size | Gradient noise | Memory | Generalization |
|-----------|---------------|--------|---------------|
| 8-16 | High（noisy） | Low | 良いことが多い |
| 32-64 | Moderate | Moderate | 良い default |
| 128-256 | Low（smooth） | High | warmup が必要なことがある |
| 512+ | Very low | Very high | LR scaling が必要 |

## 何をしても動かないとき

1. model を 1 hidden layer に単純化します。学習しますか？
2. data を 100 samples に単純化します。overfit できますか？
3. loss を MSE に置き換えます。収束しますか？
4. optimizer を SGD(lr=0.01) に置き換えます。進みますか？
5. data を synthetic data（例: y = x[0] > 0）に置き換えます。学習しますか？
6. どれも動かない場合、bug は見ていない code（data loading、preprocessing、tensor shapes）にあります
