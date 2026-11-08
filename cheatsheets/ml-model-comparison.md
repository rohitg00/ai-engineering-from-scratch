---
id: ml-model-comparison
title: Classical Models Compared
code: CC
subtitle: Linear and logistic regression, trees and forests, SVM, KNN and Naive Bayes side by side, with when to use each.
hue: 30
sources: phases/02-ml-fundamentals/02-linear-regression, phases/02-ml-fundamentals/03-logistic-regression, phases/02-ml-fundamentals/04-decision-trees, phases/02-ml-fundamentals/05-support-vector-machines, phases/02-ml-fundamentals/06-knn-and-distances, phases/02-ml-fundamentals/14-naive-bayes
source_hash: e76464be4e3d4e8a
---

## Models side by side
type: comparison
span: 2
from: phases/02-ml-fundamentals/02-linear-regression/docs/en.md, phases/02-ml-fundamentals/03-logistic-regression/docs/en.md, phases/02-ml-fundamentals/04-decision-trees/docs/en.md, phases/02-ml-fundamentals/05-support-vector-machines/docs/en.md, phases/02-ml-fundamentals/06-knn-and-distances/docs/en.md, phases/02-ml-fundamentals/14-naive-bayes/docs/en.md

| Model | Trains with | Boundary, prediction cost and memory |
|---|---|---|
| Linear regression | Gradient descent | A hyperplane. Normal equation is $O(n^3)$ in features |
| Logistic regression | binary cross-entropy | Always linear. Boundary where p = 0.5 |
| Decision tree | Gini impurity | Rectangular regions from greedy splits. High variance |
| Random forest | Bagging | Majority vote or average of many trees |
| SVM | Hinge loss | Maximum margin. Stores only the support vectors |
| KNN | Lazy | No training. $O(n \cdot d)$ per query, stores all data |
| Naive Bayes | Count frequencies | Linear. Prediction is one matrix multiply |

## Scaling and best data
type: comparison
from: phases/02-ml-fundamentals/02-linear-regression/docs/en.md, phases/02-ml-fundamentals/04-decision-trees/docs/en.md, phases/02-ml-fundamentals/05-support-vector-machines/docs/en.md, phases/02-ml-fundamentals/06-knn-and-distances/docs/en.md, phases/02-ml-fundamentals/14-naive-bayes/docs/en.md

| Model | Scale features | Wins on |
|---|---|---|
| Linear regression | yes | Baselines for every regression task |
| Trees and forests | no | Tabular data, mixed types, under 10k rows |
| SVM | yes | Small or high-dimensional sparse data |
| KNN | yes | Small data, up to about 20-50 features |
| Multinomial NB | no | Text with few training samples |
| Gaussian NB | no | Continuous features near a bell curve |

## Use each model when
type: tips
from: phases/02-ml-fundamentals/02-linear-regression/docs/en.md, phases/02-ml-fundamentals/03-logistic-regression/docs/en.md, phases/02-ml-fundamentals/04-decision-trees/docs/en.md, phases/02-ml-fundamentals/05-support-vector-machines/docs/en.md, phases/02-ml-fundamentals/06-knn-and-distances/docs/en.md, phases/02-ml-fundamentals/14-naive-bayes/docs/en.md

- Use linear regression as the baseline for every regression task.
- Use logistic regression for yes-or-no answers with probabilities and a linear boundary.
- Use a random forest for flat tables. It needs almost no hyperparameter tuning.
- Use an SVM for small data or sparse text with TF-IDF features.
- Use KNN when the data changes often and you want zero training time.
- Use TF-IDF with MultinomialNB for text with fewer than 10,000 training samples.
- Use BernoulliNB for short text. Set `binary=True` in CountVectorizer.

## Losses and formulas
type: concepts
from: phases/02-ml-fundamentals/02-linear-regression/docs/en.md, phases/02-ml-fundamentals/03-logistic-regression/docs/en.md, phases/02-ml-fundamentals/04-decision-trees/docs/en.md, phases/02-ml-fundamentals/05-support-vector-machines/docs/en.md, phases/02-ml-fundamentals/06-knn-and-distances/docs/en.md, phases/02-ml-fundamentals/14-naive-bayes/docs/en.md

