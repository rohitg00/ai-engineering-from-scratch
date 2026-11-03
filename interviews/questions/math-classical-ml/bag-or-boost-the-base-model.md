---
id: bag-or-boost-the-base-model
title: Bag the deep trees or boost the stumps
card: math-classical-ml
kind: tradeoff
level: 3
roles: [ai-data-engineer, ai-evaluation-reliability-engineer, applied-ai-engineer]
rounds: [ml-depth, system-design]
tags: [ensembles, bagging, boosting, bias-variance, random-forest]
minutes: 12
lessons: [phases/02-ml-fundamentals/11-ensemble-methods, phases/02-ml-fundamentals/10-bias-variance, phases/02-ml-fundamentals/04-decision-trees]
manuals: []
practice: [lab-bias-variance]
cheatsheet: [ml-model-comparison]
related: [math-classical-ml/mdi-ranks-noise-feature, math-classical-ml/past-the-interpolation-threshold]
updated: 2026-11-03
---

You have a tabular dataset and two candidate base learners: deep decision trees that fit the training rows almost perfectly, and decision stumps that barely beat a constant. You can afford one ensemble method for each. Which one gets bagging and which one gets boosting, and why?

## Short answer

Bag the deep trees and boost the stumps. Deep trees have low bias and high variance, and averaging many of them trained on bootstrap samples cancels the variance without adding bias. Stumps have high bias and low variance, and boosting builds them in sequence so each new one corrects the errors of the ensemble so far, which drives the bias down.

## Full answer

### Match the method to the error term

Expected error splits into squared bias, variance and irreducible noise. The two methods attack different terms.

| Method | Reduces | Bias | Variance | Watch out for |
|---|---|---|---|---|
| Bagging, random forest | variance | no change | decreases | does nothing for bias |
| Boosting | bias | decreases | can increase | overfits with too many rounds |

### Why bagging fits the deep trees

Each tree is trained on a bootstrap sample, a draw with replacement of the same size as the data, which holds about 63.2 percent of the unique rows. The rest, about 36.8 percent, are out-of-bag and give a free validation set. The average of N independent predictions with variance sigma squared has variance sigma squared over N. The trees are not independent, because they see similar data, so the gain is smaller than that, and a random forest adds a random feature subset at each split, square root of the feature count for classification, to make the trees disagree more. Adding trees lowers variance and never adds bias, so test accuracy plateaus and does not fall.

### Why boosting fits the stumps

Boosting trains learners in sequence. AdaBoost raises the weight of rows the ensemble gets wrong, so the next stump works on them. Gradient boosting fits each new tree to the negative gradient of the loss, which for squared error is the residual. Each round removes some of the systematic error, which is the bias. The learning rate scales each tree's contribution; the lesson gives 0.01 to 0.3, and a smaller value needs more trees and generalizes better. Because later rounds chase the hardest rows, boosting can fit noise, so it needs early stopping on a validation loss.

### Why not the other way round

Boosting the deep trees has little bias left to remove and stacks high variance learners, so it overfits fast. Bagging the stumps averages many models that all miss the same pattern, so the average misses it too. Diversity is the requirement in both cases: the lesson's majority vote of 21 independent classifiers at 60 percent accuracy reaches about 74 percent, and 101 of them reach about 84 percent, only because their errors differ.

## Follow-ups

- **Level 3:** Why does bagging the deep trees not fix bias? Expected: the average of many models that miss the same pattern misses it too; averaging only removes their disagreement.
- **Level 3:** What does the learning rate do in gradient boosting? Expected: it scales each tree's contribution; a smaller rate needs more trees and generalizes better.
- **Level 4:** Boosting's training error keeps falling while validation error rises. What happened and what do you do? Expected: later rounds fit noisy or mislabeled rows; stop early on the validation loss, or lower the learning rate and the tree depth.
- **Level 4:** Why does a forest's test accuracy plateau but not fall as trees are added? Expected: each tree lowers variance and none adds bias, so more trees cannot overfit the way more boosting rounds can.

## Wrong answers

- "Boost the deep trees, since boosting is the stronger method." A low bias, high variance learner has little bias to remove, and boosting amplifies its variance.
- "Bag the stumps to make them strong." Averaging stumps that all underfit still underfits; bagging leaves bias where it is.
- "Any ensemble of enough models beats a single one." Gains need diverse errors; models that make the same mistakes do not cancel them.

## Taught in

The [ensemble methods lesson](../../../phases/02-ml-fundamentals/11-ensemble-methods/) builds both methods, the [bias-variance lesson](../../../phases/02-ml-fundamentals/10-bias-variance/) gives the rule for which to use, and the [decision trees lesson](../../../phases/02-ml-fundamentals/04-decision-trees/) builds the forest.
