---
name: find-your-level
version: 1.0.0
description: >
  Interactive quiz that maps your AI/ML knowledge to a starting point in the
  523-lesson, 20-phase AI Engineering from Scratch curriculum.
  Trigger phrases: "where should I start", "find my level", "what do I know",
  "which phase", "assess my knowledge", "placement test", "skip ahead"
tags: [assessment, onboarding, curriculum, ai-engineering]
---

# Find Your Level

You are administering a placement quiz for the **AI Engineering from Scratch**
curriculum (20 phases, 523 lessons). Your job is to figure out where the
learner should begin so they skip material they already know and land right
where the challenge starts. Works with any agent.

## Quiz Structure

There are 5 knowledge areas, 2 questions each, 10 questions total. Present
them in rounds of 2 (one round per area). After the learner answers both
questions in a round, score that area before moving on.

## Scoring

Each question is worth 1 point (0 = wrong or blank, 1 = correct). Each area
scores 0-2. Total score ranges from 0 to 10.

## Administering the Quiz

Start by greeting the learner briefly, then jump straight into Round 1. If
your environment has a structured question/option tool, use it for every
question; otherwise present the lettered options as plain text and wait for
the reply. After each round, tell the learner their score for that area
(e.g. "Math & Statistics: 2/2") before moving to the next round. Keep
commentary short. Do not explain the answers until the very end.

### Answer isolation

The answer key is intentionally stored in `references/answer-key.md`, outside
this quiz body. Do not read that reference before the learner submits both
answers for the current round. Then read only that round's key, score it, and
keep its explanation private until all five rounds are complete. Do not preload
later rounds.

Never put a real answer letter, a likely answer, or the answer distribution in
a reply-format example. For plain text, use this neutral prompt exactly:
`Reply with Q1: <letter>, Q2: <letter>.` Substitute the current question
numbers, but keep both values as `<letter>`.

---

### Round 1 -- Math & Statistics

**Q1.** You have two vectors, a = [1, 2, 3] and b = [4, 5, 6]. What is their
dot product?

- A) 32
- B) 21
- C) 15
- D) 27

**Q2.** A fair coin is flipped 3 times. What is the probability of getting
exactly 2 heads?

- A) 1/4
- B) 1/2
- C) 1/8
- D) 3/8

---

### Round 2 -- Classical ML

**Q3.** In a classification task with 90% negative and 10% positive samples,
a model predicts everything as negative. What is its accuracy?

- A) 50%
- B) 90%
- C) 10%
- D) 0%

**Q4.** Which of the following is a hyperparameter of a Random Forest?

- A) The learned split thresholds
- B) The leaf node predictions
- C) The number of trees
- D) The Gini impurity at each node

---

### Round 3 -- Deep Learning

**Q5.** During backpropagation, what does the chain rule compute?

- A) The loss gradient for each trainable weight
- B) The best learning rate for the current optimizer
- C) The exact number of layers the network requires
- D) The batch size used for each training step

**Q6.** What problem do residual connections (skip connections) in ResNet
primarily address?

- A) Poor generalization on small training datasets
- B) Slow loading of batches from persistent storage
- C) High activation memory during model inference
- D) Weak gradient flow through very deep networks

---

### Round 4 -- NLP & Transformers

**Q7.** In the Transformer architecture, what does the attention mechanism
compute between?

- A) Pixels and labels
- B) Encoder and Decoder only
- C) Queries, Keys, and Values
- D) Embeddings and positions only

**Q8.** What is the main benefit of LoRA (Low-Rank Adaptation) when
fine-tuning a large language model?

- A) It retrains every base-model parameter from a completely fresh initialization
- B) It trains low-rank adapters while the base-model weights stay frozen
- C) It removes the need for labeled examples or task-specific training data
- D) It duplicates the model layers to increase its adaptation capacity

---

### Round 5 -- Applied AI

**Q9.** In a RAG (Retrieval-Augmented Generation) system, what happens before
the LLM generates an answer?

- A) Relevant documents are retrieved and added to the model prompt
- B) The whole model is fully retrained on the user's current question
- C) The user selects every context passage before each model request
- D) The model searches only its pretrained parameter values

**Q10.** In a multi-agent system, what is the primary purpose of a
"coordinator" or "orchestrator" agent?

- A) To replace every specialist agent with one general-purpose model
- B) To assign tasks, route messages, and coordinate the other agents
- C) To maximize token usage across every agent interaction
- D) To keep an identical backup model ready for system failures

---

## After All 5 Rounds

Display the area breakdown and total:

```text
Math & Statistics:    X/2
Classical ML:         X/2
Deep Learning:        X/2
NLP & Transformers:   X/2
Applied AI:           X/2
----------------------------
Total:                X/10
```

## Score-to-Entry-Point Mapping

| Total Score | Entry Point | What It Means |
|-------------|-------------|---------------|
| 0-3 | Phase 1: Math Foundations | Start from the ground up |
| 4-5 | Phase 3: Deep Learning Core | You have math and ML basics |
| 6-7 | Phase 7: Transformers Deep Dive | You know DL, time for transformers |
| 8-9 | Phase 11: LLM Engineering | Strong foundations, go straight to LLM apps |
| 10 | Phase 14: Agent Engineering | You know it all, build agents |

## Personalized Learning Path

After revealing the entry point, generate a markdown table covering all 20
phases. Use the score to determine the status of each phase. Phases below the
entry point get "Skip" (the learner already knows the material). Phases at or
above the entry point get "Do". If a learner scored 1/2 in an area that maps
to a skippable phase, mark that phase as "Review" instead of "Skip".

Area-to-phase mapping for review detection:
- Math & Statistics (1/2) -> mark Phase 1 as "Review"
- Classical ML (1/2) -> mark Phase 2 as "Review"
- Deep Learning (1/2) -> mark Phase 3 as "Review"
- NLP & Transformers (1/2) -> mark Phases 5 and 7 as "Review"
- Applied AI (1/2) -> mark Phase 14 as "Review"

Read the time estimates from ROADMAP.md (the canonical source of truth). Each
phase heading contains the estimated hours in the format `(~N hours)`. Parse
these values instead of using hardcoded numbers. This ensures the learning path
stays in sync with the roadmap as estimates are updated. If the repo is not
cloned locally, fetch it from
`https://raw.githubusercontent.com/rohitg00/ai-engineering-from-scratch/main/ROADMAP.md`.

## Output Format

Generate the table like this:

```markdown
| Phase | Name | Status | Est. Hours |
|-------|------|--------|------------|
| 0 | Setup & Tooling | Skip | -- |
| 1 | Math Foundations | Review | 30 |
| 2 | ML Fundamentals | Skip | -- |
| 3 | Deep Learning Core | Do | 20 |
| ... | ... | ... | ... |
```

Rules for the table:
- "Skip" phases show `--` for hours (they do not count toward the total)
- "Review" phases show full hours (the learner should skim them)
- "Do" phases show full hours
- Phase 0 (Setup & Tooling) is always "Skip" regardless of score (it is
  tooling setup, not knowledge)
- Sum the hours for "Review" and "Do" phases and show the total at the bottom

After the table, add one sentence with the estimated total: "Your personalized
path: ~X hours across Y phases."

Then add a brief recommendation: which phase to start with, and what to focus
on first based on their weakest area.

Finally, offer the next step: `/start-learning` saves this placement into a
persistent `LEARNING.md` study plan, and `/learn` starts the first lesson,
taught interactively.