- **MSE**: $\frac{1}{n} \sum (\hat{y} - y)^2$. The gradient for w is $\frac{2}{n} \sum (\hat{y} - y) x$.
- **R squared**: $1 - SS_{\text{res}} / SS_{\text{tot}}$. 1.0 is perfect. 0.0 equals the mean.
- **Sigmoid**: $\sigma(z) = 1 / (1 + e^{-z})$. At $z = 0$ it gives 0.5.
- **Binary cross-entropy**: $-\frac{1}{n} \sum (y \log p + (1-y) \log(1-p))$. Gradient $\frac{1}{n} \sum (p - y) x$.
- **Gini**: $1 - \sum_k p_k^2$. 6 cats and 4 dogs give 0.48.
- **Hinge**: $\max(0, 1 - y f(x))$. Zero beyond the margin.
- **RBF kernel**: $\exp(-\gamma \lVert x - z \rVert^2)$. Near 1 for close points.
- **Multinomial NB**: $(\text{count} + \alpha) / (\text{total} + \alpha \cdot V)$, summed in log space.

## Scale, then fit
type: annotated-code
lang: python
from: phases/02-ml-fundamentals/05-support-vector-machines/docs/en.md, phases/02-ml-fundamentals/06-knn-and-distances/docs/en.md, phases/02-ml-fundamentals/14-naive-bayes/docs/en.md

```python
clf = Pipeline([
    ("scaler", StandardScaler()),                       # SVM and KNN need it
    ("svm", SVC(kernel="rbf", C=1.0, gamma="scale")),   # dual form, kernels
])
clf.fit(X_train, y_train)
clf.score(X_test, y_test)                               # accuracy
clf['svm'].n_support_                                   # support vectors
("svm", LinearSVC(C=1.0, max_iter=10000))               # large data, primal
("knn", KNeighborsClassifier(n_neighbors=5, metric="euclidean"))
mnb = MultinomialNB(alpha=1.0)                          # counts, no scaling
mnb.fit(X_train_counts, y_train)
```

## Grow a random forest
type: flow
from: phases/02-ml-fundamentals/04-decision-trees/docs/en.md, phases/02-ml-fundamentals/04-decision-trees/code/trees.py

1. **Bootstrap**: sample rows with replacement. About 63% of rows appear.
2. **Out-of-bag**: the other rows can validate the tree.
3. **Feature subset**: each split sees $\sqrt{n_{\text{features}}}$ features for classification.
4. **Greedy split**: pick the feature and threshold with the highest information gain.
5. **Stop**: a pure node or a pre-pruning limit ends the branch.
6. **Repeat**: build `n_trees` trees. The default is 100.
7. **Aggregate**: majority vote for classes, average for regression.

## Knobs that trade bias and variance
type: command-table
from: phases/02-ml-fundamentals/05-support-vector-machines/docs/en.md, phases/02-ml-fundamentals/06-knn-and-distances/docs/en.md, phases/02-ml-fundamentals/04-decision-trees/docs/en.md, phases/02-ml-fundamentals/14-naive-bayes/docs/en.md, phases/02-ml-fundamentals/02-linear-regression/docs/en.md

| Command | What it does |
|---|---|
| Large `C` | Narrow margin, fewer misclassifications. Overfits |
| Small `C` | Wide margin, more violations. Underfits |
| `K = 1` | Zero training error. High variance |
| `K = N` | Predicts the majority class. Maximum bias |
| Max depth | Stops the tree early. Pre-pruning |
| NB `alpha` | Higher alpha gives stronger smoothing |
| Ridge $\lambda$ | Higher gives smaller weights |
| SVR $\epsilon$ | Wider tube, fewer support vectors |

