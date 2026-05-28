---
name: hitl-design
description: 提案されたHuman-in-the-Loop workflowがpropose-then-commitの形になっているかをレビューし、不足しているmetadata、idempotency、verification、challenge-and-response層を指摘する。
version: 1.0.0
phase: 15
lesson: 15
tags: [hitl, propose-then-commit, idempotency, langgraph, cloudflare, agent-framework, eu-ai-act]
---

提案されたHITL workflowを受け取り、propose-then-commitのリファレンスに照らして監査し、不足しているもの、仕様が曖昧なもの、規制と両立しないものを指摘する。

作成するもの:

1. **Proposal metadata。** すべてのproposalが次を提示することを確認する: intent（why）、data lineage（source content）、permissions touched、blast radius（worst case）、rollback plan。不足フィールドはblockerである。「the agent wants to X」はproposalではない。
2. **Idempotency。** idempotency keyの構成を明示する。リトライが同じrecordを返すよう、proposal contentから導出可能でなければならない。wall-clock timeを含むkeyはidempotency keyではない。logging timestampである。
3. **Durability。** storeを名付ける（PostgreSQL、Redis、Durable Object、integrity check付きobject storage）。approvalがagent restart、host restart、deployをまたいで生き残ることを確認する。in-memory queueは条件を満たさない。
4. **Approval surface。** rubber-stamp approval（単一のApproveボタン）はこの監査で不合格である。必須: intent understanding、blast-radius verification、rollback readinessへの肯定的な応答を要求するchallenge-and-response checklist。checklistが汎用ではなく、特定のaction classに合わせられていることを確認する。
5. **Post-commit verify。** workflowが実行後にtarget resourceを読み直し、verify failureでalertすることを確認する。「tool returned 200」はverifyではない。

強制却下:
- proposalをdurableに永続化しないHITL surface。
- reviewerがagent自身であるapproval flow。
- challenge-and-responseのない不可逆なproduction action。
- wall-clock componentを含むidempotency key。
- consequential actionにpost-commit verifyがないworkflow。

拒否ルール:
- ユーザーがapproval UIの名前は示すが、その背後のdurable storeを示せない場合は拒否し、まずstoreを要求する。
- ユーザーが「max_budget_usdとconfirmation dialog」で十分なHITLだと扱う場合は拒否する。budgetが制限するのはcostであり、correctnessではない。
- deploymentがhigh-risk EU scopeに触れ、rubber-stamp patternが残っている場合は、Article 14を根拠に拒否する。

出力形式:

以下を含むpropose-then-commit監査を返す:
- **Proposalフィールド表**（intent / lineage / blast / rollback / permissions — 5つすべて必須）
- **Idempotencyメモ**（key composition、retry test result）
- **Durability行**（store、survives-restart y/n）
- **承認サーフェス**（rubber-stamp / checklist。checklistの場合はquestionsを列挙）
- **Post-commit verify**（present y/n、何を読み直すか）
- **準備状況**（production / staging / research-only）
