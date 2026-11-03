---
id: read-a-benchmark-claim
title: Read a multi-agent benchmark claim before you believe it
card: multi-agent
kind: concept
level: 2
roles: [agentic-ai-engineer, ai-evaluation-reliability-engineer, ai-developer-relations-engineer]
rounds: [ml-breadth, screen]
tags: [benchmarks, contamination, baseline, cost-disclosure, topology]
minutes: 8
lessons: [phases/16-multi-agent-and-swarms/24-evaluation-coordination-benchmarks]
manuals: []
practice: []
cheatsheet: [agent-benchmarks, multi-agent]
related: [multi-agent/five-agents-and-a-vote]
updated: 2026-11-03
---

A paper reports that its multi-agent coding system beats single agents by a wide margin on a well-known software engineering benchmark. Your team wants to adopt the architecture. What do you ask before you believe the number?

## Short answer

Ask which benchmark and which split, whether the benchmark was released after the model's training cutoff, what the comparison baseline was, how many trials were run, how many task types were covered, and what the result cost in tokens and wall-clock. The split matters most: frontier models score about 23 percent on the uncontaminated split of that benchmark against more than 70 percent on the older split, so a number without its split says nothing.

## Full answer

### The checklist

| Question | Why it matters |
|---|---|
| Which benchmark, which split | The newer split was built to resist contamination, and scores differ by a factor of three between splits |
| Contamination | A benchmark released before the model's cutoff can have leaked into training, so the score can be inflated |
| Baseline | Against a single-agent baseline, random, and prior multi-agent work, not against an untuned version of the same system |
| Significance | Number of trials and a confidence interval, because frontier models are high-variance and single runs mislead |
| Task diversity | One task or many, because production needs generalization |
| Cost disclosure | Tokens per task and wall-clock, because a strong result at 20 times the cost is a business decision |

### What the other benchmarks teach

The lesson surveys five benchmark families, and two of them are warnings. On a multimodal coordination benchmark with asymmetric information, frontier models struggle to beat a random baseline. On a medical benchmark with four task categories, multi-agent systems did not dominate a single model on most categories; decomposition helped where subtasks were separable and hurt where coordination cost exceeded the specialization gain. A topology benchmark found graph best for research, chain for stepwise coding, star for fast factual work, and a coordination tax past about 4 agents; cognitive planning added about 3 percent milestone achievement.

### What the number in the prompt may mean

If it is on the uncontaminated split, agent-team scaffolding has produced a measurable delta there, in the range of 30 to 40 points, and that is one of the stronger empirical arguments for coordination. If it is on the older split, the result is no longer evidence of capability.

### What no benchmark measures well

Long-horizon coordination over days, resilience to a malicious agent, drift under deployment, and cost-normalized performance. For the axis you care about, build an internal benchmark from your production distribution, include a random baseline in every comparison, report cost beside accuracy, and rebuild it quarterly.

## Follow-ups

- **Level 2:** Why compare a coordination system against random guessing? Expected: if the system cannot beat random by a wide margin, the task may be ill-posed, as the multimodal coordination results showed.
- **Level 2:** What does milestone achievement measure that final success does not? Expected: partial progress, so a system that gets most of the way is distinguished from one that fails at the start.
- **Level 3:** How do you check contamination yourself? Expected: compare the benchmark's release date with the model's training cutoff, and withhold a slice of tasks from any tuning set in your own evaluations.
- **Level 3:** The paper's score is reported without a primary source from the model's vendor. How do you treat it? Expected: as preliminary, and you do not make a production decision on it until an independent run reproduces it.

## Wrong answers

- "A wide margin on a known benchmark is enough to adopt." Without the split, the baseline, the trials and the cost, the margin is a headline, not evidence.
- "Multi-agent always helps on coding tasks." The medical and multimodal results show domains where it did not, and the coding gain depends on the split and the scaffolding.
- "Our internal benchmark is less rigorous than a public one." A public benchmark informs, and only an internal one reflects your production distribution and your cost constraints.

## Taught in

The [evaluation and coordination benchmarks lesson](../../../phases/16-multi-agent-and-swarms/24-evaluation-coordination-benchmarks/) lists the five benchmark families and the scrutiny checklist.
