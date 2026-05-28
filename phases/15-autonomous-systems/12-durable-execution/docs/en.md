# 長時間実行されるバックグラウンドエージェント：永続実行

> 本番の長期ホライズンエージェントは、`while True`で走らない。すべてのLLM呼び出しは、チェックポイント、リトライ、リプレイを備えたactivityになる。TemporalのOpenAI Agents SDK統合は2026年3月にGAになった。Claude Code Routines（Anthropic）は、永続的なローカルプロセスなしで、スケジュールされたClaude Code呼び出しを実行する。セッションは人間入力で一時停止し、デプロイをまたいで生き残り、`thread_id`をキーにした最新チェックポイントから再開する。新しい使いやすさの背後にあるのは、古くからあるパターン、つまりworkflow orchestrationである。そこに1つ新しい入力が加わった。LLM呼び出しは非決定的なactivityであり、復旧時には決定的にリプレイされなければならない。

**タイプ:** Learn
**言語:** Python（stdlib、最小限の永続実行ステートマシン）
**前提条件:** Phase 15 · 10（Permission modes）、Phase 15 · 01（Long-horizon agents）
**所要時間:** 約60分

## 問題

4時間実行されるエージェントを考える。このエージェントは3つのツールを呼び出し、ユーザーに2回確認し、40回のLLM呼び出しを行う。途中で、実行中のホストが再起動した。何が起きるか。

- ナイーブな`while True`ループでは、すべてが失われる。実行は最初から再開する。3つのツール呼び出し（実際の副作用を持つ）がもう一度実行される。ユーザーは、すでに承認した内容についてもう一度確認される。40回のLLM呼び出しに対して再び課金される。
- 永続実行では、実行は直近のチェックポイントから再開する。完了済みのactivityは再実行されない。その結果は永続ログからリプレイされる。ユーザーは、すでに承認した内容を再承認しない。すでに行われたLLM呼び出しに再課金されない。

これは、workflow engineが10年にわたって提供してきたものと同じパターンである（Temporal、Cadence、UberのCherami）。新しいのは、LLM呼び出しがactivityの一種になったことだ。LLM呼び出しは非決定的で、高価で、副作用を持ち得る。そして、このパターンにきれいにはまる。

このレッスンの通底テーマは、長期ホライズンの信頼性は劣化する、ということである（METRは「35-minute degradation」を観測しており、成功率はホライズンに対しておおむね二次的に低下する）。永続実行は、信頼性プロファイルが支えられる長さを超えた実行を可能にする。設計が正しければ安全に失敗する新しい方法になり、設計が間違っていれば危険に失敗する新しい方法になる。

## 概念

### Activity、workflow、replay

- **Workflow**: 決定的なオーケストレーションコード。activityの順序、分岐、待機を定義する。event logからリプレイしても予期しない分岐が起きないよう、決定的でなければならない。
- **Activity**: 非決定的で、失敗し得る作業単位。LLM呼び出し、ツール呼び出し、ファイル書き込み、HTTPリクエストなど。各activityは、入力と、完了後には出力とともにログに記録される。
- **Event log**: 永続的なバッキングストア。すべてのactivityの開始、完了、失敗、リトライ、およびすべてのworkflow decisionが記録される。
- **Replay**: 復旧時にworkflowコードを最初から再実行する。すでに完了したactivityは、再実行せず、ログに記録された結果を返す。まだ完了していなかったactivityだけが実際に実行される。

これは、Reactがvirtual DOMに対して再レンダリングする形や、Gitがコミットから作業ツリーを再構築する形と同じである。オーケストレーターの決定性が、永続性を安くする。

### なぜLLM呼び出しがこのパターンに合うのか

LLM呼び出しは次の性質を持つ。
- 非決定的である（temperature > 0。temperature 0であっても、モデルバージョン間でドリフトする）。
- 高価である（金銭面でもレイテンシ面でも）。
- 失敗し得る（レート制限、タイムアウト）。
- 副作用を持ち得る（ツールを呼び出す場合）。

これはまさにactivityのプロファイルである。すべてのLLM呼び出しをactivityとして包むことで、指数バックオフ付きのリトライ、再起動をまたいだチェックポイント、デバッグ用のリプレイ可能なトレースが得られる。

### `thread_id`をキーにしたチェックポイント

LangGraph、Microsoft Agent Framework、Cloudflare Durable Objects、Claude Code Routinesは、すべて同じAPI形状に収束している。`thread_id`（または同等のもの）がセッションを識別する。各状態遷移はバックエンドに永続化される（デフォルトはPostgreSQL、開発用にSQLite、キャッシュ用にRedis）。再開時には最新チェックポイントを読む。

バックエンドの選択は重要である。

- **PostgreSQL**: 永続的で、クエリ可能で、デプロイをまたいで生き残る。LangGraphのデフォルト。
- **SQLite**: ローカル開発専用。ホストをまたぐとデータを失う。
- **Redis**: 高速だが、AOF/snapshotを設定しない限り揮発的。
- **Cloudflare Durable Objects**: 透過的に分散される。一意なキーでスコープされる。数時間から数週間生き残る。

