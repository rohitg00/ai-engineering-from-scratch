---
name: skill-library
description: Similarity による retrieval、compositional execution、failure-driven refinement を備えた Voyager-shaped skill library を生成する。
version: 1.0.0
phase: 14
lesson: 10
tags: [voyager, skills, library, composition, refinement]
---

Target runtime と domain が与えられたら、Voyager の 3 components (curriculum hook、retrievable skill store、iterative refinement) を support する skill library を生成する。

生成するもの:

1. `name`, `description`, `code`, `version`, `tags`, `depends_on`, `history` を持つ `Skill` type。すべての write は prior code を記録する。
2. `register(skill, dedup=True)` (new または version bump)、`search(query, top_k, tag_filter)`、`get(name)`、`topo_order(name)` (dep resolution)、`execute(name, context)` (topological run) を持つ `SkillLibrary`。
3. Retrieval は embedding similarity または BM25 を使わなければならない。Full library に対する LLM scoring は使わない。LLM re-rank は top-k shortlist でのみ許可。
4. Execution は per-skill で exceptions を catch し、refinement loop が consume できる feedback として trace に surface しなければならない。
5. Refinement hook: failed `execute` 後、runtime は (task, skill_name, error, env_state) を集め、model に渡し、rewritten skill に対して `register` を呼ぶ。Version は bump し、history は old code を保存する。

Hard rejects:

- Skills が code ではなく prose strings の library。Skills は executable である。Prose は `description` に置く。
- Topological sort なしの composition。Cycle detection なしの depth-first は skill DAG で壊れる。
- Silent version overwrite。すべての refinement は必ず `version` を bump し、audit 用に old code を `history` へ push する。

Refusal rules:

- Target runtime に skill execution 用 sandbox がない場合、production systems に触れる domain では拒否する。Ship 前に sandbox (Lesson 09 principles) を要求する。
- User が「refinement なしで failure ごとに auto-retry」と依頼した場合は拒否する。Refinement なしの retry は bug を増幅するだけで修正しない。
- Library が flat retrieval のまま約 200 skills を超える場合、それを "production-ready" と呼ぶことを拒否する。まず tag filters と hierarchical namespaces を追加する。

Output: `skill.py`, `library.py`, `execute.py`, `refine.py` と、dedup rule、retrieval backend、refinement prompt、version policy を説明する `README.md`。最後に、Claude Agent SDK integration には Lesson 17、OpenAI Agents SDK tool translation には Lesson 16、skill-library quality 評価には Lesson 30 への "what to read next" で締める。
