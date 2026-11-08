---
id: feature-engineering
title: Feature Engineering and Pipelines
code: FE
subtitle: Impute, scale, encode, select and ensemble inside one leak-free pipeline. Python from the lessons.
hue: 30
sources: phases/02-ml-fundamentals/08-feature-engineering, phases/02-ml-fundamentals/11-ensemble-methods, phases/02-ml-fundamentals/13-ml-pipelines, phases/02-ml-fundamentals/18-feature-selection
source_hash: 25a47477c7c00c8d
---

## One pipeline for mixed columns
type: architecture
from: phases/02-ml-fundamentals/13-ml-pipelines/docs/en.md

```arch
node | raw | 1,1 | Training data | X_train only
node | num | 2,1 | numeric_pipe | median impute, scale
node | cat | 2,2 | categorical_pipe | most_frequent, one-hot
node | pre | 3,1 | ColumnTransformer | preprocess step
node | model | 4,1 | Model | GradientBoostingClassifier
node | pred | 4,2 | Prediction | transform, then predict
edge | raw | num | numeric cols
edge | raw | cat | categorical cols
edge | num | pre |
edge | cat | pre |
edge | pre | model | fit
edge | model | pred |
```

## Build it in sklearn
type: annotated-code
lang: python
from: phases/02-ml-fundamentals/13-ml-pipelines/docs/en.md

```python
numeric_pipe = Pipeline([
    ("impute", SimpleImputer(strategy="median")),
    ("scale", StandardScaler()),
])
categorical_pipe = Pipeline([
    ("impute", SimpleImputer(strategy="most_frequent")),
    ("encode", OneHotEncoder(handle_unknown="ignore")),  # unseen city gives zeros
])
preprocessor = ColumnTransformer([
    ("num", numeric_pipe, ["age", "income", "score"]),
    ("cat", categorical_pipe, ["city", "gender", "plan"]),
])
full_pipeline = Pipeline([("preprocess", preprocessor),
                          ("model", GradientBoostingClassifier())])
```

## What fit and predict do
type: flow
from: phases/02-ml-fundamentals/13-ml-pipelines/docs/en.md, phases/02-ml-fundamentals/13-ml-pipelines/code/pipeline.py

1. **Split first**: `X_train, X_test = X[:800], X[800:]` before any fit.
2. **pipe.fit**: each transformer calls `fit_transform` on X_train.
3. **pipe.fit**: the last step calls `fit` on the transformed X_train.
4. **pipe.predict**: each transformer calls `transform`, not `fit_transform`.
5. **pipe.predict**: the model calls `predict` on the transformed X_test.
6. **Cross-validation**: each fold fits the preprocessor on its own training split.

## Transform and encode tasks
type: task-table
from: phases/02-ml-fundamentals/08-feature-engineering/code/features.py

| Task | Code |
|---|---|
| Scale to [0, 1] | `min_max_scale(values)` |
| Mean 0, std 1 | `standardize(values)` |
| Compress right skew | `log_transform(values)` uses log(v + 1) |
| Equal-width bins | `bin_values(values, n_bins=5)` |
| Squares and pairs | `polynomial_features(row, degree=2)` |
| Smoothed target mean | `target_encode(feature_values, target_values, smoothing=10)` |
| Flag holes first | `add_missing_indicator(values)` |
| Text weights | `tfidf(documents)` returns vectors, vocab |

## Feature selection tasks
type: task-table
from: phases/02-ml-fundamentals/18-feature-selection/code/feature_selection.py, phases/02-ml-fundamentals/18-feature-selection/docs/en.md

| Task | Code |
|---|---|
| Drop near-constant columns | `variance_threshold(X, threshold=0.01)` |
| Rank by MI | `mutual_information(X, y, n_bins=10)` |
| Prune by weight | `rfe(X, y, n_features_to_select=5)` |
| Zero weights with L1 | `l1_feature_selection(X, y, alpha=0.1)` |
| Split-gain importance | `tree_importance(X, y, n_trees=50)` |
| sklearn RFE | `RFE(LogisticRegression(), n_features_to_select=10)` |
| sklearn L1 | `SelectFromModel(Lasso(alpha=0.01))` |
| sklearn trees | `rf.feature_importances_` |

## Ensembles: use X when
type: command-table
from: phases/02-ml-fundamentals/11-ensemble-methods/docs/en.md

| Command | What it does |
|---|---|
| Bagging / Random Forest | Cuts variance. Noisy data, many features |
| AdaBoost | Cuts bias. Clean data. Hurt by outliers |
| Gradient Boosting | Cuts bias. Tabular data. Easy to overfit |
| XGBoost / LightGBM | Both. Start here for production tabular ML |
| Stacking | Both. Last 1-2% accuracy. Use CV meta-features |
| Soft voting | Average probabilities of diverse models |

