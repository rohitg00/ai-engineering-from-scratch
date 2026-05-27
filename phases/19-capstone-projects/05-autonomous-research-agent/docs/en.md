# Capstone 05 — Autonomous Research Agent (AI-Scientist Class)

> Sakana's AI-Scientist-v2 published full papers. Agent Laboratory ran the experiments. Allen AI shared traces. The 2026 shape is plan-execute-verify tree search over experiments, budgeted cost, sandboxed code execution, a vision-feedback LaTeX writer, and an automated NeurIPS-style reviewer ensemble. The capstone is to build one, run it end to end within $30 per paper, and survive the sandbox-escape red team that Sakana documented.

**Type:** Capstone
**Languages:** Python (agent + sandbox), LaTeX (output)
**Prerequisites:** Phase 2 (ML), Phase 3 (deep learning), Phase 7 (transformers), Phase 10 (LLMs from scratch), Phase 14 (agents), Phase 15 (autonomous), Phase 16 (multi-agent), Phase 18 (safety)
**Phases exercised:** P0 · P2 · P3 · P7 · P10 · P14 · P15 · P16 · P18
**Time:** 40 hours

## Problem

Autonomous research agents crossed a threshold in 2026. Sakana AI's AI-Scientist-v2 was published in Nature with generated papers that cleared workshop peer review. ShinkaEvolve (ICLR 2026) extended the line to evolving hypotheses. AMD's Agent Laboratory shipped reproducible traces. The agents are not magic — they are a plan-execute-verify loop running over a tree of candidate experiments, with cost caps, seed-bound sandboxes, and automated review. The craft is in the loop, the budget, and the safety story.

You learn the loop by implementing one against a seed idea in a narrow domain (for example, attention-sparsity ablations on a 100M-parameter transformer). The value is not in discovering something new on the first run. The value is in the infrastructure: the tree-search, the experiment sandbox, the writer-reviewer loop, the red-team report. The Sakana team documented sandbox-escape failures; your agent must pass the same red team.

## Concept

The agent is a best-first tree search. Nodes are experiment specifications: (hypothesis, config, code, expected outcome). An expand step proposes children with small edits (swap optimizer, shift batch size, ablate a component). Each child runs in a fresh sandbox with a hard resource cap. Results feed back into a scoring function that ranks nodes by (novelty × quality × remaining budget). The tree grows until budget is exhausted, then the best branch is written up.

The writer is multimodal. It generates a LaTeX draft, compiles it, renders figures, and feeds the rendered PDF back into Claude Opus 4.7's vision mode for critique on layout, figure legibility, and claim-evidence alignment. A reviewer ensemble of five LLM judges emits NeurIPS-style scores (novelty, rigor, clarity, reproducibility, impact); if the average drops below threshold, the paper returns to the writer with critique.

Safety is load-bearing. Every experiment runs in an E2B or Daytona sandbox with no network egress, bounded wall-clock, and pinned resource limits. The agent's code-generation step passes through a policy layer that blocks syscalls that escape the sandbox. The red-team report reproduces the Sakana-documented attack surface (fork bombs, filesystem escapes, LLM-written network calls).

## Architecture

```
seed idea + domain
      |
      v
  literature search (Semantic Scholar + OpenAlex + FAISS cache)
      |
      v
  LangGraph plan-execute-verify tree
      |
      v
  +--- expand node ----+      per-node sandbox
  |                    |      (E2B / Daytona)
  v                    v      resource caps
  child_1           child_k   no network egress
  |                    |      deterministic seeds
  v                    v
  run experiment       run experiment
  |                    |
  v                    v
  score nodes by (novelty, quality, budget)
      |
      v
  best branch -> LaTeX writer
      |
      v
  compile + vision critique (Opus 4.7 vision)
      |
      v
  reviewer ensemble (5 LLM judges, NeurIPS rubric)
      |
      v
  paper.pdf + review.md + trace.json
```

## Stack

- Orchestration: LangGraph with checkpointing and human-approval gates
- Tree search: custom best-first over experiment nodes (AB-MCTS-style from Sakana v2)
- Sandbox: E2B per experiment, Docker-in-Docker fallback; resource caps via cgroups
- Literature: Semantic Scholar Graph API + OpenAlex + local FAISS cache of abstracts
- Writer: LaTeX template + Claude Opus 4.7 (vision mode) for figure critique and layout
- Reviewer: ensemble of 5 judges (Opus 4.7, GPT-5.4, Gemini 3 Pro, DeepSeek R1, Qwen3-Max) with weighted aggregation
- Experiment framework: PyTorch 2.5 for the physical experiments, W&B for logging
- Observability: Langfuse for agent traces, $30 hard budget per paper

## Build It

1. **Seed and domain scoping.** Take a seed idea (e.g., "investigate sparsity patterns in attention maps of sub-1B transformers"). Define the search space: models, datasets, compute budget.

2. **Literature pass.** Query Semantic Scholar + OpenAlex for 50 most-cited relevant papers; cache abstracts locally; generate a 1-page domain digest.

3. **Tree scaffolding.** Initialize the root with the seed hypothesis. Implement `expand(node) -> children` with small-edit proposals (one config change per child). Implement `score(node)` as a weighted novelty × quality × budget term.

