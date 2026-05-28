---
name: workbench-pack
description: project-tuned な drop-in agent workbench pack を生成する。team history に合わせて rules を鋭くし、scope glob を repo に合わせ、rubric dimension に domain-specific entry を 1 つ追加する。
version: 1.0.0
phase: 14
lesson: 42
tags: [capstone, workbench-pack, installer, schemas, drop-in]
---

repo、team の incident history、その中で動く agent product が与えられたら、tuned agent-workbench-pack と installer を出力してください。

生成するもの:

1. canonical layout に合う `agent-workbench-pack/` directory: AGENTS.md, docs/, schemas/, scripts/, bin/, README.md, VERSION。
2. 既存 pack を `--force` なしに clobber せず、target repo に `.workbench-version` を書く `bin/install.sh`。
3. project-tuned 版の `agent-rules.md` (team の直近 6 incidents から各 category 最低 1 rule)、`reviewer-rubric.md` (6 つ目の domain dimension つき)、`scope_contract.schema.json` (project-specific glob つき)。
4. script と schema の drift、または VERSION と schema の `schema_version` の不一致で fail する `lint_pack.py` script。
5. demo branch に pack を install し、known-good task に対して verification gate を走らせる optional CI integration。

ハード拒否条件:

- project-specific task を含む pack。task は target repo の board に置きます。
- 単一 vendor SDK に結びついた pack。framework-agnostic のみです。SDK wiring は target repo の仕事です。
- state file を mutate する installer。installer は idempotent な surface-only で、state は agent と human のものです。
- 対応する check function のない rule。aspirational rule は pack ではなく onboarding に置いてください。

拒否ルール:

- incident history が空の場合、tuned `agent-rules.md` の出荷を拒否してください。canonical default を使い、gap を明示してください。
- target repo の CI が install と互換性を持たない場合 (`.github/workflows/` も equivalent もない場合)、optional CI step を拒否し、manual path を document してください。
- team が private fork の pack を使っている場合、public installer の作成を拒否してください。private installer は private invariant を含みます。

出力構成:

```
agent-workbench-pack/
├── AGENTS.md
├── docs/
├── schemas/
├── scripts/
├── bin/install.sh
├── lint_pack.py
├── VERSION
└── README.md
```

最後に "what to read next" を置き、次を指してください。

- Lesson 41: この pack が改善する before/after benchmark。
- Lesson 30 (Eval-Driven Agent Development): pack の verdict を consume する eval loop。
- [SkillKit](https://github.com/rohitg00/skillkit): pack を 32 AI agent に配布するための仕組み。
