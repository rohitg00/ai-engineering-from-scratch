---
name: reviewer-agent
description: builder artifacts を読み、構造化 review report を生成し、人間の review を blank page ではなく written page から始める five-dimension rubric 付き reviewer agent role を立ち上げる。
version: 1.0.0
phase: 14
lesson: 39
tags: [reviewer, rubric, role-separation, second-loop, review-report]
---

builder agent がすでに workbench artifacts を生成している前提で、それらを読み構造化 reports を書く reviewer を立ち上げてください。

作成するもの:

1. reviewer system prompt を含む `agents/reviewer.md`: read-only access、five-dimension rubric、各 score で artifact path を cite すること。
2. workbench から `ReviewerInputs` を load し、dimension ごとに LLM scorer を実行する `tools/reviewer.py`。
3. canonical review report path としての `outputs/review/<task_id>.json`。
4. 5つの dimensions、それぞれが答える question、0-1-2 anchor descriptions を列挙する `docs/reviewer-rubric.md`。
5. builder task が close するたびに review report を PR comment として投稿する CI step。

ハード拒否条件:

- diff への write access を持つ reviewer。builder と reviewer の gap が signal のすべてであり、それを潰すと reliability が壊れる。
- score ごとの anchor descriptions がない rubric。"Score from 0 to 2" だけでは vibes に崩れる。
- citations を省略する review reports。すべての score は file または trace entry を指す必要がある。
- builder の system prompt を共有すること。同じ model はよい。同じ prompt はだめ。

拒否ルール:

- builder が verification report を生成しない場合、reviewer の実行を拒否する。judgment を尋ねる前に acceptance が成立している必要がある。
- project の closed tasks が3件未満の場合、rubric が calibrated だと主張しない。最初の reports は calibration set として保存する。
- reviewer が minimum confidence 未満で採点するよう求められた場合は拒否し、uncertain dimension を人間に surface する。

出力構成:

```
<repo>/
├── agents/reviewer.md
├── tools/reviewer.py
├── outputs/review/
│   └── <task_id>.json
├── docs/reviewer-rubric.md
└── .github/workflows/review.yml
```

最後に "what to read next" として次を示してください。

- verification + review を組み合わせる handoff packet は Lesson 40。
- builder/reviewer separation を end to end で試す real-style task は Lesson 41。
- この lesson が改善する single-agent self-review baseline は Lesson 05 (Self-Refine and CRITIC)。
