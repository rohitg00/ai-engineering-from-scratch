# Linear Warmup 付き Cosine Learning Rate

> 学習率 schedule は optimizer の実効 step size を決める。最初は小さく立ち上げ、安定した後に cosine decay で下げる。このレッスンでは stateless な schedule 関数、AdamW への接続、gradient norm logging を実装する。

**種類:** Build
**言語:** Python (torch)
**時間:** 約 90 分

## 学習目標

- step から learning rate を返す closed-form schedule を書く。
- warmup endpoint と total endpoint の連続性をテストする。
- optimizer の param group に現在の lr を反映する。
- loss と gradient L2 norm を lr と同じ log に残す。
- alternative schedule と比較できる形にする。

## 問題

初期 update は noisy で、いきなり `lr_max` を使うと発散または plateau が起きやすい。linear warmup は推定が安定するまで実効 step を小さくする。warmup 後は cosine decay で滑らかに `lr_min` へ向かう。

## 実装

`CosineWithWarmup.lr(step)` は `step=0` で 0、`warmup_steps` で `lr_max`、`total_steps` で `lr_min` を返す。`step > total_steps` は外挿せず `lr_min` に pin する。`TrainState.step` は schedule を optimizer に反映し、forward/backward/step を実行して `StepLog` を返す。

```bash
python3 code/main.py
```

## 見るべき log

Learning rate だけでは training health は分からない。gradient L2 norm を一緒に出すと、warmup 後も norm が高止まりする schedule や、loss より先に norm が spike する divergent run を検出できる。

## 運用メモ

production では warmup を固定 step ではなく total steps の 1-3% 程度の fraction で指定することが多い。`lr_min` は 0 にせず、`lr_max` の 10% 近辺に floor を置くと long tail の学習信号を残せる。

## 演習

1. 主要なハイパーパラメータを 1 つ変え、出力がどう変わるかを記録する。
2. 失敗ケースを 1 つ追加し、現在の実装がそれを検出できるか確認する。
3. 生成される JSON に、後段の CI が使える追加メタデータを 1 つ入れる。
4. 実運用で必要になる監視指標を 1 つ足す。
5. このレッスンの成果物を次のフェーズの入力として使う手順を書き出す。

## 重要語

| 用語 | 意味 |
|------|------|
| fixture | 教材内で固定して使う小さな検証データ |
| manifest | 後段が信頼する成果物一覧とメタデータ |
| schema | JSON や checkpoint 形式のバージョンを示す文字列 |
| aggregate | 個別指標を重み付き、または平均でまとめた値 |

## 参考

- PyTorch と Python 標準ライブラリの公式ドキュメント。
- このフェーズの直前レッスンで扱った tokenizer、checkpoint、training loop。
- 実運用では、ここで作った小さな実装をそのまま信頼せず、失敗時の再実行と監査ログを追加する。
