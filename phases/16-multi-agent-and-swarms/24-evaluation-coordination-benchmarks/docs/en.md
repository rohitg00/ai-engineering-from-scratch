# Evaluation and Coordination Benchmarks

> Five 2025-2026 benchmarks cover the multi-agent evaluation space. **MultiAgentBench / MARBLE** (ACL 2025, arXiv:2503.01935) evaluates star/chain/tree/graph topologies with milestone KPIs; **graph is best for research**, cognitive planning adds ~3% milestone achievement. **COMMA** evaluates multimodal asymmetric-information coordination; state-of-the-art models including GPT-4o struggle to beat a random baseline. **MedAgentBoard** (arXiv:2505.12371) covers four medical task categories and often finds multi-agent does not dominate single-LLM. **AgentArch** (arXiv:2509.10769) benchmarks enterprise agent architectures combining tool-use + memory + orchestration. **SWE-bench Pro** ([arXiv:2509.16941](https://arxiv.org/abs/2509.16941)) has 1865 problems across 41 repos spanning business apps, B2B services, and developer tools; frontier models score ~23% on Pro vs 70%+ on Verified — a reality check on contamination. Claude Opus 4.7 (April 2026) is reported at **64.3%** on Pro with explicit agent-teams coordination (no Anthropic primary source published yet — treat as preliminary); Verdent (agent scaffold) hits **76.1% pass@1** on Verified ([Verdent technical report](https://www.verdent.ai/blog/swe-bench-verified-technical-report)). **AAAI 2026 Bridge Program WMAC** (https://multiagents.org/2026/) is the 2026 community focal point. This lesson builds on MARBLE's metrics, runs a topology-vs-metric sweep, and pins the "just passing SWE-bench Verified is not evidence of generalization" rule.

**Type:** Learn
**Languages:** Python (stdlib)
**Prerequisites:** Phase 16 · 15 (Voting and Debate Topology), Phase 16 · 23 (Failure Modes)
**Time:** ~75 minutes

## Problem

When a paper claims "our multi-agent system is better," the question is: better than what, on what, measured how? The 2023-2024 era of multi-agent evaluation was chaos — everyone picked their own metrics, their own baselines, and their own task sets. The 2025-2026 benchmarks imposed structure.

Without shared benchmarks, you cannot compare two multi-agent systems meaningfully. Worse, without hold-out benchmarks, frontier models can contaminate. SWE-bench Verified became partially contaminated in training corpora by mid-2025; frontier scores inflated; Pro was designed as an uncontaminated reality check.

This lesson enumerates the five canonical 2026 benchmarks, names what each measures, and teaches you to read benchmark claims skeptically.

## Concept

### MultiAgentBench (MARBLE) — ACL 2025

arXiv:2503.01935. Evaluates four coordination topologies (star, chain, tree, graph) on research, coding, and planning tasks. Milestone-based KPIs track partial progress rather than only final success.

Measured results:

- **Graph** topology best for research scenarios; supports any-to-any critique.
- **Chain** best for stepwise-refinement coding.
- **Star** best for fast-factual consolidation.
- **Coordination tax** appears past ~4 agents on graph.
- **Cognitive planning** adds ~3% milestone achievement across topologies.

Use when: you want to compare coordination topologies apples-to-apples. The MARBLE repo (https://github.com/ulab-uiuc/MARBLE) provides the evaluator.

### COMMA — multimodal asymmetric information

Covers tasks where agents have different observation modalities and must coordinate without full information sharing. The reported result is uncomfortable: frontier models including GPT-4o struggle to beat a **random baseline** on agent-agent collaboration in COMMA. The signal is that multi-agent modalities are under-trained and under-evaluated — LLMs handle single-modality cooperation reasonably; multi-modality coordination collapses.

Use when: your system has multimodal or asymmetric-information coordination. The null result from COMMA is a warning to measure before claiming.

### MedAgentBoard — domain stress test

arXiv:2505.12371. Four medical task categories: diagnosis, treatment planning, report generation, patient communication. Compares multi-agent vs single-LLM vs conventional rule-based systems.

Finding: multi-agent does NOT dominate single-LLM on most categories. The multi-agent advantage is narrow — task decomposition helps when the subtasks are clearly separable (diagnosis + treatment); it hurts when coordination overhead exceeds specialization gain (report generation).

Use when: your domain has clear-cut single-LLM baselines. If MedAgentBoard's lesson generalizes, many proposed multi-agent systems are over-engineered.

### AgentArch — enterprise architectures

arXiv:2509.10769. Enterprise settings with tool use, memory, and orchestration layered together. Benchmark isolates the contribution of each layer: how much does adding tools help? Adding memory? Adding multi-agent orchestration?

Use when: you are designing an enterprise agent stack and need to justify each layer. AgentArch helps avoid buying features you cannot measure the value of.

### SWE-bench Pro — the reality check

arXiv:2509.16941. 1865 problems across 41 repositories spanning business apps, B2B services, and developer tools. Designed to be **uncontaminated** with later training cutoffs. Frontier models score ~23% on Pro vs 70%+ on Verified. The gap is the contamination signal.

April 2026 scores:
- Claude Opus 4.7 on Pro: **64.3%** (reported with explicit agent-teams coordination; no Anthropic primary source published yet — treat as preliminary).
- Verdent (agent scaffold) on Verified: **76.1% pass@1** ([technical report](https://www.verdent.ai/blog/swe-bench-verified-technical-report)).
- Frontier raw scores on Pro without agent scaffolding: ~23-35% ([SWE-bench Pro paper](https://arxiv.org/abs/2509.16941)).

The takeaway: "we beat SWE-bench Verified" is no longer evidence of capability. Pro is the current gating test. Agent-team scaffolding produces measurable gains on Pro (~30-40 point delta), which is one of the strongest empirical arguments for multi-agent coordination in 2026.

### AAAI 2026 WMAC

AAAI 2026 Bridge Program — Workshop on Multi-Agent Coordination (https://multiagents.org/2026/). The 2026 community focal point for multi-agent AI research. Accepted papers and workshop proceedings are the canonical venue for evaluating new methods; defer to WMAC-accepted claims over arXiv preprints for production decisions.

### Read benchmark claims skeptically — the 2026 checklist

When someone claims a multi-agent result:

1. **Which benchmark, which split?** SWE-bench Verified vs Pro matters a lot. A number reported on the wrong split is worthless.
2. **Contamination check.** Was the benchmark released after the model's training cutoff? If not, treat with caution.
3. **Baseline comparison.** Vs single-LLM baseline, vs random, vs prior multi-agent work. Not "vs untuned version of the same system."
4. **Statistical significance.** N trials, p-value, confidence interval. Frontier models are high-variance; single runs mislead.
5. **Task diversity.** One task or many? Generalization matters for production.
6. **Cost disclosure.** Tokens per task, wall-clock. A 90% solution at 20x cost is a business decision, not a capability claim.

### What none of the benchmarks measure well

- **Long-horizon coordination.** Days of wall-clock interaction. All current benchmarks run short.
- **Adversarial resilience.** What happens when one agent is malicious or compromised?
- **Drift under deployment.** Benchmarks are static; production distributions shift.
- **Cost-normalized performance.** Most benchmarks report raw accuracy, not accuracy-per-dollar.

Building your own internal benchmark for the axis you actually care about is often the right move.

## Build It

`code/main.py` is a non-interactive walk-through:

- Simulates 3 multi-agent systems on a toy task.
- Computes MARBLE-style milestone metrics for each.
- Runs a contamination check by withholding tasks from a "training" set.
- Compares to a random baseline explicitly.
- Prints a benchmark-claims scorecard.

Run:

```bash
python3 code/main.py
```

Expected output: system scorecard with raw accuracy, milestone achievement, cost-per-task, vs-random baseline delta, and a contamination-check note.

## Use It

`outputs/skill-benchmark-reader.md` reads any multi-agent benchmark claim and applies the scrutiny checklist. Output: a grade and caveats.

## Ship It

Production evaluation discipline:

- **Build an internal benchmark** that reflects your actual production distribution. Public benchmarks inform but do not substitute.
- **Include a random baseline** in every comparison. If you cannot beat random by a large margin on a coordination task, the task may be ill-posed.
- **Report cost alongside accuracy.** Token cost and wall-clock. Ops teams need both.
- **Rebuild the benchmark quarterly.** Production distribution shifts; stale benchmarks mislead.
- **Avoid published-benchmark overfitting.** If your team is optimizing specifically for SWE-bench Pro numbers, you will regress on production.

## Exercises

1. Run `code/main.py`. Identify which of the three simulated systems has the best cost-per-milestone. Does it match the highest raw-accuracy system?
2. Read MultiAgentBench (arXiv:2503.01935). For your own task domain, decide which of the four topologies MARBLE would recommend. Justify from the paper's results.
3. Read the SWE-bench Pro paper. What specifically makes it contamination-resistant? Could the same technique be applied to other benchmarks you care about?
4. Read COMMA's finding on multimodal coordination. Design a simple multimodal coordination task you could add to your internal benchmark. What would count as a useful signal?
5. Apply the benchmark-claims checklist to one recent multi-agent paper's headline result. What grade would you give the claim?

## Key Terms

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| MARBLE | "MultiAgentBench" | ACL 2025; star/chain/tree/graph topologies with milestone KPIs. |
| COMMA | "Multimodal benchmark" | Multimodal asymmetric-info coordination; frontier models struggle vs random. |
| MedAgentBoard | "Domain stress test" | Four medical categories; often finds multi-agent does not dominate single-LLM. |
| AgentArch | "Enterprise benchmark" | Tools + memory + orchestration layered. |
| SWE-bench Pro | "Contamination-resistant" | 1865 problems, 41 repos; ~23% vs 70%+ on Verified (the contamination signal). |
| Milestone achievement | "Partial credit" | Benchmarks that reward progress, not only final success. |
| Contamination | "Benchmark leaked into training" | Post-release, benchmarks drift into training corpora; scores inflate. |
| WMAC | "AAAI 2026 Bridge Program" | Workshop on Multi-Agent Coordination; community focal point. |

## Further Reading

- [MultiAgentBench / MARBLE](https://arxiv.org/abs/2503.01935) — topology benchmark with milestone KPIs
- [MARBLE repository](https://github.com/ulab-uiuc/MARBLE) — reference implementation
- [MedAgentBoard](https://arxiv.org/abs/2505.12371) — domain stress test; multi-agent often does not dominate
- [AgentArch](https://arxiv.org/abs/2509.10769) — enterprise agent architectures
- [SWE-bench leaderboards](https://www.swebench.com/) — Verified and Pro scores for frontier models
- [AAAI 2026 WMAC](https://multiagents.org/2026/) — the 2026 community focal point
