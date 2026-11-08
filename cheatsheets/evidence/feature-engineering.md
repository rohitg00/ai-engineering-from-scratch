# Evidence: cheatsheets/feature-engineering.md

Abbreviations: P2 = phases/02-ml-fundamentals. L08 = P2/08-feature-engineering, L11 = P2/11-ensemble-methods, L13 = P2/13-ml-pipelines, L18 = P2/18-feature-selection. d = docs/en.md. FE = L08/code/features.py, EN = L11/code/ensembles.py, PL = L13/code/pipeline.py, FS = L18/code/feature_selection.py.

## One pipeline for mixed columns (architecture, 6 nodes, 6 edges)
- Training data, fit only on training data: L13/d:41, 66-70
- numeric_pipe, median impute and scale: L13/d:112-115
- categorical_pipe, most_frequent impute and one-hot: L13/d:117-120
- ColumnTransformer, preprocess step: L13/d:122-128
- Model GradientBoostingClassifier: L13/d:129
- Prediction, transform then predict: L13/d:97-99

## Build it in sklearn (annotated-code, 14 lines)
- numeric_pipe with SimpleImputer(strategy="median") and StandardScaler(): L13/d:112-115
- categorical_pipe with SimpleImputer(strategy="most_frequent") and OneHotEncoder(handle_unknown="ignore"): L13/d:117-120
- unseen city gives a zero vector: L13/d:133
- preprocessor ColumnTransformer with num and cat columns: L13/d:122-125
- full_pipeline with preprocess and GradientBoostingClassifier(): L13/d:127-130

## What fit and predict do (flow, 6 steps)
1. split before fit, X_train, X_test = X[:800], X[800:]: L13/d:64-71
2. scaler calls fit_transform on X_train: L13/d:93-94
3. model calls fit on scaled X_train: L13/d:95
4. scaler calls transform, not fit_transform: L13/d:97-98
5. model calls predict on scaled X_test: L13/d:99
6. each fold fits the preprocessor on its own training split: PL:446, L13/d:44, 315

## Transform and encode tasks (task-table, 8)
- min_max_scale(values): FE:5, scale to [0, 1]: L08/d:48
- standardize(values): FE:13, mean 0 std 1: L08/d:48
- log_transform(values), log(v + 1): FE:21-22
- bin_values(values, n_bins=5): FE:25
- polynomial_features(row, degree=2): FE:39
- target_encode(feature_values, target_values, smoothing=10): FE:71
- add_missing_indicator(values): FE:177
- tfidf(documents) returns vectors, vocab: FE:109, 143

## Feature selection tasks (task-table, 8)
- variance_threshold(X, threshold=0.01): FS:37
- mutual_information(X, y, n_bins=10): FS:52
- rfe(X, y, n_features_to_select=5, ...): FS:91
- l1_feature_selection(X, y, alpha=0.1, ...): FS:119
- tree_importance(X, y, n_trees=50, ...): FS:200
- RFE(LogisticRegression(), n_features_to_select=10): L18/d:484
- SelectFromModel(Lasso(alpha=0.01)): L18/d:488
- rf.feature_importances_: L18/d:494

## Ensembles: use X when (command-table, 6)
- Bagging / Random Forest, variance, noisy data, many features: L11/d:301
- AdaBoost, bias, clean data, sensitive to outliers: L11/d:302
- Gradient Boosting, bias, tabular, easy to overfit: L11/d:303
- XGBoost / LightGBM, both, production tabular, start with defaults: L11/d:304, 312
- Stacking, both, last 1-2%, cross-validation meta-features: L11/d:305, 175
- Soft voting averages probabilities: L11/d:182, 306

## Boosting loops (annotated-code, 8 lines)
- weights = np.full(n, 1 / n): EN:67
- err = np.clip(err, 1e-10, 1 - 1e-10): EN:75
- alpha = 0.5 * np.log((1 - err) / err): EN:77, lower error higher alpha: L11/d:114
- weights *= np.exp(-alpha * y * pred): EN:78, misclassified get higher weights: L11/d:114
- weights /= weights.sum(): EN:79
- self.initial_pred = np.mean(y): EN:175
- residuals = y - current_pred: EN:179, squared error residuals: L11/d:135
- current_pred += self.lr * update: EN:183, shrinkage: L11/d:137

## Defaults and numbers (defaults, 8)
- smoothing 10: FE:71, pull to global mean: FE:82-84, L08/d:202-204
- remove_correlated threshold 0.9: FE:241
- AdaBoostScratch n_estimators 50: EN:60
- GradientBoostingScratch 100, learning_rate=0.1, max_depth=3: EN:167
- BaggingClassifier 20, n_estimators=20, max_depth=5: EN:197
- learning rate 0.01 to 0.3, smaller needs more trees: L11/d:137
- bootstrap 63.2%, 36.8% out-of-bag: L11/d:66
- sqrt(n_features) and n_features / 3: L11/d:70

## Pipeline failures (troubleshooting, 7)
- fit on full data, Pipeline with cross_val_score: L13/d:254
- transforms outside pipeline, one Pipeline object: L13/d:255, 259
- unknown categories, OneHotEncoder(handle_unknown="ignore"): L13/d:256
- hardcoded column names, lists from config: L13/d:257
- random ID column ranks high, permutation importance: L18/d:151
- target encoding leakage, fit on train only, smoothing: L08/d:64, 575
- stacking meta-features via cross-validation: L11/d:175

## Formulas (concepts, 6)
- TF-IDF: L08/d:72-78
- mutual information, zero when independent: L18/d:79-83
- L1 loss and alpha: L18/d:125-129
- majority vote 21 at 60% about 74%, 101 gives 84%: L11/d:33
- RFE cost N - target, 500 to 10 is 490: L18/d:119
- sqrt(n) bins or Sturges' rule: L18/d:87

## Questions (qa, 6)
- scaling for K-Means, KNN, SVM: L08/d:48
- missing indicator informative: L08/d:87
- MI vs correlation, quadratic or periodic: L18/d:85
- soft voting uses confidence: L11/d:182
- reproducible run, four things: L13/d:200-205
- LightGBM or XGBoost with defaults first: L11/d:312