### 第一級の状態としての人間入力

Propose-then-commit（レッスン15）は、永続的な「人間待ち」状態を必要とする。workflowは一時停止し、外部キューが保留中のリクエストを保持し、承認が届くとまさにその地点から再開する。永続性がなければこれはベストエフォートでしかない。永続性があれば、夜間に届いた承認を受けて、朝にworkflowが続きから動き出す。

### 35-minute degradation

METRは、測定したすべてのエージェントクラスで、約35分を超える連続稼働後に信頼性が劣化することを観測した。タスク時間が2倍になると、失敗率はおおむね4倍になる。永続実行はこれを修正しない。信頼性プロファイルが支えられる長さを超えて実行できるようにするだけである。安全なパターンは、永続性に加えて、再入時に新たなHITLを要求するチェックポイントと、壁時計時間に関係なく総計算量を制限する予算キルスイッチ（レッスン13）を組み合わせることである。

### 永続実行が不適切な場合

- 数分未満で終わり、人間入力がない実行。オーバーヘッドが便益を上回る。
- 厳密に読み取り専用の情報取得。
- 正しさのために、1つのコンテキストウィンドウ内でエンドツーエンドに完結する必要があるタスク（一部の推論タスク、一部のワンショット生成）。

## 使ってみる

`code/main.py` は、stdlib Pythonで最小限の永続実行エンジンを実装している。対応しているもの:

- 入力と出力をJSON event logに記録する`@activity`デコレーター。
- activityを順序付けるworkflow関数。
- 完了済みactivityを再実行せずにリプレイする`run_or_replay(workflow, event_log)`関数。

ドライバーは3つのactivityを持つworkflowをシミュレートし、途中でクラッシュさせ、(a) ナイーブなリトライではすべてが再実行されること、(b) リプレイでは不足しているactivityだけが実行されることを示す。

## 実務に持ち込む

`outputs/skill-durable-execution-review.md` は、提案された長時間実行エージェントのデプロイについて、正しい永続実行の形になっているかをレビューする。activity、決定性、チェックポイントバックエンド、人間入力状態、HITL-on-resumeポリシーを確認する。

## 演習

1. `code/main.py` を実行する。ナイーブなリトライとリプレイで、activity実行回数がどう違うか観察する。クラッシュ地点を変え、リプレイ回数がそれに応じて変わることを示す。

2. トイエンジンを、`thread_id`を明示的に使う形に変更する。同じエンジンを共有する2つの並行セッションをシミュレートし、それぞれのevent logが衝突しないことを確認する。

3. トイエンジン内のactivityを1つ選ぶ。非決定性（workflow decision内の壁時計タイムスタンプ）を導入する。リプレイ時の分岐を実演する。実際のエンジンがこれをどう扱うか説明する（side-effect登録、`Workflow.now()` API）。

4. LangChainの「Runtime behind production deep agents」記事を読む。ランタイムが永続化するすべての状態を列挙し、それぞれがどの失敗モードをカバーするかを示す。

5. 6時間の自律コーディングタスクのチェックポイントポリシーを設計する。どこでチェックポイントを取るか。クラッシュ後の再開はどう見えるか。何に新たなHITLが必要か。

## 重要用語

| 用語 | よく言われること | 実際の意味 |
|---|---|---|
| Workflow | 「エージェントのスクリプト」 | 決定的なオーケストレーションコード。event logからリプレイ可能 |
| Activity | 「1つのステップ」 | 非決定的な単位（LLM呼び出し、ツール呼び出し）。前後でログに記録される |
| Event log | 「バッキングストア」 | すべての状態遷移の永続的な記録 |
| Replay | 「再開」 | workflowを再実行する。完了済みactivityは再実行せず、ログ済み結果を返す |
| Checkpoint | 「保存地点」 | `thread_id`をキーに永続化された状態。再開時は最新のものが使われる |
| thread_id | 「セッションキー」 | 永続状態をスコープする識別子 |
| 35-minute degradation | 「信頼性劣化」 | METR：成功率はホライズンに対しておおむね二次的に低下する |
| Non-determinism | 「リプレイ時のドリフト」 | 壁時計、乱数、LLM出力。副作用として登録しなければならない |

## 参考資料

- [Anthropic — Claude Code Agent SDK: agent loop](https://code.claude.com/docs/en/agent-sdk/agent-loop) - 予算、ターン、再開セマンティクス。
- [Microsoft — Agent Framework: human-in-the-loop and checkpointing](https://learn.microsoft.com/en-us/agent-framework/workflows/human-in-the-loop) - RequestInfoEventの形。
- [LangChain — The Runtime Behind Production Deep Agents](https://www.langchain.com/conceptual-guides/runtime-behind-production-deep-agents) - 具体的なランタイム要件。
- [OpenAI Agents SDK + Temporal integration (Trigger.dev announcement)](https://trigger.dev) - LLM呼び出しのactivity形状。
- [Anthropic — Measuring agent autonomy in practice](https://www.anthropic.com/research/measuring-agent-autonomy) - 35-minute degradationの参照元。
