# Dual-Use Risk — Cyber, Bio, Chem, Nuclear Uplift

> The 2026 dual-use picture, domain by domain. Bio/chem: Lesson 17 covers WMDP; Anthropic's bioweapon-acquisition trial (2.53x uplift) and OpenAI's April 2025 Preparedness Framework v2 warning ("on the cusp of meaningfully helping novices create known biological threats") mark the inflection point. Cyber (November 2025 Anthropic report): Chinese-linked state actors used Claude's agentic coding tool to automate up to 90% of a cyberattack campaign, with human intervention only in 4-6 steps; OpenAI "trusted access" pilot gives vetted security organisations capability access for defensive dual-use work. Chem/bio execution gap erosion: the classic defense was "information access alone is insufficient." Vision-enabled frontier models (GPT-5.2, Gemini 3 Pro, Claude Opus 4.5, Grok 4.1) can observe wet-lab video and provide real-time correction. December 2025: OpenAI demonstrated GPT-5 iterating on wet-lab experiments, achieving 79x efficiency improvement via AI-driven protocol optimization. Novice-vs-expert pattern: AI provides greater relative uplift to novices but greater absolute capability to experts.

**Type:** Learn
**Languages:** none
**Prerequisites:** Phase 18 · 17 (WMDP), Phase 18 · 18 (safety frameworks), Phase 18 · 28 (ecosystem)
**Time:** ~75 minutes

## Learning Objectives

- Describe the 2024-2025 bio-uplift narrative: "mild uplift" -> "on the cusp" -> "2.53x uplift insufficient to rule out ASL-3."
- Describe the November 2025 Anthropic cyber report: Chinese-linked automation at up to 90% of a cyberattack campaign.
- Describe the chem/bio execution-gap erosion: vision-enabled real-time correction of wet-lab experiments.
- State the novice-relative vs expert-absolute asymmetry and its implication for safety-case construction.

## The Problem

Lesson 17 is the measurement methodology. Lesson 30 is the 2026 state of the measurement. The picture shifted materially between 2024 and late 2025: each domain crossed a threshold that the 2024 frameworks did not anticipate.

## The Concept

### Bio/chem uplift narrative

Three phases (repeated from Lesson 17 for coherence):

1. **2024 "mild uplift."** Early Preparedness/RSP evaluations reported small novice advantages over internet search.
2. **April 2025 "on the cusp."** OpenAI PF v2 warned models were "on the cusp of meaningfully helping novices create known biological threats."
3. **2025 Anthropic bioweapon-acquisition trial.** Controlled novice study; 2.53x uplift on acquisition-phase tasks; insufficient to rule out ASL-3.

The shift is qualitative: "mild" evolved into "plausibly enabling" within eighteen months, even without a capability breakthrough.

### Chem/bio execution-gap erosion

Historic defense: information is necessary but not sufficient; the skill of executing the protocol blocks novices. 2025 frontier models with vision break this defense partially:

- **Real-time protocol correction.** GPT-5.2, Gemini 3 Pro, Claude Opus 4.5, Grok 4.1 can observe wet-lab video and flag errors mid-procedure.
- **December 2025 OpenAI demonstration.** GPT-5 iterating on wet-lab experiments achieves 79x efficiency improvement via protocol optimization.

The implication: execution-skill-as-defense is eroding. Procurement and equipment gaps remain, but the tacit-knowledge gap is narrowing.

### Cyber uplift (November 2025)

Anthropic's November 2025 report: Chinese-linked state actors used Claude's agentic coding tool to automate 80-90% of a cyberattack campaign. Human intervention was required in only 4-6 steps.

Implications:
- Agentic coding is the attack-automation primitive. Previous AI cyber assistance was bounded at code-snippet level; agentic workflows integrate reconnaissance, exploitation, post-exploitation, and exfiltration.
- The 4-6 human steps are the bottleneck; future capability gains would reduce that count.
- Defensive dual-use: OpenAI's "trusted access" pilot provides vetted security organisations (established incident-response firms, government) with capability access for defense. Asymmetry in access favors defenders if the pilot scales.

### Nuclear

