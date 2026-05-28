---
name: rewoo-planner
description: user requestとtool catalogから、validated ReWOO plan DAGを生成する。
version: 1.0.0
phase: 14
lesson: 02
tags: [rewoo, plan-and-execute, planning, dag, distillation]
---

user requestとtool catalog（name、input schema、description）が与えられたら、ReWOO planを生成する。これはtool callとevidence reference（`#E1`、`#E2`、...）を持つstepのDAGである。executorへ渡す前にplanをvalidateする。

生成するもの:

1. plan DAG。各nodeはid（`E1`、`E2`、...）、tool name、argument dict（stringは`#E<k>` referenceを含められる）、optionalな`parallel_group` labelを持つ。
2. validation output。topological sortによるacyclicity check、reference resolution check（すべての`#E<k>`に先行producerがある）、tool existence check（すべてのtool nameがcatalog内にある）、arg schema check（各argumentがtoolのinput schemaに一致する）。
3. parallelism hint。各topological levelについて、同時実行できるnodeを列挙する。
4. planner/solver splitの推奨。planが3 steps未満なら代わりにReActを推奨する。planにunbounded loop requirement（各stepでreplanning）があるなら、replanner付きPlan-and-Executeを推奨する。planが30 stepsを超える、またはweb/mobileを対象にする場合は、synthetic plan data付きPlan-and-Actを推奨する。

強い却下条件:

- cycleを持つplan。ReWOOはDAGを前提にする。cycleはReActまたはLATSの関心事である。
- topological order上でまだ存在しない`k`を持つ`#E<k>`を参照するplan。失敗したedgeを具体的に出力する。
- catalogにないtoolをcallするplan。planを成立させるためにtoolをinventしない。
- referenceのargument typeがtool schemaに合わないplan（例: `#E1`はstringに置換されるが、toolはintを期待している）。

拒否ルール:

- taskがopen-ended exploration（必要なtoolsもstepsも未知）の場合は拒否し、ReActまたはLATS（レッスン04）を推奨する。
- tool catalogにdestructive toolsがありgating approval toolがない場合は拒否し、レッスン09（permissions、sandboxing）を指す。

出力: structured plan（JSONまたはYAML）、validation report、parallelism map、executor（ReWOO Worker）、replanner（Plan-and-Execute）、またはより大きなtrajectory-sampling loop（Plan-and-Act）を指すfollow-up action。

最後に、task classが過去に試行済みならレッスン03（Reflexion）、planがsearchから恩恵を受けるならレッスン04（LATS）を指す「次に読むもの」を添える。
