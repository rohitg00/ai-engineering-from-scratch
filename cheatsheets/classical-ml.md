---
id: classical-ml
title: Classical Machine Learning
code: CM
subtitle: Fit, validate, tune and fix regression, classification and clustering models with scikit-learn.
hue: 120
sources: phases/02-ml-fundamentals/02-linear-regression, phases/02-ml-fundamentals/03-logistic-regression, phases/02-ml-fundamentals/04-decision-trees, phases/02-ml-fundamentals/05-support-vector-machines, phases/02-ml-fundamentals/06-knn-and-distances, phases/02-ml-fundamentals/07-unsupervised-learning, phases/02-ml-fundamentals/08-feature-engineering, phases/02-ml-fundamentals/09-model-evaluation, phases/02-ml-fundamentals/10-bias-variance, phases/02-ml-fundamentals/11-ensemble-methods, phases/02-ml-fundamentals/12-hyperparameter-tuning, phases/02-ml-fundamentals/13-ml-pipelines, phases/02-ml-fundamentals/14-naive-bayes, phases/02-ml-fundamentals/17-imbalanced-data, phases/02-ml-fundamentals/18-feature-selection
source_hash: e9148bde41cb124d
---

## Fit a model
type: task-table
col: 1
from: phases/02-ml-fundamentals/02-linear-regression/docs/en.md, phases/02-ml-fundamentals/17-imbalanced-data/docs/en.md, phases/02-ml-fundamentals/04-decision-trees/docs/en.md, phases/02-ml-fundamentals/05-support-vector-machines/docs/en.md, phases/02-ml-fundamentals/06-knn-and-distances/docs/en.md, phases/02-ml-fundamentals/07-unsupervised-learning/docs/en.md

| Task | Code |
|---|---|
| L2 regularized regression | `Ridge(alpha=1.0)` |
| Classifier for rare positives | `LogisticRegression(class_weight="balanced")` |
| Random forest | `RandomForestClassifier(n_estimators=100, random_state=42)` |
| Kernel SVM | `SVC(kernel="rbf", C=1.0, gamma="scale")` |
| Linear SVM for large data | `LinearSVC(C=1.0, max_iter=10000)` |
| k nearest neighbours | `KNeighborsClassifier(n_neighbors=5, metric="euclidean")` |
| K-Means clusters | `KMeans(n_clusters=3, random_state=42).fit(data)` |
| Density clusters and noise | `DBSCAN(eps=1.5, min_samples=5).fit(data)` |

## Metrics
type: command-table
col: 2
from: phases/02-ml-fundamentals/09-model-evaluation/docs/en.md, phases/02-ml-fundamentals/17-imbalanced-data/docs/en.md

| Metric | Formula and use |
|---|---|
| Accuracy | $(TP + TN) / (TP + TN + FP + FN)$. Misleading on imbalanced classes |
| Precision | $TP / (TP + FP)$. Use when false positives are costly |
| Recall | $TP / (TP + FN)$. Use when false negatives are costly |
| F1 | $2 \cdot P \cdot R / (P + R)$. Harmonic mean of both |
| AUC-ROC | 0.5 is random, 1.0 is perfect. Threshold independent |
| R-squared | $1 - SS_{\text{res}} / SS_{\text{tot}}$. Below 0 is worse than the mean |

## Key formulas
type: concepts
col: 3
from: phases/02-ml-fundamentals/02-linear-regression/docs/en.md, phases/02-ml-fundamentals/03-logistic-regression/docs/en.md, phases/02-ml-fundamentals/04-decision-trees/docs/en.md, phases/02-ml-fundamentals/05-support-vector-machines/docs/en.md, phases/02-ml-fundamentals/10-bias-variance/docs/en.md

