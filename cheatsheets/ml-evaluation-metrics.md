---
id: ml-evaluation-metrics
title: Model Evaluation, Bias-Variance and Tuning
code: ME
subtitle: Splits and cross-validation, metric formulas, bias-variance diagnosis, search strategies and imbalanced classes.
hue: 210
sources: phases/02-ml-fundamentals/09-model-evaluation, phases/02-ml-fundamentals/10-bias-variance, phases/02-ml-fundamentals/12-hyperparameter-tuning, phases/02-ml-fundamentals/17-imbalanced-data
source_hash: cea3e6a1e5fa41e7
---

## Diagnose train and test error
type: troubleshooting
from: phases/02-ml-fundamentals/10-bias-variance/docs/en.md, phases/02-ml-fundamentals/09-model-evaluation/docs/en.md, phases/02-ml-fundamentals/12-hyperparameter-tuning/docs/en.md, phases/02-ml-fundamentals/17-imbalanced-data/docs/en.md

| Symptom | Cause | Fix |
|---|---|---|
| High train error, high test error | High bias | More features, complex model, less regularization |
| Low train error, high test error | High variance | More data, regularization, simpler model |
| Train error falls, test error rises | Overfitting in progress | Early stopping |
| Both curves flat and high | Bias. More data will not help | Change the model |
| Large gap, validation still falling | Variance that data can fix | Collect more data |
| 99% accuracy, zero positives caught | Class imbalance | F1, AUPRC or MCC |
| Validation score too optimistic | Scaler fit before the split | Preprocess inside a `Pipeline` |
| Best value at the search edge | Range too narrow | Widen the search space |

## Split, tune, report
type: architecture
from: phases/02-ml-fundamentals/09-model-evaluation/docs/en.md

```arch
node | data | 1,2 | Full dataset |
node | train | 2,1 | Train set | 60-70%
node | val | 2,2 | Validation set | 15-20%
node | test | 2,3 | Test set | 15-20%, use once
node | fit | 3,1 | Fit model |
node | tune | 3,2 | Tune hyperparameters | select models
node | final | 4,2 | Final model |
node | report | 4,3 | Report performance |
edge | data | train |
edge | data | val |
edge | data | test |
edge | train | fit |
edge | fit | tune | validate
edge | tune | final |
edge | final | report |
edge | test | report |
```

## Metric formulas
type: concepts
from: phases/02-ml-fundamentals/09-model-evaluation/docs/en.md, phases/02-ml-fundamentals/17-imbalanced-data/docs/en.md, phases/02-ml-fundamentals/10-bias-variance/docs/en.md

- **Accuracy**: $(TP + TN) / (TP + TN + FP + FN)$. Misleading with imbalanced classes.
- **Precision**: $TP / (TP + FP)$. Use it when false positives are costly.
- **Recall**: $TP / (TP + FN)$. Use it when false negatives are costly.
- **F1**: $2PR / (P + R)$, the harmonic mean of precision and recall.
- **F-beta**: $(1+\beta^2) P R / (\beta^2 P + R)$. $\beta > 1$ weights recall. F2 is common for fraud.
- **MCC**: $(TP \cdot TN - FP \cdot FN) / \sqrt{\ldots}$. It goes from -1 to +1.
- **AUC-ROC**: 0.5 is random guessing, 1.0 is perfect separation.
- **AUPRC**: a random model scores the positive class rate.
- **RMSE and MAE**: RMSE is $\sqrt{\text{MSE}}$ in target units. MAE is robust to outliers.
- **Decomposition**: expected error $= \text{Bias}^2 + \text{Variance} + \sigma^2$.

## Fix a model step by step
type: flow
from: phases/02-ml-fundamentals/10-bias-variance/docs/en.md

1. **Train**: compute the train error and the test error.
2. **Both high**: a bias problem. Go to step 4.
3. **Train low, test high**: a variance problem. Plot a learning curve. Regularize if data does not help.
4. **Validation curve**: sweep the main complexity knob. Find the sweet spot.
5. **Learning curve**: plot it at the sweet spot. A large gap needs data or regularization.
6. **Alpha sweep**: try Ridge or Lasso alphas with `cross_val_score`. Keep the lowest CV error.

## Cross-validate and tune
type: annotated-code
lang: python
from: phases/02-ml-fundamentals/09-model-evaluation/docs/en.md, phases/02-ml-fundamentals/12-hyperparameter-tuning/docs/en.md

```python
scores = cross_val_score(model, X, y, cv=StratifiedKFold(5), scoring="f1")
param_dist = {
    "learning_rate": loguniform(1e-4, 0.5),      # log scale
    "max_depth": randint(2, 10),
    "n_estimators": randint(50, 500),
}
search = RandomizedSearchCV(GradientBoostingRegressor(), param_dist,
    n_iter=100, cv=5, scoring="neg_mean_squared_error", n_jobs=-1)
search.fit(X_train, y_train)
search.best_params_                               # best settings
outer_scores = cross_val_score(inner_cv, X, y, cv=5, scoring="neg_mean_squared_error")
```

