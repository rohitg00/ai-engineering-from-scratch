# 自律型コーディングエージェントのランドスケープ（2026）

> SWE-bench Verified は3年足らずで4%から80.9%まで伸びた。同じ Claude Sonnet 4.5 でも、SWE-agent v1 では43.2%、Cline autonomous では59.8%を記録した。いまやモデルを取り巻くスキャフォールドは、モデルそのものと同じくらい重要になっている。OpenHands（旧 OpenDevin）は最も活発な MIT ライセンスのプラットフォームで、その CodeAct ループは JSON ツール呼び出しではなく、サンドボックス内で Python アクションを直接実行する。ただし目を引く数値の裏には方法論上の問題がある。SWE-bench Verified の500タスクのうち161件は1〜2行の変更だけで済み、同じフロンティアモデルでも SWE-bench Pro（10行以上のタスク）では23〜59%にとどまる。

**種別:** 学習
**言語:** Python (stdlib, CodeAct vs JSON tool-call comparison)
**前提条件:** Phase 14 · 07 (Tool use), Phase 15 · 01 (Long-horizon agents)
**所要時間:** 約45分

## 問題

「どのコーディングエージェントが最良か」は問いとして間違っている。正しい問いはこうだ。自分の仕事に合ったタスク分布で、本番で実際に動かすスキャフォールドを使ったとき、エンドツーエンドでどれだけの信頼性が得られるのか。

2022年から2026年にかけて、この分野ではスキャフォールド、つまり検索層、プランナー、サンドボックス、編集と検証のループ、フィードバック形式が土台として重要だと分かった。SWE-bench Verified で Claude Sonnet 4.5 は SWE-agent v1 上では43.2%だったが、同じモデルを Cline の自律型スキャフォールドに入れると59.8%になった。同じ重みで16.6ポイントの絶対差だ。ベースモデルは構成要素であり、ループこそがプロダクトである。

これに付随する問題は、ベンチマークの飽和が回帰を見えにくくすることだ。SWE-bench Verified は飽和に近く、簡単なタスクの裾野（500タスク中161件が2行以下の変更）が上位スコアを押し上げている。実世界の品質は、SWE-bench Pro（10行以上の変更）のような分布で測る方がよい。同じ上位システムでも、そこではまだ23〜59%にとどまっている。

## 概念

### SWE-benchを一段落で

SWE-bench（Jimenez ら）は、正解パッチがある実際の GitHub issue を取り、テストスイートを通すパッチをエージェントに生成させるベンチマークだ。SWE-bench Verified（OpenAI, 2024）は、人手で曖昧なタスクや壊れたタスクを取り除いた500タスクのサブセットである。SWE-bench Pro はその後継となるより難しい版で、10行以上の変更を必要とするタスクで構成され、現在のフロンティアエージェントは23〜59%に位置している。

### 2022 → 2026の曲線が本当に示すもの

- **2022**: 研究用モデルは生の SWE-bench で約4%。
- **2024**: GPT-4 + Devin 型スキャフォールドが約14%、SWE-agent が約12%。
- **2025**: Aider や SWE-agent 内の Claude 3.5/3.7 Sonnet が40〜55%台に到達。
- **2026**: Claude Sonnet 4.5 と競合フロンティアモデルが SWE-bench Verified で70〜80%超。Epoch AI のリーダーボードがこれをライブで追跡している。

この傾きは、3つの要因が複合した結果だ。ベースモデルの改善、スキャフォールド（CodeAct、reflection、verifier loop）の改善、そしてノイズを除いた Verified のようなベンチマークの改善である。

### CodeAct vs JSONツール呼び出し

OpenHands（All-Hands-AI、arXiv:2407.16741、旧 OpenDevin）は、明確なアーキテクチャ上の賭けをした。モデルがホストにデコード・実行される JSON ツール呼び出しを出す代わりに、Python コードを出力し、Jupyter 形式のカーネルがサンドボックス内でそれを実行する。エージェントは1つのアクション内でファイルを反復処理し、ツールを連鎖させ、自分の例外を捕捉できる。

トレードオフは次の通り。

- **JSON tool calls**: 各アクションは1ターン。監査しやすい。合成可能性は限られる。各呼び出しが明示的なバリデーターを通るため、デフォルトで安全寄り。
- **CodeAct**: 1つのアクションが丸ごとプログラムになり得る。合成しやすい。強固なサンドボックスが必要（OpenHands は Docker 分離を使う）。障害モードには、サンドボックス実行環境が許すあらゆることが含まれる。

どちらのアーキテクチャも本番で使われている。CodeAct はオープンプラットフォーム（OpenHands、smolagents）で優勢だ。JSON ツール呼び出しは、プロバイダーが実行器を管理するマネージドサービス（Anthropic Managed Agents、OpenAI Assistants）で引き続き主流である。

### 2026年のランドスケープにおけるスキャフォールド

| スキャフォールド | ライセンス | 実行モデル | 特筆すべき性質 |
|---|---|---|---|
| OpenHands (OpenDevin) | MIT | CodeAct in Docker | 最も活発なオープンプラットフォーム。イベントストリームを再生可能 |
| SWE-agent | MIT | Agent-Computer Interface (ACI) | 初のエンドツーエンド SWE-bench スキャフォールド |
| Aider | Apache-2 | edit-via-diff in local repo | 最小限のスキャフォールド。回帰安定性が高い |
| Cline | Apache-2 | VS Code agent with tool policy | Sonnet 4.5 上で最高スコアのオープンスキャフォールド |
| Devin (Cognition) | Proprietary | Managed VM + planner | 「AI software engineer」というプロダクトカテゴリの先駆け |
| Claude Code | Proprietary | Permission modes + routines | レッスン10でエージェントループを詳しく扱う |

