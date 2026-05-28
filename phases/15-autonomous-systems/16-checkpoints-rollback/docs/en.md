# チェックポイントとロールバック

> すべてのgraph-state transitionは永続化される。workerがクラッシュするとleaseが期限切れになり、別のworkerが最新checkpointから引き継ぐ。Cloudflare Durable Objectsは、数時間から数週間にわたって状態を保持する。Propose-then-commit（レッスン15）は、actionごとにrollback planを定義する。Post-action verificationがループを閉じる。EU AI Act Article 14は、high-risk systemにeffective human oversightを義務付けている。実務上これは、checkpointがquery可能であること、rollbackがrehearsal済みであること、audit trailがdeployをまたいで生き残ることを意味する。鋭い失敗モードは、一時障害後のリトライが、idempotency keyとprecondition checkなしに、承認済みactionを二重実行してしまうことだ。Post-action verificationがそれを捕まえる。

**タイプ:** Learn
**言語:** Python（stdlib、checkpointとrollbackのステートマシン）
**前提条件:** Phase 15 · 12（Durable execution）、Phase 15 · 15（Propose-then-commit）
**所要時間:** 約60分

## 問題

Durable execution（レッスン12）は、クラッシュしたagentを再開可能にする。Propose-then-commit（レッスン15）は、承認済みactionを監査可能にする。このレッスンではその2つを接続する。承認済みactionが部分的に実行され、クラッシュし、再開したら何が起きるのか。rollbackはいつ、どの状態に対して走るのか。

実システムでは、この接続方法はそれぞれ異なる。

- **LangGraph**は、すべてのgraph-state transitionをPostgreSQLへcheckpointする。worker crash時にはleaseが解放され、別のworkerが最新checkpointから再開する。workflowは`interrupt()`で一時停止し、その一時停止自体も永続化される。
- **Cloudflare Durable Objects**は、keyごとの状態を数時間から数週間保持する。承認済みactionのcomputationとstorageを同じ場所に置く。
- **Microsoft Agent Framework**は、workflow APIで`Checkpoint` primitiveを公開する。replayとidempotencyの組み合わせがretryをカバーする。

どの場合でも、実際に機能する組み合わせは、idempotency key（二重実行を防ぐ）+ precondition check（状態がまだ承認時と一致している）+ post-action verify（副作用が本当に起きた）+ verify-fail時のrollbackである。

## 概念

### すべてのtransitionを永続化する

graph-state transitionとは、workflowをある名前付きstateから別のstateへ動かす任意のstepである。ナイーブな実装は特定のcommit pointだけを永続化する。本番実装はすべてのtransitionを永続化する。コスト（数回余分にwriteすること）は、信頼性の向上（replayがどこにでも着地でき、lease recoveryが正確になること）に比べれば小さい。

### lease recovery

workerがクラッシュしても、workflowは失われない。lease（このworkerがこのrunを実行しているという短命のclaim）が単に期限切れになるだけである。別のworkerが最新checkpointを拾って再開する。lease mechanismがあるからこそ、本番システムはin-flight workを失わずにrolling deployを乗り切れる。

### idempotency plus preconditions

idempotencyだけでは十分ではない。例を考える。workflowは「balance > $1000のとき、AからBへ$100をtransferする」ことを承認されている。workflowがcommitされ、実行途中でクラッシュし、再開する。idempotency keyだけを確認して実行が再開された場合、transferは1回だけ走る（これは正しい）。しかしクラッシュから再開までの間に、別のworkflowによってAのbalanceが$500に下がったとする。idempotency checkはまだ通るが、preconditionは通らない。precondition checkがなければ、overdraftを出荷してしまう。

すべてのconsequential actionには両方が必要である。

- **Idempotency key**: 二重実行を防ぐ。
- **Precondition check**: 状態がまだ承認された内容と整合していることを確認する。

### post-action verification

「tool returned 200」はverificationではない。本物のverificationはtarget stateを読み直し、副作用が本当に起きたことを確認する。パターン:

- Database update: `UPDATE ... RETURNING *`を実行し、返されたrowが意図したstateに一致することをassertする。
- Email send: submission後、message IDをsent-folderで確認する。
- File write: fileを読み戻してhashする。
- API call: target resourceに対してfollow-up `GET`を行う。

verifyが失敗した場合、workflowはknown-bad stateにある。rollbackが作動する。

### rollback plans

propose-then-commit（レッスン15）におけるすべてのconsequential actionはrollback planを持つ。種類:

- **In-band rollback**: 副作用を直接戻す（`INSERT`後の`DELETE`、send後の`Send-correction-email`）。
- **Compensating transaction**: originalを中和する新しいaction（標準的なSAGA pattern）。
- **Out-of-band rollback**: 人間にalertし、workflowを一時停止し、調査のためにbad stateを残す。

