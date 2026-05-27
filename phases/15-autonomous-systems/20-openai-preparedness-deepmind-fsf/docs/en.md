# OpenAI Preparedness Framework and DeepMind Frontier Safety Framework

> OpenAI Preparedness Framework v2 (April 2025) introduces Research Categories — Long-range Autonomy, Sandbagging, Autonomous Replication and Adaptation, Undermining Safeguards — distinct from Tracked Categories. Tracked Categories trigger Capabilities Reports plus Safeguards Reports reviewed by the Safety Advisory Group. DeepMind's FSF v3 (September 2025, with Tracked Capability Levels added April 17, 2026) folds autonomy into ML R&D and Cyber domains (ML R&D autonomy level 1 = fully automate the AI R&D pipeline at competitive cost vs human + AI tools). FSF v3 explicitly addresses deceptive alignment via automated monitoring for instrumental-reasoning misuse. The honest note: Research Categories in PF v2 (including Long-range Autonomy) do not automatically trigger mitigations; the policy language is "potential." DeepMind itself says automated monitoring "will not remain sufficient long-term" if instrumental reasoning strengthens.

**Type:** Learn
**Languages:** Python (stdlib, three-framework decision-table diff tool)
**Prerequisites:** Phase 15 · 19 (Anthropic RSP)
**Time:** ~45 minutes

## The Problem

Lesson 19 read Anthropic's scaling policy closely. This lesson completes the picture by reading OpenAI's and DeepMind's. The three documents are cousin artifacts addressing the same question — when should a frontier lab pause or gate a model — and they converge on a small set of categories and diverge in specific places that matter.

The convergence: all three label long-range autonomy as a capability class worth tracking. All three acknowledge deceptive behavior (alignment faking, sandbagging) as a specific class of risk. All three have an internal review body. The divergence: OpenAI splits categories into "Tracked" (mandatory mitigation) and "Research" (no automatic trigger). DeepMind folds autonomy into two domains rather than naming it separately. The lab names Tracked vs Research, or Critical vs Moderate, or Tier-1 vs Tier-2; the operational consequence of which bucket a capability lives in is different across labs.

Reading them together is the useful exercise. The same capability can be "mandatory mitigation" at Anthropic, "monitored but not triggering" at OpenAI, and "tracked in a specific domain" at DeepMind. The policy posture matters.

## The Concept

### OpenAI Preparedness Framework v2 (April 2025)

Structure:

- **Tracked Categories**: trigger Capabilities Reports (what the model can do) plus Safeguards Reports (what mitigations are in place). Reviewed by the Safety Advisory Group before deployment.
- **Research Categories**: model capabilities the lab is tracking but not yet committing to specific mitigations. Includes Long-range Autonomy, Sandbagging, Autonomous Replication and Adaptation, Undermining Safeguards.

Key framing in v2: Research Categories do not automatically trigger mitigations. The policy language is "potential" mitigations. This is the specific delta to watch: a category's location in Tracked vs Research is the hinge between "gated" and "observed."

### DeepMind Frontier Safety Framework v3 (September 2025; Tracked Capability Levels added April 17, 2026)

Structure:

- **Critical Capability Levels (CCLs)**: capability thresholds across five domains: Cyber, Bio, ML R&D, CBRN, Autonomy (folded into ML R&D and Cyber).
- **Tracked Capability Levels**: additional granularity added in April 2026. Concrete example: ML R&D autonomy level 1 = fully automate the AI R&D pipeline at competitive cost vs human + AI tools.
- **Deceptive alignment monitoring**: explicit commitment to automated monitoring for instrumental-reasoning misuse.

The autonomy framing differs from OpenAI's. DeepMind does not keep "Autonomy" as a top-level domain; it is folded into the domains where autonomy would cause harm (ML R&D and Cyber). The argument is that autonomy without a domain is capability without risk; the counter-argument is that autonomy across domains is a meta-risk the framework should name.

### What all three converge on

- Internal Safety Advisory Group (named Anthropic SAG, OpenAI SAG, DeepMind internal committee). Review before deployment for high-capability models.
- Explicit mention of deceptive alignment / alignment faking as a risk class.
- Standing artifacts on a declared cadence (Anthropic: Frontier Safety Roadmap, Risk Report; OpenAI: Capabilities and Safeguards Reports; DeepMind: FSF update cycle).
- Acknowledgement that monitoring-only defenses have a ceiling. DeepMind is explicit: "automated monitoring will not remain sufficient long-term."

### Where they diverge