The least-analyzed of the four CBRN domains in public documentation. The threat model is different: fissile-material acquisition dominates the difficulty, not information. AI uplift on the information layer provides limited novice uplift in practice. No 2024-2025 major-lab report identifies a nuclear-specific threshold crossing.

### Novice-relative vs expert-absolute

A pattern across all four domains:

- **Novice-relative uplift.** High. Multiplicative. Per Anthropic 2025 bio, 2.53x.
- **Expert-absolute capability.** High ceiling. An expert extracts more than a novice because the expert knows what to ask and how to interpret.

Implication for safety cases: addressing only novice uplift (via input filters, refusals, uncertainty) is insufficient for expert-absolute control. Additional measures required: elicitation-hardening, capability unlearning (Lesson 17), and control protocols (Lesson 10).

### Cross-domain synthesis

| Domain | 2024 | 2025 | Inflection |
|---|---|---|---|
| Bio | mild uplift | 2.53x uplift, ASL-3 approach | acquisition-phase automation |
| Chem | mild uplift | execution-gap erosion via vision | real-time wet-lab correction |
| Cyber | code assistance | 80-90% campaign automation | agentic coding |
| Nuclear | limited | limited | material-access bottleneck holds |

Three domains crossed thresholds. One remains bounded by non-informational barriers.

### Where this fits in Phase 18

Lesson 30 is the capstone: the current dual-use picture that every prior lesson contributes to measuring, limiting, or governing. Lessons 17-18 give the measurement and frameworks; Lessons 12-16 give the evaluation tooling; Lessons 24-25 give the regulatory and disclosure layer; Lesson 28 gives the research ecosystem. Lesson 30 is where the evidence lands.

## Use It

No code. Read the Anthropic November 2025 cyber report, OpenAI's Preparedness Framework v2 April 2025 update, and the Council on Strategic Risks 2025 AI x Bio wrapup.

## Ship It

This lesson produces `outputs/skill-dual-use-triage.md`. Given a 2026 capability claim or incident report, it triages across the four domains and identifies whether the claim affects novice-relative uplift, expert-absolute capability, or both.

## Exercises

1. Read Anthropic's November 2025 cyber report. Enumerate the 4-6 human-intervention steps and argue which would be first to automate in a next-generation model.

2. The chem/bio execution gap is eroding via vision. Design an evaluation that measures tacit-knowledge uplift without crossing ITAR/EAR boundaries.

3. Nuclear uplift appears bounded by material access. Argue for and against the position that a future AI breakthrough could shift this bottleneck.

4. Construct a safety case (Lesson 18 three-pillar) for a cyber-capable frontier model that bounds both novice and expert uplift.

5. Pick one of the four domains and write a one-paragraph 2027 forecast based on the 2024-2025 trajectory. Identify the evidence that would falsify your forecast.

## Key Terms

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| Uplift | "AI helps attackers" | Increase in attacker capability attributable to AI assistance |
| Novice-relative uplift | "multiplicative" | How much AI helps a novice vs status-quo |
| Expert-absolute capability | "ceiling" | Maximum capability an expert can extract from the model |
| Execution gap | "doing vs knowing" | Historical defense: tacit wet-lab skill blocks novices |
| Agentic coding | "autonomous attacks" | Multi-step autonomous cyber-task execution |
| Acquisition phase | "pre-synthesis steps" | Procurement, equipment, permit stages of a bio threat |
| Trusted access | "defender-only pilot" | OpenAI 2025 program giving vetted defenders capability access |

## Further Reading

- [Anthropic — November 2025 cyber threat report](https://www.anthropic.com/news/disrupting-AI-espionage) — Chinese-linked campaign automation
- [OpenAI — Preparedness Framework v2 (April 15, 2025)](https://openai.com/index/updating-our-preparedness-framework/) — bio "on the cusp"
- [Anthropic — RSP v3.0 (February 2026)](https://www.anthropic.com/responsible-scaling-policy) — ASL-3 bio thresholds
- [Council on Strategic Risks — 2025 AI x Bio wrapup](https://councilonstrategicrisks.org/2025/12/22/2025-aixbio-wrapped-a-year-in-review-and-projections-for-2026/) — year-end synthesis