## Boosting loops
type: annotated-code
lang: python
from: phases/02-ml-fundamentals/11-ensemble-methods/docs/en.md, phases/02-ml-fundamentals/11-ensemble-methods/code/ensembles.py

```python
weights = np.full(n, 1 / n)                  # AdaBoost starts uniform
err = np.clip(err, 1e-10, 1 - 1e-10)         # weighted stump error
alpha = 0.5 * np.log((1 - err) / err)        # low error, high vote
weights *= np.exp(-alpha * y * pred)         # misses gain weight
weights /= weights.sum()
self.initial_pred = np.mean(y)               # gradient boosting start
residuals = y - current_pred                 # squared error gradient
current_pred += self.lr * update             # shrink each tree
```

## Defaults and numbers
type: defaults
from: phases/02-ml-fundamentals/08-feature-engineering/code/features.py, phases/02-ml-fundamentals/11-ensemble-methods/docs/en.md, phases/02-ml-fundamentals/11-ensemble-methods/code/ensembles.py

| Setting | Default | Note |
|---|---|---|
| Target encoding `smoothing` | 10 | Pulls rare categories to the global mean |
| `remove_correlated` threshold | 0.9 | Drops the second column of a pair |
| `AdaBoostScratch` `n_estimators` | 50 | Decision stumps |
| `GradientBoostingScratch` | 100 | learning_rate=0.1, max_depth=3 |
| `BaggingClassifier` | 20 | n_estimators=20, max_depth=5 |
| Learning rate range | 0.01 to 0.3 | Smaller needs more trees |
| Bootstrap unique rows | 63.2% | 36.8% out-of-bag for validation |
| Forest split features | `sqrt(n_features)` | `n_features / 3` for regression |

## Pipeline failures
type: troubleshooting
from: phases/02-ml-fundamentals/13-ml-pipelines/docs/en.md, phases/02-ml-fundamentals/08-feature-engineering/docs/en.md, phases/02-ml-fundamentals/18-feature-selection/docs/en.md, phases/02-ml-fundamentals/11-ensemble-methods/docs/en.md

| Symptom | Cause | Fix |
|---|---|---|
| Test score too high | Scaler fit before the split | Use Pipeline with `cross_val_score` |
| Train and serve outputs differ | Transforms outside the pipeline | One Pipeline object for both |
| Crash on a new city | Encoder never saw the value | `OneHotEncoder(handle_unknown="ignore")` |
| Breaks on schema change | Hardcoded column names | Column name lists from config |
| Random ID ranks high | Tree importance cardinality bias | Check with permutation importance |
| Target encoding overfits | Encoded on test rows | Fit on train data only, smooth |
| Stacking leaks | Meta-features from fitted data | Generate them with cross-validation |

## Formulas
type: concepts
from: phases/02-ml-fundamentals/08-feature-engineering/docs/en.md, phases/02-ml-fundamentals/18-feature-selection/docs/en.md, phases/02-ml-fundamentals/11-ensemble-methods/docs/en.md

- **TF-IDF**: $\frac{\text{count in doc}}{\text{words in doc}} \cdot \log \frac{\text{docs}}{\text{docs with word}}$
- **Mutual information**: $I(X; Y) = \sum_x \sum_y p(x, y) \log \frac{p(x, y)}{p(x) p(y)}$, zero when independent.
- **L1 loss**: prediction error plus $\alpha \sum \lvert w_i \rvert$. Higher alpha zeros more weights.
- **Majority vote**: 21 classifiers at 60% give about 74%. 101 give 84%.
- **RFE cost**: $N - \text{target}$ trainings. 500 features to 10 is 490 runs.
- **MI bins**: $\sqrt{n}$ bins or Sturges' rule $1 + \log_2 n$.

## Questions
type: qa
from: phases/02-ml-fundamentals/08-feature-engineering/docs/en.md, phases/02-ml-fundamentals/13-ml-pipelines/docs/en.md, phases/02-ml-fundamentals/18-feature-selection/docs/en.md, phases/02-ml-fundamentals/11-ensemble-methods/docs/en.md

- **Why scale features?** K-Means, KNN and SVM use distance. Scaling makes all features count equally.
- **Why add a missing indicator?** The fact that data is missing can itself be informative.
- **Why MI and not correlation?** MI catches quadratic or periodic links. Correlation can read zero.
- **Why soft voting?** It uses confidence information. It is usually better than hard voting.
- **What makes a run reproducible?** Fixed seeds, pinned dependencies, versioned data and config files.
- **Which model first on tabular data?** LightGBM or XGBoost with default parameters.
