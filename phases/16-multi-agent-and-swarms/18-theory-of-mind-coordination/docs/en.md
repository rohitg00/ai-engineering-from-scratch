# Theory of Mind and Emergent Coordination

> Li et al. (arXiv:2310.10701) showed that LLM agents in a cooperative text game exhibit **emergent high-order Theory of Mind** (ToM) — reasoning about what another agent believes about a third agent's beliefs — but fail on long-horizon planning due to context management and hallucination. Riedl (arXiv:2510.05174) measured higher-order synergy across a population and found that **only** the ToM-prompt condition produces identity-linked differentiation and goal-directed complementarity; lower-capacity LLMs show only spurious emergence. That is, coordination emergence is prompt-conditional and model-dependent, not free. This lesson implements a minimal ToM-aware agent, runs a cooperative task with and without ToM prompting, and measures the coordination delta against the Riedl 2025 protocol.

**Type:** Learn + Build
**Languages:** Python (stdlib)
**Prerequisites:** Phase 16 · 07 (Society of Mind and Debate), Phase 16 · 17 (Generative Agents)
**Time:** ~75 minutes

## Problem

Multi-agent coordination often looks magical: agents divide labor, anticipate each other, avoid redundancy. Usually this "emergence" is an artifact of prompt engineering — someone told the agents to "coordinate." Remove the prompt, remove the coordination.

Riedl's 2025 finding is stricter: under controlled conditions, coordination only emerges when agents are prompted to reason about **other agents' minds** (ToM). Without the ToM prompt, even strong models show coordination patterns that do not survive statistical controls. This matters for production: teams ship "multi-agent coordination" features that are prompt-dependent and brittle.

This lesson treats ToM as a specific capability (reasoning about beliefs about beliefs), builds a minimal ToM-aware agent, and measures what real coordination looks like vs. what prompt dressing looks like.

## Concept

### What ToM means

Developmental psychology: a 3-year-old thinks anyone's inner world matches theirs. A 5-year-old understands others have different beliefs. A 7-year-old reasons about beliefs about beliefs ("she thinks that I think the ball is under the cup"). These are zeroth, first, and second-order ToM.

For LLM agents, ToM orders map to:

- **Zeroth-order:** no model of others. The agent acts on its own observations only.
- **First-order:** the agent has a model of each other agent's beliefs. "Alice believes X."
- **Second-order:** the agent models recursive beliefs. "Alice believes that Bob believes X."

Li et al. 2023 found that first- and second-order ToM emerge in LLM agents in cooperative games but degrade with long horizon and unreliable communication.

### The Sally-Anne test, in brief