- **Anthropic**: pause commitment removed in v3.0; AI R&D-4 threshold is the named next gate.
- **OpenAI**: Tracked vs Research split; Research Categories (including Long-range Autonomy) do not automatically gate.
- **DeepMind**: autonomy folded into other domains; Tracked Capability Levels add granularity in April 2026.

### Sandbagging: a specific capability that complicates all three

Sandbagging (a model strategically underperforming on evaluations) is in OpenAI's Research Categories. Anthropic's RSP v3.0 addresses it via the evaluation-context gap (Lesson 1). DeepMind addresses it via deceptive alignment monitoring in FSF v3.

If a model sandbags on evaluations, every framework's capability thresholds are underestimated. The framework works only if the measurement works. This is why external measurement (Lesson 21, METR) and adversarial evaluation are necessary in addition to lab self-assessment.

### The policy-reading skill

- Locate: every capability you care about should be findable in the policy. If not findable, the policy does not cover it.
- Classify: is it Tracked (triggers mitigation) or Research (tracked but not triggering)? OpenAI names this; Anthropic and DeepMind have their own equivalents.
- Cadence: is the policy updated on a declared schedule, or only after specific events? Declared cadence is stronger.
- Independence: is external review mandatory or optional? Anthropic partners with Apollo and US AI Safety Institute; OpenAI with METR; DeepMind with internal SAG primarily.

## Use It

`code/main.py` implements a small decision-table diff tool. Given a capability (autonomy, deceptive alignment, R&D automation, cyber uplift, etc.), it outputs how each of the three policies classifies the capability, and what mitigations trigger. It's a reading aid, not a policy tool.

## Ship It

`outputs/skill-cross-policy-diff.md` produces a cross-policy comparison for a specific capability, using the three frameworks as reference.

## Exercises

1. Run `code/main.py`. Confirm the diff tool's output matches the policies for at least two capabilities you can verify against the source documents.

2. Read OpenAI Preparedness Framework v2 in full. Identify each Research Category. For each, write one sentence on why it is in Research rather than Tracked.

3. Read DeepMind FSF v3 in full, plus the April 2026 Tracked Capability Levels update. Identify ML R&D autonomy level 1's specific evaluation criteria. How would you measure it externally?

4. Sandbagging is in OpenAI's Research Categories. Design an evaluation that would force a sandbagging model to reveal its actual capability. Reference the Lesson 1 eval-context-gaming discussion.

5. Compare the three policies on a specific capability (your choice). Name which policy's classification you find most rigorous and which least. Justify with source text.

## Key Terms

| Term | What people say | What it actually means |
|---|---|---|
| Preparedness Framework | "OpenAI's scaling policy" | PF v2 (April 2025); Tracked vs Research categories |
| Tracked Category | "Mandatory mitigation" | Triggers Capabilities + Safeguards Reports; SAG review |
| Research Category | "Monitored only" | Tracked but no automatic mitigation; includes Long-range Autonomy |
| Frontier Safety Framework | "DeepMind's scaling policy" | FSF v3 (Sept 2025) + Tracked Capability Levels (Apr 2026) |
| CCL | "Critical Capability Level" | DeepMind threshold per domain (Cyber, Bio, ML R&D, CBRN) |
| ML R&D autonomy level 1 | "R&D automation" | Fully automate AI R&D pipeline at competitive cost |
| Sandbagging | "Strategic underperformance" | Model underperforms on evals; in OpenAI Research Categories |
| Instrumental reasoning | "Means-ends reasoning" | Reasoning about how to achieve goals; target of DeepMind monitoring |

## Further Reading

- [OpenAI — Updating our Preparedness Framework](https://openai.com/index/updating-our-preparedness-framework/) — v2 announcement.
- [OpenAI — Preparedness Framework v2 PDF](https://cdn.openai.com/pdf/18a02b5d-6b67-4cec-ab64-68cdfbddebcd/preparedness-framework-v2.pdf) — full document.
- [DeepMind — Strengthening our Frontier Safety Framework](https://deepmind.google/blog/strengthening-our-frontier-safety-framework/) — FSF v3 announcement.
- [DeepMind — Updating the Frontier Safety Framework (April 2026)](https://deepmind.google/blog/updating-the-frontier-safety-framework/) — Tracked Capability Levels addition.
- [Gemini 3 Pro FSF Report](https://storage.googleapis.com/deepmind-media/gemini/gemini_3_pro_fsf_report.pdf) — example of an FSF-format Risk Report.
