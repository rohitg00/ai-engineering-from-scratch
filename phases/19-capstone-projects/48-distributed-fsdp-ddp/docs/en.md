# DDP と FSDP を from scratch で理解する

> Multi-rank training は 2 つの collective と 1 つの規則で始まる。起動時に parameter を broadcast し、backward 後に gradient を平均し、rank 同士が step をずらさない。

**種類:** Build
**言語:** Python
**前提:** Phase 19 lessons 42-45
**時間:** 約 90 分

## 学習目標

- `gloo` backend で CPU 上に process group を立ち上げる。
- construction 時に parameter を broadcast し、backward 後に gradient を all-reduce する minimal DDP wrapper を実装する。
- per-rank gradient の平均が concatenated input の single-process gradient と一致することを確認する。
- FSDP の parameter sharding と all_gather による unshard を sketch する。

## 問題

dataset が 1 device に収まらない場合、data parallel で各 rank が batch の slice を処理し、optimizer step の前に gradient を平均する。model も 1 device に収まらない場合は FSDP で parameter を shard し、forward に必要なときだけ full tensor を gather する。

## collective

| collective | 役割 |
|------------|------|
| `broadcast` | rank 0 の tensor を全 rank へコピーする |
| `all_reduce` | 全 rank の tensor を合計し、全 rank が同じ結果を受け取る |
| `all_gather` | 各 rank の tensor を集め、連結結果を全 rank が受け取る |

DDP の契約は construction 時の `broadcast` と backward 後の `all_reduce` である。FSDP は各 layer の forward 前に `all_gather` で full parameter を復元する。

## 実装

`MinimalDDP` は parameter と buffer を rank 0 から broadcast する。`all_reduce_grads_` は gradient を SUM で all-reduce し、`world_size` で割る。`fsdp_round_trip_sketch` は parameter を flatten、padding、slice、all_gather、unpad し、元の tensor と一致することを確認する。

```bash
python3 code/main.py
```

## 運用メモ

CPU では `gloo`、GPU では `nccl` を使う。production DDP は bucketed all-reduce と backward hook で通信を重ねる。production FSDP は flat parameter view、next layer の unshard overlap、CPU offload などを追加するが、形は同じである。

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
