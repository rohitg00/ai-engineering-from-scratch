---
name: ai-scientist
description: Build an autonomous research agent that runs experiment tree search, writes LaTeX papers with vision critique, and passes a sandbox-escape red team.
version: 1.0.0
phase: 19
lesson: 05
tags: [capstone, autonomous-agent, ai-scientist, sakana, langgraph, sandbox, research]
---

Given a seed idea, a narrow domain, and a $30 compute budget, build an agent that runs an experiment tree search, writes a reviewable LaTeX paper, and emits a reproducibility bundle.

Build plan:

1. Literature pass: Semantic Scholar Graph API + OpenAlex; cache abstracts in FAISS; generate a 1-page domain digest.
2. Tree search: implement best-first expansion over experiment nodes with `expand(node) -> children` (one config edit per child) and `score(node) = novelty*0.4 + quality*0.5 + budget*0.1`.
3. Per-node sandbox: every experiment runs `docker run --network=none --memory=8g --cpus=2 --pids-limit=256 --read-only` or E2B equivalent; deterministic seeds; resource cap enforced.
4. Plan-execute-verify: verify step checks that loss converged, baselines ran, ablations isolate the claim.
5. Writer: generate LaTeX, compile to PDF, feed PDF to Claude Opus 4.7 vision mode for critique on layout and claim-evidence alignment, iterate up to 3 times.
6. Reviewer ensemble: five judges (Opus 4.7, GPT-5.4, Gemini 3 Pro, DeepSeek R1, Qwen3-Max) score on NeurIPS rubric (novelty, rigor, clarity, reproducibility, impact); mean < 4.0 returns to writer.
7. Red team: integrate adversarial tasks (fork bomb, filesystem escape, LLM-written network call). Confirm all blocked. Emit `red_team.md`.
8. Reproducibility bundle: paper.pdf + review.md + tree-search trace JSON + seeds + W&B run links + sandbox config + one-line rerun command.

Assessment rubric:

| Weight | Criterion | Measurement |
|:-:|---|---|
| 25 | Paper quality | Blind rubric review against published workshop papers on the same seed topic |
| 20 | Experimental rigor | Baselines, seeds, ablations; every claim backed by a cell in the results table |
| 20 | Cost and compute discipline | $30 ceiling per paper enforced, Langfuse-traced |
| 20 | Safety | Sandbox red team passes; network policy and kill-switch verified with logged attempts |
| 15 | Reproducibility | One-command rerun reproduces the paper with identical seeds |

Hard rejects:

- Experiments that run outside a sandbox. The entire thesis of the capstone is that execution is contained.
- Writer steps that do not re-read the compiled PDF (vision critique is load-bearing).
- Papers without baselines, seeds, or an ablation section.
- Cost budgets enforced only as post-hoc warnings, not hard ceilings.

Refusal rules:

- Refuse to publish a paper with reviewer mean below 4.0/5 without an explicit human override.
- Refuse to run on a seed idea that requires network access from inside the sandbox. Add a separate read-only dataset volume instead.
- Refuse to rerun a paper whose red-team has not been executed and logged.

Output: a repo containing the tree-search engine, the sandbox policy, the writer/reviewer loop, three example runs with reproducibility bundles, a red-team report, a cost-ledger csv, and a write-up naming which of the Sakana v2 failure modes you reproduced and how the mitigation worked.
