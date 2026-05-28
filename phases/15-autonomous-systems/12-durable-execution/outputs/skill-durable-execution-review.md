---
name: durable-execution-review
description: 提案された長時間実行エージェントのデプロイについて、正しい永続実行の形（activity、決定性、チェックポイントバックエンド、人間入力状態、HITL-on-resume）になっているかレビューする。
version: 1.0.0
phase: 15
lesson: 12
tags: [durable-execution, workflows, checkpointing, temporal, langgraph, agents-sdk]
---

提案された長時間実行エージェントのデプロイ（Temporal + OpenAI Agents SDK、PostgreSQL checkpointer付きLangGraph、Microsoft Agent Framework、Claude Code Routines、Cloudflare Durable Objects、または社内の同等実装）を受け取り、その設計を永続実行パターンに照らして監査する。

作成するもの:

1. **Activityインベントリ。** すべてのactivity（LLM呼び出し、ツール呼び出し、HTTPリクエスト、ファイル書き込み）を列挙する。それぞれについて、リトライポリシー、タイムアウト、idempotency keyを備えたactivityとして包まれていることを確認する。activityの外側にある生のLLM呼び出しは、信頼性上の穴である。
2. **Workflowの決定性。** workflowコード内のすべての非決定的読み取り（壁時計、乱数、外部状態）を特定する。それぞれはside-effect activityとして登録され、リプレイ時に同じ値を返す必要がある。隠れた非決定性は、リプレイドリフトの最も一般的な原因である。
3. **チェックポイントバックエンド。** バックエンド（PostgreSQL、SQLite、Redis、Durable Objects）の名前を示す。デプロイをまたいで生き残ることを確認する。SQLiteは開発専用。RedisにはAOFまたはsnapshot設定が必要。Cloudflare Durable Objectsは透過的だが、一意なキー規律を要求する。
4. **人間入力状態。** HITLのための一時停止が、ポーリングループではなく、第一級のworkflow状態であることを確認する。workflowは外部シグナル（承認キュー、webhook、`interrupt()`プリミティブ）でブロックし、承認が到着したまさにその時点で再開すべきである。
5. **HITL-on-resumeポリシー。** クラッシュ後の再開について、次のactivityを実行する前に新たなHITLが必要かどうかを述べる。これがないと、永続実行とクラッシュ前に付与された承認の組み合わせにより、コンテキストが変わった後で承認済みアクションが再発火する可能性がある。長期ホライズンでは重要である。

強制却下:
- LLM呼び出しがactivityとして包まれていないAgent SDK利用。
- デプロイをまたいで生き残らないチェックポイントバックエンド。
- 壁時計や乱数を、activityで包まずに埋め込んでいるworkflow。
- 人間入力をシグナルではなくポーリングループとしてモデル化しているもの。
- HITL-on-resumeポリシーのない長期ホライズン実行（1時間超）。
- 永続性の上に予算キルスイッチ（レッスン13）を重ねていない実行。

拒否ルール:
- ユーザーが、副作用を持つactivityに明示的な冪等性を持たない永続workflowを提案するなら、拒否し、まずidempotency keyを要求する。そうしないと、リトライで二重実行される。
- ユーザーがリプレイテスト（workflowを実行し、途中でクラッシュさせ、リプレイし、副作用が二重に発生しないことをアサートする）を示せないなら、拒否し、本番前にそのテストを要求する。
- ユーザーがHITLチェックポイントなしで24時間の無人実行を提案するなら、拒否する。35-minute degradation（レッスン12のノート）により、永続性が正しくても信頼性の問題になる。

出力形式:

以下を含む設計レビューメモを返す:
- **Activityテーブル**（activity、retry policy、timeout、idempotency key）
- **決定性監査**（非決定的読み取りと、それぞれの扱い）
- **チェックポイントバックエンド**（name、survives-deploy y/n、replay-test status）
- **HITL状態の形**（first-class state / polling / missing）
- **HITL-on-resumeポリシー**（明示し、根拠を添える）
- **準備状況**（production / staging / research-only）
