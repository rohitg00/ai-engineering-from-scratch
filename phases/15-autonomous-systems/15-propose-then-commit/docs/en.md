# Human-in-the-Loop: Propose-Then-Commit

> 2026年時点のHITLに関する合意は具体的である。「エージェントが尋ね、ユーザーがApproveをクリックする」ことではない。propose-then-commitである。提案されたアクションをidempotency keyとともに永続ストアへ保存し、意図、data lineage、触れる権限、blast radius、rollback planを添えてレビュー担当者へ提示し、明示的な肯定応答の後だけcommitし、実行後に副作用が本当に起きたことを検証する。LangGraphの`interrupt()` + PostgreSQL checkpointing、Microsoft Agent Frameworkの`RequestInfoEvent`、Cloudflareの`waitForApproval()`はいずれも同じ形を実装している。典型的な失敗モードはrubber-stamp approvalである。「Approve?」がレビューなしにクリックされる。文書化された緩和策は、明示的なチェックリストを伴うchallenge-and-responseである。

**タイプ:** Learn
**言語:** Python（stdlib、idempotency付きpropose-then-commitステートマシン）
**前提条件:** Phase 15 · 12（Durable execution）、Phase 15 · 14（Tripwires）
**所要時間:** 約60分

## 問題

エージェントがアクションを実行しようとする。ユーザーは承認するかどうかを決めなければならない。判断が一瞬なら、それはおそらくレビューではない。判断が構造化されていれば、遅いが信頼できる。エンジニアリング上の問いは、構造化レビューを最も抵抗の少ない経路にするにはどうするかである。

2023年ごろのHITLパターンは同期的なプロンプトだった。「エージェントが本文YでXへメールを送ろうとしています。承認しますか?」ユーザーはApproveをクリックする。誰もがシステムは安全だと感じる。実際には、このサーフェスはかなりrubber-stampされる。ユーザーは素早く承認し、承認はほとんど予測力を持たず、エージェントが誤ったとき、監査証跡にはユーザーが思い出せない承認の長い履歴が残る。

2026年のパターンであるpropose-then-commitは、HITLを永続的な基盤へ移し、構造化メタデータを付け、肯定的なcommitを要求する。すべてのmanaged agent SDKが何らかの形で提供している。LangGraph `interrupt()`、Microsoft Agent Framework `RequestInfoEvent`、Cloudflare `waitForApproval()`である。API名は違っても、形は同じである。

## 概念

### propose-then-commitステートマシン

1. **Propose。** エージェントが提案アクションを生成する。永続ストア（PostgreSQL、Redis、Durable Object）に保存される。含まれるもの:
   - intent（エージェントがなぜこれを行うのか）
   - data lineage（どのsourceがこの提案につながったのか）
   - permissions touched（どのscope / file / endpointに触れるのか）
   - blast radius（最悪の場合どうなるか）
   - rollback plan（commitされた場合、どう取り消すか）
   - idempotency key（提案ごとに一意。再送信は同じrecordを返す）
2. **Surface。** レビュー担当者がすべてのメタデータ付きの提案を見る。レビュー担当者は人間である（エージェント自身が自分をレビューするのではない）。
3. **Commit。** 肯定的な応答を行う。アクションが実行される。
4. **Verify。** 実行後、副作用を読み戻して確認する。verify stepが失敗した場合、システムは既知のbad stateにあり、アラートが作動する。

### idempotency key

idempotency keyがなければ、一時的な障害後のリトライで承認済みアクションが二重実行され得る。具体例: ユーザーが「AからBへ$100送金する」を承認する。ネットワークが瞬断する。workflowがリトライする。ユーザーは一度しか承認していないのに、送金は二度実行される。idempotency keyは承認を単一で一意な副作用に結びつける。2回目の実行はno-opになる。

これはStripeやAWS APIが使っているのと同じidempotencyパターンである。Microsoft Agent Framework docsでは、agent approvalにこのパターンを再利用することが明示されている。

### 永続性: なぜ承認はプロセスより長く生きるのか

承認の待機室は、エージェントが所有しない状態である。workflowは一時停止する（レッスン12）。承認が届くと、workflowはまさにその地点から再開する。LangGraphが`interrupt()`を単なるインメモリ状態ではなくPostgreSQL checkpointingと組み合わせるのはこのためである。2日後の承認でも、workflowはまだ完全な形で見つかる。

### rubber-stamp approvalとchallenge-and-responseによる緩和

HITLのデフォルトUI（"Approve" / "Reject"ボタン）は、本物のレビューを伴わない高速な承認を生む。文書化された緩和策は、Approveボタンが有効になる前に特定の質問へ肯定的に答えることを要求するchallenge-and-response checklistである。具体的な形:

- "このアクションが触れるリソースを理解していますか? [ ]"
- "blast radiusが許容範囲であることを確認しましたか? [ ]"
- "これが失敗した場合のrollback planはありますか? [ ]"

