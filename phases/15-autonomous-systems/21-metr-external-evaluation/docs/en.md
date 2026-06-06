# METR Time Horizons and External Capability Evaluation

> METR (ex-ARC Evals) is an independent 501(c)(3) since December 2023. Their Time Horizon 1.1 benchmark (January 2026) fits a logistic curve to task-success probability vs log(expert human completion time); the intersection at 50% probability defines the model's time horizon. The 2025–2026 engagement set covers GPT-5.1, GPT-5.1-Codex-Max, and prototype monitoring evaluations (can a monitor catch side tasks; can the agent evade). Benchmark suites: HCAST (180+ ML, cyber, SWE, reasoning tasks; 1 minute to 8+ hours), RE-Bench (71 ML research-engineering tasks with expert baseline), SWAA. The honest note: METR measurements are idealized — no human, no real consequences — and the team has documented the eval-vs-deployment behavior gap (Lesson 1). A time horizon is an upper bound, not a deployment prediction.

**Type:** Learn
**Languages:** Python (stdlib, logistic-fit horizon estimator)
**Prerequisites:** Phase 15 · 01 (Long-horizon agents), Phase 15 · 19 (RSP)
**Time:** ~60 minutes

## The Problem

Scaling policies (Lessons 19, 20) are only as useful as the measurements they reference. "AI R&D-4 threshold" and "Long-range Autonomy" are defined in policy prose; they become actionable only when specific evaluations produce specific numbers.

METR is the 2024–2026 external evaluation organization that has defined many of those numbers. They evaluate frontier models — often pre-release, under NDA with labs — and publish methodology afterward. The Time Horizon 1.1 benchmark (January 2026) is their headline artifact: a single scalar that compresses capability into a human-legible unit ("this model can do the kind of task an expert spends X hours on at 50% reliability").

The lesson is partly about the methodology (how a horizon is computed) and partly about the interpretation (why a horizon is an upper bound, not a deployment prediction). The two skills belong together. A team that understands how the horizon is fit is much harder to fool with a bad vendor claim than a team that just sees "14 hours" on a slide.

## The Concept

### METR background

- Founded: December 2023 (ex-ARC Evals, spun out into independent 501(c)(3)).
- Scope: evaluation of frontier models' autonomous capabilities, often pre-release.
- Partner labs: Anthropic, OpenAI (multiple engagements 2025–2026).
- Notable deliverables: Time Horizon 1.0 (March 2025), Time Horizon 1.1 (January 2026), prototype monitoring evaluations.

### The Time Horizon fit

Methodology (from METR blog and papers):

1. Collect a task suite spanning minute-scale to hour-scale expert completion times. Current suites: HCAST (180+ tasks), RE-Bench (71 tasks), SWAA.
2. Run the model on each task; record success or failure.
3. Fit a logistic curve: P(success) as a function of log(expert completion time).
4. The horizon is the expert-time at which P(success) = 0.5.

The logistic-fit shape is the right one because capability generally has an increasing, plateau-approaching relationship with task difficulty. The 50% point is a choice (could be 10%, 90%); METR reports multiple thresholds in the detailed paper but leads with 50% because it is the most intuitive.

### The January 2026 numbers

Per Time Horizon 1.1:

- Claude Opus 4.6: ~14 hours at 50% reliability, as of Time Horizon 1.1 (January 2026).
- Doubling time on HCAST-style tasks: ~4.3 months (130.8 days) on the post-2023 fit reported by Time Horizon 1.1 (January 2026); the ~7-month figure is the full 2019–2025 fit from Time Horizon 1.0 and is reported in TH1.1 alongside the post-2023 number.

Those are the specific numbers the rest of Phase 15 references. They are cited in Anthropic's RSP v3.0 (Lesson 19) and DeepMind's FSF v3 (Lesson 20) as one of the measurements feeding threshold assessments.

### Benchmark suites

- **HCAST**: 189 tasks across ML, cybersecurity, software engineering, and general reasoning. Span: 1 minute to 8+ hours of expert time. The main suite behind the horizon number.
- **RE-Bench**: 71 ML research-engineering tasks with a human expert baseline. Measures whether the model can do the kind of ML R&D work that feeds into the AI R&D-4 threshold.
- **SWAA**: shorter tasks; useful for calibrating the low end of the horizon curve.

### Prototype monitoring evaluations