## Search strategies
type: command-table
from: phases/02-ml-fundamentals/12-hyperparameter-tuning/docs/en.md

| Command | What it does |
|---|---|
| Grid search | Every combination. Cost grows exponentially |
| Random search | Samples distributions. More unique values per budget |
| Bayesian optimization | Surrogate plus acquisition. 2-5x fewer evaluations |
| Hyperband | Many configs on small budgets. 10-50x faster |
| `MedianPruner` | Stops a trial worse than the median at that step |
| `GridSearchCV` | Exhaustive grid with cross-validation |
| `RandomizedSearchCV` | Random search with CV. `n_jobs=-1` uses all cores |
| `trial.suggest_float` | Optuna sample. Add `log=True` for lr |

## Pick an imbalance fix
type: defaults
from: phases/02-ml-fundamentals/17-imbalanced-data/docs/en.md

| Setting | Default | Note |
|---|---|---|
| Mild, under 70/30 | class weights | Try them first |
| Moderate, 70/30 to 95/5 | SMOTE + class weights | Or SMOTE with threshold tuning |
| Severe, over 95/5 | combine multiple strategies | SMOTE, class weights and threshold |
| Under 1000 samples | Oversample or SMOTE, avoid undersampling | Small data |
| 1000-10000 samples | SMOTE + threshold tuning | Medium data |
| Over 10000 samples | Undersampling OK, or class weights | Large data |

## Numbers to know
type: defaults
from: phases/02-ml-fundamentals/09-model-evaluation/docs/en.md, phases/02-ml-fundamentals/12-hyperparameter-tuning/docs/en.md, phases/02-ml-fundamentals/17-imbalanced-data/docs/en.md, phases/02-ml-fundamentals/10-bias-variance/code/bias_variance.py, phases/02-ml-fundamentals/17-imbalanced-data/code/imbalanced.py

| Setting | Default | Note |
|---|---|---|
| K folds | 5 | Or 10 |
| Decision threshold | 0.5 | Lower it for rare positives |
| Random search trials | 60 | 95% chance to land within 5% of the optimum |
| Hyperband start | 81 | Configs at 1 epoch. Keep the top third |
| Nested CV fits | 675 | 5 outer x 5 inner x 27 grid points |
| Bootstrap fits | 200 | `n_bootstrap=200` in the decomposition |
| SMOTE `k` | 5 | `n_synthetic=100` |
| Positive class weight | 10.0 | 1000 samples, 50 positive |

## Questions
type: qa
from: phases/02-ml-fundamentals/09-model-evaluation/docs/en.md, phases/02-ml-fundamentals/10-bias-variance/docs/en.md, phases/02-ml-fundamentals/12-hyperparameter-tuning/docs/en.md, phases/02-ml-fundamentals/17-imbalanced-data/docs/en.md

- **Why stratified folds?** Each fold keeps the class ratio of the full dataset.
- **Why use the test set once?** Each look and adjust turns it into a second validation set.
- **Why random over grid?** Only 1-2 of 6 hyperparameters usually matter.
- **Bagging or boosting?** Bagging for high variance. Boosting for high bias.
- **Class weights or oversampling?** Weights equal oversampling in expectation, with no duplicates.
- **Where is the worst capacity?** At the interpolation threshold, where parameters are near samples.
- **How do I report a final score?** Use nested CV or a test set you never touch while tuning.

## Tips
type: tips
from: phases/02-ml-fundamentals/09-model-evaluation/docs/en.md, phases/02-ml-fundamentals/12-hyperparameter-tuning/docs/en.md, phases/02-ml-fundamentals/17-imbalanced-data/docs/en.md

- Split first, then preprocess.
- Tune the learning rate first. Search it on a log scale.
- Use early stopping in place of tuning `n_estimators`.
- Spend 60% of the tuning budget on the top 2 hyperparameters.
- Start with library defaults. Coarse search 20-50 trials, then fine search 50-100.
- Sweep thresholds from 0.0 to 1.0 on validation data. Keep the best F1.

## From-scratch functions
type: task-table
from: phases/02-ml-fundamentals/09-model-evaluation/code/evaluation.py, phases/02-ml-fundamentals/17-imbalanced-data/code/imbalanced.py

| Task | Code |
|---|---|
| Stratified folds | `stratified_kfold_split(y, k=5, seed=42)` |
| ROC area | `auc_roc(y_true, y_scores)` |
| Synthetic minority rows | `smote(X_minority, k=5, n_synthetic=100)` |
| Balanced class weights | `compute_class_weights(y)` |
| Best cutoff by F1 | `find_optimal_threshold(y_true, y_probs)` |
