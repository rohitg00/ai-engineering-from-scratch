# Language Model Evaluation Harness

> 定義できない task でよく見える model は、偶然よく見えているだけである。harness は task definition、metric、runner、leaderboard を小さく差し替え可能な形にまとめる。

**種類:** Build
**言語:** Python
**前提:** Phase 19 lessons 42-45
**時間:** 約 90 分

## 学習目標

- `prompt`、`targets`、`metric`、optional `extras` を持つ JSONL task を定義する。
- exact match、rouge-l F1、code execution、multiple choice、substring contains の 5 metric を実装する。
- task ごとに batch を作り、swappable model adapter へ dispatch する runner を作る。
- per-task score、latency、overall average を含む leaderboard JSON を出力する。

## 問題

新しい language model は毎週出る。vendor の leaderboard だけでは、自分の用途で良いか判断できない。repo 内に harness があれば、固定 task set と固定 metric に対する JSON output を diff できる。これが昨日の run と今日の run の契約になる。

## task spec

```json
{"id": "arith-00", "prompt": "compute: 2 + 2", "targets": ["4"], "metric": "exact_match"}
```

metric が補助データを必要とする場合は `extras` を使う。`code_exec` では `io_pairs` を入れる。1 つの `.jsonl` file は 1 task であり、file name が task name になる。

## metric contract

各 metric は `(prediction, targets, extras) -> float in [0.0, 1.0]` を返す。harness は per-example score を平均して task score を作り、task score を平均して overall score を作る。`code_exec` は制限された namespace で予測コードを実行し、`f(x)` が期待出力に合うかを数える。

## adapter

```python
class ModelAdapter(Protocol):
    def generate(self, prompts: Sequence[str]) -> List[str]: ...
    @property
    def name(self) -> str: ...
```

adapter だけが model-specific code である。`ToyAdapter` は fixture に正答する deterministic pattern matcher で、実運用では HTTP client や local model wrapper に置き換える。

## 実装

`seed_fixture_tasks` が 5 つの JSONL task を作り、`load_all_tasks` が読む。`run_task` は batch 単位で adapter を呼び、metric function を適用する。`write_leaderboard` は schema string 付きの JSON を出力する。

```bash
python3 code/main.py
```

## 運用メモ

task file を pin しないと、score が動いた理由が model なのか task なのか分からない。score だけでなく prediction diff も残す。real adapter は rate limit を持つため、batch size は控えめに保つ。

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