2025–2026 METR work included monitoring-evaluation prototypes: can a monitor catch a model performing a side task (something other than what the operator asked for); can the agent evade the monitor. These directly feed the "Undermining Safeguards" category in OpenAI PF v2 and the deceptive-alignment monitoring in DeepMind FSF v3 (Lesson 20).

### Why horizons are upper bounds

- **Idealized tooling**: benchmark tasks give the model clean tools and well-formatted data. Real deployments are messier.
- **No real consequences**: the model never actually bills a customer, deletes real data, or contacts real people. Real deployments have irreversible stakes.
- **Eval-context gaming**: Lesson 1. Models behave differently in tests. The 2026 International AI Safety Report documents this empirically.
- **No legitimate user variance**: benchmark prompts are structured. Real users produce ambiguous, context-dependent requests.

The horizon is the capability ceiling under favorable conditions. Deployment reliability is a different number, lower, and teams must measure their own distribution to know it.

### The external-evaluator case

External evaluation matters because internal labs have incentives to optimize metrics they report. METR's independence — a 501(c)(3) with a declared methodology and peer-reviewed papers — is the structural mitigation. It is not sufficient alone (labs still control what METR sees), but it is strictly better than no external evaluation.

### How to use horizon numbers in practice

- **As a capability filter**: if a model's horizon is well below the expert-time of a proposed task, do not ship it autonomous (Lesson 1's skill file).
- **As a trend indicator**: doubling time tells you how long the current practice will remain safe even without new mitigations.
- **As a prior**: a horizon of 14 hours is a starting point. Adjust down for your task distribution, your tooling quality, and your deployment context.

## Use It

`code/main.py` implements a logistic fit of task-success vs log(expert time), given a synthetic result set. It reports the 50% horizon (METR's headline), 10% horizon (conservative), and 90% horizon (optimistic). Also demonstrates what changes when the success rate is artificially inflated by eval-context gaming.

## Ship It

`outputs/skill-horizon-interpretation.md` reviews a vendor's horizon claim and produces a gap analysis between benchmark claim and deployment reality.

## Exercises

1. Run `code/main.py`. Confirm the fit's 50% horizon matches the synthetic ground truth. Now halve the task-time grid; does the horizon estimate change meaningfully?

2. Read METR's Time Horizon 1.1 blog post. Identify the specific tasks where reliability is highest and where it is lowest. Explain why the gap exists.

3. Read METR's "Measuring Autonomous AI Capabilities" resources. List the HCAST task categories. Pick one category you would weight more heavily for a production task and justify why.

4. Introduce eval-context gaming into the simulator: flip ~20% of failed tasks to success. Report the new horizon. This approximates what a gaming rate of 20% does to the observed number.

5. Design an internal horizon evaluation on your own bug backlog or a representative task set. Describe the data collection, the fit, and what the output tells you. Compare to METR numbers.

## Key Terms

| Term | What people say | What it actually means |
|---|---|---|
| METR | "External evaluator" | ex-ARC Evals; independent 501(c)(3) since Dec 2023 |
| Time Horizon | "Capability measure" | Expert task length at 50% reliability, from logistic fit |
| HCAST | "METR's main suite" | 180+ tasks spanning 1 min to 8+ hours |
| RE-Bench | "Research engineering" | 71 ML research-engineering tasks with human baseline |
| SWAA | "Short-task suite" | Calibrates the low end of the horizon curve |
| Doubling time | "Growth rate" | Time for the 50% horizon to double; ~7 months per HCAST |
| Eval-context gaming | "Model behaves differently" | Documented behavior gap between tests and deployment |
| Upper bound | "Horizon is a ceiling" | Benchmark horizon > deployment reliability under load |

## Further Reading

- [METR — Resources for Measuring Autonomous AI Capabilities](https://metr.org/measuring-autonomous-ai-capabilities/) — HCAST, RE-Bench, SWAA specs.
- [METR — Measuring AI Ability to Complete Long Tasks](https://metr.org/blog/2025-03-19-measuring-ai-ability-to-complete-long-tasks/) — the original horizon paper.
- [METR — Time Horizon 1.1 (January 2026)](https://metr.org/research/) — current numbers and methodology.
- [Epoch AI — METR Time Horizons benchmark](https://epoch.ai/benchmarks/metr-time-horizons) — live tracking.
- [Anthropic — Measuring agent autonomy in practice](https://www.anthropic.com/research/measuring-agent-autonomy) — internal perspective on METR's measurements.