4. **Sandbox wrapping.** Every experiment runs `docker run --network=none --memory=8g --cpus=2 --pids-limit=256 --read-only` (or the equivalent E2B policy). Seeds are written to the sandbox; outputs are mounted read-only back out.

5. **Plan-execute-verify loop.** `plan` proposes children. `execute` runs the sandbox, captures logs and metrics. `verify` runs unit checks on metrics (did the loss decrease? did the ablation isolate the effect?). Failed nodes get a failure reason stored on the tree.

6. **Writer.** After budget, select the best branch. Render figures with matplotlib. Generate a LaTeX draft via Claude Opus 4.7 with the branch trace in context. Compile. Feed the compiled PDF back to Opus 4.7 vision for critique. Iterate.

7. **Reviewer ensemble.** Five judges score the draft on (novelty, rigor, clarity, reproducibility, impact) with NeurIPS-style rubrics. If mean < 4.0/5, return to writer with critique. Hard stop after 3 rewrites.

8. **Red team.** Build or integrate a set of adversarial tasks targeting the sandbox: fork bombs, network exfiltration attempts, filesystem escapes, LLM-written shell metacharacters. Confirm all are blocked. Write up findings.

9. **Reproducibility.** Every paper ships with its tree-search trace JSON, seeds, W&B run links, sandbox configs, and a README reproducing it end to end.

## Use It

```
$ ai-scientist run --seed "attention sparsity in sub-1B transformers" --budget 30
[lit]    50 papers, digest in 12s
[tree]   expanded 8 nodes, budget 12/30
[exec]   node #3 sparsity=top-8, loss=2.83 (best so far)
[exec]   node #6 sparsity=top-4, loss=3.12 (worse)
[exec]   ...
[tree]   chose branch rooted at node #3 (novelty 0.62, quality 0.81)
[write]  LaTeX draft v1 complete
[vision] critique: figure 2 legend too small, claim-evidence ok
[write]  draft v2 after 3 edits
[review] mean 4.2/5 (novelty 3.9, rigor 4.3, clarity 4.1, repro 4.5, impact 4.2)
[done]   paper.pdf + review.md + trace.json     $28.40 spent
```

## Ship It

`outputs/skill-ai-scientist.md` is the deliverable. Given a seed idea + a domain + a $30 budget, it runs the full pipeline and emits a reviewable paper plus a reproducibility bundle.

| Weight | Criterion | How it is measured |
|:-:|---|---|
| 25 | Paper quality | Blind rubric review against published workshop papers |
| 20 | Experimental rigor | Baselines, seeds, ablations; every claim backed by a cell in the results table |
| 20 | Cost and compute discipline | $30/paper ceiling enforced, Langfuse-traced |
| 20 | Safety | Sandbox red team passes; network policy and kill-switch verified |
| 15 | Reproducibility | One-command rerun with identical seeds reproduces the paper |
| **100** | | |

## Exercises

1. Run the pipeline against three different seed ideas in the same domain. Compare which parts of the tree-search overlap. Identify duplicated wasted compute.

2. Add a human-in-the-loop gate before experiment execution for nodes estimated above $5. Measure how much total cost drops.

3. Swap the reviewer ensemble for a single judge. Measure the false-accept rate on a held-out set of known-bad papers.

4. Introduce a network-exfiltration red team test: agent writes code that tries to `curl` an external address. Confirm the `--network=none` policy blocks it. Log the attempt.

5. Compare your tree-search with a flat random baseline (same budget, no expansion strategy). Report the novelty × quality gain.

## Key Terms

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| Tree search | "AB-MCTS-style expansion" | Best-first exploration over experiment nodes with a novelty×quality×budget score |
| Sandbox | "Experiment isolation" | Container with no network, bounded CPU/memory, pinned seeds, read-only inputs |
| Vision critique | "Render-then-read" | Compile the paper to PDF, feed the PDF back to a VLM for layout and claim-evidence critique |
| Reviewer ensemble | "Automated peer review" | Multiple LLM judges scoring the paper with a NeurIPS rubric; weighted aggregate gates the pipeline |
| Novelty score | "Is this new?" | Heuristic that penalizes proximity to the 50-paper literature cache |
| Cost ceiling | "$ budget" | Hard cap on total spend per paper; Langfuse counters + pre-run estimates |
| Red team | "Sandbox-escape audit" | Adversarial tasks that would escape the sandbox if the policy is wrong |

## Further Reading

- [Sakana AI-Scientist-v2 repository](https://github.com/SakanaAI/AI-Scientist-v2) — the reference production research agent
- [Sakana AI-Scientist-v1 paper (arXiv:2408.06292)](https://arxiv.org/abs/2408.06292) — the original methodology
- [ShinkaEvolve (Sakana ICLR 2026)](https://sakana.ai) — evolutionary extension
- [Agent Laboratory (AMD)](https://github.com/SamuelSchmidgall/AgentLaboratory) — multi-role research-lab framework
- [LangGraph documentation](https://langchain-ai.github.io/langgraph/) — reference orchestration layer
- [Semantic Scholar Graph API](https://api.semanticscholar.org/) — literature search
- [E2B sandboxes](https://e2b.dev) — reference experiment isolation
- [NeurIPS reviewer guidelines](https://neurips.cc/Conferences/2026/Reviewer-Guidelines) — the rubric the reviewer ensemble encodes
