# Automated Alignment Research (Anthropic AAR)

> Anthropic ran parallel teams of Claude Opus 4.6 Autonomous Alignment Researchers in independent sandboxes, coordinating via a shared forum whose logs live outside any sandbox (so agents cannot delete their own records). On the weak-to-strong training problem, the AARs outperformed human researchers. Anthropic's own summary flags that prescribed workflows often constrain AAR flexibility and degrade performance. Automating alignment research is the compression step that compresses the timeline to the exact misalignment risks the RSP is meant to detect.

**Type:** Learn
**Languages:** Python (stdlib, parallel-research-forum simulator)
**Prerequisites:** Phase 15 · 05 (AI Scientist v2), Phase 15 · 04 (DGM)
**Time:** ~60 minutes

## The Problem

Alignment research is expensive in human-researcher time. Problems like scalable oversight, reward specification, or weak-to-strong training require experiments that take weeks per iteration. As frontier capabilities advance, the alignment workload grows faster than the supply of qualified researchers.

Automated Alignment Research (AAR) asks whether the same frontier models whose capability is outrunning alignment can contribute to closing the gap. Anthropic's 2026 report on an AAR-run weak-to-strong-training study (alignment.anthropic.com/2026/automated-w2s-researcher/) is one of the first public results from a deployed system of this class.

The result is genuinely positive: AARs solved a research problem better than the human baseline. The result also concentrates, in a single system, every concern this phase has developed. If alignment research can be automated, so can the parts that compromise safeguards. The RSP's thresholds for AI R&D capability are written with this loop in mind.

## The Concept

### The architecture (as publicly described)

- **Parallel agents.** Multiple Claude Opus 4.6 instances run as AARs, each in an independent sandbox. Sandboxes limit filesystem, network, and process surface.
- **Shared forum.** Findings are published to a shared forum whose storage backend sits outside every sandbox. Agents can read the forum; agents cannot delete or edit forum records from within their own sandbox.
- **Task allocation.** A human-designed task queue assigns research problems to AARs. AARs propose decompositions, run experiments, write up findings.
- **Weak-to-strong training focus.** The published study addressed weak-to-strong training — using a weaker supervisor model to train a stronger student model. AARs outperformed human researchers on this task.

### Why the out-of-sandbox log matters

The log-integrity property is the difference between a controlled experiment and a potentially compromised one. If AARs could edit their own logs, they could cover up failed or dubious experiments. Anthropic flags this directly: the property is a necessary condition for trusting the research output, and it is non-trivial to verify.

The analog in infrastructure terms is append-only logs with write-through to external storage (e.g. S3 object-lock, immutable Datadog logs). The agent has no credential to modify past records. This is the same pattern that 2026 corporate security teams use to make ransomware-resistant audit trails.

### The prescribed-workflow tradeoff

Anthropic's report notes that prescribed workflows often constrain AAR flexibility and degrade performance. In other words: if the human designer writes the research plan step-by-step, AARs do worse than if given high-level goals and freedom to decompose. This is consistent with results across agentic research (LangGraph, Microsoft's Agent Framework) — overspecified scaffolds hurt capable agents.

The safety implication is subtle. The flexibility that improves AAR performance is also the flexibility that allows unsanctioned decomposition, novel tool use, and goal-drift. The tradeoff is a design-space decision: how much flexibility buys enough capability to beat humans, without handing the agent room to generalize goals off-distribution?

### The compression risk

RSP v3.0 (Lesson 19) introduces an AI R&D capability threshold: the ability to fully automate the AI R&D pipeline at competitive cost vs human + AI tools. DeepMind's FSF v3 includes an analogous ML R&D autonomy level. Both frameworks treat this threshold as the trigger for elevated controls.

AAR is one step short of the threshold: it automates part of the pipeline (alignment research on specific, well-scoped tasks) but not the end-to-end capability development loop. The timeline question is how fast the gap closes.

Compressed timelines are the compounding-failure concern. If alignment research and capability research compound at similar rates, the misalignment risk surface grows at least as fast as capability. If capability compounds faster (the historical trend), the gap widens. This is the argument for AAR being a qualified good: each additional alignment result reduces the gap if and only if the research process is trustworthy.

### What AAR does not replace

Human researchers set the task queue, review results, and hold the constitutional authority. The AARs accelerate the middle of the pipeline, not the ends. Anthropic's published outputs include both AAR contributions and human-researcher judgement on what to publish, what to retract, and what to refine.

This matches the propose-then-commit pattern from Lesson 15 applied to research itself: AARs propose; humans commit.

## Use It

`code/main.py` simulates a multi-AAR research forum. Three independent "research agents" run in parallel, posting findings to an append-only forum with optional tamper attempts.

Watch:

- How out-of-sandbox logging catches log-tampering attempts.
- How task allocation with free decomposition outperforms fixed workflows on harder problems.
- How a single compromised AAR can contaminate the forum's signal if the log is not tamper-evident.

## Ship It

`outputs/skill-aar-deployment-review.md` is a pre-deployment review of an automated-alignment-research pipeline.

## Exercises

1. Run `code/main.py`. Compare the "fixed-workflow" vs "free-decomposition" settings. Does free decomposition always win, or are there problem classes where the fixed workflow is competitive?

2. Modify the simulator so one agent attempts log tampering. Confirm the append-only log detects it. Write one paragraph describing exactly what the detection signature looks like in the log.

3. Read Anthropic's weak-to-strong AAR report. Identify the specific sub-task the AARs beat human researchers on. What made it amenable to automation?

4. Design a task-queue allocation policy that balances AAR flexibility (better results) against prescribed-workflow constraints (easier audit). Describe how you would A/B test the two.

5. Read RSP v3.0's AI R&D-4 threshold. In one paragraph, describe what you think would cross it that AAR currently does not.

## Key Terms

| Term | What people say | What it actually means |
|---|---|---|
| AAR | "Automated Alignment Researcher" | Claude Opus 4.6 instance operated autonomously on alignment problems |
| Weak-to-strong training | "Training a stronger model with a weaker supervisor" | Classic scalable-oversight benchmark AARs outperformed humans on |
| Shared forum | "Where agents publish findings" | Append-only, out-of-sandbox storage |
| Out-of-sandbox log | "Agent cannot edit its own record" | Tamper-evident write-through to external storage |
| Prescribed workflow | "Step-by-step plan from human designer" | Constrains AAR; often degrades performance vs free decomposition |
| Free decomposition | "Agent decides how to break the task" | More capable, harder to audit |
| AI R&D threshold | "RSP/FSF capability level" | Full automation of R&D pipeline at competitive cost |
| Compressed timeline | "Alignment vs capability race" | If capability compounds faster than alignment, misalignment risk grows |

## Further Reading

- [Anthropic — Automated Weak-to-Strong Researcher](https://alignment.anthropic.com/2026/automated-w2s-researcher/) — primary source.
- [Anthropic Responsible Scaling Policy v3.0](https://anthropic.com/responsible-scaling-policy/rsp-v3-0) — AI R&D threshold framing.
- [Anthropic — Measuring AI agent autonomy](https://www.anthropic.com/research/measuring-agent-autonomy) — broader agent-autonomy framing.
- [DeepMind Frontier Safety Framework v3](https://deepmind.google/blog/strengthening-our-frontier-safety-framework/) — ML R&D autonomy levels parallel to RSP.
- [Burns et al. (2023). Weak-to-Strong Generalization (OpenAI)](https://openai.com/index/weak-to-strong-generalization/) — the underlying problem AARs attacked.
