---
id: read-the-three-aggregators
title: Read the vote aggregators and find the blind spot
card: multi-agent
kind: code-reading
level: 3
roles: [agentic-ai-engineer, ai-evaluation-reliability-engineer]
rounds: [coding, debugging]
tags: [consensus, plurality, semantic-clustering, code-reading, monoculture]
minutes: 12
lessons: [phases/16-multi-agent-and-swarms/14-consensus-and-bft, phases/16-multi-agent-and-swarms/13-shared-memory-blackboard]
manuals: []
practice: []
cheatsheet: [multi-agent]
related: [multi-agent/three-copies-of-one-model-voted]
updated: 2026-11-03
---

Read the clustering and the plurality aggregator from the consensus lesson. Five agents vote on a percentage from a study. Three agents that share a base model answer `42%`, and two agents answer `4.2%`. Each of the two is more confident than any of the three, but the three still carry more confidence in total. Say what the plurality returns, what the aggregator that weighs each vote by its confidence returns, and what the canonicalization does with the answer `4.2 percent`.

```python
@dataclass
class Vote:
    agent: str
    answer: str
    confidence: float

    def canonical(self) -> str:
        return "".join(c for c in self.answer.lower().strip() if c.isalnum() or c == "." or c == "%")


def plurality(votes: list[Vote]) -> tuple[str, dict[str, int]]:
    counts: dict[str, int] = {}
    rep: dict[str, str] = {}
    for v in votes:
        key = v.canonical()
        counts[key] = counts.get(key, 0) + 1
        rep.setdefault(key, v.answer)
    winner_key = max(counts, key=counts.get)
    return rep[winner_key], counts
```

## Short answer

Plurality counts three votes for `42%` and two for `4.2%` and returns the wrong answer, because it counts heads and the wrong cluster has more heads. The confidence-weighted aggregator sums confidence per cluster and compares the top cluster's share with a threshold. The wrong cluster has the larger sum, so with a threshold of 0.5 it also returns `42%`, and with a higher threshold it can return no winner. The canonicalization keeps letters, digits, dots and percent signs, so `4.2 percent` becomes `4.2percent` and lands in a different cluster from `4.2%`, which splits the right answer's votes.

## Full answer

### What the code does

`canonical` lowercases the answer, strips the ends, and keeps alphanumerics, the dot and the percent sign. It is the lesson's rough semantic clustering. `plurality` builds a count per canonical key, keeps the first original answer per key as its representative, and returns the key with the most votes.

### The monoculture case

| Aggregator | Rule | Result here |
|---|---|---|
| Plurality | Most votes | Wrong, because three correlated votes beat two |
| Confidence-weighted | Sum of confidence per cluster, top cluster must pass a threshold share | Wrong, because the three votes carry more total confidence, or none when the share is under the threshold |
| Geometric-median style | Score each cluster by its size and how tight its confidences are | Wrong, because the cluster of three is larger and its confidences are also tight |

The lesson's own takeaway is the limit: no aggregator solves a wrong cluster that is both larger and more confident than the right one. That case needs diversity of models or verification, not a better vote.

### The canonicalization blind spot

Two agents that mean the same value can land in two clusters. `4.2%` and `4.2 percent` differ after canonicalization, and so would `four point two percent`. Every split in the right cluster helps the wrong one. In production, canonicalize numbers with their units into one form, or cluster by embedding similarity, and keep the canonical key next to the original answer in the log so a reviewer can see when a split happened.

### Where the two percentages come from

The values in the scenario are the memory-poisoning numbers from the shared-memory lesson: a page says 4.2 percent and a retrieval agent writes 42 percent. The consensus lesson reuses them so that the vote is over a claim with a known source, which is also what makes a verifier possible after the vote.

### What the plurality code cannot see

It has no idea which agents share a base model, no confidence, no source. It returns the answer with the most votes and does not check whether the voters are independent or accurate. Independence makes a right majority more likely but does not guarantee it, and the prompt's three agents share a base model, so their errors are correlated.

## Follow-ups

- **Level 3:** Why does `plurality` keep `rep`? Expected: so that it can return the original answer text for the winning key, since the canonical key is a comparison form and not an answer to show.
- **Level 3:** No cluster reaches the threshold share in the weighted vote. What is the result? Expected: no winner, with the weights, so the caller retries or escalates instead of accepting a weak majority.
- **Level 4:** The sycophancy case: two agents copy the first answer they saw with low confidence. Which aggregator catches it and why? Expected: the confidence-weighted one, because the copiers carry little weight, while plurality counts them as full votes.
- **Level 4:** How would you test a replacement for `canonical`? Expected: a table of answer pairs that must cluster together and pairs that must not, including unit variants and spelled-out numbers, run as a unit test.

## Wrong answers

- "Plurality is fine as long as there are at least five agents." Three agents on one model are a majority at any size as long as they are over half, and the count never sees the correlation.
- "The canonicalization is good enough because it handles case and spaces." It splits `4.2%` from `4.2 percent`, and every split in the right cluster is a vote for the wrong one.
- "Higher confidence means a more correct answer, so weight by it and you are done." Weighting helps against low-confidence conformity and does nothing when the wrong cluster is also the confident one.

## Taught in

The [consensus and fault tolerance lesson](../../../phases/16-multi-agent-and-swarms/14-consensus-and-bft/) ships these aggregators, and the [shared memory lesson](../../../phases/16-multi-agent-and-swarms/13-shared-memory-blackboard/) is the source of both percentages.
