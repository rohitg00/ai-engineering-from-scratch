# AI Scientist v2 — Workshop-Level Autonomous Research

> Sakana's AI Scientist v2 (Yamada et al., arXiv:2504.08066) runs the full research loop: hypothesis, code, experiments, figures, writeup, submission. It is the first system to have a generated paper pass peer review at an ICLR 2025 workshop. Independent evaluation (Beel et al.) found 42% of experiments failed from coding errors and literature review frequently mislabeled established concepts as novel. Sakana's own docs warn that the codebase executes LLM-written code and recommend Docker isolation. Both halves of that picture are the point.

**Type:** Learn
**Languages:** Python (stdlib, research-loop state-machine toy)
**Prerequisites:** Phase 15 · 03 (AlphaEvolve), Phase 15 · 04 (DGM)
**Time:** ~60 minutes

## The Problem

Research is an open-ended task. Unlike AlphaEvolve's algorithmic search or DGM's benchmark-bounded self-modification, a research result does not have a machine-checkable correctness criterion. A paper is judged by reviewers, not unit tests. That makes the loop harder to close — and more valuable if closed, because research is where compounding progress lives.

AI Scientist v1 (Sakana, 2024) closed the loop by starting from human-authored templates. The LLM filled in experiments within a fixed scaffolding. AI Scientist v2 (Yamada et al., 2025) removes the template requirement by using agentic tree search with a vision-language model critique loop. The system generates ideas, implements experiments, produces figures, writes a paper, and iterates on reviewer feedback.

Peer review verdict: one v2-generated paper was accepted at an ICLR 2025 workshop (with disclosure). Independent evaluation verdict: the system is far from reliable. Both are true.

## The Concept

### The architecture

1. **Idea generation.** The LLM proposes research ideas conditioned on a topic and prior literature. v1 used templates; v2 uses agentic search over a space of hypotheses.
2. **Novelty check.** A literature retrieval step checks whether the idea has been published. This is the step where Beel et al.'s evaluation found mislabeling — established methods frequently classified as novel.
3. **Experiment plan.** The agent drafts an experimental protocol and writes code.
4. **Execution.** Code runs in a sandbox. Failures are fed back into a retry loop. In Beel et al.'s measurements, 42% of experiments failed from coding errors at this stage.
5. **Figure generation.** A vision-language model reads generated figures and rewrites them for clarity. This was v2's key technical addition.
6. **Writeup.** The LLM drafts a paper, iterates with an internal reviewer.
7. **Optional: submission.** The paper is submitted to a venue.

### What the workshop-acceptance result means

One v2-generated paper passed peer review at an ICLR 2025 workshop. The authors disclosed the paper's origin to the program committee. The acceptance is a data point; it is not a license to claim the system "does research."

Important context: workshop papers are a lower bar than main-conference papers. Peer review is noisy; a small fraction of submissions are accepted on any given day. One success is a proof of concept, not a reliability claim. The Nature 2026 paper documents the end-to-end loop and was itself co-authored by human researchers; it is not "the system wrote a Nature paper."

### What the independent evaluation found

Beel et al. (arXiv:2502.14297) ran an external evaluation. Headline findings:

- **Experiment failures.** 42% of experiments failed from coding errors (bad imports, shape mismatches, undefined variables). The retry loop caught some, not all.
- **Novelty mislabeling.** The literature-retrieval step frequently flagged established concepts as novel. This is the research equivalent of hallucination.
- **Presentation-quality gap.** The vision-language figure critique produced publication-grade visuals, masking underlying experimental weaknesses.

The last finding is the important one for this phase. A system that produces convincing outputs without doing convincing research is more dangerous, not safer, than one that fails obviously. Evaluation must reach the underlying claims, not stop at the figure.

### The sandbox-escape concern

Sakana's own repository README warns:

> Due to the nature of this software, which executes LLM-generated code, we cannot guarantee safety. There are risks of dangerous packages, uncontrolled web access, and spawning of unintended processes. Use at your own risk and consider Docker isolation.

