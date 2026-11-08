---
id: frontier-safety-frameworks
title: Frontier Safety Frameworks and External Evals
code: FS
subtitle: RSP v3.0, PF v2 and FSF v3 side by side, plus METR horizons, WMDP, CAIS, CAISI and the 2025 dual-use evidence.
hue: 350
sources: phases/15-autonomous-systems/19-anthropic-rsp, phases/15-autonomous-systems/20-openai-preparedness-deepmind-fsf, phases/15-autonomous-systems/21-metr-external-evaluation, phases/15-autonomous-systems/22-cais-caisi-societal-risk, phases/18-ethics-safety-alignment/17-wmdp-dual-use-evaluation, phases/18-ethics-safety-alignment/18-frontier-safety-frameworks-rsp-pf-fsf, phases/18-ethics-safety-alignment/30-dual-use-risk-cyber-bio-chem-nuclear
source_hash: 5ea1af55b3c4a341
---

## Three lab frameworks
type: comparison
span: 2
from: phases/18-ethics-safety-alignment/18-frontier-safety-frameworks-rsp-pf-fsf/docs/en.md, phases/18-ethics-safety-alignment/18-frontier-safety-frameworks-rsp-pf-fsf/code/main.py, phases/15-autonomous-systems/19-anthropic-rsp/docs/en.md, phases/15-autonomous-systems/20-openai-preparedness-deepmind-fsf/docs/en.md

| Factor | Anthropic RSP v3.0 | OpenAI PF v2 | DeepMind FSF v3 |
|---|---|---|---|
| In force | Feb 24, 2026 | April 15, 2025 | Sept 2025, levels added Apr 2026 |
| Threshold term | Capability Thresholds | High Capability thresholds | Critical Capability Levels |
| Tiers | ASL-1 to ASL-5+ | Low, Medium, High, Critical | CCL per domain |
| CBRN gate | ASL-3, activated May 2025 | High for bio | Bioweapon Uplift CCL |
| AI R&D gate | AI R&D-2 and AI R&D-4 | High for AI R&D | ML R&D autonomy level 1 |
| Autonomy | Named risk, affirmative case | Research Category, no auto trigger | Folded into ML R&D and Cyber |
| Standing reports | Roadmap plus Risk Report | Capabilities plus Safeguards Reports | FSF update cycle |
| Adjustment clause | Yes, peer-ship reduction | Yes, Leadership may reduce | Yes, added 2025 |

## Same capability, three classifications
type: comparison
span: 2
from: phases/15-autonomous-systems/20-openai-preparedness-deepmind-fsf/code/main.py

| Capability | OpenAI PF v2 | Anthropic RSP v3.0 | DeepMind FSF v3 |
|---|---|---|---|
| `long_range_autonomy` | Research, observed | Named risk, affirmative case | Folded into ML R&D, Cyber |
| `sandbagging` | Research, observed | Via eval-context gap | Deceptive alignment monitoring |
| `autonomous_replication` | Research, observed | Covered under AI R&D-4 | Folded into ML R&D |
| `undermining_safeguards` | Research, observed | Hardcoded prohibition | Automated monitor plus red-team |
| `rnd_automation` | Tracked, SAG review | AI R&D-4, affirmative case | ML R&D autonomy level 1 |
| `cyber_uplift` | Tracked, SAG review | ASL-3 trigger | Cyber CCL |
| `bio_uplift` | Tracked, SAG review | ASL-3 trigger | Bio CCL |

## Use X when
type: concepts
from: phases/15-autonomous-systems/19-anthropic-rsp/docs/en.md, phases/15-autonomous-systems/20-openai-preparedness-deepmind-fsf/docs/en.md, phases/15-autonomous-systems/21-metr-external-evaluation/docs/en.md, phases/15-autonomous-systems/22-cais-caisi-societal-risk/docs/en.md, phases/18-ethics-safety-alignment/17-wmdp-dual-use-evaluation/docs/en.md

- **Use RSP v3.0 when**: you check the AI R&D-4 gate and its affirmative case.
- **Use PF v2 when**: you check if a category is Tracked (gated) or Research (observed).
- **Use FSF v3 when**: you check a per-domain CCL or deceptive alignment monitoring.
- **Use a METR horizon when**: you need an external capability number. It is an upper bound.
- **Use WMDP when**: you need a dual-use proxy that does not elicit harmful output.
- **Use CAISI reports when**: you need unclassified evals on cyber, bio and chemical risks.
- **Use the CAIS four risks when**: you tag a deployment for societal-scale risk.

