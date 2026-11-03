---
id: mdi-ranks-noise-feature
title: A forest that ranks a user id as its top feature
card: math-classical-ml
kind: debug
level: 3
roles: [ai-data-engineer, ai-evaluation-reliability-engineer, applied-ai-engineer]
rounds: [debugging, ml-depth]
tags: [random-forest, feature-importance, permutation-importance, leakage]
minutes: 12
lessons: [phases/02-ml-fundamentals/04-decision-trees]
manuals: []
practice: [gini-best-split]
cheatsheet: [classical-ml]
related: [math-classical-ml/gini-for-a-mixed-node, math-classical-ml/bag-or-boost-the-base-model]
updated: 2026-11-03
---

A random forest's feature importance puts a user id column near the top of the list. The column is an integer with a different value in almost every row. The team wants to build a product rule around it. What do you tell them, and how do you check?

## Short answer

The default importance is the mean decrease in impurity, summed over every split that used the feature. A column that is distinct on nearly every row offers a huge number of candidate thresholds, so trees split on it to carve out small pure groups by chance, and those impurity drops add up on the training data. Run a permutation importance check instead: shuffle the column on held-out data, measure the drop in accuracy, and expect close to zero for an id.

## Full answer

### What the default number measures

```text
importance(feature) = sum over nodes that split on it of
                      (samples at node / total samples) * impurity decrease
```

The number is a by-product of training, so it costs nothing, and it is biased in two ways the lesson names: toward features with many distinct values, and toward features with many possible split points. An id column is the extreme case of both. Each tree can find a threshold that isolates a handful of rows with the same label, the gain looks real on the bootstrap sample, and nothing in the formula asks whether it transfers.

### The check that does ask

The permutation method shuffles one feature's values on data the model did not train on and measures how much the score drops. A feature the model needs produces a large drop. A feature that only absorbed training noise produces none. It costs one evaluation per feature per repeat, which is slower than the default, but it answers the question the team is asking. The lesson sets this exact case as an exercise: a high cardinality noise feature that the impurity method ranks high and the permutation method does not.

### What to tell the team

1. The ranking they saw does not mean the id predicts anything.
2. Run the permutation check on a validation set with several shuffles and average.
3. Retrain without the id and compare validation scores. If the score holds, the id carried nothing.
4. If the permutation check also scores the id high, treat it as leakage: ids that correlate with the target through time or data source will not hold in production, and no product rule should rest on them.

## Follow-ups

- **Level 3:** Why do many distinct values make it easy for a tree to find a good-looking split? Expected: more thresholds mean more chances that one of them separates a few rows by luck; the gain is real on the training sample and absent on new data.
- **Level 3:** Permutation importance for the id is near zero and the validation score is fine. What does that say? Expected: the id carried no signal the model depends on; it absorbed training noise, and the other features do the work.
- **Level 4:** The permutation importance of the id is large as well. What now? Expected: suspect leakage; the id tracks the target through time or source, and that link breaks in production.
- **Level 4:** How do you compute permutation importance so it is not optimistic? Expected: on held-out data, shuffle only the one column, repeat several times and average, and keep every other column fixed.

## Wrong answers

- "The forest found the id useful, so it is useful." The impurity sum counts splits that fit training noise; a column with many distinct values collects them.
- "Drop every integer column to be safe." Integers such as counts carry real signal. Test the one column with a permutation.
- "The two importance methods always agree." The lesson's exercise builds a case where the impurity method ranks a noise feature highly and the permutation method does not.

## Taught in

The [decision trees lesson](../../../phases/02-ml-fundamentals/04-decision-trees/) defines both importance measures and names the bias of the impurity method.
