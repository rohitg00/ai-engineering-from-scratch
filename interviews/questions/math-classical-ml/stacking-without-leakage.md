---
id: stacking-without-leakage
title: Build a stacking ensemble whose meta-learner never cheats
card: math-classical-ml
kind: take-home
level: 4
roles: [ai-data-engineer, ai-evaluation-reliability-engineer, applied-ai-engineer]
rounds: [take-home, system-design]
tags: [ensembles, stacking, cross-validation, leakage, meta-learner]
minutes: 25
lessons: [phases/02-ml-fundamentals/11-ensemble-methods, phases/02-ml-fundamentals/09-model-evaluation]
manuals: []
practice: []
cheatsheet: [ml-model-comparison]
related: [math-classical-ml/bag-or-boost-the-base-model, math-classical-ml/scaler-fit-before-split]
updated: 2026-11-03
---

Take-home. Build a stacking ensemble on a tabular classification dataset with three base models from different families and a logistic regression meta-learner. Deliver the training code, a comparison with each base model alone, and a written argument that the meta-learner was never trained on a prediction made for a row the base model had already seen. Describe how you structure the work and what you check before you submit.

## Short answer

Generate the meta-features with k-fold cross-validation: for each fold, fit the base models on the other folds and predict the held-out fold, so every training row gets base predictions from models that did not train on it. Fit the meta-learner on those out-of-fold predictions, then refit the base models on all training rows for test time. Compare on a test set that neither level touched, and report the base models and the stack side by side with fold spreads.

## Full answer

### Structure

1. **Split first.** Hold out a test set before anything else. Do all preprocessing inside the folds, fit on the training part of each fold only.
2. **Out-of-fold predictions.** With K folds, train each base model K times. Each row in the training set receives a prediction from the one run that did not see it. Store the predicted probabilities, not hard labels, because soft outputs carry confidence and the lesson's soft voting beats hard voting for the same reason.
3. **Meta-learner.** Fit the logistic regression on the out-of-fold probabilities, three columns per class, with the true labels as targets. It learns which base model to trust and where.
4. **Refit for test time.** Fit each base model on all training rows, predict the test set, and pass those predictions through the meta-learner.
5. **Compare.** Score every base model on its own, a plain average of the three, and the stack. Report cross-validated means and spreads on the training folds, and one test number for each at the end.

### The leakage argument

Write it as a table: for each training row, which fold it belonged to, and which base model run produced its meta-feature. Every meta-feature must come from a run whose training folds exclude that row. If any base model is fit on all training rows and then predicts those rows, the predictions are in-sample and too good, and the meta-learner learns to trust the base model that overfits most. The lesson states the rule in one line: never train base models and generate meta-features on the same data.

### Checks before you submit

- Diversity: compare the base models' errors on the validation folds. Three variants of one family fail on the same rows and give the stack nothing. The lesson's example uses a forest, a support vector machine and a linear classifier.
- Honest gain: the stack must beat the best base model by more than the fold spread. The lesson places stacking in the last 1 to 2 percent of accuracy, so a small or noisy gain is the expected outcome, and the write-up should say whether the extra models are worth it.
- Preprocessing inside the folds, no transform fit on the full table.
- The test set appears once, in the final table.

## Follow-ups

- **Level 3:** Why soft predictions rather than hard labels as meta-features? Expected: probabilities carry confidence, so the meta-learner can weight a sure base model above an unsure one.
- **Level 4:** The stack beats every base model on the training folds but not on the test set. What is the first check? Expected: whether any meta-feature came from a base model that had seen that row; an in-sample prediction teaches the meta-learner to trust an overfit model.
- **Level 4:** How do you show the base models are diverse enough to help? Expected: compare their errors on the validation folds; models that fail on the same rows add nothing.
- **Level 4:** When would you not ship the stack? Expected: when the gain over the best base model is inside the fold spread, or below the cost of running three models.

## Wrong answers

- "Fit the base models on all training rows, predict those rows, and train the meta-learner on that." Those predictions are in-sample and too good; the meta-learner learns to trust the base model that overfits most.
- "Use three random forests with different seeds." Same family, similar errors; the stack needs models that fail on different rows.
- "Set the meta-learner's weights by hand." The point of stacking is to learn which base model to trust where; fixed weights are a voting ensemble.

## Taught in

The [ensemble methods lesson](../../../phases/02-ml-fundamentals/11-ensemble-methods/) describes stacking and its leakage rule, and the [model evaluation lesson](../../../phases/02-ml-fundamentals/09-model-evaluation/) builds the folds behind the meta-features.