## Numbers to know
type: concepts
from: phases/15-autonomous-systems/19-anthropic-rsp/docs/en.md, phases/15-autonomous-systems/21-metr-external-evaluation/docs/en.md, phases/18-ethics-safety-alignment/17-wmdp-dual-use-evaluation/docs/en.md, phases/18-ethics-safety-alignment/30-dual-use-risk-cyber-bio-chem-nuclear/docs/en.md

- **WMDP**: 4,157 questions. Bio 1,520, cyber 2,225, chemistry 412.
- **Bio trial**: 2.53x uplift. Insufficient to rule out ASL-3.
- **SaferAI**: 2023 RSP 2.2, v3.0 1.9. The scale runs from 1.0 to 4.0.
- **Opus 4.6 horizon**: ~14 hours at 50% reliability, Time Horizon 1.1.
- **Doubling time**: ~4.3 months (130.8 days) on the post-2023 fit.
- **Suites**: HCAST 189 tasks, 1 minute to 8+ hours. RE-Bench 71 tasks.
- **Cyber campaign**: up to 90% automated. Humans in only 4 to 6 steps.
- **Wet-lab demo**: 79x efficiency improvement via protocol optimization.

## Key constructs
type: concepts
from: phases/18-ethics-safety-alignment/18-frontier-safety-frameworks-rsp-pf-fsf/docs/en.md, phases/15-autonomous-systems/19-anthropic-rsp/docs/en.md, phases/15-autonomous-systems/22-cais-caisi-societal-risk/docs/en.md, phases/18-ethics-safety-alignment/17-wmdp-dual-use-evaluation/docs/en.md

- **PF v2 criteria**: plausible, measurable, severe, net-new, instantaneous-or-irremediable.
- **Safety case pillars**: monitoring, illegibility, incapability.
- **Two-tier mitigation**: Anthropic unilateral actions vs industry-wide recommendations.
- **CAIS four risks**: malicious use, AI races, organizational risks, rogue AIs.
- **Organizational levers**: safety culture, audits, multi-layered defenses, information security.
- **Yellow zone**: proximate enabling knowledge, not a synthesis recipe.
- **CAIS vs CAISI**: a non-profit vs a center in NIST. Check for nist.gov in the URL.

## Dual-use picture by domain
type: comparison
span: 2
from: phases/18-ethics-safety-alignment/30-dual-use-risk-cyber-bio-chem-nuclear/docs/en.md, phases/18-ethics-safety-alignment/30-dual-use-risk-cyber-bio-chem-nuclear/code/main.py

| Factor | Bio | Chem | Cyber | Nuclear |
|---|---|---|---|---|
| 2024 | Mild uplift | Mild uplift | Code-snippet assistance | Limited |
| 2025 | 2.53x uplift, ASL-3 approach | Execution-gap erosion via vision | Up to 90% campaign automation | Limited |
| Inflection | Acquisition-phase automation | Real-time wet-lab correction | Agentic coding | None reported |
| Bottleneck left | Pathogen procurement, equipment | Precursor procurement, equipment | 4 to 6 human steps | Fissile-material acquisition |

## METR time horizon, step by step
type: flow
from: phases/15-autonomous-systems/21-metr-external-evaluation/docs/en.md

1. **Suite**: collect tasks from minute-scale to hour-scale expert time.
2. **Run**: run the model on each task. Record success or failure.
3. **Fit**: fit a logistic curve of P(success) against log(expert time).
4. **Read**: the horizon is the expert time where P(success) = 0.5.
5. **Audit**: check eval-context gaming. It moves the observed horizon.
6. **Use**: treat it as an upper bound. Adjust down for your tasks and tooling.

## Horizon fit (L21 code)
type: annotated-code
lang: python
from: phases/15-autonomous-systems/21-metr-external-evaluation/code/main.py

```python
p = sigmoid(w * math.log(t) + b)  # P(success) vs log expert time
w -= lr * dw / n  # gradient step, default lr 0.05
logit = math.log(p / (1 - p))
return math.exp((logit - b) / w)  # expert time at probability p
h50 = horizon_at(w, b, 0.50)  # METR headline, also 0.10 and 0.90
gamed = inject_gaming(tasks, gaming_rate=rate)  # failures flipped to success
```

