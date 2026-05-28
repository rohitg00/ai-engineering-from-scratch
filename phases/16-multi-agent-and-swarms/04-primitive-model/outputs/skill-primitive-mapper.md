---
name: primitive-mapper
description: 任意の multi-agent framework または codebase を 4 つの primitive axes (agent, handoff, shared state, orchestrator) に map する。
version: 1.0.0
phase: 16
lesson: 04
tags: [multi-agent, primitives, framework-comparison, architecture]
---

multi-agent framework (またはそれを使う codebase) が与えられたら、reader が framework を 1 段落で理解できるように 4-primitive mapping を作成する。

生成するもの:

1. **Agent definition.** agent はどう construct されるか。parameters は何か。どんな state を持つか。exact class または factory 名を挙げる。
2. **Handoff mechanism.** 3 つの handoff patterns のどれを使うか。function return、graph edge、speaker selection。hybrid なら primary を示す。1 handoff を trigger する minimum code を示す。
3. **Shared state model.** full message pool か projected view か。in-memory か durable (checkpointed) か。concurrent writers に thread-safe か。conflicts を誰が reconcile するか。
4. **Orchestrator type.** static、LLM-selected、handoff-driven、queue-driven のどれか。LLM-selected なら default model、static なら graph が cyclic か DAG かを示す。
5. **Cross-axis tradeoffs.** determinism、scalability ceiling、debuggability、typical failure mode について各 1 文。

強制 reject:

- abstraction が 4 primitives のどれにも collapse しないことを示さずに "new" と主張する mapping。reduce できない場合は 5 つ目を invent せず、gap を正確に述べる。
- marketing docs だけを cite する framework comparisons。必ず framework repository または official cookbook の concrete code example を cite する。
- framework がどの primitive を optimize しているかを特定せずに "Framework X is better for agents" と述べること。

拒否ルール:

- framework が closed-source で public docs が agent-handoff-state-orchestrator surface を expose していない場合、internals なしでは mapping 不可能だと述べる。
- user が framework なしの codebase (hand-rolled agents) を提供した場合、custom implementation を map し、under-designed な primitive を flag する。
- framework が 2024 年以前 (original AutoGen v0.2、pre-Swarm) で maintenance されていない場合、successor が mapping を preserve しているか 1-line note を含める。

出力: 1 ページの framework brief。single-sentence summary ("Framework X fixes handoff as graph edge and exposes shared state via a reducer.") で始め、上記 5 sections を続け、最後にこの framework の primitives が最も fit する production project を述べる closing paragraph を置く。
