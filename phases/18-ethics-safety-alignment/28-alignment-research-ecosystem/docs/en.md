# Alignment Research Ecosystem — MATS, Redwood, Apollo, METR

> Five organisations define the 2026 non-lab alignment research layer. MATS (ML Alignment & Theory Scholars): 527+ researchers since late 2021, 180+ papers, 10K+ citations, h-index 47; summer 2024 cohort incorporated as 501(c)(3) with ~90 scholars and 40 mentors; 80% of pre-2025 alumni work on safety/security with 200+ at Anthropic, DeepMind, OpenAI, UK AISI, RAND, Redwood, METR, Apollo. Redwood Research: applied alignment lab founded by Buck Shlegeris; introduced AI Control (Lesson 10); collaborates with UK AISI on control safety cases. Apollo Research: pre-deployment scheming evaluations for frontier labs; authored In-Context Scheming (Lesson 8) and Towards Safety Cases for AI Scheming. METR (Model Evaluation and Threat Research): task-based capability evaluations, autonomous-task time-horizon studies; "Common Elements of Frontier AI Safety Policies" compares lab frameworks. Eleos AI Research: model-welfare pre-deployment evaluations (Lesson 19); conducted Claude Opus 4 welfare assessment.

**Type:** Learn
**Languages:** none
**Prerequisites:** Phase 18 · 01-27 (prior Phase 18 lessons)
**Time:** ~45 minutes

## Learning Objectives

- Identify the five organisations of the non-lab alignment research ecosystem and their core output.
- Describe MATS's scale (scholars, papers, h-index) and its role as a talent pipeline.
- Describe Redwood's AI Control agenda and its partnership with UK AISI.
- Describe METR's task-based evaluation methodology.

## The Problem

The frontier labs (Lesson 18) produce safety evaluations internally and publish selected results. The ecosystem outside the labs is where the evaluations are validated, where novel failure modes are first discovered, and where talent is trained. Understanding the ecosystem helps interpret which research findings are trusted by whom.

## The Concept

### MATS (ML Alignment & Theory Scholars)

Started late 2021. Research mentorship program; scholars spend 10-12 weeks with a senior researcher on a specific alignment problem.

Scale (2026):
- 527+ researchers since inception.
- 180+ papers published.
- 10K+ citations.
- h-index 47.
- Summer 2024: 90 scholars + 40 mentors; incorporated as 501(c)(3).

Career outcomes: ~80% of pre-2025 alumni are working on safety/security. 200+ at Anthropic, DeepMind, OpenAI, UK AISI, RAND, Redwood, METR, Apollo.

### Redwood Research

Applied alignment lab. Founded by Buck Shlegeris. Introduced the AI Control agenda (Lesson 10). Collaborates with UK AISI on control safety cases. Advises DeepMind and Anthropic on evaluation design.

Canonical papers: Greenblatt, Shlegeris et al., "AI Control" (arXiv:2312.06942, ICML 2024); Alignment Faking (Greenblatt, Denison, Wright et al., arXiv:2412.14093, joint with Anthropic).

Style: specific threat models, worst-case adversaries, concrete protocols that can be stress-tested.

### Apollo Research

Pre-deployment scheming evaluations for frontier labs. Authored In-Context Scheming (Lesson 8, arXiv:2412.04984). Partner on 2025 OpenAI anti-scheming training collaboration. Produces Towards Safety Cases for AI Scheming (2024).

Style: agentic-setting evaluations where deception can emerge; three-pillar decomposition (misalignment, goal-directedness, situational awareness).

### METR (Model Evaluation and Threat Research)

Task-based capability evaluations. Autonomous-task completion time-horizon studies. "Common Elements of Frontier AI Safety Policies" (metr.org/common-elements, 2025) compares lab frameworks.

Co-author on AI Scheming safety-case sketch with Apollo.

Style: long-horizon task evaluations, empirical capability measurement, framework synthesis.

### Eleos AI Research

Model-welfare pre-deployment evaluations. Conducted the Claude Opus 4 welfare assessment documented in section 5.3 of the system card. Provides the external methodology check for Lesson 19's welfare-relevant claims.

### The flow

MATS trains researchers. Graduates go to Anthropic, DeepMind, OpenAI (lab safety teams) or to Redwood, Apollo, METR, Eleos (external evaluation). External evaluators partner with labs and with UK AISI / CAISI. Publications feed the ecosystem back to MATS for the next cohort.

### Why this layer matters

Single-source evaluations are unreliable: labs evaluating their own models have a structural conflict of interest. External evaluators can raise and validate failure modes the lab may underreport. The 2024 Sleeper Agents paper (Lesson 7) was Anthropic + Redwood; Alignment Faking was Anthropic + Redwood; In-Context Scheming was Apollo; Anti-Scheming was Apollo + OpenAI. The multi-org structure is the quality control.

### Where this fits in Phase 18

Lessons 7-11 reference Redwood and Apollo work; Lesson 18 references METR's framework comparison; Lesson 19 references Eleos. Lesson 28 is the explicit organisational map for the ecosystem the rest of the Phase relies on.

## Use It

No code. Read METR's "Common Elements of Frontier AI Safety Policies" as an example of how external synthesis adds value to lab-internal policy work.

## Ship It

This lesson produces `outputs/skill-ecosystem-map.md`. Given an alignment claim or evaluation, it identifies the organisation, the publication venue, and the methodological style, and cross-checks against known-counterpart organisations.

## Exercises

1. Pick one paper from Lessons 7-15 and identify the organisations involved. Cross-check the authors against MATS alumni and current ecosystem affiliations.

2. Read METR's "Common Elements of Frontier AI Safety Policies." Identify the three cross-lab convergences they emphasize and the two largest divergences.

3. MATS career outcomes are ~80% safety/security. Argue whether this selection pressure is adaptive (trains the field) or biased (filters out heterodox positions).

4. Redwood and Apollo both do control/scheming work but with different styles. Pick a failure mode and describe how each would investigate it.

5. Eleos AI is the only pure model-welfare organisation. Design a hypothetical second organisation focused on a different welfare-adjacent question (cognitive liberty, robotic embodiment, etc.) and articulate its methodology.

## Key Terms

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| MATS | "the mentorship program" | ML Alignment & Theory Scholars; 527+ researchers since 2021 |
| Redwood Research | "the control lab" | Applied alignment; AI Control authors; UK AISI partner |
| Apollo Research | "the scheming evals" | Pre-deployment scheming evaluations for frontier labs |
| METR | "the task-horizon evals" | Task-based capability evaluations; framework synthesis |
| Eleos AI | "the welfare lab" | Model-welfare pre-deployment evaluations |
| Talent pipeline | "MATS -> labs" | MATS graduates flow to Anthropic, DM, OpenAI, Redwood, Apollo, METR |
| External evaluation | "non-lab check" | Evaluation not done by the model's producer; adds credibility |

## Further Reading

- [MATS (ML Alignment & Theory Scholars)](https://www.matsprogram.org/) — the mentorship program
- [Redwood Research](https://www.redwoodresearch.org/) — AI Control papers
- [Apollo Research](https://www.apolloresearch.ai/) — scheming evaluations
- [METR — Common Elements of Frontier AI Safety Policies](https://metr.org/blog/2025-03-26-common-elements-of-frontier-ai-safety-policies/) — framework comparison
- [Eleos AI Research](https://www.eleosai.org/research) — model welfare methodology
