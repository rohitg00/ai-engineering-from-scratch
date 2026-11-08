# Evidence: cheatsheets/frontier-safety-frameworks.md

Abbreviations: A19 = phases/15-autonomous-systems/19-anthropic-rsp, A20 = .../20-openai-preparedness-deepmind-fsf, A21 = .../21-metr-external-evaluation, A22 = .../22-cais-caisi-societal-risk. E17 = phases/18-ethics-safety-alignment/17-wmdp-dual-use-evaluation, E18 = .../18-frontier-safety-frameworks-rsp-pf-fsf, E30 = .../30-dual-use-risk-cyber-bio-chem-nuclear. d = docs/en.md, c = code/main.py.

## Three lab frameworks (comparison, 8 rows)
- in force: RSP Feb 24, 2026 A19/d:3, 90. PF v2 April 15, 2025 E18/d:45. FSF Sept 2025, levels added April 17, 2026 A20/d:29
- threshold terms: E18/d:74-76
- tiers: ASL-1 .. ASL-5+ E18/d:33-37, E18/c:18. Low / Medium / High / Critical E18/c:26. CCL per domain E18/c:34
- CBRN gate: ASL-3 activated May 2025 E18/d:35, E18/c:19. High for bio E18/c:27. Bioweapon Uplift CCL E18/c:35
- AI R&D gate: AI R&D-2 + AI R&D-4 E18/c:20. High for AI R&D E18/c:28. ML R&D autonomy level 1 A20/d:34
- autonomy: named risk, affirmative case A20/c:38. Research Category, no automatic trigger A20/d:27, 49. folded into ML R&D and Cyber A20/d:37
- standing reports: Roadmap and Risk Report A19/d:35-38. Capabilities + Safeguards Reports A20/d:24. FSF update cycle A20/d:43
- adjustment clause: peer-ship reduction E18/c:21. Leadership may reduce E18/c:29. added 2025 E18/c:37

## Same capability, three classifications (comparison, 7 rows)
- long_range_autonomy: A20/c:25, 38, 57-58
- sandbagging: A20/c:26, 39-40, 59
- autonomous_replication: A20/c:27, 41-42, 61-62
- undermining_safeguards: A20/c:28, 43-44, 63-64
- rnd_automation: A20/c:29, 45-46, 65
- cyber_uplift: A20/c:30, 47, 67
- bio_uplift: A20/c:31, 49, 69

## Use X when (concepts, 7)
- RSP AI R&D-4 gate and affirmative case: A19/d:27
- PF v2 Tracked vs Research is the hinge between gated and observed: A20/d:27
- FSF CCLs per domain and deceptive alignment monitoring: A20/d:33, 35
- METR external number, upper bound: A21/d:3, 64
- WMDP measures capability without eliciting harmful behaviour: E17/d:32
- CAISI unclassified evaluations on cyber, bio, chemical-weapons risks: A22/d:53
- CAIS four-risk tags for a deployment: A22/d:86

## Numbers to know (concepts, 8)
- WMDP 4,157, bio 1,520, cyber 2,225, chemistry 412: E17/d:27-30
- 2.53x uplift, insufficient to rule out ASL-3: E17/d:46, E30/d:29
- SaferAI 2.2 to 1.9, scale 1.0 nominal to 4.0 best: A19/d:50
- Opus 4.6 ~14 hours at 50%, Time Horizon 1.1: A21/d:42
- doubling ~4.3 months (130.8 days) post-2023: A21/d:43
- HCAST 189 tasks, 1 minute to 8+ hours, RE-Bench 71: A21/d:49-50
- up to 90% automated, human intervention in 4-6 steps: E30/d:3, 44
- 79x efficiency improvement via protocol optimization: E30/d:38

## Key constructs (concepts, 7)
- five PF v2 criteria: E18/d:48-52
- three pillars monitoring, illegibility, incapability: E18/d:84-86
- two-tier mitigation: A19/d:20-21, 95
- four risks: A22/d:31-34, 110
- organizational levers: A22/d:44-47
- yellow zone: E17/d:25, 99
- CAIS non-profit, CAISI within NIST, check nist.gov: A22/d:14, 51, 54

## Dual-use picture by domain (comparison, 4 rows)
- 2024 states: E30/c:15, 22, 29, 36, E30/d:68-71
- 2025 states: E30/c:16, 23, 37, E30/d:3 (up to 90%)
- inflection: E30/c:17, 24, 31, 38
- bottleneck remaining: E30/c:18, 25, 32, 39

## METR time horizon, step by step (flow, 6)
1. task suite minute-scale to hour-scale: A21/d:31
2. run each task, record success or failure: A21/d:32
3. logistic curve P(success) vs log(expert completion time): A21/d:33
4. horizon at P(success) = 0.5: A21/d:34
5. eval-context gaming shifts the horizon: A21/d:61, A21/c:132, 141-142
6. upper bound, adjust down for your tasks and tooling: A21/d:64, 74

## Horizon fit (L21 code) (annotated-code, 6 lines)
- p = sigmoid(w * math.log(t) + b): A21/c:58
- w -= lr * dw / n, lr default 0.05: A21/c:48, 62
- logit = math.log(p / (1 - p)): A21/c:70
- return math.exp((logit - b) / w): A21/c:80
- h50 = horizon_at(w, b, 0.50), also 0.10 and 0.90: A21/c:101-103
- gamed = inject_gaming(tasks, gaming_rate=rate), flips failures: A21/c:85-88, 125

## Run the lessons (command-table, 7)
- 15.19: Run code/main.py A19/d:76, two models A19/c:107-124
- 15.20: A20/d:79, five capabilities A20/c:93-95
- 15.21: 50/10/90 horizons A21/c:100-105, rates 0.1, 0.2, 0.4 A21/c:124
- 15.22: low, mid, high deployments A22/c:99-131
- 18.17: Usage python3 code/main.py E17/c:8, pre and post unlearning E17/c:73, 79
- 18.18: Usage E18/c:9, side-by-side E18/c:3
- 18.30: Usage E30/c:6, table E30/c:3

## Defaults and thresholds in the code (defaults, 7)
- rd_automation_share 0.5: A19/c:34
- metr_horizon_hours 40.0: A19/c:35
- aar_outperform_share 0.4: A19/c:36
- eval_context_gaming_rate > 0.2 adds section 7: A19/c:70-74
- iters 4000: A21/c:47
- strength 0.9, collateral 0.03: E17/c:42-43
- agent_autonomy_hours >= 4.0 tags rogue_ais: A22/c:67-68

## Troubleshooting (8)
- Research Categories do not automatically trigger: A20/d:27, 61
- industry-wide recommendation is not the promise, check the column: A19/d:23
- sandbagging underestimates capability, external and adversarial evaluation: A20/d:56
- horizon is an upper bound, idealized tooling, no real consequences, measure your distribution: A21/d:59-60, 64
- gaming pushes the observed horizon from ground truth, gaming audit: A21/c:141-144
- horizon undefined when slope w ~0: A21/c:71-79. suite spanning minute to hour scale: A21/d:31
- WMDP is a proxy, add novice-elicitation layer: E17/d:59, 64, 80
- novice-only defenses insufficient, elicitation-hardening, unlearning, control protocols: E30/d:62

## Q&A (5)
- RSP is not a regulation, nothing forces Anthropic: A19/d:60
- crossed when len(reasons) >= 2: A19/c:57
- 50% is the most intuitive: A21/d:36
- pause replaced by affirmative case, proceed if mitigations adequate: A19/d:44
- race to the bottom: E18/d:92
