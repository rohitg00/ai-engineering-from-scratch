---
id: five-agents-and-a-vote
title: Five agents and a vote made the answers worse
card: multi-agent
kind: tradeoff
level: 2
roles: [agentic-ai-engineer, applied-ai-engineer, ai-evaluation-reliability-engineer]
rounds: [design-review, ml-breadth]
tags: [self-consistency, heterogeneity, debate, topology, coordination-tax]
minutes: 10
lessons: [phases/16-multi-agent-and-swarms/15-voting-debate-topology]
manuals: []
practice: []
cheatsheet: [multi-agent, agent-reasoning-patterns]
related: [multi-agent/three-copies-of-one-model-voted]
updated: 2026-11-03
---

A team added an ensemble to a question-answering task: five agents on the same model debate until they agree, then answer. Accuracy fell below the single agent. They want to add more agents. What went wrong, and what would you change first?

## Short answer

Whether debate helps depends on structure, not on the count: who talks to whom, how many rounds, whether the agents are different, and whether anyone argues against. Five copies of one model share their errors, so the vote is correlated, and debate until agreement rewards the most confident agent through conformity. Change the composition before the count: start from self-consistency with one strong model, then swap one agent for a different base model, bound the rounds at two or three, and add a judge that does not vote.

## Full answer

### The baseline they skipped

Self-consistency samples one model several times at a temperature above zero and takes the majority over the reasoning paths. On a grade-school math set it gave large gains with 40 samples over one greedy decode. Its limit is that one model's errors are correlated by construction. A systematic bias is in every sample. That is also the team's ensemble with extra coordination.

### Heterogeneity is the knob

Replacing one of the agents with a different base model gives a bigger gain than adding one more copy. Each independent source of error is worth more than another correlated sample. In the limit, three different models beat five copies of one on tasks with a clean ground truth. The literature's name for the design that leans on this is adversarial heterogeneous debate: different models, and one of them argues against.

### Rounds and conformity

Debate can also degrade accuracy. Agents adjust their stance to match a critic even when the critic is wrong, and debate until agreement rewards whoever pushes hardest. Bound the rounds, two to three is typical, and give the final call to a separate judge that scores the consensus and does not vote. A survey of debate strategies found that variants structurally like self-consistency often underperform it at the same budget, and that debate helps most when agents are heterogeneous and the structure is adversarial.

### Topology and the tax

| Topology | Best for |
|---|---|
| Graph, any to any | Research, where agents critique each other |
| Star, one hub | Fast factual consolidation |
| Chain | Stepwise refinement |

On a graph the coordination tax appears past about 4 agents: wall-clock and tokens grow faster than quality, because every window fills with every peer's output. The ceiling is empirical and tied to current context capacity, not fundamental.

### A sequence that measures each step

1. Self-consistency at five samples on one strong model. This is the cheap baseline.
2. Heterogeneous voting at three agents if accuracy matters. Measure the delta.
3. Debate only when the task has structure and bounded rounds are feasible.
4. Log the minority cluster every time. A minority that is persistently right is a diversity signal.
5. Report tokens and wall-clock next to accuracy, because better accuracy at ten times the cost is a business decision.

## Follow-ups

- **Level 2:** Why does adding a sixth copy of the same model not help? Expected: it adds one more correlated sample, so the shared bias gets one more vote.
- **Level 2:** What does the judge do that the voters cannot? Expected: it scores the final consensus without having taken a position, so conformity pressure does not move it.
- **Level 3:** When is plain self-consistency the right final answer? Expected: a simple task with a clean ground truth, where five samples of one strong model are as accurate as any ensemble and far cheaper.
- **Level 3:** The task is opinion-shaped. What happens to the vote? Expected: agents converge on the most confident-looking answer rather than the most correct one, so a vote is an opinion poll and should be labeled as one.

## Wrong answers

- "Add more agents until the vote stabilizes." A stable wrong vote is still wrong, and past about four agents on a graph the cost grows faster than the quality.
- "Let them debate until they agree, because agreement means confidence." Unbounded debate rewards conformity, and the agreed answer is the loudest one, not the right one.
- "Use the same model at different temperatures for diversity." That is self-consistency, and the systematic bias of the model survives every temperature.

## Taught in

The [voting and debate topology lesson](../../../phases/16-multi-agent-and-swarms/15-voting-debate-topology/) builds the four topologies and measures the coordination tax.