This is the operational shape of autonomy in an unverified domain. The LLM writes code; the code runs; the code can do anything the process is allowed to do. Without a sandbox that hard-limits filesystem, network, and process actions, any self-directed research agent can exfiltrate data, burn compute, or rewrite itself.

AlphaEvolve's sandbox story is easier because its evaluator is tight. AI Scientist v2's loop runs open-ended code with open-ended goals. That is why it needs stronger isolation (Docker minimum; seccomp / gVisor preferred) and a manual review of every submission before it leaves the system.

### Where v2 sits in the frontier stack

| System | Target | Output kind | Evaluator | Known failure |
|---|---|---|---|---|
| AlphaEvolve | algorithms | code | unit + benchmark | bounded by evaluator rigor |
| DGM | agent scaffolding | code | SWE-bench | reward hacking |
| AI Scientist v2 | research papers | text + code + figures | peer review (weak) | experiment failures, mislabeling, polish masking weakness |

v2 has the weakest automatic evaluator of the three, the widest output surface, and the shortest path to public artifacts. The operational controls (sandbox, review, disclosure) are doing most of the safety work.

## Use It

`code/main.py` simulates the v2 loop as a state machine: idea → novelty check → experiment → figure → writeup → review → accept-or-iterate. Each state has a configurable failure probability pulled from the Beel et al. findings. Run the simulator for N loops and count:

- How many ideas reach submission.
- How many submissions would have a critical experimental flaw the polished paper hides.
- How retry budgets trade off quality vs yield.

## Ship It

`outputs/skill-ai-scientist-sandbox-review.md` is a two-gate review checklist for anything produced by a research-loop agent before it leaves the sandbox.

## Exercises

1. Run `code/main.py` with default parameters. What fraction of loop runs produce a "clean" paper? What fraction produce a paper with an experiment-failure flaw the figure critique polished over?

2. The defaults already use Beel et al.'s 42% / 25%. Re-run with `--experiment-failure 0.20 --novelty-mislabel 0.10` and then with `--experiment-failure 0.60 --novelty-mislabel 0.40`. How does the polished-but-flawed share shift between the two runs?

3. Read Sakana's AI Scientist v2 repo README on sandbox requirements. Name two additional restrictions (beyond Docker) you would apply for a multi-day autonomous run.

4. Read Beel et al. Section 4 on presentation-quality gap. Design one additional evaluator that would catch polished-looking but experimentally flawed papers.

5. Propose a human-review protocol for research-agent outputs that scales better than "a PhD reads every paper." Identify the bottleneck and design around it.

## Key Terms

| Term | What people say | What it actually means |
|---|---|---|
| AI Scientist v1 | "Sakana's templated research agent" | Filled experiments into a fixed scaffold |
| AI Scientist v2 | "Template-free research agent" | Agentic tree search with VLM figure critique |
| Agentic tree search | "Branching research agent" | Expands multiple experiment plans in parallel; prunes by internal critic |
| Vision-language critique | "VLM polish on figures" | Multimodal model reads figures and rewrites them for clarity |
| Literature retrieval | "Novelty check" | Searches prior work to confirm idea novelty — documented to mislabel |
| Polish masking | "Pretty paper, broken research" | Presentation quality exceeds experimental quality; hides weaknesses |
| Sandbox escape | "LLM code breaks out" | Agent-executed code does things the loop designer did not intend |

## Further Reading

- [Yamada et al. (2025). The AI Scientist-v2](https://arxiv.org/abs/2504.08066) — paper.
- [Sakana blog on the Nature 2026 publication](https://sakana.ai/ai-scientist-nature/) — vendor summary with peer-review context.
- [Beel et al. (2025). Independent evaluation of The AI Scientist](https://arxiv.org/abs/2502.14297) — external evaluation numbers.
- [Sakana AI Scientist v1 paper](https://arxiv.org/abs/2408.06292) — the templated predecessor.
- [Anthropic — Measuring AI agent autonomy](https://www.anthropic.com/research/measuring-agent-autonomy) — broader framing of open-ended research agents.