これは官僚主義のための官僚主義ではなく、強制関数である。チェックボックスを押せないレビュー担当者は、説明を求める（escalation）か、却下する（safe default）。Anthropicのagent-safety researchは、rubber-stamp approvalパターンの緩和策としてchecklist-driven HITLを明示的に挙げている。

### consequentialと見なすもの

すべてのアクションがpropose-then-commitを必要とするわけではない。2026年のガイダンスは次のとおり。

- **Consequential actions**（常にHITL）: 不可逆なwrite、金融取引、外部への通信、本番データベース変更、破壊的なファイルシステム操作。
- **Reversible actions**（場合によりHITL）: ローカルファイルの編集、staging環境の変更、明確なrollbackを持つ可逆write。
- **Reads and inspections**（HITL不要）: ファイルを読む、リソースを列挙する、read-only APIを呼び出す。

### post-action verification

「commitが走った」は「副作用が起きた」と同じではない。ネットワーク分断やrace conditionにより、workflowは成功したと思っていてもbackendには永続化されていないことがある。verify stepでは、commit後に対象リソースを読み直して確認する。これは、`RETURNING`句を持つdatabase transactionや、AWSの`PutObject`後の`GetObject`と同じパターンである。

### EU AI Act Article 14

Article 14は、EUのhigh-risk AI systemsに対してeffective human oversightを義務付ける。「Effective」は飾りではない。規制文言はrubber-stamp patternを明確に除外する。Microsoft Agent Governance Toolkitのcompliance docsでは、challenge-and-response付きのpropose-then-commitがArticle 14の審査に耐える形とされている。

## 使ってみる

`code/main.py`は、stdlib Pythonでpropose-then-commitステートマシンを実装している。永続ストアはJSONファイルである。idempotency keyは（thread_id, action_signature）のhashである。ドライバーは3つのケースをシミュレートする。正常な承認フロー、一時障害後のリトライ（二重実行してはならない）、rubber-stamp defaultとchallenge-and-response flowの比較である。

## 仕上げる

`outputs/skill-hitl-design.md`は、提案されたHITL workflowがpropose-then-commitの形になっているかをレビューし、不足しているメタデータ、idempotency、verification、challenge-and-response層を指摘する。

## 演習

1. `code/main.py`を実行する。承認済みproposalのリトライがdurable recordを使い、再実行しないことを確認する。次にidempotency keyにtimestampを含めるよう変更し、リトライで二重実行されることを示す。

2. proposal recordに`rollback`フィールドを追加する。verify stepが失敗する実行をシミュレートする。rollbackが自動的に発火することを示す。

3. Microsoft Agent Frameworkの`RequestInfoEvent` docsを読む。APIには含まれているがトイエンジンに欠けているmetadata fieldを1つ特定する。それを追加し、何から守るのかを説明する。

4. 特定のアクション（例: 「公開Twitterアカウントへ投稿する」）のためのchallenge-and-response checklistを設計する。レビュー担当者が答えるべき3つの質問は何か。なぜその3つなのか。

5. 同期的な「Approve?」プロンプトで十分なケース（durable store不要）を1つ選ぶ。なぜ十分なのかを説明し、受け入れているrisk classを名付ける。

## 重要語句

| 用語 | よく言われること | 実際の意味 |
|---|---|---|
| Propose-then-commit | 「二段階承認」 | 永続化されたproposal + 肯定的なcommit + verify |
| Idempotency key | 「retry-safe token」 | proposalごとに一意。2回目の実行はno-op |
| Data lineage | 「どこから来たか」 | proposalにつながった具体的なsource content |
| Blast radius | 「最悪の場合」 | アクションが誤った場合の影響範囲 |
| Rubber-stamp | 「高速承認」 | 本物のレビューなしに"Approve"がクリックされること |
| Challenge-and-response | 「強制チェックリスト」 | レビュー担当者が特定の質問に肯定的に応答しなければならない |
| RequestInfoEvent | 「MS Agent Framework primitive」 | 構造化メタデータを持つdurable HITL request |
| `interrupt()` / `waitForApproval()` | 「Framework primitive」 | 同じ形を持つLangGraph / Cloudflareの対応物 |

## 参考資料

- [Microsoft Agent Framework — Human in the loop](https://learn.microsoft.com/en-us/agent-framework/workflows/human-in-the-loop) — `RequestInfoEvent`、durable approval。
- [Cloudflare Agents — Human in the loop](https://developers.cloudflare.com/agents/concepts/human-in-the-loop/) — `waitForApproval()`とDurable Objects。
- [Anthropic — Measuring agent autonomy in practice](https://www.anthropic.com/research/measuring-agent-autonomy) — 長期ホライズンriskの緩和策としてのHITL。
- [EU AI Act — Article 14: Human oversight](https://artificialintelligenceact.eu/article/14/) — high-risk systemの規制baseline。
- [Anthropic — Claude's Constitution (January 2026)](https://www.anthropic.com/news/claudes-constitution) — oversightをめぐるconstitutional framing。