A 1985 false-belief test: Sally puts a marble in basket A, leaves. Anne moves it to basket B. Where will Sally look when she returns? A child with first-order ToM says basket A (Sally's belief differs from reality). A child without says basket B.

GPT-4-era LLMs pass Sally-Anne-style tests when posed plainly. They fail when the narrative is long, the scene changes several times, or the question is phrased indirectly. That is the practical 2026 state of ToM in production LLMs.

### Riedl's coordination measurement

Riedl (arXiv:2510.05174) built a population-scale test: N agents, a cooperative objective, variable prompt conditions. Measure:

1. **Identity-linked differentiation.** Do agents develop stable role distinctions over time?
2. **Goal-directed complementarity.** Do agents' actions complement each other (different subtasks) rather than duplicate?
3. **Higher-order synergy.** A statistical measure of whether the group achieves what no subset could.

Result: only under the ToM prompt condition do all three metrics produce signal above baseline. Without ToM prompting, metrics hover near chance for moderate-capacity models. Large models show some coordination without explicit ToM prompting but the effect is smaller than with explicit prompting.

### The coordination illusion

Without statistical controls, "emergent coordination" in demos often reflects:

- Prompt engineering that bakes in coordination (system prompts that say "work together").
- Observer bias (we see patterns we expect).
- Post-hoc selection of successful runs.

Production systems that market "emergent coordination" without measurable signal should be treated as marketing. Measure before claiming.

### A minimal ToM-aware agent

Structure:

```
agent state:
  own_beliefs:    {facts the agent believes}
  other_models:   {other_agent_id -> {beliefs_the_agent_attributes_to_them}}
  actions_last_N: [history of others' actions]

observation update:
  - update own_beliefs from direct observation
  - update other_models[agent_id] from their action + prior beliefs

action selection:
  - enumerate candidate actions
  - for each, predict what each other agent will do next given their modeled beliefs
  - pick action that maximizes joint outcome under those predictions
```

The `other_models` attribute is the ToM state. First-order ToM keeps just one level. Second-order adds `other_models[i][other_models_of_j]` — what I think agent i thinks agent j believes.

### Why long-horizon hurts

Li et al. document: context limits cause agents to forget which belief belongs to whom. Hallucination adds false beliefs to other-agent models. Both produce "I thought he thought X" errors that compound over time.

Mitigations documented in the paper and in 2024-2026 follow-ups:

- **Explicit ToM state in the prompt.** Structured format: `{agent_id: belief_list}`. Forces retrieval to preserve identity-belief binding.
- **Shorter reasoning chains.** Fewer ToM updates per turn reduce compounding hallucination.
- **External ToM store.** Maintain the model outside the LLM context; inject only relevant parts per turn.

### Where ToM fails in production

- **Adversarial settings.** Agents with good ToM are easier to manipulate (you can model what they model of you, then exploit).
- **Heterogeneous teams.** When models are different, the ToM model that works for one opponent does not generalize.
- **Ground-truth-dependent tasks.** ToM is about beliefs; if correctness depends on facts, ToM can be a distraction.

### The coordination you can actually measure

Three practical signals a team's coordination is real rather than prompt-dressed:

1. **Complementarity over time.** Over a multi-turn task, do agents' actions cover disjoint sub-tasks?
2. **Anticipation.** Does agent A's action at turn T+1 depend on a prediction about B's action at T+2 that turned out correct?
3. **Correction.** When A misreads B's belief at turn T, does A correct by turn T+2?

These are measurable in a logged multi-agent system. They are the substantive version of the "coordination" narrative.

## Build It

`code/main.py` implements:

- `ToMAgent` — tracks own beliefs and per-other-agent belief models.
- A cooperative task: three agents must collect three tokens from three boxes; each box can hold one token. Agents cannot communicate; they infer intent from each other's actions.
- Two configurations: `zeroth_order` (no ToM) and `first_order` (ToM with one-level belief model).
- Measurement over 200 randomized trials: completion rate, duplication rate (two agents targeting the same box), average turns to completion.

Run:

```
python3 code/main.py
```

Expected output: zeroth-order agents duplicate effort at ~35% rate and complete ~60% of trials in 10 turns. First-order ToM agents duplicate at ~5% and complete ~95%. The delta is the measurable coordination effect.

## Use It

`outputs/skill-tom-auditor.md` is a skill that audits a multi-agent system's claim of "emergent coordination." Checks for prompt dressing, statistical significance against a control, and measured complementarity.

## Ship It

Coordination claims checklist:

- **Control condition.** A version of your system without the coordination prompt. Measure both.
- **Statistical test.** Is the difference between system and control significant at `p < 0.05` on your metric?
- **Complementarity measure.** Action-disjointness over time, not just final success.
- **Failure-case log.** When agents miscoordinate, what does the ToM state look like?
- **Model-capacity disclosure.** If the effect vanishes on smaller models, say so.

## Exercises

1. Run `code/main.py`. Confirm first-order ToM reduces duplication rate by ~7x. Does the gap persist when you scale to 5 agents and 5 boxes?
2. Implement second-order ToM (agent A models what B thinks about C). Does it improve over first-order? On what tasks?
3. Inject a **hallucination** into the ToM state: randomly flip one belief per turn. How much does this degrade first-order performance?
4. Read Li et al. (arXiv:2310.10701). Reproduce the "long-horizon degradation" finding: as turns grow from 10 to 30, how does your first-order ToM performance change?
5. Read Riedl 2025 (arXiv:2510.05174). Implement the higher-order synergy statistic on your simulation logs. Is the effect present without the ToM prompt condition?

## Key Terms

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Theory of Mind | "Understanding others' minds" | The capacity to model another agent's beliefs. Graded by order (0, 1, 2+). |
| Sally-Anne test | "The false-belief test" | 1985 developmental psychology; LLMs pass plain versions, fail complex ones. |
| First-order ToM | "A believes X" | Modeling one other's beliefs about facts. |
| Second-order ToM | "A believes B believes X" | Recursive modeling one level deeper. |
| Identity-linked differentiation | "Stable roles over time" | Riedl's metric: roles persist, not random. |
| Goal-directed complementarity | "Disjoint actions" | Agents target different subtasks, not the same one. |
| Higher-order synergy | "Group exceeds any subset" | Riedl's statistical measure for real coordination. |
| Coordination illusion | "It looks coordinated" | Prompt-dressed appearance of coordination without measurable signal. |

## Further Reading

- [Li et al. — Theory of Mind for Multi-Agent Collaboration via Large Language Models](https://arxiv.org/abs/2310.10701) — emergent ToM in cooperative games; long-horizon failure modes
- [Riedl — Emergent Coordination in Multi-Agent Language Models](https://arxiv.org/abs/2510.05174) — population-scale measurement; ToM prompting is the load-bearing condition
- [Premack & Woodruff — Does the chimpanzee have a theory of mind?](https://www.cambridge.org/core/journals/behavioral-and-brain-sciences/article/does-the-chimpanzee-have-a-theory-of-mind/1E96B02CD9850E69AF20F81FA7EB3595) — the 1978 origin of the ToM concept
- [Baron-Cohen, Leslie, Frith — Does the autistic child have a theory of mind?](https://www.cambridge.org/core/journals/behavioral-and-brain-sciences/article/does-the-autistic-child-have-a-theory-of-mind/) — the Sally-Anne paper (1985)