- **MSE**: $\text{MSE} = \frac{1}{n} \sum (y_{\text{predicted}} - y_{\text{actual}})^2$
- **Normal equation**: $w = (X^T X)^{-1} X^T y$. Cost is $O(n^3)$ in features.
- **Ridge**: $\text{Cost} = \text{MSE} + \lambda \sum w_i^2$
- **Log loss**: $-\frac{1}{n} \sum \left( y \log(p) + (1-y) \log(1-p) \right)$, $p = \sigma(wx + b)$
- **Gini**: $\text{Gini}(S) = 1 - \sum_k p_k^2$. 0 is a pure node.
- **Soft margin SVM**: $\min \frac{1}{2} \lVert w \rVert^2 + C \sum_i \max(0, 1 - y_i (w^T x_i + b))$
- **RBF kernel**: $K(x, z) = \exp(-\gamma \lVert x - z \rVert^2)$
- **Error split**: $\text{Bias}^2 + \text{Variance} + \text{Irreducible Noise}$

## Leak-free preprocessing
type: annotated-code
col: 2
lang: python
from: phases/02-ml-fundamentals/13-ml-pipelines/docs/en.md, phases/02-ml-fundamentals/13-ml-pipelines/code/pipeline.py

```python
# Leaky: the scaler sees the test rows
X_scaled = scaler.fit_transform(X)
# Correct: fit on train, reuse on test
X_train_scaled = scaler.fit_transform(X_train)   # learn mean and std
X_test_scaled = scaler.transform(X_test)         # train statistics only
# Best: one Pipeline object for train and serve
pipe = Pipeline([
    ("scaler", StandardScaler()),
    ("model", LogisticRegression()),
])
pipe.fit(X_train, y_train)                       # fit_transform, then fit
predictions = pipe.predict(X_test)               # transform, then predict
scores = cross_val_score(full_pipe, df, y, cv=5, scoring="accuracy")  # refit per fold
```

## Validate without leakage
type: flow
col: 4
from: phases/02-ml-fundamentals/09-model-evaluation/docs/en.md, phases/02-ml-fundamentals/13-ml-pipelines/docs/en.md

1. **Split**: hold out a test set. Touch it exactly once, at the end.
2. **Folds**: split the rest into $K$ folds. Stratify for class ratios.
3. **Fit**: the scaler calls `fit_transform` on the $K-1$ training folds.
4. **Train**: the model calls `fit` on the scaled training folds.
5. **Score**: the scaler calls `transform` on the validation fold, then the model predicts.
6. **Average**: repeat for each fold and average the $K$ scores.
7. **Report**: score the final model on the test set.

## Questions
type: qa
col: 4
from: phases/02-ml-fundamentals/03-logistic-regression/docs/en.md, phases/02-ml-fundamentals/05-support-vector-machines/docs/en.md, phases/02-ml-fundamentals/10-bias-variance/docs/en.md, phases/02-ml-fundamentals/17-imbalanced-data/docs/en.md, phases/02-ml-fundamentals/09-model-evaluation/docs/en.md

- **Why not MSE for logistic regression?** With a sigmoid it is non-convex. Log loss is convex.
- **Why scale before an SVM?** The margin depends on $\lVert w \rVert$.
- **Why does L1 select features?** It pushes some weights exactly to zero.
- **Will more data fix high bias?** No. Change the model.
- **Why class weights over oversampling?** Same in expectation, no duplicate rows.

## Tips
type: tips
col: 1
from: phases/02-ml-fundamentals/12-hyperparameter-tuning/docs/en.md, phases/02-ml-fundamentals/09-model-evaluation/docs/en.md, phases/02-ml-fundamentals/08-feature-engineering/docs/en.md, phases/02-ml-fundamentals/17-imbalanced-data/docs/en.md

- Sweep the learning rate first. Fix the rest at defaults.
- Search learning rate and regularization on a log scale.
- Set n_estimators high and let early stopping decide.
- Use nested cross-validation for the final estimate.
- Add a was_this_missing column before you impute.
- Pick the threshold on the validation set, not the test set.

## ColumnTransformer pipeline
type: architecture
col: 1
from: phases/02-ml-fundamentals/13-ml-pipelines/docs/en.md, phases/02-ml-fundamentals/13-ml-pipelines/code/pipeline.py

