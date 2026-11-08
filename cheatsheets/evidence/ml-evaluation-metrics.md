# Evidence: cheatsheets/ml-evaluation-metrics.md

Abbreviations: P2 = phases/02-ml-fundamentals. EV = P2/09-model-evaluation, BV = P2/10-bias-variance, HT = P2/12-hyperparameter-tuning, IM = P2/17-imbalanced-data. d = docs/en.md. EVc = EV/code/evaluation.py, BVc = BV/code/bias_variance.py, IMc = IM/code/imbalanced.py.

## Diagnose train and test error (troubleshooting)
- high train, high test: bias, more features, complex model, less regularization: BV/d:158
- low train, high test: variance, more data, regularization, simpler model: BV/d:159
- train decreasing, test increasing: early stopping: BV/d:161
- both flat and high, more data will NOT help, change model: BV/d:233, 235
- large gap still shrinking, collect more data: BV/d:232, 235
- 99% accuracy useless, use precision, recall, F1, AUPRC, MCC: EV/d:137, IM/d:13, 42
- scaler fit before split, preprocessing inside a Pipeline: EV/d:135, HT/d:523
- best value at search boundary, widen range: HT/d:527

## Split, tune, report (architecture)
- Full dataset: EV/d:29
- Train set 60-70%: EV/d:30
- Validation set 15-20%: EV/d:31
- Test set 15-20%, use once: EV/d:32, EV/d:47
- Fit model: EV/d:33
- Tune hyperparameters, select models: EV/d:35, EV/d:46
- Final model: EV/d:37
- Report performance: EV/d:38

## Metric formulas (concepts)
- accuracy, misleading when imbalanced: EV/d:103
- precision, false positives costly: EV/d:104
- recall, false negatives costly: EV/d:105
- F1 harmonic mean: EV/d:106
- F-beta, beta > 1 recall, F2 fraud: IM/d:52
- MCC, -1 to +1: IM/d:56
- AUC-ROC 0.5 random, 1.0 perfect: EV/d:107
- AUPRC random equals positive class rate: IM/d:54
- RMSE same units, MAE robust: EV/d:112-113
- Bias^2 + Variance + noise: BV/d:61-65

## Fix a model step by step (flow)
1. train, compute train and test error: BV/d:425
2. both high, bias, skip to step 4: BV/d:426
3. train low test high, variance, learning curve, regularize: BV/d:427
4. validation curve, sweet spot: BV/d:428
5. learning curve at sweet spot, gap: BV/d:429
6. Ridge/Lasso alpha with cross_val_score, lowest CV error: BV/d:430

## Cross-validate and tune (annotated-code)
- cross_val_score with StratifiedKFold(5), scoring="f1": EV/d:645
- param_dist loguniform(1e-4, 0.5), randint(2, 10), randint(50, 500): HT/d:499-503
- log scale for learning rate: HT/d:519
- RandomizedSearchCV, n_iter=100, cv=5, neg_mean_squared_error, n_jobs=-1: HT/d:505-513
- search.fit, search.best_params_: HT/d:514-515
- outer_scores = cross_val_score(inner_cv, X, y, cv=5, ...): HT/d:216-217

## Search strategies (command-table)
- grid search, exponential: HT/d:40
- random search, more unique values per budget: HT/d:59
- Bayesian, surrogate + acquisition, 2-5x fewer evaluations: HT/d:98-108
- Hyperband 10-50x faster: HT/d:117-119
- MedianPruner, median of completed trials at same step: HT/d:489
- GridSearchCV: HT/d:493
- RandomizedSearchCV, n_jobs=-1 all cores: HT/d:493, 519
- trial.suggest_float, log=True: HT/d:429, 451

## Pick an imbalance fix (defaults)
- < 70/30 mild, class weights first: IM/d:197
- 70/30 to 95/5 moderate, SMOTE + class weights: IM/d:198, SMOTE + threshold tuning: IM/d:66
- > 95/5 severe, combine multiple strategies: IM/d:199, 67
- < 1000 samples, oversample or SMOTE, avoid undersampling: IM/d:203
- 1000-10000, SMOTE + threshold tuning: IM/d:204
- > 10000, undersampling OK, or class weights: IM/d:205

## Numbers to know (defaults)
- K = 5 or 10: EV/d:88
- threshold 0.5, optimal lower when imbalanced: IM/d:159
- 60 random trials, 95% within 5%: HT/d:81
- Hyperband 81 configs, 1 epoch, top third: HT/d:119
- 675 fits, 5 x 5 x 27: HT/d:223
- n_bootstrap=200: BVc:36, BV/d:297
- SMOTE k=5, n_synthetic=100: IMc:29
- positive weight 10.0 for 1000 samples with 50 positive: IM/d:141-143

## Questions (qa)
- stratified preserves class distribution: EV/d:90
- test set single use: EV/d:47, 143
- only 1-2 of 6 matter: HT/d:78
- bagging high variance, boosting high bias: BV/d:195
- weights equal oversampling in expectation: IM/d:155
- interpolation threshold p ~ n worst: BV/d:136, 139
- nested CV or untouched test set: HT/d:525

## Tips (tips)
- split first, then preprocess: EV/d:135
- learning rate first, log scale: HT/d:227-229
- early stopping instead of n_estimators: HT/d:231
- 60% budget on top 2: HT/d:233
- defaults, coarse 20-50, fine 50-100: HT/d:167-170
- sweep thresholds 0.0 to 1.0, pick best F1: IM/d:163-166

## From-scratch functions (task-table)
- stratified_kfold_split(y, k=5, seed=42): EVc:46
- auc_roc(y_true, y_scores): EVc:151
- smote(X_minority, k=5, n_synthetic=100, seed=42): IMc:29
- compute_class_weights(y): IMc:114
- find_optimal_threshold(y_true, y_probs, metric="f1"): IMc:158
