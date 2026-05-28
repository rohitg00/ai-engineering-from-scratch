# Gradient Accumulation

> effective batch size は `micro_batch * accum_steps` で表せる。device memory に入らない batch は、複数の micro batch の gradient を同じ buffer に足し、最後に 1 回だけ optimizer step すればよい。

**種類:** Build
**言語:** Python (torch)
**時間:** 約 90 分

## 学習目標

- micro batch と effective batch の関係を実装する。
- 各 micro batch の loss を `accum_steps` で割ってから backward する。
- accumulation window の最後だけ optimizer step する。
- DDP で非最終 micro batch を `no_sync()` に入れる理由を理解する。
- full batch gradient と accumulated gradient が一致することをテストする。

## 問題

PyTorch は `param.grad` に gradient を加算する。loss を割らずに `N` 回 backward すると gradient は `N` 倍になり、optimizer step も `N` 倍攻撃的になる。正しい accumulation は各 micro loss を `1/N` に scaling し、window 最後に 1 回だけ step する。

## 実装

`train_one_optimizer_step` は micro batch 群を受け取り、gradient を蓄積し、最後に step する。`equivalence_check` は full batch の backward と chunked backward が同じ gradient と post-step parameter を作ることを確認する。`sweep_effective_batches` は throughput と latency の曲線を JSON に出す。

```bash
python3 code/main.py
```

## 運用メモ

Accumulation は統計的な batch size を大きくするが、生 throughput を無料で増やすわけではない。micro batch ごとの forward/backward cost は残るため、optimizer steps per second は下がる。DDP では最後以外の micro batch で all-reduce を抑える。

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
