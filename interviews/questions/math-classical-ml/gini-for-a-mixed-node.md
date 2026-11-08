---
id: gini-for-a-mixed-node
title: Score a tree node with Gini and with entropy
card: math-classical-ml
kind: estimate
level: 2
roles: [ai-data-engineer, ai-evaluation-reliability-engineer]
rounds: [screen, ml-breadth]
tags: [decision-trees, gini, entropy, information-gain]
minutes: 8
lessons: [phases/02-ml-fundamentals/04-decision-trees, phases/01-math-foundations/09-information-theory]
manuals: []
practice: [gini-best-split]
cheatsheet: [classical-ml]
related: [math-classical-ml/mdi-ranks-noise-feature, math-classical-ml/bag-or-boost-the-base-model]
updated: 2026-11-03
---

A node in a classification tree holds 6 cats and 4 dogs. Give its Gini impurity and its entropy in bits, and explain how a tree uses either number to choose a split.

## Short answer

The class shares are 0.6 and 0.4. Gini is 1 minus the sum of squared shares, so 1 minus 0.36 minus 0.16, which is 0.48. Entropy is minus the sum of share times log base 2 of share, which comes to 0.971 bits. The tree tries every feature and threshold and keeps the split with the largest drop from the parent's impurity to the weighted impurity of the two children.

## Full answer

### The two numbers

```text
Gini    = 1 - (0.6^2 + 0.4^2) = 1 - (0.36 + 0.16) = 0.48
Entropy = -(0.6 * log2(0.6) + 0.4 * log2(0.4))
        = -(0.6 * -0.737 + 0.4 * -1.322)
        = 0.442 + 0.529 = 0.971 bits
```

Gini is the chance that a random sample at the node is labeled wrong when you label it by the node's class distribution. Entropy is the average surprise of the labels at the node. Both are 0 for a pure node. For a two class node with equal shares, Gini is 0.5 and entropy is 1.0 bit.

### How the tree uses them

The information gain of a split is the parent's impurity minus the weighted average of the children's impurity, where each child is weighted by its share of the samples. The algorithm is greedy: at each node it sorts each feature, tries every midpoint between distinct values as a threshold, and keeps the pair with the highest gain. Then it recurses into both children. Greedy splitting does not find the best tree, because that problem is NP-hard, but it works well in practice.

### Gini or entropy

On most data the two criteria pick the same splits and give trees of about the same depth. Gini has no logarithm, so it is a little cheaper to compute. Entropy connects the split to information theory: the split that minimizes the conditional entropy of the label given the feature is the split that removes the most uncertainty.

## Follow-ups

- **Level 2:** What is the gain of a split that puts all the cats on one side and all the dogs on the other? Expected: the children are pure, so their impurity is 0 and the gain equals the parent's impurity, 0.48 for Gini.
- **Level 2:** Why weight the children by their sample share? Expected: a pure child with one sample should not count as much as a mixed child with the rest of the data.
- **Level 3:** How does the tree turn a continuous feature into candidate thresholds? Expected: sort the values and try the midpoint between each pair of distinct neighbors.
- **Level 3:** What stops the recursion before every leaf holds one sample? Expected: pre-pruning limits such as a maximum depth, a minimum number of samples per leaf, or a minimum gain, or post-pruning after the full tree is grown.

## Wrong answers

- "Gini is 0.6 times 0.4." That product is half of the two class Gini. The formula is 1 minus the sum of squared shares, which gives 0.48 here.
- "Entropy of a 6 to 4 node is 1 bit because there are two classes." One bit is the maximum, reached only at equal shares. Unequal shares give less, 0.971 bits here.
- "Pick the split with the lowest child impurity, and the parent does not matter." The parent's impurity is the same for every candidate split at that node, so the ranking is the same, but the gain is what the tree stores and reports as feature importance.

## Taught in

The [decision trees lesson](../../../phases/02-ml-fundamentals/04-decision-trees/) computes both criteria for this node, and the [information theory lesson](../../../phases/01-math-foundations/09-information-theory/) defines entropy and conditional entropy.
