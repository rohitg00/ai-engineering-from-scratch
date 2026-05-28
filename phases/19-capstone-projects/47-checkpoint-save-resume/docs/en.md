# Checkpoint Save and Resume

> checkpoint は model weights だけではない。optimizer、scheduler、step counter、loss history、RNG state まで保存して初めて、kill された training run が同じ軌跡で resume できる。

**種類:** Build
**言語:** Python (torch, numpy)
**時間:** 約 90 分

## 学習目標

- 完全な training checkpoint payload を作る。
- temporary file に書いてから `os.replace` する atomic save を実装する。
- model state を複数 shard に分割し、index に sha256 を記録する。
- `(epoch, batch_in_epoch)` と RNG state で mid-epoch resume する。
- resume 後の loss trajectory が uninterrupted baseline と一致することを検証する。

## 問題

model weights だけを復元しても、Adam の moments、scheduler の位置、random generator の状態が違えば別の training run になる。checkpoint は「同じ曲線へ戻る」ための契約である。

## 実装

`save_checkpoint` は model、optimizer、scheduler、`TrainState`、RNG を payload に入れる。`atomic_save` は target と同じ directory の temp file に書き、`os.replace` で入れ替える。sharded checkpoint は model tensor を shard に分け、`index.json` で各 shard と `meta.pt` の hash を検証する。

```bash
python3 code/main.py
```

## 運用メモ

cross-device rename は atomic ではないので temp file は target と同じ directory に置く。schema string は将来の format migration hook である。resume demo の `max_loss_diff_after_resume` がほぼ 0 なら、RNG と optimizer state が正しく戻っている。

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
