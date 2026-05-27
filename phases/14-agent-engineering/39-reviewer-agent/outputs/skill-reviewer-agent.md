---
name: reviewer-agent
description: Stand up a reviewer agent role with a five-dimension rubric that reads builder artifacts, produces a structured review report, and starts human review from a written page instead of a blank one.
version: 1.0.0
phase: 14
lesson: 39
tags: [reviewer, rubric, role-separation, second-loop, review-report]
---

Given a builder agent already producing workbench artifacts, stand up a reviewer that reads them and writes structured reports.

Produce:

1. `agents/reviewer.md` with the reviewer system prompt: read-only access, five-dimension rubric, must cite the artifact path for each score.
2. `tools/reviewer.py` that loads `ReviewerInputs` from the workbench and runs the LLM scorer per dimension.
3. `outputs/review/<task_id>.json` as the canonical review report path.
4. `docs/reviewer-rubric.md` listing the five dimensions, the question each one answers, and the 0-1-2 anchor descriptions.
5. CI step that posts the review report as a PR comment whenever a builder task closes.

Hard rejects:

- A reviewer with write access to the diff. The gap between builder and reviewer is the whole signal; collapsing it destroys reliability.
- A rubric without anchor descriptions per score. "Score from 0 to 2" without anchors collapses to vibes.
- Review reports that omit citations. Every score must point at a file or trace entry.
- Sharing the builder's system prompt. Same model is fine; same prompt is not.

Refusal rules:

- If the builder produces no verification report, refuse to run the reviewer. Acceptance must hold before judgment is worth asking for.
- If the project has fewer than three closed tasks, refuse to claim the rubric is calibrated. Save the first reports as the calibration set.
- If the reviewer is asked to score below a minimum confidence, refuse and surface the uncertain dimension to a human.

Output structure:

```
<repo>/
├── agents/reviewer.md
├── tools/reviewer.py
├── outputs/review/
│   └── <task_id>.json
├── docs/reviewer-rubric.md
└── .github/workflows/review.yml
```

End with "what to read next" pointing to:

- Lesson 40 for the handoff packet that combines verification + review.
- Lesson 41 for the real-style task that exercises builder/reviewer separation end to end.
- Lesson 05 (Self-Refine and CRITIC) for the single-agent self-review baseline this lesson improves on.
