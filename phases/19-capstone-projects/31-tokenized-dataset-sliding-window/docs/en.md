# スライディングウィンドウによるトークン化済み Dataset

> 事前学習は token id から勾配への関数です。このレッスンでは、その id をモデルへ供給するコンベヤを作ります。

**種別:** Build
**言語:** Python
**前提条件:** Phase 04 lessons, Phase 07 transformer lessons, このフェーズの Lesson 30
**所要時間:** 約90分

## 学習目標
- 生コーパスを tokenizer に一度だけ通し、token id のストリームに変換する。
- id ストリームを固定長ウィンドウへ切り出し、stride で重なりを制御する。
- next-token prediction 用に input tensor と target tensor を返す PyTorch Dataset を作る。
- epoch ごとに seed された deterministic shuffle 付き DataLoader を作る。
- stride、冗長性、有効データセットサイズのトレードオフを説明する。

## 全体像
因果言語モデルの学習バッチは `(B, T)` の input ids と `(B, T)` の target ids です。target は input を1つ左にずらしたものなので、1つの訓練例には元の id が `T+1` 個必要です。データパイプラインの仕事は、巨大な生テキストからこの契約を再現可能な形で必要なときに生成することです。

このレッスンでは、前レッスンの tokenizer で長い id 列を作り、sliding window で例を切り出し、Dataset と DataLoader でバッチ化します。末尾に `T+1` 個そろわないウィンドウは捨てます。padding も可能ですが loss mask が必要になるため、ここでは単純さを優先します。

```mermaid
flowchart LR
    A[生コーパステキスト] --> B[tokenizer.encode]
    B --> C[token id の平坦なリスト]
    C --> D[sliding window]
    D --> E[PyTorch Dataset]
    E --> F[seed 付き DataLoader]
    F --> G[(B,T) input と (B,T) target]
```

## なぜ sliding window か
stride が `T` なら非重複ウィンドウ、`T // 2` なら約50%重複、`1` なら最大重複になります。stride を小さくすると例数と境界の多様性は増えますが、epoch あたりの計算量も増えます。大規模事前学習ではコーパスが十分大きいため、context length と同じ stride を使うことが多いです。

## Dataset の契約
`SlidingWindowDataset.__len__` は例数を返し、`__getitem__` は `window[:-1]` と `window[1:]` を long tensor として返します。window の開始位置は `index * stride` からその場で計算するため、stride で例数が増えても保持する id 列は1本だけです。

id ストリーム長を `N`、context length を `T`、stride を `S` とすると、例数は `max(0, 1 + (N - (T + 1)) // S)` です。

## deterministic shuffle
`DataLoader(shuffle=True)` は PyTorch の乱数 generator を使います。明示的な `torch.Generator` に `base_seed + epoch_index` を与えると、同じ seed の再実行で同じ順序を再現できます。ハイパーパラメータ比較では、データ順が変わるだけで loss curve が変わるため、この性質が重要です。

## 実装
`main.py` には `SlidingWindowDataset`、`make_dataloader`、`_encode_corpus_to_ids` があります。デモは小さな tokenizer と組み込みコーパスを使って dataset と dataloader を作り、shape 契約と shift-by-one を確認します。テストは window 数、target shift、deterministic shuffle、stride の効果を固定しています。