No-op rollback（「これは取り消せない」）はproposal内で明示しなければならない。rollbackのないactionは、commit時により強いHITLを必要とする（レッスン15のchallenge-and-response）。

### EU AI Act Article 14の運用上の読み方

Article 14は、high-risk systemに「effective human oversight」を要求する。運用上、実装者はこれを次のように読む。

- checkpointはauditorがqueryできる。
- rollbackはrehearsal済みである（少なくとも1回end-to-endでtest済み）。
- audit trailはdeployをまたいで生き残る（checkpoint backendがephemeralではない）。
- failed verificationは黙ってlogに残すだけでなく、alertされる。

commit途中でクラッシュし、再開し、verify + rollback pathwayなしに副作用を完了するworkflowは、Article 14のtestに耐えない。

### 鋭い失敗モード: double-execute

この領域で最もよくある本番incident:

1. actionが承認され、idempotency keyはk。
2. commitが開始し、実行され、200を返す。
3. "committed" statusを永続化する前にworkflowがクラッシュする。
4. workflowが再開し、"approved but not committed"と見なして再実行する。
5. 副作用が2回発火する。

緩和策: 実行前に"in-flight" intentを永続化し、idempotency key付きで実行し、post-action verificationが成功した後だけ"committed"とmarkする。actionが発火してstatus writeが失敗した場合、verifyし、必要ならre-fireすべきことが分かる。status writeが成功してactionが失敗した場合、verifyし、recovery path経由でちょうど1回だけ発火させる。

## 使ってみる

`code/main.py`は、idempotency、precondition、verify、rollbackを備えたcheckpointed workflowを実装している。ドライバーは4つのscenarioをシミュレートする。clean run、crash後のretry（idempotencyが捕まえる）、precondition fail（workflowは発火せずabortする）、verify fail（rollbackが発火する）である。

## 仕上げる

`outputs/skill-rollback-rehearsal.md`は、提案されたworkflow向けのrollback-rehearsal testを設計し、checkpoint backendのaudit-trail persistenceを監査する。

## 演習

1. `code/main.py`を実行する。4つのscenarioを確認する。crash-during-commitのケースでは、retryをまたいでactionがちょうど1回だけ発火することを確認する。

2. 「mark as done first, then do it」パターンを変更し、status writeがactionの後に発火するようにする。crash scenarioを再実行する。重複actionが何回発火するかを測定する。

3. 特定のproduction action（例: 「Slack channelへ投稿する」）のrollback planを設計する。in-band、compensating、out-of-bandのいずれかに分類する。その選択を正当化する。

4. 自分が知っているworkflowを1つ取り上げる。すべてのstate transitionを特定する。それぞれにdurability requirement（persist / do not persist）を付ける。現在永続化していないものを数える。

5. Rehearsed-rollback test: 実際のworkflowを実行し、クラッシュさせ、rollback pathが発火することを確認するend-to-end testを設計する。このtestは何をassertするか。

## 重要語句

| 用語 | よく言われること | 実際の意味 |
|---|---|---|
| Checkpoint | 「保存地点」 | すべてのgraph-state transitionがdurable storeへ永続化される |
| Lease | 「worker claim」 | workerがrunを実行していることを示す短命のclaim。crash時に期限切れになる |
| Precondition | 「state gate」 | 状態がまだ承認済みactionと整合しているというassertion |
| Post-action verify | 「読み戻しcheck」 | target systemで副作用が本当に起きたことを確認する |
| In-band rollback | 「直接undo」 | 逆操作で副作用を元に戻す |
| Compensating transaction | 「SAGA undo」 | originalを中和する新しいaction |
| Mark-as-done-first | 「status write order」 | commitから戻る前にcommitted statusを永続化する |
| Article 14 | 「EU AI Act human oversight」 | 運用上はquery可能なcheckpoint、rehearsal済みrollback、監査可能なtrail |

## 参考資料

- [Microsoft Agent Framework — Checkpointing and HITL](https://learn.microsoft.com/en-us/agent-framework/workflows/human-in-the-loop) — checkpoint primitiveとlease recovery。
- [Cloudflare Agents — Human in the loop](https://developers.cloudflare.com/agents/concepts/human-in-the-loop/) — state substrateとしてのDurable Objects。
- [EU AI Act — Article 14: Human oversight](https://artificialintelligenceact.eu/article/14/) — regulatory baseline。
- [Anthropic — Measuring agent autonomy in practice](https://www.anthropic.com/research/measuring-agent-autonomy) — long-horizon workflowのreliability framing。
- [Anthropic — Claude Code Agent SDK: agent loop](https://code.claude.com/docs/en/agent-sdk/agent-loop) — Claude Code Routinesのworkflow shape。
