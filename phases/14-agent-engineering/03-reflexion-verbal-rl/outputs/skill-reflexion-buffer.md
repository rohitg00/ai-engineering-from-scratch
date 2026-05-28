---
name: reflexion-buffer
description: verbal RL向けに、TTL、dedup、scope管理を備えたreflectionのepisodic-memory bufferを維持する。
version: 1.0.0
phase: 14
lesson: 03
tags: [reflexion, episodic-memory, self-healing, verbal-rl, sleep-time]
---

task class（繰り返されるagent runの種類。例: 「functionをrefactorする」「support ticketをcloseする」）が与えられたら、reflectionのepisodic-memory bufferを維持する。各reflectionはfailure modeとcorrective insightを自然言語で記録する。bufferは同じtask classの次のtrialのprompt前半に付けられる。

生成するもの:

1. Reflection capture。trialがthreshold未満のevaluator scoreで終わった後、「I failed to do X because Y; next time, Z.」という形の1行reflectionを出す。external failure（network、upstream 500s）については、再現可能でない限りreflectionを捨てる。
2. TTL and dedup。reflectionsはdefaultでN trials後にexpireする（10推奨）。完全重複はまとめる。near-duplicates（small embedding modelでcosine >0.9、またはshared substring >= 80%）は最新だけを残す。
3. Scope policy。3つのscope: task-class（task nameごと）、user（同一userのtasks across）、agent（全users across）。defaultはtask-class。reflectionがuser-specific preferenceに言及する場合だけuser scopeへescalateし、agent scopeへは自動escalateしない。
4. Compaction。bufferがbudgetを超えたら、sleep-time compactionを実行する。near-duplicatesをcluster、summarize、mergeする。compactionはhot path外で実行し、primary agentのresponseを遅らせない。
5. Prompt integration。`What I learned from prior trials`というtitleのsingle blockを、bulleted listで出力する。prompt内では6 itemsにcapし、overflowは別summary item（「... and 4 older reflections about timeouts」）へ送る。

強い却下条件:

- reflectionsを「be more careful next time」として書くこと。これはactionableではない。具体的なnext-time instructionを強制するpromptでreflectorを再実行する。
- wall-clock timeに基づいてreflectionsをexpireすること。TTLはoffline-replayable runsのため、time-scopedではなくtrial-scopedであるべき。
- secrets（API keys、tokens、PII）に言及するreflectionsを保存すること。bufferへcommitする前に、具体的な`contains secret` class errorで拒否する。

拒否ルール:

- evaluatorがattachedされていない場合は拒否し、レッスン05（Self-Refine/CRITIC）を推奨する。reflectionにはgut feelingではなくsignalが必要である。
- task classがone-shot（二度と再発しない）なら拒否する。episodic memoryは繰り返されないtaskには何もしない。

出力: structured buffer file（reflection objectsを持つJSON: trial id、task class、scope、text、created_at、ttl_remaining）、next trial用prompt block、まもなくexpireするentriesを列挙する「stale reflections」report。

最後に、bufferがcapに頻繁に当たる場合はレッスン06（context compression）、compactionをhot path外へ移す場合はレッスン08（Letta sleep-time compute）を指す「次に読むもの」を添える。