## Defaults in the lesson code
type: defaults
from: phases/02-ml-fundamentals/04-decision-trees/code/trees.py, phases/02-ml-fundamentals/04-decision-trees/docs/en.md, phases/02-ml-fundamentals/06-knn-and-distances/code/knn.py, phases/02-ml-fundamentals/06-knn-and-distances/docs/en.md, phases/02-ml-fundamentals/05-support-vector-machines/code/svm.py, phases/02-ml-fundamentals/14-naive-bayes/code/naive_bayes.py, phases/02-ml-fundamentals/14-naive-bayes/docs/en.md

| Setting | Default | Note |
|---|---|---|
| Tree `max_depth` | None | Grows until every leaf is pure |
| Tree `min_samples_split` | 2 | A pre-pruning control |
| Tree `criterion` | "gini" | Gini and entropy split almost the same |
| Forest `n_trees` | 100 | scikit-learn uses `n_estimators=100` |
| Forest `max_features` | "sqrt" | Regression uses n_features/3 |
| KNN `k` | 5 | Start near sqrt(N). Odd K for binary |
| SVM `rbf_kernel` gamma | 0.5 | `polynomial_kernel` degree 3 |
| GaussianNB `var_smoothing` | 1e-9 | Stops division by zero variance |

## Failures and fixes
type: troubleshooting
from: phases/02-ml-fundamentals/03-logistic-regression/docs/en.md, phases/02-ml-fundamentals/04-decision-trees/docs/en.md, phases/02-ml-fundamentals/05-support-vector-machines/docs/en.md, phases/02-ml-fundamentals/06-knn-and-distances/docs/en.md, phases/02-ml-fundamentals/14-naive-bayes/docs/en.md

| Symptom | Cause | Fix |
|---|---|---|
| Logistic fails on circles | The boundary is always linear | Add polynomial features |
| SVM accuracy is poor | Unscaled features distort the margin | `StandardScaler` in a `Pipeline` |
| `SVC` too slow | Dual form is $O(n^2)$ to $O(n^3)$ | `LinearSVC` primal form |
| KNN degrades with many features | Curse of dimensionality | PCA or UMAP first |
| One tree changes with the data | A single tree is high variance | Use a random forest |
| MDI ranks a noise feature high | Bias to high cardinality | Permutation importance |
| NB gives probability 0 | Unseen word in a class | Laplace smoothing, alpha 1 |
| MultinomialNB rejects features | Negative feature values | GaussianNB or shift values |

## Questions
type: qa
from: phases/02-ml-fundamentals/02-linear-regression/docs/en.md, phases/02-ml-fundamentals/03-logistic-regression/docs/en.md, phases/02-ml-fundamentals/04-decision-trees/docs/en.md, phases/02-ml-fundamentals/05-support-vector-machines/docs/en.md, phases/02-ml-fundamentals/14-naive-bayes/docs/en.md

- **Why not MSE for logistic regression?** With a sigmoid, MSE is non-convex. Binary cross-entropy is convex.
- **Why does NB work with a wrong assumption?** Classification needs correct rankings, not correct probabilities.
- **Why does a forest beat one tree?** Averaging decorrelated trees reduces variance without more bias.
- **Why do only support vectors count?** Points beyond the margin have zero hinge loss.
- **NB or logistic regression?** Start with NB. Switch when data is large and NB plateaus.
- **Normal equation or gradient descent?** Normal equation for small data. Gradient descent for large data.
- **Do I trust NB probabilities?** No. Use `CalibratedClassifierCV` with `cv=5`.

## From-scratch classes
type: task-table
from: phases/02-ml-fundamentals/02-linear-regression/code/linear_regression.py, phases/02-ml-fundamentals/03-logistic-regression/code/logistic_regression.py, phases/02-ml-fundamentals/04-decision-trees/code/trees.py, phases/02-ml-fundamentals/05-support-vector-machines/code/svm.py, phases/02-ml-fundamentals/14-naive-bayes/code/naive_bayes.py

| Task | Code |
|---|---|
| Closed-form line | `LinearRegressionNormal()` |
| Node impurity | `gini_impurity(labels)` |
| Kernel value | `rbf_kernel(x, z, gamma=0.5)` |
| Batch hinge loss | `hinge_loss(X, y, w, b)` |
| Text classifier | `MultinomialNB(alpha=1.0)` |
