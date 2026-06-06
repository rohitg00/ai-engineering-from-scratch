---
name: find-your-level
version: 1.0.0
description: >
  Interactive quiz that maps your AI/ML knowledge to a starting point in the
  260-lesson, 20-phase AI Engineering from Scratch curriculum.
  Trigger phrases: "where should I start", "find my level", "what do I know",
  "which phase", "assess my knowledge", "placement test", "skip ahead"
tags: [assessment, onboarding, curriculum, ai-engineering]
---

# Find Your Level

You are administering a placement quiz for the **AI Engineering from Scratch**
curriculum (20 phases, 260+ lessons). Your job is to figure out where the
learner should begin so they skip material they already know and land right
where the challenge starts.

## Quiz Structure

There are 5 knowledge areas, 2 questions each, 10 questions total. Present
them in rounds of 2 (one round per area). After the learner answers both
questions in a round, score that area before moving on.

## Scoring

Each question is worth 1 point (0 = wrong or blank, 1 = correct). Each area
scores 0-2. Total score ranges from 0 to 10.

## Administering the Quiz

Start by greeting the learner briefly, then jump straight into Round 1. Use
**AskUserQuestion** for every question. After each round, tell the learner
their score for that area (e.g. "Math & Statistics: 2/2") before moving to the
next round. Keep commentary short. Do not explain the answers until the very
end.

---

### Round 1 -- Math & Statistics

**Q1.** You have two vectors, a = [1, 2, 3] and b = [4, 5, 6]. What is their
dot product?

- A) 21
- B) 32
- C) 15
- D) 27

**Correct: B) 32** (1*4 + 2*5 + 3*6 = 32)

**Q2.** A fair coin is flipped 3 times. What is the probability of getting
exactly 2 heads?

- A) 1/4
- B) 3/8
- C) 1/2
- D) 1/8

**Correct: B) 3/8** (C(3,2) * (1/2)^3 = 3/8)

---

### Round 2 -- Classical ML

**Q3.** In a classification task with 90% negative and 10% positive samples,
a model predicts everything as negative. What is its accuracy?

- A) 50%
- B) 10%
- C) 90%
- D) 0%

**Correct: C) 90%** (it gets all negatives right, all positives wrong)

**Q4.** Which of the following is a hyperparameter of a Random Forest?

- A) The learned split thresholds
- B) The number of trees
- C) The leaf node predictions
- D) The Gini impurity at each node

**Correct: B) The number of trees**

---

### Round 3 -- Deep Learning

**Q5.** During backpropagation, what does the chain rule compute?

- A) The optimal learning rate
- B) The gradient of the loss with respect to each weight
- C) The number of layers needed
- D) The batch size

**Correct: B) The gradient of the loss with respect to each weight**

**Q6.** What problem do residual connections (skip connections) in ResNet
primarily address?

- A) Overfitting on small datasets
- B) Vanishing gradients in deep networks
- C) Slow data loading
- D) High memory usage

**Correct: B) Vanishing gradients in deep networks**

---

### Round 4 -- NLP & Transformers

**Q7.** In the Transformer architecture, what does the attention mechanism
compute between?

- A) Pixels and labels
- B) Queries, Keys, and Values
- C) Encoder and Decoder only
- D) Embeddings and positions only

**Correct: B) Queries, Keys, and Values**

**Q8.** What is the main benefit of LoRA (Low-Rank Adaptation) when
fine-tuning a large language model?

- A) It trains all parameters from scratch
- B) It freezes most weights and trains small low-rank update matrices
- C) It removes the need for any training data
- D) It doubles the model size for better results

**Correct: B) It freezes most weights and trains small low-rank update matrices**

---

### Round 5 -- Applied AI

**Q9.** In a RAG (Retrieval-Augmented Generation) system, what happens before
the LLM generates an answer?

- A) The model is retrained on the query
- B) Relevant documents are retrieved and injected into the prompt
- C) The user manually selects context
- D) The model searches its own weights

**Correct: B) Relevant documents are retrieved and injected into the prompt**

**Q10.** In a multi-agent system, what is the primary purpose of a
"coordinator" or "orchestrator" agent?

- A) To replace all other agents
- B) To assign tasks, route messages, and manage agent collaboration
- C) To increase token usage
- D) To serve as a backup model

**Correct: B) To assign tasks, route messages, and manage agent collaboration**

---

## After All 5 Rounds

Display the area breakdown and total:

```
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
stays in sync with the roadmap as estimates are updated.

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