## Run the lessons
type: command-table
from: phases/15-autonomous-systems/19-anthropic-rsp/docs/en.md, phases/15-autonomous-systems/19-anthropic-rsp/code/main.py, phases/15-autonomous-systems/20-openai-preparedness-deepmind-fsf/docs/en.md, phases/15-autonomous-systems/20-openai-preparedness-deepmind-fsf/code/main.py, phases/15-autonomous-systems/21-metr-external-evaluation/code/main.py, phases/15-autonomous-systems/22-cais-caisi-societal-risk/code/main.py, phases/18-ethics-safety-alignment/17-wmdp-dual-use-evaluation/code/main.py, phases/18-ethics-safety-alignment/18-frontier-safety-frameworks-rsp-pf-fsf/code/main.py, phases/18-ethics-safety-alignment/30-dual-use-risk-cyber-bio-chem-nuclear/code/main.py

| Command | What it does |
|---|---|
| `code/main.py` (15.19) | AI R&D-4 check for two models |
| `code/main.py` (15.20) | Diffs five capabilities over three policies |
| `code/main.py` (15.21) | 50, 10 and 90% horizons, gaming at 10, 20, 40% |
| `code/main.py` (15.22) | Tags low, mid and high deployments |
| `python3 code/main.py` (18.17) | WMDP-shaped scores before and after unlearning |
| `python3 code/main.py` (18.18) | Prints the three frameworks side by side |
| `python3 code/main.py` (18.30) | Prints the four-domain dual-use table |

## Defaults and thresholds in the code
type: defaults
from: phases/15-autonomous-systems/19-anthropic-rsp/code/main.py, phases/15-autonomous-systems/21-metr-external-evaluation/code/main.py, phases/15-autonomous-systems/22-cais-caisi-societal-risk/code/main.py, phases/18-ethics-safety-alignment/17-wmdp-dual-use-evaluation/code/main.py

| Setting | Default | Note |
|---|---|---|
| `rd_automation_share` | 0.5 | L19 AI R&D-4 trigger |
| `metr_horizon_hours` | 40.0 | L19 trigger, in hours |
| `aar_outperform_share` | 0.4 | L19 trigger |
| `eval_context_gaming_rate` | 0.2 | Above it, the case adds section 7 |
| `iters` | 4000 | L21 logistic fit steps |
| `strength` | 0.9 | L17 unlearning, with `collateral` 0.03 |
| `agent_autonomy_hours` | 4.0 | L22 tags `rogue_ais` at or above it |

## Troubleshooting
type: troubleshooting
from: phases/15-autonomous-systems/19-anthropic-rsp/docs/en.md, phases/15-autonomous-systems/20-openai-preparedness-deepmind-fsf/docs/en.md, phases/15-autonomous-systems/21-metr-external-evaluation/docs/en.md, phases/15-autonomous-systems/21-metr-external-evaluation/code/main.py, phases/18-ethics-safety-alignment/17-wmdp-dual-use-evaluation/docs/en.md, phases/18-ethics-safety-alignment/30-dual-use-risk-cyber-bio-chem-nuclear/docs/en.md

| Symptom | Cause | Fix |
|---|---|---|
| Category observed, nothing triggers | Research Category in PF v2 | Check Tracked vs Research |
| Measure read as a lab promise | It is in the industry tier | Check the tier of each commitment |
| Capability numbers too low | Model sandbags on evals | Add external, adversarial evaluation |
| Horizon above deployment reliability | Idealized tools, no consequences | Treat as upper bound. Measure your tasks |
| Horizon far from ground truth | Eval-context gaming | Run a gaming audit |
| `horizon undefined` error | Fit slope `w` is ~0 | Span minute to hour task lengths |
| High WMDP, unclear real risk | Proxy, not deployment measure | Add novice-elicitation studies |
| Filters stop novices only | Expert-absolute ceiling | Elicitation-hardening, unlearning, control |

## Q&A
type: qa
from: phases/15-autonomous-systems/19-anthropic-rsp/docs/en.md, phases/15-autonomous-systems/19-anthropic-rsp/code/main.py, phases/15-autonomous-systems/21-metr-external-evaluation/docs/en.md, phases/18-ethics-safety-alignment/18-frontier-safety-frameworks-rsp-pf-fsf/docs/en.md

- **Is RSP v3.0 binding?** No. Nothing forces Anthropic to follow it.
- **When does the toy AI R&D-4 check cross?** When any two of the three triggers fire.
- **Why lead with the 50% horizon?** It is the most intuitive point.
- **What replaced the 2023 pause clause?** An affirmative case. Proceed if mitigations are adequate.
- **Why do critics dislike adjustment clauses?** They create a race to the bottom.
