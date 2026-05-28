# Gradient Clipping と Mixed Precision

> Mixed precision は速いが overflow を起こす。Gradient clipping は悪い batch の巨大な update を抑える。このレッスンでは global L2 clipping、GradScaler の順序、skip rate logging を 1 step の training loop にまとめる。

**種類:** Build
**言語:** Python (torch)
**時間:** 約 90 分

## 学習目標

- 全 parameter の gradient global L2 norm を計算する。
- `max_norm` を超えた gradient を同じ比率で縮小する。
- AMP の `scale -> backward -> unscale -> clip -> step -> update` の順序を実装する。
- 非有限 loss と非有限 gradient を検出して step を skip する。
- rolling skip rate を log し、FP16 が厳しい regime を見つける。

## 問題

1 つの bad batch が gradient norm を数桁 spike させることがある。clipping は最悪 update を上限で縛る。AMP では loss scaling により backward overflow を避けるが、clip は unscale 後の gradient に対して行う必要がある。

## 実装

`AmpTrainState.step` は autocast、GradScaler、非有限チェック、global norm clipping、optimizer step を接続する。skip した step でも scaler state を進め、`StepLog` に `skipped` と `skip_reason` を残す。

```bash
python3 code/main.py
```

## 運用メモ

数回の skip は正常だが、rolling rate が高い場合は FP16 の指数範囲では持たない可能性が高い。BF16 autocast に切り替えると loss scaling が不要になり、overflow class が消えることが多い。

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
