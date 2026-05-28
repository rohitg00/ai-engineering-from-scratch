# Training Loop and Evaluation

> 測らない training loop は信用できません。このレッスンでは GPT を学習する loop、評価、sample 生成、JSONL logging を作ります。

**種別:** Build
**言語:** Python
**前提条件:** Phase 19 lessons 30-35
**所要時間:** 約90分

## 学習目標
- next-token prediction の input/target alignment で cross entropy loss を計算する。
- AdamW の weight decay を matrix weight にだけ適用し、LayerNorm や bias は no decay にする。
- linear warmup + cosine decay の learning-rate schedule を実装する。
- held-out split で `evaluate_model` を実行し、run 間で比較可能な eval loss を得る。
- 定期的に sample を生成し、loss だけでは見えない破綻を検出する。
- step ごとの loss を JSONL に保存する。

## loop の構成
バッチは `(input, target)` で、target は input を1つ左へずらしたものです。model forward、flatten、cross entropy、backward、gradient clipping、AdamW step、LR 更新、JSONL 追記を毎 step 行います。一定 step ごとに validation loss と sample generation も実行します。

## 重要な点
shift を忘れると、モデルは自分自身を予測するだけになり、loss は下がっても next-token prediction を学びません。

AdamW では linear weight や embedding table のような matrix-shaped tensors にだけ decay をかけます。LayerNorm scale を decay すると正規化が壊れやすく、bias への decay は効果が薄いです。

評価は `torch.no_grad()` と `model.eval()` で固定数の validation batches を使います。同じ seed と split なら同じ eval loss になり、ハイパーパラメータ比較ができます。

## 実装
`make_batches`、`calc_loss_batch`、`evaluate_model`、`generate_and_print_sample`、`build_param_groups`、`cosine_with_warmup`、`train` を実装します。デモは synthetic token tensor で短時間学習し、`outputs/losses.jsonl` を書きます。
