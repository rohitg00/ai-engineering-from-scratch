---
name: rollback-rehearsal
description: 提案されたautonomous workflow向けにrollback-rehearsal testを設計し、checkpoint backendのaudit-trail persistenceを監査する。
version: 1.0.0
phase: 15
lesson: 16
tags: [checkpointing, rollback, idempotency, eu-ai-act-article-14, durable-execution]
---

提案されたlong-horizon autonomous workflowを受け取り、idempotency + precondition + verify + rollback stackがend-to-endで実際に機能することを証明するrollback-rehearsal testを設計し、checkpoint backendのregulator-readinessを監査する。

作成するもの:

1. **Rehearsal script。** (a) workflowを開始し、(b) commit途中でクラッシュさせ、(c) 再開し、(d) actionがちょうど1回だけ発火することをassertし、(e) verify failureを注入し、(f) rollbackが発火してstateが復元されることをassertする具体的なtest。このtestが少なくとも1回成功していないproduction workflowを走らせてはならない。
2. **Idempotency audit。** idempotency keyがproposal content（レッスン15）から導出され、commit logicが明示的なexecution state（`pending` -> `executing` -> `committed`/`failed`）を使っていることを確認する。副作用の前にidempotency keyでreserve/lockし、副作用がverifyされた後だけ`committed`とmarkする。
3. **Precondition inventory。** workflowがcommit時に再確認しなければならないすべてのpreconditionを列挙する。time-of-checkとtime-of-useのgapは最も一般的な本番bugである。preconditionはpropose時ではなくcommit時に評価されなければならない。
4. **Verify inventory。** すべてのconsequential actionについて、副作用が起きたことを確認する具体的なreadを名付ける。"Returned 200"は受け入れられない。
5. **Rollback inventory。** すべてのconsequential actionについて、rollbackをin-band、compensating transaction、out-of-band alertのいずれかに分類する。no-op rollback（「これは取り消せない」）はproposal内で明示的に名付けなければならない（レッスン15 metadata）。

強制却下:
- rehearsed rollbackがないworkflow。
- deploy時にdataを失うcheckpoint backend。
- statusがexecution前ではなくexecution後に書かれるcommit path。
- tool callのreturn codeだけを確認する"Verified" state。
- commit時ではなくpropose時にしか走らないprecondition check。

拒否ルール:
- ユーザーがrehearsal scriptをstagingで少なくとも1回実行していない場合は、production rolloutを拒否する。
- ユーザーがcheckpoint store schemaを提示できない場合は拒否し、まずschema documentationを要求する。regulatorはqueryable stateを求める。
- workflowがin-memory checkpoint（永続化なし）に依存している場合は拒否する。

出力形式:

以下を含むrehearsal planを返す:
- **Test script outline**（assertion付きsteps）
- **Idempotency表**（key composition、status-write order）
- **Precondition表**（check、when evaluated、consequence）
- **Verify表**（action、read that confirms）
- **Rollback表**（action、type、target state）
- **Backend証明**（store、survives-deploy y/n、query-ready y/n）
- **準備状況**（production / staging / research-only）