```arch
node | raw | 1,1 | DataFrame | numeric and categorical
node | num | 1,2 | Numeric columns | age, income, score
node | cat | 2,2 | Categorical columns | city, plan
node | nimp | 1,3 | SimpleImputer | median, then StandardScaler
node | cimp | 2,3 | SimpleImputer | most_frequent, then OneHotEncoder
node | ct | 1,4 | ColumnTransformer | joins both outputs
node | model | 2,4 | Model | GradientBoostingClassifier, predict
edge | raw | num | select
edge | raw | cat | select
edge | num | nimp |
edge | cat | cimp |
edge | nimp | ct |
edge | cimp | ct |
edge | ct | model |
```

## Tune hyperparameters
type: annotated-code
col: 1
lang: python
from: phases/02-ml-fundamentals/12-hyperparameter-tuning/docs/en.md

```python
param_dist = {
    "learning_rate": loguniform(1e-4, 0.5),      # log scale for rates
    "max_depth": randint(2, 10),                 # integer range
    "n_estimators": randint(50, 500),
}
search = RandomizedSearchCV(
    GradientBoostingRegressor(), param_dist,
    n_iter=100, cv=5,                            # 100 samples, 5 folds each
    scoring="neg_mean_squared_error",            # negated, higher is better
    random_state=42, n_jobs=-1,                  # all CPU cores
)
search.fit(X_train, y_train)
print(search.best_params_, -search.best_score_)  # negate back to MSE
```

## Troubleshooting
type: troubleshooting
col: 3
from: phases/02-ml-fundamentals/10-bias-variance/docs/en.md, phases/02-ml-fundamentals/13-ml-pipelines/docs/en.md, phases/02-ml-fundamentals/17-imbalanced-data/docs/en.md, phases/02-ml-fundamentals/05-support-vector-machines/docs/en.md, phases/02-ml-fundamentals/12-hyperparameter-tuning/docs/en.md, phases/02-ml-fundamentals/06-knn-and-distances/docs/en.md

| Symptom | Cause | Fix |
|---|---|---|
| High train and test error | high bias | more features, complex model, less regularization |
| Low train error, high test error | high variance | more data, regularization, simpler model |
| Test error rises, train error falls | overfitting in progress | early stopping |
| CV score higher than production | scaler fit on full data | Pipeline with cross_val_score |
| Crash on a new category | encoder never saw the value | `OneHotEncoder(handle_unknown="ignore")` |
| 99% accuracy, no positives found | class imbalance | class weights, threshold tuning |
| SVM or KNN scores low | unscaled features | `StandardScaler()` first |
| Best value at the search edge | range too narrow | widen the search space |

## Starting values
type: defaults
col: 3
from: phases/02-ml-fundamentals/17-imbalanced-data/docs/en.md, phases/02-ml-fundamentals/09-model-evaluation/docs/en.md, phases/02-ml-fundamentals/11-ensemble-methods/docs/en.md, phases/02-ml-fundamentals/04-decision-trees/docs/en.md, phases/02-ml-fundamentals/14-naive-bayes/docs/en.md

| Setting | Default | Note |
|---|---|---|
| Decision threshold | 0.5 | lower it for rare positives |
| CV folds K | 5 | 10 is also standard |
| Features per split, forest | sqrt(n_features) | n_features / 3 for regression |
| Trees in a forest | 100 | n_estimators in the lesson code |
| Boosting learning_rate | 0.1 | typical 0.01 to 0.3 |
| Boosting max_depth | 3 | lesson GradientBoosting class |
| Naive Bayes alpha | 1.0 | Laplace smoothing |
| Out of bag share | 36.8% | free validation set |

## Abbreviations
type: glossary
col: 3
span: 2
from: phases/02-ml-fundamentals/09-model-evaluation/docs/en.md, phases/02-ml-fundamentals/17-imbalanced-data/docs/en.md, phases/02-ml-fundamentals/07-unsupervised-learning/docs/en.md, phases/02-ml-fundamentals/18-feature-selection/docs/en.md

- **AUC-ROC**: Area Under the Receiver Operating Characteristic curve.
- **SMOTE**: synthetic minority samples by k-NN interpolation.
- **GMM**: Gaussian Mixture Model. Soft clusters by Expectation-Maximization.
- **RFE**: Recursive Feature Elimination. Train, rank, prune, repeat.