### なぜスキャフォールドが支配的になるのか

コーディング実行は長期ホライズンの軌跡である（レッスン1）。信頼性はステップをまたいで複利的に効く。スキャフォールドが点数を稼ぐ場所は主に3つある。

1. **Retrieval**: 読むべきファイルを見つけることは、目立たないボトルネックである。SWE-agent の ACI、OpenHands のファイルインデックス、Aider の repo-map はいずれもここに取り組んでいる。
2. **Verifier loop**: テストを実行し、スタックトレースを読み、再試行するだけで、SWE-bench では10ポイント以上の差が出る。
3. **Failure containment**: エラー時にロールバックするサンドボックスは、損傷の連鎖を防ぐ。検証ループがある場合とない場合では、同じモデルがまるで別のプロダクトのように見える。

### ベンチマークの飽和と実際の分布

OpenHands の著者と Epoch AI はどちらも、SWE-bench Verified には簡単な裾野があると指摘している。500タスク中161件は1〜2行の変更だけで済む。高スコアは部分的にこの裾野によって押し上げられている。SWE-bench Pro は10行以上の変更に制限しており、フロンティアシステムでもスコアは23〜59%の範囲に戻る。本番環境の分布は、ほぼ間違いなく Verified より Pro に近い。

エージェント選定への含意は、自社のバグバックログから Pro に近いサブセットを実行することだ。重要なスコアは、自分たちが実際に出荷するタスクを代表するタスク上のスコアである。

## 使ってみる

`code/main.py` は、固定されたミニタスク分布上で2つの小さなエージェントスキャフォールドを比較する。

1. 1ターンに1アクションを取る **JSON tool-call** スキャフォールド。
2. 1アクションごとに小さな Python スニペットを出力できる **CodeAct** スキャフォールド。

どちらもスタブの「モデル」（決定的なルール）を使うため、この比較ではモデル品質からスキャフォールドを切り分けている。出力を見ると、CodeAct スキャフォールドはアクションごとのブラスト半径が大きくなる代わりに、より少ないターンでより多くのタスクを解くことが分かる。

## 実務に持ち込む

`outputs/skill-scaffold-audit.md` は、コーディングエージェントのスキャフォールドを採用する前に、検索品質、検証器の有無、サンドボックス分離、ベンチマークと実分布の適合を監査するための助けになる。

## 演習

1. `code/main.py` を実行する。同じタスクセットで、各スキャフォールドは何ターンかかるか。各アクションのブラスト半径はどの程度か。

2. OpenHands 論文（arXiv:2407.16741）を読む。論文は、複雑なタスクでは CodeAct が JSON ツール呼び出しを上回ると主張している。論文が認めている障害モードを1つ挙げ、そのモードが本番で支配的になるのはどんな場合かを1文で書く。

3. 自分のバグバックログから、2ファイルにまたがる10行以上の変更が必要なタスクを1つ選ぶ。フロンティアモデルのエンドツーエンド成功確率を、(a) JSON ツール呼び出し、(b) CodeAct のそれぞれについて見積もる。差を正当化する。

4. SWE-bench Verified には、単一ファイルで1〜2行のタスクが161件ある。それらを除外したスコアを構成する。リーダーボードはどう入れ替わるか。

5. 「Introducing SWE-bench Verified」（OpenAI）を読む。曖昧なタスクを取り除くために使われた具体的な方法論を説明し、そのキュレーションが見逃すカテゴリを1つ挙げる。

## 重要用語

| 用語 | よく言われること | 実際の意味 |
|---|---|---|
| SWE-bench | 「コーディングベンチマーク」 | 正解パッチとテストスイートを持つ実際の GitHub issue |
| SWE-bench Verified | 「クリーンアップ済みサブセット」 | 人手でキュレーションされた500タスク。簡単な裾野を含む |
| SWE-bench Pro | 「より難しいサブセット」 | 10行以上の変更。フロンティアモデルは23〜59% |
| CodeAct | 「アクションとしてのコード」 | エージェントが Python を出力し、Jupyter 形式のカーネルがサンドボックス内で実行する |
| JSON tool call | 「関数呼び出し」 | 各アクションが、実行前に検証される構造化 JSON ペイロード |
| Scaffold | 「エージェントフレームワーク」 | ベースモデルを取り巻く retrieval + planner + executor + verifier loop |
| ACI (Agent-Computer Interface) | 「SWE-agent の形式」 | 人間用シェルではなく、LLM の使いやすさに合わせて設計されたコマンドセット |
| Verifier loop | 「テストして再試行」 | テストを実行し、出力を読み、パッチを修正する。モデル以外で最大級の信頼性向上要因 |

## 参考資料

- [Jimenez et al. — SWE-bench](https://www.swebench.com/) — 元のベンチマークと方法論。
- [OpenAI — Introducing SWE-bench Verified](https://openai.com/index/introducing-swe-bench-verified/) — キュレーション済みサブセットの作り方。
- [Wang et al. — OpenHands: An Open Platform for AI Software Developers](https://arxiv.org/abs/2407.16741) — CodeAct アーキテクチャとイベントストリーム設計。
- [Epoch AI — SWE-bench leaderboard](https://epoch.ai/benchmarks) — ライブ追跡されるスコア。
- [Anthropic — Measuring agent autonomy](https://www.anthropic.com/research/measuring-agent-autonomy) — 長期ホライズンのコーディングエージェント信頼性の捉え方。
